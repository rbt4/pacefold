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

await build({
  entryPoints:[path.join(source,'modules','main.mjs')],
  outfile:path.join(target,'app','pacefold.mjs'),
  bundle:true,
  minify:true,
  format:'esm',
  platform:'browser',
  target:['es2022'],
  legalComments:'none',
  sourcemap:false,
  charset:'utf8'
});

const styleRoot=path.join(source,'styles');
let styleFiles=[];
try{styleFiles=(await fs.readdir(styleRoot)).filter(file=>file.endsWith('.css')).sort()}catch{}
const baseCss=await fs.readFile(path.join(source,'app','pacefold.css'),'utf8');
const additions=[];
for(const file of styleFiles)additions.push(await fs.readFile(path.join(styleRoot,file),'utf8'));
await fs.writeFile(path.join(target,'app','pacefold.css'),[baseCss,...additions].join('\n\n'));

await fs.rm(path.join(target,'modules'),{recursive:true,force:true});
await fs.rm(path.join(target,'styles'),{recursive:true,force:true});
await fs.rm(path.join(target,'app','core.mjs'),{force:true});
await fs.writeFile(path.join(target,'pacefold-experience.txt'),'27.0.0 polish-r2-window-cues\n');
console.log(`Built Pacefold 27 window-cue polish bundle and single stylesheet at ${target}`);