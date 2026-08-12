const CUE_STATE_KEY='pacefold.cues.v25';
const APP_ICON_NAMES={water:'water',prayer:'prayer',prep:'prepare',away:'away',meal:'meal',eyes:'eyes',move:'move'};

function readCueState(){
  try{return JSON.parse(localStorage.getItem(CUE_STATE_KEY)||'{}')||{}}
  catch{return{}}
}

function applySnoozeFromLaunch(){
  const url=new URL(location.href);
  if(url.searchParams.get('cueAction')!=='snooze')return;
  const state=readCueState();
  state.ack=state.ack&&typeof state.ack==='object'?state.ack:{};
  state.notified=state.notified&&typeof state.notified==='object'?state.notified:{};
  state.snoozeUntil=Date.now()+10*60*1000;
  localStorage.setItem(CUE_STATE_KEY,JSON.stringify(state));
  url.searchParams.delete('cueAction');
  history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`);
}

function installNotificationOptions(){
  const proto=globalThis.ServiceWorkerRegistration?.prototype;
  const original=proto?.showNotification;
  if(!proto||typeof original!=='function'||original.__pacefoldV26)return;

  async function showPacefoldNotification(title,options={}){
    const source=options?.data?.source;
    const iconName=APP_ICON_NAMES[source];
    const icon=iconName?new URL(`./icons/notify-${iconName}-128.png`,location.href).href:options.icon;
    const badge=new URL('./icons/badge-96.png',location.href).href;
    return original.call(this,title,{
      ...options,
      icon,
      badge,
      actions:[
        {action:'ack',title:'Clear'},
        {action:'snooze',title:'Snooze 10m'}
      ]
    });
  }

  showPacefoldNotification.__pacefoldV26=true;
  proto.showNotification=showPacefoldNotification;
}

applySnoozeFromLaunch();
installNotificationOptions();
