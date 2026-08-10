'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(process.argv[2]||'canonical');
const fail=message=>{throw new Error(message)};
const walk=(dir,prefix='')=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const rel=path.posix.join(prefix,entry.name),full=path.join(dir,entry.name);return entry.isDirectory()?walk(full,rel):[rel]}).sort();
const files=walk(root);
const obsoletePath=/(^|\/)(?:pacefold-(?:ma(?:\.|-)|hub(?:\.|-)|integrated(?:\.|-)|revamp(?:\.|-)|resilience(?:\.|-)|theme-boot(?:\.|-)|v(?:19|20|21|22|23|24)(?:\.|-)|public-v24(?:\.|-)|site-v19(?:\.|-)|daylight(?:\.|-)|hub-version(?:\.|-))|ONENOTE_SETUP\.md$)/i;
const relicFiles=files.filter(file=>obsoletePath.test(file));
if(relicFiles.length)fail(`Legacy files in canonical runtime: ${relicFiles.join(', ')}`);

const oldGlobal=/__PACEFOLD_(?:MA_|V19|V21|V23|156_)/;
const oldVersion=/(?:15\.2\.2|15\.8\.0|16\.0\.0|16\.0\.1|17\.1\.0|20\.0\.1|21\.3\.1|22\.0\.0|22\.0\.1|22\.0\.2|23\.0\.0|24\.0\.0)/;
const textExtensions=new Set(['.html','.js','.css','.txt','.webmanifest','.svg','.xml','.md']);
const scanned=[];
for(const rel of files){
  if(!textExtensions.has(path.extname(rel).toLowerCase()))continue;
  let source;try{source=fs.readFileSync(path.join(root,rel),'utf8');}catch{continue;}
  scanned.push(rel);
  if(oldGlobal.test(source))fail(`Old runtime namespace in ${rel}`);
  if(oldVersion.test(source))fail(`Old product version in ${rel}`);
  const oldRuntimeIdentity=/(?:pf(?:-v)?(?:19|20|21|22|23|24)|Pacefold Ma|pf-hub|pf-resilience|pf-revamp|__PACEFOLD_RESILIENCE__|pacefold:(?:ma-|v(?:19|20|21|22|23|24))|\b(?:maDayConfig|maLastCueAt|pacefoldV19Weather|pacefoldV21Persistence|v19Dashboard|v19Ritual|v19Surface|v19WeatherDay|v19WorkbenchPage|v20Attention)\b)/;
  if(oldRuntimeIdentity.test(source))fail(`Historical runtime identity in ${rel}`);
}

for(const rel of ['pacefold-build.txt','pacefold-experience.txt','pacefold-stability.txt','pacefold-canonical.txt','app/pacefold-build.txt','app/pacefold-experience.txt','app/pacefold-stability.txt'])if(fs.readFileSync(path.join(root,rel),'utf8').trim()!=='25.0.0 canonical-r1')fail(`${rel} is not canonical-r1`);
const appHtml=fs.readFileSync(path.join(root,'app/index.html'),'utf8'),worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
if(!appHtml.includes('pacefold-v25-engine.js'))fail('Canonical engine is not active');
if(worker.includes('./site.js')||worker.includes('./app/app.js'))fail('Canonical service worker caches old/dead runtime names');
if(files.includes('site.js')||files.includes('app/app.js'))fail('Dead pre-canonical runtime file still exists');
if(files.some(file=>file.startsWith('.github/')||file.startsWith('scripts/')))fail('Build/repository machinery leaked into canonical product source');
console.log(JSON.stringify({release:'25.0.0',revision:'canonical-r1',files:files.length,textFilesScanned:scanned.length,relicFiles:0,oldRuntimeNamespaces:0,oldProductVersions:0,source:'direct canonical runtime'},null,2));
