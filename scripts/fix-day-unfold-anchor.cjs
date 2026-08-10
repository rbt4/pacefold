'use strict';
const fs=require('node:fs');
const file='canonical/app/pacefold-v25-core.js';
let src=fs.readFileSync(file,'utf8');
const old="  const status=id('pf25Spatial-status');hero.insertBefore(region,status||$('.pf25Spatial-progress')||null);\n  return region;";
const next="  const status=id('pf25Spatial-status'),progress=$('.pf25Spatial-progress');const anchor=status?.parentElement===hero?status:progress?.parentElement===hero?progress:null;if(anchor)hero.insertBefore(region,anchor);else hero.append(region);\n  return region;";
if(src.includes(old))src=src.replace(old,next);else if(!src.includes("status?.parentElement===hero"))throw new Error('Day Unfold insertion anchor not found');
fs.writeFileSync(file,src);
console.log('Day Unfold now inserts only against a direct hero child');
