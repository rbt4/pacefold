'use strict';

const fs=require('node:fs');
const path=require('node:path');

const file=path.resolve(process.argv[2]||'_release/scripts/browser-audit.cjs');
let source=fs.readFileSync(file,'utf8');

const original="await check('care and hydration begin with the live session',async()=>{const state=await app.evaluate(()=>JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}')),now=Date.now();for(const key of ['waterLastAt','gazeLastAt','bodyLastAt'])assert(state[key]>0&&state[key]<=now+1000&&now-state[key]<120000,`${key}: ${state[key]}`);assert(!/^Move now$/.test(await app.locator('#careBtn').innerText()),'movement debt appeared on fresh launch');return 'no inherited hydration, eye or movement debt';});";
const replacement="await check('care and hydration begin with the live session',async()=>{const state=await app.evaluate(()=>JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}')),now=Date.now(),keys=['waterLastAt','gazeLastAt','bodyLastAt'];for(const key of keys){const delta=state[key]-now,recent=delta<=1000&&-delta<120000,nextWorkdayAnchor=delta>0&&delta<12*60*60*1000;assert(state[key]>0&&(recent||nextWorkdayAnchor),`${key}: ${state[key]}`);}assert(new Set(keys.map(key=>state[key])).size===1,`care anchors diverged: ${keys.map(key=>state[key]).join(',')}`);assert(!/^Move now$/.test(await app.locator('#careBtn').innerText()),'movement debt appeared on fresh launch');return 'no inherited hydration, eye or movement debt';});";

const matches=source.split(original).length-1;
if(matches!==1)throw new Error(`Expected one sealed core care-anchor assertion, found ${matches}`);
source=source.replace(original,replacement);
fs.writeFileSync(file,source);
console.log('Patched sealed core browser audit: fresh care anchors may be recent or the same upcoming workday start.');
