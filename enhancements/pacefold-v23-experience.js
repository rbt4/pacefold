(()=>{
'use strict';
const RELEASE='23.0.0';
const REVISION='experience-r1';
const PREFS_KEY='pacefoldPrefsV15';
const PRAYERS=[['fajr','Fajr'],['sunrise','Sunrise'],['dhuhr','Dhuhr'],['asr','Asr'],['maghrib','Maghrib'],['isha','Isha']];
const ALERTS=new Set(['fajr','dhuhr','asr','maghrib','isha']);
const IDLE_SECONDS=32;
let idleDeadline=0,idleTimer=0,minuteTimer=0,lastScheduleKey='',lastPhase='',initialized=false;
const $=selector=>document.querySelector(selector);
const id=value=>document.getElementById(value);
const create=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content!=null)node.textContent=String(content);return node};
const button=(className,label,content='')=>{const node=create('button',className,content);node.type='button';node.setAttribute('aria-label',label);return node};
const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
const prefs=()=>window.__PACEFOLD_MA_CORE__?.getPrefs?.()||parse(localStorage.getItem(PREFS_KEY),{})||{};
const localKey=(value=new Date())=>{const date=value instanceof Date?value:new Date(value);return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const clamp=(value,min,max,fallback)=>{value=Number(value);return Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback};
const dtr=value=>value*Math.PI/180,rtd=value=>value*180/Math.PI;
const dsin=value=>Math.sin(dtr(value)),dcos=value=>Math.cos(dtr(value)),dtan=value=>Math.tan(dtr(value));
const dasin=value=>rtd(Math.asin(value)),dacos=value=>rtd(Math.acos(value)),datan2=(y,x)=>rtd(Math.atan2(y,x)),dacot=value=>rtd(Math.atan2(1,value));
const fixA=value=>{value%=360;return value<0?value+360:value},fixH=value=>{value%=24;return value<0?value+24:value};
function updatePrefs(patch){
  try{
    const core=window.__PACEFOLD_MA_CORE__;
    if(core?.updatePrefs)core.updatePrefs(patch);
    else localStorage.setItem(PREFS_KEY,JSON.stringify({...prefs(),...patch}));
    window.dispatchEvent(new CustomEvent('pacefold:ma-prefs',{detail:{source:'experience'}}));
    window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:PREFS_KEY,source:'experience'}}));
  }catch{}
}
function addDayflow(type,label,detail,start=Date.now(),source=type){try{window.__PACEFOLD_DAYFLOW__?.add?.(type,label,detail,start,`experience-${source}`)}catch{}}
function julian(year,month,day){if(month<=2){year-=1;month+=12}const a=Math.floor(year/100),b=2-a+Math.floor(a/4);return Math.floor(365.25*(year+4716))+Math.floor(30.6001*(month+1))+day+b-1524.5}
function sunPos(jd){const d=jd-2451545,g=fixA(357.529+.98560028*d),q=fixA(280.459+.98564736*d),l=fixA(q+1.915*dsin(g)+.020*dsin(2*g)),e=23.439-.00000036*d,ra=datan2(dcos(e)*dsin(l),dcos(l))/15,eqt=q/15-fixH(ra),decl=dasin(dsin(e)*dsin(l));return{decl,eqt}}
function computePrayerTimes(date=new Date(),value=prefs()){
  const lat=clamp(value.lat,-90,90,43.62),lng=clamp(value.lng,-180,180,-79.51),tz=-date.getTimezoneOffset()/60,jd=julian(date.getFullYear(),date.getMonth()+1,date.getDate())-lng/(15*24),mid=time=>fixH(12-sunPos(jd+time).eqt);
  const angleAt=(angle,time,direction)=>{const decl=sunPos(jd+time).decl,noon=mid(time),x=(-dsin(angle)-dsin(decl)*dsin(lat))/(dcos(decl)*dcos(lat)),span=(1/15)*dacos(Math.min(1,Math.max(-1,x)));return noon+(direction==='ccw'?-span:span)};
  const asrAt=(factor,time)=>{const decl=sunPos(jd+time).decl,angle=-dacot(factor+dtan(Math.abs(lat-decl)));return angleAt(angle,time,'cw')};
  const angle=value.method==='18'?18:15,asrFactor=value.asr==='hanafi'?2:1;
  const times={fajr:5,sunrise:6,dhuhr:12,asr:13,sunset:18,maghrib:18,isha:19};
  for(let index=0;index<4;index+=1){const part={};for(const key of Object.keys(times))part[key]=times[key]/24;times.fajr=angleAt(angle,part.fajr,'ccw');times.sunrise=angleAt(.833,part.sunrise,'ccw');times.dhuhr=mid(part.dhuhr);times.asr=asrAt(asrFactor,part.asr);times.sunset=angleAt(.833,part.sunset,'cw');times.maghrib=angleAt(.833,part.maghrib,'cw');times.isha=angleAt(angle,part.isha,'cw')}
  const adjustment=tz-lng/15;for(const key of Object.keys(times))times[key]+=adjustment;times.dhuhr+=1/60;
  const offsets=value.offsets&&typeof value.offsets==='object'?value.offsets:{};for(const key of ALERTS)times[key]+=(Number(offsets[key])||0)/60;
  return times;
}
function parseClock(value){const match=String(value||'').match(/^(\d{1,2}):(\d{2})$/);if(!match)return 0;return Number(match[1])+Number(match[2])/60}
function scheduleForDate(date=new Date(),includeSunrise=false,value=prefs()){
  const muslim=['original','muslim'].includes(String(value.profile||'original'));
  if(muslim){const times=computePrayerTimes(date,value);return PRAYERS.filter(([key])=>includeSunrise||ALERTS.has(key)).map(([key,label])=>({id:key,label,time:times[key],auto:true}))}
  const fallback=[['morning-reset','Morning reset','09:30'],['midday-pause','Midday pause','12:30'],['afternoon-reset','Afternoon reset','15:00']];
  const source=Array.isArray(value.customMoments)&&value.customMoments.length?value.customMoments:fallback;
  return source.map((item,index)=>Array.isArray(item)?{id:String(item[0]||`moment-${index+1}`),label:String(item[1]||`Moment ${index+1}`),time:parseClock(item[2]),auto:false}:{id:String(item?.id||`moment-${index+1}`),label:String(item?.label||`Moment ${index+1}`),time:parseClock(item?.time),auto:false}).filter(item=>Number.isFinite(item.time)).sort((a,b)=>a.time-b.time)
}
function dateAt(date,hours){const result=new Date(date);result.setHours(0,0,0,0);result.setMinutes(Math.round(Number(hours||0)*60));return result}
function formatTime(date){return date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}
function scheduleState(date=new Date(),includeSunrise=false){
  const value=prefs(),today=scheduleForDate(date,includeSunrise,value).map(item=>({...item,date:dateAt(date,item.time)}));
  let next=today.find(item=>item.date.getTime()>date.getTime());
  if(!next){const tomorrow=new Date(date);tomorrow.setDate(tomorrow.getDate()+1);const first=scheduleForDate(tomorrow,includeSunrise,value)[0];if(first)next={...first,date:dateAt(tomorrow,first.time)}}
  return{value,today,next,muslim:['original','muslim'].includes(String(value.profile||'original'))}
}
function scheduleMeta(state){const location=text(state.value.locationLabel)||`${clamp(state.value.lat,-90,90,43.62).toFixed(2)}, ${clamp(state.value.lng,-180,180,-79.51).toFixed(2)}`;return state.muslim?`${location} · ${state.value.method==='18'?'18°':'15°'} · ${state.value.asr==='hanafi'?'Hanafi Asr':'Standard Asr'}`:`${location} · custom moments`}
function buildSchedule(){
  const hero=$('.pf22-clock-hero'),dock=id('pf23-action-dock');if(!hero)return;
  let strip=id('pf23-schedule-strip');
  if(!strip){
    strip=create('section','pf23-schedule-strip');strip.id='pf23-schedule-strip';strip.setAttribute('aria-label','Today schedule');
    strip.append(create('header','pf23-schedule-head'),create('div','pf23-schedule-items'));
    hero.insertBefore(strip,dock||$('.pf22-context-glimpse')||null);
  }
  const context=$('.pf22-context-layout');
  if(context&&!id('pf23-context-schedule')){
    const panel=create('section','pf23-context-schedule');panel.id='pf23-context-schedule';panel.append(create('header','pf23-context-schedule-head'),create('div','pf23-context-schedule-items'));
    context.append(panel);
  }
}
function renderSchedule(force=false){
  buildSchedule();const now=new Date(),state=scheduleState(now,false),full=scheduleState(now,true),key=`${localKey(now)}|${Math.floor(Date.now()/60000)}|${state.value.profile}|${state.value.lat}|${state.value.lng}|${state.value.method}|${state.value.asr}|${JSON.stringify(state.value.offsets||{})}`;
  if(!force&&key===lastScheduleKey)return;lastScheduleKey=key;
  const head=$('.pf23-schedule-head'),items=$('.pf23-schedule-items');if(head&&items){
    head.replaceChildren();const copy=create('div');copy.append(create('strong','',state.muslim?'Prayer times':'Today’s moments'),create('small','',state.next?`Next · ${state.next.label} ${formatTime(state.next.date)}`:'Schedule complete'));
    const adjust=button('pf23-schedule-adjust','Open schedule settings','Adjust');adjust.addEventListener('click',()=>{window.__PACEFOLD_SPATIAL__?.go?.('settings');setTimeout(()=>document.querySelector('.pf22-settings-card .pf22-secondary:last-of-type')?.click(),220)});head.append(copy,adjust);
    items.replaceChildren();for(const item of state.today){const node=button('pf23-schedule-item',`${item.label} at ${formatTime(item.date)}`);node.dataset.prayer=item.id;node.dataset.state=item.date<now?'past':state.next?.id===item.id&&localKey(state.next.date)===localKey(now)?'next':'upcoming';node.append(create('span','',item.label),create('strong','',formatTime(item.date)));node.addEventListener('click',()=>window.__PACEFOLD_SPATIAL__?.go?.('context'));items.append(node)}
  }
  const contextHead=$('.pf23-context-schedule-head'),contextItems=$('.pf23-context-schedule-items');if(contextHead&&contextItems){
    contextHead.replaceChildren();const copy=create('div');copy.append(create('span','pf22-eyebrow',full.muslim?'Prayer schedule':'Moment schedule'),create('h2','',full.next?`${full.next.label} · ${formatTime(full.next.date)}`:'Today is complete'),create('small','',scheduleMeta(full)));contextHead.append(copy);
    contextItems.replaceChildren();for(const item of full.today){const node=create('article','pf23-context-prayer');node.dataset.prayer=item.id;node.dataset.state=item.date<now?'past':full.next?.id===item.id&&localKey(full.next.date)===localKey(now)?'next':'upcoming';node.append(create('span','',item.label),create('strong','',formatTime(item.date)));contextItems.append(node)}
  }
}
function updateAtmosphere(){
  const root=id('pf22-spatial-root');if(!root)return;const now=new Date(),hour=now.getHours()+now.getMinutes()/60,phase=hour<6?'night':hour<11?'morning':hour<15?'midday':hour<19?'evening':'night';
  if(phase!==lastPhase){root.dataset.dayPhase=phase;lastPhase=phase}
  const value=prefs(),match=String(value.workHours||'08:30-16:30').match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/),start=match?Number(match[1])+Number(match[2])/60:8.5,end=match?Number(match[3])+Number(match[4])/60:16.5,progress=Math.max(0,Math.min(1,(hour-start)/Math.max(.25,end-start)));
  root.style.setProperty('--pf23-day-progress',String(progress));root.style.setProperty('--pf23-sun-x',`${8+progress*84}%`);root.style.setProperty('--pf23-sun-y',`${31-Math.sin(progress*Math.PI)*18}%`);
}
function toast(message){const node=id('pf23-action-toast');if(node){node.textContent=message;node.dataset.visible='true';setTimeout(()=>{node.dataset.visible='false'},1900)}}
function directAction(source){
  const value=prefs(),now=Date.now(),today=localKey(),ack=()=>{try{window.__PACEFOLD_CUES__?.acknowledge?.(source)}catch{}};let message='Updated';
  if(source==='flow'){try{window.__PACEFOLD_FLOW__?.acknowledge?.('experience')}catch{}window.__PACEFOLD_SPATIAL__?.go?.('worklog');return}
  if(source==='prayer'){ack();message='Prayer cue cleared'}
  if(source==='water'){
    const same=value.waterDate===today,count=(same?Math.max(0,Number(value.waterSips)||0):0)+1,target=Math.max(1,Number(value.waterTarget)||24);updatePrefs({activityDate:today,waterDate:today,waterSips:Math.min(50,count),waterLastAt:now,waterGraceUntil:now+12*60000});addDayflow('water','Sip logged',`${Math.min(50,count)}/${target} today`,now,'water');message=`Sip ${Math.min(50,count)} of ${target}`;ack();
  }
  if(source==='noodle'){
    const start=Number(value.noodleStart)||0;if(start){updatePrefs({noodleStart:0,noodleDurationAtStart:0});addDayflow('prep','Timer stopped',`${Math.max(1,Math.round((now-start)/60000))} min`,start,'noodle');message='Timer stopped'}else{const minutes=Math.max(1,Number(value.noodleMinutes)||30);updatePrefs({noodleStart:now,noodleDurationAtStart:minutes,noodleDone:''});addDayflow('prep','Timer started',`${minutes} minutes`,now,'noodle');message=`${minutes}-minute timer started`}ack();
  }
  if(source==='away'){
    const start=Number(value.awayStart)||0;if(start){const minutes=Math.min(120,Math.max(1,Math.round((now-start)/60000))),sessions=Array.isArray(value.awaySessions)?value.awaySessions.slice():[];sessions.push({start,end:now,minutes});updatePrefs({awayStart:0,awaySessions:sessions.slice(-20),waterGraceUntil:now+8*60000});addDayflow('away','Rest logged',`${minutes} min`,start,'away');message=`Rest logged · ${minutes} min`}else{updatePrefs({awayStart:now,waterGraceUntil:now+15*60000});addDayflow('away','Rest started','Away from desk',now,'away');message='Rest started'}ack();
  }
  if(source==='lunch'){
    const start=Number(value.lunchStart)||0;if(start){const mode=value.lunchModeAtStart||value.lunchMode||'desk',minutes=Math.min(240,Math.max(1,Math.round((now-start)/60000))),sessions=Array.isArray(value.lunchSessions)?value.lunchSessions.slice():[];sessions.push({mode,start,end:now,minutes});updatePrefs({lunchStart:0,lunchDurationAtStart:0,lunchLoggedMinutes:minutes,lunchDone:today,lunchSessions:sessions.slice(-10),waterGraceUntil:now+12*60000});addDayflow('meal',mode==='away'?'Away lunch logged':'Desk meal logged',`${minutes} min`,start,'lunch');message=`Meal logged · ${minutes} min`}else{const mode=value.lunchMode||'desk',minutes=mode==='away'?Math.max(1,Number(value.awayLunchMinutes)||45):Math.max(1,Number(value.deskLunchMinutes)||20);updatePrefs({lunchStart:now,lunchModeAtStart:mode,lunchDurationAtStart:minutes,lunchDone:'',lunchLoggedMinutes:0,waterGraceUntil:now+(minutes+12)*60000});addDayflow('meal',mode==='away'?'Away lunch started':'Desk meal started',`${minutes} minutes`,now,'lunch');message=`${minutes}-minute meal started`}ack();
  }
  if(source==='eyes'){updatePrefs({gazeLastAt:now,gazeSnoozedUntil:0});addDayflow('eyes','Eye reset logged','20 seconds looking away',now,'eyes');message='Eye reset logged';ack()}
  if(source==='body'){const prompt=Math.max(0,Number(value.bodyPromptIndex)||0),sessions=Array.isArray(value.bodySessions)?value.bodySessions.slice():[];sessions.push({start:now-60000,end:now,seconds:60,prompt});updatePrefs({bodyResetStart:0,bodyLastAt:now,bodySnoozedUntil:0,bodySessions:sessions.slice(-30),bodyPromptIndex:(prompt+1)%4});addDayflow('body','Movement reset logged','One-minute position change',now,'body');message='Movement logged';ack()}
  toast(message);setTimeout(()=>{window.__PACEFOLD_ACTION_DOCK__?.refresh?.(true);renderActivity();renderSchedule(true)},100)
}
function installActionOwner(){
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target.closest('#pf23-action-dock button'):null;if(!target)return;
    if(target.classList.contains('pf23-action-log'))return;
    const source=target.dataset.source||target.id.replace('pf23-action-','');if(!source)return;
    event.preventDefault();event.stopImmediatePropagation();directAction(source);
  },true);
}
function renderActivity(){
  const dock=id('pf23-action-dock');if(!dock)return;let receipt=id('pf23-log-receipt');if(!receipt){receipt=create('div','pf23-log-receipt');receipt.id='pf23-log-receipt';dock.append(receipt)}
  const value=prefs(),records=[];
  if(value.waterLastAt)records.push({at:Number(value.waterLastAt),label:`Sip ${Number(value.waterSips)||0}/${Number(value.waterTarget)||24}`});
  const away=(value.awaySessions||[]).at?.(-1);if(away?.end)records.push({at:Number(away.end),label:`Rest ${Number(away.minutes)||0}m`});
  const meal=(value.lunchSessions||[]).at?.(-1);if(meal?.end)records.push({at:Number(meal.end),label:`Meal ${Number(meal.minutes)||0}m`});
  if(value.gazeLastAt)records.push({at:Number(value.gazeLastAt),label:'Eye reset'});if(value.bodyLastAt)records.push({at:Number(value.bodyLastAt),label:'Movement'});
  records.sort((a,b)=>b.at-a.at);const latest=records[0];receipt.replaceChildren(create('span','',latest?'Last logged':'Nothing logged yet'),create('strong','',latest?`${latest.label} · ${formatTime(new Date(latest.at))}`:'One tap records it here'));
}
function mode(){return id('pf22-spatial-root')?.dataset.mode||'home'}
function goHome(){window.__PACEFOLD_SPATIAL__?.go?.('home');armIdle(false)}
function blocked(){return Boolean(document.querySelector('input:focus,textarea:focus,select:focus,[contenteditable="true"]:focus,.pf-modal:not([hidden]),#panel.on,.pf22-sound-overlay:not([hidden])'))}
function armIdle(reset=true){
  if(mode()==='home'){idleDeadline=0;renderReturnCue();return}
  if(reset||!idleDeadline)idleDeadline=Date.now()+IDLE_SECONDS*1000;
  renderReturnCue();
}
function renderReturnCue(){
  const root=id('pf22-spatial-root');if(!root)return;let cue=id('pf23-return-cue');if(!cue){cue=button('pf23-return-cue','Return to Clock');cue.id='pf23-return-cue';cue.addEventListener('click',goHome);root.append(cue)}
  if(mode()==='home'||!idleDeadline||blocked()){cue.hidden=true;return}
  const left=Math.max(0,Math.ceil((idleDeadline-Date.now())/1000));cue.hidden=left>9;cue.textContent=left?`Clock in ${left}s`:'Clock';if(!left)goHome()
}
function installNavigationOwner(){
  const returnFirst=event=>{if(mode()==='home'||blocked())return false;event.preventDefault();event.stopImmediatePropagation();goHome();return true};
  document.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape','Home'].includes(event.key))return;returnFirst(event)},true);
  for(const name of ['click','pointerenter','pointerup'])document.addEventListener(name,event=>{const target=event.target instanceof Element?event.target.closest('.pf22-edge,.pf22-mode-dot'):null;if(!target)return;returnFirst(event)},true);
  document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target.closest('.pf22-home-button,.pf22-brand'):null;if(target)armIdle(false)},true);
  for(const name of ['pointerdown','keydown','input','wheel'])document.addEventListener(name,()=>{if(mode()!=='home')armIdle(true)},{passive:true});
  const root=id('pf22-spatial-root');if(root){new MutationObserver(()=>{if(mode()==='home')armIdle(false);else armIdle(true);renderActivity();renderSchedule(true)}).observe(root,{attributes:true,attributeFilter:['data-mode']})}
  clearInterval(idleTimer);idleTimer=setInterval(()=>{if(blocked()){if(mode()!=='home')idleDeadline=Date.now()+IDLE_SECONDS*1000;renderReturnCue();return}renderReturnCue()},1000)
}
function initialize(){
  if(initialized)return;
  const root=id('pf22-spatial-root');if(!root){window.addEventListener('pacefold:spatial-ready',initialize,{once:true});return}
  initialized=true;document.documentElement.dataset.pacefoldSpatial='ready';document.documentElement.classList.remove('pf23-boot-hold');root.dataset.experience=REVISION;
  buildSchedule();renderSchedule(true);updateAtmosphere();renderActivity();installActionOwner();installNavigationOwner();
  for(const event of ['pacefold:ma-prefs','pacefold:storage-changed','pacefold:dayflow','pacefold:cue-queue'])window.addEventListener(event,()=>{renderSchedule(true);renderActivity();updateAtmosphere()});
  clearInterval(minuteTimer);minuteTimer=setInterval(()=>{renderSchedule();updateAtmosphere();renderActivity()},30000);
  window.__PACEFOLD_EXPERIENCE__={release:RELEASE,revision:REVISION,schedule:()=>scheduleState(new Date(),true),home:goHome,refresh:()=>{renderSchedule(true);renderActivity();updateAtmosphere()}};
  window.dispatchEvent(new CustomEvent('pacefold:experience-ready',{detail:{release:RELEASE,revision:REVISION}}));
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',initialize,{once:true}):initialize();
})();
