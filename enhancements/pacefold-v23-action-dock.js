(()=>{
'use strict';

const RELEASE='23.0.0';
const REVISION='action-dock-r1';
const PREFS_KEY='pacefoldPrefsV15';
const SOURCE_ORDER=['flow','prayer','water','noodle','away','lunch','eyes','body'];
const SOURCE_ALIASES={meal:'lunch',prep:'noodle',timer:'noodle',gaze:'eyes',movement:'body',move:'body'};
const SOURCE_META={
  flow:{label:'Needs review',short:'Review'},
  prayer:{label:'Prayer',short:'Prayer'},
  water:{label:'Water',short:'Sip'},
  noodle:{label:'Timer',short:'Timer'},
  away:{label:'Rest',short:'Rest'},
  lunch:{label:'Meal',short:'Meal'},
  eyes:{label:'Eyes',short:'Eyes'},
  body:{label:'Move',short:'Move'}
};
const DIRECT_ACTIONS=new Set(['noodle','away','lunch','eyes','body']);
const ACTIONS={
  water:['#waterBtn','#waterPill','[data-action="water"]'],
  noodle:['#noodleBtn','#noodlePill','[data-action="noodle"]','[data-action="timer"]'],
  away:['#awayBtn','#awayPill','[data-action="away"]'],
  lunch:['#lunchBtn','#lunchPill','[data-action="lunch"]','[data-action="meal"]'],
  eyes:['#eyesBtn','#gazeBtn','[data-action="eyes"]','[data-action="gaze"]'],
  body:['#careBtn','#bodyBtn','[data-action="body"]','[data-action="move"]'],
  prayer:['#prayerBtn','#prayerBreakBtn','[data-action="prayer"]']
};

let frame=0;
let timer=0;
let observer=null;
let lastBadgeKey='';
let toastTimer=0;

const $=selector=>document.querySelector(selector);
const id=value=>document.getElementById(value);
const create=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content!=null)node.textContent=String(content);return node};
const button=(className,label)=>{const node=create('button',className);node.type='button';node.setAttribute('aria-label',label);return node};
const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const localKey=(value=new Date())=>{const date=value instanceof Date?value:new Date(value);return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const prefs=()=>window.__PACEFOLD_MA_CORE__?.getPrefs?.()||parse(localStorage.getItem(PREFS_KEY),{})||{};
const normalizeSource=value=>{const source=String(value||'').toLowerCase();return SOURCE_ALIASES[source]||source};

function updatePrefs(patch){
  try{
    const core=window.__PACEFOLD_MA_CORE__;
    if(core?.updatePrefs)core.updatePrefs(patch);
    else localStorage.setItem(PREFS_KEY,JSON.stringify({...prefs(),...patch}));
    window.dispatchEvent(new CustomEvent('pacefold:ma-prefs',{detail:{source:'action-dock'}}));
    window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:PREFS_KEY,source:'action-dock'}}));
  }catch{}
}
function formatDuration(milliseconds){
  const total=Math.max(0,Math.round(Number(milliseconds||0)/1000)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
  if(hours)return`${hours}h ${String(minutes).padStart(2,'0')}m`;
  return`${minutes}:${String(seconds).padStart(2,'0')}`;
}
function elapsed(start){return start?formatDuration(Date.now()-Number(start)):''}
function remaining(start,minutes){return start?Math.max(0,Number(start)+Math.max(1,Number(minutes)||30)*60000-Date.now()):0}
function controlState(source){
  const selectors={
    water:{due:'#waterBtn.due,#waterPill.due,[data-source="water"].due',active:'#waterBtn.active,#waterPill.active'},
    noodle:{due:'#noodleBtn.ready,#noodlePill.ready,[data-source="noodle"].ready',active:'#noodleBtn.running,#noodlePill.running'},
    away:{due:'#awayBtn.due,#awayPill.due,[data-source="away"].due',active:'#awayBtn.active,#awayPill.active'},
    lunch:{due:'#lunchBtn.ready,#lunchPill.ready,[data-source="lunch"].ready',active:'#lunchBtn.running,#lunchPill.running'},
    eyes:{due:'#eyesBtn.due,#gazeBtn.due,[data-source="eyes"].due',active:'#eyesBtn.active,#gazeBtn.active'},
    body:{due:'#careBtn.due,#bodyBtn.due,[data-source="body"].due',active:'#careBtn.active,#bodyBtn.active'}
  }[source]||{};
  return{due:Boolean(selectors.due&&$(selectors.due)),active:Boolean(selectors.active&&$(selectors.active))};
}
function cueSources(){
  const found=new Set();
  try{for(const source of window.__PACEFOLD_CUES__?.sources?.()||[])found.add(normalizeSource(source))}catch{}
  const value=prefs(),waiting=value.waitingCue?.source;
  if(waiting)found.add(normalizeSource(waiting));
  const source=document.body?.dataset.source,signal=document.body?.dataset.signal;
  if(source&&['due','pending'].includes(signal))found.add(normalizeSource(source));
  if(document.querySelector('[data-pf-flow-pulse][data-state="new"]'))found.add('flow');
  return SOURCE_ORDER.filter(source=>found.has(source));
}
function proxyClick(source){
  for(const selector of ACTIONS[source]||[]){
    const target=$(selector);
    if(target&&target.closest('#pf23-action-dock')==null){
      try{target.click();return true}catch{}
    }
  }
  return false;
}
function addDayflow(type,label,detail,start=Date.now(),source=type){
  try{window.__PACEFOLD_DAYFLOW__?.add?.(type,label,detail,start,`action-dock-${source}`)}catch{}
}
function fallbackAction(source){
  const value=prefs(),now=Date.now();
  if(source==='water'){
    const count=Math.max(0,Number(value.waterSips)||0)+1,target=Math.max(1,Number(value.waterTarget)||24);
    updatePrefs({waterSips:count,waterDate:localKey(),lastWaterAt:now});addDayflow('water','Sip logged',`${count}/${target} today`,now,'water');return'Sip logged';
  }
  if(source==='away'){
    const start=Number(value.awayStart)||0;
    if(start){const sessions=Array.isArray(value.awaySessions)?value.awaySessions.slice():[];sessions.push({start,end:now});updatePrefs({awayStart:null,awaySessions:sessions.slice(-500)});addDayflow('away','Rest ended',formatDuration(now-start),start,'away');return'Rest logged'}
    updatePrefs({awayStart:now});addDayflow('away','Rest started','Away from desk',now,'away');return'Rest started';
  }
  if(source==='lunch'){
    const start=Number(value.lunchStart)||0;
    if(start){const sessions=Array.isArray(value.lunchSessions)?value.lunchSessions.slice():[];sessions.push({start,end:now,mode:value.lunchModeAtStart||'desk'});updatePrefs({lunchStart:null,lunchSessions:sessions.slice(-500)});addDayflow('meal','Meal ended',formatDuration(now-start),start,'lunch');return'Meal logged'}
    updatePrefs({lunchStart:now,lunchModeAtStart:'desk'});addDayflow('meal','Meal started','Desk meal',now,'lunch');return'Meal started';
  }
  if(source==='noodle'){
    const start=Number(value.noodleStart)||0;
    if(start){updatePrefs({noodleStart:null});addDayflow('prep','Timer stopped',formatDuration(now-start),start,'noodle');return'Timer stopped'}
    updatePrefs({noodleStart:now});addDayflow('prep','Timer started',`${Math.max(1,Number(value.noodleMinutes)||30)} minutes`,now,'noodle');return'Timer started';
  }
  if(source==='eyes'){updatePrefs({lastGazeAt:now});addDayflow('eyes','Eye reset logged','Looked away from the screen',now,'eyes');return'Eye reset logged'}
  if(source==='body'){updatePrefs({lastBodyAt:now});addDayflow('body','Movement logged','Stretch or movement break',now,'body');return'Movement logged'}
  if(source==='prayer'){window.__PACEFOLD_MA_SCHEDULER__?.clear?.();return'Prayer cue cleared'}
  return'Updated';
}
function toast(message){
  const node=id('pf23-action-toast');if(!node)return;
  node.textContent=message;node.dataset.visible='true';clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.dataset.visible='false'},1800);
}
function perform(source){
  const control=id(`pf23-action-${source}`);if(control?.dataset.busy==='true')return;
  if(control)control.dataset.busy='true';
  let message='Updated';
  if(source==='flow'){
    try{window.__PACEFOLD_FLOW__?.acknowledge?.('action-dock')}catch{}
    try{window.__PACEFOLD_CUES__?.acknowledge?.('flow')}catch{}
    window.__PACEFOLD_SPATIAL__?.go?.('worklog');message='Opened Worklog';
  }else{
    if(DIRECT_ACTIONS.has(source))message=fallbackAction(source);
    else{const clicked=proxyClick(source);message=clicked?`${SOURCE_META[source]?.label||'Action'} updated`:fallbackAction(source)}
    try{window.__PACEFOLD_CUES__?.acknowledge?.(source)}catch{}
  }
  toast(message);
  setTimeout(()=>{if(control)control.dataset.busy='false';refresh(true)},90);
}

