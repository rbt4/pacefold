'use strict';
const fs=require('node:fs');
const cssFile='enhancements/pacefold-v21-dayflow.part-04.css';
let css=fs.readFileSync(cssFile,'utf8');
const marker='/* Pacefold 21.3.1 mobile sheet correction */';
if(!css.includes(marker))css+=`\n\n${marker}\n@media(max-width:760px){\n  html.pf-v21-dayflow-active #pf-quiet-toggle{position:fixed!important;top:18px!important;right:18px!important;bottom:auto!important;left:auto!important;z-index:10040!important}\n  html.pf-v21-dayflow-active .pf21-daybook{height:auto!important;min-height:0!important}\n  html.pf-v21-dayflow-active .pf21-daybook-body{height:auto!important;min-height:0!important}\n  html.pf-v21-dayflow-active .pf21-daybook-main{min-height:0!important}\n}\n`;
fs.writeFileSync(cssFile,css);

const auditFile='enhancements/v21-audit.cjs';
let audit=fs.readFileSync(auditFile,'utf8');
const anchor="    await mobile.locator('#pf21-daybook-compose').scrollIntoViewIfNeeded();";
const replacement=`    const mobileComposition=await mobile.evaluate(()=>{const quiet=document.getElementById('pf-quiet-toggle').getBoundingClientRect(),book=document.getElementById('pf21-daybook').getBoundingClientRect();return{quiet:{top:quiet.top,right:quiet.right},bookHeight:book.height,pageHeight:document.documentElement.scrollHeight,viewport:innerWidth};});\n    assert(mobileComposition.quiet.top>=8&&mobileComposition.quiet.top<=34&&mobileComposition.quiet.right<=mobileComposition.viewport-8&&mobileComposition.bookHeight<650&&mobileComposition.pageHeight<1850,\`Mobile composition still contains drift or an empty sheet: \${JSON.stringify(mobileComposition)}\`);\n${anchor}`;
if(!audit.includes('Mobile composition still contains drift or an empty sheet')){
  if(!audit.includes(anchor))throw new Error('Mobile audit anchor is missing');
  audit=audit.replace(anchor,replacement);
  fs.writeFileSync(auditFile,audit);
}
fs.rmSync(__filename);
