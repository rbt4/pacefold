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
export const REVISION='polish-r2-window-cues';
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
    noteDraft:'',
    noteDraftCategory:'Note',
    currentCues:[],
    cueState,
    minuteSeen:-1,
    idleDeadline:0,
    calendarMonth:null,
    weatherBusy:false,
    soundPlaying:false,
    audioContext:null,
    audioGain:null,
    audioSource:null,
    localAudioUrl:'',
    liveBackupHandle:null,
    oneNoteCatalog:[],
    oneNoteBusy:false,
    localBackupBusy:false
  };
  return ctx;
}
