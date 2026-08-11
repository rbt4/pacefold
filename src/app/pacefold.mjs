import{VERSION,REVISION,KEYS,DEFAULT_PREFS,ALERT_PRAYERS,parseJson,clamp,cleanText,migratePrefs,zoneParts,dateKey,zonedDate,scheduleState,workRange,normalizeNotes,normalizeLog,eventsForDay,metricsForDay,backupPayload}from'./core.mjs';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const id=value=>document.getElementById(value);
const el=(tag,className='',text='')=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined&&text!==null&&text!=='')node.textContent=String(text);return node};
const button=(className,label,text='')=>{const node=el('button',className,text);node.type='button';node.setAttribute('aria-label',label);return node};
const safeGet=(key,fallback)=>parseJson(localStorage.getItem(key),fallback);
const durationText=milliseconds=>{const minutes=Math.max(0,Math.round(Number(milliseconds||0)/60000)),hours=Math.floor(minutes/60),rest=minutes%60;return hours?`${hours}h${rest?` ${rest}m`:''}`:`${minutes}m`};
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

let rawPrefs=safeGet(KEYS.prefs,{});
let prefs=migratePrefs(rawPrefs);
let notes=normalizeNotes(safeGet(KEYS.notes,[]));
let log=normalizeLog(safeGet(KEYS.log,{}));
let mode='home',selectedDate=dateKey(new Date(),prefs.timeZone),calendarCursor=new Date(`${selectedDate}T12:00:00`),settingsTab='essentials',editingNoteId='';
let clockTimer=0,minuteSeen=-1,toastTimer=0,idleDeadline=0,idleTimer=0,weatherBusy=false,backupTimer=0,liveBackupHandle=null;
let cueState=safeGet(KEYS.cueState,{ack:{},notified:{},snoozeUntil:0}),currentCues=[];
let audioContext=null,audioSource=null,audioGain=null,localAudioUrl='',soundPlaying=false;
let oneNoteClient=null,oneNoteCatalog=[],oneNotePickerMode='';
const CUE_COLORS={water:'#4b8fb0',prayer:'#4c8a6a',prep:'#bd7f33',away:'#806699',meal:'#b06653',eyes:'#5d85a5',move:'#7d8751',focus:'#58645e'};

function storePrefs(patch={},reason='settings'){
  prefs=migratePrefs({...prefs,...patch});
  localStorage.setItem(KEYS.prefs,JSON.stringify(prefs));
  localStorage.setItem(KEYS.onboarding,'1');
  dispatchChange(KEYS.prefs,reason);
  return prefs;
}

function storeNotes(reason='notes'){
  notes=normalizeNotes(notes);
  localStorage.setItem(KEYS.notes,JSON.stringify(notes));
  dispatchChange(KEYS.notes,reason);
}

function storeLog(reason='log'){
  log.savedAt=new Date().toISOString();
  log.version=VERSION;
  localStorage.setItem(KEYS.log,JSON.stringify(log));
  dispatchChange(KEYS.log,reason);
}

function dispatchChange(key,reason){
  window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key,reason}}));
  scheduleLiveBackup();
}

function toast(message){
  const node=id('toast');node.textContent=message;node.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('on'),2200);
}

function todayKey(date=new Date()){return dateKey(date,prefs.timeZone)}
function dayEvents(key=todayKey()){return eventsForDay(log,key)}

function getDay(key=todayKey()){
  log.days=log.days||{};
  if(!log.days[key]||typeof log.days[key]!=='object')log.days[key]={date:key,createdAt:new Date().toISOString(),events:[]};
  if(!Array.isArray(log.days[key].events))log.days[key].events=[];
  return log.days[key];
}

function addMoment(type,label,detail='',at=Date.now(),source=type,meta={}){
  const day=getDay(todayKey(new Date(at))),recent=[...day.events].reverse().find(event=>event.source===source&&event.label===label);
  if(recent&&Math.abs(Number(recent.start)-at)<30000)return recent;
  const event={id:uid(type),source,type,label,detail,start:at,end:at,meta};day.events.push(event);day.events=day.events.slice(-600);storeLog(type);return event;
}

function openSession(source,type,label,detail='',at=Date.now()){
  const existing=findOpen(source);if(existing)return existing;
  const day=getDay(todayKey(new Date(at))),event={id:uid(type),source,type,label,detail,start:at,end:null,meta:{}};day.events.push(event);storeLog(`${source}-start`);return event;
}

function findOpen(source){
  for(const key of Object.keys(log.days||{}).sort().reverse()){
    const event=[...(log.days[key]?.events||[])].reverse().find(item=>item.source===source&&!item.end);if(event)return event;
  }
  return null;
}

function closeSession(source,label='Complete',at=Date.now()){
  const event=findOpen(source);if(!event)return false;event.end=Math.max(Number(event.start)||at,at);event.meta={...(event.meta||{}),closedLabel:label};storeLog(`${source}-end`);return event;
}

function toggleSession(source,type,label,detail=''){
  const open=findOpen(source);if(open){closeSession(source,`${label} complete`);toast(`${label} complete`)}else{openSession(source,type,label,detail);toast(`${label} started`)}renderAll();
}

function formatTime(date,options={}){
  return new Intl.DateTimeFormat(undefined,{timeZone:prefs.timeZone,hour:'numeric',minute:'2-digit',hour12:prefs.timeFormat!=='24',...options}).format(date);
}

function formatDate(date,options={}){
  return new Intl.DateTimeFormat(undefined,{timeZone:prefs.timeZone,weekday:'long',month:'long',day:'numeric',...options}).format(date);
}

function relativeUntil(date,now=new Date()){
  const seconds=Math.round((date-now)/1000),absolute=Math.abs(seconds),future=seconds>=0;
  if(absolute<60)return future?'less than a minute':'just now';
  const minutes=Math.round(absolute/60);if(minutes<60)return future?`in ${minutes} min`:`${minutes} min ago`;
  const hours=Math.floor(minutes/60),rest=minutes%60;return future?`in ${hours}h${rest?` ${rest}m`:''}`:`${hours}h ago`;
}

function resetDailyIfNeeded(now=new Date()){
  const key=todayKey(now);if(prefs.waterDate!==key)storePrefs({waterDate:key,waterOz:0,waterSips:0,waterLastAt:0},'new-day');
}

function timerState(source,minutes){
  const map={prep:'noodleStart',away:'awayStart',meal:'lunchStart'},start=Number(prefs[map[source]])||0,duration=clamp(prefs[`${source}Minutes`]??(source==='prep'?prefs.prepMinutes:minutes),1,240,minutes)*60000;
  if(!start)return{source,start:0,duration,running:false,done:false,remaining:duration,progress:0};
  const elapsed=Date.now()-start;return{source,start,duration,running:elapsed<duration,done:elapsed>=duration,remaining:Math.max(0,duration-elapsed),progress:clamp(elapsed/duration,0,1,0)};
}

function clockParts(now=new Date()){return zoneParts(now,prefs.timeZone)}

function renderClock(now=new Date()){
  const part=clockParts(now),minutes=part.minute+part.second/60,hours=(part.hour%12)+minutes/60,root=document.documentElement;
  root.style.setProperty('--hour-angle',`${hours*30}deg`);root.style.setProperty('--minute-angle',`${minutes*6}deg`);root.style.setProperty('--second-angle',`${part.second*6}deg`);root.classList.toggle('seconds-off',!prefs.showSeconds);
  id('clock-hour').textContent=String(prefs.timeFormat==='24'?part.hour:(part.hour%12||12)).padStart(prefs.timeFormat==='24'?2:1,'0');
  id('clock-minute').textContent=String(part.minute).padStart(2,'0');id('clock-seconds').textContent=String(part.second).padStart(2,'0');id('clock-date').textContent=formatDate(now);
  id('bar-clock').textContent=formatTime(now,{second:prefs.showSeconds?'2-digit':undefined});
  const state=scheduleState(now,prefs),next=state.next,copy=id('next-moment');
  copy.querySelector('strong').textContent=next?`${next.label} · ${formatTime(next.date)}`:'Today is complete';copy.querySelector('small').textContent=next?relativeUntil(next.date,now):'';
  id('now-next-name').textContent=next?.label||'Today is complete';id('now-next-time').textContent=next?formatTime(next.date):'—';id('now-countdown').textContent=next?relativeUntil(next.date,now):'The next day will begin quietly.';
  const range=workRange(prefs,now),decimal=part.hour+part.minute/60+part.second/3600,progress=clamp((decimal-range.start)/(range.end-range.start),0,1,0),dayState=!range.activeDay?'Off day':decimal<range.start?'Before work':decimal>range.end?'Workday complete':'Workday unfolding';
  $('.day-sky').style.setProperty('--progress',String(progress));id('day-percent').textContent=`${Math.round(progress*100)}%`;id('day-copy').textContent=dayState;id('day-phase').textContent=range.activeDay?'Workday':'Off day';id('work-start').textContent=formatTime(zonedForToday(range.start,now));id('work-end').textContent=formatTime(zonedForToday(range.end,now));
  id('clock-status').textContent=prefs.quietMode?'Quiet mode is keeping only essentials':currentCues.length?`${currentCues.length} quiet cue${currentCues.length===1?'':'s'} waiting`:'Quietly keeping pace';
  renderDayMarkers(state,range,now);
}

