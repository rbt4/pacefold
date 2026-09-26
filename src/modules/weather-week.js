import{id,el,button}from'./state.js';

// Seven-day outlook for Clock and the scenic cover, from Open-Meteo (no key, no
// account; it blends the best national weather models for the location, such as
// Environment Canada's GEM for Toronto). Location names are never shown on these
// ambient surfaces, only conditions and temperatures.
const STORE='pacefold.week.v1';
const FRESH_MS=30*60000;
const API='https://api.open-meteo.com/v1/forecast';
const SVG='http://www.w3.org/2000/svg';

const KIND=code=>{
  const c=Number(code);
  if(c===0)return'clear';
  if(c===1||c===2)return'partly';
  if(c===3)return'cloudy';
  if(c===45||c===48)return'fog';
  if(c>=51&&c<=57)return'drizzle';
  if((c>=61&&c<=67)||(c>=80&&c<=82))return'rain';
  if((c>=71&&c<=77)||c===85||c===86)return'snow';
  if(c>=95)return'storm';
  return'cloudy';
};
const LABEL={clear:'Clear',partly:'Partly cloudy',cloudy:'Cloudy',fog:'Fog',drizzle:'Drizzle',rain:'Rain',snow:'Snow',storm:'Thunderstorms'};

// Styles go through the CSSOM: the app's CSP (style-src 'self') refuses style attributes.
const node=(tag,attrs={},...children)=>{const n=document.createElementNS(SVG,tag);for(const[k,v]of Object.entries(attrs)){if(k==='delay')n.style.animationDelay=v;else n.setAttribute(k,String(v))}n.append(...children);return n};
const CLOUD='M15 36h19a8 8 0 0 0 .8-15.96A11 11 0 0 0 13.6 22.5 7 7 0 0 0 15 36z';

// Hand-drawn weather marks. Parts carry classes so CSS can colour and animate them.
export function weatherIcon(kind){
  const svg=node('svg',{viewBox:'0 0 48 48','aria-hidden':'true',class:`wx wx-${kind}`});
  const sun=(cx,cy,r)=>{
    const rays=node('g',{class:'wx-rays'});
    for(let i=0;i<8;i+=1){const a=i*Math.PI/4,x1=cx+Math.cos(a)*(r+4),y1=cy+Math.sin(a)*(r+4),x2=cx+Math.cos(a)*(r+8),y2=cy+Math.sin(a)*(r+8);rays.append(node('line',{x1:x1.toFixed(1),y1:y1.toFixed(1),x2:x2.toFixed(1),y2:y2.toFixed(1)}))}
    rays.style.transformOrigin=`${cx}px ${cy}px`;
    return node('g',{class:'wx-sun'},rays,node('circle',{cx,cy,r,class:'wx-core'}));
  };
  const cloud=(extra='')=>node('path',{d:CLOUD,class:`wx-cloud ${extra}`});
  if(kind==='clear')svg.append(sun(24,24,9));
  else if(kind==='partly')svg.append(sun(18,18,7),cloud());
  else if(kind==='cloudy')svg.append(node('path',{d:CLOUD,class:'wx-cloud wx-back',transform:'translate(7 -7) scale(.8)'}),cloud());
  else if(kind==='fog')svg.append(cloud('wx-dim'),...[36,41].map((y,i)=>node('line',{x1:10+i*4,y1:y,x2:38-i*2,y2:y,class:'wx-fog'})));
  else if(kind==='drizzle')svg.append(cloud(),...[16,24,32].map((x,i)=>node('circle',{cx:x,cy:41,r:1.4,class:'wx-drop',delay:`${i*-.4}s`})));
  else if(kind==='rain')svg.append(cloud(),...[16,24,32].map((x,i)=>node('line',{x1:x,y1:39,x2:x-2,y2:45,class:'wx-drop',delay:`${i*-.33}s`})));
  else if(kind==='snow')svg.append(cloud(),...[16,24,32].map((x,i)=>node('circle',{cx:x,cy:41,r:1.8,class:'wx-flake',delay:`${i*-.7}s`})));
  else if(kind==='storm')svg.append(cloud('wx-dark'),node('path',{d:'M25 32l-5 8h5l-3 7 8-10h-5l3-5z',class:'wx-bolt'}));
  return svg;
}

