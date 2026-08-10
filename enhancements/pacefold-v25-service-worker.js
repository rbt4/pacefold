const VERSION='25.0.0';
const CACHE_PREFIX='pacefold-v';
const CACHE_NAME='pacefold-25.0.0-cleanroom-r1';
const ACTION_CACHE='pacefold-notification-actions-v1';
const ROOT=new URL('./',self.location.href);
const path=value=>new URL(value,ROOT).href;
const CRITICAL=[
  './','./index.html','./site-style-01.css','./site-style-02.css','./site.js','./pacefold-v25-public.css','./pacefold-v25-public.js','./manifest.webmanifest',
  './app/','./app/index.html','./app/app-style-01.css','./app/app-style-02.css','./app/app-style-03.css','./app/app-style-04.css','./app/app-style-05.css','./app/app.js',
  './app/pacefold-v25-shell-boot.css','./app/pacefold-v25-core.css','./app/pacefold-v25-theme-boot.js','./app/pacefold-v25-preboot.js','./app/pacefold-v25-boot.js','./app/pacefold-v25-core.js','./app/pacefold-v25-recovery.css','./app/pacefold-v25-recovery.js',
  './app/vendor/msal-browser-5.17.1.min.js','./app/vendor/msal-redirect-bridge-5.17.1.min.js',
  './app/icons/icon-32.png','./app/icons/icon-192.png','./app/icons/icon-512.png','./app/icons/fold-mark.png'
].map(path);
const OPTIONAL=[
  './privacy.html','./onenote-setup.html','./404.html','./app/auth.html','./app/auth.js','./app/vendor/MSAL-LICENSE.txt',
  './app/icons/notification-prayer.png','./app/icons/notification-water.png','./app/icons/notification-noodle.png','./app/icons/notification-away.png','./app/icons/notification-lunch.png','./app/icons/notification-eyes.png','./app/icons/notification-body.png','./app/icons/notification-test.png',
  './app/icons/shortcut-ack.png','./app/icons/shortcut-capture.png','./app/icons/shortcut-care.png','./app/icons/shortcut-sound.png',
  './app/icons/notify-water.png','./app/icons/notify-eyes.png','./app/icons/notify-move.png','./app/icons/notify-prayer.png','./app/icons/notify-meal.png','./app/icons/notify-prepare.png','./app/icons/notify-away.png'
].map(path);
const SHELL_STATUS=path('./__pacefold-shell-status__');
const actionRequest=id=>new Request(path(`./__pacefold-action__/${encodeURIComponent(id)}`));

