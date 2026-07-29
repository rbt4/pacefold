'use strict';

const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(process.argv[2]||'_release');
const sourcePath=path.join(__dirname,'hub-audit.cjs');
const versionPath=path.join(root,'pacefold-hub-version.txt');
const version=fs.readFileSync(versionPath,'utf8').trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error(`Invalid Pacefold surface version: ${version}`);

const escaped=version.replace(/\./g,'\\.');
let source=fs.readFileSync(sourcePath,'utf8');
const plainMatches=(source.match(/15\.7\.0/g)||[]).length;
const escapedMatches=(source.match(/15\\\.7\\\.0/g)||[]).length;
if(!plainMatches||!escapedMatches)throw new Error(`Baseline hub audit version markers are incomplete: plain=${plainMatches}, escaped=${escapedMatches}`);
source=source.replaceAll('15.7.0',version).replaceAll('15\\.7\\.0',escaped);
const [major,minor]=version.split('.').map(Number);
if(major>15||minor>=8){
  source=source.replaceAll('notify-water.svg','notify-water.png')
    .replaceAll('notify-eyes.svg','notify-eyes.png')
    .replaceAll('notify-move.svg','notify-move.png')
    .replaceAll('notify-prayer.svg','notify-prayer.png')
    .replaceAll('notify-meal.svg','notify-meal.png')
    .replaceAll('notify-prepare.svg','notify-prepare.png')
    .replaceAll('notify-away.svg','notify-away.png');
}
const generatedHub=fs.readFileSync(path.join(root,'app','pacefold-hub.js'),'utf8');
const appShell=fs.readFileSync(path.join(root,'app','index.html'),'utf8');
if(appShell.includes('data-pacefold-v19=')){
  const legacyHosts="for(const host of ['www.youtube-nocookie.com','open.spotify.com','music.amazon.ca','graph.microsoft.com'])";
  if(!source.includes(legacyHosts))throw new Error('Baseline CSP host assertion is missing');
  source=source.replace(
    legacyHosts,
    "if(appShell.includes('graph.microsoft.com'))throw new Error('Retired Microsoft Graph endpoint remains in the V19 CSP');for(const host of ['www.youtube-nocookie.com','open.spotify.com','music.amazon.ca'])"
  );
}
if(!/\bHSSys\b/.test(generatedHub)){
  const legacy="synced.notebook!=='HSSys'";
  if(!source.includes(legacy))throw new Error('Baseline OneNote destination assertion is missing');
  source=source.replace(legacy,"synced.notebook!=='Pacefold'");
}
if(source.includes('15.7.0')||source.includes('15\\.7\\.0'))throw new Error('Version-aware hub audit substitution was incomplete');

const temporary=path.join(os.tmpdir(),`pacefold-hub-audit-${version}-${process.pid}.cjs`);
fs.writeFileSync(temporary,source);
try{
  const result=spawnSync(process.execPath,[temporary,root],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  process.exitCode=result.status??1;
}finally{
  try{fs.unlinkSync(temporary);}catch{}
}
