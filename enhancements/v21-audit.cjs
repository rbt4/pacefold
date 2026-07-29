'use strict';
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const site=path.resolve(process.argv[2]||'_site');
const artifacts=path.resolve(process.argv[3]||'/tmp/pacefold-v21-artifacts');
const app=path.join(site,'app');
const read=file=>fs.readFileSync(file,'utf8');
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const dateKey=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};

function staticAudit(){
  const runtime=read(path.join(app,'pacefold-v21.js'));
  const boot=read(path.join(app,'pacefold-v21-boot.js'));
  const css=read(path.join(app,'pacefold-v21.css'));
  const html=read(path.join(app,'index.html'));
  const landing=read(path.join(site,'index.html'));
  const worker=read(path.join(site,'service-worker.js'));
  assert(read(path.join(site,'pacefold-experience.txt')).trim()==='21.0.0','V21 experience version is missing');
  assert(!/\.innerHTML\s*=|style\s*=\s*["']/.test(runtime+boot),'Unsafe V21 DOM construction found');
  assert((html.match(/data-pacefold-v21="21\.0\.0"/g)||[]).length===2,'V21 CSS/runtime injection count is wrong');
  assert((html.match(/data-pacefold-v21-boot="21\.0\.0"/g)||[]).length===1,'V21 boot injection count is wrong');
  assert(html.includes('pacefold-experience" content="21.0.0')&&landing.includes('Pacefold 21 · one protected workday folio'),'V21 public markers are stale');
  for(const token of ['pf21-dayline','pf21-note-calendar','pf21-settings','pacefold.v21.preferences.v1'])assert(runtime.includes(token),`Missing runtime token ${token}`);
  for(const token of ['.pf21-dayline','.pf21-note-calendar','#panel #pf21-settings','.pf21-ribbon-key-now'])assert(css.includes(token),`Missing CSS token ${token}`);
  for(const asset of ['pacefold-v21.css','pacefold-v21-boot.js','pacefold-v21.js'])assert(worker.includes(asset),`Offline worker omits ${asset}`);
}

function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((request,response)=>{
      let pathname='/';try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}catch{}
      let file=path.join(site,pathname.replace(/^\/+/,''));if(pathname.endsWith('/'))file=path.join(file,'index.html');
      if(!file.startsWith(site)){response.writeHead(403);response.end();return;}
      fs.readFile(file,(error,buffer)=>{if(error){response.writeHead(404);response.end();return;}
        const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
        response.writeHead(200,{'content-type':type,'cache-control':'no-store'});response.end(buffer);
      });
    });
    server.listen(0,'127.0.0.1',()=>resolve(server));
  });
}

