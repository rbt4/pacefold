'use strict';
const fs=require('node:fs');
const file='scripts/v25-audit.cjs';
let src=fs.readFileSync(file,'utf8');
src=src.replaceAll("await page.click('#pf25-daybook-toggle')","await page.click('#pf25-daybook-toggle',{force:true})");
if(!src.includes("page.click('#pf25-daybook-toggle',{force:true})"))throw new Error('Legacy Daybook test hook not found');
fs.writeFileSync(file,src);
console.log('Updated legacy functional audit to force only the hidden compatibility hook');
