(()=>{
'use strict';

const RELEASE='22.0.2';
const REVISION='day-unfold-r1';
const PREFS_KEY='pacefoldPrefsV15';
const SVG_NS='http://www.w3.org/2000/svg';
const SOURCE_ORDER=['prayer','water','lunch','noodle','away','eyes','body','flow','diagnostic'];
const SOURCE_META={
  prayer:{label:'Prayer',color:'#4f8a6c'},
  water:{label:'Water',color:'#5f97bd'},
  lunch:{label:'Meal',color:'#7d879f'},
  noodle:{label:'Preparation',color:'#bd8452'},
  away:{label:'Away',color:'#5f968e'},
  eyes:{label:'Eye break',color:'#8876ae'},
  body:{label:'Movement',color:'#748f79'},
  flow:{label:'Worklog',color:'#b86659'},
  diagnostic:{label:'Pacefold',color:'#b86659'}
};
const PHASES={
  rest:{caption:'Before the workday',bg:'#edf1ed',glow:'rgba(255,255,255,.92)',horizon:'rgba(225,235,227,.54)',sun:'#d8b37a'},
  opening:{caption:'The day is opening',bg:'#eef2ed',glow:'rgba(255,244,219,.76)',horizon:'rgba(236,210,166,.35)',sun:'#e2a55b'},
  morning:{caption:'Morning in motion',bg:'#edf2ee',glow:'rgba(255,251,232,.82)',horizon:'rgba(220,235,226,.46)',sun:'#e5b45f'},
  noon:{caption:'The day is fully open',bg:'#edf2ef',glow:'rgba(255,255,244,.9)',horizon:'rgba(211,232,223,.5)',sun:'#edc86b'},
  afternoon:{caption:'The day is folding forward',bg:'#eef1ed',glow:'rgba(255,241,221,.7)',horizon:'rgba(232,210,180,.34)',sun:'#dda15f'},
  complete:{caption:'The workday is complete',bg:'#ecefeb',glow:'rgba(239,246,241,.72)',horizon:'rgba(206,221,213,.38)',sun:'#bf8a62'},
  off:{caption:'A quieter day',bg:'#edf0ed',glow:'rgba(255,255,255,.72)',horizon:'rgba(218,228,222,.35)',sun:'#aebbb3'}
};

let timer=0;
let observer=null;
let ribbonObserver=null;
let lastMarkerKey='';
let lastSessionKey='';
let lastCueKey='';
let baseFavicon='';
let faviconLink=null;

const $=selector=>document.querySelector(selector);
const id=value=>document.getElementById(value);
const create=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content!=null)node.textContent=String(content);return node};
const svg=(tag,className)=>{const node=document.createElementNS(SVG_NS,tag);if(className)node.setAttribute('class',className);return node};
const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,Number(value)||0));
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const localKey=(value=new Date())=>{const date=value instanceof Date?value:new Date(value);return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,10)};

