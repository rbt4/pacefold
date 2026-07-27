import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const sourceRoot=path.dirname(fileURLToPath(import.meta.url));
const layoutMarker='pacefold-16-layout-floor';
const layoutPatch=`

/* BEGIN ${layoutMarker} */
html.pf-flow-active body{padding-bottom:190px!important}
#pf-hub-root{--pf-workspace-bottom:76px!important}
#pf-local-workspace{bottom:76px!important;max-height:calc(100vh - 104px)!important}
#pf-local-workspace.is-open{height:min(680px,calc(100vh - 104px))!important}
#pf-local-player{bottom:6px!important}
#pf-local-player .pf-player-bar{box-sizing:border-box!important;min-height:52px!important}
/* END ${layoutMarker} */
`;
const cssPath=path.join(sourceRoot,'pacefold-revamp.css');
let css=await fs.readFile(cssPath,'utf8');
css=css.replace(new RegExp(`\\n*\\/\\* BEGIN ${layoutMarker} \\/\\*[\\s\\S]*?\\/\\* END ${layoutMarker} \\/\\*\\n?`,'g'),'').replace(/\s+$/,'')+layoutPatch;
await fs.writeFile(cssPath,css);

const prefix='inject-runtime.mjs.gz.b64.part-';
const parts=(await fs.readdir(sourceRoot)).filter(name=>name.startsWith(prefix)).sort();
if(!parts.length)throw new Error('Pacefold inject runtime segments are missing');
const encoded=(await Promise.all(parts.map(name=>fs.readFile(path.join(sourceRoot,name),'utf8')))).join('').replace(/\s+/g,'');
const source=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
const temporary=path.join(sourceRoot,`.inject-runtime-${process.pid}-${Date.now()}.mjs`);
await fs.writeFile(temporary,source);
try{
  await import(`${pathToFileURL(temporary).href}?v=${Date.now()}`);
}finally{
  await fs.rm(temporary,{force:true});
}
