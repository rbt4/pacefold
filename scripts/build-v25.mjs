import fs from'node:fs/promises';
import path from'node:path';

const root=process.cwd(),source=path.join(root,'src'),target=path.resolve(process.argv[2]||path.join(root,'_site'));
if(target===root||target===path.parse(target).root)throw new Error(`Unsafe build target: ${target}`);
await fs.rm(target,{recursive:true,force:true});
await fs.mkdir(target,{recursive:true});
await fs.cp(source,target,{recursive:true});
await fs.writeFile(path.join(target,'pacefold-experience.txt'),'25.1.0 polish-r2\n');
console.log(`Built Pacefold 25.1 direct source at ${target}`);
