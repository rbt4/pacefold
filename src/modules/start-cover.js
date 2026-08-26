import{id,el,button}from'./state.js';

const GOOGLE_SEARCH='https://www.google.com/search?q=';

export function installStartCover(ctx){
  const appBar=document.querySelector('.app-bar');
  if(!appBar||id('pace-cover'))return;

  const params=new URLSearchParams(location.search),requested=params.get('mode'),legacySurface=params.get('surface')==='1';
  const directView=['notes','worklog','now','settings'].includes(requested);
  const cover=el('section','pace-cover');cover.id='pace-cover';cover.dataset.photo='loaded';cover.setAttribute('aria-label','Homepage clock');
  const backdrop=el('div','cover-backdrop');backdrop.setAttribute('aria-hidden','true');
  const hero=el('div','cover-hero');
  const clock=el('div','cover-clock');
  const time=el('time','cover-time');time.id='cover-time';
  const mainTime=el('span','cover-time-main','--:--');mainTime.id='cover-time-main';
  const second=el('span','cover-time-second','--');second.id='cover-time-second';
  const period=el('span','cover-time-period','');period.id='cover-time-period';time.append(mainTime,second,period);
  const date=el('div','cover-date','');date.id='cover-date';clock.append(time,date);
  const utility=el('section','cover-utility home-utility');utility.setAttribute('aria-label','Search and quick note');
  const searchForm=el('form','cover-omnibox');searchForm.id='cover-search-form';searchForm.autocomplete='off';
  const searchIcon=el('i','cover-search-icon');searchIcon.setAttribute('aria-hidden','true');
  const searchInput=el('input');searchInput.id='cover-search';searchInput.type='search';searchInput.autocomplete='off';searchInput.spellcheck=false;searchInput.placeholder='Search Google or type a web address';searchInput.setAttribute('aria-label','Search Google or type a web address');
  const noteToggle=button('cover-note-toggle','Open quick note');noteToggle.id='cover-note-toggle';noteToggle.append(el('i','cover-note-icon'),el('span','','Note'));
  const searchGo=button('cover-submit','Search','↗');searchGo.type='submit';searchForm.append(searchIcon,searchInput,noteToggle,searchGo);
  const noteForm=el('form','cover-note-panel');noteForm.id='cover-note-form';noteForm.hidden=true;
  const noteInput=el('textarea');noteInput.id='cover-note';noteInput.rows=2;noteInput.maxLength=6000;noteInput.placeholder='Keep a quick note…';noteInput.setAttribute('aria-label','Keep a quick note');
  const noteActions=el('div','cover-note-actions');const noteCancel=button('','Close quick note','Cancel');const noteKeep=button('primary','Keep note','Keep');noteKeep.type='submit';noteActions.append(noteCancel,noteKeep);noteForm.append(noteInput,noteActions);utility.append(searchForm,noteForm);
  const peel=button('cover-peel','Open clock');peel.id='cover-peel';peel.append(el('i'),el('span','','Open clock'),el('b','','⌃'));
  const credit=el('a','cover-photo-credit home-photo-credit','');credit.id='cover-photo-credit';credit.target='_blank';credit.rel='noopener noreferrer';credit.referrerPolicy='no-referrer';credit.hidden=true;
  hero.append(clock);cover.append(backdrop,hero,peel);document.body.append(cover);
  const home=document.querySelector('.view-home');
  if(home)home.append(utility,credit);else cover.append(utility,credit);
  const restore=button('cover-return','Return to the simple surface');restore.id='cover-return';restore.append(el('i'),el('span','','Surface'));restore.hidden=!legacySurface;appBar.append(restore);

  const updateInert=covered=>{const stage=id('stage'),edges=document.querySelector('.edge-nav');if(stage)stage.inert=covered;if(edges)edges.inert=covered};
  ctx.setStartCover=covered=>{document.documentElement.dataset.cover=covered?'on':'peeled';cover.setAttribute('aria-hidden',String(!covered));restore.setAttribute('aria-hidden',String(covered));updateInert(covered);if(covered)requestAnimationFrame(()=>searchInput.focus())};
  const tick=()=>{const now=new Date(),parts=new Intl.DateTimeFormat(undefined,{timeZone:ctx.prefs.timeZone,hour:'numeric',minute:'2-digit',second:'2-digit',hour12:ctx.prefs.timeFormat!=='24'}).formatToParts(now),read=type=>parts.find(part=>part.type===type)?.value||'';mainTime.textContent=`${read('hour')}:${read('minute')}`;second.textContent=read('second');period.textContent=read('dayPeriod');period.hidden=!read('dayPeriod');time.dateTime=now.toISOString();date.textContent=new Intl.DateTimeFormat(undefined,{timeZone:ctx.prefs.timeZone,weekday:'long',month:'long',day:'numeric'}).format(now)};tick();setInterval(tick,1000);
  const loadDailyImage=async()=>{try{const response=await fetch('./daily-image.json',{cache:'no-store',credentials:'same-origin'});if(!response.ok)return;const data=await response.json(),image=data.url==='./daily-image.jpg'?'./daily-image.jpg':'./homepage-default.jpg',value=`url("${image}")`;cover.style.setProperty('--cover-image',value);document.documentElement.style.setProperty('--home-image',value);cover.dataset.photo='loaded';if(image==='./daily-image.jpg'&&data.credit){credit.textContent='ⓘ  '+data.credit;credit.title=data.credit;credit.href=/^https:\/\//i.test(data.creditUrl||'')?data.creditUrl:'https://www.bing.com/';credit.hidden=false}}catch{}};void loadDailyImage();
  const resolveTarget=value=>{const input=value.trim();if(!input)return'';if(/^https?:\/\//i.test(input))return input;if(/^(localhost|([\w-]+\.)+[a-z]{2,})(:\d+)?(\/|$)/i.test(input))return`https://${input}`;return`${GOOGLE_SEARCH}${encodeURIComponent(input)}`};
  searchForm.addEventListener('submit',event=>{event.preventDefault();const href=resolveTarget(searchInput.value);if(!href)return;const link=document.createElement('a');link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';document.body.append(link);link.click();link.remove();searchInput.select()});
  const setNote=open=>{noteForm.hidden=!open;noteToggle.setAttribute('aria-pressed',String(open));if(open)requestAnimationFrame(()=>noteInput.focus());else requestAnimationFrame(()=>searchInput.focus())};
  noteToggle.addEventListener('click',()=>setNote(noteForm.hidden));noteCancel.addEventListener('click',()=>setNote(false));
  noteForm.addEventListener('submit',event=>{event.preventDefault();const note=ctx.captureNote?.(noteInput.value,'Note');if(!note){ctx.toast?.('Write something first');return}noteInput.value='';ctx.toast?.('Note kept');setNote(false)});
  noteInput.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setNote(false)}else if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();noteForm.requestSubmit()}});
  document.addEventListener('keydown',event=>{if(document.documentElement.dataset.cover!=='on')return;if(event.key==='/'&&!/INPUT|TEXTAREA/.test(document.activeElement?.tagName||'')){event.preventDefault();searchInput.focus()}});
  peel.addEventListener('click',()=>ctx.setStartCover(false));restore.addEventListener('click',()=>ctx.setStartCover(true));let startY=0;peel.addEventListener('pointerdown',event=>{startY=event.clientY;peel.setPointerCapture?.(event.pointerId)});peel.addEventListener('pointerup',event=>{if(startY&&event.clientY-startY<-24)ctx.setStartCover(false);startY=0});
  // V30 makes the atmospheric Clock itself the homepage. The former cover is
  // retained only as compatibility plumbing for old tests/links; it never
  // flashes over the working Clock during a normal launch.
  ctx.setStartCover(legacySurface&&!directView);
}
