const DAY_KEY='mcp-core-v02';
const DAY_TODAY=new Date().toISOString().slice(0,10);
const UI_VERSION='v0.2.6';
let dayDecorating=false;

function dayRead(){try{return JSON.parse(localStorage.getItem(DAY_KEY)||'null')}catch{return null}}
function dayWrite(s){localStorage.setItem(DAY_KEY,JSON.stringify(s))}
function daySportLabel(s){return ({running:'Running',cycling:'Bici',boxing:'Boxeo',strength:'Fuerza',other:'Otro'})[s]||s||'Actividad'}
function minsToClock(mins){if(!Number.isFinite(mins))return '—';const h=Math.floor(mins/60),m=Math.round(mins%60);return h?`${h} h ${String(m).padStart(2,'0')} min`:`${m} min`}
function paceText(v){if(!Number.isFinite(v)||v<=0)return null;let m=Math.floor(v),s=Math.round((v-m)*60);if(s===60){m++;s=0}return `${m}:${String(s).padStart(2,'0')}/km`}
function addDays(d,n){const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)}
function todayDone(state){return (state?.completed||[]).filter(x=>x.date===DAY_TODAY)}
function todayPlan(state){return (state?.planned||[]).filter(x=>x.date===DAY_TODAY)}
function tomorrowPlan(state){return (state?.planned||[]).filter(x=>x.date===addDays(DAY_TODAY,1))}
function isKey(w){return w?.priority==='key'||['hard','very-hard'].includes(w?.intensity)}
function morningScore(state){const c=state?.checkins?.[DAY_TODAY];if(!c)return null;const maps={sleep:{great:5,good:4,regular:3,bad:1},body:{fresh:5,loaded:4,tired:2,fatigued:1},head:{clear:5,normal:4,saturated:2,exhausted:1},motivation:{high:5,normal:4,low:2,none:1},work:{low:5,normal:4,high:2,extreme:1}};const sc=(g,k)=>maps[g]?.[k]??3;let score=Math.round(((sc('sleep',c.sleep)+sc('body',c.body)+sc('head',c.head)+sc('motivation',c.motivation)+sc('work',c.work))/25)*100);if(c.pain==='localized')score-=12;if(c.illness)score-=28;return Math.max(0,Math.min(100,score))}
function loadScore(a){const mins=Number(a.movingDurationMin||a.actualDuration||a.duration||0);const rpe=Number(a.rpe);if(Number.isFinite(rpe)&&rpe>0)return Math.round(mins*rpe);if(a.sport==='running')return Math.round(mins*5.5);if(a.sport==='cycling')return Math.round(mins*4);if(a.sport==='boxing')return Math.round(mins*6);if(a.sport==='strength')return Math.round(mins*5);return Math.round(mins*4)}
function morningRecommendation(state){
 const score=morningScore(state),c=state?.checkins?.[DAY_TODAY],mins=Number(c?.available||60),plan=todayPlan(state),tom=tomorrowPlan(state);
 if(score!=null&&score<45)return{title:'Recuperación prioritaria',detail:'No añadir calidad; movilidad o descanso.',kind:'rest'};
 if(plan.some(w=>w.sport==='running'&&isKey(w))||tom.some(w=>w.sport==='running'&&isKey(w)))return{title:'Bici Z2 muy suave',detail:`Hasta ${Math.min(mins,45)} min · 55–65% FTP · RPE 2–3/10`,kind:'easy'};
 if(score!=null&&score>=75&&mins>=60)return{title:'Sweet Spot controlado',detail:`Hasta ${Math.min(mins,75)} min · 88–92% FTP · RPE 6–7/10`,kind:'quality'};
 return{title:'Resistencia aeróbica Z2',detail:`Hasta ${Math.min(mins,50)} min · 60–70% FTP · RPE 3–4/10`,kind:'easy'};
}
function currentDayState(state){
 const done=todayDone(state),initial=morningScore(state),totalLoad=done.reduce((s,a)=>s+loadScore(a),0),totalMins=done.reduce((s,a)=>s+Number(a.movingDurationMin||a.actualDuration||a.duration||0),0);
 const pc=state?.postCheckins?.[DAY_TODAY];let penalty=0;
 if(totalLoad>=600)penalty+=22;else if(totalLoad>=400)penalty+=16;else if(totalLoad>=250)penalty+=10;else if(totalLoad>=120)penalty+=5;
 if(pc?.feeling==='loaded')penalty+=6;if(pc?.feeling==='tired')penalty+=14;if(pc?.feeling==='exhausted')penalty+=22;
 if(pc?.energy==='low')penalty+=10;else if(pc?.energy==='normal')penalty+=3;if(pc?.pain==='yes')penalty+=18;
 const current=initial==null?null:Math.max(0,initial-penalty);
 let level='green',label='Carga asumible';
 if(totalLoad>=600||pc?.pain==='yes'||pc?.feeling==='exhausted'){level='red';label='Carga alta'}else if(totalLoad>=300||pc?.feeling==='tired'||pc?.energy==='low'){level='amber';label='Carga relevante'}
 return{done,initial,current,totalLoad,totalMins,level,label,pc};
}
function currentRecommendation(state,x){
 const remaining=todayPlan(state),tom=tomorrowPlan(state),tomorrowKey=tom.find(isKey);
 if(x.pc?.pain==='yes')return{title:'Cerrar carga hoy',detail:'Movilidad suave o descanso. No añadir otra sesión.',kind:'rest'};
 if(x.totalLoad>=600||x.pc?.feeling==='exhausted')return{title:'Recuperar el resto del día',detail:'No añadiría otra sesión. Prioriza comida, hidratación y descanso.',kind:'rest'};
 if(x.totalLoad>=300||x.pc?.feeling==='tired'||x.pc?.energy==='low')return{title:'Solo recuperación suave',detail:'Si necesitas moverte: 20–30 min muy suaves o movilidad. Nada de intensidad.',kind:'recovery'};
 if(tomorrowKey)return{title:'Proteger la sesión de mañana',detail:'Si haces algo más hoy, que sea muy suave y corto.',kind:'recovery'};
 const pendingKey=remaining.find(isKey);
 if(pendingKey)return{title:`Valorar ${pendingKey.title||'la sesión clave pendiente'}`,detail:'Solo si el mini check-in postentreno es bueno y ha habido recuperación suficiente entre sesiones.',kind:'conditional'};
 return{title:'Segunda sesión opcional',detail:'Puede caber una sesión suave si te encuentras bien; no es necesaria para completar el día.',kind:'easy'};
}
function activityLine(a){const bits=[daySportLabel(a.sport)];if(a.distanceKm)bits.push(`${Number(a.distanceKm).toFixed(2)} km`);const mov=Number(a.movingDurationMin||a.actualDuration||a.duration||0);if(mov)bits.push(minsToClock(mov));if(a.sport==='running'&&a.paceMinKm)bits.push(paceText(Number(a.paceMinKm)));return bits.join(' · ')}
function changeReasons(state,x,before,now){
 const reasons=[];
 if(x.done.length)reasons.push(`Has completado ${x.done.length===1?'1 actividad':x.done.length+' actividades'} y acumulas ${Math.round(x.totalMins)} min de ejercicio hoy.`);
 if(x.totalLoad)reasons.push(`La carga estimada acumulada es ${x.totalLoad} puntos MCP${x.done.some(a=>!a.rpe)?' (estimada porque falta RPE en alguna actividad)':''}.`);
 const run=x.done.find(a=>a.sport==='running');if(run){const mov=Number(run.movingDurationMin||run.actualDuration||run.duration||0);const dist=Number(run.distanceKm||0);reasons.push(`La carrera realizada${dist?` suma ${dist.toFixed(2)} km`:''}${mov?` y ${Math.round(mov)} min efectivos`:''}, por lo que ya existe una carga relevante sobre piernas.`)}
 if(x.pc?.feeling==='loaded')reasons.push('En el postentreno has indicado que estás cargado.');
 if(x.pc?.feeling==='tired')reasons.push('En el postentreno has indicado fatiga alta.');
 if(x.pc?.feeling==='exhausted')reasons.push('En el postentreno has indicado que has quedado vacío.');
 if(x.pc?.energy==='low')reasons.push('Tu energía actual es baja.');
 if(x.pc?.pain==='yes')reasons.push('Has indicado una molestia nueva, por lo que se reduce la carga recomendada.');
 const tomorrowKey=tomorrowPlan(state).find(isKey);if(tomorrowKey)reasons.push(`Mañana hay una sesión clave (${tomorrowKey.title||'sesión clave'}), así que conviene protegerla.`);
 if(!x.pc)reasons.push('Todavía no has hecho el mini check-in postentreno; la decisión actual se basa en la carga registrada y es provisional.');
 if(before.title===now.title)reasons.push('La recomendación principal no cambia, pero ahora está condicionada por la carga ya realizada.');
 return reasons;
}
function buildCard(){
 const state=dayRead();if(!state)return null;const x=currentDayState(state);if(!x.done.length)return null;const before=morningRecommendation(state),now=currentRecommendation(state,x),reasons=changeReasons(state,x,before,now);
 const wrap=document.createElement('section');wrap.className='card';wrap.id='mcp-evolving-day';
 wrap.innerHTML=`<div class="card-title"><div><span class="eyebrow">MCP CORE · DECISIÓN ACTUAL</span><h2>Qué ha pasado hoy y qué hago ahora</h2></div><span class="pill ${x.level}">${x.label}</span></div>
 <div style="display:grid;gap:10px;margin:14px 0"><div style="padding:12px;border:1px solid rgba(255,255,255,.10);border-radius:12px"><span class="eyebrow">1 · CÓMO EMPEZASTE</span><p style="margin:6px 0 0"><b>${x.initial==null?'Sin check-in inicial':x.initial+'/100 · estado inicial'}</b></p></div>
 <div style="padding:12px;border:1px solid rgba(255,255,255,.10);border-radius:12px"><span class="eyebrow">2 · QUÉ HAS HECHO</span>${x.done.map(a=>`<p style="margin:6px 0">✓ <b>${activityLine(a)}</b></p>`).join('')}</div>
 <div style="padding:12px;border:1px solid rgba(255,255,255,.10);border-radius:12px"><span class="eyebrow">3 · QUÉ HA CAMBIADO</span><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><div><small class="muted">ANTES</small><p style="margin:4px 0"><b>${before.title}</b></p><small>${before.detail}</small></div><div><small class="muted">AHORA</small><p style="margin:4px 0"><b>${now.title}</b></p><small>${now.detail}</small></div></div></div>
 <details style="padding:12px;border:1px solid rgba(255,255,255,.10);border-radius:12px"><summary><b>4 · ¿Por qué ha cambiado?</b></summary><ul style="margin-bottom:0">${reasons.map(r=>`<li>${r}</li>`).join('')}</ul></details>
 <div style="padding:14px;border:1px solid rgba(99,209,255,.35);border-radius:12px"><span class="eyebrow">5 · QUÉ HACER AHORA</span><h3 style="margin:6px 0">${now.title}</h3><p style="margin:0">${now.detail}</p></div>
 ${tomorrowPlan(state).length?`<div style="padding:12px;border:1px solid rgba(255,255,255,.10);border-radius:12px"><span class="eyebrow">6 · MAÑANA</span>${tomorrowPlan(state).slice(0,2).map(w=>`<p style="margin:6px 0"><b>${w.title||daySportLabel(w.sport)}</b> · ${daySportLabel(w.sport)} · ${w.duration||'—'} min${isKey(w)?' · CLAVE':''}</p>`).join('')}</div>`:''}</div>
 <details ${x.pc?'':'open'}><summary>${x.pc?'Actualizar':'Completar'} mini check-in postentreno</summary><form id="postWorkoutCheck" style="margin-top:12px">
 <p><b>¿Cómo te ha dejado la última sesión?</b></p><div class="choices"><button type="button" class="choice" data-pc="feeling" data-value="good">Bien</button><button type="button" class="choice" data-pc="feeling" data-value="loaded">Cargado</button><button type="button" class="choice" data-pc="feeling" data-value="tired">Muy cansado</button><button type="button" class="choice" data-pc="feeling" data-value="exhausted">Vacío</button></div>
 <p><b>¿Cómo estás de energía ahora?</b></p><div class="choices"><button type="button" class="choice" data-pc="energy" data-value="high">Alta</button><button type="button" class="choice" data-pc="energy" data-value="normal">Normal</button><button type="button" class="choice" data-pc="energy" data-value="low">Baja</button></div>
 <p><b>¿Alguna molestia nueva?</b></p><div class="choices"><button type="button" class="choice" data-pc="pain" data-value="no">No</button><button type="button" class="choice" data-pc="pain" data-value="yes">Sí</button></div><button class="secondary" style="margin-top:12px">Recalcular ahora</button></form></details>`;
 return wrap;
}
function bindPost(card){const state=dayRead(),existing=state?.postCheckins?.[DAY_TODAY]||{},sel={...existing};card.querySelectorAll('[data-pc]').forEach(b=>{const k=b.dataset.pc;if(sel[k]===b.dataset.value)b.classList.add('selected');b.onclick=()=>{sel[k]=b.dataset.value;card.querySelectorAll(`[data-pc="${k}"]`).forEach(x=>x.classList.toggle('selected',x===b))}});const f=card.querySelector('#postWorkoutCheck');if(f)f.onsubmit=e=>{e.preventDefault();const s=dayRead();s.postCheckins=s.postCheckins||{};s.postCheckins[DAY_TODAY]={feeling:sel.feeling||'good',energy:sel.energy||'normal',pain:sel.pain||'no',updatedAt:new Date().toISOString()};dayWrite(s);document.querySelector('#mcp-evolving-day')?.remove();queueMicrotask(decorateDay)}}
function patchVersion(){document.title=`MCP Core · ${UI_VERSION}`;const badge=[...document.body.children].find(el=>el.textContent?.trim().startsWith('Versión '));if(badge)badge.textContent=`Versión ${UI_VERSION.replace(/^v/,'')}`;document.querySelectorAll('.brand').forEach(el=>{el.textContent=el.textContent.replace(/v0\.2(?:\.\d+)?/g,UI_VERSION)});document.querySelectorAll('.note').forEach(el=>{el.innerHTML=el.innerHTML.replace(/v0\.2(?:\.\d+)?/g,UI_VERSION)})}
function relabelMorning(){const header=document.querySelector('.hero .status small');if(header&&header.textContent.includes('/100')&&!header.parentElement.querySelector('[data-initial-label]'))header.insertAdjacentHTML('beforebegin','<span data-initial-label style="display:block;font-size:10px;opacity:.72">ESTADO INICIAL</span>');const metric=[...document.querySelectorAll('.metrics span')].find(x=>x.textContent.trim()==='RECUPERACIÓN');if(metric)metric.textContent='ESTADO AL EMPEZAR'}
function decorateDay(){if(dayDecorating)return;dayDecorating=true;try{patchVersion();const main=document.querySelector('main.screen');if(!main)return;relabelMorning();const featured=[...main.querySelectorAll('section.card')].find(s=>s.querySelector('.eyebrow')?.textContent.includes('RECOMENDACIÓN MCP CORE'));const hasDone=todayDone(dayRead()||{}).length>0;if(featured)featured.style.display=hasDone?'none':'';if(document.querySelector('#mcp-evolving-day'))return;if(!featured||!hasDone)return;const card=buildCard();if(!card)return;featured.insertAdjacentElement('beforebegin',card);bindPost(card)}finally{dayDecorating=false}}
let dayTimer=null;const dayObs=new MutationObserver(()=>{clearTimeout(dayTimer);dayTimer=setTimeout(decorateDay,30)});dayObs.observe(document.documentElement,{childList:true,subtree:true});decorateDay();
