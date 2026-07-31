'use strict';
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const RELEASE='22.0.1';
const SPATIAL_RELEASE='22.0.0';
const REVISION='spatial-r1';
const site=path.resolve(process.argv[2]||'_site');
const artifacts=path.resolve(process.argv[3]||'/tmp/pacefold-v22-artifacts');
const app=path.join(site,'app');
const read=file=>fs.readFileSync(file,'utf8');
const assert=(ok,message)=>{if(!ok)throw new Error(message)};
const dayKey=()=>{const date=new Date();return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,10)};

function staticAudit(){
  const spatial=read(path.join(app,'pacefold-v22-spatial.js'));
  const hardening=read(path.join(app,'pacefold-v22-hardening.js'));
  const hardeningCss=read(path.join(app,'pacefold-v22-hardening.css'));
  const recoveryCss=read(path.join(app,'pacefold-v22-recovery.css'));
  const html=read(path.join(app,'index.html'));
  const worker=read(path.join(site,'service-worker.js'));
  assert(read(path.join(site,'pacefold-experience.txt')).trim()===RELEASE,'Experience marker is stale');
  assert(spatial.includes(`const RELEASE='${SPATIAL_RELEASE}'`)&&spatial.includes(`const REVISION='${REVISION}'`),'Spatial runtime version is stale');
  for(const token of [`const RELEASE='${RELEASE}'`,'buildSettings','buildNoteInsights','setNotifications','claimSoundOwnership','findSoundNode'])assert(hardening.includes(token),`Hardening runtime token missing: ${token}`);
  for(const token of ['data-pacefold-spatial="pending"','data-pacefold-v22-spatial','data-pacefold-v22-hardening','data-pacefold-v22-recovery','pacefold-v22-recovery.css'])assert(html.includes(token),`Spatial injection missing: ${token}`);
  for(const asset of ['pacefold-v22-spatial.css','pacefold-v22-spatial.js','pacefold-v22-hardening.css','pacefold-v22-recovery.css','pacefold-v22-hardening.js'])assert(worker.includes(asset),`Offline shell omits ${asset}`);
  assert(!/\.innerHTML\s*=|style\s*=\s*["']/.test(spatial+hardening),'Unsafe spatial DOM construction found');
  for(const token of ['.pf22-settings-panel','.pf22-clock-hero::before','.pf22-sound-overlay'])assert(hardeningCss.includes(token),`Hardening visual token missing: ${token}`);
  for(const token of ['.pf22-note-insights','.pf22-sound-mount #pf-local-player','.pf22-worklog-layout'])assert(recoveryCss.includes(token),`Recovery visual token missing: ${token}`);
}

function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((request,response)=>{
      let pathname='/';try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname)}catch{}
      let file=path.join(site,pathname.replace(/^\/+/,''));if(pathname.endsWith('/'))file=path.join(file,'index.html');
      if(!file.startsWith(site)){response.writeHead(403);response.end();return}
      fs.readFile(file,(error,buffer)=>{
        if(error){response.writeHead(404);response.end();return}
        const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.png':'image/png','.svg+xml':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
        response.writeHead(200,{'content-type':type,'cache-control':'no-store'});response.end(buffer);
      });
    });
    server.listen(0,'127.0.0.1',()=>resolve(server));
  });
}

function prefs(){
  const week={};for(let day=0;day<7;day++)week[day]={start:'08:30',end:'16:30',type:day&&day<6?'desk':'off'};
  return{profile:'original',schemaVersion:18,theme:'paper',privacy:false,quietMode:false,timeFormat:'12',showSeconds:true,workHours:'08:30-16:30',workWeek:week,workdaysOnly:false,workReminders:true,gazeEnabled:true,bodyEnabled:true,notifications:true,browserNotif:true,notificationMode:'quiet',taskbarBadge:true,taskbarBadgeMode:'due',locationLabel:'Toronto',lat:43.6532,lng:-79.3832,waterTarget:24,sipCadence:30,waterSips:2,v21WeatherEnabled:true,waferPromptDismissed:true,activityDate:dayKey(),waterDate:dayKey()};
}
function seed(){const now=new Date();return[{id:'seed-note',date:dayKey(),body:'Spatial seed note',category:'Moment',createdAt:now.toISOString(),updatedAt:now.toISOString()}]}
function weather(){const now=new Date().toISOString().slice(0,13)+':00';return{current:{temperature_2m:25,apparent_temperature:23,weather_code:0,is_day:1,precipitation:0,rain:0},hourly:{time:[now],temperature_2m:[25],precipitation_probability:[0],weather_code:[0]},daily:{time:[dayKey(),dayKey(),dayKey()],weather_code:[0,1,2],temperature_2m_max:[26,27,30],temperature_2m_min:[17,15,15],precipitation_probability_max:[0,0,3]}}}
async function contextFor(browser,viewport){
  const context=await browser.newContext({viewport});
  await context.addInitScript(({settings,entries})=>{
    localStorage.setItem('pacefoldPrefsV15',JSON.stringify(settings));
    localStorage.setItem('pacefoldOnboardedV15','1');
    localStorage.setItem('pacefoldSetupDismissedV15','1');
    localStorage.setItem('pacefold.notebook.entries.v2',JSON.stringify(entries));
  },{settings:prefs(),entries:seed()});
  await context.route('**/api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(weather())}));
  return context;
}
async function state(page){
  return page.evaluate(()=>({
    mode:document.getElementById('pf22-spatial-root')?.dataset.mode,
    prefs:window.__PACEFOLD_MA_CORE__?.getPrefs?.(),
    raw:JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}'),
    panels:document.querySelectorAll('.pf22-settings-panel').length,
    controls:[...document.querySelectorAll('.pf22-control-toggle')].map(node=>({key:node.dataset.setting,text:node.textContent,active:node.dataset.active})),
    actions:document.querySelectorAll('.pf22-settings-action').length,
    notes:document.querySelector('.pf22-note-stats')?.textContent,
    noteDays:document.querySelectorAll('.pf22-note-day[data-count]:not([data-count="0"])').length,
    sound:{overlayHidden:document.getElementById('pf22-sound-overlay')?.hidden,playerParent:document.getElementById('pf-local-player')?.parentElement?.id,drawerHidden:document.querySelector('#pf-local-player .pf-player-drawer')?.hidden}
  }));
}
async function wait(page,label,predicate,arg=null,timeout=12000){try{await page.waitForFunction(predicate,arg,{timeout})}catch{throw new Error(`${label} did not settle: ${JSON.stringify(await state(page))}`)}}

