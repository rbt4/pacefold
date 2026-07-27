'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {gunzipSync}=require('node:zlib');

const prefix='integrated-audit-runtime.cjs.gz.b64.part-';
const parts=fs.readdirSync(__dirname).filter(name=>name.startsWith(prefix)).sort();
if(!parts.length)throw new Error('Pacefold integrated audit runtime segments are missing');
const encoded=parts.map(name=>fs.readFileSync(path.join(__dirname,name),'utf8')).join('').replace(/\s+/g,'');
let source=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
const needle='workspaceAbovePlayer:wr.bottom<=pr.top+2';
if(!source.includes(needle))throw new Error('Pacefold geometry assertion could not be instrumented');
source=source.replace(needle,`${needle},workspaceBottom:wr.bottom,playerTop:pr.top,playerHeight:pr.height`);
const releaseRoot=path.resolve(process.argv[2]||'_release');
const artifactRoot=path.resolve(process.argv[3]||'/tmp/pacefold-integrated-artifacts');
fs.mkdirSync(artifactRoot,{recursive:true});
const runtime=path.join(releaseRoot,'app','pacefold-revamp.js');
if(fs.existsSync(runtime))fs.copyFileSync(runtime,path.join(artifactRoot,'generated-pacefold-revamp.js'));
module._compile(source,__filename);
