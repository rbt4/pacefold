(() => {
'use strict';

const VERSION='15.7.0';
const ENTRY_KEY='pacefold.notebook.entries.v2';
const ERROR_KEY='pacefold.resilience.errors.v1';
const RECOVERY_PREFIX='pacefold.recovery.notebook.';
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
function recordError(kind,error){
  try{
    const current=safeParse(localStorage.getItem(ERROR_KEY),[]);
    const list=Array.isArray(current)?current:[];
    list.push({
      at:new Date().toISOString(),
      kind:String(kind||'runtime').slice(0,40),
      message:String(error?.message||error||'Unknown Pacefold error').slice(0,500),
      version:VERSION
    });
    localStorage.setItem(ERROR_KEY,JSON.stringify(list.slice(-20)));
  }catch{}
}
function backupCorruptNotebook(raw,reason){
  try{
    const suffix=new Date().toISOString().replace(/[:.]/g,'-');
    const key=`${RECOVERY_PREFIX}${suffix}`;
    localStorage.setItem(key,raw);
    localStorage.setItem('pacefold.resilience.recoveryNotice.v1',JSON.stringify({key,reason,at:new Date().toISOString(),version:VERSION}));
    localStorage.removeItem(ENTRY_KEY);
  }catch(error){recordError('notebook-recovery',error);}
}
function validateNotebookStorage(){
  let raw;
  try{raw=localStorage.getItem(ENTRY_KEY);}catch(error){recordError('storage-read',error);return;}
  if(raw==null||raw==='')return;
  let parsed;
  try{parsed=JSON.parse(raw);}catch{backupCorruptNotebook(raw,'Invalid JSON');return;}
  if(!Array.isArray(parsed)){backupCorruptNotebook(raw,'Notebook data was not an array');return;}
  const valid=parsed.every(item=>item&&typeof item==='object'&&typeof item.body==='string'&&typeof item.section==='string');
  if(!valid)backupCorruptNotebook(raw,'Notebook entries failed schema validation');
}
function queueReconcile(){
  if(reconcileFrame)return;
  reconcileFrame=requestAnimationFrame(()=>{
    reconcileFrame=0;
    try{window.__PACEFOLD_SURFACE__?.reconcile?.();}catch(error){recordError('reconcile',error);}
  });
}
function actionKey(element){
  const action=element?.dataset?.pfAction;
  if(!action)return '';
  const id=element.dataset.pfId||element.closest('[data-pf-id]')?.dataset.pfId||'';
  return `${action}:${id}`;
}
function lockAction(event){
  const control=event.target.closest?.('[data-pf-action]');
  if(!control)return;
  const action=control.dataset.pfAction;
  const duration=LOCKS[action];
  if(!duration)return;
  const key=actionKey(control);
  const now=Date.now();
  const until=clickLocks.get(key)||0;
  if(until>now){
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  clickLocks.set(key,now+duration);
  queueMicrotask(()=>{
    if(!control.isConnected)return;
    control.setAttribute('aria-busy','true');
    control.classList.add('pf-resilience-busy');
  });
  setTimeout(()=>{
    if(clickLocks.get(key)<=Date.now())clickLocks.delete(key);
    if(control.isConnected){
      control.removeAttribute('aria-busy');
      control.classList.remove('pf-resilience-busy');
    }
  },duration+30);
}
function lockSubmit(event){
  const form=event.target;
  if(!(form instanceof HTMLFormElement)||!form.matches('[data-pf-capture-form]'))return;
  const now=Date.now();
  const until=submitLocks.get(form)||0;
  if(until>now){
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  submitLocks.set(form,now+1000);
}
function installStyles(){
  if(document.getElementById('pf-resilience-style'))return;
  const style=document.createElement('style');
  style.id='pf-resilience-style';
  style.textContent=`
    #pf-hub-root .pf-resilience-busy{opacity:.72;cursor:progress}
    #pf-hub-root [aria-busy="true"]{pointer-events:none}
  `;
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
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueReconcile();});
window.addEventListener('storage',event=>{
  if(event.key===ENTRY_KEY||event.key===ERROR_KEY)queueReconcile();
});

window.__PACEFOLD_RESILIENCE__={version:VERSION,validateNotebookStorage,queueReconcile};
})();
