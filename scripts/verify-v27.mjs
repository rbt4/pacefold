import fs from'node:fs';
import path from'node:path';
import{spawnSync}from'node:child_process';
import{DEFAULT_PREFS,migratePrefs,scheduleState,normalizeNotes,normalizeLog,metricsForDay,dateKey}from'../src/app/core.mjs';

const root=path.resolve(process.argv[2]||'_site');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const exists=file=>fs.existsSync(path.join(root,file));
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const required=[
  'index.html','site.css','privacy.html','manifest.webmanifest','service-worker.js','pacefold-experience.txt',
  'app/index.html','app/pacefold.css','app/pacefold.mjs','app/auth.html','app/auth.js',
  'app/icons/fold-mark.svg','app/icons/icon-192.png','app/icons/icon-512.png','app/icons/badge-96.png',
  'app/icons/notify-water-128.png','app/icons/notify-prayer-128.png','app/icons/notify-prepare-128.png',
  'app/icons/notify-away-128.png','app/icons/notify-meal-128.png','app/icons/notify-eyes-128.png','app/icons/notify-move-128.png',
  'app/fonts/pacefold-ma.woff2','app/vendor/msal-browser-5.17.1.min.js','app/vendor/msal-redirect-bridge-5.17.1.min.js'
];
for(const file of required)assert(exists(file),`Missing ${file}`);
assert(!exists('modules'),'Readable source modules must not be shipped');
assert(!exists('styles'),'Readable style modules must not be shipped');
assert(!exists('app/core.mjs'),'Core must be bundled into the single application runtime');
assert(read('pacefold-experience.txt').trim()==='27.0.0 polish-r2-window-cues','Build identity is wrong');

for(const file of['app/pacefold.mjs','app/auth.js','service-worker.js']){
  const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
  assert(result.status===0,`${file} syntax failed: ${result.stderr}`);
}

