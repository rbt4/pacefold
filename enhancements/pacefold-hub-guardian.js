(() => {
'use strict';

const VERSION='15.7.1';
const ROOT_ID='pf-hub-root';
const SETUP_SELECTORS=[
  '[data-view="setup"]','[data-screen="setup"]','[data-step="setup"]',
  '[data-onboarding]','[data-onboard-profile]','.onboarding','.onboarding-option',
  '#setup','.setup','.setup-screen','.setup-wizard'
];
const SETUP_SELECTOR=SETUP_SELECTORS.join(',');
let preservedRoot=null;
let frame=0;
let wasSetup=false;
let setupExitTimer=0;
let setupExitEpoch=-1;
let setupEpoch=0;

function visible(element){
  if(!element?.isConnected)return false;
  const style=getComputedStyle(element);
  const box=element.getBoundingClientRect();
  return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&box.width>0&&box.height>0;
}
function setupTextPanelVisible(){
  const candidates=[...document.querySelectorAll('[role="dialog"],body>main,body>section')].filter(visible);
  return candidates.some(node=>{
    const box=node.getBoundingClientRect();
    if(box.width<280||box.height<160)return false;
    const text=(node.textContent||'').replace(/\s+/g,' ').trim().slice(0,1400);
    if(!/(set up pacefold|welcome to pacefold|choose your rhythm|complete setup)/i.test(text))return false;
    return [...node.querySelectorAll('button,[role="button"]')].some(control=>/(get started|continue|complete setup|finish|next)/i.test((control.textContent||'').trim()));
  });
}
function setupVisible(){
  if(SETUP_SELECTORS.some(selector=>[...document.querySelectorAll(selector)].some(visible)))return true;
  return setupTextPanelVisible();
}
function clearSetupExitTimer(){
  if(setupExitTimer)clearTimeout(setupExitTimer);
  setupExitTimer=0;
  setupExitEpoch=-1;
}
function removeForSetup(current){
  wasSetup=true;
  setupEpoch+=1;
  clearSetupExitTimer();
  preservedRoot=null;
  current?.remove();
  document.documentElement.classList.remove('pf-hub-mounted');
}
function maskLegacyFalsePositives(callback){
  const masked=[];
  for(const node of document.querySelectorAll('main,section,[role="dialog"]')){
    if(!visible(node)||node.closest(`#${ROOT_ID}`)||node.matches(SETUP_SELECTOR)||node.querySelector(SETUP_SELECTOR))continue;
    const text=(node.textContent||'').replace(/\s+/g,' ').trim().slice(0,1400);
    if(!/get started/i.test(text)||/(set up pacefold|welcome to pacefold|choose your rhythm|complete setup)/i.test(text))continue;
    masked.push({node,hidden:node.hidden,ariaHidden:node.getAttribute('aria-hidden')});
    node.hidden=true;
    node.setAttribute('aria-hidden','true');
  }
  try{callback();}
  finally{
    queueMicrotask(()=>{
      for(const item of masked){
        if(!item.node.isConnected)continue;
        item.node.hidden=item.hidden;
        if(item.ariaHidden==null)item.node.removeAttribute('aria-hidden');
        else item.node.setAttribute('aria-hidden',item.ariaHidden);
      }
    });
  }
}
function requestFreshSurface(){
  maskLegacyFalsePositives(()=>window.__PACEFOLD_SURFACE__?.reconcile?.());
}
function nudgeFreshSurface(epoch){
  for(const delay of [0,80,240,700,1600]){
    setTimeout(()=>{
      if(epoch!==setupEpoch||setupVisible()||document.getElementById(ROOT_ID))return;
      requestFreshSurface();
    },delay);
  }
}
function restoreAfterStableSetupExit(epoch){
  if(setupExitTimer&&setupExitEpoch===epoch)return;
  clearSetupExitTimer();
  setupExitEpoch=epoch;
  setupExitTimer=setTimeout(()=>{
    setupExitTimer=0;
    setupExitEpoch=-1;
    if(epoch!==setupEpoch||setupVisible())return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(epoch!==setupEpoch||setupVisible())return;
      wasSetup=false;
      preservedRoot=null;
      nudgeFreshSurface(epoch);
    }));
  },240);
}
function reconcile(){
  frame=0;
  const setup=setupVisible();
  const current=document.getElementById(ROOT_ID);
  if(setup){removeForSetup(current);return;}
  if(wasSetup){restoreAfterStableSetupExit(setupEpoch);return;}
  clearSetupExitTimer();
  const roots=[...document.querySelectorAll(`#${ROOT_ID}`)];
  if(roots.length>1){
    const keeper=roots[0];
    for(const duplicate of roots.slice(1))duplicate.remove();
    preservedRoot=keeper;
    document.documentElement.classList.add('pf-hub-mounted');
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
  requestFreshSurface();
}
function mutationInsideRootOnly(mutations){
  return mutations.length>0&&mutations.every(mutation=>{
    const target=mutation.target instanceof Element?mutation.target:mutation.target?.parentElement;
    if(!target?.closest?.(`#${ROOT_ID}`))return false;
    const changed=[...(mutation.addedNodes||[]),...(mutation.removedNodes||[])];
    return changed.every(node=>!(node instanceof Element)||node.id!==ROOT_ID);
  });
}
function queue(mutations=[]){
  if(mutationInsideRootOnly(mutations))return;
  if(frame)return;
  frame=requestAnimationFrame(reconcile);
}

new MutationObserver(queue).observe(document.documentElement,{
  childList:true,
  subtree:true,
  attributes:true,
  attributeFilter:['class','hidden','aria-hidden','data-view','data-screen','data-step','data-onboarding','data-onboard-profile']
});
window.addEventListener('pageshow',queue);
window.addEventListener('focus',queue);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue();});
[0,100,400,1400].forEach(delay=>setTimeout(reconcile,delay));
window.__PACEFOLD_GUARDIAN__={version:VERSION,setupVisible,reconcile};
})();
