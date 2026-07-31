'use strict';

const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const sourceFile=path.join(__dirname,'v21-audit.cjs');
const temporary=path.join(os.tmpdir(),`pacefold-v22-base-audit-${process.pid}.cjs`);
const source=fs.readFileSync(sourceFile,'utf8');
if(!source.includes("const RELEASE='22.0.1'"))throw new Error('The base Spatial audit release anchor changed.');
const patched=source.replaceAll('22.0.1','22.0.2');
fs.writeFileSync(temporary,patched);
try{
  const result=spawnSync(process.execPath,[temporary,...process.argv.slice(2)],{
    stdio:'inherit',
    env:process.env
  });
  if(result.error)throw result.error;
  process.exitCode=result.status??1;
}finally{
  try{fs.unlinkSync(temporary)}catch{}
}
