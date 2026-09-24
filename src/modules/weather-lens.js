import{$,id,el,button}from'./state.js';

// The weather lens: hover (or focus) any day or any hour on the dial for a glass
// card with its hourly curve and details; click for the full sheet with a live
// radar scope, the next two hours of precipitation, air quality and an
// interactive hourly chart. Everything reads the forecast weather-week.js keeps;
// the radar (RainViewer) and air quality (Open-Meteo) are fetched only when the
// sheet opens. The map has no labels and the location is never named.
const SVG='http://www.w3.org/2000/svg';
const RADAR_INDEX='https://api.rainviewer.com/public/weather-maps.json';
const AIR_API='https://air-quality-api.open-meteo.com/v1/air-quality';
const AIR_STORE='pacefold.air.v1';
const ZOOM=7,TILE=256;
const s=(tag,attrs={})=>{const n=document.createElementNS(SVG,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n};
const range=(a,b)=>Array.from({length:Math.max(0,b-a)},(_,i)=>a+i);
const COMPASS=['N','NE','E','SE','S','SW','W','NW'];
const compass=deg=>COMPASS[Math.round(((Number(deg)%360)+360)%360/45)%8];
const uvLevel=v=>v<3?'Low':v<6?'Moderate':v<8?'High':v<11?'Very high':'Extreme';
const aqiLevel=v=>v<=50?['Good','good']:v<=100?['Moderate','fair']:v<=150?['Sensitive groups','poor']:v<=200?['Unhealthy','bad']:v<=300?['Very unhealthy','bad']:['Hazardous','bad'];
let gradientSeq=0;

export function installWeatherLens(ctx){
  const kit=()=>ctx.weatherKit;
  const data=()=>ctx.weekForecast?.();
  const twelve=()=>ctx.prefs.timeFormat!=='24';
  const localStamp=(date=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:ctx.prefs.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date).replace(' ','T');
  const clockText=stamp=>{const t=String(stamp||''),h=Number(t.slice(11,13)),m=Number(t.slice(14,16));if(!Number.isFinite(h))return'';return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',hour12:twelve(),timeZone:'UTC'}).format(new Date(Date.UTC(2000,0,1,h,m)))};
  const hourText=(h,compact=false)=>{if(!twelve())return`${String(h).padStart(2,'0')}:00`;if(compact&&h===12)return'Noon';if(compact&&h===0)return'12 AM';const p=h<12?'AM':'PM',v=h%12||12;return`${v} ${p}`};
  const nowIndex=d=>{const key=localStamp().slice(0,13),i=d?.hourly?.time?.findIndex(t=>String(t).slice(0,13)===key);return i>=0?i:-1};
  const dayRange=(d,i)=>{const day=d.daily.time[i],idx=d.hourly.time.map((t,k)=>String(t).startsWith(day)?k:-1).filter(k=>k>=0);return idx.length?[idx[0],idx.at(-1)+1]:[0,0]};
  const isNight=(d,stamp)=>{const day=String(stamp).slice(0,10),di=d.daily.time.indexOf(day);if(di<0)return false;const rise=d.daily.sunrise?.[di],set=d.daily.sunset?.[di];if(!rise||!set)return false;return stamp<rise||stamp>=set};

  // Next two hours of precipitation from the 15-minute nowcast.
  const nowcast=d=>{
    const m=d?.minutely_15;if(!m?.time?.length)return null;
    const key=localStamp(),start=Math.max(0,m.time.findIndex(t=>t>=key.slice(0,16))-1);
    const slots=m.time.slice(start,start+8).map((t,i)=>({t,mm:Number(m.precipitation?.[start+i])||0}));
    if(!slots.length)return null;
    const cold=Number(d.current?.temperature_2m)<=0,word=cold?'Snow':'Rain';
    const wet=slots.map(x=>x.mm>=.1),minutes=i=>Math.max(15,i*15);
    let text;
    if(!wet.some(Boolean))text='No precipitation for the next 2 hours';
    else if(wet[0]){const stop=wet.indexOf(false);text=stop<0?`${word} continuing for the next 2 hours`:`${word} easing in about ${minutes(stop)} min`}
    else text=`${word} starting in about ${minutes(wet.indexOf(true))} min`;
    return{text,slots,wet:wet.some(Boolean),word};
  };
  ctx.weatherNowcast=()=>nowcast(data());

  // ---- Hourly chart ------------------------------------------------------------
  function chart(d,start,end,{width=320,height=112,axis=true,interactive=false,readout=null}={}){
    const H=d.hourly,idx=range(start,end).filter(i=>Number.isFinite(Number(H.temperature_2m?.[i])));
    const svg=s('svg',{viewBox:`0 0 ${width} ${height}`,class:'wx-chart',role:'img','aria-label':'Hourly temperature and chance of precipitation'});
    if(idx.length<2)return svg;
    const temps=idx.map(i=>Number(H.temperature_2m[i])),lo=Math.min(...temps),hi=Math.max(...temps),span=Math.max(3,hi-lo);
    const padL=6,padR=6,top=axis?20:12,rainH=axis?22:16,bottom=height-(axis?18:4),plotB=bottom-rainH-6;
    const x=k=>padL+(k/(idx.length-1))*(width-padL-padR),y=t=>top+(1-(t-lo)/span)*(plotB-top);
    // Night hours are shaded so the curve reads against the sun.
    const w=(width-padL-padR)/(idx.length-1);let run=-1;
    idx.forEach((i,k)=>{const night=isNight(d,H.time[i]);if(night&&run<0)run=k;if(run>=0&&(!night||k===idx.length-1)){const endK=night?k:k-1,x0=Math.max(0,x(run)-w/2),x1=Math.min(width,x(endK)+w/2);svg.append(s('rect',{x:x0.toFixed(1),y:0,width:(x1-x0).toFixed(1),height:bottom,rx:6,class:'wx-night'}));run=-1}});
    const gid=`wxg${gradientSeq+=1}`,grad=s('linearGradient',{id:gid,x1:padL,x2:width-padR,y1:0,y2:0,gradientUnits:'userSpaceOnUse'});
    temps.forEach((t,k)=>{const stop=s('stop',{offset:(k/(temps.length-1)).toFixed(3)});stop.setAttribute('stop-color',kit().colour(t));grad.append(stop)});
    const fade=s('linearGradient',{id:`${gid}f`,x1:0,x2:0,y1:0,y2:1});fade.append(s('stop',{offset:0,'stop-color':'#fff','stop-opacity':.9}),s('stop',{offset:1,'stop-color':'#fff','stop-opacity':0}));
    const mask=s('mask',{id:`${gid}m`});mask.append(s('rect',{x:0,y:0,width,height:plotB,fill:`url(#${gid}f)`}));
    const defs=s('defs');defs.append(grad,fade,mask);svg.append(defs);
    // Smooth curve (Catmull-Rom as cubic Béziers).
    const P=temps.map((t,k)=>[x(k),y(t)]);let line=`M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
    for(let k=0;k<P.length-1;k+=1){const p0=P[k-1]||P[k],p1=P[k],p2=P[k+1],p3=P[k+2]||p2;line+=` C${(p1[0]+(p2[0]-p0[0])/6).toFixed(1)} ${(p1[1]+(p2[1]-p0[1])/6).toFixed(1)} ${(p2[0]-(p3[0]-p1[0])/6).toFixed(1)} ${(p2[1]-(p3[1]-p1[1])/6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`}
    svg.append(s('path',{d:`${line} L${P.at(-1)[0].toFixed(1)} ${plotB} L${P[0][0].toFixed(1)} ${plotB}Z`,fill:`url(#${gid})`,mask:`url(#${gid}m)`,class:'wx-area'}));
    svg.append(s('path',{d:line,stroke:`url(#${gid})`,class:'wx-line'}));
    // Chance of precipitation as soft bars under the curve.
    const barW=Math.max(2,(width-padL-padR)/idx.length-2);
    idx.forEach((i,k)=>{const pop=Number(H.precipitation_probability?.[i])||0;if(pop<5)return;const bh=Math.max(2,pop/100*rainH);svg.append(s('rect',{x:(x(k)-barW/2).toFixed(1),y:(bottom-bh).toFixed(1),width:barW.toFixed(1),height:bh.toFixed(1),rx:1.5,class:'wx-pop-bar','fill-opacity':(.25+pop/140).toFixed(2)}))});
    // Highest and lowest points are labelled; a marker shows now when it is in range.
    const mark=(k,cls)=>{const[px,py]=P[k];svg.append(s('circle',{cx:px.toFixed(1),cy:py.toFixed(1),r:3,class:`wx-dot ${cls}`}));const t=s('text',{x:Math.min(width-14,Math.max(14,px)).toFixed(1),y:(cls==='hi'?py-8:py+15).toFixed(1),'text-anchor':'middle',class:'wx-temp-label'});t.textContent=`${Math.round(temps[k])}°`;svg.append(t)};
    const kHi=temps.indexOf(hi),kLo=temps.indexOf(lo);mark(kHi,'hi');if(kLo!==kHi)mark(kLo,'lo');
    const current=nowIndex(d),kNow=idx.indexOf(current);
    if(kNow>=0){const[px,py]=P[kNow];svg.append(s('line',{x1:px.toFixed(1),x2:px.toFixed(1),y1:top-10,y2:bottom,class:'wx-now-line'}),s('circle',{cx:px.toFixed(1),cy:py.toFixed(1),r:4.5,class:'wx-now-dot'}))}
    if(axis){const step=idx.length>30?6:3;idx.forEach((i,k)=>{const h=Number(String(H.time[i]).slice(11,13));if(h%step||k===0&&idx.length>30)return;const t=s('text',{x:x(k).toFixed(1),y:height-4,'text-anchor':'middle',class:'wx-axis'});t.textContent=h===0?new Intl.DateTimeFormat(undefined,{weekday:'short',timeZone:'UTC'}).format(new Date(`${String(H.time[i]).slice(0,10)}T12:00:00Z`)):twelve()?(h===12?'Noon':`${h%12||12}${h<12?'a':'p'}`):String(h).padStart(2,'0');svg.append(t)})}
    if(interactive){
      const cross=s('line',{y1:top-10,y2:bottom,class:'wx-cross'}),dot=s('circle',{r:5,class:'wx-cross-dot'}),hit=s('rect',{x:0,y:0,width,height,class:'wx-hit'});
      cross.style.opacity='0';dot.style.opacity='0';svg.append(cross,dot,hit);
      const show=k=>{const i=idx[k],[px,py]=P[k];cross.setAttribute('x1',px.toFixed(1));cross.setAttribute('x2',px.toFixed(1));dot.setAttribute('cx',px.toFixed(1));dot.setAttribute('cy',py.toFixed(1));cross.style.opacity='1';dot.style.opacity='1';readout?.(hourDetail(d,i))};
      hit.addEventListener('pointermove',event=>{const box=svg.getBoundingClientRect(),vx=(event.clientX-box.left)/box.width*width,k=Math.round((vx-padL)/((width-padL-padR)/(idx.length-1)));show(Math.max(0,Math.min(idx.length-1,k)))});
      hit.addEventListener('pointerleave',()=>{cross.style.opacity='0';dot.style.opacity='0';readout?.(null)});
    }
    return svg;
  }

  const hourDetail=(d,i)=>{
    const H=d.hourly,stamp=String(H.time[i]),h=Number(stamp.slice(11,13)),t=Number(H.temperature_2m[i]),feels=Number(H.apparent_temperature?.[i]);
    const pop=Math.round(Number(H.precipitation_probability?.[i])||0),kind=kit().KIND(H.weather_code?.[i]??d.daily.weather_code[0]),wind=Number(H.wind_speed_10m?.[i]);
    const di=d.daily.time.indexOf(stamp.slice(0,10));
    return{title:`${di>0?`${kit().dayName(d.daily.time[di],di,'short')} `:''}${hourText(h)}`,kind,temp:Math.round(t),parts:[kit().LABEL[kind],Number.isFinite(feels)?`Feels ${Math.round(feels)}°`:'',`${pop}% precip`,Number.isFinite(wind)?`${Math.round(wind)} km/h`:''].filter(Boolean)};
  };

  const windArrow=deg=>{const svg=s('svg',{viewBox:'0 0 16 16',class:'wx-wind','aria-hidden':'true'});const g=s('g');g.append(s('path',{d:'M8 2v11M4.5 9.5 8 13l3.5-3.5'}));g.style.transform=`rotate(${Number(deg)%360}deg)`;g.style.transformOrigin='8px 8px';svg.append(g);return svg};
  const stat=(label,value,extra)=>{const n=el('div','wx-stat');const v=el('strong','',value);if(extra)v.prepend(extra);n.append(el('small','',label),v);return n};

  // ---- Hover card --------------------------------------------------------------
  const pop=el('div','wx-pop');pop.id='wx-pop';pop.setAttribute('role','tooltip');pop.hidden=true;document.body.append(pop);
  let hideTimer=0,popFor=null;
  const place=(anchor,point)=>{
    pop.hidden=false;pop.classList.remove('is-on');
    const r=anchor.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight,gap=14,vw=innerWidth,vh=innerHeight;
    let left,top;
    if(point){left=point.x+18;top=point.y-h/2;if(left+w>vw-12)left=point.x-18-w}
    else if(r.right+gap+w<=vw-12&&r.width<vw*.4){left=r.right+gap;top=r.top+r.height/2-h/2}
    else{left=r.left+r.width/2-w/2;top=r.top-gap-h;if(top<12)top=r.bottom+gap}
    pop.style.left=`${Math.round(Math.max(12,Math.min(vw-w-12,left)))}px`;pop.style.top=`${Math.round(Math.max(12,Math.min(vh-h-12,top)))}px`;
    requestAnimationFrame(()=>pop.classList.add('is-on'));
  };
  const hide=()=>{clearTimeout(hideTimer);hideTimer=setTimeout(()=>{pop.classList.remove('is-on');popFor=null;setTimeout(()=>{if(!popFor)pop.hidden=true},180)},90)};
  const dayCard=(d,i)=>{
    const K=kit(),D=d.daily,kind=K.KIND(D.weather_code[i]),[a,b]=dayRange(d,i);
    const head=el('header','wx-pop-head'),title=el('span');title.append(el('small','',K.dayName(D.time[i],i)),el('strong','',K.LABEL[kind]));
    const temps=el('span','wx-pop-temps');temps.append(el('strong','',`${Math.round(D.temperature_2m_max[i])}°`),el('small','',`${Math.round(D.temperature_2m_min[i])}°`));
    head.append(K.weatherIcon(kind),title,temps);
    const stats=el('div','wx-pop-stats'),popv=Math.round(Number(D.precipitation_probability_max?.[i])||0),sum=Number(D.precipitation_sum?.[i])||0,uv=Number(D.uv_index_max?.[i]),wind=Number(D.wind_speed_10m_max?.[i]);
    stats.append(stat('Precip',`${popv}%${sum>=.1?` · ${sum.toFixed(1)} mm`:''}`));
    if(Number.isFinite(wind))stats.append(stat('Wind',`${Math.round(wind)} km/h ${D.wind_direction_10m_dominant?.[i]!=null?compass(D.wind_direction_10m_dominant[i]):''}`.trim(),D.wind_direction_10m_dominant?.[i]!=null?windArrow(D.wind_direction_10m_dominant[i]):null));
    if(Number.isFinite(uv))stats.append(stat('UV',`${Math.round(uv)} · ${uvLevel(uv)}`));
    if(D.sunrise?.[i])stats.append(stat('Daylight',`${clockText(D.sunrise[i])} – ${clockText(D.sunset[i])}`));
    const frag=[head];if(b-a>=2)frag.push(chart(d,a,b,{width:300,height:96,axis:true}));frag.push(stats,el('p','wx-pop-hint','Click for radar and hourly'));
    return frag;
  };
  const hourCard=(d,i)=>{const x=hourDetail(d,i),head=el('header','wx-pop-head wx-pop-hour'),title=el('span');title.append(el('small','',x.title),el('strong','',x.parts[0]));const t=el('span','wx-pop-temps');t.append(el('strong','',`${x.temp}°`));head.append(kit().weatherIcon(x.kind),title,t);return[head,el('p','wx-pop-line',x.parts.slice(1).join(' · '))]};
  // Other surfaces (the dial's sun, moments and workday) register their own cards.
  ctx.lensProviders=ctx.lensProviders||{};
  ctx.lensCard=({icon=null,kicker='',title='',value='',lines=[]})=>{
    const head=el('header','wx-pop-head wx-pop-hour'),copy=el('span');copy.append(el('small','',kicker),el('strong','',title));
    const tail=el('span','wx-pop-temps');if(value)tail.append(el('strong','',value));
    head.append(icon||el('i','lens-dot'),copy,tail);
    return[head,...lines.filter(Boolean).map(line=>el('p','wx-pop-line',line))];
  };
  const showFor=(target,event)=>{
    if(target.dataset.lens){
      const nodes=ctx.lensProviders[target.dataset.lens]?.(target);if(!nodes)return;
      clearTimeout(hideTimer);
      const key=`l${target.dataset.lens}${target.dataset.key||''}`;
      if(popFor!==key){pop.replaceChildren(...nodes);pop.dataset.kind='hour';popFor=key}
      place(target,event&&event.type!=='focusin'?{x:event.clientX,y:event.clientY}:null);return;
    }
    const d=data();if(!d?.daily?.time?.length||!kit())return;
    clearTimeout(hideTimer);
    const hour=target.dataset.hourIndex!==undefined;
    const key=hour?`h${target.dataset.hourIndex}`:`d${target.dataset.index}`;
    if(popFor!==key){pop.replaceChildren(...(hour?hourCard(d,Number(target.dataset.hourIndex)):dayCard(d,Number(target.dataset.index))));pop.dataset.kind=hour?'hour':'day';popFor=key}
    place(target,hour&&event?{x:event.clientX,y:event.clientY}:null);
  };
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  const LENS='.week-day[data-index],.cw-day[data-index],.temp-seg[data-hour-index],[data-lens]';
  document.addEventListener('pointerover',event=>{if(!fine.matches)return;const t=event.target instanceof Element?event.target.closest(LENS):null;if(t)showFor(t,event)});
  document.addEventListener('pointermove',event=>{if(!fine.matches||pop.hidden)return;const t=event.target instanceof Element?event.target.closest('.temp-seg[data-hour-index]'):null;if(t)showFor(t,event)},{passive:true});
  document.addEventListener('pointerout',event=>{const t=event.target instanceof Element?event.target.closest(LENS):null;if(t&&!t.contains(event.relatedTarget))hide()});
  document.addEventListener('focusin',event=>{const t=event.target instanceof Element?event.target.closest('.week-day[data-index],.cw-day[data-index],[data-lens]'):null;if(t)showFor(t,event)});
  document.addEventListener('focusout',event=>{if(event.target instanceof Element&&event.target.closest(LENS))hide()});

  // ---- Sheet -------------------------------------------------------------------
  const sheet=el('div','wx-sheet');sheet.id='weather-sheet';sheet.hidden=true;sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','Weather');
  const scrim=el('div','wx-scrim'),panel=el('div','wx-panel'),close=button('wx-close','Close weather','×');
  sheet.append(scrim,panel);document.body.append(sheet);
  let lastFocus=null,selected='next',radarTimer=0,radarGeneration=0;

  function renderSheet(){
    const d=data(),K=kit();panel.replaceChildren(close);
    if(!d?.daily?.time?.length||!K){panel.append(el('p','wx-empty',ctx.prefs.weatherEnabled?'The forecast is still on its way.':'Weather is off. Turn it on in Settings → Daily.'));return}
    const D=d.daily,C=d.current||{},kind=K.KIND(C.weather_code??D.weather_code[0]);
    // Now
    const now=el('section','wx-now');
    const big=el('div','wx-now-main');big.append(K.weatherIcon(kind));
    const tt=el('div');tt.append(el('strong','wx-now-temp',`${Math.round(C.temperature_2m??D.temperature_2m_max[0])}°`),el('span','wx-now-label',K.LABEL[kind]),el('small','wx-now-range',`${Number.isFinite(C.apparent_temperature)?`Feels ${Math.round(C.apparent_temperature)}° · `:''}H ${Math.round(D.temperature_2m_max[0])}°  L ${Math.round(D.temperature_2m_min[0])}°`));
    big.append(tt);now.append(big);
    const cast=nowcast(d);
    if(cast){const box=el('div','wx-cast');box.dataset.wet=String(cast.wet);const bars=el('div','wx-cast-bars');for(const slot of cast.slots){const b=el('i');b.style.setProperty('--mm',Math.min(1,slot.mm/2.5).toFixed(3));bars.append(b)}const scale=el('div','wx-cast-scale');scale.append(el('span','','Now'),el('span','','1 h'),el('span','','2 h'));box.append(el('strong','',cast.text),bars,scale);now.append(box)}
    const stats=el('div','wx-stats');
    if(Number.isFinite(C.relative_humidity_2m))stats.append(stat('Humidity',`${Math.round(C.relative_humidity_2m)}%`));
    if(Number.isFinite(C.wind_speed_10m))stats.append(stat('Wind',`${Math.round(C.wind_speed_10m)} km/h ${compass(C.wind_direction_10m)}`,windArrow(C.wind_direction_10m)));
    if(Number.isFinite(Number(D.uv_index_max?.[0])))stats.append(stat('UV today',`${Math.round(D.uv_index_max[0])} · ${uvLevel(D.uv_index_max[0])}`));
    const air=stat('Air quality','—');air.id='wx-air';stats.append(air);
    if(D.sunrise?.[0])stats.append(stat('Sunrise',clockText(D.sunrise[0])),stat('Sunset',clockText(D.sunset[0])));
    now.append(stats);
    // Radar
    const radar=el('section','wx-radar');radar.id='wx-radar';
    // Hourly with day tabs
    const hourly=el('section','wx-hourly'),tabs=el('div','wx-tabs');tabs.setAttribute('role','tablist');
    const readout=el('p','wx-readout','');
    const plot=el('div','wx-plot');
    const draw=()=>{
      let a,b;const ni=nowIndex(d);
      if(selected==='next'){a=Math.max(0,ni<0?0:ni);b=Math.min(d.hourly.time.length,a+25)}else[a,b]=dayRange(d,Number(selected));
      plot.replaceChildren(chart(d,a,b,{width:1000,height:170,interactive:true,readout:x=>{readout.replaceChildren();if(!x){readout.textContent='Move across the chart for each hour';return}readout.append(el('strong','',`${x.title} · ${x.temp}°`),el('span','',x.parts.join(' · ')))}}));
      readout.textContent='Move across the chart for each hour';
      for(const tab of tabs.children)tab.setAttribute('aria-selected',String(tab.dataset.key===String(selected)));
    };
    const tab=(key,label,sub)=>{const t=button('wx-tab',label);t.setAttribute('role','tab');t.dataset.key=key;t.append(el('b','',label));if(sub)t.append(sub);t.addEventListener('click',()=>{selected=key;draw()});tabs.append(t)};
    tab('next','Next 24 h');
    D.time.slice(0,7).forEach((day,i)=>{const sub=el('span','wx-tab-sub');sub.append(K.weatherIcon(K.KIND(D.weather_code[i])),el('small','',`${Math.round(D.temperature_2m_max[i])}° ${Math.round(D.temperature_2m_min[i])}°`));tab(String(i),i===0?'Today':K.dayName(day,i,'short'),sub)});
    hourly.append(tabs,plot,readout);
    panel.append(now,radar,hourly,el('p','wx-credit','Forecast Open-Meteo · Radar RainViewer · Map © OpenStreetMap, © CARTO'));
    draw();buildRadar(radar);void loadAir();
  }

  // ---- Radar scope -------------------------------------------------------------
  function buildRadar(host){
    clearInterval(radarTimer);
    const generation=radarGeneration+=1,stale=()=>generation!==radarGeneration||!host.isConnected;
    const lat=Number(ctx.prefs.lat),lng=Number(ctx.prefs.lng);
    const scope=el('div','radar-scope'),map=el('div','radar-map'),frames=el('div','radar-frames');
    const n=2**ZOOM,fx=(lng+180)/360*n,rad=lat*Math.PI/180,fy=(1-Math.log(Math.tan(rad)+1/Math.cos(rad))/Math.PI)/2*n,tx=Math.floor(fx),ty=Math.floor(fy);
    // A 3×3 block of tiles, shifted so the location sits exactly at the centre.
    const shift=layer=>{layer.style.left=`calc(50% - ${Math.round((fx-tx+1)*TILE)}px)`;layer.style.top=`calc(50% - ${Math.round((fy-ty+1)*TILE)}px)`};
    const tiles=(layer,url)=>{for(let dy=-1;dy<=1;dy+=1)for(let dx=-1;dx<=1;dx+=1){const img=el('img');img.alt='';img.decoding='async';img.referrerPolicy='no-referrer';img.draggable=false;img.src=url(tx+dx,ty+dy);img.style.left=`${(dx+1)*TILE}px`;img.style.top=`${(dy+1)*TILE}px`;img.addEventListener('error',()=>img.classList.add('is-missing'));layer.append(img)}};
    shift(map);shift(frames);
    tiles(map,(x,y)=>`https://a.basemaps.cartocdn.com/dark_nolabels/${ZOOM}/${x}/${y}.png`);
    const rings=el('div','radar-rings'),sweep=el('div','radar-sweep'),you=el('i','radar-you'),north=el('b','radar-north','N');
    scope.append(map,frames,rings,sweep,you,north);
    const bar=el('div','radar-bar'),play=button('radar-play','Pause radar'),when=el('span','radar-when','Radar'),scrub=el('input','radar-scrub');
    scrub.type='range';scrub.min='0';scrub.max='0';scrub.value='0';scrub.setAttribute('aria-label','Radar time');scrub.disabled=true;
    const legend=el('div','radar-legend');legend.append(el('small','','Light'),el('i'),el('small','','Heavy'));
    bar.append(play,scrub,when);
    const head=el('header','wx-radar-head');head.append(el('strong','','Radar'),el('small','','Past 2 hours · 270 km across'));
    host.replaceChildren(head,scope,bar,legend);
    play.dataset.state='play';
    void(async()=>{
      try{
        const response=await fetch(RADAR_INDEX,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
        if(stale())return;
        if(!response.ok)throw new Error(`Radar ${response.status}`);
        const index=await response.json();
        // The sheet may have closed (or re-rendered) while the index was loading.
        if(stale())return;
        const list=[...(index?.radar?.past||[]).slice(-10),...(index?.radar?.nowcast||[])];
        if(!list.length||!index.host)throw new Error('Radar empty');
        const past=Math.min(10,(index.radar.past||[]).length),layers=list.map(frame=>{const layer=el('div','radar-frame');tiles(layer,(x,y)=>`${index.host}${frame.path}/${TILE}/${ZOOM}/${x}/${y}/2/1_1.png`);frames.append(layer);return layer});
        let at=past-1,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
        scrub.max=String(list.length-1);scrub.disabled=false;
        const label=i=>{const mins=Math.round((list[i].time*1000-Date.now())/60000);return Math.abs(mins)<6?'Now':mins<0?`${-mins} min ago`:`in ${mins} min`};
        const show=i=>{at=i;layers.forEach((layer,k)=>layer.classList.toggle('is-on',k===i));scrub.value=String(i);when.textContent=label(i);scope.dataset.future=String(i>=past)};
        show(at);
        let hold=0;
        const step=()=>{if(!playing)return;if(hold>0){hold-=1;return}const next=(at+1)%list.length;show(next);if(next===past-1)hold=3};
        radarTimer=setInterval(step,550);
        const sync=()=>{play.dataset.state=playing?'pause':'play';play.setAttribute('aria-label',playing?'Pause radar':'Play radar')};sync();
        play.addEventListener('click',()=>{playing=!playing;sync()});
        scrub.addEventListener('input',()=>{playing=false;sync();show(Number(scrub.value))});
        scope.dataset.state='live';
      }catch(error){if(stale())return;scope.dataset.state='offline';when.textContent=navigator.onLine?'Radar unavailable':'Offline';console.warn('[Clock] radar unavailable',error?.message||error)}
    })();
  }

  async function loadAir(){
    const node=id('wx-air');if(!node)return;
    const fill=v=>{if(!Number.isFinite(v))return;const[label,tone]=aqiLevel(v);const strong=node.querySelector('strong');strong.textContent=`${Math.round(v)} · ${label}`;node.dataset.tone=tone};
    let cached=null;try{cached=JSON.parse(localStorage.getItem(AIR_STORE)||'null')}catch{}
    if(cached&&Date.now()-cached.savedAt<30*60000&&Math.abs(cached.lat-ctx.prefs.lat)<.01&&Math.abs(cached.lng-ctx.prefs.lng)<.01){fill(cached.aqi);return}
    try{
      const query=new URLSearchParams({latitude:String(ctx.prefs.lat),longitude:String(ctx.prefs.lng),current:'us_aqi,pm2_5',timezone:ctx.prefs.timeZone});
      const response=await fetch(`${AIR_API}?${query}`,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});if(!response.ok)return;
      const aqi=Number((await response.json())?.current?.us_aqi);fill(aqi);
      try{localStorage.setItem(AIR_STORE,JSON.stringify({savedAt:Date.now(),lat:ctx.prefs.lat,lng:ctx.prefs.lng,aqi}))}catch{}
    }catch{}
  }

  const open=(key='next')=>{
    selected=key;lastFocus=document.activeElement;hide();
    renderSheet();sheet.hidden=false;document.documentElement.dataset.weatherSheet='open';
    requestAnimationFrame(()=>{sheet.classList.add('is-on');close.focus({preventScroll:true})});
  };
  const shut=()=>{
    if(sheet.hidden)return;clearInterval(radarTimer);radarGeneration+=1;sheet.classList.remove('is-on');delete document.documentElement.dataset.weatherSheet;
    setTimeout(()=>{if(!sheet.classList.contains('is-on')){sheet.hidden=true;panel.replaceChildren()}},260);
    if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
  };
  ctx.openWeather=open;ctx.closeWeather=shut;
  close.addEventListener('click',shut);scrim.addEventListener('click',shut);
  sheet.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();shut();return}
    if(event.key==='Tab'){const f=[...panel.querySelectorAll('button,input,[tabindex="0"]')].filter(n=>!n.disabled&&n.offsetParent);if(!f.length)return;if(event.shiftKey&&document.activeElement===f[0]){event.preventDefault();f.at(-1).focus()}else if(!event.shiftKey&&document.activeElement===f.at(-1)){event.preventDefault();f[0].focus()}}
  });
  // Arrow keys fold the app; inside the sheet they belong to the sheet.
  sheet.addEventListener('keydown',event=>{if(event.key.startsWith('Arrow'))event.stopPropagation()});

  document.addEventListener('click',event=>{
    const t=event.target instanceof Element?event.target:null;if(!t||!ctx.prefs.weatherEnabled)return;
    const day=t.closest('.week-day[data-index],.cw-day[data-index]');
    if(day){open(day.dataset.index==='0'?'next':day.dataset.index);return}
    if(t.closest('.temp-seg[data-hour-index],.wx-open'))open('next');
  });
  document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target instanceof Element&&event.target.matches('.week-day[data-index]')){event.preventDefault();open(event.target.dataset.index==='0'?'next':event.target.dataset.index)}});

  // The Clock week panel gains a radar entry and a live nowcast line.
  const decorate=()=>{
    const head=$('#week-sky>header');if(!head)return;
    if(!head.querySelector('.wx-open')){const b=button('wx-open','Open radar and hourly weather');const icon=s('svg',{viewBox:'0 0 20 20','aria-hidden':'true'});icon.append(s('circle',{cx:10,cy:10,r:7.5}),s('circle',{cx:10,cy:10,r:3.5}),s('path',{d:'M10 10 15.3 4.7'}));b.append(icon,el('span','','Radar'));head.append(b)}
    let line=$('#week-sky .week-nowcast');const cast=ctx.prefs.weatherEnabled?nowcast(data()):null;
    if(!cast?.wet){line?.remove();return}
    if(!line){line=el('p','week-nowcast');head.after(line)}
    line.textContent=cast.text;
  };
  decorate();
  window.addEventListener('pacefold:week',()=>{decorate();if(!sheet.hidden)renderSheet()});
  setInterval(decorate,5*60000);
}
