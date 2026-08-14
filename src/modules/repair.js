import{id,el,button}from'./state.js';

const STREAM_STORE='pacefold.stream.v1';
const YTM='https://music.youtube.com/';

function safeSet(key,value){try{localStorage.setItem(key,value);return true}catch{return false}}
function readStream(){try{return JSON.parse(localStorage.getItem(STREAM_STORE)||'{}')||{}}catch{return{}}}

export function installRepair(ctx){
  // A returning install should never be forced through setup again just because an
  // old onboarding flag disappeared or a partial preferences object was migrated.
  const setup=id('setup-dialog');
  const established=Object.keys(ctx.rawPrefs||{}).length>0||ctx.notes.length>0||Object.keys(ctx.log?.days||{}).length>0||localStorage.getItem(ctx.KEYS.setupDismissed)==='1';
  if(established){safeSet(ctx.KEYS.onboarding,'1');safeSet(ctx.KEYS.setupDismissed,'1')}
  const rememberSetup=()=>{safeSet(ctx.KEYS.onboarding,'1');safeSet(ctx.KEYS.setupDismissed,'1')};
  setup?.addEventListener('close',rememberSetup);
  setup?.querySelector('.dialog-close')?.addEventListener('click',rememberSetup,{capture:true});
  id('setup-later')?.addEventListener('click',rememberSetup,{capture:true});

  // Keep the peel idea, but never make the entrance a guessing game.
  const cover=id('pace-cover');
  if(cover&&!id('cover-enter')){
    const enter=button('cover-enter','Open Pacefold');enter.id='cover-enter';
    enter.append(el('i'),el('span','','Open Pacefold'),el('b','','⌃'));
    enter.addEventListener('click',()=>ctx.setStartCover?.(false));
    cover.append(enter);
  }

  const sound=id('sound-bar'),player=id('stream-player'),appBar=document.querySelector('.app-bar');
  if(!sound||!player||!appBar)return;
  sound.dataset.musicOpen='false';

  const head=el('header','music-room-head');
  const identity=el('div','music-room-identity');identity.append(el('small','','PACEFOLD MUSIC'),el('strong','','Music'),el('p','','A full player for YouTube and YouTube Music links. Browse the service itself in its own tab, then keep playback and your saved library here.'));
  const links=el('nav','music-room-links');
  const browse=el('a','music-room-link music-room-browse','Browse YouTube Music ↗');browse.id='music-room-browse';browse.href=YTM;browse.target='_blank';browse.rel='noopener noreferrer';
  const current=el('a','music-room-link music-room-current','Open current ↗');current.id='music-room-current';current.target='_blank';current.rel='noopener noreferrer';current.hidden=true;
  const close=button('music-room-close','Close music player','×');close.id='music-room-close';
  links.append(browse,current,close);head.append(identity,links);player.prepend(head);

  const stage=el('section','music-room-stage');stage.id='music-room-stage';
  const art=el('div','music-room-art');art.append(el('i'),el('i'),el('i'));
  const stageCopy=el('div');stageCopy.append(el('small','','READY WHEN YOU ARE'),el('strong','','Bring a track or playlist into Pacefold'),el('p','','Use Browse YouTube Music for discovery, then paste a song or playlist link into My Music. Playback, queue, seek, volume, shuffle and loop stay inside Pacefold.'));
  stage.append(art,stageCopy);player.insertBefore(stage,id('stream-video'));

  const appOpen=button('music-open-button','Open full music player');appOpen.id='music-room-open';appOpen.append(el('i'),el('span','','Music'));
  const barStatus=document.querySelector('.bar-status');barStatus?.prepend(appOpen);

  let coverOpen=null;
  if(cover){coverOpen=button('cover-music-button','Open full music player');coverOpen.id='cover-music-open';coverOpen.append(el('i'),el('span','','Music'));cover.append(coverOpen)}

  const updateCurrent=()=>{
    const saved=readStream(),url=String(saved.url||'');
    if(/^https:\/\/(?:www\.)?(?:youtube\.com|music\.youtube\.com|youtu\.be)\//i.test(url)){
      current.href=url.replace(/^https:\/\/(?:www\.)?youtube\.com\//i,'https://music.youtube.com/');current.hidden=false;
    }else{current.removeAttribute('href');current.hidden=true}
  };
  const openMusic=({showChooser=true}={})=>{
    sound.dataset.musicOpen='true';document.documentElement.dataset.music='open';updateCurrent();
    if(showChooser){const chooser=id('stream-chooser'),queue=id('stream-queue');if(queue)queue.hidden=true;if(chooser)chooser.hidden=false}
    requestAnimationFrame(()=>close.focus({preventScroll:true}));
  };
  const closeMusic=()=>{
    sound.dataset.musicOpen='false';document.documentElement.dataset.music='closed';
    id('stream-chooser')?.setAttribute('hidden','');id('stream-queue')?.setAttribute('hidden','');
    (document.documentElement.dataset.cover==='on'?coverOpen:appOpen)?.focus({preventScroll:true});
  };

  appOpen.addEventListener('click',()=>openMusic({showChooser:true}));
  coverOpen?.addEventListener('click',()=>openMusic({showChooser:true}));
  close.addEventListener('click',closeMusic);
  id('stream-source')?.addEventListener('click',()=>openMusic({showChooser:false}),{capture:true});
  for(const selector of['#stream-add-form','.stream-library-list','#stream-previous','#stream-next','#stream-play'])document.querySelector(selector)?.addEventListener('click',()=>setTimeout(updateCurrent,450),{capture:true});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sound.dataset.musicOpen==='true'){event.preventDefault();closeMusic()}},{capture:true});

  ctx.openMusic=openMusic;ctx.closeMusic=closeMusic;
}
