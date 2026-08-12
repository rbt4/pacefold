import{id,el,button}from'./state.js';

export function installSync(ctx){
  ctx.download=(name,type,content)=>{
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const anchor=el('a');
    anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  ctx.downloadBackup=()=>{
    ctx.download(`pacefold-backup-${ctx.todayKey()}.json`,'application/json',JSON.stringify(ctx.currentBackup(),null,2));
    ctx.toast('Backup downloaded');
  };

  ctx.restoreBackupFile=async file=>{
    try{
      const data=JSON.parse(await file.text());
      if(!['pacefold.backup.v1','pacefold.backup.v2','pacefold.backup.v3'].includes(data.format))throw new Error('Not a Pacefold backup');
      const restoredNotes=ctx.normalizeNotes(data.notes||data.entries||[]);
      const confirmed=await ctx.confirmAction('Restore this Pacefold backup?',`This will replace current settings, notes and day log with ${restoredNotes.length} notes from the selected file.`);
      if(!confirmed)return;
      ctx.prefs=ctx.migratePrefs(data.prefs||{});
      ctx.notes=restoredNotes;
      ctx.log=ctx.normalizeLog(data.log||{});
      localStorage.setItem(ctx.KEYS.prefs,JSON.stringify(ctx.prefs));
      localStorage.setItem(ctx.KEYS.notes,JSON.stringify(ctx.notes));
      localStorage.setItem(ctx.KEYS.log,JSON.stringify(ctx.log));
      localStorage.setItem(ctx.KEYS.onboarding,'1');
      ctx.selectedDate=ctx.todayKey();
      ctx.calendarCursor=new Date(`${ctx.selectedDate}T12:00:00`);
      ctx.renderAll?.();
      ctx.toast('Backup restored');
    }catch(error){ctx.toast(error.message||'Backup could not be restored')}
  };

  ctx.backupDb=()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('pacefold-v25',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('handles');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });

  ctx.storeHandle=async handle=>{
    const db=await ctx.backupDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('handles','readwrite');
      tx.objectStore('handles').put(handle,'backup');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
    db.close();
  };

  ctx.readHandle=async()=>{
    try{
      const db=await ctx.backupDb();
      const handle=await new Promise((resolve,reject)=>{
        const tx=db.transaction('handles','readonly');
        const request=tx.objectStore('handles').get('backup');
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      });
      db.close();return handle;
    }catch{return null}
  };

  ctx.chooseLiveBackup=async()=>{
    if(!window.showSaveFilePicker){ctx.toast('Live backup files require Edge or another Chromium browser');return}
    try{
      const handle=await showSaveFilePicker({
        suggestedName:'pacefold-live-backup.json',
        types:[{description:'Pacefold JSON backup',accept:{'application/json':['.json']}}]
      });
      ctx.liveBackupHandle=handle;
      await ctx.storeHandle(handle);
      await ctx.writeLiveBackup(true);
      ctx.renderBackupStatus();ctx.toast('Live backup file connected');
    }catch(error){if(error.name!=='AbortError')ctx.toast('Backup file could not be connected')}
  };

  ctx.writeLiveBackup=async(requestPermission=false)=>{
    if(!ctx.liveBackupHandle)return false;
    try{
      let permission=await ctx.liveBackupHandle.queryPermission({mode:'readwrite'});
      if(permission!=='granted'&&requestPermission)permission=await ctx.liveBackupHandle.requestPermission({mode:'readwrite'});
      if(permission!=='granted')return false;
      const writable=await ctx.liveBackupHandle.createWritable();
      await writable.write(JSON.stringify(ctx.currentBackup(),null,2));
      await writable.close();
      localStorage.setItem(ctx.KEYS.backupMeta,JSON.stringify({name:ctx.liveBackupHandle.name,updatedAt:Date.now()}));
      ctx.renderBackupStatus();return true;
    }catch(error){console.warn('[Pacefold] live backup failed',error);return false}
  };

  ctx.scheduleLiveBackup=()=>{
    if(!ctx.liveBackupHandle)return;
    clearTimeout(ctx.backupTimer);
    ctx.backupTimer=setTimeout(()=>void ctx.writeLiveBackup(false),900);
  };

  ctx.renderBackupStatus=()=>{
    const meta=ctx.safeGet(ctx.KEYS.backupMeta,null);
    id('backup-status').textContent=ctx.liveBackupHandle
      ?`Live backup · ${ctx.liveBackupHandle.name}${meta?.updatedAt?` · updated ${new Date(meta.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`:''}`
      :'Local browser storage is active. Connect a file if you want a second copy updated after changes.';
  };

  ctx.noiseBuffer=(context,choice)=>{
    const length=Math.floor(context.sampleRate*8);
    const buffer=context.createBuffer(1,length,context.sampleRate);
    const data=buffer.getChannelData(0);
    let brown=0;
    for(let index=0;index<length;index+=1){
      const white=Math.random()*2-1;
      if(choice==='brown'){brown=(brown+.035*white)/1.035;data[index]=brown*3.2}
      else if(choice==='rain')data[index]=white*.2+(Math.random()<.0008?white*.8:0);
      else data[index]=white*.14+Math.sin(index/context.sampleRate*Math.PI*2*58)*.016;
    }
    return buffer;
  };

  ctx.startSound=async()=>{
    try{
      ctx.stopSound(false);
      const choice=ctx.prefs.soundChoice;
      if(choice==='local'){
        if(!ctx.localAudioUrl){id('audio-file-input').click();return}
        const audio=id('audio-player');audio.src=ctx.localAudioUrl;audio.loop=true;audio.volume=ctx.prefs.soundVolume;await audio.play();
      }else{
        const Context=window.AudioContext||window.webkitAudioContext;
        ctx.audioContext=new Context();
        ctx.audioGain=ctx.audioContext.createGain();
        ctx.audioGain.gain.value=ctx.prefs.soundVolume;
        const filter=ctx.audioContext.createBiquadFilter();
        filter.type='lowpass';filter.frequency.value=choice==='rain'?3600:choice==='fan'?1100:720;
        ctx.audioSource=ctx.audioContext.createBufferSource();
        ctx.audioSource.buffer=ctx.noiseBuffer(ctx.audioContext,choice);ctx.audioSource.loop=true;
        ctx.audioSource.connect(filter).connect(ctx.audioGain).connect(ctx.audioContext.destination);ctx.audioSource.start();
      }
      ctx.soundPlaying=true;ctx.renderSound();
    }catch(error){console.warn(error);ctx.stopSound();ctx.toast('Focus sound could not start')}
  };

  ctx.stopSound=(render=true)=>{
    try{ctx.audioSource?.stop()}catch{}
    ctx.audioSource=null;
    if(ctx.audioContext){ctx.audioContext.close().catch(()=>{});ctx.audioContext=null}
    const audio=id('audio-player');audio.pause();audio.removeAttribute('src');audio.load();
    ctx.soundPlaying=false;if(render)ctx.renderSound();
  };

  ctx.renderSound=()=>{
    const names={brown:'Brown hush',rain:'Rain glass',fan:'Soft fan',local:ctx.prefs.soundLabel||'Local audio'};
    id('sound-bar').dataset.playing=String(ctx.soundPlaying);
    id('sound-toggle').textContent=ctx.soundPlaying?'Ⅱ':'▶';
    id('sound-toggle').setAttribute('aria-label',ctx.soundPlaying?'Pause focus sound':'Play focus sound');
    id('sound-name').textContent=names[ctx.prefs.soundChoice]||'Brown hush';
    id('sound-choice').value=ctx.prefs.soundChoice;
    id('sound-volume').value=String(ctx.prefs.soundVolume);
  };

  ctx.clearAllNotifications=async()=>{
    try{
      const registration=await navigator.serviceWorker?.ready;
      const items=await registration?.getNotifications?.();
      items?.forEach(item=>item.close());
      navigator.clearAppBadge?.();
    }catch{}
  };

  ctx.initOneNote=async()=>{
    if(!ctx.prefs.oneNoteClientId||!window.msal)throw new Error(window.msal?'Enter an Entra application ID':'Microsoft sign-in runtime is unavailable');
    const stamp=`${ctx.prefs.oneNoteClientId}:${ctx.prefs.oneNoteTenant}`;
    if(ctx.oneNoteClient?.__stamp===stamp)return ctx.oneNoteClient;
    const client=new window.msal.PublicClientApplication({
      auth:{clientId:ctx.prefs.oneNoteClientId,authority:`https://login.microsoftonline.com/${ctx.prefs.oneNoteTenant||'organizations'}`,redirectUri:new URL('./auth.html',location.href).href},
      cache:{cacheLocation:'sessionStorage',storeAuthStateInCookie:false}
    });
    await client.initialize();client.__stamp=stamp;
    const account=client.getAllAccounts()[0];if(account)client.setActiveAccount(account);
    ctx.oneNoteClient=client;return client;
  };

  ctx.oneNoteToken=async(interactive=false)=>{
    const client=await ctx.initOneNote();
    let account=client.getActiveAccount()||client.getAllAccounts()[0];
    if(!account){
      if(!interactive)throw new Error('Microsoft sign-in required');
      const login=await client.loginPopup({scopes:['Notes.ReadWrite'],redirectUri:new URL('./auth.html',location.href).href,prompt:'select_account'});
      account=login.account;client.setActiveAccount(account);if(login.accessToken)return login.accessToken;
    }
    try{return(await client.acquireTokenSilent({scopes:['Notes.ReadWrite'],account})).accessToken}
    catch{
      if(!interactive)throw new Error('Microsoft sign-in required');
      return(await client.acquireTokenPopup({scopes:['Notes.ReadWrite'],account,redirectUri:new URL('./auth.html',location.href).href})).accessToken;
    }
  };

  ctx.graph=async(path,options={},interactive=false,token='')=>{
    const accessToken=token||await ctx.oneNoteToken(interactive);
    const response=await fetch(`https://graph.microsoft.com/v1.0${path}`,{
      ...options,headers:{Authorization:`Bearer ${accessToken}`,...(options.headers||{})}
    });
    if(response.ok)return response;
    let message='';try{message=(await response.json())?.error?.message}catch{}
    const error=new Error(message||`Microsoft Graph ${response.status}`);error.status=response.status;throw error;
  };

  ctx.connectOneNote=async()=>{
    const clientId=id('onenote-client-input').value.trim();
    const tenant=id('onenote-tenant-input').value.trim()||'organizations';
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)){ctx.toast('Enter a valid Entra application ID');return}
    ctx.storePrefs({oneNoteClientId:clientId,oneNoteTenant:tenant,oneNoteLastError:''},'onenote-config');ctx.oneNoteClient=null;
    try{
      const token=await ctx.oneNoteToken(true);
      const response=await ctx.graph('/me/onenote/notebooks?$select=id,displayName,isDefault&$top=100',{},false,token);
      const data=await response.json();ctx.oneNoteCatalog=data.value||[];ctx.oneNotePickerMode='notebooks';ctx.renderOneNotePicker();
    }catch(error){
      ctx.storePrefs({oneNoteLastError:ctx.cleanText(error.message,180)},'onenote-error');ctx.renderSettings();
      ctx.toast(error.status===403?'Your Microsoft policy blocked OneNote access':'OneNote sign-in did not complete');
    }
  };

  ctx.renderOneNotePicker=()=>{
    const root=id('onenote-picker');root.replaceChildren();
    for(const item of ctx.oneNoteCatalog){const node=button('',`Choose ${item.displayName}`,item.displayName);node.dataset.onenoteId=item.id;root.append(node)}
  };

  ctx.chooseOneNoteItem=async item=>{
    try{
      if(ctx.oneNotePickerMode==='notebooks'){
        ctx.storePrefs({oneNoteNotebookId:item.id,oneNoteNotebookName:item.displayName},'onenote-notebook');
        const response=await ctx.graph(`/me/onenote/notebooks/${encodeURIComponent(item.id)}/sections?$select=id,displayName&$top=100`,{},true);
        const data=await response.json();ctx.oneNoteCatalog=data.value||[];ctx.oneNotePickerMode='sections';ctx.renderOneNotePicker();ctx.toast('Choose a OneNote section');
      }else{
        ctx.storePrefs({oneNoteSectionId:item.id,oneNoteSectionName:item.displayName,oneNoteLastError:''},'onenote-section');
        ctx.oneNoteCatalog=[];ctx.oneNotePickerMode='';ctx.renderOneNotePicker();ctx.renderSettings();ctx.toast(`OneNote destination · ${item.displayName}`);void ctx.syncOneNote(true);
      }
    }catch(error){ctx.toast(error.message||'OneNote could not load that item')}
  };

  ctx.escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  ctx.oneNoteTitle=key=>`Pacefold — ${new Date(`${key}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}`;
  ctx.noteMarkup=note=>`<p data-id="pacefold-${ctx.escapeHtml(note.id)}"><b>${ctx.escapeHtml(note.category)} · ${ctx.escapeHtml(new Date(note.createdAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}))}</b><br />${ctx.escapeHtml(note.body).replace(/\n/g,'<br />')}</p>`;

  ctx.pageForDate=async(key,note,token)=>{
    let pageId=ctx.prefs.oneNotePages?.[key];if(pageId)return pageId;
    const title=ctx.oneNoteTitle(key);
    const query=new URLSearchParams({'$filter':`title eq '${title.replace(/'/g,"''")}'`,'$select':'id,title','$top':'5'});
    const found=await(await ctx.graph(`/me/onenote/sections/${encodeURIComponent(ctx.prefs.oneNoteSectionId)}/pages?${query}`,{},false,token)).json();
    const page=found.value?.find(item=>item.title===title);
    if(page?.id)pageId=page.id;
    else{
      const html=`<!doctype html><html><head><title>${ctx.escapeHtml(title)}</title></head><body><p><i>Copied from Pacefold. The local notebook remains the source of truth.</i></p><div data-id="pacefold-notes">${ctx.noteMarkup(note)}</div></body></html>`;
      const response=await ctx.graph(`/me/onenote/sections/${encodeURIComponent(ctx.prefs.oneNoteSectionId)}/pages`,{method:'POST',headers:{'Content-Type':'text/html; charset=utf-8','Accept':'application/json'},body:html},false,token);
      pageId=(await response.json()).id;note.syncedAt=Date.now();
    }
    ctx.storePrefs({oneNotePages:{...(ctx.prefs.oneNotePages||{}),[key]:pageId}},'onenote-page');
    return pageId;
  };

  ctx.syncOneNote=async(interactive=false)=>{
    if(!ctx.prefs.oneNoteClientId||!ctx.prefs.oneNoteSectionId)return false;
    const pending=ctx.notes.filter(note=>!note.syncedAt);
    if(!pending.length){if(interactive)ctx.toast('OneNote is already up to date');return true}
    try{
      const token=await ctx.oneNoteToken(interactive);
      for(const note of pending){
        const pageId=await ctx.pageForDate(note.date,note,token);if(note.syncedAt)continue;
        const content=await(await ctx.graph(`/me/onenote/pages/${encodeURIComponent(pageId)}/content?includeIDs=true`,{headers:{Accept:'text/html'}},false,token)).text();
        if(!content.includes(`pacefold-${note.id}`))await ctx.graph(`/me/onenote/pages/${encodeURIComponent(pageId)}/content`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify([{target:'#pacefold-notes',action:'append',content:ctx.noteMarkup(note)}])},false,token);
        note.syncedAt=Date.now();note.syncError='';
      }
      ctx.storeNotes('onenote-sync');ctx.storePrefs({oneNoteLastSync:Date.now(),oneNoteLastError:''},'onenote-sync');ctx.renderSettings();
      if(interactive)ctx.toast(`${pending.length} note${pending.length===1?'':'s'} copied to OneNote`);return true;
    }catch(error){
      for(const note of pending)note.syncError=ctx.cleanText(error.message,160);
      ctx.storeNotes('onenote-error');ctx.storePrefs({oneNoteLastError:ctx.cleanText(error.message,180)},'onenote-error');ctx.renderSettings();
      if(interactive)ctx.toast(error.message||'OneNote sync paused');return false;
    }
  };

  ctx.disconnectOneNote=async()=>{
    try{const client=await ctx.initOneNote(),account=client.getActiveAccount()||client.getAllAccounts()[0];if(account)await client.clearCache({account})}catch{}
    ctx.oneNoteClient=null;
    ctx.storePrefs({oneNoteNotebookId:'',oneNoteNotebookName:'',oneNoteSectionId:'',oneNoteSectionName:'',oneNotePages:{},oneNoteLastSync:0,oneNoteLastError:''},'onenote-disconnect');
    ctx.renderSettings();ctx.toast('OneNote disconnected · local notes kept');
  };

  ctx.registerWorker=async()=>{
    if(!('serviceWorker'in navigator)||location.protocol==='file:')return;
    try{
      const registration=await navigator.serviceWorker.register('../service-worker.js',{scope:'../'});
      registration.update().catch(()=>{});
      if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
    }catch(error){console.warn('[Pacefold] offline worker unavailable',error)}
  };
}
