'use strict';
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const site=path.resolve(process.argv[2]||'_release');
const artifacts=path.resolve(process.argv[3]||'/tmp/pacefold-action-dock-artifacts');
const assert=(ok,message)=>{if(!ok)throw new Error(message)};
const dayKey=()=>{const value=new Date();return new Date(value-value.getTimezoneOffset()*60000).toISOString().slice(0,10)};

function prefs(){
  const week={};for(let day=0;day<7;day++)week[day]={start:'08:30',end:'16:30',type:day>0&&day<6?'desk':'off'};
  return{profile:'original',schemaVersion:18,theme:'paper',privacy:false,quietMode:false,timeFormat:'12',showSeconds:true,workHours:'08:30-16:30',workWeek:week,workdaysOnly:false,workReminders:true,gazeEnabled:true,bodyEnabled:true,notifications:true,browserNotif:true,notificationMode:'quiet',taskbarBadge:true,taskbarBadgeMode:'due',waterTarget:24,sipCadence:30,waterSips:2,prepPreset:'noodles',noodleMinutes:30,waferPromptDismissed:true,activityDate:dayKey(),waterDate:dayKey()};
}
function serve(){return new Promise(resolve=>{const server=http.createServer((request,response)=>{let pathname='/';try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname)}catch{}let file=path.join(site,pathname.replace(/^\/+/,''));if(pathname.endsWith('/'))file=path.join(file,'index.html');if(!file.startsWith(site)){response.writeHead(403);response.end();return}fs.readFile(file,(error,buffer)=>{if(error){response.writeHead(404);response.end();return}const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';response.writeHead(200,{'content-type':type,'cache-control':'no-store'});response.end(buffer)})});server.listen(0,'127.0.0.1',()=>resolve(server))})}
async function wait(page,label,predicate,arg=null,timeout=12000){try{await page.waitForFunction(predicate,arg,{timeout})}catch{throw new Error(`${label} did not settle`)}}
async function stored(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}'))}

(async()=>{
  fs.mkdirSync(artifacts,{recursive:true});
  const server=await serve(),base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true}),errors=[];
  try{
    const context=await browser.newContext({viewport:{width:1180,height:820}});
    await context.addInitScript(settings=>{localStorage.setItem('pacefoldPrefsV15',JSON.stringify(settings));localStorage.setItem('pacefoldOnboardedV15','1');localStorage.setItem('pacefoldSetupDismissedV15','1')},prefs());
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&!/ERR_(?:INTERNET_DISCONNECTED|FAILED)/.test(message.text()))errors.push(message.text())});
    await page.goto(`${base}/app/`,{waitUntil:'domcontentloaded',timeout:30000});
    await wait(page,'Action dock startup',()=>window.__PACEFOLD_ACTION_DOCK__?.revision==='action-dock-r1'&&document.getElementById('pf23-action-dock'));
    await page.waitForTimeout(700);

    const initial=await page.evaluate(()=>({
      count:document.querySelectorAll('.pf23-action-grid .pf23-action').length,
      oldHidden:getComputedStyle(document.querySelector('.pf22-rituals')).display,
      labels:[...document.querySelectorAll('.pf23-action-grid .pf23-action strong')].map(node=>node.textContent),
      details:[...document.querySelectorAll('.pf23-action-grid .pf23-action small')].map(node=>node.textContent),
      width:document.documentElement.scrollWidth,viewport:innerWidth
    }));
    assert(initial.count===6,`Expected six real quick actions: ${JSON.stringify(initial)}`);
    assert(initial.oldHidden==='none',`Generic proxy controls are still visible: ${JSON.stringify(initial)}`);
    assert(initial.labels[0]==='Log sip'&&initial.labels[1]==='Start 30m'&&initial.labels.includes('Rest')&&initial.labels.includes('Meal')&&initial.labels.includes('Eye reset')&&initial.labels.includes('Move'),`Action labels are unclear: ${JSON.stringify(initial.labels)}`);
    assert(initial.details[0].includes('2/24 today'),`Water progress is missing: ${JSON.stringify(initial.details)}`);
    assert(initial.width<=initial.viewport,`Action dock overflows desktop: ${JSON.stringify(initial)}`);

    await page.evaluate(()=>window.__PACEFOLD_MA_QUIET__.set(true));
    await page.waitForTimeout(180);
    const quietOn=await page.evaluate(()=>{
      const stored=JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}'),core=window.__PACEFOLD_MA_CORE__?.getPrefs?.()||{};
      return{body:document.body.dataset.quiet,root:document.getElementById('pf22-spatial-root')?.dataset.quiet,stored:stored.quietMode,core:core.quietMode,api:window.__PACEFOLD_MA_QUIET__?.get?.(),title:document.title};
    });
    assert(quietOn.body==='true'&&quietOn.stored===true&&quietOn.core===true&&quietOn.api===true,`Quiet enable state diverged: ${JSON.stringify(quietOn)}`);
    await page.evaluate(()=>window.__PACEFOLD_MA_QUIET__.set(false));
    await page.waitForTimeout(180);
    const quietOff=await page.evaluate(()=>{
      const stored=JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}'),core=window.__PACEFOLD_MA_CORE__?.getPrefs?.()||{};
      return{body:document.body.dataset.quiet,root:document.getElementById('pf22-spatial-root')?.dataset.quiet,stored:stored.quietMode,core:core.quietMode,api:window.__PACEFOLD_MA_QUIET__?.get?.()};
    });
    assert(quietOff.body==='false'&&quietOff.stored===false&&quietOff.core===false&&quietOff.api===false,`Quiet disable state diverged: ${JSON.stringify(quietOff)}`);

    await page.locator('#pf23-action-water').click();
    await wait(page,'Sip logging',()=>{const value=JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}');return Number(value.waterSips)===3&&document.querySelector('#pf23-action-water small')?.textContent.includes('3/24 today')});

    await page.locator('#pf23-action-noodle').click();
    await wait(page,'Timer start',()=>{const value=JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}');return Number(value.noodleStart)>0&&/^Timer /.test(document.querySelector('#pf23-action-noodle strong')?.textContent||'')});
    await page.locator('#pf23-action-noodle').click();
    await wait(page,'Timer stop',()=>!JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}').noodleStart);

    await page.locator('#pf23-action-away').click();
    await wait(page,'Rest start',()=>{const value=JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}');return Number(value.awayStart)>0&&/^Back/.test(document.querySelector('#pf23-action-away strong')?.textContent||'')});
    await page.waitForTimeout(1100);await page.locator('#pf23-action-away').click();
    await wait(page,'Rest finish',()=>{const value=JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}');return !value.awayStart&&Array.isArray(value.awaySessions)&&value.awaySessions.length===1});

    await page.locator('#pf23-action-lunch').click();
    await wait(page,'Meal start',()=>Number(JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}').lunchStart)>0);
    await page.locator('#pf23-action-lunch').click();
    await wait(page,'Meal finish',()=>{const value=JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}');return !value.lunchStart&&Array.isArray(value.lunchSessions)&&value.lunchSessions.length===1});

    await page.evaluate(()=>{window.__PACEFOLD_CUES__.add('dock-water','water',60000);window.__PACEFOLD_CUES__.add('dock-prayer','prayer',60000)});
    await wait(page,'Coloured cues',()=>document.querySelectorAll('#pf23-action-cues .pf23-cue').length===2);
    const cues=await page.evaluate(()=>[...document.querySelectorAll('#pf23-action-cues .pf23-cue')].map(node=>({source:node.dataset.source,color:getComputedStyle(node.querySelector('.pf23-cue-dot')).backgroundColor})));
    assert(cues.some(item=>item.source==='water')&&cues.some(item=>item.source==='prayer')&&new Set(cues.map(item=>item.color)).size===2,`Cue colours collapsed: ${JSON.stringify(cues)}`);
    await page.locator('#pf23-action-cues .pf23-cue[data-source="water"]').click();
    await wait(page,'Cue acknowledgement',()=>!window.__PACEFOLD_CUES__.sources().includes('water')&&window.__PACEFOLD_CUES__.sources().includes('prayer'));
    await page.evaluate(()=>window.__PACEFOLD_CUES__.clear());

    await page.locator('.pf23-action-log').click();
    await wait(page,'Direct Worklog',()=>document.getElementById('pf22-spatial-root')?.dataset.mode==='worklog');
    await page.screenshot({path:path.join(artifacts,'pacefold-action-dock.png')});
    assert(!errors.length,`Browser errors: ${errors.join(' | ')}`);
    const final=await stored(page);assert(final.waterSips===4,'Water cue click did not execute the quick action');
    await context.close();
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
  console.log('Pacefold action dock interaction audit passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
