(()=>{
'use strict';
const RELEASE='25.0.0';
const REVISION='privacy-return-r1';
const NOTES_KEY='pacefold.notebook.entries.v2';
const ROOT_ID='pf25Spatial-spatial-root';
const PRIVATE_LABEL='data-pf-private-label';
const SENSITIVE=/\b(?:fajr|dhuhr|asr|maghrib|isha|prayer|water|sip|hydrate|noodle|prep|lunch|meal|away|eye|eyes|movement|move|stretch|body|notes?|daybook|worklog|focus|field|desk|capture|incidents?|inspections?|jhsc|construction|follow-?ups?|resources?)\b/gi;
const sourceColor={prayer:'var(--pf25-prayer)',sunrise:'var(--pf25-warm)',water:'var(--pf25-water)',noodle:'var(--pf25-prep)',away:'var(--pf25-away)',lunch:'var(--pf25-meal)',eyes:'var(--pf25-eyes)',body:'var(--pf25-body)',flow:'var(--pf25-flow)'};
let frame=0,observer=null,daybookTimer=0,quietActive=false,quietTitle='',quietRecords=[],lastPrivateMinute=-1,lastDaybookOpen=false;
let quietSeen=new WeakMap();
const id=value=>document.getElementById(value);
const $=selector=>document.querySelector(selector);
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const create=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content!=null)node.textContent=String(content);return node};
const button=(className,label,content='')=>{const node=create('button',className,content);node.type='button';node.setAttribute('aria-label',label);return node};
const root=()=>id(ROOT_ID);
const quiet=()=>document.body?.dataset.quiet==='true'||root()?.dataset.quiet==='true'||Boolean(readPrefs().quietMode);
function readPrefs(){try{return JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}')||{}}catch{return{}}}
function setAttr(node,name,value){if(!node)return;if(value==null){if(node.hasAttribute(name))node.removeAttribute(name);return}if(node.getAttribute(name)!==String(value))node.setAttribute(name,String(value))}
function setText(node,value){if(node&&node.textContent!==String(value))node.textContent=String(value)}
function localKey(value=new Date()){const date=value instanceof Date?value:new Date(value);return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function formatTime(value){try{return new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}catch{return'—'}}
function countdown(value){const delta=Number(new Date(value))-Date.now();if(!Number.isFinite(delta)||delta<=0)return'';const minutes=Math.max(1,Math.round(delta/60000));if(minutes<60)return`in ${minutes}m`;const hours=Math.floor(minutes/60),rest=minutes%60;return rest?`in ${hours}h ${rest}m`:`in ${hours}h`}
function genericLabel(node,value='Pacefold control'){if(node){setAttr(node,'aria-label',value);setAttr(node,'title',null)}}
function sourceFrom(node){return node?.dataset?.source||node?.dataset?.kind||''}
function privateLabel(node,value){if(!node||!value)return;const clean=text(value);if(clean&&node.getAttribute(PRIVATE_LABEL)!==clean)node.setAttribute(PRIVATE_LABEL,clean)}
function markPrivate(node,source=''){if(!node)return;node.dataset.private='true';if(source)setAttr(node,'data-private-source',source);const color=sourceColor[source]||'var(--pf25-green)';node.style.setProperty('--pf25-private-color',color)}

function discreetHome(){
  const r=root();if(!r)return;
  r.dataset.glancePrivacy='true';document.body.dataset.glancePrivacy='true';
  const day=id('pf25-dayline');if(day){day.dataset.private='true';genericLabel(day,'Workday progress');for(const marker of day.querySelectorAll('.pf25-day-marker'))genericLabel(marker,'Scheduled moment')}
  const rhythm=id('pf25-rhythm');if(rhythm){
    rhythm.dataset.private='true';genericLabel(rhythm,'Daily rhythm');
    [...rhythm.querySelectorAll('.pf25-rhythm-item')].forEach((item,index)=>{
      const label=text(item.querySelector('span')?.textContent)||item.getAttribute(PRIVATE_LABEL)||`Moment ${index+1}`;privateLabel(item,label);markPrivate(item,sourceFrom(item));
      const when=text(item.querySelector('strong')?.textContent);genericLabel(item,when?`Scheduled moment at ${when}`:'Scheduled moment');
    });
    const adjust=rhythm.querySelector('.pf25-rhythm-adjust');if(adjust)genericLabel(adjust,'Adjust rhythm');
  }
  const actions=$('.pf25Actions-action-grid');if(actions){
    [...actions.querySelectorAll('.pf25Actions-action')].forEach((item,index)=>{
      const label=text(item.querySelector('strong')?.textContent)||item.getAttribute(PRIVATE_LABEL)||`Action ${index+1}`;privateLabel(item,label);markPrivate(item,sourceFrom(item));genericLabel(item,`Pacefold action ${index+1}`);
    });
  }
  const cues=id('pf25-cue-dots');if(cues){genericLabel(cues,'Waiting cues');for(const dot of cues.querySelectorAll('.pf25-cue-dot'))genericLabel(dot,'Waiting cue')}
}

function scheduleState(){try{return window.__PACEFOLD_UNIFIED__?.schedule?.(true)||null}catch{return null}}
function currentMoment(){
  const state=scheduleState(),now=new Date();if(!state)return null;const today=Array.isArray(state.today)?state.today:[];
  const next=today.find(item=>item?.date&&new Date(item.date)>now&&item.id!=='sunrise')||today.find(item=>item?.date&&new Date(item.date)>now)||null;
  return next?{...next,state}:null
}
function weatherSnapshot(){
  const temp=text($('.pf-v25-activity-weather-temp')?.textContent)||text($('.pf25Spatial-weather-main strong')?.textContent)||'—';
  const condition=text($('.pf-v25-activity-weather-copy>strong')?.textContent)||text($('.pf25Spatial-weather-main span')?.textContent)||'Weather';
  const place=text($('.pf-v25-activity-weather-place')?.textContent)||text($('.pf25Spatial-weather-main small')?.textContent)||'';
  return{temp,condition,place}
}
function buildPrivateNow(){
  const face=$('.pf25Spatial-face-context');if(!face)return null;let glance=id('pf25-private-now');if(glance)return glance;
  glance=create('section','pf25-private-now');glance.id='pf25-private-now';glance.setAttribute('aria-label','Current glance');
  const weather=create('section','pf25-private-weather');weather.id='pf25-private-weather';
  const temperature=create('strong','pf25-private-temperature','—'),weatherCopy=create('span','pf25-private-weather-copy',''),place=create('small','pf25-private-place','');
  const refresh=button('pf25-private-refresh','Refresh','↻');refresh.addEventListener('click',()=>{const legacy=$('.pf-v25-activity-weather-refresh')||[...document.querySelectorAll('button')].find(node=>/refresh weather/i.test(text(node.textContent)+' '+text(node.getAttribute('aria-label'))));legacy?.click();setTimeout(queue,350)});weather.append(temperature,weatherCopy,place,refresh);
  const moment=create('section','pf25-private-moment');moment.id='pf25-private-moment';moment.tabIndex=0;moment.setAttribute('aria-label','Next scheduled moment');
  moment.append(create('i','pf25-private-moment-dot'),create('time','pf25-private-moment-time','—'),create('span','pf25-private-moment-countdown',''));
  const day=create('section','pf25-private-day');day.id='pf25-private-day';day.setAttribute('aria-label','Workday progress');
  const rail=create('div','pf25-private-day-rail'),fill=create('i','pf25-private-day-fill'),sun=create('b','pf25-private-day-sun');rail.append(fill,sun);
  const labels=create('div','pf25-private-day-labels');labels.append(create('span','pf25-private-day-start','—'),create('span','pf25-private-day-end','—'));day.append(rail,labels);
  glance.append(weather,moment,day);face.append(glance);return glance
}
function renderPrivateNow(){
  const glance=buildPrivateNow();if(!glance)return;
  const weather=weatherSnapshot();setText(glance.querySelector('.pf25-private-temperature'),weather.temp);setText(glance.querySelector('.pf25-private-weather-copy'),weather.condition);setText(glance.querySelector('.pf25-private-place'),weather.place);
  const next=currentMoment(),moment=glance.querySelector('.pf25-private-moment');
  if(moment){const source=String(next?.id||'');markPrivate(moment,source);privateLabel(moment,text(next?.label)||'Scheduled moment');setText(moment.querySelector('.pf25-private-moment-time'),next?formatTime(next.date):'—');setText(moment.querySelector('.pf25-private-moment-countdown'),next?countdown(next.date):'');genericLabel(moment,next?`Scheduled moment at ${formatTime(next.date)}`:'No scheduled moment')}
  const sourceDay=id('pf25-dayline'),privateDay=glance.querySelector('.pf25-private-day');if(sourceDay&&privateDay){
    const progress=sourceDay.style.getPropertyValue('--pf25-progress')||'0';privateDay.style.setProperty('--pf25-private-progress',progress);privateDay.dataset.state=sourceDay.dataset.state||'';
    setText(privateDay.querySelector('.pf25-private-day-start'),text(sourceDay.querySelector('.pf25-day-start')?.textContent)||'—');setText(privateDay.querySelector('.pf25-private-day-end'),text(sourceDay.querySelector('.pf25-day-end')?.textContent)||'—');
  }
  const face=$('.pf25Spatial-face-context');if(face){const eyebrow=face.querySelector('.pf25Spatial-eyebrow'),heading=face.querySelector('h1');if(eyebrow)setText(eyebrow,'');if(heading)setText(heading,'Now')}
}

function readNotes(){try{const value=JSON.parse(localStorage.getItem(NOTES_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
function writeNotes(value){localStorage.setItem(NOTES_KEY,JSON.stringify(value.slice(-1000)))}
function buildActivity(strip){
  if(!strip)return;const notes=readNotes(),counts=new Map();for(const note of notes){const key=String(note?.date||localKey(note?.updatedAt||note?.createdAt||Date.now()));counts.set(key,(counts.get(key)||0)+1)}
  strip.replaceChildren();for(let offset=13;offset>=0;offset-=1){const date=new Date();date.setDate(date.getDate()-offset);const key=localKey(date),count=counts.get(key)||0,dot=button('pf25-private-day-dot','Open date','');dot.dataset.date=key;dot.dataset.count=String(Math.min(9,count));dot.dataset.active=String(count>0);dot.style.setProperty('--pf25-note-density',String(Math.min(1,count/4)));dot.addEventListener('click',()=>{window.__PACEFOLD_SPATIAL__?.setNoteDate?.(key);closeDaybook();window.__PACEFOLD_SPATIAL__?.go?.('notes')});strip.append(dot)}
}
function daybookElements(){return{tray:id('pf25Surface-fold-tray'),toggle:id('pf25-daybook-toggle'),spine:id('pf25-private-daybook-spine'),sheet:id('pf25-private-daybook-sheet')}}
function suppressLegacyDaybook(){const tray=id('pf25Surface-fold-tray');if(!tray)return;for(const selector of ['.pf25Surface-fold-tabs','.pf25Surface-fold-summary','.pf25Surface-fold-latest','.pf25Surface-fold-head>div'])for(const node of tray.querySelectorAll(selector)){node.hidden=true;node.setAttribute('aria-hidden','true');node.style.setProperty('display','none','important')}}
function buildDaybook(){
  const tray=id('pf25Surface-fold-tray'),head=tray?.querySelector('.pf25Surface-fold-head'),body=tray?.querySelector('.pf25Surface-fold-body');if(!tray||!head||!body)return false;tray.classList.add('pf25-private-daybook');const r=root();if(r&&tray.parentElement!==r)r.append(tray);suppressLegacyDaybook();const legacyToggle=id('pf25-daybook-toggle');if(legacyToggle)genericLabel(legacyToggle,'Open fold');
  let spine=id('pf25-private-daybook-spine');if(!spine){spine=button('pf25-private-daybook-spine','Open fold','');spine.id='pf25-private-daybook-spine';spine.append(create('i','pf25-private-fold-mark'));spine.addEventListener('pointerdown',event=>event.stopPropagation());spine.addEventListener('keydown',event=>event.stopPropagation());spine.addEventListener('focusin',event=>event.stopPropagation());spine.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleDaybook()});head.prepend(spine)}
  let sheet=id('pf25-private-daybook-sheet');if(!sheet){
    sheet=create('section','pf25-private-daybook-sheet');sheet.id='pf25-private-daybook-sheet';sheet.setAttribute('aria-label','Private note sheet');
    const composer=create('div','pf25-private-composer'),input=create('textarea','pf25-private-input');input.id='pf25-private-daybook-input';input.placeholder='…';input.maxLength=8000;
    const footer=create('div','pf25-private-composer-foot'),status=create('span','pf25-private-save-state',''),save=button('pf25-private-save','Save','');save.append(create('i','pf25-private-save-fold'));save.addEventListener('click',savePrivateNote);input.addEventListener('keydown',event=>{resetDaybookTimer();if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();savePrivateNote()}});for(const type of ['pointerdown','keydown','focusin'])sheet.addEventListener(type,event=>event.stopPropagation());composer.append(input,footer);footer.append(status,save);
    const activity=create('div','pf25-private-activity');activity.id='pf25-private-activity';activity.setAttribute('aria-label','Recent note activity');sheet.append(composer,activity);body.prepend(sheet)
  }
  genericLabel(spine,'Open fold');return true
}
function savePrivateNote(){
  const input=id('pf25-private-daybook-input'),body=text(input?.value);if(!body)return;const now=new Date();
  try{let saved=false;if(typeof window.__PACEFOLD_WORKSPACE__?.addNote==='function')saved=window.__PACEFOLD_WORKSPACE__.addNote(body,'Daily')===true;else{const key=localKey(now),all=readNotes();all.push({id:`fold-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2,6)}`,date:key,body,category:'Daily',section:'Daily',createdAt:now.toISOString(),updatedAt:now.toISOString(),pinned:false,archived:false,completed:false,format:'markdown'});writeNotes(all);window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:NOTES_KEY,source:'privacy-fold-fallback'}}));saved=true}if(!saved)throw new Error('Notebook writer rejected note');try{window.__PACEFOLD_DAYFLOW__?.add?.('note','Note captured',body.slice(0,72),now.getTime(),'note-fold')}catch{}input.value='';setText(id('pf25-private-daybook-sheet')?.querySelector('.pf25-private-save-state'),'•');buildActivity(id('pf25-private-activity'));setTimeout(()=>{setText(id('pf25-private-daybook-sheet')?.querySelector('.pf25-private-save-state'),'');closeDaybook()},700)}catch(error){try{window.__PACEFOLD_DIAGNOSTICS__?.recordError?.('private-note-save',error)}catch{}setText(id('pf25-private-daybook-sheet')?.querySelector('.pf25-private-save-state'),'×')}
}
function setPrivateDaybook(open){const {tray,toggle}=daybookElements();if(!tray)return;tray.dataset.open=String(Boolean(open));if(toggle){toggle.textContent=open?'Close':'Open';toggle.setAttribute('aria-expanded',String(Boolean(open)))}syncDaybook()}
function toggleDaybook(){const {tray}=daybookElements();if(!tray)return;setPrivateDaybook(tray.dataset.open!=='true')}
function closeDaybook(){const {tray}=daybookElements();if(!tray||tray.dataset.open!=='true')return;clearTimeout(daybookTimer);daybookTimer=0;setPrivateDaybook(false)}
function resetDaybookTimer(){clearTimeout(daybookTimer);daybookTimer=0;const tray=id('pf25Surface-fold-tray');if(tray?.dataset.open==='true')daybookTimer=setTimeout(closeDaybook,45000)}
function syncDaybook(){
  if(!buildDaybook())return;suppressLegacyDaybook();const {tray,sheet}=daybookElements(),open=tray?.dataset.open==='true';if(tray)tray.dataset.privateOpen=String(open);if(sheet)sheet.hidden=!open;
  if(open){buildActivity(id('pf25-private-activity'));if(!lastDaybookOpen)requestAnimationFrame(()=>id('pf25-private-daybook-input')?.focus({preventScroll:true}));resetDaybookTimer()}else{clearTimeout(daybookTimer);daybookTimer=0}
  lastDaybookOpen=open;
}

