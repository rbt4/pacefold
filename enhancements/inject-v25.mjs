import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const RELEASE='25.0.0';
const REVISION='recovery-r2';
const CACHE=`${RELEASE}-${REVISION}`;
const VERSION_LABEL=`Pacefold ${RELEASE} · private local recovery`;
const sourceRoot=path.dirname(fileURLToPath(import.meta.url));
const targetRoot=path.resolve(process.argv[2]||'_site');
const targetApp=path.join(targetRoot,'app');
const assets={boot:'pacefold-v25-boot.js',css:'pacefold-v25-recovery.css',runtime:'pacefold-v25-recovery.js'};

function replaceExactlyOnce(source,from,to,label){
  const first=source.indexOf(from);if(first<0)throw new Error(`Pacefold 25 ${label} anchor is missing`);
  if(source.indexOf(from,first+from.length)>=0)throw new Error(`Pacefold 25 ${label} anchor is ambiguous`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}
function updateMeta(html,name,value){
  html=html.replace(new RegExp(`\\s*<meta\\s+name=["']${name}["'][^>]*>`,'gi'),'');
  return replaceExactlyOnce(html,'</head>',`<meta name="${name}" content="${value}">\n</head>`,`${name} meta`);
}
function removeV25(html){
  return html
    .replace(/\s*<link[^>]+data-pacefold-v25[^>]*>/gi,'')
    .replace(/\s*<script[^>]+data-pacefold-v25[^>]*><\/script>/gi,'');
}
async function patchAppHtml(file){
  let html=removeV25(await fs.readFile(file,'utf8'));
  html=updateMeta(html,'pacefold-experience',RELEASE);html=updateMeta(html,'pacefold-release',REVISION);
  html=html.replace(/<title>[^<]*<\/title>/i,'<title>Pacefold — Quiet Workday Rhythm</title>');
  html=replaceExactlyOnce(html,'</head>',`<link rel="stylesheet" href="./${assets.css}?v=${CACHE}" data-pacefold-v25-css="${RELEASE}">\n</head>`,'recovery stylesheet');
  html=replaceExactlyOnce(html,'<script src="./app.js" defer></script>',`<script src="./${assets.boot}?v=${CACHE}" data-pacefold-v25-boot="${RELEASE}"></script>\n<script src="./app.js" defer></script>`,'recovery boot order');
  html=replaceExactlyOnce(html,'</body>',`<script defer src="./${assets.runtime}?v=${CACHE}" data-pacefold-v25-runtime="${RELEASE}"></script>\n</body>`,'recovery runtime order');
  await fs.writeFile(file,html);
}
async function patchLanding(file){
  let html=await fs.readFile(file,'utf8');
  html=html.replace(/Pacefold 24\.0\.0/g,'Pacefold 25.0.0')
    .replace(/Pacefold 24/g,'Pacefold 25')
    .replace('one current experience','Recovery · one coherent experience')
    .replace('Your day,<br>held together.','Your day,<br>folded back into place.')
    .replace('A clock-first workday instrument that keeps the day visible without becoming another dashboard. Time, prayer or personal moments, notes, focus, hydration and care stay close—then quietly get out of the way.','Pacefold 25 Recovery restores the clock-first workday: visible prayer or personal rhythm, coloured quiet cues, fast logging, a folding Daybook and settings that remember you—without bringing the old dashboard pile back.')
    .replace('One product—not a stack of old versions.','Recovered from the best of Pacefold—not another stack of old versions.');
  html=updateMeta(html,'pacefold-experience',RELEASE);html=updateMeta(html,'pacefold-landing',REVISION);
  await fs.writeFile(file,html);
}
async function patchV24VersionOwnership(file){
  let source=await fs.readFile(file,'utf8');
  const old="node.textContent=`Pacefold ${RELEASE} · private local engine`";
  const next=`node.textContent='${VERSION_LABEL}'`;
  if(source.includes(old))source=replaceExactlyOnce(source,old,next,'V24 version ownership');
  else if(!source.includes(next))throw new Error('Pacefold 25 V24 version ownership state is unknown');
  await fs.writeFile(file,source);
}
function cacheName(name){
  if(name.includes(CACHE))return name;
  if(/-\d+\.\d+\.\d+(?:-[a-z0-9-]+)?$/i.test(name))return name.replace(/-\d+\.\d+\.\d+(?:-[a-z0-9-]+)?$/i,`-${CACHE}`);
  return `${name}-${CACHE}`;
}
async function patchWorker(file,{root=false}={}){
  let worker;try{worker=await fs.readFile(file,'utf8')}catch{return}
  worker=worker.replace(/(const\s+CACHE_NAME\s*=\s*)([`'"])(pacefold-[^`'"]+)(\2)\s*;/,(_,prefix,quote,name)=>`${prefix}${quote}${cacheName(name)}${quote};`);
  const prefix=root?'./app/':'./';
  for(const asset of Object.values(assets)){
    const token=`'${prefix}${asset}'`;if(worker.includes(token))continue;
    const anchor=`'${prefix}pacefold-v24.js'`;
    if(worker.includes(anchor))worker=worker.replace(anchor,`${anchor},${token}`);else worker+=`\n/* pacefold-v25-asset ${token} */\n`;
  }
  worker=worker.replace(/\/\* pacefold-recovery:[^*]+\*\//g,'').replace(/\s+$/,'');
  worker+=`\n/* pacefold-recovery:${RELEASE};revision:${REVISION} */\n`;
  await fs.writeFile(file,worker);
}
async function verify(){
  const html=await fs.readFile(path.join(targetApp,'index.html'),'utf8'),landing=await fs.readFile(path.join(targetRoot,'index.html'),'utf8'),rootWorker=await fs.readFile(path.join(targetRoot,'service-worker.js'),'utf8'),v24=await fs.readFile(path.join(targetApp,'pacefold-v24.js'),'utf8');
  for(const name of ['data-pacefold-v25-boot','data-pacefold-v25-css','data-pacefold-v25-runtime'])if((html.match(new RegExp(`${name}="${RELEASE.replace(/\./g,'\\.')}`,'g'))||[]).length!==1)throw new Error(`${name} injection count is wrong`);
  if(!html.includes(`<meta name="pacefold-experience" content="${RELEASE}">`)||!html.includes(`<meta name="pacefold-release" content="${REVISION}">`))throw new Error('Pacefold 25 app metadata is stale');
  const bootIndex=html.indexOf(assets.boot),appIndex=html.indexOf('<script src="./app.js" defer></script>'),runtimeIndex=html.indexOf(assets.runtime),v24RuntimeIndex=html.indexOf('pacefold-v24.js');
  if(bootIndex<0||appIndex<0||bootIndex>appIndex)throw new Error('Pacefold 25 boot guard is not before app.js');
  if(runtimeIndex<0||v24RuntimeIndex<0||runtimeIndex<v24RuntimeIndex)throw new Error('Pacefold 25 recovery runtime must load after Pacefold 24 composition');
  if(!v24.includes(`node.textContent='${VERSION_LABEL}'`))throw new Error('Pacefold 24 can still overwrite the active V25 version label');
  for(const asset of Object.values(assets))if(!rootWorker.includes(asset))throw new Error(`Pacefold 25 offline worker omits ${asset}`);
  if(!landing.includes('Pacefold 25.0.0')||!landing.includes('Recovery'))throw new Error('Pacefold 25 public landing is stale');
  if(/\bMa\b|verified offline core 15\.2\.2/i.test(landing))throw new Error('Pacefold 25 public landing exposes an obsolete product concept');
}

for(const file of [assets.boot,assets.runtime]){
  const source=await fs.readFile(path.join(sourceRoot,file),'utf8');new vm.Script(source,{filename:file});if(/\.innerHTML\s*=/.test(source))throw new Error(`${file} contains raw innerHTML assignment`);
}
await Promise.all(Object.values(assets).map(asset=>fs.copyFile(path.join(sourceRoot,asset),path.join(targetApp,asset))));
await patchAppHtml(path.join(targetApp,'index.html'));await patchLanding(path.join(targetRoot,'index.html'));await patchV24VersionOwnership(path.join(targetApp,'pacefold-v24.js'));
await patchWorker(path.join(targetRoot,'service-worker.js'),{root:true});await patchWorker(path.join(targetApp,'service-worker.js'));
await fs.writeFile(path.join(targetRoot,'pacefold-experience.txt'),`${RELEASE} ${REVISION}\n`);await fs.writeFile(path.join(targetApp,'pacefold-experience.txt'),`${RELEASE} ${REVISION}\n`);
await fs.writeFile(path.join(targetRoot,'pacefold-stability.txt'),`${RELEASE} ${REVISION}\n`);await fs.writeFile(path.join(targetApp,'pacefold-stability.txt'),`${RELEASE} ${REVISION}\n`);
await verify();console.log(`Installed Pacefold ${RELEASE}: ${REVISION}, recovery layer, day-type rhythm, cue dots, folding Daybook and clock-return navigation.`);
