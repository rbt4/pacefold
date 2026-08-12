import{
  VERSION as CORE_VERSION,
  REVISION as CORE_REVISION,
  KEYS as CORE_KEYS,
  DEFAULT_PREFS,
  ALERT_PRAYERS,
  parseJson,
  clamp,
  cleanText,
  migratePrefs,
  zoneParts,
  dateKey,
  zonedDate,
  scheduleState,
  workRange,
  normalizeNotes as normalizeLegacyNotes,
  normalizeLog,
  eventsForDay,
  metricsForDay,
  backupPayload
}from'../app/core.mjs';

export const RELEASE='27.0.0';
export const REVISION='polish-r1';
export const KEYS={...CORE_KEYS,cueState:'pacefold.cues.v1'};
export const CUE_COLORS={
  water:'#4b8fb0',prayer:'#4c8a6a',prep:'#bd7f33',away:'#806699',
  meal:'#b06653',eyes:'#5d85a5',move:'#7d8751',focus:'#58645e'
};
export const DEFAULT_NOTE_CATEGORIES=['Note','Follow-up','Decision','Inspection','JHSC','Idea'];

export const $=(selector,root=document)=>root.querySelector(selector);
export const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
export const id=value=>document.getElementById(value);
export const el=(tag,className='',text='')=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined&&text!==null&&text!=='')node.textContent=String(text);
  return node;
};
export const button=(className,label,text='')=>{
  const node=el('button',className,text);
  node.type='button';
  node.setAttribute('aria-label',label);
  return node;
};

export function normalizeNoteCategories(value){
  const source=Array.isArray(value)?value:DEFAULT_NOTE_CATEGORIES;
  const seen=new Set(),result=[];
  for(const item of source){
    const label=String(item||'').trim().replace(/\s+/g,' ').slice(0,32);
    const key=label.toLowerCase();
    if(!label||seen.has(key))continue;
    seen.add(key);result.push(label);
    if(result.length>=16)break;
  }
  return result.length?result:[...DEFAULT_NOTE_CATEGORIES];
}

export function normalizeV26Notes(value){
  const source=Array.isArray(value)?value:Array.isArray(value?.items)?value.items:[];
  const base=normalizeLegacyNotes(source);
  const rawById=new Map(source.filter(item=>item&&typeof item==='object').map(item=>[String(item.id||''),item]));
  return base.map(note=>{
    const raw=rawById.get(String(note.id))||{};
    const rawContext=raw.context&&typeof raw.context==='object'?raw.context:{};
    const rawMoment=rawContext.moment&&typeof rawContext.moment==='object'?rawContext.moment:null;
    return{
      ...note,
      pinned:Boolean(raw.pinned),
      closedAt:raw.closedAt?String(raw.closedAt):'',
      context:{
        at:String(rawContext.at||note.createdAt||new Date().toISOString()),
        ...(rawContext.sessionId?{sessionId:String(rawContext.sessionId)}:{}),
        ...(rawMoment?{moment:{
          id:String(rawMoment.id||''),
          label:String(rawMoment.label||'').slice(0,80),
          progress:clamp(rawMoment.progress,0,1,0)
        }}:{})
      }
    };
  });
}

function normalizeCueState(value){
  const state=value&&typeof value==='object'?value:{};
  return{v:1,ack:state.ack&&typeof state.ack==='object'?state.ack:{},notified:state.notified&&typeof state.notified==='object'?state.notified:{},snoozeUntil:Number(state.snoozeUntil)||0};
}

