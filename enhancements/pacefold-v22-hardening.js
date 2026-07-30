(()=>{
'use strict';
const RELEASE='22.0.1';
const BACKUP_KEY='pacefold.spatial.notifications.v1';
let originalParent=null,originalNext=null,workbench=null,syncTimer=0;
const $=selector=>document.querySelector(selector);
const id=value=>document.getElementById(value);
const create=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=String(text);return node};
const button=(className,label,text)=>{const node=create('button',className,text);node.type='button';node.setAttribute('aria-label',label);return node};
const core=()=>window.__PACEFOLD_MA_CORE__;
const prefs=()=>core()?.getPrefs?.()||{};
const parse=(value,fallback)=>{try{return value?JSON.parse(value):fallback}catch{return fallback}};
const permission=()=>typeof Notification==='undefined'?'unsupported':Notification.permission;

function notificationEnabled(value=prefs()){
  return value.notificationMode!=='off'&&value.notifications!==false||value.browserNotif===true||value.taskbarBadge===true;
}
function saveNotificationBackup(value){
  try{localStorage.setItem(BACKUP_KEY,JSON.stringify({notificationMode:value.notificationMode&&value.notificationMode!=='off'?value.notificationMode:'discreet',taskbarBadge:value.taskbarBadge!==false,browserNotif:value.browserNotif===true}))}catch{}
}
function notificationBackup(){
  const value=parse(localStorage.getItem(BACKUP_KEY),null);
  return value&&typeof value==='object'?value:{notificationMode:'discreet',taskbarBadge:true,browserNotif:false};
}
function setNotifications(enabled){
  const api=core();if(!api?.updatePrefs)return false;
  const current=prefs();
  if(!enabled){
    saveNotificationBackup(current);
    api.updatePrefs({notifications:false,browserNotif:false,notificationMode:'off',taskbarBadge:false});
    try{navigator.clearAppBadge?.()}catch{}
  }else{
    const backup=notificationBackup();
    api.updatePrefs({
      notifications:true,
      notificationMode:backup.notificationMode||'discreet',
      taskbarBadge:backup.taskbarBadge!==false,
      browserNotif:backup.browserNotif===true&&permission()==='granted'
    });
  }
  window.dispatchEvent(new CustomEvent('pacefold:spatial-hardening',{detail:{notifications:enabled}}));
  sync();return true;
}
function toggleNotifications(){return setNotifications(!notificationEnabled())}

function overlay(){
  let root=id('pf22-sound-overlay');if(root)return root;
  root=create('section','pf22-sound-overlay');root.id='pf22-sound-overlay';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Pacefold sound controls');
  const dialog=create('div','pf22-sound-dialog');
  const head=create('header','pf22-sound-dialog-head');
  const copy=create('div','');copy.append(create('span','pf22-eyebrow','Sound'),create('h2','','Local sound controls'));
  const close=button('pf22-sound-close','Close sound controls','Close');close.addEventListener('click',closeSound);
  const mount=create('div','pf22-sound-mount');mount.id='pf22-sound-mount';
  head.append(copy,close);dialog.append(head,mount);root.append(dialog);
  root.addEventListener('click',event=>{if(event.target===root)closeSound()});
  id('pf22-spatial-root')?.append(root);return root;
}
function findWorkbench(){return id('pf-v19-workbench')||$('.pf-v19-workbench')}
function openSound(){
  const panel=overlay();workbench=findWorkbench();
  if(!workbench){window.__PACEFOLD_V19__?.reconcile?.();setTimeout(openSound,80);return false}
  if(!originalParent){originalParent=workbench.parentNode;originalNext=workbench.nextSibling}
  id('pf22-sound-mount')?.append(workbench);
  workbench.hidden=false;workbench.inert=false;workbench.removeAttribute('aria-hidden');
  window.__PACEFOLD_V19__?.showSound?.();
  panel.hidden=false;panel.dataset.open='true';document.documentElement.classList.add('pf22-sound-open');
  requestAnimationFrame(()=>panel.querySelector('.pf22-sound-close')?.focus({preventScroll:true}));
  return true;
}
function restoreWorkbench(){
  if(!workbench||!originalParent)return;
  if(originalNext&&originalNext.parentNode===originalParent)originalParent.insertBefore(workbench,originalNext);else originalParent.append(workbench);
  window.__PACEFOLD_V19__?.showNotes?.();
  originalParent=null;originalNext=null;workbench=null;
}
function closeSound(){
  const panel=id('pf22-sound-overlay');if(panel){panel.hidden=true;delete panel.dataset.open}
  document.documentElement.classList.remove('pf22-sound-open');restoreWorkbench();
  $('.pf22-sound-controls .pf22-secondary')?.focus?.({preventScroll:true});
}

function sync(){
  const root=id('pf22-spatial-root');if(!root)return;
  document.documentElement.dataset.pacefoldExperience=RELEASE;document.body.dataset.pacefoldExperience=RELEASE;root.dataset.hardening=RELEASE;
  const seconds=$('.pf22-seconds'),show=prefs().showSeconds!==false;if(seconds){seconds.hidden=!show;seconds.setAttribute('aria-hidden',String(!show))}
  const notifications=$('.pf22-switch[data-setting="notifications"]'),enabled=notificationEnabled();if(notifications){notifications.dataset.active=String(enabled);notifications.textContent=enabled?'On':'Off';notifications.title=enabled?'Notification cues and taskbar badges are enabled':'All notification cues and taskbar badges are disabled'}
  const version=$('.pf22-version');if(version&&version.textContent!==`Pacefold ${RELEASE} · verified offline core 15.2.2`)version.textContent=`Pacefold ${RELEASE} · verified offline core 15.2.2`;
  if(window.__PACEFOLD_SPATIAL__)window.__PACEFOLD_SPATIAL__.release=RELEASE;
  if(window.__PACEFOLD_VERSION__)window.__PACEFOLD_VERSION__={...window.__PACEFOLD_VERSION__,experience:RELEASE,update:RELEASE,hardening:'controls-r1'};
  if(Boolean(window.__PACEFOLD_MA_QUIET__?.get?.()||prefs().quietMode))closeSound();
}
function capture(event){
  const target=event.target instanceof Element?event.target:null;if(!target)return;
  const notification=target.closest('.pf22-switch[data-setting="notifications"]');
  if(notification){event.preventDefault();event.stopImmediatePropagation();toggleNotifications();return}
  const sound=target.closest('.pf22-sound-controls .pf22-secondary');
  if(sound){event.preventDefault();event.stopImmediatePropagation();openSound()}
}
function initialize(){
  document.addEventListener('click',capture,true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!id('pf22-sound-overlay')?.hidden){event.preventDefault();event.stopImmediatePropagation();closeSound()}},true);
  for(const name of ['pacefold:ma-prefs','pacefold:spatial-ready','pacefold:storage-changed','pacefold:spatial-hardening'])window.addEventListener(name,sync);
  window.addEventListener('storage',sync);
  sync();syncTimer=setInterval(sync,1000);
  window.__PACEFOLD_HARDENING__={release:RELEASE,sync,setNotifications,toggleNotifications,notificationEnabled,openSound,closeSound};
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',initialize,{once:true}):initialize();
})();
