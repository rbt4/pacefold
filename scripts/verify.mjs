import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const repo=path.resolve(process.argv[2]||'.');
const fail=message=>{throw new Error(message);};
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const run=(command,args,options={})=>{const result=spawnSync(command,args,{cwd:options.cwd||repo,encoding:'utf8',stdio:options.stdio||'pipe',env:{...process.env,...options.env}});if(result.status!==0)fail(`${command} ${args.join(' ')} failed:\n${result.stderr||result.stdout}`);return String(result.stdout||'').trim();};
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const pins={
  'pacefold-hub.js.gz.b64.part-00':'9ee4b39abd4e009ccd51b1f0a1d63ca355b1e38e','pacefold-hub.js.gz.b64.part-01a':'965b37f16fca294619bd2ab1026fa3b994fe41e4','pacefold-hub.js.gz.b64.part-01b':'218fbe2ab562da27c9bd8cc1867d0749ee989566','pacefold-hub.js.gz.b64.part-01c':'fc9b50bc875cc1bd2a5d8c8bf19e0f2775cbfe4a','pacefold-hub.js.gz.b64.part-01d':'b1241ec0538977f91a97d7e7f74f2d10c4391d99','pacefold-hub.js.gz.b64.part-02':'2fed7d603cd98dc9ead13d3fa31041c785d08992','pacefold-hub.js.gz.b64.part-03':'11475bc120387ecf1cbf16dc8038aa5401d7db72'
};
const releaseDir=path.join(repo,'release'),parts=fs.readdirSync(releaseDir).filter(name=>/^pacefold-v15\.zip\.b64\.part-\d{2}$/.test(name)).sort();
if(parts.length!==9||parts[0]!=='pacefold-v15.zip.b64.part-00'||parts.at(-1)!=='pacefold-v15.zip.b64.part-08')fail(`Release parts must be exactly part-00 through part-08: ${parts.join(', ')}`);
const archive=Buffer.from(parts.map(name=>fs.readFileSync(path.join(releaseDir,name),'utf8')).join('').replace(/\s+/g,''),'base64'),actualSha=sha(archive);
const workflow=read('.github/workflows/pages.yml'),rootReadme=read('README.md'),release=read('RELEASE.md');
const workflowPins=[...workflow.matchAll(/[a-f0-9]{64}\s+\/tmp\/pacefold-v15\.zip/g)].map(match=>match[0].slice(0,64));
if(workflowPins.length!==2||workflowPins.some(value=>value!==actualSha))fail(`Workflow SHA pins do not match ${actualSha}`);
for(const [file,value] of [['README.md',rootReadme],['RELEASE.md',release]]){const pinsFound=[...value.matchAll(/[a-f0-9]{64}/g)].map(match=>match[0]).filter(item=>item===actualSha);if(pinsFound.length!==1)fail(`${file} must contain the archive SHA exactly once`);}
for(const [name,expected] of Object.entries(pins)){const actual=run('git',['hash-object',path.join(repo,'enhancements',name)]);if(actual!==expected)fail(`Hub hash changed: ${name}`);}

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pacefold-verify-')),zipFile=path.join(temp,'release.zip'),core=path.join(temp,'core'),site=path.join(temp,'site'),debug=path.join(temp,'debug');
fs.writeFileSync(zipFile,archive);fs.mkdirSync(core);run('unzip',['-q',zipFile,'-d',core]);
const app=fs.readFileSync(path.join(core,'app','app.js'),'utf8'),version=app.match(/const APP_VERSION='([^']+)'/)?.[1];if(!version)fail('Core APP_VERSION missing');if(!release.includes(`Version: \`${version}\``))fail(`RELEASE.md does not identify ${version}`);
for(const file of ['app/app.js','app/auth.js','site.js','service-worker.js','app/service-worker.js','scripts/browser-audit.cjs','scripts/build.mjs','scripts/validate.mjs'])run('node',['--check',path.join(core,file)]);
run('node',[path.join(core,'scripts','build.mjs'),core]);run('node',[path.join(core,'scripts','validate.mjs'),core]);
const appHtml=fs.readFileSync(path.join(core,'app','index.html'),'utf8');
if(appHtml.includes("'unsafe-inline'")||!appHtml.includes("require-trusted-types-for 'script'")||!appHtml.includes('trusted-types pacefold'))fail('Core CSP hardening is incomplete');
if(/style=\"/.test(app)||/\.innerHTML\s*=/.test(app))fail('Core contains an inline style or raw innerHTML assignment');
if(!app.includes("cacheLocation:'sessionStorage'")||app.includes("cacheLocation:'localStorage'"))fail('MSAL cache is not session-scoped');
if(!app.includes('staleAfterMinutes')||!app.includes("'cue-missed'")||!app.includes("'clock-jump'")||!app.includes('controlledWorkerVersion'))fail('Functional hardening signatures are missing');
const worker=fs.readFileSync(path.join(core,'service-worker.js'),'utf8');for(const signature of ['const CRITICAL=','const OPTIONAL=','Promise.allSettled(OPTIONAL','PACEFOLD_SHELL_STATUS'])if(!worker.includes(signature))fail(`Worker hardening missing: ${signature}`);

fs.cpSync(core,site,{recursive:true});
for(let pass=0;pass<2;pass++)for(const injector of ['inject.mjs','inject-v22-hardening.mjs','inject-v22-daylight.mjs'])run('node',[path.join(repo,'enhancements',injector),site]);
run('node',[path.join(repo,'enhancements','inject-v23.mjs'),site]);run('node',[path.join(repo,'enhancements','inject-v23.mjs'),site]);
for(const name of ['pacefold-hub.js','pacefold-hub-guardian.js','pacefold-resilience.js','pacefold-integrated.js','pacefold-theme-boot.js','pacefold-ma.js','pacefold-v19.js','pacefold-v20.js','pacefold-v21-boot.js','pacefold-v22-spatial.js','pacefold-v22-hardening.js','pacefold-v22-cues.js','pacefold-v22-daylight.js','pacefold-v23-stability.js','pacefold-v23.js']){
  const source=fs.readFileSync(path.join(site,'app',name),'utf8');
  run('node',['--check',path.join(site,'app',name)]);
  if(/\.innerHTML\s*=/.test(source))fail(`${name} contains a raw innerHTML assignment after injection`);
}
const injectedHtml=fs.readFileSync(path.join(site,'app','index.html'),'utf8');
const landingHtml=fs.readFileSync(path.join(site,'index.html'),'utf8');
if((injectedHtml.match(/data-pacefold-theme-boot=/g)||[]).length!==1)fail('Theme boot was not injected exactly once');
if((injectedHtml.match(/data-pacefold-ma=/g)||[]).length!==2)fail('Ma stylesheet and runtime were not injected exactly once');
if((injectedHtml.match(/data-pacefold-v19=/g)||[]).length!==2)fail('V19 stylesheet and runtime were not injected exactly once');
if((injectedHtml.match(/data-pacefold-v20=/g)||[]).length!==2)fail('V20 stylesheet and runtime were not injected exactly once');
if(injectedHtml.indexOf('pacefold-theme-boot.js')>injectedHtml.indexOf('app-style-01.css'))fail('Theme boot does not precede the first stylesheet');
if((injectedHtml.match(/data-pacefold-v23-boot="23\.0\.0"/g)||[]).length!==1||(injectedHtml.match(/data-pacefold-v23-css="23\.0\.0"/g)||[]).length!==1||(injectedHtml.match(/data-pacefold-v23-runtime="23\.0\.0"/g)||[]).length!==1)fail('V23 active assets were not injected exactly once');
if((injectedHtml.match(/<link[^>]+rel="stylesheet"/g)||[]).length!==13||(injectedHtml.match(/<script[^>]+src=/g)||[]).length!==13)fail('V23 active request consolidation regressed');
if(/<link[^>]+data-pacefold-v2[12]-/i.test(injectedHtml)||/<script[^>]+data-pacefold-v22-/i.test(injectedHtml))fail('An individual V21/V22 active asset remains after bundling');
if((landingHtml.match(/name="pacefold-landing" content="23\.0\.0"/g)||[]).length!==1)fail('V23 landing page was not injected exactly once');
if(!landingHtml.includes('Pacefold 23 · one quiet spatial workday')||!landingHtml.includes('Four directions. One quiet center.')||!landingHtml.includes('automatic JSON backup')||!landingHtml.includes('Where do my notes go?'))fail('V23 landing page does not describe the spatial product');
if(/Japanese restraint|\bOneNote\b|Kiroku ·|Andon ·|Hansei ·|Kaizen ·|Sumi workspace|Ma · Day Ribbon|Pacefold 15\.2\.2 · your day/.test(landingHtml))fail('V19 landing page retains stale product language');
if(!fs.existsSync(path.join(site,'pacefold-site-ma.css')))fail('Ma landing stylesheet is missing');
if(!fs.existsSync(path.join(site,'pacefold-site-v19.css')))fail('V19 landing stylesheet is missing');
if(!fs.existsSync(path.join(site,'app','pacefold-v19.css'))||!fs.existsSync(path.join(site,'app','pacefold-v19.js')))fail('V19 app assets are missing');
if(!fs.existsSync(path.join(site,'app','pacefold-v20.css'))||!fs.existsSync(path.join(site,'app','pacefold-v20.js')))fail('V20 app assets are missing');
if(injectedHtml.includes('graph.microsoft.com'))fail('V19 app CSP still permits the retired OneNote integration');
const injectedHub=fs.readFileSync(path.join(site,'app','pacefold-hub.js'),'utf8');
if(!injectedHub.includes('pacefoldV19Weather')||injectedHub.includes('latitude=43.6532&longitude=-79.3832'))fail('The legacy weather surface still ignores saved coordinates');
const maFont=path.join(site,'app','fonts','pacefold-ma.woff2');
if(!fs.existsSync(maFont)||fs.statSync(maFont).size>15000)fail('Ma variable font subset is missing or exceeds 15 KB');
const injectedManifest=JSON.parse(fs.readFileSync(path.join(site,'manifest.webmanifest'),'utf8'));
if(JSON.stringify(injectedManifest.display_override)!==JSON.stringify(['window-controls-overlay','standalone']))fail('Window Controls Overlay fallback order is missing');
const injectedWorker=fs.readFileSync(path.join(site,'service-worker.js'),'utf8');
for(const asset of ['pacefold-site-ma.css','pacefold-site-v19.css','pacefold-ma.css','pacefold-ma.js','pacefold-v19.css','pacefold-v19.js','pacefold-v20.css','pacefold-v20.js','pacefold-theme-boot.js','pacefold-hub-guardian.js','pacefold-resilience.js','pacefold-hub.js','pacefold-integrated.js','pacefold-revamp.js','pacefold-fold-mark.svg','fonts/pacefold-ma.woff2','pacefold-v23-boot.css','pacefold-v23.css','pacefold-v23.js'])if(!injectedWorker.includes(asset))fail(`Offline shell omits ${asset}`);
if(!injectedWorker.includes('caches.match(request,{ignoreSearch:true})'))fail('Offline worker does not resolve cache-busted asset URLs');
if(!injectedWorker.includes('revision:23.0.0'))fail('V23 worker revision is stale');
if(fs.readFileSync(path.join(site,'pacefold-experience.txt'),'utf8').trim()!=='23.0.0'||fs.readFileSync(path.join(site,'pacefold-stability.txt'),'utf8').trim()!=='23.0.0 23.0.0')fail('V23 release markers are stale');
if(read('enhancements/VERSION').trim()!=='23.0.0')fail('Enhancement VERSION is stale');
const v23Css=fs.readFileSync(path.join(site,'app','pacefold-v23.css'),'utf8'),v23Runtime=fs.readFileSync(path.join(site,'app','pacefold-v23.js'),'utf8');
for(const token of ['@media(forced-colors:active)','@media(prefers-reduced-motion:reduce)','.pf23-seconds-dial','.pf22-settings-layout[data-hardened]'])if(!v23Css.includes(token))fail(`V23 CSS contract missing: ${token}`);
for(const token of ["const RELEASE='23.0.0'",'__PACEFOLD_ACTIVE_RELEASE__','pacefold.spatial.note.draft.v1'])if(!v23Runtime.includes(token))fail(`V23 runtime contract missing: ${token}`);
fs.cpSync(core,debug,{recursive:true});run('node',[path.join(debug,'scripts','build.mjs'),debug],{env:{PACEFOLD_DEBUG:'1'}});const debugApp=fs.readFileSync(path.join(debug,'app','app.js'),'utf8');if(!debugApp.includes('const DEBUG_BUILD=true;'))fail('Debug build flag was not enabled for audits');
console.log(JSON.stringify({version,sha256:actualSha,parts:parts.length,hubPins:'verified',coreValidation:'passed',surface:'23.0.0 spatial workday',trustedTypes:'core and injected surfaces',offlineAssets:'verified',landingPage:'23.0.0',activeRequests:{styles:13,scripts:13},oneNoteDelivery:'retired',debugAuditBuild:'enabled'},null,2));
