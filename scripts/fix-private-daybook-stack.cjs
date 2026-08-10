'use strict';
const fs=require('node:fs');
const file='canonical/app/pacefold-v25-private.css';
let css=fs.readFileSync(file,'utf8');
const marker='Pacefold private fold stacking correction r1';
if(!css.includes(marker))css+=`\n\n/* ${marker} — the tiny fold must sit above the spatial down-edge so it cannot steal Daybook clicks. */\n.pf25Spatial-spatial-root[data-privacy-revision="privacy-return-r1"] .pf25Surface-fold-tray.pf25-private-daybook{z-index:80!important}\n`;
fs.writeFileSync(file,css);
console.log('Private Daybook now owns its bottom fold hit area');
