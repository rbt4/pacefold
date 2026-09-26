import{id,el}from'./state.js';

// The living sky behind every screen: the daily photograph, colour-graded by the
// real position of the sun (sunrise/sunset from the forecast, or solar maths from
// the configured coordinates), with a horizon glow and stars after dusk.
const STOPS=[
  // elevation, top, middle, horizon, glow rgba, stars, shade
  [-1.00,[5,11,26],[11,26,51],[26,42,72],[120,150,220,.16],.95,.62],
  [-0.35,[13,26,56],[38,56,106],[106,90,134],[205,140,170,.32],.45,.48],
  [0.00,[29,53,99],[107,111,158],[240,160,112],[255,170,100,.62],0,.34],
  [0.25,[47,93,152],[127,166,207],[246,199,154],[255,210,150,.42],0,.24],
  [1.00,[42,111,184],[93,154,214],[169,205,234],[255,245,220,.30],0,.18],
];
const mix=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
const rgb=c=>`rgb(${c.slice(0,3).map(Math.round).join(',')})`;

export function installSky(ctx){
  if(id('sky'))return;
  const sky=el('div','sky');sky.id='sky';sky.setAttribute('aria-hidden','true');
  const stars=el('div','sky-stars');
  const field=[];for(let i=0;i<140;i+=1){const x=(Math.sin(i*12.9898)*43758.5453%1+1)%1,y=(Math.sin(i*78.233)*12345.678%1+1)%1,a=.25+((i*37)%70)/100;field.push(`${(x*100).toFixed(2)}vw ${(y*62).toFixed(2)}vh 0 ${i%9===0?1:0}px rgba(255,255,255,${a.toFixed(2)})`)}
  stars.style.boxShadow=field.join(',');
  sky.append(el('div','sky-photo'),el('div','sky-grade'),el('div','sky-glow'),el('div','sky-rays'),el('div','sky-aurora'),stars,el('div','sky-shade'));
  document.body.prepend(sky);

  const root=document.documentElement;
  ctx.skyState=()=>{
    const now=new Date(),part=ctx.zoneParts(now,ctx.prefs.timeZone),hour=part.hour+part.minute/60+part.second/3600;
    const forecast=ctx.weekForecast?.(),daily=forecast?.daily;
    let sunrise,sunset;
    const clock=value=>{const text=String(value||'');return Number(text.slice(11,13))+Number(text.slice(14,16))/60};
    if(daily?.sunrise?.[0]&&daily?.sunset?.[0]){sunrise=clock(daily.sunrise[0]);sunset=clock(daily.sunset[0])}
    else{const sun=ctx.sunHours(now,ctx.prefs);sunrise=sun.sunrise;sunset=sun.sunset}
    const day=hour>=sunrise&&hour<=sunset,progress=Math.min(1,Math.max(0,(hour-sunrise)/Math.max(.1,sunset-sunrise)));
    let elevation;
    if(day)elevation=Math.sin(Math.PI*progress);
    else{const gap=hour<sunrise?sunrise-hour:hour-sunset;elevation=-Math.min(1,gap/2.2)}
    return{hour,sunrise,sunset,day,progress,elevation};
  };

  const paint=()=>{
    // A night-sky preview (atmosphere.js) holds the sky until it ends.
    if(root.dataset.skyPreview)return;
    const state=ctx.skyState(),e=state.elevation;
    let i=0;while(i<STOPS.length-2&&e>STOPS[i+1][0])i+=1;
    const[a,b]=[STOPS[i],STOPS[i+1]],k=Math.min(1,Math.max(0,(e-a[0])/(b[0]-a[0])));
    const top=mix(a[1],b[1],k),middle=mix(a[2],b[2],k),low=mix(a[3],b[3],k),glow=mix(a[4],b[4],k);
    root.style.setProperty('--sky-top',rgb(top));
    root.style.setProperty('--sky-mid',rgb(middle));
    root.style.setProperty('--sky-low',rgb(low));
    root.style.setProperty('--sky-glow',`rgba(${glow.slice(0,3).map(Math.round).join(',')},${glow[3].toFixed(3)})`);
    root.style.setProperty('--sky-stars',(a[5]+(b[5]-a[5])*k).toFixed(3));
    root.style.setProperty('--sky-shade',(a[6]+(b[6]-a[6])*k).toFixed(3));
    // The glow travels across the horizon with the sun; at night it rests where the moon would be.
    const across=state.day?state.progress:((state.hour-state.sunset+24)%24)/Math.max(1,24-(state.sunset-state.sunrise));
    root.style.setProperty('--sun-x',`${(8+84*across).toFixed(2)}%`);
    root.dataset.sky=state.day?(e>.35?'day':'golden'):(e>-.4?'twilight':'night');
  };
  paint();setInterval(paint,60000);
  window.addEventListener('pacefold:week',paint);
  ctx.paintSky=paint;
}
