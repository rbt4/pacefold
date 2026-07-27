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
source=source.replace(needle,`${needle},workspaceTop:wr.top,workspaceBottom:wr.bottom,workspaceHeight:wr.height,playerTop:pr.top,playerBottomEdge:pr.bottom,playerHeight:pr.height,workspaceBottomStyle:getComputedStyle(workspace).bottom,workspacePosition:getComputedStyle(workspace).position,playerPosition:getComputedStyle(player).position`);
const artifactRoot=path.resolve(process.argv[3]||'/tmp/pacefold-integrated-artifacts');
fs.mkdirSync(artifactRoot,{recursive:true});
fs.writeFileSync(path.join(artifactRoot,'decoded-integrated-audit.cjs'),source);
const generatedCss=path.join(path.resolve(process.argv[2]||'_release'),'app','pacefold-revamp.css');
if(fs.existsSync(generatedCss))fs.copyFileSync(generatedCss,path.join(artifactRoot,'generated-pacefold-revamp.css'));
module._compile(source,__filename);
