(() => {
  'use strict';

  const EXPERIENCE='21.1.0';
  const RELEASE='21.1.2';
  const REVISION='polish-r3';
  const CORE='15.2.2';
  const PREFS_KEY='pacefoldPrefsV15';
  let frame=0;
  let observer=null;

  const compact=value=>String(value??'').replace(/\s+/g,' ').trim();
  const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}};
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  const byId=id=>document.getElementById(id);
  const attribute=(node,name,value)=>{
    if(node&&value!=null&&node.getAttribute(name)!==String(value))node.setAttribute(name,String(value));
  };
  const dataset=(node,name,value)=>{
    if(node&&value!=null&&node.dataset[name]!==String(value))node.dataset[name]=String(value);
  };

  function report(scope,error){
    try{window.__PACEFOLD_RESILIENCE__?.recordError?.(`v21-precision-${scope}`,error);}catch{}
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

  function prefs(){
    return window.__PACEFOLD_MA_CORE__?.getPrefs?.()||object(parse(localStorage.getItem(PREFS_KEY),{}))||{};
  }

  function installPolishStyles(){
    if(document.documentElement.dataset.pacefoldPolishRules===REVISION)return true;
    const sheet=[...document.styleSheets].find(item=>item.href?.includes('pacefold-v21-precision.css'));
    if(!sheet)return false;
    const rules=[
      'html.pf-v21-precision-active .pf-v20-folio{width:min(1040px,calc(100vw - 24px))!important}',
      'html.pf-v21-precision-active .pf-v20-folio>.clock-shell{column-gap:24px!important;row-gap:0!important;padding:18px 24px 13px!important}',
      'html.pf-v21-precision-active .product-mark{margin-bottom:4px!important}',
      'html.pf-v21-precision-active .date{margin-top:4px!important}',
      'html[data-pf21-weather="false"].pf-v21-precision-active .pf-v20-folio>.clock-shell{padding-top:14px!important}',
      'html[data-pf21-weather="false"].pf-v21-precision-active .time-main{font-size:clamp(64px,6.7vw,84px)!important}',
      'html[data-pf21-weather="false"].pf-v21-precision-active .status-area{margin-top:5px!important}',
      'html.pf-v21-precision-active .status-area{gap:10px!important;margin-top:10px!important}',
      'html.pf-v21-precision-active .pf21-dayline{min-height:60px!important;padding:10px 12px!important;border-radius:15px!important}',
      'html.pf-v21-precision-active .pf21-dayline-copy{column-gap:12px!important;row-gap:2px!important}',
      'html.pf-v21-precision-active .pf21-dayline-kicker{padding:5px 8px!important;font-size:9px!important;line-height:1.1!important}',
      'html.pf-v21-precision-active .pf21-dayline-title{font-size:13px!important;line-height:1.25!important}',
      'html.pf-v21-precision-active .pf21-dayline-detail{font-size:10.5px!important;line-height:1.35!important;letter-spacing:0!important}',
      'html.pf-v21-precision-active #sequence.pf-day-ribbon{height:31px!important;min-height:31px!important;margin:1px 6px 0!important}',
      'html.pf-v21-precision-active .pf21-ribbon-meta{margin-top:-2px!important;padding-inline:7px!important;font-size:9px!important}',
      'html.pf-v21-precision-active #workline{gap:8px!important;margin-top:10px!important}',
      'html.pf-v21-precision-active .pf-ritual-slot[data-v19-ritual="true"]{min-height:70px!important;border-radius:14px!important}',
      'html.pf-v21-precision-active .pf-ritual-slot[data-v19-ritual="true"]>button:not(.pf-ritual-options){min-height:51px!important;padding:8px 10px 9px!important}',
      'html.pf-v21-precision-active .pf-v20-folio>.pf-v19-workbench{min-height:0!important}',
      'html.pf-v21-precision-active .pf-v19-workbench-rail{padding:8px!important}',
      'html.pf-v21-precision-active .pf-v19-workbench-tab{min-height:38px!important;border-radius:10px!important}',
      'html.pf-v21-precision-active .pf21-note-calendar{margin:10px 0 12px!important;padding:12px!important;border-radius:15px!important}',
      'html.pf-v21-precision-active .pf21-calendar-summary{gap:8px 12px!important;margin-bottom:10px!important}',
      'html.pf-v21-precision-active .pf21-calendar-stats{font-size:10px!important;line-height:1.3!important}',
      'html.pf-v21-precision-active .pf21-calendar-grid{gap:4px!important}',
      'html.pf-v21-precision-active .pf21-calendar-day{min-height:32px!important;border-radius:8px!important}',
      'html.pf-v21-precision-active #pf-v19-workbench .pf-note-composer textarea{min-height:126px!important;font-size:13px!important;line-height:26px!important}',
      'html.pf-v21-precision-active #panel #pf21-settings{padding:14px!important;border-radius:16px!important}',
      'html.pf-v21-precision-active .pf21-setting-switch{min-height:48px!important;padding:9px 11px!important;border-radius:12px!important}',
      'html.pf-v21-precision-active .pf21-settings-footer{align-items:center!important;gap:8px 12px!important;flex-wrap:wrap!important}',
      'html.pf-v21-precision-active .pf21-settings-version{font-weight:700!important;color:var(--pf212-green-deep)!important}',
      'html.pf-v21-precision-active .pf21-version-detail{display:block!important;flex-basis:100%!important;margin-left:auto!important;color:var(--pf212-muted)!important;font-size:9px!important;line-height:1.3!important;text-align:right!important}',
      '@media(max-width:720px){html.pf-v21-precision-active .pf-v20-folio{width:calc(100vw - 12px)!important}html.pf-v21-precision-active .pf-v20-folio>.clock-shell{padding:14px 13px 12px!important}html.pf-v21-precision-active .pf21-dayline{min-height:58px!important;padding:9px!important}html.pf-v21-precision-active .pf21-dayline-title{font-size:12px!important}html.pf-v21-precision-active .pf21-dayline-detail{font-size:9.5px!important}html.pf-v21-precision-active #workline{gap:6px!important}html.pf-v21-precision-active .pf21-note-calendar{padding:10px!important}html.pf-v21-precision-active .pf21-calendar-day{min-height:30px!important}}',
      '@media(max-width:420px){html.pf-v21-precision-active .pf21-dayline-copy{column-gap:8px!important}html.pf-v21-precision-active .pf21-dayline-kicker{font-size:8px!important}html.pf-v21-precision-active .pf21-dayline-detail{font-size:9px!important}html.pf-v21-precision-active .pf21-calendar-grid{gap:3px!important}}'
    ];
    try{
      for(const rule of rules)sheet.insertRule(rule,sheet.cssRules.length);
      dataset(document.documentElement,'pacefoldPolishRules',REVISION);
      return true;
    }catch(error){report('polish-rules',error);return false;}
  }

  function patchSurface(){
    installPolishStyles();
    document.documentElement.classList.add('pf-v21-precision-active');
    dataset(document.documentElement,'pacefoldPrecision',REVISION);
    dataset(document.documentElement,'pacefoldExperience',EXPERIENCE);
    dataset(document.documentElement,'pacefoldUpdate',RELEASE);
    dataset(document.body,'pacefoldPrecision',REVISION);
    dataset(document.body,'pacefoldExperience',EXPERIENCE);
    dataset(document.body,'pacefoldUpdate',RELEASE);
    window.__PACEFOLD_VERSION__={experience:EXPERIENCE,update:RELEASE,revision:REVISION,offlineCore:CORE};
    const title=compact(document.title);
    if(!title||/15\.2\.2|15\.8\.0|21\.0\.0|21\.1\.0|Pacefold/i.test(title))document.title=`Pacefold ${EXPERIENCE} · update ${RELEASE}`;
  }

  function decorateDayline(){
    const root=byId('pf21-dayline');
    if(!root)return false;
    const title=compact(root.querySelector('.pf21-dayline-title')?.textContent);
    const detail=compact(root.querySelector('.pf21-dayline-detail')?.textContent);
    const kicker=compact(root.querySelector('.pf21-dayline-kicker')?.textContent);
    const privateMode=Boolean(prefs().privacy||prefs().quietMode);
    const empty=root.dataset.empty==='true';
    const urgent=/^(?:now|due|ready)$/i.test(kicker)||/\b(?:due|ready|now)\b/i.test(`${title} ${detail}`);
    dataset(root,'precisionState',empty?'clear':urgent?'now':'upcoming');
    dataset(root,'precisionPrivate',privateMode);
    attribute(root,'title',compact([title,detail].filter(Boolean).join(' — '))||'Workday status');
    attribute(root,'aria-label',compact([kicker,title,detail].filter(Boolean).join('. '))||'Workday status');
    return true;
  }

  function decorateDayType(){
    const control=byId('pf-day-type');
    if(!control)return false;
    const label=compact(control.textContent)||'Desk';
    const mode=label.toLowerCase().replace(/\s+day$/,'').replace(/\s+/g,'-');
    dataset(control,'precisionMode',mode);
    attribute(control,'title',`${label} day. Click to change today's work pattern.`);
    attribute(control,'aria-label',`${label} day. Change today's work pattern.`);
    return true;
  }

  function decorateRibbon(){
    const sequence=byId('sequence');
    if(!sequence)return false;
    const start=compact(document.querySelector('.pf21-ribbon-start')?.textContent);
    const end=compact(document.querySelector('.pf21-ribbon-end')?.textContent);
    const scheduled=sequence.querySelectorAll('.pf-ribbon-crease').length;
    const summary=`Workday timeline${start&&end?` from ${start} to ${end}`:''}. ${scheduled?`${scheduled} scheduled ${scheduled===1?'pause':'pauses'}.`:'No scheduled pauses.'}`;
    attribute(sequence,'aria-label',summary);
    attribute(sequence,'title',summary);
    const now=sequence.querySelector('.pf-ribbon-now');
    dataset(now,'precisionMarker','now');
    attribute(now,'aria-label','Current time');
    let index=0;
    for(const marker of sequence.querySelectorAll('.pf-ribbon-crease')){
      index+=1;
      dataset(marker,'precisionMarker','scheduled');
      const label=compact(marker.getAttribute('aria-label')||marker.getAttribute('title'))||`Scheduled pause ${index}`;
      attribute(marker,'title',label);
      attribute(marker,'aria-label',label);
    }
    return true;
  }

  function decorateRhythm(){
    const descriptions={water:'Log a water sip',noodle:'Start or manage the personal timer',away:'Start or end an away break',lunch:'Start or end a meal break',eyes:'Start a short distance-vision reset',body:'Start an ergonomic movement reset'};
    let count=0;
    for(const slot of document.querySelectorAll('#workline .pf-ritual-slot[data-v19-ritual="true"]')){
      count+=1;
      const source=slot.dataset.source||'';
      dataset(slot,'precisionIndex',count);
      dataset(slot,'precisionState',slot.dataset.attention==='true'?'attention':slot.dataset.active==='true'?'active':'idle');
      const action=slot.querySelector('button:not(.pf-ritual-options)');
      const label=compact(action?.getAttribute('aria-label')||action?.textContent);
      attribute(action,'title',descriptions[source]||label||'Workday action');
      const options=slot.querySelector('.pf-ritual-options');
      if(options)attribute(options,'title',`Options for ${label||source||'this action'}`);
    }
    attribute(byId('workline'),'aria-label','Workday rhythm controls. Six quick actions.');
    return count>0;
  }

  function decorateCalendar(){
    const calendar=byId('pf21-note-calendar');
    if(!calendar)return false;
    const stats=compact(calendar.querySelector('.pf21-calendar-stats')?.textContent);
    const month=compact(calendar.querySelector('.pf21-calendar-month')?.textContent);
    attribute(calendar,'title',compact([month,stats].filter(Boolean).join(' — '))||'Notebook activity calendar');
    for(const day of calendar.querySelectorAll('.pf21-calendar-day')){
      const number=compact(day.querySelector('.pf21-calendar-number')?.textContent);
      const countText=compact(day.querySelector('.pf21-calendar-count')?.textContent);
      const count=countText==='9+'?9:Number(countText)||0;
      if(!day.dataset.precisionBaseLabel){
        const initial=compact(day.getAttribute('aria-label'));
        dataset(day,'precisionBaseLabel',initial||`Day ${number}`);
      }
      const label=compact(day.dataset.precisionBaseLabel)||`Day ${number}`;
      const noteLabel=count?`${countText||count} ${count===1?'note':'notes'}`:'No notes';
      attribute(day,'aria-label',`${label}. ${noteLabel}.`);
      attribute(day,'title',`${label} — ${noteLabel}`);
      dataset(day,'precisionActivity',count?'noted':'empty');
    }
    return true;
  }

  function decorateSettings(){
    const settings=byId('pf21-settings');
    if(!settings)return false;
    dataset(settings,'precision',REVISION);
    const more=settings.querySelector('.pf21-more-settings');
    attribute(more,'title','Show or hide the complete settings views');
    const version=settings.querySelector('.pf21-settings-version');
    if(version){
      if(compact(version.textContent)!==`Pacefold ${EXPERIENCE}`)version.textContent=`Pacefold ${EXPERIENCE}`;
      attribute(version,'title',`Experience ${EXPERIENCE}. Update ${RELEASE}. Verified offline engine ${CORE}.`);
      attribute(version,'aria-label',`Pacefold experience ${EXPERIENCE}. Update ${RELEASE}. Verified offline engine ${CORE}.`);
      dataset(version,'experience',EXPERIENCE);
      dataset(version,'update',RELEASE);
      dataset(version,'offlineCore',CORE);
      let detail=settings.querySelector('.pf21-version-detail');
      if(!detail){
        detail=document.createElement('small');
        detail.className='pf21-version-detail';
        version.insertAdjacentElement('afterend',detail);
      }
      const copy=`Update ${RELEASE} · verified offline engine ${CORE}`;
      if(compact(detail.textContent)!==copy)detail.textContent=copy;
    }
    return true;
  }

  function reconcile(){
    patchSurface();
    decorateDayline();
    decorateDayType();
    decorateRibbon();
    decorateRhythm();
    decorateCalendar();
    decorateSettings();
    return true;
  }

  function queue(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      try{reconcile();}catch(error){report('reconcile',error);}
    });
  }

  function initialize(){
    reconcile();
    observer=new MutationObserver(()=>queue());
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden','aria-label','aria-selected','data-active','data-attention','data-empty','data-note-level','data-selected','data-state','data-signal','data-source']});
    window.addEventListener('resize',guarded('resize',queue),{passive:true});
    window.addEventListener('pacefold:ma-prefs',guarded('prefs',queue));
    window.addEventListener('pacefold:storage-changed',guarded('storage',queue));
    window.addEventListener('storage',guarded('cross-window',queue));
    [40,180,520,1200,2600].forEach(delay=>setTimeout(queue,delay));
  }

  window.__PACEFOLD_V21_PRECISION__={experience:EXPERIENCE,release:RELEASE,revision:REVISION,offlineCore:CORE,reconcile:queue};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
