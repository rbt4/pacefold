import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const RELEASE='23.0.0';
const REVISION='23.0.0';
const BUILD='experience-r1';
const CACHE_REVISION=`${REVISION}-${BUILD}`;
const sourceRoot=path.dirname(fileURLToPath(import.meta.url));
const targetRoot=path.resolve(process.argv[2]||'_site');
const targetApp=path.join(targetRoot,'app');
const assets={bootstrap:'pacefold-v23-bootstrap.js',boot:'pacefold-v23-boot.css',css:'pacefold-v23.css',runtime:'pacefold-v23.js'};
const cssOrder=[
  'pacefold-v21.css','pacefold-v21-compat.css','pacefold-v21-refine.css','pacefold-v21-precision.css',
  'pacefold-v21-minimal.css','pacefold-v21-minimal-responsive.css','pacefold-v21-dayflow.css',
  'pacefold-v22-spatial.css','pacefold-v22-hardening.css','pacefold-v22-recovery.css',
  'pacefold-v22-daylight.css','pacefold-v22-daylight-settings.css','pacefold-v23-stability.css',
  'pacefold-v23-action-dock.css','pacefold-v23-experience.css'
];
const runtimeOrder=[
  'pacefold-v21.js','pacefold-v21-persistence.js','pacefold-v21-refine.js','pacefold-v21-precision.js',
  'pacefold-v22-spatial.js','pacefold-v22-hardening.js','pacefold-v22-cues.js','pacefold-v22-daylight.js',
  'pacefold-v23-stability.js','pacefold-v23-action-dock.js','pacefold-v23-experience.js'
];