function beginQuietScrub(){if(quietActive)return;quietActive=true;quietTitle=document.title;quietRecords=[];quietSeen=new WeakMap();document.title='Clock';scrubQuiet()}
function remember(record){
  if(!record?.node)return;let seen=quietSeen.get(record.node);if(!seen){seen=new Set();quietSeen.set(record.node,seen)}const key=record.kind==='attr'?`attr:${record.attr}`:'text';if(seen.has(key))return;seen.add(key);quietRecords.push(record)
}
function blankQuietContainers(){
  for(const selector of ['.pf25Spatial-face:not(.pf25Spatial-face-home)','#pf25Surface-fold-tray','#pf-local-workspace','#pf25-root','#panel','#foldDrawer','body>main'])for(const container of document.querySelectorAll(selector)){
    for(const node of container.querySelectorAll('[aria-label],[title]'))for(const attr of ['aria-label','title']){const value=node.getAttribute(attr);if(value){remember({kind:'attr',node,attr,value});node.setAttribute(attr,'Pacefold')}}
    const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT);let current;while((current=walker.nextNode())){const parent=current.parentElement;if(!parent||/^(?:SCRIPT|STYLE|NOSCRIPT)$/i.test(parent.tagName))continue;const value=current.nodeValue||'';if(!value.trim())continue;remember({kind:'text',node:current,value});current.nodeValue=''}
  }
}
function scrubQuiet(){
  if(!quietActive)return;document.title='Clock';blankQuietContainers();
  for(const node of document.querySelectorAll('[aria-label],[title]'))for(const attr of ['aria-label','title']){const value=node.getAttribute(attr);if(value&&SENSITIVE.test(value)){SENSITIVE.lastIndex=0;remember({kind:'attr',node,attr,value});node.setAttribute(attr,'Pacefold')}else SENSITIVE.lastIndex=0}
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let current;while((current=walker.nextNode())){const parent=current.parentElement;if(!parent||/^(?:SCRIPT|STYLE|NOSCRIPT)$/i.test(parent.tagName))continue;const value=current.nodeValue||'';if(!value||!SENSITIVE.test(value)){SENSITIVE.lastIndex=0;continue}SENSITIVE.lastIndex=0;remember({kind:'text',node:current,value});current.nodeValue=value.replace(SENSITIVE,'').replace(/\s{2,}/g,' ').trim()}
}
function endQuietScrub(){if(!quietActive)return;quietActive=false;for(const record of quietRecords.reverse()){try{if(record.kind==='attr'&&record.node?.isConnected)record.node.setAttribute(record.attr,record.value);else if(record.kind==='text'&&record.node?.isConnected)record.node.nodeValue=record.value}catch{}}quietRecords=[];quietSeen=new WeakMap();document.title=quietTitle||'Pacefold — Quiet Workday Rhythm';quietTitle='';setTimeout(()=>{window.__PACEFOLD_SPATIAL__?.refresh?.();window.__PACEFOLD_SURFACE__?.reconcile?.();queue()},0)}
function quietPass(){if(quiet()){beginQuietScrub();scrubQuiet();closeDaybook()}else endQuietScrub()}

