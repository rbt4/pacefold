import{$,$$,id,el,button}from'./state.js';

const EXPERIENCE='v28-guided-fold-r1';
const DISPLAY_RELEASE='28.0.0';
const HOVER_DWELL=640;
const ACTIONABLE=new Set(['water','prep','away','meal','eyes','move']);
const OPEN_SOURCES=['focus','field','prep','away','meal'];

export function installGuidedFoldV28(ctx){
  document.documentElement.dataset.guidedFold='v28';
  ctx.guidedFoldVersion=EXPERIENCE;

  let initialized=false,settingsFolded=false,hoverTimer=0,hoverTarget=null,hoverCooldownUntil=0,bloomTimer=0,peekTimer=0;
  let knownCueKeys=new Set((ctx.currentCues||[]).map(cue=>cue.key));

  const cueColor=cue=>ctx.CUE_COLORS?.[cue?.source]||ctx.CUE_COLORS?.focus||'#426b5b';
  const finePointer=()=>window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

  const moveIntoDetails=(details,nodes)=>{
    const body=details.querySelector('.v28-settings-body');
    for(const node of nodes.filter(Boolean))body.append(node);
  };

  const simplifySettings=()=>{
    if(settingsFolded)return;
    const nav=id('settings-nav'),essentials=$('[data-settings-panel="essentials"]'),rhythm=$('[data-settings-panel="rhythm"]'),data=$('[data-settings-panel="data"]'),care=$('[data-settings-panel="care"]'),advanced=$('[data-settings-panel="advanced"]');
    if(!nav||!essentials||!rhythm||!data||!care||!advanced)return;

    const rename=(tab,title,detail)=>{
      const control=nav.querySelector(`[data-settings-tab="${tab}"]`);if(!control)return;
      const strong=control.querySelector('strong'),small=control.querySelector('small');if(strong)strong.textContent=title;if(small)small.textContent=detail;
    };
    rename('essentials','Daily','Workday & cues');
    rename('rhythm','Rhythm','Moments & privacy');
    rename('data','Data','Backup & recovery');
    nav.querySelector('[data-settings-tab="care"]')?.remove();
    nav.querySelector('[data-settings-tab="advanced"]')?.remove();

    const disclosure=(title,detail,className)=>{
      const node=el('details',`v28-settings-disclosure ${className}`);
      const summary=el('summary'),copy=el('span');copy.append(el('strong','',title),el('small','',detail));summary.append(copy,el('i','','＋'));
      node.append(summary,el('div','v28-settings-body'));return node;
    };

    const careDetails=disclosure('Care defaults','Hydration, eyes, movement and timer lengths','v28-care-details');
    moveIntoDetails(careDetails,[...care.children].filter(node=>node.tagName!=='HEADER'));
    essentials.append(careDetails);
    care.hidden=true;care.dataset.v28Merged='true';

    const recovery=disclosure('Recovery & diagnostics','Self-check, today reset and full local reset','v28-recovery-details');
    moveIntoDetails(recovery,[...advanced.children].filter(node=>node.tagName!=='HEADER'));
    data.append(recovery);
    advanced.hidden=true;advanced.dataset.v28Merged='true';

    const rhythmAdvanced=disclosure('Calculation & location details','Time zone, coordinates, calculation method and minute adjustments','v28-rhythm-details');
    moveIntoDetails(rhythmAdvanced,[
      id('timezone-input')?.closest('label'),
      id('location-input')?.closest('label'),
      id('latitude-input')?.closest('label'),
      $('.muslim-settings',rhythm),
      id('offset-grid')?.closest('details')
    ]);
    rhythm.append(rhythmAdvanced);

    const head=$('.view-settings .view-head span');
    if(head){
      const kicker=head.querySelector('small'),title=head.querySelector('h1'),copy=head.querySelector('p');
      if(kicker)kicker.textContent='Down from Clock';
      if(title)title.textContent='Settings';
      if(copy)copy.textContent='Set it once. The clock handles the rest.';
      const version=$('.view-settings .view-head>b');if(version)version.textContent=`Pacefold ${DISPLAY_RELEASE}`;
    }
    settingsFolded=true;
  };

  const postProcessSettings=()=>{
    simplifySettings();
    if(ctx.settingsTab==='care')ctx.settingsTab='essentials';
    if(ctx.settingsTab==='advanced')ctx.settingsTab='data';
    const nav=id('settings-nav');
    for(const control of nav?.querySelectorAll('[data-settings-tab]')||[])control.classList.toggle('active',control.dataset.settingsTab===ctx.settingsTab);
    for(const panel of $$('.settings-panels>[data-settings-panel]')){
      if(panel.dataset.v28Merged==='true'){panel.hidden=true;continue}
      panel.hidden=panel.dataset.settingsPanel!==ctx.settingsTab;
    }
    for(const chip of id('settings-summary')?.querySelectorAll('.settings-chip')||[]){
      chip.hidden=chip.querySelector('small')?.textContent==='Profile';
    }
  };

  const baseRenderSettings=ctx.renderSettings;
  ctx.renderSettings=()=>{
    if(ctx.settingsTab==='care')ctx.settingsTab='essentials';
    if(ctx.settingsTab==='advanced')ctx.settingsTab='data';
    simplifySettings();
    baseRenderSettings?.();
    postProcessSettings();
  };

  const guide=el('section','v28-guide');guide.id='v28-guide';guide.setAttribute('aria-live','polite');
  const guideSignal=el('i','v28-guide-signal'),guideCopy=el('span','v28-guide-copy'),guideKicker=el('small','','RIGHT NOW'),guideTitle=el('strong','','All clear'),guideDetail=el('p','','The clock will surface the next thing that matters.');
  guideCopy.append(guideKicker,guideTitle,guideDetail);
  const guideActions=el('div','v28-guide-actions');guide.append(guideSignal,guideCopy,guideActions);
  $('.view-home .home-grid')?.after(guide);

  const cuePeek=el('section','v28-cue-peek');cuePeek.id='v28-cue-peek';cuePeek.hidden=true;cuePeek.setAttribute('aria-live','polite');document.body.append(cuePeek);
  const bloom=el('section','v28-cue-bloom');bloom.id='v28-cue-bloom';bloom.hidden=true;bloom.setAttribute('role','status');document.body.append(bloom);

  const closePeek=()=>{clearTimeout(peekTimer);peekTimer=setTimeout(()=>{cuePeek.hidden=true},160)};
  const openPeek=()=>{clearTimeout(peekTimer);renderCuePeek();cuePeek.hidden=false};

  const cluster=id('cue-cluster');
  cluster?.addEventListener('pointerenter',()=>{if(finePointer())openPeek()});
  cluster?.addEventListener('pointerleave',closePeek);
  cluster?.addEventListener('focus',openPeek);
  cluster?.addEventListener('blur',closePeek);
  cuePeek.addEventListener('pointerenter',()=>clearTimeout(peekTimer));
  cuePeek.addEventListener('pointerleave',closePeek);

  function renderCuePeek(){
    cuePeek.replaceChildren();
    const head=el('header'),headCopy=el('span');headCopy.append(el('small','','WAITING'),el('strong','',ctx.currentCues?.length?`${ctx.currentCues.length} quiet cue${ctx.currentCues.length===1?'':'s'}`:'All clear'));
    const snooze=button('v28-peek-snooze','Snooze all waiting cues','Snooze 10m');snooze.disabled=!ctx.currentCues?.length;snooze.addEventListener('click',()=>{ctx.snoozeCues?.(10);cuePeek.hidden=true});
    head.append(headCopy,snooze);cuePeek.append(head);
    if(!ctx.currentCues?.length){
      const next=ctx.getSchedule?.(new Date())?.next;
      const empty=el('p','v28-peek-empty',next?`Next · ${ctx.clockMomentLabel?.(next)||next.label} · ${ctx.relativeUntil?.(next.date,new Date())||''}`:'Nothing needs you right now.');
      cuePeek.append(empty);return;
    }
    const list=el('div','v28-peek-list');
    for(const cue of ctx.currentCues.slice(0,4)){
      const copy=ctx.clockCueCopy?.(cue)||cue,row=el('article','v28-peek-row');row.style.setProperty('--cue',cueColor(cue));
      const text=el('span');text.append(el('strong','',copy.label),el('small','',copy.detail));
      const clear=button('','Clear cue','Clear');clear.addEventListener('click',()=>{ctx.acknowledgeCue?.(cue);renderCuePeek()});
      row.append(el('i'),text,clear);list.append(row);
    }
    cuePeek.append(list);
    if(ctx.currentCues.length>4){const more=button('v28-peek-more','Open all cues',`+${ctx.currentCues.length-4} more`);more.addEventListener('click',()=>{cuePeek.hidden=true;ctx.go?.('now')});cuePeek.append(more)}
  }

  const performCue=cue=>{
    if(!cue)return;
    if(cue.source==='prayer'){ctx.go?.('now');return}
    if(ACTIONABLE.has(cue.source)){
      ctx.performAction?.(cue.source);
      ctx.acknowledgeCue?.(cue);
      return;
    }
    ctx.acknowledgeCue?.(cue);
  };

  const activeSession=()=>{
    for(const source of OPEN_SOURCES){
      const open=ctx.findOpen?.(source);
      if(open)return{source,open};
    }
    return null;
  };

  function renderGuide(){
    if(!guide.isConnected)return;
    guideActions.replaceChildren();
    const cue=ctx.currentCues?.[0];
    guide.classList.toggle('has-cue',Boolean(cue));
    guide.style.setProperty('--guide',cue?cueColor(cue):'#426b5b');
    for(const control of $$('.quick-action'))control.classList.remove('is-suggested');
    if(cue){
      const copy=ctx.clockCueCopy?.(cue)||cue;
      guideKicker.textContent='NEEDS YOU';
      guideTitle.textContent=copy.label;
      guideDetail.textContent=copy.detail;
      $('.quick-action[data-action="'+cue.source+'"]')?.classList.add('is-suggested');
      const primaryLabel=cue.source==='prayer'?'Open Now':cue.source==='water'?'Log water':['eyes','move'].includes(cue.source)?'Done':'Clear';
      const primary=button('v28-guide-primary',primaryLabel,primaryLabel);primary.addEventListener('click',()=>performCue(cue));
      const later=button('v28-guide-secondary','Snooze all cues for 10 minutes','Later');later.addEventListener('click',()=>ctx.snoozeCues?.(10));
      guideActions.append(primary,later);return;
    }
    const active=activeSession();
    if(active){
      guideKicker.textContent='IN PROGRESS';
      guideTitle.textContent=active.open.label||'Session running';
      guideDetail.textContent=`${ctx.durationText?.(Date.now()-active.open.start)||'Active'} · Pacefold is keeping the time.`;
      const openDay=button('v28-guide-primary','Open Day log','View Day');openDay.addEventListener('click',()=>ctx.go?.('worklog'));
      guideActions.append(openDay);return;
    }
    const next=ctx.getSchedule?.(new Date())?.next;
    guideKicker.textContent=next?'UP NEXT':'ALL CLEAR';
    guideTitle.textContent=next?(ctx.clockMomentLabel?.(next)||next.label):'Nothing needs you';
    guideDetail.textContent=next?`${ctx.relativeUntil?.(next.date,new Date())||''} · Keep doing what you are doing.`:'Pacefold will surface the next useful cue here.';
    const now=button('v28-guide-secondary','Open Now view',next?'See Now':'View today');now.addEventListener('click',()=>ctx.go?.('now'));guideActions.append(now);
  }

  const showBloom=cue=>{
    if(!initialized||!cue)return;
    clearTimeout(bloomTimer);bloom.replaceChildren();bloom.hidden=false;bloom.style.setProperty('--cue',cueColor(cue));
    const copy=ctx.clockCueCopy?.(cue)||cue,text=el('span');text.append(el('small','','QUIET CUE'),el('strong','',copy.label),el('p','',copy.detail));
    const actions=el('div'),done=button('','Clear cue','Clear'),later=button('','Snooze cues','Later');
    done.addEventListener('click',()=>{performCue(cue);bloom.hidden=true});later.addEventListener('click',()=>{ctx.snoozeCues?.(10);bloom.hidden=true});
    actions.append(done,later);bloom.append(el('i'),text,actions);requestAnimationFrame(()=>bloom.classList.add('is-on'));
    bloomTimer=setTimeout(()=>{bloom.classList.remove('is-on');setTimeout(()=>{bloom.hidden=true},220)},6500);
  };

  const baseRefreshCues=ctx.refreshCues;
  ctx.refreshCues=(notify=false)=>{
    const result=baseRefreshCues?.(notify);
    const cues=ctx.currentCues||[],fresh=initialized?cues.find(cue=>!knownCueKeys.has(cue.key)):null;
    knownCueKeys=new Set(cues.map(cue=>cue.key));
    renderGuide();renderCuePeek();
    if(cluster)cluster.dataset.count=String(cues.length);
    if(fresh)showBloom(fresh);
    return result;
  };

  const baseRender=ctx.render;
  ctx.render=(...args)=>{
    const result=baseRender?.(...args);
    renderGuide();renderCuePeek();postProcessSettings();
    return result;
  };
  ctx.renderAll=()=>ctx.render?.(ctx.mode);

  const cancelHover=()=>{
    clearTimeout(hoverTimer);hoverTimer=0;
    if(hoverTarget){hoverTarget.classList.remove('v28-hover-commit');hoverTarget.style.removeProperty('--v28-dwell')}
    hoverTarget=null;
  };
  const startHover=edge=>{
    if(!finePointer()||Date.now()<hoverCooldownUntil||document.documentElement.dataset.cover!=='peeled')return;
    const target=edge.dataset.go;if(!target||target===ctx.mode)return;
    cancelHover();hoverTarget=edge;edge.classList.add('v28-hover-commit');edge.style.setProperty('--v28-dwell',`${HOVER_DWELL}ms`);
    hoverTimer=setTimeout(()=>{
      const destination=edge.dataset.go;cancelHover();hoverCooldownUntil=Date.now()+900;ctx.go?.(destination);
    },HOVER_DWELL);
  };
  for(const edge of $$('.edge-nav .edge[data-go]')){
    edge.addEventListener('pointerenter',()=>startHover(edge));
    edge.addEventListener('pointerleave',cancelHover);
    edge.addEventListener('pointerdown',cancelHover);
  }

  const baseInitialize=ctx.initialize;
  ctx.initialize=async()=>{
    await baseInitialize?.();
    simplifySettings();postProcessSettings();renderGuide();renderCuePeek();
    initialized=true;knownCueKeys=new Set((ctx.currentCues||[]).map(cue=>cue.key));
    document.documentElement.dataset.guidedFold='v28';
    if(window.__PACEFOLD__){
      window.__PACEFOLD__.guidedFold=EXPERIENCE;
      window.__PACEFOLD__.guidedFoldRelease=DISPLAY_RELEASE;
      window.__PACEFOLD__.openCuePeek=openPeek;
    }
  };

  ctx.guidedFoldV28={version:EXPERIENCE,render:renderGuide,openCuePeek};
}
