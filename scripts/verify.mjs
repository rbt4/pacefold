import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
const root=process.cwd();
const required=[
  'enhancements/VERSION','enhancements/inject-v24.mjs','enhancements/pacefold-v24-kernel.js',
  'enhancements/pacefold-v25-boot.js','enhancements/pacefold-v25-recovery.css','enhancements/pacefold-v25-recovery.js',
  'enhancements/inject-v25.mjs','enhancements/finalize-v25-cleanroom.mjs','enhancements/pacefold-v25-service-worker.js','enhancements/pacefold-v25-app-migration-worker.js',
  'enhancements/v25-audit.cjs','enhancements/v25-cleanroom-audit.cjs','.github/workflows/pages.yml'
];
for(const file of required)await fs.access(path.join(root,file));
const version=(await fs.readFile(path.join(root,'enhancements/VERSION'),'utf8')).trim();
if(version!=='25.0.0')throw new Error(`Expected Pacefold 25.0.0, found ${version}`);
const sources={
  'enhancements/pacefold-v25-boot.js':await fs.readFile(path.join(root,'enhancements/pacefold-v25-boot.js'),'utf8'),
  'enhancements/pacefold-v25-recovery.js':await fs.readFile(path.join(root,'enhancements/pacefold-v25-recovery.js'),'utf8'),
  'enhancements/pacefold-v25-service-worker.js':await fs.readFile(path.join(root,'enhancements/pacefold-v25-service-worker.js'),'utf8'),
  'enhancements/pacefold-v25-app-migration-worker.js':await fs.readFile(path.join(root,'enhancements/pacefold-v25-app-migration-worker.js'),'utf8')
};
for(const [file,source] of Object.entries(sources)){
  new vm.Script(source,{filename:file});
  if(/\.innerHTML\s*=/.test(source))throw new Error(`${file} contains raw innerHTML assignment`);
}
const runtime=sources['enhancements/pacefold-v25-recovery.js'],boot=sources['enhancements/pacefold-v25-boot.js'],injector=await fs.readFile(path.join(root,'enhancements/inject-v25.mjs'),'utf8'),cleanroom=await fs.readFile(path.join(root,'enhancements/finalize-v25-cleanroom.mjs'),'utf8'),workflow=await fs.readFile(path.join(root,'.github/workflows/pages.yml'),'utf8'),css=await fs.readFile(path.join(root,'enhancements/pacefold-v25-recovery.css'),'utf8'),worker=sources['enhancements/pacefold-v25-service-worker.js'];
for(const token of ["const RELEASE='25.0.0'","const REVISION='recovery-r2'",'resolvedDay','workWeek','todayOverride','pf25-cue-dots','pf25-dayline','pf25-rhythm','pf25-daybook-toggle','waterLastAt','gazeLastAt','bodyLastAt','__PACEFOLD_RECOVERY__'])if(!runtime.includes(token))throw new Error(`V25 recovery contract missing: ${token}`);
for(const token of ['dataset.pacefoldV25','8000','pacefoldPrefsV15'])if(!boot.includes(token))throw new Error(`V25 boot contract missing: ${token}`);
for(const token of ['data-recovery="recovery-r2"','pf25-cue-dot[data-source="water"]','pf25-cue-dot[data-source="prayer"]','repeat(6','max-height:46vh','prefers-reduced-motion','forced-colors'])if(!css.includes(token))throw new Error(`V25 CSS contract missing: ${token}`);
for(const token of ['pacefold-v25-boot.js','pacefold-v25-recovery.css','pacefold-v25-recovery.js','pacefold-experience.txt','patchWorker'])if(!injector.includes(token))throw new Error(`V25 injector contract missing: ${token}`);
for(const token of ["const REVISION='cleanroom-r1'",'pacefold-v25-shell-boot.css','pacefold-v25-core.css','pacefold-v25-theme-boot.js','pacefold-v25-preboot.js','pacefold-v25-core.js','cleanupFiles','replaceWorkers'])if(!cleanroom.includes(token))throw new Error(`V25 cleanroom contract missing: ${token}`);
for(const token of ["const VERSION='25.0.0'","const CACHE_NAME='pacefold-25.0.0-cleanroom-r1'",'PACEFOLD_DRAIN_ACTIONS','notificationclick'])if(!worker.includes(token))throw new Error(`V25 clean worker contract missing: ${token}`);
for(const token of ['Build, verify and publish Pacefold 25','finalize-v25-cleanroom.mjs','v25-cleanroom-audit.cjs','25.0.0 cleanroom-r1'])if(!workflow.includes(token))throw new Error(`V25 cleanroom workflow contract missing: ${token}`);
console.log(JSON.stringify({release:version,publicSurface:'Pacefold 25 Recovery',recovery:'clock-first spatial reconciliation',deploymentBoundary:'V25 cleanroom bundles only',workWeek:'restored',prayerDisplay:'six visible markers including sunrise',quietCueDots:'source-coloured and independent of Quiet',daybook:'folding and auto-close',navigation:'secondary arrows return through Clock',logging:'canonical activity keys repaired',offline:'clean V25 service worker',releaseGate:'baseline + recovery + relic audit'},null,2));
