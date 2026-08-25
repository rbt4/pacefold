import fs from'node:fs/promises';import path from'node:path';
const root=path.resolve(process.argv[2]||'_site'),file=path.join(root,'service-worker.js');let source=await fs.readFile(file,'utf8');
const before='notification-r5-homepage-r7',after='notification-r5-homepage-r7-music-r8';
if(source.includes(before)){source=source.replace(before,after);await fs.writeFile(file,source);console.log('Rolled Clock service-worker cache to music-r8')}
else if(source.includes('atelier-r1'))console.log('Unified recovery cache already includes Music')
else throw new Error('Unknown service-worker cache identity');
