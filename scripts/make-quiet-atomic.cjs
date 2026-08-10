'use strict';
const fs=require('node:fs');
let core=fs.readFileSync('canonical/app/pacefold-v25-core.js','utf8');
const oldQuiet="const quiet=button('pf25Spatial-quiet','Toggle Quiet mode','Quiet');quiet.id='pf25Spatial-quiet';quiet.addEventListener('click',()=>{window.__PACEFOLD_QUIET__?.toggle?.();refresh(true)});";
const newQuiet="const quiet=button('pf25Spatial-quiet','Toggle Quiet mode','Quiet');quiet.id='pf25Spatial-quiet';quiet.addEventListener('click',()=>{window.__PACEFOLD_QUIET__?.toggle?.();refresh(true);window.dispatchEvent(new CustomEvent('pacefold:quiet'))});";
if(core.includes(oldQuiet))core=core.replace(oldQuiet,newQuiet);else if(!core.includes("window.dispatchEvent(new CustomEvent('pacefold:quiet'))"))throw new Error('Quiet topbar handler anchor missing');
fs.writeFileSync('canonical/app/pacefold-v25-core.js',core);

let privacy=fs.readFileSync('canonical/app/pacefold-v25-private.js','utf8');
const oldEvents="for(const event of ['pacefold:prefs','pacefold:quiet','pacefold:storage-changed','pacefold:experience-ready'])window.addEventListener(event,queue);window.addEventListener('pacefold:spatial-ready',()=>{bindSpatialNavigation();queue();requestAnimationFrame(queue)});";
const newEvents="for(const event of ['pacefold:prefs','pacefold:storage-changed','pacefold:experience-ready'])window.addEventListener(event,queue);window.addEventListener('pacefold:quiet',()=>{quietPass();queue()});window.addEventListener('pacefold:spatial-ready',()=>{bindSpatialNavigation();queue();requestAnimationFrame(queue)});";
if(privacy.includes(oldEvents))privacy=privacy.replace(oldEvents,newEvents);else if(!privacy.includes("window.addEventListener('pacefold:quiet',()=>{quietPass();queue()})"))throw new Error('Privacy Quiet listener anchor missing');
fs.writeFileSync('canonical/app/pacefold-v25-private.js',privacy);
console.log('Quiet transition now enters the privacy safe-surface in the same interaction');
