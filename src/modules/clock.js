import{$,id}from'./state.js';

const SVG='http://www.w3.org/2000/svg';
const svg=(tag,attributes={})=>{
  const node=document.createElementNS(SVG,tag);
  for(const[key,value]of Object.entries(attributes))node.setAttribute(key,String(value));
  return node;
};

export function installClock(ctx){
  ctx.clockParts=(now=new Date())=>ctx.zoneParts(now,ctx.prefs.timeZone);
  ctx.daySkyMinuteKey='';

  ctx.buildDaySky=()=>{
    const sky=$('.day-sky');
    if(!sky||id('day-arc-path'))return;
    sky.replaceChildren();
    const graphic=svg('svg',{class:'day-sky-svg',viewBox:'0 0 600 130','aria-hidden':'true',preserveAspectRatio:'none'});
    const defs=svg('defs');
    const filter=svg('filter',{id:'day-glow-filter',x:'-100%',y:'-100%',width:'300%',height:'300%'});
    filter.append(svg('feGaussianBlur',{stdDeviation:'8'}));defs.append(filter);
    const horizon=svg('line',{class:'day-horizon',x1:'20',y1:'110',x2:'580',y2:'110'});
    const arc=svg('path',{id:'day-arc-path',class:'day-arc',d:'M20 110 Q300 18 580 110',fill:'none'});
    const progress=svg('path',{id:'day-arc-progress',class:'day-arc-progress',d:'M20 110 Q300 18 580 110',fill:'none',pathLength:'1'});
    const nowLine=svg('line',{id:'day-now-line',class:'day-now-line',x1:'20',y1:'18',x2:'20',y2:'116'});
    const shadow=svg('ellipse',{id:'day-sun-shadow',class:'day-sun-shadow',cx:'0',cy:'0',rx:'32',ry:'4'});
    const glow=svg('circle',{id:'day-sun-glow',class:'day-sun-glow',cx:'0',cy:'0',r:'22',filter:'url(#day-glow-filter)'});
    const sun=svg('g',{id:'day-sun-group',class:'day-sun-group'});
    sun.append(svg('circle',{class:'day-sun-halo',cx:'0',cy:'0',r:'13'}),svg('circle',{class:'day-sun-core',cx:'0',cy:'0',r:'7'}));
    graphic.append(defs,horizon,arc,progress,nowLine,shadow,glow,sun);
    const markers=document.createElement('div');markers.className='day-markers';markers.id='day-markers';
    sky.append(graphic,markers);
  };

  ctx.renderDaySky=(now,state,range,part)=>{
    ctx.buildDaySky();
    const sky=$('.day-sky'),path=id('day-arc-path'),progressPath=id('day-arc-progress'),nowLine=id('day-now-line'),sun=id('day-sun-group'),glow=id('day-sun-glow'),shadow=id('day-sun-shadow');
    if(!sky||!path||!sun)return;
    const decimal=part.hour+part.minute/60;
    const progress=ctx.clamp((decimal-range.start)/(range.end-range.start),0,1,0);
    const stateName=!range.activeDay?'off':decimal<range.start?'before':decimal>range.end?'after':'active';
    const key=`${ctx.todayKey(now)}|${part.hour}:${part.minute}|${range.start}:${range.end}|${stateName}`;
    if(ctx.daySkyMinuteKey===key)return;
    ctx.daySkyMinuteKey=key;
    sky.dataset.state=stateName;
    sky.style.setProperty('--progress',String(progress));
    const firstHalf=progress<=.5;
    sky.style.setProperty('--sky-from',firstHalf?'var(--blue-soft)':'var(--amber-soft)');
    sky.style.setProperty('--sky-to',firstHalf?'var(--amber-soft)':'color-mix(in srgb,var(--amber-soft),var(--red) 12%)');
    sky.style.setProperty('--sky-mix',`${Math.round((firstHalf?progress*2:(progress-.5)*2)*100)}%`);
    if(progressPath){progressPath.style.strokeDasharray='1';progressPath.style.strokeDashoffset=String(1-progress)}
    if(stateName==='off'){
      if(nowLine)nowLine.hidden=true;sun.hidden=true;if(glow)glow.hidden=true;if(shadow)shadow.hidden=true;
      ctx.renderDayMarkers(state,range,now,progress);return;
    }
    const length=path.getTotalLength();
    const point=stateName==='active'?path.getPointAtLength(length*progress):stateName==='before'?{x:20,y:121}:{x:580,y:121};
    if(nowLine){nowLine.hidden=false;nowLine.setAttribute('x1',String(point.x));nowLine.setAttribute('x2',String(point.x))}
    sun.hidden=false;if(glow)glow.hidden=false;if(shadow)shadow.hidden=false;
    const elevation=stateName==='active'?4*progress*(1-progress):0;
    const transform=`translate(${point.x}px,${point.y}px)`;
    sun.style.transform=transform;sun.dataset.muted=String(stateName!=='active');
    if(glow){glow.style.transform=transform;glow.setAttribute('r',String(20+elevation*5));glow.style.opacity=String(.18+elevation*.18)}
    if(shadow){
      shadow.style.transform=`translate(${point.x}px,110px)`;
      shadow.setAttribute('rx',String(35-elevation*18));shadow.setAttribute('ry',String(3.8-elevation*1.5));shadow.style.opacity=String(.16-elevation*.06);
    }
    ctx.renderDayMarkers(state,range,now,progress);
  };

  ctx.renderBarClock=(now=new Date(),part=ctx.clockParts(now))=>{
    id('bar-clock').textContent=ctx.formatTime(now,{second:ctx.prefs.showSeconds?'2-digit':undefined});
    return part;
  };

  ctx.renderHomeClock=(now=new Date(),part=ctx.clockParts(now))=>{
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

    const state=ctx.getSchedule(now),next=state.next,copy=id('next-moment');
    const homeLabel=ctx.clockMomentLabel(next);
    copy.querySelector('strong').textContent=next?`${homeLabel} · ${ctx.formatTime(next.date)}`:'Today is complete';
    copy.querySelector('small').textContent=next?ctx.relativeUntil(next.date,now):'';

    const range=ctx.workRange(ctx.prefs,now);
    const decimal=part.hour+part.minute/60;
    const progress=ctx.clamp((decimal-range.start)/(range.end-range.start),0,1,0);
    const dayState=!range.activeDay?'Off day':decimal<range.start?'Before work':decimal>range.end?'Workday complete':'Workday unfolding';
    id('day-percent').textContent=range.activeDay?`${Math.round(progress*100)}% of workday`:'Off day';
    id('day-copy').textContent=dayState;id('day-phase').textContent=range.activeDay?'Workday':'Off day';
    id('work-start').textContent=ctx.formatTime(ctx.zonedForToday(range.start,now));id('work-end').textContent=ctx.formatTime(ctx.zonedForToday(range.end,now));
    id('clock-status').textContent=ctx.prefs.quietMode?'Quiet mode':ctx.currentCues.length?'Quiet cues ready':'Quietly keeping pace';
    ctx.renderDaySky(now,state,range,part);
  };

  ctx.renderNowClock=(now=new Date())=>{
    const state=ctx.getSchedule(now),next=state.next,label=ctx.clockMomentLabel(next);
    id('now-next-name').textContent=next?label:'Today is complete';
    id('now-next-time').textContent=next?ctx.formatTime(next.date):'—';
    id('now-countdown').textContent=next?ctx.relativeUntil(next.date,now):'The next day will begin quietly.';
    const guidance=id('now-guidance');
    if(guidance)guidance.textContent=next?`${label} is the next scheduled point in the day.`:'No scheduled moments remain today.';
  };

  ctx.renderClock=(now=new Date())=>{
    const part=ctx.renderBarClock(now);
    if(ctx.mode==='home')ctx.renderHomeClock(now,part);
    if(ctx.mode==='now')ctx.renderNowClock(now);
  };
}
