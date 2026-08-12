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

function localStamp(date){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
function weatherFixture(){
  const now=Date.now(),t1=localStamp(new Date(now+60*1000)),t2=localStamp(new Date(now+61*60*1000)),t3=localStamp(new Date(now+121*60*1000)),day=t1.slice(0,10);
  return{
    current:{time:localStamp(new Date(now)),temperature_2m:24.4,apparent_temperature:25.1,precipitation:0,weather_code:1,wind_speed_10m:11.2},
    current_units:{temperature_2m:'°C',apparent_temperature:'°C',precipitation:'mm',wind_speed_10m:'km/h'},
    hourly:{time:[t1,t2,t3],temperature_2m:[24,25,24],precipitation_probability:[55,20,5],precipitation:[.6,0,0],weather_code:[61,2,1]},
    hourly_units:{temperature_2m:'°C',precipitation_probability:'%',precipitation:'mm'},
    daily:{time:[day],sunrise:[`${day}T06:19`],sunset:[`${day}T20:16`],uv_index_max:[6.4]},daily_units:{uv_index_max:''}
  };
}

async function main(){
  const worker=fs.readFileSync(path.join(site,'service-worker.js'),'utf8'),manifest=JSON.parse(fs.readFileSync(path.join(site,'manifest.webmanifest'),'utf8'));
  assert(worker.includes("const VERSION='27.0.0'"),'V27 service-worker identity missing');
  assert(worker.includes('polish-r2-window-cues'),'Window-cue cache revision is missing');
  assert(worker.includes("indexedDB.open('pacefold-v26'"),'V27 must preserve the durable cue database');
  assert(manifest.name==='Clock'&&manifest.short_name==='Clock','Installed app chrome is not discreet');

  const{server,origin}=await serve();let browser;
  try{
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Toronto'}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
    await page.route(/https:\/\/api\.open-meteo\.com\/v1\/forecast.*/,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(weatherFixture())}));
    await page.addInitScript(()=>{
      const now=Date.now();localStorage.setItem('pacefoldOnboardedV15','1');
      localStorage.setItem('pacefoldPrefsV15',JSON.stringify({profile:'original',rhythmDiscretion:'neutral',lat:43.6205,lng:-79.5132,locationLabel:'Etobicoke, Toronto',timeZone:'America/Toronto',method:'15',asr:'hanafi',showSeconds:true,timeFormat:'12',workHours:'00:00-23:59',workDays:[0,1,2,3,4,5,6],notifications:false,quietMode:false,weatherEnabled:true,waterTarget:24,waterStep:2,waterOz:0,waterSips:0,waterLastAt:now-20*60*1000,waterCadence:1,gazeLastCompleted:now,eyeCadence:30,bodyLastCompleted:now,bodyCadence:45,prepMinutes:30,mealMinutes:30,awayMinutes:10,noteCategories:['Note','Follow-up','Decision','Inspection','JHSC','Idea']}));
      localStorage.setItem('pacefold.notebook.entries.v2',JSON.stringify([]));localStorage.setItem('pacefold.dayflow.v1',JSON.stringify({days:{}}));localStorage.setItem('pacefold.cues.v1',JSON.stringify({ack:{},notified:{},snoozeUntil:0}));
    });
    await page.goto(`${origin}/app/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__PACEFOLD__?.version==='27.0.0');

    const privateTerms=/\b(Fajr|Dhuhr|Asr|Maghrib|Isha|Hanafi|prayer)\b|Etobicoke|Toronto|America\/Toronto|15°/i;
    const home=await page.evaluate(()=>({text:document.querySelector('[data-view="home"]').innerText,cues:window.__PACEFOLD__.cues.length,revision:window.__PACEFOLD__.revision,notches:document.querySelectorAll('#clock-cue-ring .clock-cue-notch').length,title:document.title,brand:document.querySelector('.brand strong')?.textContent,tagline:getComputedStyle(document.querySelector('.brand small')).display,nowLine:Boolean(document.getElementById('day-now-line')),percent:document.getElementById('day-percent')?.textContent,duplicateCueHeader:Boolean(document.getElementById('clock-cue-count')),windowBubbles:document.querySelectorAll('.window-cue-bubble').length,blooming:document.querySelectorAll('.window-cue-bubble[data-bloom="true"]').length,fullPanel:getComputedStyle(document.getElementById('clock-cue-panel')).display,favicon:document.getElementById('app-favicon')?.href||''}));
    assert(!privateTerms.test(home.text),'Neutral Clock leaked private rhythm/location vocabulary');
    assert(home.revision==='polish-r2-window-cues','Window-cue revision did not boot');
    assert(home.cues>0&&home.notches===Math.min(7,home.cues),`Cue notch contract failed: cues=${home.cues}, notches=${home.notches}`);
    assert(home.title==='Clock'&&home.brand==='Clock'&&home.tagline==='none','Edge-tab Clock chrome is not discreet');
    assert(home.windowBubbles===Math.min(4,home.cues)&&home.blooming===0,'Existing cues should load as quiet beads without replaying alerts');
    assert(home.fullPanel==='none','The retired full Clock cue panel is still visible');
    assert(home.favicon.startsWith('data:image/svg+xml'),'Waiting cues did not reach the real browser-tab favicon');
    assert(home.nowLine&&/% of workday|Off day/.test(home.percent),'Day Unfold current-time/percentage contract failed');
    assert(!home.duplicateCueHeader,'Duplicate Clock cue header returned');

    await page.locator('.rhythm-card').hover();await page.waitForTimeout(900);
    const hoverText=await page.locator('[data-view="home"]').innerText();
    assert(!privateTerms.test(hoverText),'Neutral Clock revealed private rhythm vocabulary from passive hover');

    await page.evaluate(()=>{window.__PACEFOLD__.prefs.gazeLastCompleted=Date.now()-31*60000;window.__PACEFOLD__.render('home')});
    await page.waitForSelector('.window-cue-bubble[data-source="eyes"][data-bloom="true"]');
    const bloom=await page.evaluate(()=>({title:document.title,text:document.querySelector('.window-cue-bubble[data-source="eyes"]')?.innerText||'',favicon:document.getElementById('app-favicon')?.href||'',count:document.querySelectorAll('.window-cue-bubble[data-bloom="true"]').length}));
    assert(bloom.title==='Clock','A new window cue made the browser tab noisy');assert(/Look far/i.test(bloom.text),'The new eye cue did not bloom with useful copy');assert(!privateTerms.test(bloom.text),'Window cue leaked private rhythm vocabulary');assert(bloom.favicon.startsWith('data:image/svg+xml')&&bloom.count>=1,'Bubble or tab favicon did not react to a new cue');
    await page.locator('.window-cue-bubble[data-source="eyes"]').click();await page.waitForTimeout(60);assert(await page.locator('.window-cue-bubble[data-source="eyes"]').count()===0,'Clicking a window bubble did not quietly clear it');

    await page.evaluate(()=>window.__PACEFOLD__.go('now'));await page.waitForSelector('.weather-nowcast .weather-hour');await page.waitForTimeout(80);
    const nowView=await page.evaluate(()=>({text:document.querySelector('[data-view="now"]').innerText,next:document.getElementById('now-next-name')?.textContent,actions:getComputedStyle(document.querySelector('.now-actions')).display,nowcast:document.querySelectorAll('.weather-nowcast .weather-hour').length,weatherDetail:document.querySelectorAll('.weather-detail-grid .weather-mini').length,rain:document.querySelector('.weather-rain-window')?.innerText||'',place:document.getElementById('weather-place')?.textContent||''}));
    assert(!privateTerms.test(nowView.text),'Neutral Now view leaked private rhythm/location vocabulary');
    assert(nowView.next==='Scheduled moment'||nowView.next==='Today is complete',`Now discretion failed: ${nowView.next}`);
    assert(nowView.actions==='none','Duplicated clear/snooze block is still visible in Next moment');
    assert(nowView.nowcast===2,`Weather nowcast expected 2 cards, got ${nowView.nowcast}`);
    assert(nowView.weatherDetail===3,`Weather solar/UV expected 3 details, got ${nowView.weatherDetail}`);
    assert(/Rain window/i.test(nowView.rain)&&/55%/.test(nowView.rain),`Weather rain window failed: ${nowView.rain}`);
    assert(nowView.place==='Local conditions',`Neutral weather location leaked: ${nowView.place}`);

    await page.evaluate(()=>window.__PACEFOLD__.go('worklog'));await page.waitForTimeout(80);
    const worklog=await page.evaluate(()=>({metrics:document.getElementById('metric-grid')?.innerText||'',comparison:Boolean(document.getElementById('day-compare')),dueCopy:document.querySelector('[data-action="eyes"] small')?.textContent||''}));
    assert(worklog.comparison,'Yesterday comparison surface is missing');assert(/AT WORK/.test(worklog.metrics)&&!/\bDESK\b/.test(worklog.metrics),'Day Log terminology did not move from Desk to At work');assert(!/due now/i.test(worklog.dueCopy),'Quick action still shouts Due now');
    assert(!errors.length,errors.join('\n'));await context.close();
    console.log('Pacefold 27 window-cue release contract passed.');
  }finally{if(browser)await browser.close();server.close()}
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1});