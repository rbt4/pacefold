import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(process.argv[2]||'.');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const exists=file=>fs.existsSync(path.join(root,file));
const fail=message=>{throw new Error(message)};
const list=(dir,pattern)=>fs.readdirSync(path.join(root,dir)).filter(name=>pattern.test(name)).sort().map(name=>path.posix.join(dir,name));
const appStyles=list('app',/^app-style-\d+\.css$/);
const siteStyles=list('.',/^site-style-\d+\.css$/).map(name=>name.replace(/^\.\//,''));
const required=[
  'index.html','site.js','privacy.html','onenote-setup.html','ONENOTE_SETUP.md','404.html','manifest.webmanifest','service-worker.js','.nojekyll',
  'app/index.html','app/auth.html','app/auth.js','app/app.js','app/service-worker.js',
  'app/vendor/msal-browser-5.17.1.min.js','app/vendor/msal-redirect-bridge-5.17.1.min.js','app/vendor/MSAL-LICENSE.txt',
  'app/icons/icon-32.png','app/icons/icon-192.png','app/icons/icon-512.png',
  ...['prayer','water','noodle','away','lunch','eyes','body','test'].map(name=>`app/icons/notification-${name}.png`),
  ...['ack','capture','care','sound'].map(name=>`app/icons/shortcut-${name}.png`),
  ...siteStyles,...appStyles
];
for(const file of required)if(!exists(file))fail(`Missing required file: ${file}`);
if(!appStyles.length||!siteStyles.length)fail('Application styles are incomplete');

const manifest=JSON.parse(read('manifest.webmanifest'));
if(manifest.scope!=='./')fail('Manifest scope must be ./');
if(!String(manifest.start_url||'').startsWith('./app/'))fail('Manifest start_url must open ./app/');
if(manifest.display!=='standalone')fail('Manifest display must be standalone');
for(const icon of manifest.icons||[]){
  const target=String(icon.src||'').replace(/^\.\//,'');
  if(!target||!exists(target))fail(`Manifest icon is missing: ${icon.src}`);
}
if(!(manifest.shortcuts||[]).some(item=>String(item.url||'').includes('action=ack')))fail('Taskbar acknowledge shortcut is missing');
for(const shortcut of manifest.shortcuts||[])for(const icon of shortcut.icons||[]){const target=String(icon.src||'').replace(/^\.\//,'');if(!target||!exists(target))fail(`Shortcut icon is missing: ${icon.src}`);}

function pngSize(file){
  const b=fs.readFileSync(path.join(root,file));
  if(b.toString('hex',0,8)!=='89504e470d0a1a0a')fail(`${file} is not a PNG`);
  return[b.readUInt32BE(16),b.readUInt32BE(20)];
}
for(const size of [32,192,512]){
  const [w,h]=pngSize(`app/icons/icon-${size}.png`);
  if(w!==size||h!==size)fail(`icon-${size}.png is ${w}x${h}`);
}
for(const file of [...['prayer','water','noodle','away','lunch','eyes','body','test'].map(name=>`app/icons/notification-${name}.png`),...['ack','capture','care','sound'].map(name=>`app/icons/shortcut-${name}.png`)]){const [w,h]=pngSize(file);if(w!==192||h!==192)fail(`${file} is ${w}x${h}`);}

const appJs=read('app/app.js');
const siteJs=read('site.js');
const worker=read('service-worker.js');
new vm.Script(appJs,{filename:'app/app.js'});
new vm.Script(read('app/auth.js'),{filename:'app/auth.js'});
if(!read('app/index.html').includes('./app.js'))fail('App HTML must load app/app.js directly');
if(!worker.includes("'./app/app.js'"))fail('Root service worker does not cache app/app.js');
const appVersion=appJs.match(/const APP_VERSION='([^']+)'/)?.[1];
const siteVersion=siteJs.match(/const APP_VERSION='([^']+)'/)?.[1];
const workerVersion=worker.match(/const VERSION='([^']+)'/)?.[1];
if(!appVersion||appVersion!==workerVersion||appVersion!==siteVersion)fail(`Version mismatch: app=${appVersion}, site=${siteVersion}, worker=${workerVersion}`);
for(const [file,pattern] of [['README.md',new RegExp(`Pacefold ${appVersion.replaceAll('.','\\.')}`)],['CHANGELOG.md',new RegExp(`## ${appVersion.replaceAll('.','\\.')}`)],['index.html',new RegExp(`Pacefold ${appVersion.replaceAll('.','\\.')}`)],['onenote-setup.html',new RegExp(`Pacefold ${appVersion.replaceAll('.','\\.')}`)]])if(exists(file)&&!pattern.test(read(file)))fail(`${file} does not identify release ${appVersion}`);
if(!appJs.includes("navigator.serviceWorker.register('../service-worker.js'"))fail('App does not register the root service worker');
if(!appJs.includes('requestNotifications')||!appJs.includes('pacefoldNotificationPreview')||!appJs.includes('runSelfCheck'))fail('Notification or self-check hardening is missing');
for(const profile of ['original','secular','mindful','muslim','jewish','christian','hindu','buddhist','custom'])if(!appJs.includes(`${profile}:`))fail(`Missing rhythm profile: ${profile}`);
for(const prep of ['noodles','tea','coffee','food','steep','custom'])if(!appJs.includes(`${prep}:`))fail(`Missing preparation preset: ${prep}`);
for(const feature of ['openOnboarding','ONBOARD_KEY','comfortMode','gazeEnabled'])if(!appJs.includes(feature))fail(`Missing core feature: ${feature}`);
for(const feature of ['bodyState','BODY_PROMPTS','saveCapture','syncCaptureQueue','Notes.ReadWrite','createOneNotePage','appendOneNoteCapture','buildNoiseBuffer','MediaMetadata','pendingUpdateReload'])if(!appJs.includes(feature))fail(`Missing Pacefold 15 feature: ${feature}`);
for(const feature of ['notificationWorkerReady','Permission allowed · test delivery failed','controllerSeenAtLoad','drainNotificationActions','notificationActionHistory','launchQueue','minutesUntilNextCue','taskbarBadgeMode','waterLastAt','organizeSettingsPanel','settingsView'])if(!appJs.includes(feature))fail(`Missing reliability guard: ${feature}`);
if(!appJs.includes('silent:true')||!appJs.includes('requireInteraction:false'))fail('System notifications must be silent and non-persistent');
if(appJs.includes('requireInteraction:true'))fail('Persistent alarm-style notifications must not return');
if(!appJs.includes("const icon=notificationIcon(source),actions=[{action:'ack'"))fail('Notifications must expose one contextual clear action');
for(const feature of ['notificationclick','PACEFOLD_DRAIN_ACTIONS','PACEFOLD_ACTION_CONSUMED','queueNotificationAction','event.action===\'ack\''])if(!worker.includes(feature))fail(`Service worker notification action handling is missing: ${feature}`);
if(!worker.includes('navigator.clearAppBadge'))fail('Service worker must clear the taskbar badge with a handled alert');
for(const asset of ['./app/app-style-05.css','./app/auth.html','./app/vendor/msal-browser-5.17.1.min.js','./onenote-setup.html','./app/icons/notification-prayer.png','./app/icons/shortcut-ack.png'])if(!worker.includes(`'${asset}'`))fail(`Service worker does not cache Pacefold 15 asset: ${asset}`);
if(!read('app/index.html').includes('msal-browser-5.17.1.min.js'))fail('App must load the pinned local MSAL runtime');
if(!read('app/vendor/MSAL-LICENSE.txt').includes('MIT License'))fail('MSAL license is missing or incomplete');
if(!read('app/auth.html').includes('msal-redirect-bridge-5.17.1.min.js'))fail('Microsoft popup bridge is missing');
if(!read('app/index.html').includes('https://graph.microsoft.com'))fail('App CSP does not allow the Microsoft Graph connection');

const siteCss=siteStyles.map(read).join('\n');
if(!/\.hero-art\{[^}]*position:relative/.test(siteCss))fail('Landing hero artwork must anchor its floating card');
if(/\.floating-card\{[^}]*right:-/.test(siteCss))fail('Landing floating card must not overflow the viewport');
const appCss=appStyles.map(read).join('\n');
for(const selector of ['.onboarding-option{','.onboarding-progress i{','.onboarding-summary{'])if(!appCss.includes(selector))fail(`Missing onboarding style: ${selector}`);
for(const selector of ['.settings-tabs{','.settings-view[hidden]','body.panel-open .setup-dock'])if(!appCss.includes(selector))fail(`Missing interaction refinement style: ${selector}`);

function validateHtml(file){
  const html=read(file),base=path.dirname(file);
  const ids=[...html.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]);
  const duplicates=ids.filter((id,i)=>ids.indexOf(id)!==i);
  if(duplicates.length)fail(`${file} has duplicate ids: ${[...new Set(duplicates)].join(', ')}`);
  for(const match of html.matchAll(/\s(?:src|href)=["']([^"']+)["']/g)){
    let ref=match[1];
    if(!ref||ref.startsWith('#')||ref.startsWith('data:')||ref.startsWith('http:')||ref.startsWith('https:')||ref.startsWith('mailto:')||ref.startsWith('ms-settings:'))continue;
    ref=ref.split(/[?#]/)[0];if(!ref)continue;
    const target=path.normalize(path.join(base,ref));
    if(!exists(target)&&!exists(path.join(target,'index.html')))fail(`${file} references missing asset: ${match[1]}`);
  }
  for(const match of html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']https?:/gi))fail(`${file} loads an external runtime script or stylesheet`);
}
for(const file of ['index.html','privacy.html','onenote-setup.html','404.html','app/index.html','app/auth.html'])validateHtml(file);

const appHtml=read('app/index.html');
const staticIds=new Set([...appHtml.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]));
const dynamicIds=new Set([...appJs.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));
for(const match of appJs.matchAll(/\$\('([^']+)'\)/g)){
  const id=match[1];
  if(!staticIds.has(id)&&!dynamicIds.has(id))fail(`app source references missing DOM id: ${id}`);
}

const shell=[...worker.matchAll(/'\.\/([^']*)'/g)].map(m=>m[1]).filter(Boolean);
for(const ref of shell){
  const clean=ref.endsWith('/')?`${ref}index.html`:ref;
  if(!exists(clean))fail(`Service worker shell references missing file: ${ref}`);
}
for(const file of [...siteStyles,...appStyles])if(!read(file).trim())fail(`${file} is empty`);
if(exists('app/manifest.webmanifest'))fail('Legacy app-scoped manifest should not remain');
for(const name of fs.readdirSync(path.join(root,'app')))if(/^app-(?:js-\d+\.txt|tail-\d+\.bin|loader\.js)$/.test(name))fail(`Obsolete generated runtime file remains: app/${name}`);
console.log(`Pacefold ${appVersion}: ${required.length} files, direct source, manifest, icons, references, worker and DOM checks passed.`);
