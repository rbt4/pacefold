(()=>{
'use strict';
const RELEASE='22.0.0';
const REVISION='spatial-r1';
const TITLE='Clock';
const PREFS='pacefoldPrefsV15';
const NOTES='pacefold.notebook.entries.v2';
const DRAFT='pacefold.spatial.note.draft.v1';
const ONBOARDED='pacefoldOnboardedV15';
const DISMISSED='pacefoldSetupDismissedV15';
const MODES={home:[0,0],notes:[0,-1],worklog:[-1,0],context:[1,0],settings:[0,1]};
let mode='home',edgeTimer=0,tickTimer=0,observer=null,setupObserver=null,refreshFrame=0,lastMinute=-1,selectedNoteDate='';
const $=selector=>document.querySelector(selector);
const id=value=>document.getElementById(value);
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const readJSON=(key,fallback)=>{try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback}catch{return fallback}};
const create=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content!=null)node.textContent=String(content);return node};
const button=(className,label,content)=>{const node=create('button',className,content);node.type='button';node.setAttribute('aria-label',label);return node};
const localKey=(value=new Date())=>{const date=value instanceof Date?value:new Date(value);return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const formatTime=value=>new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const formatDuration=ms=>{const minutes=Math.max(0,Math.round(ms/60000)),hours=Math.floor(minutes/60),rest=minutes%60;return hours?`${hours}h ${String(rest).padStart(2,'0')}m`:`${rest}m`};
const prefs=()=>window.__PACEFOLD_MA_CORE__?.getPrefs?.()||readJSON(PREFS,{});
const notes=()=>{const value=readJSON(NOTES,[]);return Array.isArray(value)?value:[]};
const noteDate=note=>String(note?.date||localKey(note?.updatedAt||note?.createdAt||Date.now()));
const visibleNotes=()=>notes().slice().sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));

function returningUser(){
  if(new URLSearchParams(location.search).has('legacyAudit')||sessionStorage.getItem('pacefold.spatial.disabled')==='1')return false;
  if(new URLSearchParams(location.search).has('setup'))return false;
  return Boolean(window.__PACEFOLD_V21_BOOT__?.returning||localStorage.getItem(ONBOARDED)==='1'||localStorage.getItem(DISMISSED)==='1');
}

function nodeText(selector,fallback=''){
  const node=$(selector);return text(node?.textContent)||fallback;
}

function proxyClick(selectors){
  for(const selector of selectors){const node=$(selector);if(node){node.click();return true}}
  return false;
}

function face(name,title,eyebrow){
  const section=create('section',`pf22-face pf22-face-${name}`);section.dataset.face=name;section.setAttribute('aria-label',title);
  const head=create('header','pf22-face-head');
  const copy=create('div','pf22-face-heading');copy.append(create('span','pf22-eyebrow',eyebrow),create('h1','',title));
  const home=button('pf22-home-button','Return to clock','Clock');home.addEventListener('click',()=>go('home'));
  head.append(copy,home);section.append(head);return section;
}

function mount(){
  if(id('pf22-spatial-root'))return;
  if(!returningUser()){
    document.documentElement.dataset.pacefoldSpatial='legacy';
    return;
  }
  document.title=TITLE;
  document.documentElement.dataset.pacefoldSpatial='ready';
  document.documentElement.dataset.pacefoldExperience=RELEASE;
  document.body.dataset.pacefoldExperience=RELEASE;
  const root=create('div','pf22-spatial-root');root.id='pf22-spatial-root';root.dataset.mode='home';
  const stage=create('div','pf22-stage');stage.id='pf22-stage';
  stage.append(buildHome(),buildNotes(),buildWorklog(),buildContext(),buildSettings());
  root.append(buildTopbar(),stage,buildEdges(),buildModeDots());
  document.body.append(root);
  installNavigation(root);
  refresh(true);
  window.__PACEFOLD_SPATIAL__={release:RELEASE,revision:REVISION,go,home:()=>go('home'),refresh:()=>refresh(true),setNoteDate,noteDate:()=>selectedNoteDate};
  window.dispatchEvent(new CustomEvent('pacefold:spatial-ready',{detail:{release:RELEASE}}));
}

