'use strict';

const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const site=path.resolve(process.argv[2]||'_site');
const artifacts=path.resolve(process.argv[3]||path.join(process.cwd(),'v19-audit-artifacts'));
const app=path.join(site,'app');
const fail=message=>{throw new Error(message);};
const assert=(condition,message)=>{if(!condition)fail(message);};
const read=file=>fs.readFileSync(file,'utf8');

function staticAudit(){
  const runtime=read(path.join(app,'pacefold-v19.js'));
  const css=read(path.join(app,'pacefold-v19.css'));
  const core=read(path.join(app,'app.js'));
  const hub=read(path.join(app,'pacefold-hub.js'));
  const html=read(path.join(app,'index.html'));
  const landing=read(path.join(site,'index.html'));
  const worker=read(path.join(site,'service-worker.js'));

  assert(!/\.innerHTML\s*=/.test(runtime),'V19 runtime contains a raw innerHTML assignment');
  assert(!/style\s*=\s*["']/.test(runtime),'V19 runtime contains an inline style string');
  assert((html.match(/data-pacefold-v19=/g)||[]).length===2,'V19 CSS and runtime were not injected exactly once');
  assert((landing.match(/name="pacefold-landing" content="19\.0\.0"/g)||[]).length===1,'V19 landing marker was not injected exactly once');
  assert(html.includes('pacefold-v19.css?v=19.0.0')&&html.includes('pacefold-v19.js?v=19.0.0'),'V19 app assets are not cache-busted');
  assert(landing.includes('pacefold-site-v19.css?v=19.0.0'),'V19 landing stylesheet is not cache-busted');
  assert(!/\b(?:Kiroku|Andon|Hansei|Kaizen|Sumi|Sekkei|Washi|Oto|OneNote)\b|Ma ·/i.test(landing),'V19 landing retains a retired product term');
  assert(!html.includes('graph.microsoft.com'),'The V19 app CSP still permits Microsoft Graph');
  assert(core.includes('async function syncCaptureQueue(){return false;}'),'The retired OneNote delivery path is not disabled');
  assert(core.includes("foldMode=['capture','care','sound'].includes(mode)?mode:'capture'"),'The retired OneNote fold remains reachable');
  assert(core.includes('__PACEFOLD_V19_CORE__={localNotesOnly:true,weatherUsesSavedLocation:true}'),'The V19 local-only core contract is missing');
  assert(hub.includes('pacefoldV19Weather')&&!hub.includes('latitude=43.6532&longitude=-79.3832'),'The legacy weather surface still hard-codes Toronto');

  for(const token of [
    'weatherUrl','prefs.lat','prefs.lng','pacefold.v19.weather.v1','refreshWeather',
    'Water','Timer','Away','Meal','Eyes','Move','registerModule','unregisterModule',
    'window.__PACEFOLD_V19__','pacefold:v19-ready'
  ])assert(runtime.includes(token),`V19 runtime token missing: ${token}`);

  for(const token of [
    'grid-template-columns:repeat(6','grid-template-columns:repeat(4',
    '#pf-local-player:not(.is-open)','data-v19-surface="music"',
    '@media (max-width:380px) and (max-height:220px)',
    'prefers-reduced-motion:reduce','prefers-reduced-transparency:reduce',
    'forced-colors:active',':focus-visible'
  ])assert(css.includes(token),`V19 CSS token missing: ${token}`);

  for(const asset of ['pacefold-site-v19.css','pacefold-v19.css','pacefold-v19.js'])
    assert(worker.includes(asset),`Offline shell omits ${asset}`);

  const staleLanguage=/Japanese restraint|Kiroku ·|Andon ·|Hansei ·|Kaizen ·|Sumi workspace|Ma · Day Ribbon/i;
  assert(!staleLanguage.test(landing),'The public page still markets the retired Japanese-language identity');
  assert(landing.includes('one workday instrument')&&landing.includes('Workday dashboard'),'The public page does not describe the V19 dashboard');
  return{runtime,css,core};
}

function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((request,response)=>{
      let pathname;
      try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}catch{pathname='/';}
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

const dateKey=()=>{
  const date=new Date();
  return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};

function initialPrefs(){
  const day=dateKey();
  return{
    profile:'original',
    theme:'paper',
    privacy:false,
    clarity:'discreet',
    workdaysOnly:false,
    workHours:'00:00-23:59',
    workReminders:true,
    showWorkline:true,
    dayCloseEnabled:false,
    activityDate:day,
    waterDate:day,
    lat:51.0447,
    lng:-114.0719,
    locationLabel:'Calgary',
    waterTarget:72,
    sipCadence:30,
    waterSips:0,
    gazeEnabled:true,
    bodyEnabled:true,
    waferPromptDismissed:true
  };
}

function initStorage(){
  localStorage.setItem('pacefoldOnboardedV15','1');
  localStorage.setItem('pacefoldSetupDismissedV15','1');
  localStorage.setItem('pacefoldPrefsV15',JSON.stringify(window.__V19_INITIAL_PREFS__));
}

function weatherPayload(){
  const now=new Date();
  const isoHour=new Date(now.getFullYear(),now.getMonth(),now.getDate(),now.getHours()).toISOString().slice(0,13)+':00';
  const days=[0,1,2].map(offset=>{
    const date=new Date(now);
    date.setDate(date.getDate()+offset);
    return date.toISOString().slice(0,10);
  });
  return{
    current:{temperature_2m:12.4,apparent_temperature:10.2,weather_code:2,is_day:1,precipitation:0,rain:0},
    hourly:{
      time:[isoHour,isoHour,isoHour,isoHour],
      temperature_2m:[12,13,14,14],
      precipitation_probability:[5,15,40,25],
      weather_code:[2,2,61,2]
    },
    daily:{
      time:days,
      weather_code:[2,61,1],
      temperature_2m_max:[17,15,19],
      temperature_2m_min:[6,7,8],
      precipitation_probability_max:[15,70,10]
    }
  };
}

async function prepareContext(browser,viewport,extra={}){
  const context=await browser.newContext({viewport,...extra});
  const requests=[];
  await context.addInitScript(prefs=>{
    window.__V19_INITIAL_PREFS__=prefs;
    localStorage.setItem('pacefoldOnboardedV15','1');
    localStorage.setItem('pacefoldSetupDismissedV15','1');
    localStorage.setItem('pacefoldPrefsV15',JSON.stringify(prefs));
  },initialPrefs());
  await context.route('**/api.open-meteo.com/**',route=>{
    requests.push(route.request().url());
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(weatherPayload())});
  });
  return{context,requests};
}

async function browserAudit(){
  fs.mkdirSync(artifacts,{recursive:true});
  const server=await serve();
  const port=server.address().port;
  const base=`http://127.0.0.1:${port}`;
  let launchArgs=[];
  try{launchArgs=JSON.parse(process.env.PACEFOLD_CHROMIUM_ARGS||'[]');}catch{}
  const customBrowser=Boolean(process.env.PACEFOLD_CHROMIUM_PATH&&launchArgs.length);
  const browser=await chromium.launch({
    headless:true,
    executablePath:process.env.PACEFOLD_CHROMIUM_PATH||undefined,
    args:Array.isArray(launchArgs)?launchArgs:[],
    ignoreDefaultArgs:customBrowser?['--headless','--no-startup-window']:undefined
  });
  const errors=[];

  try{
    const {context,requests}=await prepareContext(browser,{width:1180,height:860});
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__PACEFOLD_V19__?.release==='19.0.0'&&document.querySelectorAll('#workline .pf-ritual-slot[data-v19-ritual="true"]').length===6);
    await page.waitForFunction(()=>document.getElementById('pf-v19-weather')?.dataset.ready==='true');

    const dashboard=await page.evaluate(()=>({
      release:document.body.dataset.pacefoldRelease,
      weather:document.getElementById('pf-v19-weather-location')?.textContent,
      temperature:document.getElementById('pf-v19-weather-temp')?.textContent,
      rituals:[...document.querySelectorAll('#workline .pf-v19-ritual-name')].map(node=>node.textContent),
      tools:[...document.querySelectorAll('#quietDock .pf-v19-tool-copy strong')].map(node=>node.textContent),
      options:document.querySelectorAll('#workline .pf-ritual-options').length,
      playerDisplay:getComputedStyle(document.getElementById('pf-local-player')).display,
      playerHeight:document.getElementById('pf-local-player').getBoundingClientRect().height,
      statusWidth:document.getElementById('statusLine').scrollWidth<=document.getElementById('statusLine').clientWidth+1,
      horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth+1
    }));
    assert(dashboard.release==='19.0.0',`V19 release marker is wrong: ${dashboard.release}`);
    assert(dashboard.weather==='Calgary'&&dashboard.temperature==='12°',`Saved-location weather did not render: ${JSON.stringify(dashboard)}`);
    assert(JSON.stringify(dashboard.rituals)===JSON.stringify(['Water','Timer','Away','Meal','Eyes','Move']),`Rhythm controls were reduced or reordered: ${JSON.stringify(dashboard.rituals)}`);
    assert(JSON.stringify(dashboard.tools)===JSON.stringify(['Notes','Music']),`Utility strip is incomplete: ${JSON.stringify(dashboard.tools)}`);
    assert(dashboard.options===6,'Every rhythm control must retain a visible options path');
    assert(dashboard.playerDisplay==='none'&&dashboard.playerHeight===0,'The legacy player still occupies the dashboard at rest');
    assert(dashboard.statusWidth&&dashboard.horizontal,`The main dashboard clips or overflows: ${JSON.stringify(dashboard)}`);
    assert(requests.some(value=>{
      const url=new URL(value);
      return Math.abs(Number(url.searchParams.get('latitude'))-51.0447)<.001&&Math.abs(Number(url.searchParams.get('longitude'))+114.0719)<.001;
    }),`Weather did not request the saved coordinates: ${requests.join(', ')}`);

    const before=await page.evaluate(()=>Number(JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}').waterSips)||0);
    await page.locator('#waterBtn').click();
    await page.waitForFunction(count=>(Number(JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}').waterSips)||0)>count,before);
    await page.locator('#noodleBtn').click();
    await page.waitForFunction(()=>Number(JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}').noodleStart)>0);
    const rhythmState=await page.evaluate(()=>{
      const prefs=JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}');
      return{water:prefs.waterSips,timer:prefs.noodleStart,active:document.querySelector('.pf-ritual-slot[data-source="noodle"]')?.dataset.active};
    });
    assert(rhythmState.water===before+1&&rhythmState.timer>0&&rhythmState.active==='true',`Core rhythm actions did not survive the redesign: ${JSON.stringify(rhythmState)}`);

    await page.locator('#pf-v19-notes').click();
    await page.waitForFunction(()=>document.body.dataset.v19Surface==='notes');
    await page.waitForTimeout(220);
    const notes=await page.evaluate(()=>({
      open:document.getElementById('pf-local-workspace').classList.contains('is-open'),
      player:document.getElementById('pf-local-player').classList.contains('is-open'),
      inView:(()=>{const r=document.getElementById('pf-local-workspace').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})(),
      topmost:(()=>{const node=document.getElementById('pf-local-workspace'),r=node.getBoundingClientRect();return Boolean(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('#pf-local-workspace'));})()
    }));
    assert(notes.open&&!notes.player&&notes.inView&&notes.topmost,`Notes focus sheet is not exclusive, contained and above its scrim: ${JSON.stringify(notes)}`);
    await page.screenshot({path:path.join(artifacts,'pacefold-v19-notes.png'),fullPage:true});
    await page.evaluate(()=>window.__PACEFOLD_REVAMP__.closeNotebook());
    await page.locator('#pf-v19-music').click();
    await page.waitForFunction(()=>document.body.dataset.v19Surface==='music');
    await page.waitForTimeout(220);
    const music=await page.evaluate(()=>{
      const player=document.getElementById('pf-local-player'),rgb=getComputedStyle(player).backgroundColor;
      const rect=player.getBoundingClientRect();
      return{
        open:player.classList.contains('is-open'),
        notes:document.getElementById('pf-local-workspace').classList.contains('is-open'),
        background:rgb,
        inView:rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight,
        topmost:Boolean(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)?.closest('#pf-local-player'))
      };
    });
    assert(music.open&&!music.notes&&music.inView&&music.topmost&&!/^rgb\\(0, 0, 0\\)$/.test(music.background),`Music focus sheet retained the black slab, fell behind its scrim or has bad geometry: ${JSON.stringify(music)}`);
    await page.screenshot({path:path.join(artifacts,'pacefold-v19-music.png'),fullPage:true});
    await page.evaluate(()=>window.__PACEFOLD_REVAMP__.player.close());
    await page.waitForFunction(()=>document.body.dataset.v19Surface==='dashboard'&&document.getElementById('pf-v19-scrim')?.hidden);

    await page.locator('#brandButton').click();
    await page.waitForFunction(()=>document.getElementById('panel').classList.contains('on'));
    const settings=await page.evaluate(()=>{
      const panel=document.getElementById('panel');
      return{text:panel.textContent||'',views:[...panel.querySelectorAll('[data-settings-view]')].map(node=>node.textContent.trim())};
    });
    const retired=/\b(?:Kiroku|Andon|Hansei|Kaizen|Sumi|Sekkei|Washi|Oto|OneNote)\b|Ma ·/i;
    assert(!retired.test(settings.text),`Retired product language remains in settings: ${settings.text.match(retired)?.[0]}`);
    assert(settings.views.length===4,'Settings grouping broke during the language reset');

    const moduleResult=await page.evaluate(()=>{
      const node=document.createElement('button');
      node.type='button';
      node.textContent='Future module';
      const added=window.__PACEFOLD_V19__.registerModule('future-module',node);
      const present=Boolean(document.querySelector('[data-pf-v19-module="future-module"]'));
      const removed=window.__PACEFOLD_V19__.unregisterModule('future-module');
      return{added,present,removed,gone:!document.querySelector('[data-pf-v19-module="future-module"]')};
    });
    assert(Object.values(moduleResult).every(Boolean),`The dashboard extension contract failed: ${JSON.stringify(moduleResult)}`);

    await page.screenshot({path:path.join(artifacts,'pacefold-v19-settings.png'),fullPage:true});
    await page.locator('#panel [data-action="close"]').click();
    await page.waitForFunction(()=>!document.getElementById('panel').classList.contains('on'));
    await page.locator('#pf-quiet-toggle').click({timeout:3000});
    await page.waitForFunction(()=>document.body.dataset.quiet==='true');
    await page.locator('#pf-quiet-toggle').click({timeout:3000});
    await page.waitForFunction(()=>document.body.dataset.quiet==='false');
    await page.waitForTimeout(260);
    await page.screenshot({path:path.join(artifacts,'pacefold-v19-dashboard.png'),fullPage:true});
    const landingPage=await context.newPage();
    await landingPage.goto(`${base}/`,{waitUntil:'networkidle'});
    const landingState=await landingPage.evaluate(()=>({
      marker:document.querySelector('meta[name="pacefold-landing"]')?.content,
      text:document.body.textContent||'',
      horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth+1
    }));
    assert(landingState.marker==='19.0.0'&&landingState.horizontal&&landingState.text.includes('one workday instrument')&&!retired.test(landingState.text),`V19 public page is stale or overflows: ${JSON.stringify({marker:landingState.marker,horizontal:landingState.horizontal,retired:landingState.text.match(retired)?.[0]})}`);
    await landingPage.screenshot({path:path.join(artifacts,'pacefold-v19-landing.png'),fullPage:true});
    await landingPage.close();
    await context.close();

    const mobileBundle=await prepareContext(browser,{width:390,height:844});
    const mobile=await mobileBundle.context.newPage();
    mobile.on('pageerror',error=>errors.push(error.message));
    await mobile.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await mobile.waitForFunction(()=>window.__PACEFOLD_V19__?.release==='19.0.0');
    const mobileGeometry=await mobile.evaluate(()=>({
      horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,
      rituals:document.querySelectorAll('#workline .pf-ritual-slot[data-v19-ritual="true"]').length,
      weather:getComputedStyle(document.getElementById('pf-v19-weather')).display,
      status:document.getElementById('statusLine').getBoundingClientRect(),
      viewport:{width:innerWidth,height:innerHeight}
    }));
    assert(mobileGeometry.horizontal&&mobileGeometry.rituals===6&&mobileGeometry.weather!=='none',`Mobile dashboard lost content or overflowed: ${JSON.stringify(mobileGeometry)}`);
    await mobile.screenshot({path:path.join(artifacts,'pacefold-v19-mobile.png'),fullPage:true});
    await mobile.locator('#pf-v19-music').scrollIntoViewIfNeeded();
    const mobileTools=await mobile.evaluate(()=>Object.fromEntries(['captureBtn','soundBtn','pf-v19-notes','pf-v19-music'].map(id=>{
      const node=document.getElementById(id),rect=node.getBoundingClientRect(),style=getComputedStyle(node);
      return[id,style.display!=='none'&&style.visibility!=='hidden'&&rect.width>80&&rect.top>=0&&rect.bottom<=innerHeight];
    })));
    assert(Object.values(mobileTools).every(Boolean),`Mobile utilities are clipped or unreachable: ${JSON.stringify(mobileTools)}`);
    await mobile.screenshot({path:path.join(artifacts,'pacefold-v19-mobile-tools.png'),fullPage:true});
    await mobileBundle.context.close();

    const waferBundle=await prepareContext(browser,{width:340,height:150});
    const wafer=await waferBundle.context.newPage();
    await wafer.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await wafer.waitForFunction(()=>window.__PACEFOLD_V19__?.release==='19.0.0');
    const waferGeometry=await wafer.evaluate(()=>({
      horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,
      vertical:document.documentElement.scrollHeight<=document.documentElement.clientHeight+1,
      weather:getComputedStyle(document.getElementById('pf-v19-weather')).display,
      rituals:getComputedStyle(document.getElementById('workline')).display,
      time:getComputedStyle(document.querySelector('.time-row')).display,
      status:getComputedStyle(document.getElementById('statusLine')).display
    }));
    assert(waferGeometry.horizontal&&waferGeometry.vertical&&waferGeometry.weather==='none'&&waferGeometry.rituals==='none'&&waferGeometry.time!=='none'&&waferGeometry.status!=='none',`Wafer fallback failed: ${JSON.stringify(waferGeometry)}`);
    await wafer.screenshot({path:path.join(artifacts,'pacefold-v19-wafer.png')});
    await waferBundle.context.close();

    const reducedBundle=await prepareContext(browser,{width:900,height:700},{reducedMotion:'reduce'});
    const reduced=await reducedBundle.context.newPage();
    await reduced.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await reduced.waitForFunction(()=>window.__PACEFOLD_V19__?.release==='19.0.0');
    const motion=await reduced.evaluate(()=>{
      const card=document.querySelector('.pf-ritual-slot[data-v19-ritual="true"]');
      return{transition:getComputedStyle(card).transitionDuration,animation:getComputedStyle(card).animationDuration};
    });
    const settled=motion.transition.split(',').every(value=>(Number.parseFloat(value)||0)<=.001);
    assert(settled,`Reduced motion still animates the dashboard: ${JSON.stringify(motion)}`);
    await reducedBundle.context.close();

    assert(!errors.length,`Browser errors: ${errors.join(' | ')}`);
  }finally{
    await browser.close().catch(()=>{});
    server.closeAllConnections?.();
    server.close();
  }
}

async function main(){
  staticAudit();
  if(process.env.PACEFOLD_STATIC_ONLY==='1'){
    console.log('Pacefold 19 static dashboard audit passed.');
    return;
  }
  await browserAudit();
  console.log('Pacefold 19 dashboard audit passed: saved-location weather, core rhythm actions, local-only notes, focused music, responsive geometry, reduced motion and extension hooks.');
}

main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
