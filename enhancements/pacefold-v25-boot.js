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
})();
