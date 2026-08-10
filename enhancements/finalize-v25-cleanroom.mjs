import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const RELEASE='25.0.0';
const REVISION='cleanroom-r1';
const root=path.resolve(process.argv[2]||'_site');
const app=path.join(root,'app');
const sourceRoot=path.dirname(fileURLToPath(import.meta.url));

const appBundles={
  shellCss:{out:'pacefold-v25-shell-boot.css',files:['pacefold-v23-boot.css']},
  coreCss:{out:'pacefold-v25-core.css',files:['pacefold-hub.css','pacefold-integrated.css','pacefold-revamp.css','pacefold-v19.css','pacefold-v20.css','pacefold-v23.css','pacefold-v24.css']},
  themeBoot:{out:'pacefold-v25-theme-boot.js',files:['pacefold-theme-boot.js']},
  preboot:{out:'pacefold-v25-preboot.js',files:['pacefold-v21-boot.js','pacefold-v23-bootstrap.js','pacefold-v24-kernel.js']},
  coreJs:{out:'pacefold-v25-core.js',files:['pacefold-hub-guardian.js','pacefold-resilience.js','pacefold-hub.js','pacefold-integrated.js','pacefold-revamp.js','pacefold-v19.js','pacefold-v20.js','pacefold-v23.js','pacefold-v24.js']}
};

