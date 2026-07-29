(() => {
'use strict';

const RELEASE='19.1.0';
const WEATHER_KEY='pacefold.v19.weather.v1';
const WEATHER_TTL=20*60*1000;
const WEATHER_REFRESH=20*60*1000;
const RITUALS={
  water:{name:'Water',button:'waterBtn'},
  noodle:{name:'Timer',button:'noodleBtn'},
  away:{name:'Away',button:'awayBtn'},
  lunch:{name:'Meal',button:'lunchBtn'},
  eyes:{name:'Eyes',button:'eyesBtn'},
  body:{name:'Move',button:'careBtn'}
};
const WEATHER_LABELS={
  0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Cloudy',45:'Fog',48:'Icy fog',
  51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Freezing drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',
  80:'Light showers',81:'Showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',
  95:'Thunderstorm',96:'Thunderstorm',99:'Severe thunderstorm'
};

let mounted=false;
let weatherRequest=null;
let weatherTimer=0;
let reconcileFrame=0;
let surfaceObserver=null;
let textObserver=null;
let lastWeather=null;
let lastWeatherAt=0;
let workbenchPage='notes';

const byId=id=>document.getElementById(id);
const compact=value=>String(value??'').replace(/\s+/g,' ').trim();
const clamp=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
const safeParse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}};
const create=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!=null)node.textContent=text;
  return node;
};
const button=(className,text,label)=>{
  const node=create('button',className,text);
  node.type='button';
  if(label)node.setAttribute('aria-label',label);
  return node;
};
const getPrefs=()=>window.__PACEFOLD_MA_CORE__?.getPrefs?.()||safeParse(localStorage.getItem('pacefoldPrefsV15'),{});

function report(scope,error){
  try{window.__PACEFOLD_RESILIENCE__?.recordError?.(`v19-${scope}`,error);}catch{}
}

function guarded(scope,callback){
  return function(...args){
    try{return callback.apply(this,args);}
    catch(error){report(scope,error);return undefined;}
  };
}

function setupVisible(){
  return Boolean(window.__PACEFOLD_GUARDIAN__?.setupVisible?.()||
    [...document.querySelectorAll('#onboarding,.onboarding,[data-onboard-profile],.onboarding-option')]
      .some(node=>!node.hidden&&node.getAttribute('aria-hidden')!=='true'&&getComputedStyle(node).display!=='none'));
}

function weatherKind(code){
  code=Number(code);
  if(code===0)return'clear';
  if(code<=3)return'cloud';
  if(code===45||code===48)return'fog';
  if(code>=51&&code<=67||code>=80&&code<=82)return'rain';
  if(code>=71&&code<=77||code>=85&&code<=86)return'snow';
  if(code>=95)return'storm';
  return'mixed';
}

function weatherUrl(prefs){
  const lat=clamp(prefs.lat,-90,90,43.6532);
  const lng=clamp(prefs.lng,-180,180,-79.3832);
  const query=new URLSearchParams({
    latitude:String(lat),
    longitude:String(lng),
    current:'temperature_2m,apparent_temperature,weather_code,is_day,precipitation,rain',
    hourly:'temperature_2m,precipitation_probability,weather_code',
    daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit:'celsius',
    precipitation_unit:'mm',
    timezone:'auto',
    forecast_days:'3'
  });
  return`https://api.open-meteo.com/v1/forecast?${query}`;
}

function locationKey(prefs){
  return`${clamp(prefs.lat,-90,90,43.6532).toFixed(3)},${clamp(prefs.lng,-180,180,-79.3832).toFixed(3)}`;
}

function readWeatherCache(prefs){
  const cache=safeParse(localStorage.getItem(WEATHER_KEY),null);
  if(!cache||cache.location!==locationKey(prefs)||!cache.data)return null;
  return cache;
}

function writeWeatherCache(prefs,data){
  try{localStorage.setItem(WEATHER_KEY,JSON.stringify({savedAt:Date.now(),location:locationKey(prefs),data}));}catch(error){report('weather-cache',error);}
}

