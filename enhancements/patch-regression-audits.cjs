'use strict';

const fs=require('node:fs');
const path=require('node:path');

function replaceOnce(file,from,to,label){
  let source=fs.readFileSync(file,'utf8');
  if(source.includes(to))return false;
  const count=source.split(from).length-1;
  if(count!==1)throw new Error(`Expected one ${label} audit anchor in ${file}, found ${count}`);
  source=source.replace(from,to);
  fs.writeFileSync(file,source);
  return true;
}

const explicit=process.argv[2]&&/\.cjs$/i.test(process.argv[2]);
const v19=path.resolve(explicit?process.argv[2]:path.join(__dirname,'v19-audit.cjs'));
const v20=path.resolve(explicit&&process.argv[3]?process.argv[3]:path.join(__dirname,'v20-audit.cjs'));

const v19Changed=replaceOnce(
  v19,
  "    await page.waitForFunction(()=>Number(JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}').noodleStart)>0);",
  "    await page.waitForFunction(()=>{const prefs=JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}');return Number(prefs.noodleStart)>0&&document.querySelector('.pf-ritual-slot[data-source=\"noodle\"]')?.dataset.active==='true';});",
  'V19 timer-render synchronization'
);

const oldAttention=`    await page.evaluate(()=>{
      window.__PACEFOLD_BADGE_CALLS__.length=0;
      const pulse=document.querySelector('[data-pf-flow-pulse]');
      pulse.dataset.state='new';
      document.body.dataset.source='water';
      document.body.dataset.signal='due';
      document.querySelector('[data-pf-flow-cue-text]').textContent='Water is due';
      window.__PACEFOLD_MA_SCHEDULER__.updateBadge({source:'water',signal:'due'},{});
    });
    await page.waitForFunction(()=>document.getElementById('pf-v20-alert')?.dataset.active==='true'&&window.__PACEFOLD_BADGE_CALLS__.some(item=>item.kind==='set'));`;

const stableAttention=`    await page.evaluate(()=>{
      window.__PACEFOLD_BADGE_CALLS__.length=0;
      document.getElementById('pf-v20-audit-pulse')?.remove();
      document.getElementById('pf-v20-audit-cue')?.remove();
      const pulse=document.createElement('span');
      pulse.id='pf-v20-audit-pulse';
      pulse.dataset.pfFlowPulse='';
      pulse.dataset.state='new';
      const cue=document.createElement('span');
      cue.id='pf-v20-audit-cue';
      cue.dataset.pfFlowCueText='';
      cue.textContent='Water is due';
      document.body.prepend(pulse);
      document.body.prepend(cue);
      document.body.dataset.source='water';
      document.body.dataset.signal='due';
      window.__PACEFOLD_MA_SCHEDULER__.updateBadge({source:'water',signal:'due'},{});
      window.__PACEFOLD_V20__.reconcile();
    });
    await page.waitForFunction(()=>{
      const alert=document.getElementById('pf-v20-alert');
      const label=alert?.querySelector('strong')?.textContent;
      const favicon=document.querySelector('link[rel~="icon"]')?.href||'';
      return alert?.dataset.active==='true'&&label&&label!=='All clear'&&document.documentElement.dataset.v20Attention==='true'&&favicon.startsWith('data:image/png')&&window.__PACEFOLD_BADGE_CALLS__.some(item=>item.kind==='set');
    });`;

const v20Changed=replaceOnce(v20,oldAttention,stableAttention,'V20 stable attention fixture');
console.log(v19Changed||v20Changed?'Patched historical V19/V20 browser audits with stable UI synchronization fixtures.':'Historical V19/V20 browser audit fixtures are already patched.');
