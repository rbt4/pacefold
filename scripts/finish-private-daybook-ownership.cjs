'use strict';
const fs=require('node:fs');
const privatePath='canonical/app/pacefold-v25-private.js';
let js=fs.readFileSync(privatePath,'utf8');
const oldToggle="function toggleDaybook(){const {tray,toggle}=daybookElements();if(!tray)return;if(toggle){toggle.click();setTimeout(syncDaybook,0);return}tray.dataset.open=tray.dataset.open==='true'?'false':'true';syncDaybook()}\nfunction closeDaybook(){const {tray,toggle}=daybookElements();if(!tray||tray.dataset.open!=='true')return;if(toggle)toggle.click();else tray.dataset.open='false';clearTimeout(daybookTimer);daybookTimer=0;setTimeout(syncDaybook,0)}";
const newToggle="function setPrivateDaybook(open){const {tray,toggle}=daybookElements();if(!tray)return;tray.dataset.open=String(Boolean(open));if(toggle){toggle.textContent=open?'Close':'Open';toggle.setAttribute('aria-expanded',String(Boolean(open)))}syncDaybook()}\nfunction toggleDaybook(){const {tray}=daybookElements();if(!tray)return;setPrivateDaybook(tray.dataset.open!=='true')}\nfunction closeDaybook(){const {tray}=daybookElements();if(!tray||tray.dataset.open!=='true')return;clearTimeout(daybookTimer);daybookTimer=0;setPrivateDaybook(false)}";
if(js.includes(oldToggle))js=js.replace(oldToggle,newToggle);else if(!js.includes('function setPrivateDaybook(open)'))throw new Error('Private Daybook ownership anchor missing');
fs.writeFileSync(privatePath,js);

const auditPath='scripts/v25-audit.cjs';
let audit=fs.readFileSync(auditPath,'utf8');
audit=audit.replaceAll("page.click('#pf25-daybook-toggle',{force:true})","page.click('#pf25-private-daybook-spine')");
audit=audit.replaceAll("page.click('#pf25-daybook-toggle')","page.click('#pf25-private-daybook-spine')");
if(!audit.includes("page.click('#pf25-private-daybook-spine')"))throw new Error('Functional audit Daybook hook was not updated');
fs.writeFileSync(auditPath,audit);
console.log('Private Daybook now owns its state; legacy audit exercises the real fold');
