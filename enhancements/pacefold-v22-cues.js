(()=>{
'use strict';

const RELEASE='22.0.2';
const REVISION='cue-queue-r1';
const STORAGE_KEY='pacefold.daylight.cues.v1';
const PREFS_KEY='pacefoldPrefsV15';
const SOURCES=['prayer','water','lunch','noodle','away','eyes','body','flow','diagnostic'];
const SOURCE_ALIASES={meal:'lunch',prep:'noodle',timer:'noodle',gaze:'eyes',movement:'body',move:'body'};
const ACTION_IDS={
  water:'water',waterBtn:'water',waterPill:'water',
  noodle:'noodle',noodleBtn:'noodle',noodlePill:'noodle',timerBtn:'noodle',
  lunch:'lunch',lunchBtn:'lunch',lunchPill:'lunch',mealBtn:'lunch',
  away:'away',awayBtn:'away',awayPill:'away',
  gaze:'eyes',gazeBtn:'eyes',eyesBtn:'eyes',
  body:'body',bodyBtn:'body',moveBtn:'body',
  prayer:'prayer',prayerBtn:'prayer',prayerBreakBtn:'prayer'
};

let deliveryOriginal=null;
let deliveryWrapper=null;
let deliveryTimer=0;
let expiryTimer=0;
let lastState='';

const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
const normalizeSource=value=>{
  const raw=String(value||'diagnostic').toLowerCase();
  const source=SOURCE_ALIASES[raw]||raw;
  return SOURCES.includes(source)?source:'diagnostic';
};
const prefs=()=>object(parse(localStorage.getItem(PREFS_KEY),{}))||{};
const now=()=>Date.now();

function read(){
  const value=parse(localStorage.getItem(STORAGE_KEY),[]);
  return Array.isArray(value)?value.filter(object):[];
}
function sanitize(items=read()){
  const instant=now(),seen=new Set(),next=[];
  for(const item of items.slice(-80)){
    const key=String(item.key||'').slice(0,160),source=normalizeSource(item.source),deliveredAt=Number(item.deliveredAt)||instant,expiresAt=Number(item.expiresAt)||deliveredAt+30*60000;
    if(!key||expiresAt<=instant||seen.has(key))continue;
    seen.add(key);next.push({key,source,deliveredAt,expiresAt});
  }
  return next.slice(-24);
}
function write(items){
  const next=sanitize(items);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{}
  return next;
}
function live(){return write(read())}
function sources(){return [...new Set(live().map(item=>item.source))]}
function count(){return sources().length}
function ttl(){return Math.max(5,Number(prefs().dueWindow)||18)*60000}

function stateRoot(){
  let root=document.getElementById('pf22-cue-source-state');
  if(root)return root;
  root=document.createElement('div');root.id='pf22-cue-source-state';root.hidden=true;root.setAttribute('aria-hidden','true');document.body?.append(root);return root;
}
function materialize(items=live()){
  const root=stateRoot();if(!root)return;
  root.replaceChildren();
  for(const source of [...new Set(items.map(item=>item.source))]){
    const marker=document.createElement('i');marker.dataset.source=source;marker.className='due';root.append(marker);
  }
}
function nativeBadge(items=live()){
  const value=prefs(),enabled=value.notifications!==false&&value.taskbarBadge!==false&&(value.taskbarBadgeMode||'due')!=='off';
  const total=[...new Set(items.map(item=>item.source))].length;
  const scheduler=window.__PACEFOLD_MA_SCHEDULER__;
  try{
    if(!enabled||!total){void scheduler?._nativeClearBadge?.();return}
    void scheduler?._nativeSetBadge?.(total>1?total:undefined);
  }catch{}
}
function publish(force=false){
  const items=live(),key=JSON.stringify(items.map(item=>[item.key,item.source,item.expiresAt]));
  materialize(items);nativeBadge(items);
  if(force||key!==lastState){
    lastState=key;
    window.dispatchEvent(new CustomEvent('pacefold:cue-queue',{detail:{count:count(),sources:sources(),release:RELEASE}}));
  }
  return items;
}
function add(key,source,expiresIn=ttl()){
  const safeKey=String(key||`${source}-${now()}`).slice(0,160),safeSource=normalizeSource(source),instant=now(),items=live().filter(item=>item.key!==safeKey);
  items.push({key:safeKey,source:safeSource,deliveredAt:instant,expiresAt:instant+Math.max(60000,Number(expiresIn)||ttl())});
  write(items);publish(true);return true;
}
function acknowledge(value){
  const raw=String(value||'').toLowerCase(),source=normalizeSource(raw),before=live(),after=before.filter(item=>item.key!==value&&item.source!==source);
  if(after.length===before.length)return false;
  write(after);publish(true);return true;
}
function clear(){write([]);publish(true);return true}

function wrapDelivery(){
  const current=window.__PACEFOLD_MA_DELIVER__;
  if(typeof current!=='function')return false;
  if(current===deliveryWrapper||current.__pacefoldCueQueue)return true;
  deliveryOriginal=current;
  deliveryWrapper=async function(key,message,source,...rest){
    const result=await deliveryOriginal.call(this,key,message,source,...rest);
    if(result)add(key,source);
    return result;
  };
  Object.defineProperty(deliveryWrapper,'__pacefoldCueQueue',{value:true});
  window.__PACEFOLD_MA_DELIVER__=deliveryWrapper;
  return true;
}
function inferSource(target){
  const element=target instanceof Element?target.closest('[data-source],[data-action],button,[role="button"]'):null;
  if(!element)return'';
  const data=element.dataset.source||element.dataset.action||'';
  if(data)return normalizeSource(data);
  const identity=element.id||'';
  if(ACTION_IDS[identity])return ACTION_IDS[identity];
  const lower=`${identity} ${element.className||''} ${element.getAttribute('aria-label')||''}`.toLowerCase();
  for(const [token,source] of Object.entries({water:'water',sip:'water',prayer:'prayer',salah:'prayer',noodle:'noodle',timer:'noodle',meal:'lunch',lunch:'lunch',away:'away',eye:'eyes',gaze:'eyes',move:'body',body:'body'}))if(lower.includes(token))return source;
  return'';
}
function onClick(event){const source=inferSource(event.target);if(source)acknowledge(source)}
function onStorage(event){if(!event||[STORAGE_KEY,PREFS_KEY].includes(event.key))publish(true)}
function initialize(){
  publish(true);
  document.addEventListener('click',onClick,true);
  window.addEventListener('storage',onStorage);
  window.addEventListener('pacefold:ma-prefs',()=>publish(false));
  clearInterval(deliveryTimer);deliveryTimer=setInterval(wrapDelivery,250);wrapDelivery();
  clearInterval(expiryTimer);expiryTimer=setInterval(()=>publish(false),15000);
  window.__PACEFOLD_CUES__={release:RELEASE,revision:REVISION,live,sources,count,add,acknowledge,clear,refresh:()=>publish(true)};
  window.dispatchEvent(new CustomEvent('pacefold:cues-ready',{detail:{release:RELEASE,revision:REVISION}}));
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',initialize,{once:true}):initialize();
})();