function zonedForToday(hours,now=new Date()){
  const part=zoneParts(now,prefs.timeZone);return zonedDate(part.year,part.month,part.day,hours,prefs.timeZone);
}

function renderDayMarkers(state,range,now){
  const container=id('day-markers'),key=`${todayKey(now)}|${range.start}|${range.end}|${state.today.map(item=>`${item.id}:${item.hours.toFixed(3)}`).join('|')}`;
  if(container.dataset.key===key)return;container.dataset.key=key;container.replaceChildren();
  for(const item of state.today){if(item.hours<range.start||item.hours>range.end)continue;const node=button('',`${item.label} at ${formatTime(item.date)}`);node.style.setProperty('--marker',String((item.hours-range.start)/(range.end-range.start)));node.addEventListener('click',()=>go('now'));container.append(node)}
}

function rhythmRows(container,state,now,compact=false){
  container.replaceChildren();
  for(const item of state.today){
    const row=el(compact?'button':'div','rhythm-row');if(compact)row.type='button';const isNext=state.next&&state.next.id===item.id&&todayKey(state.next.date)===todayKey(now);row.dataset.state=item.date<now?'past':isNext?'next':'upcoming';row.append(el('i'),el('span','',item.label),el('strong','',formatTime(item.date)));if(compact)row.addEventListener('click',()=>go('now'));container.append(row);
  }
}

function renderRhythm(now=new Date()){
  const state=scheduleState(now,prefs),muslim=state.muslim;id('rhythm-kicker').textContent=muslim?'Prayer rhythm':'Personal rhythm';id('rhythm-title').textContent=state.next?`Next · ${state.next.label}`:'Today complete';
  id('rhythm-meta').textContent=muslim?`${prefs.locationLabel} · ${prefs.method}° · ${prefs.asr==='hanafi'?'Hanafi Asr':'Standard Asr'} · ${prefs.timeZone}`:`${prefs.locationLabel||prefs.timeZone} · editable moments`;
  rhythmRows(id('rhythm-list'),state,now,true);rhythmRows(id('now-schedule-list'),state,now,false);id('now-schedule-kicker').textContent=muslim?'Prayer schedule':'Today’s moments';id('now-schedule-date').textContent=formatDate(now,{weekday:undefined});
}

function renderActions(){
  resetDailyIfNeeded();const water=clamp(prefs.waterOz??prefs.waterSips,0,256,0),waterProgress=clamp(water/prefs.waterTarget,0,1,0),prep=timerState('prep',prefs.prepMinutes),away=timerState('away',prefs.awayMinutes),meal=timerState('meal',prefs.mealMinutes),states={prep,away,meal};
  id('water-state').textContent=`${water} / ${prefs.waterTarget} oz`;id('water-meter').closest('.quick-action').style.setProperty('--meter',String(waterProgress));
  for(const [source,state] of Object.entries(states)){const control=$(`[data-action="${source}"]`),copy=id(`${source}-state`);control.dataset.active=String(Boolean(state.start));control.style.setProperty('--meter',String(state.progress));copy.textContent=state.done?'Ready · tap to clear':state.running?`${Math.ceil(state.remaining/60000)} min left`:`${state.duration/60000} min`;}
  const eyeDue=currentCues.some(cue=>cue.source==='eyes'),moveDue=currentCues.some(cue=>cue.source==='move'),waterDue=currentCues.some(cue=>cue.source==='water');$('[data-action="eyes"]').dataset.due=String(eyeDue);$('[data-action="move"]').dataset.due=String(moveDue);$('[data-action="water"]').dataset.due=String(waterDue);
  id('eyes-state').textContent=eyeDue?'Due now':'20-second reset';id('move-state').textContent=moveDue?'Due now':`${prefs.bodyCadence}-min cadence`;
}

function computeCues(now=new Date()){
  const range=workRange(prefs,now),part=clockParts(now),decimal=part.hour+part.minute/60,within=range.activeDay&&decimal>=range.start&&decimal<=range.end,snoozed=Date.now()<Number(cueState.snoozeUntil||0),cues=[];
  if(snoozed)return[];
  const schedule=scheduleState(now,prefs);for(const item of schedule.today){if(!item.alert)continue;const minutes=(now-item.date)/60000,key=`prayer:${todayKey(item.date)}:${item.id}`;if(minutes>=0&&minutes<=20&&!cueState.ack[key])cues.push({source:'prayer',key,label:item.label,detail:`${item.label} · ${formatTime(item.date)}`,priority:100})}
  const add=(source,key,label,detail,priority)=>{if(!cueState.ack[key])cues.push({source,key,label,detail,priority})};
  const prep=timerState('prep',prefs.prepMinutes),away=timerState('away',prefs.awayMinutes),meal=timerState('meal',prefs.mealMinutes);
  if(prep.done)add('prep',`prep:${prep.start}`,'Preparation ready','Your preparation timer is complete',90);
  if(away.done)add('away',`away:${away.start}`,'Return when ready','The away timer is complete',76);
  if(meal.done)add('meal',`meal:${meal.start}`,'Meal window complete','Return when you are ready',80);
  if(within){
    const water=Number(prefs.waterOz??prefs.waterSips)||0,lastWater=Number(prefs.waterLastAt)||zonedForToday(range.start,now).getTime();if(water<prefs.waterTarget&&Date.now()-lastWater>=prefs.waterCadence*60000)add('water',`water:${todayKey(now)}:${Math.floor((Date.now()-zonedForToday(range.start,now))/Math.max(1,prefs.waterCadence*60000))}`,'Take a sip','A small hydration reset',40);
    if(!prefs.quietMode){const lastEyes=Number(prefs.gazeLastCompleted)||zonedForToday(range.start,now).getTime(),lastMove=Number(prefs.bodyLastCompleted)||zonedForToday(range.start,now).getTime();if(Date.now()-lastEyes>=prefs.eyeCadence*60000)add('eyes',`eyes:${todayKey(now)}:${Math.floor(Date.now()/(prefs.eyeCadence*60000))}`,'Look far','A 20-second distance look',35);if(Date.now()-lastMove>=prefs.bodyCadence*60000)add('move',`move:${todayKey(now)}:${Math.floor(Date.now()/(prefs.bodyCadence*60000))}`,'Change position','A short movement reset',38)}
  }
  return cues.sort((a,b)=>b.priority-a.priority);
}

function refreshCues(notify=false){
  currentCues=computeCues();const cluster=id('cue-cluster');cluster.replaceChildren();
  for(const cue of currentCues.slice(0,7)){const dot=el('i','cue-dot');dot.dataset.source=cue.source;dot.title=cue.label;cluster.append(dot)}
  cluster.setAttribute('aria-label',currentCues.length?`Waiting cues: ${currentCues.map(cue=>cue.label).join(', ')}`:'No waiting cues');
  renderCuePanel();updateFaviconAndBadge();if(notify)void deliverNotification(currentCues[0]);
}

function renderCuePanel(){
  const list=id('now-cue-list'),count=id('now-cue-count'),guidance=id('now-guidance'),clear=id('now-clear-cue'),snooze=id('now-snooze');if(!list)return;list.replaceChildren();count.textContent=currentCues.length?`${currentCues.length} waiting`:'Nothing waiting';clear.disabled=!currentCues.length;snooze.disabled=!currentCues.length;
  if(!currentCues.length){const empty=el('div','cue-empty');empty.append(el('strong','','All clear'),el('span','','Pacefold will place the next quiet dot here.'));list.append(empty);guidance.textContent='The day is clear. Keep your current pace.';return}
  const lead=currentCues[0];guidance.textContent=`${lead.label}. ${lead.detail}.`;
  for(const cue of currentCues){const row=el('article','cue-row'),dot=el('i'),copy=el('span'),remove=button('',`Clear ${cue.label}`,'Clear');row.style.setProperty('--cue',CUE_COLORS[cue.source]||CUE_COLORS.focus);copy.append(el('strong','',cue.label),el('small','',cue.detail));remove.addEventListener('click',()=>{acknowledgeCue(cue);toast(`${cue.label} cleared`)});row.append(dot,copy,remove);list.append(row)}
}

