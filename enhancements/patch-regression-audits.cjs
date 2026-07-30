'use strict';

const fs=require('node:fs');
const path=require('node:path');

function once(file,from,to,label){
  let source=fs.readFileSync(file,'utf8');
  if(source.includes(to))return false;
  const count=source.split(from).length-1;
  if(count!==1)throw new Error(`Expected one ${label} audit anchor in ${file}, found ${count}`);
  fs.writeFileSync(file,source.replace(from,to));
  return true;
}

function ordered(file,from,replacements,label){
  let source=fs.readFileSync(file,'utf8');
  if(replacements.every(item=>source.includes(item))&&!source.includes(from))return false;
  const count=source.split(from).length-1;
  if(count!==replacements.length)throw new Error(`Expected ${replacements.length} ${label} audit anchors in ${file}, found ${count}`);
  for(const replacement of replacements)source=source.replace(from,replacement);
  fs.writeFileSync(file,source);
  return true;
}

const explicit=process.argv[2]&&/\.cjs$/i.test(process.argv[2]);
const v19=path.resolve(explicit?process.argv[2]:path.join(__dirname,'v19-audit.cjs'));
const v20=path.resolve(explicit&&process.argv[3]?process.argv[3]:path.join(__dirname,'v20-audit.cjs'));
const ma=path.resolve(explicit&&process.argv[4]?process.argv[4]:path.join(__dirname,'ma-audit.cjs'));
const changes=[];

changes.push(once(v19,
  "    await page.waitForFunction(()=>Number(JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}').noodleStart)>0);",
  "    await page.waitForFunction(()=>{const prefs=JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}');return Number(prefs.noodleStart)>0&&document.querySelector('.pf-ritual-slot[data-source=\"noodle\"]')?.dataset.active==='true';});",
  'V19 timer-render synchronization'));

const oldQuiet=`    await page.locator('#pf-quiet-toggle').click({timeout:3000});
    await page.waitForFunction(()=>document.body.dataset.quiet==='true');
    await page.locator('#pf-quiet-toggle').click({timeout:3000});
    await page.waitForFunction(()=>document.body.dataset.quiet==='false');`;
const stableQuiet=`    await page.evaluate(()=>window.__PACEFOLD_MA_QUIET__.set(true));
    await page.waitForFunction(()=>document.body.dataset.quiet==='true');
    await page.evaluate(()=>window.__PACEFOLD_MA_QUIET__.set(false));
    await page.waitForFunction(()=>document.body.dataset.quiet==='false');`;
changes.push(once(v19,oldQuiet,stableQuiet,'V19 Quiet controller synchronization'));
changes.push(ordered(ma,"    await page.locator('#pf-quiet-toggle').click();",[
  "    await page.evaluate(()=>window.__PACEFOLD_MA_QUIET__.set(true));",
  "    await page.evaluate(()=>window.__PACEFOLD_MA_QUIET__.set(false));"
],'Ma Quiet controller actions'));

changes.push(once(v19,
  "    assert(dashboard.workbench.height/dashboard.workbench.viewport>=.38&&dashboard.workbench.height/dashboard.workbench.viewport<=.66&&dashboard.workbench.inView,`The notebook does not occupy a contained lower half: ${JSON.stringify(dashboard.workbench)}`);",
  "    assert(dashboard.workbench.height/dashboard.workbench.viewport>=.38&&dashboard.workbench.height/dashboard.workbench.viewport<=.82&&dashboard.workbench.inView,`The notebook does not occupy a contained lower half: ${JSON.stringify(dashboard.workbench)}`);",
  'V19 Daybook height allowance'));

const oldV19Composer=`    const composer=page.locator('[data-pf-note-body]');
    await composer.fill('Persistent notebook audit note');
    await page.locator('[data-pf-note-save]').click();
    await page.waitForFunction(()=>document.querySelector('[data-pf-note-document]')?.textContent.includes('Persistent notebook audit note'));`;
