import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const VERSION='15.6.0';
const MARKER=`pacefold-notebook-${VERSION}`;
const targetRoot=path.resolve(process.argv[2]||'_site');
const sourceRoot=path.dirname(fileURLToPath(import.meta.url));
const appRoot=path.join(targetRoot,'app');
const appHtml=path.join(appRoot,'index.html');
const iconSource=path.join(sourceRoot,'icons');
const iconTarget=path.join(appRoot,'icons');
const assets=['pacefold-hub-guardian.js'];

if(!(await exists(appHtml)))throw new Error(`Pacefold app shell was not found at ${appHtml}`);
for(const name of assets)await fs.copyFile(path.join(sourceRoot,name),path.join(appRoot,name));
await materializeCompressed('pacefold-hub.css.gz.b64',path.join(appRoot,'pacefold-hub.css'));
await materializeCompressed('pacefold-hub.js.gz.b64',path.join(appRoot,'pacefold-hub.js'));
await fs.mkdir(iconTarget,{recursive:true});
await fs.cp(iconSource,iconTarget,{recursive:true});

let html=extendContentSecurityPolicy(await fs.readFile(appHtml,'utf8'));
html=ensureThemeColor(html);
html=removeOldSurfaceAssets(html);
const style=`<link rel="stylesheet" href="./pacefold-hub.css?v=${VERSION}" data-pacefold-hub="${VERSION}">`;
const scripts=[
  `<script src="./pacefold-hub-guardian.js?v=${VERSION}" data-pacefold-hub-guardian="${VERSION}"></script>`,
  `<script async src="./pacefold-hub.js?v=${VERSION}" data-pacefold-hub="${VERSION}"></script>`
].join('\n');
html=injectBefore(html,'</head>',style);
html=injectBefore(html,'</body>',scripts);
await fs.writeFile(appHtml,html);

for(const workerPath of [path.join(targetRoot,'service-worker.js'),path.join(appRoot,'service-worker.js')]){
  if(!(await exists(workerPath)))continue;
  let worker=await fs.readFile(workerPath,'utf8');
  worker=worker.replace(/\n*\/\/ pacefold-(?:kanso|origami)-[\s\S]*?(?=\n\/\/ pacefold-|\s*$)/gi,'\n');
  if(!worker.includes(MARKER))worker+=notificationArtworkPatch(workerPath.includes(`${path.sep}app${path.sep}`));
  await fs.writeFile(workerPath,worker);
}

await fs.writeFile(path.join(targetRoot,'pacefold-hub-version.txt'),`${VERSION}\n`);
console.log(`Installed Pacefold Notebook ${VERSION}: setup-safe rail, real notebook, OneNote bridge and user Amazon URLs.`);

function removeOldSurfaceAssets(source){
  return source
    .replace(/\s*<link[^>]+data-pacefold-hub[^>]*>/gi,'')
    .replace(/\s*<script[^>]+data-pacefold-hub(?:-guardian)?[^>]*><\/script>/gi,'');
}
function notificationArtworkPatch(isAppWorker){
  const prefix=isAppWorker?'./icons/':'./app/icons/';
  return `

// ${MARKER}: source-specific origami notification artwork and cache activation.
(() => {
  const pfIconBase=${JSON.stringify(prefix)};
  const choose=(title,options={})=>{
    const text=(String(title||'')+' '+String(options.body||'')+' '+String(options.tag||'')+' '+String(options.data?.source||'')).toLowerCase();
    if(/water|drink|hydrate|sip/.test(text))return pfIconBase+'notify-water.svg';
    if(/eye|look far|distance/.test(text))return pfIconBase+'notify-eyes.svg';
    if(/move|stretch|posture|ergonomic/.test(text))return pfIconBase+'notify-move.svg';
    if(/prayer|fajr|dhuhr|asr|maghrib|isha/.test(text))return pfIconBase+'notify-prayer.svg';
    if(/meal|lunch|eat/.test(text))return pfIconBase+'notify-meal.svg';
    if(/prepare|noodle|ready/.test(text))return pfIconBase+'notify-prepare.svg';
    if(/away|break|step away/.test(text))return pfIconBase+'notify-away.svg';
    return pfIconBase+'fold-mark.svg';
  };
  const registration=self.registration;
  if(registration&&typeof registration.showNotification==='function'){
    const original=registration.showNotification.bind(registration);
    const wrapped=(title,options={})=>original(title,{...options,icon:choose(title,options),badge:pfIconBase+'fold-mark.svg'});
    try{Object.defineProperty(registration,'showNotification',{configurable:true,writable:true,value:wrapped});}
    catch{try{registration.showNotification=wrapped;}catch{}}
  }
})();
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>/pacefold/i.test(key)&&!key.includes('${MARKER}')).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
`;
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
  if(name.endsWith('.js.gz.b64'))output=hardenPlayerRuntime(output);
  if(name.endsWith('.css.gz.b64'))output+='\n.pf-player-row.is-drop-target{outline:1px dashed var(--mint);outline-offset:-4px;background:color-mix(in srgb,var(--mint) 10%,transparent)}\n';
  await fs.writeFile(destination,output);
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
async function exists(file){try{await fs.access(file);return true;}catch{return false;}}