async function deliverNotification(cue){
  if(!cue||!prefs.notifications||prefs.quietMode&&['water','eyes','move'].includes(cue.source)||Notification.permission!=='granted'||cueState.notified[cue.key])return;
  try{const registration=await navigator.serviceWorker?.ready;await registration?.showNotification?.(cue.label,{body:cue.detail,tag:`pacefold-${cue.source}`,silent:true,renotify:false,requireInteraction:false,icon:`./icons/notify-${cue.source==='prep'?'prepare':cue.source}.svg`,badge:'./icons/fold-mark.svg',data:{source:cue.source,key:cue.key},actions:[{action:'ack',title:'Clear'}]});cueState.notified[cue.key]=Date.now();saveCueState()}catch(error){console.warn('[Pacefold] notification failed',error)}
}

function saveCueState(){localStorage.setItem(KEYS.cueState,JSON.stringify(cueState))}
function acknowledgeCue(cue=currentCues[0]){if(!cue)return false;cueState.ack[cue.key]=Date.now();saveCueState();refreshCues();renderAll();return true}
function clearAllCues(){for(const cue of currentCues)cueState.ack[cue.key]=Date.now();saveCueState();refreshCues();renderAll();toast('Waiting dots cleared')}

function updateFaviconAndBadge(){
  try{const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const context=canvas.getContext('2d');context.fillStyle=matchMedia('(prefers-color-scheme:dark)').matches?'#e7ece7':'#18211e';context.translate(32,32);context.rotate(Math.PI/4);context.fillRect(-14,-14,28,28);context.rotate(-Math.PI/4);currentCues.slice(0,4).forEach((cue,index)=>{context.beginPath();context.arc(15+index%2*10,18+Math.floor(index/2)*10,4,0,Math.PI*2);context.fillStyle=CUE_COLORS[cue.source]||'#66716b';context.fill()});id('app-favicon').href=canvas.toDataURL('image/png')}catch{}
  try{if(currentCues.length&&'setAppBadge'in navigator)navigator.setAppBadge(currentCues.length);else navigator.clearAppBadge?.()}catch{}
}

function performAction(action){
  const now=Date.now();
  if(action==='water'){const value=Math.min(prefs.waterTarget,Number(prefs.waterOz??prefs.waterSips??0)+prefs.waterStep);storePrefs({waterOz:value,waterSips:value,waterLastAt:now,waterDate:todayKey()},'water');addMoment('water','Water logged',`${value} of ${prefs.waterTarget} oz`,now,'water',{total:value});toast(`${value} / ${prefs.waterTarget} oz`)}
  if(action==='prep'){const state=timerState('prep',prefs.prepMinutes);if(state.start){closeSession('prep','Preparation complete');storePrefs({noodleStart:0},'prep-end');toast(state.done?'Preparation acknowledged':'Preparation stopped')}else{storePrefs({noodleStart:now,noodleMinutes:prefs.prepMinutes},'prep-start');openSession('prep','timer','Preparation timer',`${prefs.prepMinutes} minutes`,now);toast(`${prefs.prepMinutes}-minute prep started`)}}
  if(action==='away'){const state=timerState('away',prefs.awayMinutes);if(state.start){closeSession('away','Returned');storePrefs({awayStart:0},'away-end');toast('Returned to the day')}else{storePrefs({awayStart:now},'away-start');openSession('away','away','Step away',`${prefs.awayMinutes}-minute guide`,now);toast('Away timer started')}}
  if(action==='meal'){const state=timerState('meal',prefs.mealMinutes);if(state.start){closeSession('meal','Meal complete');storePrefs({lunchStart:0},'meal-end');toast('Meal complete')}else{storePrefs({lunchStart:now},'meal-start');openSession('meal','meal','Meal window',`${prefs.mealMinutes} minutes`,now);toast('Meal window started')}}
  if(action==='eyes'){storePrefs({gazeLastCompleted:now},'eyes');addMoment('eyes','Distance look','20-second eye reset',now,'eyes');toast('Distance look logged')}
  if(action==='move'){storePrefs({bodyLastCompleted:now},'move');addMoment('move','Movement reset','Changed position and moved',now,'move');toast('Movement reset logged')}
  if(action==='ack'){acknowledgeCue();toast(currentCues.length?'Cue cleared':'No waiting cue')}
  if(action==='snooze'){cueState.snoozeUntil=Date.now()+10*60000;saveCueState();refreshCues();toast('Care cues snoozed for 10 minutes')}
  refreshCues();renderAll();
}

function notesForDate(key){return notes.filter(note=>note.date===key).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt))}

function renderFold(){
  const metrics=metricsForDay(log,todayKey(),prefs),todayNotes=notesForDate(todayKey()),water=Number(prefs.waterOz??prefs.waterSips)||0,summary=id('fold-summary');summary.replaceChildren();
  for(const [label,value] of [['Notes',todayNotes.length],['Moments',metrics.events.length],['Focus',durationText(metrics.focus)],['Water',`${water}/${prefs.waterTarget}`]]){const card=button('fold-stat',`Open ${label}`);card.append(el('span','',label),el('strong','',value));card.addEventListener('click',()=>go(label==='Notes'?'notes':'worklog'));summary.append(card)}
  const recent=[...notes].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,3),list=id('fold-notes');list.replaceChildren();if(!recent.length){list.append(el('div','fold-empty','Your first note will appear here.'));return}for(const note of recent){const row=button('fold-note','Open Notes');row.append(el('small','',new Date(note.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})),el('strong','',cleanText(note.body,90)));row.addEventListener('click',()=>{selectedDate=note.date;go('notes')});list.append(row)}
}

function renderCalendar(){
  const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth(),first=new Date(year,month,1),start=new Date(year,month,1-first.getDay()),grid=id('calendar-grid');id('calendar-title').textContent=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});grid.replaceChildren();
  for(let index=0;index<42;index+=1){const date=new Date(start.getFullYear(),start.getMonth(),start.getDate()+index),key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,count=notesForDate(key).length,node=button('',date.toLocaleDateString(),date.getDate());node.dataset.date=key;node.dataset.month=String(date.getMonth()===month);node.dataset.selected=String(key===selectedDate);node.dataset.today=String(key===todayKey());if(count)node.dataset.count=String(count);node.addEventListener('click',()=>{if(editingNoteId)resetNoteComposer();selectedDate=key;renderNotes()});grid.append(node)}
  const prefix=`${year}-${String(month+1).padStart(2,'0')}`,monthNotes=notes.filter(note=>note.date.startsWith(prefix)),activeDays=new Set(monthNotes.map(note=>note.date)).size,followUps=monthNotes.filter(note=>note.category==='Follow-up').length,summary=id('calendar-summary');summary.replaceChildren();for(const [label,value] of [['Notes',monthNotes.length],['Active days',activeDays],['Follow-ups',followUps],['Selected',notesForDate(selectedDate).length]]){const item=el('span');item.append(el('small','',label),el('strong','',value));summary.append(item)}
}

function renderNotes(){
  renderCalendar();const search=id('note-search').value.trim().toLowerCase(),filter=id('note-filter').value,base=search?notes:notesForDate(selectedDate),rows=base.filter(note=>(!search||`${note.body} ${note.category}`.toLowerCase().includes(search))&&(filter==='all'||note.category===filter)).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)),date=new Date(`${selectedDate}T12:00:00`),global=Boolean(search);id('notes-total').textContent=`${notes.length} note${notes.length===1?'':'s'}`;id('note-date-kicker').textContent=global?'Across your Daybook':selectedDate===todayKey()?'Today':'Selected day';id('note-date-title').textContent=global?`${rows.length} search result${rows.length===1?'':'s'}`:date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  const words=rows.reduce((total,note)=>total+note.body.trim().split(/\s+/).filter(Boolean).length,0),kinds=new Set(rows.map(note=>note.category)).size,insights=id('note-insights');insights.replaceChildren();for(const [label,value,color] of [['Entries',rows.length,'#426b5b'],['Words',words,'#3f718b'],['Kinds',kinds,'#a66f2d']]){const item=el('div','note-insight'),copy=el('span');item.style.setProperty('--insight',color);copy.append(el('small','',label),el('strong','',String(value)));item.append(el('i'),copy);insights.append(item)}
  const list=id('note-list');list.replaceChildren();if(!rows.length){const empty=el('div','empty-state');empty.append(el('strong','',search?'No notes match that search':'This page is still quiet'),el('span','',search?'Try fewer words.':'Capture the first useful thing above.'));list.append(empty);return}
  for(const note of rows){const card=el('article','note-item'),head=el('header'),tools=el('div'),edit=button('',`Edit note`,'Edit'),remove=button('',`Delete note`,'Delete'),footer=el('footer'),stamp=new Date(note.updatedAt);card.dataset.kind=note.category;edit.dataset.noteEdit=note.id;remove.dataset.noteDelete=note.id;tools.append(edit,remove);head.append(el('span','',note.category),tools);footer.append(el('span','',stamp.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})),el('b','',note.syncedAt?'Copied to OneNote':'Local'));card.append(head,el('p','',note.body),footer);list.append(card)}
}

