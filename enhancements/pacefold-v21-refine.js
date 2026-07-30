(() => {
  'use strict';

  const RELEASE='21.2.0';
  const SNAPSHOT_KEY='pacefold.v21.preferences.v1';
  const SETTINGS_KEY='pacefold.v21.settings.v1';
  let frame=0;
  let observer=null;

  const compact=value=>String(value??'').replace(/\s+/g,' ').trim();
  const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}};
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  const text=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
  const attribute=(node,name,value)=>{if(node&&node.getAttribute(name)!==value)node.setAttribute(name,value);};
  const dataset=(node,name,value)=>{if(node&&node.dataset[name]!==value)node.dataset[name]=value;};

  function report(scope,error){
    try{window.__PACEFOLD_RESILIENCE__?.recordError?.(`v21.2-${scope}`,error);}catch{}
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

  function patchPublicVersion(){
    document.documentElement.classList.add('pf-v21-1-active');
    dataset(document.documentElement,'pacefoldExperience',RELEASE);
    dataset(document.documentElement,'pacefoldRefinement',RELEASE);
    dataset(document.body,'pacefoldExperience',RELEASE);
    dataset(document.body,'pacefoldRefinement',RELEASE);
    text(document.querySelector('.pf21-settings-version'),`Pacefold ${RELEASE}`);
    for(const api of [window.__PACEFOLD_V21_BOOT__,window.__PACEFOLD_V21__,window.__PACEFOLD_V21_PERSISTENCE__]){
      if(api&&api.release!==RELEASE){try{api.release=RELEASE;}catch{}}
    }
  }

  function patchStoredVersion(key){
    const value=object(parse(localStorage.getItem(key),null));
    if(!value||value.version===RELEASE)return false;
    try{localStorage.setItem(key,JSON.stringify({...value,version:RELEASE}));return true;}catch{return false;}
  }

  function refineCalendar(){
    const cells=document.querySelectorAll('.pf21-calendar-day');
    if(!cells.length)return false;
    for(const cell of cells){
      const raw=compact(cell.querySelector('.pf21-calendar-count')?.textContent);
      const count=raw==='9+'?9:Number(raw)||0;
      const level=String(count<=0?0:count===1?1:count<=3?2:count<=6?3:4);
      dataset(cell,'noteLevel',level);
      const title=cell.getAttribute('aria-label')||'';
      if(count)attribute(cell,'title',title);
      else if(cell.hasAttribute('title'))cell.removeAttribute('title');
    }
    return true;
  }

  function refineSettings(){
    const root=document.getElementById('pf21-settings');
    if(!root)return false;
    dataset(root,'refined',RELEASE);
    text(root.querySelector('.pf21-settings-saved'),'Auto-saved');
    for(const row of root.querySelectorAll('.pf21-setting-switch')){
      const title=compact(row.querySelector('strong')?.textContent);
      const description=compact(row.querySelector('small')?.textContent);
      if(title)attribute(row,'title',description?`${title} — ${description}`:title);
    }
    attribute(root.querySelector('.pf21-more-settings'),'title','Open or hide the complete settings views');
    return true;
  }

  function refineLiveSurfaces(){
    const dayline=document.getElementById('pf21-dayline');
    attribute(dayline,'aria-live','polite');
    attribute(dayline,'aria-atomic','true');
    const alert=document.querySelector('.pf-v20-alert');
    attribute(alert,'aria-live','polite');
    attribute(alert,'aria-atomic','true');
    attribute(document.getElementById('workline'),'aria-label','Workday rhythm controls');
  }

  function updateDensity(){
    const width=window.innerWidth;
    dataset(document.documentElement,'pf21Density',width<=540?'compact':width<=900?'balanced':'wide');
  }

  function reconcile(){
    patchPublicVersion();
    patchStoredVersion(SNAPSHOT_KEY);
    patchStoredVersion(SETTINGS_KEY);
    refineCalendar();
    refineSettings();
    refineLiveSurfaces();
    updateDensity();
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
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-expanded','data-selected','data-has-notes','data-pacefold-experience']});
    window.addEventListener('resize',guarded('resize',queue),{passive:true});
    window.addEventListener('pacefold:ma-prefs',guarded('prefs',queue));
    window.addEventListener('pacefold:storage-changed',guarded('storage-changed',queue));
    window.addEventListener('storage',guarded('storage',event=>{
      if([SNAPSHOT_KEY,SETTINGS_KEY,'pacefold.notebook.entries.v2'].includes(event.key))queue();
    }));
    [40,160,500,1200,2600,4200].forEach(delay=>setTimeout(queue,delay));
  }

  window.__PACEFOLD_V21_REFINEMENT__={release:RELEASE,reconcile:queue};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();