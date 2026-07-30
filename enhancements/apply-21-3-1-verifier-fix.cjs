'use strict';
const fs=require('node:fs');
const file='enhancements/inject.mjs';
let source=fs.readFileSync(file,'utf8');
const from="for(const token of [\"const EXPERIENCE='21.3.0'\",\"const REVISION='dayflow-r1'\",'pacefold.dayflow.v1','__PACEFOLD_DAYFLOW__','pf21-daybook','toggleFocus'])";
const to="for(const token of [\"const EXPERIENCE='21.3.1'\",\"const REVISION='dayflow-r2'\",'pacefold.dayflow.v1','__PACEFOLD_DAYFLOW__','pf21-daybook','toggleFocus'])";
if(!source.includes(to)){
  if(!source.includes(from))throw new Error('Stale Dayflow verifier anchor is missing');
  source=source.replace(from,to).replace('Pacefold 21.3 app marker is missing','Pacefold 21.3.1 app marker is missing');
  fs.writeFileSync(file,source);
}
fs.rmSync(__filename);
