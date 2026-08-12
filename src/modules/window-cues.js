import{id,el,button}from'./state.js';

function clockParts(timeZone){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const read=type=>Number(parts.find(part=>part.type===type)?.value)||0;return{hour:read('hour'),minute:read('minute')};
}
function point(angle,length){const radians=(angle-90)*Math.PI/180;return{x:32+Math.cos(radians)*length,y:32+Math.sin(radians)*length}}

export function installWindowCues(ctx){
  const appBar=document.querySelector('.app-bar');
  if(!appBar)return;

  const tray=el('aside','window-cues');
  tray.id='window-cues';tray.setAttribute('aria-label','Quiet window cues');tray.dataset.active='false';appBar.append(tray);
  ctx.windowCueSeen=new Set();ctx.windowCueBloomUntil=new Map();ctx.windowCuePrimed=false;ctx.windowCueTimer=0;ctx.faviconTimer=0;

  ctx.cueFavicon=cue=>{
    const{hour,minute}=clockParts(ctx.prefs.timeZone),minuteAngle=minute*6,hourAngle=(hour%12)*30+minute*.5,m=point(minuteAngle,14),h=point(hourAngle,9);
    const color=cue?(ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus):'';
    const dot=color?`<circle cx="51" cy="13" r="7" fill="${color}" stroke="#f7faf9" stroke-width="3"/>`:'';
    return`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="5" y="5" width="54" height="54" rx="18" fill="#173f45"/><circle cx="32" cy="32" r="20" fill="none" stroke="#dceee9" stroke-width="3"/><path d="M32 18v3M46 32h-3M32 46v-3M18 32h3" stroke="#8fcab7" stroke-width="2.4" stroke-linecap="round"/><path d="M32 32L${h.x.toFixed(1)} ${h.y.toFixed(1)}M32 32L${m.x.toFixed(1)} ${m.y.toFixed(1)}" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="32" r="2.5" fill="#fff"/>${dot}</svg>`)}`;
  };

  ctx.renderCueFavicon=()=>{
    const favicon=id('app-favicon');if(!favicon)return;
    favicon.href=ctx.cueFavicon(ctx.currentCues?.[0]);favicon.type='image/svg+xml';
  };

  ctx.renderWindowCues=()=>{
    const cues=ctx.currentCues||[],now=Date.now(),visible=!document.hidden;
    tray.dataset.active=String(Boolean(cues.length));tray.replaceChildren();
    const cluster=id('cue-cluster'),clearDots=id('clear-cues');if(cluster)cluster.hidden=!cues.length;if(clearDots)clearDots.hidden=!cues.length;
    if(!ctx.windowCuePrimed){for(const cue of cues)ctx.windowCueSeen.add(cue.key);ctx.windowCuePrimed=true}
    let nextExpiry=Infinity;
    for(const cue of cues.slice(0,4)){
      const isNew=!ctx.windowCueSeen.has(cue.key);if(isNew&&visible){ctx.windowCueSeen.add(cue.key);ctx.windowCueBloomUntil.set(cue.key,now+4300)}
      const bloomUntil=Number(ctx.windowCueBloomUntil.get(cue.key))||0,bloom=bloomUntil>now;if(bloom)nextExpiry=Math.min(nextExpiry,bloomUntil);
      const copy=ctx.clockCueCopy(cue),node=button('window-cue-bubble',`Clear ${copy.label}`),orb=el('i','window-cue-orb'),text=el('span','window-cue-copy');
      node.dataset.source=cue.source;node.dataset.bloom=String(bloom);node.style.setProperty('--cue',ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus);text.append(el('strong','',copy.label),el('small','',copy.detail));node.append(orb,text);
      if(cue.source!=='prayer'||ctx.clockNamesVisible?.())node.title=`${copy.label} · click to clear · hold to snooze`;ctx.bindCueGesture(node,cue,{stop:true});tray.append(node);
    }
    if(cues.length>4){const more=button('window-cue-more',`${cues.length-4} more waiting`,`+${cues.length-4}`);more.addEventListener('click',()=>ctx.go?.('now'));tray.append(more)}
    clearTimeout(ctx.windowCueTimer);if(Number.isFinite(nextExpiry))ctx.windowCueTimer=setTimeout(()=>ctx.renderWindowCues(),Math.max(80,nextExpiry-Date.now()+30));ctx.renderCueFavicon();
  };

  const baseChrome=ctx.renderWindowCueChrome;ctx.renderWindowCueChrome=()=>{baseChrome?.();document.title='Clock';ctx.renderWindowCues()};
  const baseNotification=ctx.deliverNotification;ctx.deliverNotification=cue=>{if(!document.hidden&&document.hasFocus())return Promise.resolve();return baseNotification?.(cue)};
  const showOnReturn=()=>{if(!document.hidden)ctx.renderWindowCues()};document.addEventListener('visibilitychange',showOnReturn);window.addEventListener('focus',showOnReturn);
  ctx.faviconTimer=setInterval(()=>ctx.renderCueFavicon(),30000);ctx.renderCueFavicon();
}
