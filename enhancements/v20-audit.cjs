'use strict';

const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const site=path.resolve(process.argv[2]||'_site');
const artifacts=path.resolve(process.argv[3]||path.join(process.cwd(),'v20-audit-artifacts'));
const app=path.join(site,'app');
const read=file=>fs.readFileSync(file,'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

function staticAudit(){
  const runtime=read(path.join(app,'pacefold-v20.js'));
  const css=read(path.join(app,'pacefold-v20.css'));
  const ma=read(path.join(app,'pacefold-ma.js'));
  const integrated=read(path.join(app,'pacefold-integrated.js'));
  const html=read(path.join(app,'index.html'));
  const landing=read(path.join(site,'index.html'));
  const worker=read(path.join(site,'service-worker.js'));

  assert(!/\.innerHTML\s*=/.test(runtime),'V20 runtime contains a raw innerHTML assignment');
  assert(!/style\s*=\s*["']/.test(runtime),'V20 runtime contains an inline style string');
  assert((html.match(/data-pacefold-v20=/g)||[]).length===2,'V20 CSS and runtime were not injected exactly once');
  assert(html.includes('pacefold-v20.css?v=20.0.0')&&html.includes('pacefold-v20.js?v=20.0.0'),'V20 app assets are not cache-busted');
  assert((landing.match(/name="pacefold-landing" content="20\.0\.0"/g)||[]).length===1,'V20 landing marker was not injected exactly once');
  for(const asset of ['pacefold-v20.css','pacefold-v20.js'])assert(worker.includes(asset),`Offline shell omits ${asset}`);
  assert(integrated.includes('navigator.setAppBadge?.()')&&!integrated.includes('navigator.setAppBadge?.(1)'),'The integrated notification path still requests a numeric badge');
  assert(ma.includes("flowWaiting=Boolean(document.querySelector('[data-pf-flow-pulse][data-state=\"new\"]'))"),'The badge owner does not preserve integrated waiting state');

  for(const token of [
    'showSaveFilePicker','pacefold-v20-backup','createWritable','queryPermission',
    'pacefold.resilience.recoveryNotice.v1','recoverFromHandle','currentBackupContext',
    'pacefold:storage-changed','pacefold:v20-backup','setTestHandle',
    'pf-v20-alert','attentionFavicon','installFolio','window.__PACEFOLD_V20__'
  ])assert(runtime.includes(token),`V20 runtime token missing: ${token}`);

  for(const token of [
    '.pf-v20-folio','.pf-v20-alert','.pf-v20-backup','html.pf-v20-active #seconds',
    'grid-template-columns:repeat(6','data-attention="true"',
    '@media (max-width:380px) and (max-height:220px)',
    'prefers-reduced-motion:reduce','prefers-reduced-transparency:reduce',
    'forced-colors:active',':focus-visible'
  ])assert(css.includes(token),`V20 CSS token missing: ${token}`);

  assert(landing.includes('one protected workday folio')&&landing.includes('automatic JSON backup')&&landing.includes('Automatic recovery'),'The public page does not explain V20');
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

const dateKey=()=>{
  const date=new Date();
  return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};

function initialPrefs(){
  const day=dateKey();
  return{
    profile:'original',theme:'paper',privacy:false,clarity:'discreet',
    showSeconds:true,taskbarBadge:true,taskbarBadgeMode:'due',notificationMode:'quiet',
    workdaysOnly:false,workHours:'00:00-23:59',workReminders:false,showWorkline:true,
    dayCloseEnabled:false,activityDate:day,waterDate:day,lat:51.0447,lng:-114.0719,
    locationLabel:'Calgary',waterTarget:72,sipCadence:30,waterSips:0,
    gazeEnabled:true,bodyEnabled:true,waferPromptDismissed:true
  };
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
    hourly:{time:[isoHour,isoHour,isoHour,isoHour],temperature_2m:[12,13,14,14],precipitation_probability:[5,15,40,25],weather_code:[2,2,61,2]},
    daily:{time:days,weather_code:[2,61,1],temperature_2m_max:[17,15,19],temperature_2m_min:[6,7,8],precipitation_probability_max:[15,70,10]}
  };
}

async function prepareContext(browser,viewport,extra={}){
  const context=await browser.newContext({viewport,...extra});
  await context.addInitScript(initial=>{
    localStorage.setItem('pacefoldOnboardedV15','1');
    localStorage.setItem('pacefoldSetupDismissedV15','1');
    localStorage.setItem('pacefoldPrefsV15',JSON.stringify(initial));
    window.__PACEFOLD_BADGE_CALLS__=[];
    Object.defineProperty(navigator,'setAppBadge',{configurable:true,writable:true,value:async function(...args){window.__PACEFOLD_BADGE_CALLS__.push({kind:'set',argc:args.length,value:args[0]??null});}});
    Object.defineProperty(navigator,'clearAppBadge',{configurable:true,writable:true,value:async function(){window.__PACEFOLD_BADGE_CALLS__.push({kind:'clear'});}});
    window.__PACEFOLD_BACKUP_FILE__={text:'',writes:0};
    const handle={
      kind:'file',
      name:'Pacefold automatic backup.json',
      queryPermission:async()=> 'granted',
      requestPermission:async()=> 'granted',
      getFile:async()=>new File([window.__PACEFOLD_BACKUP_FILE__.text],'Pacefold automatic backup.json',{type:'application/json'}),
      createWritable:async()=>({
        write:async value=>{window.__PACEFOLD_BACKUP_FILE__.text=String(value);window.__PACEFOLD_BACKUP_FILE__.writes+=1;},
        close:async()=>{}
      })
    };
    window.__PACEFOLD_TEST_HANDLE__=handle;
    window.showSaveFilePicker=async()=>handle;
  },initialPrefs());
  await context.route('**/api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(weatherPayload())}));
  return context;
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
    const context=await prepareContext(browser,{width:1180,height:860});
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&!/ERR_INTERNET_DISCONNECTED/.test(message.text()))errors.push(message.text());});
    await page.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__PACEFOLD_V20__?.release==='20.0.0'&&document.getElementById('pf-v20-folio')&&document.querySelectorAll('#workline .pf-ritual-slot[data-v19-ritual="true"]').length===6);
    await page.waitForFunction(()=>document.getElementById('pf-v19-weather')?.dataset.ready==='true');

    const initial=await page.evaluate(()=>{
      const folio=document.getElementById('pf-v20-folio'),clock=folio.querySelector(':scope>.clock-shell'),bench=folio.querySelector(':scope>#pf-v19-workbench');
      const folioRect=folio.getBoundingClientRect(),clockRect=clock.getBoundingClientRect(),benchRect=bench.getBoundingClientRect(),seconds=document.getElementById('seconds');
      return{
        release:document.body.dataset.pacefoldRelease,
        children:[...folio.children].map(node=>node.id||node.className),
        horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,
        attached:Math.abs(clockRect.bottom-benchRect.top)<=2,
        ratio:benchRect.height/folioRect.height,
        seconds:{text:seconds.textContent,display:getComputedStyle(seconds).display,color:getComputedStyle(seconds).color,width:seconds.getBoundingClientRect().width},
        alert:document.getElementById('pf-v20-alert')?.dataset.active,
        backup:document.getElementById('pf-v20-backup')?.dataset.state,
        backupVisible:document.getElementById('pf-v20-backup')?.getBoundingClientRect().width>100,
        rituals:document.querySelectorAll('#workline .pf-ritual-slot[data-v19-ritual="true"]').length
      };
    });
    assert(initial.release==='20.0.0',`V20 release marker is wrong: ${initial.release}`);
    assert(initial.children.length===2&&/clock-shell/.test(initial.children[0])&&initial.children[1]==='pf-v19-workbench',`The clock and notebook are not one folio: ${JSON.stringify(initial.children)}`);
    assert(initial.horizontal&&initial.attached&&initial.ratio>=.42&&initial.ratio<=.62,`Desktop folio geometry is wrong: ${JSON.stringify(initial)}`);
    assert(/^\d{2}$/.test(initial.seconds.text)&&initial.seconds.display!=='none'&&initial.seconds.width>14&&!/rgba?\(0,\s*0,\s*0,\s*0\)/.test(initial.seconds.color),`Seconds are not visibly restored: ${JSON.stringify(initial.seconds)}`);
    assert(['true','false'].includes(initial.alert)&&initial.backupVisible&&initial.rituals===6,`V20 controls are missing: ${JSON.stringify(initial)}`);
    await page.screenshot({path:path.join(artifacts,'pacefold-v20-folio.png'),fullPage:true});

    await page.locator('#pf-v20-backup').click();
    await page.waitForFunction(()=>window.__PACEFOLD_BACKUP_FILE__.writes>0&&window.__PACEFOLD_BACKUP_FILE__.text.includes('"format": "pacefold.backup.v1"'));
    const writesBefore=await page.evaluate(()=>window.__PACEFOLD_BACKUP_FILE__.writes);
    await page.locator('[data-pf-note-body]').fill('V20 protected note');
    await page.locator('[data-pf-note-save]').click();
    await page.waitForFunction(before=>window.__PACEFOLD_BACKUP_FILE__.writes>before,writesBefore);
    const backup=await page.evaluate(()=>{
      const data=JSON.parse(window.__PACEFOLD_BACKUP_FILE__.text);
      return{notes:data.notes.map(item=>item.body),automatic:data.automatic,state:document.getElementById('pf-v20-backup').dataset.state};
    });
    assert(backup.automatic&&backup.state==='synced'&&backup.notes.includes('V20 protected note'),`Automatic backup did not receive the note: ${JSON.stringify(backup)}`);

    await page.evaluate(()=>{
      localStorage.removeItem('pacefold.notebook.entries.v2');
      localStorage.setItem('pacefold.resilience.recoveryNotice.v1',JSON.stringify({backedUp:true,reason:'V20 audit failure'}));
      window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{source:'simulated-storage-failure'}}));
    });
    await page.waitForFunction(()=>{
      const entries=JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]');
      return entries.some(item=>item.body==='V20 protected note');
    });
    const recovered=await page.evaluate(()=>({
      notes:JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').length,
      notice:localStorage.getItem('pacefold.resilience.recoveryNotice.v1'),
      state:document.getElementById('pf-v20-backup').dataset.state
    }));
    assert(recovered.notes>0&&!recovered.notice&&recovered.state==='synced',`Automatic backup recovery failed: ${JSON.stringify(recovered)}`);

    await page.evaluate(()=>{
      window.__PACEFOLD_BADGE_CALLS__.length=0;
      const pulse=document.querySelector('[data-pf-flow-pulse]');
      pulse.dataset.state='new';
      document.body.dataset.source='water';
      document.body.dataset.signal='due';
      document.querySelector('[data-pf-flow-cue-text]').textContent='Water is due';
      window.__PACEFOLD_MA_SCHEDULER__.updateBadge({source:'water',signal:'due'},{});
    });
    await page.waitForFunction(()=>document.getElementById('pf-v20-alert')?.dataset.active==='true'&&window.__PACEFOLD_BADGE_CALLS__.some(item=>item.kind==='set'));
    const attention=await page.evaluate(()=>({
      calls:window.__PACEFOLD_BADGE_CALLS__,
      label:document.querySelector('#pf-v20-alert strong')?.textContent,
      favicon:document.querySelector('link[rel~="icon"]')?.href,
      brand:document.documentElement.dataset.v20Attention
    }));
    assert(attention.calls.some(item=>item.kind==='set'&&item.argc===0)&&!attention.calls.some(item=>item.kind==='set'&&item.argc>0),`Taskbar badge is not a flag/dot request: ${JSON.stringify(attention.calls)}`);
    assert(/Water/i.test(attention.label)&&attention.favicon.startsWith('data:image/png')&&attention.brand==='true',`Visible fallback markers did not synchronize: ${JSON.stringify(attention)}`);
    await page.screenshot({path:path.join(artifacts,'pacefold-v20-attention.png'),fullPage:true});
    assert(errors.length===0,`Desktop V20 emitted browser errors: ${errors.join(' | ')}`);
    await context.close();

    const mobileContext=await prepareContext(browser,{width:390,height:844});
    const mobile=await mobileContext.newPage();
    mobile.on('pageerror',error=>errors.push(error.message));
    await mobile.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await mobile.waitForFunction(()=>window.__PACEFOLD_V20__?.release==='20.0.0'&&document.getElementById('pf-v20-folio'));
    await mobile.locator('[data-pf-note-body]').scrollIntoViewIfNeeded();
    const mobileState=await mobile.evaluate(()=>{
      const folio=document.getElementById('pf-v20-folio'),bench=document.getElementById('pf-v19-workbench'),composer=document.querySelector('[data-pf-note-body]'),seconds=document.getElementById('seconds');
      const fr=folio.getBoundingClientRect(),br=bench.getBoundingClientRect(),cr=composer.getBoundingClientRect();
      const midpoint=document.elementFromPoint(cr.left+cr.width/2,Math.min(innerHeight-2,cr.top+cr.height/2));
      return{
        horizontal:document.documentElement.scrollWidth<=innerWidth+1,
        folio:fr.width,
        benchReachable:br.bottom<=document.documentElement.scrollHeight+1,
        composer:cr.width,
        composerInView:cr.top>=0&&cr.bottom<=innerHeight,
        composerTopmost:Boolean(midpoint?.closest?.('[data-pf-note-body]')),
        rootScroll:document.scrollingElement===document.documentElement&&document.documentElement.scrollHeight>innerHeight,
        seconds:getComputedStyle(seconds).display,
        alert:getComputedStyle(document.getElementById('pf-v20-alert')).display,
        backup:getComputedStyle(document.getElementById('pf-v20-backup')).display
      };
    });
    assert(mobileState.horizontal&&mobileState.folio<=390&&mobileState.benchReachable&&mobileState.composer>250&&mobileState.composerInView&&mobileState.composerTopmost&&mobileState.rootScroll&&mobileState.seconds!=='none'&&mobileState.alert!=='none'&&mobileState.backup!=='none',`Mobile V20 is clipped or incomplete: ${JSON.stringify(mobileState)}`);
    await mobile.screenshot({path:path.join(artifacts,'pacefold-v20-mobile.png'),fullPage:true});
    await mobileContext.close();

    const waferContext=await prepareContext(browser,{width:340,height:150});
    const wafer=await waferContext.newPage();
    await wafer.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await wafer.waitForFunction(()=>window.__PACEFOLD_V20__?.release==='20.0.0');
    const waferState=await wafer.evaluate(()=>({
      horizontal:document.documentElement.scrollWidth<=innerWidth+1,
      vertical:document.documentElement.scrollHeight<=innerHeight+1,
      bench:getComputedStyle(document.getElementById('pf-v19-workbench')).display,
      alert:getComputedStyle(document.getElementById('pf-v20-alert')).display,
      clock:getComputedStyle(document.querySelector('.clock-shell')).display
    }));
    assert(waferState.horizontal&&waferState.vertical&&waferState.bench==='none'&&waferState.alert==='none'&&waferState.clock!=='none',`Wafer V20 fallback failed: ${JSON.stringify(waferState)}`);
    await wafer.screenshot({path:path.join(artifacts,'pacefold-v20-wafer.png')});
    await waferContext.close();

    const reducedContext=await prepareContext(browser,{width:1000,height:760},{reducedMotion:'reduce'});
    const reduced=await reducedContext.newPage();
    await reduced.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await reduced.waitForFunction(()=>window.__PACEFOLD_V20__?.release==='20.0.0');
    const motion=await reduced.evaluate(()=>{
      const card=document.querySelector('.pf-ritual-slot[data-v19-ritual="true"]');
      return{transition:getComputedStyle(card).transitionDuration,animation:getComputedStyle(card).animationDuration};
    });
    assert(/^0s(?:,\s*0s)*$/.test(motion.transition)&&/^0s(?:,\s*0s)*$/.test(motion.animation),`Reduced motion does not fully win: ${JSON.stringify(motion)}`);
    await reducedContext.close();
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}

async function main(){
  staticAudit();
  if(process.env.PACEFOLD_STATIC_ONLY==='1'){
    console.log('Pacefold 20 static audit passed.');
    return;
  }
  await browserAudit();
  console.log('Pacefold 20 browser audit passed: one folio, visible seconds, flag badging, synchronized fallback markers, selectable automatic backup, recovery, responsive geometry and reduced motion.');
}

main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