function buildTopbar(){
  const bar=create('header','pf22-topbar');
  const brand=button('pf22-brand','Return to clock','Pacefold');brand.addEventListener('click',()=>go('home'));
  const current=create('span','pf22-current-mode','Clock');current.id='pf22-current-mode';
  const quiet=button('pf22-quiet','Toggle Quiet mode','Quiet');quiet.id='pf22-quiet';quiet.addEventListener('click',()=>{window.__PACEFOLD_MA_QUIET__?.toggle?.();refresh(true)});
  bar.append(brand,current,quiet);return bar;
}

function buildEdges(){
  const wrap=create('nav','pf22-edge-nav');wrap.setAttribute('aria-label','Pacefold modes');
  const items=[['up','notes','Notes','↑'],['left','worklog','Worklog','←'],['right','context','Now','→'],['down','settings','Settings','↓']];
  for(const [side,target,label,arrow] of items){
    const edge=button(`pf22-edge pf22-edge-${side}`,`Open ${label}`,label);edge.dataset.target=target;
    edge.append(create('span','pf22-edge-arrow',arrow));
    edge.addEventListener('pointerenter',()=>{clearTimeout(edgeTimer);edgeTimer=setTimeout(()=>go(target),620)});
    edge.addEventListener('pointerleave',()=>clearTimeout(edgeTimer));
    edge.addEventListener('click',()=>go(target));wrap.append(edge);
  }
  return wrap;
}

function buildModeDots(){
  const nav=create('nav','pf22-mode-dots');nav.setAttribute('aria-label','Spatial mode position');
  for(const name of ['notes','worklog','home','context','settings']){const dot=button('pf22-mode-dot',`Open ${name}`,name==='home'?'●':'');dot.dataset.target=name;dot.addEventListener('click',()=>go(name));nav.append(dot)}
  return nav;
}

function buildHome(){
  const section=create('section','pf22-face pf22-face-home');section.dataset.face='home';
  const hero=create('div','pf22-clock-hero');
  const mark=create('div','pf22-home-mark');mark.append(create('span','','Pacefold'),create('small','','Focus · rhythm · flow'));
  const time=create('div','pf22-time');time.id='pf22-time';
  const main=create('span','pf22-time-main','--:--');main.id='pf22-time-main';
  const side=create('span','pf22-time-side'),dial=create('span','pf23-seconds-dial');dial.setAttribute('aria-hidden','true');dial.append(create('i',''));
  side.append(dial,create('b','pf22-seconds','--'),create('small','pf22-ampm','--'));time.append(main,side);
  const date=create('div','pf22-date');date.id='pf22-date';
  const status=create('button','pf22-status');status.type='button';status.id='pf22-status';status.addEventListener('click',()=>status.dataset.actionable==='false'?go('worklog'):proxyClick(['#statusLine','.pf21-dayline']));
  const progress=create('div','pf22-progress');progress.append(create('i','pf22-progress-fill'));progress.id='pf22-progress';
  const rituals=create('div','pf22-rituals');
  const items=[
    ['water','Water',['#waterBtn','#waterPill']],
    ['timer','Timer',['#noodleBtn','#noodlePill']],
    ['away','Away',['#awayBtn','#awayPill']],
    ['meal','Meal',['#lunchBtn','#lunchPill']],
    ['eyes','Eyes',['#eyesBtn','#gazeBtn']],
    ['move','Move',['#careBtn','#bodyBtn']]
  ];
  for(const [key,label,selectors] of items){const control=button('pf22-ritual',label,label);control.dataset.ritual=key;control.addEventListener('click',()=>proxyClick(selectors));rituals.append(control)}
  const glimpse=button('pf22-context-glimpse','Open weather and focus context','');glimpse.id='pf22-context-glimpse';glimpse.addEventListener('click',()=>go('context'));
  const navHint=create('div','pf22-nav-hint','Move to an edge or use the arrow keys');
  hero.append(mark,time,date,status,progress,rituals,glimpse,navHint);section.append(hero);return section;
}

