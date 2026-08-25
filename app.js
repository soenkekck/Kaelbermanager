const STORAGE_KEY = 'kaelbermanager-config-v1';
const defaultConfig = { sheetId: '', apiUrl: '' };
const defaultPlan = [
  { amount: 5, ageFrom: 2, ageTo: 7 }, { amount: 6, ageFrom: 8, ageTo: 42 },
  { amount: 5, ageFrom: 43, ageTo: 49 }, { amount: 4.5, ageFrom: 50, ageTo: 56 },
  { amount: 4, ageFrom: 57, ageTo: 63 }, { amount: 3, ageFrom: 64, ageTo: 70 },
  { amount: 2.5, ageFrom: 71, ageTo: 77 }, { amount: 2, ageFrom: 78, ageTo: 84 }
];
const seed = [['276 1234 5678','2026-07-01',1],['276 1234 5681','2026-07-04',1],['276 1234 5684','2026-07-10',2],['276 1234 5689','2026-07-14',2],['276 1234 5692','2026-07-22',2],['276 1234 5698','2026-08-05',3],['276 1234 5701','2026-08-07',3],['276 1234 5707','2026-08-15',4],['276 1234 5710','2026-08-19',4],['276 1234 5714','2026-08-23',5]].map((x,i)=>({id:i+1,tag:x[0],birthDate:x[1],stable:x[2],stableSince:x[1],treatments:[]}));
let config = { ...defaultConfig, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {}) };
let data = { calves: seed, plan: structuredClone(defaultPlan), corrections: {}, taskDelayHours: 3 };
data.corrections ||= {}; data.taskDelayHours ??= 3; data.suggestions ||= { diagnosis: [], treatment: [] }; data.plan.forEach((r,i) => { r.ageFrom ??= defaultPlan[i]?.ageFrom ?? 1; r.ageTo ??= defaultPlan[i]?.ageTo ?? 9999; }); data.calves.forEach(c => { c.stableSince ||= c.birthDate; c.treatments ||= []; c.treatments.forEach(t => { if (t.diagnosis && !data.suggestions.diagnosis.includes(t.diagnosis)) data.suggestions.diagnosis.push(t.diagnosis); if (t.treatment && !data.suggestions.treatment.includes(t.treatment)) data.suggestions.treatment.push(t.treatment); }); });
let selectedStable = 1, selectedCalf = null, selectedTreatment = null, keypadTarget = null, keypadFresh = false, spinnerPointer = false; const now = new Date();
const key = d => d.toISOString().slice(0,10); const dateTimeKey = d => `${key(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
const date = v => { const [y,m,d] = v.split('-'); return `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${y}`; }; const dateTime = v => `${date(v.split('T')[0])} ${v.split('T')[1].slice(0,5)}`;
const days = birth => Math.max(0, Math.floor((new Date(`${key(now)}T12:00:00`) - new Date(`${birth}T12:00:00`)) / 86400000) + 1);
const age = birth => { const d=days(birth), w=Math.floor(d/7), r=d%7; return `${w} ${w===1?'Woche':'Wochen'}, ${r} ${r===1?'Tag':'Tage'}`; }; const litres = n => `${String(n).replace('.',',')} l`;
function ensureValidData(d) {
  return {
    calves: d.calves || seed,
    plan: d.plan || structuredClone(defaultPlan),
    corrections: d.corrections || {},
    taskDelayHours: d.taskDelayHours ?? 3,
    suggestions: d.suggestions || { diagnosis: [], treatment: [] }
  };
}

function milk(calf) { 
  if (!data || !data.plan) return 0;
  const row=data.plan.find(r=>days(calf.birthDate)>=Number(r.ageFrom)&&days(calf.birthDate)<=Number(r.ageTo)); 
  return row ? Number(row.amount) : 0; 
}
function updateConnectionStatus(success){ const led = document.getElementById('connectionLED'); if (led) { if (success) { led.classList.remove('disconnected'); led.classList.add('connected'); } else { led.classList.remove('connected'); led.classList.add('disconnected'); } } }
async function save(){ if (!config.apiUrl || !config.sheetId) { document.getElementById('lastSaved').textContent='Sheets-Verbindung fehlt'; updateConnectionStatus(false); return; } 
  data = ensureValidData(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  try { await fetch(config.apiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({sheetId:config.sheetId,data})}); document.getElementById('lastSaved').textContent='Gespeichert'; updateConnectionStatus(true); } catch(error) { document.getElementById('lastSaved').textContent='Speichern fehlgeschlagen'; updateConnectionStatus(false); } }
async function loadRemote(){ 
  if (!config.apiUrl || !config.sheetId) { updateConnectionStatus(false); return; } 
  try { 
    const response=await fetch(`${config.apiUrl}?sheetId=${encodeURIComponent(config.sheetId)}`); 
    const remote=await response.json(); 
    if(remote.data && remote.data.calves){
      data = ensureValidData(remote.data);
      renderOverview();
      document.getElementById('connectionStatus').textContent='Mit Google Sheets verbunden'; 
      updateConnectionStatus(true); 
    } else {
      console.warn("Received invalid remote data (missing calves)", remote);
      updateConnectionStatus(false);
    }
  } catch(error) { 
    document.getElementById('connectionStatus').textContent='Google Sheets konnte nicht geladen werden'; 
    updateConnectionStatus(false); 
  } 
}
function openStable(stable){selectedStable=stable;renderModal();document.getElementById('stableModal').classList.remove('hidden');}
function openTask(calfId,index){selectedCalf=data.calves.find(c=>c.id===calfId);selectedTreatment=index;const t=selectedCalf.treatments[index];document.getElementById('treatmentForm').reset();document.querySelector('[name="dateTime"]').value=dateTimeKey(new Date());document.querySelector('[name="diagnosis"]').value=t.diagnosis;document.querySelector('[name="treatment"]').value=t.treatment;document.querySelector(`[name="status"][value="${t.status||'repeat'}"]`).checked=true;document.getElementById('treatmentModal').classList.remove('hidden');}
function tasksForStable(){const cutoff=Date.now()-Number(data.taskDelayHours)*3600000;return data.calves.filter(c=>c.stable===selectedStable).flatMap(c=>(c.treatments||[]).map((t,i)=>({calf:c,treatment:t,index:i}))).filter(x=>(x.treatment.status==='repeat'||x.treatment.repeat)&&!x.treatment.taskDismissed&&(!x.treatment.createdAt||Date.parse(x.treatment.createdAt)<=cutoff));}
function renderOverview(){
  if (!data || !data.calves) {
    console.warn('renderOverview called with invalid data, skipping.');
    return;
  }
  let totalMilk=0,totalCalves=0,totalTasks=0;
  const grid=document.getElementById('stableGrid');
  grid.innerHTML='';
  for(let n=1;n<=5;n++){
    const cs=data.calves.filter(c=>c.stable===n),
          m=cs.reduce((s,c)=>s+milk(c),0)+Number(data.corrections[n]||0),
          tasks=tasksFor(n);
    totalMilk+=m;
    totalCalves+=cs.length;
    totalTasks+=tasks.length;
    grid.insertAdjacentHTML('beforeend',`<button class="stable-card" data-stable="${n}"><span class="stable-number">Stall ${String(n).padStart(2,'0')}</span><span class="stable-arrow">→</span><span class="calf-icon"></span><h3>Stall ${n}</h3><div class="stable-count"><strong>${cs.length}</strong><span>${cs.length===1?'Kalb':'Kälber'}</span></div><div class="stable-milk"><span>Milchmenge heute</span><strong>${litres(m)}</strong></div>${tasks.length?`<div class="treatment-badge">💉 ${tasks.length} Behandlung${tasks.length>1?'en':''} nötig</div>`:''}</button>`);
  }
  document.getElementById('overallMilk').textContent=litres(totalMilk);
  document.getElementById('overallCalves').textContent=`${totalCalves} Kälber · ${totalTasks} Behandlungen nötig`;
}
function tasksFor(stable){const cutoff=Date.now()-Number(data.taskDelayHours)*3600000;return data.calves.filter(c=>c.stable===stable).flatMap(c=>(c.treatments||[]).map((t,i)=>({calf:c,treatment:t,index:i}))).filter(x=>(x.treatment.status==='repeat'||x.treatment.repeat)&&!x.treatment.taskDismissed&&(!x.treatment.createdAt||Date.parse(x.treatment.createdAt)<=cutoff));}
function renderModal(){const cs=data.calves.filter(c=>c.stable===selectedStable),tasks=tasksFor(selectedStable),correction=Number(data.corrections[selectedStable]||0);document.getElementById('modalTitle').textContent=`Stall ${selectedStable}`;document.getElementById('modalCalves').textContent=cs.length;document.getElementById('modalMilk').textContent=litres(cs.reduce((s,c)=>s+milk(c),0)+correction);document.getElementById('milkCorrection').textContent=litres(correction);document.getElementById('modalTasks').innerHTML=tasks.map(x=>`<div class="task-item"><button class="task-button" data-task-id="${x.calf.id}" data-task-index="${x.index}"><strong>${x.treatment.treatment}</strong><span>${x.treatment.diagnosis}</span></button><button class="task-done" data-task-id="${x.calf.id}" data-task-index="${x.index}">✓</button><button class="task-delete" data-task-id="${x.calf.id}" data-task-index="${x.index}">🗑</button></div>`).join('');document.getElementById('calfList').innerHTML=cs.map(c=>`<div class="calf-row"><div class="calf-tag"><span class="calf-icon"></span>${c.tag}<small>Geboren: ${date(c.birthDate)}</small><small>Eingestallt: ${date(c.stableSince)}</small></div><div class="calf-age"><span>Alter</span>${age(c.birthDate)}</div><div class="calf-milk"><span>Milch</span>${litres(milk(c))}</div><div class="calf-actions"><button data-treatment="${c.id}">💉</button><button data-move="${c.id}">⇄</button><button data-remove="${c.id}">×</button></div>${c.treatments?.length?`<div class="treatments">${c.treatments.map(t=>`<div><strong>${dateTime(t.dateTime||`${t.date}T00:00`)}</strong><span>${t.treatment} · ${t.diagnosis}${t.status==='repeat'?' · Wiederholen':''}${t.status==='completed'?' · Abgeschlossen':''}</span></div>`).join('')}</div>`:''}</div>`).join('');document.querySelectorAll('[data-treatment]').forEach(b=>b.onclick=()=>newTreatment(Number(b.dataset.treatment)));document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>move(Number(b.dataset.move)));document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>remove(Number(b.dataset.remove)));document.querySelectorAll('.task-button,.task-done').forEach(b=>b.onclick=()=>openTask(Number(b.dataset.taskId),Number(b.dataset.taskIndex)));document.querySelectorAll('.task-delete').forEach(b=>b.onclick=()=>deleteTask(Number(b.dataset.taskId),Number(b.dataset.taskIndex)));}
function newTreatment(id){selectedCalf=data.calves.find(c=>c.id===id);selectedTreatment=null;document.getElementById('treatmentForm').reset();document.querySelector('[name="dateTime"]').value=dateTimeKey(new Date());document.getElementById('treatmentModal').classList.remove('hidden');}
function move(id){selectedCalf=data.calves.find(c=>c.id===id);document.getElementById('stableChoices').innerHTML=[1,2,3,4,5].filter(n=>n!==selectedCalf.stable).map(n=>`<button class="stable-choice" data-choice="${n}">Stall ${n}</button>`).join('');document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{selectedCalf.stable=Number(b.dataset.choice);selectedCalf.stableSince=key(now);save();close('moveModal');renderOverview();renderModal();});document.getElementById('moveModal').classList.remove('hidden');}
function remove(id){if(!confirm('Kalb wirklich ausstallen?'))return;data.calves=data.calves.filter(c=>c.id!==id);save();renderOverview();renderModal();}
function deleteTask(id,index){if(!confirm('Aufgabe löschen? Die Behandlungshistorie bleibt erhalten.'))return;data.calves.find(c=>c.id===id).treatments[index].taskDismissed=true;save();renderOverview();renderModal();}
function close(id){document.getElementById(id).classList.add('hidden');}
function openKeypad(input,title){keypadTarget=input;keypadFresh=true;input.select();document.getElementById('keypadTitle').textContent=title;document.getElementById('keypadDisplay').textContent=input.value||'0';document.getElementById('keypadKeys').innerHTML=['1','2','3','4','5','6','7','8','9','⌫','0',','].map(k=>`<button data-key="${k}">${k}</button>`).join('');document.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{let v=document.getElementById('keypadDisplay').textContent;const key=b.dataset.key;if(key==='⌫'){v=v.slice(0,-1);keypadFresh=false;}else if(keypadFresh){v=key;keypadFresh=false;}else{v=v==='0'?key:v+key;}document.getElementById('keypadDisplay').textContent=v});document.getElementById('keypadModal').classList.remove('hidden');}
function planText(r){return `Woche ${Math.ceil(r.ageFrom/7)}, Tag ${(r.ageFrom-1)%7+1} bis Woche ${Math.ceil(r.ageTo/7)}, Tag ${(r.ageTo-1)%7+1}`;}
function renderPlan(){
  if (!data.plan) data.plan = structuredClone(defaultPlan);
  document.getElementById('planBody').innerHTML=data.plan.map((r,i)=>`<tr><td><input class="plan-amount" data-plan="amount" data-index="${i}" type="number" min="0" step="0.5" value="${r.amount}"></td><td><input data-plan="ageFrom" data-index="${i}" type="number" min="1" value="${r.ageFrom}" ${i?'readonly':''}></td><td><input data-plan="ageTo" data-index="${i}" type="number" min="1" value="${r.ageTo}"></td><td><output class="range-output">${planText(r)}</output></td><td><button class="remove-plan" data-remove-plan="${i}">×</button></td></tr>`).join('');
  document.querySelectorAll('.plan-amount').forEach(x=>x.onfocus=()=>openKeypad(x,'L / KALB'));
  document.querySelectorAll('[data-plan="ageTo"]').forEach(x=>x.oninput=()=>{
    const i=Number(x.dataset.index);
    if(data.plan[i+1]) {
        data.plan[i+1].ageFrom=Number(x.value)+1;
        document.querySelectorAll('[data-plan="ageFrom"]')[i+1]?.setAttribute('value',Number(x.value)+1);
    }
    renderPlanLive();
  });
  document.querySelectorAll('[data-remove-plan]').forEach(x=>x.onclick=()=>{data.plan.splice(Number(x.dataset.removePlan),1);renderPlan();});
}
function renderPlanLive(){document.querySelectorAll('.range-output').forEach((x,i)=>x.textContent=planText(data.plan[i]));}
document.getElementById('currentDate').textContent=new Intl.DateTimeFormat('de-DE',{dateStyle:'full'}).format(now);document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));['overview','plan','settings'].forEach(v=>document.getElementById(`${v}View`).classList.toggle('hidden',t.dataset.view!==v));if(t.dataset.view==='plan')renderPlan();if(t.dataset.view==='settings')document.getElementById('taskDelayHours').value=data.taskDelayHours;});document.getElementById('closeModal').onclick=()=>close('stableModal');document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>close(b.dataset.close));document.getElementById('previousStable').onclick=()=>openStable(selectedStable===1?5:selectedStable-1);document.getElementById('nextStable').onclick=()=>openStable(selectedStable===5?1:selectedStable+1);
document.getElementById('calfForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);data.calves.push({id:Date.now(),tag:f.get('tag'),birthDate:f.get('birthDate'),stable:selectedStable,stableSince:key(now),treatments:[]});save();e.target.reset();renderOverview();renderModal();};document.querySelector('[name="tag"]').onfocus=e=>openKeypad(e.target,'Ohrmarkennummer');document.getElementById('treatmentForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),entry={dateTime:f.get('dateTime'),diagnosis:f.get('diagnosis'),treatment:f.get('treatment'),status:f.get('status'),createdAt:new Date().toISOString()};selectedCalf.treatments ||= [];if(selectedTreatment!==null)selectedCalf.treatments[selectedTreatment].taskDismissed=true;selectedCalf.treatments.push(entry);save();close('treatmentModal');renderOverview();renderModal();};
document.getElementById('savePlanButton').onclick=()=>{document.querySelectorAll('[data-plan]').forEach(x=>data.plan[Number(x.dataset.index)][x.dataset.plan]=Number(x.value)||x.value);save();renderOverview();};document.getElementById('saveSettingsButton').onclick=()=>{data.taskDelayHours=Number(document.getElementById('taskDelayHours').value)||0;save();renderOverview();};document.getElementById('keypadDone').onclick=()=>{keypadTarget.value=document.getElementById('keypadDisplay').textContent.replace(',','.');close('keypadModal')};document.getElementById('decreaseMilk').onclick=()=>adjustMilk(-1);document.getElementById('increaseMilk').onclick=()=>adjustMilk(1);function adjustMilk(n){data.corrections[selectedStable]=Number(data.corrections[selectedStable]||0)+n;save();renderOverview();renderModal();}document.getElementById('resetDataButton').onclick=()=>{data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||{calves:seed,plan:structuredClone(defaultPlan),corrections:{},taskDelayHours:3};data.corrections||={};renderOverview();};renderOverview();
function reloadStored(){
  const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
  if(stored){
    data = stored;
    data.calves = data.calves || seed;
    data.corrections ||= {};
    data.taskDelayHours ??= 3;
    data.calves.forEach(c=>{
      c.treatments ??= [];
      c.stableSince ??= c.birthDate;
    });
  }
}
document.getElementById('stableModal').addEventListener('click',event=>{if(event.target===event.currentTarget)close('stableModal')});document.getElementById('treatmentModal').addEventListener('click',event=>{if(event.target===event.currentTarget)close('treatmentModal')});document.getElementById('moveModal').addEventListener('click',event=>{if(event.target===event.currentTarget)close('moveModal')});document.getElementById('keypadModal').addEventListener('click',event=>{if(event.target===event.currentTarget)close('keypadModal')});
document.getElementById('stableGrid').addEventListener('click',event=>{const card=event.target.closest('.stable-card');if(card)openStable(Number(card.dataset.stable));});
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{if(tab.dataset.view!=='plan'){reloadStored();renderOverview();if(tab.dataset.view==='settings')document.getElementById('taskDelayHours').value=data.taskDelayHours;}}));
document.querySelectorAll('[data-plan="ageTo"]').forEach(input=>input.addEventListener('input',()=>{const index=Number(input.dataset.index);const next=document.querySelector(`[data-plan="ageFrom"][data-index="${index+1}"]`);if(next){next.value=Number(input.value)+1;data.plan[index+1].ageFrom=Number(input.value)+1;}renderPlanLive?.();}));
document.addEventListener('input',event=>{if(!event.target.matches('[data-plan="ageTo"]'))return;const index=Number(event.target.dataset.index);const next=document.querySelector(`[data-plan="ageFrom"][data-index="${index+1}"]`);if(next){next.value=Number(event.target.value)+1;data.plan[index+1].ageFrom=Number(event.target.value)+1;const row=next.closest('tr');row.querySelector('.range-output').textContent=planText(data.plan[index+1]);}});
function validatePlan(){let valid=true;data.plan.forEach((row,index)=>{const from=document.querySelector(`[data-plan="ageFrom"][data-index="${index}"]`);const to=document.querySelector(`[data-plan="ageTo"][data-index="${index}"]`);if(Number(row.ageTo)<Number(row.ageFrom)){to.setCustomValidity('Bis muss mindestens Von entsprechen');valid=false;}else{to.setCustomValidity('');}if(index>0&&Number(row.ageFrom)!==Number(data.plan[index-1].ageTo)+1){from.setCustomValidity(`Muss Tag ${Number(data.plan[index-1].ageTo)+1} sein`);valid=false;}else if(from){from.setCustomValidity('');}});return valid;}
document.getElementById('savePlanButton').onclick=()=>{if(!validatePlan()){document.querySelector(':invalid')?.reportValidity();return;}document.querySelectorAll('[data-plan]').forEach(x=>data.plan[Number(x.dataset.index)][x.dataset.plan]=Number(x.value)||x.value);save();renderOverview();};
function saveConfig(){config.sheetId=document.getElementById('sheetId').value.trim();config.apiUrl=document.getElementById('apiUrl').value.trim();localStorage.setItem(STORAGE_KEY,JSON.stringify(config));}
document.getElementById('saveSettingsButton').onclick=async()=>{saveConfig();data.taskDelayHours=Number(document.getElementById('taskDelayHours').value)||0;await save();await loadRemote();renderOverview();};document.getElementById('resetDataButton').onclick=async()=>{
  await loadRemote();
  renderOverview();
};document.getElementById('sheetId').value=config.sheetId;document.getElementById('apiUrl').value=config.apiUrl;loadRemote();
const originalRenderOverview = renderOverview;
renderOverview = function(){ originalRenderOverview(); let treatmentTotal=0; for(let stable=1;stable<=5;stable++) treatmentTotal += tasksFor(stable).length; document.getElementById('overallCalves').textContent=`${data.calves.length} Kälber`; document.getElementById('overallTreatments').textContent=`${treatmentTotal} Behandlungen`; };
const originalRenderModal = renderModal;
renderModal = function(){ originalRenderModal(); document.querySelectorAll('.task-item').forEach(item=>{const button=item.querySelector('.task-button');const calf=data.calves.find(c=>c.id===Number(button.dataset.taskId));const treatment=calf?.treatments?.[Number(button.dataset.taskIndex)];if(button&&calf&&treatment)button.innerHTML=`<strong>${calf.tag}</strong><span>${treatment.treatment}</span><span>${treatment.diagnosis}</span>`;});document.querySelectorAll('.treatments').forEach(history=>[...history.children].reverse().forEach(entry=>history.appendChild(entry))); };
document.addEventListener('pointerdown',event=>{const input=event.target.closest('input[type="number"]');spinnerPointer=Boolean(input&&event.clientX>input.getBoundingClientRect().right-32);});document.addEventListener('focusin',event=>{const input=event.target;if(!input.matches('input,textarea'))return;input.select();if(!input.readOnly&&!spinnerPointer&&(input.type==='number'||input.inputMode==='numeric'||input.inputMode==='decimal'))openKeypad(input,input.closest('label')?.textContent||'Zahl eingeben');spinnerPointer=false;});
setInterval(()=>{renderOverview();if(!document.getElementById('stableModal').classList.contains('hidden'))renderModal();},60000);
renderOverview();
function renderSuggestions(){[['diagnosis','diagnosisSuggestions'],['treatment','treatmentSuggestions']].forEach(([field,id])=>{const container=document.getElementById(id);if(!container)return;container.innerHTML=(data.suggestions?.[field]||[]).map((value,index)=>`<span class="suggestion"><button type="button" data-suggestion-field="${field}" data-suggestion-index="${index}">${value}</button><button type="button" title="Vorschlag löschen" data-delete-suggestion-field="${field}" data-delete-suggestion-index="${index}">×</button></span>`).join('');container.querySelectorAll('[data-suggestion-field]').forEach(button=>button.addEventListener('click',()=>{document.querySelector(`[name="${field}"]`).value=button.textContent;}));container.querySelectorAll('[data-delete-suggestion-field]').forEach(button=>button.addEventListener('click',()=>{data.suggestions[button.dataset.deleteSuggestionField].splice(Number(button.dataset.deleteSuggestionIndex),1);save();renderSuggestions();}));});}
const originalNewTreatment = newTreatment; newTreatment = function(id){originalNewTreatment(id);renderSuggestions();};
const originalOpenTask = openTask; openTask = function(id,index){originalOpenTask(id,index);renderSuggestions();};
document.getElementById('treatmentModal').addEventListener('click',event=>{if(event.target.matches('[name="diagnosis"],[name="treatment"]'))renderSuggestions();});
document.getElementById('treatmentForm').addEventListener('submit',event=>{const form=new FormData(event.currentTarget);data.suggestions ||= {diagnosis:[],treatment:[]};['diagnosis','treatment'].forEach(field=>{const value=String(form.get(field)||'').trim();if(value&&!data.suggestions[field].includes(value))data.suggestions[field].push(value);});save();});
document.addEventListener('input',event=>{if(!event.target.matches('[data-plan="ageTo"]'))return;const index=Number(event.target.dataset.index);data.plan[index].ageTo=Number(event.target.value);if(data.plan[index+1]){data.plan[index+1].ageFrom=Number(event.target.value)+1;const next=document.querySelector(`[data-plan="ageFrom"][data-index="${index+1}"]`);if(next)next.value=Number(event.target.value)+1;}renderPlanLive();});
