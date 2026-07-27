import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, gunzipSync } from 'node:zlib';
import { rewriteInnerHTMLAssignments } from '../scripts/trusted-types-transform.mjs';
const trustedBootstrap="(()=>{if(window.__PACEFOLD_SET_HTML__)return;window.__PACEFOLD_SET_HTML__=(node,value)=>{if(!node)return node;const html=window.__PACEFOLD_TRUSTED_HTML__?window.__PACEFOLD_TRUSTED_HTML__(String(value)):String(value);Reflect.set(node,'innerHTML',html);return node;};})();\n";

const VERSION='15.8.0';
const ASSET_REVISION='15.9.0';
const MARKER=`pacefold-resilience-${VERSION}`;
const targetRoot=path.resolve(process.argv[2]||'_site');
const sourceRoot=path.dirname(fileURLToPath(import.meta.url));
const appRoot=path.join(targetRoot,'app');
const appHtml=path.join(appRoot,'index.html');
const iconSource=path.join(sourceRoot,'icons');
const iconTarget=path.join(appRoot,'icons');
const assets=[
  'pacefold-hub-guardian.js','pacefold-resilience.js',
  'pacefold-integrated.js','pacefold-integrated.css',
  'pacefold-revamp.js','pacefold-revamp.css'
];

if(!(await exists(appHtml)))throw new Error(`Pacefold app shell was not found at ${appHtml}`);
for(const name of assets){const source=path.join(sourceRoot,name),destination=path.join(appRoot,name);await fs.copyFile(source,destination);if(name==='pacefold-integrated.js')await removeNumericBadge(destination);if(name.endsWith('.js'))await hardenTrustedScript(destination);}
await materializeCompressed('pacefold-hub.css.gz.b64',path.join(appRoot,'pacefold-hub.css'));
await materializeCompressed('pacefold-hub.js.gz.b64',path.join(appRoot,'pacefold-hub.js'));
await fs.mkdir(iconTarget,{recursive:true});
await fs.cp(iconSource,iconTarget,{recursive:true});
await writeNotificationPngs(iconTarget);
await enhanceManifests();

let html=extendContentSecurityPolicy(await fs.readFile(appHtml,'utf8'));
html=ensureThemeColor(html);
html=removeOldSurfaceAssets(html);
const styles=[
  `<link rel="stylesheet" href="./pacefold-hub.css?v=${ASSET_REVISION}" data-pacefold-hub="${VERSION}">`,
  `<link rel="stylesheet" href="./pacefold-integrated.css?v=${ASSET_REVISION}" data-pacefold-flow="${VERSION}">`,
  `<link rel="stylesheet" href="./pacefold-revamp.css?v=${ASSET_REVISION}" data-pacefold-revamp="${ASSET_REVISION}">`
].join('\n');
const scripts=[
  `<script defer src="./pacefold-hub-guardian.js?v=${ASSET_REVISION}" data-pacefold-hub-guardian="${VERSION}"></script>`,
  `<script defer src="./pacefold-resilience.js?v=${ASSET_REVISION}" data-pacefold-resilience="${VERSION}"></script>`,
  `<script defer src="./pacefold-hub.js?v=${ASSET_REVISION}" data-pacefold-hub="${VERSION}"></script>`,
  `<script defer src="./pacefold-integrated.js?v=${ASSET_REVISION}" data-pacefold-flow="${VERSION}"></script>`,
  `<script defer src="./pacefold-revamp.js?v=${ASSET_REVISION}" data-pacefold-revamp="${ASSET_REVISION}"></script>`
].join('\n');
html=injectBefore(html,'</head>',styles);
html=injectBefore(html,'</body>',scripts);
await fs.writeFile(appHtml,html);

for(const workerPath of [path.join(targetRoot,'service-worker.js'),path.join(appRoot,'service-worker.js')]){
  if(!(await exists(workerPath)))continue;
  let worker=await fs.readFile(workerPath,'utf8');
  worker=removePreviousWorkerPatches(worker);
  worker+=notificationArtworkPatch(workerPath.includes(`${path.sep}app${path.sep}`));
  await fs.writeFile(workerPath,worker);
}

await fs.writeFile(path.join(targetRoot,'pacefold-hub-version.txt'),`${VERSION}\n`);
console.log(`Installed Pacefold ${ASSET_REVISION}: upper Notes window, lower mini-player, work-hour quieting and resilient OneNote sync.`);

