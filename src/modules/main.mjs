import{createContext}from'./state.js';
import{installCueStore}from'./cue-store.js';
import{installSchedule}from'./schedule.js';
import{installCues}from'./cues.js';
import{installWindowCues}from'./window-cues.js';
import{installClock}from'./clock.js';
import{installNotes}from'./notes.js';
import{installStartCover}from'./start-cover.js';
import{installDaylog}from'./daylog.js';
import{installNow}from'./now.js';
import{installSettings}from'./settings.js';
import{installSync}from'./sync.js';
import{installEdges}from'./edges.js';
import{installRelease}from'./release.js';
import{installApp}from'./app.js';

const ctx=createContext();
ctx.prefs.rhythmDiscretion=['names','neutral','hidden'].includes(ctx.prefs.rhythmDiscretion)?ctx.prefs.rhythmDiscretion:'neutral';
installCueStore(ctx);
installSchedule(ctx);
installCues(ctx);
installWindowCues(ctx);
installClock(ctx);
installNotes(ctx);
installStartCover(ctx);
installDaylog(ctx);
installNow(ctx);
installSettings(ctx);
installSync(ctx);
installEdges(ctx);
installRelease(ctx);
installApp(ctx);

ctx.initialize().catch(error=>{
  console.error(error);
  const toast=document.getElementById('toast');
  if(toast){toast.textContent='Pacefold could not finish loading';toast.classList.add('on')}
  document.documentElement.classList.add('ready');
});
