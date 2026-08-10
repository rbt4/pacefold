import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'_site');
const RELEASE='25.0.0';
const REVISION='canonical-r1';
const VERSION_RELICS=['15.2.2','15.8.0','16.0.0','16.0.1','17.1.0','20.0.1','21.3.1','22.0.0','22.0.1','22.0.2','23.0.0','24.0.0'];
const GLOBAL_RENAMES={
  '__PACEFOLD_MA_CORE__':'__PACEFOLD_RUNTIME_CORE__',
  '__PACEFOLD_MA_VIEW__':'__PACEFOLD_VIEW__',
  '__PACEFOLD_MA_SCHEDULER__':'__PACEFOLD_SCHEDULER__',
  '__PACEFOLD_MA_DELIVER__':'__PACEFOLD_DELIVERY__',
  '__PACEFOLD_MA_QUIET__':'__PACEFOLD_QUIET__',
  '__PACEFOLD_MA_STORAGE__':'__PACEFOLD_STORAGE__',
  '__PACEFOLD_MA_BACKUP__':'__PACEFOLD_BACKUP__',
  '__PACEFOLD_MA_EXPORT__':'__PACEFOLD_EXPORT__',
  '__PACEFOLD_V19_CORE__':'__PACEFOLD_ACTIVITY_CORE__',
  '__PACEFOLD_V19__':'__PACEFOLD_ACTIVITY__',
  '__PACEFOLD_V21_PERSISTENCE__':'__PACEFOLD_PERSISTENCE__',
  '__PACEFOLD_V21_REFINEMENT__':'__PACEFOLD_REFINEMENT__',
  '__PACEFOLD_V21_PRECISION__':'__PACEFOLD_PRECISION__',
  '__PACEFOLD_V21_BOOT__':'__PACEFOLD_STARTUP__',
  '__PACEFOLD_V21__':'__PACEFOLD_RUNTIME__',
  '__PACEFOLD_V23__':'__PACEFOLD_EXPERIENCE__',
  '__PACEFOLD_REVAMP__':'__PACEFOLD_WORKSPACE__',
  '__PACEFOLD_DAYLIGHT__':'__PACEFOLD_DAY_VISUAL__',
  '__PACEFOLD_156_BOOTED__':'__PACEFOLD_ENGINE_BOOTED__'
};
const TEXT_EXT=new Set(['.js','.css','.html','.txt','.webmanifest','.xml','.svg']);

async function walk(dir){
  const out=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...await walk(full));else out.push(full);
  }
  return out;
}
async function sanitizeText(){
  for(const file of await walk(root)){
    if(!TEXT_EXT.has(path.extname(file).toLowerCase()))continue;
    let source;try{source=await fs.readFile(file,'utf8')}catch{continue}
    let next=source;
    for(const [from,to] of Object.entries(GLOBAL_RENAMES))next=next.split(from).join(to);
    for(const version of VERSION_RELICS)next=next.split(version).join(RELEASE);
    next=next.replace(/\/\*\s*bundled:pacefold-v(?:21|22|23)[^*]*\*\/\s*/gi,'');
    if(next!==source)await fs.writeFile(file,next);
  }
}
async function renameRuntimeFiles(){
  const appIndex=path.join(root,'app','index.html'),publicIndex=path.join(root,'index.html'),worker=path.join(root,'service-worker.js');
  let appHtml=await fs.readFile(appIndex,'utf8'),publicHtml=await fs.readFile(publicIndex,'utf8'),sw=await fs.readFile(worker,'utf8');
  appHtml=appHtml.replace(/\.\/app\.js(?:\?[^"']*)?/g,`./pacefold-v25-engine.js?v=${RELEASE}-${REVISION}`);
  publicHtml=publicHtml.replace(/\.\/site\.js(?:\?[^"']*)?/g,`./pacefold-v25-site.js?v=${RELEASE}-${REVISION}`);
  sw=sw.replace(/\.\/site\.js/g,'./pacefold-v25-site.js').replace(/\.\/app\/app\.js/g,'./app/pacefold-v25-engine.js');
  await fs.writeFile(appIndex,appHtml);await fs.writeFile(publicIndex,publicHtml);await fs.writeFile(worker,sw);
  await fs.rename(path.join(root,'app','app.js'),path.join(root,'app','pacefold-v25-engine.js'));
  await fs.rename(path.join(root,'site.js'),path.join(root,'pacefold-v25-site.js'));
}
async function markCanonical(){
  const marker=`${RELEASE} ${REVISION}\n`;
  for(const file of ['pacefold-build.txt','pacefold-experience.txt','pacefold-stability.txt']){
    await fs.writeFile(path.join(root,file),marker);await fs.writeFile(path.join(root,'app',file),marker);
  }
  await fs.writeFile(path.join(root,'pacefold-canonical.txt'),marker);
  let appHtml=await fs.readFile(path.join(root,'app','index.html'),'utf8');
  appHtml=appHtml.replace(/\s*<meta\s+name=["']pacefold-build["'][^>]*>/gi,'').replace(/\s*<meta\s+name=["']pacefold-release["'][^>]*>/gi,'').replace('</head>',`<meta name="pacefold-build" content="${RELEASE} ${REVISION}">\n<meta name="pacefold-release" content="${REVISION}">\n</head>`);
  await fs.writeFile(path.join(root,'app','index.html'),appHtml);
}
async function verify(){
  const active=['index.html','service-worker.js','pacefold-v25-site.js','onenote-setup.html','app/index.html','app/service-worker.js','app/pacefold-v25-engine.js','app/pacefold-v25-preboot.js','app/pacefold-v25-core.js','app/pacefold-v25-recovery.js','app/pacefold-v25-core.css'];
  const forbiddenGlobal=/__PACEFOLD_(?:MA_|V19|V21|V23|156_)/;
  const forbiddenVersions=new RegExp(VERSION_RELICS.map(value=>value.replace(/\./g,'\\.')).join('|'));
  for(const rel of active){
    const source=await fs.readFile(path.join(root,rel),'utf8');
    if(forbiddenGlobal.test(source))throw new Error(`Canonical V25 still exposes an old runtime namespace in ${rel}`);
    if(forbiddenVersions.test(source))throw new Error(`Canonical V25 still exposes an old product version in ${rel}`);
  }
  const appHtml=await fs.readFile(path.join(root,'app','index.html'),'utf8'),publicHtml=await fs.readFile(path.join(root,'index.html'),'utf8'),sw=await fs.readFile(path.join(root,'service-worker.js'),'utf8');
  if(!appHtml.includes('pacefold-v25-engine.js'))throw new Error('Canonical V25 engine filename is not active');
  if(!publicHtml.includes('pacefold-v25-site.js'))throw new Error('Canonical V25 site runtime filename is not active');
  if(!sw.includes('./app/pacefold-v25-engine.js')||!sw.includes('./pacefold-v25-site.js'))throw new Error('Canonical V25 worker still caches pre-canonical runtime filenames');
}

await sanitizeText();
await renameRuntimeFiles();
await markCanonical();
await verify();
console.log(`Canonicalized Pacefold ${RELEASE} ${REVISION}; old runtime namespaces/version identities removed while persistent data schema keys remain compatible.`);
