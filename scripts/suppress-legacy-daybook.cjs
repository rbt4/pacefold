'use strict';
const fs=require('node:fs');
const file='canonical/app/pacefold-v25-private.js';
let js=fs.readFileSync(file,'utf8');
if(!js.includes('function suppressLegacyDaybook(){')){
  const anchor="function daybookElements(){return{tray:id('pf25Surface-fold-tray'),toggle:id('pf25-daybook-toggle'),spine:id('pf25-private-daybook-spine'),sheet:id('pf25-private-daybook-sheet')}}\n";
  const insert=anchor+"function suppressLegacyDaybook(){const tray=id('pf25Surface-fold-tray');if(!tray)return;for(const selector of ['.pf25Surface-fold-tabs','.pf25Surface-fold-summary','.pf25Surface-fold-latest','.pf25Surface-fold-head>div'])for(const node of tray.querySelectorAll(selector)){node.hidden=true;node.setAttribute('aria-hidden','true');node.style.setProperty('display','none','important')}}\n";
  if(!js.includes(anchor))throw new Error('Daybook elements anchor missing');
  js=js.replace(anchor,insert);
}
const buildAnchor="const tray=id('pf25Surface-fold-tray'),head=tray?.querySelector('.pf25Surface-fold-head'),body=tray?.querySelector('.pf25Surface-fold-body');if(!tray||!head||!body)return false;tray.classList.add('pf25-private-daybook');const r=root();if(r&&tray.parentElement!==r)r.append(tray);const legacyToggle=id('pf25-daybook-toggle');";
const buildNext="const tray=id('pf25Surface-fold-tray'),head=tray?.querySelector('.pf25Surface-fold-head'),body=tray?.querySelector('.pf25Surface-fold-body');if(!tray||!head||!body)return false;tray.classList.add('pf25-private-daybook');const r=root();if(r&&tray.parentElement!==r)r.append(tray);suppressLegacyDaybook();const legacyToggle=id('pf25-daybook-toggle');";
if(js.includes(buildAnchor))js=js.replace(buildAnchor,buildNext);else if(!js.includes('r.append(tray);suppressLegacyDaybook();'))throw new Error('Daybook build suppression anchor missing');
const syncAnchor="function syncDaybook(){\n  if(!buildDaybook())return;const {tray,sheet}=daybookElements(),open=tray?.dataset.open==='true';";
const syncNext="function syncDaybook(){\n  if(!buildDaybook())return;suppressLegacyDaybook();const {tray,sheet}=daybookElements(),open=tray?.dataset.open==='true';";
if(js.includes(syncAnchor))js=js.replace(syncAnchor,syncNext);else if(!js.includes('if(!buildDaybook())return;suppressLegacyDaybook();'))throw new Error('Daybook sync suppression anchor missing');
fs.writeFileSync(file,js);
console.log('Permanently suppressed legacy Daybook launcher surfaces');
