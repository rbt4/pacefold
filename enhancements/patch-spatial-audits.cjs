'use strict';
const fs=require('node:fs');
const path=require('node:path');
const targets=['hub-audit.cjs','run-hub-audit.cjs','resilience-audit.cjs','integrated-audit.cjs','ma-audit.cjs','v19-audit.cjs','v20-audit.cjs'];
let changed=0;
for(const name of targets){
  const file=path.join(__dirname,name);if(!fs.existsSync(file))continue;
  const source=fs.readFileSync(file,'utf8');
  if(source.includes('legacyAudit=1'))continue;
  const next=source.replace(/\$\{base\}\/app\/(?!\?legacyAudit=1)/g,'${base}/app/?legacyAudit=1');
  if(next!==source){fs.writeFileSync(file,next);changed++;}
}
console.log(changed?`Prepared ${changed} historical audits for the legacy surface beneath Pacefold Spatial Fold.`:'Historical audits already use the legacy surface.');