function saveNote(event){
  event.preventDefault();const body=id('note-input').value.trim();if(!body){toast('Write something first');return}const now=new Date().toISOString();if(editingNoteId){const note=notes.find(item=>item.id===editingNoteId);if(!note){resetNoteComposer();toast('That note is no longer available');return}note.body=body.slice(0,6000);note.category=id('note-category').value;note.updatedAt=now;note.syncedAt=0;storeNotes('note-edit');resetNoteComposer();renderAll();toast('Note updated locally');void syncOneNote(false);return}const note={id:uid('note'),date:selectedDate,body:body.slice(0,6000),category:id('note-category').value,createdAt:now,updatedAt:now,syncedAt:0,syncError:''};notes.push(note);storeNotes('note-add');addMoment('note','Note captured',cleanText(body,80),Date.now(),'note');resetNoteComposer();id('note-save-status').textContent='Saved locally';renderAll();toast('Note kept locally');void syncOneNote(false);
}

function editNote(note){
  editingNoteId=note.id;selectedDate=note.date;calendarCursor=new Date(`${note.date}T12:00:00`);id('note-input').value=note.body;id('note-category').value=note.category;id('note-form').dataset.editing='true';id('note-submit').textContent='Update note';id('note-cancel').hidden=false;id('note-save-status').textContent='Editing local note';id('note-count').textContent=`${note.body.length} / 6000`;renderNotes();id('note-form').scrollIntoView({behavior:'smooth',block:'center'});id('note-input').focus({preventScroll:true})
}

function resetNoteComposer(){editingNoteId='';id('note-input').value='';id('note-form').dataset.editing='false';id('note-submit').textContent='Keep this';id('note-cancel').hidden=true;id('note-save-status').textContent='Saved on this device';id('note-count').textContent='0 / 6000'}

async function deleteNote(note){
  const confirmed=await confirmAction('Delete this note?','This removes the local note. Your downloaded backups are not changed.');if(!confirmed)return;notes=notes.filter(item=>item.id!==note.id);if(editingNoteId===note.id)resetNoteComposer();storeNotes('note-delete');renderAll();toast('Note deleted')
}

function renderWorklog(){
  const key=todayKey(),metrics=metricsForDay(log,key,prefs),todayNotes=notesForDate(key),values=[['Elapsed',metrics.elapsed],['Desk',metrics.desk],['Focus',metrics.focus],['Away',metrics.away+metrics.meal],['Breaks',metrics.breaks],['Notes',todayNotes.length]],grid=id('metric-grid');grid.replaceChildren();
  for(const [label,value] of values){const card=el('article','metric-card');card.dataset.tone=label.toLowerCase();card.append(el('span','',label),el('strong','',typeof value==='number'&&!['Breaks','Notes'].includes(label)?durationText(value):value));grid.append(card)}
  const elapsed=Math.max(1,metrics.elapsed),segments=[['Desk',metrics.desk,'#426b5b'],['Away',metrics.away,'#77638e'],['Meal',metrics.meal,'#a25047'],['Field',metrics.field,'#3f718b']],bar=id('day-balance-bar'),legend=id('day-balance-legend');bar.replaceChildren();legend.replaceChildren();for(const [label,value,color] of segments){if(value>0){const segment=el('span');segment.style.setProperty('--segment',color);segment.style.width=`${Math.max(1,value/elapsed*100)}%`;bar.append(segment)}const keyNode=el('span','balance-key'),dot=el('i');keyNode.style.setProperty('--segment',color);keyNode.append(dot,el('span','',`${label} ${durationText(value)}`));legend.append(keyNode)}if(!bar.children.length){const idle=el('span');idle.style.setProperty('--segment','rgba(102,113,107,.18)');idle.style.width='100%';bar.append(idle)}
  const eventCount=metrics.events.length,title=!eventCount?'A quiet start':metrics.focus>=45*60000?'Deep work is taking shape':metrics.elapsed>=2*3600000&&!metrics.breaks?'The day needs one reset':metrics.breaks>=2?'A balanced pace':'A steady workday',copy=!eventCount?'Clock actions will build a useful record automatically.':`${eventCount} moment${eventCount===1?'':'s'} kept · ${durationText(metrics.focus)} focused · ${metrics.breaks} reset${metrics.breaks===1?'':'s'}.`;id('day-story-title').textContent=title;id('day-story-copy').textContent=copy;
  const timeline=id('timeline'),events=metrics.events.slice().reverse();id('timeline-meta').textContent=events.length?`${events.length} moment${events.length===1?'':'s'} · newest first`:'Nothing logged yet';timeline.replaceChildren();if(!events.length){const empty=el('div','empty-state');empty.append(el('strong','','No transitions yet'),el('span','','Use Clock normally. Water, breaks, timers and notes appear here automatically.'));timeline.append(empty)}else for(const event of events){const row=el('article','timeline-row'),rail=el('span','timeline-rail'),copyNode=el('span','timeline-copy'),end=event.end&&event.end!==event.start?durationText(event.end-event.start):event.end?'Moment':'In progress',badge=el('b','',end);row.dataset.event=event.type||event.source;badge.dataset.open=String(!event.end);copyNode.append(el('strong','',event.label||event.type),el('small','',event.detail||'Pacefold moment'),badge);row.append(el('time','',formatTime(new Date(event.start))),rail,copyNode);timeline.append(row)}
  const focus=findOpen('focus'),field=findOpen('field');id('focus-toggle').textContent=focus?'End focus':'Start focus';id('focus-toggle').dataset.active=String(Boolean(focus));id('focus-tool-state').textContent=focus?`Running · ${durationText(Date.now()-focus.start)}`:'Start protected time';id('field-toggle-state').textContent=field?`Running · ${durationText(Date.now()-field.start)}`:'Start a field session';id('field-toggle').dataset.active=String(Boolean(field));
}

function renderActive(){
  const list=id('active-list'),active=[],timerStates={};for(const [source,label,minutes] of [['prep','Preparation',prefs.prepMinutes],['away','Away',prefs.awayMinutes],['meal','Meal',prefs.mealMinutes]]){const state=timerState(source,minutes);timerStates[source]=state;if(state.start)active.push([label,state.done?'Ready':`${Math.ceil(state.remaining/60000)} min left`])}const focus=findOpen('focus');if(focus)active.push(['Focus',durationText(Date.now()-focus.start)]);list.replaceChildren();if(!active.length){const empty=el('div','active-empty');empty.append(el('strong','','Nothing is running'),el('span','','Start only what helps right now.'));list.append(empty)}else for(const [label,value] of active){const row=el('div','active-item');row.append(el('strong','',label),el('span','',value));list.append(row)}for(const [source,state] of Object.entries(timerStates)){const control=$(`.now-quick [data-action="${source}"]`);if(control){control.dataset.active=String(Boolean(state.start));control.textContent=state.start?`End ${source}`:source[0].toUpperCase()+source.slice(1)}}const focusControl=$('.now-quick [data-log="focus"]');if(focusControl){focusControl.dataset.active=String(Boolean(focus));focusControl.textContent=focus?'End focus':'Focus'}
}

