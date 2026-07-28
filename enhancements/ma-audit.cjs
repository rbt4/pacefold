'use strict';
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

const root=path.resolve(process.argv[2]||'_release');
const artifactRoot=path.resolve(process.argv[3]||'/tmp/pacefold-ma-artifacts');
fs.mkdirSync(artifactRoot,{recursive:true});
const appRoot=path.join(root,'app');
function assert(value,message){if(!value)throw new Error(message);}
function text(file){return fs.readFileSync(file,'utf8');}
function mime(file){return file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')||file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html';}

const maJs=text(path.join(appRoot,'pacefold-ma.js'));
const maCss=text(path.join(appRoot,'pacefold-ma.css'));
const themeBoot=text(path.join(appRoot,'pf-theme-boot.js'));
const html=text(path.join(appRoot,'index.html'));
for(const token of ['class CueScheduler','minCueGap','focusGraceMinutes','reconcileDrift','pacefold.backup.v1','navigator.storage','windowControlsOverlay','pf-day-ribbon','maQuietRestore'])assert(maJs.includes(token),`Ma JS token missing: ${token}`);
for(const token of ['--pf-ribbon-h','@property --pf-meter','data-clarity="wafer"','titlebar-area-height','forced-colors:active','prefers-reduced-transparency','pf-ma-digit-fold'])assert(maCss.includes(token),`Ma CSS token missing: ${token}`);
assert(themeBoot.includes("root.classList.add('pf-boot')")&&themeBoot.includes('pacefoldPrefsV15'),'Theme boot contract missing');
assert((html.match(/pf-theme-boot\.js/g)||[]).length===1,'Theme boot injected more than once');
assert((html.match(/pacefold-ma\.js/g)||[]).length===1,'Ma runtime injected more than once');
assert((html.match(/pacefold-ma\.css/g)||[]).length===1,'Ma stylesheet injected more than once');
assert(html.indexOf('pf-theme-boot.js')<html.indexOf('app.js'),'Theme boot does not precede the core app');
assert(html.indexOf('pacefold-ma.js')<html.indexOf('app.js'),'Scheduler does not precede the core app');
assert(!/PeriodicSync|NotificationTrigger|periodicSync/i.test(maJs),'Unsupported background delivery path was added');

for(const name of fs.readdirSync(appRoot).filter(name=>/^manifest.*(?:json|webmanifest)$/i.test(name))){
  const manifest=JSON.parse(text(path.join(appRoot,name)));
  assert(Array.isArray(manifest.display_override)&&manifest.display_override[0]==='window-controls-overlay'&&manifest.display_override.includes('standalone'),`WCO display_override missing in ${name}`);
}

