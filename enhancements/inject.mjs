import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const sourceRoot=path.dirname(fileURLToPath(import.meta.url));
const targetRoot=path.resolve(process.argv[2]||'_site');
const layoutMarker='pacefold-16-layout-floor';
const origamiMarker='pacefold-16.1-origami-identity';
const origamiSource=path.join(sourceRoot,'pacefold-origami.css');
const origamiPolishSource=path.join(sourceRoot,'pacefold-origami-polish.css');
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
async function replaceMarkedBlock(file,marker,content){
  let source=await fs.readFile(file,'utf8');
  const start=`/* BEGIN ${marker} */`;
  const end=`/* END ${marker} */`;
  const startIndex=source.indexOf(start);
  if(startIndex>=0){
    const endIndex=source.indexOf(end,startIndex);
    if(endIndex<0)throw new Error(`Pacefold ${marker} end marker is missing`);
    source=source.slice(0,startIndex)+source.slice(endIndex+end.length);
  }
  source=source.replace(/\s+$/,'')+`\n\n${start}\n${content.trim()}\n${end}\n`;
  await fs.writeFile(file,source);
}
async function applyLayoutPatch(file){
  const inner=layoutPatch.trim().replace(`/* BEGIN ${layoutMarker} */`,'').replace(`/* END ${layoutMarker} */`,'').trim();
  await replaceMarkedBlock(file,layoutMarker,inner);
}
async function applyOrigamiPatch(file){
  const identity=await fs.readFile(origamiSource,'utf8');
  const polish=await fs.readFile(origamiPolishSource,'utf8');
  await replaceMarkedBlock(file,origamiMarker,`${identity.trim()}\n\n${polish.trim()}`);
}
function replaceExactlyOnce(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0||source.indexOf(from,first+1)>=0)throw new Error(`Pacefold runtime patch ${label} expected exactly one source match`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}
async function applyRuntimePatch(file){
  let runtime=await fs.readFile(file,'utf8');
  const replacements=[
    ["const STREAM_KEY='pacefold.player.streaming-links.v1';\nconst WORK_OVERRIDE_KEY", "const STREAM_KEY='pacefold.player.streaming-links.v1';\nconst VISUAL_RESET_KEY='pacefold.visual-reset.16.1.0';\nconst WORK_OVERRIDE_KEY",'visual-reset-key'],
    ["let migrateTimer=0;\nlet dbPromise=null;","let migrateTimer=0;\nlet notebookRenderKey='';\nlet playerDrawerRenderKey='';\nlet dbPromise=null;",'render-keys'],
    ["function saveStreamLinks(){writeJSON(STREAM_KEY,streamLinks);}\nfunction dispatchStorage()","function saveStreamLinks(){writeJSON(STREAM_KEY,streamLinks);}\nfunction applyVisualReset(){try{if(localStorage.getItem(VISUAL_RESET_KEY)==='1')return;playerState.drawer=false;playerState.view='queue';savePlayerState();localStorage.setItem(VISUAL_RESET_KEY,'1');}catch{}}\nfunction notebookDataKey(){try{return `${localStorage.getItem(ENTRY_KEY)||''}\\u0000${localStorage.getItem(CATEGORY_KEY)||''}`;}catch{return '';} }\nfunction playerDrawerDataKey(){return JSON.stringify({view:playerState.view,drawer:Boolean(playerState.drawer),currentId:playerState.currentId,queue:playerState.queue,tracks:trackCache.map(track=>[track.id,track.name,track.fileName,track.size]),playlists,streamLinks});}\nfunction dispatchStorage()",'data-keys'],
    ["  workspace=document.getElementById(WORKSPACE_ID);\n  if(!workspace){workspace=document.createElement('section');workspace.id=WORKSPACE_ID;workspace.dataset.revision=REVISION;workspace.className='pf-local-workspace';workspace.setAttribute('aria-label','Pacefold local notebook');setHTML(workspace,workspaceMarkup());root.append(workspace);bindNotebook();}\n  workspace.dataset.open=String(notebookState.open!==false);workspace.classList.toggle('is-open',notebookState.open!==false);\n  if(dock.parentElement!==workspace)workspace.prepend(dock);\n  prepareDock();renderNotebook();","  workspace=document.getElementById(WORKSPACE_ID);let created=false;\n  if(!workspace){workspace=document.createElement('section');workspace.id=WORKSPACE_ID;workspace.dataset.revision=REVISION;workspace.className='pf-local-workspace';workspace.setAttribute('aria-label','Pacefold local notebook');setHTML(workspace,workspaceMarkup());root.append(workspace);bindNotebook();created=true;}\n  workspace.dataset.open=String(notebookState.open!==false);workspace.classList.toggle('is-open',notebookState.open!==false);\n  if(dock.parentElement!==workspace)workspace.prepend(dock);\n  prepareDock();const dataKey=notebookDataKey();if(created||dataKey!==notebookRenderKey)renderNotebook();",'workspace-render'],
    ["  for(const popup of root.querySelectorAll('.pf-notebook,[data-pf-notebook-root]')){if(!popup.closest(`#${WORKSPACE_ID}`)){popup.hidden=true;popup.setAttribute('aria-hidden','true');}}","  for(const popup of root.querySelectorAll('.pf-notebook,[data-pf-notebook-root]')){if(popup.closest(`#${WORKSPACE_ID}`))continue;if(!popup.hidden)popup.hidden=true;if(popup.getAttribute('aria-hidden')!=='true')popup.setAttribute('aria-hidden','true');}",'popup-idempotence'],
    ["function renderNotebook(){if(!workspace)return;workspace.dataset.open=String(notebookState.open!==false);workspace.classList.toggle('is-open',notebookState.open!==false);const date=workspace.querySelector('[data-pf-notebook-date]');if(date)date.textContent=longDate(notebookState.date);renderCategorySelect();renderDocument();renderTabs();prepareDock();}","function renderNotebook(){if(!workspace)return;workspace.dataset.open=String(notebookState.open!==false);workspace.classList.toggle('is-open',notebookState.open!==false);const date=workspace.querySelector('[data-pf-notebook-date]');if(date)date.textContent=longDate(notebookState.date);renderCategorySelect();renderDocument();renderTabs();prepareDock();notebookRenderKey=notebookDataKey();}",'notebook-render-key'],
    ["function ensurePlayer(){\n  if(!root)return;player=document.getElementById(PLAYER_ID);\n  if(!player){player=document.createElement('aside');player.id=PLAYER_ID;player.dataset.revision=REVISION;player.className='pf-local-player';player.setAttribute('aria-label','Pacefold local music player');setHTML(player,playerMarkup());root.append(player);audio=document.createElement('audio');audio.preload='metadata';player.append(audio);bindPlayer();refreshTracks();}\n  for(const legacy of root.querySelectorAll('.pf-player-row[data-pf-flow-source=\"true\"]'))legacy.dataset.pfLegacyPlayer='true';\n  renderPlayer();renderPlayerDrawer();\n}","function ensurePlayer(){\n  if(!root)return;player=document.getElementById(PLAYER_ID);let created=false;\n  if(!player){player=document.createElement('aside');player.id=PLAYER_ID;player.dataset.revision=REVISION;player.className='pf-local-player';player.setAttribute('aria-label','Pacefold local music player');setHTML(player,playerMarkup());root.append(player);audio=document.createElement('audio');audio.preload='metadata';player.append(audio);bindPlayer();refreshTracks();created=true;}\n  for(const legacy of root.querySelectorAll('.pf-player-row[data-pf-flow-source=\"true\"]'))if(legacy.dataset.pfLegacyPlayer!=='true')legacy.dataset.pfLegacyPlayer='true';\n  renderPlayer();const drawerKey=playerDrawerDataKey();if(created||drawerKey!==playerDrawerRenderKey)renderPlayerDrawer();\n}",'player-render'],
    ["  bindInlinePlayerFiles();\n}","  bindInlinePlayerFiles();playerDrawerRenderKey=playerDrawerDataKey();\n}",'player-drawer-render-key'],
    ["  for(const note of root?.querySelectorAll('.pf-notebook,[data-pf-notebook-root]')||[]){if(note.closest(`#${WORKSPACE_ID}`))continue;if(!note.hidden&&note.getAttribute('aria-hidden')!=='true')notebookWasOpened=true;note.hidden=true;note.setAttribute('aria-hidden','true');}","  for(const note of root?.querySelectorAll('.pf-notebook,[data-pf-notebook-root]')||[]){if(note.closest(`#${WORKSPACE_ID}`))continue;if(!note.hidden&&note.getAttribute('aria-hidden')!=='true')notebookWasOpened=true;if(!note.hidden)note.hidden=true;if(note.getAttribute('aria-hidden')!=='true')note.setAttribute('aria-hidden','true');}",'legacy-notebook-idempotence'],
    ["  for(const legacy of root?.querySelectorAll('.pf-player-row[data-pf-flow-source=\"true\"]')||[])legacy.dataset.pfLegacyPlayer='true';","  for(const legacy of root?.querySelectorAll('.pf-player-row[data-pf-flow-source=\"true\"]')||[])if(legacy.dataset.pfLegacyPlayer!=='true')legacy.dataset.pfLegacyPlayer='true';",'legacy-player-idempotence'],
    ["window.addEventListener('storage',event=>{if(event.key?.startsWith('pacefold.')){workCache.at=0;queue();}});","window.addEventListener('storage',event=>{if(event.key?.startsWith('pacefold.')){workCache.at=0;if([ENTRY_KEY,CATEGORY_KEY].includes(event.key))notebookRenderKey='';queue();}});",'storage-invalidation'],
    ["installBadgePolicy();bindObserver();","applyVisualReset();installBadgePolicy();bindObserver();",'visual-reset-call']
  ];
  for(const [from,to,label] of replacements)runtime=replaceExactlyOnce(runtime,from,to,label);
  await fs.writeFile(file,runtime);
}
await applyLayoutPatch(path.join(sourceRoot,'pacefold-revamp.css'));
await applyOrigamiPatch(path.join(sourceRoot,'pacefold-revamp.css'));

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
  await fs.copyFile(markSource,path.join(targetApp,'pacefold-fold-mark.svg'));
  await applyRuntimePatch(path.join(targetApp,'pacefold-revamp.js'));
}finally{
  await fs.rm(temporary,{force:true});
}
