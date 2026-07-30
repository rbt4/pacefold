(() => {
  'use strict';

  const RELEASE='21.0.0';
  const PREFS_KEY='pacefoldPrefsV15';
  const SNAPSHOT_KEY='pacefold.v21.preferences.v1';
  const ONBOARDED_KEY='pacefoldOnboardedV15';
  const DISMISSED_KEY='pacefoldSetupDismissedV15';

  if(!window.__PACEFOLD_TITLE_GUARD__){
    const prototypes=[window.HTMLDocument?.prototype,window.Document?.prototype].filter(Boolean);
    const descriptor=prototypes.map(prototype=>Object.getOwnPropertyDescriptor(prototype,'title')).find(value=>value?.get&&value?.set);
    if(descriptor){
      window.__PACEFOLD_TITLE_GUARD__=true;
      Object.defineProperty(document,'title',{
        configurable:true,
        get:()=>descriptor.get.call(document),
        set:value=>{
          const next=String(value??'');
          if(descriptor.get.call(document)!==next)descriptor.set.call(document,next);
        }
      });
    }
  }

  const NativeMutationObserver=window.MutationObserver;
  if(NativeMutationObserver&&!window.__PACEFOLD_SPATIAL_OBSERVER_GUARD__){
    window.__PACEFOLD_SPATIAL_OBSERVER_GUARD__=true;
    window.MutationObserver=class PacefoldSpatialMutationObserver extends NativeMutationObserver{
      constructor(callback){
        let instance=null;
        super(records=>{
          const filtered=records.filter(record=>{
            const target=record.target instanceof Element?record.target:record.target?.parentElement;
            return !target?.closest?.('#pf22-spatial-root');
          });
          if(filtered.length)callback(filtered,instance);
        });
        instance=this;
      }
    };
  }

  window.addEventListener('pacefold:spatial-ready',()=>{
    const root=document.getElementById('pf22-spatial-root');
    if(!root||!NativeMutationObserver)return;
    const apply=()=>{
      const active=root.dataset.mode||'home';
      for(const face of root.querySelectorAll('.pf22-face')){
        const enabled=face.dataset.face===active;
        face.inert=!enabled;
        face.setAttribute('aria-hidden',String(!enabled));
      }
    };
    apply();
    const modeObserver=new NativeMutationObserver(apply);
    modeObserver.observe(root,{attributes:true,attributeFilter:['data-mode']});
    root.__pacefoldSpatialModeObserver=modeObserver;

    let statusFrame=0;
    const syncStatus=()=>{
      if(statusFrame)return;
      statusFrame=requestAnimationFrame(()=>{
        statusFrame=0;
        const target=document.getElementById('pf22-status');
        if(!target)return;
        const read=id=>String(document.getElementById(id)?.textContent||'').replace(/\s+/g,' ').trim();
        const parts=['statusWord','eventTime','relativeTime','eventName'].map(read).filter(Boolean);
        const raw=String(target.textContent||'').replace(/\s+/g,' ').trim();
        let next=parts.length>=2?parts.join(' · '):raw||'Workday in progress';
        if(parts.length<2&&!raw.includes(' · ')){
          const match=raw.match(/^(Overdue|Next|Now|Soon|Snoozed)(\d{1,2}:\d{2}\s*(?:AM|PM)?)(.*?)(Fajr|Sunrise|Dhuhr|Asr|Maghrib|Isha)$/i);
          if(match)next=[match[1],match[2],match[3],match[4]].map(value=>value.trim()).filter(Boolean).join(' · ');
        }
        if(target.textContent!==next)target.textContent=next;
      });
    };
    const source=document.getElementById('statusLine');
    if(source){
      const statusObserver=new NativeMutationObserver(syncStatus);
      statusObserver.observe(source,{subtree:true,childList:true,characterData:true});
      root.__pacefoldSpatialStatusObserver=statusObserver;
    }
    const target=document.getElementById('pf22-status');
    if(target){
      const targetObserver=new NativeMutationObserver(syncStatus);
      targetObserver.observe(target,{subtree:true,childList:true,characterData:true});
      root.__pacefoldSpatialTargetStatusObserver=targetObserver;
    }
    syncStatus();
    root.__pacefoldSpatialStatusTimer=setInterval(syncStatus,1000);
  },{once:true});

  const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}};
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  const meaningful=value=>{
    const prefs=object(value);
    if(!prefs)return false;
    const keys=Object.keys(prefs);
    return keys.length>=4&&Boolean(
      prefs.profile||prefs.schemaVersion||prefs.workHours||prefs.workWeek||
      prefs.locationLabel||prefs.theme||prefs.sipCadence||prefs.waterTarget
    );
  };
  const filtered=value=>{
    const result={};
    for(const [key,item] of Object.entries(object(value)||{})){
      if(/(?:auth|token|secret|password|oneNoteClient|oneNoteTenant|oneNoteNotebook|oneNoteSection|oneNotePages|oneNoteLast)/i.test(key))continue;
      result[key]=item;
    }
    return result;
  };

  let prefs=object(parse(localStorage.getItem(PREFS_KEY),null));
  const snapshot=object(parse(localStorage.getItem(SNAPSHOT_KEY),null));
  let restored=false;

  if(!meaningful(prefs)&&meaningful(snapshot?.prefs)){
    prefs=filtered(snapshot.prefs);
    try{localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));restored=true;}catch{}
  }

  const returning=meaningful(prefs);
  if(returning){
    try{
      localStorage.setItem(ONBOARDED_KEY,'1');
      localStorage.setItem(DISMISSED_KEY,'1');
      localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({version:RELEASE,savedAt:new Date().toISOString(),prefs:filtered(prefs)}));
    }catch{}
    document.documentElement.classList.add('pf21-returning');
  }

  document.documentElement.dataset.pacefoldExperience=RELEASE;
  window.__PACEFOLD_V21_BOOT__={release:RELEASE,returning,restored,meaningful};
})();
