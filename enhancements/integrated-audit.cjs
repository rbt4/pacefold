'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {gunzipSync}=require('node:zlib');

const prefix='integrated-audit-runtime.cjs.gz.b64.part-';
const parts=fs.readdirSync(__dirname).filter(name=>name.startsWith(prefix)).sort();
if(!parts.length)throw new Error('Pacefold integrated audit runtime segments are missing');
const encoded=parts.map(name=>fs.readFileSync(path.join(__dirname,name),'utf8')).join('').replace(/\s+/g,'');
let source=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
const geometry=/workspaceAbovePlayer\s*:\s*([^,\n}]+)/;
if(!geometry.test(source))throw new Error('Pacefold geometry assertion could not be instrumented');
source=source.replace(geometry,(match)=>`${match},workspaceBottom:workspaceRect?.bottom,workspaceTop:workspaceRect?.top,workspaceHeight:workspaceRect?.height,playerTop:playerRect?.top,playerHeight:playerRect?.height,workspaceBottomStyle:getComputedStyle(workspace).bottom,workspacePosition:getComputedStyle(workspace).position,playerPosition:getComputedStyle(player).position`);
module._compile(source,__filename);
