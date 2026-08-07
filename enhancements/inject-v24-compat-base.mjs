import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const targetRoot=path.resolve(process.argv[2]||'_site');
const targetApp=path.join(targetRoot,'app');

function replaceOnce(source,pattern,replacement,label){
  const matches=source.match(pattern)||[];
  if(matches.length!==1)throw new Error(`Pacefold 24 compatibility adapter expected one ${label}, found ${matches.length}`);
  return source.replace(pattern,replacement);
}

async function runGenerated(name,transform){
  const sourcePath=path.join(root,name);
  let source=await fs.readFile(sourcePath,'utf8');
  source=transform(source);
  const generated=path.join(root,`.pacefold-v24-${name.replace(/[^a-z0-9]+/gi,'-')}.generated.mjs`);
  await fs.writeFile(generated,source);
  try{
    await import(`${pathToFileURL(generated).href}?v=${Date.now()}`);
  }finally{
    await fs.unlink(generated).catch(()=>{});
  }
}

async function hardenSpatialRenderer(){
  const file=path.join(targetApp,'pacefold-v22-spatial.js');
  let source=await fs.readFile(file,'utf8');
  source=replaceOnce(
    source,
    /function renderClock\(\)\{\n/,
    "function renderClock(){\n  if(!id('pf22-time-main')||!$('.pf22-seconds')||!$('.pf22-ampm')||!id('pf22-date')||!id('pf22-status')||!$('.pf22-progress-fill')||!id('pf22-context-glimpse'))return;\n",
    'unified clock ownership guard'
  );
  source=replaceOnce(
    source,
    /root\.dataset\.quiet=String\(quiet\);id\('pf22-quiet'\)\.dataset\.active=String\(quiet\);/,
    "root.dataset.quiet=String(quiet);const quietButton=id('pf22-quiet');if(quietButton)quietButton.dataset.active=String(quiet);",
    'retired quiet control guard'
  );
  new vm.Script(source,{filename:file});
  await fs.writeFile(file,source);
}

await runGenerated('inject.mjs',source=>{
  source=replaceOnce(
    source,
    /await patchMaQuietController\(path\.join\(targetApp,'pacefold-ma\.js'\)\);\n/,
    "/* Pacefold 24: former Ma runtime is not part of the public product. */\n",
    'former Ma runtime patch call'
  );
  source=replaceOnce(
    source,
    /if\(process\.env\.GITHUB_ACTIONS==='true'\)\{\n[\s\S]*?\n\}\n\nconst sources=/,
    "/* Pacefold 24: historical regression-audit mutation is intentionally disabled. */\n\nconst sources=",
    'historical CI audit mutation block'
  );
  return source;
});

await import(`${pathToFileURL(path.join(root,'inject-v22-hardening.mjs')).href}?v=${Date.now()}`);

await runGenerated('inject-v22-daylight.mjs',source=>{
  const forbidden=[
    "const ma=await fs.readFile(path.join(targetApp,'pacefold-ma.js'),'utf8');",
    "const maAudit=await fs.readFile(path.join(sourceRoot,'ma-audit.cjs'),'utf8');",
    "if(ma.includes(\"prefs.quietMode||prefs.taskbarBadge===false\")",
    "if(!ma.includes('window.__PACEFOLD_CUES__?.count?.()'))",
    "if(!maAudit.includes('quiet.badge===quietBefore.taskbarBadgeMode'))",
    "await patchMaQuietBadgePolicy(path.join(targetApp,'pacefold-ma.js'));",
    "await patchMaAuditContract(path.join(sourceRoot,'ma-audit.cjs'));"
  ];
  for(const marker of forbidden){
    const count=source.split(marker).length-1;
    if(count!==1)throw new Error(`Pacefold 24 compatibility adapter expected one legacy marker ${marker}, found ${count}`);
  }
  source=source.split('\n').filter(line=>!forbidden.some(marker=>line.includes(marker))).join('\n');
  return source;
});

await hardenSpatialRenderer();
console.log('Prepared Pacefold 24 compatibility base without former Ma runtime or historical audit gates, with unified navigation-safe spatial rendering.');
