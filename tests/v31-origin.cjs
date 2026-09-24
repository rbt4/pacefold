'use strict';

const fs=require('node:fs');
const path=require('node:path');
const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const pkg=JSON.parse(read('package.json'));
const core=read('src/app/core.mjs');
const main=read('src/modules/main.mjs');
const cover=read('src/modules/start-cover.js');
const guide=read('src/modules/guided-fold-v28.js');
const style=read('src/app/pacefold.css');
const build=read('scripts/build-v25.mjs');
const worker=read('src/service-worker.js');
const shell=read('src/app/index.html');
const built=read(path.join(process.argv[2]||'_site','app','index.html'));
const builtPublic=read(path.join(process.argv[2]||'_site','index.html'));
const builtRuntime=read(path.join(process.argv[2]||'_site','app','pacefold.mjs'));

assert(pkg.version==='31.0.0','Package release is not Pacefold 31');
for(const source of [core,build,worker,shell,built])assert(source.includes('31.0.0'),'A release surface is missing version 31.0.0');
for(const source of [core,build,worker,shell,built])assert(source.includes('origin-r1'),'A release surface is missing origin-r1');
assert(worker.includes("const VERSION='31.0.0'")&&worker.includes('`pacefold-v${VERSION}-origin-r1`'),'Service-worker cache identity was not advanced');
assert(main.includes("document.documentElement.dataset.origin='v31'"),'The V31 visual contract is not installed before startup');

// One authored stylesheet replaces the historical override layers.
assert(!fs.existsSync(path.join(root,'src','styles')),'The layered src/styles override stack has returned');
assert(!build.includes('styleFiles')&&!build.includes("'styles'),file"),'The build is concatenating stylesheet layers again');
assert(style.includes('Pacefold — one stylesheet'),'Single stylesheet banner is missing');
assert((style.match(/!important/g)||[]).length<=20,'The stylesheet is sliding back into !important overrides');
assert(style.length<120000,'The stylesheet exceeds the size ceiling');
assert(style.includes('.daybook-fold{')&&style.includes('.clock-note-compose'),'The persistent lower Daybook is not styled');
assert(style.includes('html[data-cover="on"] .pace-cover{')&&style.includes('.pace-cover::before'),'Cover and working Clock are not deliberately separated');
assert(style.includes('.privacy-curtain{display:none}')&&style.includes('html[data-privacy-screen="on"] .privacy-curtain{'),'Privacy-screen styling is not self-contained');
assert(style.includes('.sound-bar[data-music-open="true"]{z-index:120'),'Music must open above the scenic cover');
assert(style.includes('html:not([data-mode="home"]) .edge{display:none}'),'Folds must only show the way back to Clock');
assert(style.includes('.note-filter-chips')&&style.includes('.settings-chip>span{display:grid'),'Notes filters or settings summary lost their layout');

assert(cover.includes("ctx.setStartCover=(covered,{focus=false}={})"),'Cover focus must remain opt-in');
assert(cover.includes('ctx.setStartCover(!directView)'),'Ordinary visits must open on the scenic cover');
assert(!cover.includes('surface==='),'Legacy surface switches still control the product entrance');
assert(guide.includes("guide.dataset.state=cue?'cue':'clear'")&&guide.includes("guide.dataset.state='active'")&&guide.includes("guide.dataset.state=next?'next':'clear'"),'Guided cue states are not explicit');

for(const token of [
  "prefs:'pacefoldPrefsV15'",
  "notes:'pacefold.notebook.entries.v2'",
  "log:'pacefold.dayflow.v1'",
  "profile:'original'",
  "timeZone:'America/Toronto'",
  "method:'15'",
  "asr:'hanafi'",
  'showSeconds:true'
])assert(core.includes(token),`Continuity contract missing: ${token}`);

assert(builtRuntime.includes('clock-note-input'),'Built Clock is missing its persistent note composer');
assert(builtRuntime.includes('cover-peel')&&builtRuntime.includes('cover-return'),'Built shell is missing cover controls');
assert(builtPublic.includes('PACEFOLD 31 · ORIGIN')&&builtPublic.includes('Pacefold 31.0.0 · origin-r1'),'The public site lost the Pacefold release identity');
assert(built.length<180000,'Built app shell exceeds the size ceiling');

console.log('Pacefold 31 Origin static contract passed.');
