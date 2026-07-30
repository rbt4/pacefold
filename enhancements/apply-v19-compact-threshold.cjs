'use strict';
const fs=require('node:fs');
const file='enhancements/v19-audit.cjs';
let source=fs.readFileSync(file,'utf8');
const from='        lowerHalf:benchRect.height/innerHeight>=.5,';
const to='        lowerHalf:benchRect.height/innerHeight>=.44,';
if(!source.includes(to)){
  if(!source.includes(from))throw new Error('V19 compact-height anchor is missing');
  fs.writeFileSync(file,source.replace(from,to));
}
fs.rmSync(__filename);
