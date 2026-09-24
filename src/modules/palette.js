import{id,el,button}from'./state.js';

// The command bar: ⌘K / Ctrl+K anywhere (or / on Clock) to go somewhere, log
// something, start a session, change a setting or keep a note, without reaching
// for the mouse. Results filter as you type; ↑ ↓ choose, Enter runs, Esc closes.
const mac=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent||'');

export function installPalette(ctx){
  if(id('palette'))return;
  const root=document.documentElement;
  const shell=el('div','palette');shell.id='palette';shell.hidden=true;shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Command bar');
  const scrim=el('div','palette-scrim'),box=el('div','palette-box');
  const field=el('label','palette-field'),input=el('input');input.id='palette-input';input.type='text';input.autocomplete='off';input.spellcheck=false;input.placeholder='Type a command, or a note to keep…';
  input.setAttribute('role','combobox');input.setAttribute('aria-expanded','true');input.setAttribute('aria-controls','palette-list');input.setAttribute('aria-label','Command');
  field.append(el('i','palette-glass'),input,el('kbd','','esc'));
  const list=el('ul','palette-list');list.id='palette-list';list.setAttribute('role','listbox');
  const foot=el('footer','palette-foot');foot.append(el('span','','↑ ↓ to choose'),el('span','','↵ to run'),el('span','',`${mac?'⌘':'Ctrl'} K anywhere`));
  box.append(field,list,foot);shell.append(scrim,box);document.body.append(shell);

  const trigger=button('palette-button','Open command bar');trigger.append(el('i','palette-glass'),el('span','','Search'),el('kbd','',mac?'⌘K':'Ctrl K'));
  document.querySelector('.bar-status')?.prepend(trigger);

  const go=(target)=>()=>{ctx.setStartCover?.(false);ctx.go(target)};
  const act=name=>()=>{ctx.performAction?.(name);ctx.renderAll?.()};
  const appearance=value=>()=>{ctx.storePrefs({appearance:value},'appearance');ctx.applyAppearance?.();ctx.toast?.(`Appearance: ${value[0].toUpperCase()}${value.slice(1)}`)};
  const commands=()=>[
    {group:'Go',label:'Clock',hint:'Esc',tone:'forest',run:go('home'),words:'home dial time'},
    {group:'Go',label:'Notes',hint:'↑',tone:'forest',run:go('notes'),words:'daybook notebook'},
    {group:'Go',label:'Day log',hint:'←',tone:'forest',run:go('worklog'),words:'worklog timeline balance'},
    {group:'Go',label:'Now',hint:'→',tone:'forest',run:go('now'),words:'next schedule'},
    {group:'Go',label:'Settings',hint:'↓',tone:'forest',run:go('settings'),words:'preferences options'},
    {group:'Go',label:'Start page',hint:'',tone:'forest',run:()=>ctx.setStartCover?.(true,{focus:true}),words:'homepage cover search google'},
    {group:'Log',label:'Log water',tone:'water',run:act('water'),words:'drink sip hydrate'},
    {group:'Log',label:'Log a distance look',tone:'eyes',run:act('eyes'),words:'eyes 20 look far'},
    {group:'Log',label:'Log movement',tone:'move',run:act('move'),words:'stretch walk body'},
    {group:'Log',label:ctx.findOpen?.('meal')?'End meal':'Start meal',tone:'meal',run:act('meal'),words:'lunch eat food'},
    {group:'Log',label:ctx.findOpen?.('away')?'Back from away':'Step away',tone:'away',run:act('away'),words:'break away'},
    {group:'Log',label:`${ctx.prepName?.()||'Prep'} timer`,tone:'prep',run:act('prep'),words:'noodles prep timer cook'},
    {group:'Do',label:ctx.findOpen?.('focus')?'End focus block':'Start a focus block',tone:'focus',run:()=>ctx.toggleSession('focus','focus','Focus block'),words:'deep work session'},
    {group:'Do',label:ctx.findOpen?.('field')?'End field work':'Start field work',tone:'focus',run:()=>ctx.toggleSession('field','field','Field work'),words:'site inspection session'},
    {group:'Do',label:ctx.prefs.quietMode?'Turn quiet mode off':'Turn quiet mode on',tone:'focus',run:()=>void ctx.toggleSetting('quietMode'),words:'mute silence notifications'},
    {group:'Do',label:root.dataset.zen==='on'?'Leave focus view':'Focus view',hint:'Z',tone:'focus',run:()=>{ctx.setStartCover?.(false);if(ctx.mode!=='home')ctx.go('home');ctx.toggleZen?.()},words:'zen fullscreen dial'},
    {group:'Weather',label:'Radar and hourly weather',tone:'water',run:()=>ctx.openWeather?.(),words:'rain forecast radar map air'},
    {group:'Look',label:'Appearance: Light',tone:'sun',run:appearance('light'),words:'theme'},
    {group:'Look',label:'Appearance: Dark',tone:'sun',run:appearance('dark'),words:'theme night'},
    {group:'Look',label:'Appearance: System',tone:'sun',run:appearance('system'),words:'theme auto'},
  ];

  // Subsequence match with a bonus for word starts and contiguous runs.
  const score=(text,query)=>{
    if(!query)return 1;
    const hay=text.toLowerCase(),q=query.toLowerCase();
    if(hay.startsWith(q))return 100;
    const at=hay.indexOf(q);if(at>=0)return 80-(hay[at-1]===' '?0:10)-at*.1;
    let pos=0,total=0,run=0;
    for(const ch of q){const found=hay.indexOf(ch,pos);if(found<0)return 0;run=found===pos?run+1:0;total+=1+run+(found===0||hay[found-1]===' '?2:0);pos=found+1}
    return total;
  };

  let rows=[],active=0;
  const render=()=>{
    const query=input.value.trim();
    rows=commands().map(item=>({item,score:Math.max(score(item.label,query),score(`${item.label} ${item.words||''}`,query)*.8)})).filter(row=>row.score>0).sort((a,b)=>b.score-a.score).map(row=>row.item);
    if(!query)rows=commands();
    if(query.length>=2){
      rows.push({group:'Note',label:`Keep “${query}” as a note`,tone:'note',run:()=>{const note=ctx.captureNote?.(query,'Note');ctx.toast?.(note?'Note kept':'Write something first')},words:''});
      rows.push({group:'Note',label:`Search notes for “${query}”`,tone:'note',run:()=>{ctx.setStartCover?.(false);ctx.go('notes');const search=id('note-search');if(search){search.value=query;search.dispatchEvent(new Event('input',{bubbles:true}))}},words:''});
    }
    active=Math.min(active,Math.max(0,rows.length-1));
    list.replaceChildren();
    let group='';
    rows.forEach((item,index)=>{
      if(!query&&item.group!==group){group=item.group;const head=el('li','palette-group',group);head.setAttribute('role','presentation');list.append(head)}
      const row=el('li','palette-row');row.id=`palette-row-${index}`;row.setAttribute('role','option');row.dataset.index=String(index);row.dataset.tone=item.tone||'';
      row.setAttribute('aria-selected',String(index===active));
      row.append(el('i','palette-mark'),el('span','',item.label));if(item.hint)row.append(el('kbd','',item.hint));
      list.append(row);
    });
    input.setAttribute('aria-activedescendant',rows.length?`palette-row-${active}`:'');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});
  };
  const select=index=>{active=(index+rows.length)%Math.max(1,rows.length);for(const row of list.querySelectorAll('.palette-row'))row.setAttribute('aria-selected',String(Number(row.dataset.index)===active));input.setAttribute('aria-activedescendant',`palette-row-${active}`);list.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'})};

  let lastFocus=null;
  const open=()=>{if(!shell.hidden)return;lastFocus=document.activeElement;input.value='';active=0;render();shell.hidden=false;root.dataset.palette='open';input.focus();requestAnimationFrame(()=>shell.classList.add('is-on'))};
  const close=({restore=true}={})=>{if(shell.hidden)return;shell.classList.remove('is-on');delete root.dataset.palette;setTimeout(()=>{if(!shell.classList.contains('is-on'))shell.hidden=true},180);if(restore&&lastFocus?.isConnected)lastFocus.focus({preventScroll:true})};
  const run=index=>{const item=rows[index];if(!item)return;close({restore:false});setTimeout(()=>item.run(),10)};
  ctx.openPalette=open;ctx.closePalette=close;

  input.addEventListener('input',()=>{active=0;render()});
  input.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'){event.preventDefault();select(active+1)}
    else if(event.key==='ArrowUp'){event.preventDefault();select(active-1)}
    else if(event.key==='Enter'&&!event.isComposing){event.preventDefault();run(active)}
    else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}
    else if(event.key==='Tab'){event.preventDefault();select(active+(event.shiftKey?-1:1))}
  });
  list.addEventListener('pointermove',event=>{const row=event.target.closest?.('.palette-row');if(row&&Number(row.dataset.index)!==active)select(Number(row.dataset.index))});
  list.addEventListener('click',event=>{const row=event.target.closest?.('.palette-row');if(row)run(Number(row.dataset.index))});
  scrim.addEventListener('click',()=>close());
  trigger.addEventListener('click',open);

  window.addEventListener('keydown',event=>{
    if((event.metaKey||event.ctrlKey)&&!event.altKey&&(event.key==='k'||event.key==='K')){event.preventDefault();event.stopImmediatePropagation();if(shell.hidden)open();else close();return}
    if(!shell.hidden&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return}
    const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')||document.activeElement?.isContentEditable;
    if(event.key==='/'&&!typing&&root.dataset.cover!=='on'&&root.dataset.weatherSheet!=='open'&&shell.hidden){event.preventDefault();open()}
  },true);
}
