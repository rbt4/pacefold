(() => {
'use strict';

const REVISION='15.9.0';
const ROOT_ID='pf-hub-root';
const DOCK_ID='pf-flow-dock';
const WORK_OVERRIDE_KEY='pacefold.flow.work-hours.v1';
const SYNC_LOCK_KEY='pacefold.resilience.lock.sync-page.v1';
const TEXT_REPLACEMENTS=new Map([
  ['Capture to the HSSys notebook','Add a note'],
  ['HSSys notebook','Notes'],
  ['Open Pacefold notebook','Open Pacefold notes'],
  ['Open notebook','Open notes'],
  ['Notebook','Notes'],
  ['HSSys','Notes'],
  ['Contained playback','Mini player'],
  ['One day, gently folded.','Notes above. Music below.'],
  ['Quiet taskbar','Clear reminder'],
  ['Taskbar attention pending','Reminder waiting']
]);

let root=null;
let dock=null;
let observer=null;
let frame=0;
let workTimer=0;
let notificationTimer=0;
let statusTimer=0;
let workCache={at:0,value:{configured:false,active:true,start:null,end:null,label:'Work hours follow Pacefold setup'}};
const originalSetBadge=typeof navigator.setAppBadge==='function'?navigator.setAppBadge.bind(navigator):null;
const originalClearBadge=typeof navigator.clearAppBadge==='function'?navigator.clearAppBadge.bind(navigator):null;

function safeParse(raw,fallback){try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
function compact(value){return String(value||'').replace(/\s+/g,' ').trim();}
function report(kind,error){try{window.__PACEFOLD_RESILIENCE__?.recordError?.(`revamp-${kind}`,error);}catch{}}
function guarded(kind,fn){return function(...args){try{return fn.apply(this,args);}catch(error){report(kind,error);return undefined;}};}
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
  if(!force&&Date.now()-workCache.at<30000)return workCache.value;
  const startNames=new Set(['workstart','workdaystart','daystart','shiftstart','starttime','workhoursstart','workfrom','officehoursstart']);
  const endNames=new Set(['workend','workdayend','dayend','shiftend','endtime','workhoursend','workto','officehoursend']);
  const candidates=[];
  try{const override=safeParse(localStorage.getItem(WORK_OVERRIDE_KEY),null);if(override)candidates.push({source:'Pacefold override',value:override});}catch{}
  try{
    for(let index=0;index<localStorage.length;index+=1){
      const key=localStorage.key(index);if(!key||!key.toLowerCase().includes('pacefold'))continue;
      const value=safeParse(localStorage.getItem(key),null);if(value&&typeof value==='object')candidates.push({source:key,value});
    }
  }catch{}
  const dataset={workStart:root?.dataset?.workStart,workEnd:root?.dataset?.workEnd};
  if(dataset.workStart||dataset.workEnd)candidates.unshift({source:'Pacefold screen',value:dataset});
  let match=null;
  for(const candidate of candidates){
    const start=findTime(candidate.value,startNames),end=findTime(candidate.value,endNames);
    if(start!=null&&end!=null){match={...candidate,start,end,days:findDays(candidate.value)};break;}
  }
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
  try{Object.defineProperty(navigator,'setAppBadge',{configurable:true,value:async()=>{const work=readWorkWindow();if(!work.active){await clearBadge();return;}return originalSetBadge();}});}catch{try{navigator.setAppBadge=async()=>{const work=readWorkWindow();if(!work.active){await clearBadge();return;}return originalSetBadge();};}catch{}}
}
function showStatus(message,tone='neutral'){
  const node=dock?.querySelector('[data-pf-flow-status]');if(!node)return;
  clearTimeout(statusTimer);node.textContent=message;node.dataset.tone=tone;node.hidden=false;
  statusTimer=setTimeout(()=>{if(node.isConnected)node.hidden=true;},4200);
}
function originalAction(name){return [...(root?.querySelectorAll('[data-pf-action]:not([data-pf-flow-proxy])')||[])].find(control=>control.dataset.pfAction===name)||null;}
function waitForSyncAction(timeout=10000){
  return new Promise(resolve=>{
    const immediate=originalAction('sync-page');if(immediate)return resolve(immediate);
    let done=false;
    const finish=value=>{if(done)return;done=true;watcher.disconnect();clearInterval(poll);clearTimeout(deadline);resolve(value);};
    const watcher=new MutationObserver(()=>{const action=originalAction('sync-page');if(action)finish(action);});
    watcher.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled','class','data-view','data-screen']});
    const poll=setInterval(()=>{const action=originalAction('sync-page');if(action)finish(action);},180);
    const deadline=setTimeout(()=>finish(null),timeout);
  });
}
async function syncOneNote(event){
  event?.preventDefault?.();event?.stopImmediatePropagation?.();
  const lock=safeParse(localStorage.getItem(SYNC_LOCK_KEY),null);
  if(lock&&Number(lock.until)>Date.now()){showStatus('OneNote is already syncing.','neutral');return;}
  let action=originalAction('sync-page');
  if(!action){
    const notes=originalAction('open-notebook');
    if(!notes){showStatus('Notes are unavailable, so OneNote cannot sync.','warning');return;}
    showStatus('Opening Notes and preparing OneNote…');notes.click();action=await waitForSyncAction(10000);
  }
  if(!action){showStatus('OneNote did not become ready. Open Notes, connect Microsoft, then try again.','warning');return;}
  action.click();showStatus('OneNote sync started. Your local notes remain saved either way.','success');
}
function replaceVisibleCopy(){
  if(!root)return;
  const nodes=root.querySelectorAll('button,span,p,small,strong,b,label,div,h1,h2,h3,h4');
  for(const node of nodes){if(node.children.length)continue;const text=compact(node.textContent),replacement=TEXT_REPLACEMENTS.get(text);if(replacement&&node.textContent!==replacement)node.textContent=replacement;}
  for(const node of root.querySelectorAll('[aria-label],[title]')){
    for(const attribute of ['aria-label','title']){
      const value=node.getAttribute(attribute);if(!value)continue;
      const next=value.replace(/HSSys notebook/gi,'Notes').replace(/Pacefold notebook/gi,'Pacefold notes').replace(/Open notebook/gi,'Open notes');
      if(next!==value)node.setAttribute(attribute,next);
    }
  }
}
function ensureTopWindow(){
  if(!dock)return;
  dock.dataset.revision=REVISION;
  dock.setAttribute('aria-label','Pacefold notes and player dock');
  const bar=dock.querySelector('.pf-flow-bar');if(!bar)return;
  let title=bar.querySelector('[data-pf-revamp-title]');
  if(!title){
    title=document.createElement('div');title.className='pf-revamp-title';title.dataset.pfRevampTitle='true';title.innerHTML='<strong>Notes</strong><small data-pf-revamp-hours>Work hours follow Pacefold setup</small>';
    const cue=bar.querySelector('[data-pf-flow-cue]');bar.insertBefore(title,cue||bar.children[1]||null);
  }
  let sync=bar.querySelector('[data-pf-revamp-sync]');
  if(!sync){
    sync=document.createElement('button');sync.type='button';sync.className='pf-revamp-sync';sync.dataset.pfRevampSync='true';sync.setAttribute('aria-label','Sync current notes page to OneNote');sync.innerHTML='<span aria-hidden="true">↥</span><small>OneNote</small>';
    sync.addEventListener('click',guarded('sync',syncOneNote),true);
    bar.insertBefore(sync,bar.querySelector('[data-pf-flow-more]'));
  }
  for(const media of bar.querySelectorAll('[data-pf-flow-tool="media"]'))media.dataset.pfRevampTopMedia='true';
  const input=bar.querySelector('[data-pf-flow-input]');if(input)input.placeholder='Write a note…';
  const panelTitle=dock.querySelector('[data-pf-flow-primary]');if(panelTitle)panelTitle.textContent='Notes above. Music below.';
  for(const button of dock.querySelectorAll('[data-pf-flow-sync]')){
    if(button.dataset.pfRevampBound==='true')continue;button.dataset.pfRevampBound='true';button.addEventListener('click',guarded('sync',syncOneNote),true);
  }
}
function preparePlayer(){
  for(const player of root?.querySelectorAll('.pf-player-row')||[]){player.dataset.pfRevampPlayer='true';player.removeAttribute('aria-hidden');}
}
function applyWorkState(){
  const work=readWorkWindow();document.documentElement.classList.toggle('pf-revamp-offhours',!work.active);
  const hours=dock?.querySelector('[data-pf-revamp-hours]');if(hours)hours.textContent=work.configured?(work.active?`Working · ${work.label}`:`Off hours · ${work.label}`):work.label;
  if(!work.active){clearBadge();closeNotifications();}
  else{
    clearTimeout(notificationTimer);
    notificationTimer=setTimeout(()=>{notificationTimer=0;closeNotifications();},8000);
  }
  const taskbar=dock?.querySelector('[data-pf-flow-taskbar]');if(taskbar&&!work.active)taskbar.textContent='Off hours';
  try{navigator.serviceWorker?.controller?.postMessage?.({type:'PACEFOLD_WORK_STATE',active:work.active,configured:work.configured,start:work.start,end:work.end,at:Date.now()});}catch{}
}
function reconcile(){
  const nextRoot=document.getElementById(ROOT_ID),nextDock=document.getElementById(DOCK_ID);
  if(!nextRoot||!nextDock)return;
  root=nextRoot;dock=nextDock;replaceVisibleCopy();ensureTopWindow();preparePlayer();applyWorkState();
}
function queue(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;try{reconcile();}catch(error){report('reconcile',error);}});}
function bindObserver(){
  observer?.disconnect();observer=new MutationObserver(mutations=>{if(mutations.length&&mutations.every(item=>item.target instanceof Element&&item.target.closest?.('[data-pf-revamp-title],[data-pf-revamp-sync]')))return;queue();});
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-hidden','disabled','data-view','data-screen','data-theme']});
}

installBadgePolicy();bindObserver();
window.addEventListener('focus',guarded('focus',()=>{workCache.at=0;applyWorkState();}));
window.addEventListener('storage',event=>{if(event.key?.startsWith('pacefold.')){workCache.at=0;queue();}});
window.addEventListener('pacefold:storage-changed',()=>{workCache.at=0;queue();});
[0,100,300,800,1800].forEach(delay=>setTimeout(queue,delay));
workTimer=setInterval(guarded('work-hours',()=>{if(document.visibilityState==='visible'){workCache.at=0;queue();}}),30000);
window.__PACEFOLD_REVAMP__={revision:REVISION,reconcile:queue,readWorkWindow,syncOneNote};
})();