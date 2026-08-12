import{id,el,button}from'./state.js';

const FOLD_PATHS=`<defs><linearGradient id="g" x1="8" y1="8" x2="56" y2="56"><stop stop-color="#9FE2D0"/><stop offset="1" stop-color="#5E9EE6"/></linearGradient></defs><path fill="none" stroke="url(#g)" stroke-width="4" stroke-linejoin="round" d="M10 15 31 6l23 12-9 34-15 6L10 41Z"/><path fill="none" stroke="url(#g)" stroke-width="4" stroke-linejoin="round" d="m10 15 20 14 24-11M30 29v29m0-29L10 41m20-12 15 23"/><path fill="url(#g)" opacity=".18" d="m10 15 20 14L10 41Zm20 14 24-11-9 34Zm0 0 15 23-15 6Z"/>`;

export function installWindowCues(ctx){
  const appBar=document.querySelector('.app-bar');
  if(!appBar)return;

  const tray=el('aside','window-cues');
  tray.id='window-cues';tray.setAttribute('aria-label','Quiet window cues');tray.dataset.active='false';appBar.append(tray);
  ctx.windowCueSeen=new Set();ctx.windowCueBloomUntil=new Map();ctx.windowCuePrimed=false;ctx.windowCueTimer=0;

  ctx.cueFavicon=(cue)=>{
    const color=cue?(ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus):'';
    const dot=color?`<circle cx="51" cy="13" r="8" fill="${color}" stroke="#f6f3eb" stroke-width="4"/>`:'';
    return`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${FOLD_PATHS}${dot}</svg>`)}`;
  };

  ctx.renderCueFavicon=()=>{
    const favicon=id('app-favicon');if(!favicon)return;
    const cue=ctx.currentCues?.[0];
    favicon.href=cue?ctx.cueFavicon(cue):'./icons/fold-mark.svg';
    favicon.type='image/svg+xml';
  };

  ctx.renderWindowCues=()=>{
    const cues=ctx.currentCues||[],now=Date.now(),visible=!document.hidden;
    tray.dataset.active=String(Boolean(cues.length));
    tray.replaceChildren();
    const cluster=id('cue-cluster'),clearDots=id('clear-cues');
    if(cluster)cluster.hidden=!cues.length;
    if(clearDots)clearDots.hidden=!cues.length;

    if(!ctx.windowCuePrimed){for(const cue of cues)ctx.windowCueSeen.add(cue.key);ctx.windowCuePrimed=true}

    let nextExpiry=Infinity;
    for(const cue of cues.slice(0,4)){
      const isNew=!ctx.windowCueSeen.has(cue.key);
      if(isNew&&visible){ctx.windowCueSeen.add(cue.key);ctx.windowCueBloomUntil.set(cue.key,now+4300)}
      const bloomUntil=Number(ctx.windowCueBloomUntil.get(cue.key))||0,bloom=bloomUntil>now;
      if(bloom)nextExpiry=Math.min(nextExpiry,bloomUntil);
      const copy=ctx.clockCueCopy(cue),node=button('window-cue-bubble',`Clear ${copy.label}`),orb=el('i','window-cue-orb'),text=el('span','window-cue-copy');
      node.dataset.source=cue.source;node.dataset.bloom=String(bloom);node.style.setProperty('--cue',ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus);
      text.append(el('strong','',copy.label),el('small','',copy.detail));node.append(orb,text);
      if(cue.source!=='prayer'||ctx.clockNamesVisible?.())node.title=`${copy.label} · click to clear · hold to snooze`;
      ctx.bindCueGesture(node,cue,{stop:true});tray.append(node);
    }

    if(cues.length>4){const more=button('window-cue-more',`${cues.length-4} more waiting`,`+${cues.length-4}`);more.addEventListener('click',()=>ctx.go?.('now'));tray.append(more)}

    clearTimeout(ctx.windowCueTimer);
    if(Number.isFinite(nextExpiry))ctx.windowCueTimer=setTimeout(()=>ctx.renderWindowCues(),Math.max(80,nextExpiry-Date.now()+30));
    ctx.renderCueFavicon();
  };

  const baseChrome=ctx.renderWindowCueChrome;
  ctx.renderWindowCueChrome=()=>{
    baseChrome?.();
    document.title='Clock';
    ctx.renderWindowCues();
  };

  const baseNotification=ctx.deliverNotification;
  ctx.deliverNotification=cue=>{
    if(!document.hidden&&document.hasFocus())return Promise.resolve();
    return baseNotification?.(cue);
  };

  const showOnReturn=()=>{if(!document.hidden)ctx.renderWindowCues()};
  document.addEventListener('visibilitychange',showOnReturn);
  window.addEventListener('focus',showOnReturn);
}
