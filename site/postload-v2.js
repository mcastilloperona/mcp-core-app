const MCP_KEY='mcp-core-v02';
function mcpState(){try{return JSON.parse(localStorage.getItem(MCP_KEY)||'null')}catch{return null}}
function mcpToday(){return new Date().toISOString().slice(0,10)}
function fmtDur(min){if(!Number.isFinite(min)||min<=0)return '—';const sec=Math.round(min*60),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`}
function fmtPace(minKm){if(!Number.isFinite(minKm)||minKm<=0)return '—';const sec=Math.round(minKm*60);return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}/km`}
function sportName(s){return s==='running'?'Running':s==='cycling'?'Bici':s==='boxing'?'Boxeo':s==='strength'?'Fuerza':'Otro'}
function applyPostLoad(){
  const state=mcpState();if(!state)return;
  const screen=document.querySelector('main.screen');if(!screen)return;
  const metrics=document.querySelector('.metrics');
  if(metrics){
    const first=metrics.children?.[0]?.querySelector('span');if(first)first.textContent='ESTADO AL EMPEZAR';
  }
  const status=document.querySelector('.hero .status small');if(status&&!status.dataset.mcpTagged){status.textContent=`${status.textContent} · check-in`;status.dataset.mcpTagged='1'}
  document.querySelector('#mcp-post-state')?.remove();
  const today=mcpToday(),done=(state.completed||[]).filter(x=>x.date===today);
  if(!done.length)return;
  const totalMin=done.reduce((s,x)=>s+(Number(x.movingDurationMin??x.actualDuration??x.duration)||0),0);
  const totalKm=done.reduce((s,x)=>s+(Number(x.distanceKm)||0),0);
  const run=done.filter(x=>x.sport==='running');
  const runMin=run.reduce((s,x)=>s+(Number(x.movingDurationMin??x.actualDuration??x.duration)||0),0);
  const runKm=run.reduce((s,x)=>s+(Number(x.distanceKm)||0),0);
  const primary=run[0]||done[0];
  let headline='Carga realizada registrada';
  let advice='La recomendación del resto del día debe partir de lo que ya has hecho, no solo del check-in de la mañana.';
  let level='Carga moderada';
  if(runMin>=70||runKm>=12){headline='Sesión de running relevante completada';level='Carga relevante';advice='No añadiría trabajo de calidad hoy. Si quieres soltar piernas, como máximo 20–30 min de bici muy suave y solo si te encuentras bien.'}
  else if(totalMin>=45){headline='Entrenamiento completado';level='Carga moderada';advice='Evitaría añadir otra sesión exigente. Prioriza recuperación y, si haces algo más, que sea suave.'}
  const card=document.createElement('section');card.id='mcp-post-state';card.className='card';
  const pace=primary?.sport==='running'&&Number(primary.paceMinKm)?`<div><span>Ritmo mov.</span><b>${fmtPace(Number(primary.paceMinKm))}</b></div>`:'';
  card.innerHTML=`<div class="card-title"><div><span class="eyebrow">DESPUÉS DE ENTRENAR</span><h2>${headline}</h2></div><span class="pill">${level}</span></div><div class="prescription"><div><span>Sesiones</span><b>${done.length}</b></div><div><span>Tiempo mov.</span><b>${fmtDur(totalMin)}</b></div><div><span>Distancia</span><b>${totalKm?totalKm.toFixed(2)+' km':'—'}</b></div>${pace}</div><p>${advice}</p><p class="muted">El score superior sigue siendo tu estado de inicio del día; no es una nota del entrenamiento realizado.</p>`;
  metrics?.insertAdjacentElement('afterend',card);
  if(metrics?.children?.[2]){const s=metrics.children[2].querySelector('span'),b=metrics.children[2].querySelector('b');if(s)s.textContent='CARGA REALIZADA';if(b)b.textContent=`${Math.round(totalMin)} min`}
  const featured=document.querySelector('section.featured');
  if(featured){featured.innerHTML=`<div class="card-title"><div><span class="eyebrow">RECOMENDACIÓN MCP CORE · POST-ENTRENO</span><h2>Resto del día</h2></div><span class="pill optional">AJUSTADO</span></div><p>${advice}</p><details><summary>¿Por qué ha cambiado?</summary><ul><li>Ya hay actividad realizada hoy.</li><li>MCP Core prioriza la carga real sobre la recomendación preentreno.</li><li>El check-in de la mañana se conserva como referencia histórica.</li></ul></details>`}
}
const postObserver=new MutationObserver(()=>requestAnimationFrame(applyPostLoad));postObserver.observe(document.documentElement,{childList:true,subtree:true});applyPostLoad();
