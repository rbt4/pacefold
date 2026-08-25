export const VERSION='29.1.1';
export const REVISION='atelier-r2';
export const KEYS={
  prefs:'pacefoldPrefsV15',
  notes:'pacefold.notebook.entries.v2',
  log:'pacefold.dayflow.v1',
  onboarding:'pacefoldOnboardedV15',
  setupDismissed:'pacefoldSetupDismissedV15',
  backupMeta:'pacefold.backup.file.v1',
  weather:'pacefold.weather.v25',
  cueState:'pacefold.cues.v25'
};

export const DEFAULT_PREFS={
  profile:'original',
  lat:43.6205,
  lng:-79.5132,
  locationLabel:'Etobicoke, Toronto',
  timeZone:'America/Toronto',
  method:'15',
  asr:'hanafi',
  offsets:{fajr:0,dhuhr:0,asr:0,maghrib:0,isha:0},
  timeFormat:'12',
  showSeconds:true,
  workHours:'08:30-16:30',
  workDays:[1,2,3,4,5],
  quietMode:false,
  notifications:false,
  weatherEnabled:true,
  waterTarget:24,
  waterStep:2,
  waterCadence:45,
  eyeCadence:20,
  bodyCadence:45,
  prepMinutes:30,
  mealMinutes:20,
  awayMinutes:10,
  theme:'paper',
  soundChoice:'brown',
  soundVolume:.18,
  soundDuck:true,
  oneNoteClientId:'',
  oneNoteTenant:'organizations',
  oneNoteNotebookId:'',
  oneNoteNotebookName:'',
  oneNoteSectionId:'',
  oneNoteSectionName:'',
  oneNotePages:{},
  oneNoteLastSync:0,
  oneNoteLastError:'',
  customMoments:[['morning','Morning reset','09:30'],['midday','Midday pause','12:30'],['afternoon','Afternoon reset','15:00']],
  v25MigratedAt:0
};

export const PRAYER_ROWS=[
  ['fajr','Fajr'],
  ['sunrise','Sunrise'],
  ['dhuhr','Dhuhr'],
  ['asr','Asr'],
  ['maghrib','Maghrib'],
  ['isha','Isha']
];

export const ALERT_PRAYERS=new Set(['fajr','dhuhr','asr','maghrib','isha']);

export function parseJson(raw,fallback){
  try{return raw?JSON.parse(raw):fallback}catch{return fallback}
}

export function clamp(value,min,max,fallback=min){
  const numeric=Number(value);
  return Number.isFinite(numeric)?Math.min(max,Math.max(min,numeric)):fallback;
}

export function cleanText(value,max=500){
  return String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
}

export function migratePrefs(raw={}){
  const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const migrated={...DEFAULT_PREFS,...source};
  migrated.profile=['original','muslim','everyday','mindful','custom'].includes(String(source.profile))?String(source.profile):'original';
  migrated.lat=clamp(source.lat,-90,90,DEFAULT_PREFS.lat);
  migrated.lng=clamp(source.lng,-180,180,DEFAULT_PREFS.lng);
  migrated.locationLabel=cleanText(source.locationLabel||DEFAULT_PREFS.locationLabel,80);
  migrated.timeZone=cleanText(source.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||DEFAULT_PREFS.timeZone,80);
  migrated.method=String(source.method)==='18'?'18':'15';
  migrated.asr=String(source.asr)==='standard'?'standard':'hanafi';
  migrated.offsets={...DEFAULT_PREFS.offsets,...(source.offsets&&typeof source.offsets==='object'?source.offsets:{})};
  for(const key of ALERT_PRAYERS)migrated.offsets[key]=clamp(migrated.offsets[key],-90,90,0);
  migrated.timeFormat=String(source.timeFormat)==='24'?'24':'12';
  migrated.showSeconds=source.showSeconds!==false;
  migrated.workHours=/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(String(source.workHours))?String(source.workHours):DEFAULT_PREFS.workHours;
  migrated.workDays=Array.isArray(source.workDays)?[...new Set(source.workDays.map(Number).filter(day=>day>=0&&day<=6))]:DEFAULT_PREFS.workDays.slice();
  migrated.quietMode=Boolean(source.quietMode);
  migrated.notifications=source.notifications===true||source.notificationMode==='system';
  migrated.weatherEnabled=source.weatherEnabled!==false&&source.v21WeatherEnabled!==false;
  migrated.waterTarget=clamp(source.waterTarget,8,128,24);
  migrated.waterStep=clamp(source.waterStep,1,16,2);
  migrated.waterCadence=clamp(source.waterCadence,15,180,45);
  migrated.eyeCadence=clamp(source.eyeCadence||source.gazeCadence,10,120,20);
  migrated.bodyCadence=clamp(source.bodyCadence,15,180,45);
  migrated.prepMinutes=clamp(source.prepMinutes||source.noodleMinutes,1,180,30);
  migrated.mealMinutes=clamp(source.mealMinutes||source.lunchMinutes,5,120,20);
  migrated.awayMinutes=clamp(source.awayMinutes,1,120,10);
  migrated.customMoments=(Array.isArray(source.customMoments)&&source.customMoments.length?source.customMoments:DEFAULT_PREFS.customMoments).map((item,index)=>{const row=Array.isArray(item)?item:[item?.id,item?.label,item?.time];return[String(row[0]||`moment-${index+1}`),cleanText(row[1]||`Moment ${index+1}`,40),/^\d{1,2}:\d{2}$/.test(String(row[2]))?String(row[2]).padStart(5,'0'):'12:00']}).slice(0,8);
  migrated.waterOz=clamp(source.waterOz??source.waterSips,0,256,0);
  migrated.waterDate=String(source.waterDate||'');
  migrated.v25MigratedAt=Number(source.v25MigratedAt)||Date.now();
  return migrated;
}

