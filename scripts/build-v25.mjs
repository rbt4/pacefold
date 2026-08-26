import fs from'node:fs/promises';
import path from'node:path';
import{build}from'esbuild';

const root=process.cwd();
const source=path.join(root,'src');
const target=path.resolve(process.argv[2]||path.join(root,'_site'));
const RELEASE='30.0.0';
const REVISION='quiet-clock-r1';
if(target===root||target===path.parse(target).root)throw new Error(`Unsafe build target: ${target}`);

await fs.rm(target,{recursive:true,force:true});
await fs.mkdir(target,{recursive:true});
await fs.cp(source,target,{recursive:true});

const APP_CSP="default-src 'none'; script-src 'self' https://www.youtube.com; style-src 'self'; font-src 'self'; img-src 'self' data: blob: https://i.ytimg.com; media-src 'self' blob:; connect-src 'self' https://api.open-meteo.com https://login.microsoftonline.com https://graph.microsoft.com; frame-src https://login.microsoftonline.com https://www.youtube.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self' https://login.microsoftonline.com";
const AUTH_CSP="default-src 'none'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
const PUBLIC_CSP="default-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";
const REFERRER='<meta name="referrer" content="strict-origin-when-cross-origin">';

async function writeDailyImage(){
  const metadata={date:'',url:'./homepage-default.jpg',credit:'',creditUrl:'',source:'Built-in homepage background'};
  if(process.env.PACEFOLD_REFRESH_DAILY_IMAGE!=='1'){
    await fs.writeFile(path.join(target,'app','daily-image.json'),JSON.stringify(metadata));
    console.log('Daily image refresh skipped; using the built-in visual fallback');
    return;
  }
  try{
    const response=await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-CA',{headers:{'user-agent':`Clock/${RELEASE}`},signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error(`metadata ${response.status}`);
    const item=(await response.json())?.images?.[0];if(!item?.url)throw new Error('missing image URL');
    const imageUrl=new URL(item.url,'https://www.bing.com');
    const imageResponse=await fetch(imageUrl,{headers:{'user-agent':`Clock/${RELEASE}`},signal:AbortSignal.timeout(12000)});if(!imageResponse.ok)throw new Error(`image ${imageResponse.status}`);
    await fs.writeFile(path.join(target,'app','daily-image.jpg'),Buffer.from(await imageResponse.arrayBuffer()));
    metadata.date=String(item.startdate||'');metadata.url='./daily-image.jpg';metadata.credit=String(item.copyright||'Bing image of the day');metadata.creditUrl=String(item.copyrightlink||'https://www.bing.com/').replace(/^http:/,'https:');
    console.log(`Packed Bing image of the day ${metadata.date||'today'}`);
  }catch(error){console.warn(`Bing daily image unavailable; using visual fallback: ${error.message}`)}
  await fs.writeFile(path.join(target,'app','daily-image.json'),JSON.stringify(metadata));
}

const neutralizeVisibleName=value=>value.replaceAll('Pacefold','Clock').replaceAll('PACEFOLD','CLOCK');
const addReferrer=html=>html.includes('name="referrer"')?html:html.replace(/(<meta name="viewport"[^>]*>)/,`$1\n  ${REFERRER}`);
const replaceCsp=(html,csp)=>html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/,`<meta http-equiv="Content-Security-Policy" content="${csp}">`);

