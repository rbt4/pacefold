import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'_generic_core');
const fromVersion=process.argv[3]||'15.2.2';
const toVersion=process.argv[4]||'15.2.3';
const p=(...parts)=>path.join(root,...parts);
const read=file=>fs.readFileSync(p(file),'utf8');
const write=(file,value)=>fs.writeFileSync(p(file),value);
const fail=message=>{throw new Error(message);};
function replaceExact(source,needle,replacement,label,expected=1){
  const count=source.split(needle).length-1;
  if(count!==expected)fail(`${label}: expected ${expected}, found ${count}`);
  return source.split(needle).join(replacement);
}
function replaceVersion(file){
  if(!fs.existsSync(p(file)))return;
  const source=read(file),count=source.split(fromVersion).length-1;
  if(count)write(file,source.split(fromVersion).join(toVersion));
}

let app=read('app/app.js');
app=replaceExact(app,`const APP_VERSION='${fromVersion}';`,`const APP_VERSION='${toVersion}';`,'app version');
app=replaceExact(app,
  "    original:{label:'Pacefold Original',family:'muslim',note:'Islamic prayer rhythm with the original noodle-prep routine.',moments:[]},",
  "    original:{label:'Original preset',family:'muslim',note:'The bundled developer rhythm: faith-aware moments, hydration, care, a 30-minute preparation timer and a desk meal.',moments:[]},",
  'original preset copy');
app=replaceExact(app,
  'Pacefold can be secular, mindful, faith-aware or fully custom. These are personal reminders—not official religious rulings.',
  'Pacefold starts with the Original preset, a ready-to-use developer rhythm. Choose Everyday, Mindfulness, a faith-aware profile or Custom; nothing is locked. Faith reminders are personal—not official religious rulings.',
  'profile onboarding copy');
app=replaceExact(app,
  'The original noodle timer remains the developer default, but Pacefold can quietly time tea, coffee, food prep, brewing—or nothing at all.',
  'The Original preset uses a 30-minute noodles timer. Choose tea, coffee, food preparation, brewing, a custom routine—or no preparation cue at all.',
  'preparation onboarding copy');
for(const contract of [
  "profile:'original'",
  "prepPreset:'noodles'",
  "workHours:'08:30-16:30'",
  'waterTarget:24',
  "asr:'hanafi'",
  "lunchMode:'desk'",
  "lat:43.62,lng:-79.51,locationLabel:'Toronto'"
])if(!app.includes(contract))fail(`Original developer default changed or missing: ${contract}`);
write('app/app.js',app);

let site=read('site.js');
site=replaceExact(site,`const APP_VERSION='${fromVersion}';`,`const APP_VERSION='${toVersion}';`,'site version');
write('site.js',site);

for(const workerFile of ['service-worker.js','app/service-worker.js']){
  if(!fs.existsSync(p(workerFile)))continue;
  let worker=read(workerFile),marker=`const VERSION='${fromVersion}';`,count=worker.split(marker).length-1;
  if(count>1)fail(`${workerFile} has ${count} version declarations`);
  if(count===1)worker=worker.replace(marker,`const VERSION='${toVersion}';`);
  write(workerFile,worker);
}