const rad=value=>value*Math.PI/180;
const deg=value=>value*180/Math.PI;
const sin=value=>Math.sin(rad(value));
const cos=value=>Math.cos(rad(value));
const tan=value=>Math.tan(rad(value));
const asin=value=>deg(Math.asin(value));
const acos=value=>deg(Math.acos(value));
const atan2=(y,x)=>deg(Math.atan2(y,x));
const acot=value=>deg(Math.atan2(1,value));
const fixAngle=value=>((value%360)+360)%360;
const fixHour=value=>((value%24)+24)%24;
const pad=value=>String(value).padStart(2,'0');

export function zoneParts(date=new Date(),timeZone=DEFAULT_PREFS.timeZone){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const result={};
  for(const part of parts)if(part.type!=='literal')result[part.type]=Number(part.value);
  return result;
}

export function zoneOffsetHours(date,timeZone=DEFAULT_PREFS.timeZone){
  const part=zoneParts(date,timeZone);
  const stamp=Date.UTC(part.year,part.month-1,part.day,part.hour,part.minute,part.second);
  return (stamp-date.getTime())/3600000;
}

export function zonedDate(year,month,day,hours,timeZone=DEFAULT_PREFS.timeZone){
  const whole=Math.floor(hours);
  const rawMinute=Math.round((hours-whole)*60);
  const normalizedHour=whole+Math.floor(rawMinute/60);
  const normalizedMinute=((rawMinute%60)+60)%60;
  let stamp=Date.UTC(year,month-1,day,normalizedHour,normalizedMinute,0);
  for(let index=0;index<3;index+=1){
    stamp=Date.UTC(year,month-1,day,normalizedHour,normalizedMinute,0)-zoneOffsetHours(new Date(stamp),timeZone)*3600000;
  }
  return new Date(stamp);
}

export function dateKey(date=new Date(),timeZone=DEFAULT_PREFS.timeZone){
  const part=zoneParts(date,timeZone);
  return `${part.year}-${pad(part.month)}-${pad(part.day)}`;
}

function julian(year,month,day){
  if(month<=2){year-=1;month+=12}
  const a=Math.floor(year/100),b=2-a+Math.floor(a/4);
  return Math.floor(365.25*(year+4716))+Math.floor(30.6001*(month+1))+day+b-1524.5;
}

function sunPosition(jd){
  const d=jd-2451545,g=fixAngle(357.529+.98560028*d),q=fixAngle(280.459+.98564736*d),l=fixAngle(q+1.915*sin(g)+.020*sin(2*g)),e=23.439-.00000036*d;
  const ra=atan2(cos(e)*sin(l),cos(l))/15;
  return{declination:asin(sin(e)*sin(l)),equation:q/15-fixHour(ra)};
}

