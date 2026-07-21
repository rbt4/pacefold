const VERSION='13.0.0';
const CACHE_PREFIX='pacefold-v';
const CACHE_NAME=`pacefold-v${VERSION}`;
const ROOT=new URL('./',self.location.href);
const path=value=>new URL(value,ROOT).href;
const APP_SHELL=[
  './','./index.html','./site-style-01.css','./site-style-02.css','./site.js','./privacy.html','./404.html','./manifest.webmanifest',
  './app/','./app/index.html','./app/app-style-01.css','./app/app-style-02.css','./app/app-style-03.css','./app/app-style-04.css','./app/loader.js','./app/app-js-01.txt','./app/app-js-02.txt','./app/app-js-03.txt','./app/app-js-04.txt','./app/app-js-05.txt','./app/app-js-06.txt','./app/app-js-07.txt','./app/app-js-08.txt','./app/app-js-09.txt','./app/app-tail-01.bin','./app/app-tail-02.bin','./app/app-tail-03.bin','./app/app-tail-04.bin','./app/app-tail-05.bin','./app/app-tail-06.bin','./app/app-tail-07.bin','./app/app-tail-08.bin',
  './app/icons/icon-32.png','./app/icons/icon-192.png','./app/icons/icon-512.png'
].map(path);

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
    const target=path('./app/');
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if(client.url.startsWith(ROOT.href)){await client.focus();if('navigate'in client)await client.navigate(target);return;}
    }
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});
