'use strict';

const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(process.argv[2]||'_release');
const port=4178;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let phase='startup';
const mark=name=>{phase=name;console.log(`PACEFOLD_AUDIT_PHASE ${name}`);};
const server=http.createServer((request,response)=>{
  const requestPath=decodeURIComponent((request.url||'/').split('?')[0]);
  if(requestPath==='/__pacefold_audit_host'){
    response.setHeader('Content-Type','text/html');
    return response.end(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.open-meteo.com https://graph.microsoft.com; img-src 'self' data:; frame-src https://www.youtube-nocookie.com https://open.spotify.com https://music.amazon.ca https://music.amazon.com"><link rel="stylesheet" href="/app/pacefold-hub.css"></head><body><main style="min-height:100vh">Today</main><script src="/app/pacefold-hub-guardian.js"></script><script src="/app/pacefold-hub.js"></script></body></html>`);
  }
  const relative=requestPath==='/'?'index.html':requestPath.replace(/^\/+/, '');
  let file=path.join(root,relative);
  if(!file.startsWith(root))return response.writeHead(403).end('Forbidden');
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file))return response.writeHead(404).end('Not found');
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
  response.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  response.setHeader('Connection','close');
  response.end(fs.readFileSync(file));
});
server.keepAliveTimeout=100;
server.headersTimeout=1000;

