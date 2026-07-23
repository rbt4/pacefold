import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '15.4.0';
const MARKER = `pacefold-kanso-${VERSION}`;
const targetRoot = path.resolve(process.argv[2] || '_site');
const sourceRoot = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(targetRoot, 'app');
const appHtml = path.join(appRoot, 'index.html');

const assets = [
  'pacefold-hub.css',
  'pacefold-hub.js',
  'pacefold-hub-guardian.js'
];

if (!(await exists(appHtml))) throw new Error(`Pacefold app shell was not found at ${appHtml}`);

for (const name of assets) {
  await fs.copyFile(path.join(sourceRoot, name), path.join(appRoot, name));
}

let html = extendContentSecurityPolicy(await fs.readFile(appHtml, 'utf8'));
if (!html.includes(`data-pacefold-hub="${VERSION}"`)) {
  const style = `<link rel="stylesheet" href="./pacefold-hub.css?v=${VERSION}" data-pacefold-hub="${VERSION}">`;
  const scripts = [
    `<script src="./pacefold-hub-guardian.js?v=${VERSION}" data-pacefold-hub-guardian="${VERSION}"></script>`,
    `<script async src="./pacefold-hub.js?v=${VERSION}" data-pacefold-hub="${VERSION}"></script>`
  ].join('\n');
  html = injectBefore(html, '</head>', style);
  html = injectBefore(html, '</body>', scripts);
}
await fs.writeFile(appHtml, html);

for (const workerPath of [
  path.join(targetRoot, 'service-worker.js'),
  path.join(appRoot, 'service-worker.js')
]) {
  if (!(await exists(workerPath))) continue;
  let worker = await fs.readFile(workerPath, 'utf8');
  if (worker.includes(MARKER)) continue;
  worker += `\n\n// ${MARKER}: activate the Kanso app shell and discard stale Pacefold caches.\n`;
  worker += `self.addEventListener('activate', event => {\n`;
  worker += `  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => /pacefold/i.test(key) && !key.includes('${MARKER}')).map(key => caches.delete(key)))).then(() => self.clients.claim()));\n`;
  worker += `});\n`;
  await fs.writeFile(workerPath, worker);
}

await fs.writeFile(path.join(targetRoot, 'pacefold-hub-version.txt'), `${VERSION}\n`);
console.log(`Installed Pacefold Kanso ${VERSION} into the application shell only.`);

function extendContentSecurityPolicy(source) {
  return source.replace(/<meta\b[^>]*http-equiv\s*=\s*(["'])Content-Security-Policy\1[^>]*>/i, tag => {
    return tag.replace(/content\s*=\s*(["'])([\s\S]*?)\1/i, (_match, quote, policy) => {
      let next = addSources(policy, 'connect-src', [
        'https://api.open-meteo.com',
        'https://api.rainviewer.com'
      ]);
      next = addSources(next, 'img-src', [
        'https://*.rainviewer.com'
      ]);
      return `content=${quote}${next}${quote}`;
    });
  });
}

function addSources(policy, directive, sources) {
  const pattern = new RegExp(`(^|;\\s*)${directive}\\s+([^;]*)`, 'i');
  const match = policy.match(pattern);
  if (!match) return `${policy.replace(/;?\s*$/, '')}; ${directive} ${sources.join(' ')}`;
  const existing = match[2].trim().split(/\s+/).filter(Boolean);
  const missing = sources.filter(source => !existing.includes(source));
  if (!missing.length) return policy;
  const replacement = `${match[1]}${directive} ${[...existing, ...missing].join(' ')}`;
  return policy.replace(pattern, replacement);
}

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
