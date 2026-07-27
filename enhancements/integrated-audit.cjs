'use strict';

const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(process.argv[2]||'_release');
const artifactRoot=path.resolve(process.argv[3]||'/tmp/pacefold-integrated-artifacts');
const port=4183;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let phase='startup';
const mark=name=>{phase=name;console.log(`PACEFOLD_FLOW_AUDIT_PHASE ${name}`);};
const host=scripts=>`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.open-meteo.com; img-src 'self' data: blob:; media-src 'self' blob:; frame-src https://www.youtube-nocookie.com https://open.spotify.com https://music.amazon.ca https://music.amazon.com"><link rel="stylesheet" href="/app/pacefold-hub.css"><link rel="stylesheet" href="/app/pacefold-integrated.css"><link rel="stylesheet" href="/app/pacefold-revamp.css"></head><body><main style="min-height:100vh">Today</main>${scripts}</body></html>`;
const scripts='<script defer src="/app/pacefold-hub-guardian.js"></script><script defer src="/app/pacefold-resilience.js"></script><script defer src="/app/pacefold-hub.js"></script><script defer src="/app/pacefold-integrated.js"></script><script defer src="/app/pacefold-revamp.js"></script>';
const server=http.createServer((request,response)=>{
  const requestPath=decodeURIComponent((request.url||'/').split('?')[0]);
  if(requestPath==='/__blank')return response.end('<!doctype html><html><body>blank</body></html>');
  if(requestPath==='/__flow_host'){response.setHeader('Content-Type','text/html');return response.end(host(scripts));}
  const relative=requestPath.replace(/^\/+/, '')||'index.html';
  let file=path.join(root,relative);
  if(!file.startsWith(root))return response.writeHead(403).end('Forbidden');
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file))return response.writeHead(404).end('Not found');
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
  response.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  response.end(fs.readFileSync(file));
});

