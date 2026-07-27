(() => {
'use strict';

const VERSION='16.0.0';
const ROOT_ID='pf-hub-root';
const SHELL_ID='pf-calm-shell';
const ENTRY_KEY='pacefold.notebook.entries.v2';
const ACK_KEY='pacefold.flow.ack.v2';
const PANEL_KEY='pacefold.calm.panel.v1';
const ACTIONS={notebook:['open-notebook'],media:['open-player'],cue:['handle-cue'],sync:['sync-page'],system:['open-system','open-diagnostics']};
let root=null,shell=null,frame=0,statusTimer=0,observer=null;
let state={waiting:false,text:'Nothing waiting',fingerprint:'',acknowledged:true,inHours:true,workLabel:'Work hours'};

const safeParse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}};
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const hash=value=>{let n=2166136261;for(const char of String(value)){n^=char.charCodeAt(0);n=Math.imul(n,16777619);}return (n>>>0).toString(36);};
const actions=()=>Array.isArray(window.__PACEFOLD_SURFACE__?.actions)?window.__PACEFOLD_SURFACE__.actions:[];
function originalAction(name){return [...(root?.querySelectorAll('[data-pf-action]:not([data-pf-calm-proxy])')||[])].find(node=>node.dataset.pfAction===name)||null;}
function resolveAction(kind){for(const name of ACTIONS[kind]||[]){const control=originalAction(name);if(control)return control;}const token=kind==='media'?'player':kind;const fuzzy=actions().find(name=>String(name).includes(token));return fuzzy?originalAction(fuzzy):null;}
function forward(kind){const control=resolveAction(kind);if(!control){showStatus(`${kind[0].toUpperCase()+kind.slice(1)} is unavailable.`,'warning');return false;}control.click();return true;}
function setupVisible(){return Boolean(window.__PACEFOLD_GUARDIAN__?.setupVisible?.());}
function report(kind,error){try{window.__PACEFOLD_RESILIENCE__?.recordError?.(`calm-${kind}`,error);}catch{}}

function entries(){try{const value=safeParse(localStorage.getItem(ENTRY_KEY),[]);return Array.isArray(value)?value:[];}catch{return [];}}
function entryText(item){return text(item?.text||item?.body||item?.content||item?.title||'Untitled note');}
function entrySection(item){return text(item?.section||item?.category||'Notes');}
function entryDate(item){const raw=item?.updatedAt||item?.createdAt||item?.timestamp||item?.date;const date=raw?new Date(raw):null;return date&&!Number.isNaN(date.valueOf())?date.toLocaleDateString(undefined,{month:'short',day:'numeric'}):text(item?.date||'');}

function clockMinutes(value){const match=String(value||'').match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s|$)/);if(!match)return null;const h=Number(match[1]),m=Number(match[2]);return h>=0&&h<24&&m>=0&&m<60?h*60+m:null;}
function findTimePair(value,depth=0){
  if(!value||typeof value!=='object'||depth>5)return null;
  const pairs=[['workStart','workEnd'],['workdayStart','workdayEnd'],['startTime','endTime'],['dayStart','dayEnd'],['start','end']];
  for(const [a,b] of pairs){const start=clockMinutes(value[a]),end=clockMinutes(value[b]);if(start!=null&&end!=null)return {start,end};}
  for(const [key,child] of Object.entries(value)){if(!/work|schedule|hours|profile|prefs|settings/i.test(key))continue;const found=findTimePair(child,depth+1);if(found)return found;}
  return null;
}
function workWindow(){
  let pair=null;
  try{
    for(let i=0;i<localStorage.length&&!pair;i+=1){const key=localStorage.key(i)||'';if(!/pacefold/i.test(key))continue;const raw=localStorage.getItem(key);if(!raw||raw.length>250000)continue;pair=findTimePair(safeParse(raw,null));}
  }catch{}
  if(!pair)return {active:true,label:'Work hours'};
  const now=new Date(),minutes=now.getHours()*60+now.getMinutes(),day=now.getDay();
  const weekday=day!==0&&day!==6;
  const within=pair.start<=pair.end?minutes>=pair.start&&minutes<pair.end:minutes>=pair.start||minutes<pair.end;
  const format=n=>new Date(2000,0,1,Math.floor(n/60),n%60).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  return {active:weekday&&within,label:`${format(pair.start)}–${format(pair.end)}`};
}

