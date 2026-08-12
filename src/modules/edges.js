import{$,$$,id,el,button}from'./state.js';

const EDGE_META={
  notes:{icon:'↑',label:'Notes',kicker:'Daybook'},
  worklog:{icon:'←',label:'Day',kicker:'Day log'},
  now:{icon:'→',label:'Now',kicker:'Next'},
  settings:{icon:'↓',label:'Settings',kicker:'Setup'}
};

export function installEdges(ctx){
  ctx.edgeTimers=new WeakMap();
  ctx.edgeRefreshTimers=new WeakMap();

  ctx.edgePreview=target=>{
    const now=new Date();
    if(target==='notes'){
      const recent=[...ctx.notes].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt))[0];
      const count=ctx.notesForDate?.(ctx.todayKey())?.length??ctx.notes.filter(note=>note.date===ctx.todayKey()).length;
      return{
        title:recent?ctx.cleanText(recent.body.split('\n')[0],68):'No notes yet',
        detail:`${count} note${count===1?'':'s'} today`
      };
    }
    if(target==='worklog'){
      const open=['focus','field','prep','away','meal'].map(source=>ctx.findOpen(source)).filter(Boolean);
      if(!open.length)return{title:'Nothing running',detail:'The day is clear'};
      const lead=open[0];
      return{title:lead.label||'Session running',detail:`${ctx.durationText(Date.now()-lead.start)} elapsed${open.length>1?` · ${open.length} open`:''}`};
    }
    if(target==='now'){
      const next=ctx.getSchedule(now).next;
      return{
        title:next?ctx.clockMomentLabel(next):'Today complete',
        detail:next?ctx.relativeUntil(next.date,now):'No next moment today'
      };
    }
    const[start,end]=ctx.prefs.workHours.split('-');
    return{title:`${start}–${end}`,detail:ctx.prefs.quietMode?'Quiet mode on':'Quiet mode off'};
  };

  ctx.renderEdgePreview=edge=>{
    const target=edge.dataset.go,preview=edge.querySelector('.edge-preview');
    if(!preview)return;
    const copy=ctx.edgePreview(target);
    preview.querySelector('strong').textContent=copy.title;
    preview.querySelector('small').textContent=copy.detail;
    preview.dataset.renderedAt=String(Date.now());
  };

  ctx.expandEdge=edge=>{
    clearTimeout(ctx.edgeTimers.get(edge));
    const timer=setTimeout(()=>{
      ctx.renderEdgePreview(edge);
      edge.classList.add('is-expanded');
      const previous=ctx.edgeRefreshTimers.get(edge);if(previous)clearInterval(previous);
      ctx.edgeRefreshTimers.set(edge,setInterval(()=>{if(edge.classList.contains('is-expanded'))ctx.renderEdgePreview(edge)},60000));
    },120);
    ctx.edgeTimers.set(edge,timer);
  };

  ctx.collapseEdge=edge=>{
    clearTimeout(ctx.edgeTimers.get(edge));
    const timer=setTimeout(()=>{
      edge.classList.remove('is-expanded');
      const refresh=ctx.edgeRefreshTimers.get(edge);if(refresh)clearInterval(refresh);
      ctx.edgeRefreshTimers.delete(edge);
    },260);
    ctx.edgeTimers.set(edge,timer);
  };

  ctx.buildEdges=()=>{
    const fine=matchMedia('(hover: hover) and (pointer: fine)');
    for(const edge of $$('.edge-nav .edge[data-go]')){
      const meta=EDGE_META[edge.dataset.go];if(!meta)continue;
      edge.replaceChildren();
      const rail=el('i','edge-rail');rail.setAttribute('aria-hidden','true');
      const icon=el('span','edge-icon',meta.icon);icon.setAttribute('aria-hidden','true');
      const label=el('span','edge-label',meta.label);
      const preview=el('span','edge-preview');
      const previewCopy=el('span');previewCopy.append(el('b','',meta.kicker),el('strong','',''),el('small','',''));
      preview.append(previewCopy);edge.append(rail,icon,label,preview);
      edge.setAttribute('aria-label',`Open ${meta.label}`);
      if(fine.matches){
        edge.addEventListener('pointerenter',()=>ctx.expandEdge(edge));
        edge.addEventListener('pointerleave',()=>ctx.collapseEdge(edge));
      }
      edge.addEventListener('focus',()=>ctx.expandEdge(edge));
      edge.addEventListener('blur',()=>ctx.collapseEdge(edge));
    }

    if(!id('mobile-nav')){
      const nav=el('nav','mobile-nav');nav.id='mobile-nav';nav.setAttribute('aria-label','Pacefold views');
      for(const target of['notes','worklog','now','settings']){
        const meta=EDGE_META[target],control=button('',`Open ${meta.label}`);
        control.dataset.go=target;
        control.append(el('span','',meta.icon),el('small','',meta.label));
        nav.append(control);
      }
      document.body.append(nav);
    }
  };

  ctx.buildEdges();
}
