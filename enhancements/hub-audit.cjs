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
const htmlHost=scripts=>`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.open-meteo.com https://graph.microsoft.com; img-src 'self' data:; frame-src https://www.youtube-nocookie.com https://open.spotify.com https://music.amazon.ca https://music.amazon.com"><link rel="stylesheet" href="/app/pacefold-hub.css"></head><body><main style="min-height:100vh">Today</main>${scripts}</body></html>`;
const server=http.createServer((request,response)=>{
  const requestPath=decodeURIComponent((request.url||'/').split('?')[0]);
  if(requestPath==='/__pacefold_blank'){
    response.setHeader('Content-Type','text/html');
    return response.end('<!doctype html><html><head><meta charset="utf-8"></head><body>Blank Pacefold audit origin</body></html>');
  }
  if(requestPath==='/__pacefold_audit_host'){
    response.setHeader('Content-Type','text/html');
    return response.end(htmlHost('<script defer src="/app/pacefold-hub-guardian.js"></script><script defer src="/app/pacefold-resilience.js"></script><script defer src="/app/pacefold-hub.js"></script>'));
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
    const guardian=fs.readFileSync(path.join(root,'app','pacefold-hub-guardian.js'),'utf8');
    const resilience=fs.readFileSync(path.join(root,'app','pacefold-resilience.js'),'utf8');
    const worker=fs.readFileSync(path.join(root,'app','service-worker.js'),'utf8');
    if(/data-pacefold-hub=/.test(landing))throw new Error('Notebook surface leaked into landing page');
    if(!/data-pacefold-hub="15\.7\.0"/.test(appShell))throw new Error('15.7 asset marker missing');
    for(const host of ['www.youtube-nocookie.com','open.spotify.com','music.amazon.ca','graph.microsoft.com']){
      if(!appShell.includes(host))throw new Error(`CSP is missing ${host}`);
    }
    const guardianIndex=appShell.indexOf('data-pacefold-hub-guardian="15.7.0"');
    const resilienceIndex=appShell.indexOf('data-pacefold-resilience="15.7.0"');
    const hubIndex=appShell.indexOf('data-pacefold-hub="15.7.0"',resilienceIndex+1);
    if(!(guardianIndex>=0&&guardianIndex<resilienceIndex&&resilienceIndex<hubIndex))throw new Error('Startup scripts are not ordered guardian → resilience → Notebook');
    const surfaceScripts=[...appShell.matchAll(/<script[^>]+data-pacefold-(?:hub(?:-guardian)?|resilience)[^>]*>/g)].map(match=>match[0]);
    if(surfaceScripts.length!==3||surfaceScripts.some(tag=>!/\bdefer\b/.test(tag)||/\basync\b/.test(tag)))throw new Error('Pacefold startup scripts must be exactly three ordered defer scripts');
    if(!hub.includes('setupVisible()')||!hub.includes('restoreConfiguredState')||!hub.includes('15.7.0'))throw new Error('15.7 setup resilience/version gate missing');
    if(!guardian.includes('[data-onboard-profile]')||!guardian.includes('wasSetup'))throw new Error('Guardian is not aligned with real onboarding lifecycle');
    if(!resilience.includes('validateNotebookStorage')||!resilience.includes('GLOBAL_SYNC_LOCK')||!resilience.includes('lockSubmit'))throw new Error('Runtime resilience layer is incomplete');
    if(/amazon[^]{0,300}readonly/i.test(hub))throw new Error('Amazon input is still read-only');
    if(/Not a notebook/i.test(hub))throw new Error('Legacy Fold Stack language remains');
    const marker='pacefold-resilience-15.7.0';
    const markerMatches=worker.match(new RegExp(`BEGIN ${marker}`,'g'))||[];
    if(markerMatches.length!==1)throw new Error(`Service worker contains ${markerMatches.length} resilience patches`);
    const block=worker.match(new RegExp(`// BEGIN ${marker}([\\s\\S]*?)// END ${marker}`));
    if(!block)throw new Error('Service-worker resilience block is incomplete');
    if(/caches\.keys|caches\.delete/.test(block[1]))throw new Error('Notebook patch must not delete core Pacefold caches');
    if((block[1].match(/__pacefoldNotificationWrapped/g)||[]).length!==1)throw new Error('Notification wrapper guard is duplicated');
    if(/pacefold-notebook-15\.6\.0/.test(worker))throw new Error('Legacy 15.6 service-worker patch survived reinjection');
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
      window.__submitBubbles=0;
      document.addEventListener('submit',()=>{window.__submitBubbles+=1;});
      window.PacefoldOneNote={syncPage:async payload=>{window.__oneNoteSyncs.push(payload);return true;}};
      Object.defineProperty(navigator,'setAppBadge',{configurable:true,value:async value=>window.__badgeEvents.push(['set',value??1])});
      Object.defineProperty(navigator,'clearAppBadge',{configurable:true,value:async()=>window.__badgeEvents.push(['clear'])});
      Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__sharedPage=data;}});
    });
    const errors=[];
    const attachErrors=page=>{
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>message.type()==='error'&&errors.push(message.text()));
    };
    const routeProviders=async page=>{
      await page.route('https://api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        current:{temperature_2m:24,apparent_temperature:25,weather_code:2},
        daily:{time:['2099-01-01','2099-01-02','2099-01-03'],weather_code:[2,3,61],temperature_2m_max:[25,23,20],temperature_2m_min:[17,16,14],precipitation_probability_max:[10,20,60]}
      })}));
      await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>YouTube embed</title>'}));
      await page.route('https://open.spotify.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Spotify embed</title>'}));
      await page.route(/https:\/\/music\.amazon\..*/,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Amazon Music frame</title>'}));
    };

    mark('real-core-setup-isolation');
    const setupPage=await context.newPage();
    attachErrors(setupPage);
    await setupPage.goto(`http://127.0.0.1:${port}/app/`,{waitUntil:'commit',timeout:15000});
    await setupPage.waitForSelector('[data-onboard-profile],.onboarding-option,[data-view="setup"],.setup-wizard',{timeout:10000});
    await setupPage.waitForTimeout(350);
    if(await setupPage.locator('#pf-hub-root').count())throw new Error('Pacefold workspace mounted over the verified core setup');
    await setupPage.close();

    mark('corrupt-storage-recovery');
    const recoveryPage=await context.newPage();
    attachErrors(recoveryPage);
    await routeProviders(recoveryPage);
    await recoveryPage.goto(`http://127.0.0.1:${port}/__pacefold_blank`);
    await recoveryPage.evaluate(()=>{
      localStorage.setItem('pacefold.notebook.entries.v2','{"broken":');
      for(let index=0;index<4;index+=1)localStorage.setItem(`pacefold.recovery.notebook.2000-01-0${index+1}`,`old-${index}`);
    });
    await recoveryPage.goto(`http://127.0.0.1:${port}/__pacefold_audit_host`,{waitUntil:'commit',timeout:15000});
    await recoveryPage.waitForSelector('#pf-hub-root');
    const recovery=await recoveryPage.evaluate(()=>{
      const keys=[];
      for(let index=0;index<localStorage.length;index+=1){const key=localStorage.key(index);if(key?.startsWith('pacefold.recovery.notebook.'))keys.push(key);}
      const notice=JSON.parse(localStorage.getItem('pacefold.resilience.recoveryNotice.v1')||'null');
      let entriesValid=true;
      try{const value=JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]');entriesValid=Array.isArray(value);}catch{entriesValid=false;}
      return {keys,notice,entriesValid,preserved:keys.some(key=>localStorage.getItem(key)==='{"broken":'),version:window.__PACEFOLD_RESILIENCE__?.version};
    });
    if(!recovery.entriesValid||!recovery.preserved||recovery.keys.length>3||recovery.version!=='15.7.0')throw new Error(`Corrupt notebook recovery failed: ${JSON.stringify(recovery)}`);
    await recoveryPage.close();

    mark('legacy-storage-normalization');
    const page=await context.newPage();
    attachErrors(page);
    await routeProviders(page);
    await page.goto(`http://127.0.0.1:${port}/__pacefold_blank`);
    await page.evaluate(()=>{
      localStorage.setItem('pacefold.notebook.entries.v2',JSON.stringify([{id:'legacy-note',body:'Legacy note without section'}]));
      localStorage.removeItem('pacefold.resilience.lock.sync-page.v1');
    });
    await page.goto(`http://127.0.0.1:${port}/__pacefold_audit_host`,{waitUntil:'commit',timeout:15000});
    await page.waitForSelector('#pf-hub-root');
    await page.waitForFunction(()=>document.getElementById('pf-hub-root')?.dataset.version==='15.7.0');
    const normalized=await page.evaluate(()=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').find(item=>item.id==='legacy-note'));
    if(normalized?.section!=='Daily')throw new Error(`Legacy notebook normalization failed: ${JSON.stringify(normalized)}`);

    const architecture=await page.evaluate(()=>({
      roots:document.querySelectorAll('#pf-hub-root').length,
      notebook:Boolean(document.querySelector('[data-pf-action="open-notebook"]')),
      capture:Boolean(document.querySelector('[data-pf-capture-form]')?.getBoundingClientRect().height),
      player:Boolean(document.querySelector('.pf-player-row')?.getBoundingClientRect().height),
      unknown:[...document.querySelectorAll('#pf-hub-root [data-pf-action]')].map(node=>node.dataset.pfAction).filter(action=>!window.__PACEFOLD_SURFACE__.actions.includes(action))
    }));
    if(architecture.roots!==1||!architecture.notebook||!architecture.capture||!architecture.player||architecture.unknown.length){
      throw new Error(`Incorrect 15.7 architecture: ${JSON.stringify(architecture)}`);
    }

    mark('setup-stale-root-rejection');
    await page.evaluate(()=>{
      document.getElementById('pf-hub-root').dataset.auditNonce='stale-root';
      const setup=document.createElement('button');
      setup.id='pf-audit-real-setup';
      setup.dataset.onboardProfile='meditation';
      setup.textContent='Meditation';
      setup.style.cssText='position:fixed;inset:20px;width:300px;height:80px;display:block';
      document.body.append(setup);
    });
    await page.waitForFunction(()=>!document.getElementById('pf-hub-root'));
    await page.evaluate(()=>document.getElementById('pf-audit-real-setup').remove());
    await page.waitForSelector('#pf-hub-root',{timeout:3000});
    if(await page.locator('#pf-hub-root[data-audit-nonce="stale-root"]').count())throw new Error('Guardian reattached stale pre-setup workspace state');

    mark('duplicate-capture-guard');
    await page.locator('[data-pf-capture-section]').selectOption('Incidents');
    await page.locator('[data-pf-capture-input]').fill('Audit incident note');
    await page.evaluate(()=>{
      window.__submitBubbles=0;
      const form=document.querySelector('[data-pf-capture-form]');
      form.requestSubmit();
      form.requestSubmit();
    });
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').some(item=>item.body==='Audit incident note'&&item.section==='Incidents'));
    const captureResult=await page.evaluate(()=>({
      bubbles:window.__submitBubbles,
      matches:JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').filter(item=>item.body==='Audit incident note').length
    }));
    if(captureResult.bubbles!==1||captureResult.matches!==1)throw new Error(`Duplicate capture was not suppressed: ${JSON.stringify(captureResult)}`);

    mark('notebook-edit');
    await page.locator('[data-pf-action="open-notebook"]').first().click();
    await page.waitForSelector('.pf-notebook');
    if(!await page.getByText('Audit incident note').isVisible())throw new Error('Notebook entry was not rendered');
    await page.locator('[data-pf-action="edit-entry"]').filter({has:page.locator('text=Edit')}).last().click().catch(async()=>page.locator('[data-pf-action="edit-entry"]').last().click());
    await page.locator('[data-pf-edit-body]').fill('Audit incident note edited');
    await page.locator('[data-pf-action="save-edit"]').click();
    if(!await page.getByText('Audit incident note edited').isVisible())throw new Error('Notebook edit did not save');

    mark('cross-window-sync-lock');
    await page.evaluate(()=>localStorage.setItem('pacefold.resilience.lock.sync-page.v1',JSON.stringify({owner:'other-window',until:Date.now()+5000})));
    await page.locator('[data-pf-action="sync-page"]').click();
    await page.waitForTimeout(150);
    if(await page.evaluate(()=>window.__oneNoteSyncs.length)!==0)throw new Error('OneNote sync ignored a foreign Pacefold window lock');
    await page.evaluate(()=>{
      localStorage.removeItem('pacefold.resilience.lock.sync-page.v1');
      const button=document.querySelector('[data-pf-action="sync-page"]');
      button.click();
      button.click();
    });
    await page.waitForFunction(()=>window.__oneNoteSyncs.length===1);
    const synced=await page.evaluate(()=>window.__oneNoteSyncs[0]);
    if(synced.notebook!=='HSSys'||!synced.html.includes('Audit incident note edited'))throw new Error('OneNote bridge payload was incorrect');

    mark('bounded-error-journal');
    const journal=await page.evaluate(()=>{
      for(let index=0;index<25;index+=1)window.__PACEFOLD_RESILIENCE__.recordError('audit',new Error(`pacefold failure ${index} https://secret.example/${index}`));
      return JSON.parse(localStorage.getItem('pacefold.resilience.errors.v1')||'[]');
    });
    if(journal.length!==20||journal.some(item=>item.message.includes('secret.example')||item.message.length>320))throw new Error('Resilience error journal is unbounded or leaks URLs');

    mark('amazon-player');
    await page.locator('.pf-player-button[data-pf-action="open-player"]').click();
    await page.getByRole('tab',{name:'Amazon Music'}).click();
    const amazon='https://music.amazon.ca/playlists/B0123456789?ref_=share&utm_source=test';
    await page.locator('[data-pf-stream-url]').fill(amazon);
    await page.evaluate(()=>{
      const button=document.querySelector('[data-pf-action="load-stream"]');
      button.click();
      button.click();
    });
    await page.waitForSelector('iframe.pf-embed--amazon');
    const amazonFrames=await page.locator('iframe.pf-embed--amazon').count();
    const amazonSrc=await page.locator('iframe.pf-embed--amazon').getAttribute('src');
    if(amazonFrames!==1||amazonSrc!=='https://music.amazon.ca/playlists/B0123456789')throw new Error(`Amazon URL/load guard failed: ${amazonFrames} ${amazonSrc}`);

    mark('provider-rejection');
    await page.getByRole('tab',{name:'YouTube Music'}).click();
    await page.locator('[data-pf-stream-url]').fill('https://evil.example/playlist/123');
    await page.locator('[data-pf-action="load-stream"]').click();
    const invalid=await page.locator('[data-pf-stream-url]').getAttribute('aria-invalid');
    if(invalid!=='true')throw new Error('Hostile provider URL was accepted');
    if(await page.evaluate(()=>window.__externalOpenCount)!==0)throw new Error('Music opened an external window');

    mark('cue-completion-once');
    await page.evaluate(()=>{
      const cue=document.createElement('div');
      cue.id='pf-audit-cue';cue.setAttribute('role','alert');cue.innerHTML='<span>Drink water</span><button>Done</button>';
      window.__cueClicks=0;cue.querySelector('button').onclick=()=>{window.__cueClicks+=1;cue.remove();};document.body.append(cue);
    });
    await page.waitForSelector('.pf-andon.is-waiting');
    await page.evaluate(()=>{
      const button=document.querySelector('[data-pf-action="handle-cue"]');
      button.click();
      button.click();
    });
    await page.waitForFunction(()=>window.__cueClicks===1&&!document.getElementById('pf-audit-cue'));

    mark('guardian-normal-restore');
    await page.evaluate(()=>{
      document.getElementById('pf-hub-root').dataset.auditNonce='ordinary-restore';
      document.getElementById('pf-hub-root').remove();
    });
    await page.waitForSelector('#pf-hub-root[data-audit-nonce="ordinary-restore"]',{timeout:3000});
    if(await page.locator('#pf-hub-root').count()!==1)throw new Error('Guardian created duplicate roots during ordinary restoration');

    mark('mobile-layout');
    const mobile=await context.newPage();
    attachErrors(mobile);
    await routeProviders(mobile);
    await mobile.setViewportSize({width:390,height:780});
    await mobile.goto(`http://127.0.0.1:${port}/__pacefold_audit_host`,{waitUntil:'commit',timeout:15000});
    await mobile.waitForSelector('#pf-hub-root');
    await mobile.locator('[data-pf-action="open-notebook"]').first().click();
    const mobileState=await mobile.evaluate(()=>({
      capture:Boolean(document.querySelector('[data-pf-capture-form]')?.getBoundingClientRect().height),
      player:Boolean(document.querySelector('.pf-player-row')?.getBoundingClientRect().height),
      notebook:Boolean(document.querySelector('.pf-notebook')?.getBoundingClientRect().height),
      overflow:document.documentElement.scrollWidth>innerWidth+2,
      roots:document.querySelectorAll('#pf-hub-root').length
    }));
    if(!mobileState.capture||!mobileState.player||!mobileState.notebook||mobileState.overflow||mobileState.roots!==1)throw new Error(`Mobile resilience failure: ${JSON.stringify(mobileState)}`);

    if(errors.some(error=>/pacefold-hub|pf-workfold|pf-resilience|Unhandled Pacefold action/i.test(error)))throw new Error(`15.7 runtime errors: ${errors.join(' | ')}`);
    console.log('Pacefold Resilience 15.7 audit passed: idempotent update, setup lifecycle, storage recovery, duplicate guards, cross-window sync, notebook, media, cues, guardian and mobile.');
  }finally{
    if(browser)await Promise.race([browser.close().catch(()=>{}),delay(2500)]);
    server.closeAllConnections?.();
    server.close(()=>{});
  }
}
main().then(()=>process.exit(0)).catch(error=>{console.error(`PACEFOLD_AUDIT_FAILURE phase=${phase}`);console.error(error?.stack||error);process.exit(1);});
