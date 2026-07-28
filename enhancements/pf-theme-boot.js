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

  /* The Ma layer owns one broad document reconciliation observer. Keep focused
     core/clock observers fully native, but settle any whole-document observer
     and ignore DOM nodes created by Ma itself. This prevents reconciliation from
     feeding on its own ribbon, meter, Quiet and option-menu additions. */
  const NativeObserver=window.MutationObserver;
  if(typeof NativeObserver==='function'){
    const ownedSelector=[
      '.pf-ribbon-track','.pf-ribbon-spent','.pf-ribbon-now','.pf-ribbon-tick','.pf-ribbon-mark','.pf-ribbon-ticks','.pf-ribbon-marks',
      '.pf-time-digit','.pf-meter','.pf-meter-host','.pf-ritual-options','.pf-ritual-menu','.pf-fold-review','.pf-backup-controls',
      '.pf-storage-line','.pf-restore-dialog','.pf-wafer-edge','.pf-wafer-suggestion','.pf-quiet-toggle','.pf-day-type-toggle',
      '#pfQuietToggle','#pfDayTypeToggle','#pfBackupControls','#pfStorageLine','#pfFoldReview','#pfRestoreDialog','#pfWaferEdge','#pfWaferSuggestion'
    ].join(',');
    const isOwned=node=>node?.nodeType===1&&(node.matches?.(ownedSelector)||node.closest?.(ownedSelector));
    function SettledObserver(callback){
      let broad=false,queued=[],scheduled=false,muted=false;
      const native=new NativeObserver(records=>{
        if(!broad){callback(records,this);return;}
        if(muted)return;
        const meaningful=records.filter(record=>[...record.addedNodes].some(node=>node.nodeType===1&&!isOwned(node)));
        if(!meaningful.length)return;
        queued.push(...meaningful);
        if(scheduled)return;
        scheduled=true;
        setTimeout(()=>{
          scheduled=false;
          const batch=queued;
          queued=[];
          if(!batch.length)return;
          const sequence=document.getElementById('sequence');
          if(sequence?.dataset.pfMaRibbon==='true'&&!sequence.querySelector('.pf-ribbon-track'))delete sequence.dataset.pfMaRibbon;
          muted=true;
          try{callback(batch,this);}finally{setTimeout(()=>{muted=false;},0);}
        },0);
      });
      this.observe=(target,options={})=>{
        broad=target===document.documentElement&&Boolean(options.childList)&&Boolean(options.subtree);
        native.observe(target,broad?{childList:true,subtree:true}:options);
      };
      this.disconnect=()=>native.disconnect();
      this.takeRecords=()=>native.takeRecords();
    }
    SettledObserver.prototype=NativeObserver.prototype;
    window.MutationObserver=SettledObserver;
  }
})();
