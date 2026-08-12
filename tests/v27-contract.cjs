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

function localStamp(date=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
function weatherFixture(){
  const now=new Date(),h0=localStamp(new Date(now.getTime()-60*60*1000)).slice(0,13)+':00',h1=localStamp(now).slice(0,13)+':00',h2=localStamp(new Date(now.getTime()+60*60*1000)).slice(0,13)+':00',h3=localStamp(new Date(now.getTime()+2*60*60*1000)).slice(0,13)+':00',day=h1.slice(0,10);
  return{
    current:{time:localStamp(now),temperature_2m:24.4,apparent_temperature:25.1,precipitation:0,weather_code:1,wind_speed_10m:11.2},
    current_units:{temperature_2m:'°C',apparent_temperature:'°C',precipitation:'mm',wind_speed_10m:'km/h'},
    hourly:{time:[h0,h1,h2,h3],temperature_2m:[23,24,25,24],precipitation_probability:[5,10,55,25],precipitation:[0,0,.6,0],weather_code:[1,1,61,2]},
    hourly_units:{temperature_2m:'°C',precipitation_probability:'%',precipitation:'mm'},
    daily:{time:[day],sunrise:[`${day}T06:19`],sunset:[`${day}T20:16`],uv_index_max:[6.4]},daily_units:{uv_index_max:''}
  };
}

async function main(){
  const worker=fs.readFileSync(path.join(site,'service-worker.js'),'utf8');
  const css=fs.readFileSync(path.join(site,'app','pacefold.css'),'utf8');
  const manifest=JSON.parse(fs.readFileSync(path.join(site,'manifest.webmanifest'),'utf8'));
  assert(worker.includes("const VERSION='27.0.0'"),'V27 service worker identity missing');
  assert(worker.includes("indexedDB.open('pacefold-v26'"),'Durable cue database continuity missing');
  assert(worker.includes("event.action==='ack'")&&worker.includes("event.action==='snooze'"),'Closed-window notification actions missing');
  assert(css.includes('.day-now-line')&&css.includes('.weather-nowcast')&&css.includes('.day-compare-grid'),'V27 polish CSS missing');
  assert(css.includes('.clock-cue-notch')&&css.includes('.edge-nav .edge.is-expanded'),'Clock cue or edge preview CSS missing');
  assert(manifest.name==='Clock'&&manifest.short_name==='Clock','Installed app name is not discreet');

  const{server,origin}=await serve();let browser;
  try{
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Toronto'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
    await page.route('**/api.open-meteo.com/v1/forecast?**',async route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(weatherFixture())}));
    await page.addInitScript(()=>{
      const now=Date.now();
      localStorage.setItem('pacefoldOnboardedV15','1');
      localStorage.setItem('pacefoldPrefsV15',JSON.stringify({
        profile:'original',rhythmDiscretion:'neutral',lat:43.6205,lng:-79.5132,locationLabel:'Etobicoke, Toronto',timeZone:'America/Toronto',method:'15',asr:'hanafi',
        showSeconds:true,timeFormat:'12',workHours:'00:00-23:59',workDays:[0,1,2,3,4,5,6],notifications:false,quietMode:false,weatherEnabled:true,
        waterTarget:24,waterStep:2,waterOz:0,waterSips:0,waterLastAt:now-20*60*1000,waterCadence:1,gazeLastCompleted:now,eyeCadence:30,bodyLastCompleted:now,bodyCadence:45,
        prepMinutes:30,mealMinutes:30,awayMinutes:10,noteCategories:['Note','Follow-up','Decision','Inspection','JHSC','Idea']
      }));
      localStorage.setItem('pacefold.notebook.entries.v2',JSON.stringify([]));
      localStorage.setItem('pacefold.dayflow.v1',JSON.stringify({days:{}}));
      localStorage.setItem('pacefold.cues.v1',JSON.stringify({ack:{},notified:{},snoozeUntil:0}));
    });
    await page.goto(`${origin}/app/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__PACEFOLD__?.version==='27.0.0');

    const home=await page.evaluate(()=>({
      text:document.querySelector('[data-view="home"]').innerText,
      cueCount:window.__PACEFOLD__.cues.length,
      notchCount:document.querySelectorAll('#clock-cue-ring .clock-cue-notch').length,
      svg:Boolean(document.getElementById('day-arc-path')&&document.getElementById('day-sun-group')&&document.getElementById('day-now-line')),
      markerButtons:document.querySelectorAll('#day-markers .day-marker-button').length,
      title:document.title,
      brand:document.querySelector('.brand strong')?.textContent,
      taglineVisible:getComputedStyle(document.querySelector('.brand small')).display!=='none',
      cueBackground:getComputedStyle(document.getElementById('cue-cluster')).backgroundColor,
      dayPercent:document.getElementById('day-percent')?.textContent,
      duplicateCueHeader:Boolean(document.getElementById('clock-cue-count'))
    }));
    assert(!/\b(Fajr|Dhuhr|Asr|Maghrib|Isha|Hanafi|prayer)\b|Etobicoke|Toronto|America\/Toronto|15°/i.test(home.text),'Neutral Clock leaked private rhythm vocabulary');
    assert(home.cueCount>0&&home.notchCount===Math.min(7,home.cueCount),'Dial cue notch count does not match waiting cues');
    assert(home.svg,'SVG day arc or moving current-time line did not render');
    assert(home.markerButtons>=0,'Day markers failed to render');
    assert(home.title===`Clock · ${home.cueCount}`,'Window title is not neutral or does not carry cue count');
    assert(home.brand==='Clock'&&!home.taglineVisible,'Ambient app chrome still exposes Pacefold branding/tagline');
    assert(/rgba?\(/.test(home.cueBackground)&&!home.cueBackground.includes('0, 0, 0, 0'),'Cue cluster lacks a visible pill surface');
    assert(/% of workday|Off day/.test(home.dayPercent),'Day percentage is not meaningfully labelled');
    assert(!home.duplicateCueHeader,'Duplicate Clock cue header still exists');

    await page.locator('.edge-up').focus();await page.waitForTimeout(180);
    assert(await page.locator('.edge-up').evaluate(node=>node.classList.contains('is-expanded')),'Edge preview did not expand from keyboard focus');
    await page.locator('#clock-note-input').fill('Carry this inspection follow-up');
    await page.locator('#clock-note-categories button',{hasText:'Follow-up'}).click();
    await page.locator('#clock-note-input').press('Enter');await page.waitForTimeout(100);
    const captured=await page.evaluate(()=>window.__PACEFOLD__.notes.find(note=>note.body==='Carry this inspection follow-up'));
    assert(captured&&captured.category==='Follow-up','Clock one-keystroke note capture failed');
    assert(captured.context?.at&&captured.context?.moment&&typeof captured.context.moment.progress==='number','Clock note did not capture day context');

    await page.evaluate(()=>window.__PACEFOLD__.go('now'));await page.waitForSelector('.weather-nowcast');
    const nowView=await page.evaluate(()=>({text:document.querySelector('[data-view="now"]').innerText,next:document.getElementById('now-next-name')?.textContent,actionsVisible:getComputedStyle(document.querySelector('.now-actions')).display!=='none',weatherText:document.getElementById('weather-content')?.innerText,nowcast:document.querySelectorAll('.weather-hour').length,detail:document.querySelectorAll('.weather-mini').length}));
    assert(!/\b(Fajr|Dhuhr|Asr|Maghrib|Isha|Hanafi|prayer)\b/i.test(nowView.text),'Neutral Now view leaked named rhythm vocabulary');
    assert(nowView.next==='Scheduled moment'||nowView.next==='Today is complete','Now next moment does not honor discretion');
    assert(!nowView.actionsVisible,'Duplicated clear/snooze controls remain in Next moment card');
    assert(nowView.nowcast===2&&nowView.detail===3&&/Rain window/.test(nowView.weatherText),'Weather nowcast/rain/sun/UV context failed to render');

    await page.evaluate(()=>window.__PACEFOLD__.go('notes'));await page.waitForTimeout(80);
    await page.locator(`[data-note-id="${captured.id}"] [data-note-edit]`).click();
    const editor=page.locator(`[data-note-id="${captured.id}"] .note-inline-input`);assert(await editor.count()===1,'Inline editor did not open');
    await editor.fill('Carry this inspection follow-up — edited');
    assert((await page.locator('#note-save-status').textContent()).includes('Unsaved'),'Inline edit did not expose dirty state');
    await page.locator(`[data-note-id="${captured.id}"] .note-inline-footer button[aria-label="Save note changes"]`).click();
    assert((await page.locator('#note-save-status').textContent()).includes('Saved'),'Inline edit did not expose saved state');

    await page.evaluate(()=>window.__PACEFOLD__.go('worklog'));await page.waitForTimeout(100);
    assert(await page.locator(`.timeline-note-link[data-note-id="${captured.id}"]`).count()>=1,'Day Log did not cross-link the note');
    assert(await page.locator('#day-compare').count()===1,'Yesterday comparison surface is missing');
    assert((await page.locator('#metric-grid').innerText()).includes('AT WORK'),'Day Log still uses Desk terminology');
    assert(!(await page.locator('#metric-grid').innerText()).includes('DESK'),'Desk terminology returned');

    const storage=await page.evaluate(()=>({prefs:JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}'),notes:JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'{}'),log:JSON.parse(localStorage.getItem('pacefold.dayflow.v1')||'{}'),cues:JSON.parse(localStorage.getItem('pacefold.cues.v1')||'{}')}));
    assert(storage.prefs.v===1,'Prefs storage was not migrated to v1');
    assert(storage.notes.v===1&&Array.isArray(storage.notes.items),'Notes storage was not migrated to a v1 envelope');
    assert(storage.log.v===1,'Dayflow storage was not migrated to v1');
    assert(storage.cues.v===1,'Cue storage was not migrated to v1');
    assert(!errors.length,errors.join('\n'));
    await context.close();

    const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,timezoneId:'America/Toronto'});const m=await mobile.newPage();
    await m.addInitScript(()=>{localStorage.setItem('pacefoldOnboardedV15','1');localStorage.setItem('pacefoldPrefsV15',JSON.stringify({profile:'everyday',rhythmDiscretion:'neutral',timeZone:'America/Toronto',workHours:'08:30-16:30',workDays:[1,2,3,4,5],notifications:false,weatherEnabled:false}))});
    await m.goto(`${origin}/app/`,{waitUntil:'networkidle'});await m.waitForFunction(()=>window.__PACEFOLD__?.version==='27.0.0');
    assert(await m.locator('.edge-nav').evaluate(node=>getComputedStyle(node).display)==='none','Desktop hover rails remain active on touch');
    assert(await m.locator('#mobile-nav').isVisible(),'Dedicated touch navigation is missing');
    assert((await m.locator('.brand strong').textContent())==='Clock','Mobile ambient chrome is not discreet');
    await mobile.close();
    console.log('Pacefold 27 regression contract passed.');
  }finally{if(browser)await browser.close();server.close()}
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1});
