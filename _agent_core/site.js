(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const APP_VERSION='15.2.1';
  let deferredPrompt=null,refreshing=false,registration=null,controllerSeenAtLoad=Boolean(navigator.serviceWorker?.controller);
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const isEdge=/Edg\//.test(navigator.userAgent);
  const isChromium=/Chrome\//.test(navigator.userAgent)||isEdge;
  const toast=text=>{const el=$('siteToast');if(!el)return;el.textContent=text;el.classList.add('on');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('on'),2600)};
  function status(id,text,tone=''){
    const el=$(id);if(!el)return;el.querySelector('.status-text').textContent=text;const dot=el.querySelector('.status-dot');dot.className=`status-dot${tone?' '+tone:''}`;
  }
  function updateInstallUI(){
    const installed=standalone();
    status('browserStatus',isEdge?'Microsoft Edge':isChromium?'Chromium browser':'Use Microsoft Edge',isChromium?'good':'warn');
    status('installStatus',installed?'Installed':deferredPrompt?'Native prompt ready':isEdge?'Guided setup ready':'Open in Edge',installed||deferredPrompt||isEdge?'good':'warn');
    const buttons=[$('installButton'),$('navInstall'),$('heroInstall')].filter(Boolean);
    buttons.forEach(button=>{button.textContent=installed?'Open Pacefold':deferredPrompt?'Install Pacefold':'Guided setup';button.disabled=false;});
  }
  async function install(){
    if(standalone()){location.href='./app/';return;}
    if(deferredPrompt){
      try{await deferredPrompt.prompt();const choice=await deferredPrompt.userChoice;deferredPrompt=null;updateInstallUI();toast(choice.outcome==='accepted'?'Pacefold installation started':'Installation left unchanged');if(choice.outcome==='accepted')return;}
      catch(_){toast('The native prompt was unavailable');}
    }
    location.href='./app/?setup=1';
  }
  async function updateWorker(silent=true){
    if(!registration)return;try{await registration.update();if(!silent)toast('Pacefold is up to date');}catch(_){if(!silent)toast('Update check could not complete');}
  }
  async function registerWorker(){
    if(!('serviceWorker'in navigator)||!window.isSecureContext){status('offlineStatus','Unavailable here','warn');return;}
    try{
      registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
      await navigator.serviceWorker.ready;status('offlineStatus',`Ready · v${APP_VERSION}`,'good');
      if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
      registration.addEventListener('updatefound',()=>{const worker=registration.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){worker.postMessage({type:'SKIP_WAITING'});toast('Pacefold update ready · applying');}});});
      setTimeout(()=>updateWorker(true),1600);setInterval(()=>updateWorker(true),30*60000);
    }catch(_){status('offlineStatus','Setup failed','warn');}
  }
  function notificationState(){
    if(!('Notification'in window))return['Unavailable','warn'];
    if(Notification.permission==='denied')return['Blocked by browser','warn'];
    if(Notification.permission==='granted')return['Allowed · optional','good'];
    return['Optional · setup can test',''];
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;updateInstallUI();});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;updateInstallUI();toast('Pacefold installed · updates stay automatic');});
  navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(!controllerSeenAtLoad){controllerSeenAtLoad=true;return;}if(refreshing)return;refreshing=true;setTimeout(()=>location.reload(),450);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateWorker(true);});
  window.addEventListener('focus',()=>updateWorker(true));window.addEventListener('online',()=>updateWorker(true));window.addEventListener('pageshow',()=>updateWorker(true));
  $('installButton')?.addEventListener('click',install);$('navInstall')?.addEventListener('click',install);$('heroInstall')?.addEventListener('click',event=>{event.preventDefault();install();});
  const [nText,nTone]=notificationState();status('notificationStatus',nText,nTone);updateInstallUI();registerWorker();
})();
