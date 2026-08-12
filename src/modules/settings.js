import{$,$$,id,el}from'./state.js';

export function installSettings(ctx){
  ctx.setRhythmDiscretion=mode=>{
    if(!['names','neutral','hidden'].includes(mode))return;
    ctx.rhythmRevealUntil=0;
    ctx.storePrefs({rhythmDiscretion:mode},'rhythm-discretion');
    ctx.renderAll?.();
  };

  ctx.renderSettings=()=>{
    for(const node of $$('.setting-toggle')){
      const on=Boolean(ctx.prefs[node.dataset.setting]);
      node.setAttribute('aria-pressed',String(on));
    }
    id('quiet-button').setAttribute('aria-pressed',String(ctx.prefs.quietMode));
    for(const node of $$('[data-rhythm-discretion]')){
      const selected=node.dataset.rhythmDiscretion===ctx.prefs.rhythmDiscretion;
      node.setAttribute('aria-pressed',String(selected));
      node.classList.toggle('active',selected);
    }

    const [start,end]=ctx.prefs.workHours.split('-');
    id('work-start-input').value=start;
    id('work-end-input').value=end;
    id('time-format-input').value=ctx.prefs.timeFormat;
    for(const input of $$('[data-workday]'))input.checked=ctx.prefs.workDays.includes(Number(input.dataset.workday));

    id('profile-input').value=ctx.prefs.profile;
    id('timezone-input').value=ctx.prefs.timeZone;
    id('location-input').value=ctx.prefs.locationLabel;
    id('latitude-input').value=String(ctx.prefs.lat);
    id('longitude-input').value=String(ctx.prefs.lng);
    id('method-input').value=ctx.prefs.method;
    id('asr-input').value=ctx.prefs.asr;

    const custom=ctx.prefs.profile==='custom';
    id('custom-moments').hidden=!custom;
    $('.muslim-settings').hidden=!['original','muslim'].includes(ctx.prefs.profile);
    for(const row of $$('#custom-moment-rows [data-custom-row]')){
      const item=ctx.prefs.customMoments[Number(row.dataset.customRow)]||['','',''];
      $('[data-custom-label]',row).value=item[1]||'';
      $('[data-custom-time]',row).value=item[2]||'';
    }
    for(const input of $$('[data-offset]'))input.value=String(ctx.prefs.offsets[input.dataset.offset]||0);

    for(const [field,value] of [
      ['water-target-input',ctx.prefs.waterTarget],['water-step-input',ctx.prefs.waterStep],['water-cadence-input',ctx.prefs.waterCadence],
      ['eye-cadence-input',ctx.prefs.eyeCadence],['body-cadence-input',ctx.prefs.bodyCadence],['prep-minutes-input',ctx.prefs.prepMinutes],
      ['meal-minutes-input',ctx.prefs.mealMinutes],['away-minutes-input',ctx.prefs.awayMinutes]
    ])id(field).value=String(value);

    id('onenote-client-input').value=ctx.prefs.oneNoteClientId||'';
    id('onenote-tenant-input').value=ctx.prefs.oneNoteTenant||'organizations';
    id('onenote-status').textContent=ctx.prefs.oneNoteLastError
      ?`Paused · ${ctx.prefs.oneNoteLastError}`
      :ctx.prefs.oneNoteSectionId
        ?`Connected · ${ctx.prefs.oneNoteNotebookName} / ${ctx.prefs.oneNoteSectionName}${ctx.prefs.oneNoteLastSync?` · synced ${new Date(ctx.prefs.oneNoteLastSync).toLocaleString()}`:''}`
        :ctx.prefs.oneNoteClientId?'Configured · choose a destination':'Not configured.';

    const profileNames={original:'Original · Muslim',muslim:'Muslim',everyday:'Everyday',mindful:'Mindful',custom:'Custom'};
    const discretionNames={names:'Names on Clock',neutral:'Neutral on Clock',hidden:'Hidden from Clock'};
    const summary=id('settings-summary');
    const meta=ctx.safeGet(ctx.KEYS.backupMeta,null);
    const waiting=ctx.currentCues.length;
    summary.replaceChildren();
    for(const [label,value,color] of [
      ['Profile',`${profileNames[ctx.prefs.profile]||'Original'} · ${discretionNames[ctx.prefs.rhythmDiscretion]||'Neutral on Clock'}`,'#426b5b'],
      ['Workday',`${ctx.formatTime(ctx.zonedForToday(Number(start.slice(0,2))+Number(start.slice(3))/60))}–${ctx.formatTime(ctx.zonedForToday(Number(end.slice(0,2))+Number(end.slice(3))/60))}`,'#3f718b'],
      ['Cues',ctx.prefs.quietMode?'Quiet essentials':ctx.prefs.notifications?'System + dots':`${waiting} dot${waiting===1?'':'s'} waiting`,'#a66f2d'],
      ['Backup',ctx.liveBackupHandle?'Live file connected':meta?.updatedAt?'Downloaded before':'Local only','#77638e']
    ]){
      const chip=el('article','settings-chip'),copy=el('span');
      chip.style.setProperty('--chip',color);
      copy.append(el('small','',label),el('strong','',value));
      chip.append(el('i'),copy);summary.append(chip);
    }

    const health=id('data-health');
    const dayCount=Object.keys(ctx.log.days||{}).length;
    const localSize=new Blob([JSON.stringify(ctx.currentBackup())]).size;
    health.replaceChildren();
    for(const [label,value] of [
      ['Local notes',ctx.notes.length],['Recorded days',dayCount],['Local size',localSize<1024?`${localSize} B`:`${Math.round(localSize/1024)} KB`]
    ]){
      const item=el('span');item.append(el('small','',label),el('strong','',value));health.append(item);
    }

    for(const tab of $$('#settings-nav button'))tab.classList.toggle('active',tab.dataset.settingsTab===ctx.settingsTab);
    for(const panel of $$('[data-settings-panel]'))panel.hidden=panel.dataset.settingsPanel!==ctx.settingsTab;
  };

  ctx.settingsInput=()=>{
    const start=id('work-start-input').value,end=id('work-end-input').value;
    if(start&&end&&start<end)ctx.storePrefs({workHours:`${start}-${end}`},'work-hours');
    const workDays=$$('[data-workday]:checked').map(input=>Number(input.dataset.workday));
    ctx.storePrefs({workDays},'work-days');
    const customMoments=$$('#custom-moment-rows [data-custom-row]')
      .map((row,index)=>[`custom-${index+1}`,$('[data-custom-label]',row).value.trim(),$('[data-custom-time]',row).value])
      .filter(row=>row[1]&&row[2]);
    ctx.storePrefs({
      profile:id('profile-input').value,
      timeFormat:id('time-format-input').value,
      timeZone:id('timezone-input').value.trim()||ctx.DEFAULT_PREFS.timeZone,
      locationLabel:id('location-input').value.trim()||'My location',
      lat:Number(id('latitude-input').value),lng:Number(id('longitude-input').value),
      method:id('method-input').value,asr:id('asr-input').value,
      customMoments:customMoments.length?customMoments:ctx.prefs.customMoments,
      waterTarget:Number(id('water-target-input').value),waterStep:Number(id('water-step-input').value),waterCadence:Number(id('water-cadence-input').value),
      eyeCadence:Number(id('eye-cadence-input').value),bodyCadence:Number(id('body-cadence-input').value),
      prepMinutes:Number(id('prep-minutes-input').value),mealMinutes:Number(id('meal-minutes-input').value),awayMinutes:Number(id('away-minutes-input').value)
    },'settings-form');
    ctx.renderAll?.();
  };

  ctx.toggleSetting=async key=>{
    if(key==='notifications'&&!ctx.prefs.notifications){
      if(!('Notification'in window)){ctx.toast('System notifications are unavailable here');return}
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){ctx.toast('Notifications were not allowed');return}
    }
    ctx.storePrefs({[key]:!ctx.prefs[key]},key);
    if(key==='quietMode'&&ctx.prefs.quietMode)void ctx.clearAllNotifications?.();
    ctx.renderAll?.();
  };

  ctx.useDeviceLocation=()=>{
    if(!navigator.geolocation){ctx.toast('Location is unavailable in this browser');return}
    id('use-location').disabled=true;
    navigator.geolocation.getCurrentPosition(position=>{
      id('use-location').disabled=false;
      ctx.storePrefs({
        lat:position.coords.latitude,lng:position.coords.longitude,
        locationLabel:'Current location',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||ctx.prefs.timeZone
      },'location');
      ctx.renderAll?.();ctx.toast('Location updated');
    },error=>{
      id('use-location').disabled=false;
      ctx.toast(error.code===1?'Location permission was not allowed':'Location could not be read');
    },{enableHighAccuracy:false,timeout:10000,maximumAge:86400000});
  };

  ctx.confirmAction=(title,copy)=>{
    const dialog=id('confirm-dialog');
    id('confirm-title').textContent=title;
    id('confirm-copy').textContent=copy;
    dialog.showModal();
    return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true}));
  };

  ctx.runSelfCheck=async()=>{
    const results=[];
    const check=(name,ok,detail='')=>results.push(`${ok?'PASS':'FAIL'} · ${name}${detail?` · ${detail}`:''}`);
    try{
      const key='pacefold-v26-check';localStorage.setItem(key,'ok');check('Local storage',localStorage.getItem(key)==='ok');localStorage.removeItem(key);
    }catch(error){check('Local storage',false,error.message)}
    const state=ctx.getSchedule(new Date());
    check('Schedule',state.today.length>=3,`${state.today.length} moments`);
    check('Schedule order',state.today.every((item,index,rows)=>!index||item.date>rows[index-1].date));
    check('Clock surface',Boolean(id('analog')&&id('day-markers')));
    check('Directional views',$$('[data-view]').length===5,`${$$('[data-view]').length} views`);
    check('Quick actions',$$('.quick-action').length===6,`${$$('.quick-action').length} actions`);
    check('Notes',Array.isArray(ctx.notes),`${ctx.notes.length} notes`);
    check('Service worker','serviceWorker'in navigator,navigator.serviceWorker?.controller?'controlling':'supported');
    check('Live backup',Boolean(ctx.liveBackupHandle),ctx.liveBackupHandle?.name||'not connected');
    id('diagnostic-output').textContent=[
      `Pacefold ${ctx.RELEASE} · ${ctx.REVISION}`,
      `Time zone · ${ctx.prefs.timeZone}`,
      `Storage · ${new Blob([JSON.stringify(ctx.currentBackup())]).size.toLocaleString()} bytes`,
      '',...results
    ].join('\n');
    ctx.toast(results.some(row=>row.startsWith('FAIL'))?'Self-check found an issue':'Self-check passed');
  };
}
