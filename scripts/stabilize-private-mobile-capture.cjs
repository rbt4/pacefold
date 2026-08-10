'use strict';
const fs=require('node:fs');
const file='scripts/v25-privacy-audit.cjs';
let src=fs.readFileSync(file,'utf8');
const old="await mp.evaluate(()=>window.__PACEFOLD_SPATIAL__.go('home'));await mp.locator('#pf25-private-daybook-spine').click();await mp.waitForFunction(()=>document.querySelector('#pf25Surface-fold-tray')?.dataset.privateOpen==='true');ms=await state(mp);assert(ms.overflow<=1,`Private mobile Daybook overflows by ${ms.overflow}px`);await mp.screenshot({path:path.join(artifacts,'pacefold-25-private-mobile.png'),fullPage:true});";
const next="await mp.evaluate(()=>window.__PACEFOLD_SPATIAL__.go('home'));await mp.waitForFunction(()=>{const root=document.querySelector('#pf25Spatial-spatial-root'),stage=document.querySelector('.pf25Spatial-stage');if(root?.dataset.mode!=='home'||!stage)return false;const transform=getComputedStyle(stage).transform;return transform==='none'||transform==='matrix(1, 0, 0, 1, 0, 0)'});await mp.waitForTimeout(120);await mp.locator('#pf25-private-daybook-spine').click();await mp.waitForFunction(()=>document.querySelector('#pf25Surface-fold-tray')?.dataset.privateOpen==='true');ms=await state(mp);assert(ms.mode==='home','Mobile Daybook capture is not on the settled clock face');assert(ms.overflow<=1,`Private mobile Daybook overflows by ${ms.overflow}px`);await mp.screenshot({path:path.join(artifacts,'pacefold-25-private-mobile.png'),fullPage:true});";
if(src.includes(old))src=src.replace(old,next);else if(!src.includes("Mobile Daybook capture is not on the settled clock face"))throw new Error('Mobile privacy capture anchor missing');
fs.writeFileSync(file,src);
console.log('Private mobile screenshot now waits for the clock face to settle');
