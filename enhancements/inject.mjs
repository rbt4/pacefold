import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const RELEASE='20.0.1';
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
const siteMaCssSource=path.join(sourceRoot,'pacefold-site-ma.css');
const v19CssSource=path.join(sourceRoot,'pacefold-v19.css');
const v19ScriptSource=path.join(sourceRoot,'pacefold-v19.js');
const siteV19CssSource=path.join(sourceRoot,'pacefold-site-v19.css');
const v20CssSource=path.join(sourceRoot,'pacefold-v20.css');
const v20ScriptSource=path.join(sourceRoot,'pacefold-v20.js');
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
    /((?:\.\/)?pacefold-(?:hub(?:-guardian)?|resilience|integrated|revamp|ma|theme-boot|v19|v20)\.(?:css|js))\?v=[^"'&<\s]+/g,
    (_,asset)=>`${asset}?v=${RELEASE}`
  );
  html=html.replace(/\s*<meta\s+name=["']pacefold-build["'][^>]*>/gi,'');
  html=html.replace('</head>',`  <meta name="pacefold-build" content="${RELEASE}">\n</head>`);
  await fs.writeFile(file,html);
}
async function applyLandingPage(file){
  let html=await fs.readFile(file,'utf8');
  if(html.includes(`<meta name="pacefold-landing" content="${RELEASE}">`))return;
  html=html.replace(/\s*<meta\s+name=["']pacefold-landing["'][^>]*>/gi,'');
  const replacements=[
    [
      '<meta name="description" content="A quiet workday surface for rhythm, ergonomic care, sound and local capture with optional Microsoft OneNote sync.">',
      '<meta name="description" content="Pacefold 20 is a private, offline-ready workday folio for the clock, timers, hydration, weather, visible cue markers, protected local notes and local audio.">',
      'landing-description'
    ],
    [
      '<link rel="stylesheet" href="./site-style-02.css">',
      `<link rel="stylesheet" href="./site-style-02.css">\n<link rel="stylesheet" href="./pacefold-site-ma.css?v=${RELEASE}">\n<link rel="stylesheet" href="./pacefold-site-v19.css?v=${RELEASE}">\n<meta name="pacefold-landing" content="${RELEASE}">`,
      'landing-assets'
    ],
    [
      '<div class="eyebrow">Ma system · one quiet layer for the workday</div>',
      '<div class="eyebrow">Pacefold 20 · one protected workday folio</div>',
      'landing-eyebrow'
    ],
    [
      '<p class="lead">A calm workday surface for rhythm, ergonomic care, sound and quick capture. Pacefold stays quiet in front; your OneNote notebook can live durably underneath.</p>',
      '<p class="lead">A precise clock, visible cue markers, weather, hydration, timers and care controls share one stable folio. The lower notebook stays present and can protect itself in a backup file you choose.</p>',
      'landing-lead'
    ],
    [
      '<div class="micro">Local first · offline-ready · automatic updates · Microsoft connection optional</div>',
      '<div class="micro">Local first · offline-ready · no account · automatic updates</div>',
      'landing-micro'
    ],
    [
      '<div class="clock-line"><i></i></div>',
      '<div class="clock-line pf-site-ribbon"><i></i><span class="crease one"></span><span class="crease two"></span><span class="crease three"></span></div>',
      'landing-ribbon-preview'
    ],
    [
      '<div class="floating-card"><small>Andon</small><strong>Only one cue at a time.</strong><span>Nothing competing for attention.</span></div>',
      '<div class="floating-card"><small>Workday dashboard</small><strong>Everything important stays in reach.</strong><span>Clock, weather, timers and quiet care.</span></div>',
      'landing-floating-card'
    ],
    [
      '<div class="sectionhead"><div class="eyebrow">Setup that does not depend on a hidden browser event</div><h2>Choose your rhythm. Then install.</h2><p>Pick a profile, preparation routine, display comfort, eye and movement cadence, then install. OneNote remains a separate optional connection so setup never blocks the core clock.</p></div>',
      '<div class="sectionhead"><div class="eyebrow">Setup that does not depend on a hidden browser event</div><h2>Choose your rhythm. Then install.</h2><p>Pick a profile, preparation routine, display comfort, eye and movement cadence, then install. Everything stays local, and setup never blocks the core clock.</p></div>',
      'landing-setup'
    ],
    [
      '<div class="wrap"><div class="sectionhead"><div class="eyebrow">One calm surface · four quiet systems</div><h2>Higher capability without dashboard sprawl.</h2><p>Rhythm, Care, Sound and Kiroku share one priority system. The clock remains visually dominant; deeper tools wait in a quiet dock until you ask for them.</p></div>',
      '<div class="wrap"><div class="sectionhead"><div class="eyebrow">One dashboard · the whole workday</div><h2>Capability without the pile of panels.</h2><p>The clock, weather, timers, hydration and care controls stay together above one permanent notebook. Notes and local sound change pages inside the lower half instead of opening another layer.</p></div>',
      'landing-features-intro'
    ],
    [
      '<article class="bento"><span class="feature-tag">Oto · sound</span><h3>A layer that yields to the day.</h3><p>Generated offline brown hush, rain and fan textures need no account. Local audio and direct streams are optional. Important Pacefold cues can duck the volume automatically.</p><div class="signal-demo"><i class="dot"></i><span>Offline</span><i class="diamond"></i><span>Ducking</span><i class="square"></i><span>Media keys</span></div></article>',
      '<article class="bento"><span class="feature-tag">Music</span><h3>A utility, not another app.</h3><p>A compact dashboard control opens a focused local-audio sheet. Files stay in this browser, while streaming links remain honest bookmarks rather than unreliable embedded services.</p><div class="signal-demo"><i class="dot"></i><span>Local</span><i class="diamond"></i><span>Focused</span><i class="square"></i><span>Offline</span></div></article>',
      'landing-sound'
    ],
    [
      '<article class="bento wide"><div><span class="feature-tag">Kiroku · OneNote</span><h3>Capture here. Keep it in HSSys.</h3><p>Write a note, task, incident, inspection, JHSC item or follow-up without leaving Pacefold. It saves locally first, then silently appends to one dated page in the OneNote section you choose.</p></div><div class="ledger-lines"><span><b>9:12</b> Follow-up · local</span><span><b>11:06</b> Inspection · queued</span><span><b>2:24</b> Incident · synced</span></div></article>',
      '<article class="bento wide ma-feature"><div><span class="feature-tag">Day Ribbon</span><h3>See the workday without losing the controls.</h3><p>The ribbon keeps the current instant, scheduled moments and recorded pauses visible. The six rhythm controls remain directly beneath it, so the visual never replaces the function.</p></div><div class="ma-ribbon-demo" aria-hidden="true"><div class="rail"></div><span class="fold a"></span><span class="fold b"></span><span class="fold c"></span><small>08:30 · now · 16:30</small></div></article>',
      'landing-ma-feature'
    ],
    [
      '<article class="bento wide local-feature"><div><span class="feature-tag">Local first</span><h3>Private by default, connected by choice.</h3><p>No analytics, ads or Pacefold account. Preferences and the activity ledger stay in this browser. If you connect Microsoft, only captures are sent to the OneNote destination you choose.</p></div><div class="local-badges"><span>Offline</span><span>Auto-update</span><span>Optional sync</span><span>No score</span></div></article>',
      '<article class="bento wide local-feature"><div><span class="feature-tag">Protected local notes</span><h3>Choose the file. Pacefold keeps it current.</h3><p>No analytics, ads, account or cloud dependency. Notes stay in this browser, while Edge can keep an automatic JSON backup in a location you choose and recover it after local-storage failure when file permission remains available.</p></div><div class="local-badges"><span>Offline</span><span>Auto-backup</span><span>Automatic recovery</span><span>No account</span></div></article>',
      'landing-local'
    ],
    [
      '<details open><summary>Will Pacefold update itself?</summary><p>Yes. It checks after launch, periodically while open, when it regains focus and when connectivity returns. Updates wait rather than reloading over setup or an unfinished capture.</p></details><details><summary>Is OneNote sync really silent?</summary><p>After a one-time Microsoft sign-in and destination choice, captures queue locally and retry in the background. Microsoft Entra registration is required, and university policy may require administrator approval. <a href="./onenote-setup.html">Read the exact setup.</a></p></details><details><summary>Does the sound player control Spotify or YouTube?</summary><p>No. Pacefold generates its own offline textures and can play a local file for the session or a direct HTTPS audio source. It does not pretend it can control unrelated streaming sites.</p></details>',
      '<details open><summary>Will Pacefold update itself?</summary><p>Yes. It checks after launch, while open, when it regains focus and when connectivity returns. After a release, fully close every Pacefold and Edge PWA window once, then reopen it so the new offline shell takes control.</p></details><details><summary>Where do my notes go?</summary><p>They stay in this browser profile. In installed Edge, choose one JSON file and Pacefold updates it after note changes. If notebook storage is later missing or corrupt, Pacefold can recover from that file automatically while permission remains granted; otherwise it shows one reconnect action.</p></details><details><summary>Does the sound player control Spotify or YouTube?</summary><p>No. Local audio is primary. Named streaming links are bookmarks, not an embedded streaming dashboard, and Pacefold does not pretend it can control unrelated services.</p></details>',
      'landing-faq-local'
    ],
    [
      '<details><summary>Can it change my monitor’s colour temperature?</summary><p>It can change only Pacefold’s own interface. Full-display colour temperature belongs to Windows or monitor software, so Pacefold offers a user-initiated shortcut to Night light.</p></details><details><summary>Does it need administrator permission?</summary><p>Edge installation normally stays inside the Windows profile, but workplace policy can disable installation, Microsoft consent, notifications, background activity or badges. Pacefold never bypasses those controls.</p></details>',
      '<details><summary>Can it change my monitor’s colour temperature?</summary><p>It can change only Pacefold’s own paper and ink temperature, using a deliberately small solar shift across the day. Full-display colour remains under Windows or the monitor.</p></details><details><summary>Does it need administrator permission?</summary><p>Edge installation normally stays inside the Windows profile, but workplace policy can disable installation, notifications, persistent storage, background activity or badges. Pacefold degrades quietly and never bypasses those controls.</p></details>',
      'landing-faq-boundaries'
    ],
    [
      '<section class="wrap final"><h2>Space for what matters.</h2><p>Start with Pacefold Original or make the rhythm entirely your own.</p>',
      '<section class="wrap final"><h2>Run the whole workday from one place.</h2><p>Start with Pacefold Original or make every rhythm your own.</p>',
      'landing-final'
    ],
    [
      '<footer class="wrap footer"><span>Pacefold 15.2.2 · your day, quietly kept</span><span><a href="./privacy.html">Privacy</a> · <a href="./onenote-setup.html">OneNote setup</a> · <a href="https://github.com/rbt4/pacefold">GitHub</a></span></footer>',
      `<footer class="wrap footer"><span>Pacefold ${RELEASE} · one protected workday folio</span><span><a href="./privacy.html">Privacy</a> · <a href="./app/">Open app</a> · <a href="https://github.com/rbt4/pacefold">GitHub</a></span></footer>`,
      'landing-footer'
    ],
    [
      '<article class="bento signal-feature"><span class="feature-tag">Andon</span><h3>Quiet until one thing matters.</h3><p>The clock carries the signal first. The taskbar stays empty until something is due, and a single notification action can clear it without opening Pacefold.</p><div class="signal-demo"><i class="diamond"></i><span>Moment</span><i class="dot"></i><span>Sip</span><i class="square"></i><span>Prep</span></div></article>',
      '<article class="bento signal-feature"><span class="feature-tag">Cue engine</span><h3>Quiet until one thing matters.</h3><p>One scheduler coalesces the day instead of stacking interruptions. The dashboard shows the current priority and lets lower-priority cues wait, decay or disappear cleanly.</p><div class="signal-demo"><i class="diamond"></i><span>Moment</span><i class="dot"></i><span>Sip</span><i class="square"></i><span>Timer</span></div></article>',
      'landing-cue-engine'
    ],
    [
      '<article class="bento ledger-feature"><span class="feature-tag">Kiroku</span><h3>An honest local ledger.</h3><p>Prayer or meditation pauses, desk meals, away lunches and bathroom breaks stay separate. Overlapping off-desk time is merged instead of inflated.</p><div class="ledger-lines"><span><b>10:14</b> Midday pause · 8m</span><span><b>12:32</b> Desk meal · 19m</span><span><b>2:08</b> Away · 4m</span></div></article>',
      '<article class="bento ledger-feature"><span class="feature-tag">Day log</span><h3>An honest local record.</h3><p>Prayer or meditation pauses, desk meals, away lunches and bathroom breaks stay separate. Overlapping off-desk time is merged instead of inflated.</p><div class="ledger-lines"><span><b>10:14</b> Midday pause · 8m</span><span><b>12:32</b> Desk meal · 19m</span><span><b>2:08</b> Away · 4m</span></div></article>',
      'landing-day-log'
    ],
    [
      '<section class="section">\n  <div class="wrap"><div class="sectionhead"><div class="eyebrow">Designed by behaviour, not decoration</div><h2>Japanese restraint in the way it works.</h2><p>The influence lives in the operating logic rather than ornamental clichés.</p></div>\n  <div class="principles"><article class="principle"><span class="jp">Ma</span><h3>Protect the interval</h3><p>Useful pauses belong inside a sustainable workday.</p></article><article class="principle"><span class="jp">Andon</span><h3>Signal exceptions</h3><p>Remain quiet until one cue genuinely needs attention.</p></article><article class="principle"><span class="jp">Kiroku</span><h3>Keep the record</h3><p>Maintain a private, accurate local timeline.</p></article><article class="principle"><span class="jp">Kaizen</span><h3>One improvement</h3><p>Offer one optional adjustment, never a score.</p></article><article class="principle"><span class="jp">Hansei</span><h3>Close the day</h3><p>Reflect calmly and move on without judgment.</p></article></div></div>\n</section>',
      '<section class="section pf19-principles">\n  <div class="wrap"><div class="sectionhead"><div class="eyebrow">A Pacefold language of its own</div><h2>Calm function, visible structure.</h2><p>The influence remains in the folds, restraint and material response—not in borrowed labels or decorative themes.</p></div>\n  <div class="principles"><article class="principle"><span class="jp">01</span><h3>Keep the core visible</h3><p>Clock, weather and rhythm controls stay on the home surface.</p></article><article class="principle"><span class="jp">02</span><h3>Keep one workspace</h3><p>The notebook owns the lower half. Notes and sound change pages without modal layers.</p></article><article class="principle"><span class="jp">03</span><h3>Move with purpose</h3><p>Only state changes animate, and reduced motion loses no function.</p></article><article class="principle"><span class="jp">04</span><h3>Own the data</h3><p>Workday state remains local, portable and understandable.</p></article></div></div>\n</section>',
      'landing-own-language'
    ]
  ];
  for(const [from,to,label] of replacements)html=replaceExactlyOnce(html,from,to,label);
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
function replaceSectionExactly(source,start,end,replacement,label){
  const first=source.indexOf(start);
  const second=first<0?-1:source.indexOf(start,first+start.length);
  const finish=first<0?-1:source.indexOf(end,first+start.length);
  if(first<0||second>=0||finish<0)throw new Error(`Pacefold runtime section ${label} expected one ordered source match`);
  return source.slice(0,first)+replacement+source.slice(finish);
}
async function applyRuntimePatch(file){
  let runtime=await fs.readFile(file,'utf8');
  const replacements=[
    ["const STREAM_KEY='pacefold.player.streaming-links.v1';\nconst WORK_OVERRIDE_KEY", "const STREAM_KEY='pacefold.player.streaming-links.v1';\nconst NOTEBOOK_DRAFT_KEY='pacefold.notebook.draft.v1';\nconst VISUAL_RESET_KEY='pacefold.visual-reset.20.0.1';\nconst WORK_OVERRIDE_KEY",'visual-reset-key'],
    ["let migrateTimer=0;\nlet dbPromise=null;","let migrateTimer=0;\nlet notebookRenderKey='';\nlet playerDrawerRenderKey='';\nlet notebookMotionTimer=0;\nlet notebookAutoCloseTimer=0;\nlet playerMotionTimer=0;\nlet dbPromise=null;",'render-keys'],
    ["function saveNotebookState(){writeJSON(NOTEBOOK_UI_KEY,notebookState);}\nfunction savePlayerState()","function saveNotebookState(){writeJSON(NOTEBOOK_UI_KEY,{...notebookState,open:true});}\nfunction readNotebookDraft(){const value=readJSON(NOTEBOOK_DRAFT_KEY,null);return value&&typeof value==='object'&&!Array.isArray(value)?{body:String(value.body||'').slice(0,8000),at:Number(value.at)||0}:null;}\nfunction writeNotebookDraft(body){const value=String(body||'').slice(0,8000);if(!value){try{localStorage.removeItem(NOTEBOOK_DRAFT_KEY);}catch{}return;}writeJSON(NOTEBOOK_DRAFT_KEY,{body:value,at:Date.now()});}\nfunction clearNotebookDraft(){try{localStorage.removeItem(NOTEBOOK_DRAFT_KEY);}catch{}}\nfunction restoreNotebookDraft(){const field=workspace?.querySelector('[data-pf-note-body]'),draft=readNotebookDraft();if(field&&!field.value&&draft?.body)field.value=draft.body;}\nfunction scheduleNotebookAutoClose(){clearTimeout(notebookAutoCloseTimer);notebookAutoCloseTimer=0;}\nfunction savePlayerState()",'notebook-transient-state'],
    ["function savePlayerState(){writeJSON(PLAYER_KEY,playerState);}","function savePlayerState(){writeJSON(PLAYER_KEY,{...playerState,drawer:false});}",'player-transient-state'],
    ["function saveStreamLinks(){writeJSON(STREAM_KEY,streamLinks);}\nfunction dispatchStorage()","function saveStreamLinks(){writeJSON(STREAM_KEY,streamLinks);}\nfunction applyVisualReset(){try{if(localStorage.getItem(VISUAL_RESET_KEY)==='1')return;notebookState.open=true;notebookState.editingId=null;saveNotebookState();playerState.drawer=false;playerState.view='queue';savePlayerState();localStorage.setItem(VISUAL_RESET_KEY,'1');}catch{}}\nfunction notebookDataKey(){try{return `${localStorage.getItem(ENTRY_KEY)||''}\\u0000${localStorage.getItem(CATEGORY_KEY)||''}`;}catch{return '';} }\nfunction playerDrawerDataKey(){return JSON.stringify({view:playerState.view,drawer:Boolean(playerState.drawer),currentId:playerState.currentId,queue:playerState.queue,tracks:trackCache.map(track=>[track.id,track.name,track.fileName,track.size]),playlists,streamLinks});}\nfunction dispatchStorage()",'data-keys'],
    ["  workspace=document.getElementById(WORKSPACE_ID);\n  if(!workspace){workspace=document.createElement('section');workspace.id=WORKSPACE_ID;workspace.dataset.revision=REVISION;workspace.className='pf-local-workspace';workspace.setAttribute('aria-label','Pacefold local notebook');setHTML(workspace,workspaceMarkup());root.append(workspace);bindNotebook();}\n  workspace.dataset.open=String(notebookState.open!==false);workspace.classList.toggle('is-open',notebookState.open!==false);\n  if(dock.parentElement!==workspace)workspace.prepend(dock);\n  prepareDock();renderNotebook();","  workspace=document.getElementById(WORKSPACE_ID);let created=false;\n  if(!workspace){workspace=document.createElement('section');workspace.id=WORKSPACE_ID;workspace.dataset.revision=REVISION;workspace.className='pf-local-workspace';workspace.setAttribute('aria-label','Pacefold local notebook');setHTML(workspace,workspaceMarkup());root.append(workspace);bindNotebook();created=true;}\n  workspace.dataset.release='17.1.0';workspace.dataset.open=String(notebookState.open!==false);workspace.classList.toggle('is-open',notebookState.open!==false);\n  if(dock.parentElement!==workspace)workspace.prepend(dock);\n  prepareDock();const dataKey=notebookDataKey();if(created||dataKey!==notebookRenderKey)renderNotebook();",'workspace-render'],
    ["  title.type='button';title.className='pf-revamp-title';title.dataset.pfRevampTitle='true';title.setAttribute('aria-label','Open or collapse notebook');","  title.type='button';title.className='pf-revamp-title';title.dataset.pfRevampTitle='true';title.setAttribute('aria-label','Open or collapse notebook');title.setAttribute('aria-expanded',String(notebookState.open!==false));",'notebook-toggle-a11y'],
    ["function toggleNotebook(){notebookState.open=!(notebookState.open!==false);saveNotebookState();workspace?.classList.toggle('is-open',notebookState.open);workspace?.setAttribute('data-open',String(notebookState.open));if(notebookState.open)setTimeout(()=>workspace?.querySelector('[data-pf-note-body]')?.focus({preventScroll:true}),80);}","function setNotebookOpen(open,focus=true,closePlayer=true){const next=Boolean(open),changed=(notebookState.open!==false)!==next;if(next&&closePlayer&&playerState.drawer)setPlayerDrawer(false);clearTimeout(notebookMotionTimer);clearTimeout(notebookAutoCloseTimer);notebookAutoCloseTimer=0;notebookState.open=next;saveNotebookState();if(!workspace)return;if(changed)workspace.dataset.foldMotion=next?'opening':'closing';workspace.classList.toggle('is-open',next);workspace.setAttribute('data-open',String(next));workspace.querySelector('[data-pf-revamp-title]')?.setAttribute('aria-expanded',String(next));notebookMotionTimer=setTimeout(()=>{notebookMotionTimer=0;if(workspace?.dataset.foldMotion===(next?'opening':'closing'))delete workspace.dataset.foldMotion;},260);if(next){restoreNotebookDraft();scheduleNotebookAutoClose();if(focus)setTimeout(()=>{if(notebookState.open&&!playerState.drawer)workspace?.querySelector('[data-pf-note-body]')?.focus({preventScroll:true});},180);}}\nfunction toggleNotebook(){setNotebookOpen(!(notebookState.open!==false));}",'notebook-motion'],
    ["  if(createEntry(input.value,chosen)){input.value='';notebookState.open=true;saveNotebookState();workspace?.classList.add('is-open');workspace?.setAttribute('data-open','true');renderNotebook();showStatus('Saved locally with a timestamp.','success');}","  if(createEntry(input.value,chosen)){input.value='';renderNotebook();showStatus('Saved quietly to the notebook.','success');}",'quick-capture-motion'],
    ["  workspace.querySelector('[data-pf-note-composer]')?.addEventListener('submit',guarded('note-save',saveComposer));\n  workspace.querySelector('[data-pf-note-search]')?.addEventListener('input'","  workspace.querySelector('[data-pf-note-composer]')?.addEventListener('submit',guarded('note-save',saveComposer));\n  const draftField=workspace.querySelector('[data-pf-note-body]');draftField?.addEventListener('input',guarded('note-draft',event=>{writeNotebookDraft(event.target.value);scheduleNotebookAutoClose();}));workspace.addEventListener('pointerdown',()=>scheduleNotebookAutoClose());workspace.addEventListener('keydown',()=>scheduleNotebookAutoClose());restoreNotebookDraft();\n  workspace.querySelector('[data-pf-note-search]')?.addEventListener('input'",'notebook-draft-bind'],
    ["  body.value='';saveNotebookState();renderNotebook();updateComposerMode();","  body.value='';clearNotebookDraft();saveNotebookState();renderNotebook();updateComposerMode();showStatus('Saved in the notebook.','success');",'notebook-save-autoclose'],
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
    ["document.addEventListener('click',guarded('legacy-action',event=>{const action=event.target.closest?.('[data-pf-action]')?.dataset?.pfAction;if(action==='open-notebook'){event.preventDefault();event.stopImmediatePropagation();notebookState.open=true;saveNotebookState();queue();setTimeout(()=>workspace?.querySelector('[data-pf-note-body]')?.focus({preventScroll:true}),80);}else if(action==='open-player'){event.preventDefault();event.stopImmediatePropagation();setPlayerDrawer(true);}}),true);","document.addEventListener('click',guarded('persistent-notebook',event=>{const action=event.target.closest?.('[data-pf-action]')?.dataset?.pfAction;if(action==='open-notebook'){event.preventDefault();event.stopImmediatePropagation();setNotebookOpen(true,true);}else if(action==='open-player'){event.preventDefault();event.stopImmediatePropagation();setPlayerDrawer(true);}}),true);",'persistent-notebook-click'],
    ["window.addEventListener('focus',guarded('focus',()=>{workCache.at=0;applyWorkState();}));","window.addEventListener('focus',guarded('focus',()=>{workCache.at=0;applyWorkState();}));\ndocument.addEventListener('visibilitychange',guarded('notebook-visibility',()=>{}));",'notebook-visibility'],
    ["document.addEventListener('keydown',guarded('keyboard',event=>{if(event.key==='Escape'&&playerState.drawer){setPlayerDrawer(false);return;}if(event.ctrlKey&&event.shiftKey&&event.code==='KeyN'){event.preventDefault();notebookState.open=true;saveNotebookState();queue();setTimeout(()=>workspace?.querySelector('[data-pf-note-body]')?.focus(),80);}}));","document.addEventListener('keydown',guarded('keyboard',event=>{if(event.ctrlKey&&event.shiftKey&&event.code==='KeyN'){event.preventDefault();setNotebookOpen(true,true);}}));",'keyboard-autoclose'],
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

async function applyV19CorePatch(file){
  let runtime=await fs.readFile(file,'utf8');
  if(runtime.includes('window.__PACEFOLD_V19_CORE__='))return;
  runtime=replaceExactlyOnce(
    runtime,
    "foldMode=['capture','care','sound','onenote'].includes(mode)?mode:'capture';",
    "foldMode=['capture','care','sound'].includes(mode)?mode:'capture';",
    'v19-local-fold-modes'
  );
  runtime=replaceSectionExactly(
    runtime,
    '  function renderCaptureFold(){',
    '  function renderCareFold(){',
    `  function renderCaptureFold(){
    $('foldKicker').textContent='Quick note';$('foldTitle').textContent='Capture without leaving the day';const recent=[...prefs.captures].filter(item=>item.day===dayKey(new Date())).slice(-6).reverse(),storageWarning=storageState==='Local'?'':\`<p class="storage-warning" role="alert">Pacefold can't save to this browser. Notes will be lost when you close this window.</p>\`;
    setHTML($('foldBody'),\`\${storageWarning}<form class="capture-form" id="captureForm"><textarea class="capture-input" id="captureInput" maxlength="1200" placeholder="A note, task, follow-up, decision or useful wording…">\${escapeHtml(captureDraft)}</textarea><div class="kind-row">\${CAPTURE_KINDS.map(kind=>\`<button class="kind-chip \${captureDraftKind===kind?'active':''}" data-capture-kind="\${kind}" type="button">\${kindLabel(kind)}</button>\`).join('')}</div><div class="capture-actions"><span class="capture-status">Saved on this device</span><button class="capture-save" type="submit" \${captureDraft.trim()?'':'disabled'}>Keep this</button></div></form>\${recent.length?\`<div class="fold-section"><span class="fold-section-title">Today</span><div class="capture-list">\${recent.map(item=>\`<div class="capture-row"><time>\${new Date(item.createdAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time><p>\${escapeHtml(item.text)}</p><em>\${kindLabel(item.kind)} · local</em></div>\`).join('')}</div></div>\`:'<div class="capture-empty">Nothing captured today.</div>'}<p class="drawer-note"><strong>Local by design.</strong> Quick notes stay in this browser. The full Notes sheet adds categories, editing, Copy day and a versioned backup.</p>\`);
  }
`,
    'v19-local-capture'
  );
  runtime=replaceExactlyOnce(
    runtime,
    "$('foldKicker').textContent='Ma · care';",
    "$('foldKicker').textContent='Body reset';",
    'v19-care-language'
  );
  runtime=replaceExactlyOnce(
    runtime,
    "$('foldKicker').textContent='Oto · optional';",
    "$('foldKicker').textContent='Focus sound';",
    'v19-sound-language'
  );
  runtime=replaceSectionExactly(
    runtime,
    '  function renderOneNoteFold(){',
    '  function renderFold(){',
    "  function renderOneNoteFold(){renderCaptureFold();}\n",
    'v19-remove-onenote-fold'
  );
  runtime=replaceExactlyOnce(
    runtime,
    "function renderFold(){if(!$('foldDrawer')||$('foldDrawer').hidden)return;if(foldMode==='care')renderCareFold();else if(foldMode==='sound')renderSoundFold();else if(foldMode==='onenote')renderOneNoteFold();else renderCaptureFold();}",
    "function renderFold(){if(!$('foldDrawer')||$('foldDrawer').hidden)return;if(foldMode==='care')renderCareFold();else if(foldMode==='sound')renderSoundFold();else renderCaptureFold();}",
    'v19-fold-routing'
  );
  runtime=replaceSectionExactly(
    runtime,
    '  function saveCapture(){',
    '\n\n  function buildNoiseBuffer',
    `  function saveCapture(){
    const textValue=captureDraft.trim();if(!textValue){toast('Write something first');return false;}const createdAt=Date.now(),item={id:\`\${createdAt.toString(36)}-\${Math.random().toString(36).slice(2,8)}\`,text:textValue.slice(0,1200),kind:CAPTURE_KINDS.includes(captureDraftKind)?captureDraftKind:'inbox',createdAt,day:dayKey(new Date(createdAt)),syncedAt:0,syncError:''};
    prefs.captureKind=item.kind;prefs.captures=[...prefs.captures,item].slice(-300);const saved=save();if(saved){captureDraft='';try{localStorage.removeItem(CAPTURE_DRAFT_KEY);}catch(_){ }renderFold();toast('Captured locally');}else{toast('Held in this window · not saving');renderFold();}renderQuietDock();return saved;
  }`,
    'v19-local-capture-save'
  );
  runtime=replaceSectionExactly(
    runtime,
    '  async function syncCaptureQueue(interactive=false){',
    '  async function disconnectOneNote()',
    "  async function syncCaptureQueue(){return false;}\n",
    'v19-disable-onenote-delivery'
  );
  runtime=replaceExactlyOnce(
    runtime,
    "$('syncBtn').addEventListener('click',e=>{e.stopPropagation();openFold('onenote');});",
    "$('syncBtn').addEventListener('click',e=>{e.stopPropagation();openFold('capture');});",
    'v19-disable-onenote-route'
  );
  runtime=replaceSectionExactly(
    runtime,
    '      <div class="section-title">Kiroku · capture & OneNote</div>',
    '      <div class="section-title">Oto · sound layer</div>',
    `      <div class="section-title">Local notes</div>
      <div class="app-status"><span class="k">Today</span><span class="v">\${todayCaptures} capture\${todayCaptures===1?'':'s'}</span><span class="k">Storage</span><span class="v">This browser</span><span class="k">Handoff</span><span class="v">Copy day or backup</span></div>
      <div class="actions"><button class="action wide" data-action="openCapture" type="button">Capture a note or follow-up</button></div>
      <div class="signal-note">Quick notes stay on this device. Open Notes for categories, editing, Copy day and the versioned backup.</div>
`,
    'v19-local-notes-settings'
  );
  for(const [before,after,label] of [
    ["[['auto','Auto'],['desk','Sekkei'],['paper','Washi'],['dark','Sumi'],['moss','Moss'],['dusk','Dusk'],['custom','Custom']]","[['auto','Auto'],['desk','Clear'],['paper','Soft'],['dark','Dark'],['moss','Moss'],['dusk','Dusk'],['custom','Custom']]",'v19-theme-language'],
    ['<div class="section-title">Andon · silent cue</div>','<div class="section-title">Cue delivery</div>','v19-cue-language'],
    ['<div class="section-title">Ma · today</div>','<div class="section-title">Today</div>','v19-today-language'],
    ['<div class="section-title">Ma · workday rhythm</div>','<div class="section-title">Workday rhythm</div>','v19-rhythm-language'],
    ['<div class="section-title">Oto · sound layer</div>','<div class="section-title">Focus sound</div>','v19-player-language'],
    ['<div class="section-title">Kiroku · private timeline</div>','<div class="section-title">Day history</div>','v19-history-language'],
    ['<div class="section-title">Hansei · day close</div>','<div class="section-title">Day close</div>','v19-close-language'],
    ['<div class="section-title">Kaizen · one improvement</div>','<div class="section-title">One useful adjustment</div>','v19-improvement-language'],
    ['<div class="section-title">Andon · signal check</div>','<div class="section-title">Cue test</div>','v19-signal-language'],
    ["else if(a==='openOneNote'){openFold('onenote');return;}","else if(a==='openOneNote'){openFold('capture');return;}",'v19-settings-onenote-route']
  ])runtime=replaceExactlyOnce(runtime,before,after,label);
  runtime=replaceExactlyOnce(
    runtime,
    `      [/^Ma · today|^Kiroku · private timeline|^Hansei|^Kaizen/,'today'],
      [/^Rhythm profile|^Islamic calculation|^Personal schedule|^Ma · workday rhythm|^Meal & break flow/,'rhythm'],
      [/^Display$|^Display comfort|^Care ·|^Kiroku · capture|^Oto ·/,'tools'],
      [/^Andon · silent cue|^App, updates|^Andon · signal check/,'app']`,
    `      [/^Today|^Day history|^Day close|^One useful adjustment/,'today'],
      [/^Rhythm profile|^Islamic calculation|^Personal schedule|^Workday rhythm|^Meal & break flow/,'rhythm'],
      [/^Display$|^Display comfort|^Care ·|^Local notes|^Focus sound/,'tools'],
      [/^Cue delivery|^App, updates|^Cue test/,'app']`,
    'v19-settings-groups'
  );
  runtime=replaceExactlyOnce(
    runtime,
    "window.__PACEFOLD_MA_CORE__={getPrefs:",
    "window.__PACEFOLD_V19_CORE__={localNotesOnly:true,weatherUsesSavedLocation:true};\n  window.__PACEFOLD_MA_CORE__={getPrefs:",
    'v19-core-contract'
  );
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
    ["  workspace.dataset.release='17.1.0';",`  workspace.dataset.release='${RELEASE}';`,'ma-workspace-release'],
    ["  player.dataset.release='17.1.0';",`  player.dataset.release='${RELEASE}';`,'ma-player-release'],
    [
      "window.__PACEFOLD_REVAMP__={revision:REVISION,surfaceRelease:'17.1.0'",
      `window.__PACEFOLD_REVAMP__={revision:REVISION,surfaceRelease:'${RELEASE}'`,
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

async function installV19Assets(targetApp){
  await Promise.all([
    fs.copyFile(v19CssSource,path.join(targetApp,'pacefold-v19.css')),
    fs.copyFile(v19ScriptSource,path.join(targetApp,'pacefold-v19.js'))
  ]);
}

async function installV20Assets(targetApp){
  await Promise.all([
    fs.copyFile(v20CssSource,path.join(targetApp,'pacefold-v20.css')),
    fs.copyFile(v20ScriptSource,path.join(targetApp,'pacefold-v20.js'))
  ]);
}

async function applyV19HubPatch(file){
  let runtime=await fs.readFile(file,'utf8');
  if(runtime.includes('pacefoldV19Weather'))return;
  runtime=replaceExactlyOnce(
    runtime,
    "fetch('https://api.open-meteo.com/v1/forecast?latitude=43.6532&longitude=-79.3832&current=temperature_2m,apparent_temperature,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3',{signal:controller.signal})",
    "fetch((()=>{const pacefoldV19Weather=readJson('pacefoldPrefsV15',{}),url=new URL('https://api.open-meteo.com/v1/forecast');url.searchParams.set('latitude',String(Number.isFinite(Number(pacefoldV19Weather.lat))?Number(pacefoldV19Weather.lat):43.6532));url.searchParams.set('longitude',String(Number.isFinite(Number(pacefoldV19Weather.lng))?Number(pacefoldV19Weather.lng):-79.3832));url.searchParams.set('current','temperature_2m,apparent_temperature,weather_code');url.searchParams.set('daily','weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');url.searchParams.set('timezone','auto');url.searchParams.set('forecast_days','3');return url.href;})(),{signal:controller.signal})",
    'v19-saved-location-hub-weather'
  );
  await fs.writeFile(file,runtime);
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

async function applyV19Html(file){
  let html=await fs.readFile(file,'utf8');
  html=html
    .replace(/\s*<link[^>]+data-pacefold-v19[^>]*>/gi,'')
    .replace(/\s*<script[^>]+data-pacefold-v19[^>]*><\/script>/gi,'')
    .replaceAll(' https://graph.microsoft.com','');
  const legacyDescription='<meta name="description" content="A quiet workday rhythm clock with local capture, optional OneNote sync, ergonomic resets and an optional sound layer.">';
  const v19Description='<meta name="description" content="A private workday dashboard for the clock, weather, timers, hydration, care cues, local notes and local audio.">';
  const v20Description='<meta name="description" content="A private workday folio with a precise clock, visible cue markers, weather, timers, protected local notes and local audio.">';
  if(html.includes(legacyDescription))html=replaceExactlyOnce(html,legacyDescription,v19Description,'v19-app-description');
  else if(!html.includes(v19Description)&&!html.includes(v20Description))throw new Error('Pacefold V19 app description is missing');
  const legacyKicker='<span class="fold-kicker" id="foldKicker">Kiroku</span>';
  const v19Kicker='<span class="fold-kicker" id="foldKicker">Quick note</span>';
  if(html.includes(legacyKicker))html=replaceExactlyOnce(html,legacyKicker,v19Kicker,'v19-capture-kicker');
  else if(!html.includes(v19Kicker))throw new Error('Pacefold V19 capture label is missing');
  const style=`<link rel="stylesheet" href="./pacefold-v19.css?v=${RELEASE}" data-pacefold-v19="${RELEASE}">`;
  const script=`<script defer src="./pacefold-v19.js?v=${RELEASE}" data-pacefold-v19="${RELEASE}"></script>`;
  html=replaceExactlyOnce(html,'</head>',`${style}\n</head>`,'v19-style-tag');
  html=replaceExactlyOnce(html,'</body>',`${script}\n</body>`,'v19-script-tag');
  await fs.writeFile(file,html);
}

async function applyV20Html(file){
  let html=await fs.readFile(file,'utf8');
  html=html
    .replace(/\s*<link[^>]+data-pacefold-v20[^>]*>/gi,'')
    .replace(/\s*<script[^>]+data-pacefold-v20[^>]*><\/script>/gi,'');
  const v19Description='<meta name="description" content="A private workday dashboard for the clock, weather, timers, hydration, care cues, local notes and local audio.">';
  const v20Description='<meta name="description" content="A private workday folio with a precise clock, visible cue markers, weather, timers, protected local notes and local audio.">';
  if(html.includes(v19Description))html=replaceExactlyOnce(html,v19Description,v20Description,'v20-app-description');
  else if(!html.includes(v20Description))throw new Error('Pacefold V20 app description is missing');
  const style=`<link rel="stylesheet" href="./pacefold-v20.css?v=${RELEASE}" data-pacefold-v20="${RELEASE}">`;
  const script=`<script defer src="./pacefold-v20.js?v=${RELEASE}" data-pacefold-v20="${RELEASE}"></script>`;
  html=replaceExactlyOnce(html,'</head>',`${style}\n</head>`,'v20-style-tag');
  html=replaceExactlyOnce(html,'</body>',`${script}\n</body>`,'v20-script-tag');
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
    const cachePattern=/const CACHE_NAME=`pacefold-v\$\{VERSION\}(?:-\d+\.\d+\.\d+)?`;/;
    if(!cachePattern.test(worker))throw new Error('Pacefold worker cache marker is missing');
    worker=worker.replace(cachePattern,`const CACHE_NAME=\`pacefold-v\${VERSION}-${RELEASE}\`;`);
    if(!worker.includes("'./app/pacefold-ma.css'"))worker=replaceExactlyOnce(
        worker,
        "  './app/','./app/index.html','./app/app-style-01.css','./app/app-style-02.css','./app/app-style-03.css','./app/app-style-04.css','./app/app-style-05.css','./app/app.js'",
        "  './pacefold-site-ma.css','./pacefold-site-v19.css','./app/','./app/index.html','./app/app-style-01.css','./app/app-style-02.css','./app/app-style-03.css','./app/app-style-04.css','./app/app-style-05.css','./app/pacefold-hub.css','./app/pacefold-integrated.css','./app/pacefold-revamp.css','./app/pacefold-ma.css','./app/pacefold-v19.css','./app/pacefold-theme-boot.js','./app/pacefold-ma.js','./app/pacefold-hub-guardian.js','./app/pacefold-resilience.js','./app/pacefold-hub.js','./app/pacefold-integrated.js','./app/pacefold-revamp.js','./app/pacefold-v19.js','./app/pacefold-fold-mark.svg','./app/icons/fold-mark.png','./app/icons/notify-water.png','./app/icons/notify-eyes.png','./app/icons/notify-move.png','./app/icons/notify-prayer.png','./app/icons/notify-meal.png','./app/icons/notify-prepare.png','./app/icons/notify-away.png','./app/fonts/pacefold-ma.woff2','./app/fonts/OFL.txt','./app/app.js'",
        'ma-worker-shell'
      );
    worker=worker.replaceAll('caches.match(request)',"caches.match(request,{ignoreSearch:true})");
    if(!worker.includes("'./app/pacefold-v20.css'"))worker=replaceExactlyOnce(
      worker,
      "'./app/pacefold-v19.js'",
      "'./app/pacefold-v19.js','./app/pacefold-v20.css','./app/pacefold-v20.js'",
      'v20-worker-shell'
    );
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
  await applyV19HubPatch(path.join(targetApp,'pacefold-hub.js'));
  await fs.copyFile(siteMaCssSource,path.join(targetRoot,'pacefold-site-ma.css'));
  await fs.copyFile(siteV19CssSource,path.join(targetRoot,'pacefold-site-v19.css'));
  await applyLandingPage(path.join(targetRoot,'index.html'));
  await applyLayoutPatch(path.join(targetApp,'pacefold-revamp.css'));
  await applyOrigamiPatch(path.join(targetApp,'pacefold-revamp.css'));
  await applyStabilityPatch(path.join(targetApp,'pacefold-revamp.css'));
  await fs.copyFile(markSource,path.join(targetApp,'pacefold-fold-mark.svg'));
  await applyRuntimePatch(path.join(targetApp,'pacefold-revamp.js'));
  await applyMaRevampPatch(path.join(targetApp,'pacefold-revamp.js'));
  await applyMaCorePatch(path.join(targetApp,'app.js'));
  await applyV19CorePatch(path.join(targetApp,'app.js'));
  await installMaAssets(targetApp);
  await installV19Assets(targetApp);
  await installV20Assets(targetApp);
  await applyAssetRevision(path.join(targetApp,'index.html'));
  await applyMaHtml(path.join(targetApp,'index.html'));
  await applyV19Html(path.join(targetApp,'index.html'));
  await applyV20Html(path.join(targetApp,'index.html'));
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
  console.log(`Installed Pacefold ${RELEASE}: rebuilt the stable workday folio, visible cue markers and automatic note backup.`);
}finally{
  await fs.rm(temporary,{force:true});
}
