import{$,el,button}from'./state.js';

// Waiting cues as a real stack: the most important card on top, the rest peeking
// behind it. Each card is actionable on its own: its main button logs the thing
// (and the stack says when that cadence will come round again), Later puts that
// kind of cue away for a while. Cards leave by themselves when a cue is resolved
// anywhere else, expires, or is logged from a system notification, and the
// system notification is closed or refreshed to match.
const LATER_MINUTES=15;
const NEXT={water:['waterLastAt','waterCadence','next sip'],eyes:['gazeLastCompleted','eyeCadence','next distance look'],move:['bodyLastCompleted','bodyCadence','next movement']};
const DONE={water:'Water logged',eyes:'Distance look logged',move:'Movement logged',prep:'Timer closed',away:'Welcome back',meal:'Meal closed',prayer:'Moment kept'};

export function installCueStack(ctx){
  const column=$('.horizon-right');if(!column||$('.cue-stack'))return;
  const root=document.documentElement;
  const stack=el('section','cue-stack');stack.setAttribute('aria-label','Waiting cues');stack.dataset.count='0';stack.dataset.expanded='false';
  const head=el('header','cue-stack-head'),title=el('strong','','Needs you'),toggle=button('cue-stack-toggle','Show all waiting cues','Show all');
  head.append(title,toggle);
  const deck=el('div','cue-stack-deck'),note=el('p','cue-stack-note');note.setAttribute('role','status');note.setAttribute('aria-live','polite');note.hidden=true;
  stack.append(head,deck,note);column.prepend(stack);
  ctx.cueStackActive=true;root.dataset.cueStack='on';

  ctx.cueState.snoozed=ctx.cueState.snoozed&&typeof ctx.cueState.snoozed==='object'?ctx.cueState.snoozed:{};
  const baseCompute=ctx.computeCues;
  ctx.computeCues=(...args)=>{const now=Date.now(),snoozed=ctx.cueState.snoozed||{};return baseCompute(...args).filter(cue=>!(Number(snoozed[cue.source])>now))};

  const cards=new Map();let noteTimer=0;
  const say=text=>{clearTimeout(noteTimer);note.textContent=text;note.hidden=false;note.classList.remove('is-on');requestAnimationFrame(()=>note.classList.add('is-on'));noteTimer=setTimeout(()=>{note.classList.remove('is-on');setTimeout(()=>{if(!note.classList.contains('is-on'))note.hidden=true},300)},4200)};
  const since=cue=>{const due=Number(cue.dueAt)||Date.now(),minutes=Math.round((Date.now()-due)/60000);if(['prep','away','meal'].includes(cue.source))return minutes<1?'Timer done':`Done ${minutes} min ago`;return minutes<1?'Due now':minutes<60?`Due ${minutes} min ago`:`Due ${ctx.durationText(minutes*60000)} ago`};
  // What happens next, read after the log has written the new time.
  const recalculated=source=>{
    const plan=NEXT[source];if(!plan)return DONE[source]||'Done';
    const[last,cadence,label]=plan,at=Number(ctx.prefs[last])+Number(ctx.prefs[cadence])*60000;
    return Number.isFinite(at)?`${DONE[source]} · ${label} around ${ctx.formatTime(new Date(at))}`:DONE[source];
  };

  const card=cue=>{
    const copy=ctx.clockCueCopy?.(cue)||cue,node=el('article','cue-card');node.dataset.key=cue.key;node.dataset.source=cue.source;
    node.style.setProperty('--cue',ctx.CUE_COLORS?.[cue.source]||ctx.CUE_COLORS?.focus||'#9fd3bd');
    const text=el('span','cue-card-copy'),when=el('small','cue-card-when',since(cue));text.append(when,el('strong','',copy.label),el('span','',copy.detail||''));
    const actions=el('div','cue-card-actions'),label=ctx.cueActionLabel?.(cue)||'Done';
    const primary=button('cue-card-primary',`${label}: ${copy.label}`,label),later=button('cue-card-later',`Later: hide ${copy.label} for ${LATER_MINUTES} minutes`,'Later');
    primary.addEventListener('click',event=>{event.stopPropagation();node.classList.add('is-done');ctx.resolveCue?.(cue);say(recalculated(cue.source))});
    later.addEventListener('click',event=>{event.stopPropagation();ctx.cueState.snoozed[cue.source]=Date.now()+LATER_MINUTES*60000;ctx.saveCueState?.();ctx.refreshCues?.();ctx.renderAll?.();say(`${copy.label} · back around ${ctx.formatTime(new Date(Date.now()+LATER_MINUTES*60000))}`)});
    actions.append(primary,later);node.append(el('i','cue-card-dot'),text,actions);node._when=when;node._cue=cue;
    return node;
  };

  const render=()=>{
    const cues=ctx.currentCues||[],keys=new Set(cues.map(cue=>cue.key));
    // Leaving cards animate out whatever resolved them.
    for(const[key,node]of cards){if(keys.has(key))continue;cards.delete(key);node.classList.add('is-leaving');setTimeout(()=>node.remove(),340)}
    cues.forEach((cue,index)=>{
      let node=cards.get(cue.key);
      if(!node){node=card(cue);node.classList.add('is-entering');cards.set(cue.key,node);requestAnimationFrame(()=>requestAnimationFrame(()=>node.classList.remove('is-entering')))}
      else{node._cue=cue;node._when.textContent=since(cue)}
      node.style.setProperty('--i',String(index));node.dataset.depth=String(Math.min(index,3));
      node.inert=stack.dataset.expanded!=='true'&&index>0;
      deck.append(node);
    });
    for(const node of deck.querySelectorAll('.cue-card.is-leaving'))deck.append(node);
    stack.dataset.count=String(cues.length);
    title.textContent=cues.length>1?`${cues.length} need you`:'Needs you';
    toggle.hidden=cues.length<2;
    if(cues.length<2&&stack.dataset.expanded==='true')setExpanded(false);
    toggle.textContent=stack.dataset.expanded==='true'?'Stack':'Show all';
    root.dataset.cueWaiting=String(Boolean(cues.length));
    void syncSystemNotification(cues);
  };
  // Fanning out overlays the column instead of pushing the dial and keys down.
  const setExpanded=open=>{if(open&&stack.dataset.expanded!=='true')stack.style.minHeight=`${stack.offsetHeight}px`;if(!open)stack.style.removeProperty('min-height');stack.dataset.expanded=String(open);toggle.textContent=open?'Stack':'Show all';toggle.setAttribute('aria-expanded',String(open));for(const node of cards.values())node.inert=!open&&node.style.getPropertyValue('--i')!=='0'};
  toggle.addEventListener('click',()=>setExpanded(stack.dataset.expanded!=='true'));
  // Clicking the peeking cards fans the stack out.
  deck.addEventListener('click',event=>{const node=event.target.closest?.('.cue-card');if(node&&stack.dataset.expanded!=='true'&&node.style.getPropertyValue('--i')!=='0')setExpanded(true)});
  let collapseTimer=0;
  stack.addEventListener('pointerleave',()=>{clearTimeout(collapseTimer);collapseTimer=setTimeout(()=>{if(!stack.contains(document.activeElement))setExpanded(false)},1400)});
  stack.addEventListener('pointerenter',()=>clearTimeout(collapseTimer));

  // The one system notification follows the stack: gone when nothing waits, and
  // closed when the cue it announced has been resolved in the app.
  let lastKeys='';
  async function syncSystemNotification(cues){
    const signature=cues.map(cue=>cue.key).join('|');if(signature===lastKeys)return;lastKeys=signature;
    try{
      const registration=await navigator.serviceWorker?.getRegistration?.();if(!registration?.getNotifications)return;
      const open=await registration.getNotifications({tag:'clock-cue'}),current=new Set(cues.map(cue=>cue.key));
      for(const notice of open)if(!current.has(notice.data?.key))notice.close();
    }catch{}
  }

  const baseRefresh=ctx.refreshCues;
  ctx.refreshCues=(...args)=>{const result=baseRefresh?.(...args);render();return result};
  setInterval(()=>{for(const node of cards.values())if(node._cue)node._when.textContent=since(node._cue)},30000);
  render();
}
