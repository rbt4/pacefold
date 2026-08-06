'use strict';

const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');

const legacyFile=path.join(__dirname,'ma-audit-legacy.cjs');
let source=fs.readFileSync(legacyFile,'utf8');
const from="    await page.goto(`${base}/app/`,{waitUntil:'networkidle'});";
const to="    await page.goto(`${base}/app/?legacyAudit=1`,{waitUntil:'networkidle'});";
const first=source.indexOf(from);
if(first<0)throw new Error('Pacefold Ma audit legacy route anchor is missing');
if(source.indexOf(from,first+from.length)>=0)throw new Error('Pacefold Ma audit legacy route anchor is ambiguous');
source=source.slice(0,first)+to+source.slice(first+from.length);

const auditModule=new Module(legacyFile,module.parent);
auditModule.filename=legacyFile;
auditModule.paths=Module._nodeModulePaths(path.dirname(legacyFile));
auditModule._compile(source,legacyFile);
