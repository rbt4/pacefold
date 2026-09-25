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
      music:rect('#cover-music-open'),peel:rect('#cover-peel'),stage:rect('#stage'),clock:rect('.dial-wrap'),
      week:rect('.horizon-left .week-sky'),keys:rect('.horizon-right .action-dock'),moments:document.querySelectorAll('.dial-moments .moment').length,daybook:rect('.daybook-fold'),composer:rect('#clock-note-input'),mobileNav:rect('.mobile-nav'),
      privacyCurtain:rect('.privacy-curtain'),
      seconds:rect('#clock-seconds'),secondHand:rect('.dial-second-bead .bead'),setupOpen:Boolean(document.getElementById('setup-dialog')?.open),
      stageInert:document.getElementById('stage')?.inert===true,
      coverBackground:getComputedStyle(document.getElementById('pace-cover'),'::before').backgroundImage,
      bodyBackground:getComputedStyle(document.body).backgroundImage,
      skyPhoto:getComputedStyle(document.querySelector('.sky-photo')).backgroundImage
    };
  });
}

// The calculation-method label ("15° · ISNA style") is private; a 15° forecast is not.
const privateTerms=/\b(Fajr|Dhuhr|Asr|Maghrib|Isha|Hanafi|prayer|ISNA)\b|Etobicoke|Toronto|America\/Toronto|15° ·/i;

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

    await page.click('#cover-music-open');
    const music=await page.evaluate(()=>{const top=document.elementFromPoint(innerWidth/2,innerHeight/2);return{open:document.getElementById('sound-bar').dataset.musicOpen,onTop:Boolean(top?.closest('#sound-bar'))}});
    requireState(music.open==='true'&&music.onTop,'Music opened behind the scenic cover',music);
    await page.screenshot({path:path.join(output,'v31-desktop-music.png'),fullPage:false});
    await page.click('#music-room-close');
    await page.waitForFunction(()=>document.getElementById('sound-bar').dataset.musicOpen==='false');

    await page.click('#cover-peel');
    await page.waitForFunction(()=>document.documentElement.dataset.cover==='peeled');
    await page.waitForTimeout(220);
    state=await inspect(page);
    requireState(state.mode==='home'&&!state.stageInert&&state.coverBox.display==='none','Open Clock did not reveal the working surface',state);
    requireState(visible(state.clock)&&state.moments>=3&&visible(state.daybook)&&visible(state.composer),'The Horizon Dial, its moments and the persistent Daybook must coexist',state);
    requireState(visible(state.seconds)&&visible(state.secondHand),'Visible seconds and the sweeping seconds bead were lost',state);
    requireState(/daily-image|homepage-default/.test(state.skyPhoto),'The daily photograph must be the sky behind Clock',state);
    requireState(state.clock.width>=520&&visible(state.week)&&visible(state.keys)&&state.week.right<=state.clock.x+40&&state.keys.x>=state.clock.right-40,'Desktop Clock must be week · dial · keys around a centrepiece dial',state);
    requireState(state.scrollWidth<=state.viewport.width+1,'Working Clock has horizontal overflow',state);
    requireState(state.privacyCurtain?.display==='none','The inactive privacy screen leaked into the working page',state);
    await page.screenshot({path:path.join(output,'v31-desktop-clock.png'),fullPage:false});
    await page.screenshot({path:path.join(output,'v31-desktop-clock-full.png'),fullPage:true});

    const shell=await page.evaluate(()=>({
      styles:[...document.styleSheets].map(sheet=>sheet.href).filter(href=>href&&href.includes('/app/')),
      runtimes:[...document.scripts].map(script=>script.src).filter(src=>src&&!src.includes('msal-')&&src.includes('/app/')),
      clockText:document.querySelector('.view-home').innerText,
      discretion:window.__PACEFOLD__.prefs.rhythmDiscretion
    }));
    requireState(shell.styles.length===1&&shell.runtimes.length===1,'Clock must load exactly one app stylesheet and one runtime',shell);
    requireState(shell.discretion==='neutral'&&!privateTerms.test(shell.clockText),'Neutral Clock leaked prayer, method or location vocabulary',{discretion:shell.discretion,clockText:shell.clockText});

    const legacy=await page.evaluate(()=>{const box=document.querySelector('.view-home>.home-grid').getBoundingClientRect();return{width:box.width,height:box.height}});
    requireState(legacy.width<=1&&legacy.height<=1,'The retired pre-Horizon Clock card is visible under the dial',legacy);
    // One fold switcher, centred in the top bar, clear of the bar's own controls.
    const switcher=await page.evaluate(()=>{const box=node=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width}};const nav=document.querySelector('.fold-nav');return{nav:box(nav),items:[...nav.querySelectorAll('[data-go]')].map(node=>({go:node.dataset.go,current:node.getAttribute('aria-current')})),index:getComputedStyle(nav).getPropertyValue('--fold-index').trim(),music:box(document.querySelector('.sound-bar')),status:box(document.querySelector('.bar-status')),edges:document.querySelectorAll('.edge-nav,.edge').length,viewport:innerWidth}});
    requireState(switcher.edges===0&&switcher.items.map(item=>item.go).join()==='notes,worklog,home,now,settings'&&switcher.items.find(item=>item.current==='page')?.go==='home'&&switcher.index==='2','The fold switcher must replace the edge pills and mark Clock',switcher);
    requireState(Math.abs((switcher.nav.left+switcher.nav.right)/2-switcher.viewport/2)<=2&&switcher.nav.top<=14&&switcher.nav.left>switcher.music.right&&switcher.nav.right<switcher.status.left,'The fold switcher is not centred in the top bar or collides with its controls',switcher);
    // Wide screens: the right-hand controls (command bar, cues, quiet, homepage) never slide under the switcher.
    for(const[width,height]of[[1920,1080],[1536,864],[1280,800]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(120);
      const bar=await page.evaluate(()=>{const nav=document.querySelector('.fold-nav').getBoundingClientRect(),items=[...document.querySelectorAll('.bar-status>*')].filter(node=>node.offsetParent).map(node=>node.getBoundingClientRect().left);return{navRight:nav.right,statusLeft:Math.min(...items)}});
      requireState(bar.statusLeft>=bar.navRight+6,'The top-bar controls overlap the fold switcher',{width,...bar});
    }
    await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(120);
    // A populated music dock stops short of the switcher.
    const dockRoom=await page.evaluate(()=>{const player=document.querySelector('.sound-bar .stream-player');const before=player.dataset.state;player.dataset.state='ready';const title=document.querySelector('.sound-bar .stream-title');const text=title.textContent;title.textContent='A very long track title that would run right under the fold switcher';const dock=document.querySelector('.sound-bar .stream-dock').getBoundingClientRect(),nav=document.querySelector('.fold-nav').getBoundingClientRect(),controls=[...document.querySelectorAll('.sound-bar .stream-controls button')].filter(node=>node.offsetParent).map(node=>node.getBoundingClientRect().right);player.dataset.state=before;title.textContent=text;return{dockRight:dock.right,navLeft:nav.left,controlsRight:Math.max(0,...controls)}});
    requireState(dockRoom.dockRight<=dockRoom.navLeft-4&&dockRoom.controlsRight<=dockRoom.dockRight+1,'The populated music dock runs under the fold switcher',dockRoom);
    // Resting the pointer at a screen edge never moves the person to another fold.
    await page.mouse.move(6,450);await page.mouse.move(10,452);await page.mouse.move(1434,450);await page.mouse.move(1430,452);await page.waitForTimeout(900);
    requireState((await page.evaluate(()=>document.documentElement.dataset.mode))==='home','Hovering at a screen edge navigated away from Clock');

    const signature=await page.evaluate(async()=>{await document.fonts.ready;return{phase:document.documentElement.dataset.phase,serif:document.fonts.check('300 100px "Pacefold Display"'),digital:getComputedStyle(document.querySelector('.digital')).fontFamily,numerals:document.querySelectorAll('.dial-cardinal').length,icons:[...document.querySelectorAll('.quick-action>i')].every(node=>getComputedStyle(node,'::after').maskImage.includes('data:image/svg'))}});
    requireState(['dawn','day','dusk','night'].includes(signature.phase)&&signature.serif&&/Pacefold Display/.test(signature.digital)&&signature.numerals===4&&signature.icons,'The Horizon Clock (sky phase, display type, dial cardinals, key icons) is incomplete',signature);


    // The dial explains itself on hover: sun or moon, and moments without their names.
    await page.hover('.dial .lens-hit');await page.waitForTimeout(200);
    const skyCard=await page.evaluate(()=>{const pop=document.getElementById('wx-pop');return{on:pop.classList.contains('is-on'),text:pop.innerText}});
    requireState(skyCard.on&&/^(SUN|MOON|Sun|Moon)/.test(skyCard.text.trim())&&/(Sets|Golden|illuminated|Sunrise)/.test(skyCard.text),'Hovering the sun or moon must explain it',skyCard);
    await page.hover('.dial-moments .moment .moment-dot');await page.waitForTimeout(200);
    const momentCard=await page.evaluate(()=>document.getElementById('wx-pop').innerText);
    requireState(/Scheduled moment/.test(momentCard)&&!privateTerms.test(momentCard),'Hovering a moment must stay neutral',{momentCard});
    await page.mouse.move(720,860);await page.waitForTimeout(250);

    // Focus view: Z grows the dial and clears the panels; Esc returns without leaving Clock.
    await page.keyboard.press('z');await page.waitForTimeout(700);
    const zen=await page.evaluate(()=>({zen:document.documentElement.dataset.zen,left:getComputedStyle(document.querySelector('.horizon-left')).opacity,dock:getComputedStyle(document.querySelector('.horizon-dock')).pointerEvents}));
    requireState(zen.zen==='on'&&Number(zen.left)<.05&&zen.dock==='none','Focus view did not clear the panels',zen);
    await page.keyboard.press('Escape');await page.waitForTimeout(150);
    requireState(await page.evaluate(()=>!document.documentElement.dataset.zen&&document.documentElement.dataset.mode==='home'),'Esc must leave focus view and stay on Clock');

    // Command bar: Ctrl+K, type, Enter runs; a phrase can be kept as a note.
    const paletteWater=await page.evaluate(()=>Number(window.__PACEFOLD__.prefs.waterOz)||0);
    await page.keyboard.press('Control+k');await page.waitForTimeout(150);
    requireState(await page.evaluate(()=>!document.getElementById('palette').hidden&&document.activeElement?.id==='palette-input'),'Ctrl+K must open the command bar with the input focused');
    await page.keyboard.type('water');await page.waitForTimeout(80);
    requireState((await page.evaluate(()=>document.querySelector('.palette-row[aria-selected="true"]')?.textContent||'')).startsWith('Log water'),'The command bar did not rank Log water first');
    await page.keyboard.press('Enter');await page.waitForTimeout(250);
    const afterPalette=await page.evaluate(()=>({oz:Number(window.__PACEFOLD__.prefs.waterOz)||0,step:Number(window.__PACEFOLD__.prefs.waterStep)||0,hidden:document.getElementById('palette').hidden,mode:document.documentElement.dataset.mode}));
    requireState(afterPalette.oz===paletteWater+afterPalette.step&&afterPalette.hidden&&afterPalette.mode==='home','Running Log water from the command bar failed',{paletteWater,...afterPalette});
    await page.keyboard.press('Control+k');await page.keyboard.type('Call the supplier back');await page.waitForTimeout(80);
    await page.locator('.palette-row',{hasText:'as a note'}).click();
    await page.waitForFunction(()=>window.__PACEFOLD__.notes.some(note=>note.body==='Call the supplier back'));

    const waterBefore=await page.evaluate(()=>Number(window.__PACEFOLD__.prefs.waterOz)||0);
    await page.click('[data-action="water"]');
    const water=await page.evaluate(()=>({oz:Number(window.__PACEFOLD__.prefs.waterOz)||0,step:Number(window.__PACEFOLD__.prefs.waterStep)||0,stored:JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}').waterOz,label:document.getElementById('water-state').textContent}));
    requireState(water.oz===waterBefore+water.step&&water.stored===water.oz&&water.label.startsWith(`${water.oz} /`),'Water tap did not increment and persist established data',{waterBefore,...water});

    const marker=`Origin restoration ${Date.now()}`;
    await page.locator('#clock-note-input').fill(marker);
    await page.locator('#clock-note-input').press('Enter');
    await page.waitForFunction(value=>window.__PACEFOLD__.notes.some(note=>note.body===value),marker);
    requireState((await page.evaluate(()=>JSON.parse(localStorage.getItem('pacefold.notebook.entries.v2')||'{"items":[]}').items?.length||0))===2,'Clock note was not persisted locally (one from the command bar, one from Clock)',await inspect(page));

    for(const [mode,file,selector]of [
      ['notes','v31-desktop-notes.png','.view-notes'],
      ['worklog','v31-desktop-day.png','.view-worklog'],
      ['now','v31-desktop-now.png','.view-now'],
      ['settings','v31-desktop-settings.png','.view-settings']
    ]){
      await page.evaluate(target=>window.__PACEFOLD__.go(target),mode);await page.waitForTimeout(180);
      const box=await page.locator(selector).boundingBox();
      requireState(Boolean(box&&box.width>0),`${mode} fold did not open`,await inspect(page));
      const current=await page.evaluate(()=>[...document.querySelectorAll('.fold-nav [aria-current="page"]')].map(node=>node.dataset.go));
      requireState(current.length===1&&current[0]===mode,'The fold switcher must mark the open fold',{mode,current});
      const tab=await page.evaluate(()=>({index:getComputedStyle(document.querySelector('.fold-nav')).getPropertyValue('--fold-index').trim(),clock:document.querySelector('.fold-nav [data-go="home"] small').textContent}));
      requireState(tab.index===String(['notes','worklog','home','now','settings'].indexOf(mode))&&/\d:\d\d/.test(tab.clock),'The switcher thumb must follow the fold and the Clock tab must show the time',{mode,...tab});
      // A tap goes exactly where it says, even from inside another fold.
      const other=mode==='settings'?'notes':'settings';
      await page.click(`.fold-nav [data-go="${other}"]`);await page.waitForTimeout(120);
      requireState((await page.evaluate(()=>document.documentElement.dataset.mode))===other,'A switcher tab inside a fold opened the wrong fold',{from:mode,to:other});
      await page.click(`.fold-nav [data-go="${mode}"]`);await page.waitForTimeout(120);
      requireState((await page.evaluate(()=>document.documentElement.dataset.mode))===mode,'A switcher tab did not return to its fold',{mode});
      if(mode==='worklog'){
        const fold=await page.evaluate(()=>({compare:getComputedStyle(document.getElementById('day-compare')).display,compareHeader:getComputedStyle(document.querySelector('.day-compare>header')).display,storyTitle:getComputedStyle(document.querySelector('.day-story strong')).color}));
        requireState(['block','grid'].includes(fold.compare)&&fold.compareHeader==='flex'&&/255/.test(fold.storyTitle),'Day fold lost its comparison layout or story contrast',fold);
      }
      if(mode==='now'){
        const ring=await page.evaluate(()=>({progress:Number(getComputedStyle(document.querySelector('.now-primary')).getPropertyValue('--now-progress')),label:document.getElementById('now-ring-value').textContent,from:document.documentElement.dataset.from,animation:getComputedStyle(document.querySelector('.view-now')).animationName}));
        requireState(ring.progress>=0&&ring.progress<=1&&/\d|Done/.test(ring.label)&&ring.animation==='fold-from-right','Now countdown ring or directional fold is missing',ring);
        const fold=await page.evaluate(()=>({title:getComputedStyle(document.querySelector('.now-primary h2')).color,scheduleTime:getComputedStyle(document.querySelector('.now-schedule .rhythm-row strong')).color,primaryBackground:getComputedStyle(document.querySelector('.now-primary')).backgroundImage,primaryColor:getComputedStyle(document.querySelector('.now-primary')).backgroundColor}));
        requireState(/255/.test(fold.title)&&!/255, 255, 255/.test(fold.scheduleTime)&&fold.primaryBackground!=='none'&&!/247, 250, 248/.test(fold.primaryColor),'Now fold has unreadable inherited contrast',fold);
      }
      if(mode==='settings'){
        const fold=await page.evaluate(()=>({chipCopy:getComputedStyle(document.querySelector('.settings-chip>span')).display}));
        requireState(fold.chipCopy==='grid','Settings summary copy collapsed into one line',fold);
      }
      await page.screenshot({path:path.join(output,file),fullPage:false});
    }

    await page.evaluate(()=>window.__PACEFOLD__.go('notes'));await page.waitForTimeout(120);
    const savedId=await page.evaluate(value=>window.__PACEFOLD__.notes.find(note=>note.body===value)?.id,marker);
    await page.locator(`[data-note-id="${savedId}"] [data-note-edit]`).click();
    const editor=page.locator(`[data-note-id="${savedId}"] .note-inline-input`);
    requireState(await editor.count()===1,'Inline note editor did not open',{savedId});
    await editor.fill(`${marker} (edited)`);
    requireState((await page.locator('#note-save-status').textContent()).includes('Unsaved'),'Inline edit did not expose dirty state',{});
    await page.locator(`[data-note-id="${savedId}"] button[aria-label="Save note changes"]`).click();
    requireState(await page.evaluate(value=>window.__PACEFOLD__.notes.some(note=>note.body===value),`${marker} (edited)`),'Inline note edit did not save',{});

    await page.evaluate(()=>document.activeElement?.blur());
    await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.documentElement.dataset.mode==='home');
    await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.documentElement.dataset.mode==='now');
    const nowText=await page.locator('[data-view="now"]').innerText();
    requireState(!privateTerms.test(nowText),'Neutral Now view leaked rhythm or location vocabulary',{nowText});

    await page.evaluate(()=>window.__PACEFOLD__.go('settings'));await page.waitForTimeout(120);
    requireState(await page.evaluate(()=>document.documentElement.dataset.theme==='light'),'Light system preference should resolve to the light theme',{});
    await page.click('[data-appearance="dark"]');
    const dark=await page.evaluate(()=>({theme:document.documentElement.dataset.theme,stored:JSON.parse(localStorage.getItem('pacefoldPrefsV15')).appearance,body:getComputedStyle(document.querySelector('.settings-panels>section:not([hidden])')).backgroundColor,backup:window.__PACEFOLD__.backup().prefs?.appearance}));
    requireState(dark.theme==='dark'&&dark.stored==='dark'&&dark.backup==='dark'&&/rgba\(14, 22, 34/.test(dark.body),'Dark appearance did not apply, persist or reach the backup',dark);
    await page.screenshot({path:path.join(output,'v31-desktop-settings-dark.png'),fullPage:false});
    await page.click('[data-appearance="system"]');
    requireState(await page.evaluate(()=>document.documentElement.dataset.theme==='light'),'System appearance did not return to the device theme',{});

    await ready(page,`${origin}/app/?mode=notes`);
    state=await inspect(page);
    requireState(state.cover==='peeled'&&state.mode==='notes'&&!state.stageInert,'Direct fold links must bypass the cover',state);
    requireState(await page.locator('.note-item', {hasText:marker}).count()===1,'The persisted Clock note did not survive navigation and reload',state);
    await context.close();

    // Week ahead: seven days on Clock and on the cover, from a mocked Open-Meteo reply.
    const weather=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'America/Toronto',serviceWorkers:'block'}),sky=await weather.newPage(),skyErrors=[];
    sky.on('pageerror',error=>skyErrors.push(error.message));
    sky.on('console',message=>{if(message.type()==='error'&&!/Service Worker registration blocked by Playwright/i.test(message.text()))skyErrors.push(message.text())});
    const days=[0,1,2,3,4,5,6].map(offset=>new Date(Date.now()+offset*864e5).toISOString().slice(0,10));
    const hourly={time:[],temperature_2m:[],apparent_temperature:[],precipitation_probability:[],weather_code:[],wind_speed_10m:[]};
    for(const day of days)for(let hour=0;hour<24;hour+=1){hourly.time.push(`${day}T${String(hour).padStart(2,'0')}:00`);hourly.temperature_2m.push(10+Math.round(8*Math.max(0,Math.sin((hour-6)/24*2*Math.PI))));hourly.apparent_temperature.push(9);hourly.precipitation_probability.push(hour>=17&&hour<=20?70:10);hourly.weather_code.push(2);hourly.wind_speed_10m.push(12)}
    const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).replace(' ','T'),slot=new Date(`${stamp}:00Z`);slot.setUTCMinutes(Math.floor(slot.getUTCMinutes()/15)*15);
    const minutely={time:[...Array(8)].map((_,i)=>new Date(slot.getTime()+i*9e5).toISOString().slice(0,16)),precipitation:[0,0,.4,1.2,.8,0,0,0]};
    await sky.route('https://api.open-meteo.com/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({current:{temperature_2m:14.2,apparent_temperature:12.1,weather_code:2,is_day:1,relative_humidity_2m:62,wind_speed_10m:17,wind_direction_10m:250},daily:{time:days,weather_code:[2,61,0,3,80,95,71],temperature_2m_max:[18,15,21,19,17,23,4],temperature_2m_min:[9,11,10,12,13,16,-3],precipitation_probability_max:[10,80,0,20,60,70,55],precipitation_sum:[0,8.1,0,0,3,12,4],sunrise:days.map(day=>`${day}T07:08`),sunset:days.map(day=>`${day}T19:12`),uv_index_max:[5,2,6,4,3,5,1],wind_speed_10m_max:[22,31,14,18,26,40,28],wind_direction_10m_dominant:[250,190,300,270,220,160,340]},hourly,minutely_15:minutely})}));
    await sky.route('https://air-quality-api.open-meteo.com/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({current:{us_aqi:38}})}));
    const frameTime=Math.floor(Date.now()/600000)*600;
    await sky.route('https://api.rainviewer.com/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({host:'https://tilecache.rainviewer.com',radar:{past:[...Array(13)].map((_,i)=>({time:frameTime-(12-i)*600,path:`/v2/radar/${i}`})),nowcast:[]}})}));
    const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64'),tiles=[];
    for(const host of['https://tilecache.rainviewer.com/**','https://a.basemaps.cartocdn.com/**'])await sky.route(host,route=>{tiles.push(route.request().url());route.fulfill({contentType:'image/png',body:pixel})});
    // Environment Canada GeoMet, the feed SkyMap Ontario uses: capabilities XML and one image per frame.
    const iso=ms=>new Date(ms).toISOString().replace(/\.\d{3}Z$/,'Z'),six=Math.floor(Date.now()/360000)*360000,ten=Math.ceil(Date.now()/600000)*600000,geomet=[];
    const capabilities=layer=>layer==='RADAR_1KM_RRAI'
      ?`<WMS_Capabilities><Capability><Layer><Layer><Name>RADAR_1KM_RRAI</Name><Dimension name="time" default="${iso(six)}">${iso(six-90*60000)}/${iso(six)}/PT6M</Dimension></Layer></Layer></Capability></WMS_Capabilities>`
      :`<WMS_Capabilities><Capability><Layer><Layer><Name>Radar_1km_RainPrecipRate-Extrapolation</Name><Dimension name="time" default="${iso(ten)}">${iso(ten)}/${iso(ten+180*60000)}/PT10M</Dimension><Dimension name="reference_time" default="${iso(six)}">${iso(six)}</Dimension></Layer></Layer></Capability></WMS_Capabilities>`;
    const geometRoute=({delay=0,fail=false}={})=>async route=>{const url=new URL(route.request().url());if(delay)await new Promise(resolve=>setTimeout(resolve,delay));if(url.searchParams.get('REQUEST')==='GetCapabilities'){if(fail)return route.fulfill({status:503,body:'busy'}).catch(()=>{});return route.fulfill({contentType:'text/xml',body:capabilities(url.searchParams.get('layer'))}).catch(()=>{})}geomet.push(url.href);return route.fulfill({contentType:'image/png',body:pixel}).catch(()=>{})};
    await sky.route('https://geo.weather.gc.ca/**',geometRoute());
    await sky.addInitScript(seed);
    await sky.addInitScript(()=>{const prefs=JSON.parse(localStorage.getItem('pacefoldPrefsV15'));prefs.weatherEnabled=true;localStorage.setItem('pacefoldPrefsV15',JSON.stringify(prefs))});
    await ready(sky,`${origin}/app/`);
    await sky.waitForFunction(()=>document.querySelectorAll('#cover-week .cw-day').length===7);
    await sky.screenshot({path:path.join(output,'v31-desktop-homepage-week.png'),fullPage:false});
    await sky.click('#cover-peel');await sky.waitForTimeout(200);
    const week=await sky.evaluate(()=>({days:[...document.querySelectorAll('#week-days .week-day')].map(day=>({label:day.getAttribute('aria-label'),kind:day.dataset.kind,icon:Boolean(day.querySelector('svg.wx'))})),headline:document.getElementById('week-headline').textContent,homeText:document.querySelector('.view-home').innerText}));
    requireState(week.days.length===7&&week.days.every(day=>day.icon)&&week.days[0].label.startsWith('Today')&&week.days[1].kind==='rain'&&week.days[5].kind==='storm'&&/14° now/.test(week.headline),'Clock is missing the seven-day forecast',week);
    requireState(!privateTerms.test(week.homeText),'The forecast leaked the location onto Clock',{homeText:week.homeText});
    // Hovering a day opens its card: hourly curve and details.
    await sky.hover('.week-day[data-index="1"]');await sky.waitForTimeout(250);
    const card=await sky.evaluate(()=>{const pop=document.getElementById('wx-pop');return{hidden:pop.hidden,on:pop.classList.contains('is-on'),chart:Boolean(pop.querySelector('.wx-chart path.wx-line')),stats:[...pop.querySelectorAll('.wx-stat small')].map(node=>node.textContent),text:pop.innerText}});
    requireState(!card.hidden&&card.on&&card.chart&&card.stats.join()==='Precip,Wind,UV,Daylight'&&/Rain/.test(card.text)&&/8\.1 mm/.test(card.text),'Hovering a day must show its weather card',card);
    const nowcastLine=await sky.evaluate(()=>document.querySelector('#week-sky .week-nowcast')?.textContent||'');
    requireState(/Rain starting in about 30 min/.test(nowcastLine),'The week panel must announce rain from the nowcast',{nowcastLine});
    // The radar button opens the sheet: radar scope with frames, air quality, hourly chart.
    await sky.mouse.move(700,860);await sky.click('.wx-open');
    await sky.waitForFunction(()=>document.querySelector('.radar-scope')?.dataset.state==='live');
    const sheet=await sky.evaluate(()=>({open:!document.getElementById('weather-sheet').hidden,frames:document.querySelectorAll('.radar-frame').length,showing:document.querySelectorAll('.radar-frame.is-on').length,map:document.querySelectorAll('.radar-map img').length,air:document.getElementById('wx-air')?.innerText||'',tabs:document.querySelectorAll('.wx-tab').length,chart:Boolean(document.querySelector('.wx-plot .wx-chart .wx-hit')),cast:document.querySelector('.wx-cast strong')?.textContent,text:document.getElementById('weather-sheet').innerText}));
    requireState(sheet.open&&sheet.frames>=10&&sheet.showing===1&&sheet.map===9&&/38 · Good/.test(sheet.air)&&sheet.tabs===8&&sheet.chart&&/Rain starting/.test(sheet.cast),'The weather sheet is incomplete',sheet);
    requireState(!privateTerms.test(sheet.text),'The weather sheet leaked the location',{text:sheet.text});
    // In Canada the scope uses GeoMet: measured radar, then the official extrapolation, aligned in Web Mercator.
    for(let wait=0;wait<30&&!geomet.some(url=>url.includes('Extrapolation'));wait+=1)await sky.waitForTimeout(100);
    const eccc=await sky.evaluate(()=>({source:document.querySelector('.radar-scope').dataset.source,frames:document.querySelectorAll('.radar-frame img').length,skymap:document.querySelector('.radar-skymap')?.href||'',credit:document.querySelector('.wx-credit')?.textContent||''}));
    const observedUrl=new URL(geomet.find(url=>url.includes('RADAR_1KM_RRAI'))||'https://x/'),forecastUrl=new URL(geomet.find(url=>url.includes('Extrapolation'))||'https://x/');
    requireState(eccc.source==='eccc'&&eccc.frames===sheet.frames&&observedUrl.searchParams.get('CRS')==='EPSG:3857'&&observedUrl.searchParams.get('STYLES')==='RADARURPPRECIPR14-LINEAR'&&observedUrl.searchParams.get('WIDTH')==='768'&&observedUrl.searchParams.get('BBOX')?.split(',').length===4&&forecastUrl.searchParams.get('DIM_REFERENCE_TIME')&&/skymapontario\/app/.test(eccc.skymap)&&/Environment and Climate Change Canada/.test(eccc.credit),'The radar must use the Environment Canada feed SkyMap Ontario uses',{eccc,observed:observedUrl.href,forecast:forecastUrl.href});
    // Web Mercator box of the scope's 3×3 zoom-7 block around the location (x of tile 34..37 at zoom 7).
    const box=observedUrl.searchParams.get('BBOX').split(',').map(Number),tileSpan=40075016.685578488/128;
    requireState(Math.abs(box[2]-box[0]-3*tileSpan)<1&&Math.abs(box[3]-box[1]-3*tileSpan)<1&&box[0]<-79.5132*20037508.34/180&&box[2]>-79.5132*20037508.34/180,'The GeoMet image does not cover the map block around the location',{box});
    await sky.screenshot({path:path.join(output,'v31-desktop-weather-sheet.png'),fullPage:false});
    await sky.keyboard.press('ArrowRight');await sky.waitForTimeout(150);
    requireState((await sky.evaluate(()=>document.documentElement.dataset.mode))==='home','Arrow keys inside the weather sheet must not fold the app');
    await sky.keyboard.press('Escape');await sky.waitForTimeout(350);
    requireState(await sky.evaluate(()=>document.getElementById('weather-sheet').hidden),'Escape must close the weather sheet');
    // Closing before the radar metadata arrives cancels the radar: no images, no timer.
    await sky.unroute('https://geo.weather.gc.ca/**');await sky.route('https://geo.weather.gc.ca/**',geometRoute({delay:500}));
    const imagesBefore=geomet.length;
    // Open and press Esc within the same frame, with focus outside the sheet: it must stay closed.
    await sky.evaluate(()=>{document.querySelector('.wx-open').click();document.activeElement?.blur();window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))});await sky.waitForTimeout(1600);
    requireState(await sky.evaluate(()=>document.getElementById('weather-sheet').hidden)&&geomet.length===imagesBefore,'A closed weather sheet still started its radar',{late:geomet.length-imagesBefore});
    // If GeoMet is unavailable, the scope falls back to RainViewer rather than going blank.
    await sky.unroute('https://geo.weather.gc.ca/**');await sky.route('https://geo.weather.gc.ca/**',geometRoute({fail:true}));
    await sky.click('.wx-open');await sky.waitForFunction(()=>document.querySelector('.radar-scope')?.dataset.state==='live',null,{timeout:15000});
    for(let wait=0;wait<30&&!tiles.some(url=>url.includes('tilecache.rainviewer.com/v2/radar/12/256/7/'));wait+=1)await sky.waitForTimeout(100);
    const fallback=await sky.evaluate(()=>({source:document.querySelector('.radar-scope').dataset.source,frames:document.querySelectorAll('.radar-frame').length,subtitle:document.querySelector('.wx-radar-head small').textContent,credit:document.querySelector('.wx-credit').textContent}));
    requireState(fallback.source==='rainviewer'&&fallback.frames===10&&/RainViewer/.test(fallback.subtitle)&&/Radar RainViewer/.test(fallback.credit)&&!/Environment/.test(fallback.subtitle+fallback.credit)&&tiles.some(url=>url.includes('tilecache.rainviewer.com/v2/radar/12/256/7/')),'Without GeoMet the radar must fall back to RainViewer',fallback);
    await sky.keyboard.press('Escape');await sky.waitForTimeout(300);
    // The fallback check answers GeoMet with 503 on purpose; anything else is a real error.
    const unexpected=skyErrors.filter(message=>!/status of 503/.test(message));
    requireState(unexpected.length===0,'The forecast produced browser errors (CSP or runtime)',{skyErrors:unexpected});
    await sky.screenshot({path:path.join(output,'v31-desktop-clock-week.png'),fullPage:true});
    await weather.close();

    // Cues resolve by logging: the action writes the day log and restarts that cadence.
    const cueContext=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'America/Toronto',serviceWorkers:'block'}),cuePage=await cueContext.newPage();
    cuePage.on('pageerror',error=>errors.push(`cue pageerror: ${error.stack||error.message}`));
    await cuePage.addInitScript(seed);
    await cuePage.addInitScript(()=>{const prefs=JSON.parse(localStorage.getItem('pacefoldPrefsV15'));prefs.waterLastAt=Date.now()-60*60000;prefs.gazeLastCompleted=Date.now()-40*60000;prefs.eyeCadence=30;localStorage.setItem('pacefoldPrefsV15',JSON.stringify(prefs))});
    await ready(cuePage,`${origin}/app/`);await cuePage.click('#cover-peel');await cuePage.waitForTimeout(200);
    // Waiting cues form a stack: the top card is actionable, the rest peek behind it.
    const before=await cuePage.evaluate(()=>({cues:window.__PACEFOLD__.cues.map(cue=>cue.source),cards:[...document.querySelectorAll('.cue-stack .cue-card')].map(card=>({source:card.dataset.source,depth:card.dataset.depth,inert:card.inert})),title:document.querySelector('.cue-stack-head strong').textContent,primary:document.querySelector('.cue-card[data-depth="0"] .cue-card-primary')?.textContent,guide:getComputedStyle(document.querySelector('.horizon-right .v28-guide')).display,bloom:document.getElementById('v28-cue-bloom')?.hidden!==false}));
    requireState(before.cues[0]==='water'&&before.cards.length===2&&before.cards[0].source==='water'&&before.cards[1].depth==='1'&&before.cards[1].inert&&/2 need you/.test(before.title)&&before.primary==='Log water'&&before.guide==='none'&&before.bloom,'Waiting cues should form one actionable stack',before);
    await cuePage.click('.cue-stack-toggle');await cuePage.waitForTimeout(80);
    requireState(await cuePage.evaluate(()=>document.querySelector('.cue-stack').dataset.expanded==='true'&&![...document.querySelectorAll('.cue-card')].some(card=>card.inert)),'Show all must fan the stack out with every card usable');
    await cuePage.click('.cue-stack-toggle');
    await cuePage.click('.cue-card[data-depth="0"] .cue-card-primary');
    await cuePage.waitForTimeout(450);
    const recalc=await cuePage.evaluate(()=>({note:document.querySelector('.cue-stack-note').textContent,cards:[...document.querySelectorAll('.cue-stack .cue-card')].map(card=>card.dataset.source)}));
    requireState(/Water logged · next sip around \d/.test(recalc.note)&&recalc.cards.join()==='eyes','Logging from the stack must remove the card and say when the next one is due',recalc);
    const afterWater=await cuePage.evaluate(()=>({cues:window.__PACEFOLD__.cues.map(cue=>cue.source),last:window.__PACEFOLD__.prefs.waterLastAt,oz:window.__PACEFOLD__.prefs.waterOz,events:Object.values(window.__PACEFOLD__.log.days||{}).flatMap(day=>day.events||[]).map(event=>event.source)}));
    requireState(!afterWater.cues.includes('water')&&Date.now()-afterWater.last<60000&&afterWater.oz>0&&afterWater.events.includes('water'),'Logging water must record it and restart its cadence',afterWater);
    await cuePage.locator('.dial-cue').first().click();
    const afterEyes=await cuePage.evaluate(()=>({cues:window.__PACEFOLD__.cues.map(cue=>cue.source),gaze:window.__PACEFOLD__.prefs.gazeLastCompleted,events:Object.values(window.__PACEFOLD__.log.days||{}).flatMap(day=>day.events||[]).map(event=>event.source)}));
    requireState(afterEyes.cues.length===0&&Date.now()-afterEyes.gaze<60000&&afterEyes.events.includes('eyes'),'Tapping a cue on the dial must log it, not merely dismiss it',afterEyes);
    await cuePage.waitForTimeout(400);
    requireState(await cuePage.evaluate(()=>document.querySelectorAll('.cue-stack .cue-card').length===0),'A cue resolved elsewhere must leave the stack by itself');
    // Later puts just that kind of cue away (and survives a reload); the others still come.
    await cuePage.evaluate(()=>{const prefs=window.__PACEFOLD__.prefs;prefs.eyeCadence=7;prefs.gazeLastCompleted=Date.now()-40*60000;prefs.bodyCadence=11;prefs.bodyLastCompleted=Date.now()-90*60000;window.__PACEFOLD__.notificationHeartbeat()});
    await cuePage.waitForTimeout(120);
    await cuePage.click('.cue-stack-toggle');await cuePage.waitForTimeout(500);await cuePage.click('.cue-card[data-source="eyes"] .cue-card-later');await cuePage.waitForTimeout(450);
    const later=await cuePage.evaluate(()=>({cues:window.__PACEFOLD__.cues.map(cue=>cue.source),stored:JSON.parse(localStorage.getItem('pacefold.cues.v1')||'{}').snoozed||{},note:document.querySelector('.cue-stack-note').textContent}));
    requireState(!later.cues.includes('eyes')&&later.cues.includes('move')&&Number(later.stored.eyes)>Date.now()+10*60000&&/back around/.test(later.note),'Later must put away only that kind of cue, and remember it',later);
    // Reload with IndexedDB unavailable: startup must keep the per-kind Later from localStorage.
    const noDb=await cueContext.newPage();
    await noDb.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{configurable:true,get(){return undefined}})});
    await ready(noDb,`${origin}/app/?mode=worklog`);await noDb.waitForTimeout(300);
    const survived=await noDb.evaluate(()=>({stored:JSON.parse(localStorage.getItem('pacefold.cues.v1')||'{}').snoozed||{},cues:window.__PACEFOLD__.cues.map(cue=>cue.source)}));
    requireState(Number(survived.stored.eyes)>Date.now()+10*60000&&!survived.cues.includes('eyes'),'Later must survive a reload without IndexedDB',survived);
    await noDb.close();
    // Hidden privacy mode removes the rhythm from the dial entirely.
    await cuePage.evaluate(()=>{window.__PACEFOLD__.prefs.rhythmDiscretion='hidden';window.__PACEFOLD__.render('home')});
    const hiddenMoments=await cuePage.evaluate(()=>document.querySelectorAll('.dial-moments .moment').length);
    requireState(hiddenMoments===0,'Hidden privacy mode must remove moments from the dial',{hiddenMoments});
    // Log from a notification after a cold launch: the worker already acknowledged it.
    const moment=await cuePage.evaluate(()=>window.__PACEFOLD__.schedule().today.find(item=>item.alert));
    await ready(cuePage,`${origin}/app/?mode=worklog&cueAction=log&cueSource=prayer&cueKey=prayer:today:${moment.id}`);
    await ready(cuePage,`${origin}/app/?mode=worklog&cueAction=log&cueSource=prep&cueKey=prep:1`);
    const cold=await cuePage.evaluate(()=>({moments:Object.values(window.__PACEFOLD__.log.days||{}).flatMap(day=>day.events||[]).filter(event=>event.source==='moment').length,noodle:Number(window.__PACEFOLD__.prefs.noodleStart)||0,url:location.search}));
    requireState(cold.moments>=1&&cold.noodle===0&&!/cueAction/.test(cold.url),'Notification Log after a cold launch must record a kept moment and never start a stopped timer',cold);
    await cueContext.close();

    // Midnight: the sweeping second hand must keep moving forward, and the Now ring
    // must show progress before the first moment of the day.
    const night=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'America/Toronto',serviceWorkers:'block'}),late=await night.newPage();
    late.on('pageerror',error=>errors.push(`midnight pageerror: ${error.stack||error.message}`));
    await late.clock.install({time:new Date('2026-09-25T03:59:57Z')});
    await late.addInitScript(seed);
    await ready(late,`${origin}/app/`);
    const angles=[];for(let tick=0;tick<5;tick+=1){angles.push(await late.evaluate(()=>parseFloat(document.documentElement.style.getPropertyValue('--second-angle'))));await late.clock.runFor(1000)}
    requireState(angles.every((angle,index)=>!index||angle>angles[index-1]),'The second hand runs backwards across midnight',{angles});
    await late.evaluate(()=>window.__PACEFOLD__.go('now'));await late.waitForTimeout(100);
    const dawnRing=await late.evaluate(()=>Number(getComputedStyle(document.querySelector('.now-primary')).getPropertyValue('--now-progress')));
    requireState(dawnRing>0&&dawnRing<1,'The Now ring is stuck before the first moment of the day',{dawnRing});
    await night.close();

    const firstRun=await browser.newContext({viewport:{width:900,height:760},timezoneId:'America/Toronto',serviceWorkers:'block'}),fresh=await firstRun.newPage();
    fresh.on('pageerror',error=>errors.push(`first-run pageerror: ${error.stack||error.message}`));
    await ready(fresh,`${origin}/app/`);await fresh.waitForTimeout(500);
    requireState(await fresh.locator('#setup-dialog[open]').count()===0,'Setup must not block a fresh launch',{});
    requireState(await fresh.evaluate(()=>localStorage.getItem('pacefoldOnboardedV15')==='1'&&localStorage.getItem('pacefoldSetupDismissedV15')==='1'),'Fresh launch did not persist the setup-complete markers',{});
    await ready(fresh,`${origin}/app/`);await fresh.waitForTimeout(500);
    requireState(await fresh.locator('#setup-dialog[open]').count()===0,'Setup returned after reload',{});
    await firstRun.close();

    const mobile=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Toronto',colorScheme:'light',serviceWorkers:'block'});
    const phone=await mobile.newPage();
    phone.on('pageerror',error=>errors.push(`mobile pageerror: ${error.stack||error.message}`));
    phone.on('console',message=>{if(message.type()==='error'&&!/Service Worker registration blocked by Playwright/i.test(message.text()))errors.push(`mobile console: ${message.text()}`)});
    await phone.addInitScript(seed);
    await ready(phone,`${origin}/app/`);
    state=await inspect(phone);
    requireState(state.cover==='on'&&inside(state.hero,state.viewport)&&inside(state.search,state.viewport)&&inside(state.peel,state.viewport),'Mobile homepage is clipped',state);
    requireState(state.search.height>=48&&state.peel.height>=44&&(!state.music||state.music.right<=state.viewport.width+1),'Mobile homepage controls fail touch geometry',state);
    requireState(!state.music||state.music.width>=52,'Mobile Music control lost its visible label',state);
    requireState(state.scrollWidth<=state.viewport.width+1&&!state.setupOpen,'Mobile homepage overflows or reopens setup',state);
    await phone.screenshot({path:path.join(output,'v31-mobile-homepage.png'),fullPage:false});

    const immediate=await phone.evaluate(()=>{const cover=document.getElementById('pace-cover');document.getElementById('cover-peel').click();const box=cover.getBoundingClientRect(),top=document.elementFromPoint(innerWidth/2,innerHeight/2);return{display:getComputedStyle(cover).display,width:box.width,height:box.height,coverOnTop:Boolean(top?.closest('#pace-cover'))}});
    requireState(immediate.display==='none'&&!immediate.width&&!immediate.height&&!immediate.coverOnTop,'Mobile cover remains visible for a frame after opening Clock',immediate);
    await phone.waitForFunction(()=>document.documentElement.dataset.cover==='peeled');await phone.waitForTimeout(220);
    state=await inspect(phone);
    requireState(visible(state.clock)&&visible(state.daybook)&&visible(state.composer)&&visible(state.mobileNav),'Mobile Clock lost the instrument, navigation or Daybook',state);
    requireState(state.clock.right<=state.viewport.width+1&&state.daybook.right<=state.viewport.width+1&&state.scrollWidth<=state.viewport.width+1,'Mobile working surface is horizontally clipped',state);
    requireState(state.privacyCurtain?.display==='none','The inactive privacy screen leaked into the mobile page',state);
    requireState(visible(state.seconds)&&visible(state.secondHand),'Mobile Clock hides seconds',state);
    const tabs=await phone.evaluate(()=>[...document.querySelectorAll('#mobile-nav [data-go]')].map(node=>node.dataset.go));
    requireState(tabs.join()==='notes,worklog,home,now,settings','Mobile navigation must offer a way back to Clock, in the centre',{tabs});
    await phone.screenshot({path:path.join(output,'v31-mobile-clock.png'),fullPage:false});
    await phone.screenshot({path:path.join(output,'v31-mobile-clock-full.png'),fullPage:true});
    await phone.evaluate(()=>window.__PACEFOLD__.go('notes'));await phone.waitForTimeout(180);
    const mobileNotes=await phone.evaluate(()=>{const box=node=>node?.getBoundingClientRect().toJSON(),chips=[...document.querySelectorAll('#note-filter-chips button')].map(box);return{find:box(document.querySelector('.note-find')),search:box(document.querySelector('.note-find .search input')),chips}});
    requireState(mobileNotes.find?.width>=300&&mobileNotes.search?.width>=300&&mobileNotes.chips.length>=2&&Math.abs(mobileNotes.chips[0].y-mobileNotes.chips[1].y)<3,'Mobile Notes filters collapsed into a narrow vertical rail',mobileNotes);
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