export function prayerHours(date=new Date(),rawPrefs=DEFAULT_PREFS){
  const prefs=migratePrefs(rawPrefs),timeZone=prefs.timeZone,part=zoneParts(date,timeZone),anchor=zonedDate(part.year,part.month,part.day,12,timeZone);
  const latitude=prefs.lat,longitude=prefs.lng,timeZoneHours=zoneOffsetHours(anchor,timeZone),jd=julian(part.year,part.month,part.day)-longitude/(15*24);
  const noon=time=>fixHour(12-sunPosition(jd+time).equation);
  const angleAt=(angle,time,direction)=>{
    const declination=sunPosition(jd+time).declination,midday=noon(time),numerator=-sin(angle)-sin(declination)*sin(latitude),denominator=cos(declination)*cos(latitude),ratio=clamp(numerator/denominator,-1,1,0),span=acos(ratio)/15;
    return midday+(direction==='before'?-span:span);
  };
  const asrAt=(factor,time)=>{
    const declination=sunPosition(jd+time).declination;
    return angleAt(-acot(factor+tan(Math.abs(latitude-declination))),time,'after');
  };
  const twilight=prefs.method==='18'?18:15,asrFactor=prefs.asr==='hanafi'?2:1;
  const times={fajr:5,sunrise:6,dhuhr:12,asr:13,maghrib:18,isha:19};
  for(let index=0;index<5;index+=1){
    const fraction={};for(const key of Object.keys(times))fraction[key]=times[key]/24;
    times.fajr=angleAt(twilight,fraction.fajr,'before');
    times.sunrise=angleAt(.833,fraction.sunrise,'before');
    times.dhuhr=noon(fraction.dhuhr);
    times.asr=asrAt(asrFactor,fraction.asr);
    times.maghrib=angleAt(.833,fraction.maghrib,'after');
    times.isha=angleAt(twilight,fraction.isha,'after');
  }
  const adjustment=timeZoneHours-longitude/15;
  for(const key of Object.keys(times))times[key]+=adjustment;
  times.dhuhr+=1/60;
  for(const key of ALERT_PRAYERS)times[key]+=(Number(prefs.offsets[key])||0)/60;
  return times;
}

export function parseClock(value){
  const match=String(value||'').match(/^(\d{1,2}):(\d{2})$/);
  if(!match)return NaN;
  const hours=Number(match[1]),minutes=Number(match[2]);
  return hours>=0&&hours<=23&&minutes>=0&&minutes<=59?hours+minutes/60:NaN;
}

export function scheduleForDate(date=new Date(),rawPrefs=DEFAULT_PREFS,{includeSunrise=true}={}){
  const prefs=migratePrefs(rawPrefs),timeZone=prefs.timeZone,part=zoneParts(date,timeZone),muslim=['original','muslim'].includes(prefs.profile);
  if(muslim){
    const hours=prayerHours(date,prefs);
    return PRAYER_ROWS.filter(([key])=>includeSunrise||ALERT_PRAYERS.has(key)).map(([id,label])=>({id,label,hours:hours[id],date:zonedDate(part.year,part.month,part.day,hours[id],timeZone),alert:ALERT_PRAYERS.has(id)}));
  }
  const presets={
    everyday:[['morning','Morning reset','09:30'],['midday','Midday pause','12:30'],['afternoon','Afternoon reset','15:00']],
    mindful:[['arrive','Arrive','09:00'],['breathe','Breathe','11:00'],['reset','Reset','14:00'],['close','Close','16:15']],
    custom:Array.isArray(prefs.customMoments)?prefs.customMoments:[]
  };
  const source=presets[prefs.profile]||presets.everyday;
  return source.map((item,index)=>{
    const row=Array.isArray(item)?item:[item?.id,item?.label,item?.time],hours=parseClock(row[2]);
    return{id:String(row[0]||`moment-${index+1}`),label:cleanText(row[1]||`Moment ${index+1}`,40),hours,date:zonedDate(part.year,part.month,part.day,hours,timeZone),alert:true};
  }).filter(item=>Number.isFinite(item.hours)).sort((a,b)=>a.date-b.date);
}

