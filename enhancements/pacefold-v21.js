(() => {
  'use strict';

  const RELEASE='21.0.0';
  const PREFS_KEY='pacefoldPrefsV15';
  const SNAPSHOT_KEY='pacefold.v21.preferences.v1';
  const ENTRY_KEY='pacefold.notebook.entries.v2';
  const ONBOARDED_KEY='pacefoldOnboardedV15';
  const DISMISSED_KEY='pacefoldSetupDismissedV15';
  const DAY_MS=86400000;

  let mounted=false;
  let frame=0;
  let observer=null;
  let statusObserver=null;
  let notebookObserver=null;
  let calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
  let selectedCalendarDate='';
  let lastCalendarKey='';
  let settingsOpenAdvanced=false;
  let suppressingSetup=false;

  const byId=id=>document.getElementById(id);
  const compact=value=>String(value??'').replace(/\s+/g,' ').trim();
  const parse=(raw,fallback)=>{try{return raw==null||raw===''?fallback:JSON.parse(raw);}catch{return fallback;}};
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  const create=(tag,className,text)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!=null)node.textContent=String(text);
    return node;
  };
  const button=(className,label,text)=>{
    const node=create('button',className,text);
    node.type='button';
    if(label)node.setAttribute('aria-label',label);
    return node;
  };
  const localDate=(value=new Date())=>{
    const date=value instanceof Date?value:new Date(value);
    if(Number.isNaN(date.getTime()))return'';
    return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10);
  };

  function report(scope,error){
    try{window.__PACEFOLD_RESILIENCE__?.recordError?.(`v21-${scope}`,error);}catch{}
  }

  function guarded(scope,callback){
    return function(...args){
      try{
        const result=callback.apply(this,args);
        if(result?.catch)result.catch(error=>report(scope,error));
        return result;
      }catch(error){report(scope,error);return undefined;}
    };
  }

  function readPrefs(){
    return window.__PACEFOLD_MA_CORE__?.getPrefs?.()||object(parse(localStorage.getItem(PREFS_KEY),{}))||{};
  }

  function filteredPrefs(value){
    const result={};
    for(const [key,item] of Object.entries(object(value)||{})){
      if(/(?:auth|token|secret|password|oneNoteClient|oneNoteTenant|oneNoteNotebook|oneNoteSection|oneNotePages|oneNoteLast)/i.test(key))continue;
      result[key]=item;
    }
    return result;
  }

  function meaningfulPrefs(value){
    const prefs=object(value);
    if(!prefs)return false;
    return Object.keys(prefs).length>=4&&Boolean(
      prefs.profile||prefs.schemaVersion||prefs.workHours||prefs.workWeek||
      prefs.locationLabel||prefs.theme||prefs.sipCadence||prefs.waterTarget
    );
  }

  function snapshotPrefs(){
    const prefs=readPrefs();
    if(!meaningfulPrefs(prefs))return false;
    try{
      localStorage.setItem(ONBOARDED_KEY,'1');
      localStorage.setItem(DISMISSED_KEY,'1');
      localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({version:RELEASE,savedAt:new Date().toISOString(),prefs:filteredPrefs(prefs)}));
      return true;
    }catch(error){report('snapshot',error);return false;}
  }

  function updatePrefs(patch){
    if(!object(patch))return readPrefs();
    let next;
    const core=window.__PACEFOLD_MA_CORE__;
    if(core?.updatePrefs)next=core.updatePrefs(patch)||readPrefs();
    else{
      next={...readPrefs(),...patch};
      localStorage.setItem(PREFS_KEY,JSON.stringify(next));
    }
    snapshotPrefs();
    window.dispatchEvent(new CustomEvent('pacefold:ma-prefs',{detail:{source:'v21-settings'}}));
    return next;
  }

  function setupNodes(){
    return [...document.querySelectorAll('#onboarding,.onboarding,[data-onboard-profile],.onboarding-option')]
      .filter(node=>node instanceof HTMLElement&&node.isConnected);
  }

  function suppressDuplicateSetup(){
    if(suppressingSetup||!meaningfulPrefs(readPrefs()))return false;
    suppressingSetup=true;
    let changed=false;
    try{
      localStorage.setItem(ONBOARDED_KEY,'1');
      localStorage.setItem(DISMISSED_KEY,'1');
      for(const node of setupNodes()){
        const setupRoot=node.matches('#onboarding,.onboarding')?node:node.closest('#onboarding,.onboarding');
        if(!setupRoot)continue;
        setupRoot.hidden=true;
        setupRoot.setAttribute('aria-hidden','true');
        setupRoot.inert=true;
        changed=true;
      }
      document.documentElement.classList.add('pf21-returning');
    }catch(error){report('setup-suppress',error);}
    suppressingSetup=false;
    return changed;
  }

  function privacyOn(){
    const prefs=readPrefs();
    return Boolean(prefs.privacy||prefs.quietMode);
  }

  function statusParts(){
    const word=compact(byId('statusWord')?.textContent);
    const eventTime=compact(byId('eventTime')?.textContent);
    const relative=compact(byId('relativeTime')?.textContent);
    const name=compact(byId('eventName')?.textContent);
    return{word,eventTime,relative,name};
  }

  function meaningfulStatus(parts){
    const combined=compact(`${parts.word} ${parts.eventTime} ${parts.relative} ${parts.name}`);
    return combined&&!/^(?:next\s*)?$/i.test(combined)&&!/no action waiting/i.test(combined);
  }

  function dayline(){
    let root=byId('pf21-dayline');
    if(root)return root;
    const sequence=byId('sequence');
    const statusArea=document.querySelector('.status-area');
    if(!sequence||!statusArea)return null;

    root=create('section','pf21-dayline');
    root.id='pf21-dayline';
    root.setAttribute('aria-label','Next workday moment');
    const copy=create('div','pf21-dayline-copy');
    copy.append(
      create('span','pf21-dayline-kicker','Next'),
      create('strong','pf21-dayline-title','No scheduled pause'),
      create('small','pf21-dayline-detail','Your workday is clear')
    );
    const actions=create('div','pf21-dayline-actions');
    root.append(copy,actions);
    statusArea.insertBefore(root,sequence);
    return root;
  }

  function syncDayline(){
    const root=dayline();
    if(!root)return false;
    const parts=statusParts();
    const privateMode=privacyOn();
    const hasStatus=meaningfulStatus(parts);
    const title=root.querySelector('.pf21-dayline-title');
    const detail=root.querySelector('.pf21-dayline-detail');
    const kicker=root.querySelector('.pf21-dayline-kicker');
    const actions=root.querySelector('.pf21-dayline-actions');
    const dayType=byId('pf-day-type');
    if(dayType&&dayType.parentElement!==actions)actions.append(dayType);

    let nextTitle='No scheduled pause';
    let nextDetail='Your workday is clear';
    let nextKicker='Next';
    if(hasStatus){
      const fallbackIdentity=/^(?:next|scheduled moment)$/i.test(parts.word)?'Scheduled pause':parts.word||'Scheduled pause';
      const identity=privateMode?'Scheduled pause':parts.name||fallbackIdentity;
      const timing=compact([parts.eventTime,parts.relative].filter(Boolean).join(' · '));
      nextTitle=identity;
      nextDetail=timing||(!privateMode&&parts.word!==identity?parts.word:'Coming up in your workday');
      nextKicker=/due|ready|now/i.test(parts.word)?'Now':'Next';
    }
    if(title&&title.textContent!==nextTitle)title.textContent=nextTitle;
    if(detail&&detail.textContent!==nextDetail)detail.textContent=nextDetail;
    if(kicker&&kicker.textContent!==nextKicker)kicker.textContent=nextKicker;
    root.dataset.empty=String(!hasStatus);
    root.dataset.private=String(privateMode);
    return true;
  }

  function workHours(){
    const prefs=readPrefs();
    const today=new Date().getDay();
    const row=object(prefs.workWeek)?.[today]||object(prefs.workWeek)?.[String(today)];
    const fallback=String(prefs.workHours||'08:30-16:30').match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    const start=/^\d{2}:\d{2}$/.test(String(row?.start||''))?String(row.start):fallback?.[1]||'08:30';
    const end=/^\d{2}:\d{2}$/.test(String(row?.end||''))?String(row.end):fallback?.[2]||'16:30';
    return{start,end};
  }

  function ribbonMeta(){
    let meta=byId('pf21-ribbon-meta');
    const sequence=byId('sequence');
    if(!sequence)return null;
    if(!meta){
      meta=create('div','pf21-ribbon-meta');
      meta.id='pf21-ribbon-meta';
      const start=create('span','pf21-ribbon-start');
      const legend=create('span','pf21-ribbon-legend');
      legend.append(create('i','pf21-ribbon-key-now'),create('span','','Now'),create('i','pf21-ribbon-key-moment'),create('span','','Scheduled'));
      const end=create('span','pf21-ribbon-end');
      meta.append(start,legend,end);
      sequence.insertAdjacentElement('afterend',meta);
    }
    return meta;
  }

  function syncRibbonMeta(){
    const meta=ribbonMeta();
    if(!meta)return false;
    const hours=workHours();
    const format=value=>{
      const [h,m]=value.split(':').map(Number);
      return new Date(2000,0,1,h,m).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    };
    const start=meta.querySelector('.pf21-ribbon-start');
    const end=meta.querySelector('.pf21-ribbon-end');
    if(start)start.textContent=format(hours.start);
    if(end)end.textContent=format(hours.end);
    return true;
  }

  function rawEntries(){
    const value=parse(localStorage.getItem(ENTRY_KEY),[]);
    return Array.isArray(value)?value:[];
  }

  function noteDate(entry){
    const candidates=[
      entry?.date,entry?.day,entry?.createdDate,entry?.createdAt,entry?.updatedAt,
      entry?.timestamp,entry?.at,entry?.time
    ];
    for(const value of candidates){
      if(value==null||value==='')continue;
      if(typeof value==='string'){
        const direct=value.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
        if(direct)return direct[1];
      }
      const date=typeof value==='number'&&value<1e12?new Date(value*1000):new Date(value);
      const normalized=localDate(date);
      if(normalized)return normalized;
    }
    const id=String(entry?.id||'');
    return id.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1]||'';
  }

  function countsByDate(entries=rawEntries()){
    const counts=new Map();
    for(const entry of entries){
      const date=noteDate(entry);
      if(date)counts.set(date,(counts.get(date)||0)+1);
    }
    return counts;
  }

  function selectedNotebookDate(){
    const heading=compact(document.querySelector('.pf-notebook-head strong')?.textContent);
    const parsed=new Date(heading);
    return Number.isNaN(parsed.getTime())?selectedCalendarDate:localDate(parsed);
  }

  function calendar(){
    let root=byId('pf21-note-calendar');
    const sheet=document.querySelector('#pf-local-workspace .pf-notebook-sheet');
    const head=sheet?.querySelector('.pf-notebook-head');
    if(!sheet||!head)return null;
    if(root&&root.parentElement===sheet)return root;
    root=create('section','pf21-note-calendar');
    root.id='pf21-note-calendar';
    root.setAttribute('aria-label','Notebook activity calendar');

    const summary=create('div','pf21-calendar-summary');
    const kicker=create('span','pf21-calendar-kicker','Notebook activity');
    const title=create('strong','pf21-calendar-month');
    const stats=create('small','pf21-calendar-stats','No notes yet');
    const controls=create('div','pf21-calendar-controls');
    controls.append(
      button('pf21-calendar-prev','Previous month','‹'),
      button('pf21-calendar-today','Show this month','Today'),
      button('pf21-calendar-next','Next month','›')
    );
    summary.append(kicker,title,stats,controls);

    const body=create('div','pf21-calendar-body');
    const weekdays=create('div','pf21-calendar-weekdays');
    for(const label of ['S','M','T','W','T','F','S'])weekdays.append(create('span','',label));
    const grid=create('div','pf21-calendar-grid');
    body.append(weekdays,grid);
    root.append(summary,body);
    head.insertAdjacentElement('afterend',root);

    root.querySelector('.pf21-calendar-prev').addEventListener('click',guarded('calendar-prev',()=>{
      calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);
      renderCalendar(true);
    }));
    root.querySelector('.pf21-calendar-next').addEventListener('click',guarded('calendar-next',()=>{
      calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);
      renderCalendar(true);
    }));
    root.querySelector('.pf21-calendar-today').addEventListener('click',guarded('calendar-today',()=>{
      const today=new Date();
      calendarMonth=new Date(today.getFullYear(),today.getMonth(),1);
      selectedCalendarDate=localDate(today);
      navigateNotebookDate(selectedCalendarDate);
      renderCalendar(true);
    }));
    return root;
  }

  function navigateNotebookDate(target){
    const targetDate=new Date(`${target}T12:00:00`);
    if(Number.isNaN(targetDate.getTime()))return false;
    let current=selectedNotebookDate();
    let currentDate=new Date(`${current}T12:00:00`);
    if(Number.isNaN(currentDate.getTime()))currentDate=new Date();
    const delta=Math.round((targetDate-currentDate)/DAY_MS);
    const actions=document.querySelector('#pf-local-workspace .pf-notebook-head-actions');
    const buttons=[...(actions?.querySelectorAll('button')||[])];
    const todayButton=buttons.find(node=>/^today$/i.test(compact(node.textContent))||/today/i.test(node.getAttribute('aria-label')||''));
    const previous=buttons.find(node=>/previous|earlier|back/i.test(node.getAttribute('aria-label')||'')||compact(node.textContent)==='‹'||compact(node.textContent)==='←');
    const next=buttons.find(node=>/next|later|forward/i.test(node.getAttribute('aria-label')||'')||compact(node.textContent)==='›'||compact(node.textContent)==='→');
    if(delta===0){selectedCalendarDate=target;return true;}
    if(Math.abs(delta)>45&&todayButton){todayButton.click();current=localDate();currentDate=new Date(`${current}T12:00:00`);}
    const remaining=Math.round((targetDate-currentDate)/DAY_MS);
    const control=remaining<0?previous:next;
    if(!control)return false;
    const steps=Math.min(62,Math.abs(remaining));
    for(let index=0;index<steps;index+=1)control.click();
    selectedCalendarDate=target;
    setTimeout(()=>renderCalendar(true),80);
    return true;
  }

  function renderCalendar(force=false){
    const root=calendar();
    if(!root)return false;
    const entries=rawEntries();
    const counts=countsByDate(entries);
    const selected=selectedNotebookDate()||selectedCalendarDate;
    selectedCalendarDate=selected;
    const monthKey=`${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}-${selected}-${entries.length}-${[...counts.values()].reduce((sum,value)=>sum+value,0)}`;
    if(!force&&monthKey===lastCalendarKey)return true;
    lastCalendarKey=monthKey;

    root.querySelector('.pf21-calendar-month').textContent=calendarMonth.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    const daysWithNotes=counts.size;
    root.querySelector('.pf21-calendar-stats').textContent=entries.length
      ?`${daysWithNotes} note ${daysWithNotes===1?'day':'days'} · ${entries.length} ${entries.length===1?'note':'notes'}`
      :'No notes yet';

    const grid=root.querySelector('.pf21-calendar-grid');
    const fragment=document.createDocumentFragment();
    const first=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);
    const start=new Date(first.getFullYear(),first.getMonth(),1-first.getDay());
    const today=localDate();
    for(let index=0;index<42;index+=1){
      const date=new Date(start.getFullYear(),start.getMonth(),start.getDate()+index);
      const key=localDate(date);
      const count=counts.get(key)||0;
      const cell=button('pf21-calendar-day',`${date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}${count?`. ${count} ${count===1?'note':'notes'}.`:'. No notes.'}`);
      cell.dataset.date=key;
      cell.dataset.month=String(date.getMonth()===calendarMonth.getMonth());
      cell.dataset.today=String(key===today);
      cell.dataset.selected=String(key===selected);
      cell.dataset.hasNotes=String(count>0);
      cell.append(create('span','pf21-calendar-number',date.getDate()));
      if(count)cell.append(create('small','pf21-calendar-count',count>9?'9+':count));
      cell.addEventListener('click',guarded('calendar-select',()=>{
        selectedCalendarDate=key;
        if(date.getMonth()!==calendarMonth.getMonth())calendarMonth=new Date(date.getFullYear(),date.getMonth(),1);
        navigateNotebookDate(key);
        renderCalendar(true);
      }));
      fragment.append(cell);
    }
    grid.replaceChildren(fragment);
    return true;
  }

  function switchControl(label,description,key,{invert=false}={}){
    const row=create('label','pf21-setting-switch');
    const copy=create('span','pf21-setting-copy');
    copy.append(create('strong','',label),create('small','',description));
    const input=create('input');
    input.type='checkbox';
    input.dataset.pf21Pref=key;
    if(invert)input.dataset.invert='true';
    const visual=create('span','pf21-switch-visual');
    visual.setAttribute('aria-hidden','true');
    row.append(copy,input,visual);
    input.addEventListener('change',guarded('setting-switch',()=>{
      const value=input.dataset.invert==='true'?!input.checked:input.checked;
      if(key==='quietMode'){
        const current=Boolean(readPrefs().quietMode);
        if(current!==value&&byId('pf-quiet-toggle'))byId('pf-quiet-toggle').click();
        else updatePrefs({quietMode:value});
      }else if(key==='notifications'){
        updatePrefs({notifications:value,notificationMode:value?'quiet':'off',taskbarBadge:value});
      }else updatePrefs({[key]:value});
      syncSettings();
      applyPreferenceSurface();
    }));
    return row;
  }

  function settingsPanel(){
    let root=byId('pf21-settings');
    const panel=byId('panel');
    if(!panel)return null;
    if(root&&root.parentElement===panel)return root;
    root=create('section','pf21-settings');
    root.id='pf21-settings';
    root.setAttribute('aria-label','Pacefold essential settings');

    const header=create('header','pf21-settings-head');
    const copy=create('div');
    copy.append(create('span','pf21-settings-kicker','Essentials'),create('h2','','Your Pacefold'),create('p','','Changes save automatically and survive updates.'));
    const status=create('span','pf21-settings-saved','Saved automatically');
    header.append(copy,status);

    const toggles=create('div','pf21-settings-grid');
    toggles.append(
      switchControl('Quiet mode','Hide details and pause visible alerts','quietMode'),
      switchControl('Notifications','Allow Pacefold cues','notifications'),
      switchControl('Water','Hydration reminders during work','workReminders'),
      switchControl('Eyes','Short distance-vision resets','gazeEnabled'),
      switchControl('Movement','Ergonomic movement reminders','bodyEnabled'),
      switchControl('Weather','Show the saved-location forecast','v21WeatherEnabled')
    );

    const schedule=create('section','pf21-settings-schedule');
    schedule.append(create('div','pf21-settings-section-title','Workday'));
    const startLabel=create('label','pf21-time-field');
    startLabel.append(create('span','','Start'));
    const start=create('input');start.type='time';start.dataset.pf21Time='start';startLabel.append(start);
    const endLabel=create('label','pf21-time-field');
    endLabel.append(create('span','','End'));
    const end=create('input');end.type='time';end.dataset.pf21Time='end';endLabel.append(end);
    const editWeek=button('pf21-edit-week','Edit each weekday','Edit week');
    editWeek.addEventListener('click',guarded('edit-week',()=>{
      const existing=panel.querySelector('[data-pf-edit-week]');
      if(existing)existing.click();
      else settingsOpenAdvanced=true;
      panel.dataset.pf21Advanced='true';
      syncSettings();
    }));
    schedule.append(startLabel,endLabel,editWeek);

    const saveHours=guarded('save-hours',()=>{
      const startValue=start.value;
      const endValue=end.value;
      if(!/^\d{2}:\d{2}$/.test(startValue)||!/^\d{2}:\d{2}$/.test(endValue)||startValue>=endValue)return;
      const prefs=readPrefs();
      const current=object(prefs.workWeek)||{};
      const next={};
      for(let day=0;day<7;day+=1){
        const row=object(current[day]||current[String(day)])||{};
        next[day]={...row,start:startValue,end:endValue,type:row.type||(!prefs.workdaysOnly||day>=1&&day<=5?'desk':'off')};
      }
      updatePrefs({workHours:`${startValue}-${endValue}`,workWeek:next});
      syncRibbonMeta();
      syncSettings();
    });
    start.addEventListener('change',saveHours);
    end.addEventListener('change',saveHours);

    const footer=create('footer','pf21-settings-footer');
    const advanced=button('pf21-more-settings','Show all settings','More settings');
    advanced.addEventListener('click',guarded('settings-advanced',()=>{
      settingsOpenAdvanced=!settingsOpenAdvanced;
      panel.dataset.pf21Advanced=String(settingsOpenAdvanced);
      advanced.textContent=settingsOpenAdvanced?'Fewer settings':'More settings';
      advanced.setAttribute('aria-expanded',String(settingsOpenAdvanced));
    }));
    const version=create('span','pf21-settings-version',`Pacefold ${RELEASE}`);
    footer.append(advanced,version);
    root.append(header,toggles,schedule,footer);

    const first=panel.firstElementChild;
    if(first)first.insertAdjacentElement('afterend',root);
    else panel.append(root);
    panel.dataset.pf21Advanced=String(settingsOpenAdvanced);
    return root;
  }

  function syncSettings(){
    const root=settingsPanel();
    if(!root)return false;
    const prefs=readPrefs();
    const values={
      quietMode:Boolean(prefs.quietMode),
      notifications:prefs.notifications!==false&&prefs.notificationMode!=='off',
      workReminders:prefs.workReminders!==false,
      gazeEnabled:prefs.gazeEnabled!==false,
      bodyEnabled:prefs.bodyEnabled!==false,
      v21WeatherEnabled:prefs.v21WeatherEnabled!==false
    };
    for(const input of root.querySelectorAll('[data-pf21-pref]')){
      const raw=Boolean(values[input.dataset.pf21Pref]);
      const checked=input.dataset.invert==='true'?!raw:raw;
      if(input.checked!==checked)input.checked=checked;
    }
    const hours=workHours();
    const start=root.querySelector('[data-pf21-time="start"]');
    const end=root.querySelector('[data-pf21-time="end"]');
    if(start&&start.value!==hours.start)start.value=hours.start;
    if(end&&end.value!==hours.end)end.value=hours.end;
    const advanced=root.querySelector('.pf21-more-settings');
    if(advanced){
      advanced.textContent=settingsOpenAdvanced?'Fewer settings':'More settings';
      advanced.setAttribute('aria-expanded',String(settingsOpenAdvanced));
    }
    return true;
  }

  function applyPreferenceSurface(){
    const prefs=readPrefs();
    document.documentElement.dataset.pf21Weather=String(prefs.v21WeatherEnabled!==false);
    document.documentElement.dataset.pf21Quiet=String(Boolean(prefs.quietMode));
    return true;
  }

  function observeStatus(){
    const status=byId('statusLine');
    if(!status)return;
    statusObserver?.disconnect();
    statusObserver=new MutationObserver(()=>queue());
    statusObserver.observe(status,{childList:true,subtree:true,characterData:true});
  }

  function observeNotebook(){
    const workspace=byId('pf-local-workspace');
    if(!workspace)return;
    notebookObserver?.disconnect();
    notebookObserver=new MutationObserver(mutations=>{
      if(mutations.every(item=>item.target instanceof Element&&item.target.closest?.('#pf21-note-calendar')))return;
      selectedCalendarDate=selectedNotebookDate()||selectedCalendarDate;
      renderCalendar(true);
    });
    notebookObserver.observe(workspace,{childList:true,subtree:true,characterData:true});
  }

  function reconcile(){
    suppressDuplicateSetup();
    document.documentElement.classList.add('pf-v21-active');
    document.documentElement.dataset.pacefoldExperience=RELEASE;
    document.body.dataset.pacefoldExperience=RELEASE;
    dayline();
    ribbonMeta();
    calendar();
    settingsPanel();
    syncDayline();
    syncRibbonMeta();
    renderCalendar();
    syncSettings();
    applyPreferenceSurface();
    snapshotPrefs();
    if(!statusObserver)observeStatus();
    if(!notebookObserver)observeNotebook();
    return true;
  }

  function queue(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      try{reconcile();}catch(error){report('reconcile',error);}
    });
  }

  function observe(){
    observer?.disconnect();
    observer=new MutationObserver(mutations=>{
      if(mutations.every(item=>item.target instanceof Element&&item.target.closest?.('#pf21-dayline,#pf21-note-calendar,#pf21-settings,#pf21-ribbon-meta')))return;
      queue();
    });
    observer.observe(document.documentElement,{
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','hidden','aria-hidden','data-page','data-quiet','data-signal','data-source']
    });
  }

  function initialize(){
    if(mounted)return;
    mounted=true;
    if(!selectedCalendarDate)selectedCalendarDate=localDate();
    document.documentElement.classList.add('pf-v21-active');
    observe();
    window.addEventListener('pacefold:ma-prefs',guarded('prefs-event',()=>{
      snapshotPrefs();
      lastCalendarKey='';
      queue();
    }));
    window.addEventListener('pacefold:storage-changed',guarded('storage-event',()=>{
      lastCalendarKey='';
      renderCalendar(true);
      snapshotPrefs();
    }));
    window.addEventListener('storage',guarded('cross-window',event=>{
      if([PREFS_KEY,ENTRY_KEY,SNAPSHOT_KEY].includes(event.key)){
        lastCalendarKey='';
        queue();
      }
    }));
    document.addEventListener('visibilitychange',guarded('visibility',()=>{
      if(document.hidden)snapshotPrefs();
      else queue();
    }));
    window.addEventListener('pagehide',guarded('pagehide',snapshotPrefs));
    [0,60,180,500,1200,2500].forEach(delay=>setTimeout(queue,delay));
  }

  window.__PACEFOLD_V21__={
    release:RELEASE,
    reconcile:queue,
    renderCalendar:()=>renderCalendar(true),
    snapshot:snapshotPrefs,
    settings:()=>({advanced:settingsOpenAdvanced,prefs:filteredPrefs(readPrefs())}),
    noteCounts:()=>Object.fromEntries(countsByDate())
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