function validateHtml(file){
  const html=read(file),base=path.dirname(file),ids=[...html.matchAll(/\sid=["']([^"']+)["']/g)].map(match=>match[1]),duplicates=ids.filter((value,index)=>ids.indexOf(value)!==index);
  assert(!duplicates.length,`${file} has duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);
  for(const match of html.matchAll(/\s(?:src|href)=["']([^"']+)["']/g)){
    let reference=match[1];if(!reference||reference.startsWith('#')||reference.startsWith('data:')||reference.startsWith('http:')||reference.startsWith('https:'))continue;
    reference=reference.split(/[?#]/)[0];if(!reference)continue;const target=path.normalize(path.join(base,reference));assert(exists(target)||exists(path.join(target,'index.html')),`${file} references missing ${match[1]}`);
  }
}
for(const file of['index.html','privacy.html','app/index.html','app/auth.html'])validateHtml(file);

const app=read('app/index.html'),runtime=read('app/pacefold.mjs'),styles=read('app/pacefold.css'),worker=read('service-worker.js'),manifest=JSON.parse(read('manifest.webmanifest'));
const packageJson=JSON.parse(fs.readFileSync(path.resolve('package.json'),'utf8'));
const cueSource=fs.readFileSync(path.resolve('src/modules/cues.js'),'utf8'),windowCueSource=fs.readFileSync(path.resolve('src/modules/window-cues.js'),'utf8'),cueStoreSource=fs.readFileSync(path.resolve('src/modules/cue-store.js'),'utf8'),scheduleSource=fs.readFileSync(path.resolve('src/modules/schedule.js'),'utf8'),clockSource=fs.readFileSync(path.resolve('src/modules/clock.js'),'utf8'),daylogSource=fs.readFileSync(path.resolve('src/modules/daylog.js'),'utf8'),nowSource=fs.readFileSync(path.resolve('src/modules/now.js'),'utf8'),mainSource=fs.readFileSync(path.resolve('src/modules/main.mjs'),'utf8'),stateSource=fs.readFileSync(path.resolve('src/modules/state.js'),'utf8'),notesSource=fs.readFileSync(path.resolve('src/modules/notes.js'),'utf8'),edgeSource=fs.readFileSync(path.resolve('src/modules/edges.js'),'utf8');

assert(packageJson.version==='27.0.0','Package release identity is wrong');
assert(packageJson.devDependencies?.esbuild==='0.28.1','esbuild must stay exactly pinned');
assert((app.match(/<link[^>]+stylesheet/g)||[]).length===1,'App must load exactly one stylesheet');
assert((app.match(/<script/g)||[]).length===2,'App must load only MSAL and one Pacefold runtime');
assert(!runtime.includes('./core.mjs')&&!runtime.includes('../modules/'),'Built runtime still references source modules');
assert(mainSource.includes('installCueStore(ctx)')&&mainSource.includes('installWindowCues(ctx)')&&mainSource.includes('installEdges(ctx)')&&mainSource.includes('installRelease(ctx)'),'V27 runtime modules are not fully wired');
assert(cueSource.includes('notify-${iconName}-128.png')&&cueSource.includes('badge-96.png'),'Raster notification URLs are missing');
assert(!cueSource.includes('Waiting on the clock'),'Duplicate Clock cue header returned');
assert(windowCueSource.includes("document.title='Clock'")&&windowCueSource.includes('data:image/svg+xml')&&windowCueSource.includes('document.hasFocus()'),'Edge-tab cue or focused-window notification policy is incomplete');
assert(windowCueSource.includes('windowCueBloomUntil')&&windowCueSource.includes('node.dataset.bloom=String(bloom)'),'Window cue bloom lifecycle is incomplete');
assert(worker.includes("const VERSION='27.0.0'")&&worker.includes('polish-r2-window-cues'),'Service-worker cache identity is stale');
assert(worker.includes("indexedDB.open('pacefold-v26'"),'Durable cue database must remain continuous across V27');
assert(worker.includes("event.action==='ack'")&&worker.includes("event.action==='snooze'"),'Closed-window notification actions are incomplete');
assert(cueStoreSource.includes("named=ctx.rhythmMode?.()==='names'")&&cueStoreSource.includes("label:named?item.label:'Scheduled moment'"),'Background cue mirror can leak named rhythm data');
assert(scheduleSource.includes("const discreet=ctx.rhythmMode()!=='names'")&&scheduleSource.includes("id('now-schedule-kicker').textContent=discreet?'Today’s rhythm'"),'Now schedule does not honor discretion');
assert(clockSource.includes("ctx.clockMomentLabel(next)")&&clockSource.includes('day-now-line')&&clockSource.includes('% of workday'),'Clock context or moving current-time marker is incomplete');
assert(daylogSource.includes("['At work',metrics.desk")&&daylogSource.includes('renderYesterdayComparison')&&!daylogSource.includes("eyeDue?'Due now'"),'Day Log or quiet quick-action copy regressed');
assert(nowSource.includes("hourly:'temperature_2m,precipitation_probability,precipitation,weather_code'")&&nowSource.includes("daily:'sunrise,sunset,uv_index_max'")&&nowSource.includes('weather-rain-window'),'Weather decision context is incomplete');
assert(styles.includes('.day-now-line')&&styles.includes('.day-compare-grid')&&styles.includes('.weather-nowcast')&&styles.includes('.metric-card[data-zero="true"]'),'V27 visual hierarchy stylesheet was not compiled');
assert(styles.includes('.clock-cue-notch')&&styles.includes('.title-cue-strip')&&styles.includes('.edge-nav .edge.is-expanded'),'Cue chrome or edge navigation styles are incomplete');
assert(styles.includes('.window-cue-bubble')&&styles.includes('.window-cues')&&styles.includes('.clock-cue-panel{display:none!important}'),'Window-native cue stylesheet was not compiled');
assert(styles.includes('display-mode: window-controls-overlay')&&styles.includes('app-region:drag')&&styles.includes('app-region:no-drag'),'Window-controls overlay contract is incomplete');
assert(notesSource.includes("placeholder='Log a thought.'")&&notesSource.includes('clock-carry')&&notesSource.includes('note-inline-input'),'Clock Daybook capture or inline editing is missing');
assert(edgeSource.includes('setTimeout')&&edgeSource.includes('120')&&edgeSource.includes('260'),'Edge preview timing contract is missing');
assert(stateSource.includes("RELEASE='27.0.0'")&&stateSource.includes("REVISION='polish-r2-window-cues'")&&stateSource.includes("cueState:'pacefold.cues.v1'")&&stateSource.includes("JSON.stringify({v:1,items:ctx.notes"),'V27 identity or storage continuity is incomplete');
assert(app.includes('data-view="home"')&&app.includes('data-view="notes"')&&app.includes('data-view="worklog"')&&app.includes('data-view="now"')&&app.includes('data-view="settings"'),'Spatial views are incomplete');
assert((app.match(/class="quick-action/g)||[]).length===6,'Quick action dock is incomplete');
assert(app.includes('id="clock-seconds"')&&styles.includes('.hand-second'),'Live seconds are missing');
assert(app.includes('id="calendar-grid"')&&app.includes('id="note-list"'),'Calendar Daybook is incomplete');
assert(app.includes('id="now-cue-list"')&&app.includes('id="now-guidance"'),'Now cue surface is incomplete');
assert(manifest.name==='Clock'&&manifest.short_name==='Clock','Installed app chrome is not discreet');
assert(manifest.start_url==='./app/'&&manifest.scope==='./'&&manifest.display==='standalone','Manifest navigation is wrong');
assert(Array.isArray(manifest.display_override)&&manifest.display_override.includes('window-controls-overlay'),'WCO manifest declaration is missing');

const toronto=migratePrefs({...DEFAULT_PREFS,timeZone:'America/Toronto',lat:43.6205,lng:-79.5132,profile:'original',asr:'hanafi',method:'15'}),summer=new Date('2026-08-10T16:00:00Z'),schedule=scheduleState(summer,toronto);
assert(schedule.today.length===6,'Prayer rhythm must include sunrise plus five prayers');assert(schedule.today.every((item,index,rows)=>index===0||item.date>rows[index-1].date),'Prayer rhythm is not ordered');assert(schedule.today.find(item=>item.id==='asr').date>schedule.today.find(item=>item.id==='dhuhr').date,'Hanafi Asr is invalid');
const migrated=migratePrefs({profile:'original',waterSips:8,noodleMinutes:45,showSeconds:true});assert(migrated.waterOz===8&&migrated.prepMinutes===45,'Legacy preference migration failed');
const migratedNotes=normalizeNotes([{id:'old',text:'Old note',createdAt:'2026-08-10T12:00:00Z'}]);assert(migratedNotes[0].body==='Old note','Legacy note migration failed');
const key=dateKey(summer,'America/Toronto'),sampleLog=normalizeLog({days:{[key]:{events:[{id:'f',type:'focus',source:'focus',label:'Focus',start:summer.getTime()-3600000,end:summer.getTime()}]}}}),metrics=metricsForDay(sampleLog,key,toronto,summer.getTime());assert(metrics.focus===3600000,'Day-log metrics failed');

console.log(JSON.stringify({release:'27.0.0',revision:'polish-r2-window-cues',runtimes:1,stylesheets:1,discreetChrome:'checked',windowCues:'checked',focusedNotificationSuppression:'checked',backgroundPrivacy:'checked',dayComparison:'checked',weatherContext:'checked',movingNowMarker:'checked',storageContinuity:'checked',prayerSchedule:'passed'},null,2));