function reconcile(){
  frame=0;const r=root();if(!r)return;discreetHome();buildDaybook();syncDaybook();renderPrivateNow();quietPass();r.dataset.privacyRevision=REVISION;document.documentElement.dataset.pacefoldPrivacy=REVISION;
}
function queue(){if(frame)return;frame=requestAnimationFrame(reconcile)}
function bindSpatialNavigation(){const spatial=window.__PACEFOLD_SPATIAL__;if(!spatial||typeof spatial.go!=='function'||spatial.__privacyBound)return;const original=spatial.go.bind(spatial);spatial.go=(mode,...args)=>{const result=original(mode,...args);queue();requestAnimationFrame(queue);setTimeout(queue,380);return result};Object.defineProperty(spatial,'__privacyBound',{value:true,configurable:true})}
function install(){
  if(observer)return;bindSpatialNavigation();queue();
  observer=new MutationObserver(mutations=>{if(mutations.some(m=>m.target?.closest?.('#pf25-private-now,#pf25-private-daybook-sheet')))return;queue()});observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-mode','data-open','data-quiet','data-state','data-source','aria-label','title']});
  document.addEventListener('pointerdown',event=>{const tray=id('pf25Surface-fold-tray');if(tray?.dataset.open==='true'){if(tray.contains(event.target))resetDaybookTimer();else closeDaybook()}},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&id('pf25Surface-fold-tray')?.dataset.open==='true'){event.preventDefault();event.stopImmediatePropagation();closeDaybook()}},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)closeDaybook();else queue()});window.addEventListener('blur',closeDaybook);
  for(const event of ['pacefold:prefs','pacefold:quiet','pacefold:storage-changed','pacefold:spatial-ready','pacefold:experience-ready'])window.addEventListener(event,queue);
  setInterval(()=>{const minute=Math.floor(Date.now()/60000);if(minute!==lastPrivateMinute){lastPrivateMinute=minute;queue()}},1000);
  window.__PACEFOLD_PRIVACY__={release:RELEASE,revision:REVISION,reconcile:queue,closeDaybook};
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();
