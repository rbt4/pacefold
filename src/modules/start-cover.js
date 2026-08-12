import{id,el,button}from'./state.js';

const SEARCH_BASE='https://www.bing.com/search?q=';
const YOUTUBE_MUSIC='https://music.youtube.com/';

export function installStartCover(ctx){
  const appBar=document.querySelector('.app-bar');
  if(!appBar||id('pace-cover'))return;

  const requested=new URLSearchParams(location.search).get('mode');
  const directView=['notes','worklog','now','settings'].includes(requested);
  const cover=el('section','pace-cover');cover.id='pace-cover';cover.setAttribute('aria-label','Simple Pacefold surface');
  const atmosphere=el('div','cover-atmosphere');atmosphere.setAttribute('aria-hidden','true');
  const hero=el('div','cover-hero');
  const time=el('time','cover-time','--:--');time.id='cover-time';
  const date=el('div','cover-date','');date.id='cover-date';
  const utility=el('section','cover-utility');utility.setAttribute('aria-label','Search or quick note');
  const modes=el('nav','cover-modes');modes.setAttribute('aria-label','Cover utility');
  const searchMode=button('active','Search the web','Search');searchMode.dataset.coverMode='search';
  const noteMode=button('','Write a quick note','Note');noteMode.dataset.coverMode='note';
  modes.append(searchMode,noteMode);

  const searchForm=el('form','cover-omnibox cover-search');searchForm.id='cover-search-form';searchForm.autocomplete='off';
  const searchIcon=el('i','cover-search-icon');searchIcon.setAttribute('aria-hidden','true');
  const searchInput=el('input');searchInput.id='cover-search';searchInput.type='search';searchInput.autocomplete='off';searchInput.spellcheck=false;searchInput.placeholder='Search the web';searchInput.setAttribute('aria-label','Search the web');
  const searchGo=button('cover-submit','Search','↗');searchGo.type='submit';searchForm.append(searchIcon,searchInput,searchGo);

  const noteForm=el('form','cover-omnibox cover-note');noteForm.id='cover-note-form';noteForm.hidden=true;
  const noteIcon=el('i','cover-note-icon');noteIcon.setAttribute('aria-hidden','true');
  const noteInput=el('textarea');noteInput.id='cover-note';noteInput.rows=1;noteInput.maxLength=6000;noteInput.placeholder='Keep a note';noteInput.setAttribute('aria-label','Keep a quick note');
  const noteKeep=button('cover-submit','Keep note','Keep');noteKeep.type='submit';noteForm.append(noteIcon,noteInput,noteKeep);

  const hint=el('small','cover-hint','Search opens a new tab · Notes stay in your Daybook');
  utility.append(modes,searchForm,noteForm,hint);

  const peel=button('cover-peel','Peel away the simple surface');peel.id='cover-peel';peel.append(el('i'),el('span','','Pacefold'),el('b','','⌃'));
  hero.append(time,date,utility);cover.append(atmosphere,hero,peel);document.body.append(cover);

  const restore=button('cover-return','Return to the simple surface');restore.id='cover-return';restore.append(el('i'),el('span','','Surface'));appBar.append(restore);

  const setMode=mode=>{
    const note=mode==='note';cover.dataset.utility=note?'note':'search';searchMode.classList.toggle('active',!note);noteMode.classList.toggle('active',note);searchMode.setAttribute('aria-pressed',String(!note));noteMode.setAttribute('aria-pressed',String(note));searchForm.hidden=note;noteForm.hidden=!note;
    requestAnimationFrame(()=>{(note?noteInput:searchInput).focus()});
  };

  const updateInert=covered=>{
    const stage=id('stage'),edges=document.querySelector('.edge-nav');
    if(stage)stage.inert=covered;if(edges)edges.inert=covered;
  };

  ctx.setStartCover=covered=>{
    document.documentElement.dataset.cover=covered?'on':'peeled';cover.setAttribute('aria-hidden',String(!covered));restore.setAttribute('aria-hidden',String(covered));updateInert(covered);
    if(covered)requestAnimationFrame(()=>searchInput.focus());
  };

  const tick=()=>{
    const now=new Date();
    time.textContent=new Intl.DateTimeFormat(undefined,{timeZone:ctx.prefs.timeZone,hour:'numeric',minute:'2-digit',hour12:ctx.prefs.timeFormat!=='24'}).format(now);
    date.textContent=new Intl.DateTimeFormat(undefined,{timeZone:ctx.prefs.timeZone,weekday:'long',month:'long',day:'numeric'}).format(now);
  };
  tick();setInterval(tick,1000);

  searchMode.addEventListener('click',()=>setMode('search'));noteMode.addEventListener('click',()=>setMode('note'));
  searchForm.addEventListener('submit',event=>{
    event.preventDefault();const query=searchInput.value.trim();if(!query)return;
    const link=document.createElement('a');link.href=`${SEARCH_BASE}${encodeURIComponent(query)}`;link.target='_blank';link.rel='noopener noreferrer';document.body.append(link);link.click();link.remove();searchInput.select();
  });
  noteForm.addEventListener('submit',event=>{
    event.preventDefault();const note=ctx.captureNote?.(noteInput.value,'Note');
    if(!note){ctx.toast?.('Write something first');return}
    noteInput.value='';ctx.toast?.('Note kept');setMode('search');
  });
  noteInput.addEventListener('keydown',event=>{
    if(event.key!=='Enter'||event.shiftKey||event.isComposing)return;
    event.preventDefault();noteForm.requestSubmit();
  });
  cover.addEventListener('keydown',event=>{if(event.key==='/'&&event.target===cover){event.preventDefault();setMode('search')}});
  peel.addEventListener('click',()=>ctx.setStartCover(false));restore.addEventListener('click',()=>ctx.setStartCover(true));
  let startY=0;peel.addEventListener('pointerdown',event=>{startY=event.clientY;peel.setPointerCapture?.(event.pointerId)});peel.addEventListener('pointerup',event=>{if(startY&&event.clientY-startY<-24)ctx.setStartCover(false);startY=0});

  const sound=id('sound-bar');
  if(sound&&!id('music-launch')){
    sound.dataset.streaming='true';sound.setAttribute('aria-label','Music');
    const launch=el('a','music-launch');launch.id='music-launch';launch.href=YOUTUBE_MUSIC;launch.target='_blank';launch.rel='noopener noreferrer';launch.setAttribute('aria-label','Open YouTube Music in a new tab');
    const mark=el('i','music-mark');mark.setAttribute('aria-hidden','true');const copy=el('span');copy.append(el('small','','Music'),el('strong','','YouTube Music'));launch.append(mark,copy,el('b','','↗'));sound.append(launch);
    for(const child of [...sound.children])if(child!==launch)child.hidden=true;
  }

  ctx.setStartCover(!directView);
}
