const STORAGE_KEY='mcp-core-v02';

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
  return {name,date,durationMin,distanceKm:Number(distanceKm.toFixed(2)),elevationM:Math.round(elevationM)};
}
function showMessage(box,text,type='ok'){
  box.textContent=text;
  box.style.marginTop='10px';
  box.style.color=type==='error'?'#ff8b91':'#8ee8b7';
}
function decorateImporter(){
  const input=[...document.querySelectorAll('input[type="file"]')].find(el=>(el.getAttribute('accept')||'').includes('.gpx'));
  if(!input||input.dataset.mcpBound==='1') return;
  input.dataset.mcpBound='1';
  const wrapper=document.createElement('div');
  wrapper.className='gpx-import-actions';
  wrapper.innerHTML='<div class="form-row" style="margin-top:12px"><select data-gpx-sport><option value="cycling">Bici</option><option value="running">Running</option><option value="other">Otro</option></select><button type="button" class="primary" data-import-gpx disabled>Cargar archivo</button></div><p class="muted" data-gpx-file>No hay archivo seleccionado.</p><p data-gpx-msg></p>';
  input.insertAdjacentElement('afterend',wrapper);
  const button=wrapper.querySelector('[data-import-gpx]');
  const sport=wrapper.querySelector('[data-gpx-sport]');
  const fileLabel=wrapper.querySelector('[data-gpx-file]');
  const msg=wrapper.querySelector('[data-gpx-msg]');
  input.addEventListener('change',()=>{
    const file=input.files?.[0];
    fileLabel.textContent=file?`Seleccionado: ${file.name}`:'No hay archivo seleccionado.';
    button.disabled=!file;
    msg.textContent='';
  });
  button.addEventListener('click',async()=>{
    const file=input.files?.[0];
    if(!file) return;
    if(!/\.gpx$/i.test(file.name)){
      showMessage(msg,'Ahora mismo la carga directa está activa para GPX. El parser FIT lo conectaremos después.','error');
      return;
    }
    try{
      button.disabled=true;button.textContent='Cargando…';
      const data=parseGpx(await file.text(),file.name);
      const state=readState();
      if(!state) throw new Error('No se ha podido leer el estado local de MCP Core.');
      state.completed=Array.isArray(state.completed)?state.completed:[];
      state.completed.unshift({
        id:crypto.randomUUID(),
        title:data.name,
        date:data.date,
        sport:sport.value,
        duration:data.durationMin||0,
        actualDuration:data.durationMin||0,
        intensity:'moderate',
        priority:'normal',
        source:'gpx',
        completed:true,
        completedAt:new Date().toISOString(),
        rpe:5,
        distanceKm:data.distanceKm,
        elevationM:data.elevationM,
        importFileName:file.name
      });
      writeState(state);
      showMessage(msg,`GPX cargado: ${data.distanceKm} km${data.durationMin?` · ${data.durationMin} min`:''} · +${data.elevationM} m. Recargando…`);
      setTimeout(()=>location.reload(),700);
    }catch(err){
      showMessage(msg,err?.message||'No se ha podido cargar el GPX.','error');
      button.disabled=false;button.textContent='Cargar archivo';
    }
  });
}

const observer=new MutationObserver(decorateImporter);
observer.observe(document.documentElement,{childList:true,subtree:true});
decorateImporter();
