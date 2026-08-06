(()=>{
'use strict';
let deferred=null;
const toast=document.getElementById('siteToast');
function show(message){if(!toast)return;toast.textContent=message;toast.dataset.visible='true';setTimeout(()=>{toast.dataset.visible='false'},2400)}
async function install(){
  if(deferred){deferred.prompt();const result=await deferred.userChoice;show(result.outcome==='accepted'?'Pacefold installation started.':'You can install later from the browser menu.');deferred=null;return}
  if(matchMedia('(display-mode: standalone)').matches){show('Pacefold is already installed on this device.');return}
  show('Open the browser menu and choose Install Pacefold or Install this site as an app.')
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;for(const node of document.querySelectorAll('[data-install]'))node.textContent='Install Pacefold'});
for(const node of document.querySelectorAll('[data-install]'))node.addEventListener('click',install);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
})();
