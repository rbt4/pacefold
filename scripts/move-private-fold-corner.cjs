'use strict';
const fs=require('node:fs');
const file='canonical/app/pacefold-v25-private.css';
let css=fs.readFileSync(file,'utf8');
const marker='Pacefold private fold corner placement r1';
if(!css.includes(marker))css+=`\n\n/* ${marker} — tuck Daybook away from the spatial down-arrow and keep it discoverable only to its owner. */\n.pf25Spatial-spatial-root[data-privacy-revision="privacy-return-r1"] .pf25Surface-fold-tray.pf25-private-daybook{left:auto!important;right:34px!important;transform:none!important}\n@media(max-width:760px){.pf25Spatial-spatial-root[data-privacy-revision="privacy-return-r1"] .pf25Surface-fold-tray.pf25-private-daybook{right:22px!important}}\n`;
fs.writeFileSync(file,css);
console.log('Moved private Daybook to discreet bottom-right fold');
