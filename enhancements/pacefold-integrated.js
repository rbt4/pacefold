(() => {
'use strict';

const VERSION='15.8.0';
const ROOT_ID='pf-hub-root';
const DOCK_ID='pf-flow-dock';
const ACK_KEY='pacefold.flow.ack.v1';
const PANEL_KEY='pacefold.flow.panel.v1';
const ENTRY_KEY='pacefold.notebook.entries.v2';
const SYNC_LOCK_KEY='pacefold.resilience.lock.sync-page.v1';
const COMMANDS={
  daily:'Daily',note:'Daily',follow:'Follow-ups',followup:'Follow-ups','follow-up':'Follow-ups',
  incident:'Incidents',incidents:'Incidents',inspect:'Inspections',inspection:'Inspections',
  jhsc:'JHSC',construction:'Construction',notification:'Notifications',notifications:'Notifications',
  resource:'Resources',resources:'Resources'
};
const ACTIONS={
  notebook:['open-notebook'],
  media:['open-player'],
  weather:['open-weather','show-weather','weather'],
  system:['open-system','open-diagnostics','diagnostics'],
  cue:['handle-cue'],
  sync:['sync-page']
};
const originalTitle=document.title;
let root=null;
let dock=null;
let observer=null;
let frame=0;
let clickTimer=0;
let cueState={waiting:false,text:'No action waiting',fingerprint:'',acknowledged:true};
let statusTimer=0;
let mountedRoot=null;

function safeParse(raw,fallback){try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
function compactText(value){return String(value||'').replace(/\s+/g,' ').trim();}
function hash(value){
  let result=2166136261;
  for(const char of String(value)){result^=char.charCodeAt(0);result=Math.imul(result,16777619);}
  return (result>>>0).toString(36);
}
function today(){return new Date().toISOString().slice(0,10);}
function setupVisible(){return Boolean(window.__PACEFOLD_GUARDIAN__?.setupVisible?.());}
function allActions(){return Array.isArray(window.__PACEFOLD_SURFACE__?.actions)?window.__PACEFOLD_SURFACE__.actions:[];}
function originalAction(name){return root?.querySelector(`[data-pf-action="${CSS.escape(name)}"]:not([data-pf-flow-proxy])`)||null;}
function resolveAction(kind){
  for(const name of ACTIONS[kind]||[]){const control=originalAction(name);if(control)return {name,control};}
  const known=allActions();
  const token=kind==='media'?'player':kind;
  const fuzzy=known.find(name=>String(name).includes(token));
  return fuzzy?{name:fuzzy,control:originalAction(fuzzy)}:null;
}
function forward(kind){
  const match=resolveAction(kind);
  if(!match?.control){showStatus(`${kind[0].toUpperCase()+kind.slice(1)} is unavailable here.`,'warning');return false;}
  match.control.click();
  return true;
}
function notebookEntries(){const value=safeParse(localStorage.getItem(ENTRY_KEY),[]);return Array.isArray(value)?value:[];}
function todayCount(){return notebookEntries().filter(item=>item?.date===today()).length;}
function currentAck(){return safeParse(localStorage.getItem(ACK_KEY),null);}
function readCue(){
  if(!root)return {waiting:false,text:'No action waiting',fingerprint:'',acknowledged:true};
  const andon=root.querySelector('.pf-andon');
  const handler=originalAction('handle-cue');
  const waiting=Boolean(andon?.classList.contains('is-waiting')||handler&&!handler.disabled&&handler.getAttribute('aria-disabled')!=='true'&&compactText(andon?.textContent));
  let text=compactText(andon?.textContent||handler?.textContent||'');
  for(const label of ['Done','Clear','Log','Open','Handle'])text=text.replace(new RegExp(`\\b${label}\\b`,'gi'),'');
  text=compactText(text).slice(0,110)||'Action waiting';
  const fingerprint=waiting?hash(`${text}|${handler?.dataset?.pfId||''}`):'';
  const acknowledged=Boolean(!waiting||currentAck()?.fingerprint===fingerprint);
  return {waiting,text,fingerprint,acknowledged};
}
async function closeNotifications(){
  try{
    const registration=await navigator.serviceWorker?.getRegistration?.();
    const notifications=await registration?.getNotifications?.();
    for(const notification of notifications||[])notification.close();
  }catch{}
}
async function clearBadge(){try{await navigator.clearAppBadge?.();}catch{}}
async function setBadge(){try{await navigator.setAppBadge?.(1);}catch{}}
async function acknowledge(source='dock'){
  const next=readCue();
  if(next.waiting){
    try{localStorage.setItem(ACK_KEY,JSON.stringify({fingerprint:next.fingerprint,at:new Date().toISOString(),source,version:VERSION}));}catch{}
  }
  await Promise.allSettled([clearBadge(),closeNotifications()]);
  window.dispatchEvent(new CustomEvent('pacefold:taskbar-acknowledged',{detail:{source,fingerprint:next.fingerprint}}));
  showStatus(next.waiting?'Taskbar quieted. The action remains waiting.':'Taskbar is clear.','success');
  reconcileState();
}
async function syncBadge(){
  cueState=readCue();
  if(cueState.waiting&&!cueState.acknowledged)await setBadge();
  else await clearBadge();
  document.title=cueState.waiting?`${cueState.acknowledged?'':'• '}${cueState.text} — Pacefold`:originalTitle;
}
function showStatus(message,tone='neutral'){
  if(!dock)return;
  const node=dock.querySelector('[data-pf-flow-status]');
  if(!node)return;
  clearTimeout(statusTimer);
  node.textContent=message;
  node.dataset.tone=tone;
  node.hidden=false;
  statusTimer=setTimeout(()=>{if(node.isConnected)node.hidden=true;},2600);
}
function setPanel(open,focus=true){
  if(!dock)return;
  const panel=dock.querySelector('[data-pf-flow-panel]');
  const toggle=dock.querySelector('[data-pf-flow-more]');
  if(!panel||!toggle)return;
  panel.hidden=!open;
  toggle.setAttribute('aria-expanded',String(open));
  dock.classList.toggle('is-open',open);
  try{sessionStorage.setItem(PANEL_KEY,open?'open':'closed');}catch{}
  if(open&&focus)panel.querySelector('[data-pf-flow-primary]')?.focus({preventScroll:true});
}
function togglePanel(){setPanel(dock?.querySelector('[data-pf-flow-panel]')?.hidden!==false);}
function focusCapture(){
  setPanel(false,false);
  const input=dock?.querySelector('[data-pf-flow-input]');
  input?.focus({preventScroll:true});
  input?.select?.();
}
function parseCapture(value){
  const raw=compactText(value);
  const match=raw.match(/^\/([\w-]+)\s*/);
  if(!match)return {section:null,body:raw};
  const section=COMMANDS[match[1].toLowerCase()]||null;
  return section?{section,body:raw.slice(match[0].length).trim()}:{section:null,body:raw};
}
function submitCapture(event){
  event.preventDefault();
  if(!root)return;
  const proxy=dock.querySelector('[data-pf-flow-input]');
  const parsed=parseCapture(proxy.value);
  if(!parsed.body){showStatus('Write a note first.','warning');return;}
  const form=root.querySelector('[data-pf-capture-form]:not([data-pf-flow-proxy])');
  const input=form?.querySelector('[data-pf-capture-input]');
  const section=form?.querySelector('[data-pf-capture-section]');
  if(!form||!input){showStatus('Capture is still starting.','warning');return;}
  if(parsed.section&&section){section.value=parsed.section;section.dispatchEvent(new Event('change',{bubbles:true}));}
  input.value=parsed.body;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  form.requestSubmit();
  proxy.value='';
  showStatus(parsed.section?`Saved to ${parsed.section}.`:'Saved to today.','success');
  setTimeout(reconcileState,60);
}
function sourceIcon(){
  const text=cueState.text.toLowerCase();
  if(/water|drink|hydrate|sip/.test(text))return '滴';
  if(/eye|look far|distance/.test(text))return '◉';
  if(/move|stretch|posture|ergonomic/.test(text))return '↗';
  if(/prayer|fajr|dhuhr|asr|maghrib|isha/.test(text))return '◇';
  if(/meal|lunch|eat/.test(text))return '◡';
  if(/prepare|noodle|ready/.test(text))return '≈';
  if(/away|break|step away/.test(text))return '↘';
  return '·';
}
function markOriginalSources(){
  if(!root)return;
  for(const selector of ['.pf-andon','.pf-player-row','[data-pf-capture-form]']){
    for(const node of root.querySelectorAll(`${selector}:not([data-pf-flow-proxy])`))node.setAttribute('data-pf-flow-source','true');
  }
}
function capability(kind){return Boolean(resolveAction(kind)?.control);}
function reconcileState(){
  if(!dock?.isConnected||!root?.isConnected)return;
  markOriginalSources();
  cueState=readCue();
  const pulse=dock.querySelector('[data-pf-flow-pulse]');
  const cue=dock.querySelector('[data-pf-flow-cue]');
  const cueText=dock.querySelector('[data-pf-flow-cue-text]');
  const cueIcon=dock.querySelector('[data-pf-flow-cue-icon]');
  const badge=dock.querySelector('[data-pf-flow-badge]');
  pulse.dataset.state=cueState.waiting?(cueState.acknowledged?'waiting':'new'):'calm';
  pulse.setAttribute('aria-label',cueState.waiting?(cueState.acknowledged?'Action waiting; open Pacefold controls':'New action; clear taskbar notification'):'Open Pacefold controls');
  badge.hidden=!cueState.waiting||cueState.acknowledged;
  cue.hidden=!cueState.waiting;
  cueText.textContent=cueState.text;
  cueIcon.textContent=sourceIcon();
  dock.querySelector('[data-pf-flow-taskbar]').textContent=cueState.waiting?(cueState.acknowledged?'Quieted · action waiting':'Taskbar attention pending'):'Clear';
  dock.querySelector('[data-pf-flow-count]').textContent=String(todayCount());
  const lock=safeParse(localStorage.getItem(SYNC_LOCK_KEY),null);
  dock.querySelector('[data-pf-flow-sync-state]').textContent=lock&&Number(lock.until)>Date.now()?'Syncing…':'Ready';
  for(const button of dock.querySelectorAll('[data-pf-flow-tool]')){
    const kind=button.dataset.pfFlowTool;
    button.disabled=!capability(kind);
  }
  dock.querySelector('[data-pf-flow-done]').disabled=!cueState.waiting||!capability('cue');
  syncBadge();
}
function pulseClick(event){
  if(event.detail>1)return;
  clearTimeout(clickTimer);
  const current=readCue();
  if(current.waiting&&!current.acknowledged){acknowledge('pulse');return;}
  clickTimer=setTimeout(togglePanel,180);
}
function pulseDoubleClick(){clearTimeout(clickTimer);setPanel(true);}
function doneCue(){if(forward('cue')){setPanel(false,false);setTimeout(reconcileState,120);}}
function syncPage(){
  if(resolveAction('sync')?.control){forward('sync');return;}
  if(!forward('notebook'))return;
  setTimeout(()=>{if(!forward('sync'))showStatus('Open the notebook page, then sync.','warning');},180);
}
function runTool(event){const kind=event.currentTarget.dataset.pfFlowTool;if(kind)forward(kind);}
function handleLaunchIntent(){
  const url=new URL(location.href);
  const intent=url.searchParams.get('pf');
  if(!intent)return;
  url.searchParams.delete('pf');
  history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  setTimeout(()=>{
    if(intent==='capture')focusCapture();
    else if(intent==='current')setPanel(true);
    else if(intent==='notebook')forward('notebook');
    else if(intent==='media')forward('media');
  },120);
}
function bindDock(){
  dock.querySelector('[data-pf-flow-pulse]').addEventListener('click',pulseClick);
  dock.querySelector('[data-pf-flow-pulse]').addEventListener('dblclick',pulseDoubleClick);
  dock.querySelector('[data-pf-flow-cue]').addEventListener('click',()=>setPanel(true));
  dock.querySelector('[data-pf-flow-form]').addEventListener('submit',submitCapture);
  dock.querySelector('[data-pf-flow-more]').addEventListener('click',togglePanel);
  dock.querySelector('[data-pf-flow-close]').addEventListener('click',()=>setPanel(false));
  dock.querySelector('[data-pf-flow-ack]').addEventListener('click',()=>acknowledge('panel'));
  dock.querySelector('[data-pf-flow-done]').addEventListener('click',doneCue);
  dock.querySelector('[data-pf-flow-focus-capture]').addEventListener('click',focusCapture);
  dock.querySelector('[data-pf-flow-sync]').addEventListener('click',syncPage);
  for(const button of dock.querySelectorAll('[data-pf-flow-tool]'))button.addEventListener('click',runTool);
}
function markup(){return `
  <div class="pf-flow-bar">
    <button class="pf-flow-pulse" type="button" data-pf-flow-pulse data-state="calm" aria-label="Open Pacefold controls">
      <span class="pf-flow-mark" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="pf-flow-badge" data-pf-flow-badge hidden></span>
    </button>
    <button class="pf-flow-cue" type="button" data-pf-flow-cue hidden>
      <span class="pf-flow-cue-icon" data-pf-flow-cue-icon aria-hidden="true">·</span>
      <span data-pf-flow-cue-text>No action waiting</span>
    </button>
    <form class="pf-flow-capture" data-pf-flow-form data-pf-flow-proxy>
      <label class="pf-flow-sr" for="pf-flow-input">Capture to the HSSys notebook</label>
      <input id="pf-flow-input" data-pf-flow-input autocomplete="off" maxlength="1200" placeholder="Capture…  /incident  /follow  /jhsc">
      <button type="submit" aria-label="Save capture"><span aria-hidden="true">↵</span></button>
    </form>
    <button class="pf-flow-tool" type="button" data-pf-flow-tool="notebook" data-pf-flow-proxy aria-label="Open notebook"><span aria-hidden="true">▤</span><small>Notes</small></button>
    <button class="pf-flow-tool" type="button" data-pf-flow-tool="media" data-pf-flow-proxy aria-label="Open player"><span aria-hidden="true">♪</span><small>Media</small></button>
    <button class="pf-flow-more" type="button" data-pf-flow-more aria-expanded="false" aria-controls="pf-flow-panel" aria-label="Open Pacefold controls"><span></span><span></span></button>
  </div>
  <div class="pf-flow-status" data-pf-flow-status role="status" aria-live="polite" hidden></div>
  <section id="pf-flow-panel" class="pf-flow-panel" data-pf-flow-panel hidden aria-label="Pacefold quick controls">
    <header>
      <div><span class="pf-flow-eyebrow">Pacefold</span><strong data-pf-flow-primary tabindex="-1">One day, gently folded.</strong></div>
      <button type="button" data-pf-flow-close aria-label="Close quick controls">×</button>
    </header>
    <div class="pf-flow-now">
      <span>Now</span><b data-pf-flow-cue-text>No action waiting</b>
      <div class="pf-flow-now-actions">
        <button type="button" data-pf-flow-ack>Quiet taskbar</button>
        <button type="button" data-pf-flow-done>Done</button>
      </div>
    </div>
    <div class="pf-flow-grid">
      <button type="button" data-pf-flow-focus-capture><span>＋</span><b>Capture</b><small>Slash routes included</small></button>
      <button type="button" data-pf-flow-tool="notebook" data-pf-flow-proxy><span>▤</span><b>Notebook</b><small><i data-pf-flow-count>0</i> today</small></button>
      <button type="button" data-pf-flow-tool="media" data-pf-flow-proxy><span>♪</span><b>Media</b><small>Contained playback</small></button>
      <button type="button" data-pf-flow-tool="weather" data-pf-flow-proxy><span>○</span><b>Weather</b><small>Forecast on demand</small></button>
      <button type="button" data-pf-flow-sync><span>↥</span><b>OneNote</b><small data-pf-flow-sync-state>Ready</small></button>
      <button type="button" data-pf-flow-tool="system" data-pf-flow-proxy><span>···</span><b>System</b><small>Local diagnostics</small></button>
    </div>
    <footer><span>Taskbar</span><b data-pf-flow-taskbar>Clear</b><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>Space</kbd></footer>
  </section>`;}
function createDock(nextRoot){
  const element=document.createElement('aside');
  element.id=DOCK_ID;
  element.dataset.version=VERSION;
  element.setAttribute('aria-label','Pacefold integrated dock');
  element.innerHTML=markup();
  nextRoot.append(element);
  return element;
}
function unmount(){
  dock?.remove();
  dock=null;root=null;mountedRoot=null;
  document.documentElement.classList.remove('pf-flow-active');
  document.title=originalTitle;
  clearBadge();
}
function mount(){
  if(setupVisible()){unmount();return;}
  const nextRoot=document.getElementById(ROOT_ID);
  if(!nextRoot){unmount();return;}
  if(mountedRoot===nextRoot&&dock?.isConnected){reconcileState();return;}
  dock?.remove();
  root=nextRoot;mountedRoot=nextRoot;
  dock=nextRoot.querySelector(`#${DOCK_ID}`);
  if(!dock||dock.dataset.version!==VERSION){dock?.remove();dock=createDock(nextRoot);}
  root.classList.add('pf-flow-integrated');
  document.documentElement.classList.add('pf-flow-active');
  bindDock();
  try{if(sessionStorage.getItem(PANEL_KEY)==='open')setPanel(true,false);}catch{}
  markOriginalSources();
  reconcileState();
  handleLaunchIntent();
}
function queueMount(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;mount();});}
function keydown(event){
  if(event.key==='Escape'&&dock&&!dock.querySelector('[data-pf-flow-panel]').hidden){setPanel(false);return;}
  if(event.ctrlKey&&event.shiftKey&&event.code==='Space'){event.preventDefault();togglePanel();return;}
  if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){event.preventDefault();focusCapture();}
}
function focusAcknowledge(){setTimeout(()=>{const state=readCue();if(state.waiting&&!state.acknowledged)acknowledge('focus');},80);}

observer=new MutationObserver(mutations=>{
  if(mutations.length&&mutations.every(item=>item.target instanceof Element&&item.target.closest?.(`#${DOCK_ID}`)))return;
  queueMount();
});
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-hidden','disabled','data-view','data-screen','data-step']});
document.addEventListener('keydown',keydown);
window.addEventListener('focus',focusAcknowledge);
window.addEventListener('pageshow',queueMount);
window.addEventListener('online',queueMount);
window.addEventListener('pacefold:storage-changed',queueMount);
window.addEventListener('storage',event=>{if([ENTRY_KEY,ACK_KEY,SYNC_LOCK_KEY].includes(event.key))queueMount();});
[0,80,240,700,1600].forEach(delay=>setTimeout(queueMount,delay));
setInterval(()=>{if(document.visibilityState==='visible')reconcileState();},1500);
window.__PACEFOLD_FLOW__={version:VERSION,mount,reconcile:reconcileState,acknowledge,focusCapture,setPanel};
})();
