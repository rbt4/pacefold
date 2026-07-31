'use strict';

const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const RELEASE='22.0.2';
const REVISION='day-unfold-r1';
const site=path.resolve(process.argv[2]||'_site');
const artifacts=path.resolve(process.argv[3]||'/tmp/pacefold-v22-daylight-artifacts');
const app=path.join(site,'app');
const read=file=>fs.readFileSync(file,'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

function staticAudit(){
  const html=read(path.join(app,'index.html'));
  const worker=read(path.join(site,'service-worker.js'));
  const ma=read(path.join(app,'pacefold-ma.js'));
  const hardening=read(path.join(app,'pacefold-v22-hardening.js'));
  const runtime=read(path.join(app,'pacefold-v22-daylight.js'));
  const css=read(path.join(app,'pacefold-v22-daylight.css'));
  const boot=read(path.join(app,'pacefold-v22-boot.css'));
  const settings=read(path.join(app,'pacefold-v22-daylight-settings.css'));
  const headStart=html.indexOf('<head>');
  const bootLink=html.indexOf('data-pacefold-v22-boot');
  const firstLegacyStyle=html.indexOf('rel="stylesheet"',headStart);
  assert(read(path.join(site,'pacefold-experience.txt')).trim()===RELEASE,'Experience marker is stale');
  assert(read(path.join(site,'pacefold-daylight.txt')).trim()===`${RELEASE} ${RELEASE}`,'Daylight marker is stale');
  assert(headStart>=0&&bootLink>headStart&&firstLegacyStyle===html.lastIndexOf('rel="stylesheet"',bootLink),'The no-flash stylesheet is not first');
  assert(html.includes(`<meta name="pacefold-experience" content="${RELEASE}">`),'Experience meta is stale');
  for(const asset of ['pacefold-v22-boot.css','pacefold-v22-daylight.css','pacefold-v22-daylight-settings.css','pacefold-v22-daylight.js']){
    assert(html.includes(asset),`App HTML omits ${asset}`);
    assert(worker.includes(asset),`Offline shell omits ${asset}`);
  }
  assert(worker.includes('revision:22.0.2'),'Offline cache revision is stale');
  assert(hardening.includes(`const RELEASE='${RELEASE}'`),'Hardening runtime was not advanced');
  assert(!ma.includes("prefs.quietMode||prefs.taskbarBadge===false"),'Quiet still clears manual taskbar badges');
  assert(!ma.includes("quietMode:true,quietRestore:restore,privacy:true,clarity:'discreet',notificationDetail:'generic',taskbarBadge:false"),'Quiet still switches taskbar cues off');
  for(const token of [`const RELEASE='${RELEASE}'`,`const REVISION='${REVISION}'`,'buildDayUnfold','renderMarkers','renderSessions','renderFavicon','renderBadge','Taskbar cue dots'])assert(runtime.includes(token),`Daylight runtime token missing: ${token}`);
  for(const token of ['.pf22-day-unfold','.pf22-day-sun','.pf22-day-arc-spent','.pf22-cue-dot[data-source="water"]','.pf22-cue-dot[data-source="prayer"]'])assert(css.includes(token),`Daylight visual token missing: ${token}`);
  for(const token of ['data-pacefold-spatial="pending"','pf22-boot-breathe'])assert(boot.includes(token),`Boot visual token missing: ${token}`);
  assert(settings.includes('.pf22-daylight-toggle')&&settings.includes('.pf22-cue-legend'),'Taskbar cue setting styles are incomplete');
  assert(!/\.innerHTML\s*=|style\s*=\s*["']/.test(runtime),'Unsafe daylight DOM construction found');
}

function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((request,response)=>{
      let pathname='/';
      try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname)}catch{}
      let file=path.join(site,pathname.replace(/^\/+/,''));
      if(pathname.endsWith('/'))file=path.join(file,'index.html');
      if(!file.startsWith(site)){response.writeHead(403);response.end();return}
      fs.readFile(file,(error,buffer)=>{
        if(error){response.writeHead(404);response.end();return}
        const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
        response.writeHead(200,{'content-type':type,'cache-control':'no-store'});response.end(buffer);
      });
    });
    server.listen(0,'127.0.0.1',()=>resolve(server));
  });
}

