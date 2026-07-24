import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const repo=path.resolve(process.argv[2]||'.');
const source=path.resolve(process.argv[3]||path.join(repo,'_agent_core'));
const releaseDir=path.join(repo,'release');
const partPrefix='pacefold-v15.zip.b64.part-';
const hubPins={
  'pacefold-hub.js.gz.b64.part-00':'9ee4b39abd4e009ccd51b1f0a1d63ca355b1e38e',
  'pacefold-hub.js.gz.b64.part-01a':'965b37f16fca294619bd2ab1026fa3b994fe41e4',
  'pacefold-hub.js.gz.b64.part-01b':'218fbe2ab562da27c9bd8cc1867d0749ee989566',
  'pacefold-hub.js.gz.b64.part-01c':'fc9b50bc875cc1bd2a5d8c8bf19e0f2775cbfe4a',
  'pacefold-hub.js.gz.b64.part-01d':'b1241ec0538977f91a97d7e7f74f2d10c4391d99',
  'pacefold-hub.js.gz.b64.part-02':'2fed7d603cd98dc9ead13d3fa31041c785d08992',
  'pacefold-hub.js.gz.b64.part-03':'11475bc120387ecf1cbf16dc8038aa5401d7db72'
};
const fail=message=>{throw new Error(message);};
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const write=(file,value)=>fs.writeFileSync(path.join(repo,file),value);
const run=(command,args,options={})=>{const result=spawnSync(command,args,{cwd:options.cwd||repo,encoding:'utf8',stdio:options.stdio||'pipe'});if(result.status!==0)fail(`${command} ${args.join(' ')} failed:\n${result.stderr||result.stdout}`);return String(result.stdout||'').trim();};
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');

if(!fs.existsSync(source))fail(`Core source tree not found: ${source}`);
const appSource=fs.readFileSync(path.join(source,'app','app.js'),'utf8');
const coreVersion=appSource.match(/const APP_VERSION='([^']+)'/)?.[1];
if(!coreVersion)fail('APP_VERSION missing from source core');

const release=read('RELEASE.md');
const oldSha=release.match(/SHA-256:\s*`([a-f0-9]{64})`/)?.[1];
const oldVersion=release.match(/Version:\s*`([^`]+)`/)?.[1];
if(!oldSha||!oldVersion)fail('Current RELEASE.md version or SHA pin is missing');
const currentParts=fs.readdirSync(releaseDir).filter(name=>name.startsWith(partPrefix)).sort();
if(currentParts.length!==9)fail(`Expected 9 release parts before packing, found ${currentParts.length}`);
const currentEncoded=currentParts.map(name=>fs.readFileSync(path.join(releaseDir,name),'utf8')).join('').replace(/\s+/g,'');
const currentArchive=Buffer.from(currentEncoded,'base64');
if(hash(currentArchive)!==oldSha)fail('Current release parts do not match RELEASE.md before packing');

for(const [name,expected] of Object.entries(hubPins)){
  const file=path.join(repo,'enhancements',name);
  if(!fs.existsSync(file))fail(`Pinned hub segment is missing: ${name}`);
  const actual=run('git',['hash-object',file]);
  if(actual!==expected)fail(`Pinned hub segment changed: ${name} ${actual} != ${expected}`);
}

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pacefold-pack-'));
const archive=path.join(temp,`Pacefold_v${coreVersion}_Repository_Backup.zip`);
const epoch=new Date('2000-01-01T00:00:00Z');
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const absolute=path.join(dir,entry.name);if(entry.isDirectory())walk(absolute);else if(entry.isFile()){fs.utimesSync(absolute,epoch,epoch);files.push(path.relative(source,absolute).split(path.sep).join('/'));}}}
walk(source);
if(!files.length)fail('Core source tree is empty');
const zip=spawnSync('zip',['-X','-q',archive,'-@'],{cwd:source,input:`${files.join('\n')}\n`,encoding:'utf8'});
if(zip.status!==0)fail(`zip failed: ${zip.stderr||zip.stdout}`);
const bytes=fs.readFileSync(archive),newSha=hash(bytes);
let encoded=bytes.toString('base64');
const lines=encoded.match(/.{1,76}/g)||[];
if(lines.length<9)fail('Encoded archive is unexpectedly small');
const base=Math.floor(lines.length/9),remainder=lines.length%9;
let offset=0;
for(const name of currentParts)fs.rmSync(path.join(releaseDir,name));
for(let index=0;index<9;index+=1){const count=base+(index<remainder?1:0),chunk=lines.slice(offset,offset+count).join('\n')+'\n';offset+=count;fs.writeFileSync(path.join(releaseDir,`${partPrefix}${String(index).padStart(2,'0')}`),chunk);}
if(offset!==lines.length)fail('Release split did not consume the full archive');

function replaceCount(file,needle,replacement,expected){let value=read(file),count=value.split(needle).length-1;if(count!==expected)fail(`${file}: expected ${expected} SHA pin(s), found ${count}`);value=value.split(needle).join(replacement);write(file,value);}
replaceCount('.github/workflows/pages.yml',oldSha,newSha,2);
replaceCount('README.md',oldSha,newSha,1);
replaceCount('RELEASE.md',oldSha,newSha,1);

let rootReadme=read('README.md').replaceAll(oldVersion,coreVersion);write('README.md',rootReadme);
let nextRelease=read('RELEASE.md').replaceAll(oldVersion,coreVersion).replace(/Archive:\s*`[^`]+`/,`Archive: \`Pacefold_v${coreVersion}_Repository_Backup.zip\``);write('RELEASE.md',nextRelease);
let surface=read('enhancements/VERSION').trim();const match=surface.match(/^(\d+)\.(\d+)\.(\d+)$/);if(!match)fail(`Invalid enhancements/VERSION: ${surface}`);surface=`${match[1]}.${match[2]}.${Number(match[3])+1}`;write('enhancements/VERSION',`${surface}\n`);

const rebuilt=fs.readdirSync(releaseDir).filter(name=>name.startsWith(partPrefix)).sort().map(name=>fs.readFileSync(path.join(releaseDir,name),'utf8')).join('').replace(/\s+/g,'');
if(hash(Buffer.from(rebuilt,'base64'))!==newSha)fail('Written release parts failed the post-pack SHA check');
console.log(JSON.stringify({core:{from:oldVersion,to:coreVersion},surface,archiveBytes:bytes.length,sha256:newSha,parts:9,hubPins:'unchanged'},null,2));
