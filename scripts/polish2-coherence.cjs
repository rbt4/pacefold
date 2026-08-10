'use strict';
const fs=require('node:fs');
const cssPath='canonical/app/pacefold-v25-recovery.css';
let css=fs.readFileSync(cssPath,'utf8');
const marker='Pacefold 25 analog geometry correction r1';
if(!css.includes(marker)){
  css+=`\n\n/* ${marker} — keep the tick radius attached to the rendered dial and remove the obsolete instrument glow. */\n.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-instrument::before{display:none!important}\n.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-dial{--pf25-dial-size:clamp(215px,20vw,270px)!important;width:var(--pf25-dial-size)!important}\n.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-tick{transform-origin:50% calc((var(--pf25-dial-size) / 2) - 7px)!important}\n@media(max-height:820px) and (min-width:761px){.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-dial{--pf25-dial-size:190px!important}}\n@media(max-width:760px){.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-dial{--pf25-dial-size:108px!important}}\n@media(max-width:420px) and (max-height:700px){.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-dial{--pf25-dial-size:100px!important}}\n`;
  fs.writeFileSync(cssPath,css);
}
const auditPath='scripts/v25-coherence-audit.cjs';
let audit=fs.readFileSync(auditPath,'utf8');
if(!audit.includes('ticksInsideDial:')){
  audit=audit.replace("edgeFont:document.querySelector('.pf25Spatial-edge')?getComputedStyle(document.querySelector('.pf25Spatial-edge')).fontSize:null,critical:","edgeFont:document.querySelector('.pf25Spatial-edge')?getComputedStyle(document.querySelector('.pf25Spatial-edge')).fontSize:null,ticksInsideDial:(()=>{const dial=document.querySelector('#pf25Surface-dial');if(!dial)return false;const d=dial.getBoundingClientRect();return [...dial.querySelectorAll('.pf25Surface-tick')].every(node=>{const r=node.getBoundingClientRect();return r.left>=d.left-2&&r.right<=d.right+2&&r.top>=d.top-2&&r.bottom<=d.bottom+2})})(),instrumentGlow:getComputedStyle(document.querySelector('#pf25Surface-instrument'),'::before').display,critical:");
}
if(!audit.includes('Analog tick marks escape the rendered dial')){
  audit=audit.replace("assert(state.edgeFont==='0px','Spatial edge labels still crowd the canvas');","assert(state.edgeFont==='0px','Spatial edge labels still crowd the canvas');assert(state.instrumentGlow==='none','Obsolete instrument glow still renders behind the clock');assert(state.ticksInsideDial,'Analog tick marks escape the rendered dial');");
  audit=audit.replace("assert(ms.overflow<=1,`Mobile document overflows by ${ms.overflow}px`);","assert(ms.overflow<=1,`Mobile document overflows by ${ms.overflow}px`);assert(ms.instrumentGlow==='none','Mobile obsolete instrument glow still renders');assert(ms.ticksInsideDial,'Mobile analog tick marks escape the rendered dial');");
}
fs.writeFileSync(auditPath,audit);
console.log('Applied final analog geometry correction');
