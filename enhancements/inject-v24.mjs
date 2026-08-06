import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const names=(await fs.readdir(root)).filter(name=>name.startsWith('inject-v24-runtime.mjs.part-')).sort();
if(!names.length)throw new Error('Pacefold 24 injector parts are missing');
const generated=path.join(root,'.inject-v24-runtime.generated.mjs');
await fs.writeFile(generated,(await Promise.all(names.map(name=>fs.readFile(path.join(root,name),'utf8')))).join(''));
try{await import(`${pathToFileURL(generated).href}?v=${Date.now()}`)}finally{await fs.unlink(generated).catch(()=>{})}
