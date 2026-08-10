/* Pacefold 25.0.0 cleanroom-r1 compatibility consolidation. */
(() => {
'use strict';

const VERSION='25.0.0';
const ROOT_ID='pf25-root';
const SETUP_SELECTORS=[
  '[data-view="setup"]','[data-screen="setup"]','[data-step="setup"]',
  '[data-onboarding]','[data-onboard-profile]','.onboarding','.onboarding-option',
  '#setup','.setup','.setup-screen','.setup-wizard'
];
const SETUP_SELECTOR=SETUP_SELECTORS.join(',');
let preservedRoot=null;
let frame=0;
let wasSetup=false;
let setupExitTimer=0;
let setupExitEpoch=-1;
let setupEpoch=0;

function installBadgePolicy(){
  if(window.__PACEFOLD_BADGE_POLICY__)return;
  const originalSet=typeof navigator.setAppBadge==='function'?navigator.setAppBadge.bind(navigator):null;
  const originalClear=typeof navigator.clearAppBadge==='function'?navigator.clearAppBadge.bind(navigator):null;
  const flag=async()=>{try{return await originalSet?.();}catch{return undefined;}};
  const clear=async()=>{try{return await originalClear?.();}catch{return undefined;}};
  if(originalSet){
    try{Object.defineProperty(navigator,'setAppBadge',{configurable:true,writable:true,value:flag});}
    catch{try{navigator.setAppBadge=flag;}catch{}}
  }
  window.__PACEFOLD_BADGE_POLICY__={version:VERSION,flag,clear};
}
function visible(element){
  if(!element?.isConnected)return false;
  const style=getComputedStyle(element);
  const box=element.getBoundingClientRect();
  return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&box.width>0&&box.height>0;
}
function setupTextPanelVisible(){
  const candidates=[...document.querySelectorAll('[role="dialog"],body>main,body>section')].filter(visible);
  return candidates.some(node=>{
    const box=node.getBoundingClientRect();
    if(box.width<280||box.height<160)return false;
    const text=(node.textContent||'').replace(/\s+/g,' ').trim().slice(0,1400);
    if(!/(set up pacefold|welcome to pacefold|choose your rhythm|complete setup)/i.test(text))return false;
    return [...node.querySelectorAll('button,[role="button"]')].some(control=>/(get started|continue|complete setup|finish|next)/i.test((control.textContent||'').trim()));
  });
}
function setupVisible(){
  if(SETUP_SELECTORS.some(selector=>[...document.querySelectorAll(selector)].some(visible)))return true;
  return setupTextPanelVisible();
}
function clearSetupExitTimer(){
  if(setupExitTimer)clearTimeout(setupExitTimer);
  setupExitTimer=0;
  setupExitEpoch=-1;
}
function removeForSetup(current){
  wasSetup=true;
  setupEpoch+=1;
  clearSetupExitTimer();
  preservedRoot=null;
  current?.remove();
  document.documentElement.classList.remove('pf25-mounted');
}
function maskLegacyFalsePositives(callback){
  const masked=[];
  for(const node of document.querySelectorAll('main,section,[role="dialog"]')){
    if(!visible(node)||node.closest(`#${ROOT_ID}`)||node.matches(SETUP_SELECTOR)||node.querySelector(SETUP_SELECTOR))continue;
    const text=(node.textContent||'').replace(/\s+/g,' ').trim().slice(0,1400);
    if(!/get started/i.test(text)||/(set up pacefold|welcome to pacefold|choose your rhythm|complete setup)/i.test(text))continue;
    masked.push({node,hidden:node.hidden,ariaHidden:node.getAttribute('aria-hidden')});
    node.hidden=true;
    node.setAttribute('aria-hidden','true');
  }
  try{callback();}
  finally{
    queueMicrotask(()=>{
      for(const item of masked){
        if(!item.node.isConnected)continue;
        item.node.hidden=item.hidden;
        if(item.ariaHidden==null)item.node.removeAttribute('aria-hidden');
        else item.node.setAttribute('aria-hidden',item.ariaHidden);
      }
    });
  }
}
function requestFreshSurface(){
  maskLegacyFalsePositives(()=>window.__PACEFOLD_SURFACE__?.reconcile?.());
}
function nudgeFreshSurface(epoch){
  for(const delay of [0,80,240,700,1600]){
    setTimeout(()=>{
      if(epoch!==setupEpoch||setupVisible()||document.getElementById(ROOT_ID))return;
      requestFreshSurface();
    },delay);
  }
}
function restoreAfterStableSetupExit(epoch){
  if(setupExitTimer&&setupExitEpoch===epoch)return;
  clearSetupExitTimer();
  setupExitEpoch=epoch;
  setupExitTimer=setTimeout(()=>{
    setupExitTimer=0;
    setupExitEpoch=-1;
    if(epoch!==setupEpoch||setupVisible())return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(epoch!==setupEpoch||setupVisible())return;
      wasSetup=false;
      preservedRoot=null;
      nudgeFreshSurface(epoch);
    }));
  },240);
}
function reconcile(){
  frame=0;
  const setup=setupVisible();
  const current=document.getElementById(ROOT_ID);
  if(setup){removeForSetup(current);return;}
  if(wasSetup){restoreAfterStableSetupExit(setupEpoch);return;}
  clearSetupExitTimer();
  const roots=[...document.querySelectorAll(`#${ROOT_ID}`)];
  if(roots.length>1){
    const keeper=roots[0];
    for(const duplicate of roots.slice(1))duplicate.remove();
    preservedRoot=keeper;
    document.documentElement.classList.add('pf25-mounted');
    return;
  }
  if(current){
    preservedRoot=current;
    document.documentElement.classList.add('pf25-mounted');
    return;
  }
  if(preservedRoot?.isConnected)return;
  if(preservedRoot&&document.body){
    document.body.append(preservedRoot);
    document.documentElement.classList.add('pf25-mounted');
    return;
  }
  requestFreshSurface();
}
function mutationInsideRootOnly(mutations){
  return mutations.length>0&&mutations.every(mutation=>{
    const target=mutation.target instanceof Element?mutation.target:mutation.target?.parentElement;
    if(!target?.closest?.(`#${ROOT_ID}`))return false;
    const changed=[...(mutation.addedNodes||[]),...(mutation.removedNodes||[])];
    return changed.every(node=>!(node instanceof Element)||node.id!==ROOT_ID);
  });
}
function queue(mutations=[]){
  if(mutationInsideRootOnly(mutations))return;
  if(frame)return;
  frame=requestAnimationFrame(reconcile);
}

installBadgePolicy();
new MutationObserver(queue).observe(document.documentElement,{
  childList:true,
  subtree:true,
  attributes:true,
  attributeFilter:['class','hidden','aria-hidden','data-view','data-screen','data-step','data-onboarding','data-onboard-profile']
});
window.addEventListener('pageshow',queue);
window.addEventListener('focus',queue);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue();});
[0,100,400,1400].forEach(delay=>setTimeout(reconcile,delay));
window.__PACEFOLD_GUARDIAN__={version:VERSION,setupVisible,reconcile};
})();
;
(() => {
'use strict';

const VERSION='25.0.0';
const ENTRY_KEY='pacefold.notebook.entries.v2';
const ERROR_KEY='pacefold.resilience.errors.v1';
const RECOVERY_PREFIX='pacefold.recovery.notebook.';
const RECOVERY_NOTICE='pacefold.resilience.recoveryNotice.v1';
const GLOBAL_SYNC_LOCK='pacefold.resilience.lock.sync-page.v1';
const TAB_ID=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ONE_NOTE_WRAPPED=Symbol.for('pacefold.resilience.onenote.wrapped');
const LOCKS={
  'sync-page':30000,
  'load-stream':1400,
  'save-edit':1200,
  'delete-entry':1200,
  'complete-entry':900,
  'handle-cue':1200,
  'copy-page':900,
  'share-page':1400
};
const clickLocks=new Map();
const submitLocks=new WeakMap();
const inFlightSyncs=new Map();
let reconcileFrame=0;
let adapterPoll=0;

function safeParse(raw,fallback){
  if(raw==null||raw==='')return fallback;
  try{return JSON.parse(raw);}catch{return fallback;}
}
function compactMessage(value){
  return String(value?.message||value||'Unknown Pacefold error')
    .replace(/https?:\/\/\S+/g,'[url]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]')
    .replace(/(?:bearer|token|secret|password|code)=?[^\s&]+/gi,'[credential]')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,320);
}
function journalFrom(storage){
  try{
    const current=safeParse(storage.getItem(ERROR_KEY),[]);
    return Array.isArray(current)?current:[];
  }catch{return [];}
}
function writeJournal(list){
  const encoded=JSON.stringify(list.slice(-20));
  try{localStorage.setItem(ERROR_KEY,encoded);return 'localStorage';}
  catch{try{sessionStorage.setItem(ERROR_KEY,encoded);return 'sessionStorage';}catch{return 'none';}}
}
function recordError(kind,error){
  const message=compactMessage(error);
  const normalizedKind=String(kind||'runtime').slice(0,40);
  try{
    const local=journalFrom(localStorage);
    const session=journalFrom(sessionStorage);
    const list=(local.length?local:session).slice(-20);
    const now=Date.now();
    const previous=list[list.length-1];
    if(previous&&previous.kind===normalizedKind&&previous.message===message&&now-Date.parse(previous.lastAt||previous.at)<60000){
      previous.count=Math.min(999,Number(previous.count||1)+1);
      previous.lastAt=new Date(now).toISOString();
      previous.version=VERSION;
    }else{
      list.push({at:new Date(now).toISOString(),lastAt:new Date(now).toISOString(),count:1,kind:normalizedKind,message,version:VERSION});
    }
    writeJournal(list);
  }catch{}
}
function recoveryKeys(storage){
  const keys=[];
  try{
    for(let index=0;index<storage.length;index+=1){
      const key=storage.key(index);
      if(key?.startsWith(RECOVERY_PREFIX))keys.push(key);
    }
  }catch{}
  return keys.sort();
}
function pruneRecoveries(){
  for(const storage of [localStorage,sessionStorage]){
    const keys=recoveryKeys(storage);
    for(const key of keys.slice(0,-3)){try{storage.removeItem(key);}catch{}}
  }
}
function storeRecovery(key,raw){
  try{localStorage.setItem(key,raw);return 'localStorage';}
  catch{try{sessionStorage.setItem(key,raw);return 'sessionStorage';}catch{return 'none';}}
}
function writeRecoveryNotice(notice){
  const encoded=JSON.stringify(notice);
  try{localStorage.setItem(RECOVERY_NOTICE,encoded);return;}
  catch{try{sessionStorage.setItem(RECOVERY_NOTICE,encoded);}catch{}}
}
function backupCorruptNotebook(raw,reason){
  const suffix=new Date().toISOString().replace(/[:.]/g,'-');
  const key=`${RECOVERY_PREFIX}${suffix}`;
  const location=storeRecovery(key,raw);
  const backedUp=location!=='none';
  if(backedUp){
    try{localStorage.removeItem(ENTRY_KEY);}catch(error){recordError('notebook-remove',error);}
  }else{
    recordError('notebook-recovery-full',new Error(`Notebook recovery could not be stored: ${reason}`));
  }
  writeRecoveryNotice({key:backedUp?key:null,location,reason,backedUp,preservedOriginal:!backedUp,at:new Date().toISOString(),version:VERSION});
  pruneRecoveries();
}
function validateNotebookStorage(){
  let raw;
  try{raw=localStorage.getItem(ENTRY_KEY);}catch(error){recordError('storage-read',error);return;}
  if(raw==null||raw==='')return;
  if(raw.length>8_000_000){backupCorruptNotebook(raw,'Notebook data exceeded the safe recovery limit');return;}
  let parsed;
  try{parsed=JSON.parse(raw);}catch{backupCorruptNotebook(raw,'Invalid JSON');return;}
  if(!Array.isArray(parsed)){backupCorruptNotebook(raw,'Notebook data was not an array');return;}
  if(parsed.length>5000){backupCorruptNotebook(raw,'Notebook contained too many entries');return;}
  const valid=parsed.every(item=>item&&typeof item==='object'&&typeof item.body==='string'&&item.body.length<=100000);
  if(!valid){backupCorruptNotebook(raw,'Notebook entries failed schema validation');return;}
  let changed=false;
  const normalized=parsed.map(item=>{
    const next={...item};
    if(typeof next.section!=='string'||!next.section.trim()){next.section='Daily';changed=true;}
    if(typeof next.id!=='string'||!next.id.trim()){next.id=globalThis.crypto?.randomUUID?.()||`recovered-${Date.now()}-${Math.random().toString(36).slice(2)}`;changed=true;}
    return next;
  });
  if(changed){try{localStorage.setItem(ENTRY_KEY,JSON.stringify(normalized));}catch(error){recordError('notebook-normalize',error);}}
}
function queueReconcile(){
  if(reconcileFrame)return;
  reconcileFrame=requestAnimationFrame(()=>{
    reconcileFrame=0;
    try{
      window.dispatchEvent(new CustomEvent('pacefold:storage-changed'));
      window.__PACEFOLD_SURFACE__?.reconcile?.();
    }catch(error){recordError('reconcile',error);}
  });
}
function streamFingerprint(element){
  const root=element.closest('#pf25-root')||document;
  const input=root.querySelector('[data-pf-stream-url]');
  const selected=root.querySelector('[role="tab"][aria-selected="true"], [data-pf-provider].is-active, [data-pf-provider][aria-pressed="true"]');
  return `${(selected?.dataset?.pfProvider||selected?.textContent||'provider').trim().toLowerCase()}:${(input?.value||'').trim()}`;
}
function actionKey(element){
  const action=element?.dataset?.pfAction;
  if(!action)return '';
  if(action==='load-stream')return `${action}:${streamFingerprint(element)}`;
  const id=element.dataset.pfId||element.closest('[data-pf-id]')?.dataset.pfId||'';
  return `${action}:${id}`;
}
function globalSyncLocked(now){
  try{
    const lock=safeParse(localStorage.getItem(GLOBAL_SYNC_LOCK),null);
    if(!lock)return false;
    const until=Number(lock.until)||0;
    const startedAt=Number(lock.startedAt)||until-LOCKS['sync-page'];
    if(until<=now||now-startedAt>60000){localStorage.removeItem(GLOBAL_SYNC_LOCK);return false;}
    return lock.owner!==TAB_ID;
  }catch{return false;}
}
function claimGlobalSyncLock(until){
  try{localStorage.setItem(GLOBAL_SYNC_LOCK,JSON.stringify({owner:TAB_ID,startedAt:Date.now(),until}));}catch{}
}
function releaseGlobalSyncLock(){
  try{
    const lock=safeParse(localStorage.getItem(GLOBAL_SYNC_LOCK),null);
    if(lock?.owner===TAB_ID)localStorage.removeItem(GLOBAL_SYNC_LOCK);
  }catch{}
}
function clearAction(action){
  for(const key of [...clickLocks.keys()])if(key===action||key.startsWith(`${action}:`))clickLocks.delete(key);
  if(action==='sync-page')releaseGlobalSyncLock();
  document.querySelectorAll(`#pf25-root [data-pf-action="${action}"]`).forEach(control=>{
    control.removeAttribute('aria-busy');
    control.classList.remove('pf25-busy');
  });
}
function block(event){event.preventDefault();event.stopImmediatePropagation();}
function lockAction(event){
  const target=event.target;
  if(!(target instanceof Element))return;
  const control=target.closest('[data-pf-action]');
  if(!control)return;
  const action=control.dataset.pfAction;
  const duration=LOCKS[action];
  if(!duration)return;
  const key=actionKey(control);
  const now=Date.now();
  const until=clickLocks.get(key)||0;
  if(until>now){block(event);return;}
  if(action==='sync-page'&&globalSyncLocked(now)){
    block(event);
    control.title='This notebook page is already syncing in another Pacefold window.';
    return;
  }
  const expires=now+duration;
  clickLocks.set(key,expires);
  if(action==='sync-page')claimGlobalSyncLock(expires);
  queueMicrotask(()=>{
    if(!control.isConnected)return;
    control.setAttribute('aria-busy','true');
    control.classList.add('pf25-busy');
  });
  setTimeout(()=>{
    if(clickLocks.get(key)<=Date.now())clickLocks.delete(key);
    if(action==='sync-page')releaseGlobalSyncLock();
    if(control.isConnected){
      control.removeAttribute('aria-busy');
      control.classList.remove('pf25-busy');
      if(control.title==='This notebook page is already syncing in another Pacefold window.')control.removeAttribute('title');
    }
  },duration+30);
}
function lockSubmit(event){
  const form=event.target;
  if(!(form instanceof HTMLFormElement)||!form.matches('[data-pf-capture-form]'))return;
  const now=Date.now();
  const until=submitLocks.get(form)||0;
  if(until>now){block(event);return;}
  submitLocks.set(form,now+1000);
}
function syncFingerprint(payload){
  const text=`${payload?.notebook||''}|${payload?.section||''}|${payload?.title||''}|${payload?.html||payload?.text||''}`;
  let hash=2166136261;
  for(let index=0;index<text.length;index+=1){hash^=text.charCodeAt(index);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(36);
}
function installOneNoteGuard(){
  const adapter=window.PacefoldOneNote;
  if(!adapter||typeof adapter.syncPage!=='function'||adapter[ONE_NOTE_WRAPPED])return false;
  const original=adapter.syncPage.bind(adapter);
  adapter.syncPage=function guardedSyncPage(payload){
    const fingerprint=syncFingerprint(payload);
    if(inFlightSyncs.has(fingerprint))return inFlightSyncs.get(fingerprint);
    let timeoutId=0;
    const timeout=new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(new Error('Pacefold OneNote sync timed out after 25 seconds.')),25000);});
    const task=Promise.race([Promise.resolve().then(()=>original(payload)),timeout])
      .catch(error=>{recordError('onenote-sync',error);throw error;})
      .finally(()=>{clearTimeout(timeoutId);inFlightSyncs.delete(fingerprint);clearAction('sync-page');});
    inFlightSyncs.set(fingerprint,task);
    return task;
  };
  try{Object.defineProperty(adapter,ONE_NOTE_WRAPPED,{configurable:true,value:VERSION});}catch{adapter[ONE_NOTE_WRAPPED]=VERSION;}
  return true;
}
function pollForOneNoteAdapter(){
  if(installOneNoteGuard()){if(adapterPoll){clearInterval(adapterPoll);adapterPoll=0;}return;}
  if(adapterPoll)return;
  let attempts=0;
  adapterPoll=setInterval(()=>{
    attempts+=1;
    if(installOneNoteGuard()||attempts>=120){clearInterval(adapterPoll);adapterPoll=0;}
  },500);
}
function relevantError(value){
  const text=String(value?.stack||value?.message||value||'');
  return /pacefold|pf25-root|pf-notebook|pf25-diagnostics/i.test(text);
}

validateNotebookStorage();
pruneRecoveries();
pollForOneNoteAdapter();
document.addEventListener('click',lockAction,true);
document.addEventListener('submit',lockSubmit,true);
window.addEventListener('error',event=>{if(relevantError(event.error||event.message))recordError('error',event.error||event.message);});
window.addEventListener('unhandledrejection',event=>{if(relevantError(event.reason))recordError('rejection',event.reason);});
window.addEventListener('online',queueReconcile);
window.addEventListener('pageshow',()=>{queueReconcile();pollForOneNoteAdapter();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){queueReconcile();pollForOneNoteAdapter();}});
window.addEventListener('storage',event=>{if(event.key===ENTRY_KEY||event.key===ERROR_KEY||event.key===GLOBAL_SYNC_LOCK)queueReconcile();});

window.__PACEFOLD_DIAGNOSTICS__={version:VERSION,validateNotebookStorage,queueReconcile,recordError,installOneNoteGuard,clearAction};
})();
;
(()=>{if(window.__PACEFOLD_SET_HTML__)return;window.__PACEFOLD_SET_HTML__=(node,value)=>{if(!node)return node;const html=window.__PACEFOLD_TRUSTED_HTML__?window.__PACEFOLD_TRUSTED_HTML__(String(value)):String(value);Reflect.set(node,'innerHTML',html);return node;};})();
(() => {
'use strict';

const VERSION = '25.0.0';
const ROOT_ID = 'pf25-root';
const DB_NAME = 'pacefold-resilience';
const DB_STORE = 'snapshots';
const SETUP_SNAPSHOT = 'configured-local-state';
const GRAPH_SCOPES = ['Notes.Create', 'Notes.ReadWrite'];
const MAX_ENTRY = 8000;
const KEYS = Object.freeze({
  entries: 'pacefold.notebook.entries.v2',
  legacy: 'pacefold.hub.captures.v1',
  prefs: 'pacefold.notebook.preferences.v2',
  player: 'pacefold.player.preferences.v2',
  sync: 'pacefold.notebook.sync.v2',
  badge: 'pacefold.hub.badge.v1',
  weather: 'pacefold.surface.weather.v1',
  errors: 'pacefold.surface.errors.v2'
});
const SECTIONS = ['Daily', 'Follow-ups', 'Incidents', 'Inspections', 'JHSC', 'Construction', 'Notifications', 'Resources'];
const PROVIDERS = Object.freeze({
  local: { label: 'Local audio', icon: 'music' },
  youtube: { label: 'YouTube Music', icon: 'youtube' },
  spotify: { label: 'Spotify', icon: 'spotify' },
  amazon: { label: 'Amazon Music', icon: 'amazon' }
});
const ACTIONS = new Set([
  'open-notebook','open-player','open-weather','open-system','close-sheet','handle-cue',
  'save-entry','select-date','select-section','search-notebook','clear-search','edit-entry',
  'save-edit','cancel-edit','toggle-entry','delete-entry','copy-page','share-page','sync-page',
  'toggle-live-sync','provider','load-stream','choose-local','play','volume','retry-amazon',
  'copy-amazon','refresh-weather','clear-errors'
]);

if (window.__PACEFOLD_ENGINE_BOOTED__) return;
window.__PACEFOLD_ENGINE_BOOTED__ = true;

const state = {
  mounted: false,
  entries: [],
  prefs: {
    activeDate: localDate(),
    activeSection: 'Daily',
    query: '',
    liveSync: false,
    oneNoteNotebook: 'Pacefold',
    oneNoteSection: 'Pacefold',
    ...readJson(KEYS.prefs, {})
  },
  player: {
    provider: 'local',
    volume: .62,
    youtube: '',
    spotify: '',
    amazon: '',
    ...readJson(KEYS.player, {})
  },
  syncQueue: readJson(KEYS.sync, []),
  weather: readCache(KEYS.weather, 20 * 60 * 1000),
  errors: readJson(KEYS.errors, []).slice(0, 25),
  drawer: null,
  editingId: null,
  currentCue: null,
  audioUrl: '',
  observer: null,
  cueFrame: 0,
  setupFrame: 0,
  weatherRequest: null,
  toastTimer: 0
};

const nativeBadge = {
  set: typeof navigator.setAppBadge === 'function' ? navigator.setAppBadge.bind(navigator) : null,
  clear: typeof navigator.clearAppBadge === 'function' ? navigator.clearAppBadge.bind(navigator) : null
};

function localDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
function nowIso() { return new Date().toISOString(); }
function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (error) { recordError('storage', error); return false; }
}
function readCache(key, ttl) {
  const value = readJson(key, null);
  return value && Date.now() - Number(value.savedAt || 0) < ttl ? value.data : null;
}
function writeCache(key, data) { writeJson(key, { savedAt: Date.now(), data }); }
function esc(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function clamp(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function formatDay(date) {
  return new Intl.DateTimeFormat(undefined, { weekday:'short', month:'short', day:'numeric' }).format(new Date(`${date}T12:00:00`));
}
function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour:'numeric', minute:'2-digit' }).format(new Date(value));
}
function icon(name, extra = '') {
  const paths = {
    fold:'<path d="m4 7 8-4 8 5-3 12-6 2-7-7Z"/><path d="m4 7 7 5 9-4M11 12v10m0-10-7 3m7-3 6 8"/>',
    book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22Z"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    play:'<path d="m8 5 11 7-11 7Z"/>',
    pause:'<path d="M9 5v14M15 5v14"/>',
    music:'<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    youtube:'<path d="M21 8.3a3 3 0 0 0-2.1-2.1C17 5.7 12 5.7 12 5.7s-5 0-6.9.5A3 3 0 0 0 3 8.3 31 31 0 0 0 2.5 12 31 31 0 0 0 3 15.7a3 3 0 0 0 2.1 2.1c1.9.5 6.9.5 6.9.5s5 0 6.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-3.7 31 31 0 0 0-.5-3.7Z"/><path d="m10 15 5-3-5-3Z"/>',
    spotify:'<circle cx="12" cy="12" r="9"/><path d="M7 9c3.8-1.1 7.5-.7 10.5.9M7.8 12.3c3.2-.8 6.3-.4 8.8.8M8.6 15.3c2.5-.5 4.9-.2 6.8.7"/>',
    amazon:'<path d="M7 16c4 3 9 3 13 0M18 15l2 1-1 2"/><path d="M9 14V8c0-2 1-3 3-3s3 1 3 3v6M9 10h6"/>',
    folder:'<path d="M3 6h7l2 2h9v11H3z"/>',
    volume:'<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
    mute:'<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="m17 9 5 5M22 9l-5 5"/>',
    weather:'<path d="M17.5 19H6a4 4 0 0 1-.5-8A6 6 0 0 1 17 9a5 5 0 0 1 .5 10Z"/>',
    shield:'<path d="M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6Z"/><path d="m8 12 3 3 5-6"/>',
    refresh:'<path d="M20 6v5h-5"/><path d="M19 11a8 8 0 1 0 1 5"/>',
    trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
    send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
    sync:'<path d="M20 7h-5V2"/><path d="M20 7a8 8 0 0 0-14-2M4 17h5v5"/><path d="M4 17a8 8 0 0 0 14 2"/>',
    edit:'<path d="M12 20h9"/><path d="m16.5 3.5 4 4L8 20l-5 1 1-5Z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    external:'<path d="M14 3h7v7M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
    warning:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.6 17.3A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.7L13.7 3.9a2 2 0 0 0-3.4 0Z"/>'
  };
  return `<svg class="pf-icon ${extra}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.fold}</svg>`;
}

function recordError(scope, error) {
  state.errors.unshift({ scope, message:String(error?.message || error || 'Unknown error').slice(0,420), at:nowIso() });
  state.errors = state.errors.slice(0,25);
  try { localStorage.setItem(KEYS.errors, JSON.stringify(state.errors)); } catch {}
  updateHealth();
}
function safe(fn, scope = 'action') {
  return async (...args) => {
    try { return await fn(...args); }
    catch (error) { recordError(scope, error); toast('That action failed. Your notebook data is still local and safe.'); }
  };
}
function toast(message) {
  document.querySelector('.pf-toast')?.remove();
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  const node = document.createElement('div');
  node.className = 'pf-toast';
  node.role = 'status';
  node.textContent = message;
  root.append(node);
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => node.remove(), 3600);
}

function setupVisible() {
  const selectors = [
    '[data-view="setup"]','[data-screen="setup"]','[data-step="setup"]',
    '#setup','.setup','.setup-screen','.setup-wizard','.onboarding','[data-onboarding]',
    '.onboarding-option','[data-onboard-profile]','[data-onboard-step]'
  ];
  if (selectors.some(selector => [...document.querySelectorAll(selector)].some(visible))) return true;
  const candidates = [...document.querySelectorAll('main,section,[role="dialog"]')].filter(visible);
  return candidates.some(node => {
    const text = (node.textContent || '').replace(/\s+/g,' ').trim().slice(0,1200);
    return /(set up pacefold|welcome to pacefold|choose your rhythm|complete setup)/i.test(text);
  });
}
function visible(element) {
  if (!element?.isConnected) return false;
  const style = getComputedStyle(element);
  const box = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && box.width > 0 && box.height > 0;
}
function configuredStatePresent() {
  return Object.keys(localStorage).some(key =>
    /^pacefold/i.test(key) &&
    ![KEYS.badge, KEYS.errors].includes(key) &&
    String(localStorage.getItem(key) || '').length > 2
  );
}
async function openDb() {
  if (!('indexedDB' in window)) return null;
  return new Promise(resolve => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}
async function dbGet(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    const request = db.transaction(DB_STORE,'readonly').objectStore(DB_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}
async function dbPut(key, value) {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction(DB_STORE,'readwrite');
    tx.objectStore(DB_STORE).put(value,key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}
async function snapshotConfiguredState() {
  if (!configuredStatePresent() || setupVisible()) return false;
  const snapshot = {};
  for (const key of Object.keys(localStorage)) {
    if (/^pacefold/i.test(key) && key !== KEYS.badge && key !== KEYS.errors) snapshot[key] = localStorage.getItem(key);
  }
  if (!Object.keys(snapshot).length) return false;
  return dbPut(SETUP_SNAPSHOT, { savedAt:nowIso(), values:snapshot });
}
async function restoreConfiguredState() {
  if (!setupVisible() || configuredStatePresent() || sessionStorage.getItem('pacefold.setup.restore-attempted') === '1') return false;
  const snapshot = await dbGet(SETUP_SNAPSHOT);
  if (!snapshot?.values || !Object.keys(snapshot.values).length) return false;
  sessionStorage.setItem('pacefold.setup.restore-attempted','1');
  for (const [key,value] of Object.entries(snapshot.values)) {
    if (typeof value === 'string') localStorage.setItem(key,value);
  }
  location.reload();
  return true;
}

function normalizeEntry(item) {
  if (!item || typeof (item.body ?? item.text) !== 'string') return null;
  const body = String(item.body ?? item.text).trim().slice(0,MAX_ENTRY);
  if (!body) return null;
  const createdAt = item.createdAt || nowIso();
  return {
    id:String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`),
    body,
    section:SECTIONS.includes(item.section) ? item.section : inferSection(item.type, body),
    date:/^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date : localDate(createdAt),
    createdAt,
    updatedAt:item.updatedAt || createdAt,
    done:Boolean(item.done),
    oneNoteSyncedAt:item.oneNoteSyncedAt || null
  };
}
function inferSection(type, body) {
  const value = `${type || ''} ${body}`.toLowerCase();
  if (/incident|accident/.test(value)) return 'Incidents';
  if (/inspection/.test(value)) return 'Inspections';
  if (/jhsc/.test(value)) return 'JHSC';
  if (/construction/.test(value)) return 'Construction';
  if (/notification|alert/.test(value)) return 'Notifications';
  if (/follow.?up|task|todo/.test(value)) return 'Follow-ups';
  if (/resource|link/.test(value)) return 'Resources';
  return 'Daily';
}
function loadEntries() {
  const current = readJson(KEYS.entries, []);
  const legacy = readJson(KEYS.legacy, []);
  const source = Array.isArray(current) && current.length ? current : legacy;
  state.entries = source.map(normalizeEntry).filter(Boolean).slice(0,750);
  writeJson(KEYS.entries,state.entries);
}
function saveEntries() {
  writeJson(KEYS.entries,state.entries);
  snapshotConfiguredState();
}
function savePrefs() { writeJson(KEYS.prefs,state.prefs); }
function savePlayer() { writeJson(KEYS.player,state.player); }

async function boot() {
  if (!document.body) return document.addEventListener('DOMContentLoaded', boot, { once:true });
  loadEntries();
  await restoreConfiguredState();
  reconcile();
  installSetupObserver();
  window.addEventListener('online', () => flushSyncQueue());
}
function reconcile() {
  if (setupVisible()) {
    unmount();
    return;
  }
  if (!document.getElementById(ROOT_ID)) mount();
  snapshotConfiguredState();
}
function installSetupObserver() {
  if (state.observer) return;
  state.observer = new MutationObserver(mutations => {
    if (mutations.every(m => document.getElementById(ROOT_ID)?.contains(m.target))) return;
    if (state.setupFrame) return;
    state.setupFrame = requestAnimationFrame(() => {
      state.setupFrame = 0;
      reconcile();
      scheduleCueScan();
    });
  });
  state.observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class','hidden','aria-hidden'] });
}
function unmount() {
  document.getElementById(ROOT_ID)?.remove();
  document.documentElement.classList.remove('pf25-mounted');
  state.mounted = false;
}
function mount() {
  if (setupVisible() || document.getElementById(ROOT_ID)) return;
  const root = document.createElement('aside');
  root.id = ROOT_ID;
  root.className = 'pf-workfold';
  root.dataset.version = VERSION;
  root.setAttribute('aria-label', `Pacefold workfold ${VERSION}`);
  window.__PACEFOLD_SET_HTML__(root,`
    <section class="pf-sheet" data-pf-sheet hidden>
      <header class="pf-sheet-head">
        <div class="pf-sheet-brand"><img src="./icons/fold-mark.svg" alt=""><span><small data-pf-sheet-kicker>Pacefold</small><strong data-pf-sheet-title>Notebook</strong></span></div>
        <button class="pf-icon-button" data-pf-action="close-sheet" aria-label="Close panel">${icon('close')}</button>
      </header>
      <div class="pf-sheet-body" data-pf-sheet-body></div>
    </section>
    <div class="pf-rail">
      <div class="pf-capture-row">
        <button class="pf-brand" data-pf-action="open-notebook" aria-label="Open Pacefold notebook">
          <img src="./icons/fold-mark.svg" alt=""><span><strong>Pacefold</strong><small>Pacefold notebook</small></span>
        </button>
        <button class="pf-andon" data-pf-action="handle-cue"><span class="pf-andon-icon">${icon('fold')}</span><span><strong data-pf-cue-label>All clear</strong><small data-pf-cue-detail>Quietly keeping pace</small></span></button>
        <form class="pf-capture" data-pf-capture-form>
          <select data-pf-capture-section aria-label="Notebook section">${SECTIONS.map(section => `<option${section === state.prefs.activeSection ? ' selected' : ''}>${esc(section)}</option>`).join('')}</select>
          <input data-pf-capture-input maxlength="${MAX_ENTRY}" autocomplete="off" placeholder="Write into today’s notebook…">
          <button type="submit" aria-label="Save to notebook">${icon('send')}</button>
        </form>
        <button class="pf-square-button" data-pf-action="open-notebook" aria-label="Open notebook">${icon('book')}<small data-pf-entry-count>${state.entries.length}</small></button>
        <button class="pf-square-button" data-pf-action="open-weather" aria-label="Weather">${icon('weather')}<small data-pf-weather-temp>—</small></button>
      </div>
      <div class="pf-player-row">
        <button class="pf-play" data-pf-action="play" aria-label="Play or pause">${icon('play')}</button>
        <button class="pf-now" data-pf-action="open-player"><span data-pf-provider-icon>${icon(PROVIDERS[state.player.provider]?.icon || 'music')}</span><span><strong data-pf-track-title>Music inside Pacefold</strong><small data-pf-track-meta>Paste your playlist or choose a local file</small></span></button>
        <input data-pf-progress class="pf-progress" type="range" min="0" max="1000" value="0" disabled aria-label="Track position">
        <button class="pf-player-button" data-pf-action="open-player">${icon('music')}<span>Music</span></button>
        <button class="pf-icon-button" data-pf-action="volume" aria-label="Volume">${icon('volume')}</button>
        <button class="pf-icon-button pf-health" data-pf-action="open-system" aria-label="System health" hidden>${icon('shield')}</button>
        <input class="pf-visually-hidden" data-pf-audio-input type="file" accept="audio/*">
        <audio data-pf-audio preload="metadata"></audio>
      </div>
    </div>`);
  document.body.append(root);
  document.documentElement.classList.add('pf25-mounted');
  state.mounted = true;
  bind(root);
  installBadgeBridge();
  scheduleCueScan();
  renderEntryCount();
  renderProviderState();
  renderWeatherPill();
  updatePlayer();
  updateHealth();
  if (!state.weather) setTimeout(() => refreshWeather(true), 900);
  window.__PACEFOLD_SURFACE__ = {
    version:VERSION,
    actions:[...ACTIONS],
    reconcile,
    setupVisible,
    snapshotConfiguredState,
    restoreConfiguredState,
    parseAmazon,
    openNotebook:() => openSheet('notebook')
  };
}
function bind(root) {
  root.addEventListener('click', safe(handleClick,'click'));
  root.querySelector('[data-pf-capture-form]').addEventListener('submit', safe(saveEntry,'save-entry'));
  root.querySelector('[data-pf-audio-input]').addEventListener('change', chooseAudio);
  root.querySelector('[data-pf-progress]').addEventListener('input', seekAudio);
  const playerRow=root.querySelector('.pf-player-row');
  playerRow?.addEventListener('dragover',event=>{ event.preventDefault(); playerRow.classList.add('is-drop-target'); });
  playerRow?.addEventListener('dragleave',()=>playerRow.classList.remove('is-drop-target'));
  playerRow?.addEventListener('drop',event=>{
    event.preventDefault();
    playerRow.classList.remove('is-drop-target');
    const file=[...(event.dataTransfer?.files||[])].find(item=>item.type.startsWith('audio/'));
    if(file) loadAudioFile(file);
  });
  const player = audio();
  player.volume = clamp(Number(state.player.volume),0,1,.62);
  ['play','pause','timeupdate','loadedmetadata','ended','error'].forEach(name => player.addEventListener(name,updatePlayer));
  document.addEventListener('keydown',handleKeyboard);
  window.addEventListener('focus',acknowledgeTaskbar);
  document.addEventListener('visibilitychange',() => document.visibilityState === 'visible' && acknowledgeTaskbar());
}
async function handleClick(event) {
  const button = event.target.closest('[data-pf-action]');
  if (!button || !document.getElementById(ROOT_ID)?.contains(button)) return;
  const action = button.dataset.pfAction;
  if (!ACTIONS.has(action)) throw new Error(`Unhandled Pacefold action: ${action}`);
  if (action === 'open-notebook') openSheet('notebook');
  else if (action === 'open-player') openSheet('player');
  else if (action === 'open-weather') openSheet('weather');
  else if (action === 'open-system') openSheet('system');
  else if (action === 'close-sheet') closeSheet();
  else if (action === 'handle-cue') handleCue();
  else if (action === 'select-date') { state.prefs.activeDate = button.dataset.date; savePrefs(); renderSheet(); }
  else if (action === 'select-section') { state.prefs.activeSection = button.dataset.section; savePrefs(); renderSheet(); }
  else if (action === 'clear-search') { state.prefs.query=''; savePrefs(); renderSheet(); }
  else if (action === 'edit-entry') { state.editingId=button.dataset.id; renderSheet(); }
  else if (action === 'save-edit') saveEdit(button.dataset.id);
  else if (action === 'cancel-edit') { state.editingId=null; renderSheet(); }
  else if (action === 'toggle-entry') toggleEntry(button.dataset.id);
  else if (action === 'delete-entry') deleteEntry(button.dataset.id);
  else if (action === 'copy-page') copyPage();
  else if (action === 'share-page') sharePage();
  else if (action === 'sync-page') syncPage({ interactive:true });
  else if (action === 'toggle-live-sync') toggleLiveSync(button);
  else if (action === 'provider') selectProvider(button.dataset.provider);
  else if (action === 'load-stream') loadStream(button.dataset.provider);
  else if (action === 'choose-local') root.querySelector('[data-pf-audio-input]').click();
  else if (action === 'play') togglePlay();
  else if (action === 'volume') cycleVolume();
  else if (action === 'retry-amazon') renderEmbeddedPlayer();
  else if (action === 'copy-amazon') copyText(state.player.amazon);
  else if (action === 'refresh-weather') refreshWeather(false);
  else if (action === 'clear-errors') clearErrors();
}
function handleKeyboard(event) {
  if (event.key === 'Escape') closeSheet();
  if (event.ctrlKey && event.shiftKey && event.code === 'Space') {
    event.preventDefault();
    document.querySelector('[data-pf-capture-input]')?.focus();
  }
  if (event.altKey && event.code === 'KeyP') {
    event.preventDefault();
    togglePlay();
  }
}
function openSheet(kind) { state.drawer=kind; renderSheet(); }
function closeSheet() { state.drawer=null; state.editingId=null; renderSheet(); }
function renderSheet() {
  const sheet=document.querySelector('[data-pf-sheet]');
  const title=document.querySelector('[data-pf-sheet-title]');
  const kicker=document.querySelector('[data-pf-sheet-kicker]');
  const body=document.querySelector('[data-pf-sheet-body]');
  if (!sheet || !body) return;
  sheet.hidden=!state.drawer;
  if (!state.drawer) return;
  if (state.drawer === 'notebook') {
    kicker.textContent='Pacefold · local-first, OneNote-ready';
    title.textContent='Pacefold Notebook';
    window.__PACEFOLD_SET_HTML__(body,notebookMarkup());
    bindNotebookInputs(body);
  } else if (state.drawer === 'player') {
    kicker.textContent='Pacefold · music stays here';
    title.textContent='Music';
    window.__PACEFOLD_SET_HTML__(body,playerMarkup());
    setTimeout(renderEmbeddedPlayer,0);
  } else if (state.drawer === 'weather') {
    kicker.textContent='Pacefold · quiet context';
    title.textContent='Weather';
    window.__PACEFOLD_SET_HTML__(body,weatherMarkup());
  } else {
    kicker.textContent='Pacefold · local diagnostics';
    title.textContent='System Health';
    window.__PACEFOLD_SET_HTML__(body,systemMarkup());
  }
}
function notebookDates() {
  return [...new Set([localDate(),...state.entries.map(entry => entry.date)])].sort().reverse().slice(0,45);
}
function filteredEntries() {
  const query=state.prefs.query.trim().toLowerCase();
  return state.entries.filter(entry =>
    entry.date === state.prefs.activeDate &&
    (state.prefs.activeSection === 'All' || entry.section === state.prefs.activeSection) &&
    (!query || `${entry.body} ${entry.section}`.toLowerCase().includes(query))
  );
}
function notebookMarkup() {
  const entries=filteredEntries();
  const sections=['All',...SECTIONS];
  const date=state.prefs.activeDate;
  const syncMode=detectOneNoteAdapter() ? 'Direct OneNote bridge available' : 'Windows Share fallback available';
  return `
  <div class="pf-notebook">
    <nav class="pf-date-rail" aria-label="Notebook dates">
      <div class="pf-date-rail-title">${icon('calendar')}<strong>Pages</strong></div>
      ${notebookDates().map(item => `<button data-pf-action="select-date" data-date="${item}" class="${item===date?'is-active':''}"><strong>${esc(formatDay(item))}</strong><small>${state.entries.filter(entry=>entry.date===item).length} notes</small></button>`).join('')}
    </nav>
    <main class="pf-paper">
      <header class="pf-paper-head">
        <div><small>${esc(state.prefs.oneNoteNotebook)} · ${esc(state.prefs.activeSection)}</small><h2>${esc(formatDay(date))}</h2></div>
        <label class="pf-search">${icon('search')}<input data-pf-notebook-search value="${esc(state.prefs.query)}" placeholder="Search this notebook"><button type="button" data-pf-action="clear-search" aria-label="Clear search">${icon('close')}</button></label>
      </header>
      <div class="pf-section-tabs">${sections.map(section=>`<button data-pf-action="select-section" data-section="${esc(section)}" class="${state.prefs.activeSection===section?'is-active':''}">${esc(section)}</button>`).join('')}</div>
      <section class="pf-page-lines">
        ${entries.length ? entries.map(entryMarkup).join('') : `<div class="pf-empty-page">${icon('book')}<strong>This page has room.</strong><span>Use the always-open field below; it will write here without taking you away from the clock.</span></div>`}
      </section>
    </main>
    <aside class="pf-onenote-panel">
      <div class="pf-onenote-mark"><span>N</span><div><strong>Microsoft OneNote</strong><small>${esc(syncMode)}</small></div></div>
      <p>Pages stay local first. Pacefold silently queues changes and pushes them through an existing Microsoft session when the bridge is available. No Microsoft password or token is stored by this surface.</p>
      <label class="pf-toggle"><input type="checkbox" data-pf-action="toggle-live-sync" ${state.prefs.liveSync?'checked':''}><span></span><strong>Live push</strong></label>
      <button class="pf-primary-button" data-pf-action="sync-page">${icon('sync')} Sync this page</button>
      <button data-pf-action="share-page">${icon('share')} Send to OneNote</button>
      <button data-pf-action="copy-page">${icon('copy')} Copy page</button>
      <small class="pf-sync-status">${state.syncQueue.length ? `${state.syncQueue.length} change${state.syncQueue.length===1?'':'s'} waiting safely on this device.` : 'OneNote queue is clear.'}</small>
    </aside>
  </div>`;
}
function entryMarkup(entry) {
  if (state.editingId === entry.id) return `
    <article class="pf-note is-editing">
      <textarea data-pf-edit-body maxlength="${MAX_ENTRY}">${esc(entry.body)}</textarea>
      <div class="pf-note-actions"><button data-pf-action="save-edit" data-id="${esc(entry.id)}">${icon('check')} Save</button><button data-pf-action="cancel-edit">${icon('close')} Cancel</button></div>
    </article>`;
  return `
    <article class="pf-note ${entry.done?'is-done':''}">
      <button class="pf-note-check" data-pf-action="toggle-entry" data-id="${esc(entry.id)}" aria-label="Toggle complete">${icon(entry.done?'check':'fold')}</button>
      <div><p>${esc(entry.body).replace(/\n/g,'<br>')}</p><small>${esc(entry.section)} · ${esc(formatTime(entry.createdAt))}${entry.oneNoteSyncedAt?' · synced':''}</small></div>
      <div class="pf-note-tools"><button data-pf-action="edit-entry" data-id="${esc(entry.id)}" aria-label="Edit">${icon('edit')}</button><button data-pf-action="delete-entry" data-id="${esc(entry.id)}" aria-label="Delete">${icon('trash')}</button></div>
    </article>`;
}
function bindNotebookInputs(body) {
  const search=body.querySelector('[data-pf-notebook-search]');
  if (search) search.addEventListener('input',event => {
    state.prefs.query=event.target.value;
    savePrefs();
    clearTimeout(search._timer);
    search._timer=setTimeout(renderSheet,120);
  });
  body.querySelector('[data-pf-action="toggle-live-sync"]')?.addEventListener('change',event => toggleLiveSync(event.target));
}
async function saveEntry(event) {
  event.preventDefault();
  const input=document.querySelector('[data-pf-capture-input]');
  const select=document.querySelector('[data-pf-capture-section]');
  const body=input?.value.trim();
  if (!body) return input?.focus();
  const entry=normalizeEntry({
    id:`${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`,
    body,
    section:SECTIONS.includes(select?.value) ? select.value : state.prefs.activeSection,
    date:localDate(),
    createdAt:nowIso()
  });
  state.entries.unshift(entry);
  state.entries=state.entries.slice(0,750);
  state.prefs.activeDate=entry.date;
  state.prefs.activeSection=entry.section;
  input.value='';
  savePrefs();
  saveEntries();
  renderEntryCount();
  if (state.drawer==='notebook') renderSheet();
  toast('Written into today’s notebook.');
  enqueueSync(entry.id);
  if (state.prefs.liveSync) flushSyncQueue();
}
function saveEdit(id) {
  const entry=state.entries.find(item=>item.id===id);
  const textarea=document.querySelector('[data-pf-edit-body]');
  if (!entry || !textarea) return;
  const body=textarea.value.trim().slice(0,MAX_ENTRY);
  if (!body) return toast('A notebook entry cannot be empty.');
  entry.body=body;
  entry.updatedAt=nowIso();
  entry.oneNoteSyncedAt=null;
  state.editingId=null;
  saveEntries();
  enqueueSync(id);
  renderSheet();
  if (state.prefs.liveSync) flushSyncQueue();
}
function toggleEntry(id) {
  const entry=state.entries.find(item=>item.id===id);
  if (!entry) return;
  entry.done=!entry.done;
  entry.updatedAt=nowIso();
  entry.oneNoteSyncedAt=null;
  saveEntries();
  enqueueSync(id);
  renderSheet();
}
function deleteEntry(id) {
  if (!confirm('Delete this notebook entry?')) return;
  state.entries=state.entries.filter(item=>item.id!==id);
  saveEntries();
  renderEntryCount();
  renderSheet();
}
function renderEntryCount() {
  const node=document.querySelector('[data-pf-entry-count]');
  if (node) node.textContent=String(state.entries.length);
}
function pageEntries() {
  return state.entries.filter(entry=>entry.date===state.prefs.activeDate && (state.prefs.activeSection==='All' || entry.section===state.prefs.activeSection));
}
function pageText() {
  const entries=pageEntries();
  return [
    `Pacefold · ${state.prefs.oneNoteNotebook}`,
    `${formatDay(state.prefs.activeDate)} · ${state.prefs.activeSection}`,
    '',
    ...entries.map(entry=>`${entry.done?'☑':'☐'} [${entry.section}] ${entry.body}`)
  ].join('\n');
}
function pageHtml() {
  const entries=pageEntries();
  return `<!doctype html><html><head><title>${esc(formatDay(state.prefs.activeDate))}</title><meta name="created" content="${esc(nowIso())}"></head><body><h1>${esc(formatDay(state.prefs.activeDate))}</h1><p><b>${esc(state.prefs.activeSection)}</b></p><ul>${entries.map(entry=>`<li data-tag="${entry.done?'to-do:completed':'to-do'}"><b>${esc(entry.section)}</b> — ${esc(entry.body).replace(/\n/g,'<br>')}</li>`).join('')}</ul></body></html>`;
}
async function copyText(value) {
  if (!value) return toast('Nothing to copy yet.');
  await navigator.clipboard.writeText(value);
  toast('Copied.');
}
function copyPage() { return copyText(pageText()); }
async function sharePage() {
  const data={ title:`Pacefold — ${formatDay(state.prefs.activeDate)}`, text:pageText() };
  if (navigator.share) {
    await navigator.share(data);
    toast('Choose OneNote in Windows Share.');
  } else {
    await copyText(data.text);
    toast('Page copied. Paste it into OneNote.');
  }
}
function detectOneNoteAdapter() {
  const candidates=[
    window.PacefoldOneNote,
    window.pacefoldOneNote,
    window.Pacefold?.oneNote,
    window.__PACEFOLD_ONENOTE__
  ].filter(Boolean);
  const direct=candidates.find(value=>typeof value.syncPage==='function'||typeof value.appendPage==='function');
  if (direct) return {
    name:'host',
    sync:payload => typeof direct.syncPage==='function' ? direct.syncPage(payload) : direct.appendPage(payload)
  };
  const msal=window.msalInstance || window.msal?.instance || window.PacefoldAuth?.msalInstance;
  if (msal && typeof msal.acquireTokenSilent==='function') return {
    name:'msal',
    sync:async payload => {
      const account=msal.getActiveAccount?.() || msal.getAllAccounts?.()[0];
      if (!account) throw new Error('Microsoft sign-in is required');
      const result=await msal.acquireTokenSilent({ scopes:GRAPH_SCOPES, account });
      return graphSync(payload,result.accessToken);
    }
  };
  return null;
}
async function graphSync(payload, token) {
  if (!token) throw new Error('Microsoft access token was unavailable');
  const headers={ Authorization:`Bearer ${token}` };
  const notebooks=await fetch('https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName',{headers}).then(requireOk).then(response=>response.json());
  let notebook=(notebooks.value||[]).find(item=>item.displayName===state.prefs.oneNoteNotebook) || notebooks.value?.[0];
  if (!notebook) throw new Error('No OneNote notebook was available');
  const sections=await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections?$select=id,displayName`,{headers}).then(requireOk).then(response=>response.json());
  let section=(sections.value||[]).find(item=>item.displayName===state.prefs.oneNoteSection);
  if (!section) {
    section=await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections`,{
      method:'POST',
      headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({displayName:state.prefs.oneNoteSection})
    }).then(requireOk).then(response=>response.json());
  }
  const boundary=`pacefold-${Date.now()}`;
  const body=[
    `--${boundary}`,
    'Content-Disposition: form-data; name="Presentation"',
    'Content-Type: text/html',
    '',
    payload.html,
    `--${boundary}--`,
    ''
  ].join('\r\n');
  await fetch(`https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(section.id)}/pages`,{
    method:'POST',
    headers:{...headers,'Content-Type':`multipart/form-data; boundary=${boundary}`},
    body
  }).then(requireOk);
  return true;
}
function requireOk(response) {
  if (!response.ok) throw new Error(`Microsoft OneNote returned ${response.status}`);
  return response;
}
function enqueueSync(id) {
  if (!state.syncQueue.includes(id)) state.syncQueue.push(id);
  writeJson(KEYS.sync,state.syncQueue);
}
async function syncPage({interactive=false}={}) {
  const adapter=detectOneNoteAdapter();
  const payload={
    notebook:state.prefs.oneNoteNotebook,
    section:state.prefs.oneNoteSection,
    date:state.prefs.activeDate,
    title:`${formatDay(state.prefs.activeDate)} — ${state.prefs.activeSection}`,
    text:pageText(),
    html:pageHtml(),
    entries:pageEntries().map(entry=>({...entry}))
  };
  if (!adapter) {
    if (interactive) return sharePage();
    throw new Error('OneNote bridge is not available in this session');
  }
  await adapter.sync(payload);
  const syncedAt=nowIso();
  for (const entry of pageEntries()) entry.oneNoteSyncedAt=syncedAt;
  state.syncQueue=state.syncQueue.filter(id=>!pageEntries().some(entry=>entry.id===id));
  writeJson(KEYS.sync,state.syncQueue);
  saveEntries();
  if (state.drawer==='notebook') renderSheet();
  toast('OneNote page synced.');
}
async function flushSyncQueue() {
  if (!state.prefs.liveSync || !state.syncQueue.length || !detectOneNoteAdapter()) return;
  try { await syncPage({interactive:false}); }
  catch (error) { recordError('onenote-sync',error); }
}
function toggleLiveSync(control) {
  const checked=control?.checked ?? !state.prefs.liveSync;
  state.prefs.liveSync=Boolean(checked);
  savePrefs();
  if (state.prefs.liveSync) flushSyncQueue();
  if (state.drawer==='notebook') renderSheet();
}

function playerMarkup() {
  const provider=PROVIDERS[state.player.provider] ? state.player.provider : 'local';
  return `
  <div class="pf-provider-tabs" role="tablist">
    ${Object.entries(PROVIDERS).map(([key,value])=>`<button role="tab" aria-selected="${provider===key}" class="${provider===key?'is-active':''}" data-pf-action="provider" data-provider="${key}">${icon(value.icon)}<span>${esc(value.label)}</span></button>`).join('')}
  </div>
  <div class="pf-player-stage">${providerMarkup(provider)}</div>
  <div class="pf-player-security">${icon('shield')}<span>Official provider URLs only. Local audio never leaves the device. Pacefold does not store provider passwords, cookies or access tokens.</span></div>`;
}
function providerMarkup(provider) {
  if (provider==='local') return `<div class="pf-local-player"><img src="./icons/fold-mark.svg" alt=""><div><h3>Local audio</h3><p>Choose a file or drag one onto the Pacefold music row. Nothing is uploaded.</p><button class="pf-primary-button" data-pf-action="choose-local">${icon('folder')} Choose audio file</button></div></div>`;
  const placeholder=provider==='youtube'?'Paste a YouTube Music video or playlist URL':provider==='spotify'?'Paste a Spotify track, album, show or playlist URL':'Paste your Amazon Music playlist, album or station URL';
  return `
  <form class="pf-stream-form" onsubmit="return false">
    <label for="pf-stream-url">${esc(PROVIDERS[provider].label)}</label>
    <div><input id="pf-stream-url" data-pf-stream-url value="${esc(state.player[provider]||'')}" placeholder="${esc(placeholder)}"><button type="button" data-pf-action="load-stream" data-provider="${provider}">Load inside Pacefold</button></div>
    <small>${provider==='amazon'?'Your exact official Amazon Music URL is saved. Amazon can still refuse third-party framing; Pacefold will show that clearly rather than opening another window.':'The URL is validated and converted to the provider’s official embedded player.'}</small>
  </form>
  <div class="pf-embed-shell" data-pf-embed-shell><div class="pf-embed-empty">${icon(PROVIDERS[provider].icon)}<strong>Paste your own link above</strong><span>${esc(placeholder)}</span></div></div>`;
}
function selectProvider(provider) {
  if (!PROVIDERS[provider]) return;
  state.player.provider=provider;
  savePlayer();
  renderSheet();
  renderProviderState();
}
function loadStream(provider) {
  const input=document.querySelector('[data-pf-stream-url]');
  if (!input) return;
  const raw=input.value.trim();
  const parsed=provider==='youtube'?parseYouTube(raw):provider==='spotify'?parseSpotify(raw):parseAmazon(raw);
  if (!parsed) {
    input.setAttribute('aria-invalid','true');
    return toast(`That is not a valid ${PROVIDERS[provider].label} URL.`);
  }
  input.removeAttribute('aria-invalid');
  state.player.provider=provider;
  state.player[provider]=parsed.original;
  savePlayer();
  renderEmbeddedPlayer();
  renderProviderState();
}
function parseYouTube(value) {
  try {
    const url=new URL(value);
    const host=url.hostname.toLowerCase();
    if (!['youtube.com','www.youtube.com','m.youtube.com','youtu.be','music.youtube.com'].includes(host)||url.protocol!=='https:') return null;
    const list=url.searchParams.get('list');
    let id=host==='youtu.be'?url.pathname.split('/').filter(Boolean)[0]:url.searchParams.get('v');
    if (!id && /\/shorts\//.test(url.pathname)) id=url.pathname.split('/shorts/')[1]?.split('/')[0];
    if (list && /^[A-Za-z0-9_-]{10,}$/.test(list)) return {original:url.href,embed:`https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}&playsinline=1&rel=0`};
    if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) return {original:url.href,embed:`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0`};
    return null;
  } catch { return null; }
}
function parseSpotify(value) {
  try {
    const url=new URL(value);
    if (url.protocol!=='https:'||!['open.spotify.com','spotify.com'].includes(url.hostname.toLowerCase())) return null;
    const parts=url.pathname.split('/').filter(Boolean);
    const index=parts.findIndex(part=>['track','album','playlist','show','episode','artist'].includes(part));
    const type=parts[index],id=parts[index+1];
    if (!type||!id||!/^[A-Za-z0-9]{10,40}$/.test(id)) return null;
    return {original:url.href,embed:`https://open.spotify.com/embed/${type}/${id}?theme=0`};
  } catch { return null; }
}
function parseAmazon(value) {
  try {
    const url=new URL(value);
    const host=url.hostname.toLowerCase();
    const allowed=/^(music\.)?amazon\.(ca|com|co\.uk|de|fr|it|es|com\.au|co\.jp)$/.test(host);
    if (url.protocol!=='https:'||!allowed) return null;
    url.hash='';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(tag|ref|ref_|linkCode|creative|creativeASIN|ascsubtag|keywords)$/i.test(key)||/^utm_/i.test(key)) url.searchParams.delete(key);
    }
    if (url.pathname==='/'||url.pathname.length<2) return null;
    return {original:url.href,embed:url.href};
  } catch { return null; }
}
function renderEmbeddedPlayer() {
  const host=document.querySelector('[data-pf-embed-shell]');
  if (!host) return;
  const provider=state.player.provider;
  const parsed=provider==='youtube'?parseYouTube(state.player.youtube):provider==='spotify'?parseSpotify(state.player.spotify):provider==='amazon'?parseAmazon(state.player.amazon):null;
  if (!parsed) return;
  const frame=document.createElement('iframe');
  frame.className=`pf-embed pf-embed--${provider}`;
  frame.title=`${PROVIDERS[provider].label} inside Pacefold`;
  frame.src=parsed.embed;
  frame.loading='eager';
  frame.referrerPolicy='no-referrer';
  frame.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';
  frame.sandbox='allow-scripts allow-same-origin allow-forms allow-presentation';
  host.replaceChildren(frame);
  host.classList.add('is-loaded');
  document.querySelector('[data-pf-track-title]').textContent=PROVIDERS[provider].label;
  document.querySelector('[data-pf-track-meta]').textContent=provider==='amazon'?'Your saved Amazon Music link':'Playing inside Pacefold';
  if (provider==='amazon') {
    const notice=document.createElement('div');
    notice.className='pf-amazon-notice';
    window.__PACEFOLD_SET_HTML__(notice,`${icon('amazon')}<div><strong>Amazon controls whether this page can appear here.</strong><span>Pacefold has loaded your exact playlist URL. If Amazon blocks the frame, your link remains saved.</span><div><button data-pf-action="retry-amazon">${icon('refresh')} Retry</button><button data-pf-action="copy-amazon">${icon('copy')} Copy link</button></div></div>`);
    host.append(notice);
  }
}
function renderProviderState() {
  const provider=PROVIDERS[state.player.provider]||PROVIDERS.local;
  const holder=document.querySelector('[data-pf-provider-icon]');
  if (holder) window.__PACEFOLD_SET_HTML__(holder,icon(provider.icon));
}
function audio() { return document.querySelector('[data-pf-audio]'); }
function chooseAudio(event) {
  const file=event.target.files?.[0];
  if (file) loadAudioFile(file);
}
function loadAudioFile(file) {
  if (!file||!file.type.startsWith('audio/')) return toast('Choose an audio file.');
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl=URL.createObjectURL(file);
  state.player.provider='local';
  savePlayer();
  const player=audio();
  player.src=state.audioUrl;
  player.dataset.title=file.name.replace(/\.[^.]+$/,'');
  player.dataset.meta=`${Math.round(file.size/104857.6)/10} MB · local`;
  player.play().catch(()=>toast('File loaded. Press play when ready.'));
  updatePlayer();
  renderProviderState();
}
async function togglePlay() {
  const player=audio();
  if (state.player.provider!=='local') return openSheet('player');
  if (!player?.src) return document.querySelector('[data-pf-audio-input]')?.click();
  if (player.paused) await player.play(); else player.pause();
}
function seekAudio(event) {
  const player=audio();
  if (Number.isFinite(player?.duration)&&player.duration>0) player.currentTime=Number(event.target.value)/1000*player.duration;
}
function updatePlayer() {
  const player=audio();
  if (!player) return;
  const play=document.querySelector('[data-pf-action="play"]');
  if (play) window.__PACEFOLD_SET_HTML__(play,icon(player.paused?'play':'pause'));
  const progress=document.querySelector('[data-pf-progress]');
  if (progress) {
    progress.disabled=!Number.isFinite(player.duration);
    progress.value=Number.isFinite(player.duration)&&player.duration>0?Math.round(player.currentTime/player.duration*1000):0;
  }
  if (state.player.provider==='local'&&player.dataset.title) {
    document.querySelector('[data-pf-track-title]').textContent=player.dataset.title;
    document.querySelector('[data-pf-track-meta]').textContent=player.dataset.meta||'Local audio';
  }
}
function cycleVolume() {
  const player=audio();
  if (!player) return;
  const levels=[0,.3,.62,1];
  const next=levels.find(level=>level>player.volume+.01) ?? 0;
  player.volume=next;
  state.player.volume=next;
  savePlayer();
  const button=document.querySelector('[data-pf-action="volume"]');
  if (button) window.__PACEFOLD_SET_HTML__(button,icon(next===0?'mute':'volume'));
  toast(next===0?'Muted':`Volume ${Math.round(next*100)}%`);
}

function weatherMarkup() {
  const current=state.weather?.current;
  const daily=state.weather?.daily||[];
  return `<div class="pf-weather-card">${icon('weather')}<div><strong>${current?`${Math.round(current.temperature)}°`:'—'}</strong><span>${esc(current?.label||'Weather unavailable')}</span></div></div>
  <div class="pf-weather-days">${daily.map(day=>`<article><strong>${esc(formatDay(day.date))}</strong><span>${Math.round(day.high)}° / ${Math.round(day.low)}°</span><small>${esc(day.label)} · ${Math.round(day.rain)}% rain</small></article>`).join('')}</div>
  <button class="pf-primary-button" data-pf-action="refresh-weather">${icon('refresh')} Refresh</button>`;
}
async function refreshWeather(quiet=false) {
  if (state.weatherRequest) return state.weatherRequest;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  state.weatherRequest=fetch((()=>{const weatherPrefs=readJson('pacefoldPrefsV15',{}),url=new URL('https://api.open-meteo.com/v1/forecast');url.searchParams.set('latitude',String(Number.isFinite(Number(weatherPrefs.lat))?Number(weatherPrefs.lat):43.6532));url.searchParams.set('longitude',String(Number.isFinite(Number(weatherPrefs.lng))?Number(weatherPrefs.lng):-79.3832));url.searchParams.set('current','temperature_2m,apparent_temperature,weather_code');url.searchParams.set('daily','weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');url.searchParams.set('timezone','auto');url.searchParams.set('forecast_days','3');return url.href;})(),{signal:controller.signal})
    .then(requireOk).then(response=>response.json()).then(data=>{
      const labels={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Cloudy',45:'Fog',51:'Drizzle',61:'Rain',63:'Rain',65:'Heavy rain',71:'Snow',80:'Showers',95:'Thunderstorm'};
      state.weather={
        current:{temperature:data.current?.temperature_2m,label:labels[data.current?.weather_code]||'Mixed conditions'},
        daily:(data.daily?.time||[]).map((date,index)=>({date,high:data.daily.temperature_2m_max[index],low:data.daily.temperature_2m_min[index],rain:data.daily.precipitation_probability_max[index]||0,label:labels[data.daily.weather_code[index]]||'Mixed'}))
      };
      writeCache(KEYS.weather,state.weather);
      renderWeatherPill();
      if (state.drawer==='weather') renderSheet();
      if (!quiet) toast('Weather refreshed.');
    }).catch(error=>{ recordError('weather',error); if (!quiet) toast('Weather is temporarily unavailable.'); })
    .finally(()=>{ clearTimeout(timer); state.weatherRequest=null; });
  return state.weatherRequest;
}
function renderWeatherPill() {
  const node=document.querySelector('[data-pf-weather-temp]');
  if (node) node.textContent=state.weather?.current?`${Math.round(state.weather.current.temperature)}°`:'—';
}
function systemMarkup() {
  return `<div class="pf-health-grid">
    <article><span></span><div><strong>Notebook storage</strong><small>${configuredStatePresent()?'Local state present':'Waiting for first save'}</small></div></article>
    <article><span></span><div><strong>Setup recovery</strong><small>${'indexedDB' in window?'IndexedDB backup enabled':'Browser backup unavailable'}</small></div></article>
    <article><span></span><div><strong>OneNote bridge</strong><small>${detectOneNoteAdapter()?'Direct session detected':'Windows Share fallback'}</small></div></article>
    <article><span></span><div><strong>Secure context</strong><small>${isSecureContext?'Secure':'Not secure'}</small></div></article>
  </div>
  ${state.errors.length?`<div class="pf-error-list">${state.errors.map(item=>`<article><strong>${esc(item.scope)}</strong><span>${esc(item.message)}</span><small>${esc(formatTime(item.at))}</small></article>`).join('')}</div><button class="pf-primary-button" data-pf-action="clear-errors">Clear diagnostics</button>`:'<div class="pf-empty-page"><strong>No Pacefold errors recorded.</strong><span>Diagnostics stay on this device.</span></div>'}`;
}
function clearErrors() {
  state.errors=[];
  writeJson(KEYS.errors,[]);
  updateHealth();
  renderSheet();
}
function updateHealth() {
  const button=document.querySelector('.pf-health');
  if (!button) return;
  button.hidden=!state.errors.length;
  button.classList.toggle('is-warning',Boolean(state.errors.length));
}

function detectCue() {
  if (setupVisible()) return;
  const root=document.getElementById(ROOT_ID);
  const candidates=[...document.querySelectorAll('[data-active-cue],[role="alert"],.notification,.cue,.toast')]
    .filter(element=>!root?.contains(element)&&visible(element))
    .map((element,index)=>({element,index,text:(element.textContent||'').trim()}))
    .filter(item=>item.text&&/(clear|done|log|drink|water|move|break|prayer|meal|lunch|eyes|look|prepare|noodle|away)/i.test(item.text))
    .sort((a,b)=>scoreCue(b)-scoreCue(a));
  state.currentCue=candidates[0]?.element||null;
  renderCue();
}
function scoreCue(item) {
  return (item.element.hasAttribute('data-active-cue')?10000:0)+(item.element.getAttribute('role')==='alert'?3000:0)+(item.element.matches('.notification,.cue')?1500:0)+item.index;
}
function scheduleCueScan() {
  if (state.cueFrame) return;
  state.cueFrame=requestAnimationFrame(()=>{state.cueFrame=0;detectCue();});
}
function renderCue() {
  const button=document.querySelector('.pf-andon');
  if (!button) return;
  const label=button.querySelector('[data-pf-cue-label]');
  const detail=button.querySelector('[data-pf-cue-detail]');
  const text=(state.currentCue?.textContent||'').trim();
  const waiting=Boolean(state.currentCue);
  button.classList.toggle('is-waiting',waiting);
  label.textContent=waiting ? cueLabel(text) : 'All clear';
  detail.textContent=waiting ? 'Open Pacefold to handle this moment' : 'Quietly keeping pace';
}
function cueLabel(text) {
  if (/water|drink|hydrate|sip/i.test(text)) return 'Hydrate';
  if (/eye|look far|distance/i.test(text)) return 'Look far';
  if (/move|stretch|posture|ergonomic/i.test(text)) return 'Move';
  if (/prayer|fajr|dhuhr|asr|maghrib|isha/i.test(text)) return 'Prayer';
  if (/meal|lunch|eat/i.test(text)) return 'Meal';
  if (/prepare|noodle|ready/i.test(text)) return 'Prepare';
  if (/away|break|step away/i.test(text)) return 'Step away';
  return text.split(/\n/)[0].slice(0,38)||'Pacefold moment';
}
function handleCue() {
  const cue=state.currentCue;
  if (!cue) return acknowledgeTaskbar();
  const button=[...cue.querySelectorAll('button,[role="button"]')].find(node=>/(clear|done|log|complete|dismiss)/i.test(node.textContent||node.getAttribute('aria-label')||'')) || cue.querySelector('button,[role="button"]');
  if (button) button.click(); else cue.remove();
  state.currentCue=null;
  acknowledgeTaskbar();
  scheduleCueScan();
}
function installBadgeBridge() {
  if (nativeBadge.set) {
    const wrapped=async value=>{
      writeJson(KEYS.badge,{waiting:true,acknowledged:false,value:value??1,at:nowIso()});
      scheduleCueScan();
      return nativeBadge.set(value??1);
    };
    try { Object.defineProperty(navigator,'setAppBadge',{configurable:true,writable:true,value:wrapped}); }
    catch (error) { recordError('badge-bridge',error); }
  }
  acknowledgeTaskbar();
}
async function acknowledgeTaskbar() {
  const badge=readJson(KEYS.badge,null);
  if (badge?.waiting&&!badge.acknowledged) writeJson(KEYS.badge,{...badge,acknowledged:true});
  try { await nativeBadge.clear?.(); } catch {}
}
function installMediaSession() {
  if (!('mediaSession' in navigator)) return;
  for (const [action,handler] of [['play',()=>audio()?.play()],['pause',()=>audio()?.pause()],['seekbackward',()=>{if(audio())audio().currentTime=Math.max(0,audio().currentTime-15);}],['seekforward',()=>{if(audio())audio().currentTime=Math.min(audio().duration||Infinity,audio().currentTime+15);}]]) {
    try { navigator.mediaSession.setActionHandler(action,handler); } catch {}
  }
}

boot();
setTimeout(installMediaSession,0);
})();
;
(()=>{if(window.__PACEFOLD_SET_HTML__)return;window.__PACEFOLD_SET_HTML__=(node,value)=>{if(!node)return node;const html=window.__PACEFOLD_TRUSTED_HTML__?window.__PACEFOLD_TRUSTED_HTML__(String(value)):String(value);Reflect.set(node,'innerHTML',html);return node;};})();
(() => {
'use strict';

const VERSION='25.0.0';
const ROOT_ID='pf25-root';
const DOCK_ID='pf-flow-dock';
const ACK_KEY='pacefold.flow.ack.v1';
const SNOOZE_KEY='pacefold.flow.snooze.v1';
const PANEL_KEY='pacefold.flow.panel.v1';
const ENTRY_KEY='pacefold.notebook.entries.v2';
const SYNC_LOCK_KEY='pacefold.resilience.lock.sync-page.v1';
const COMMANDS={
  daily:'Daily',note:'Daily',follow:'Follow-ups',followup:'Follow-ups','follow-up':'Follow-ups',
  incident:'Incidents',incidents:'Incidents',inspect:'Inspections',inspection:'Inspections',
  jhsc:'JHSC',construction:'Construction',notification:'Notifications',notifications:'Notifications',
  resource:'Resources',resources:'Resources'
};
const ACTIONS={
  notebook:['open-notebook'],media:['open-player'],weather:['open-weather','show-weather','weather'],
  system:['open-system','open-diagnostics','diagnostics'],cue:['handle-cue'],sync:['sync-page']
};
const RITUAL_COPY=new Map([
  ['Sip pace','Sip'],['Prep 30m','Prep 30m'],['Away break','Step away'],['Desk meal 20m','Eat 20m'],['Look far','Look far']
]);
const originalTitle=document.title;
let root=null;
let dock=null;
let frame=0;
let clickTimer=0;
let statusTimer=0;
let snoozeTimer=0;
let mountedRoot=null;
let foldObserver=null;
let foldSources=null;
let cueState={waiting:false,text:'No action waiting',fingerprint:'',acknowledged:true,snoozed:false,snoozeUntil:0,snoozeMinutes:0};

function safeParse(raw,fallback){try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
function compactText(value){return String(value||'').replace(/\s+/g,' ').trim();}
function clamp(value,min,max){return Math.min(max,Math.max(min,value));}
function hash(value){let result=2166136261;for(const char of String(value)){result^=char.charCodeAt(0);result=Math.imul(result,16777619);}return (result>>>0).toString(36);}
function today(){return new Date().toISOString().slice(0,10);}
function reportError(kind,error){try{window.__PACEFOLD_DIAGNOSTICS__?.recordError?.(`flow-${kind}`,error);}catch{}}
function guarded(kind,callback){return function(...args){try{return callback.apply(this,args);}catch(error){reportError(kind,error);try{showStatus('Pacefold recovered from a display error.','warning');}catch{}setTimeout(queueMount,100);return undefined;}};}
function setupVisible(){return Boolean(window.__PACEFOLD_GUARDIAN__?.setupVisible?.());}
function allActions(){return Array.isArray(window.__PACEFOLD_SURFACE__?.actions)?window.__PACEFOLD_SURFACE__.actions:[];}
function originalAction(name){return [...(root?.querySelectorAll('[data-pf-action]:not([data-pf-flow-proxy])')||[])].find(control=>control.dataset.pfAction===name)||null;}

function leafElements(scope=document){
  return [...scope.querySelectorAll('button,span,p,small,strong,b,label,div,h1,h2,h3,h4')].filter(node=>node.children.length===0);
}
function replaceCopy(from,to,scope=document){
  for(const node of leafElements(scope))if(compactText(node.textContent)===from&&node.textContent!==to)node.textContent=to;
}
function setupScope(){
  const heading=leafElements(document).find(node=>compactText(node.textContent)==='Choose your rhythm');
  return heading?.closest('[role="dialog"],dialog,.setup,.onboarding,.setup-screen,section,main')||null;
}
function applyCopyPass(){
  const scope=setupScope();
  replaceCopy('Finish setup / Install Pacefold for the cleanest taskbar experience.','Install Pacefold to pin it to your taskbar.');
  replaceCopy('Finish setup / Install Pacefold for the cleanest taskbar experience','Install Pacefold to pin it to your taskbar.');
  if(scope){
    const kicker=leafElements(scope).find(node=>compactText(node.textContent)==='Pacefold setup');
    if(kicker&&!kicker.hidden){kicker.hidden=true;kicker.setAttribute('aria-hidden','true');kicker.dataset.pfCopyHidden='true';}
  }
  const status=document.getElementById('statusLine');
  const tooltip='Click to start the pause. Click again when you’re back.';
  if(status){
    const previous=compactText(status.getAttribute('title'));
    if(previous!==tooltip)status.setAttribute('title',tooltip);
    if(scope&&!scope.querySelector('[data-pf-onboarding-pause-help]')){
      const help=document.createElement('p');
      help.className='pf-onboarding-pause-help';
      help.dataset.pfOnboardingPauseHelp='true';
      help.textContent=previous&&previous!==tooltip
        ?previous
        :'The status line starts and ends a pause. Click once when you step away, then click again when you return.';
      const heading=leafElements(scope).find(node=>compactText(node.textContent)==='Choose your rhythm');
      (heading?.parentElement||scope).append(help);
    }
  }
  for(const [from,to] of RITUAL_COPY)replaceCopy(from,to);
}
function parsePercent(value){
  const match=String(value||'').trim().match(/^(-?\d+(?:\.\d+)?)%$/);
  return match?clamp(Number(match[1]),0,100):NaN;
}
function progressPercent(progress){
  const fill=progress?.querySelector('.progress-fill');
  const candidates=[
    fill?.style?.width,
    fill?.style?.getPropertyValue('--progress'),
    progress?.style?.getPropertyValue('--progress'),
    fill?.getAttribute('aria-valuenow'),
    progress?.getAttribute('aria-valuenow')
  ];
  for(const value of candidates){
    const text=String(value??'').trim();
    if(!text)continue;
    const percent=parsePercent(text);
    if(Number.isFinite(percent))return percent;
    const numeric=Number(text);
    if(Number.isFinite(numeric)&&numeric>=0&&numeric<=100)return numeric;
  }
  if(fill&&progress&&!progress.hasAttribute('hidden')){
    const outer=progress.getBoundingClientRect();
    const inner=fill.getBoundingClientRect();
    if(outer.width>0&&inner.width>=0)return clamp(inner.width/outer.width*100,0,100);
  }
  return 0;
}
function markFraction(mark,sequence,index,count){
  const stored=Number(mark.dataset.pfFoldFraction);
  if(Number.isFinite(stored))return clamp(stored,0,100);
  const raw=[
    mark.style.left,mark.style.insetInlineStart,
    mark.style.getPropertyValue('--left'),mark.style.getPropertyValue('--position'),
    mark.style.getPropertyValue('--at'),mark.dataset.position,mark.dataset.at,mark.dataset.fraction
  ];
  let fraction=NaN;
  for(const value of raw){
    const text=String(value??'').trim();
    if(!text)continue;
    fraction=parsePercent(text);
    if(Number.isFinite(fraction))break;
    const numeric=Number(text);
    if(Number.isFinite(numeric)){fraction=numeric<=1?numeric*100:numeric;break;}
  }
  if(!Number.isFinite(fraction)&&!sequence.hasAttribute('data-pf-fold-source')){
    const outer=sequence.getBoundingClientRect();
    const rect=mark.getBoundingClientRect();
    if(outer.width>0)fraction=(rect.left+rect.width/2-outer.left)/outer.width*100;
  }
  if(!Number.isFinite(fraction))fraction=count>1?index/(count-1)*100:50;
  fraction=clamp(fraction,0,100);
  mark.dataset.pfFoldFraction=String(fraction);
  return fraction;
}
function foldMoments(sequence,progress){
  let marks=[...sequence.querySelectorAll('.sequence-mark')];
  if(!marks.length)marks=[...sequence.querySelectorAll('[data-code]')].filter(node=>node.closest('.sequence')===sequence);
  const moments=marks.map((mark,index)=>({
    mark,
    fraction:markFraction(mark,sequence,index,marks.length),
    code:compactText(mark.dataset.code||mark.getAttribute('aria-label')||mark.textContent)||`Moment ${index+1}`,
    namedCurrent:/(?:^|\s)(?:is-)?(?:active|current|now)(?:\s|$)/i.test(mark.className)||mark.matches('[aria-current="true"],[data-current="true"]'),
    namedPassed:/(?:^|\s)(?:is-)?(?:done|passed|complete)(?:\s|$)/i.test(mark.className)||mark.matches('[data-passed="true"],[data-complete="true"]')
  })).sort((a,b)=>a.fraction-b.fraction);
  const explicit=moments.findIndex(item=>item.namedCurrent);
  let current=explicit;
  if(current<0&&moments.length){
    current=moments.reduce((best,item,index)=>Math.abs(item.fraction-progress)<Math.abs(moments[best].fraction-progress)?index:best,0);
  }
  return moments.map((item,index)=>({...item,state:index===current?'current':item.namedPassed||item.fraction<progress-.15?'passed':'future'}));
}
function creaseLayer(moment){
  const point=moment.fraction.toFixed(3);
  if(moment.state==='current'){
    return `linear-gradient(90deg,transparent 0 calc(${point}% - .5px),var(--cue,var(--accent)) calc(${point}% - .5px) calc(${point}% + .5px),color-mix(in srgb,#fff 24%,transparent) calc(${point}% + .5px) calc(${point}% + 3.5px),transparent calc(${point}% + 3.5px) 100%)`;
  }
  if(moment.state==='passed'){
    return `linear-gradient(90deg,transparent 0 calc(${point}% - .5px),color-mix(in srgb,var(--ink) 14%,transparent) calc(${point}% - .5px) calc(${point}% + .5px),color-mix(in srgb,#fff 22%,transparent) calc(${point}% + .5px) calc(${point}% + 3.5px),transparent calc(${point}% + 3.5px) 100%)`;
  }
  return `linear-gradient(90deg,transparent 0 calc(${point}% - .5px),color-mix(in srgb,var(--ink) 12%,transparent) calc(${point}% - .5px) calc(${point}% + .5px),transparent calc(${point}% + .5px) 100%)`;
}
function renderFoldStrip(strip,moments,progress){
  strip.style.setProperty('--fold-progress',`${progress.toFixed(3)}%`);
  strip.style.setProperty('--fold-creases',moments.length?moments.map(creaseLayer).join(','):'none');
  const existing=[...strip.querySelectorAll('.fold-crease')];
  moments.forEach((moment,index)=>{
    const node=existing[index]||document.createElement('span');
    if(!existing[index]){node.className='fold-crease';node.setAttribute('aria-hidden','true');strip.append(node);}
    node.dataset.code=moment.code;
    node.dataset.state=moment.state;
    node.style.setProperty('--fold-left',`${moment.fraction.toFixed(3)}%`);
  });
  existing.slice(moments.length).forEach(node=>node.remove());
  const passed=moments.filter(item=>item.state==='passed').length;
  strip.setAttribute('aria-label',`Workday ${Math.round(progress)}% folded. ${passed} of ${moments.length} scheduled moments passed.`);
}
function observeFoldSources(progress,sequence){
  if(foldSources?.progress===progress&&foldSources?.sequence===sequence)return;
  foldObserver?.disconnect();
  foldSources={progress,sequence};
  foldObserver=new MutationObserver(guarded('fold-observer',updateFoldStrip));
  foldObserver.observe(progress,{attributes:true,childList:true,subtree:true,characterData:true});
  foldObserver.observe(sequence,{attributes:true,childList:true,subtree:true,characterData:true});
}
function updateFoldStrip(){
  if(window.__PACEFOLD_VIEW__){
    document.querySelector('.fold-strip[data-pf-fold-strip]')?.remove();
    return;
  }
  const progress=document.querySelector('.progress');
  const sequence=document.querySelector('.sequence');
  if(!progress||!sequence)return;
  const value=progressPercent(progress);
  const moments=foldMoments(sequence,value);
  let strip=document.querySelector('.fold-strip[data-pf-fold-strip]');
  if(!strip){
    strip=document.createElement('div');
    strip.className='fold-strip';
    strip.dataset.pfFoldStrip='true';
    strip.setAttribute('role','img');
    progress.parentNode?.insertBefore(strip,progress);
  }
  if(progress.dataset.pfFoldSource!=='true')progress.dataset.pfFoldSource='true';
  if(progress.getAttribute('aria-hidden')!=='true')progress.setAttribute('aria-hidden','true');
  if(sequence.dataset.pfFoldSource!=='true')sequence.dataset.pfFoldSource='true';
  if(sequence.getAttribute('aria-hidden')!=='true')sequence.setAttribute('aria-hidden','true');
  renderFoldStrip(strip,moments,value);
  observeFoldSources(progress,sequence);
}
function enhanceCoreSurface(){applyCopyPass();updateFoldStrip();}

function resolveAction(kind){
  for(const name of ACTIONS[kind]||[]){const control=originalAction(name);if(control)return {name,control};}
  const token=kind==='media'?'player':kind;
  const fuzzy=allActions().find(name=>String(name).includes(token));
  return fuzzy?{name:fuzzy,control:originalAction(fuzzy)}:null;
}
function forward(kind){
  const match=resolveAction(kind);
  if(!match?.control){showStatus(`${kind[0].toUpperCase()+kind.slice(1)} is unavailable here.`,'warning');return false;}
  match.control.click();
  return true;
}
function notebookEntries(){try{const value=safeParse(localStorage.getItem(ENTRY_KEY),[]);return Array.isArray(value)?value:[];}catch{return [];}}
function todayCount(){return notebookEntries().filter(item=>item?.date===today()).length;}
function currentAck(){try{return safeParse(localStorage.getItem(ACK_KEY),null);}catch{return null;}}
function currentSnooze(){try{return safeParse(localStorage.getItem(SNOOZE_KEY),null);}catch{return null;}}
function snoozeFor(fingerprint){
  const value=currentSnooze();
  const until=Number(value?.until)||0;
  if(!value||value.fingerprint!==fingerprint)return {active:false,until:0,minutes:0};
  if(until<=Date.now()){
    try{localStorage.removeItem(SNOOZE_KEY);}catch{}
    return {active:false,until:0,minutes:0};
  }
  return {active:true,until,minutes:Math.max(1,Math.ceil((until-Date.now())/60000))};
}
function clearCueTaskbarState(){
  clearTimeout(snoozeTimer);snoozeTimer=0;
  try{localStorage.removeItem(ACK_KEY);localStorage.removeItem(SNOOZE_KEY);}catch{}
}
function cleanCueText(value){
  let text=compactText(value);
  text=text.split(/Open Pacefold|Quietly keeping pace|Open this moment|to this moment|\bDone\b|\bClear\b|\bLog\b|\bHandle\b/i)[0];
  return compactText(text).slice(0,80);
}
function cueLabel(andon,handler){
  const selector='[data-pf-cue-label],[data-pf-label],.pf-andon-title,.pf-andon-label,strong,b';
  const candidates=[handler?.querySelector(selector),andon?.querySelector(selector),handler?.querySelector('span:not([aria-hidden="true"])'),andon?.querySelector('span:not([aria-hidden="true"])')];
  for(const candidate of candidates){
    const text=cleanCueText(candidate?.textContent);
    if(text&&!/^(?:open pacefold|quietly keeping pace|action waiting)$/i.test(text))return text;
  }
  const source=handler||andon;
  if(source){
    const clone=source.cloneNode(true);
    clone.querySelectorAll('small,button,kbd,[aria-hidden="true"],.sr-only,.pf-sr-only').forEach(node=>node.remove());
    const text=cleanCueText(clone.textContent);
    if(text)return text;
  }
  return cleanCueText(andon?.textContent||handler?.textContent||'')||'Action waiting';
}
function readCue(){
  if(!root)return {waiting:false,text:'No action waiting',fingerprint:'',acknowledged:true,snoozed:false,snoozeUntil:0,snoozeMinutes:0};
  const andon=root.querySelector('.pf-andon');
  const handler=originalAction('handle-cue');
  const waiting=Boolean(andon?.classList.contains('is-waiting')||andon?.matches('[data-state="waiting"],[data-waiting="true"]'));
  if(!waiting)return {waiting:false,text:'No action waiting',fingerprint:'',acknowledged:true,snoozed:false,snoozeUntil:0,snoozeMinutes:0};
  const text=cueLabel(andon,handler);
  const fingerprint=hash(`${text}|${handler?.dataset?.pfId||''}`);
  const acknowledged=currentAck()?.fingerprint===fingerprint;
  const snooze=snoozeFor(fingerprint);
  return {waiting:true,text,fingerprint,acknowledged,snoozed:snooze.active,snoozeUntil:snooze.until,snoozeMinutes:snooze.minutes};
}
async function closeNotifications(){
  try{const registration=await navigator.serviceWorker?.getRegistration?.();const notifications=await registration?.getNotifications?.();for(const notification of notifications||[])notification.close();}catch{}
}
async function clearBadge(){try{await navigator.clearAppBadge?.();}catch{}}
async function setBadge(){try{await navigator.setAppBadge?.();}catch{}}
async function acknowledge(source='dock'){
  const next=readCue();
  if(next.waiting){try{localStorage.removeItem(SNOOZE_KEY);localStorage.setItem(ACK_KEY,JSON.stringify({fingerprint:next.fingerprint,at:new Date().toISOString(),source,version:VERSION}));}catch(error){reportError('acknowledge-storage',error);}}
  await Promise.allSettled([clearBadge(),closeNotifications()]);
  window.dispatchEvent(new CustomEvent('pacefold:taskbar-acknowledged',{detail:{source,fingerprint:next.fingerprint}}));
  showStatus(next.waiting?'Taskbar quieted. The action remains waiting.':'Taskbar is clear.','success');
  reconcileSafely();
}
async function snoozeCue(minutes=10){
  const next=readCue();
  if(!next.waiting){showStatus('There is no action to remind you about.','warning');return false;}
  const duration=Math.max(1,Math.min(120,Number(minutes)||10));
  const until=Date.now()+duration*60000;
  try{
    localStorage.removeItem(ACK_KEY);
    localStorage.setItem(SNOOZE_KEY,JSON.stringify({fingerprint:next.fingerprint,at:new Date().toISOString(),until,minutes:duration,version:VERSION}));
  }catch(error){reportError('snooze-storage',error);showStatus('The reminder could not be saved on this device.','warning');return false;}
  await Promise.allSettled([clearBadge(),closeNotifications()]);
  window.dispatchEvent(new CustomEvent('pacefold:taskbar-snoozed',{detail:{fingerprint:next.fingerprint,until,minutes:duration}}));
  setPanel(false,false);
  showStatus(`Taskbar quieted. Reminding again in ${duration} minutes.`,'success');
  reconcileSafely();
  return true;
}
function scheduleSnoozeWake(){
  clearTimeout(snoozeTimer);snoozeTimer=0;
  if(!cueState.snoozed||!cueState.snoozeUntil)return;
  const wait=Math.max(500,Math.min(2147483000,cueState.snoozeUntil-Date.now()+100));
  snoozeTimer=setTimeout(()=>{snoozeTimer=0;try{localStorage.removeItem(SNOOZE_KEY);}catch{}reconcileSafely();},wait);
}
async function syncBadge(state=readCue()){
  cueState=state;
  const prefs=safeParse(localStorage.getItem('pacefoldPrefsV15'),{});
  if(prefs.quietMode){
    await clearBadge();
    document.title='Clock';
    return;
  }
  if(cueState.waiting&&!cueState.acknowledged&&!cueState.snoozed)await setBadge();
  else await clearBadge();
  const attention=cueState.waiting&&!cueState.acknowledged&&!cueState.snoozed;
  document.title=cueState.waiting?`${attention?'• ':''}${cueState.text} — Pacefold`:originalTitle;
}
function showStatus(message,tone='neutral'){
  if(!dock)return;
  const node=dock.querySelector('[data-pf-flow-status]');
  if(!node)return;
  clearTimeout(statusTimer);node.textContent=message;node.dataset.tone=tone;node.hidden=false;
  statusTimer=setTimeout(()=>{if(node.isConnected)node.hidden=true;},2800);
}
function setPanel(open,focus=true){
  if(!dock)return;
  const panel=dock.querySelector('[data-pf-flow-panel]');
  const toggle=dock.querySelector('[data-pf-flow-more]');
  if(!panel||!toggle)return;
  panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));dock.classList.toggle('is-open',open);
  try{sessionStorage.setItem(PANEL_KEY,open?'open':'closed');}catch{}
  if(open&&focus)panel.querySelector('[data-pf-flow-primary]')?.focus({preventScroll:true});
}
function togglePanel(){setPanel(dock?.querySelector('[data-pf-flow-panel]')?.hidden!==false);}
function focusCapture(){setPanel(false,false);const input=dock?.querySelector('[data-pf-flow-input]');input?.focus({preventScroll:true});input?.select?.();}
function parseCapture(value){
  const raw=compactText(value);const match=raw.match(/^\/([\w-]+)\s*/);
  if(!match)return {section:null,body:raw};
  const section=COMMANDS[match[1].toLowerCase()]||null;
  return section?{section,body:raw.slice(match[0].length).trim()}:{section:null,body:raw};
}
function submitCapture(event){
  event.preventDefault();if(!root)return;
  const proxy=dock.querySelector('[data-pf-flow-input]');const parsed=parseCapture(proxy.value);
  if(!parsed.body){showStatus('Write a note first.','warning');return;}
  const form=root.querySelector('[data-pf-capture-form]:not([data-pf-flow-proxy])');
  const input=form?.querySelector('[data-pf-capture-input]');const section=form?.querySelector('[data-pf-capture-section]');
  if(!form||!input){showStatus('Capture is still starting.','warning');return;}
  if(parsed.section&&section){section.value=parsed.section;section.dispatchEvent(new Event('change',{bubbles:true}));}
  input.value=parsed.body;input.dispatchEvent(new Event('input',{bubbles:true}));form.requestSubmit();proxy.value='';
  showStatus(parsed.section?`Saved to ${parsed.section}.`:'Saved to today.','success');setTimeout(reconcileSafely,60);
}
function sourceIcon(){
  const text=cueState.text.toLowerCase();
  if(/water|drink|hydrate|sip/.test(text))return '滴';if(/eye|look far|distance/.test(text))return '◉';
  if(/move|stretch|posture|ergonomic/.test(text))return '↗';if(/prayer|fajr|dhuhr|asr|maghrib|isha/.test(text))return '◇';
  if(/meal|lunch|eat/.test(text))return '◡';if(/prepare|noodle|ready/.test(text))return '≈';if(/away|break|step away/.test(text))return '↘';return '·';
}
function markOriginalSources(){
  if(!root)return;
  for(const selector of ['.pf-andon','.pf-player-row','[data-pf-capture-form]'])for(const node of root.querySelectorAll(`${selector}:not([data-pf-flow-proxy])`))node.setAttribute('data-pf-flow-source','true');
}
function capability(kind){return Boolean(resolveAction(kind)?.control);}
function reconcileState(){
  enhanceCoreSurface();
  if(!dock?.isConnected||!root?.isConnected)return;
  markOriginalSources();cueState=readCue();scheduleSnoozeWake();
  const attention=cueState.waiting&&!cueState.acknowledged&&!cueState.snoozed;
  const pulse=dock.querySelector('[data-pf-flow-pulse]');const cue=dock.querySelector('[data-pf-flow-cue]');
  const cueIcon=dock.querySelector('[data-pf-flow-cue-icon]');const badge=dock.querySelector('[data-pf-flow-badge]');
  pulse.dataset.state=attention?'new':cueState.waiting?'waiting':'calm';
  pulse.setAttribute('aria-label',attention?'New action; clear taskbar notification':cueState.snoozed?`Action waiting; reminder in ${cueState.snoozeMinutes} minutes`:cueState.waiting?'Action waiting; open Pacefold controls':'Open Pacefold controls');
  badge.hidden=!attention;cue.hidden=!cueState.waiting;
  for(const node of dock.querySelectorAll('[data-pf-flow-cue-text]'))node.textContent=cueState.text;
  cueIcon.textContent=sourceIcon();
  dock.querySelector('[data-pf-flow-taskbar]').textContent=cueState.snoozed?`Remind in ${cueState.snoozeMinutes}m`:cueState.waiting?(cueState.acknowledged?'Quieted · action waiting':'Taskbar attention pending'):'Clear';
  dock.querySelector('[data-pf-flow-count]').textContent=String(todayCount());
  let lock=null;try{lock=safeParse(localStorage.getItem(SYNC_LOCK_KEY),null);}catch{}
  dock.querySelector('[data-pf-flow-sync-state]').textContent=lock&&Number(lock.until)>Date.now()?'Syncing…':'Ready';
  for(const button of dock.querySelectorAll('[data-pf-flow-tool]'))button.disabled=!capability(button.dataset.pfFlowTool);
  dock.querySelector('[data-pf-flow-done]').disabled=!cueState.waiting||!capability('cue');
  dock.querySelector('[data-pf-flow-ack]').disabled=!cueState.waiting||cueState.acknowledged||cueState.snoozed;
  const snooze=dock.querySelector('[data-pf-flow-snooze]');
  snooze.disabled=!cueState.waiting;snooze.textContent=cueState.snoozed?`Reset 10m`:'Remind 10m';
  syncBadge(cueState);
}
function reconcileSafely(){
  try{reconcileState();}
  catch(error){reportError('reconcile',error);try{dock?.remove();}catch{}dock=null;mountedRoot=null;setTimeout(queueMount,120);}
}
function pulseClick(event){
  if(event.detail>1)return;clearTimeout(clickTimer);const current=readCue();
  if(current.waiting&&!current.acknowledged&&!current.snoozed){acknowledge('pulse');return;}
  clickTimer=setTimeout(togglePanel,180);
}
function pulseDoubleClick(){clearTimeout(clickTimer);setPanel(true);}
function doneCue(){if(forward('cue')){clearCueTaskbarState();setPanel(false,false);setTimeout(reconcileSafely,120);}}
function syncPage(){
  if(resolveAction('sync')?.control){forward('sync');return;}
  if(!forward('notebook'))return;
  let attempts=0;
  const retry=()=>{attempts+=1;if(resolveAction('sync')?.control){forward('sync');return;}if(attempts<8)setTimeout(retry,120);else showStatus('Open a notebook page, then sync.','warning');};
  setTimeout(retry,100);
}
function runTool(event){const kind=event.currentTarget.dataset.pfFlowTool;if(kind)forward(kind);}
function handleLaunchIntent(){
  const url=new URL(location.href);const intent=url.searchParams.get('pf');if(!intent)return;
  url.searchParams.delete('pf');history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  setTimeout(()=>{if(intent==='capture')focusCapture();else if(intent==='current')setPanel(true);else if(intent==='notebook')forward('notebook');else if(intent==='media')forward('media');},120);
}
function bindDock(){
  dock.querySelector('[data-pf-flow-pulse]').addEventListener('click',guarded('pulse-click',pulseClick));dock.querySelector('[data-pf-flow-pulse]').addEventListener('dblclick',guarded('pulse-double',pulseDoubleClick));
  dock.querySelector('[data-pf-flow-cue]').addEventListener('click',guarded('cue-open',()=>setPanel(true)));dock.querySelector('[data-pf-flow-form]').addEventListener('submit',guarded('capture',submitCapture));
  dock.querySelector('[data-pf-flow-more]').addEventListener('click',guarded('panel-toggle',togglePanel));dock.querySelector('[data-pf-flow-close]').addEventListener('click',guarded('panel-close',()=>setPanel(false)));
  dock.querySelector('[data-pf-flow-ack]').addEventListener('click',guarded('acknowledge',()=>acknowledge('panel')));dock.querySelector('[data-pf-flow-snooze]').addEventListener('click',guarded('snooze',()=>snoozeCue(10)));dock.querySelector('[data-pf-flow-done]').addEventListener('click',guarded('done',doneCue));
  dock.querySelector('[data-pf-flow-focus-capture]').addEventListener('click',guarded('capture-focus',focusCapture));dock.querySelector('[data-pf-flow-sync]').addEventListener('click',guarded('sync',syncPage));
  for(const button of dock.querySelectorAll('[data-pf-flow-tool]'))button.addEventListener('click',guarded('tool',runTool));
}
function markup(){return `
  <div class="pf-flow-bar">
    <button class="pf-flow-pulse" type="button" data-pf-flow-pulse data-state="calm" aria-label="Open Pacefold controls"><span class="pf-flow-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="pf-flow-badge" data-pf-flow-badge hidden></span></button>
    <button class="pf-flow-cue" type="button" data-pf-flow-cue hidden><span class="pf-flow-cue-icon" data-pf-flow-cue-icon aria-hidden="true">·</span><span data-pf-flow-cue-text>No action waiting</span></button>
    <form class="pf-flow-capture" data-pf-flow-form data-pf-flow-proxy><label class="pf-flow-sr" for="pf-flow-input">Capture to the HSSys notebook</label><input id="pf-flow-input" data-pf-flow-input autocomplete="off" maxlength="1200" placeholder="Capture…  /incident  /follow  /jhsc"><button type="submit" aria-label="Save capture"><span aria-hidden="true">↵</span></button></form>
    <button class="pf-flow-tool" type="button" data-pf-flow-tool="notebook" data-pf-flow-proxy aria-label="Open notebook"><span aria-hidden="true">▤</span><small>Notes</small></button>
    <button class="pf-flow-tool" type="button" data-pf-flow-tool="media" data-pf-flow-proxy aria-label="Open player"><span aria-hidden="true">♪</span><small>Media</small></button>
    <button class="pf-flow-more" type="button" data-pf-flow-more aria-expanded="false" aria-controls="pf-flow-panel" aria-label="Open Pacefold controls"><span></span><span></span></button>
  </div>
  <div class="pf-flow-status" data-pf-flow-status role="status" aria-live="polite" hidden></div>
  <section id="pf-flow-panel" class="pf-flow-panel" data-pf-flow-panel hidden aria-label="Pacefold quick controls">
    <header><div><span class="pf-flow-eyebrow">Pacefold</span><strong data-pf-flow-primary tabindex="-1">One day, gently folded.</strong></div><button type="button" data-pf-flow-close aria-label="Close quick controls">×</button></header>
    <div class="pf-flow-now"><span>Now</span><b data-pf-flow-cue-text>No action waiting</b><div class="pf-flow-now-actions"><button type="button" data-pf-flow-ack>Quiet taskbar</button><button type="button" data-pf-flow-snooze>Remind 10m</button><button type="button" data-pf-flow-done>Done</button></div></div>
    <div class="pf-flow-grid">
      <button type="button" data-pf-flow-focus-capture><span>＋</span><b>Capture</b><small>Slash routes included</small></button>
      <button type="button" data-pf-flow-tool="notebook" data-pf-flow-proxy><span>▤</span><b>Notebook</b><small><i data-pf-flow-count>0</i> today</small></button>
      <button type="button" data-pf-flow-tool="media" data-pf-flow-proxy><span>♪</span><b>Media</b><small>Contained playback</small></button>
      <button type="button" data-pf-flow-tool="weather" data-pf-flow-proxy><span>○</span><b>Weather</b><small>Forecast on demand</small></button>
      <button type="button" data-pf-flow-sync><span>↥</span><b>OneNote</b><small data-pf-flow-sync-state>Ready</small></button>
      <button type="button" data-pf-flow-tool="system" data-pf-flow-proxy><span>···</span><b>System</b><small>Local diagnostics</small></button>
    </div>
    <footer><span>Taskbar</span><b data-pf-flow-taskbar>Clear</b><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>Space</kbd></footer>
  </section>`;}
function createDock(nextRoot){const element=document.createElement('aside');element.id=DOCK_ID;element.dataset.version=VERSION;element.setAttribute('aria-label','Pacefold action dock');window.__PACEFOLD_SET_HTML__(element,markup());nextRoot.append(element);return element;}
function unmount(){clearTimeout(snoozeTimer);snoozeTimer=0;dock?.remove();dock=null;root=null;mountedRoot=null;document.documentElement.classList.remove('pf-flow-active');document.title=originalTitle;clearBadge();}
function mount(){
  enhanceCoreSurface();
  if(setupVisible()){unmount();return;}
  const nextRoot=document.getElementById(ROOT_ID);if(!nextRoot){unmount();return;}
  if(mountedRoot===nextRoot&&dock?.isConnected){reconcileSafely();return;}
  dock?.remove();root=nextRoot;mountedRoot=nextRoot;dock=nextRoot.querySelector(`#${DOCK_ID}`);
  if(!dock||dock.dataset.version!==VERSION){dock?.remove();dock=createDock(nextRoot);}
  root.classList.add('pf25-workspace-active');document.documentElement.classList.add('pf-flow-active');bindDock();
  try{if(sessionStorage.getItem(PANEL_KEY)==='open')setPanel(true,false);}catch{}
  markOriginalSources();reconcileSafely();handleLaunchIntent();
}
function queueMount(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;try{mount();}catch(error){reportError('mount',error);try{dock?.remove();}catch{}dock=null;mountedRoot=null;setTimeout(queueMount,140);}});}
function keydown(event){
  if(event.key==='Escape'&&dock&&!dock.querySelector('[data-pf-flow-panel]').hidden){setPanel(false);return;}
  if(event.ctrlKey&&event.shiftKey&&event.code==='Space'){event.preventDefault();togglePanel();return;}
  if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){event.preventDefault();focusCapture();}
}
function focusAcknowledge(){setTimeout(()=>{const state=readCue();if(state.waiting&&!state.acknowledged&&!state.snoozed)acknowledge('focus');},80);}

new MutationObserver(guarded('observer',mutations=>{if(mutations.length&&mutations.every(item=>item.target instanceof Element&&item.target.closest?.(`#${DOCK_ID}`)))return;queueMount();})).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-hidden','disabled','data-view','data-screen','data-step','data-theme']});
document.addEventListener('keydown',guarded('keydown',keydown));window.addEventListener('focus',guarded('focus',focusAcknowledge));window.addEventListener('pageshow',queueMount);window.addEventListener('online',queueMount);window.addEventListener('pacefold:storage-changed',queueMount);
window.addEventListener('storage',event=>{if([ENTRY_KEY,ACK_KEY,SNOOZE_KEY,SYNC_LOCK_KEY].includes(event.key))queueMount();});
[0,80,240,700,1600].forEach(delay=>setTimeout(queueMount,delay));setInterval(guarded('heartbeat',()=>{if(document.visibilityState==='visible')reconcileSafely();}),1500);
window.__PACEFOLD_FLOW__={version:VERSION,mount,reconcile:reconcileSafely,acknowledge,snooze:snoozeCue,focusCapture,setPanel,updateFoldStrip};
})();
;
(()=>{if(window.__PACEFOLD_SET_HTML__)return;window.__PACEFOLD_SET_HTML__=(node,value)=>{if(!node)return node;const html=window.__PACEFOLD_TRUSTED_HTML__?window.__PACEFOLD_TRUSTED_HTML__(String(value)):String(value);Reflect.set(node,'innerHTML',html);return node;};})();
(() => {
'use strict';

const REVISION='25.0.0';
const ROOT_ID='pf25-root';
const DOCK_ID='pf-flow-dock';
const WORKSPACE_ID='pf-local-workspace';
const PLAYER_ID='pf-local-player';
const ENTRY_KEY='pacefold.notebook.entries.v2';
const CATEGORY_KEY='pacefold.notebook.categories.v1';
const NOTEBOOK_UI_KEY='pacefold.notebook.ui.v1';
const PLAYER_KEY='pacefold.player.local.v2';
const PLAYLIST_KEY='pacefold.player.playlists.v1';
const STREAM_KEY='pacefold.player.streaming-links.v1';
const NOTEBOOK_DRAFT_KEY='pacefold.notebook.draft.v1';
const VISUAL_RESET_KEY='pacefold.visual-reset.25.0.0';
const WORK_OVERRIDE_KEY='pacefold.flow.work-hours.v1';
const DB_NAME='pacefold-local-media';
const DB_VERSION=1;
const TRACK_STORE='tracks';
const DEFAULT_CATEGORIES=['Inbox','Follow-ups','Incidents','Inspections','JHSC','Construction','Notifications','Resources'];
const SMART_RULES=[
  ['Incidents',/(incident|injur|spill|exposure|near miss|first aid|accident)/i],
  ['Inspections',/(inspect|deficien|finding|corrective|hazard|audit)/i],
  ['Follow-ups',/(follow[ -]?up|remind|waiting|email|call back|check with|pending)/i],
  ['JHSC',/(jhsc|committee|minutes|worker member|management member)/i],
  ['Construction',/(construction|contractor|renovation|project site|permit)/i],
  ['Notifications',/(notification|alert|announcement|communicat)/i],
  ['Resources',/(resource|reference|link|guide|standard|procedure|policy)/i]
];
const SLASH_CATEGORIES={
  daily:'Inbox',note:'Inbox',inbox:'Inbox',follow:'Follow-ups',followup:'Follow-ups','follow-up':'Follow-ups',
  incident:'Incidents',incidents:'Incidents',inspect:'Inspections',inspection:'Inspections',
  jhsc:'JHSC',construction:'Construction',notification:'Notifications',notifications:'Notifications',
  resource:'Resources',resources:'Resources'
};

let root=null;
let dock=null;
let workspace=null;
let player=null;
let observer=null;
let frame=0;
let workTimer=0;
let notificationTimer=0;
let statusTimer=0;
let migrateTimer=0;
let notebookRenderKey='';
let playerDrawerRenderKey='';
let notebookMotionTimer=0;
let notebookAutoCloseTimer=0;
let playerMotionTimer=0;
let dbPromise=null;
let trackCache=[];
const storedPlayerState=readJSON(PLAYER_KEY,null);
let playerState=storedPlayerState&&typeof storedPlayerState==='object'&&!Array.isArray(storedPlayerState)?{queue:Array.isArray(storedPlayerState.queue)?storedPlayerState.queue:[],currentId:storedPlayerState.currentId||null,volume:Number.isFinite(Number(storedPlayerState.volume))?Number(storedPlayerState.volume):.72,drawer:Boolean(storedPlayerState.drawer),view:['queue','library','playlists','streaming'].includes(storedPlayerState.view)?storedPlayerState.view:'queue',search:String(storedPlayerState.search||'')}:{queue:[],currentId:null,volume:.72,drawer:false,view:'queue',search:''};
const storedPlaylists=readJSON(PLAYLIST_KEY,[]);
let playlists=Array.isArray(storedPlaylists)?storedPlaylists.filter(item=>item&&typeof item==='object').map(item=>({...item,id:item.id||uid('playlist'),name:compact(item.name)||'Playlist',trackIds:Array.isArray(item.trackIds)?item.trackIds:[]})):[];
const storedStreamLinks=readJSON(STREAM_KEY,[]);
let streamLinks=Array.isArray(storedStreamLinks)?storedStreamLinks.filter(item=>item&&typeof item==='object'&&/^https?:\/\//i.test(String(item.url||''))).map(item=>({...item,id:item.id||uid('stream'),name:compact(item.name)||'Streaming link',url:String(item.url)})):[];
const storedNotebookState=readJSON(NOTEBOOK_UI_KEY,null);
let notebookState=storedNotebookState&&typeof storedNotebookState==='object'&&!Array.isArray(storedNotebookState)?{open:storedNotebookState.open!==false,filter:String(storedNotebookState.filter||'today'),date:/^\d{4}-\d{2}-\d{2}$/.test(String(storedNotebookState.date||''))?storedNotebookState.date:localDate(),search:String(storedNotebookState.search||''),editingId:storedNotebookState.editingId||null,category:compact(storedNotebookState.category)||'Smart'}:{open:true,filter:'today',date:localDate(),search:'',editingId:null,category:'Smart'};
let audio=null;
let currentObjectUrl='';
let workCache={at:0,value:{configured:false,active:true,start:null,end:null,label:'Work hours follow Pacefold setup'}};
const originalSetBadge=typeof navigator.setAppBadge==='function'?navigator.setAppBadge.bind(navigator):null;
const originalClearBadge=typeof navigator.clearAppBadge==='function'?navigator.clearAppBadge.bind(navigator):null;

function safeParse(raw,fallback){try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
function readJSON(key,fallback){try{return safeParse(localStorage.getItem(key),fallback);}catch{return fallback;}}
function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(error){report(`storage-${key}`,error);return false;}}
function compact(value){return String(value??'').replace(/\s+/g,' ').trim();}
function uid(prefix='pf'){try{return `${prefix}-${crypto.randomUUID()}`;}catch{return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;}}
function localDate(date=new Date()){const offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,10);}
function localTime(value){const date=new Date(value);if(Number.isNaN(date.getTime()))return '';return date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}
function longDate(value){const date=new Date(`${value}T12:00:00`);return date.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'});}
function report(kind,error){try{window.__PACEFOLD_DIAGNOSTICS__?.recordError?.(`workspace-${kind}`,error);}catch{}}
function guarded(kind,fn){return function(...args){try{const result=fn.apply(this,args);if(result?.catch)result.catch(error=>report(kind,error));return result;}catch(error){report(kind,error);return undefined;}};}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function setHTML(node,html){if(!node)return;const setter=window.__PACEFOLD_SET_HTML__;if(setter)setter(node,html);else window.__PACEFOLD_SET_HTML__(node,html);}
function saveNotebookState(){writeJSON(NOTEBOOK_UI_KEY,{...notebookState,open:true});}
function readNotebookDraft(){const value=readJSON(NOTEBOOK_DRAFT_KEY,null);return value&&typeof value==='object'&&!Array.isArray(value)?{body:String(value.body||'').slice(0,8000),at:Number(value.at)||0}:null;}
function writeNotebookDraft(body){const value=String(body||'').slice(0,8000);if(!value){try{localStorage.removeItem(NOTEBOOK_DRAFT_KEY);}catch{}return;}writeJSON(NOTEBOOK_DRAFT_KEY,{body:value,at:Date.now()});}
function clearNotebookDraft(){try{localStorage.removeItem(NOTEBOOK_DRAFT_KEY);}catch{}}
function restoreNotebookDraft(){const field=workspace?.querySelector('[data-pf-note-body]'),draft=readNotebookDraft();if(field&&!field.value&&draft?.body)field.value=draft.body;}
function scheduleNotebookAutoClose(){clearTimeout(notebookAutoCloseTimer);notebookAutoCloseTimer=0;}
function savePlayerState(){writeJSON(PLAYER_KEY,{...playerState,drawer:false});}
function savePlaylists(){writeJSON(PLAYLIST_KEY,playlists);}
function saveStreamLinks(){writeJSON(STREAM_KEY,streamLinks);}
function applyVisualReset(){try{if(localStorage.getItem(VISUAL_RESET_KEY)==='1')return;notebookState.open=true;notebookState.editingId=null;saveNotebookState();playerState.drawer=false;playerState.view='queue';savePlayerState();localStorage.setItem(VISUAL_RESET_KEY,'1');}catch{}}
function notebookDataKey(){try{return `${localStorage.getItem(ENTRY_KEY)||''}\u0000${localStorage.getItem(CATEGORY_KEY)||''}`;}catch{return '';} }
function playerDrawerDataKey(){return JSON.stringify({view:playerState.view,drawer:Boolean(playerState.drawer),currentId:playerState.currentId,queue:playerState.queue,tracks:trackCache.map(track=>[track.id,track.name,track.fileName,track.size]),playlists,streamLinks});}
function dispatchStorage(){window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{source:'local-workspace'}}));}

function normalizedKey(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function parseClock(value){
  if(typeof value==='number'&&Number.isFinite(value)){const minutes=Math.round(value<=24?value*60:value);return minutes>=0&&minutes<1440?minutes:null;}
  const match=String(value||'').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if(!match)return null;
  let hour=Number(match[1]),minute=Number(match[2]||0);if(minute>59)return null;
  const suffix=match[3]?.replace(/\./g,'');
  if(suffix){if(hour<1||hour>12)return null;if(suffix==='pm'&&hour!==12)hour+=12;if(suffix==='am'&&hour===12)hour=0;}
  return hour<=23?hour*60+minute:null;
}
function formatClock(minutes){if(minutes==null)return '';const hour=Math.floor(minutes/60),minute=minutes%60;return `${hour%12||12}:${String(minute).padStart(2,'0')} ${hour>=12?'PM':'AM'}`;}
function findTime(object,names,depth=0,seen=new Set()){
  if(!object||typeof object!=='object'||depth>4||seen.has(object))return null;seen.add(object);
  for(const [key,value] of Object.entries(object)){if(names.has(normalizedKey(key))){const parsed=parseClock(value);if(parsed!=null)return parsed;}}
  for(const value of Object.values(object)){const parsed=findTime(value,names,depth+1,seen);if(parsed!=null)return parsed;}
  return null;
}
function findDays(object,depth=0,seen=new Set()){
  if(!object||typeof object!=='object'||depth>4||seen.has(object))return null;seen.add(object);
  for(const [key,value] of Object.entries(object)){
    if(!['workdays','weekdays','activedays','days'].includes(normalizedKey(key)))continue;
    const values=Array.isArray(value)?value:String(value||'').split(/[\s,;]+/);
    const days=values.map(item=>{if(Number.isInteger(Number(item)))return Number(item);return ['sun','mon','tue','wed','thu','fri','sat'].indexOf(String(item).slice(0,3).toLowerCase());}).filter(day=>day>=0&&day<=6);
    if(days.length)return [...new Set(days)];
  }
  for(const value of Object.values(object)){const found=findDays(value,depth+1,seen);if(found)return found;}
  return null;
}
function readWorkWindow(force=false){
  if(!force&&Date.now()-workCache.at<5000)return workCache.value;
  const startNames=new Set(['workstart','workdaystart','daystart','shiftstart','starttime','workhoursstart','workfrom','officehoursstart']);
  const endNames=new Set(['workend','workdayend','dayend','shiftend','endtime','workhoursend','workto','officehoursend']);
  const candidates=[];
  try{const override=safeParse(localStorage.getItem(WORK_OVERRIDE_KEY),null);if(override)candidates.push({source:'Pacefold override',value:override});}catch{}
  try{for(let index=0;index<localStorage.length;index+=1){const key=localStorage.key(index);if(!key||!key.toLowerCase().includes('pacefold'))continue;const value=safeParse(localStorage.getItem(key),null);if(value&&typeof value==='object')candidates.push({source:key,value});}}catch{}
  const dataset={workStart:root?.dataset?.workStart,workEnd:root?.dataset?.workEnd};if(dataset.workStart||dataset.workEnd)candidates.unshift({source:'Pacefold screen',value:dataset});
  let match=null;
  for(const candidate of candidates){const start=findTime(candidate.value,startNames),end=findTime(candidate.value,endNames);if(start!=null&&end!=null){match={...candidate,start,end,days:findDays(candidate.value)};break;}}
  if(!match){const value={configured:false,active:true,start:null,end:null,label:'Work hours follow Pacefold setup'};workCache={at:Date.now(),value};return value;}
  const now=new Date(),minutes=now.getHours()*60+now.getMinutes(),dayAllowed=!match.days||match.days.includes(now.getDay());
  const inRange=match.start<=match.end?minutes>=match.start&&minutes<match.end:minutes>=match.start||minutes<match.end;
  const value={configured:true,active:dayAllowed&&inRange,start:match.start,end:match.end,label:`${formatClock(match.start)}–${formatClock(match.end)}`,source:match.source};
  workCache={at:Date.now(),value};return value;
}
async function closeNotifications(){try{const registration=await navigator.serviceWorker?.getRegistration?.();const notifications=await registration?.getNotifications?.();for(const item of notifications||[])item.close();}catch{}}
async function clearBadge(){try{await originalClearBadge?.();}catch{}}
function installBadgePolicy(){
  if(!originalSetBadge)return;
  const replacement=async()=>{const work=readWorkWindow();if(!work.active){await clearBadge();return;}return originalSetBadge();};
  try{Object.defineProperty(navigator,'setAppBadge',{configurable:true,value:replacement});}catch{try{navigator.setAppBadge=replacement;}catch{}}
}
function applyWorkState(){
  const work=readWorkWindow();document.documentElement.classList.toggle('pf25-offhours',!work.active);
  const hours=workspace?.querySelector('[data-pf-work-hours]');if(hours)hours.textContent=work.configured?(work.active?`Working · ${work.label}`:`Off hours · ${work.label}`):work.label;
  if(!work.active){clearBadge();closeNotifications();}
  else if(!notificationTimer){notificationTimer=setTimeout(()=>{notificationTimer=0;closeNotifications();},8000);}
  try{navigator.serviceWorker?.controller?.postMessage?.({type:'PACEFOLD_WORK_STATE',active:work.active,configured:work.configured,start:work.start,end:work.end,at:Date.now()});}catch{}
}

function rawEntries(){const value=readJSON(ENTRY_KEY,[]);return Array.isArray(value)?value:[];}
function normalizeEntry(item,index=0){
  const date=String(item?.date||item?.createdAt||item?.timestamp||localDate()).slice(0,10);
  const createdAt=item?.createdAt||item?.timestamp||item?.at||`${date}T12:${String(index%60).padStart(2,'0')}:00`;
  const category=compact(item?.category||item?.section||'Inbox')||'Inbox';
  return {...item,id:item?.id||uid('note'),body:String(item?.body??item?.text??''),date,createdAt,updatedAt:item?.updatedAt||createdAt,category,section:item?.section||category,pinned:Boolean(item?.pinned),archived:Boolean(item?.archived),completed:Boolean(item?.completed),format:item?.format||'markdown'};
}
function entries(){return rawEntries().map(normalizeEntry);}
function migrateEntries(){
  const source=rawEntries();let changed=false;
  const next=source.map((item,index)=>{const normalized=normalizeEntry(item,index);for(const key of ['id','body','date','createdAt','updatedAt','category','section','pinned','archived','completed','format'])if(item?.[key]!==normalized[key]){changed=true;break;}return normalized;});
  if(changed&&writeJSON(ENTRY_KEY,next))dispatchStorage();
  return next;
}
function writeEntries(next){if(writeJSON(ENTRY_KEY,next)){dispatchStorage();return true;}showStatus('Notes could not be saved on this device.','warning');return false;}
function customCategories(){const value=readJSON(CATEGORY_KEY,[]);return Array.isArray(value)?value.map(compact).filter(Boolean):[];}
function categories(allEntries=entries()){
  const found=[...DEFAULT_CATEGORIES,...customCategories(),...allEntries.map(item=>item.category)].map(compact).filter(Boolean);
  return [...new Set(found)].sort((a,b)=>a==='Inbox'?-1:b==='Inbox'?1:a.localeCompare(b));
}
function addCategory(name){name=compact(name).slice(0,40);if(!name)return false;const next=[...new Set([...customCategories(),name])];writeJSON(CATEGORY_KEY,next);notebookState.category=name;notebookState.filter=`category:${name}`;saveNotebookState();renderNotebook();return true;}
function parseNote(value,chosen='Smart'){
  let body=String(value||'').trim();let category=chosen;
  const slash=body.match(/^\/([\w-]+)\s*/);
  if(slash&&SLASH_CATEGORIES[slash[1].toLowerCase()]){category=SLASH_CATEGORIES[slash[1].toLowerCase()];body=body.slice(slash[0].length).trim();}
  if(category==='Smart')category=SMART_RULES.find(([,pattern])=>pattern.test(body))?.[0]||'Inbox';
  return {body,category};
}
function noteTimestamp(entry){return entry.createdAt||`${entry.date}T12:00:00`;}
function filteredEntries(){
  const all=entries().filter(item=>!item.archived);const search=compact(notebookState.search).toLowerCase();
  return all.filter(item=>{
    if(search&&!`${item.body} ${item.category}`.toLowerCase().includes(search))return false;
    if(notebookState.filter==='today')return item.date===notebookState.date;
    if(notebookState.filter==='all')return true;
    if(notebookState.filter==='pinned')return item.pinned;
    if(notebookState.filter.startsWith('category:'))return item.category===notebookState.filter.slice(9);
    return true;
  }).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||new Date(noteTimestamp(a))-new Date(noteTimestamp(b)));
}
function inlineMarkup(text){return esc(text).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/_([^_]+)_/g,'<em>$1</em>');}
function noteMarkup(body){
  const lines=String(body||'').split(/\r?\n/);let html='';let list=null;
  const closeList=()=>{if(list){html+=`</${list}>`;list=null;}};
  for(const raw of lines){
    const line=raw.trimEnd();
    if(/^###\s+/.test(line)){closeList();html+=`<h4>${inlineMarkup(line.replace(/^###\s+/,''))}</h4>`;continue;}
    if(/^##\s+/.test(line)){closeList();html+=`<h3>${inlineMarkup(line.replace(/^##\s+/,''))}</h3>`;continue;}
    if(/^#\s+/.test(line)){closeList();html+=`<h2>${inlineMarkup(line.replace(/^#\s+/,''))}</h2>`;continue;}
    const task=line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);if(task){if(list!=='ul'){closeList();list='ul';html+='<ul class="pf-task-list">';}html+=`<li data-checked="${task[1].toLowerCase()==='x'}"><span aria-hidden="true">${task[1].toLowerCase()==='x'?'✓':'○'}</span>${inlineMarkup(task[2])}</li>`;continue;}
    const bullet=line.match(/^[-*]\s+(.*)$/);if(bullet){if(list!=='ul'){closeList();list='ul';html+='<ul>';}html+=`<li>${inlineMarkup(bullet[1])}</li>`;continue;}
    const number=line.match(/^\d+[.)]\s+(.*)$/);if(number){if(list!=='ol'){closeList();list='ol';html+='<ol>';}html+=`<li>${inlineMarkup(number[1])}</li>`;continue;}
    closeList();html+=line?`<p>${inlineMarkup(line)}</p>`:'<br>';
  }
  closeList();return html;
}
function createEntry(body,category){
  const parsed=parseNote(body,category);if(!parsed.body)return false;const now=new Date().toISOString();const next=entries();
  next.push({id:uid('note'),body:parsed.body,date:localDate(),createdAt:now,updatedAt:now,category:parsed.category,section:parsed.category,pinned:false,archived:false,completed:false,format:'markdown'});
  notebookState.date=localDate();notebookState.filter=`category:${parsed.category}`;notebookState.category=parsed.category;notebookState.editingId=null;saveNotebookState();return writeEntries(next);
}
function updateEntry(id,patch){const next=entries();const index=next.findIndex(item=>item.id===id);if(index<0)return false;next[index]={...next[index],...patch,updatedAt:new Date().toISOString()};return writeEntries(next);}
function deleteEntry(id){const next=entries().filter(item=>item.id!==id);if(notebookState.editingId===id)notebookState.editingId=null;saveNotebookState();return writeEntries(next);}
function copyText(text){
  if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);
  const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();document.execCommand('copy');field.remove();return Promise.resolve();
}
function dayDocument(date=notebookState.date){
  const dayEntries=entries().filter(item=>!item.archived&&item.date===date).sort((a,b)=>new Date(noteTimestamp(a))-new Date(noteTimestamp(b)));
  const grouped=new Map();for(const item of dayEntries){if(!grouped.has(item.category))grouped.set(item.category,[]);grouped.get(item.category).push(item);}
  const rhythm=window.__PACEFOLD_EXPORT__?.rhythmMarkdown?.(date)||'';const lines=[`# Pacefold — ${longDate(date)}`,'',...(rhythm?rhythm.trimEnd().split('\n'):[])];
  for(const [category,items] of grouped){lines.push(`## ${category}`);for(const item of items){const mark=item.completed?'✓':'•';lines.push(`${mark} ${localTime(noteTimestamp(item))} — ${item.body.replace(/\n/g,'\n  ')}`);}lines.push('');}
  if(!dayEntries.length)lines.push('_No notes captured._');
  return lines.join('\n').trim();
}
async function copyDay(){await copyText(dayDocument());showStatus(`Copied ${longDate(notebookState.date)}.`,'success');}
function downloadFile(name,type,content){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
function exportDay(){downloadFile(`pacefold-${notebookState.date}.md`,'text/markdown',dayDocument());showStatus('Day exported as Markdown.','success');}
function exportBackup(){if(window.__PACEFOLD_BACKUP__)return window.__PACEFOLD_BACKUP__.exportBackup({entries:entries(),categories:customCategories(),playlists,streamLinks},showStatus);downloadFile(`pacefold-backup-${localDate()}.json`,'application/json',JSON.stringify({version:REVISION,exportedAt:new Date().toISOString(),entries:entries(),categories:customCategories(),playlists,streamLinks},null,2));showStatus('Local backup downloaded.','success');}
async function importBackup(file){
  if(window.__PACEFOLD_BACKUP__)return window.__PACEFOLD_BACKUP__.restoreBackup(file,{snapshot:()=>({entries:entries(),categories:customCategories(),playlists,streamLinks}),apply:data=>{writeEntries(data.entries);writeJSON(CATEGORY_KEY,data.categories);playlists=data.playlists;savePlaylists();streamLinks=data.streamLinks;saveStreamLinks();renderNotebook();renderPlayerDrawer();}},showStatus);
  const text=await file.text();const data=JSON.parse(text);if(!Array.isArray(data.entries))throw new Error('Backup does not contain notes.');
  const existing=entries(),byId=new Map(existing.map(item=>[item.id,item]));for(const item of data.entries.map(normalizeEntry))byId.set(item.id,item);writeEntries([...byId.values()]);
  if(Array.isArray(data.categories))writeJSON(CATEGORY_KEY,[...new Set([...customCategories(),...data.categories.map(compact).filter(Boolean)])]);
  if(Array.isArray(data.playlists)){playlists=data.playlists;savePlaylists();}
  if(Array.isArray(data.streamLinks)){streamLinks=data.streamLinks;saveStreamLinks();}
  renderNotebook();renderPlayerDrawer();showStatus('Backup merged into this device.','success');
}

function notebookMarkup(){return `
  <div class="pf-notebook-sheet" data-pf-notebook-sheet>
    <header class="pf-notebook-head">
      <div><span class="pf-kicker">Local notebook</span><strong data-pf-notebook-date>${esc(longDate(notebookState.date))}</strong><small data-pf-work-hours>Work hours follow Pacefold setup</small></div>
      <div class="pf-notebook-head-actions">
        <button type="button" data-pf-date-prev aria-label="Previous day">‹</button><button type="button" data-pf-date-today>Today</button><button type="button" data-pf-date-next aria-label="Next day">›</button>
        <button type="button" data-pf-copy-day>Copy day</button><button type="button" data-pf-export-menu aria-label="Notebook export and backup">•••</button>
      </div>
    </header>
    <div class="pf-notebook-tools">
      <label><span>Find</span><input type="search" data-pf-note-search placeholder="Search this notebook" value="${esc(notebookState.search)}"></label>
      <div class="pf-format-tools" role="toolbar" aria-label="Note formatting">
        <button type="button" data-pf-format="bold" title="Bold"><b>B</b></button><button type="button" data-pf-format="italic" title="Italic"><i>I</i></button><button type="button" data-pf-format="heading" title="Heading">H</button><button type="button" data-pf-format="bullet" title="Bullet list">•</button><button type="button" data-pf-format="task" title="Task">☐</button>
      </div>
    </div>
    <form class="pf-note-composer" data-pf-note-composer>
      <div class="pf-note-composer-row">
        <select data-pf-note-category aria-label="Note category"></select>
        <span class="pf-note-mode" data-pf-note-mode>New timestamped note</span>
        <button type="button" data-pf-note-cancel hidden>Cancel</button>
      </div>
      <textarea data-pf-note-body rows="3" maxlength="8000" placeholder="Write here. Use /incident, /follow, /jhsc…"></textarea>
      <div class="pf-note-composer-foot"><small>Saved locally on this device · Markdown formatting</small><button type="submit" data-pf-note-save>Save note</button></div>
    </form>
    <section class="pf-note-document" data-pf-note-document aria-live="polite"></section>
    <div class="pf-notebook-export" data-pf-notebook-export hidden>
      <button type="button" data-pf-export-day>Download day (.md)</button><button type="button" data-pf-export-backup>Download full backup (.json)</button><label>Import backup<input type="file" data-pf-import-backup accept="application/json,.json"></label>
    </div>
  </div>
  <nav class="pf-notebook-tabs" data-pf-notebook-tabs aria-label="Notebook categories"></nav>`;}
function workspaceMarkup(){return `<div class="pf-workspace-shell" data-pf-workspace-shell>${notebookMarkup()}</div>`;}
function ensureWorkspace(){
  if(!root||!dock)return;
  workspace=document.getElementById(WORKSPACE_ID);let created=false;
  if(!workspace){workspace=document.createElement('section');workspace.id=WORKSPACE_ID;workspace.dataset.revision=REVISION;workspace.className='pf-local-workspace';workspace.setAttribute('aria-label','Pacefold local notebook');setHTML(workspace,workspaceMarkup());root.append(workspace);bindNotebook();created=true;}
  workspace.dataset.release='25.0.0';workspace.dataset.open=String(notebookState.open!==false);workspace.classList.toggle('is-open',notebookState.open!==false);
  if(dock.parentElement!==workspace)workspace.prepend(dock);
  prepareDock();const dataKey=notebookDataKey();if(created||dataKey!==notebookRenderKey)renderNotebook();
}
function prepareDock(){
  dock.dataset.revision=REVISION;dock.setAttribute('aria-label','Pacefold current action and note capture');
  const legacyPanel=dock.querySelector('[data-pf-flow-panel]');if(legacyPanel)legacyPanel.dataset.pfWorkspaceQuick='true';
  const title=dock.querySelector('[data-pf25-notebook-title]')||document.createElement('button');
  title.type='button';title.className='pf25-notebook-title';title.dataset.pfNotebookTitle='true';title.setAttribute('aria-label','Open or collapse notebook');title.setAttribute('aria-expanded',String(notebookState.open!==false));
  if(title.dataset.pfLocalTitleBound!=='true'){title.dataset.pfLocalTitleBound='true';title.addEventListener('click',guarded('toggle-notebook',toggleNotebook));}
  if(!title.querySelector('[data-pf-dock-note-count]'))setHTML(title,'<strong>Notebook</strong><small data-pf-dock-note-count>Local notes</small>');
  if(!title.isConnected){const cue=dock.querySelector('[data-pf-flow-cue]');dock.querySelector('.pf-flow-bar')?.insertBefore(title,cue||dock.querySelector('.pf-flow-bar')?.children[1]||null);}
  for(const node of dock.querySelectorAll('[data-pf-notebook-sync]'))node.remove();
  for(const node of dock.querySelectorAll('[data-pf-flow-tool="notebook"],[data-pf-flow-tool="media"],[data-pf-flow-sync]'))node.dataset.pfLegacyHidden='true';
  const input=dock.querySelector('[data-pf-flow-input]');if(input){input.placeholder='Add a note…  /incident  /follow  /jhsc';input.maxLength=8000;}
  const form=dock.querySelector('[data-pf-flow-form]');if(form&&form.dataset.pfLocalBound!=='true'){form.dataset.pfLocalBound='true';form.addEventListener('submit',guarded('quick-note',quickCapture),true);}
  const count=dock.querySelector('[data-pf-dock-note-count]');if(count)count.textContent=`${entries().filter(item=>item.date===localDate()&&!item.archived).length} today`;
  for(const popup of root.querySelectorAll('.pf-notebook,[data-pf-notebook-root]')){if(popup.closest(`#${WORKSPACE_ID}`))continue;if(!popup.hidden)popup.hidden=true;if(popup.getAttribute('aria-hidden')!=='true')popup.setAttribute('aria-hidden','true');}
}
function setNotebookOpen(open,focus=true,closePlayer=true){const next=Boolean(open),changed=(notebookState.open!==false)!==next;if(next&&closePlayer&&playerState.drawer)setPlayerDrawer(false);clearTimeout(notebookMotionTimer);clearTimeout(notebookAutoCloseTimer);notebookAutoCloseTimer=0;notebookState.open=next;saveNotebookState();if(!workspace)return;if(changed)workspace.dataset.foldMotion=next?'opening':'closing';workspace.classList.toggle('is-open',next);workspace.setAttribute('data-open',String(next));workspace.querySelector('[data-pf25-notebook-title]')?.setAttribute('aria-expanded',String(next));notebookMotionTimer=setTimeout(()=>{notebookMotionTimer=0;if(workspace?.dataset.foldMotion===(next?'opening':'closing'))delete workspace.dataset.foldMotion;},260);if(next){restoreNotebookDraft();scheduleNotebookAutoClose();if(focus)setTimeout(()=>{if(notebookState.open&&!playerState.drawer)workspace?.querySelector('[data-pf-note-body]')?.focus({preventScroll:true});},180);}}
function toggleNotebook(){setNotebookOpen(!(notebookState.open!==false));}
function quickCapture(event){
  event.preventDefault();event.stopImmediatePropagation();const input=dock?.querySelector('[data-pf-flow-input]');if(!input)return;const chosen=notebookState.category||'Smart';
  if(createEntry(input.value,chosen)){input.value='';renderNotebook();showStatus('Saved quietly to the notebook.','success');}
  else showStatus('Write a note first.','warning');
}
function bindNotebook(){
  workspace.addEventListener('click',guarded('notebook-click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.matches('[data-pf-date-prev]'))changeDate(-1);else if(button.matches('[data-pf-date-next]'))changeDate(1);else if(button.matches('[data-pf-date-today]')){notebookState.date=localDate();notebookState.filter='today';saveNotebookState();renderNotebook();}
    else if(button.matches('[data-pf-copy-day]'))copyDay();else if(button.matches('[data-pf-export-menu]'))toggleExportMenu();else if(button.matches('[data-pf-export-day]'))exportDay();else if(button.matches('[data-pf-export-backup]'))exportBackup();
    else if(button.matches('[data-pf-note-cancel]'))cancelEdit();else if(button.matches('[data-pf-format]'))applyFormat(button.dataset.pfFormat);
    else if(button.matches('[data-pf-tab]'))selectTab(button.dataset.pfTab);else if(button.matches('[data-pf-add-category]'))showCategoryInput();else if(button.matches('[data-pf-save-category]'))saveCategoryInput();
    else if(button.matches('[data-pf-note-edit]'))editNote(button.dataset.pfNoteEdit);else if(button.matches('[data-pf-note-delete]')){if(confirm('Delete this local note?')){deleteEntry(button.dataset.pfNoteDelete);renderNotebook();}}
    else if(button.matches('[data-pf-note-pin]')){const item=entries().find(note=>note.id===button.dataset.pfNotePin);if(item){updateEntry(item.id,{pinned:!item.pinned});renderNotebook();}}
    else if(button.matches('[data-pf-note-done]')){const item=entries().find(note=>note.id===button.dataset.pfNoteDone);if(item){updateEntry(item.id,{completed:!item.completed});renderNotebook();}}
    else if(button.matches('[data-pf-note-copy]')){const item=entries().find(note=>note.id===button.dataset.pfNoteCopy);if(item)copyText(`${localTime(noteTimestamp(item))} — ${item.body}`).then(()=>showStatus('Note copied.','success'));}
  }));
  workspace.querySelector('[data-pf-note-composer]')?.addEventListener('submit',guarded('note-save',saveComposer));
  const draftField=workspace.querySelector('[data-pf-note-body]');draftField?.addEventListener('input',guarded('note-draft',event=>{writeNotebookDraft(event.target.value);scheduleNotebookAutoClose();}));workspace.addEventListener('pointerdown',()=>scheduleNotebookAutoClose());workspace.addEventListener('keydown',()=>scheduleNotebookAutoClose());restoreNotebookDraft();
  workspace.querySelector('[data-pf-note-search]')?.addEventListener('input',guarded('note-search',event=>{notebookState.search=event.target.value;saveNotebookState();renderDocument();renderTabs();}));
  workspace.querySelector('[data-pf-import-backup]')?.addEventListener('change',guarded('backup-import',async event=>{const file=event.target.files?.[0];if(file)await importBackup(file);event.target.value='';}));
  workspace.addEventListener('change',guarded('notebook-change',event=>{if(event.target.matches('[data-pf-note-recategory]')){updateEntry(event.target.dataset.pfNoteRecategory,{category:event.target.value,section:event.target.value});renderNotebook();}}));
}
function changeDate(offset){const date=new Date(`${notebookState.date}T12:00:00`);date.setDate(date.getDate()+offset);notebookState.date=localDate(date);notebookState.filter='today';saveNotebookState();renderNotebook();}
function toggleExportMenu(){const menu=workspace?.querySelector('[data-pf-notebook-export]');if(menu)menu.hidden=!menu.hidden;}
function renderNotebook(){if(!workspace)return;workspace.dataset.open=String(notebookState.open!==false);workspace.classList.toggle('is-open',notebookState.open!==false);const date=workspace.querySelector('[data-pf-notebook-date]');if(date)date.textContent=longDate(notebookState.date);renderCategorySelect();renderDocument();renderTabs();prepareDock();notebookRenderKey=notebookDataKey();}
function renderCategorySelect(){const select=workspace?.querySelector('[data-pf-note-category]');if(!select)return;const options=['Smart',...categories()];setHTML(select,options.map(name=>`<option value="${esc(name)}"${name===notebookState.category?' selected':''}>${esc(name)}</option>`).join(''));select.onchange=()=>{notebookState.category=select.value;saveNotebookState();};}
function renderDocument(){
  const target=workspace?.querySelector('[data-pf-note-document]');if(!target)return;const list=filteredEntries();
  if(!list.length){setHTML(target,`<div class="pf-note-empty"><strong>Nothing here yet.</strong><span>Add a timestamped note above, or change the category tab.</span></div>`);return;}
  const categoryOptions=categories();
  setHTML(target,list.map(item=>`<article class="pf-note-block${item.pinned?' is-pinned':''}${item.completed?' is-complete':''}" data-note-id="${esc(item.id)}">
    <header><div><time datetime="${esc(noteTimestamp(item))}">${esc(localTime(noteTimestamp(item)))}</time><select data-pf-note-recategory="${esc(item.id)}" aria-label="Change category">${categoryOptions.map(name=>`<option value="${esc(name)}"${name===item.category?' selected':''}>${esc(name)}</option>`).join('')}</select></div><div class="pf-note-actions"><button type="button" data-pf-note-done="${esc(item.id)}" title="Mark complete">${item.completed?'↺':'✓'}</button><button type="button" data-pf-note-pin="${esc(item.id)}" title="Pin">${item.pinned?'★':'☆'}</button><button type="button" data-pf-note-copy="${esc(item.id)}" title="Copy">⧉</button><button type="button" data-pf-note-edit="${esc(item.id)}" title="Edit">Edit</button><button type="button" data-pf-note-delete="${esc(item.id)}" title="Delete">×</button></div></header>
    <div class="pf-note-content">${noteMarkup(item.body)}</div>
  </article>`).join(''));
}
function renderTabs(){
  const target=workspace?.querySelector('[data-pf-notebook-tabs]');if(!target)return;const all=entries().filter(item=>!item.archived);const tabData=[['today','Today',all.filter(item=>item.date===notebookState.date).length],['all','All',all.length],['pinned','Pinned',all.filter(item=>item.pinned).length],...categories(all).map(name=>[`category:${name}`,name,all.filter(item=>item.category===name).length])];
  setHTML(target,`${tabData.map(([value,label,count])=>`<button type="button" data-pf-tab="${esc(value)}" aria-pressed="${String(notebookState.filter===value)}"><span>${esc(label)}</span><small>${count}</small></button>`).join('')}<button type="button" class="pf-tab-add" data-pf-add-category aria-label="Add category">＋</button><span class="pf-tab-new" data-pf-tab-new hidden><input data-pf-new-category maxlength="40" placeholder="Category"><button type="button" data-pf-save-category>Add</button></span>`);
}
function selectTab(value){notebookState.filter=value;if(value.startsWith('category:'))notebookState.category=value.slice(9);saveNotebookState();renderNotebook();}
function showCategoryInput(){const wrap=workspace?.querySelector('[data-pf-tab-new]');if(wrap){wrap.hidden=false;wrap.querySelector('input')?.focus();}}
function saveCategoryInput(){const input=workspace?.querySelector('[data-pf-new-category]');if(input&&addCategory(input.value)){input.value='';}}
function saveComposer(event){
  event.preventDefault();const body=workspace.querySelector('[data-pf-note-body]');const select=workspace.querySelector('[data-pf-note-category]');if(!body)return;
  if(notebookState.editingId){const parsed=parseNote(body.value,select?.value||notebookState.category);if(!parsed.body){showStatus('Write a note first.','warning');return;}updateEntry(notebookState.editingId,{body:parsed.body,category:parsed.category,section:parsed.category});notebookState.editingId=null;showStatus('Note updated.','success');}
  else if(createEntry(body.value,select?.value||notebookState.category)){showStatus('Saved locally with a timestamp.','success');}
  body.value='';clearNotebookDraft();saveNotebookState();renderNotebook();updateComposerMode();showStatus('Saved in the notebook.','success');
}
function editNote(id){const item=entries().find(note=>note.id===id);if(!item)return;notebookState.editingId=id;notebookState.open=true;notebookState.category=item.category;saveNotebookState();renderCategorySelect();const body=workspace.querySelector('[data-pf-note-body]');if(body){body.value=item.body;writeNotebookDraft(item.body);body.focus();}updateComposerMode();scheduleNotebookAutoClose();}
function cancelEdit(){notebookState.editingId=null;saveNotebookState();const body=workspace?.querySelector('[data-pf-note-body]');if(body)body.value='';clearNotebookDraft();updateComposerMode();scheduleNotebookAutoClose();}
function updateComposerMode(){const mode=workspace?.querySelector('[data-pf-note-mode]'),cancel=workspace?.querySelector('[data-pf-note-cancel]'),save=workspace?.querySelector('[data-pf-note-save]');if(mode)mode.textContent=notebookState.editingId?'Editing note':'New timestamped note';if(cancel)cancel.hidden=!notebookState.editingId;if(save)save.textContent=notebookState.editingId?'Update note':'Save note';}
function applyFormat(kind){
  const field=workspace?.querySelector('[data-pf-note-body]');if(!field)return;const start=field.selectionStart,end=field.selectionEnd,text=field.value,selected=text.slice(start,end);let before='',after='',insert='';
  if(kind==='bold'){before='**';after='**';}else if(kind==='italic'){before='_';after='_';}else if(kind==='heading'){before='## ';}else if(kind==='bullet'){before='- ';}else if(kind==='task'){before='- [ ] ';}
  insert=before+selected+after;field.setRangeText(insert,start,end,'end');writeNotebookDraft(field.value);scheduleNotebookAutoClose();field.focus();
}

function openDB(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,DB_VERSION);request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains(TRACK_STORE))database.createObjectStore(TRACK_STORE,{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  return dbPromise;
}
async function dbRequest(mode,operation){
  const database=await openDB();
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction(TRACK_STORE,mode),store=transaction.objectStore(TRACK_STORE);let request;
    try{request=operation(store);}catch(error){reject(error);return;}
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);transaction.onabort=()=>reject(transaction.error||new Error('Local media transaction was aborted.'));
  });
}
async function allTracks(){return (await dbRequest('readonly',store=>store.getAll()))||[];}
async function getTrack(id){return (await dbRequest('readonly',store=>store.get(id)))||null;}
async function putTrack(track){await dbRequest('readwrite',store=>store.put(track));return track;}
async function removeTrack(id){await dbRequest('readwrite',store=>store.delete(id));}
function trackId(file){let hash=2166136261;for(const char of `${file.name}|${file.size}|${file.lastModified}`){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return `track-${(hash>>>0).toString(36)}`;}
async function addAudioFiles(files){
  if(window.__PACEFOLD_STORAGE__&&!await window.__PACEFOLD_STORAGE__.allowAudioImport(files))return;
  const audioFiles=[...files].filter(file=>file.type.startsWith('audio/'));if(!audioFiles.length){showPlayerStatus('Choose audio files.');return;}
  showPlayerStatus(`Adding ${audioFiles.length} local file${audioFiles.length===1?'':'s'}…`);
  for(const file of audioFiles){await putTrack({id:trackId(file),name:file.name.replace(/\.[^.]+$/,''),fileName:file.name,type:file.type,size:file.size,lastModified:file.lastModified,addedAt:new Date().toISOString(),blob:file});}
  trackCache=await allTracks();for(const file of audioFiles){const id=trackId(file);if(!playerState.queue.includes(id))playerState.queue.push(id);}if(!playerState.currentId)playerState.currentId=playerState.queue[0]||null;savePlayerState();renderPlayer();renderPlayerDrawer();showPlayerStatus('Saved in this browser for local playback.');
}
function playerMarkup(){return `
  <div class="pf-player-bar" data-pf-player-drop>
    <button type="button" class="pf-player-menu-button" data-pf-player-menu aria-label="Open local music menu" aria-expanded="false">☰</button>
    <div class="pf-player-track"><strong data-pf-player-title>No local track</strong><small data-pf-player-subtitle>Add audio files to begin</small></div>
    <button type="button" data-pf-player-prev aria-label="Previous track">‹</button><button type="button" class="pf-player-play" data-pf-player-play aria-label="Play">▶</button><button type="button" data-pf-player-next aria-label="Next track">›</button>
    <div class="pf-player-progress"><input type="range" data-pf-player-progress min="0" max="1000" value="0" aria-label="Track position"><small data-pf-player-time>0:00 / 0:00</small></div>
    <label class="pf-player-volume"><span aria-hidden="true">◒</span><input type="range" data-pf-player-volume min="0" max="1" step="0.01" value="${Number(playerState.volume)||.72}" aria-label="Volume"></label>
    <label class="pf-player-add">＋<input type="file" data-pf-player-files accept="audio/*" multiple></label>
  </div>
  <section class="pf-player-drawer" data-pf-player-drawer hidden aria-label="Local music library">
    <header><div><span class="pf-kicker">Local audio</span><strong>Your queue and playlists</strong><small data-pf-player-status>Files stay in this browser.</small></div><button type="button" data-pf-player-close aria-label="Close music menu">×</button></header>
    <nav class="pf-player-nav"><button type="button" data-pf-player-view="queue">Queue</button><button type="button" data-pf-player-view="library">Library</button><button type="button" data-pf-player-view="playlists">Playlists</button><button type="button" data-pf-player-view="streaming">Streaming links</button></nav>
    <div class="pf-player-drawer-body" data-pf-player-drawer-body></div>
  </section>`;}
function ensurePlayer(){
  if(!root)return;player=document.getElementById(PLAYER_ID);let created=false;
  if(!player){player=document.createElement('aside');player.id=PLAYER_ID;player.dataset.revision=REVISION;player.className='pf-local-player';player.setAttribute('aria-label','Pacefold local music player');setHTML(player,playerMarkup());root.append(player);audio=document.createElement('audio');audio.preload='metadata';player.append(audio);bindPlayer();refreshTracks();created=true;}
  player.dataset.release='25.0.0';
  for(const legacy of root.querySelectorAll('.pf-player-row[data-pf-flow-source="true"]'))if(legacy.dataset.pfLegacyPlayer!=='true')legacy.dataset.pfLegacyPlayer='true';
  renderPlayer();const menu=player.querySelector('[data-pf-player-menu]');if(menu){menu.setAttribute('aria-expanded',String(Boolean(playerState.drawer)));menu.setAttribute('aria-label',playerState.drawer?'Close local music menu':'Open local music menu');}const drawerKey=playerDrawerDataKey();if(created||drawerKey!==playerDrawerRenderKey)renderPlayerDrawer();
}
function bindPlayer(){
  audio.volume=Math.max(0,Math.min(1,Number.isFinite(Number(playerState.volume))?Number(playerState.volume):.72));
  player.addEventListener('click',guarded('player-click',event=>{const button=event.target.closest('button');if(!button)return;if(button.matches('[data-pf-player-menu]'))togglePlayerDrawer();else if(button.matches('[data-pf-player-close]'))setPlayerDrawer(false);else if(button.matches('[data-pf-player-play]'))togglePlay();else if(button.matches('[data-pf-player-prev]'))previousTrack();else if(button.matches('[data-pf-player-next]'))nextTrack();else if(button.matches('[data-pf-player-view]')){playerState.view=button.dataset.pfPlayerView;savePlayerState();renderPlayerDrawer();}else if(button.matches('[data-pf-track-play]'))playTrack(button.dataset.pfTrackPlay);else if(button.matches('[data-pf-track-queue]'))queueTrack(button.dataset.pfTrackQueue);else if(button.matches('[data-pf-queue-remove]'))removeFromQueue(Number(button.dataset.pfQueueRemove));else if(button.matches('[data-pf-queue-up]'))moveQueue(Number(button.dataset.pfQueueUp),-1);else if(button.matches('[data-pf-queue-down]'))moveQueue(Number(button.dataset.pfQueueDown),1);else if(button.matches('[data-pf-track-delete]'))deleteTrack(button.dataset.pfTrackDelete);else if(button.matches('[data-pf-playlist-create]'))createPlaylist();else if(button.matches('[data-pf-playlist-play]'))playPlaylist(button.dataset.pfPlaylistPlay);else if(button.matches('[data-pf-playlist-add-current]'))addCurrentToPlaylist(button.dataset.pfPlaylistAddCurrent);else if(button.matches('[data-pf-playlist-delete]'))deletePlaylist(button.dataset.pfPlaylistDelete);else if(button.matches('[data-pf-stream-add]'))addStreamLink();else if(button.matches('[data-pf-stream-open]'))openStream(button.dataset.pfStreamOpen);else if(button.matches('[data-pf-stream-delete]'))deleteStreamLink(button.dataset.pfStreamDelete);}));
  player.querySelector('[data-pf-player-files]')?.addEventListener('change',guarded('player-files',event=>{addAudioFiles(event.target.files);event.target.value='';}));
  const drop=player.querySelector('[data-pf-player-drop]');for(const name of ['dragenter','dragover'])drop.addEventListener(name,event=>{event.preventDefault();drop.classList.add('is-drop-target');});for(const name of ['dragleave','drop'])drop.addEventListener(name,event=>{event.preventDefault();drop.classList.remove('is-drop-target');});drop.addEventListener('drop',guarded('player-drop',event=>addAudioFiles(event.dataTransfer?.files||[])));
  player.querySelector('[data-pf-player-progress]')?.addEventListener('input',guarded('player-seek',event=>{if(audio.duration)audio.currentTime=audio.duration*(Number(event.target.value)/1000);}));
  player.querySelector('[data-pf-player-volume]')?.addEventListener('input',guarded('player-volume',event=>{playerState.volume=Number(event.target.value);audio.volume=playerState.volume;savePlayerState();}));
  audio.addEventListener('timeupdate',renderPlayerProgress);audio.addEventListener('durationchange',renderPlayerProgress);audio.addEventListener('play',renderPlayer);audio.addEventListener('pause',renderPlayer);audio.addEventListener('ended',nextTrack);audio.addEventListener('error',()=>showPlayerStatus('This local audio file could not be played.'));
}
async function refreshTracks(){try{trackCache=await allTracks();playerState.queue=playerState.queue.filter(id=>trackCache.some(track=>track.id===id));if(playerState.currentId&&!trackCache.some(track=>track.id===playerState.currentId))playerState.currentId=playerState.queue[0]||null;savePlayerState();renderPlayer();renderPlayerDrawer();}catch(error){report('media-db',error);showPlayerStatus('Local media storage is unavailable in this browser.');}}
function trackById(id){return trackCache.find(track=>track.id===id)||null;}
async function loadCurrent(autoplay=false){
  const track=await getTrack(playerState.currentId);if(!track)return;if(currentObjectUrl)URL.revokeObjectURL(currentObjectUrl);currentObjectUrl=URL.createObjectURL(track.blob);audio.src=currentObjectUrl;audio.load();if(autoplay)try{await audio.play();}catch{}renderPlayer();
}
async function playTrack(id){if(!id)return;playerState.currentId=id;if(!playerState.queue.includes(id))playerState.queue.push(id);savePlayerState();await loadCurrent(true);renderPlayerDrawer();}
async function togglePlay(){if(!playerState.currentId){playerState.currentId=playerState.queue[0]||trackCache[0]?.id||null;savePlayerState();if(playerState.currentId)await loadCurrent(true);else player?.querySelector('[data-pf-player-files]')?.click();return;}if(!audio.src)await loadCurrent(false);if(audio.paused)try{await audio.play();}catch{}else audio.pause();renderPlayer();}
function nextTrack(){if(!playerState.queue.length)return;let index=playerState.queue.indexOf(playerState.currentId);index=(index+1)%playerState.queue.length;playTrack(playerState.queue[index]);}
function previousTrack(){if(!playerState.queue.length)return;let index=playerState.queue.indexOf(playerState.currentId);index=(index-1+playerState.queue.length)%playerState.queue.length;playTrack(playerState.queue[index]);}
function queueTrack(id){if(!playerState.queue.includes(id))playerState.queue.push(id);savePlayerState();renderPlayerDrawer();showPlayerStatus('Added to queue.');}
function removeFromQueue(index){playerState.queue.splice(index,1);if(!playerState.queue.includes(playerState.currentId)){playerState.currentId=playerState.queue[0]||null;audio.pause();audio.removeAttribute('src');}savePlayerState();renderPlayer();renderPlayerDrawer();}
function moveQueue(index,direction){const next=index+direction;if(next<0||next>=playerState.queue.length)return;[playerState.queue[index],playerState.queue[next]]=[playerState.queue[next],playerState.queue[index]];savePlayerState();renderPlayerDrawer();}
async function deleteTrack(id){if(!confirm('Remove this audio file from Pacefold local storage?'))return;await removeTrack(id);playerState.queue=playerState.queue.filter(trackId=>trackId!==id);for(const list of playlists)list.trackIds=(list.trackIds||[]).filter(trackId=>trackId!==id);savePlayerState();savePlaylists();await refreshTracks();}
function setPlayerDrawer(open){const next=Boolean(open),changed=Boolean(playerState.drawer)!==next;clearTimeout(playerMotionTimer);if(next&&notebookState.open!==false)setNotebookOpen(false,false,false);playerState.drawer=next;savePlayerState();if(player){if(changed)player.dataset.foldMotion=next?'opening':'closing';player.classList.toggle('is-open',next);const menu=player.querySelector('[data-pf-player-menu]');if(menu){menu.setAttribute('aria-expanded',String(next));menu.setAttribute('aria-label',next?'Close local music menu':'Open local music menu');}}const drawer=player?.querySelector('[data-pf-player-drawer]');if(drawer)drawer.hidden=!next;playerMotionTimer=setTimeout(()=>{playerMotionTimer=0;if(player?.dataset.foldMotion===(next?'opening':'closing'))delete player.dataset.foldMotion;},260);if(next)renderPlayerDrawer();}
function togglePlayerDrawer(){setPlayerDrawer(!playerState.drawer);}
function showPlayerStatus(message){const node=player?.querySelector('[data-pf-player-status]');if(node)node.textContent=message;}
function formatDuration(seconds){if(!Number.isFinite(seconds)||seconds<0)return '0:00';const minutes=Math.floor(seconds/60),rest=Math.floor(seconds%60);return `${minutes}:${String(rest).padStart(2,'0')}`;}
function renderPlayerProgress(){if(!player)return;const progress=player.querySelector('[data-pf-player-progress]'),time=player.querySelector('[data-pf-player-time]');if(progress)progress.value=audio.duration?String(Math.round(audio.currentTime/audio.duration*1000)):'0';if(time)time.textContent=`${formatDuration(audio.currentTime)} / ${formatDuration(audio.duration)}`;}
function renderPlayer(){if(!player)return;const current=trackById(playerState.currentId);const title=player.querySelector('[data-pf-player-title]'),subtitle=player.querySelector('[data-pf-player-subtitle]'),play=player.querySelector('[data-pf-player-play]');if(title)title.textContent=current?.name||'No local track';if(subtitle)subtitle.textContent=current?`${playerState.queue.length} in queue · stored locally`:'Add audio files to begin';if(play){play.textContent=audio&&!audio.paused?'❚❚':'▶';play.setAttribute('aria-label',audio&&!audio.paused?'Pause':'Play');}const drawer=player.querySelector('[data-pf-player-drawer]');if(drawer)drawer.hidden=!playerState.drawer;player.classList.toggle('is-open',Boolean(playerState.drawer));renderPlayerProgress();}
function renderPlayerDrawer(){
  const target=player?.querySelector('[data-pf-player-drawer-body]');if(!target)return;for(const button of player.querySelectorAll('[data-pf-player-view]'))button.setAttribute('aria-pressed',String(button.dataset.pfPlayerView===playerState.view));
  if(playerState.view==='library')setHTML(target,libraryMarkup());else if(playerState.view==='playlists')setHTML(target,playlistsMarkup());else if(playerState.view==='streaming')setHTML(target,streamingMarkup());else setHTML(target,queueMarkup());
  bindInlinePlayerFiles();playerDrawerRenderKey=playerDrawerDataKey();
}
function trackRow(track,actions='library',index=0){return `<article class="pf-track-row${track.id===playerState.currentId?' is-current':''}"><button type="button" class="pf-track-main" data-pf-track-play="${esc(track.id)}"><span aria-hidden="true">♪</span><span><strong>${esc(track.name)}</strong><small>${Math.max(1,Math.round((track.size||0)/1048576))} MB · local</small></span></button><div>${actions==='queue'?`<button type="button" data-pf-queue-up="${index}" aria-label="Move up">↑</button><button type="button" data-pf-queue-down="${index}" aria-label="Move down">↓</button><button type="button" data-pf-queue-remove="${index}" aria-label="Remove from queue">×</button>`:`<button type="button" data-pf-track-queue="${esc(track.id)}">Queue</button><button type="button" data-pf-track-delete="${esc(track.id)}" aria-label="Delete local track">×</button>`}</div></article>`;}
function queueMarkup(){const queue=playerState.queue.map(trackById).filter(Boolean);return `<div class="pf-player-section-head"><div><strong>Up next</strong><small>${queue.length} local track${queue.length===1?'':'s'}</small></div><label class="pf-player-file-button">Add files<input type="file" data-pf-player-files-inline accept="audio/*" multiple></label></div>${queue.length?queue.map((track,index)=>trackRow(track,'queue',index)).join(''):'<div class="pf-player-empty">Your queue is empty. Add local audio files.</div>'}`;}
function libraryMarkup(){return `<div class="pf-player-section-head"><div><strong>Local library</strong><small>${trackCache.length} stored track${trackCache.length===1?'':'s'}</small></div><label class="pf-player-file-button">Add files<input type="file" data-pf-player-files-inline accept="audio/*" multiple></label></div>${trackCache.length?trackCache.sort((a,b)=>a.name.localeCompare(b.name)).map(track=>trackRow(track)).join(''):'<div class="pf-player-empty">Audio you add is stored in this browser using IndexedDB.</div>'}`;}
function playlistsMarkup(){return `<form class="pf-playlist-create" onsubmit="return false"><input data-pf-playlist-name maxlength="50" placeholder="New playlist name"><button type="button" data-pf-playlist-create>Create</button></form>${playlists.length?playlists.map(list=>`<article class="pf-playlist-card"><header><div><strong>${esc(list.name)}</strong><small>${(list.trackIds||[]).length} tracks</small></div><div><button type="button" data-pf-playlist-play="${esc(list.id)}">Play</button><button type="button" data-pf-playlist-add-current="${esc(list.id)}">Add current</button><button type="button" data-pf-playlist-delete="${esc(list.id)}" aria-label="Delete playlist">×</button></div></header>${(list.trackIds||[]).map(trackById).filter(Boolean).map(track=>`<span>${esc(track.name)}</span>`).join('')||'<span>No tracks yet.</span>'}</article>`).join(''):'<div class="pf-player-empty">Create playlists from your local library.</div>'}`;}
function streamingMarkup(){return `<div class="pf-stream-add"><input data-pf-stream-name maxlength="50" placeholder="Name"><input data-pf-stream-url type="url" placeholder="https://…"><button type="button" data-pf-stream-add>Add link</button></div><p class="pf-stream-note">Streaming is intentionally secondary. Pacefold stores bookmarks only; local audio remains the player.</p>${streamLinks.map(link=>`<article class="pf-stream-row"><div><strong>${esc(link.name)}</strong><small>${esc(link.url)}</small></div><div><button type="button" data-pf-stream-open="${esc(link.id)}">Open</button><button type="button" data-pf-stream-delete="${esc(link.id)}">×</button></div></article>`).join('')}`;}
function bindInlinePlayerFiles(){for(const input of player?.querySelectorAll('[data-pf-player-files-inline]')||[])if(input.dataset.bound!=='true'){input.dataset.bound='true';input.addEventListener('change',guarded('inline-player-files',event=>{addAudioFiles(event.target.files);event.target.value='';}));}}
function createPlaylist(){const input=player?.querySelector('[data-pf-playlist-name]');const name=compact(input?.value).slice(0,50);if(!name)return;playlists.push({id:uid('playlist'),name,trackIds:[]});savePlaylists();renderPlayerDrawer();}
function playPlaylist(id){const list=playlists.find(item=>item.id===id);if(!list?.trackIds?.length)return;playerState.queue=[...list.trackIds].filter(trackId=>trackById(trackId));playerState.currentId=playerState.queue[0]||null;savePlayerState();if(playerState.currentId)loadCurrent(true);renderPlayerDrawer();}
function addCurrentToPlaylist(id){if(!playerState.currentId)return;const list=playlists.find(item=>item.id===id);if(!list)return;if(!list.trackIds.includes(playerState.currentId))list.trackIds.push(playerState.currentId);savePlaylists();renderPlayerDrawer();}
function deletePlaylist(id){playlists=playlists.filter(item=>item.id!==id);savePlaylists();renderPlayerDrawer();}
function addStreamLink(){const name=compact(player?.querySelector('[data-pf-stream-name]')?.value).slice(0,50),url=compact(player?.querySelector('[data-pf-stream-url]')?.value);if(!name||!/^https?:\/\//i.test(url)){showPlayerStatus('Add a name and a valid web link.');return;}streamLinks.push({id:uid('stream'),name,url});saveStreamLinks();renderPlayerDrawer();}
function openStream(id){const link=streamLinks.find(item=>item.id===id);if(link)window.open(link.url,'_blank','noopener,noreferrer');}
function deleteStreamLink(id){streamLinks=streamLinks.filter(item=>item.id!==id);saveStreamLinks();renderPlayerDrawer();}

function showStatus(message,tone='neutral'){
  const node=dock?.querySelector('[data-pf-flow-status]');if(!node)return;clearTimeout(statusTimer);node.textContent=message;node.dataset.tone=tone;node.hidden=false;statusTimer=setTimeout(()=>{if(node.isConnected)node.hidden=true;},3600);
}
function suppressLegacySurfaces(){
  let notebookWasOpened=false;
  for(const note of root?.querySelectorAll('.pf-notebook,[data-pf-notebook-root]')||[]){if(note.closest(`#${WORKSPACE_ID}`))continue;if(!note.hidden&&note.getAttribute('aria-hidden')!=='true')notebookWasOpened=true;if(!note.hidden)note.hidden=true;if(note.getAttribute('aria-hidden')!=='true')note.setAttribute('aria-hidden','true');}
  if(notebookWasOpened&&!notebookState.open)saveNotebookState();
  for(const legacy of root?.querySelectorAll('.pf-player-row[data-pf-flow-source="true"]')||[])if(legacy.dataset.pfLegacyPlayer!=='true')legacy.dataset.pfLegacyPlayer='true';
}
function handleLaunchIntent(){const url=new URL(location.href);const intent=url.searchParams.get('pf');if(!intent)return;url.searchParams.delete('pf');history.replaceState(history.state,'',url.pathname+url.search+url.hash);if(intent==='notebook')setTimeout(()=>{ensureWorkspace();setNotebookOpen(true,true);},160);else if(intent==='capture')setTimeout(()=>{ensureWorkspace();setNotebookOpen(false,false,false);window.__PACEFOLD_FLOW__?.focusCapture?.();},160);else if(intent==='media')setTimeout(()=>setPlayerDrawer(true),160);}
function reconcile(){
  const nextRoot=document.getElementById(ROOT_ID),nextDock=document.getElementById(DOCK_ID);if(!nextRoot||!nextDock)return;root=nextRoot;dock=nextDock;migrateEntries();ensureWorkspace();ensurePlayer();suppressLegacySurfaces();applyWorkState();updateComposerMode();handleLaunchIntent();
}
function queue(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;try{reconcile();}catch(error){report('reconcile',error);}});}
function bindObserver(){observer?.disconnect();observer=new MutationObserver(mutations=>{if(mutations.length&&mutations.every(item=>item.target instanceof Element&&item.target.closest?.(`#${WORKSPACE_ID},#${PLAYER_ID}`)))return;queue();});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-hidden','disabled','data-view','data-screen','data-theme']});}

applyVisualReset();installBadgePolicy();bindObserver();
document.addEventListener('click',guarded('persistent-notebook',event=>{const action=event.target.closest?.('[data-pf-action]')?.dataset?.pfAction;if(action==='open-notebook'){event.preventDefault();event.stopImmediatePropagation();setNotebookOpen(true,true);}else if(action==='open-player'){event.preventDefault();event.stopImmediatePropagation();setPlayerDrawer(true);}}),true);
window.addEventListener('focus',guarded('focus',()=>{workCache.at=0;applyWorkState();}));
document.addEventListener('visibilitychange',guarded('notebook-visibility',()=>{}));
window.addEventListener('storage',event=>{if(event.key?.startsWith('pacefold.')){workCache.at=0;if([ENTRY_KEY,CATEGORY_KEY].includes(event.key))notebookRenderKey='';queue();}});
window.addEventListener('pacefold:storage-changed',()=>{clearTimeout(migrateTimer);migrateTimer=setTimeout(queue,60);});
document.addEventListener('keydown',guarded('keyboard',event=>{if(event.ctrlKey&&event.shiftKey&&event.code==='KeyN'){event.preventDefault();setNotebookOpen(true,true);}}));
[0,100,300,800,1800].forEach(delay=>setTimeout(queue,delay));
workTimer=setInterval(guarded('work-hours',()=>{if(document.visibilityState==='visible'){workCache.at=0;queue();}}),5000);
window.__PACEFOLD_WORKSPACE__={revision:REVISION,surfaceRelease:'25.0.0',reconcile:queue,readWorkWindow,openNotebook:()=>setNotebookOpen(true,false),closeNotebook:()=>setNotebookOpen(false,false,false),copyDay,player:{open:()=>setPlayerDrawer(true),close:()=>setPlayerDrawer(false),refresh:refreshTracks}};
})();
;
(() => {
'use strict';

const RELEASE='25.0.0';
const WEATHER_KEY='pacefold.v19.weather.v1';
const WEATHER_TTL=20*60*1000;
const WEATHER_REFRESH=20*60*1000;
const RITUALS={
  water:{name:'Water',button:'waterBtn'},
  noodle:{name:'Timer',button:'noodleBtn'},
  away:{name:'Away',button:'awayBtn'},
  lunch:{name:'Meal',button:'lunchBtn'},
  eyes:{name:'Eyes',button:'eyesBtn'},
  body:{name:'Move',button:'careBtn'}
};
const WEATHER_LABELS={
  0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Cloudy',45:'Fog',48:'Icy fog',
  51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Freezing drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',
  80:'Light showers',81:'Showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',
  95:'Thunderstorm',96:'Thunderstorm',99:'Severe thunderstorm'
};

let mounted=false;
let weatherRequest=null;
let weatherTimer=0;
let reconcileFrame=0;
let surfaceObserver=null;
let textObserver=null;
let lastWeather=null;
let lastWeatherAt=0;
let workbenchPage='notes';

const byId=id=>document.getElementById(id);
const compact=value=>String(value??'').replace(/\s+/g,' ').trim();
const clamp=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
const safeParse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}};
const create=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!=null)node.textContent=text;
  return node;
};
const button=(className,text,label)=>{
  const node=create('button',className,text);
  node.type='button';
  if(label)node.setAttribute('aria-label',label);
  return node;
};
const getPrefs=()=>window.__PACEFOLD_RUNTIME_CORE__?.getPrefs?.()||safeParse(localStorage.getItem('pacefoldPrefsV15'),{});

function report(scope,error){
  try{window.__PACEFOLD_DIAGNOSTICS__?.recordError?.(`activity-${scope}`,error);}catch{}
}

function guarded(scope,callback){
  return function(...args){
    try{return callback.apply(this,args);}
    catch(error){report(scope,error);return undefined;}
  };
}

function setupVisible(){
  return Boolean(window.__PACEFOLD_GUARDIAN__?.setupVisible?.()||
    [...document.querySelectorAll('#onboarding,.onboarding,[data-onboard-profile],.onboarding-option')]
      .some(node=>!node.hidden&&node.getAttribute('aria-hidden')!=='true'&&getComputedStyle(node).display!=='none'));
}

function weatherKind(code){
  code=Number(code);
  if(code===0)return'clear';
  if(code<=3)return'cloud';
  if(code===45||code===48)return'fog';
  if(code>=51&&code<=67||code>=80&&code<=82)return'rain';
  if(code>=71&&code<=77||code>=85&&code<=86)return'snow';
  if(code>=95)return'storm';
  return'mixed';
}

function weatherUrl(prefs){
  const lat=clamp(prefs.lat,-90,90,43.6532);
  const lng=clamp(prefs.lng,-180,180,-79.3832);
  const query=new URLSearchParams({
    latitude:String(lat),
    longitude:String(lng),
    current:'temperature_2m,apparent_temperature,weather_code,is_day,precipitation,rain',
    hourly:'temperature_2m,precipitation_probability,weather_code',
    daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit:'celsius',
    precipitation_unit:'mm',
    timezone:'auto',
    forecast_days:'3'
  });
  return`https://api.open-meteo.com/v1/forecast?${query}`;
}

function locationKey(prefs){
  return`${clamp(prefs.lat,-90,90,43.6532).toFixed(3)},${clamp(prefs.lng,-180,180,-79.3832).toFixed(3)}`;
}

function readWeatherCache(prefs){
  const cache=safeParse(localStorage.getItem(WEATHER_KEY),null);
  if(!cache||cache.location!==locationKey(prefs)||!cache.data)return null;
  return cache;
}

function writeWeatherCache(prefs,data){
  try{localStorage.setItem(WEATHER_KEY,JSON.stringify({savedAt:Date.now(),location:locationKey(prefs),data}));}catch(error){report('weather-cache',error);}
}

function normalizeWeather(data,prefs){
  const hourlyTimes=Array.isArray(data.hourly?.time)?data.hourly.time:[];
  const now=Date.now();
  let hourIndex=hourlyTimes.findIndex(value=>new Date(value).getTime()>=now-30*60000);
  if(hourIndex<0)hourIndex=0;
  const nextHours=hourlyTimes.slice(hourIndex,hourIndex+4).map((time,index)=>({
    time,
    rain:Number(data.hourly?.precipitation_probability?.[hourIndex+index])||0,
    temperature:Number(data.hourly?.temperature_2m?.[hourIndex+index]),
    code:Number(data.hourly?.weather_code?.[hourIndex+index])
  }));
  const days=(data.daily?.time||[]).slice(0,3).map((date,index)=>({
    date,
    code:Number(data.daily?.weather_code?.[index]),
    high:Number(data.daily?.temperature_2m_max?.[index]),
    low:Number(data.daily?.temperature_2m_min?.[index]),
    rain:Number(data.daily?.precipitation_probability_max?.[index])||0
  }));
  return{
    location:compact(prefs.locationLabel)||'Current location',
    current:{
      temperature:Number(data.current?.temperature_2m),
      feels:Number(data.current?.apparent_temperature),
      code:Number(data.current?.weather_code),
      rain:Number(data.current?.rain)||Number(data.current?.precipitation)||0
    },
    nextHours,
    days
  };
}

function weatherSummary(weather){
  const peak=Math.max(0,...weather.nextHours.map(hour=>hour.rain));
  if(weather.current.rain>.05)return`${weather.current.rain.toFixed(1)} mm now`;
  if(peak>=70)return`Rain likely in the next few hours`;
  if(peak>=35)return`Rain possible · up to ${Math.round(peak)}%`;
  if(peak>0)return`Low rain chance · ${Math.round(peak)}%`;
  return'No rain showing soon';
}

function renderWeather(weather,{stale=false}={}){
  lastWeather=weather;
  const card=byId('pf-v25-activity-weather');
  if(!card)return;
  const code=Number(weather.current.code);
  card.dataset.weather=weatherKind(code);
  const temperature=byId('pf-v25-activity-weather-temp');
  const condition=byId('pf-v25-activity-weather-condition');
  const location=byId('pf-v25-activity-weather-location');
  const summary=byId('pf-v25-activity-weather-summary');
  const meta=byId('pf-v25-activity-weather-meta');
  if(temperature)temperature.textContent=Number.isFinite(weather.current.temperature)?`${Math.round(weather.current.temperature)}°`:'—';
  if(condition)condition.textContent=WEATHER_LABELS[code]||'Mixed conditions';
  if(location)location.textContent=weather.location;
  if(summary)summary.textContent=weatherSummary(weather);
  if(meta){
    const feels=Number.isFinite(weather.current.feels)?`Feels ${Math.round(weather.current.feels)}°`:'Current conditions';
    meta.textContent=stale?`${feels} · saved forecast`:feels;
  }
  const days=card.querySelectorAll('[data-activity-weather-day]');
  weather.days.slice(0,3).forEach((day,index)=>{
    const target=days[index];
    if(!target)return;
    target.dataset.weather=weatherKind(day.code);
    const date=new Date(`${day.date}T12:00:00`);
    target.querySelector('strong').textContent=index===0?'Today':date.toLocaleDateString(undefined,{weekday:'short'});
    target.querySelector('span').textContent=`${Math.round(day.high)}° / ${Math.round(day.low)}°`;
    target.querySelector('small').textContent=`${Math.round(day.rain)}% rain`;
  });
  card.dataset.ready='true';
}

function renderWeatherUnavailable(){
  const card=byId('pf-v25-activity-weather');
  if(!card||lastWeather)return;
  card.dataset.weather='mixed';
  byId('pf-v25-activity-weather-temp').textContent='—';
  byId('pf-v25-activity-weather-condition').textContent='Weather offline';
  byId('pf-v25-activity-weather-summary').textContent='Refresh when connected';
  byId('pf-v25-activity-weather-meta').textContent='The clock and timers remain local';
}

async function refreshWeather(force=false){
  if(weatherRequest)return weatherRequest;
  const prefs=getPrefs();
  const cache=readWeatherCache(prefs);
  if(cache&&!force){
    lastWeatherAt=Number(cache.savedAt)||0;
    renderWeather(cache.data,{stale:Date.now()-lastWeatherAt>WEATHER_TTL});
    if(Date.now()-lastWeatherAt<WEATHER_TTL)return cache.data;
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  const card=byId('pf-v25-activity-weather');
  if(card)card.dataset.loading='true';
  weatherRequest=fetch(weatherUrl(prefs),{signal:controller.signal})
    .then(response=>{if(!response.ok)throw new Error(`Weather ${response.status}`);return response.json();})
    .then(data=>{
      const weather=normalizeWeather(data,prefs);
      lastWeatherAt=Date.now();
      writeWeatherCache(prefs,weather);
      renderWeather(weather);
      return weather;
    })
    .catch(error=>{
      if(cache)renderWeather(cache.data,{stale:true});
      else renderWeatherUnavailable();
      if(error?.name!=='AbortError')report('weather',error);
      return cache?.data||null;
    })
    .finally(()=>{
      clearTimeout(timeout);
      weatherRequest=null;
      if(card)delete card.dataset.loading;
    });
  return weatherRequest;
}

function weatherCard(){
  const card=create('section','pf-v25-activity-weather');
  card.id='pf-v25-activity-weather';
  card.setAttribute('aria-label','Weather at the saved location');

  const head=create('header','pf-v25-activity-weather-head');
  const place=button('pf-v25-activity-weather-place','Current location','Open settings to change the weather location');
  const location=create('strong','',compact(getPrefs().locationLabel)||'Current location');
  location.id='pf-v25-activity-weather-location';
  place.replaceChildren(location,create('span','','Weather'));
  place.addEventListener('click',()=>byId('brandButton')?.click());
  const refresh=button('pf-v25-activity-weather-refresh','↻','Refresh weather');
  refresh.addEventListener('click',()=>refreshWeather(true));
  head.append(place,refresh);

  const current=create('div','pf-v25-activity-weather-current');
  const mark=create('span','pf-v25-activity-weather-mark');
  mark.setAttribute('aria-hidden','true');
  const temp=create('strong','pf-v25-activity-weather-temp','—');
  temp.id='pf-v25-activity-weather-temp';
  const copy=create('div','pf-v25-activity-weather-copy');
  const condition=create('span','','Loading weather');
  condition.id='pf-v25-activity-weather-condition';
  const summary=create('strong','','Checking the next few hours');
  summary.id='pf-v25-activity-weather-summary';
  const meta=create('small','','Saved location forecast');
  meta.id='pf-v25-activity-weather-meta';
  copy.append(condition,summary,meta);
  current.append(mark,temp,copy);

  const days=create('div','pf-v25-activity-weather-days');
  for(let index=0;index<3;index+=1){
    const day=create('article','pf-v25-activity-weather-day');
    day.dataset.activityWeatherDay=String(index);
    day.append(create('strong','',index?'—':'Today'),create('span','','— / —'),create('small','','—% rain'));
    days.append(day);
  }
  card.append(head,current,days);
  return card;
}

function ritualGrid(){
  const workline=byId('workline');
  if(!workline)return false;
  for(const [source,definition] of Object.entries(RITUALS)){
    const control=byId(definition.button);
    if(!control)continue;
    let slot=control.closest('.pf-ritual-slot');
    if(!slot){
      slot=create('span','pf-ritual-slot');
      slot.dataset.source=source;
      control.parentNode.insertBefore(slot,control);
      slot.append(control);
    }
    slot.dataset.activityRitual='true';
    if(source==='body'&&slot.parentElement!==workline)workline.append(slot);
    if(!slot.querySelector('.pf-v25-activity-ritual-name'))slot.prepend(create('span','pf-v25-activity-ritual-name',definition.name));
  }
  for(const divider of workline.querySelectorAll('.ritual-divider'))divider.setAttribute('aria-hidden','true');
  updateRitualStates();
  return Object.values(RITUALS).every(definition=>byId(definition.button)?.closest('#workline'));
}

function updateRitualStates(){
  const prefs=getPrefs();
  const active={
    water:false,
    noodle:Boolean(Number(prefs.noodleStart)),
    away:Boolean(Number(prefs.awayStart)),
    lunch:Boolean(Number(prefs.lunchStart)),
    eyes:Boolean(Number(prefs.gazeActiveStart)),
    body:Boolean(Number(prefs.bodyActiveStart))
  };
  const source=document.body.dataset.source;
  const signal=document.body.dataset.signal;
  for(const [name] of Object.entries(RITUALS)){
    const slot=document.querySelector(`.pf-ritual-slot[data-source="${name}"]`);
    if(!slot)continue;
    let nextActive=String(Boolean(active[name]));
    const optimistic=slot.dataset.optimisticActive;
    if(optimistic){
      if(optimistic===nextActive||Number(slot.dataset.optimisticUntil)<=Date.now()){
        delete slot.dataset.optimisticActive;
        delete slot.dataset.optimisticUntil;
      }else nextActive=optimistic;
    }
    slot.dataset.active=nextActive;
    slot.dataset.attention=String(source===name&&signal!=='none');
  }
}

function reflectRitualClick(event){
  const button=event.target instanceof Element?event.target.closest('button'):null;
  if(!button)return;
  const entry=Object.entries(RITUALS).find(([,definition])=>definition.button===button.id);
  if(!entry||entry[0]==='water')return;
  const slot=button.closest('.pf-ritual-slot');
  if(slot){
    slot.dataset.optimisticActive=String(slot.dataset.active!=='true');
    slot.dataset.optimisticUntil=String(Date.now()+450);
    slot.dataset.active=slot.dataset.optimisticActive;
  }
}

function proxyClick(selector){
  const target=document.querySelector(selector);
  if(target)target.click();
}

function workbenchTab(page,label,detail){
  const node=button('pf-v25-activity-workbench-tab','',`Show ${label}`);
  node.dataset.workbenchPage=page;
  node.setAttribute('role','tab');
  const copy=create('span','');
  copy.append(create('strong','',label),create('small','',detail));
  node.append(copy);
  node.addEventListener('click',()=>setWorkbenchPage(page,{focus:true}));
  return node;
}

function setWorkbenchPage(page,{focus=false}={}){
  page=page==='sound'?'sound':'notes';
  const workbench=byId('pf-v25-activity-workbench');
  const workspace=byId('pf-local-workspace');
  const player=byId('pf-local-player');
  if(!workbench||!workspace||!player)return false;
  workbenchPage=page;
  workbench.dataset.page=page;
  workspace.hidden=page!=='notes';
  player.hidden=page!=='sound';
  workspace.inert=page!=='notes';
  player.inert=page!=='sound';
  for(const tab of workbench.querySelectorAll('[data-workbench-page]')){
    const selected=tab.dataset.workbenchPage===page;
    tab.setAttribute('aria-selected',String(selected));
    tab.setAttribute('tabindex',selected?'0':'-1');
  }
  if(page==='sound')window.__PACEFOLD_WORKSPACE__?.player?.open?.();
  else{
    window.__PACEFOLD_WORKSPACE__?.player?.close?.();
    window.__PACEFOLD_WORKSPACE__?.openNotebook?.();
  }
  document.body.dataset.activitySurface='workbench';
  document.body.dataset.activityWorkbenchPage=page;
  if(focus){
    const target=page==='notes'
      ?workspace.querySelector('[data-pf-note-body]')
      :player.querySelector('[data-pf-player-title]');
    target?.focus?.({preventScroll:true});
  }
  syncMusicState();
  return true;
}

function installWorkbench(){
  if(byId('pf-v25-activity-workbench'))return true;
  const main=document.querySelector('main');
  const shell=main?.querySelector('.clock-shell');
  const workspace=byId('pf-local-workspace');
  const player=byId('pf-local-player');
  if(!main||!shell||!workspace||!player)return false;

  const workbench=create('section','pf-v25-activity-workbench');
  workbench.id='pf-v25-activity-workbench';
  workbench.dataset.page='notes';
  workbench.setAttribute('aria-label','Pacefold workday notebook');

  const rail=create('header','pf-v25-activity-workbench-rail');
  const identity=create('div','pf-v25-activity-workbench-identity');
  const mark=create('span','pf-v25-activity-workbench-mark');
  mark.setAttribute('aria-hidden','true');
  const identityCopy=create('span','');
  identityCopy.append(create('strong','','Notebook'),create('small','','Always here · saved on this device'));
  identity.append(mark,identityCopy);

  const tabs=create('div','pf-v25-activity-workbench-tabs');
  tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label','Notebook pages');
  tabs.append(
    workbenchTab('notes','Notes','Write and review'),
    workbenchTab('sound','Sound','Local audio')
  );

  const nowPlaying=create('div','pf-v25-activity-workbench-playing');
  const play=button('pf-v25-activity-workbench-play','▶','Play local audio');
  play.id='pf-v25-activity-music-play';
  play.addEventListener('click',event=>{
    event.stopPropagation();
    proxyClick('#pf-local-player [data-pf-player-play]');
  });
  const playingCopy=button('pf-v25-activity-workbench-track','','Show local audio');
  const playingText=create('span','');
  playingText.append(create('strong','','No local track'),create('small','','Sound stays on this device'));
  playingCopy.append(playingText);
  playingCopy.addEventListener('click',()=>setWorkbenchPage('sound',{focus:true}));
  nowPlaying.append(play,playingCopy);

  const extra=create('div','pf-v25-activity-workbench-extra');
  extra.id='pf-v25-activity-workbench-extra';
  const body=create('div','pf-v25-activity-workbench-body');
  body.append(workspace,player);
  rail.append(identity,tabs,nowPlaying,extra);
  workbench.append(rail,body);
  shell.insertAdjacentElement('afterend',workbench);

  byId('pf-v25-activity-scrim')?.remove();
  setWorkbenchPage('notes');
  return true;
}

function syncMusicState(){
  const title=document.querySelector('#pf-local-player [data-pf-player-title]');
  const sourcePlay=document.querySelector('#pf-local-player [data-pf-player-play]');
  const play=byId('pf-v25-activity-music-play');
  const track=byId('pf-v25-activity-workbench')?.querySelector('.pf-v25-activity-workbench-track');
  if(track){
    const name=track.querySelector('strong');
    const detail=track.querySelector('small');
    const next=compact(title?.textContent)||'No local track';
    if(name&&name.textContent!==next)name.textContent=next;
    if(detail&&detail.textContent!=='Sound stays on this device')detail.textContent='Sound stays on this device';
  }
  if(play){
    const playing=sourcePlay?.getAttribute('aria-label')==='Pause';
    const glyph=playing?'Ⅱ':'▶',label=playing?'Pause local audio':'Play local audio';
    if(play.textContent!==glyph)play.textContent=glyph;
    if(play.getAttribute('aria-label')!==label)play.setAttribute('aria-label',label);
  }
}

function identityPass(){
  if(document.body.dataset.quiet==='true')return;
  const replacements=new Map([
    ['Kiroku','Quick note'],
    ['Ma · Day Ribbon','Day Ribbon'],
    ['Sumi workspace','Workspace'],
    ['OneNote bridge','Local notes']
  ]);
  for(const node of document.querySelectorAll('#foldKicker,[data-pf-sheet-kicker],[data-pf-sheet-title],#pf25-root strong,#pf25-root small')){
    const next=replacements.get(compact(node.textContent));
    if(next&&node.textContent!==next)node.textContent=next;
  }
  const foldKicker=byId('foldKicker');
  if(foldKicker&&foldKicker.textContent!=='Quick note')foldKicker.textContent='Quick note';
}

function reconcileSurfaces(){
  const workbench=byId('pf-v25-activity-workbench');
  if(workbench&&workbench.dataset.page!==workbenchPage)workbench.dataset.page=workbenchPage;
  if(document.body.dataset.activitySurface!=='workbench')document.body.dataset.activitySurface='workbench';
  if(document.body.dataset.activityWorkbenchPage!==workbenchPage)document.body.dataset.activityWorkbenchPage=workbenchPage;
  syncMusicState();
}

function observeSurfaces(){
  surfaceObserver?.disconnect();
  surfaceObserver=new MutationObserver(()=>{
    if(reconcileFrame)return;
    reconcileFrame=requestAnimationFrame(()=>{
      reconcileFrame=0;
      reconcileSurfaces();
      updateRitualStates();
      identityPass();
    });
  });
  for(const node of [byId('pf-local-workspace'),byId('pf-local-player')])
    if(node)surfaceObserver.observe(node,{attributes:true,childList:true,subtree:true,characterData:true,attributeFilter:['class','aria-label']});
  surfaceObserver.observe(document.body,{attributes:true,attributeFilter:['data-source','data-signal']});
}

function observeIdentity(){
  textObserver?.disconnect();
  textObserver=new MutationObserver(()=>queueMicrotask(identityPass));
  for(const node of [byId('foldDrawer'),byId('pf25-root')])if(node)textObserver.observe(node,{childList:true,subtree:true,characterData:true});
}

function exposeModules(){
  const modules=new Map();
  const registerModule=(id,node)=>{
    id=compact(id);
    if(!/^[a-z][a-z0-9-]{1,40}$/.test(id)||!(node instanceof Element))throw new Error('Pacefold module needs a safe id and an Element.');
    if(modules.has(id))return false;
    node.dataset.pfV19Module=id;
    byId('pf-v25-activity-workbench-extra')?.append(node);
    modules.set(id,node);
    return true;
  };
  const unregisterModule=id=>{
    const node=modules.get(id);
    if(!node)return false;
    node.remove();
    modules.delete(id);
    return true;
  };
  window.__PACEFOLD_ACTIVITY__={
    release:RELEASE,
    refreshWeather:()=>refreshWeather(true),
    registerModule,
    unregisterModule,
    showNotes:()=>setWorkbenchPage('notes',{focus:true}),
    showSound:()=>setWorkbenchPage('sound',{focus:true}),
    updateRitualStates,
    reconcile:reconcileSurfaces
  };
}

function mount(){
  if(mounted||setupVisible())return false;
  const shell=document.querySelector('main .clock-shell');
  const status=byId('statusLine');
  const statusArea=document.querySelector('.status-area');
  if(!shell||!status||!statusArea||!window.__PACEFOLD_RUNTIME_CORE__||!byId('pf25-root')||!byId('pf-local-player'))return false;
  mounted=true;
  document.documentElement.classList.add('pf-v25-activity-active');
  document.body.dataset.pacefoldRelease=RELEASE;
  shell.dataset.activityDashboard='true';
  status.setAttribute('aria-live','polite');

  if(!byId('pf-v25-activity-weather'))shell.insertBefore(weatherCard(),statusArea);
  ritualGrid();
  if(!installWorkbench())return false;
  byId('workline')?.addEventListener('click',guarded('rhythm-state',event=>{
    reflectRitualClick(event);
    queueMicrotask(updateRitualStates);
    requestAnimationFrame(updateRitualStates);
    setTimeout(updateRitualStates,60);
    setTimeout(updateRitualStates,180);
  }));
  window.addEventListener('pacefold:prefs',guarded('prefs-state',updateRitualStates));
  identityPass();
  observeSurfaces();
  observeIdentity();
  reconcileSurfaces();
  exposeModules();

  const prefs=getPrefs(),cache=readWeatherCache(prefs);
  if(cache){
    lastWeatherAt=Number(cache.savedAt)||0;
    renderWeather(cache.data,{stale:Date.now()-lastWeatherAt>WEATHER_TTL});
  }
  void refreshWeather(false);
  clearInterval(weatherTimer);
  weatherTimer=setInterval(()=>void refreshWeather(false),WEATHER_REFRESH);
  window.addEventListener('focus',guarded('focus-weather',()=>{
    if(Date.now()-lastWeatherAt>WEATHER_TTL)void refreshWeather(false);
    updateRitualStates();
  }));
  window.addEventListener('storage',guarded('storage',event=>{
    if(event.key==='pacefoldPrefsV15'){void refreshWeather(true);updateRitualStates();}
  }));
  window.dispatchEvent(new CustomEvent('pacefold:activity-ready',{detail:{release:RELEASE}}));
  return true;
}

function boot(attempt=0){
  if(setupVisible()){setTimeout(()=>boot(Math.min(attempt+1,120)),250);return;}
  if(mount())return;
  if(attempt<120)setTimeout(()=>boot(attempt+1),100);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});
else boot();
})();
;
(() => {
'use strict';

const RELEASE='25.0.0';
const ENTRY_KEY='pacefold.notebook.entries.v2';
const CATEGORY_KEY='pacefold.notebook.categories.v1';
const PREFS_KEY='pacefoldPrefsV15';
const PLAYLIST_KEY='pacefold.player.playlists.v1';
const STREAM_KEY='pacefold.player.streaming-links.v1';
const RECOVERY_NOTICE_KEY='pacefold.resilience.recoveryNotice.v1';
const BACKUP_META_KEY='pacefold.v20.backup.meta.v1';
const BACKUP_DB='pacefold-v20-backup';
const BACKUP_STORE='handles';
const BACKUP_HANDLE_KEY='active';
const MAX_BACKUP_BYTES=10_000_000;
const MAX_NOTES=5000;

let mounted=false;
let frame=0;
let observer=null;
let backupTimer=0;
let backupHandle=null;
let backupBusy=false;
let backupDirty=false;
let pendingBackupReason='change';
let backupReady=false;
let lastAttentionKey='';
let baseFavicon='';
let faviconLink=null;

const byId=id=>document.getElementById(id);
const compact=value=>String(value??'').replace(/\s+/g,' ').trim();
const safeParse=(raw,fallback)=>{try{return raw==null||raw===''?fallback:JSON.parse(raw);}catch{return fallback;}};
const create=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!=null)node.textContent=String(text);
  return node;
};
const button=(className,label)=>{
  const node=create('button',className);
  node.type='button';
  if(label)node.setAttribute('aria-label',label);
  return node;
};
const localDate=(value=new Date())=>{
  const date=value instanceof Date?value:new Date(value);
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10);
};

function report(scope,error){
  try{window.__PACEFOLD_DIAGNOSTICS__?.recordError?.(`surface-${scope}`,error);}catch{}
}

function guarded(scope,callback){
  return function(...args){
    try{
      const result=callback.apply(this,args);
      if(result?.catch)result.catch(error=>report(scope,error));
      return result;
    }catch(error){report(scope,error);return undefined;}
  };
}

function prefs(){
  return window.__PACEFOLD_RUNTIME_CORE__?.getPrefs?.()||safeParse(localStorage.getItem(PREFS_KEY),{});
}

function filterPrefs(value){
  const result={};
  for(const [key,item] of Object.entries(value&&typeof value==='object'?value:{})){
    if(/(?:auth|token|secret|password|oneNoteClient|oneNoteTenant|oneNoteNotebook|oneNoteSection|oneNotePages|oneNoteLast)/i.test(key))continue;
    result[key]=item;
  }
  return result;
}

function rawNotebook(){
  let raw=null;
  try{raw=localStorage.getItem(ENTRY_KEY);}catch{}
  if(raw==null||raw==='')return{raw,missing:true,valid:false,notes:[]};
  if(raw.length>8_000_000)return{raw,missing:false,valid:false,notes:[]};
  const notes=safeParse(raw,null);
  const valid=Array.isArray(notes)&&notes.length<=MAX_NOTES&&notes.every(item=>
    item&&typeof item==='object'&&typeof item.body==='string'&&item.body.length<=100000
  );
  return{raw,missing:false,valid,notes:valid?notes:[]};
}

function currentBackupContext(){
  const notebook=rawNotebook();
  if(!notebook.valid)throw new Error('Notebook storage is unavailable; the backup file was not overwritten.');
  const currentPrefs=filterPrefs(prefs());
  return{
    format:'pacefold.backup.v1',
    schemaVersion:1,
    pacefoldSurface:RELEASE,
    automatic:true,
    exportedAt:new Date().toISOString(),
    prefs:currentPrefs,
    notes:notebook.notes,
    categories:safeArray(localStorage.getItem(CATEGORY_KEY)),
    playlistDefinitions:safeArray(localStorage.getItem(PLAYLIST_KEY)),
    streamingLinks:safeArray(localStorage.getItem(STREAM_KEY)),
    rhythmHistory:{
      history:currentPrefs.history||{},
      waterSips:Number(currentPrefs.waterSips)||0,
      lunchSessions:Array.isArray(currentPrefs.lunchSessions)?currentPrefs.lunchSessions:[],
      awaySessions:Array.isArray(currentPrefs.awaySessions)?currentPrefs.awaySessions:[],
      prayerSessions:Array.isArray(currentPrefs.prayerSessions)?currentPrefs.prayerSessions:[],
      bodySessions:Array.isArray(currentPrefs.bodySessions)?currentPrefs.bodySessions:[]
    },
    excluded:['Local audio blobs','Authentication and token fields']
  };
}

function safeArray(raw){
  const value=safeParse(raw,[]);
  return Array.isArray(value)?value:[];
}

function validateBackup(data){
  if(!data||typeof data!=='object'||(data.format!=='pacefold.backup.v1'&&data.format!=='pacefold.backup.v2'))throw new Error('This is not a supported Pacefold backup.');
  const notes=Array.isArray(data.notes)?data.notes:Array.isArray(data.entries)?data.entries:null;
  if(!notes||notes.length>MAX_NOTES||!notes.every(item=>item&&typeof item==='object'&&typeof item.body==='string'&&item.body.length<=100000))throw new Error('The backup notebook is invalid.');
  return{
    notes,
    categories:Array.isArray(data.categories)?data.categories:[],
    playlists:Array.isArray(data.playlistDefinitions)?data.playlistDefinitions:Array.isArray(data.playlists)?data.playlists:[],
    streamLinks:Array.isArray(data.streamingLinks)?data.streamingLinks:Array.isArray(data.streamLinks)?data.streamLinks:[],
    prefs:filterPrefs(data.prefs||{}),
    rhythm:data.rhythmHistory&&typeof data.rhythmHistory==='object'?data.rhythmHistory:{},
    exportedAt:String(data.exportedAt||'')
  };
}

function backupMeta(){
  return safeParse(localStorage.getItem(BACKUP_META_KEY),null);
}

function writeBackupMeta(patch){
  const next={...(backupMeta()||{}),...patch,version:RELEASE};
  try{localStorage.setItem(BACKUP_META_KEY,JSON.stringify(next));}catch{}
  return next;
}

function recoveryNeeded(){
  const notebook=rawNotebook();
  if(notebook.valid)return false;
  const notice=safeParse(localStorage.getItem(RECOVERY_NOTICE_KEY),null);
  const meta=backupMeta();
  return Boolean(notice?.backedUp||meta?.noteCount>0||meta?.savedAt);
}

function backupDatabase(){
  return new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error('IndexedDB is unavailable.'));return;}
    const request=indexedDB.open(BACKUP_DB,1);
    request.onupgradeneeded=()=>{
      const database=request.result;
      if(!database.objectStoreNames.contains(BACKUP_STORE))database.createObjectStore(BACKUP_STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Backup storage did not open.'));
  });
}

async function storedHandle(){
  try{
    const database=await backupDatabase();
    return await new Promise((resolve,reject)=>{
      const transaction=database.transaction(BACKUP_STORE,'readonly');
      const request=transaction.objectStore(BACKUP_STORE).get(BACKUP_HANDLE_KEY);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error);
      transaction.oncomplete=()=>database.close();
    });
  }catch(error){report('backup-handle-read',error);return null;}
}

async function storeHandle(handle){
  backupHandle=handle;
  try{
    const database=await backupDatabase();
    await new Promise((resolve,reject)=>{
      const transaction=database.transaction(BACKUP_STORE,'readwrite');
      transaction.objectStore(BACKUP_STORE).put(handle,BACKUP_HANDLE_KEY);
      transaction.oncomplete=resolve;
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error);
    });
    database.close();
    return true;
  }catch(error){
    report('backup-handle-store',error);
    return false;
  }
}

async function permission(handle,{request=false}={}){
  if(!handle)return'denied';
  try{
    if(typeof handle.queryPermission!=='function')return'granted';
    let result=await handle.queryPermission({mode:'readwrite'});
    if(result==='prompt'&&request&&typeof handle.requestPermission==='function')result=await handle.requestPermission({mode:'readwrite'});
    return result;
  }catch(error){report('backup-permission',error);return'denied';}
}

function backupControl(){
  let control=byId('pf-v25-folio-backup');
  if(control)return control;
  const rail=byId('pf-v25-activity-workbench')?.querySelector('.pf-v25-activity-workbench-rail');
  if(!rail)return null;
  control=button('pf-v25-folio-backup','Choose an automatic Pacefold backup file');
  control.id='pf-v25-folio-backup';
  const mark=create('span','pf-v25-folio-backup-mark');
  mark.setAttribute('aria-hidden','true');
  const copy=create('span','pf-v25-folio-backup-copy');
  copy.append(create('strong','','Backup file'),create('small','','Choose where notes are protected'));
  control.append(mark,copy);
  control.addEventListener('click',guarded('backup-pick',chooseBackup));
  rail.insertBefore(control,rail.querySelector('.pf-v25-activity-workbench-playing'));
  return control;
}

function setBackupState(state,detail){
  const control=backupControl();
  if(!control)return;
  control.dataset.state=state;
  const strong=control.querySelector('strong');
  const small=control.querySelector('small');
  const labels={
    unavailable:'Manual backup only',
    idle:'Choose backup file',
    connecting:'Connecting backup…',
    syncing:'Saving backup…',
    synced:'Backup protected',
    reconnect:'Reconnect backup',
    recovery:'Recovery available',
    error:'Backup needs attention'
  };
  if(strong)strong.textContent=labels[state]||'Backup file';
  if(small)small.textContent=detail||'Choose where notes are protected';
  control.setAttribute('aria-label',`${labels[state]||'Backup file'}. ${small?.textContent||''}`);
}

function timeLabel(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return'';
  return date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
}

async function readHandleBackup(handle){
  const file=await handle.getFile();
  if(Number(file.size)>MAX_BACKUP_BYTES)throw new Error('The selected backup is too large.');
  const text=await file.text();
  if(!compact(text))return null;
  return validateBackup(JSON.parse(text));
}

function applyBackup(data,{automatic=false}={}){
  const nextPrefs={...prefs(),...data.prefs};
  if(data.rhythm.history)nextPrefs.history=data.rhythm.history;
  for(const key of ['waterSips','lunchSessions','awaySessions','prayerSessions','bodySessions'])
    if(data.rhythm[key]!=null)nextPrefs[key]=data.rhythm[key];
  localStorage.setItem(ENTRY_KEY,JSON.stringify(data.notes));
  localStorage.setItem(CATEGORY_KEY,JSON.stringify(data.categories));
  localStorage.setItem(PLAYLIST_KEY,JSON.stringify(data.playlists));
  localStorage.setItem(STREAM_KEY,JSON.stringify(data.streamLinks));
  const core=window.__PACEFOLD_RUNTIME_CORE__;
  if(core?.updatePrefs)core.updatePrefs(nextPrefs);
  else localStorage.setItem(PREFS_KEY,JSON.stringify(nextPrefs));
  try{localStorage.removeItem(RECOVERY_NOTICE_KEY);}catch{}
  writeBackupMeta({
    noteCount:data.notes.length,
    restoredAt:new Date().toISOString(),
    savedAt:data.exportedAt||new Date().toISOString(),
    fileName:backupHandle?.name||backupMeta()?.fileName||'Pacefold backup.json'
  });
  window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{source:'v20-backup-recovery',automatic}}));
  window.dispatchEvent(new CustomEvent('pacefold:prefs'));
  window.__PACEFOLD_WORKSPACE__?.reconcile?.();
  setBackupState('synced',automatic?'Notes recovered automatically':`${data.notes.length} notes recovered`);
}

async function recoverFromHandle({automatic=false}={}){
  if(!backupHandle)return false;
  const access=await permission(backupHandle);
  if(access!=='granted'){
    setBackupState(recoveryNeeded()?'recovery':'reconnect',recoveryNeeded()?'Reconnect to recover notes':'Edge needs file access again');
    return false;
  }
  try{
    const data=await readHandleBackup(backupHandle);
    if(!data||!data.notes.length&&backupMeta()?.noteCount>0)throw new Error('The backup file does not contain the expected notes.');
    applyBackup(data,{automatic});
    return true;
  }catch(error){
    report('backup-recovery',error);
    setBackupState('error','Backup could not be read');
    return false;
  }
}

async function writeBackup(reason='change'){
  if(!backupHandle)return false;
  if(backupBusy){
    backupDirty=true;
    pendingBackupReason=reason;
    return false;
  }
  const notebook=rawNotebook();
  if(!notebook.valid){
    if(recoveryNeeded())await recoverFromHandle({automatic:true});
    return false;
  }
  const access=await permission(backupHandle);
  if(access!=='granted'){
    setBackupState('reconnect','Click to reconnect the backup file');
    return false;
  }
  backupBusy=true;
  setBackupState('syncing','Writing the latest notes');
  try{
    const payload=currentBackupContext();
    payload.backupReason=reason;
    const encoded=JSON.stringify(payload,null,2);
    if(encoded.length>MAX_BACKUP_BYTES)throw new Error('The backup exceeded the safe size limit.');
    const writable=await backupHandle.createWritable();
    await writable.write(encoded);
    await writable.close();
    const meta=writeBackupMeta({
      noteCount:payload.notes.length,
      savedAt:payload.exportedAt,
      fileName:backupHandle.name||'Pacefold backup.json'
    });
    setBackupState('synced',`${meta.fileName} · ${timeLabel(meta.savedAt)}`);
    window.dispatchEvent(new CustomEvent('pacefold:backup',{detail:{reason,noteCount:payload.notes.length,savedAt:payload.exportedAt}}));
    return true;
  }catch(error){
    report('backup-write',error);
    setBackupState('error','Could not update the selected file');
    return false;
  }finally{
    backupBusy=false;
    if(backupDirty){
      backupDirty=false;
      const nextReason=pendingBackupReason;
      pendingBackupReason='change';
      scheduleBackup(nextReason,0);
    }
  }
}

function scheduleBackup(reason='change',delay=450){
  if(backupBusy){
    backupDirty=true;
    pendingBackupReason=reason;
    return;
  }
  clearTimeout(backupTimer);
  backupTimer=setTimeout(()=>{backupTimer=0;void writeBackup(reason);},Math.max(0,delay));
}

function downloadFallback(){
  try{
    const encoded=JSON.stringify(currentBackupContext(),null,2);
    const blob=new Blob([encoded],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=create('a');
    link.href=url;
    link.download=`pacefold-backup-${localDate()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
    setBackupState('unavailable','Downloaded once · automatic file access unavailable');
  }catch(error){report('backup-download',error);setBackupState('error','Backup download failed');}
}

async function chooseBackup(){
  if(typeof globalThis.showSaveFilePicker!=='function'){
    downloadFallback();
    return false;
  }
  setBackupState('connecting','Choose a JSON file and location');
  try{
    const handle=await globalThis.showSaveFilePicker({
      id:'pacefold-notes-backup',
      suggestedName:'Pacefold automatic backup.json',
      types:[{description:'Pacefold JSON backup',accept:{'application/json':['.json']}}]
    });
    const access=await permission(handle,{request:true});
    if(access!=='granted'){setBackupState('reconnect','File access was not granted');return false;}
    await storeHandle(handle);
    const needsRecovery=recoveryNeeded();
    if(needsRecovery){
      const existing=await readHandleBackup(handle);
      if(existing){applyBackup(existing,{automatic:false});await writeBackup('reconnected-after-recovery');return true;}
    }
    await writeBackup('file-selected');
    return true;
  }catch(error){
    if(error?.name==='AbortError'){
      const meta=backupMeta();
      setBackupState(meta?.savedAt?'synced':'idle',meta?.savedAt?`${meta.fileName||'Backup'} · ${timeLabel(meta.savedAt)}`:'Choose where notes are protected');
      return false;
    }
    report('backup-choose',error);
    setBackupState('error','Could not connect the selected file');
    return false;
  }
}

async function initializeBackup(){
  backupControl();
  if(typeof globalThis.showSaveFilePicker!=='function'){
    setBackupState('unavailable','Click for a one-time JSON download');
    backupReady=true;
    return;
  }
  backupHandle=await storedHandle();
  const meta=backupMeta();
  if(!backupHandle){
    setBackupState(recoveryNeeded()?'recovery':'idle',recoveryNeeded()?'Choose the existing backup to recover':'Choose where notes are protected');
    backupReady=true;
    return;
  }
  const access=await permission(backupHandle);
  if(access!=='granted'){
    setBackupState(recoveryNeeded()?'recovery':'reconnect',recoveryNeeded()?'Reconnect to recover notes':'Click to reconnect after Edge restart');
    backupReady=true;
    return;
  }
  if(recoveryNeeded())await recoverFromHandle({automatic:true});
  else if(meta?.savedAt)setBackupState('synced',`${meta.fileName||backupHandle.name||'Backup'} · ${timeLabel(meta.savedAt)}`);
  else await writeBackup('initial-connect');
  backupReady=true;
}

function ensureFavicon(){
  if(faviconLink?.isConnected)return faviconLink;
  faviconLink=document.querySelector('link[rel~="icon"]');
  if(!faviconLink){
    faviconLink=create('link');
    faviconLink.rel='icon';
    document.head.append(faviconLink);
  }
  if(!baseFavicon)baseFavicon=faviconLink.href;
  return faviconLink;
}

function attentionFavicon(){
  try{
    const canvas=document.createElement('canvas');
    canvas.width=64;
    canvas.height=64;
    const context=canvas.getContext('2d');
    if(!context)return'';
    context.fillStyle='#315b50';
    context.beginPath();
    context.roundRect(5,5,54,54,14);
    context.fill();
    context.fillStyle='#f7f5ed';
    context.font='700 34px system-ui';
    context.textAlign='center';
    context.textBaseline='middle';
    context.fillText('P',31,34);
    context.fillStyle='#e66d4f';
    context.beginPath();
    context.arc(52,12,9,0,Math.PI*2);
    context.fill();
    context.lineWidth=3;
    context.strokeStyle='#fff8ef';
    context.stroke();
    return canvas.toDataURL('image/png');
  }catch{return'';}
}

function attentionState(){
  const pulse=document.querySelector('[data-pf-flow-pulse]');
  const flowAttention=pulse?.dataset.state==='new';
  const source=document.body.dataset.source||'';
  const signal=document.body.dataset.signal||'none';
  const directAttention=['due','pending'].includes(signal)||signal==='active'&&['prayer','away','body'].includes(source);
  const active=Boolean(flowAttention||directAttention);
  const cue=compact(document.querySelector('[data-pf-flow-cue-text]')?.textContent);
  const privateMode=Boolean(prefs().privacy||prefs().quietMode);
  const labels={
    water:'Water due',noodle:'Timer ready',away:'Away cue',lunch:'Meal cue',
    eyes:'Eye reset',body:'Movement cue',prayer:'Scheduled pause'
  };
  return{
    active,
    source,
    signal,
    label:privateMode?'Attention waiting':cue&&cue!=='No action waiting'?cue:labels[source]||'Attention waiting',
    key:active?`${source}:${signal}:${cue}`:'clear'
  };
}

function alertControl(){
  let control=byId('pf-v25-folio-alert');
  if(control)return control;
  const shell=document.querySelector('main .clock-shell');
  if(!shell)return null;
  control=button('pf-v25-folio-alert','No Pacefold notification waiting');
  control.id='pf-v25-folio-alert';
  const dot=create('span','pf-v25-folio-alert-dot');
  dot.setAttribute('aria-hidden','true');
  const copy=create('span','pf-v25-folio-alert-copy');
  copy.append(create('strong','','All clear'),create('small','','Taskbar marker is off'));
  control.append(dot,copy);
  control.addEventListener('click',guarded('alert-click',async()=>{
    const state=attentionState();
    if(state.active){
      if(document.querySelector('[data-pf-flow-pulse][data-state="new"]'))await window.__PACEFOLD_FLOW__?.acknowledge?.('v20-marker');
      else await window.__PACEFOLD_SCHEDULER__?.clear?.();
    }
    syncAttention(true);
  }));
  shell.append(control);
  return control;
}

function syncAttention(force=false){
  const state=attentionState();
  if(!force&&state.key===lastAttentionKey)return;
  lastAttentionKey=state.key;
  const control=alertControl();
  if(control){
    control.dataset.active=String(state.active);
    const strong=control.querySelector('strong');
    const small=control.querySelector('small');
    if(strong)strong.textContent=state.active?state.label:'All clear';
    if(small)small.textContent=state.active?'Click to quiet the marker':'Taskbar marker is off';
    control.setAttribute('aria-label',state.active?`${state.label}. Clear the taskbar marker.`:'No Pacefold notification waiting');
  }
  document.documentElement.dataset.attentionActive=String(state.active);
  const link=ensureFavicon();
  if(state.active){
    const icon=attentionFavicon();
    if(icon)link.href=icon;
  }else if(baseFavicon)link.href=baseFavicon;
}

function installFolio(){
  const main=document.querySelector('main');
  const shell=main?.querySelector('.clock-shell');
  const workbench=byId('pf-v25-activity-workbench');
  if(!main||!shell||!workbench)return false;
  let folio=byId('pf-v25-folio-folio');
  if(!folio){
    folio=create('section','pf-v25-folio-folio');
    folio.id='pf-v25-folio-folio';
    folio.setAttribute('aria-label','Pacefold workday folio');
    main.insertBefore(folio,shell);
  }
  if(shell.parentElement!==folio)folio.append(shell);
  if(workbench.parentElement!==folio)folio.append(workbench);
  alertControl();
  backupControl();
  return true;
}

function syncPageUtilities(){
  const page=byId('pf-v25-activity-workbench')?.dataset.page||'notes';
  const backup=backupControl();
  const playing=byId('pf-v25-activity-workbench')?.querySelector('.pf-v25-activity-workbench-playing');
  if(backup)backup.hidden=page!=='notes';
  if(playing)playing.hidden=page!=='sound';
}

function reconcile(){
  if(!installFolio())return false;
  document.documentElement.classList.add('pf-v25-folio-active');
  document.body.dataset.pacefoldRelease=RELEASE;
  syncPageUtilities();
  syncAttention();
  if(!backupReady)void initializeBackup();
  return true;
}

function queue(){
  if(frame)return;
  frame=requestAnimationFrame(()=>{
    frame=0;
    try{reconcile();}catch(error){report('reconcile',error);}
  });
}

function observe(){
  observer?.disconnect();
  observer=new MutationObserver(mutations=>{
    if(mutations.every(item=>item.target instanceof Element&&item.target.closest?.('#pf-v25-folio-backup')))return;
    queue();
  });
  observer.observe(document.documentElement,{
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['data-signal','data-source','data-state','data-page','data-quiet','hidden']
  });
}

function initialize(){
  if(mounted)return;
  mounted=true;
  document.documentElement.classList.add('pf-v25-folio-active');
  observe();
  window.addEventListener('pacefold:storage-changed',guarded('storage-change',event=>{
    queue();
    if(backupReady&&event.detail?.source!=='v20-backup-recovery')scheduleBackup('notes-changed');
  }));
  window.addEventListener('pacefold:prefs',guarded('prefs-change',()=>{
    syncAttention(true);
    if(backupReady)scheduleBackup('preferences-changed',900);
  }));
  window.addEventListener('storage',guarded('cross-window',event=>{
    if([ENTRY_KEY,CATEGORY_KEY,PREFS_KEY,PLAYLIST_KEY,STREAM_KEY].includes(event.key)){
      queue();
      if(backupReady)scheduleBackup('other-window');
    }
  }));
  document.addEventListener('visibilitychange',guarded('visibility',()=>{
    if(document.hidden&&backupReady)scheduleBackup('app-hidden',0);
    else queue();
  }));
  window.addEventListener('pagehide',guarded('pagehide',()=>{if(backupReady)scheduleBackup('page-hidden',0);}));
  [0,80,240,700,1600].forEach(delay=>setTimeout(queue,delay));
}

window.__PACEFOLD_V20__={
  release:RELEASE,
  reconcile:queue,
  chooseBackup,
  writeBackup:()=>writeBackup('manual'),
  recover:()=>recoverFromHandle({automatic:false}),
  backupState:()=>({handle:Boolean(backupHandle),meta:backupMeta(),needed:recoveryNeeded()}),
  setTestHandle:handle=>{backupHandle=handle;backupReady=true;return true;}
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
else initialize();
})();
;
(() => {
  'use strict';

  const RELEASE='25.0.0';
  const PREFS_KEY='pacefoldPrefsV15';
  const SNAPSHOT_KEY='pacefold.v21.preferences.v1';
  const ENTRY_KEY='pacefold.notebook.entries.v2';
  const ONBOARDED_KEY='pacefoldOnboardedV15';
  const DISMISSED_KEY='pacefoldSetupDismissedV15';
  const DAY_MS=86400000;

  let mounted=false;
  let frame=0;
  let observer=null;
  let statusObserver=null;
  let notebookObserver=null;
  let calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
  let selectedCalendarDate='';
  let lastCalendarKey='';
  let settingsOpenAdvanced=false;
  let suppressingSetup=false;

  const byId=id=>document.getElementById(id);
  const compact=value=>String(value??'').replace(/\s+/g,' ').trim();
  const parse=(raw,fallback)=>{try{return raw==null||raw===''?fallback:JSON.parse(raw);}catch{return fallback;}};
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  const create=(tag,className,text)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!=null)node.textContent=String(text);
    return node;
  };
  const button=(className,label,text)=>{
    const node=create('button',className,text);
    node.type='button';
    if(label)node.setAttribute('aria-label',label);
    return node;
  };
  const localDate=(value=new Date())=>{
    const date=value instanceof Date?value:new Date(value);
    if(Number.isNaN(date.getTime()))return'';
    return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10);
  };

  function report(scope,error){
    try{window.__PACEFOLD_DIAGNOSTICS__?.recordError?.(`preferences-${scope}`,error);}catch{}
  }

  function guarded(scope,callback){
    return function(...args){
      try{
        const result=callback.apply(this,args);
        if(result?.catch)result.catch(error=>report(scope,error));
        return result;
      }catch(error){report(scope,error);return undefined;}
    };
  }

  function readPrefs(){
    return window.__PACEFOLD_RUNTIME_CORE__?.getPrefs?.()||object(parse(localStorage.getItem(PREFS_KEY),{}))||{};
  }

  function filteredPrefs(value){
    const result={};
    for(const [key,item] of Object.entries(object(value)||{})){
      if(/(?:auth|token|secret|password|oneNoteClient|oneNoteTenant|oneNoteNotebook|oneNoteSection|oneNotePages|oneNoteLast)/i.test(key))continue;
      result[key]=item;
    }
    return result;
  }

  function meaningfulPrefs(value){
    const prefs=object(value);
    if(!prefs)return false;
    return Object.keys(prefs).length>=4&&Boolean(
      prefs.profile||prefs.schemaVersion||prefs.workHours||prefs.workWeek||
      prefs.locationLabel||prefs.theme||prefs.sipCadence||prefs.waterTarget
    );
  }

  function snapshotPrefs(){
    const setupComplete=localStorage.getItem(ONBOARDED_KEY)==='1'||localStorage.getItem(DISMISSED_KEY)==='1'||window.__PACEFOLD_STARTUP__?.returning;
    if(!setupComplete)return false;
    const prefs=readPrefs();
    if(!meaningfulPrefs(prefs))return false;
    try{
      localStorage.setItem(ONBOARDED_KEY,'1');
      localStorage.setItem(DISMISSED_KEY,'1');
      localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({version:RELEASE,savedAt:new Date().toISOString(),prefs:filteredPrefs(prefs)}));
      return true;
    }catch(error){report('snapshot',error);return false;}
  }

  function updatePrefs(patch){
    if(!object(patch))return readPrefs();
    let next;
    const core=window.__PACEFOLD_RUNTIME_CORE__;
    if(core?.updatePrefs)next=core.updatePrefs(patch)||readPrefs();
    else{
      next={...readPrefs(),...patch};
      localStorage.setItem(PREFS_KEY,JSON.stringify(next));
    }
    snapshotPrefs();
    window.dispatchEvent(new CustomEvent('pacefold:prefs',{detail:{source:'v21-settings'}}));
    return next;
  }

  function setupNodes(){
    return [...document.querySelectorAll('#onboarding,.onboarding,[data-onboard-profile],.onboarding-option')]
      .filter(node=>node instanceof HTMLElement&&node.isConnected);
  }

  function suppressDuplicateSetup(){
    const setupComplete=localStorage.getItem(ONBOARDED_KEY)==='1'||localStorage.getItem(DISMISSED_KEY)==='1'||window.__PACEFOLD_STARTUP__?.returning;
    if(suppressingSetup||!setupComplete||new URLSearchParams(location.search).has('setup')||!meaningfulPrefs(readPrefs()))return false;
    suppressingSetup=true;
    let changed=false;
    try{
      localStorage.setItem(ONBOARDED_KEY,'1');
      localStorage.setItem(DISMISSED_KEY,'1');
      for(const node of setupNodes()){
        const setupRoot=node.matches('#onboarding,.onboarding')?node:node.closest('#onboarding,.onboarding');
        if(!setupRoot)continue;
        setupRoot.hidden=true;
        setupRoot.setAttribute('aria-hidden','true');
        setupRoot.inert=true;
        changed=true;
      }
      document.documentElement.classList.add('pf25Flow-returning');
    }catch(error){report('setup-suppress',error);}
    suppressingSetup=false;
    return changed;
  }

  function privacyOn(){
    const prefs=readPrefs();
    return Boolean(prefs.privacy||prefs.quietMode);
  }

  function statusParts(){
    const word=compact(byId('statusWord')?.textContent);
    const eventTime=compact(byId('eventTime')?.textContent);
    const relative=compact(byId('relativeTime')?.textContent);
    const name=compact(byId('eventName')?.textContent);
    return{word,eventTime,relative,name};
  }

  function meaningfulStatus(parts){
    const combined=compact(`${parts.word} ${parts.eventTime} ${parts.relative} ${parts.name}`);
    return combined&&!/^(?:next\s*)?$/i.test(combined)&&!/no action waiting/i.test(combined);
  }

  function dayline(){
    let root=byId('pf25Flow-dayline');
    if(root)return root;
    const sequence=byId('sequence');
    const statusArea=document.querySelector('.status-area');
    if(!sequence||!statusArea)return null;

    root=create('section','pf25Flow-dayline');
    root.id='pf25Flow-dayline';
    root.setAttribute('aria-label','Next workday moment');
    const copy=create('div','pf25Flow-dayline-copy');
    copy.append(
      create('span','pf25Flow-dayline-kicker','Next'),
      create('strong','pf25Flow-dayline-title','No scheduled pause'),
      create('small','pf25Flow-dayline-detail','Your workday is clear')
    );
    const actions=create('div','pf25Flow-dayline-actions');
    root.append(copy,actions);
    statusArea.insertBefore(root,sequence);
    return root;
  }

  function syncDayline(){
    const root=dayline();
    if(!root)return false;
    const parts=statusParts();
    const privateMode=privacyOn();
    const hasStatus=meaningfulStatus(parts);
    const title=root.querySelector('.pf25Flow-dayline-title');
    const detail=root.querySelector('.pf25Flow-dayline-detail');
    const kicker=root.querySelector('.pf25Flow-dayline-kicker');
    const actions=root.querySelector('.pf25Flow-dayline-actions');
    const dayType=byId('pf-day-type');
    if(dayType&&dayType.parentElement!==actions)actions.append(dayType);

    let nextTitle='No scheduled pause';
    let nextDetail='Your workday is clear';
    let nextKicker='Next';
    if(hasStatus){
      const fallbackIdentity=/^(?:next|scheduled moment)$/i.test(parts.word)?'Scheduled pause':parts.word||'Scheduled pause';
      const identity=privateMode?'Scheduled pause':parts.name||fallbackIdentity;
      const timing=compact([parts.eventTime,parts.relative].filter(Boolean).join(' · '));
      nextTitle=identity;
      nextDetail=timing||(!privateMode&&parts.word!==identity?parts.word:'Coming up in your workday');
      nextKicker=/due|ready|now/i.test(parts.word)?'Now':'Next';
    }
    if(title&&title.textContent!==nextTitle)title.textContent=nextTitle;
    if(detail&&detail.textContent!==nextDetail)detail.textContent=nextDetail;
    if(kicker&&kicker.textContent!==nextKicker)kicker.textContent=nextKicker;
    root.dataset.empty=String(!hasStatus);
    root.dataset.private=String(privateMode);
    return true;
  }

  function workHours(){
    const prefs=readPrefs();
    const today=new Date().getDay();
    const row=object(prefs.workWeek)?.[today]||object(prefs.workWeek)?.[String(today)];
    const fallback=String(prefs.workHours||'08:30-16:30').match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    const start=/^\d{2}:\d{2}$/.test(String(row?.start||''))?String(row.start):fallback?.[1]||'08:30';
    const end=/^\d{2}:\d{2}$/.test(String(row?.end||''))?String(row.end):fallback?.[2]||'16:30';
    return{start,end};
  }

  function ribbonMeta(){
    let meta=byId('pf25Flow-ribbon-meta');
    const sequence=byId('sequence');
    if(!sequence)return null;
    if(!meta){
      meta=create('div','pf25Flow-ribbon-meta');
      meta.id='pf25Flow-ribbon-meta';
      const start=create('span','pf25Flow-ribbon-start');
      const legend=create('span','pf25Flow-ribbon-legend');
      legend.append(create('i','pf25Flow-ribbon-key-now'),create('span','','Now'),create('i','pf25Flow-ribbon-key-moment'),create('span','','Scheduled'));
      const end=create('span','pf25Flow-ribbon-end');
      meta.append(start,legend,end);
      sequence.insertAdjacentElement('afterend',meta);
    }
    return meta;
  }

  function syncRibbonMeta(){
    const meta=ribbonMeta();
    if(!meta)return false;
    const hours=workHours();
    const format=value=>{
      const [h,m]=value.split(':').map(Number);
      return new Date(2000,0,1,h,m).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    };
    const start=meta.querySelector('.pf25Flow-ribbon-start');
    const end=meta.querySelector('.pf25Flow-ribbon-end');
    if(start)start.textContent=format(hours.start);
    if(end)end.textContent=format(hours.end);
    return true;
  }

  function rawEntries(){
    const value=parse(localStorage.getItem(ENTRY_KEY),[]);
    return Array.isArray(value)?value:[];
  }

  function noteDate(entry){
    const candidates=[
      entry?.date,entry?.day,entry?.createdDate,entry?.createdAt,entry?.updatedAt,
      entry?.timestamp,entry?.at,entry?.time
    ];
    for(const value of candidates){
      if(value==null||value==='')continue;
      if(typeof value==='string'){
        const direct=value.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
        if(direct)return direct[1];
      }
      const date=typeof value==='number'&&value<1e12?new Date(value*1000):new Date(value);
      const normalized=localDate(date);
      if(normalized)return normalized;
    }
    const id=String(entry?.id||'');
    return id.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1]||'';
  }

  function countsByDate(entries=rawEntries()){
    const counts=new Map();
    for(const entry of entries){
      const date=noteDate(entry);
      if(date)counts.set(date,(counts.get(date)||0)+1);
    }
    return counts;
  }

  function selectedNotebookDate(){
    const heading=compact(document.querySelector('.pf-notebook-head strong')?.textContent);
    const parsed=new Date(heading);
    return Number.isNaN(parsed.getTime())?selectedCalendarDate:localDate(parsed);
  }

  function calendar(){
    let root=byId('pf25Flow-note-calendar');
    const sheet=document.querySelector('#pf-local-workspace .pf-notebook-sheet');
    const head=sheet?.querySelector('.pf-notebook-head');
    if(!sheet||!head)return null;
    if(root&&root.parentElement===sheet)return root;
    root=create('section','pf25Flow-note-calendar');
    root.id='pf25Flow-note-calendar';
    root.setAttribute('aria-label','Notebook activity calendar');

    const summary=create('div','pf25Flow-calendar-summary');
    const kicker=create('span','pf25Flow-calendar-kicker','Notebook activity');
    const title=create('strong','pf25Flow-calendar-month');
    const stats=create('small','pf25Flow-calendar-stats','No notes yet');
    const controls=create('div','pf25Flow-calendar-controls');
    controls.append(
      button('pf25Flow-calendar-prev','Previous month','‹'),
      button('pf25Flow-calendar-today','Show this month','Today'),
      button('pf25Flow-calendar-next','Next month','›')
    );
    summary.append(kicker,title,stats,controls);

    const body=create('div','pf25Flow-calendar-body');
    const weekdays=create('div','pf25Flow-calendar-weekdays');
    for(const label of ['S','M','T','W','T','F','S'])weekdays.append(create('span','',label));
    const grid=create('div','pf25Flow-calendar-grid');
    body.append(weekdays,grid);
    root.append(summary,body);
    head.insertAdjacentElement('afterend',root);

    root.querySelector('.pf25Flow-calendar-prev').addEventListener('click',guarded('calendar-prev',()=>{
      calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);
      renderCalendar(true);
    }));
    root.querySelector('.pf25Flow-calendar-next').addEventListener('click',guarded('calendar-next',()=>{
      calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);
      renderCalendar(true);
    }));
    root.querySelector('.pf25Flow-calendar-today').addEventListener('click',guarded('calendar-today',()=>{
      const today=new Date();
      calendarMonth=new Date(today.getFullYear(),today.getMonth(),1);
      selectedCalendarDate=localDate(today);
      navigateNotebookDate(selectedCalendarDate);
      renderCalendar(true);
    }));
    return root;
  }

  function navigateNotebookDate(target){
    const targetDate=new Date(`${target}T12:00:00`);
    if(Number.isNaN(targetDate.getTime()))return false;
    let current=selectedNotebookDate();
    let currentDate=new Date(`${current}T12:00:00`);
    if(Number.isNaN(currentDate.getTime()))currentDate=new Date();
    const delta=Math.round((targetDate-currentDate)/DAY_MS);
    const actions=document.querySelector('#pf-local-workspace .pf-notebook-head-actions');
    const buttons=[...(actions?.querySelectorAll('button')||[])];
    const todayButton=buttons.find(node=>/^today$/i.test(compact(node.textContent))||/today/i.test(node.getAttribute('aria-label')||''));
    const previous=buttons.find(node=>/previous|earlier|back/i.test(node.getAttribute('aria-label')||'')||compact(node.textContent)==='‹'||compact(node.textContent)==='←');
    const next=buttons.find(node=>/next|later|forward/i.test(node.getAttribute('aria-label')||'')||compact(node.textContent)==='›'||compact(node.textContent)==='→');
    if(delta===0){selectedCalendarDate=target;return true;}
    if(Math.abs(delta)>45&&todayButton){todayButton.click();current=localDate();currentDate=new Date(`${current}T12:00:00`);}
    const remaining=Math.round((targetDate-currentDate)/DAY_MS);
    const control=remaining<0?previous:next;
    if(!control)return false;
    const steps=Math.min(62,Math.abs(remaining));
    for(let index=0;index<steps;index+=1)control.click();
    selectedCalendarDate=target;
    setTimeout(()=>renderCalendar(true),80);
    return true;
  }

  function renderCalendar(force=false){
    if(document.body?.dataset.quiet==='true'||readPrefs().quietMode)return true;
    const root=calendar();
    if(!root)return false;
    const entries=rawEntries();
    const counts=countsByDate(entries);
    const selected=selectedNotebookDate()||selectedCalendarDate;
    selectedCalendarDate=selected;
    const monthKey=`${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}-${selected}-${entries.length}-${[...counts.values()].reduce((sum,value)=>sum+value,0)}`;
    if(!force&&monthKey===lastCalendarKey)return true;
    lastCalendarKey=monthKey;

    root.querySelector('.pf25Flow-calendar-month').textContent=calendarMonth.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    const daysWithNotes=counts.size;
    root.querySelector('.pf25Flow-calendar-stats').textContent=entries.length
      ?`${daysWithNotes} note ${daysWithNotes===1?'day':'days'} · ${entries.length} ${entries.length===1?'note':'notes'}`
      :'No notes yet';

    const grid=root.querySelector('.pf25Flow-calendar-grid');
    const fragment=document.createDocumentFragment();
    const first=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);
    const start=new Date(first.getFullYear(),first.getMonth(),1-first.getDay());
    const today=localDate();
    for(let index=0;index<42;index+=1){
      const date=new Date(start.getFullYear(),start.getMonth(),start.getDate()+index);
      const key=localDate(date);
      const count=counts.get(key)||0;
      const cell=button('pf25Flow-calendar-day',`${date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}${count?`. ${count} ${count===1?'note':'notes'}.`:'. No notes.'}`);
      cell.dataset.date=key;
      cell.dataset.month=String(date.getMonth()===calendarMonth.getMonth());
      cell.dataset.today=String(key===today);
      cell.dataset.selected=String(key===selected);
      cell.dataset.hasNotes=String(count>0);
      cell.dataset.noteLevel=String(count<=0?0:count===1?1:count<=3?2:count<=6?3:4);
      cell.append(create('span','pf25Flow-calendar-number',date.getDate()));
      if(count)cell.append(create('small','pf25Flow-calendar-count',count>9?'9+':count));
      cell.addEventListener('click',guarded('calendar-select',()=>{
        selectedCalendarDate=key;
        if(date.getMonth()!==calendarMonth.getMonth())calendarMonth=new Date(date.getFullYear(),date.getMonth(),1);
        navigateNotebookDate(key);
        renderCalendar(true);
      }));
      fragment.append(cell);
    }
    grid.replaceChildren(fragment);
    return true;
  }

  function switchControl(label,description,key,{invert=false}={}){
    const row=create('label','pf25Flow-setting-switch');
    const copy=create('span','pf25Flow-setting-copy');
    copy.append(create('strong','',label),create('small','',description));
    const input=create('input');
    input.type='checkbox';
    input.dataset.pf25FlowPref=key;
    if(invert)input.dataset.invert='true';
    const visual=create('span','pf25Flow-switch-visual');
    visual.setAttribute('aria-hidden','true');
    row.append(copy,input,visual);
    input.addEventListener('change',guarded('setting-switch',()=>{
      const value=input.dataset.invert==='true'?!input.checked:input.checked;
      if(key==='quietMode'){
        const current=Boolean(readPrefs().quietMode);
        if(current!==value&&byId('pf-quiet-toggle'))byId('pf-quiet-toggle').click();
        else updatePrefs({quietMode:value});
      }else if(key==='notifications'){
        updatePrefs({notifications:value,notificationMode:value?'quiet':'off',taskbarBadge:value});
      }else updatePrefs({[key]:value});
      syncSettings();
      applyPreferenceSurface();
    }));
    return row;
  }

  function settingsPanel(){
    let root=byId('pf25Flow-settings');
    const panel=byId('panel');
    if(!panel)return null;
    if(root&&root.parentElement===panel)return root;
    root=create('section','pf25Flow-settings');
    root.id='pf25Flow-settings';
    root.setAttribute('aria-label','Pacefold essential settings');

    const header=create('header','pf25Flow-settings-head');
    const copy=create('div');
    copy.append(create('span','pf25Flow-settings-kicker','Essentials'),create('h2','','Your Pacefold'),create('p','','Changes save automatically and survive updates.'));
    const status=create('span','pf25Flow-settings-saved','Saved automatically');
    header.append(copy,status);

    const toggles=create('div','pf25Flow-settings-grid');
    toggles.append(
      switchControl('Quiet mode','Hide details and pause visible alerts','quietMode'),
      switchControl('Notifications','Allow Pacefold cues','notifications'),
      switchControl('Water','Hydration reminders during work','workReminders'),
      switchControl('Eyes','Short distance-vision resets','gazeEnabled'),
      switchControl('Movement','Ergonomic movement reminders','bodyEnabled'),
      switchControl('Weather','Show the saved-location forecast','v21WeatherEnabled')
    );

    const schedule=create('section','pf25Flow-settings-schedule');
    schedule.append(create('div','pf25Flow-settings-section-title','Workday'));
    const startLabel=create('label','pf25Flow-time-field');
    startLabel.append(create('span','','Start'));
    const start=create('input');start.type='time';start.dataset.pf25FlowTime='start';startLabel.append(start);
    const endLabel=create('label','pf25Flow-time-field');
    endLabel.append(create('span','','End'));
    const end=create('input');end.type='time';end.dataset.pf25FlowTime='end';endLabel.append(end);
    const editWeek=button('pf25Flow-edit-week','Edit each weekday','Edit week');
    editWeek.addEventListener('click',guarded('edit-week',()=>{
      const existing=panel.querySelector('[data-pf-edit-week]');
      if(existing)existing.click();
      else settingsOpenAdvanced=true;
      panel.dataset.pf25FlowAdvanced='true';
      syncSettings();
    }));
    schedule.append(startLabel,endLabel,editWeek);

    const saveHours=guarded('save-hours',()=>{
      const startValue=start.value;
      const endValue=end.value;
      if(!/^\d{2}:\d{2}$/.test(startValue)||!/^\d{2}:\d{2}$/.test(endValue)||startValue>=endValue)return;
      const prefs=readPrefs();
      const current=object(prefs.workWeek)||{};
      const next={};
      for(let day=0;day<7;day+=1){
        const row=object(current[day]||current[String(day)])||{};
        next[day]={...row,start:startValue,end:endValue,type:row.type||(!prefs.workdaysOnly||day>=1&&day<=5?'desk':'off')};
      }
      updatePrefs({workHours:`${startValue}-${endValue}`,workWeek:next});
      syncRibbonMeta();
      syncSettings();
    });
    start.addEventListener('change',saveHours);
    end.addEventListener('change',saveHours);

    const footer=create('footer','pf25Flow-settings-footer');
    const advanced=button('pf25Flow-more-settings','Show all settings','More settings');
    advanced.addEventListener('click',guarded('settings-advanced',()=>{
      settingsOpenAdvanced=!settingsOpenAdvanced;
      panel.dataset.pf25FlowAdvanced=String(settingsOpenAdvanced);
      advanced.textContent=settingsOpenAdvanced?'Fewer settings':'More settings';
      advanced.setAttribute('aria-expanded',String(settingsOpenAdvanced));
    }));
    const version=create('span','pf25Flow-settings-version',`Pacefold ${RELEASE}`);
    footer.append(advanced,version);
    root.append(header,toggles,schedule,footer);

    const first=panel.firstElementChild;
    if(first)first.insertAdjacentElement('afterend',root);
    else panel.append(root);
    panel.dataset.pf25FlowAdvanced=String(settingsOpenAdvanced);
    return root;
  }

  function syncSettings(){
    const root=settingsPanel();
    if(!root)return false;
    const prefs=readPrefs();
    const values={
      quietMode:Boolean(prefs.quietMode),
      notifications:prefs.notifications!==false&&prefs.notificationMode!=='off',
      workReminders:prefs.workReminders!==false,
      gazeEnabled:prefs.gazeEnabled!==false,
      bodyEnabled:prefs.bodyEnabled!==false,
      v21WeatherEnabled:prefs.v21WeatherEnabled!==false
    };
    for(const input of root.querySelectorAll('[data-pf25Flow-pref]')){
      const raw=Boolean(values[input.dataset.pf25FlowPref]);
      const checked=input.dataset.invert==='true'?!raw:raw;
      if(input.checked!==checked)input.checked=checked;
    }
    const hours=workHours();
    const start=root.querySelector('[data-pf25Flow-time="start"]');
    const end=root.querySelector('[data-pf25Flow-time="end"]');
    if(start&&start.value!==hours.start)start.value=hours.start;
    if(end&&end.value!==hours.end)end.value=hours.end;
    const advanced=root.querySelector('.pf25Flow-more-settings');
    if(advanced){
      advanced.textContent=settingsOpenAdvanced?'Fewer settings':'More settings';
      advanced.setAttribute('aria-expanded',String(settingsOpenAdvanced));
    }
    return true;
  }

  function applyPreferenceSurface(){
    const prefs=readPrefs();
    document.documentElement.dataset.pf25FlowWeather=String(prefs.v21WeatherEnabled!==false);
    document.documentElement.dataset.pf25FlowQuiet=String(Boolean(prefs.quietMode));
    return true;
  }

  function observeStatus(){
    const status=byId('statusLine');
    if(!status)return;
    statusObserver?.disconnect();
    statusObserver=new MutationObserver(()=>queue());
    statusObserver.observe(status,{childList:true,subtree:true,characterData:true});
  }

  function observeNotebook(){
    const workspace=byId('pf-local-workspace');
    if(!workspace)return;
    notebookObserver?.disconnect();
    notebookObserver=new MutationObserver(mutations=>{
      if(mutations.every(item=>item.target instanceof Element&&item.target.closest?.('#pf25Flow-note-calendar')))return;
      selectedCalendarDate=selectedNotebookDate()||selectedCalendarDate;
      renderCalendar(true);
    });
    notebookObserver.observe(workspace,{childList:true,subtree:true,characterData:true});
  }

  function reconcile(){
    if(document.body?.dataset.quiet==='true'||readPrefs().quietMode)return true;
    suppressDuplicateSetup();
    const release=window.__PACEFOLD_ACTIVE_RELEASE__||RELEASE;
    document.documentElement.classList.add('pf-v25-flow-active');
    document.documentElement.dataset.pacefoldExperience=release;
    document.body.dataset.pacefoldExperience=release;
    dayline();
    ribbonMeta();
    calendar();
    settingsPanel();
    syncDayline();
    syncRibbonMeta();
    renderCalendar();
    syncSettings();
    applyPreferenceSurface();
    snapshotPrefs();
    if(!statusObserver)observeStatus();
    if(!notebookObserver)observeNotebook();
    return true;
  }

  function queue(){
    if(document.body?.dataset.quiet==='true'||readPrefs().quietMode)return true;
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      try{reconcile();}catch(error){report('reconcile',error);}
    });
  }

  function observe(){
    observer?.disconnect();
    observer=new MutationObserver(mutations=>{
      if(mutations.every(item=>item.target instanceof Element&&item.target.closest?.('#pf25Flow-dayline,#pf25Flow-note-calendar,#pf25Flow-settings,#pf25Flow-ribbon-meta')))return;
      queue();
    });
    observer.observe(document.documentElement,{
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','hidden','aria-hidden','data-page','data-quiet','data-signal','data-source']
    });
  }

  function initialize(){
    if(mounted)return;
    mounted=true;
    if(!selectedCalendarDate)selectedCalendarDate=localDate();
    document.documentElement.classList.add('pf-v25-flow-active');
    observe();
    window.addEventListener('pacefold:prefs',guarded('prefs-event',()=>{
      snapshotPrefs();
      lastCalendarKey='';
      queue();
    }));
    window.addEventListener('pacefold:storage-changed',guarded('storage-event',()=>{
      lastCalendarKey='';
      renderCalendar(true);
      snapshotPrefs();
    }));
    window.addEventListener('storage',guarded('cross-window',event=>{
      if([PREFS_KEY,ENTRY_KEY,SNAPSHOT_KEY].includes(event.key)){
        lastCalendarKey='';
        queue();
      }
    }));
    document.addEventListener('visibilitychange',guarded('visibility',()=>{
      if(document.hidden)snapshotPrefs();
      else queue();
    }));
    window.addEventListener('pagehide',guarded('pagehide',snapshotPrefs));
    [0,60,180,500,1200,2500].forEach(delay=>setTimeout(queue,delay));
  }

  window.__PACEFOLD_RUNTIME__={
    release:RELEASE,
    reconcile:queue,
    renderCalendar:()=>renderCalendar(true),
    snapshot:snapshotPrefs,
    settings:()=>({advanced:settingsOpenAdvanced,prefs:filteredPrefs(readPrefs())}),
    noteCounts:()=>Object.fromEntries(countsByDate())
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();

(() => {
  'use strict';

  const RELEASE='25.0.0';
  const SETTINGS_KEY='pacefold.v21.settings.v1';
  const EXTENSION_KEYS=new Set(['v21WeatherEnabled']);
  const METADATA_KEYS=new Set(['version','savedAt']);
  let observer=null;

  const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}};
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  const rawRead=()=>object(parse(localStorage.getItem(SETTINGS_KEY),{}))||{};
  const extensionPatch=patch=>Object.fromEntries(Object.entries(object(patch)||{}).filter(([key])=>EXTENSION_KEYS.has(key)));
  const corePatch=patch=>Object.fromEntries(Object.entries(object(patch)||{}).filter(([key])=>!EXTENSION_KEYS.has(key)));
  const read=()=>extensionPatch(rawRead());
  const write=value=>{
    const next=extensionPatch(value);
    localStorage.setItem(SETTINGS_KEY,JSON.stringify({...next,version:RELEASE,savedAt:new Date().toISOString()}));
    return next;
  };

  function sanitizeStore(){
    const rawText=localStorage.getItem(SETTINGS_KEY);
    if(!rawText)return false;
    const raw=object(parse(rawText,{}))||{};
    const next=extensionPatch(raw);
    const contaminated=Object.keys(raw).some(key=>!EXTENSION_KEYS.has(key)&&!METADATA_KEYS.has(key));
    if(!contaminated&&raw.version===RELEASE)return false;
    try{
      localStorage.setItem(SETTINGS_KEY,JSON.stringify({...next,version:RELEASE,savedAt:raw.savedAt||new Date().toISOString()}));
      return true;
    }catch{return false;}
  }

  function applySurface(settings=read()){
    document.documentElement.dataset.pf25FlowWeather=String(settings.v21WeatherEnabled!==false);
  }

  function suppressUnrequestedReview(){
    const review=document.getElementById('pf-fold-review');
    if(!review)return false;
    const dismiss=[...review.querySelectorAll('button')].find(button=>/close|dismiss|later|skip|done|continue/i.test(`${button.textContent||''} ${button.getAttribute('aria-label')||''}`));
    if(dismiss&&!review.dataset.pf25FlowDismissing){
      review.dataset.pf25FlowDismissing='true';
      dismiss.click();
    }
    if(review.isConnected)review.remove();
    return true;
  }

  function wrapCore(){
    const core=window.__PACEFOLD_RUNTIME_CORE__;
    if(!core||core.__pacefoldPersistence)return false;

    const originalGet=typeof core.getPrefs==='function'?core.getPrefs.bind(core):()=>({});
    const originalUpdate=typeof core.updatePrefs==='function'?core.updatePrefs.bind(core):null;

    core.getPrefs=()=>({...originalGet(),...read()});
    core.updatePrefs=patch=>{
      const extension=extensionPatch(patch);
      const base=corePatch(patch);
      let next=Object.keys(base).length&&originalUpdate?originalUpdate(base):originalGet();
      if(Object.keys(extension).length)write({...read(),...extension});
      const extensionState=read();
      next={...next,...extensionState};
      applySurface(extensionState);
      return next;
    };
    core.__pacefoldPersistence=true;
    return true;
  }

  function reconcile(){
    sanitizeStore();
    wrapCore();
    const settings=read();
    applySurface(settings);
    suppressUnrequestedReview();
    const weather=document.querySelector('[data-pf25Flow-pref="v21WeatherEnabled"]');
    if(weather&&weather.checked!==(settings.v21WeatherEnabled!==false))weather.checked=settings.v21WeatherEnabled!==false;
    window.__PACEFOLD_RUNTIME__?.reconcile?.();
  }

  function initialize(){
    sanitizeStore();
    wrapCore();
    applySurface();
    suppressUnrequestedReview();
    observer=new MutationObserver(mutations=>{
      if(mutations.some(item=>item.target instanceof Element&&(item.target.id==='pf-fold-review'||item.target.closest?.('#pf-fold-review')))||document.getElementById('pf-fold-review'))suppressUnrequestedReview();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-hidden']});
    window.addEventListener('storage',event=>{
      if(event.key===SETTINGS_KEY)reconcile();
    });
    window.addEventListener('pacefold:prefs',()=>{
      applySurface();
      suppressUnrequestedReview();
    });
    [0,30,100,300,900,2500].forEach(delay=>setTimeout(reconcile,delay));
  }

  window.__PACEFOLD_PERSISTENCE__={
    release:RELEASE,
    key:SETTINGS_KEY,
    read,
    write:settings=>{const next=write(settings);reconcile();return next;},
    reconcile,
    sanitizeStore,
    suppressUnrequestedReview
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();

(() => {
  'use strict';

  const RELEASE='25.0.0';
  const SNAPSHOT_KEY='pacefold.v21.preferences.v1';
  const SETTINGS_KEY='pacefold.v21.settings.v1';
  let frame=0;
  let observer=null;

  const compact=value=>String(value??'').replace(/\s+/g,' ').trim();
  const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}};
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  const text=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
  const attribute=(node,name,value)=>{if(node&&node.getAttribute(name)!==value)node.setAttribute(name,value);};
  const dataset=(node,name,value)=>{if(node&&node.dataset[name]!==value)node.dataset[name]=value;};

  function report(scope,error){
    try{window.__PACEFOLD_DIAGNOSTICS__?.recordError?.(`precision-${scope}`,error);}catch{}
  }

  function guarded(scope,callback){
    return function(...args){
      try{
        const result=callback.apply(this,args);
        if(result?.catch)result.catch(error=>report(scope,error));
        return result;
      }catch(error){report(scope,error);return undefined;}
    };
  }

  function patchPublicVersion(){
    const release=window.__PACEFOLD_ACTIVE_RELEASE__||RELEASE;
    document.documentElement.classList.add('pf-v25-flow-1-active');
    dataset(document.documentElement,'pacefoldExperience',release);
    dataset(document.documentElement,'pacefoldRefinement',RELEASE);
    dataset(document.body,'pacefoldExperience',release);
    dataset(document.body,'pacefoldRefinement',RELEASE);
    text(document.querySelector('.pf25Flow-settings-version'),`v${release}`);
    for(const api of [window.__PACEFOLD_STARTUP__,window.__PACEFOLD_RUNTIME__,window.__PACEFOLD_PERSISTENCE__]){
      if(api&&api.release!==release){try{api.release=release;}catch{}}
    }
  }

  function patchStoredVersion(key){
    const value=object(parse(localStorage.getItem(key),null));
    if(!value||value.version===RELEASE)return false;
    try{localStorage.setItem(key,JSON.stringify({...value,version:RELEASE}));return true;}catch{return false;}
  }

  function refineCalendar(){
    const cells=document.querySelectorAll('.pf25Flow-calendar-day');
    if(!cells.length)return false;
    for(const cell of cells){
      const raw=compact(cell.querySelector('.pf25Flow-calendar-count')?.textContent);
      const count=raw==='9+'?9:Number(raw)||0;
      const level=String(count<=0?0:count===1?1:count<=3?2:count<=6?3:4);
      dataset(cell,'noteLevel',level);
      const title=cell.getAttribute('aria-label')||'';
      if(count)attribute(cell,'title',title);
      else if(cell.hasAttribute('title'))cell.removeAttribute('title');
    }
    return true;
  }

  function refineSettings(){
    const root=document.getElementById('pf25Flow-settings');
    if(!root)return false;
    dataset(root,'refined',RELEASE);
    text(root.querySelector('.pf25Flow-settings-saved'),'Auto-saved');
    for(const row of root.querySelectorAll('.pf25Flow-setting-switch')){
      const title=compact(row.querySelector('strong')?.textContent);
      const description=compact(row.querySelector('small')?.textContent);
      if(title)attribute(row,'title',description?`${title} — ${description}`:title);
    }
    attribute(root.querySelector('.pf25Flow-more-settings'),'title','Open or hide the complete settings views');
    return true;
  }

  function refineLiveSurfaces(){
    const dayline=document.getElementById('pf25Flow-dayline');
    attribute(dayline,'aria-live','polite');
    attribute(dayline,'aria-atomic','true');
    const alert=document.querySelector('.pf-v25-folio-alert');
    attribute(alert,'aria-live','polite');
    attribute(alert,'aria-atomic','true');
    attribute(document.getElementById('workline'),'aria-label','Workday rhythm controls');
  }

  function updateDensity(){
    const width=window.innerWidth;
    dataset(document.documentElement,'pf25FlowDensity',width<=540?'compact':width<=900?'balanced':'wide');
  }

  function reconcile(){
    patchPublicVersion();
    patchStoredVersion(SNAPSHOT_KEY);
    patchStoredVersion(SETTINGS_KEY);
    refineCalendar();
    refineSettings();
    refineLiveSurfaces();
    updateDensity();
    return true;
  }

  function queue(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      try{reconcile();}catch(error){report('reconcile',error);}
    });
  }

  function initialize(){
    reconcile();
    observer=new MutationObserver(()=>queue());
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-expanded','data-selected','data-has-notes','data-pacefold-experience']});
    window.addEventListener('resize',guarded('resize',queue),{passive:true});
    window.addEventListener('pacefold:prefs',guarded('prefs',queue));
    window.addEventListener('pacefold:storage-changed',guarded('storage-changed',queue));
    window.addEventListener('storage',guarded('storage',event=>{
      if([SNAPSHOT_KEY,SETTINGS_KEY,'pacefold.notebook.entries.v2'].includes(event.key))queue();
    }));
    [40,160,500,1200,2600,4200].forEach(delay=>setTimeout(queue,delay));
  }

  window.__PACEFOLD_REFINEMENT__={release:RELEASE,reconcile:queue};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();

(()=>{
'use strict';
const EXPERIENCE='25.0.0';
const RELEASE='25.0.0';
const REVISION='dayflow-r3';
const CORE='25.0.0',PREFS='pacefoldPrefsV15',FLOW='pacefold.dayflow.v1',NOTES='pacefold.notebook.entries.v2',DAY=86400000;
let frame=0,observer,snapshot,date='',tab='day',search='',flowKey='',bookKey='';
const $=s=>document.querySelector(s),id=s=>document.getElementById(s),txt=v=>String(v??'').replace(/\s+/g,' ').trim(),obj=v=>v&&typeof v==='object'&&!Array.isArray(v),json=(v,f)=>{try{return v?JSON.parse(v):f}catch{return f}},el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=String(x);return n},btn=(c,a,x)=>{const n=el('button',c,x);n.type='button';if(a)n.setAttribute('aria-label',a);return n},local=(v=new Date())=>{const d=v instanceof Date?v:new Date(v);return Number.isNaN(d.getTime())?'':new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,10)},clock=v=>new Date(Number(v)||v).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),label=k=>new Date(`${k}T12:00:00`).toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'}),clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
const prefs=()=>window.__PACEFOLD_RUNTIME_CORE__?.getPrefs?.()||obj(json(localStorage.getItem(PREFS),{}))||{};
const notes=()=>{const v=json(localStorage.getItem(NOTES),[]);return Array.isArray(v)?v:[]};
const noteDay=n=>{const explicit=String(n?.date||'');if(/^20\d\d-\d\d-\d\d$/.test(explicit))return explicit;for(const v of [n?.createdAt,n?.updatedAt,n?.timestamp]){if(!v)continue;const k=local(v);if(k)return k}return String(n?.id||'').match(/20\d\d-\d\d-\d\d/)?.[0]||''};
const dayNotes=k=>notes().filter(n=>noteDay(n)===k).sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));
const empty=()=>({version:RELEASE,savedAt:new Date().toISOString(),days:{}});
const read=()=>{const v=json(localStorage.getItem(FLOW),null);return obj(v)&&obj(v.days)?{...v,version:RELEASE,days:{...v.days}}:empty()};
function norm(v,k){v=obj(v)?v:{};return{date:k,createdAt:v.createdAt||new Date().toISOString(),events:Array.isArray(v.events)?v.events.filter(obj).slice(-500):[]}}
function save(s){const cutoff=Date.now()-180*DAY;for(const k of Object.keys(s.days||{})){const t=new Date(`${k}T00:00:00`).getTime();if(!t||t<cutoff)delete s.days[k];else s.days[k]=norm(s.days[k],k)}s.version=RELEASE;s.savedAt=new Date().toISOString();localStorage.setItem(FLOW,JSON.stringify(s));window.dispatchEvent(new CustomEvent('pacefold:dayflow'));return s}
function getDay(s,k=local()){s.days=s.days||{};return s.days[k]=norm(s.days[k],k)}
const events=(k=local())=>norm(read().days?.[k],k).events.slice().sort((a,b)=>a.start-b.start);
const active=(source,k=local())=>[...events(k)].reverse().find(e=>e.source===source&&!e.end);
const eid=(t,s)=>`${t}-${Number(s).toString(36)}-${Math.random().toString(36).slice(2,6)}`;
function open(source,type,name,detail='',start=Date.now()){const s=read(),d=getDay(s,local(start));let e=d.events.find(x=>x.source===source&&!x.end);if(e)return e;e={id:eid(type,start),source,type,label:name,detail,start:Number(start)||Date.now(),end:null,meta:{}};d.events.push(e);save(s);return e}
function close(source,name='',end=Date.now()){const s=read();let found;for(const k of Object.keys(s.days||{}).sort().reverse()){found=[...getDay(s,k).events].reverse().find(e=>e.source===source&&!e.end);if(found){found.end=Math.max(found.start,end);break}}if(!found)return false;if(name)getDay(s,local(end)).events.push({id:eid('return',end),source:`return-${source}`,type:'return',label:name,detail:'',start:end,end,meta:{from:source}});save(s);return true}
function moment(type,name,detail='',start=Date.now(),source=type){const s=read(),d=getDay(s,local(start)),last=[...d.events].reverse().find(e=>e.source===source&&e.label===name);if(last&&Math.abs(last.start-start)<45000)return last;const e={id:eid(type,start),source,type,label:name,detail,start,end:start,meta:{}};d.events.push(e);save(s);return e}
function range(k=local()){const p=prefs(),d=new Date(`${k}T12:00:00`),r=obj(p.workWeek)?.[d.getDay()]||obj(p.workWeek)?.[String(d.getDay())]||{},m=String(p.workHours||'08:30-16:30').match(/^(\d\d:\d\d)-(\d\d:\d\d)$/),a=/^\d\d:\d\d$/.test(r.start)?r.start:m?.[1]||'08:30',b=/^\d\d:\d\d$/.test(r.end)?r.end:m?.[2]||'16:30';return{start:new Date(`${k}T${a}:00`).getTime(),end:new Date(`${k}T${b}:00`).getTime(),a,b}}
const dur=(e,now=Date.now())=>Math.max(0,(e.end||now)-e.start),fmt=(v,short=false)=>{const m=Math.max(0,Math.round(v/60000)),h=Math.floor(m/60),r=m%60;return short?(h?`${h}h ${String(r).padStart(2,'0')}m`:`${r}m`):(h?(r?`${h} hr ${r} min`:`${h} hr`):`${r} min`)};
function metrics(k=local()){const es=events(k),r=range(k),now=k===local()?Date.now():r.end,elapsed=Math.max(0,Math.min(now,r.end)-r.start),sum=t=>es.filter(e=>t.includes(e.type)).reduce((a,e)=>a+Math.max(0,Math.min(e.end||now,r.end)-Math.max(e.start,r.start)),0),field=sum(['field']),away=sum(['away']),meal=sum(['meal']),focus=sum(['focus']),desk=Math.max(0,elapsed-field-away-meal),p=prefs(),water=k===local()?(+p.waterSips||0):es.filter(e=>e.type==='water').reduce((a,e)=>Math.max(a,+e.meta?.total||0),0);return{k,events:es,range:r,elapsed,desk,field,away,meal,focus,water,notes:dayNotes(k).length,breaks:es.filter(e=>['away','meal','eyes','move'].includes(e.type)).length,focusBlocks:es.filter(e=>e.type==='focus').length}}
function insight(m){if(m.elapsed<1800000)return'Your workday log is just getting started.';if(m.field>5400000)return'Field-heavy day. The return points show where desk work resumed.';if(m.focus>=7200000)return'Strong focus depth today. Protect the conditions that created those blocks.';if(m.away+m.meal>Math.max(5400000,m.elapsed*.28))return'Time away is high relative to the logged window. Review transitions, not just the total.';if(!m.breaks&&m.elapsed>14400000)return'Long uninterrupted stretch. A short reset may improve the next block.';if(m.focusBlocks>=3)return'You built several focus blocks. Compare their timing to find your strongest window.';if(m.notes>=4)return'You captured useful context throughout the day. The log is becoming a reliable work record.';return'Your rhythm is balanced so far. Keep logging transitions instead of relying on memory.'}
function state(){const p=prefs(),dayType=document.body.dataset.dayType||p.todayOverride?.type||'desk';return{dayType,water:+p.waterSips||0,noteCount:dayNotes(local()).length,away:+p.awayStart||0,lunch:+p.lunchStart||0,timer:+p.noodleStart||0,eyes:+p.gazeActiveStart||0,body:+p.bodyActiveStart||0}}
function baseline(s){const r=range(),start=clamp(Date.now(),r.start,r.end),d=getDay(s,local());if(!d.events.some(e=>e.type==='day-start'))d.events.push({id:eid('day-start',start),source:'day-start',type:'day-start',label:'Workday opened',detail:'Pacefold began the local day log',start,end:start,meta:{}});save(s)}
function sync(){const c=state(),tracked=[['away','away','away','Away from desk','Returned to desk'],['lunch','lunch','meal','Meal break','Meal complete'],['timer','timer','timer','Timer started','Timer complete'],['eyes','eyes','eyes','Eye reset','Eye reset complete'],['body','body','move','Movement reset','Movement reset complete']];if(!snapshot){baseline(read());if(c.dayType==='field')open('day-type','field','Field mode','Out of the usual desk rhythm');for(const [source,key,type,name] of tracked)if(c[key])open(source,type,name,'',c[key]);snapshot=c;return}if(c.dayType!==snapshot.dayType){if(snapshot.dayType==='field')close('day-type','Returned to desk');if(c.dayType==='field')open('day-type','field','Field mode','Out of the usual desk rhythm');else moment('mode',`${c.dayType[0].toUpperCase()+c.dayType.slice(1)} mode`,'Today’s work pattern changed',Date.now(),'day-mode')}for(const [source,key,type,name,back] of tracked){if(c[key]&&!snapshot[key])open(source,type,name,'',c[key]);if(snapshot[key]&&!c[key])close(source,back)}if(c.water>snapshot.water){const e=moment('water','Water logged',`${c.water} total`,Date.now(),'water'),store=read(),found=getDay(store,local()).events.find(x=>x.id===e.id);if(found){found.meta={total:c.water};save(store)}}if(c.noteCount>snapshot.noteCount)moment('note','Note captured',`${c.noteCount} notes today`,Date.now(),'note-count');snapshot=c}
function toggleFocus(){active('focus')?close('focus','Focus block complete'):open('focus','focus','Deep focus','Manual focus block');flowKey=bookKey='';queue()}
function saveNote(){const input=id('pf25Flow-daybook-compose'),body=txt(input?.value);if(!body)return;const now=new Date(),k=date||local(),stamp=new Date(`${k}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`),at=Number.isNaN(stamp.getTime())?now:stamp,all=notes();all.push({id:`dayflow-${k}-${at.getTime().toString(36)}`,date:k,body,category:'Daily',createdAt:at.toISOString(),updatedAt:at.toISOString()});localStorage.setItem(NOTES,JSON.stringify(all.slice(-1000)));if(snapshot&&k===local())snapshot={...snapshot,noteCount:dayNotes(k).length};input.value='';moment('note','Note captured',body.slice(0,72),at.getTime(),'note-manual');window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:NOTES,source:'dayflow'}}));bookKey='';queue()}
function removeNote(n){if(!confirm('Delete this local note?'))return;localStorage.setItem(NOTES,JSON.stringify(notes().filter(x=>x.id!==n.id)));bookKey='';queue()}
function exportDay(){const k=date||local(),blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),date:k,metrics:metrics(k),notes:dayNotes(k)},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`pacefold-${k}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)}
function patch(){const html=document.documentElement,body=document.body,title='Pacefold — Quiet Workday Rhythm',release=window.__PACEFOLD_ACTIVE_RELEASE__||EXPERIENCE;html.classList.add('pf-v25-flow-precision-active','pf-v25-flow-minimal-active','pf-v25-flow-dayflow-active');if(html.lang!=='en')html.lang='en';if(html.dataset.pacefoldExperience!==release)html.dataset.pacefoldExperience=release;if(html.dataset.pacefoldMinimal!==REVISION)html.dataset.pacefoldMinimal=REVISION;if(html.dataset.pacefoldDayflow!==REVISION)html.dataset.pacefoldDayflow=REVISION;const weather=String(prefs().v21WeatherEnabled!==false);if(html.dataset.pf25FlowWeather!==weather)html.dataset.pf25FlowWeather=weather;const notesTab=document.querySelector('[data-workbench-page="notes"] strong');if(notesTab&&txt(notesTab.textContent)!=='Daybook')notesTab.textContent='Daybook';if(body.dataset.pacefoldExperience!==release)body.dataset.pacefoldExperience=release;if(!window.__PACEFOLD_ACTIVE_RELEASE__&&document.title!==title)document.title=title;if(window.__PACEFOLD_VERSION__?.revision!==REVISION)window.__PACEFOLD_VERSION__={experience:release,update:release,revision:REVISION,offlineCore:CORE}}
function brand(){const b=$('.product-mark');if(!b)return;let s=b.querySelector('.pf25Flow-brand-subline');if(!s){s=el('small','pf25Flow-brand-subline');b.append(s)}if(txt(s.textContent)!=='Focus · rhythm · flow')s.textContent='Focus · rhythm · flow'}
function settings(){const root=id('pf25Flow-settings');if(!root)return;const panel=root.closest('#panel'),more=root.querySelector('.pf25Flow-more-settings'),version=root.querySelector('.pf25Flow-settings-version'),apply=()=>{if(document.body?.dataset.quiet==='true'||prefs().quietMode)return;const desired=panel?.dataset.pf25FlowAdvanced==='true'?'Essentials':'Settings';if(more&&txt(more.textContent)!==desired)more.textContent=desired;if(version&&txt(version.textContent)!==`v${RELEASE}`)version.textContent=`v${RELEASE}`};apply();if(more&&more.dataset.dayflowLabel!=='true'){more.dataset.dayflowLabel='true';const watch=new MutationObserver(apply);if(panel)watch.observe(panel,{attributes:true,attributeFilter:['class','data-pf25Flow-advanced']});watch.observe(more,{childList:true,subtree:true,characterData:true});more.__pacefoldDayflowLabelObserver=watch;more.addEventListener('click',apply);id('brandButton')?.addEventListener('click',apply)}if(version){const title=`Pacefold ${RELEASE}; verified offline engine ${CORE}`;if(version.title!==title)version.title=title;let d=root.querySelector('.pf25Flow-version-detail');if(!d){d=el('small','pf25Flow-version-detail');version.after(d)}if(txt(d.textContent)!=='Offline ready')d.textContent='Offline ready';d.classList.add('pf25Flow-build-status')}}
function flowPanel(){let root=id('pf25Flow-dayflow');if(root)return root;const clockShell=$('.pf-v25-folio-folio>.clock-shell');if(!clockShell)return null;root=el('section','pf25Flow-dayflow');root.id='pf25Flow-dayflow';const head=el('header','pf25Flow-dayflow-head'),copy=el('div','pf25Flow-dayflow-title'),actions=el('div','pf25Flow-dayflow-actions'),focus=btn('pf25Flow-focus-toggle','Start a focus block','Start focus'),openBook=btn('pf25Flow-open-daybook','Open Daybook','Open Daybook'),exp=btn('pf25Flow-export-day','Export today','Export');focus.id='pf25Flow-focus-toggle';focus.onclick=toggleFocus;openBook.onclick=()=>id('pf25Flow-daybook')?.scrollIntoView({behavior:'smooth'});exp.onclick=exportDay;copy.append(el('span','','Today’s workday recap'),el('h2','','Live day log'),el('p','','Automatic local tracking of work modes, breaks, focus and notes.'));actions.append(el('span','pf25Flow-live-badge','Live'),focus,openBook,exp);head.append(copy,actions);const rhythm=el('div','pf25Flow-flow-rhythm'),track=el('div','pf25Flow-flow-track');track.append(el('div','pf25Flow-flow-segments'),el('i','pf25Flow-flow-now'));rhythm.append(track,el('div','pf25Flow-flow-axis'));root.append(head,rhythm,el('div','pf25Flow-flow-stream'),el('div','pf25Flow-flow-stats'),el('div','pf25Flow-flow-insight'));clockShell.after(root);return root}
function renderFlow(){const root=flowPanel();if(!root)return;const m=metrics(local()),focus=active('focus'),key=JSON.stringify([Math.floor(Date.now()/60000),m.events.map(e=>[e.id,e.end]),m.water,m.notes,focus?.id]);if(key===flowKey)return;flowKey=key;const toggle=id('pf25Flow-focus-toggle');toggle.textContent=focus?'End focus':'Start focus';toggle.dataset.active=String(!!focus);const seg=root.querySelector('.pf25Flow-flow-segments'),total=Math.max(1,m.range.end-m.range.start),now=Date.now();seg.replaceChildren(...m.events.filter(e=>['field','focus','away','meal'].includes(e.type)).map(e=>{const n=el('i','pf25Flow-flow-segment'),l=clamp((e.start-m.range.start)/total,0,1),r=clamp(((e.end||now)-m.range.start)/total,0,1);n.dataset.type=e.type;n.style.setProperty('--pf25Flow-left',`${l*100}%`);n.style.setProperty('--pf25Flow-width',`${Math.max(0,r-l)*100}%`);return n}));root.querySelector('.pf25Flow-flow-now').style.setProperty('--pf25Flow-now',`${clamp((now-m.range.start)/total,0,1)*100}%`);root.querySelector('.pf25Flow-flow-axis').replaceChildren(el('span','',clock(m.range.start)),el('span','','Now'),el('span','',clock(m.range.end)));root.querySelector('.pf25Flow-flow-stream').replaceChildren(...m.events.slice(-7).reverse().map(e=>{const a=el('article','pf25Flow-flow-event'),mark=el('span','pf25Flow-flow-event-mark',(e.label||e.type)[0]),copy=el('span','pf25Flow-flow-event-copy');a.dataset.type=e.type;copy.append(el('strong','',e.label),el('small','',[clock(e.start),e.end!==e.start?fmt(dur(e),true):'',e.detail].filter(Boolean).join(' · ')));a.append(mark,copy);return a}));root.querySelector('.pf25Flow-flow-stats').replaceChildren(...[['Desk',m.desk,'desk'],['Field',m.field,'field'],['Focus',m.focus,'focus'],['Away',m.away+m.meal,'away'],['Water',m.water,'water'],['Notes',m.notes,'note']].map(([a,b,t])=>{const n=el('article','pf25Flow-flow-stat');n.dataset.type=t;n.append(el('span','',a),el('strong','',typeof b==='number'&&t!=='water'&&t!=='note'?fmt(b,true):b));return n}));root.querySelector('.pf25Flow-flow-insight').replaceChildren(el('span','pf25Flow-flow-insight-mark','↗'),el('p','',insight(m)))}
function calendar(k){const d=new Date(`${k}T12:00:00`),first=new Date(d.getFullYear(),d.getMonth(),1),start=new Date(first.getFullYear(),first.getMonth(),1-first.getDay()),g=el('div','pf25Flow-daybook-calendar-grid');for(const x of ['S','M','T','W','T','F','S'])g.append(el('span','pf25Flow-daybook-weekday',x));for(let i=0;i<42;i++){const x=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i),key=local(x),n=btn('pf25Flow-daybook-day',x.toLocaleDateString([],{month:'long',day:'numeric'}),x.getDate());n.dataset.date=key;n.dataset.month=String(x.getMonth()===d.getMonth());n.dataset.selected=String(key===k);n.dataset.today=String(key===local());n.dataset.activity=String(dayNotes(key).length+events(key).length>0);n.onclick=()=>{date=key;bookKey='';queue()};g.append(n)}return g}
function log(m){const list=el('div','pf25Flow-daybook-log');if(!m.events.length){list.append(el('div','pf25Flow-daybook-empty','No logged moments yet. Pacefold builds the day as you use it.'));return list}for(const e of m.events.slice().reverse()){const row=el('article','pf25Flow-daybook-log-row'),copy=el('span','pf25Flow-daybook-log-copy');row.dataset.type=e.type;copy.append(el('strong','',e.label),el('small','',[e.detail,e.end!==e.start?fmt(dur(e)):e.end?'Moment':'In progress'].filter(Boolean).join(' · ')));row.append(el('time','',clock(e.start)),el('span','pf25Flow-daybook-log-rail'),copy);list.append(row)}return list}
function analytics(m){const a=el('aside','pf25Flow-daybook-analytics'),head=el('header',''),ring=el('div','pf25Flow-analytics-ring'),rows=el('div','pf25Flow-analytics-rows'),total=Math.max(1,m.desk+m.field+m.away+m.meal),d=m.desk/total,f=m.field/total;head.append(el('strong','','Workday analytics'),el('span','',m.k===local()?'Today':new Date(`${m.k}T12:00:00`).toLocaleDateString([],{month:'short',day:'numeric'})));ring.style.setProperty('--pf25Flow-desk',`${d*100}%`);ring.style.setProperty('--pf25Flow-field',`${(d+f)*100}%`);ring.style.setProperty('--pf25Flow-away','100%');ring.append(el('strong','',fmt(m.elapsed,true)),el('small','','logged'));for(const [x,v,t] of [['Desk time',m.desk,'desk'],['Field time',m.field,'field'],['Focus time',m.focus,'focus'],['Away + meal',m.away+m.meal,'away']]){const r=el('div');r.dataset.type=t;r.append(el('i'),el('span','',x),el('strong','',fmt(v,true)));rows.append(r)}const ins=el('div','pf25Flow-analytics-insight');ins.append(el('span','','Insight'),el('p','',insight(m)));a.append(head,ring,rows,ins);return a}
function week(){const s=el('section','pf25Flow-week-view'),bars=el('div','pf25Flow-week-bars');s.append(el('header','', 'Seven-day rhythm'));for(let o=6;o>=0;o--){const d=new Date();d.setDate(d.getDate()-o);const m=metrics(local(d)),a=el('article','pf25Flow-week-day'),c=el('div','pf25Flow-week-column');for(const [v,t] of [[m.desk,'desk'],[m.field,'field'],[m.focus,'focus']]){const i=el('i');i.dataset.type=t;i.style.setProperty('--pf25Flow-size',`${clamp(v/28800000,0,1)*100}%`);c.append(i)}a.append(c,el('span','',d.toLocaleDateString([],{weekday:'short'})),el('small','',fmt(m.elapsed,true)));bars.append(a)}s.append(bars);return s}
function book(){let root=id('pf25Flow-daybook');if(root)return root;const ws=id('pf-local-workspace');if(!ws)return null;root=el('section','pf25Flow-daybook');root.id='pf25Flow-daybook';const head=el('header','pf25Flow-daybook-head'),identity=el('div','pf25Flow-daybook-identity'),tabs=el('div','pf25Flow-daybook-tabs');identity.append(el('span','pf25Flow-daybook-mark','D'),el('span','', 'Daybook'));for(const [k,x] of [['day','Day log'],['notes','Notes'],['calendar','Calendar'],['insights','Insights']]){const b=btn('pf25Flow-daybook-tab',`Show ${x}`,x);b.dataset.tab=k;b.onclick=()=>{tab=k;bookKey='';queue()};tabs.append(b)}head.append(identity,tabs,el('span','pf25Flow-daybook-local','Local only'));const body=el('div','pf25Flow-daybook-body');body.append(el('aside','pf25Flow-daybook-nav'),el('main','pf25Flow-daybook-main'),el('div','pf25Flow-daybook-side'));root.append(head,body);ws.prepend(root);ws.classList.add('pf25Flow-daybook-mounted');return root}
function renderBook(){const root=book();if(!root)return;root.dataset.tab=tab;const k=date||local(),m=metrics(k),ns=dayNotes(k),key=JSON.stringify([tab,k,search,m.events.map(e=>[e.id,e.end]),ns.map(n=>[n.id,n.updatedAt])]);if(key===bookKey)return;bookKey=key;for(const b of root.querySelectorAll('.pf25Flow-daybook-tab')){b.dataset.active=String(b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab))}const nav=root.querySelector('.pf25Flow-daybook-nav'),main=root.querySelector('.pf25Flow-daybook-main'),side=root.querySelector('.pf25Flow-daybook-side'),h=el('header'),today=btn('pf25Flow-daybook-today','Return to today','Today');today.onclick=()=>{date=local();bookKey='';queue()};h.append(el('strong','',new Date(`${k}T12:00:00`).toLocaleDateString([],{month:'long',year:'numeric'})),today);nav.replaceChildren(h,calendar(k),el('div','pf25Flow-daybook-activity',`${Object.keys(read().days||{}).length} active days`));const compose=el('section','pf25Flow-daybook-compose'),ta=el('textarea','pf25Flow-daybook-textarea'),saveBtn=btn('pf25Flow-daybook-save','Save note','Save note');ta.id='pf25Flow-daybook-compose';ta.placeholder='Capture a decision, follow-up, field observation or idea…';ta.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')saveNote()};saveBtn.onclick=saveNote;compose.append(el('header','',k===local()?"What’s on your mind?":`Add to ${label(k)}`),ta,saveBtn);if(tab==='day')main.replaceChildren(compose,el('header','pf25Flow-daybook-section-head',label(k)),log(m));else if(tab==='notes'){const tools=el('div','pf25Flow-daybook-tools'),input=el('input');input.type='search';input.placeholder='Search notes';input.value=search;input.oninput=()=>{search=input.value;bookKey='';queue()};tools.append(input,el('span','',`${ns.length} notes`));const cards=el('div','pf25Flow-daybook-notes');for(const n of ns.filter(n=>!search||txt(`${n.body} ${n.category}`).toLowerCase().includes(search.toLowerCase()))){const c=el('article','pf25Flow-daybook-note'),head=el('header'),x=btn('pf25Flow-daybook-note-delete','Delete note','×');x.onclick=()=>removeNote(n);head.append(el('span','',n.category||'Note'),x);c.append(head,el('p','',n.body),el('small','',clock(n.updatedAt||n.createdAt)));cards.append(c)}main.replaceChildren(compose,tools,cards)}else if(tab==='calendar')main.replaceChildren(el('section','pf25Flow-daybook-date-summary',label(k)),log(m));else main.replaceChildren(week(),el('section','pf25Flow-daybook-long-insight',insight(m)));side.replaceChildren(analytics(m))}
function hideOld(){const ws=id('pf-local-workspace');if(ws)for(const n of [...ws.children])if(n.id!=='pf25Flow-daybook')n.classList.add('pf25Flow-legacy-hidden')}
function quiet(){return document.body?.dataset.quiet==='true'||Boolean(prefs().quietMode)}
function unmountQuiet(){id('pf25Flow-dayflow')?.remove();id('pf25Flow-daybook')?.remove();const ws=id('pf-local-workspace');if(ws){ws.classList.remove('pf25Flow-daybook-mounted');for(const n of [...ws.children])n.classList.remove('pf25Flow-legacy-hidden')}flowKey=bookKey=''}
function reconcile(){if(quiet()){unmountQuiet();return}patch();brand();settings();sync();renderFlow();renderBook();hideOld()}
function queue(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;try{reconcile()}catch(e){try{window.__PACEFOLD_DIAGNOSTICS__?.recordError?.('dayflow',e)}catch{}}})}
function init(){date=local();reconcile();observer=new MutationObserver(queue);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden','data-active','data-day-type','data-state','data-source','data-quiet','aria-selected','aria-expanded']});for(const e of ['pacefold:prefs','pacefold:storage-changed','pacefold:dayflow','pacefold:quiet'])window.addEventListener(e,()=>{flowKey=bookKey='';queue()});window.addEventListener('storage',()=>{snapshot=null;flowKey=bookKey='';queue()});setInterval(queue,60000);[50,250,700,1600].forEach(setTimeout.bind(null,queue))}
window.__PACEFOLD_PRECISION__={experience:EXPERIENCE,release:RELEASE,revision:REVISION,offlineCore:CORE,reconcile:queue};window.__PACEFOLD_DAYFLOW__={release:RELEASE,revision:REVISION,key:FLOW,read,events,metrics,add:moment,toggleFocus,exportDay,reconcile:queue};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();

(()=>{
'use strict';
const RELEASE='25.0.0';
const REVISION='spatial-r1';
const TITLE='Clock';
const PREFS='pacefoldPrefsV15';
const NOTES='pacefold.notebook.entries.v2';
const DRAFT='pacefold.spatial.note.draft.v1';
const ONBOARDED='pacefoldOnboardedV15';
const DISMISSED='pacefoldSetupDismissedV15';
const MODES={home:[0,0],notes:[0,-1],worklog:[-1,0],context:[1,0],settings:[0,1]};
let mode='home',edgeTimer=0,tickTimer=0,observer=null,setupObserver=null,refreshFrame=0,lastMinute=-1,selectedNoteDate='';
const $=selector=>document.querySelector(selector);
const id=value=>document.getElementById(value);
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const readJSON=(key,fallback)=>{try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback}catch{return fallback}};
const create=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content!=null)node.textContent=String(content);return node};
const button=(className,label,content)=>{const node=create('button',className,content);node.type='button';node.setAttribute('aria-label',label);return node};
const localKey=(value=new Date())=>{const date=value instanceof Date?value:new Date(value);return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const formatTime=value=>new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const formatDuration=ms=>{const minutes=Math.max(0,Math.round(ms/60000)),hours=Math.floor(minutes/60),rest=minutes%60;return hours?`${hours}h ${String(rest).padStart(2,'0')}m`:`${rest}m`};
const prefs=()=>window.__PACEFOLD_RUNTIME_CORE__?.getPrefs?.()||readJSON(PREFS,{});
const notes=()=>{const value=readJSON(NOTES,[]);return Array.isArray(value)?value:[]};
const noteDate=note=>String(note?.date||localKey(note?.updatedAt||note?.createdAt||Date.now()));
const visibleNotes=()=>notes().slice().sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));

function returningUser(){
  if(new URLSearchParams(location.search).has('legacyAudit')||sessionStorage.getItem('pacefold.spatial.disabled')==='1')return false;
  if(new URLSearchParams(location.search).has('setup'))return false;
  return Boolean(window.__PACEFOLD_STARTUP__?.returning||localStorage.getItem(ONBOARDED)==='1'||localStorage.getItem(DISMISSED)==='1');
}

function nodeText(selector,fallback=''){
  const node=$(selector);return text(node?.textContent)||fallback;
}

function proxyClick(selectors){
  for(const selector of selectors){const node=$(selector);if(node){node.click();return true}}
  return false;
}

function face(name,title,eyebrow){
  const section=create('section',`pf25Spatial-face pf25Spatial-face-${name}`);section.dataset.face=name;section.setAttribute('aria-label',title);
  const head=create('header','pf25Spatial-face-head');
  const copy=create('div','pf25Spatial-face-heading');copy.append(create('span','pf25Spatial-eyebrow',eyebrow),create('h1','',title));
  const home=button('pf25Spatial-home-button','Return to clock','Clock');home.addEventListener('click',()=>go('home'));
  head.append(copy,home);section.append(head);return section;
}

function mount(){
  if(id('pf25Spatial-spatial-root'))return;
  if(!returningUser()){
    document.documentElement.dataset.pacefoldSpatial='legacy';
    return;
  }
  const release=window.__PACEFOLD_ACTIVE_RELEASE__||RELEASE;
  document.title=TITLE;
  document.documentElement.dataset.pacefoldSpatial='ready';
  document.documentElement.dataset.pacefoldExperience=release;
  document.body.dataset.pacefoldExperience=release;
  const root=create('div','pf25Spatial-spatial-root');root.id='pf25Spatial-spatial-root';root.dataset.mode='home';root.dataset.release=release;
  const stage=create('div','pf25Spatial-stage');stage.id='pf25Spatial-stage';
  stage.append(buildHome(),buildNotes(),buildWorklog(),buildContext(),buildSettings());
  root.append(buildTopbar(),stage,buildEdges(),buildModeDots());
  document.body.append(root);
  installNavigation(root);
  refresh(true);
  window.__PACEFOLD_SPATIAL__={release,revision:REVISION,go,home:()=>go('home'),refresh:()=>refresh(true),setNoteDate,noteDate:()=>selectedNoteDate};
  window.dispatchEvent(new CustomEvent('pacefold:spatial-ready',{detail:{release}}));
}

function buildTopbar(){
  const bar=create('header','pf25Spatial-topbar');
  const brand=button('pf25Spatial-brand','Return to clock','Pacefold');brand.addEventListener('click',()=>go('home'));
  const current=create('span','pf25Spatial-current-mode','Clock');current.id='pf25Spatial-current-mode';
  const quiet=button('pf25Spatial-quiet','Toggle Quiet mode','Quiet');quiet.id='pf25Spatial-quiet';quiet.addEventListener('click',()=>{window.__PACEFOLD_QUIET__?.toggle?.();refresh(true)});
  bar.append(brand,current,quiet);return bar;
}

function buildEdges(){
  const wrap=create('nav','pf25Spatial-edge-nav');wrap.setAttribute('aria-label','Pacefold modes');
  const items=[['up','notes','Notes','↑'],['left','worklog','Worklog','←'],['right','context','Now','→'],['down','settings','Settings','↓']];
  for(const [side,target,label,arrow] of items){
    const edge=button(`pf25Spatial-edge pf25Spatial-edge-${side}`,`Open ${label}`,label);edge.dataset.target=target;
    edge.append(create('span','pf25Spatial-edge-arrow',arrow));
    edge.addEventListener('pointerenter',()=>{clearTimeout(edgeTimer);edgeTimer=setTimeout(()=>go(target),620)});
    edge.addEventListener('pointerleave',()=>clearTimeout(edgeTimer));
    edge.addEventListener('click',()=>go(target));wrap.append(edge);
  }
  return wrap;
}

function buildModeDots(){
  const nav=create('nav','pf25Spatial-mode-dots');nav.setAttribute('aria-label','Spatial mode position');
  for(const name of ['notes','worklog','home','context','settings']){const dot=button('pf25Spatial-mode-dot',`Open ${name}`,name==='home'?'●':'');dot.dataset.target=name;dot.addEventListener('click',()=>go(name));nav.append(dot)}
  return nav;
}

function buildHome(){
  const section=create('section','pf25Spatial-face pf25Spatial-face-home');section.dataset.face='home';
  const hero=create('div','pf25Spatial-clock-hero');
  const mark=create('div','pf25Spatial-home-mark');mark.append(create('span','','Pacefold'),create('small','','Focus · rhythm · flow'));
  const time=create('div','pf25Spatial-time');time.id='pf25Spatial-time';
  const main=create('span','pf25Spatial-time-main','--:--');main.id='pf25Spatial-time-main';
  const side=create('span','pf25Spatial-time-side'),dial=create('span','pf25Actions-seconds-dial');dial.setAttribute('aria-hidden','true');dial.append(create('i',''));
  side.append(dial,create('b','pf25Spatial-seconds','--'),create('small','pf25Spatial-ampm','--'));time.append(main,side);
  const date=create('div','pf25Spatial-date');date.id='pf25Spatial-date';
  const status=create('button','pf25Spatial-status');status.type='button';status.id='pf25Spatial-status';status.addEventListener('click',()=>status.dataset.actionable==='false'?go('worklog'):proxyClick(['#statusLine','.pf25Flow-dayline']));
  const progress=create('div','pf25Spatial-progress');progress.append(create('i','pf25Spatial-progress-fill'));progress.id='pf25Spatial-progress';
  const rituals=create('div','pf25Spatial-rituals');
  const items=[
    ['water','Water',['#waterBtn','#waterPill']],
    ['timer','Timer',['#noodleBtn','#noodlePill']],
    ['away','Away',['#awayBtn','#awayPill']],
    ['meal','Meal',['#lunchBtn','#lunchPill']],
    ['eyes','Eyes',['#eyesBtn','#gazeBtn']],
    ['move','Move',['#careBtn','#bodyBtn']]
  ];
  for(const [key,label,selectors] of items){const control=button('pf25Spatial-ritual',label,label);control.dataset.ritual=key;control.addEventListener('click',()=>proxyClick(selectors));rituals.append(control)}
  const glimpse=button('pf25Spatial-context-glimpse','Open weather and focus context','');glimpse.id='pf25Spatial-context-glimpse';glimpse.addEventListener('click',()=>go('context'));
  const navHint=create('div','pf25Spatial-nav-hint','Move to an edge or use the arrow keys');
  hero.append(mark,time,date,status,progress,rituals,glimpse,navHint);section.append(hero);return section;
}

function buildNotes(){
  const section=face('notes','Notes','Above the moment');
  const body=create('div','pf25Spatial-notes-layout');
  const capture=create('section','pf25Spatial-capture');
  capture.append(create('label','pf25Spatial-field-label','Capture from this moment'));
  const textarea=create('textarea','pf25Spatial-note-input');textarea.id='pf25Spatial-note-input';textarea.placeholder='Decision, follow-up, field observation or idea…';
  try{textarea.value=localStorage.getItem(DRAFT)||''}catch{}
  textarea.addEventListener('input',()=>{try{if(textarea.value)localStorage.setItem(DRAFT,textarea.value);else localStorage.removeItem(DRAFT)}catch{}});
  const actions=create('div','pf25Spatial-capture-actions');
  const status=create('span','pf25Spatial-save-status','Local only');status.id='pf25Spatial-save-status';
  const save=button('pf25Spatial-primary','Save note','Save note');save.addEventListener('click',saveSpatialNote);
  textarea.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();saveSpatialNote()}});
  actions.append(status,save);capture.append(textarea,actions);
  const recent=create('section','pf25Spatial-notes-recent');recent.append(create('header','', 'Recent notes'),create('div','pf25Spatial-note-list'));body.append(capture,recent);section.append(body);return section;
}

function saveSpatialNote(){
  const input=id('pf25Spatial-note-input'),body=text(input?.value);if(!body)return;
  const now=new Date(),all=notes();all.push({id:`spatial-${now.getTime().toString(36)}`,date:localKey(now),body,category:'Moment',createdAt:now.toISOString(),updatedAt:now.toISOString()});
  try{localStorage.setItem(NOTES,JSON.stringify(all.slice(-1000)));localStorage.removeItem(DRAFT);window.__PACEFOLD_DAYFLOW__?.add?.('note','Note captured',body.slice(0,90),now.getTime(),'note-spatial');window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:NOTES,source:'spatial'}}));input.value='';selectedNoteDate=localKey(now);id('pf25Spatial-save-status').textContent='Saved locally';renderNotes();setTimeout(()=>go('home'),720)}
  catch{const node=id('pf25Spatial-save-status');if(node)node.textContent='Could not save'}
}

function setNoteDate(value=''){
  selectedNoteDate=/^20\d{2}-\d{2}-\d{2}$/.test(String(value))?String(value):'';
  renderNotes();return selectedNoteDate;
}

function buildWorklog(){
  const section=face('worklog','Worklog','What already happened');
  const actions=create('div','pf25Spatial-face-actions');
  const focus=button('pf25Spatial-primary','Start or end focus','Start focus');focus.id='pf25Spatial-worklog-focus';focus.addEventListener('click',()=>window.__PACEFOLD_DAYFLOW__?.toggleFocus?.());
  const field=button('pf25Spatial-secondary','Toggle desk or field mode','Field / desk');field.addEventListener('click',()=>proxyClick(['#pf-day-type']));
  const exp=button('pf25Spatial-secondary','Export today','Export');exp.addEventListener('click',()=>window.__PACEFOLD_DAYFLOW__?.exportDay?.());actions.append(focus,field,exp);
  const body=create('div','pf25Spatial-worklog-layout');body.append(create('section','pf25Spatial-log-stream'),create('aside','pf25Spatial-log-summary'));section.append(actions,body);return section;
}

function buildContext(){
  const section=face('context','Now','What is approaching');
  const body=create('div','pf25Spatial-context-layout');
  const weather=create('section','pf25Spatial-context-weather');weather.append(create('span','pf25Spatial-eyebrow','Weather'),create('div','pf25Spatial-weather-main'),create('div','pf25Spatial-weather-days'));
  const now=create('section','pf25Spatial-context-now');now.append(create('span','pf25Spatial-eyebrow','Current rhythm'),create('div','pf25Spatial-now-status'),create('div','pf25Spatial-now-cards'));
  const refresh=button('pf25Spatial-secondary','Refresh weather','Refresh weather');refresh.addEventListener('click',()=>proxyClick(['.pf-v25-activity-weather-refresh']));now.append(refresh);
  body.append(weather,now);section.append(body);return section;
}

function buildSettings(){
  const section=face('settings','Settings & sound','Below the surface');
  const body=create('div','pf25Spatial-settings-layout');
  const essentials=create('section','pf25Spatial-settings-card');essentials.append(create('span','pf25Spatial-eyebrow','Essentials'));
  const settings=[['quiet','Quiet mode'],['weather','Weather'],['seconds','Seconds'],['notifications','Notifications']];
  for(const [key,label] of settings){const row=create('div','pf25Spatial-setting-row');row.append(create('span','',label));const toggle=button('pf25Spatial-switch',`Toggle ${label}`,'');toggle.dataset.setting=key;toggle.addEventListener('click',()=>toggleSetting(key));row.append(toggle);essentials.append(row)}
  const backup=button('pf25Spatial-secondary pf25Spatial-wide','Choose or update backup file','Backup notes');backup.addEventListener('click',()=>proxyClick(['.pf-v25-folio-backup','[data-action="backup"]']));
  const advanced=button('pf25Spatial-secondary pf25Spatial-wide','Open advanced settings','Advanced settings');advanced.addEventListener('click',openAdvancedSettings);essentials.append(backup,advanced,create('small','pf25Spatial-version',`Pacefold ${RELEASE} · verified offline core 25.0.0`));
  const sound=create('section','pf25Spatial-sound-card');sound.append(create('span','pf25Spatial-eyebrow','Sound'),create('h2','','Keep the soundtrack inside Pacefold'));
  const track=create('div','pf25Spatial-track');track.id='pf25Spatial-track';
  const controls=create('div','pf25Spatial-sound-controls');
  const play=button('pf25Spatial-primary','Play or pause','Play / pause');play.addEventListener('click',()=>proxyClick(['[aria-label*="Play"]','[aria-label*="Pause"]','.pf-v25-activity-player-toggle']));
  const open=button('pf25Spatial-secondary','Open full sound controls','Open sound controls');open.addEventListener('click',openSound);controls.append(play,open);sound.append(track,controls);
  body.append(essentials,sound);section.append(body);return section;
}

function toggleSetting(key){
  if(key==='quiet'){window.__PACEFOLD_QUIET__?.toggle?.();go('home');refresh(true);return}
  const core=window.__PACEFOLD_RUNTIME_CORE__,current=prefs();
  if(key==='weather'){const state=window.__PACEFOLD_PERSISTENCE__?.read?.()||{};window.__PACEFOLD_PERSISTENCE__?.write?.({...state,v21WeatherEnabled:state.v21WeatherEnabled===false});}
  if(key==='seconds')core?.updatePrefs?.({showSeconds:current.showSeconds===false});
  if(key==='notifications')core?.updatePrefs?.({notifications:current.notifications===false});
  refresh(true);
}

function openAdvancedSettings(){
  proxyClick(['#brandButton','.corner']);
  document.documentElement.classList.add('pf25Spatial-legacy-dialog-open');
  const panel=id('panel');if(panel){const close=()=>document.documentElement.classList.remove('pf25Spatial-legacy-dialog-open');panel.addEventListener('transitionend',()=>{if(!panel.classList.contains('on'))close()},{once:true})}
}
function openSound(){
  const sound=$('[data-workbench-page="sound"],.pf-v25-activity-workbench-tab[data-page="sound"]');if(sound)sound.click();
  document.documentElement.classList.add('pf25Spatial-legacy-dialog-open');
}

function go(next){
  if(!MODES[next])next='home';
  mode=next;const root=id('pf25Spatial-spatial-root');if(!root)return;
  root.dataset.mode=mode;id('pf25Spatial-current-mode').textContent={home:'Clock',notes:'Notes',worklog:'Worklog',context:'Now',settings:'Settings'}[mode];
  for(const dot of root.querySelectorAll('.pf25Spatial-mode-dot'))dot.dataset.active=String(dot.dataset.target===mode);
  sessionStorage.setItem('pacefold.spatial.mode',mode);
  refresh(true);
  requestAnimationFrame(()=>root.querySelector(`[data-face="${mode}"]`)?.focus?.({preventScroll:true}));
}

function installNavigation(root){
  document.addEventListener('keydown',event=>{
    if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
    const map={ArrowUp:'notes',ArrowLeft:'worklog',ArrowRight:'context',ArrowDown:'settings'};
    if(map[event.key]){event.preventDefault();go(map[event.key]);}
    else if(event.key==='Escape'||event.key==='Home'){event.preventDefault();go('home')}
  });
  let start=null;
  root.addEventListener('pointerdown',event=>{const edge=34,x=event.clientX,y=event.clientY;if(x<=edge||x>=innerWidth-edge||y<=edge||y>=innerHeight-edge)start={x,y,id:event.pointerId}});
  root.addEventListener('pointerup',event=>{if(!start||start.id!==event.pointerId)return;const dx=event.clientX-start.x,dy=event.clientY-start.y,ax=Math.abs(dx),ay=Math.abs(dy);if(Math.max(ax,ay)>70){if(ax>ay)go(dx>0?'worklog':'context');else go(dy>0?'notes':'settings')}start=null});
  root.addEventListener('pointercancel',()=>{start=null});
}

function refresh(force=false){
  document.title=TITLE;
  const quiet=Boolean(window.__PACEFOLD_QUIET__?.get?.()||prefs().quietMode||document.body.dataset.quiet==='true');
  const root=id('pf25Spatial-spatial-root');if(!root)return;root.dataset.quiet=String(quiet);const quietButton=id('pf25Spatial-quiet');if(quietButton)quietButton.dataset.active=String(quiet);
  renderClock();if(force||mode==='notes')renderNotes();if(force||mode==='worklog')renderWorklog();if(force||mode==='context')renderContext();if(force||mode==='settings')renderSettings();
  if(quiet&&mode!=='home')go('home');
}

function renderClock(){
  if(!id('pf25Spatial-time-main')||!$('.pf25Spatial-seconds')||!$('.pf25Spatial-ampm')||!id('pf25Spatial-date')||!id('pf25Spatial-status')||!$('.pf25Spatial-progress-fill')||!id('pf25Spatial-context-glimpse'))return;
  const now=new Date(),hours=now.getHours(),is24=prefs().timeFormat==='24',display=is24?String(hours).padStart(2,'0'):String(hours%12||12);
  id('pf25Spatial-time-main').textContent=`${display}:${String(now.getMinutes()).padStart(2,'0')}`;
  $('.pf25Spatial-seconds').textContent=String(now.getSeconds()).padStart(2,'0');
  const dial=$('.pf25Actions-seconds-dial');if(dial)dial.style.setProperty('--pf25Actions-second-angle',`${now.getSeconds()*6}deg`);
  $('.pf25Spatial-ampm').textContent=is24?'':hours>=12?'PM':'AM';
  id('pf25Spatial-date').textContent=now.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});
  const statusNode=id('pf25Spatial-status'),stale=/^overdue$/i.test(nodeText('#statusWord')),status=stale?nextWorkdayStatus(now):nodeText('#statusLine',nodeText('.pf25Flow-dayline','Workday in progress'));
  statusNode.textContent=status;statusNode.dataset.actionable=String(!stale);statusNode.title=stale?'Open Worklog to review the missed moment':'Use the current workday action';
  const original=$('#progressFill,.pf25Flow-dayline-progress i,.pf-ribbon-spent'),width=original?parseFloat(getComputedStyle(original).width)||0:0,parent=original?.parentElement?parseFloat(getComputedStyle(original.parentElement).width)||1:1;
  $('.pf25Spatial-progress-fill').style.setProperty('--pf25Spatial-progress',`${Math.min(100,Math.max(0,width/parent*100))}%`);
  const weather=[nodeText('.pf-v25-activity-weather-temp'),nodeText('.pf-v25-activity-weather-copy>strong')].filter(Boolean).join(' · ')||'Weather';id('pf25Spatial-context-glimpse').textContent=weather;
  const p=prefs(),timerLabel=p.prepPreset==='noodles'?`Noodles ${Number(p.noodleMinutes)||30}m`:nodeText('#noodleText','Timer');
  const states={
    water:{label:'Water',due:'#waterBtn.due,#waterPill.due',active:'#waterBtn.active,#waterPill.active'},
    timer:{label:timerLabel,due:'#noodleBtn.ready,#noodlePill.ready',active:'#noodleBtn.running,#noodlePill.running'},
    away:{label:nodeText('#awayText','Away'),due:'#awayBtn.due,#awayPill.due',active:'#awayBtn.active,#awayPill.active'},
    meal:{label:nodeText('#lunchText','Meal'),due:'#lunchBtn.ready,#lunchPill.ready',active:'#lunchBtn.running,#lunchPill.running'},
    eyes:{label:'Eyes',due:'#eyesBtn.due,#gazeBtn.due',active:'#eyesBtn.active,#gazeBtn.active'},
    move:{label:'Move',due:'#careBtn.due,#bodyBtn.due',active:'#careBtn.active,#bodyBtn.active'}
  };
  for(const [key,state] of Object.entries(states)){const control=$(`[data-ritual="${key}"]`);if(!control)continue;control.textContent=state.label;control.dataset.due=String(Boolean($(state.due)));control.dataset.active=String(Boolean($(state.active)))}
}

function nextWorkdayStatus(now=new Date()){
  const sequence=id('sequence'),progress=parseFloat(sequence?.style.getPropertyValue('--pf-ribbon-progress')||'0'),creases=[...(sequence?.querySelectorAll('.pf-ribbon-crease')||[])].map(node=>({node,x:parseFloat(node.style.getPropertyValue('--pf-ribbon-x'))/100})).filter(item=>Number.isFinite(item.x)&&item.x>progress+.001).sort((a,b)=>a.x-b.x),next=creases[0];
  if(!next)return'Workday in progress · missed moment moved to Worklog';
  const value=prefs(),match=String(value.workHours||'08:30-16:30').match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/),start=match?Number(match[1])+Number(match[2])/60:8.5,end=match?Number(match[3])+Number(match[4])/60:16.5,hour=start+(end-start)*next.x,at=new Date(now);at.setHours(Math.floor(hour),Math.round((hour%1)*60),0,0);
  const label=text(next.node.getAttribute('aria-label')||next.node.title)||'Scheduled moment',remaining=Math.max(0,at-now);
  return`Next · ${at.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})} · ${formatDuration(remaining)} · ${label}`;
}

function renderNotes(){
  const list=$('.pf25Spatial-note-list');if(!list)return;const values=visibleNotes().filter(note=>!selectedNoteDate||noteDate(note)===selectedNoteDate).slice(0,8),heading=$('.pf25Spatial-notes-recent>header');if(heading)heading.textContent=selectedNoteDate?`Notes · ${new Date(`${selectedNoteDate}T12:00:00`).toLocaleDateString([],{month:'short',day:'numeric'})}`:'Recent notes';list.replaceChildren();
  if(!values.length){list.append(create('div','pf25Spatial-empty','No notes yet. Capture only what is worth remembering.'));return}
  for(const note of values){const article=create('article','pf25Spatial-note-row'),meta=create('span','pf25Spatial-note-meta');meta.append(create('time','',formatTime(note.updatedAt||note.createdAt)),create('small','',note.category||'Note'));article.append(meta,create('p','',note.body));list.append(article)}
}

function renderWorklog(){
  const stream=$('.pf25Spatial-log-stream'),summary=$('.pf25Spatial-log-summary');if(!stream||!summary)return;
  const api=window.__PACEFOLD_DAYFLOW__,metrics=api?.metrics?.()||{events:[],desk:0,field:0,focus:0,away:0,meal:0,elapsed:0};const events=(metrics.events||[]).slice().reverse().slice(0,12);
  stream.replaceChildren(create('header','pf25Spatial-section-title','Today'));
  if(!events.length)stream.append(create('div','pf25Spatial-empty','Your day will appear here as Pacefold observes transitions.'));
  for(const event of events){const row=create('article','pf25Spatial-log-row');row.dataset.type=event.type;const rail=create('span','pf25Spatial-log-rail');const copy=create('div','');copy.append(create('strong','',event.label||event.type),create('small','',[event.detail,event.end&&event.end!==event.start?formatDuration((event.end||Date.now())-event.start):event.end?'Moment':'In progress'].filter(Boolean).join(' · ')));row.append(create('time','',formatTime(event.start)),rail,copy);stream.append(row)}
  summary.replaceChildren(create('span','pf25Spatial-eyebrow','Today at a glance'));
  for(const [label,value,type] of [['Desk',metrics.desk,'desk'],['Field',metrics.field,'field'],['Focus',metrics.focus,'focus'],['Away',metrics.away+metrics.meal,'away']]){const row=create('div','pf25Spatial-metric');row.dataset.type=type;row.append(create('span','',label),create('strong','',formatDuration(value)));summary.append(row)}
  const activeFocus=(metrics.events||[]).some(event=>event.type==='focus'&&!event.end);const focus=id('pf25Spatial-worklog-focus');if(focus){focus.textContent=activeFocus?'End focus':'Start focus';focus.dataset.active=String(activeFocus)}
}

function renderContext(){
  const main=$('.pf25Spatial-weather-main'),days=$('.pf25Spatial-weather-days'),status=$('.pf25Spatial-now-status'),cards=$('.pf25Spatial-now-cards');if(!main||!days||!status||!cards)return;
  main.replaceChildren(create('strong','',nodeText('.pf-v25-activity-weather-temp','—')),create('span','',nodeText('.pf-v25-activity-weather-copy>strong','Weather is available when connected')),create('small','',nodeText('.pf-v25-activity-weather-place','Toronto')));
  days.replaceChildren();for(const day of [...document.querySelectorAll('.pf-v25-activity-weather-day')].slice(0,3)){const item=create('article','');item.textContent=text(day.textContent);days.append(item)}
  status.replaceChildren(create('strong','',nodeText('#statusLine','Workday in progress')),create('small','',nodeText('.pf25Flow-dayline-detail','Pacefold is keeping the day quiet.')));
  const metrics=window.__PACEFOLD_DAYFLOW__?.metrics?.()||{};cards.replaceChildren();for(const [label,value] of [['Logged',formatDuration(metrics.elapsed||0)],['Focus',formatDuration(metrics.focus||0)],['Notes',String(metrics.notes||0)]]){const item=create('article','');item.append(create('span','',label),create('strong','',value));cards.append(item)}
}

function renderSettings(){
  const p=prefs(),weather=window.__PACEFOLD_PERSISTENCE__?.read?.()||{};
  const values={quiet:Boolean(window.__PACEFOLD_QUIET__?.get?.()||p.quietMode),weather:weather.v21WeatherEnabled!==false,seconds:p.showSeconds!==false,notifications:p.notifications!==false};
  for(const toggle of document.querySelectorAll('.pf25Spatial-switch')){const on=Boolean(values[toggle.dataset.setting]);toggle.dataset.active=String(on);toggle.textContent=on?'On':'Off'}
  const track=id('pf25Spatial-track');if(track)track.textContent=nodeText('.pf-v25-activity-workbench-track','Nothing playing');
}

function queueRefresh(){if(refreshFrame)return;refreshFrame=requestAnimationFrame(()=>{refreshFrame=0;refresh()})}

function awaitSetupCompletion(){
  const onboarding=id('onboarding'),requested=new URLSearchParams(location.search).has('setup');if(!onboarding)return;
  let seenVisible=!onboarding.hidden;
  const attempt=()=>{
    if(!onboarding.hidden){seenVisible=true;return}
    const complete=localStorage.getItem(ONBOARDED)==='1'||localStorage.getItem(DISMISSED)==='1';if(!complete||requested&&!seenVisible)return;
    if(requested){const url=new URL(location.href);url.searchParams.delete('setup');history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`)}
    setupObserver?.disconnect();setupObserver=null;mount();activateRuntime();
  };
  setupObserver=new MutationObserver(attempt);setupObserver.observe(onboarding,{attributes:true,attributeFilter:['hidden','aria-hidden','class']});window.addEventListener('pacefold:prefs',attempt);setTimeout(attempt,700);
}

function activateRuntime(){
  const root=id('pf25Spatial-spatial-root');if(!root||root.dataset.runtimeActive==='true')return;root.dataset.runtimeActive='true';
  observer=new MutationObserver(queueRefresh);for(const node of ['#statusLine','#progressFill','#waterBtn','#noodleBtn','#awayBtn','#lunchBtn','#eyesBtn','#careBtn','.pf-v25-activity-weather'].map($).filter(Boolean))observer.observe(node,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','data-state','data-active','aria-selected','style']});
  for(const event of ['pacefold:dayflow','pacefold:storage-changed','pacefold:prefs','pacefold:quiet'])window.addEventListener(event,()=>refresh(true));
  window.addEventListener('storage',()=>refresh(true));
  const tick=()=>{refresh();tickTimer=setTimeout(tick,Math.max(100,1010-Date.now()%1000))};tick();
}

function initialize(){
  mount();
  if(!id('pf25Spatial-spatial-root')){awaitSetupCompletion();return}
  activateRuntime();
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',initialize,{once:true}):initialize();
})();

(()=>{
'use strict';
const RELEASE='25.0.0';
const PREFS_KEY='pacefoldPrefsV15';
const NOTES_KEY='pacefold.notebook.entries.v2';
const BACKUP_KEY='pacefold.spatial.notifications.v1';
let originalParent=null,originalNext=null,soundNode=null,syncTimer=0,bridgeInstalled=false,soundObserver=null,noteInsightKey='',calendarCursor=new Date(),calendarSelected='';
const $=selector=>document.querySelector(selector);
const id=value=>document.getElementById(value);
const create=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=String(text);return node};
const button=(className,label,text)=>{const node=create('button',className,text);node.type='button';node.setAttribute('aria-label',label);return node};
const parse=(value,fallback)=>{try{return value?JSON.parse(value):fallback}catch{return fallback}};
const rawPrefs=()=>{const value=parse(localStorage.getItem(PREFS_KEY),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}};
const core=()=>window.__PACEFOLD_RUNTIME_CORE__;
const permission=()=>typeof Notification==='undefined'?'unsupported':Notification.permission;
const activeRelease=()=>window.__PACEFOLD_ACTIVE_RELEASE__||RELEASE;
const report=(scope,error)=>{try{window.__PACEFOLD_DIAGNOSTICS__?.recordError?.(`spatial-${scope}`,error)}catch{}};
const localDay=value=>{const date=value instanceof Date?value:new Date(value);if(Number.isNaN(date.getTime()))return'';return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,10)};

if(new URLSearchParams(location.search).has('legacyAudit')){
  window.__PACEFOLD_HARDENING__={release:RELEASE,legacy:true};
  return;
}

function installPreferenceBridge(){
  const api=core();
  if(!api||bridgeInstalled||api.__pacefoldSpatialPreferenceBridge)return Boolean(api);
  const nativeGet=typeof api.getPrefs==='function'?api.getPrefs.bind(api):rawPrefs;
  const nativeUpdate=typeof api.updatePrefs==='function'?api.updatePrefs.bind(api):patch=>({...rawPrefs(),...patch});
  api.getPrefs=()=>({...nativeGet(),...rawPrefs()});
  api.updatePrefs=patch=>{
    const safe=patch&&typeof patch==='object'&&!Array.isArray(patch)?patch:{};
    const result=nativeUpdate(safe)||{};
    const next={...rawPrefs(),...result,...safe};
    try{localStorage.setItem(PREFS_KEY,JSON.stringify(next))}catch(error){report('preferences-write',error)}
    return next;
  };
  Object.defineProperty(api,'__pacefoldSpatialPreferenceBridge',{value:true});
  bridgeInstalled=true;
  return true;
}
function prefs(){installPreferenceBridge();try{return core()?.getPrefs?.()||rawPrefs()}catch{return rawPrefs()}}
function writePrefs(patch,source='settings'){
  installPreferenceBridge();
  let next;
  try{
    const api=core();
    next=api?.updatePrefs?api.updatePrefs(patch):{...rawPrefs(),...patch};
    localStorage.setItem(PREFS_KEY,JSON.stringify({...rawPrefs(),...next,...patch}));
    window.dispatchEvent(new CustomEvent('pacefold:prefs',{detail:{source:`spatial-${source}`}}));
    window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:PREFS_KEY,source:`spatial-${source}`}}));
  }catch(error){report('preferences',error);showStatus('Could not save that setting',true);return rawPrefs()}
  sync();return next;
}

function notificationEnabled(value=prefs()){
  return value.notifications!==false&&(value.notificationMode||'quiet')!=='off'&&(value.browserNotif===true||value.taskbarBadge!==false||value.notifications===true);
}
function saveNotificationBackup(value){try{localStorage.setItem(BACKUP_KEY,JSON.stringify({notificationMode:value.notificationMode&&value.notificationMode!=='off'?value.notificationMode:'quiet',taskbarBadge:value.taskbarBadge!==false,browserNotif:value.browserNotif===true}))}catch{}}
function notificationBackup(){const value=parse(localStorage.getItem(BACKUP_KEY),null);return value&&typeof value==='object'?value:{notificationMode:'quiet',taskbarBadge:true,browserNotif:false}}
function setNotifications(enabled){
  const current=prefs();
  if(!enabled){
    saveNotificationBackup(current);
    writePrefs({notifications:false,browserNotif:false,notificationMode:'off',taskbarBadge:false,taskbarBadgeMode:'off'},'notifications');
    window.__PACEFOLD_CUES__?.clear?.();
    try{navigator.clearAppBadge?.()}catch{}
  }else{
    const backup=notificationBackup();
    writePrefs({notifications:true,notificationMode:backup.notificationMode||'quiet',taskbarBadge:backup.taskbarBadge!==false,taskbarBadgeMode:backup.taskbarBadge===false?'off':'due',browserNotif:backup.browserNotif===true&&permission()==='granted'},'notifications');
  }
  showStatus(enabled?'Notifications restored':'All notifications and badges are off');return true;
}
function toggleNotifications(){return setNotifications(!notificationEnabled())}

function heading(title,detail){const head=create('header','pf25Spatial-settings-panel-head');head.append(create('span','pf25Spatial-eyebrow',title),create('p','',detail));return head}
function controlRow(key,label,detail){const row=create('div','pf25Spatial-control-row');row.dataset.control=key;const copy=create('div','pf25Spatial-control-copy');copy.append(create('strong','',label),create('small','',detail));const toggle=button('pf25Spatial-control-toggle',`Toggle ${label}`,'');toggle.dataset.setting=key;row.append(copy,toggle);return row}
function actionButton(action,label,detail){const control=button('pf25Spatial-settings-action',label,'');control.dataset.action=action;const copy=create('span','');copy.append(create('strong','',label),create('small','',detail));control.append(copy,create('b','','›'));return control}
function buildSettings(){
  const layout=$('.pf25Spatial-settings-layout');if(!layout||layout.dataset.hardened===RELEASE)return Boolean(layout);
  layout.dataset.hardened=RELEASE;layout.replaceChildren();
  const rhythm=create('section','pf25Spatial-settings-panel pf25Spatial-settings-rhythm');
  rhythm.append(heading('Workday rhythm','Control the reminders that shape the day without opening the full setup.'));
  rhythm.append(controlRow('workReminders','Workday reminders','Prayer, meal, preparation and away cues'),controlRow('gazeEnabled','Eye breaks','Short distance-change prompts during desk work'),controlRow('bodyEnabled','Movement breaks','Gentle posture and movement prompts'),controlRow('weather','Weather','Show saved-location conditions on the Clock and Now faces'));
  const display=create('section','pf25Spatial-settings-panel pf25Spatial-settings-display');
  display.append(heading('Display & privacy','The controls you are most likely to change during the day.'));
  display.append(controlRow('quiet','Quiet mode','Hide labels, secondary faces and attention markers'),controlRow('seconds','Clock seconds','Keep the live seconds beside the main time'),controlRow('notifications','Notifications','System cues, taskbar dots and app badges together'),controlRow('timeFormat','Time format','Switch between a 12-hour and 24-hour clock'));
  const tools=create('section','pf25Spatial-settings-panel pf25Spatial-settings-tools');
  tools.append(heading('Data, schedule & sound','Backup and deeper configuration stay reachable without crowding the Clock.'));
  const actions=create('div','pf25Spatial-settings-actions');
  actions.append(actionButton('profile','Profile & routines','Everyday, faith-aware or custom moments and preparation'),actionButton('schedule','Schedule & day types','Weekday hours, Desk, Field, Half day and Off'),actionButton('backup','Backup notes','Choose or reconnect the protected local backup file'),actionButton('sound','Sound library','Local audio, playlists and the full player'));
  const status=create('div','pf25Spatial-settings-status','Saved automatically on this device');status.id='pf25Spatial-settings-status';
  tools.append(actions,status,create('small','pf25Spatial-version',`Pacefold ${activeRelease()} · private local engine`));
  layout.append(rhythm,display,tools);return true;
}

function noteDate(note){
  for(const value of [note?.date,note?.createdAt,note?.updatedAt,note?.timestamp,note?.at]){
    if(value==null||value==='')continue;
    if(typeof value==='string'){const direct=value.match(/\b(20\d{2}-\d{2}-\d{2})\b/);if(direct)return direct[1]}
    const day=localDay(typeof value==='number'&&value<1e12?value*1000:value);if(day)return day;
  }
  return'';
}
function buildNoteInsights(force=false){
  const recent=$('.pf25Spatial-notes-recent');if(!recent)return false;
  let root=recent.querySelector('.pf25Spatial-note-insights');if(!root){root=create('section','pf25Spatial-note-insights');recent.append(root)}
  const raw=localStorage.getItem(NOTES_KEY)||'[]',notes=parse(raw,[]),values=Array.isArray(notes)?notes:[],now=new Date(),year=calendarCursor.getFullYear(),month=calendarCursor.getMonth(),prefix=`${year}-${String(month+1).padStart(2,'0')}-`,counts=new Map();
  calendarSelected=window.__PACEFOLD_SPATIAL__?.noteDate?.()||calendarSelected;
  const renderKey=`${year}-${month}:${calendarSelected}:${raw}`;if(!force&&renderKey===noteInsightKey)return true;noteInsightKey=renderKey;
  for(const note of values){const day=noteDate(note);if(day?.startsWith(prefix))counts.set(day,(counts.get(day)||0)+1)}
  const total=[...counts.values()].reduce((sum,value)=>sum+value,0),active=counts.size;
  root.replaceChildren();
  const head=create('header','pf25Spatial-note-insights-head'),copy=create('div','');copy.append(create('span','pf25Spatial-eyebrow','Notebook activity'),create('strong','',calendarCursor.toLocaleDateString([],{month:'long',year:'numeric'})));
  const controls=create('div','pf25Spatial-note-calendar-controls'),previous=button('','Previous month','‹'),todayButton=button('','Show current month','Today'),next=button('','Next month','›');
  previous.addEventListener('click',()=>{calendarCursor=new Date(year,month-1,1);noteInsightKey='';buildNoteInsights()});todayButton.addEventListener('click',()=>{calendarCursor=new Date();calendarSelected='';window.__PACEFOLD_SPATIAL__?.setNoteDate?.('');noteInsightKey='';buildNoteInsights()});next.addEventListener('click',()=>{calendarCursor=new Date(year,month+1,1);noteInsightKey='';buildNoteInsights()});controls.append(previous,todayButton,next);
  const stats=create('span','pf25Spatial-note-stats',total?`${total} note${total===1?'':'s'} · ${active} day${active===1?'':'s'}`:'No notes this month');head.append(copy,stats,controls);
  const weekdays=create('div','pf25Spatial-note-weekdays');for(const label of ['S','M','T','W','T','F','S'])weekdays.append(create('span','',label));
  const grid=create('div','pf25Spatial-note-calendar'),first=new Date(year,month,1).getDay(),days=new Date(year,month+1,0).getDate(),today=localDay(now);
  for(let index=0;index<first;index++)grid.append(create('span','pf25Spatial-note-day pf25Spatial-note-day-empty',''));
  for(let day=1;day<=days;day++){
    const key=`${prefix}${String(day).padStart(2,'0')}`,count=counts.get(key)||0,item=button('pf25Spatial-note-day',`Show notes for ${new Date(year,month,day).toLocaleDateString()}`,String(day));item.dataset.count=String(count);item.dataset.today=String(key===today);item.dataset.selected=String(key===calendarSelected);item.addEventListener('click',()=>{calendarSelected=calendarSelected===key?'':key;window.__PACEFOLD_SPATIAL__?.setNoteDate?.(calendarSelected);noteInsightKey='';buildNoteInsights()});
    if(count){item.append(create('b','',String(count)));item.title=`${count} note${count===1?'':'s'} on ${new Date(year,month,day).toLocaleDateString()}`}
    grid.append(item);
  }
  root.append(head,weekdays,grid);return true;
}

function showStatus(message,error=false){const node=id('pf25Spatial-settings-status');if(!node)return;node.textContent=message;node.dataset.error=String(error);clearTimeout(node.__pacefoldTimer);node.__pacefoldTimer=setTimeout(()=>{if(node){node.textContent='Saved automatically on this device';delete node.dataset.error}},2200)}
function toggleControl(key){
  try{
    const current=prefs();
    if(key==='quiet'){window.__PACEFOLD_QUIET__?.toggle?.();setTimeout(()=>{sync();if(window.__PACEFOLD_QUIET__?.get?.())window.__PACEFOLD_SPATIAL__?.home?.()},0);return}
    if(key==='weather'){const state=window.__PACEFOLD_PERSISTENCE__?.read?.()||{},next=state.v21WeatherEnabled===false;window.__PACEFOLD_PERSISTENCE__?.write?.({...state,v21WeatherEnabled:next});writePrefs({v21WeatherEnabled:next},'weather');showStatus(next?'Weather restored':'Weather hidden');return}
    if(key==='notifications'){toggleNotifications();return}
    if(key==='seconds'){writePrefs({showSeconds:current.showSeconds===false},'seconds');return}
    if(key==='timeFormat'){writePrefs({timeFormat:current.timeFormat==='24'?'12':'24'},'time-format');return}
    if(['workReminders','gazeEnabled','bodyEnabled'].includes(key)){writePrefs({[key]:current[key]===false},key);return}
  }catch(error){report(`toggle-${key}`,error);showStatus('That control could not be changed',true)}
}
function proxyClick(selectors){for(const selector of selectors){const node=$(selector);if(node){node.click();return true}}return false}
function openAdvancedSettings(section='rhythm',headingText=''){
  const opened=proxyClick(['#brandButton','.corner']);if(!opened){showStatus('Full settings are unavailable in this window',true);return false}
  document.documentElement.classList.add('pf25Spatial-legacy-dialog-open');
  requestAnimationFrame(()=>{
    const panel=id('panel'),tab=panel?.querySelector(`[data-settings-view="${section}"]`);tab?.click();
    const target=[...(panel?.querySelectorAll('.section-title')||[])].find(node=>node.textContent.trim().toLowerCase().includes(headingText.toLowerCase()));target?.scrollIntoView?.({block:'start'});
  });
  return true;
}
function openProfile(){return openAdvancedSettings('rhythm','Rhythm profile')}
function openSchedule(){return openAdvancedSettings('rhythm','Workday rhythm')}
function openBackup(){if(!proxyClick(['.pf-v25-folio-backup','[data-action="backup"]']))showStatus('Backup control is unavailable in this browser',true)}

function overlay(){
  let root=id('pf25Spatial-sound-overlay');if(root)return root;
  root=create('section','pf25Spatial-sound-overlay');root.id='pf25Spatial-sound-overlay';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Pacefold sound controls');
  const dialog=create('div','pf25Spatial-sound-dialog'),head=create('header','pf25Spatial-sound-dialog-head'),copy=create('div','');copy.append(create('span','pf25Spatial-eyebrow','Sound'),create('h2','','Local sound controls'),create('p','','Your library stays inside Pacefold and on this device.'));
  const close=button('pf25Spatial-sound-close','Close sound controls','Close'),mount=create('div','pf25Spatial-sound-mount');mount.id='pf25Spatial-sound-mount';close.addEventListener('click',closeSound);head.append(copy,close);dialog.append(head,mount);root.append(dialog);root.addEventListener('click',event=>{if(event.target===root)closeSound()});id('pf25Spatial-spatial-root')?.append(root);return root;
}
function findSoundNode(){return id('pf-local-player')}
function claimSoundOwnership(){
  const panel=id('pf25Spatial-sound-overlay'),mount=id('pf25Spatial-sound-mount');if(!panel||panel.hidden||!mount)return false;
  soundNode=findSoundNode()||soundNode;if(!soundNode)return false;
  if(!originalParent){originalParent=soundNode.parentNode;originalNext=soundNode.nextSibling}
  if(soundNode.parentNode!==mount)mount.append(soundNode);
  soundNode.hidden=false;soundNode.inert=false;soundNode.removeAttribute('aria-hidden');soundNode.classList.add('is-open');
  const drawer=soundNode.querySelector('[data-pf-player-drawer],.pf-player-drawer');if(drawer){drawer.hidden=false;drawer.inert=false;drawer.removeAttribute('aria-hidden')}
  const menu=soundNode.querySelector('[data-pf-player-menu]');if(menu){menu.setAttribute('aria-expanded','true');menu.setAttribute('aria-label','Close sound library')}
  return soundNode.parentNode===mount;
}
function observeSoundOwnership(){soundObserver?.disconnect();soundObserver=new MutationObserver(()=>queueMicrotask(claimSoundOwnership));soundObserver.observe(document.body,{subtree:true,childList:true})}
function openSound(){
  const panel=overlay();soundNode=findSoundNode();if(!soundNode){window.__PACEFOLD_ACTIVITY__?.reconcile?.();setTimeout(()=>{if(!openSound())showStatus('Sound controls are still loading',true)},100);return false}
  if(!originalParent){originalParent=soundNode.parentNode;originalNext=soundNode.nextSibling}
  panel.hidden=false;panel.dataset.open='true';document.documentElement.classList.add('pf25Spatial-sound-open');
  window.__PACEFOLD_ACTIVITY__?.showSound?.();window.__PACEFOLD_WORKSPACE__?.player?.open?.();
  claimSoundOwnership();observeSoundOwnership();requestAnimationFrame(()=>{claimSoundOwnership();panel.querySelector('.pf25Spatial-sound-close')?.focus({preventScroll:true})});setTimeout(claimSoundOwnership,80);setTimeout(claimSoundOwnership,220);return true;
}
function restoreSoundNode(){
  soundObserver?.disconnect();soundObserver=null;if(!soundNode||!originalParent)return;
  if(originalNext&&originalNext.parentNode===originalParent)originalParent.insertBefore(soundNode,originalNext);else originalParent.append(soundNode);
  window.__PACEFOLD_WORKSPACE__?.player?.close?.();window.__PACEFOLD_ACTIVITY__?.showNotes?.();originalParent=null;originalNext=null;soundNode=null;
}
function closeSound(){const panel=id('pf25Spatial-sound-overlay');if(panel){panel.hidden=true;delete panel.dataset.open}document.documentElement.classList.remove('pf25Spatial-sound-open');restoreSoundNode();$('.pf25Spatial-settings-action[data-action="sound"]')?.focus?.({preventScroll:true})}

function sync(){
  installPreferenceBridge();buildSettings();buildNoteInsights();
  const root=id('pf25Spatial-spatial-root');if(!root)return;
  const release=activeRelease();document.documentElement.dataset.pacefoldExperience=release;document.body.dataset.pacefoldExperience=release;root.dataset.hardening=release;
  const p=prefs(),weather=window.__PACEFOLD_PERSISTENCE__?.read?.()||{},values={quiet:Boolean(window.__PACEFOLD_QUIET__?.get?.()||p.quietMode),seconds:p.showSeconds!==false,notifications:notificationEnabled(p),timeFormat:p.timeFormat==='24',workReminders:p.workReminders!==false,gazeEnabled:p.gazeEnabled!==false,bodyEnabled:p.bodyEnabled!==false,weather:weather.v21WeatherEnabled!==false&&p.v21WeatherEnabled!==false};
  for(const seconds of document.querySelectorAll('.pf25Spatial-seconds,.pf25Actions-seconds-dial')){seconds.hidden=!values.seconds;seconds.setAttribute('aria-hidden',String(!values.seconds))}
  for(const control of document.querySelectorAll('.pf25Spatial-control-toggle')){const key=control.dataset.setting,on=Boolean(values[key]);control.dataset.active=String(on);control.textContent=key==='timeFormat'?(on?'24h':'12h'):(on?'On':'Off');control.setAttribute('aria-pressed',String(on))}
  const version=$('.pf25Spatial-version');if(version)version.textContent=`Pacefold ${release} · private local engine`;
  if(window.__PACEFOLD_SPATIAL__)window.__PACEFOLD_SPATIAL__.release=release;
  if(window.__PACEFOLD_VERSION__)window.__PACEFOLD_VERSION__={...window.__PACEFOLD_VERSION__,experience:release,update:release,hardening:'recovery-r5'};
  if(values.quiet)closeSound();else claimSoundOwnership();
}
function capture(event){
  const target=event.target instanceof Element?event.target:null;if(!target)return;
  const control=target.closest('.pf25Spatial-control-toggle,.pf25Spatial-switch');if(control){event.preventDefault();event.stopImmediatePropagation();toggleControl(control.dataset.setting);return}
  const action=target.closest('.pf25Spatial-settings-action');if(action){event.preventDefault();event.stopImmediatePropagation();if(action.dataset.action==='profile')openProfile();if(action.dataset.action==='schedule')openSchedule();if(action.dataset.action==='backup')openBackup();if(action.dataset.action==='sound')openSound()}
}
function initialize(){
  installPreferenceBridge();document.addEventListener('click',capture,true);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!id('pf25Spatial-sound-overlay')?.hidden){event.preventDefault();event.stopImmediatePropagation();closeSound()}},true);
  for(const name of ['pacefold:prefs','pacefold:spatial-ready','pacefold:storage-changed','pacefold:spatial-hardening','pacefold:quiet'])window.addEventListener(name,sync);
  window.addEventListener('storage',sync);sync();syncTimer=setInterval(sync,5000);window.__PACEFOLD_HARDENING__={release:activeRelease(),sync,setNotifications,toggleNotifications,notificationEnabled,openSound,closeSound,writePrefs,buildSettings,buildNoteInsights,claimSoundOwnership};
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',initialize,{once:true}):initialize();
})();

(()=>{
'use strict';

const RELEASE='25.0.0';
const REVISION='cue-queue-r1';
const STORAGE_KEY='pacefold.daylight.cues.v1';
const PREFS_KEY='pacefoldPrefsV15';
const SOURCES=['prayer','water','lunch','noodle','away','eyes','body','flow','diagnostic'];
const SOURCE_ALIASES={meal:'lunch',prep:'noodle',timer:'noodle',gaze:'eyes',movement:'body',move:'body'};
const ACTION_IDS={
  water:'water',waterBtn:'water',waterPill:'water',
  noodle:'noodle',noodleBtn:'noodle',noodlePill:'noodle',timerBtn:'noodle',
  lunch:'lunch',lunchBtn:'lunch',lunchPill:'lunch',mealBtn:'lunch',
  away:'away',awayBtn:'away',awayPill:'away',
  gaze:'eyes',gazeBtn:'eyes',eyesBtn:'eyes',
  body:'body',bodyBtn:'body',moveBtn:'body',
  prayer:'prayer',prayerBtn:'prayer',prayerBreakBtn:'prayer'
};

let deliveryOriginal=null;
let deliveryWrapper=null;
let deliveryTimer=0;
let expiryTimer=0;
let lastState='';

const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
const normalizeSource=value=>{
  const raw=String(value||'diagnostic').toLowerCase();
  const source=SOURCE_ALIASES[raw]||raw;
  return SOURCES.includes(source)?source:'diagnostic';
};
const prefs=()=>object(parse(localStorage.getItem(PREFS_KEY),{}))||{};
const now=()=>Date.now();

function read(){
  const value=parse(localStorage.getItem(STORAGE_KEY),[]);
  return Array.isArray(value)?value.filter(object):[];
}
function sanitize(items=read()){
  const instant=now(),seen=new Set(),next=[];
  for(const item of items.slice(-80)){
    const key=String(item.key||'').slice(0,160),source=normalizeSource(item.source),deliveredAt=Number(item.deliveredAt)||instant,expiresAt=Number(item.expiresAt)||deliveredAt+30*60000;
    if(!key||expiresAt<=instant||seen.has(key))continue;
    seen.add(key);next.push({key,source,deliveredAt,expiresAt});
  }
  return next.slice(-24);
}
function write(items){
  const next=sanitize(items);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{}
  return next;
}
function live(){return write(read())}
function sources(){return [...new Set(live().map(item=>item.source))]}
function count(){return sources().length}
function ttl(){return Math.max(5,Number(prefs().dueWindow)||18)*60000}

function stateRoot(){
  let root=document.getElementById('pf25Spatial-cue-source-state');
  if(root)return root;
  root=document.createElement('div');root.id='pf25Spatial-cue-source-state';root.hidden=true;root.setAttribute('aria-hidden','true');document.body?.append(root);return root;
}
function materialize(items=live()){
  const root=stateRoot();if(!root)return;
  root.replaceChildren();
  for(const source of [...new Set(items.map(item=>item.source))]){
    const marker=document.createElement('i');marker.dataset.source=source;marker.className='due';root.append(marker);
  }
}
function nativeBadge(items=live()){
  const value=prefs(),enabled=value.notifications!==false&&value.taskbarBadge!==false&&(value.taskbarBadgeMode||'due')!=='off';
  const total=[...new Set(items.map(item=>item.source))].length;
  const scheduler=window.__PACEFOLD_SCHEDULER__;
  try{
    if(!enabled||!total){void scheduler?._nativeClearBadge?.();return}
    void scheduler?._nativeSetBadge?.(total>1?total:undefined);
  }catch{}
}
function publish(force=false){
  const items=live(),key=JSON.stringify(items.map(item=>[item.key,item.source,item.expiresAt]));
  materialize(items);nativeBadge(items);
  if(force||key!==lastState){
    lastState=key;
    window.dispatchEvent(new CustomEvent('pacefold:cue-queue',{detail:{count:count(),sources:sources(),release:RELEASE}}));
  }
  return items;
}
function add(key,source,expiresIn=ttl()){
  const safeKey=String(key||`${source}-${now()}`).slice(0,160),safeSource=normalizeSource(source),instant=now(),items=live().filter(item=>item.key!==safeKey);
  items.push({key:safeKey,source:safeSource,deliveredAt:instant,expiresAt:instant+Math.max(60000,Number(expiresIn)||ttl())});
  write(items);publish(true);return true;
}
function acknowledge(value){
  const raw=String(value||'').toLowerCase(),source=normalizeSource(raw),before=live(),after=before.filter(item=>item.key!==value&&item.source!==source);
  if(after.length===before.length)return false;
  write(after);publish(true);return true;
}
function clear(){write([]);publish(true);return true}

function wrapDelivery(){
  const current=window.__PACEFOLD_DELIVERY__;
  if(typeof current!=='function')return false;
  if(current===deliveryWrapper||current.__pacefoldCueQueue)return true;
  deliveryOriginal=current;
  deliveryWrapper=async function(key,message,source,...rest){
    const result=await deliveryOriginal.call(this,key,message,source,...rest);
    if(result)add(key,source);
    return result;
  };
  Object.defineProperty(deliveryWrapper,'__pacefoldCueQueue',{value:true});
  window.__PACEFOLD_DELIVERY__=deliveryWrapper;
  return true;
}
function inferSource(target){
  const element=target instanceof Element?target.closest('[data-source],[data-action],button,[role="button"]'):null;
  if(!element)return'';
  const data=element.dataset.source||element.dataset.action||'';
  if(data)return normalizeSource(data);
  const identity=element.id||'';
  if(ACTION_IDS[identity])return ACTION_IDS[identity];
  const lower=`${identity} ${element.className||''} ${element.getAttribute('aria-label')||''}`.toLowerCase();
  for(const [token,source] of Object.entries({water:'water',sip:'water',prayer:'prayer',salah:'prayer',noodle:'noodle',timer:'noodle',meal:'lunch',lunch:'lunch',away:'away',eye:'eyes',gaze:'eyes',move:'body',body:'body'}))if(lower.includes(token))return source;
  return'';
}
function onClick(event){const source=inferSource(event.target);if(source)acknowledge(source)}
function onStorage(event){if(!event||[STORAGE_KEY,PREFS_KEY].includes(event.key))publish(true)}
function initialize(){
  publish(true);
  document.addEventListener('click',onClick,true);
  window.addEventListener('storage',onStorage);
  window.addEventListener('pacefold:prefs',()=>publish(false));
  clearInterval(deliveryTimer);deliveryTimer=setInterval(wrapDelivery,2000);wrapDelivery();
  clearInterval(expiryTimer);expiryTimer=setInterval(()=>publish(false),15000);
  window.__PACEFOLD_CUES__={release:RELEASE,revision:REVISION,live,sources,count,add,acknowledge,clear,refresh:()=>publish(true)};
  window.dispatchEvent(new CustomEvent('pacefold:cues-ready',{detail:{release:RELEASE,revision:REVISION}}));
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',initialize,{once:true}):initialize();
})();

(()=>{
'use strict';

const RELEASE='25.0.0';
const REVISION='day-unfold-r1';
const PREFS_KEY='pacefoldPrefsV15';
const SVG_NS='http://www.w3.org/2000/svg';
const SOURCE_ORDER=['prayer','water','lunch','noodle','away','eyes','body','flow','diagnostic'];
const SOURCE_META={
  prayer:{label:'Prayer',color:'#4f8a6c'},
  water:{label:'Water',color:'#5f97bd'},
  lunch:{label:'Meal',color:'#7d879f'},
  noodle:{label:'Preparation',color:'#bd8452'},
  away:{label:'Away',color:'#5f968e'},
  eyes:{label:'Eye break',color:'#8876ae'},
  body:{label:'Movement',color:'#748f79'},
  flow:{label:'Worklog',color:'#b86659'},
  diagnostic:{label:'Pacefold',color:'#b86659'}
};
const PHASES={
  rest:{caption:'Before the workday',bg:'#edf1ed',glow:'rgba(255,255,255,.92)',horizon:'rgba(225,235,227,.54)',sun:'#d8b37a'},
  opening:{caption:'The day is opening',bg:'#eef2ed',glow:'rgba(255,244,219,.76)',horizon:'rgba(236,210,166,.35)',sun:'#e2a55b'},
  morning:{caption:'Morning in motion',bg:'#edf2ee',glow:'rgba(255,251,232,.82)',horizon:'rgba(220,235,226,.46)',sun:'#e5b45f'},
  noon:{caption:'The day is fully open',bg:'#edf2ef',glow:'rgba(255,255,244,.9)',horizon:'rgba(211,232,223,.5)',sun:'#edc86b'},
  afternoon:{caption:'The day is folding forward',bg:'#eef1ed',glow:'rgba(255,241,221,.7)',horizon:'rgba(232,210,180,.34)',sun:'#dda15f'},
  complete:{caption:'The workday is complete',bg:'#ecefeb',glow:'rgba(239,246,241,.72)',horizon:'rgba(206,221,213,.38)',sun:'#bf8a62'},
  off:{caption:'A quieter day',bg:'#edf0ed',glow:'rgba(255,255,255,.72)',horizon:'rgba(218,228,222,.35)',sun:'#aebbb3'}
};

let timer=0;
let observer=null;
let ribbonObserver=null;
let lastMarkerKey='';
let lastSessionKey='';
let lastCueKey='';
let baseFavicon='';
let faviconLink=null;

const $=selector=>document.querySelector(selector);
const id=value=>document.getElementById(value);
const create=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content!=null)node.textContent=String(content);return node};
const svg=(tag,className)=>{const node=document.createElementNS(SVG_NS,tag);if(className)node.setAttribute('class',className);return node};
const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,Number(value)||0));
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const localKey=(value=new Date())=>{const date=value instanceof Date?value:new Date(value);return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,10)};

function prefs(){
  try{return window.__PACEFOLD_RUNTIME_CORE__?.getPrefs?.()||parse(localStorage.getItem(PREFS_KEY),{})||{}}catch{return{}}
}
function writePrefs(patch){
  const current=prefs(),next={...current,...patch};
  try{
    if(window.__PACEFOLD_RUNTIME_CORE__?.updatePrefs)window.__PACEFOLD_RUNTIME_CORE__.updatePrefs(patch);
    else localStorage.setItem(PREFS_KEY,JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('pacefold:prefs',{detail:{source:'daylight'}}));
    window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:PREFS_KEY,source:'daylight'}}));
  }catch{}
  return next;
}
function parseRange(value='08:30-16:30'){
  const match=String(value).match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if(!match)return{start:8.5,end:16.5,startText:'08:30',endText:'16:30'};
  return{start:Number(match[1])+Number(match[2])/60,end:Number(match[3])+Number(match[4])/60,startText:`${match[1]}:${match[2]}`,endText:`${match[3]}:${match[4]}`};
}
function safeTime(value,fallback){return/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value||''))?String(value):fallback}
function resolvedDay(date=new Date(),value=prefs()){
  const fallback=parseRange(value.workHours),week=value.workWeek&&typeof value.workWeek==='object'?value.workWeek:{},row=week[date.getDay()]||week[String(date.getDay())]||{};
  const override=value.todayOverride&&value.todayOverride.date===localKey(date)?value.todayOverride:null;
  const type=String(override?.type||row.type||((date.getDay()===0||date.getDay()===6)&&value.workdaysOnly!==false?'off':'desk')).toLowerCase();
  const startText=safeTime(row.start,fallback.startText),endText=safeTime(row.end,fallback.endText),range=parseRange(`${startText}-${endText}`);
  let end=range.end;if(type==='half'&&end>range.start+3)end=range.start+(end-range.start)/2;
  return{type,start:range.start,end,startText,endText:type==='half'?decimalTime(end):endText};
}
function decimalTime(value){
  const hours=Math.floor(value),minutes=Math.round((value-hours)*60);return`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
}
function formatTime(value,is24){
  const match=String(value).match(/^(\d{2}):(\d{2})$/);if(!match)return value;
  const hour=Number(match[1]),minute=match[2];if(is24)return`${match[1]}:${minute}`;
  return`${hour%12||12}:${minute} ${hour>=12?'PM':'AM'}`;
}
function currentHours(date=new Date()){return date.getHours()+date.getMinutes()/60+date.getSeconds()/3600}
function point(progress){
  const p=clamp(progress),x=24+(676-24)*p,y=(1-p)*(1-p)*80+2*(1-p)*p*4+p*p*80;
  return{x,y,xPercent:x/700*100};
}
function phaseFor(day,progress,nowHours){
  if(day.type==='off')return'off';
  if(nowHours<day.start)return nowHours>=day.start-2?'opening':'rest';
  if(nowHours>=day.end)return'complete';
  if(progress<.18)return'opening';
  if(progress<.48)return'morning';
  if(progress<.68)return'noon';
  return'afternoon';
}
function sourceName(value){
  const source=String(value||'').toLowerCase();
  if(source==='meal')return'lunch';
  if(source==='prep'||source==='timer')return'noodle';
  if(source==='gaze')return'eyes';
  if(source==='movement')return'body';
  return SOURCE_META[source]?source:'diagnostic';
}
function percentVar(node,name){
  const inline=node.style?.getPropertyValue(name),computed=getComputedStyle(node).getPropertyValue(name),value=parseFloat(inline||computed||'');
  return Number.isFinite(value)?value:null;
}

function buildDayUnfold(){
  const hero=$('.pf25Spatial-clock-hero');if(!hero||id('pf25Spatial-day-unfold'))return id('pf25Spatial-day-unfold');
  const region=create('section','pf25Spatial-day-unfold');region.id='pf25Spatial-day-unfold';region.setAttribute('aria-label','Workday unfolding');
  const sky=svg('svg','pf25Spatial-day-sky');sky.setAttribute('viewBox','0 0 700 96');sky.setAttribute('preserveAspectRatio','none');sky.setAttribute('aria-hidden','true');
  const future=svg('path','pf25Spatial-day-arc-future'),spent=svg('path','pf25Spatial-day-arc-spent');
  for(const path of [future,spent]){path.setAttribute('d','M24 80 Q350 4 676 80');path.setAttribute('pathLength','100')}
  sky.append(future,spent);
  const horizon=create('span','pf25Spatial-day-horizon'),sun=create('span','pf25Spatial-day-sun'),events=create('div','pf25Spatial-day-events'),sessions=create('div','pf25Spatial-day-sessions');
  sun.id='pf25Spatial-day-sun';events.id='pf25Spatial-day-events';sessions.id='pf25Spatial-day-sessions';
  const labels=create('div','pf25Spatial-day-labels'),start=create('span','pf25Spatial-day-start','--'),caption=create('span','pf25Spatial-day-caption','The day is opening'),end=create('span','pf25Spatial-day-end','--');
  labels.append(start,caption,end);region.append(sky,horizon,sessions,events,sun,labels);
  const status=id('pf25Spatial-status');hero.insertBefore(region,status||$('.pf25Spatial-progress')||null);
  return region;
}
function buildCueCluster(){
  const topbar=$('.pf25Spatial-topbar'),quiet=id('pf25Spatial-quiet');if(!topbar||!quiet)return null;
  let group=$('.pf25Spatial-topbar-actions');
  if(!group){group=create('div','pf25Spatial-topbar-actions');topbar.insertBefore(group,quiet);group.append(quiet)}
  let cluster=id('pf25Spatial-cue-cluster');
  if(!cluster){cluster=create('div','pf25Spatial-cue-cluster');cluster.id='pf25Spatial-cue-cluster';cluster.setAttribute('role','status');cluster.setAttribute('aria-live','polite');group.insertBefore(cluster,quiet)}
  return cluster;
}
function buildTaskbarSetting(){
  const panel=$('.pf25Spatial-settings-display');if(!panel||id('pf25Spatial-taskbar-cue-toggle'))return;
  const notificationRow=panel.querySelector('[data-control="notifications"]');
  const row=create('div','pf25Spatial-control-row pf25Spatial-daylight-row');row.dataset.control='taskbarCues';
  const copy=create('div','pf25Spatial-control-copy');copy.append(create('strong','','Taskbar cue dots'),create('small','','Keep subtle source cues visible, including in Quiet mode'));
  const toggle=create('button','pf25Spatial-daylight-toggle','');toggle.type='button';toggle.id='pf25Spatial-taskbar-cue-toggle';toggle.setAttribute('aria-label','Toggle taskbar cue dots');
  toggle.addEventListener('click',()=>{
    const current=prefs(),enabled=current.taskbarBadge!==false&&(current.taskbarBadgeMode||'due')!=='off';
    if(enabled)writePrefs({taskbarBadge:false,taskbarBadgeMode:'off'});
    else writePrefs({notifications:true,taskbarBadge:true,taskbarBadgeMode:'due',notificationMode:current.notificationMode==='off'?'quiet':current.notificationMode||'quiet'});
    refresh(true);
  });
  row.append(copy,toggle);
  const legend=create('div','pf25Spatial-cue-legend');
  for(const source of ['water','prayer','lunch','eyes','body']){const item=create('span','');const dot=create('i','pf25Spatial-cue-dot');dot.dataset.source=source;item.append(dot,create('small','',SOURCE_META[source].label));legend.append(item)}
  if(notificationRow){notificationRow.after(row,legend)}else panel.append(row,legend);
}

function renderMarkers(force=false){
  const layer=id('pf25Spatial-day-events');if(!layer)return;
  const quiet=Boolean(prefs().quietMode);
  const markers=[...document.querySelectorAll('.pf-ribbon-crease')].map(node=>{
    const x=percentVar(node,'--pf-ribbon-x');if(x==null)return null;
    return{x:clamp(x/100),kind:sourceName(node.dataset.kind||node.dataset.source||'prayer'),label:text(node.getAttribute('aria-label')||node.title||node.dataset.label||node.textContent)||'Scheduled moment'};
  }).filter(Boolean).sort((a,b)=>a.x-b.x);
  const key=JSON.stringify(markers.map(item=>[Math.round(item.x*1000),item.kind,quiet?'':item.label]));if(!force&&key===lastMarkerKey)return;lastMarkerKey=key;
  layer.replaceChildren();
  for(const item of markers){
    const dot=create('button','pf25Spatial-day-event');dot.type='button';dot.dataset.kind=item.kind;const location=point(item.x);dot.style.setProperty('--pf25Spatial-event-x',`${location.xPercent}%`);dot.style.setProperty('--pf25Spatial-event-y',`${location.y}px`);dot.setAttribute('aria-label',quiet?'Scheduled moment':item.label);dot.title=quiet?'Scheduled moment':item.label;layer.append(dot);
  }
}
function renderSessions(force=false){
  const layer=id('pf25Spatial-day-sessions');if(!layer)return;
  const sessions=[...document.querySelectorAll('.pf-ribbon-band')].map(node=>{
    const start=percentVar(node,'--pf-ribbon-start'),span=percentVar(node,'--pf-ribbon-span');if(start==null||span==null)return null;
    return{start:clamp(start/100),span:clamp(span>1?span/100:span),kind:sourceName(node.dataset.kind||'away')};
  }).filter(Boolean);
  const key=JSON.stringify(sessions.map(item=>[Math.round(item.start*1000),Math.round(item.span*1000),item.kind]));if(!force&&key===lastSessionKey)return;lastSessionKey=key;
  layer.replaceChildren();
  for(const item of sessions){const band=create('span','pf25Spatial-day-session');band.dataset.kind=item.kind;band.style.setProperty('--pf25Spatial-session-start',`${item.start*100}%`);band.style.setProperty('--pf25Spatial-session-width',`${item.span*100}%`);layer.append(band)}
}

function dueSources(){
  const value=prefs();
  if(value.notifications===false||(value.notificationMode||'quiet')==='off')return[];
  const found=new Set(window.__PACEFOLD_CUES__?.sources?.()||[]),now=Date.now();
  const add=source=>{if(source)found.add(sourceName(source))};
  if(value.waitingCue?.source&&(!value.waitingCue.expiresAt||Number(value.waitingCue.expiresAt)>now))add(value.waitingCue.source);
  const bodySource=document.body?.dataset.source,signal=document.body?.dataset.signal;
  if(bodySource&&(['due','pending'].includes(signal)||signal==='active'&&['prayer','away','body'].includes(bodySource)))add(bodySource);
  if(document.querySelector('[data-pf-flow-pulse][data-state="new"]'))add('flow');
  const selectors={
    water:'#waterBtn.due,#waterPill.due,[data-source="water"].due',
    noodle:'#noodleBtn.ready,#noodlePill.ready,[data-source="noodle"].ready',
    lunch:'#lunchPill.ready,#lunchBtn.ready,[data-source="lunch"].ready',
    eyes:'#gazeBtn.due,[data-source="eyes"].due',
    body:'#bodyBtn.due,[data-source="body"].due'
  };
  for(const [source,selector] of Object.entries(selectors))if(document.querySelector(selector))add(source);
  return SOURCE_ORDER.filter(source=>found.has(source));
}
function favicon(){
  if(faviconLink?.isConnected)return faviconLink;
  faviconLink=document.querySelector('link[rel~="icon"]');
  if(!faviconLink){faviconLink=document.createElement('link');faviconLink.rel='icon';document.head.append(faviconLink)}
  if(!baseFavicon)baseFavicon=faviconLink.href||'./icons/icon-192.png';
  return faviconLink;
}
function renderFavicon(sources){
  const link=favicon();if(!sources.length){if(baseFavicon)link.href=baseFavicon;return}
  try{
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const context=canvas.getContext('2d');if(!context)return;
    context.fillStyle='#315b50';context.beginPath();if(context.roundRect)context.roundRect(5,5,54,54,14);else context.rect(5,5,54,54);context.fill();
    context.fillStyle='#f7f7f1';context.font='700 34px system-ui';context.textAlign='center';context.textBaseline='middle';context.fillText('P',31,34);
    const positions=[[52,12],[52,28],[52,44],[37,53]];
    sources.slice(0,4).forEach((source,index)=>{const [x,y]=positions[index];context.fillStyle=SOURCE_META[source]?.color||SOURCE_META.diagnostic.color;context.beginPath();context.arc(x,y,6.2,0,Math.PI*2);context.fill();context.lineWidth=2;context.strokeStyle='#f7f7f1';context.stroke()});
    link.href=canvas.toDataURL('image/png');
  }catch{}
}
function renderBadge(sources,value){
  // The durable cue queue owns the native badge. Daylight only paints the
  // in-window dots and favicon, preventing two independent badge writers.
  void sources;void value;
}
function renderCues(force=false){
  const cluster=buildCueCluster(),value=prefs();if(!cluster)return;
  const sources=dueSources(),key=JSON.stringify([sources,value.taskbarBadge,value.taskbarBadgeMode,value.quietMode]);if(!force&&key===lastCueKey)return;lastCueKey=key;
  cluster.replaceChildren();
  for(const [index,source] of sources.entries()){const dot=create('i','pf25Spatial-cue-dot');dot.dataset.source=source;dot.dataset.primary=String(index===0);dot.title=SOURCE_META[source]?.label||'Pacefold cue';cluster.append(dot)}
  cluster.hidden=!sources.length;cluster.setAttribute('aria-label',sources.length?`Waiting cues: ${sources.map(source=>SOURCE_META[source]?.label||source).join(', ')}`:'No waiting cues');
  const root=id('pf25Spatial-spatial-root');if(root)root.dataset.cueCount=String(sources.length);
  renderFavicon(sources);renderBadge(sources,value);
}
function renderTaskbarSetting(){
  buildTaskbarSetting();const toggle=id('pf25Spatial-taskbar-cue-toggle');if(!toggle)return;
  const value=prefs(),active=value.taskbarBadge!==false&&(value.taskbarBadgeMode||'due')!=='off';toggle.dataset.active=String(active);toggle.textContent=active?'On':'Off';toggle.setAttribute('aria-pressed',String(active));
}

function renderDay(force=false){
  const region=buildDayUnfold(),root=id('pf25Spatial-spatial-root');if(!region||!root)return;
  const value=prefs(),day=resolvedDay(new Date(),value),nowHours=currentHours(),progress=day.type==='off'?0:clamp((nowHours-day.start)/Math.max(.01,day.end-day.start)),phaseName=phaseFor(day,progress,nowHours),phase=PHASES[phaseName],location=point(progress),is24=value.timeFormat==='24';
  root.dataset.dayPhase=phaseName;root.dataset.quiet=String(Boolean(value.quietMode));root.style.setProperty('--pf25Spatial-day-bg',phase.bg);root.style.setProperty('--pf25Spatial-day-glow',phase.glow);root.style.setProperty('--pf25Spatial-day-horizon',phase.horizon);root.style.setProperty('--pf25Spatial-sun',phase.sun);
  region.dataset.off=String(day.type==='off');region.style.setProperty('--pf25Spatial-day-dash',String(100-progress*100));region.style.setProperty('--pf25Spatial-sun-x',`${location.xPercent}%`);region.style.setProperty('--pf25Spatial-sun-y',`${location.y}px`);
  const start=region.querySelector('.pf25Spatial-day-start'),end=region.querySelector('.pf25Spatial-day-end'),caption=region.querySelector('.pf25Spatial-day-caption');
  if(start)start.textContent=formatTime(day.startText,is24);if(end)end.textContent=formatTime(day.endText,is24);
  if(caption)caption.textContent=day.type==='field'?`${phase.caption} · field day`:day.type==='half'?`${phase.caption} · half day`:phase.caption;
  region.setAttribute('aria-label',day.type==='off'?'Off day':`${Math.round(progress*100)} percent of the workday has unfolded`);
  renderMarkers(force);renderSessions(force);
}
function stampExperience(){
  const release=window.__PACEFOLD_ACTIVE_RELEASE__||RELEASE;document.documentElement.dataset.pacefoldExperience=release;if(document.body)document.body.dataset.pacefoldExperience=release;
  const version=$('.pf25Spatial-version');if(version)version.textContent=`Pacefold ${release} · Day Unfold · verified offline core 25.0.0`;
  if(window.__PACEFOLD_VERSION__)window.__PACEFOLD_VERSION__={...window.__PACEFOLD_VERSION__,experience:release,update:release,daylight:REVISION};
}
function refresh(force=false){
  if(document.documentElement.dataset.pacefoldSpatial!=='ready'||!id('pf25Spatial-spatial-root'))return false;
  buildDayUnfold();buildCueCluster();renderDay(force);renderCues(force);renderTaskbarSetting();stampExperience();return true;
}
function observeRibbon(){
  const sequence=id('sequence');if(!sequence||sequence.__pacefoldDaylightObserver)return;
  ribbonObserver=new MutationObserver(()=>refresh(true));ribbonObserver.observe(sequence,{subtree:true,childList:true,attributes:true,attributeFilter:['style','data-kind','data-source']});sequence.__pacefoldDaylightObserver=ribbonObserver;
}
function initialize(){
  if(!refresh(true))return;
  observeRibbon();
  if(!observer){observer=new MutationObserver(()=>refresh(true));observer.observe(document.body,{attributes:true,attributeFilter:['data-source','data-signal','data-quiet','data-day-type']})}
  for(const event of ['pacefold:prefs','pacefold:storage-changed','pacefold:quiet','pacefold:spatial-hardening','pacefold:attention','pacefold:cue-queue'])window.addEventListener(event,()=>refresh(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});
  clearInterval(timer);timer=setInterval(()=>refresh(false),15000);
  window.__PACEFOLD_DAY_VISUAL__={release:RELEASE,revision:REVISION,refresh:()=>refresh(true),sources:dueSources,resolvedDay};
  window.dispatchEvent(new CustomEvent('pacefold:daylight-ready',{detail:{release:RELEASE,revision:REVISION}}));
}

window.addEventListener('pacefold:spatial-ready',initialize,{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initialize,0),{once:true});else setTimeout(initialize,0);
})();

(()=>{
'use strict';
const RELEASE='25.0.0';
const REVISION='complete-stabilization-r6';
let panelObserver=null,stateObserver=null,stateRoot=null,frame=0;
const id=value=>document.getElementById(value);
const currentRelease=()=>window.__PACEFOLD_UNIFIED__?.release||window.__PACEFOLD_RHYTHM__?.release||RELEASE;

function stamp(){
  const release=currentRelease();
  window.__PACEFOLD_ACTIVE_RELEASE__=release;
  if(document.documentElement.dataset.pacefoldExperience!==release)document.documentElement.dataset.pacefoldExperience=release;
  if(document.body?.dataset.pacefoldExperience!==release)document.body.dataset.pacefoldExperience=release;
  const root=id('pf25Spatial-spatial-root');if(root){if(root.dataset.release!==release)root.dataset.release=release;if(root.dataset.stability!==REVISION)root.dataset.stability=REVISION}
  const version=document.querySelector('.pf25Spatial-version'),versionCopy=`Pacefold ${release} · private local engine`;if(version&&version.textContent!==versionCopy)version.textContent=versionCopy;
  if(window.__PACEFOLD_SPATIAL__&&window.__PACEFOLD_SPATIAL__.release!==release)window.__PACEFOLD_SPATIAL__.release=release;
  if(window.__PACEFOLD_HARDENING__&&window.__PACEFOLD_HARDENING__.release!==release)window.__PACEFOLD_HARDENING__.release=release;
  window.__PACEFOLD_VERSION__={...(window.__PACEFOLD_VERSION__||{}),experience:release,update:release,stability:REVISION};
}
function releaseDrifted(){
  const release=currentRelease(),root=id('pf25Spatial-spatial-root');
  return document.documentElement.dataset.pacefoldExperience!==release||document.body?.dataset.pacefoldExperience!==release||Boolean(root&&root.dataset.release!==release);
}
function observeReleaseTruth(){
  const root=id('pf25Spatial-spatial-root');if(stateObserver&&stateRoot===root)return;
  stateObserver?.disconnect();stateRoot=root;stateObserver=new MutationObserver(()=>{if(releaseDrifted())queue()});
  stateObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-pacefold-experience']});
  if(document.body)stateObserver.observe(document.body,{attributes:true,attributeFilter:['data-pacefold-experience']});
  if(root)stateObserver.observe(root,{attributes:true,attributeFilter:['data-release']});
}
function reconcilePanel(){
  const panel=id('panel'),visible=Boolean(panel?.classList.contains('on'));
  document.documentElement.classList.toggle('pf25Spatial-legacy-dialog-open',visible);
}
function finishControls(){
  for(const control of document.querySelectorAll('.pf25Spatial-ritual')){
    const name=control.textContent.trim()||control.dataset.ritual||'rhythm';
    control.setAttribute('aria-label',`${name} control`);
    control.setAttribute('aria-pressed',String(control.dataset.active==='true'));
  }
  const dial=document.querySelector('.pf25Actions-seconds-dial');if(dial)dial.title='Seconds';
}
function reconcile(){frame=0;stamp();observeReleaseTruth();reconcilePanel();finishControls()}
function queue(){if(!frame)frame=requestAnimationFrame(reconcile)}
function initialize(){
  if(new URLSearchParams(location.search).has('legacyAudit'))return;
  stamp();reconcile();window.__PACEFOLD_HARDENING__?.sync?.();window.__PACEFOLD_DAY_VISUAL__?.refresh?.();
  const panel=id('panel');if(panel){panelObserver=new MutationObserver(queue);panelObserver.observe(panel,{attributes:true,attributeFilter:['class','hidden','aria-hidden']})}
  for(const event of ['pacefold:spatial-ready','pacefold:prefs','pacefold:storage-changed','pacefold:quiet','pacefold:daylight-ready'])window.addEventListener(event,queue);
  document.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('#panel [data-action="close"],#panel .close'))requestAnimationFrame(reconcilePanel)},true);
  window.__PACEFOLD_EXPERIENCE__={release:currentRelease(),revision:REVISION,reconcile};
  window.dispatchEvent(new CustomEvent('pacefold:experience-ready',{detail:{release:currentRelease(),revision:REVISION}}));
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',initialize,{once:true}):initialize();
})();

(()=>{
'use strict';

const RELEASE='25.0.0';
const REVISION='action-dock-r1';
const PREFS_KEY='pacefoldPrefsV15';
const SOURCE_ORDER=['flow','prayer','water','noodle','away','lunch','eyes','body'];
const SOURCE_ALIASES={meal:'lunch',prep:'noodle',timer:'noodle',gaze:'eyes',movement:'body',move:'body'};
const SOURCE_META={
  flow:{label:'Needs review',short:'Review'},
  prayer:{label:'Prayer',short:'Prayer'},
  water:{label:'Water',short:'Sip'},
  noodle:{label:'Timer',short:'Timer'},
  away:{label:'Rest',short:'Rest'},
  lunch:{label:'Meal',short:'Meal'},
  eyes:{label:'Eyes',short:'Eyes'},
  body:{label:'Move',short:'Move'}
};
const DIRECT_ACTIONS=new Set(['noodle','away','lunch','eyes','body']);
const ACTIONS={
  water:['#waterBtn','#waterPill','[data-action="water"]'],
  noodle:['#noodleBtn','#noodlePill','[data-action="noodle"]','[data-action="timer"]'],
  away:['#awayBtn','#awayPill','[data-action="away"]'],
  lunch:['#lunchBtn','#lunchPill','[data-action="lunch"]','[data-action="meal"]'],
  eyes:['#eyesBtn','#gazeBtn','[data-action="eyes"]','[data-action="gaze"]'],
  body:['#careBtn','#bodyBtn','[data-action="body"]','[data-action="move"]'],
  prayer:['#prayerBtn','#prayerBreakBtn','[data-action="prayer"]']
};

let frame=0;
let queuedForce=false;
let initialized=false;
let timer=0;
let observer=null;
let lastBadgeKey='';
let lastCueKey='__unrendered__';
let toastTimer=0;

const $=selector=>document.querySelector(selector);
const id=value=>document.getElementById(value);
const create=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content!=null)node.textContent=String(content);return node};
const button=(className,label)=>{const node=create('button',className);node.type='button';node.setAttribute('aria-label',label);return node};
const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const localKey=(value=new Date())=>{const date=value instanceof Date?value:new Date(value);return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const prefs=()=>window.__PACEFOLD_RUNTIME_CORE__?.getPrefs?.()||parse(localStorage.getItem(PREFS_KEY),{})||{};
const normalizeSource=value=>{const source=String(value||'').toLowerCase();return SOURCE_ALIASES[source]||source};

function updatePrefs(patch){
  try{
    const core=window.__PACEFOLD_RUNTIME_CORE__;
    if(core?.updatePrefs)core.updatePrefs(patch);
    else localStorage.setItem(PREFS_KEY,JSON.stringify({...prefs(),...patch}));
    window.dispatchEvent(new CustomEvent('pacefold:prefs',{detail:{source:'action-dock'}}));
    window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:PREFS_KEY,source:'action-dock'}}));
  }catch{}
}
function formatDuration(milliseconds){
  const total=Math.max(0,Math.round(Number(milliseconds||0)/1000)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
  if(hours)return`${hours}h ${String(minutes).padStart(2,'0')}m`;
  return`${minutes}:${String(seconds).padStart(2,'0')}`;
}
function elapsed(start){return start?formatDuration(Date.now()-Number(start)):''}
function remaining(start,minutes){return start?Math.max(0,Number(start)+Math.max(1,Number(minutes)||30)*60000-Date.now()):0}
function controlState(source){
  const selectors={
    water:{due:'#waterBtn.due,#waterPill.due,[data-source="water"].due',active:'#waterBtn.active,#waterPill.active'},
    noodle:{due:'#noodleBtn.ready,#noodlePill.ready,[data-source="noodle"].ready',active:'#noodleBtn.running,#noodlePill.running'},
    away:{due:'#awayBtn.due,#awayPill.due,[data-source="away"].due',active:'#awayBtn.active,#awayPill.active'},
    lunch:{due:'#lunchBtn.ready,#lunchPill.ready,[data-source="lunch"].ready',active:'#lunchBtn.running,#lunchPill.running'},
    eyes:{due:'#eyesBtn.due,#gazeBtn.due,[data-source="eyes"].due',active:'#eyesBtn.active,#gazeBtn.active'},
    body:{due:'#careBtn.due,#bodyBtn.due,[data-source="body"].due',active:'#careBtn.active,#bodyBtn.active'}
  }[source]||{};
  return{due:Boolean(selectors.due&&$(selectors.due)),active:Boolean(selectors.active&&$(selectors.active))};
}
function cueSources(){
  const found=new Set();
  try{for(const source of window.__PACEFOLD_CUES__?.sources?.()||[])found.add(normalizeSource(source))}catch{}
  const value=prefs(),waiting=value.waitingCue?.source;
  if(waiting)found.add(normalizeSource(waiting));
  const source=document.body?.dataset.source,signal=document.body?.dataset.signal;
  if(source&&['due','pending'].includes(signal))found.add(normalizeSource(source));
  if(document.querySelector('[data-pf-flow-pulse][data-state="new"]'))found.add('flow');
  return SOURCE_ORDER.filter(source=>found.has(source));
}
function proxyClick(source){
  for(const selector of ACTIONS[source]||[]){
    const target=$(selector);
    if(target&&target.closest('#pf25Actions-action-dock')==null){
      try{target.click();return true}catch{}
    }
  }
  return false;
}
function addDayflow(type,label,detail,start=Date.now(),source=type){
  try{window.__PACEFOLD_DAYFLOW__?.add?.(type,label,detail,start,`action-dock-${source}`)}catch{}
}
function fallbackAction(source){
  const value=prefs(),now=Date.now();
  if(source==='water'){
    const count=Math.max(0,Number(value.waterSips)||0)+1,target=Math.max(1,Number(value.waterTarget)||24);
    updatePrefs({waterSips:count,waterDate:localKey(),lastWaterAt:now});addDayflow('water','Sip logged',`${count}/${target} today`,now,'water');return'Sip logged';
  }
  if(source==='away'){
    const start=Number(value.awayStart)||0;
    if(start){const sessions=Array.isArray(value.awaySessions)?value.awaySessions.slice():[];sessions.push({start,end:now});updatePrefs({awayStart:null,awaySessions:sessions.slice(-500)});addDayflow('away','Rest ended',formatDuration(now-start),start,'away');return'Rest logged'}
    updatePrefs({awayStart:now});addDayflow('away','Rest started','Away from desk',now,'away');return'Rest started';
  }
  if(source==='lunch'){
    const start=Number(value.lunchStart)||0;
    if(start){const sessions=Array.isArray(value.lunchSessions)?value.lunchSessions.slice():[];sessions.push({start,end:now,mode:value.lunchModeAtStart||'desk'});updatePrefs({lunchStart:null,lunchSessions:sessions.slice(-500)});addDayflow('meal','Meal ended',formatDuration(now-start),start,'lunch');return'Meal logged'}
    updatePrefs({lunchStart:now,lunchModeAtStart:'desk'});addDayflow('meal','Meal started','Desk meal',now,'lunch');return'Meal started';
  }
  if(source==='noodle'){
    const start=Number(value.noodleStart)||0;
    if(start){updatePrefs({noodleStart:null});addDayflow('prep','Timer stopped',formatDuration(now-start),start,'noodle');return'Timer stopped'}
    updatePrefs({noodleStart:now});addDayflow('prep','Timer started',`${Math.max(1,Number(value.noodleMinutes)||30)} minutes`,now,'noodle');return'Timer started';
  }
  if(source==='eyes'){updatePrefs({lastGazeAt:now});addDayflow('eyes','Eye reset logged','Looked away from the screen',now,'eyes');return'Eye reset logged'}
  if(source==='body'){updatePrefs({lastBodyAt:now});addDayflow('body','Movement logged','Stretch or movement break',now,'body');return'Movement logged'}
  if(source==='prayer'){window.__PACEFOLD_SCHEDULER__?.clear?.();return'Prayer cue cleared'}
  return'Updated';
}
function toast(message){
  const node=id('pf25Actions-action-toast');if(!node)return;
  node.textContent=message;node.dataset.visible='true';clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.dataset.visible='false'},1800);
}
function perform(source){
  const control=id(`pf25Actions-action-${source}`);if(control?.dataset.busy==='true')return;
  if(control)control.dataset.busy='true';
  let message='Updated';
  if(source==='flow'){
    try{window.__PACEFOLD_FLOW__?.acknowledge?.('action-dock')}catch{}
    try{window.__PACEFOLD_CUES__?.acknowledge?.('flow')}catch{}
    window.__PACEFOLD_SPATIAL__?.go?.('worklog');message='Opened Worklog';
  }else{
    if(DIRECT_ACTIONS.has(source))message=fallbackAction(source);
    else{const clicked=proxyClick(source);message=clicked?`${SOURCE_META[source]?.label||'Action'} updated`:fallbackAction(source)}
    try{window.__PACEFOLD_CUES__?.acknowledge?.(source)}catch{}
  }
  toast(message);
  setTimeout(()=>{if(control)control.dataset.busy='false';refresh(true)},90);
}

function buildDock(){
  const hero=$('.pf25Spatial-clock-hero'),root=id('pf25Spatial-spatial-root');if(!hero||!root)return null;
  let dock=id('pf25Actions-action-dock');if(dock)return dock;
  dock=create('section','pf25Actions-action-dock');dock.id='pf25Actions-action-dock';dock.setAttribute('aria-label','Quick log and timers');
  const head=create('header','pf25Actions-action-head');
  const cues=create('div','pf25Actions-action-cues');cues.id='pf25Actions-action-cues';cues.setAttribute('role','status');cues.setAttribute('aria-live','polite');
  const summary=create('span','pf25Actions-action-summary','Quick log');summary.id='pf25Actions-action-summary';
  const log=button('pf25Actions-action-log','Open today’s Worklog');log.append(create('span','','View log'),create('i','','→'));log.addEventListener('click',()=>window.__PACEFOLD_SPATIAL__?.go?.('worklog'));
  head.append(cues,summary,log);
  const grid=create('div','pf25Actions-action-grid');
  const definitions=[
    ['water','Log one sip','Log sip'],['noodle','Start or stop the preparation timer','Timer'],['away','Start rest or return to work','Rest'],
    ['lunch','Start or finish a meal','Meal'],['eyes','Log an eye reset','Eyes'],['body','Log movement or a stretch','Move']
  ];
  for(const [source,label,title] of definitions){
    const item=button('pf25Actions-action',label);item.id=`pf25Actions-action-${source}`;item.dataset.source=source;
    const dot=create('i','pf25Actions-action-dot');dot.setAttribute('aria-hidden','true');
    const copy=create('span','pf25Actions-action-copy');copy.append(create('strong','',title),create('small','','Ready'));
    const meter=create('i','pf25Actions-action-meter');meter.setAttribute('aria-hidden','true');
    item.append(dot,copy,meter);item.addEventListener('click',()=>perform(source));grid.append(item);
  }
  const toastNode=create('div','pf25Actions-action-toast','');toastNode.id='pf25Actions-action-toast';toastNode.setAttribute('role','status');toastNode.setAttribute('aria-live','polite');
  dock.append(head,grid,toastNode);
  const anchor=$('.pf25Spatial-context-glimpse')||$('.pf25Spatial-nav-hint');hero.insertBefore(dock,anchor||null);
  root.dataset.actionDock='ready';
  return dock;
}
function renderCues(sources){
  const cluster=id('pf25Actions-action-cues');if(!cluster)return;
  const key=sources.join('|');if(key===lastCueKey)return;lastCueKey=key;
  cluster.replaceChildren();
  if(!sources.length){const clear=create('span','pf25Actions-cue-clear');clear.append(create('i',''),create('small','','All clear'));cluster.append(clear);cluster.setAttribute('aria-label','No waiting cues');return}
  for(const source of sources){
    const cue=button('pf25Actions-cue',`${SOURCE_META[source]?.label||source} waiting`);cue.dataset.source=source;cue.title=SOURCE_META[source]?.label||source;
    cue.append(create('i','pf25Actions-cue-dot'),create('small','',SOURCE_META[source]?.short||source));cue.addEventListener('click',()=>perform(source));cluster.append(cue);
  }
  cluster.setAttribute('aria-label',`Waiting: ${sources.map(source=>SOURCE_META[source]?.label||source).join(', ')}`);
}
function renderAction(source,value,sources,quiet=false){
  const control=id(`pf25Actions-action-${source}`);if(!control)return;
  const strong=control.querySelector('strong'),small=control.querySelector('small'),state=controlState(source),queued=sources.includes(source);
  let title=SOURCE_META[source]?.label||source,detail='Tap to log',active=state.active,due=state.due||queued,progress=0;
  if(source==='water'){
    const count=Math.max(0,Number(value.waterSips)||0),target=Math.max(1,Number(value.waterTarget)||24);title='Log sip';detail=`${count}/${target} today${due?' · due now':''}`;progress=Math.min(100,count/target*100);
  }
  if(source==='noodle'){
    const start=Number(value.noodleStart)||0,minutes=Math.max(1,Number(value.noodleMinutes)||30),left=remaining(start,minutes);active=Boolean(start&&left>0);title=active?`Timer ${formatDuration(left)}`:`Start ${minutes}m`;detail=active?'Tap to stop and log':due?'Ready now':'Preparation timer';progress=active?Math.min(100,Math.max(0,(minutes*60000-left)/(minutes*60000)*100)):0;
  }
  if(source==='away'){
    const start=Number(value.awayStart)||0;active=Boolean(start);title=active?`Back · ${elapsed(start)}`:'Rest';detail=active?'Return and log this rest':due?'Rest cue due':'One tap starts the timer';
  }
  if(source==='lunch'){
    const start=Number(value.lunchStart)||0;active=Boolean(start);title=active?`Finish · ${elapsed(start)}`:'Meal';detail=active?'Finish and log meal':due?'Meal cue due':'Start meal timer';
  }
  if(source==='eyes'){title='Eye reset';detail=due?'Due now · tap to log':'20 seconds away from screen'}
  if(source==='body'){title='Move';detail=due?'Due now · tap to log':'Stretch or movement break'}
  if(!quiet){if(strong&&strong.textContent!==title)strong.textContent=title;if(small&&small.textContent!==detail)small.textContent=detail;}
  control.dataset.active=String(active);control.dataset.due=String(due);control.setAttribute('aria-pressed',String(active));control.style.setProperty('--pf25Actions-action-progress',`${progress}%`);
}
function syncNativeBadge(sources){
  const value=prefs(),enabled=value.notifications!==false&&value.taskbarBadge!==false&&(value.taskbarBadgeMode||'due')!=='off',key=`${enabled}:${sources.join(',')}`;
  if(key===lastBadgeKey)return;lastBadgeKey=key;
  const scheduler=window.__PACEFOLD_SCHEDULER__;
  try{
    if(!enabled||!sources.length)void scheduler?._nativeClearBadge?.();
    else void scheduler?._nativeSetBadge?.(sources.length>1?sources.length:undefined);
  }catch{}
}
function refresh(force=false){
  const dock=buildDock();if(!dock)return false;
  const value=prefs(),sources=cueSources(),quiet=Boolean(value.quietMode);renderCues(sources);
  for(const source of ['water','noodle','away','lunch','eyes','body'])renderAction(source,value,sources,quiet);
  const summary=id('pf25Actions-action-summary'),water=Math.max(0,Number(value.waterSips)||0),target=Math.max(1,Number(value.waterTarget)||24);
  if(summary&&!quiet){const copy=sources.length?`${sources.length} waiting · water ${water}/${target}`:`Quick log · water ${water}/${target}`;if(summary.textContent!==copy)summary.textContent=copy;}
  syncNativeBadge(sources);
  if(force)window.__PACEFOLD_DAY_VISUAL__?.refresh?.();
  return true;
}
function queue(force=false){
  queuedForce=queuedForce||Boolean(force);
  if(frame)return;
  frame=requestAnimationFrame(()=>{const applyForce=queuedForce;queuedForce=false;frame=0;refresh(applyForce)});
}
function observe(){
  if(observer)return;
  observer=new MutationObserver(mutations=>{
    if(mutations.every(item=>item.target instanceof Element&&item.target.closest?.('#pf25Actions-action-dock')))return;
    queue();
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-state','data-source','data-signal','data-active','hidden']});
}
function initialize(){
  if(initialized)return;
  if(!refresh(true))return;
  initialized=true;
  observe();clearInterval(timer);timer=setInterval(()=>refresh(false),1000);
  for(const event of ['pacefold:cue-queue','pacefold:prefs','pacefold:storage-changed','pacefold:dayflow','pacefold:quiet','pacefold:daylight-ready'])window.addEventListener(event,()=>queue(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue(true)});
  window.__PACEFOLD_ACTION_DOCK__={release:RELEASE,revision:REVISION,refresh:()=>refresh(true),perform,sources:cueSources};
  window.dispatchEvent(new CustomEvent('pacefold:action-dock-ready',{detail:{release:RELEASE,revision:REVISION}}));
}

window.addEventListener('pacefold:spatial-ready',initialize,{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initialize,0),{once:true});else setTimeout(initialize,0);
})();

(()=>{
'use strict';
const RELEASE='25.0.0';
const REVISION='experience-r1';
const PREFS_KEY='pacefoldPrefsV15';
const PRAYERS=[['fajr','Fajr'],['sunrise','Sunrise'],['dhuhr','Dhuhr'],['asr','Asr'],['maghrib','Maghrib'],['isha','Isha']];
const ALERTS=new Set(['fajr','dhuhr','asr','maghrib','isha']);
const IDLE_SECONDS=32;
let idleDeadline=0,idleTimer=0,minuteTimer=0,lastScheduleKey='',lastPhase='',initialized=false;
const $=selector=>document.querySelector(selector);
const id=value=>document.getElementById(value);
const create=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content!=null)node.textContent=String(content);return node};
const button=(className,label,content='')=>{const node=create('button',className,content);node.type='button';node.setAttribute('aria-label',label);return node};
const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
const prefs=()=>window.__PACEFOLD_RUNTIME_CORE__?.getPrefs?.()||parse(localStorage.getItem(PREFS_KEY),{})||{};
const localKey=(value=new Date())=>{const date=value instanceof Date?value:new Date(value);return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const clamp=(value,min,max,fallback)=>{value=Number(value);return Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback};
const dtr=value=>value*Math.PI/180,rtd=value=>value*180/Math.PI;
const dsin=value=>Math.sin(dtr(value)),dcos=value=>Math.cos(dtr(value)),dtan=value=>Math.tan(dtr(value));
const dasin=value=>rtd(Math.asin(value)),dacos=value=>rtd(Math.acos(value)),datan2=(y,x)=>rtd(Math.atan2(y,x)),dacot=value=>rtd(Math.atan2(1,value));
const fixA=value=>{value%=360;return value<0?value+360:value},fixH=value=>{value%=24;return value<0?value+24:value};
function updatePrefs(patch){
  try{
    const core=window.__PACEFOLD_RUNTIME_CORE__;
    if(core?.updatePrefs)core.updatePrefs(patch);
    else localStorage.setItem(PREFS_KEY,JSON.stringify({...prefs(),...patch}));
    window.dispatchEvent(new CustomEvent('pacefold:prefs',{detail:{source:'experience'}}));
    window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:PREFS_KEY,source:'experience'}}));
  }catch{}
}
function addDayflow(type,label,detail,start=Date.now(),source=type){try{window.__PACEFOLD_DAYFLOW__?.add?.(type,label,detail,start,`experience-${source}`)}catch{}}
function julian(year,month,day){if(month<=2){year-=1;month+=12}const a=Math.floor(year/100),b=2-a+Math.floor(a/4);return Math.floor(365.25*(year+4716))+Math.floor(30.6001*(month+1))+day+b-1524.5}
function sunPos(jd){const d=jd-2451545,g=fixA(357.529+.98560028*d),q=fixA(280.459+.98564736*d),l=fixA(q+1.915*dsin(g)+.020*dsin(2*g)),e=23.439-.00000036*d,ra=datan2(dcos(e)*dsin(l),dcos(l))/15,eqt=q/15-fixH(ra),decl=dasin(dsin(e)*dsin(l));return{decl,eqt}}
function computePrayerTimes(date=new Date(),value=prefs()){
  const lat=clamp(value.lat,-90,90,43.62),lng=clamp(value.lng,-180,180,-79.51),tz=-date.getTimezoneOffset()/60,jd=julian(date.getFullYear(),date.getMonth()+1,date.getDate())-lng/(15*24),mid=time=>fixH(12-sunPos(jd+time).eqt);
  const angleAt=(angle,time,direction)=>{const decl=sunPos(jd+time).decl,noon=mid(time),x=(-dsin(angle)-dsin(decl)*dsin(lat))/(dcos(decl)*dcos(lat)),span=(1/15)*dacos(Math.min(1,Math.max(-1,x)));return noon+(direction==='ccw'?-span:span)};
  const asrAt=(factor,time)=>{const decl=sunPos(jd+time).decl,angle=-dacot(factor+dtan(Math.abs(lat-decl)));return angleAt(angle,time,'cw')};
  const angle=value.method==='18'?18:15,asrFactor=value.asr==='hanafi'?2:1;
  const times={fajr:5,sunrise:6,dhuhr:12,asr:13,sunset:18,maghrib:18,isha:19};
  for(let index=0;index<4;index+=1){const part={};for(const key of Object.keys(times))part[key]=times[key]/24;times.fajr=angleAt(angle,part.fajr,'ccw');times.sunrise=angleAt(.833,part.sunrise,'ccw');times.dhuhr=mid(part.dhuhr);times.asr=asrAt(asrFactor,part.asr);times.sunset=angleAt(.833,part.sunset,'cw');times.maghrib=angleAt(.833,part.maghrib,'cw');times.isha=angleAt(angle,part.isha,'cw')}
  const adjustment=tz-lng/15;for(const key of Object.keys(times))times[key]+=adjustment;times.dhuhr+=1/60;
  const offsets=value.offsets&&typeof value.offsets==='object'?value.offsets:{};for(const key of ALERTS)times[key]+=(Number(offsets[key])||0)/60;
  return times;
}
function parseClock(value){const match=String(value||'').match(/^(\d{1,2}):(\d{2})$/);if(!match)return 0;return Number(match[1])+Number(match[2])/60}
function scheduleForDate(date=new Date(),includeSunrise=false,value=prefs()){
  const muslim=['original','muslim'].includes(String(value.profile||'original'));
  if(muslim){const times=computePrayerTimes(date,value);return PRAYERS.filter(([key])=>includeSunrise||ALERTS.has(key)).map(([key,label])=>({id:key,label,time:times[key],auto:true}))}
  const fallback=[['morning-reset','Morning reset','09:30'],['midday-pause','Midday pause','12:30'],['afternoon-reset','Afternoon reset','15:00']];
  const source=Array.isArray(value.customMoments)&&value.customMoments.length?value.customMoments:fallback;
  return source.map((item,index)=>Array.isArray(item)?{id:String(item[0]||`moment-${index+1}`),label:String(item[1]||`Moment ${index+1}`),time:parseClock(item[2]),auto:false}:{id:String(item?.id||`moment-${index+1}`),label:String(item?.label||`Moment ${index+1}`),time:parseClock(item?.time),auto:false}).filter(item=>Number.isFinite(item.time)).sort((a,b)=>a.time-b.time)
}
function dateAt(date,hours){const result=new Date(date);result.setHours(0,0,0,0);result.setMinutes(Math.round(Number(hours||0)*60));return result}
function formatTime(date){return date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}
function scheduleState(date=new Date(),includeSunrise=false){
  const value=prefs(),today=scheduleForDate(date,includeSunrise,value).map(item=>({...item,date:dateAt(date,item.time)}));
  let next=today.find(item=>item.date.getTime()>date.getTime());
  if(!next){const tomorrow=new Date(date);tomorrow.setDate(tomorrow.getDate()+1);const first=scheduleForDate(tomorrow,includeSunrise,value)[0];if(first)next={...first,date:dateAt(tomorrow,first.time)}}
  return{value,today,next,muslim:['original','muslim'].includes(String(value.profile||'original'))}
}
function scheduleMeta(state){const location=text(state.value.locationLabel)||`${clamp(state.value.lat,-90,90,43.62).toFixed(2)}, ${clamp(state.value.lng,-180,180,-79.51).toFixed(2)}`;return state.muslim?`${location} · ${state.value.method==='18'?'18°':'15°'} · ${state.value.asr==='hanafi'?'Hanafi Asr':'Standard Asr'}`:`${location} · custom moments`}
function buildSchedule(){
  const hero=$('.pf25Spatial-clock-hero'),dock=id('pf25Actions-action-dock');if(!hero)return;
  let strip=id('pf25Actions-schedule-strip');
  if(!strip){
    strip=create('section','pf25Actions-schedule-strip');strip.id='pf25Actions-schedule-strip';strip.setAttribute('aria-label','Today schedule');
    strip.append(create('header','pf25Actions-schedule-head'),create('div','pf25Actions-schedule-items'));
    hero.insertBefore(strip,dock||$('.pf25Spatial-context-glimpse')||null);
  }
  const context=$('.pf25Spatial-context-layout');
  if(context&&!id('pf25Actions-context-schedule')){
    const panel=create('section','pf25Actions-context-schedule');panel.id='pf25Actions-context-schedule';panel.append(create('header','pf25Actions-context-schedule-head'),create('div','pf25Actions-context-schedule-items'));
    context.append(panel);
  }
}
function renderSchedule(force=false){
  buildSchedule();const now=new Date(),state=scheduleState(now,false),full=scheduleState(now,true),key=`${localKey(now)}|${Math.floor(Date.now()/60000)}|${state.value.profile}|${state.value.lat}|${state.value.lng}|${state.value.method}|${state.value.asr}|${JSON.stringify(state.value.offsets||{})}`;
  if(!force&&key===lastScheduleKey)return;lastScheduleKey=key;
  const head=$('.pf25Actions-schedule-head'),items=$('.pf25Actions-schedule-items');if(head&&items){
    head.replaceChildren();const copy=create('div');copy.append(create('strong','',state.muslim?'Prayer times':'Today’s moments'),create('small','',state.next?`Next · ${state.next.label} ${formatTime(state.next.date)}`:'Schedule complete'));
    const adjust=button('pf25Actions-schedule-adjust','Open schedule settings','Adjust');adjust.addEventListener('click',()=>{window.__PACEFOLD_SPATIAL__?.go?.('settings');setTimeout(()=>document.querySelector('.pf25Spatial-settings-card .pf25Spatial-secondary:last-of-type')?.click(),220)});head.append(copy,adjust);
    items.replaceChildren();for(const item of state.today){const node=button('pf25Actions-schedule-item',`${item.label} at ${formatTime(item.date)}`);node.dataset.prayer=item.id;node.dataset.state=item.date<now?'past':state.next?.id===item.id&&localKey(state.next.date)===localKey(now)?'next':'upcoming';node.append(create('span','',item.label),create('strong','',formatTime(item.date)));node.addEventListener('click',()=>window.__PACEFOLD_SPATIAL__?.go?.('context'));items.append(node)}
  }
  const contextHead=$('.pf25Actions-context-schedule-head'),contextItems=$('.pf25Actions-context-schedule-items');if(contextHead&&contextItems){
    contextHead.replaceChildren();const copy=create('div');copy.append(create('span','pf25Spatial-eyebrow',full.muslim?'Prayer schedule':'Moment schedule'),create('h2','',full.next?`${full.next.label} · ${formatTime(full.next.date)}`:'Today is complete'),create('small','',scheduleMeta(full)));contextHead.append(copy);
    contextItems.replaceChildren();for(const item of full.today){const node=create('article','pf25Actions-context-prayer');node.dataset.prayer=item.id;node.dataset.state=item.date<now?'past':full.next?.id===item.id&&localKey(full.next.date)===localKey(now)?'next':'upcoming';node.append(create('span','',item.label),create('strong','',formatTime(item.date)));contextItems.append(node)}
  }
}
function updateAtmosphere(){
  const root=id('pf25Spatial-spatial-root');if(!root)return;const now=new Date(),hour=now.getHours()+now.getMinutes()/60,phase=hour<6?'night':hour<11?'morning':hour<15?'midday':hour<19?'evening':'night';
  if(phase!==lastPhase){root.dataset.dayPhase=phase;lastPhase=phase}
  const value=prefs(),match=String(value.workHours||'08:30-16:30').match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/),start=match?Number(match[1])+Number(match[2])/60:8.5,end=match?Number(match[3])+Number(match[4])/60:16.5,progress=Math.max(0,Math.min(1,(hour-start)/Math.max(.25,end-start)));
  root.style.setProperty('--pf25Actions-day-progress',String(progress));root.style.setProperty('--pf25Actions-sun-x',`${8+progress*84}%`);root.style.setProperty('--pf25Actions-sun-y',`${31-Math.sin(progress*Math.PI)*18}%`);
}
function toast(message){const node=id('pf25Actions-action-toast');if(node){node.textContent=message;node.dataset.visible='true';setTimeout(()=>{node.dataset.visible='false'},1900)}}
function directAction(source){
  const value=prefs(),now=Date.now(),today=localKey(),ack=()=>{try{window.__PACEFOLD_CUES__?.acknowledge?.(source)}catch{}};let message='Updated';
  if(source==='flow'){try{window.__PACEFOLD_FLOW__?.acknowledge?.('experience')}catch{}window.__PACEFOLD_SPATIAL__?.go?.('worklog');return}
  if(source==='prayer'){ack();message='Prayer cue cleared'}
  if(source==='water'){
    const same=value.waterDate===today,count=(same?Math.max(0,Number(value.waterSips)||0):0)+1,target=Math.max(1,Number(value.waterTarget)||24);updatePrefs({activityDate:today,waterDate:today,waterSips:Math.min(50,count),waterLastAt:now,waterGraceUntil:now+12*60000});addDayflow('water','Sip logged',`${Math.min(50,count)}/${target} today`,now,'water');message=`Sip ${Math.min(50,count)} of ${target}`;ack();
  }
  if(source==='noodle'){
    const start=Number(value.noodleStart)||0;if(start){updatePrefs({noodleStart:0,noodleDurationAtStart:0});addDayflow('prep','Timer stopped',`${Math.max(1,Math.round((now-start)/60000))} min`,start,'noodle');message='Timer stopped'}else{const minutes=Math.max(1,Number(value.noodleMinutes)||30);updatePrefs({noodleStart:now,noodleDurationAtStart:minutes,noodleDone:''});addDayflow('prep','Timer started',`${minutes} minutes`,now,'noodle');message=`${minutes}-minute timer started`}ack();
  }
  if(source==='away'){
    const start=Number(value.awayStart)||0;if(start){const minutes=Math.min(120,Math.max(1,Math.round((now-start)/60000))),sessions=Array.isArray(value.awaySessions)?value.awaySessions.slice():[];sessions.push({start,end:now,minutes});updatePrefs({awayStart:0,awaySessions:sessions.slice(-20),waterGraceUntil:now+8*60000});addDayflow('away','Rest logged',`${minutes} min`,start,'away');message=`Rest logged · ${minutes} min`}else{updatePrefs({awayStart:now,waterGraceUntil:now+15*60000});addDayflow('away','Rest started','Away from desk',now,'away');message='Rest started'}ack();
  }
  if(source==='lunch'){
    const start=Number(value.lunchStart)||0;if(start){const mode=value.lunchModeAtStart||value.lunchMode||'desk',minutes=Math.min(240,Math.max(1,Math.round((now-start)/60000))),sessions=Array.isArray(value.lunchSessions)?value.lunchSessions.slice():[];sessions.push({mode,start,end:now,minutes});updatePrefs({lunchStart:0,lunchDurationAtStart:0,lunchLoggedMinutes:minutes,lunchDone:today,lunchSessions:sessions.slice(-10),waterGraceUntil:now+12*60000});addDayflow('meal',mode==='away'?'Away lunch logged':'Desk meal logged',`${minutes} min`,start,'lunch');message=`Meal logged · ${minutes} min`}else{const mode=value.lunchMode||'desk',minutes=mode==='away'?Math.max(1,Number(value.awayLunchMinutes)||45):Math.max(1,Number(value.deskLunchMinutes)||20);updatePrefs({lunchStart:now,lunchModeAtStart:mode,lunchDurationAtStart:minutes,lunchDone:'',lunchLoggedMinutes:0,waterGraceUntil:now+(minutes+12)*60000});addDayflow('meal',mode==='away'?'Away lunch started':'Desk meal started',`${minutes} minutes`,now,'lunch');message=`${minutes}-minute meal started`}ack();
  }
  if(source==='eyes'){updatePrefs({gazeLastAt:now,gazeSnoozedUntil:0});addDayflow('eyes','Eye reset logged','20 seconds looking away',now,'eyes');message='Eye reset logged';ack()}
  if(source==='body'){const prompt=Math.max(0,Number(value.bodyPromptIndex)||0),sessions=Array.isArray(value.bodySessions)?value.bodySessions.slice():[];sessions.push({start:now-60000,end:now,seconds:60,prompt});updatePrefs({bodyResetStart:0,bodyLastAt:now,bodySnoozedUntil:0,bodySessions:sessions.slice(-30),bodyPromptIndex:(prompt+1)%4});addDayflow('body','Movement reset logged','One-minute position change',now,'body');message='Movement logged';ack()}
  toast(message);setTimeout(()=>{window.__PACEFOLD_ACTION_DOCK__?.refresh?.(true);renderActivity();renderSchedule(true)},100)
}
function installActionOwner(){
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target.closest('#pf25Actions-action-dock button'):null;if(!target)return;
    if(target.classList.contains('pf25Actions-action-log'))return;
    const source=target.dataset.source||target.id.replace('pf25Actions-action-','');if(!source)return;
    event.preventDefault();event.stopImmediatePropagation();directAction(source);
  },true);
}
function renderActivity(){
  const dock=id('pf25Actions-action-dock');if(!dock)return;let receipt=id('pf25Actions-log-receipt');if(!receipt){receipt=create('div','pf25Actions-log-receipt');receipt.id='pf25Actions-log-receipt';dock.append(receipt)}
  const value=prefs(),records=[];
  if(value.waterLastAt)records.push({at:Number(value.waterLastAt),label:`Sip ${Number(value.waterSips)||0}/${Number(value.waterTarget)||24}`});
  const away=(value.awaySessions||[]).at?.(-1);if(away?.end)records.push({at:Number(away.end),label:`Rest ${Number(away.minutes)||0}m`});
  const meal=(value.lunchSessions||[]).at?.(-1);if(meal?.end)records.push({at:Number(meal.end),label:`Meal ${Number(meal.minutes)||0}m`});
  if(value.gazeLastAt)records.push({at:Number(value.gazeLastAt),label:'Eye reset'});if(value.bodyLastAt)records.push({at:Number(value.bodyLastAt),label:'Movement'});
  records.sort((a,b)=>b.at-a.at);const latest=records[0];receipt.replaceChildren(create('span','',latest?'Last logged':'Nothing logged yet'),create('strong','',latest?`${latest.label} · ${formatTime(new Date(latest.at))}`:'One tap records it here'));
}
function mode(){return id('pf25Spatial-spatial-root')?.dataset.mode||'home'}
function goHome(){window.__PACEFOLD_SPATIAL__?.go?.('home');armIdle(false)}
function blocked(){return Boolean(document.querySelector('input:focus,textarea:focus,select:focus,[contenteditable="true"]:focus,.pf-modal:not([hidden]),#panel.on,.pf25Spatial-sound-overlay:not([hidden])'))}
function armIdle(reset=true){
  if(mode()==='home'){idleDeadline=0;renderReturnCue();return}
  if(reset||!idleDeadline)idleDeadline=Date.now()+IDLE_SECONDS*1000;
  renderReturnCue();
}
function renderReturnCue(){
  const root=id('pf25Spatial-spatial-root');if(!root)return;let cue=id('pf25Actions-return-cue');if(!cue){cue=button('pf25Actions-return-cue','Return to Clock');cue.id='pf25Actions-return-cue';cue.addEventListener('click',goHome);root.append(cue)}
  if(mode()==='home'||!idleDeadline||blocked()){cue.hidden=true;return}
  const left=Math.max(0,Math.ceil((idleDeadline-Date.now())/1000));cue.hidden=left>9;cue.textContent=left?`Clock in ${left}s`:'Clock';if(!left)goHome()
}
function installNavigationOwner(){
  const returnFirst=event=>{if(mode()==='home'||blocked())return false;event.preventDefault();event.stopImmediatePropagation();goHome();return true};
  document.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape','Home'].includes(event.key))return;returnFirst(event)},true);
  for(const name of ['click','pointerenter','pointerup'])document.addEventListener(name,event=>{const target=event.target instanceof Element?event.target.closest('.pf25Spatial-edge,.pf25Spatial-mode-dot'):null;if(!target)return;returnFirst(event)},true);
  document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target.closest('.pf25Spatial-home-button,.pf25Spatial-brand'):null;if(target)armIdle(false)},true);
  for(const name of ['pointerdown','keydown','input','wheel'])document.addEventListener(name,()=>{if(mode()!=='home')armIdle(true)},{passive:true});
  const root=id('pf25Spatial-spatial-root');if(root){new MutationObserver(()=>{if(mode()==='home')armIdle(false);else armIdle(true);renderActivity();renderSchedule(true)}).observe(root,{attributes:true,attributeFilter:['data-mode']})}
  clearInterval(idleTimer);idleTimer=setInterval(()=>{if(blocked()){if(mode()!=='home')idleDeadline=Date.now()+IDLE_SECONDS*1000;renderReturnCue();return}renderReturnCue()},1000)
}
function initialize(){
  if(initialized)return;
  const root=id('pf25Spatial-spatial-root');if(!root){window.addEventListener('pacefold:spatial-ready',initialize,{once:true});return}
  initialized=true;document.documentElement.dataset.pacefoldSpatial='ready';document.documentElement.classList.remove('pf25Actions-boot-hold');root.dataset.experience=REVISION;
  buildSchedule();renderSchedule(true);updateAtmosphere();renderActivity();installActionOwner();installNavigationOwner();
  for(const event of ['pacefold:prefs','pacefold:storage-changed','pacefold:dayflow','pacefold:cue-queue'])window.addEventListener(event,()=>{renderSchedule(true);renderActivity();updateAtmosphere()});
  clearInterval(minuteTimer);minuteTimer=setInterval(()=>{renderSchedule();updateAtmosphere();renderActivity()},30000);
  window.__PACEFOLD_EXPERIENCE__={release:RELEASE,revision:REVISION,schedule:()=>scheduleState(new Date(),true),home:goHome,refresh:()=>{renderSchedule(true);renderActivity();updateAtmosphere()}};
  window.dispatchEvent(new CustomEvent('pacefold:experience-ready',{detail:{release:RELEASE,revision:REVISION}}));
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',initialize,{once:true}):initialize();
})();
;
(()=>{
'use strict';
const RELEASE='25.0.0';
const REVISION='unified-r1';
const PREFS_KEY='pacefoldPrefsV15';
const NOTES_KEY='pacefold.notebook.entries.v2';
const PRAYERS=[['fajr','Fajr'],['sunrise','Sunrise'],['dhuhr','Dhuhr'],['asr','Asr'],['maghrib','Maghrib'],['isha','Isha']];
const ALERTS=new Set(['fajr','dhuhr','asr','maghrib','isha']);
let mounted=false,tickTimer=0,minuteTimer=0,lastMinute=-1,lastScheduleKey='';
const $=selector=>document.querySelector(selector);
const id=value=>document.getElementById(value);
const create=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content!=null)node.textContent=String(content);return node};
const button=(className,label,content='')=>{const node=create('button',className,content);node.type='button';node.setAttribute('aria-label',label);return node};
const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
const prefs=()=>window.__PACEFOLD_RHYTHM__?.prefs?.()||window.__PACEFOLD_CORE__?.getPrefs?.()||window.__PACEFOLD_RUNTIME_CORE__?.getPrefs?.()||parse(localStorage.getItem(PREFS_KEY),{})||{};
const patchPrefs=patch=>window.__PACEFOLD_RHYTHM__?.patchPrefs?.(patch)||window.__PACEFOLD_CORE__?.updatePrefs?.(patch)||window.__PACEFOLD_RUNTIME_CORE__?.updatePrefs?.(patch);
const notes=()=>{const value=parse(localStorage.getItem(NOTES_KEY),[]);return Array.isArray(value)?value:[]};
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const clamp=(value,min,max,fallback)=>{value=Number(value);return Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback};
const pad=value=>String(value).padStart(2,'0');
const dtr=value=>value*Math.PI/180,rtd=value=>value*180/Math.PI;
const dsin=value=>Math.sin(dtr(value)),dcos=value=>Math.cos(dtr(value)),dtan=value=>Math.tan(dtr(value));
const dasin=value=>rtd(Math.asin(value)),dacos=value=>rtd(Math.acos(value)),datan2=(y,x)=>rtd(Math.atan2(y,x)),dacot=value=>rtd(Math.atan2(1,value));
const fixA=value=>{value%=360;return value<0?value+360:value},fixH=value=>{value%=24;return value<0?value+24:value};
function zoneName(value=prefs()){return text(value.timeZone)||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}
function zoneParts(date=new Date(),timeZone=zoneName()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date),result={};
  for(const part of parts)if(part.type!=='literal')result[part.type]=Number(part.value);
  return result;
}
function zoneOffsetHours(date,timeZone=zoneName()){
  const part=zoneParts(date,timeZone),asUTC=Date.UTC(part.year,part.month-1,part.day,part.hour,part.minute,part.second);return (asUTC-date.getTime())/3600000
}
function zonedDate(year,month,day,hours,timeZone=zoneName()){
  const whole=Math.floor(hours),minute=Math.round((hours-whole)*60),normalizedHour=whole+Math.floor(minute/60),normalizedMinute=((minute%60)+60)%60;
  let stamp=Date.UTC(year,month-1,day,normalizedHour,normalizedMinute,0);
  for(let index=0;index<3;index+=1)stamp=Date.UTC(year,month-1,day,normalizedHour,normalizedMinute,0)-zoneOffsetHours(new Date(stamp),timeZone)*3600000;
  return new Date(stamp)
}
function localKey(date=new Date(),timeZone=zoneName()){
  const part=zoneParts(date,timeZone);return `${part.year}-${pad(part.month)}-${pad(part.day)}`
}
function formatTime(date,value=prefs()){
  return new Intl.DateTimeFormat(undefined,{timeZone:zoneName(value),hour:'numeric',minute:'2-digit',hour12:value.timeFormat!=='24'}).format(date)
}
function formatDate(date,value=prefs()){
  return new Intl.DateTimeFormat(undefined,{timeZone:zoneName(value),weekday:'long',month:'long',day:'numeric'}).format(date)
}
function julian(year,month,day){if(month<=2){year-=1;month+=12}const a=Math.floor(year/100),b=2-a+Math.floor(a/4);return Math.floor(365.25*(year+4716))+Math.floor(30.6001*(month+1))+day+b-1524.5}
function sunPos(jd){const d=jd-2451545,g=fixA(357.529+.98560028*d),q=fixA(280.459+.98564736*d),l=fixA(q+1.915*dsin(g)+.020*dsin(2*g)),e=23.439-.00000036*d,ra=datan2(dcos(e)*dsin(l),dcos(l))/15,eqt=q/15-fixH(ra),decl=dasin(dsin(e)*dsin(l));return{decl,eqt}}
function computePrayerHours(date=new Date(),value=prefs()){
  const timeZone=zoneName(value),part=zoneParts(date,timeZone),lat=clamp(value.lat,-90,90,43.62),lng=clamp(value.lng,-180,180,-79.51),anchor=zonedDate(part.year,part.month,part.day,12,timeZone),tz=zoneOffsetHours(anchor,timeZone),jd=julian(part.year,part.month,part.day)-lng/(15*24),mid=time=>fixH(12-sunPos(jd+time).eqt);
  const angleAt=(angle,time,direction)=>{const decl=sunPos(jd+time).decl,noon=mid(time),x=(-dsin(angle)-dsin(decl)*dsin(lat))/(dcos(decl)*dcos(lat)),span=(1/15)*dacos(Math.min(1,Math.max(-1,x)));return noon+(direction==='ccw'?-span:span)};
  const asrAt=(factor,time)=>{const decl=sunPos(jd+time).decl,angle=-dacot(factor+dtan(Math.abs(lat-decl)));return angleAt(angle,time,'cw')};
  const angle=value.method==='18'?18:15,asrFactor=value.asr==='hanafi'?2:1,times={fajr:5,sunrise:6,dhuhr:12,asr:13,sunset:18,maghrib:18,isha:19};
  for(let index=0;index<4;index+=1){const partDay={};for(const key of Object.keys(times))partDay[key]=times[key]/24;times.fajr=angleAt(angle,partDay.fajr,'ccw');times.sunrise=angleAt(.833,partDay.sunrise,'ccw');times.dhuhr=mid(partDay.dhuhr);times.asr=asrAt(asrFactor,partDay.asr);times.sunset=angleAt(.833,partDay.sunset,'cw');times.maghrib=angleAt(.833,partDay.maghrib,'cw');times.isha=angleAt(angle,partDay.isha,'cw')}
  const adjustment=tz-lng/15;for(const key of Object.keys(times))times[key]+=adjustment;times.dhuhr+=1/60;
  const offsets=value.offsets&&typeof value.offsets==='object'?value.offsets:{};for(const key of ALERTS)times[key]+=(Number(offsets[key])||0)/60;
  return times
}
function parseClock(value){const match=String(value||'').match(/^(\d{1,2}):(\d{2})$/);if(!match)return NaN;return Number(match[1])+Number(match[2])/60}
function scheduleForDay(date=new Date(),includeSunrise=false,value=prefs()){
  const timeZone=zoneName(value),part=zoneParts(date,timeZone),muslim=['original','muslim'].includes(String(value.profile||'original'));
  if(muslim){const times=computePrayerHours(date,value);return PRAYERS.filter(([key])=>includeSunrise||ALERTS.has(key)).map(([key,label])=>({id:key,label,hours:times[key],date:zonedDate(part.year,part.month,part.day,times[key],timeZone),auto:true}))}
  const fallback=[['morning-reset','Morning reset','09:30'],['midday-pause','Midday pause','12:30'],['afternoon-reset','Afternoon reset','15:00']],source=Array.isArray(value.customMoments)&&value.customMoments.length?value.customMoments:fallback;
  return source.map((item,index)=>{const row=Array.isArray(item)?item:[item?.id,item?.label,item?.time];const hours=parseClock(row[2]);return{id:String(row[0]||`moment-${index+1}`),label:String(row[1]||`Moment ${index+1}`),hours,date:zonedDate(part.year,part.month,part.day,hours,timeZone),auto:false}}).filter(item=>Number.isFinite(item.hours)).sort((a,b)=>a.date-b.date)
}
function scheduleState(date=new Date(),includeSunrise=false,value=prefs()){
  const today=scheduleForDay(date,includeSunrise,value),timeZone=zoneName(value);let next=today.find(item=>item.date>date);
  if(!next){const part=zoneParts(date,timeZone),tomorrow=zonedDate(part.year,part.month,part.day+1,12,timeZone),first=scheduleForDay(tomorrow,includeSunrise,value)[0];if(first)next=first}
  return{value,today,next,muslim:['original','muslim'].includes(String(value.profile||'original')),timeZone}
}
function workRange(value=prefs()){
  const source=String(value.workHours||'08:30-16:30'),match=source.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);let start=8.5,end=16.5;
  if(match){start=Number(match[1])+Number(match[2])/60;end=Number(match[3])+Number(match[4])/60;if(end<=start)end=start+8}
  return{start,end,startText:`${pad(Math.floor(start))}:${pad(Math.round((start%1)*60))}`,endText:`${pad(Math.floor(end))}:${pad(Math.round((end%1)*60))}`}
}
function buildDial(){
  const wrap=create('div','pf25Surface-dial-wrap'),dial=create('div','pf25Surface-dial');dial.id='pf25Surface-dial';dial.setAttribute('aria-label','Analog clock');
  for(let index=0;index<60;index+=1){const tick=create('i',index%5===0?'pf25Surface-tick pf25Surface-tick-major':'pf25Surface-tick');tick.style.setProperty('--tick',String(index));dial.append(tick)}
  const hour=create('span','pf25Surface-hand pf25Surface-hour'),minute=create('span','pf25Surface-hand pf25Surface-minute'),second=create('span','pf25Surface-hand pf25Surface-second'),hub=create('span','pf25Surface-hub');dial.append(hour,minute,second,hub);
  const mode=create('div','pf25Surface-dial-caption');mode.append(create('span','','Current moment'),create('strong','','Clock'));wrap.append(dial,mode);return wrap
}
function buildDayArc(){
  const arc=create('section','pf25Surface-day-arc');arc.id='pf25Surface-day-arc';arc.setAttribute('aria-label','Workday progress');
  const head=create('header','pf25Surface-day-head'),title=create('div');title.append(create('span','','Day unfold'),create('strong','','The workday in one line'));const progress=create('span','pf25Surface-day-percent','0%');progress.id='pf25Surface-day-percent';head.append(title,progress);
  const rail=create('div','pf25Surface-day-rail'),fill=create('i','pf25Surface-day-fill'),sun=create('b','pf25Surface-day-sun'),markers=create('div','pf25Surface-day-markers');markers.id='pf25Surface-day-markers';rail.append(fill,sun,markers);
  const labels=create('div','pf25Surface-day-labels');labels.append(create('span','pf25Surface-day-start','08:30'),create('span','pf25Surface-day-now','Now'),create('span','pf25Surface-day-end','16:30'));
  arc.append(head,rail,labels);return arc
}
function openMode(mode){window.__PACEFOLD_SPATIAL__?.go?.(mode)}
function buildFoldTray(){
  const tray=create('section','pf25Surface-fold-tray');tray.id='pf25Surface-fold-tray';
  const rail=create('header','pf25Surface-fold-head'),title=create('div');title.append(create('span','','Daybook'),create('strong','','Always within reach'));
  const actions=create('nav','pf25Surface-fold-tabs');actions.setAttribute('aria-label','Daybook shortcuts');
  for(const [label,mode] of [['Notes','notes'],['Day','worklog'],['Now','context'],['Settings','settings']]){const control=button('pf25Surface-fold-tab',`Open ${label}`,label);control.addEventListener('click',()=>openMode(mode));actions.append(control)}
  rail.append(title,actions);
  const body=create('div','pf25Surface-fold-body'),summary=create('div','pf25Surface-fold-summary'),latest=create('div','pf25Surface-fold-latest');summary.id='pf25Surface-fold-summary';latest.id='pf25Surface-fold-latest';body.append(summary,latest);tray.append(rail,body);return tray
}
function buildRhythmStrip(){
  const strip=create('section','pf25Surface-rhythm-strip');strip.id='pf25Surface-rhythm-strip';strip.setAttribute('aria-label','Today rhythm');strip.append(create('header','pf25Surface-rhythm-head'),create('div','pf25Surface-rhythm-items'));return strip
}
function buildInstrument(hero){
  if(id('pf25Surface-instrument'))return;
  const instrument=create('section','pf25Surface-instrument');instrument.id='pf25Surface-instrument';
  const dial=buildDial(),copy=create('div','pf25Surface-clock-copy');
  for(const selector of ['.pf25Spatial-home-mark','#pf25Spatial-time','#pf25Spatial-date','#pf25Spatial-status','#pf25Spatial-progress']){const node=hero.querySelector(selector);if(node)copy.append(node)}
  instrument.append(dial,copy);hero.prepend(instrument);
  const arc=buildDayArc();instrument.after(arc);
  const strip=buildRhythmStrip();arc.after(strip);
  const dock=id('pf25Actions-action-dock');if(dock)strip.after(dock);
  const tray=buildFoldTray();(dock||strip).after(tray);
  hero.querySelector('.pf25Spatial-context-glimpse')?.remove();hero.querySelector('.pf25Spatial-nav-hint')?.remove();
}
function buildSettingsOverview(){
  const card=$('.pf25Spatial-settings-card')||$('.pf25Spatial-settings-display')||$('.pf25Spatial-settings-layout');if(!card||id('pf25Surface-settings-overview'))return;
  const panel=create('section','pf25Surface-settings-overview');panel.id='pf25Surface-settings-overview';const head=create('header');head.append(create('span','','Essentials'),create('strong','','Set once. Pacefold remembers.'));panel.append(head);
  const grid=create('div','pf25Surface-settings-grid');
  const items=[['quiet','Quiet','Generic wording and fewer interruptions'],['seconds','Seconds','Keep the second hand alive'],['notifications','Cues','System cues when allowed'],['weather','Weather','Local context in Now']];
  for(const [key,label,detail] of items){const control=button('pf25Surface-setting',`Toggle ${label}`);control.dataset.setting=key;control.append(create('span','',label),create('small','',detail),create('i',''));control.addEventListener('click',()=>toggleSetting(key));grid.append(control)}
  panel.append(grid);card.prepend(panel)
}
function toggleSetting(key){
  const value=prefs();
  if(key==='quiet')window.__PACEFOLD_RHYTHM__?.quiet?.toggle?.();
  if(key==='seconds')patchPrefs({showSeconds:value.showSeconds===false});
  if(key==='notifications')patchPrefs({notifications:value.notifications===false});
  if(key==='weather'){const current=window.__PACEFOLD_PERSISTENCE__?.read?.()||{};window.__PACEFOLD_PERSISTENCE__?.write?.({...current,v21WeatherEnabled:current.v21WeatherEnabled===false})}
  renderSettings();window.__PACEFOLD_SPATIAL__?.refresh?.()
}
function renderSettings(){
  const value=prefs(),weather=window.__PACEFOLD_PERSISTENCE__?.read?.()||{},states={quiet:Boolean(value.quietMode),seconds:value.showSeconds!==false,notifications:value.notifications!==false,weather:weather.v21WeatherEnabled!==false&&value.v21WeatherEnabled!==false};
  for(const node of document.querySelectorAll('.pf25Surface-setting')){const active=Boolean(states[node.dataset.setting]);node.dataset.active=String(active);node.setAttribute('aria-pressed',String(active))}
}
function renderClock(now=new Date()){
  const value=prefs(),part=zoneParts(now,zoneName(value)),seconds=part.second,minutes=part.minute+seconds/60,hours=(part.hour%12)+minutes/60,dial=id('pf25Surface-dial');
  if(dial){dial.style.setProperty('--pf25Surface-hour',`${hours*30}deg`);dial.style.setProperty('--pf25Surface-minute',`${minutes*6}deg`);dial.style.setProperty('--pf25Surface-second',`${seconds*6}deg`);dial.dataset.seconds=String(value.showSeconds!==false)}
  const date=id('pf25Spatial-date');if(date)date.textContent=formatDate(now,value)
}
function renderDay(now=new Date()){
  const value=prefs(),part=zoneParts(now,zoneName(value)),hours=part.hour+part.minute/60+part.second/3600,range=workRange(value),progress=Math.max(0,Math.min(1,(hours-range.start)/(range.end-range.start))),arc=id('pf25Surface-day-arc');if(!arc)return;
  arc.style.setProperty('--pf25Surface-progress',String(progress));id('pf25Surface-day-percent').textContent=`${Math.round(progress*100)}%`;
  arc.querySelector('.pf25Surface-day-start').textContent=range.startText;arc.querySelector('.pf25Surface-day-end').textContent=range.endText;arc.dataset.state=hours<range.start?'before':hours>range.end?'complete':'active';
  const markers=id('pf25Surface-day-markers'),state=scheduleState(now,false,value),key=`${localKey(now,state.timeZone)}|${range.start}|${range.end}|${state.today.map(item=>`${item.id}:${item.hours.toFixed(3)}`).join('|')}`;
  if(markers.dataset.key!==key){markers.dataset.key=key;markers.replaceChildren();for(const item of state.today){if(item.hours<range.start||item.hours>range.end)continue;const marker=create('button','pf25Surface-day-marker');marker.type='button';marker.setAttribute('aria-label',`${item.label} at ${formatTime(item.date,value)}`);marker.style.setProperty('--marker',String((item.hours-range.start)/(range.end-range.start)));marker.dataset.source=item.id;marker.addEventListener('click',()=>openMode('context'));markers.append(marker)}}
}
function renderRhythm(now=new Date(),force=false){
  const strip=id('pf25Surface-rhythm-strip');if(!strip)return;const state=scheduleState(now,false),key=`${localKey(now,state.timeZone)}|${Math.floor(now.getTime()/60000)}|${state.value.profile}|${state.value.lat}|${state.value.lng}|${state.value.method}|${state.value.asr}|${state.timeZone}|${JSON.stringify(state.value.offsets||{})}`;
  if(!force&&key===lastScheduleKey)return;lastScheduleKey=key;
  const head=strip.querySelector('.pf25Surface-rhythm-head'),items=strip.querySelector('.pf25Surface-rhythm-items');head.replaceChildren();
  const copy=create('div');copy.append(create('span','',state.muslim?'Prayer rhythm':'Today’s rhythm'),create('strong','',state.next?`Next · ${state.next.label} ${formatTime(state.next.date,state.value)}`:'Today is complete'));
  const meta=create('small','',`${text(state.value.locationLabel)||state.timeZone} · ${state.muslim?(state.value.method==='18'?'18°':'15°')+' · '+(state.value.asr==='hanafi'?'Hanafi Asr':'Standard Asr'):'Custom moments'}`);copy.append(meta);
  const adjust=button('pf25Surface-rhythm-adjust','Open schedule settings','Adjust');adjust.addEventListener('click',()=>openMode('settings'));head.append(copy,adjust);
  items.replaceChildren();for(const item of state.today){const node=button('pf25Surface-rhythm-item',`${item.label} at ${formatTime(item.date,state.value)}`);node.dataset.state=item.date<now?'past':state.next?.id===item.id&&localKey(state.next.date,state.timeZone)===localKey(now,state.timeZone)?'next':'upcoming';node.append(create('span','',item.label),create('strong','',formatTime(item.date,state.value)));node.addEventListener('click',()=>openMode('context'));items.append(node)}
}
function renderFold(){
  const summary=id('pf25Surface-fold-summary'),latest=id('pf25Surface-fold-latest');if(!summary||!latest)return;const value=prefs(),allNotes=notes().slice().sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0)),today=localKey(),todayNotes=allNotes.filter(note=>String(note.date||'')===today),events=window.__PACEFOLD_DAYFLOW__?.events?.(today)||[],focus=(Number(window.__PACEFOLD_DAYFLOW__?.metrics?.(today)?.focus)||0)/60000;
  summary.replaceChildren();const cards=[['Notes',String(todayNotes.length),todayNotes.length===1?'today':'today','notes'],['Moments',String(events.length),'logged today','worklog'],['Focus',`${Math.round(Number(focus)||0)}m`,'protected time','worklog'],['Water',`${Number(value.waterSips)||0}/${Number(value.waterTarget)||24}`,'today','worklog']];
  for(const [label,count,detail,mode] of cards){const card=button('pf25Surface-fold-card',`Open ${label}`);card.append(create('span','',label),create('strong','',count),create('small','',detail));card.addEventListener('click',()=>openMode(mode));summary.append(card)}
  latest.replaceChildren();const head=create('header');head.append(create('span','','Latest notes'),button('pf25Surface-fold-add','Open Notes','Add note'));head.querySelector('button').addEventListener('click',()=>openMode('notes'));latest.append(head);
  const list=create('div','pf25Surface-fold-note-list');list.id='pf25Surface-fold-note-list';for(const note of allNotes.slice(0,3)){const row=button('pf25Surface-fold-note','Open this note in Notes');row.append(create('span','',new Date(note.updatedAt||note.createdAt||Date.now()).toLocaleDateString(undefined,{month:'short',day:'numeric'})),create('strong','',text(note.body||note.text||'Untitled note').slice(0,82)));row.addEventListener('click',()=>openMode('notes'));list.append(row)}if(!list.children.length)list.append(create('p','','Your first note will appear here.'));latest.append(list)
}
function renderVersion(){for(const node of document.querySelectorAll('.pf25Spatial-version'))node.textContent='Pacefold 25.0.0 · private local recovery'}
function compose(){
  const root=id('pf25Spatial-spatial-root'),hero=$('.pf25Spatial-clock-hero');if(!root||!hero)return false;root.dataset.experience=REVISION;root.dataset.release=RELEASE;document.body.dataset.pacefoldExperience=RELEASE;document.documentElement.dataset.pacefoldExperience=RELEASE;document.title='Pacefold — Quiet Workday Rhythm';
  buildInstrument(hero);buildSettingsOverview();renderVersion();
  const oldSchedule=id('pf25Actions-schedule-strip');if(oldSchedule)oldSchedule.hidden=true;
  const dock=id('pf25Actions-action-dock'),strip=id('pf25Surface-rhythm-strip'),tray=id('pf25Surface-fold-tray');if(dock&&strip&&dock.previousElementSibling!==strip)strip.after(dock);if(tray&&dock&&tray.previousElementSibling!==dock)dock.after(tray);
  return true
}
function refresh(force=false){if(!compose())return;const now=new Date();renderClock(now);renderDay(now);renderRhythm(now,force);renderFold();renderSettings()}
function tick(){const now=new Date();renderClock(now);renderDay(now);if(now.getMinutes()!==lastMinute){lastMinute=now.getMinutes();renderRhythm(now);renderFold()}}
function install(){
  if(mounted)return;if(!compose()){window.addEventListener('pacefold:spatial-ready',install,{once:true});return}mounted=true;
  refresh(true);clearInterval(tickTimer);tickTimer=setInterval(tick,1000);clearInterval(minuteTimer);minuteTimer=setInterval(()=>refresh(true),30000);
  for(const event of ['pacefold:storage-changed','pacefold:rhythm-prefs','pacefold:dayflow','pacefold:cue-queue','pacefold:experience-ready'])window.addEventListener(event,()=>refresh(true));
  new MutationObserver(()=>compose()).observe(document.body,{childList:true,subtree:true});
  const requested=new URLSearchParams(location.search).get('mode');if(['notes','worklog','context','settings'].includes(requested))setTimeout(()=>openMode(requested),250);
  window.__PACEFOLD_UNIFIED__={release:RELEASE,revision:REVISION,refresh:()=>refresh(true),schedule:(includeSunrise=true)=>scheduleState(new Date(),includeSunrise),go:openMode,zoneName};
  window.dispatchEvent(new CustomEvent('pacefold:unified-ready',{detail:{release:RELEASE,revision:REVISION}}));
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();
