'use strict';

const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(process.argv[2]||'_release');
const port=4181;
const host=scripts=>`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.open-meteo.com https://graph.microsoft.com; img-src 'self' data:; frame-src https://www.youtube-nocookie.com https://open.spotify.com https://music.amazon.ca https://music.amazon.com"><link rel="stylesheet" href="/app/pacefold-hub.css"></head><body><main style="min-height:100vh">Today</main>${scripts}</body></html>`;
const server=http.createServer((request,response)=>{
  const requestPath=decodeURIComponent((request.url||'/').split('?')[0]);
  if(requestPath==='/__blank')return response.end('<!doctype html><html><body>blank</body></html>');
  if(requestPath==='/__resilience_only')return response.end(host('<script defer src="/app/pacefold-resilience.js"></script>'));
  if(requestPath==='/__host')return response.end(host('<script defer src="/app/pacefold-hub-guardian.js"></script><script defer src="/app/pacefold-resilience.js"></script><script defer src="/app/pacefold-hub.js"></script>'));
  const relative=requestPath.replace(/^\/+/, '')||'index.html';
  let file=path.join(root,relative);
  if(!file.startsWith(root))return response.writeHead(403).end('Forbidden');
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file))return response.writeHead(404).end('Not found');
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
  response.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  response.end(fs.readFileSync(file));
});

