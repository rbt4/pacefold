import{id,el,button}from'./state.js';

export function installSchedule(ctx){
  ctx.rhythmRevealUntil=0;
  ctx.rhythmRevealTimer=0;
  ctx.getSchedule=(now=new Date())=>ctx.scheduleState(now,ctx.prefs);
  ctx.rhythmMode=()=>{
    const configured=['names','neutral','hidden'].includes(ctx.prefs.rhythmDiscretion)?ctx.prefs.rhythmDiscretion:'neutral';
    return ctx.prefs.quietMode&&configured==='names'?'neutral':configured;
  };
  ctx.clockNamesVisible=()=>ctx.rhythmMode()==='names'||(ctx.mode==='home'&&Date.now()<ctx.rhythmRevealUntil);
  ctx.clockMomentLabel=(item,fallback='Scheduled moment')=>ctx.clockNamesVisible()?(item?.label||fallback):fallback;
  ctx.clockCountdown=(date,now=new Date())=>{
    if(!date)return'';
    const total=Math.max(0,Math.round((date-now)/60000));
    return`${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
  };

  ctx.revealRhythm=()=>{
    if(ctx.rhythmMode()!=='neutral'||ctx.mode!=='home')return;
    ctx.rhythmRevealUntil=Date.now()+6000;
    clearTimeout(ctx.rhythmRevealTimer);
    ctx.renderDial?.();ctx.renderClock?.(new Date());ctx.refreshCues?.();
    ctx.rhythmRevealTimer=setTimeout(()=>{
      ctx.rhythmRevealUntil=0;
      if(ctx.mode==='home')ctx.renderDial?.();
      ctx.renderClock?.(new Date());ctx.refreshCues?.();
    },6050);
  };

  ctx.rhythmRows=(container,state,now,{compact=false,discreet=false}={})=>{
    if(!container)return;
    container.replaceChildren();
    const named=!discreet||ctx.clockNamesVisible();
    for(const item of state.today){
      const row=el(compact?'button':'div','rhythm-row');
      if(compact)row.type='button';
      const isNext=state.next&&state.next.id===item.id&&ctx.todayKey(state.next.date)===ctx.todayKey(now);
      row.dataset.state=item.date<now?'past':isNext?'next':'upcoming';
      const name=el('span','',named?item.label:'');
      if(!named)name.setAttribute('aria-hidden','true');
      row.append(el('i'),name,el('strong','',ctx.formatTime(item.date)));
      if(compact)row.addEventListener('click',()=>ctx.go?.('now'));
      container.append(row);
    }
  };

  // Clock shows the rhythm on the Horizon Dial (horizon-dial.js); this renders the Now list.
  ctx.renderRhythm=(now=new Date(),{nowView=ctx.mode==='now'}={})=>{
    const state=ctx.getSchedule(now);
    const muslim=state.muslim;
    if(nowView){
      const discreet=ctx.rhythmMode()!=='names';
      ctx.rhythmRows(id('now-schedule-list'),state,now,{compact:false,discreet});
      id('now-schedule-kicker').textContent=discreet?'Today’s rhythm':(muslim?'Prayer schedule':'Today’s moments');
      id('now-schedule-date').textContent=ctx.formatDate(now,{weekday:undefined});
    }
  };

  ctx.scheduleDescription=()=>{
    const[start,end]=ctx.prefs.workHours.split('-');
    return{start,end,profile:ctx.prefs.profile,timeZone:ctx.prefs.timeZone};
  };
}
