'use strict';

const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const sourceFile=path.join(__dirname,'v22-daylight-audit.cjs');
const temporary=path.join(os.tmpdir(),`pacefold-v22-daylight-audit-${process.pid}.cjs`);
let source=fs.readFileSync(sourceFile,'utf8');

const waitAnchor='await page.waitForTimeout(500);';
if(!source.includes(waitAnchor))throw new Error('The Day Unfold reconciliation wait anchor changed.');
source=source.replace(waitAnchor,'await page.waitForTimeout(1100);');

const assetsAnchor="for(const asset of ['pacefold-v22-boot.css','pacefold-v22-daylight.css','pacefold-v22-daylight-settings.css','pacefold-v22-daylight.js']){";
const assetsReplacement="for(const asset of ['pacefold-v22-boot.css','pacefold-v22-daylight.css','pacefold-v22-daylight-settings.css','pacefold-v22-cues.js','pacefold-v22-daylight.js']){";
if(!source.includes(assetsAnchor))throw new Error('The Day Unfold asset audit anchor changed.');
source=source.replace(assetsAnchor,assetsReplacement);

const startupAnchor="await wait(page,'Daylight startup',()=>window.__PACEFOLD_DAYLIGHT__?.release==='22.0.2'&&window.__PACEFOLD_HARDENING__?.release==='22.0.2'&&document.documentElement.dataset.pacefoldSpatial==='ready');";
const startupReplacement="await wait(page,'Daylight startup',()=>window.__PACEFOLD_DAYLIGHT__?.release==='22.0.2'&&window.__PACEFOLD_CUES__?.release==='22.0.2'&&window.__PACEFOLD_HARDENING__?.release==='22.0.2'&&document.documentElement.dataset.pacefoldSpatial==='ready');";
if(!source.includes(startupAnchor))throw new Error('The cue queue startup audit anchor changed.');
source=source.replace(startupAnchor,startupReplacement);

const cueAnchor=`    await page.evaluate(()=>{
      window.__PACEFOLD_MA_CORE__.updatePrefs({waitingCue:{key:'audit-prayer',source:'prayer',requestedAt:Date.now(),expiresAt:Date.now()+600000,deferred:false},taskbarBadge:true,taskbarBadgeMode:'due',notifications:true,notificationMode:'quiet'});
      const water=document.getElementById('waterBtn')||document.getElementById('waterPill');if(water)water.classList.add('due');
      window.dispatchEvent(new CustomEvent('pacefold:ma-prefs'));window.__PACEFOLD_DAYLIGHT__.refresh();
    });`;
const cueReplacement=`    await page.evaluate(()=>{
      window.__PACEFOLD_MA_CORE__.updatePrefs({taskbarBadge:true,taskbarBadgeMode:'due',notifications:true,notificationMode:'quiet'});
      window.__PACEFOLD_CUES__.clear();
      window.__PACEFOLD_CUES__.add('audit-prayer','prayer',600000);
      window.__PACEFOLD_CUES__.add('audit-water','water',600000);
      window.__PACEFOLD_DAYLIGHT__.refresh();
    });`;
if(!source.includes(cueAnchor))throw new Error('The source cue audit setup anchor changed.');
source=source.replace(cueAnchor,cueReplacement);

fs.writeFileSync(temporary,source);
try{
  const result=spawnSync(process.execPath,[temporary,...process.argv.slice(2)],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  process.exitCode=result.status??1;
}finally{
  try{fs.unlinkSync(temporary)}catch{}
}
