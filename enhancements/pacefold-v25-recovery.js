(()=>{
'use strict';
const RELEASE='25.0.0';
const REVISION='recovery-r2';
const PREFS_KEY='pacefoldPrefsV15';
const CUE_SETTING='pacefold.v25.cueDots';
const DAY_TYPES=['desk','field','half','off'];
const DAY_LABELS={desk:'Desk day',field:'Field day',half:'Half day',off:'Off day'};
const CUE_ORDER=['flow','prayer','water','noodle','away','lunch','eyes','body'];
let mounted=false,tickTimer=0,maintenanceTimer=0,daybookTimer=0,lastInteraction=Date.now(),hiddenAt=0,lastRepair='';
const $=selector=>document.querySelector(selector);
const id=value=>document.getElementById(value);
const create=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content!=null)node.textContent=String(content);return node};
const button=(className,label,content='')=>{const node=create('button',className,content);node.type='button';node.setAttribute('aria-label',label);return node};
const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const pad=value=>String(value).padStart(2,'0');
const prefs=()=>window.__PACEFOLD_RHYTHM__?.prefs?.()||window.__PACEFOLD_CORE__?.getPrefs?.()||window.__PACEFOLD_MA_CORE__?.getPrefs?.()||parse(localStorage.getItem(PREFS_KEY),{})||{};
const patchPrefs=patch=>window.__PACEFOLD_RHYTHM__?.patchPrefs?.(patch)||window.__PACEFOLD_CORE__?.updatePrefs?.(patch)||window.__PACEFOLD_MA_CORE__?.updatePrefs?.(patch)||fallbackPatch(patch);
function fallbackPatch(patch){const next={...prefs(),...patch};try{localStorage.setItem(PREFS_KEY,JSON.stringify(next))}catch{}return next}
function zoneName(value=prefs()){return text(value.timeZone)||window.__PACEFOLD_UNIFIED__?.zoneName?.()||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}
function zoneParts(date=new Date(),timeZone=zoneName()){
  const result={};for(const part of new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date))if(part.type!=='literal')result[part.type]=Number(part.value);return result
}
function localKey(date=new Date(),timeZone=zoneName()){
  const part=zoneParts(date,timeZone);return `${part.year}-${pad(part.month)}-${pad(part.day)}`
}
function weekdayIndex(date=new Date(),timeZone=zoneName()){
  const part=zoneParts(date,timeZone);return new Date(Date.UTC(part.year,part.month-1,part.day)).getUTCDay()
}
function parseRange(value='08:30-16:30'){
  const match=String(value||'').match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);if(!match)return{start:8.5,end:16.5,startText:'08:30',endText:'16:30'};
  const start=Number(match[1])+Number(match[2])/60;let end=Number(match[3])+Number(match[4])/60;if(end<=start)end=start+8;
  return{start,end,startText:`${pad(match[1])}:${match[2]}`,endText:`${pad(match[3])}:${match[4]}`}
}
function timeText(value,fallback){return /^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(String(value||''))?String(value).padStart(5,'0'):fallback}
function defaultWeek(value=prefs()){
  const range=parseRange(value.workHours),week={};for(let day=0;day<7;day+=1)week[day]={start:range.startText,end:range.endText,type:value.workdaysOnly===false||day>=1&&day<=5?'desk':'off'};return week
}
function normalizeWeek(value=prefs()){
  const fallback=defaultWeek(value),source=value.workWeek&&typeof value.workWeek==='object'&&!Array.isArray(value.workWeek)?value.workWeek:{};const week={};
  for(let day=0;day<7;day+=1){const row=source[day]||source[String(day)]||fallback[day],type=DAY_TYPES.includes(String(row?.type||'').toLowerCase())?String(row.type).toLowerCase():fallback[day].type;week[day]={start:timeText(row?.start,fallback[day].start),end:timeText(row?.end,fallback[day].end),type}}
  return week
}
function resolvedDay(date=new Date(),value=prefs()){
  const timeZone=zoneName(value),week=normalizeWeek(value),row=week[weekdayIndex(date,timeZone)]||defaultWeek(value)[weekdayIndex(date,timeZone)],override=value.todayOverride;let type=row.type;
  if(override&&override.date===localKey(date,timeZone)&&DAY_TYPES.includes(String(override.type)))type=String(override.type);
  const fallback=parseRange(value.workHours),startText=timeText(row.start,fallback.startText),endText=timeText(row.end,fallback.endText),range=parseRange(`${startText}-${endText}`);let end=range.end;
  if(type==='half'&&end>range.start+3)end=range.start+(end-range.start)/2;
  return{type,start:range.start,end,startText,endText:type==='half'?clockText(end):endText,timeZone}
}
function clockText(hours){const h=Math.floor(hours)%24,m=Math.round((hours-h)*60)%60;return `${pad(h)}:${pad(m)}`}
function formatTime(date,value=prefs()){return new Intl.DateTimeFormat(undefined,{timeZone:zoneName(value),hour:'numeric',minute:'2-digit',hour12:value.timeFormat!=='24'}).format(date)}
function schedule(includeSunrise=true){try{return window.__PACEFOLD_UNIFIED__?.schedule?.(includeSunrise)||null}catch{return null}}
function cueDotsEnabled(){try{return localStorage.getItem(CUE_SETTING)!=='0'}catch{return true}}
function setCueDotsEnabled(enabled){try{localStorage.setItem(CUE_SETTING,enabled?'1':'0')}catch{}renderCues();renderRecoverySettings()}
function cueSources(){
  const found=new Set();try{for(const source of window.__PACEFOLD_CUES__?.sources?.()||[])found.add(String(source))}catch{}
  const waiting=prefs().waitingCue?.source;if(waiting)found.add(String(waiting));return CUE_ORDER.filter(source=>found.has(source))
}
function performCue(source){
  if(source==='flow'){window.__PACEFOLD_SPATIAL__?.go?.('worklog');window.__PACEFOLD_CUES__?.acknowledge?.('flow');return}
  if(source==='prayer'){window.__PACEFOLD_SPATIAL__?.go?.('context');window.__PACEFOLD_CUES__?.acknowledge?.('prayer');return}
  const alias={water:'water',noodle:'noodle',away:'away',lunch:'lunch',eyes:'eyes',body:'body'}[source],control=alias&&id(`pf23-action-${alias}`);if(control)control.click();else window.__PACEFOLD_CUES__?.acknowledge?.(source)
}
function buildCueDots(){
  const bar=$('.pf22-topbar');if(!bar||id('pf25-cue-dots'))return;
  const wrap=create('div','pf25-cue-dots');wrap.id='pf25-cue-dots';wrap.setAttribute('aria-label','Waiting Pacefold cues');bar.insertBefore(wrap,id('pf22-quiet')||null)
}
function renderCues(){
  buildCueDots();const wrap=id('pf25-cue-dots');if(!wrap)return;wrap.hidden=!cueDotsEnabled();if(wrap.hidden)return;
  const sources=cueSources(),key=sources.join('|');if(wrap.dataset.key===key)return;wrap.dataset.key=key;wrap.replaceChildren();
  if(!sources.length){wrap.append(create('span','pf25-cue-clear'));wrap.setAttribute('aria-label','No waiting cues');return}
  for(const source of sources){const dot=button('pf25-cue-dot',`${source} cue waiting`);dot.dataset.source=source;dot.addEventListener('click',()=>performCue(source));wrap.append(dot)}
  wrap.setAttribute('aria-label',`Waiting cues: ${sources.join(', ')}`)
}
function buildDayline(){
  const instrument=id('pf24-instrument');if(!instrument||id('pf25-dayline'))return;
  const section=create('section','pf25-dayline');section.id='pf25-dayline';section.setAttribute('aria-label','Workday unfold');
  const head=create('header','pf25-day-head'),copy=create('div');copy.append(create('span','pf25-kicker','Day unfold'),create('strong','pf25-day-title','Workday'));const meta=create('small','pf25-day-meta','');head.append(copy,meta);
  const rail=create('div','pf25-day-rail'),fill=create('i','pf25-day-fill'),sun=create('b','pf25-day-sun'),markers=create('div','pf25-day-markers');markers.id='pf25-day-markers';rail.append(fill,sun,markers);
  const labels=create('div','pf25-day-labels');labels.append(create('span','pf25-day-start',''),create('span','pf25-day-now','Now'),create('span','pf25-day-end',''));section.append(head,rail,labels);instrument.after(section)
}
function renderDayline(now=new Date()){
  buildDayline();const section=id('pf25-dayline');if(!section)return;const value=prefs(),day=resolvedDay(now,value),part=zoneParts(now,day.timeZone),hours=part.hour+part.minute/60+part.second/3600,title=section.querySelector('.pf25-day-title'),meta=section.querySelector('.pf25-day-meta');
  title.textContent=DAY_LABELS[day.type]||'Workday';section.querySelector('.pf25-day-start').textContent=day.type==='off'?'—':day.startText;section.querySelector('.pf25-day-end').textContent=day.type==='off'?'—':day.endText;
  if(day.type==='off'){section.dataset.state='off';section.style.setProperty('--pf25-progress','0');meta.textContent='No workday clock today';id('pf25-day-markers')?.replaceChildren();return}
  const progress=Math.max(0,Math.min(1,(hours-day.start)/Math.max(.01,day.end-day.start)));section.style.setProperty('--pf25-progress',String(progress));section.dataset.state=hours<day.start?'before':hours>day.end?'complete':'active';meta.textContent=`${day.startText}–${day.endText} · ${Math.round(progress*100)}%`;
  const markers=id('pf25-day-markers'),state=schedule(true),items=state?.today||[],key=`${localKey(now,day.timeZone)}|${day.type}|${day.start}|${day.end}|${items.map(item=>`${item.id}:${Number(item.hours).toFixed(3)}`).join('|')}`;
  if(markers&&markers.dataset.key!==key){markers.dataset.key=key;markers.replaceChildren();for(const item of items){const h=Number(item.hours);if(!Number.isFinite(h)||h<day.start||h>day.end)continue;const marker=button('pf25-day-marker',`${item.label} at ${formatTime(item.date,value)}`);marker.dataset.source=item.id;marker.style.setProperty('--marker',String((h-day.start)/(day.end-day.start)));marker.addEventListener('click',()=>window.__PACEFOLD_SPATIAL__?.go?.('context'));markers.append(marker)}}
}
function buildRhythm(){
  const day=id('pf25-dayline');if(!day||id('pf25-rhythm'))return;
  const section=create('section','pf25-rhythm');section.id='pf25-rhythm';section.setAttribute('aria-label','Prayer or personal rhythm');section.append(create('header','pf25-rhythm-head'),create('div','pf25-rhythm-items'));day.after(section)
}
function renderRhythm(now=new Date()){
  buildRhythm();const section=id('pf25-rhythm');if(!section)return;const state=schedule(true);if(!state)return;const head=section.querySelector('.pf25-rhythm-head'),items=section.querySelector('.pf25-rhythm-items'),value=state.value||prefs(),all=state.today||[];
  const nextPrayer=state.muslim?all.find(item=>item.id!=='sunrise'&&item.date>now):all.find(item=>item.date>now),copy=create('div');copy.append(create('span','pf25-kicker',state.muslim?'Prayer day':'Today’s rhythm'),create('strong','',nextPrayer?`Next · ${nextPrayer.label} ${formatTime(nextPrayer.date,value)}`:'Today is complete'));
  const meta=state.muslim?`${text(value.locationLabel)||state.timeZone} · ${value.method==='18'?'18°':'15°'} · ${value.asr==='hanafi'?'Hanafi Asr':'Standard Asr'}`:`${text(value.locationLabel)||state.timeZone} · Custom moments`;copy.append(create('small','',meta));
  const adjust=button('pf25-rhythm-adjust','Open rhythm settings','Adjust');adjust.addEventListener('click',()=>window.__PACEFOLD_SPATIAL__?.go?.('settings'));head.replaceChildren(copy,adjust);
  const key=`${localKey(now,state.timeZone)}|${Math.floor(now.getTime()/60000)}|${all.map(item=>`${item.id}:${item.date.getTime()}`).join('|')}`;if(items.dataset.key===key)return;items.dataset.key=key;items.replaceChildren();
  for(const item of all){const node=button('pf25-rhythm-item',`${item.label} at ${formatTime(item.date,value)}`);node.dataset.source=item.id;node.dataset.state=item.date<now?'past':nextPrayer?.id===item.id?'next':'upcoming';if(item.id==='sunrise')node.dataset.kind='sunrise';node.append(create('span','',item.label),create('strong','',formatTime(item.date,value)));node.addEventListener('click',()=>window.__PACEFOLD_SPATIAL__?.go?.('context'));items.append(node)}
}
function installDaybook(){
  const tray=id('pf24-fold-tray'),head=tray?.querySelector('.pf24-fold-head');if(!tray||!head)return;tray.dataset.open=tray.dataset.open||'false';if(id('pf25-daybook-toggle'))return;
  const toggle=button('pf25-daybook-toggle','Open Daybook','Open');toggle.id='pf25-daybook-toggle';toggle.addEventListener('click',()=>setDaybook(tray.dataset.open!=='true'));head.insertBefore(toggle,head.querySelector('.pf24-fold-tabs')||null);
  tray.addEventListener('pointerdown',touch);tray.addEventListener('keydown',touch,true);tray.addEventListener('focusin',touch);setDaybook(false)
}
function setDaybook(open){
  const tray=id('pf24-fold-tray'),toggle=id('pf25-daybook-toggle');if(!tray)return;tray.dataset.open=String(Boolean(open));if(toggle){toggle.textContent=open?'Close':'Open';toggle.setAttribute('aria-expanded',String(Boolean(open)))}clearTimeout(daybookTimer);if(open)daybookTimer=setTimeout(()=>setDaybook(false),22000)
}
function touch(){lastInteraction=Date.now();const tray=id('pf24-fold-tray');if(tray?.dataset.open==='true'){clearTimeout(daybookTimer);daybookTimer=setTimeout(()=>setDaybook(false),22000)}}
function findButton(pattern,exclude){return [...document.querySelectorAll('button')].find(node=>node!==exclude&&pattern.test(text(node.textContent)+' '+text(node.getAttribute('aria-label'))))}
function buildRecoverySettings(){
  const card=$('.pf22-settings-card');if(!card||id('pf25-settings'))return;const panel=create('section','pf25-settings');panel.id='pf25-settings';const head=create('header');head.append(create('span','pf25-kicker','Recovery essentials'),create('strong','','The controls Pacefold should never lose'));panel.append(head);
  const grid=create('div','pf25-settings-grid'),today=create('div','pf25-setting-status');today.dataset.kind='today';grid.append(today);
  const cues=button('pf25-setting-button','Toggle quiet cue dots');cues.dataset.action='cues';cues.addEventListener('click',()=>setCueDotsEnabled(!cueDotsEnabled()));grid.append(cues);
  const backup=button('pf25-setting-button','Open note backup','Backup');backup.dataset.action='backup';backup.addEventListener('click',()=>findButton(/backup notes|choose.*backup|backup file/i,backup)?.click());grid.append(backup);
  const scheduleButton=button('pf25-setting-button','Open advanced schedule settings','Schedule');scheduleButton.dataset.action='schedule';scheduleButton.addEventListener('click',()=>findButton(/advanced settings|all settings/i,scheduleButton)?.click());grid.append(scheduleButton);panel.append(grid);card.prepend(panel)
}
function renderRecoverySettings(){
  buildRecoverySettings();const panel=id('pf25-settings');if(!panel)return;const day=resolvedDay(),today=panel.querySelector('[data-kind="today"]');today.replaceChildren(create('span','','Today'),create('strong','',DAY_LABELS[day.type]||day.type),create('small','',day.type==='off'?'No workday hours':`${day.startText}–${day.endText}`));
  const cues=panel.querySelector('[data-action="cues"]');if(cues){const on=cueDotsEnabled();cues.replaceChildren(create('span','','Cue dots'),create('strong','',on?'On':'Off'),create('small','',on?'Quiet keeps them visible':'No coloured attention dots'));cues.dataset.active=String(on)}
}
function repairActivitySchema(){
  const value=prefs(),today=localKey(),patch={};
  for(const [legacy,canonical] of [['lastWaterAt','waterLastAt'],['lastGazeAt','gazeLastAt'],['lastBodyAt','bodyLastAt']]){const old=Number(value[legacy])||0,current=Number(value[canonical])||0;if(old>current)patch[canonical]=old}
  if(value.waterDate&&String(value.waterDate)!==today&&Number(value.waterSips)>0){patch.waterSips=0;patch.waterDate=today}
  const key=JSON.stringify(patch);if(Object.keys(patch).length&&key!==lastRepair){lastRepair=key;patchPrefs(patch)}
}
function renderVersion(){for(const node of document.querySelectorAll('.pf22-version'))node.textContent=`Pacefold ${RELEASE} · private local recovery`;const root=id('pf22-spatial-root');if(root){root.dataset.release=RELEASE;root.dataset.recovery=REVISION}document.body.dataset.pacefoldExperience=RELEASE;document.documentElement.dataset.pacefoldExperience=RELEASE}
function currentMode(){return id('pf22-spatial-root')?.dataset.mode||'home'}
function home(){window.__PACEFOLD_SPATIAL__?.go?.('home')}
function navigationCapture(event){
  if(event.key==='Escape'||event.key==='Home'){event.preventDefault();event.stopImmediatePropagation();home();return}
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)||currentMode()==='home')return;
  const active=document.activeElement;if(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))return;
  event.preventDefault();event.stopImmediatePropagation();home()
}
function installNavigation(){
  document.addEventListener('keydown',navigationCapture,true);
  for(const type of ['pointerdown','keydown','input','focusin'])document.addEventListener(type,()=>{lastInteraction=Date.now()},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=Date.now();else if(hiddenAt&&Date.now()-hiddenAt>60000)home()})
}
function autoHome(){
  const mode=currentMode();if(mode==='home')return;const active=document.activeElement,editing=active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);if(editing)return;const limit=mode==='notes'?90000:55000;if(Date.now()-lastInteraction>limit)home()
}
function compose(){
  const root=id('pf22-spatial-root'),hero=$('.pf22-clock-hero');if(!root||!hero)return false;buildCueDots();buildDayline();buildRhythm();installDaybook();buildRecoverySettings();renderVersion();document.documentElement.dataset.pacefoldV25='ready';return true
}
function refresh(force=false){
  if(!compose())return false;const now=new Date();repairActivitySchema();renderDayline(now);renderRhythm(now);renderCues();renderRecoverySettings();renderVersion();if(force)window.__PACEFOLD_CUES__?.refresh?.();return true
}
function tick(){const now=new Date();renderDayline(now);if(now.getSeconds()===0)renderRhythm(now)}
function install(){
  if(mounted)return;if(!compose()){window.addEventListener('pacefold:unified-ready',install,{once:true});window.addEventListener('pacefold:spatial-ready',install,{once:true});return}mounted=true;refresh(true);installNavigation();clearInterval(tickTimer);tickTimer=setInterval(tick,1000);clearInterval(maintenanceTimer);maintenanceTimer=setInterval(()=>{refresh(false);autoHome()},5000);
  for(const event of ['pacefold:storage-changed','pacefold:rhythm-prefs','pacefold:cue-queue','pacefold:dayflow','pacefold:experience-ready'])window.addEventListener(event,()=>refresh(false));
  window.__PACEFOLD_RECOVERY__={release:RELEASE,revision:REVISION,refresh:()=>refresh(true),resolvedDay:(date=new Date())=>resolvedDay(date),home,setDaybook,cueDotsEnabled,setCueDotsEnabled};
  window.__PACEFOLD_ACTIVE_RELEASE__=RELEASE;window.dispatchEvent(new CustomEvent('pacefold:recovery-ready',{detail:{release:RELEASE,revision:REVISION}}))
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();
