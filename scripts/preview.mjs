import fs from'node:fs';
import http from'node:http';
import path from'node:path';

const args=process.argv.slice(2),argument=(name,fallback)=>{const index=args.indexOf(name);return index>=0&&args[index+1]?args[index+1]:fallback},host=argument('--host','0.0.0.0'),port=Number(argument('--port','4173')),root=path.resolve('_site');
if(!fs.existsSync(path.join(root,'index.html')))throw new Error('Run npm run build before starting the Pacefold preview.');

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((request,response)=>{let pathname='/';try{pathname=decodeURIComponent(new URL(request.url,'http://preview.local').pathname)}catch{}let file=path.resolve(root,`.${pathname}`);if(!file.startsWith(`${root}${path.sep}`)&&file!==root){response.writeHead(403).end();return}if(pathname.endsWith('/'))file=path.join(file,'index.html');fs.readFile(file,(error,content)=>{if(error){response.writeHead(404,{'content-type':'text/plain; charset=utf-8'});response.end('Not found');return}response.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});response.end(content)})});
server.listen(port,host,()=>console.log(`Pacefold preview ready on ${host}:${port}`));