function buildNotes(){
  const section=face('notes','Notes','Above the moment');
  const body=create('div','pf22-notes-layout');
  const capture=create('section','pf22-capture');
  capture.append(create('label','pf22-field-label','Capture from this moment'));
  const textarea=create('textarea','pf22-note-input');textarea.id='pf22-note-input';textarea.placeholder='Decision, follow-up, field observation or idea…';
  try{textarea.value=localStorage.getItem(DRAFT)||''}catch{}
  textarea.addEventListener('input',()=>{try{if(textarea.value)localStorage.setItem(DRAFT,textarea.value);else localStorage.removeItem(DRAFT)}catch{}});
  const actions=create('div','pf22-capture-actions');
  const status=create('span','pf22-save-status','Local only');status.id='pf22-save-status';
  const save=button('pf22-primary','Save note','Save note');save.addEventListener('click',saveSpatialNote);
  textarea.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();saveSpatialNote()}});
  actions.append(status,save);capture.append(textarea,actions);
  const recent=create('section','pf22-notes-recent');recent.append(create('header','', 'Recent notes'),create('div','pf22-note-list'));body.append(capture,recent);section.append(body);return section;
}

function saveSpatialNote(){
  const input=id('pf22-note-input'),body=text(input?.value);if(!body)return;
  const now=new Date(),all=notes();all.push({id:`spatial-${now.getTime().toString(36)}`,date:localKey(now),body,category:'Moment',createdAt:now.toISOString(),updatedAt:now.toISOString()});
  try{localStorage.setItem(NOTES,JSON.stringify(all.slice(-1000)));localStorage.removeItem(DRAFT);window.__PACEFOLD_DAYFLOW__?.add?.('note','Note captured',body.slice(0,90),now.getTime(),'note-spatial');window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:NOTES,source:'spatial'}}));input.value='';selectedNoteDate=localKey(now);id('pf22-save-status').textContent='Saved locally';renderNotes();setTimeout(()=>go('home'),720)}
  catch{const node=id('pf22-save-status');if(node)node.textContent='Could not save'}
}

function setNoteDate(value=''){
  selectedNoteDate=/^20\d{2}-\d{2}-\d{2}$/.test(String(value))?String(value):'';
  renderNotes();return selectedNoteDate;
}

function buildWorklog(){
  const section=face('worklog','Worklog','What already happened');
  const actions=create('div','pf22-face-actions');
  const focus=button('pf22-primary','Start or end focus','Start focus');focus.id='pf22-worklog-focus';focus.addEventListener('click',()=>window.__PACEFOLD_DAYFLOW__?.toggleFocus?.());
  const field=button('pf22-secondary','Toggle desk or field mode','Field / desk');field.addEventListener('click',()=>proxyClick(['#pf-day-type']));
  const exp=button('pf22-secondary','Export today','Export');exp.addEventListener('click',()=>window.__PACEFOLD_DAYFLOW__?.exportDay?.());actions.append(focus,field,exp);
  const body=create('div','pf22-worklog-layout');body.append(create('section','pf22-log-stream'),create('aside','pf22-log-summary'));section.append(actions,body);return section;
}

function buildContext(){
  const section=face('context','Now','What is approaching');
  const body=create('div','pf22-context-layout');
  const weather=create('section','pf22-context-weather');weather.append(create('span','pf22-eyebrow','Weather'),create('div','pf22-weather-main'),create('div','pf22-weather-days'));
  const now=create('section','pf22-context-now');now.append(create('span','pf22-eyebrow','Current rhythm'),create('div','pf22-now-status'),create('div','pf22-now-cards'));
  const refresh=button('pf22-secondary','Refresh weather','Refresh weather');refresh.addEventListener('click',()=>proxyClick(['.pf-v19-weather-refresh']));now.append(refresh);
  body.append(weather,now);section.append(body);return section;
}

