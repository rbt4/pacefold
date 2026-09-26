// Small pieces of ambient "magic": glass that catches light under the cursor, a
// root flag for waiting cues (the dial's aura responds), and the live weather
// mirrored into the sky (rain, snow, fog, storm). All presentation only.
const GLASS='.v28-guide,.action-dock,.daybook-fold,.calendar-card,.notebook-card,.metric-card,.timeline-card,.log-tools,.day-compare,.now-schedule,.now-cues,.now-weather,.now-active,.settings-panels>section,.settings-nav,.week-sky,.quick-action,.horizon-dock .clock-note-compose';
const KIND=code=>{const c=Number(code);if(!Number.isFinite(c))return'';if(c===0||c===1)return'clear';if(c===2||c===3)return'cloudy';if(c===45||c===48)return'fog';if((c>=51&&c<=67)||(c>=80&&c<=82))return'rain';if((c>=71&&c<=77)||c===85||c===86)return'snow';if(c>=95)return'storm';return'cloudy'};

export function installMagic(ctx){
  const root=document.documentElement;
  const calm=matchMedia('(prefers-reduced-motion: reduce)');

  let lit=null,frame=0;
  document.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse'||calm.matches)return;
    const target=event.target instanceof Element?event.target.closest(GLASS):null;
    if(lit&&lit!==target)lit.classList.remove('is-lit');
    lit=target;if(!target)return;
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const box=target.getBoundingClientRect();
      target.style.setProperty('--mx',`${event.clientX-box.left}px`);
      target.style.setProperty('--my',`${event.clientY-box.top}px`);
      target.classList.add('is-lit');
    });
  },{passive:true});
  document.addEventListener('pointerleave',()=>{lit?.classList.remove('is-lit');lit=null});

  const paintWeather=()=>{
    const forecast=ctx.weekForecast?.(),kind=KIND(forecast?.current?.weather_code??forecast?.daily?.weather_code?.[0]);
    if(kind)root.dataset.weather=kind;else delete root.dataset.weather;
  };
  paintWeather();
  window.addEventListener('pacefold:week',paintWeather);
  setInterval(paintWeather,10*60000);

  const baseRefresh=ctx.refreshCues;
  ctx.refreshCues=(...args)=>{const result=baseRefresh?.(...args);root.dataset.cueWaiting=String(Boolean(ctx.currentCues?.length));return result};
}
