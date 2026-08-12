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
export const REVISION='polish-r3-daily-surface';
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

export function createContext(){
  const ctx={
    version:RELEASE,revision:REVISION,keys:KEYS,coreVersion:CORE_VERSION,coreRevision:CORE_REVISION,
    CUE_COLORS,ALERT_PRAYERS,DEFAULT_PREFS,
    parseJson,clamp,cleanText,migratePrefs,zoneParts,dateKey,zonedDate,scheduleState,workRange,
    normalizeLog,eventsForDay,metricsForDay,backupPayload,normalizeNoteCategories,normalizeV26Notes,
    prefs:migratePrefs(parseJson(localStorage.getItem(KEYS.prefs),DEFAULT_PREFS)),
    notes:normalizeV26Notes(parseJson(localStorage.getItem(KEYS.notes),[])),
    log:normalizeLog(parseJson(localStorage.getItem(KEYS.log),{days:{}})),
    timers:parseJson(localStorage.getItem(KEYS.timers),{}),
    mode:'home',cues:[],calendarCursor:new Date(),selectedDate:'',noteFilter:'all',noteSearch:'',
    noteFocusId:'',inlineEditingNoteId:'',newNoteCategory:'Note',clockNoteCategory:'Note',
    windowCueSeen:new Set(),windowCueBloomUntil:new Map(),
    storePrefs(next,reason='prefs'){ctx.prefs=migratePrefs({...ctx.prefs,...next});localStorage.setItem(KEYS.prefs,JSON.stringify(ctx.prefs));ctx.onStateChange?.(reason)},
    storeNotes(reason='notes'){localStorage.setItem(KEYS.notes,JSON.stringify({v:1,items:ctx.notes}));ctx.onStateChange?.(reason)},
    storeLog(reason='log'){localStorage.setItem(KEYS.log,JSON.stringify(ctx.log));ctx.onStateChange?.(reason)},
    storeTimers(reason='timers'){localStorage.setItem(KEYS.timers,JSON.stringify(ctx.timers));ctx.onStateChange?.(reason)},
    uid(prefix='id'){return`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`},
    toast(message){const node=id('toast');if(!node)return;node.textContent=message;node.classList.add('on');clearTimeout(ctx.toastTimer);ctx.toastTimer=setTimeout(()=>node.classList.remove('on'),2200)},
    todayKey(date=new Date()){return dateKey(date,ctx.prefs.timeZone)},
    addMoment(type,label,detail='',at=Date.now(),source='',extra={}){
      const key=ctx.todayKey(new Date(at)),day=ctx.log.days[key]||(ctx.log.days[key]={events:[]}),entry={id:ctx.uid(type),type,source:source||type,label:String(label||type),detail:String(detail||''),start:at,end:at,...extra};day.events.push(entry);ctx.storeLog(type);return entry;
    },
    findOpen(source){for(const day of Object.values(ctx.log.days||{})){const found=[...(day.events||[])].reverse().find(event=>event.source===source&&!event.end);if(found)return found}return null},
    closeOpen(source,at=Date.now()){const entry=ctx.findOpen(source);if(!entry)return null;entry.end=at;ctx.storeLog(`${source}-close`);return entry},
    getBackup(){return backupPayload({prefs:ctx.prefs,notes:ctx.notes,log:ctx.log,timers:ctx.timers},RELEASE)},
    getSchedule(date=new Date()){return scheduleState(date,ctx.prefs)},
    workRange(prefs=ctx.prefs,date=new Date()){return workRange(prefs,date)},
    zoneParts(date=new Date(),zone=ctx.prefs.timeZone){return zoneParts(date,zone)},
    clamp(value,min,max,fallback){return clamp(value,min,max,fallback)},
    cleanText(value,max){return cleanText(value,max)}
  };
  ctx.selectedDate=ctx.todayKey();ctx.newNoteCategory=ctx.prefs.noteCategories?.[0]||'Note';ctx.clockNoteCategory=ctx.newNoteCategory;
  return ctx;
}