async function queueNotificationAction(action){
  const cache=await caches.open(ACTION_CACHE),id=String(action.id||`action-${Date.now()}-${Math.random().toString(36).slice(2,9)}`),payload={...action,id,at:Number(action.at)||Date.now()};
  await cache.put(actionRequest(id),new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}}));
  return payload;
}
let actionQueueLock=Promise.resolve();
function claimNotificationActions(owner='client'){
  const task=actionQueueLock.then(async()=>{
    const cache=await caches.open(ACTION_CACHE),requests=await cache.keys(),actions=[],now=Date.now();
    for(const request of requests){
      try{
        const item=await (await cache.match(request)).json();
        if(now-Number(item.at||0)>7*864e5){await cache.delete(request);continue;}
        if(item.claimedAt&&now-item.claimedAt<5000)continue;
        const claimed={...item,claimedAt:now,claimOwner:owner};
        await cache.put(request,new Response(JSON.stringify(claimed),{headers:{'content-type':'application/json'}}));
        actions.push(item);
      }catch{await cache.delete(request);}
    }
    return actions.sort((a,b)=>a.at-b.at);
  });
  actionQueueLock=task.catch(()=>{});
  return task;
}
async function consumeNotificationAction(id){if(!id)return false;return(await caches.open(ACTION_CACHE)).delete(actionRequest(String(id)));}
async function clearPacefoldNotifications(){
  const items=await self.registration.getNotifications();
  items.filter(item=>String(item.tag||'').startsWith('pacefold-')).forEach(item=>item.close());
  try{if('clearAppBadge'in navigator)await navigator.clearAppBadge();}catch{}
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(CRITICAL);
    const results=await Promise.allSettled(OPTIONAL.map(url=>cache.add(url)));
    const missing=results.map((result,index)=>result.status==='rejected'?OPTIONAL[index]:'').filter(Boolean);
    await cache.put(SHELL_STATUS,new Response(JSON.stringify({version:VERSION,missing,count:missing.length,at:Date.now()}),{headers:{'content-type':'application/json'}}));
    if(missing.length)console.warn('[Pacefold] optional shell assets missing:',missing.length,missing);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type==='SKIP_WAITING')self.skipWaiting();
  if(data.type==='PACEFOLD_VERSION'){
    const reply={type:'PACEFOLD_VERSION',version:VERSION};
    if(event.ports[0])event.ports[0].postMessage(reply);else event.source?.postMessage(reply);
  }
  if(data.type==='PACEFOLD_SHELL_STATUS')event.waitUntil((async()=>{
    let status={version:VERSION,missing:[],count:0};
    try{const response=await (await caches.open(CACHE_NAME)).match(SHELL_STATUS);if(response)status=await response.json();}catch{}
    const reply={type:'PACEFOLD_SHELL_STATUS',...status};
    if(event.ports[0])event.ports[0].postMessage(reply);else event.source?.postMessage(reply);
  })());
  if(data.type==='PACEFOLD_DRAIN_ACTIONS')event.waitUntil((async()=>{const actions=await claimNotificationActions(event.source?.id||'client');event.ports[0]?.postMessage({actions});})());
  if(data.type==='PACEFOLD_ACTION_CONSUMED')event.waitUntil(consumeNotificationAction(data.id));
});
async function networkFirst(request,fallback){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
  try{
    const response=await fetch(request,{signal:controller.signal});clearTimeout(timer);
    if(response&&response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone()).catch(()=>{});}
    return response;
  }catch{
    clearTimeout(timer);
    return (await caches.match(request,{ignoreSearch:true}))||(fallback?await caches.match(path(fallback)):null)||Response.error();
  }
}
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    const fallback=url.pathname.includes('/app/')?'./app/index.html':'./index.html';
    event.respondWith(networkFirst(request,fallback));return;
  }
  event.respondWith((async()=>{
    const cached=await caches.match(request,{ignoreSearch:true});
    const refresh=fetch(request).then(async response=>{if(response&&response.ok){const cache=await caches.open(CACHE_NAME);await cache.put(request,response.clone());}return response;}).catch(()=>cached);
    if(cached){event.waitUntil(refresh);return cached;}return refresh;
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    if(event.action==='ack'||event.action==='snooze'){
      const queued=await queueNotificationAction({action:event.action,data:event.notification.data||{},at:Date.now()});
      await clearPacefoldNotifications();
      const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      windows.forEach(client=>client.postMessage({type:'PACEFOLD_NOTIFICATION_ACTION_AVAILABLE',id:queued.id}));
      return;
    }
    const target=path('./app/'),windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){if(client.url.startsWith(ROOT.href)){await client.focus();if('navigate'in client)await client.navigate(target);return;}}
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});

(()=>{
  const WRAPPED='__pacefoldNotificationWrapped',pfIconBase='./app/icons/',pfTag='pacefold-current-cue';let workActive=true;
  const choose=(title,options={})=>{
    const value=(String(title||'')+' '+String(options.body||'')+' '+String(options.tag||'')+' '+String(options.data?.source||'')).toLowerCase();
    if(/water|drink|hydrate|sip/.test(value))return pfIconBase+'notify-water.png';
    if(/eye|look far|distance/.test(value))return pfIconBase+'notify-eyes.png';
    if(/move|stretch|posture|ergonomic/.test(value))return pfIconBase+'notify-move.png';
    if(/prayer|fajr|dhuhr|asr|maghrib|isha/.test(value))return pfIconBase+'notify-prayer.png';
    if(/meal|lunch|eat/.test(value))return pfIconBase+'notify-meal.png';
    if(/prepare|noodle|ready/.test(value))return pfIconBase+'notify-prepare.png';
    if(/away|break|step away/.test(value))return pfIconBase+'notify-away.png';
    return pfIconBase+'fold-mark.png';
  };
  const registration=self.registration;
  const closeCurrent=async()=>{try{for(const item of await registration?.getNotifications?.({tag:pfTag})||[])item.close();}catch{}};
  self.addEventListener('message',event=>{if(event.data?.type!=='PACEFOLD_WORK_STATE')return;workActive=event.data.active!==false;if(!workActive)event.waitUntil?.(closeCurrent());});
  if(registration&&typeof registration.showNotification==='function'&&!registration[WRAPPED]){
    const original=registration.showNotification.bind(registration);
    const wrapped=async(title,options={})=>{
      if(!workActive){await closeCurrent();return;}
      await closeCurrent();
      return original(title,{...options,tag:pfTag,icon:choose(title,options),badge:pfIconBase+'fold-mark.png',renotify:false,requireInteraction:false});
    };
    try{Object.defineProperty(registration,'showNotification',{configurable:true,writable:true,value:wrapped});Object.defineProperty(registration,WRAPPED,{configurable:true,value:VERSION});}
    catch{try{registration.showNotification=wrapped;registration[WRAPPED]=VERSION;}catch{}}
  }
})();
self.__PACEFOLD_SURFACE_RELEASE__=VERSION;
