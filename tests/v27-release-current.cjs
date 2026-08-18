'use strict';
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');

const sourceFile=path.join(__dirname,'v27-release.cjs');
let source=fs.readFileSync(sourceFile,'utf8');
source=source
  .replace("assert(/Open Pacefold/i.test(surface.enter),'Start surface lost the explicit Pacefold entrance')","assert(/Open clock/i.test(surface.enter),'Start surface lost the explicit Clock entrance')")
  .replace("worker.includes(\"indexedDB.open('pacefold-v26'\")","worker.includes(\"const DB_NAME='pacefold-v26'\")");
const audit=new Module(sourceFile,module);
audit.filename=sourceFile;
audit.paths=Module._nodeModulePaths(path.dirname(sourceFile));
audit._compile(source,sourceFile);
