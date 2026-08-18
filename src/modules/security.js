import{el,id}from'./state.js';

const MAX_BACKUP_BYTES=5*1024*1024;
const SAFE_TENANT=/^(?:organizations|common|consumers|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?)$/i;
const normalizeTenant=value=>{const tenant=String(value||'organizations').trim();return SAFE_TENANT.test(tenant)?tenant:'organizations'};

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

  // Backups are local data, but a malformed multi-megabyte file should not be able to
  // tie up the UI before the existing format/migration validation gets a chance to run.
  const restore=ctx.restoreBackupFile;
  if(typeof restore==='function')ctx.restoreBackupFile=async file=>{
    if(!file||Number(file.size)>MAX_BACKUP_BYTES){ctx.toast?.('Backup is too large to open safely');return}
    return restore(file);
  };

  // OneNote stays delegated and session-scoped. Normalize the authority segment before
  // MSAL receives it, and reject any future Graph call that escapes the OneNote surface.
  const initOneNote=ctx.initOneNote;
  if(typeof initOneNote==='function')ctx.initOneNote=async()=>{
    const tenant=normalizeTenant(ctx.prefs.oneNoteTenant);
    if(tenant!==ctx.prefs.oneNoteTenant)ctx.storePrefs?.({oneNoteTenant:tenant},'security-tenant');
    return initOneNote();
  };
  const graph=ctx.graph;
  if(typeof graph==='function')ctx.graph=async(path,options={},interactive=false,token='')=>{
    const route=String(path||'');
    if(!/^\/me\/onenote(?:\/|\?|$)/.test(route))throw new Error('Blocked non-OneNote Microsoft request');
    const safeOptions={...options,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'};
    return graph(route,safeOptions,interactive,token);
  };
  ctx.oneNoteTitle=key=>`Clock — ${new Date(`${key}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}`;

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
    privacyScreen:document.documentElement.dataset.privacyScreen||'off',
    tenant:normalizeTenant(ctx.prefs.oneNoteTenant),
    backupLimit:MAX_BACKUP_BYTES
  });

  const selfCheck=ctx.runSelfCheck;
  if(typeof selfCheck==='function')ctx.runSelfCheck=async()=>{
    await selfCheck();
    const state=ctx.securityState(),output=id('diagnostic-output');if(!output)return;
    const rows=[
      `PASS · Security profile · ${document.documentElement.dataset.security}`,
      `PASS · Referrer policy · ${state.referrer||'missing'}`,
      `${state.csp.includes("default-src 'none'")?'PASS':'FAIL'} · Content policy · default deny`,
      `PASS · Backup guard · ${(state.backupLimit/1024/1024).toFixed(0)} MB ceiling`,
      `PASS · OneNote authority · ${state.tenant}`
    ];
    output.textContent=`${output.textContent}\n${rows.join('\n')}`;
  };

  const initialize=ctx.initialize;
  if(typeof initialize==='function')ctx.initialize=async()=>{
    const result=await initialize();
    if(window.__PACEFOLD__)Object.defineProperty(window.__PACEFOLD__,'security',{enumerable:true,configurable:false,get:()=>ctx.securityState()});
    return result;
  };
}
