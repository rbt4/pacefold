'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||'_site');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const source=file=>fs.readFileSync(path.resolve(file),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};

const app=read('app/index.html'),runtime=read('app/pacefold.mjs'),worker=read('service-worker.js'),css=read('app/pacefold.css');
const release=source('src/modules/release-meta.js');
assert(release.includes("RELEASE='29.1.0'")&&release.includes("REVISION='atelier-r1'"),'Canonical release metadata is wrong');
assert(app.includes('pacefold.css?v=29.1.0')&&app.includes('pacefold.mjs?v=29.1.0'),'App cache-busting identity is stale');
assert(worker.includes("VERSION='29.1.0'")&&worker.includes('atelier-r1'),'Worker cache identity is stale');
assert(!/Pacefold (?:25\.1\.0|27\.0\.0|27\.1\.0|28\.0\.0|28\.0\.1)/.test(app+runtime),'Built app exposes a stale release');
assert(css.includes('data-recovery="v28"')&&css.includes('.v28-guide'),'Unified visual bundle lost the recovery or Guided Fold shell');
assert(css.length<430000,`Visual bundle is unexpectedly large (${css.length} bytes)`);
assert(source('src/modules/start-cover.js').includes("returning&&!directView"),'Returning users no longer bypass the decorative start surface');
assert(source('scripts/build-v25.mjs').includes('const styleFiles=['),'Build returned to an accidental alphabetical CSS cascade');
console.log(JSON.stringify({release:'29.1.0',revision:'atelier-r1',cssBytes:css.length,startup:'returning users open on Clock',visualCascade:'explicit manifest'},null,2));
