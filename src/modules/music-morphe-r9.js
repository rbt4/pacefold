import{id,el,button}from'./state.js';

const CHANNEL='pacefold-morphe-r9';
const STORE='pacefold.morphe.r9';
const STREAM_STORE='pacefold.stream.v1';
const read=()=>{try{return{active:false,adShield:true,sponsorBlock:true,permanentRepeat:false,...JSON.parse(localStorage.getItem(STORE)||'{}')}}catch{return{active:false,adShield:true,sponsorBlock:true,permanentRepeat:false}}};
const write=patch=>{const next={...read(),...patch};try{localStorage.setItem(STORE,JSON.stringify(next))}catch{}return next};
const stream=()=>{try{return JSON.parse(localStorage.getItem(STREAM_STORE)||'{}')||{}}catch{return{}}};
const send=(type,payload={})=>window.postMessage({source:CHANNEL,direction:'to-extension',type,payload},location.origin);
const time=value=>{const total=Math.max(0,Math.floor(Number(value)||0));return`${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`};

export function installMusicMorpheR9(ctx){
  const shell=id('stream-player'),stage=id('music-room-stage'),stageCopy=stage?.querySelector('.music-room-stage-copy'),links=shell?.querySelector('.music-room-links');
  if(!shell||!stageCopy||shell.dataset.morpheR9==='true')return;
  shell.dataset.morpheR9='true';
  let prefs=read(),extensionReady=false,connected=false,lastState=null;

  const badge=button('music-morphe-badge','Toggle Morphe music bridge','Morphe · fallback');badge.id='music-morphe-badge';badge.setAttribute('aria-pressed',String(Boolean(prefs.active)));links?.insertBefore(badge,id('music-room-close'));
  const panel=el('section','music-morphe-panel');panel.id='music-morphe-panel';
  const top=el('div','music-morphe-top'),copy=el('span');copy.append(el('small','','SMART ENGINE'),el('strong','','Morphe bridge'),el('p','','Keep the Pacefold player, but hand playback to a privileged YouTube Music tab.'));
  const connect=button('music-morphe-connect','Connect Morphe music bridge',prefs.active?'Bridge on':'Use Morphe bridge');connect.id='music-morphe-connect';top.append(copy,connect);
  const controls=el('div','music-morphe-controls');
  const makeToggle=(key,label,detail)=>{const control=button('music-morphe-toggle',label);control.dataset.morpheToggle=key;const mark=el('i'),words=el('span');words.append(el('strong','',label),el('small','',detail));control.append(mark,words);control.setAttribute('aria-pressed',String(Boolean(prefs[key])));controls.append(control);return control};
  makeToggle('adShield','Ad Shield','Skip or suppress interruptions');
  makeToggle('sponsorBlock','SponsorBlock','Skip sponsor / non-music segments');
  makeToggle('permanentRepeat','Keep repeat','Repeat the current track');
  const foot=el('div','music-morphe-foot');foot.append(el('span','music-morphe-dot'),el('strong','music-morphe-state','Official player fallback'),el('small','music-morphe-detail','Install the companion extension for page-level control.'));
  panel.append(top,controls,foot);stageCopy.append(panel);
  const stateLabel=panel.querySelector('.music-morphe-state'),detail=panel.querySelector('.music-morphe-detail');

  const refresh=()=>{
    const active=Boolean(prefs.active&&extensionReady);
    shell.dataset.engine=active?'morphe':'youtube';
    badge.setAttribute('aria-pressed',String(active));badge.textContent=active?(connected?'Morphe · live':'Morphe · connecting'):'Morphe · fallback';
    connect.textContent=active?'Use official player':'Use Morphe bridge';
    for(const control of panel.querySelectorAll('[data-morphe-toggle]'))control.setAttribute('aria-pressed',String(Boolean(prefs[control.dataset.morpheToggle])));
    if(!extensionReady){stateLabel.textContent='Companion extension not detected';detail.textContent='The official YouTube player remains available.'}
    else if(active&&!connected){stateLabel.textContent='Opening YouTube Music engine';detail.textContent='Sign in once if YouTube Music asks.'}
    else if(active){stateLabel.textContent=lastState?.ad?'Ad interruption intercepted':'Morphe engine connected';detail.textContent=lastState?.title?`${lastState.title}${lastState.author?` · ${lastState.author}`:''}`:'Page-level playback control is active.'}
    else{stateLabel.textContent='Official player fallback';detail.textContent='Morphe is installed but not controlling this player.'}
  };

  const syncState=state=>{
    lastState=state;if(!prefs.active||!extensionReady)return;connected=state.connected!==false;shell.dataset.engine='morphe';shell.dataset.playing=String(Boolean(state.playing));shell.dataset.transport=state.ad?'ad':state.playing?'playing':'paused';
    const title=shell.querySelector('.stream-title'),author=shell.querySelector('.stream-author'),cover=id('music-room-cover'),play=id('stream-play'),seek=id('stream-seek'),current=shell.querySelector('.stream-current'),duration=shell.querySelector('.stream-duration'),volume=id('stream-volume'),video=id('stream-video');
    if(state.title&&title)title.textContent=state.title;if(state.author&&author)author.textContent=state.author;if(state.artwork&&cover){cover.src=state.artwork;cover.alt=state.title?`${state.title} artwork`:''}
    if(play){play.textContent=state.playing?'Ⅱ':'▶';play.setAttribute('aria-label',state.playing?'Pause':'Play')}
    if(current)current.textContent=time(state.currentTime);if(duration)duration.textContent=time(state.duration);if(seek&&state.duration>0)seek.value=String(Math.round((state.currentTime/state.duration)*1000));if(volume&&Number.isFinite(Number(state.volume)))volume.value=String(Math.round(Number(state.volume)*100));if(video)video.hidden=true;
    const magic=stageCopy.querySelector('.music-magic-status');if(magic){const label=magic.querySelector('span');magic.dataset.state=state.ad?'intermission':state.playing?'playing':'paused';if(label)label.textContent=state.ad?'Skipping interruption':state.playing?'Playing · Morphe':'Paused · Morphe'}
    refresh();
  };

  const settings=()=>({adShield:Boolean(prefs.adShield),sponsorBlock:Boolean(prefs.sponsorBlock),permanentRepeat:Boolean(prefs.permanentRepeat)});
  const connectBridge=(activate=true)=>{prefs=write({active:activate});refresh();if(activate&&extensionReady)send('bridge:connect',{activate:true,settings:settings()})};
  connect.addEventListener('click',()=>connectBridge(!prefs.active));badge.addEventListener('click',()=>connectBridge(!prefs.active));
  panel.addEventListener('click',event=>{const control=event.target instanceof Element?event.target.closest('[data-morphe-toggle]'):null;if(!control)return;const key=control.dataset.morpheToggle;prefs=write({[key]:!prefs[key]});control.setAttribute('aria-pressed',String(Boolean(prefs[key])));if(extensionReady)send('bridge:command',{command:key,value:Boolean(prefs[key])});refresh()});

  window.addEventListener('message',event=>{
    const message=event.data;if(event.source!==window||!message||message.source!==CHANNEL||message.direction!=='to-page')return;
    if(message.type==='bridge:ready'){extensionReady=true;refresh();if(prefs.active)send('bridge:connect',{activate:false,settings:settings()})}
    else if(message.type==='bridge:connection'){extensionReady=true;connected=Boolean(message.payload?.connected);refresh()}
    else if(message.type==='bridge:response'){const request=message.payload?.requestType,response=message.payload?.response||{};if(request==='bridge:hello'||request==='bridge:connect'){extensionReady=true;connected=Boolean(response.connected);refresh();if(request==='bridge:hello'&&prefs.active)send('bridge:connect',{activate:false,settings:settings()})}}
    else if(message.type==='bridge:state'){extensionReady=true;connected=true;syncState(message.payload||{})}
    else if(message.type==='bridge:error'){connected=false;refresh();ctx.toast?.(message.payload?.message||'Music bridge unavailable')}
  });

  document.addEventListener('click',event=>{
    if(!prefs.active||!extensionReady)return;const target=event.target instanceof Element?event.target.closest('button'):null;if(!target)return;let command='';
    if(target.id==='stream-play')command='toggle';else if(target.id==='stream-previous')command='previous';else if(target.id==='stream-next')command='next';else if(target.id==='stream-video-toggle'||target.id==='stream-video-close'){event.preventDefault();event.stopImmediatePropagation();send('bridge:focus');return}
    else if(target.id==='stream-loop'){prefs=write({permanentRepeat:!prefs.permanentRepeat});target.setAttribute('aria-pressed',String(Boolean(prefs.permanentRepeat)));command='permanentRepeat'}
    else if(target.id==='stream-shuffle')command='shuffle';
    else if(target.classList.contains('stream-library-pick')){const rows=[...document.querySelectorAll('.stream-library-row')],row=target.closest('.stream-library-row'),index=rows.indexOf(row),item=stream().library?.[index];if(item?.url){event.preventDefault();event.stopImmediatePropagation();send('bridge:command',{command:'loadUrl',value:item.url});id('stream-chooser').hidden=true;return}return}
    if(!command)return;event.preventDefault();event.stopImmediatePropagation();send('bridge:command',{command,value:command==='permanentRepeat'?Boolean(prefs.permanentRepeat):undefined});
  },true);

  id('stream-add-form')?.addEventListener('submit',event=>{if(!prefs.active||!extensionReady)return;const input=id('stream-url'),value=String(input?.value||'').trim();let url;try{url=new URL(value)}catch{}if(!url||!['youtube.com','www.youtube.com','music.youtube.com','youtu.be'].includes(url.hostname)){ctx.toast?.('Paste a valid YouTube or YouTube Music link');return}event.preventDefault();event.stopImmediatePropagation();send('bridge:command',{command:'loadUrl',value:url.href});id('stream-chooser').hidden=true},true);
  id('stream-volume')?.addEventListener('input',event=>{if(!prefs.active||!extensionReady)return;event.stopImmediatePropagation();send('bridge:command',{command:'volume',value:Number(event.target.value)/100})},true);
  id('stream-seek')?.addEventListener('change',event=>{if(!prefs.active||!extensionReady||!lastState?.duration)return;event.stopImmediatePropagation();send('bridge:command',{command:'seek',value:lastState.duration*Number(event.target.value)/1000})},true);

  refresh();
  send('bridge:hello',{});
  setTimeout(()=>{if(!extensionReady)refresh()},900);
  ctx.musicMorpheR9={active:()=>Boolean(prefs.active&&extensionReady),connected:()=>connected,state:()=>lastState,connect:()=>connectBridge(true)};
}
