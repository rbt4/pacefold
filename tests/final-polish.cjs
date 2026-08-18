'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const{chromium}=require('playwright');
const site=path.resolve(process.argv[2]||'_site'),assert=(value,message)=>{if(!value)throw new Error(message)};

function serve(){return new Promise(resolve=>{const server=http.createServer((request,response)=>{let pathname='/';try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname)}catch{}let file=path.join(site,pathname.replace(/^\/+/,''));if(pathname.endsWith('/'))file=path.join(file,'index.html');if(!file.startsWith(site)){response.writeHead(403);response.end();return}fs.readFile(file,(error,data)=>{if(error){response.writeHead(404);response.end('Not found');return}const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';response.writeHead(200,{'content-type':type,'cache-control':'no-store'});response.end(data)})});server.listen(0,'127.0.0.1',()=>resolve({server,origin:`http://127.0.0.1:${server.address().port}`}))})}

const seed=()=>{
  const now=Date.now();
  localStorage.setItem('pacefoldOnboardedV15','1');
  localStorage.setItem('pacefoldPrefsV15',JSON.stringify({profile:'original',rhythmDiscretion:'neutral',timeZone:'America/Toronto',method:'15',asr:'hanafi',showSeconds:true,timeFormat:'12',workHours:'08:30-16:30',workDays:[1,2,3,4,5],notifications:false,quietMode:false,weatherEnabled:false,waterTarget:24,waterStep:2,waterOz:0,waterLastAt:now,waterCadence:45,gazeLastCompleted:now,eyeCadence:20,bodyLastCompleted:now,bodyCadence:45,noteCategories:['Note','Follow-up']}));
  localStorage.setItem('pacefold.notebook.entries.v2','[]');
};

async function checkSurface(page,label){
  await page.waitForFunction(()=>window.__PACEFOLD__?.version==='27.1.0');
  assert(await page.locator('#setup-dialog[open]').count()===0,`${label}: setup interrupted launch`);
  const music=page.locator('#cover-music-open');assert(await music.isVisible(),`${label}: start-surface Music entry is missing`);
  const musicBox=await music.boundingBox(),viewport=page.viewportSize();assert(musicBox&&musicBox.y>viewport.height*.72,`${label}: Music is still living at the top of the surface`);
  assert(await page.locator('#music-room-open').count()===0,`${label}: permanent top Music control still exists`);

  await music.click();await page.waitForFunction(()=>document.getElementById('sound-bar')?.dataset.musicOpen==='true');
  const chooser=page.locator('#stream-chooser');assert(await chooser.isVisible(),`${label}: Music library did not open inside the full player`);
  const box=await chooser.boundingBox(),shell=await page.locator('#stream-player').boundingBox();
  assert(box&&box.x>=-1&&box.y>=-1&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,`${label}: Music library escaped viewport`);
  assert(shell&&shell.x>=-1&&shell.y>=-1&&shell.x+shell.width<=viewport.width+1&&shell.y+shell.height<=viewport.height+1,`${label}: full Music room escaped viewport`);
  await page.click('#music-room-close');await page.waitForFunction(()=>document.getElementById('sound-bar')?.dataset.musicOpen==='false');

  await page.click('#cover-enter');await page.waitForFunction(()=>document.documentElement.dataset.cover==='peeled');
  const state=await page.evaluate(()=>({legacy:getComputedStyle(document.getElementById('sound-bar')).display,topMusic:Boolean(document.getElementById('music-room-open')),returnText:document.getElementById('cover-return')?.innerText||'',logVersion:JSON.parse(localStorage.getItem('pacefold.dayflow.v1')||'{}').version||'',visibleName:document.body.innerText.includes('Pacefold')}));
  assert(state.legacy==='none',`${label}: legacy Music chrome is visible when closed`);assert(!state.topMusic,`${label}: top Music control returned after entering Clock`);assert(/Start/i.test(state.returnText),`${label}: start-surface return control is unclear`);assert(state.logVersion==='27.1.0',`${label}: persisted day-log release identity is stale`);assert(!state.visibleName,`${label}: project name is still visible in the app`);
}

async function main(){
  const app=fs.readFileSync(path.join(site,'app','index.html'),'utf8'),runtime=fs.readFileSync(path.join(site,'app','pacefold.mjs'),'utf8'),styles=fs.readFileSync(path.join(site,'app','pacefold.css'),'utf8'),worker=fs.readFileSync(path.join(site,'service-worker.js'),'utf8'),homeStart=app.indexOf('<section class="view view-home"'),homeEnd=app.indexOf('<section class="view view-notes"'),homeShell=homeStart>=0&&homeEnd>homeStart?app.slice(homeStart,homeEnd):'';
  assert(app.includes('<meta name="application-name" content="Clock">'),'Built shell application name is stale');assert(app.includes('<title>Clock</title>'),'Built shell title is stale');assert(app.includes('./pacefold.css?v=27.1.0'),'Built shell stylesheet cache key is stale');assert(!app.includes('Pacefold'),'Built app shell still exposes the project name');assert(!runtime.includes('Pacefold'),'Built runtime still exposes the project name');
  assert(homeShell&&!homeShell.includes('Prayer rhythm')&&!homeShell.includes('Etobicoke, Toronto'),'Visible Clock shell can flash private rhythm/location copy before runtime');assert(app.includes('<strong>Noodles</strong>')&&app.includes('data-action="prep">Noodles</button>'),'Original-profile noodle defaults are not present in the built shell');assert(styles.includes('Clock discretion r3')&&styles.includes('.music-open-button{display:none!important}'),'Discreet chrome polish is missing');assert(worker.includes('discretion-r3')&&worker.includes("indexedDB.open('pacefold-v26'"),'Cache roll or durable cue DB continuity is wrong');

  const{server,origin}=await serve();let browser;try{
    browser=await chromium.launch({headless:true});
    const desktop=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Toronto'}),page=await desktop.newPage();await page.addInitScript(seed);await page.goto(`${origin}/app/`,{waitUntil:'networkidle'});await checkSurface(page,'desktop');await desktop.close();
    const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,timezoneId:'America/Toronto'}),m=await mobile.newPage();await m.addInitScript(seed);await m.goto(`${origin}/app/`,{waitUntil:'networkidle'});await checkSurface(m,'mobile');await mobile.close();
    console.log('Clock 27.1 discretion contract passed: setup is non-blocking, project branding is absent, Music stays off permanent chrome, and full-player geometry is contained.');
  }finally{if(browser)await browser.close();server.close()}
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1});
