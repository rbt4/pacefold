'use strict';

const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const site=path.resolve(process.argv[2]||'_site');
const artifacts=path.resolve(process.argv[3]||path.join(process.cwd(),'v21-audit-artifacts'));
const app=path.join(site,'app');
const read=file=>fs.readFileSync(file,'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

function staticAudit(){
  const boot=read(path.join(app,'pacefold-v21-boot.js'));
  const runtime=read(path.join(app,'pacefold-v21.js'));
  const css=read(path.join(app,'pacefold-v21.css'));
  const html=read(path.join(app,'index.html'));
  const landing=read(path.join(site,'index.html'));
  const worker=read(path.join(site,'service-worker.js'));
  const version=read(path.join(site,'pacefold-experience.txt')).trim();

  assert(version==='21.0.0',`Experience marker is ${version}`);
  assert(!/\.innerHTML\s*=/.test(boot+runtime),'V21 runtime contains a raw innerHTML assignment');
  assert(!/style\s*=\s*["']/.test(boot+runtime),'V21 runtime contains an inline style string');
  assert((html.match(/data-pacefold-v21="21\.0\.0"/g)||[]).length===2,'V21 CSS/runtime tags are not exact');
  assert((html.match(/data-pacefold-v21-boot="21\.0\.0"/g)||[]).length===1,'V21 boot tag is not exact');
  assert(html.includes('name="pacefold-experience" content="21.0.0"'),'V21 app experience marker is missing');
  assert(landing.includes('name="pacefold-experience" content="21.0.0"')&&landing.includes('Pacefold 21 · one protected workday folio'),'V21 landing marker/copy is missing');
  for(const asset of ['pacefold-v21.css','pacefold-v21-boot.js','pacefold-v21.js'])assert(worker.includes(asset),`Offline shell omits ${asset}`);
  for(const token of ['pf21-dayline','pf21-note-calendar','pf21-settings','pacefold.v21.preferences.v1','suppressDuplicateSetup','noteCounts'])assert(runtime.includes(token),`V21 runtime token missing: ${token}`);
  for(const token of ['.pf21-dayline','.pf21-note-calendar','#panel #pf21-settings','data-pf21-advanced','pf-ribbon-key-now'])assert(css.includes(token),`V21 CSS token missing: ${token}`);
}

function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((request,response)=>{
      let pathname='/';
      try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}catch{}
      let file=path.join(site,pathname.replace(/^\/+/,''));
      if(pathname.endsWith('/'))file=path.join(file,'index.html');
      if(!file.startsWith(site)){response.writeHead(403);response.end();return;}
      fs.readFile(file,(error,buffer)=>{
        if(error){response.writeHead(404);response.end('Not found');return;}
        const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
        response.writeHead(200,{'content-type':type,'cache-control':'no-store'});
        response.end(buffer);
      });
    });
    server.listen(0,'127.0.0.1',()=>resolve(server));
  });
}

function dateKey(offset=0){
  const date=new Date();
  date.setDate(date.getDate()+offset);
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10);
}

function initialPrefs(){
  const day=dateKey();
  return{
    profile:'original',schemaVersion:18,theme:'paper',privacy:false,clarity:'discreet',
    workdaysOnly:false,workHours:'08:30-16:30',workReminders:true,showWorkline:true,
    notifications:true,notificationMode:'quiet',taskbarBadge:true,taskbarBadgeMode:'due',
    dayCloseEnabled:false,activityDate:day,waterDate:day,lat:43.6532,lng:-79.3832,
    locationLabel:'Toronto',waterTarget:24,sipCadence:30,waterSips:2,
    gazeEnabled:true,bodyEnabled:true,v21WeatherEnabled:true,waferPromptDismissed:true,
    workWeek:{
      0:{start:'08:30',end:'16:30',type:'off'},1:{start:'08:30',end:'16:30',type:'desk'},
      2:{start:'08:30',end:'16:30',type:'desk'},3:{start:'08:30',end:'16:30',type:'desk'},
      4:{start:'08:30',end:'16:30',type:'desk'},5:{start:'08:30',end:'16:30',type:'desk'},
      6:{start:'08:30',end:'16:30',type:'off'}
    }
  };
}

function initialNotes(){
  const now=new Date();
  const yesterday=new Date(now.getTime()-86400000);
  return[
    {id:`v21-${dateKey()}-a`,body:'V21 calendar note one',category:'Daily',createdAt:now.toISOString(),updatedAt:now.toISOString()},
    {id:`v21-${dateKey()}-b`,body:'V21 calendar note two',category:'Follow-ups',createdAt:now.toISOString(),updatedAt:now.toISOString()},
    {id:`v21-${dateKey(-1)}-c`,body:'V21 prior day note',category:'Daily',createdAt:yesterday.toISOString(),updatedAt:yesterday.toISOString()}
  ];
}

