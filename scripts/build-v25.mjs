import fs from'node:fs/promises';
import path from'node:path';
import{build}from'esbuild';

const root=process.cwd();
const source=path.join(root,'src');
const target=path.resolve(process.argv[2]||path.join(root,'_site'));
if(target===root||target===path.parse(target).root)throw new Error(`Unsafe build target: ${target}`);

await fs.rm(target,{recursive:true,force:true});
await fs.mkdir(target,{recursive:true});
await fs.cp(source,target,{recursive:true});

async function writeDailyImage(){
  const metadata={date:'',url:'',credit:'',creditUrl:'',source:'Bing image of the day'};
  try{
    const response=await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-CA',{headers:{'user-agent':'Pacefold/27.1'}});if(!response.ok)throw new Error(`metadata ${response.status}`);
    const item=(await response.json())?.images?.[0];if(!item?.url)throw new Error('missing image URL');
    const imageUrl=new URL(item.url,'https://www.bing.com');
    const imageResponse=await fetch(imageUrl,{headers:{'user-agent':'Pacefold/27.1'}});if(!imageResponse.ok)throw new Error(`image ${imageResponse.status}`);
    await fs.writeFile(path.join(target,'app','daily-image.jpg'),Buffer.from(await imageResponse.arrayBuffer()));
    metadata.date=String(item.startdate||'');metadata.url='./daily-image.jpg';metadata.credit=String(item.copyright||'Bing image of the day');metadata.creditUrl=String(item.copyrightlink||'https://www.bing.com/').replace(/^http:/,'https:');
    console.log(`Packed Bing image of the day ${metadata.date||'today'}`);
  }catch(error){console.warn(`Bing daily image unavailable; using visual fallback: ${error.message}`)}
  await fs.writeFile(path.join(target,'app','daily-image.json'),JSON.stringify(metadata));
}

async function prepareAppShell(){
  const file=path.join(target,'app','index.html');let html=await fs.readFile(file,'utf8');
  html=html
    .replace("script-src 'self';","script-src 'self' https://www.youtube.com;")
    .replace('frame-src https://login.microsoftonline.com;','frame-src https://login.microsoftonline.com https://www.youtube.com;')
    .replace('<meta name="application-name" content="Pacefold">','<meta name="application-name" content="Clock">')
    .replace('./pacefold.css?v=25.1.0','./pacefold.css?v=27.1.0')
    .replace('<title>Pacefold — Your day, quietly kept</title>','<title>Clock</title>')
    .replace('<span><strong>Pacefold</strong><small>Your day, quietly kept</small></span>','<span><strong>Clock</strong><small hidden></small></span>')
    .replace('id="rhythm-kicker">Prayer rhythm<','id="rhythm-kicker">Today’s rhythm<')
    .replace('id="rhythm-meta">Your configured location and calculation method appear here.<','id="rhythm-meta"><')
    .replace('data-action="prep"><i></i><span><strong>Prep</strong>','data-action="prep"><i></i><span><strong>Noodles</strong>')
    .replace('<button type="button" data-action="prep">Prep</button>','<button type="button" data-action="prep">Noodles</button>')
    .replace('<b>Pacefold 25.1.0</b>','<b>Pacefold 27.1.0</b>');
  await fs.writeFile(file,html);
}

await writeDailyImage();
await prepareAppShell();
await build({entryPoints:[path.join(source,'modules','main.mjs')],outfile:path.join(target,'app','pacefold.mjs'),bundle:true,minify:true,format:'esm',platform:'browser',target:['es2022'],legalComments:'none',sourcemap:false,charset:'utf8'});

const styleRoot=path.join(source,'styles');let styleFiles=[];try{styleFiles=(await fs.readdir(styleRoot)).filter(file=>file.endsWith('.css')).sort()}catch{}
const baseCss=await fs.readFile(path.join(source,'app','pacefold.css'),'utf8'),additions=[];for(const file of styleFiles)additions.push(await fs.readFile(path.join(styleRoot,file),'utf8'));
await fs.writeFile(path.join(target,'app','pacefold.css'),[baseCss,...additions].join('\n\n'));
await fs.rm(path.join(target,'modules'),{recursive:true,force:true});await fs.rm(path.join(target,'styles'),{recursive:true,force:true});await fs.rm(path.join(target,'app','core.mjs'),{force:true});
await fs.writeFile(path.join(target,'pacefold-experience.txt'),'27.1.0 final-form-r1\n');
console.log(`Built Pacefold 27.1 final-form bundle and single stylesheet at ${target}`);
