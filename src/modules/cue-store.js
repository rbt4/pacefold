const DB_NAME='pacefold-v26';
const DB_VERSION=1;
const STORE='state';
const CUE_KEY='cueState';
const MIRROR_KEY='cueMirror';

function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

async function readValue(key){
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(key);
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  })}finally{db.close()}
}

async function writeValue(key,value){
  const db=await openDb();
  try{await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  })}finally{db.close()}
}

function normalizeCueState(value){
  const state=value&&typeof value==='object'?value:{};
  return{
    v:1,
    ack:state.ack&&typeof state.ack==='object'?state.ack:{},
    notified:state.notified&&typeof state.notified==='object'?state.notified:{},
    snoozeUntil:Number(state.snoozeUntil)||0
  };
}

export function installCueStore(ctx){
  ctx.readCueDb=()=>readValue(CUE_KEY);
  ctx.writeCueDb=value=>writeValue(CUE_KEY,normalizeCueState(value));
  ctx.writeCueMirror=value=>writeValue(MIRROR_KEY,{v:1,...value,savedAt:Date.now()});

  ctx.initCueStore=async()=>{
    try{
      const stored=normalizeCueState(await readValue(CUE_KEY));
      const local=normalizeCueState(ctx.cueState);
      const hasDb=Object.keys(stored.ack).length||Object.keys(stored.notified).length||stored.snoozeUntil;
      const merged=hasDb?{
        v:1,
        ack:{...local.ack,...stored.ack},
        notified:{...local.notified,...stored.notified},
        snoozeUntil:Math.max(local.snoozeUntil,stored.snoozeUntil)
      }:local;
      ctx.cueState=merged;
      await writeValue(CUE_KEY,merged);
      localStorage.setItem(ctx.KEYS.cueState,JSON.stringify(merged));
    }catch(error){console.warn('[Pacefold] cue IndexedDB unavailable',error)}
  };

  ctx.persistCueState=()=>{
    const state=normalizeCueState(ctx.cueState);
    ctx.cueState=state;
    localStorage.setItem(ctx.KEYS.cueState,JSON.stringify(state));
    void writeValue(CUE_KEY,state).catch(error=>console.warn('[Pacefold] cue state persistence failed',error));
  };

  ctx.syncCueMirror=()=>{
    try{
      const now=new Date(),range=ctx.workRange(ctx.prefs,now),part=ctx.zoneParts(now,ctx.prefs.timeZone);
      const workStart=ctx.zonedForToday(range.start,now).getTime(),workEnd=ctx.zonedForToday(range.end,now).getTime();
      const schedule=ctx.getSchedule(now).today.filter(item=>item.alert).map(item=>({
        source:'prayer',key:`prayer:${ctx.todayKey(item.date)}:${item.id}`,label:item.label,
        detail:`${item.label} · ${ctx.formatTime(item.date)}`,priority:100,dueAt:item.date.getTime()
      }));
      const timers={
        prep:{start:Number(ctx.prefs.noodleStart)||0,duration:ctx.prefs.prepMinutes*60000,label:'Preparation ready',detail:'Your preparation timer is complete',priority:90},
        away:{start:Number(ctx.prefs.awayStart)||0,duration:ctx.prefs.awayMinutes*60000,label:'Return when ready',detail:'The away timer is complete',priority:76},
        meal:{start:Number(ctx.prefs.lunchStart)||0,duration:ctx.prefs.mealMinutes*60000,label:'Meal window complete',detail:'Return when you are ready',priority:80}
      };
      void ctx.writeCueMirror({
        notifications:Boolean(ctx.prefs.notifications),quietMode:Boolean(ctx.prefs.quietMode),timeZone:ctx.prefs.timeZone,
        activeDay:Boolean(range.activeDay),workStart,workEnd,
        water:{current:Number(ctx.prefs.waterOz??ctx.prefs.waterSips)||0,target:Number(ctx.prefs.waterTarget)||24,lastAt:Number(ctx.prefs.waterLastAt)||workStart,cadence:Number(ctx.prefs.waterCadence)*60000},
        eyes:{lastAt:Number(ctx.prefs.gazeLastCompleted)||workStart,cadence:Number(ctx.prefs.eyeCadence)*60000},
        move:{lastAt:Number(ctx.prefs.bodyLastCompleted)||workStart,cadence:Number(ctx.prefs.bodyCadence)*60000},
        schedule,timers,mirroredAt:{hour:part.hour,minute:part.minute}
      });
    }catch(error){console.warn('[Pacefold] cue mirror failed',error)}
  };

  ctx.registerPeriodicCueSync=async()=>{
    try{
      const registration=await navigator.serviceWorker?.ready;
      if(!registration||!('periodicSync'in registration))return false;
      if(navigator.permissions?.query){
        try{
          const permission=await navigator.permissions.query({name:'periodic-background-sync'});
          if(permission.state==='denied')return false;
        }catch{}
      }
      await registration.periodicSync.register('pacefold-cues',{minInterval:15*60*1000});
      return true;
    }catch(error){
      console.info('[Pacefold] periodic cue sync unavailable',error?.name||error);
      return false;
    }
  };
}
