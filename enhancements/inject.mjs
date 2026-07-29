import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const RELEASE='18.0.0';
const sourceRoot=path.dirname(fileURLToPath(import.meta.url));
const targetRoot=path.resolve(process.argv[2]||'_site');
const layoutMarker='pacefold-17-layout-floor';
const origamiMarker='pacefold-17-sumi-fold';
const legacyOrigamiMarkers=['pacefold-16.1-origami-identity','pacefold-16.3-kinetic-origami'];
const stabilityMarker='pacefold-17-sumi-workspace';
const legacyStabilityMarkers=['pacefold-16.1.1-desktop-stability','pacefold-16.2-unified-desktop','pacefold-16.3-kinetic-desktop'];
const workerReleaseMarker='pacefold-surface-release';
const origamiSource=path.join(sourceRoot,'pacefold-origami.css');
const origamiPolishSource=path.join(sourceRoot,'pacefold-origami-polish.css');
const stabilitySource=path.join(sourceRoot,'pacefold-desktop-stability.css');
const markSource=path.join(sourceRoot,'pacefold-fold-mark.svg');
const maCssSource=path.join(sourceRoot,'pacefold-ma.css');
const maScriptSource=path.join(sourceRoot,'pacefold-ma.js');
const themeBootSource=path.join(sourceRoot,'pacefold-theme-boot.js');
const maFontSource=path.join(sourceRoot,'fonts','pacefold-ma.woff2');
const maFontLicenseSource=path.join(sourceRoot,'fonts','OFL.txt');
const layoutPatch=`

/* BEGIN ${layoutMarker} */
html.pf-flow-active body{padding-bottom:132px!important}
#pf-hub-root{--pf-workspace-bottom:64px!important}
#pf-local-workspace{bottom:64px!important;max-height:calc(100vh - 80px)!important;pointer-events:auto!important}
#pf-local-workspace.is-open{height:min(690px,calc(100vh - 80px))!important}
#pf-local-player{bottom:6px!important;height:48px!important;min-height:48px!important;max-height:48px!important;overflow:visible!important;pointer-events:auto!important}
#pf-local-player>.pf-player-bar{box-sizing:border-box!important;height:48px!important;min-height:48px!important;max-height:48px!important;pointer-events:auto!important}
#pf-local-player>.pf-player-drawer{position:absolute!important;pointer-events:auto!important}
#pf-local-player>audio{display:none!important}
/* END ${layoutMarker} */
`;