let landing=read('index.html');
const landingReplacements=[
  ['<title>Pacefold — Your day, quietly kept</title>','<title>Pacefold — A quieter rhythm for any workday</title>','landing title'],
  ['<meta name="description" content="A quiet workday surface for rhythm, ergonomic care, sound and local capture with optional Microsoft OneNote sync.">','<meta name="description" content="A quiet, local-first workday rhythm app for personal moments, hydration, movement, preparation, capture and optional sound.">','landing description'],
  ['<div class="eyebrow">Ma system · one quiet layer for the workday</div>','<div class="eyebrow">One quiet layer for any workday</div>','hero eyebrow'],
  ['<p class="lead">A calm workday surface for rhythm, ergonomic care, sound and quick capture. Pacefold stays quiet in front; your OneNote notebook can live durably underneath.</p>','<p class="lead">Choose the rhythm that fits you: hydration, movement, personal moments, preparation, meals, quick capture and optional sound. Pacefold stays calm in front and local by default.</p>','hero lead'],
  ['<div class="micro">Local first · offline-ready · automatic updates · Microsoft connection optional</div>','<div class="micro">No account · offline-ready · private by default · Microsoft connection optional</div>','hero privacy line'],
  ['<section class="profile-strip" aria-label="Available rhythm profiles"><div class="wrap profile-scroll"><span>Everyday</span><span>Mindfulness</span><span class="selected">Pacefold Original</span><span>Muslim</span><span>Jewish</span><span>Christian</span><span>Hindu</span><span>Buddhist</span><span>Custom</span></div></section>','<section class="profile-strip" aria-label="Available rhythm profiles"><div class="wrap profile-scroll"><span>Everyday</span><span>Mindfulness</span><span class="selected">Original preset</span><span>Muslim</span><span>Jewish</span><span>Christian</span><span>Hindu</span><span>Buddhist</span><span>Custom</span></div></section>','profile strip'],
  ['<div class="sectionhead"><div class="eyebrow">Setup that does not depend on a hidden browser event</div><h2>Choose your rhythm. Then install.</h2><p>Pick a profile, preparation routine, display comfort, eye and movement cadence, then install. OneNote remains a separate optional connection so setup never blocks the core clock.</p></div>','<div class="sectionhead"><div class="eyebrow">A useful first run without locking anyone in</div><h2>Choose your rhythm. Then install.</h2><p>Pick a profile, preparation cue, display comfort, eye and movement cadence, then install. Every setting remains editable, and OneNote stays a separate optional connection.</p></div>','setup intro'],
  ['<p>Start with the developer’s Muslim + noodle configuration, or switch to secular, mindfulness, another faith-aware preset or your own moments.</p>','<p>Pacefold opens with its tested Original developer preset. Keep it, or switch immediately to Everyday, Mindfulness, a faith-aware profile or your own custom moments.</p>','setup preset copy'],
  ['<div class="install-note">Faith presets outside the Islamic calculation mode are editable personal reminders—not official religious or denominational time rulings.</div>','<div class="install-note">The preset is only a starting point. Faith-aware options are personal reminders; only the Islamic profile includes location-calculated prayer times.</div>','setup note'],
  ['<div class="sectionhead"><div class="eyebrow">One calm surface · four quiet systems</div><h2>Higher capability without dashboard sprawl.</h2><p>Rhythm, Care, Sound and Kiroku share one priority system. The clock remains visually dominant; deeper tools wait in a quiet dock until you ask for them.</p></div>','<div class="sectionhead"><div class="eyebrow">One calm surface · the tools you choose</div><h2>Capability without dashboard sprawl.</h2><p>Rhythm, Care, Sound and Capture share one priority system. The clock remains visually dominant; deeper tools wait in the quiet dock until requested.</p></div>','features intro'],
  ['<article class="bento wide profile-feature"><div><span class="feature-tag">Profiles</span><h3>Secular, mindful, faith-aware or custom.</h3><p>Use Everyday resets, meditation moments, location-calculated Islamic prayer times, editable Jewish, Christian, Hindu or Buddhist reminders—or write your own schedule.</p></div><div class="mini-profile-grid"><i>Everyday</i><i>Mindful</i><i class="on">Original</i><i>Muslim</i><i>Jewish</i><i>Christian</i><i>Hindu</i><i>Buddhist</i><i>Custom</i></div></article>','<article class="bento wide profile-feature"><div><span class="feature-tag">Profiles</span><h3>Everyday, mindful, faith-aware or custom.</h3><p>Use neutral workday resets, meditation moments, location-calculated Islamic prayer times, editable faith-aware reminders, or a schedule entirely your own.</p></div><div class="mini-profile-grid"><i>Everyday</i><i>Mindful</i><i class="on">Original</i><i>Muslim</i><i>Jewish</i><i>Christian</i><i>Hindu</i><i>Buddhist</i><i>Custom</i></div></article>','profile feature'],
  ['<article class="bento routine-feature"><span class="feature-tag">Routine mixer</span><h3>Your timer, not ours.</h3><p>Noodles remain the original default. Switch in one tap to tea, coffee, food prep, steeping/brewing or a renamed custom routine with your own duration.</p><div class="routine-stack"><span class="on">Noodles · 30m</span><span>Tea · 5m</span><span>Coffee · 8m</span><span>Custom · 15m</span></div></article>','<article class="bento routine-feature"><span class="feature-tag">Preparation cue</span><h3>Time the routine you actually use.</h3><p>Choose noodles, tea, coffee, food preparation, steeping or brewing, rename a custom routine, or turn the preparation cue off.</p><div class="routine-stack"><span class="on">Original · 30m</span><span>Tea · 5m</span><span>Coffee · 8m</span><span>Custom · 15m</span></div></article>','routine feature'],
  ['<p>Prayer or meditation pauses, desk meals, away lunches and bathroom breaks stay separate. Overlapping off-desk time is merged instead of inflated.</p>','<p>Personal pauses, meditation or prayer, meals, away time and other breaks remain distinct. Overlapping off-desk time is merged instead of inflated.</p>','ledger copy'],
  ['<article class="bento wide"><div><span class="feature-tag">Kiroku · OneNote</span><h3>Capture here. Keep it in HSSys.</h3><p>Write a note, task, incident, inspection, JHSC item or follow-up without leaving Pacefold. It saves locally first, then silently appends to one dated page in the OneNote section you choose.</p></div><div class="ledger-lines"><span><b>9:12</b> Follow-up · local</span><span><b>11:06</b> Inspection · queued</span><span><b>2:24</b> Incident · synced</span></div></article>','<article class="bento wide"><div><span class="feature-tag">Capture · OneNote</span><h3>Capture here. Keep it where you work.</h3><p>Write a note, task, follow-up, incident or other quick record without leaving Pacefold. It saves locally first, then can append to the OneNote notebook and section you choose.</p></div><div class="ledger-lines"><span><b>9:12</b> Note · local</span><span><b>11:06</b> Follow-up · queued</span><span><b>2:24</b> Task · synced</span></div></article>','OneNote feature'],
  ['<details><summary>Is OneNote sync really silent?</summary><p>After a one-time Microsoft sign-in and destination choice, captures queue locally and retry in the background. Microsoft Entra registration is required, and university policy may require administrator approval. <a href="./onenote-setup.html">Read the exact setup.</a></p></details>','<details><summary>Is Microsoft or OneNote required?</summary><p>No. Pacefold works locally without an account. OneNote is an optional bridge after a one-time Microsoft sign-in and destination choice. Workplace policy may require administrator approval. <a href="./onenote-setup.html">Read the exact setup.</a></p></details>','OneNote FAQ'],
  ['<section class="wrap final"><h2>Space for what matters.</h2><p>Start with Pacefold Original or make the rhythm entirely your own.</p>','<section class="wrap final"><h2>Start ready. Make it yours.</h2><p>Use the Original preset as-is, change one piece, or build a completely different rhythm in about a minute.</p>','final call to action'],
  [`<footer class="wrap footer"><span>Pacefold ${fromVersion} · your day, quietly kept</span>`,`<footer class="wrap footer"><span>Pacefold ${toVersion} · for any workday</span>`,'footer']
];
for(const [needle,replacement,label] of landingReplacements)landing=replaceExact(landing,needle,replacement,label);
write('index.html',landing);