export function scheduleState(date=new Date(),rawPrefs=DEFAULT_PREFS){
  const prefs=migratePrefs(rawPrefs),today=scheduleForDate(date,prefs,{includeSunrise:true});
  let next=today.find(item=>item.date>date&&item.alert);
  if(!next){
    const part=zoneParts(date,prefs.timeZone),tomorrow=zonedDate(part.year,part.month,part.day+1,12,prefs.timeZone);
    next=scheduleForDate(tomorrow,prefs,{includeSunrise:true}).find(item=>item.alert);
  }
  return{today,next,muslim:['original','muslim'].includes(prefs.profile),prefs};
}

export function workRange(rawPrefs=DEFAULT_PREFS,date=new Date()){
  const prefs=migratePrefs(rawPrefs),part=zoneParts(date,prefs.timeZone),weekday=zonedDate(part.year,part.month,part.day,12,prefs.timeZone).getUTCDay(),row=prefs.workWeek&&typeof prefs.workWeek==='object'?(prefs.workWeek[weekday]||prefs.workWeek[String(weekday)]):null,globalMatch=prefs.workHours.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/),rowStart=/^\d{2}:\d{2}$/.test(String(row?.start))?row.start:globalMatch?.[1],rowEnd=/^\d{2}:\d{2}$/.test(String(row?.end))?row.end:globalMatch?.[2],match=[null,rowStart,rowEnd],startHours=parseClock(match[1]),endHours=parseClock(match[2]);
  const valid=Number.isFinite(startHours)&&Number.isFinite(endHours)&&endHours>startHours;
  const start=valid?startHours:8.5,end=valid?endHours:16.5;
  return{start,end,startText:valid?match[1]:'08:30',endText:valid?match[2]:'16:30',activeDay:row?.type==='off'?false:row?.type?prefs.workDays.includes(weekday)||row.type!=='off':prefs.workDays.includes(weekday)};
}

export function normalizeNotes(value){
  if(!Array.isArray(value))return[];
  return value.filter(item=>item&&typeof item==='object').map((note,index)=>{
    const createdAt=note.createdAt||note.updatedAt||new Date().toISOString();
    return{...note,id:String(note.id||`legacy-${index}-${Date.parse(createdAt)||Date.now()}`),date:/^\d{4}-\d{2}-\d{2}$/.test(String(note.date))?String(note.date):dateKey(new Date(createdAt)),body:String(note.body??note.text??'').slice(0,6000),category:cleanText(note.category||note.kind||'Note',32)||'Note',createdAt,updatedAt:note.updatedAt||createdAt};
  }).filter(note=>note.body.trim()).slice(-1500);
}

export function normalizeLog(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return{version:VERSION,savedAt:new Date().toISOString(),days:source.days&&typeof source.days==='object'?source.days:{}};
}

export function eventsForDay(log,key){
  const events=normalizeLog(log).days?.[key]?.events;
  return Array.isArray(events)?events.filter(event=>event&&typeof event==='object').slice(-600).sort((a,b)=>Number(a.start)-Number(b.start)):[];
}

export function metricsForDay(log,key,rawPrefs=DEFAULT_PREFS,now=Date.now()){
  const events=eventsForDay(log,key),prefs=migratePrefs(rawPrefs),range=workRange(prefs,new Date(`${key}T12:00:00`)),zone=prefs.timeZone,part=zoneParts(new Date(`${key}T12:00:00`),zone),start=zonedDate(part.year,part.month,part.day,range.start,zone).getTime(),end=zonedDate(part.year,part.month,part.day,range.end,zone).getTime(),limit=Math.min(now,end);
  const duration=types=>events.filter(event=>types.includes(event.type)).reduce((total,event)=>total+Math.max(0,Math.min(Number(event.end)||limit,end)-Math.max(Number(event.start)||start,start)),0);
  const elapsed=Math.max(0,limit-start),away=duration(['away']),meal=duration(['meal']),field=duration(['field']),focus=duration(['focus']);
  return{events,elapsed,away,meal,field,focus,desk:Math.max(0,elapsed-away-meal-field),breaks:events.filter(event=>['away','meal','eyes','move'].includes(event.type)).length};
}

export function backupPayload({prefs,notes,log,player={}}){
  return{format:'pacefold.backup.v3',release:VERSION,exportedAt:new Date().toISOString(),prefs:migratePrefs(prefs),notes:normalizeNotes(notes),log:normalizeLog(log),player};
}
