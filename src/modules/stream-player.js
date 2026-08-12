import{id,el,button}from'./state.js';

const STORE='pacefold.stream.v1';
const YT_API='https://www.youtube.com/iframe_api';

function readSaved(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch{return{}}}
function saveSaved(value){try{localStorage.setItem(STORE,JSON.stringify(value))}catch{}}
function mediaFrom(value){
  const raw=String(value||'').trim();if(!raw)return null;
  if(/^[A-Za-z0-9_-]{11}$/.test(raw))return{videoId:raw,listId:'',url:`https://www.youtube.com/watch?v=${raw}`};
  let url;try{url=new URL(raw)}catch{return null}
  const host=url.hostname.replace(/^www\./,'').toLowerCase();if(!['youtube.com','music.youtube.com','youtu.be'].includes(host))return null;
  let videoId='',listId=url.searchParams.get('list')||'';
  if(host==='youtu.be')videoId=url.pathname.split('/').filter(Boolean)[0]||'';
  else{videoId=url.searchParams.get('v')||'';const parts=url.pathname.split('/').filter(Boolean);if(!videoId&&['shorts','embed','live'].includes(parts[0]))videoId=parts[1]||''}
  if(videoId&&!/^[A-Za-z0-9_-]{11}$/.test(videoId))videoId='';if(listId&&!/^[A-Za-z0-9_-]{6,}$/.test(listId))listId='';if(!videoId&&!listId)return null;
  return{videoId,listId,url:url.href};
}
function timeText(seconds){const total=Math.max(0,Math.floor(Number(seconds)||0)),minutes=Math.floor(total/60),rest=String(total%60).padStart(2,'0');return`${minutes}:${rest}`}

let ytPromise;
function loadYouTube(){
  if(window.YT?.Player)return Promise.resolve(window.YT);if(ytPromise)return ytPromise;
  ytPromise=new Promise((resolve,reject)=>{
    const previous=window.onYouTubeIframeAPIReady;let settled=false;
    const done=()=>{if(settled)return;settled=true;if(window.YT?.Player)resolve(window.YT);else reject(new Error('YouTube player API unavailable'))};
    window.onYouTubeIframeAPIReady=()=>{try{previous?.()}finally{done()}};
    let script=document.querySelector('script[data-pacefold-youtube]');if(!script){script=document.createElement('script');script.src=YT_API;script.async=true;script.dataset.pacefoldYoutube='true';document.head.append(script)}
    script.addEventListener('error',()=>{if(!settled){settled=true;reject(new Error('Could not load YouTube player'))}},{once:true});setTimeout(()=>{if(!settled){settled=true;reject(new Error('YouTube player timed out'))}},12000);
  });return ytPromise;
}

