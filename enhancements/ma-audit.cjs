'use strict';

const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const site=path.resolve(process.argv[2]||'_site');
const artifacts=path.resolve(process.argv[3]||path.join(process.cwd(),'ma-audit-artifacts'));
const app=path.join(site,'app');
const fail=message=>{throw new Error(message);};
const assert=(condition,message)=>{if(!condition)fail(message);};
const read=file=>fs.readFileSync(file,'utf8');

function staticAudit(){
  const ma=read(path.join(app,'pacefold-ma.js')),css=read(path.join(app,'pacefold-ma.css')),core=read(path.join(app,'app.js')),html=read(path.join(app,'index.html')),manifest=JSON.parse(read(path.join(site,'manifest.webmanifest'))),worker=read(path.join(site,'service-worker.js'));
  assert(!/\.innerHTML\s*=/.test(ma),'Ma runtime contains a raw innerHTML assignment');
  assert(!/style\s*=\s*["']/.test(ma),'Ma runtime contains an inline style string');
  assert(fs.statSync(path.join(app,'fonts','pacefold-ma.woff2')).size<=15000,'Ma font subset exceeds 15 KB');
  for(const token of [
    '@property --pf-meter','--pf-ribbon-h','--pf-paper-live','data-clarity="wafer"','forced-colors:active',
    'prefers-reduced-motion:reduce','prefers-reduced-transparency:reduce','titlebar-area-width','app-region:drag',
    '.pf-ribbon-now','.pf-meter',':focus-visible'
  ])assert(css.includes(token),`Ma CSS token missing: ${token}`);
  for(const token of [
    'createScheduler','minCueGap','focusGraceMinutes','waitingCue','renderRibbon','simulateGap',
    'pacefold.backup.v1','allowAudioImport','navigator.storage.persist','windowControlsOverlay',
    'rhythmMarkdown','foldReviewDismissed','quietRestore'
  ])assert(ma.includes(token),`Ma runtime token missing: ${token}`);
  assert(core.includes('window.__PACEFOLD_MA_SCHEDULER__?.request'),'Core does not route cues through the Ma scheduler');
  assert(core.includes('window.__PACEFOLD_MA_SCHEDULER__?.updateBadge'),'Core does not route badges through the Ma scheduler');
  assert(core.includes('function reconcileMaDrift')&&core.includes('reconcileDrift:reconcileMaDrift'),'Expired timer reconciliation is not owned by the core');
  assert(!/\b(?:noodleDone|lunchDone)\s*=/.test(ma),'The Ma observer completes a core-owned timer directly');
  assert((core.match(/await registration\.showNotification/g)||[]).length===1,'Core has more than one low-level notification delivery path');
  const ribbonStart=ma.indexOf('function renderRibbon('),ribbonEnd=ma.indexOf('\n  function setMinute',ribbonStart),ribbon=ma.slice(ribbonStart,ribbonEnd);
  assert(ribbonStart>=0&&ribbonEnd>ribbonStart,'Ribbon function could not be isolated');
  assert(!/requestAnimationFrame|getBoundingClientRect|offsetWidth|offsetHeight|getComputedStyle/.test(ribbon),'Ribbon tick contains forced layout or animation-frame work');
  assert((html.match(/data-pacefold-theme-boot=/g)||[]).length===1,'Theme boot was not injected exactly once');
  assert((html.match(/data-pacefold-ma=/g)||[]).length===2,'Ma CSS and script were not injected exactly once');
  assert(html.indexOf('pacefold-theme-boot.js')<html.indexOf('app-style-01.css'),'Theme boot does not precede the first stylesheet');
  assert(html.indexOf('pacefold-ma.js')<html.indexOf('src="./app.js"'),'Ma scheduler does not load before the core');
  assert(JSON.stringify(manifest.display_override)===JSON.stringify(['window-controls-overlay','standalone']),'Manifest WCO fallback order is wrong');
  for(const asset of ['pacefold-ma.css','pacefold-theme-boot.js','pacefold-ma.js','pacefold-hub-guardian.js','pacefold-resilience.js','pacefold-hub.js','pacefold-integrated.js','pacefold-revamp.js','pacefold-fold-mark.svg','fonts/pacefold-ma.woff2'])assert(worker.includes(asset),`Offline shell omits ${asset}`);
  assert(worker.includes('caches.match(request,{ignoreSearch:true})'),'Offline worker does not resolve cache-busted asset URLs');
  return{ma,css,core};
}

function defaultKeys(core){
  const marker='const DEFAULTS=',start=core.indexOf(marker),open=core.indexOf('{',start),keys=new Set();
  assert(start>=0&&open>start,'DEFAULTS object could not be found');
  let depth=0,quote='',escaped=false,expectKey=false;
  for(let index=open;index<core.length;index+=1){
    const character=core[index];
    if(quote){
      if(escaped)escaped=false;
      else if(character==='\\')escaped=true;
      else if(character===quote)quote='';
      continue;
    }
    if(character==="'"||character==='"`'||character==='"'){quote=character;continue;}
    if(character==='{'){depth+=1;if(depth===1)expectKey=true;continue;}
    if(character==='}'){depth-=1;if(depth===0)break;continue;}
    if(depth!==1)continue;
    if(character===','){expectKey=true;continue;}
    if(!expectKey||/\s/.test(character))continue;
    const match=core.slice(index).match(/^([A-Za-z][A-Za-z0-9]*)\s*:/);
    if(match){keys.add(match[1]);index+=match[0].length-1;expectKey=false;}
    else expectKey=false;
  }
  assert(keys.size>70,`DEFAULTS parser found only ${keys.size} keys`);
  return [...keys];
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
        response.writeHead(200,{'content-type':type,'cache-control':'no-store'});response.end(buffer);
      });
    });
    server.listen(0,'127.0.0.1',()=>resolve(server));
  });
}

