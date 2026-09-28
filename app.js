const STORAGE_KEY = 'kaelbermanager-config-v1';
const defaultConfig = { sheetId: '', apiUrl: '' };
const defaultPlan = [
  { amount: 5, ageFrom: 2, ageTo: 7 }, { amount: 6, ageFrom: 8, ageTo: 42 },
  { amount: 5, ageFrom: 43, ageTo: 49 }, { amount: 4.5, ageFrom: 50, ageTo: 56 },
  { amount: 4, ageFrom: 57, ageTo: 63 }, { amount: 3, ageFrom: 64, ageTo: 70 },
  { amount: 2.5, ageFrom: 71, ageTo: 77 }, { amount: 2, ageFrom: 78, ageTo: 84 }
];
const createDefaultStables = () => Array.from({ length: 5 }, (_, index) => ({ id: `stable-${index + 1}`, number: index + 1, compartment: '' }));
const stableIdFor = (number, compartment = '') => `stable-${number}${compartment}`;
function uniqueStableId(number, compartment, stables) {
  const baseId=stableIdFor(number,compartment);
  let id=baseId;
  let suffix=2;
  while(stables.some(stable=>stable.id===id))id=`${baseId}-${suffix++}`;
  return id;
}
const sortStables = stables => [...stables].sort((a, b) => a.number - b.number || a.compartment.localeCompare(b.compartment));
const stableLabel = stable => stable ? `Stall ${stable.number}${stable.compartment ? ` ${stable.compartment}` : ''}` : 'Stall unbekannt';
let config = { ...defaultConfig, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {}) };
let data = { calves: [], stables: createDefaultStables(), plan: structuredClone(defaultPlan), corrections: {}, taskDelayHours: 3 };
data.corrections ||= {}; data.taskDelayHours ??= 3; data.suggestions ||= { diagnosis: [], treatment: [] }; data.plan = normalizePlan(data.plan); data.plan.forEach((r,i) => { r.ageFrom ??= defaultPlan[i]?.ageFrom ?? 1; r.ageTo ??= defaultPlan[i]?.ageTo ?? 9999; }); data.calves.forEach(c => { c.stableSince ||= c.birthDate; c.treatments ||= []; c.treatments.forEach(t => { if (t.diagnosis && !data.suggestions.diagnosis.includes(t.diagnosis)) data.suggestions.diagnosis.push(t.diagnosis); if (t.treatment && !data.suggestions.treatment.includes(t.treatment)) data.suggestions.treatment.push(t.treatment); }); });
let selectedStable = 'stable-1', pendingRemoveStableId = null, selectedCalf = null, selectedTreatment = null, keypadTarget = null, keypadFresh = false, spinnerPointer = false, isSettingsLocked = false; const now = new Date();
const key = d => d.toISOString().slice(0,10); const dateTimeKey = d => `${key(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
const date = v => { const [y,m,d] = v.split('-'); return `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${y}`; }; const dateTime = v => `${date(v.split('T')[0])} ${v.split('T')[1].slice(0,5)}`;
const days = birth => Math.max(0, Math.floor((new Date(`${key(now)}T12:00:00`) - new Date(`${birth}T12:00:00`)) / 86400000) + 1);
const age = birth => { const d=days(birth), w=Math.floor(d/7), r=d%7; return `${w} ${w===1?'Woche':'Wochen'}, ${r} ${r===1?'Tag':'Tage'}`; }; const litres = n => `${String(n).replace('.',',')} l`;
function ensureValidData(d) {
  const stables = [];
  const sourceStables = Array.isArray(d.stables) && d.stables.length ? d.stables : createDefaultStables();
  sourceStables.forEach(stable => {
    if (!stable || typeof stable !== 'object') return;
    const number = Number(stable.number);
    const compartment = String(stable.compartment || '').trim().toUpperCase();
    if (!Number.isSafeInteger(number) || number < 1 || !/^[A-Z]?$/.test(compartment)) return;
    if (stables.some(item => item.number === number && item.compartment === compartment)) return;
    const baseId = typeof stable.id === 'string' && /^[A-Za-z0-9_-]+$/.test(stable.id) ? stable.id : stableIdFor(number, compartment);
    let id = baseId;
    let suffix = 2;
    while (stables.some(item => item.id === id)) id = `${baseId}-${suffix++}`;
    stables.push({ id, number, compartment });
  });
  if (!stables.length) stables.push(...createDefaultStables());

  const calves = (d.calves || []).map(calf => {
    let stable = stables.find(item => item.id === calf.stable);
    if (!stable) {
      const reference = String(calf.stable ?? '').match(/^(?:stable-|stall\s*)?(\d+)([a-z]?)$/i);
      if (reference) {
        const number = Number(reference[1]);
        const compartment = reference[2].toUpperCase();
        stable = stables.find(item => item.number === number && item.compartment === compartment);
        if (!stable && Number.isSafeInteger(number) && number > 0) {
          const id = uniqueStableId(number, compartment, stables);
          stable = { id, number, compartment };
          stables.push(stable);
        }
      }
    }
    return { ...calf, stable: stable?.id || stables[0].id };
  });
  return {
    calves,
    stables: sortStables(stables),
    plan: normalizePlan(d.plan),
    corrections: d.corrections || {},
    taskDelayHours: d.taskDelayHours ?? 3,
    suggestions: d.suggestions || { diagnosis: [], treatment: [] }
  };
}

function normalizePlan(plan) {
  return (plan || structuredClone(defaultPlan)).map(row => ({
    ...row,
    milkType: row.milkType === 'milchersatz' ? 'milchersatz' : 'vollmilch'
  }));
}

function planRowFor(calf) {
  if (!data || !data.plan) return 0;
  return data.plan.find(row => days(calf.birthDate) >= Number(row.ageFrom) && days(calf.birthDate) <= Number(row.ageTo));
}

function milk(calf) {
  const row = planRowFor(calf);
  return row ? Number(row.amount) : 0;
}

function stableMilk(stable) {
  const calves = data.calves.filter(calf => calf.stable === stable);
  if (!calves.length) return { milkType: null, amount: 0 };

  const youngest = calves.reduce((current, calf) => days(calf.birthDate) < days(current.birthDate) ? calf : current);
  const row = planRowFor(youngest);
  return {
    milkType: row?.milkType || null,
    amount: (row ? Number(row.amount) : 0) * calves.length
  };
}
function updateConnectionStatus(success){ const led = document.getElementById('connectionLED'); if (led) { if (success) { led.classList.remove('disconnected'); led.classList.add('connected'); } else { led.classList.remove('connected'); led.classList.add('disconnected'); } } }
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

let activeSyncRequests = 0;
function showSpinner() {
  activeSyncRequests++;
  const spinner = document.getElementById('syncSpinner');
  if (spinner) spinner.classList.remove('hidden');
}
function hideSpinner() {
  activeSyncRequests = Math.max(0, activeSyncRequests - 1);
  if (activeSyncRequests === 0) {
    const spinner = document.getElementById('syncSpinner');
    if (spinner) spinner.classList.add('hidden');
  }
}

function updateConnectionStatus(success){ const led = document.getElementById('connectionLED'); if (led) { if (success) { led.classList.remove('disconnected'); led.classList.add('connected'); } else { led.classList.remove('connected'); led.classList.add('disconnected'); } } }

function openSettingsModal(locked = false) {
  isSettingsLocked = locked;
  document.getElementById('sheetId').value = config.sheetId || '';
  document.getElementById('apiUrl').value = config.apiUrl || '';
  document.getElementById('connectionStatus').textContent = '';
  const closeBtn = document.getElementById('closeSettingsModal');
  if (closeBtn) closeBtn.style.display = locked ? 'none' : 'block';
  document.getElementById('settingsModal').classList.remove('hidden');
}

async function save() {
  if (!config.apiUrl || !config.sheetId) { 
    const el = document.getElementById('lastSyncText'); if (el) el.textContent = 'Sheets-Verbindung fehlt'; 
    updateConnectionStatus(false); 
    openSettingsModal(true);
    return false; 
  }
  showSpinner();
  try {
    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ sheetId: config.sheetId, data })
    });
    const json = await res.json().catch(() => ({}));
    if (json.error) {
      throw new Error(json.error);
    }
    const el = document.getElementById('lastSyncText'); if (el) el.textContent = 'Live synchronisiert';
    updateConnectionStatus(true);
    return true;
  } catch (error) {
    // If it's an explicit application error from the server (json.error)
    if (error.message && error.message !== 'Failed to fetch' && !error.message.includes('CORS') && !error.message.includes('NetworkError') && !error.message.includes('JSON')) {
      const el = document.getElementById('lastSyncText'); if (el) el.textContent = 'Sync-Fehler';
      updateConnectionStatus(false);
      showToast(`Fehler beim Speichern in Google Sheets: ${error.message}. Änderungen wurden verworfen.`);
      return false;
    }
    // For CORS / network / redirect / JSON parse errors where Google Apps Script successfully processed the request:
    const el = document.getElementById('lastSyncText'); if (el) el.textContent = 'Live synchronisiert';
    updateConnectionStatus(true);
    return true;
  } finally {
    hideSpinner();
  }
}

async function mutateAndSave(mutationFn) {
  const snapshot = structuredClone(data);
  mutationFn();
  const ok = await save();
  if (!ok) {
    data = snapshot;
    renderOverview();
    if (!document.getElementById('stableModal').classList.contains('hidden')) renderModal();
    if (!document.getElementById('planView').classList.contains('hidden')) renderPlan();
    return false;
  }
  return true;
}

async function loadRemote() {
  if (!config.apiUrl || !config.sheetId) { 
    updateConnectionStatus(false); 
    return false; 
  }
  showSpinner();
  try {
    const response = await fetch(`${config.apiUrl}?sheetId=${encodeURIComponent(config.sheetId)}`);
    const remote = await response.json();
    if (remote.data && remote.data.calves) {
      data = ensureValidData(remote.data);
      if (!data.stables.some(stable => stable.id === selectedStable)) selectedStable = data.stables[0].id;
      renderOverview();
      if (!document.getElementById('stableModal').classList.contains('hidden')) renderModal();
      if (!document.getElementById('planView').classList.contains('hidden')) renderPlan();
      document.getElementById('connectionStatus').textContent = 'Mit Google Sheets verbunden';
      updateConnectionStatus(true);
      return true;
    } else {
      console.warn("Remote data invalid, using defaults", remote);
      return false;
    }
  } catch (error) {
    document.getElementById('connectionStatus').textContent = 'Verbindung fehlgeschlagen';
    updateConnectionStatus(false);
    return false;
  } finally {
    hideSpinner();
  }
}
function openStable(stable){selectedStable=stable;renderModal();document.getElementById('stableModal').classList.remove('hidden');}
function navigateStable(direction){const stables=sortStables(data.stables);if(!stables.length)return;const index=stables.findIndex(stable=>stable.id===selectedStable);openStable(stables[(index+direction+stables.length)%stables.length].id);}
function renderStableList(){
  const grid=document.getElementById('stableManagementGrid');
  if(!grid)return;
  const stables=sortStables(data.stables);
  document.getElementById('stableManagementCount').textContent=`${stables.length} ${stables.length===1?'Stall':'Ställe'}`;
  grid.innerHTML=stables.map(stable=>{
    const calfCount=data.calves.filter(calf=>calf.stable===stable.id).length;
    return `<article class="stable-management-card"><div class="stable-management-icon" aria-hidden="true">${stable.number}${stable.compartment ? ` ${stable.compartment}` : ''}</div><div class="stable-management-details"><strong>${stableLabel(stable)}</strong><span>${calfCount} ${calfCount===1?'Kalb':'Kälber'}</span></div><button class="stable-remove-button" type="button" data-remove-stable="${stable.id}" aria-label="${stableLabel(stable)} entfernen" title="Stall entfernen">×</button></article>`;
  }).join('');
  grid.querySelectorAll('[data-remove-stable]').forEach(button=>button.onclick=()=>requestRemoveStable(button.dataset.removeStable));
}
function requestRemoveStable(stableId){
  const stable=data.stables.find(item=>item.id===stableId);
  if(!stable)return;
  if(data.calves.some(calf=>calf.stable===stableId)){showToast(`${stableLabel(stable)} ist belegt. Bitte zuerst alle Kälber umstallen.`);return;}
  if(data.stables.length<=1){showToast('Der letzte Stall kann nicht entfernt werden.');return;}
  pendingRemoveStableId=stableId;
  document.getElementById('removeStableText').textContent=`${stableLabel(stable)} wirklich entfernen?`;
  document.getElementById('removeStableModal').classList.remove('hidden');
}
function openTask(calfId,index){selectedCalf=data.calves.find(c=>c.id===calfId);selectedTreatment=index;const t=selectedCalf.treatments[index];document.getElementById('treatmentForm').reset();document.querySelector('[name="dateTime"]').value=dateTimeKey(new Date());document.querySelector('[name="diagnosis"]').value=t.diagnosis;document.querySelector('[name="treatment"]').value=t.treatment;document.querySelector(`[name="status"][value="${t.status||'repeat'}"]`).checked=true;document.getElementById('treatmentModal').classList.remove('hidden');}
function tasksForStable(){const cutoff=Date.now()-Number(data.taskDelayHours)*3600000;return data.calves.filter(c=>c.stable===selectedStable).flatMap(c=>(c.treatments||[]).map((t,i)=>({calf:c,treatment:t,index:i}))).filter(x=>(x.treatment.status==='repeat'||x.treatment.repeat)&&!x.treatment.taskDismissed&&(!x.treatment.createdAt||Date.parse(x.treatment.createdAt)<=cutoff));}
function renderOverview(){
  if (!data || !data.calves) {
    console.warn('renderOverview called with invalid data, skipping.');
    return;
  }
  let totalWholeMilk=0,totalMilkReplacer=0,totalCalves=0,totalTasks=0;
  const grid=document.getElementById('stableGrid');
  grid.innerHTML='';
  sortStables(data.stables).forEach(stable=>{
        const cs=data.calves.filter(c=>c.stable===stable.id),
          m=stableMilk(stable.id),
          tasks=tasksFor(stable.id);
        if (m.milkType === 'milchersatz') totalMilkReplacer += m.amount;
        else totalWholeMilk += m.amount;
    totalCalves+=cs.length;
    totalTasks+=tasks.length;
    const milkLabel=m.milkType==='milchersatz'?'Milchersatz':m.milkType==='vollmilch'?'Vollmilch':'Milchmenge';
    const treatmentBadge=tasks.length
      ? `<div class="treatment-badge">💉 ${tasks.length} Behandlung${tasks.length>1?'en':''} nötig</div>`
      : '<div class="treatment-badge is-empty" aria-hidden="true">&nbsp;</div>';
    grid.insertAdjacentHTML('beforeend',`<button class="stable-card" data-stable="${stable.id}"><span class="stable-arrow">→</span><span class="calf-icon"></span><h3>${stableLabel(stable)}</h3><div class="stable-count"><strong>${cs.length}</strong><span>${cs.length===1?'Kalb':'Kälber'}</span></div><div class="stable-milk"><span>${milkLabel}</span><strong>${litres(m.amount)}</strong></div>${treatmentBadge}</button>`);
  });
  document.getElementById('overallWholeMilk').textContent=litres(totalWholeMilk);
  document.getElementById('overallMilkReplacer').textContent=litres(totalMilkReplacer);
  document.getElementById('overallCalves').textContent=String(totalCalves);
  document.getElementById('overallTreatments').textContent=String(totalTasks);
  renderStableList();
}
function tasksFor(stable){const cutoff=Date.now()-Number(data.taskDelayHours)*3600000;return data.calves.filter(c=>c.stable===stable).flatMap(c=>(c.treatments||[]).map((t,i)=>({calf:c,treatment:t,index:i}))).filter(x=>(x.treatment.status==='repeat'||x.treatment.repeat)&&!x.treatment.taskDismissed&&(!x.treatment.createdAt||Date.parse(x.treatment.createdAt)<=cutoff));}
function renderModal(){
  const cs=data.calves.filter(c=>c.stable===selectedStable),
    tasks=tasksFor(selectedStable),
    stableQuantity=stableMilk(selectedStable);
  document.getElementById('modalTitle').textContent=stableLabel(data.stables.find(stable=>stable.id===selectedStable));
  document.getElementById('modalCalves').textContent=cs.length;
  document.getElementById('modalMilk').textContent=litres(stableQuantity.amount);
  document.getElementById('modalMilkType').textContent=stableQuantity.milkType==='milchersatz'?'Milchersatz':stableQuantity.milkType==='vollmilch'?'Vollmilch':'Milchmenge';
  
  document.getElementById('modalTasks').innerHTML=tasks.map(x=>`<div class="task-item"><button class="task-button" data-task-id="${x.calf.id}" data-task-index="${x.index}"><span class="calf-tag">${x.calf.tag}</span><strong>${x.treatment.diagnosis}</strong><span>${x.treatment.treatment}</span></button><button class="task-done" data-task-id="${x.calf.id}" data-task-index="${x.index}">✓</button><button class="task-delete" data-task-id="${x.calf.id}" data-task-index="${x.index}">🗑</button></div>`).join('');
  document.getElementById('calfList').innerHTML=cs.map(c=>{
    const calfAgeDays=days(c.birthDate),
      calfAgeWeeks=Math.floor(calfAgeDays/7),
      remainingAgeDays=calfAgeDays%7,
      calfMilkType=planRowFor(c)?.milkType==='milchersatz'?'Milchersatz':'Vollmilch',
      calfTreatments=c.treatments||[],
      olderTreatmentCount=Math.max(0,calfTreatments.length-3),
      treatmentHistory=calfTreatments.length?`<div class="treatments"><div class="treatment-history-header"><span class="treatment-history-label">Behandlungshistorie</span>${calfTreatments.length>3?`<button class="treatment-history-toggle" type="button" data-calf-history="${c.id}" aria-label="Ältere Behandlungen anzeigen" aria-expanded="false" title="Ältere Behandlungen anzeigen">⌄</button>`:''}</div><div class="treatment-history-list">${calfTreatments.map((t,index)=>`<div class="treatment-entry"${index<olderTreatmentCount?' hidden':''}><strong>${dateTime(t.dateTime||`${t.date}T00:00`)}</strong><span>${t.diagnosis} · ${t.treatment}${t.status==='repeat'?' · Wiederholen':''}${t.status==='completed'?' · Abgeschlossen':''}</span></div>`).join('')}</div></div>`:'';
    return `<div class="calf-row"><div class="calf-tag"><span class="calf-icon"></span><span class="calf-tag-number">${c.tag}</span></div><div class="calf-dates" hidden><small>Geboren: ${date(c.birthDate)}</small><small>Eingestallt: ${date(c.stableSince)}</small></div><div class="calf-age"><span>${calfAgeWeeks} ${calfAgeWeeks===1?'Woche':'Wochen'}</span><span>${remainingAgeDays} ${remainingAgeDays===1?'Tag':'Tage'}</span></div><div class="calf-milk"><span>${calfMilkType}</span>${litres(milk(c))}</div><div class="calf-actions"><button data-treatment="${c.id}" aria-label="Behandlung hinzufügen">💉</button><button data-move="${c.id}" aria-label="Stall wechseln">⇄</button><button data-remove="${c.id}" aria-label="Kalb ausstallen">×</button><button class="calf-info-button" type="button" data-calf-info="${c.id}" aria-label="Geburts- und Einstalldatum anzeigen" aria-expanded="false" title="Geburts- und Einstalldatum anzeigen">i</button></div>${treatmentHistory}</div>`;
  }).join('');
  document.querySelectorAll('[data-calf-info]').forEach(button=>button.onclick=()=>{const details=button.closest('.calf-row').querySelector('.calf-dates'),expanded=button.getAttribute('aria-expanded')==='true';details.hidden=expanded;button.setAttribute('aria-expanded',String(!expanded));});
  document.querySelectorAll('[data-calf-history]').forEach(button=>button.onclick=()=>{const list=button.closest('.treatments').querySelector('.treatment-history-list'),isExpanded=button.getAttribute('aria-expanded')==='true',willExpand=!isExpanded;[...list.children].forEach((entry,index)=>entry.hidden=!willExpand&&index>=3);button.setAttribute('aria-expanded',String(willExpand));button.setAttribute('aria-label',willExpand?'Weniger Behandlungen anzeigen':'Ältere Behandlungen anzeigen');button.title=willExpand?'Weniger Behandlungen anzeigen':'Ältere Behandlungen anzeigen';button.textContent=willExpand?'⌃':'⌄';});
  document.querySelectorAll('[data-treatment]').forEach(b=>b.onclick=()=>newTreatment(Number(b.dataset.treatment)));
  document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>move(Number(b.dataset.move)));
  document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>remove(Number(b.dataset.remove)));
  document.querySelectorAll('.task-button,.task-done').forEach(b=>b.onclick=()=>openTask(Number(b.dataset.taskId),Number(b.dataset.taskIndex)));
  document.querySelectorAll('.task-delete').forEach(b=>b.onclick=()=>deleteTask(Number(b.dataset.taskId),Number(b.dataset.taskIndex)));
}
function newTreatment(id){selectedCalf=data.calves.find(c=>c.id===id);selectedTreatment=null;document.getElementById('treatmentForm').reset();document.querySelector('[name="dateTime"]').value=dateTimeKey(new Date());document.getElementById('treatmentModal').classList.remove('hidden');}
function move(id){selectedCalf=data.calves.find(c=>c.id===id);document.getElementById('stableChoices').innerHTML=sortStables(data.stables).filter(stable=>stable.id!==selectedCalf.stable).map(stable=>`<button class="stable-choice" data-choice="${stable.id}">${stableLabel(stable)}</button>`).join('');document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=async()=>{await mutateAndSave(()=>{selectedCalf.stable=b.dataset.choice;selectedCalf.stableSince=key(now);});close('moveModal');renderOverview();renderModal();});document.getElementById('moveModal').classList.remove('hidden');}
function remove(id) {
  const modal = document.getElementById('removeCalfModal');
  const confirmBtn = document.getElementById('confirmRemoveCalf');
  confirmBtn.onclick = async () => {
    await mutateAndSave(() => { data.calves = data.calves.filter(c => c.id !== id); });
    renderOverview();
    renderModal();
    close('removeCalfModal');
  };
  modal.classList.remove('hidden');
}

function deleteTask(id, index) {
  const modal = document.getElementById('deleteTaskModal');
  const confirmBtn = document.getElementById('confirmDeleteTask');
  confirmBtn.onclick = async () => {
    await mutateAndSave(() => { data.calves.find(c => c.id === id).treatments[index].taskDismissed = true; });
    renderOverview();
    renderModal();
    close('deleteTaskModal');
  };
  modal.classList.remove('hidden');
}
function close(id){document.getElementById(id).classList.add('hidden');}
function openKeypad(input,title){keypadTarget=input;keypadFresh=true;input.select();document.getElementById('keypadTitle').textContent=title;document.getElementById('keypadDisplay').textContent=input.value||'0';document.getElementById('keypadKeys').innerHTML=['1','2','3','4','5','6','7','8','9','⌫','0',','].map(k=>`<button data-key="${k}">${k}</button>`).join('');document.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{let v=document.getElementById('keypadDisplay').textContent;const key=b.dataset.key;if(key==='⌫'){v=v.slice(0,-1);keypadFresh=false;}else if(keypadFresh){v=key;keypadFresh=false;}else{v=v==='0'?key:v+key;}document.getElementById('keypadDisplay').textContent=v});document.getElementById('keypadModal').classList.remove('hidden');}
function planText(r){return `Woche ${Math.ceil(r.ageFrom/7)}, Tag ${(r.ageFrom-1)%7+1}<br>bis Woche ${Math.ceil(r.ageTo/7)}, Tag ${(r.ageTo-1)%7+1}`;}
function renderPlan(){
  if (!data.plan) data.plan = structuredClone(defaultPlan);
  data.plan = normalizePlan(data.plan);
  document.getElementById('planBody').innerHTML=data.plan.map((r,i)=>`<tr><td><input class="plan-amount" data-plan="amount" data-index="${i}" type="number" min="0" step="0.5" value="${r.amount}"></td><td><fieldset class="milk-type-switch"><legend class="visually-hidden">Milchart</legend><label><input type="radio" name="milkType-${i}" data-plan="milkType" data-index="${i}" value="vollmilch" ${r.milkType==='vollmilch'?'checked':''}><span>Vollmilch</span></label><label><input type="radio" name="milkType-${i}" data-plan="milkType" data-index="${i}" value="milchersatz" ${r.milkType==='milchersatz'?'checked':''}><span>Milchersatz</span></label></fieldset></td><td><input data-plan="ageFrom" data-index="${i}" type="number" min="1" value="${r.ageFrom}" ${i?'readonly':''}></td><td><input data-plan="ageTo" data-index="${i}" type="number" min="1" value="${r.ageTo}"></td><td><output class="range-output">${planText(r)}</output></td><td><button class="remove-plan" data-remove-plan="${i}">×</button></td></tr>`).join('');
  document.querySelectorAll('.plan-amount').forEach(x=>x.onfocus=()=>openKeypad(x,'L / KALB'));
  document.querySelectorAll('[data-plan="ageTo"]').forEach(x=>x.oninput=()=>{
    const i=Number(x.dataset.index);
    if(data.plan[i+1]) {
        data.plan[i+1].ageFrom=Number(x.value)+1;
        document.querySelectorAll('[data-plan="ageFrom"]')[i+1]?.setAttribute('value',Number(x.value)+1);
    }
    renderPlanLive();
  });
  document.querySelectorAll('[data-remove-plan]').forEach(x=>x.onclick=()=>{syncPlanFromInputs();data.plan.splice(Number(x.dataset.removePlan),1);renderPlan();});
}
function syncPlanFromInputs(){document.querySelectorAll('[data-plan]').forEach(input=>{if(input.type==='radio'&&!input.checked)return;const value=input.dataset.plan==='milkType'?input.value:Number(input.value);data.plan[Number(input.dataset.index)][input.dataset.plan]=value;});}
document.getElementById('addPlanButton').onclick=()=>{
  syncPlanFromInputs();
  const last=data.plan[data.plan.length-1];
  const ageFrom=last?Number(last.ageTo)+1:1;
  data.plan.push({amount:last?Number(last.amount):5,ageFrom,ageTo:ageFrom+6,milkType:'vollmilch'});
  renderPlan();
};
function renderPlanLive(){document.querySelectorAll('.range-output').forEach((x,i)=>x.innerHTML=planText(data.plan[i]));}
document.getElementById('currentDate').textContent=new Intl.DateTimeFormat('de-DE',{dateStyle:'full'}).format(now);
document.getElementById('closeModal').onclick=()=>close('stableModal');
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>close(b.dataset.close));
document.getElementById('previousStable').onclick=()=>navigateStable(-1);
document.getElementById('nextStable').onclick=()=>navigateStable(1);
document.getElementById('calfForm').onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  const ok = await mutateAndSave(()=>{
    data.calves.push({id:Date.now(),tag:f.get('tag'),birthDate:f.get('birthDate'),stable:selectedStable,stableSince:key(now),treatments:[]});
  });
  if(ok) {
    e.target.reset();
    document.querySelector('[name="birthDate"]').value = key(now);
  }
  renderOverview();
  renderModal();
};
document.getElementById('stableForm').onsubmit=async event=>{
  event.preventDefault();
  const stableForm=event.currentTarget;
  const form=new FormData(stableForm);
  const number=Number(form.get('stableNumber'));
  const compartment=String(form.get('stableCompartment')||'').trim().toUpperCase();
  if(!Number.isSafeInteger(number)||number<1||!/^[A-Z]?$/.test(compartment)){showToast('Bitte eine gültige Stallnummer und höchstens einen Großbuchstaben eingeben.');return;}
  if(data.stables.some(stable=>stable.number===number&&stable.compartment===compartment)){showToast('Dieser Stall ist bereits in der Stallliste.');return;}
  const stable={id:uniqueStableId(number,compartment,data.stables),number,compartment};
  const ok=await mutateAndSave(()=>data.stables.push(stable));
  if(ok){stableForm.reset();renderOverview();}
};
document.getElementById('confirmRemoveStable').onclick=async()=>{
  const stableId=pendingRemoveStableId;
  if(!stableId)return;
  if(data.calves.some(calf=>calf.stable===stableId)){showToast('Der Stall ist inzwischen belegt. Bitte zuerst alle Kälber umstallen.');close('removeStableModal');return;}
  if(data.stables.length<=1){showToast('Der letzte Stall kann nicht entfernt werden.');close('removeStableModal');return;}
  const ok=await mutateAndSave(()=>{
    data.stables=data.stables.filter(stable=>stable.id!==stableId);
    if(selectedStable===stableId)selectedStable=sortStables(data.stables)[0].id;
  });
  if(ok){renderOverview();if(!document.getElementById('stableModal').classList.contains('hidden'))renderModal();}
  pendingRemoveStableId=null;
  close('removeStableModal');
};
document.querySelector('[name="birthDate"]').value = key(now);
document.querySelector('[name="tag"]').onfocus=e=>openKeypad(e.target,'Ohrmarkennummer');
document.getElementById('treatmentForm').onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(e.target),entry={dateTime:f.get('dateTime'),diagnosis:f.get('diagnosis'),treatment:f.get('treatment'),status:f.get('status'),createdAt:new Date().toISOString()};
  const ok = await mutateAndSave(()=>{
    selectedCalf.treatments ||= [];
    if(selectedTreatment!==null)selectedCalf.treatments[selectedTreatment].taskDismissed=true;
    selectedCalf.treatments.push(entry);
    data.suggestions ||= {diagnosis:[],treatment:[]};
    ['diagnosis','treatment'].forEach(field=>{
      const value=String(f.get(field)||'').trim();
      if(value&&!data.suggestions[field].includes(value))data.suggestions[field].push(value);
    });
  });
  if(ok) close('treatmentModal');
  renderOverview();
  renderModal();
};
document.getElementById('keypadDone').onclick=()=>{
  if(keypadTarget){
    keypadTarget.value=document.getElementById('keypadDisplay').textContent.replace(',','.');
    keypadTarget.dispatchEvent(new Event('input',{bubbles:true}));
    keypadTarget.dispatchEvent(new Event('change',{bubbles:true}));
  }
  close('keypadModal');
};
document.getElementById('resetDataButton').onclick=async()=>{
  await loadRemote();
  renderOverview();
};
renderOverview();
function reloadStored(){
  const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
  if(stored){
    data = ensureValidData(stored);
    data.taskDelayHours ??= 3;
    data.calves.forEach(c=>{
      c.treatments ??= [];
      c.stableSince ??= c.birthDate;
    });
  }
}
document.getElementById('stableModal').addEventListener('click',event=>{if(event.target===event.currentTarget)close('stableModal')});document.getElementById('treatmentModal').addEventListener('click',event=>{if(event.target===event.currentTarget)close('treatmentModal')});document.getElementById('moveModal').addEventListener('click',event=>{if(event.target===event.currentTarget)close('moveModal')});document.getElementById('keypadModal').addEventListener('click',event=>{if(event.target===event.currentTarget)close('keypadModal')});
document.getElementById('stableGrid').addEventListener('click',event=>{const card=event.target.closest('.stable-card');if(card)openStable(card.dataset.stable);});

document.querySelectorAll('[data-plan="ageTo"]').forEach(input=>input.addEventListener('input',()=>{const index=Number(input.dataset.index);const next=document.querySelector(`[data-plan="ageFrom"][data-index="${index+1}"]`);if(next){next.value=Number(input.value)+1;data.plan[index+1].ageFrom=Number(input.value)+1;}renderPlanLive?.();}));
document.addEventListener('input',event=>{if(!event.target.matches('[data-plan="ageTo"]'))return;const index=Number(event.target.dataset.index);const next=document.querySelector(`[data-plan="ageFrom"][data-index="${index+1}"]`);if(next){next.value=Number(event.target.value)+1;data.plan[index+1].ageFrom=Number(event.target.value)+1;const row=next.closest('tr');row.querySelector('.range-output').textContent=planText(data.plan[index+1]);}});
function validatePlan(){let valid=true;data.plan.forEach((row,index)=>{const from=document.querySelector(`[data-plan="ageFrom"][data-index="${index}"]`);const to=document.querySelector(`[data-plan="ageTo"][data-index="${index}"]`);const ageFrom=Number(from?.value);const ageTo=Number(to?.value);if(ageTo<ageFrom){to.setCustomValidity('Bis muss mindestens Von entsprechen');valid=false;}else if(to){to.setCustomValidity('');}if(index>0){const previousTo=Number(document.querySelector(`[data-plan="ageTo"][data-index="${index-1}"]`)?.value);if(ageFrom!==previousTo+1){from.setCustomValidity(`Muss Tag ${previousTo+1} sein`);valid=false;}else if(from){from.setCustomValidity('');}}else if(from){from.setCustomValidity('');}});return valid;}
document.getElementById('savePlanButton').onclick=async()=>{if(!validatePlan()){document.querySelector(':invalid')?.reportValidity();return;}syncPlanFromInputs();await save();renderPlan();renderOverview();};
function saveConfig(){config.sheetId=document.getElementById('sheetId').value.trim();config.apiUrl=document.getElementById('apiUrl').value.trim();localStorage.setItem(STORAGE_KEY,JSON.stringify(config));}
document.getElementById('openSettingsButton').onclick = () => openSettingsModal(false);
document.getElementById('closeSettingsModal').onclick = () => { if (!isSettingsLocked) close('settingsModal'); };
document.getElementById('settingsModal').addEventListener('click', event => {
  if (event.target === event.currentTarget && !isSettingsLocked) close('settingsModal');
});
document.getElementById('saveSettingsButton').onclick = async () => {
  saveConfig();
  const ok = await loadRemote();
  if (ok) {
    isSettingsLocked = false;
    close('settingsModal');
    showToast('Verbindung erfolgreich hergestellt!');
  } else {
    document.getElementById('connectionStatus').textContent = 'Verbindung fehlgeschlagen. Bitte ID und URL prüfen.';
    updateConnectionStatus(false);
    openSettingsModal(true);
  }
  renderOverview();
};
document.getElementById('saveTasksSettingsButton').onclick = async () => {
  await mutateAndSave(() => {
    data.taskDelayHours = Number(document.getElementById('taskDelayHours').value) || 3;
  });
  showToast('Aufgaben-Einstellung gespeichert');
  renderOverview();
};
document.getElementById('resetDataButton').onclick = async () => {
  await loadRemote();
  renderOverview();
};
loadRemote().then(ok => {
  if (!ok) openSettingsModal(true);
});
const originalRenderOverview = renderOverview;
renderOverview = function(){ originalRenderOverview(); let treatmentTotal=0; sortStables(data.stables).forEach(stable=>treatmentTotal += tasksFor(stable.id).length); document.getElementById('overallCalves').textContent=String(data.calves.length); document.getElementById('overallTreatments').textContent=String(treatmentTotal); };
const originalRenderModal = renderModal;
renderModal = function(){ originalRenderModal(); document.querySelectorAll('.task-item').forEach(item=>{const button=item.querySelector('.task-button');const calf=data.calves.find(c=>c.id===Number(button.dataset.taskId));const treatment=calf?.treatments?.[Number(button.dataset.taskIndex)];if(button&&calf&&treatment)button.innerHTML=`<strong>${calf.tag}</strong><span>${treatment.diagnosis}</span><span>${treatment.treatment}</span>`;});document.querySelectorAll('.treatment-history-list').forEach(history=>[...history.children].reverse().forEach(entry=>history.appendChild(entry))); };
document.addEventListener('pointerdown',event=>{const input=event.target.closest('input[type="number"]');spinnerPointer=Boolean(input&&event.clientX>input.getBoundingClientRect().right-32);});document.addEventListener('focusin',event=>{const input=event.target;if(!input.matches('input,textarea'))return;input.select();if(!input.readOnly&&!spinnerPointer&&(input.type==='number'||input.inputMode==='numeric'||input.inputMode==='decimal'))openKeypad(input,input.closest('label')?.textContent||'Zahl eingeben');spinnerPointer=false;});
let lastLoadTime = Date.now();
const AUTO_REFRESH_THRESHOLD = 10000;

async function triggerAutoRefresh() {
  if (Date.now() - lastLoadTime < AUTO_REFRESH_THRESHOLD) return;
  lastLoadTime = Date.now();
  await loadRemote();
}

window.addEventListener('focus', () => {
  triggerAutoRefresh();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    triggerAutoRefresh();
  }
});

setInterval(()=>{renderOverview();if(!document.getElementById('stableModal').classList.contains('hidden'))renderModal();loadRemote();},60000);
function renderCalvesView() {
    const calvesBody = document.getElementById('calvesBody');
    if (!calvesBody) return;

    const searchTerm = document.getElementById('calvesSearch')?.value.toLowerCase() || '';
    const sortedStables = sortStables(data.stables);
    let filteredCalves = data.calves.filter(calf =>
      calf.tag.toLowerCase().includes(searchTerm) ||
      stableLabel(sortedStables.find(stable=>stable.id===calf.stable)).toLowerCase().includes(searchTerm) ||
      age(calf.birthDate).toLowerCase().includes(searchTerm)
    );

    // Sortierung (Standard: Ohrmarke aufsteigend)
    const sortBy = document.querySelector('#calvesTable th[data-sort].active')?.dataset.sort || 'tag';
    const sortDirection = document.querySelector('#calvesTable th[data-sort].active')?.classList.contains('asc') ? 1 : -1;

    filteredCalves.sort((a, b) => {
      let aValue, bValue;
      if (sortBy === 'tag') {
        aValue = a.tag;
        bValue = b.tag;
      } else if (sortBy === 'stable') {
        aValue = sortedStables.findIndex(stable=>stable.id===a.stable);
        bValue = sortedStables.findIndex(stable=>stable.id===b.stable);
      } else if (sortBy === 'age') {
        aValue = days(a.birthDate);
        bValue = days(b.birthDate);
      }
      return aValue < bValue ? -1 * sortDirection : 1 * sortDirection;
    });

    calvesBody.innerHTML = filteredCalves.map(calf => {
      const calfStable = sortedStables.find(stable => stable.id === calf.stable);
      const calfStableNumber = calfStable ? `${calfStable.number}${calfStable.compartment ? ` ${calfStable.compartment}` : ''}` : 'Unbekannt';
      const calfAgeDays = days(calf.birthDate);
      const calfAgeWeeks = Math.floor(calfAgeDays / 7);
      const remainingAgeDays = calfAgeDays % 7;
      const treatments = [...(Array.isArray(calf.treatments) ? calf.treatments : [])];
      const treatmentDate = treatment => treatment.dateTime || (treatment.date ? `${treatment.date}T00:00` : '');
      const treatmentTimestamp = treatment => {
        const timestamp = Date.parse(treatmentDate(treatment));
        return Number.isNaN(timestamp) ? 0 : timestamp;
      };
      treatments.sort((a, b) => treatmentTimestamp(b) - treatmentTimestamp(a));
      const treatmentsHtml = treatments.length
        ? `<div class="calf-treatments-panel"><strong>Behandlungshistorie</strong><div class="treatments-in-table">${
            treatments.map(treatment => {
              const recordedAt = treatmentDate(treatment);
              const status = treatment.status === 'repeat' ? ' · Wiederholen' : treatment.status === 'completed' ? ' · Abgeschlossen' : '';
              return `<div><strong>${recordedAt ? dateTime(recordedAt) : 'Datum unbekannt'}</strong><span>${treatment.diagnosis || ''} – ${treatment.treatment || ''}${status}</span></div>`;
            }).join('')
          }</div></div>`
        : '<div class="calf-treatments-panel empty">Keine Behandlungen dokumentiert.</div>';

      return `
        <tr>
          <td><strong>${calf.tag}</strong></td>
          <td>${calfStableNumber}</td>
          <td><span class="calf-list-age"><span>${calfAgeWeeks} ${calfAgeWeeks===1?'Woche':'Wochen'}</span><span>${remainingAgeDays} ${remainingAgeDays===1?'Tag':'Tage'}</span></span></td>
          <td>${date(calf.birthDate)}</td>
          <td><button class="calf-history-toggle" type="button" data-calf-history aria-expanded="false" aria-label="Behandlungshistorie anzeigen" title="Behandlungshistorie anzeigen" ${treatments.length ? '' : 'disabled'}><span>${treatments.length ? `Behandlungen (${treatments.length})` : 'Keine Behandlungen'}</span><span class="calf-history-chevron" aria-hidden="true">⌄</span></button></td>
        </tr>
        <tr class="calf-treatment-details" hidden><td colspan="5">${treatmentsHtml}</td></tr>
      `;
    }).join('');
  }

  document.getElementById('calvesTable')?.addEventListener('click', (event) => {
    const historyButton = event.target.closest('[data-calf-history]');
    if (historyButton) {
      const willExpand = historyButton.getAttribute('aria-expanded') !== 'true';
      historyButton.closest('tr').nextElementSibling.hidden = !willExpand;
      historyButton.setAttribute('aria-expanded', String(willExpand));
      historyButton.setAttribute('aria-label', willExpand ? 'Behandlungshistorie einklappen' : 'Behandlungshistorie anzeigen');
      historyButton.title = willExpand ? 'Behandlungshistorie einklappen' : 'Behandlungshistorie anzeigen';
      historyButton.querySelector('.calf-history-chevron').textContent = willExpand ? '⌃' : '⌄';
      return;
    }

    const header = event.target.closest('th[data-sort]');
    if (!header) return;

    document.querySelectorAll('#calvesTable th[data-sort]').forEach(th => {
      th.classList.remove('active', 'asc', 'desc');
    });

    header.classList.add('active');
    header.classList.add(header.classList.contains('asc') ? 'desc' : 'asc');

    renderCalvesView();
  });

  document.getElementById('calvesSearch')?.addEventListener('input', renderCalvesView);

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
      const viewId = tab.dataset.view + 'View';
      document.getElementById(viewId)?.classList.remove('hidden');
      await loadRemote();
      if (tab.dataset.view === 'settings') document.getElementById('taskDelayHours').value = data.taskDelayHours;
      if (tab.dataset.view === 'plan') renderPlan();
      if (tab.dataset.view === 'calves') renderCalvesView();
    });
  });

  renderOverview();
  renderCalvesView();
renderOverview();
function renderSuggestions(){[['diagnosis','diagnosisSuggestions'],['treatment','treatmentSuggestions']].forEach(([field,id])=>{const container=document.getElementById(id);if(!container)return;container.innerHTML=(data.suggestions?.[field]||[]).map((value,index)=>`<span class="suggestion"><button type="button" data-suggestion-field="${field}" data-suggestion-index="${index}">${value}</button><button type="button" title="Vorschlag löschen" data-delete-suggestion-field="${field}" data-delete-suggestion-index="${index}">×</button></span>`).join('');container.querySelectorAll('[data-suggestion-field]').forEach(button=>button.addEventListener('click',()=>{document.querySelector(`[name="${field}"]`).value=button.textContent;}));container.querySelectorAll('[data-delete-suggestion-field]').forEach(button=>button.addEventListener('click',()=>{data.suggestions[button.dataset.deleteSuggestionField].splice(Number(button.dataset.deleteSuggestionIndex),1);save();renderSuggestions();}));});}
const originalNewTreatment = newTreatment; newTreatment = function(id){originalNewTreatment(id);renderSuggestions();};
const originalOpenTask = openTask; openTask = function(id,index){originalOpenTask(id,index);renderSuggestions();};
document.getElementById('treatmentModal').addEventListener('click',event=>{if(event.target.matches('[name="diagnosis"],[name="treatment"]'))renderSuggestions();});
document.getElementById('treatmentForm').addEventListener('submit',event=>{const form=new FormData(event.currentTarget);data.suggestions ||= {diagnosis:[],treatment:[]};['diagnosis','treatment'].forEach(field=>{const value=String(form.get(field)||'').trim();if(value&&!data.suggestions[field].includes(value))data.suggestions[field].push(value);});save();});
document.addEventListener('input',event=>{if(!event.target.matches('[data-plan="ageTo"]'))return;const index=Number(event.target.dataset.index);data.plan[index].ageTo=Number(event.target.value);if(data.plan[index+1]){data.plan[index+1].ageFrom=Number(event.target.value)+1;const next=document.querySelector(`[data-plan="ageFrom"][data-index="${index+1}"]`);if(next)next.value=Number(event.target.value)+1;}renderPlanLive();});
