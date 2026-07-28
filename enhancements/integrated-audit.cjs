'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {gunzipSync}=require('node:zlib');

const origamiCss=fs.readFileSync(path.join(__dirname,'pacefold-origami.css'),'utf8');
for(const token of [
  '--pf-motion',
  'pacefold-fold-mark.svg',
  '[data-fold-motion="opening"]',
  '[data-fold-motion="closing"]',
  '@keyframes pf-sheet-unfold',
  '@keyframes pf-sheet-fold',
  '@keyframes pf-player-unfold',
  '@keyframes pf-player-fold',
  'body:has(#pf-local-workspace.is-open) main .clock-shell',
  '.pf-player-drawer[hidden]',
  'scrollbar-width:none!important',
  '@media (prefers-reduced-motion:reduce)'
]){
  if(!origamiCss.includes(token))throw new Error(`Pacefold origami audit token missing: ${token}`);
}
const polishCss=fs.readFileSync(path.join(__dirname,'pacefold-origami-polish.css'),'utf8');
for(const token of [
  'content:"Pacefold"',
  'restrained final identity polish',
  ':focus-visible',
  '.pf-player-drawer>header'
]){
  const combined=`${origamiCss}\n${polishCss}`;
  if(!combined.includes(token))throw new Error(`Pacefold origami polish token missing: ${token}`);
}
const stabilityCss=fs.readFileSync(path.join(__dirname,'pacefold-desktop-stability.css'),'utf8');
for(const token of [
  '--pf-shell-width',
  '--pf-player-drawer-height',
  '--pf-workspace-open-height',
  '--pf-cover-height',
  '#pf-local-player>.pf-player-bar',
  '#pf-local-player>.pf-player-drawer',
  '#pf-hub-root:has(#pf-local-player .pf-player-drawer:not([hidden])) #pf-local-workspace',
  'width:100%!important',
  'bottom:calc(var(--pf-shell-bottom) + var(--pf-player-bar-height) + var(--pf-player-drawer-height))',
  'height:var(--pf-cover-height)!important',
  'border-radius:0 0 var(--pf-shell-radius) var(--pf-shell-radius)!important',
  'scrollbar-color:',
  'overflow-x:clip!important'
]){
  if(!stabilityCss.includes(token))throw new Error(`Pacefold unified-desktop audit token missing: ${token}`);
}
for(const retired of ['--pf-drawer-width','@media (min-width:1180px)']){
  if(stabilityCss.includes(retired))throw new Error(`Pacefold retired detached-layout token remains: ${retired}`);
}
if((stabilityCss.match(/\{/g)||[]).length!==(stabilityCss.match(/\}/g)||[]).length){
  throw new Error('Pacefold unified-desktop CSS braces are unbalanced');
}
const injectSource=fs.readFileSync(path.join(__dirname,'inject.mjs'),'utf8');
for(const token of [
  "const RELEASE='17.0.0'",
  "const origamiMarker='pacefold-17-sumi-fold'",
  "const legacyOrigamiMarkers=['pacefold-16.1-origami-identity','pacefold-16.3-kinetic-origami']",
  "const stabilityMarker='pacefold-17-sumi-workspace'",
  "const legacyStabilityMarkers=['pacefold-16.1.1-desktop-stability','pacefold-16.2-unified-desktop','pacefold-16.3-kinetic-desktop']",
  "const stabilitySource=path.join(sourceRoot,'pacefold-desktop-stability.css')",
  "await applyOrigamiPatch(path.join(targetApp,'pacefold-revamp.css'))",
  "await applyStabilityPatch(path.join(targetApp,'pacefold-revamp.css'))",
  "await applyAssetRevision(path.join(targetApp,'index.html'))",
  "await stampWorker(path.join(targetRoot,'service-worker.js'))",
  "await stampWorker(path.join(targetApp,'service-worker.js'))",
  "pacefold.visual-reset.17.0.0",
  'notebookMotionTimer',
  'playerMotionTimer',
  'notebookResumeAfterPlayer',
  'function setNotebookOpen(open,focus=true,closePlayer=true)',
  'function setPlayerDrawer(open,resumeNotebook=true)',
  'workspace.dataset.foldMotion',
  'player.dataset.foldMotion',
  "surfaceRelease:'17.0.0'",
  "pacefold-build.txt",
  "pacefold-build\" content=\"${RELEASE}"
]){
  if(!injectSource.includes(token))throw new Error(`Pacefold unified-desktop injection token missing: ${token}`);
}
for(const cacheToken of [
  'pacefold-(?:hub(?:-guardian)?|resilience|integrated|revamp)',
  '?v=${RELEASE}',
  '__PACEFOLD_SURFACE_RELEASE__'
]){
  if(!injectSource.includes(cacheToken))throw new Error(`Pacefold cache-bust contract missing: ${cacheToken}`);
}
if(injectSource.includes("path.join(sourceRoot,'pacefold-revamp.css')")){
  throw new Error('Pacefold injection must not rewrite its checked-in base stylesheet');
}
const foldMark=fs.readFileSync(path.join(__dirname,'pacefold-fold-mark.svg'),'utf8');
for(const token of ['<svg','Pacefold folded P mark','viewBox="0 0 64 64"']){
  if(!foldMark.includes(token))throw new Error(`Pacefold fold-mark audit token missing: ${token}`);
}

