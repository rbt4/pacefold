import fs from 'node:fs';
import path from 'node:path';
import {rewriteInnerHTMLAssignments} from './trusted-types-transform.mjs';

const root=path.resolve(process.argv[2]||'_agent_core');
const fromVersion=process.argv[3]||'15.2.1';
const toVersion=process.argv[4]||'15.2.2';
const p=(...parts)=>path.join(root,...parts);
const read=file=>fs.readFileSync(p(file),'utf8');
const write=(file,value)=>fs.writeFileSync(p(file),value);
const fail=message=>{throw new Error(message);};

function replaceExact(source,needle,replacement,label,expected=1){
  const count=source.split(needle).length-1;
  if(count!==expected)fail(`${label}: expected ${expected} exact match(es), found ${count}`);
  return source.split(needle).join(replacement);
}
function replacePattern(source,pattern,replacement,label,expected=1){
  const flags=pattern.flags.includes('g')?pattern.flags:`${pattern.flags}g`;
  const global=new RegExp(pattern.source,flags);
  const matches=[...source.matchAll(global)];
  if(matches.length!==expected)fail(`${label}: expected ${expected} pattern match(es), found ${matches.length}`);
  return source.replace(global,replacement);
}

function skipQuoted(source,index,quote){
  let i=index+1;
  while(i<source.length){
    if(source[i]==='\\'){i+=2;continue;}
    if(source[i]===quote)return i+1;
    i+=1;
  }
  fail(`Unterminated ${quote} string while hardening innerHTML`);
}
function skipRegex(source,index){
  let i=index+1,inClass=false;
  while(i<source.length){
    const ch=source[i];
    if(ch==='\\'){i+=2;continue;}
    if(ch==='[')inClass=true;
    else if(ch===']')inClass=false;
    else if(ch==='/'&&!inClass){i+=1;while(/[a-z]/i.test(source[i]||''))i+=1;return i;}
    i+=1;
  }
  fail('Unterminated regular expression while hardening innerHTML');
}
function regexCanStart(previous){return !previous||/[({[=,:;!?&|+\-*%^~<>]/.test(previous);}
function findExpressionEnd(source,start){
  const stack=[];
  let i=start,previous='';
  while(i<source.length){
    const ch=source[i];
    if(ch==="'"||ch==='"'){i=skipQuoted(source,i,ch);previous='v';continue;}
    if(ch==='`'){
      stack.push({kind:'template',depth:0});i+=1;
      while(i<source.length&&stack.at(-1)?.kind==='template'){
        const t=source[i];
        if(t==='\\'){i+=2;continue;}
        if(t==='`'){stack.pop();i+=1;break;}
        if(t==='$'&&source[i+1]==='{'){stack.push({kind:'template-expression',depth:1});i+=2;break;}
        i+=1;
      }
      previous='v';continue;
    }
    if(stack.at(-1)?.kind==='template-expression'){
      if(ch==="'"||ch==='"'){i=skipQuoted(source,i,ch);continue;}
      if(ch==='`'){stack.push({kind:'template',depth:0});continue;}
      if(ch==='{'){stack.at(-1).depth+=1;i+=1;continue;}
      if(ch==='}'){stack.at(-1).depth-=1;i+=1;if(stack.at(-1)?.depth===0){stack.pop();}continue;}
      if(ch==='/'&&regexCanStart(previous)){i=skipRegex(source,i);previous='v';continue;}
      previous=/\s/.test(ch)?previous:ch;i+=1;continue;
    }
    if(ch==='/'&&regexCanStart(previous)){i=skipRegex(source,i);previous='v';continue;}
    if(ch==='('||ch==='['||ch==='{')stack.push({kind:'group',close:ch==='('?')':ch==='['?']':'}'});
    else if(ch===')'||ch===']'||ch==='}'){
      const top=stack.at(-1);if(!top||top.kind!=='group'||top.close!==ch)fail(`Unbalanced ${ch} while hardening innerHTML`);stack.pop();
    }else if(ch===';'&&stack.length===0)return i;
    previous=/\s/.test(ch)?previous:ch;i+=1;
  }
  fail('Could not find the end of an innerHTML assignment');
}
function findLhsStart(source,dotIndex){
  let paren=0,bracket=0;
  for(let i=dotIndex-1;i>=0;i-=1){
    const ch=source[i];
    if(ch===')')paren+=1;else if(ch==='(')paren-=1;
    else if(ch===']')bracket+=1;else if(ch==='[')bracket-=1;
    if(paren<0||bracket<0)fail('Unbalanced left-hand expression while hardening innerHTML');
    if(paren===0&&bracket===0&&(ch===';'||ch==='\n'||ch==='{'||ch==='}'))return i+1;
  }
  return 0;
}
function hardenInnerHTML(source){
  let cursor=0,count=0;
  while(true){
    const dot=source.indexOf('.innerHTML=',cursor);if(dot===-1)break;
    const lhsStart=findLhsStart(source,dot),lhs=source.slice(lhsStart,dot).trim();
    if(!lhs||/\b(?:if|for|while|return)\b/.test(lhs))fail(`Unsafe innerHTML left-hand expression: ${lhs}`);
    const rhsStart=dot+'.innerHTML='.length,end=findExpressionEnd(source,rhsStart),rhs=source.slice(rhsStart,end).trim();
    const leading=source.slice(lhsStart,dot).match(/^\s*/)?.[0]||'';
    const replacement=`${leading}setHTML(${lhs},${rhs})`;
    source=source.slice(0,lhsStart)+replacement+source.slice(end);
    cursor=lhsStart+replacement.length+1;count+=1;
  }
  if(count<10)fail(`Expected at least 10 innerHTML assignments, hardened ${count}`);
  if(source.includes('.innerHTML='))fail('An innerHTML assignment survived hardening');
  return{source,count};
}

let app=read('app/app.js');
app=replaceExact(app,`const APP_VERSION='${fromVersion}';`,`const APP_VERSION='${toVersion}';`,'app version');
app=replaceExact(app,
  "  const CAPTURE_KINDS=['inbox','follow-up','incident','inspection','jhsc','construction','notification','meeting','resource'];",
  "  const CAPTURE_KINDS=['inbox','follow-up','incident','inspection','jhsc','construction','notification','meeting','resource'];\n  const DEBUG_BUILD=false;\n  const TT=window.trustedTypes?window.trustedTypes.createPolicy('pacefold',{createHTML:value=>String(value)}):{createHTML:value=>String(value)};\n  const setHTML=(node,value)=>{if(!node)return node;Reflect.set(node,'innerHTML',TT.createHTML(String(value)));return node;};\n  window.__PACEFOLD_TRUSTED_HTML__=value=>TT.createHTML(String(value));\n  window.__PACEFOLD_SET_HTML__=setHTML;",
  'trusted types policy');
app=replaceExact(app,
  "    lead:10,dueWindow:18,snoozeMinutes:10,method:'15',asr:'hanafi',browserNotif:false,notificationDetail:'generic',notificationMode:'quiet',notified:{},notificationActionHistory:[],",
  "    lead:10,dueWindow:18,staleAfterMinutes:20,snoozeMinutes:10,method:'15',asr:'hanafi',browserNotif:false,notificationDetail:'generic',notificationMode:'quiet',notified:{},notificationActionHistory:[],",
  'stale default');
app=replaceExact(app,
  "    lat:43.62,lng:-79.51,locationLabel:'Toronto',",
  "    lat:43.62,lng:-79.51,locationLabel:'Toronto',lastSeenAt:0,",
  'last seen default');
app=replaceExact(app,
  "  const diagnostics=[];\n  let storageState='Local';\n  function reportError(error,context='runtime'){\n    try{diagnostics.push({at:new Date().toISOString(),context,message:String(error&&error.message||error)});if(diagnostics.length>12)diagnostics.shift();console.error('[Pacefold]',context,error);}catch(_){ }\n  }",
  "  const diagnostics=[];\n  let storageState='Local';\n  const diagnosticText=value=>String(value&&value.message||value||'Unknown').replace(/https?:\\/\\/\\S+/gi,'[url]').replace(/\\b[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}\\b/gi,'[email]').slice(0,240);\n  function recordDiagnostic(context,message){\n    try{const cleanContext=String(context||'runtime').slice(0,64),cleanMessage=diagnosticText(message),key=`${cleanContext}|${cleanMessage}`,now=new Date().toISOString(),existing=diagnostics.find(item=>item.key===key);if(existing){existing.count+=1;existing.lastAt=now;return existing;}const item={key,at:now,lastAt:now,count:1,context:cleanContext,message:cleanMessage};diagnostics.push(item);if(diagnostics.length>24)diagnostics.shift();return item;}catch(_){return null;}\n  }\n  function reportError(error,context='runtime'){recordDiagnostic(context,error);try{console.error('[Pacefold]',context,error);}catch(_){ }}",
  'diagnostic deduplication');
app=replaceExact(app,
  "  const storageGet=key=>{try{return localStorage.getItem(key);}catch(error){if(error&&error.name!=='SecurityError')reportError(error,'storage-read');return null;}};",
  "  const storageGet=key=>{try{return localStorage.getItem(key);}catch(error){storageState='Unavailable';reportError(error,'storage-read');return null;}};",
  'storage read state');
app=replaceExact(app,
  "    p.lead=clamp(p.lead,0,30,10);p.dueWindow=clamp(p.dueWindow,5,60,18);p.snoozeMinutes=clamp(p.snoozeMinutes,5,30,10);",
  "    p.lead=clamp(p.lead,0,30,10);p.dueWindow=clamp(p.dueWindow,5,60,18);p.staleAfterMinutes=clamp(p.staleAfterMinutes,5,120,20);p.snoozeMinutes=clamp(p.snoozeMinutes,5,30,10);",
  'stale normalization');
app=replaceExact(app,
  "    p.lat=clamp(p.lat,-90,90,DEFAULTS.lat);p.lng=clamp(p.lng,-180,180,DEFAULTS.lng);p.locationLabel=(typeof p.locationLabel==='string'&&p.locationLabel)?p.locationLabel.slice(0,24):DEFAULTS.locationLabel;",
  "    p.lat=clamp(p.lat,-90,90,DEFAULTS.lat);p.lng=clamp(p.lng,-180,180,DEFAULTS.lng);p.locationLabel=(typeof p.locationLabel==='string'&&p.locationLabel)?p.locationLabel.slice(0,24):DEFAULTS.locationLabel;p.lastSeenAt=clamp(p.lastSeenAt,0,Number.MAX_SAFE_INTEGER,0);",
  'last seen normalization');
app=replacePattern(app,/  function save\(\)\{[\s\S]*?\n  \}\n  ensureWorkday\(new Date\(\)\);save\(\);/,
`  function save(){
    try{
      const cutoff=Date.now()-4*864e5,cleanAck={},cleanSnooze={},cleanNotified={};
      Object.entries(prefs.acknowledged||{}).forEach(([k,v])=>{if(Number(v)>cutoff)cleanAck[k]=Number(v);});
      Object.entries(prefs.snoozed||{}).forEach(([k,v])=>{if(Number(v)>cutoff)cleanSnooze[k]=Number(v);});
      Object.entries(prefs.notified||{}).forEach(([k,v])=>{if(Number(v)>cutoff)cleanNotified[k]=Number(v);});
      prefs.acknowledged=cleanAck;prefs.snoozed=cleanSnooze;prefs.notified=cleanNotified;
      localStorage.setItem(STORAGE_KEY,JSON.stringify(prefs));storageState='Local';return true;
    }catch(error){storageState='Unavailable';reportError(error,'storage-write');return false;}
  }
  ensureWorkday(new Date());save();`,
  'save hardening');
app=replaceExact(app,
  "  let continuingSession=false;\n  try{continuingSession=sessionStorage.getItem('pacefoldSessionV14')==='active';sessionStorage.setItem('pacefoldSessionV14','active');}catch(_){ }\n  if(!continuingSession){const opened=new Date(),openedH=opened.getHours()+opened.getMinutes()/60+opened.getSeconds()/3600;scheduleForDate(opened).forEach(item=>{if(item.time<=openedH-prefs.dueWindow/60)prefs.acknowledged[eventKey(opened,item.id)]=Date.now();});save();}",
  "  try{sessionStorage.setItem('pacefoldSessionV14','active');}catch(_){ }",
  'fresh-session auto acknowledgement');
app=replaceExact(app,
  "  const sent=new Set();",
  [
    "  const sent=new Set();",
    "  let lastObservedAt=Date.now(),lastSeenSavedAt=0;",
    "  function observeClock(now=Date.now()){",
    "    const delta=now-lastObservedAt,discontinuity=delta<-60000||delta>30*60*60*1000;",
    "    if(discontinuity){prefs.acknowledged={};prefs.snoozed={};prefs.notified={};sent.clear();const wall=new Date(now);times=computeTimes(wall);calculatedDay=dayKey(wall);recordDiagnostic('clock-jump',`wall clock changed ${Math.round(delta/60000)}m`);}",
    "    lastObservedAt=now;prefs.lastSeenAt=now;",
    "    if(discontinuity||now-lastSeenSavedAt>=60000){lastSeenSavedAt=now;save();}",
    "    return discontinuity;",
    "  }"
  ].join('\n'),
  'clock discontinuity observer');
app=replaceExact(app,
  "  function notifyOnce(key,text,source='prayer'){void showSystemNotification(key,text,source,false);}",
  [
    "  function notifyOnce(key,text,source='prayer'){void showSystemNotification(key,text,source,false);}",
    "  function markMissedCue(key,source,elapsedMinutes){",
    "    if(!key||sent.has(key)||prefs.notified[key])return false;sent.add(key);prefs.notified[key]=Date.now();save();recordDiagnostic('cue-missed',`${source} ${Math.max(0,Math.round(elapsedMinutes))}m overdue`);return true;",
    "  }"
  ].join('\n'),
  'missed cue recorder');
app=replaceExact(app,
  "    else if(prayer.signal==='pending'){$('statusWord').textContent='Next';$('eventTime').textContent=fmt(b.next[1]);$('relativeTime').textContent=duration(nextMins);$('eventName').textContent=`${nameOf(prayer.event)} pending`;}",
  "    else if(prayer.signal==='pending'){const stale=prayer.elapsed>prefs.staleAfterMinutes;$('statusWord').textContent=stale?'Overdue':'Now';$('eventTime').textContent=fmt(b.prev[1]);$('relativeTime').textContent=stale?`${duration(prayer.elapsed)} ago`:`${Math.floor(prayer.elapsed)}m`;$('eventName').textContent=nameOf(prayer.event);if(stale)markMissedCue(prayer.key,'prayer',prayer.elapsed);else notifyOnce(prayer.key,prefs.notificationDetail==='named'?`${nameOf(prayer.event)} reminder`:'Rhythm reminder');}",
  'overdue status');
app=replaceExact(app,
  "  function oneNoteStatus(){\n    const queued=pendingCaptures().length;",
  "  function oneNoteStatus(){\n    if(storageState!=='Local')return{text:'Not saving',tone:'blocked'};\n    const queued=pendingCaptures().length;",
  'storage sync status');
app=replaceExact(app,
  "    $('syncBtn').className=`quiet-tool sync-tool ${status.tone}`;$('syncText').textContent=status.text;$('quietDock').classList.toggle('attention',body.due||status.tone==='queued');",
  "    $('syncBtn').className=`quiet-tool sync-tool ${status.tone}`;$('syncText').textContent=status.text;$('quietDock').classList.toggle('attention',body.due||status.tone==='queued'||status.tone==='blocked');",
  'storage dock attention');
app=replaceExact(app,
  "    $('foldKicker').textContent='Kiroku';$('foldTitle').textContent='Capture without leaving the day';const status=oneNoteStatus(),recent=[...prefs.captures].filter(item=>item.day===dayKey(new Date())).slice(-6).reverse();",
  "    $('foldKicker').textContent='Kiroku';$('foldTitle').textContent='Capture without leaving the day';const status=oneNoteStatus(),recent=[...prefs.captures].filter(item=>item.day===dayKey(new Date())).slice(-6).reverse(),storageWarning=storageState==='Local'?'':`<p class=\"storage-warning\" role=\"alert\">Pacefold can't save to this browser. Notes will be lost when you close this window.</p>`;",
  'capture storage warning');
app=replaceExact(app,
  "$('foldBody').innerHTML=`<form class=\"capture-form\" id=\"captureForm\">",
  "$('foldBody').innerHTML=`${storageWarning}<form class=\"capture-form\" id=\"captureForm\">",
  'capture warning placement');
app=replaceExact(app,'<i style="--care-progress:${progress.toFixed(1)}%"></i>','<i></i>','care inline style');
app=replaceExact(app,
  "  }\n  function renderSoundFold(){",
  "    $('foldBody').querySelector('.care-progress i')?.style.setProperty('--care-progress',`${progress.toFixed(1)}%`);\n  }\n  function renderSoundFold(){",
  'care CSSOM progress');
app=replaceExact(app,
  "    $('waterMeter').innerHTML=Array.from({length:segments},(_,i)=>{const fill=Math.min(1,Math.max(0,scaled-i)),next=!water.complete&&i===Math.min(segments-1,Math.floor(scaled));return `<span class=\"water-seg${next?' next':''}\" style=\"--fill:${fill.toFixed(3)}\"></span>`;}).join('');",
  "    const waterSegments=Array.from({length:segments},(_,i)=>({fill:Math.min(1,Math.max(0,scaled-i)),next:!water.complete&&i===Math.min(segments-1,Math.floor(scaled))}));setHTML($('waterMeter'),waterSegments.map(item=>`<span class=\"water-seg${item.next?' next':''}\"></span>`).join(''));[...$('waterMeter').children].forEach((node,index)=>node.style.setProperty('--fill',waterSegments[index].fill.toFixed(3)));",
  'water CSSOM fill');
app=replacePattern(app,/  function saveCapture\(\)\{[\s\S]*?\n  \}/,
  [
    "  function saveCapture(){",
    "    const textValue=captureDraft.trim();if(!textValue){toast('Write something first');return false;}const createdAt=Date.now(),item={id:`${createdAt.toString(36)}-${Math.random().toString(36).slice(2,8)}`,text:textValue.slice(0,1200),kind:CAPTURE_KINDS.includes(captureDraftKind)?captureDraftKind:'inbox',createdAt,day:dayKey(new Date(createdAt)),syncedAt:0,syncError:''};",
    "    prefs.captureKind=item.kind;prefs.captures=[...prefs.captures,item].slice(-300);const saved=save();if(saved){captureDraft='';try{localStorage.removeItem(CAPTURE_DRAFT_KEY);}catch(_){ }renderFold();toast(prefs.oneNoteSectionId?'Captured locally · OneNote queued':'Captured locally');void syncCaptureQueue(false);}else{toast('Held in this window · not saving');renderFold();}renderQuietDock();return saved;",
    "  }"
  ].join('\n'),
  'capture save result');
app=replaceExact(app,
  "oneNoteClientStamp=stamp;oneNoteClient=new window.msal.PublicClientApplication({auth:{clientId:prefs.oneNoteClientId,authority:`https://login.microsoftonline.com/${prefs.oneNoteTenant||'organizations'}`,redirectUri:new URL('./auth.html',location.href).href},cache:{cacheLocation:'localStorage',storeAuthStateInCookie:false}});",
  "oneNoteClientStamp=stamp;oneNoteClient=new window.msal.PublicClientApplication({auth:{clientId:prefs.oneNoteClientId,authority:`https://login.microsoftonline.com/${prefs.oneNoteTenant||'organizations'}`,redirectUri:new URL('./auth.html',location.href).href},cache:{cacheLocation:'sessionStorage',storeAuthStateInCookie:false}});",
  'MSAL session cache');
app=replaceExact(app,
  "  function scheduleReload(){if(refreshing)return;refreshing=true;serviceWorkerState='Updated';setTimeout(()=>location.reload(),650);}",
  [
    "  function scheduleReload(version='unknown'){if(refreshing)return;const key=`pacefoldUpdateReload:${version}`;try{if(sessionStorage.getItem(key)==='1'){serviceWorkerState='Update ready · reopen Pacefold';return;}sessionStorage.setItem(key,'1');}catch(_){ }refreshing=true;serviceWorkerState='Updated';setTimeout(()=>location.reload(),650);}",
    "  async function controlledWorkerVersion(timeout=2200){",
    "    const controller=navigator.serviceWorker?.controller;if(!controller)return'';return new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>resolve(''),timeout);channel.port1.onmessage=event=>{clearTimeout(timer);resolve(String(event.data?.version||''));};try{controller.postMessage({type:'PACEFOLD_VERSION'},[channel.port2]);}catch(_){clearTimeout(timer);resolve('');}});",
    "  }",
    "  async function handleControllerChange(){",
    "    const version=await controlledWorkerVersion();if(!version){serviceWorkerState='Update ready · reopen Pacefold';return;}",
    "    if(version===APP_VERSION){controllerSeenAtLoad=true;serviceWorkerState=`Automatic · v${APP_VERSION}`;try{sessionStorage.removeItem(`pacefoldUpdateReload:${version}`);}catch(_){ }renderSetupDock();return;}",
    "    updateAvailable=true;if(hasUnsavedWork()){pendingUpdateReload=true;serviceWorkerState='Update ready · reopen Pacefold';toast('Update held until setup or capture is closed');return;}scheduleReload(version);",
    "  }"
  ].join('\n'),
  'worker version handshake');
app=replaceExact(app,
  "      navigator.serviceWorker.addEventListener('controllerchange',()=>{\n        if(!controllerSeenAtLoad){controllerSeenAtLoad=true;serviceWorkerState=`Automatic · v${APP_VERSION}`;renderSetupDock();return;}\n        if(hasUnsavedWork()){pendingUpdateReload=true;serviceWorkerState='Update ready · waiting';toast('Update held until setup or capture is closed');return;}scheduleReload();\n      });",
  "      navigator.serviceWorker.addEventListener('controllerchange',()=>{void handleControllerChange();});",
  'controller change handler');
app=replaceExact(app,
  "  function applyPendingReload(){if(pendingUpdateReload&&!hasUnsavedWork()){pendingUpdateReload=false;scheduleReload();}}",
  "  function applyPendingReload(){if(pendingUpdateReload&&!hasUnsavedWork()){pendingUpdateReload=false;void controlledWorkerVersion().then(version=>scheduleReload(version||'unknown'));}}",
  'deferred version reload');
app=replaceExact(app,
  "      if(workerRegistration.waiting){updateAvailable=true;serviceWorkerState='Applying update';workerRegistration.waiting.postMessage({type:'SKIP_WAITING'});}",
  "      if(workerRegistration.waiting){updateAvailable=true;serviceWorkerState=hasUnsavedWork()?'Update ready · reopen Pacefold':'Applying update';workerRegistration.waiting.postMessage({type:'SKIP_WAITING'});}",
  'waiting worker state');
app=replaceExact(app,
  "  const launchParams=new URLSearchParams(location.search),setupRequested=launchParams.get('setup')==='1',captureRequested=launchParams.get('capture')==='1',careRequested=launchParams.get('care')==='1',soundRequested=launchParams.get('sound')==='1',actionRequested=launchParams.get('action')||'';",
  "  const launchParams=new URLSearchParams(location.search),debugEnabled=DEBUG_BUILD&&launchParams.get('debug')==='1',setupRequested=launchParams.get('setup')==='1',captureRequested=launchParams.get('capture')==='1',careRequested=launchParams.get('care')==='1',soundRequested=launchParams.get('sound')==='1',actionRequested=launchParams.get('action')||'';",
  'debug gate');
app=replaceExact(app,
  "  const preview=new URLSearchParams(location.search).get('preview');",
  "  const preview=debugEnabled?launchParams.get('preview'):'';",
  'preview gate');
app=replaceExact(app,
  "  function scheduleTick(){render();const delay=Math.max(120,1015-(Date.now()%1000));setTimeout(scheduleTick,delay);}",
  "  function scheduleTick(){observeClock(Date.now());render();const delay=Math.max(120,1015-(Date.now()%1000));setTimeout(scheduleTick,delay);}",
  'clock observer tick');
app=replaceExact(app,
  "  window.pacefoldPreview=mode=>{testPrayer=mode==='prayer'?'due':'none';testRoutine=['water','noodle','away','lunch','showcase'].includes(mode)?mode:'none';if(mode==='showcase')document.body.classList.add('reveal');render();};\n  window.pacefoldNotificationPreview=(source,specOnly=false)=>showSystemNotification(`preview-${source}-${Date.now()}`,notificationActionLabel(source),source,true,specOnly);",
  [
    "  if(debugEnabled){",
    "    window.pacefoldPreview=mode=>{testPrayer=mode==='prayer'?'due':'none';testRoutine=['water','noodle','away','lunch','showcase'].includes(mode)?mode:'none';if(mode==='showcase')document.body.classList.add('reveal');render();};",
    "    window.pacefoldNotificationPreview=(source,specOnly=false)=>showSystemNotification(`preview-${source}-${Date.now()}`,notificationActionLabel(source),source,true,specOnly);",
    "    window.pacefoldDebug={diagnostics,observeClock,workdayStartAt,auditSchedule(dateValue){const date=new Date(`${dateValue}T12:00:00`),items=scheduleForDate(date,true),instants=items.map(item=>{const value=new Date(date);value.setHours(Math.floor(item.time),Math.round((item.time%1)*60),0,0);return{id:item.id,at:value.getTime(),local:value.toString()};});return{date:dateValue,instants};}};",
    "  }"
  ].join('\n'),
  'debug globals');

app=replaceExact(app,
  "  const TT=window.trustedTypes?window.trustedTypes.createPolicy('pacefold',{createHTML:value=>String(value)}):{createHTML:value=>String(value)};",
  "  const TT=window.trustedTypes?window.trustedTypes.createPolicy('pacefold',{createHTML:value=>String(value),createScriptURL:value=>String(value)}):{createHTML:value=>String(value),createScriptURL:value=>String(value)};",
  'trusted script URL policy');
app=replaceExact(app,
  "      workerRegistration=await navigator.serviceWorker.register('../service-worker.js',{scope:'../',updateViaCache:'none'});",
  "      workerRegistration=await navigator.serviceWorker.register(TT.createScriptURL('../service-worker.js'),{scope:'../',updateViaCache:'none'});",
  'trusted service worker URL');
const hardened=rewriteInnerHTMLAssignments(app,'setHTML');app=hardened.source;
if(/style=\"/.test(app))fail('Inline style attribute survived app hardening');
write('app/app.js',app);

let appHtml=read('app/index.html');
appHtml=replaceExact(appHtml,`style-src 'self' 'unsafe-inline'`,`style-src 'self'`,'CSP inline style');
appHtml=replaceExact(appHtml,'form-action \'self\' https://login.microsoftonline.com','form-action \'self\' https://login.microsoftonline.com; require-trusted-types-for \'script\'; trusted-types pacefold','Trusted Types CSP');
write('app/index.html',appHtml);

let worker=read('service-worker.js');
worker=replaceExact(worker,`const VERSION='${fromVersion}';`,`const VERSION='${toVersion}';`,'worker version');
worker=replaceExact(worker,
  "].map(path);",
  `].map(path);
const CRITICAL=[
  './','./index.html','./site-style-01.css','./site-style-02.css','./site.js','./manifest.webmanifest',
  './app/','./app/index.html','./app/app-style-01.css','./app/app-style-02.css','./app/app-style-03.css','./app/app-style-04.css','./app/app-style-05.css','./app/app.js'
].map(path);
const OPTIONAL=APP_SHELL.filter(url=>!CRITICAL.includes(url));
const SHELL_STATUS=path('./__pacefold-shell-status__');`,
  'service worker shell classes');
worker=replaceExact(worker,
`self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});`,
`self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(CRITICAL);
    const results=await Promise.allSettled(OPTIONAL.map(url=>cache.add(url)));
    const missing=results.map((result,index)=>result.status==='rejected'?OPTIONAL[index]:'').filter(Boolean);
    await cache.put(SHELL_STATUS,new Response(JSON.stringify({version:VERSION,missing,count:missing.length,at:Date.now()}),{headers:{'content-type':'application/json'}}));
    if(missing.length)console.warn('[Pacefold] shell assets missing:',missing.length,missing);
    await self.skipWaiting();
  })());
});`,
  'partial optional cache install');
worker=replaceExact(worker,
  "  if(data.type==='PACEFOLD_VERSION'&&event.source)event.source.postMessage({type:'PACEFOLD_VERSION',version:VERSION});",
  "  if(data.type==='PACEFOLD_VERSION'){const reply={type:'PACEFOLD_VERSION',version:VERSION};if(event.ports[0])event.ports[0].postMessage(reply);else if(event.source)event.source.postMessage(reply);}\n  if(data.type==='PACEFOLD_SHELL_STATUS')event.waitUntil((async()=>{let status={version:VERSION,missing:[],count:0};try{const response=await (await caches.open(CACHE_NAME)).match(SHELL_STATUS);if(response)status=await response.json();}catch(_){}const reply={type:'PACEFOLD_SHELL_STATUS',...status};if(event.ports[0])event.ports[0].postMessage(reply);else if(event.source)event.source.postMessage(reply);})());",
  'worker message handshake');
write('service-worker.js',worker);

let build=read('scripts/build.mjs');
build=replaceExact(build,"const source=fs.readFileSync(p('app','app.js'),'utf8');","let source=fs.readFileSync(p('app','app.js'),'utf8');\nconst debug=process.env.PACEFOLD_DEBUG==='1';\nif(debug){const marker='const DEBUG_BUILD=false;';if(!source.includes(marker))throw new Error('DEBUG_BUILD marker missing');source=source.replace(marker,'const DEBUG_BUILD=true;');fs.writeFileSync(p('app','app.js'),source);}",'debug build flag');
write('scripts/build.mjs',build);

let validate=read('scripts/validate.mjs');
validate=replaceExact(validate,
  "if(!appJs.includes('requestNotifications')||!appJs.includes('pacefoldNotificationPreview')||!appJs.includes('runSelfCheck'))fail('Notification or self-check hardening is missing');",
  "if(!appJs.includes('requestNotifications')||!appJs.includes('debugEnabled')||!appJs.includes('pacefoldNotificationPreview')||!appJs.includes('runSelfCheck'))fail('Notification, debug gate or self-check hardening is missing');",
  'validate debug gate');
validate=replaceExact(validate,
  "if(!read('app/index.html').includes('https://graph.microsoft.com'))fail('App CSP does not allow the Microsoft Graph connection');",
  "if(!read('app/index.html').includes('https://graph.microsoft.com'))fail('App CSP does not allow the Microsoft Graph connection');\nif(read('app/index.html').includes(\"'unsafe-inline'\")||!read('app/index.html').includes(\"require-trusted-types-for 'script'\")||!read('app/index.html').includes('trusted-types pacefold'))fail('App CSP is not hardened with Trusted Types');\nif(/style=\"/.test(appJs)||appJs.includes('.innerHTML='))fail('Inline style or raw innerHTML assignment survived hardening');\nif(!appJs.includes(\"cacheLocation:'sessionStorage'\"))fail('MSAL tokens are not explicitly session-scoped');",
  'validate CSP and storage');
validate=replaceExact(validate,
  "for(const feature of ['notificationWorkerReady','Permission allowed · test delivery failed','controllerSeenAtLoad','drainNotificationActions','notificationActionHistory','launchQueue','minutesUntilNextCue','taskbarBadgeMode','waterLastAt','organizeSettingsPanel','settingsView'])",
  "for(const feature of ['notificationWorkerReady','Permission allowed · test delivery failed','controllerSeenAtLoad','controlledWorkerVersion','handleControllerChange','markMissedCue','observeClock','recordDiagnostic','staleAfterMinutes','drainNotificationActions','notificationActionHistory','launchQueue','minutesUntilNextCue','taskbarBadgeMode','waterLastAt','organizeSettingsPanel','settingsView'])",
  'validate reliability features');
validate=replaceExact(validate,
  "for(const asset of ['./app/app-style-05.css','./app/auth.html','./app/vendor/msal-browser-5.17.1.min.js','./onenote-setup.html','./app/icons/notification-prayer.png','./app/icons/shortcut-ack.png'])if(!worker.includes(`'${asset}'`))fail(`Service worker does not cache Pacefold 15 asset: ${asset}`);",
  "for(const asset of ['./app/app-style-05.css','./app/auth.html','./app/vendor/msal-browser-5.17.1.min.js','./onenote-setup.html','./app/icons/notification-prayer.png','./app/icons/shortcut-ack.png'])if(!worker.includes(`'${asset}'`))fail(`Service worker does not cache Pacefold 15 asset: ${asset}`);\nfor(const feature of ['const CRITICAL=','const OPTIONAL=','Promise.allSettled(OPTIONAL','PACEFOLD_SHELL_STATUS'])if(!worker.includes(feature))fail(`Service worker optional-shell hardening is missing: ${feature}`);",
  'validate service worker split');
validate=replaceExact(validate,
  "const shell=[...worker.matchAll(/'\\.\\/([^']*)'/g)].map(m=>m[1]).filter(Boolean);",
  "const shell=[...worker.matchAll(/'\\.\\/([^']*)'/g)].map(m=>m[1]).filter(Boolean).filter(ref=>!ref.startsWith('__pacefold-'));",
  'validate virtual shell metadata');
validate=replaceExact(validate,
  "if(!appJs.includes(\"navigator.serviceWorker.register('../service-worker.js'\"))fail('App does not register the root service worker');",
  "if(!appJs.includes(\"navigator.serviceWorker.register(TT.createScriptURL('../service-worker.js')\"))fail('App does not register the trusted root service worker');",
  'validate trusted worker registration');
write('scripts/validate.mjs',validate);

let browser=read('scripts/browser-audit.cjs');
browser=browser.replaceAll(fromVersion,toVersion);
browser=browser.replaceAll(fromVersion.replaceAll('.','\\.'),toVersion.replaceAll('.','\\.'));
browser=replaceExact(browser,`${basePlaceholder()}`,`${basePlaceholder()}`,'browser no-op',1);
function basePlaceholder(){return "const current=path.resolve(process.argv[2]||'.');";}
browser=replaceExact(browser,"await app.goto(`${base}/app/?setup=1`,{waitUntil:'networkidle'});","await app.goto(`${base}/app/?setup=1&debug=1`,{waitUntil:'networkidle'});",'browser debug setup');
browser=replaceExact(browser,"await app.goto(`${base}/app/?capture=1`,{waitUntil:'networkidle'});","await app.goto(`${base}/app/?capture=1&debug=1`,{waitUntil:'networkidle'});",'browser debug capture');
browser=replaceExact(browser,
  "assert(outcome.delivered&&outcome.detail,JSON.stringify(outcome));",
  "assert(outcome.delivered&&outcome.detail,JSON.stringify(outcome));const rawSink=await app.evaluate(()=>{const node=document.createElement('div');try{node.innerHTML='<b>unsafe</b>';return false;}catch(_){return true;}});assert(rawSink,'Trusted Types did not reject an unwrapped HTML assignment');",
  'trusted types browser assertion');
browser=replaceExact(browser,
  "assert(graphCreates===1&&graphAppends===1,JSON.stringify({graphCreates,graphAppends,graphPageContent}));return '1 page · 1 append · retry found existing capture';});await graph.close();",
  "assert(graphCreates===1&&graphAppends===1,JSON.stringify({graphCreates,graphAppends,graphPageContent}));const tokenKeys=await graphPage.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('msal.')));assert(tokenKeys.length===0,`MSAL token keys leaked to localStorage: ${tokenKeys.join(',')}`);return '1 page · 1 append · retry found existing capture · session-scoped Microsoft cache';});await graph.close();",
  'MSAL localStorage audit');
const insertedAudit=`
    const reliability=await browser.newContext({viewport:{width:1100,height:820},permissions:['notifications'],timezoneId:'America/Toronto'});await reliability.grantPermissions(['notifications'],{origin:base});
    await reliability.addInitScript(()=>{window.__pacefoldNotifications=[];addEventListener('pacefold:notification',event=>window.__pacefoldNotifications.push(event.detail));const now=new Date(),minute=now.getHours()*60+now.getMinutes()-30,normalized=(minute+1440)%1440,time=String(Math.floor(normalized/60)).padStart(2,'0')+':'+String(normalized%60).padStart(2,'0'),day=\`${'${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,\'0\')}-${String(now.getDate()).padStart(2,\'0\')}' }\`;localStorage.setItem('pacefoldOnboardedV15','1');localStorage.setItem('pacefoldPrefsV15',JSON.stringify({profile:'custom',customMoments:[['missed','Dhuhr',time,'D']],browserNotif:true,notificationMode:'all',staleAfterMinutes:20,activityDate:day}));});const reliabilityPage=await reliability.newPage();
    await check('stale scheduled moments are reported without a late notification',async()=>{await reliabilityPage.goto(\`${'${base}'}/app/?debug=1\`,{waitUntil:'networkidle'});await reliabilityPage.waitForFunction(()=>document.querySelector('#statusWord')?.textContent==='Overdue');const state=await reliabilityPage.evaluate(()=>({notices:window.__pacefoldNotifications.length,status:document.querySelector('#statusLine')?.innerText,prefs:JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}'),diagnostics:window.pacefoldDebug?.diagnostics||[]}));assert(state.notices===0,state.notices);assert(/Dhuhr/.test(state.status)&&/ago/.test(state.status),state.status);assert(Object.keys(state.prefs.notified||{}).length===1&&Object.keys(state.prefs.acknowledged||{}).length===0,JSON.stringify(state.prefs));assert(state.diagnostics.some(item=>item.context==='cue-missed'),JSON.stringify(state.diagnostics));return state.status.replace(/\s+/g,' ');});
    await check('diagnostics deduplicate and clock jumps reset timestamp maps',async()=>{const result=await reliabilityPage.evaluate(()=>{for(let i=0;i<50;i++)window.pacefoldDebug.observeClock(Date.now()+2*864e5);const forward=window.pacefoldDebug.observeClock(Date.now()-2*864e5);return{forward,diagnostics:window.pacefoldDebug.diagnostics,prefs:JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}')};});const jumps=result.diagnostics.filter(item=>item.context==='clock-jump');assert(jumps.length>=1&&jumps.some(item=>item.count>=2),JSON.stringify(jumps));assert(Object.keys(result.prefs.acknowledged||{}).length===0,JSON.stringify(result.prefs));return \`${'${jumps.length}'} deduplicated clock-jump record(s)\`;});
    await check('Toronto DST transition schedules resolve to ordered real instants',async()=>{const result=await reliabilityPage.evaluate(()=>['2026-03-08','2026-11-01'].map(date=>window.pacefoldDebug.auditSchedule(date)));for(const day of result){const values=day.instants.map(item=>item.at);assert(values.every(Number.isFinite),JSON.stringify(day));assert(new Set(values).size===values.length,JSON.stringify(day));assert(values.every((value,index)=>index===0||value>values[index-1]),JSON.stringify(day));}return 'spring-forward · fall-back';});await reliability.close();

    const blocked=await browser.newContext({viewport:{width:1000,height:760}});await blocked.addInitScript(()=>{localStorage.setItem('pacefoldOnboardedV15','1');const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='pacefoldPrefsV15')throw new DOMException('Blocked by audit','QuotaExceededError');return original.call(this,key,value);};});const blockedPage=await blocked.newPage();
    await check('blocked storage is visible before capture is accepted',async()=>{await blockedPage.goto(\`${'${base}'}/app/?capture=1&debug=1\`,{waitUntil:'networkidle'});await blockedPage.waitForFunction(()=>document.querySelector('#syncText')?.textContent==='Not saving');assert(await blockedPage.locator('.storage-warning').isVisible(),'storage warning missing');await blockedPage.locator('#captureInput').fill('Ephemeral note');await blockedPage.locator('#captureForm [type="submit"]').click();assert(await blockedPage.locator('#captureInput').inputValue()==='Ephemeral note','failed save cleared the draft');return 'Not saving · warning shown · draft retained';});await blocked.close();
`;
browser=replaceExact(browser,
  "    const update=await browser.newContext({viewport:{width:1100,height:820}}),updatePage=await update.newPage();",
  insertedAudit+"\n    const update=await browser.newContext({viewport:{width:1100,height:820}}),updatePage=await update.newPage();",
  'reliability browser audits');
browser=replaceExact(browser,
  "async function waitControlled(page){await page.waitForFunction(()=>navigator.serviceWorker?.controller,null,{timeout:12000});}",
  "async function waitControlled(page){try{await page.waitForFunction(()=>navigator.serviceWorker?.controller,null,{timeout:12000});}catch(error){const detail=await page.evaluate(async()=>{const registrations=await navigator.serviceWorker?.getRegistrations?.()||[];return{controller:navigator.serviceWorker?.controller?.scriptURL||'',registrations:registrations.map(r=>({scope:r.scope,active:r.active?{state:r.active.state,url:r.active.scriptURL}:null,waiting:r.waiting?{state:r.waiting.state,url:r.waiting.scriptURL}:null,installing:r.installing?{state:r.installing.state,url:r.installing.scriptURL}:null})),cacheKeys:await caches.keys(),setup:document.querySelector('#setupDock')?.innerText||''};});throw new Error(`Service worker control timeout: ${JSON.stringify(detail)}`);}}",
  'service worker control diagnostics');
browser=replaceExact(browser,
  "const pageErrors=[];app.on('pageerror',error=>pageErrors.push(error.message));",
  "const pageErrors=[];app.on('pageerror',error=>pageErrors.push(error.message));app.on('console',message=>{if(message.type()==='error')pageErrors.push(message.text());});",
  'browser console diagnostics');
browser=replaceExact(browser,
  "state.notificationMode='all';localStorage.setItem('pacefoldPrefsV15',JSON.stringify(state));});await app.reload({waitUntil:'networkidle'});const outcome=",
  "state.notificationMode='all';localStorage.setItem('pacefoldPrefsV15',JSON.stringify(state));});await app.goto(`${base}/app/?debug=1`,{waitUntil:'networkidle'});const outcome=",
  'notification debug navigation');
write('scripts/browser-audit.cjs',browser);

let css=read('app/app-style-05.css');
css+=`\n.storage-warning{margin:0 0 12px;padding:10px 12px;border:1px solid var(--attention);border-radius:10px;color:var(--attention);background:color-mix(in srgb,var(--attention) 8%,transparent);font-size:.82rem;line-height:1.4}.sync-tool.blocked{color:var(--attention)}\n`;
write('app/app-style-05.css',css);

for(const file of ['site.js','index.html','onenote-setup.html','README.md','CHANGELOG.md','REPOSITORY_SETUP.md','SECURITY.md','ONENOTE_SETUP.md']){
  if(!fs.existsSync(p(file)))continue;let value=read(file);value=value.replaceAll(fromVersion,toVersion);write(file,value);
}
let changelog=read('CHANGELOG.md');
if(!changelog.includes(`## ${toVersion}`))changelog=changelog.replace(/^#([^\n]*)\n/,match=>`${match}\n## ${toVersion}\n- Hardened offline installation, storage visibility, missed-cue handling, Trusted Types, worker updates, diagnostics, clock discontinuities, Microsoft token scope and DST auditing.\n\n`);
write('CHANGELOG.md',changelog);
let security=read('SECURITY.md');
if(!security.includes('sessionStorage'))security+=`\n## Microsoft session storage\n\nPacefold explicitly keeps MSAL authentication state in sessionStorage with cookies disabled. Microsoft access tokens are not written to localStorage and end with the Pacefold window session.\n`;
write('SECURITY.md',security);
let readme=read('README.md');
if(!readme.includes('Foreground reminder boundary'))readme+=`\n## Foreground reminder boundary\n\nPacefold reminds reliably while its window is open and the device is awake. Browsers cannot guarantee exact scheduled delivery while a window is closed, heavily throttled or the laptop is asleep. When Pacefold returns after a missed scheduled moment, it reports the real scheduled time and how late it is instead of firing a stale system notification. Exact background delivery requires the optional native Windows companion.\n`;
write('README.md',readme);

console.log(`Hardened Pacefold core ${fromVersion} -> ${toVersion}; ${hardened.count} innerHTML assignments routed through Trusted Types.`);
