import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '15.3.0';
const MARKER = `pacefold-hub-${VERSION}`;
const targetRoot = path.resolve(process.argv[2] || '_site');
const sourceRoot = path.dirname(fileURLToPath(import.meta.url));

const assets = [
  { source: path.join(sourceRoot, 'pacefold-hub.css'), name: 'pacefold-hub.css' },
  { source: path.join(sourceRoot, 'pacefold-hub.js'), name: 'pacefold-hub.js' },
  { source: path.join(sourceRoot, 'pacefold-hub-guardian.js'), name: 'pacefold-hub-guardian.js' }
];
const htmlFiles = [
  path.join(targetRoot, 'index.html'),
  path.join(targetRoot, 'app', 'index.html')
];

let injected = 0;
for (const file of htmlFiles) {
  if (!(await exists(file))) continue;
  const directory = path.dirname(file);
  for (const asset of assets) await materializeAsset(asset, path.join(directory, asset.name));

  let html = extendContentSecurityPolicy(await fs.readFile(file, 'utf8'));
  if (!html.includes(`data-pacefold-hub="${VERSION}"`)) {
    const style = `<link rel="stylesheet" href="./pacefold-hub.css?v=${VERSION}" data-pacefold-hub="${VERSION}">`;
    const scripts = [
      `<script src="./pacefold-hub-guardian.js?v=${VERSION}" data-pacefold-hub-guardian="${VERSION}"></script>`,
      `<script async src="./pacefold-hub.js?v=${VERSION}" data-pacefold-hub="${VERSION}"></script>`
    ].join('\n');
    html = injectBefore(html, '</head>', style);
    html = injectBefore(html, '</body>', scripts);
  }
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
  worker += `\n\n// ${MARKER}: activate the shell containing the external Hub assets.\n`;
  worker += `self.addEventListener('activate', event => {\n`;
  worker += `  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => /pacefold/i.test(key) && !key.includes('${MARKER}')).map(key => caches.delete(key)))).then(() => self.clients.claim()));\n`;
  worker += `});\n`;
  await fs.writeFile(workerPath, worker);
}

await fs.writeFile(path.join(targetRoot, 'pacefold-hub-version.txt'), `${VERSION}\n`);
console.log(`Installed resilient Pacefold Hub ${VERSION} assets into ${injected} application shell(s).`);

async function materializeAsset(asset, destination) {
  if (asset.name !== 'pacefold-hub.js') {
    await fs.copyFile(asset.source, destination);
    return;
  }

  const source = await fs.readFile(asset.source, 'utf8');
  const feedbackProne = "function markWaiting(waiting){const button=document.querySelector('[data-pf-action=clear-cue]'),label=document.querySelector('[data-pf-cue-label]');if(!button||!label)return;button.classList.toggle('is-alert',waiting);label.textContent=waiting?'1 waiting':'Clear cue';}";
  const idempotent = "function markWaiting(waiting){const button=document.querySelector('[data-pf-action=clear-cue]'),label=document.querySelector('[data-pf-cue-label]');if(!button||!label)return;const nextLabel=waiting?'1 waiting':'Clear cue';if(button.classList.contains('is-alert')!==waiting)button.classList.toggle('is-alert',waiting);if(label.textContent!==nextLabel)label.textContent=nextLabel;}";
  if (!source.includes(feedbackProne)) throw new Error('Expected Pacefold Hub cue-state implementation was not found');
  await fs.writeFile(destination, source.replace(feedbackProne, idempotent));
}

function extendContentSecurityPolicy(html) {
  return html.replace(/<meta\b[^>]*http-equiv\s*=\s*(["'])Content-Security-Policy\1[^>]*>/i, tag => {
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