const server=http.createServer((req,res)=>{
  const raw=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  let file=path.join(root,raw.replace(/^\//,''));
  if(raw==='/'||raw.endsWith('/'))file=path.join(file,'index.html');
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':mime(file),'Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1180,height:820}});
    await context.addInitScript(()=>{
      class FakeNotification extends EventTarget{constructor(title,options){super();globalThis.__notifications=(globalThis.__notifications||[]).concat([{title,options}]);}static permission='granted';static requestPermission=async()=> 'granted';}
      Object.defineProperty(window,'Notification',{value:FakeNotification,writable:true,configurable:true});
      Object.defineProperty(navigator,'setAppBadge',{value:async value=>{globalThis.__badges=(globalThis.__badges||[]).concat([value]);},writable:true,configurable:true});
      const legacy={workHours:'08:30-16:30',workdaysOnly:true,profile:'default',customMoments:[],prepPreset:15,prepLabel:'Noodles',waterTarget:8,sipCadence:30,waterSips:2,gazeCadence:20,bodyCadence:45,noodleMinutes:15,deskLunchMinutes:30,awayLunchMinutes:45,lunchSessions:[],awaySessions:[],prayerSessions:[],bodySessions:[],history:[],lead:5,dueWindow:10,staleAfterMinutes:15,snoozeMinutes:5,clarity:'discreet',privacy:false,taskbarBadge:true,notificationDetail:'full',notificationMode:'toast',dayCloseEnabled:false,lat:43.65,lng:-79.38};
      localStorage.setItem('pacefoldPrefsV15',JSON.stringify(legacy));
    });
    const page=await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/app/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>Boolean(window.__PACEFOLD_MA__));

    const scheduler=await page.evaluate(()=>{
      const cues=[{at:0,priority:3},{at:1,priority:2},{at:2,priority:5},{at:3,priority:1},{at:8,priority:3}];
      const delivered=window.__PACEFOLD_MA__.scheduler.simulate(cues,4);
      return delivered.map(item=>item.at);
    });
    assert(scheduler.every((at,index)=>index===0||at-scheduler[index-1]>=4),`Cue gap invariant failed: ${scheduler}`);

    const drift=await page.evaluate(()=>{globalThis.__notifications=[];const line=window.__PACEFOLD_MA__.reconcileDrift(Date.now(),4*60*60*1000);return {line,notifications:globalThis.__notifications.length,status:document.getElementById('statusLine')?.textContent};});
    assert(drift.notifications===0&&/^Back after 4h\./.test(drift.line||'')&&drift.status===drift.line,`Drift reconciliation failed: ${JSON.stringify(drift)}`);

    const ribbon=await page.evaluate(()=>{
      let layouts=0;const native=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){layouts++;return native.call(this);};
      window.__PACEFOLD_MA__.ribbon.tick();Element.prototype.getBoundingClientRect=native;
      const sequence=document.getElementById('sequence'),now=sequence?.querySelector('.pf-ribbon-now'),spent=sequence?.querySelector('.pf-ribbon-spent');
      return {layouts,ready:sequence?.dataset.pfMaRibbon,now:now?.style.transform,spent:spent?.style.transform};
    });
    assert(ribbon.layouts===0&&ribbon.ready==='true'&&/^translateX/.test(ribbon.now)&&/^scaleX/.test(ribbon.spent),`Ribbon tick contract failed: ${JSON.stringify(ribbon)}`);

    const keys=await page.evaluate(()=>{const before=Object.keys(JSON.parse(localStorage.getItem('pacefoldPrefsV15')));window.__PACEFOLD_MA__.writePrefs({minCueGap:7});const after=JSON.parse(localStorage.getItem('pacefoldPrefsV15'));return {before,missing:before.filter(key=>!(key in after)),schema:after.schemaVersion};});
    assert(keys.missing.length===0&&keys.schema>=18,`Additive prefs migration failed: ${JSON.stringify(keys)}`);

    await page.evaluate(()=>window.__PACEFOLD_MA__.quiet.on());
    const quiet=await page.evaluate(()=>({title:document.title,event:document.getElementById('eventName')?.textContent,status:document.getElementById('statusLine')?.textContent,tabs:[...document.querySelectorAll('.pf-notebook-tabs>button')].map(node=>node.textContent)}));
    assert(quiet.title==='Document'&&!/(prayer|water|lunch|meal|eyes|body|noodle)/i.test(JSON.stringify(quiet))&&!quiet.tabs.some(value=>/(incident|research|work)/i.test(value)),`Quiet DOM leak: ${JSON.stringify(quiet)}`);

    const wco=await page.evaluate(()=>({attr:document.documentElement.hasAttribute('data-pf-wco'),top:getComputedStyle(document.body).paddingTop}));
    assert(!wco.attr,'WCO absent fallback incorrectly activated');

    await page.screenshot({path:path.join(artifactRoot,'pacefold-ma-desktop.png'),fullPage:true});

    const wafer=await browser.newContext({viewport:{width:340,height:150}});
    await wafer.addInitScript(()=>localStorage.setItem('pacefoldPrefsV15',JSON.stringify({workHours:'08:30-16:30',clarity:'wafer',schemaVersion:18,workWeek:{mon:{start:'08:30',end:'16:30',type:'Desk'}}})));
    const waferPage=await wafer.newPage();await waferPage.goto(`http://127.0.0.1:${port}/app/`,{waitUntil:'networkidle'});await waferPage.waitForFunction(()=>Boolean(window.__PACEFOLD_MA__));
    const geometry=await waferPage.evaluate(()=>({scrollW:document.documentElement.scrollWidth,clientW:document.documentElement.clientWidth,scrollH:document.documentElement.scrollHeight,clientH:document.documentElement.clientHeight,player:document.getElementById('pf-local-player')?getComputedStyle(document.getElementById('pf-local-player')).display:null}));
    assert(geometry.scrollW<=geometry.clientW+1&&geometry.scrollH<=geometry.clientH+1&&(geometry.player===null||geometry.player==='none'),`Wafer overflow/player overlap: ${JSON.stringify(geometry)}`);
    await waferPage.screenshot({path:path.join(artifactRoot,'pacefold-ma-wafer.png'),fullPage:true});await wafer.close();

    const forced=await browser.newContext({viewport:{width:900,height:650},forcedColors:'active'});const forcedPage=await forced.newPage();await forcedPage.goto(`http://127.0.0.1:${port}/app/`,{waitUntil:'networkidle'});await forcedPage.waitForFunction(()=>Boolean(window.__PACEFOLD_MA__));
    const colors=await forcedPage.evaluate(()=>{const now=document.querySelector('.pf-ribbon-now'),meter=document.getElementById('waterMeter'),quiet=document.getElementById('pfQuietToggle');return {now:getComputedStyle(now).backgroundColor,meter:meter?getComputedStyle(meter,'::after').backgroundColor:null,outline:getComputedStyle(quiet).outlineStyle};});
    assert(colors.now!=='rgba(0, 0, 0, 0)'&&colors.meter!=='rgba(0, 0, 0, 0)',`Forced-colors primitives disappeared: ${JSON.stringify(colors)}`);await forced.close();

    assert(await page.evaluate(()=>!document.documentElement.classList.contains('pf-boot')),'Boot transition suppression did not clear after second frame');
    console.log(JSON.stringify({ok:true,scheduler,drift,ribbon,keys,quiet,wco,geometry,colors},null,2));
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error.stack||error);server.close();process.exit(1);});
