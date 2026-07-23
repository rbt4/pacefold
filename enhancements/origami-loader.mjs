import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, 'origami-source');
const work = path.join('/tmp', `pacefold-origami-${process.pid}`);
await fs.mkdir(work, { recursive: true });

for (const name of ['pacefold-hub.js', 'pacefold-hub.css', 'origami-inject.impl.mjs']) {
  const prefix = `${name}.gz.b64.part-`;
  const parts = (await fs.readdir(source)).filter(file => file.startsWith(prefix)).sort();
  if (!parts.length) throw new Error(`Missing compressed Origami source for ${name}`);
  const encoded = (await Promise.all(parts.map(file => fs.readFile(path.join(source, file), 'utf8')))).join('');
  const decoded = zlib.gunzipSync(Buffer.from(encoded, 'base64'));
  await fs.writeFile(path.join(work, name), decoded);
}

await fs.copyFile(path.join(here, 'pacefold-hub-guardian.js'), path.join(work, 'pacefold-hub-guardian.js'));
await import(`${pathToFileURL(path.join(work, 'origami-inject.impl.mjs')).href}?v=${Date.now()}`);
