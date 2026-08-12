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
assert(read('pacefold-experience.txt').trim()==='26.0.0 foundation-r1','Build identity is wrong');

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
const cueSource=fs.readFileSync(path.resolve('src/modules/cues.js'),'utf8'),cueStoreSource=fs.readFileSync(path.resolve('src/modules/cue-store.js'),'utf8'),scheduleSource=fs.readFileSync(path.resolve('src/modules/schedule.js'),'utf8'),mainSource=fs.readFileSync(path.resolve('src/modules/main.mjs'),'utf8'),stateSource=fs.readFileSync(path.resolve('src/modules/state.js'),'utf8'),notesSource=fs.readFileSync(path.resolve('src/modules/notes.js'),'utf8'),edgeSource=fs.readFileSync(path.resolve('src/modules/edges.js'),'utf8');

assert(packageJson.version==='26.0.0','Package release identity is wrong');
assert(packageJson.devDependencies?.esbuild==='0.28.1','esbuild must stay exactly pinned');
assert((app.match(/<link[^>]+stylesheet/g)||[]).length===1,'App must load exactly one stylesheet');
assert((app.match(/<script/g)||[]).length===2,'App must load only MSAL and one Pacefold runtime');
assert(!runtime.includes('./core.mjs')&&!runtime.includes('../modules/'),'Built runtime still references source modules');
assert(mainSource.includes('installCueStore(ctx)')&&mainSource.includes('installEdges(ctx)'),'V26 cue-store or edge module is not wired into the runtime');
assert(cueSource.includes('notify-${iconName}-128.png')&&cueSource.includes('badge-96.png'),'Raster notification URLs are missing from readable cue source');
assert(cueSource.includes("{action:'ack',title:'Clear'}")&&cueSource.includes("{action:'snooze',title:'Snooze 10m'}"),'Readable notification actions are incomplete');
assert(runtime.includes('Snooze 10m'),'Notification action behaviour was not included in the bundle');
assert(worker.includes('notify-water-128.png')&&worker.includes('notify-prayer-128.png')&&worker.includes('badge-96.png'),'Offline shell does not cache raster notification assets');
assert(worker.includes("event.action==='ack'")&&worker.includes("event.action==='snooze'")&&worker.includes("indexedDB.open('pacefold-v26'"),'Closed-window cue persistence is incomplete');
assert(worker.includes("event.tag==='pacefold-cues'")&&worker.includes('deliverBackgroundCue'),'Periodic background cue handler is missing');
assert(!worker.includes("'./app/core.mjs'"),'Service worker still caches removed bundled source');
assert(cueStoreSource.includes("periodicSync.register('pacefold-cues'")&&cueStoreSource.includes("minInterval:15*60*1000"),'Guarded periodic-sync registration is missing');
assert(styles.includes('display-mode: window-controls-overlay')&&styles.includes('app-region:drag')&&styles.includes('min-width:120px'),'WCO drag contract is incomplete');
assert(styles.includes('app-region:no-drag'),'WCO interactive controls are not protected');
assert(styles.includes('.title-cue-strip')&&styles.includes('.clock-cue-notch'),'Supported cue chrome is incomplete');
assert(styles.includes('.rhythm-discretion-setting')&&styles.includes('.home-grid[data-rhythm-hidden="true"]'),'Discretion styles were not compiled into the single stylesheet');
assert(mainSource.includes("'neutral'")&&scheduleSource.includes("ctx.rhythmMode()==='names'")&&scheduleSource.includes('rhythmRevealUntil'),'Neutral rhythm default or temporary reveal contract is missing');
assert(scheduleSource.includes("meta.textContent='';meta.hidden=true"),'Clock rhythm metadata must stay empty and hidden');
assert(edgeSource.includes('setTimeout')&&edgeSource.includes('120')&&edgeSource.includes('260'),'Edge preview timing contract is missing');
assert(notesSource.includes("placeholder='Log a thought.'")&&notesSource.includes('clock-carry')&&notesSource.includes('note-inline-input'),'Clock Daybook capture or inline editing is missing');
assert(stateSource.includes("cueState:'pacefold.cues.v1'")&&stateSource.includes("JSON.stringify({v:1,items:ctx.notes"),'V26 storage schema migration is incomplete');
assert(app.includes('data-view="home"')&&app.includes('data-view="notes"')&&app.includes('data-view="worklog"')&&app.includes('data-view="now"')&&app.includes('data-view="settings"'),'Spatial views are incomplete');
assert((app.match(/class="quick-action/g)||[]).length===6,'Quick action dock is incomplete');
assert(app.includes('id="clock-seconds"')&&styles.includes('.hand-second'),'Live seconds are missing');
assert(styles.includes('.day-sun-group')&&styles.includes('.day-marker-button'),'SVG Day Unfold styling is incomplete');
assert(app.includes('id="calendar-grid"')&&app.includes('id="note-list"'),'Calendar Daybook is incomplete');
assert(app.includes('id="now-cue-list"')&&app.includes('id="now-guidance"'),'Now cue surface is incomplete');
assert(app.includes('id="settings-summary"')&&app.includes('id="data-health"'),'Settings overview is incomplete');
assert(manifest.start_url==='./app/'&&manifest.scope==='./'&&manifest.display==='standalone','Manifest navigation is wrong');
assert(Array.isArray(manifest.display_override)&&manifest.display_override.includes('window-controls-overlay'),'WCO manifest declaration is missing');

const toronto=migratePrefs({...DEFAULT_PREFS,timeZone:'America/Toronto',lat:43.6205,lng:-79.5132,profile:'original',asr:'hanafi',method:'15'}),summer=new Date('2026-08-10T16:00:00Z'),schedule=scheduleState(summer,toronto);
assert(schedule.today.length===6,'Prayer rhythm must include sunrise plus five prayers');assert(schedule.today.every((item,index,rows)=>index===0||item.date>rows[index-1].date),'Prayer rhythm is not ordered');assert(schedule.today.find(item=>item.id==='asr').date>schedule.today.find(item=>item.id==='dhuhr').date,'Hanafi Asr is invalid');
const migrated=migratePrefs({profile:'original',waterSips:8,noodleMinutes:45,showSeconds:true});assert(migrated.waterOz===8&&migrated.prepMinutes===45,'Legacy preference migration failed');
const migratedNotes=normalizeNotes([{id:'old',text:'Old note',createdAt:'2026-08-10T12:00:00Z'}]);assert(migratedNotes[0].body==='Old note','Legacy note migration failed');
const key=dateKey(summer,'America/Toronto'),sampleLog=normalizeLog({days:{[key]:{events:[{id:'f',type:'focus',source:'focus',label:'Focus',start:summer.getTime()-3600000,end:summer.getTime()}]}}}),metrics=metricsForDay(sampleLog,key,toronto,summer.getTime());assert(metrics.focus===3600000,'Day-log metrics failed');

console.log(JSON.stringify({release:'26.0.0',revision:'foundation-r1',runtimes:1,stylesheets:1,wco:'checked',notificationPng:'checked',notificationActions:2,rhythmDiscretion:'checked',storageSchemas:'v1',daybook:'checked',backgroundCues:'guarded',prayerSchedule:'passed'},null,2));
