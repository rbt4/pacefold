import{
  VERSION as CORE_VERSION,
  REVISION as CORE_REVISION,
  KEYS,
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
  normalizeNotes,
  normalizeLog,
  eventsForDay,
  metricsForDay,
  backupPayload
}from'../app/core.mjs';

export const RELEASE='26.0.0';
export const REVISION='foundation-r1';
export const CUE_COLORS={
  water:'#4b8fb0',prayer:'#4c8a6a',prep:'#bd7f33',away:'#806699',
  meal:'#b06653',eyes:'#5d85a5',move:'#7d8751',focus:'#58645e'
};

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

export function createContext(){
  const safeGet=(key,fallback)=>parseJson(localStorage.getItem(key),fallback);
  const rawPrefs=safeGet(KEYS.prefs,{});
  const prefs=migratePrefs(rawPrefs);
  const notes=normalizeNotes(safeGet(KEYS.notes,[]));
  const log=normalizeLog(safeGet(KEYS.log,{}));

  const ctx={
    RELEASE,REVISION,CORE_VERSION,CORE_REVISION,KEYS,DEFAULT_PREFS,ALERT_PRAYERS,
    parseJson,clamp,cleanText,migratePrefs,zoneParts,dateKey,zonedDate,scheduleState,
    workRange,normalizeNotes,normalizeLog,eventsForDay,metricsForDay,backupPayload,
    CUE_COLORS,$,$$,id,el,button,rawPrefs,prefs,notes,log,
    mode:'home',
    selectedDate:dateKey(new Date(),prefs.timeZone),
    calendarCursor:null,
    settingsTab:'essentials',
    editingNoteId:'',
    minuteSeen:-1,
    toastTimer:0,
    idleDeadline:0,
    weatherBusy:false,
    backupTimer:0,
    liveBackupHandle:null,
    cueState:safeGet(KEYS.cueState,{ack:{},notified:{},snoozeUntil:0}),
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
    localStorage.setItem(KEYS.prefs,JSON.stringify(ctx.prefs));
    localStorage.setItem(KEYS.onboarding,'1');
    ctx.dispatchChange(KEYS.prefs,reason);
    return ctx.prefs;
  };

  ctx.storeNotes=(reason='notes')=>{
    ctx.notes=normalizeNotes(ctx.notes);
    localStorage.setItem(KEYS.notes,JSON.stringify(ctx.notes));
    ctx.dispatchChange(KEYS.notes,reason);
  };

  ctx.storeLog=(reason='log')=>{
    ctx.log.savedAt=new Date().toISOString();
    ctx.log.version=RELEASE;
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
    if(!ctx.log.days[key]||typeof ctx.log.days[key]!=='object'){
      ctx.log.days[key]={date:key,createdAt:new Date().toISOString(),events:[]};
    }
    if(!Array.isArray(ctx.log.days[key].events))ctx.log.days[key].events=[];
    return ctx.log.days[key];
  };

  ctx.addMoment=(type,label,detail='',at=Date.now(),source=type,meta={})=>{
    const day=ctx.getDay(ctx.todayKey(new Date(at)));
    const recent=[...day.events].reverse().find(event=>event.source===source&&event.label===label);
    if(recent&&Math.abs(Number(recent.start)-at)<30000)return recent;
    const event={id:ctx.uid(type),source,type,label,detail,start:at,end:at,meta};
    day.events.push(event);
    day.events=day.events.slice(-600);
    ctx.storeLog(type);
    return event;
  };

  ctx.findOpen=source=>{
    for(const key of Object.keys(ctx.log.days||{}).sort().reverse()){
      const event=[...(ctx.log.days[key]?.events||[])].reverse().find(item=>item.source===source&&!item.end);
      if(event)return event;
    }
    return null;
  };

  ctx.openSession=(source,type,label,detail='',at=Date.now())=>{
    const existing=ctx.findOpen(source);
    if(existing)return existing;
    const day=ctx.getDay(ctx.todayKey(new Date(at)));
    const event={id:ctx.uid(type),source,type,label,detail,start:at,end:null,meta:{}};
    day.events.push(event);
    ctx.storeLog(`${source}-start`);
    return event;
  };

  ctx.closeSession=(source,label='Complete',at=Date.now())=>{
    const event=ctx.findOpen(source);
    if(!event)return false;
    event.end=Math.max(Number(event.start)||at,at);
    event.meta={...(event.meta||{}),closedLabel:label};
    ctx.storeLog(`${source}-end`);
    return event;
  };

  ctx.toggleSession=(source,type,label,detail='')=>{
    const open=ctx.findOpen(source);
    if(open){ctx.closeSession(source,`${label} complete`);ctx.toast(`${label} complete`)}
    else{ctx.openSession(source,type,label,detail);ctx.toast(`${label} started`)}
    ctx.renderAll?.();
  };

  ctx.formatTime=(date,options={})=>new Intl.DateTimeFormat(undefined,{
    timeZone:ctx.prefs.timeZone,
    hour:'numeric',minute:'2-digit',hour12:ctx.prefs.timeFormat!=='24',...options
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
    const part=zoneParts(now,ctx.prefs.timeZone);
    return zonedDate(part.year,part.month,part.day,hours,ctx.prefs.timeZone);
  };

  ctx.resetDailyIfNeeded=(now=new Date())=>{
    const key=ctx.todayKey(now);
    if(ctx.prefs.waterDate!==key)ctx.storePrefs({waterDate:key,waterOz:0,waterSips:0,waterLastAt:0},'new-day');
  };

  ctx.timerState=(source,minutes)=>{
    const map={prep:'noodleStart',away:'awayStart',meal:'lunchStart'};
    const start=Number(ctx.prefs[map[source]])||0;
    const duration=clamp(ctx.prefs[`${source}Minutes`]??(source==='prep'?ctx.prefs.prepMinutes:minutes),1,240,minutes)*60000;
    if(!start)return{source,start:0,duration,running:false,done:false,remaining:duration,progress:0};
    const elapsed=Date.now()-start;
    return{source,start,duration,running:elapsed<duration,done:elapsed>=duration,remaining:Math.max(0,duration-elapsed),progress:clamp(elapsed/duration,0,1,0)};
  };

  ctx.currentBackup=()=>backupPayload({
    prefs:ctx.prefs,notes:ctx.notes,log:ctx.log,
    player:{soundChoice:ctx.prefs.soundChoice,soundVolume:ctx.prefs.soundVolume}
  });

  return ctx;
}
