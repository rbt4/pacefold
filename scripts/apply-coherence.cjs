'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(process.cwd());
const cssPath=path.join(root,'canonical/app/pacefold-v25-recovery.css');
const patchPath=path.join(root,'scripts/pacefold-25-coherence.css');
const jsPath=path.join(root,'canonical/app/pacefold-v25-recovery.js');
const verifyPath=path.join(root,'scripts/verify-canonical.cjs');
const marker='Pacefold 25 coherence r1';
let css=fs.readFileSync(cssPath,'utf8');
const patch=fs.readFileSync(patchPath,'utf8').trim();
if(!css.includes(marker))css=`${css.trimEnd()}\n\n${patch}\n`;
fs.writeFileSync(cssPath,css);
let js=fs.readFileSync(jsPath,'utf8');
if(!js.includes("dataset.coherence='coherence-r1'")){
  const anchor="root.dataset.release=RELEASE;root.dataset.recovery=REVISION}";
  if(!js.includes(anchor))throw new Error('Recovery version anchor missing');
  js=js.replace(anchor,"root.dataset.release=RELEASE;root.dataset.recovery=REVISION;root.dataset.coherence='coherence-r1'}");
  fs.writeFileSync(jsPath,js);
}
let verify=fs.readFileSync(verifyPath,'utf8');
if(!verify.includes('Coherence CSS contract is missing')){
  const anchor="if(!appHtml.includes('pacefold-v25-engine.js'))fail('Canonical engine is not active');";
  if(!verify.includes(anchor))throw new Error('Canonical verifier anchor missing');
  const addition="const recoveryCss=fs.readFileSync(path.join(root,'app/pacefold-v25-recovery.css'),'utf8'),recoveryJs=fs.readFileSync(path.join(root,'app/pacefold-v25-recovery.js'),'utf8');\nif(!recoveryCss.includes('Pacefold 25 coherence r1'))fail('Coherence CSS contract is missing');\nif(!recoveryJs.includes(\"coherence-r1\"))fail('Coherence runtime marker is missing');\n";
  verify=verify.replace(anchor,addition+anchor);
  fs.writeFileSync(verifyPath,verify);
}
console.log('Applied Pacefold 25 coherence r1');
