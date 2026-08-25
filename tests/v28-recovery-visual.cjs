'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const{chromium}=require('playwright');
const site=path.resolve(process.argv[2]||'_site'),out=process.argv[3]?path.resolve(process.argv[3]):null;
const assert=(value,message)=>{if(!value)throw new Error(message)};
if(out)fs.mkdirSync(out,{recursive:true});
function serve(){return new Promise(resolve=>{const server=http.createServer((request,response)=>{let pathname='/';try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname)}catch{}let file=path.join(site,pathname.replace(/^\/+/,''));if(pathname.endsWith('/'))file=path.join(file,'index.html');if(!file.startsWith(site)){response.writeHead(403);response.end();return}fs.readFile(file,(error,data)=>{if(error){response.writeHead(404);response.end('Not found');return}const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';response.writeHead(200,{'content-type':type,'cache-control':'no-store'});response.end(data)})});server.listen(0,'127.0.0.1',()=>resolve({server,origin:`http://127.0.0.1:${server.address().port}`}))})}
const seed=()=>{const now=Date.now();localStorage.setItem('pacefoldOnboardedV15','1');localStorage.setItem('pacefoldSetupDismissedV15','1');localStorage.setItem('pacefoldPrefsV15',JSON.stringify({profile:'original',rhythmDiscretion:'neutral',timeZone:'America/Toronto',showSeconds:true,timeFormat:'12',workHours:'00:00-23:59',workDays:[0,1,2,3,4,5,6],notifications:false,quietMode:false,weatherEnabled:false,waterTarget:24,waterStep:2,waterOz:0,waterLastAt:now,waterCadence:180,gazeLastCompleted:now,eyeCadence:120,bodyLastCompleted:now,bodyCadence:180,noteCategories:['Note','Follow-up','Decision']}))};
async function main(){const{server,origin}=await serve();let browser;try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'America/Toronto',serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{const text=message.text();if(message.type()==='error'&&!/Failed to load resource|Service Worker registration blocked by Playwright/i.test(text))errors.push(text)});
  await page.addInitScript(seed);await page.goto(`${origin}/app/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__PACEFOLD__?.recovery==='v28-recovery-r1');
  await page.click('#cover-enter');await page.waitForFunction(()=>document.documentElement.dataset.cover==='peeled');
  const immediate=await page.evaluate(()=>{const cover=document.getElementById('pace-cover'),style=getComputedStyle(cover);return{visibility:style.visibility,opacity:Number(style.opacity),pointer:style.pointerEvents,transition:style.transitionDuration}});
  assert(immediate.visibility==='hidden'&&immediate.opacity===0&&immediate.pointer==='none','Mobile cover remains visible for a frame after opening Clock');
  assert(immediate.transition==='0s','Recovery reintroduced a lingering cover transition');
  if(out)await page.screenshot({path:path.join(out,'v28-recovery-mobile-clock-immediate.png'),fullPage:false});
  await page.evaluate(()=>window.__PACEFOLD__.go('settings'));await page.waitForFunction(()=>document.documentElement.dataset.mode==='settings');
  const release=await page.locator('.view-settings .view-head>b').textContent();assert(/28\.0\.1/.test(release||''),'Visible Settings release identity is stale');
  await page.evaluate(()=>window.__PACEFOLD__.go('home'));await page.waitForFunction(()=>document.documentElement.dataset.mode==='home');await page.evaluate(()=>document.getElementById('stream-source')?.click());await page.waitForFunction(()=>document.getElementById('sound-bar')?.dataset.musicOpen==='true');await page.evaluate(()=>{const chooser=document.getElementById('stream-chooser');if(chooser)chooser.hidden=true});
  const music=await page.evaluate(()=>{const head=document.querySelector('.music-room-head'),style=getComputedStyle(head),box=head.getBoundingClientRect();return{background:style.backgroundColor,color:style.color,height:box.height,top:box.top,bottom:box.bottom}});
  assert(music.background==='rgba(16, 23, 24, 0.98)'||music.background==='rgb(16, 23, 24)','Mobile Music header returned to a pale legacy slab');
  assert(music.height<=80,'Mobile Music header is too tall and dashboard-like');
  if(out)await page.screenshot({path:path.join(out,'v28-recovery-mobile-music-final.png'),fullPage:false});
  assert(!errors.length,errors.join('\n'));await context.close();console.log('Pacefold V28 Recovery visual gate passed: immediate cover dismissal, current release label and dark compact mobile Music chrome.');
}finally{if(browser)await browser.close();server.close()}}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1});
