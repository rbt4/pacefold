(()=>{
'use strict';
const RETURN_KEYS=['pacefoldOnboardedV15','pacefoldSetupDismissedV15','pacefoldPrefsV15','pacefoldPrefsV14'];
const query=new URLSearchParams(location.search);
if(query.has('setup')||query.has('legacyAudit'))return;
let returning=false;
try{returning=RETURN_KEYS.some(key=>{const value=localStorage.getItem(key);return value!=null&&value!==''&&value!=='{}'})}catch{}
if(!returning)return;
document.documentElement.dataset.pacefoldV25='booting';
window.__PACEFOLD_V25_BOOT__={returning:true,startedAt:Date.now()};
setTimeout(()=>{if(document.documentElement.dataset.pacefoldV25==='booting')document.documentElement.dataset.pacefoldV25='fallback'},8000);
window.addEventListener('pacefold:recovery-ready',()=>{
  const root=document.getElementById('pf22-spatial-root');if(!root||root.dataset.v25ModeSync==='1')return;root.dataset.v25ModeSync='1';let frame=0;
  const sync=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>window.__PACEFOLD_RECOVERY__?.refresh?.())};
  new MutationObserver(records=>{if(records.some(record=>record.attributeName==='data-mode'))sync()}).observe(root,{attributes:true,attributeFilter:['data-mode']});
},{once:true});
})();