function exactlyOne(source,pattern,label){
  const matches=[...source.matchAll(pattern)];
  if(matches.length!==1)throw new Error(`Pacefold 25 cleanroom expected one ${label}, found ${matches.length}`);
  return matches[0];
}
function removeByBasenames(html,basenames,kind){
  for(const basename of basenames){
    const escaped=basename.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const pattern=kind==='style'
      ?new RegExp(`\\s*<link[^>]+href=["']\\./${escaped}(?:\\?[^"']*)?["'][^>]*>`,`gi`)
      :new RegExp(`\\s*<script[^>]+src=["']\\./${escaped}(?:\\?[^"']*)?["'][^>]*><\\/script>`,`gi`);
    const matches=html.match(pattern)||[];
    if(matches.length!==1)throw new Error(`Pacefold 25 cleanroom expected one ${basename} ${kind} tag, found ${matches.length}`);
    html=html.replace(pattern,'');
  }
  return html;
}
async function bundle(target,files,{js=false}={}){
  const parts=[];
  for(const file of files){
    const source=await fs.readFile(path.join(app,file),'utf8');
    if(js)new vm.Script(source,{filename:file});
    parts.push(source.trim());
  }
  const content=`/* Pacefold ${RELEASE} ${REVISION} compatibility consolidation. */\n${parts.join('\n;\n')}\n`;
  if(js)new vm.Script(content,{filename:target});
  await fs.writeFile(path.join(app,target),content);
}
async function buildBundles(){
  for(const spec of Object.values(appBundles))await bundle(spec.out,spec.files,{js:spec.out.endsWith('.js')});
  await fs.copyFile(path.join(root,'pacefold-public-v24.css'),path.join(root,'pacefold-v25-public.css'));
  await fs.copyFile(path.join(root,'pacefold-public-v24.js'),path.join(root,'pacefold-v25-public.js'));
}
async function patchAppHtml(){
  const file=path.join(app,'index.html');
  let html=await fs.readFile(file,'utf8');
  exactlyOne(html,/<link[^>]+href=["']\.\/pacefold-v23-boot\.css(?:\?[^"']*)?["'][^>]*>/gi,'legacy shell CSS anchor');
  exactlyOne(html,/<script[^>]+src=["']\.\/pacefold-theme-boot\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi,'legacy theme boot anchor');
  exactlyOne(html,/<script[^>]+src=["']\.\/pacefold-v25-boot\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi,'V25 boot anchor');
  exactlyOne(html,/<script[^>]+src=["']\.\/pacefold-v25-recovery\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi,'V25 recovery anchor');
  html=removeByBasenames(html,appBundles.shellCss.files,'style');
  html=removeByBasenames(html,appBundles.coreCss.files,'style');
  html=removeByBasenames(html,appBundles.themeBoot.files,'script');
  html=removeByBasenames(html,appBundles.preboot.files,'script');
  html=removeByBasenames(html,appBundles.coreJs.files,'script');
  html=html.replace('</head>',`<link rel="stylesheet" href="./${appBundles.shellCss.out}?v=${RELEASE}-${REVISION}" data-pacefold-v25-shell="${RELEASE}">\n</head>`);
  const baseStyleAnchor='<link rel="stylesheet" href="./pacefold-v25-recovery.css?v=25.0.0-recovery-r2" data-pacefold-v25-css="25.0.0">';
  if(!html.includes(baseStyleAnchor))throw new Error('Pacefold 25 recovery stylesheet anchor missing');
  html=html.replace(baseStyleAnchor,`<link rel="stylesheet" href="./${appBundles.coreCss.out}?v=${RELEASE}-${REVISION}" data-pacefold-v25-core-css="${RELEASE}">\n${baseStyleAnchor}`);
  const vendorAnchor='<script src="./vendor/msal-browser-5.17.1.min.js"></script>';
  if(!html.includes(vendorAnchor))throw new Error('MSAL anchor missing');
  html=html.replace(vendorAnchor,`<script src="./${appBundles.themeBoot.out}?v=${RELEASE}-${REVISION}" data-pacefold-v25-theme="${RELEASE}"></script>\n${vendorAnchor}`);
  const bootAnchor=html.match(/<script[^>]+src=["']\.\/pacefold-v25-boot\.js(?:\?[^"']*)?["'][^>]*><\/script>/i)?.[0];
  if(!bootAnchor)throw new Error('V25 boot tag missing after cleanup');
  html=html.replace(bootAnchor,`<script src="./${appBundles.preboot.out}?v=${RELEASE}-${REVISION}" data-pacefold-v25-preboot="${RELEASE}"></script>\n${bootAnchor}`);
  const recoveryAnchor=html.match(/<script[^>]+src=["']\.\/pacefold-v25-recovery\.js(?:\?[^"']*)?["'][^>]*><\/script>/i)?.[0];
  if(!recoveryAnchor)throw new Error('V25 recovery tag missing after cleanup');
  html=html.replace(recoveryAnchor,`<script defer src="./${appBundles.coreJs.out}?v=${RELEASE}-${REVISION}" data-pacefold-v25-core="${RELEASE}"></script>\n${recoveryAnchor}`);
  html=html.replace(/\s*<meta\s+name=["']pacefold-release["'][^>]*>/gi,'').replace('</head>',`<meta name="pacefold-release" content="${REVISION}">\n</head>`);
  await fs.writeFile(file,html);
}
async function patchPublicHtml(){
  const file=path.join(root,'index.html');
  let html=await fs.readFile(file,'utf8');
  html=html.replace(/pacefold-public-v24\.css(?:\?[^"']*)?/g,`pacefold-v25-public.css?v=${RELEASE}-${REVISION}`)
           .replace(/pacefold-public-v24\.js(?:\?[^"']*)?/g,`pacefold-v25-public.js?v=${RELEASE}-${REVISION}`)
           .replace(/\s*<meta\s+name=["']pacefold-landing["'][^>]*>/gi,'')
           .replace('</head>',`<meta name="pacefold-landing" content="${REVISION}">\n</head>`);
  await fs.writeFile(file,html);
}
async function replaceWorkers(){
  await fs.copyFile(path.join(sourceRoot,'pacefold-v25-service-worker.js'),path.join(root,'service-worker.js'));
  await fs.copyFile(path.join(sourceRoot,'pacefold-v25-app-migration-worker.js'),path.join(app,'service-worker.js'));
  new vm.Script(await fs.readFile(path.join(root,'service-worker.js'),'utf8'),{filename:'service-worker.js'});
  new vm.Script(await fs.readFile(path.join(app,'service-worker.js'),'utf8'),{filename:'app/service-worker.js'});
}
async function cleanupFiles(){
  const names=await fs.readdir(app);
  const keep=new Set([
    'pacefold-v25-shell-boot.css','pacefold-v25-core.css','pacefold-v25-theme-boot.js','pacefold-v25-preboot.js','pacefold-v25-boot.js','pacefold-v25-core.js','pacefold-v25-recovery.css','pacefold-v25-recovery.js',
    'pacefold-experience.txt','pacefold-stability.txt','pacefold-build.txt','pacefold-fold-mark.svg'
  ]);
  for(const name of names){
    if(!name.startsWith('pacefold-')||keep.has(name))continue;
    await fs.rm(path.join(app,name),{recursive:true,force:true});
  }
  await fs.rm(path.join(app,'fonts','pacefold-ma.woff2'),{force:true}).catch(()=>{});
  await fs.rm(path.join(app,'fonts','OFL.txt'),{force:true}).catch(()=>{});
  try{if(!(await fs.readdir(path.join(app,'fonts'))).length)await fs.rmdir(path.join(app,'fonts'));}catch{}
  for(const name of ['pacefold-public-v24.css','pacefold-public-v24.js','pacefold-site-ma.css','pacefold-site-v19.css','pacefold-hub-version.txt','pacefold-daylight.txt','ONENOTE_SETUP.md'])await fs.rm(path.join(root,name),{force:true});
  await fs.rm(path.join(app,'pacefold-daylight.txt'),{force:true});
  const build=`${RELEASE} ${REVISION}\n`;
  await fs.writeFile(path.join(root,'pacefold-build.txt'),build);await fs.writeFile(path.join(app,'pacefold-build.txt'),build);
  await fs.writeFile(path.join(root,'pacefold-experience.txt'),build);await fs.writeFile(path.join(app,'pacefold-experience.txt'),build);
  await fs.writeFile(path.join(root,'pacefold-stability.txt'),build);await fs.writeFile(path.join(app,'pacefold-stability.txt'),build);
}
async function verify(){
  const appHtml=await fs.readFile(path.join(app,'index.html'),'utf8'),publicHtml=await fs.readFile(path.join(root,'index.html'),'utf8'),worker=await fs.readFile(path.join(root,'service-worker.js'),'utf8');
  const forbidden=/(?:pacefold-(?:ma|hub|integrated|revamp|resilience|theme-boot|v(?:19|20|21|22|23|24)|public-v24|site-v19)|pacefold-daylight|pacefold-hub-version)/i;
  if(forbidden.test(appHtml)||forbidden.test(publicHtml)||forbidden.test(worker))throw new Error('Pacefold 25 cleanroom left a legacy asset reference in active HTML or worker');
  for(const token of ['pacefold-v25-shell-boot.css','pacefold-v25-core.css','pacefold-v25-theme-boot.js','pacefold-v25-preboot.js','pacefold-v25-core.js','pacefold-v25-recovery.js'])if(!appHtml.includes(token))throw new Error(`Pacefold 25 cleanroom app omits ${token}`);
  if(!publicHtml.includes('pacefold-v25-public.css')||!publicHtml.includes('pacefold-v25-public.js'))throw new Error('Pacefold 25 public bundle references are missing');
  if(!worker.includes("const VERSION='25.0.0'"))throw new Error('Pacefold 25 root worker version is stale');
}

await buildBundles();
await patchAppHtml();
await patchPublicHtml();
await replaceWorkers();
await cleanupFiles();
await verify();
console.log(`Finalized Pacefold ${RELEASE} ${REVISION}: active Pages payload contains only V25-named Pacefold product assets.`);
