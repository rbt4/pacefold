import{el}from'./state.js';

export function installSecurity(ctx){
  document.documentElement.dataset.security='hardened';

  // External navigation is always isolated from the Clock window. Dynamic links are
  // covered too, including search results and media hand-offs created after boot.
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target.closest('a[target="_blank"]'):null;
    if(!target)return;
    target.rel='noopener noreferrer';
    target.referrerPolicy='no-referrer';
  },{capture:true});

  // Keep app content out of task-switcher/window previews when focus leaves the
  // standalone window. This does not alter the current view or stored state.
  const curtain=el('div','privacy-curtain');curtain.setAttribute('aria-hidden','true');
  curtain.append(el('i'),el('span','','Clock'));
  document.body.append(curtain);
  let blurTimer=0;
  const screen=()=>{
    clearTimeout(blurTimer);
    if(document.documentElement.dataset.cover==='on')return;
    document.documentElement.dataset.privacyScreen='on';
  };
  const reveal=()=>{clearTimeout(blurTimer);document.documentElement.dataset.privacyScreen='off'};
  window.addEventListener('blur',()=>{blurTimer=setTimeout(screen,90)});
  window.addEventListener('focus',reveal);
  document.addEventListener('visibilitychange',()=>document.hidden?screen():reveal());
  window.addEventListener('pagehide',screen);

  ctx.securityState=()=>({
    referrer:document.querySelector('meta[name="referrer"]')?.content||'',
    csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content||'',
    privacyScreen:document.documentElement.dataset.privacyScreen||'off'
  });
}
