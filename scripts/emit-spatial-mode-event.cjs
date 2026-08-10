'use strict';
const fs=require('node:fs');
const corePath='canonical/app/pacefold-v25-core.js';
let core=fs.readFileSync(corePath,'utf8');
const needle="sessionStorage.setItem('pacefold.spatial.mode',mode);";
const replacement="sessionStorage.setItem('pacefold.spatial.mode',mode);window.dispatchEvent(new CustomEvent('pacefold:spatial-mode',{detail:{mode}}));";
if(core.includes(needle)&&!core.includes("new CustomEvent('pacefold:spatial-mode'"))core=core.replace(needle,replacement);
else if(!core.includes("new CustomEvent('pacefold:spatial-mode'"))throw new Error('Spatial go() mode persistence anchor missing');
fs.writeFileSync(corePath,core);

const privatePath='canonical/app/pacefold-v25-private.js';
let privacy=fs.readFileSync(privatePath,'utf8');
const spatialReady="window.addEventListener('pacefold:spatial-ready',()=>{bindSpatialNavigation();queue();requestAnimationFrame(queue)});";
const withMode="window.addEventListener('pacefold:spatial-mode',()=>{queue();requestAnimationFrame(queue)});"+spatialReady;
if(privacy.includes(spatialReady)&&!privacy.includes("window.addEventListener('pacefold:spatial-mode'"))privacy=privacy.replace(spatialReady,withMode);
else if(!privacy.includes("window.addEventListener('pacefold:spatial-mode'"))throw new Error('Privacy spatial-ready listener anchor missing');
fs.writeFileSync(privatePath,privacy);
console.log('Spatial mode changes now emit a first-class event consumed by the privacy layer');
