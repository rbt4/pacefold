(() => {
'use strict';

const VERSION='15.7.0';
const ENTRY_KEY='pacefold.notebook.entries.v2';
const ERROR_KEY='pacefold.resilience.errors.v1';
const RECOVERY_PREFIX='pacefold.recovery.notebook.';
const GLOBAL_SYNC_LOCK='pacefold.resilience.lock.sync-page.v1';
const TAB_ID=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const LOCKS={
  'sync-page':8000,
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
let reconcileFrame=0;

function safeParse(raw,fallback){
  if(raw==null||raw==='')return fallback;
  try{return JSON.parse(raw);}catch{return fallback;}
}
function compactMessage(value){
  return String(value?.message||value||'Unknown Pacefold error')
    .replace(/https?:\/\/\S+/g,'[url]')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,320);
}
function recordError(kind,error){
  try{
    const current=safeParse(localStorage.getItem(ERROR_KEY),[]);
    const list=Array.isArray(current)?current:[];
    list.push({at:new Date().toISOString(),kind:String(kind||'runtime').slice(0,40),message:compactMessage(error),version:VERSION});
    localStorage.setItem(ERROR_KEY,JSON.stringify(list.slice(-20)));
  }catch{}
}
function pruneRecoveries(){
  try{
    const keys=[];
    for(let index=0;index<localStorage.length;index+=1){
      const key=localStorage.key(index);
      if(key?.startsWith(RECOVERY_PREFIX))keys.push(key);
    }
    keys.sort();
    for(const key of keys.slice(0,-3))localStorage.removeItem(key);
  }catch{}
}
function backupCorruptNotebook(raw,reason){
  const suffix=new Date().toISOString().replace(/[:.]/g,'-');
  const key=`${RECOVERY_PREFIX}${suffix}`;
  let location='none';
  try{localStorage.setItem(key,raw);location='localStorage';}
  catch{try{sessionStorage.setItem(key,raw);location='sessionStorage';}catch{}}
  try{localStorage.removeItem(ENTRY_KEY);}catch(error){recordError('notebook-remove',error);}
  try{localStorage.setItem('pacefold.resilience.recoveryNotice.v1',JSON.stringify({key,location,reason,at:new Date().toISOString(),version:VERSION}));}catch{}
  pruneRecoveries();
}
function validateNotebookStorage(){
  let raw;
  try{raw=localStorage.getItem(ENTRY_KEY);}catch(error){recordError('storage-read',error);return;}
  if(raw==null||raw==='')return;
  let parsed;
  try{parsed=JSON.parse(raw);}catch{backupCorruptNotebook(raw,'Invalid JSON');return;}
  if(!Array.isArray(parsed)){backupCorruptNotebook(raw,'Notebook data was not an array');return;}
  const valid=parsed.every(item=>item&&typeof item==='object'&&typeof item.body==='string');
  if(!valid){backupCorruptNotebook(raw,'Notebook entries failed schema validation');return;}
  let changed=false;
  const normalized=parsed.map(item=>{
    if(typeof item.section==='string'&&item.section.trim())return item;
    changed=true;
    return {...item,section:'Daily'};
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
    return Boolean(lock&&lock.owner!==TAB_ID&&Number(lock.until)>now);
  }catch{return false;}
}
function claimGlobalSyncLock(until){try{localStorage.setItem(GLOBAL_SYNC_LOCK,JSON.stringify({owner:TAB_ID,until}));}catch{}}
function releaseGlobalSyncLock(){
  try{
    const lock=safeParse(localStorage.getItem(GLOBAL_SYNC_LOCK),null);
    if(lock?.owner===TAB_ID)localStorage.removeItem(GLOBAL_SYNC_LOCK);
  }catch{}
}
function block(event){event.preventDefault();event.stopImmediatePropagation();}
function lockAction(event){
  const control=event.target.closest?.('[data-pf-action]');
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
installStyles();
document.addEventListener('click',lockAction,true);
document.addEventListener('submit',lockSubmit,true);
window.addEventListener('error',event=>{if(relevantError(event.error||event.message))recordError('error',event.error||event.message);});
window.addEventListener('unhandledrejection',event=>{if(relevantError(event.reason))recordError('rejection',event.reason);});
window.addEventListener('online',queueReconcile);
window.addEventListener('pageshow',queueReconcile);
window.addEventListener('pagehide',releaseGlobalSyncLock);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueReconcile();});
window.addEventListener('storage',event=>{if(event.key===ENTRY_KEY||event.key===ERROR_KEY||event.key===GLOBAL_SYNC_LOCK)queueReconcile();});

window.__PACEFOLD_RESILIENCE__={version:VERSION,validateNotebookStorage,queueReconcile,recordError};
})();
