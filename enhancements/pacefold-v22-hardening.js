(()=>{
'use strict';
const RELEASE='22.0.1';
const PREFS_KEY='pacefoldPrefsV15';
const BACKUP_KEY='pacefold.spatial.notifications.v1';
let originalParent=null,originalNext=null,workbench=null,syncTimer=0,bridgeInstalled=false;
const $=selector=>document.querySelector(selector);
const id=value=>document.getElementById(value);
const create=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=String(text);return node};
const button=(className,label,text)=>{const node=create('button',className,text);node.type='button';node.setAttribute('aria-label',label);return node};
const parse=(value,fallback)=>{try{return value?JSON.parse(value):fallback}catch{return fallback}};
const rawPrefs=()=>{const value=parse(localStorage.getItem(PREFS_KEY),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}};
const core=()=>window.__PACEFOLD_MA_CORE__;
const permission=()=>typeof Notification==='undefined'?'unsupported':Notification.permission;
const report=(scope,error)=>{try{window.__PACEFOLD_RESILIENCE__?.recordError?.(`spatial-${scope}`,error)}catch{}};

if(new URLSearchParams(location.search).has('legacyAudit')){
  window.__PACEFOLD_HARDENING__={release:RELEASE,legacy:true};
  return;
}

function installPreferenceBridge(){
  const api=core();
  if(!api||bridgeInstalled||api.__pacefoldSpatialPreferenceBridge)return Boolean(api);
  const nativeGet=typeof api.getPrefs==='function'?api.getPrefs.bind(api):rawPrefs;
  const nativeUpdate=typeof api.updatePrefs==='function'?api.updatePrefs.bind(api):patch=>({...rawPrefs(),...patch});
  api.getPrefs=()=>({...nativeGet(),...rawPrefs()});
  api.updatePrefs=patch=>{
    const safe=patch&&typeof patch==='object'&&!Array.isArray(patch)?patch:{};
    const result=nativeUpdate(safe)||{};
    const next={...rawPrefs(),...result,...safe};
    try{localStorage.setItem(PREFS_KEY,JSON.stringify(next))}catch(error){report('preferences-write',error)}
    return next;
  };
  Object.defineProperty(api,'__pacefoldSpatialPreferenceBridge',{value:true});
  bridgeInstalled=true;
  return true;
}

function prefs(){
  installPreferenceBridge();
  try{return core()?.getPrefs?.()||rawPrefs()}catch{return rawPrefs()}
}

function writePrefs(patch,source='settings'){
  installPreferenceBridge();
  let next;
  try{
    const api=core();
    next=api?.updatePrefs?api.updatePrefs(patch):{...rawPrefs(),...patch};
    localStorage.setItem(PREFS_KEY,JSON.stringify({...rawPrefs(),...next,...patch}));
    window.dispatchEvent(new CustomEvent('pacefold:ma-prefs',{detail:{source:`spatial-${source}`}}));
    window.dispatchEvent(new CustomEvent('pacefold:storage-changed',{detail:{key:PREFS_KEY,source:`spatial-${source}`}}));
  }catch(error){report('preferences',error);showStatus('Could not save that setting',true);return rawPrefs()}
  sync();
  return next;
}

function notificationEnabled(value=prefs()){
  return value.notifications!==false&&(value.notificationMode||'quiet')!=='off'&&(value.browserNotif===true||value.taskbarBadge!==false||value.notifications===true);
}
function saveNotificationBackup(value){
  try{localStorage.setItem(BACKUP_KEY,JSON.stringify({notificationMode:value.notificationMode&&value.notificationMode!=='off'?value.notificationMode:'quiet',taskbarBadge:value.taskbarBadge!==false,browserNotif:value.browserNotif===true}))}catch{}
}
function notificationBackup(){
  const value=parse(localStorage.getItem(BACKUP_KEY),null);
  return value&&typeof value==='object'?value:{notificationMode:'quiet',taskbarBadge:true,browserNotif:false};
}
function setNotifications(enabled){
  const current=prefs();
  if(!enabled){
    saveNotificationBackup(current);
    writePrefs({notifications:false,browserNotif:false,notificationMode:'off',taskbarBadge:false,taskbarBadgeMode:'off'},'notifications');
    try{navigator.clearAppBadge?.()}catch{}
  }else{
    const backup=notificationBackup();
    writePrefs({notifications:true,notificationMode:backup.notificationMode||'quiet',taskbarBadge:backup.taskbarBadge!==false,taskbarBadgeMode:backup.taskbarBadge===false?'off':'due',browserNotif:backup.browserNotif===true&&permission()==='granted'},'notifications');
  }
  showStatus(enabled?'Notifications restored':'All notifications and badges are off');
  return true;
}
function toggleNotifications(){return setNotifications(!notificationEnabled())}

function heading(title,detail){
  const head=create('header','pf22-settings-panel-head');
  head.append(create('span','pf22-eyebrow',title),create('p','',detail));
  return head;
}
function controlRow(key,label,detail){
  const row=create('div','pf22-control-row');row.dataset.control=key;
  const copy=create('div','pf22-control-copy');copy.append(create('strong','',label),create('small','',detail));
  const toggle=button('pf22-control-toggle',`Toggle ${label}`,'');toggle.dataset.setting=key;
  row.append(copy,toggle);return row;
}
function actionButton(action,label,detail){
  const control=button('pf22-settings-action',label,'');control.dataset.action=action;
  const copy=create('span','');copy.append(create('strong','',label),create('small','',detail));
  control.append(copy,create('b','','›'));return control;
}
function buildSettings(){
  const layout=$('.pf22-settings-layout');
  if(!layout||layout.dataset.hardened===RELEASE)return Boolean(layout);
  layout.dataset.hardened=RELEASE;
  layout.replaceChildren();

  const rhythm=create('section','pf22-settings-panel pf22-settings-rhythm');
  rhythm.append(heading('Workday rhythm','Control the reminders that shape the day without opening the full setup.'));
  rhythm.append(
    controlRow('workReminders','Workday reminders','Prayer, meal, preparation and away cues'),
    controlRow('gazeEnabled','Eye breaks','Short distance-change prompts during desk work'),
    controlRow('bodyEnabled','Movement breaks','Gentle posture and movement prompts'),
    controlRow('weather','Weather','Show saved-location conditions on the Clock and Now faces')
  );

  const display=create('section','pf22-settings-panel pf22-settings-display');
  display.append(heading('Display & privacy','The controls you are most likely to change during the day.'));
  display.append(
    controlRow('quiet','Quiet mode','Hide labels, secondary faces and attention markers'),
    controlRow('seconds','Clock seconds','Keep the live seconds beside the main time'),
    controlRow('notifications','Notifications','System cues, taskbar dots and app badges together'),
    controlRow('timeFormat','Time format','Switch between a 12-hour and 24-hour clock')
  );

  const tools=create('section','pf22-settings-panel pf22-settings-tools');
  tools.append(heading('Data, schedule & sound','Backup and deeper configuration stay reachable without crowding the Clock.'));
  const actions=create('div','pf22-settings-actions');
  actions.append(
    actionButton('schedule','Schedule & day types','Weekday hours, Desk, Field, Half day and Off'),
    actionButton('backup','Backup notes','Choose or reconnect the protected local backup file'),
    actionButton('sound','Sound library','Local audio, playlists and the full player')
  );
  const status=create('div','pf22-settings-status','Saved automatically on this device');status.id='pf22-settings-status';
  const version=create('small','pf22-version',`Pacefold ${RELEASE} · verified offline core 15.2.2`);
  tools.append(actions,status,version);
  layout.append(rhythm,display,tools);
  return true;
}

function showStatus(message,error=false){
  const node=id('pf22-settings-status');if(!node)return;
  node.textContent=message;node.dataset.error=String(error);
  clearTimeout(node.__pacefoldTimer);
  node.__pacefoldTimer=setTimeout(()=>{if(node){node.textContent='Saved automatically on this device';delete node.dataset.error}},2200);
}

function toggleControl(key){
  try{
    const current=prefs();
    if(key==='quiet'){
      window.__PACEFOLD_MA_QUIET__?.toggle?.();
      setTimeout(()=>{sync();if(window.__PACEFOLD_MA_QUIET__?.get?.())window.__PACEFOLD_SPATIAL__?.home?.()},0);
      return;
    }
    if(key==='weather'){
      const state=window.__PACEFOLD_V21_PERSISTENCE__?.read?.()||{};
      const next=state.v21WeatherEnabled===false;
      window.__PACEFOLD_V21_PERSISTENCE__?.write?.({...state,v21WeatherEnabled:next});
      writePrefs({v21WeatherEnabled:next},'weather');
      showStatus(next?'Weather restored':'Weather hidden');
      return;
    }
    if(key==='notifications'){toggleNotifications();return}
    if(key==='seconds'){writePrefs({showSeconds:current.showSeconds===false},'seconds');return}
    if(key==='timeFormat'){writePrefs({timeFormat:current.timeFormat==='24'?'12':'24'},'time-format');return}
    if(['workReminders','gazeEnabled','bodyEnabled'].includes(key)){writePrefs({[key]:current[key]===false},key);return}
  }catch(error){report(`toggle-${key}`,error);showStatus('That control could not be changed',true)}
}

function proxyClick(selectors){
  for(const selector of selectors){const node=$(selector);if(node){node.click();return true}}
  return false;
}
function openSchedule(){
  const opened=proxyClick(['#brandButton','.corner']);
  if(opened)document.documentElement.classList.add('pf22-legacy-dialog-open');
  else showStatus('Full settings are unavailable in this window',true);
}
function openBackup(){
  if(!proxyClick(['.pf-v20-backup','[data-action="backup"]']))showStatus('Backup control is unavailable in this browser',true);
}

function overlay(){
  let root=id('pf22-sound-overlay');if(root)return root;
  root=create('section','pf22-sound-overlay');root.id='pf22-sound-overlay';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Pacefold sound controls');
  const dialog=create('div','pf22-sound-dialog');
  const head=create('header','pf22-sound-dialog-head');
  const copy=create('div','');copy.append(create('span','pf22-eyebrow','Sound'),create('h2','','Local sound controls'),create('p','','Your library stays inside Pacefold and on this device.'));
  const close=button('pf22-sound-close','Close sound controls','Close');close.addEventListener('click',closeSound);
  const mount=create('div','pf22-sound-mount');mount.id='pf22-sound-mount';
  head.append(copy,close);dialog.append(head,mount);root.append(dialog);
  root.addEventListener('click',event=>{if(event.target===root)closeSound()});
  id('pf22-spatial-root')?.append(root);return root;
}
function findWorkbench(){return id('pf-v19-workbench')||$('.pf-v19-workbench')}
function openSound(){
  const panel=overlay();workbench=findWorkbench();
  if(!workbench){window.__PACEFOLD_V19__?.reconcile?.();setTimeout(()=>{if(!openSound())showStatus('Sound controls are still loading',true)},100);return false}
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
  $('.pf22-settings-action[data-action="sound"]')?.focus?.({preventScroll:true});
}

function sync(){
  installPreferenceBridge();buildSettings();
  const root=id('pf22-spatial-root');if(!root)return;
  document.documentElement.dataset.pacefoldExperience=RELEASE;document.body.dataset.pacefoldExperience=RELEASE;root.dataset.hardening=RELEASE;
  const p=prefs(),weather=window.__PACEFOLD_V21_PERSISTENCE__?.read?.()||{};
  const values={
    quiet:Boolean(window.__PACEFOLD_MA_QUIET__?.get?.()||p.quietMode),
    seconds:p.showSeconds!==false,
    notifications:notificationEnabled(p),
    timeFormat:p.timeFormat==='24',
    workReminders:p.workReminders!==false,
    gazeEnabled:p.gazeEnabled!==false,
    bodyEnabled:p.bodyEnabled!==false,
    weather:weather.v21WeatherEnabled!==false&&p.v21WeatherEnabled!==false
  };
  const seconds=$('.pf22-seconds');if(seconds){seconds.hidden=!values.seconds;seconds.setAttribute('aria-hidden',String(!values.seconds))}
  for(const control of document.querySelectorAll('.pf22-control-toggle')){
    const key=control.dataset.setting,on=Boolean(values[key]);
    control.dataset.active=String(on);
    control.textContent=key==='timeFormat'?(on?'24h':'12h'):(on?'On':'Off');
    control.setAttribute('aria-pressed',String(on));
  }
  const version=$('.pf22-version');if(version)version.textContent=`Pacefold ${RELEASE} · verified offline core 15.2.2`;
  if(window.__PACEFOLD_SPATIAL__)window.__PACEFOLD_SPATIAL__.release=RELEASE;
  if(window.__PACEFOLD_VERSION__)window.__PACEFOLD_VERSION__={...window.__PACEFOLD_VERSION__,experience:RELEASE,update:RELEASE,hardening:'recovery-r2'};
  if(values.quiet)closeSound();
}

function capture(event){
  const target=event.target instanceof Element?event.target:null;if(!target)return;
  const control=target.closest('.pf22-control-toggle,.pf22-switch');
  if(control){event.preventDefault();event.stopImmediatePropagation();toggleControl(control.dataset.setting);return}
  const action=target.closest('.pf22-settings-action');
  if(action){
    event.preventDefault();event.stopImmediatePropagation();
    if(action.dataset.action==='schedule')openSchedule();
    if(action.dataset.action==='backup')openBackup();
    if(action.dataset.action==='sound')openSound();
  }
}
function initialize(){
  installPreferenceBridge();
  document.addEventListener('click',capture,true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!id('pf22-sound-overlay')?.hidden){event.preventDefault();event.stopImmediatePropagation();closeSound()}},true);
  for(const name of ['pacefold:ma-prefs','pacefold:spatial-ready','pacefold:storage-changed','pacefold:spatial-hardening','pacefold:quiet'])window.addEventListener(name,sync);
  window.addEventListener('storage',sync);
  sync();syncTimer=setInterval(sync,750);
  window.__PACEFOLD_HARDENING__={release:RELEASE,sync,setNotifications,toggleNotifications,notificationEnabled,openSound,closeSound,writePrefs,buildSettings};
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',initialize,{once:true}):initialize();
})();