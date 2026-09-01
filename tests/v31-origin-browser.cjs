'use strict';

const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const{chromium}=require('playwright');

const site=path.resolve(process.argv[2]||'_site');
const output=path.resolve(process.argv[3]||'/tmp/pacefold-31-audit');
fs.mkdirSync(output,{recursive:true});

function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((request,response)=>{
      let pathname='/';
      try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname)}catch{}
      let file=path.join(site,pathname.replace(/^\/+/,''));
      if(pathname.endsWith('/'))file=path.join(file,'index.html');
      fs.readFile(file,(error,data)=>{
        if(error){response.writeHead(404);response.end();return}
        const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}[path.extname(file)]||'application/octet-stream';
        response.writeHead(200,{'content-type':type,'cache-control':'no-store'});response.end(data);
      });
    });
    server.listen(0,'127.0.0.1',()=>resolve({server,origin:`http://127.0.0.1:${server.address().port}`}));
  });
}

function seed(){
  const now=Date.now();
  localStorage.setItem('pacefoldPrefsV15',JSON.stringify({
    profile:'original',rhythmDiscretion:'neutral',timeZone:'America/Toronto',locationLabel:'Etobicoke, Toronto',
    lat:43.6205,lng:-79.5132,method:'15',asr:'hanafi',showSeconds:true,timeFormat:'12',
    workHours:'00:00-23:59',workDays:[0,1,2,3,4,5,6],notifications:false,quietMode:false,
    weatherEnabled:false,waterTarget:24,waterStep:2,waterOz:0,waterLastAt:now-20*60000,
    waterCadence:45,gazeLastCompleted:now,eyeCadence:30,bodyLastCompleted:now,bodyCadence:45,
    noteCategories:['Note','Follow-up','Decision','Inspection','JHSC','Idea']
  }));
  localStorage.setItem('pacefoldOnboardedV15','1');
  localStorage.setItem('pacefoldSetupDismissedV15','1');
}

async function ready(page,url){
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__PACEFOLD__?.version==='31.0.0'&&document.documentElement.classList.contains('ready'));
  await page.waitForTimeout(350);
}

async function inspect(page){
  return page.evaluate(()=>{
    const rect=selector=>{const node=document.querySelector(selector);if(!node)return null;const box=node.getBoundingClientRect(),style=getComputedStyle(node);return{x:box.x,y:box.y,width:box.width,height:box.height,right:box.right,bottom:box.bottom,display:style.display,visibility:style.visibility,opacity:Number(style.opacity)}};
    return{
      viewport:{width:innerWidth,height:innerHeight},
      scrollWidth:document.documentElement.scrollWidth,
      mode:document.documentElement.dataset.mode,
      cover:document.documentElement.dataset.cover,
      activeElement:document.activeElement?.id||document.activeElement?.tagName||'',
      coverBox:rect('#pace-cover'),hero:rect('.pace-cover .cover-hero'),search:rect('.pace-cover .cover-omnibox'),
      music:rect('#cover-music-open'),peel:rect('#cover-peel'),stage:rect('#stage'),clock:rect('.clock-card'),
      rhythm:rect('.rhythm-card'),daybook:rect('.daybook-fold'),composer:rect('#clock-note-input'),mobileNav:rect('.mobile-nav'),
      seconds:rect('#clock-seconds'),secondHand:rect('.hand-second'),setupOpen:Boolean(document.getElementById('setup-dialog')?.open),
      stageInert:document.getElementById('stage')?.inert===true,
      coverBackground:getComputedStyle(document.getElementById('pace-cover'),'::before').backgroundImage,
      bodyBackground:getComputedStyle(document.body).backgroundImage,
      clockBackground:getComputedStyle(document.querySelector('.clock-card')).backgroundImage
    };
  });
}

function requireState(condition,message,state){if(!condition)throw new Error(`${message}\n${JSON.stringify(state,null,2)}`)}
const visible=box=>Boolean(box&&box.display!=='none'&&box.visibility!=='hidden'&&box.opacity>.01&&box.width>0&&box.height>0);
const inside=(box,viewport)=>Boolean(box&&box.x>=-1&&box.right<=viewport.width+1&&box.y>=-1&&box.bottom<=viewport.height+1);