async function contextFor(browser,viewport){
  const context=await browser.newContext({viewport});
  await context.addInitScript(()=>{
    const pad=value=>String(value).padStart(2,'0');
    const time=value=>`${pad(value.getHours())}:${pad(value.getMinutes())}`;
    const now=new Date(),start=new Date(now.getTime()-4*60*60*1000),end=new Date(now.getTime()+4*60*60*1000);
    const week={};for(let day=0;day<7;day++)week[day]={start:time(start),end:time(end),type:'desk'};
    const prefs={
      profile:'original',schemaVersion:18,theme:'paper',privacy:false,quietMode:false,timeFormat:'12',showSeconds:true,
      workHours:`${time(start)}-${time(end)}`,workWeek:week,workdaysOnly:false,workReminders:true,gazeEnabled:true,bodyEnabled:true,
      notifications:true,browserNotif:false,notificationMode:'quiet',taskbarBadge:true,taskbarBadgeMode:'due',locationLabel:'Toronto',
      lat:43.6532,lng:-79.3832,waterTarget:24,sipCadence:30,waterSips:2,v21WeatherEnabled:true,waferPromptDismissed:true,
      activityDate:new Date(now-now.getTimezoneOffset()*60000).toISOString().slice(0,10),waterDate:new Date(now-now.getTimezoneOffset()*60000).toISOString().slice(0,10)
    };
    localStorage.setItem('pacefoldPrefsV15',JSON.stringify(prefs));
    localStorage.setItem('pacefoldOnboardedV15','1');
    localStorage.setItem('pacefoldSetupDismissedV15','1');
    localStorage.setItem('pacefold.notebook.entries.v2','[]');
    window.__pacefoldBadgeCalls=[];
    window.__pacefoldBadgeClears=0;
    Object.defineProperty(Navigator.prototype,'setAppBadge',{configurable:true,value:function(value){window.__pacefoldBadgeCalls.push(value===undefined?'dot':value);return Promise.resolve()}});
    Object.defineProperty(Navigator.prototype,'clearAppBadge',{configurable:true,value:function(){window.__pacefoldBadgeClears+=1;return Promise.resolve()}});
  });
  await context.route('**/api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({current:{temperature_2m:23,apparent_temperature:22,weather_code:1,is_day:1,precipitation:0,rain:0},hourly:{time:[],temperature_2m:[],precipitation_probability:[],weather_code:[]},daily:{time:[],weather_code:[],temperature_2m_max:[],temperature_2m_min:[],precipitation_probability_max:[]}})}));
  return context;
}

async function wait(page,label,predicate,arg=null,timeout=12000){
  try{await page.waitForFunction(predicate,arg,{timeout})}
  catch{
    const state=await page.evaluate(()=>({
      spatial:window.__PACEFOLD_SPATIAL__,daylight:window.__PACEFOLD_DAYLIGHT__,experience:document.documentElement.dataset.pacefoldExperience,
      mode:document.getElementById('pf22-spatial-root')?.dataset.mode,phase:document.getElementById('pf22-spatial-root')?.dataset.dayPhase,
      dots:[...document.querySelectorAll('#pf22-cue-cluster .pf22-cue-dot')].map(node=>node.dataset.source),
      badgeCalls:window.__pacefoldBadgeCalls,quiet:window.__PACEFOLD_MA_CORE__?.getPrefs?.().quietMode,
      taskbar:window.__PACEFOLD_MA_CORE__?.getPrefs?.().taskbarBadge,taskbarMode:window.__PACEFOLD_MA_CORE__?.getPrefs?.().taskbarBadgeMode
    }));
    throw new Error(`${label} did not settle: ${JSON.stringify(state)}`);
  }
}

async function browserAudit(){
  fs.mkdirSync(artifacts,{recursive:true});
  const server=await serve(),base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true}),errors=[];
  try{
    const context=await contextFor(browser,{width:1180,height:920}),page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&!/ERR_INTERNET_DISCONNECTED/.test(message.text()))errors.push(message.text())});
    await page.goto(`${base}/app/`,{waitUntil:'domcontentloaded',timeout:30000});
    await wait(page,'Daylight startup',()=>window.__PACEFOLD_DAYLIGHT__?.release==='22.0.2'&&window.__PACEFOLD_HARDENING__?.release==='22.0.2'&&document.documentElement.dataset.pacefoldSpatial==='ready');
    await page.waitForTimeout(500);

    const initial=await page.evaluate(()=>{
      const root=document.getElementById('pf22-spatial-root'),day=document.getElementById('pf22-day-unfold'),sun=document.getElementById('pf22-day-sun'),spent=document.querySelector('.pf22-day-arc-spent');
      const firstStyle=document.head.querySelector('link[rel="stylesheet"]');
      const sr=sun?.getBoundingClientRect(),dr=day?.getBoundingClientRect();
      return{
        release:window.__PACEFOLD_DAYLIGHT__?.release,experience:document.documentElement.dataset.pacefoldExperience,
        firstBoot:firstStyle?.dataset.pacefoldV22Boot,mode:root?.dataset.mode,phase:root?.dataset.dayPhase,
        dayWidth:dr?.width,dayHeight:dr?.height,sunX:sr&&dr?sr.left+sr.width/2-dr.left:null,sunY:sr&&dr?sr.top+sr.height/2-dr.top:null,
        dash:parseFloat(getComputedStyle(spent).strokeDashoffset),start:day?.querySelector('.pf22-day-start')?.textContent,end:day?.querySelector('.pf22-day-end')?.textContent,
        legacy:getComputedStyle(document.querySelector('body>main')).display,scroll:document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1
      };
    });
    assert(initial.release===RELEASE&&initial.experience===RELEASE&&initial.firstBoot===RELEASE,`Daylight release/boot failed: ${JSON.stringify(initial)}`);
    assert(initial.mode==='home'&&initial.phase&&initial.dayWidth>520&&initial.dayHeight>80&&initial.sunX>150&&initial.sunX<550&&initial.sunY>0&&initial.sunY<100,`Sun arc geometry failed: ${JSON.stringify(initial)}`);
    assert(initial.dash>30&&initial.dash<70&&initial.start&&initial.end&&initial.legacy==='none'&&initial.scroll,`Day progress composition failed: ${JSON.stringify(initial)}`);

    await page.evaluate(()=>{
      const sequence=document.getElementById('sequence');
      const crease=document.createElement('button');crease.className='pf-ribbon-crease';crease.dataset.kind='prayer';crease.title='Dhuhr';crease.style.setProperty('--pf-ribbon-x','62%');
      const band=document.createElement('span');band.className='pf-ribbon-band';band.dataset.kind='away';band.style.setProperty('--pf-ribbon-start','28%');band.style.setProperty('--pf-ribbon-span','.18');
      sequence.append(crease,band);window.__PACEFOLD_DAYLIGHT__.refresh();
    });
    await wait(page,'Ribbon inheritance',()=>document.querySelectorAll('#pf22-day-events .pf22-day-event[data-kind="prayer"]').length===1&&document.querySelectorAll('#pf22-day-sessions .pf22-day-session[data-kind="away"]').length===1);

    await page.evaluate(()=>{
      window.__PACEFOLD_MA_CORE__.updatePrefs({waitingCue:{key:'audit-prayer',source:'prayer',requestedAt:Date.now(),expiresAt:Date.now()+600000,deferred:false},taskbarBadge:true,taskbarBadgeMode:'due',notifications:true,notificationMode:'quiet'});
      const water=document.getElementById('waterBtn')||document.getElementById('waterPill');if(water)water.classList.add('due');
      window.dispatchEvent(new CustomEvent('pacefold:ma-prefs'));window.__PACEFOLD_DAYLIGHT__.refresh();
    });
    await wait(page,'Source cue dots',()=>{const sources=[...document.querySelectorAll('#pf22-cue-cluster .pf22-cue-dot')].map(node=>node.dataset.source);return sources.includes('prayer')&&sources.includes('water')&&window.__pacefoldBadgeCalls.includes(2)});
    const cues=await page.evaluate(()=>({sources:[...document.querySelectorAll('#pf22-cue-cluster .pf22-cue-dot')].map(node=>({source:node.dataset.source,color:getComputedStyle(node).backgroundColor})),favicon:document.querySelector('link[rel~="icon"]')?.href,badgeCalls:window.__pacefoldBadgeCalls.slice()}));
    assert(cues.sources.some(item=>item.source==='water'&&/rgb\(95,\s*151,\s*189\)/.test(item.color)),`Water cue is not blue: ${JSON.stringify(cues)}`);
    assert(cues.sources.some(item=>item.source==='prayer'&&/rgb\(79,\s*138,\s*108\)/.test(item.color)),`Prayer cue is not green: ${JSON.stringify(cues)}`);
    assert(cues.favicon?.startsWith('data:image/png'),`Source favicon was not rendered: ${cues.favicon}`);
    await page.screenshot({path:path.join(artifacts,'pacefold-v22-day-unfold.png'),fullPage:false});

    await page.evaluate(()=>window.__PACEFOLD_MA_QUIET__.set(true));
    await wait(page,'Quiet cue persistence',()=>{const p=window.__PACEFOLD_MA_CORE__.getPrefs();const sources=[...document.querySelectorAll('#pf22-cue-cluster .pf22-cue-dot')].map(node=>node.dataset.source);return p.quietMode===true&&p.taskbarBadge===true&&p.taskbarBadgeMode==='due'&&sources.includes('water')&&sources.includes('prayer')});
    await page.screenshot({path:path.join(artifacts,'pacefold-v22-day-unfold-quiet.png'),fullPage:false});

    await page.evaluate(()=>{window.__PACEFOLD_MA_QUIET__.set(false);window.__PACEFOLD_SPATIAL__.go('settings')});
    await wait(page,'Taskbar cue setting',()=>document.getElementById('pf22-taskbar-cue-toggle')?.textContent==='On'&&document.querySelectorAll('.pf22-cue-legend .pf22-cue-dot').length===5);
    await page.locator('#pf22-taskbar-cue-toggle').click();
    await wait(page,'Taskbar cues off',()=>{const p=window.__PACEFOLD_MA_CORE__.getPrefs();return p.taskbarBadge===false&&p.taskbarBadgeMode==='off'&&document.getElementById('pf22-taskbar-cue-toggle')?.textContent==='Off'});
    await page.locator('#pf22-taskbar-cue-toggle').click();
    await wait(page,'Taskbar cues restored',()=>{const p=window.__PACEFOLD_MA_CORE__.getPrefs();return p.taskbarBadge===true&&p.taskbarBadgeMode==='due'&&document.getElementById('pf22-taskbar-cue-toggle')?.textContent==='On'});
    await page.screenshot({path:path.join(artifacts,'pacefold-v22-daylight-settings.png'),fullPage:false});
    await context.close();

    const mobile=await contextFor(browser,{width:430,height:850}),small=await mobile.newPage();
    small.on('pageerror',error=>errors.push(error.message));
    await small.goto(`${base}/app/`,{waitUntil:'domcontentloaded',timeout:30000});
    await wait(small,'Mobile daylight startup',()=>window.__PACEFOLD_DAYLIGHT__&&document.getElementById('pf22-day-unfold'));
    await small.waitForTimeout(350);
    const mobileGeometry=await small.evaluate(()=>{const root=document.getElementById('pf22-spatial-root').getBoundingClientRect(),day=document.getElementById('pf22-day-unfold').getBoundingClientRect();return{root:root.toJSON(),day:day.toJSON(),scroll:document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1}});
    assert(mobileGeometry.root.width<=430&&mobileGeometry.root.height<=850&&mobileGeometry.day.width<=400&&mobileGeometry.day.height>=70&&mobileGeometry.scroll,`Mobile Day Unfold geometry failed: ${JSON.stringify(mobileGeometry)}`);
    await small.screenshot({path:path.join(artifacts,'pacefold-v22-day-unfold-mobile.png'),fullPage:false});await mobile.close();
    assert(!errors.length,`Browser errors: ${errors.join(' | ')}`);
  }finally{
    await browser.close();await new Promise(resolve=>server.close(resolve));
  }
}

(async()=>{staticAudit();await browserAudit();console.log('Pacefold 22.0.2 Day Unfold and quiet taskbar cue audit passed.')})().catch(error=>{console.error(error);process.exitCode=1});
