'use strict';
const fs=require('node:fs');
const cssPath='canonical/app/pacefold-v25-recovery.css';
let css=fs.readFileSync(cssPath,'utf8');
const marker='Pacefold 25 coherence visual polish r1';
if(!css.includes(marker)){
  css+=`\n\n/* ${marker} — remove the unintended backdrop shape and give the mobile analog ring breathing room. */\n.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Spatial-clock-hero::before{display:none!important}\n@media(max-width:760px){.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-instrument{grid-template-columns:126px minmax(0,1fr)!important;gap:9px!important;padding:8px 8px 7px 14px!important;margin-bottom:4px!important}.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-dial-wrap{justify-self:center!important;overflow:visible!important}.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-dial{width:108px!important}.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-clock-copy .pf25Spatial-time-main{font-size:clamp(54px,16vw,66px)!important}}\n@media(max-width:420px) and (max-height:700px){.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-instrument{grid-template-columns:116px minmax(0,1fr)!important;padding-left:12px!important}.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-dial{width:100px!important}}\n`;
  fs.writeFileSync(cssPath,css);
}
const auditPath='scripts/v25-coherence-audit.cjs';
let audit=fs.readFileSync(auditPath,'utf8');
if(!audit.includes("dialWrap:box('.pf25Surface-dial-wrap')"))audit=audit.replace("dial:box('#pf25Surface-dial'),copy:","dial:box('#pf25Surface-dial'),dialWrap:box('.pf25Surface-dial-wrap'),copy:");
if(!audit.includes('Mobile analog tick ring is clipped'))audit=audit.replace("assert(ms.tray&&ms.tray.left>=-1&&ms.tray.right<=ms.vw+1&&ms.tray.bottom<=ms.vh+1,'Mobile Daybook spine is clipped');","assert(ms.tray&&ms.tray.left>=-1&&ms.tray.right<=ms.vw+1&&ms.tray.bottom<=ms.vh+1,'Mobile Daybook spine is clipped');assert(ms.dialWrap&&ms.dialWrap.left>=6&&ms.dialWrap.right<=ms.vw-6,'Mobile analog tick ring is clipped');");
fs.writeFileSync(auditPath,audit);
console.log('Applied final Pacefold coherence visual polish');