async function exists(file){
  try{await fs.access(file);return true;}catch{return false;}
}
async function replaceMarkedBlock(file,marker,content,legacyMarkers=[]){
  let source=await fs.readFile(file,'utf8');
  for(const candidate of [marker,...legacyMarkers]){
    const start=`/* BEGIN ${candidate} */`;
    const end=`/* END ${candidate} */`;
    let startIndex=source.indexOf(start);
    while(startIndex>=0){
      const endIndex=source.indexOf(end,startIndex);
      if(endIndex<0)throw new Error(`Pacefold ${candidate} end marker is missing`);
      source=source.slice(0,startIndex)+source.slice(endIndex+end.length);
      startIndex=source.indexOf(start);
    }
  }
  source=source.replace(/\s+$/,'')+`\n\n/* BEGIN ${marker} */\n${content.trim()}\n/* END ${marker} */\n`;
  await fs.writeFile(file,source);
}
async function applyLayoutPatch(file){
  const inner=layoutPatch.trim().replace(`/* BEGIN ${layoutMarker} */`,'').replace(`/* END ${layoutMarker} */`,'').trim();
  await replaceMarkedBlock(file,layoutMarker,inner);
}
async function applyOrigamiPatch(file){
  const identity=await fs.readFile(origamiSource,'utf8');
  const polish=await fs.readFile(origamiPolishSource,'utf8');
  await replaceMarkedBlock(file,origamiMarker,`${identity.trim()}\n\n${polish.trim()}`,legacyOrigamiMarkers);
}
async function applyStabilityPatch(file){
  const stability=await fs.readFile(stabilitySource,'utf8');
  await replaceMarkedBlock(file,stabilityMarker,stability,legacyStabilityMarkers);
}
async function applyAssetRevision(file){
  let html=await fs.readFile(file,'utf8');
  html=html.replace(
    /((?:\.\/)?pacefold-(?:hub(?:-guardian)?|resilience|integrated|revamp|ma|theme-boot)\.(?:css|js))\?v=[^"'&<\s]+/g,
    (_,asset)=>`${asset}?v=${RELEASE}`
  );
  html=html.replace(/\s*<meta\s+name=["']pacefold-build["'][^>]*>/gi,'');
  html=html.replace('</head>',`  <meta name="pacefold-build" content="${RELEASE}">\n</head>`);
  await fs.writeFile(file,html);
}
async function stampWorker(file){
  if(!(await exists(file)))return;
  let worker=await fs.readFile(file,'utf8');
  const block=new RegExp(`\\n*// BEGIN ${workerReleaseMarker}[\\s\\S]*?// END ${workerReleaseMarker}\\n*`,'g');
  worker=worker.replace(block,'\n').replace(/\s+$/,'');
  worker+=`\n\n// BEGIN ${workerReleaseMarker}\nself.__PACEFOLD_SURFACE_RELEASE__='${RELEASE}';\n// END ${workerReleaseMarker}\n`;
  await fs.writeFile(file,worker);
}
function replaceExactlyOnce(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0||source.indexOf(from,first+1)>=0)throw new Error(`Pacefold runtime patch ${label} expected exactly one source match`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}
async function applyRuntimePatch(file){
  let runtime=await fs.readFile(file,'utf8');
  const replacements=[
    ["const STREAM_KEY='pacefold.player.streaming-links.v1';\nconst WORK_OVERRIDE_KEY", "const STREAM_KEY='pacefold.player.streaming-links.v1';\nconst NOTEBOOK_DRAFT_KEY='pacefold.notebook.draft.v1';\nconst VISUAL_RESET_KEY='pacefold.visual-reset.17.1.0';\nconst WORK_OVERRIDE_KEY",'visual-reset-key'],
    ["let migrateTimer=0;\nlet dbPromise=null;","let migrateTimer=0;\nlet notebookRenderKey='';\nlet playerDrawerRenderKey='';\nlet notebookMotionTimer=0;\nlet notebookAutoCloseTimer=0;\nlet playerMotionTimer=0;\nlet dbPromise=null;",'render-keys'],
    ["function saveNotebookState(){writeJSON(NOTEBOOK_UI_KEY,notebookState);}\nfunction savePlayerState()","function saveNotebookState(){writeJSON(NOTEBOOK_UI_KEY,{...notebookState,open:false});}\nfunction readNotebookDraft(){const value=readJSON(NOTEBOOK_DRAFT_KEY,null);return value&&typeof value==='object'&&!Array.isArray(value)?{body:String(value.body||'').slice(0,8000),at:Number(value.at)||0}:null;}\nfunction writeNotebookDraft(body){const value=String(body||'').slice(0,8000);if(!value){try{localStorage.removeItem(NOTEBOOK_DRAFT_KEY);}catch{}return;}writeJSON(NOTEBOOK_DRAFT_KEY,{body:value,at:Date.now()});}\nfunction clearNotebookDraft(){try{localStorage.removeItem(NOTEBOOK_DRAFT_KEY);}catch{}}\nfunction restoreNotebookDraft(){const field=workspace?.querySelector('[data-pf-note-body]'),draft=readNotebookDraft();if(field&&!field.value&&draft?.body)field.value=draft.body;}\nfunction scheduleNotebookAutoClose(delay=60000){clearTimeout(notebookAutoCloseTimer);notebookAutoCloseTimer=0;if(!notebookState.open)return;notebookAutoCloseTimer=setTimeout(()=>{notebookAutoCloseTimer=0;if(notebookState.open&&!playerState.drawer)setNotebookOpen(false,false,false);},Math.max(800,Math.min(120000,Number(delay)||60000)));}\nfunction savePlayerState()",'notebook-transient-state'],
    ["function savePlayerState(){writeJSON(PLAYER_KEY,playerState);}","function savePlayerState(){writeJSON(PLAYER_KEY,{...playerState,drawer:false});}",'player-transient-state'],
    ["function saveStreamLinks(){writeJSON(STREAM_KEY,streamLinks);}\nfunction dispatchStorage()","function saveStreamLinks(){writeJSON(STREAM_KEY,streamLinks);}\nfunction applyVisualReset(){try{if(localStorage.getItem(VISUAL_RESET_KEY)==='1')return;notebookState.open=false;notebookState.editingId=null;saveNotebookState();playerState.drawer=false;playerState.view='queue';savePlayerState();localStorage.setItem(VISUAL_RESET_KEY,'1');}catch{}}\nfunction notebookDataKey(){try{return `${localStorage.getItem(ENTRY_KEY)||''}\\u0000${localStorage.getItem(CATEGORY_KEY)||''}`;}catch{return '';} }\nfunction playerDrawerDataKey(){return JSON.stringify({view:playerState.view,drawer:Boolean(playerState.drawer),currentId:playerState.currentId,queue:playerState.queue,tracks:trackCache.map(track=>[track.id,track.name,track.fileName,track.size]),playlists,streamLinks});}\nfunction dispatchStorage()",'data-keys'],
    ["  workspace=document.getElementById(WORKSPACE_ID);\n  if(!workspace){workspace=document.createElement('section');workspace.id=WORKSPACE_ID;workspace.dataset.revision=REVISION;workspace.className='pf-local-workspace';workspace.setAttribute('aria-label','Pacefold local notebook');setHTML(workspace,workspaceMarkup());root.append(workspace);bindNotebook();}\n  workspace.dataset.open=String(notebookState.open!==false);workspace.classList.toggle('is-open',notebookState.open!==false);\n  if(dock.parentElement!==workspace)workspace.prepend(dock);\n  prepareDock();renderNotebook();","  workspace=document.getElementById(WORKSPACE_ID);let created=false;\n  if(!workspace){workspace=document.createElement('section');workspace.id=WORKSPACE_ID;workspace.dataset.revision=REVISION;workspace.className='pf-local-workspace';workspace.setAttribute('aria-label','Pacefold local notebook');setHTML(workspace,workspaceMarkup());root.append(workspace);bindNotebook();created=true;}\n  workspace.dataset.release='17.1.0';workspace.dataset.open=String(notebookState.open!==false);workspace.classList.toggle('is-open',notebookState.open!==false);\n  if(dock.parentElement!==workspace)workspace.prepend(dock);\n  prepareDock();const dataKey=notebookDataKey();if(created||dataKey!==notebookRenderKey)renderNotebook();",'workspace-render'],
    ["  title.type='button';title.className='pf-revamp-title';title.dataset.pfRevampTitle='true';title.setAttribute('aria-label','Open or collapse notebook');","  title.type='button';title.className='pf-revamp-title';title.dataset.pfRevampTitle='true';title.setAttribute('aria-label','Open or collapse notebook');title.setAttribute('aria-expanded',String(notebookState.open!==false));",'notebook-toggle-a11y'],
    ["function toggleNotebook(){notebookState.open=!(notebookState.open!==false);saveNotebookState();workspace?.classList.toggle('is-open',notebookState.open);workspace?.setAttribute('data-open',String(notebookState.open));if(notebookState.open)setTimeout(()=>workspace?.querySelector('[data-pf-note-body]')?.focus({preventScroll:true}),80);}","function setNotebookOpen(open,focus=true,closePlayer=true){const next=Boolean(open),changed=(notebookState.open!==false)!==next;if(next&&closePlayer&&playerState.drawer)setPlayerDrawer(false);clearTimeout(notebookMotionTimer);clearTimeout(notebookAutoCloseTimer);notebookAutoCloseTimer=0;notebookState.open=next;saveNotebookState();if(!workspace)return;if(changed)workspace.dataset.foldMotion=next?'opening':'closing';workspace.classList.toggle('is-open',next);workspace.setAttribute('data-open',String(next));workspace.querySelector('[data-pf-revamp-title]')?.setAttribute('aria-expanded',String(next));notebookMotionTimer=setTimeout(()=>{notebookMotionTimer=0;if(workspace?.dataset.foldMotion===(next?'opening':'closing'))delete workspace.dataset.foldMotion;},260);if(next){restoreNotebookDraft();scheduleNotebookAutoClose();if(focus)setTimeout(()=>{if(notebookState.open&&!playerState.drawer)workspace?.querySelector('[data-pf-note-body]')?.focus({preventScroll:true});},180);}}\nfunction toggleNotebook(){setNotebookOpen(!(notebookState.open!==false));}",'notebook-motion'],
    ["  if(createEntry(input.value,chosen)){input.value='';notebookState.open=true;saveNotebookState();workspace?.classList.add('is-open');workspace?.setAttribute('data-open','true');renderNotebook();showStatus('Saved locally with a timestamp.','success');}","  if(createEntry(input.value,chosen)){input.value='';renderNotebook();showStatus('Saved quietly to the notebook.','success');}",'quick-capture-motion'],
    ["  workspace.querySelector('[data-pf-note-composer]')?.addEventListener('submit',guarded('note-save',saveComposer));\n  workspace.querySelector('[data-pf-note-search]')?.addEventListener('input'","  workspace.querySelector('[data-pf-note-composer]')?.addEventListener('submit',guarded('note-save',saveComposer));\n  const draftField=workspace.querySelector('[data-pf-note-body]');draftField?.addEventListener('input',guarded('note-draft',event=>{writeNotebookDraft(event.target.value);scheduleNotebookAutoClose();}));workspace.addEventListener('pointerdown',()=>scheduleNotebookAutoClose());workspace.addEventListener('keydown',()=>scheduleNotebookAutoClose());restoreNotebookDraft();\n  workspace.querySelector('[data-pf-note-search]')?.addEventListener('input'",'notebook-draft-bind'],
    ["  body.value='';saveNotebookState();renderNotebook();updateComposerMode();","  body.value='';clearNotebookDraft();saveNotebookState();renderNotebook();updateComposerMode();showStatus('Saved · folding back to your rhythm.','success');scheduleNotebookAutoClose(1100);",'notebook-save-autoclose'],
    ["function editNote(id){const item=entries().find(note=>note.id===id);if(!item)return;notebookState.editingId=id;notebookState.open=true;notebookState.category=item.category;saveNotebookState();renderCategorySelect();const body=workspace.querySelector('[data-pf-note-body]');if(body){body.value=item.body;body.focus();}updateComposerMode();}","function editNote(id){const item=entries().find(note=>note.id===id);if(!item)return;notebookState.editingId=id;notebookState.open=true;notebookState.category=item.category;saveNotebookState();renderCategorySelect();const body=workspace.querySelector('[data-pf-note-body]');if(body){body.value=item.body;writeNotebookDraft(item.body);body.focus();}updateComposerMode();scheduleNotebookAutoClose();}",'notebook-edit-draft'],
    ["function cancelEdit(){notebookState.editingId=null;saveNotebookState();const body=workspace?.querySelector('[data-pf-note-body]');if(body)body.value='';updateComposerMode();}","function cancelEdit(){notebookState.editingId=null;saveNotebookState();const body=workspace?.querySelector('[data-pf-note-body]');if(body)body.value='';clearNotebookDraft();updateComposerMode();scheduleNotebookAutoClose();}",'notebook-cancel-draft'],
    ["  insert=before+selected+after;field.setRangeText(insert,start,end,'end');field.focus();","  insert=before+selected+after;field.setRangeText(insert,start,end,'end');writeNotebookDraft(field.value);scheduleNotebookAutoClose();field.focus();",'notebook-format-draft'],
    ["  for(const popup of root.querySelectorAll('.pf-notebook,[data-pf-notebook-root]')){if(!popup.closest(`#${WORKSPACE_ID}`)){popup.hidden=true;popup.setAttribute('aria-hidden','true');}}","  for(const popup of root.querySelectorAll('.pf-notebook,[data-pf-notebook-root]')){if(popup.closest(`#${WORKSPACE_ID}`))continue;if(!popup.hidden)popup.hidden=true;if(popup.getAttribute('aria-hidden')!=='true')popup.setAttribute('aria-hidden','true');}",'popup-idempotence'],
    ["function renderNotebook(){if(!workspace)return;workspace.dataset.open=String(notebookState.open!==false);workspace.classList.toggle('is-open',notebookState.open!==false);const date=workspace.querySelector('[data-pf-notebook-date]');if(date)date.textContent=longDate(notebookState.date);renderCategorySelect();renderDocument();renderTabs();prepareDock();}","function renderNotebook(){if(!workspace)return;workspace.dataset.open=String(notebookState.open!==false);workspace.classList.toggle('is-open',notebookState.open!==false);const date=workspace.querySelector('[data-pf-notebook-date]');if(date)date.textContent=longDate(notebookState.date);renderCategorySelect();renderDocument();renderTabs();prepareDock();notebookRenderKey=notebookDataKey();}",'notebook-render-key'],
    ["function ensurePlayer(){\n  if(!root)return;player=document.getElementById(PLAYER_ID);\n  if(!player){player=document.createElement('aside');player.id=PLAYER_ID;player.dataset.revision=REVISION;player.className='pf-local-player';player.setAttribute('aria-label','Pacefold local music player');setHTML(player,playerMarkup());root.append(player);audio=document.createElement('audio');audio.preload='metadata';player.append(audio);bindPlayer();refreshTracks();}\n  for(const legacy of root.querySelectorAll('.pf-player-row[data-pf-flow-source=\"true\"]'))legacy.dataset.pfLegacyPlayer='true';\n  renderPlayer();renderPlayerDrawer();\n}","function ensurePlayer(){\n  if(!root)return;player=document.getElementById(PLAYER_ID);let created=false;\n  if(!player){player=document.createElement('aside');player.id=PLAYER_ID;player.dataset.revision=REVISION;player.className='pf-local-player';player.setAttribute('aria-label','Pacefold local music player');setHTML(player,playerMarkup());root.append(player);audio=document.createElement('audio');audio.preload='metadata';player.append(audio);bindPlayer();refreshTracks();created=true;}\n  player.dataset.release='17.1.0';\n  for(const legacy of root.querySelectorAll('.pf-player-row[data-pf-flow-source=\"true\"]'))if(legacy.dataset.pfLegacyPlayer!=='true')legacy.dataset.pfLegacyPlayer='true';\n  renderPlayer();const menu=player.querySelector('[data-pf-player-menu]');if(menu){menu.setAttribute('aria-expanded',String(Boolean(playerState.drawer)));menu.setAttribute('aria-label',playerState.drawer?'Close local music menu':'Open local music menu');}const drawerKey=playerDrawerDataKey();if(created||drawerKey!==playerDrawerRenderKey)renderPlayerDrawer();\n}",'player-render'],
    ["    <button type=\"button\" class=\"pf-player-menu-button\" data-pf-player-menu aria-label=\"Open local music menu\">☰</button>","    <button type=\"button\" class=\"pf-player-menu-button\" data-pf-player-menu aria-label=\"Open local music menu\" aria-expanded=\"false\">☰</button>",'player-toggle-a11y'],
    ["function setPlayerDrawer(open){playerState.drawer=open;savePlayerState();const drawer=player?.querySelector('[data-pf-player-drawer]');if(drawer)drawer.hidden=!open;player?.classList.toggle('is-open',open);if(open)renderPlayerDrawer();}","function setPlayerDrawer(open){const next=Boolean(open),changed=Boolean(playerState.drawer)!==next;clearTimeout(playerMotionTimer);if(next&&notebookState.open!==false)setNotebookOpen(false,false,false);playerState.drawer=next;savePlayerState();if(player){if(changed)player.dataset.foldMotion=next?'opening':'closing';player.classList.toggle('is-open',next);const menu=player.querySelector('[data-pf-player-menu]');if(menu){menu.setAttribute('aria-expanded',String(next));menu.setAttribute('aria-label',next?'Close local music menu':'Open local music menu');}}const drawer=player?.querySelector('[data-pf-player-drawer]');if(drawer)drawer.hidden=!next;playerMotionTimer=setTimeout(()=>{playerMotionTimer=0;if(player?.dataset.foldMotion===(next?'opening':'closing'))delete player.dataset.foldMotion;},260);if(next)renderPlayerDrawer();}",'player-motion'],
    ["  bindInlinePlayerFiles();\n}","  bindInlinePlayerFiles();playerDrawerRenderKey=playerDrawerDataKey();\n}",'player-drawer-render-key'],
    ["  for(const note of root?.querySelectorAll('.pf-notebook,[data-pf-notebook-root]')||[]){if(note.closest(`#${WORKSPACE_ID}`))continue;if(!note.hidden&&note.getAttribute('aria-hidden')!=='true')notebookWasOpened=true;note.hidden=true;note.setAttribute('aria-hidden','true');}","  for(const note of root?.querySelectorAll('.pf-notebook,[data-pf-notebook-root]')||[]){if(note.closest(`#${WORKSPACE_ID}`))continue;if(!note.hidden&&note.getAttribute('aria-hidden')!=='true')notebookWasOpened=true;if(!note.hidden)note.hidden=true;if(note.getAttribute('aria-hidden')!=='true')note.setAttribute('aria-hidden','true');}",'legacy-notebook-idempotence'],
    ["  if(notebookWasOpened&&!notebookState.open){notebookState.open=true;saveNotebookState();workspace?.classList.add('is-open');workspace?.setAttribute('data-open','true');}","  if(notebookWasOpened&&!notebookState.open)saveNotebookState();",'legacy-notebook-exclusive'],
    ["  for(const legacy of root?.querySelectorAll('.pf-player-row[data-pf-flow-source=\"true\"]')||[])legacy.dataset.pfLegacyPlayer='true';","  for(const legacy of root?.querySelectorAll('.pf-player-row[data-pf-flow-source=\"true\"]')||[])if(legacy.dataset.pfLegacyPlayer!=='true')legacy.dataset.pfLegacyPlayer='true';",'legacy-player-idempotence'],
    ["if(intent==='notebook'||intent==='capture'){notebookState.open=true;saveNotebookState();setTimeout(()=>{ensureWorkspace();workspace?.querySelector('[data-pf-note-body]')?.focus();},160);}else if(intent==='media')setTimeout(()=>setPlayerDrawer(true),160);","if(intent==='notebook')setTimeout(()=>{ensureWorkspace();setNotebookOpen(true,true);},160);else if(intent==='capture')setTimeout(()=>{ensureWorkspace();setNotebookOpen(false,false,false);window.__PACEFOLD_FLOW__?.focusCapture?.();},160);else if(intent==='media')setTimeout(()=>setPlayerDrawer(true),160);",'launch-intent-exclusive'],
    ["document.addEventListener('click',guarded('legacy-action',event=>{const action=event.target.closest?.('[data-pf-action]')?.dataset?.pfAction;if(action==='open-notebook'){event.preventDefault();event.stopImmediatePropagation();notebookState.open=true;saveNotebookState();queue();setTimeout(()=>workspace?.querySelector('[data-pf-note-body]')?.focus({preventScroll:true}),80);}else if(action==='open-player'){event.preventDefault();event.stopImmediatePropagation();setPlayerDrawer(true);}}),true);","document.addEventListener('click',guarded('transient-notebook',event=>{const action=event.target.closest?.('[data-pf-action]')?.dataset?.pfAction;if(action==='open-notebook'){event.preventDefault();event.stopImmediatePropagation();setNotebookOpen(true,true);}else if(action==='open-player'){event.preventDefault();event.stopImmediatePropagation();setPlayerDrawer(true);}else if(notebookState.open&&workspace&&!workspace.contains(event.target)&&!player?.contains(event.target))setNotebookOpen(false,false,false);}),true);",'transient-notebook-click'],
    ["window.addEventListener('focus',guarded('focus',()=>{workCache.at=0;applyWorkState();}));","window.addEventListener('focus',guarded('focus',()=>{workCache.at=0;applyWorkState();}));\ndocument.addEventListener('visibilitychange',guarded('notebook-visibility',()=>{if(document.visibilityState==='hidden'&&notebookState.open)setNotebookOpen(false,false,false);}));",'notebook-visibility'],
    ["document.addEventListener('keydown',guarded('keyboard',event=>{if(event.key==='Escape'&&playerState.drawer){setPlayerDrawer(false);return;}if(event.ctrlKey&&event.shiftKey&&event.code==='KeyN'){event.preventDefault();notebookState.open=true;saveNotebookState();queue();setTimeout(()=>workspace?.querySelector('[data-pf-note-body]')?.focus(),80);}}));","document.addEventListener('keydown',guarded('keyboard',event=>{if(event.key==='Escape'&&playerState.drawer){setPlayerDrawer(false);return;}if(event.key==='Escape'&&notebookState.open){setNotebookOpen(false,false,false);return;}if(event.ctrlKey&&event.shiftKey&&event.code==='KeyN'){event.preventDefault();setNotebookOpen(true,true);}}));",'keyboard-autoclose'],
    ["window.__PACEFOLD_REVAMP__={revision:REVISION,reconcile:queue,readWorkWindow,openNotebook:()=>{notebookState.open=true;saveNotebookState();queue();},copyDay,player:{open:()=>setPlayerDrawer(true),refresh:refreshTracks}};","window.__PACEFOLD_REVAMP__={revision:REVISION,surfaceRelease:'17.1.0',reconcile:queue,readWorkWindow,openNotebook:()=>setNotebookOpen(true,false),closeNotebook:()=>setNotebookOpen(false,false,false),copyDay,player:{open:()=>setPlayerDrawer(true),close:()=>setPlayerDrawer(false),refresh:refreshTracks}};",'public-api-exclusive'],
    ["window.addEventListener('storage',event=>{if(event.key?.startsWith('pacefold.')){workCache.at=0;queue();}});","window.addEventListener('storage',event=>{if(event.key?.startsWith('pacefold.')){workCache.at=0;if([ENTRY_KEY,CATEGORY_KEY].includes(event.key))notebookRenderKey='';queue();}});",'storage-invalidation'],
    ["installBadgePolicy();bindObserver();","applyVisualReset();installBadgePolicy();bindObserver();",'visual-reset-call']
  ];
  for(const [from,to,label] of replacements)runtime=replaceExactlyOnce(runtime,from,to,label);
  await fs.writeFile(file,runtime);
}

async function applyMaCorePatch(file){
  let runtime=await fs.readFile(file,'utf8');
  if(runtime.includes('window.__PACEFOLD_MA_CORE__='))return;
  const replacements=[
    [
      "    lat:43.62,lng:-79.51,locationLabel:'Toronto',lastSeenAt:0,\n    offsets:{fajr:0,dhuhr:0,asr:0,maghrib:0,isha:0},acknowledged:{},snoozed:{}",
      "    schemaVersion:18,minCueGap:4,focusGraceMinutes:25,workWeek:null,todayOverride:null,quietMode:false,quietRestore:null,skipToday:{},waferLaunches:0,waferPromptDismissed:false,foldReviewDismissed:false,foldReviewLastDate:'',storagePersistAsked:false,maLastCueAt:0,waitingCue:null,awaySnoozedUntil:0,\n    lat:43.62,lng:-79.51,locationLabel:'Toronto',lastSeenAt:0,\n    offsets:{fajr:0,dhuhr:0,asr:0,maghrib:0,isha:0},acknowledged:{},snoozed:{}",
      'ma-defaults'
    ],
    [
      "    p.clarity=p.clarity==='clear'?'clear':'discreet';",
      "    p.clarity=['clear','discreet','wafer'].includes(p.clarity)?p.clarity:'discreet';",
      'ma-wafer-normalize'
    ],
    [
      "    p.workHours=/^\\d{2}:\\d{2}-\\d{2}:\\d{2}$/.test(String(p.workHours))?p.workHours:DEFAULTS.workHours;",
      "    p.workHours=/^\\d{2}:\\d{2}-\\d{2}:\\d{2}$/.test(String(p.workHours))?p.workHours:DEFAULTS.workHours;\n    p.schemaVersion=Math.max(18,clamp(p.schemaVersion,0,999,18));p.minCueGap=clamp(p.minCueGap,1,30,4);p.focusGraceMinutes=clamp(p.focusGraceMinutes,5,120,25);p.workWeek=p.workWeek&&typeof p.workWeek==='object'&&!Array.isArray(p.workWeek)?p.workWeek:null;p.todayOverride=p.todayOverride&&typeof p.todayOverride==='object'?p.todayOverride:null;p.quietMode=Boolean(p.quietMode);p.quietRestore=p.quietRestore&&typeof p.quietRestore==='object'?p.quietRestore:null;p.skipToday=p.skipToday&&typeof p.skipToday==='object'?p.skipToday:{};p.waferLaunches=clamp(p.waferLaunches,0,3,0);p.waferPromptDismissed=Boolean(p.waferPromptDismissed);p.foldReviewDismissed=Boolean(p.foldReviewDismissed);p.foldReviewLastDate=typeof p.foldReviewLastDate==='string'?p.foldReviewLastDate:'';p.storagePersistAsked=Boolean(p.storagePersistAsked);p.maLastCueAt=clamp(p.maLastCueAt,0,Number.MAX_SAFE_INTEGER,0);p.waitingCue=p.waitingCue&&typeof p.waitingCue==='object'?p.waitingCue:null;p.awaySnoozedUntil=clamp(p.awaySnoozedUntil,0,Number.MAX_SAFE_INTEGER,0);",
      'ma-pref-normalize'
    ],
    [
      "  function applyComfort(now,h){document.body.dataset.comfort=resolvedComfort(now,h);document.body.dataset.comfortStrength=String(prefs.comfortStrength);}",
      "  function applyComfort(now,h){document.body.dataset.comfort='continuous';document.body.dataset.comfortStrength='0';}",
      'ma-continuous-comfort'
    ],
    [
      "  function workRange(){const [a,b]=prefs.workHours.split('-');return{start:parseClock(a),end:parseClock(b)};}",
      "  function maDayConfig(now=new Date()){const fallback=prefs.workHours.split('-'),row=prefs.workWeek?.[now.getDay()]||prefs.workWeek?.[String(now.getDay())]||{start:fallback[0],end:fallback[1],type:(!prefs.workdaysOnly||now.getDay()>=1&&now.getDay()<=5)?'desk':'off'},override=prefs.todayOverride&&prefs.todayOverride.date===dayKey(now)?prefs.todayOverride:null,type=['desk','field','half','off'].includes(override?.type)?override.type:['desk','field','half','off'].includes(row.type)?row.type:'desk';return{start:/^\\d{2}:\\d{2}$/.test(String(row.start))?row.start:fallback[0],end:/^\\d{2}:\\d{2}$/.test(String(row.end))?row.end:fallback[1],type};}\n  function currentDayType(now=new Date()){return maDayConfig(now).type;}\n  function cueSkipped(source,now=new Date()){return prefs.skipToday?.[source]===dayKey(now);}\n  function workRange(now=new Date()){const day=maDayConfig(now),start=parseClock(day.start);let end=parseClock(day.end);if(day.type==='half'&&end>start+3)end=start+(end-start)/2;return{start,end};}",
      'ma-work-range'
    ],
    [
      "  function isConfiguredWorkday(now){const day=now.getDay();return !prefs.workdaysOnly||(day>=1&&day<=5);}",
      "  function isConfiguredWorkday(now){return currentDayType(now)!=='off';}",
      'ma-workday-type'
    ],
    [
      "due=(prefs.workReminders&&within&&!paused&&!complete&&since>=plan.cadence*60000&&Date.now()>=prefs.waterGraceUntil)||testRoutine==='water'",
      "due=(prefs.workReminders&&within&&!paused&&!complete&&!cueSkipped('water',now)&&since>=plan.cadence*60000&&Date.now()>=prefs.waterGraceUntil)||testRoutine==='water'",
      'ma-water-skip'
    ],
    [
      "due=prefs.gazeEnabled&&prefs.workReminders&&within&&!paused&&Date.now()>=prefs.gazeSnoozedUntil&&elapsed>=prefs.gazeCadence*60000",
      "due=prefs.gazeEnabled&&prefs.workReminders&&within&&currentDayType(now)!=='field'&&!cueSkipped('eyes',now)&&!paused&&Date.now()>=prefs.gazeSnoozedUntil&&elapsed>=prefs.gazeCadence*60000",
      'ma-eyes-day-type'
    ],
    [
      "const due=prefs.bodyEnabled&&prefs.workReminders&&within&&!paused&&!active&&Date.now()>=prefs.bodySnoozedUntil&&elapsed>=prefs.bodyCadence*60000;",
      "const due=prefs.bodyEnabled&&prefs.workReminders&&within&&currentDayType(now)!=='field'&&!cueSkipped('body',now)&&!paused&&!active&&Date.now()>=prefs.bodySnoozedUntil&&elapsed>=prefs.bodyCadence*60000;",
      'ma-body-day-type'
    ],
    [
      "  function attentionFor(prayer,water,noodle,away,lunch,gaze,body){\n    if(testPrayer!=='none')return{signal:testPrayer,source:'prayer'};",
      "  function attentionFor(prayer,water,noodle,away,lunch,gaze,body){\n    const field=currentDayType(new Date())==='field';\n    if(testPrayer!=='none')return{signal:testPrayer,source:'prayer'};",
      'ma-attention-field'
    ],
    ["    if(noodle.ready)return{signal:'due',source:'noodle'};","    if(noodle.ready&&!field)return{signal:'due',source:'noodle'};",'ma-attention-noodle'],
    ["    if(body&&body.due)return{signal:'due',source:'body'};","    if(body&&body.due&&!field)return{signal:'due',source:'body'};",'ma-attention-body'],
    ["    if(gaze&&gaze.due)return{signal:'due',source:'eyes'};","    if(gaze&&gaze.due&&!field)return{signal:'due',source:'eyes'};",'ma-attention-eyes'],
    ["    if(away.active)return{signal:away.long?'due':'active',source:'away'};","    if(away.active&&!field)return{signal:away.long?'due':'active',source:'away'};",'ma-attention-away'],
    ["    if(body&&body.active)return{signal:'active',source:'body'};","    if(body&&body.active&&!field)return{signal:'active',source:'body'};",'ma-attention-body-active'],
    [
      "  function updateAppBadge(attention,states){\n    const mode=prefs.taskbarBadgeMode||'due'",
      "  function updateAppBadge(attention,states){\n    if(window.__PACEFOLD_MA_SCHEDULER__?.updateBadge?.(attention,states))return;\n    const mode=prefs.taskbarBadgeMode||'due'",
      'ma-badge-owner'
    ],
    [
      "  async function showSystemNotification(key,text,source='prayer',test=false,specOnly=false){",
      "  async function deliverSystemNotification(key,text,source='prayer',test=false,specOnly=false){",
      'ma-delivery-helper'
    ],
    [
      "  function notifyOnce(key,text,source='prayer'){void showSystemNotification(key,text,source,false);}",
      "  window.__PACEFOLD_MA_DELIVER__=deliverSystemNotification;\n  async function showSystemNotification(key,text,source='prayer',test=false,specOnly=false){if(!test&&window.__PACEFOLD_MA_SCHEDULER__?.request)return window.__PACEFOLD_MA_SCHEDULER__.request(key,text,source,test,specOnly);return deliverSystemNotification(key,text,source,test,specOnly);}\n  function notifyOnce(key,text,source='prayer'){void showSystemNotification(key,text,source,false);}",
      'ma-scheduler-owner'
    ],
    [
      "  function renderSequence(h,state){\n    const rows=scheduleForDate(new Date());",
      "  function renderSequence(h,state){\n    const rows=scheduleForDate(new Date());\n    try{if(window.__PACEFOLD_MA_VIEW__?.renderRibbon?.({h,state,rows,range:workRange(),dayType:currentDayType(new Date())}))return;}catch(error){reportError(error,'ma-ribbon');}",
      'ma-ribbon-hook'
    ],
    [
      "    waterBtn.setAttribute('aria-label',water.complete?`Hydration pace met for the ${water.target}-ounce workday target`:`Take two to three sips, then click to log sip break ${Math.min(water.sips+1,water.total)} of ${water.total}`);",
      "    waterBtn.setAttribute('aria-label',water.complete?`Hydration pace met for the ${water.target}-ounce workday target`:`Take two to three sips, then click to log sip break ${Math.min(water.sips+1,water.total)} of ${water.total}`);$('waterMeter').style.setProperty('--pf-meter',`${(water.progress*100).toFixed(2)}%`);",
      'ma-water-meter'
    ],
    [
      "    $('noodleRing').style.setProperty('--timer-progress',noodle.progress.toFixed(4));",
      "    $('noodleRing').style.setProperty('--timer-progress',noodle.progress.toFixed(4));$('noodleRing').style.setProperty('--pf-meter',`${(noodle.progress*100).toFixed(2)}%`);",
      'ma-noodle-meter'
    ],
    [
      "    awayBtn.setAttribute('aria-label',away.active?`Away break active for ${mmss(away.elapsed)}; click when back`:`Start an away break; ${away.count} logged today`);",
      "    awayBtn.setAttribute('aria-label',away.active?`Away break active for ${mmss(away.elapsed)}; click when back`:`Start an away break; ${away.count} logged today`);awayBtn.querySelector('.away-glyph')?.style.setProperty('--pf-meter',away.active?'100%':away.count?'66%':'0%');",
      'ma-away-meter'
    ],
    [
      "    $('lunchMeter').style.setProperty('--lunch-progress',lunch.progress.toFixed(4));",
      "    $('lunchMeter').style.setProperty('--lunch-progress',lunch.progress.toFixed(4));$('lunchMeter').style.setProperty('--pf-meter',`${(lunch.progress*100).toFixed(2)}%`);",
      'ma-lunch-meter'
    ],
    [
      "    eyesText.textContent=gaze.paused?'Eyes paused':gaze.due?'Look far · 20s':prefs.gazeEnabled?`Eyes ${Math.ceil(gaze.remaining/60000)}m`:'Eyes off';",
      "    eyesBtn.querySelector('.eye-glyph')?.style.setProperty('--pf-meter',`${(gaze.due?100:Math.max(0,Math.min(100,100-gaze.remaining/Math.max(1,prefs.gazeCadence*60000)*100))).toFixed(2)}%`);eyesText.textContent=gaze.paused?'Eyes paused':gaze.due?'Look far · 20s':prefs.gazeEnabled?`Eyes ${Math.ceil(gaze.remaining/60000)}m`:'Eyes off';",
      'ma-eyes-meter'
    ],
    [
      "    $('careText').textContent=body.active?`Move ${mmss(Math.max(0,60000-body.activeElapsed))}`:body.due?'Move now':prefs.bodyEnabled?`Move ${Math.ceil(body.remaining/60000)}m`:'Care off';",
      "    $('careBtn').querySelector('.care-glyph')?.style.setProperty('--pf-meter',`${(body.due||body.active?100:Math.max(0,Math.min(100,100-body.remaining/Math.max(1,prefs.bodyCadence*60000)*100))).toFixed(2)}%`);$('careText').textContent=body.active?`Move ${mmss(Math.max(0,60000-body.activeElapsed))}`:body.due?'Move now':prefs.bodyEnabled?`Move ${Math.ceil(body.remaining/60000)}m`:'Care off';",
      'ma-body-meter'
    ],
    [
      "    $('minute').textContent=String(m).padStart(2,'0');$('seconds').textContent=String(s).padStart(2,'0');$('date').textContent=now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});",
      "    const minuteText=String(m).padStart(2,'0');if(!window.__PACEFOLD_MA_VIEW__?.setMinute?.($('minute'),minuteText))$('minute').textContent=minuteText;$('seconds').textContent=String(s).padStart(2,'0');window.__PACEFOLD_MA_VIEW__?.setSecondProgress?.(s);$('date').textContent=now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});",
      'ma-time-type'
    ],
    [
      "    document.title=prefs.timeFormat==='24'?`${String(H).padStart(2,'0')}:${String(m).padStart(2,'0')}`:`${H%12||12}:${String(m).padStart(2,'0')} ${H>=12?'PM':'AM'}`;",
      "    document.title=prefs.quietMode?'Clock':prefs.timeFormat==='24'?`${String(H).padStart(2,'0')}:${String(m).padStart(2,'0')}`:`${H%12||12}:${String(m).padStart(2,'0')} ${H>=12?'PM':'AM'}`;",
      'ma-quiet-title'
    ],
    [
      "document.body.dataset.signal=attention.signal;document.body.dataset.source=attention.source;document.body.dataset.prayerSignal=prayer.signal;",
      "document.body.dataset.signal=attention.signal;document.body.dataset.source=attention.source;document.body.dataset.prayerSignal=prayer.signal;document.body.dataset.dayType=currentDayType(now);document.body.dataset.quiet=String(Boolean(prefs.quietMode));",
      'ma-body-state'
    ],
    [
      "    $('progressFill').style.width=`${(Math.min(1,Math.max(0,(h-b.prev[1])/((b.next[1]-b.prev[1])||1)))*100).toFixed(2)}%`;",
      "    window.__PACEFOLD_MA_VIEW__?.applyStatus?.();\n    $('progressFill').style.width=`${(Math.min(1,Math.max(0,(h-b.prev[1])/((b.next[1]-b.prev[1])||1)))*100).toFixed(2)}%`;",
      'ma-status-override'
    ],
    [
      "  if(debugEnabled){\n    window.pacefoldPreview",
      "  function reconcileMaDrift(now=Date.now()){const day=dayKey(new Date(now));prefs.waterLastAt=now;prefs.gazeLastAt=now;prefs.bodyLastAt=now;prefs.waitingCue=null;if(prefs.noodleStart){const total=(prefs.noodleDurationAtStart||prefs.noodleMinutes||30)*60000;if(prefs.noodleStart+total<=now){prefs.noodleStart=0;prefs.noodleDurationAtStart=0;prefs.noodleDone=day;}}if(prefs.lunchStart){const mode=prefs.lunchModeAtStart||prefs.lunchMode||'desk',minutes=prefs.lunchDurationAtStart||(mode==='away'?prefs.awayLunchMinutes:prefs.deskLunchMinutes)||20,end=prefs.lunchStart+minutes*60000;if(end<=now){prefs.lunchSessions=[...(prefs.lunchSessions||[]),{mode,start:prefs.lunchStart,end,minutes}].slice(-10);prefs.lunchStart=0;prefs.lunchDurationAtStart=0;prefs.lunchLoggedMinutes=minutes;prefs.lunchDone=day;}}save();render();return JSON.parse(JSON.stringify(prefs));}\n  window.__PACEFOLD_MA_CORE__={getPrefs:()=>JSON.parse(JSON.stringify(prefs)),updatePrefs:patch=>{prefs=normalizePrefs({...prefs,...(patch||{})});LAT=Number.isFinite(prefs.lat)?prefs.lat:LAT;LNG=Number.isFinite(prefs.lng)?prefs.lng:LNG;times=computeTimes(new Date());save();render();return JSON.parse(JSON.stringify(prefs));},reconcileDrift:reconcileMaDrift,render,workRange,currentDayType};\n  if(debugEnabled){\n    window.pacefoldPreview",
      'ma-core-api'
    ]
  ];
  for(const [from,to,label] of replacements)runtime=replaceExactlyOnce(runtime,from,to,label);
  await fs.writeFile(file,runtime);
}

async function applyMaRevampPatch(file){
  let runtime=await fs.readFile(file,'utf8');
  const replacements=[
    [
      "  const lines=[`# Pacefold — ${longDate(date)}`,''];",
      "  const rhythm=window.__PACEFOLD_MA_EXPORT__?.rhythmMarkdown?.(date)||'';const lines=[`# Pacefold — ${longDate(date)}`,'',...(rhythm?rhythm.trimEnd().split('\\n'):[])];",
      'ma-copy-day'
    ],
    [
      "function exportBackup(){downloadFile(`pacefold-backup-${localDate()}.json`,'application/json',JSON.stringify({version:REVISION,exportedAt:new Date().toISOString(),entries:entries(),categories:customCategories(),playlists,streamLinks},null,2));showStatus('Local backup downloaded.','success');}",
      "function exportBackup(){if(window.__PACEFOLD_MA_BACKUP__)return window.__PACEFOLD_MA_BACKUP__.exportBackup({entries:entries(),categories:customCategories(),playlists,streamLinks},showStatus);downloadFile(`pacefold-backup-${localDate()}.json`,'application/json',JSON.stringify({version:REVISION,exportedAt:new Date().toISOString(),entries:entries(),categories:customCategories(),playlists,streamLinks},null,2));showStatus('Local backup downloaded.','success');}",
      'ma-backup-export'
    ],
    [
      "async function importBackup(file){\n  const text=await file.text();const data=JSON.parse(text);if(!Array.isArray(data.entries))throw new Error('Backup does not contain notes.');",
      "async function importBackup(file){\n  if(window.__PACEFOLD_MA_BACKUP__)return window.__PACEFOLD_MA_BACKUP__.restoreBackup(file,{snapshot:()=>({entries:entries(),categories:customCategories(),playlists,streamLinks}),apply:data=>{writeEntries(data.entries);writeJSON(CATEGORY_KEY,data.categories);playlists=data.playlists;savePlaylists();streamLinks=data.streamLinks;saveStreamLinks();renderNotebook();renderPlayerDrawer();}},showStatus);\n  const text=await file.text();const data=JSON.parse(text);if(!Array.isArray(data.entries))throw new Error('Backup does not contain notes.');",
      'ma-backup-restore'
    ],
    [
      "async function addAudioFiles(files){\n  const audioFiles=[...files].filter(file=>file.type.startsWith('audio/'));",
      "async function addAudioFiles(files){\n  if(window.__PACEFOLD_MA_STORAGE__&&!await window.__PACEFOLD_MA_STORAGE__.allowAudioImport(files))return;\n  const audioFiles=[...files].filter(file=>file.type.startsWith('audio/'));",
      'ma-storage-guard'
    ],
    ["  workspace.dataset.release='17.1.0';","  workspace.dataset.release='18.0.0';",'ma-workspace-release'],
    ["  player.dataset.release='17.1.0';","  player.dataset.release='18.0.0';",'ma-player-release'],
    [
      "window.__PACEFOLD_REVAMP__={revision:REVISION,surfaceRelease:'17.1.0'",
      "window.__PACEFOLD_REVAMP__={revision:REVISION,surfaceRelease:'18.0.0'",
      'ma-revamp-release'
    ]
  ];
  for(const [from,to,label] of replacements)runtime=replaceExactlyOnce(runtime,from,to,label);
  await fs.writeFile(file,runtime);
}

async function installMaAssets(targetApp){
  const fontDir=path.join(targetApp,'fonts');
  await fs.mkdir(fontDir,{recursive:true});
  await Promise.all([
    fs.copyFile(maCssSource,path.join(targetApp,'pacefold-ma.css')),
    fs.copyFile(maScriptSource,path.join(targetApp,'pacefold-ma.js')),
    fs.copyFile(themeBootSource,path.join(targetApp,'pacefold-theme-boot.js')),
    fs.copyFile(maFontSource,path.join(fontDir,'pacefold-ma.woff2')),
    fs.copyFile(maFontLicenseSource,path.join(fontDir,'OFL.txt'))
  ]);
}

async function applyMaHtml(file){
  let html=await fs.readFile(file,'utf8');
  html=html
    .replace(/\s*<link[^>]+data-pacefold-ma[^>]*>/gi,'')
    .replace(/\s*<script[^>]+data-pacefold-(?:ma|theme-boot)[^>]*><\/script>/gi,'');
  const boot=`<script src="./pacefold-theme-boot.js?v=${RELEASE}" data-pacefold-theme-boot="${RELEASE}"></script>`;
  const style=`<link rel="stylesheet" href="./pacefold-ma.css?v=${RELEASE}" data-pacefold-ma="${RELEASE}">`;
  const script=`<script defer src="./pacefold-ma.js?v=${RELEASE}" data-pacefold-ma="${RELEASE}"></script>`;
  html=replaceExactlyOnce(html,'<link rel="stylesheet" href="./app-style-01.css">',`${boot}\n<link rel="stylesheet" href="./app-style-01.css">`,'ma-theme-boot-tag');
  html=replaceExactlyOnce(html,'</head>',`${style}\n</head>`,'ma-style-tag');
  html=replaceExactlyOnce(html,'<script src="./app.js" defer></script>',`${script}\n<script src="./app.js" defer></script>`,'ma-script-order');
  await fs.writeFile(file,html);
}

async function applyMaManifest(file){
  if(!(await exists(file)))return;
  const manifest=JSON.parse(await fs.readFile(file,'utf8'));
  manifest.display='standalone';
  manifest.display_override=['window-controls-overlay','standalone'];
  await fs.writeFile(file,`${JSON.stringify(manifest,null,2)}\n`);
}

async function applyMaWorker(file,isRoot=false){
  if(!(await exists(file)))return;
  let worker=await fs.readFile(file,'utf8');
  if(isRoot){
    const cachePattern=/const CACHE_NAME=`pacefold-v\$\{VERSION\}(?:-18\.0\.0)?`;/;
    if(!cachePattern.test(worker))throw new Error('Pacefold worker cache marker is missing');
    worker=worker.replace(cachePattern,"const CACHE_NAME=`pacefold-v${VERSION}-18.0.0`;");
    if(!worker.includes("'./app/pacefold-ma.css'"))worker=replaceExactlyOnce(
        worker,
        "  './app/','./app/index.html','./app/app-style-01.css','./app/app-style-02.css','./app/app-style-03.css','./app/app-style-04.css','./app/app-style-05.css','./app/app.js'",
        "  './app/','./app/index.html','./app/app-style-01.css','./app/app-style-02.css','./app/app-style-03.css','./app/app-style-04.css','./app/app-style-05.css','./app/pacefold-hub.css','./app/pacefold-integrated.css','./app/pacefold-revamp.css','./app/pacefold-ma.css','./app/pacefold-theme-boot.js','./app/pacefold-ma.js','./app/pacefold-hub-guardian.js','./app/pacefold-resilience.js','./app/pacefold-hub.js','./app/pacefold-integrated.js','./app/pacefold-revamp.js','./app/pacefold-fold-mark.svg','./app/icons/fold-mark.png','./app/icons/notify-water.png','./app/icons/notify-eyes.png','./app/icons/notify-move.png','./app/icons/notify-prayer.png','./app/icons/notify-meal.png','./app/icons/notify-prepare.png','./app/icons/notify-away.png','./app/fonts/pacefold-ma.woff2','./app/fonts/OFL.txt','./app/app.js'",
        'ma-worker-shell'
      );
    worker=worker.replaceAll('caches.match(request)',"caches.match(request,{ignoreSearch:true})");
  }
  await fs.writeFile(file,worker);
}

const prefix='inject-runtime.mjs.gz.b64.part-';
const parts=(await fs.readdir(sourceRoot)).filter(name=>name.startsWith(prefix)).sort();
if(!parts.length)throw new Error('Pacefold inject runtime segments are missing');
const encoded=(await Promise.all(parts.map(name=>fs.readFile(path.join(sourceRoot,name),'utf8')))).join('').replace(/\s+/g,'');
const source=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
const temporary=path.join(sourceRoot,`.inject-runtime-${process.pid}-${Date.now()}.mjs`);
await fs.writeFile(temporary,source);
try{
  await import(`${pathToFileURL(temporary).href}?v=${Date.now()}`);
  const targetApp=path.join(targetRoot,'app');
  await applyLayoutPatch(path.join(targetApp,'pacefold-revamp.css'));
  await applyOrigamiPatch(path.join(targetApp,'pacefold-revamp.css'));
  await applyStabilityPatch(path.join(targetApp,'pacefold-revamp.css'));
  await fs.copyFile(markSource,path.join(targetApp,'pacefold-fold-mark.svg'));
  await applyRuntimePatch(path.join(targetApp,'pacefold-revamp.js'));
  await applyMaRevampPatch(path.join(targetApp,'pacefold-revamp.js'));
  await applyMaCorePatch(path.join(targetApp,'app.js'));
  await installMaAssets(targetApp);
  await applyAssetRevision(path.join(targetApp,'index.html'));
  await applyMaHtml(path.join(targetApp,'index.html'));
  await applyMaManifest(path.join(targetRoot,'manifest.webmanifest'));
  await applyMaManifest(path.join(targetRoot,'manifest.json'));
  await applyMaManifest(path.join(targetApp,'manifest.webmanifest'));
  await applyMaManifest(path.join(targetApp,'manifest.json'));
  await applyMaWorker(path.join(targetRoot,'service-worker.js'),true);
  await applyMaWorker(path.join(targetApp,'service-worker.js'),false);
  await stampWorker(path.join(targetRoot,'service-worker.js'));
  await stampWorker(path.join(targetApp,'service-worker.js'));
  await fs.writeFile(path.join(targetRoot,'pacefold-build.txt'),`${RELEASE}\n`);
  await fs.writeFile(path.join(targetApp,'pacefold-build.txt'),`${RELEASE}\n`);
  console.log(`Installed Pacefold ${RELEASE}: made the interval visible through the Day Ribbon and protected it with one cue scheduler.`);
}finally{
  await fs.rm(temporary,{force:true});
}