function replaceExactlyOnce(source,from,to,label){
  const first=source.indexOf(from);if(first<0)throw new Error(`Pacefold 23 ${label} anchor is missing`);
  if(source.indexOf(from,first+from.length)>=0)throw new Error(`Pacefold 23 ${label} anchor is ambiguous`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}
async function buildBundle(names,output){
  const parts=await Promise.all(names.map(async name=>`\n/* bundled:${name} */\n${await fs.readFile(path.join(targetApp,name),'utf8').then(value=>value.trim())}\n`));
  await fs.writeFile(path.join(targetApp,output),parts.join(''));
}
function updateMeta(html,name,value){
  const pattern=new RegExp(`\\s*<meta\\s+name=["']${name}["'][^>]*>`,'gi');html=html.replace(pattern,'');
  return replaceExactlyOnce(html,'</head>',`<meta name="${name}" content="${value}">\n</head>`,`${name} meta`);
}
async function patchAppHtml(file){
  let html=await fs.readFile(file,'utf8');
  html=html
    .replace(/\s*<link[^>]+data-pacefold-v21(?:-compat|-refine|-precision|-minimal(?:-responsive)?|-dayflow)?[^>]*>/gi,'')
    .replace(/\s*<link[^>]+data-pacefold-v22-[^>]*>/gi,'')
    .replace(/\s*<link[^>]+data-pacefold-v23[^>]*>/gi,'')
    .replace(/\s*<script[^>]+data-pacefold-v21(?!-boot)(?:-persistence|-refine|-precision)?[^>]*><\/script>/gi,'')
    .replace(/\s*<script[^>]+data-pacefold-v22-[^>]*><\/script>/gi,'')
    .replace(/\s*<script[^>]+data-pacefold-v23[^>]*><\/script>/gi,'');
  html=updateMeta(html,'pacefold-experience',RELEASE);
  html=replaceExactlyOnce(html,'<head>',`<head>\n<link rel="stylesheet" href="./${assets.boot}?v=${CACHE_REVISION}" data-pacefold-v23-boot="${RELEASE}">`,'first paint');
  html=replaceExactlyOnce(html,'</head>',`<link rel="stylesheet" href="./${assets.css}?v=${CACHE_REVISION}" data-pacefold-v23-css="${RELEASE}">\n</head>`,'active stylesheet');
  html=replaceExactlyOnce(html,'<script src="./app.js" defer></script>',`<script src="./${assets.bootstrap}?v=${CACHE_REVISION}" data-pacefold-v23-bootstrap="${RELEASE}"></script>\n<script src="./app.js" defer></script>`,'returning-user bootstrap');
  html=replaceExactlyOnce(html,'</body>',`<script defer src="./${assets.runtime}?v=${CACHE_REVISION}" data-pacefold-v23-runtime="${RELEASE}"></script>\n</body>`,'active runtime');
  await fs.writeFile(file,html);
}
async function patchLanding(file){
  let html=await fs.readFile(file,'utf8');html=updateMeta(html,'pacefold-experience',RELEASE);html=updateMeta(html,'pacefold-landing',RELEASE);
  html=html
    .replace(/Pacefold 20 is a private/g,'Pacefold 23 is a private')
    .replace('Pacefold 20 · one protected workday folio','Pacefold 23 · one quiet spatial workday')
    .replace('A precise clock, visible cue markers, weather, hydration, timers and care controls share one stable folio. The lower notebook stays present and can protect itself in a backup file you choose.','One calm clock keeps the day in view. Prayer times, quick logging and the day’s progress stay visible without turning the workspace into a dashboard.')
    .replace('Workday dashboard','Spatial workday')
    .replace('Everything important stays in reach.','The clock always stays at the centre.')
    .replace('Clock, weather, timers and quiet care.','Clock, prayer rhythm, quick logging and focused pages.')
    .replace('One dashboard · the whole workday','One clock · four useful directions')
    .replace('Capability without the pile of panels.','The whole workday without dashboard clutter.')
    .replace('The clock, weather, timers, hydration and care controls stay together above one permanent notebook. Notes and local sound change pages inside the lower half instead of opening another layer.','The clock stays central while Notes, Worklog, Now and Settings use consistent, contained pages. Every secondary page returns through the clock, and idle pages return automatically.')
    .replace('The notebook owns the lower half. Notes and sound change pages without modal layers.','Notes, activity and sound live in focused pages and return to the clock cleanly.')
    .replace('Pacefold 20.0.1 · one protected workday folio','Pacefold 23.0.0 · one quiet spatial workday');
  await fs.writeFile(file,html);
}
function cacheName(name){return /-\d+\.\d+\.\d+(?:-[a-z0-9-]+)?$/i.test(name)?name.replace(/-\d+\.\d+\.\d+(?:-[a-z0-9-]+)?$/i,`-${CACHE_REVISION}`):`${name}-${CACHE_REVISION}`}
async function patchWorker(file,{root=false}={}){
  let worker;try{worker=await fs.readFile(file,'utf8')}catch{return}
  worker=worker.replace(/(const\s+CACHE_NAME\s*=\s*)([`'"])(pacefold-[^`'"]+)(\2)\s*;/,(_,prefix,quote,name)=>`${prefix}${quote}${cacheName(name)}${quote};`);
  const prefix=root?'./app/':'./',anchor=`'${prefix}pacefold-v22-daylight.js'`;
  for(const asset of Object.values(assets)){
    const token=`'${prefix}${asset}'`;if(worker.includes(token))continue;
    if(worker.includes(anchor))worker=worker.replace(anchor,`${anchor},${token}`);else worker+=`\n/* pacefold-v23-asset ${token} */\n`;
  }
  worker=worker.replace(/\/\* pacefold-experience:[^*]+\*\//g,'').replace(/\s+$/,'');worker+=`\n/* pacefold-experience:${RELEASE};revision:${REVISION};build:${BUILD} */\n`;
  await fs.writeFile(file,worker);
}
async function verify(){
  const html=await fs.readFile(path.join(targetApp,'index.html'),'utf8'),landing=await fs.readFile(path.join(targetRoot,'index.html'),'utf8'),worker=await fs.readFile(path.join(targetRoot,'service-worker.js'),'utf8'),css=await fs.readFile(path.join(targetApp,assets.css),'utf8'),runtime=await fs.readFile(path.join(targetApp,assets.runtime),'utf8'),bootstrap=await fs.readFile(path.join(targetApp,assets.bootstrap),'utf8');
  for(const name of ['data-pacefold-v23-bootstrap','data-pacefold-v23-boot','data-pacefold-v23-css','data-pacefold-v23-runtime'])if((html.match(new RegExp(`${name}="${RELEASE.replace(/\./g,'\\.')}`,'g'))||[]).length!==1)throw new Error(`${name} injection count is wrong`);
  const withoutBoot=html.replace(/<script[^>]+data-pacefold-v21-boot[^>]*><\/script>/i,'').replace(/<script[^>]+data-pacefold-v23-bootstrap[^>]*><\/script>/i,'');
  if(/<link[^>]+data-pacefold-v2[12]-|<script[^>]+data-pacefold-v2[12]-/i.test(withoutBoot))throw new Error('An individual V21/V22 active asset is still loaded');
  if(!html.includes(`<meta name="pacefold-experience" content="${RELEASE}">`))throw new Error('App experience meta is stale');
  if(!html.includes(`?v=${CACHE_REVISION}`))throw new Error('Experience cache revision is missing');
  const bootstrapIndex=html.indexOf(assets.bootstrap),appIndex=html.indexOf('<script src="./app.js" defer></script>');if(bootstrapIndex<0||appIndex<0||bootstrapIndex>appIndex)throw new Error('Returning-user bootstrap is not before app.js');
  if(!landing.includes(`<meta name="pacefold-landing" content="${RELEASE}">`)||!landing.includes('Pacefold 23.0.0 · one quiet spatial workday'))throw new Error('Landing page is stale');
  for(const asset of Object.values(assets))if(!worker.includes(asset))throw new Error(`Offline shell omits ${asset}`);
  if(!worker.includes(`revision:${REVISION}`)||!worker.includes(`build:${BUILD}`))throw new Error('Offline shell revision is stale');
  for(const token of ['@media(forced-colors:active)','@media(max-width:420px) and (max-height:240px)','.pf23-seconds-dial','.pf22-settings-layout[data-hardened]','.pf23-action-dock','.pf23-schedule-strip','.pf23-context-schedule'])if(!css.includes(token))throw new Error(`Experience CSS token missing: ${token}`);
  for(const token of [`const RELEASE='${RELEASE}'`,'complete-stabilization-r6','__PACEFOLD_ACTIVE_RELEASE__','window.__PACEFOLD_ACTION_DOCK__','window.__PACEFOLD_EXPERIENCE__','experience-r1','waterLastAt','gazeLastAt','bodyLastAt'])if(!runtime.includes(token))throw new Error(`Experience runtime token missing: ${token}`);
  for(const token of ['pf23-boot-hold','__PACEFOLD_BOOTSTRAP__','pacefoldPrefsV14'])if(!bootstrap.includes(token))throw new Error(`Bootstrap token missing: ${token}`);
}

const stabilityRuntime=await fs.readFile(path.join(sourceRoot,'pacefold-v23-stability.js'),'utf8');new vm.Script(stabilityRuntime,{filename:'pacefold-v23-stability.js'});
const actionRuntime=await fs.readFile(path.join(sourceRoot,'pacefold-v23-action-dock.js'),'utf8');new vm.Script(actionRuntime,{filename:'pacefold-v23-action-dock.js'});
const experienceRuntime=await fs.readFile(path.join(sourceRoot,'pacefold-v23-experience.js'),'utf8');new vm.Script(experienceRuntime,{filename:'pacefold-v23-experience.js'});
const bootstrapRuntime=await fs.readFile(path.join(sourceRoot,'pacefold-v23-bootstrap.js'),'utf8');new vm.Script(bootstrapRuntime,{filename:'pacefold-v23-bootstrap.js'});
if(/\.innerHTML\s*=|style\s*=\s*["']/.test(stabilityRuntime+actionRuntime+experienceRuntime+bootstrapRuntime))throw new Error('Pacefold 23 runtime contains unsafe DOM construction');
await Promise.all([
  fs.copyFile(path.join(sourceRoot,'pacefold-v23-bootstrap.js'),path.join(targetApp,assets.bootstrap)),
  fs.copyFile(path.join(sourceRoot,'pacefold-v23-boot.css'),path.join(targetApp,assets.boot)),
  fs.copyFile(path.join(sourceRoot,'pacefold-v23-stability.css'),path.join(targetApp,'pacefold-v23-stability.css')),
  fs.copyFile(path.join(sourceRoot,'pacefold-v23-stability.js'),path.join(targetApp,'pacefold-v23-stability.js')),
  fs.copyFile(path.join(sourceRoot,'pacefold-v23-action-dock.css'),path.join(targetApp,'pacefold-v23-action-dock.css')),
  fs.copyFile(path.join(sourceRoot,'pacefold-v23-action-dock.js'),path.join(targetApp,'pacefold-v23-action-dock.js')),
  fs.copyFile(path.join(sourceRoot,'pacefold-v23-experience.css'),path.join(targetApp,'pacefold-v23-experience.css')),
  fs.copyFile(path.join(sourceRoot,'pacefold-v23-experience.js'),path.join(targetApp,'pacefold-v23-experience.js'))
]);
await buildBundle(cssOrder,assets.css);await buildBundle(runtimeOrder,assets.runtime);
await patchAppHtml(path.join(targetApp,'index.html'));await patchLanding(path.join(targetRoot,'index.html'));
await patchWorker(path.join(targetRoot,'service-worker.js'),{root:true});await patchWorker(path.join(targetApp,'service-worker.js'));
await fs.writeFile(path.join(targetRoot,'pacefold-experience.txt'),`${RELEASE}\n`);await fs.writeFile(path.join(targetApp,'pacefold-experience.txt'),`${RELEASE}\n`);
await fs.writeFile(path.join(targetRoot,'pacefold-stability.txt'),`${RELEASE} ${REVISION}\n`);await fs.writeFile(path.join(targetApp,'pacefold-stability.txt'),`${RELEASE} ${REVISION}\n`);
await verify();console.log(`Installed Pacefold ${RELEASE}: ${BUILD}, unified startup, clock-centred navigation, prayer schedule and corrected logging.`);
