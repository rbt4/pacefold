import{id,el,button}from'./state.js';

const ICON_NAMES={water:'water',prayer:'prayer',prep:'prepare',away:'away',meal:'meal',eyes:'eyes',move:'move'};

export function installCues(ctx){
  ctx.cueState=normalizeCueState(ctx.cueState);

  const analog=id('analog');
  if(analog&&!id('clock-cue-ring')){
    const ring=el('div','clock-cue-ring');
    ring.id='clock-cue-ring';
    ring.setAttribute('aria-label','Waiting cues on the clock');
    analog.append(ring);
  }
  const clockCard=document.querySelector('.clock-card');
  if(clockCard&&!id('clock-cue-panel')){
    const panel=el('section','clock-cue-panel');
    panel.id='clock-cue-panel';
    panel.hidden=true;
    panel.setAttribute('aria-live','polite');
    const head=el('header');
    const copy=el('span');
    copy.append(el('small','','Quiet cues'),el('strong','','Waiting on the clock'));
    const count=el('b','', '0');count.id='clock-cue-count';
    head.append(copy,count);
    const list=el('div','clock-cue-list');list.id='clock-cue-list';
    panel.append(head,list);
    clockCard.querySelector('.day-unfold')?.before(panel);
  }

  const launchUrl=new URL(location.href);
  if(launchUrl.searchParams.get('cueAction')==='snooze'){
    ctx.cueState.snoozeUntil=Date.now()+10*60*1000;
    localStorage.setItem(ctx.KEYS.cueState,JSON.stringify(ctx.cueState));
    launchUrl.searchParams.delete('cueAction');
    history.replaceState(null,'',`${launchUrl.pathname}${launchUrl.search}${launchUrl.hash}`);
  }

  ctx.saveCueState=()=>localStorage.setItem(ctx.KEYS.cueState,JSON.stringify(ctx.cueState));
  ctx.clockCueCopy=cue=>{
    const discreet=cue.source==='prayer'&&!ctx.clockNamesVisible?.();
    return discreet
      ?{label:'Scheduled moment',detail:`Due · ${ctx.formatTime(new Date(cue.dueAt||Date.now()))}`}
      :{label:cue.label,detail:cue.detail};
  };
  ctx.cueAngle=cue=>{
    const part=ctx.zoneParts(new Date(Number(cue.dueAt)||Date.now()),ctx.prefs.timeZone);
    return((part.hour%12)*30)+(part.minute*.5)+(part.second/120);
  };
  ctx.bindCueGesture=(node,cue,{stop=false}={})=>{
    let timer=0,longPressed=false;
    const cancel=()=>{clearTimeout(timer);timer=0};
    node.addEventListener('pointerdown',()=>{
      cancel();longPressed=false;
      timer=setTimeout(()=>{longPressed=true;ctx.snoozeCues(10)},600);
    });
    node.addEventListener('pointerup',cancel);
    node.addEventListener('pointercancel',cancel);
    node.addEventListener('pointerleave',cancel);
    node.addEventListener('click',event=>{
      if(stop)event.stopPropagation();
      if(longPressed){event.preventDefault();longPressed=false;return}
      ctx.acknowledgeCue(cue);ctx.toast(`${ctx.clockCueCopy(cue).label} cleared`);
    });
    node.addEventListener('contextmenu',event=>{
      event.preventDefault();if(stop)event.stopPropagation();ctx.snoozeCues(10);
    });
  };

  ctx.computeCues=(now=new Date())=>{
    const range=ctx.workRange(ctx.prefs,now);
    const part=ctx.zoneParts(now,ctx.prefs.timeZone);
    const decimal=part.hour+part.minute/60;
    const within=range.activeDay&&decimal>=range.start&&decimal<=range.end;
    if(Date.now()<Number(ctx.cueState.snoozeUntil||0))return[];

    const cues=[];
    const schedule=ctx.getSchedule(now);
    for(const item of schedule.today){
      if(!item.alert)continue;
      const minutes=(now-item.date)/60000;
      const key=`prayer:${ctx.todayKey(item.date)}:${item.id}`;
      if(minutes>=0&&minutes<=20&&!ctx.cueState.ack[key]){
        cues.push({source:'prayer',key,label:item.label,detail:`${item.label} · ${ctx.formatTime(item.date)}`,priority:100,dueAt:item.date.getTime()});
      }
    }

    const add=(source,key,label,detail,priority,dueAt=Date.now())=>{
      if(!ctx.cueState.ack[key])cues.push({source,key,label,detail,priority,dueAt});
    };
    const prep=ctx.timerState('prep',ctx.prefs.prepMinutes);
    const away=ctx.timerState('away',ctx.prefs.awayMinutes);
    const meal=ctx.timerState('meal',ctx.prefs.mealMinutes);
    if(prep.done)add('prep',`prep:${prep.start}`,'Preparation ready','Your preparation timer is complete',90,prep.start+prep.duration);
    if(away.done)add('away',`away:${away.start}`,'Return when ready','The away timer is complete',76,away.start+away.duration);
    if(meal.done)add('meal',`meal:${meal.start}`,'Meal window complete','Return when you are ready',80,meal.start+meal.duration);

    if(within){
      const workStart=ctx.zonedForToday(range.start,now).getTime();
      const water=Number(ctx.prefs.waterOz??ctx.prefs.waterSips)||0;
      const lastWater=Number(ctx.prefs.waterLastAt)||workStart;
      if(water<ctx.prefs.waterTarget&&Date.now()-lastWater>=ctx.prefs.waterCadence*60000){
        add('water',`water:${ctx.todayKey(now)}:${Math.floor((Date.now()-workStart)/Math.max(1,ctx.prefs.waterCadence*60000))}`,'Take a sip','A small hydration reset',40,lastWater+ctx.prefs.waterCadence*60000);
      }
      if(!ctx.prefs.quietMode){
        const lastEyes=Number(ctx.prefs.gazeLastCompleted)||workStart;
        const lastMove=Number(ctx.prefs.bodyLastCompleted)||workStart;
        if(Date.now()-lastEyes>=ctx.prefs.eyeCadence*60000){
          add('eyes',`eyes:${ctx.todayKey(now)}:${Math.floor(Date.now()/(ctx.prefs.eyeCadence*60000))}`,'Look far','A 20-second distance look',35,lastEyes+ctx.prefs.eyeCadence*60000);
        }
        if(Date.now()-lastMove>=ctx.prefs.bodyCadence*60000){
          add('move',`move:${ctx.todayKey(now)}:${Math.floor(Date.now()/(ctx.prefs.bodyCadence*60000))}`,'Change position','A short movement reset',38,lastMove+ctx.prefs.bodyCadence*60000);
        }
      }
    }
    return cues.sort((a,b)=>b.priority-a.priority);
  };

  ctx.renderClockCueRing=()=>{
    const ring=id('clock-cue-ring');
    if(!ring)return;
    ring.replaceChildren();
    for(const cue of ctx.currentCues.slice(0,7)){
      const spoke=el('span','clock-cue-spoke');
      spoke.style.setProperty('--cue-angle',`${ctx.cueAngle(cue)}deg`);
      const copy=ctx.clockCueCopy(cue);
      const notch=button('clock-cue-notch',`Clear ${copy.label}`);
      notch.style.setProperty('--cue',ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus);
      if(cue.source!=='prayer'||ctx.clockNamesVisible?.())notch.title=`${cue.label} · right-click to snooze`;
      ctx.bindCueGesture(notch,cue);
      spoke.append(notch);ring.append(spoke);
    }
  };

  ctx.renderClockCuePanel=()=>{
    const panel=id('clock-cue-panel'),list=id('clock-cue-list'),count=id('clock-cue-count');
    if(!panel||!list||!count)return;
    panel.hidden=!ctx.currentCues.length;
    count.textContent=String(ctx.currentCues.length);
    list.replaceChildren();
    for(const cue of ctx.currentCues){
      const copy=ctx.clockCueCopy(cue);
      const row=el('article','clock-cue-row');
      row.style.setProperty('--cue',ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus);
      const dot=el('i');
      const text=el('span');text.append(el('strong','',copy.label),el('small','',copy.detail));
      const clear=button('',`Clear ${copy.label}`,'Clear');
      clear.addEventListener('click',()=>{ctx.acknowledgeCue(cue);ctx.toast(`${copy.label} cleared`)});
      row.append(dot,text,clear);list.append(row);
    }
  };

  ctx.refreshCues=(notify=false)=>{
    ctx.currentCues=ctx.computeCues();
    const cluster=id('cue-cluster');
    if(cluster){
      cluster.replaceChildren();
      const named=ctx.clockNamesVisible?.()??true;
      if(!ctx.currentCues.length){
        const anchor=el('i','cue-anchor');anchor.setAttribute('aria-hidden','true');cluster.append(anchor);
      }
      for(const cue of ctx.currentCues.slice(0,7)){
        const dot=el('i','cue-dot');
        dot.style.setProperty('--cue',ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus);
        if(named||cue.source!=='prayer')dot.title=cue.label;
        ctx.bindCueGesture(dot,cue,{stop:true});
        cluster.append(dot);
      }
      const visibleLabels=ctx.currentCues.map(cue=>(named||cue.source!=='prayer')?cue.label:'Scheduled moment');
      cluster.setAttribute('aria-label',ctx.currentCues.length?`Waiting cues: ${visibleLabels.join(', ')}`:'No waiting cues');
    }
    ctx.renderClockCueRing();
    ctx.renderClockCuePanel();
    ctx.renderCuePanel?.();
    ctx.updateFaviconAndBadge();
    if(notify)void ctx.deliverNotification(ctx.currentCues[0]);
  };

  ctx.renderCuePanel=()=>{
    const list=id('now-cue-list');
    const count=id('now-cue-count');
    const guidance=id('now-guidance');
    const clear=id('now-clear-cue');
    const snooze=id('now-snooze');
    if(!list)return;
    list.replaceChildren();
    count.textContent=ctx.currentCues.length?`${ctx.currentCues.length} waiting`:'Nothing waiting';
    clear.disabled=!ctx.currentCues.length;
    snooze.disabled=!ctx.currentCues.length;
    if(!ctx.currentCues.length){
      const empty=el('div','cue-empty');
      empty.append(el('strong','','All clear'),el('span','','Pacefold will place the next quiet dot here.'));
      list.append(empty);
      guidance.textContent='The day is clear. Keep your current pace.';
      return;
    }
    const lead=ctx.currentCues[0];
    guidance.textContent=`${lead.label}. ${lead.detail}.`;
    for(const cue of ctx.currentCues){
      const row=el('article','cue-row');
      const dot=el('i');
      const copy=el('span');
      const remove=button('',`Clear ${cue.label}`,'Clear');
      row.style.setProperty('--cue',ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus);
      copy.append(el('strong','',cue.label),el('small','',cue.detail));
      remove.addEventListener('click',()=>{ctx.acknowledgeCue(cue);ctx.toast(`${cue.label} cleared`)});
      row.append(dot,copy,remove);
      list.append(row);
    }
  };

  ctx.deliverNotification=async cue=>{
    if(!cue||!ctx.prefs.notifications||(ctx.prefs.quietMode&&['water','eyes','move'].includes(cue.source)))return;
    if(!('Notification'in window)||Notification.permission!=='granted'||ctx.cueState.notified[cue.key])return;
    try{
      const registration=await navigator.serviceWorker?.ready;
      const iconName=ICON_NAMES[cue.source];
      await registration?.showNotification?.(cue.label,{
        body:cue.detail,
        tag:`pacefold-${cue.source}`,
        silent:true,
        renotify:false,
        requireInteraction:false,
        icon:iconName?`./icons/notify-${iconName}-128.png`:'./icons/icon-192.png',
        badge:'./icons/badge-96.png',
        data:{source:cue.source,key:cue.key},
        actions:[{action:'ack',title:'Clear'},{action:'snooze',title:'Snooze 10m'}]
      });
      ctx.cueState.notified[cue.key]=Date.now();
      ctx.saveCueState();
    }catch(error){console.warn('[Pacefold] notification failed',error)}
  };

  ctx.acknowledgeCue=(cue=ctx.currentCues[0])=>{
    if(!cue)return false;
    ctx.cueState.ack[cue.key]=Date.now();
    ctx.saveCueState();
    ctx.refreshCues();
    ctx.renderAll?.();
    return true;
  };

  ctx.clearAllCues=()=>{
    for(const cue of ctx.currentCues)ctx.cueState.ack[cue.key]=Date.now();
    ctx.saveCueState();
    ctx.refreshCues();
    ctx.renderAll?.();
    ctx.toast('Waiting dots cleared');
  };

  ctx.snoozeCues=(minutes=10)=>{
    ctx.cueState.snoozeUntil=Date.now()+minutes*60000;
    ctx.saveCueState();
    ctx.refreshCues();
    ctx.renderAll?.();
    ctx.toast(`Care cues snoozed for ${minutes} minutes`);
  };

  ctx.updateFaviconAndBadge=()=>{
    try{
      const canvas=document.createElement('canvas');
      canvas.width=64;canvas.height=64;
      const context=canvas.getContext('2d');
      context.fillStyle=matchMedia('(prefers-color-scheme:dark)').matches?'#e7ece7':'#18211e';
      context.translate(32,32);context.rotate(Math.PI/4);context.fillRect(-14,-14,28,28);context.rotate(-Math.PI/4);
      ctx.currentCues.slice(0,4).forEach((cue,index)=>{
        context.beginPath();context.arc(15+index%2*10,18+Math.floor(index/2)*10,4,0,Math.PI*2);
        context.fillStyle=ctx.CUE_COLORS[cue.source]||'#66716b';context.fill();
      });
      id('app-favicon').href=canvas.toDataURL('image/png');
    }catch{}
    try{
      if(ctx.currentCues.length&&'setAppBadge'in navigator)navigator.setAppBadge(ctx.currentCues.length);
      else navigator.clearAppBadge?.();
    }catch{}
  };
}

function normalizeCueState(value){
  const state=value&&typeof value==='object'?value:{};
  return{
    ack:state.ack&&typeof state.ack==='object'?state.ack:{},
    notified:state.notified&&typeof state.notified==='object'?state.notified:{},
    snoozeUntil:Number(state.snoozeUntil)||0
  };
}