function buildSettings(){
  const section=face('settings','Settings & sound','Below the surface');
  const body=create('div','pf22-settings-layout');
  const essentials=create('section','pf22-settings-card');essentials.append(create('span','pf22-eyebrow','Essentials'));
  const settings=[['quiet','Quiet mode'],['weather','Weather'],['seconds','Seconds'],['notifications','Notifications']];
  for(const [key,label] of settings){const row=create('div','pf22-setting-row');row.append(create('span','',label));const toggle=button('pf22-switch',`Toggle ${label}`,'');toggle.dataset.setting=key;toggle.addEventListener('click',()=>toggleSetting(key));row.append(toggle);essentials.append(row)}
  const backup=button('pf22-secondary pf22-wide','Choose or update backup file','Backup notes');backup.addEventListener('click',()=>proxyClick(['.pf-v20-backup','[data-action="backup"]']));
  const advanced=button('pf22-secondary pf22-wide','Open advanced settings','Advanced settings');advanced.addEventListener('click',openAdvancedSettings);essentials.append(backup,advanced,create('small','pf22-version',`Pacefold ${RELEASE} · verified offline core 15.2.2`));
  const sound=create('section','pf22-sound-card');sound.append(create('span','pf22-eyebrow','Sound'),create('h2','','Keep the soundtrack inside Pacefold'));
  const track=create('div','pf22-track');track.id='pf22-track';
  const controls=create('div','pf22-sound-controls');
  const play=button('pf22-primary','Play or pause','Play / pause');play.addEventListener('click',()=>proxyClick(['[aria-label*="Play"]','[aria-label*="Pause"]','.pf-v19-player-toggle']));
  const open=button('pf22-secondary','Open full sound controls','Open sound controls');open.addEventListener('click',openSound);controls.append(play,open);sound.append(track,controls);
  body.append(essentials,sound);section.append(body);return section;
}

function toggleSetting(key){
  if(key==='quiet'){window.__PACEFOLD_MA_QUIET__?.toggle?.();go('home');refresh(true);return}
  const core=window.__PACEFOLD_MA_CORE__,current=prefs();
  if(key==='weather'){const state=window.__PACEFOLD_V21_PERSISTENCE__?.read?.()||{};window.__PACEFOLD_V21_PERSISTENCE__?.write?.({...state,v21WeatherEnabled:state.v21WeatherEnabled===false});}
  if(key==='seconds')core?.updatePrefs?.({showSeconds:current.showSeconds===false});
  if(key==='notifications')core?.updatePrefs?.({notifications:current.notifications===false});
  refresh(true);
}

function openAdvancedSettings(){
  proxyClick(['#brandButton','.corner']);
  document.documentElement.classList.add('pf22-legacy-dialog-open');
  const panel=id('panel');if(panel){const close=()=>document.documentElement.classList.remove('pf22-legacy-dialog-open');panel.addEventListener('transitionend',()=>{if(!panel.classList.contains('on'))close()},{once:true})}
}
function openSound(){
  const sound=$('[data-workbench-page="sound"],.pf-v19-workbench-tab[data-page="sound"]');if(sound)sound.click();
  document.documentElement.classList.add('pf22-legacy-dialog-open');
}

function go(next){
  if(!MODES[next])next='home';
  mode=next;const root=id('pf22-spatial-root');if(!root)return;
  root.dataset.mode=mode;id('pf22-current-mode').textContent={home:'Clock',notes:'Notes',worklog:'Worklog',context:'Now',settings:'Settings'}[mode];
  for(const dot of root.querySelectorAll('.pf22-mode-dot'))dot.dataset.active=String(dot.dataset.target===mode);
  sessionStorage.setItem('pacefold.spatial.mode',mode);
  refresh(true);
  requestAnimationFrame(()=>root.querySelector(`[data-face="${mode}"]`)?.focus?.({preventScroll:true}));
}

