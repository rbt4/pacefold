'use strict';

const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');

const legacyFile=path.join(__dirname,'integrated-audit-legacy.cjs');
let source=fs.readFileSync(legacyFile,'utf8');

function replaceEntry(prefix,code,label){
  const marker=`  "${prefix}`;
  const start=source.indexOf(marker);
  if(start<0)throw new Error(`Pacefold V23 integrated audit ${label} anchor is missing`);
  if(source.indexOf(marker,start+marker.length)>=0)throw new Error(`Pacefold V23 integrated audit ${label} anchor is ambiguous`);
  const end=source.indexOf('\n',start);
  if(end<0)throw new Error(`Pacefold V23 integrated audit ${label} line is unterminated`);
  source=source.slice(0,start)+`  ${JSON.stringify(code)},`+source.slice(end);
}

replaceEntry(
  "    await product.waitForSelector('#noodleBtn')",
  `    await product.waitForFunction(()=>{const modern=document.getElementById('pf23-action-dock');if(modern){const style=getComputedStyle(modern),rect=modern.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0}const legacy=document.getElementById('noodleBtn');if(!legacy)return false;const style=getComputedStyle(legacy),rect=legacy.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;},null,{timeout:5000});await product.waitForSelector('#pf-local-workspace',{state:'attached'});`,
  'visible rhythm control'
);
replaceEntry(
  "    await product.waitForFunction(()=>{const line=document.getElementById('workline')",
  `    await product.waitForFunction(()=>{const dock=document.getElementById('pf23-action-dock');if(dock){const style=getComputedStyle(dock),rect=dock.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0}const line=document.getElementById('workline');return line&&Number.parseFloat(getComputedStyle(line).opacity)>=.5;},null,{timeout:5000});`,
  'rhythm surface readiness'
);
replaceEntry(
  "    const rhythmHome=await product.evaluate(()=>{const ids=['waterBtn'",
  `    const rhythmHome=await product.evaluate(()=>{const modern=Boolean(document.getElementById('pf23-action-dock')),ids=modern?['pf23-action-water','pf23-action-noodle','pf23-action-away','pf23-action-lunch','pf23-action-eyes','pf23-action-body']:['waterBtn','noodleBtn','awayBtn','lunchBtn','eyesBtn','careBtn'];const visible=id=>{const node=document.getElementById(id);if(!node)return false;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;};const line=document.getElementById('workline'),bench=document.getElementById('pf-v19-workbench'),workspace=document.getElementById('pf-local-workspace'),player=document.getElementById('pf-local-player'),root=document.getElementById('pf22-spatial-root');return {modern,mode:root?.dataset.mode||'',release:window.__PACEFOLD_EXPERIENCE__?.revision||'',dockVisible:visible('pf23-action-dock'),notebookOpen:Boolean(workspace?.classList.contains('is-open')),notebookVisible:Boolean(workspace&&!workspace.hidden),playerOpen:Boolean(player?.classList.contains('is-open')),playerHidden:Boolean(player?.hidden),benchPage:bench?.dataset.page,visible:ids.filter(visible),labels:ids.map(id=>document.getElementById(id)?.getAttribute('aria-label')||''),opacity:line?Number.parseFloat(getComputedStyle(line).opacity):0,timerText:modern?document.querySelector('#pf23-action-noodle strong')?.textContent||'':document.getElementById('noodleText')?.textContent||'',overflow:document.documentElement.scrollWidth>innerWidth+2};});`,
  'rhythm surface snapshot'
);
replaceEntry(
  '    assert(rhythmHome.notebookOpen',
  `    assert(rhythmHome.modern?rhythmHome.mode==='home'&&rhythmHome.release==='experience-r1'&&rhythmHome.dockVisible&&rhythmHome.visible.length===6&&!rhythmHome.overflow&&/30m|30-minute/i.test([rhythmHome.timerText,rhythmHome.labels[1]].join(' ')):rhythmHome.notebookOpen&&rhythmHome.notebookVisible&&!rhythmHome.playerOpen&&rhythmHome.playerHidden&&rhythmHome.benchPage==='notes'&&rhythmHome.visible.length===6&&rhythmHome.opacity>=.5&&!rhythmHome.overflow&&/30m|30-minute/i.test([rhythmHome.timerText,rhythmHome.labels[1]].join(' ')),'Persistent rhythm home failed: '+JSON.stringify(rhythmHome));`,
  'rhythm surface assertion'
);

const auditModule=new Module(legacyFile,module.parent);
auditModule.filename=legacyFile;
auditModule.paths=Module._nodeModulePaths(path.dirname(legacyFile));
auditModule._compile(source,legacyFile);
