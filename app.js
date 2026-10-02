(() => {
  'use strict';

  const APP_VERSION = '1.0.0';
  const DB_NAME = 'horton-tracker';
  const DB_VERSION = 1;
  const STORE = 'secure';
  const VAULT_KEY = 'vault';
  const KDF_ITERATIONS = 310000;
  const GRAPH_SCOPE = 'Files.ReadWrite.AppFolder';
  const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
  const CLOUD_FILE = 'horton-tracker.vault.json';

  const SYMPTOMS = [
    'Rindende eller rødt øje','Gummer/tandkød','Spændinger I skulder/nakke','Øm hovedbund',
    'Hængende eller hævet øjenlåg','Mindre pupil','Stoppet eller løbende næse',
    'Svedtendens i ansigtet eller panden','Rastløshed / Trang til at vandre hvileløst rundt','Ingen af ovenstående'
  ];
  const TRIGGERS = [
    'Alkohol','Nikotin / Cigaretter','Kaffe / Koffein','Kraftig eller stærk mad',
    'Skarpt lys / Skærmarbejde','Stærke lugte (parfume, maling etc.)','Fysisk anstrengelse','Ingen åbenlyse triggere'
  ];
  const TREATMENTS = ['Sumatriptan','Pamol','Pinex','Pamol/Paracetamol','Ibuprofen','Treo','Ilt','Tog ingen medicin'];
  const INTENSITY_TEXT = {
    1:'Skygge / murren (Begyndende tegn, ikke fuldt anfald)',
    2:'Mild (Kan udholdes uden akut medicin)',
    3:'Medium (Hæmmer mine aktiviteter)',
    4:'Kraftigt (Decideret, invaliderende anfald)',
    5:'Maksimal / ubærlig smerte'
  };

  let db;
  let vault = null;
  let vaultEnvelope = null;
  let sessionKey = null;
  let deferredInstallPrompt = null;
  let durationMode = 'end';
  let currentView = 'dashboard';
  let confirmResolver = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function uuid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function isoNow() { return new Date().toISOString(); }
  function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function formatDate(iso, options = {day:'numeric', month:'short', year:'numeric'}) {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('da-DK', options).format(new Date(`${iso}T12:00:00`));
  }
  function formatDateTime(iso) { return iso ? new Intl.DateTimeFormat('da-DK',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)) : '—'; }
  function formatDuration(minutes) {
    if (!Number.isFinite(Number(minutes))) return '—';
    const m = Number(minutes); const h = Math.floor(m/60); const rest = m%60;
    return h ? `${h} t ${rest ? `${rest} min` : ''}`.trim() : `${m} min`;
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function toast(message, type = '') {
    const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message;
    $('#toast-region').appendChild(el); setTimeout(() => el.remove(), 4200);
  }
  function setStatus(text, type = '') { const el = $('#save-status'); el.className = `status-pill ${type}`; el.innerHTML = `<i></i> ${escapeHtml(text)}`; }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function dbGet(key) { return new Promise((resolve,reject) => { const r=db.transaction(STORE).objectStore(STORE).get(key); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); }
  function dbPut(key,value) { return new Promise((resolve,reject) => { const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).put(value,key); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); }); }
  function dbDelete(key) { return new Promise((resolve,reject) => { const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); }); }

  function bytesToBase64(bytes) {
    let out=''; const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i=0;i<arr.length;i+=0x8000) out += String.fromCharCode(...arr.subarray(i,i+0x8000));
    return btoa(out);
  }
  function base64ToBytes(value) { const raw=atob(value); const out=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i); return out; }
  async function deriveKey(passphrase, salt) {
    const material = await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:KDF_ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function encryptVault(data, key, existingSalt) {
    const salt = existingSalt || crypto.getRandomValues(new Uint8Array(16));
    const actualKey = key || await deriveKey('',salt);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const clear=new TextEncoder().encode(JSON.stringify(data));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},actualKey,clear);
    return {format:'horton-tracker-vault',version:1,appVersion:APP_VERSION,kdf:{name:'PBKDF2',hash:'SHA-256',iterations:KDF_ITERATIONS,salt:bytesToBase64(salt)},cipher:{name:'AES-GCM',iv:bytesToBase64(iv)},ciphertext:bytesToBase64(ciphertext),updatedAt:isoNow()};
  }
  async function decryptEnvelope(envelope, passphraseOrKey) {
    validateEnvelope(envelope);
    const salt=base64ToBytes(envelope.kdf.salt);
    const key=typeof passphraseOrKey==='string' ? await deriveKey(passphraseOrKey,salt) : passphraseOrKey;
    const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(envelope.cipher.iv)},key,base64ToBytes(envelope.ciphertext));
    const data=JSON.parse(new TextDecoder().decode(clear));
    if (!data || !Array.isArray(data.entries)) throw new Error('Ugyldig datamodel');
    return {data,key};
  }
  function validateEnvelope(envelope) {
    if (!envelope || envelope.format!=='horton-tracker-vault' || envelope.version!==1 || !envelope.kdf?.salt || !envelope.cipher?.iv || !envelope.ciphertext) throw new Error('Filen er ikke en gyldig Horton Tracker-backup.');
  }
  function newVault() { return {schemaVersion:1,createdAt:isoNow(),updatedAt:isoNow(),profile:{name:'',clinic:'',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},entries:[]}; }
  async function persistVault() {
    if (!vault || !sessionKey) throw new Error('Boksen er låst.');
    setStatus('Gemmer…','syncing'); vault.updatedAt=isoNow();
    const salt=base64ToBytes(vaultEnvelope.kdf.salt); vaultEnvelope=await encryptVault(vault,sessionKey,salt); await dbPut(VAULT_KEY,vaultEnvelope);
    setStatus('Gemt lokalt');
  }

  function showUnlock(createMode = false, errorMessage = '') {
    return new Promise(resolve => {
      const dialog=$('#unlock-dialog'), form=$('#unlock-form'), pass=$('#unlock-passphrase'), confirm=$('#unlock-confirm');
      $('#unlock-title').textContent=createMode?'Opret din private boks':'Lås Horton Tracker op';
      $('#unlock-copy').textContent=createMode?'Vælg en adgangssætning, som krypterer alle registreringer på denne enhed.':'Indtast din adgangssætning. Den forlader aldrig denne enhed.';
      $('#unlock-confirm-wrap').hidden=!createMode; confirm.required=createMode; $('#unlock-error').textContent=errorMessage; pass.value=''; confirm.value='';
      const submit=async event => {
        event.preventDefault(); const value=pass.value;
        if(value.length<10){$('#unlock-error').textContent='Brug mindst 10 tegn.';return;}
        if(createMode&&value!==confirm.value){$('#unlock-error').textContent='Adgangssætningerne er ikke ens.';return;}
        form.removeEventListener('submit',submit); dialog.close(); resolve(value);
      };
      form.addEventListener('submit',submit); dialog.showModal(); setTimeout(()=>pass.focus(),50);
    });
  }
  function requestSecret(title,message,confirmNew=false){
    return new Promise(resolve=>{
      const dialog=$('#secret-dialog'),form=$('#secret-form'),value=$('#secret-value'),confirmation=$('#secret-confirm'),cancel=$('#secret-cancel');let settled=false;
      $('#secret-title').textContent=title;$('#secret-message').textContent=message;$('#secret-confirm-wrap').hidden=!confirmNew;confirmation.required=confirmNew;$('#secret-error').textContent='';value.value='';confirmation.value='';value.autocomplete=confirmNew?'new-password':'current-password';
      const cleanup=()=>{form.removeEventListener('submit',submit);dialog.removeEventListener('close',close);cancel.removeEventListener('click',cancelClick);};
      const submit=e=>{e.preventDefault();if(value.value.length<10){$('#secret-error').textContent='Brug mindst 10 tegn.';return;}if(confirmNew&&value.value!==confirmation.value){$('#secret-error').textContent='Adgangssætningerne er ikke ens.';return;}settled=true;const result=value.value;cleanup();dialog.close();resolve(result);};
      const close=()=>{if(settled)return;cleanup();resolve(null);};const cancelClick=()=>dialog.close();
      form.addEventListener('submit',submit);dialog.addEventListener('close',close);cancel.addEventListener('click',cancelClick);dialog.showModal();setTimeout(()=>value.focus(),50);
    });
  }
  async function unlockApp() {
    vaultEnvelope=await dbGet(VAULT_KEY);
    if(!vaultEnvelope){
      const pass=await showUnlock(true); const salt=crypto.getRandomValues(new Uint8Array(16)); sessionKey=await deriveKey(pass,salt); vault=newVault(); vaultEnvelope=await encryptVault(vault,sessionKey,salt); await dbPut(VAULT_KEY,vaultEnvelope); toast('Din krypterede boks er oprettet.');
    } else {
      let unlockError='';
      while(!vault){
        const pass=await showUnlock(false,unlockError);
        try{const opened=await decryptEnvelope(vaultEnvelope,pass);vault=opened.data;sessionKey=opened.key;}
        catch{unlockError='Kunne ikke åbne boksen. Kontrollér adgangssætningen.';}
      }
    }
    hydrateProfile(); renderAll(); await handleOAuthCallback();
    const requestedView=new URLSearchParams(location.search).get('view');
    if(['dashboard','entry','history','insights','backup','settings'].includes(requestedView))showView(requestedView);
  }
  async function lockApp() { vault=null;sessionKey=null;setStatus('Låst');await unlockApp(); }

  function buildCheckOptions(containerId,name,values,exclusiveValue){
    const root=$(`#${containerId}`); root.innerHTML=values.map(v=>`<label class="choice"><input type="checkbox" name="${name}" value="${escapeHtml(v)}" ${v===exclusiveValue?'data-exclusive="true"':''}><span>${escapeHtml(v)}</span></label>`).join('');
    root.addEventListener('change',e=>{ if(e.target.type!=='checkbox')return; const boxes=$$('input[type="checkbox"]',root); if(e.target.dataset.exclusive&&e.target.checked)boxes.filter(x=>x!==e.target).forEach(x=>x.checked=false); else if(e.target.checked)boxes.filter(x=>x.dataset.exclusive).forEach(x=>x.checked=false); updateProgress(); });
  }
  function setupQuestionnaire(){
    buildCheckOptions('symptom-options','symptoms',SYMPTOMS,'Ingen af ovenstående');
    buildCheckOptions('trigger-options','triggers',TRIGGERS,'Ingen åbenlyse triggere');
    buildCheckOptions('treatment-options','treatments',TREATMENTS,'Tog ingen medicin');
  }
  function calculateDuration(start,end){ if(!start||!end)return null; const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number); let value=(eh*60+em)-(sh*60+sm); if(value<=0)value+=1440; return value; }
  function updateDuration(){
    let value=null;if(durationMode==='end')value=calculateDuration($('#start-time').value,$('#end-time').value);else value=Number($('#duration-input').value)||null;
    $('#duration-preview').textContent=value?`Beregnet varighed: ${formatDuration(value)}${durationMode==='end'&&$('#end-time').value<=$('#start-time').value?' · slutter næste døgn':''}`:'Varighed beregnes automatisk';updateProgress();
  }
  function setDurationMode(mode){durationMode=mode;$$('[data-duration-mode]').forEach(b=>b.classList.toggle('active',b.dataset.durationMode===mode));$('#end-time').hidden=mode!=='end';$('#duration-input').hidden=mode!=='minutes';updateDuration();}
  function checkedValues(name,root=document){return $$(`input[name="${name}"]:checked`,root).map(x=>x.value);}
  function radioValue(name,root=document){return $(`input[name="${name}"]:checked`,root)?.value||'';}
  function setChecked(name,values=[]){$$(`input[name="${name}"]`).forEach(x=>x.checked=values.includes(x.value));}
  function setRadio(name,value){$$(`input[name="${name}"]`).forEach(x=>x.checked=x.value===String(value));}

  function collectForm(){
    const form=$('#attack-form'); const start=$('#start-time').value; const end=durationMode==='end'?$('#end-time').value:'';
    return {id:$('#entry-id').value||uuid(),date:$('#attack-date').value,startTime:start,endTime:end,durationMinutes:durationMode==='end'?calculateDuration(start,end):Number($('#duration-input').value)||null,durationSource:durationMode,side:radioValue('side',form),intensity:Number(radioValue('intensity',form))||null,symptoms:checkedValues('symptoms',form),wokeFromSleep:radioValue('wokeFromSleep',form),sleepType:$('#sleep-type').value,triggers:checkedValues('triggers',form),treatments:checkedValues('treatments',form),treatmentEffect:$('#treatment-effect').value,notes:$('#notes').value.trim(),createdAt:$('#entry-id').value?(vault.entries.find(e=>e.id===$('#entry-id').value)?.createdAt||isoNow()):isoNow(),updatedAt:isoNow()};
  }
  function validateEntry(entry){
    const errors=[];
    if(!entry.date)errors.push(['attack-date','Vælg dato for anfaldet.']);
    if(!entry.startTime)errors.push(['start-time','Angiv starttidspunkt.']);
    if(!entry.durationMinutes||entry.durationMinutes<1||entry.durationMinutes>1440)errors.push([durationMode==='end'?'end-time':'duration-input','Angiv sluttid eller en varighed på 1–1440 minutter.']);
    if(!entry.side)errors.push(['side-options','Vælg hvilken side smerten ramte.']);
    if(!entry.intensity)errors.push(['intensity-options','Vælg maksimal smerteintensitet.']);
    if(!entry.symptoms.length)errors.push(['symptom-options','Vælg mindst ét symptom eller “Ingen af ovenstående”.']);
    if(!entry.wokeFromSleep)errors.push(['sleep-type-wrap','Angiv om anfaldet vækkede dig.']);
    if(entry.wokeFromSleep==='Ja'&&!entry.sleepType)errors.push(['sleep-type','Vælg om det var nattesøvn eller middagslur/hvile.']);
    if(!entry.triggers.length)errors.push(['trigger-options','Vælg mindst én mulig trigger eller “Ingen åbenlyse triggere”.']);
    if(!entry.treatments.length)errors.push(['treatment-options','Vælg behandling eller “Tog ingen medicin”.']);
    if(!entry.treatmentEffect)errors.push(['treatment-effect','Angiv behandlingens effekt.']);
    if(entry.treatments.includes('Tog ingen medicin')&&entry.treatmentEffect!=='Ikke relevant (tog ikke medicin)')errors.push(['treatment-effect','Vælg “Ikke relevant”, når du ikke tog medicin.']);
    if(!entry.treatments.includes('Tog ingen medicin')&&entry.treatmentEffect==='Ikke relevant (tog ikke medicin)')errors.push(['treatment-effect','Vælg en effekt, når behandling er registreret.']);
    return errors;
  }
  function showErrors(errors){
    $$('.invalid').forEach(x=>x.classList.remove('invalid'));const box=$('#form-errors');
    if(!errors.length){box.hidden=true;return;}
    box.innerHTML=`<strong>Kontrollér registreringen</strong><ul>${errors.map(([,m])=>`<li>${escapeHtml(m)}</li>`).join('')}</ul>`;box.hidden=false;errors.forEach(([id])=>{const el=$(`#${id}`);if(el)el.classList.add('invalid');});box.focus();
  }
  async function submitEntry(event){
    event.preventDefault();const entry=collectForm(),errors=validateEntry(entry);showErrors(errors);if(errors.length)return;
    const ix=vault.entries.findIndex(e=>e.id===entry.id);if(ix>=0)vault.entries[ix]=entry;else vault.entries.push(entry);await persistVault();resetForm();renderAll();showView('dashboard');toast(ix>=0?'Registreringen er opdateret.':'Anfaldet er gemt krypteret.');
  }
  function resetForm(){
    $('#attack-form').reset();$('#entry-id').value='';$('#entry-kicker').textContent='NY REGISTRERING';$('#entry-title').textContent='Registrér anfald';$('#attack-date').value=todayISO();setDurationMode('end');$('#sleep-type-wrap').hidden=true;$('#form-errors').hidden=true;$('#notes-count').textContent='0';$('#intensity-description').textContent='Vælg den højeste intensitet under anfaldet.';updateProgress();
  }
  function editEntry(id){
    const e=vault.entries.find(x=>x.id===id);if(!e)return;resetForm();$('#entry-id').value=e.id;$('#entry-kicker').textContent='REDIGÉR REGISTRERING';$('#entry-title').textContent='Ret anfald';$('#attack-date').value=e.date;$('#start-time').value=e.startTime||'';setDurationMode(e.durationSource==='minutes'?'minutes':'end');$('#end-time').value=e.endTime||'';$('#duration-input').value=e.durationMinutes||'';setRadio('side',e.side);setRadio('intensity',e.intensity);setChecked('symptoms',e.symptoms);setRadio('wokeFromSleep',e.wokeFromSleep);$('#sleep-type-wrap').hidden=e.wokeFromSleep!=='Ja';$('#sleep-type').value=e.sleepType||'';setChecked('triggers',e.triggers);setChecked('treatments',e.treatments);$('#treatment-effect').value=e.treatmentEffect||'';$('#notes').value=e.notes||'';$('#notes-count').textContent=$('#notes').value.length;updateDuration();updateProgress();showView('entry');scrollTo({top:0});
  }
  async function deleteEntry(id){
    if(!await confirmAction('Slet registrering?','Anfaldet fjernes permanent fra den lokale boks.'))return;
    vault.entries=vault.entries.filter(e=>e.id!==id);await persistVault();renderAll();toast('Registreringen er slettet.');
  }
  function updateProgress(){
    if(!vault)return;const e=collectForm();const done=[e.date,e.startTime,e.durationMinutes,e.side,e.intensity,e.symptoms.length,e.wokeFromSleep,(e.wokeFromSleep!=='Ja'||e.sleepType),e.triggers.length,e.treatments.length,e.treatmentEffect].filter(Boolean).length;const pct=Math.round(done/11*100);$('#form-progress').textContent=`${pct}%`;$('#form-progress-bar').style.width=`${pct}%`;
  }

  function sortedEntries(){return [...(vault?.entries||[])].sort((a,b)=>`${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));}
  function entryRow(e,actions=false){
    const d=new Date(`${e.date}T12:00:00`);const day=d.getDate(),month=new Intl.DateTimeFormat('da-DK',{month:'short'}).format(d).replace('.','');
    return `<article class="entry-row" data-entry-id="${escapeHtml(e.id)}"><div class="date-tile"><strong>${day}</strong><small>${escapeHtml(month)}</small></div><div class="entry-summary"><strong>${escapeHtml(e.startTime||'—')} · ${escapeHtml(formatDuration(e.durationMinutes))} · ${escapeHtml(e.side)}</strong><span>${escapeHtml(e.treatments.join(', ')||'Ingen behandling')} ${e.notes?`· ${escapeHtml(e.notes)}`:''}</span></div><div class="intensity-badge" title="Intensitet ${e.intensity}">${e.intensity}</div>${actions?`<div class="entry-actions"><button class="mini-button" data-edit="${escapeHtml(e.id)}">Redigér</button><button class="mini-button" data-delete="${escapeHtml(e.id)}">Slet</button></div>`:''}</article>`;
  }
  function renderDashboard(){
    const entries=sortedEntries(),cutoff=new Date();cutoff.setDate(cutoff.getDate()-30);const recent=entries.filter(e=>new Date(`${e.date}T23:59:59`)>=cutoff);
    $('#today-label').textContent=new Intl.DateTimeFormat('da-DK',{weekday:'long',day:'numeric',month:'long'}).format(new Date()).toUpperCase();$('#dashboard-count').textContent=recent.length;
    const latest=entries[0];$('#metric-latest').textContent=latest?formatDate(latest.date):'—';$('#metric-latest-note').textContent=latest?`${latest.startTime} · intensitet ${latest.intensity}`:'Ingen registreringer endnu';
    $('#metric-intensity').textContent=recent.length?(recent.reduce((s,e)=>s+e.intensity,0)/recent.length).toFixed(1).replace('.',','):'—';
    const durations=recent.filter(e=>Number.isFinite(Number(e.durationMinutes)));$('#metric-duration').textContent=durations.length?formatDuration(Math.round(durations.reduce((s,e)=>s+Number(e.durationMinutes),0)/durations.length)):'—';
    const root=$('#recent-list');root.classList.toggle('empty-state',!entries.length);root.innerHTML=entries.length?entries.slice(0,4).map(e=>entryRow(e)).join(''):'Ingen anfald registreret endnu.';
  }
  function filteredHistory(){
    const q=$('#history-search').value.trim().toLowerCase(),from=$('#history-from').value,to=$('#history-to').value,intensity=$('#history-intensity').value;
    return sortedEntries().filter(e=>(!from||e.date>=from)&&(!to||e.date<=to)&&(!intensity||String(e.intensity)===intensity)&&(!q||JSON.stringify(e).toLowerCase().includes(q)));
  }
  function renderHistory(){const entries=filteredHistory(),root=$('#history-list');root.classList.toggle('empty-state',!entries.length);root.innerHTML=entries.length?entries.map(e=>entryRow(e,true)).join(''):'Ingen registreringer matcher.';}
  function periodEntries(){const range=$('#insight-range').value,entries=sortedEntries();if(range==='all')return entries;const cutoff=new Date();cutoff.setHours(0,0,0,0);cutoff.setDate(cutoff.getDate()-Number(range)+1);return entries.filter(e=>new Date(`${e.date}T12:00:00`)>=cutoff);}
  function renderInsights(){
    const entries=periodEntries();$('#insight-total').textContent=entries.length;$('#insight-avg-intensity').textContent=entries.length?(entries.reduce((s,e)=>s+e.intensity,0)/entries.length).toFixed(1).replace('.',','):'—';const ds=entries.filter(e=>e.durationMinutes);$('#insight-avg-duration').textContent=ds.length?Math.round(ds.reduce((s,e)=>s+e.durationMinutes,0)/ds.length):'—';$('#insight-sleep').textContent=entries.length?`${Math.round(entries.filter(e=>e.wokeFromSleep==='Ja').length/entries.length*100)}%`:'—';
    const counts=[1,2,3,4,5].map(n=>entries.filter(e=>e.intensity===n).length),max=Math.max(1,...counts);$('#intensity-chart').innerHTML=counts.map((n,i)=>`<div class="bar-column"><i style="height:${n/max*82}%"><b>${n}</b></i><span>${i+1}</span></div>`).join('');
    const triggerCounts={};entries.forEach(e=>e.triggers.filter(t=>t!=='Ingen åbenlyse triggere').forEach(t=>triggerCounts[t]=(triggerCounts[t]||0)+1));const ranks=Object.entries(triggerCounts).sort((a,b)=>b[1]-a[1]).slice(0,6),rankMax=Math.max(1,...ranks.map(x=>x[1]));$('#trigger-chart').innerHTML=ranks.length?ranks.map(([name,n])=>`<div class="rank-row"><span title="${escapeHtml(name)}">${escapeHtml(name)}</span><i><b style="width:${n/rankMax*100}%"></b></i><strong>${n}</strong></div>`).join(''):'<p class="empty-state">Ingen triggerdata i perioden.</p>';
    const now=new Date();const weeks=[];for(let i=11;i>=0;i--){const end=new Date(now);end.setDate(end.getDate()-i*7);const start=new Date(end);start.setDate(start.getDate()-6);const n=entries.filter(e=>{const d=new Date(`${e.date}T12:00:00`);return d>=start&&d<=end}).length;weeks.push({label:new Intl.DateTimeFormat('da-DK',{day:'numeric',month:'short'}).format(end),n});}const weekMax=Math.max(1,...weeks.map(w=>w.n));$('#weekly-chart').innerHTML=weeks.map(w=>`<div class="week-bar" title="${escapeHtml(w.label)}: ${w.n} anfald"><i style="height:${w.n/weekMax*88}%"></i><span>${escapeHtml(w.label)}</span></div>`).join('');
  }
  function renderAll(){if(!vault)return;renderDashboard();renderHistory();renderInsights();hydrateProfile();renderOneDriveState();}

  function showView(name){
    currentView=name;$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));$$('[data-view-target]').forEach(b=>b.classList.toggle('active',b.dataset.viewTarget===name));if(name==='entry'&&!$('#entry-id').value&&$('#attack-date').value==='')resetForm();if(name==='history')renderHistory();if(name==='insights')renderInsights();if(name==='backup')renderOneDriveState();document.title=`${({dashboard:'Overblik',entry:'Nyt anfald',history:'Historik',insights:'Indblik',backup:'Backup',settings:'Indstillinger'})[name]} · Horton Tracker`;$('#main').focus({preventScroll:true});scrollTo({top:0,behavior:'smooth'});
  }
  function hydrateProfile(){if(!vault)return;$('#profile-name').value=vault.profile?.name||'';$('#profile-clinic').value=vault.profile?.clinic||'';}

  async function downloadBackup(){await persistVault();downloadBlob(new Blob([JSON.stringify(vaultEnvelope,null,2)],{type:'application/json'}),`horton-tracker-backup-${todayISO()}.json`);toast('Krypteret backup hentet.');}
  async function restoreFromEnvelope(envelope,sourceLabel='fil'){
    validateEnvelope(envelope);if(!await confirmAction('Gendan backup?','Nuværende lokale data bliver erstattet. Tag eventuelt først en backup.'))return;
    const pass=await requestSecret('Åbn backup','Indtast adgangssætningen til den backup, du vil gendanne.');if(pass===null)return;
    try{const opened=await decryptEnvelope(envelope,pass);vaultEnvelope=envelope;vault=opened.data;sessionKey=opened.key;await dbPut(VAULT_KEY,envelope);renderAll();toast(`Backup fra ${sourceLabel} er gendannet.`);}
    catch{toast('Backuppen kunne ikke dekrypteres. Kontrollér adgangssætningen.','error');}
  }
  async function restoreFile(file){try{const envelope=JSON.parse(await file.text());await restoreFromEnvelope(envelope,'fil');}catch(e){toast(e.message||'Backupfilen kunne ikke læses.','error');}}
  function exportEntriesInRange(){const from=$('#export-from').value,to=$('#export-to').value;return sortedEntries().filter(e=>(!from||e.date>=from)&&(!to||e.date<=to));}
  function csvCell(value){const text=Array.isArray(value)?value.join('; '):String(value??'');return `"${text.replace(/"/g,'""')}"`;}
  function exportCSV(){
    const entries=exportEntriesInRange();if(!entries.length){toast('Ingen registreringer i den valgte periode.','error');return;}
    const headers=['Dato','Starttid','Sluttid','Varighed (min)','Smerteside','Intensitet','Symptomer','Vækket fra søvn','Søvntype','Mulige triggere (sidste 4 timer)','Akut medicin/behandling','Behandlingseffekt','Bemærkninger'];
    const rows=entries.map(e=>[e.date,e.startTime,e.endTime,e.durationMinutes,e.side,e.intensity,e.symptoms,e.wokeFromSleep,e.sleepType,e.triggers,e.treatments,e.treatmentEffect,e.notes]);const text='\ufeff'+[headers,...rows].map(r=>r.map(csvCell).join(';')).join('\r\n');downloadBlob(new Blob([text],{type:'text/csv;charset=utf-8'}),`horton-anfald-${todayISO()}.csv`);toast(`${entries.length} registreringer eksporteret.`);
  }
  function openReport(){
    const entries=exportEntriesInRange();if(!entries.length){toast('Ingen registreringer i den valgte periode.','error');return;}const avgI=(entries.reduce((s,e)=>s+e.intensity,0)/entries.length).toFixed(1).replace('.',','),durations=entries.filter(e=>e.durationMinutes),avgD=durations.length?Math.round(durations.reduce((s,e)=>s+e.durationMinutes,0)/durations.length):'—';const from=entries[entries.length-1].date,to=entries[0].date;const rows=entries.map(e=>`<tr><td>${escapeHtml(formatDate(e.date))}<br><small>${escapeHtml(e.startTime)}–${escapeHtml(e.endTime||'—')}</small></td><td>${escapeHtml(formatDuration(e.durationMinutes))}</td><td>${escapeHtml(e.side)}</td><td class="score">${e.intensity}</td><td>${escapeHtml(e.symptoms.join(', '))}</td><td>${escapeHtml(e.triggers.join(', '))}</td><td>${escapeHtml(e.treatments.join(', '))}<br><small>${escapeHtml(e.treatmentEffect)}</small></td><td>${escapeHtml(e.notes)}</td></tr>`).join('');
    const html=`<!doctype html><html lang="da"><head><meta charset="utf-8"><title>Horton Tracker · Klinikrapport</title><style>@page{size:A4 landscape;margin:12mm}body{font:10pt Arial,sans-serif;color:#102c36;margin:0}header{border-bottom:3px solid #177e78;padding-bottom:10px;margin-bottom:16px;display:flex;justify-content:space-between}h1{font-size:22pt;margin:0}h2{font-size:12pt;margin:3px 0}.meta{color:#536c73;text-align:right}.metrics{display:flex;gap:8px;margin:0 0 14px}.metric{border:1px solid #cbd8d6;padding:8px 12px;border-radius:6px}.metric b{font-size:16pt;display:block}table{border-collapse:collapse;width:100%;font-size:8pt;table-layout:fixed}th,td{border:1px solid #ccd8d7;padding:5px;vertical-align:top;overflow-wrap:anywhere}th{background:#12313c;color:white;text-align:left}.score{font-size:14pt;font-weight:bold;text-align:center}small{color:#536c73}.note{margin-top:12px;color:#536c73;font-size:8pt}@media print{button{display:none}}button{margin:0 0 12px;padding:8px 14px}</style></head><body><button onclick="print()">Udskriv / Gem som PDF</button><header><div><h1>Horton Tracker</h1><h2>Klinikrapport · ${escapeHtml(formatDate(from))} – ${escapeHtml(formatDate(to))}</h2></div><div class="meta">${vault.profile?.name?escapeHtml(vault.profile.name)+'<br>':''}${vault.profile?.clinic?escapeHtml(vault.profile.clinic)+'<br>':''}Oprettet ${escapeHtml(formatDateTime(isoNow()))}</div></header><div class="metrics"><div class="metric"><b>${entries.length}</b>Anfald</div><div class="metric"><b>${avgI}</b>Gns. intensitet</div><div class="metric"><b>${avgD}</b>Gns. varighed (min)</div><div class="metric"><b>${entries.filter(e=>e.wokeFromSleep==='Ja').length}</b>Vækket fra søvn</div></div><table><thead><tr><th>Dato/tid</th><th>Varighed</th><th>Side</th><th>Styrke</th><th>Symptomer</th><th>Mulige triggere</th><th>Behandling / effekt</th><th>Noter</th></tr></thead><tbody>${rows}</tbody></table><p class="note">Patientens egne registreringer. Rapporten er ikke en diagnose eller medicinsk vurdering.</p></body></html>`;
    const w=window.open('','_blank');if(!w){toast('Tillad pop op-vinduer for at åbne rapporten.','error');return;}w.opener=null;w.document.write(html);w.document.close();
  }

  function currentRedirectUri(){return `${location.origin}${location.pathname}`;}
  function getMsConfig(){try{return JSON.parse(localStorage.getItem('horton-ms-config'))||{clientId:'',tenant:'consumers'};}catch{return{clientId:'',tenant:'consumers'};}}
  function saveMsConfig(){const clientId=$('#ms-client-id').value.trim(),tenant=$('#ms-tenant').value;if(clientId&&!/^[0-9a-f-]{36}$/i.test(clientId)){toast('Client ID skal være et GUID på 36 tegn.','error');return;}localStorage.setItem('horton-ms-config',JSON.stringify({clientId,tenant}));renderOneDriveState();toast('OneDrive-opsætning gemt.');}
  function getTokenData(){try{return JSON.parse(sessionStorage.getItem('horton-ms-token'));}catch{return null;}}
  function tokenAccount(token){if(!token?.id_token)return'';try{const payload=JSON.parse(new TextDecoder().decode(base64ToBytes(token.id_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(token.id_token.split('.')[1].length/4)*4,'='))));return payload.name||payload.preferred_username||'';}catch{return'';}}
  async function sha256Base64Url(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return bytesToBase64(digest).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function randomUrlSafe(bytes=48){return bytesToBase64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  async function connectOneDrive(){
    const cfg=getMsConfig();if(!cfg.clientId){showView('settings');toast('Gem først dit Application (client) ID.','error');return;}const verifier=randomUrlSafe(64),state=randomUrlSafe(24),redirectUri=currentRedirectUri();sessionStorage.setItem('horton-oauth-state',JSON.stringify({verifier,state,redirectUri}));const challenge=await sha256Base64Url(verifier);const scope=`openid profile offline_access ${GRAPH_SCOPE}`;const params=new URLSearchParams({client_id:cfg.clientId,response_type:'code',redirect_uri:redirectUri,response_mode:'query',scope,code_challenge:challenge,code_challenge_method:'S256',state,prompt:'select_account'});location.assign(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant)}/oauth2/v2.0/authorize?${params}`);
  }
  async function handleOAuthCallback(){
    const params=new URLSearchParams(location.search);if(!params.has('code')&&!params.has('error'))return;const pending=JSON.parse(sessionStorage.getItem('horton-oauth-state')||'null');history.replaceState({},'',location.pathname+location.hash);if(params.has('error')){toast(`Microsoft-login mislykkedes: ${params.get('error_description')||params.get('error')}`,'error');return;}if(!pending||pending.state!==params.get('state')){toast('Login-svaret kunne ikke valideres. Prøv igen.','error');return;}const cfg=getMsConfig();try{const body=new URLSearchParams({client_id:cfg.clientId,grant_type:'authorization_code',code:params.get('code'),redirect_uri:pending.redirectUri,code_verifier:pending.verifier,scope:`openid profile offline_access ${GRAPH_SCOPE}`});const response=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant)}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const token=await response.json();if(!response.ok)throw new Error(token.error_description||'Tokenudveksling mislykkedes');token.expires_at=Date.now()+token.expires_in*1000;sessionStorage.setItem('horton-ms-token',JSON.stringify(token));sessionStorage.removeItem('horton-oauth-state');showView('backup');renderOneDriveState();toast('Microsoft-konto forbundet.');}catch(e){toast(e.message,'error');}
  }
  async function accessToken(){
    let token=getTokenData();if(!token)throw new Error('Forbind først din Microsoft-konto.');if(Date.now()<token.expires_at-120000)return token.access_token;if(!token.refresh_token)throw new Error('Sessionen er udløbet. Forbind kontoen igen.');const cfg=getMsConfig();const body=new URLSearchParams({client_id:cfg.clientId,grant_type:'refresh_token',refresh_token:token.refresh_token,scope:`openid profile offline_access ${GRAPH_SCOPE}`});const response=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant)}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const next=await response.json();if(!response.ok)throw new Error(next.error_description||'Login-sessionen kunne ikke fornyes.');next.refresh_token=next.refresh_token||token.refresh_token;next.expires_at=Date.now()+next.expires_in*1000;sessionStorage.setItem('horton-ms-token',JSON.stringify(next));return next.access_token;
  }
  async function graphFetch(path,options={}){const token=await accessToken();const headers=new Headers(options.headers||{});headers.set('Authorization',`Bearer ${token}`);const response=await fetch(`${GRAPH_BASE}${path}`,{...options,headers});if(!response.ok){let message=`Microsoft Graph returnerede ${response.status}`;try{const body=await response.json();message=body.error?.message||message;}catch{}throw new Error(message);}return response;}
  async function uploadOneDrive(){try{setStatus('OneDrive…','syncing');await persistVault();const response=await graphFetch(`/me/drive/special/approot:/${CLOUD_FILE}:/content`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(vaultEnvelope)});const item=await response.json();$('#onedrive-meta').textContent=`Seneste backup: ${formatDateTime(item.lastModifiedDateTime||isoNow())}`;setStatus('Gemt lokalt');toast('Krypteret backup gemt i OneDrive.');}catch(e){setStatus('OneDrive-fejl','error');toast(e.message,'error');}}
  async function restoreOneDrive(){try{const response=await graphFetch(`/me/drive/special/approot:/${CLOUD_FILE}:/content`);const envelope=await response.json();await restoreFromEnvelope(envelope,'OneDrive');}catch(e){toast(e.message,'error');}}
  function disconnectOneDrive(){sessionStorage.removeItem('horton-ms-token');renderOneDriveState();toast('Microsoft-sessionen er afbrudt.');}
  async function refreshCloudMetadata(){try{const response=await graphFetch(`/me/drive/special/approot:/${CLOUD_FILE}`);const item=await response.json();$('#onedrive-meta').textContent=`Seneste backup: ${formatDateTime(item.lastModifiedDateTime)}`;}catch(e){if(!String(e.message).includes('404'))$('#onedrive-meta').textContent='Kunne ikke hente backupstatus.';}}
  function renderOneDriveState(){
    const cfg=getMsConfig(),token=getTokenData(),connected=!!token;$('#ms-client-id').value=cfg.clientId||'';$('#ms-tenant').value=cfg.tenant||'consumers';$('#redirect-uri').textContent=currentRedirectUri();const state=$('#onedrive-state');state.classList.toggle('connected',connected);$('span',state).textContent=connected?`Forbundet${tokenAccount(token)?` som ${tokenAccount(token)}`:''}`:'Ikke forbundet';$('#onedrive-connect').hidden=connected;$('#onedrive-disconnect').hidden=!connected;$('#onedrive-actions').hidden=!connected;$('#onedrive-meta').textContent=connected?'Backupstatus hentes, når du åbner siden.':cfg.clientId?'Klar til at forbinde.':'Kræver opsætning under Indstillinger.';if(connected&&currentView==='backup')refreshCloudMetadata();
  }

  async function changePassphrase(){
    const old=await requestSecret('Bekræft adgangssætning','Indtast din nuværende adgangssætning.');if(old===null)return;try{await decryptEnvelope(vaultEnvelope,old);}catch{toast('Den nuværende adgangssætning er forkert.','error');return;}const next=await requestSecret('Ny adgangssætning','Vælg og gentag en ny adgangssætning på mindst 10 tegn.',true);if(next===null)return;const salt=crypto.getRandomValues(new Uint8Array(16));sessionKey=await deriveKey(next,salt);vaultEnvelope=await encryptVault(vault,sessionKey,salt);await dbPut(VAULT_KEY,vaultEnvelope);toast('Adgangssætningen er ændret. Tag en ny backup.');
  }
  function confirmAction(title,message){return new Promise(resolve=>{confirmResolver=resolve;$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;$('#confirm-dialog').showModal();});}

  function bindEvents(){
    document.addEventListener('click',e=>{const target=e.target.closest('[data-view-target]');if(target){if(target.dataset.viewTarget==='entry'&&currentView!=='entry')resetForm();showView(target.dataset.viewTarget);}});
    $$('[data-duration-mode]').forEach(b=>b.addEventListener('click',()=>setDurationMode(b.dataset.durationMode)));
    ['start-time','end-time','duration-input'].forEach(id=>$(`#${id}`).addEventListener('input',updateDuration));
    $('#attack-form').addEventListener('input',e=>{if(e.target.id==='notes')$('#notes-count').textContent=e.target.value.length;if(e.target.name==='intensity')$('#intensity-description').textContent=INTENSITY_TEXT[e.target.value];updateProgress();});
    $('#attack-form').addEventListener('change',e=>{if(e.target.name==='wokeFromSleep'){const yes=e.target.value==='Ja';$('#sleep-type-wrap').hidden=!yes;if(!yes)$('#sleep-type').value='';}if(e.target.name==='treatments'&&e.target.value==='Tog ingen medicin'&&e.target.checked)$('#treatment-effect').value='Ikke relevant (tog ikke medicin)';updateProgress();});
    $('#attack-form').addEventListener('submit',submitEntry);$('#cancel-entry').addEventListener('click',()=>{resetForm();showView('dashboard');});
    $('#history-list').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit)editEntry(edit.dataset.edit);if(del)deleteEntry(del.dataset.delete);});
    ['history-search','history-from','history-to','history-intensity'].forEach(id=>$(`#${id}`).addEventListener('input',renderHistory));$('#insight-range').addEventListener('change',renderInsights);
    $('#download-backup').addEventListener('click',downloadBackup);$('#restore-file').addEventListener('change',e=>{if(e.target.files[0])restoreFile(e.target.files[0]);e.target.value='';});$('#export-csv').addEventListener('click',exportCSV);$('#export-report').addEventListener('click',openReport);
    $('#save-profile').addEventListener('click',async()=>{vault.profile={...(vault.profile||{}),name:$('#profile-name').value.trim(),clinic:$('#profile-clinic').value.trim()};await persistVault();toast('Profil gemt krypteret.');});$('#change-passphrase').addEventListener('click',changePassphrase);
    $('#save-ms-config').addEventListener('click',saveMsConfig);$('#copy-redirect').addEventListener('click',async()=>{await navigator.clipboard.writeText(currentRedirectUri());toast('Redirect-URI kopieret.');});$('#onedrive-connect').addEventListener('click',connectOneDrive);$('#onedrive-disconnect').addEventListener('click',disconnectOneDrive);$('#onedrive-upload').addEventListener('click',uploadOneDrive);$('#onedrive-restore').addEventListener('click',restoreOneDrive);
    $('#delete-all').addEventListener('click',async()=>{if(!await confirmAction('Slet alle lokale data?','Alle registreringer, profil og den lokale krypterede boks slettes permanent.'))return;await dbDelete(VAULT_KEY);vault=null;sessionKey=null;location.reload();});
    $('#lock-button').addEventListener('click',lockApp);$('#confirm-dialog').addEventListener('close',()=>{if(confirmResolver){confirmResolver($('#confirm-dialog').returnValue==='ok');confirmResolver=null;}});
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;$('#install-button').hidden=false;});$('#install-button').addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('#install-button').hidden=true;});window.addEventListener('appinstalled',()=>toast('Horton Tracker er installeret.'));
  }

  async function init(){
    if(!window.crypto?.subtle||!window.indexedDB){document.body.innerHTML='<main style="margin:3rem"><h1>Browseren understøttes ikke</h1><p>Horton Tracker kræver Web Crypto og IndexedDB. Brug en opdateret browser via HTTPS.</p></main>';return;}
    setupQuestionnaire();bindEvents();$('#attack-date').value=todayISO();$('#redirect-uri').textContent=currentRedirectUri();
    try{db=await openDatabase();await unlockApp();}catch(e){console.error(e);toast('Appen kunne ikke starte: '+e.message,'error');}
    if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker:',err));
  }
  init();
})();
