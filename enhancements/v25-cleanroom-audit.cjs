'use strict';
const fs=require('node:fs');
const path=require('node:path');
const site=path.resolve(process.argv[2]||'_site');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
function walk(dir,prefix=''){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const rel=path.posix.join(prefix,entry.name),full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(full,rel));else out.push(rel);
  }
  return out.sort();
}
const files=walk(site),appHtml=fs.readFileSync(path.join(site,'app','index.html'),'utf8'),publicHtml=fs.readFileSync(path.join(site,'index.html'),'utf8'),worker=fs.readFileSync(path.join(site,'service-worker.js'),'utf8'),appWorker=fs.readFileSync(path.join(site,'app','service-worker.js'),'utf8');
const obsoletePath=/(^|\/)(?:pacefold-(?:ma(?:\.|-)|hub(?:\.|-)|integrated(?:\.|-)|revamp(?:\.|-)|resilience(?:\.|-)|theme-boot(?:\.|-)|v(?:19|20|21|22|23|24)(?:\.|-)|public-v24(?:\.|-)|site-v19(?:\.|-)|daylight(?:\.|-)|hub-version(?:\.|-))|ONENOTE_SETUP\.md$)/i;
const relicFiles=files.filter(file=>obsoletePath.test(file));
assert(!relicFiles.length,`Legacy files leaked into Pages artifact: ${relicFiles.join(', ')}`);
const activeRelic=/(?:pacefold-(?:ma|hub|integrated|revamp|resilience|theme-boot|v(?:19|20|21|22|23|24)|public-v24|site-v19)|15\.2\.2|20\.0\.1|22\.0\.2|24\.0\.0)/i;
for(const [label,text] of [['app/index.html',appHtml],['index.html',publicHtml],['service-worker.js',worker],['app/service-worker.js',appWorker]]){
  const match=text.match(activeRelic);
  assert(!match,`${label} still exposes legacy token ${JSON.stringify(match?.[0]||'unknown')}`);
}
const required=[
  'pacefold-v25-public.css','pacefold-v25-public.js','pacefold-build.txt','pacefold-experience.txt','pacefold-stability.txt',
  'app/pacefold-v25-shell-boot.css','app/pacefold-v25-core.css','app/pacefold-v25-theme-boot.js','app/pacefold-v25-preboot.js','app/pacefold-v25-boot.js','app/pacefold-v25-core.js','app/pacefold-v25-recovery.css','app/pacefold-v25-recovery.js','app/pacefold-build.txt','app/pacefold-experience.txt','app/pacefold-stability.txt'
];
for(const file of required)assert(files.includes(file),`Cleanroom artifact is missing ${file}`);
for(const file of ['pacefold-build.txt','pacefold-experience.txt','pacefold-stability.txt','app/pacefold-build.txt','app/pacefold-experience.txt','app/pacefold-stability.txt']){
  const marker=fs.readFileSync(path.join(site,file),'utf8').trim();
  assert(marker==='25.0.0 cleanroom-r1'||marker==='25.0.0 canonical-r1',`${file} does not identify an accepted V25 transition payload`);
}
assert(appHtml.includes('data-pacefold-v25-shell="25.0.0"'),'V25 shell bundle is not active');
assert(appHtml.includes('data-pacefold-v25-core-css="25.0.0"'),'V25 core CSS bundle is not active');
assert(appHtml.includes('data-pacefold-v25-theme="25.0.0"'),'V25 theme boot bundle is not active');
assert(appHtml.includes('data-pacefold-v25-preboot="25.0.0"'),'V25 preboot bundle is not active');
assert(appHtml.includes('data-pacefold-v25-core="25.0.0"'),'V25 core runtime bundle is not active');
assert(publicHtml.includes('pacefold-v25-public.css')&&publicHtml.includes('pacefold-v25-public.js'),'Public site still references a pre-V25 product bundle');
assert(worker.includes("const VERSION='25.0.0'"), 'Root worker does not identify V25');
assert(worker.includes("const CACHE_NAME='pacefold-25.0.0-cleanroom-r1'"),'Root worker cache is not the cleanroom cache');
console.log(JSON.stringify({release:'25.0.0',revision:'transition-clean',files:files.length,relicFiles:0,activeProductAssets:required.filter(file=>/pacefold-v25/.test(file)).length,staleVersionMarkers:0,worker:'clean V25 root worker'},null,2));
