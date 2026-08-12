import{$,id,el,button}from'./state.js';

export function installSchedule(ctx){
  ctx.getSchedule=(now=new Date())=>ctx.scheduleState(now,ctx.prefs);

  ctx.renderDayMarkers=(state,range,now)=>{
    const container=id('day-markers');
    if(!container)return;
    const key=`${ctx.todayKey(now)}|${range.start}|${range.end}|${state.today.map(item=>`${item.id}:${item.hours.toFixed(3)}`).join('|')}`;
    if(container.dataset.key===key)return;
    container.dataset.key=key;
    container.replaceChildren();
    for(const item of state.today){
      if(item.hours<range.start||item.hours>range.end)continue;
      const node=button('',`${item.label} at ${ctx.formatTime(item.date)}`);
      node.style.setProperty('--marker',String((item.hours-range.start)/(range.end-range.start)));
      node.addEventListener('click',()=>ctx.go?.('now'));
      container.append(node);
    }
  };

  ctx.rhythmRows=(container,state,now,compact=false)=>{
    if(!container)return;
    container.replaceChildren();
    for(const item of state.today){
      const row=el(compact?'button':'div','rhythm-row');
      if(compact)row.type='button';
      const isNext=state.next&&state.next.id===item.id&&ctx.todayKey(state.next.date)===ctx.todayKey(now);
      row.dataset.state=item.date<now?'past':isNext?'next':'upcoming';
      row.append(el('i'),el('span','',item.label),el('strong','',ctx.formatTime(item.date)));
      if(compact)row.addEventListener('click',()=>ctx.go?.('now'));
      container.append(row);
    }
  };

  ctx.renderRhythm=(now=new Date())=>{
    const state=ctx.getSchedule(now);
    const muslim=state.muslim;
    id('rhythm-kicker').textContent=muslim?'Prayer rhythm':'Personal rhythm';
    id('rhythm-title').textContent=state.next?`Next · ${state.next.label}`:'Today complete';
    id('rhythm-meta').textContent=muslim
      ?`${ctx.prefs.locationLabel} · ${ctx.prefs.method}° · ${ctx.prefs.asr==='hanafi'?'Hanafi Asr':'Standard Asr'} · ${ctx.prefs.timeZone}`
      :`${ctx.prefs.locationLabel||ctx.prefs.timeZone} · editable moments`;
    ctx.rhythmRows(id('rhythm-list'),state,now,true);
    ctx.rhythmRows(id('now-schedule-list'),state,now,false);
    id('now-schedule-kicker').textContent=muslim?'Prayer schedule':'Today’s moments';
    id('now-schedule-date').textContent=ctx.formatDate(now,{weekday:undefined});
  };

  ctx.scheduleDescription=()=>{
    const [start,end]=ctx.prefs.workHours.split('-');
    return{start,end,profile:ctx.prefs.profile,timeZone:ctx.prefs.timeZone};
  };
}
