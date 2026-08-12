'use strict';
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');

const sourceFile=path.join(__dirname,'browser-audit.cjs');
const version=JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'),'utf8')).version;
const source=fs.readFileSync(sourceFile,'utf8').replaceAll('27.0.0',version);
const audit=new Module(sourceFile,module);
audit.filename=sourceFile;
audit.paths=Module._nodeModulePaths(path.dirname(sourceFile));
audit._compile(source,sourceFile);
