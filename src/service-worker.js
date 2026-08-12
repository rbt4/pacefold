'use strict';
const VERSION='25.1.0';
const CACHE_NAME=`pacefold-v${VERSION}-v26-notify-r1`;
const ROOT=new URL('./',self.location.href);
const path=value=>new URL(value,ROOT).href;
const SHELL=[
  './','./index.html','./site.css','./privacy.html','./manifest.webmanifest',
  './app/','./app/index.html','./app/pacefold.css','./app/pacefold.mjs','./app/auth.html','./app/auth.js',
  './app/fonts/pacefold-ma.woff2','./app/icons/fold-mark.svg','./app/icons/icon-192.png','./app/icons/icon-512.png',
  './app/icons/badge-96.png','./app/icons/notify-water-128.png','./app/icons/notify-prayer-128.png','./app/icons/notify-prepare-128.png','./app/icons/notify-away-128.png','./app/icons/notify-meal-128.png','./app/icons/notify-eyes-128.png','./app/icons/notify-move-128.png',
  './app/vendor/msal-browser-5.17.1.min.js','./app/vendor/msal-redirect-bridge-5.17.1.min.js'
].map(path);

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

async function networkFirst(request,fallback){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
  try{const response=await fetch(request,{signal:controller.signal});clearTimeout(timer);if(response?.ok)(await caches.open(CACHE_NAME)).put(request,response.clone()).catch(()=>{});return response}catch{clearTimeout(timer);return(await caches.match(request,{ignoreSearch:true}))||(await caches.match(path(fallback)))||Response.error()}
}

self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){event.respondWith(networkFirst(request,url.pathname.includes('/app/')?'./app/index.html':'./index.html'));return}
  event.respondWith((async()=>{const cached=await caches.match(request,{ignoreSearch:true});if(cached){event.waitUntil(fetch(request).then(async response=>{if(response?.ok)await(await caches.open(CACHE_NAME)).put(request,response.clone())}).catch(()=>{}));return cached}const response=await fetch(request);if(response?.ok)(await caches.open(CACHE_NAME)).put(request,response.clone()).catch(()=>{});return response})());
});

self.addEventListener('notificationclick',event=>{
  const data=event.notification.data||{};event.notification.close();event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const target=path(event.action==='snooze'?'./app/?mode=now&cueAction=snooze':'./app/?mode=now');
    if(event.action==='ack')for(const client of windows)client.postMessage({type:'PACEFOLD_ACK',source:data.source,key:data.key});
    for(const client of windows){
      if(!client.url.startsWith(ROOT.href))continue;
      if(event.action==='snooze'&&'navigate'in client){const navigated=await client.navigate(target);await(navigated||client).focus();return}
      await client.focus();return;
    }
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});