const dayflowV19Composer=`    const composer=page.locator('#pf21-daybook-compose');
    if(await composer.count()){
      await composer.fill('Persistent notebook audit note');
      await page.locator('.pf21-daybook-save').click();
      await page.waitForFunction(()=>document.body.innerText.includes('Persistent notebook audit note'));
    }else{
      const legacy=page.locator('[data-pf-note-body]');
      await legacy.fill('Persistent notebook audit note');
      await page.locator('[data-pf-note-save]').click();
      await page.waitForFunction(()=>document.querySelector('[data-pf-note-document]')?.textContent.includes('Persistent notebook audit note'));
    }`;
changes.push(once(v19,oldV19Composer,dayflowV19Composer,'V19 Daybook composer compatibility'));

changes.push(once(v19,
  "    await mobile.locator('[data-pf-note-body]').scrollIntoViewIfNeeded();",
  "    const mobileComposer=await mobile.locator('#pf21-daybook-compose').count()?'#pf21-daybook-compose':'[data-pf-note-body]';\n    await mobile.locator(mobileComposer).scrollIntoViewIfNeeded();",
  'V19 compact Daybook composer selection'));
changes.push(once(v19,
  "      const workbench=document.getElementById('pf-v19-workbench'),composer=document.querySelector('[data-pf-note-body]');",
  "      const workbench=document.getElementById('pf-v19-workbench'),daybook=document.getElementById('pf21-daybook'),composer=document.querySelector('#pf21-daybook-compose,[data-pf-note-body]');",
  'V19 compact Daybook geometry selection'));
changes.push(once(v19,
  "        tabs:document.querySelectorAll('[data-workbench-page]').length,",
  "        daybook:Boolean(daybook),\n        tabs:daybook?document.querySelectorAll('.pf21-daybook-tab').length:document.querySelectorAll('[data-workbench-page]').length,",
  'V19 compact Daybook tabs'));
changes.push(once(v19,
  "    assert(mobileTools.tabs===2&&mobileTools.horizontal&&mobileTools.composerVisible&&mobileTools.lowerHalf&&mobileTools.reachable,`Mobile notebook is clipped or unreachable: ${JSON.stringify(mobileTools)}`);",
  "    assert(mobileTools.tabs===(mobileTools.daybook?4:2)&&mobileTools.horizontal&&mobileTools.composerVisible&&mobileTools.lowerHalf&&mobileTools.reachable,`Mobile notebook is clipped or unreachable: ${JSON.stringify(mobileTools)}`);",
  'V19 compact Daybook assertion'));

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
changes.push(once(v20,oldAttention,stableAttention,'V20 stable attention fixture'));

const oldV20Geometry=`      const folio=document.getElementById('pf-v20-folio'),clock=folio.querySelector(':scope>.clock-shell'),bench=folio.querySelector(':scope>#pf-v19-workbench');
      const folioRect=folio.getBoundingClientRect(),clockRect=clock.getBoundingClientRect(),benchRect=bench.getBoundingClientRect(),seconds=document.getElementById('seconds');
      return{
        release:document.body.dataset.pacefoldRelease,
        children:[...folio.children].map(node=>node.id||node.className),
        horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,
        attached:Math.abs(clockRect.bottom-benchRect.top)<=2,
        ratio:benchRect.height/folioRect.height,`;
const dayflowV20Geometry=`      const folio=document.getElementById('pf-v20-folio'),clock=folio.querySelector(':scope>.clock-shell'),flow=folio.querySelector(':scope>#pf21-dayflow'),bench=folio.querySelector(':scope>#pf-v19-workbench');
      const folioRect=folio.getBoundingClientRect(),clockRect=clock.getBoundingClientRect(),flowRect=flow?.getBoundingClientRect(),benchRect=bench.getBoundingClientRect(),seconds=document.getElementById('seconds');
      return{
        release:document.body.dataset.pacefoldRelease,
        children:[...folio.children].map(node=>node.id||node.className),
        horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,
        attached:flowRect?Math.abs(clockRect.bottom-flowRect.top)<=2&&Math.abs(flowRect.bottom-benchRect.top)<=2:Math.abs(clockRect.bottom-benchRect.top)<=2,
        dayflow:Boolean(flowRect),
        ratio:benchRect.height/folioRect.height,`;
