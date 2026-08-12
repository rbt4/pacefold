import{createContext}from'./state.js';
import{installSchedule}from'./schedule.js';
import{installCues}from'./cues.js';
import{installClock}from'./clock.js';
import{installNotes}from'./notes.js';
import{installDaylog}from'./daylog.js';
import{installNow}from'./now.js';
import{installSettings}from'./settings.js';
import{installSync}from'./sync.js';
import{installApp}from'./app.js';

const ctx=createContext();
installSchedule(ctx);
installCues(ctx);
installClock(ctx);
installNotes(ctx);
installDaylog(ctx);
installNow(ctx);
installSettings(ctx);
installSync(ctx);
installApp(ctx);

ctx.initialize().catch(error=>{
  console.error(error);
  const toast=document.getElementById('toast');
  if(toast){toast.textContent='Pacefold could not finish loading';toast.classList.add('on')}
  document.documentElement.classList.add('ready');
});
