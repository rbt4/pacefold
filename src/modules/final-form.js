import{$,$$,id,el,button}from'./state.js';

export const FINAL_RELEASE='27.1.0';
export const FINAL_REVISION='final-form-r1';
const STREAM_STORE='pacefold.stream.v1';

const clamp=(value,min,max,fallback=min)=>{const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback};
const cleanStreamState=value=>{
  const source=value&&typeof value==='object'?value:{};
  const library=(Array.isArray(source.library)?source.library:[]).filter(item=>item&&typeof item.url==='string'&&/^https:\/\/(?:www\.)?(?:youtube\.com|music\.youtube\.com|youtu\.be)\//i.test(item.url)).slice(0,24).map(item=>({url:String(item.url),title:String(item.title||'Saved music').slice(0,120),author:String(item.author||'YouTube').slice(0,100),type:item.type==='playlist'?'playlist':'track',addedAt:Number(item.addedAt)||Date.now()}));
  return{url:String(source.url||''),volume:clamp(source.volume,0,1,.35),time:Math.max(0,Number(source.time)||0),index:Math.max(0,Math.floor(Number(source.index)||0)),title:String(source.title||'').slice(0,120),author:String(source.author||'').slice(0,100),shuffle:Boolean(source.shuffle),loop:Boolean(source.loop),library};
};

export function prepareFinalForm(ctx){
  ctx.RELEASE=FINAL_RELEASE;
  ctx.REVISION=FINAL_REVISION;
  ctx.prepName=()=>ctx.prefs.profile==='original'?'Noodles':'Prep';
  ctx.prepTimerName=()=>ctx.prefs.profile==='original'?'Noodle timer':'Preparation timer';
  ctx.log.version=FINAL_RELEASE;
}

export function installFinalForm(ctx){
  const baseStoreLog=ctx.storeLog;
  ctx.storeLog=(reason='log')=>{const result=baseStoreLog(reason);ctx.log.version=ctx.RELEASE;localStorage.setItem(ctx.KEYS.log,JSON.stringify(ctx.log));return result};

  const baseBackup=ctx.currentBackup;
  ctx.currentBackup=()=>{const payload=baseBackup();const stream=cleanStreamState(ctx.safeGet(STREAM_STORE,{}));return{...payload,release:ctx.RELEASE,revision:ctx.REVISION,player:{...(payload.player||{}),soundChoice:ctx.prefs.soundChoice,soundVolume:ctx.prefs.soundVolume,stream}}};

  ctx.restoreBackupFile=async file=>{
    try{
      const data=JSON.parse(await file.text());
      if(!['pacefold.backup.v1','pacefold.backup.v2','pacefold.backup.v3'].includes(data.format))throw new Error('Not a Pacefold backup');
      const restoredNotes=ctx.normalizeNotes(data.notes||data.entries||[]);
      if(!await ctx.confirmAction('Restore this Pacefold backup?',`This will replace current settings, notes and day log with ${restoredNotes.length} notes from the selected file.`))return;
      ctx.prefs=ctx.migratePrefs(data.prefs||{});ctx.notes=restoredNotes;ctx.log=ctx.normalizeLog(data.log||{});ctx.log.version=ctx.RELEASE;
      if(data.player?.soundChoice)ctx.prefs.soundChoice=String(data.player.soundChoice);if(Number.isFinite(Number(data.player?.soundVolume)))ctx.prefs.soundVolume=clamp(data.player.soundVolume,0,1,.18);
      localStorage.setItem(ctx.KEYS.prefs,JSON.stringify(ctx.prefs));localStorage.setItem(ctx.KEYS.notes,JSON.stringify({v:1,items:ctx.notes,savedAt:new Date().toISOString()}));localStorage.setItem(ctx.KEYS.log,JSON.stringify(ctx.log));localStorage.setItem(ctx.KEYS.onboarding,'1');
      if(data.player?.stream)localStorage.setItem(STREAM_STORE,JSON.stringify(cleanStreamState(data.player.stream)));
      ctx.selectedDate=ctx.todayKey();ctx.calendarCursor=new Date(`${ctx.selectedDate}T12:00:00`);ctx.toast('Backup restored · refreshing');setTimeout(()=>location.reload(),420);
    }catch(error){ctx.toast(error.message||'Backup could not be restored')}
  };

  const baseGenerateStatic=ctx.generateStatic;
  ctx.generateStatic=()=>{
    baseGenerateStatic();
    const custom=id('custom-moment-rows');
    while(custom&&custom.children.length<8){
      const index=custom.children.length,row=el('label','custom-moment-row');row.dataset.customRow=String(index);const name=el('input'),time=el('input');
      name.type='text';name.placeholder=`Moment ${index+1}`;name.dataset.customLabel='true';name.setAttribute('aria-label',`Custom moment ${index+1} name`);time.type='time';time.dataset.customTime='true';time.setAttribute('aria-label',`Custom moment ${index+1} time`);row.append(name,time);custom.append(row);
    }
    const privacy=id('rhythm-discretion-setting')?.querySelector('p');if(privacy)privacy.textContent='Clock and Now follow this privacy setting. Settings always keeps the controls available.';
  };

  const applyPrepLabels=()=>{
    const name=ctx.prepName(),quick=$('[data-action="prep"] strong');if(quick)quick.textContent=name;
    const nowQuick=$('.now-quick [data-action="prep"]');if(nowQuick&&!ctx.timerState('prep',ctx.prefs.prepMinutes).start)nowQuick.textContent=name;
    const setting=id('prep-minutes-input')?.closest('label');if(setting?.firstChild?.nodeType===Node.TEXT_NODE)setting.firstChild.nodeValue=`${name==='Noodles'?'Noodle':'Prep'} timer (min)`;
    for(const item of $$('.active-item strong'))if(item.textContent==='Preparation')item.textContent=name;
  };
  const baseRenderActions=ctx.renderActions;ctx.renderActions=()=>{baseRenderActions();applyPrepLabels()};
  const baseRenderActive=ctx.renderActive;ctx.renderActive=()=>{baseRenderActive();applyPrepLabels()};
  const baseRenderSettings=ctx.renderSettings;ctx.renderSettings=()=>{baseRenderSettings();applyPrepLabels()};

  const basePerformAction=ctx.performAction;
  ctx.performAction=action=>{
    if(action!=='prep')return basePerformAction(action);
    const now=Date.now(),state=ctx.timerState('prep',ctx.prefs.prepMinutes),name=ctx.prepName(),timerName=ctx.prepTimerName();
    if(state.start){ctx.closeSession('prep',`${timerName} complete`);ctx.storePrefs({noodleStart:0},'prep-end');ctx.toast(state.done?`${name} ready · cleared`:`${name} timer stopped`)}
    else{ctx.storePrefs({noodleStart:now,noodleMinutes:ctx.prefs.prepMinutes},'prep-start');ctx.openSession('prep','timer',timerName,`${ctx.prefs.prepMinutes} minutes`,now);ctx.toast(`${ctx.prefs.prepMinutes}-minute ${name.toLowerCase()} timer started`)}
    ctx.refreshCues();ctx.renderAll?.();
  };

  const baseComputeCues=ctx.computeCues;
  ctx.computeCues=(now=new Date())=>baseComputeCues(now).map(cue=>cue.source==='prep'?{...cue,label:`${ctx.prepName()} ready`,detail:`${ctx.prepTimerName()} is complete`}:cue);
  const baseWriteCueMirror=ctx.writeCueMirror;ctx.writeCueMirror=value=>{if(value?.timers?.prep)value={...value,timers:{...value.timers,prep:{...value.timers.prep,label:`${ctx.prepName()} ready`,detail:`${ctx.prepTimerName()} is complete`}}};return baseWriteCueMirror(value)};
  const baseSnooze=ctx.snoozeCues;ctx.snoozeCues=(minutes=10)=>{baseSnooze(minutes);ctx.toast(`Cues snoozed for ${minutes} minutes`)};

  const buildFocusSounds=()=>{
    const chooser=id('stream-chooser');if(!chooser||id('stream-focus-sounds'))return;
    const section=el('section','stream-focus-sounds');section.id='stream-focus-sounds';const head=el('header');head.append(el('span','','Focus sounds'),el('small','','Local · no stream'));const stop=button('stream-focus-stop','Stop focus sound','Stop');stop.addEventListener('click',()=>ctx.stopSound?.());head.append(stop);const grid=el('div','stream-focus-grid');
    for(const[value,label,detail]of[['brown','Brown hush','Low, steady noise'],['rain','Rain glass','Soft rain texture'],['fan','Soft fan','Even room-like hum'],['local','Local audio','Choose a file from this device']]){const control=button('stream-focus-choice',`Play ${label}`);control.dataset.soundChoice=value;const copy=el('span');copy.append(el('strong','',label),el('small','',detail));control.append(copy);control.addEventListener('click',async()=>{id('stream-video-close')?.click();if(ctx.soundPlaying&&ctx.prefs.soundChoice===value){ctx.stopSound();return}ctx.storePrefs({soundChoice:value},'focus-sound');await ctx.startSound?.();ctx.renderFocusSoundButtons?.()});grid.append(control)}
    const volume=el('label','stream-focus-volume');volume.append(el('span','','Focus volume'));const range=el('input');range.type='range';range.min='0';range.max='1';range.step='.01';range.value=String(ctx.prefs.soundVolume);range.setAttribute('aria-label','Focus sound volume');range.addEventListener('input',()=>{const value=clamp(range.value,0,1,.18);ctx.prefs.soundVolume=value;if(ctx.audioGain&&ctx.audioContext)ctx.audioGain.gain.setTargetAtTime(value,ctx.audioContext.currentTime,.05);id('audio-player').volume=value});range.addEventListener('change',()=>ctx.storePrefs({soundVolume:clamp(range.value,0,1,.18)},'focus-volume'));volume.append(range);section.append(head,grid,volume);chooser.append(section);
  };
  ctx.renderFocusSoundButtons=()=>{for(const control of $$('.stream-focus-choice'))control.setAttribute('aria-pressed',String(ctx.soundPlaying&&control.dataset.soundChoice===ctx.prefs.soundChoice));const range=$('.stream-focus-volume input');if(range)range.value=String(ctx.prefs.soundVolume);const stop=$('.stream-focus-stop');if(stop)stop.disabled=!ctx.soundPlaying};
  buildFocusSounds();const baseRenderSound=ctx.renderSound;ctx.renderSound=()=>{baseRenderSound();ctx.renderFocusSoundButtons()};ctx.renderFocusSoundButtons();
  document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('#stream-play,.stream-track,.stream-library-pick'))ctx.stopSound?.(false)},{capture:true});id('stream-add-form')?.addEventListener('submit',()=>ctx.stopSound?.(false),{capture:true});

  const baseCueFavicon=ctx.cueFavicon;
  ctx.cueFavicon=cues=>{
    const list=Array.isArray(cues)?cues.filter(Boolean).slice(0,4):cues?[cues]:[],parts=new Intl.DateTimeFormat('en-CA',{timeZone:ctx.prefs.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()),read=type=>Number(parts.find(part=>part.type===type)?.value)||0,hour=read('hour'),minute=read('minute'),point=(angle,length)=>{const radians=(angle-90)*Math.PI/180;return{x:32+Math.cos(radians)*length,y:32+Math.sin(radians)*length}},m=point(minute*6,14),h=point((hour%12)*30+minute*.5,9),positions=[[51,12],[53,25],[53,39],[51,52]],dots=list.map((cue,index)=>{const[x,y]=positions[index],color=ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus;return`<circle cx="${x}" cy="${y}" r="5" fill="${color}" stroke="#f7faf9" stroke-width="2"/>`}).join('');
    return`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="5" y="5" width="54" height="54" rx="18" fill="#173f45"/><circle cx="32" cy="32" r="20" fill="none" stroke="#dceee9" stroke-width="3"/><path d="M32 18v3M46 32h-3M32 46v-3M18 32h3" stroke="#8fcab7" stroke-width="2.4" stroke-linecap="round"/><path d="M32 32L${h.x.toFixed(1)} ${h.y.toFixed(1)}M32 32L${m.x.toFixed(1)} ${m.y.toFixed(1)}" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="32" r="2.5" fill="#fff"/>${dots}</svg>`)}`;
  };
  ctx.renderCueFavicon=()=>{const favicon=id('app-favicon');if(favicon){favicon.href=ctx.cueFavicon(ctx.currentCues||[]);favicon.type='image/svg+xml'}};

  ctx.runSelfCheck=async()=>{
    const results=[],check=(name,ok,detail='')=>results.push(`${ok?'PASS':'FAIL'} · ${name}${detail?` · ${detail}`:''}`);
    try{const key='pacefold-final-check';localStorage.setItem(key,'ok');check('Local storage',localStorage.getItem(key)==='ok');localStorage.removeItem(key)}catch(error){check('Local storage',false,error.message)}
    const state=ctx.getSchedule(new Date()),backup=ctx.currentBackup(),stream=cleanStreamState(ctx.safeGet(STREAM_STORE,{}));
    check('Release',ctx.RELEASE===FINAL_RELEASE,`${ctx.RELEASE} · ${ctx.REVISION}`);check('Schedule',state.today.length>=3,`${state.today.length} moments`);check('Schedule order',state.today.every((item,index,rows)=>!index||item.date>rows[index-1].date));check('Privacy mode',['names','neutral','hidden'].includes(ctx.prefs.rhythmDiscretion),ctx.prefs.rhythmDiscretion);check('Clock',Boolean(id('analog')&&id('day-now-line')&&id('pace-cover')),'cover + instrument');check('Directional views',$$('[data-view]').length===5,`${$$('[data-view]').length} views`);check('Quick actions',$$('.quick-action').length===6,`${$$('.quick-action').length} actions`);check('Custom moments',$$('#custom-moment-rows [data-custom-row]').length===8,'8 preserved slots');check('Notes',Array.isArray(ctx.notes),`${ctx.notes.length} notes`);check('Music',Boolean(id('stream-player')&&id('stream-focus-sounds')),'stream + local focus');check('My Music backup',Boolean(backup.player?.stream),`${stream.library.length} saved`);check('Service worker','serviceWorker'in navigator,navigator.serviceWorker?.controller?'controlling':'supported');check('Live backup',Boolean(ctx.liveBackupHandle),ctx.liveBackupHandle?.name||'optional');
    id('diagnostic-output').textContent=[`Pacefold ${ctx.RELEASE} · ${ctx.REVISION}`,`Time zone · ${ctx.prefs.timeZone}`,`Storage · ${new Blob([JSON.stringify(backup)]).size.toLocaleString()} bytes`,'',...results].join('\n');ctx.toast(results.some(row=>row.startsWith('FAIL'))?'Self-check found an issue':'Self-check passed');
  };
}
