(() => {
  'use strict';

  const RELEASE='21.0.0';
  const PREFS_KEY='pacefoldPrefsV15';
  const SNAPSHOT_KEY='pacefold.v21.preferences.v1';
  const ONBOARDED_KEY='pacefoldOnboardedV15';
  const DISMISSED_KEY='pacefoldSetupDismissedV15';

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
