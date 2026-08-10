'use strict';
const fs=require('node:fs');
const file='canonical/app/pacefold-v25-private.js';
let js=fs.readFileSync(file,'utf8');
const old="const tray=id('pf25Surface-fold-tray'),head=tray?.querySelector('.pf25Surface-fold-head'),body=tray?.querySelector('.pf25Surface-fold-body');if(!tray||!head||!body)return false;tray.classList.add('pf25-private-daybook');const legacyToggle=id('pf25-daybook-toggle');";
const next="const tray=id('pf25Surface-fold-tray'),head=tray?.querySelector('.pf25Surface-fold-head'),body=tray?.querySelector('.pf25Surface-fold-body');if(!tray||!head||!body)return false;tray.classList.add('pf25-private-daybook');const r=root();if(r&&tray.parentElement!==r)r.append(tray);const legacyToggle=id('pf25-daybook-toggle');";
if(js.includes(old))js=js.replace(old,next);else if(!js.includes("tray.parentElement!==r)r.append(tray)"))throw new Error('Private Daybook build anchor missing');
fs.writeFileSync(file,js);
console.log('Reparented private Daybook above the spatial stage');
