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

  /* Ma owns one broad reconciliation observer. Settle that observer so DOM writes
     produced by its own callback cannot feed an immediate reconciliation loop.
     The wrapper is available for one task only; core and focused observers retain
     the native MutationObserver implementation. */
  const NativeObserver=window.MutationObserver;
  if(typeof NativeObserver==='function'){
    document.addEventListener('DOMContentLoaded',()=>{
      let claimed=false;
      function SettledObserver(callback){
        if(claimed)return new NativeObserver(callback);
        claimed=true;
        let queued=[],scheduled=false,muted=false,observer;
        observer=new NativeObserver(records=>{
          if(muted)return;
          queued.push(...records);
          if(scheduled)return;
          scheduled=true;
          setTimeout(()=>{
            scheduled=false;
            const batch=queued;
            queued=[];
            if(!batch.length)return;
            muted=true;
            try{callback(batch,observer);}finally{setTimeout(()=>{muted=false;},0);}
          },0);
        });
        return observer;
      }
      SettledObserver.prototype=NativeObserver.prototype;
      window.MutationObserver=SettledObserver;
      setTimeout(()=>{if(window.MutationObserver===SettledObserver)window.MutationObserver=NativeObserver;},0);
    },{once:true});
  }
})();
