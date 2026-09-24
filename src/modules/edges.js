import{id,el,button}from'./state.js';

// One fold switcher for every screen size: a glass segmented control centred in
// the top bar on desktop and a tab bar on phones. A light thumb slides to the
// active fold. Arrow keys and swipes still move directionally (app.js); the
// switcher shows which key goes where.
const SVG='http://www.w3.org/2000/svg';
const FOLDS=[
  {go:'notes',label:'Notes',key:'↑',icon:['M5.5 3.5h7l3 3v10h-10z','M12.5 3.5v3h3','M8 10h5','M8 13h3.5']},
  {go:'worklog',label:'Day',key:'←',icon:['M4 16.5h12','M5.5 16.5v-5','M9 16.5V6','M12.5 16.5v-7','M16 16.5V4']},
  {go:'home',label:'Clock',key:'Esc',icon:['M10 2.8a7.2 7.2 0 1 1 0 14.4a7.2 7.2 0 1 1 0-14.4z','M10 5.8V10l3 2']},
  {go:'now',label:'Now',key:'→',icon:['M10 3a7 7 0 1 1 0 14a7 7 0 1 1 0-14z','M10 6.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z','M10 9.3a.7.7 0 1 1 0 1.4a.7.7 0 1 1 0-1.4z']},
  {go:'settings',label:'Settings',key:'↓',icon:['M4 6h6','M14 6h2','M12 4v4','M4 14h2','M10 14h6','M8 12v4']}
];
const icon=paths=>{const svg=document.createElementNS(SVG,'svg');svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('aria-hidden','true');for(const d of paths){const p=document.createElementNS(SVG,'path');p.setAttribute('d',d);svg.append(p)}return svg};

export function installEdges(ctx){
  ctx.buildEdges=()=>{
    if(id('mobile-nav'))return;
    const nav=el('nav','mobile-nav fold-nav');nav.id='mobile-nav';nav.setAttribute('aria-label','Pacefold views');
    const thumb=el('i','fold-thumb');thumb.setAttribute('aria-hidden','true');nav.append(thumb);
    for(const fold of FOLDS){
      const control=button('',fold.go==='home'?'Open Clock':`Open ${fold.label}`);
      control.dataset.go=fold.go;control.title=`${fold.label} (${fold.key})`;
      control.append(icon(fold.icon),el('small','',fold.label),el('kbd','',fold.key));
      nav.append(control);
    }
    document.body.append(nav);
    const sync=()=>{const index=Math.max(0,FOLDS.findIndex(fold=>fold.go===(ctx.mode||'home')));nav.style.setProperty('--fold-index',String(index));nav.dataset.mode=ctx.mode||'home';for(const control of nav.querySelectorAll('[data-go]')){if(control.dataset.go===(ctx.mode||'home'))control.setAttribute('aria-current','page');else control.removeAttribute('aria-current')}};
    const baseRender=ctx.render;
    ctx.render=(...args)=>{const result=baseRender?.(...args);sync();return result};
    sync();
  };

  ctx.buildEdges();
}
