import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '15.3.0';
const MARKER = `pacefold-hub-${VERSION}`;
const targetRoot = path.resolve(process.argv[2] || '_site');
const sourceRoot = path.dirname(fileURLToPath(import.meta.url));

const assets = [
  { source: path.join(sourceRoot, 'pacefold-hub.css'), name: 'pacefold-hub.css' },
  { source: path.join(sourceRoot, 'pacefold-hub.js'), name: 'pacefold-hub.js' }
];
const htmlFiles = [
  path.join(targetRoot, 'index.html'),
  path.join(targetRoot, 'app', 'index.html')
];

let injected = 0;
for (const file of htmlFiles) {
  if (!(await exists(file))) continue;
  const directory = path.dirname(file);
  for (const asset of assets) await fs.copyFile(asset.source, path.join(directory, asset.name));

  let html = await fs.readFile(file, 'utf8');
  if (!html.includes(`data-pacefold-hub="${VERSION}"`)) {
    const style = `<link rel="stylesheet" href="./pacefold-hub.css?v=${VERSION}" data-pacefold-hub="${VERSION}">`;
    const script = `<script src="./pacefold-hub.js?v=${VERSION}" data-pacefold-hub="${VERSION}"></script>`;
    html = injectBefore(html, '</head>', style);
    html = injectBefore(html, '</body>', script);
    await fs.writeFile(file, html);
  }
  injected += 1;
}

if (!injected) throw new Error(`No index.html found under ${targetRoot}`);

for (const workerPath of [
  path.join(targetRoot, 'service-worker.js'),
  path.join(targetRoot, 'app', 'service-worker.js')
]) {
  if (!(await exists(workerPath))) continue;
  let worker = await fs.readFile(workerPath, 'utf8');
  if (worker.includes(MARKER)) continue;
  worker += `\n\n// ${MARKER}: activate the shell containing the external Hub assets.\n`;
  worker += `self.addEventListener('activate', event => {\n`;
  worker += `  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => /pacefold/i.test(key) && !key.includes('${MARKER}')).map(key => caches.delete(key)))).then(() => self.clients.claim()));\n`;
  worker += `});\n`;
  await fs.writeFile(workerPath, worker);
}

await fs.writeFile(path.join(targetRoot, 'pacefold-hub-version.txt'), `${VERSION}\n`);
console.log(`Installed CSP-safe Pacefold Hub ${VERSION} assets into ${injected} application shell(s).`);

function injectBefore(source, needle, addition) {
  const index = source.toLowerCase().lastIndexOf(needle);
  if (index === -1) return `${source}\n${addition}\n`;
  return `${source.slice(0, index)}${addition}\n${source.slice(index)}`;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
