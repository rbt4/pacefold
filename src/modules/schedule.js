import{id,el,button}from'./state.js';

export function installSchedule(ctx){
  ctx.rhythmRevealUntil=0;
  ctx.rhythmRevealTimer=0;
  ctx.getSchedule=(now=new Date())=>ctx.scheduleState(now,ctx.prefs);
  ctx.rhythmMode=()=>{
    const configured=['names','neutral','hidden'].includes(ctx.prefs.rhythmDiscretion)?ctx.prefs.rhythmDiscretion:'neutral';
    return ctx.prefs.quietMode&&configured==='names'?'neutral':configured;
  };
  ctx.clockNamesVisible=()=>ctx.rhythmMode()==='names'||Date.now()<ctx.rhythmRevealUntil;
  ctx.clockMomentLabel=(item,fallback='Scheduled moment')=>ctx.clockNamesVisible()?(item?.label||fallback):fallback;
  ctx.clockCountdown=(date,now=new Date())=>{
    if(!date)return'';
    const total=Math.max(0,Math.round((date-now)/60000));
    return`${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
  };

  ctx.revealRhythm=()=>{
    if(ctx.rhythmMode()!=='neutral')return;
    ctx.rhythmRevealUntil=Date.now()+6000;
    clearTimeout(ctx.rhythmRevealTimer);
    ctx.renderRhythm?.();
    ctx.renderClock?.();
    ctx.refreshCues?.();
    ctx.rhythmRevealTimer=setTimeout(()=>{
      ctx.rhythmRevealUntil=0;
      ctx.renderRhythm?.();
      ctx.renderClock?.();
      ctx.refreshCues?.();
    },6050);
  };

  ctx.bindRhythmReveal=()=>{
    const card=document.querySelector('.rhythm-card');
    if(!card||card.dataset.revealBound==='true')return;
    card.dataset.revealBound='true';
    let holdTimer=0;
    const cancel=()=>{clearTimeout(holdTimer);holdTimer=0};
    const start=()=>{
      cancel();
      if(ctx.rhythmMode()!=='neutral')return;
      holdTimer=setTimeout(ctx.revealRhythm,600);
    };
    if(matchMedia('(hover: hover) and (pointer: fine)').matches){
      card.addEventListener('pointerenter',start);
      card.addEventListener('pointerleave',cancel);
    }
    card.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse')start()});
    card.addEventListener('pointerup',cancel);
    card.addEventListener('pointercancel',cancel);
  };

  ctx.renderDayMarkers=(state,range,now)=>{
    const container=id('day-markers');
    if(!container)return;
    const named=ctx.clockNamesVisible();
    const key=`${ctx.todayKey(now)}|${range.start}|${range.end}|${named}|${state.today.map(item=>`${item.id}:${item.hours.toFixed(3)}`).join('|')}`;
    if(container.dataset.key===key)return;
    container.dataset.key=key;
    container.replaceChildren();
    for(const item of state.today){
      if(item.hours<range.start||item.hours>range.end)continue;
      const label=named?`${item.label} at ${ctx.formatTime(item.date)}`:`Scheduled moment at ${ctx.formatTime(item.date)}`;
      const node=button('',label);
      node.style.setProperty('--marker',String((item.hours-range.start)/(range.end-range.start)));
      node.addEventListener('click',()=>ctx.go?.('now'));
      container.append(node);
    }
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

  ctx.renderRhythm=(now=new Date())=>{
    const state=ctx.getSchedule(now);
    const muslim=state.muslim;
    const mode=ctx.rhythmMode();
    const named=ctx.clockNamesVisible();
    const card=document.querySelector('.rhythm-card');
    const header=card?.querySelector(':scope > header');
    const adjust=header?.querySelector('button');
    const kicker=id('rhythm-kicker');
    const title=id('rhythm-title');
    const meta=id('rhythm-meta');

    if(card)card.hidden=mode==='hidden';
    if(meta){meta.textContent='';meta.hidden=true}
    if(kicker){kicker.textContent=named?(muslim?'Prayer rhythm':'Personal rhythm'):'';kicker.hidden=!named}
    if(adjust)adjust.hidden=!named;
    if(title){
      title.textContent=named
        ?(state.next?`Next · ${state.next.label}`:'Today complete')
        :(state.next?`Next · ${ctx.clockCountdown(state.next.date,now)}`:'Today complete');
    }
    if(header)header.dataset.discreet=String(!named);

    ctx.rhythmRows(id('rhythm-list'),state,now,{compact:true,discreet:true});
    ctx.rhythmRows(id('now-schedule-list'),state,now,{compact:false,discreet:false});
    id('now-schedule-kicker').textContent=muslim?'Prayer schedule':'Today’s moments';
    id('now-schedule-date').textContent=ctx.formatDate(now,{weekday:undefined});
  };

  ctx.scheduleDescription=()=>{
    const [start,end]=ctx.prefs.workHours.split('-');
    return{start,end,profile:ctx.prefs.profile,timeZone:ctx.prefs.timeZone};
  };
}
