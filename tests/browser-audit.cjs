'use strict';
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const{chromium}=require('playwright');
const site=path.resolve(process.argv[2]||'_site');
const artifacts=path.resolve(process.argv[3]||'artifacts/v26');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((request,response)=>{
      let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname)}catch{pathname='/'}
      let file=path.join(site,pathname.replace(/^\/+/,''));
      if(pathname.endsWith('/'))file=path.join(file,'index.html');
      if(!file.startsWith(site)){response.writeHead(403);response.end();return}
      fs.readFile(file,(error,buffer)=>{
        if(error){response.writeHead(404);response.end('Not found');return}
        const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
        response.writeHead(200,{'content-type':type,'cache-control':'no-store'});response.end(buffer);
      });
    });
    server.listen(0,'127.0.0.1',()=>resolve({server,origin:`http://127.0.0.1:${server.address().port}`}));
  });
}

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const{server,origin}=await serve();
  let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}: {})});
    const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Toronto'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(`page: ${error.message}`));
    page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`)});
    await page.addInitScript(()=>{
      localStorage.setItem('pacefoldOnboardedV15','1');
      if(!localStorage.getItem('pacefoldPrefsV15'))localStorage.setItem('pacefoldPrefsV15',JSON.stringify({
        profile:'original',lat:43.6205,lng:-79.5132,locationLabel:'Etobicoke, Toronto',timeZone:'America/Toronto',method:'15',asr:'hanafi',
        showSeconds:true,waterTarget:24,waterSips:6,waterDate:new Date().toLocaleDateString('en-CA',{timeZone:'America/Toronto'}),
        workHours:'08:30-16:30',workDays:[1,2,3,4,5],notifications:false,quietMode:false,weatherEnabled:false
      }));
      if(!localStorage.getItem('pacefold.notebook.entries.v2'))localStorage.setItem('pacefold.notebook.entries.v2',JSON.stringify([{
        id:'existing',date:new Date().toLocaleDateString('en-CA',{timeZone:'America/Toronto'}),body:'Existing Pacefold note',category:'Note',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
      }]));
    });
    await page.goto(`${origin}/app/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__PACEFOLD__?.version==='26.0.0');
    await page.waitForSelector('html.ready');

    const home=await page.evaluate(()=>({
      mode:document.documentElement.dataset.mode,
      views:[...document.querySelectorAll('[data-view]')].filter(node=>getComputedStyle(node).display!=='none').map(node=>node.dataset.view),
      ticks:document.querySelectorAll('#clock-ticks i').length,
      actions:document.querySelectorAll('.quick-action').length,
      rhythm:document.querySelectorAll('#rhythm-list .rhythm-row').length,
      styles:[...document.styleSheets].map(sheet=>sheet.href).filter(Boolean),
      scripts:[...document.scripts].map(script=>script.src).filter(Boolean),
      overflow:document.documentElement.scrollWidth-innerWidth,
      release:window.__PACEFOLD__.version,
      notes:window.__PACEFOLD__.notes.length,
      polish:['note-insights','day-story-title','now-cue-list','settings-summary'].every(id=>document.getElementById(id))
    }));
    assert(home.mode==='home'&&home.views.join(',')==='home','Clock is not the only initial view');
    assert(home.ticks===60,'Analog clock is incomplete');
    assert(home.actions===6,'Quick actions are incomplete');
    assert(home.rhythm===6,'Prayer rhythm is incomplete');
    assert(home.styles.filter(url=>url.includes('/app/')).length===1,'More than one app stylesheet loaded');
    assert(home.scripts.filter(url=>!url.includes('msal-')).length===1,'More than one Pacefold runtime loaded');
    assert(home.overflow<=1,`Desktop overflow is ${home.overflow}px`);
    assert(home.release==='26.0.0'&&home.notes===1,'Migration did not preserve the V26 release or note');
    assert(home.polish,'Page-specific surfaces are incomplete');

    await page.click('[data-action="water"]');
    assert(await page.locator('#water-state').textContent()==='8 / 24 oz','Water action did not migrate and increment established data');

    await page.click('.edge-up');
    await page.waitForFunction(()=>document.documentElement.dataset.mode==='notes');
    await page.fill('#note-input','Pacefold 26 browser audit note');
    await page.click('#note-form button[type="submit"]');
    await page.waitForTimeout(120);
    assert(await page.evaluate(()=>window.__PACEFOLD__.notes.some(note=>note.body==='Pacefold 26 browser audit note')),'Note was not saved');
    await page.click('[data-note-edit]');
    assert(await page.locator('#note-form').getAttribute('data-editing')==='true','Inline note edit did not open');
    await page.fill('#note-input','Pacefold 26 inline edit verified');
    await page.click('#note-submit');
    assert(await page.evaluate(()=>window.__PACEFOLD__.notes.some(note=>note.body==='Pacefold 26 inline edit verified')),'Inline note edit did not save');

    await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.documentElement.dataset.mode==='home');
    await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.documentElement.dataset.mode==='now');
    await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.documentElement.dataset.mode==='home');
    await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.documentElement.dataset.mode==='settings');
    await page.click('[data-setting="showSeconds"]');
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__PACEFOLD__?.version==='26.0.0');
    assert(await page.evaluate(()=>window.__PACEFOLD__.prefs.showSeconds===false&&document.documentElement.classList.contains('seconds-off')),'Seconds preference did not persist');

    await page.evaluate(()=>window.__PACEFOLD__.go('home'));
    await page.screenshot({path:path.join(artifacts,'pacefold-26-home.png'),fullPage:true});
    for(const view of ['notes','worklog','now','settings']){
      await page.evaluate(next=>window.__PACEFOLD__.go(next),view);await page.waitForTimeout(80);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      assert(overflow<=1,`${view} overflows by ${overflow}px`);
      await page.screenshot({path:path.join(artifacts,`pacefold-26-${view}.png`),fullPage:true});
    }
    assert(!errors.length,errors.join('\n'));
    await context.close();

    const firstRun=await browser.newContext({viewport:{width:900,height:760},timezoneId:'America/Toronto'});
    const fresh=await firstRun.newPage();
    await fresh.goto(`${origin}/app/`,{waitUntil:'domcontentloaded'});
    await fresh.waitForSelector('#setup-dialog[open]',{timeout:3000});
    assert(await fresh.locator('#setup-dialog[open]').count()===1,'First-run setup did not appear exactly once');
    await fresh.click('#setup-later');
    await fresh.reload({waitUntil:'domcontentloaded'});await fresh.waitForTimeout(550);
    assert(await fresh.locator('#setup-dialog[open]').count()===0,'First-run setup repeated after completion');
    await firstRun.close();

    const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,timezoneId:'America/Toronto'});
    const m=await mobile.newPage();
    await m.addInitScript(()=>{
      localStorage.setItem('pacefoldOnboardedV15','1');
      localStorage.setItem('pacefoldPrefsV15',JSON.stringify({profile:'everyday',timeZone:'America/Toronto',workHours:'08:30-16:30',workDays:[1,2,3,4,5],notifications:false,weatherEnabled:false}));
    });
    await m.goto(`${origin}/app/`,{waitUntil:'networkidle'});
    await m.waitForFunction(()=>window.__PACEFOLD__?.version==='26.0.0');
    const mobileState=await m.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,nav:getComputedStyle(document.querySelector('.edge-nav')).position,actions:document.querySelectorAll('.quick-action').length}));
    assert(mobileState.overflow<=1,`Mobile overflow is ${mobileState.overflow}px`);
    assert(mobileState.nav==='fixed'&&mobileState.actions===6,'Mobile navigation or actions are incomplete');
    await m.screenshot({path:path.join(artifacts,'pacefold-26-mobile.png'),fullPage:true});
    for(const view of ['notes','worklog','now','settings']){
      await m.evaluate(next=>window.__PACEFOLD__.go(next),view);await m.waitForTimeout(60);
      const overflow=await m.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      assert(overflow<=1,`Mobile ${view} overflows by ${overflow}px`);
      await m.screenshot({path:path.join(artifacts,`pacefold-26-mobile-${view}.png`),fullPage:true});
    }
    await mobile.close();
    console.log('Pacefold 26 browser audit passed: clean launch, one runtime, one stylesheet, migration, actions, notes, spatial return, persistence and mobile layout.');
  }finally{if(browser)await browser.close();server.close()}
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1});
