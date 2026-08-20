export function installMusicMagicR8Queue(ctx){
  const grid=document.querySelector('.stream-queue-grid');if(!grid||grid.dataset.magicQueue==='true')return;grid.dataset.magicQueue='true';
  const enhance=()=>{
    const player=ctx.musicMagic?.player?.(),playlist=player?.getPlaylist?.()||[];
    for(const row of grid.querySelectorAll('.stream-track')){
      if(row.querySelector('.music-track-art'))continue;const index=Math.max(0,Number(row.dataset.index)||0),videoId=String(playlist[index]||'');if(!/^[A-Za-z0-9_-]{11}$/.test(videoId))continue;
      const image=document.createElement('img');image.className='music-track-art';image.alt='';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';image.src=`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;row.prepend(image)
    }
  };
  new MutationObserver(()=>queueMicrotask(enhance)).observe(grid,{childList:true});
  document.getElementById('stream-queue-toggle')?.addEventListener('click',()=>{queueMicrotask(enhance);setTimeout(enhance,40);setTimeout(enhance,180)},{capture:true});
  document.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('.stream-track'))setTimeout(enhance,20)},{capture:true});
  ctx.enhanceMusicQueue=enhance;enhance();
}
