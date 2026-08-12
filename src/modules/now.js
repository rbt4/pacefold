import{id,el}from'./state.js';

const WEATHER_CODES={
  0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',
  51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Showers',82:'Heavy showers',95:'Thunderstorm'
};

export function installNow(ctx){
  ctx.weatherCode=code=>WEATHER_CODES[code]||'Current conditions';
  ctx.weatherClock=value=>{
    const text=String(value||''),hour=Number(text.slice(11,13)),minute=Number(text.slice(14,16));
    if(!Number.isFinite(hour)||!Number.isFinite(minute))return'—';
    if(ctx.prefs.timeFormat==='24')return`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
    return`${hour%12||12}:${String(minute).padStart(2,'0')} ${hour<12?'AM':'PM'}`;
  };

  ctx.fetchWeather=async(force=false)=>{
    if(!ctx.prefs.weatherEnabled||ctx.weatherBusy)return;
    const cached=ctx.safeGet(ctx.KEYS.weather,null);
    if(!force&&cached&&Date.now()-cached.savedAt<20*60000){ctx.renderWeather(cached);return}
    ctx.weatherBusy=true;
    try{
      const query=new URLSearchParams({
        latitude:String(ctx.prefs.lat),longitude:String(ctx.prefs.lng),
        current:'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
        hourly:'temperature_2m,precipitation_probability,precipitation,weather_code',
        daily:'sunrise,sunset,uv_index_max',
        timezone:ctx.prefs.timeZone,forecast_days:'1'
      });
      const response=await fetch(`https://api.open-meteo.com/v1/forecast?${query}`);
      if(!response.ok)throw new Error(`Weather ${response.status}`);
      const data=await response.json();
      const value={savedAt:Date.now(),current:data.current,units:data.current_units,hourly:data.hourly,hourlyUnits:data.hourly_units,daily:data.daily,dailyUnits:data.daily_units};
      localStorage.setItem(ctx.KEYS.weather,JSON.stringify(value));
      ctx.renderWeather(value);
    }catch(error){
      const cached=ctx.safeGet(ctx.KEYS.weather,null);
      if(cached?.current){ctx.renderWeather(cached);ctx.toast?.('Weather refresh failed · showing cached conditions')}
      else id('weather-content').replaceChildren(el('p','',navigator.onLine?'Weather could not refresh.':'Offline · no cached weather yet.'));
      console.warn(error);
    }finally{ctx.weatherBusy=false}
  };

  ctx.renderWeather=(value=ctx.safeGet(ctx.KEYS.weather,null))=>{
    const discreet=ctx.rhythmMode?.()!=='names';
    id('weather-place').textContent=discreet?'Local conditions':(ctx.prefs.locationLabel||'Local conditions');
    const content=id('weather-content');
    if(!ctx.prefs.weatherEnabled){content.replaceChildren(el('p','','Weather is off in Settings.'));return}
    if(!value?.current){content.replaceChildren(el('p','','Weather will appear after the next refresh.'));return}
    const current=value.current,hourly=value.hourly||{},daily=value.daily||{};
    const reading=el('div','weather-reading'),detail=el('span');
    detail.append(
      el('b','',ctx.weatherCode(current.weather_code)),
      el('small','',`Feels ${Math.round(current.apparent_temperature)}° · wind ${Math.round(current.wind_speed_10m)} km/h`)
    );
    reading.append(el('strong','',`${Math.round(current.temperature_2m)}°`),detail);

    const children=[reading];
    if(Array.isArray(hourly.time)&&hourly.time.length){
      const currentStamp=String(current.time||''),found=hourly.time.findIndex(time=>String(time)>=currentStamp),from=found>=0?found:Math.max(0,hourly.time.length-1);
      const rainIndex=hourly.time.slice(from,from+12).findIndex((_,offset)=>Number(hourly.precipitation_probability?.[from+offset])>=35||Number(hourly.precipitation?.[from+offset])>.1);
      const rain=el('div','weather-rain-window');
      if(rainIndex>=0){const index=from+rainIndex,prob=Math.round(Number(hourly.precipitation_probability?.[index])||0),amount=Number(hourly.precipitation?.[index])||0;rain.append(el('small','','Rain window'),el('strong','',`${ctx.weatherClock(hourly.time[index])} · ${prob}%`),el('span','',amount>0?`${amount.toFixed(1)} mm forecast`:'Precipitation possible'))}
      else rain.append(el('small','','Rain window'),el('strong','','No signal in next 12h'),el('span','','No meaningful precipitation showing nearby.'));
      children.push(rain);

      const nowcast=el('div','weather-nowcast');
      for(let offset=0;offset<2;offset+=1){const index=from+offset;if(!hourly.time[index])continue;const card=el('article','weather-hour');card.append(el('small','',offset?'Next hour':'This hour'),el('strong','',`${Math.round(Number(hourly.temperature_2m?.[index])||0)}°`),el('span','',`${ctx.weatherCode(hourly.weather_code?.[index])} · ${Math.round(Number(hourly.precipitation_probability?.[index])||0)}%`));nowcast.append(card)}
      if(nowcast.children.length)children.push(nowcast);
    }else children.push(el('p','weather-current-precip',current.precipitation>0?`${current.precipitation} mm precipitation now.`:'No measurable precipitation now.'));

    if(Array.isArray(daily.time)&&daily.time.length){
      const detailGrid=el('div','weather-detail-grid'),items=[
        ['Sunrise',ctx.weatherClock(daily.sunrise?.[0])],
        ['Sunset',ctx.weatherClock(daily.sunset?.[0])],
        ['UV max',Number.isFinite(Number(daily.uv_index_max?.[0]))?Number(daily.uv_index_max[0]).toFixed(1):'—']
      ];
      for(const[label,text]of items){const item=el('span','weather-mini');item.append(el('small','',label),el('strong','',text));detailGrid.append(item)}
      children.push(detailGrid);
    }
    content.replaceChildren(...children);
  };
}