function installNavigation(root){
  document.addEventListener('keydown',event=>{
    if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
    const map={ArrowUp:'notes',ArrowLeft:'worklog',ArrowRight:'context',ArrowDown:'settings'};
    if(map[event.key]){event.preventDefault();go(map[event.key]);}
    else if(event.key==='Escape'||event.key==='Home'){event.preventDefault();go('home')}
  });
  let start=null;
  root.addEventListener('pointerdown',event=>{const edge=34,x=event.clientX,y=event.clientY;if(x<=edge||x>=innerWidth-edge||y<=edge||y>=innerHeight-edge)start={x,y,id:event.pointerId}});
  root.addEventListener('pointerup',event=>{if(!start||start.id!==event.pointerId)return;const dx=event.clientX-start.x,dy=event.clientY-start.y,ax=Math.abs(dx),ay=Math.abs(dy);if(Math.max(ax,ay)>70){if(ax>ay)go(dx>0?'worklog':'context');else go(dy>0?'notes':'settings')}start=null});
  root.addEventListener('pointercancel',()=>{start=null});
}

function refresh(force=false){
  document.title=TITLE;
  const quiet=Boolean(window.__PACEFOLD_MA_QUIET__?.get?.()||prefs().quietMode||document.body.dataset.quiet==='true');
  const root=id('pf22-spatial-root');if(!root)return;root.dataset.quiet=String(quiet);id('pf22-quiet').dataset.active=String(quiet);
  renderClock();if(force||mode==='notes')renderNotes();if(force||mode==='worklog')renderWorklog();if(force||mode==='context')renderContext();if(force||mode==='settings')renderSettings();
  if(quiet&&mode!=='home')go('home');
}

function renderClock(){
  const now=new Date(),hours=now.getHours(),is24=prefs().timeFormat==='24',display=is24?String(hours).padStart(2,'0'):String(hours%12||12);
  id('pf22-time-main').textContent=`${display}:${String(now.getMinutes()).padStart(2,'0')}`;
  $('.pf22-seconds').textContent=String(now.getSeconds()).padStart(2,'0');
  const dial=$('.pf23-seconds-dial');if(dial)dial.style.setProperty('--pf23-second-angle',`${now.getSeconds()*6}deg`);
  $('.pf22-ampm').textContent=is24?'':hours>=12?'PM':'AM';
  id('pf22-date').textContent=now.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});
  const statusNode=id('pf22-status'),stale=/^overdue$/i.test(nodeText('#statusWord')),status=stale?nextWorkdayStatus(now):nodeText('#statusLine',nodeText('.pf21-dayline','Workday in progress'));
  statusNode.textContent=status;statusNode.dataset.actionable=String(!stale);statusNode.title=stale?'Open Worklog to review the missed moment':'Use the current workday action';
  const original=$('#progressFill,.pf21-dayline-progress i,.pf-ribbon-spent'),width=original?parseFloat(getComputedStyle(original).width)||0:0,parent=original?.parentElement?parseFloat(getComputedStyle(original.parentElement).width)||1:1;
  $('.pf22-progress-fill').style.setProperty('--pf22-progress',`${Math.min(100,Math.max(0,width/parent*100))}%`);
  const weather=[nodeText('.pf-v19-weather-temp'),nodeText('.pf-v19-weather-copy>strong')].filter(Boolean).join(' · ')||'Weather';id('pf22-context-glimpse').textContent=weather;
  const p=prefs(),timerLabel=p.prepPreset==='noodles'?`Noodles ${Number(p.noodleMinutes)||30}m`:nodeText('#noodleText','Timer');
  const states={
    water:{label:'Water',due:'#waterBtn.due,#waterPill.due',active:'#waterBtn.active,#waterPill.active'},
    timer:{label:timerLabel,due:'#noodleBtn.ready,#noodlePill.ready',active:'#noodleBtn.running,#noodlePill.running'},
    away:{label:nodeText('#awayText','Away'),due:'#awayBtn.due,#awayPill.due',active:'#awayBtn.active,#awayPill.active'},
    meal:{label:nodeText('#lunchText','Meal'),due:'#lunchBtn.ready,#lunchPill.ready',active:'#lunchBtn.running,#lunchPill.running'},
    eyes:{label:'Eyes',due:'#eyesBtn.due,#gazeBtn.due',active:'#eyesBtn.active,#gazeBtn.active'},
    move:{label:'Move',due:'#careBtn.due,#bodyBtn.due',active:'#careBtn.active,#bodyBtn.active'}
  };
  for(const [key,state] of Object.entries(states)){const control=$(`[data-ritual="${key}"]`);if(!control)continue;control.textContent=state.label;control.dataset.due=String(Boolean($(state.due)));control.dataset.active=String(Boolean($(state.active)))}
}