export function installStreamPlayer(ctx){
  const sound=id('sound-bar');if(!sound||id('stream-player'))return;
  sound.dataset.streaming='player';sound.setAttribute('aria-label','Streaming music player');for(const child of[...sound.children])child.hidden=true;

  const shell=el('section','stream-player');shell.id='stream-player';shell.dataset.state='empty';
  const video=el('div','stream-video');video.id='stream-video';video.hidden=true;
  let mount=el('div','stream-video-mount');mount.id='stream-youtube';const videoClose=button('stream-video-close','Pause and collapse video','×');video.append(mount,videoClose);
  const dock=el('div','stream-dock');
  const source=button('stream-source','Choose YouTube or YouTube Music link');source.id='stream-source';source.append(el('i'),el('span','','Music'));
  const meta=el('div','stream-meta');meta.append(el('strong','stream-title','Add something to play'),el('small','stream-author','YouTube · YouTube Music'));
  const previous=button('stream-control','Previous','‹');previous.id='stream-previous';const play=button('stream-control stream-play','Play','▶');play.id='stream-play';const next=button('stream-control','Next','›');next.id='stream-next';const controls=el('div','stream-controls');controls.append(previous,play,next);
  const timeline=el('div','stream-timeline'),current=el('small','stream-current','0:00'),seek=el('input','stream-seek'),duration=el('small','stream-duration','0:00');seek.id='stream-seek';seek.type='range';seek.min='0';seek.max='1000';seek.value='0';seek.step='1';seek.setAttribute('aria-label','Track position');timeline.append(current,seek,duration);
  const volumeWrap=el('label','stream-volume');volumeWrap.title='Volume';volumeWrap.append(el('span','','⌁'));const volume=el('input');volume.id='stream-volume';volume.type='range';volume.min='0';volume.max='100';volume.step='1';volume.setAttribute('aria-label','Volume');volumeWrap.append(volume);
  const videoToggle=button('stream-video-toggle','Show video','▣');videoToggle.id='stream-video-toggle';dock.append(source,meta,controls,timeline,volumeWrap,videoToggle);
  const chooser=el('form','stream-chooser');chooser.id='stream-chooser';chooser.hidden=true;const input=el('input');input.id='stream-url';input.type='text';input.inputMode='url';input.autocomplete='off';input.placeholder='Paste a YouTube or YouTube Music link';input.setAttribute('aria-label','YouTube or YouTube Music link');const cancel=button('','Close music link','Cancel'),load=button('primary','Load music','Load');load.type='submit';chooser.append(input,cancel,load);
  shell.append(video,dock,chooser);sound.append(shell);

  let player=null,ready=false,currentMedia=null,progressTimer=0,lastPersist=0;
  const saved=readSaved(),savedVolume=Number(saved.volume);volume.value=String(Math.round((Number.isFinite(savedVolume)?Math.max(0,Math.min(1,savedVolume)):.35)*100));
  const title=shell.querySelector('.stream-title'),author=shell.querySelector('.stream-author');
  const persist=()=>{const position=ready&&player?.getCurrentTime?Number(player.getCurrentTime())||0:Number(saved.time)||0;const data={url:currentMedia?.url||saved.url||'',volume:Number(volume.value)/100,time:position,title:title.textContent||'',author:author.textContent||''};saveSaved(data);Object.assign(saved,data)};
  const setVideo=open=>{video.hidden=!open;shell.dataset.video=open?'open':'closed';videoToggle.setAttribute('aria-pressed',String(open))};
  const setPlaying=playing=>{shell.dataset.playing=String(playing);play.textContent=playing?'Ⅱ':'▶';play.setAttribute('aria-label',playing?'Pause':'Play')};
  const ensureMount=()=>{let node=id('stream-youtube');if(!node){node=el('div','stream-video-mount');node.id='stream-youtube';video.prepend(node)}mount=node;return node};
  const updateMeta=()=>{if(!ready||!player)return;const data=player.getVideoData?.()||{};if(data.title)title.textContent=data.title;if(data.author)author.textContent=data.author;shell.dataset.state=data.video_id?'ready':shell.dataset.state;persist()};
  const updateProgress=()=>{if(!ready||!player)return;const now=Number(player.getCurrentTime?.())||0,total=Number(player.getDuration?.())||0;current.textContent=timeText(now);duration.textContent=timeText(total);seek.value=String(total?Math.round(now/total*1000):0);if(Date.now()-lastPersist>4000){lastPersist=Date.now();persist()}};
  const startProgress=()=>{clearInterval(progressTimer);progressTimer=setInterval(updateProgress,500);updateProgress()};
  const destroyPlayer=()=>{clearInterval(progressTimer);progressTimer=0;try{player?.destroy?.()}catch{}player=null;ready=false;ensureMount()};

  const createPlayer=async(media,{resume=false,autoplay=false}={})=>{
    currentMedia=media;shell.dataset.state='loading';title.textContent='Loading…';author.textContent=media.listId?'YouTube playlist':'YouTube';setVideo(true);destroyPlayer();
    try{
      const YT=await loadYouTube(),playerVars={playsinline:1,controls:1,rel:0,enablejsapi:1,origin:location.origin};if(media.listId){playerVars.listType='playlist';playerVars.list=media.listId}
      player=new YT.Player(ensureMount(),{width:356,height:200,videoId:media.videoId||undefined,playerVars,events:{
        onReady:event=>{ready=true;event.target.setVolume?.(Number(volume.value));const at=resume?Number(saved.time)||0:0;if(at>1)event.target.seekTo?.(at,true);shell.dataset.state='ready';updateMeta();startProgress();if(autoplay)event.target.playVideo?.()},
        onStateChange:event=>{const state=Number(event.data);setPlaying(state===1);if(state===1)setVideo(true);updateMeta();updateProgress();if(state===0){saved.time=0;persist()}},
        onError:()=>{shell.dataset.state='error';title.textContent='This item cannot play here';author.textContent='Try another YouTube link';setPlaying(false)}
      }});
    }catch(error){shell.dataset.state='error';title.textContent='Player unavailable';author.textContent='Check the connection and try again';ctx.toast?.(error.message)}
  };

  source.addEventListener('click',()=>{chooser.hidden=!chooser.hidden;if(!chooser.hidden){input.value=currentMedia?.url||saved.url||'';requestAnimationFrame(()=>input.focus())}});cancel.addEventListener('click',()=>{chooser.hidden=true;source.focus()});
  chooser.addEventListener('submit',event=>{event.preventDefault();const media=mediaFrom(input.value);if(!media){ctx.toast?.('Paste a YouTube or YouTube Music link');return}chooser.hidden=true;saved.time=0;saveSaved({...saved,url:media.url,time:0});void createPlayer(media)});
  play.addEventListener('click',async()=>{if(!player){const media=mediaFrom(saved.url);if(!media){chooser.hidden=false;requestAnimationFrame(()=>input.focus());return}await createPlayer(media,{resume:true,autoplay:true});return}if(!ready)return;const state=Number(player.getPlayerState?.());if(state===1)player.pauseVideo?.();else{setVideo(true);player.playVideo?.()}});
  previous.addEventListener('click',()=>{if(ready){setVideo(true);player.previousVideo?.()}});next.addEventListener('click',()=>{if(ready){setVideo(true);player.nextVideo?.()}});
  seek.addEventListener('change',()=>{if(!ready)return;const total=Number(player.getDuration?.())||0;if(total)player.seekTo?.(total*Number(seek.value)/1000,true)});volume.addEventListener('input',()=>{if(ready)player.setVolume?.(Number(volume.value));persist()});
  videoToggle.addEventListener('click',()=>{if(!video.hidden){if(Number(player?.getPlayerState?.())===1)player.pauseVideo?.();setVideo(false)}else if(player)setVideo(true)});videoClose.addEventListener('click',()=>{if(Number(player?.getPlayerState?.())===1)player.pauseVideo?.();setVideo(false)});window.addEventListener('beforeunload',persist);
  if(saved.url&&mediaFrom(saved.url)){currentMedia=mediaFrom(saved.url);shell.dataset.state='saved';title.textContent=saved.title||'Ready to resume';author.textContent=saved.author||'YouTube · YouTube Music'}
  ctx.streamPlayer={parse:mediaFrom,load:createPlayer};
}
