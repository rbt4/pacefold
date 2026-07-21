import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import zlib from 'node:zlib';

const root=path.resolve(process.argv[2]||'.');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const exists=file=>fs.existsSync(path.join(root,file));
const fail=message=>{throw new Error(message)};
const list=(dir,pattern)=>fs.readdirSync(path.join(root,dir)).filter(name=>pattern.test(name)).sort().map(name=>path.posix.join(dir,name));
const appParts=list('app',/^app-js-\d+\.txt$/);
const tailParts=list('app',/^app-tail-\d+\.bin$/);
const appStyles=list('app',/^app-style-\d+\.css$/);
const siteStyles=list('.',/^site-style-\d+\.css$/).map(name=>name.replace(/^\.\//,''));
const required=[
  'index.html','site.js','privacy.html','404.html','manifest.webmanifest','service-worker.js','.nojekyll',
  'app/index.html','app/loader.js','app/service-worker.js',
  'app/icons/icon-32.png','app/icons/icon-192.png','app/icons/icon-512.png',
  ...siteStyles,...appStyles,...appParts,...tailParts
];
for(const file of required)if(!exists(file))fail(`Missing required file: ${file}`);
if(!appParts.length||!tailParts.length||!appStyles.length||!siteStyles.length)fail('Application source/style parts are incomplete');

const manifest=JSON.parse(read('manifest.webmanifest'));
if(manifest.scope!=='./')fail('Manifest scope must be ./');
if(!String(manifest.start_url||'').startsWith('./app/'))fail('Manifest start_url must open ./app/');
if(manifest.display!=='standalone')fail('Manifest display must be standalone');
for(const icon of manifest.icons||[]){
  const target=String(icon.src||'').replace(/^\.\//,'');
  if(!target||!exists(target))fail(`Manifest icon is missing: ${icon.src}`);
}

function pngSize(file){
  const b=fs.readFileSync(path.join(root,file));
  if(b.toString('hex',0,8)!=='89504e470d0a1a0a')fail(`${file} is not a PNG`);
  return[b.readUInt32BE(16),b.readUInt32BE(20)];
}
for(const size of [32,192,512]){
  const [w,h]=pngSize(`app/icons/icon-${size}.png`);
  if(w!==size||h!==size)fail(`icon-${size}.png is ${w}x${h}`);
}

const compressedTail=Buffer.concat(tailParts.map(file=>fs.readFileSync(path.join(root,file))));
const appJs=appParts.map(read).join('')+zlib.gunzipSync(compressedTail).toString('utf8');
const loaderJs=read('app/loader.js');
const worker=read('service-worker.js');
new vm.Script(appJs,{filename:'assembled-app.js'});
new vm.Script(loaderJs,{filename:'app/loader.js'});
const sourceHash=crypto.createHash('sha256').update(appJs).digest('hex');
if(!loaderJs.includes(sourceHash))fail('Loader application-integrity hash does not match assembled source');
for(const part of [...appParts,...tailParts])if(!loaderJs.includes(`./${path.basename(part)}`))fail(`Loader does not request ${part}`);
const appVersion=appJs.match(/const APP_VERSION='([^']+)'/)?.[1];
const workerVersion=worker.match(/const VERSION='([^']+)'/)?.[1];
if(!appVersion||appVersion!==workerVersion)fail(`Version mismatch: app=${appVersion}, worker=${workerVersion}`);
if(!appJs.includes("navigator.serviceWorker.register('../service-worker.js'"))fail('App does not register the root service worker');
if(!appJs.includes('requestNotifications')||!appJs.includes('runSelfCheck'))fail('Notification or self-check hardening is missing');
if(!worker.includes('notificationclick'))fail('Service worker notification click handling is missing');

function validateHtml(file){
  const html=read(file),base=path.dirname(file);
  const ids=[...html.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]);
  const duplicates=ids.filter((id,i)=>ids.indexOf(id)!==i);
  if(duplicates.length)fail(`${file} has duplicate ids: ${[...new Set(duplicates)].join(', ')}`);
  for(const match of html.matchAll(/\s(?:src|href)=["']([^"']+)["']/g)){
    let ref=match[1];
    if(!ref||ref.startsWith('#')||ref.startsWith('data:')||ref.startsWith('http:')||ref.startsWith('https:')||ref.startsWith('mailto:'))continue;
    ref=ref.split(/[?#]/)[0];if(!ref)continue;
    const target=path.normalize(path.join(base,ref));
    if(!exists(target)&&!exists(path.join(target,'index.html')))fail(`${file} references missing asset: ${match[1]}`);
  }
  for(const match of html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']https?:/gi))fail(`${file} loads an external runtime script or stylesheet`);
}
for(const file of ['index.html','privacy.html','404.html','app/index.html'])validateHtml(file);

const appHtml=read('app/index.html');
const staticIds=new Set([...appHtml.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]));
for(const match of appJs.matchAll(/\$\('([^']+)'\)/g)){
  const id=match[1];
  if(!staticIds.has(id))fail(`app source references missing DOM id: ${id}`);
}

const shell=[...worker.matchAll(/'\.\/([^']*)'/g)].map(m=>m[1]).filter(Boolean);
for(const ref of shell){
  const clean=ref.endsWith('/')?`${ref}index.html`:ref;
  if(!exists(clean))fail(`Service worker shell references missing file: ${ref}`);
}
for(const file of [...siteStyles,...appStyles])if(!read(file).trim())fail(`${file} is empty`);
if(exists('app/manifest.webmanifest'))fail('Legacy app-scoped manifest should not remain');
console.log(`Pacefold ${appVersion}: ${required.length} files, assembled source, manifest, icons, references, worker and DOM checks passed.`);
