(() => {
'use strict';

const RELEASE='20.0.1';
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
  try{window.__PACEFOLD_RESILIENCE__?.recordError?.(`v20-${scope}`,error);}catch{}
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
  return window.__PACEFOLD_MA_CORE__?.getPrefs?.()||safeParse(localStorage.getItem(PREFS_KEY),{});
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
  let control=byId('pf-v20-backup');
  if(control)return control;
  const rail=byId('pf-v19-workbench')?.querySelector('.pf-v19-workbench-rail');
  if(!rail)return null;
  control=button('pf-v20-backup','Choose an automatic Pacefold backup file');
  control.id='pf-v20-backup';
  const mark=create('span','pf-v20-backup-mark');
  mark.setAttribute('aria-hidden','true');
  const copy=create('span','pf-v20-backup-copy');
  copy.append(create('strong','','Backup file'),create('small','','Choose where notes are protected'));
  control.append(mark,copy);
  control.addEventListener('click',guarded('backup-pick',chooseBackup));
  rail.insertBefore(control,rail.querySelector('.pf-v19-workbench-playing'));
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
  const core=window.__PACEFOLD_MA_CORE__;
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
  window.dispatchEvent(new CustomEvent('pacefold:ma-prefs'));
  window.__PACEFOLD_REVAMP__?.reconcile?.();
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
    window.dispatchEvent(new CustomEvent('pacefold:v20-backup',{detail:{reason,noteCount:payload.notes.length,savedAt:payload.exportedAt}}));
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
  let control=byId('pf-v20-alert');
  if(control)return control;
  const shell=document.querySelector('main .clock-shell');
  if(!shell)return null;
  control=button('pf-v20-alert','No Pacefold notification waiting');
  control.id='pf-v20-alert';
  const dot=create('span','pf-v20-alert-dot');
  dot.setAttribute('aria-hidden','true');
  const copy=create('span','pf-v20-alert-copy');
  copy.append(create('strong','','All clear'),create('small','','Taskbar marker is off'));
  control.append(dot,copy);
  control.addEventListener('click',guarded('alert-click',async()=>{
    const state=attentionState();
    if(state.active){
      if(document.querySelector('[data-pf-flow-pulse][data-state="new"]'))await window.__PACEFOLD_FLOW__?.acknowledge?.('v20-marker');
      else await window.__PACEFOLD_MA_SCHEDULER__?.clear?.();
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
  document.documentElement.dataset.v20Attention=String(state.active);
  const link=ensureFavicon();
  if(state.active){
    const icon=attentionFavicon();
    if(icon)link.href=icon;
  }else if(baseFavicon)link.href=baseFavicon;
}

function installFolio(){
  const main=document.querySelector('main');
  const shell=main?.querySelector('.clock-shell');
  const workbench=byId('pf-v19-workbench');
  if(!main||!shell||!workbench)return false;
  let folio=byId('pf-v20-folio');
  if(!folio){
    folio=create('section','pf-v20-folio');
    folio.id='pf-v20-folio';
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
  const page=byId('pf-v19-workbench')?.dataset.page||'notes';
  const backup=backupControl();
  const playing=byId('pf-v19-workbench')?.querySelector('.pf-v19-workbench-playing');
  if(backup)backup.hidden=page!=='notes';
  if(playing)playing.hidden=page!=='sound';
}

function reconcile(){
  if(!installFolio())return false;
  document.documentElement.classList.add('pf-v20-active');
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
    if(mutations.every(item=>item.target instanceof Element&&item.target.closest?.('#pf-v20-backup')))return;
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
  document.documentElement.classList.add('pf-v20-active');
  observe();
  window.addEventListener('pacefold:storage-changed',guarded('storage-change',event=>{
    queue();
    if(backupReady&&event.detail?.source!=='v20-backup-recovery')scheduleBackup('notes-changed');
  }));
  window.addEventListener('pacefold:ma-prefs',guarded('prefs-change',()=>{
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
