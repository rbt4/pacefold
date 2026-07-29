(() => {
  'use strict';

  const root=document.documentElement;
  root.classList.add('pf-boot');
  try{
    const raw=JSON.parse(localStorage.getItem('pacefoldPrefsV15')||'{}');
    const theme=['auto','desk','paper','dark','moss','dusk','custom'].includes(raw.theme)?raw.theme:'auto';
    const clarity=['clear','discreet','wafer'].includes(raw.clarity)?raw.clarity:'discreet';
    root.dataset.pfTheme=theme;
    root.dataset.pfClarity=clarity;
    root.dataset.pfQuiet=raw.quietMode===true?'true':'false';
    root.style.colorScheme=theme==='dark'?'dark':theme==='auto'?'light dark':'light';
  }catch{
    root.dataset.pfTheme='auto';
    root.dataset.pfClarity='discreet';
    root.dataset.pfQuiet='false';
  }
  window.addEventListener('load',()=>setTimeout(()=>root.classList.remove('pf-boot'),1200),{once:true});
})();
