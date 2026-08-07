(()=>{
'use strict';
const RELEASE='23.0.0';
const REVISION='complete-stabilization-r6';
let panelObserver=null,stateObserver=null,stateRoot=null,frame=0;
const id=value=>document.getElementById(value);
const currentRelease=()=>window.__PACEFOLD_UNIFIED__?.release||window.__PACEFOLD_RHYTHM__?.release||RELEASE;

function stamp(){
  const release=currentRelease();
  window.__PACEFOLD_ACTIVE_RELEASE__=release;
  if(document.documentElement.dataset.pacefoldExperience!==release)document.documentElement.dataset.pacefoldExperience=release;
  if(document.body?.dataset.pacefoldExperience!==release)document.body.dataset.pacefoldExperience=release;
  const root=id('pf22-spatial-root');if(root){if(root.dataset.release!==release)root.dataset.release=release;if(root.dataset.stability!==REVISION)root.dataset.stability=REVISION}
  const version=document.querySelector('.pf22-version'),versionCopy=`Pacefold ${release} · private local engine`;if(version&&version.textContent!==versionCopy)version.textContent=versionCopy;
  if(window.__PACEFOLD_SPATIAL__&&window.__PACEFOLD_SPATIAL__.release!==release)window.__PACEFOLD_SPATIAL__.release=release;
  if(window.__PACEFOLD_HARDENING__&&window.__PACEFOLD_HARDENING__.release!==release)window.__PACEFOLD_HARDENING__.release=release;
  window.__PACEFOLD_VERSION__={...(window.__PACEFOLD_VERSION__||{}),experience:release,update:release,stability:REVISION};
}
function releaseDrifted(){
  const release=currentRelease(),root=id('pf22-spatial-root');
  return document.documentElement.dataset.pacefoldExperience!==release||document.body?.dataset.pacefoldExperience!==release||Boolean(root&&root.dataset.release!==release);
}
function observeReleaseTruth(){
  const root=id('pf22-spatial-root');if(stateObserver&&stateRoot===root)return;
  stateObserver?.disconnect();stateRoot=root;stateObserver=new MutationObserver(()=>{if(releaseDrifted())queue()});
  stateObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-pacefold-experience']});
  if(document.body)stateObserver.observe(document.body,{attributes:true,attributeFilter:['data-pacefold-experience']});
  if(root)stateObserver.observe(root,{attributes:true,attributeFilter:['data-release']});
}
function reconcilePanel(){
  const panel=id('panel'),visible=Boolean(panel?.classList.contains('on'));
  document.documentElement.classList.toggle('pf22-legacy-dialog-open',visible);
}
function finishControls(){
  for(const control of document.querySelectorAll('.pf22-ritual')){
    const name=control.textContent.trim()||control.dataset.ritual||'rhythm';
    control.setAttribute('aria-label',`${name} control`);
    control.setAttribute('aria-pressed',String(control.dataset.active==='true'));
  }
  const dial=document.querySelector('.pf23-seconds-dial');if(dial)dial.title='Seconds';
}
function reconcile(){frame=0;stamp();observeReleaseTruth();reconcilePanel();finishControls()}
function queue(){if(!frame)frame=requestAnimationFrame(reconcile)}
function initialize(){
  if(new URLSearchParams(location.search).has('legacyAudit'))return;
  stamp();reconcile();window.__PACEFOLD_HARDENING__?.sync?.();window.__PACEFOLD_DAYLIGHT__?.refresh?.();
  const panel=id('panel');if(panel){panelObserver=new MutationObserver(queue);panelObserver.observe(panel,{attributes:true,attributeFilter:['class','hidden','aria-hidden']})}
  for(const event of ['pacefold:spatial-ready','pacefold:ma-prefs','pacefold:storage-changed','pacefold:quiet','pacefold:daylight-ready'])window.addEventListener(event,queue);
  document.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('#panel [data-action="close"],#panel .close'))requestAnimationFrame(reconcilePanel)},true);
  window.__PACEFOLD_V23__={release:currentRelease(),revision:REVISION,reconcile};
  window.dispatchEvent(new CustomEvent('pacefold:v23-ready',{detail:{release:currentRelease(),revision:REVISION}}));
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',initialize,{once:true}):initialize();
})();
