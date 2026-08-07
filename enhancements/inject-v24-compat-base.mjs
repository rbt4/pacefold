import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));

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

console.log('Prepared Pacefold 24 compatibility base without former Ma runtime or historical audit gates.');
