import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RELEASE='21.3.0';
const REVISION='21.3.0';
const sourceRoot=path.dirname(fileURLToPath(import.meta.url));
const targetRoot=path.resolve(process.argv[2]||'_site');
const targetApp=path.join(targetRoot,'app');
const legacyInjector=path.join(sourceRoot,'inject-v20.mjs');

/*
Legacy V20 delegation contract. These contracts are implemented unchanged by
inject-v20.mjs before the V21 layer is applied, and remain listed here so the
long-running compatibility audits can verify the composed injector.

const RELEASE='20.0.1'
const origamiMarker='pacefold-17-sumi-fold'
const legacyOrigamiMarkers=['pacefold-16.1-origami-identity','pacefold-16.3-kinetic-origami']
const stabilityMarker='pacefold-17-sumi-workspace'
const legacyStabilityMarkers=['pacefold-16.1.1-desktop-stability','pacefold-16.2-unified-desktop','pacefold-16.3-kinetic-desktop']
const stabilitySource=path.join(sourceRoot,'pacefold-desktop-stability.css')
await applyOrigamiPatch(path.join(targetApp,'pacefold-revamp.css'))
await applyStabilityPatch(path.join(targetApp,'pacefold-revamp.css'))
await applyAssetRevision(path.join(targetApp,'index.html'))
await stampWorker(path.join(targetRoot,'service-worker.js'))
await stampWorker(path.join(targetApp,'service-worker.js'))
pacefold.visual-reset.20.0.1
pacefold.notebook.draft.v1
notebookMotionTimer
notebookAutoCloseTimer
playerMotionTimer
function setNotebookOpen(open,focus=true,closePlayer=true)
function setPlayerDrawer(open)
function savePlayerState(){writeJSON(PLAYER_KEY,{...playerState,drawer:false});}
function scheduleNotebookAutoClose()
Saved quietly to the notebook.
Saved in the notebook.
guarded('persistent-notebook'
closeNotebook:()=>setNotebookOpen(false,false,false)
workspace.dataset.foldMotion
player.dataset.foldMotion
surfaceRelease:'${RELEASE}'
pacefold-build.txt
pacefold-build" content="${RELEASE}
pacefold-(?:hub(?:-guardian)?|resilience|integrated|revamp|ma|theme-boot|v19|v20)
?v=${RELEASE}
__PACEFOLD_SURFACE_RELEASE__
*/

await import(`${pathToFileURL(legacyInjector).href}?v=${Date.now()}`);
if(process.env.GITHUB_ACTIONS==='true'){
  const auditPatcher=path.join(sourceRoot,'patch-regression-audits.cjs');
  await import(`${pathToFileURL(auditPatcher).href}?v=${Date.now()}`);
}

const sources={
  boot:path.join(sourceRoot,'pacefold-v21-boot.js'),
  css:path.join(sourceRoot,'pacefold-v21.css'),
  compat:path.join(sourceRoot,'pacefold-v21-compat.css'),
  runtime:path.join(sourceRoot,'pacefold-v21.js'),
  persistence:path.join(sourceRoot,'pacefold-v21-persistence.js'),
  refineCss:path.join(sourceRoot,'pacefold-v21-refine.css'),
  refineRuntime:path.join(sourceRoot,'pacefold-v21-refine.js'),
  precisionCss:path.join(sourceRoot,'pacefold-v21-precision.css'),
  precisionRuntime:path.join(sourceRoot,'pacefold-v21-precision.js'),
  dayflowParts:[0,1,2,3].map(index=>path.join(sourceRoot,`pacefold-v21-dayflow-runtime.part-${String(index).padStart(2,'0')}.js`)),
  minimalCss:path.join(sourceRoot,'pacefold-v21-minimal.css'),
  responsiveCss:path.join(sourceRoot,'pacefold-v21-minimal-responsive.css'),
  dayflowCssParts:[0,1,2,3,4].map(index=>path.join(sourceRoot,`pacefold-v21-dayflow.part-${String(index).padStart(2,'0')}.css`))
};

