(() => {
  'use strict';

  const RELEASE='21.0.0';
  const SETTINGS_KEY='pacefold.v21.settings.v1';
  const EXTENSION_KEYS=new Set(['v21WeatherEnabled']);

  const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}};
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  const read=()=>object(parse(localStorage.getItem(SETTINGS_KEY),{}))||{};
  const write=value=>{
    const next=object(value)||{};
    localStorage.setItem(SETTINGS_KEY,JSON.stringify({...next,version:RELEASE,savedAt:new Date().toISOString()}));
    return next;
  };
  const extensionPatch=patch=>Object.fromEntries(Object.entries(object(patch)||{}).filter(([key])=>EXTENSION_KEYS.has(key)));
  const corePatch=patch=>Object.fromEntries(Object.entries(object(patch)||{}).filter(([key])=>!EXTENSION_KEYS.has(key)));

  function applySurface(settings=read()){
    document.documentElement.dataset.pf21Weather=String(settings.v21WeatherEnabled!==false);
  }

  function wrapCore(){
    const core=window.__PACEFOLD_MA_CORE__;
    if(!core||core.__pacefoldV21Persistence)return false;

    const originalGet=typeof core.getPrefs==='function'?core.getPrefs.bind(core):()=>({});
    const originalUpdate=typeof core.updatePrefs==='function'?core.updatePrefs.bind(core):null;

    core.getPrefs=()=>({...originalGet(),...read()});
    core.updatePrefs=patch=>{
      const extension=extensionPatch(patch);
      const base=corePatch(patch);
      let next=Object.keys(base).length&&originalUpdate?originalUpdate(base):originalGet();
      if(Object.keys(extension).length)write({...read(),...extension});
      next={...next,...read()};
      applySurface(next);
      return next;
    };
    core.__pacefoldV21Persistence=true;
    return true;
  }

  function reconcile(){
    wrapCore();
    const settings=read();
    applySurface(settings);
    const weather=document.querySelector('[data-pf21-pref="v21WeatherEnabled"]');
    if(weather&&weather.checked!==(settings.v21WeatherEnabled!==false))weather.checked=settings.v21WeatherEnabled!==false;
    window.__PACEFOLD_V21__?.reconcile?.();
  }

  function initialize(){
    wrapCore();
    applySurface();
    window.addEventListener('storage',event=>{
      if(event.key===SETTINGS_KEY)reconcile();
    });
    window.addEventListener('pacefold:ma-prefs',()=>{
      applySurface();
    });
    [0,30,100,300,900].forEach(delay=>setTimeout(reconcile,delay));
  }

  window.__PACEFOLD_V21_PERSISTENCE__={
    release:RELEASE,
    key:SETTINGS_KEY,
    read,
    write:settings=>{const next=write(settings);reconcile();return next;},
    reconcile
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