function renderSettings(){
  for(const node of $$('.setting-toggle')){const on=Boolean(prefs[node.dataset.setting]);node.setAttribute('aria-pressed',String(on))}id('quiet-button').setAttribute('aria-pressed',String(prefs.quietMode));
  const [start,end]=prefs.workHours.split('-');id('work-start-input').value=start;id('work-end-input').value=end;id('time-format-input').value=prefs.timeFormat;for(const input of $$('[data-workday]'))input.checked=prefs.workDays.includes(Number(input.dataset.workday));
  id('profile-input').value=prefs.profile;id('timezone-input').value=prefs.timeZone;id('location-input').value=prefs.locationLabel;id('latitude-input').value=String(prefs.lat);id('longitude-input').value=String(prefs.lng);id('method-input').value=prefs.method;id('asr-input').value=prefs.asr;
  const custom=prefs.profile==='custom';id('custom-moments').hidden=!custom;$('.muslim-settings').hidden=!['original','muslim'].includes(prefs.profile);for(const row of $$('#custom-moment-rows [data-custom-row]')){const item=prefs.customMoments[Number(row.dataset.customRow)]||['','',''];$('[data-custom-label]',row).value=item[1]||'';$('[data-custom-time]',row).value=item[2]||''}
  for(const input of $$('[data-offset]'))input.value=String(prefs.offsets[input.dataset.offset]||0);
  for(const [field,value] of [['water-target-input',prefs.waterTarget],['water-step-input',prefs.waterStep],['water-cadence-input',prefs.waterCadence],['eye-cadence-input',prefs.eyeCadence],['body-cadence-input',prefs.bodyCadence],['prep-minutes-input',prefs.prepMinutes],['meal-minutes-input',prefs.mealMinutes],['away-minutes-input',prefs.awayMinutes]])id(field).value=String(value);
  id('onenote-client-input').value=prefs.oneNoteClientId||'';id('onenote-tenant-input').value=prefs.oneNoteTenant||'organizations';id('onenote-status').textContent=prefs.oneNoteLastError?`Paused · ${prefs.oneNoteLastError}`:prefs.oneNoteSectionId?`Connected · ${prefs.oneNoteNotebookName} / ${prefs.oneNoteSectionName}${prefs.oneNoteLastSync?` · synced ${new Date(prefs.oneNoteLastSync).toLocaleString()}`:''}`:prefs.oneNoteClientId?'Configured · choose a destination':'Not configured.';
  const profileNames={original:'Original · Muslim',muslim:'Muslim',everyday:'Everyday',mindful:'Mindful',custom:'Custom'},summary=id('settings-summary'),meta=safeGet(KEYS.backupMeta,null),waiting=currentCues.length;summary.replaceChildren();for(const [label,value,color] of [['Profile',profileNames[prefs.profile]||'Original','#426b5b'],['Workday',`${formatTime(zonedForToday(Number(start.slice(0,2))+Number(start.slice(3))/60))}–${formatTime(zonedForToday(Number(end.slice(0,2))+Number(end.slice(3))/60))}`,'#3f718b'],['Cues',prefs.quietMode?'Quiet essentials':prefs.notifications?'System + dots':`${waiting} dot${waiting===1?'':'s'} waiting`,'#a66f2d'],['Backup',liveBackupHandle?'Live file connected':meta?.updatedAt?'Downloaded before':'Local only','#77638e']]){const chip=el('article','settings-chip'),copy=el('span');chip.style.setProperty('--chip',color);copy.append(el('small','',label),el('strong','',value));chip.append(el('i'),copy);summary.append(chip)}
  const health=id('data-health'),dayCount=Object.keys(log.days||{}).length,localSize=new Blob([JSON.stringify(currentBackup())]).size;health.replaceChildren();for(const [label,value] of [['Local notes',notes.length],['Recorded days',dayCount],['Local size',localSize<1024?`${localSize} B`:`${Math.round(localSize/1024)} KB`]]){const item=el('span');item.append(el('small','',label),el('strong','',value));health.append(item)}
  for(const tab of $$('#settings-nav button'))tab.classList.toggle('active',tab.dataset.settingsTab===settingsTab);for(const panel of $$('[data-settings-panel]'))panel.hidden=panel.dataset.settingsPanel!==settingsTab;
}

function renderAll(){refreshCues();renderClock();renderRhythm();renderActions();renderFold();renderNotes();renderWorklog();renderActive();renderSettings();renderWeather();}

function go(target,{directional=false}={}){
  if(!['home','notes','worklog','now','settings'].includes(target))target='home';if(directional&&mode!=='home')target='home';mode=target;document.documentElement.dataset.mode=mode;history.replaceState(null,'',mode==='home'?location.pathname:`${location.pathname}?mode=${mode}`);idleDeadline=mode==='home'?0:Date.now()+50000;id('return-cue').hidden=true;window.scrollTo({top:0,behavior:'smooth'});if(mode==='notes')requestAnimationFrame(()=>id('note-input')?.focus({preventScroll:true}));renderAll();
}

function blockedFromReturn(){return Boolean($('input:focus,textarea:focus,select:focus,dialog[open]'))}
function registerActivity(){if(mode!=='home'&&!blockedFromReturn())idleDeadline=Date.now()+50000}
function renderIdle(){if(mode==='home'||!idleDeadline){id('return-cue').hidden=true;return}if(blockedFromReturn()){idleDeadline=Date.now()+50000;id('return-cue').hidden=true;return}const seconds=Math.max(0,Math.ceil((idleDeadline-Date.now())/1000));id('return-cue').hidden=seconds>10;id('return-cue').textContent=`Clock in ${seconds}s`;if(!seconds)go('home')}

function settingsInput(){
  const start=id('work-start-input').value,end=id('work-end-input').value;if(start&&end&&start<end)storePrefs({workHours:`${start}-${end}`},'work-hours');
  const workDays=$$('[data-workday]:checked').map(input=>Number(input.dataset.workday));storePrefs({workDays},'work-days');
  const customMoments=$$('#custom-moment-rows [data-custom-row]').map((row,index)=>[`custom-${index+1}`,$('[data-custom-label]',row).value.trim(),$('[data-custom-time]',row).value]).filter(row=>row[1]&&row[2]);
  storePrefs({profile:id('profile-input').value,timeFormat:id('time-format-input').value,timeZone:id('timezone-input').value.trim()||DEFAULT_PREFS.timeZone,locationLabel:id('location-input').value.trim()||'My location',lat:Number(id('latitude-input').value),lng:Number(id('longitude-input').value),method:id('method-input').value,asr:id('asr-input').value,customMoments:customMoments.length?customMoments:prefs.customMoments,waterTarget:Number(id('water-target-input').value),waterStep:Number(id('water-step-input').value),waterCadence:Number(id('water-cadence-input').value),eyeCadence:Number(id('eye-cadence-input').value),bodyCadence:Number(id('body-cadence-input').value),prepMinutes:Number(id('prep-minutes-input').value),mealMinutes:Number(id('meal-minutes-input').value),awayMinutes:Number(id('away-minutes-input').value)},'settings-form');renderAll();
}

async function toggleSetting(key){
  if(key==='notifications'&&!prefs.notifications){if(!('Notification'in window)){toast('System notifications are unavailable here');return}const permission=await Notification.requestPermission();if(permission!=='granted'){toast('Notifications were not allowed');return}}
  storePrefs({[key]:!prefs[key]},key);if(key==='quietMode'&&prefs.quietMode)clearAllNotifications();renderAll();
}

async function useDeviceLocation(){
  if(!navigator.geolocation){toast('Location is unavailable in this browser');return}id('use-location').disabled=true;navigator.geolocation.getCurrentPosition(position=>{id('use-location').disabled=false;storePrefs({lat:position.coords.latitude,lng:position.coords.longitude,locationLabel:'Current location',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||prefs.timeZone},'location');renderAll();toast('Location updated')},error=>{id('use-location').disabled=false;toast(error.code===1?'Location permission was not allowed':'Location could not be read')},{enableHighAccuracy:false,timeout:10000,maximumAge:86400000});
}

