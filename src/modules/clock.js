import{$,id}from'./state.js';

export function installClock(ctx){
  ctx.clockParts=(now=new Date())=>ctx.zoneParts(now,ctx.prefs.timeZone);

  ctx.renderClock=(now=new Date())=>{
    const part=ctx.clockParts(now);
    const minutes=part.minute+part.second/60;
    const hours=(part.hour%12)+minutes/60;
    const root=document.documentElement;
    root.style.setProperty('--hour-angle',`${hours*30}deg`);
    root.style.setProperty('--minute-angle',`${minutes*6}deg`);
    root.style.setProperty('--second-angle',`${part.second*6}deg`);
    root.classList.toggle('seconds-off',!ctx.prefs.showSeconds);

    id('clock-hour').textContent=String(ctx.prefs.timeFormat==='24'?part.hour:(part.hour%12||12)).padStart(ctx.prefs.timeFormat==='24'?2:1,'0');
    id('clock-minute').textContent=String(part.minute).padStart(2,'0');
    id('clock-seconds').textContent=String(part.second).padStart(2,'0');
    id('clock-date').textContent=ctx.formatDate(now);
    id('bar-clock').textContent=ctx.formatTime(now,{second:ctx.prefs.showSeconds?'2-digit':undefined});

    const state=ctx.getSchedule(now);
    const next=state.next;
    const copy=id('next-moment');
    copy.querySelector('strong').textContent=next?`${next.label} · ${ctx.formatTime(next.date)}`:'Today is complete';
    copy.querySelector('small').textContent=next?ctx.relativeUntil(next.date,now):'';
    id('now-next-name').textContent=next?.label||'Today is complete';
    id('now-next-time').textContent=next?ctx.formatTime(next.date):'—';
    id('now-countdown').textContent=next?ctx.relativeUntil(next.date,now):'The next day will begin quietly.';

    const range=ctx.workRange(ctx.prefs,now);
    const decimal=part.hour+part.minute/60+part.second/3600;
    const progress=ctx.clamp((decimal-range.start)/(range.end-range.start),0,1,0);
    const dayState=!range.activeDay?'Off day':decimal<range.start?'Before work':decimal>range.end?'Workday complete':'Workday unfolding';
    $('.day-sky')?.style.setProperty('--progress',String(progress));
    id('day-percent').textContent=`${Math.round(progress*100)}%`;
    id('day-copy').textContent=dayState;
    id('day-phase').textContent=range.activeDay?'Workday':'Off day';
    id('work-start').textContent=ctx.formatTime(ctx.zonedForToday(range.start,now));
    id('work-end').textContent=ctx.formatTime(ctx.zonedForToday(range.end,now));
    id('clock-status').textContent=ctx.prefs.quietMode
      ?'Quiet mode is keeping only essentials'
      :ctx.currentCues.length?`${ctx.currentCues.length} quiet cue${ctx.currentCues.length===1?'':'s'} waiting`:'Quietly keeping pace';
    ctx.renderDayMarkers(state,range,now);
  };
}
