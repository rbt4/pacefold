'use strict';
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');

const sourceFile=path.join(__dirname,'v27-release.cjs');
let source=fs.readFileSync(sourceFile,'utf8');
source=source
  .replace("assert(surface.clockPx>=180,`Hero clock is not giant enough (${surface.clockPx}px)`)","assert(surface.clockPx>=72&&surface.clockPx<=106,`Homepage clock scale is unreadable (${surface.clockPx}px)`)")
  .replace("assert(/Open Pacefold/i.test(surface.enter),'Start surface lost the explicit Pacefold entrance')","assert(/Open clock/i.test(surface.enter),'Start surface lost the explicit Clock entrance')")
  .replace("backup.revision==='final-form-r1'","backup.revision==='homepage-r7'")
  .replace("worker.includes(\"indexedDB.open('pacefold-v26'\")","worker.includes(\"const DB_NAME='pacefold-v26'\")");
const audit=new Module(sourceFile,module);
audit.filename=sourceFile;
audit.paths=Module._nodeModulePaths(path.dirname(sourceFile));
audit._compile(source,sourceFile);
