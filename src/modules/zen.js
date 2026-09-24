import{$,el,button}from'./state.js';

// Focus view: the panels fall away and the dial fills the sky. Z or a double-click
// on the dial enters it; Z, Esc or the corner button leaves. Chrome (top bar, fold
// switcher) fades after a few still seconds and returns on any movement.
const SVG='http://www.w3.org/2000/svg';
const glyph=paths=>{const svg=document.createElementNS(SVG,'svg');svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('aria-hidden','true');for(const d of paths){const p=document.createElementNS(SVG,'path');p.setAttribute('d',d);svg.append(p)}return svg};

export function installZen(ctx){
  const root=document.documentElement,wrap=$('.dial-wrap'),dial=$('.dial');
  if(!wrap||!dial)return;
  const toggle=button('zen-toggle','Focus view');toggle.setAttribute('aria-pressed','false');toggle.title='Focus view (Z)';
  const expand=glyph(['M3.5 8V3.5H8','M12 3.5h4.5V8','M16.5 12v4.5H12','M8 16.5H3.5V12']),shrink=glyph(['M8 3.5V8H3.5','M16.5 8H12V3.5','M12 16.5V12h4.5','M3.5 12H8v4.5']);
  shrink.classList.add('zen-shrink');expand.classList.add('zen-expand');
  toggle.append(expand,shrink);wrap.append(toggle);
  const hint=el('p','zen-hint','Press Z or Esc to return');wrap.append(hint);

  let idle=0;
  const wake=()=>{if(root.dataset.zen!=='on')return;root.dataset.zenIdle='false';clearTimeout(idle);idle=setTimeout(()=>{if(root.dataset.zen==='on')root.dataset.zenIdle='true'},2600)};
  const set=on=>{
    if(on===(root.dataset.zen==='on'))return;
    if(on){root.dataset.zen='on';wake()}else{delete root.dataset.zen;delete root.dataset.zenIdle;clearTimeout(idle)}
    toggle.setAttribute('aria-pressed',String(on));toggle.setAttribute('aria-label',on?'Leave focus view':'Focus view');
    // The horizon line follows the dial once it has finished growing.
    setTimeout(()=>ctx.renderDial?.(),520);
  };
  ctx.setZen=set;ctx.toggleZen=()=>set(root.dataset.zen!=='on');

  toggle.addEventListener('click',event=>{event.stopPropagation();ctx.toggleZen()});
  dial.addEventListener('dblclick',event=>{if(event.target.closest?.('.dial-cue,.moment'))return;ctx.toggleZen()});
  for(const name of['pointermove','pointerdown','keydown'])document.addEventListener(name,wake,{passive:true});

  // Capture phase, so Esc leaves focus view instead of reaching the fold handler.
  window.addEventListener('keydown',event=>{
    const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')||document.activeElement?.isContentEditable;
    if(event.key==='Escape'&&root.dataset.zen==='on'&&root.dataset.palette!=='open'&&root.dataset.weatherSheet!=='open'){event.preventDefault();event.stopImmediatePropagation();set(false);return}
    if(typing||event.metaKey||event.ctrlKey||event.altKey||root.dataset.cover==='on'||root.dataset.weatherSheet==='open'||root.dataset.palette==='open')return;
    if((event.key==='z'||event.key==='Z')&&ctx.mode==='home'){event.preventDefault();ctx.toggleZen()}
    else if(root.dataset.zen==='on'&&event.key.startsWith('Arrow'))set(false);
  },true);

  const baseGo=ctx.go;
  ctx.go=(target,options)=>{if(target!=='home')set(false);return baseGo(target,options)};
  new MutationObserver(()=>{if(root.dataset.cover==='on')set(false)}).observe(root,{attributes:true,attributeFilter:['data-cover']});
}