function weatherCode(code){const map={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Showers',82:'Heavy showers',95:'Thunderstorm'};return map[code]||'Current conditions'}
async function fetchWeather(force=false){
  if(!prefs.weatherEnabled||weatherBusy)return;const cached=safeGet(KEYS.weather,null);if(!force&&cached&&Date.now()-cached.savedAt<20*60000){renderWeather(cached);return}weatherBusy=true;try{const query=new URLSearchParams({latitude:String(prefs.lat),longitude:String(prefs.lng),current:'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',timezone:prefs.timeZone,forecast_days:'1'}),response=await fetch(`https://api.open-meteo.com/v1/forecast?${query}`);if(!response.ok)throw new Error(`Weather ${response.status}`);const data=await response.json(),value={savedAt:Date.now(),current:data.current,units:data.current_units};localStorage.setItem(KEYS.weather,JSON.stringify(value));renderWeather(value)}catch(error){id('weather-content').replaceChildren(el('p','',navigator.onLine?'Weather could not refresh.':'Offline · showing no cached weather.'));console.warn(error)}finally{weatherBusy=false}}
function renderWeather(value=safeGet(KEYS.weather,null)){
  id('weather-place').textContent=prefs.locationLabel||'Outside';const content=id('weather-content');if(!prefs.weatherEnabled){content.replaceChildren(el('p','','Weather is off in Settings.'));return}if(!value?.current){content.replaceChildren(el('p','','Weather will appear after the next refresh.'));return}const current=value.current,reading=el('div','weather-reading'),detail=el('span');detail.append(el('b','',weatherCode(current.weather_code)),el('small','',`Feels ${Math.round(current.apparent_temperature)}° · wind ${Math.round(current.wind_speed_10m)} km/h`));reading.append(el('strong','',`${Math.round(current.temperature_2m)}°`),detail);content.replaceChildren(reading,el('p','',current.precipitation>0?`${current.precipitation} mm precipitation now.`:'No measurable precipitation now.'))
}

function download(name,type,content){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),anchor=el('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function currentBackup(){return backupPayload({prefs,notes,log,player:{soundChoice:prefs.soundChoice,soundVolume:prefs.soundVolume}})}
function downloadBackup(){download(`pacefold-backup-${todayKey()}.json`,'application/json',JSON.stringify(currentBackup(),null,2));toast('Backup downloaded')}

async function restoreBackupFile(file){
  try{const data=JSON.parse(await file.text());if(!['pacefold.backup.v1','pacefold.backup.v2','pacefold.backup.v3'].includes(data.format))throw new Error('Not a Pacefold backup');const restoredNotes=normalizeNotes(data.notes||data.entries||[]),confirmed=await confirmAction('Restore this Pacefold backup?',`This will replace current settings, notes and day log with ${restoredNotes.length} notes from the selected file.`);if(!confirmed)return;prefs=migratePrefs(data.prefs||{});notes=restoredNotes;log=normalizeLog(data.log||{});localStorage.setItem(KEYS.prefs,JSON.stringify(prefs));localStorage.setItem(KEYS.notes,JSON.stringify(notes));localStorage.setItem(KEYS.log,JSON.stringify(log));localStorage.setItem(KEYS.onboarding,'1');selectedDate=todayKey();calendarCursor=new Date(`${selectedDate}T12:00:00`);renderAll();toast('Backup restored')}catch(error){toast(error.message||'Backup could not be restored')}
}

function backupDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open('pacefold-v25',1);request.onupgradeneeded=()=>request.result.createObjectStore('handles');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function storeHandle(handle){const db=await backupDb();await new Promise((resolve,reject)=>{const tx=db.transaction('handles','readwrite');tx.objectStore('handles').put(handle,'backup');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}
async function readHandle(){try{const db=await backupDb(),handle=await new Promise((resolve,reject)=>{const tx=db.transaction('handles','readonly'),request=tx.objectStore('handles').get('backup');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});db.close();return handle}catch{return null}}
async function chooseLiveBackup(){
  if(!window.showSaveFilePicker){toast('Live backup files require Edge or another Chromium browser');return}try{const handle=await showSaveFilePicker({suggestedName:`pacefold-live-backup.json`,types:[{description:'Pacefold JSON backup',accept:{'application/json':['.json']}}]});liveBackupHandle=handle;await storeHandle(handle);await writeLiveBackup(true);renderBackupStatus();toast('Live backup file connected')}catch(error){if(error.name!=='AbortError')toast('Backup file could not be connected')}
}
async function writeLiveBackup(requestPermission=false){
  if(!liveBackupHandle)return false;try{let permission=await liveBackupHandle.queryPermission({mode:'readwrite'});if(permission!=='granted'&&requestPermission)permission=await liveBackupHandle.requestPermission({mode:'readwrite'});if(permission!=='granted')return false;const writable=await liveBackupHandle.createWritable();await writable.write(JSON.stringify(currentBackup(),null,2));await writable.close();localStorage.setItem(KEYS.backupMeta,JSON.stringify({name:liveBackupHandle.name,updatedAt:Date.now()}));renderBackupStatus();return true}catch(error){console.warn('[Pacefold] live backup failed',error);return false}}
function scheduleLiveBackup(){if(!liveBackupHandle)return;clearTimeout(backupTimer);backupTimer=setTimeout(()=>void writeLiveBackup(false),900)}
function renderBackupStatus(){const meta=safeGet(KEYS.backupMeta,null);id('backup-status').textContent=liveBackupHandle?`Live backup · ${liveBackupHandle.name}${meta?.updatedAt?` · updated ${new Date(meta.updatedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`:''}`:'Local browser storage is active. Connect a file if you want a second copy updated after changes.'}

async function confirmAction(title,copy){
  const dialog=id('confirm-dialog');id('confirm-title').textContent=title;id('confirm-copy').textContent=copy;dialog.showModal();return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true}))
}

function noiseBuffer(context,choice){const length=Math.floor(context.sampleRate*8),buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);let brown=0;for(let index=0;index<length;index+=1){const white=Math.random()*2-1;if(choice==='brown'){brown=(brown+.035*white)/1.035;data[index]=brown*3.2}else if(choice==='rain'){data[index]=white*.2+(Math.random()<.0008?white*.8:0)}else data[index]=white*.14+Math.sin(index/context.sampleRate*Math.PI*2*58)*.016}return buffer}
async function startSound(){
  try{stopSound(false);const choice=prefs.soundChoice;if(choice==='local'){if(!localAudioUrl){id('audio-file-input').click();return}const audio=id('audio-player');audio.src=localAudioUrl;audio.loop=true;audio.volume=prefs.soundVolume;await audio.play()}else{const Context=window.AudioContext||window.webkitAudioContext;audioContext=new Context();audioGain=audioContext.createGain();audioGain.gain.value=prefs.soundVolume;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=choice==='rain'?3600:choice==='fan'?1100:720;audioSource=audioContext.createBufferSource();audioSource.buffer=noiseBuffer(audioContext,choice);audioSource.loop=true;audioSource.connect(filter).connect(audioGain).connect(audioContext.destination);audioSource.start()}soundPlaying=true;renderSound()}catch(error){console.warn(error);stopSound();toast('Focus sound could not start')}}
function stopSound(render=true){try{audioSource?.stop()}catch{}audioSource=null;if(audioContext){audioContext.close().catch(()=>{});audioContext=null}const audio=id('audio-player');audio.pause();audio.removeAttribute('src');audio.load();soundPlaying=false;if(render)renderSound()}
function renderSound(){const names={brown:'Brown hush',rain:'Rain glass',fan:'Soft fan',local:prefs.soundLabel||'Local audio'};id('sound-bar').dataset.playing=String(soundPlaying);id('sound-toggle').textContent=soundPlaying?'Ⅱ':'▶';id('sound-toggle').setAttribute('aria-label',soundPlaying?'Pause focus sound':'Play focus sound');id('sound-name').textContent=names[prefs.soundChoice]||'Brown hush';id('sound-choice').value=prefs.soundChoice;id('sound-volume').value=String(prefs.soundVolume)}

async function clearAllNotifications(){try{const registration=await navigator.serviceWorker?.ready,items=await registration?.getNotifications?.();items?.forEach(item=>item.close());navigator.clearAppBadge?.()}catch{}}

async function initOneNote(){
  if(!prefs.oneNoteClientId||!window.msal)throw new Error(window.msal?'Enter an Entra application ID':'Microsoft sign-in runtime is unavailable');const stamp=`${prefs.oneNoteClientId}:${prefs.oneNoteTenant}`;if(oneNoteClient?.__stamp===stamp)return oneNoteClient;const client=new window.msal.PublicClientApplication({auth:{clientId:prefs.oneNoteClientId,authority:`https://login.microsoftonline.com/${prefs.oneNoteTenant||'organizations'}`,redirectUri:new URL('./auth.html',location.href).href},cache:{cacheLocation:'sessionStorage',storeAuthStateInCookie:false}});await client.initialize();client.__stamp=stamp;const account=client.getAllAccounts()[0];if(account)client.setActiveAccount(account);oneNoteClient=client;return client
}
async function oneNoteToken(interactive=false){const client=await initOneNote();let account=client.getActiveAccount()||client.getAllAccounts()[0];if(!account){if(!interactive)throw new Error('Microsoft sign-in required');const login=await client.loginPopup({scopes:['Notes.ReadWrite'],redirectUri:new URL('./auth.html',location.href).href,prompt:'select_account'});account=login.account;client.setActiveAccount(account);if(login.accessToken)return login.accessToken}try{return(await client.acquireTokenSilent({scopes:['Notes.ReadWrite'],account})).accessToken}catch{if(!interactive)throw new Error('Microsoft sign-in required');return(await client.acquireTokenPopup({scopes:['Notes.ReadWrite'],account,redirectUri:new URL('./auth.html',location.href).href})).accessToken}}
async function graph(path,options={},interactive=false,token=''){const accessToken=token||await oneNoteToken(interactive),response=await fetch(`https://graph.microsoft.com/v1.0${path}`,{...options,headers:{Authorization:`Bearer ${accessToken}`,...(options.headers||{})}});if(response.ok)return response;let message='';try{message=(await response.json())?.error?.message}catch{}const error=new Error(message||`Microsoft Graph ${response.status}`);error.status=response.status;throw error}
async function connectOneNote(){
  const clientId=id('onenote-client-input').value.trim(),tenant=id('onenote-tenant-input').value.trim()||'organizations';if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)){toast('Enter a valid Entra application ID');return}storePrefs({oneNoteClientId:clientId,oneNoteTenant:tenant,oneNoteLastError:''},'onenote-config');oneNoteClient=null;try{const token=await oneNoteToken(true),response=await graph('/me/onenote/notebooks?$select=id,displayName,isDefault&$top=100',{},false,token),data=await response.json();oneNoteCatalog=data.value||[];oneNotePickerMode='notebooks';renderOneNotePicker()}catch(error){storePrefs({oneNoteLastError:cleanText(error.message,180)},'onenote-error');renderSettings();toast(error.status===403?'Your Microsoft policy blocked OneNote access':'OneNote sign-in did not complete')}}
function renderOneNotePicker(){const root=id('onenote-picker');root.replaceChildren();for(const item of oneNoteCatalog){const node=button('',`Choose ${item.displayName}`,item.displayName);node.dataset.onenoteId=item.id;root.append(node)}}
async function chooseOneNoteItem(item){try{if(oneNotePickerMode==='notebooks'){storePrefs({oneNoteNotebookId:item.id,oneNoteNotebookName:item.displayName},'onenote-notebook');const response=await graph(`/me/onenote/notebooks/${encodeURIComponent(item.id)}/sections?$select=id,displayName&$top=100`,{},true),data=await response.json();oneNoteCatalog=data.value||[];oneNotePickerMode='sections';renderOneNotePicker();toast('Choose a OneNote section')}else{storePrefs({oneNoteSectionId:item.id,oneNoteSectionName:item.displayName,oneNoteLastError:''},'onenote-section');oneNoteCatalog=[];oneNotePickerMode='';renderOneNotePicker();renderSettings();toast(`OneNote destination · ${item.displayName}`);void syncOneNote(true)}}catch(error){toast(error.message||'OneNote could not load that item')}}
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function oneNoteTitle(key){return `Pacefold — ${new Date(`${key}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}`}
function noteMarkup(note){return `<p data-id="pacefold-${escapeHtml(note.id)}"><b>${escapeHtml(note.category)} · ${escapeHtml(new Date(note.createdAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}))}</b><br />${escapeHtml(note.body).replace(/\n/g,'<br />')}</p>`}
async function pageForDate(key,note,token){let pageId=prefs.oneNotePages?.[key];if(pageId)return pageId;const title=oneNoteTitle(key),query=new URLSearchParams({'$filter':`title eq '${title.replace(/'/g,"''")}'`,'$select':'id,title','$top':'5'}),found=await (await graph(`/me/onenote/sections/${encodeURIComponent(prefs.oneNoteSectionId)}/pages?${query}`,{},false,token)).json(),page=found.value?.find(item=>item.title===title);if(page?.id)pageId=page.id;else{const html=`<!doctype html><html><head><title>${escapeHtml(title)}</title></head><body><p><i>Copied from Pacefold. The local notebook remains the source of truth.</i></p><div data-id="pacefold-notes">${noteMarkup(note)}</div></body></html>`,response=await graph(`/me/onenote/sections/${encodeURIComponent(prefs.oneNoteSectionId)}/pages`,{method:'POST',headers:{'Content-Type':'text/html; charset=utf-8','Accept':'application/json'},body:html},false,token);pageId=(await response.json()).id;note.syncedAt=Date.now()}storePrefs({oneNotePages:{...(prefs.oneNotePages||{}),[key]:pageId}},'onenote-page');return pageId}
async function syncOneNote(interactive=false){
  if(!prefs.oneNoteClientId||!prefs.oneNoteSectionId)return false;const pending=notes.filter(note=>!note.syncedAt);if(!pending.length){if(interactive)toast('OneNote is already up to date');return true}try{const token=await oneNoteToken(interactive);for(const note of pending){const pageId=await pageForDate(note.date,note,token);if(note.syncedAt)continue;const content=await (await graph(`/me/onenote/pages/${encodeURIComponent(pageId)}/content?includeIDs=true`,{headers:{Accept:'text/html'}},false,token)).text();if(!content.includes(`pacefold-${note.id}`))await graph(`/me/onenote/pages/${encodeURIComponent(pageId)}/content`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify([{target:'#pacefold-notes',action:'append',content:noteMarkup(note)}])},false,token);note.syncedAt=Date.now();note.syncError=''}storeNotes('onenote-sync');storePrefs({oneNoteLastSync:Date.now(),oneNoteLastError:''},'onenote-sync');renderSettings();if(interactive)toast(`${pending.length} note${pending.length===1?'':'s'} copied to OneNote`);return true}catch(error){for(const note of pending)note.syncError=cleanText(error.message,160);storeNotes('onenote-error');storePrefs({oneNoteLastError:cleanText(error.message,180)},'onenote-error');renderSettings();if(interactive)toast(error.message||'OneNote sync paused');return false}}
