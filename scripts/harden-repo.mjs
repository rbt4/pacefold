import fs from 'node:fs';
import path from 'node:path';

const repo=path.resolve(process.argv[2]||'.');
const p=(...parts)=>path.join(repo,...parts);
const read=file=>fs.readFileSync(p(file),'utf8');
const write=(file,value)=>fs.writeFileSync(p(file),value);
const fail=message=>{throw new Error(message);};
function replaceExact(source,needle,replacement,label,expected=1){const count=source.split(needle).length-1;if(count!==expected)fail(`${label}: expected ${expected}, found ${count}`);return source.split(needle).join(replacement);}

let inject=read('enhancements/inject.mjs');
inject=replaceExact(inject,"import { deflateSync, gunzipSync } from 'node:zlib';","import { deflateSync, gunzipSync } from 'node:zlib';\nimport { rewriteInnerHTMLAssignments } from '../scripts/trusted-types-transform.mjs';",'inject transformer import');
inject=replaceExact(inject,
  "for(const name of assets)await fs.copyFile(path.join(sourceRoot,name),path.join(appRoot,name));",
  "for(const name of assets){const source=path.join(sourceRoot,name),destination=path.join(appRoot,name);await fs.copyFile(source,destination);if(name.endsWith('.js'))await hardenTrustedScript(destination);}",
  'copied enhancement scripts');
inject=replaceExact(inject,
  "  if(name.endsWith('.css.gz.b64'))output+='\\n.pf-player-row.is-drop-target{outline:1px dashed var(--mint);outline-offset:-4px;background:color-mix(in srgb,var(--mint) 10%,transparent)}\\n';\n  await fs.writeFile(destination,output);",
  "  if(name.endsWith('.js.gz.b64'))output=rewriteInnerHTMLAssignments(output).source;\n  if(name.endsWith('.css.gz.b64'))output+='\\n.pf-player-row.is-drop-target{outline:1px dashed var(--mint);outline-offset:-4px;background:color-mix(in srgb,var(--mint) 10%,transparent)}\\n';\n  await fs.writeFile(destination,output);",
  'compressed runtime Trusted Types');
inject=replaceExact(inject,
  "function upgradeRuntimeVersion(source){",
  "async function hardenTrustedScript(file){const source=await fs.readFile(file,'utf8'),result=rewriteInnerHTMLAssignments(source);if(result.count)await fs.writeFile(file,result.source);}\n\nfunction upgradeRuntimeVersion(source){",
  'trusted script helper');
write('enhancements/inject.mjs',inject);

let workflow=read('.github/workflows/pages.yml');
workflow=replaceExact(workflow,'          node _release/scripts/build.mjs _release','          PACEFOLD_DEBUG=1 node _release/scripts/build.mjs _release','debug browser build');
workflow=replaceExact(workflow,
  '          node --check _release/app/pacefold-integrated.js',
  "          node --check _release/app/pacefold-integrated.js\n          ! grep -R -E -q '\\.innerHTML[[:space:]]*=' _release/app/app.js _release/app/pacefold-hub.js _release/app/pacefold-hub-guardian.js _release/app/pacefold-resilience.js _release/app/pacefold-integrated.js",
  'Trusted Types CI assertion',2);
write('.github/workflows/pages.yml',workflow);

let security=read('SECURITY.md');
if(!security.includes('sessionStorage'))security+=`\n## Microsoft authentication state\n\nPacefold explicitly configures MSAL to use sessionStorage with auth-state cookies disabled. Microsoft access tokens are not persisted in localStorage and end with the Pacefold window session.\n`;
write('SECURITY.md',security);
let readme=read('README.md');
if(!readme.includes('Foreground reminder boundary'))readme+=`\n## Foreground reminder boundary\n\nPacefold reminds reliably while its window is open and the device is awake. Browser timers cannot guarantee exact delivery while the window is closed, heavily throttled or the laptop is asleep. Pacefold reports missed scheduled moments with their real time instead of firing a stale notification. Exact background delivery requires the optional native Windows companion.\n`;
write('README.md',readme);
console.log('Hardened enhancement injection, CI Trusted Types checks, and public security/platform documentation.');
