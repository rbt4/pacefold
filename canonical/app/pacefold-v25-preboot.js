/* Pacefold 25.0.0 cleanroom-r1 compatibility consolidation. */
(() => {
  'use strict';

  const RELEASE='25.0.0';
  const PREFS_KEY='pacefoldPrefsV15';
  const SNAPSHOT_KEY='pacefold.v21.preferences.v1';
  const ONBOARDED_KEY='pacefoldOnboardedV15';
  const DISMISSED_KEY='pacefoldSetupDismissedV15';

  if(!window.__PACEFOLD_TITLE_GUARD__){
    const prototypes=[window.HTMLDocument?.prototype,window.Document?.prototype].filter(Boolean);
    const descriptor=prototypes.map(prototype=>Object.getOwnPropertyDescriptor(prototype,'title')).find(value=>value?.get&&value?.set);
    if(descriptor){
      window.__PACEFOLD_TITLE_GUARD__=true;
      Object.defineProperty(document,'title',{
        configurable:true,
        get:()=>descriptor.get.call(document),
        set:value=>{
          const next=String(value??'');
          if(descriptor.get.call(document)!==next)descriptor.set.call(document,next);
        }
      });
    }
  }

  const NativeMutationObserver=window.MutationObserver;
  if(NativeMutationObserver&&!window.__PACEFOLD_SPATIAL_OBSERVER_GUARD__){
    window.__PACEFOLD_SPATIAL_OBSERVER_GUARD__=true;
    window.MutationObserver=class PacefoldSpatialMutationObserver extends NativeMutationObserver{
      constructor(callback){
        let instance=null;
        super(records=>{
          const filtered=records.filter(record=>{
            const target=record.target instanceof Element?record.target:record.target?.parentElement;
            return !target?.closest?.('#pf25Spatial-spatial-root');
          });
          if(filtered.length)callback(filtered,instance);
        });
        instance=this;
      }
    };
  }

  window.addEventListener('pacefold:spatial-ready',()=>{
    const root=document.getElementById('pf25Spatial-spatial-root');
    if(!root||!NativeMutationObserver)return;
    const apply=()=>{
      const active=root.dataset.mode||'home';
      for(const face of root.querySelectorAll('.pf25Spatial-face')){
        const enabled=face.dataset.face===active;
        face.inert=!enabled;
        face.setAttribute('aria-hidden',String(!enabled));
      }
    };
    apply();
    const modeObserver=new NativeMutationObserver(apply);
    modeObserver.observe(root,{attributes:true,attributeFilter:['data-mode']});
    root.__pacefoldSpatialModeObserver=modeObserver;

    const read=id=>String(document.getElementById(id)?.textContent||'').replace(/\s+/g,' ').trim();
    const formatStatus=value=>{
      const parts=['statusWord','eventTime','relativeTime','eventName'].map(read).filter(Boolean);
      if(parts.length>=2)return parts.join(' · ');
      const raw=String(value??'').replace(/\s+/g,' ').trim();
      if(raw.includes(' · '))return raw;
      const match=raw.match(/^(Overdue|Next|Now|Soon|Snoozed)(\d{1,2}:\d{2}\s*(?:AM|PM)?)(.*?)(Fajr|Sunrise|Dhuhr|Asr|Maghrib|Isha)$/i);
      return match?[match[1],match[2],match[3],match[4]].map(item=>item.trim()).filter(Boolean).join(' · '):raw||'Workday in progress';
    };
    const target=document.getElementById('pf25Spatial-status');
    const textDescriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
    if(target&&textDescriptor?.get&&textDescriptor?.set&&!target.__pacefoldStatusGuard){
      target.__pacefoldStatusGuard=true;
      Object.defineProperty(target,'textContent',{
        configurable:true,
        get:()=>textDescriptor.get.call(target),
        set:value=>{
          const next=formatStatus(value);
          if(textDescriptor.get.call(target)!==next)textDescriptor.set.call(target,next);
        }
      });
    }

    let statusFrame=0;
    const syncStatus=()=>{
      if(statusFrame)return;
      statusFrame=requestAnimationFrame(()=>{
        statusFrame=0;
        if(!target)return;
        target.textContent=formatStatus(target.textContent);
      });
    };
    const source=document.getElementById('statusLine');
    if(source){
      const statusObserver=new NativeMutationObserver(syncStatus);
      statusObserver.observe(source,{subtree:true,childList:true,characterData:true});
      root.__pacefoldSpatialStatusObserver=statusObserver;
    }
    syncStatus();
    root.__pacefoldSpatialStatusTimer=setInterval(syncStatus,1000);
  },{once:true});

  const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}};
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  const meaningful=value=>{
    const prefs=object(value);
    if(!prefs)return false;
    const keys=Object.keys(prefs);
    return keys.length>=4&&Boolean(
      prefs.profile||prefs.schemaVersion||prefs.workHours||prefs.workWeek||
      prefs.locationLabel||prefs.theme||prefs.sipCadence||prefs.waterTarget
    );
  };
  const filtered=value=>{
    const result={};
    for(const [key,item] of Object.entries(object(value)||{})){
      if(/(?:auth|token|secret|password|oneNoteClient|oneNoteTenant|oneNoteNotebook|oneNoteSection|oneNotePages|oneNoteLast)/i.test(key))continue;
      result[key]=item;
    }
    return result;
  };

  let prefs=object(parse(localStorage.getItem(PREFS_KEY),null));
  const snapshot=object(parse(localStorage.getItem(SNAPSHOT_KEY),null));
  let restored=false;

  if(!meaningful(prefs)&&meaningful(snapshot?.prefs)){
    prefs=filtered(snapshot.prefs);
    try{localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));restored=true;}catch{}
  }

  const completedSetup=localStorage.getItem(ONBOARDED_KEY)==='1'||
    localStorage.getItem(DISMISSED_KEY)==='1'||
    localStorage.getItem('pacefoldOnboardedV14')==='1'||
    localStorage.getItem('pacefoldSetupDismissedV14')==='1';
  const returning=meaningful(prefs)&&Boolean(completedSetup||meaningful(snapshot?.prefs));
  if(returning){
    try{
      localStorage.setItem(ONBOARDED_KEY,'1');
      localStorage.setItem(DISMISSED_KEY,'1');
      localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({version:RELEASE,savedAt:new Date().toISOString(),prefs:filtered(prefs)}));
    }catch{}
    document.documentElement.classList.add('pf25Flow-returning');
  }

  document.documentElement.dataset.pacefoldExperience=RELEASE;
  window.__PACEFOLD_STARTUP__={release:RELEASE,returning,restored,meaningful};
})();
;
(()=>{
'use strict';
const RELEASE='25.0.0';
const REVISION='experience-r1';
const HTML=document.documentElement;
const FLAGS=['pacefoldOnboardedV15','pacefoldSetupDismissedV15','pacefoldOnboardedV14','pacefoldSetupDismissedV14'];
const PREF_KEYS=['pacefoldPrefsV15','pacefoldPrefsV14','pacefoldPrefsV13','pacefoldPrefsV12','pacefoldPrefsV11','desklinePrefsV8','desklinePrefs','quietClockPrefs'];
const has=value=>{try{return localStorage.getItem(value)!=null}catch{return false}};
const returning=FLAGS.some(key=>{try{return localStorage.getItem(key)==='1'}catch{return false}})||PREF_KEYS.some(has);
let observer=null,released=false;
function publish(){
  const current=window.__PACEFOLD_STARTUP__||{};
  window.__PACEFOLD_STARTUP__={...current,release:current.release||RELEASE,returning:returning||Boolean(current.returning),bootstrap:REVISION};
  window.__PACEFOLD_BOOTSTRAP__={release:RELEASE,revision:REVISION,returning};
}
function hold(){
  if(!returning||released)return;
  const root=document.getElementById('pf25Spatial-spatial-root');
  if(root){
    released=true;
    HTML.dataset.pacefoldSpatial='ready';
    HTML.classList.remove('pf25Actions-boot-hold');
    observer?.disconnect();
    return;
  }
  if(HTML.dataset.pacefoldSpatial!=='pending')HTML.dataset.pacefoldSpatial='pending';
  HTML.classList.add('pf25Actions-returning','pf25Actions-boot-hold');
  publish();
}
publish();
if(returning){
  HTML.classList.add('pf25Actions-returning','pf25Actions-boot-hold');
  HTML.dataset.pacefoldSpatial='pending';
  observer=new MutationObserver(hold);
  observer.observe(HTML,{attributes:true,attributeFilter:['data-pacefold-spatial'],childList:true,subtree:true});
  window.addEventListener('pacefold:spatial-ready',hold,{once:true});
  document.addEventListener('DOMContentLoaded',hold,{once:true});
  queueMicrotask(hold);
}
})();
;
(()=>{
'use strict';
const RELEASE='25.0.0';
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
const core=()=>window.__PACEFOLD_RUNTIME_CORE__||null;
function prefs(){return core()?.getPrefs?.()||parse(localStorage.getItem(PREFS_KEY),{})||{}}
function emit(){
  window.dispatchEvent(new CustomEvent('pacefold:rhythm-prefs',{detail:{release:RELEASE,revision:REVISION}}));
  window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:PREFS_KEY,source:'runtime-kernel'}}));
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
  const root=document.getElementById('pf25Spatial-spatial-root');if(root)root.dataset.quiet=String(active);
  for(const node of document.querySelectorAll('#pf25Spatial-quiet,[data-setting="quiet"]')){node.dataset.active=String(active);node.setAttribute('aria-pressed',String(active))}
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
  const deliver=window.__PACEFOLD_DELIVERY__;
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
window.__PACEFOLD_QUIET__=quiet;
window.__PACEFOLD_SCHEDULER__=scheduler;
window.__PACEFOLD_BACKUP__=backup;
window.__PACEFOLD_STORAGE__=storage;
window.__PACEFOLD_EXPORT__={rhythmMarkdown};
try{Object.defineProperty(window,'__PACEFOLD_CORE__',{configurable:true,get:()=>window.__PACEFOLD_RUNTIME_CORE__})}catch{}
window.addEventListener('pacefold:spatial-ready',applyQuiet);
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',applyQuiet,{once:true}):applyQuiet();
})();