// Temperature → colour on a fixed scale so a warm week looks warm.
const STOPS=[[-20,[86,110,196]],[-5,[96,150,222]],[5,[111,180,200]],[14,[140,205,170]],[22,[242,193,78]],[30,[238,128,79]],[38,[206,70,70]]];
const colour=t=>{
  if(t<=STOPS[0][0])return`rgb(${STOPS[0][1]})`;
  for(let i=1;i<STOPS.length;i+=1){const[t1,c1]=STOPS[i];if(t<=t1){const[t0,c0]=STOPS[i-1],k=(t-t0)/(t1-t0);return`rgb(${c0.map((v,j)=>Math.round(v+(c1[j]-v)*k)).join(',')})`}}
  return`rgb(${STOPS.at(-1)[1]})`;
};

export function installWeatherWeek(ctx){
  const home=document.querySelector('.view-home'),hero=document.querySelector('.cover-hero');
  if(!home||id('week-sky'))return;

  const section=el('section','week-sky');section.id='week-sky';section.setAttribute('aria-label','Seven-day forecast');
  const head=el('header'),copy=el('span'),kicker=el('small','','Week ahead'),headline=el('strong','','Forecast');headline.id='week-headline';
  copy.append(kicker,headline);
  const meta=el('em','week-meta','');meta.id='week-meta';
  head.append(copy,meta);
  const days=el('div','week-days');days.id='week-days';
  const invite=button('week-invite','Turn on the weekly forecast','Show the week’s weather');invite.hidden=true;
  invite.addEventListener('click',async()=>{await ctx.toggleSetting?.('weatherEnabled');void refresh(true)});
  section.append(head,days,invite);
  home.prepend(section);

  const strip=el('div','cover-week');strip.id='cover-week';strip.setAttribute('aria-label','Seven-day forecast');strip.hidden=true;
  hero?.append(strip);

  const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}};
  const write=value=>{try{localStorage.setItem(STORE,JSON.stringify(value))}catch{}};
  const sameSpot=cached=>cached&&Math.abs(cached.lat-ctx.prefs.lat)<.01&&Math.abs(cached.lng-ctx.prefs.lng)<.01&&cached.timeZone===ctx.prefs.timeZone;

  const dayName=(iso,index,style='long')=>index===0?'Today':new Intl.DateTimeFormat(undefined,{weekday:style,timeZone:'UTC'}).format(new Date(`${iso}T12:00:00Z`));
  const ago=ms=>{const m=Math.round(ms/60000);return m<1?'just now':m<60?`${m} min ago`:`${Math.round(m/60)}h ago`};

  function render(){
    const on=Boolean(ctx.prefs.weatherEnabled),cached=read(),data=sameSpot(cached)?cached.data:null;
    section.dataset.state=!on?'off':data?'ready':'waiting';
    invite.hidden=on;
    strip.hidden=!on||!data;
    days.replaceChildren();strip.replaceChildren();
    if(!on){headline.textContent='Weather is off';meta.textContent='';return}
    if(!data?.daily?.time?.length){headline.textContent=navigator.onLine?'Fetching the week…':'Offline · no forecast saved yet';meta.textContent='';return}

    const d=data.daily,count=Math.min(7,d.time.length),lows=d.temperature_2m_min.slice(0,count),highs=d.temperature_2m_max.slice(0,count);
    const min=Math.min(...lows),max=Math.max(...highs),span=Math.max(1,max-min);
    days.style.setProperty('--track-stops',`${colour(min)},${colour((min+max)/2)},${colour(max)}`);
    const current=data.current;
    const nowKind=KIND(current?.weather_code??d.weather_code[0]);
    headline.textContent=current?`${Math.round(current.temperature_2m)}° now · ${LABEL[nowKind]}`:LABEL[KIND(d.weather_code[0])];
    meta.textContent=`${current?`Feels ${Math.round(current.apparent_temperature)}° · `:''}Updated ${ago(Date.now()-cached.savedAt)}`;

    for(let i=0;i<count;i+=1){
      const kind=KIND(d.weather_code[i]),hi=Math.round(highs[i]),lo=Math.round(lows[i]),pop=Math.round(Number(d.precipitation_probability_max?.[i])||0);
      const name=dayName(d.time[i],i),short=dayName(d.time[i],i,'short');
      const day=el('article','week-day');day.dataset.kind=kind;day.dataset.index=String(i);day.tabIndex=0;day.dataset.today=String(i===0);
      day.setAttribute('aria-label',`${name}: ${LABEL[kind]}, high ${hi}°, low ${lo}°${pop>=20?`, ${pop}% chance of precipitation`:''}`);
      day.style.setProperty('--lo',((lows[i]-min)/span).toFixed(3));
      day.style.setProperty('--hi',((highs[i]-min)/span).toFixed(3));
      const range=el('span','wd-range'),bar=el('i');range.append(bar);
      if(i===0&&current){const dot=el('b','wd-now');dot.style.setProperty('--at',((current.temperature_2m-min)/span).toFixed(3));range.append(dot)}
      const popNode=el('small','wd-pop',pop>=20?`${pop}%`:'');
      day.append(el('b','wd-name',i===0?'Today':short),el('span','wd-label',LABEL[kind]),weatherIcon(kind),popNode,el('small','wd-lo',`${lo}°`),range,el('strong','wd-hi',`${hi}°`));
      days.append(day);

      const chip=el('button','cw-day');chip.type='button';chip.dataset.index=String(i);chip.dataset.today=String(i===0);chip.setAttribute('aria-label',`${name}: ${LABEL[kind]}, ${hi}° / ${lo}°. Open weather`);
      chip.append(el('b','',i===0?'Today':short),weatherIcon(kind),el('strong','',`${hi}°`),el('small','',`${lo}°`));
      strip.append(chip);
    }
  }

  let busy=false;
  async function refresh(force=false){
    if(!ctx.prefs.weatherEnabled){render();return}
    const cached=read();
    if(!force&&sameSpot(cached)&&Date.now()-cached.savedAt<FRESH_MS){render();return}
    if(busy)return;busy=true;render();
    try{
      const query=new URLSearchParams({
        latitude:String(ctx.prefs.lat),longitude:String(ctx.prefs.lng),timezone:ctx.prefs.timeZone,forecast_days:'7',models:'best_match',
        current:'temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation',
        hourly:'temperature_2m,apparent_temperature,weather_code,precipitation_probability,precipitation,wind_speed_10m,uv_index',
        daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_direction_10m_dominant',
        minutely_15:'precipitation',forecast_minutely_15:'8'
      });
      const response=await fetch(`${API}?${query}`,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
      if(!response.ok)throw new Error(`Forecast ${response.status}`);
      const data=await response.json();
      if(!Array.isArray(data?.daily?.time))throw new Error('Forecast missing days');
      write({savedAt:Date.now(),lat:ctx.prefs.lat,lng:ctx.prefs.lng,timeZone:ctx.prefs.timeZone,data});
    }catch(error){console.warn('[Clock] weekly forecast unavailable',error?.message||error)}
    finally{busy=false;render();window.dispatchEvent(new CustomEvent('pacefold:week'))}
  }

  const baseInitialize=ctx.initialize;
  ctx.initialize=async()=>{
    const result=await baseInitialize();
    void refresh();
    setInterval(()=>{if(!document.hidden)void refresh()},10*60000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
    window.addEventListener(`pacefold:storage-changed`,event=>{if(event.detail?.key===ctx.KEYS.prefs)void refresh()});
    return result;
  };
  ctx.refreshWeek=refresh;
  ctx.weatherKit={KIND,LABEL,colour,weatherIcon,dayName};
  // Other surfaces (the dial's hourly ring, the sky) read the same cached forecast.
  ctx.weekForecast=()=>{const cached=read();return ctx.prefs.weatherEnabled&&sameSpot(cached)?cached.data:null};
}
