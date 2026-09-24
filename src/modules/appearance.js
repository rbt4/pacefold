import{id,el,button}from'./state.js';

// Light paper by day, a dark folio in the evening. "system" follows the device.
const CHOICES=[['system','System'],['light','Light'],['dark','Dark']];
const THEME_COLOR={light:'#e9e4d8',dark:'#111916'};

export function installAppearance(ctx){
  const root=document.documentElement,media=matchMedia('(prefers-color-scheme: dark)');
  const choice=()=>CHOICES.some(([value])=>value===ctx.prefs.appearance)?ctx.prefs.appearance:'system';
  const apply=()=>{
    const theme=choice()==='system'?(media.matches?'dark':'light'):choice();
    root.dataset.theme=theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',THEME_COLOR[theme]);
    for(const control of document.querySelectorAll('[data-appearance]'))control.setAttribute('aria-pressed',String(control.dataset.appearance===choice()));
  };

  const panel=document.querySelector('[data-settings-panel="essentials"] .toggle-grid');
  if(panel&&!id('appearance-setting')){
    const row=el('section','appearance-setting');row.id='appearance-setting';
    const copy=el('span');copy.append(el('strong','','Appearance'),el('small','','System follows your device’s light or dark setting'));
    const group=el('div','appearance-choices');group.setAttribute('role','group');group.setAttribute('aria-label','Appearance');
    for(const[value,label]of CHOICES){
      const control=button('',`${label} appearance`,label);control.dataset.appearance=value;
      control.addEventListener('click',()=>{ctx.storePrefs({appearance:value},'appearance');apply()});
      group.append(control);
    }
    row.append(copy,group);panel.after(row);
  }

  media.addEventListener?.('change',apply);
  window.addEventListener('storage',event=>{if(event.key===ctx.KEYS.prefs)apply()});
  apply();
  ctx.applyAppearance=apply;
}