function cueText(andon,handler){
  const candidates=[andon?.querySelector('[data-pf-cue-label],.pf-andon-title,.pf-andon-label,strong,b'),handler?.querySelector('strong,b,span')];
  for(const node of candidates){const value=text(node?.textContent).split(/Open Pacefold|Quietly keeping pace|\bDone\b|\bClear\b/i)[0].trim();if(value)return value.slice(0,90);}
  return text(andon?.textContent||handler?.textContent||'Action waiting').slice(0,90);
}
function readCue(){
  if(!root)return {waiting:false,text:'Nothing waiting',fingerprint:'',acknowledged:true};
  const andon=root.querySelector('.pf-andon');const handler=resolveAction('cue');
  const waiting=Boolean(andon?.classList.contains('is-waiting')||andon?.matches('[data-state="waiting"],[data-waiting="true"]'));
  if(!waiting)return {waiting:false,text:'Nothing waiting',fingerprint:'',acknowledged:true};
  const label=cueText(andon,handler),fingerprint=hash(`${label}|${handler?.dataset?.pfId||''}`);
  const acknowledged=safeParse(localStorage.getItem(ACK_KEY),null)?.fingerprint===fingerprint;
  return {waiting:true,text:label,fingerprint,acknowledged};
}
async function closeNotifications(){try{const reg=await navigator.serviceWorker?.getRegistration?.();for(const note of await reg?.getNotifications?.()||[])note.close();}catch{}}
async function clearBadge(){try{await navigator.clearAppBadge?.();}catch{}}
async function quiet(source='manual'){
  const cue=readCue();
  try{if(cue.waiting)localStorage.setItem(ACK_KEY,JSON.stringify({fingerprint:cue.fingerprint,source,at:new Date().toISOString()}));}catch{}
  await Promise.allSettled([clearBadge(),closeNotifications()]);
  showStatus(cue.waiting?'Reminder cleared; the action is still waiting.':'Notifications cleared.','success');
  reconcile();
}
async function enforceHours(){
  const work=workWindow();
  if(!work.active)await Promise.allSettled([clearBadge(),closeNotifications()]);
  return work;
}

function showStatus(message,tone='neutral'){if(!shell)return;const node=shell.querySelector('[data-calm-status]');clearTimeout(statusTimer);node.textContent=message;node.dataset.tone=tone;node.hidden=false;statusTimer=setTimeout(()=>{if(node.isConnected)node.hidden=true;},3200);}
function setOpen(open){if(!shell)return;const panel=shell.querySelector('[data-calm-workspace]');const toggle=shell.querySelector('[data-calm-toggle]');panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));shell.classList.toggle('is-open',open);try{sessionStorage.setItem(PANEL_KEY,open?'1':'0');}catch{}if(open)renderNotes();}
function toggle(){setOpen(shell?.querySelector('[data-calm-workspace]')?.hidden!==false);}
function focusCapture(){setOpen(true);setTimeout(()=>shell?.querySelector('[data-calm-input]')?.focus(),0);}
function submitCapture(event){
  event.preventDefault();const proxy=shell.querySelector('[data-calm-input]');const value=text(proxy.value);if(!value){showStatus('Write the note first.','warning');return;}
  const form=root?.querySelector('[data-pf-capture-form]:not([data-pf-calm-proxy])');const input=form?.querySelector('[data-pf-capture-input]');
  if(!form||!input){showStatus('Notes are still starting.','warning');return;}
  input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));form.requestSubmit();proxy.value='';showStatus('Saved locally.','success');setTimeout(renderNotes,80);
}
function renderNotes(){
  if(!shell)return;const list=shell.querySelector('[data-calm-notes]');const all=entries().slice().sort((a,b)=>String(b?.updatedAt||b?.createdAt||b?.date||'').localeCompare(String(a?.updatedAt||a?.createdAt||a?.date||''))).slice(0,8);
  list.replaceChildren();
  if(!all.length){const empty=document.createElement('p');empty.className='pf-calm-empty';empty.textContent='No notes yet. Type above and press Enter.';list.append(empty);return;}
  for(const item of all){const row=document.createElement('button');row.type='button';row.className='pf-calm-note';row.innerHTML=`<span><b></b><small></small></span><time></time>`;row.querySelector('b').textContent=entryText(item);row.querySelector('small').textContent=entrySection(item);row.querySelector('time').textContent=entryDate(item);row.addEventListener('click',()=>forward('notebook'));list.append(row);}
}
function latestNotePayload(){const item=entries().slice(-1)[0];return item?{title:`Pacefold — ${entrySection(item)}`,text:`${entryText(item)}\n\n${entryDate(item)}`}:null;}
async function syncOneNote(){
  const existing=resolveAction('sync');if(existing){existing.click();showStatus('Sending through the connected OneNote bridge…','success');return;}
  const payload=latestNotePayload();if(!payload){showStatus('Save a note before sending it to OneNote.','warning');return;}
  try{if(navigator.share){await navigator.share(payload);showStatus('Shared. Choose OneNote to finish.','success');return;}}catch(error){if(error?.name==='AbortError')return;report('share',error);}
  try{await navigator.clipboard.writeText(`${payload.title}\n\n${payload.text}`);showStatus('Copied. Paste into OneNote.','success');}catch{showStatus('OneNote is not connected. Open Notes to reconnect Microsoft.','warning');forward('notebook');}
}
function done(){if(forward('cue')){try{localStorage.removeItem(ACK_KEY);}catch{}setTimeout(reconcile,100);}}
function openMedia(){forward('media');}
function markSources(){if(!root)return;for(const selector of ['.pf-andon','[data-pf-capture-form]'])for(const node of root.querySelectorAll(`${selector}:not([data-pf-calm-proxy])`))node.dataset.pfCalmSource='true';}

