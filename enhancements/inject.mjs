import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const RELEASE='17.1.0';
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
    /((?:\.\/)?pacefold-(?:hub(?:-guardian)?|resilience|integrated|revamp)\.(?:css|js))\?v=[^"'&<\s]+/g,
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
  await applyAssetRevision(path.join(targetApp,'index.html'));
  await stampWorker(path.join(targetRoot,'service-worker.js'));
  await stampWorker(path.join(targetApp,'service-worker.js'));
  await fs.writeFile(path.join(targetRoot,'pacefold-build.txt'),`${RELEASE}\n`);
  await fs.writeFile(path.join(targetApp,'pacefold-build.txt'),`${RELEASE}\n`);
  console.log(`Installed Pacefold ${RELEASE}: restored rhythm-first clock with a transient notebook and exclusive local audio.`);
}finally{
  await fs.rm(temporary,{force:true});
}