async function main(){
  const{server,origin}=await serve();let browser;
  try{
    browser=await chromium.launch({headless:true});
    const errors=[];
    const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Toronto',colorScheme:'light',serviceWorkers:'block'});
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(`pageerror: ${error.stack||error.message}`));
    page.on('console',message=>{if(message.type()==='error'&&!/Service Worker registration blocked by Playwright/i.test(message.text()))errors.push(`console: ${message.text()}`)});
    await page.addInitScript(seed);

    await ready(page,`${origin}/app/`);
    let state=await inspect(page);
    requireState(state.cover==='on'&&state.stageInert,'Ordinary visits must begin on an inert scenic cover',state);
    requireState(visible(state.coverBox)&&inside(state.hero,state.viewport)&&inside(state.search,state.viewport)&&inside(state.peel,state.viewport),'Desktop cover controls must remain inside the viewport',state);
    requireState(state.search.height>=48&&state.search.height<=68&&state.peel.height>=44,'Desktop cover targets do not meet the release geometry',state);
    requireState(!state.music||state.music.right<=state.viewport.width+1,'Music control is clipped on the cover',state);
    requireState(/daily-image|homepage-default/.test(state.coverBackground),'The scenic cover does not own the daily image',state);
    requireState(state.activeElement!=='cover-search'&&!state.setupOpen,'The cover must not steal focus or reopen setup',state);
    requireState(state.scrollWidth<=state.viewport.width+1,'Desktop cover has horizontal overflow',state);
    await page.screenshot({path:path.join(output,'v31-desktop-homepage.png'),fullPage:false});

    await page.click('#cover-peel');
    await page.waitForFunction(()=>document.documentElement.dataset.cover==='peeled');
    await page.waitForTimeout(220);
    state=await inspect(page);
    requireState(state.mode==='home'&&!state.stageInert&&state.coverBox.display==='none','Open Clock did not reveal the working surface',state);
    requireState(visible(state.clock)&&visible(state.rhythm)&&visible(state.daybook)&&visible(state.composer),'Clock, rhythm and persistent Daybook must coexist',state);
    requireState(visible(state.seconds)&&visible(state.secondHand),'Visible seconds and the second hand were lost',state);
    requireState(!/daily-image|homepage-default/.test(`${state.bodyBackground} ${state.clockBackground}`),'The scenic photograph leaked into the working Clock',state);
    requireState(state.clock.width>=700&&state.rhythm.width>=260&&state.rhythm.width<=330,'Desktop Clock proportions no longer match the calm folio',state);
    requireState(state.scrollWidth<=state.viewport.width+1,'Working Clock has horizontal overflow',state);
    await page.screenshot({path:path.join(output,'v31-desktop-clock.png'),fullPage:false});
    await page.screenshot({path:path.join(output,'v31-desktop-clock-full.png'),fullPage:true});

    const marker=`Origin restoration ${Date.now()}`;
    await page.locator('#clock-note-input').fill(marker);
    await page.locator('#clock-note-input').press('Enter');
    await page.waitForFunction(value=>window.__PACEFOLD__.notes.some(note=>note.body===value),marker);
    requireState((await page.evaluate(()=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'{"items":[]}').items?.length||0))===1,'Clock note was not persisted locally',await inspect(page));

    for(const [mode,file,selector]of [
      ['notes','v31-desktop-notes.png','.view-notes'],
      ['worklog','v31-desktop-day.png','.view-worklog'],
      ['now','v31-desktop-now.png','.view-now'],
      ['settings','v31-desktop-settings.png','.view-settings']
    ]){
      await page.evaluate(target=>window.__PACEFOLD__.go(target),mode);await page.waitForTimeout(180);
      const box=await page.locator(selector).boundingBox();
      requireState(Boolean(box&&box.width>0),`${mode} fold did not open`,await inspect(page));
      await page.screenshot({path:path.join(output,file),fullPage:false});
    }

    await ready(page,`${origin}/app/?mode=notes`);
    state=await inspect(page);
    requireState(state.cover==='peeled'&&state.mode==='notes'&&!state.stageInert,'Direct fold links must bypass the cover',state);
    requireState(await page.locator('.note-item', {hasText:marker}).count()===1,'The persisted Clock note did not survive navigation and reload',state);
    await context.close();

    const mobile=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Toronto',colorScheme:'light',serviceWorkers:'block'});
    const phone=await mobile.newPage();
    phone.on('pageerror',error=>errors.push(`mobile pageerror: ${error.stack||error.message}`));
    phone.on('console',message=>{if(message.type()==='error'&&!/Service Worker registration blocked by Playwright/i.test(message.text()))errors.push(`mobile console: ${message.text()}`)});
    await phone.addInitScript(seed);
    await ready(phone,`${origin}/app/`);
    state=await inspect(phone);
    requireState(state.cover==='on'&&inside(state.hero,state.viewport)&&inside(state.search,state.viewport)&&inside(state.peel,state.viewport),'Mobile homepage is clipped',state);
    requireState(state.search.height>=48&&state.peel.height>=44&&(!state.music||state.music.right<=state.viewport.width+1),'Mobile homepage controls fail touch geometry',state);
    requireState(state.scrollWidth<=state.viewport.width+1&&!state.setupOpen,'Mobile homepage overflows or reopens setup',state);
    await phone.screenshot({path:path.join(output,'v31-mobile-homepage.png'),fullPage:false});

    await phone.click('#cover-peel');await phone.waitForFunction(()=>document.documentElement.dataset.cover==='peeled');await phone.waitForTimeout(220);
    state=await inspect(phone);
    requireState(visible(state.clock)&&visible(state.daybook)&&visible(state.composer)&&visible(state.mobileNav),'Mobile Clock lost the instrument, navigation or Daybook',state);
    requireState(state.clock.right<=state.viewport.width+1&&state.daybook.right<=state.viewport.width+1&&state.scrollWidth<=state.viewport.width+1,'Mobile working surface is horizontally clipped',state);
    requireState(visible(state.seconds)&&visible(state.secondHand),'Mobile Clock hides seconds',state);
    await phone.screenshot({path:path.join(output,'v31-mobile-clock.png'),fullPage:false});
    await phone.screenshot({path:path.join(output,'v31-mobile-clock-full.png'),fullPage:true});
    await phone.evaluate(()=>window.__PACEFOLD__.go('notes'));await phone.waitForTimeout(180);
    await phone.screenshot({path:path.join(output,'v31-mobile-notes.png'),fullPage:false});
    await phone.evaluate(()=>window.__PACEFOLD__.go('settings'));await phone.waitForTimeout(180);
    await phone.screenshot({path:path.join(output,'v31-mobile-settings.png'),fullPage:false});
    await mobile.close();

    requireState(errors.length===0,'Browser errors were recorded',{errors});
    console.log(JSON.stringify({release:'31.0.0',revision:'origin-r1',screenshots:fs.readdirSync(output).sort(),errors},null,2));
  }finally{
    if(browser)await browser.close();
    server.close();
  }
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1});
