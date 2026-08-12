import{id,el,button}from'./state.js';

export function installNotes(ctx){
  ctx.notesForDate=key=>ctx.notes
    .filter(note=>note.date===key)
    .sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));

  ctx.renderFold=()=>{
    const metrics=ctx.metricsForDay(ctx.log,ctx.todayKey(),ctx.prefs);
    const todayNotes=ctx.notesForDate(ctx.todayKey());
    const water=Number(ctx.prefs.waterOz??ctx.prefs.waterSips)||0;
    const summary=id('fold-summary');
    summary.replaceChildren();
    for(const [label,value] of [
      ['Notes',todayNotes.length],['Moments',metrics.events.length],
      ['Focus',ctx.durationText(metrics.focus)],['Water',`${water}/${ctx.prefs.waterTarget}`]
    ]){
      const card=button('fold-stat',`Open ${label}`);
      card.append(el('span','',label),el('strong','',value));
      card.addEventListener('click',()=>ctx.go?.(label==='Notes'?'notes':'worklog'));
      summary.append(card);
    }
    const recent=[...ctx.notes].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,3);
    const list=id('fold-notes');
    list.replaceChildren();
    if(!recent.length){list.append(el('div','fold-empty','Your first note will appear here.'));return}
    for(const note of recent){
      const row=button('fold-note','Open Notes');
      row.append(
        el('small','',new Date(note.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})),
        el('strong','',ctx.cleanText(note.body,90))
      );
      row.addEventListener('click',()=>{ctx.selectedDate=note.date;ctx.go?.('notes')});
      list.append(row);
    }
  };

  ctx.renderCalendar=()=>{
    const year=ctx.calendarCursor.getFullYear();
    const month=ctx.calendarCursor.getMonth();
    const first=new Date(year,month,1);
    const start=new Date(year,month,1-first.getDay());
    const grid=id('calendar-grid');
    id('calendar-title').textContent=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    grid.replaceChildren();
    for(let index=0;index<42;index+=1){
      const date=new Date(start.getFullYear(),start.getMonth(),start.getDate()+index);
      const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      const count=ctx.notesForDate(key).length;
      const node=button('',date.toLocaleDateString(),date.getDate());
      node.dataset.date=key;
      node.dataset.month=String(date.getMonth()===month);
      node.dataset.selected=String(key===ctx.selectedDate);
      node.dataset.today=String(key===ctx.todayKey());
      if(count)node.dataset.count=String(count);
      node.addEventListener('click',()=>{
        if(ctx.editingNoteId)ctx.resetNoteComposer();
        ctx.selectedDate=key;
        ctx.renderNotes();
      });
      grid.append(node);
    }
    const prefix=`${year}-${String(month+1).padStart(2,'0')}`;
    const monthNotes=ctx.notes.filter(note=>note.date.startsWith(prefix));
    const activeDays=new Set(monthNotes.map(note=>note.date)).size;
    const followUps=monthNotes.filter(note=>note.category==='Follow-up').length;
    const summary=id('calendar-summary');
    summary.replaceChildren();
    for(const [label,value] of [
      ['Notes',monthNotes.length],['Active days',activeDays],
      ['Follow-ups',followUps],['Selected',ctx.notesForDate(ctx.selectedDate).length]
    ]){
      const item=el('span');item.append(el('small','',label),el('strong','',value));summary.append(item);
    }
  };

  ctx.renderNotes=()=>{
    ctx.renderCalendar();
    const search=id('note-search').value.trim().toLowerCase();
    const filter=id('note-filter').value;
    const base=search?ctx.notes:ctx.notesForDate(ctx.selectedDate);
    const rows=base
      .filter(note=>(!search||`${note.body} ${note.category}`.toLowerCase().includes(search))&&(filter==='all'||note.category===filter))
      .sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
    const date=new Date(`${ctx.selectedDate}T12:00:00`);
    const global=Boolean(search);
    id('notes-total').textContent=`${ctx.notes.length} note${ctx.notes.length===1?'':'s'}`;
    id('note-date-kicker').textContent=global?'Across your Daybook':ctx.selectedDate===ctx.todayKey()?'Today':'Selected day';
    id('note-date-title').textContent=global
      ?`${rows.length} search result${rows.length===1?'':'s'}`
      :date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});

    const words=rows.reduce((total,note)=>total+note.body.trim().split(/\s+/).filter(Boolean).length,0);
    const kinds=new Set(rows.map(note=>note.category)).size;
    const insights=id('note-insights');
    insights.replaceChildren();
    for(const [label,value,color] of [['Entries',rows.length,'#426b5b'],['Words',words,'#3f718b'],['Kinds',kinds,'#a66f2d']]){
      const item=el('div','note-insight');
      const copy=el('span');
      item.style.setProperty('--insight',color);
      copy.append(el('small','',label),el('strong','',String(value)));
      item.append(el('i'),copy);
      insights.append(item);
    }

    const list=id('note-list');
    list.replaceChildren();
    if(!rows.length){
      const empty=el('div','empty-state');
      empty.append(
        el('strong','',search?'No notes match that search':'This page is still quiet'),
        el('span','',search?'Try fewer words.':'Capture the first useful thing above.')
      );
      list.append(empty);return;
    }
    for(const note of rows){
      const card=el('article','note-item');
      const head=el('header');
      const tools=el('div');
      const edit=button('',`Edit note`,'Edit');
      const remove=button('',`Delete note`,'Delete');
      const footer=el('footer');
      const stamp=new Date(note.updatedAt);
      card.dataset.kind=note.category;
      edit.dataset.noteEdit=note.id;
      remove.dataset.noteDelete=note.id;
      tools.append(edit,remove);
      head.append(el('span','',note.category),tools);
      footer.append(
        el('span','',stamp.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})),
        el('b','',note.syncedAt?'Copied to OneNote':'Local')
      );
      card.append(head,el('p','',note.body),footer);
      list.append(card);
    }
  };

  ctx.saveNote=event=>{
    event.preventDefault();
    const body=id('note-input').value.trim();
    if(!body){ctx.toast('Write something first');return}
    const now=new Date().toISOString();
    if(ctx.editingNoteId){
      const note=ctx.notes.find(item=>item.id===ctx.editingNoteId);
      if(!note){ctx.resetNoteComposer();ctx.toast('That note is no longer available');return}
      note.body=body.slice(0,6000);
      note.category=id('note-category').value;
      note.updatedAt=now;
      note.syncedAt=0;
      ctx.storeNotes('note-edit');
      ctx.resetNoteComposer();
      ctx.renderAll?.();
      ctx.toast('Note updated locally');
      void ctx.syncOneNote?.(false);
      return;
    }
    const note={
      id:ctx.uid('note'),date:ctx.selectedDate,body:body.slice(0,6000),category:id('note-category').value,
      createdAt:now,updatedAt:now,syncedAt:0,syncError:''
    };
    ctx.notes.push(note);
    ctx.storeNotes('note-add');
    ctx.addMoment('note','Note captured',ctx.cleanText(body,80),Date.now(),'note');
    ctx.resetNoteComposer();
    id('note-save-status').textContent='Saved locally';
    ctx.renderAll?.();
    ctx.toast('Note kept locally');
    void ctx.syncOneNote?.(false);
  };

  ctx.editNote=note=>{
    ctx.editingNoteId=note.id;
    ctx.selectedDate=note.date;
    ctx.calendarCursor=new Date(`${note.date}T12:00:00`);
    id('note-input').value=note.body;
    id('note-category').value=note.category;
    id('note-form').dataset.editing='true';
    id('note-submit').textContent='Update note';
    id('note-cancel').hidden=false;
    id('note-save-status').textContent='Editing local note';
    id('note-count').textContent=`${note.body.length} / 6000`;
    ctx.renderNotes();
    id('note-form').scrollIntoView({behavior:'smooth',block:'center'});
    id('note-input').focus({preventScroll:true});
  };

  ctx.resetNoteComposer=()=>{
    ctx.editingNoteId='';
    id('note-input').value='';
    id('note-form').dataset.editing='false';
    id('note-submit').textContent='Keep this';
    id('note-cancel').hidden=true;
    id('note-save-status').textContent='Saved on this device';
    id('note-count').textContent='0 / 6000';
  };

  ctx.deleteNote=async note=>{
    const confirmed=await ctx.confirmAction?.('Delete this note?','This removes the local note. Your downloaded backups are not changed.');
    if(!confirmed)return;
    ctx.notes=ctx.notes.filter(item=>item.id!==note.id);
    if(ctx.editingNoteId===note.id)ctx.resetNoteComposer();
    ctx.storeNotes('note-delete');
    ctx.renderAll?.();
    ctx.toast('Note deleted');
  };
}
