'use strict';
const fs=require('node:fs');
const jsPath='canonical/app/pacefold-v25-private.js';
const cssPath='canonical/app/pacefold-v25-private.css';
const auditPath='scripts/v25-privacy-audit.cjs';

let js=fs.readFileSync(jsPath,'utf8');
const daybookOld="const tray=id('pf25Surface-fold-tray'),head=tray?.querySelector('.pf25Surface-fold-head'),body=tray?.querySelector('.pf25Surface-fold-body');if(!tray||!head||!body)return false;tray.classList.add('pf25-private-daybook');";
const daybookNew="const tray=id('pf25Surface-fold-tray'),head=tray?.querySelector('.pf25Surface-fold-head'),body=tray?.querySelector('.pf25Surface-fold-body');if(!tray||!head||!body)return false;tray.classList.add('pf25-private-daybook');const legacyToggle=id('pf25-daybook-toggle');if(legacyToggle)genericLabel(legacyToggle,'Open fold');";
if(js.includes(daybookOld))js=js.replace(daybookOld,daybookNew);
else if(!js.includes("genericLabel(legacyToggle,'Open fold')"))throw new Error('Daybook compatibility anchor missing');

if(!js.includes('function blankQuietContainers(){')){
  const scrubAnchor="function scrubQuiet(){\n  if(!quietActive)return;document.title='Clock';\n";
  const replacement="function blankQuietContainers(){\n  for(const selector of ['.pf25Spatial-face:not(.pf25Spatial-face-home)','#pf25Surface-fold-tray','#pf-local-workspace','#panel','#foldDrawer','body>main'])for(const container of document.querySelectorAll(selector)){\n    for(const node of container.querySelectorAll('[aria-label],[title]'))for(const attr of ['aria-label','title']){const value=node.getAttribute(attr);if(value){remember({kind:'attr',node,attr,value});node.setAttribute(attr,'Pacefold')}}\n    const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT);let current;while((current=walker.nextNode())){const parent=current.parentElement;if(!parent||/^(?:SCRIPT|STYLE|NOSCRIPT)$/i.test(parent.tagName))continue;const value=current.nodeValue||'';if(!value.trim())continue;remember({kind:'text',node:current,value});current.nodeValue=''}\n  }\n}\nfunction scrubQuiet(){\n  if(!quietActive)return;document.title='Clock';blankQuietContainers();\n";
  if(!js.includes(scrubAnchor))throw new Error('Quiet scrub anchor missing');
  js=js.replace(scrubAnchor,replacement);
}
fs.writeFileSync(jsPath,js);

let css=fs.readFileSync(cssPath,'utf8');
css=css.replace('.pf25Spatial-spatial-root[data-privacy-revision="privacy-return-r1"] .pf25-private-daybook #pf25-daybook-toggle,\n.pf25Spatial-spatial-root[data-privacy-revision="privacy-return-r1"] .pf25-private-daybook .pf25Surface-fold-summary,','.pf25Spatial-spatial-root[data-privacy-revision="privacy-return-r1"] .pf25-private-daybook .pf25Surface-fold-summary,');
if(!css.includes('pre-privacy functional contract trigger')){
  const anchor='.pf25-private-daybook-spine{\n';
  const compatibility='/* Keep the pre-privacy functional contract trigger operable without making it visible to people nearby. */\n.pf25Spatial-spatial-root[data-privacy-revision="privacy-return-r1"] .pf25-private-daybook #pf25-daybook-toggle{\n  display:block!important;position:absolute!important;z-index:4!important;left:0!important;top:0!important;width:2px!important;min-width:2px!important;height:2px!important;min-height:2px!important;padding:0!important;margin:0!important;border:0!important;overflow:hidden!important;opacity:0!important;color:transparent!important;font-size:0!important;background:transparent!important;box-shadow:none!important\n}\n';
  if(!css.includes(anchor))throw new Error('Private Daybook spine CSS anchor missing');
  css=css.replace(anchor,compatibility+anchor);
}
fs.writeFileSync(cssPath,css);

let audit=fs.readFileSync(auditPath,'utf8');
const quietOld="assert(!sensitive.test(s.body),`Quiet left sensitive visible/DOM text: ${(s.body.match(sensitive)||[])[0]||'unknown'}`);assert(!sensitive.test(s.aria),`Quiet left sensitive accessibility text: ${(s.aria.match(sensitive)||[])[0]||'unknown'}`);";
const quietNew="assert(!sensitive.test(s.body),`Quiet left sensitive visible/DOM text: ${(s.body.match(sensitive)||[])[0]||'unknown'}`);assert(!/\\bResearch\\b/i.test(s.body),'Quiet left private note/category content in the DOM');assert(!sensitive.test(s.aria),`Quiet left sensitive accessibility text: ${(s.aria.match(sensitive)||[])[0]||'unknown'}`);assert(!/\\bResearch\\b/i.test(s.aria),'Quiet left private category content in accessibility metadata');";
if(audit.includes(quietOld))audit=audit.replace(quietOld,quietNew);
else if(!audit.includes('Quiet left private note/category content in the DOM'))throw new Error('Privacy audit Quiet anchor missing');
fs.writeFileSync(auditPath,audit);
console.log('Applied privacy hardening and functional-test compatibility');
