(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const APP_VERSION='13.0.0';
  let deferredPrompt=null,refreshing=false,registration=null;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const isEdge=/Edg\//.test(navigator.userAgent);
  const isChromium=/Chrome\//.test(navigator.userAgent)||isEdge;
  const toast=text=>{const el=$('siteToast');if(!el)return;el.textContent=text;el.classList.add('on');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('on'),2400)};
  function status(id,text,tone=''){
    const el=$(id);if(!el)return;el.querySelector('.status-text').textContent=text;const dot=el.querySelector('.status-dot');dot.className=`status-dot${tone?' '+tone:''}`;
  }
  function updateInstallUI(){
    const installed=standalone();
    status('browserStatus',isEdge?'Microsoft Edge':isChromium?'Chromium browser':'Browser detected',isChromium?'good':'warn');
    status('installStatus',installed?'Installed':deferredPrompt?'Ready now':isEdge?'Open app to install':'Best in Edge',installed||deferredPrompt?'good':'warn');
    const button=$('installButton');if(button){button.textContent=installed?'Open Pacefold':deferredPrompt?'Install Pacefold':'Open setup';button.disabled=false;}
  }
  async function install(){
    if(standalone()){location.href='./app/';return;}
    if(deferredPrompt){
      deferredPrompt.prompt();const choice=await deferredPrompt.userChoice;deferredPrompt=null;updateInstallUI();
      toast(choice.outcome==='accepted'?'Pacefold installation started':'Installation left unchanged');return;
    }
    location.href='./app/?setup=1';
  }
  async function registerWorker(){
    if(!('serviceWorker'in navigator)||!window.isSecureContext){status('offlineStatus','Unavailable here','warn');return;}
    try{
      registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
      await navigator.serviceWorker.ready;status('offlineStatus',`Ready · v${APP_VERSION}`,'good');
      if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
      registration.addEventListener('updatefound',()=>{const worker=registration.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)worker.postMessage({type:'SKIP_WAITING'});});});
      setTimeout(()=>registration.update().catch(()=>{}),1500);
    }catch(_){status('offlineStatus','Setup failed','warn');}
  }
  function notificationState(){
    if(!('Notification'in window))return['Unavailable','warn'];
    if(Notification.permission==='denied')return['Blocked by browser','warn'];
    if(Notification.permission==='granted')return['Allowed · optional','good'];
    return['Optional · off',''];
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;updateInstallUI();});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;updateInstallUI();toast('Pacefold installed');});
  navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(refreshing)return;refreshing=true;location.reload();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)registration?.update().catch(()=>{});});
  window.addEventListener('focus',()=>registration?.update().catch(()=>{}));
  $('installButton')?.addEventListener('click',install);
  $('navInstall')?.addEventListener('click',install);
  $('heroInstall')?.addEventListener('click',event=>{event.preventDefault();install();});
  const [nText,nTone]=notificationState();status('notificationStatus',nText,nTone);
  updateInstallUI();registerWorker();
})();