function buildDock(){
  const hero=$('.pf22-clock-hero'),root=id('pf22-spatial-root');if(!hero||!root)return null;
  let dock=id('pf23-action-dock');if(dock)return dock;
  dock=create('section','pf23-action-dock');dock.id='pf23-action-dock';dock.setAttribute('aria-label','Quick log and timers');
  const head=create('header','pf23-action-head');
  const cues=create('div','pf23-action-cues');cues.id='pf23-action-cues';cues.setAttribute('role','status');cues.setAttribute('aria-live','polite');
  const summary=create('span','pf23-action-summary','Quick log');summary.id='pf23-action-summary';
  const log=button('pf23-action-log','Open today’s Worklog');log.append(create('span','','View log'),create('i','','→'));log.addEventListener('click',()=>window.__PACEFOLD_SPATIAL__?.go?.('worklog'));
  head.append(cues,summary,log);
  const grid=create('div','pf23-action-grid');
  const definitions=[
    ['water','Log one sip','Log sip'],['noodle','Start or stop the preparation timer','Timer'],['away','Start rest or return to work','Rest'],
    ['lunch','Start or finish a meal','Meal'],['eyes','Log an eye reset','Eyes'],['body','Log movement or a stretch','Move']
  ];
  for(const [source,label,title] of definitions){
    const item=button('pf23-action',label);item.id=`pf23-action-${source}`;item.dataset.source=source;
    const dot=create('i','pf23-action-dot');dot.setAttribute('aria-hidden','true');
    const copy=create('span','pf23-action-copy');copy.append(create('strong','',title),create('small','','Ready'));
    const meter=create('i','pf23-action-meter');meter.setAttribute('aria-hidden','true');
    item.append(dot,copy,meter);item.addEventListener('click',()=>perform(source));grid.append(item);
  }
  const toastNode=create('div','pf23-action-toast','');toastNode.id='pf23-action-toast';toastNode.setAttribute('role','status');toastNode.setAttribute('aria-live','polite');
  dock.append(head,grid,toastNode);
  const anchor=$('.pf22-context-glimpse')||$('.pf22-nav-hint');hero.insertBefore(dock,anchor||null);
  root.dataset.actionDock='ready';
  return dock;
}
function renderCues(sources){
  const cluster=id('pf23-action-cues');if(!cluster)return;
  cluster.replaceChildren();
  if(!sources.length){const clear=create('span','pf23-cue-clear');clear.append(create('i',''),create('small','','All clear'));cluster.append(clear);cluster.setAttribute('aria-label','No waiting cues');return}
  for(const source of sources){
    const cue=button('pf23-cue',`${SOURCE_META[source]?.label||source} waiting`);cue.dataset.source=source;cue.title=SOURCE_META[source]?.label||source;
    cue.append(create('i','pf23-cue-dot'),create('small','',SOURCE_META[source]?.short||source));cue.addEventListener('click',()=>perform(source));cluster.append(cue);
  }
  cluster.setAttribute('aria-label',`Waiting: ${sources.map(source=>SOURCE_META[source]?.label||source).join(', ')}`);
}
function renderAction(source,value,sources){
  const control=id(`pf23-action-${source}`);if(!control)return;
  const strong=control.querySelector('strong'),small=control.querySelector('small'),state=controlState(source),queued=sources.includes(source);
  let title=SOURCE_META[source]?.label||source,detail='Tap to log',active=state.active,due=state.due||queued,progress=0;
  if(source==='water'){
    const count=Math.max(0,Number(value.waterSips)||0),target=Math.max(1,Number(value.waterTarget)||24);title='Log sip';detail=`${count}/${target} today${due?' · due now':''}`;progress=Math.min(100,count/target*100);
  }
  if(source==='noodle'){
    const start=Number(value.noodleStart)||0,minutes=Math.max(1,Number(value.noodleMinutes)||30),left=remaining(start,minutes);active=Boolean(start&&left>0);title=active?`Timer ${formatDuration(left)}`:`Start ${minutes}m`;detail=active?'Tap to stop and log':due?'Ready now':'Preparation timer';progress=active?Math.min(100,Math.max(0,(minutes*60000-left)/(minutes*60000)*100)):0;
  }
  if(source==='away'){
    const start=Number(value.awayStart)||0;active=Boolean(start);title=active?`Back · ${elapsed(start)}`:'Rest';detail=active?'Return and log this rest':due?'Rest cue due':'One tap starts the timer';
  }
  if(source==='lunch'){
    const start=Number(value.lunchStart)||0;active=Boolean(start);title=active?`Finish · ${elapsed(start)}`:'Meal';detail=active?'Finish and log meal':due?'Meal cue due':'Start meal timer';
  }
  if(source==='eyes'){title='Eye reset';detail=due?'Due now · tap to log':'20 seconds away from screen'}
  if(source==='body'){title='Move';detail=due?'Due now · tap to log':'Stretch or movement break'}
  if(strong)strong.textContent=title;if(small)small.textContent=detail;
  control.dataset.active=String(active);control.dataset.due=String(due);control.setAttribute('aria-pressed',String(active));control.style.setProperty('--pf23-action-progress',`${progress}%`);
}
function syncNativeBadge(sources){
  const value=prefs(),enabled=value.notifications!==false&&value.taskbarBadge!==false&&(value.taskbarBadgeMode||'due')!=='off',key=`${enabled}:${sources.join(',')}`;
  if(key===lastBadgeKey)return;lastBadgeKey=key;
  const scheduler=window.__PACEFOLD_MA_SCHEDULER__;
  try{
    if(!enabled||!sources.length)void scheduler?._nativeClearBadge?.();
    else void scheduler?._nativeSetBadge?.(sources.length>1?sources.length:undefined);
  }catch{}
}
function refresh(force=false){
  const dock=buildDock();if(!dock)return false;
  const value=prefs(),sources=cueSources();renderCues(sources);
  for(const source of ['water','noodle','away','lunch','eyes','body'])renderAction(source,value,sources);
  const summary=id('pf23-action-summary'),water=Math.max(0,Number(value.waterSips)||0),target=Math.max(1,Number(value.waterTarget)||24);
  if(summary)summary.textContent=sources.length?`${sources.length} waiting · water ${water}/${target}`:`Quick log · water ${water}/${target}`;
  syncNativeBadge(sources);
  if(force)window.__PACEFOLD_DAYLIGHT__?.refresh?.();
  return true;
}
function queue(force=false){
  if(frame)return;
  frame=requestAnimationFrame(()=>{frame=0;refresh(force)});
}
function observe(){
  if(observer)return;
  observer=new MutationObserver(mutations=>{
    if(mutations.every(item=>item.target instanceof Element&&item.target.closest?.('#pf23-action-dock')))return;
    queue();
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-state','data-source','data-signal','data-active','hidden']});
}
function initialize(){
  if(!refresh(true))return;
  observe();clearInterval(timer);timer=setInterval(()=>refresh(false),1000);
  for(const event of ['pacefold:cue-queue','pacefold:ma-prefs','pacefold:storage-changed','pacefold:dayflow','pacefold:quiet','pacefold:daylight-ready'])window.addEventListener(event,()=>queue(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue(true)});
  window.__PACEFOLD_ACTION_DOCK__={release:RELEASE,revision:REVISION,refresh:()=>refresh(true),perform,sources:cueSources};
  window.dispatchEvent(new CustomEvent('pacefold:action-dock-ready',{detail:{release:RELEASE,revision:REVISION}}));
}

window.addEventListener('pacefold:spatial-ready',initialize,{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initialize,0),{once:true});else setTimeout(initialize,0);
})();
