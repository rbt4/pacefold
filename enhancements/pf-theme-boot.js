'use strict';
(()=>{
  const root=document.documentElement;
  root.classList.add('pf-boot');
  try{
    const prefs=JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}');
    root.dataset.theme=String(prefs.theme||'auto');
    root.dataset.clarity=String(prefs.clarity||'discreet');
    root.toggleAttribute('data-pf-quiet',Boolean(prefs.quiet));
  }catch{
    root.dataset.theme='auto';
    root.dataset.clarity='discreet';
  }
})();