async function exerciseDesktop(page){
  await page.keyboard.press('ArrowUp');await wait(page,'Notes face',()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='notes');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').length);
  await page.locator('#pf22-note-input').fill('Spatial audit note');await page.locator('.pf22-capture .pf22-primary').click();
  await wait(page,'Note save',value=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').length===value+1,before);
  await wait(page,'Notebook activity calendar',()=>document.querySelector('.pf22-note-stats')?.textContent.includes('2 notes')&&document.querySelectorAll('.pf22-note-day[data-count]:not([data-count="0"])').length===1);

  await page.keyboard.press('ArrowLeft');await wait(page,'Worklog face',()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='worklog');
  await page.locator('#pf22-worklog-focus').click();await wait(page,'Focus start',()=>window.__PACEFOLD_DAYFLOW__?.events?.().some(event=>event.type==='focus'&&!event.end));
  await page.locator('#pf22-worklog-focus').click();await wait(page,'Focus end',()=>window.__PACEFOLD_DAYFLOW__?.events?.().some(event=>event.type==='focus'&&event.end));

  await page.keyboard.press('ArrowRight');await wait(page,'Now face',()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='context');
  await page.keyboard.press('ArrowDown');await wait(page,'Settings face',()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='settings');
  await wait(page,'Complete Settings',()=>document.querySelectorAll('.pf22-settings-panel').length===3&&document.querySelectorAll('.pf22-control-toggle').length===8&&document.querySelectorAll('.pf22-settings-action').length===3);
  await page.waitForTimeout(300);await page.screenshot({path:path.join(artifacts,'pacefold-v22-settings.png'),fullPage:false});

  await page.locator('.pf22-control-toggle[data-setting="weather"]').click();await wait(page,'Weather toggle',()=>window.__PACEFOLD_V21_PERSISTENCE__?.read?.().v21WeatherEnabled===false&&document.querySelector('.pf22-control-toggle[data-setting="weather"]')?.textContent==='Off');
  await page.locator('.pf22-control-toggle[data-setting="seconds"]').click();await wait(page,'Seconds toggle',()=>window.__PACEFOLD_MA_CORE__?.getPrefs?.().showSeconds===false&&document.querySelector('.pf22-seconds')?.hidden===true);
  await page.locator('.pf22-control-toggle[data-setting="notifications"]').click();await wait(page,'Notification shutdown',()=>{const p=window.__PACEFOLD_MA_CORE__?.getPrefs?.()||{};return p.notifications===false&&p.browserNotif===false&&p.notificationMode==='off'&&p.taskbarBadge===false&&p.taskbarBadgeMode==='off'});
  await page.locator('.pf22-control-toggle[data-setting="notifications"]').click();await wait(page,'Notification restore',()=>{const p=window.__PACEFOLD_MA_CORE__?.getPrefs?.()||{};return p.notifications===true&&p.notificationMode!=='off'&&p.taskbarBadge===true});
  await page.locator('.pf22-control-toggle[data-setting="timeFormat"]').click();await wait(page,'Time format',()=>window.__PACEFOLD_MA_CORE__?.getPrefs?.().timeFormat==='24');

  await page.locator('.pf22-settings-action[data-action="sound"]').click();
  await wait(page,'Sound player ownership',()=>{const overlay=document.getElementById('pf22-sound-overlay'),player=document.getElementById('pf-local-player'),drawer=player?.querySelector('.pf-player-drawer'),bar=player?.querySelector('.pf-player-bar');if(!overlay||overlay.hidden||player?.parentElement?.id!=='pf22-sound-mount'||!drawer||!bar)return false;const pr=player.getBoundingClientRect(),dr=drawer.getBoundingClientRect(),br=bar.getBoundingClientRect(),background=getComputedStyle(player).backgroundColor;return pr.height>420&&dr.height>240&&br.height>=54&&!/rgba?\(0,\s*0,\s*0(?:,\s*0)?\)/.test(background)});
  await page.waitForTimeout(300);await page.screenshot({path:path.join(artifacts,'pacefold-v22-sound-overlay.png'),fullPage:false});
  await page.locator('.pf22-sound-close').click();await wait(page,'Sound restore',()=>document.getElementById('pf22-sound-overlay')?.hidden===true&&document.getElementById('pf-local-player')?.parentElement?.id!=='pf22-sound-mount');

  await page.keyboard.press('Escape');await wait(page,'Clock return',()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='home');
  await page.waitForTimeout(350);await page.screenshot({path:path.join(artifacts,'pacefold-v22-clock.png'),fullPage:false});
  await page.keyboard.press('ArrowUp');await wait(page,'Notes return',()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='notes');
  await page.waitForTimeout(350);await page.screenshot({path:path.join(artifacts,'pacefold-v22-notes.png'),fullPage:false});
}

async function browserAudit(){
  fs.mkdirSync(artifacts,{recursive:true});
  const server=await serve(),base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true}),errors=[];
  try{
    const context=await contextFor(browser,{width:1180,height:920}),page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!/ERR_INTERNET_DISCONNECTED/.test(message.text()))errors.push(message.text())});
    await page.goto(`${base}/app/`,{waitUntil:'domcontentloaded',timeout:30000});
    await wait(page,'Spatial startup',()=>window.__PACEFOLD_SPATIAL__?.release==='22.0.1'&&window.__PACEFOLD_HARDENING__?.release==='22.0.1'&&document.documentElement.dataset.pacefoldSpatial==='ready');
    await page.waitForTimeout(2200);
    const initial=await page.evaluate(()=>{const root=document.getElementById('pf22-spatial-root'),legacy=document.querySelector('body>main'),faces=[...document.querySelectorAll('.pf22-face')].filter(face=>{const rect=face.getBoundingClientRect();return rect.right>0&&rect.bottom>0&&rect.left<innerWidth&&rect.top<innerHeight}).map(face=>face.dataset.face);return{mode:root?.dataset.mode,title:document.title,legacy:getComputedStyle(legacy).display,faces,scroll:document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1,status:document.getElementById('pf22-status')?.textContent}});
    assert(initial.mode==='home'&&initial.title==='Pacefold — Quiet Workday Rhythm'&&initial.legacy==='none'&&initial.faces.length===1&&initial.faces[0]==='home'&&initial.scroll,`Spatial startup geometry failed: ${JSON.stringify(initial)}`);
    assert(initial.status.includes(' · '),`Clock status is unreadable: ${initial.status}`);
    await exerciseDesktop(page);await context.close();

    const mobile=await contextFor(browser,{width:430,height:850}),small=await mobile.newPage();small.on('pageerror',error=>errors.push(error.message));
    await small.goto(`${base}/app/`,{waitUntil:'domcontentloaded',timeout:30000});await wait(small,'Mobile startup',()=>window.__PACEFOLD_HARDENING__&&document.getElementById('pf22-spatial-root'));
    await small.keyboard.press('ArrowLeft');await wait(small,'Mobile Worklog',()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='worklog');await small.waitForTimeout(400);
    const geometry=await small.evaluate(()=>{const root=document.getElementById('pf22-spatial-root'),summary=document.querySelector('.pf22-log-summary'),stream=document.querySelector('.pf22-log-stream'),eyebrow=summary?.querySelector('.pf22-eyebrow'),sr=summary?.getBoundingClientRect(),tr=stream?.getBoundingClientRect();return{scroll:document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1,root:root?.getBoundingClientRect().toJSON(),mode:root?.dataset.mode,summary:sr?.toJSON(),stream:tr?.toJSON(),metrics:summary?.querySelectorAll('.pf22-metric').length,writing:eyebrow?getComputedStyle(eyebrow).writingMode:'',display:summary?getComputedStyle(summary).display:''}});
    assert(geometry.scroll&&geometry.mode==='worklog'&&geometry.root.width<=430&&geometry.root.height<=850&&geometry.summary.width>360&&geometry.summary.bottom<=geometry.stream.top+2&&geometry.metrics===4&&geometry.writing.startsWith('horizontal')&&geometry.display==='grid',`Mobile Worklog composition failed: ${JSON.stringify(geometry)}`);
    await small.screenshot({path:path.join(artifacts,'pacefold-v22-mobile-worklog.png'),fullPage:false});await mobile.close();
    assert(!errors.length,`Browser errors: ${errors.join(' | ')}`);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}

(async()=>{staticAudit();await browserAudit();console.log('Pacefold 22.0.1 final visual recovery audit passed.')})().catch(error=>{console.error(error);process.exitCode=1});