for(const manifestFile of ['manifest.webmanifest','app/manifest.webmanifest']){
  if(!fs.existsSync(p(manifestFile)))continue;
  const manifest=JSON.parse(read(manifestFile));
  manifest.name='Pacefold';manifest.short_name='Pacefold';
  manifest.description='A quiet, local-first workday rhythm app for personal moments, care, preparation, capture and optional sound.';
  write(manifestFile,`${JSON.stringify(manifest,null,2)}\n`);
}

let validate=read('scripts/validate.mjs');
const validationBlock=`\nconst publicLanding=read('index.html');\nfor(const banned of ["developer’s Muslim + noodle configuration",'Keep it in HSSys','Noodles remain the original default'])if(publicLanding.includes(banned))fail(\`Public landing remains developer-specific: \${banned}\`);\nfor(const required of ['One quiet layer for any workday','Original preset','Capture here. Keep it where you work.','No account · offline-ready'])if(!publicLanding.includes(required))fail(\`Generic public landing contract missing: \${required}\`);\nfor(const originalDefault of ["profile:'original'","prepPreset:'noodles'","workHours:'08:30-16:30'",'waterTarget:24',"asr:'hanafi'","lunchMode:'desk'","locationLabel:'Toronto'"])if(!appJs.includes(originalDefault))fail(\`Original developer preset changed: \${originalDefault}\`);\n`;
if(!validate.includes('Generic public landing contract missing'))validate+=validationBlock;
write('scripts/validate.mjs',validate);

let browser=read('scripts/browser-audit.cjs');
browser=browser.split(fromVersion).join(toVersion);
browser=browser.split(fromVersion.replaceAll('.','\\.')).join(toVersion.replaceAll('.','\\.'));
browser=browser.replaceAll('your day, quietly kept','for any workday');
write('scripts/browser-audit.cjs',browser);

for(const file of ['README.md','CHANGELOG.md','REPOSITORY_SETUP.md','SECURITY.md','ONENOTE_SETUP.md','onenote-setup.html','privacy.html'])replaceVersion(file);
if(fs.existsSync(p('CHANGELOG.md'))){
  let changelog=read('CHANGELOG.md');
  if(!changelog.includes(`## ${toVersion}`))changelog=changelog.replace(/^#([^\n]*)\n/,match=>`${match}\n## ${toVersion}\n- Reframed the public website and onboarding for all users while preserving the Original developer preset and its tested defaults.\n\n`);
  write('CHANGELOG.md',changelog);
}
if(fs.existsSync(p('README.md'))){
  let readme=read('README.md');
  if(!readme.includes('## Original developer preset'))readme+=`\n## Original developer preset\n\nPacefold is for everyone, but it ships with the creator-tested Original preset so the first run is useful rather than empty. Its defaults remain an 8:30 a.m.–4:30 p.m. workday, location-calculated Muslim moments with Hanafi Asr in Toronto, a 24 oz hydration target, 30-minute noodles preparation, a 20-minute desk meal, 20-minute eye cues and 45-minute movement cues. Setup can replace any or all of these immediately with Everyday, Mindfulness, another faith-aware profile or a fully custom rhythm.\n`;
  readme=readme.replaceAll('the HSSys notebook','a local notebook').replaceAll('Keep it in HSSys','Keep it in the OneNote destination you choose');
  write('README.md',readme);
}

console.log(JSON.stringify({core:{from:fromVersion,to:toVersion},publicSite:'generic',defaultPreset:'original-preserved'},null,2));
