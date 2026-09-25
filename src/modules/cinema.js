import{id,el}from'./state.js';

// Cinema: the moments between moments.
// - Folds move as one space: the old view leaves the way you came while the new one
//   arrives from where it lives (View Transitions, with a graceful fallback).
// - The start page greets you and gives the day in one line: weather now, rain
//   coming, and the next moment (neutral wording; hidden when the rhythm is hidden).
// - Minutes turn over: the changed digits roll in rather than blinking.
const DIR={notes:'up',worklog:'left',now:'right',settings:'down'};
const BACK={up:'down',down:'up',left:'right',right:'left'};

export function installCinema(ctx){
  const root=document.documentElement,calm=matchMedia('(prefers-reduced-motion: reduce)');

  // ---- Fold transitions ---------------------------------------------------------
  // The new fold already enters from where it lives (CSS). Here the old fold is kept
  // on its own layer for half a second and leaves the opposite way, so the move reads
  // as one space. The state changes at once: nothing waits on a snapshot.
  const baseGo=ctx.go;
  ctx.go=(target,options={})=>{
    const from=ctx.mode||'home',old=document.querySelector(`.view-${from}`);
    const result=baseGo(target,options),to=ctx.mode||'home';
    if(calm.matches||to===from||!old||root.dataset.cover==='on')return result;
    const dir=to==='home'?BACK[DIR[from]]:DIR[to];if(!dir)return result;
    for(const view of document.querySelectorAll('.view.is-leaving'))view.classList.remove('is-leaving','leave-left','leave-right','leave-up','leave-down');
    // Leaving to the left means the new fold came from the right, and so on.
    old.classList.add('is-leaving',`leave-${BACK[dir]}`);
    setTimeout(()=>old.classList.remove('is-leaving',`leave-${BACK[dir]}`),560);
    return result;
  };

  // ---- Start page: greeting and the day in one line -----------------------------
  const clock=document.querySelector('.cover-clock'),date=id('cover-date');
  if(clock&&date&&!id('cover-brief')){
    const greeting=el('p','cover-greeting','');greeting.id='cover-greeting';
    const brief=el('p','cover-brief','');brief.id='cover-brief';
    clock.prepend(greeting);date.after(brief);
    const paint=()=>{
      const now=new Date(),hour=Number(new Intl.DateTimeFormat('en-CA',{timeZone:ctx.prefs.timeZone,hour:'2-digit',hourCycle:'h23'}).format(now));
      greeting.textContent=hour<5?'Still night':hour<12?'Good morning':hour<17?'Good afternoon':hour<22?'Good evening':'Good night';
      const parts=[],forecast=ctx.weekForecast?.(),kit=ctx.weatherKit;
      if(forecast?.current&&kit){const kind=kit.KIND(forecast.current.weather_code);parts.push(`${Math.round(forecast.current.temperature_2m)}° ${kit.LABEL[kind].toLowerCase()}`)}
      const cast=ctx.weatherNowcast?.();if(cast?.wet)parts.push(cast.text.replace(/^(Rain|Snow) /,(m,w)=>`${w.toLowerCase()} `));
      if(ctx.rhythmMode?.()!=='hidden'){const next=ctx.getSchedule?.(now)?.next;if(next)parts.push(`next moment ${ctx.formatTime(next.date)}`)}
      brief.textContent=parts.join(' · ');brief.hidden=!parts.length;
    };
    paint();setInterval(paint,30000);window.addEventListener('pacefold:week',paint);
  }

  // ---- Minutes that turn over ---------------------------------------------------
  const roll=(node,read=()=>node.textContent)=>{
    if(!node)return;let previous=read();
    new MutationObserver(()=>{const value=read();if(value===previous)return;const first=previous==='--:--'||previous==='--';previous=value;if(first||calm.matches)return;node.classList.remove('is-turning');void node.offsetWidth;node.classList.add('is-turning')}).observe(node,{childList:true,characterData:true,subtree:true});
    node.addEventListener('animationend',()=>node.classList.remove('is-turning'));
  };
  roll(id('cover-time-main'));
  roll(id('clock-minute'));
}
