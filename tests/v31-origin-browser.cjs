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
    // Resting the pointer at a screen edge never moves the person to another fold.
    await page.mouse.move(6,450);await page.mouse.move(10,452);await page.mouse.move(1434,450);await page.mouse.move(1430,452);await page.waitForTimeout(900);
    requireState((await page.evaluate(()=>document.documentElement.dataset.mode))==='home','Hovering at a screen edge navigated away from Clock');

    const signature=await page.evaluate(async()=>{await document.fonts.ready;return{phase:document.documentElement.dataset.phase,serif:document.fonts.check('300 100px "Pacefold Display"'),digital:getComputedStyle(document.querySelector('.digital')).fontFamily,numerals:document.querySelectorAll('.dial-cardinal').length,icons:[...document.querySelectorAll('.quick-action>i')].every(node=>getComputedStyle(node,'::after').maskImage.includes('data:image/svg'))}});
    requireState(['dawn','day','dusk','night'].includes(signature.phase)&&signature.serif&&/Pacefold Display/.test(signature.digital)&&signature.numerals===4&&signature.icons,'The Horizon Clock (sky phase, display type, dial cardinals, key icons) is incomplete',signature);


    const waterBefore=await page.evaluate(()=>Number(window.__PACEFOLD__.prefs.waterOz)||0);
    await page.click('[data-action="water"]');
    const water=await page.evaluate(()=>({oz:Number(window.__PACEFOLD__.prefs.waterOz)||0,step:Number(window.__PACEFOLD__.prefs.waterStep)||0,stored:JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}').waterOz,label:document.getElementById('water-state').textContent}));
    requireState(water.oz===waterBefore+water.step&&water.stored===water.oz&&water.label.startsWith(`${water.oz} /`),'Water tap did not increment and persist established data',{waterBefore,...water});

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
      const current=await page.evaluate(()=>[...document.querySelectorAll('.fold-nav [aria-current="page"]')].map(node=>node.dataset.go));
      requireState(current.length===1&&current[0]===mode,'The fold switcher must mark the open fold',{mode,current});
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
    requireState(sheet.open&&sheet.frames===10&&sheet.showing===1&&sheet.map===9&&/38 · Good/.test(sheet.air)&&sheet.tabs===8&&sheet.chart&&/Rain starting/.test(sheet.cast),'The weather sheet is incomplete',sheet);
    requireState(!privateTerms.test(sheet.text),'The weather sheet leaked the location',{text:sheet.text});
    requireState(tiles.some(url=>url.includes('/7/'))&&tiles.some(url=>url.includes('tilecache.rainviewer.com/v2/radar/12/256/7/')),'Radar tiles were not requested at the scope zoom',{tiles:tiles.slice(0,4)});
    await sky.screenshot({path:path.join(output,'v31-desktop-weather-sheet.png'),fullPage:false});
    await sky.keyboard.press('ArrowRight');await sky.waitForTimeout(150);
    requireState((await sky.evaluate(()=>document.documentElement.dataset.mode))==='home','Arrow keys inside the weather sheet must not fold the app');
    await sky.keyboard.press('Escape');await sky.waitForTimeout(350);
    requireState(await sky.evaluate(()=>document.getElementById('weather-sheet').hidden),'Escape must close the weather sheet');
    requireState(skyErrors.length===0,'The forecast produced browser errors (CSP or runtime)',{skyErrors});
    await sky.screenshot({path:path.join(output,'v31-desktop-clock-week.png'),fullPage:true});
    await weather.close();

    // Cues resolve by logging: the action writes the day log and restarts that cadence.
    const cueContext=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'America/Toronto',serviceWorkers:'block'}),cuePage=await cueContext.newPage();
    cuePage.on('pageerror',error=>errors.push(`cue pageerror: ${error.stack||error.message}`));
    await cuePage.addInitScript(seed);
    await cuePage.addInitScript(()=>{const prefs=JSON.parse(localStorage.getItem('pacefoldPrefsV15'));prefs.waterLastAt=Date.now()-60*60000;prefs.gazeLastCompleted=Date.now()-40*60000;prefs.eyeCadence=30;localStorage.setItem('pacefoldPrefsV15',JSON.stringify(prefs))});
    await ready(cuePage,`${origin}/app/`);await cuePage.click('#cover-peel');await cuePage.waitForTimeout(200);
    const before=await cuePage.evaluate(()=>({cues:window.__PACEFOLD__.cues.map(cue=>cue.source),kicker:document.querySelector('.v28-guide-copy small').textContent,primary:document.querySelector('.v28-guide-primary')?.textContent}));
    requireState(before.cues[0]==='water'&&before.cues.includes('eyes')&&/\+1 more/.test(before.kicker)&&before.primary==='Log water','Waiting cues should show one at a time with a log action',before);
    await cuePage.click('.v28-guide-primary');
    const afterWater=await cuePage.evaluate(()=>({cues:window.__PACEFOLD__.cues.map(cue=>cue.source),last:window.__PACEFOLD__.prefs.waterLastAt,oz:window.__PACEFOLD__.prefs.waterOz,events:Object.values(window.__PACEFOLD__.log.days||{}).flatMap(day=>day.events||[]).map(event=>event.source)}));
    requireState(!afterWater.cues.includes('water')&&Date.now()-afterWater.last<60000&&afterWater.oz>0&&afterWater.events.includes('water'),'Logging water must record it and restart its cadence',afterWater);
    await cuePage.locator('.dial-cue').first().click();
    const afterEyes=await cuePage.evaluate(()=>({cues:window.__PACEFOLD__.cues.map(cue=>cue.source),gaze:window.__PACEFOLD__.prefs.gazeLastCompleted,events:Object.values(window.__PACEFOLD__.log.days||{}).flatMap(day=>day.events||[]).map(event=>event.source)}));
    requireState(afterEyes.cues.length===0&&Date.now()-afterEyes.gaze<60000&&afterEyes.events.includes('eyes'),'Tapping a cue on the dial must log it, not merely dismiss it',afterEyes);
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
