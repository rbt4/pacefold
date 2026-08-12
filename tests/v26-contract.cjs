'use strict';
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const{chromium}=require('playwright');

const site=path.resolve(process.argv[2]||'_site');
const assert=(value,message)=>{if(!value)throw new Error(message)};

function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((request,response)=>{
      let pathname='/';try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname)}catch{}
      let file=path.join(site,pathname.replace(/^\/+/,''));if(pathname.endsWith('/'))file=path.join(file,'index.html');
      if(!file.startsWith(site)){response.writeHead(403);response.end();return}
      fs.readFile(file,(error,data)=>{
        if(error){response.writeHead(404);response.end('Not found');return}
        const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';
        response.writeHead(200,{'content-type':type,'cache-control':'no-store'});response.end(data);
      });
    });
    server.listen(0,'127.0.0.1',()=>resolve({server,origin:`http://127.0.0.1:${server.address().port}`}));
  });
}

async function main(){
  const worker=fs.readFileSync(path.join(site,'service-worker.js'),'utf8');
  const css=fs.readFileSync(path.join(site,'app','pacefold.css'),'utf8');
  assert(worker.includes("event.tag==='pacefold-cues'"),'Periodic cue sync handler missing');
  assert(worker.includes("indexedDB.open('pacefold-v26'"),'Service worker IndexedDB cue state missing');
  assert(worker.includes("event.action==='ack'")&&worker.includes("event.action==='snooze'"),'Closed-window notification actions missing');
  assert(worker.includes('notify-water-128.png')&&worker.includes('badge-96.png'),'Raster notification assets missing from worker');
  assert(css.includes('.title-cue-strip')&&css.includes('html[data-wco="on"]'),'WCO cue strip CSS missing');
  assert(css.includes('.clock-cue-notch')&&css.includes('.day-marker-button'),'Clock cue or SVG marker CSS missing');
  assert(css.includes('.edge-nav .edge.is-expanded'),'Edge preview CSS missing');

  const{server,origin}=await serve();let browser;
  try{
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Toronto'});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
    await page.addInitScript(()=>{
      const now=Date.now();
      localStorage.setItem('pacefoldOnboardedV15','1');
      localStorage.setItem('pacefoldPrefsV15',JSON.stringify({
        profile:'original',rhythmDiscretion:'neutral',lat:43.6205,lng:-79.5132,locationLabel:'Etobicoke, Toronto',timeZone:'America/Toronto',method:'15',asr:'hanafi',
        showSeconds:true,timeFormat:'12',workHours:'00:00-23:59',workDays:[0,1,2,3,4,5,6],notifications:false,quietMode:false,weatherEnabled:false,
        waterTarget:24,waterStep:2,waterOz:0,waterSips:0,waterLastAt:now-20*60*1000,waterCadence:1,gazeLastCompleted:now,eyeCadence:30,bodyLastCompleted:now,bodyCadence:45,
        prepMinutes:30,mealMinutes:30,awayMinutes:10,noteCategories:['Note','Follow-up','Decision','Inspection','JHSC','Idea']
      }));
      localStorage.setItem('pacefold.notebook.entries.v2',JSON.stringify([]));
      localStorage.setItem('pacefold.dayflow.v1',JSON.stringify({days:{}}));
      localStorage.setItem('pacefold.cues.v1',JSON.stringify({ack:{},notified:{},snoozeUntil:0}));
    });
    await page.goto(`${origin}/app/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__PACEFOLD__?.version==='26.0.0');

    const home=await page.evaluate(()=>({
      text:document.querySelector('[data-view="home"]').innerText,
      cueCount:window.__PACEFOLD__.cues.length,
      notchCount:document.querySelectorAll('#clock-cue-ring .clock-cue-notch').length,
      svg:Boolean(document.getElementById('day-arc-path')&&document.getElementById('day-sun-group')),
      viewBox:document.querySelector('.day-sky-svg')?.getAttribute('viewBox'),
      markerButtons:document.querySelectorAll('#day-markers .day-marker-button').length,
      title:document.title,
      widths:[getComputedStyle(document.getElementById('cue-cluster')).width,getComputedStyle(document.getElementById('cue-cluster')).minWidth]
    }));
    assert(!/\b(Fajr|Dhuhr|Asr|Maghrib|Isha|Hanafi|prayer)\b|Etobicoke|Toronto|America\/Toronto|15°/i.test(home.text),'Neutral Clock leaked private rhythm vocabulary');
    assert(home.cueCount>0&&home.notchCount===Math.min(7,home.cueCount),'Dial cue notch count does not match waiting cues');
    assert(home.svg,'SVG day arc did not render');
    assert(home.markerButtons>=0,'Day markers failed to render');
    assert(home.title.startsWith('● Pacefold —'),'Window title does not carry neutral waiting state');
    assert(home.widths[0]===home.widths[1],'Cue cluster footprint is not stable');

    await page.locator('.edge-up').focus();await page.waitForTimeout(180);
    assert(await page.locator('.edge-up').evaluate(node=>node.classList.contains('is-expanded')),'Edge preview did not expand from keyboard focus');
    assert((await page.locator('.edge-up .edge-preview strong').textContent()).length>0,'Edge preview did not render live content');
    await page.locator('#clock-note-input').fill('Carry this inspection follow-up');
    await page.locator('#clock-note-categories button',{hasText:'Follow-up'}).click();
    await page.locator('#clock-note-input').press('Enter');
    await page.waitForTimeout(100);
    const captured=await page.evaluate(()=>window.__PACEFOLD__.notes.find(note=>note.body==='Carry this inspection follow-up'));
    assert(captured&&captured.category==='Follow-up','Clock one-keystroke note capture failed');
    assert(captured.context?.at&&captured.context?.moment&&typeof captured.context.moment.progress==='number','Clock note did not capture day context');
    assert(await page.locator('#clock-carry').isVisible(),'Open follow-up did not carry onto the Clock');

    await page.evaluate(()=>window.__PACEFOLD__.go('notes'));await page.waitForTimeout(80);
    await page.locator(`[data-note-id="${captured.id}"] [data-note-edit]`).click();
    const editor=page.locator(`[data-note-id="${captured.id}"] .note-inline-input`);assert(await editor.count()===1,'Inline editor did not open');
    await editor.fill('Carry this inspection follow-up — edited');
    assert((await page.locator('#note-save-status').textContent()).includes('Unsaved'),'Inline edit did not expose dirty state');
    await page.locator(`[data-note-id="${captured.id}"] .note-inline-footer button[aria-label="Save note changes"]`).click();
    assert((await page.locator('#note-save-status').textContent()).includes('Saved'),'Inline edit did not expose saved state');

    await page.evaluate(()=>window.__PACEFOLD__.go('worklog'));await page.waitForTimeout(80);
    assert(await page.locator(`.timeline-note-link[data-note-id="${captured.id}"]`).count()>=1,'Day Log did not cross-link the note');

    const storage=await page.evaluate(()=>({
      prefs:JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}'),
      notes:JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'{}'),
      log:JSON.parse(localStorage.getItem('pacefold.dayflow.v1')||'{}'),
      cues:JSON.parse(localStorage.getItem('pacefold.cues.v1')||'{}')
    }));
    assert(storage.prefs.v===1,'Prefs storage was not migrated to v1');
    assert(storage.notes.v===1&&Array.isArray(storage.notes.items),'Notes storage was not migrated to a v1 envelope');
    assert(storage.log.v===1,'Dayflow storage was not migrated to v1');
    assert(storage.cues.v===1,'Cue storage was not migrated to v1');
    assert(!errors.length,errors.join('\n'));
    await context.close();

    const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,timezoneId:'America/Toronto'});const m=await mobile.newPage();
    await m.addInitScript(()=>{localStorage.setItem('pacefoldOnboardedV15','1');localStorage.setItem('pacefoldPrefsV15',JSON.stringify({profile:'everyday',rhythmDiscretion:'neutral',timeZone:'America/Toronto',workHours:'08:30-16:30',workDays:[1,2,3,4,5],notifications:false,weatherEnabled:false}))});
    await m.goto(`${origin}/app/`,{waitUntil:'networkidle'});await m.waitForFunction(()=>window.__PACEFOLD__?.version==='26.0.0');
    assert(await m.locator('.edge-nav').evaluate(node=>getComputedStyle(node).display)==='none','Desktop hover rails remain active on touch');
    assert(await m.locator('#mobile-nav').isVisible(),'Dedicated touch navigation is missing');
    await mobile.close();
    console.log('Pacefold 26 regression contract passed.');
  }finally{if(browser)await browser.close();server.close()}
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1});