async function disconnectOneNote(){try{const client=await initOneNote(),account=client.getActiveAccount()||client.getAllAccounts()[0];if(account)await client.clearCache({account})}catch{}oneNoteClient=null;storePrefs({oneNoteNotebookId:'',oneNoteNotebookName:'',oneNoteSectionId:'',oneNoteSectionName:'',oneNotePages:{},oneNoteLastSync:0,oneNoteLastError:''},'onenote-disconnect');renderSettings();toast('OneNote disconnected · local notes kept')}

async function runSelfCheck(){
  const results=[],check=(name,ok,detail='')=>results.push(`${ok?'PASS':'FAIL'} · ${name}${detail?` · ${detail}`:''}`);try{const key='pacefold-v25-check';localStorage.setItem(key,'ok');check('Local storage',localStorage.getItem(key)==='ok');localStorage.removeItem(key)}catch(error){check('Local storage',false,error.message)}const state=scheduleState(new Date(),prefs);check('Schedule',state.today.length>=3,`${state.today.length} moments`);check('Schedule order',state.today.every((item,index,rows)=>!index||item.date>rows[index-1].date));check('Clock surface',Boolean(id('analog')&&id('day-markers')));check('Directional views',$$('[data-view]').length===5,`${$$('[data-view]').length} views`);check('Quick actions',$$('.quick-action').length===6,`${$$('.quick-action').length} actions`);check('Notes',Array.isArray(notes),`${notes.length} notes`);check('Service worker','serviceWorker'in navigator,navigator.serviceWorker?.controller?'controlling':'supported');check('Live backup',Boolean(liveBackupHandle),liveBackupHandle?.name||'not connected');id('diagnostic-output').textContent=[`Pacefold ${VERSION} · ${REVISION}`,`Time zone · ${prefs.timeZone}`,`Storage · ${new Blob([JSON.stringify(currentBackup())]).size.toLocaleString()} bytes`,'',...results].join('\n');toast(results.some(row=>row.startsWith('FAIL'))?'Self-check found an issue':'Self-check passed')
}

