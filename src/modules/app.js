import{$,$$,id,el,button}from'./state.js';

export function installApp(ctx){
  ctx.render=(view=ctx.mode,{notify=false}={})=>{
    ctx.refreshCues(notify);
    ctx.renderClock(new Date());
    if(view==='home'){
      ctx.renderRhythm(new Date(),{home:true,nowView:false});
      ctx.renderActions();
      ctx.renderFold();
    }
    if(view==='notes')ctx.renderNotes();
    if(view==='worklog')ctx.renderWorklog();
    if(view==='now'){
      ctx.renderRhythm(new Date(),{home:false,nowView:true});
      ctx.renderActive();
      ctx.renderWeather();
    }
    if(view==='settings')ctx.renderSettings();
  };
  ctx.renderAll=()=>ctx.render(ctx.mode);

  ctx.go=(target,{directional=false}={})=>{
    if(!['home','notes','worklog','now','settings'].includes(target))target='home';
    if(directional&&ctx.mode!=='home')target='home';
    ctx.mode=target;
    document.documentElement.dataset.mode=ctx.mode;
    history.replaceState(null,'',ctx.mode==='home'?location.pathname:`${location.pathname}?mode=${ctx.mode}`);
    ctx.idleDeadline=ctx.mode==='home'?0:Date.now()+50000;
    id('return-cue').hidden=true;
    window.scrollTo({top:0,behavior:'smooth'});
    if(ctx.mode==='notes')requestAnimationFrame(()=>id('note-input')?.focus({preventScroll:true}));
    ctx.render(ctx.mode);
    if(ctx.mode==='now')void ctx.fetchWeather(false);
  };

  ctx.blockedFromReturn=()=>Boolean($('input:focus,textarea:focus,select:focus,dialog[open]'));
  ctx.registerActivity=()=>{if(ctx.mode!=='home'&&!ctx.blockedFromReturn())ctx.idleDeadline=Date.now()+50000};
  ctx.renderIdle=()=>{
    if(ctx.mode==='home'||!ctx.idleDeadline){id('return-cue').hidden=true;return}
    if(ctx.blockedFromReturn()){ctx.idleDeadline=Date.now()+50000;id('return-cue').hidden=true;return}
    const seconds=Math.max(0,Math.ceil((ctx.idleDeadline-Date.now())/1000));
    id('return-cue').hidden=seconds>10;
    id('return-cue').textContent=`Clock in ${seconds}s`;
    if(!seconds)ctx.go('home');
  };

  ctx.generateStatic=()=>{
    const ticks=id('clock-ticks');
    if(!ticks.children.length){
      for(let index=0;index<60;index+=1){
        const tick=el('i',index%5===0?'major':'');
        tick.style.setProperty('--i',String(index));ticks.append(tick);
      }
    }
    const offsets=id('offset-grid');
    if(!offsets.children.length){
      for(const key of ctx.ALERT_PRAYERS){
        const label=el('label','',key),input=el('input');
        input.type='number';input.min='-90';input.max='90';input.dataset.offset=key;label.append(input);offsets.append(label);
      }
    }
    const custom=id('custom-moment-rows');
    if(!custom.children.length){
      for(let index=0;index<4;index+=1){
        const row=el('label','custom-moment-row');row.dataset.customRow=String(index);
        const name=el('input'),time=el('input');
        name.type='text';name.placeholder=`Moment ${index+1}`;name.dataset.customLabel='true';name.setAttribute('aria-label',`Custom moment ${index+1} name`);
        time.type='time';time.dataset.customTime='true';time.setAttribute('aria-label',`Custom moment ${index+1} time`);
        row.append(name,time);custom.append(row);
      }
    }

    const rhythmPanel=$('[data-settings-panel="rhythm"]');
    if(rhythmPanel&&!id('rhythm-discretion-setting')){
      const block=el('section','rhythm-discretion-setting');block.id='rhythm-discretion-setting';
      const copy=el('span');copy.append(el('small','','Clock privacy'),el('strong','','Moment names on the Clock'),el('p','','Choose how much the ambient Clock reveals. Now and Settings keep the full schedule available.'));
      const choices=el('div','rhythm-discretion-choices');
      for(const[mode,title,detail]of[
        ['neutral','Neutral','Times and colour only · recommended'],
        ['hidden','Hidden','Remove the rhythm card from Clock'],
        ['names','Names','Show full moment names on Clock']
      ]){
        const control=button('',`${title}: ${detail}`);
        control.dataset.rhythmDiscretion=mode;control.setAttribute('aria-pressed','false');
        control.append(el('strong','',title),el('small','',detail));choices.append(control);
      }
      block.append(copy,choices);rhythmPanel.querySelector(':scope > header')?.after(block);
    }

    const originalSetup=$('[data-setup-profile="original"] small');
    if(originalSetup)originalSetup.textContent='Five daily moments · tuned defaults';
    if(!id('setup-discretion')){
      const setupChoices=$('.setup-choices');
      const block=el('section','setup-discretion');block.id='setup-discretion';
      const copy=el('span');copy.append(el('strong','','Show moment names on the clock?'),el('small','','Default is no. You can reveal names temporarily or change this later.'));
      const choices=el('div');
      const neutral=button('',`Keep moment names neutral on the Clock`,'Keep neutral');neutral.dataset.setupDiscretion='neutral';neutral.setAttribute('aria-pressed','true');
      const names=button('',`Show full moment names on the Clock`,'Show names');names.dataset.setupDiscretion='names';names.setAttribute('aria-pressed','false');
      choices.append(neutral,names);block.append(copy,choices);setupChoices?.after(block);
    }
    id('setup-later').textContent='Continue';
  };

  ctx.bind=()=>{
    document.addEventListener('click',event=>{
      const target=event.target instanceof Element?event.target:null;if(!target)return;
      const edge=target.closest('.edge[data-go]');
      if(edge){ctx.go(edge.dataset.go,{directional:true});return}
      const destination=target.closest('[data-go]');
      if(destination){if(destination.dataset.settingsTarget)ctx.settingsTab=destination.dataset.settingsTarget;ctx.go(destination.dataset.go);return}
      const action=target.closest('[data-action]');
      if(action){ctx.performAction(action.dataset.action);return}
      const noteEdit=target.closest('[data-note-edit]');
      if(noteEdit){const note=ctx.notes.find(item=>item.id===noteEdit.dataset.noteEdit);if(note)ctx.editNote(note);return}
      const noteDelete=target.closest('[data-note-delete]');
      if(noteDelete){const note=ctx.notes.find(item=>item.id===noteDelete.dataset.noteDelete);if(note)void ctx.deleteNote(note);return}
      const logAction=target.closest('[data-log]');
      if(logAction){
        const source=logAction.dataset.log;
        if(source==='field')ctx.toggleSession('field','field','Field work');
        if(source==='focus')ctx.toggleSession('focus','focus','Focus block');
        if(source==='reset')ctx.addMoment('move','Manual reset','Logged from Day view');
        ctx.render(ctx.mode);return;
      }
      const tab=target.closest('[data-settings-tab]');
      if(tab){ctx.settingsTab=tab.dataset.settingsTab;ctx.renderSettings();return}
      const discretion=target.closest('[data-rhythm-discretion]');
      if(discretion){ctx.setRhythmDiscretion(discretion.dataset.rhythmDiscretion);return}
      const toggle=target.closest('[data-setting]');
      if(toggle){void ctx.toggleSetting(toggle.dataset.setting);return}
      const setupDiscretion=target.closest('[data-setup-discretion]');
      if(setupDiscretion){ctx.storePrefs({rhythmDiscretion:setupDiscretion.dataset.setupDiscretion},'onboarding-discretion');for(const node of $$('[data-setup-discretion]'))node.setAttribute('aria-pressed',String(node===setupDiscretion));ctx.render(ctx.mode);return}
      const setup=target.closest('[data-setup-profile]');
      if(setup){ctx.storePrefs({profile:setup.dataset.setupProfile},'onboarding-profile');for(const node of $$('[data-setup-profile]'))node.setAttribute('aria-pressed',String(node===setup));ctx.render(ctx.mode);return}
      const oneNoteItem=target.closest('[data-onenote-id]');
      if(oneNoteItem){const item=ctx.oneNoteCatalog.find(row=>String(row.id)===oneNoteItem.dataset.onenoteId);if(item)void ctx.chooseOneNoteItem(item)}
    });

    document.addEventListener('keydown',event=>{
      if($('input:focus,textarea:focus,select:focus,dialog[open]'))return;
      const map={ArrowUp:'notes',ArrowDown:'settings',ArrowLeft:'worklog',ArrowRight:'now'};
      if(map[event.key]){event.preventDefault();ctx.go(map[event.key],{directional:true})}
      if(event.key==='Escape'||event.key==='Home'){event.preventDefault();ctx.go('home')}
    });

    for(const name of['pointerdown','wheel','touchstart'])document.addEventListener(name,ctx.registerActivity,{passive:true});
    id('quiet-button').addEventListener('click',()=>void ctx.toggleSetting('quietMode'));
    id('cue-cluster').addEventListener('click',()=>ctx.go('now'));
    id('clear-cues').addEventListener('click',ctx.clearAllCues);

    id('note-form').addEventListener('submit',ctx.saveNote);
    id('note-search').addEventListener('input',ctx.renderNotes);
    id('note-filter').addEventListener('change',ctx.renderNotes);
    id('note-input').addEventListener('input',event=>{id('note-count').textContent=`${event.target.value.length} / 6000`});
    id('note-cancel').addEventListener('click',()=>{ctx.resetNoteComposer();ctx.renderNotes();ctx.toast('Edit cancelled')});
    id('calendar-prev').addEventListener('click',()=>{ctx.calendarCursor=new Date(ctx.calendarCursor.getFullYear(),ctx.calendarCursor.getMonth()-1,1);ctx.renderCalendar()});
    id('calendar-next').addEventListener('click',()=>{ctx.calendarCursor=new Date(ctx.calendarCursor.getFullYear(),ctx.calendarCursor.getMonth()+1,1);ctx.renderCalendar()});
    id('calendar-today').addEventListener('click',()=>{if(ctx.inlineEditingNoteId)ctx.resetNoteComposer();ctx.selectedDate=ctx.todayKey();ctx.calendarCursor=new Date(`${ctx.selectedDate}T12:00:00`);ctx.renderNotes()});

    id('focus-toggle').addEventListener('click',()=>ctx.toggleSession('focus','focus','Focus block'));
    id('export-day').addEventListener('click',()=>{const key=ctx.todayKey();ctx.download(`pacefold-day-${key}.json`,'application/json',JSON.stringify({release:ctx.RELEASE,date:key,metrics:ctx.metricsForDay(ctx.log,key,ctx.prefs),notes:ctx.notesForDate(key)},null,2))});
    id('clear-open-sessions').addEventListener('click',()=>{for(const source of['focus','field','prep','away','meal'])ctx.closeSession(source,'Closed manually');ctx.storePrefs({noodleStart:0,awayStart:0,lunchStart:0},'close-sessions');ctx.render(ctx.mode);ctx.toast('Open sessions closed')});

    for(const input of $$('.settings-panels input,.settings-panels select'))input.addEventListener('change',ctx.settingsInput);
    for(const input of $$('[data-offset]'))input.addEventListener('change',()=>{ctx.storePrefs({offsets:{...ctx.prefs.offsets,[input.dataset.offset]:Number(input.value)||0}},'prayer-offset');ctx.render(ctx.mode)});
    id('use-location').addEventListener('click',ctx.useDeviceLocation);
    id('weather-refresh').addEventListener('click',()=>void ctx.fetchWeather(true));
    id('backup-download').addEventListener('click',ctx.downloadBackup);
    id('backup-restore').addEventListener('click',()=>id('restore-file-input').click());
    id('restore-file-input').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)void ctx.restoreBackupFile(file);event.target.value=''});
    id('backup-file').addEventListener('click',ctx.chooseLiveBackup);
    id('onenote-connect').addEventListener('click',ctx.connectOneNote);
    id('onenote-sync').addEventListener('click',()=>void ctx.syncOneNote(true));
    id('onenote-disconnect').addEventListener('click',ctx.disconnectOneNote);
    id('self-check').addEventListener('click',ctx.runSelfCheck);

    id('reset-today').addEventListener('click',async()=>{if(!await ctx.confirmAction('Reset today’s counters?','Water and active timers will reset. Notes and completed day-log entries stay.'))return;ctx.storePrefs({waterOz:0,waterSips:0,waterDate:ctx.todayKey(),noodleStart:0,awayStart:0,lunchStart:0},'reset-today');ctx.render(ctx.mode);ctx.toast('Today’s counters reset')});
    id('reset-app').addEventListener('click',async()=>{if(!await ctx.confirmAction('Delete local Pacefold data?','This removes settings, notes and the day log from this browser. Download a backup first if you may need them.'))return;for(const key of Object.values(ctx.KEYS))localStorage.removeItem(key);location.reload()});

    id('sound-toggle').addEventListener('click',()=>ctx.soundPlaying?ctx.stopSound():void ctx.startSound());
    id('sound-choice').addEventListener('change',event=>{ctx.storePrefs({soundChoice:event.target.value},'sound');if(ctx.soundPlaying)void ctx.startSound();else ctx.renderSound()});
    id('sound-volume').addEventListener('input',event=>{const value=ctx.clamp(event.target.value,0,1,.18);ctx.prefs.soundVolume=value;if(ctx.audioGain&&ctx.audioContext)ctx.audioGain.gain.setTargetAtTime(value,ctx.audioContext.currentTime,.05);id('audio-player').volume=value;localStorage.setItem(ctx.KEYS.prefs,JSON.stringify(ctx.prefs))});
    id('sound-file').addEventListener('click',()=>id('audio-file-input').click());
    id('audio-file-input').addEventListener('change',event=>{const file=event.target.files?.[0];if(!file)return;if(ctx.localAudioUrl)URL.revokeObjectURL(ctx.localAudioUrl);ctx.localAudioUrl=URL.createObjectURL(file);ctx.storePrefs({soundChoice:'local',soundLabel:file.name.replace(/\.[^.]+$/,'').slice(0,70)},'sound-file');void ctx.startSound();event.target.value=''});
    id('setup-later').addEventListener('click',()=>{ctx.storePrefs({rhythmDiscretion:ctx.prefs.rhythmDiscretion||'neutral'},'onboarding-complete');id('setup-dialog').close();ctx.render(ctx.mode);ctx.toast('Pacefold is ready')});

    window.addEventListener('storage',event=>{
      if(event.key===ctx.KEYS.prefs){ctx.prefs=ctx.migratePrefs(ctx.parseJson(event.newValue,{}));ctx.prefs.v=1;ctx.prefs.noteCategories=ctx.normalizeNoteCategories(ctx.prefs.noteCategories);ctx.prefs.rhythmDiscretion=['names','neutral','hidden'].includes(ctx.prefs.rhythmDiscretion)?ctx.prefs.rhythmDiscretion:'neutral'}
      if(event.key===ctx.KEYS.notes)ctx.notes=ctx.normalizeNotes(ctx.parseJson(event.newValue,[]));
      if(event.key===ctx.KEYS.log){ctx.log=ctx.normalizeLog(ctx.parseJson(event.newValue,{}));ctx.log.v=1;ctx.log.version=ctx.RELEASE}
      if(event.key===ctx.KEYS.cueState)ctx.cueState=ctx.parseJson(event.newValue,{v:1,ack:{},notified:{},snoozeUntil:0});
      ctx.render(ctx.mode);
    });

    const resume=async()=>{
      if(document.hidden)return;
      await ctx.pullCueState?.();ctx.minuteSeen=-1;ctx.render(ctx.mode);ctx.renderIdle();void ctx.syncOneNote(false);if(ctx.mode==='now')void ctx.fetchWeather(false);
    };
    window.addEventListener('focus',()=>void resume());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void resume()});
    window.addEventListener('beforeunload',()=>{if(ctx.localAudioUrl)URL.revokeObjectURL(ctx.localAudioUrl)});
    navigator.serviceWorker?.addEventListener('message',event=>{
      if(event.data?.type==='PACEFOLD_ACK'||event.data?.type==='PACEFOLD_SNOOZE')void(async()=>{await ctx.pullCueState?.();ctx.render(ctx.mode)})();
    });
  };

  ctx.initialize=async()=>{
    const hadExisting=Object.keys(ctx.rawPrefs||{}).length>5||localStorage.getItem(ctx.KEYS.onboarding)==='1';
    ctx.generateStatic();ctx.bind();ctx.bindRhythmReveal?.();ctx.resetDailyIfNeeded();
    await ctx.initCueStore?.();
    ctx.liveBackupHandle=await ctx.readHandle();ctx.renderBackupStatus();ctx.renderSound();
    const requested=new URLSearchParams(location.search).get('mode');
    if(['notes','worklog','now','settings'].includes(requested))ctx.mode=requested;
    document.documentElement.dataset.mode=ctx.mode;
    ctx.render(ctx.mode);
    await ctx.registerWorker();
    ctx.syncCueMirror?.();
    void ctx.registerPeriodicCueSync?.();
    if(ctx.mode==='now')void ctx.fetchWeather(false);

    setInterval(()=>{
      if(document.hidden)return;
      const now=new Date(),minute=now.getMinutes();
      ctx.renderClock(now);ctx.renderIdle();
      if(ctx.mode==='home')ctx.renderActions();
      if(ctx.mode==='now')ctx.renderActive();
      if(minute!==ctx.minuteSeen){
        ctx.minuteSeen=minute;ctx.refreshCues(true);
        if(ctx.mode==='home'){ctx.renderRhythm(now,{home:true,nowView:false});ctx.renderFold()}
        if(ctx.mode==='now'){ctx.renderRhythm(now,{home:false,nowView:true});void ctx.fetchWeather(false)}
        if(ctx.mode==='worklog')ctx.renderWorklog();
      }
    },1000);

    if(hadExisting){localStorage.setItem(ctx.KEYS.onboarding,'1');localStorage.setItem(ctx.KEYS.setupDismissed,'1')}
    else setTimeout(()=>id('setup-dialog').showModal(),420);
    requestAnimationFrame(()=>document.documentElement.classList.add('ready'));

    window.__PACEFOLD__={
      version:ctx.RELEASE,revision:ctx.REVISION,
      get prefs(){return ctx.prefs},get notes(){return ctx.notes},get log(){return ctx.log},get cues(){return ctx.currentCues},
      go:ctx.go,render:ctx.render,schedule:()=>ctx.getSchedule(new Date()),backup:ctx.currentBackup,selfCheck:ctx.runSelfCheck
    };
  };
}
