const SPORTS_KEY='mcp-core-v02';

function sportsRead(){
  try{return JSON.parse(localStorage.getItem(SPORTS_KEY)||'null')}catch{return null}
}
function sportsWrite(s){localStorage.setItem(SPORTS_KEY,JSON.stringify(s))}
function num(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null}
function watts(ftp,pct){return Math.round(ftp*pct/100)}
function hr(lthr,pct){return Math.round(lthr*pct/100)}
function escSports(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function profileMarkup(p={}){
  return `
    <div class="sports-profile-head">
      <span class="eyebrow">PERFIL DEPORTIVO</span>
      <p class="muted">Estos datos alimentan las recomendaciones de bici y nutrición. No hace falta incluir nombre, correo ni ningún identificador.</p>
    </div>
    <div class="sports-profile-grid">
      <label class="field"><span>Peso actual (kg)</span><input type="number" name="weightKg" min="35" max="200" step="0.1" value="${p.weightKg??''}" placeholder="Ej. 78.5"></label>
      <label class="field"><span>Peso objetivo (kg)</span><input type="number" name="targetWeightKg" min="35" max="200" step="0.1" value="${p.targetWeightKg??''}" placeholder="Ej. 75"></label>
      <label class="field"><span>Altura (cm)</span><input type="number" name="heightCm" min="130" max="220" step="1" value="${p.heightCm??''}" placeholder="Ej. 178"></label>
      <label class="field"><span>FTP bici (W)</span><input type="number" name="ftpW" min="80" max="600" step="1" value="${p.ftpW??''}" placeholder="Ej. 245"></label>
      <label class="field"><span>FC umbral bici (lpm)</span><input type="number" name="cyclingLthr" min="90" max="220" step="1" value="${p.cyclingLthr??''}" placeholder="Ej. 168"></label>
      <label class="field"><span>FC reposo (lpm)</span><input type="number" name="restingHr" min="30" max="120" step="1" value="${p.restingHr??''}" placeholder="Ej. 52"></label>
      <label class="field"><span>FC máxima (lpm)</span><input type="number" name="maxHr" min="120" max="230" step="1" value="${p.maxHr??''}" placeholder="Ej. 186"></label>
      <label class="field"><span>Potenciómetro habitual</span><select name="powerMeter"><option value="yes" ${p.powerMeter==='yes'?'selected':''}>Sí</option><option value="no" ${p.powerMeter==='no'?'selected':''}>No</option></select></label>
      <label class="field"><span>Objetivo principal</span><select name="primaryGoal"><option value="marathon" ${(p.primaryGoal||'marathon')==='marathon'?'selected':''}>Maratón · Garmin primero</option><option value="balanced" ${p.primaryGoal==='balanced'?'selected':''}>Running + bici equilibrado</option></select></label>
      <label class="field"><span>Fecha del maratón</span><input type="date" name="marathonDate" value="${escSports(p.marathonDate||'')}"></label>
      <label class="field"><span>Bici disponible/semana (h)</span><input type="number" name="cyclingHoursWeek" min="0" max="20" step="0.5" value="${p.cyclingHoursWeek??''}" placeholder="Ej. 4"></label>
    </div>
    <button class="secondary sports-save" type="submit">Guardar perfil deportivo</button>
    <p class="note sports-save-note">Peso → nutrición · FTP → vatios concretos · FC umbral → rango cardiaco orientativo.</p>`;
}

function zoneMarkup(p={}){
  const ftp=num(p.ftpW),lthr=num(p.cyclingLthr);
  if(!ftp&&!lthr)return '<p class="muted">Cuando guardes FTP o FC umbral, MCP Core calculará aquí tus referencias.</p>';
  const row=(name,p1,p2,h1,h2)=>`<div class="sports-zone"><b>${name}</b><span>${ftp?`${watts(ftp,p1)}–${watts(ftp,p2)} W`: '—'}</span><small>${lthr?`${hr(lthr,h1)}–${hr(lthr,h2)} lpm aprox.`:'FC pendiente'}</small></div>`;
  return `<div class="sports-zones">
    ${row('Recuperación',45,55,70,80)}
    ${row('Z2 aeróbica',56,75,80,88)}
    ${row('Tempo',76,87,88,92)}
    ${row('Sweet Spot',88,94,88,94)}
    ${row('Umbral',95,105,94,100)}
    ${row('VO₂max',106,120,100,106)}
  </div><p class="muted sports-zone-note">La FC es orientativa, sobre todo en intervalos cortos: para bici con potenciómetro mandan potencia + RPE.</p>`;
}

function enhanceProfileForm(){
  const form=document.querySelector('#profileForm');
  if(!form||form.dataset.sportsProfile==='1')return;
  const state=sportsRead()||{};const p=state.profile||{};
  form.dataset.sportsProfile='1';
  form.innerHTML=profileMarkup(p);
  const section=form.closest('.card');
  if(section){
    const h2=section.querySelector('h2');if(h2)h2.textContent='Perfil deportivo';
    let zones=section.querySelector('#sports-zones-card');
    if(!zones){zones=document.createElement('div');zones.id='sports-zones-card';zones.className='sports-zones-wrap';form.insertAdjacentElement('afterend',zones)}
    zones.innerHTML=`<h3>Referencias calculadas</h3>${zoneMarkup(p)}`;
  }
}

function concreteBikeTargets(){
  const state=sportsRead()||{};const p=state.profile||{};
  const ftp=num(p.ftpW),lthr=num(p.cyclingLthr);
  const featured=document.querySelector('section.featured');
  if(!featured||featured.textContent.includes('POST-ENTRENO'))return;
  const title=featured.querySelector('h2')?.textContent||'';
  const boxes=[...featured.querySelectorAll('.prescription>div')];
  const powerBox=boxes.find(x=>x.querySelector('span')?.textContent.trim()==='Potencia');
  const powerText=powerBox?.querySelector('b')?.textContent||'';
  const m=powerText.match(/(\d+)\s*[–-]\s*(\d+)%\s*FTP/i);
  if(powerBox&&m&&ftp){
    const low=watts(ftp,Number(m[1])),high=watts(ftp,Number(m[2]));
    powerBox.querySelector('b').innerHTML=`${low}–${high} W <small class="sports-subtarget">(${m[1]}–${m[2]}% FTP)</small>`;
  } else if(powerBox&&!ftp&&powerText.includes('% FTP')){
    powerBox.querySelector('b').innerHTML=`${powerText} <small class="sports-subtarget">· añade tu FTP para ver vatios</small>`;
  }
  if(lthr&&!featured.querySelector('[data-sports-hr]')){
    let lo=80,hi=88;
    if(/muy suave/i.test(title)){lo=75;hi=85}
    else if(/sweet spot/i.test(title)){lo=88;hi=94}
    const box=document.createElement('div');box.dataset.sportsHr='1';
    box.innerHTML=`<span>FC orientativa</span><b>${hr(lthr,lo)}–${hr(lthr,hi)} lpm</b>`;
    featured.querySelector('.prescription')?.appendChild(box);
  }
  if(p.powerMeter==='no'&&powerBox){
    const label=powerBox.querySelector('span');if(label)label.textContent='Referencia de potencia';
  }
}

function addProfileShortcut(){
  if(document.querySelector('#sports-profile-shortcut'))return;
  const hero=document.querySelector('.hero');if(!hero)return;
  const btn=document.createElement('button');btn.id='sports-profile-shortcut';btn.className='sports-profile-shortcut';btn.type='button';btn.textContent='⚙ Perfil deportivo';
  btn.onclick=()=>{
    const nav=document.querySelector('[data-nav="nutrition"]');
    if(nav){nav.click();setTimeout(()=>document.querySelector('#profileForm')?.scrollIntoView({behavior:'smooth',block:'start'}),80)}
  };
  hero.querySelector('div')?.appendChild(btn);
}

function injectSportsStyle(){
  if(document.querySelector('#sports-profile-style'))return;
  const style=document.createElement('style');style.id='sports-profile-style';style.textContent=`
    .sports-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}.sports-save{width:100%;margin-top:8px}.sports-save-note{margin-top:8px}.sports-zones-wrap{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}.sports-zones{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.sports-zone{display:grid;gap:4px;background:#0b1829;border:1px solid #1b2c43;border-radius:12px;padding:10px}.sports-zone span{font-weight:800;color:#eaf1fb}.sports-zone small,.sports-subtarget{display:block;color:var(--muted);font-size:.72rem;font-weight:600}.sports-zone-note{margin-top:10px}.sports-profile-shortcut{display:block;margin-top:9px;border:1px solid #31506e;background:#10253a;color:#9fdbf6;border-radius:999px;padding:6px 10px;font-size:.72rem;font-weight:800}.prescription:has([data-sports-hr]){grid-template-columns:repeat(4,1fr)}
    @media(max-width:540px){.sports-profile-grid,.sports-zones{grid-template-columns:1fr}.prescription:has([data-sports-hr]){grid-template-columns:1fr}.sports-profile-shortcut{font-size:.68rem}}
  `;document.head.appendChild(style);
}

function saveSportsProfile(form){
  const fd=new FormData(form),state=sportsRead()||{screen:'nutrition',checkins:{},planned:[],completed:[],nutrition:[]};
  state.profile={...(state.profile||{}),
    weightKg:num(fd.get('weightKg')),targetWeightKg:num(fd.get('targetWeightKg')),heightCm:num(fd.get('heightCm')),
    ftpW:num(fd.get('ftpW')),cyclingLthr:num(fd.get('cyclingLthr')),restingHr:num(fd.get('restingHr')),maxHr:num(fd.get('maxHr')),
    powerMeter:String(fd.get('powerMeter')||'yes'),primaryGoal:String(fd.get('primaryGoal')||'marathon'),
    marathonDate:String(fd.get('marathonDate')||''),cyclingHoursWeek:num(fd.get('cyclingHoursWeek'))
  };
  state.screen='nutrition';sportsWrite(state);
}

document.addEventListener('submit',e=>{
  const form=e.target;if(!(form instanceof HTMLFormElement)||form.id!=='profileForm'||form.dataset.sportsProfile!=='1')return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();saveSportsProfile(form);location.reload();
},true);

function decorateSports(){injectSportsStyle();enhanceProfileForm();concreteBikeTargets();addProfileShortcut()}
let sportsQueued=false;function queueSports(){if(sportsQueued)return;sportsQueued=true;requestAnimationFrame(()=>{sportsQueued=false;decorateSports()})}
new MutationObserver(queueSports).observe(document.documentElement,{childList:true,subtree:true});
queueSports();
