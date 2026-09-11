const STORAGE_KEY='mcp-core-v02';
const FIT_PARSER_URL='https://esm.sh/fit-file-parser@5.0.2';

function readState(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}
}
function writeState(state){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function haversineKm(a,b){
  const R=6371,rad=x=>x*Math.PI/180;
  const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
  const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function parseGpx(text,fileName){
  const xml=new DOMParser().parseFromString(text,'application/xml');
  if(xml.querySelector('parsererror')) throw new Error('El GPX no es válido.');
  const pts=[...xml.querySelectorAll('trkpt,rtept')].map(n=>({
    lat:Number(n.getAttribute('lat')),
    lon:Number(n.getAttribute('lon')),
    ele:Number(n.querySelector('ele')?.textContent||0),
    time:n.querySelector('time')?.textContent?new Date(n.querySelector('time').textContent):null
  })).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  if(pts.length<2) throw new Error('El GPX no contiene suficientes puntos de track.');
  let distanceKm=0,elevationM=0;
  for(let i=1;i<pts.length;i++){
    distanceKm+=haversineKm(pts[i-1],pts[i]);
    if(Number.isFinite(pts[i].ele)&&Number.isFinite(pts[i-1].ele)) elevationM+=Math.max(0,pts[i].ele-pts[i-1].ele);
  }
  const times=pts.map(p=>p.time).filter(Boolean).sort((a,b)=>a-b);
  const first=times[0]||null,last=times[times.length-1]||null;
  const durationMin=first&&last?Math.max(1,Math.round((last-first)/60000)):null;
  const date=first?first.toISOString().slice(0,10):new Date().toISOString().slice(0,10);
  const name=xml.querySelector('trk > name, metadata > name, rte > name')?.textContent?.trim()||fileName.replace(/\.gpx$/i,'');
  return {name,date,durationMin,distanceKm:Number(distanceKm.toFixed(2)),elevationM:Math.round(elevationM),source:'gpx'};
}
function sportFromFit(value){
  const s=String(value||'').toLowerCase();
  if(s.includes('cycl')||s.includes('bike')) return 'cycling';
  if(s.includes('run')) return 'running';
  if(s.includes('box')) return 'boxing';
  if(s.includes('strength')||s.includes('training')) return 'strength';
  return 'other';
}
function asNumber(...values){
  for(const value of values){const n=Number(value);if(Number.isFinite(n)) return n}
  return null;
}
async function parseFit(file){
  let FitParser;
  try{
    ({default:FitParser}=await import(FIT_PARSER_URL));
  }catch{
    throw new Error('No se ha podido cargar el lector FIT. Comprueba la conexión e inténtalo de nuevo.');
  }
  const parser=new FitParser({mode:'list',force:true,speedUnit:'km/h',lengthUnit:'km',temperatureUnit:'celsius',elapsedRecordField:true});
  let data;
  try{data=await parser.parseAsync(await file.arrayBuffer())}
  catch(err){throw new Error(typeof err==='string'?err:'No se ha podido interpretar el archivo FIT.')}
  const sessions=Array.isArray(data.sessions)?data.sessions:[];
  const session=sessions[0]||{};
  const records=Array.isArray(data.records)?data.records:[];
  const firstRecord=records[0]||{};
  const lastRecord=records[records.length-1]||{};
  const startRaw=session.start_time||session.timestamp||firstRecord.timestamp;
  const start=startRaw?new Date(startRaw):null;
  const date=start&&!Number.isNaN(start.getTime())?start.toISOString().slice(0,10):new Date().toISOString().slice(0,10);
  let durationSec=asNumber(session.total_timer_time,session.total_elapsed_time);
  if(!durationSec&&firstRecord.timestamp&&lastRecord.timestamp){
    const a=new Date(firstRecord.timestamp),b=new Date(lastRecord.timestamp);
    if(!Number.isNaN(a.getTime())&&!Number.isNaN(b.getTime())) durationSec=(b-a)/1000;
  }
  const durationMin=durationSec?Math.max(1,Math.round(durationSec/60)):null;
  let distanceKm=asNumber(session.total_distance);
  if(distanceKm==null&&records.length){
    const lastDistance=asNumber(lastRecord.distance);
    if(lastDistance!=null) distanceKm=lastDistance;
  }
  const elevationM=asNumber(session.total_ascent,session.total_ascent_1);
  const avgHr=asNumber(session.avg_heart_rate,session.avg_hr);
  const maxHr=asNumber(session.max_heart_rate,session.max_hr);
  const avgPower=asNumber(session.avg_power);
  const normalizedPower=asNumber(session.normalized_power);
  const avgCadence=asNumber(session.avg_cadence);
  const calories=asNumber(session.total_calories,session.calories);
  const sport=sportFromFit(session.sport||session.sub_sport||data.sport);
  const title=file.name.replace(/\.fit$/i,'');
  return {
    name:title,date,durationMin,distanceKm:distanceKm==null?null:Number(distanceKm.toFixed(2)),elevationM:elevationM==null?null:Math.round(elevationM),
    avgHr,maxHr,avgPower,normalizedPower,avgCadence,calories,sport,source:'fit'
  };
}
function showMessage(box,text,type='ok'){
  box.textContent=text;
  box.style.marginTop='10px';
  box.style.color=type==='error'?'#ff8b91':'#8ee8b7';
}
function summary(data){
  const parts=[];
  if(data.distanceKm!=null) parts.push(`${data.distanceKm} km`);
  if(data.durationMin) parts.push(`${data.durationMin} min`);
  if(data.elevationM!=null) parts.push(`+${data.elevationM} m`);
  if(data.avgHr!=null) parts.push(`${Math.round(data.avgHr)} ppm`);
  if(data.avgPower!=null) parts.push(`${Math.round(data.avgPower)} W`);
  return parts.join(' · ');
}
function decorateImporter(){
  const input=[...document.querySelectorAll('input[type="file"]')].find(el=>(el.getAttribute('accept')||'').includes('.gpx'));
  if(!input||input.dataset.mcpBound==='1') return;
  input.dataset.mcpBound='1';
  input.setAttribute('accept','.fit,.gpx,.tcx,.csv');
  const wrapper=document.createElement('div');
  wrapper.className='gpx-import-actions';
  wrapper.innerHTML='<div class="form-row" style="margin-top:12px"><select data-import-sport><option value="auto">Detectar deporte</option><option value="cycling">Bici</option><option value="running">Running</option><option value="boxing">Boxeo</option><option value="strength">Fuerza</option><option value="other">Otro</option></select><button type="button" class="primary" data-import-file disabled>Cargar archivo</button></div><p class="muted" data-import-file-label>No hay archivo seleccionado.</p><p class="muted">FIT: importa métricas de Garmin cuando estén presentes. GPX: importa track, distancia, tiempo y desnivel.</p><p data-import-msg></p>';
  input.insertAdjacentElement('afterend',wrapper);
  const button=wrapper.querySelector('[data-import-file]');
  const sport=wrapper.querySelector('[data-import-sport]');
  const fileLabel=wrapper.querySelector('[data-import-file-label]');
  const msg=wrapper.querySelector('[data-import-msg]');
  input.addEventListener('change',()=>{
    const file=input.files?.[0];
    fileLabel.textContent=file?`Seleccionado: ${file.name}`:'No hay archivo seleccionado.';
    button.disabled=!file;
    msg.textContent='';
  });
  button.addEventListener('click',async()=>{
    const file=input.files?.[0];
    if(!file) return;
    const isFit=/\.fit$/i.test(file.name),isGpx=/\.gpx$/i.test(file.name);
    if(!isFit&&!isGpx){showMessage(msg,'En esta versión la carga real está activa para FIT y GPX.','error');return}
    try{
      button.disabled=true;button.textContent=isFit?'Leyendo FIT…':'Leyendo GPX…';
      const data=isFit?await parseFit(file):parseGpx(await file.text(),file.name);
      const state=readState();
      if(!state) throw new Error('No se ha podido leer el estado local de MCP Core.');
      state.completed=Array.isArray(state.completed)?state.completed:[];
      const selectedSport=sport.value==='auto'?(data.sport||'cycling'):sport.value;
      state.completed.unshift({
        id:crypto.randomUUID(),title:data.name,date:data.date,sport:selectedSport,
        duration:data.durationMin||0,actualDuration:data.durationMin||0,intensity:'moderate',priority:'normal',source:data.source,
        completed:true,completedAt:new Date().toISOString(),rpe:5,
        distanceKm:data.distanceKm,elevationM:data.elevationM,avgHr:data.avgHr??null,maxHr:data.maxHr??null,
        avgPower:data.avgPower??null,normalizedPower:data.normalizedPower??null,avgCadence:data.avgCadence??null,calories:data.calories??null,
        importFileName:file.name
      });
      writeState(state);
      showMessage(msg,`${isFit?'FIT':'GPX'} cargado${summary(data)?`: ${summary(data)}`:''}. Recargando…`);
      setTimeout(()=>location.reload(),900);
    }catch(err){
      showMessage(msg,err?.message||'No se ha podido cargar el archivo.','error');
      button.disabled=false;button.textContent='Cargar archivo';
    }
  });
}

const observer=new MutationObserver(decorateImporter);
observer.observe(document.documentElement,{childList:true,subtree:true});
decorateImporter();