async function main(){
  let browser;
  try{
    const resilience=fs.readFileSync(path.join(root,'app','pacefold-resilience.js'),'utf8');
    const guardian=fs.readFileSync(path.join(root,'app','pacefold-hub-guardian.js'),'utf8');
    if(!resilience.includes("const VERSION='15.7.1'"))throw new Error('Resilience runtime was not versioned to 15.7.1');
    if(!resilience.includes('preservedOriginal')||!resilience.includes('installOneNoteGuard')||!resilience.includes('previous.count'))throw new Error('15.7.1 recovery, OneNote or journal hardening is missing');
    if(!guardian.includes("const VERSION='15.7.1'")||!guardian.includes('restoreAfterStableSetupExit')||!guardian.includes('setupTextPanelVisible'))throw new Error('15.7.1 guardian stabilization is missing');

    await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
    browser=await chromium.launch({headless:true});

    const recoveryContext=await browser.newContext();
    const recoveryPage=await recoveryContext.newPage();
    await recoveryPage.goto(`http://127.0.0.1:${port}/__blank`);
    await recoveryPage.evaluate(()=>localStorage.setItem('pacefold.notebook.entries.v2','{"broken":'));
    await recoveryPage.addInitScript(()=>{
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(String(key).startsWith('pacefold.recovery.notebook.')||key==='pacefold.resilience.errors.v1'||key==='pacefold.resilience.recoveryNotice.v1')throw new DOMException('Quota exceeded','QuotaExceededError');
        return original.call(this,key,value);
      };
    });
    await recoveryPage.goto(`http://127.0.0.1:${port}/__resilience_only`,{waitUntil:'load'});
    const preserved=await recoveryPage.evaluate(()=>({raw:localStorage.getItem('pacefold.notebook.entries.v2'),version:window.__PACEFOLD_RESILIENCE__?.version}));
    if(preserved.raw!=='{"broken":'||preserved.version!=='15.7.1')throw new Error(`Unrecoverable notebook data was deleted: ${JSON.stringify(preserved)}`);
    await recoveryContext.close();

    const context=await browser.newContext({viewport:{width:1280,height:800}});
    await context.addInitScript(()=>{
      window.__syncCalls=0;
      window.__resolveSync=null;
      window.PacefoldOneNote={syncPage:async()=>{window.__syncCalls+=1;return new Promise(resolve=>{window.__resolveSync=resolve;});}};
      Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{}});
    });
    const page=await context.newPage();
    await page.route('https://api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({current:{temperature_2m:20,apparent_temperature:20,weather_code:1},daily:{time:['2099-01-01'],weather_code:[1],temperature_2m_max:[20],temperature_2m_min:[10],precipitation_probability_max:[0]}})}));
    await page.goto(`http://127.0.0.1:${port}/__blank`);
    await page.evaluate(()=>localStorage.setItem('pacefold.notebook.entries.v2',JSON.stringify([{id:'audit-note',body:'Hardening audit note',section:'Daily',date:new Date().toISOString().slice(0,10)}])));
    await page.goto(`http://127.0.0.1:${port}/__host`,{waitUntil:'load'});
    await page.waitForSelector('#pf-hub-root');

    await page.evaluate(()=>{
      const ordinary=document.createElement('section');
      ordinary.id='ordinary-get-started-note';
      ordinary.style.cssText='width:500px;height:220px';
      ordinary.innerHTML='<p>Get started on the report tomorrow.</p><button>Save note</button>';
      document.body.prepend(ordinary);
    });
    await page.waitForTimeout(120);
    if(!await page.locator('#pf-hub-root').count())throw new Error('Guardian misclassified ordinary “get started” content as setup');

    await page.evaluate(()=>{
      const setup=document.createElement('button');
      setup.id='flapping-setup';
      setup.dataset.onboardProfile='meditation';
      setup.textContent='Meditation';
      setup.style.cssText='position:fixed;inset:20px;width:300px;height:80px';
      document.body.append(setup);
    });
    await page.waitForFunction(()=>!document.getElementById('pf-hub-root'));
    await page.evaluate(()=>document.getElementById('flapping-setup').remove());
    await page.waitForTimeout(100);
    await page.evaluate(()=>{
      const setup=document.createElement('button');
      setup.id='flapping-setup';setup.dataset.onboardProfile='meditation';setup.textContent='Meditation';setup.style.cssText='position:fixed;inset:20px;width:300px;height:80px';document.body.append(setup);
    });
    await page.waitForTimeout(180);
    if(await page.locator('#pf-hub-root').count())throw new Error('Guardian remounted during a flapping setup transition');
    await page.evaluate(()=>document.getElementById('flapping-setup').remove());
    await page.waitForSelector('#pf-hub-root',{timeout:3000});

    await page.evaluate(()=>{
      const clone=document.getElementById('pf-hub-root').cloneNode(true);
      document.body.append(clone);
    });
    await page.waitForFunction(()=>document.querySelectorAll('#pf-hub-root').length===1);

    await page.locator('[data-pf-action="open-notebook"]').first().click();
    await page.waitForSelector('[data-pf-action="sync-page"]');
    await page.evaluate(()=>{
      const button=document.querySelector('[data-pf-action="sync-page"]');
      button.click();button.click();
    });
    await page.waitForFunction(()=>window.__syncCalls===1);
    const locked=await page.evaluate(()=>({lock:JSON.parse(localStorage.getItem('pacefold.resilience.lock.sync-page.v1')||'null'),busy:document.querySelector('[data-pf-action="sync-page"]')?.getAttribute('aria-busy')}));
    if(!locked.lock||locked.busy!=='true')throw new Error(`OneNote sync did not claim a visible lock: ${JSON.stringify(locked)}`);
    await page.evaluate(()=>window.__resolveSync?.(true));
    await page.waitForFunction(()=>!localStorage.getItem('pacefold.resilience.lock.sync-page.v1')&&!document.querySelector('[data-pf-action="sync-page"]')?.hasAttribute('aria-busy'));

    const journal=await page.evaluate(()=>{
      localStorage.removeItem('pacefold.resilience.errors.v1');
      sessionStorage.removeItem('pacefold.resilience.errors.v1');
      for(let index=0;index<30;index+=1)window.__PACEFOLD_RESILIENCE__.recordError('audit',new Error('pacefold token=abc123 user@example.com https://secret.example/path'));
      return JSON.parse(localStorage.getItem('pacefold.resilience.errors.v1')||sessionStorage.getItem('pacefold.resilience.errors.v1')||'[]');
    });
    if(journal.length!==1||journal[0].count!==30||/abc123|example\.com|secret\.example/.test(journal[0].message))throw new Error(`Error journal did not deduplicate/redact: ${JSON.stringify(journal)}`);

    console.log('Pacefold 15.7.1 hardening audit passed: lossless recovery, setup stability, false-positive rejection, duplicate-root repair, settled OneNote locking and deduplicated diagnostics.');
  }finally{
    if(browser)await browser.close().catch(()=>{});
    server.closeAllConnections?.();
    server.close(()=>{});
  }
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error?.stack||error);process.exit(1);});