function assert(condition,message){if(!condition)throw new Error(message);}
function pngSignature(file){return fs.existsSync(file)&&fs.readFileSync(file).subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));}
function manifestFiles(){return [path.join(root,'manifest.webmanifest'),path.join(root,'manifest.json'),path.join(root,'app','manifest.webmanifest'),path.join(root,'app','manifest.json')].filter(fs.existsSync);}
function installBrowserStubs(context){
  return context.addInitScript(()=>{
    window.__badgeEvents=[];window.__closedNotifications=0;window.__clipboardWrites=[];window.__openedLinks=[];
    Object.defineProperty(navigator,'setAppBadge',{configurable:true,value:async(...args)=>window.__badgeEvents.push(['set',args.length,args[0]??null])});
    Object.defineProperty(navigator,'clearAppBadge',{configurable:true,value:async()=>window.__badgeEvents.push(['clear'])});
    try{Object.defineProperty(ServiceWorkerContainer.prototype,'getRegistration',{configurable:true,value:async()=>({getNotifications:async()=>[{close(){window.__closedNotifications+=1;}}]})});}catch{}
    try{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__clipboardWrites.push(String(text))}});}catch{}
    Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{}});
    window.confirm=()=>true;
    window.open=(url)=>{window.__openedLinks.push(String(url));return null;};
    window.PacefoldOneNote={syncPage:async()=>true};
  });
}
async function routeProviders(page){
  await page.route('https://api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({current:{temperature_2m:21,apparent_temperature:21,weather_code:1},daily:{time:['2099-01-01'],weather_code:[1],temperature_2m_max:[23],temperature_2m_min:[14],precipitation_probability_max:[5]}})}));
  await page.route(/https:\/\/(?:www\.youtube-nocookie\.com|open\.spotify\.com|music\.amazon\.).*/,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Provider</title>'}));
}

async function main(){
  let browser;
  try{
    fs.mkdirSync(artifactRoot,{recursive:true});
    mark('static-contract');
    const appHtml=fs.readFileSync(path.join(root,'app','index.html'),'utf8');
    const flow=fs.readFileSync(path.join(root,'app','pacefold-integrated.js'),'utf8');
    const revamp=fs.readFileSync(path.join(root,'app','pacefold-revamp.js'),'utf8');
    const revampCss=fs.readFileSync(path.join(root,'app','pacefold-revamp.css'),'utf8');
    const guardian=fs.readFileSync(path.join(root,'app','pacefold-hub-guardian.js'),'utf8');
    const worker=fs.readFileSync(path.join(root,'app','service-worker.js'),'utf8');
    assert(flow.includes("const VERSION='15.8.0'"),'Integrated runtime version missing');
    assert(revamp.includes("const REVISION='16.0.0'"),'16.0 local workspace runtime missing');
    assert(revamp.includes("const ENTRY_KEY='pacefold.notebook.entries.v2'")&&revamp.includes('migrateEntries()'),'Nondestructive notebook migration is missing');
    assert(revamp.includes('copyDay')&&revamp.includes('exportBackup')&&revamp.includes('noteMarkup'),'Notebook copy, backup or formatting contract is missing');
    assert(revamp.includes("const DB_NAME='pacefold-local-media'")&&revamp.includes('indexedDB.open')&&revamp.includes('playlists'),'Local media library, queue or playlists contract is missing');
    assert(!revamp.includes('syncOneNote')&&!revamp.includes('waitForSyncAction'),'OneNote dependency survived the local-first revamp');
    assert(revampCss.includes('#pf-local-workspace')&&revampCss.includes('.pf-notebook-tabs')&&revampCss.includes('#pf-local-player'),'Notebook, tabs or player visual contract is missing');
    assert(revampCss.includes('background:#070908'),'Bottom player is not independently black');
    assert(guardian.includes("const VERSION='15.8.0'"),'Guardian version is not 15.8.0');
    assert(worker.includes('requireInteraction:false')&&worker.includes('pacefold-current-cue')&&worker.includes('PACEFOLD_WORK_STATE'),'Worker notification quieting contract is incomplete');
    for(const name of ['fold-mark.png','notify-water.png','notify-eyes.png','notify-move.png','notify-prayer.png','notify-meal.png','notify-prepare.png','notify-away.png'])assert(pngSignature(path.join(root,'app','icons',name)),`${name} is missing or not a valid PNG`);
    const revampIndex=appHtml.indexOf('data-pacefold-revamp="16.0.0"');
    assert(revampIndex>=0,'16.0 cache-busted revamp asset marker is missing');
    const manifests=manifestFiles();assert(manifests.length>0,'No Pacefold manifest was found');
    const shortcutUrls=manifests.flatMap(file=>{try{return (JSON.parse(fs.readFileSync(file,'utf8')).shortcuts||[]).map(item=>String(item.url||''));}catch{return [];}});
    for(const intent of ['current','capture','notebook','media'])assert(shortcutUrls.some(url=>new RegExp(`[?&]pf=${intent}(?:&|$)`).test(url)),`Manifest shortcut pf=${intent} is missing`);

    mark('browser-start');
    await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:1280,height:800}});
    await installBrowserStubs(context);
    const page=await context.newPage();await routeProviders(page);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>message.type()==='error'&&errors.push(message.text()));
    await page.goto(`http://127.0.0.1:${port}/__blank`);
    await page.evaluate(()=>localStorage.setItem('pacefold.notebook.entries.v2',JSON.stringify([{id:'existing',body:'Existing local note',section:'Daily',date:new Date().toISOString().slice(0,10)}])));
    await page.goto(`http://127.0.0.1:{port}/__flow_host`,{waitUntil:'load'});
    await page.waitForSelector('#pf-local-workspace');await page.waitForSelector('#pf-local-player');
    await page.waitForFunction(()=>window.__PACEFOLD_REVAMP__?.revision==='16.0.0');

    mark('architecture');
    const architecture=await page.evaluate(()=>{
      const workspace=document.getElementById('pf-local-workspace'),player=document.getElementById('pf-local-player'),dock=document.getElementById('pf-flow-dock');
      const workspaceRect=workspace?.getBoundingClientRect(),playerRect=player?.getBoundingClientRect();
      return {
        roots:document.querySelectorAll('#pf-hub-root').length,workspaces:document.querySelectorAll('#pf-local-workspace').length,players:document.querySelectorAll('#pf-local-player').length,docks:document.querySelectorAll('#pf-flow-dock').length,
        dockInside:Boolean(dock?.closest('#pf-local-workspace')),workspaceAbovePlayer:(workspaceRect?.bottom||0)<=(playerRect?.top||0)+2,
        playerBackground:getComputedStyle(player?.querySelector('.pf-player-bar')).backgroundColor,legacyPopup:[l...document.querySelectorAll('.pf-notebook')].some(node=>getComputedStyle(node).display!=='none'),
        migrated:JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]')[0]
      };
    });
    assert(architecture.roots===1&&architecture.workspaces===1&&architecture.players===1&&architecture.docks===1&&architecture.dockInside&&architecture.workspaceAbovePlayer,`Integrated local architecture is invalid: ${JSON.stringify(architecture)}`);
    assert(/rgba%\(7\,sj'${JSON.stringify(architecture)}`);
    assert(architecture.legacyPopup===false,'Legacy notebook popup remained visible');
    assert(architecture.migrated?.id==='existing'&&architecture.migrated?.body==='Existing local note'&&architecture.migrated?.createdAt&&architecture.migrated?.category,`Legacy note migration failed: ${JSON.stringify(architecture.migrated)}`);

    mark('quick-capture');
    await page.locator('[data-pf-flow-input]').fill('/incident Flow audit note');
    await page.locator('[data-pf-flow-form]').evaluate(form=>form.requestSubmit());
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').some(item=>item.body==='Flow audit note'&&item.category==='Incidents'));
    const capture=await page.evaluate(()=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').filter(item=>item.body==='Flow audit note'));
    assert(capture.length===1&&capture[0].category==='Incidents'&&capture[0].createdAt&&capture[0].updatedAt,'Quick capture was not timestamped, categorized and saved exactly once');
    assert(await page.getByText('Flow audit note').isVisible(),'Quick capture is not visible in the integrated notebook');

    mark('formatting-and-category-tabs');
    await page.locator('[data-pF