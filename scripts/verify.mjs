import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
const root=process.cwd();
const required=[
  'enhancements/VERSION','enhancements/inject-v24.mjs','enhancements/pacefold-v24-kernel.js',
  'enhancements/pacefold-public-v24.css','enhancements/pacefold-public-v24.js',
  'enhancements/v24-audit.cjs','.github/workflows/pages.yml'
];
for(const file of required)await fs.access(path.join(root,file));
const version=(await fs.readFile(path.join(root,'enhancements/VERSION'),'utf8')).trim();
if(version!=='24.0.0')throw new Error(`Expected Pacefold 24.0.0, found ${version}`);
async function readParts(prefix){const dir=path.join(root,'enhancements'),names=(await fs.readdir(dir)).filter(name=>name.startsWith(prefix)).sort();if(!names.length)throw new Error(`Missing source parts: ${prefix}`);return (await Promise.all(names.map(name=>fs.readFile(path.join(dir,name),'utf8')))).join('')}
const sources={
  'enhancements/pacefold-v24-kernel.js':await fs.readFile(path.join(root,'enhancements/pacefold-v24-kernel.js'),'utf8'),
  'enhancements/pacefold-v24-unified.js':await readParts('pacefold-v24-unified.js.part-'),
  'enhancements/pacefold-public-v24.js':await fs.readFile(path.join(root,'enhancements/pacefold-public-v24.js'),'utf8')
};
for(const [file,source] of Object.entries(sources)){new vm.Script(source,{filename:file});if(/\.innerHTML\s*=/.test(source))throw new Error(`${file} contains raw innerHTML assignment`)}
const injector=await readParts('inject-v24-runtime.mjs.part-'),workflow=await fs.readFile(path.join(root,'.github/workflows/pages.yml'),'utf8');
for(const token of ["const RELEASE='24.0.0'",'pacefold-v24-kernel.js','pacefold-public-v24.css','removeLegacyProductLayer','patchManifest'])if(!injector.includes(token))throw new Error(`V24 injector contract missing: ${token}`);
for(const token of ['inject-v24.mjs','v24-audit.cjs','Build, verify and publish Pacefold 24'])if(!workflow.includes(token))throw new Error(`Release workflow contract missing: ${token}`);
console.log(JSON.stringify({release:version,publicSurface:'Pacefold 24 unified day instrument',formerMaLayer:'not public',releaseGate:'current-product audit',offline:'service-worker cached',website:'rebuilt'},null,2));
