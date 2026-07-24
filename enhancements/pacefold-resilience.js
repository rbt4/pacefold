(() => {
'use strict';

const VERSION='15.7.1';
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
  const root=element.closest('#pf-hub-root')||document;
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
  document.querySelectorAll(`#pf-hub-root [data-pf-action="${action}"]`).forEach(control=>{
    control.removeAttribute('aria-busy');
    control.classList.remove('pf-resilience-busy');
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
    control.classList.add('pf-resilience-busy');
  });
  setTimeout(()=>{
    if(clickLocks.get(key)<=Date.now())clickLocks.delete(key);
    if(action==='sync-page')releaseGlobalSyncLock();
    if(control.isConnected){
      control.removeAttribute('aria-busy');
      control.classList.remove('pf-resilience-busy');
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
function installStyles(){
  if(document.getElementById('pf-resilience-style'))return;
  const style=document.createElement('style');
  style.id='pf-resilience-style';
  style.textContent=`#pf-hub-root .pf-resilience-busy{opacity:.72;cursor:progress}#pf-hub-root [aria-busy="true"]{pointer-events:none}`;
  document.head.append(style);
}
function relevantError(value){
  const text=String(value?.stack||value?.message||value||'');
  return /pacefold|pf-hub|pf-notebook|pf-resilience/i.test(text);
}

validateNotebookStorage();
pruneRecoveries();
installStyles();
pollForOneNoteAdapter();
document.addEventListener('click',lockAction,true);
document.addEventListener('submit',lockSubmit,true);
window.addEventListener('error',event=>{if(relevantError(event.error||event.message))recordError('error',event.error||event.message);});
window.addEventListener('unhandledrejection',event=>{if(relevantError(event.reason))recordError('rejection',event.reason);});
window.addEventListener('online',queueReconcile);
window.addEventListener('pageshow',()=>{queueReconcile();pollForOneNoteAdapter();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){queueReconcile();pollForOneNoteAdapter();}});
window.addEventListener('storage',event=>{if(event.key===ENTRY_KEY||event.key===ERROR_KEY||event.key===GLOBAL_SYNC_LOCK)queueReconcile();});

window.__PACEFOLD_RESILIENCE__={version:VERSION,validateNotebookStorage,queueReconcile,recordError,installOneNoteGuard,clearAction};
})();