function prefs(){
  try{return window.__PACEFOLD_MA_CORE__?.getPrefs?.()||parse(localStorage.getItem(PREFS_KEY),{})||{}}catch{return{}}
}
function writePrefs(patch){
  const current=prefs(),next={...current,...patch};
  try{
    if(window.__PACEFOLD_MA_CORE__?.updatePrefs)window.__PACEFOLD_MA_CORE__.updatePrefs(patch);
    else localStorage.setItem(PREFS_KEY,JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('pacefold:ma-prefs',{detail:{source:'daylight'}}));
    window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:PREFS_KEY,source:'daylight'}}));
  }catch{}
  return next;
}
function parseRange(value='08:30-16:30'){
  const match=String(value).match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if(!match)return{start:8.5,end:16.5,startText:'08:30',endText:'16:30'};
  return{start:Number(match[1])+Number(match[2])/60,end:Number(match[3])+Number(match[4])/60,startText:`${match[1]}:${match[2]}`,endText:`${match[3]}:${match[4]}`};
}
function safeTime(value,fallback){return/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value||''))?String(value):fallback}
function resolvedDay(date=new Date(),value=prefs()){
  const fallback=parseRange(value.workHours),week=value.workWeek&&typeof value.workWeek==='object'?value.workWeek:{},row=week[date.getDay()]||week[String(date.getDay())]||{};
  const override=value.todayOverride&&value.todayOverride.date===localKey(date)?value.todayOverride:null;
  const type=String(override?.type||row.type||((date.getDay()===0||date.getDay()===6)&&value.workdaysOnly!==false?'off':'desk')).toLowerCase();
  const startText=safeTime(row.start,fallback.startText),endText=safeTime(row.end,fallback.endText),range=parseRange(`${startText}-${endText}`);
  let end=range.end;if(type==='half'&&end>range.start+3)end=range.start+(end-range.start)/2;
  return{type,start:range.start,end,startText,endText:type==='half'?decimalTime(end):endText};
}
function decimalTime(value){
  const hours=Math.floor(value),minutes=Math.round((value-hours)*60);return`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
}
function formatTime(value,is24){
  const match=String(value).match(/^(\d{2}):(\d{2})$/);if(!match)return value;
  const hour=Number(match[1]),minute=match[2];if(is24)return`${match[1]}:${minute}`;
  return`${hour%12||12}:${minute} ${hour>=12?'PM':'AM'}`;
}
function currentHours(date=new Date()){return date.getHours()+date.getMinutes()/60+date.getSeconds()/3600}
function point(progress){
  const p=clamp(progress),x=24+(676-24)*p,y=(1-p)*(1-p)*80+2*(1-p)*p*4+p*p*80;
  return{x,y,xPercent:x/700*100};
}
function phaseFor(day,progress,nowHours){
  if(day.type==='off')return'off';
  if(nowHours<day.start)return nowHours>=day.start-2?'opening':'rest';
  if(nowHours>=day.end)return'complete';
  if(progress<.18)return'opening';
  if(progress<.48)return'morning';
  if(progress<.68)return'noon';
  return'afternoon';
}
function sourceName(value){
  const source=String(value||'').toLowerCase();
  if(source==='meal')return'lunch';
  if(source==='prep'||source==='timer')return'noodle';
  if(source==='gaze')return'eyes';
  if(source==='movement')return'body';
  return SOURCE_META[source]?source:'diagnostic';
}
function percentVar(node,name){
  const inline=node.style?.getPropertyValue(name),computed=getComputedStyle(node).getPropertyValue(name),value=parseFloat(inline||computed||'');
  return Number.isFinite(value)?value:null;
}

function buildDayUnfold(){
  const hero=$('.pf22-clock-hero');if(!hero||id('pf22-day-unfold'))return id('pf22-day-unfold');
  const region=create('section','pf22-day-unfold');region.id='pf22-day-unfold';region.setAttribute('aria-label','Workday unfolding');
  const sky=svg('svg','pf22-day-sky');sky.setAttribute('viewBox','0 0 700 96');sky.setAttribute('preserveAspectRatio','none');sky.setAttribute('aria-hidden','true');
  const future=svg('path','pf22-day-arc-future'),spent=svg('path','pf22-day-arc-spent');
  for(const path of [future,spent]){path.setAttribute('d','M24 80 Q350 4 676 80');path.setAttribute('pathLength','100')}
  sky.append(future,spent);
  const horizon=create('span','pf22-day-horizon'),sun=create('span','pf22-day-sun'),events=create('div','pf22-day-events'),sessions=create('div','pf22-day-sessions');
  sun.id='pf22-day-sun';events.id='pf22-day-events';sessions.id='pf22-day-sessions';
  const labels=create('div','pf22-day-labels'),start=create('span','pf22-day-start','--'),caption=create('span','pf22-day-caption','The day is opening'),end=create('span','pf22-day-end','--');
  labels.append(start,caption,end);region.append(sky,horizon,sessions,events,sun,labels);
  const status=id('pf22-status');hero.insertBefore(region,status||$('.pf22-progress')||null);
  return region;
}
function buildCueCluster(){
  const topbar=$('.pf22-topbar'),quiet=id('pf22-quiet');if(!topbar||!quiet)return null;
  let group=$('.pf22-topbar-actions');
  if(!group){group=create('div','pf22-topbar-actions');topbar.insertBefore(group,quiet);group.append(quiet)}
  let cluster=id('pf22-cue-cluster');
  if(!cluster){cluster=create('div','pf22-cue-cluster');cluster.id='pf22-cue-cluster';cluster.setAttribute('role','status');cluster.setAttribute('aria-live','polite');group.insertBefore(cluster,quiet)}
  return cluster;
}
function buildTaskbarSetting(){
  const panel=$('.pf22-settings-display');if(!panel||id('pf22-taskbar-cue-toggle'))return;
  const notificationRow=panel.querySelector('[data-control="notifications"]');
  const row=create('div','pf22-control-row pf22-daylight-row');row.dataset.control='taskbarCues';
  const copy=create('div','pf22-control-copy');copy.append(create('strong','','Taskbar cue dots'),create('small','','Keep subtle source cues visible, including in Quiet mode'));
  const toggle=create('button','pf22-daylight-toggle','');toggle.type='button';toggle.id='pf22-taskbar-cue-toggle';toggle.setAttribute('aria-label','Toggle taskbar cue dots');
  toggle.addEventListener('click',()=>{
    const current=prefs(),enabled=current.taskbarBadge!==false&&(current.taskbarBadgeMode||'due')!=='off';
    if(enabled)writePrefs({taskbarBadge:false,taskbarBadgeMode:'off'});
    else writePrefs({notifications:true,taskbarBadge:true,taskbarBadgeMode:'due',notificationMode:current.notificationMode==='off'?'quiet':current.notificationMode||'quiet'});
    refresh(true);
  });
  row.append(copy,toggle);
  const legend=create('div','pf22-cue-legend');
  for(const source of ['water','prayer','lunch','eyes','body']){const item=create('span','');const dot=create('i','pf22-cue-dot');dot.dataset.source=source;item.append(dot,create('small','',SOURCE_META[source].label));legend.append(item)}
  if(notificationRow){notificationRow.after(row,legend)}else panel.append(row,legend);
}

function renderMarkers(force=false){
  const layer=id('pf22-day-events');if(!layer)return;
  const quiet=Boolean(prefs().quietMode);
  const markers=[...document.querySelectorAll('.pf-ribbon-crease')].map(node=>{
    const x=percentVar(node,'--pf-ribbon-x');if(x==null)return null;
    return{x:clamp(x/100),kind:sourceName(node.dataset.kind||node.dataset.source||'prayer'),label:text(node.getAttribute('aria-label')||node.title||node.dataset.label||node.textContent)||'Scheduled moment'};
  }).filter(Boolean).sort((a,b)=>a.x-b.x);
  const key=JSON.stringify(markers.map(item=>[Math.round(item.x*1000),item.kind,quiet?'':item.label]));if(!force&&key===lastMarkerKey)return;lastMarkerKey=key;
  layer.replaceChildren();
  for(const item of markers){
    const dot=create('button','pf22-day-event');dot.type='button';dot.dataset.kind=item.kind;const location=point(item.x);dot.style.setProperty('--pf22-event-x',`${location.xPercent}%`);dot.style.setProperty('--pf22-event-y',`${location.y}px`);dot.setAttribute('aria-label',quiet?'Scheduled moment':item.label);dot.title=quiet?'Scheduled moment':item.label;layer.append(dot);
  }
}
function renderSessions(force=false){
  const layer=id('pf22-day-sessions');if(!layer)return;
  const sessions=[...document.querySelectorAll('.pf-ribbon-band')].map(node=>{
    const start=percentVar(node,'--pf-ribbon-start'),span=percentVar(node,'--pf-ribbon-span');if(start==null||span==null)return null;
    return{start:clamp(start/100),span:clamp(span>1?span/100:span),kind:sourceName(node.dataset.kind||'away')};
  }).filter(Boolean);
  const key=JSON.stringify(sessions.map(item=>[Math.round(item.start*1000),Math.round(item.span*1000),item.kind]));if(!force&&key===lastSessionKey)return;lastSessionKey=key;
  layer.replaceChildren();
  for(const item of sessions){const band=create('span','pf22-day-session');band.dataset.kind=item.kind;band.style.setProperty('--pf22-session-start',`${item.start*100}%`);band.style.setProperty('--pf22-session-width',`${item.span*100}%`);layer.append(band)}
}

function dueSources(){
  const value=prefs();
  if(value.notifications===false||(value.notificationMode||'quiet')==='off')return[];
  const found=new Set(),now=Date.now();
  const add=source=>{if(source)found.add(sourceName(source))};
  if(value.waitingCue?.source&&(!value.waitingCue.expiresAt||Number(value.waitingCue.expiresAt)>now))add(value.waitingCue.source);
  const bodySource=document.body?.dataset.source,signal=document.body?.dataset.signal;
  if(bodySource&&(['due','pending'].includes(signal)||signal==='active'&&['prayer','away','body'].includes(bodySource)))add(bodySource);
  if(document.querySelector('[data-pf-flow-pulse][data-state="new"]'))add('flow');
  const selectors={
    water:'#waterBtn.due,#waterPill.due,[data-source="water"].due',
    noodle:'#noodleBtn.ready,#noodlePill.ready,[data-source="noodle"].ready',
    lunch:'#lunchPill.ready,#lunchBtn.ready,[data-source="lunch"].ready',
    eyes:'#gazeBtn.due,[data-source="eyes"].due',
    body:'#bodyBtn.due,[data-source="body"].due'
  };
  for(const [source,selector] of Object.entries(selectors))if(document.querySelector(selector))add(source);
  return SOURCE_ORDER.filter(source=>found.has(source));
}
function favicon(){
  if(faviconLink?.isConnected)return faviconLink;
  faviconLink=document.querySelector('link[rel~="icon"]');
  if(!faviconLink){faviconLink=document.createElement('link');faviconLink.rel='icon';document.head.append(faviconLink)}
  if(!baseFavicon)baseFavicon=faviconLink.href||'./icons/icon-192.png';
  return faviconLink;
}
function renderFavicon(sources){
  const link=favicon();if(!sources.length){if(baseFavicon)link.href=baseFavicon;return}
  try{
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const context=canvas.getContext('2d');if(!context)return;
    context.fillStyle='#315b50';context.beginPath();if(context.roundRect)context.roundRect(5,5,54,54,14);else context.rect(5,5,54,54);context.fill();
    context.fillStyle='#f7f7f1';context.font='700 34px system-ui';context.textAlign='center';context.textBaseline='middle';context.fillText('P',31,34);
    const positions=[[52,12],[52,28],[52,44],[37,53]];
    sources.slice(0,4).forEach((source,index)=>{const [x,y]=positions[index];context.fillStyle=SOURCE_META[source]?.color||SOURCE_META.diagnostic.color;context.beginPath();context.arc(x,y,6.2,0,Math.PI*2);context.fill();context.lineWidth=2;context.strokeStyle='#f7f7f1';context.stroke()});
    link.href=canvas.toDataURL('image/png');
  }catch{}
}
function renderBadge(sources,value){
  const scheduler=window.__PACEFOLD_MA_SCHEDULER__,setBadge=scheduler?._nativeSetBadge,clearBadge=scheduler?._nativeClearBadge,enabled=value.taskbarBadge!==false&&(value.taskbarBadgeMode||'due')!=='off'&&value.notifications!==false;
  try{
    if(!enabled||!sources.length){void clearBadge?.();return}
    void setBadge?.(sources.length>1?sources.length:undefined);
  }catch{}
}
function renderCues(force=false){
  const cluster=buildCueCluster(),value=prefs();if(!cluster)return;
  const sources=dueSources(),key=JSON.stringify([sources,value.taskbarBadge,value.taskbarBadgeMode,value.quietMode]);if(!force&&key===lastCueKey)return;lastCueKey=key;
  cluster.replaceChildren();
  for(const [index,source] of sources.entries()){const dot=create('i','pf22-cue-dot');dot.dataset.source=source;dot.dataset.primary=String(index===0);dot.title=SOURCE_META[source]?.label||'Pacefold cue';cluster.append(dot)}
  cluster.hidden=!sources.length;cluster.setAttribute('aria-label',sources.length?`Waiting cues: ${sources.map(source=>SOURCE_META[source]?.label||source).join(', ')}`:'No waiting cues');
  const root=id('pf22-spatial-root');if(root)root.dataset.cueCount=String(sources.length);
  renderFavicon(sources);renderBadge(sources,value);
}
function renderTaskbarSetting(){
  buildTaskbarSetting();const toggle=id('pf22-taskbar-cue-toggle');if(!toggle)return;
  const value=prefs(),active=value.taskbarBadge!==false&&(value.taskbarBadgeMode||'due')!=='off';toggle.dataset.active=String(active);toggle.textContent=active?'On':'Off';toggle.setAttribute('aria-pressed',String(active));
}

function renderDay(force=false){
  const region=buildDayUnfold(),root=id('pf22-spatial-root');if(!region||!root)return;
  const value=prefs(),day=resolvedDay(new Date(),value),nowHours=currentHours(),progress=day.type==='off'?0:clamp((nowHours-day.start)/Math.max(.01,day.end-day.start)),phaseName=phaseFor(day,progress,nowHours),phase=PHASES[phaseName],location=point(progress),is24=value.timeFormat==='24';
  root.dataset.dayPhase=phaseName;root.dataset.quiet=String(Boolean(value.quietMode));root.style.setProperty('--pf22-day-bg',phase.bg);root.style.setProperty('--pf22-day-glow',phase.glow);root.style.setProperty('--pf22-day-horizon',phase.horizon);root.style.setProperty('--pf22-sun',phase.sun);
  region.dataset.off=String(day.type==='off');region.style.setProperty('--pf22-day-dash',String(100-progress*100));region.style.setProperty('--pf22-sun-x',`${location.xPercent}%`);region.style.setProperty('--pf22-sun-y',`${location.y}px`);
  const start=region.querySelector('.pf22-day-start'),end=region.querySelector('.pf22-day-end'),caption=region.querySelector('.pf22-day-caption');
  if(start)start.textContent=formatTime(day.startText,is24);if(end)end.textContent=formatTime(day.endText,is24);
  if(caption)caption.textContent=day.type==='field'?`${phase.caption} · field day`:day.type==='half'?`${phase.caption} · half day`:phase.caption;
  region.setAttribute('aria-label',day.type==='off'?'Off day':`${Math.round(progress*100)} percent of the workday has unfolded`);
  renderMarkers(force);renderSessions(force);
}
function stampExperience(){
  document.documentElement.dataset.pacefoldExperience=RELEASE;if(document.body)document.body.dataset.pacefoldExperience=RELEASE;
  const version=$('.pf22-version');if(version)version.textContent=`Pacefold ${RELEASE} · Day Unfold · verified offline core 15.2.2`;
  if(window.__PACEFOLD_VERSION__)window.__PACEFOLD_VERSION__={...window.__PACEFOLD_VERSION__,experience:RELEASE,update:RELEASE,daylight:REVISION};
}
function refresh(force=false){
  if(document.documentElement.dataset.pacefoldSpatial!=='ready'||!id('pf22-spatial-root'))return false;
  buildDayUnfold();buildCueCluster();renderDay(force);renderCues(force);renderTaskbarSetting();stampExperience();return true;
}
function observeRibbon(){
  const sequence=id('sequence');if(!sequence||sequence.__pacefoldDaylightObserver)return;
  ribbonObserver=new MutationObserver(()=>refresh(true));ribbonObserver.observe(sequence,{subtree:true,childList:true,attributes:true,attributeFilter:['style','data-kind','data-source']});sequence.__pacefoldDaylightObserver=ribbonObserver;
}
function initialize(){
  if(!refresh(true))return;
  observeRibbon();
  if(!observer){observer=new MutationObserver(()=>refresh(true));observer.observe(document.body,{attributes:true,attributeFilter:['data-source','data-signal','data-quiet','data-day-type']})}
  for(const event of ['pacefold:ma-prefs','pacefold:storage-changed','pacefold:quiet','pacefold:spatial-hardening','pacefold:v20-attention'])window.addEventListener(event,()=>refresh(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});
  clearInterval(timer);timer=setInterval(()=>refresh(false),1000);
  window.__PACEFOLD_DAYLIGHT__={release:RELEASE,revision:REVISION,refresh:()=>refresh(true),sources:dueSources,resolvedDay};
  window.dispatchEvent(new CustomEvent('pacefold:daylight-ready',{detail:{release:RELEASE,revision:REVISION}}));
}

window.addEventListener('pacefold:spatial-ready',initialize,{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initialize,0),{once:true});else setTimeout(initialize,0);
})();
