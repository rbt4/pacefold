(() => {
  'use strict';

  const EXPERIENCE='21.2.0';
  const RELEASE='21.2.0';
  const REVISION='minimal-r1';
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

  function decorateBrand(){
    const brand=document.querySelector('.product-mark');
    if(!brand)return false;
    let subline=brand.querySelector('.pf21-brand-subline');
    if(!subline){
      subline=document.createElement('small');
      subline.className='pf21-brand-subline';
      brand.append(subline);
    }
    if(compact(subline.textContent)!=='Focus · rhythm · flow')subline.textContent='Focus · rhythm · flow';
    attribute(brand,'title','Pacefold — a quiet workday rhythm');
    return true;
  }

  function patchSurface(){
    document.documentElement.lang='en';
    document.documentElement.classList.add('pf-v21-precision-active','pf-v21-minimal-active');
    dataset(document.documentElement,'pacefoldPrecision',REVISION);
    dataset(document.documentElement,'pacefoldMinimal',REVISION);
    dataset(document.documentElement,'pacefoldExperience',EXPERIENCE);
    dataset(document.documentElement,'pacefoldUpdate',RELEASE);
    dataset(document.body,'pacefoldPrecision',REVISION);
    dataset(document.body,'pacefoldMinimal',REVISION);
    dataset(document.body,'pacefoldExperience',EXPERIENCE);
    dataset(document.body,'pacefoldUpdate',RELEASE);
    window.__PACEFOLD_VERSION__={experience:EXPERIENCE,update:RELEASE,revision:REVISION,offlineCore:CORE};
    const title=compact(document.title);
    if(!title||/15\.2\.2|15\.8\.0|21\.[012]\.|Pacefold/i.test(title))document.title=`Pacefold — Quiet Workday Rhythm · ${EXPERIENCE}`;
    decorateBrand();
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
    const descriptions={
      water:'Log a water sip',
      noodle:'Start or manage the personal timer',
      away:'Start or end an away break',
      lunch:'Start or end a meal break',
      eyes:'Start a short distance-vision reset',
      body:'Start an ergonomic movement reset'
    };
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
      attribute(version,'title',`Experience ${EXPERIENCE}. Verified offline engine ${CORE}.`);
      attribute(version,'aria-label',`Pacefold experience ${EXPERIENCE}. Verified offline engine ${CORE}.`);
      dataset(version,'experience',EXPERIENCE);
      dataset(version,'update',RELEASE);
      dataset(version,'offlineCore',CORE);
      let detail=settings.querySelector('.pf21-version-detail');
      if(!detail){
        detail=document.createElement('small');
        detail.className='pf21-version-detail';
        version.insertAdjacentElement('afterend',detail);
      }
      const copy=`Minimal redesign · verified offline engine ${CORE}`;
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
    observer.observe(document.documentElement,{
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','hidden','aria-label','aria-selected','data-active','data-attention','data-empty','data-note-level','data-selected','data-state','data-signal','data-source']
    });
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