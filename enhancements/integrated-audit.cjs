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
const host=scripts=>`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.open-meteo.com https://graph.microsoft.com; img-src 'self' data:; frame-src https://www.youtube-nocookie.com https://open.spotify.com https://music.amazon.ca https://music.amazon.com"><link rel="stylesheet" href="/app/pacefold-hub.css"><link rel="stylesheet" href="/app/pacefold-integrated.css"></head><body><main style="min-height:100vh">Today</main>${scripts}</body></html>`;
const scripts='<script defer src="/app/pacefold-hub-guardian.js"></script><script defer src="/app/pacefold-resilience.js"></script><script defer src="/app/pacefold-hub.js"></script><script defer src="/app/pacefold-integrated.js"></script>';
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
function manifestFiles(){
  return [
    path.join(root,'manifest.webmanifest'),path.join(root,'manifest.json'),
    path.join(root,'app','manifest.webmanifest'),path.join(root,'app','manifest.json')
  ].filter(fs.existsSync);
}
function installBrowserStubs(context){
  return context.addInitScript(()=>{
    window.__badgeEvents=[];
    window.__closedNotifications=0;
    window.__oneNoteSyncs=[];
    Object.defineProperty(navigator,'setAppBadge',{configurable:true,value:async value=>window.__badgeEvents.push(['set',value??1])});
    Object.defineProperty(navigator,'clearAppBadge',{configurable:true,value:async()=>window.__badgeEvents.push(['clear'])});
    try{
      Object.defineProperty(ServiceWorkerContainer.prototype,'getRegistration',{configurable:true,value:async()=>({getNotifications:async()=>[{close(){window.__closedNotifications+=1;}}]})});
    }catch{}
    Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{}});
    window.PacefoldOneNote={syncPage:async payload=>{window.__oneNoteSyncs.push(payload);return true;}};
  });
}
async function routeProviders(page){
  await page.route('https://api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({current:{temperature_2m:21,apparent_temperature:21,weather_code:1},daily:{time:['2099-01-01','2099-01-02','2099-01-03'],weather_code:[1,2,61],temperature_2m_max:[23,22,19],temperature_2m_min:[14,13,12],precipitation_probability_max:[5,15,65]}})}));
  await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>YouTube</title>'}));
  await page.route('https://open.spotify.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Spotify</title>'}));
  await page.route(/https:\/\/music\.amazon\..*/,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Amazon</title>'}));
}
async function addCue(page,label='Drink water'){
  await page.evaluate(text=>{
    document.getElementById('pf-flow-audit-cue')?.remove();
    const cue=document.createElement('div');
    cue.id='pf-flow-audit-cue';cue.setAttribute('role','alert');
    cue.innerHTML=`<span>${text}</span><button>Done</button>`;
    window.__cueClicks=0;
    cue.querySelector('button').onclick=()=>{window.__cueClicks+=1;cue.remove();};
    document.body.append(cue);
  },label);
  await page.waitForSelector('.pf-andon.is-waiting',{timeout:4000});
  await page.waitForFunction(()=>document.querySelector('[data-pf-flow-pulse]')?.dataset.state==='new');
}