function weatherPayload(){
  const now=new Date();
  const isoHour=new Date(now.getFullYear(),now.getMonth(),now.getDate(),now.getHours()).toISOString().slice(0,13)+':00';
  const days=[0,1,2].map(offset=>dateKey(offset));
  return{
    current:{temperature_2m:25.1,apparent_temperature:23.4,weather_code:0,is_day:1,precipitation:0,rain:0},
    hourly:{time:[isoHour,isoHour,isoHour,isoHour],temperature_2m:[25,25,24,23],precipitation_probability:[0,0,10,10],weather_code:[0,0,1,1]},
    daily:{time:days,weather_code:[0,1,2],temperature_2m_max:[26,27,30],temperature_2m_min:[17,15,15],precipitation_probability_max:[0,0,3]}
  };
}

async function prepareContext(browser,viewport){
  const context=await browser.newContext({viewport});
  await context.addInitScript(({prefs,notes})=>{
    localStorage.removeItem('pacefoldOnboardedV15');
    localStorage.removeItem('pacefoldSetupDismissedV15');
    localStorage.setItem('pacefoldPrefsV15',JSON.stringify(prefs));
    localStorage.setItem('pacefold.notebook.entries.v2',JSON.stringify(notes));
  },{prefs:initialPrefs(),notes:initialNotes()});
  await context.route('**/api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(weatherPayload())}));
  return context;
}

async function browserAudit(){
  fs.mkdirSync(artifacts,{recursive:true});
  const server=await serve();
  const port=server.address().port;
  const base=`http://127.0.0.1:${port}`;
  const browser=await chromium.launch({headless:true});
  const errors=[];

  try{
    const context=await prepareContext(browser,{width:1180,height:920});
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&!/ERR_INTERNET_DISCONNECTED/.test(message.text()))errors.push(message.text());});
    await page.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__PACEFOLD_V21__?.release==='21.0.0'&&document.getElementById('pf21-dayline')&&document.getElementById('pf21-note-calendar')&&document.getElementById('pf21-settings'));
    await page.waitForFunction(()=>document.getElementById('pf-v19-weather')?.dataset.ready==='true');

    const initial=await page.evaluate(()=>{
      const dayline=document.getElementById('pf21-dayline');
      const calendar=document.getElementById('pf21-note-calendar');
      const now=document.querySelector('#sequence .pf-ribbon-now');
      const crease=document.querySelector('#sequence .pf-ribbon-crease');
      const panel=document.getElementById('panel');
      const status=document.getElementById('statusLine');
      const noteCounts=window.__PACEFOLD_V21__.noteCounts();
      return{
        release:document.documentElement.dataset.pacefoldExperience,
        bodyRelease:document.body.dataset.pacefoldExperience,
        boot:window.__PACEFOLD_V21_BOOT__,
        flags:[localStorage.getItem('pacefoldOnboardedV15'),localStorage.getItem('pacefoldSetupDismissedV15')],
        onboarding:[...document.querySelectorAll('#onboarding,.onboarding')].map(node=>({hidden:node.hidden,display:getComputedStyle(node).display})),
        dayline:{text:dayline.textContent,rect:dayline.getBoundingClientRect().toJSON()},
        calendar:{days:calendar.querySelectorAll('.pf21-calendar-day').length,noted:calendar.querySelectorAll('[data-has-notes="true"]').length,stats:calendar.querySelector('.pf21-calendar-stats')?.textContent},
        counts:noteCounts,
        ribbon:{meta:Boolean(document.getElementById('pf21-ribbon-meta')),now:now?{w:now.getBoundingClientRect().width,h:now.getBoundingClientRect().height}:null,crease:crease?{w:crease.getBoundingClientRect().width,h:crease.getBoundingClientRect().height}:null},
        settings:{switches:panel.querySelectorAll('[data-pf21-pref]').length,advanced:panel.dataset.pf21Advanced,legacy:panel.querySelectorAll('[data-settings-view]').length},
        status:{width:status.getBoundingClientRect().width,height:status.getBoundingClientRect().height},
        horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth+1
      };
    });

    assert(initial.release==='21.0.0'&&initial.bodyRelease==='21.0.0',`V21 release markers are wrong: ${JSON.stringify(initial)}`);
    assert(initial.boot?.returning&&initial.flags.every(value=>value==='1')&&initial.onboarding.every(item=>item.hidden||item.display==='none'),`Returning setup was not preserved: ${JSON.stringify(initial)}`);
    assert(initial.dayline.text&&!/scheduled moment/i.test(initial.dayline.text)&&initial.dayline.rect.height>=40,`Dayline is vague or collapsed: ${JSON.stringify(initial.dayline)}`);
    assert(initial.calendar.days===42&&initial.calendar.noted>=2&&/3 notes/.test(initial.calendar.stats),`Notebook activity calendar is incomplete: ${JSON.stringify(initial.calendar)}`);
    assert(initial.counts[dateKey()]===2&&initial.counts[dateKey(-1)]===1,`Note activity counts are wrong: ${JSON.stringify(initial.counts)}`);
    assert(initial.ribbon.meta&&initial.ribbon.now?.h>initial.ribbon.crease?.h&&initial.ribbon.now?.w<initial.ribbon.crease?.w,`Timeline markers are not distinguishable: ${JSON.stringify(initial.ribbon)}`);
    assert(initial.settings.switches===6&&initial.settings.advanced==='false'&&initial.settings.legacy===4,`Simple settings did not preserve the advanced system: ${JSON.stringify(initial.settings)}`);
    assert(initial.status.width<=2&&initial.status.height<=2&&initial.horizontal,`Legacy status or horizontal layout is leaking: ${JSON.stringify(initial)}`);

    await page.locator('#brandButton').click();
    await page.waitForFunction(()=>document.getElementById('panel').classList.contains('on'));
    const settings=await page.evaluate(()=>({
      switches:document.querySelectorAll('#pf21-settings [data-pf21-pref]').length,
      legacyVisible:[...document.querySelectorAll('#panel [data-settings-view]')].filter(node=>getComputedStyle(node).display!=='none').length,
      copy:document.getElementById('pf21-settings')?.textContent
    }));
    assert(settings.switches===6&&settings.legacyVisible===0&&/survive updates/i.test(settings.copy),`Essential settings are not the default: ${JSON.stringify(settings)}`);

    await page.locator('#pf21-settings [data-pf21-pref="v21WeatherEnabled"]').uncheck();
    await page.waitForFunction(()=>getComputedStyle(document.getElementById('pf-v19-weather')).display==='none');
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__PACEFOLD_V21__?.release==='21.0.0'&&document.getElementById('pf21-note-calendar'));
    const persisted=await page.evaluate(()=>({
      weather:JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}').v21WeatherEnabled,
      display:getComputedStyle(document.getElementById('pf-v19-weather')).display,
      flags:[localStorage.getItem('pacefoldOnboardedV15'),localStorage.getItem('pacefoldSetupDismissedV15')],
      snapshot:Boolean(JSON.parse(localStorage.getItem('pacefold.v21.preferences.v1')||'null')?.prefs)
    }));
    assert(persisted.weather===false&&persisted.display==='none'&&persisted.flags.every(value=>value==='1')&&persisted.snapshot,`Settings did not survive reload/update boot: ${JSON.stringify(persisted)}`);

    const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').length);
    await page.locator('[data-pf-note-body]').fill('V21 newly saved note');
    await page.locator('[data-pf-note-save]').click();
    await page.waitForFunction(count=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').length>count,before);
    await page.waitForFunction(()=>/4 notes/.test(document.querySelector('.pf21-calendar-stats')?.textContent||''));

    await page.locator('#brandButton').click();
    await page.waitForFunction(()=>document.getElementById('panel').classList.contains('on'));
    await page.locator('.pf21-more-settings').click();
    const advanced=await page.evaluate(()=>({
      state:document.getElementById('panel').dataset.pf21Advanced,
      legacyVisible:[...document.querySelectorAll('#panel [data-settings-view]')].filter(node=>getComputedStyle(node).display!=='none').length
    }));
    assert(advanced.state==='true'&&advanced.legacyVisible>0,`Advanced settings are not reachable: ${JSON.stringify(advanced)}`);

    await page.screenshot({path:path.join(artifacts,'pacefold-v21-desktop.png'),fullPage:true});
    assert(errors.length===0,`Desktop V21 emitted browser errors: ${errors.join(' | ')}`);
    await context.close();

    const mobileContext=await prepareContext(browser,{width:390,height:844});
    const mobile=await mobileContext.newPage();
    mobile.on('pageerror',error=>errors.push(error.message));
    await mobile.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await mobile.waitForFunction(()=>window.__PACEFOLD_V21__?.release==='21.0.0'&&document.getElementById('pf21-note-calendar'));
    await mobile.locator('[data-pf-note-body]').scrollIntoViewIfNeeded();
    const mobileState=await mobile.evaluate(()=>{
      const calendar=document.getElementById('pf21-note-calendar').getBoundingClientRect();
      const composer=document.querySelector('[data-pf-note-body]').getBoundingClientRect();
      return{
        horizontal:document.documentElement.scrollWidth<=innerWidth+1,
        calendarWidth:calendar.width,
        composerWidth:composer.width,
        composerInView:composer.top>=0&&composer.bottom<=innerHeight,
        scroll:document.documentElement.scrollHeight>innerHeight
      };
    });
    assert(mobileState.horizontal&&mobileState.calendarWidth<=390&&mobileState.composerWidth>250&&mobileState.composerInView&&mobileState.scroll,`Mobile V21 is clipped: ${JSON.stringify(mobileState)}`);
    await mobile.screenshot({path:path.join(artifacts,'pacefold-v21-mobile.png'),fullPage:true});
    await mobileContext.close();
    assert(errors.length===0,`V21 emitted browser errors: ${errors.join(' | ')}`);
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}

async function main(){
  staticAudit();
  if(process.env.PACEFOLD_STATIC_ONLY==='1'){
    console.log('Pacefold 21 static audit passed.');
    return;
  }
  await browserAudit();
  console.log('Pacefold 21 browser audit passed: focused dayline, distinct timeline, notebook activity calendar, simple settings and persistent setup.');
}

main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