async function prepareAppShell(){
  const file=path.join(target,'app','index.html');let html=await fs.readFile(file,'utf8');
  html=html
    .replace(/\.\/pacefold\.css\?v=[^"']+/,'./pacefold.css?v='+RELEASE)
    .replace('id="rhythm-kicker">Prayer rhythm<','id="rhythm-kicker">Today’s rhythm<')
    .replace('id="rhythm-meta">Your configured location and calculation method appear here.<','id="rhythm-meta"><')
    .replace('data-action="prep"><i></i><span><strong>Prep</strong>','data-action="prep"><i></i><span><strong>Noodles</strong>')
    .replace('<button type="button" data-action="prep">Prep</button>','<button type="button" data-action="prep">Noodles</button>')
    .replace(/Pacefold\s+\d+\.\d+\.\d+/g,`Pacefold ${RELEASE}`)
    .replace(/Pacefold \d+\.\d+\.\d+ · [^<]+/,`Pacefold ${RELEASE} · ${REVISION}`)
    .replace(/\.\/pacefold\.mjs\?v=[^"']+/,'./pacefold.mjs?v='+RELEASE);
  html=replaceCsp(addReferrer(neutralizeVisibleName(html)),APP_CSP)
    .replace('<title>Clock — Your day, quietly kept</title>','<title>Clock</title>')
    .replace('<span><strong>Clock</strong><small>Your day, quietly kept</small></span>','<span><strong>Clock</strong><small hidden></small></span>');
  await fs.writeFile(file,html);
}

async function prepareAuthShell(){
  const file=path.join(target,'app','auth.html');let html=await fs.readFile(file,'utf8');
  html=replaceCsp(addReferrer(neutralizeVisibleName(html)),AUTH_CSP)
    .replace('<title>Clock Microsoft sign-in</title>','<title>Clock sign-in</title>')
    .replace('Returning to Clock…','Returning…');
  await fs.writeFile(file,html);
}

async function preparePublicPages(){
  for(const relative of['index.html','privacy.html']){
    const file=path.join(target,relative);let html=await fs.readFile(file,'utf8');
    html=neutralizeVisibleName(html).replace(/25\.1\.0|25\.1/g,RELEASE);
    html=addReferrer(html);
    if(html.includes('http-equiv="Content-Security-Policy"'))html=replaceCsp(html,PUBLIC_CSP);
    else html=html.replace('</head>',`  <meta http-equiv="Content-Security-Policy" content="${PUBLIC_CSP}">\n</head>`);
    await fs.writeFile(file,html);
  }
}

async function neutralizeRuntime(){
  const file=path.join(target,'app','pacefold.mjs');let runtime=await fs.readFile(file,'utf8');
  runtime=runtime.replaceAll('Pacefold','Clock');
  await fs.writeFile(file,runtime);
}

await writeDailyImage();
await prepareAppShell();
await prepareAuthShell();
await preparePublicPages();
await build({entryPoints:[path.join(source,'modules','main.mjs')],outfile:path.join(target,'app','pacefold.mjs'),bundle:true,minify:true,format:'esm',platform:'browser',target:['es2022'],legalComments:'none',sourcemap:false,charset:'utf8'});
await neutralizeRuntime();

const styleRoot=path.join(source,'styles');
const styleFiles=[
  '26-cues.css','26-daybook.css','26-discretion.css','26-edges.css','26-sun.css','26-window-chrome.css',
  '27-window-cues.css','27-z-start-cover.css','27-zz-stream-player.css','27-zzzzzz-final-form.css',
  '27-zzzzzzzzzzzzzzzzzz-homepage-r7.css','27-zzzzzzzzzzzzzzzzzzz-homepage-r7-finish.css',
  '27-zzzzzzzzzzzzzzzzzzzz-music-magic-r8.css','27-zzzzzzzzzzzzzzzzzzzzz-music-magic-r8-mobile-fix.css',
  '27-zzzzzzzzzzzzzzzzzzzzzz-music-magic-r8-source-fit.css','27-zzzzzzzzzzzzzzzzzzzzzzzz-morphe-bridge-r9.css',
  '28-guided-fold-v28.css','29-v28-recovery.css','30-v28-recovery-stability.css','31-v30-quiet-clock.css'
];
const baseCss=await fs.readFile(path.join(source,'app','pacefold.css'),'utf8'),additions=[];for(const file of styleFiles)additions.push(await fs.readFile(path.join(styleRoot,file),'utf8'));
await fs.writeFile(path.join(target,'app','pacefold.css'),[baseCss,...additions].join('\n\n'));
await fs.rm(path.join(target,'modules'),{recursive:true,force:true});await fs.rm(path.join(target,'styles'),{recursive:true,force:true});await fs.rm(path.join(target,'app','core.mjs'),{force:true});
await fs.writeFile(path.join(target,'pacefold-experience.txt'),`${RELEASE} ${REVISION}\n`);
console.log(`Built Clock ${RELEASE} ${REVISION} bundle and hardened shell at ${target}`);
