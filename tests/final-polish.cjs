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

async function checkChrome(page,label){
  await page.waitForFunction(()=>window.__PACEFOLD__?.version==='27.1.0');
  await page.click('#cover-peel');
  await page.waitForFunction(()=>document.documentElement.dataset.cover==='peeled');
  const state=await page.evaluate(()=>{
    const sound=document.getElementById('sound-bar').getBoundingClientRect(),bar=document.querySelector('.app-bar').getBoundingClientRect(),brand=document.querySelector('.brand').getBoundingClientRect(),player=document.getElementById('stream-player');
    return{sound:{top:sound.top,bottom:sound.bottom,left:sound.left,right:sound.right,width:sound.width},brandRight:brand.right,barBottom:bar.bottom,state:player.dataset.state,returnText:document.getElementById('cover-return')?.innerText||'',logVersion:JSON.parse(localStorage.getItem('pacefold.dayflow.v1')||'{}').version||''};
  });
  assert(state.state==='empty',`${label}: expected empty Music state`);
  assert(state.sound.width<=42&&state.sound.top>=0&&state.sound.bottom<=state.barBottom+2,`${label}: closed Music control escaped the app chrome`);
  assert(state.sound.left-state.brandRight>=6,`${label}: Music chrome crowds the Clock brand (${Math.round(state.sound.left-state.brandRight)}px gap)`);
  assert(/Start/i.test(state.returnText),`${label}: start-surface return control is unclear`);
  assert(state.logVersion==='27.1.0',`${label}: persisted day-log release identity is stale (${state.logVersion})`);

  await page.click('#stream-source');
  await page.waitForFunction(()=>document.getElementById('sound-bar')?.dataset.musicOpen==='true');
  const chooser=page.locator('#stream-chooser');assert(await chooser.isVisible(),`${label}: Music library did not open inside the full player`);
  const box=await chooser.boundingBox(),shell=await page.locator('#stream-player').boundingBox(),viewport=page.viewportSize();
  assert(box&&box.x>=-1&&box.y>=-1&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,`${label}: full-player Music library is outside the viewport`);
  assert(shell&&shell.x>=-1&&shell.y>=-1&&shell.x+shell.width<=viewport.width+1&&shell.y+shell.height<=viewport.height+1,`${label}: full Music room is outside the viewport`);
  await page.click('#stream-chooser .stream-add-form button:not(.primary)');
  await page.click('#music-room-close');
  await page.waitForFunction(()=>document.getElementById('sound-bar')?.dataset.musicOpen==='false');
}

async function main(){
  const app=fs.readFileSync(path.join(site,'app','index.html'),'utf8'),styles=fs.readFileSync(path.join(site,'app','pacefold.css'),'utf8'),worker=fs.readFileSync(path.join(site,'service-worker.js'),'utf8'),homeStart=app.indexOf('<section class="view view-home"'),homeEnd=app.indexOf('<section class="view view-notes"'),homeShell=homeStart>=0&&homeEnd>homeStart?app.slice(homeStart,homeEnd):'';
  assert(app.includes('<meta name="application-name" content="Clock">'),'Built shell application name is stale');
  assert(app.includes('<title>Clock</title>'),'Built shell title is stale');
  assert(app.includes('./pacefold.css?v=27.1.0'),'Built shell stylesheet cache key is stale');
  assert(!app.includes('Pacefold 25.1.0'),'Built shell still carries the old release label');
  assert(homeShell&&!homeShell.includes('Prayer rhythm')&&!homeShell.includes('Etobicoke, Toronto'),'Visible Clock shell can flash private rhythm/location copy before runtime');
  assert(app.includes('<strong>Noodles</strong>')&&app.includes('data-action="prep">Noodles</button>'),'Original-profile noodle defaults are not present in the built shell');
  assert(styles.includes('full Music room'),'Full Music room polish is missing');
  assert(worker.includes('final-form-r1-final-polish')&&worker.includes("indexedDB.open('pacefold-v26'"),'Final cache roll or durable cue DB continuity is wrong');

  const{server,origin}=await serve();let browser;try{
    browser=await chromium.launch({headless:true});
    const desktop=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Toronto'}),page=await desktop.newPage();await page.addInitScript(seed);await page.goto(`${origin}/app/`,{waitUntil:'networkidle'});await checkChrome(page,'desktop');await desktop.close();
    const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,timezoneId:'America/Toronto'}),m=await mobile.newPage();await m.addInitScript(seed);await m.goto(`${origin}/app/`,{waitUntil:'networkidle'});await checkChrome(m,'mobile');await mobile.close();
    console.log('Pacefold 27.1 final polish contract passed: clean boot shell, chrome-safe closed Music, full-player geometry and release continuity.');
  }finally{if(browser)await browser.close();server.close()}
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1});