function nextWorkdayStatus(now=new Date()){
  const sequence=id('sequence'),progress=parseFloat(sequence?.style.getPropertyValue('--pf-ribbon-progress')||'0'),creases=[...(sequence?.querySelectorAll('.pf-ribbon-crease')||[])].map(node=>({node,x:parseFloat(node.style.getPropertyValue('--pf-ribbon-x'))/100})).filter(item=>Number.isFinite(item.x)&&item.x>progress+.001).sort((a,b)=>a.x-b.x),next=creases[0];
  if(!next)return'Workday in progress · missed moment moved to Worklog';
  const value=prefs(),match=String(value.workHours||'08:30-16:30').match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/),start=match?Number(match[1])+Number(match[2])/60:8.5,end=match?Number(match[3])+Number(match[4])/60:16.5,hour=start+(end-start)*next.x,at=new Date(now);at.setHours(Math.floor(hour),Math.round((hour%1)*60),0,0);
  const label=text(next.node.getAttribute('aria-label')||next.node.title)||'Scheduled moment',remaining=Math.max(0,at-now);
  return`Next · ${at.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})} · ${formatDuration(remaining)} · ${label}`;
}

function renderNotes(){
  const list=$('.pf22-note-list');if(!list)return;const values=visibleNotes().filter(note=>!selectedNoteDate||noteDate(note)===selectedNoteDate).slice(0,8),heading=$('.pf22-notes-recent>header');if(heading)heading.textContent=selectedNoteDate?`Notes · ${new Date(`${selectedNoteDate}T12:00:00`).toLocaleDateString([],{month:'short',day:'numeric'})}`:'Recent notes';list.replaceChildren();
  if(!values.length){list.append(create('div','pf22-empty','No notes yet. Capture only what is worth remembering.'));return}
  for(const note of values){const article=create('article','pf22-note-row'),meta=create('span','pf22-note-meta');meta.append(create('time','',formatTime(note.updatedAt||note.createdAt)),create('small','',note.category||'Note'));article.append(meta,create('p','',note.body));list.append(article)}
}

function renderWorklog(){
  const stream=$('.pf22-log-stream'),summary=$('.pf22-log-summary');if(!stream||!summary)return;
  const api=window.__PACEFOLD_DAYFLOW__,metrics=api?.metrics?.()||{events:[],desk:0,field:0,focus:0,away:0,meal:0,elapsed:0};const events=(metrics.events||[]).slice().reverse().slice(0,12);
  stream.replaceChildren(create('header','pf22-section-title','Today'));
  if(!events.length)stream.append(create('div','pf22-empty','Your day will appear here as Pacefold observes transitions.'));
  for(const event of events){const row=create('article','pf22-log-row');row.dataset.type=event.type;const rail=create('span','pf22-log-rail');const copy=create('div','');copy.append(create('strong','',event.label||event.type),create('small','',[event.detail,event.end&&event.end!==event.start?formatDuration((event.end||Date.now())-event.start):event.end?'Moment':'In progress'].filter(Boolean).join(' · ')));row.append(create('time','',formatTime(event.start)),rail,copy);stream.append(row)}
  summary.replaceChildren(create('span','pf22-eyebrow','Today at a glance'));
  for(const [label,value,type] of [['Desk',metrics.desk,'desk'],['Field',metrics.field,'field'],['Focus',metrics.focus,'focus'],['Away',metrics.away+metrics.meal,'away']]){const row=create('div','pf22-metric');row.dataset.type=type;row.append(create('span','',label),create('strong','',formatDuration(value)));summary.append(row)}
  const activeFocus=(metrics.events||[]).some(event=>event.type==='focus'&&!event.end);const focus=id('pf22-worklog-focus');if(focus){focus.textContent=activeFocus?'End focus':'Start focus';focus.dataset.active=String(activeFocus)}
}

