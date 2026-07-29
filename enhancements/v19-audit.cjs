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
  assert((landing.match(/name="pacefold-landing" content="20\.0\.0"/g)||[]).length===1,'V20 landing marker was not injected exactly once');
  assert(html.includes('pacefold-v19.css?v=20.0.0')&&html.includes('pacefold-v19.js?v=20.0.0'),'Retained V19 app assets are not cache-busted for V20');
  assert(landing.includes('pacefold-site-v19.css?v=20.0.0'),'V20 landing stylesheet is not cache-busted');
  assert(!/\b(?:Kiroku|Andon|Hansei|Kaizen|Sumi|Sekkei|Washi|Oto|OneNote)\b|Ma ·/i.test(landing),'V19 landing retains a retired product term');
  assert(!html.includes('graph.microsoft.com'),'The V19 app CSP still permits Microsoft Graph');
  assert(core.includes('async function syncCaptureQueue(){return false;}'),'The retired OneNote delivery path is not disabled');
  assert(core.includes("foldMode=['capture','care','sound'].includes(mode)?mode:'capture'"),'The retired OneNote fold remains reachable');
  assert(core.includes('__PACEFOLD_V19_CORE__={localNotesOnly:true,weatherUsesSavedLocation:true}'),'The V19 local-only core contract is missing');
  assert(hub.includes('pacefoldV19Weather')&&!hub.includes('latitude=43.6532&longitude=-79.3832'),'The legacy weather surface still hard-codes Toronto');

  for(const token of [
    'weatherUrl','prefs.lat','prefs.lng','pacefold.v19.weather.v1','refreshWeather',
    'Water','Timer','Away','Meal','Eyes','Move','installWorkbench','setWorkbenchPage',
    'showNotes','showSound','registerModule','unregisterModule',
    'window.__PACEFOLD_V19__','pacefold:v19-ready'
  ])assert(runtime.includes(token),`V19 runtime token missing: ${token}`);

  for(const token of [
    'grid-template-columns:repeat(6','.pf-v19-workbench','grid-template-rows:50px minmax(0,1fr)',
    '#pf-v19-workbench #pf-local-workspace','#pf-v19-workbench #pf-local-player',
    '#quietDock{display:none','pf-v19-scrim{display:none',
    '@media (max-width:380px) and (max-height:220px)',
    'prefers-reduced-motion:reduce','prefers-reduced-transparency:reduce',
    'forced-colors:active',':focus-visible'
  ])assert(css.includes(token),`V19 CSS token missing: ${token}`);
  assert(!runtime.includes('installScrim'),'The obsolete modal scrim runtime is still installed');

  for(const asset of ['pacefold-site-v19.css','pacefold-v19.css','pacefold-v19.js'])
    assert(worker.includes(asset),`Offline shell omits ${asset}`);

  const staleLanguage=/Japanese restraint|Kiroku ·|Andon ·|Hansei ·|Kaizen ·|Sumi workspace|Ma · Day Ribbon/i;
  assert(!staleLanguage.test(landing),'The public page still markets the retired Japanese-language identity');
  assert(landing.includes('one protected workday folio')&&landing.includes('Workday dashboard')&&landing.includes('automatic JSON backup'),'The public page does not describe the V20 folio');
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
    await page.waitForFunction(()=>window.__PACEFOLD_V19__?.release==='20.0.0'&&window.__PACEFOLD_V20__?.release==='20.0.0'&&document.querySelectorAll('#workline .pf-ritual-slot[data-v19-ritual="true"]').length===6);
    await page.waitForFunction(()=>document.getElementById('pf-v19-weather')?.dataset.ready==='true');

    const dashboard=await page.evaluate(()=>({
      release:document.body.dataset.pacefoldRelease,
      weather:document.getElementById('pf-v19-weather-location')?.textContent,
      temperature:document.getElementById('pf-v19-weather-temp')?.textContent,
      rituals:[...document.querySelectorAll('#workline .pf-v19-ritual-name')].map(node=>node.textContent),
      options:document.querySelectorAll('#workline .pf-ritual-options').length,
      workbench:(()=>{
        const node=document.getElementById('pf-v19-workbench'),rect=node.getBoundingClientRect();
        return{
          page:node.dataset.page,
          display:getComputedStyle(node).display,
          height:rect.height,
          viewport:innerHeight,
          inView:rect.left>=0&&rect.right<=innerWidth&&rect.top>=0,
          notebook:!document.getElementById('pf-local-workspace').hidden,
          player:!document.getElementById('pf-local-player').hidden
        };
      })(),
      scrim:Boolean(document.getElementById('pf-v19-scrim')),
      statusWidth:document.getElementById('statusLine').scrollWidth<=document.getElementById('statusLine').clientWidth+1,
      horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth+1
    }));
    assert(dashboard.release==='20.0.0',`V20 release marker is wrong: ${dashboard.release}`);
    assert(dashboard.weather==='Calgary'&&dashboard.temperature==='12°',`Saved-location weather did not render: ${JSON.stringify(dashboard)}`);
    assert(JSON.stringify(dashboard.rituals)===JSON.stringify(['Water','Timer','Away','Meal','Eyes','Move']),`Rhythm controls were reduced or reordered: ${JSON.stringify(dashboard.rituals)}`);
    assert(dashboard.options===6,'Every rhythm control must retain a visible options path');
    assert(dashboard.workbench.page==='notes'&&dashboard.workbench.display==='grid'&&dashboard.workbench.notebook&&!dashboard.workbench.player,`The notebook is not the persistent default lower half: ${JSON.stringify(dashboard.workbench)}`);
    assert(dashboard.workbench.height/dashboard.workbench.viewport>=.38&&dashboard.workbench.height/dashboard.workbench.viewport<=.66&&dashboard.workbench.inView,`The notebook does not occupy a contained lower half: ${JSON.stringify(dashboard.workbench)}`);
    assert(!dashboard.scrim,'The retired modal scrim still exists');
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

    const composer=page.locator('[data-pf-note-body]');
    await composer.fill('Persistent notebook audit note');
    await page.locator('[data-pf-note-save]').click();
    await page.waitForFunction(()=>document.querySelector('[data-pf-note-document]')?.textContent.includes('Persistent notebook audit note'));
    const notes=await page.evaluate(()=>({
      page:document.getElementById('pf-v19-workbench').dataset.page,
      visible:!document.getElementById('pf-local-workspace').hidden,
      status:document.getElementById('statusLine')?.textContent,
      scrim:Boolean(document.getElementById('pf-v19-scrim')),
      position:getComputedStyle(document.getElementById('pf-local-workspace')).position
    }));
    assert(notes.page==='notes'&&notes.visible&&!notes.scrim&&notes.position==='relative'&&!/folding back/i.test(notes.status||''),`Saving disturbed the persistent notebook: ${JSON.stringify(notes)}`);
    await page.screenshot({path:path.join(artifacts,'pacefold-v19-notes.png'),fullPage:true});
    await page.locator('[data-workbench-page="sound"]').click();
    await page.waitForFunction(()=>document.body.dataset.v19WorkbenchPage==='sound');
    const music=await page.evaluate(()=>{
      const player=document.getElementById('pf-local-player'),workbench=document.getElementById('pf-v19-workbench');
      return{
        page:workbench.dataset.page,
        visible:!player.hidden,
        notebook:!document.getElementById('pf-local-workspace').hidden,
        position:getComputedStyle(player).position,
        parent:player.parentElement?.className,
        scrim:Boolean(document.getElementById('pf-v19-scrim'))
      };
    });
    assert(music.page==='sound'&&music.visible&&!music.notebook&&music.position==='relative'&&music.parent==='pf-v19-workbench-body'&&!music.scrim,`Sound did not replace the notebook page in place: ${JSON.stringify(music)}`);
    await page.screenshot({path:path.join(artifacts,'pacefold-v19-music.png'),fullPage:true});
    await page.locator('[data-workbench-page="notes"]').click();
    await page.waitForFunction(()=>document.body.dataset.v19WorkbenchPage==='notes'&&!document.getElementById('pf-local-workspace').hidden);

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
    assert(landingState.marker==='20.0.0'&&landingState.horizontal&&landingState.text.includes('one protected workday folio')&&landingState.text.includes('automatic JSON backup')&&!retired.test(landingState.text),`V20 public page is stale or overflows: ${JSON.stringify({marker:landingState.marker,horizontal:landingState.horizontal,retired:landingState.text.match(retired)?.[0]})}`);
    await landingPage.screenshot({path:path.join(artifacts,'pacefold-v19-landing.png'),fullPage:true});
    await landingPage.close();
    await context.close();

    const mobileBundle=await prepareContext(browser,{width:390,height:844});
    const mobile=await mobileBundle.context.newPage();
    mobile.on('pageerror',error=>errors.push(error.message));
    await mobile.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await mobile.waitForFunction(()=>window.__PACEFOLD_V19__?.release==='20.0.0'&&window.__PACEFOLD_V20__?.release==='20.0.0');
    const mobileGeometry=await mobile.evaluate(()=>({
      horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,
      rituals:document.querySelectorAll('#workline .pf-ritual-slot[data-v19-ritual="true"]').length,
      weather:getComputedStyle(document.getElementById('pf-v19-weather')).display,
      workbench:getComputedStyle(document.getElementById('pf-v19-workbench')).display,
      notebook:!document.getElementById('pf-local-workspace').hidden,
      contained:[document.querySelector('.time-row'),document.getElementById('pf-v19-weather'),document.getElementById('workline')]
        .every(node=>{const rect=node.getBoundingClientRect();return rect.left>=0&&rect.right<=innerWidth+1&&rect.width>innerWidth*.72;}),
      status:document.getElementById('statusLine').getBoundingClientRect(),
      viewport:{width:innerWidth,height:innerHeight}
    }));
    assert(mobileGeometry.horizontal&&mobileGeometry.contained&&mobileGeometry.rituals===6&&mobileGeometry.weather!=='none'&&mobileGeometry.workbench==='grid'&&mobileGeometry.notebook,`Mobile dashboard lost content or overflowed: ${JSON.stringify(mobileGeometry)}`);
    await mobile.screenshot({path:path.join(artifacts,'pacefold-v19-mobile.png'),fullPage:true});
    await mobile.locator('[data-pf-note-body]').scrollIntoViewIfNeeded();
    const mobileTools=await mobile.evaluate(()=>{
      const workbench=document.getElementById('pf-v19-workbench'),composer=document.querySelector('[data-pf-note-body]');
      const benchRect=workbench.getBoundingClientRect(),composerRect=composer.getBoundingClientRect();
      return{
        tabs:document.querySelectorAll('[data-workbench-page]').length,
        horizontal:workbench.scrollWidth<=workbench.clientWidth+1,
        composerVisible:composerRect.width>200&&composerRect.height>40,
        lowerHalf:benchRect.height/innerHeight>=.5,
        reachable:benchRect.bottom<=document.documentElement.scrollHeight+1,
        bench:{top:benchRect.top,bottom:benchRect.bottom,height:benchRect.height},
        scrollHeight:document.documentElement.scrollHeight,
        main:(()=>{const node=document.querySelector('main'),rect=node.getBoundingClientRect(),style=getComputedStyle(node);return{top:rect.top,bottom:rect.bottom,height:rect.height,overflow:style.overflow,heightStyle:style.height};})()
      };
    });
    assert(mobileTools.tabs===2&&mobileTools.horizontal&&mobileTools.composerVisible&&mobileTools.lowerHalf&&mobileTools.reachable,`Mobile notebook is clipped or unreachable: ${JSON.stringify(mobileTools)}`);
    await mobile.screenshot({path:path.join(artifacts,'pacefold-v19-mobile-tools.png'),fullPage:true});
    await mobileBundle.context.close();

    const waferBundle=await prepareContext(browser,{width:340,height:150});
    const wafer=await waferBundle.context.newPage();
    await wafer.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await wafer.waitForFunction(()=>window.__PACEFOLD_V19__?.release==='20.0.0'&&window.__PACEFOLD_V20__?.release==='20.0.0');
    const waferGeometry=await wafer.evaluate(()=>({
      horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,
      vertical:document.documentElement.scrollHeight<=document.documentElement.clientHeight+1,
      weather:getComputedStyle(document.getElementById('pf-v19-weather')).display,
      rituals:getComputedStyle(document.getElementById('workline')).display,
      workbench:getComputedStyle(document.getElementById('pf-v19-workbench')).display,
      time:getComputedStyle(document.querySelector('.time-row')).display,
      status:getComputedStyle(document.getElementById('statusLine')).display
    }));
    assert(waferGeometry.horizontal&&waferGeometry.vertical&&waferGeometry.weather==='none'&&waferGeometry.rituals==='none'&&waferGeometry.workbench==='none'&&waferGeometry.time!=='none'&&waferGeometry.status!=='none',`Wafer fallback failed: ${JSON.stringify(waferGeometry)}`);
    await wafer.screenshot({path:path.join(artifacts,'pacefold-v19-wafer.png')});
    await waferBundle.context.close();

    const reducedBundle=await prepareContext(browser,{width:900,height:700},{reducedMotion:'reduce'});
    const reduced=await reducedBundle.context.newPage();
    await reduced.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await reduced.waitForFunction(()=>window.__PACEFOLD_V19__?.release==='20.0.0'&&window.__PACEFOLD_V20__?.release==='20.0.0');
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
    console.log('Pacefold 20 retained-folio audit passed.');
    return;
  }
  await browserAudit();
  console.log('Pacefold 20 retained-folio audit passed: saved-location weather, core rhythm actions, a persistent half-height notebook, in-place sound, responsive geometry, reduced motion and extension hooks.');
}

main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
