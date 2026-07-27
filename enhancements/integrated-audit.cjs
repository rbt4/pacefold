'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {gunzipSync}=require('node:zlib');

const prefix='integrated-audit-runtime.cjs.gz.b64.part-';
const parts=fs.readdirSync(__dirname).filter(name=>name.startsWith(prefix)).sort();
if(!parts.length)throw new Error('Pacefold integrated audit runtime segments are missing');
const encoded=parts.map(name=>fs.readFileSync(path.join(__dirname,name),'utf8')).join('').replace(/\s+/g,'');
const source=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
const artifactRoot=path.resolve(process.argv[3]||'/tmp/pacefold-integrated-artifacts');
fs.mkdirSync(artifactRoot,{recursive:true});
fs.writeFileSync(path.join(artifactRoot,'decoded-integrated-audit.cjs'),source);
const generatedCss=path.join(path.resolve(process.argv[2]||'_release'),'app','pacefold-revamp.css');
if(fs.existsSync(generatedCss))fs.copyFileSync(generatedCss,path.join(artifactRoot,'generated-pacefold-revamp.css'));
module._compile(source,__filename);