function removeOldSurfaceAssets(source){
  return source
    .replace(/\s*<link[^>]+data-pacefold-(?:hub|flow|revamp)[^>]*>/gi,'')
    .replace(/\s*<script[^>]+data-pacefold-(?:hub(?:-guardian)?|resilience|flow|revamp)[^>]*><\/script>/gi,'');
}
function removePreviousWorkerPatches(source){
  const before=source;
  const next=source
    .replace(/\n*\/\/ BEGIN pacefold-[\s\S]*?\/\/ END pacefold-[^\n]*\n?/gi,'\n')
    .replace(/\n*\/\/ pacefold-(?:kanso|origami|notebook|resilience)-[^\n]*\n[\s\S]*$/i,'\n')
    .replace(/\s+$/,'');
  if(before.length>0&&next.length<Math.min(200,before.length*0.1))throw new Error('Refusing to replace a service worker after an unsafe legacy-patch cleanup');
  return next;
}
function notificationArtworkPatch(isAppWorker){
  const prefix=isAppWorker?'./icons/':'./app/icons/';
  return `

// BEGIN ${MARKER}
(() => {
  const WRAPPED='__pacefoldNotificationWrapped';
  const pfIconBase=${JSON.stringify(prefix)};
  const pfTag='pacefold-current-cue';
  let pfWorkActive=true;
  const choose=(title,options={})=>{
    const text=(String(title||'')+' '+String(options.body||'')+' '+String(options.tag||'')+' '+String(options.data?.source||'')).toLowerCase();
    if(/water|drink|hydrate|sip/.test(text))return pfIconBase+'notify-water.png';
    if(/eye|look far|distance/.test(text))return pfIconBase+'notify-eyes.png';
    if(/move|stretch|posture|ergonomic/.test(text))return pfIconBase+'notify-move.png';
    if(/prayer|fajr|dhuhr|asr|maghrib|isha/.test(text))return pfIconBase+'notify-prayer.png';
    if(/meal|lunch|eat/.test(text))return pfIconBase+'notify-meal.png';
    if(/prepare|noodle|ready/.test(text))return pfIconBase+'notify-prepare.png';
    if(/away|break|step away/.test(text))return pfIconBase+'notify-away.png';
    return pfIconBase+'fold-mark.png';
  };
  const registration=self.registration;
  const closePacefold=async()=>{
    try{
      const items=await registration?.getNotifications?.({tag:pfTag});
      for(const item of items||[])item.close();
    }catch{}
  };
  self.addEventListener('message',event=>{
    if(event.data?.type!=='PACEFOLD_WORK_STATE')return;
    pfWorkActive=event.data.active!==false;
    if(!pfWorkActive)event.waitUntil?.(closePacefold());
  });
  if(registration&&typeof registration.showNotification==='function'&&!registration[WRAPPED]){
    const original=registration.showNotification.bind(registration);
    const wrapped=async(title,options={})=>{
      if(!pfWorkActive){await closePacefold();return;}
      await closePacefold();
      return original(title,{
        ...options,
        tag:pfTag,
        icon:choose(title,options),
        badge:pfIconBase+'fold-mark.png',
        renotify:false,
        requireInteraction:false
      });
    };
    try{
      Object.defineProperty(registration,'showNotification',{configurable:true,writable:true,value:wrapped});
      Object.defineProperty(registration,WRAPPED,{configurable:true,value:'${ASSET_REVISION}'});
    }catch{
      try{registration.showNotification=wrapped;registration[WRAPPED]='${ASSET_REVISION}';}catch{}
    }
  }
})();
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// END ${MARKER}
`;
}
async function enhanceManifests(){
  const candidates=[
    path.join(targetRoot,'manifest.webmanifest'),path.join(targetRoot,'manifest.json'),
    path.join(appRoot,'manifest.webmanifest'),path.join(appRoot,'manifest.json')
  ];
  let changed=0;
  for(const file of candidates){
    if(!(await exists(file)))continue;
    let manifest;
    try{manifest=JSON.parse(await fs.readFile(file,'utf8'));}catch{continue;}
    const start=String(manifest.start_url||'./');
    const joiner=start.includes('?')?'&':'?';
    const desired=[
      {name:'Current Pacefold action',short_name:'Current',description:'Open the current action and quick controls',url:`${start}${joiner}pf=current`},
      {name:'Capture to Pacefold',short_name:'Capture',description:'Focus the Notes capture field',url:`${start}${joiner}pf=capture`},
      {name:'Open Pacefold notes',short_name:'Notes',description:'Open dated Pacefold notes',url:`${start}${joiner}pf=notebook`},
      {name:'Open Pacefold music',short_name:'Music',description:'Open contained music controls',url:`${start}${joiner}pf=media`}
    ];
    const existing=Array.isArray(manifest.shortcuts)?manifest.shortcuts.filter(item=>!/[?&]pf=(?:current|capture|notebook|media)\b/.test(String(item?.url||''))):[];
    manifest.shortcuts=[...existing,...desired].slice(-8);
    await fs.writeFile(file,`${JSON.stringify(manifest,null,2)}\n`);
    changed+=1;
  }
  if(!changed)console.warn('Pacefold manifest shortcuts were not installed because no JSON manifest was found.');
}
function extendContentSecurityPolicy(source){
  return source.replace(/<meta\b[^>]*http-equiv\s*=\s*(["'])Content-Security-Policy\1[^>]*>/i,tag=>
    tag.replace(/content\s*=\s*(["'])([\s\S]*?)\1/i,(_match,quote,policy)=>{
      let next=addSources(policy,'connect-src',['https://api.open-meteo.com','https://graph.microsoft.com','https://login.microsoftonline.com']);
      next=addSources(next,'frame-src',['https://www.youtube-nocookie.com','https://open.spotify.com','https://music.amazon.ca','https://music.amazon.com','https://music.amazon.co.uk','https://music.amazon.de','https://music.amazon.fr','https://music.amazon.it','https://music.amazon.es','https://music.amazon.com.au','https://music.amazon.co.jp','https://login.microsoftonline.com']);
      next=addSources(next,'child-src',['https://www.youtube-nocookie.com','https://open.spotify.com','https://music.amazon.ca','https://music.amazon.com','https://music.amazon.co.uk','https://music.amazon.de','https://music.amazon.fr','https://music.amazon.it','https://music.amazon.es','https://music.amazon.com.au','https://music.amazon.co.jp','https://login.microsoftonline.com']);
      next=addSources(next,'img-src',['data:']);
      return `content=${quote}${next}${quote}`;
    })
  );
}
function addSources(policy,directive,sources){
  const pattern=new RegExp(`(^|;\\s*)${directive}\\s+([^;]*)`,'i');
  const match=policy.match(pattern);
  if(!match)return `${policy.replace(/;?\s*$/,'')}; ${directive} ${sources.join(' ')}`;
  const existing=match[2].trim().split(/\s+/).filter(Boolean);
  const missing=sources.filter(source=>!existing.includes(source));
  if(!missing.length)return policy;
  return policy.replace(pattern,`${match[1]}${directive} ${[...existing,...missing].join(' ')}`);
}
function ensureThemeColor(source){
  const pattern=/<meta\b[^>]*name\s*=\s*(["'])theme-color\1[^>]*>/i;
  if(pattern.test(source)){
    return source.replace(pattern,tag=>{
      if(/content\s*=/i.test(tag))return tag.replace(/content\s*=\s*(["'])[^"']*\1/i,'content="#0a0e11"');
      return tag.replace(/>$/,' content="#0a0e11">');
    });
  }
  return injectBefore(source,'</head>','<meta name="theme-color" content="#0a0e11">');
}
function injectBefore(source,needle,addition){
  const index=source.toLowerCase().lastIndexOf(needle);
  if(index===-1)return `${source}\n${addition}\n`;
  return `${source.slice(0,index)}${addition}\n${source.slice(index)}`;
}

async function materializeCompressed(name,destination){
  const available=new Set(await fs.readdir(sourceRoot));
  const runtimeParts=[
    `${name}.part-00`,`${name}.part-01a`,`${name}.part-01b`,`${name}.part-01c`,`${name}.part-01d`,`${name}.part-02`,`${name}.part-03`
  ];
  const partNames=name.endsWith('.js.gz.b64')
    ? runtimeParts.filter(item=>available.has(item))
    : [...available].filter(item=>item.startsWith(`${name}.part-`)).sort();
  if(name.endsWith('.js.gz.b64')&&partNames.length!==runtimeParts.length){
    throw new Error(`Pacefold runtime source is incomplete: ${partNames.length}/${runtimeParts.length} verified segments found`);
  }
  const encoded=(partNames.length
    ? (await Promise.all(partNames.map(item=>fs.readFile(path.join(sourceRoot,item),'utf8')))).join('')
    : await fs.readFile(path.join(sourceRoot,name),'utf8')).replace(/\s+/g,'');
  let output=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
  if(name.endsWith('.js.gz.b64')){
    output=upgradeRuntimeVersion(output);
    output=hardenSetupRuntime(output);
    output=hardenPlayerRuntime(output);
    output=genericizeNotebookRuntime(output);
    output=removeNumericBadgeCalls(output,'hub runtime');
  }
  if(name.endsWith('.js.gz.b64'))output=trustedBootstrap+rewriteInnerHTMLAssignments(output).source;
  if(name.endsWith('.css.gz.b64'))output+='\n.pf-player-row.is-drop-target{outline:1px dashed var(--mint);outline-offset:-4px;background:color-mix(in srgb,var(--mint) 10%,transparent)}\n';
  await fs.writeFile(destination,output);
}
async function hardenTrustedScript(file){const source=await fs.readFile(file,'utf8'),result=rewriteInnerHTMLAssignments(source);if(result.count)await fs.writeFile(file,trustedBootstrap+result.source);}
async function removeNumericBadge(file){
  const source=await fs.readFile(file,'utf8');
  const next=removeNumericBadgeCalls(source,'integrated runtime',true);
  await fs.writeFile(file,next);
}
function removeNumericBadgeCalls(source,label,required=false){
  const optional=(source.match(/\.setAppBadge\?\.\(1\)/g)||[]).length;
  const direct=(source.match(/\.setAppBadge\(1\)/g)||[]).length;
  if(required&&optional+direct<1)throw new Error(`Expected a numeric app-badge call in ${label}`);
  const next=source.replace(/\.setAppBadge\?\.\(1\)/g,'.setAppBadge?.()').replace(/\.setAppBadge\(1\)/g,'.setAppBadge()');
  if(/\.setAppBadge(?:\?\.)?\(1\)/.test(next))throw new Error(`Numeric app badge survived ${label} hardening`);
  return next;
}

function upgradeRuntimeVersion(source){
  const matches=source.match(/15\.6\.0/g)||[];
  if(matches.length<1||matches.length>12)throw new Error(`Unexpected embedded runtime version marker count: ${matches.length}`);
  const next=source.replaceAll('15.6.0',VERSION);
  if(next.includes('15.6.0')||!next.includes(VERSION))throw new Error('Embedded runtime version upgrade was incomplete');
  return next;
}
function hardenSetupRuntime(source){
  const legacy=/(set up pacefold\|welcome to pacefold\|choose your rhythm\|complete setup)\|get started/g;
  const matches=[...source.matchAll(legacy)];
  if(matches.length!==1)throw new Error(`Unexpected legacy setup-text signature count: ${matches.length}`);
  const next=source.replace(legacy,'$1');
  if(next.includes('complete setup|get started'))throw new Error('Legacy generic setup phrase survived runtime hardening');
  return next;
}
function genericizeNotebookRuntime(source){
  const matches=source.match(/\bHSSys\b/g)||[];
  if(!matches.length)throw new Error('Pacefold notebook runtime no longer exposes the expected legacy HSSys marker');
  const next=source.replace(/\bHSSys\b/g,'Pacefold');
  if(/\bHSSys\b/.test(next))throw new Error('Legacy HSSys notebook naming survived genericization');
  return next;
}
function hardenPlayerRuntime(source){
  let next=source.replaceAll('allow-popups-to-escape-sandbox','');
  const hasDropPath=next.includes("playerRow?.addEventListener('drop'")&&next.includes('loadAudioFile(file)');
  if(!hasDropPath){
    const bindPattern=/(root\.querySelector\('\[data-pf-progress\]'\)\.addEventListener\('input',\s*seekAudio\);\s*)(const player\s*=\s*audio\(\);)/;
    if(!bindPattern.test(next))throw new Error('Pacefold player bind structure missing');
    next=next.replace(bindPattern,`$1const playerRow=root.querySelector('.pf-player-row');\n  playerRow?.addEventListener('dragover',event=>{ event.preventDefault(); playerRow.classList.add('is-drop-target'); });\n  playerRow?.addEventListener('dragleave',()=>playerRow.classList.remove('is-drop-target'));\n  playerRow?.addEventListener('drop',event=>{ event.preventDefault(); playerRow.classList.remove('is-drop-target'); const file=[...(event.dataTransfer?.files||[])].find(item=>item.type.startsWith('audio/')); if(file) loadAudioFile(file); });\n  $2`);
  }
  const hasLoadHelper=/function\s+loadAudioFile\s*\(file\)/.test(next);
  if(!hasLoadHelper){
    const audioPattern=/function\s+chooseAudio\s*\(event\)\s*\{\s*const file\s*=\s*event\.target\.files\?\.\[0\];\s*if\s*\(!file\|\|!file\.type\.startsWith\('audio\/'\)\)\s*return;\s*/;
    if(!audioPattern.test(next))throw new Error('Pacefold local-audio structure missing');
    next=next.replace(audioPattern,"function chooseAudio(event) {\n  const file=event.target.files?.[0];\n  if(file) loadAudioFile(file);\n}\nfunction loadAudioFile(file) {\n  if (!file||!file.type.startsWith('audio/')) return toast('Choose an audio file.');\n");
  }
  return next;
}
async function writeNotificationPngs(directory){
  const designs={
    'fold-mark.png':['neutral','fold'],'notify-water.png':['water','drop'],'notify-eyes.png':['eyes','eye'],
    'notify-move.png':['move','move'],'notify-prayer.png':['prayer','arch'],'notify-meal.png':['meal','bowl'],
    'notify-prepare.png':['prepare','steam'],'notify-away.png':['away','door']
  };
  for(const [name,[tone,glyph]] of Object.entries(designs))await fs.writeFile(path.join(directory,name),renderIcon(tone,glyph));
}
function renderIcon(tone,glyph){
  const width=96,height=96,pixels=Buffer.alloc(width*height*4);
  const palette={neutral:[201,216,207,255],water:[92,174,217,255],eyes:[186,167,226,255],move:[118,201,153,255],prayer:[219,181,111,255],meal:[231,157,113,255],prepare:[196,143,223,255],away:[137,176,199,255]};
  const ink=[28,38,43,255],accent=palette[tone]||palette.neutral;
  const put=(x,y,color)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=width||y>=height)return;const at=(y*width+x)*4;pixels[at]=color[0];pixels[at+1]=color[1];pixels[at+2]=color[2];pixels[at+3]=color[3];};
  const rect=(x,y,w,h,color)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)put(xx,yy,color);};
  const line=(x0,y0,x1,y1,color,thick=3)=>{const steps=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));for(let i=0;i<=steps;i++){const x=x0+(x1-x0)*(i/steps),y=y0+(y1-y0)*(i/steps);rect(Math.round(x-thick/2),Math.round(y-thick/2),thick,thick,color);}};
  const circle=(cx,cy,r,color,fill=true)=>{for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){const d=x*x+y*y;if(fill?d<=r*r:d<=r*r&&d>=(r-3)*(r-3))put(cx+x,cy+y,color);}};
  rect(24,15,12,66,ink);rect(34,18,36,16,ink);line(69,20,56,45,ink,8);rect(35,43,24,11,ink);line(58,47,48,67,ink,6);
  if(glyph==='drop'){for(let y=0;y<25;y++){const half=Math.max(1,Math.round((24-y)*.42));rect(72-half,52+y,half*2,1,accent);}}
  else if(glyph==='eye'){line(61,64,72,57,accent,3);line(72,57,83,64,accent,3);line(83,64,72,71,accent,3);line(72,71,61,64,accent,3);circle(72,64,4,accent,true);}
  else if(glyph==='move'){line(59,70,82,47,accent,4);line(71,47,82,47,accent,4);line(82,47,82,58,accent,4);}
  else if(glyph==='arch'){line(60,76,60,60,accent,4);line(84,76,84,60,accent,4);for(let a=0;a<=24;a++)put(60+a,60-Math.round(Math.sqrt(Math.max(0,144-(a-12)*(a-12)))),accent);line(58,77,86,77,accent,4);}
  else if(glyph==='bowl'){for(let y=0;y<12;y++)rect(59+y,60+y,26-y*2,1,accent);line(59,60,85,60,accent,3);}
  else if(glyph==='steam'){line(64,76,64,66,accent,3);line(72,76,72,63,accent,3);line(80,76,80,66,accent,3);circle(64,62,3,accent,true);circle(72,59,3,accent,true);circle(80,62,3,accent,true);}
  else if(glyph==='door'){rect(62,51,21,27,accent);rect(66,55,13,23,ink);circle(76,66,2,accent,true);}
  else{circle(73,63,8,accent,false);}
  return encodePng(width,height,pixels);
}
function encodePng(width,height,pixels){
  const signature=Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
  const raw=Buffer.alloc((width*4+1)*height);
  for(let y=0;y<height;y++){raw[y*(width*4+1)]=0;pixels.copy(raw,y*(width*4+1)+1,y*width*4,(y+1)*width*4);}
  return Buffer.concat([signature,pngChunk('IHDR',ihdr),pngChunk('IDAT',deflateSync(raw)),pngChunk('IEND',Buffer.alloc(0))]);
}
function pngChunk(type,data){
  const name=Buffer.from(type);const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([name,data]))>>>0);return Buffer.concat([length,name,data,crc]);
}
function crc32(buffer){let value=0xffffffff;for(const byte of buffer){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;}
async function exists(file){try{await fs.access(file);return true;}catch{return false;}}