function bind(){
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;if(!target)return;
    const edge=target.closest('.edge[data-go]');if(edge){go(edge.dataset.go,{directional:true});return}const destination=target.closest('[data-go]');if(destination){if(destination.dataset.settingsTarget)settingsTab=destination.dataset.settingsTarget;go(destination.dataset.go);return}const action=target.closest('[data-action]');if(action){performAction(action.dataset.action);return}const noteEdit=target.closest('[data-note-edit]');if(noteEdit){const note=notes.find(item=>item.id===noteEdit.dataset.noteEdit);if(note)editNote(note);return}const noteDelete=target.closest('[data-note-delete]');if(noteDelete){const note=notes.find(item=>item.id===noteDelete.dataset.noteDelete);if(note)void deleteNote(note);return}const logAction=target.closest('[data-log]');if(logAction){const source=logAction.dataset.log;if(source==='field')toggleSession('field','field','Field work');if(source==='focus')toggleSession('focus','focus','Focus block');if(source==='reset')addMoment('move','Manual reset','Logged from Day view');renderAll();return}const tab=target.closest('[data-settings-tab]');if(tab){settingsTab=tab.dataset.settingsTab;renderSettings();return}const toggle=target.closest('[data-setting]');if(toggle){void toggleSetting(toggle.dataset.setting);return}const setup=target.closest('[data-setup-profile]');if(setup){storePrefs({profile:setup.dataset.setupProfile},'onboarding');id('setup-dialog').close();renderAll();toast('Pacefold is ready');return}const oneNoteItem=target.closest('[data-onenote-id]');if(oneNoteItem){const item=oneNoteCatalog.find(row=>String(row.id)===oneNoteItem.dataset.onenoteId);if(item)void chooseOneNoteItem(item)}});
  document.addEventListener('keydown',event=>{if($('input:focus,textarea:focus,select:focus,dialog[open]'))return;const map={ArrowUp:'notes',ArrowDown:'settings',ArrowLeft:'worklog',ArrowRight:'now'};if(map[event.key]){event.preventDefault();go(map[event.key],{directional:true})}if(event.key==='Escape'||event.key==='Home'){event.preventDefault();go('home')}});
  for(const name of ['pointerdown','wheel','touchstart'])document.addEventListener(name,registerActivity,{passive:true});
  id('quiet-button').addEventListener('click',()=>void toggleSetting('quietMode'));id('cue-cluster').addEventListener('click',()=>{go('now')});id('clear-cues').addEventListener('click',clearAllCues);
  id('note-form').addEventListener('submit',saveNote);id('note-search').addEventListener('input',renderNotes);id('note-filter').addEventListener('change',renderNotes);id('note-input').addEventListener('input',event=>{id('note-count').textContent=`${event.target.value.length} / 6000`});id('note-cancel').addEventListener('click',()=>{resetNoteComposer();renderNotes();toast('Edit cancelled')});id('calendar-prev').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar()});id('calendar-next').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar()});id('calendar-today').addEventListener('click',()=>{if(editingNoteId)resetNoteComposer();selectedDate=todayKey();calendarCursor=new Date(`${selectedDate}T12:00:00`);renderNotes()});
  id('focus-toggle').addEventListener('click',()=>toggleSession('focus','focus','Focus block'));id('export-day').addEventListener('click',()=>{const key=todayKey();download(`pacefold-day-${key}.json`,'application/json',JSON.stringify({release:VERSION,date:key,metrics:metricsForDay(log,key,prefs),notes:notesForDate(key)},null,2))});id('clear-open-sessions').addEventListener('click',()=>{for(const source of ['focus','field','prep','away','meal'])closeSession(source,'Closed manually');storePrefs({noodleStart:0,awayStart:0,lunchStart:0},'close-sessions');renderAll();toast('Open sessions closed')});
  for(const input of $$('.settings-panels input,.settings-panels select'))if(!['note-search'].includes(input.id))input.addEventListener('change',settingsInput);for(const input of $$('[data-offset]'))input.addEventListener('change',()=>{storePrefs({offsets:{...prefs.offsets,[input.dataset.offset]:Number(input.value)||0}},'prayer-offset');renderAll()});id('use-location').addEventListener('click',useDeviceLocation);
  id('weather-refresh').addEventListener('click',()=>void fetchWeather(true));id('backup-download').addEventListener('click',downloadBackup);id('backup-restore').addEventListener('click',()=>id('restore-file-input').click());id('restore-file-input').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)void restoreBackupFile(file);event.target.value=''});id('backup-file').addEventListener('click',chooseLiveBackup);
  id('onenote-connect').addEventListener('click',connectOneNote);id('onenote-sync').addEventListener('click',()=>void syncOneNote(true));id('onenote-disconnect').addEventListener('click',disconnectOneNote);
  id('self-check').addEventListener('click',runSelfCheck);id('reset-today').addEventListener('click',async()=>{if(!await confirmAction('Reset today’s counters?','Water and active timers will reset. Notes and completed day-log entries stay.'))return;storePrefs({waterOz:0,waterSips:0,waterDate:todayKey(),noodleStart:0,awayStart:0,lunchStart:0},'reset-today');renderAll();toast('Today’s counters reset')});id('reset-app').addEventListener('click',async()=>{if(!await confirmAction('Delete local Pacefold data?','This removes settings, notes and the day log from this browser. Download a backup first if you may need them.'))return;for(const key of Object.values(KEYS))localStorage.removeItem(key);location.reload()});
  id('sound-toggle').addEventListener('click',()=>soundPlaying?stopSound():void startSound());id('sound-choice').addEventListener('change',event=>{storePrefs({soundChoice:event.target.value},'sound');if(soundPlaying)void startSound();else renderSound()});id('sound-volume').addEventListener('input',event=>{const value=clamp(event.target.value,0,1,.18);prefs.soundVolume=value;if(audioGain&&audioContext)audioGain.gain.setTargetAtTime(value,audioContext.currentTime,.05);id('audio-player').volume=value;localStorage.setItem(KEYS.prefs,JSON.stringify(prefs))});id('sound-file').addEventListener('click',()=>id('audio-file-input').click());id('audio-file-input').addEventListener('change',event=>{const file=event.target.files?.[0];if(!file)return;if(localAudioUrl)URL.revokeObjectURL(localAudioUrl);localAudioUrl=URL.createObjectURL(file);storePrefs({soundChoice:'local',soundLabel:file.name.replace(/\.[^.]+$/,'').slice(0,70)},'sound-file');void startSound();event.target.value=''});
  id('setup-later').addEventListener('click',()=>{storePrefs({},'onboarding');id('setup-dialog').close();renderAll()});
  window.addEventListener('storage',event=>{if(event.key===KEYS.prefs)prefs=migratePrefs(parseJson(event.newValue,{}));if(event.key===KEYS.notes)notes=normalizeNotes(parseJson(event.newValue,[]));if(event.key===KEYS.log)log=normalizeLog(parseJson(event.newValue,{}));renderAll()});
  window.addEventListener('focus',()=>{renderAll();void syncOneNote(false)});document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderAll();void syncOneNote(false)}});window.addEventListener('beforeunload',()=>{if(localAudioUrl)URL.revokeObjectURL(localAudioUrl)});
  navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='PACEFOLD_ACK'){const cue=currentCues.find(item=>item.key===event.data.key)||currentCues.find(item=>item.source===event.data.source);if(cue)acknowledgeCue(cue)}});
}

function generateStatic(){
  const ticks=id('clock-ticks');for(let index=0;index<60;index+=1){const tick=el('i',index%5===0?'major':'');tick.style.setProperty('--i',String(index));ticks.append(tick)}
  const offsets=id('offset-grid');for(const key of ALERT_PRAYERS){const label=el('label','',key),input=el('input');input.type='number';input.min='-90';input.max='90';input.dataset.offset=key;label.append(input);offsets.append(label)}
  const custom=id('custom-moment-rows');for(let index=0;index<4;index+=1){const row=el('label','custom-moment-row');row.dataset.customRow=String(index);const name=el('input'),time=el('input');name.type='text';name.placeholder=`Moment ${index+1}`;name.dataset.customLabel='true';name.setAttribute('aria-label',`Custom moment ${index+1} name`);time.type='time';time.dataset.customTime='true';time.setAttribute('aria-label',`Custom moment ${index+1} time`);row.append(name,time);custom.append(row)}
}

async function registerWorker(){
  if(!('serviceWorker'in navigator)||location.protocol==='file:')return;try{const registration=await navigator.serviceWorker.register('../service-worker.js',{scope:'../'});registration.update().catch(()=>{});if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'})}catch(error){console.warn('[Pacefold] offline worker unavailable',error)}
}

async function initialize(){
  const hadExisting=Object.keys(rawPrefs||{}).length>5||localStorage.getItem(KEYS.onboarding)==='1';generateStatic();bind();resetDailyIfNeeded();liveBackupHandle=await readHandle();renderBackupStatus();renderSound();const requested=new URLSearchParams(location.search).get('mode');if(['notes','worklog','now','settings'].includes(requested))mode=requested;document.documentElement.dataset.mode=mode;renderAll();await registerWorker();void fetchWeather(false);clockTimer=setInterval(()=>{const now=new Date(),minute=now.getMinutes();renderClock(now);renderActions();renderActive();renderIdle();if(minute!==minuteSeen){minuteSeen=minute;refreshCues(true);renderRhythm(now);renderFold();void fetchWeather(false)}},1000);idleTimer=setInterval(renderIdle,1000);
  if(hadExisting){localStorage.setItem(KEYS.onboarding,'1');localStorage.setItem(KEYS.setupDismissed,'1')}else setTimeout(()=>id('setup-dialog').showModal(),420);
  requestAnimationFrame(()=>document.documentElement.classList.add('ready'));window.__PACEFOLD__={version:VERSION,revision:REVISION,get prefs(){return prefs},get notes(){return notes},get log(){return log},go,render:renderAll,schedule:()=>scheduleState(new Date(),prefs),backup:currentBackup,selfCheck:runSelfCheck};
}

initialize().catch(error=>{console.error(error);id('toast').textContent='Pacefold could not finish loading';id('toast').classList.add('on');document.documentElement.classList.add('ready')});
