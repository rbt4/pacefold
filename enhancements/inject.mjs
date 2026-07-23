import fs from 'node:fs/promises';
import path from 'node:path';

const VERSION = '15.3.0';
const MARKER = `pacefold-hub-${VERSION}`;
const targetRoot = path.resolve(process.argv[2] || '_site');
const sourceRoot = path.dirname(new URL(import.meta.url).pathname);

const [css, js] = await Promise.all([
  fs.readFile(path.join(sourceRoot, 'pacefold-hub.css'), 'utf8'),
  fs.readFile(path.join(sourceRoot, 'pacefold-hub.js'), 'utf8')
]);

const htmlFiles = [
  path.join(targetRoot, 'index.html'),
  path.join(targetRoot, 'app', 'index.html')
];

let injected = 0;
for (const file of htmlFiles) {
  if (!(await exists(file))) continue;
  let html = await fs.readFile(file, 'utf8');
  if (html.includes(`data-pacefold-hub="${VERSION}"`)) {
    injected += 1;
    continue;
  }

  const style = `<style data-pacefold-hub="${VERSION}">\n${css}\n</style>`;
  const script = `<script data-pacefold-hub="${VERSION}">\n${js}\n</script>`;
  html = injectBefore(html, '</head>', style);
  html = injectBefore(html, '</body>', script);
  await fs.writeFile(file, html);
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
  worker += `\n\n// ${MARKER}: force the installed PWA to activate the hub-bearing shell.\n`;
  worker += `self.addEventListener('activate', event => {\n`;
  worker += `  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => /pacefold/i.test(key) && !key.includes('${MARKER}')).map(key => caches.delete(key)))).then(() => self.clients.claim()));\n`;
  worker += `});\n`;
  await fs.writeFile(workerPath, worker);
}

await fs.writeFile(path.join(targetRoot, 'pacefold-hub-version.txt'), `${VERSION}\n`);
console.log(`Injected Pacefold Hub ${VERSION} into ${injected} application shell(s).`);

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
