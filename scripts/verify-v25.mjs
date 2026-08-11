import fs from'node:fs';
import path from'node:path';
import vm from'node:vm';
import{spawnSync}from'node:child_process';
import{VERSION,REVISION,DEFAULT_PREFS,migratePrefs,scheduleState,normalizeNotes,normalizeLog,metricsForDay,dateKey}from'../src/app/core.mjs';

const root=path.resolve(process.argv[2]||'_site'),read=file=>fs.readFileSync(path.join(root,file),'utf8'),exists=file=>fs.existsSync(path.join(root,file)),assert=(condition,message)=>{if(!condition)throw new Error(message)};
const required=['index.html','site.css','privacy.html','manifest.webmanifest','service-worker.js','pacefold-experience.txt','app/index.html','app/pacefold.css','app/pacefold.mjs','app/core.mjs','app/auth.html','app/auth.js','app/icons/fold-mark.svg','app/icons/icon-192.png','app/icons/icon-512.png','app/fonts/pacefold-ma.woff2','app/vendor/msal-browser-5.17.1.min.js','app/vendor/msal-redirect-bridge-5.17.1.min.js'];
for(const file of required)assert(exists(file),`Missing ${file}`);
assert(VERSION==='25.1.0'&&REVISION==='polish-r2','Core release identity is wrong');
assert(read('pacefold-experience.txt').trim()==='25.1.0 polish-r2','Build identity is wrong');

for(const file of ['app/pacefold.mjs','app/core.mjs','app/auth.js','service-worker.js']){
  const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});assert(result.status===0,`${file} syntax failed: ${result.stderr}`);
}