export function createContext(){
  const safeGet=(key,fallback)=>parseJson(localStorage.getItem(key),fallback);
  const rawPrefs=safeGet(KEYS.prefs,{});
  const prefs=migratePrefs(rawPrefs);
  prefs.v=1;
  prefs.noteCategories=normalizeNoteCategories(prefs.noteCategories);
  prefs.rhythmDiscretion=['names','neutral','hidden'].includes(prefs.rhythmDiscretion)?prefs.rhythmDiscretion:'neutral';
  const rawNotes=safeGet(KEYS.notes,[]);
  const notes=normalizeV26Notes(rawNotes);
  const rawLog=safeGet(KEYS.log,{});
  const log=normalizeLog(rawLog);log.v=1;log.version=RELEASE;
  const legacyCue=safeGet(CORE_KEYS.cueState,{ack:{},notified:{},snoozeUntil:0});
  const cueState=normalizeCueState(safeGet(KEYS.cueState,legacyCue));

  localStorage.setItem(KEYS.prefs,JSON.stringify(prefs));
  localStorage.setItem(KEYS.notes,JSON.stringify({v:1,items:notes,savedAt:new Date().toISOString()}));
  localStorage.setItem(KEYS.log,JSON.stringify(log));
  localStorage.setItem(KEYS.cueState,JSON.stringify(cueState));

  const ctx={
    RELEASE,REVISION,CORE_VERSION,CORE_REVISION,KEYS,DEFAULT_PREFS,ALERT_PRAYERS,
    parseJson,clamp,cleanText,migratePrefs,zoneParts,dateKey,zonedDate,scheduleState,
    workRange,normalizeNotes:normalizeV26Notes,normalizeNoteCategories,normalizeLog,eventsForDay,metricsForDay,backupPayload,
    CUE_COLORS,$,$$,id,el,button,rawPrefs,prefs,notes,log,
    mode:'home',
    selectedDate:dateKey(new Date(),prefs.timeZone),
    calendarCursor:null,
    settingsTab:'essentials',
    editingNoteId:'',
    inlineEditingNoteId:'',
    noteFocusId:'',
    noteFilter:'all',
    newNoteCategory:prefs.noteCategories[0]||'Note',
    clockNoteCategory:prefs.noteCategories[0]||'Note',
    minuteSeen:-1,
    toastTimer:0,
    idleDeadline:0,
    weatherBusy:false,
    backupTimer:0,
    liveBackupHandle:null,
    cueState,
    currentCues:[],
    audioContext:null,
    audioSource:null,
    audioGain:null,
    localAudioUrl:'',
    soundPlaying:false,
    oneNoteClient:null,
    oneNoteCatalog:[],
    oneNotePickerMode:'',
    renderAll:null,
    scheduleLiveBackup:null
  };
  ctx.calendarCursor=new Date(`${ctx.selectedDate}T12:00:00`);

  ctx.safeGet=safeGet;
  ctx.uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  ctx.durationText=milliseconds=>{
    const minutes=Math.max(0,Math.round(Number(milliseconds||0)/60000));
    const hours=Math.floor(minutes/60),rest=minutes%60;
    return hours?`${hours}h${rest?` ${rest}m`:''}`:`${minutes}m`;
  };

  ctx.dispatchChange=(key,reason)=>{
    window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key,reason}}));
    ctx.scheduleLiveBackup?.();
  };

  ctx.storePrefs=(patch={},reason='settings')=>{
    ctx.prefs=migratePrefs({...ctx.prefs,...patch});
    ctx.prefs.v=1;
    ctx.prefs.noteCategories=normalizeNoteCategories(ctx.prefs.noteCategories);
    ctx.prefs.rhythmDiscretion=['names','neutral','hidden'].includes(ctx.prefs.rhythmDiscretion)?ctx.prefs.rhythmDiscretion:'neutral';
    if(!ctx.prefs.noteCategories.includes(ctx.newNoteCategory))ctx.newNoteCategory=ctx.prefs.noteCategories[0];
    if(!ctx.prefs.noteCategories.includes(ctx.clockNoteCategory))ctx.clockNoteCategory=ctx.prefs.noteCategories[0];
    localStorage.setItem(KEYS.prefs,JSON.stringify(ctx.prefs));
    localStorage.setItem(KEYS.onboarding,'1');
    ctx.dispatchChange(KEYS.prefs,reason);
    return ctx.prefs;
  };

  ctx.storeNotes=(reason='notes')=>{
    ctx.notes=normalizeV26Notes(ctx.notes);
    localStorage.setItem(KEYS.notes,JSON.stringify({v:1,items:ctx.notes,savedAt:new Date().toISOString()}));
    ctx.dispatchChange(KEYS.notes,reason);
  };

  ctx.storeLog=(reason='log')=>{
    ctx.log.savedAt=new Date().toISOString();
    ctx.log.version=RELEASE;
    ctx.log.v=1;
    localStorage.setItem(KEYS.log,JSON.stringify(ctx.log));
    ctx.dispatchChange(KEYS.log,reason);
  };

  ctx.toast=message=>{
    const node=id('toast');
    if(!node)return;
    node.textContent=message;
    node.classList.add('on');
    clearTimeout(ctx.toastTimer);
    ctx.toastTimer=setTimeout(()=>node.classList.remove('on'),2200);
  };

  ctx.todayKey=(date=new Date())=>dateKey(date,ctx.prefs.timeZone);
  ctx.dayEvents=(key=ctx.todayKey())=>eventsForDay(ctx.log,key);

  ctx.getDay=(key=ctx.todayKey())=>{
    ctx.log.days=ctx.log.days||{};
    if(!ctx.log.days[key]||typeof ctx.log.days[key]!=='object')ctx.log.days[key]={date:key,createdAt:new Date().toISOString(),events:[]};
    if(!Array.isArray(ctx.log.days[key].events))ctx.log.days[key].events=[];
    return ctx.log.days[key];
  };

  ctx.addMoment=(type,label,detail='',at=Date.now(),source=type,meta={})=>{
    const day=ctx.getDay(ctx.todayKey(new Date(at)));
    const recent=[...day.events].reverse().find(event=>event.source===source&&event.label===label);
    if(recent&&Math.abs(Number(recent.start)-at)<30000)return recent;
    const event={id:ctx.uid(type),source,type,label,detail,start:at,end:at,meta};
    day.events.push(event);day.events=day.events.slice(-600);ctx.storeLog(type);return event;
  };

  ctx.findOpen=source=>{
    for(const key of Object.keys(ctx.log.days||{}).sort().reverse()){
      const event=[...(ctx.log.days[key]?.events||[])].reverse().find(item=>item.source===source&&!item.end);
      if(event)return event;
    }
    return null;
  };

  ctx.openSession=(source,type,label,detail='',at=Date.now())=>{
    const existing=ctx.findOpen(source);if(existing)return existing;
    const day=ctx.getDay(ctx.todayKey(new Date(at)));
    const event={id:ctx.uid(type),source,type,label,detail,start:at,end:null,meta:{}};
    day.events.push(event);ctx.storeLog(`${source}-start`);return event;
  };

  ctx.closeSession=(source,label='Complete',at=Date.now())=>{
    const event=ctx.findOpen(source);if(!event)return false;
    event.end=Math.max(Number(event.start)||at,at);event.meta={...(event.meta||{}),closedLabel:label};
    ctx.storeLog(`${source}-end`);return event;
  };

  ctx.toggleSession=(source,type,label,detail='')=>{
    const open=ctx.findOpen(source);
    if(open){ctx.closeSession(source,`${label} complete`);ctx.toast(`${label} complete`)}
    else{ctx.openSession(source,type,label,detail);ctx.toast(`${label} started`)}
    ctx.renderAll?.();
  };

  ctx.formatTime=(date,options={})=>new Intl.DateTimeFormat(undefined,{
    timeZone:ctx.prefs.timeZone,hour:'numeric',minute:'2-digit',hour12:ctx.prefs.timeFormat!=='24',...options
  }).format(date);
  ctx.formatDate=(date,options={})=>new Intl.DateTimeFormat(undefined,{
    timeZone:ctx.prefs.timeZone,weekday:'long',month:'long',day:'numeric',...options
  }).format(date);
  ctx.relativeUntil=(date,now=new Date())=>{
    const seconds=Math.round((date-now)/1000),absolute=Math.abs(seconds),future=seconds>=0;
    if(absolute<60)return future?'less than a minute':'just now';
    const minutes=Math.round(absolute/60);
    if(minutes<60)return future?`in ${minutes} min`:`${minutes} min ago`;
    const hours=Math.floor(minutes/60),rest=minutes%60;
    return future?`in ${hours}h${rest?` ${rest}m`:''}`:`${hours}h ago`;
  };
  ctx.zonedForToday=(hours,now=new Date())=>{
    const part=zoneParts(now,ctx.prefs.timeZone);return zonedDate(part.year,part.month,part.day,hours,ctx.prefs.timeZone);
  };
  ctx.resetDailyIfNeeded=(now=new Date())=>{
    const key=ctx.todayKey(now);if(ctx.prefs.waterDate!==key)ctx.storePrefs({waterDate:key,waterOz:0,waterSips:0,waterLastAt:0},'new-day');
  };
  ctx.timerState=(source,minutes)=>{
    const map={prep:'noodleStart',away:'awayStart',meal:'lunchStart'};
    const start=Number(ctx.prefs[map[source]])||0;
    const duration=clamp(ctx.prefs[`${source}Minutes`]??(source==='prep'?ctx.prefs.prepMinutes:minutes),1,240,minutes)*60000;
    if(!start)return{source,start:0,duration,running:false,done:false,remaining:duration,progress:0};
    const elapsed=Date.now()-start;
    return{source,start,duration,running:elapsed<duration,done:elapsed>=duration,remaining:Math.max(0,duration-elapsed),progress:clamp(elapsed/duration,0,1,0)};
  };
  ctx.currentBackup=()=>({...backupPayload({prefs:ctx.prefs,notes:ctx.notes,log:ctx.log,player:{soundChoice:ctx.prefs.soundChoice,soundVolume:ctx.prefs.soundVolume}}),release:RELEASE});
  return ctx;
}
