'use strict';
const fs=require('node:fs');
const file='canonical/app/pacefold-v25-preboot.js';
let src=fs.readFileSync(file,'utf8');
const old=`        set:value=>{\n          const next=String(value??'');\n          if(descriptor.get.call(document)!==next)descriptor.set.call(document,next);\n        }`;
const next=`        set:value=>{\n          let quiet=false;\n          try{\n            const prefs=JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}')||{};\n            quiet=Boolean(prefs.quietMode)||document.body?.dataset.quiet==='true'||document.getElementById('pf25Spatial-spatial-root')?.dataset.quiet==='true';\n          }catch{}\n          const next=quiet?'Clock':String(value??'');\n          if(descriptor.get.call(document)!==next)descriptor.set.call(document,next);\n        }`;
if(src.includes(old))src=src.replace(old,next);else if(!src.includes("const next=quiet?'Clock':String(value??'')"))throw new Error('Title guard anchor missing');
fs.writeFileSync(file,src);
console.log('Quiet now owns the document title at preboot');
