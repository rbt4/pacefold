import{$,id,el,button}from'./state.js';

export function installDaylog(ctx){
  ctx.renderActions=()=>{
    ctx.resetDailyIfNeeded();
    const water=ctx.clamp(ctx.prefs.waterOz??ctx.prefs.waterSips,0,256,0);
    const waterProgress=ctx.clamp(water/ctx.prefs.waterTarget,0,1,0);
    const states={prep:ctx.timerState('prep',ctx.prefs.prepMinutes),away:ctx.timerState('away',ctx.prefs.awayMinutes),meal:ctx.timerState('meal',ctx.prefs.mealMinutes)};
    id('water-state').textContent=`${water} / ${ctx.prefs.waterTarget} oz`;
    id('water-meter').closest('.quick-action').style.setProperty('--meter',String(waterProgress));
    for(const[source,state]of Object.entries(states)){
      const control=$(`[data-action="${source}"]`),copy=id(`${source}-state`);
      control.dataset.active=String(Boolean(state.start));control.style.setProperty('--meter',String(state.progress));
      copy.textContent=state.done?'Ready · tap to clear':state.running?`${Math.ceil(state.remaining/60000)} min left`:`${state.duration/60000} min`;
    }
    const eyeDue=ctx.currentCues.some(cue=>cue.source==='eyes'),moveDue=ctx.currentCues.some(cue=>cue.source==='move'),waterDue=ctx.currentCues.some(cue=>cue.source==='water');
    $('[data-action="eyes"]').dataset.due=String(eyeDue);$('[data-action="move"]').dataset.due=String(moveDue);$('[data-action="water"]').dataset.due=String(waterDue);
    id('eyes-state').textContent='20-second reset';id('move-state').textContent=`${ctx.prefs.bodyCadence}-min cadence`;
  };

  ctx.performAction=action=>{
    const now=Date.now();
    if(action==='water'){
      const value=Math.min(ctx.prefs.waterTarget,Number(ctx.prefs.waterOz??ctx.prefs.waterSips??0)+ctx.prefs.waterStep);
      ctx.storePrefs({waterOz:value,waterSips:value,waterLastAt:now,waterDate:ctx.todayKey()},'water');ctx.addMoment('water','Water logged',`${value} of ${ctx.prefs.waterTarget} oz`,now,'water',{total:value});ctx.toast(`${value} / ${ctx.prefs.waterTarget} oz`);
    }
    if(action==='prep'){
      const state=ctx.timerState('prep',ctx.prefs.prepMinutes);
      if(state.start){ctx.closeSession('prep','Preparation complete');ctx.storePrefs({noodleStart:0},'prep-end');ctx.toast(state.done?'Preparation acknowledged':'Preparation stopped')}
      else{ctx.storePrefs({noodleStart:now,noodleMinutes:ctx.prefs.prepMinutes},'prep-start');ctx.openSession('prep','timer','Preparation timer',`${ctx.prefs.prepMinutes} minutes`,now);ctx.toast(`${ctx.prefs.prepMinutes}-minute prep started`)}
    }
    if(action==='away'){
      const state=ctx.timerState('away',ctx.prefs.awayMinutes);
      if(state.start){ctx.closeSession('away','Returned');ctx.storePrefs({awayStart:0},'away-end');ctx.toast('Returned to the day')}
      else{ctx.storePrefs({awayStart:now},'away-start');ctx.openSession('away','away','Step away',`${ctx.prefs.awayMinutes}-minute guide`,now);ctx.toast('Away timer started')}
    }
    if(action==='meal'){
      const state=ctx.timerState('meal',ctx.prefs.mealMinutes);
      if(state.start){ctx.closeSession('meal','Meal complete');ctx.storePrefs({lunchStart:0},'meal-end');ctx.toast('Meal complete')}
      else{ctx.storePrefs({lunchStart:now},'meal-start');ctx.openSession('meal','meal','Meal window',`${ctx.prefs.mealMinutes} minutes`,now);ctx.toast('Meal window started')}
    }
    if(action==='eyes'){ctx.storePrefs({gazeLastCompleted:now},'eyes');ctx.addMoment('eyes','Distance look','20-second eye reset',now,'eyes');ctx.toast('Distance look logged')}
    if(action==='move'){ctx.storePrefs({bodyLastCompleted:now},'move');ctx.addMoment('move','Movement reset','Changed position and moved',now,'move');ctx.toast('Movement reset logged')}
    if(action==='ack'){const cue=ctx.currentCues[0];if(cue){ctx.acknowledgeCue(cue);ctx.toast(`${ctx.clockCueCopy?.(cue)?.label||cue.label} cleared`)}else ctx.toast('No waiting cue')}
    if(action==='snooze')ctx.snoozeCues(10);
    ctx.refreshCues();ctx.renderAll?.();
  };

  ctx.noteForEvent=event=>{
    const direct=event.meta?.noteId&&ctx.notes.find(note=>note.id===event.meta.noteId);
    if(direct)return direct;
    const at=Number(event.start)||0;
    return ctx.notes.find(note=>Math.abs(new Date(note.context?.at||note.createdAt).getTime()-at)<60000)||null;
  };

  ctx.previousDayKey=key=>{
    const[y,m,d]=String(key).split('-').map(Number),date=new Date(Date.UTC(y,m-1,d-1));
    return date.toISOString().slice(0,10);
  };

  ctx.renderYesterdayComparison=(todayKey,todayMetrics,todayNotes)=>{
    const view=$('.view-worklog'),layout=$('.log-layout');if(!view||!layout)return;
    let section=id('day-compare');
    if(!section){section=el('section','day-compare');section.id='day-compare';section.setAttribute('aria-label','Yesterday comparison');layout.after(section)}
    const yesterdayKey=ctx.previousDayKey(todayKey),nowPart=ctx.zoneParts(new Date(),ctx.prefs.timeZone),[y,m,d]=yesterdayKey.split('-').map(Number),decimal=nowPart.hour+nowPart.minute/60+nowPart.second/3600,yesterdayNow=ctx.zonedDate(y,m,d,decimal,ctx.prefs.timeZone).getTime(),yesterdayEvents=ctx.dayEvents(yesterdayKey).filter(event=>Number(event.start)<=yesterdayNow),comparisonLog={...ctx.log,days:{...(ctx.log.days||{}),[yesterdayKey]:{...(ctx.log.days?.[yesterdayKey]||{}),events:yesterdayEvents}}},yesterdayMetrics=ctx.metricsForDay(comparisonLog,yesterdayKey,ctx.prefs,yesterdayNow),yesterdayNotes=ctx.notesForDate(yesterdayKey).filter(note=>new Date(note.context?.at||note.createdAt).getTime()<=yesterdayNow);
    const hasYesterday=yesterdayMetrics.events.length||yesterdayNotes.length;
    section.replaceChildren();
    const head=el('header'),copy=el('span');copy.append(el('small','','Against yesterday'),el('strong','',hasYesterday?'Same point in the day':'No comparison yet'));head.append(copy,el('b','',yesterdayKey));section.append(head);
    if(!hasYesterday){const empty=el('p','day-compare-empty','Yesterday is quiet at this point. Pacefold will compare the days once there is something useful to compare.');section.append(empty);return}
    const rows=[
      ['At work',todayMetrics.desk,yesterdayMetrics.desk,'duration'],
      ['Focus',todayMetrics.focus,yesterdayMetrics.focus,'duration'],
      ['Breaks',todayMetrics.breaks,yesterdayMetrics.breaks,'count'],
      ['Notes',todayNotes.length,yesterdayNotes.length,'count']
    ],grid=el('div','day-compare-grid');
    for(const[label,current,previous,kind]of rows){
      const card=el('article','day-compare-card'),delta=current-previous,sign=delta>0?'+':delta<0?'−':'',absolute=Math.abs(delta),value=kind==='duration'?ctx.durationText(current):String(current),deltaText=!delta?'Same':kind==='duration'?`${sign}${ctx.durationText(absolute)}`:`${sign}${absolute}`;
      card.dataset.direction=delta>0?'up':delta<0?'down':'same';card.dataset.zero=String(current===0&&previous===0);
      card.append(el('span','',label),el('strong','',value),el('small','',`${deltaText} vs yesterday`));grid.append(card);
    }
    section.append(grid);
  };

  ctx.renderWorklog=()=>{
    const key=ctx.todayKey(),metrics=ctx.metricsForDay(ctx.log,key,ctx.prefs),todayNotes=ctx.notesForDate(key);
    const values=[['Elapsed',metrics.elapsed,'duration'],['At work',metrics.desk,'duration'],['Focus',metrics.focus,'duration'],['Away',metrics.away+metrics.meal,'duration'],['Breaks',metrics.breaks,'count'],['Notes',todayNotes.length,'count']];
    const grid=id('metric-grid');grid.replaceChildren();
    for(const[label,value,kind]of values){const card=el('article','metric-card');card.dataset.tone=label.toLowerCase().replace(/\s+/g,'-');card.dataset.zero=String(Number(value)===0);card.append(el('span','',label),el('strong','',kind==='duration'?ctx.durationText(value):value));grid.append(card)}

    const elapsed=Math.max(1,metrics.elapsed),segments=[['At work',metrics.desk,'#426b5b'],['Away',metrics.away,'#77638e'],['Meal',metrics.meal,'#a25047'],['Field',metrics.field,'#3f718b']];
    const bar=id('day-balance-bar'),legend=id('day-balance-legend');bar.replaceChildren();legend.replaceChildren();
    for(const[label,value,color]of segments){
      if(value>0){const segment=el('span');segment.style.setProperty('--segment',color);segment.style.width=`${Math.max(1,value/elapsed*100)}%`;bar.append(segment)}
      const keyNode=el('span','balance-key'),dot=el('i');keyNode.style.setProperty('--segment',color);keyNode.append(dot,el('span','',`${label} ${ctx.durationText(value)}`));legend.append(keyNode);
    }
    if(!bar.children.length){const idle=el('span');idle.style.setProperty('--segment','rgba(102,113,107,.18)');idle.style.width='100%';bar.append(idle)}

    const eventCount=metrics.events.length,title=!eventCount?'A quiet start':metrics.focus>=45*60000?'Deep work is taking shape':metrics.elapsed>=2*3600000&&!metrics.breaks?'The day needs one reset':metrics.breaks>=2?'A balanced pace':'A steady workday';
    const story=!eventCount?'Clock actions will build a useful record automatically.':`${eventCount} moment${eventCount===1?'':'s'} kept · ${ctx.durationText(metrics.focus)} focused · ${metrics.breaks} reset${metrics.breaks===1?'':'s'}.`;
    id('day-story-title').textContent=title;id('day-story-copy').textContent=story;

    const timeline=id('timeline'),events=metrics.events.slice().reverse();id('timeline-meta').textContent=events.length?`${events.length} moment${events.length===1?'':'s'} · newest first`:'Nothing logged yet';timeline.replaceChildren();
    if(!events.length){
      const empty=el('div','empty-state');empty.append(el('strong','','No transitions yet'),el('span','','Use Clock normally. Water, breaks, timers and notes appear here automatically.'));timeline.append(empty);
    }else for(const event of events){
      const row=el('article','timeline-row'),rail=el('span','timeline-rail'),copy=el('span','timeline-copy'),end=event.end&&event.end!==event.start?ctx.durationText(event.end-event.start):event.end?'Moment':'In progress',badge=el('b','',end);
      const linkedNote=ctx.noteForEvent(event);
      row.dataset.event=event.type||event.source;badge.dataset.open=String(!event.end);
      const top=el('span','timeline-copy-head');top.append(el('strong','',event.label||event.type));
      if(linkedNote){
        const noteLink=button('timeline-note-link',`Open linked note`,`N`);noteLink.title='Open linked note';noteLink.dataset.noteId=linkedNote.id;noteLink.addEventListener('click',()=>ctx.openNote(linkedNote));top.append(noteLink);row.dataset.hasNote='true';
      }
      copy.append(top,el('small','',event.detail||'Pacefold moment'),badge);row.append(el('time','',ctx.formatTime(new Date(event.start))),rail,copy);timeline.append(row);
    }

    const focus=ctx.findOpen('focus'),field=ctx.findOpen('field');
    id('focus-toggle').textContent=focus?'End focus':'Start focus';id('focus-toggle').dataset.active=String(Boolean(focus));id('focus-tool-state').textContent=focus?`Running · ${ctx.durationText(Date.now()-focus.start)}`:'Start protected time';id('field-toggle-state').textContent=field?`Running · ${ctx.durationText(Date.now()-field.start)}`:'Start a field session';id('field-toggle').dataset.active=String(Boolean(field));
    ctx.renderYesterdayComparison(key,metrics,todayNotes);
  };

  ctx.renderActive=()=>{
    const list=id('active-list'),active=[],timerStates={};
    for(const[source,label,minutes]of[['prep','Preparation',ctx.prefs.prepMinutes],['away','Away',ctx.prefs.awayMinutes],['meal','Meal',ctx.prefs.mealMinutes]]){const state=ctx.timerState(source,minutes);timerStates[source]=state;if(state.start)active.push([label,state.done?'Ready':`${Math.ceil(state.remaining/60000)} min left`])}
    const focus=ctx.findOpen('focus');if(focus)active.push(['Focus',ctx.durationText(Date.now()-focus.start)]);list.replaceChildren();
    if(!active.length){const empty=el('div','active-empty');empty.append(el('strong','','Nothing is running'),el('span','','Start only what helps right now.'));list.append(empty)}
    else for(const[label,value]of active){const row=el('div','active-item');row.append(el('strong','',label),el('span','',value));list.append(row)}
    for(const[source,state]of Object.entries(timerStates)){const control=$(`.now-quick [data-action="${source}"]`);if(control){control.dataset.active=String(Boolean(state.start));control.textContent=state.start?`End ${source}`:source[0].toUpperCase()+source.slice(1)}}
    const focusControl=$('.now-quick [data-log="focus"]');if(focusControl){focusControl.dataset.active=String(Boolean(focus));focusControl.textContent=focus?'End focus':'Focus'}
  };
}
