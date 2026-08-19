'use strict';
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const sourceFile=path.join(__dirname,'notifications-hardening.cjs');
let source=fs.readFileSync(sourceFile,'utf8')
  .replaceAll('27.1.0 visual-finale-r6','27.1.0 homepage-r7')
  .replaceAll('Notification-hardened visual-finale build identity missing','Notification-hardened homepage build identity missing')
  .replaceAll('inside visual finale r6','inside homepage r7');
const test=new Module(sourceFile,module);test.filename=sourceFile;test.paths=Module._nodeModulePaths(path.dirname(sourceFile));test._compile(source,sourceFile);
