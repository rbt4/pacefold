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
const style=read('src/styles/32-v31-origin.css');
const build=read('scripts/build-v25.mjs');
const worker=read('src/service-worker.js');
const shell=read('src/app/index.html');
const built=read(path.join(process.argv[2]||'_site','app','index.html'));
const builtRuntime=read(path.join(process.argv[2]||'_site','app','pacefold.mjs'));

assert(pkg.version==='31.0.0','Package release is not Pacefold 31');
for(const source of [core,build,worker,shell,built])assert(source.includes('31.0.0'),'A release surface is missing version 31.0.0');
for(const source of [core,build,worker,shell,built])assert(source.includes('origin-r1'),'A release surface is missing origin-r1');
assert(worker.includes("const VERSION='31.0.0'")&&worker.includes('`pacefold-v${VERSION}-origin-r1`'),'Service-worker cache identity was not advanced');
assert(main.includes("document.documentElement.dataset.origin='v31'"),'The V31 visual contract is not installed before startup');

assert(style.includes('Pacefold 31 — Origin'),'Origin stylesheet banner is missing');
assert(style.includes('html[data-origin="v31"] .daybook-fold{')&&style.includes('display:grid!important'),'The persistent lower Daybook is not restored');
assert(style.includes('Scenic front cover')&&style.includes('The working Clock — the object left open all day'),'Cover and working Clock are not deliberately separated');
assert(style.includes('html[data-origin="v31"] .privacy-curtain{display:none!important')&&style.includes('[data-privacy-screen="on"] .privacy-curtain{display:grid!important'),'Privacy-screen styling is not self-contained in the production bundle');
assert(style.length<300000,'Origin stylesheet exceeds the release size ceiling');

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
assert(built.length<180000,'Built app shell exceeds the size ceiling');

console.log('Pacefold 31 Origin static contract passed.');
