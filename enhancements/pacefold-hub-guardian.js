(() => {
'use strict';

const ROOT_ID='pf-hub-root';
const SETUP_SELECTORS=[
  '[data-view="setup"]','[data-screen="setup"]','[data-step="setup"]',
  '[data-onboarding]','[data-onboard-profile]','.onboarding','.onboarding-option',
  '#setup','.setup','.setup-screen','.setup-wizard'
];
let preservedRoot=null;
let frame=0;
let wasSetup=false;

function visible(element){
  if(!element?.isConnected)return false;
  const style=getComputedStyle(element);
  const box=element.getBoundingClientRect();
  return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&box.width>0&&box.height>0;
}
function setupVisible(){
  if(SETUP_SELECTORS.some(selector=>[...document.querySelectorAll(selector)].some(visible)))return true;
  return [...document.querySelectorAll('main,section,[role="dialog"]')]
    .filter(visible)
    .some(node=>/(set up pacefold|welcome to pacefold|choose your rhythm|complete setup|get started)/i.test((node.textContent||'').replace(/\s+/g,' ').slice(0,1200)));
}
function reconcile(){
  frame=0;
  const setup=setupVisible();
  const current=document.getElementById(ROOT_ID);
  if(setup){
    wasSetup=true;
    preservedRoot=null;
    current?.remove();
    document.documentElement.classList.remove('pf-hub-mounted');
    return;
  }
  if(wasSetup){
    wasSetup=false;
    preservedRoot=null;
    window.__PACEFOLD_SURFACE__?.reconcile?.();
    return;
  }
  if(current){
    preservedRoot=current;
    document.documentElement.classList.add('pf-hub-mounted');
    return;
  }
  if(preservedRoot?.isConnected)return;
  if(preservedRoot&&document.body){
    document.body.append(preservedRoot);
    document.documentElement.classList.add('pf-hub-mounted');
    return;
  }
  window.__PACEFOLD_SURFACE__?.reconcile?.();
}
function queue(){
  if(frame)return;
  frame=requestAnimationFrame(reconcile);
}

new MutationObserver(queue).observe(document.documentElement,{
  childList:true,
  subtree:true,
  attributes:true,
  attributeFilter:['class','hidden','aria-hidden','data-view','data-screen','data-step']
});
window.addEventListener('pageshow',queue);
window.addEventListener('focus',queue);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue();});
[0,100,400,1400].forEach(delay=>setTimeout(reconcile,delay));
})();
