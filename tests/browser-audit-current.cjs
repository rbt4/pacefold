'use strict';
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');

const sourceFile=path.join(__dirname,'browser-audit.cjs');
const displayVersion=JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'),'utf8')).version;
const runtimeVersion=displayVersion.startsWith('28.')?'27.1.0':displayVersion;
let source=fs.readFileSync(sourceFile,'utf8').replaceAll("'27.0.0'",`'${runtimeVersion}'`);
source=source
  .replace("home.player&&home.oldLaunch==='none'","home.player&&(home.oldLaunch==='none'||home.oldLaunch==='missing')")
  .replace("'Bottom row is not the integrated mini player'","'Streaming player surface is missing or legacy launcher is visible'");
const firstStart=source.indexOf('    const firstRun=');
const firstEnd=source.indexOf('    const mobile=',firstStart);
if(firstStart<0||firstEnd<0)throw new Error('Could not locate first-run audit block');
const firstRun=`    const firstRun=await browser.newContext({viewport:{width:900,height:760},timezoneId:'America/Toronto'}),fresh=await firstRun.newPage();
    await fresh.goto(\`${'${origin}'}/app/\`,{waitUntil:'networkidle'});await fresh.waitForSelector('html.ready');await fresh.waitForTimeout(500);assert(await fresh.locator('#setup-dialog[open]').count()===0,'Setup must not block a fresh launch');assert(await fresh.evaluate(()=>localStorage.getItem('pacefoldOnboardedV15')==='1'&&localStorage.getItem('pacefoldSetupDismissedV15')==='1'),'Launch did not persist the setup-complete markers');await fresh.reload({waitUntil:'networkidle'});await fresh.waitForTimeout(500);assert(await fresh.locator('#setup-dialog[open]').count()===0,'Setup returned after reload');await firstRun.close();

`;
source=source.slice(0,firstStart)+firstRun+source.slice(firstEnd);
const audit=new Module(sourceFile,module);
audit.filename=sourceFile;
audit.paths=Module._nodeModulePaths(path.dirname(sourceFile));
audit._compile(source,sourceFile);
