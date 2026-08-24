import{id,el,button}from'./state.js';

const STORE='pacefold.stream.v1';
const stateName=value=>({[-1]:'idle',[0]:'ended',[1]:'playing',[2]:'paused',[3]:'buffering',[5]:'ready'}[Number(value)]||'idle');
const readState=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch{return{}}};
const writeState=patch=>{try{localStorage.setItem(STORE,JSON.stringify({...readState(),...patch}))}catch{}};
const videoIdFrom=value=>String(value||'').match(/\/vi\/([A-Za-z0-9_-]{11})\//)?.[1]||'';
const hueFrom=value=>{let hash=0;for(const char of String(value||'music'))hash=(hash*31+char.charCodeAt(0))>>>0;return 150+(hash%155)};

export function installMusicMagicR8(ctx){
  const shell=id('stream-player'),sound=id('sound-bar'),stage=id('music-room-stage'),cover=id('music-room-cover');
  if(!shell||!sound||shell.dataset.magicR8==='true')return;
  shell.dataset.magicR8='true';shell.dataset.transport='idle';shell.dataset.intermission='false';

  const aura=el('div','music-magic-aura');aura.setAttribute('aria-hidden','true');
  const stars=el('div','music-magic-stars');for(let i=0;i<18;i++)stars.append(el('i'));aura.append(stars);shell.prepend(aura);
  const eq=el('div','music-magic-eq');eq.setAttribute('aria-hidden','true');for(let i=0;i<14;i++)eq.append(el('i'));
  const status=el('div','music-magic-status');status.append(el('i'),el('span','','Ready'));
  const stageCopy=stage?.querySelector('.music-room-stage-copy');stageCopy?.append(eq,status);

  const links=shell.querySelector('.music-room-links');
  const intermission=button('music-intermission-toggle','Play local intermission music','Intermission');intermission.id='music-intermission-toggle';intermission.title='Local lounge filler for playback errors or a manual pause. It does not modify YouTube ads.';intermission.setAttribute('aria-pressed','false');links?.insertBefore(intermission,id('music-room-close'));

  let activePlayer=null,wrapped=false,readyHooked=false,primeSeen=false,audioContext=null,master=null,phraseTimer=0,phraseStep=0,autoTimer=0,autoStopTimer=0;
  const label=status.querySelector('span');
  const setStatus=(text,kind='ready')=>{label.textContent=text;status.dataset.state=kind};
  const syncIntermissionButton=()=>{const on=shell.dataset.intermission==='true';intermission.setAttribute('aria-pressed',String(on));intermission.textContent=on?'Stop intermission':'Intermission'};

  const ensureAudio=()=>{
    if(audioContext&&audioContext.state!=='closed')return audioContext;
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return null;
    audioContext=new Audio();master=audioContext.createGain();master.gain.value=0;master.connect(audioContext.destination);return audioContext;
  };
  const primeAudio=async()=>{primeSeen=true;const audio=ensureAudio();if(!audio)return false;try{await audio.resume();master.gain.setTargetAtTime?.(0,audio.currentTime,.02);return true}catch{return false}};
  const tone=(frequency,delay,duration,level,type='sine')=>{
    const audio=audioContext;if(!audio||!master)return;const start=audio.currentTime+delay,osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime?.(frequency,start);gain.gain.setValueAtTime?.(.0001,start);gain.gain.exponentialRampToValueAtTime?.(Math.max(.0002,level),start+.16);gain.gain.exponentialRampToValueAtTime?.(.0001,start+duration);osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(start+duration+.05)
  };
  const phrase=()=>{const chords=[[130.81,164.81,196],[146.83,174.61,220],[123.47,155.56,196],[130.81,164.81,207.65]],chord=chords[phraseStep++%chords.length];chord.forEach((freq,index)=>tone(freq,index*.055,2.25,.014,index?'triangle':'sine'));tone(chord[0]*2,.34,1.25,.008,'sine')};
  const stopIntermission=()=>{clearInterval(phraseTimer);clearTimeout(autoStopTimer);phraseTimer=0;if(master&&audioContext){try{master.gain.cancelScheduledValues?.(audioContext.currentTime);master.gain.setTargetAtTime?.(0,audioContext.currentTime,.08)}catch{}}shell.dataset.intermission='false';syncIntermissionButton();if(shell.dataset.transport==='playing')setStatus('Playing','playing')};
  const startIntermission=async(reason='manual')=>{
    if(reason==='auto'&&(!primeSeen||ctx.soundPlaying))return false;
    if(!await primeAudio())return false;clearInterval(phraseTimer);clearTimeout(autoStopTimer);try{master.gain.setTargetAtTime?.(.72,audioContext.currentTime,.08)}catch{}phrase();phraseTimer=setInterval(phrase,2600);shell.dataset.intermission='true';syncIntermissionButton();setStatus(reason==='auto'?'Stream unavailable · local intermission':'Local intermission','intermission');if(reason==='auto')autoStopTimer=setTimeout(stopIntermission,30000);return true
  };
  intermission.addEventListener('click',async()=>{if(shell.dataset.intermission==='true')stopIntermission();else await startIntermission('manual')});
  sound.addEventListener('pointerdown',()=>{void primeAudio()},{capture:true,passive:true});

  const syncMeta=()=>{
    const title=shell.querySelector('.stream-title')?.textContent?.trim()||'',author=shell.querySelector('.stream-author')?.textContent?.trim()||'';
    if(stageCopy){const kicker=stageCopy.querySelector('small'),hero=stageCopy.querySelector('strong'),copy=stageCopy.querySelector('p');const useful=title&&!/^(Pick something|Loading|Player unavailable|This item cannot)/i.test(title);if(kicker)kicker.textContent=useful?'NOW PLAYING':'READY WHEN YOU ARE';if(hero)hero.textContent=useful?title:'Your music, without another dashboard';if(copy)copy.textContent=useful?(author||'YouTube Music'):'Paste a song or playlist once, then keep playback, saved music and focus sound in one quiet room.'}
    if(title)shell.dataset.trackTitle=title.slice(0,80)
  };
  const syncArtwork=()=>{
    const src=cover?.getAttribute('src')||'',videoId=videoIdFrom(src),hue=hueFrom(videoId||shell.dataset.trackTitle||'music');shell.style.setProperty('--music-hue',String(hue));shell.style.setProperty('--music-hue-2',String((hue+58)%360));if(src)shell.style.setProperty('--music-art-image',`url("${src.replaceAll('"','%22')}")`);else shell.style.removeProperty('--music-art-image');syncMeta()
  };

  const art=stage?.querySelector('.music-room-art');
  art?.addEventListener('pointermove',event=>{if(window.matchMedia('(pointer:fine)').matches){const box=art.getBoundingClientRect(),x=(event.clientX-box.left)/box.width-.5,y=(event.clientY-box.top)/box.height-.5;art.style.setProperty('--music-rx',`${(-y*5).toFixed(2)}deg`);art.style.setProperty('--music-ry',`${(x*6).toFixed(2)}deg`)}});
  art?.addEventListener('pointerleave',()=>{art.style.setProperty('--music-rx','0deg');art.style.setProperty('--music-ry','0deg')});

  const enhanceQueue=()=>{const queue=id('stream-queue-grid'),playlist=activePlayer?.getPlaylist?.()||[];if(!queue)return;for(const row of queue.querySelectorAll('.stream-track')){const index=Number(row.dataset.index)||0,videoId=playlist[index];if(!/^[A-Za-z0-9_-]{11}$/.test(String(videoId||''))||row.querySelector('.music-track-art'))continue;const image=el('img','music-track-art');image.alt='';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';image.src=`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;row.prepend(image)}};
  const queue=id('stream-queue-grid');if(queue)new MutationObserver(enhanceQueue).observe(queue,{childList:true,subtree:false});
  if(cover)new MutationObserver(syncArtwork).observe(cover,{attributes:true,attributeFilter:['src']});
  const meta=shell.querySelector('.stream-meta');if(meta)new MutationObserver(syncMeta).observe(meta,{childList:true,subtree:true,characterData:true});

  const updateTransport=value=>{
    clearTimeout(autoTimer);const transport=typeof value==='string'?value:stateName(value);shell.dataset.transport=transport;
    if(transport==='playing'){stopIntermission();setStatus('Playing','playing')}
    else if(transport==='paused')setStatus('Paused','paused');
    else if(transport==='buffering'){stopIntermission();setStatus('Buffering…','buffering')}
    else if(transport==='ended'){stopIntermission();setStatus('Finished','ended')}
    else if(transport==='error'){setStatus('Playback unavailable','error');autoTimer=setTimeout(()=>void startIntermission('auto'),1100)}
    else setStatus('Ready','ready');
  };

  // Deliberately do not inspect, skip, mute or cover advertising. This wrapper only
  // mirrors official player states and starts local filler after explicit player errors.
  const wrapYT=()=>{
    const yt=window.YT,Original=yt?.Player;if(!Original||Original.__clockMusicMagicR8)return Boolean(Original?.__clockMusicMagicR8);
    try{
      function MagicPlayer(node,options={}){const events={...(options.events||{})},baseReady=events.onReady,baseState=events.onStateChange,baseError=events.onError,baseBlocked=events.onAutoplayBlocked;events.onReady=event=>{activePlayer=event?.target||activePlayer;updateTransport('ready');baseReady?.(event);setTimeout(enhanceQueue,0)};events.onStateChange=event=>{updateTransport(Number(event?.data));baseState?.(event);setTimeout(()=>{syncArtwork();enhanceQueue()},0)};events.onError=event=>{updateTransport('error');baseError?.(event)};events.onAutoplayBlocked=event=>{updateTransport('paused');baseBlocked?.(event)};const instance=new Original(node,{...options,events});activePlayer=instance;return instance}
      MagicPlayer.prototype=Original.prototype;try{Object.setPrototypeOf(MagicPlayer,Original)}catch{}MagicPlayer.__clockMusicMagicR8=true;MagicPlayer.__clockOriginal=Original;yt.Player=MagicPlayer;wrapped=true;return true
    }catch{return false}
  };
  const hookReady=()=>{
    if(readyHooked)return;readyHooked=true;wrapYT();
    try{const descriptor=Object.getOwnPropertyDescriptor(window,'onYouTubeIframeAPIReady');if(descriptor?.configurable===false)return;let callback=window.onYouTubeIframeAPIReady;Object.defineProperty(window,'onYouTubeIframeAPIReady',{configurable:true,enumerable:true,get(){return callback},set(fn){callback=typeof fn==='function'?function(...args){wrapYT();return fn.apply(this,args)}:fn}})}catch{}
    let attempts=0;const timer=setInterval(()=>{attempts++;if(wrapYT()||attempts>400)clearInterval(timer)},50)
  };
  hookReady();syncArtwork();syncMeta();syncIntermissionButton();
  ctx.musicMagic={startIntermission,stopIntermission,transport:()=>shell.dataset.transport,wrapped:()=>wrapped,player:()=>activePlayer};
}
