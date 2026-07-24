const VERSION='15.2.1';
const CACHE_PREFIX='pacefold-v';
const CACHE_NAME=`pacefold-v${VERSION}`;
const ACTION_CACHE='pacefold-notification-actions-v1';
const ROOT=new URL('./',self.location.href);
const path=value=>new URL(value,ROOT).href;
const APP_SHELL=[
  './','./index.html','./site-style-01.css','./site-style-02.css','./site.js','./privacy.html','./onenote-setup.html','./404.html','./manifest.webmanifest',
  './app/','./app/index.html','./app/auth.html','./app/auth.js','./app/app-style-01.css','./app/app-style-02.css','./app/app-style-03.css','./app/app-style-04.css','./app/app-style-05.css','./app/app.js',
  './app/vendor/msal-browser-5.17.1.min.js','./app/vendor/msal-redirect-bridge-5.17.1.min.js','./app/vendor/MSAL-LICENSE.txt',
  './app/icons/icon-32.png','./app/icons/icon-192.png','./app/icons/icon-512.png',
  './app/icons/notification-prayer.png','./app/icons/notification-water.png','./app/icons/notification-noodle.png','./app/icons/notification-away.png','./app/icons/notification-lunch.png','./app/icons/notification-eyes.png','./app/icons/notification-body.png','./app/icons/notification-test.png',
  './app/icons/shortcut-ack.png','./app/icons/shortcut-capture.png','./app/icons/shortcut-care.png','./app/icons/shortcut-sound.png'
].map(path);

const actionRequest=id=>new Request(path(`./__pacefold-action__/${encodeURIComponent(id)}`));
async function queueNotificationAction(action){
  const cache=await caches.open(ACTION_CACHE),id=String(action.id||`action-${Date.now()}-${Math.random().toString(36).slice(2,9)}`),payload={...action,id,at:Number(action.at)||Date.now()};
  await cache.put(actionRequest(id),new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}}));return payload;
}
let actionQueueLock=Promise.resolve();
function claimNotificationActions(owner='client'){
  const task=actionQueueLock.then(async()=>{
    const cache=await caches.open(ACTION_CACHE),requests=await cache.keys(),actions=[],now=Date.now();
    for(const request of requests){try{const item=await (await cache.match(request)).json();if(now-Number(item.at||0)>7*864e5){await cache.delete(request);continue;}if(item.claimedAt&&now-item.claimedAt<5000)continue;const claimed={...item,claimedAt:now,claimOwner:owner};await cache.put(request,new Response(JSON.stringify(claimed),{headers:{'content-type':'application/json'}}));actions.push(item);}catch(_){await cache.delete(request);}}
    return actions.sort((a,b)=>a.at-b.at);
  });
  actionQueueLock=task.catch(()=>{});return task;
}
async function consumeNotificationAction(id){if(!id)return false;return(await caches.open(ACTION_CACHE)).delete(actionRequest(String(id)));}
async function clearPacefoldNotifications(){const items=await self.registration.getNotifications();items.filter(item=>String(item.tag||'').startsWith('pacefold-')).forEach(item=>item.close());try{if('clearAppBadge'in navigator)await navigator.clearAppBadge();}catch(_){} }

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
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
  if(data.type==='PACEFOLD_VERSION'&&event.source)event.source.postMessage({type:'PACEFOLD_VERSION',version:VERSION});
  if(data.type==='PACEFOLD_DRAIN_ACTIONS')event.waitUntil((async()=>{const actions=await claimNotificationActions(event.source?.id||'client');event.ports[0]?.postMessage({actions});})());
  if(data.type==='PACEFOLD_ACTION_CONSUMED')event.waitUntil(consumeNotificationAction(data.id));
});

async function networkFirst(request,fallback){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),4500);
  try{
    const response=await fetch(request,{signal:controller.signal});
    clearTimeout(timer);
    if(response&&response.ok){
      const cache=await caches.open(CACHE_NAME);
      cache.put(request,response.clone()).catch(()=>{});
    }
    return response;
  }catch(_){
    clearTimeout(timer);
    return (await caches.match(request))||(fallback?await caches.match(path(fallback)):null)||Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    const fallback=url.pathname.includes('/app/')?'./app/index.html':'./index.html';
    event.respondWith(networkFirst(request,fallback));
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(request);
    const refresh=fetch(request).then(async response=>{
      if(response&&response.ok){
        const cache=await caches.open(CACHE_NAME);
        await cache.put(request,response.clone());
      }
      return response;
    }).catch(()=>cached);
    if(cached){event.waitUntil(refresh);return cached;}
    return refresh;
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    if(event.action==='ack'||event.action==='snooze'){
      const queued=await queueNotificationAction({action:event.action,data:event.notification.data||{},at:Date.now()});
      await clearPacefoldNotifications();
      const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      windows.forEach(client=>client.postMessage({type:'PACEFOLD_NOTIFICATION_ACTION_AVAILABLE',id:queued.id}));return;
    }
    const target=path('./app/');
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if(client.url.startsWith(ROOT.href)){await client.focus();if('navigate'in client)await client.navigate(target);return;}
    }
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});