const prefix='integrated-audit-runtime.cjs.gz.b64.part-';
const parts=fs.readdirSync(__dirname).filter(name=>name.startsWith(prefix)).sort();
if(!parts.length)throw new Error('Pacefold integrated audit runtime segments are missing');
const encoded=parts.map(name=>fs.readFileSync(path.join(__dirname,name),'utf8')).join('').replace(/\s+/g,'');
let source=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
const geometry='workspaceAbovePlayer:wr.bottom<=pr.top+2';
if(!source.includes(geometry))throw new Error('Pacefold geometry assertion could not be instrumented');
source=source.replace(geometry,'workspaceAbovePlayer:wr.bottom<=pr.top+2&&Math.abs(wr.left-pr.left)<=2&&Math.abs(wr.right-pr.right)<=2,workspaceBottom:wr.bottom,playerTop:pr.top,playerHeight:pr.height');
const broadTrack="page.getByText('focus-track').isVisible()";
if(!source.includes(broadTrack))throw new Error('Pacefold local-player assertion could not be scoped');
source=source.replace(broadTrack,"page.locator('[data-pf-player-drawer]:visible').getByText('focus-track',{exact:true}).last().isVisible()");
const legacyBlack='background:#070908';
if(!source.includes(legacyBlack))throw new Error('Pacefold black-player audit literal is missing');
source=source.replaceAll(legacyBlack,'background:#090c0a');
const quickCapture="await page.locator('[data-pf-flow-input]').fill('/incident Flow audit note');";
if(!source.includes(quickCapture))throw new Error('Pacefold quick-capture audit step is missing');
source=source.replace(quickCapture,"await page.locator('[data-pf-revamp-title]').click();await page.locator('[data-pf-flow-input]').fill('/incident Flow audit note');");
const playerOpen="await page.locator('[data-pf-player-menu]').click();await page.waitForSelector('[data-pf-player-drawer]:visible');";
if(!source.includes(playerOpen))throw new Error('Pacefold player-open audit step is missing');
source=source.replace(playerOpen,`${playerOpen}await page.waitForTimeout(300);const exclusive=await page.evaluate(()=>{const workspace=document.getElementById('pf-local-workspace'),drawer=document.querySelector('[data-pf-player-drawer]'),wr=workspace.getBoundingClientRect(),dr=drawer.getBoundingClientRect(),menu=document.querySelector('[data-pf-player-menu]');return {notebookOpen:workspace.classList.contains('is-open'),workspaceAboveDrawer:wr.bottom<=dr.top+2,widthAligned:Math.abs(wr.left-dr.left)<=2&&Math.abs(wr.right-dr.right)<=2,expanded:menu.getAttribute('aria-expanded'),label:menu.getAttribute('aria-label')};});assert(!exclusive.notebookOpen&&exclusive.workspaceAboveDrawer&&exclusive.widthAligned&&exclusive.expanded==='true'&&/^Close/.test(exclusive.label),\`Notebook/music exclusivity failed: \${JSON.stringify(exclusive)}\`);`);
const recoveredDock="assert(await page.locator('#pf-local-workspace #pf-flow-dock').count()===1,'Recovered dock was not reintegrated into the notebook');";
if(!source.includes(recoveredDock))throw new Error('Pacefold root-recovery assertion is missing');
source=source.replace(recoveredDock,`${recoveredDock}assert(await page.locator('[data-pf-player-menu]').getAttribute('aria-expanded')==='true','Restored music drawer aria-expanded state is stale');`);
const desktopOpen="await page.evaluate(()=>{const workspace=document.getElementById('pf-local-workspace');workspace.classList.add('is-open');workspace.dataset.open='true';});";
if(!source.includes(desktopOpen))throw new Error('Pacefold desktop visual setup is missing');
source=source.replace(desktopOpen,"await page.evaluate(()=>{window.__PACEFOLD_REVAMP__.player.close();window.__PACEFOLD_REVAMP__.openNotebook();});await page.waitForTimeout(300);");
module._compile(source,__filename);
