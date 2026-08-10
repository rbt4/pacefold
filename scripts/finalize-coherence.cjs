'use strict';
const fs=require('node:fs');
const cssPath='canonical/app/pacefold-v25-recovery.css';
let css=fs.readFileSync(cssPath,'utf8');
const marker='Pacefold 25 final coherence r1';
if(!css.includes(marker)){
  css+=`\n\n/* ${marker} — crisp clock depth and a Day Unfold label that follows the actual current marker. */\n.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-dial{box-shadow:0 8px 24px rgba(26,59,49,.045),inset 0 0 0 8px rgba(255,255,255,.34),inset 0 0 0 9px rgba(35,76,63,.055)!important}\n.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25-day-labels{position:relative!important;display:block!important;height:12px!important;margin-top:0!important}\n.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25-day-start,.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25-day-end,.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25-day-now{position:absolute!important;top:0!important}\n.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25-day-start{left:0!important}.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25-day-end{right:0!important}\n.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25-day-now{left:calc(var(--pf25-progress,0)*100%)!important;transform:translateX(-50%)!important;color:var(--pf25Surface-green)!important;font-weight:800!important}\n.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25-dayline[data-state="before"] .pf25-day-now{left:0!important;transform:none!important}.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25-dayline[data-state="complete"] .pf25-day-now{left:auto!important;right:0!important;transform:none!important}\n@media(max-width:760px){.pf25Spatial-spatial-root[data-recovery="recovery-r2"] .pf25Surface-dial{box-shadow:0 5px 16px rgba(26,59,49,.035),inset 0 0 0 6px rgba(255,255,255,.32),inset 0 0 0 7px rgba(35,76,63,.055)!important}}\n`;
  fs.writeFileSync(cssPath,css);
}
const jsPath='canonical/app/pacefold-v25-recovery.js';
let js=fs.readFileSync(jsPath,'utf8');
if(!js.includes("nowLabel.textContent=section.dataset.state==='before'?'Starts':section.dataset.state==='complete'?'Done':'Now'")){
  const off="if(day.type==='off'){section.dataset.state='off';section.style.setProperty('--pf25-progress','0');meta.textContent='No workday clock today';id('pf25-day-markers')?.replaceChildren();return}";
  if(!js.includes(off))throw new Error('Off-day Day Unfold anchor missing');
  js=js.replace(off,"if(day.type==='off'){section.dataset.state='off';section.style.setProperty('--pf25-progress','0');meta.textContent='No workday clock today';const nowLabel=section.querySelector('.pf25-day-now');if(nowLabel)nowLabel.textContent='';id('pf25-day-markers')?.replaceChildren();return}");
  const active="const progress=Math.max(0,Math.min(1,(hours-day.start)/Math.max(.01,day.end-day.start)));section.style.setProperty('--pf25-progress',String(progress));section.dataset.state=hours<day.start?'before':hours>day.end?'complete':'active';meta.textContent=`${day.startText}–${day.endText} · ${Math.round(progress*100)}%`;";
  if(!js.includes(active))throw new Error('Active Day Unfold anchor missing');
  js=js.replace(active,"const progress=Math.max(0,Math.min(1,(hours-day.start)/Math.max(.01,day.end-day.start)));section.style.setProperty('--pf25-progress',String(progress));section.dataset.state=hours<day.start?'before':hours>day.end?'complete':'active';const nowLabel=section.querySelector('.pf25-day-now');if(nowLabel)nowLabel.textContent=section.dataset.state==='before'?'Starts':section.dataset.state==='complete'?'Done':'Now';meta.textContent=`${day.startText}–${day.endText} · ${Math.round(progress*100)}%`;");
  fs.writeFileSync(jsPath,js);
}
const auditPath='scripts/v25-coherence-audit.cjs';
let audit=fs.readFileSync(auditPath,'utf8');
if(!audit.includes('dayNow:box('))audit=audit.replace("day:box('#pf25-dayline'),rhythm:","day:box('#pf25-dayline'),daySun:box('#pf25-dayline .pf25-day-sun'),dayNow:box('#pf25-dayline .pf25-day-now'),dayNowText:document.querySelector('#pf25-dayline .pf25-day-now')?.textContent||'',dayState:document.querySelector('#pf25-dayline')?.dataset.state||'',rhythm:");
if(!audit.includes('Day Unfold current label is detached from its marker')){
  const desktop="assert(state.ticksInsideDial,'Analog tick marks escape the rendered dial');";
  audit=audit.replace(desktop,desktop+"assert(state.dayNow&&state.daySun&&Math.abs((state.dayNow.left+state.dayNow.w/2)-(state.daySun.left+state.daySun.w/2))<18,'Day Unfold current label is detached from its marker');if(state.dayState==='complete')assert(state.dayNowText==='Done','Completed workday still labels the centre as NOW');");
  const mobile="assert(ms.ticksInsideDial,'Mobile analog tick marks escape the rendered dial');";
  audit=audit.replace(mobile,mobile+"assert(ms.dayNow&&ms.daySun&&Math.abs((ms.dayNow.left+ms.dayNow.w/2)-(ms.daySun.left+ms.daySun.w/2))<18,'Mobile Day Unfold label is detached from its marker');if(ms.dayState==='complete')assert(ms.dayNowText==='Done','Mobile completed workday still labels the centre as NOW');");
}
fs.writeFileSync(auditPath,audit);
console.log('Applied final Pacefold coherence refinements');
