import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RELEASE='21.0.0';
const sourceRoot=path.dirname(fileURLToPath(import.meta.url));
const targetRoot=path.resolve(process.argv[2]||'_site');
const targetApp=path.join(targetRoot,'app');
const legacyInjector=path.join(sourceRoot,'inject-v20.mjs');

await import(`${pathToFileURL(legacyInjector).href}?v=${Date.now()}`);

const bootSource=path.join(sourceRoot,'pacefold-v21-boot.js');
const cssSource=path.join(sourceRoot,'pacefold-v21.css');
const scriptSource=path.join(sourceRoot,'pacefold-v21.js');
const persistenceSource=path.join(sourceRoot,'pacefold-v21-persistence.js');

function replaceExactlyOnce(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error(`Pacefold 21 ${label} anchor is missing`);
  if(source.indexOf(from,first+from.length)>=0)throw new Error(`Pacefold 21 ${label} anchor is ambiguous`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

async function syntaxCheck(file){
  const source=await fs.readFile(file,'utf8');
  new vm.Script(source,{filename:file});
  if(/\.innerHTML\s*=/.test(source))throw new Error(`${path.basename(file)} contains a raw innerHTML assignment`);
  if(/style\s*=\s*["']/.test(source))throw new Error(`${path.basename(file)} contains an inline style string`);
}

async function installAssets(){
  await Promise.all([
    fs.copyFile(bootSource,path.join(targetApp,'pacefold-v21-boot.js')),
    fs.copyFile(cssSource,path.join(targetApp,'pacefold-v21.css')),
    fs.copyFile(scriptSource,path.join(targetApp,'pacefold-v21.js')),
    fs.copyFile(persistenceSource,path.join(targetApp,'pacefold-v21-persistence.js'))
  ]);
}

async function patchAppHtml(file){
  let html=await fs.readFile(file,'utf8');
  html=html
    .replace(/\s*<meta\s+name=["']pacefold-experience["'][^>]*>/gi,'')
    .replace(/\s*<link[^>]+data-pacefold-v21[^>]*>/gi,'')
    .replace(/\s*<script[^>]+data-pacefold-v21(?:-boot|-persistence)?[^>]*><\/script>/gi,'');

  const meta=`<meta name="pacefold-experience" content="${RELEASE}">`;
  const style=`<link rel="stylesheet" href="./pacefold-v21.css?v=${RELEASE}" data-pacefold-v21="${RELEASE}">`;
  const boot=`<script src="./pacefold-v21-boot.js?v=${RELEASE}" data-pacefold-v21-boot="${RELEASE}"></script>`;
  const script=`<script defer src="./pacefold-v21.js?v=${RELEASE}" data-pacefold-v21="${RELEASE}"></script>`;
  const persistence=`<script defer src="./pacefold-v21-persistence.js?v=${RELEASE}" data-pacefold-v21-persistence="${RELEASE}"></script>`;
  html=replaceExactlyOnce(html,'</head>',`${meta}\n${style}\n</head>`,'app head');
  html=replaceExactlyOnce(html,'<script src="./app.js" defer></script>',`${boot}\n<script src="./app.js" defer></script>`,'boot order');
  html=replaceExactlyOnce(html,'</body>',`${script}\n${persistence}\n</body>`,'runtime order');
  await fs.writeFile(file,html);
}

function nextCacheName(name){
  if(name.includes(RELEASE))return name;
  if(/-20\.0\.1$/.test(name))return name.replace(/-20\.0\.1$/,`-${RELEASE}`);
  return `${name}-${RELEASE}`;
}

async function patchWorker(file,{root=false}={}){
  let worker;
  try{worker=await fs.readFile(file,'utf8');}catch{return;}
  worker=worker.replace(
    /(const\s+CACHE_NAME\s*=\s*)([`'"])(pacefold-[^`'"]+)(\2)\s*;/,
    (_,prefix,quote,name)=>`${prefix}${quote}${nextCacheName(name)}${quote};`
  );
  const prefix=root?'./app/':'./';
  const anchor=`'${prefix}pacefold-v20.js'`;
  const additions=[
    `'${prefix}pacefold-v21.css'`,
    `'${prefix}pacefold-v21-boot.js'`,
    `'${prefix}pacefold-v21.js'`,
    `'${prefix}pacefold-v21-persistence.js'`
  ];
  if(!worker.includes(additions[0])){
    if(worker.includes(anchor))worker=worker.replace(anchor,[anchor,...additions].join(','));
    else worker+=`\n/* pacefold-v21-offline-assets ${additions.join(',')} */\n`;
  }else if(!worker.includes(additions[3])){
    worker=worker.replace(additions[2],[additions[2],additions[3]].join(','));
  }
  worker=worker.replace(/\/\* pacefold-experience:[^*]+\*\//g,'').replace(/\s+$/,'');
  worker+=`\n/* pacefold-experience:${RELEASE} */\n`;
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
  const css=await fs.readFile(path.join(targetApp,'pacefold-v21.css'),'utf8');
  const runtime=await fs.readFile(path.join(targetApp,'pacefold-v21.js'),'utf8');
  const persistence=await fs.readFile(path.join(targetApp,'pacefold-v21-persistence.js'),'utf8');
  if((html.match(/data-pacefold-v21="21\.0\.0"/g)||[]).length!==2)throw new Error('Pacefold 21 CSS and runtime were not injected exactly once');
  if((html.match(/data-pacefold-v21-boot="21\.0\.0"/g)||[]).length!==1)throw new Error('Pacefold 21 boot was not injected exactly once');
  if((html.match(/data-pacefold-v21-persistence="21\.0\.0"/g)||[]).length!==1)throw new Error('Pacefold 21 persistence runtime was not injected exactly once');
  if(!html.includes('name="pacefold-experience" content="21.0.0"'))throw new Error('Pacefold 21 app marker is missing');
  for(const asset of ['pacefold-v21.css','pacefold-v21-boot.js','pacefold-v21.js','pacefold-v21-persistence.js'])if(!worker.includes(asset))throw new Error(`Offline shell omits ${asset}`);
  for(const token of ['pf21-dayline','pf21-note-calendar','pf21-settings','pacefold.v21.preferences.v1'])if(!runtime.includes(token))throw new Error(`Pacefold 21 runtime token missing: ${token}`);
  if(!persistence.includes('pacefold.v21.settings.v1'))throw new Error('Pacefold 21 extension settings persistence is missing');
  for(const token of ['.pf21-dayline','.pf21-note-calendar','#panel #pf21-settings','data-pf21-advanced'])if(!css.includes(token))throw new Error(`Pacefold 21 CSS token missing: ${token}`);
}

await Promise.all([syntaxCheck(bootSource),syntaxCheck(scriptSource),syntaxCheck(persistenceSource)]);
await installAssets();
await patchAppHtml(path.join(targetApp,'index.html'));
await patchLanding(path.join(targetRoot,'index.html'));
await patchWorker(path.join(targetRoot,'service-worker.js'),{root:true});
await patchWorker(path.join(targetApp,'service-worker.js'),{root:false});
await fs.writeFile(path.join(targetRoot,'pacefold-experience.txt'),`${RELEASE}\n`);
await fs.writeFile(path.join(targetApp,'pacefold-experience.txt'),`${RELEASE}\n`);
await verify();
console.log(`Installed Pacefold ${RELEASE}: focused dayline, note activity calendar, simple persistent settings and lossless setup migration.`);
