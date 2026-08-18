import{id,el}from'./state.js';

export function installAmbient(ctx){
  const cover=id('pace-cover');
  if(!cover||id('cover-ambient'))return;

  const ambient=el('div','cover-ambient');ambient.id='cover-ambient';ambient.setAttribute('aria-hidden','true');cover.prepend(ambient);
  const clock=id('cover-date')?.parentElement;
  const dayline=el('div','cover-dayline');dayline.id='cover-dayline';dayline.setAttribute('role','img');
  dayline.append(el('i'),el('b'));
  clock?.append(dayline);

  const renderDayline=()=>{
    const now=new Date(),part=ctx.zoneParts(now,ctx.prefs.timeZone),range=ctx.workRange(ctx.prefs,now),decimal=part.hour+part.minute/60;
    const progress=range.activeDay?ctx.clamp((decimal-range.start)/(range.end-range.start),0,1,0):0;
    const state=!range.activeDay?'off':decimal<range.start?'before':decimal>range.end?'after':'active';
    dayline.dataset.state=state;dayline.style.setProperty('--cover-day-progress',`${Math.round(progress*1000)/10}%`);
    const label=!range.activeDay?'Off day':state==='before'?'Workday has not started':state==='after'?'Workday complete':`${Math.round(progress*100)}% of workday`;
    dayline.setAttribute('aria-label',label);
  };
  renderDayline();setInterval(renderDayline,60000);

  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let frame=0;
  const paint=(x,y)=>{
    cover.style.setProperty('--ambient-left',`${(50+x*5).toFixed(2)}%`);
    cover.style.setProperty('--ambient-top',`${(42+y*4).toFixed(2)}%`);
    cover.style.setProperty('--ambient-x',`${(x*2.2).toFixed(2)}px`);
    cover.style.setProperty('--ambient-y',`${(y*1.6).toFixed(2)}px`);
  };
  cover.addEventListener('pointermove',event=>{
    if(frame)cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const rect=cover.getBoundingClientRect(),x=ctx.clamp((event.clientX-rect.left)/Math.max(1,rect.width)*2-1,-1,1,0),y=ctx.clamp((event.clientY-rect.top)/Math.max(1,rect.height)*2-1,-1,1,0);
      paint(x,y);
    });
  },{passive:true});
  cover.addEventListener('pointerleave',()=>paint(0,0),{passive:true});
}
