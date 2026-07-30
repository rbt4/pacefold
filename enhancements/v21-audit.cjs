'use strict';
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const RELEASE='21.3.1';
const REFINEMENT='21.3.1';
const REVISION='dayflow-r2';
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
  const precisionRuntime=read(path.join(app,'pacefold-v21-precision.js'));
  const minimalCss=read(path.join(app,'pacefold-v21-minimal.css'));
  const dayflowCss=read(path.join(app,'pacefold-v21-dayflow.css'));
  const html=read(path.join(app,'index.html'));
  const landing=read(path.join(site,'index.html'));
  const worker=read(path.join(site,'service-worker.js'));
  const escaped=RELEASE.replace(/\./g,'\\.');
  assert(read(path.join(site,'pacefold-experience.txt')).trim()===RELEASE,'Pacefold 21.3 experience version is missing');
  assert(!/\.innerHTML\s*=|style\s*=\s*["']/.test(runtime+boot+persistence+refineRuntime+precisionRuntime),'Unsafe Pacefold DOM construction found');
  const counts={'data-pacefold-v21':2,'data-pacefold-v21-compat':1,'data-pacefold-v21-boot':1,'data-pacefold-v21-persistence':1,'data-pacefold-v21-refine':2,'data-pacefold-v21-precision':2,'data-pacefold-v21-minimal':1,'data-pacefold-v21-dayflow':1};
  for(const [name,count] of Object.entries(counts))assert((html.match(new RegExp(`${name}="${escaped}"`,'g'))||[]).length===count,`${name} injection count is wrong`);
  assert(html.includes(`pacefold-experience" content="${RELEASE}`)&&landing.includes('Pacefold 21 · one protected workday folio'),'Pacefold public markers are stale');
  for(const token of ['pf21-dayline','pf21-note-calendar','pf21-settings','pacefold.v21.preferences.v1',"document.body?.dataset.quiet==='true'"])assert(runtime.includes(token),`Missing runtime token ${token}`);
  assert(persistence.includes('pacefold.v21.settings.v1'),'Extension settings store is missing');
  assert(compat.includes('width:100%!important')&&compat.includes('opacity:0!important'),'Legacy geometry compatibility is missing');
  for(const token of ['.pf21-dayline','.pf21-note-calendar','#panel #pf21-settings','.pf21-ribbon-key-now'])assert(css.includes(token),`Missing CSS token ${token}`);
  for(const token of ['pf-v21-1-active','grid-template-columns:repeat(3','data-note-level','.pf-v20-alert'])assert(refineCss.includes(token),`Missing refinement CSS token ${token}`);
  for(const token of [`const RELEASE='${REFINEMENT}'`,'__PACEFOLD_V21_REFINEMENT__','patchStoredVersion','refineCalendar'])assert(refineRuntime.includes(token),`Missing refinement runtime token ${token}`);
  for(const token of [`const EXPERIENCE='${RELEASE}'`,`const RELEASE='${RELEASE}'`,`const REVISION='${REVISION}'`,'pacefold.dayflow.v1','__PACEFOLD_DAYFLOW__','pf21-daybook','toggleFocus'])assert(precisionRuntime.includes(token),`Missing Dayflow runtime token ${token}`);
  for(const token of ['--pf22-surface','pf-v21-minimal-active','.pf21-brand-subline','.pf21-note-calendar','#workline'])assert(minimalCss.includes(token),`Missing minimal CSS token ${token}`);
  for(const token of ['pf21-dayflow','pf21-daybook','pf21-analytics-ring','pf21-build-status'])assert(dayflowCss.includes(token),`Missing Dayflow CSS token ${token}`);
  for(const asset of ['pacefold-v21.css','pacefold-v21-compat.css','pacefold-v21-boot.js','pacefold-v21.js','pacefold-v21-persistence.js','pacefold-v21-refine.css','pacefold-v21-refine.js','pacefold-v21-precision.css','pacefold-v21-precision.js','pacefold-v21-minimal.css','pacefold-v21-dayflow.css'])assert(worker.includes(asset),`Offline worker omits ${asset}`);
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
    localStorage.removeItem('pacefold.dayflow.v1');
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
    await page.waitForFunction(()=>document.querySelectorAll('.pf21-calendar-day').length===42&&document.getElementById('pf21-settings')&&document.getElementById('pf21-dayflow')&&document.getElementById('pf21-daybook')&&window.__PACEFOLD_DAYFLOW__,null,{timeout:30000});
    const initial=await page.evaluate(()=>{
      const rect=node=>node?.getBoundingClientRect();const statusNode=document.getElementById('statusLine'),statusStyle=getComputedStyle(statusNode),folio=rect(document.querySelector('.pf-v20-folio')),dayflow=rect(document.getElementById('pf21-dayflow')),daybook=rect(document.getElementById('pf21-daybook')),legacy=document.querySelector('#pf-local-workspace>:not(#pf21-daybook)'),legacyStyle=legacy&&getComputedStyle(legacy),settings=document.getElementById('pf21-settings');
      return{release:document.documentElement.dataset.pacefoldExperience,revision:document.documentElement.dataset.pacefoldDayflow,precision:window.__PACEFOLD_V21_PRECISION__,dayflowApi:window.__PACEFOLD_DAYFLOW__,runtime:window.__PACEFOLD_V21__,persistence:window.__PACEFOLD_V21_PERSISTENCE__,boot:window.__PACEFOLD_V21_BOOT__,events:window.__PACEFOLD_DAYFLOW__.events().length,brand:document.querySelector('.pf21-brand-subline')?.textContent,language:document.documentElement.lang,cjk:/[\u3040-\u30ff\u3400-\u9fff]/.test(document.body.innerText),version:settings.querySelector('.pf21-settings-version')?.textContent,build:settings.querySelector('.pf21-version-detail')?.textContent,dayflow:dayflow&&{width:dayflow.width,height:dayflow.height},daybook:daybook&&{width:daybook.width,height:daybook.height},legacyDisplay:legacyStyle?.display,analytics:Boolean(document.querySelector('.pf21-analytics-ring')),tabs:document.querySelectorAll('.pf21-daybook-tab').length,status:{...rect(statusNode).toJSON(),opacity:Number(statusStyle.opacity),pointer:statusStyle.pointerEvents},folio:folio&&{width:folio.width},horizontal:document.documentElement.scrollWidth<=innerWidth+1};
    });
    assert(initial.release===RELEASE&&initial.revision===REVISION&&initial.precision?.experience===RELEASE&&initial.dayflowApi?.release===RELEASE&&initial.runtime?.release===RELEASE&&initial.persistence?.release===RELEASE&&initial.boot?.returning,`Release setup failed: ${JSON.stringify(initial)}`);
    assert(initial.language==='en'&&!initial.cjk&&/Focus · rhythm · flow/.test(initial.brand||''),`English-only identity failed: ${JSON.stringify(initial)}`);
    assert(initial.events>=1&&initial.dayflow?.height>150&&initial.daybook?.height>360&&initial.analytics&&initial.tabs===4&&initial.legacyDisplay==='none',`Dayflow/Daybook did not replace the old surface: ${JSON.stringify(initial)}`);
    assert(initial.version===`v${RELEASE}`&&initial.build==='Offline ready'&&initial.status.height<=1&&initial.status.opacity===0&&initial.status.pointer==='none'&&initial.folio.width<=1180&&initial.horizontal,`Desktop geometry/settings failed: ${JSON.stringify(initial)}`);

    await page.locator('#pf21-focus-toggle').click();
    await page.waitForFunction(()=>document.getElementById('pf21-focus-toggle')?.dataset.active==='true'&&window.__PACEFOLD_DAYFLOW__.events().some(item=>item.type==='focus'&&!item.end));
    await page.locator('#pf21-focus-toggle').click();
    await page.waitForFunction(()=>document.getElementById('pf21-focus-toggle')?.dataset.active==='false'&&window.__PACEFOLD_DAYFLOW__.events().some(item=>item.type==='focus'&&item.end));

    await page.locator('#pf-day-type').click();
    await page.waitForFunction(()=>document.body.dataset.dayType==='field'&&window.__PACEFOLD_DAYFLOW__.events().some(item=>item.type==='field'&&!item.end));
    await page.locator('#pf-day-type').click();
    await page.waitForFunction(()=>document.body.dataset.dayType!=='field'&&window.__PACEFOLD_DAYFLOW__.events().some(item=>item.type==='field'&&item.end)&&window.__PACEFOLD_DAYFLOW__.events().some(item=>item.type==='return'));

    const beforeNotes=await page.evaluate(()=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').length);
    await page.locator('#pf21-daybook-compose').fill('Dayflow audit note');
    await page.locator('.pf21-daybook-save').click();
    await page.waitForFunction(before=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').length===before+1&&window.__PACEFOLD_DAYFLOW__.events().some(item=>item.type==='note'&&/Dayflow audit note/.test(item.detail||'')),beforeNotes);
    await page.locator('.pf21-daybook-tab[data-tab="notes"]').click();
    await page.waitForFunction(()=>document.querySelector('.pf21-daybook-tab[data-tab="notes"]')?.dataset.active==='true'&&document.body.innerText.includes('Dayflow audit note'));
    await page.locator('.pf21-daybook-tab[data-tab="insights"]').click();
    assert(await page.locator('.pf21-week-bars').count()===1,'Seven-day insights are missing');

    await page.locator('#brandButton').click();await page.waitForFunction(()=>document.getElementById('panel').classList.contains('on'));
    const essentials=await page.evaluate(()=>{const settings=document.getElementById('pf21-settings').getBoundingClientRect();return{height:settings.height,rows:document.querySelectorAll('.pf21-setting-switch').length,label:document.querySelector('.pf21-more-settings')?.textContent,build:Boolean(document.querySelector('.pf21-build-status'))};});
    assert(essentials.height<560&&essentials.rows===6&&essentials.label==='Settings'&&essentials.build,`Settings footer is still unclear: ${JSON.stringify(essentials)}`);
    await page.locator('[data-pf21-pref="v21WeatherEnabled"]').uncheck();await page.waitForFunction(()=>getComputedStyle(document.getElementById('pf-v19-weather')).display==='none');
    await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__PACEFOLD_DAYFLOW__&&document.getElementById('pf21-daybook'));
    const persisted=await page.evaluate(()=>({weather:window.__PACEFOLD_V21_PERSISTENCE__.read().v21WeatherEnabled,display:getComputedStyle(document.getElementById('pf-v19-weather')).display,events:window.__PACEFOLD_DAYFLOW__.events().length,snapshot:JSON.parse(localStorage.getItem('pacefold.v21.preferences.v1')||'null'),extension:JSON.parse(localStorage.getItem('pacefold.v21.settings.v1')||'null')}));
    assert(persisted.weather===false&&persisted.display==='none'&&persisted.events>=5&&persisted.snapshot?.version===RELEASE&&persisted.extension?.version===RELEASE,`Persistence failed: ${JSON.stringify(persisted)}`);
    await page.screenshot({path:path.join(artifacts,'pacefold-v21-3-dayflow-desktop.png'),fullPage:true});assert(errors.length===0,`Desktop errors: ${errors.join(' | ')}`);await context.close();

    const mobileContext=await contextFor(browser,{width:390,height:844});const mobile=await mobileContext.newPage();mobile.on('pageerror',error=>errors.push(error.message));await mobile.goto(`${base}/app/`,{waitUntil:'networkidle'});await mobile.waitForFunction(()=>window.__PACEFOLD_DAYFLOW__&&document.getElementById('pf21-daybook'));
    const mobileTop=await mobile.evaluate(()=>{const rect=node=>node?.getBoundingClientRect(),workline=document.getElementById('workline'),style=getComputedStyle(workline),cards=[...document.querySelectorAll('#workline .pf-ritual-slot[data-v19-ritual="true"]')].map(rect),flow=rect(document.getElementById('pf21-dayflow')),daybook=rect(document.getElementById('pf21-daybook')),bodyStyle=getComputedStyle(document.querySelector('.pf21-daybook-body'));return{horizontal:document.documentElement.scrollWidth<=innerWidth+1,columns:style.gridTemplateColumns.split(' ').filter(Boolean).length,cards:cards.length,minCard:Math.min(...cards.map(item=>item.width)),flow:flow&&{width:flow.width},daybook:daybook&&{width:daybook.width},daybookColumns:bodyStyle.gridTemplateColumns.split(' ').filter(Boolean).length,composer:rect(document.getElementById('pf21-daybook-compose'))?.width,statsColumns:getComputedStyle(document.querySelector('.pf21-flow-stats')).gridTemplateColumns.split(' ').filter(Boolean).length};});
    assert(mobileTop.horizontal&&mobileTop.columns===3&&mobileTop.cards===6&&mobileTop.minCard>95&&mobileTop.flow.width<=390&&mobileTop.daybook.width<=390&&mobileTop.daybookColumns===1&&mobileTop.composer>300&&mobileTop.statsColumns===3,`Mobile Dayflow is clipped or misaligned: ${JSON.stringify(mobileTop)}`);
    const mobileComposition=await mobile.evaluate(()=>{const quiet=document.getElementById('pf-quiet-toggle').getBoundingClientRect(),book=document.getElementById('pf21-daybook').getBoundingClientRect();return{quiet:{top:quiet.top,right:quiet.right},bookHeight:book.height,pageHeight:document.documentElement.scrollHeight,viewport:innerWidth};});
    assert(mobileComposition.quiet.top>=8&&mobileComposition.quiet.top<=34&&mobileComposition.quiet.right<=mobileComposition.viewport-8&&mobileComposition.bookHeight<650&&mobileComposition.pageHeight<1850,`Mobile composition still contains drift or an empty sheet: ${JSON.stringify(mobileComposition)}`);
    await mobile.locator('#pf21-daybook-compose').scrollIntoViewIfNeeded();
    await mobile.screenshot({path:path.join(artifacts,'pacefold-v21-3-dayflow-mobile.png'),fullPage:true});await mobileContext.close();assert(errors.length===0,`Pacefold 21.3 errors: ${errors.join(' | ')}`);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}

async function main(){staticAudit();if(process.env.PACEFOLD_STATIC_ONLY==='1')return console.log('Pacefold 21.3 static audit passed.');await browserAudit();console.log('Pacefold 21.3 Dayflow browser audit passed.');}
main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
