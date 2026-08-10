'use strict';
const fs=require('node:fs');
const file='canonical/app/pacefold-v25-private.js';
let src=fs.readFileSync(file,'utf8');
const old="for(const selector of ['.pf25Spatial-face:not(.pf25Spatial-face-home)','#pf25Surface-fold-tray','#pf-local-workspace','#panel','#foldDrawer','body>main'])";
const next="for(const selector of ['.pf25Spatial-face:not(.pf25Spatial-face-home)','#pf25Surface-fold-tray','#pf-local-workspace','#pf25-root','#panel','#foldDrawer','body>main'])";
if(src.includes(old))src=src.replace(old,next);else if(!src.includes("'#pf25-root'"))throw new Error('Quiet container list anchor missing');
fs.writeFileSync(file,src);
console.log('Quiet now blanks the hidden legacy workspace root as well');
