import{id,el,button}from'./state.js';

const ICON_NAMES={water:'water',prayer:'prayer',prep:'prepare',away:'away',meal:'meal',eyes:'eyes',move:'move'};

export function installCues(ctx){
  ctx.cueState=normalizeCueState(ctx.cueState);

  const analog=id('analog');
  if(analog&&!id('clock-cue-ring')){
    const ring=el('div','clock-cue-ring');ring.id='clock-cue-ring';ring.setAttribute('aria-label','Waiting cues on the clock');analog.append(ring);
  }
  const clockCard=document.querySelector('.clock-card');
  if(clockCard&&!id('clock-cue-panel')){
    const panel=el('section','clock-cue-panel');panel.id='clock-cue-panel';panel.hidden=true;panel.setAttribute('aria-live','polite');
    const list=el('div','clock-cue-list');list.id='clock-cue-list';panel.append(list);clockCard.querySelector('.day-unfold')?.before(panel);
  }
  const appBar=document.querySelector('.app-bar');
  if(appBar&&!id('title-cue-strip')){
    const strip=el('div','title-cue-strip');strip.id='title-cue-strip';strip.setAttribute('aria-hidden','true');
    const segments=el('span','title-cue-segments');segments.id='title-cue-segments';const count=el('b','title-cue-count','');count.id='title-cue-count';strip.append(segments,count);appBar.append(strip);
  }

  const wco=navigator.windowControlsOverlay;
  const applyWco=()=>document.documentElement.dataset.wco=wco?.visible?'on':'off';
  if(wco&&!document.documentElement.dataset.wcoBound){document.documentElement.dataset.wcoBound='true';wco.addEventListener('geometrychange',applyWco)}
  applyWco();

  const launchUrl=new URL(location.href);
  if(launchUrl.searchParams.get('cueAction')==='snooze'){
    ctx.cueState.snoozeUntil=Date.now()+10*60*1000;ctx.persistCueState?.();launchUrl.searchParams.delete('cueAction');history.replaceState(null,'',`${launchUrl.pathname}${launchUrl.search}${launchUrl.hash}`);
  }

  ctx.saveCueState=()=>ctx.persistCueState?ctx.persistCueState():localStorage.setItem(ctx.KEYS.cueState,JSON.stringify(normalizeCueState(ctx.cueState)));
  ctx.clockCueCopy=cue=>cue.source==='prayer'&&!ctx.clockNamesVisible?.()?{label:'Scheduled moment',detail:`Due · ${ctx.formatTime(new Date(cue.dueAt||Date.now()))}`}:{label:cue.label,detail:cue.detail};
  ctx.cueAngle=cue=>{const part=ctx.zoneParts(new Date(Number(cue.dueAt)||Date.now()),ctx.prefs.timeZone);return((part.hour%12)*30)+(part.minute*.5)+(part.second/120)};
  ctx.bindCueGesture=(node,cue,{stop=false}={})=>{
    let timer=0,longPressed=false;const cancel=()=>{clearTimeout(timer);timer=0};
    node.addEventListener('pointerdown',()=>{cancel();longPressed=false;timer=setTimeout(()=>{longPressed=true;ctx.snoozeCues(10)},600)});
    node.addEventListener('pointerup',cancel);node.addEventListener('pointercancel',cancel);node.addEventListener('pointerleave',cancel);
    node.addEventListener('click',event=>{if(stop)event.stopPropagation();if(longPressed){event.preventDefault();longPressed=false;return}ctx.acknowledgeCue(cue);ctx.toast(`${ctx.clockCueCopy(cue).label} cleared`)});
    node.addEventListener('contextmenu',event=>{event.preventDefault();if(stop)event.stopPropagation();ctx.snoozeCues(10)});
  };

  ctx.computeCues=(now=new Date())=>{
    const range=ctx.workRange(ctx.prefs,now),part=ctx.zoneParts(now,ctx.prefs.timeZone),decimal=part.hour+part.minute/60,within=range.activeDay&&decimal>=range.start&&decimal<=range.end;
    if(Date.now()<Number(ctx.cueState.snoozeUntil||0))return[];
    const cues=[],schedule=ctx.getSchedule(now);
    for(const item of schedule.today){
      if(!item.alert)continue;const minutes=(now-item.date)/60000,key=`prayer:${ctx.todayKey(item.date)}:${item.id}`;
      if(minutes>=0&&minutes<=20&&!ctx.cueState.ack[key])cues.push({source:'prayer',key,label:item.label,detail:`${item.label} · ${ctx.formatTime(item.date)}`,priority:100,dueAt:item.date.getTime()});
    }
    const add=(source,key,label,detail,priority,dueAt=Date.now())=>{if(!ctx.cueState.ack[key])cues.push({source,key,label,detail,priority,dueAt})};
    const prep=ctx.timerState('prep',ctx.prefs.prepMinutes),away=ctx.timerState('away',ctx.prefs.awayMinutes),meal=ctx.timerState('meal',ctx.prefs.mealMinutes);
    if(prep.done)add('prep',`prep:${prep.start}`,'Preparation ready','Your preparation timer is complete',90,prep.start+prep.duration);
    if(away.done)add('away',`away:${away.start}`,'Return when ready','The away timer is complete',76,away.start+away.duration);
    if(meal.done)add('meal',`meal:${meal.start}`,'Meal window complete','Return when you are ready',80,meal.start+meal.duration);
    if(within){
      const workStart=ctx.zonedForToday(range.start,now).getTime(),water=Number(ctx.prefs.waterOz??ctx.prefs.waterSips)||0,lastWater=Number(ctx.prefs.waterLastAt)||workStart;
      if(water<ctx.prefs.waterTarget&&Date.now()-lastWater>=ctx.prefs.waterCadence*60000)add('water',`water:${ctx.todayKey(now)}:${Math.floor((Date.now()-workStart)/Math.max(1,ctx.prefs.waterCadence*60000))}`,'Take a sip','A small hydration reset',40,lastWater+ctx.prefs.waterCadence*60000);
      if(!ctx.prefs.quietMode){
        const lastEyes=Number(ctx.prefs.gazeLastCompleted)||workStart,lastMove=Number(ctx.prefs.bodyLastCompleted)||workStart;
        if(Date.now()-lastEyes>=ctx.prefs.eyeCadence*60000)add('eyes',`eyes:${ctx.todayKey(now)}:${Math.floor(Date.now()/(ctx.prefs.eyeCadence*60000))}`,'Look far','A 20-second distance look',35,lastEyes+ctx.prefs.eyeCadence*60000);
        if(Date.now()-lastMove>=ctx.prefs.bodyCadence*60000)add('move',`move:${ctx.todayKey(now)}:${Math.floor(Date.now()/(ctx.prefs.bodyCadence*60000))}`,'Change position','A short movement reset',38,lastMove+ctx.prefs.bodyCadence*60000);
      }
    }
    return cues.sort((a,b)=>b.priority-a.priority);
  };

  ctx.renderClockCueRing=()=>{
    const ring=id('clock-cue-ring');if(!ring)return;ring.replaceChildren();
    for(const cue of ctx.currentCues.slice(0,7)){
      const spoke=el('span','clock-cue-spoke');spoke.style.setProperty('--cue-angle',`${ctx.cueAngle(cue)}deg`);const copy=ctx.clockCueCopy(cue),notch=button('clock-cue-notch',`Clear ${copy.label}`);notch.style.setProperty('--cue',ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus);notch.dataset.source=cue.source;if(cue.source!=='prayer'||ctx.clockNamesVisible?.())notch.title=`${cue.label} · right-click to snooze`;ctx.bindCueGesture(notch,cue);spoke.append(notch);ring.append(spoke);
    }
  };

  ctx.renderClockCuePanel=()=>{
    const panel=id('clock-cue-panel'),list=id('clock-cue-list');if(!panel||!list)return;panel.hidden=!ctx.currentCues.length;list.replaceChildren();
    for(const cue of ctx.currentCues){const copy=ctx.clockCueCopy(cue),row=el('article','clock-cue-row');row.style.setProperty('--cue',ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus);const dot=el('i'),text=el('span');text.append(el('strong','',copy.label),el('small','',copy.detail));const clear=button('',`Clear ${copy.label}`,'Clear');clear.addEventListener('click',()=>{ctx.acknowledgeCue(cue);ctx.toast(`${copy.label} cleared`)});row.append(dot,text,clear);list.append(row)}
  };

  ctx.renderWindowCueChrome=()=>{
    const segments=id('title-cue-segments'),count=id('title-cue-count'),strip=id('title-cue-strip');
    if(segments){segments.replaceChildren();for(const cue of ctx.currentCues.slice(0,7)){const segment=el('i');segment.style.setProperty('--cue',ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus);segments.append(segment)}}
    if(count)count.textContent=ctx.currentCues.length?String(ctx.currentCues.length):'';if(strip)strip.dataset.active=String(Boolean(ctx.currentCues.length));document.title=ctx.currentCues.length?`Clock · ${ctx.currentCues.length}`:'Clock';
  };

  ctx.refreshCues=(notify=false)=>{
    ctx.currentCues=ctx.computeCues();const cluster=id('cue-cluster');
    if(cluster){
      cluster.replaceChildren();const named=ctx.clockNamesVisible?.()??true;if(!ctx.currentCues.length){const anchor=el('i','cue-anchor');anchor.setAttribute('aria-hidden','true');cluster.append(anchor)}
      for(const cue of ctx.currentCues.slice(0,7)){const dot=el('i','cue-dot');dot.style.setProperty('--cue',ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus);dot.dataset.source=cue.source;if(named||cue.source!=='prayer')dot.title=cue.label;ctx.bindCueGesture(dot,cue,{stop:true});cluster.append(dot)}
      const visibleLabels=ctx.currentCues.map(cue=>(named||cue.source!=='prayer')?cue.label:'Scheduled moment');cluster.setAttribute('aria-label',ctx.currentCues.length?`Waiting cues: ${visibleLabels.join(', ')}`:'No waiting cues');
    }
    ctx.renderClockCueRing();ctx.renderClockCuePanel();ctx.renderCuePanel?.();ctx.renderWindowCueChrome();ctx.updateAppBadge();ctx.syncCueMirror?.();if(notify)void ctx.deliverNotification(ctx.currentCues[0]);
  };

  ctx.renderCuePanel=()=>{
    const list=id('now-cue-list'),count=id('now-cue-count');if(!list)return;list.replaceChildren();count.textContent=ctx.currentCues.length?`${ctx.currentCues.length} waiting`:'Nothing waiting';
    if(!ctx.currentCues.length){const empty=el('div','cue-empty');empty.append(el('strong','','All clear'),el('span','','The next quiet dot will appear here.'));list.append(empty);return}
    for(const cue of ctx.currentCues){const copy=ctx.clockCueCopy(cue),row=el('article','cue-row'),dot=el('i'),text=el('span'),remove=button('',`Clear ${copy.label}`,'Clear');row.style.setProperty('--cue',ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus);text.append(el('strong','',copy.label),el('small','',copy.detail));remove.addEventListener('click',()=>{ctx.acknowledgeCue(cue);ctx.toast(`${copy.label} cleared`)});row.append(dot,text,remove);list.append(row)}
  };

  ctx.deliverNotification=async cue=>{
    if(!cue||!ctx.prefs.notifications||(ctx.prefs.quietMode&&['water','eyes','move'].includes(cue.source)))return;if(!('Notification'in window)||Notification.permission!=='granted'||ctx.cueState.notified[cue.key])return;
    try{const registration=await navigator.serviceWorker?.ready,iconName=ICON_NAMES[cue.source],copy=ctx.clockCueCopy(cue);await registration?.showNotification?.(copy.label,{body:copy.detail,tag:`pacefold-${cue.source}`,silent:true,renotify:false,requireInteraction:false,icon:iconName?`./icons/notify-${iconName}-128.png`:'./icons/icon-192.png',badge:'./icons/badge-96.png',data:{source:cue.source,key:cue.key},actions:[{action:'ack',title:'Clear'},{action:'snooze',title:'Snooze 10m'}]});ctx.cueState.notified[cue.key]=Date.now();ctx.saveCueState()}catch(error){console.warn('[Pacefold] notification failed',error)}
  };

  ctx.acknowledgeCue=(cue=ctx.currentCues[0])=>{if(!cue)return false;ctx.cueState.ack[cue.key]=Date.now();ctx.saveCueState();ctx.refreshCues();ctx.renderAll?.();return true};
  ctx.clearAllCues=()=>{for(const cue of ctx.currentCues)ctx.cueState.ack[cue.key]=Date.now();ctx.saveCueState();ctx.refreshCues();ctx.renderAll?.();ctx.toast('Waiting dots cleared')};
  ctx.snoozeCues=(minutes=10)=>{ctx.cueState.snoozeUntil=Date.now()+minutes*60000;ctx.saveCueState();ctx.refreshCues();ctx.renderAll?.();ctx.toast(`Care cues snoozed for ${minutes} minutes`)};
  ctx.updateAppBadge=()=>{try{if(ctx.currentCues.length&&'setAppBadge'in navigator)navigator.setAppBadge(ctx.currentCues.length);else navigator.clearAppBadge?.()}catch{}};
}

function normalizeCueState(value){
  const state=value&&typeof value==='object'?value:{};return{v:1,ack:state.ack&&typeof state.ack==='object'?state.ack:{},notified:state.notified&&typeof state.notified==='object'?state.notified:{},snoozeUntil:Number(state.snoozeUntil)||0};
}
