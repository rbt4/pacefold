'use strict';
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const RELEASE='22.0.0';
const REVISION='spatial-r1';
const site=path.resolve(process.argv[2]||'_site');
const artifacts=path.resolve(process.argv[3]||'/tmp/pacefold-v22-artifacts');
const app=path.join(site,'app');
const read=file=>fs.readFileSync(file,'utf8');
const assert=(ok,message)=>{if(!ok)throw new Error(message)};
const dayKey=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
function staticAudit(){
  const js=read(path.join(app,'pacefold-v22-spatial.js')),css=read(path.join(app,'pacefold-v22-spatial.css')),html=read(path.join(app,'index.html')),worker=read(path.join(site,'service-worker.js'));
  assert(read(path.join(site,'pacefold-experience.txt')).trim()===RELEASE,'Experience marker is stale');
  assert(js.includes(`const RELEASE='${RELEASE}'`)&&js.includes(`const REVISION='${REVISION}'`),'Spatial runtime version is stale');
  for(const token of ['pf22-spatial-root','buildNotes','buildWorklog','buildContext','buildSettings','pacefold:spatial-ready'])assert(js.includes(token),`Spatial runtime token missing: ${token}`);
  for(const token of ['data-pacefold-spatial="pending"','data-pacefold-v22-spatial','pacefold-v22-spatial.css','pacefold-v22-spatial.js'])assert(html.includes(token),`Spatial injection missing: ${token}`);
  for(const asset of ['pacefold-v22-spatial.css','pacefold-v22-spatial.js'])assert(worker.includes(asset),`Offline shell omits ${asset}`);
  assert(!/\.innerHTML\s*=|style\s*=\s*["']/.test(js),'Unsafe spatial DOM construction found');
  assert(css.includes('Clock-first')&&css.includes('.pf22-stage')&&css.includes('.pf22-face-notes')&&css.includes('.pf22-face-worklog'),'Spatial CSS identity missing');
}
function serve(){return new Promise(resolve=>{const server=http.createServer((request,response)=>{let pathname='/';try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname)}catch{}let file=path.join(site,pathname.replace(/^\/+/,''));if(pathname.endsWith('/'))file=path.join(file,'index.html');if(!file.startsWith(site)){response.writeHead(403);response.end();return}fs.readFile(file,(error,buffer)=>{if(error){response.writeHead(404);response.end();return}const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';response.writeHead(200,{'content-type':type,'cache-control':'no-store'});response.end(buffer)})});server.listen(0,'127.0.0.1',()=>resolve(server))})}
function prefs(){const week={};for(let day=0;day<7;day++)week[day]={start:'08:30',end:'16:30',type:day&&day<6?'desk':'off'};return{profile:'original',schemaVersion:18,theme:'paper',privacy:false,quietMode:false,timeFormat:'12',showSeconds:true,workHours:'08:30-16:30',workWeek:week,workdaysOnly:false,workReminders:true,notifications:true,locationLabel:'Toronto',lat:43.6532,lng:-79.3832,waterTarget:24,sipCadence:30,waterSips:2,v21WeatherEnabled:true,waferPromptDismissed:true,activityDate:dayKey(),waterDate:dayKey()}}
function seed(){const now=new Date();return[{id:'seed-note',date:dayKey(),body:'Spatial seed note',category:'Moment',createdAt:now.toISOString(),updatedAt:now.toISOString()}]}
function weather(){const now=new Date().toISOString().slice(0,13)+':00';return{current:{temperature_2m:25,apparent_temperature:23,weather_code:0,is_day:1,precipitation:0,rain:0},hourly:{time:[now],temperature_2m:[25],precipitation_probability:[0],weather_code:[0]},daily:{time:[dayKey(),dayKey(),dayKey()],weather_code:[0,1,2],temperature_2m_max:[26,27,30],temperature_2m_min:[17,15,15],precipitation_probability_max:[0,0,3]}}}
async function contextFor(browser,viewport){const context=await browser.newContext({viewport});await context.addInitScript(({settings,entries})=>{localStorage.setItem('pacefoldPrefsV15',JSON.stringify(settings));localStorage.setItem('pacefoldOnboardedV15','1');localStorage.setItem('pacefoldSetupDismissedV15','1');localStorage.setItem('pacefold.notebook.entries.v2',JSON.stringify(entries));sessionStorage.setItem('pacefoldV21AuditSeeded','1')},{settings:prefs(),entries:seed()});await context.route('**/api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(weather())}));return context}
async function inspectPage(page){return page.evaluate(()=>{const root=document.getElementById('pf22-spatial-root'),legacy=document.querySelector('body>main'),style=legacy&&getComputedStyle(legacy);return{release:window.__PACEFOLD_SPATIAL__?.release,revision:window.__PACEFOLD_SPATIAL__?.revision,mode:root?.dataset.mode,title:document.title,spatial:document.documentElement.dataset.pacefoldSpatial,legacy:style?.display,scroll:document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1,faces:document.querySelectorAll('.pf22-face').length,edges:document.querySelectorAll('.pf22-edge').length}})}
async function exercise(page){
  await page.keyboard.press('ArrowUp');await page.waitForFunction(()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='notes');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').length);
  await page.locator('#pf22-note-input').fill('Spatial audit note');await page.locator('.pf22-capture .pf22-primary').click();
  await page.waitForFunction(value=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'[]').length===value+1,before);
  await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='worklog');
  await page.locator('#pf22-worklog-focus').click();await page.waitForFunction(()=>window.__PACEFOLD_DAYFLOW__?.events?.().some(event=>event.type==='focus'&&!event.end));
  await page.locator('#pf22-worklog-focus').click();await page.waitForFunction(()=>window.__PACEFOLD_DAYFLOW__?.events?.().some(event=>event.type==='focus'&&event.end));
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='context');
  await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='settings');
  await page.locator('.pf22-switch[data-setting="weather"]').click();await page.waitForFunction(()=>window.__PACEFOLD_V21_PERSISTENCE__?.read?.().v21WeatherEnabled===false);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='home');
}
async function browserAudit(){fs.mkdirSync(artifacts,{recursive:true});const server=await serve(),base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true}),errors=[];try{
  const context=await contextFor(browser,{width:1180,height:920}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!/ERR_INTERNET_DISCONNECTED/.test(message.text()))errors.push(message.text())});
  await page.goto(`${base}/app/`,{waitUntil:'networkidle'});await page.waitForTimeout(4500);
  const startup=await page.evaluate(()=>({api:Boolean(window.__PACEFOLD_SPATIAL__),spatial:document.documentElement.dataset.pacefoldSpatial,root:Boolean(document.getElementById('pf22-spatial-root')),boot:window.__PACEFOLD_V21_BOOT__,dayflow:Boolean(window.__PACEFOLD_DAYFLOW__),ready:document.readyState,title:document.title,scripts:[...document.scripts].map(script=>script.src.split('/').pop()).filter(Boolean)}));
  if(!startup.api||startup.spatial!=='ready')await page.screenshot({path:path.join(artifacts,'pacefold-v22-startup-failure.png'),fullPage:false});
  assert(startup.api&&startup.spatial==='ready',`Spatial startup did not complete: ${JSON.stringify(startup)}; browser errors: ${errors.join(' | ')}`);
  const initial=await inspectPage(page);assert(initial.release===RELEASE&&initial.revision===REVISION&&initial.mode==='home'&&initial.title==='Pacefold — Quiet Workday Rhythm',`Spatial startup failed: ${JSON.stringify(initial)}`);assert(initial.legacy==='none'&&initial.scroll&&initial.faces===5&&initial.edges===4,`Spatial geometry failed: ${JSON.stringify(initial)}`);
  await page.waitForTimeout(2200);assert((await page.title())==='Pacefold — Quiet Workday Rhythm','Window title changed after clock tick');
  await exercise(page);await page.screenshot({path:path.join(artifacts,'pacefold-v22-clock.png'),fullPage:false});
  await page.keyboard.press('ArrowUp');await page.screenshot({path:path.join(artifacts,'pacefold-v22-notes.png'),fullPage:false});await context.close();
  const mobile=await contextFor(browser,{width:430,height:850}),small=await mobile.newPage();small.on('pageerror',error=>errors.push(error.message));await small.goto(`${base}/app/`,{waitUntil:'networkidle'});await small.waitForFunction(()=>window.__PACEFOLD_SPATIAL__&&document.getElementById('pf22-spatial-root'));await small.keyboard.press('ArrowLeft');await small.waitForFunction(()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='worklog');const geometry=await small.evaluate(()=>({scroll:document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1,root:document.getElementById('pf22-spatial-root').getBoundingClientRect().toJSON(),mode:document.getElementById('pf22-spatial-root').dataset.mode}));assert(geometry.scroll&&geometry.mode==='worklog'&&geometry.root.width<=430&&geometry.root.height<=850,`Mobile spatial geometry failed: ${JSON.stringify(geometry)}`);await small.screenshot({path:path.join(artifacts,'pacefold-v22-mobile-worklog.png'),fullPage:false});await mobile.close();
  assert(!errors.length,`Browser errors: ${errors.join(' | ')}`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}}
(async()=>{staticAudit();await browserAudit();console.log('Pacefold 22 Spatial Fold audit passed.')})().catch(error=>{console.error(error);process.exitCode=1});
