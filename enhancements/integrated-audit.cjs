'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {gunzipSync}=require('node:zlib');

const prefix='integrated-audit-runtime.cjs.gz.b64.part-';
const parts=fs.readdirSync(__dirname).filter(name=>name.startsWith(prefix)).sort();
if(!parts.length)throw new Error('Pacefold integrated audit runtime segments are missing');
const encoded=parts.map(name=>fs.readFileSync(path.join(__dirname,name),'utf8')).join('').replace(/\s+/g,'');
let source=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
const geometry='workspaceAbovePlayer:wr.bottom<=pr.top+2';
if(!source.includes(geometry))throw new Error('Pacefold geometry assertion could not be instrumented');
source=source.replace(geometry,`${geometry},workspaceBottom:wr.bottom,playerTop:pr.top,playerHeight:pr.height`);
const broadTrack="page.getByText('focus-track').isVisible()";
if(!source.includes(broadTrack))throw new Error('Pacefold local-player assertion could not be scoped');
source=source.replace(broadTrack,"page.locator('[data-pf-player-drawer]:visible').getByText('focus-track',{exact:true}).last().isVisible()");
module._compile(source,__filename);
