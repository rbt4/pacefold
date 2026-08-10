'use strict';
const fs=require('node:fs');
const file='canonical/app/pacefold-v25-private.js';
let src=fs.readFileSync(file,'utf8');
if(!src.includes('function bindSpatialNavigation(){')){
  const anchor="function queue(){if(frame)return;frame=requestAnimationFrame(reconcile)}\nfunction install(){\n";
  const next="function queue(){if(frame)return;frame=requestAnimationFrame(reconcile)}\nfunction bindSpatialNavigation(){const spatial=window.__PACEFOLD_SPATIAL__;if(!spatial||typeof spatial.go!=='function'||spatial.__privacyBound)return;const original=spatial.go.bind(spatial);spatial.go=(mode,...args)=>{const result=original(mode,...args);queue();requestAnimationFrame(queue);setTimeout(queue,380);return result};Object.defineProperty(spatial,'__privacyBound',{value:true,configurable:true})}\nfunction install(){\n";
  if(!src.includes(anchor))throw new Error('Private install anchor missing');
  src=src.replace(anchor,next);
}
const installOld="  if(observer)return;queue();\n  observer=new MutationObserver";
const installNew="  if(observer)return;bindSpatialNavigation();queue();\n  observer=new MutationObserver";
if(src.includes(installOld))src=src.replace(installOld,installNew);else if(!src.includes('if(observer)return;bindSpatialNavigation();queue();'))throw new Error('Spatial binding install anchor missing');
fs.writeFileSync(file,src);
console.log('Private NOW now reconciles directly from spatial navigation');
