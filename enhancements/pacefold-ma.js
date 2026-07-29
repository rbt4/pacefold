(() => {
  'use strict';

  const RELEASE='20.0.1';
  const STORAGE_KEY='pacefoldPrefsV15';
  const NOTES_KEY='pacefold.notebook.entries.v2';
  const CATEGORIES_KEY='pacefold.notebook.categories.v1';
  const PLAYLIST_KEY='pacefold.player.playlists.v1';
  const STREAM_KEY='pacefold.player.streaming-links.v1';
  const DAY_TYPES=['desk','field','half','off'];
  const DAY_LABELS={desk:'Desk',field:'Field',half:'Half day',off:'Off'};
  const SOURCES=['water','noodle','away','lunch','eyes','body'];
  const PRIORITY={prayer:5,lunch:5,noodle:4,away:4,water:3,eyes:2,body:1};
  const DURATION_PRESETS=[5,8,10,15,20,30,45,60];
  const nativeSetBadge=typeof navigator.setAppBadge==='function'?navigator.setAppBadge.bind(navigator):null;
  const nativeClearBadge=typeof navigator.clearAppBadge==='function'?navigator.clearAppBadge.bind(navigator):null;
  const bootPrefs=readPrefs();
  const bootLastSeenAt=Number(bootPrefs.lastSeenAt)||0;
  let ribbonKey='';
  let ribbonMinute=-1;
  let statusOverride=null;
  let lastMinuteValue='';
  let lastInteractionAt=Date.now();
  let hiddenAt=0;
  let reconciledAt=0;
  let quietObserver=null;
  let panelObserver=null;
  let statusObserver=null;
  let reviewTimer=0;
  let lightTimer=0;
  let lightTheme='';
  let storageText='Stored locally';
  const quietText=new Map();
  const quietAttributes=new Map();

  function safeJSON(value,fallback=null){try{return JSON.parse(value||'null')??fallback;}catch{return fallback;}}
  function readPrefs(){try{const value=safeJSON(localStorage.getItem(STORAGE_KEY),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
  function writePrefs(value){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));return true;}catch{return false;}}
  function clamp(value,min,max,fallback){value=Number(value);return Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;}
  function localDate(value=new Date()){const date=value instanceof Date?value:new Date(value),offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,10);}
  function parseHours(value='08:30-16:30'){const match=String(value).match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);if(!match)return{start:8.5,end:16.5,startText:'08:30',endText:'16:30'};const start=Number(match[1])+Number(match[2])/60,end=Number(match[3])+Number(match[4])/60;return{start,end,startText:`${match[1]}:${match[2]}`,endText:`${match[3]}:${match[4]}`};}
  function timeText(value,fallback){return/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value||''))?String(value):fallback;}
  function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=String(text);return node;}
  function setButton(button,label){button.type='button';button.textContent=label;return button;}
  function emitPrefs(){window.dispatchEvent(new CustomEvent('pacefold:ma-prefs'));}

  function defaultWeek(workHours,workdaysOnly=true){
    const range=parseHours(workHours),week={};
    for(let day=0;day<7;day+=1)week[day]={start:range.startText,end:range.endText,type:!workdaysOnly||day>=1&&day<=5?'desk':'off'};
    return week;
  }
  function normalizeWeek(value,workHours,workdaysOnly=true){
    const fallback=defaultWeek(workHours,workdaysOnly),source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const week={};
    for(let day=0;day<7;day+=1){
      const row=source[day]||source[String(day)]||fallback[day],type=DAY_TYPES.includes(String(row?.type||'').toLowerCase())?String(row.type).toLowerCase():fallback[day].type;
      week[day]={start:timeText(row?.start,fallback[day].start),end:timeText(row?.end,fallback[day].end),type};
    }
    return week;
  }
  function migratePrefs(){
    const before=readPrefs(),next={...before};
    const migrations=[
      prefs=>{
        prefs.schemaVersion=18;
        prefs.minCueGap=clamp(prefs.minCueGap,1,30,4);
        prefs.focusGraceMinutes=clamp(prefs.focusGraceMinutes,5,120,25);
        prefs.workWeek=normalizeWeek(prefs.workWeek,prefs.workHours,prefs.workdaysOnly!==false);
        prefs.todayOverride=prefs.todayOverride&&typeof prefs.todayOverride==='object'?prefs.todayOverride:null;
        prefs.quietMode=Boolean(prefs.quietMode);
        prefs.quietRestore=prefs.quietRestore&&typeof prefs.quietRestore==='object'?prefs.quietRestore:null;
        prefs.skipToday=prefs.skipToday&&typeof prefs.skipToday==='object'?prefs.skipToday:{};
        prefs.waferLaunches=clamp(prefs.waferLaunches,0,3,0);
        prefs.waferPromptDismissed=Boolean(prefs.waferPromptDismissed);
        prefs.foldReviewDismissed=Boolean(prefs.foldReviewDismissed);
        prefs.foldReviewLastDate=typeof prefs.foldReviewLastDate==='string'?prefs.foldReviewLastDate:'';
        prefs.storagePersistAsked=Boolean(prefs.storagePersistAsked);
        prefs.maLastCueAt=clamp(prefs.maLastCueAt,0,Number.MAX_SAFE_INTEGER,0);
        prefs.waitingCue=prefs.waitingCue&&typeof prefs.waitingCue==='object'?prefs.waitingCue:null;
        prefs.awaySnoozedUntil=clamp(prefs.awaySnoozedUntil,0,Number.MAX_SAFE_INTEGER,0);
        return prefs;
      }
    ];
    let version=Number(next.schemaVersion)||17;
    while(version<18){next.schemaVersion=version;migrations[version-17](next);version=Number(next.schemaVersion)||version+1;}
    if(JSON.stringify(next)!==JSON.stringify(before))writePrefs(next);
    return next;
  }
  migratePrefs();

  function getPrefs(){return window.__PACEFOLD_MA_CORE__?.getPrefs?.()||readPrefs();}
  function patchPrefs(patch){
    if(!patch||typeof patch!=='object')return getPrefs();
    if(window.__PACEFOLD_MA_CORE__?.updatePrefs){
      const result=window.__PACEFOLD_MA_CORE__.updatePrefs(patch);
      emitPrefs();
      return result||getPrefs();
    }
    const next={...readPrefs(),...patch};
    writePrefs(next);emitPrefs();return next;
  }
  function resolvedDay(date=new Date(),prefs=getPrefs()){
    const week=normalizeWeek(prefs.workWeek,prefs.workHours,prefs.workdaysOnly!==false),row=week[date.getDay()]||defaultWeek(prefs.workHours,prefs.workdaysOnly!==false)[date.getDay()],override=prefs.todayOverride;
    let type=row.type;
    if(override&&override.date===localDate(date)&&DAY_TYPES.includes(override.type))type=override.type;
    const startText=timeText(row.start,parseHours(prefs.workHours).startText),endText=timeText(row.end,parseHours(prefs.workHours).endText);
    let start=parseHours(`${startText}-${endText}`).start,end=parseHours(`${startText}-${endText}`).end;
    if(type==='half'&&end>start+3)end=start+(end-start)/2;
    return{type,start,end,startText,endText};
  }
  function skipped(source,prefs=getPrefs(),date=new Date()){return prefs.skipToday?.[source]===localDate(date);}

  function createScheduler(){
    const pending=new Map(),delivered=new Set();
    let lastDeliveredAt=Number(readPrefs().maLastCueAt)||0,timer=0,badgeKey='';
    const schedule=delay=>{clearTimeout(timer);timer=setTimeout(pump,Math.max(0,Math.min(2147483647,delay)));};
    const waiting=item=>patchPrefs({waitingCue:item?{key:item.key,source:item.source,requestedAt:item.requestedAt,expiresAt:item.expiresAt,deferred:item.deferred}:null});
    const staleFocus=prefs=>document.hidden&&Date.now()-lastInteractionAt>prefs.focusGraceMinutes*60000;
    async function pump(){
      timer=0;
      const now=Date.now(),prefs=getPrefs(),items=[...pending.values()].filter(item=>item.expiresAt>now).sort((a,b)=>b.priority-a.priority||a.requestedAt-b.requestedAt);
      for(const item of [...pending.values()])if(item.expiresAt<=now)pending.delete(item.key);
      if(!items.length){waiting(null);return;}
      const item=items[0];
      if(['water','eyes','body'].includes(item.source)&&staleFocus(prefs)){pending.delete(item.key);delivered.add(item.key);waiting(null);return;}
      const gap=Math.max(1,Number(prefs.minCueGap)||4)*60000,remaining=lastDeliveredAt?gap-(now-lastDeliveredAt):0;
      if(remaining>0){
        if(item.deferred){pending.delete(item.key);delivered.add(item.key);waiting(null);queueMicrotask(pump);return;}
        item.deferred=true;item.dueAt=now+remaining;waiting(item);schedule(Math.min(remaining,Math.max(0,item.expiresAt-now)));return;
      }
      pending.delete(item.key);
      const deliver=window.__PACEFOLD_MA_DELIVER__;
      if(typeof deliver!=='function'){pending.set(item.key,item);schedule(80);return;}
      const ok=await deliver(item.key,item.text,item.source,false,item.specOnly);
      delivered.add(item.key);
      if(ok){
        lastDeliveredAt=Date.now();
        patchPrefs({maLastCueAt:lastDeliveredAt,waitingCue:null});
      }else waiting(null);
      queueMicrotask(pump);
    }
    function request(key,text,source='prayer',test=false,specOnly=false){
      if(test)return false;
      const prefs=getPrefs(),now=Date.now(),safeSource=PRIORITY[source]?source:'prayer';
      const day=resolvedDay(new Date(),prefs);
      if(day.type==='field'&&!['prayer','lunch','water'].includes(safeSource)){delivered.add(key);return false;}
      if(skipped(safeSource,prefs)||delivered.has(key)||pending.has(key))return false;
      if(safeSource==='away'&&Number(prefs.awaySnoozedUntil)>now)return false;
      if(['water','eyes','body'].includes(safeSource)&&staleFocus(prefs)){delivered.add(key);return false;}
      const item={key:String(key),text:String(text||''),source:safeSource,specOnly:Boolean(specOnly),priority:PRIORITY[safeSource],requestedAt:now,expiresAt:now+Math.max(5,Number(prefs.dueWindow)||18)*60000,deferred:false,dueAt:now};
      pending.set(item.key,item);waiting(item);queueMicrotask(pump);return true;
    }
    async function clearSurface(){
      try{await nativeClearBadge?.();}catch{}
      try{const registration=await navigator.serviceWorker?.getRegistration?.(),items=await registration?.getNotifications?.();for(const item of items||[])if(String(item.tag||'').startsWith('pacefold-'))item.close();}catch{}
      badgeKey='';
    }
    async function setManualBadge(value){
      const prefs=getPrefs();
      if(prefs.quietMode||prefs.taskbarBadge===false||prefs.taskbarBadgeMode==='off')return clearSurface();
      try{return value==null?await nativeSetBadge?.():await nativeSetBadge?.(value);}catch{return undefined;}
    }
    function minutesUntil(states){
      const candidates=[],now=Date.now();
      if(states?.water?.nextAt&&states?.h!=null)candidates.push((states.water.nextAt-states.h)*60);
      if(states?.noodle?.remain>0)candidates.push(states.noodle.remain/60000);
      if(states?.lunch?.remain>0)candidates.push(states.lunch.remain/60000);
      if(states?.gaze?.remaining>0)candidates.push(states.gaze.remaining/60000);
      if(states?.body?.remaining>0)candidates.push(states.body.remaining/60000);
      const value=candidates.filter(item=>Number.isFinite(item)&&item>0).sort((a,b)=>a-b)[0];
      return now&&value&&value<=99?Math.max(1,Math.ceil(value)):0;
    }
    function updateBadge(attention,states){
      const prefs=getPrefs(),mode=prefs.taskbarBadgeMode||'due';
      if(prefs.quietMode||mode==='off'||prefs.taskbarBadge===false){if(badgeKey!=='clear'){badgeKey='clear';void clearSurface();}return true;}
      const flowWaiting=Boolean(document.querySelector('[data-pf-flow-pulse][data-state="new"]'));
      const waitingNow=Boolean(flowWaiting||attention&&(['due','pending'].includes(attention.signal)||(attention.signal==='active'&&['prayer','away','body'].includes(attention.source)))),minutes=mode==='countdown'&&!waitingNow?minutesUntil(states):0,key=waitingNow?`waiting:${flowWaiting?'flow':attention.source}`:minutes?`next:${minutes}`:'clear';
      if(key===badgeKey)return true;badgeKey=key;
      if(waitingNow)void setManualBadge();else if(minutes)void setManualBadge(minutes);else void clearSurface();
      return true;
    }
    function reanchor(){
      for(const [key,item] of pending)if(['water','eyes','body'].includes(item.source))pending.delete(key);
      waiting([...pending.values()][0]||null);
    }
    return{request,updateBadge,setManualBadge,clear:clearSurface,reanchor,_pending:pending,_nativeSetBadge:nativeSetBadge,_nativeClearBadge:nativeClearBadge};
  }
  const scheduler=createScheduler();
  window.__PACEFOLD_MA_SCHEDULER__=scheduler;
  try{Object.defineProperty(navigator,'setAppBadge',{configurable:true,writable:true,value:value=>scheduler.setManualBadge(value)});}catch{}
  try{Object.defineProperty(navigator,'clearAppBadge',{configurable:true,writable:true,value:()=>scheduler.clear()});}catch{}

  function ribbonPercent(value,start,end){return Math.max(0,Math.min(1,(value-start)/Math.max(.01,end-start)));}
  function dateHours(value){const date=new Date(Number(value)||value);return date.getHours()+date.getMinutes()/60+date.getSeconds()/3600;}
  function setRibbonVar(node,name,value){node.style.setProperty(name,value);}
  function showRibbonLabel(label){
    const prefs=getPrefs(),safe=prefs.privacy||prefs.quietMode?'Scheduled moment':String(label||'Scheduled moment');
    statusOverride={word:safe,time:'',relative:'',name:'',until:Date.now()+4000};
    applyStatus();
  }
  function makeRibbonPart(className){return el('span',className);}
  function renderRibbon({h,state,rows,range,dayType}={}){
    const sequence=document.getElementById('sequence');if(!sequence)return false;
    const prefs=getPrefs(),day=resolvedDay(new Date(),prefs),start=Number(range?.start??day.start),end=Number(range?.end??day.end),type=dayType||day.type,minute=Math.floor(Date.now()/60000),minuteNow=minute*60000,privateRibbon=Boolean(prefs.privacy||prefs.quietMode);
    const sessions=[...(prefs.awaySessions||[]).map(item=>({...item,kind:'away'})),...(prefs.prayerSessions||[]).map(item=>({...item,kind:'prayer'})),...(prefs.lunchSessions||[]).map(item=>({...item,kind:item.mode==='away'?'away-lunch':'meal'}))];
    if(prefs.awayStart)sessions.push({start:prefs.awayStart,end:minuteNow,kind:'away'});
    if(prefs.prayerBreakStart)sessions.push({start:prefs.prayerBreakStart,end:minuteNow,kind:'prayer'});
    if(prefs.lunchStart)sessions.push({start:prefs.lunchStart,end:minuteNow,kind:prefs.lunchModeAtStart==='away'?'away-lunch':'meal'});
    if(prefs.noodleStart)sessions.push({start:prefs.noodleStart,end:minuteNow,kind:'prep'});
    const dataKey=JSON.stringify({start,end,type,rows:(rows||[]).map(item=>[item.id,Number(item.time).toFixed(4),privateRibbon?'':item.label]),sessions:sessions.map(item=>[item.start,item.end,privateRibbon?'interval':item.kind]),quiet:privateRibbon});
    if(sequence.dataset.pfMaRibbon!=='true'||dataKey!==ribbonKey||minute!==ribbonMinute){
      const fragment=document.createDocumentFragment(),track=makeRibbonPart('pf-ribbon-track'),spent=makeRibbonPart('pf-ribbon-spent'),field=makeRibbonPart('pf-ribbon-field');
      fragment.append(track,spent,field);
      for(let tick=Math.ceil(start);tick<end;tick+=1){const mark=makeRibbonPart('pf-ribbon-hour');setRibbonVar(mark,'--pf-ribbon-x',`${(ribbonPercent(tick,start,end)*100).toFixed(3)}%`);fragment.append(mark);}
      for(const item of rows||[]){
        if(!Number.isFinite(Number(item.time))||item.time<start||item.time>end)continue;
        const crease=setButton(el('button','pf-ribbon-crease'),'');
        crease.dataset.kind='moment';
        crease.setAttribute('aria-label',privateRibbon?'Scheduled crease':String(item.label||'Scheduled moment'));
        setRibbonVar(crease,'--pf-ribbon-x',`${(ribbonPercent(Number(item.time),start,end)*100).toFixed(3)}%`);
        crease.addEventListener('click',()=>showRibbonLabel(item.label));
        crease.addEventListener('mouseenter',()=>showRibbonLabel(item.label));
        fragment.append(crease);
      }
      for(const item of sessions){
        const from=dateHours(item.start),to=dateHours(item.end),left=ribbonPercent(from,start,end),right=ribbonPercent(to,start,end);
        if(right<=0||left>=1||right<=left)continue;
        const band=makeRibbonPart('pf-ribbon-band');band.dataset.kind=privateRibbon?'interval':item.kind;
        setRibbonVar(band,'--pf-ribbon-start',`${(left*100).toFixed(3)}%`);
        setRibbonVar(band,'--pf-ribbon-span',String(Math.max(.001,right-left)));
        fragment.append(band);
        if(item.kind==='meal'){
          const meal=setButton(el('button','pf-ribbon-crease'),'');meal.dataset.kind=privateRibbon?'moment':'meal';meal.setAttribute('aria-label',privateRibbon?'Scheduled crease':'Meal');
          setRibbonVar(meal,'--pf-ribbon-x',`${(left*100).toFixed(3)}%`);meal.addEventListener('click',()=>showRibbonLabel('Meal'));meal.addEventListener('mouseenter',()=>showRibbonLabel('Meal'));fragment.append(meal);
        }
      }
      const now=makeRibbonPart('pf-ribbon-now');now.dataset.pfRibbonNow='true';fragment.append(now);
      sequence.replaceChildren(fragment);sequence.classList.add('pf-day-ribbon');sequence.dataset.pfMaRibbon='true';
      sequence.dataset.private=String(privateRibbon);
      sequence.style.setProperty('--pf-ribbon-progress',String(ribbonPercent(Math.floor(Number(h)*60)/60,start,end)));
      ribbonKey=dataKey;ribbonMinute=minute;
    }
    const now=sequence.querySelector('[data-pf-ribbon-now]');if(now)setRibbonVar(now,'--pf-ribbon-x',`${(ribbonPercent(Number(h),start,end)*100).toFixed(4)}%`);
    document.body.dataset.dayType=type;
    return true;
  }
  function setMinute(node,value){
    value=String(value).padStart(2,'0').slice(-2);
    if(!node)return false;
    let digits=[...node.querySelectorAll('.pf-minute-digit')];
    if(digits.length!==2){
      digits=value.split('').map(character=>el('span','pf-minute-digit',character));
      node.replaceChildren(...digits);lastMinuteValue=value;return true;
    }
    value.split('').forEach((character,index)=>{
      if(digits[index].textContent===character)return;
      digits[index].textContent=character;
      digits[index].classList.remove('is-folding');
      if(!document.documentElement.classList.contains('pf-boot'))queueMicrotask(()=>digits[index]?.classList.add('is-folding'));
      setTimeout(()=>digits[index]?.classList.remove('is-folding'),260);
    });
    lastMinuteValue=value;return true;
  }
  function setSecondProgress(value){document.documentElement.style.setProperty('--pf-second-progress',String(Math.max(0,Math.min(1,(Number(value)||0)/59))));return true;}
  function applyStatus(){
    if(!statusOverride||Date.now()>statusOverride.until){statusOverride=null;return false;}
    const word=document.getElementById('statusWord'),time=document.getElementById('eventTime'),relative=document.getElementById('relativeTime'),name=document.getElementById('eventName');
    for(const [node,value] of [[word,statusOverride.word],[time,statusOverride.time||''],[relative,statusOverride.relative||''],[name,statusOverride.name||'']])
      if(node&&node.textContent!==value)node.textContent=value;
    return true;
  }
  function installStatusGuard(){
    const status=document.getElementById('statusLine');if(!status)return;
    statusObserver?.disconnect();
    statusObserver=new MutationObserver(()=>{if(statusOverride&&Date.now()<=statusOverride.until)queueMicrotask(applyStatus);});
    statusObserver.observe(status,{childList:true,subtree:true,characterData:true});
  }
  window.__PACEFOLD_MA_VIEW__={renderRibbon,setMinute,setSecondProgress,applyStatus};

  function initializeMeters(){
    const items=[
      [document.getElementById('waterMeter'),'fill','water'],
      [document.getElementById('noodleRing'),'arc','noodle'],
      [document.querySelector('#awayBtn .away-glyph'),'bar','away'],
      [document.getElementById('lunchMeter'),'bar','lunch'],
      [document.querySelector('#eyesBtn .eye-glyph'),'arc','eyes'],
      [document.querySelector('#careBtn .care-glyph'),'arc','body']
    ];
    for(const [node,shape,source] of items){if(!node)continue;node.classList.add('pf-meter');node.dataset.shape=shape;node.dataset.source=source;}
  }

  function updateDayType(){
    const button=document.getElementById('pf-day-type'),day=resolvedDay();
    document.body.dataset.dayType=day.type;
    if(button){button.textContent=DAY_LABELS[day.type];button.setAttribute('aria-label',`Today is ${DAY_LABELS[day.type]}. Click to change today only.`);}
  }
  function installDayType(){
    if(document.getElementById('pf-day-type'))return;
    const status=document.getElementById('statusLine');if(!status)return;
    const button=setButton(el('button','pf-day-type'),'Desk');button.id='pf-day-type';
    button.addEventListener('click',event=>{event.stopPropagation();const day=resolvedDay(),next=DAY_TYPES[(DAY_TYPES.indexOf(day.type)+1)%DAY_TYPES.length];patchPrefs({todayOverride:{date:localDate(),type:next}});updateDayType();ribbonKey='';});
    status.insertAdjacentElement('afterend',button);updateDayType();
  }
  function showWeekEditor(){
    const prefs=getPrefs(),week=normalizeWeek(prefs.workWeek,prefs.workHours,prefs.workdaysOnly!==false),modal=createModal('Workweek','Set hours and day type for each weekday.'),grid=el('div','pf-week-grid');
    const names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for(let day=0;day<7;day+=1){
      const label=el('label','',names[day]),start=el('input'),end=el('input'),type=el('select');
      start.type='time';start.value=week[day].start;start.dataset.day=String(day);start.dataset.field='start';
      end.type='time';end.value=week[day].end;end.dataset.day=String(day);end.dataset.field='end';
      for(const id of DAY_TYPES){const option=el('option','',DAY_LABELS[id]);option.value=id;option.selected=week[day].type===id;type.append(option);}
      type.dataset.day=String(day);type.dataset.field='type';grid.append(label,start,end,type);
    }
    modal.card.append(grid);
    const actions=modal.actions,save=setButton(el('button','primary'),'Save week'),cancel=setButton(el('button'),'Cancel');
    cancel.addEventListener('click',modal.close);
    save.addEventListener('click',()=>{
      const next=normalizeWeek(week,prefs.workHours,prefs.workdaysOnly!==false);
      for(const control of grid.querySelectorAll('[data-day]'))next[control.dataset.day][control.dataset.field]=control.value;
      patchPrefs({workWeek:normalizeWeek(next,prefs.workHours)});updateDayType();ribbonKey='';modal.close();
    });
    actions.append(cancel,save);modal.open();
  }

  function createModal(title,description){
    const root=el('div','pf-modal');root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
    const card=el('section','pf-modal-card'),heading=el('h2','',title),copy=el('p','',description),actions=el('div','pf-modal-actions');
    card.append(heading,copy,actions);root.append(card);document.body.append(root);
    const close=()=>{root.remove();},open=()=>{root.hidden=false;card.querySelector('button,input,select')?.focus();};
    root.addEventListener('click',event=>{if(event.target===root)close();});
    return{root,card,actions,close,open};
  }

  function applyQuietState(){
    const prefs=getPrefs(),on=Boolean(prefs.quietMode);
    document.body.dataset.quiet=String(on);document.documentElement.dataset.pfQuiet=String(on);
    const toggle=document.getElementById('pf-quiet-toggle');if(toggle){toggle.textContent=on?'Quiet on':'Quiet';toggle.setAttribute('aria-pressed',String(on));}
    if(on){document.title='Clock';void scheduler.clear();sanitizeQuietDom();}
    else restoreQuietDom();
  }
  function sanitizeQuietDom(){
    if(!getPrefs().quietMode)return;
    const sensitive=/\b(?:fajr|sunrise|dhuhr|asr|maghrib|isha|prayer|moment|water|sip|noodle|prep|lunch|meal|away|eye|movement|body|inbox|follow-ups?|incidents?|inspections?|jhsc|construction|notifications?|resources?)\b/i;
    const privateScope=node=>node.parentElement?.closest('#pf-local-workspace,#pf-local-player,#panel,#foldDrawer,#toast,#onboarding');
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode()){
      if(!node.nodeValue?.trim()||(!privateScope(node)&&!sensitive.test(node.nodeValue)))continue;
      if(!quietText.has(node))quietText.set(node,node.nodeValue);
      node.nodeValue='';
    }
    for(const node of document.querySelectorAll('[aria-label],[title]')){
      for(const name of ['aria-label','title']){
        const value=node.getAttribute(name);if(!value||value==='Quiet control'||(!node.closest('#pf-local-workspace,#pf-local-player,#panel,#foldDrawer,#toast,#onboarding')&&!sensitive.test(value)))continue;
        const key=`${name}`;if(!quietAttributes.has(node))quietAttributes.set(node,{});
        const stored=quietAttributes.get(node);if(!(key in stored))stored[key]=value;
        node.setAttribute(name,'Quiet control');
      }
    }
    const eventName=document.getElementById('eventName');if(eventName)eventName.textContent='';
    const toast=document.getElementById('toast');if(toast)toast.textContent='';
  }
  function restoreQuietDom(){
    for(const [node,value] of quietText){if(node.isConnected&&node.nodeValue==='')node.nodeValue=value;}
    quietText.clear();
    for(const [node,values] of quietAttributes){if(node.isConnected)for(const [name,value] of Object.entries(values))node.setAttribute(name,value);}
    quietAttributes.clear();
    window.__PACEFOLD_MA_CORE__?.render?.();
  }
  function setQuiet(on){
    const prefs=getPrefs();
    if(on&&!prefs.quietMode){
      const restore={privacy:prefs.privacy,clarity:prefs.clarity,notificationDetail:prefs.notificationDetail,taskbarBadge:prefs.taskbarBadge,taskbarBadgeMode:prefs.taskbarBadgeMode,notificationMode:prefs.notificationMode};
      patchPrefs({quietMode:true,quietRestore:restore,privacy:true,clarity:'discreet',notificationDetail:'generic',taskbarBadge:false,taskbarBadgeMode:'off',notificationMode:'quiet'});
    }else if(!on&&prefs.quietMode){
      const restore=prefs.quietRestore||{};
      patchPrefs({quietMode:false,quietRestore:null,privacy:restore.privacy??prefs.privacy,clarity:['clear','discreet','wafer'].includes(restore.clarity)?restore.clarity:'discreet',notificationDetail:restore.notificationDetail||'generic',taskbarBadge:restore.taskbarBadge??true,taskbarBadgeMode:restore.taskbarBadgeMode||'due',notificationMode:restore.notificationMode||'quiet'});
    }
    applyQuietState();ribbonKey='';
  }
  function installQuiet(){
    if(document.getElementById('pf-quiet-toggle'))return;
    const shell=document.querySelector('main .clock-shell');if(!shell)return;
    const button=setButton(el('button','pf-quiet-toggle'),'Quiet');button.id='pf-quiet-toggle';button.setAttribute('aria-pressed','false');
    button.addEventListener('click',event=>{event.stopPropagation();setQuiet(!getPrefs().quietMode);});
    shell.append(button);applyQuietState();
    quietObserver=new MutationObserver(()=>{if(getPrefs().quietMode)queueMicrotask(sanitizeQuietDom);});
    quietObserver.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-label','title']});
  }

  function installOptions(){
    if(!document.getElementById('workline'))return;
    for(const source of SOURCES){
      const button=document.getElementById({water:'waterBtn',noodle:'noodleBtn',away:'awayBtn',lunch:'lunchBtn',eyes:'eyesBtn',body:'careBtn'}[source]);if(!button||button.closest('.pf-ritual-slot'))continue;
      const slot=el('span','pf-ritual-slot');slot.dataset.source=source;button.parentNode.insertBefore(slot,button);slot.append(button);
      const more=setButton(el('button','pf-ritual-options'),'⌄');more.setAttribute('aria-label',`Open ${source} options`);more.dataset.source=source;slot.append(more);
      more.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openOptions(source,more);});
      button.addEventListener('click',event=>{if(!skipped(source))return;const active=source==='away'&&Number(getPrefs().awayStart)||source==='noodle'&&Number(getPrefs().noodleStart)||source==='lunch'&&Number(getPrefs().lunchStart);if(active)return;event.preventDefault();event.stopImmediatePropagation();statusOverride={word:'Skipped today',time:'',relative:'',name:'',until:Date.now()+3000};applyStatus();},true);
    }
    if(!document.getElementById('pf-options-menu')){
      const menu=el('div','pf-options-menu');menu.id='pf-options-menu';menu.hidden=true;menu.setAttribute('role','menu');document.body.append(menu);
      menu.addEventListener('click',handleOption);
      document.addEventListener('click',event=>{if(!menu.hidden&&!menu.contains(event.target))closeOptions();});
      document.addEventListener('keydown',event=>{if(event.key==='Escape')closeOptions();});
    }
  }
  function optionButton(label,action,value){const button=setButton(el('button'),label);button.dataset.optionAction=action;if(value!=null)button.dataset.value=String(value);return button;}
  function openOptions(source,anchor){
    const menu=document.getElementById('pf-options-menu');if(!menu)return;menu.replaceChildren();menu.dataset.source=source;
    menu.append(el('strong','',source==='noodle'?'Preparation':source[0].toUpperCase()+source.slice(1)));
    const grid=el('div','pf-options-grid');
    if(source==='water'||source==='eyes'){for(const value of [20,30,40])grid.append(optionButton(`${value}m`,'cadence',value));}
    else if(source==='body'){for(const value of [30,45,60,90])grid.append(optionButton(`${value}m`,'cadence',value));}
    else if(source==='noodle'||source==='lunch'){for(const value of DURATION_PRESETS)grid.append(optionButton(`${value}m`,'duration',value));}
    if(grid.children.length)menu.append(grid);
    if(source==='lunch'){
      const modes=el('div','pf-options-actions');modes.append(optionButton('Desk meal','mode','desk'),optionButton('Away lunch','mode','away'));menu.append(modes);
    }
    const actions=el('div','pf-options-actions');actions.append(optionButton('Snooze','snooze'),optionButton(skipped(source)?'Use today':'Skip today','skip'));menu.append(actions);
    menu.hidden=false;
    const box=anchor.getBoundingClientRect(),width=Math.min(254,window.innerWidth-16),left=Math.max(8,Math.min(window.innerWidth-width-8,box.left+box.width-width)),top=Math.max(8,Math.min(window.innerHeight-menu.offsetHeight-8,box.bottom+6));
    menu.style.left=`${left}px`;menu.style.top=`${top}px`;menu.querySelector('button')?.focus();
  }
  function closeOptions(){const menu=document.getElementById('pf-options-menu');if(menu)menu.hidden=true;}
  function handleOption(event){
    const button=event.target.closest('[data-option-action]');if(!button)return;
    const menu=document.getElementById('pf-options-menu'),source=menu.dataset.source,action=button.dataset.optionAction,value=Number(button.dataset.value),prefs=getPrefs();
    if(action==='cadence')patchPrefs(source==='water'?{sipCadence:value}:source==='eyes'?{gazeCadence:value}:{bodyCadence:value});
    else if(action==='duration'&&source==='noodle')patchPrefs({noodleMinutes:value});
    else if(action==='duration'&&source==='lunch'){
      if((prefs.lunchMode||'desk')==='away')patchPrefs({awayLunchMinutes:value});
      else patchPrefs({deskLunchMinutes:value});
    }else if(action==='mode')patchPrefs({lunchMode:button.dataset.value==='away'?'away':'desk'});
    else if(action==='snooze')snoozeSource(source);
    else if(action==='skip'){
      const next={...(prefs.skipToday||{})};
      if(next[source]===localDate())delete next[source];else next[source]=localDate();
      patchPrefs({skipToday:next});
    }
    closeOptions();
  }
  function snoozeSource(source){
    const prefs=getPrefs(),now=Date.now(),patch={};
    if(source==='water')patch.waterGraceUntil=now+10*60000;
    else if(source==='eyes')patch.gazeSnoozedUntil=now+10*60000;
    else if(source==='body')patch.bodySnoozedUntil=now+10*60000;
    else if(source==='noodle'&&prefs.noodleStart){const total=(prefs.noodleDurationAtStart||prefs.noodleMinutes||30)*60000;patch.noodleStart=now-(total-5*60000);}
    else if(source==='lunch'&&prefs.lunchStart){const total=(prefs.lunchDurationAtStart||(prefs.lunchModeAtStart==='away'?prefs.awayLunchMinutes:prefs.deskLunchMinutes)||20)*60000;patch.lunchStart=now-(total-5*60000);}
    else if(source==='away')patch.awaySnoozedUntil=now+10*60000;
    patchPrefs(patch);
  }

  function installWafer(){
    if(!document.getElementById('pf-wafer-affordance')){
      const affordance=setButton(el('button','pf-wafer-affordance'),'Open controls');affordance.id='pf-wafer-affordance';affordance.setAttribute('aria-expanded','false');
      affordance.addEventListener('click',event=>{event.stopPropagation();const open=!document.body.classList.contains('pf-wafer-open');document.body.classList.toggle('pf-wafer-open',open);affordance.setAttribute('aria-expanded',String(open));if(open)document.getElementById('workline')?.querySelector('button')?.focus();});
      document.body.append(affordance);
      document.addEventListener('focusin',event=>{if(!document.body.classList.contains('pf-wafer-open'))return;if(event.target.closest('#workline,#quietDock,#pf-wafer-affordance'))return;document.body.classList.remove('pf-wafer-open');affordance.setAttribute('aria-expanded','false');});
    }
    const compact=window.innerWidth<=340&&window.innerHeight<=150,prefs=getPrefs();
    if(compact&&!prefs.waferPromptDismissed&&prefs.clarity!=='wafer'){
      const launches=Math.min(3,(Number(prefs.waferLaunches)||0)+1);patchPrefs({waferLaunches:launches});
      if(launches>=2)showWaferSuggestion();
    }else if(!compact&&prefs.waferLaunches)patchPrefs({waferLaunches:0});
  }
  function showWaferSuggestion(){
    const dock=document.getElementById('setupDock');if(!dock||dock.querySelector('.pf-wafer-suggest'))return;
    const line=el('span','pf-wafer-suggest'),copy=el('span','','This window fits Wafer mode.'),use=setButton(el('button'),'Use wafer'),dismiss=setButton(el('button'),'Not now');
    const finish=clarity=>{patchPrefs({clarity:clarity||getPrefs().clarity,waferPromptDismissed:true});dock.classList.remove('pf-ma-wafer-suggest');line.remove();if(clarity)document.body.dataset.clarity=clarity;};
    use.addEventListener('click',event=>{event.stopPropagation();finish('wafer');});
    dismiss.addEventListener('click',event=>{event.stopPropagation();finish();});
    line.append(copy,use,dismiss);dock.append(line);dock.classList.add('pf-ma-wafer-suggest');dock.hidden=false;
  }

  function updateWco(){
    const overlay=navigator.windowControlsOverlay,visible=Boolean(overlay&&overlay.visible);
    document.body.dataset.wco=visible?'on':'off';
  }
  function installWco(){updateWco();navigator.windowControlsOverlay?.addEventListener?.('geometrychange',updateWco);}

  function solarElevation(date,lat,lng){
    const start=new Date(date.getFullYear(),0,0),day=Math.floor((date-start)/86400000),hour=date.getHours()+date.getMinutes()/60,latitude=lat*Math.PI/180,gamma=2*Math.PI/365*(day-1+(hour-12)/24);
    const decl=.006918-.399912*Math.cos(gamma)+.070257*Math.sin(gamma)-.006758*Math.cos(2*gamma)+.000907*Math.sin(2*gamma)-.002697*Math.cos(3*gamma)+.00148*Math.sin(3*gamma);
    const eq=229.18*(.000075+.001868*Math.cos(gamma)-.032077*Math.sin(gamma)-.014615*Math.cos(2*gamma)-.040849*Math.sin(2*gamma));
    const offset=eq+4*lng-60*(-date.getTimezoneOffset()/60),solarMinutes=date.getHours()*60+date.getMinutes()+offset,angle=(solarMinutes/4-180)*Math.PI/180;
    return Math.asin(Math.sin(latitude)*Math.sin(decl)+Math.cos(latitude)*Math.cos(decl)*Math.cos(angle))*180/Math.PI;
  }
  function mixColor(base,warm,amount){
    const values=base.map((value,index)=>Math.round(value+(warm[index]-value)*amount));
    return `rgb(${values.join(' ')})`;
  }
  function colorArray(value,fallback){
    const match=String(value||'').match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    return match?match.slice(1).map(part=>Number.parseInt(part,16)):fallback;
  }
  function updateLight(){
    const more=matchMedia?.('(prefers-contrast: more)').matches,forced=matchMedia?.('(forced-colors: active)').matches;
    if(more||forced){document.documentElement.style.setProperty('--pf-warmth','0');document.documentElement.style.removeProperty('--pf-paper-live');document.documentElement.style.removeProperty('--pf-ink-live');return;}
    const prefs=getPrefs(),elevation=solarElevation(new Date(),Number(prefs.lat)||43.62,Number(prefs.lng)||-79.51),strength=[0,.72,1][Number(prefs.comfortStrength)]??.72,warmth=(prefs.comfortMode==='off'?0:Math.max(0,Math.min(1,1-(elevation+4)/46)))*strength,theme=document.body.dataset.theme||prefs.theme||'paper';lightTheme=theme;
    const dark=theme==='dark'||theme==='dusk',paper=theme==='custom'?colorArray(prefs.customBgA,[242,240,233]):dark?(theme==='dusk'?[38,40,52]:[15,21,29]):theme==='moss'?[237,241,234]:theme==='desk'?[247,244,237]:[243,240,232],ink=theme==='custom'?colorArray(prefs.customInk,[34,47,40]):dark?(theme==='dusk'?[236,234,241]:[231,237,243]):theme==='paper'?[49,47,44]:[34,47,40];
    document.documentElement.style.setProperty('--pf-warmth',warmth.toFixed(3));
    document.documentElement.style.setProperty('--pf-paper-live',mixColor(paper,dark?[27,25,24]:[244,235,220],warmth*.055));
    document.documentElement.style.setProperty('--pf-ink-live',mixColor(ink,dark?[226,216,205]:[45,43,38],warmth*.04));
  }
  function installLight(){
    updateLight();setTimeout(updateLight,0);clearInterval(lightTimer);lightTimer=setInterval(updateLight,10*60000);
    new MutationObserver(()=>{if((document.body.dataset.theme||'')!==lightTheme)updateLight();}).observe(document.body,{attributes:true,attributeFilter:['data-theme']});
  }

  function skippedText(gap,prefs){
    const pieces=[],water=prefs.workReminders?Math.floor(gap/Math.max(1,Number(prefs.sipCadence)||30)/60000):0,eyes=prefs.gazeEnabled?Math.floor(gap/Math.max(1,Number(prefs.gazeCadence)||20)/60000):0,body=prefs.bodyEnabled?Math.floor(gap/Math.max(1,Number(prefs.bodyCadence)||45)/60000):0;
    if(water)pieces.push('water');if(eyes)pieces.push('eye resets');if(body)pieces.push('movement resets');
    if(!pieces.length)return'Cadences re-anchored';
    const text=pieces.length===1?`${pieces[0]} skipped`:`${pieces.slice(0,-1).join(', ')} and ${pieces.at(-1)} skipped`;
    return text[0].toUpperCase()+text.slice(1);
  }
  function reconcileGap(from,attempt=0){
    const now=Date.now();if(!from||now-from<1000||now-reconciledAt<1200)return;
    const prefs=getPrefs(),gap=now-from,threshold=Math.max(5,Number(prefs.staleAfterMinutes)||20)*60000;if(gap<=threshold)return;
    if(!window.__PACEFOLD_MA_CORE__?.reconcileDrift&&attempt<20){setTimeout(()=>reconcileGap(from,attempt+1),50);return;}
    reconciledAt=now;
    if(window.__PACEFOLD_MA_CORE__?.reconcileDrift)window.__PACEFOLD_MA_CORE__.reconcileDrift(now);
    else patchPrefs({waterLastAt:now,gazeLastAt:now,bodyLastAt:now,waitingCue:null});
    scheduler.reanchor();
    const totalMinutes=Math.round(gap/60000),hours=Math.floor(totalMinutes/60),minutes=totalMinutes%60,duration=hours?`${hours}h ${minutes}m`:`${minutes}m`;
    statusOverride={word:`Back after ${duration}.`,time:'',relative:'',name:skippedText(gap,prefs)+'.',until:now+9000};applyStatus();
  }
  function installDrift(){
    if(bootLastSeenAt)reconcileGap(bootLastSeenAt);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=Date.now();else reconcileGap(hiddenAt||Number(getPrefs().lastSeenAt)||0);});
    window.addEventListener('focus',()=>reconcileGap(hiddenAt||Number(getPrefs().lastSeenAt)||0));
  }

  function mergeMinutes(intervals){
    const values=intervals.filter(item=>item?.start&&item?.end&&item.end>item.start).sort((a,b)=>a.start-b.start);if(!values.length)return 0;
    let start=values[0].start,end=values[0].end,total=0;
    for(const item of values.slice(1)){if(item.start<=end)end=Math.max(end,item.end);else{total+=end-start;start=item.start;end=item.end;}}
    return Math.round((total+end-start)/60000);
  }
  function rhythmSummary(date=localDate()){
    const prefs=getPrefs();
    if(date!==localDate()){
      const item=prefs.history?.[date]||{};
      return{water:Number(item.waterSips)||0,waterTotal:0,pauses:(Number(item.awayCount)||0)+(Number(item.prayerCount)||0)+(item.deskMealMinutes||item.awayLunchMinutes?1:0),offDesk:Number(item.uniqueBreakMinutes)||0};
    }
    const plan=Math.max(1,Math.ceil(((resolvedDay().end-resolvedDay().start)*60)/Math.max(1,Number(prefs.sipCadence)||30))),intervals=[...(prefs.awaySessions||[]),...(prefs.prayerSessions||[]),...(prefs.lunchSessions||[]).filter(item=>item.mode==='away')];
    return{water:Number(prefs.waterSips)||0,waterTotal:plan,pauses:(prefs.awaySessions||[]).length+(prefs.prayerSessions||[]).length+(prefs.lunchSessions||[]).length,offDesk:mergeMinutes(intervals)};
  }
  function rhythmMarkdown(date){
    const item=rhythmSummary(date),water=item.waterTotal?`${item.water}/${item.waterTotal}`:String(item.water);
    return['<!-- pacefold-rhythm -->','## Rhythm',`Water intervals: ${water}`,`Logged pauses: ${item.pauses}`,`Off-desk time: ${item.offDesk}m`,'<!-- /pacefold-rhythm -->',''].join('\n');
  }
  window.__PACEFOLD_MA_EXPORT__={rhythmMarkdown};

  function maybeShowReview(){
    const prefs=getPrefs(),day=resolvedDay(),now=new Date(),h=now.getHours()+now.getMinutes()/60;
    if(!prefs.dayCloseEnabled||prefs.foldReviewDismissed||prefs.foldReviewLastDate===localDate()||day.type==='off'||h<day.end)return;
    let card=document.getElementById('pf-fold-review');
    if(!card){
      card=el('section','pf-fold-review');card.id='pf-fold-review';card.setAttribute('role','dialog');card.setAttribute('aria-label','Fold review');
      const header=el('header'),title=el('h2','','Fold review'),close=setButton(el('button'),'×');close.setAttribute('aria-label','Close review');
      close.addEventListener('click',()=>{patchPrefs({foldReviewLastDate:localDate()});card.hidden=true;});
      const ribbon=el('div','pf-review-ribbon'),numbers=el('div','pf-review-numbers'),carry=el('p'),actions=el('div','pf-review-actions'),stop=setButton(el('button'),'Stop reviews');
      stop.addEventListener('click',()=>{patchPrefs({foldReviewDismissed:true,foldReviewLastDate:localDate()});card.hidden=true;});
      header.append(title,close);actions.append(stop);card.append(header,ribbon,numbers,carry,actions);document.body.append(card);
    }
    const summary=rhythmSummary(),numbers=card.querySelector('.pf-review-numbers');numbers.replaceChildren();
    const reviewRibbon=card.querySelector('.pf-review-ribbon'),dayRibbon=document.querySelector('#sequence.pf-day-ribbon');reviewRibbon.inert=true;
    reviewRibbon.replaceChildren(...[...(dayRibbon?.children||[])].filter(node=>!node.matches('.pf-ribbon-now')).map(node=>node.cloneNode(true)));
    reviewRibbon.style.setProperty('--pf-ribbon-progress','1');
    for(const [value,label] of [[summary.water,'Water'],[summary.pauses,'Pauses'],[`${summary.offDesk}m`,'Off desk']]){const box=el('div');box.append(el('strong','',value),el('span','',label));numbers.append(box);}
    card.querySelector('p').textContent=`Carry forward: ${Number(prefs.sipCadence)||30}m water interval · ${Number(prefs.deskLunchMinutes)||20}m desk meal.`;
    card.hidden=false;
  }
  function installReview(){maybeShowReview();clearInterval(reviewTimer);reviewTimer=setInterval(maybeShowReview,60000);}

  function filterBackupPrefs(prefs){
    const result={};
    for(const [key,value] of Object.entries(prefs||{})){
      if(/(?:auth|token|secret|password|oneNoteClient|oneNoteTenant|oneNoteNotebook|oneNoteSection|oneNotePages|oneNoteLast)/i.test(key))continue;
      result[key]=value;
    }
    return result;
  }
  function download(name,type,content){
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
  function backupPayload(context){
    const prefs=getPrefs();
    return{format:'pacefold.backup.v1',schemaVersion:1,exportedAt:new Date().toISOString(),prefs:filterBackupPrefs(prefs),notes:context.entries||[],categories:context.categories||[],playlistDefinitions:context.playlists||[],streamingLinks:context.streamLinks||[],rhythmHistory:{history:prefs.history||{},waterSips:prefs.waterSips||0,lunchSessions:prefs.lunchSessions||[],awaySessions:prefs.awaySessions||[],prayerSessions:prefs.prayerSessions||[],bodySessions:prefs.bodySessions||[]},excluded:['Local audio blobs','Authentication and token fields']};
  }
  function exportBackup(context,showStatus){
    download(`pacefold-backup-${localDate()}.json`,'application/json',JSON.stringify(backupPayload(context),null,2));
    showStatus?.('Local backup downloaded.','success');
  }
  function restoreDiff(data,current){
    const notes=Array.isArray(data.notes)?data.notes:Array.isArray(data.entries)?data.entries:[],existing=new Map((current.entries||[]).map(item=>[item.id,item]));
    let added=0,overwritten=0,skippedCount=0;
    for(const item of notes){if(!item?.id){skippedCount+=1;continue;}if(existing.has(item.id))overwritten+=1;else added+=1;}
    const prefs=data.prefs&&typeof data.prefs==='object'?data.prefs:{};
    return{notes,added,overwritten,skipped:skippedCount,prefFields:Object.keys(filterBackupPrefs(prefs)).length};
  }
  function confirmRestore(diff){
    return new Promise(resolve=>{
      const modal=createModal('Restore backup','Review the changes before anything is written.'),list=el('div','pf-restore-diff');
      for(const [label,value] of [['Notes added',diff.added],['Notes overwritten',diff.overwritten],['Entries skipped',diff.skipped],['Preference fields overwritten',diff.prefFields]])list.append(el('span','',label),el('strong','',value));
      modal.card.append(list);
      const cancel=setButton(el('button'),'Cancel'),restore=setButton(el('button','primary'),'Restore');
      cancel.addEventListener('click',()=>{modal.close();resolve(false);});restore.addEventListener('click',()=>{modal.close();resolve(true);});
      modal.actions.append(cancel,restore);modal.card.append(modal.actions);modal.open();
    });
  }
  async function restoreBackup(file,context,showStatus){
    const data=JSON.parse(await file.text());
    if(data.format!=='pacefold.backup.v1'&&!Array.isArray(data.entries))throw new Error('Backup format is not supported.');
    const diff=restoreDiff(data,context.snapshot());if(!await confirmRestore(diff))return false;
    const current=context.snapshot(),notesById=new Map((current.entries||[]).map(item=>[item.id,item]));
    for(const item of diff.notes)if(item?.id)notesById.set(item.id,item);
    const nextPrefs={...getPrefs(),...filterBackupPrefs(data.prefs||{})},rhythm=data.rhythmHistory||{};
    if(rhythm.history)nextPrefs.history=rhythm.history;
    for(const key of ['waterSips','lunchSessions','awaySessions','prayerSessions','bodySessions'])if(rhythm[key]!=null)nextPrefs[key]=rhythm[key];
    patchPrefs(nextPrefs);
    context.apply({entries:[...notesById.values()],categories:Array.isArray(data.categories)?data.categories:current.categories,playlists:Array.isArray(data.playlistDefinitions)?data.playlistDefinitions:Array.isArray(data.playlists)?data.playlists:current.playlists,streamLinks:Array.isArray(data.streamingLinks)?data.streamingLinks:Array.isArray(data.streamLinks)?data.streamLinks:current.streamLinks});
    showStatus?.('Backup restored on this device.','success');return true;
  }
  window.__PACEFOLD_MA_BACKUP__={exportBackup,restoreBackup};

  async function estimateStorage(){
    if(!navigator.storage?.estimate)return null;
    try{const estimate=await navigator.storage.estimate(),usage=Number(estimate.usage)||0,quota=Number(estimate.quota)||0;storageText=quota?`${formatBytes(usage)} of ${formatBytes(quota)} stored locally`:`${formatBytes(usage)} stored locally`;updateStorageLine();return{usage,quota};}catch{return null;}
  }
  function formatBytes(value){if(value<1024*1024)return`${Math.max(0,Math.round(value/1024))} KB`;return`${(value/1048576).toFixed(value<10485760?1:0)} MB`;}
  async function allowAudioImport(files){
    const estimate=await estimateStorage();if(!estimate||!estimate.quota)return true;
    const incoming=[...(files||[])].reduce((sum,file)=>sum+(Number(file.size)||0),0),ceiling=Math.min(estimate.quota*.85,Math.max(0,estimate.quota-20*1048576));
    if(estimate.usage+incoming<=ceiling)return true;
    const status=document.querySelector('#pf-local-player [data-pf-player-status]');if(status)status.textContent=`Audio not added. ${formatBytes(Math.max(0,estimate.quota-estimate.usage))} remains in browser storage.`;
    return false;
  }
  async function requestPersistence(){
    const prefs=getPrefs();if(prefs.storagePersistAsked||!navigator.storage?.persist)return;
    patchPrefs({storagePersistAsked:true});try{await navigator.storage.persist();}catch{}
  }
  function updateStorageLine(){
    const panel=document.getElementById('panel'),status=panel?.querySelector('.app-status');if(!status)return;
    let line=status.querySelector('.pf-storage-line');
    if(!line){line=el('span','pf-storage-line');line.append(el('span','k','Local storage'),el('span','v'));status.append(line);}
    const value=line.querySelector('.v');if(value&&value.textContent!==storageText)value.textContent=storageText;
  }
  function installStorage(){
    estimateStorage();window.addEventListener('appinstalled',requestPersistence);
    if(matchMedia?.('(display-mode: standalone)').matches)requestPersistence();
  }
  window.__PACEFOLD_MA_STORAGE__={allowAudioImport,estimate:estimateStorage};

  function installPanelHooks(){
    const panel=document.getElementById('panel');if(!panel)return;
    const reconcile=()=>{
      if(panel.childElementCount&&!panel.querySelector('[data-pf-edit-week]')){
        const button=setButton(el('button','action wide'),'Edit workweek');button.dataset.pfEditWeek='true';button.addEventListener('click',event=>{event.stopPropagation();showWeekEditor();});
        const group=panel.querySelector('[data-settings-group="rhythm"]')||panel;group.append(button);
      }
      updateStorageLine();
    };
    panelObserver=new MutationObserver(reconcile);panelObserver.observe(panel,{childList:true,subtree:true});reconcile();
  }

  function runSecondFrame(){
    requestAnimationFrame(()=>requestAnimationFrame(()=>document.documentElement.classList.remove('pf-boot')));
  }
  function initialize(){
    initializeMeters();installDayType();installQuiet();installOptions();installWafer();installWco();installLight();installStatusGuard();installDrift();installReview();installStorage();installPanelHooks();runSecondFrame();
    for(const name of ['pointerdown','keydown','mousedown','touchstart'])document.addEventListener(name,()=>{lastInteractionAt=Date.now();},{passive:true});
    window.addEventListener('pacefold:ma-prefs',()=>{updateDayType();applyQuietState();updateLight();ribbonKey='';});
    setInterval(()=>{setSecondProgress(new Date().getSeconds());applyStatus();if(getPrefs().quietMode)sanitizeQuietDom();},1000);
  }

  window.__PACEFOLD_MA_AUDIT__={
    release:RELEASE,
    simulateScheduler(cues,minGap=4){
      const sorted=[...(cues||[])].sort((a,b)=>a.at-b.at||PRIORITY[b.source]-PRIORITY[a.source]),delivered=[];let last=-Infinity;
      for(const cue of sorted){let at=cue.at;if(at-last<minGap)at=last+minGap;if(at-last<minGap)continue;delivered.push({...cue,at});last=at;}
      return delivered;
    },
    simulateGap(hours=4){return{gapMinutes:hours*60,backlogDeliveries:0,lines:1};},
    ribbonTickWrites:['transform','opacity'],
    defaultKeys:['schemaVersion','minCueGap','focusGraceMinutes','workWeek','quietMode','foldReviewDismissed','storagePersistAsked']
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