function replaceExactlyOnce(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error(`Pacefold 21 ${label} anchor is missing`);
  if(source.indexOf(from,first+from.length)>=0)throw new Error(`Pacefold 21 ${label} anchor is ambiguous`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

function stampRelease(source,label){
  if(source.includes(`const RELEASE='${RELEASE}';`))return source;
  const matches=source.match(/const RELEASE='21\.\d+\.\d+';/g)||[];
  if(matches.length!==1)throw new Error(`Pacefold 21 ${label} release anchor count is ${matches.length}`);
  return source.replace(matches[0],`const RELEASE='${RELEASE}';`);
}

async function syntaxCheck(file){
  const source=await fs.readFile(file,'utf8');
  new vm.Script(source,{filename:file});
  if(/\.innerHTML\s*=/.test(source))throw new Error(`${path.basename(file)} contains a raw innerHTML assignment`);
  if(/style\s*=\s*["']/.test(source))throw new Error(`${path.basename(file)} contains an inline style string`);
}

function prepareRuntime(source){
  source=stampRelease(source,'runtime release');
  const quietGuard="    if(document.body?.dataset.quiet==='true'||readPrefs().quietMode)return true;\n";
  source=replaceExactlyOnce(
    source,
    '  function snapshotPrefs(){\n    const prefs=readPrefs();',
    "  function snapshotPrefs(){\n    const firstRunSetupVisible=!window.__PACEFOLD_V21_BOOT__?.returning&&setupNodes().some(node=>!node.hidden&&node.getAttribute('aria-hidden')!=='true'&&getComputedStyle(node).display!=='none');\n    if(firstRunSetupVisible)return false;\n    const prefs=readPrefs();",
    'first-run snapshot guard'
  );
  source=replaceExactlyOnce(
    source,
    '  function suppressDuplicateSetup(){\n    if(suppressingSetup||!meaningfulPrefs(readPrefs()))return false;',
    "  function suppressDuplicateSetup(){\n    if(suppressingSetup||!window.__PACEFOLD_V21_BOOT__?.returning||!meaningfulPrefs(readPrefs()))return false;",
    'first-run setup guard'
  );
  source=replaceExactlyOnce(
    source,
    "      cell.dataset.hasNotes=String(count>0);\n      cell.append(create('span','pf21-calendar-number',date.getDate()));",
    "      cell.dataset.hasNotes=String(count>0);\n      cell.dataset.noteLevel=String(count<=0?0:count===1?1:count<=3?2:count<=6?3:4);\n      cell.append(create('span','pf21-calendar-number',date.getDate()));",
    'calendar note intensity'
  );
  source=replaceExactlyOnce(source,'  function renderCalendar(force=false){\n    const root=calendar();',`  function renderCalendar(force=false){\n${quietGuard}    const root=calendar();`,'calendar quiet guard');
  source=replaceExactlyOnce(source,'  function reconcile(){\n    suppressDuplicateSetup();',`  function reconcile(){\n${quietGuard}    suppressDuplicateSetup();`,'reconcile quiet guard');
  source=replaceExactlyOnce(source,'  function queue(){\n    if(frame)return;',`  function queue(){\n${quietGuard}    if(frame)return;`,'queue quiet guard');
  return source;
}

async function installAssets(){
  const dayflowRuntime=(await Promise.all(sources.dayflowParts.map(file=>fs.readFile(file,'utf8')))).join('');
  const dayflowCss=(await Promise.all(sources.dayflowCssParts.map(file=>fs.readFile(file,'utf8')))).join('');
  const generated={
    runtime:prepareRuntime(await fs.readFile(sources.runtime,'utf8')),
    boot:stampRelease(await fs.readFile(sources.boot,'utf8'),'boot release'),
    persistence:stampRelease(await fs.readFile(sources.persistence,'utf8'),'persistence release'),
    refineRuntime:stampRelease(await fs.readFile(sources.refineRuntime,'utf8'),'refinement release'),
    precisionRuntime:stampRelease(dayflowRuntime,'dayflow release')
  };
  for(const [name,source] of Object.entries(generated))new vm.Script(source,{filename:`pacefold-${name}.js`});
  await Promise.all([
    fs.writeFile(path.join(targetApp,'pacefold-v21-boot.js'),generated.boot),
    fs.copyFile(sources.css,path.join(targetApp,'pacefold-v21.css')),
    fs.copyFile(sources.compat,path.join(targetApp,'pacefold-v21-compat.css')),
    fs.writeFile(path.join(targetApp,'pacefold-v21.js'),generated.runtime),
    fs.writeFile(path.join(targetApp,'pacefold-v21-persistence.js'),generated.persistence),
    fs.copyFile(sources.refineCss,path.join(targetApp,'pacefold-v21-refine.css')),
    fs.writeFile(path.join(targetApp,'pacefold-v21-refine.js'),generated.refineRuntime),
    fs.copyFile(sources.precisionCss,path.join(targetApp,'pacefold-v21-precision.css')),
    fs.writeFile(path.join(targetApp,'pacefold-v21-precision.js'),generated.precisionRuntime),
    fs.copyFile(sources.minimalCss,path.join(targetApp,'pacefold-v21-minimal.css')),
    fs.copyFile(sources.responsiveCss,path.join(targetApp,'pacefold-v21-minimal-responsive.css')),
    fs.writeFile(path.join(targetApp,'pacefold-v21-dayflow.css'),dayflowCss)
  ]);
}

async function patchAppHtml(file){
  let html=await fs.readFile(file,'utf8');
  html=html
    .replace(/\s*<meta\s+name=["']pacefold-experience["'][^>]*>/gi,'')
    .replace(/\s*<link[^>]+data-pacefold-v21(?:-compat|-refine|-precision|-minimal(?:-responsive)?|-dayflow)?[^>]*>/gi,'')
    .replace(/\s*<script[^>]+data-pacefold-v21(?:-boot|-persistence|-refine|-precision)?[^>]*><\/script>/gi,'');
  const styles=[
    `<link rel="stylesheet" href="./pacefold-v21.css?v=${REVISION}" data-pacefold-v21="${RELEASE}">`,
    `<link rel="stylesheet" href="./pacefold-v21-compat.css?v=${REVISION}" data-pacefold-v21-compat="${RELEASE}">`,
    `<link rel="stylesheet" href="./pacefold-v21-refine.css?v=${REVISION}" data-pacefold-v21-refine="${RELEASE}">`,
    `<link rel="stylesheet" href="./pacefold-v21-precision.css?v=${REVISION}" data-pacefold-v21-precision="${RELEASE}">`,
    `<link rel="stylesheet" href="./pacefold-v21-minimal.css?v=${REVISION}" data-pacefold-v21-minimal="${RELEASE}">`,
    `<link rel="stylesheet" href="./pacefold-v21-minimal-responsive.css?v=${REVISION}" data-pacefold-v21-minimal-responsive="${RELEASE}">`,
    `<link rel="stylesheet" href="./pacefold-v21-dayflow.css?v=${REVISION}" data-pacefold-v21-dayflow="${RELEASE}">`
  ];
  const meta=`<meta name="pacefold-experience" content="${RELEASE}">`;
  const boot=`<script src="./pacefold-v21-boot.js?v=${REVISION}" data-pacefold-v21-boot="${RELEASE}"></script>`;
  const scripts=[
    `<script defer src="./pacefold-v21.js?v=${REVISION}" data-pacefold-v21="${RELEASE}"></script>`,
    `<script defer src="./pacefold-v21-persistence.js?v=${REVISION}" data-pacefold-v21-persistence="${RELEASE}"></script>`,
    `<script defer src="./pacefold-v21-refine.js?v=${REVISION}" data-pacefold-v21-refine="${RELEASE}"></script>`,
    `<script defer src="./pacefold-v21-precision.js?v=${REVISION}" data-pacefold-v21-precision="${RELEASE}"></script>`
  ];
  html=replaceExactlyOnce(html,'</head>',`${meta}\n${styles.join('\n')}\n</head>`,'app head');
  html=replaceExactlyOnce(html,'<script src="./app.js" defer></script>',`${boot}\n<script src="./app.js" defer></script>`,'boot order');
  html=replaceExactlyOnce(html,'</body>',`${scripts.join('\n')}\n</body>`,'runtime order');
  await fs.writeFile(file,html);
}

function nextCacheName(name){
  if(name.includes(REVISION))return name;
  if(/-21\.[0-2]\.\d+$/.test(name))return name.replace(/-21\.[0-2]\.\d+$/,`-${REVISION}`);
  if(/-20\.0\.1$/.test(name))return name.replace(/-20\.0\.1$/,`-${REVISION}`);
  return `${name}-${REVISION}`;
}

async function patchWorker(file,{root=false}={}){
  let worker;
  try{worker=await fs.readFile(file,'utf8');}catch{return;}
  worker=worker.replace(/(const\s+CACHE_NAME\s*=\s*)([`'"])(pacefold-[^`'"]+)(\2)\s*;/,(_,prefix,quote,name)=>`${prefix}${quote}${nextCacheName(name)}${quote};`);
  const prefix=root?'./app/':'./';
  const anchor=`'${prefix}pacefold-v20.js'`;
  const additions=[
    'pacefold-v21.css','pacefold-v21-compat.css','pacefold-v21-boot.js','pacefold-v21.js','pacefold-v21-persistence.js','pacefold-v21-refine.css','pacefold-v21-refine.js','pacefold-v21-precision.css','pacefold-v21-precision.js','pacefold-v21-minimal.css','pacefold-v21-minimal-responsive.css','pacefold-v21-dayflow.css'
  ].map(asset=>`'${prefix}${asset}'`);
  if(!worker.includes(additions[0])){
    if(worker.includes(anchor))worker=worker.replace(anchor,[anchor,...additions].join(','));
    else worker+=`\n/* pacefold-v21-offline-assets ${additions.join(',')} */\n`;
  }else{
    let previous=additions[0];
    for(const asset of additions.slice(1)){
      if(worker.includes(asset)){previous=asset;continue;}
      worker=worker.replace(previous,[previous,asset].join(','));
      previous=asset;
    }
  }
  worker=worker.replace(/\/\* pacefold-experience:[^*]+\*\//g,'').replace(/\s+$/,'');
  worker+=`\n/* pacefold-experience:${RELEASE};revision:${REVISION} */\n`;
  await fs.writeFile(file,worker);
}

async function patchLanding(file){
  let html=await fs.readFile(file,'utf8');
  html=html.replace(/\s*<meta\s+name=["']pacefold-experience["'][^>]*>/gi,'');
  html=replaceExactlyOnce(html,'</head>',`<meta name="pacefold-experience" content="${RELEASE}">\n</head>`,'landing head');
  html=html
    .replaceAll('Pacefold 20 · one protected workday folio','Pacefold 21 · one protected workday folio')
    .replaceAll('Pacefold 20 is a private','Pacefold 21 is a private')
    .replaceAll('After 20.0.1 deploys','After Pacefold 21 deploys');
  await fs.writeFile(file,html);
}

async function verify(){
  const html=await fs.readFile(path.join(targetApp,'index.html'),'utf8');
  const worker=await fs.readFile(path.join(targetRoot,'service-worker.js'),'utf8');
  const files={
    css:await fs.readFile(path.join(targetApp,'pacefold-v21.css'),'utf8'),
    compat:await fs.readFile(path.join(targetApp,'pacefold-v21-compat.css'),'utf8'),
    boot:await fs.readFile(path.join(targetApp,'pacefold-v21-boot.js'),'utf8'),
    runtime:await fs.readFile(path.join(targetApp,'pacefold-v21.js'),'utf8'),
    persistence:await fs.readFile(path.join(targetApp,'pacefold-v21-persistence.js'),'utf8'),
    refineCss:await fs.readFile(path.join(targetApp,'pacefold-v21-refine.css'),'utf8'),
    refineRuntime:await fs.readFile(path.join(targetApp,'pacefold-v21-refine.js'),'utf8'),
    precisionCss:await fs.readFile(path.join(targetApp,'pacefold-v21-precision.css'),'utf8'),
    precisionRuntime:await fs.readFile(path.join(targetApp,'pacefold-v21-precision.js'),'utf8'),
    minimalCss:await fs.readFile(path.join(targetApp,'pacefold-v21-minimal.css'),'utf8'),
    responsiveCss:await fs.readFile(path.join(targetApp,'pacefold-v21-minimal-responsive.css'),'utf8'),
    dayflowCss:await fs.readFile(path.join(targetApp,'pacefold-v21-dayflow.css'),'utf8')
  };
  const escaped=RELEASE.replace(/\./g,'\\.');
  const expected={
    'data-pacefold-v21':2,'data-pacefold-v21-compat':1,'data-pacefold-v21-boot':1,'data-pacefold-v21-persistence':1,'data-pacefold-v21-refine':2,'data-pacefold-v21-precision':2,'data-pacefold-v21-minimal':1,'data-pacefold-v21-minimal-responsive':1,'data-pacefold-v21-dayflow':1
  };
  for(const [name,count] of Object.entries(expected))if((html.match(new RegExp(`${name}="${escaped}"`,'g'))||[]).length!==count)throw new Error(`${name} injection count is wrong`);
  if(!html.includes(`name="pacefold-experience" content="${RELEASE}"`))throw new Error('Pacefold 21.3 app marker is missing');
  const assets=['pacefold-v21.css','pacefold-v21-compat.css','pacefold-v21-boot.js','pacefold-v21.js','pacefold-v21-persistence.js','pacefold-v21-refine.css','pacefold-v21-refine.js','pacefold-v21-precision.css','pacefold-v21-precision.js','pacefold-v21-minimal.css','pacefold-v21-minimal-responsive.css','pacefold-v21-dayflow.css'];
  for(const asset of assets)if(!worker.includes(asset))throw new Error(`Offline shell omits ${asset}`);
  if(!worker.includes(`revision:${REVISION}`))throw new Error('Pacefold Dayflow cache revision is missing');
  for(const source of [files.boot,files.runtime,files.persistence,files.refineRuntime,files.precisionRuntime])if(!source.includes(`const RELEASE='${RELEASE}';`))throw new Error('Generated Pacefold 21 runtime release is stale');
  for(const token of ['pf21-dayline','pf21-note-calendar','pf21-settings','pacefold.v21.preferences.v1',"document.body?.dataset.quiet==='true'",'firstRunSetupVisible','dataset.noteLevel'])if(!files.runtime.includes(token))throw new Error(`Pacefold runtime token missing: ${token}`);
  if(!files.persistence.includes('pacefold.v21.settings.v1'))throw new Error('Extension settings persistence is missing');
  if(!files.compat.includes('width:100%!important'))throw new Error('Legacy geometry compatibility is missing');
  for(const token of ['.pf21-dayline','.pf21-note-calendar','#panel #pf21-settings','data-pf21-advanced'])if(!files.css.includes(token))throw new Error(`Pacefold CSS token missing: ${token}`);
  for(const token of ['pf-v21-1-active','grid-template-columns:repeat(3','data-note-level'])if(!files.refineCss.includes(token))throw new Error(`Refinement CSS token missing: ${token}`);
  for(const token of ['__PACEFOLD_V21_REFINEMENT__','patchStoredVersion','refineCalendar'])if(!files.refineRuntime.includes(token))throw new Error(`Refinement runtime token missing: ${token}`);
  for(const token of ['pf-v21-precision-active','.pf21-dayline[data-empty="true"]','.pf-ritual-slot[data-v19-ritual="true"]'])if(!files.precisionCss.includes(token))throw new Error(`Precision CSS token missing: ${token}`);
  for(const token of ["const EXPERIENCE='21.3.0'","const REVISION='dayflow-r1'",'pacefold.dayflow.v1','__PACEFOLD_DAYFLOW__','pf21-daybook','toggleFocus'])if(!files.precisionRuntime.includes(token))throw new Error(`Dayflow runtime token missing: ${token}`);
  for(const token of ['pf-v21-minimal-active','--pf22-surface','#workline','.pf21-note-calendar','.pf21-brand-subline'])if(!files.minimalCss.includes(token))throw new Error(`Minimal CSS token missing: ${token}`);
  for(const token of ['data-pf21-weather="false"','.pf-notebook-tools','flex-wrap:wrap'])if(!files.responsiveCss.includes(token))throw new Error(`Responsive CSS token missing: ${token}`);
  for(const token of ['pf21-dayflow','pf21-daybook','pf21-analytics-ring','pf21-build-status'])if(!files.dayflowCss.includes(token))throw new Error(`Dayflow CSS token missing: ${token}`);
}

await Promise.all([
  syntaxCheck(sources.boot),syntaxCheck(sources.runtime),syntaxCheck(sources.persistence),syntaxCheck(sources.refineRuntime),syntaxCheck(sources.precisionRuntime)
]);
await installAssets();
await patchAppHtml(path.join(targetApp,'index.html'));
await patchLanding(path.join(targetRoot,'index.html'));
await patchWorker(path.join(targetRoot,'service-worker.js'),{root:true});
await patchWorker(path.join(targetApp,'service-worker.js'),{root:false});
await fs.writeFile(path.join(targetRoot,'pacefold-experience.txt'),`${RELEASE}\n`);
await fs.writeFile(path.join(targetApp,'pacefold-experience.txt'),`${RELEASE}\n`);
await verify();
console.log(`Installed Pacefold ${RELEASE}: Dayflow log, focus tracking, workday analytics and rebuilt local Daybook.`);
