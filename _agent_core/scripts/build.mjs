import fs from 'node:fs';
import path from 'node:path';

/* Pacefold direct-source build. app/app.js is what the browser loads. */
const root=path.resolve(process.argv[2]||'.');
const p=(...a)=>path.join(root,...a);
const source=fs.readFileSync(p('app','app.js'),'utf8');
const version=(source.match(/const APP_VERSION='([^']+)'/)||[])[1];
if(!version)throw new Error('APP_VERSION not found in app/app.js');
const site=fs.readFileSync(p('site.js'),'utf8');
const siteVersion=(site.match(/const APP_VERSION='([^']+)'/)||[])[1];
if(siteVersion!==version)throw new Error(`Release version mismatch: app=${version}, site=${siteVersion||'missing'}`);
if(!fs.readFileSync(p('CHANGELOG.md'),'utf8').includes(`## ${version}`))throw new Error(`CHANGELOG.md has no ${version} release entry`);
let worker=fs.readFileSync(p('service-worker.js'),'utf8');
worker=worker.replace(/const VERSION='[^']*';/,`const VERSION='${version}';`);
for(const asset of ["'./app/app.js'","'./app/app-style-05.css'","'./app/vendor/msal-browser-5.17.1.min.js'","'./onenote-setup.html'","'./app/icons/notification-prayer.png'","'./app/icons/shortcut-ack.png'"])if(!worker.includes(asset))throw new Error(`Root service worker must cache ${asset}`);
fs.writeFileSync(p('service-worker.js'),worker);
console.log(`Pacefold direct-source build: app/app.js ${Buffer.byteLength(source)}B, version ${version}`);
