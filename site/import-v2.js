const STORAGE_KEY='mcp-core-v02';
const FIT_PARSER_URL='https://esm.sh/fit-file-parser@5.0.2';

function readState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
function writeState(state){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function haversineKm(a,b){const R=6371,rad=x=>x*Math.PI/180;const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function inferGpxSport(name,distanceKm,movingMin){
  const n=String(name||'').toLowerCase();
  if(/run|running|correr|carrera|rodaje|series|tempo/.test(n)) return {sport:'running',confidence:'high',reason:'nombre del track'};
  if(/bike|bici|cycling|ciclismo|mtb|gravel|road/.test(n)) return {sport:'cycling',confidence:'high',reason:'nombre del track'};
  if(distanceKm&&movingMin){const speed=distanceKm/(movingMin/60);if(speed>=4.5&&speed<=14) return {sport:'running',confidence:'medium',reason:`velocidad media en movimiento ${speed.toFixed(1)} km/h`};if(speed>=16) return {sport:'cycling',confidence:'medium',reason:`velocidad media en movimiento ${speed.toFixed(1)} km/h`}}
  return {sport:'other',confidence:'low',reason:'GPX sin información suficiente para detectar el deporte'};
}
function parseGpx(text,fileName){
  const xml=new DOMParser().parseFromString(text,'application/xml');if(xml.querySelector('parsererror')) throw new Error('El GPX no es válido.');
  const pts=[...xml.querySelectorAll('trkpt,rtept')].map(n=>({lat:Number(n.getAttribute('lat')),lon:Number(n.getAttribute('lon')),ele:Number(n.querySelector('ele')?.textContent||0),time:n.querySelector('time')?.textContent?new Date(n.querySelector('time').textContent):null})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  if(pts.length<2) throw new Error('El GPX no contiene suficientes puntos de track.');
  let distanceKm=0,elevationM=0,movingSec=0;
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i],d=haversineKm(a,b);distanceKm+=d;
    if(Number.isFinite(b.ele)&&Number.isFinite(a.ele)) elevationM+=Math.max(0,b.ele-a.ele);
    if(a.time&&b.time){const sec=(b.time-a.time)/1000;if(sec>0&&sec<=10) movingSec+=sec}
  }
  const times=pts.map(p=>p.time).filter(Boolean).sort((a,b)=>a-b),first=times[0]||null,last=times[times.length-1]||null;
  const elapsedSec=first&&last?Math.max(1,(last-first)/1000):null;
  if(!movingSec&&elapsedSec) movingSec=elapsedSec;
  const movingMin=movingSec?movingSec/60:null,elapsedMin=elapsedSec?elapsedSec/60:null;
  const date=first?first.toISOString().slice(0,10):new Date().toISOString().slice(0,10);
  const name=xml.querySelector('trk > name, metadata > name, rte > name')?.textContent?.trim()||fileName.replace(/\.gpx$/i,'');
  const dist=Number(distanceKm.toFixed(2)),detected=inferGpxSport(name,dist,movingMin);
  const avgSpeedKmh=movingMin?Number((distanceKm/(movingMin/60)).toFixed(2)):null;
  const paceMinKm=movingMin&&distanceKm>0?movingMin/distanceKm:null;
  return {name,date,movingMin,elapsedMin,distanceKm:dist,elevationM:Math.round(elevationM),avgSpeedKmh,paceMinKm,detectedSport:detected.sport,detectionConfidence:detected.confidence,detectionReason:detected.reason,source:'gpx'};
}
function sportFromFit(value){const s=String(value||'').toLowerCase();if(s.includes('cycl')||s.includes('bike')) return 'cycling';if(s.includes('run')) return 'running';if(s.includes('box')) return 'boxing';if(s.includes('strength')||s.includes('training')) return 'strength';return 'other'}
function asNumber(...values){for(const value of values){const n=Number(value);if(Number.isFinite(n)) return n}return null}
async function parseFit(file){
  let FitParser;try{({default:FitParser}=await import(FIT_PARSER_URL))}catch{throw new Error('No se ha podido cargar el lector FIT. Comprueba la conexión e inténtalo de nuevo.')}
  const parser=new FitParser({mode:'list',force:true,speedUnit:'km/h',lengthUnit:'km',temperatureUnit:'celsius',elapsedRecordField:true});let data;
  try{data=await parser.parseAsync(await file.arrayBuffer())}catch(err){throw new Error(typeof err==='string'?err:'No se ha podido interpretar el archivo FIT.')}
  const sessions=Array.isArray(data.sessions)?data.sessions:[],session=sessions[0]||{},records=Array.isArray(data.records)?data.records:[],firstRecord=records[0]||{},lastRecord=records[records.length-1]||{};
  const startRaw=session.start_time||session.timestamp||firstRecord.timestamp,start=startRaw?new Date(startRaw):null,date=start&&!Number.isNaN(start.getTime())?start.toISOString().slice(0,10):new Date().toISOString().slice(0,10);
  let timerSec=asNumber(session.total_timer_time),elapsedSec=asNumber(session.total_elapsed_time);
  if(!elapsedSec&&firstRecord.timestamp&&lastRecord.timestamp){const a=new Date(firstRecord.timestamp),b=new Date(lastRecord.timestamp);if(!Number.isNaN(a.getTime())&&!Number.isNaN(b.getTime())) elapsedSec=(b-a)/1000}
  if(!timerSec) timerSec=elapsedSec;
  const movingMin=timerSec?timerSec/60:null,elapsedMin=elapsedSec?elapsedSec/60:movingMin;
  let distanceKm=asNumber(session.total_distance);if(distanceKm==null&&records.length){const lastDistance=asNumber(lastRecord.distance);if(lastDistance!=null) distanceKm=lastDistance}
  const elevationM=asNumber(session.total_ascent,session.total_ascent_1),avgHr=asNumber(session.avg_heart_rate,session.avg_hr),maxHr=asNumber(session.max_heart_rate,session.max_hr),avgPower=asNumber(session.avg_power),normalizedPower=asNumber(session.normalized_power),avgCadence=asNumber(session.avg_cadence),calories=asNumber(session.total_calories,session.calories),sport=sportFromFit(session.sport||session.sub_sport||data.sport),title=file.name.replace(/\.fit$/i,'');
  const avgSpeedKmh=movingMin&&distanceKm?Number((distanceKm/(movingMin/60)).toFixed(2)):null,paceMinKm=movingMin&&distanceKm?movingMin/distanceKm:null;
  return {name:title,date,movingMin,elapsedMin,distanceKm:distanceKm==null?null:Number(distanceKm.toFixed(2)),elevationM:elevationM==null?null:Math.round(elevationM),avgHr,maxHr,avgPower,normalizedPower,avgCadence,calories,sport,avgSpeedKmh,paceMinKm,source:'fit'};
}
function showMessage(box,text,type='ok'){box.textContent=text;box.style.marginTop='10px';box.style.color=type==='error'?'#ff8b91':'#8ee8b7'}
function paceText(value){if(!value||!Number.isFinite(value)) return null;let total=Math.round(value*60);const min=Math.floor(total/60),sec=total%60;return `${min}:${String(sec).padStart(2,'0')}/km`}
function durationText(value){if(!value||!Number.isFinite(value)) return '—';const total=Math.round(value*60),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`}
function summary(data,sport){const parts=[];if(data.distanceKm!=null) parts.push(`${data.distanceKm} km`);if(data.movingMin) parts.push(`${durationText(data.movingMin)} en movimiento`);if(data.elapsedMin&&Math.abs(data.elapsedMin-data.movingMin)>0.5) parts.push(`${durationText(data.elapsedMin)} total`);if(sport==='running'&&data.paceMinKm) parts.push(paceText(data.paceMinKm));else if(data.avgSpeedKmh) parts.push(`${data.avgSpeedKmh} km/h`);if(data.elevationM!=null) parts.push(`+${data.elevationM} m`);if(data.avgHr!=null) parts.push(`${Math.round(data.avgHr)} ppm`);if(data.avgPower!=null) parts.push(`${Math.round(data.avgPower)} W`);return parts.join(' · ')}
function decorateImporter(){
  const input=[...document.querySelectorAll('input[type="file"]')].find(el=>(el.getAttribute('accept')||'').includes('.gpx'));if(!input||input.dataset.mcpBound==='1') return;input.dataset.mcpBound='1';input.setAttribute('accept','.fit,.gpx,.tcx,.csv');
  const wrapper=document.createElement('div');wrapper.className='gpx-import-actions';wrapper.innerHTML='<div class="form-row" style="margin-top:12px"><select data-import-sport><option value="auto">Detectar deporte</option><option value="cycling">Bici</option><option value="running">Running</option><option value="boxing">Boxeo</option><option value="strength">Fuerza</option><option value="other">Otro</option></select><button type="button" class="primary" data-import-file disabled>Cargar archivo</button></div><p class="muted" data-import-file-label>No hay archivo seleccionado.</p><p class="muted">FIT: usa el deporte y tiempos de Garmin. GPX: calcula tiempo en movimiento separando pausas largas y estima el deporte por nombre/velocidad.</p><p data-import-msg></p>';input.insertAdjacentElement('afterend',wrapper);
  const button=wrapper.querySelector('[data-import-file]'),sport=wrapper.querySelector('[data-import-sport]'),fileLabel=wrapper.querySelector('[data-import-file-label]'),msg=wrapper.querySelector('[data-import-msg]');
  input.addEventListener('change',()=>{const file=input.files?.[0];fileLabel.textContent=file?`Seleccionado: ${file.name}`:'No hay archivo seleccionado.';button.disabled=!file;msg.textContent=''});
  button.addEventListener('click',async()=>{
    const file=input.files?.[0];if(!file) return;const isFit=/\.fit$/i.test(file.name),isGpx=/\.gpx$/i.test(file.name);if(!isFit&&!isGpx){showMessage(msg,'En esta versión la carga real está activa para FIT y GPX.','error');return}
    try{
      button.disabled=true;button.textContent=isFit?'Leyendo FIT…':'Leyendo GPX…';const data=isFit?await parseFit(file):parseGpx(await file.text(),file.name);const state=readState();if(!state) throw new Error('No se ha podido leer el estado local de MCP Core.');state.completed=Array.isArray(state.completed)?state.completed:[];
      const autoSport=isFit?(data.sport||'other'):(data.detectedSport||'other'),selectedSport=sport.value==='auto'?autoSport:sport.value;
      state.completed.unshift({id:crypto.randomUUID(),title:data.name,date:data.date,sport:selectedSport,duration:data.movingMin?Math.round(data.movingMin):0,actualDuration:data.movingMin?Number(data.movingMin.toFixed(2)):0,movingDurationMin:data.movingMin?Number(data.movingMin.toFixed(2)):null,elapsedDurationMin:data.elapsedMin?Number(data.elapsedMin.toFixed(2)):null,intensity:null,priority:'normal',source:data.source,completed:true,completedAt:new Date().toISOString(),rpe:null,distanceKm:data.distanceKm,elevationM:data.elevationM,avgHr:data.avgHr??null,maxHr:data.maxHr??null,avgPower:data.avgPower??null,normalizedPower:data.normalizedPower??null,avgCadence:data.avgCadence??null,calories:data.calories??null,avgSpeedKmh:data.avgSpeedKmh??null,paceMinKm:data.paceMinKm??null,sportDetection:isGpx?{confidence:data.detectionConfidence,reason:data.detectionReason}:null,importFileName:file.name});writeState(state);
      const detection=isGpx&&sport.value==='auto'?` · Deporte: ${selectedSport==='running'?'Running':selectedSport==='cycling'?'Bici':'Sin clasificar'} (${data.detectionReason})`:'';showMessage(msg,`${isFit?'FIT':'GPX'} cargado${summary(data,selectedSport)?`: ${summary(data,selectedSport)}`:''}${detection}. Recargando…`);setTimeout(()=>location.reload(),900);
    }catch(err){showMessage(msg,err?.message||'No se ha podido cargar el archivo.','error');button.disabled=false;button.textContent='Cargar archivo'}
  });
}
const observer=new MutationObserver(decorateImporter);observer.observe(document.documentElement,{childList:true,subtree:true});decorateImporter();