async function browserAudit(core){
  fs.mkdirSync(artifacts,{recursive:true});
  const server=await serve(),port=server.address().port,base=`http://127.0.0.1:${port}`,browser=await chromium.launch({
    headless:true,
    executablePath:process.env.PACEFOLD_CHROMIUM_PATH||undefined
  });
  const errors=[];
  try{
    const context=await browser.newContext({viewport:{width:1120,height:820},reducedMotion:'no-preference'});
    await context.addInitScript(()=>{
      const now=Date.now(),date=new Date(),key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      localStorage.setItem('pacefoldOnboardedV15','1');
      localStorage.setItem('pacefoldSetupDismissedV15','1');
      localStorage.setItem('pacefoldPrefsV15',JSON.stringify({profile:'original',theme:'paper',privacy:false,clarity:'discreet',workdaysOnly:false,workHours:'00:00-23:59',workReminders:true,showWorkline:true,dayCloseEnabled:false,lastSeenAt:now-4*3600000,activityDate:key,waterDate:key,noodleStart:now-2*3600000,noodleDurationAtStart:30,lunchStart:now-2*3600000,lunchDurationAtStart:20,lunchModeAtStart:'desk'}));
      window.__maNotices=[];addEventListener('pacefold:notification',event=>window.__maNotices.push(event.detail));
    });
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto(`${base}/app/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__PACEFOLD_MA_CORE__&&window.__PACEFOLD_MA_AUDIT__&&document.querySelector('#sequence.pf-day-ribbon'));
    await page.waitForFunction(()=>!document.documentElement.classList.contains('pf-boot'));

    const scheduler=await page.evaluate(()=>window.__PACEFOLD_MA_AUDIT__.simulateScheduler([
      {source:'water',at:0},{source:'prayer',at:0},{source:'eyes',at:0},{source:'body',at:1}
    ],4));
    for(let index=1;index<scheduler.length;index+=1)assert(scheduler[index].at-scheduler[index-1].at>=4,`Cue gap invariant failed: ${JSON.stringify(scheduler)}`);
    const drift=await page.evaluate(()=>window.__PACEFOLD_MA_AUDIT__.simulateGap(4));
    assert(drift.lines===1&&drift.backlogDeliveries===0,`Drift simulation failed: ${JSON.stringify(drift)}`);
    await page.waitForTimeout(120);
    const driftState=await page.evaluate(()=>({status:document.getElementById('statusLine')?.innerText,notices:window.__maNotices.length,prefs:JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}')}));
    assert(/Back after 4h/i.test(driftState.status),`Four-hour drift did not produce one consolidated status: ${driftState.status}`);
    assert(driftState.notices===0,`Four-hour drift delivered ${driftState.notices} backlog cue(s)`);
    assert(Math.abs(Date.now()-driftState.prefs.waterLastAt)<30000&&Math.abs(Date.now()-driftState.prefs.gazeLastAt)<30000&&Math.abs(Date.now()-driftState.prefs.bodyLastAt)<30000,'Drift did not re-anchor low-priority cadences');
    assert(!driftState.prefs.noodleStart&&!driftState.prefs.lunchStart&&driftState.prefs.noodleDone&&driftState.prefs.lunchDone&&driftState.prefs.lunchSessions.length===1,`Core did not silently resolve timers that expired during the gap: ${JSON.stringify({noodleStart:driftState.prefs.noodleStart,noodleDone:driftState.prefs.noodleDone,lunchStart:driftState.prefs.lunchStart,lunchDone:driftState.prefs.lunchDone,lunchSessions:driftState.prefs.lunchSessions})}`);
    assert(Object.values(driftState.prefs.workWeek).every(day=>day.type==='desk'),'workWeek migration did not preserve workdaysOnly=false');

    const defaults=defaultKeys(core),prefs=await page.evaluate(()=>window.__PACEFOLD_MA_CORE__.updatePrefs({schemaVersion:18}));
    const missing=defaults.filter(key=>!(key in prefs));assert(!missing.length,`15.2.2 preference keys were dropped: ${missing.join(', ')}`);

    const ribbon=await page.evaluate(()=>({children:document.querySelectorAll('#sequence>*').length,now:getComputedStyle(document.querySelector('.pf-ribbon-now')).display,progress:document.getElementById('sequence').style.getPropertyValue('--pf-ribbon-progress'),legacyStrip:Boolean(document.querySelector('.fold-strip[data-pf-fold-strip]')),legacyProgress:getComputedStyle(document.querySelector('.progress')).display}));
    assert(ribbon.children>=3&&ribbon.now!=='none'&&ribbon.progress!==''&&!ribbon.legacyStrip&&ribbon.legacyProgress==='none',`Day Ribbon did not replace the legacy progress surfaces: ${JSON.stringify(ribbon)}`);
    await page.evaluate(()=>{const sequence=document.getElementById('sequence');window.__maRibbonSnapshot={nodes:[...sequence.children],progress:sequence.style.getPropertyValue('--pf-ribbon-progress'),now:sequence.querySelector('.pf-ribbon-now').style.getPropertyValue('--pf-ribbon-x')};});
    await page.waitForTimeout(1150);
    const secondTick=await page.evaluate(()=>{const sequence=document.getElementById('sequence'),snapshot=window.__maRibbonSnapshot;return{sameNodes:snapshot.nodes.every((node,index)=>sequence.children[index]===node),sameProgress:snapshot.progress===sequence.style.getPropertyValue('--pf-ribbon-progress'),nowMoved:snapshot.now!==sequence.querySelector('.pf-ribbon-now').style.getPropertyValue('--pf-ribbon-x')};});
    assert(secondTick.sameNodes&&secondTick.sameProgress&&secondTick.nowMoved,`Ribbon second tick performed more than the now-marker transform: ${JSON.stringify(secondTick)}`);
    const options=await page.evaluate(()=>({count:document.querySelectorAll('.pf-ritual-options').length,body:Boolean(document.querySelector('#careBtn + .pf-ritual-options'))}));
    assert(options.count===6&&options.body,`Visible ritual option paths are incomplete: ${JSON.stringify(options)}`);
    const privateRibbon=await page.evaluate(()=>{window.__PACEFOLD_MA_CORE__.updatePrefs({privacy:true});const sequence=document.getElementById('sequence');return{private:sequence.dataset.private,kinds:[...sequence.querySelectorAll('[data-kind]')].map(node=>node.dataset.kind),labels:[...sequence.querySelectorAll('[aria-label]')].map(node=>node.getAttribute('aria-label'))};});
    assert(privateRibbon.private==='true'&&privateRibbon.kinds.every(kind=>kind==='moment'||kind==='interval')&&privateRibbon.labels.every(label=>label==='Scheduled crease'),'Private ribbon retained differentiated content');
    await page.evaluate(()=>window.__PACEFOLD_MA_CORE__.updatePrefs({privacy:false}));

    const quietBefore=await page.evaluate(()=>{const prefs=JSON.parse(localStorage.getItem('pacefoldPrefsV15'));return Object.fromEntries(['privacy','clarity','notificationDetail','taskbarBadge','taskbarBadgeMode','notificationMode'].map(key=>[key,prefs[key]]));});
    await page.locator('#pf-quiet-toggle').click();
    await page.waitForFunction(()=>document.body.dataset.quiet==='true');
    await page.evaluate(()=>{const marker=document.createElement('span');marker.textContent='Research';document.getElementById('pf-local-workspace').append(marker);});
    await page.waitForTimeout(80);
    const quiet=await page.evaluate(()=>{
      const text=document.body.textContent||'',labels=[...document.querySelectorAll('[aria-label],[title]')].flatMap(node=>[node.getAttribute('aria-label'),node.getAttribute('title')]).filter(Boolean).join(' ');
      return{text,labels,title:document.title,event:document.getElementById('eventName')?.textContent,badge:JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}').taskbarBadgeMode};
    });
    const sensitive=/\b(?:fajr|dhuhr|asr|maghrib|isha|prayer|water|sip|noodle|prep|lunch|meal|away|eye|movement|inbox|follow-ups?|incidents?|inspections?|jhsc|construction|notifications?|resources?)\b/i;
    assert(!sensitive.test(quiet.text)&&!/\bResearch\b/.test(quiet.text),`Quiet left cue/category text in the DOM: ${quiet.text.match(sensitive)?.[0]||'Research'}`);
    assert(!sensitive.test(quiet.labels),`Quiet left cue/category accessibility text in the DOM: ${quiet.labels.match(sensitive)?.[0]}`);
    assert(quiet.title==='Clock'&&quiet.event===''&&quiet.badge==='off',`Quiet did not apply its complete safe-surface contract: ${JSON.stringify({title:quiet.title,event:quiet.event,badge:quiet.badge,errors})}`);
    await page.locator('#pf-quiet-toggle').click();
    await page.waitForFunction(()=>document.body.dataset.quiet==='false');
    const quietAfter=await page.evaluate(()=>{const prefs=JSON.parse(localStorage.getItem('pacefoldPrefsV15'));return Object.fromEntries(['privacy','clarity','notificationDetail','taskbarBadge','taskbarBadgeMode','notificationMode'].map(key=>[key,prefs[key]]));});
    assert(JSON.stringify(quietAfter)===JSON.stringify(quietBefore),`Quiet did not restore the previous values exactly: ${JSON.stringify({quietBefore,quietAfter})}`);

    await page.screenshot({path:path.join(artifacts,'pacefold-ma-desktop.png'),fullPage:true});
    const workerReady=await page.evaluate(async()=>Boolean(await Promise.race([navigator.serviceWorker?.ready,new Promise(resolve=>setTimeout(()=>resolve(null),5000))])));
    assert(workerReady,'Offline worker did not become ready on first run');
    const controllerReady=await page.evaluate(async()=>{
      if(navigator.serviceWorker.controller)return true;
      return Boolean(await Promise.race([new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(navigator.serviceWorker.controller),{once:true})),new Promise(resolve=>setTimeout(()=>resolve(null),5000))]));
    });
    assert(controllerReady,'Offline worker did not claim the first-run page');
    await context.setOffline(true);
    const offlinePage=await context.newPage();
    await offlinePage.goto(`${base}/app/`,{waitUntil:'domcontentloaded'});
    await offlinePage.waitForFunction(()=>window.__PACEFOLD_MA_CORE__&&document.querySelector('#sequence.pf-day-ribbon'),null,{timeout:12000});
    const offline=await offlinePage.evaluate(async()=>({themeBoot:Boolean(document.documentElement.dataset.pfTheme),font:(await document.fonts.load('16px "Pacefold Ma"')).length>0,ma:window.__PACEFOLD_MA_AUDIT__?.release}));
    assert(offline.themeBoot&&offline.font&&offline.ma==='18.0.0',`Ma first-run cache failed offline: ${JSON.stringify(offline)}`);
    await offlinePage.close();
    await context.setOffline(false);
    await context.close();

    const waferContext=await browser.newContext({viewport:{width:340,height:150}});
    await waferContext.addInitScript(()=>{localStorage.setItem('pacefoldOnboardedV15','1');localStorage.setItem('pacefoldSetupDismissedV15','1');localStorage.setItem('pacefoldPrefsV15',JSON.stringify({clarity:'wafer',privacy:true,workdaysOnly:false,workHours:'00:00-23:59',dayCloseEnabled:false,waferPromptDismissed:true}));});
    const wafer=await waferContext.newPage();wafer.on('pageerror',error=>errors.push(error.message));
    await wafer.goto(`${base}/app/`,{waitUntil:'networkidle'});await wafer.waitForFunction(()=>document.querySelector('#sequence.pf-day-ribbon'));
    const geometry=await wafer.evaluate(()=>({
      horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth,
      vertical:document.documentElement.scrollHeight<=document.documentElement.clientHeight,
      player:getComputedStyle(document.getElementById('pf-local-player')).display,
      workline:getComputedStyle(document.getElementById('workline')).display,
      time:getComputedStyle(document.querySelector('.time-row')).display,
      status:getComputedStyle(document.getElementById('statusLine')).display,
      wco:document.body.dataset.wco
    }));
    assert(geometry.horizontal&&geometry.vertical,`Wafer overflowed 340x150: ${JSON.stringify(geometry)}`);
    assert(geometry.player==='none'&&geometry.workline==='none'&&geometry.time!=='none'&&geometry.status!=='none','Wafer visibility contract failed');
    assert(geometry.wco==='off','WCO fallback did not remain inactive when the API was absent');
    await wafer.screenshot({path:path.join(artifacts,'pacefold-ma-wafer.png')});
    await waferContext.close();

    const forcedContext=await browser.newContext({viewport:{width:900,height:700},forcedColors:'active'});
    await forcedContext.addInitScript(()=>{localStorage.setItem('pacefoldOnboardedV15','1');localStorage.setItem('pacefoldSetupDismissedV15','1');});
    const forced=await forcedContext.newPage();await forced.goto(`${base}/app/`,{waitUntil:'networkidle'});await forced.waitForFunction(()=>document.querySelector('.pf-ribbon-now'));
    const forcedState=await forced.evaluate(()=>{
      const ribbon=document.querySelector('#sequence.pf-day-ribbon');
      const now=ribbon.querySelector('.pf-ribbon-now');
      const crease=document.querySelector('.pf-ribbon-crease')||ribbon.appendChild(Object.assign(document.createElement('button'),{className:'pf-ribbon-crease'}));
      const meter=document.querySelector('.pf-meter')||document.body.appendChild(Object.assign(document.createElement('span'),{className:'pf-meter'}));
      return{
        now:getComputedStyle(now).backgroundColor,
        crease:getComputedStyle(crease).backgroundColor,
        meter:getComputedStyle(meter).borderStyle,
        focusRule:[...document.styleSheets].some(sheet=>{try{return[...sheet.cssRules].some(rule=>String(rule.cssText).includes('forced-colors'));}catch{return false;}})
      };
    });
    assert(forcedState.now&&forcedState.crease&&forcedState.meter!=='none'&&forcedState.focusRule,`Forced-colour primitives are incomplete: ${JSON.stringify(forcedState)}`);
    await forcedContext.close();
    assert(!errors.length,`Browser errors: ${errors.join(' | ')}`);
  }finally{
    await browser.close().catch(()=>{});
    server.closeAllConnections?.();server.close();
  }
}

async function main(){
  const {core}=staticAudit();
  await browserAudit(core);
  console.log('Pacefold 18.0 Ma audit passed: scheduler, drift, ribbon cost, wafer geometry, WCO fallback, forced colours, boot, preferences, Quiet and single-copy injection.');
}

main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
