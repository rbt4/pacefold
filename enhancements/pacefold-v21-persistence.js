(() => {
  'use strict';

  const RELEASE='21.2.0';
  const SETTINGS_KEY='pacefold.v21.settings.v1';
  const EXTENSION_KEYS=new Set(['v21WeatherEnabled']);
  const METADATA_KEYS=new Set(['version','savedAt']);
  let observer=null;

  const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}};
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  const rawRead=()=>object(parse(localStorage.getItem(SETTINGS_KEY),{}))||{};
  const extensionPatch=patch=>Object.fromEntries(Object.entries(object(patch)||{}).filter(([key])=>EXTENSION_KEYS.has(key)));
  const corePatch=patch=>Object.fromEntries(Object.entries(object(patch)||{}).filter(([key])=>!EXTENSION_KEYS.has(key)));
  const read=()=>extensionPatch(rawRead());
  const write=value=>{
    const next=extensionPatch(value);
    localStorage.setItem(SETTINGS_KEY,JSON.stringify({...next,version:RELEASE,savedAt:new Date().toISOString()}));
    return next;
  };

  function sanitizeStore(){
    const rawText=localStorage.getItem(SETTINGS_KEY);
    if(!rawText)return false;
    const raw=object(parse(rawText,{}))||{};
    const next=extensionPatch(raw);
    const contaminated=Object.keys(raw).some(key=>!EXTENSION_KEYS.has(key)&&!METADATA_KEYS.has(key));
    if(!contaminated&&raw.version===RELEASE)return false;
    try{
      localStorage.setItem(SETTINGS_KEY,JSON.stringify({...next,version:RELEASE,savedAt:raw.savedAt||new Date().toISOString()}));
      return true;
    }catch{return false;}
  }

  function applySurface(settings=read()){
    document.documentElement.dataset.pf21Weather=String(settings.v21WeatherEnabled!==false);
  }

  function suppressUnrequestedReview(){
    const review=document.getElementById('pf-fold-review');
    if(!review)return false;
    const dismiss=[...review.querySelectorAll('button')].find(button=>/close|dismiss|later|skip|done|continue/i.test(`${button.textContent||''} ${button.getAttribute('aria-label')||''}`));
    if(dismiss&&!review.dataset.pf21Dismissing){
      review.dataset.pf21Dismissing='true';
      dismiss.click();
    }
    if(review.isConnected)review.remove();
    return true;
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
      const extensionState=read();
      next={...next,...extensionState};
      applySurface(extensionState);
      return next;
    };
    core.__pacefoldV21Persistence=true;
    return true;
  }

  function reconcile(){
    sanitizeStore();
    wrapCore();
    const settings=read();
    applySurface(settings);
    suppressUnrequestedReview();
    const weather=document.querySelector('[data-pf21-pref="v21WeatherEnabled"]');
    if(weather&&weather.checked!==(settings.v21WeatherEnabled!==false))weather.checked=settings.v21WeatherEnabled!==false;
    window.__PACEFOLD_V21__?.reconcile?.();
  }

  function initialize(){
    sanitizeStore();
    wrapCore();
    applySurface();
    suppressUnrequestedReview();
    observer=new MutationObserver(mutations=>{
      if(mutations.some(item=>item.target instanceof Element&&(item.target.id==='pf-fold-review'||item.target.closest?.('#pf-fold-review')))||document.getElementById('pf-fold-review'))suppressUnrequestedReview();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-hidden']});
    window.addEventListener('storage',event=>{
      if(event.key===SETTINGS_KEY)reconcile();
    });
    window.addEventListener('pacefold:ma-prefs',()=>{
      applySurface();
      suppressUnrequestedReview();
    });
    [0,30,100,300,900,2500].forEach(delay=>setTimeout(reconcile,delay));
  }

  window.__PACEFOLD_V21_PERSISTENCE__={
    release:RELEASE,
    key:SETTINGS_KEY,
    read,
    write:settings=>{const next=write(settings);reconcile();return next;},
    reconcile,
    sanitizeStore,
    suppressUnrequestedReview
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();