function renderContext(){
  const main=$('.pf22-weather-main'),days=$('.pf22-weather-days'),status=$('.pf22-now-status'),cards=$('.pf22-now-cards');if(!main||!days||!status||!cards)return;
  main.replaceChildren(create('strong','',nodeText('.pf-v19-weather-temp','—')),create('span','',nodeText('.pf-v19-weather-copy>strong','Weather is available when connected')),create('small','',nodeText('.pf-v19-weather-place','Toronto')));
  days.replaceChildren();for(const day of [...document.querySelectorAll('.pf-v19-weather-day')].slice(0,3)){const item=create('article','');item.textContent=text(day.textContent);days.append(item)}
  status.replaceChildren(create('strong','',nodeText('#statusLine','Workday in progress')),create('small','',nodeText('.pf21-dayline-detail','Pacefold is keeping the day quiet.')));
  const metrics=window.__PACEFOLD_DAYFLOW__?.metrics?.()||{};cards.replaceChildren();for(const [label,value] of [['Logged',formatDuration(metrics.elapsed||0)],['Focus',formatDuration(metrics.focus||0)],['Notes',String(metrics.notes||0)]]){const item=create('article','');item.append(create('span','',label),create('strong','',value));cards.append(item)}
}

function renderSettings(){
  const p=prefs(),weather=window.__PACEFOLD_V21_PERSISTENCE__?.read?.()||{};
  const values={quiet:Boolean(window.__PACEFOLD_MA_QUIET__?.get?.()||p.quietMode),weather:weather.v21WeatherEnabled!==false,seconds:p.showSeconds!==false,notifications:p.notifications!==false};
  for(const toggle of document.querySelectorAll('.pf22-switch')){const on=Boolean(values[toggle.dataset.setting]);toggle.dataset.active=String(on);toggle.textContent=on?'On':'Off'}
  const track=id('pf22-track');if(track)track.textContent=nodeText('.pf-v19-workbench-track','Nothing playing');
}

function queueRefresh(){if(refreshFrame)return;refreshFrame=requestAnimationFrame(()=>{refreshFrame=0;refresh()})}

function awaitSetupCompletion(){
  const onboarding=id('onboarding'),requested=new URLSearchParams(location.search).has('setup');if(!onboarding)return;
  let seenVisible=!onboarding.hidden;
  const attempt=()=>{
    if(!onboarding.hidden){seenVisible=true;return}
    const complete=localStorage.getItem(ONBOARDED)==='1'||localStorage.getItem(DISMISSED)==='1';if(!complete||requested&&!seenVisible)return;
    if(requested){const url=new URL(location.href);url.searchParams.delete('setup');history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`)}
    setupObserver?.disconnect();setupObserver=null;mount();activateRuntime();
  };
  setupObserver=new MutationObserver(attempt);setupObserver.observe(onboarding,{attributes:true,attributeFilter:['hidden','aria-hidden','class']});window.addEventListener('pacefold:ma-prefs',attempt);setTimeout(attempt,700);
}

function activateRuntime(){
  const root=id('pf22-spatial-root');if(!root||root.dataset.runtimeActive==='true')return;root.dataset.runtimeActive='true';
  observer=new MutationObserver(queueRefresh);for(const node of ['#statusLine','#progressFill','#waterBtn','#noodleBtn','#awayBtn','#lunchBtn','#eyesBtn','#careBtn','.pf-v19-weather'].map($).filter(Boolean))observer.observe(node,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','data-state','data-active','aria-selected','style']});
  for(const event of ['pacefold:dayflow','pacefold:storage-changed','pacefold:ma-prefs','pacefold:quiet'])window.addEventListener(event,()=>refresh(true));
  window.addEventListener('storage',()=>refresh(true));
  const tick=()=>{refresh();tickTimer=setTimeout(tick,Math.max(100,1010-Date.now()%1000))};tick();
}

function initialize(){
  mount();
  if(!id('pf22-spatial-root')){awaitSetupCompletion();return}
  activateRuntime();
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',initialize,{once:true}):initialize();
})();
