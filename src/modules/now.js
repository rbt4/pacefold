import{id,el}from'./state.js';

const WEATHER_CODES={
  0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',
  51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Showers',82:'Heavy showers',95:'Thunderstorm'
};

export function installNow(ctx){
  ctx.weatherCode=code=>WEATHER_CODES[code]||'Current conditions';

  ctx.fetchWeather=async(force=false)=>{
    if(!ctx.prefs.weatherEnabled||ctx.weatherBusy)return;
    const cached=ctx.safeGet(ctx.KEYS.weather,null);
    if(!force&&cached&&Date.now()-cached.savedAt<20*60000){ctx.renderWeather(cached);return}
    ctx.weatherBusy=true;
    try{
      const query=new URLSearchParams({
        latitude:String(ctx.prefs.lat),longitude:String(ctx.prefs.lng),
        current:'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
        timezone:ctx.prefs.timeZone,forecast_days:'1'
      });
      const response=await fetch(`https://api.open-meteo.com/v1/forecast?${query}`);
      if(!response.ok)throw new Error(`Weather ${response.status}`);
      const data=await response.json();
      const value={savedAt:Date.now(),current:data.current,units:data.current_units};
      localStorage.setItem(ctx.KEYS.weather,JSON.stringify(value));
      ctx.renderWeather(value);
    }catch(error){
      id('weather-content').replaceChildren(el('p','',navigator.onLine?'Weather could not refresh.':'Offline · showing no cached weather.'));
      console.warn(error);
    }finally{ctx.weatherBusy=false}
  };

  ctx.renderWeather=(value=ctx.safeGet(ctx.KEYS.weather,null))=>{
    id('weather-place').textContent=ctx.prefs.locationLabel||'Outside';
    const content=id('weather-content');
    if(!ctx.prefs.weatherEnabled){content.replaceChildren(el('p','','Weather is off in Settings.'));return}
    if(!value?.current){content.replaceChildren(el('p','','Weather will appear after the next refresh.'));return}
    const current=value.current;
    const reading=el('div','weather-reading');
    const detail=el('span');
    detail.append(
      el('b','',ctx.weatherCode(current.weather_code)),
      el('small','',`Feels ${Math.round(current.apparent_temperature)}° · wind ${Math.round(current.wind_speed_10m)} km/h`)
    );
    reading.append(el('strong','',`${Math.round(current.temperature_2m)}°`),detail);
    content.replaceChildren(
      reading,
      el('p','',current.precipitation>0?`${current.precipitation} mm precipitation now.`:'No measurable precipitation now.')
    );
  };
}
