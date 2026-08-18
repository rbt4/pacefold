const ICON_NAMES={water:'water',prayer:'prayer',prep:'prepare',away:'away',meal:'meal',eyes:'eyes',move:'move'};
const HEARTBEAT_MS=30000;
const READY_TIMEOUT_MS=1800;

const wait=ms=>new Promise(resolve=>setTimeout(()=>resolve(null),ms));
const installedMode=()=>window.matchMedia?.('(display-mode: standalone)').matches||Boolean(navigator.windowControlsOverlay?.visible);

export function installNotificationHardening(ctx){
  ctx.notificationRuntime={badge:'unknown',badgeError:'',lastBadgeCount:-1,lastBadgeAt:0,lastHeartbeat:0,lastDelivery:'',lastDeliveryAt:0};

  ctx.notificationDiagnostics=()=>({
    permission:'Notification'in window?Notification.permission:'unsupported',
    notificationsEnabled:Boolean(ctx.prefs.notifications),
    badgeSupported:typeof navigator.setAppBadge==='function',
    installed:installedMode(),
    serviceWorker:Boolean(navigator.serviceWorker?.controller),
    periodicSync:ctx.periodicCueSyncStatus||'unknown',
    waiting:(ctx.currentCues||[]).length,
    badge:ctx.notificationRuntime.badge,
    badgeError:ctx.notificationRuntime.badgeError,
    lastBadgeCount:ctx.notificationRuntime.lastBadgeCount,
    lastBadgeAt:ctx.notificationRuntime.lastBadgeAt,
    lastHeartbeat:ctx.notificationRuntime.lastHeartbeat,
    lastDelivery:ctx.notificationRuntime.lastDelivery,
    lastDeliveryAt:ctx.notificationRuntime.lastDeliveryAt
  });

  ctx.renderCueFavicon=()=>{
    const href=ctx.cueFavicon?.(ctx.currentCues||[]);if(!href)return;
    let current=document.getElementById('app-favicon');
    if(!current){current=document.createElement('link');current.id='app-favicon';current.rel='icon';document.head.append(current)}
    if(current.getAttribute('href')===href)return;
    const next=current.cloneNode(false);next.id='app-favicon';next.rel='icon';next.type='image/svg+xml';next.href=href;current.replaceWith(next);
  };

  const postBadgeToWorker=count=>{
    try{
      const controller=navigator.serviceWorker?.controller;
      if(controller)controller.postMessage({type:'CLOCK_BADGE',count});
      else navigator.serviceWorker?.ready?.then(registration=>registration.active?.postMessage({type:'CLOCK_BADGE',count})).catch(()=>{});
    }catch{}
  };

  ctx.updateAppBadge=async()=>{
    const count=Math.max(0,Math.min(99,Number(ctx.currentCues?.length)||0));
    ctx.notificationRuntime.lastBadgeCount=count;ctx.notificationRuntime.lastBadgeAt=Date.now();ctx.notificationRuntime.badgeError='';
    postBadgeToWorker(count);
    try{
      if(typeof navigator.setAppBadge!=='function'){
        ctx.notificationRuntime.badge='unsupported';return false;
      }
      if(count){await navigator.setAppBadge(count);ctx.notificationRuntime.badge='set'}
      else if(typeof navigator.clearAppBadge==='function'){await navigator.clearAppBadge();ctx.notificationRuntime.badge='clear'}
      else{await navigator.setAppBadge(0);ctx.notificationRuntime.badge='clear'}
      return true;
    }catch(error){
      ctx.notificationRuntime.badge='blocked';ctx.notificationRuntime.badgeError=String(error?.name||error?.message||error||'badge failed');
      return false;
    }
  };

  ctx.deliverNotification=async cue=>{
    if(!cue||!ctx.prefs.notifications||(ctx.prefs.quietMode&&['water','eyes','move'].includes(cue.source)))return false;
    if(!document.hidden&&document.hasFocus())return false;
    if(!('Notification'in window)||Notification.permission!=='granted'||ctx.cueState.notified[cue.key])return false;
    const iconName=ICON_NAMES[cue.source],copy=ctx.clockCueCopy(cue),options={body:copy.detail,tag:`clock-${cue.source}`,silent:true,renotify:false,requireInteraction:false,icon:iconName?`./icons/notify-${iconName}-128.png`:'./icons/icon-192.png',badge:'./icons/badge-96.png',data:{source:cue.source,key:cue.key},actions:[{action:'ack',title:'Clear'},{action:'snooze',title:'Snooze 10m'}]};
    let delivered=false;
    try{
      if(navigator.serviceWorker){
        const registration=await Promise.race([navigator.serviceWorker.ready,wait(READY_TIMEOUT_MS)]);
        if(registration?.showNotification){await registration.showNotification(copy.label,options);delivered=true}
      }
      if(!delivered&&typeof Notification==='function'){
        const fallback={body:options.body,tag:options.tag,silent:true,icon:options.icon,badge:options.badge,data:options.data};
        new Notification(copy.label,fallback);delivered=true;
      }
      if(delivered){ctx.cueState.notified[cue.key]=Date.now();ctx.saveCueState();ctx.notificationRuntime.lastDelivery=cue.key;ctx.notificationRuntime.lastDeliveryAt=Date.now();return true}
    }catch(error){
      ctx.notificationRuntime.lastDelivery=`failed:${String(error?.name||error?.message||'notification')}`;ctx.notificationRuntime.lastDeliveryAt=Date.now();
      console.warn('[Clock] notification delivery failed',error);
    }
    return false;
  };

  const baseToggleSetting=ctx.toggleSetting;
  ctx.toggleSetting=async key=>{
    if(key!=='notifications')return baseToggleSetting?.(key);
    if(!('Notification'in window)){ctx.toast('System notifications are unavailable here');return}
    if(ctx.prefs.notifications&&Notification.permission==='granted'){
      ctx.storePrefs({notifications:false},'notifications');ctx.renderAll?.();return;
    }
    const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
    if(permission!=='granted'){
      ctx.storePrefs({notifications:false},'notifications');ctx.renderAll?.();ctx.toast(permission==='denied'?'Notifications are blocked in Edge site permissions':'Notifications were not allowed');return;
    }
    ctx.storePrefs({notifications:true},'notifications');ctx.renderAll?.();ctx.toast('System cues enabled');
  };

  const baseRenderSettings=ctx.renderSettings;
  ctx.renderSettings=()=>{
    baseRenderSettings?.();
    const copy=document.querySelector('[data-setting="notifications"] small');if(!copy)return;
    const permission='Notification'in window?Notification.permission:'unsupported',badge=typeof navigator.setAppBadge==='function';
    copy.textContent=permission==='denied'
      ?'Blocked in Edge permissions · taskbar badge may also be blocked'
      :permission==='granted'
        ?`System alerts allowed · ${badge?(installedMode()?'taskbar badge ready':'install Clock for taskbar badge'):'taskbar badge unavailable'}`
        :'Turn on once to allow silent system alerts';
  };

  ctx.notificationHeartbeat=()=>{
    ctx.notificationRuntime.lastHeartbeat=Date.now();
    ctx.refreshCues(true);ctx.syncCueMirror?.();ctx.renderCueFavicon();void ctx.updateAppBadge();
    return ctx.notificationDiagnostics();
  };

  const baseSelfCheck=ctx.runSelfCheck;
  ctx.runSelfCheck=async()=>{
    await baseSelfCheck?.();
    const output=document.getElementById('diagnostic-output');if(!output)return;
    const info=ctx.notificationDiagnostics();
    output.textContent+=`\n\nNotification delivery\nBadge API · ${info.badgeSupported?'supported':'unavailable'}${info.installed?' · installed':''}\nPermission · ${info.permission}\nWaiting · ${info.waiting}\nBadge state · ${info.badge}${info.badgeError?` · ${info.badgeError}`:''}\nWorker · ${info.serviceWorker?'controlling':'not controlling'}\nBackground sync · ${info.periodicSync}`;
  };

  const baseInitialize=ctx.initialize;
  ctx.initialize=async()=>{
    await baseInitialize();
    ctx.notificationHeartbeat();
    clearInterval(ctx.notificationHeartbeatTimer);ctx.notificationHeartbeatTimer=setInterval(ctx.notificationHeartbeat,HEARTBEAT_MS);
    const immediate=()=>ctx.notificationHeartbeat();
    window.addEventListener('pageshow',immediate);window.addEventListener('online',immediate);
    document.addEventListener('visibilitychange',immediate);
    if(window.__PACEFOLD__){window.__PACEFOLD__.notificationDiagnostics=ctx.notificationDiagnostics;window.__PACEFOLD__.notificationHeartbeat=ctx.notificationHeartbeat}
  };
}
