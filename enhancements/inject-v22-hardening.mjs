import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const RELEASE='22.0.1';
const REVISION='22.0.1';
const sourceRoot=path.dirname(fileURLToPath(import.meta.url));
const targetRoot=path.resolve(process.argv[2]||'_site');
const targetApp=path.join(targetRoot,'app');
const cssName='pacefold-v22-hardening.css';
const recoveryCssName='pacefold-v22-recovery.css';
const jsName='pacefold-v22-hardening.js';

function replaceExactlyOnce(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error(`Pacefold hardening ${label} anchor is missing`);
  if(source.indexOf(from,first+from.length)>=0)throw new Error(`Pacefold hardening ${label} anchor is ambiguous`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}
function updateExperienceMeta(html){
  html=html.replace(/\s*<meta\s+name=["']pacefold-experience["'][^>]*>/gi,'');
  return replaceExactlyOnce(html,'</head>',`<meta name="pacefold-experience" content="${RELEASE}">\n</head>`,'experience meta');
}
async function patchAppHtml(file){
  let html=await fs.readFile(file,'utf8');
  html=html
    .replace(/\s*<link[^>]+data-pacefold-v22-hardening[^>]*>/gi,'')
    .replace(/\s*<link[^>]+data-pacefold-v22-recovery[^>]*>/gi,'')
    .replace(/\s*<script[^>]+data-pacefold-v22-hardening[^>]*><\/script>/gi,'');
  html=updateExperienceMeta(html);
  html=replaceExactlyOnce(html,'</head>',`<link rel="stylesheet" href="./${cssName}?v=${REVISION}" data-pacefold-v22-hardening="${RELEASE}">\n<link rel="stylesheet" href="./${recoveryCssName}?v=${REVISION}" data-pacefold-v22-recovery="${RELEASE}">\n</head>`,'hardening stylesheets');
  html=replaceExactlyOnce(html,'</body>',`<script defer src="./${jsName}?v=${REVISION}" data-pacefold-v22-hardening="${RELEASE}"></script>\n</body>`,'hardening runtime');
  await fs.writeFile(file,html);
}
async function patchLanding(file){
  let html=await fs.readFile(file,'utf8');
  html=updateExperienceMeta(html).replaceAll('Pacefold 22 · one quiet spatial workday','Pacefold 22.0.1 · one quiet spatial workday');
  await fs.writeFile(file,html);
}
function cacheName(name){return /-\d+\.\d+\.\d+$/.test(name)?name.replace(/-\d+\.\d+\.\d+$/,`-${REVISION}`):`${name}-${REVISION}`}
async function patchWorker(file,{root=false}={}){
  let worker;try{worker=await fs.readFile(file,'utf8')}catch{return}
  worker=worker.replace(/(const\s+CACHE_NAME\s*=\s*)([`'"])(pacefold-[^`'"]+)(\2)\s*;/,(_,prefix,quote,name)=>`${prefix}${quote}${cacheName(name)}${quote};`);
  const prefix=root?'./app/':'./',spatial=`'${prefix}pacefold-v22-spatial.js'`,assets=[`'${prefix}${cssName}'`,`'${prefix}${recoveryCssName}'`,`'${prefix}${jsName}'`];
  for(const asset of assets){if(worker.includes(asset))continue;if(worker.includes(spatial))worker=worker.replace(spatial,`${spatial},${assets.join(',')}`);else worker+=`\n/* pacefold-v22-hardening-assets ${assets.join(',')} */\n`;break}
  worker=worker.replace(/\/\* pacefold-experience:[^*]+\*\//g,'').replace(/\s+$/,'');
  worker+=`\n/* pacefold-experience:${RELEASE};revision:${REVISION} */\n`;
  await fs.writeFile(file,worker);
}
async function verify(){
  const html=await fs.readFile(path.join(targetApp,'index.html'),'utf8'),worker=await fs.readFile(path.join(targetRoot,'service-worker.js'),'utf8'),js=await fs.readFile(path.join(targetApp,jsName),'utf8');
  if((html.match(new RegExp(`data-pacefold-v22-hardening="${RELEASE.replace(/\./g,'\\.')}"`,'g'))||[]).length!==2)throw new Error('Hardening asset injection count is wrong');
  if((html.match(new RegExp(`data-pacefold-v22-recovery="${RELEASE.replace(/\./g,'\\.')}"`,'g'))||[]).length!==1)throw new Error('Recovery stylesheet injection count is wrong');
  if(!html.includes(`<meta name="pacefold-experience" content="${RELEASE}">`))throw new Error('Hardening experience meta is stale');
  for(const asset of [cssName,recoveryCssName,jsName])if(!worker.includes(asset))throw new Error(`Offline shell omits ${asset}`);
  if(!worker.includes(`revision:${REVISION}`))throw new Error('Offline shell hardening revision is stale');
  for(const token of [`const RELEASE='${RELEASE}'`,'setNotifications','openSound','pf22-sound-overlay','buildNoteInsights'])if(!js.includes(token))throw new Error(`Hardening runtime token missing: ${token}`);
}

const runtime=await fs.readFile(path.join(sourceRoot,jsName),'utf8');
new vm.Script(runtime,{filename:jsName});
if(/\.innerHTML\s*=|style\s*=\s*["']/.test(runtime))throw new Error('Hardening runtime contains unsafe DOM construction');
await Promise.all([
  fs.copyFile(path.join(sourceRoot,cssName),path.join(targetApp,cssName)),
  fs.copyFile(path.join(sourceRoot,recoveryCssName),path.join(targetApp,recoveryCssName)),
  fs.copyFile(path.join(sourceRoot,jsName),path.join(targetApp,jsName))
]);
await patchAppHtml(path.join(targetApp,'index.html'));
await patchLanding(path.join(targetRoot,'index.html'));
await patchWorker(path.join(targetRoot,'service-worker.js'),{root:true});
await patchWorker(path.join(targetApp,'service-worker.js'));
await fs.writeFile(path.join(targetRoot,'pacefold-experience.txt'),`${RELEASE}\n`);
await fs.writeFile(path.join(targetApp,'pacefold-experience.txt'),`${RELEASE}\n`);
await verify();
console.log(`Installed Pacefold ${RELEASE} Spatial Fold control hardening and visual recovery.`);
