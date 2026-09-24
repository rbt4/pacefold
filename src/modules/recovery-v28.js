import{$,$$,id}from'./state.js';
import{RELEASE}from'./release-meta.js';

const EXPERIENCE='v28-recovery-r1';
const DISPLAY_RELEASE=RELEASE;

export function installRecoveryV28(ctx){
  document.documentElement.dataset.recovery='v28';
  ctx.recoveryVersion=EXPERIENCE;

  const repairMusicLayout=()=>{
    const stage=id('music-room-stage'),panel=id('music-morphe-panel'),player=id('stream-player');
    if(player&&!player.style.getPropertyValue('--music-hue'))player.style.setProperty('--music-hue','184');
    // The optional Morphe bridge is an advanced engine choice, so it sits after the
    // everyday controls (paste a link, My music, focus sounds) instead of above them.
    if(player&&panel&&player.lastElementChild!==panel){
      player.append(panel);
      panel.dataset.recoveryLayout='end';
    }
  };

  const syncMobileNav=()=>{
    const nav=id('mobile-nav');if(!nav)return;
    for(const control of nav.querySelectorAll('[data-go]')){
      const active=control.dataset.go===ctx.mode;
      control.classList.toggle('active',active);
      if(active)control.setAttribute('aria-current','page');else control.removeAttribute('aria-current');
    }
  };

  const syncReleaseLabel=()=>{
    const version=$('.view-settings .view-head>b');
    if(version)version.textContent=`Pacefold ${DISPLAY_RELEASE}`;
  };

  const repair=()=>{repairMusicLayout();syncMobileNav();syncReleaseLabel()};

  const baseRender=ctx.render;
  ctx.render=(...args)=>{
    const result=baseRender?.(...args);
    repair();
    return result;
  };
  ctx.renderAll=()=>ctx.render?.(ctx.mode);

  const baseInitialize=ctx.initialize;
  ctx.initialize=async()=>{
    await baseInitialize?.();
    repair();
    document.documentElement.dataset.recovery='v28';
    if(window.__PACEFOLD__){
      window.__PACEFOLD__.recovery=EXPERIENCE;
      window.__PACEFOLD__.recoveryRelease=DISPLAY_RELEASE;
    }
  };

  const observer=new MutationObserver(repairMusicLayout);
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),8000);

  ctx.recoveryV28={version:EXPERIENCE,release:DISPLAY_RELEASE,repair};
}
