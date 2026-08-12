import{id,el,button}from'./state.js';

export function installSchedule(ctx){
  ctx.rhythmRevealUntil=0;ctx.rhythmRevealTimer=0;ctx.getSchedule=(now=new Date())=>ctx.scheduleState(now,ctx.prefs);
  ctx.rhythmMode=()=>{const configured=['names','neutral','hidden'].includes(ctx.prefs.rhythmDiscretion)?ctx.prefs.rhythmDiscretion:'neutral';return ctx.prefs.quietMode&&configured==='names'?'neutral':configured};
  ctx.clockNamesVisible=()=>ctx.rhythmMode()==='names'||Date.now()<ctx.rhythmRevealUntil;
  ctx.clockMomentLabel=(item,fallback='Scheduled moment')=>ctx.clockNamesVisible()?(item?.label||fallback):fallback;
  ctx.clockCountdown=(date,now=new Date())=>{if(!date)return'';const total=Math.max(0,Math.round((date-now)/60000));return`${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`};

  ctx.revealRhythm=()=>{
    if(ctx.rhythmMode()!=='neutral')return;ctx.rhythmRevealUntil=Date.now()+6000;clearTimeout(ctx.rhythmRevealTimer);
    ctx.renderRhythm?.(new Date(),{home:ctx.mode==='home',nowView:false});ctx.renderClock?.(new Date());ctx.refreshCues?.();
    ctx.rhythmRevealTimer=setTimeout(()=>{ctx.rhythmRevealUntil=0;ctx.renderRhythm?.(new Date(),{home:ctx.mode==='home',nowView:false});ctx.renderClock?.(new Date());ctx.refreshCues?.()},6050);
  };

  ctx.bindRhythmReveal=()=>{
    const card=document.querySelector('.rhythm-card');if(!card||card.dataset.revealBound==='true')return;card.dataset.revealBound='true';let holdTimer=0;
    const cancel=()=>{clearTimeout(holdTimer);holdTimer=0},start=()=>{cancel();if(ctx.rhythmMode()!=='neutral')return;holdTimer=setTimeout(ctx.revealRhythm,600)};
    if(matchMedia('(hover: hover) and (pointer: fine)').matches){card.addEventListener('pointerenter',start);card.addEventListener('pointerleave',cancel)}
    card.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse')start()});card.addEventListener('pointerup',cancel);card.addEventListener('pointercancel',cancel);
  };

  ctx.renderDayMarkers=(state,range,now,currentProgress=0)=>{
    const container=id('day-markers'),path=id('day-arc-path');if(!container||!path)return;const named=ctx.clockNamesVisible();
    const key=`${ctx.todayKey(now)}|${range.start}|${range.end}|${named}|${range.activeDay}|${currentProgress.toFixed(3)}|${state.today.map(item=>`${item.id}:${item.hours.toFixed(3)}`).join('|')}`;if(container.dataset.key===key)return;
    container.dataset.key=key;container.replaceChildren();if(!range.activeDay)return;const length=path.getTotalLength();
    for(const item of state.today){
      if(item.hours<range.start||item.hours>range.end)continue;
      const markerProgress=ctx.clamp((item.hours-range.start)/(range.end-range.start),0,1,0),point=path.getPointAtLength(length*markerProgress),label=named?`${item.label} at ${ctx.formatTime(item.date)}`:`Scheduled moment at ${ctx.formatTime(item.date)}`;
      const node=button('day-marker-button',label);node.style.setProperty('--marker-x',`${point.x/600*100}%`);node.style.setProperty('--marker-y',`${point.y/120*100}%`);node.dataset.nearSun=String(Math.abs(markerProgress-currentProgress)<.03);if(named)node.title=label;node.addEventListener('click',()=>ctx.go?.('now'));container.append(node);
    }
  };

  ctx.rhythmRows=(container,state,now,{compact=false,discreet=false}={})=>{
    if(!container)return;container.replaceChildren();const named=!discreet||ctx.clockNamesVisible();
    for(const item of state.today){
      const row=el(compact?'button':'div','rhythm-row');if(compact)row.type='button';const isNext=state.next&&state.next.id===item.id&&ctx.todayKey(state.next.date)===ctx.todayKey(now);row.dataset.state=item.date<now?'past':isNext?'next':'upcoming';const name=el('span','',named?item.label:'');if(!named)name.setAttribute('aria-hidden','true');row.append(el('i'),name,el('strong','',ctx.formatTime(item.date)));if(compact)row.addEventListener('click',()=>ctx.go?.('now'));container.append(row);
    }
  };

  ctx.renderRhythm=(now=new Date(),{home=ctx.mode==='home',nowView=ctx.mode==='now'}={})=>{
    const state=ctx.getSchedule(now),muslim=state.muslim;
    if(home){
      const mode=ctx.rhythmMode(),named=ctx.clockNamesVisible(),card=document.querySelector('.rhythm-card'),grid=document.querySelector('.home-grid'),header=card?.querySelector(':scope > header'),adjust=header?.querySelector('button'),kicker=id('rhythm-kicker'),title=id('rhythm-title'),meta=id('rhythm-meta');
      if(card)card.hidden=mode==='hidden';if(grid)grid.dataset.rhythmHidden=String(mode==='hidden');if(meta){meta.textContent='';meta.hidden=true}if(kicker){kicker.textContent=named?(muslim?'Prayer rhythm':'Personal rhythm'):'';kicker.hidden=!named}if(adjust)adjust.hidden=!named;
      if(title)title.textContent=named?(state.next?`Next · ${state.next.label}`:'Today complete'):(state.next?`Next · ${ctx.clockCountdown(state.next.date,now)}`:'Today complete');if(header)header.dataset.discreet=String(!named);ctx.rhythmRows(id('rhythm-list'),state,now,{compact:true,discreet:true});
    }
    if(nowView){ctx.rhythmRows(id('now-schedule-list'),state,now,{compact:false,discreet:false});id('now-schedule-kicker').textContent=muslim?'Prayer schedule':'Today’s moments';id('now-schedule-date').textContent=ctx.formatDate(now,{weekday:undefined})}
  };

  ctx.scheduleDescription=()=>{const[start,end]=ctx.prefs.workHours.split('-');return{start,end,profile:ctx.prefs.profile,timeZone:ctx.prefs.timeZone}};
}