function validateHtml(file){
  const html=read(file),base=path.dirname(file),ids=[...html.matchAll(/\sid=["']([^"']+)["']/g)].map(match=>match[1]),duplicates=ids.filter((value,index)=>ids.indexOf(value)!==index);assert(!duplicates.length,`${file} has duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);
  for(const match of html.matchAll(/\s(?:src|href)=["']([^"']+)["']/g)){let reference=match[1];if(!reference||reference.startsWith('#')||reference.startsWith('data:')||reference.startsWith('http:')||reference.startsWith('https:'))continue;reference=reference.split(/[?#]/)[0];if(!reference)continue;const target=path.normalize(path.join(base,reference));assert(exists(target)||exists(path.join(target,'index.html')),`${file} references missing ${match[1]}`)}
}
for(const file of ['index.html','privacy.html','app/index.html','app/auth.html'])validateHtml(file);

const app=read('app/index.html'),runtime=read('app/pacefold.mjs'),styles=read('app/pacefold.css'),worker=read('service-worker.js'),landing=read('index.html'),manifest=JSON.parse(read('manifest.webmanifest'));
const appIds=new Set([...app.matchAll(/\bid=["']([^"']+)["']/g)].map(match=>match[1])),runtimeIds=[...new Set([...runtime.matchAll(/\bid\('([^']+)'\)/g)].map(match=>match[1]))],missingRuntimeIds=runtimeIds.filter(value=>!appIds.has(value));assert(!missingRuntimeIds.length,`Runtime references missing IDs: ${missingRuntimeIds.join(', ')}`);
assert((app.match(/<link[^>]+stylesheet/g)||[]).length===1,'App must load exactly one stylesheet');
assert((app.match(/<script/g)||[]).length===2,'App must load only the MSAL vendor and one Pacefold runtime');
assert(!/pacefold-(?:v1[5-9]|v2[0-4]|hub|integrated|revamp|ma|spatial|daylight)/i.test(app),'App still references a legacy product layer');
assert(!/\bMa\b|verified offline core 15\.2\.2/i.test(app),'App exposes obsolete copy');
assert(!/\.innerHTML\s*=|eval\s*\(/.test(runtime),'Runtime contains unsafe dynamic HTML or eval');
assert(app.includes('data-view="home"')&&app.includes('data-view="notes"')&&app.includes('data-view="worklog"')&&app.includes('data-view="now"')&&app.includes('data-view="settings"'),'Spatial views are incomplete');
assert((app.match(/class="quick-action/g)||[]).length===6,'Quick action dock is incomplete');
assert(app.includes('id="clock-seconds"')&&styles.includes('.hand-second'),'Live seconds are missing');
assert(app.includes('id="day-markers"')&&styles.includes('.day-sun'),'Day Unfold is incomplete');
assert(app.includes('id="calendar-grid"')&&app.includes('id="note-list"'),'Calendar Daybook is incomplete');
assert(app.includes('id="note-insights"')&&app.includes('id="note-cancel"')&&!runtime.includes("prompt('Edit this note'"),'Polished inline note editing is incomplete');
assert(app.includes('id="day-story-title"')&&app.includes('id="day-balance-bar"')&&app.includes('id="timeline-meta"'),'Day Log context is incomplete');
assert(app.includes('id="now-cue-list"')&&app.includes('id="now-guidance"')&&app.includes('class="now-quick"'),'Now decision surface is incomplete');
assert(app.includes('id="settings-summary"')&&app.includes('id="data-health"')&&app.includes('id="time-format-input"'),'Settings overview is incomplete');
assert(app.includes('id="backup-file"')&&runtime.includes('showSaveFilePicker'),'Live backup support is incomplete');
assert(runtime.includes("const map={ArrowUp:'notes',ArrowDown:'settings',ArrowLeft:'worklog',ArrowRight:'now'}"),'Directional contract is missing');
assert(runtime.includes("KEYS.prefs")&&runtime.includes("KEYS.notes")&&runtime.includes("KEYS.log"),'Established local storage keys are not used');
assert(worker.includes("const VERSION='25.1.0'")&&worker.includes("pacefold-v${VERSION}-polish-r2"),'Worker version is stale');
assert(!/pacefold-v2[0-4]|app-style-|pacefold-hub/.test(worker),'Worker still caches obsolete layers');
assert(manifest.start_url==='./app/'&&manifest.scope==='./'&&manifest.display==='standalone','Manifest navigation is wrong');
assert(manifest.name.includes('Pacefold')&&landing.includes('Pacefold 25'),'Public release identity is incomplete');

const toronto=migratePrefs({...DEFAULT_PREFS,timeZone:'America/Toronto',lat:43.6205,lng:-79.5132,profile:'original',asr:'hanafi',method:'15'}),summer=new Date('2026-08-10T16:00:00Z'),schedule=scheduleState(summer,toronto);
assert(schedule.today.length===6,'Prayer rhythm must include sunrise plus five prayers');
assert(schedule.today.every((item,index,rows)=>index===0||item.date>rows[index-1].date),'Prayer rhythm is not ordered');
assert(schedule.today.find(item=>item.id==='asr').date>schedule.today.find(item=>item.id==='dhuhr').date,'Hanafi Asr is invalid');
const migrated=migratePrefs({profile:'original',waterSips:8,noodleMinutes:45,showSeconds:true});assert(migrated.waterOz===8&&migrated.prepMinutes===45,'Legacy preference migration failed');
const migratedNotes=normalizeNotes([{id:'old',text:'Old note',createdAt:'2026-08-10T12:00:00Z'}]);assert(migratedNotes[0].body==='Old note','Legacy note migration failed');
const key=dateKey(summer,'America/Toronto'),sampleLog=normalizeLog({days:{[key]:{events:[{id:'f',type:'focus',source:'focus',label:'Focus',start:summer.getTime()-3600000,end:summer.getTime()}]}}}),metrics=metricsForDay(sampleLog,key,toronto,summer.getTime());assert(metrics.focus===3600000,'Day-log metrics failed');

console.log(JSON.stringify({release:VERSION,revision:REVISION,runtimes:1,stylesheets:1,views:5,actions:6,notesMigration:'passed',prayerSchedule:'passed',offlineShell:'direct'},null,2));
