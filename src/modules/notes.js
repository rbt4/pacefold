import{$,id,el,button}from'./state.js';

export function installNotes(ctx){
  ctx.notesForDate=key=>ctx.notes
    .filter(note=>note.date===key)
    .sort((a,b)=>Number(b.pinned)-Number(a.pinned)||new Date(b.updatedAt)-new Date(a.updatedAt));

  ctx.noteCategories=()=>ctx.normalizeNoteCategories([...ctx.prefs.noteCategories,...ctx.notes.map(note=>note.category)]);

  ctx.noteContext=(at=Date.now())=>{
    const now=new Date(at),range=ctx.workRange(ctx.prefs,now),part=ctx.zoneParts(now,ctx.prefs.timeZone);
    const decimal=part.hour+part.minute/60+part.second/3600;
    const progress=ctx.clamp((decimal-range.start)/(range.end-range.start),0,1,0);
    const schedule=ctx.getSchedule(now).today;
    const previous=[...schedule].filter(item=>item.date<=now).pop();
    const anchor=previous||schedule[0]||null;
    const open=['focus','field','prep','away','meal'].map(source=>ctx.findOpen(source)).filter(Boolean).sort((a,b)=>b.start-a.start)[0];
    return{
      at:new Date(at).toISOString(),
      ...(open?{sessionId:open.id}:{}),
      ...(anchor?{moment:{id:anchor.id,label:anchor.label,progress:Number(progress.toFixed(4))}}:{})
    };
  };

  ctx.captureNote=(body,category=ctx.newNoteCategory,{date=''}={})=>{
    const text=String(body||'').trim();if(!text)return null;
    const now=Date.now(),stamp=new Date(now).toISOString();
    const note={
      id:ctx.uid('note'),date:date||ctx.todayKey(new Date(now)),body:text.slice(0,6000),
      category:category||ctx.prefs.noteCategories[0]||'Note',createdAt:stamp,updatedAt:stamp,
      syncedAt:0,syncError:'',pinned:false,closedAt:'',context:ctx.noteContext(now)
    };
    ctx.notes.push(note);ctx.storeNotes('note-add');
    ctx.addMoment('note','Note captured',ctx.cleanText(text,80),now,'note',{noteId:note.id});
    ctx.render?.(ctx.mode);void ctx.syncOneNote?.(false);return note;
  };

  ctx.buildClockDaybook=()=>{
    const fold=$('.daybook-fold');if(!fold||id('clock-note-input'))return;
    fold.replaceChildren();
    const compose=el('section','clock-note-compose');
    const textarea=el('textarea');textarea.id='clock-note-input';textarea.rows=1;textarea.maxLength=6000;textarea.placeholder='Log a thought.';textarea.setAttribute('aria-label','Log a thought');
    const meta=el('div','clock-note-compose-meta');
    const categories=el('div','clock-note-categories');categories.id='clock-note-categories';categories.hidden=true;
    meta.append(categories,el('small','','Enter to keep · Shift+Enter for a new line'));compose.append(textarea,meta);

    const carry=el('section','clock-carry');carry.id='clock-carry';carry.hidden=true;
    const carryHead=el('header');carryHead.append(el('span','','Carry forward'),el('b','','0'));const carryStrip=el('div','clock-carry-strip');carryStrip.id='clock-carry-strip';carry.append(carryHead,carryStrip);

    const recent=el('section','clock-recent');const recentHead=el('header');recentHead.append(el('span','','Recent'),el('b','','0'));const recentList=el('div','clock-recent-notes');recentList.id='clock-recent-notes';recent.append(recentHead,recentList);
    const footer=el('footer','clock-daybook-footer');const count=el('span','','0 notes today');count.id='clock-note-count';const open=button('',`Open the full Daybook`,'Open Daybook');open.addEventListener('click',()=>ctx.go?.('notes'));footer.append(count,open);
    fold.append(compose,carry,recent,footer);

    const grow=()=>{textarea.style.height='auto';textarea.style.height=`${Math.min(150,Math.max(38,textarea.scrollHeight))}px`;categories.hidden=!textarea.value.trim();ctx.renderClockCategoryChips()};
    textarea.addEventListener('input',grow);
    textarea.addEventListener('keydown',event=>{
      if(event.key!=='Enter'||event.shiftKey||event.isComposing)return;
      event.preventDefault();
      const note=ctx.captureNote(textarea.value,ctx.clockNoteCategory);
      if(!note){ctx.toast('Write something first');return}
      textarea.value='';textarea.style.height='auto';categories.hidden=true;ctx.toast('Note kept');textarea.focus();
    });
  };

  ctx.buildCategoryUi=()=>{
    const select=id('note-category');
    if(select&&!id('note-compose-chips')){select.hidden=true;const chips=el('div','note-compose-chips');chips.id='note-compose-chips';select.after(chips)}
    const filter=id('note-filter');
    if(filter&&!id('note-filter-chips')){filter.hidden=true;const chips=el('div','note-filter-chips');chips.id='note-filter-chips';filter.after(chips)}
    const panel=$('[data-settings-panel="data"]')||$('[data-settings-panel="essentials"]');
    if(panel&&!id('note-category-settings')){
      const section=el('section','note-category-settings');section.id='note-category-settings';
      const head=el('header');head.append(el('span','','Daybook categories'),el('small','','Add or remove labels used by new notes. Existing notes keep their label.'));
      const list=el('div','note-category-settings-list');list.id='note-category-settings-list';
      const add=el('div','note-category-add'),input=el('input');input.id='note-category-new';input.type='text';input.maxLength=32;input.placeholder='New category';input.setAttribute('aria-label','New note category');
      const addButton=button('',`Add note category`,'Add');
      const commit=()=>{const value=input.value.trim();if(!value)return;ctx.addNoteCategory(value);input.value=''};
      addButton.addEventListener('click',commit);input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commit()}});add.append(input,addButton);section.append(head,list,add);panel.append(section);
    }
  };

  ctx.renderClockCategoryChips=()=>{
    const root=id('clock-note-categories');if(!root)return;root.replaceChildren();
    for(const category of ctx.prefs.noteCategories){
      const control=button('',`Use ${category}`,category);control.dataset.active=String(category===ctx.clockNoteCategory);
      control.addEventListener('click',()=>{ctx.clockNoteCategory=category;ctx.renderClockCategoryChips();id('clock-note-input')?.focus()});root.append(control);
    }
  };

  ctx.renderCategoryControls=()=>{
    const categories=ctx.noteCategories(),counts=new Map(categories.map(category=>[category,ctx.notes.filter(note=>note.category===category).length]));
    const filter=id('note-filter-chips');
    if(filter){filter.replaceChildren();for(const category of['all',...categories]){const count=category==='all'?ctx.notes.length:(counts.get(category)||0),label=category==='all'?'All':category,control=button('',`Filter ${label}: ${count} notes`);control.dataset.active=String(ctx.noteFilter===category);control.append(el('span','',label),el('b','',String(count)));control.addEventListener('click',()=>{ctx.noteFilter=category;ctx.renderNotes()});filter.append(control)}}
    const compose=id('note-compose-chips');
    if(compose){compose.replaceChildren();for(const category of ctx.prefs.noteCategories){const control=button('',`Use ${category}`);control.dataset.active=String(category===ctx.newNoteCategory);control.append(el('span','',category),el('b','',String(counts.get(category)||0)));control.addEventListener('click',()=>{ctx.newNoteCategory=category;ctx.renderCategoryControls()});compose.append(control)}}
    const settings=id('note-category-settings-list');
    if(settings){settings.replaceChildren();for(const category of ctx.prefs.noteCategories){const chip=el('span','note-category-setting-chip');chip.append(el('b','',category));const remove=button('',`Remove ${category}`,'×');remove.disabled=ctx.prefs.noteCategories.length<=1;remove.addEventListener('click',()=>ctx.removeNoteCategory(category));chip.append(remove);settings.append(chip)}}
  };

  ctx.addNoteCategory=value=>{
    const next=ctx.normalizeNoteCategories([...ctx.prefs.noteCategories,value]);
    if(next.length===ctx.prefs.noteCategories.length){ctx.toast('That category already exists');return}
    ctx.storePrefs({noteCategories:next},'note-categories');ctx.renderCategoryControls();ctx.renderClockCategoryChips();ctx.toast('Category added');
  };
  ctx.removeNoteCategory=category=>{
    if(ctx.prefs.noteCategories.length<=1)return;
    ctx.storePrefs({noteCategories:ctx.prefs.noteCategories.filter(item=>item!==category)},'note-categories');ctx.renderCategoryControls();ctx.renderClockCategoryChips();ctx.toast('Category removed from new-note choices');
  };

  ctx.renderFold=()=>{
    ctx.renderClockCategoryChips();
    const today=ctx.todayKey(),todayNotes=ctx.notesForDate(today);
    const carry=[...ctx.notes].filter(note=>(['Follow-up','JHSC'].includes(note.category)&&!note.closedAt)||note.pinned).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||new Date(a.createdAt)-new Date(b.createdAt));
    const carryRoot=id('clock-carry'),strip=id('clock-carry-strip');
    if(carryRoot&&strip){carryRoot.hidden=!carry.length;carryRoot.querySelector('header b').textContent=String(carry.length);strip.replaceChildren();for(const note of carry){const card=el('article','clock-carry-note');card.dataset.pinned=String(note.pinned);const text=el('span');text.append(el('small','',`${note.category} · ${new Date(note.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`),el('strong','',note.body));const actionable=['Follow-up','JHSC'].includes(note.category)&&!note.closedAt;const action=button('',actionable?`Close ${note.category}`:'Unpin note',actionable?'Done':'Unpin');action.addEventListener('click',()=>actionable?ctx.closeFollowUp(note):ctx.togglePin(note));card.append(text,action);strip.append(card)}}
    const recent=[...ctx.notes].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,2),recentRoot=id('clock-recent-notes');
    if(recentRoot){recentRoot.replaceChildren();const head=recentRoot.previousElementSibling?.querySelector('b');if(head)head.textContent=String(ctx.notes.length);if(!recent.length)recentRoot.append(el('div','clock-note-empty','Your first note will appear here.'));else for(const note of recent){const row=button('clock-recent-note',`Open note from ${note.date}`);row.append(el('small','',`${note.category} · ${new Date(note.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`),el('strong','',note.body));row.addEventListener('click',()=>ctx.openNote(note));recentRoot.append(row)}}
    if(id('clock-note-count'))id('clock-note-count').textContent=`${todayNotes.length} note${todayNotes.length===1?'':'s'} today${carry.length?` · ${carry.length} carried`:''}`;
  };

  ctx.renderCalendar=()=>{
    const year=ctx.calendarCursor.getFullYear(),month=ctx.calendarCursor.getMonth(),first=new Date(year,month,1),start=new Date(year,month,1-first.getDay()),grid=id('calendar-grid');
    id('calendar-title').textContent=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});grid.replaceChildren();
    for(let index=0;index<42;index+=1){
      const date=new Date(start.getFullYear(),start.getMonth(),start.getDate()+index),key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,count=ctx.notesForDate(key).length,node=button('',date.toLocaleDateString(),date.getDate());
      node.dataset.date=key;node.dataset.month=String(date.getMonth()===month);node.dataset.selected=String(key===ctx.selectedDate);node.dataset.today=String(key===ctx.todayKey());if(count)node.dataset.count=String(count);node.addEventListener('click',()=>{ctx.selectedDate=key;ctx.inlineEditingNoteId='';ctx.renderNotes()});grid.append(node);
    }
    const prefix=`${year}-${String(month+1).padStart(2,'0')}`,monthNotes=ctx.notes.filter(note=>note.date.startsWith(prefix)),activeDays=new Set(monthNotes.map(note=>note.date)).size,followUps=monthNotes.filter(note=>['Follow-up','JHSC'].includes(note.category)&&!note.closedAt).length,summary=id('calendar-summary');summary.replaceChildren();
    for(const[label,value]of[['Notes',monthNotes.length],['Active days',activeDays],['Open',followUps],['Selected',ctx.notesForDate(ctx.selectedDate).length]]){const item=el('span');item.append(el('small','',label),el('strong','',value));summary.append(item)}
  };

  ctx.renderNotes=()=>{
    ctx.renderCalendar();ctx.renderCategoryControls();
    const search=id('note-search').value.trim().toLowerCase(),base=search?ctx.notes:ctx.notesForDate(ctx.selectedDate),rows=base.filter(note=>(!search||`${note.body} ${note.category}`.toLowerCase().includes(search))&&(ctx.noteFilter==='all'||note.category===ctx.noteFilter)).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||new Date(b.updatedAt)-new Date(a.updatedAt));
    const date=new Date(`${ctx.selectedDate}T12:00:00`),global=Boolean(search);id('notes-total').textContent=`${ctx.notes.length} note${ctx.notes.length===1?'':'s'}`;id('note-date-kicker').textContent=global?'Across your Daybook':ctx.selectedDate===ctx.todayKey()?'Today':'Selected day';id('note-date-title').textContent=global?`${rows.length} search result${rows.length===1?'':'s'}`:date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
    const words=rows.reduce((total,note)=>total+note.body.trim().split(/\s+/).filter(Boolean).length,0),kinds=new Set(rows.map(note=>note.category)).size,insights=id('note-insights');insights.replaceChildren();
    for(const[label,value,color]of[['Entries',rows.length,'#426b5b'],['Words',words,'#3f718b'],['Kinds',kinds,'#a66f2d']]){const item=el('div','note-insight'),copy=el('span');item.style.setProperty('--insight',color);copy.append(el('small','',label),el('strong','',String(value)));item.append(el('i'),copy);insights.append(item)}

    const list=id('note-list');list.replaceChildren();
    if(!rows.length){const empty=el('div','empty-state');empty.append(el('strong','',search?'No notes match that search':'This page is still quiet'),el('span','',search?'Try fewer words.':'Capture the first useful thing above.'));list.append(empty);return}
    for(const note of rows){
      const card=el('article','note-item');card.dataset.kind=note.category;card.dataset.noteId=note.id;card.dataset.pinned=String(note.pinned);card.dataset.focused=String(note.id===ctx.noteFocusId);
      const head=el('header'),tools=el('div');head.append(el('span','',note.category));
      const pin=button('',note.pinned?'Unpin note':'Pin note',note.pinned?'Unpin':'Pin');pin.addEventListener('click',()=>ctx.togglePin(note));
      const edit=button('',`Edit note`,'Edit');edit.dataset.noteEdit=note.id;const remove=button('',`Delete note`,'Delete');remove.dataset.noteDelete=note.id;tools.append(pin,edit);
      if(['Follow-up','JHSC'].includes(note.category)&&!note.closedAt){const done=button('',`Close ${note.category}`,'Done');done.addEventListener('click',()=>ctx.closeFollowUp(note));tools.append(done)}
      tools.append(remove);head.append(tools);card.append(head);

      if(ctx.inlineEditingNoteId===note.id){
        let draftCategory=note.category;
        const textarea=el('textarea','note-inline-input');textarea.value=note.body;textarea.maxLength=6000;textarea.rows=4;
        const categories=el('div','note-inline-categories'),footer=el('footer','note-inline-footer'),status=el('span','','Saved'),save=button('',`Save note changes`,'Save'),cancel=button('',`Cancel note changes`,'Cancel');save.disabled=true;
        const renderCategories=()=>{categories.replaceChildren();for(const category of ctx.prefs.noteCategories){const control=button('',`Use ${category}`,category);control.dataset.active=String(category===draftCategory);control.addEventListener('click',()=>{draftCategory=category;status.textContent='Unsaved changes';id('note-save-status').textContent='Unsaved changes';save.disabled=false;renderCategories()});categories.append(control)}};
        textarea.addEventListener('input',()=>{status.textContent='Unsaved changes';id('note-save-status').textContent='Unsaved changes';save.disabled=!textarea.value.trim();card.dataset.dirty='true'});
        save.addEventListener('click',()=>{if(!textarea.value.trim())return;note.body=textarea.value.trim().slice(0,6000);note.category=draftCategory;note.updatedAt=new Date().toISOString();note.syncedAt=0;note.syncError='';ctx.storeNotes('note-edit');ctx.inlineEditingNoteId='';id('note-save-status').textContent='Saved locally';ctx.renderNotes();ctx.toast('Note saved');void ctx.syncOneNote?.(false)});
        cancel.addEventListener('click',()=>{ctx.inlineEditingNoteId='';id('note-save-status').textContent='Saved locally';ctx.renderNotes()});renderCategories();footer.append(status,save,cancel);card.append(textarea,categories,footer);
      }else{
        card.append(el('p','',note.body));const footer=el('footer'),stamp=new Date(note.updatedAt),context=note.context?.sessionId?' · linked session':'';footer.append(el('span','',`${stamp.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}${context}`),el('b','',note.closedAt?'Closed':note.syncedAt?'Copied to OneNote':'Local'));card.append(footer);
      }
      list.append(card);
    }
  };

  ctx.saveNote=event=>{
    event.preventDefault();const input=id('note-input'),body=input.value.trim();if(!body){ctx.toast('Write something first');return}
    const note=ctx.captureNote(body,ctx.newNoteCategory,{date:ctx.selectedDate});if(!note)return;
    input.value='';id('note-count').textContent='0 / 6000';id('note-save-status').textContent='Saved locally';id('note-form').dataset.dirty='false';ctx.renderNotes();ctx.toast('Note kept locally');
  };

  ctx.editNote=note=>{ctx.inlineEditingNoteId=note.id;ctx.selectedDate=note.date;ctx.calendarCursor=new Date(`${note.date}T12:00:00`);ctx.renderNotes();requestAnimationFrame(()=>document.querySelector(`[data-note-id="${CSS.escape(note.id)}"] .note-inline-input`)?.focus({preventScroll:false}))};
  ctx.resetNoteComposer=()=>{ctx.inlineEditingNoteId='';id('note-input').value='';id('note-count').textContent='0 / 6000';id('note-save-status').textContent='Saved locally';id('note-form').dataset.dirty='false'};
  ctx.togglePin=note=>{note.pinned=!note.pinned;note.updatedAt=new Date().toISOString();ctx.storeNotes('note-pin');ctx.render?.(ctx.mode);ctx.toast(note.pinned?'Note pinned':'Note unpinned')};
  ctx.closeFollowUp=note=>{note.closedAt=new Date().toISOString();note.updatedAt=note.closedAt;ctx.storeNotes('note-close');ctx.addMoment('note','Follow-up closed',ctx.cleanText(note.body,70),Date.now(),'note',{noteId:note.id});ctx.render?.(ctx.mode);ctx.toast('Follow-up closed')};
  ctx.openNote=note=>{ctx.noteFocusId=note.id;ctx.selectedDate=note.date;ctx.calendarCursor=new Date(`${note.date}T12:00:00`);ctx.go?.('notes');requestAnimationFrame(()=>document.querySelector(`[data-note-id="${CSS.escape(note.id)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}));setTimeout(()=>{ctx.noteFocusId=''},1800)};
  ctx.deleteNote=async note=>{if(ctx.confirmAction&&!(await ctx.confirmAction('Delete this note?','This removes the local note. Your downloaded backups are not changed.')))return;ctx.notes=ctx.notes.filter(item=>item.id!==note.id);if(ctx.inlineEditingNoteId===note.id)ctx.inlineEditingNoteId='';ctx.storeNotes('note-delete');ctx.render?.(ctx.mode);ctx.toast('Note deleted')};

  ctx.buildClockDaybook();ctx.buildCategoryUi();ctx.renderCategoryControls();ctx.renderClockCategoryChips();
  id('note-input')?.addEventListener('input',event=>{id('note-form').dataset.dirty=String(Boolean(event.target.value));id('note-save-status').textContent=event.target.value?'Unsaved changes':'Saved locally'});
}
