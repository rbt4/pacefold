'use strict';
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const sourceFile=path.join(__dirname,'security-wow.cjs');
let source=fs.readFileSync(sourceFile,'utf8')
  .replaceAll('27.1.0 visual-finale-r6','27.1.0 homepage-r7')
  .replaceAll('WOW/security visual-finale build identity missing','WOW/security homepage build identity missing');
const test=new Module(sourceFile,module);test.filename=sourceFile;test.paths=Module._nodeModulePaths(path.dirname(sourceFile));test._compile(source,sourceFile);