function markup(){return `
  <section class="pf-calm-workspace" data-calm-workspace hidden aria-label="Notes workspace">
    <header><div><small>NOTES</small><strong>Quick notes</strong></div><div><button type="button" data-calm-onenote>Send to OneNote</button><button type="button" data-calm-full-notes>Open all</button></div></header>
    <form class="pf-calm-compose" data-calm-form data-pf-calm-proxy><label for="pf-calm-input">Write a note</label><textarea id="pf-calm-input" data-calm-input rows="3" maxlength="2400" placeholder="Write it here. Ctrl + Enter saves."></textarea><button type="submit">Save note</button></form>
    <div class="pf-calm-notes" data-calm-notes></div>
  </section>
  <div class="pf-calm-bottom">
    <button class="pf-calm-brand" type="button" data-calm-toggle aria-expanded="false" aria-label="Open notes"><span aria-hidden="true"></span><b>Pacefold</b></button>
    <div class="pf-calm-now"><small data-calm-hours>Work hours</small><strong data-calm-cue>Nothing waiting</strong></div>
    <div class="pf-calm-actions"><button type="button" data-calm-quiet hidden>Clear reminder</button><button type="button" data-calm-done hidden>Done</button></div>
    <div class="pf-calm-player"><button type="button" data-calm-media aria-label="Open music player"><span aria-hidden="true">▶</span><span><small>MINI PLAYER</small><b>Open music</b></span></button></div>
  </div>
  <div class="pf-calm-status" data-calm-status role="status" aria-live="polite" hidden></div>`;}
function bind(){
  shell.querySelector('[data-calm-toggle]').addEventListener('click',toggle);
  shell.querySelector('[data-calm-form]').addEventListener('submit',submitCapture);
  shell.querySelector('[data-calm-input]').addEventListener('keydown',event=>{if(event.key==='Enter'&&event.ctrlKey){event.preventDefault();shell.querySelector('[data-calm-form]').requestSubmit();}});
  shell.querySelector('[data-calm-onenote]').addEventListener('click',syncOneNote);
  shell.querySelector('[data-calm-full-notes]').addEventListener('click',()=>forward('notebook'));
  shell.querySelector('[data-calm-media]').addEventListener('click',openMedia);
  shell.querySelector('[data-calm-quiet]').addEventListener('click',()=>quiet('button'));
  shell.querySelector('[data-calm-done]').addEventListener('click',done);
}
function create(nextRoot){const node=document.createElement('aside');node.id=SHELL_ID;node.dataset.version=VERSION;node.setAttribute('aria-label','Pacefold calm workspace');node.innerHTML=markup();nextRoot.append(node);return node;}
async function reconcile(){
  if(!shell?.isConnected||!root?.isConnected)return;
  markSources();const cue=readCue(),work=await enforceHours();state={...cue,inHours:work.active,workLabel:work.label};
  const visible=cue.waiting&&work.active;const attention=visible&&!cue.acknowledged;
  shell.dataset.attention=attention?'true':'false';shell.dataset.inHours=work.active?'true':'false';
  shell.querySelector('[data-calm-hours]').textContent=work.active?work.label:`Off hours · ${work.label}`;
  shell.querySelector('[data-calm-cue]').textContent=work.active?(cue.waiting?cue.text:'Nothing waiting'):'Paused outside work hours';
  shell.querySelector('[data-calm-quiet]').hidden=!attention;shell.querySelector('[data-calm-done]').hidden=!visible;
  document.title=attention?`${cue.text} — Pacefold`:'Pacefold';
  renderNotes();
}
function unmount(){observer?.disconnect();observer=null;shell?.remove();shell=null;root=null;document.documentElement.classList.remove('pf-calm-active');clearBadge();}
function mount(){
  if(setupVisible()){unmount();return;}const nextRoot=document.getElementById(ROOT_ID);if(!nextRoot){unmount();return;}
  root=nextRoot;shell=nextRoot.querySelector(`#${SHELL_ID}`);if(!shell||shell.dataset.version!==VERSION){shell?.remove();shell=create(nextRoot);bind();}
  root.classList.add('pf-calm-integrated');document.documentElement.classList.add('pf-calm-active');
  try{if(sessionStorage.getItem(PANEL_KEY)==='1')setOpen(true);}catch{}
  observer?.disconnect();observer=new MutationObserver(queue);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','data-state','data-waiting']});reconcile();
}
function queue(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;try{mount();}catch(error){report('mount',error);setTimeout(queue,120);}});}
function keydown(event){if(event.key==='Escape'&&shell&&!shell.querySelector('[data-calm-workspace]').hidden)setOpen(false);if(event.ctrlKey&&event.shiftKey&&event.code==='Space'){event.preventDefault();toggle();}if(event.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){event.preventDefault();focusCapture();}}

document.addEventListener('keydown',keydown);window.addEventListener('focus',()=>{quiet('focus');queue();});window.addEventListener('pageshow',queue);window.addEventListener('storage',queue);new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
[0,100,350,900].forEach(delay=>setTimeout(queue,delay));setInterval(()=>{if(document.visibilityState==='visible')reconcile();},5000);
window.__PACEFOLD_FLOW__={version:VERSION,mount,reconcile,quiet,focusCapture,setPanel:setOpen};
})();
