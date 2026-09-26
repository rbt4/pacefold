import{$,id,el,button}from'./state.js';

// Clock's centrepiece: a 24-hour dial with noon at the top, so the sun climbs the
// left side and sets on the right like the sky behind it. Rings, outside in:
// hourly temperature, workday, daylight band with moments and the sun (or moon),
// quarter-hour ticks, and a sweeping seconds track around the digital time.
const SVG='http://www.w3.org/2000/svg';
const R={temp:372,work:348,band:326,tick:300,label:272,seconds:238,moment:398,cue:352};
const svg=(tag,attrs={})=>{const n=document.createElementNS(SVG,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n};
// Solar noon sits at the top, so sunrise and sunset are level: a true horizon.
let noon=12;
const angle=hour=>-Math.PI/2+((hour-noon)/24)*2*Math.PI;
const pt=(hour,r)=>[Math.cos(angle(hour))*r,Math.sin(angle(hour))*r];
const arc=(h0,h1,r)=>{const span=((h1-h0)%24+24)%24,[x0,y0]=pt(h0,r),[x1,y1]=pt(h0+span,r);return`M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${span>12?1:0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`};
const STOPS=[[-20,[86,110,196]],[-5,[96,150,222]],[5,[111,180,200]],[14,[140,205,170]],[22,[242,193,78]],[30,[238,128,79]],[38,[206,70,70]]];
const colour=t=>{if(t<=STOPS[0][0])return`rgb(${STOPS[0][1]})`;for(let i=1;i<STOPS.length;i+=1){const[t1,c1]=STOPS[i];if(t<=t1){const[t0,c0]=STOPS[i-1],k=(t-t0)/(t1-t0);return`rgb(${c0.map((v,j)=>Math.round(v+(c1[j]-v)*k)).join(',')})`}}return`rgb(${STOPS.at(-1)[1]})`};

export function installHorizonDial(ctx){
  const view=$('.view-home');
  if(!view||id('horizon'))return;
  document.documentElement.dataset.horizon='dial';

  const stage=el('section','horizon');stage.id='horizon';stage.setAttribute('aria-label','Clock');
  const left=el('aside','horizon-left'),right=el('aside','horizon-right'),center=el('div','horizon-center');
  const face=svg('svg',{class:'dial',viewBox:'-480 -480 960 960',role:'img','aria-label':'24-hour day'});
  const defs=svg('defs'),clip=svg('clipPath',{id:'dial-clip'});clip.append(svg('circle',{r:386}));defs.append(clip);face.append(defs);
  const layer=name=>{const g=svg('g',{class:`dial-${name}`});face.append(g);return g};
  const below=layer('below'),temp=layer('temp'),band=layer('band'),work=layer('work'),ticks=layer('ticks'),labels=layer('labels'),horizon=layer('horizon'),moments=layer('moments'),now=layer('now'),cues=layer('cues'),seconds=layer('seconds');
  const readout=el('div','dial-readout');
  const digital=$('.view-home .digital'),date=id('clock-date'),next=id('next-moment');
  if(digital)readout.append(digital);if(date)readout.append(date);if(next)readout.append(next);
  const dial=el('div','dial-wrap');dial.append(el('div','dial-aura'),face,readout);
  center.append(dial);

  const week=id('week-sky'),guide=id('v28-guide'),dock=$('.view-home .action-dock');
  if(week)left.append(week);
  if(guide)right.append(guide);
  if(dock)right.append(dock);

  const composer=$('.view-home .clock-note-compose'),shelf=el('div','horizon-dock');
  if(composer)shelf.append(composer);
  stage.append(left,center,right,shelf);
  view.prepend(stage);

  // Seconds: 60 quiet dots and one bright bead that sweeps with --second-angle.
  for(let s=0;s<60;s+=1){const a=-Math.PI/2+s/60*2*Math.PI;seconds.append(svg('circle',{cx:(Math.cos(a)*R.seconds).toFixed(1),cy:(Math.sin(a)*R.seconds).toFixed(1),r:s%5?1.3:2.2,class:'dial-second-dot'}))}
  // The invisible full circle gives the group a bounding box centred on the dial,
  // so CSS can rotate it about the centre with transform-box:fill-box.
  const bead=svg('g',{class:'dial-second-bead'});bead.append(svg('circle',{r:R.seconds,class:'bead-orbit'}),svg('circle',{cx:0,cy:-R.seconds,r:5.5,class:'bead'}));seconds.append(bead);

  const cardinal=()=>{
    ticks.replaceChildren();
    for(let q=0;q<96;q+=1){const h=q/4,major=q%4===0,[x0,y0]=pt(h,R.tick-(major?(h%6===0?16:10):5)),[x1,y1]=pt(h,R.tick+4);ticks.append(svg('line',{x1:x0.toFixed(1),y1:y0.toFixed(1),x2:x1.toFixed(1),y2:y1.toFixed(1),class:major?(h%6===0?'tick-cardinal':'tick-hour'):'tick-quarter'}))}
    labels.replaceChildren();
    const twelve=ctx.prefs.timeFormat!=='24';
    for(const[h,text]of[[12,twelve?'Noon':'12:00'],[18,twelve?'6 PM':'18:00'],[0,twelve?'Midnight':'00:00'],[6,twelve?'6 AM':'06:00']]){
      const[x,y]=pt(h,R.label);const t=svg('text',{x:x.toFixed(1),y:(y+5).toFixed(1),class:h%12?'dial-cardinal is-side':'dial-cardinal','text-anchor':'middle'});t.textContent=text;labels.append(t);
    }
  };

  const decimal=date=>{const p=ctx.zoneParts(date,ctx.prefs.timeZone);return p.hour+p.minute/60+p.second/3600};
  let horizonY=0;

  function renderDial(date=new Date()){
    if(!stage.isConnected)return;
    const sky=ctx.skyState?.()||{sunrise:6.5,sunset:19,day:true},hour=decimal(date);
    noon=(sky.sunrise+sky.sunset)/2;
    cardinal();
    // Horizon: the chord through sunrise and sunset, carried out to the edge of the world.
    const[sx,sy]=pt(sky.sunrise,R.band),[ex,ey]=pt(sky.sunset,R.band),slope=(ey-sy)/(ex-sx||1),yAt=x=>sy+slope*(x-sx);
    horizonY=(sy+ey)/2;
    horizon.replaceChildren(svg('line',{x1:-480,y1:yAt(-480).toFixed(1),x2:480,y2:yAt(480).toFixed(1),class:'dial-horizon'}));
    below.replaceChildren(svg('path',{d:`M-480 ${yAt(-480).toFixed(1)} L480 ${yAt(480).toFixed(1)} L480 480 L-480 480 Z`,class:'dial-below','clip-path':'url(#dial-clip)'}));

    band.replaceChildren(
      svg('circle',{r:R.band,class:'band-base'}),
      svg('path',{d:arc(sky.sunrise,sky.sunset,R.band),class:'band-day'}),
      svg('path',{d:arc(sky.sunrise-1,sky.sunrise,R.band),class:'band-twilight'}),
      svg('path',{d:arc(sky.sunset,sky.sunset+1,R.band),class:'band-twilight'}),
    );
    if(sky.day)band.append(svg('path',{d:arc(sky.sunrise,hour,R.band),class:'band-elapsed'}));

    const range=ctx.workRange(ctx.prefs,date);work.replaceChildren();
    if(range.activeDay)work.append(svg('path',{d:arc(range.start,range.end,R.work),class:'work-arc','data-lens':'work'}),svg('path',{d:arc(range.start,Math.min(range.end,Math.max(range.start,hour)),R.work),class:'work-done'}));

    temp.replaceChildren();
    const forecast=ctx.weekForecast?.(),hourly=forecast?.hourly,today=ctx.todayKey(date);
    if(hourly?.time?.length){
      hourly.time.forEach((stamp,index)=>{
        if(String(stamp).slice(0,10)!==today)return;
        const h=Number(String(stamp).slice(11,13)),t=Number(hourly.temperature_2m?.[index]);if(!Number.isFinite(t))return;
        const seg=svg('path',{d:arc(h+.08,h+.92,R.temp),class:'temp-seg','data-hour-index':index});seg.style.stroke=colour(t);seg.style.opacity=h<hour-.5?.45:.95;temp.append(seg);
        if(Number(hourly.precipitation_probability?.[index])>=50){const[x,y]=pt(h+.5,R.temp+16);temp.append(svg('circle',{cx:x.toFixed(1),cy:y.toFixed(1),r:2.4,class:'temp-rain'}))}
        if(h%6===3){const[x,y]=pt(h+.5,R.temp-20);const label=svg('text',{x:x.toFixed(1),y:(y+4).toFixed(1),class:'temp-label','text-anchor':'middle'});label.textContent=`${Math.round(t)}°`;temp.append(label)}
      });
    }else temp.append(svg('circle',{r:R.temp,class:'temp-empty'}));

    moments.replaceChildren();
    const state=ctx.getSchedule(date),named=ctx.clockNamesVisible?.(),hidden=ctx.rhythmMode?.()==='hidden';
    for(const item of hidden?[]:state.today){
      if(!Number.isFinite(item.hours))continue;
      const isNext=state.next&&state.next.id===item.id&&ctx.todayKey(state.next.date)===today,past=item.date<date;
      const[x,y]=pt(item.hours,R.band),[lx,ly]=pt(item.hours,R.moment);
      const g=svg('g',{class:`moment${isNext?' is-next':''}${past?' is-past':''}${item.alert?'':' is-quiet'}`,tabindex:0,role:'button','data-lens':'moment','data-key':item.id,'data-at':item.date.getTime(),'data-next':String(Boolean(isNext)),'aria-label':`${named?item.label:'Scheduled moment'} at ${ctx.formatTime(item.date)}`});
      g.append(svg('circle',{cx:x.toFixed(1),cy:y.toFixed(1),r:isNext?9:6,class:'moment-dot'}));
      const anchor=Math.abs(lx)<30?'middle':lx>0?'start':'end',text=svg('text',{x:lx.toFixed(1),y:(ly+5).toFixed(1),'text-anchor':anchor,class:'moment-label'});
      text.textContent=named?`${item.label} ${ctx.formatTime(item.date)}`:ctx.formatTime(item.date);
      g.append(text);g.addEventListener('click',()=>ctx.go?.('now'));
      moments.append(g);
    }

    now.replaceChildren();
    const[nx,ny]=pt(hour,R.band),[hx,hy]=pt(hour,R.temp+8);
    now.append(svg('line',{x1:0,y1:0,x2:hx.toFixed(1),y2:hy.toFixed(1),class:'now-hand'}));
    if(sky.day){now.append(svg('circle',{cx:nx.toFixed(1),cy:ny.toFixed(1),r:34,class:'sun-halo'}),svg('circle',{cx:nx.toFixed(1),cy:ny.toFixed(1),r:15,class:'sun-core'}))}
    else{now.append(svg('circle',{cx:nx.toFixed(1),cy:ny.toFixed(1),r:26,class:'moon-halo'}),svg('circle',{cx:nx.toFixed(1),cy:ny.toFixed(1),r:12,class:'moon-core'}),svg('circle',{cx:(nx+5).toFixed(1),cy:(ny-4).toFixed(1),r:10,class:'moon-shadow'}))}

    now.append(svg('circle',{cx:nx.toFixed(1),cy:ny.toFixed(1),r:44,class:'lens-hit','data-lens':'sky',tabindex:0,role:'img','aria-label':sky.day?'Sun':'Moon'}));

    renderCues();
    syncHorizon();
  }

  function renderCues(){
    cues.replaceChildren();
    for(const cue of(ctx.currentCues||[]).slice(0,7)){
      const h=decimal(new Date(Number(cue.dueAt)||Date.now())),[x,y]=pt(h,R.cue),copy=ctx.clockCueCopy?.(cue)||cue;
      const dot=svg('circle',{cx:x.toFixed(1),cy:y.toFixed(1),r:8,class:'dial-cue',tabindex:0,role:'button','aria-label':`Clear ${copy.label}`});
      dot.style.fill=ctx.CUE_COLORS?.[cue.source]||'#9fe0c2';
      ctx.bindCueGesture?.(dot,cue);
      cues.append(dot);
    }
  }

  // Carry the dial's horizon into the sky so photo, glow and instrument share one line.
  let frame=0;
  function syncHorizon(){
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const root=document.documentElement;
      if(ctx.mode!=='home'||document.documentElement.dataset.cover==='on'){root.style.setProperty('--horizon-y','68vh');return}
      const box=face.getBoundingClientRect();
      if(!box.height)return;
      root.style.setProperty('--horizon-y',`${Math.round(box.top+(horizonY+480)/960*box.height)}px`);
    });
  }
  addEventListener('scroll',syncHorizon,{passive:true});
  addEventListener('resize',syncHorizon);

  // Press and hold the dial to reveal moment names briefly (neutral privacy mode).
  let hold=0;
  face.addEventListener('pointerdown',()=>{clearTimeout(hold);hold=setTimeout(()=>{ctx.revealRhythm?.();renderDial()},650)});
  for(const name of['pointerup','pointerleave','pointercancel'])face.addEventListener(name,()=>clearTimeout(hold));

  const baseRender=ctx.render;
  ctx.render=(...args)=>{const result=baseRender?.(...args);if(ctx.mode==='home')renderDial();else syncHorizon();return result};
  const baseRefresh=ctx.refreshCues;
  ctx.refreshCues=(...args)=>{const result=baseRefresh?.(...args);renderCues();return result};
  const baseInitialize=ctx.initialize;
  ctx.initialize=async()=>{
    const result=await baseInitialize?.();
    renderDial();
    setInterval(()=>{if(!document.hidden&&ctx.mode==='home')renderDial()},60000);
    window.addEventListener('pacefold:week',()=>renderDial());
    new MutationObserver(syncHorizon).observe(document.documentElement,{attributes:true,attributeFilter:['data-cover','data-mode']});
    return result;
  };
  ctx.renderDial=renderDial;

  // Hover cards for the dial (weather-lens.js shows them). Moments stay neutral
  // unless names are visible: passive hover never reveals them.
  const until=ms=>ctx.durationText(Math.max(0,ms));
  const at=hours=>ctx.zonedForToday(hours,new Date());
  const SYNODIC=29.530588853,NEW_MOON=Date.UTC(2000,0,6,18,14);
  const moon=()=>{const phase=(((Date.now()-NEW_MOON)/864e5/SYNODIC)%1+1)%1,lit=Math.round((1-Math.cos(2*Math.PI*phase))/2*100);const name=phase<.03||phase>.97?'New moon':phase<.22?'Waxing crescent':phase<.28?'First quarter':phase<.47?'Waxing gibbous':phase<.53?'Full moon':phase<.72?'Waning gibbous':phase<.78?'Last quarter':'Waning crescent';return{name,lit}};
  ctx.lensProviders=ctx.lensProviders||{};
  ctx.lensProviders.sky=()=>{
    const sky=ctx.skyState?.();if(!sky)return null;
    const now=Date.now(),rise=at(sky.sunrise),set=at(sky.sunset),length=sky.sunset-sky.sunrise,daylight=`${Math.floor(length)}h ${Math.round(length%1*60)}m of daylight`;
    if(sky.day){const golden=new Date(set.getTime()-50*60000);return ctx.lensCard({kicker:'Sun',title:`Sets ${ctx.formatTime(set)}`,value:until(set-now),lines:[now<golden?`Golden hour from about ${ctx.formatTime(golden)}`:'Golden hour now',daylight]})}
    const m=moon(),next=rise.getTime()>now?rise:new Date(rise.getTime()+864e5);
    return ctx.lensCard({kicker:'Moon',title:m.name,value:`${m.lit}%`,lines:[`${m.lit}% illuminated`,`Sunrise ${ctx.formatTime(next)} · in ${until(next-now)}`]});
  };
  ctx.lensProviders.work=()=>{
    const date=new Date(),range=ctx.workRange(ctx.prefs,date),hour=decimal(date);if(!range.activeDay)return null;
    const span=`${ctx.formatTime(at(range.start))} – ${ctx.formatTime(at(range.end))}`;
    if(hour<range.start)return ctx.lensCard({kicker:'Workday',title:span,value:'',lines:[`Starts in ${until((range.start-hour)*3600e3)}`]});
    if(hour>=range.end)return ctx.lensCard({kicker:'Workday',title:span,value:'Done',lines:['The workday is complete']});
    const pct=Math.round((hour-range.start)/(range.end-range.start)*100);
    return ctx.lensCard({kicker:'Workday',title:span,value:`${pct}%`,lines:[`${until((range.end-hour)*3600e3)} left`]});
  };
  ctx.lensProviders.moment=target=>{
    const when=new Date(Number(target.dataset.at));if(!Number.isFinite(when.getTime()))return null;
    const item=ctx.getSchedule(new Date()).today.find(entry=>String(entry.id)===target.dataset.key),named=ctx.clockNamesVisible?.();
    return ctx.lensCard({kicker:target.dataset.next==='true'?'Next moment':when<new Date()?'Earlier today':'Later today',title:named&&item?item.label:'Scheduled moment',value:ctx.formatTime(when),lines:[ctx.relativeUntil(when)]});
  };
}
