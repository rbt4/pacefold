(()=>{
'use strict';
const RELEASE='24.0.0';
const REVISION='unified-r1';
const PREFS_KEY='pacefoldPrefsV15';
const PRIORITY={prayer:90,lunch:75,noodle:70,away:65,body:50,eyes:45,water:35,flow:30};
const pending=new Map();
const delivered=new Set();
let pumpTimer=0,lastDeliveredAt=0,badgeKey='';
const nativeSetBadge=typeof navigator.setAppBadge==='function'?navigator.setAppBadge.bind(navigator):null;
const nativeClearBadge=typeof navigator.clearAppBadge==='function'?navigator.clearAppBadge.bind(navigator):null;
const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
const clone=value=>{try{return JSON.parse(JSON.stringify(value))}catch{return value}};
const core=()=>window.__PACEFOLD_MA_CORE__||null;
function prefs(){return core()?.getPrefs?.()||parse(localStorage.getItem(PREFS_KEY),{})||{}}
function emit(){
  window.dispatchEvent(new CustomEvent('pacefold:rhythm-prefs',{detail:{release:RELEASE,revision:REVISION}}));
  window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:PREFS_KEY,source:'v24-kernel'}}));
}
function patchPrefs(patch){
  if(!patch||typeof patch!=='object')return prefs();
  let next;
  if(core()?.updatePrefs)next=core().updatePrefs(patch);
  else{next={...prefs(),...patch};localStorage.setItem(PREFS_KEY,JSON.stringify(next))}
  emit();return next||prefs();
}
function setQuiet(on){
  const current=prefs(),active=Boolean(on);
  const patch=active&&!current.quietMode?
    {quietMode:true,quietRestore:{privacy:current.privacy,clarity:current.clarity,notificationDetail:current.notificationDetail,notificationMode:current.notificationMode},privacy:true,clarity:'discreet',notificationDetail:'generic',notificationMode:'quiet'}:
    !active&&current.quietMode?
      {quietMode:false,quietRestore:null,privacy:current.quietRestore?.privacy??current.privacy,clarity:current.quietRestore?.clarity||'discreet',notificationDetail:current.quietRestore?.notificationDetail||'generic',notificationMode:current.quietRestore?.notificationMode||'quiet'}:
      {quietMode:active};
  patchPrefs(patch);applyQuiet();return Boolean(prefs().quietMode);
}
function applyQuiet(){
  const active=Boolean(prefs().quietMode);
  document.body.dataset.quiet=String(active);
  const root=document.getElementById('pf22-spatial-root');if(root)root.dataset.quiet=String(active);
  for(const node of document.querySelectorAll('#pf22-quiet,[data-setting="quiet"]')){node.dataset.active=String(active);node.setAttribute('aria-pressed',String(active))}
  return active;
}
const quiet={get:()=>Boolean(prefs().quietMode),set:setQuiet,toggle:()=>setQuiet(!prefs().quietMode),apply:applyQuiet};
function schedulePump(delay=0){clearTimeout(pumpTimer);pumpTimer=setTimeout(pump,Math.max(0,delay))}
async function pump(){
  pumpTimer=0;
  const now=Date.now(),current=prefs();
  for(const [key,item] of pending)if(item.expiresAt<=now)pending.delete(key);
  const item=[...pending.values()].sort((a,b)=>b.priority-a.priority||a.requestedAt-b.requestedAt)[0];
  if(!item){patchPrefs({waitingCue:null});return}
  const gap=Math.max(1,Number(current.minCueGap)||4)*60000,remaining=lastDeliveredAt?gap-(now-lastDeliveredAt):0;
  if(remaining>0){patchPrefs({waitingCue:{key:item.key,source:item.source,requestedAt:item.requestedAt,expiresAt:item.expiresAt}});schedulePump(Math.min(remaining,item.expiresAt-now));return}
  const deliver=window.__PACEFOLD_MA_DELIVER__;
  if(typeof deliver!=='function'){schedulePump(100);return}
  pending.delete(item.key);delivered.add(item.key);
  let ok=false;try{ok=await deliver(item.key,item.text,item.source,false,item.specOnly)}catch{}
  if(ok){lastDeliveredAt=Date.now();patchPrefs({rhythmLastCueAt:lastDeliveredAt,waitingCue:null})}else patchPrefs({waitingCue:null});
  queueMicrotask(pump);
}
function request(key,textValue,source='prayer',test=false,specOnly=false){
  if(test)return false;
  const token=String(key||'');if(!token||delivered.has(token)||pending.has(token))return false;
  const safe=Object.hasOwn(PRIORITY,source)?source:'prayer',now=Date.now(),current=prefs();
  if(current.quietMode&&['water','eyes','body'].includes(safe))return false;
  const item={key:token,text:String(textValue||''),source:safe,specOnly:Boolean(specOnly),priority:PRIORITY[safe],requestedAt:now,expiresAt:now+Math.max(5,Number(current.dueWindow)||18)*60000};
  pending.set(token,item);patchPrefs({waitingCue:{key:item.key,source:item.source,requestedAt:item.requestedAt,expiresAt:item.expiresAt}});queueMicrotask(pump);return true;
}
async function clearSurface(){
  pending.clear();patchPrefs({waitingCue:null});
  try{await nativeClearBadge?.()}catch{}
  try{const registration=await navigator.serviceWorker?.getRegistration?.(),items=await registration?.getNotifications?.();for(const item of items||[])if(String(item.tag||'').startsWith('pacefold-'))item.close()}catch{}
  badgeKey='';return true;
}
async function setManualBadge(value){
  const current=prefs();if(current.taskbarBadge===false||current.taskbarBadgeMode==='off')return clearSurface();
  try{return value==null?await nativeSetBadge?.():await nativeSetBadge?.(value)}catch{return undefined}
}
function updateBadge(attention){
  const count=Number(window.__PACEFOLD_CUES__?.count?.())||0,current=prefs();
  const waiting=Boolean(count||attention&&['due','pending','active'].includes(attention.signal));
  const key=waiting?`waiting:${count||attention?.source||'rhythm'}`:'clear';if(key===badgeKey)return true;badgeKey=key;
  if(current.taskbarBadge===false||current.taskbarBadgeMode==='off'||!waiting)void clearSurface();else void setManualBadge(count>1?count:null);
  return true;
}
const scheduler={request,clear:clearSurface,setManualBadge,updateBadge,reanchor:()=>{for(const [key,item] of pending)if(['water','eyes','body'].includes(item.source))pending.delete(key);schedulePump()},_pending:pending};
function download(name,type,content){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1200)
}
function backupPayload(context={}){
  const snapshot=typeof context.snapshot==='function'?context.snapshot():{};
  return{format:'pacefold.backup.v2',release:RELEASE,exportedAt:new Date().toISOString(),prefs:clone(prefs()),entries:clone(snapshot.entries||[]),categories:clone(snapshot.categories||[]),playlistDefinitions:clone(snapshot.playlists||[]),streamingLinks:clone(snapshot.streamLinks||[])};
}
function exportBackup(context={},showStatus){
  const payload=backupPayload(context),day=new Date().toISOString().slice(0,10);download(`pacefold-backup-${day}.json`,'application/json',JSON.stringify(payload,null,2));showStatus?.('Local backup downloaded.','success');return payload
}
async function restoreBackup(file,context={},showStatus){
  const data=JSON.parse(await file.text());if(!Array.isArray(data.entries))throw new Error('Backup format is not supported.');
  if(typeof confirm==='function'&&!confirm(`Restore ${data.entries.length} notes and saved settings from this backup?`))return false;
  if(data.prefs&&typeof data.prefs==='object')patchPrefs(data.prefs);
  context.apply?.({entries:data.entries,categories:Array.isArray(data.categories)?data.categories:[],playlists:Array.isArray(data.playlistDefinitions)?data.playlistDefinitions:[],streamLinks:Array.isArray(data.streamingLinks)?data.streamingLinks:[]});
  showStatus?.('Backup restored on this device.','success');return true
}
const backup={exportBackup,restoreBackup,payload:backupPayload};
async function estimateStorage(){try{return await navigator.storage?.estimate?.()||null}catch{return null}}
async function allowAudioImport(files){
  const estimate=await estimateStorage();if(!estimate?.quota)return true;
  const incoming=[...(files||[])].reduce((sum,file)=>sum+(Number(file.size)||0),0);return Number(estimate.usage||0)+incoming<Math.min(estimate.quota*.85,estimate.quota-20*1048576)
}
const storage={estimate:estimateStorage,allowAudioImport};
function rhythmMarkdown(date=new Date()){
  const current=prefs(),day=date.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'}),lines=[`# Pacefold — ${day}`,''];
  lines.push(`- Water: ${Number(current.waterSips)||0}/${Number(current.waterTarget)||24}`);
  lines.push(`- Rest sessions: ${(current.awaySessions||[]).length}`);
  lines.push(`- Meal sessions: ${(current.lunchSessions||[]).length}`);
  return `${lines.join('\n')}\n`
}
window.__PACEFOLD_RHYTHM__={release:RELEASE,revision:REVISION,prefs,patchPrefs,quiet,scheduler,backup,storage,rhythmMarkdown};
// Compatibility aliases keep the verified engine and older local data adapters working,
// while the public release no longer loads the former Ma product layer.
window.__PACEFOLD_MA_QUIET__=quiet;
window.__PACEFOLD_MA_SCHEDULER__=scheduler;
window.__PACEFOLD_MA_BACKUP__=backup;
window.__PACEFOLD_MA_STORAGE__=storage;
window.__PACEFOLD_MA_EXPORT__={rhythmMarkdown};
try{Object.defineProperty(window,'__PACEFOLD_CORE__',{configurable:true,get:()=>window.__PACEFOLD_MA_CORE__})}catch{}
window.addEventListener('pacefold:spatial-ready',applyQuiet);
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',applyQuiet,{once:true}):applyQuiet();
})();