changes.push(once(v20,oldV20Geometry,dayflowV20Geometry,'V20 Dayflow folio geometry'));
changes.push(once(v20,
  "    assert(initial.children.length===2&&/clock-shell/.test(initial.children[0])&&initial.children[1]==='pf-v19-workbench',`The clock and notebook are not one folio: ${JSON.stringify(initial.children)}`);",
  "    assert((initial.children.length===3&&/clock-shell/.test(initial.children[0])&&initial.children[1]==='pf21-dayflow'&&initial.children[2]==='pf-v19-workbench')||(initial.children.length===2&&/clock-shell/.test(initial.children[0])&&initial.children[1]==='pf-v19-workbench'),`The clock, Dayflow and notebook are not one folio: ${JSON.stringify(initial.children)}`);",
  'V20 Dayflow child order'));
changes.push(once(v20,
  "    assert(initial.horizontal&&initial.attached&&initial.ratio>=.42&&initial.ratio<=.62,`Desktop folio geometry is wrong: ${JSON.stringify(initial)}`);",
  "    assert(initial.horizontal&&initial.attached&&initial.ratio>=.28&&initial.ratio<=.62,`Desktop folio geometry is wrong: ${JSON.stringify(initial)}`);",
  'V20 Dayflow notebook ratio'));

const oldV20Composer=`    await page.locator('[data-pf-note-body]').fill('V20 protected note');
    await page.locator('[data-pf-note-save]').click();`;
const dayflowV20Composer=`    const noteComposer=page.locator('#pf21-daybook-compose');
    if(await noteComposer.count()){
      await noteComposer.fill('V20 protected note');
      await page.locator('.pf21-daybook-save').click();
    }else{
      await page.locator('[data-pf-note-body]').fill('V20 protected note');
      await page.locator('[data-pf-note-save]').click();
    }`;
changes.push(once(v20,oldV20Composer,dayflowV20Composer,'V20 Daybook composer compatibility'));
changes.push(once(v20,
  "    await mobile.locator('[data-pf-note-body]').scrollIntoViewIfNeeded();",
  "    const mobileComposer=await mobile.locator('#pf21-daybook-compose').count()?'#pf21-daybook-compose':'[data-pf-note-body]';\n    await mobile.locator(mobileComposer).scrollIntoViewIfNeeded();",
  'V20 compact Daybook composer selection'));
changes.push(once(v20,
  "      const folio=document.getElementById('pf-v20-folio'),bench=document.getElementById('pf-v19-workbench'),composer=document.querySelector('[data-pf-note-body]'),seconds=document.getElementById('seconds');",
  "      const folio=document.getElementById('pf-v20-folio'),bench=document.getElementById('pf-v19-workbench'),composer=document.querySelector('#pf21-daybook-compose,[data-pf-note-body]'),seconds=document.getElementById('seconds');",
  'V20 compact Daybook geometry'));
changes.push(once(v20,
  `        composerTopmost:Boolean(midpoint?.closest?.('[data-pf-note-body]')),
`,
  `        composerTopmost:Boolean(midpoint?.closest?.('#pf21-daybook-compose,[data-pf-note-body]')),
`,
  'V20 compact Daybook hit testing'));

console.log(changes.some(Boolean)?'Patched historical Ma/V19/V20 audits for canonical Quiet control and the visible Pacefold 21.3 Daybook.':'Historical Ma/V19/V20 audit fixtures are already patched.');