function prefs(){
  const week={};for(let day=0;day<7;day+=1)week[day]={start:'08:30',end:'16:30',type:day&&day<6?'desk':'off'};
  return{profile:'original',schemaVersion:18,theme:'paper',privacy:false,clarity:'discreet',workdaysOnly:false,workHours:'08:30-16:30',workWeek:week,workReminders:true,notifications:true,notificationMode:'quiet',taskbarBadge:true,showWorkline:true,locationLabel:'Toronto',lat:43.6532,lng:-79.3832,waterTarget:24,sipCadence:30,waterSips:2,gazeEnabled:true,bodyEnabled:true,v21WeatherEnabled:true,waferPromptDismissed:true,activityDate:dateKey(),waterDate:dateKey()};
}
function notes(){const now=new Date(),old=new Date(now-86400000);return[
  {id:`n-${dateKey()}-1`,body:'Today one',category:'Daily',createdAt:now.toISOString()},
  {id:`n-${dateKey()}-2`,body:'Today two',category:'Follow-ups',createdAt:now.toISOString()},
  {id:`n-${dateKey(-1)}-1`,body:'Yesterday',category:'Daily',createdAt:old.toISOString()}
];}
function weather(){const now=new Date().toISOString().slice(0,13)+':00';return{current:{temperature_2m:25,apparent_temperature:23,weather_code:0,is_day:1,precipitation:0,rain:0},hourly:{time:[now],temperature_2m:[25],precipitation_probability:[0],weather_code:[0]},daily:{time:[dateKey(),dateKey(1),dateKey(2)],weather_code:[0,1,2],temperature_2m_max:[26,27,30],temperature_2m_min:[17,15,15],precipitation_probability_max:[0,0,3]}};}
async function contextFor(browser,viewport){
  const context=await browser.newContext({viewport});
  await context.addInitScript(({settings,entries})=>{localStorage.removeItem('pacefoldOnboardedV15');localStorage.removeItem('pacefoldSetupDismissedV15');localStorage.setItem('pacefoldPrefsV15',JSON.stringify(settings));localStorage.setItem('pacefold.notebook.entries.v2',JSON.stringify(entries));},{settings:prefs(),entries:notes()});
  await context.route('**/api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(weather())}));
  return context;
}

async function browserAudit(){
  fs.mkdirSync(artifacts,{recursive:true});const server=await serve();const base=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch({headless:true});const errors=[];
  try{
    const context=await contextFor(browser,{width:1180,height:920});const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!/ERR_INTERNET_DISCONNECTED/.test(message.text()))errors.push(message.text());});
    await page.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__PACEFOLD_V21__?.release==='21.0.0'&&document.getElementById('pf21-dayline')&&document.querySelectorAll('.pf21-calendar-day').length===42&&document.getElementById('pf21-settings'));
    const initial=await page.evaluate(()=>{
      const rect=node=>node?.getBoundingClientRect();const now=rect(document.querySelector('#sequence .pf-ribbon-now'));const crease=rect(document.querySelector('#sequence .pf-ribbon-crease'));const counts=window.__PACEFOLD_V21__.noteCounts();
      return{release:document.documentElement.dataset.pacefoldExperience,boot:window.__PACEFOLD_V21_BOOT__,flags:[localStorage.getItem('pacefoldOnboardedV15'),localStorage.getItem('pacefoldSetupDismissedV15')],dayline:document.getElementById('pf21-dayline').textContent,days:document.querySelectorAll('.pf21-calendar-day').length,noted:document.querySelectorAll('.pf21-calendar-day[data-has-notes="true"]').length,stats:document.querySelector('.pf21-calendar-stats')?.textContent,counts,markers:{now:now&&{w:now.width,h:now.height},crease:crease&&{w:crease.width,h:crease.height}},switches:document.querySelectorAll('#pf21-settings [data-pf21-pref]').length,advanced:document.getElementById('panel').dataset.pf21Advanced,status:rect(document.getElementById('statusLine')),horizontal:document.documentElement.scrollWidth<=innerWidth+1};
    });
    assert(initial.release==='21.0.0'&&initial.boot?.returning&&initial.flags.every(value=>value==='1'),`Setup persistence failed: ${JSON.stringify(initial)}`);
    assert(!/scheduled moment/i.test(initial.dayline)&&initial.days===42&&initial.noted>=2&&/3 notes/.test(initial.stats),`Dayline/calendar failed: ${JSON.stringify(initial)}`);
    assert(initial.counts[dateKey()]===2&&initial.counts[dateKey(-1)]===1,`Note counts failed: ${JSON.stringify(initial.counts)}`);
    assert(initial.markers.now?.h>=20&&(!initial.markers.crease||(initial.markers.now.h>initial.markers.crease.h&&initial.markers.now.w<initial.markers.crease.w)),`Timeline distinction failed: ${JSON.stringify(initial.markers)}`);
    assert(initial.switches===6&&initial.advanced==='false'&&initial.status.width<=2&&initial.horizontal,`Essential layout failed: ${JSON.stringify(initial)}`);

    await page.locator('#brandButton').click();await page.waitForFunction(()=>document.getElementById('panel').classList.contains('on'));
    assert(await page.locator('#panel [data-settings-view]:visible').count()===0,'Advanced settings leaked into essentials');
    await page.locator('[data-pf21-pref="v21WeatherEnabled"]').uncheck();await page.waitForFunction(()=>getComputedStyle(document.getElementById('pf-v19-weather')).display==='none');
    await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__PACEFOLD_V21__?.release==='21.0.0'&&document.getElementById('pf21-note-calendar'));
    const persisted=await page.evaluate(()=>({weather:JSON.parse(localStorage.getItem('pacefoldPrefsV15')).v21WeatherEnabled,display:getComputedStyle(document.getElementById('pf-v19-weather')).display,snapshot:Boolean(JSON.parse(localStorage.getItem('pacefold.v21.preferences.v1')||'null')?.prefs)}));
    assert(persisted.weather===false&&persisted.display==='none'&&persisted.snapshot,`Preference reload failed: ${JSON.stringify(persisted)}`);

    await page.locator('[data-pf-note-body]').fill('V21 saved note');await page.locator('[data-pf-note-save]').click();await page.waitForFunction(()=>/4 notes/.test(document.querySelector('.pf21-calendar-stats')?.textContent||''));
    await page.locator('#brandButton').click();await page.waitForFunction(()=>document.getElementById('panel').classList.contains('on'));await page.locator('.pf21-more-settings').click();
    assert(await page.locator('#panel [data-settings-view]:visible').count()>0,'Advanced settings are unreachable');
    await page.screenshot({path:path.join(artifacts,'pacefold-v21-desktop.png'),fullPage:true});assert(errors.length===0,`Desktop errors: ${errors.join(' | ')}`);await context.close();

    const mobileContext=await contextFor(browser,{width:390,height:844});const mobile=await mobileContext.newPage();mobile.on('pageerror',error=>errors.push(error.message));await mobile.goto(`${base}/app/`,{waitUntil:'networkidle'});await mobile.waitForFunction(()=>window.__PACEFOLD_V21__?.release==='21.0.0'&&document.getElementById('pf21-note-calendar'));await mobile.locator('[data-pf-note-body]').scrollIntoViewIfNeeded();
    const mobileState=await mobile.evaluate(()=>{const calendar=document.getElementById('pf21-note-calendar').getBoundingClientRect(),composer=document.querySelector('[data-pf-note-body]').getBoundingClientRect();return{horizontal:document.documentElement.scrollWidth<=innerWidth+1,calendar:calendar.width,composer:composer.width,inView:composer.top>=0&&composer.bottom<=innerHeight,scroll:document.documentElement.scrollHeight>innerHeight};});
    assert(mobileState.horizontal&&mobileState.calendar<=390&&mobileState.composer>250&&mobileState.inView&&mobileState.scroll,`Mobile layout failed: ${JSON.stringify(mobileState)}`);await mobile.screenshot({path:path.join(artifacts,'pacefold-v21-mobile.png'),fullPage:true});await mobileContext.close();assert(errors.length===0,`V21 errors: ${errors.join(' | ')}`);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}

async function main(){staticAudit();if(process.env.PACEFOLD_STATIC_ONLY==='1')return console.log('Pacefold 21 static audit passed.');await browserAudit();console.log('Pacefold 21 browser audit passed.');}
main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
