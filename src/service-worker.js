'use strict';
const VERSION='27.0.0';
const CACHE_NAME=`pacefold-v${VERSION}-polish-r2-window-cues-start-cover`;
const ROOT=new URL('./',self.location.href);
const path=value=>new URL(value,ROOT).href;
const SHELL=[
  './','./index.html','./site.css','./privacy.html','./manifest.webmanifest',
  './app/','./app/index.html','./app/pacefold.css','./app/pacefold.mjs','./app/auth.html','./app/auth.js',
  './app/fonts/pacefold-ma.woff2','./app/icons/fold-mark.svg','./app/icons/icon-192.png','./app/icons/icon-512.png',
  './app/icons/badge-96.png','./app/icons/notify-water-128.png','./app/icons/notify-prayer-128.png','./app/icons/notify-prepare-128.png','./app/icons/notify-away-128.png','./app/icons/notify-meal-128.png','./app/icons/notify-eyes-128.png','./app/icons/notify-move-128.png',
  './app/vendor/msal-browser-5.17.1.min.js','./app/vendor/msal-redirect-bridge-5.17.1.min.js'
].map(path);
const DB_NAME='pacefold-v26';
const DB_VERSION=1;
const STORE='state';
const CUE_KEY='cueState';
const MIRROR_KEY='cueMirror';
const ICON_NAMES={water:'water',prayer:'prayer',prep:'prepare',away:'away',meal:'meal',eyes:'eyes',move:'move'};

self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);await cache.addAll(SHELL);await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith('pacefold-')&&name!==CACHE_NAME).map(name=>caches.delete(name)));await self.clients.claim();
})()));

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='PACEFOLD_VERSION')event.ports[0]?.postMessage({type:'PACEFOLD_VERSION',version:VERSION});
});

function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('pacefold-v26',DB_VERSION);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
async function readDb(key){
  const db=await openDb();try{return await new Promise((resolve,reject)=>{const request=db.transaction(STORE,'readonly').objectStore(STORE).get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}finally{db.close()}
}
async function writeDb(key,value){
  const db=await openDb();try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}
}
function normalizeCueState(value){
  const state=value&&typeof value==='object'?value:{};return{v:1,ack:state.ack&&typeof state.ack==='object'?state.ack:{},notified:state.notified&&typeof state.notified==='object'?state.notified:{},snoozeUntil:Number(state.snoozeUntil)||0};
}

async function networkFirst(request,fallback){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
  try{const response=await fetch(request,{signal:controller.signal});clearTimeout(timer);if(response?.ok)(await caches.open(CACHE_NAME)).put(request,response.clone()).catch(()=>{});return response}catch{clearTimeout(timer);return(await caches.match(request,{ignoreSearch:true}))||(await caches.match(path(fallback)))||Response.error()}
}

self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){event.respondWith(networkFirst(request,url.pathname.includes('/app/')?'./app/index.html':'./index.html'));return}
  event.respondWith((async()=>{const cached=await caches.match(request,{ignoreSearch:true});if(cached){event.waitUntil(fetch(request).then(async response=>{if(response?.ok)await(await caches.open(CACHE_NAME)).put(request,response.clone())}).catch(()=>{}));return cached}const response=await fetch(request);if(response?.ok)(await caches.open(CACHE_NAME)).put(request,response.clone()).catch(()=>{});return response})());
});

function backgroundCues(mirror,state,now=Date.now()){
  if(!mirror||!mirror.notifications||now<Number(state.snoozeUntil||0))return[];
  const cues=[];
  const add=cue=>{if(cue?.key&&!state.ack[cue.key]&&!state.notified[cue.key])cues.push(cue)};
  for(const item of mirror.schedule||[]){const delta=now-Number(item.dueAt);if(delta>=0&&delta<=20*60*1000)add(item)}
  for(const[source,timer]of Object.entries(mirror.timers||{})){
    const start=Number(timer?.start)||0,duration=Number(timer?.duration)||0;if(!start||!duration||now<start+duration)continue;
    add({source,key:`${source}:${start}`,label:timer.label,detail:timer.detail,priority:Number(timer.priority)||70,dueAt:start+duration});
  }
  if(mirror.activeDay&&now>=Number(mirror.workStart)&&now<=Number(mirror.workEnd)){
    const water=mirror.water||{},eyes=mirror.eyes||{},move=mirror.move||{};
    if(Number(water.current)<Number(water.target)&&now-Number(water.lastAt)>=Number(water.cadence))add({source:'water',key:`water:${new Date(now).toISOString().slice(0,10)}:${Math.floor((now-Number(mirror.workStart))/Math.max(1,Number(water.cadence)))}`,label:'Take a sip',detail:'A small hydration reset',priority:40,dueAt:Number(water.lastAt)+Number(water.cadence)});
    if(!mirror.quietMode&&now-Number(eyes.lastAt)>=Number(eyes.cadence))add({source:'eyes',key:`eyes:bg:${Math.floor(now/Math.max(1,Number(eyes.cadence)))}`,label:'Look far',detail:'A 20-second distance look',priority:35,dueAt:Number(eyes.lastAt)+Number(eyes.cadence)});
    if(!mirror.quietMode&&now-Number(move.lastAt)>=Number(move.cadence))add({source:'move',key:`move:bg:${Math.floor(now/Math.max(1,Number(move.cadence)))}`,label:'Change position',detail:'A short movement reset',priority:38,dueAt:Number(move.lastAt)+Number(move.cadence)});
  }
  return cues.sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0));
}

async function deliverBackgroundCue(){
  try{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(windows.some(client=>client.visibilityState==='visible'&&client.focused))return;
    const mirror=await readDb(MIRROR_KEY),state=normalizeCueState(await readDb(CUE_KEY)),cue=backgroundCues(mirror,state)[0];
    if(!cue)return;
    const iconName=ICON_NAMES[cue.source];
    await self.registration.showNotification(cue.label,{body:cue.detail,tag:`pacefold-${cue.source}`,silent:true,renotify:false,requireInteraction:false,icon:iconName?path(`./app/icons/notify-${iconName}-128.png`):path('./app/icons/icon-192.png'),badge:path('./app/icons/badge-96.png'),data:{source:cue.source,key:cue.key},actions:[{action:'ack',title:'Clear'},{action:'snooze',title:'Snooze 10m'}]});
    state.notified[cue.key]=Date.now();await writeDb(CUE_KEY,state);
  }catch(error){console.warn('[Pacefold] background cue check failed',error)}
}

self.addEventListener('periodicsync',event=>{
  if(event.tag==='pacefold-cues')event.waitUntil(deliverBackgroundCue());
});

self.addEventListener('notificationclick',event=>{
  const data=event.notification.data||{};event.notification.close();event.waitUntil((async()=>{
    const state=normalizeCueState(await readDb(CUE_KEY));
    if(event.action==='ack'&&data.key){state.ack[data.key]=Date.now();await writeDb(CUE_KEY,state)}
    if(event.action==='snooze'){state.snoozeUntil=Date.now()+10*60*1000;await writeDb(CUE_KEY,state)}
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(event.action==='ack'||event.action==='snooze'){
      for(const client of windows)client.postMessage({type:event.action==='ack'?'PACEFOLD_ACK':'PACEFOLD_SNOOZE',source:data.source,key:data.key,snoozeUntil:state.snoozeUntil});
      return;
    }
    const target=path('./app/?mode=now');
    for(const client of windows){if(!client.url.startsWith(ROOT.href))continue;if('navigate'in client)await client.navigate(target);await client.focus();return}
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});
