'use strict';
const fs=require('node:fs');
const file='canonical/app/pacefold-v25-private.css';
let css=fs.readFileSync(file,'utf8');
const marker='Pacefold private topbar hit-plane r1';
if(!css.includes(marker))css+=`\n\n/* ${marker} — visible topbar controls must sit above the sliding face hit-plane. */\n.pf25Spatial-spatial-root[data-privacy-revision="privacy-return-r1"] .pf25Spatial-stage{z-index:1!important}\n.pf25Spatial-spatial-root[data-privacy-revision="privacy-return-r1"] .pf25Spatial-topbar{z-index:100!important;pointer-events:none!important}\n.pf25Spatial-spatial-root[data-privacy-revision="privacy-return-r1"] .pf25Spatial-topbar button{position:relative!important;z-index:1!important;pointer-events:auto!important}\n`;
fs.writeFileSync(file,css);
console.log('Fixed private topbar hit plane');