async function main(){
  let browser;
  try{
    fs.mkdirSync(artifactRoot,{recursive:true});
    mark('static-contract');
    const appHtml=fs.readFileSync(path.join(root,'app','index.html'),'utf8');
    const flow=fs.readFileSync(path.join(root,'app','pacefold-integrated.js'),'utf8');
    const flowCss=fs.readFileSync(path.join(root,'app','pacefold-integrated.css'),'utf8');
    const guardian=fs.readFileSync(path.join(root,'app','pacefold-hub-guardian.js'),'utf8');
    const resilience=fs.readFileSync(path.join(root,'app','pacefold-resilience.js'),'utf8');
    const worker=fs.readFileSync(path.join(root,'app','service-worker.js'),'utf8');
    assert(flow.includes("const VERSION='15.8.0'"),'Integrated runtime version missing');
    assert(guardian.includes("const VERSION='15.8.0'"),'Guardian version is not 15.8.0');
    assert(resilience.includes("const VERSION='15.8.0'"),'Resilience version is not 15.8.0');
    assert(flow.includes("const ACK_KEY='pacefold.flow.ack.v1'")&&flow.includes('taskbar-acknowledged'),'Taskbar acknowledgement contract is missing');
    for(const route of ['/incident','/follow','/jhsc'])assert(flow.includes(route.slice(1)),`Capture route ${route} is missing`);
    assert(flowCss.includes('min-height:48px')&&flowCss.includes('@media (max-width:760px)'),'Minimal dock or mobile contract missing');
    const guardianIndex=appHtml.indexOf('data-pacefold-hub-guardian="15.8.0"');
    const resilienceIndex=appHtml.indexOf('data-pacefold-resilience="15.8.0"');
    const hubIndex=appHtml.indexOf('data-pacefold-hub="15.8.0"',resilienceIndex+1);
    const flowIndex=appHtml.indexOf('data-pacefold-flow="15.8.0"',hubIndex+1);
    assert(guardianIndex>=0&&guardianIndex<resilienceIndex&&resilienceIndex<hubIndex&&hubIndex<flowIndex,'Startup order is not guardian → resilience → hub → integrated');
    assert((appHtml.match(/data-pacefold-flow="15\.8\.0"/g)||[]).length===2,'Integrated CSS/script markers are not idempotent');
    assert((worker.match(/BEGIN pacefold-resilience-15\.8\.0/g)||[]).length===1,'15.8 worker patch is duplicated');
    assert(worker.includes('notify-water.png')&&worker.includes('fold-mark.png')&&!worker.includes("notify-water.svg';"),'Worker is not using raster notification artwork');
    for(const name of ['fold-mark.png','notify-water.png','notify-eyes.png','notify-move.png','notify-prayer.png','notify-meal.png','notify-prepare.png','notify-away.png']){
      assert(pngSignature(path.join(root,'app','icons',name)),`${name} is missing or not a valid PNG`);
    }
    const manifests=manifestFiles();
    assert(manifests.length>0,'No Pacefold manifest was found');
    const shortcutUrls=manifests.flatMap(file=>{
      try{return (JSON.parse(fs.readFileSync(file,'utf8')).shortcuts||[]).map(item=>String(item.url||''));}catch{return [];}
    });
    for(const intent of ['current','capture','notebook','media'])assert(shortcutUrls.some(url=>new RegExp(`[?&]pf=${intent}(?:&|$)`).test(url)),`Manifest shortcut pf=${intent} is missing`);

    mark('browser-start');
    await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:1280,height:800}});
    await installBrowserStubs(context);
    const page=await context.newPage();
    await routeProviders(page);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>message.type()==='error'&&errors.push(message.text()));
    await page.goto(`http://127.0.0.1:${port}/__blank`);
    await page.evaluate(()=>localStorage.setItem('pacefold.notebook.entries.v2',JSON.stringify([{id:'existing',body:'Existing note',section:'Daily',date:new Date().toISOString().slice(0,10)}])));
    await page.goto(`http://127.0.0.1:${port}/__flow_host`,{waitUntil:'load'});
    await page.waitForSelector('#pf-flow-dock');
    await page.waitForFunction(()=>window.__PACEFOLD_FLOW__?.version==='15.8.0');

    mark('architecture');
    const architecture=await page.evaluate(()=>({
      roots:document.querySelectorAll('#pf-hub-root').length,
      docks:document.querySelectorAll('#pf-flow-dock').length,
      version:document.getElementById('pf-flow-dock')?.dataset.version,
      captureSources:document.querySelectorAll('[data-pf-capture-form][data-pf-flow-source="true"]').length,
      playerSources:document.querySelectorAll('.pf-player-row[data-pf-flow-source="true"]').length,
      andonSources:document.querySelectorAll('.pf-andon[data-pf-flow-source="true"]').length,
      barHeight:document.querySelector('.pf-flow-bar')?.getBoundingClientRect().height,
      unknown:[...document.querySelectorAll('#pf-hub-root [data-pf-action]')].map(node=>node.dataset.pfAction).filter(action=>!window.__PACEFOLD_SURFACE__.actions.includes(action))
    }));
    assert(architecture.roots===1&&architecture.docks===1&&architecture.version==='15.8.0',`Integrated architecture is invalid: ${JSON.stringify(architecture)}`);
    assert(architecture.captureSources===1&&architecture.playerSources===1&&architecture.andonSources===1,'Proven source controls were not retained exactly once');
    assert(architecture.barHeight<=60,`Desktop dock is too tall: ${architecture.barHeight}`);
    assert(architecture.unknown.length===0,`Unknown hub actions exist: ${architecture.unknown.join(',')}`);

    mark('slash-capture');
    await page.locator('[data-pf-flow-input]').fill('/incident Flow audit note');
    await page.locator('[data-pf-flow-form]').evaluate(form=>form.requestSubmit());
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').some(item=>item.body==='Flow audit note'&&item.section==='Incidents'));
    const capture=await page.evaluate(()=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').filter(item=>item.body==='Flow audit note'));
    assert(capture.length===1&&capture[0].section==='Incidents',`Slash capture was not exactly once: ${JSON.stringify(capture)}`);

    mark('taskbar-acknowledgement');
    await addCue(page);
    await page.waitForFunction(()=>window.__badgeEvents.some(event=>event[0]==='set'));
    await page.locator('[data-pf-flow-pulse]').click();
    await page.waitForFunction(()=>localStorage.getItem('pacefold.flow.ack.v1')&&window.__badgeEvents.some(event=>event[0]==='clear'));
    await page.waitForTimeout(80);
    const acknowledged=await page.evaluate(()=>({
      cueClicks:window.__cueClicks,
      cueWaiting:Boolean(document.querySelector('.pf-andon.is-waiting')),
      panelHidden:document.querySelector('[data-pf-flow-panel]').hidden,
      pulseState:document.querySelector('[data-pf-flow-pulse]').dataset.state,
      closed:window.__closedNotifications,
      ack:JSON.parse(localStorage.getItem('pacefold.flow.ack.v1')||'null')
    }));
    assert(acknowledged.cueClicks===0&&acknowledged.cueWaiting&&acknowledged.panelHidden&&acknowledged.pulseState==='waiting',`Taskbar acknowledgement completed or opened the cue: ${JSON.stringify(acknowledged)}`);
    assert(acknowledged.closed>=1&&acknowledged.ack?.version==='15.8.0','Taskbar acknowledgement did not clear notification state');

    mark('second-interaction-and-done');
    await page.locator('[data-pf-flow-pulse]').click();
    await page.waitForFunction(()=>document.querySelector('[data-pf-flow-panel]')?.hidden===false);
    assert(await page.locator('[data-pf-flow-done]').isEnabled(),'Done action is unavailable for a waiting cue');
    await page.locator('[data-pf-flow-done]').click();
    await page.waitForFunction(()=>window.__cueClicks===1&&!document.getElementById('pf-flow-audit-cue'));
    await page.waitForFunction(()=>document.querySelector('[data-pf-flow-pulse]')?.dataset.state==='calm');

    mark('notebook-proxy');
    await page.locator('[data-pf-flow-tool="notebook"]').first().click();
    await page.waitForSelector('.pf-notebook');
    assert(await page.getByText('Flow audit note').isVisible(),'Notebook proxy did not open the persisted capture');

    mark('root-recovery');
    await page.evaluate(()=>document.getElementById('pf-hub-root').remove());
    await page.waitForFunction(()=>document.querySelectorAll('#pf-hub-root').length===1&&document.querySelectorAll('#pf-flow-dock').length===1,{timeout:4000});

    mark('desktop-visual');
    await page.evaluate(()=>window.__PACEFOLD_FLOW__.setPanel(true,false));
    await page.screenshot({path:path.join(artifactRoot,'pacefold-flow-desktop.png'),fullPage:true});

    mark('launch-capture');
    const launch=await context.newPage();
    await routeProviders(launch);
    await launch.goto(`http://127.0.0.1:${port}/__flow_host?pf=capture`,{waitUntil:'load'});
    await launch.waitForSelector('#pf-flow-dock');
    await launch.waitForFunction(()=>document.activeElement?.matches?.('[data-pf-flow-input]'));
    const launchState=await launch.evaluate(()=>({focused:document.activeElement?.matches?.('[data-pf-flow-input]'),search:location.search}));
    assert(launchState.focused&&launchState.search==='',`Capture shortcut did not focus and clean the URL: ${JSON.stringify(launchState)}`);
    await launch.close();

    mark('mobile-visual');
    const mobile=await context.newPage();
    await routeProviders(mobile);
    await mobile.setViewportSize({width:390,height:780});
    await mobile.goto(`http://127.0.0.1:${port}/__flow_host`,{waitUntil:'load'});
    await mobile.waitForSelector('#pf-flow-dock');
    await addCue(mobile,'Look far for twenty seconds');
    await mobile.evaluate(()=>window.__PACEFOLD_FLOW__.setPanel(true,false));
    const mobileState=await mobile.evaluate(()=>({
      roots:document.querySelectorAll('#pf-hub-root').length,
      docks:document.querySelectorAll('#pf-flow-dock').length,
      barHeight:document.querySelector('.pf-flow-bar')?.getBoundingClientRect().height,
      dockWidth:document.getElementById('pf-flow-dock')?.getBoundingClientRect().width,
      overflow:document.documentElement.scrollWidth>innerWidth+2,
      panelVisible:document.querySelector('[data-pf-flow-panel]')?.hidden===false
    }));
    assert(mobileState.roots===1&&mobileState.docks===1&&mobileState.barHeight<=60&&!mobileState.overflow&&mobileState.panelVisible,`Mobile integrated layout failed: ${JSON.stringify(mobileState)}`);
    await mobile.screenshot({path:path.join(artifactRoot,'pacefold-flow-mobile.png'),fullPage:true});

    if(errors.some(error=>/pacefold|pf-flow|pf-hub|Unhandled/i.test(error)))throw new Error(`15.8 browser errors: ${errors.join(' | ')}`);
    console.log(`Pacefold 15.8 integrated audit passed. Visual captures: ${artifactRoot}`);
  }finally{
    if(browser)await Promise.race([browser.close().catch(()=>{}),delay(2500)]);
    server.closeAllConnections?.();
    server.close(()=>{});
  }
}

main().then(()=>process.exit(0)).catch(error=>{console.error(`PACEFOLD_FLOW_AUDIT_FAILURE phase=${phase}`);console.error(error?.stack||error);process.exit(1);});
