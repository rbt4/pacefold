import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const RELEASE='22.0.2';
const BASE_RELEASE='22.0.1';
const REVISION='22.0.2';
const sourceRoot=path.dirname(fileURLToPath(import.meta.url));
const targetRoot=path.resolve(process.argv[2]||'_site');
const targetApp=path.join(targetRoot,'app');
const assets={
  boot:'pacefold-v22-boot.css',
  daylight:'pacefold-v22-daylight.css',
  settings:'pacefold-v22-daylight-settings.css',
  cues:'pacefold-v22-cues.js',
  runtime:'pacefold-v22-daylight.js'
};

function replaceExactlyOnce(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error(`Pacefold daylight ${label} anchor is missing`);
  if(source.indexOf(from,first+from.length)>=0)throw new Error(`Pacefold daylight ${label} anchor is ambiguous`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}
function replaceIfPresent(source,from,to,label){
  if(source.includes(to))return source;
  if(!source.includes(from))throw new Error(`Pacefold daylight ${label} source is missing`);
  return source.replace(from,to);
}
function updateExperienceMeta(html){
  html=html.replace(/\s*<meta\s+name=["']pacefold-experience["'][^>]*>/gi,'');
  return replaceExactlyOnce(html,'</head>',`<meta name="pacefold-experience" content="${RELEASE}">\n</head>`,'experience meta');
}
async function patchHardeningRelease(file){
  let source=await fs.readFile(file,'utf8');
  source=replaceIfPresent(source,`const RELEASE='${BASE_RELEASE}';`,`const RELEASE='${RELEASE}';`,'hardening release');
  new vm.Script(source,{filename:file});
  await fs.writeFile(file,source);
}
async function patchDayflowOwnership(file){
  let source=await fs.readFile(file,'utf8');
  source=replaceIfPresent(source,"const EXPERIENCE='22.0.0';",`const EXPERIENCE='${RELEASE}';`,'Dayflow experience ownership');
  source=replaceIfPresent(source,"const RELEASE='22.0.0';",`const RELEASE='${RELEASE}';`,'Dayflow active release');
  new vm.Script(source,{filename:file});
  await fs.writeFile(file,source);
}
async function patchDaylightCueBridge(file){
  let source=await fs.readFile(file,'utf8');
  source=replaceIfPresent(
    source,
    'const found=new Set(),now=Date.now();',
    'const found=new Set(window.__PACEFOLD_CUES__?.sources?.()||[]),now=Date.now();',
    'Daylight cue queue source bridge'
  );
  source=replaceIfPresent(
    source,
    "for(const event of ['pacefold:ma-prefs','pacefold:storage-changed','pacefold:quiet','pacefold:spatial-hardening','pacefold:v20-attention'])window.addEventListener(event,()=>refresh(true));",
    "for(const event of ['pacefold:ma-prefs','pacefold:storage-changed','pacefold:quiet','pacefold:spatial-hardening','pacefold:v20-attention','pacefold:cue-queue'])window.addEventListener(event,()=>refresh(true));",
    'Daylight cue queue refresh event'
  );
  new vm.Script(source,{filename:file});
  await fs.writeFile(file,source);
}
async function patchMaQuietBadgePolicy(file){
  let source=await fs.readFile(file,'utf8');
  source=replaceIfPresent(
    source,
    "if(prefs.quietMode||prefs.taskbarBadge===false||prefs.taskbarBadgeMode==='off')return clearSurface();",
    "if(prefs.taskbarBadge===false||prefs.taskbarBadgeMode==='off')return clearSurface();",
    'manual badge quiet policy'
  );
  source=replaceIfPresent(
    source,
    "if(prefs.quietMode||mode==='off'||prefs.taskbarBadge===false){if(badgeKey!=='clear'){badgeKey='clear';void clearSurface();}return true;}",
    "if(mode==='off'||prefs.taskbarBadge===false){if(badgeKey!=='clear'){badgeKey='clear';void clearSurface();}return true;}",
    'automatic badge quiet policy'
  );
  source=replaceIfPresent(
    source,
    "const restore={privacy:prefs.privacy,clarity:prefs.clarity,notificationDetail:prefs.notificationDetail,taskbarBadge:prefs.taskbarBadge,taskbarBadgeMode:prefs.taskbarBadgeMode,notificationMode:prefs.notificationMode};\n      patchPrefs({quietMode:true,quietRestore:restore,privacy:true,clarity:'discreet',notificationDetail:'generic',taskbarBadge:false,taskbarBadgeMode:'off',notificationMode:'quiet'});",
    "const restore={privacy:prefs.privacy,clarity:prefs.clarity,notificationDetail:prefs.notificationDetail,notificationMode:prefs.notificationMode};\n      patchPrefs({quietMode:true,quietRestore:restore,privacy:true,clarity:'discreet',notificationDetail:'generic',notificationMode:'quiet'});",
    'Quiet enable taskbar preservation'
  );
  source=replaceIfPresent(
    source,
    "patchPrefs({quietMode:false,quietRestore:null,privacy:restore.privacy??prefs.privacy,clarity:['clear','discreet','wafer'].includes(restore.clarity)?restore.clarity:'discreet',notificationDetail:restore.notificationDetail||'generic',taskbarBadge:restore.taskbarBadge??true,taskbarBadgeMode:restore.taskbarBadgeMode||'due',notificationMode:restore.notificationMode||'quiet'});",
    "patchPrefs({quietMode:false,quietRestore:null,privacy:restore.privacy??prefs.privacy,clarity:['clear','discreet','wafer'].includes(restore.clarity)?restore.clarity:'discreet',notificationDetail:restore.notificationDetail||'generic',notificationMode:restore.notificationMode||'quiet'});",
    'Quiet disable taskbar preservation'
  );
  source=replaceIfPresent(
    source,
    "const prefs=getPrefs(),mode=prefs.taskbarBadgeMode||'due';\n      if(mode==='off'||prefs.taskbarBadge===false){if(badgeKey!=='clear'){badgeKey='clear';void clearSurface();}return true;}",
    "const prefs=getPrefs(),mode=prefs.taskbarBadgeMode||'due';\n      const cueCount=Number(window.__PACEFOLD_CUES__?.count?.())||0;\n      if(cueCount){const cueKey=`cues:${cueCount}`;if(cueKey!==badgeKey){badgeKey=cueKey;void setManualBadge(cueCount>1?cueCount:null);}return true;}\n      if(mode==='off'||prefs.taskbarBadge===false){if(badgeKey!=='clear'){badgeKey='clear';void clearSurface();}return true;}",
    'multi-cue badge ownership'
  );
  new vm.Script(source,{filename:file});
  await fs.writeFile(file,source);
}
async function patchAppHtml(file){
  let html=await fs.readFile(file,'utf8');
  html=html
    .replace(/\s*<link[^>]+data-pacefold-v22-boot[^>]*>/gi,'')
    .replace(/\s*<link[^>]+data-pacefold-v22-daylight(?:-settings)?[^>]*>/gi,'')
    .replace(/\s*<script[^>]+data-pacefold-v22-(?:cues|daylight)[^>]*><\/script>/gi,'');
  html=updateExperienceMeta(html);
  html=replaceExactlyOnce(html,'<head>',`<head>\n<link rel="stylesheet" href="./${assets.boot}?v=${REVISION}" data-pacefold-v22-boot="${RELEASE}">`,'first-paint stylesheet');
  html=replaceExactlyOnce(html,'</head>',`<link rel="stylesheet" href="./${assets.daylight}?v=${REVISION}" data-pacefold-v22-daylight="${RELEASE}">\n<link rel="stylesheet" href="./${assets.settings}?v=${REVISION}" data-pacefold-v22-daylight-settings="${RELEASE}">\n</head>`,'daylight stylesheets');
  html=replaceExactlyOnce(html,'</body>',`<script defer src="./${assets.cues}?v=${REVISION}" data-pacefold-v22-cues="${RELEASE}"></script>\n<script defer src="./${assets.runtime}?v=${REVISION}" data-pacefold-v22-daylight="${RELEASE}"></script>\n</body>`,'daylight runtimes');
  await fs.writeFile(file,html);
}
async function patchLanding(file){
  let html=await fs.readFile(file,'utf8');
  html=updateExperienceMeta(html)
    .replaceAll('Pacefold 22.0.1 · one quiet spatial workday','Pacefold 22.0.2 · the day unfolds quietly')
    .replaceAll('Pacefold 22 · one quiet spatial workday','Pacefold 22.0.2 · the day unfolds quietly');
  await fs.writeFile(file,html);
}
function cacheName(name){return /-\d+\.\d+\.\d+$/.test(name)?name.replace(/-\d+\.\d+\.\d+$/,`-${REVISION}`):`${name}-${REVISION}`}
async function patchWorker(file,{root=false}={}){
  let worker;try{worker=await fs.readFile(file,'utf8')}catch{return}
  worker=worker.replace(/(const\s+CACHE_NAME\s*=\s*)([`'"])(pacefold-[^`'"]+)(\2)\s*;/,(_,prefix,quote,name)=>`${prefix}${quote}${cacheName(name)}${quote};`);
  const prefix=root?'./app/':'./',anchor=`'${prefix}pacefold-v22-hardening.js'`;
  for(const asset of Object.values(assets)){
    const token=`'${prefix}${asset}'`;if(worker.includes(token))continue;
    if(worker.includes(anchor))worker=worker.replace(anchor,`${anchor},${token}`);else worker+=`\n/* pacefold-v22-daylight-asset ${token} */\n`;
  }
  worker=worker.replace(/\/\* pacefold-experience:[^*]+\*\//g,'').replace(/\s+$/,'');
  worker+=`\n/* pacefold-experience:${RELEASE};revision:${REVISION} */\n`;
  await fs.writeFile(file,worker);
}
async function verify(){
  const html=await fs.readFile(path.join(targetApp,'index.html'),'utf8');
  const worker=await fs.readFile(path.join(targetRoot,'service-worker.js'),'utf8');
  const hardening=await fs.readFile(path.join(targetApp,'pacefold-v22-hardening.js'),'utf8');
  const dayflow=await fs.readFile(path.join(targetApp,'pacefold-v21-precision.js'),'utf8');
  const ma=await fs.readFile(path.join(targetApp,'pacefold-ma.js'),'utf8');
  const cues=await fs.readFile(path.join(targetApp,assets.cues),'utf8');
  const daylight=await fs.readFile(path.join(targetApp,assets.runtime),'utf8');
  if(!html.includes(`<head>\n<link rel="stylesheet" href="./${assets.boot}?v=${REVISION}"`))throw new Error('No-flash boot stylesheet is not first in the head');
  if(!html.includes(`<meta name="pacefold-experience" content="${RELEASE}">`))throw new Error('Daylight experience meta is stale');
  for(const [key,asset] of Object.entries(assets)){
    if(!html.includes(asset))throw new Error(`Daylight HTML omits ${key}`);
    if(!worker.includes(asset))throw new Error(`Offline shell omits ${asset}`);
  }
  if(!hardening.includes(`const RELEASE='${RELEASE}'`))throw new Error('Built hardening runtime was not advanced');
  if(!dayflow.includes(`const EXPERIENCE='${RELEASE}'`)||!dayflow.includes(`const RELEASE='${RELEASE}'`))throw new Error('Dayflow can still downgrade the active experience');
  if(ma.includes("prefs.quietMode||prefs.taskbarBadge===false")||ma.includes("quietMode:true,quietRestore:restore,privacy:true,clarity:'discreet',notificationDetail:'generic',taskbarBadge:false"))throw new Error('Quiet still disables the taskbar attention surface');
  if(!ma.includes('window.__PACEFOLD_CUES__?.count?.()'))throw new Error('The legacy badge loop can still overwrite cue counts');
  for(const token of [`const RELEASE='${RELEASE}'`,'pacefold.daylight.cues.v1','wrapDelivery','window.__PACEFOLD_CUES__'])if(!cues.includes(token))throw new Error(`Cue queue token missing: ${token}`);
  for(const token of [`const RELEASE='${RELEASE}'`,'buildDayUnfold','renderFavicon','Taskbar cue dots','window.__PACEFOLD_CUES__?.sources?.()'])if(!daylight.includes(token))throw new Error(`Daylight runtime token missing: ${token}`);
  if(!worker.includes(`revision:${REVISION}`))throw new Error('Daylight cache revision is stale');
}

for(const asset of [assets.cues,assets.runtime]){
  const runtime=await fs.readFile(path.join(sourceRoot,asset),'utf8');
  new vm.Script(runtime,{filename:asset});
  if(/\.innerHTML\s*=|style\s*=\s*["']/.test(runtime))throw new Error(`${asset} contains unsafe DOM construction`);
}
await Promise.all(Object.values(assets).map(asset=>fs.copyFile(path.join(sourceRoot,asset),path.join(targetApp,asset))));
await patchHardeningRelease(path.join(targetApp,'pacefold-v22-hardening.js'));
await patchDayflowOwnership(path.join(targetApp,'pacefold-v21-precision.js'));
await patchDaylightCueBridge(path.join(targetApp,assets.runtime));
await patchMaQuietBadgePolicy(path.join(targetApp,'pacefold-ma.js'));
await patchAppHtml(path.join(targetApp,'index.html'));
await patchLanding(path.join(targetRoot,'index.html'));
await patchWorker(path.join(targetRoot,'service-worker.js'),{root:true});
await patchWorker(path.join(targetApp,'service-worker.js'));
await fs.writeFile(path.join(targetRoot,'pacefold-experience.txt'),`${RELEASE}\n`);
await fs.writeFile(path.join(targetApp,'pacefold-experience.txt'),`${RELEASE}\n`);
await fs.writeFile(path.join(targetRoot,'pacefold-daylight.txt'),`${RELEASE} ${REVISION}\n`);
await fs.writeFile(path.join(targetApp,'pacefold-daylight.txt'),`${RELEASE} ${REVISION}\n`);
await verify();
console.log(`Installed Pacefold ${RELEASE}: Day Unfold, durable cue queue, no-flash boot and Quiet taskbar cues.`);
