'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=process.cwd(),read=file=>fs.readFileSync(path.join(root,file),'utf8'),assert=(value,message)=>{if(!value)throw new Error(message)};
const main=read('src/modules/main.mjs'),source=read('src/modules/guided-fold-v28.js'),style=read('src/app/pacefold.css'),pkg=JSON.parse(read('package.json'));
assert(main.includes("installGuidedFoldV28")&&main.includes("from'./guided-fold-v28.js'"),'Guided Fold v28 is not wired into the runtime');
for(const token of["EXPERIENCE='v28-guided-fold-r1'","v28-cue-peek","v28-cue-bloom","Care defaults","Recovery & diagnostics","Calculation & location details"])assert(source.includes(token),`Guided Fold source contract missing: ${token}`);
assert(source.includes("rename('essentials','Daily'")&&source.includes("rename('rhythm','Rhythm'")&&source.includes("rename('data','Data'"),'Settings were not collapsed to Daily / Rhythm / Data');
assert(source.includes("nav.querySelector('[data-settings-tab=\"care\"]')?.remove()")&&source.includes("nav.querySelector('[data-settings-tab=\"advanced\"]')?.remove()"),'Redundant settings tabs remain visible');
assert(source.includes('openCuePeek:openPeek')&&!source.includes('render:renderGuide,openCuePeek};'),'Guided Fold helper export can reference an undefined cue-peek function');
assert(style.includes('.v28-guide')&&style.includes('.v28-cue-peek')&&style.includes('.now-quick')&&style.includes('.v28-settings-disclosure'),'Guided Fold surfaces are not styled by the single stylesheet');
// Folds are chosen deliberately: hovering near an edge must never move the person.
assert(!source.includes('HOVER_DWELL')&&!source.includes('v28-hover-commit'),'Hover-dwell navigation has returned');
const edges=read('src/modules/edges.js');
assert(edges.includes('fold-thumb')&&!read('src/app/index.html').includes('edge-nav'),'The fold switcher must replace the edge pills');
assert(String(pkg.scripts.verify||'').includes('guided-fold-v28.cjs'),'Guided Fold static contract is not part of npm verify');
console.log('Pacefold V28 Guided Fold static contract passed.');