function normalizeWeather(data,prefs){
  const hourlyTimes=Array.isArray(data.hourly?.time)?data.hourly.time:[];
  const now=Date.now();
  let hourIndex=hourlyTimes.findIndex(value=>new Date(value).getTime()>=now-30*60000);
  if(hourIndex<0)hourIndex=0;
  const nextHours=hourlyTimes.slice(hourIndex,hourIndex+4).map((time,index)=>({
    time,
    rain:Number(data.hourly?.precipitation_probability?.[hourIndex+index])||0,
    temperature:Number(data.hourly?.temperature_2m?.[hourIndex+index]),
    code:Number(data.hourly?.weather_code?.[hourIndex+index])
  }));
  const days=(data.daily?.time||[]).slice(0,3).map((date,index)=>({
    date,
    code:Number(data.daily?.weather_code?.[index]),
    high:Number(data.daily?.temperature_2m_max?.[index]),
    low:Number(data.daily?.temperature_2m_min?.[index]),
    rain:Number(data.daily?.precipitation_probability_max?.[index])||0
  }));
  return{
    location:compact(prefs.locationLabel)||'Current location',
    current:{
      temperature:Number(data.current?.temperature_2m),
      feels:Number(data.current?.apparent_temperature),
      code:Number(data.current?.weather_code),
      rain:Number(data.current?.rain)||Number(data.current?.precipitation)||0
    },
    nextHours,
    days
  };
}

function weatherSummary(weather){
  const peak=Math.max(0,...weather.nextHours.map(hour=>hour.rain));
  if(weather.current.rain>.05)return`${weather.current.rain.toFixed(1)} mm now`;
  if(peak>=70)return`Rain likely in the next few hours`;
  if(peak>=35)return`Rain possible · up to ${Math.round(peak)}%`;
  if(peak>0)return`Low rain chance · ${Math.round(peak)}%`;
  return'No rain showing soon';
}

function renderWeather(weather,{stale=false}={}){
  lastWeather=weather;
  const card=byId('pf-v19-weather');
  if(!card)return;
  const code=Number(weather.current.code);
  card.dataset.weather=weatherKind(code);
  const temperature=byId('pf-v19-weather-temp');
  const condition=byId('pf-v19-weather-condition');
  const location=byId('pf-v19-weather-location');
  const summary=byId('pf-v19-weather-summary');
  const meta=byId('pf-v19-weather-meta');
  if(temperature)temperature.textContent=Number.isFinite(weather.current.temperature)?`${Math.round(weather.current.temperature)}°`:'—';
  if(condition)condition.textContent=WEATHER_LABELS[code]||'Mixed conditions';
  if(location)location.textContent=weather.location;
  if(summary)summary.textContent=weatherSummary(weather);
  if(meta){
    const feels=Number.isFinite(weather.current.feels)?`Feels ${Math.round(weather.current.feels)}°`:'Current conditions';
    meta.textContent=stale?`${feels} · saved forecast`:feels;
  }
  const days=card.querySelectorAll('[data-v19-weather-day]');
  weather.days.slice(0,3).forEach((day,index)=>{
    const target=days[index];
    if(!target)return;
    target.dataset.weather=weatherKind(day.code);
    const date=new Date(`${day.date}T12:00:00`);
    target.querySelector('strong').textContent=index===0?'Today':date.toLocaleDateString(undefined,{weekday:'short'});
    target.querySelector('span').textContent=`${Math.round(day.high)}° / ${Math.round(day.low)}°`;
    target.querySelector('small').textContent=`${Math.round(day.rain)}% rain`;
  });
  card.dataset.ready='true';
}

function renderWeatherUnavailable(){
  const card=byId('pf-v19-weather');
  if(!card||lastWeather)return;
  card.dataset.weather='mixed';
  byId('pf-v19-weather-temp').textContent='—';
  byId('pf-v19-weather-condition').textContent='Weather offline';
  byId('pf-v19-weather-summary').textContent='Refresh when connected';
  byId('pf-v19-weather-meta').textContent='The clock and timers remain local';
}

