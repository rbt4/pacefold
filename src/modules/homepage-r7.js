export const HOMEPAGE_REVISION='homepage-r7';

export function installHomepageR7(ctx){
  ctx.REVISION=HOMEPAGE_REVISION;

  // Edge shows favicons at roughly 16px. Large bottom pips stay visible at that size
  // while preserving the live clock and exposing no cue names.
  ctx.cueFavicon=cues=>{
    const list=Array.isArray(cues)?cues.filter(Boolean).slice(0,4):cues?[cues]:[];
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:ctx.prefs.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    const read=type=>Number(parts.find(part=>part.type===type)?.value)||0;
    const hour=read('hour'),minute=read('minute');
    const point=(angle,length)=>{const radians=(angle-90)*Math.PI/180;return{x:32+Math.cos(radians)*length,y:30+Math.sin(radians)*length}};
    const m=point(minute*6,13),h=point((hour%12)*30+minute*.5,8.5);
    const positions=[[17,51],[28,51],[39,51],[50,51]];
    const dots=list.map((cue,index)=>{const[x,y]=positions[index],color=ctx.CUE_COLORS[cue.source]||ctx.CUE_COLORS.focus;return`<circle cx="${x}" cy="${y}" r="5.3" fill="${color}" stroke="#ffffff" stroke-width="1.8"/>`}).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="5" y="5" width="54" height="54" rx="17" fill="#173f45"/><circle cx="32" cy="30" r="18.5" fill="#f7faf9"/><path d="M32 17v3M45 30h-3M32 43v-3M19 30h3" stroke="#7ea99a" stroke-width="2.2" stroke-linecap="round"/><path d="M32 30L${h.x.toFixed(1)} ${h.y.toFixed(1)}M32 30L${m.x.toFixed(1)} ${m.y.toFixed(1)}" stroke="#173f45" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="30" r="2.4" fill="#173f45"/>${dots}</svg>`;
    return`data:image/svg+xml,${encodeURIComponent(svg)}`;
  };

  // A cue arriving or being cleared should repaint the Edge tab immediately,
  // not wait for the 30-second recovery heartbeat.
  const baseRefreshCues=ctx.refreshCues;
  ctx.refreshCues=(notify=false)=>{
    const result=baseRefreshCues?.(notify);
    ctx.renderCueFavicon?.();
    return result;
  };

  const baseInitialize=ctx.initialize;
  ctx.initialize=async()=>{
    await baseInitialize();
    ctx.renderCueFavicon?.();
    const refresh=()=>ctx.notificationHeartbeat?.()||ctx.refreshCues?.(true);
    window.addEventListener('focus',refresh);
    window.addEventListener('pageshow',()=>ctx.renderCueFavicon?.());
  };
}
