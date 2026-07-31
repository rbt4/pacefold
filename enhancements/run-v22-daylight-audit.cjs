'use strict';

const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const sourceFile=path.join(__dirname,'v22-daylight-audit.cjs');
const temporary=path.join(os.tmpdir(),`pacefold-v22-daylight-audit-${process.pid}.cjs`);
let source=fs.readFileSync(sourceFile,'utf8');
const anchor='await page.waitForTimeout(500);';
if(!source.includes(anchor))throw new Error('The Day Unfold reconciliation wait anchor changed.');
source=source.replace(anchor,'await page.waitForTimeout(1100);');
fs.writeFileSync(temporary,source);
try{
  const result=spawnSync(process.execPath,[temporary,...process.argv.slice(2)],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  process.exitCode=result.status??1;
}finally{
  try{fs.unlinkSync(temporary)}catch{}
}