async function main(){
  let browser;
  try{
    mark('static-contract');
    const landing=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const appShell=fs.readFileSync(path.join(root,'app','index.html'),'utf8');
    const hub=fs.readFileSync(path.join(root,'app','pacefold-hub.js'),'utf8');
    const worker=fs.readFileSync(path.join(root,'app','service-worker.js'),'utf8');
    if(/data-pacefold-hub=/.test(landing))throw new Error('Notebook surface leaked into landing page');
    if(!/data-pacefold-hub="15\.6\.0"/.test(appShell))throw new Error('15.6 asset marker missing');
    for(const host of ['www.youtube-nocookie.com','open.spotify.com','music.amazon.ca','graph.microsoft.com']){
      if(!appShell.includes(host))throw new Error(`CSP is missing ${host}`);
    }
    if(!hub.includes('setupVisible()')||!hub.includes('restoreConfiguredState'))throw new Error('Setup resilience gate missing');
    if(/amazon[^]{0,300}readonly/i.test(hub))throw new Error('Amazon input is still read-only');
    if(/Not a notebook/i.test(hub))throw new Error('Legacy Fold Stack language remains');
    for(const mapping of ['notify-water.svg','notify-eyes.svg','notify-move.svg','notify-prayer.svg','notify-meal.svg','notify-prepare.svg','notify-away.svg']){
      if(!worker.includes(mapping))throw new Error(`Notification worker does not map ${mapping}`);
    }

    mark('browser-start');
    await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:1280,height:800}});
    await context.addInitScript(()=>{
      window.__externalOpenCount=0;
      window.open=()=>{window.__externalOpenCount+=1;return null;};
      window.__badgeEvents=[];
      window.__oneNoteSyncs=[];
      window.PacefoldOneNote={syncPage:async payload=>{window.__oneNoteSyncs.push(payload);return true;}};
      Object.defineProperty(navigator,'setAppBadge',{configurable:true,value:async value=>window.__badgeEvents.push(['set',value??1])});
      Object.defineProperty(navigator,'clearAppBadge',{configurable:true,value:async()=>window.__badgeEvents.push(['clear'])});
      Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__sharedPage=data;}});
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>message.type()==='error'&&errors.push(message.text()));
    await page.route('https://api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      current:{temperature_2m:24,apparent_temperature:25,weather_code:2},
      daily:{time:['2099-01-01','2099-01-02','2099-01-03'],weather_code:[2,3,61],temperature_2m_max:[25,23,20],temperature_2m_min:[17,16,14],precipitation_probability_max:[10,20,60]}
    })}));
    await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>YouTube embed</title>'}));
    await page.route('https://open.spotify.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Spotify embed</title>'}));
    await page.route(/https:\/\/music\.amazon\..*/,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Amazon Music frame</title>'}));

    mark('real-core-setup-isolation');
    const setupPage=await context.newPage();
    await setupPage.goto(`http://127.0.0.1:${port}/app/`,{waitUntil:'commit',timeout:15000});
    await setupPage.waitForSelector('[data-onboard-profile],.onboarding-option,[data-view="setup"],.setup-wizard',{timeout:10000});
    await setupPage.waitForTimeout(350);
    if(await setupPage.locator('#pf-hub-root').count()) throw new Error('Pacefold workspace mounted over the verified core setup');
    await setupPage.close();

    mark('isolated-feature-host');
    await page.goto(`http://127.0.0.1:${port}/__pacefold_audit_host`,{waitUntil:'commit',timeout:15000});
    await page.waitForSelector('#pf-hub-root');
    await page.waitForFunction(()=>document.getElementById('pf-hub-root')?.dataset.version==='15.6.0');

    const architecture=await page.evaluate(()=>({
      roots:document.querySelectorAll('#pf-hub-root').length,
      notebook:Boolean(document.querySelector('[data-pf-action="open-notebook"]')),
      capture:Boolean(document.querySelector('[data-pf-capture-form]')?.getBoundingClientRect().height),
      player:Boolean(document.querySelector('.pf-player-row')?.getBoundingClientRect().height),
      unknown:[...document.querySelectorAll('#pf-hub-root [data-pf-action]')].map(node=>node.dataset.pfAction).filter(action=>!window.__PACEFOLD_SURFACE__.actions.includes(action))
    }));
    if(architecture.roots!==1||!architecture.notebook||!architecture.capture||!architecture.player||architecture.unknown.length){
      throw new Error(`Incorrect 15.6 architecture: ${JSON.stringify(architecture)}`);
    }

    mark('setup-isolation');
    await page.evaluate(()=>{
      const setup=document.createElement('section');
      setup.className='setup-wizard';
      setup.textContent='Set up Pacefold';
      setup.style.cssText='position:fixed;inset:0;display:block;width:500px;height:500px';
      document.body.append(setup);
      window.__PACEFOLD_SURFACE__.reconcile();
    });
    await page.waitForFunction(()=>!document.getElementById('pf-hub-root'));
    await page.evaluate(()=>document.querySelector('.setup-wizard').remove());
    await page.waitForSelector('#pf-hub-root',{timeout:3000});

    mark('notebook-capture');
    await page.locator('[data-pf-capture-section]').selectOption('Incidents');
    await page.locator('[data-pf-capture-input]').fill('Audit incident note');
    await page.locator('[data-pf-capture-form]').evaluate(form=>form.requestSubmit());
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').some(item=>item.body==='Audit incident note'&&item.section==='Incidents'));
    await page.locator('[data-pf-action="open-notebook"]').first().click();
    await page.waitForSelector('.pf-notebook');
    if(!await page.getByText('Audit incident note').isVisible())throw new Error('Notebook entry was not rendered');

    mark('notebook-edit');
    await page.locator('[data-pf-action="edit-entry"]').click();
    await page.locator('[data-pf-edit-body]').fill('Audit incident note edited');
    await page.locator('[data-pf-action="save-edit"]').click();
    if(!await page.getByText('Audit incident note edited').isVisible())throw new Error('Notebook edit did not save');

    mark('onenote-sync');
    await page.locator('[data-pf-action="sync-page"]').click();
    await page.waitForFunction(()=>window.__oneNoteSyncs.length===1);
    const synced=await page.evaluate(()=>window.__oneNoteSyncs[0]);
    if(synced.notebook!=='HSSys'||!synced.html.includes('Audit incident note edited'))throw new Error('OneNote bridge payload was incorrect');

    mark('amazon-player');
    await page.locator('[data-pf-action="open-player"]').click();
    await page.getByRole('tab',{name:'Amazon Music'}).click();
    const amazon='https://music.amazon.ca/playlists/B0123456789?ref_=share&utm_source=test';
    await page.locator('[data-pf-stream-url]').fill(amazon);
    await page.locator('[data-pf-action="load-stream"]').click();
    await page.waitForSelector('iframe.pf-embed--amazon');
    const amazonSrc=await page.locator('iframe.pf-embed--amazon').getAttribute('src');
    if(amazonSrc!=='https://music.amazon.ca/playlists/B0123456789')throw new Error(`Amazon URL was not preserved safely: ${amazonSrc}`);

    mark('provider-rejection');
    await page.getByRole('tab',{name:'YouTube Music'}).click();
    await page.locator('[data-pf-stream-url]').fill('https://evil.example/playlist/123');
    await page.locator('[data-pf-action="load-stream"]').click();
    const invalid=await page.locator('[data-pf-stream-url]').getAttribute('aria-invalid');
    if(invalid!=='true')throw new Error('Hostile provider URL was accepted');
    if(await page.evaluate(()=>window.__externalOpenCount)!==0)throw new Error('Music opened an external window');

    mark('cue-completion');
    await page.evaluate(()=>{
      const cue=document.createElement('div');
      cue.id='pf-audit-cue';cue.setAttribute('role','alert');cue.innerHTML='<span>Drink water</span><button>Done</button>';
      window.__cueClicks=0;cue.querySelector('button').onclick=()=>{window.__cueClicks++;cue.remove();};document.body.append(cue);
    });
    await page.waitForSelector('.pf-andon.is-waiting');
    await page.locator('[data-pf-action="handle-cue"]').click();
    await page.waitForFunction(()=>window.__cueClicks===1&&!document.getElementById('pf-audit-cue'));

    mark('guardian-restore');
    await page.evaluate(()=>document.getElementById('pf-hub-root').remove());
    await page.waitForSelector('#pf-hub-root',{timeout:3000});

    mark('mobile-layout');
    const mobile=await context.newPage();
    await mobile.setViewportSize({width:390,height:780});
    await mobile.goto(`http://127.0.0.1:${port}/__pacefold_audit_host`,{waitUntil:'commit',timeout:15000});
    await mobile.waitForSelector('#pf-hub-root');
    await mobile.locator('[data-pf-action="open-notebook"]').first().click();
    const mobileState=await mobile.evaluate(()=>({
      capture:Boolean(document.querySelector('[data-pf-capture-form]')?.getBoundingClientRect().height),
      player:Boolean(document.querySelector('.pf-player-row')?.getBoundingClientRect().height),
      notebook:Boolean(document.querySelector('.pf-notebook')?.getBoundingClientRect().height),
      overflow:document.documentElement.scrollWidth>innerWidth+2
    }));
    if(!mobileState.capture||!mobileState.player||!mobileState.notebook||mobileState.overflow)throw new Error(`Mobile notebook failure: ${JSON.stringify(mobileState)}`);

    if(errors.some(error=>/pacefold-hub|pf-workfold|Unhandled Pacefold action/i.test(error)))throw new Error(`15.6 runtime errors: ${errors.join(' | ')}`);
    console.log('Pacefold Notebook 15.6 audit passed: setup gate, buttons, notebook, OneNote bridge, Amazon URL, cues, guardian and mobile.');
  }finally{
    if(browser)await Promise.race([browser.close().catch(()=>{}),delay(2500)]);
    server.closeAllConnections?.();
    server.close(()=>{});
  }
}
main().then(()=>process.exit(0)).catch(error=>{console.error(`PACEFOLD_AUDIT_FAILURE phase=${phase}`);console.error(error?.stack||error);try{fs.writeFileSync('/tmp/pacefold-notebook-audit-failure.txt',`phase=${phase}\n${error?.stack||error}\n`);}catch{}process.exit(1);});
