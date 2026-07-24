(() => {
  'use strict';

  let LAT=43.62, LNG=-79.51;
  const PRAYERS=[['fajr','Fajr','F'],['sunrise','Sunrise','S'],['dhuhr','Dhuhr','D'],['asr','Asr','A'],['maghrib','Maghrib','M'],['isha','Isha','I']];
  const ALERTS=['fajr','dhuhr','asr','maghrib','isha'];
  const APP_VERSION='15.2.1';
  const STORAGE_KEY='pacefoldPrefsV15';
  const SETUP_KEY='pacefoldSetupDismissedV15';
  const ONBOARD_KEY='pacefoldOnboardedV15';
  const CAPTURE_DRAFT_KEY='pacefoldCaptureDraftV15';
  const CAPTURE_KINDS=['inbox','follow-up','incident','inspection','jhsc','construction','notification','meeting','resource'];
  const BODY_PROMPTS=[
    {title:'Stand and change position',detail:'Step away from the screen. Let your arms hang, then take an easy walk for about a minute.'},
    {title:'Reset shoulders and hands',detail:'Let the shoulders drop. Open and close the hands gently, then change how the forearms are supported.'},
    {title:'Rebuild the workstation',detail:'Settle back into the chair, bring input devices close, and place the screen where your head can stay upright.'},
    {title:'Move before returning',detail:'Stand, take several comfortable steps, and return in a different posture than the one you left.'}
  ];
  const PROFILE_PRESETS={
    original:{label:'Pacefold Original',family:'muslim',note:'Islamic prayer rhythm with the original noodle-prep routine.',moments:[]},
    secular:{label:'Everyday',family:'manual',note:'Neutral workday resets with no faith-specific language.',moments:[['morning-reset','Morning reset','09:30','M'],['midday-pause','Midday pause','12:30','D'],['afternoon-reset','Afternoon reset','15:00','A']]},
    mindful:{label:'Mindfulness',family:'manual',note:'Meditation, breathing and reflection moments.',moments:[['morning-sit','Morning meditation','09:00','M'],['breathing-space','Breathing space','12:30','B'],['evening-reflection','Evening reflection','15:45','E']]},
    muslim:{label:'Muslim',family:'muslim',note:'Location-aware Fajr, Dhuhr, Asr, Maghrib and Isha.',moments:[]},
    jewish:{label:'Jewish',family:'manual',note:'Personal prayer reminders; not a halachic zmanim calculator.',moments:[['morning-prayer','Morning prayer','09:00','M'],['afternoon-prayer','Afternoon prayer','13:30','A'],['evening-prayer','Evening prayer','16:00','E']]},
    christian:{label:'Christian',family:'manual',note:'Morning prayer, midday pause and evening reflection.',moments:[['morning-prayer','Morning prayer','09:00','M'],['midday-prayer','Midday prayer','12:30','D'],['evening-reflection','Evening reflection','15:45','E']]},
    hindu:{label:'Hindu',family:'manual',note:'Personal puja and reflection reminders.',moments:[['morning-puja','Morning puja','09:00','M'],['midday-pause','Midday pause','12:30','D'],['evening-prayer','Evening prayer','16:00','E']]},
    buddhist:{label:'Buddhist',family:'manual',note:'Meditation and mindful reset reminders.',moments:[['morning-meditation','Morning meditation','09:00','M'],['midday-breath','Mindful breath','12:30','B'],['evening-reflection','Evening reflection','15:45','E']]},
    custom:{label:'Custom',family:'manual',note:'Your own labels and times.',moments:[['moment-1','Morning moment','09:30','1'],['moment-2','Midday moment','12:30','2'],['moment-3','Afternoon moment','15:30','3']]}
  };
  const PREP_PRESETS={
    noodles:{label:'Noodles',minutes:30,done:'Meal prepared'},tea:{label:'Tea',minutes:5,done:'Tea ready'},coffee:{label:'Coffee',minutes:8,done:'Coffee ready'},food:{label:'Food prep',minutes:20,done:'Food ready'},steep:{label:'Steep / brew',minutes:10,done:'Brew ready'},custom:{label:'Custom prep',minutes:15,done:'Prep complete'}
  };
  const DEFAULTS={
    profile:'original',customMoments:PROFILE_PRESETS.original.moments,prepPreset:'noodles',prepLabel:'Noodles',prepDoneLabel:'Meal prepared',
    comfortMode:'auto',comfortStrength:1,gazeEnabled:true,gazeCadence:20,gazeLastAt:0,gazeSnoozedUntil:0,
    bodyEnabled:true,bodyCadence:45,bodyLastAt:0,bodySnoozedUntil:0,bodyResetStart:0,bodyPromptIndex:0,bodySessions:[],
    theme:'auto',privacy:true,timeFormat:'12',showSeconds:true,clarity:'discreet',edgeCue:true,taskbarBadge:true,taskbarBadgeMode:'due',
    customBgA:'#eef2f6',customBgB:'#e2e8ed',customInk:'#202529',customAccent:'#587894',
    lead:10,dueWindow:18,snoozeMinutes:10,method:'15',asr:'hanafi',browserNotif:false,notificationDetail:'generic',notificationMode:'quiet',notified:{},notificationActionHistory:[],
    prayerBreakLogging:true,prayerMaxMinutes:45,prayerBreakStart:0,prayerBreakKey:'',prayerBreakName:'',prayerSessions:[],
    workReminders:true,showWorkline:true,workdaysOnly:true,workHours:'08:30-16:30',
    waterTarget:24,sipCadence:30,waterSips:0,waterDate:'',waterLastAt:0,waterGraceUntil:0,
    noodleMinutes:30,noodleDurationAtStart:0,noodlePrealert:2,noodleStart:0,noodleDone:'',
    lunchMode:'desk',deskLunchMinutes:20,awayLunchMinutes:45,lunchModeAtStart:'desk',lunchDurationAtStart:0,lunchPrealert:5,lunchStart:0,lunchDone:'',lunchLoggedMinutes:0,lunchAutoStart:true,lunchSessions:[],
    awayStart:0,awaySessions:[],activityDate:'',history:{},dayCloseEnabled:true,kaizenEnabled:true,kaizenDismissed:'',
    captures:[],captureKind:'inbox',oneNoteSyncEnabled:true,oneNoteClientId:'',oneNoteTenant:'organizations',oneNoteNotebookId:'',oneNoteNotebookName:'',oneNoteSectionId:'',oneNoteSectionName:'',oneNotePages:{},oneNoteLastSync:0,oneNoteLastError:'',
    soundChoice:'brown',soundVolume:.24,soundUrl:'',soundLabel:'Custom audio',soundDuck:true,
    lat:43.62,lng:-79.51,locationLabel:'Toronto',
    offsets:{fajr:0,dhuhr:0,asr:0,maghrib:0,isha:0},acknowledged:{},snoozed:{}
  };

  const $=id=>document.getElementById(id);
  const diagnostics=[];
  let storageState='Local';
  function reportError(error,context='runtime'){
    try{diagnostics.push({at:new Date().toISOString(),context,message:String(error&&error.message||error)});if(diagnostics.length>12)diagnostics.shift();console.error('[Pacefold]',context,error);}catch(_){ }
  }
  window.addEventListener('error',e=>reportError(e.error||e.message,'window'));
  window.addEventListener('unhandledrejection',e=>reportError(e.reason,'promise'));
  const safeJSON=value=>{try{return JSON.parse(value||'null');}catch(error){reportError(error,'storage-parse');return null;}};
  const storageGet=key=>{try{return localStorage.getItem(key);}catch(error){if(error&&error.name!=='SecurityError')reportError(error,'storage-read');return null;}};
  const clamp=(value,min,max,fallback)=>{value=Number(value);return Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;};
  const localDayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function normalizeMoments(value,profile='custom'){
    const fallback=(PROFILE_PRESETS[profile]||PROFILE_PRESETS.custom).moments;
    const source=Array.isArray(value)&&value.length?value:fallback;
    return source.slice(0,6).map((item,index)=>{
      const row=Array.isArray(item)?{id:item[0],label:item[1],time:item[2],code:item[3]}:(item||{});
      const time=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(row.time||''))?String(row.time):['09:30','12:30','15:30'][index%3];
      return{id:String(row.id||`moment-${index+1}`).replace(/[^a-z0-9-]/gi,'-').slice(0,32),label:String(row.label||`Moment ${index+1}`).slice(0,34),time,code:String(row.code||index+1).slice(0,2),enabled:row.enabled!==false};
    }).filter(x=>x.enabled);
  }
  function normalizePrefs(raw={}){
    const p={...DEFAULTS,...(raw||{})};
    p.profile=PROFILE_PRESETS[p.profile]?p.profile:'original';
    p.customMoments=normalizeMoments(p.customMoments,p.profile);
    p.prepPreset=PREP_PRESETS[p.prepPreset]?p.prepPreset:'noodles';
    const prep=PREP_PRESETS[p.prepPreset];
    p.prepLabel=(typeof p.prepLabel==='string'&&p.prepLabel.trim()?p.prepLabel.trim():prep.label).slice(0,24);
    p.prepDoneLabel=(typeof p.prepDoneLabel==='string'&&p.prepDoneLabel.trim()?p.prepDoneLabel.trim():prep.done).slice(0,28);
    p.comfortMode=['auto','off','warm','dim'].includes(p.comfortMode)?p.comfortMode:'auto';
    p.comfortStrength=[0,1,2].includes(Number(p.comfortStrength))?Number(p.comfortStrength):1;
    p.gazeCadence=[20,30,40].includes(Number(p.gazeCadence))?Number(p.gazeCadence):20;
    p.gazeLastAt=clamp(p.gazeLastAt,0,Number.MAX_SAFE_INTEGER,0);p.gazeSnoozedUntil=clamp(p.gazeSnoozedUntil,0,Number.MAX_SAFE_INTEGER,0);
    p.bodyCadence=[30,45,60,90].includes(Number(p.bodyCadence))?Number(p.bodyCadence):45;p.bodyLastAt=clamp(p.bodyLastAt,0,Number.MAX_SAFE_INTEGER,0);p.bodySnoozedUntil=clamp(p.bodySnoozedUntil,0,Number.MAX_SAFE_INTEGER,0);p.bodyResetStart=clamp(p.bodyResetStart,0,Number.MAX_SAFE_INTEGER,0);p.bodyPromptIndex=clamp(p.bodyPromptIndex,0,BODY_PROMPTS.length-1,0);
    p.bodySessions=Array.isArray(p.bodySessions)?p.bodySessions.slice(-30).map(s=>({start:clamp(s&&s.start,0,Number.MAX_SAFE_INTEGER,0),end:clamp(s&&s.end,0,Number.MAX_SAFE_INTEGER,0),seconds:clamp(s&&s.seconds,0,1800,0),prompt:clamp(s&&s.prompt,0,BODY_PROMPTS.length-1,0)})).filter(s=>s.start&&s.end&&s.end>=s.start):[];
    p.theme=['auto','desk','dark','paper','moss','dusk','custom'].includes(p.theme)?p.theme:'auto';
    const colour=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value).toLowerCase():fallback;
    p.customBgA=colour(p.customBgA,DEFAULTS.customBgA);p.customBgB=colour(p.customBgB,DEFAULTS.customBgB);p.customInk=colour(p.customInk,DEFAULTS.customInk);p.customAccent=colour(p.customAccent,DEFAULTS.customAccent);
    p.timeFormat=p.timeFormat==='24'?'24':'12';
    p.clarity=p.clarity==='clear'?'clear':'discreet';
    p.method=p.method==='18'?'18':'15';p.asr=p.asr==='std'?'std':'hanafi';p.notificationMode=p.notificationMode==='all'?'all':'quiet';
    p.taskbarBadgeMode=['off','due','countdown'].includes(p.taskbarBadgeMode)?p.taskbarBadgeMode:(p.taskbarBadge===false?'off':'due');p.taskbarBadge=p.taskbarBadgeMode!=='off';
    p.notificationActionHistory=Array.isArray(p.notificationActionHistory)?p.notificationActionHistory.slice(-60).map(item=>({id:String(item&&item.id||'').replace(/[^a-z0-9-]/gi,'').slice(0,90),key:String(item&&item.key||'').slice(0,140),source:['prayer','water','noodle','away','lunch','eyes','body','test'].includes(item&&item.source)?item.source:'test',action:item&&item.action==='snooze'?'snooze':'ack',at:clamp(item&&item.at,0,Number.MAX_SAFE_INTEGER,0),outcome:String(item&&item.outcome||'Recorded').slice(0,80)})).filter(item=>item.id&&item.at):[];
    p.lead=clamp(p.lead,0,30,10);p.dueWindow=clamp(p.dueWindow,5,60,18);p.snoozeMinutes=clamp(p.snoozeMinutes,5,30,10);
    p.prayerMaxMinutes=[30,45,60].includes(Number(p.prayerMaxMinutes))?Number(p.prayerMaxMinutes):45;
    p.prayerBreakStart=clamp(p.prayerBreakStart,0,Number.MAX_SAFE_INTEGER,0);
    p.prayerBreakKey=typeof p.prayerBreakKey==='string'?p.prayerBreakKey:'';p.prayerBreakName=typeof p.prayerBreakName==='string'?p.prayerBreakName:'';
    p.prayerSessions=Array.isArray(p.prayerSessions)?p.prayerSessions.slice(-20).map(s=>({key:String(s&&s.key||''),name:String(s&&s.name||'Prayer'),start:clamp(s&&s.start,0,Number.MAX_SAFE_INTEGER,0),end:clamp(s&&s.end,0,Number.MAX_SAFE_INTEGER,0),minutes:clamp(s&&s.minutes,0,120,0)})).filter(s=>s.start&&s.end&&s.end>=s.start):[];
    p.waterTarget=[16,24,32].includes(Number(p.waterTarget))?Number(p.waterTarget):24;
    p.sipCadence=[20,30,40].includes(Number(p.sipCadence))?Number(p.sipCadence):30;
    p.noodleMinutes=[5,8,10,15,20,30,45,60].includes(Number(p.noodleMinutes))?Number(p.noodleMinutes):(PREP_PRESETS[p.prepPreset]?.minutes||30);
    p.noodlePrealert=[0,2,3,5].includes(Number(p.noodlePrealert))?Number(p.noodlePrealert):2;
    const inheritedDesk=raw.deskLunchMinutes??raw.lunchMinutes??20;
    p.deskLunchMinutes=[15,20,30].includes(Number(inheritedDesk))?Number(inheritedDesk):20;
    p.awayLunchMinutes=[30,45,60].includes(Number(p.awayLunchMinutes))?Number(p.awayLunchMinutes):45;
    p.lunchMode=['desk','away'].includes(p.lunchMode)?p.lunchMode:'desk';p.lunchModeAtStart=['desk','away'].includes(p.lunchModeAtStart)?p.lunchModeAtStart:p.lunchMode;
    p.lunchPrealert=[0,5,10].includes(Number(p.lunchPrealert))?Number(p.lunchPrealert):5;
    p.waterSips=clamp(p.waterSips,0,50,0);p.waterLastAt=clamp(p.waterLastAt,0,Number.MAX_SAFE_INTEGER,0);p.waterGraceUntil=clamp(p.waterGraceUntil,0,Number.MAX_SAFE_INTEGER,0);
    p.noodleStart=clamp(p.noodleStart,0,Number.MAX_SAFE_INTEGER,0);p.noodleDurationAtStart=clamp(p.noodleDurationAtStart,0,60,0);
    p.lunchStart=clamp(p.lunchStart,0,Number.MAX_SAFE_INTEGER,0);p.lunchDurationAtStart=clamp(p.lunchDurationAtStart,0,120,0);p.lunchLoggedMinutes=clamp(p.lunchLoggedMinutes,0,240,0);
    p.lunchSessions=Array.isArray(p.lunchSessions)?p.lunchSessions.slice(-10).map(s=>({mode:s&&s.mode==='away'?'away':'desk',start:clamp(s&&s.start,0,Number.MAX_SAFE_INTEGER,0),end:clamp(s&&s.end,0,Number.MAX_SAFE_INTEGER,0),minutes:clamp(s&&s.minutes,0,240,0)})).filter(s=>s.start&&s.end&&s.end>=s.start):[];
    p.awayStart=clamp(p.awayStart,0,Number.MAX_SAFE_INTEGER,0);
    p.awaySessions=Array.isArray(p.awaySessions)?p.awaySessions.slice(-20).map(s=>({start:clamp(s&&s.start,0,Number.MAX_SAFE_INTEGER,0),end:clamp(s&&s.end,0,Number.MAX_SAFE_INTEGER,0),minutes:clamp(s&&s.minutes,0,120,0)})).filter(s=>s.start&&s.end&&s.end>=s.start):[];
    p.activityDate=typeof p.activityDate==='string'?p.activityDate:(p.waterDate||'');
    p.history=p.history&&typeof p.history==='object'&&!Array.isArray(p.history)?p.history:{};
    p.captureKind=CAPTURE_KINDS.includes(p.captureKind)?p.captureKind:'inbox';
    p.captures=Array.isArray(p.captures)?p.captures.slice(-300).map((item,index)=>{const x=item||{},createdAt=clamp(x.createdAt,0,Number.MAX_SAFE_INTEGER,Date.now());return{id:String(x.id||`legacy-${createdAt}-${index}`).replace(/[^a-z0-9-]/gi,'-').slice(0,80),text:String(x.text||'').trim().slice(0,1200),kind:CAPTURE_KINDS.includes(x.kind)?x.kind:'inbox',createdAt,day:typeof x.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.day)?x.day:localDayKey(new Date(createdAt)),syncedAt:clamp(x.syncedAt,0,Number.MAX_SAFE_INTEGER,0),syncError:String(x.syncError||'').slice(0,180)};}).filter(x=>x.text):[];
    p.oneNoteClientId=String(p.oneNoteClientId||'').trim().replace(/[^a-f0-9-]/gi,'').slice(0,50);p.oneNoteTenant=String(p.oneNoteTenant||'organizations').trim().replace(/[^a-z0-9.-]/gi,'').slice(0,80)||'organizations';
    ['oneNoteNotebookId','oneNoteNotebookName','oneNoteSectionId','oneNoteSectionName','oneNoteLastError'].forEach(k=>p[k]=String(p[k]||'').slice(0,k.endsWith('Error')?180:180));
    p.oneNotePages=p.oneNotePages&&typeof p.oneNotePages==='object'&&!Array.isArray(p.oneNotePages)?Object.fromEntries(Object.entries(p.oneNotePages).filter(([k,v])=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&typeof v==='string').slice(-45)):{};p.oneNoteLastSync=clamp(p.oneNoteLastSync,0,Number.MAX_SAFE_INTEGER,0);
    p.soundChoice=['brown','rain','fan','custom'].includes(p.soundChoice)?p.soundChoice:'brown';p.soundVolume=clamp(p.soundVolume,0,1,.24);p.soundUrl=String(p.soundUrl||'').trim().slice(0,1000);p.soundLabel=String(p.soundLabel||'Custom audio').trim().slice(0,64)||'Custom audio';
    p.workHours=/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(String(p.workHours))?p.workHours:DEFAULTS.workHours;
    ['privacy','showSeconds','edgeCue','taskbarBadge','browserNotif','workReminders','showWorkline','workdaysOnly','lunchAutoStart','prayerBreakLogging','dayCloseEnabled','kaizenEnabled','gazeEnabled','bodyEnabled','oneNoteSyncEnabled','soundDuck'].forEach(k=>p[k]=Boolean(p[k]));
    p.offsets={...DEFAULTS.offsets,...(p.offsets||{})};Object.keys(p.offsets).forEach(k=>p.offsets[k]=clamp(p.offsets[k],-15,15,0));
    p.lat=clamp(p.lat,-90,90,DEFAULTS.lat);p.lng=clamp(p.lng,-180,180,DEFAULTS.lng);p.locationLabel=(typeof p.locationLabel==='string'&&p.locationLabel)?p.locationLabel.slice(0,24):DEFAULTS.locationLabel;
    p.acknowledged=p.acknowledged&&typeof p.acknowledged==='object'?p.acknowledged:{};
    p.snoozed=p.snoozed&&typeof p.snoozed==='object'?p.snoozed:{};
    p.notified=p.notified&&typeof p.notified==='object'?p.notified:{};
    return p;
  }
  function loadPrefs(){
    const current=safeJSON(storageGet(STORAGE_KEY));if(current)return normalizePrefs(current);
    const pace14=safeJSON(storageGet('pacefoldPrefsV14'));if(pace14)return normalizePrefs(pace14);
    const pace13=safeJSON(storageGet('pacefoldPrefsV13'));if(pace13)return normalizePrefs({...pace13,profile:pace13.profile||'original',prepPreset:pace13.prepPreset||'noodles',prepLabel:pace13.prepLabel||'Noodles'});
    const pace12=safeJSON(storageGet('pacefoldPrefsV12'));if(pace12)return normalizePrefs({...pace12,profile:'original',prepPreset:'noodles'});
    const pace11=safeJSON(storageGet('pacefoldPrefsV11'));if(pace11)return normalizePrefs(pace11);
    const desk11=safeJSON(storageGet('desklinePrefsV11'));if(desk11)return normalizePrefs(desk11);
    const v10=safeJSON(storageGet('desklinePrefsV10'));if(v10)return normalizePrefs({...v10,lunchMode:'desk',deskLunchMinutes:20,awayLunchMinutes:45,activityDate:v10.activityDate||v10.waterDate||''});
    const v8=safeJSON(storageGet('desklinePrefsV8'));if(v8)return normalizePrefs({...v8,lunchMode:'desk',deskLunchMinutes:20,activityDate:v8.waterDate||''});
    const v5=safeJSON(storageGet('desklinePrefsV5'));if(v5)return normalizePrefs({...v5,theme:v5.theme==='desk'?'auto':v5.theme,activityDate:v5.waterDate||''});
    const v4=safeJSON(storageGet('quietClockPrefsV4'));if(v4)return normalizePrefs({...v4,waterSips:Math.max(0,Math.round((v4.waterOz||0)/1.5)),sipCadence:30,noodleDurationAtStart:v4.noodleMinutes||30});
    const old=safeJSON(storageGet('quietClockPrefsV3'));if(old){const hours={'8-17':'08:00-17:00','8-18':'08:00-18:00','9-17':'09:00-17:00'}[old.workHours]||DEFAULTS.workHours;return normalizePrefs({...old,workHours:hours,noodleMinutes:old.lunchMinutes||30,noodleDurationAtStart:old.lunchMinutes||30,noodleStart:old.lunchStart||0,noodleDone:old.lunchDone||''});}
    return normalizePrefs();
  }
  let prefs=loadPrefs();
  LAT=Number.isFinite(prefs.lat)?prefs.lat:LAT;LNG=Number.isFinite(prefs.lng)?prefs.lng:LNG;

  const dayKey=localDayKey;
  const parseClock=s=>{const [h,m]=String(s).split(':').map(Number);return (h||0)+(m||0)/60;};
  function workRange(){const [a,b]=prefs.workHours.split('-');return{start:parseClock(a),end:parseClock(b)};}
  function workdayStartAt(now=new Date()){const start=workRange().start,value=new Date(now);value.setHours(Math.floor(start),Math.round((start%1)*60),0,0);return value.getTime();}
  function displayClock(h){const H=Math.floor(h),m=Math.round((h-H)*60);return `${H%12||12}:${String(m).padStart(2,'0')} ${H>=12?'PM':'AM'}`;}
  function isConfiguredWorkday(now){const day=now.getDay();return !prefs.workdaysOnly||(day>=1&&day<=5);}
  const systemDark=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;
  function resolvedTheme(now,h){
    if(prefs.theme!=='auto')return prefs.theme;
    const {start,end}=workRange(),sunrise=times&&Number.isFinite(times.sunrise)?times.sunrise:7,sunset=times&&Number.isFinite(times.sunset)?times.sunset:19;
    if(h<sunrise-.35||h>sunset+.45)return 'dark';
    if(h<start+.5||h>end-1.1)return 'paper';
    if(systemDark&&systemDark.matches&&(h<start||h>end))return 'dark';
    return 'desk';
  }
  function applyTheme(now,h){
    const theme=resolvedTheme(now,h);document.body.dataset.theme=theme;
    document.body.style.setProperty('--custom-bg-a',prefs.customBgA);document.body.style.setProperty('--custom-bg-b',prefs.customBgB);document.body.style.setProperty('--custom-ink',prefs.customInk);document.body.style.setProperty('--custom-accent',prefs.customAccent);
    const colors={desk:'#eef2f6',paper:'#eeeae1',dark:'#0b1017',moss:'#edf1ea',dusk:'#262834',custom:prefs.customBgA};
    const meta=$('themeColor');if(meta)meta.setAttribute('content',colors[theme]||colors.desk);
    return theme;
  }
  function resolvedComfort(now,h){
    if(prefs.comfortMode!=='auto')return prefs.comfortMode;
    const {start,end}=workRange(),sunset=times&&Number.isFinite(times.sunset)?times.sunset:19;
    if(h>=Math.min(sunset,end-.25)||h>end)return'dim';
    if(h>=end-1.5||h<start+.35)return'warm';
    return'off';
  }
  function applyComfort(now,h){document.body.dataset.comfort=resolvedComfort(now,h);document.body.dataset.comfortStrength=String(prefs.comfortStrength);}
  function currentAwaySummary(){
    const sessions=Array.isArray(prefs.awaySessions)?prefs.awaySessions:[];
    return{count:sessions.length,minutes:Math.round(sessions.reduce((sum,s)=>sum+(Number(s.minutes)||0),0))};
  }
  function currentPrayerSummary(){
    const sessions=Array.isArray(prefs.prayerSessions)?prefs.prayerSessions:[];
    return{count:sessions.length,minutes:Math.round(sessions.reduce((sum,s)=>sum+(Number(s.minutes)||0),0))};
  }
  function currentLunchSummary(){
    const sessions=Array.isArray(prefs.lunchSessions)?prefs.lunchSessions:[];
    const desk=sessions.filter(s=>s.mode!=='away'),away=sessions.filter(s=>s.mode==='away');
    return{count:sessions.length,deskCount:desk.length,awayCount:away.length,deskMinutes:Math.round(desk.reduce((n,s)=>n+(s.minutes||0),0)),awayMinutes:Math.round(away.reduce((n,s)=>n+(s.minutes||0),0))};
  }
  function currentBodySummary(){const sessions=Array.isArray(prefs.bodySessions)?prefs.bodySessions:[];return{count:sessions.length,seconds:Math.round(sessions.reduce((sum,s)=>sum+(Number(s.seconds)||0),0))};}
  function mergeMinutes(intervals){
    const valid=intervals.filter(x=>x&&x.start&&x.end&&x.end>x.start).sort((a,b)=>a.start-b.start);if(!valid.length)return 0;
    let start=valid[0].start,end=valid[0].end,total=0;for(let i=1;i<valid.length;i++){const x=valid[i];if(x.start<=end)end=Math.max(end,x.end);else{total+=end-start;start=x.start;end=x.end;}}total+=end-start;return Math.round(total/60000);
  }
  function workdayLedger(now=new Date()){
    const end=now.getTime(),away=(prefs.awaySessions||[]).map(s=>({start:s.start,end:s.end,type:'away'})),prayer=(prefs.prayerSessions||[]).map(s=>({start:s.start,end:s.end,type:'prayer'})),awayLunch=(prefs.lunchSessions||[]).filter(s=>s.mode==='away').map(s=>({start:s.start,end:s.end,type:'lunch'}));
    if(prefs.awayStart)away.push({start:prefs.awayStart,end,type:'away'});if(prefs.prayerBreakStart)prayer.push({start:prefs.prayerBreakStart,end,type:'prayer'});if(prefs.lunchStart&&prefs.lunchModeAtStart==='away')awayLunch.push({start:prefs.lunchStart,end,type:'lunch'});
    return{uniqueBreakMinutes:mergeMinutes([...away,...prayer,...awayLunch]),prayer:currentPrayerSummary(),away:currentAwaySummary(),lunch:currentLunchSummary(),body:currentBodySummary()};
  }
  function dayCloseSummary(now=new Date()){
    const ledger=workdayLedger(now),plan=hydrationPlan(),sips=Math.min(plan.total,prefs.waterSips||0);
    const pieces=[`${sips}/${plan.total} sip intervals`,`${ledger.prayer.count} ${scheduleNounLower()} pause${ledger.prayer.count===1?'':'s'}`];
    if(ledger.lunch.deskMinutes)pieces.push(`${ledger.lunch.deskMinutes}m desk meal`);
    if(ledger.lunch.awayMinutes)pieces.push(`${ledger.lunch.awayMinutes}m away lunch`);
    if(ledger.away.count)pieces.push(`${ledger.away.count} away pause${ledger.away.count===1?'':'s'}`);
    if(ledger.body.count)pieces.push(`${ledger.body.count} movement reset${ledger.body.count===1?'':'s'}`);
    return{title:`${now.toLocaleDateString(undefined,{weekday:'long'})}, quietly kept.`,line:pieces.join(' · '),offDesk:ledger.uniqueBreakMinutes};
  }
  function kaizenSuggestion(now=new Date()){
    if(!prefs.kaizenEnabled||prefs.kaizenDismissed===dayKey(now))return null;
    const desk=(prefs.lunchSessions||[]).filter(s=>s.mode!=='away');
    if(desk.length){
      const avg=Math.round(desk.reduce((n,s)=>n+(s.minutes||0),0)/desk.length),choices=[15,20,30],nearest=choices.reduce((a,b)=>Math.abs(b-avg)<Math.abs(a-avg)?b:a,20);
      if(Math.abs(nearest-prefs.deskLunchMinutes)>=4)return{text:`Your desk meals are averaging about ${avg} minutes. Pacefold can match the default more closely.`,action:'kaizenDeskMeal',value:nearest,cta:`Use ${nearest}m`};
    }
    const plan=hydrationPlan(),{start,end}=workRange(),h=now.getHours()+now.getMinutes()/60;
    if(h>start+(end-start)*.62&&plan.total>0&&(prefs.waterSips||0)/plan.total<.45&&prefs.sipCadence!==20)return{text:'The afternoon sip pace is regularly falling behind. A slightly shorter interval may fit the day better.',action:'kaizenSip',value:20,cta:'Try 20m'};
    const prayer=(prefs.prayerSessions||[]);
    if(prayer.length>=2){const avg=Math.round(prayer.reduce((n,s)=>n+(s.minutes||0),0)/prayer.length);if(avg>=4&&avg<=20)return{text:`${scheduleNoun()} pauses are averaging ${avg} minutes. No adjustment is needed; the safeguard remains only a safety net.`,action:'dismissKaizen',value:'',cta:'Keep as is'};}
    return null;
  }

  function archiveWorkday(key){
    if(!key)return;
    const ledger=workdayLedger(new Date());
    prefs.history={...(prefs.history||{}),[key]:{waterSips:prefs.waterSips||0,awayCount:ledger.away.count,awayMinutes:ledger.away.minutes,prayerCount:ledger.prayer.count,prayerMinutes:ledger.prayer.minutes,deskMealMinutes:ledger.lunch.deskMinutes,awayLunchMinutes:ledger.lunch.awayMinutes,bodyResets:ledger.body.count,uniqueBreakMinutes:ledger.uniqueBreakMinutes,noodles:prefs.noodleDone===key}};
    const keys=Object.keys(prefs.history).sort().slice(-14),trimmed={};keys.forEach(k=>trimmed[k]=prefs.history[k]);prefs.history=trimmed;
  }
  function ensureWorkday(now){
    const key=dayKey(now),previous=prefs.activityDate||prefs.waterDate||'';let changed=false;
    if(prefs.prayerBreakStart&&now.getTime()-prefs.prayerBreakStart>prefs.prayerMaxMinutes*60000){const start=prefs.prayerBreakStart,end=start+prefs.prayerMaxMinutes*60000;prefs.prayerSessions=[...(prefs.prayerSessions||[]),{key:prefs.prayerBreakKey,name:prefs.prayerBreakName||scheduleNoun(),start,end,minutes:prefs.prayerMaxMinutes}].slice(-20);prefs.prayerBreakStart=0;prefs.prayerBreakKey='';prefs.prayerBreakName='';prefs.waterGraceUntil=now.getTime()+8*60000;changed=true;}
    if(previous&&previous!==key){
      if(prefs.lunchStart){const mode=prefs.lunchModeAtStart||'desk',minutes=prefs.lunchDurationAtStart||(mode==='away'?prefs.awayLunchMinutes:prefs.deskLunchMinutes),start=prefs.lunchStart,end=start+minutes*60000;prefs.lunchSessions=[...(prefs.lunchSessions||[]),{mode,start,end,minutes}].slice(-10);prefs.lunchStart=0;prefs.lunchDurationAtStart=0;}
      if(prefs.awayStart){const elapsed=now.getTime()-prefs.awayStart;if(elapsed>0&&elapsed<=90*60000){const end=now.getTime(),minutes=Math.max(1,Math.round(elapsed/60000));prefs.awaySessions=[...(prefs.awaySessions||[]),{start:prefs.awayStart,end,minutes}].slice(-20);}prefs.awayStart=0;}
      archiveWorkday(previous);prefs.waterSips=0;prefs.waterLastAt=0;prefs.waterGraceUntil=0;prefs.gazeLastAt=0;prefs.gazeSnoozedUntil=0;prefs.bodyLastAt=0;prefs.bodySnoozedUntil=0;prefs.bodyResetStart=0;prefs.bodySessions=[];prefs.awaySessions=[];prefs.prayerBreakStart=0;prefs.prayerBreakKey='';prefs.prayerBreakName='';prefs.prayerSessions=[];prefs.noodleStart=0;prefs.noodleDurationAtStart=0;prefs.noodleDone='';prefs.lunchModeAtStart=prefs.lunchMode;prefs.lunchDone='';prefs.lunchLoggedMinutes=0;prefs.lunchSessions=[];prefs.kaizenDismissed='';changed=true;
    }
    if(prefs.activityDate!==key){prefs.activityDate=key;changed=true;}
    if(prefs.waterDate!==key){prefs.waterDate=key;changed=true;}
    if(prefs.noodleDone&&prefs.noodleDone!==key){prefs.noodleDone='';changed=true;}
    if(prefs.lunchDone&&prefs.lunchDone!==key){prefs.lunchDone='';prefs.lunchLoggedMinutes=0;changed=true;}
    if(prefs.noodleStart&&now.getTime()-prefs.noodleStart>12*3600e3){prefs.noodleStart=0;prefs.noodleDurationAtStart=0;changed=true;}
    if(prefs.lunchStart&&now.getTime()-prefs.lunchStart>4*3600e3){const mode=prefs.lunchModeAtStart||'desk',minutes=prefs.lunchDurationAtStart||(mode==='away'?prefs.awayLunchMinutes:prefs.deskLunchMinutes),start=prefs.lunchStart,end=start+minutes*60000;prefs.lunchSessions=[...(prefs.lunchSessions||[]),{mode,start,end,minutes}].slice(-10);prefs.lunchLoggedMinutes=minutes;prefs.lunchStart=0;prefs.lunchDurationAtStart=0;prefs.lunchDone=key;changed=true;}
    if(prefs.awayStart&&now.getTime()-prefs.awayStart>90*60000){prefs.awayStart=0;changed=true;}
    const sessionAnchor=Math.max(now.getTime(),workdayStartAt(now));
    if(!prefs.waterLastAt){prefs.waterLastAt=sessionAnchor;changed=true;}
    if(!prefs.gazeLastAt){prefs.gazeLastAt=sessionAnchor;changed=true;}
    if(!prefs.bodyLastAt){prefs.bodyLastAt=sessionAnchor;changed=true;}
    if(changed)save();
  }
  function save(){
    try{
      const cutoff=Date.now()-4*864e5,cleanAck={},cleanSnooze={},cleanNotified={};
      Object.entries(prefs.acknowledged||{}).forEach(([k,v])=>{if(v>cutoff)cleanAck[k]=v;});
      Object.entries(prefs.snoozed||{}).forEach(([k,v])=>{if(v>cutoff)cleanSnooze[k]=v;});
      Object.entries(prefs.notified||{}).forEach(([k,v])=>{if(v>cutoff)cleanNotified[k]=v;});
      prefs.acknowledged=cleanAck;prefs.snoozed=cleanSnooze;prefs.notified=cleanNotified;
      const serialized=JSON.stringify(prefs);localStorage.setItem(STORAGE_KEY,serialized);storageState='Local';return true;
    }catch(error){storageState='Unavailable';reportError(error,'storage-write');return false;}
  }
  ensureWorkday(new Date());save();

  const dtr=d=>d*Math.PI/180,rtd=r=>r*180/Math.PI;
  const dsin=d=>Math.sin(dtr(d)),dcos=d=>Math.cos(dtr(d)),dtan=d=>Math.tan(dtr(d));
  const dasin=x=>rtd(Math.asin(x)),dacos=x=>rtd(Math.acos(x)),datan2=(y,x)=>rtd(Math.atan2(y,x)),dacot=x=>rtd(Math.atan2(1,x));
  const fixA=a=>{a%=360;return a<0?a+360:a;},fixH=a=>{a%=24;return a<0?a+24:a;};
  function julian(y,m,d){if(m<=2){y--;m+=12;}const A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+B-1524.5;}
  function sunPos(jd){const D=jd-2451545,g=fixA(357.529+.98560028*D),q=fixA(280.459+.98564736*D),L=fixA(q+1.915*dsin(g)+.020*dsin(2*g)),e=23.439-.00000036*D,RA=datan2(dcos(e)*dsin(L),dcos(L))/15,eqt=q/15-fixH(RA),decl=dasin(dsin(e)*dsin(L));return{decl,eqt};}
  function computeTimes(date){
    const tz=-date.getTimezoneOffset()/60,jd=julian(date.getFullYear(),date.getMonth()+1,date.getDate())-LNG/(15*24),mid=t=>fixH(12-sunPos(jd+t).eqt);
    const ang=(a,t,dir)=>{const decl=sunPos(jd+t).decl,noon=mid(t),x=(-dsin(a)-dsin(decl)*dsin(LAT))/(dcos(decl)*dcos(LAT)),T=(1/15)*dacos(Math.min(1,Math.max(-1,x)));return noon+(dir==='ccw'?-T:T);};
    const asr=(factor,t)=>{const decl=sunPos(jd+t).decl,a=-dacot(factor+dtan(Math.abs(LAT-decl)));return ang(a,t,'cw');};
    const angle=prefs.method==='18'?18:15,asrFactor=prefs.asr==='hanafi'?2:1;
    let T={fajr:5,sunrise:6,dhuhr:12,asr:13,sunset:18,maghrib:18,isha:19};
    for(let i=0;i<4;i++){const p={};Object.keys(T).forEach(k=>p[k]=T[k]/24);T.fajr=ang(angle,p.fajr,'ccw');T.sunrise=ang(.833,p.sunrise,'ccw');T.dhuhr=mid(p.dhuhr);T.asr=asr(asrFactor,p.asr);T.sunset=ang(.833,p.sunset,'cw');T.maghrib=ang(.833,p.maghrib,'cw');T.isha=ang(angle,p.isha,'cw');}
    const adjustment=tz-LNG/15;Object.keys(T).forEach(k=>T[k]+=adjustment);T.dhuhr+=1/60;ALERTS.forEach(k=>T[k]+=(prefs.offsets[k]||0)/60);return T;
  }
  function gregJDN(y,m,d){const a=Math.floor((14-m)/12),y2=y+4800-a,m2=m+12*a-3;return d+Math.floor((153*m2+2)/5)+365*y2+Math.floor(y2/4)-Math.floor(y2/100)+Math.floor(y2/400)-32045;}
  function hijri(dt){let jd=gregJDN(dt.getFullYear(),dt.getMonth()+1,dt.getDate()),l=jd-1948440+10632,n=Math.floor((l-1)/10631);l=l-10631*n+354;let j=Math.floor((10985-l)/5316)*Math.floor((50*l)/17719)+Math.floor(l/5670)*Math.floor((43*l)/15238);l=l-Math.floor((30-j)/15)*Math.floor((17719*j)/50)-Math.floor(j/16)*Math.floor((15238*j)/43)+29;const m=Math.floor((24*l)/709),d=l-Math.floor((709*m)/24),y=30*n+j-30,names=['Muharram','Safar','Rabi I','Rabi II','Jumada I','Jumada II','Rajab','Sha\u02bban','Ramadan','Shawwal','Dhul-Qa\u02bda','Dhul-Hijja'];return `${d} ${names[m-1]} ${y}`;}
  function computeQibla(){const kaabaLat=21.4225,kaabaLng=39.8262,dl=dtr(kaabaLng-LNG),b=rtd(Math.atan2(Math.sin(dl)*Math.cos(dtr(kaabaLat)),Math.cos(dtr(LAT))*Math.sin(dtr(kaabaLat))-Math.sin(dtr(LAT))*Math.cos(dtr(kaabaLat))*Math.cos(dl)));return(b+360)%360;}
  let QIBLA=computeQibla();
  function applyLocation(lat,lng,label){LAT=lat;LNG=lng;prefs.lat=lat;prefs.lng=lng;prefs.locationLabel=label||`${lat.toFixed(2)}, ${lng.toFixed(2)}`;QIBLA=computeQibla();times=computeTimes(new Date());save();}

  const isMuslimProfile=()=>['original','muslim'].includes(prefs.profile);
  const profileMeta=()=>PROFILE_PRESETS[prefs.profile]||PROFILE_PRESETS.original;
  const scheduleNoun=()=>isMuslimProfile()?'Prayer':'Moment';
  const scheduleNounLower=()=>scheduleNoun().toLowerCase();
  function scheduleForDate(date=new Date(),includeSunrise=false){
    if(isMuslimProfile()){
      const t=dayKey(date)===calculatedDay?times:computeTimes(date);
      const source=includeSunrise?PRAYERS:PRAYERS.filter(([key])=>ALERTS.includes(key));
      return source.map(([id,label,code])=>({id,label,code,time:t[id],auto:true})).sort((a,b)=>a.time-b.time);
    }
    return normalizeMoments(prefs.customMoments,prefs.profile).map(item=>({...item,time:parseClock(item.time),auto:false})).sort((a,b)=>a.time-b.time);
  }
  const scheduleName=id=>(scheduleForDate(new Date(),true).find(x=>x.id===id)||{}).label||'Moment';
  const scheduleCode=id=>(scheduleForDate(new Date(),true).find(x=>x.id===id)||{}).code||'';
  const eventKey=(d,k)=>`${dayKey(d)}:${k}`;
  const nameOf=k=>scheduleName(k);
  const prepName=()=>prefs.prepLabel||PREP_PRESETS[prefs.prepPreset]?.label||'Prep';
  const prepDoneName=()=>prefs.prepDoneLabel||PREP_PRESETS[prefs.prepPreset]?.done||'Prep complete';
  function applyPrepPreset(id){
    const preset=PREP_PRESETS[id]||PREP_PRESETS.custom;prefs.prepPreset=id in PREP_PRESETS?id:'custom';prefs.prepLabel=preset.label;prefs.prepDoneLabel=preset.done;prefs.noodleMinutes=preset.minutes;prefs.noodleDurationAtStart=0;
  }
  function applyProfilePreset(id){
    if(!PROFILE_PRESETS[id])id='custom';prefs.profile=id;
    if(!isMuslimProfile())prefs.customMoments=normalizeMoments(PROFILE_PRESETS[id].moments,id);
    if(id==='original')applyPrepPreset('noodles');
    prefs.acknowledged={};prefs.snoozed={};prefs.prayerBreakStart=0;prefs.prayerBreakKey='';prefs.prayerBreakName='';times=computeTimes(new Date());calculatedDay=dayKey(new Date());lastBadge='';
  }
  function editCustomMoments(){
    if(isMuslimProfile()){toast('Islamic prayer times are calculated from location');return;}
    const rows=normalizeMoments(prefs.customMoments,prefs.profile),input=window.prompt('Edit moments as Label @ HH:MM, separated by semicolons',rows.map(x=>`${x.label} @ ${x.time}`).join('; '));
    if(input==null)return;const parsed=input.split(';').map((part,index)=>{const match=part.trim().match(/^(.+?)\s*@\s*((?:[01]\d|2[0-3]):[0-5]\d)$/);return match?{id:`moment-${index+1}`,label:match[1].trim(),time:match[2],code:String(index+1)}:null;}).filter(Boolean);
    if(!parsed.length){toast('Use entries like Midday pause @ 12:30');return;}prefs.customMoments=normalizeMoments(parsed,'custom');prefs.acknowledged={};prefs.snoozed={};toast('Personal moments updated');
  }
  const fmt=h=>{h=fixH(h);let m=Math.round((h%1)*60),H=Math.floor(h);if(m===60){m=0;H=(H+1)%24;}if(prefs.timeFormat==='24')return `${String(H).padStart(2,'0')}:${String(m).padStart(2,'0')}`;return `${H%12||12}:${String(m).padStart(2,'0')} ${H>=12?'PM':'AM'}`;};
  const duration=mins=>{mins=Math.max(0,Math.floor(mins));const h=Math.floor(mins/60),m=mins%60;return h?`${h}h ${String(m).padStart(2,'0')}m`:`${m}m`;};
  const mmss=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};

  let times=computeTimes(new Date()),calculatedDay=dayKey(new Date());
  let panelOpen=false,settingsView='today',revealTimer=0,toastTimer=0,testTimer=0,lastRenderedMinute=-1,testPrayer='none',testRoutine='none';
  let foldMode='',captureDraft=storageGet(CAPTURE_DRAFT_KEY)||'',captureDraftKind=prefs.captureKind,oneNoteStage='status',oneNoteCatalog=[],oneNoteSyncing=false,oneNoteClient=null,oneNoteClientStamp='',pendingUpdateReload=false;
  let soundPlaying=false,soundContext=null,soundSource=null,soundGain=null,localAudioUrl='',localAudioLabel='';
  const sent=new Set();
  let deferredInstallPrompt=null,serviceWorkerState=location.protocol==='file:'?'Local file':'Starting',updateAvailable=false,lastBadge='',liveIconKey='',liveIconUrl='',workerRegistration=null,refreshing=false,lastSelfCheck='Not run',controllerSeenAtLoad=Boolean(navigator.serviceWorker?.controller),notificationDrainActive=false;
  const isStandalone=()=>window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  const launchParams=new URLSearchParams(location.search),setupRequested=launchParams.get('setup')==='1',captureRequested=launchParams.get('capture')==='1',careRequested=launchParams.get('care')==='1',soundRequested=launchParams.get('sound')==='1',actionRequested=launchParams.get('action')||'';
  const setupDismissed=()=>storageGet(SETUP_KEY)==='1'||storageGet('pacefoldSetupDismissedV14')==='1';
  const isOnboarded=()=>storageGet(ONBOARD_KEY)==='1'||storageGet('pacefoldOnboardedV14')==='1';
  function dismissSetup(){try{localStorage.setItem(SETUP_KEY,'1');}catch(_){ }$('setupDock').hidden=true;}
  function renderSetupDock(force=false){
    const dock=$('setupDock');if(!dock)return;
    const needsProfile=!isOnboarded();
    if(setupDismissed()&&!force&&!setupRequested&&!needsProfile){dock.hidden=true;return;}
    dock.hidden=false;
    if(needsProfile){dock.classList.remove('notification');$('setupTitle').textContent='Personalize Pacefold';$('setupText').textContent='Choose your rhythm, prep routine, display comfort and alert style.';$('setupPrimary').textContent='Start setup';return;}
    if(isStandalone()){
      if(force&&notificationPermission()==='default'){
        dock.classList.add('notification');$('setupTitle').textContent='Optional quiet alerts';$('setupText').textContent='Preview the alert style, or keep Pacefold entirely in-app.';$('setupPrimary').textContent='Review';
      }else{dock.hidden=true;}
      return;
    }
    dock.classList.remove('notification');$('setupTitle').textContent=deferredInstallPrompt?'Install Pacefold':'Install from Edge';$('setupText').textContent=deferredInstallPrompt?'One click creates the clean taskbar app.':'Guided setup includes the exact Edge installation path.';$('setupPrimary').textContent=deferredInstallPrompt?'Install':'Open setup';
  }

  let onboardingStep=0,onboardingDraft=null;
  function freshOnboardingDraft(){return{profile:prefs.profile,prepPreset:prefs.prepPreset,prepMinutes:prefs.noodleMinutes,comfortMode:prefs.comfortMode,gazeEnabled:prefs.gazeEnabled,bodyEnabled:prefs.bodyEnabled,notificationMode:prefs.notificationMode,notifications:prefs.browserNotif};}
  function optionCard(id,label,note,selected,attr){return `<button class="onboarding-option ${selected?'selected':''}" ${attr}="${id}" type="button"><strong>${label}</strong><span>${note}</span></button>`;}
  function renderOnboarding(){
    const modal=$('onboarding');if(!modal||modal.hidden)return;const d=onboardingDraft||freshOnboardingDraft();
    $('onboardingProgress').innerHTML=[0,1,2].map((_,i)=>`<i class="${i<=onboardingStep?'active':''}"></i>`).join('');
    $('onboardingBack').hidden=onboardingStep===0;$('onboardingNext').textContent=onboardingStep===2?'Finish setup':'Continue';
    if(onboardingStep===0){
      $('onboardingTitle').textContent='Choose your rhythm';
      $('onboardingBody').innerHTML=`<p class="onboarding-lede">Pacefold can be secular, mindful, faith-aware or fully custom. These are personal reminders—not official religious rulings.</p><div class="onboarding-grid">${Object.entries(PROFILE_PRESETS).map(([id,x])=>optionCard(id,x.label,x.note,d.profile===id,'data-onboard-profile')).join('')}</div>`;
    }else if(onboardingStep===1){
      $('onboardingTitle').textContent='Choose a preparation cue';
      $('onboardingBody').innerHTML=`<p class="onboarding-lede">The original noodle timer remains the developer default, but Pacefold can quietly time tea, coffee, food prep, brewing—or nothing at all.</p><div class="onboarding-grid compact">${Object.entries(PREP_PRESETS).map(([id,x])=>optionCard(id,x.label,`${x.minutes} min default`,d.prepPreset===id,'data-onboard-prep')).join('')}</div><div class="onboarding-field"><strong>Default duration</strong><div class="onboarding-pills">${[5,8,10,15,20,30,45,60].map(v=>`<button class="${d.prepMinutes===v?'selected':''}" data-onboard-duration="${v}" type="button">${v}m</button>`).join('')}</div></div>`;
    }else{
      $('onboardingTitle').textContent='Comfort and alerts';
      $('onboardingBody').innerHTML=`<p class="onboarding-lede">Pacefold can soften only its own interface. It cannot directly recolour an entire monitor, but it can open Windows Night light settings.</p><div class="onboarding-field"><strong>Interface comfort</strong><div class="onboarding-pills">${[['auto','Auto'],['off','Neutral'],['warm','Warm'],['dim','Dim']].map(([v,l])=>`<button class="${d.comfortMode===v?'selected':''}" data-onboard-comfort="${v}" type="button">${l}</button>`).join('')}</div></div><label class="onboarding-toggle"><input type="checkbox" data-onboard-gaze ${d.gazeEnabled?'checked':''}><span><strong>20-20-20 eye cues</strong><small>Quiet reminders to look about 6 metres away for 20 seconds.</small></span></label><label class="onboarding-toggle"><input type="checkbox" data-onboard-body ${d.bodyEnabled?'checked':''}><span><strong>Posture and movement cues</strong><small>One break-aware reset every ${prefs.bodyCadence} minutes; never stacked over meals or away time.</small></span></label><label class="onboarding-toggle"><input type="checkbox" data-onboard-notify ${d.notifications?'checked':''}><span><strong>Preview one quiet system alert</strong><small>Optional, silent and non-persistent. Pacefold works without it.</small></span></label><div class="onboarding-summary"><span>Profile</span><strong>${PROFILE_PRESETS[d.profile]?.label||'Custom'}</strong><span>Prep</span><strong>${PREP_PRESETS[d.prepPreset]?.label||'Custom'} · ${d.prepMinutes}m</strong><span>Care</span><strong>${d.gazeEnabled?'Eyes on':'Eyes off'} · ${d.bodyEnabled?'Movement on':'Movement off'}</strong><span>Install</span><strong>${isStandalone()?'Already installed':deferredInstallPrompt?'Ready':'Edge Apps menu'}</strong></div><button class="onboarding-secondary" data-onboard-nightlight type="button">Open Windows Night light settings</button>`;
    }
  }
  function openOnboarding(step=0){onboardingStep=Math.max(0,Math.min(2,step));onboardingDraft=freshOnboardingDraft();const modal=$('onboarding');if(!modal)return;modal.hidden=false;document.body.classList.add('onboarding-open');renderOnboarding();}
  function closeOnboarding(){const modal=$('onboarding');if(modal)modal.hidden=true;document.body.classList.remove('onboarding-open');applyPendingReload();}
  async function finishOnboarding(){
    const d=onboardingDraft||freshOnboardingDraft();applyProfilePreset(d.profile);applyPrepPreset(d.prepPreset);prefs.noodleMinutes=d.prepMinutes;prefs.comfortMode=d.comfortMode;prefs.gazeEnabled=Boolean(d.gazeEnabled);prefs.bodyEnabled=Boolean(d.bodyEnabled);prefs.notificationMode='quiet';save();try{localStorage.setItem(ONBOARD_KEY,'1');localStorage.removeItem(SETUP_KEY);}catch(_){ }
    closeOnboarding();render();renderSetupDock();
    if(d.notifications)await requestNotifications(true);
    if(!isStandalone())await installPacefold();else toast('Setup complete · Pacefold is ready');
  }
  function minutesUntilNextCue(states){
    if(!states)return 0;
    const {h,prayer,water,noodle,lunch,gaze,body}=states,candidates=[];
    if(prayer?.signal==='snoozed'&&prayer.remaining>0)candidates.push(prayer.remaining);else if(prayer&&prayer.next){let minutes=(prayer.next[1]-h)*60;if(minutes<0)minutes+=1440;candidates.push(minutes);}
    if(water&&water.within&&!water.complete&&!water.due)candidates.push((water.nextAt-h)*60);
    if(noodle&&noodle.running)candidates.push(noodle.remain/60000);
    if(lunch&&(lunch.running||lunch.pre))candidates.push(lunch.remain/60000);
    if(gaze&&gaze.within&&!gaze.paused&&!gaze.due)candidates.push(gaze.remaining/60000);
    if(body&&body.within&&!body.paused&&!body.due&&!body.active)candidates.push(body.remaining/60000);
    const minutes=candidates.filter(value=>Number.isFinite(value)&&value>0).sort((a,b)=>a-b)[0];
    return minutes&&minutes<=99?Math.max(1,Math.ceil(minutes)):0;
  }
  function updateAppBadge(attention,states){
    const mode=prefs.taskbarBadgeMode||'due',activeNeedsDot=attention?.signal==='active'&&['prayer','away','body'].includes(attention.source),waiting=Boolean(mode!=='off'&&attention&&(['due','pending'].includes(attention.signal)||activeNeedsDot)),minutes=mode==='countdown'&&!waiting?minutesUntilNextCue(states):0,key=mode==='off'?'off':waiting?`waiting:${attention.source}:${attention.signal}`:minutes?`next:${minutes}`:'clear';
    if(key===lastBadge)return;lastBadge=key;
    try{
      if(waiting&&'setAppBadge'in navigator)Promise.resolve(navigator.setAppBadge()).catch(e=>reportError(e,'badge'));
      else if(minutes&&'setAppBadge'in navigator)Promise.resolve(navigator.setAppBadge(minutes)).catch(e=>reportError(e,'badge'));
      else if('clearAppBadge'in navigator)Promise.resolve(navigator.clearAppBadge()).catch(e=>reportError(e,'badge-clear'));
    }catch(error){reportError(error,'badge');}
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;renderSetupDock(true);if(panelOpen){const st=currentStates();buildPanel(st.h,st.prayer,st.water,st.noodle,st.away,st.lunch);}});
  window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;toast('Pacefold installed · updates stay automatic');renderSetupDock(setupRequested);});
  async function installPacefold(){
    if(isStandalone()){renderSetupDock(true);toast('Pacefold is already installed');return;}
    if(deferredInstallPrompt){
      try{deferredInstallPrompt.prompt();const result=await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;toast(result.outcome==='accepted'?'Installation started':'Installation left unchanged');renderSetupDock();}
      catch(error){reportError(error,'install');toast('Install could not be opened');}
      return;
    }
    renderSetupDock(true);toast('Edge menu · Apps · Install Pacefold');
  }
  async function checkForUpdate(silent=true){
    if(!workerRegistration)return false;
    try{await workerRegistration.update();if(!silent)toast('Pacefold is up to date');return true;}catch(error){reportError(error,'update-check');if(!silent)toast('Update check could not complete');return false;}
  }
  function hasUnsavedWork(){const onboardingOpen=$('onboarding')&&!$('onboarding').hidden,drawerCapture=$('foldDrawer')&&!$('foldDrawer').hidden&&foldMode==='capture'&&captureDraft.trim();return Boolean(onboardingOpen||drawerCapture);}
  function scheduleReload(){if(refreshing)return;refreshing=true;serviceWorkerState='Updated';setTimeout(()=>location.reload(),650);}
  function applyPendingReload(){if(pendingUpdateReload&&!hasUnsavedWork()){pendingUpdateReload=false;scheduleReload();}}
  async function registerPacefoldWorker(){
    if(!('serviceWorker'in navigator)||location.protocol==='file:'||!window.isSecureContext){serviceWorkerState=location.protocol==='file:'?'Local file · PWA features off':'Unsupported';renderSetupDock();return;}
    try{
      const registrations=await navigator.serviceWorker.getRegistrations();
      const legacy=registrations.filter(r=>{try{return new URL(r.scope).pathname.endsWith('/app/');}catch(_){return false;}});
      for(const old of legacy)await old.unregister();
      workerRegistration=await navigator.serviceWorker.register('../service-worker.js',{scope:'../',updateViaCache:'none'});
      serviceWorkerState=`Automatic · v${APP_VERSION}`;
      if(workerRegistration.waiting){updateAvailable=true;serviceWorkerState='Applying update';workerRegistration.waiting.postMessage({type:'SKIP_WAITING'});}
      workerRegistration.addEventListener('updatefound',()=>{
        const worker=workerRegistration.installing;if(!worker)return;
        worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){updateAvailable=true;serviceWorkerState=hasUnsavedWork()?'Update ready · waiting':'Applying update';worker.postMessage({type:'SKIP_WAITING'});toast(hasUnsavedWork()?'Update ready · it will apply after this draft is safe':'Pacefold update ready · applying automatically');}});
      });
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        if(!controllerSeenAtLoad){controllerSeenAtLoad=true;serviceWorkerState=`Automatic · v${APP_VERSION}`;renderSetupDock();return;}
        if(hasUnsavedWork()){pendingUpdateReload=true;serviceWorkerState='Update ready · waiting';toast('Update held until setup or capture is closed');return;}scheduleReload();
      });
      navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='PACEFOLD_NOTIFICATION_ACTION_AVAILABLE')void drainNotificationActions();});
      if(legacy.length){try{if(sessionStorage.getItem('pacefoldRootWorkerMigrated')!=='1'){sessionStorage.setItem('pacefoldRootWorkerMigrated','1');setTimeout(()=>location.reload(),500);}}catch(_){ }}
      setTimeout(()=>checkForUpdate(true),1800);
      setInterval(()=>checkForUpdate(true),30*60000);
      void drainNotificationActions();
      renderSetupDock();
    }catch(error){serviceWorkerState='Offline setup failed';reportError(error,'service-worker');renderSetupDock();}
  }
  let continuingSession=false;
  try{continuingSession=sessionStorage.getItem('pacefoldSessionV14')==='active';sessionStorage.setItem('pacefoldSessionV14','active');}catch(_){ }
  if(!continuingSession){const opened=new Date(),openedH=opened.getHours()+opened.getMinutes()/60+opened.getSeconds()/3600;scheduleForDate(opened).forEach(item=>{if(item.time<=openedH-prefs.dueWindow/60)prefs.acknowledged[eventKey(opened,item.id)]=Date.now();});save();}

  function bounds(now,h){
    const list=scheduleForDate(now).map(item=>[item.id,item.time]);let next=list.find(([,t])=>t>h)||null,prev=[...list].reverse().find(([,t])=>t<=h)||null;
    if(!list.length){const fallback=[['moment',12]];return{prev:fallback[0],next:['moment',36]};}
    if(!next){const tomorrow=new Date(now.getTime()+864e5),first=scheduleForDate(tomorrow)[0]||list[0];next=[first.id,first.time+24];}
    if(!prev){const yesterday=new Date(now.getTime()-864e5),previous=scheduleForDate(yesterday),last=previous[previous.length-1]||list[list.length-1];prev=[last.id,last.time-24];}
    return{prev,next};
  }
  function prayerState(now,h){
    const {prev,next}=bounds(now,h);
    if(prefs.prayerBreakStart){const key=prefs.prayerBreakKey||eventKey(now,prev[0]),event=(key.split(':').pop()||prev[0]);return{signal:'active',breakActive:true,key,event,elapsed:(now.getTime()-prefs.prayerBreakStart)/60000,startedAt:prefs.prayerBreakStart,prev,next};}
    if(testPrayer!=='none'){const event=testPrayer==='lead'?next[0]:prev[0];return{signal:testPrayer,key:'test',event,elapsed:0,prev,next};}
    const elapsed=(h-prev[1])*60,until=(next[1]-h)*60,prevDate=prev[1]<0?new Date(now.getTime()-864e5):now,key=eventKey(prevDate,prev[0]),ack=!!prefs.acknowledged[key],snoozedUntil=prefs.snoozed[key]||0;
    if(!ack&&snoozedUntil>Date.now())return{signal:'snoozed',key,event:prev[0],elapsed,remaining:(snoozedUntil-Date.now())/60000,prev,next};
    if(!ack&&elapsed>=0&&elapsed<=prefs.dueWindow)return{signal:'due',key,event:prev[0],elapsed,prev,next};
    if(until>0&&until<=prefs.lead)return{signal:'lead',key:eventKey(now,next[0]),event:next[0],elapsed:-until,prev,next};
    if(!ack&&elapsed>prefs.dueWindow)return{signal:'pending',key,event:prev[0],elapsed,prev,next};
    return{signal:'none',key,event:next[0],elapsed:-until,prev,next};
  }
  function hydrationPlan(){
    const {start,end}=workRange(),durationMinutes=Math.max(60,(end-start)*60),cadence=prefs.sipCadence;
    const total=Math.max(1,Math.round(durationMinutes/cadence)),amount=prefs.waterTarget/total,firstOffset=cadence/2;
    return{start,end,durationMinutes,cadence,total,amount,firstOffset};
  }
  function waterState(now,h){
    const plan=hydrationPlan(),within=isConfiguredWorkday(now)&&h>=plan.start&&h<plan.end,elapsed=(h-plan.start)*60;
    const expected=Math.min(plan.total,Math.max(0,Math.floor((elapsed-plan.firstOffset)/plan.cadence)+1));
    const sips=testRoutine==='showcase'?Math.round(plan.total*.48):Math.min(plan.total,prefs.waterSips||0);
    const complete=sips>=plan.total,paused=!!prefs.awayStart||!!prefs.lunchStart||!!prefs.prayerBreakStart,last=Math.max(Number(prefs.waterLastAt)||0,workdayStartAt(now)),since=Math.max(0,now.getTime()-last),remaining=Math.max(0,plan.cadence*60000-since),due=(prefs.workReminders&&within&&!paused&&!complete&&since>=plan.cadence*60000&&Date.now()>=prefs.waterGraceUntil)||testRoutine==='water';
    const nextAt=h+remaining/3600000,cueKey=`${dayKey(now)}:water:${Math.floor(last/60000)}`;
    return{within,complete,due,paused,expected,sips,total:plan.total,amount:plan.amount,target:prefs.waterTarget,progress:sips/plan.total,nextAt,cadence:plan.cadence,remaining,cueKey};
  }
  function gazeState(now,h){
    const {start,end}=workRange(),within=isConfiguredWorkday(now)&&h>=start&&h<end,paused=!!prefs.awayStart||!!prefs.lunchStart||!!prefs.prayerBreakStart;
    const base=new Date(now);base.setHours(Math.floor(start),Math.round((start%1)*60),0,0);
    const last=Math.max(Number(prefs.gazeLastAt)||0,latestRecoveryAt(),base.getTime()),elapsed=Math.max(0,now.getTime()-last),due=prefs.gazeEnabled&&prefs.workReminders&&within&&!paused&&Date.now()>=prefs.gazeSnoozedUntil&&elapsed>=prefs.gazeCadence*60000;
    return{within,paused,due,elapsed,remaining:Math.max(0,prefs.gazeCadence*60000-elapsed)};
  }
  function completeGaze(){prefs.gazeLastAt=Date.now();prefs.gazeSnoozedUntil=0;save();toast('Distance-look reset logged · look far for about 20 seconds');render();return true;}
  function snoozeGaze(){prefs.gazeSnoozedUntil=Date.now()+10*60000;save();toast('Distance-look cue paused for 10 min');render();return true;}

  function latestRecoveryAt(){
    const ended=[...(prefs.awaySessions||[]),...(prefs.prayerSessions||[]),...(prefs.lunchSessions||[]).filter(s=>s.mode==='away')].map(s=>Number(s.end)||0);
    return ended.length?Math.max(...ended):0;
  }
  function bodyState(now,h){
    const {start,end}=workRange(),within=isConfiguredWorkday(now)&&h>=start&&h<end,paused=!!prefs.awayStart||!!prefs.lunchStart||!!prefs.prayerBreakStart;
    const base=new Date(now);base.setHours(Math.floor(start),Math.round((start%1)*60),0,0);
    const last=Math.max(Number(prefs.bodyLastAt)||0,latestRecoveryAt(),base.getTime()),elapsed=Math.max(0,now.getTime()-last),active=Boolean(prefs.bodyResetStart),activeElapsed=active?Math.max(0,now.getTime()-prefs.bodyResetStart):0;
    const due=prefs.bodyEnabled&&prefs.workReminders&&within&&!paused&&!active&&Date.now()>=prefs.bodySnoozedUntil&&elapsed>=prefs.bodyCadence*60000;
    return{within,paused,active,due,elapsed,activeElapsed,remaining:Math.max(0,prefs.bodyCadence*60000-elapsed),prompt:BODY_PROMPTS[prefs.bodyPromptIndex]||BODY_PROMPTS[0]};
  }
  function startBodyReset(){if(prefs.bodyResetStart)return true;prefs.bodyResetStart=Date.now();prefs.bodySnoozedUntil=0;save();openFold('care');toast('Movement reset started · Pacefold stays quiet');render();return true;}
  function finishBodyReset(cancel=false){
    if(!prefs.bodyResetStart){if(!cancel)startBodyReset();return true;}
    const end=Date.now(),start=prefs.bodyResetStart,seconds=Math.max(1,Math.round((end-start)/1000)),prompt=prefs.bodyPromptIndex;prefs.bodyResetStart=0;prefs.bodyLastAt=end;prefs.bodySnoozedUntil=0;
    if(!cancel)prefs.bodySessions=[...(prefs.bodySessions||[]),{start,end,seconds:Math.min(1800,seconds),prompt}].slice(-30);
    prefs.bodyPromptIndex=(prefs.bodyPromptIndex+1)%BODY_PROMPTS.length;save();toast(cancel?'Movement reset cancelled':`Movement reset logged · ${seconds}s`);render();if(foldMode==='care')renderFold();return true;
  }
  function snoozeBody(){prefs.bodySnoozedUntil=Date.now()+10*60000;save();toast('Movement cue paused for 10 min');render();return true;}

  function noodleState(now,h){
    const {start,end}=workRange(),within=isConfiguredWorkday(now)&&h>=start&&h<end,total=(prefs.noodleDurationAtStart||prefs.noodleMinutes)*60000;
    if(testRoutine==='noodle')return{state:'ready',ready:true,running:false,pre:false,remain:0,progress:1,within,age:4*60000};
    if(testRoutine==='showcase')return{state:'running',ready:false,running:true,pre:false,remain:18*60000+42*1000,progress:.38,within,age:0};
    if(prefs.noodleStart){const elapsed=now.getTime()-prefs.noodleStart,remain=total-elapsed;if(remain>0)return{state:remain<=prefs.noodlePrealert*60000?'pre':'running',ready:false,running:true,pre:remain<=prefs.noodlePrealert*60000,remain,progress:Math.min(1,Math.max(0,elapsed/total)),within,age:0};return{state:'ready',ready:true,running:false,pre:false,remain:0,progress:1,within,age:-remain};}
    if(prefs.noodleDone===dayKey(now))return{state:'done',ready:false,running:false,pre:false,remain:0,progress:1,within,age:0};
    return{state:'idle',ready:false,running:false,pre:false,remain:0,progress:0,within,age:0};
  }
  function awayState(now,h){
    const {start,end}=workRange(),within=isConfiguredWorkday(now)&&h>=start&&h<end;
    if(testRoutine==='away')return{active:true,within,elapsed:7*60000,long:false,count:currentAwaySummary().count,totalMinutes:currentAwaySummary().minutes};
    const summary=currentAwaySummary();
    if(prefs.awayStart){const elapsed=Math.max(0,now.getTime()-prefs.awayStart);return{active:true,within,elapsed,long:elapsed>=12*60000,count:summary.count,totalMinutes:summary.minutes};}
    return{active:false,within,elapsed:0,long:false,count:summary.count,totalMinutes:summary.minutes};
  }
  function lunchState(now,h){
    const {start,end}=workRange(),within=isConfiguredWorkday(now)&&h>=start&&h<end,mode=prefs.lunchModeAtStart||prefs.lunchMode||'desk',minutes=prefs.lunchDurationAtStart||(mode==='away'?prefs.awayLunchMinutes:prefs.deskLunchMinutes),total=minutes*60000;
    if(testRoutine==='lunch')return{state:'ready',ready:true,running:false,pre:false,remain:0,progress:1,within,elapsed:total+3*60000,age:3*60000,mode};
    if(prefs.lunchStart){const elapsed=Math.max(0,now.getTime()-prefs.lunchStart),remain=total-elapsed;if(remain>0)return{state:remain<=prefs.lunchPrealert*60000?'pre':'running',ready:false,running:true,pre:remain<=prefs.lunchPrealert*60000,remain,progress:Math.min(1,elapsed/total),within,elapsed,age:0,mode};return{state:'ready',ready:true,running:false,pre:false,remain:0,progress:1,within,elapsed,age:-remain,mode};}
    if(prefs.lunchDone===dayKey(now)){const last=(prefs.lunchSessions||[]).slice(-1)[0];return{state:'done',ready:false,running:false,pre:false,remain:0,progress:1,within,elapsed:(prefs.lunchLoggedMinutes||0)*60000,age:0,mode:last&&last.mode||prefs.lunchMode};}
    return{state:'idle',ready:false,running:false,pre:false,remain:0,progress:0,within,elapsed:0,age:0,mode:prefs.lunchMode};
  }
  function attentionFor(prayer,water,noodle,away,lunch,gaze,body){
    if(testPrayer!=='none')return{signal:testPrayer,source:'prayer'};
    if(['water','noodle','lunch','away'].includes(testRoutine))return{signal:testRoutine==='away'?'active':'due',source:testRoutine};
    if(noodle.ready)return{signal:'due',source:'noodle'};
    if(prayer.signal==='due')return{signal:'due',source:'prayer'};
    if(lunch.ready)return{signal:'due',source:'lunch'};
    if(prayer.signal==='active')return{signal:'active',source:'prayer'};
    if(prayer.signal==='pending')return{signal:'pending',source:'prayer'};
    if(lunch.pre)return{signal:'lead',source:'lunch'};
    if(noodle.pre)return{signal:'lead',source:'noodle'};
    if(body&&body.due)return{signal:'due',source:'body'};
    if(water.due)return{signal:'due',source:'water'};
    if(gaze&&gaze.due)return{signal:'due',source:'eyes'};
    if(prayer.signal==='snoozed')return{signal:'snoozed',source:'prayer'};
    if(prayer.signal==='lead')return{signal:'lead',source:'prayer'};
    if(lunch.running)return{signal:'active',source:'lunch'};
    if(away.active)return{signal:away.long?'due':'active',source:'away'};
    if(body&&body.active)return{signal:'active',source:'body'};
    return{signal:'none',source:'none'};
  }
  function iconData(signal,source,now=new Date()){
    const iconKey=`${signal}:${source}:${now.getHours()}:${now.getMinutes()}`;
    if(iconKey===liveIconKey&&liveIconUrl)return liveIconUrl;
    const active=signal!=='none';
    const state={
      none:{scale:1,halo:0,fill:.96,stroke:0,shine:0},
      active:{scale:.92,halo:.10,fill:.55,stroke:.7,shine:.16},
      lead:{scale:.86,halo:.12,fill:.12,stroke:1.5,shine:.16},
      snoozed:{scale:.82,halo:.08,fill:.10,stroke:1.4,shine:.12},
      pending:{scale:.98,halo:.18,fill:.62,stroke:.9,shine:.2},
      due:{scale:1.1,halo:.34,fill:1,stroke:0,shine:.28}
    }[signal]||{scale:1,halo:.18,fill:1,stroke:0,shine:.18};

    const spec={
      prayer:{x:24.7,y:7.3,size:3.55,fill:'#b78552',glow:'#efbc7f',shape:'diamond'},
      water:{x:24.8,y:24.7,size:3.35,fill:'#72aede',glow:'#9ed0ff',shape:'dot'},
      noodle:{x:7.3,y:7.3,size:3.35,fill:'#ca9158',glow:'#efb47d',shape:'square'},
      away:{x:7.2,y:24.5,size:3.25,fill:'#6a9b93',glow:'#8ac3b9',shape:'pill'},
      lunch:{x:16,y:26,size:3.6,fill:'#7b8da3',glow:'#a8bfd7',shape:'bar'},
      eyes:{x:16,y:6.2,size:3.2,fill:'#8473aa',glow:'#b9a9df',shape:'pill'},
      body:{x:16,y:6.2,size:3.35,fill:'#738d78',glow:'#a6c1ab',shape:'diamond'},
      none:{x:24.7,y:7.3,size:0,fill:'#7b8796',glow:'#a8b3bf',shape:'dot'}
    }[source]||{x:24.8,y:7.3,size:3.3,fill:'#7b8796',glow:'#a8b3bf',shape:'dot'};

    const baseStroke='#596875';
    const halo=active ? `<circle cx="${spec.x}" cy="${spec.y}" r="${(spec.size*state.scale+2.5).toFixed(2)}" fill="${spec.glow}" fill-opacity="${state.halo.toFixed(2)}"/>` : '';

    function premiumShape(shape){
      const size=spec.size*state.scale, x=spec.x, y=spec.y, fill=spec.fill;
      const common=`fill="${fill}" fill-opacity="${state.fill.toFixed(2)}"`;
      const stroke=state.stroke?`stroke="${fill}" stroke-width="${state.stroke.toFixed(2)}"`:'';
      const shineAlpha=state.shine.toFixed(2);
      if(shape==='dot'){
        return `${halo}<circle cx="${x}" cy="${y}" r="${size.toFixed(2)}" ${common} ${stroke}/><circle cx="${(x-.8).toFixed(2)}" cy="${(y-.95).toFixed(2)}" r="${(size*.42).toFixed(2)}" fill="#ffffff" fill-opacity="${shineAlpha}"/>`;
      }
      if(shape==='square'){
        const side=(size*2).toFixed(2), left=(x-size).toFixed(2), top=(y-size).toFixed(2), radius=(size*.5).toFixed(2);
        return `${halo}<rect x="${left}" y="${top}" width="${side}" height="${side}" rx="${radius}" ry="${radius}" ${common} ${stroke}/><rect x="${(x-size*.55).toFixed(2)}" y="${(y-size*.62).toFixed(2)}" width="${(size*.8).toFixed(2)}" height="${(size*.45).toFixed(2)}" rx="${(size*.24).toFixed(2)}" fill="#ffffff" fill-opacity="${shineAlpha}"/>`;
      }
      if(shape==='pill'){
        const width=(size*1.45).toFixed(2),height=(size*2.2).toFixed(2),left=(x-size*.725).toFixed(2),top=(y-size*1.1).toFixed(2),radius=(size*.72).toFixed(2);
        return `${halo}<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${radius}" ${common} ${stroke}/><circle cx="${(x-.35).toFixed(2)}" cy="${(y-size*.45).toFixed(2)}" r="${(size*.24).toFixed(2)}" fill="#ffffff" fill-opacity="${shineAlpha}"/>`;
      }
      if(shape==='bar'){
        const width=(size*2.25).toFixed(2),height=(size*.9).toFixed(2),left=(x-size*1.125).toFixed(2),top=(y-size*.45).toFixed(2),radius=(size*.45).toFixed(2);
        return `${halo}<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${radius}" ${common} ${stroke}/><rect x="${(x-size*.75).toFixed(2)}" y="${(y-size*.24).toFixed(2)}" width="${(size*.85).toFixed(2)}" height="${(size*.18).toFixed(2)}" rx="${(size*.09).toFixed(2)}" fill="#ffffff" fill-opacity="${shineAlpha}"/>`;
      }
      const pts=`${x},${(y-size).toFixed(2)} ${(x+size).toFixed(2)},${y} ${x},${(y+size).toFixed(2)} ${(x-size).toFixed(2)},${y}`;
      const pts2=`${x},${(y-size*.42).toFixed(2)} ${(x+size*.42).toFixed(2)},${y} ${x},${(y+size*.42).toFixed(2)} ${(x-size*.42).toFixed(2)},${y}`;
      return `${halo}<polygon points="${pts}" ${common} ${stroke} stroke-linejoin="round"/><polygon points="${pts2}" fill="#ffffff" fill-opacity="${shineAlpha}"/>`;
    }

    const point=(angle,length)=>{const rad=(angle-90)*Math.PI/180;return{x:(16+Math.cos(rad)*length).toFixed(2),y:(16+Math.sin(rad)*length).toFixed(2)};};
    const minutePoint=point((now.getMinutes()+now.getSeconds()/60)*6,7.2),hourPoint=point(((now.getHours()%12)+now.getMinutes()/60)*30,5.2),badge=active?premiumShape(spec.shape):'';
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10.5" fill="none" stroke="${baseStroke}" stroke-width="2"/><path d="M16 16L${hourPoint.x} ${hourPoint.y}M16 16L${minutePoint.x} ${minutePoint.y}" fill="none" stroke="${baseStroke}" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="16" r="1.15" fill="#587894"/><path d="M12.2 5.9L19.7 26" stroke="#587894" stroke-width=".75" stroke-opacity=".48"/><rect x="25.7" y="25.7" width="2.1" height="2.1" rx=".4" fill="#b85b48" fill-opacity=".72"/>${badge}</svg>`;
    liveIconKey=iconKey;liveIconUrl=`data:image/svg+xml,${encodeURIComponent(svg)}`;return liveIconUrl;
  }
  function notificationPermission(){return !('Notification'in window)?'unsupported':Notification.permission;}
  function notificationStatusText(){
    const permission=notificationPermission();
    if(permission==='unsupported')return'Unavailable';
    if(permission==='denied')return'Blocked in Edge';
    if(permission==='granted'&&prefs.browserNotif)return prefs.notificationMode==='all'?'On · every cue':'On · quiet essentials';
    if(permission==='granted')return'Allowed · off';
    return'Off · optional';
  }
  function notificationAllowed(source){return prefs.notificationMode==='all'||['prayer','noodle','lunch'].includes(source);}
  function notificationActionTitle(source){return({prayer:'Clear',water:'Done',noodle:'Collected',away:'Back',lunch:'Done',eyes:'Done',body:'Done',test:'Clear'}[source]||'Clear');}
  function privateNotificationTitle(source){return({prayer:'Scheduled moment',water:'Sip pause',noodle:'Preparation timer',away:'Away timer',lunch:'Meal timer',eyes:'Distance look',body:'Position change',test:'Quiet alert preview'}[source]||'Workday cue');}
  function notificationIcon(source){const safe=['prayer','water','noodle','away','lunch','eyes','body','test'].includes(source)?source:'test';return new URL(`./icons/notification-${safe}.png`,location.href).href;}
  async function notificationWorkerReady(timeout=1800){
    if(!navigator.serviceWorker)return null;
    try{return await Promise.race([navigator.serviceWorker.ready,new Promise(resolve=>setTimeout(()=>resolve(null),timeout))]);}
    catch(error){reportError(error,'notification-worker-ready');return null;}
  }
  async function showSystemNotification(key,text,source='prayer',test=false,specOnly=false){
    if(!test&&(!prefs.browserNotif||!notificationAllowed(source)))return false;
    if(!specOnly&&notificationPermission()!=='granted')return false;
    if(!test&&(sent.has(key)||prefs.notified[key]))return false;
    if(!test){sent.add(key);prefs.notified[key]=Date.now();save();}
    const generic=prefs.notificationDetail==='generic';
    const title=generic?`Pacefold · ${privateNotificationTitle(source)}`:text;
    const body=source==='test'?'This is the quieter alert style.':'Clear here · open Pacefold for detail.';
    const icon=notificationIcon(source),actions=[{action:'ack',title:notificationActionTitle(source)}];
    const options={body,silent:true,tag:`pacefold-${key}`,renotify:false,requireInteraction:false,timestamp:Date.now(),icon,badge:icon,actions,data:{key,url:new URL('./',location.href).href,source,version:APP_VERSION}};
    window.dispatchEvent(new CustomEvent('pacefold:notification',{detail:{title,options}}));
    if(specOnly)return true;
    try{
      const registration=workerRegistration||await notificationWorkerReady();
      if(registration&&registration.showNotification){await registration.showNotification(title,options);return true;}
      if(typeof Notification==='function'){new Notification(title,options);return true;}
      if(!test){sent.delete(key);delete prefs.notified[key];save();}
      return false;
    }catch(error){
      if(!test){sent.delete(key);delete prefs.notified[key];save();}
      reportError(error,'notification-show');return false;
    }
  }
  function notifyOnce(key,text,source='prayer'){void showSystemNotification(key,text,source,false);}
  async function requestNotifications(test=false){
    if(notificationPermission()==='unsupported'){toast('System notifications are unavailable here');return false;}
    if(notificationPermission()==='denied'){prefs.browserNotif=false;save();toast('Notifications are blocked · use Edge site permissions');return false;}
    try{
      const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
      prefs.browserNotif=permission==='granted';save();
      if(permission!=='granted'){toast('Notification permission was not enabled');return false;}
      if(test){
        toast('Sending a test notification');
        const delivered=await showSystemNotification(`test-${Date.now()}`,'Pacefold notification test','test',true);
        if(!delivered){prefs.browserNotif=false;save();toast('Permission allowed · test delivery failed');renderSetupDock();return false;}
        toast('Test notification sent');
      }else toast('Quiet system alerts enabled');
      renderSetupDock();return true;
    }catch(error){reportError(error,'notification-permission');toast('Notifications could not be enabled');return false;}
  }
  async function closePacefoldNotifications(){
    try{const registration=workerRegistration||await notificationWorkerReady(1000),items=registration&&registration.getNotifications?await registration.getNotifications():[];items.filter(item=>String(item.tag||'').startsWith('pacefold-')).forEach(item=>item.close());if('clearAppBadge'in navigator)await navigator.clearAppBadge();lastBadge='';return items.length;}
    catch(error){reportError(error,'notification-close');return 0;}
  }
  function notificationActionLabel(source){return({prayer:scheduleNoun(),water:'Sip cue',noodle:`${prepName()} timer`,away:'Away timer',lunch:'Meal timer',eyes:'Eye reset',body:'Movement reset',test:'Test alert'}[source]||'Cue');}
  async function applyNotificationAction(item){
    const data=item&&item.data||{},id=String(item&&item.id||''),source=['prayer','water','noodle','away','lunch','eyes','body','test'].includes(data.source)?data.source:'test',action=item&&item.action==='snooze'?'snooze':'ack',key=String(data.key||'');
    if(!id)return false;
    if(prefs.notificationActionHistory.some(entry=>entry.id===id)){navigator.serviceWorker?.controller?.postMessage({type:'PACEFOLD_ACTION_CONSUMED',id});return true;}
    let outcome='Recorded';
    if(action==='snooze'){
      const until=Date.now()+prefs.snoozeMinutes*60000;
      if(source==='prayer'&&key){prefs.snoozed[key]=until;delete prefs.acknowledged[key];outcome=`Snoozed ${prefs.snoozeMinutes} min`;}
      else if(source==='water'){prefs.waterGraceUntil=until;outcome=`Sip cue paused ${prefs.snoozeMinutes} min`;}
      else if(source==='eyes'){prefs.gazeSnoozedUntil=until;outcome=`Eye cue paused ${prefs.snoozeMinutes} min`;}
      else if(source==='body'){prefs.bodySnoozedUntil=until;outcome=`Movement cue paused ${prefs.snoozeMinutes} min`;}
      else if(source==='noodle'&&prefs.noodleStart){const total=prefs.noodleDurationAtStart||prefs.noodleMinutes;prefs.noodleStart=Date.now()-(total-5)*60000;outcome='Prep timer extended 5 min';}
      else if(source==='lunch'&&prefs.lunchStart){const total=prefs.lunchDurationAtStart||((prefs.lunchModeAtStart||prefs.lunchMode)==='away'?prefs.awayLunchMinutes:prefs.deskLunchMinutes);prefs.lunchStart=Date.now()-(total-5)*60000;outcome='Meal timer extended 5 min';}
      else outcome='Cue cleared';
    }else if(source==='prayer'){
      if(prefs.prayerBreakStart){finishPrayerBreak(false);outcome=`${scheduleNoun()} pause logged`;}
      else if(key&&key!=='test'){prefs.acknowledged[key]=Date.now();delete prefs.snoozed[key];outcome=`${scheduleNoun()} acknowledged`;}
      else outcome='Test alert cleared';
    }else if(source==='water'){logWater(1);outcome='Sip break logged';}
    else if(source==='noodle'){if(prefs.noodleStart){finishNoodles();outcome=`${prepName()} completed`;}else outcome='Prep cue already clear';}
    else if(source==='lunch'){if(prefs.lunchStart){finishLunch();outcome='Meal session logged';}else outcome='Meal cue already clear';}
    else if(source==='away'){if(prefs.awayStart){finishAway();outcome='Return logged';}else outcome='Away cue already clear';}
    else if(source==='eyes'){completeGaze();outcome='Distance look logged';}
    else if(source==='body'){const end=Number(item.at)||Date.now(),start=Math.max(0,end-60000);prefs.bodyResetStart=0;prefs.bodyLastAt=end;prefs.bodySnoozedUntil=0;prefs.bodySessions=[...(prefs.bodySessions||[]),{start,end,seconds:60,prompt:prefs.bodyPromptIndex}].slice(-30);prefs.bodyPromptIndex=(prefs.bodyPromptIndex+1)%BODY_PROMPTS.length;outcome='Movement reset logged';}
    else outcome='Test alert cleared';
    prefs.notificationActionHistory=[...(prefs.notificationActionHistory||[]),{id,key,source,action,at:Number(item.at)||Date.now(),outcome}].slice(-60);
    save();await closePacefoldNotifications();render();toast(`${notificationActionLabel(source)} · ${outcome}`);
    navigator.serviceWorker?.controller?.postMessage({type:'PACEFOLD_ACTION_CONSUMED',id});return true;
  }
  async function drainNotificationActions(){
    if(notificationDrainActive||!navigator.serviceWorker?.controller)return false;notificationDrainActive=true;
    try{
      const channel=new MessageChannel(),response=new Promise(resolve=>{const timer=setTimeout(()=>resolve({actions:[]}),1600);channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data||{actions:[]});};});
      navigator.serviceWorker.controller.postMessage({type:'PACEFOLD_DRAIN_ACTIONS'},[channel.port2]);
      const {actions=[]}=await response;for(const item of actions)await applyNotificationAction(item);return actions.length>0;
    }catch(error){reportError(error,'notification-action-drain');return false;}finally{notificationDrainActive=false;}
  }
  function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('on');toastTimer=setTimeout(()=>$('toast').classList.remove('on'),1900);}
  function revealFor(ms=6500){clearTimeout(revealTimer);document.body.classList.add('reveal');revealTimer=setTimeout(()=>{if(prefs.privacy)document.body.classList.remove('reveal');},ms);}

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const kindLabel=kind=>({'inbox':'Inbox','follow-up':'Follow-up','incident':'Incident','inspection':'Inspection','jhsc':'JHSC','construction':'Construction','notification':'Notification','meeting':'Meeting','resource':'Resource'}[kind]||'Inbox');
  const soundName=choice=>({brown:'Brown hush',rain:'Rain glass',fan:'Soft fan',custom:prefs.soundLabel||localAudioLabel||'Custom audio'}[choice]||'Sound');
  const pendingCaptures=()=>prefs.captures.filter(item=>!item.syncedAt);
  function oneNoteStatus(){
    const queued=pendingCaptures().length;
    if(oneNoteSyncing)return{text:queued?`Syncing ${queued}`:'Syncing',tone:'queued'};
    if(!prefs.oneNoteClientId||!prefs.oneNoteSectionId)return{text:queued?`${queued} local`:'Local',tone:queued?'queued':''};
    if(prefs.oneNoteLastError)return{text:queued?`${queued} queued`:'Sync paused',tone:'blocked'};
    if(queued)return{text:`${queued} queued`,tone:'queued'};
    return{text:prefs.oneNoteLastSync?'Synced':'Connected',tone:'synced'};
  }
  function renderQuietDock(body=bodyState(new Date(),new Date().getHours()+new Date().getMinutes()/60)){
    const today=dayKey(new Date()),todayCount=prefs.captures.filter(item=>item.day===today).length,status=oneNoteStatus();
    $('captureText').textContent=todayCount?`Capture · ${todayCount}`:'Capture';
    $('careBtn').className='quiet-tool care-tool';if(body.due)$('careBtn').classList.add('due');if(body.active)$('careBtn').classList.add('due');
    $('careText').textContent=body.active?`Move ${mmss(Math.max(0,60000-body.activeElapsed))}`:body.due?'Move now':prefs.bodyEnabled?`Move ${Math.ceil(body.remaining/60000)}m`:'Care off';
    $('soundBtn').className=`quiet-tool sound-tool${soundPlaying?' playing':''}`;$('soundText').textContent=soundPlaying?soundName(prefs.soundChoice):'Sound';
    $('syncBtn').className=`quiet-tool sync-tool ${status.tone}`;$('syncText').textContent=status.text;$('quietDock').classList.toggle('attention',body.due||status.tone==='queued');
  }
  function openFold(mode='capture'){
    foldMode=['capture','care','sound','onenote'].includes(mode)?mode:'capture';const drawer=$('foldDrawer');drawer.hidden=false;document.body.classList.add('fold-open');togglePanel(false);renderFold();
    if(foldMode==='capture')setTimeout(()=>$('captureInput')?.focus(),70);
  }
  function closeFold(){const drawer=$('foldDrawer');if(drawer)drawer.hidden=true;document.body.classList.remove('fold-open');applyPendingReload();}
  function renderCaptureFold(){
    $('foldKicker').textContent='Kiroku';$('foldTitle').textContent='Capture without leaving the day';const status=oneNoteStatus(),recent=[...prefs.captures].filter(item=>item.day===dayKey(new Date())).slice(-6).reverse();
    $('foldBody').innerHTML=`<form class="capture-form" id="captureForm"><textarea class="capture-input" id="captureInput" maxlength="1200" placeholder="A note, task, follow-up, decision or useful wording…">${escapeHtml(captureDraft)}</textarea><div class="kind-row">${CAPTURE_KINDS.map(kind=>`<button class="kind-chip ${captureDraftKind===kind?'active':''}" data-capture-kind="${kind}" type="button">${kindLabel(kind)}</button>`).join('')}</div><div class="capture-actions"><span class="capture-status">Saved locally first · <strong>${escapeHtml(status.text)}</strong></span><button class="capture-save" type="submit" ${captureDraft.trim()?'':'disabled'}>Keep this</button></div></form>${recent.length?`<div class="fold-section"><span class="fold-section-title">Today</span><div class="capture-list">${recent.map(item=>`<div class="capture-row"><time>${new Date(item.createdAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time><p>${escapeHtml(item.text)}</p><em>${kindLabel(item.kind)} · ${item.syncedAt?'OneNote':'local'}</em></div>`).join('')}</div></div>`:'<div class="capture-empty">Nothing captured today. Pacefold will not create busywork for you.</div>'}<p class="drawer-note">${prefs.oneNoteSectionId?`Connected to <strong>${escapeHtml(prefs.oneNoteNotebookName)} › ${escapeHtml(prefs.oneNoteSectionName)}</strong>. New captures queue offline and append silently when Microsoft access is available.`:'Everything stays on this device until you choose a OneNote destination. Capture works fully without a Microsoft connection.'}</p>`;
  }
  function renderCareFold(){
    const now=new Date(),h=now.getHours()+now.getMinutes()/60,body=bodyState(now,h),prompt=body.prompt,elapsed=body.active?body.activeElapsed:0,progress=Math.min(100,elapsed/60000*100);
    $('foldKicker').textContent='Ma · care';$('foldTitle').textContent=body.active?'One quiet minute':'Change position before discomfort accumulates';
    $('foldBody').innerHTML=`<div class="care-card"><span class="care-count">${body.active?`${Math.max(0,Math.ceil((60000-elapsed)/1000))} seconds`:`Next reset · ${body.due?'now':Math.ceil(body.remaining/60000)+' min'}`}</span><h3>${escapeHtml(prompt.title)}</h3><p>${escapeHtml(prompt.detail)}</p><div class="care-progress"><i style="--care-progress:${progress.toFixed(1)}%"></i></div></div><div class="care-controls">${body.active?'<button class="fold-action primary" data-fold-action="finishBody" type="button">Done · return differently</button><button class="fold-action" data-fold-action="cancelBody" type="button">Cancel</button>':'<button class="fold-action primary" data-fold-action="startBody" type="button">Start 60-second reset</button><button class="fold-action" data-fold-action="snoozeBody" type="button">Later · 10m</button>'}<button class="fold-action" data-fold-action="completeEyes" type="button">Log 20-second distance look</button></div><div class="care-options">${[30,45,60,90].map(v=>`<button class="care-choice ${prefs.bodyCadence===v?'active':''}" data-body-cadence="${v}" type="button">Move · ${v}m</button>`).join('')}</div><p class="drawer-note"><strong>Break-aware by design.</strong> Meals, scheduled pauses and away sessions reset the movement clock, so Pacefold does not demand a redundant break. Eye cues use the 20-20-20 approach; full-display colour remains under Windows or monitor control.</p>`;
  }
  function renderSoundFold(){
    $('foldKicker').textContent='Oto · optional';$('foldTitle').textContent='A sound layer that yields to the day';
    $('foldBody').innerHTML=`<div class="sound-now"><div class="sound-orb">${soundPlaying?'Ⅱ':'▶'}</div><div class="sound-copy"><strong>${escapeHtml(soundName(prefs.soundChoice))}</strong><span>${soundPlaying?'Playing quietly':'Stopped'}${prefs.soundDuck?' · cues duck the volume':''}</span></div><button class="sound-toggle" data-fold-action="toggleSound" type="button" aria-label="${soundPlaying?'Pause':'Play'}">${soundPlaying?'Ⅱ':'▶'}</button></div><div class="sound-grid">${[['brown','Brown hush'],['rain','Rain glass'],['fan','Soft fan'],['custom','Your audio']].map(([id,label])=>`<button class="sound-choice ${prefs.soundChoice===id?'active':''}" data-sound-choice="${id}" type="button">${label}</button>`).join('')}</div><label class="volume-row"><span>Quiet</span><input id="soundVolume" type="range" min="0" max="1" value="${prefs.soundVolume}" step="0.01"><span>Present</span></label><div class="sound-controls"><button class="fold-action" data-fold-action="pickAudio" type="button">Choose local audio</button><button class="fold-action" data-fold-action="toggleDuck" type="button">Cue ducking · ${prefs.soundDuck?'on':'off'}</button></div><div class="source-row"><input id="soundUrl" type="url" inputmode="url" placeholder="Optional direct HTTPS audio stream" value="${escapeHtml(prefs.soundUrl)}"><button class="fold-action" data-fold-action="saveSoundUrl" type="button">Use URL</button></div><p class="drawer-note"><strong>Offline textures, not fake streaming.</strong> Brown hush, Rain glass and Soft fan are generated on this device. A local file lasts for this session; a direct audio URL can be saved. Spotify, YouTube Music and Amazon pages are not controllable from this private PWA.</p>`;
  }
  function renderOneNoteFold(){
    $('foldKicker').textContent='Kiroku · Microsoft 365';$('foldTitle').textContent='OneNote, quietly underneath';const status=oneNoteStatus();
    let content=`<div class="integration-status"><span>Capture store</span><strong>Local first</strong><span>Microsoft status</span><strong class="${status.tone==='synced'?'good':status.tone?'warn':''}">${escapeHtml(status.text)}</strong><span>Destination</span><strong>${prefs.oneNoteSectionId?`${escapeHtml(prefs.oneNoteNotebookName)} › ${escapeHtml(prefs.oneNoteSectionName)}`:'Not selected'}</strong></div>`;
    if(!prefs.oneNoteClientId){
      content+=`<p class="drawer-note"><strong>One-time Microsoft setup is required.</strong> A static GitHub app cannot invent an Office identity. Register Pacefold as a Microsoft single-page app, add this exact redirect URI—<strong>${escapeHtml(new URL('./auth.html',location.href).href)}</strong>—and grant delegated <strong>Notes.ReadWrite</strong>. No client secret belongs in Pacefold.</p><div class="integration-fields"><div class="integration-field"><label for="oneNoteClientId">Microsoft application (client) ID</label><input id="oneNoteClientId" autocomplete="off" placeholder="00000000-0000-0000-0000-000000000000"></div><div class="integration-field"><label for="oneNoteTenant">Tenant ID, domain, or organizations</label><input id="oneNoteTenant" value="${escapeHtml(prefs.oneNoteTenant)}" autocomplete="off"></div></div><div class="care-controls"><button class="fold-action primary" data-fold-action="saveOneNoteConfig" type="button">Save and sign in</button><a class="fold-action" href="../onenote-setup.html" target="_blank" rel="noopener">Exact setup guide</a></div>`;
    }else if(oneNoteStage==='notebooks'&&oneNoteCatalog.length){
      content+=`<div class="fold-section"><span class="fold-section-title">Choose notebook</span><div class="notebook-grid">${oneNoteCatalog.map((item,index)=>`<button class="notebook-choice" data-onenote-notebook="${index}" type="button"><strong>${escapeHtml(item.displayName||item.name||'Notebook')}</strong><small>${item.isDefault?'Default notebook':'Microsoft OneNote'}</small></button>`).join('')}</div></div>`;
    }else if(oneNoteStage==='sections'&&oneNoteCatalog.length){
      content+=`<div class="fold-section"><span class="fold-section-title">Choose the section Pacefold may append to</span><div class="notebook-grid">${oneNoteCatalog.map((item,index)=>`<button class="notebook-choice" data-onenote-section="${index}" type="button"><strong>${escapeHtml(item.displayName||item.name||'Section')}</strong><small>${escapeHtml(prefs.oneNoteNotebookName)}</small></button>`).join('')}</div></div><button class="fold-action" data-fold-action="listNotebooks" type="button">Back to notebooks</button>`;
    }else{
      content+=`<p class="drawer-note">Pacefold creates one dated page per day in the selected section and appends captures with their time and category. It does not upload sip-by-sip or surveillance-style activity.</p><div class="care-controls"><button class="fold-action primary" data-fold-action="connectOneNote" type="button">${prefs.oneNoteSectionId?'Reconnect / change destination':'Sign in and choose destination'}</button>${pendingCaptures().length?'<button class="fold-action" data-fold-action="syncOneNote" type="button">Sync queued captures</button>':''}<button class="fold-action" data-fold-action="disconnectOneNote" type="button">Disconnect</button></div>`;
    }
    $('foldBody').innerHTML=content;
  }
  function renderFold(){if(!$('foldDrawer')||$('foldDrawer').hidden)return;if(foldMode==='care')renderCareFold();else if(foldMode==='sound')renderSoundFold();else if(foldMode==='onenote')renderOneNoteFold();else renderCaptureFold();}
  function saveCapture(){
    const textValue=captureDraft.trim();if(!textValue){toast('Write something first');return false;}const createdAt=Date.now(),item={id:`${createdAt.toString(36)}-${Math.random().toString(36).slice(2,8)}`,text:textValue.slice(0,1200),kind:CAPTURE_KINDS.includes(captureDraftKind)?captureDraftKind:'inbox',createdAt,day:dayKey(new Date(createdAt)),syncedAt:0,syncError:''};
    prefs.captureKind=item.kind;prefs.captures=[...prefs.captures,item].slice(-300);captureDraft='';try{localStorage.removeItem(CAPTURE_DRAFT_KEY);}catch(_){ }save();renderQuietDock();renderFold();toast(prefs.oneNoteSectionId?'Captured locally · OneNote queued':'Captured locally');void syncCaptureQueue(false);return true;
  }

  function buildNoiseBuffer(context,choice){
    const length=Math.floor(context.sampleRate*8),buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);let brown=0;
    for(let i=0;i<length;i++){const white=Math.random()*2-1;if(choice==='brown'){brown=(brown+.035*white)/1.035;data[i]=brown*3.2;}else if(choice==='rain'){const drop=Math.random()<.0007?(Math.random()*2-1)*.9:0;data[i]=white*.23+drop;}else data[i]=white*.16+Math.sin(i/context.sampleRate*Math.PI*2*58)*.018;}
    const edge=Math.min(1200,Math.floor(length/10));for(let i=0;i<edge;i++){const mix=i/edge,tail=length-edge+i,a=data[i],b=data[tail];data[i]=a*mix+b*(1-mix);data[tail]=data[i];}return buffer;
  }
  function updateMediaSession(){try{if('mediaSession'in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:soundName(prefs.soundChoice),artist:'Pacefold',album:'Quiet workday layer'});navigator.mediaSession.playbackState=soundPlaying?'playing':'paused';}}catch(error){reportError(error,'media-session');}}
  async function startSound(){
    try{
      stopSound(false);const choice=prefs.soundChoice;
      if(choice==='custom'){
        const source=localAudioUrl||prefs.soundUrl;if(!source){openFold('sound');toast('Choose local audio or add a direct audio URL');return false;}const audio=$('audioPlayer');audio.src=source;audio.loop=true;audio.volume=prefs.soundVolume;await audio.play();soundPlaying=true;
      }else{
        const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext){toast('Generated sound is unavailable in this browser');return false;}soundContext=new AudioContext();soundGain=soundContext.createGain();soundGain.gain.value=prefs.soundVolume;const filter=soundContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=choice==='rain'?3600:choice==='fan'?1100:720;filter.Q.value=choice==='fan'?1.2:.45;soundSource=soundContext.createBufferSource();soundSource.buffer=buildNoiseBuffer(soundContext,choice);soundSource.loop=true;soundSource.connect(filter).connect(soundGain).connect(soundContext.destination);soundSource.start();soundPlaying=true;
      }
      updateMediaSession();renderQuietDock();if(foldMode==='sound')renderFold();return true;
    }catch(error){reportError(error,'sound-start');soundPlaying=false;toast('Audio could not start · check the source or browser policy');renderQuietDock();return false;}
  }
  function stopSound(update=true){
    try{if(soundSource)soundSource.stop();}catch(_){ }soundSource=null;soundGain=null;if(soundContext){soundContext.close().catch(()=>{});soundContext=null;}const audio=$('audioPlayer');if(audio){audio.pause();audio.removeAttribute('src');audio.load();}soundPlaying=false;updateMediaSession();if(update){renderQuietDock();if(foldMode==='sound')renderFold();}
  }
  function setSoundVolume(value){prefs.soundVolume=clamp(value,0,1,.24);if(soundGain&&soundContext)soundGain.gain.setTargetAtTime(prefs.soundVolume,soundContext.currentTime,.08);if($('audioPlayer'))$('audioPlayer').volume=prefs.soundVolume;save();}
  function duckSound(attention){if(!soundPlaying)return;const duck=prefs.soundDuck&&attention&&['due','pending'].includes(attention.signal),level=prefs.soundVolume*(duck ? .28 : 1);if(soundGain&&soundContext)soundGain.gain.setTargetAtTime(level,soundContext.currentTime,.16);if($('audioPlayer'))$('audioPlayer').volume=level;}

  const oneNoteScopes=['Notes.ReadWrite'];
  async function initOneNote(){
    if(!prefs.oneNoteClientId||!window.msal)return null;const stamp=`${prefs.oneNoteClientId}:${prefs.oneNoteTenant}`;if(oneNoteClient&&oneNoteClientStamp===stamp)return oneNoteClient;
    oneNoteClientStamp=stamp;oneNoteClient=new window.msal.PublicClientApplication({auth:{clientId:prefs.oneNoteClientId,authority:`https://login.microsoftonline.com/${prefs.oneNoteTenant||'organizations'}`,redirectUri:new URL('./auth.html',location.href).href},cache:{cacheLocation:'localStorage',storeAuthStateInCookie:false}});await oneNoteClient.initialize();try{const result=await oneNoteClient.handleRedirectPromise();if(result?.account)oneNoteClient.setActiveAccount(result.account);}catch(error){reportError(error,'onenote-redirect');}const account=oneNoteClient.getActiveAccount()||oneNoteClient.getAllAccounts()[0];if(account)oneNoteClient.setActiveAccount(account);return oneNoteClient;
  }
  async function oneNoteToken(interactive=false){
    const client=await initOneNote();if(!client)throw new Error('Microsoft connection is not configured');let account=client.getActiveAccount()||client.getAllAccounts()[0];
    if(!account){if(!interactive)throw new Error('Microsoft sign-in required');const login=await client.loginPopup({scopes:oneNoteScopes,redirectUri:new URL('./auth.html',location.href).href,prompt:'select_account'});account=login.account;client.setActiveAccount(account);return login.accessToken||(await client.acquireTokenSilent({scopes:oneNoteScopes,account})).accessToken;}
    try{return(await client.acquireTokenSilent({scopes:oneNoteScopes,account})).accessToken;}catch(error){if(!interactive)throw new Error('Microsoft sign-in required');const result=await client.acquireTokenPopup({scopes:oneNoteScopes,account,redirectUri:new URL('./auth.html',location.href).href});return result.accessToken;}
  }
  async function graphFetch(path,options={},interactive=false,token=''){
    const accessToken=token||await oneNoteToken(interactive),response=await fetch(`https://graph.microsoft.com/v1.0${path}`,{...options,headers:{Authorization:`Bearer ${accessToken}`,...(options.headers||{})}});if(response.ok)return response;
    let detail='';try{const body=await response.json();detail=body?.error?.message||body?.error?.code||'';}catch(_){detail=await response.text().catch(()=>'');}const error=new Error(detail||`Microsoft Graph ${response.status}`);error.status=response.status;throw error;
  }
  async function listOneNoteNotebooks(){
    try{oneNoteStage='status';renderFold();const token=await oneNoteToken(true),response=await graphFetch('/me/onenote/notebooks?$select=id,displayName,isDefault&$top=100',{},true,token),data=await response.json();oneNoteCatalog=Array.isArray(data.value)?data.value:[];oneNoteStage='notebooks';prefs.oneNoteLastError='';save();renderFold();if(!oneNoteCatalog.length)toast('No OneNote notebooks were returned');}
    catch(error){prefs.oneNoteLastError=String(error.message||error).slice(0,180);save();oneNoteStage='status';renderFold();toast(error.status===403?'Microsoft policy blocked OneNote access':'OneNote sign-in could not complete');reportError(error,'onenote-list');}
  }
  async function listOneNoteSections(notebook){
    try{prefs.oneNoteNotebookId=String(notebook.id);prefs.oneNoteNotebookName=String(notebook.displayName||notebook.name||'Notebook');save();const token=await oneNoteToken(true),response=await graphFetch(`/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections?$select=id,displayName&$top=100`,{},true,token),data=await response.json();oneNoteCatalog=Array.isArray(data.value)?data.value:[];oneNoteStage='sections';renderFold();if(!oneNoteCatalog.length)toast('That notebook has no top-level sections');}
    catch(error){prefs.oneNoteLastError=String(error.message||error).slice(0,180);save();oneNoteStage='status';renderFold();toast('OneNote sections could not be loaded');reportError(error,'onenote-sections');}
  }
  function captureMarkup(item){const time=new Date(item.createdAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),tag=item.kind==='follow-up'?' data-tag="to-do"':'';return `<p data-id="pacefold-${escapeHtml(item.id)}"${tag}><b>${escapeHtml(time)} · ${escapeHtml(kindLabel(item.kind))}</b><br />${escapeHtml(item.text).replace(/\n/g,'<br />')}</p>`;}
  function oneNotePageTitle(day){const date=new Date(`${day}T12:00:00`);return `Pacefold — ${date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}`;}
  async function findOneNotePage(day,token){
    const title=oneNotePageTitle(day),filter=`title eq '${title.replace(/'/g,"''")}'`,query=new URLSearchParams({'$filter':filter,'$select':'id,title','$top':'5'}),response=await graphFetch(`/me/onenote/sections/${encodeURIComponent(prefs.oneNoteSectionId)}/pages?${query}`,{},false,token),data=await response.json(),page=Array.isArray(data.value)?data.value.find(item=>item.title===title):null;
    if(page?.id){prefs.oneNotePages={...prefs.oneNotePages,[day]:String(page.id)};save();return String(page.id);}return '';
  }
  async function createOneNotePage(day,item,token){
    const title=oneNotePageTitle(day),html=`<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title><meta name="created" content="${new Date(item.createdAt).toISOString()}" /></head><body><p><i>Captured quietly from Pacefold. Local-first; no activity score.</i></p><div data-id="pacefold-captures">${captureMarkup(item)}</div></body></html>`;
    const response=await graphFetch(`/me/onenote/sections/${encodeURIComponent(prefs.oneNoteSectionId)}/pages`,{method:'POST',headers:{'Content-Type':'text/html; charset=utf-8','Accept':'application/json'},body:html},false,token),page=await response.json();if(!page.id)throw new Error('OneNote did not return a page ID');prefs.oneNotePages={...prefs.oneNotePages,[day]:String(page.id)};return String(page.id);
  }
  async function appendOneNoteCapture(pageId,item,token){
    const contentResponse=await graphFetch(`/me/onenote/pages/${encodeURIComponent(pageId)}/content?includeIDs=true`,{headers:{Accept:'text/html'}},false,token),content=await contentResponse.text();if(content.includes(`pacefold-${item.id}`))return;
    await graphFetch(`/me/onenote/pages/${encodeURIComponent(pageId)}/content`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify([{target:'#pacefold-captures',action:'append',content:captureMarkup(item)}])},false,token);
  }
  async function syncCaptureQueue(interactive=false){
    if(oneNoteSyncing||!navigator.onLine||!prefs.oneNoteSyncEnabled||!prefs.oneNoteClientId||!prefs.oneNoteSectionId||!pendingCaptures().length)return false;oneNoteSyncing=true;renderQuietDock();
    try{
      const token=await oneNoteToken(interactive),queue=[...pendingCaptures()].sort((a,b)=>a.createdAt-b.createdAt);
      for(const item of queue){
        try{let pageId=prefs.oneNotePages[item.day],created=false;if(!pageId){pageId=await findOneNotePage(item.day,token);if(!pageId){pageId=await createOneNotePage(item.day,item,token);created=true;}}if(!created){try{await appendOneNoteCapture(pageId,item,token);}catch(error){if(error.status!==404)throw error;delete prefs.oneNotePages[item.day];pageId=await findOneNotePage(item.day,token);if(pageId)await appendOneNoteCapture(pageId,item,token);else await createOneNotePage(item.day,item,token);}}item.syncedAt=Date.now();item.syncError='';prefs.oneNoteLastSync=item.syncedAt;prefs.oneNoteLastError='';save();}
        catch(error){item.syncError=String(error.message||error).slice(0,180);prefs.oneNoteLastError=item.syncError;save();throw error;}
      }
      if(interactive)toast('OneNote is caught up');return true;
    }catch(error){if(interactive)toast(error.status===403?'Microsoft policy blocked OneNote sync':'OneNote sync paused · captures remain local');if(!/sign-in required/i.test(error.message||''))reportError(error,'onenote-sync');return false;}
    finally{oneNoteSyncing=false;renderQuietDock();if(foldMode==='onenote'&&!$('foldDrawer').hidden)renderFold();}
  }
  async function disconnectOneNote(){try{const client=await initOneNote();const account=client?.getActiveAccount()||client?.getAllAccounts?.()[0];if(client&&account)await client.clearCache({account});}catch(error){reportError(error,'onenote-disconnect');}prefs.oneNoteNotebookId='';prefs.oneNoteNotebookName='';prefs.oneNoteSectionId='';prefs.oneNoteSectionName='';prefs.oneNotePages={};prefs.oneNoteLastError='';prefs.oneNoteLastSync=0;oneNoteClient=null;oneNoteClientStamp='';oneNoteCatalog=[];oneNoteStage='status';save();renderFold();renderQuietDock();toast('OneNote disconnected · local captures kept');}

  function renderSequence(h,state){
    const rows=scheduleForDate(new Date());
    $('sequence').innerHTML=rows.map(item=>{const k=item.id,classes=['sequence-mark'];if(item.time<h)classes.push('passed');if(state.event===k&&state.signal==='due')classes.push('due');else if(state.event===k&&state.signal==='active')classes.push('active');else if(state.event===k&&state.signal==='pending')classes.push('pending');else if(state.next&&state.next[0]===k)classes.push('next');return `<span class="${classes.join(' ')}" data-code="${item.code||''}" aria-label="${item.label}"></span>`;}).join('');
  }
  function renderWorkline(now,h,water,noodle,away,lunch,gaze){
    const workline=$('workline'),waterBtn=$('waterBtn'),noodleBtn=$('noodleBtn'),awayBtn=$('awayBtn'),lunchBtn=$('lunchBtn'),waterText=$('waterText'),noodleText=$('noodleText'),awayText=$('awayText'),lunchText=$('lunchText'),eyesBtn=$('eyesBtn'),eyesText=$('eyesText'),segments=8;
    const active=noodle.running||noodle.ready||away.active||lunch.running||lunch.ready||gaze.due,visible=prefs.workReminders&&prefs.showWorkline&&(water.within||noodle.within||away.within||lunch.within||active||['water','noodle','away','lunch','showcase'].includes(testRoutine));
    workline.classList.toggle('hidden',!visible);

    waterBtn.className='ritual water';if(water.due)waterBtn.classList.add('due');if(water.complete)waterBtn.classList.add('ok');if(water.paused)waterBtn.classList.add('paused');
    const scaled=water.progress*segments;
    $('waterMeter').innerHTML=Array.from({length:segments},(_,i)=>{const fill=Math.min(1,Math.max(0,scaled-i)),next=!water.complete&&i===Math.min(segments-1,Math.floor(scaled));return `<span class="water-seg${next?' next':''}" style="--fill:${fill.toFixed(3)}"></span>`;}).join('');
    waterText.textContent=water.paused?'Sip pace paused':water.due?'Take 2–3 sips':water.complete?'Hydration pace met':`Sip ${water.sips} / ${water.total}`;
    waterBtn.setAttribute('aria-label',water.complete?`Hydration pace met for the ${water.target}-ounce workday target`:`Take two to three sips, then click to log sip break ${Math.min(water.sips+1,water.total)} of ${water.total}`);

    noodleBtn.className='ritual noodle';noodleBtn.classList.add(noodle.state==='done'?'ok':noodle.state);
    $('noodleRing').style.setProperty('--timer-progress',noodle.progress.toFixed(4));
    if(noodle.state==='running'||noodle.state==='pre')noodleText.textContent=mmss(noodle.remain);
    else if(noodle.state==='ready')noodleText.textContent=noodle.age>10*60000?'Still waiting':'Go get it';
    else if(noodle.state==='done')noodleText.textContent=prepDoneName();
    else noodleText.textContent=`${prepName()} ${prefs.noodleMinutes}m`;
    noodleBtn.setAttribute('aria-label',noodle.state==='ready'?`${prepName()} ready; click when complete`:noodle.running?`${prepName()} timer, ${mmss(noodle.remain)} remaining`:noodle.state==='done'?prepDoneName():`Start ${prefs.noodleMinutes}-minute ${prepName()} timer; shift-click or right-click to change duration`);

    awayBtn.className='ritual away';if(away.active)awayBtn.classList.add(away.long?'due':'active');else if(away.count)awayBtn.classList.add('ok');
    awayText.textContent=away.active?`Away ${mmss(away.elapsed)}`:away.count?`${away.count} away · ${away.totalMinutes}m`:'Away break';
    awayBtn.setAttribute('aria-label',away.active?`Away break active for ${mmss(away.elapsed)}; click when back`:`Start an away break; ${away.count} logged today`);

    lunchBtn.className='ritual lunch';lunchBtn.classList.add(lunch.state==='done'?'ok':lunch.state);lunchBtn.dataset.mode=lunch.mode;
    $('lunchMeter').style.setProperty('--lunch-progress',lunch.progress.toFixed(4));
    if(lunch.running||lunch.pre)lunchText.textContent=mmss(lunch.remain);
    else if(lunch.ready)lunchText.textContent=lunch.mode==='away'?(lunch.age>10*60000?'Return overdue':'Return due'):'Meal window done';
    else if(lunch.state==='done')lunchText.textContent=`${lunch.mode==='away'?'Away lunch':'Desk meal'} ${Math.round(prefs.lunchLoggedMinutes||0)}m`;
    else lunchText.textContent=`Desk meal ${prefs.deskLunchMinutes}m`;
    lunchBtn.setAttribute('aria-label',lunch.ready?(lunch.mode==='away'?'Lunch away timer finished; click when back':'Desk meal window complete; click to close'):lunch.running?`${lunch.mode==='away'?'Away lunch':'Desk meal'}, ${mmss(lunch.remain)} remaining`:lunch.state==='done'?'Meal session complete':`Start a ${prefs.deskLunchMinutes}-minute desk meal; shift-click for a ${prefs.awayLunchMinutes}-minute away lunch`);

    eyesBtn.className='ritual eyes';if(gaze.due)eyesBtn.classList.add('due');else if(prefs.gazeLastAt)eyesBtn.classList.add('ok');if(gaze.paused)eyesBtn.classList.add('paused');
    eyesText.textContent=gaze.paused?'Eyes paused':gaze.due?'Look far · 20s':prefs.gazeEnabled?`Eyes ${Math.ceil(gaze.remaining/60000)}m`:'Eyes off';
    eyesBtn.setAttribute('aria-label',gaze.due?'Look at something distant for about 20 seconds, then click to log the reset':prefs.gazeEnabled?`Distance-look cue in ${Math.ceil(gaze.remaining/60000)} minutes`:'Distance-look cues are off');
  }
  function updateAmbient(h){const {start,end}=workRange(),phase=Math.min(1,Math.max(0,(h-start)/Math.max(1,end-start)));document.documentElement.style.setProperty('--ambient-x',`${(30+phase*42).toFixed(1)}%`);}

  function renderCore(){
    const now=new Date();ensureWorkday(now);const nowKey=dayKey(now);
    if(nowKey!==calculatedDay){times=computeTimes(now);calculatedDay=nowKey;sent.clear();}
    const h=now.getHours()+now.getMinutes()/60+now.getSeconds()/3600,H=now.getHours(),m=now.getMinutes(),s=now.getSeconds();updateAmbient(h);
    if(prefs.timeFormat==='24'){$('hour').textContent=String(H).padStart(2,'0');$('ampm').textContent='';}else{$('hour').textContent=H%12||12;$('ampm').textContent=H>=12?'PM':'AM';}
    $('minute').textContent=String(m).padStart(2,'0');$('seconds').textContent=String(s).padStart(2,'0');$('date').textContent=now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
    document.title=prefs.timeFormat==='24'?`${String(H).padStart(2,'0')}:${String(m).padStart(2,'0')}`:`${H%12||12}:${String(m).padStart(2,'0')} ${H>=12?'PM':'AM'}`;

    const prayer=prayerState(now,h),water=waterState(now,h),noodle=noodleState(now,h),away=awayState(now,h),lunch=lunchState(now,h),gaze=gazeState(now,h),body=bodyState(now,h),attention=attentionFor(prayer,water,noodle,away,lunch,gaze,body),b={prev:prayer.prev,next:prayer.next};
    document.body.dataset.signal=attention.signal;document.body.dataset.source=attention.source;document.body.dataset.prayerSignal=prayer.signal;applyTheme(now,h);applyComfort(now,h);document.body.dataset.clarity=prefs.clarity;document.body.dataset.edge=prefs.edgeCue?'on':'off';document.body.dataset.seconds=prefs.showSeconds?'on':'off';if(!prefs.privacy)document.body.classList.add('reveal');
    $('favicon').href=iconData(attention.signal,attention.source,now);updateAppBadge(attention,{now,h,prayer,water,noodle,away,lunch,gaze,body});

    const nextMins=(b.next[1]-h)*60;
    if(prayer.signal==='active'){$('statusWord').textContent='Paused';$('eventTime').textContent=new Date(prayer.startedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});$('relativeTime').textContent=`${Math.max(0,Math.floor(prayer.elapsed))}m`;$('eventName').textContent=`${nameOf(prayer.event)} break`;}
    else if(prayer.signal==='due'){$('statusWord').textContent='Now';$('eventTime').textContent=fmt(b.prev[1]);$('relativeTime').textContent=`${Math.floor(prayer.elapsed)}m`;$('eventName').textContent=nameOf(prayer.event);notifyOnce(prayer.key,prefs.notificationDetail==='named'?`${nameOf(prayer.event)} reminder`:'Rhythm reminder');}
    else if(prayer.signal==='pending'){$('statusWord').textContent='Next';$('eventTime').textContent=fmt(b.next[1]);$('relativeTime').textContent=duration(nextMins);$('eventName').textContent=`${nameOf(prayer.event)} pending`;}
    else if(prayer.signal==='snoozed'){$('statusWord').textContent='Snoozed';$('eventTime').textContent=fmt(b.prev[1]);$('relativeTime').textContent=`${Math.ceil(prayer.remaining)}m`;$('eventName').textContent=nameOf(prayer.event);}
    else{$('statusWord').textContent=prayer.signal==='lead'?'Soon':'Next';$('eventTime').textContent=fmt(b.next[1]);$('relativeTime').textContent=duration(nextMins);$('eventName').textContent=nameOf(b.next[0]);}
    $('progressFill').style.width=`${(Math.min(1,Math.max(0,(h-b.prev[1])/((b.next[1]-b.prev[1])||1)))*100).toFixed(2)}%`;
    renderSequence(h,prayer);renderWorkline(now,h,water,noodle,away,lunch,gaze);renderQuietDock(body);duckSound(attention);
    if(noodle.ready)notifyOnce(`${nowKey}:noodle:${prefs.noodleStart}`,`${prepName()} timer finished`,'noodle');
    if(lunch.ready)notifyOnce(`${nowKey}:lunch:${prefs.lunchStart}`,lunch.mode==='away'?'Away lunch finished':'Desk meal window finished','lunch');
    if(water.due)notifyOnce(water.cueKey,'Sip pace reminder','water');
    if(away.long)notifyOnce(`${nowKey}:away:${prefs.awayStart}`,'Away break is still active','away');
    if(body.due)notifyOnce(`${nowKey}:body:${Math.floor(body.elapsed/60000/prefs.bodyCadence)}`,'Time to change position','body');
    if(gaze.due)notifyOnce(`${nowKey}:eyes:${Math.floor(gaze.elapsed/60000/prefs.gazeCadence)}`,'Look into the distance for 20 seconds','eyes');
    if(foldMode==='care'&&!$('foldDrawer').hidden)renderFold();
    if(panelOpen&&m!==lastRenderedMinute){buildPanel(h,prayer,water,noodle,away,lunch);lastRenderedMinute=m;}
  }
  function fallbackClock(){
    try{const now=new Date(),H=now.getHours(),m=now.getMinutes();$('hour').textContent=prefs.timeFormat==='24'?String(H).padStart(2,'0'):H%12||12;$('minute').textContent=String(m).padStart(2,'0');$('ampm').textContent=prefs.timeFormat==='24'?'':H>=12?'PM':'AM';document.title=`${H%12||12}:${String(m).padStart(2,'0')} ${H>=12?'PM':'AM'}`;}catch(_){ }
  }
  function render(){try{renderCore();}catch(error){reportError(error,'render');fallbackClock();}}

  function currentStates(){const now=new Date(),h=now.getHours()+now.getMinutes()/60+now.getSeconds()/3600,prayer=prayerState(now,h),water=waterState(now,h),noodle=noodleState(now,h),away=awayState(now,h),lunch=lunchState(now,h),gaze=gazeState(now,h),body=bodyState(now,h);return{now,h,prayer,water,noodle,away,lunch,gaze,body,attention:attentionFor(prayer,water,noodle,away,lunch,gaze,body)};}
  function attentionKey(states){const {now,attention,prayer,water}=states,day=dayKey(now);if(attention.source==='prayer')return prayer.key||'';if(attention.source==='water')return water.cueKey||`${day}:water`;if(attention.source==='noodle')return `${day}:noodle:${prefs.noodleStart}`;if(attention.source==='lunch')return `${day}:lunch:${prefs.lunchStart}`;if(attention.source==='away')return `${day}:away:${prefs.awayStart}`;if(attention.source==='body')return `${day}:body:${Math.floor(states.body.elapsed/60000/prefs.bodyCadence)}`;if(attention.source==='eyes')return `${day}:eyes:${Math.floor(states.gaze.elapsed/60000/prefs.gazeCadence)}`;return'';}
  async function taskbarAcknowledge(){
    const states=currentStates();await closePacefoldNotifications();
    if(states.attention.signal==='none'||states.attention.source==='none'){render();toast('No cue waiting · indicator cleared');return false;}
    const at=Date.now(),id=`shortcut-${at}-${Math.random().toString(36).slice(2,9)}`;
    return applyNotificationAction({id,action:'ack',at,data:{key:attentionKey(states),source:states.attention.source,version:APP_VERSION}});
  }
  let lastLaunchSignature='',lastLaunchAt=0;
  async function handleLaunchTarget(target){
    let url;try{url=new URL(target||location.href,location.href);}catch(_){return;}
    const signature=`${url.pathname}${url.search}`,now=Date.now();if(signature===lastLaunchSignature&&now-lastLaunchAt<1600)return;lastLaunchSignature=signature;lastLaunchAt=now;
    if(url.searchParams.get('action')==='ack')await taskbarAcknowledge();
    else if(url.searchParams.get('capture')==='1')openFold('capture');
    else if(url.searchParams.get('care')==='1')openFold('care');
    else if(url.searchParams.get('sound')==='1')openFold('sound');
    try{if(url.origin===location.origin&&url.pathname===location.pathname&&url.search)history.replaceState(null,'',url.pathname);}catch(_){ }
  }
  function logPrayerSession(start,end,key,name){
    const minutes=Math.max(1,Math.min(120,Math.round((end-start)/60000)));prefs.prayerSessions=[...(prefs.prayerSessions||[]),{key,name:name||scheduleNoun(),start,end,minutes}].slice(-20);return minutes;
  }
  function startPrayerBreak(prayer){
    if(!prayer||!prayer.key||prayer.key==='test'){testPrayer='none';toast(`${scheduleNoun()} preview cleared`);render();return true;}
    if(prefs.awayStart){const end=Date.now(),start=prefs.awayStart,minutes=Math.max(1,Math.round((end-start)/60000));prefs.awaySessions=[...(prefs.awaySessions||[]),{start,end,minutes:Math.min(120,minutes)}].slice(-20);prefs.awayStart=0;}
    prefs.acknowledged[prayer.key]=Date.now();delete prefs.snoozed[prayer.key];prefs.prayerBreakStart=Date.now();prefs.prayerBreakKey=prayer.key;prefs.prayerBreakName=nameOf(prayer.event)||scheduleNoun();prefs.waterGraceUntil=Date.now()+12*60000;testPrayer='none';save();toast(`${prefs.prayerBreakName} pause started`);render();return true;
  }
  function finishPrayerBreak(cancel=false){
    if(!prefs.prayerBreakStart)return false;const end=Date.now(),start=prefs.prayerBreakStart,name=prefs.prayerBreakName||scheduleNoun(),key=prefs.prayerBreakKey,minutes=cancel?0:logPrayerSession(start,end,key,name);prefs.prayerBreakStart=0;prefs.prayerBreakKey='';prefs.prayerBreakName='';prefs.waterGraceUntil=end+8*60000;save();toast(cancel?`${scheduleNoun()} pause cancelled`:`${name} pause logged · ${minutes} min`);render();return true;
  }
  function quickPrayer(minutes=5){
    const st=currentStates(),end=Date.now(),start=end-minutes*60000,currentEvent=['due','pending','snoozed','active'].includes(st.prayer.signal)?st.prayer.event:st.prayer.prev[0],key=st.prayer.signal!=='none'&&st.prayer.key&&st.prayer.key!=='test'?st.prayer.key:eventKey(new Date(),currentEvent),name=nameOf(currentEvent)||scheduleNoun();prefs.acknowledged[key]=end;logPrayerSession(start,end,key,name);save();toast(`${minutes}-minute ${name} pause added`);render();
  }
  function acknowledgePrayer(){
    const {prayer}=currentStates();if(prayer.signal==='active')return finishPrayerBreak(false);
    if(['due','pending','snoozed'].includes(prayer.signal)){if(prefs.prayerBreakLogging)return startPrayerBreak(prayer);if(prayer.key!=='test'){prefs.acknowledged[prayer.key]=Date.now();delete prefs.snoozed[prayer.key];save();}testPrayer='none';toast('Acknowledged');render();return true;}
    if(testPrayer!=='none'){testPrayer='none';render();return true;}return false;
  }
  function snoozePrayer(){const {prayer}=currentStates();if(['due','pending','snoozed'].includes(prayer.signal)){if(prayer.key!=='test'){prefs.snoozed[prayer.key]=Date.now()+prefs.snoozeMinutes*60000;save();}testPrayer='none';toast(`Remind again in ${prefs.snoozeMinutes} min`);render();return true;}return false;}
  function clearSignalTest(){testPrayer='none';testRoutine='none';clearTimeout(testTimer);render();}
  function runSignalTest(kind){clearTimeout(testTimer);testPrayer=kind==='prayer'?'due':'none';testRoutine=['water','noodle','away','lunch'].includes(kind)?kind:'none';toast('Temporary signal check · no records changed');testTimer=setTimeout(()=>{testPrayer='none';testRoutine='none';clearTimeout(testTimer);render();},8000);render();}
  function logWater(delta=1){
    if(testRoutine==='water'){clearSignalTest();toast('Sip signal check cleared · nothing logged');return;}
    ensureWorkday(new Date());const plan=hydrationPlan();prefs.waterSips=Math.max(0,Math.min(plan.total,(prefs.waterSips||0)+delta));if(delta>0)prefs.waterLastAt=Date.now();prefs.waterGraceUntil=Date.now()+12*60000;save();
    const pace=(prefs.waterSips*plan.amount).toFixed(plan.amount%1?1:0);toast(prefs.waterSips>=plan.total?`Hydration pace met · ${prefs.waterTarget} oz target`:`Sip break ${prefs.waterSips} of ${plan.total} · ${pace} oz pace`);render();
  }
  function startNoodles(){prefs.noodleStart=Date.now();prefs.noodleDurationAtStart=prefs.noodleMinutes;prefs.noodleDone='';testRoutine='none';save();toast(`${prefs.noodleMinutes}-minute ${prepName()} timer started`);render();}
  function cancelNoodles(){prefs.noodleStart=0;prefs.noodleDurationAtStart=0;testRoutine='none';save();toast(`${prepName()} timer cancelled`);render();}
  function startLunch(mode='desk'){
    if(prefs.lunchStart)return;mode=mode==='away'?'away':'desk';if(prefs.awayStart){const end=Date.now(),start=prefs.awayStart,minutes=Math.max(1,Math.round((end-start)/60000));prefs.awaySessions=[...(prefs.awaySessions||[]),{start,end,minutes:Math.min(120,minutes)}].slice(-20);prefs.awayStart=0;}
    prefs.lunchStart=Date.now();prefs.lunchModeAtStart=mode;prefs.lunchDurationAtStart=mode==='away'?prefs.awayLunchMinutes:prefs.deskLunchMinutes;prefs.lunchDone='';prefs.lunchLoggedMinutes=0;prefs.waterGraceUntil=Date.now()+(prefs.lunchDurationAtStart+12)*60000;testRoutine='none';save();toast(`${prefs.lunchDurationAtStart}-minute ${mode==='away'?'away lunch':'desk meal'} started`);render();
  }
  function finishNoodles(){
    prefs.noodleStart=0;prefs.noodleDurationAtStart=0;prefs.noodleDone=dayKey(new Date());testRoutine='none';if(prefs.lunchAutoStart&&!prefs.lunchStart&&prefs.lunchDone!==dayKey(new Date())){startLunch('desk');toast(`Collected · ${prefs.deskLunchMinutes}-minute desk meal started`);}else{save();toast('Collected · meal ready');render();}
  }
  function cycleNoodleDuration(){prefs.noodleMinutes={30:45,45:60,60:30}[prefs.noodleMinutes]||30;save();toast(`${prepName()} set to ${prefs.noodleMinutes} min`);render();}
  function noodleAction(shift=false){
    if(testRoutine==='noodle'){clearSignalTest();toast('Timer signal check cleared · nothing changed');return;}
    const {noodle}=currentStates();if(shift){if(noodle.running||noodle.ready)cancelNoodles();else cycleNoodleDuration();return;}if(noodle.ready){finishNoodles();return;}if(noodle.running){revealFor();toast(`${mmss(noodle.remain)} remaining`);return;}if(noodle.state==='done'){toast('Meal preparation already complete');return;}startNoodles();
  }
  function finishLunch(){
    const now=Date.now(),start=prefs.lunchStart||now-(prefs.lunchDurationAtStart||prefs.deskLunchMinutes)*60000,mode=prefs.lunchModeAtStart||'desk',elapsed=Math.max(1,Math.round((now-start)/60000));prefs.lunchLoggedMinutes=Math.min(240,elapsed);prefs.lunchSessions=[...(prefs.lunchSessions||[]),{mode,start,end:now,minutes:prefs.lunchLoggedMinutes}].slice(-10);prefs.lunchStart=0;prefs.lunchDurationAtStart=0;prefs.lunchDone=dayKey(new Date());prefs.waterGraceUntil=now+12*60000;testRoutine='none';save();toast(`${mode==='away'?'Away lunch':'Desk meal'} logged · ${prefs.lunchLoggedMinutes} min`);render();
  }
  function cancelLunch(){prefs.lunchStart=0;prefs.lunchDurationAtStart=0;prefs.lunchModeAtStart=prefs.lunchMode;testRoutine='none';save();toast('Meal timer cancelled');render();
  }
  function toggleLunchMode(){prefs.lunchMode=prefs.lunchMode==='desk'?'away':'desk';save();toast(`Default lunch mode · ${prefs.lunchMode==='desk'?'desk meal':'away lunch'}`);render();
  }
  function lunchAction(shift=false){
    if(testRoutine==='lunch'){clearSignalTest();toast('Lunch signal check cleared · nothing changed');return;}
    const {lunch}=currentStates();if(lunch.ready){finishLunch();return;}if(lunch.running){if(shift)cancelLunch();else{revealFor();toast(`${lunch.mode==='away'?'Away lunch':'Desk meal'} · ${mmss(lunch.remain)} remaining`);}return;}if(lunch.state==='done'){toast(`${lunch.mode==='away'?'Away lunch':'Desk meal'} already logged · ${Math.round(prefs.lunchLoggedMinutes||0)} min`);return;}startLunch(shift?'away':prefs.lunchMode);
  }
  function startAway(){prefs.awayStart=Date.now();prefs.waterGraceUntil=Date.now()+15*60000;testRoutine='none';save();toast('Away break started');render();}
  function finishAway(){if(!prefs.awayStart)return;const end=Date.now(),start=prefs.awayStart,minutes=Math.max(1,Math.round((end-start)/60000));prefs.awaySessions=[...(prefs.awaySessions||[]),{start,end,minutes:Math.min(120,minutes)}].slice(-20);prefs.awayStart=0;prefs.waterGraceUntil=end+8*60000;testRoutine='none';save();toast(`Away break logged · ${minutes} min`);render();}
  function undoAway(){if(prefs.awayStart){prefs.awayStart=0;save();toast('Away timer cancelled');render();return;}if((prefs.awaySessions||[]).length){prefs.awaySessions=prefs.awaySessions.slice(0,-1);save();toast('Last away break removed');render();return;}toast('No away break to undo');}
  function quickAway(minutes=5){const end=Date.now(),start=end-minutes*60000;prefs.awaySessions=[...(prefs.awaySessions||[]),{start,end,minutes}].slice(-20);save();toast(`${minutes}-minute away break added`);render();}
  function awayAction(shift=false){if(testRoutine==='away'){clearSignalTest();toast('Away signal check cleared · nothing changed');return;}if(shift){undoAway();return;}if(prefs.awayStart)finishAway();else startAway();}
  function primaryAcknowledge(){const {attention,noodle,lunch,away,body,prayer}=currentStates();if(attention.source==='eyes')return completeGaze();if(attention.source==='body')return body.active?finishBodyReset(false):startBodyReset();if(attention.source==='noodle'&&noodle.ready){finishNoodles();return true;}if(attention.source==='lunch'&&lunch.ready){finishLunch();return true;}if(attention.source==='away'&&away.active){finishAway();return true;}if(prayer.signal==='active')return finishPrayerBreak(false);return acknowledgePrayer();
  }
  function smartSnooze(){const {attention,noodle,lunch,prayer}=currentStates();if(attention.source==='eyes')return snoozeGaze();if(attention.source==='body')return snoozeBody();if(attention.source==='noodle'&&noodle.ready){const total=prefs.noodleDurationAtStart||prefs.noodleMinutes;prefs.noodleStart=Date.now()-(total-5)*60000;save();toast(`${prepName()} · 5 more minutes`);render();return true;}if(attention.source==='lunch'&&lunch.ready){const total=prefs.lunchDurationAtStart||(lunch.mode==='away'?prefs.awayLunchMinutes:prefs.deskLunchMinutes);prefs.lunchStart=Date.now()-(total-5)*60000;save();toast(`${lunch.mode==='away'?'Away lunch':'Desk meal'} · 5 more minutes`);render();return true;}if(prayer.signal==='active'){toast(`${scheduleNoun()} pause is active · press Enter when back`);return true;}if(attention.source==='water'){prefs.waterGraceUntil=Date.now()+10*60000;save();toast('Sip reminder paused for 10 min');render();return true;}return snoozePrayer();
  }
  $('statusLine').addEventListener('click',e=>{e.stopPropagation();if(e.shiftKey){if(!smartSnooze())revealFor();}else if(!primaryAcknowledge())revealFor();});
  $('waterBtn').addEventListener('click',e=>{e.stopPropagation();logWater(e.shiftKey?-1:1);});
  $('waterBtn').addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();logWater(-1);});
  $('noodleBtn').addEventListener('click',e=>{e.stopPropagation();noodleAction(e.shiftKey);});
  $('noodleBtn').addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();noodleAction(true);});
  $('awayBtn').addEventListener('click',e=>{e.stopPropagation();awayAction(e.shiftKey);});
  $('awayBtn').addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();awayAction(true);});
  $('lunchBtn').addEventListener('click',e=>{e.stopPropagation();lunchAction(e.shiftKey);});
  $('lunchBtn').addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();lunchAction(true);});
  $('eyesBtn').addEventListener('click',e=>{e.stopPropagation();if(e.shiftKey)snoozeGaze();else completeGaze();});
  $('eyesBtn').addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();snoozeGaze();});
  $('captureBtn').addEventListener('click',e=>{e.stopPropagation();openFold('capture');});
  $('careBtn').addEventListener('click',e=>{e.stopPropagation();openFold('care');});
  $('soundBtn').addEventListener('click',e=>{e.stopPropagation();openFold('sound');});
  $('syncBtn').addEventListener('click',e=>{e.stopPropagation();openFold('onenote');});
  $('foldClose').addEventListener('click',e=>{e.stopPropagation();closeFold();});
  $('foldDrawer').addEventListener('submit',e=>{if(e.target.id!=='captureForm')return;e.preventDefault();e.stopPropagation();saveCapture();});
  $('foldDrawer').addEventListener('input',e=>{
    e.stopPropagation();
    if(e.target.id==='captureInput'){captureDraft=e.target.value;try{localStorage.setItem(CAPTURE_DRAFT_KEY,captureDraft);}catch(error){reportError(error,'capture-draft');}const submit=e.target.form?.querySelector('[type="submit"]');if(submit)submit.disabled=!captureDraft.trim();}
    else if(e.target.id==='soundVolume')setSoundVolume(e.target.value);
  });
  $('foldDrawer').addEventListener('click',async e=>{
    e.stopPropagation();if(e.target===e.currentTarget){closeFold();return;}
    const kind=e.target.closest('[data-capture-kind]');if(kind){captureDraftKind=CAPTURE_KINDS.includes(kind.dataset.captureKind)?kind.dataset.captureKind:'inbox';renderFold();setTimeout(()=>$('captureInput')?.focus(),20);return;}
    const cadence=e.target.closest('[data-body-cadence]');if(cadence){prefs.bodyCadence=Number(cadence.dataset.bodyCadence)||45;prefs.bodySnoozedUntil=0;save();render();renderFold();toast(`Movement reset · every ${prefs.bodyCadence} min`);return;}
    const sound=e.target.closest('[data-sound-choice]');if(sound){const wasPlaying=soundPlaying;prefs.soundChoice=sound.dataset.soundChoice;save();if(wasPlaying)await startSound();else renderFold();renderQuietDock();return;}
    const notebook=e.target.closest('[data-onenote-notebook]');if(notebook){const item=oneNoteCatalog[Number(notebook.dataset.onenoteNotebook)];if(item)await listOneNoteSections(item);return;}
    const section=e.target.closest('[data-onenote-section]');if(section){const item=oneNoteCatalog[Number(section.dataset.onenoteSection)];if(item){prefs.oneNoteSectionId=String(item.id);prefs.oneNoteSectionName=String(item.displayName||item.name||'Section');prefs.oneNotePages={};prefs.oneNoteLastError='';oneNoteStage='status';save();renderFold();renderQuietDock();toast(`OneNote destination · ${prefs.oneNoteSectionName}`);await syncCaptureQueue(true);}return;}
    const button=e.target.closest('[data-fold-action]');if(!button)return;const action=button.dataset.foldAction;
    if(action==='startBody')startBodyReset();
    else if(action==='finishBody')finishBodyReset(false);
    else if(action==='cancelBody')finishBodyReset(true);
    else if(action==='snoozeBody')snoozeBody();
    else if(action==='completeEyes')completeGaze();
    else if(action==='toggleSound'){if(soundPlaying)stopSound();else await startSound();}
    else if(action==='pickAudio')$('audioPicker').click();
    else if(action==='toggleDuck'){prefs.soundDuck=!prefs.soundDuck;save();duckSound(currentStates().attention);renderFold();}
    else if(action==='saveSoundUrl'){
      const value=String($('soundUrl')?.value||'').trim();if(!value){prefs.soundUrl='';save();toast('Saved audio URL cleared');renderFold();return;}
      try{const url=new URL(value);if(url.protocol!=='https:')throw new Error('HTTPS required');prefs.soundUrl=url.href;prefs.soundChoice='custom';prefs.soundLabel=url.hostname;save();toast('Direct audio URL saved');if(soundPlaying)await startSound();else renderFold();renderQuietDock();}catch(_){toast('Use a direct HTTPS audio URL');}
    }
    else if(action==='saveOneNoteConfig'){
      const clientId=String($('oneNoteClientId')?.value||'').trim(),tenant=String($('oneNoteTenant')?.value||'organizations').trim();
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)){toast('Enter the application ID from Microsoft Entra');return;}
      prefs.oneNoteClientId=clientId;prefs.oneNoteTenant=tenant||'organizations';prefs.oneNoteLastError='';oneNoteClient=null;oneNoteClientStamp='';save();await listOneNoteNotebooks();
    }
    else if(action==='connectOneNote'||action==='listNotebooks')await listOneNoteNotebooks();
    else if(action==='syncOneNote')await syncCaptureQueue(true);
    else if(action==='disconnectOneNote')await disconnectOneNote();
  });
  $('audioPicker').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;if(localAudioUrl)URL.revokeObjectURL(localAudioUrl);localAudioUrl=URL.createObjectURL(file);localAudioLabel=file.name.replace(/\.[^.]+$/,'').slice(0,64)||'Local audio';prefs.soundChoice='custom';prefs.soundLabel=localAudioLabel;save();toast('Local audio ready for this session');await startSound();e.target.value='';});
  $('audioPlayer').addEventListener('error',()=>{if(soundPlaying){stopSound();toast('The audio source could not be played');}});
  try{if('mediaSession'in navigator){navigator.mediaSession.setActionHandler('play',()=>{void startSound();});navigator.mediaSession.setActionHandler('pause',()=>stopSound());navigator.mediaSession.setActionHandler('stop',()=>stopSound());}}catch(error){reportError(error,'media-actions');}
  window.addEventListener('beforeunload',()=>{if(localAudioUrl)URL.revokeObjectURL(localAudioUrl);});

  async function runSelfCheck(){
    const checks=[];
    const check=(name,ok,detail='')=>checks.push({name,ok:Boolean(ok),detail});
    const required=['hour','minute','date','statusLine','progressFill','sequence','waterBtn','noodleBtn','awayBtn','lunchBtn','eyesBtn','quietDock','captureBtn','careBtn','soundBtn','syncBtn','foldDrawer','foldBody','audioPlayer','panel','setupDock','onboarding','onboardingBody','onboardingNext'];
    check('Interface',required.every(id=>$(id)),required.filter(id=>!$(id)).join(', '));
    try{const key='pacefold-self-check';localStorage.setItem(key,'ok');check('Local storage',localStorage.getItem(key)==='ok');localStorage.removeItem(key);}catch(error){check('Local storage',false,error.message);reportError(error,'self-check-storage');}
    const hostedContext=['http:','https:'].includes(location.protocol);
    if(!hostedContext)check('Manifest',true,'Local preview');
    else try{const response=await fetch('../manifest.webmanifest',{cache:'no-store'}),manifest=await response.json();check('Manifest',response.ok&&manifest.start_url&&manifest.scope,manifest.name||'');}catch(error){check('Manifest',false,error.message);reportError(error,'self-check-manifest');}
    if(!hostedContext)check('Offline engine',true,'Local preview');
    else if(!window.isSecureContext||!('serviceWorker'in navigator))check('Offline engine',false,'Secure hosted app required');
    else try{const ready=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Timed out')),4000))]);check('Offline engine',Boolean(ready&&ready.active),ready&&ready.scope||'');}catch(error){check('Offline engine',false,error.message);reportError(error,'self-check-worker');}
    check('Clock calculation',Object.values(times).every(Number.isFinite));
    check('Care model',Boolean(BODY_PROMPTS.length&&[30,45,60,90].includes(prefs.bodyCadence)));
    check('Session timing',Boolean(prefs.waterLastAt&&prefs.gazeLastAt&&prefs.bodyLastAt),'Care and hydration begin from the live session');
    check('Capture queue',Array.isArray(prefs.captures)&&prefs.captures.every(item=>item.id&&item.day&&item.text));
    check('Microsoft adapter',Boolean(window.msal&&oneNoteScopes.includes('Notes.ReadWrite')),'Local MSAL · delegated notes only');
    check('Taskbar actions',Boolean('launchQueue'in window||isStandalone()||location.protocol==='http:'),'Notification action queue · manifest shortcuts');
    check('Calm alert model',['off','due','countdown'].includes(prefs.taskbarBadgeMode)&&['quiet','all'].includes(prefs.notificationMode),`${prefs.taskbarBadgeMode} badge · ${prefs.notificationMode} alerts`);
    check('Settings navigation',['today','rhythm','tools','app'].every(id=>$('panel')?.querySelector(`[data-settings-group="${id}"]`)),'Four focused views');
    const failed=checks.filter(x=>!x.ok);lastSelfCheck=failed.length?`${checks.length-failed.length}/${checks.length} core checks passed`:`${checks.length}/${checks.length} core checks passed`;
    toast(failed.length?`Self-check found ${failed.length} issue${failed.length===1?'':'s'}`:'Pacefold self-check passed');
    if(panelOpen){const st=currentStates();buildPanel(st.h,st.prayer,st.water,st.noodle,st.away,st.lunch);}
    return checks;
  }

  function setting(label,action,value){return `<div class="setting"><span class="setting-label">${label}</span><button class="setting-value" data-action="${action}" type="button">${value}</button></div>`;}
  function choices(label,action,options,current){return `<div class="choice-setting"><span class="setting-label">${label}</span><span class="choice-group">${options.map(([value,text])=>`<button class="choice${String(value)===String(current)?' active':''}" data-action="${action}" data-value="${value}" type="button">${text}</button>`).join('')}</span></div>`;}
  function organizeSettingsPanel(){
    const panel=$('panel'),head=panel?.querySelector('.panel-head');if(!panel||!head)return;
    const labels={today:'Today',rhythm:'Rhythm',tools:'Tools',app:'App'},routes=[
      [/^Ma · today|^Kiroku · private timeline|^Hansei|^Kaizen/,'today'],
      [/^Rhythm profile|^Islamic calculation|^Personal schedule|^Ma · workday rhythm|^Meal & break flow/,'rhythm'],
      [/^Display$|^Display comfort|^Care ·|^Kiroku · capture|^Oto ·/,'tools'],
      [/^Andon · silent cue|^App, updates|^Andon · signal check/,'app']
    ];
    const nav=document.createElement('nav');nav.className='settings-tabs';nav.setAttribute('aria-label','Settings sections');nav.innerHTML=Object.entries(labels).map(([id,label])=>`<button class="settings-tab${settingsView===id?' active':''}" data-settings-view="${id}" type="button" aria-pressed="${settingsView===id}">${label}</button>`).join('');head.after(nav);
    const groups={};Object.entries(labels).forEach(([id,label])=>{const group=document.createElement('div');group.className='settings-view';group.dataset.settingsGroup=id;group.setAttribute('aria-label',`${label} settings`);group.hidden=settingsView!==id;groups[id]=group;});
    let route='app';[...panel.children].filter(node=>node!==head&&node!==nav).forEach(node=>{if(node.classList?.contains('section-title')){const text=node.textContent.trim();route=(routes.find(([pattern])=>pattern.test(text))||[])[1]||'app';}groups[route].append(node);});
    Object.values(groups).forEach(group=>panel.append(group));
  }
  function buildPanel(h,prayer,water,noodle,away,lunch){
    const current=['due','pending','snoozed','active'].includes(prayer.signal)?prayer.event:prayer.next[0];
    const rows=scheduleForDate(new Date(),isMuslimProfile()).map(item=>{const k=item.id,label=item.label,offset=isMuslimProfile()?(prefs.offsets[k]||0):0,control=isMuslimProfile()&&ALERTS.includes(k)?`<span class="offset-control"><button class="mini" data-offset="${k}" data-delta="-1" type="button">−</button><span class="offset">${offset>0?'+':''}${offset}m</span><button class="mini" data-offset="${k}" data-delta="1" type="button">+</button></span>`:`<span class="offset-control"><button class="mini" data-moment="${k}" data-delta="-5" type="button">−</button><span class="offset">${fmt(item.time)}</span><button class="mini" data-moment="${k}" data-delta="5" type="button">+</button></span>`;return `<span class="k ${k===current?'hot':''}">${label}</span><span class="v ${k===current?'hot':''}">${fmt(item.time)}</span>${control}`;}).join('');
    const qdir=['N','NE','E','SE','S','SW','W','NW'][Math.round(QIBLA/45)%8],notificationStatus=notificationStatusText(),ledger=workdayLedger(new Date()),close=dayCloseSummary(new Date()),suggestion=kaizenSuggestion(new Date()),body=bodyState(new Date(),h),syncStatus=oneNoteStatus(),todayCaptures=prefs.captures.filter(item=>item.day===dayKey(new Date())).length,lastNotificationAction=(prefs.notificationActionHistory||[]).slice(-1)[0];
    const timeline=[...(prefs.prayerSessions||[]).map(s=>({...s,label:s.name||scheduleNoun(),kind:scheduleNoun()})),...(prefs.awaySessions||[]).map(s=>({...s,label:'Away',kind:'Away'})),...(prefs.lunchSessions||[]).map(s=>({...s,label:s.mode==='away'?'Away lunch':'Desk meal',kind:'Meal'})),...(prefs.bodySessions||[]).map(s=>({...s,label:'Movement reset',kind:'Care'}))].sort((a,b)=>b.start-a.start).slice(0,7);
    const timelineHtml=timeline.length?timeline.map(s=>`<div class="timeline-row"><span>${new Date(s.start).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span><strong>${s.label}</strong><em>${s.seconds?`${Math.round(s.seconds)}s`:`${Math.round(s.minutes||0)}m`}</em></div>`).join(''):'<div class="timeline-empty">No completed rhythm sessions yet.</div>';
    const suggestionHtml=suggestion?`<div class="kaizen-card"><span class="kaizen-mark"></span><div><strong>One small adjustment</strong><p>${suggestion.text}</p></div><div class="kaizen-actions"><button class="action" data-action="${suggestion.action}" data-value="${suggestion.value}" type="button">${suggestion.cta}</button><button class="action" data-action="dismissKaizen" type="button">Not today</button></div></div>`:'<div class="kaizen-empty">No adjustment suggested. Pacefold stays quiet.</div>';
    $('panel').innerHTML=`
      <div class="panel-head"><div><div class="panel-title">Pacefold</div><div class="panel-sub">${profileMeta().label} · ${prefs.locationLabel} · local-first</div></div><button class="close" data-action="close" type="button">×</button></div>
      <div class="section-title">Rhythm profile</div>${choices('Profile','profileSet',Object.entries(PROFILE_PRESETS).map(([id,x])=>[id,x.label]),prefs.profile)}<div class="profile-note">${profileMeta().note}</div>${!isMuslimProfile()?'<div class="actions"><button class="action wide" data-action="editMoments" type="button">Edit labels and times</button></div>':''}<div class="section-title">Ma · today</div><div class="prayer-grid">${rows}</div>
      <div class="section-title">Display</div>
      ${choices('Theme','themeSet',[['auto','Auto'],['desk','Sekkei'],['paper','Washi'],['dark','Sumi'],['moss','Moss'],['dusk','Dusk'],['custom','Custom']],prefs.theme)}
      ${prefs.theme==='custom'?`<div class="palette-fields"><label class="palette-field">Background <input type="color" data-palette="customBgA" value="${prefs.customBgA}"></label><label class="palette-field">Depth <input type="color" data-palette="customBgB" value="${prefs.customBgB}"></label><label class="palette-field">Text <input type="color" data-palette="customInk" value="${prefs.customInk}"></label><label class="palette-field">Accent <input type="color" data-palette="customAccent" value="${prefs.customAccent}"></label></div>`:''}
      ${setting('Time format','format',prefs.timeFormat==='12'?'12-hour':'24-hour')}
      ${setting('Seconds','seconds',prefs.showSeconds?'Shown':'Hidden')}
      ${setting('Default detail','privacy',prefs.privacy?'Coded':'Named')}
      ${setting('Quick cover','cover',document.body.classList.contains('cover')?'On':'Off')}
      <div class="section-title">Display comfort</div>
      ${choices('Comfort','comfortMode',[['auto','Auto'],['off','Neutral'],['warm','Warm'],['dim','Dim']],prefs.comfortMode)}
      ${choices('Comfort strength','comfortStrength',[[0,'Low'],[1,'Medium'],[2,'High']],prefs.comfortStrength)}
      ${setting('Distance-look cue','gazeEnabled',prefs.gazeEnabled?`Every ${prefs.gazeCadence}m`:'Off')}
      ${prefs.gazeEnabled?choices('Cue cadence','gazeCadence',[[20,'20m'],[30,'30m'],[40,'40m']],prefs.gazeCadence):''}
      <div class="actions"><button class="action wide" data-action="nightLight" type="button">Open Windows Night light settings</button></div>
      <div class="signal-note">Pacefold can warm only its own window. Windows Night light controls the full monitor and may be restricted by workplace policy.</div>
      <div class="section-title">Care · movement without nagging</div>
      ${setting('Movement resets','bodyEnabled',prefs.bodyEnabled?`Every ${prefs.bodyCadence}m`:'Off')}
      ${prefs.bodyEnabled?choices('Movement cadence','bodyCadence',[[30,'30m'],[45,'45m'],[60,'60m'],[90,'90m']],prefs.bodyCadence):''}
      <div class="plan-card"><strong>${prefs.bodySessions.length} movement reset${prefs.bodySessions.length===1?'':'s'} today.</strong> Away time, meal breaks and scheduled pauses reset the movement clock. ${body.active?'A guided reset is active now.':body.due?'A position change is due now.':`Next in about ${Math.ceil(body.remaining/60000)} minutes.`}</div>
      <div class="actions"><button class="action wide" data-action="openCare" type="button">Open guided reset</button></div>
      <div class="section-title">Andon · silent cue</div>
      ${setting('Cue strength','clarity',prefs.clarity==='discreet'?'Discreet':'Clear')}
      ${setting('Top-edge cue','edge',prefs.edgeCue?'On':'Off')}
      ${setting(`${scheduleNoun()} early cue`,'lead',`${prefs.lead} min`)}
      ${setting(`${scheduleNoun()} active window`,'dueWindow',`${prefs.dueWindow} min`)}
      ${setting(`${scheduleNoun()} snooze`,'snooze',`${prefs.snoozeMinutes} min`)}
      ${setting(`${scheduleNoun()} pause logging`,'prayerLogging',prefs.prayerBreakLogging?'On':'Off')}
      ${choices(`${scheduleNoun()} timer safeguard`,'prayerMax',[[30,'30m'],[45,'45m'],[60,'60m']],prefs.prayerMaxMinutes)}
      ${setting('System notifications','notify',notificationStatus)}
      ${setting('Notification coverage','notifyMode',prefs.notificationMode==='all'?'Every cue':'Quiet essentials')}
      ${setting('Notification text','notifyDetail',prefs.notificationDetail==='generic'?'Generic':'Named')}
      <div class="actions"><button class="action wide" data-action="testNotification" type="button">Enable / test system notification</button></div>
      <div class="signal-note">System alerts are silent, fade normally and show one clear action. That action records the response and clears the taskbar indicator without focusing Pacefold; the notification body opens the app. ${lastNotificationAction?`Last action: ${escapeHtml(lastNotificationAction.outcome)} · ${new Date(lastNotificationAction.at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}.`:''}</div>
      ${isMuslimProfile()?`<div class="section-title">Islamic calculation</div>${setting('Asr method','asr',prefs.asr==='hanafi'?'Hanafi':'Standard')}${setting('Calculation','method',prefs.method==='18'?'18°':'ISNA 15°')}${setting('Location','location',prefs.locationLabel||'Toronto')}`:`<div class="section-title">Personal schedule</div><div class="profile-note">These are personal reminders, not official religious or denominational time rulings.</div>${setting('Location','location',prefs.locationLabel||'Toronto')}`}
      <div class="section-title">App, updates & taskbar</div>
      <div class="app-status"><span class="k">Installation</span><span class="v ${isStandalone()?'good':''}">${isStandalone()?'Installed app':deferredInstallPrompt?'Ready to install':'Use Edge app install'}</span><span class="k">Offline engine</span><span class="v ${serviceWorkerState.includes('Automatic')||serviceWorkerState==='Updated'?'good':serviceWorkerState.includes('failed')?'warn':''}">${serviceWorkerState}</span><span class="k">Updates</span><span class="v ${workerRegistration?'good':''}">${workerRegistration?'Automatic':'Waiting for secure site'}</span><span class="k">Local records</span><span class="v ${storageState==='Local'?'good':'warn'}">${storageState}</span><span class="k">Taskbar surface</span><span class="v">${isStandalone()&&'setAppBadge'in navigator?(prefs.taskbarBadgeMode==='countdown'?'Countdown, then attention dot':prefs.taskbarBadgeMode==='due'?'Attention dot only':'No badge'):'Install in Edge to enable'}</span><span class="k">Self-check</span><span class="v">${lastSelfCheck}</span></div>
      ${setting('Taskbar indicator','taskbarBadge',prefs.taskbarBadgeMode==='countdown'?'Countdown':prefs.taskbarBadgeMode==='due'?'Due only':'Off')}
      <div class="signal-note">Right-click the pinned Pacefold icon for Log / clear current cue, Capture, Care and Sound shortcuts. Edge does not allow a website to replace normal taskbar click behaviour.</div>
      <div class="actions"><button class="action wide" data-action="installApp" type="button">${isStandalone()?'Installation details':'Install / pin Pacefold'}</button><button class="action" data-action="checkUpdate" type="button">Check for update</button><button class="action" data-action="selfCheck" type="button">Run self-check</button></div>
      <div class="section-title">Ma · workday rhythm</div>
      ${setting('Workday system','work',prefs.workReminders?'On':'Off')}
      ${setting('Workdays','workdays',prefs.workdaysOnly?'Monday–Friday':'Every day')}
      ${setting('Quiet status rail','workline',prefs.showWorkline?'Shown':'Hidden')}
      ${setting('Work hours','workHours',`${displayClock(workRange().start)}–${displayClock(workRange().end)}`)}
      ${setting('Hydration target','waterTarget',`${prefs.waterTarget} oz`)}
      ${choices('Sip cadence','sipCadence',[[20,'20m'],[30,'30m'],[40,'40m']],prefs.sipCadence)}
      <div class="plan-card">${(()=>{const p=hydrationPlan();const amount=p.amount.toFixed(p.amount%1?1:0);return `<strong>${p.total} quiet sip breaks</strong> across the workday · about <strong>${amount} oz</strong> each (${p.cadence===20?'roughly 2 small sips':p.cadence===30?'roughly 2–3 sips':'roughly 3–4 sips'}) · totals ${prefs.waterTarget} oz`;})()}</div>
      <div class="section-title">Kiroku · capture & OneNote</div>
      <div class="app-status"><span class="k">Today</span><span class="v">${todayCaptures} capture${todayCaptures===1?'':'s'}</span><span class="k">OneNote</span><span class="v ${syncStatus.tone==='synced'?'good':syncStatus.tone?'warn':''}">${escapeHtml(syncStatus.text)}</span><span class="k">Destination</span><span class="v">${prefs.oneNoteSectionId?`${escapeHtml(prefs.oneNoteNotebookName)} › ${escapeHtml(prefs.oneNoteSectionName)}`:'Local only'}</span></div>
      <div class="actions"><button class="action wide" data-action="openCapture" type="button">Capture a note or follow-up</button><button class="action" data-action="openOneNote" type="button">OneNote connection</button></div>
      <div class="signal-note">Pacefold is the quick daily surface. Captures are durable locally first; an optional Microsoft connection appends them to one dated OneNote page without uploading your activity ledger.</div>
      <div class="section-title">Oto · sound layer</div>
      ${choices('Sound','soundChoice',[['brown','Brown hush'],['rain','Rain glass'],['fan','Soft fan'],['custom','Your audio']],prefs.soundChoice)}
      ${setting('Cue ducking','soundDuck',prefs.soundDuck?'On':'Off')}
      <div class="actions"><button class="action wide" data-action="openSound" type="button">${soundPlaying?'Open player · playing':'Open sound player'}</button></div>
      <div class="section-title">Meal & break flow</div>
      ${choices('Prep routine','prepPreset',Object.entries(PREP_PRESETS).map(([id,x])=>[id,x.label]),prefs.prepPreset)}${choices('Prep duration','noodleSet',[[5,'5m'],[8,'8m'],[10,'10m'],[15,'15m'],[20,'20m'],[30,'30m'],[45,'45m'],[60,'60m']],prefs.noodleMinutes)}<div class="actions"><button class="action wide" data-action="prepCustom" type="button">Rename prep routine</button></div>
      ${setting(`${prepName()} early cue`,'noodlePre',prefs.noodlePrealert?`${prefs.noodlePrealert} min`:'Off')}
      ${choices('Desk meal window','deskLunchSet',[[15,'15m'],[20,'20m'],[30,'30m']],prefs.deskLunchMinutes)}
      ${choices('Away lunch','awayLunchSet',[[30,'30m'],[45,'45m'],[60,'60m']],prefs.awayLunchMinutes)}
      ${setting('Default lunch mode','lunchMode',prefs.lunchMode==='desk'?'Desk meal':'Away lunch')}
      ${setting('Meal early cue','lunchPre',prefs.lunchPrealert?`${prefs.lunchPrealert} min`:'Off')}
      ${setting(`After ${prepName().toLowerCase()}`,'lunchAuto',prefs.lunchAutoStart?'Start desk meal':'Do nothing')}
      <div class="plan-card"><strong>Workday rhythm:</strong> ${water.sips}/${water.total} sip breaks · ${ledger.prayer.count} ${scheduleNounLower()} pause${ledger.prayer.count===1?'':'s'} (${ledger.prayer.minutes}m) · ${ledger.away.count} away (${ledger.away.minutes}m) · ${ledger.lunch.deskMinutes}m desk meal · ${prefs.bodySessions.length} movement reset${prefs.bodySessions.length===1?'':'s'} · <strong>${ledger.uniqueBreakMinutes}m unique off-desk recovery</strong></div>
      <div class="section-title">Kiroku · private timeline</div><div class="timeline">${timelineHtml}</div>
      <div class="section-title">Hansei · day close</div>
      ${setting('Day close','dayClose',prefs.dayCloseEnabled?'On':'Off')}
      ${prefs.dayCloseEnabled?`<div class="day-close"><strong>${close.title}</strong><span>${close.line}</span><em>${close.offDesk}m unique off-desk recovery · no score · local only</em></div>`:''}
      <div class="section-title">Kaizen · one improvement</div>
      ${setting('Quiet suggestions','kaizen',prefs.kaizenEnabled?'On':'Off')}
      ${prefs.kaizenEnabled?suggestionHtml:''}
      <div class="section-title">Andon · signal check</div>
      <div class="signal-note">Temporary eight-second tests do not change records. The default taskbar indicator stays empty until a cue actually needs attention.</div>
      <div class="actions"><button class="action ${testPrayer!=='none'?'active':''}" data-action="testPrayer" type="button">Show moment signal</button><button class="action ${testRoutine==='water'?'active':''}" data-action="testWater" type="button">Show sip signal</button><button class="action ${testRoutine==='noodle'?'active':''}" data-action="testNoodle" type="button">Show prep-finished signal</button><button class="action ${testRoutine==='lunch'?'active':''}" data-action="testLunch" type="button">Show lunch-return signal</button><button class="action ${testRoutine==='away'?'active':''}" data-action="testAway" type="button">Show away signal</button><button class="action" data-action="logSip" type="button">Log one sip break</button><button class="action" data-action="quickPrayer5" type="button">Add 5m moment</button><button class="action" data-action="quickPrayer10" type="button">Add 10m moment</button><button class="action" data-action="quickAway3" type="button">Add 3m away</button><button class="action" data-action="quickAway5" type="button">Add 5m away</button><button class="action wide" data-action="clearTest" type="button">Clear signal test</button><button class="action wide" data-action="resetToday" type="button">Reset today’s workday records</button></div>
      ${isMuslimProfile()?`<div class="meta"><span>${hijri(new Date())}</span><span>Qibla ≈ ${Math.round(QIBLA)}° ${qdir}</span></div>`:`<div class="meta"><span>${profileMeta().label}</span><span>${prefs.locationLabel}</span></div>`}
      <div class="version-note">Pacefold ${APP_VERSION} · ${diagnostics.length?'recovered from '+diagnostics.length+' issue'+(diagnostics.length===1?'':'s'):'system healthy'}</div>
      <div class="hint"><kbd>R</kbd> reveal · <kbd>C</kbd> capture · <kbd>M</kbd> move · <kbd>O</kbd> sound · <kbd>W</kbd> sip · <kbd>N</kbd> prep · <kbd>B</kbd> away · <kbd>L</kbd> meal · <kbd>P</kbd> moment · <kbd>Enter</kbd> act · <kbd>S</kbd> snooze · <kbd>H</kbd> cover</div>`;
    organizeSettingsPanel();
  }
  function togglePanel(force){panelOpen=typeof force==='boolean'?force:!panelOpen;if(panelOpen){const st=currentStates();buildPanel(st.h,st.prayer,st.water,st.noodle,st.away,st.lunch);lastRenderedMinute=new Date().getMinutes();}$('panel').classList.toggle('on',panelOpen);document.body.classList.toggle('panel-open',panelOpen);}
  $('corner').addEventListener('click',e=>{e.stopPropagation();togglePanel();});
  $('brandButton').addEventListener('click',e=>{e.stopPropagation();togglePanel();});
  $('setupPrimary').addEventListener('click',async e=>{e.stopPropagation();if(!isOnboarded()||setupRequested||!deferredInstallPrompt)openOnboarding(isOnboarded()?2:0);else await installPacefold();});
  $('setupClose').addEventListener('click',e=>{e.stopPropagation();dismissSetup();});
  $('onboardingClose').addEventListener('click',e=>{e.stopPropagation();closeOnboarding();});
  $('onboardingBack').addEventListener('click',e=>{e.stopPropagation();onboardingStep=Math.max(0,onboardingStep-1);renderOnboarding();});
  $('onboardingNext').addEventListener('click',async e=>{e.stopPropagation();if(onboardingStep<2){onboardingStep++;renderOnboarding();}else await finishOnboarding();});
  $('onboarding').addEventListener('click',e=>{
    e.stopPropagation();if(e.target===e.currentTarget){closeOnboarding();return;}
    const d=onboardingDraft||(onboardingDraft=freshOnboardingDraft());const t=e.target.closest('[data-onboard-profile],[data-onboard-prep],[data-onboard-duration],[data-onboard-comfort],[data-onboard-nightlight]');
    if(t){if(t.dataset.onboardProfile)d.profile=t.dataset.onboardProfile;else if(t.dataset.onboardPrep){d.prepPreset=t.dataset.onboardPrep;d.prepMinutes=PREP_PRESETS[d.prepPreset]?.minutes||15;}else if(t.dataset.onboardDuration)d.prepMinutes=Number(t.dataset.onboardDuration)||15;else if(t.dataset.onboardComfort)d.comfortMode=t.dataset.onboardComfort;else if(t.hasAttribute('data-onboard-nightlight')){try{window.location.href='ms-settings:nightlight';}catch(_){toast('Windows Settings · System · Display · Night light');}}renderOnboarding();return;}
    const gaze=e.target.closest('[data-onboard-gaze]'),body=e.target.closest('[data-onboard-body]'),notify=e.target.closest('[data-onboard-notify]');if(gaze)d.gazeEnabled=gaze.checked;if(body)d.bodyEnabled=body.checked;if(notify)d.notifications=notify.checked;
  });
  $('panel').addEventListener('click',async e=>{
    e.stopPropagation();const viewButton=e.target.closest('[data-settings-view]');if(viewButton){settingsView=['today','rhythm','tools','app'].includes(viewButton.dataset.settingsView)?viewButton.dataset.settingsView:'today';$('panel').querySelectorAll('[data-settings-group]').forEach(group=>group.hidden=group.dataset.settingsGroup!==settingsView);$('panel').querySelectorAll('[data-settings-view]').forEach(button=>{const active=button.dataset.settingsView===settingsView;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});$('panel').scrollTop=0;return;}const offsetButton=e.target.closest('[data-offset]');if(offsetButton){const k=offsetButton.dataset.offset,delta=Number(offsetButton.dataset.delta);prefs.offsets[k]=Math.max(-15,Math.min(15,(prefs.offsets[k]||0)+delta));times=computeTimes(new Date());save();render();const st=currentStates();buildPanel(st.h,st.prayer,st.water,st.noodle,st.away,st.lunch);return;}
    const momentButton=e.target.closest('[data-moment]');if(momentButton){const id=momentButton.dataset.moment,delta=Number(momentButton.dataset.delta)||0;prefs.customMoments=normalizeMoments(prefs.customMoments,prefs.profile).map(item=>{if(item.id!==id)return item;let minutes=Math.round(parseClock(item.time)*60)+delta;minutes=(minutes+1440)%1440;return{...item,time:`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`};});prefs.acknowledged={};prefs.snoozed={};save();render();const st=currentStates();buildPanel(st.h,st.prayer,st.water,st.noodle,st.away,st.lunch);return;}
    const button=e.target.closest('[data-action]');if(!button)return;const a=button.dataset.action;
    if(a==='close'){togglePanel(false);return;}
    if(a==='profileSet'){applyProfilePreset(button.dataset.value);toast(`Profile set · ${profileMeta().label}`);}
    else if(a==='editMoments'){editCustomMoments();}
    else if(a==='themeSet')prefs.theme=['auto','desk','paper','dark','moss','dusk','custom'].includes(button.dataset.value)?button.dataset.value:'auto';
    else if(a==='comfortMode')prefs.comfortMode=['auto','off','warm','dim'].includes(button.dataset.value)?button.dataset.value:'auto';
    else if(a==='comfortStrength')prefs.comfortStrength=Number(button.dataset.value)||0;
    else if(a==='gazeEnabled')prefs.gazeEnabled=!prefs.gazeEnabled;
    else if(a==='gazeCadence')prefs.gazeCadence=Number(button.dataset.value)||20;
    else if(a==='bodyEnabled'){prefs.bodyEnabled=!prefs.bodyEnabled;prefs.bodySnoozedUntil=0;if(!prefs.bodyEnabled&&prefs.bodyResetStart)finishBodyReset(true);}
    else if(a==='bodyCadence'){prefs.bodyCadence=Number(button.dataset.value)||45;prefs.bodySnoozedUntil=0;}
    else if(a==='openCare'){openFold('care');return;}
    else if(a==='openCapture'){openFold('capture');return;}
    else if(a==='openOneNote'){openFold('onenote');return;}
    else if(a==='openSound'){openFold('sound');return;}
    else if(a==='soundChoice'){const wasPlaying=soundPlaying;prefs.soundChoice=button.dataset.value;save();if(wasPlaying)await startSound();}
    else if(a==='soundDuck'){prefs.soundDuck=!prefs.soundDuck;duckSound(currentStates().attention);}
    else if(a==='nightLight'){try{window.location.href='ms-settings:nightlight';toast('Opening Windows Night light settings');}catch(_){toast('Open Windows Settings · System · Display · Night light');}}
    else if(a==='format')prefs.timeFormat=prefs.timeFormat==='12'?'24':'12';
    else if(a==='seconds')prefs.showSeconds=!prefs.showSeconds;
    else if(a==='privacy'){prefs.privacy=!prefs.privacy;document.body.classList.toggle('reveal',!prefs.privacy);}
    else if(a==='cover')document.body.classList.toggle('cover');
    else if(a==='clarity')prefs.clarity=prefs.clarity==='discreet'?'clear':'discreet';
    else if(a==='edge')prefs.edgeCue=!prefs.edgeCue;
    else if(a==='lead')prefs.lead={5:10,10:15,15:20,20:5}[prefs.lead]||10;
    else if(a==='dueWindow')prefs.dueWindow={10:18,18:25,25:35,35:10}[prefs.dueWindow]||18;
    else if(a==='snooze')prefs.snoozeMinutes={5:10,10:15,15:20,20:5}[prefs.snoozeMinutes]||10;
    else if(a==='prayerLogging')prefs.prayerBreakLogging=!prefs.prayerBreakLogging;
    else if(a==='prayerMax')prefs.prayerMaxMinutes=Number(button.dataset.value)||45;
    else if(a==='asr'){prefs.asr=prefs.asr==='hanafi'?'std':'hanafi';times=computeTimes(new Date());}
    else if(a==='method'){prefs.method=prefs.method==='18'?'15':'18';times=computeTimes(new Date());}
    else if(a==='location'){const manual=()=>{const v=window.prompt('Location as "latitude, longitude"  (Toronto is 43.62, -79.51)',LAT.toFixed(2)+', '+LNG.toFixed(2));if(v==null)return;const m=v.split(',').map(x=>parseFloat(x));if(m.length>=2&&Number.isFinite(m[0])&&Number.isFinite(m[1])){applyLocation(clamp(m[0],-90,90,LAT),clamp(m[1],-180,180,LNG),'Custom');toast('Location updated · times recalculated');}else{toast('Could not read those coordinates');}};if('geolocation'in navigator){toast('Locating…');navigator.geolocation.getCurrentPosition(p=>{applyLocation(p.coords.latitude,p.coords.longitude,'Here');toast('Location set from this device');if(panelOpen){const s2=currentStates();buildPanel(s2.h,s2.prayer,s2.water,s2.noodle,s2.away,s2.lunch);}},()=>manual(),{timeout:8000,maximumAge:600000});}else{manual();}}
    else if(a==='taskbarBadge'){prefs.taskbarBadgeMode={due:'countdown',countdown:'off',off:'due'}[prefs.taskbarBadgeMode]||'due';prefs.taskbarBadge=prefs.taskbarBadgeMode!=='off';lastBadge='';}
    else if(a==='dayClose')prefs.dayCloseEnabled=!prefs.dayCloseEnabled;
    else if(a==='kaizen')prefs.kaizenEnabled=!prefs.kaizenEnabled;
    else if(a==='dismissKaizen'){prefs.kaizenDismissed=dayKey(new Date());toast('Suggestion set aside for today');}
    else if(a==='kaizenDeskMeal'){prefs.deskLunchMinutes=Number(button.dataset.value)||20;prefs.kaizenDismissed=dayKey(new Date());toast(`Desk meal default set to ${prefs.deskLunchMinutes} min`);}
    else if(a==='kaizenSip'){prefs.sipCadence=Number(button.dataset.value)||20;prefs.waterSips=Math.min(prefs.waterSips,hydrationPlan().total);prefs.kaizenDismissed=dayKey(new Date());toast(`Sip cadence set to ${prefs.sipCadence} min`);}
    else if(a==='installApp'){if(deferredInstallPrompt&&!isStandalone())await installPacefold();else openOnboarding(2);}
    else if(a==='checkUpdate'){await checkForUpdate(false);}
    else if(a==='selfCheck'){await runSelfCheck();}
    else if(a==='work')prefs.workReminders=!prefs.workReminders;
    else if(a==='workdays')prefs.workdaysOnly=!prefs.workdaysOnly;
    else if(a==='workline')prefs.showWorkline=!prefs.showWorkline;
    else if(a==='workHours')prefs.workHours={'08:00-16:00':'08:30-16:30','08:30-16:30':'09:00-17:00','09:00-17:00':'08:00-17:00','08:00-17:00':'08:00-18:00','08:00-18:00':'08:00-16:00'}[prefs.workHours]||'08:30-16:30';
    else if(a==='waterTarget'){prefs.waterTarget={16:24,24:32,32:16}[prefs.waterTarget]||24;prefs.waterSips=Math.min(prefs.waterSips,hydrationPlan().total);}
    else if(a==='sipCadence'){prefs.sipCadence=Number(button.dataset.value)||30;prefs.waterSips=Math.min(prefs.waterSips,hydrationPlan().total);}
    else if(a==='prepPreset'){applyPrepPreset(button.dataset.value);toast(`Prep routine · ${prepName()}`);}
    else if(a==='prepCustom'){const label=window.prompt('Prep routine name',prepName());if(label&&label.trim()){prefs.prepPreset='custom';prefs.prepLabel=label.trim().slice(0,24);prefs.prepDoneLabel=`${prefs.prepLabel} ready`.slice(0,28);toast('Prep routine renamed');}}
    else if(a==='noodleSet')prefs.noodleMinutes=Number(button.dataset.value)||30;
    else if(a==='deskLunchSet')prefs.deskLunchMinutes=Number(button.dataset.value)||20;
    else if(a==='awayLunchSet')prefs.awayLunchMinutes=Number(button.dataset.value)||45;
    else if(a==='lunchMode')prefs.lunchMode=prefs.lunchMode==='desk'?'away':'desk';
    else if(a==='noodlePre')prefs.noodlePrealert={0:2,2:3,3:5,5:0}[prefs.noodlePrealert]??2;
    else if(a==='lunchPre')prefs.lunchPrealert={0:5,5:10,10:0}[prefs.lunchPrealert]??5;
    else if(a==='lunchAuto')prefs.lunchAutoStart=!prefs.lunchAutoStart;
    else if(a==='notify'){if(prefs.browserNotif){prefs.browserNotif=false;toast('System notifications turned off');}else await requestNotifications(false);}
    else if(a==='notifyMode')prefs.notificationMode=prefs.notificationMode==='quiet'?'all':'quiet';
    else if(a==='notifyDetail')prefs.notificationDetail=prefs.notificationDetail==='generic'?'named':'generic';
    else if(a==='testNotification'){await requestNotifications(true);}
    else if(a==='testPrayer'){runSignalTest('prayer');}
    else if(a==='testWater'){runSignalTest('water');}
    else if(a==='testNoodle'){runSignalTest('noodle');}
    else if(a==='testLunch'){runSignalTest('lunch');}
    else if(a==='testAway'){runSignalTest('away');}
    else if(a==='logSip'){logWater(1);}
    else if(a==='quickPrayer5'){quickPrayer(5);}
    else if(a==='quickPrayer10'){quickPrayer(10);}
    else if(a==='quickAway3'){quickAway(3);}
    else if(a==='quickAway5'){quickAway(5);}
    else if(a==='clearTest'){clearSignalTest();toast('Signal test cleared');}
    else if(a==='resetToday'){const resetAt=Date.now();prefs.activityDate=dayKey(new Date());prefs.waterDate=prefs.activityDate;prefs.waterSips=0;prefs.waterLastAt=resetAt;prefs.waterGraceUntil=0;prefs.gazeLastAt=resetAt;prefs.gazeSnoozedUntil=0;prefs.bodyLastAt=resetAt;prefs.bodySnoozedUntil=0;prefs.bodyResetStart=0;prefs.bodySessions=[];prefs.awayStart=0;prefs.awaySessions=[];prefs.prayerBreakStart=0;prefs.prayerBreakKey='';prefs.prayerBreakName='';prefs.prayerSessions=[];prefs.noodleStart=0;prefs.noodleDurationAtStart=0;prefs.noodleDone='';prefs.lunchStart=0;prefs.lunchDurationAtStart=0;prefs.lunchModeAtStart=prefs.lunchMode;prefs.lunchDone='';prefs.lunchLoggedMinutes=0;prefs.lunchSessions=[];prefs.kaizenDismissed='';prefs.notificationActionHistory=(prefs.notificationActionHistory||[]).filter(item=>localDayKey(new Date(item.at))!==prefs.activityDate);testPrayer='none';testRoutine='none';toast('Today’s workday records reset');}
    save();render();const st=currentStates();buildPanel(st.h,st.prayer,st.water,st.noodle,st.away,st.lunch);
  });
  $('panel').addEventListener('input',e=>{const key=e.target?.dataset?.palette;if(!['customBgA','customBgB','customInk','customAccent'].includes(key))return;e.stopPropagation();prefs[key]=e.target.value;save();const now=new Date();applyTheme(now,now.getHours()+now.getMinutes()/60);});

  document.addEventListener('click',()=>{if(panelOpen)togglePanel(false);});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&$('onboarding')&&!$('onboarding').hidden){closeOnboarding();e.preventDefault();return;}
    if(e.key==='Escape'&&$('foldDrawer')&&!$('foldDrawer').hidden){closeFold();e.preventDefault();return;}
    const target=e.target,interactive=target&&target.closest&&target.closest('button,a,input,select,textarea,[contenteditable="true"]');
    if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||interactive)return;
    if(e.key==='r'||e.key==='R')revealFor();
    else if(e.key==='c'||e.key==='C'){openFold('capture');e.preventDefault();}
    else if(e.key==='m'||e.key==='M'){openFold('care');e.preventDefault();}
    else if(e.key==='o'||e.key==='O'){openFold('sound');e.preventDefault();}
    else if(e.key==='w'||e.key==='W'){logWater(e.shiftKey?-1:1);e.preventDefault();}
    else if(e.key==='n'||e.key==='N'){noodleAction(e.shiftKey);e.preventDefault();}
    else if(e.key==='b'||e.key==='B'){awayAction(e.shiftKey);e.preventDefault();}
    else if(e.key==='l'||e.key==='L'){lunchAction(e.shiftKey);e.preventDefault();}
    else if(e.key==='p'||e.key==='P'){const st=currentStates();if(st.prayer.signal==='active')finishPrayerBreak(e.shiftKey);else if(['due','pending','snoozed'].includes(st.prayer.signal))startPrayerBreak(st.prayer);else quickPrayer(5);e.preventDefault();}
    else if(e.key==='Enter'){if(primaryAcknowledge())e.preventDefault();}
    else if(e.key==='s'||e.key==='S'){if(smartSnooze())e.preventDefault();}
    else if(e.key==='h'||e.key==='H'){document.body.classList.toggle('cover');toast(document.body.classList.contains('cover')?'Cover on':'Cover off');}
    else if(e.key===',')togglePanel();
    else if(e.key==='Escape'){togglePanel(false);document.body.classList.remove('reveal');testPrayer='none';testRoutine='none';clearTimeout(testTimer);render();}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){times=computeTimes(new Date());render();checkForUpdate(true);void syncCaptureQueue(false);void drainNotificationActions();}});
  window.addEventListener('focus',()=>{render();checkForUpdate(true);void syncCaptureQueue(false);void drainNotificationActions();});
  window.addEventListener('pageshow',()=>{render();checkForUpdate(true);void syncCaptureQueue(false);void drainNotificationActions();});
  window.addEventListener('online',()=>{render();checkForUpdate(true);void syncCaptureQueue(false);void drainNotificationActions();});
  if(systemDark)systemDark.addEventListener?.('change',render);
  window.addEventListener('storage',e=>{if([STORAGE_KEY,'pacefoldPrefsV14','pacefoldPrefsV13','pacefoldPrefsV12','pacefoldPrefsV11','desklinePrefsV11','desklinePrefsV10','desklinePrefsV8'].includes(e.key)){try{prefs=normalizePrefs(safeJSON(e.newValue)||{});times=computeTimes(new Date());lastBadge='';render();}catch(error){reportError(error,'storage-sync');}}});
  if('permissions'in navigator&&notificationPermission()!=='unsupported'){navigator.permissions.query({name:'notifications'}).then(status=>{status.addEventListener?.('change',()=>{if(notificationPermission()!=='granted'&&prefs.browserNotif){prefs.browserNotif=false;save();}renderSetupDock();if(panelOpen){const st=currentStates();buildPanel(st.h,st.prayer,st.water,st.noodle,st.away,st.lunch);}});}).catch(()=>{});}

  document.body.classList.toggle('reveal',!prefs.privacy);
  const preview=new URLSearchParams(location.search).get('preview');
  if(preview==='prayer'||preview==='due')testPrayer='due';
  else if(['water','noodle','away','lunch'].includes(preview))testRoutine=preview;
  else if(preview==='showcase'){testRoutine='showcase';document.body.classList.add('reveal');}
  function scheduleTick(){render();const delay=Math.max(120,1015-(Date.now()%1000));setTimeout(scheduleTick,delay);}
  if(notificationPermission()!=='granted'&&prefs.browserNotif){prefs.browserNotif=false;save();}
  renderSetupDock(setupRequested);
  if('launchQueue'in window&&window.launchQueue?.setConsumer)window.launchQueue.setConsumer(params=>{if(params?.targetURL)setTimeout(()=>void handleLaunchTarget(params.targetURL),180);});
  registerPacefoldWorker();scheduleTick();
  setTimeout(()=>{void syncCaptureQueue(false);},2400);
  setInterval(()=>{void syncCaptureQueue(false);},5*60000);
  if(setupRequested||!isOnboarded())setTimeout(()=>openOnboarding(setupRequested&&isOnboarded()?2:0),550);
  else if(captureRequested)setTimeout(()=>void handleLaunchTarget(location.href),420);
  else if(careRequested||soundRequested||actionRequested)setTimeout(()=>void handleLaunchTarget(location.href),420);
  window.pacefoldPreview=mode=>{testPrayer=mode==='prayer'?'due':'none';testRoutine=['water','noodle','away','lunch','showcase'].includes(mode)?mode:'none';if(mode==='showcase')document.body.classList.add('reveal');render();};
  window.pacefoldNotificationPreview=(source,specOnly=false)=>showSystemNotification(`preview-${source}-${Date.now()}`,notificationActionLabel(source),source,true,specOnly);
})();
