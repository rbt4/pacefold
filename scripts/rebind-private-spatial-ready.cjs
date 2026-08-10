'use strict';
const fs=require('node:fs');
const file='canonical/app/pacefold-v25-private.js';
let src=fs.readFileSync(file,'utf8');
const old="function reconcile(){\n  frame=0;const r=root();if(!r)return;discreetHome();buildDaybook();syncDaybook();renderPrivateNow();quietPass();r.dataset.privacyRevision=REVISION;document.documentElement.dataset.pacefoldPrivacy=REVISION;\n}";
const next="function reconcile(){\n  frame=0;bindSpatialNavigation();const r=root();if(!r)return;discreetHome();buildDaybook();syncDaybook();renderPrivateNow();quietPass();r.dataset.privacyRevision=REVISION;document.documentElement.dataset.pacefoldPrivacy=REVISION;\n}";
if(src.includes(old))src=src.replace(old,next);else if(!src.includes('frame=0;bindSpatialNavigation();const r=root()'))throw new Error('Private reconcile anchor missing');
fs.writeFileSync(file,src);
console.log('Private spatial binding now retries until the spatial API exists');
