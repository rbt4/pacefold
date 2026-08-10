(()=>{
'use strict';
const RETURN_KEYS=['pacefoldOnboardedV15','pacefoldSetupDismissedV15','pacefoldPrefsV15','pacefoldPrefsV14'];
const VERSION_LABEL='Pacefold 25.0.0 · private local';
const TITLE='Pacefold — Quiet Workday Rhythm';
const query=new URLSearchParams(location.search);
if(query.has('setup')||query.has('legacyAudit'))return;
let returning=false;
try{returning=RETURN_KEYS.some(key=>{const value=localStorage.getItem(key);return value!=null&&value!==''&&value!=='{}'})}catch{}
if(!returning)return;
document.documentElement.dataset.pacefoldV25='booting';
window.__PACEFOLD_V25_BOOT__={returning:true,startedAt:Date.now()};
setTimeout(()=>{if(document.documentElement.dataset.pacefoldV25==='booting')document.documentElement.dataset.pacefoldV25='fallback'},8000);
window.addEventListener('pacefold:recovery-ready',()=>{
  const root=document.getElementById('pf25Spatial-spatial-root');if(!root||root.dataset.v25ModeSync==='1')return;root.dataset.v25ModeSync='1';let frame=0;
  const syncTitle=()=>{if(document.title!==TITLE)document.title=TITLE};
  const syncVersion=()=>{for(const node of document.querySelectorAll('.pf25Spatial-version'))if(node.textContent!==VERSION_LABEL)node.textContent=VERSION_LABEL};
  const sync=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{window.__PACEFOLD_RECOVERY__?.refresh?.();syncVersion();syncTitle()})};
  new MutationObserver(records=>{if(records.some(record=>record.attributeName==='data-mode'))sync()}).observe(root,{attributes:true,attributeFilter:['data-mode']});
  const versionObserver=new MutationObserver(()=>syncVersion());
  for(const node of document.querySelectorAll('.pf25Spatial-version'))versionObserver.observe(node,{childList:true,characterData:true,subtree:true});
  const titleNode=document.querySelector('title');
  if(titleNode)new MutationObserver(()=>syncTitle()).observe(titleNode,{childList:true,characterData:true,subtree:true});
  syncVersion();syncTitle();
},{once:true});
})();
