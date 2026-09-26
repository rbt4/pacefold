import{id}from'./state.js';

export function installClock(ctx){
  ctx.clockParts=(now=new Date())=>ctx.zoneParts(now,ctx.prefs.timeZone);
  ctx.renderBarClock=(now=new Date(),part=ctx.clockParts(now))=>{
    id('bar-clock').textContent=ctx.formatTime(now,{second:ctx.prefs.showSeconds?'2-digit':undefined});
    return part;
  };

  ctx.renderHomeClock=(now=new Date(),part=ctx.clockParts(now))=>{
    const root=document.documentElement;
    // Accumulate forward only, so the sweeping hand never unwinds at the minute,
    // at midnight or when daylight saving falls back.
    const secondTarget=part.second*6;
    if(ctx.secondAngle===undefined)ctx.secondAngle=secondTarget;
    else ctx.secondAngle+=((secondTarget-ctx.secondAngle%360)+360)%360;
    root.style.setProperty('--second-angle',`${ctx.secondAngle}deg`);
    root.classList.toggle('seconds-off',!ctx.prefs.showSeconds);
    id('clock-hour').textContent=String(ctx.prefs.timeFormat==='24'?part.hour:(part.hour%12||12)).padStart(ctx.prefs.timeFormat==='24'?2:1,'0');
    id('clock-minute').textContent=String(part.minute).padStart(2,'0');
    id('clock-seconds').textContent=String(part.second).padStart(2,'0');
    id('clock-date').textContent=ctx.formatDate(now);

    const state=ctx.getSchedule(now),next=state.next,copy=id('next-moment');
    const homeLabel=ctx.clockMomentLabel(next);
    copy.querySelector('strong').textContent=next?`${homeLabel} · ${ctx.formatTime(next.date)}`:'Today is complete';
    copy.querySelector('small').textContent=next?ctx.relativeUntil(next.date,now):'';
  };

  ctx.renderNowClock=(now=new Date())=>{
    const state=ctx.getSchedule(now),next=state.next,label=ctx.clockMomentLabel(next);
    id('now-next-name').textContent=next?label:'Today is complete';
    id('now-next-time').textContent=next?ctx.formatTime(next.date):'—';
    id('now-countdown').textContent=next?ctx.relativeUntil(next.date,now):'The next day will begin quietly.';
    const guidance=id('now-guidance');
    // Before today's first moment the ring runs from yesterday's last one (or midnight).
    const yesterday=ctx.getSchedule(new Date(now.getTime()-86400000)).today.at(-1)?.date;
    const previous=[...state.today].reverse().find(item=>item.date<=now)?.date||yesterday||ctx.zonedForToday(0,now);
    const from=next&&previous>=next.date?ctx.zonedForToday(0,now):previous;
    const span=next?Math.max(60000,next.date-from):1,ringProgress=next?ctx.clamp((now-from)/span,0,1,0):1;
    const primary=document.querySelector('.now-primary');if(primary)primary.style.setProperty('--now-progress',ringProgress.toFixed(4));
    const minutesLeft=next?Math.max(0,Math.round((next.date-now)/60000)):0,ringLabel=id('now-ring-value');
    if(ringLabel)ringLabel.textContent=next?(minutesLeft>=60?`${Math.floor(minutesLeft/60)}h ${String(minutesLeft%60).padStart(2,'0')}m`:`${minutesLeft}m`):'Done';
    const waiting=ctx.currentCues.length;if(guidance)guidance.textContent=waiting?`${waiting===1?`“${ctx.clockCueCopy(ctx.currentCues[0]).label}” is waiting.`:`${waiting} cues are waiting, starting with “${ctx.clockCueCopy(ctx.currentCues[0]).label}”.`} Log it when done and it reschedules itself, or snooze cues for ten minutes.`:next?'Nothing is waiting. Keep your current pace.':'No scheduled moments remain today.';
    for(const control of[id('now-clear-cue'),id('now-snooze')])if(control)control.disabled=!waiting;
    const resolve=id('now-clear-cue');if(resolve)resolve.textContent=waiting?ctx.cueActionLabel(ctx.currentCues[0]):'Done';
  };

  ctx.renderClock=(now=new Date())=>{
    const part=ctx.renderBarClock(now);
    if(ctx.mode==='home')ctx.renderHomeClock(now,part);
    if(ctx.mode==='now')ctx.renderNowClock(now);
  };
}