async function refreshWeather(force=false){
  if(weatherRequest)return weatherRequest;
  const prefs=getPrefs();
  const cache=readWeatherCache(prefs);
  if(cache&&!force){
    lastWeatherAt=Number(cache.savedAt)||0;
    renderWeather(cache.data,{stale:Date.now()-lastWeatherAt>WEATHER_TTL});
    if(Date.now()-lastWeatherAt<WEATHER_TTL)return cache.data;
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  const card=byId('pf-v19-weather');
  if(card)card.dataset.loading='true';
  weatherRequest=fetch(weatherUrl(prefs),{signal:controller.signal})
    .then(response=>{if(!response.ok)throw new Error(`Weather ${response.status}`);return response.json();})
    .then(data=>{
      const weather=normalizeWeather(data,prefs);
      lastWeatherAt=Date.now();
      writeWeatherCache(prefs,weather);
      renderWeather(weather);
      return weather;
    })
    .catch(error=>{
      if(cache)renderWeather(cache.data,{stale:true});
      else renderWeatherUnavailable();
      if(error?.name!=='AbortError')report('weather',error);
      return cache?.data||null;
    })
    .finally(()=>{
      clearTimeout(timeout);
      weatherRequest=null;
      if(card)delete card.dataset.loading;
    });
  return weatherRequest;
}

function weatherCard(){
  const card=create('section','pf-v19-weather');
  card.id='pf-v19-weather';
  card.setAttribute('aria-label','Weather at the saved location');

  const head=create('header','pf-v19-weather-head');
  const place=button('pf-v19-weather-place','Current location','Open settings to change the weather location');
  const location=create('strong','',compact(getPrefs().locationLabel)||'Current location');
  location.id='pf-v19-weather-location';
  place.replaceChildren(location,create('span','','Weather'));
  place.addEventListener('click',()=>byId('brandButton')?.click());
  const refresh=button('pf-v19-weather-refresh','↻','Refresh weather');
  refresh.addEventListener('click',()=>refreshWeather(true));
  head.append(place,refresh);

  const current=create('div','pf-v19-weather-current');
  const mark=create('span','pf-v19-weather-mark');
  mark.setAttribute('aria-hidden','true');
  const temp=create('strong','pf-v19-weather-temp','—');
  temp.id='pf-v19-weather-temp';
  const copy=create('div','pf-v19-weather-copy');
  const condition=create('span','','Loading weather');
  condition.id='pf-v19-weather-condition';
  const summary=create('strong','','Checking the next few hours');
  summary.id='pf-v19-weather-summary';
  const meta=create('small','','Saved location forecast');
  meta.id='pf-v19-weather-meta';
  copy.append(condition,summary,meta);
  current.append(mark,temp,copy);

  const days=create('div','pf-v19-weather-days');
  for(let index=0;index<3;index+=1){
    const day=create('article','pf-v19-weather-day');
    day.dataset.v19WeatherDay=String(index);
    day.append(create('strong','',index?'—':'Today'),create('span','','— / —'),create('small','','—% rain'));
    days.append(day);
  }
  card.append(head,current,days);
  return card;
}

function ritualGrid(){
  const workline=byId('workline');
  if(!workline)return false;
  for(const [source,definition] of Object.entries(RITUALS)){
    const control=byId(definition.button);
    if(!control)continue;
    let slot=control.closest('.pf-ritual-slot');
    if(!slot){
      slot=create('span','pf-ritual-slot');
      slot.dataset.source=source;
      control.parentNode.insertBefore(slot,control);
      slot.append(control);
    }
    slot.dataset.v19Ritual='true';
    if(source==='body'&&slot.parentElement!==workline)workline.append(slot);
    if(!slot.querySelector('.pf-v19-ritual-name'))slot.prepend(create('span','pf-v19-ritual-name',definition.name));
  }
  for(const divider of workline.querySelectorAll('.ritual-divider'))divider.setAttribute('aria-hidden','true');
  updateRitualStates();
  return Object.values(RITUALS).every(definition=>byId(definition.button)?.closest('#workline'));
}

function updateRitualStates(){
  const prefs=getPrefs();
  const active={
    water:false,
    noodle:Boolean(Number(prefs.noodleStart)),
    away:Boolean(Number(prefs.awayStart)),
    lunch:Boolean(Number(prefs.lunchStart)),
    eyes:Boolean(Number(prefs.gazeActiveStart)),
    body:Boolean(Number(prefs.bodyActiveStart))
  };
  const source=document.body.dataset.source;
  const signal=document.body.dataset.signal;
  for(const [name] of Object.entries(RITUALS)){
    const slot=document.querySelector(`.pf-ritual-slot[data-source="${name}"]`);
    if(!slot)continue;
    slot.dataset.active=String(Boolean(active[name]));
    slot.dataset.attention=String(source===name&&signal!=='none');
  }
}

function proxyClick(selector){
  const target=document.querySelector(selector);
  if(target)target.click();
}

function workbenchTab(page,label,detail){
  const node=button('pf-v19-workbench-tab','',`Show ${label}`);
  node.dataset.workbenchPage=page;
  node.setAttribute('role','tab');
  const copy=create('span','');
  copy.append(create('strong','',label),create('small','',detail));
  node.append(copy);
  node.addEventListener('click',()=>setWorkbenchPage(page,{focus:true}));
  return node;
}

function setWorkbenchPage(page,{focus=false}={}){
  page=page==='sound'?'sound':'notes';
  const workbench=byId('pf-v19-workbench');
  const workspace=byId('pf-local-workspace');
  const player=byId('pf-local-player');
  if(!workbench||!workspace||!player)return false;
  workbenchPage=page;
  workbench.dataset.page=page;
  workspace.hidden=page!=='notes';
  player.hidden=page!=='sound';
  workspace.inert=page!=='notes';
  player.inert=page!=='sound';
  for(const tab of workbench.querySelectorAll('[data-workbench-page]')){
    const selected=tab.dataset.workbenchPage===page;
    tab.setAttribute('aria-selected',String(selected));
    tab.setAttribute('tabindex',selected?'0':'-1');
  }
  if(page==='sound')window.__PACEFOLD_REVAMP__?.player?.open?.();
  else{
    window.__PACEFOLD_REVAMP__?.player?.close?.();
    window.__PACEFOLD_REVAMP__?.openNotebook?.();
  }
  document.body.dataset.v19Surface='workbench';
  document.body.dataset.v19WorkbenchPage=page;
  if(focus){
    const target=page==='notes'
      ?workspace.querySelector('[data-pf-note-body]')
      :player.querySelector('[data-pf-player-title]');
    target?.focus?.({preventScroll:true});
  }
  syncMusicState();
  return true;
}

function installWorkbench(){
  if(byId('pf-v19-workbench'))return true;
  const main=document.querySelector('main');
  const shell=main?.querySelector('.clock-shell');
  const workspace=byId('pf-local-workspace');
  const player=byId('pf-local-player');
  if(!main||!shell||!workspace||!player)return false;

  const workbench=create('section','pf-v19-workbench');
  workbench.id='pf-v19-workbench';
  workbench.dataset.page='notes';
  workbench.setAttribute('aria-label','Pacefold workday notebook');

  const rail=create('header','pf-v19-workbench-rail');
  const identity=create('div','pf-v19-workbench-identity');
  const mark=create('span','pf-v19-workbench-mark');
  mark.setAttribute('aria-hidden','true');
  const identityCopy=create('span','');
  identityCopy.append(create('strong','','Notebook'),create('small','','Always here · saved on this device'));
  identity.append(mark,identityCopy);

  const tabs=create('div','pf-v19-workbench-tabs');
  tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label','Notebook pages');
  tabs.append(
    workbenchTab('notes','Notes','Write and review'),
    workbenchTab('sound','Sound','Local audio')
  );

  const nowPlaying=create('div','pf-v19-workbench-playing');
  const play=button('pf-v19-workbench-play','▶','Play local audio');
  play.id='pf-v19-music-play';
  play.addEventListener('click',event=>{
    event.stopPropagation();
    proxyClick('#pf-local-player [data-pf-player-play]');
  });
  const playingCopy=button('pf-v19-workbench-track','','Show local audio');
  const playingText=create('span','');
  playingText.append(create('strong','','No local track'),create('small','','Sound stays on this device'));
  playingCopy.append(playingText);
  playingCopy.addEventListener('click',()=>setWorkbenchPage('sound',{focus:true}));
  nowPlaying.append(play,playingCopy);

  const extra=create('div','pf-v19-workbench-extra');
  extra.id='pf-v19-workbench-extra';
  const body=create('div','pf-v19-workbench-body');
  body.append(workspace,player);
  rail.append(identity,tabs,nowPlaying,extra);
  workbench.append(rail,body);
  shell.insertAdjacentElement('afterend',workbench);

  byId('pf-v19-scrim')?.remove();
  setWorkbenchPage('notes');
  return true;
}

function syncMusicState(){
  const title=document.querySelector('#pf-local-player [data-pf-player-title]');
  const sourcePlay=document.querySelector('#pf-local-player [data-pf-player-play]');
  const play=byId('pf-v19-music-play');
  const track=byId('pf-v19-workbench')?.querySelector('.pf-v19-workbench-track');
  if(track){
    const name=track.querySelector('strong');
    const detail=track.querySelector('small');
    const next=compact(title?.textContent)||'No local track';
    if(name&&name.textContent!==next)name.textContent=next;
    if(detail&&detail.textContent!=='Sound stays on this device')detail.textContent='Sound stays on this device';
  }
  if(play){
    const playing=sourcePlay?.getAttribute('aria-label')==='Pause';
    const glyph=playing?'Ⅱ':'▶',label=playing?'Pause local audio':'Play local audio';
    if(play.textContent!==glyph)play.textContent=glyph;
    if(play.getAttribute('aria-label')!==label)play.setAttribute('aria-label',label);
  }
}

function identityPass(){
  if(document.body.dataset.quiet==='true')return;
  const replacements=new Map([
    ['Kiroku','Quick note'],
    ['Ma · Day Ribbon','Day Ribbon'],
    ['Sumi workspace','Workspace'],
    ['OneNote bridge','Local notes']
  ]);
  for(const node of document.querySelectorAll('#foldKicker,[data-pf-sheet-kicker],[data-pf-sheet-title],#pf-hub-root strong,#pf-hub-root small')){
    const next=replacements.get(compact(node.textContent));
    if(next&&node.textContent!==next)node.textContent=next;
  }
  const foldKicker=byId('foldKicker');
  if(foldKicker&&foldKicker.textContent!=='Quick note')foldKicker.textContent='Quick note';
}

function reconcileSurfaces(){
  const workbench=byId('pf-v19-workbench');
  if(workbench&&workbench.dataset.page!==workbenchPage)workbench.dataset.page=workbenchPage;
  if(document.body.dataset.v19Surface!=='workbench')document.body.dataset.v19Surface='workbench';
  if(document.body.dataset.v19WorkbenchPage!==workbenchPage)document.body.dataset.v19WorkbenchPage=workbenchPage;
  syncMusicState();
}

function observeSurfaces(){
  surfaceObserver?.disconnect();
  surfaceObserver=new MutationObserver(()=>{
    if(reconcileFrame)return;
    reconcileFrame=requestAnimationFrame(()=>{
      reconcileFrame=0;
      reconcileSurfaces();
      updateRitualStates();
      identityPass();
    });
  });
  for(const node of [byId('pf-local-workspace'),byId('pf-local-player')])
    if(node)surfaceObserver.observe(node,{attributes:true,childList:true,subtree:true,characterData:true,attributeFilter:['class','aria-label']});
  surfaceObserver.observe(document.body,{attributes:true,attributeFilter:['data-source','data-signal']});
}

function observeIdentity(){
  textObserver?.disconnect();
  textObserver=new MutationObserver(()=>queueMicrotask(identityPass));
  for(const node of [byId('foldDrawer'),byId('pf-hub-root')])if(node)textObserver.observe(node,{childList:true,subtree:true,characterData:true});
}

function exposeModules(){
  const modules=new Map();
  const registerModule=(id,node)=>{
    id=compact(id);
    if(!/^[a-z][a-z0-9-]{1,40}$/.test(id)||!(node instanceof Element))throw new Error('Pacefold module needs a safe id and an Element.');
    if(modules.has(id))return false;
    node.dataset.pfV19Module=id;
    byId('pf-v19-workbench-extra')?.append(node);
    modules.set(id,node);
    return true;
  };
  const unregisterModule=id=>{
    const node=modules.get(id);
    if(!node)return false;
    node.remove();
    modules.delete(id);
    return true;
  };
  window.__PACEFOLD_V19__={
    release:RELEASE,
    refreshWeather:()=>refreshWeather(true),
    registerModule,
    unregisterModule,
    showNotes:()=>setWorkbenchPage('notes',{focus:true}),
    showSound:()=>setWorkbenchPage('sound',{focus:true}),
    reconcile:reconcileSurfaces
  };
}

function mount(){
  if(mounted||setupVisible())return false;
  const shell=document.querySelector('main .clock-shell');
  const status=byId('statusLine');
  const statusArea=document.querySelector('.status-area');
  if(!shell||!status||!statusArea||!window.__PACEFOLD_MA_CORE__||!byId('pf-hub-root')||!byId('pf-local-player'))return false;
  mounted=true;
  document.documentElement.classList.add('pf-v19-active');
  document.body.dataset.pacefoldRelease=RELEASE;
  shell.dataset.v19Dashboard='true';
  status.setAttribute('aria-live','polite');

  if(!byId('pf-v19-weather'))shell.insertBefore(weatherCard(),statusArea);
  ritualGrid();
  if(!installWorkbench())return false;
  byId('workline')?.addEventListener('click',guarded('rhythm-state',()=>requestAnimationFrame(updateRitualStates)));
  window.addEventListener('pacefold:ma-prefs',guarded('prefs-state',updateRitualStates));
  identityPass();
  observeSurfaces();
  observeIdentity();
  reconcileSurfaces();
  exposeModules();

  const prefs=getPrefs(),cache=readWeatherCache(prefs);
  if(cache){
    lastWeatherAt=Number(cache.savedAt)||0;
    renderWeather(cache.data,{stale:Date.now()-lastWeatherAt>WEATHER_TTL});
  }
  void refreshWeather(false);
  clearInterval(weatherTimer);
  weatherTimer=setInterval(()=>void refreshWeather(false),WEATHER_REFRESH);
  window.addEventListener('focus',guarded('focus-weather',()=>{
    if(Date.now()-lastWeatherAt>WEATHER_TTL)void refreshWeather(false);
    updateRitualStates();
  }));
  window.addEventListener('storage',guarded('storage',event=>{
    if(event.key==='pacefoldPrefsV15'){void refreshWeather(true);updateRitualStates();}
  }));
  window.dispatchEvent(new CustomEvent('pacefold:v19-ready',{detail:{release:RELEASE}}));
  return true;
}

function boot(attempt=0){
  if(setupVisible()){setTimeout(()=>boot(Math.min(attempt+1,120)),250);return;}
  if(mount())return;
  if(attempt<120)setTimeout(()=>boot(attempt+1),100);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});
else boot();
})();
