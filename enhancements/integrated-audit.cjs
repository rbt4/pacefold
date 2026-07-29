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
  'rhythm-home polish',
  'main .date',
  '.pf-note-composer-row select',
  '.pf-note-composer-foot button::after',
  ':focus-visible',
  '.pf-player-drawer>header',
  'the workday rhythm is the home surface again',
  'folds after save'
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
  "const RELEASE='19.1.0'",
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
  "pacefold.visual-reset.19.1.0",
  "pacefold.notebook.draft.v1",
  'notebookMotionTimer',
  'notebookAutoCloseTimer',
  'playerMotionTimer',
  'function setNotebookOpen(open,focus=true,closePlayer=true)',
  'function setPlayerDrawer(open)',
  "function savePlayerState(){writeJSON(PLAYER_KEY,{...playerState,drawer:false});}",
  'function scheduleNotebookAutoClose()',
  'Saved quietly to the notebook.',
  'Saved in the notebook.',
  "guarded('persistent-notebook'",
  'closeNotebook:()=>setNotebookOpen(false,false,false)',
  'workspace.dataset.foldMotion',
  'player.dataset.foldMotion',
  "surfaceRelease:'${RELEASE}'",
  "pacefold-build.txt",
  "pacefold-build\" content=\"${RELEASE}"
]){
  if(!injectSource.includes(token))throw new Error(`Pacefold unified-desktop injection token missing: ${token}`);
}
for(const cacheToken of [
  'pacefold-(?:hub(?:-guardian)?|resilience|integrated|revamp|ma|theme-boot|v19)',
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
const browserLaunch='chromium.launch({headless:true})';
if(!source.includes(browserLaunch))throw new Error('Pacefold browser launch could not be instrumented');
source=source.replace(browserLaunch,"chromium.launch({headless:true,executablePath:process.env.PACEFOLD_CHROMIUM_PATH||undefined})");
const geometry='workspaceAbovePlayer:wr.bottom<=pr.top+2';
if(!source.includes(geometry))throw new Error('Pacefold geometry assertion could not be instrumented');
source=source.replace(geometry,'workspaceAbovePlayer:window.__PACEFOLD_V19__?pr.height===0:wr.bottom<=pr.top+2&&Math.abs(wr.left-pr.left)<=2&&Math.abs(wr.right-pr.right)<=2,workspaceBottom:wr.bottom,playerTop:pr.top,playerHeight:pr.height');
const playerBottom='playerBottom:innerHeight-pr.bottom';
if(!source.includes(playerBottom))throw new Error('Pacefold resting-player assertion could not be instrumented');
source=source.replace(playerBottom,'playerBottom:window.__PACEFOLD_V19__?0:innerHeight-pr.bottom');
const broadTrack="page.getByText('focus-track').isVisible()";
if(!source.includes(broadTrack))throw new Error('Pacefold local-player assertion could not be scoped');
source=source.replace(broadTrack,"page.locator('[data-pf-player-drawer]:visible').getByText('focus-track',{exact:true}).last().isVisible()");
const legacyBlack='background:#070908';
if(!source.includes(legacyBlack))throw new Error('Pacefold black-player audit literal is missing');
source=source.replaceAll(legacyBlack,'background:#090c0a');
const legacyBlackRegex='/rgb\\((?:7|8|9),\\s*(?:8|9|10),\\s*(?:7|8|9)\\)/';
if(!source.includes(legacyBlackRegex))throw new Error('Pacefold player colour assertion is missing');
source=source.replace(legacyBlackRegex,'/rgb\\(9,\\s*12,\\s*10\\)/');
const quickCapture="await page.locator('[data-pf-flow-input]').fill('/incident Flow audit note');";
if(!source.includes(quickCapture))throw new Error('Pacefold quick-capture audit step is missing');
source=source.replace(quickCapture,"const persistentFolio=await page.locator('#pf-v19-workbench').count();assert(await page.locator('#pf-local-workspace').evaluate(node=>node.classList.contains('is-open')),'Notebook did not start persistently open');if(persistentFolio)assert(await page.locator('#pf-v19-workbench[data-page=\"notes\"] #pf-local-workspace:not([hidden])').count()===1,'Persistent notebook did not start in the lower half');await page.locator('[data-pf-note-body]').fill('/incident Flow audit note');");
const quickSubmit="await page.locator('[data-pf-flow-form]').evaluate(form=>form.requestSubmit());";
if(!source.includes(quickSubmit))throw new Error('Pacefold quick-capture submit step is missing');
source=source.replace(quickSubmit,"await page.locator('[data-pf-note-composer]').evaluate(form=>form.requestSubmit());");
const capturedVisible="assert(await page.getByText('Flow audit note').isVisible(),'Captured note is not visible in the integrated notebook');";
if(!source.includes(capturedVisible))throw new Error('Pacefold captured-note visibility assertion is missing');
source=source.replace(capturedVisible,"if(await page.evaluate(()=>Boolean(window.__PACEFOLD_V19__)))await page.evaluate(()=>window.__PACEFOLD_V19__.showNotes());else await page.evaluate(()=>window.__PACEFOLD_REVAMP__.openNotebook());await page.waitForSelector('#pf-local-workspace:not([hidden])');assert(await page.getByText('Flow audit note').isVisible(),'Captured note is not visible in the integrated notebook');const draftComposer=page.locator('[data-pf-note-body]');await draftComposer.fill('Draft remains in the notebook');await page.locator('main').click({position:{x:8,y:8}});assert((await page.evaluate(()=>JSON.parse(localStorage.getItem('pacefold.notebook.draft.v1')||'{}').body))==='Draft remains in the notebook','Unsaved notebook draft was not retained');assert(await draftComposer.inputValue()==='Draft remains in the notebook','Ordinary dashboard use disturbed the notebook draft');await draftComposer.fill('');");
const researchVisible="const researchTab=page.locator('[data-pf-tab=\"category:Research\"]');assert(await researchTab.isVisible(),'Dynamic category tab was not retained');";
if(!source.includes(researchVisible))throw new Error('Pacefold research-tab assertion is missing');
source=source.replace(researchVisible,`${researchVisible}const notebookState=await page.evaluate(()=>JSON.parse(localStorage.getItem('pacefold.notebook.ui.v1')||'{}'));const hasPersistentNotebook=await page.evaluate(()=>Boolean(window.__PACEFOLD_V19__));assert(hasPersistentNotebook?notebookState.open===true:typeof notebookState.open==='boolean','Notebook state was not persisted');if(hasPersistentNotebook)assert(await page.locator('#pf-v19-workbench[data-page="notes"]').count()===1,'Notebook left its persistent page after save');`);
const playerOpen="await page.locator('[data-pf-player-menu]').click();await page.waitForSelector('[data-pf-player-drawer]:visible');";
if(!source.includes(playerOpen))throw new Error('Pacefold player-open audit step is missing');
source=source.replace(playerOpen,`await page.evaluate(()=>window.__PACEFOLD_V19__?.showSound?.()||window.__PACEFOLD_REVAMP__.player.open());await page.waitForSelector('[data-pf-player-drawer]:visible');await page.waitForTimeout(80);const exclusive=await page.evaluate(()=>{const workspace=document.getElementById('pf-local-workspace'),drawer=document.querySelector('[data-pf-player-drawer]'),player=document.getElementById('pf-local-player'),wr=workspace.getBoundingClientRect(),dr=drawer.getBoundingClientRect(),pr=player.getBoundingClientRect(),menu=document.querySelector('[data-pf-player-menu]'),v19=Boolean(window.__PACEFOLD_V19__),bench=document.getElementById('pf-v19-workbench');return {v19,notebookOpen:workspace.classList.contains('is-open'),workspaceAboveDrawer:wr.bottom<=dr.top+2,widthAligned:Math.abs(wr.left-dr.left)<=2&&Math.abs(wr.right-dr.right)<=2,playerInView:pr.left>=0&&pr.top>=0&&pr.right<=innerWidth&&pr.bottom<=document.documentElement.scrollHeight,benchPage:bench?.dataset.page,playerHidden:player.hidden,expanded:menu.getAttribute('aria-expanded'),label:menu.getAttribute('aria-label')};});assert(!exclusive.notebookOpen&&exclusive.playerInView&&(!exclusive.v19||exclusive.benchPage==='sound'&&!exclusive.playerHidden)&&exclusive.expanded==='true'&&/^Close/.test(exclusive.label),\`Notebook/music page switching failed: \${JSON.stringify(exclusive)}\`);`);
const recoveredDock="assert(await page.locator('#pf-local-workspace #pf-flow-dock').count()===1,'Recovered dock was not reintegrated into the notebook');";
if(!source.includes(recoveredDock))throw new Error('Pacefold root-recovery assertion is missing');
source=source.replace(recoveredDock,`${recoveredDock}assert(await page.locator('[data-pf-player-menu]').getAttribute('aria-expanded')==='true','Restored music drawer aria-expanded state is stale');`);
const desktopOpen="await page.evaluate(()=>{const workspace=document.getElementById('pf-local-workspace');workspace.classList.add('is-open');workspace.dataset.open='true';});";
if(!source.includes(desktopOpen))throw new Error('Pacefold desktop visual setup is missing');
source=source.replace(desktopOpen,"await page.evaluate(()=>window.__PACEFOLD_V19__?.showNotes?.()||(()=>{window.__PACEFOLD_REVAMP__.player.close();window.__PACEFOLD_REVAMP__.openNotebook();})());await page.waitForTimeout(80);");
const desktopCapture="await page.screenshot({path:path.join(artifactRoot,'pacefold-workspace-desktop.png'),fullPage:true});";
if(!source.includes(desktopCapture))throw new Error('Pacefold desktop visual capture is missing');
source=source.replace(desktopCapture,`${desktopCapture}
    const persistentVisual=await page.evaluate(()=>Boolean(window.__PACEFOLD_V19__));
    if(!persistentVisual){await page.evaluate(()=>window.__PACEFOLD_REVAMP__.closeNotebook());await page.waitForTimeout(300);assert(!await page.locator('#pf-local-workspace').evaluate(node=>node.classList.contains('is-open')),'Compact visual state did not close the notebook');}
    await page.screenshot({path:path.join(artifactRoot,'pacefold-workspace-compact.png'),fullPage:true});
    await page.evaluate(()=>window.__PACEFOLD_V19__?.showNotes?.()||window.__PACEFOLD_REVAMP__.openNotebook());await page.waitForTimeout(80);
    const foldVisual=await page.evaluate(()=>{const workspace=document.getElementById('pf-local-workspace'),sheet=workspace.querySelector('.pf-notebook-sheet'),style=getComputedStyle(window.__PACEFOLD_V19__?workspace:sheet),rect=workspace.getBoundingClientRect(),bench=document.getElementById('pf-v19-workbench');return {v19:Boolean(window.__PACEFOLD_V19__),motion:workspace.dataset.foldMotion,transform:style.transform,opacity:Number(style.opacity),open:workspace.classList.contains('is-open'),page:bench?.dataset.page,inView:rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=document.documentElement.scrollHeight};});
    assert(foldVisual.open&&(foldVisual.v19?foldVisual.page==='notes'&&foldVisual.inView&&foldVisual.opacity>0:foldVisual.motion==='opening'&&foldVisual.transform!=='none'&&foldVisual.opacity>0&&foldVisual.opacity<1),'Notebook did not render as a contained workspace: '+JSON.stringify(foldVisual));
    await page.screenshot({path:path.join(artifactRoot,'pacefold-workspace-fold-midpoint.png'),fullPage:true});
    await page.evaluate(()=>window.__PACEFOLD_V19__?.showSound?.()||window.__PACEFOLD_REVAMP__.player.open());await page.waitForSelector('[data-pf-player-drawer]:visible');await page.waitForTimeout(80);
    const musicVisual=await page.evaluate(()=>{const workspace=document.getElementById('pf-local-workspace'),drawer=document.querySelector('[data-pf-player-drawer]'),player=document.getElementById('pf-local-player'),wr=workspace.getBoundingClientRect(),dr=drawer.getBoundingClientRect(),pr=player.getBoundingClientRect(),v19=Boolean(window.__PACEFOLD_V19__),bench=document.getElementById('pf-v19-workbench');return {v19,notebookOpen:workspace.classList.contains('is-open'),page:bench?.dataset.page,playerHidden:player.hidden,coverAboveDrawer:wr.bottom<=dr.top+2,drawerAbovePlayer:dr.bottom<=pr.top+2,widthAligned:Math.abs(wr.left-dr.left)<=2&&Math.abs(wr.right-dr.right)<=2&&Math.abs(dr.left-pr.left)<=2&&Math.abs(dr.right-pr.right)<=2,inView:pr.left>=0&&pr.top>=0&&pr.right<=innerWidth&&pr.bottom<=document.documentElement.scrollHeight,background:getComputedStyle(player).backgroundColor};});
    assert(!musicVisual.notebookOpen&&musicVisual.inView&&!/rgb\\(0,\\s*0,\\s*0\\)/.test(musicVisual.background)&&(!musicVisual.v19||musicVisual.page==='sound'&&!musicVisual.playerHidden),\`Music visual geometry failed: \${JSON.stringify(musicVisual)}\`);
    await page.screenshot({path:path.join(artifactRoot,'pacefold-workspace-music-desktop.png'),fullPage:true});
    await page.evaluate(()=>window.__PACEFOLD_V19__?.showNotes?.()||(()=>{window.__PACEFOLD_REVAMP__.player.close();window.__PACEFOLD_REVAMP__.openNotebook();})());await page.waitForTimeout(80);`);
const mobileCapture="await mobile.screenshot({path:path.join(artifactRoot,'pacefold-workspace-mobile.png'),fullPage:true});";
if(!source.includes(mobileCapture))throw new Error('Pacefold mobile visual capture is missing');
source=source.replace(mobileCapture,`${mobileCapture}
    await mobile.evaluate(()=>window.__PACEFOLD_V19__?.showSound?.()||window.__PACEFOLD_REVAMP__.player.open());await mobile.waitForSelector('[data-pf-player-drawer]:visible');await mobile.waitForTimeout(80);
    const mobileMusic=await mobile.evaluate(()=>{const workspace=document.getElementById('pf-local-workspace'),drawer=document.querySelector('[data-pf-player-drawer]'),player=document.getElementById('pf-local-player'),wr=workspace.getBoundingClientRect(),dr=drawer.getBoundingClientRect(),pr=player.getBoundingClientRect(),v19=Boolean(window.__PACEFOLD_V19__),bench=document.getElementById('pf-v19-workbench');return {v19,notebookOpen:workspace.classList.contains('is-open'),page:bench?.dataset.page,playerHidden:player.hidden,coverAboveDrawer:wr.bottom<=dr.top+2,drawerAbovePlayer:dr.bottom<=pr.top+2,widthAligned:Math.abs(wr.left-dr.left)<=2&&Math.abs(wr.right-dr.right)<=2&&Math.abs(dr.left-pr.left)<=2&&Math.abs(dr.right-pr.right)<=2,inView:pr.left>=0&&pr.right<=innerWidth&&pr.bottom<=document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth+2};});
    assert(!mobileMusic.notebookOpen&&mobileMusic.inView&&(!mobileMusic.v19||mobileMusic.page==='sound'&&!mobileMusic.playerHidden)&&!mobileMusic.overflow,\`Mobile music visual geometry failed: \${JSON.stringify(mobileMusic)}\`);
    await mobile.screenshot({path:path.join(artifactRoot,'pacefold-workspace-music-mobile.png'),fullPage:true});`);
const successLabel='Pacefold 16.0 integrated audit passed:';
if(!source.includes(successLabel))throw new Error('Pacefold integrated audit success label is missing');
source=source.replace(successLabel,'Pacefold 19 integrated audit passed:');
const finalErrorGate="if(errors.some(error=>/pacefold|pf-flow|pf-local|Unhandled|TypeError/i.test(error)))throw new Error(`16.0 browser errors: ${errors.join(' | ')}`);";
if(!source.includes(finalErrorGate))throw new Error('Pacefold final browser-error gate is missing');
const productRhythmGate=[
  "    mark('product-rhythm-visual');",
  "    const product=await context.newPage();await routeProviders(product);",
  "    await product.goto(`http://127.0.0.1:${port}/__blank`);",
  "    await product.evaluate(()=>{localStorage.setItem('pacefoldSetupDismissedV15','1');localStorage.setItem('pacefoldOnboardedV15','1');localStorage.setItem('pacefoldPrefsV15',JSON.stringify({profile:'original',showWorkline:true,workReminders:true,noodleMinutes:30,prepPreset:'noodles',prepLabel:'Noodles',prepDoneLabel:'Meal prepared',waterTarget:24,sipCadence:30,gazeEnabled:true,bodyEnabled:true,workdaysOnly:false,workHours:'00:00-23:59'}));});",
  "    await product.goto(`http://127.0.0.1:${port}/app/`,{waitUntil:'load'});",
  "    await product.waitForSelector('#noodleBtn');await product.waitForSelector('#pf-local-workspace',{state:'attached'});",
  "    await product.waitForFunction(()=>window.__PACEFOLD_REVAMP__?.surfaceRelease==='19.1.0'&&window.__PACEFOLD_V19__?.release==='19.1.0');",
  "    await product.waitForFunction(()=>{const line=document.getElementById('workline');return line&&Number.parseFloat(getComputedStyle(line).opacity)>=.5;},null,{timeout:2000});",
  "    const rhythmHome=await product.evaluate(()=>{const ids=['waterBtn','noodleBtn','awayBtn','lunchBtn','eyesBtn','careBtn'];const visible=id=>{const node=document.getElementById(id);if(!node)return false;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;};const line=document.getElementById('workline'),bench=document.getElementById('pf-v19-workbench'),workspace=document.getElementById('pf-local-workspace'),player=document.getElementById('pf-local-player');return {notebookOpen:workspace.classList.contains('is-open'),notebookVisible:!workspace.hidden,playerOpen:player.classList.contains('is-open'),playerHidden:player.hidden,benchPage:bench?.dataset.page,visible:ids.filter(visible),labels:ids.map(id=>document.getElementById(id)?.getAttribute('aria-label')||''),opacity:Number.parseFloat(getComputedStyle(line).opacity),noodleText:document.getElementById('noodleText')?.textContent||'',overflow:document.documentElement.scrollWidth>innerWidth+2};});",
  "    assert(rhythmHome.notebookOpen&&rhythmHome.notebookVisible&&!rhythmHome.playerOpen&&rhythmHome.playerHidden&&rhythmHome.benchPage==='notes'&&rhythmHome.visible.length===6&&rhythmHome.opacity>=.5&&!rhythmHome.overflow&&/30m|30-minute/i.test(`${rhythmHome.noodleText} ${rhythmHome.labels[1]}`),`Persistent rhythm home failed: ${JSON.stringify(rhythmHome)}`);",
  "    await product.screenshot({path:path.join(artifactRoot,'pacefold-rhythm-home.png'),fullPage:true});"
].join('\n');
source=source.replace(finalErrorGate,`${productRhythmGate}\n    ${finalErrorGate}`);
module._compile(source,__filename);
