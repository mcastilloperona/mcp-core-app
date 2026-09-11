const DAY_KEY='mcp-core-v02';
const DAY_TODAY=new Date().toISOString().slice(0,10);
const UI_VERSION='v0.2.5';
let dayDecorating=false;

function dayRead(){try{return JSON.parse(localStorage.getItem(DAY_KEY)||'null')}catch{return null}}
function dayWrite(s){localStorage.setItem(DAY_KEY,JSON.stringify(s))}
function daySportLabel(s){return ({running:'Running',cycling:'Bici',boxing:'Boxeo',strength:'Fuerza',other:'Otro'})[s]||s||'Actividad'}
function minsToClock(mins){if(!Number.isFinite(mins))return '—';const h=Math.floor(mins/60),m=Math.round(mins%60);return h?`${h} h ${String(m).padStart(2,'0')} min`:`${m} min`}
function paceText(v){if(!Number.isFinite(v)||v<=0)return null;let m=Math.floor(v),s=Math.round((v-m)*60);if(s===60){m++;s=0}return `${m}:${String(s).padStart(2,'0')}/km`}
function todayDone(state){return (state?.completed||[]).filter(x=>x.date===DAY_TODAY)}
function morningScore(state){const c=state?.checkins?.[DAY_TODAY];if(!c)return null;const maps={sleep:{great:5,good:4,regular:3,bad:1},body:{fresh:5,loaded:4,tired:2,fatigued:1},head:{clear:5,normal:4,saturated:2,exhausted:1},motivation:{high:5,normal:4,low:2,none:1},work:{low:5,normal:4,high:2,extreme:1}};const sc=(g,k)=>maps[g]?.[k]??3;let score=Math.round(((sc('sleep',c.sleep)+sc('body',c.body)+sc('head',c.head)+sc('motivation',c.motivation)+sc('work',c.work))/25)*100);if(c.pain==='localized')score-=12;if(c.illness)score-=28;return Math.max(0,Math.min(100,score))}
function loadScore(a){const mins=Number(a.movingDurationMin||a.actualDuration||a.duration||0);const rpe=Number(a.rpe);if(Number.isFinite(rpe)&&rpe>0)return Math.round(mins*rpe);if(a.sport==='running')return Math.round(mins*5.5);if(a.sport==='cycling')return Math.round(mins*4);if(a.sport==='boxing')return Math.round(mins*6);if(a.sport==='strength')return Math.round(mins*5);return Math.round(mins*4)}
function currentDayState(state){
 const done=todayDone(state),initial=morningScore(state),totalLoad=done.reduce((s,a)=>s+loadScore(a),0),totalMins=done.reduce((s,a)=>s+Number(a.movingDurationMin||a.actualDuration||a.duration||0),0);
 const pc=state?.postCheckins?.[DAY_TODAY];let penalty=0;
 if(totalLoad>=600)penalty+=22;else if(totalLoad>=400)penalty+=16;else if(totalLoad>=250)penalty+=10;else if(totalLoad>=120)penalty+=5;
 if(pc?.feeling==='loaded')penalty+=6;if(pc?.feeling==='tired')penalty+=14;if(pc?.feeling==='exhausted')penalty+=22;
 if(pc?.energy==='low')penalty+=10;else if(pc?.energy==='normal')penalty+=3;
 if(pc?.pain==='yes')penalty+=18;
 const current=initial==null?null:Math.max(0,initial-penalty);
 let level='green',label='Carga controlada',advice='Puedes seguir con el plan previsto si las sensaciones son buenas.';
 if(done.length===0){label='Sin carga registrada';advice='Aún no hay actividad realizada hoy.'}
 else if(totalLoad>=600||pc?.pain==='yes'||pc?.feeling==='exhausted'){level='red';label='Carga alta';advice='No añadiría otra sesión de calidad hoy. Prioriza recuperación, movilidad o descanso.'}
 else if(totalLoad>=300||pc?.feeling==='tired'||pc?.energy==='low'){level='amber';label='Carga relevante';advice='Si haces una segunda sesión, que sea suave y con un objetivo claro. Evitaría intensidad.'}
 else {label='Carga asumible';advice='Puede caber una segunda sesión, pero debe decidirse según lo planificado y cómo te encuentres ahora.'}
 return {done,initial,current,totalLoad,totalMins,level,label,advice,pc};
}
function activityLine(a){const bits=[daySportLabel(a.sport)];if(a.distanceKm)bits.push(`${Number(a.distanceKm).toFixed(2)} km`);const mov=Number(a.movingDurationMin||a.actualDuration||a.duration||0);if(mov)bits.push(minsToClock(mov));if(a.sport==='running'&&a.paceMinKm)bits.push(paceText(Number(a.paceMinKm)));return bits.join(' · ')}
function buildCard(){
 const state=dayRead();if(!state)return null;const x=currentDayState(state);if(!x.done.length)return null;
 const wrap=document.createElement('section');wrap.className='card';wrap.id='mcp-evolving-day';
 wrap.innerHTML=`<div class="card-title"><div><span class="eyebrow">ESTADO ACTUAL DEL DÍA</span><h2>El día sigue abierto</h2></div><span class="pill ${x.level}">${x.label}</span></div>
 <div class="metrics big"><div><span>ESTADO INICIAL</span><b>${x.initial==null?'—':x.initial+'/100'}</b></div><div><span>CARGA HECHA</span><b>${Math.round(x.totalMins)} min</b></div><div><span>ESTADO ACTUAL</span><b>${x.current==null?'—':x.current+'/100'}</b></div></div>
 <div>${x.done.map(a=>`<p class="muted">✓ ${activityLine(a)}</p>`).join('')}</div>
 <p><b>Qué haría ahora:</b> ${x.advice}</p>
 <p class="muted">El estado actual es una estimación MCP basada en el check-in inicial, la carga acumulada y, si lo completas, el mini check-in postentreno.</p>
 <details ${x.pc?'':'open'}><summary>${x.pc?'Actualizar':'Hacer'} mini check-in postentreno</summary>
 <form id="postWorkoutCheck" style="margin-top:12px">
  <p><b>¿Cómo te ha dejado la última sesión?</b></p><div class="choices"><button type="button" class="choice" data-pc="feeling" data-value="good">Bien</button><button type="button" class="choice" data-pc="feeling" data-value="loaded">Cargado</button><button type="button" class="choice" data-pc="feeling" data-value="tired">Muy cansado</button><button type="button" class="choice" data-pc="feeling" data-value="exhausted">Vacío</button></div>
  <p><b>¿Cómo estás de energía ahora?</b></p><div class="choices"><button type="button" class="choice" data-pc="energy" data-value="high">Alta</button><button type="button" class="choice" data-pc="energy" data-value="normal">Normal</button><button type="button" class="choice" data-pc="energy" data-value="low">Baja</button></div>
  <p><b>¿Alguna molestia nueva?</b></p><div class="choices"><button type="button" class="choice" data-pc="pain" data-value="no">No</button><button type="button" class="choice" data-pc="pain" data-value="yes">Sí</button></div>
  <button class="secondary" style="margin-top:12px">Actualizar estado actual</button>
 </form></details>`;
 return wrap;
}
function bindPost(card){
 const state=dayRead(),existing=state?.postCheckins?.[DAY_TODAY]||{},sel={...existing};
 card.querySelectorAll('[data-pc]').forEach(b=>{const k=b.dataset.pc;if(sel[k]===b.dataset.value)b.classList.add('selected');b.onclick=()=>{sel[k]=b.dataset.value;card.querySelectorAll(`[data-pc="${k}"]`).forEach(x=>x.classList.toggle('selected',x===b))}});
 const f=card.querySelector('#postWorkoutCheck');if(f)f.onsubmit=e=>{e.preventDefault();const s=dayRead();s.postCheckins=s.postCheckins||{};s.postCheckins[DAY_TODAY]={feeling:sel.feeling||'good',energy:sel.energy||'normal',pain:sel.pain||'no',updatedAt:new Date().toISOString()};dayWrite(s);const old=document.querySelector('#mcp-evolving-day');if(old)old.remove();queueMicrotask(decorateDay)};
}
function patchVersion(){
 document.title=`MCP Core · ${UI_VERSION}`;
 const badge=[...document.body.children].find(el=>el.textContent?.trim().startsWith('Versión '));if(badge)badge.textContent=`Versión ${UI_VERSION.replace(/^v/,'')}`;
 document.querySelectorAll('.brand').forEach(el=>{el.textContent=el.textContent.replace(/v0\.2(?:\.\d+)?/g,UI_VERSION)});
 document.querySelectorAll('.note').forEach(el=>{el.innerHTML=el.innerHTML.replace(/v0\.2(?:\.\d+)?/g,UI_VERSION)});
}
function relabelMorning(){
 const header=document.querySelector('.hero .status small');
 if(header&&header.textContent.includes('/100')&&!header.parentElement.querySelector('[data-initial-label]'))header.insertAdjacentHTML('beforebegin','<span data-initial-label style="display:block;font-size:10px;opacity:.72">ESTADO INICIAL</span>');
 const metric=[...document.querySelectorAll('.metrics span')].find(x=>x.textContent.trim()==='RECUPERACIÓN');if(metric)metric.textContent='ESTADO AL EMPEZAR';
}
function decorateDay(){
 if(dayDecorating)return;dayDecorating=true;
 try{
  patchVersion();
  const main=document.querySelector('main.screen');if(!main)return;
  relabelMorning();
  if(document.querySelector('#mcp-evolving-day'))return;
  const featured=[...main.querySelectorAll('section.card')].find(s=>s.querySelector('.eyebrow')?.textContent.includes('RECOMENDACIÓN MCP CORE'));
  if(!featured)return;
  const card=buildCard();if(!card)return;
  featured.insertAdjacentElement('beforebegin',card);bindPost(card);
 } finally {dayDecorating=false}
}
let dayTimer=null;
const dayObs=new MutationObserver(()=>{clearTimeout(dayTimer);dayTimer=setTimeout(decorateDay,30)});
dayObs.observe(document.documentElement,{childList:true,subtree:true});
decorateDay();
