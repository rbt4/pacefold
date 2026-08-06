(()=>{
'use strict';
const RELEASE='23.0.0';
const REVISION='experience-r1';
const HTML=document.documentElement;
const FLAGS=['pacefoldOnboardedV15','pacefoldSetupDismissedV15','pacefoldOnboardedV14','pacefoldSetupDismissedV14'];
const PREF_KEYS=['pacefoldPrefsV15','pacefoldPrefsV14','pacefoldPrefsV13','pacefoldPrefsV12','pacefoldPrefsV11','desklinePrefsV8','desklinePrefs','quietClockPrefs'];
const has=value=>{try{return localStorage.getItem(value)!=null}catch{return false}};
const returning=FLAGS.some(key=>{try{return localStorage.getItem(key)==='1'}catch{return false}})||PREF_KEYS.some(has);
let observer=null,released=false;
function publish(){
  const current=window.__PACEFOLD_V21_BOOT__||{};
  window.__PACEFOLD_V21_BOOT__={...current,release:current.release||RELEASE,returning:returning||Boolean(current.returning),bootstrap:REVISION};
  window.__PACEFOLD_BOOTSTRAP__={release:RELEASE,revision:REVISION,returning};
}
function hold(){
  if(!returning||released)return;
  const root=document.getElementById('pf22-spatial-root');
  if(root){
    released=true;
    HTML.dataset.pacefoldSpatial='ready';
    HTML.classList.remove('pf23-boot-hold');
    observer?.disconnect();
    return;
  }
  if(HTML.dataset.pacefoldSpatial!=='pending')HTML.dataset.pacefoldSpatial='pending';
  HTML.classList.add('pf23-returning','pf23-boot-hold');
  publish();
}
publish();
if(returning){
  HTML.classList.add('pf23-returning','pf23-boot-hold');
  HTML.dataset.pacefoldSpatial='pending';
  observer=new MutationObserver(hold);
  observer.observe(HTML,{attributes:true,attributeFilter:['data-pacefold-spatial'],childList:true,subtree:true});
  window.addEventListener('pacefold:spatial-ready',hold,{once:true});
  document.addEventListener('DOMContentLoaded',hold,{once:true});
  queueMicrotask(hold);
}
})();
