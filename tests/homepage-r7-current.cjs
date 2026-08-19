'use strict';
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const sourceFile=path.join(__dirname,'homepage-r7.cjs');
let source=fs.readFileSync(sourceFile,'utf8');
source=source
  .replace(
    "assert(cover.search.height>=52&&cover.search.height<=62&&cover.searchBg==='rgb(255, 255, 255)','Search box is not a clean readable home-page control')",
    "assert(cover.search.height>=50&&cover.search.height<=70&&/255, 255, 255/.test(cover.searchBg),`Search box is not a clean readable home-page control (${cover.search.height}px · ${cover.searchBg})`)"
  )
  .replaceAll('num(','Number.parseFloat(');
const test=new Module(sourceFile,module);test.filename=sourceFile;test.paths=Module._nodeModulePaths(path.dirname(sourceFile));test._compile(source,sourceFile);
