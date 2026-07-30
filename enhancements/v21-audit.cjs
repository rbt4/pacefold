'use strict';
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const RELEASE='21.1.0';
const site=path.resolve(process.argv[2]||'_site');
const artifacts=path.resolve(process.argv[3]||'/tmp/pacefold-v21-artifacts');
const app=path.join(site,'app');
const read=file=>fs.readFileSync(file,'utf8');
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const dateKey=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};

function staticAudit(){
  const runtime=read(path.join(app,'pacefold-v21.js'));
  const persistence=read(path.join(app,'pacefold-v21-persistence.js'));
  const boot=read(path.join(app,'pacefold-v21-boot.js'));
  const css=read(path.join(app,'pacefold-v21.css'));
  const compat=read(path.join(app,'pacefold-v21-compat.css'));
  const refineCss=read(path.join(app,'pacefold-v21-refine.css'));
  const refineRuntime=read(path.join(app,'pacefold-v21-refine.js'));
  const html=read(path.join(app,'index.html'));
  const landing=read(path.join(site,'index.html'));
  const worker=read(path.join(site,'service-worker.js'));
  const escaped=RELEASE.replace(/\./g,'\\.');
  assert(read(path.join(site,'pacefold-experience.txt')).trim()===RELEASE,'Pacefold 21.1 experience version is missing');
  assert(!/\.innerHTML\s*=|style\s*=\s*["']/.test(runtime+boot+persistence+refineRuntime),'Unsafe Pacefold 21 DOM construction found');
  assert((html.match(new RegExp(`data-pacefold-v21="${escaped}"`,'g'))||[]).length===2,'Pacefold 21 CSS/runtime injection count is wrong');
  assert((html.match(new RegExp(`data-pacefold-v21-compat="${escaped}"`,'g'))||[]).length===1,'Pacefold 21 compatibility CSS injection count is wrong');
  assert((html.match(new RegExp(`data-pacefold-v21-boot="${escaped}"`,'g'))||[]).length===1,'Pacefold 21 boot injection count is wrong');
  assert((html.match(new RegExp(`data-pacefold-v21-persistence="${escaped}"`,'g'))||[]).length===1,'Pacefold 21 persistence injection count is wrong');
  assert((html.match(new RegExp(`data-pacefold-v21-refine="${escaped}"`,'g'))||[]).length===2,'Pacefold 21.1 refinement injection count is wrong');
  assert(html.includes(`pacefold-experience" content="${RELEASE}`)&&landing.includes('Pacefold 21 · one protected workday folio'),'Pacefold 21.1 public markers are stale');
  for(const token of ['pf21-dayline','pf21-note-calendar','pf21-settings','pacefold.v21.preferences.v1',"document.body?.dataset.quiet==='true'"])assert(runtime.includes(token),`Missing runtime token ${token}`);
  assert(persistence.includes('pacefold.v21.settings.v1'),'Extension settings store is missing');
  assert(compat.includes('width:100%!important')&&compat.includes('opacity:0!important'),'Legacy geometry compatibility is missing');
  for(const token of ['.pf21-dayline','.pf21-note-calendar','#panel #pf21-settings','.pf21-ribbon-key-now'])assert(css.includes(token),`Missing CSS token ${token}`);
  for(const token of ['pf-v21-1-active','grid-template-columns:repeat(3','data-note-level','.pf-v20-alert'])assert(refineCss.includes(token),`Missing refinement CSS token ${token}`);
  for(const token of ["const RELEASE='21.1.0'",'__PACEFOLD_V21_REFINEMENT__','patchStoredVersion','refineCalendar'])assert(refineRuntime.includes(token),`Missing refinement runtime token ${token}`);
  for(const asset of ['pacefold-v21.css','pacefold-v21-compat.css','pacefold-v21-boot.js','pacefold-v21.js','pacefold-v21-persistence.js','pacefold-v21-refine.css','pacefold-v21-refine.js'])assert(worker.includes(asset),`Offline worker omits ${asset}`);
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
  await context.addInitScript(({settings,entries})=>{
    if(sessionStorage.getItem('pacefoldV21AuditSeeded')==='1')return;
    sessionStorage.setItem('pacefoldV21AuditSeeded','1');
    localStorage.removeItem('pacefoldOnboardedV15');
    localStorage.removeItem('pacefoldSetupDismissedV15');
    localStorage.removeItem('pacefold.v21.settings.v1');
    localStorage.setItem('pacefoldPrefsV15',JSON.stringify(settings));
    localStorage.setItem('pacefold.notebook.entries.v2',JSON.stringify(entries));
  },{settings:prefs(),entries:notes()});
  await context.route('**/api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(weather())}));
  return context;
}

async function browserAudit(){
  fs.mkdirSync(artifacts,{recursive:true});const server=await serve();const base=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch({headless:true});const errors=[];
  try{
    const context=await contextFor(browser,{width:1180,height:920});const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!/ERR_INTERNET_DISCONNECTED/.test(message.text()))errors.push(message.text());});
    await page.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await page.waitForFunction(release=>window.__PACEFOLD_V21_REFINEMENT__?.release===release&&window.__PACEFOLD_V21__?.release===release&&window.__PACEFOLD_V21_PERSISTENCE__?.release===release&&document.querySelectorAll('.pf21-calendar-day').length===42&&document.getElementById('pf21-settings'),RELEASE);
    const initial=await page.evaluate(()=>{
      const rect=node=>node?.getBoundingClientRect();const now=rect(document.querySelector('#sequence .pf-ribbon-now'));const crease=rect(document.querySelector('#sequence .pf-ribbon-crease'));const counts=window.__PACEFOLD_V21__.noteCounts();const statusNode=document.getElementById('statusLine'),statusStyle=getComputedStyle(statusNode);const folio=rect(document.querySelector('.pf-v20-folio'));
      return{release:document.documentElement.dataset.pacefoldExperience,refinement:document.documentElement.dataset.pacefoldRefinement,boot:window.__PACEFOLD_V21_BOOT__,flags:[localStorage.getItem('pacefoldOnboardedV15'),localStorage.getItem('pacefoldSetupDismissedV15')],dayline:document.getElementById('pf21-dayline').textContent,days:document.querySelectorAll('.pf21-calendar-day').length,noted:document.querySelectorAll('.pf21-calendar-day[data-note-level]:not([data-note-level="0"])').length,stats:document.querySelector('.pf21-calendar-stats')?.textContent,counts,markers:{now:now&&{w:now.width,h:now.height},crease:crease&&{w:crease.width,h:crease.height}},switches:document.querySelectorAll('#pf21-settings [data-pf21-pref]').length,version:document.querySelector('.pf21-settings-version')?.textContent,advanced:document.getElementById('panel').dataset.pf21Advanced,status:{...rect(statusNode).toJSON(),opacity:Number(statusStyle.opacity),pointer:statusStyle.pointerEvents},folio:folio&&{width:folio.width,left:folio.left,right:folio.right},horizontal:document.documentElement.scrollWidth<=innerWidth+1};
    });
    assert(initial.release===RELEASE&&initial.refinement===RELEASE&&initial.boot?.returning&&initial.flags.every(value=>value==='1'),`Setup/version persistence failed: ${JSON.stringify(initial)}`);
    assert(!/scheduled moment/i.test(initial.dayline)&&initial.days===42&&initial.noted>=2&&/3 notes/.test(initial.stats),`Dayline/calendar refinement failed: ${JSON.stringify(initial)}`);
    assert(initial.counts[dateKey()]===2&&initial.counts[dateKey(-1)]===1,`Note counts failed: ${JSON.stringify(initial.counts)}`);
    assert(initial.markers.now?.h>=20&&(!initial.markers.crease||(initial.markers.now.h>initial.markers.crease.h&&initial.markers.now.w<initial.markers.crease.w)),`Timeline distinction failed: ${JSON.stringify(initial.markers)}`);
    assert(initial.switches===6&&initial.version===`Pacefold ${RELEASE}`&&initial.advanced==='false'&&initial.status.width>500&&initial.status.height<=1&&initial.status.opacity===0&&initial.status.pointer==='none'&&initial.folio.width<=1160&&initial.horizontal,`Refined desktop layout failed: ${JSON.stringify(initial)}`);

    await page.locator('#brandButton').click();await page.waitForFunction(()=>document.getElementById('panel').classList.contains('on'));
    const essentials=await page.evaluate(()=>{const settings=document.getElementById('pf21-settings').getBoundingClientRect();return{height:settings.height,rows:document.querySelectorAll('.pf21-setting-switch').length,advanced:document.getElementById('panel').dataset.pf21Advanced,label:document.querySelector('.pf21-more-settings')?.textContent};});
    assert(essentials.height<470&&essentials.rows===6&&essentials.advanced==='false'&&essentials.label==='All settings',`Essential settings are still bulky or unclear: ${JSON.stringify(essentials)}`);
    await page.locator('[data-pf21-pref="v21WeatherEnabled"]').uncheck();await page.waitForFunction(()=>getComputedStyle(document.getElementById('pf-v19-weather')).display==='none');
    await page.reload({waitUntil:'networkidle'});await page.waitForFunction(release=>window.__PACEFOLD_V21_REFINEMENT__?.release===release&&document.getElementById('pf21-note-calendar'),RELEASE);
    const persisted=await page.evaluate(()=>({weather:window.__PACEFOLD_V21_PERSISTENCE__.read().v21WeatherEnabled,display:getComputedStyle(document.getElementById('pf-v19-weather')).display,snapshot:JSON.parse(localStorage.getItem('pacefold.v21.preferences.v1')||'null'),extension:JSON.parse(localStorage.getItem('pacefold.v21.settings.v1')||'null')}));
    assert(persisted.weather===false&&persisted.display==='none'&&persisted.snapshot?.version===RELEASE&&persisted.extension?.version===RELEASE,`Preference reload failed: ${JSON.stringify(persisted)}`);

    await page.locator('[data-pf-note-body]').fill('V21.1 saved note');await page.locator('[data-pf-note-save]').click();await page.waitForFunction(()=>/4 notes/.test(document.querySelector('.pf21-calendar-stats')?.textContent||''));
    await page.locator('#brandButton').click();await page.waitForFunction(()=>document.getElementById('panel').classList.contains('on'));await page.locator('.pf21-more-settings').click();
    assert(await page.locator('#panel [data-settings-view]:visible').count()>0,'Advanced settings are unreachable');
    await page.locator('.pf21-more-settings').click();
    await page.screenshot({path:path.join(artifacts,'pacefold-v21-1-desktop.png'),fullPage:true});assert(errors.length===0,`Desktop errors: ${errors.join(' | ')}`);await context.close();

    const mobileContext=await contextFor(browser,{width:390,height:844});const mobile=await mobileContext.newPage();mobile.on('pageerror',error=>errors.push(error.message));await mobile.goto(`${base}/app/`,{waitUntil:'networkidle'});await mobile.waitForFunction(release=>window.__PACEFOLD_V21_REFINEMENT__?.release===release&&document.getElementById('pf21-note-calendar'),RELEASE);
    const mobileTop=await mobile.evaluate(()=>{const rect=node=>node?.getBoundingClientRect();const workline=document.getElementById('workline'),style=getComputedStyle(workline),alert=rect(document.querySelector('.pf-v20-alert')),quiet=rect(document.getElementById('pf-quiet-toggle')),cards=[...document.querySelectorAll('#workline .pf-ritual-slot[data-v19-ritual="true"]')].map(rect);const overlap=(a,b)=>a&&b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;return{horizontal:document.documentElement.scrollWidth<=innerWidth+1,columns:style.gridTemplateColumns.split(' ').filter(Boolean).length,cards:cards.length,minCard:Math.min(...cards.map(item=>item.width)),alert,quiet,overlap:overlap(alert,quiet),density:document.documentElement.dataset.pf21Density};});
    assert(mobileTop.horizontal&&mobileTop.columns===3&&mobileTop.cards===6&&mobileTop.minCard>95&&!mobileTop.overlap&&mobileTop.alert.right<=390&&mobileTop.quiet.right<=390&&mobileTop.density==='compact',`Mobile top surface is not compact or aligned: ${JSON.stringify(mobileTop)}`);
    await mobile.locator('[data-pf-note-body]').scrollIntoViewIfNeeded();
    const mobileState=await mobile.evaluate(()=>{const calendar=document.getElementById('pf21-note-calendar').getBoundingClientRect(),composer=document.querySelector('[data-pf-note-body]').getBoundingClientRect(),tabs=document.querySelector('.pf-notebook-tabs');return{horizontal:document.documentElement.scrollWidth<=innerWidth+1,calendar:calendar.width,calendarHeight:calendar.height,composer:composer.width,inView:composer.top>=0&&composer.bottom<=innerHeight,scroll:document.documentElement.scrollHeight>innerHeight,tabsScrollable:tabs.scrollWidth>=tabs.clientWidth};});
    assert(mobileState.horizontal&&mobileState.calendar<=390&&mobileState.calendarHeight<220&&mobileState.composer>250&&mobileState.inView&&mobileState.scroll&&mobileState.tabsScrollable,`Mobile notebook refinement failed: ${JSON.stringify(mobileState)}`);await mobile.screenshot({path:path.join(artifacts,'pacefold-v21-1-mobile.png'),fullPage:true});await mobileContext.close();assert(errors.length===0,`Pacefold 21.1 errors: ${errors.join(' | ')}`);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}

async function main(){staticAudit();if(process.env.PACEFOLD_STATIC_ONLY==='1')return console.log('Pacefold 21.1 static audit passed.');await browserAudit();console.log('Pacefold 21.1 browser audit passed.');}
main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
