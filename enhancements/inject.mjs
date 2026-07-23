import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '15.5.0';
const MARKER = `pacefold-origami-${VERSION}`;
const targetRoot = path.resolve(process.argv[2] || '_site');
const sourceRoot = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(targetRoot, 'app');
const appHtml = path.join(appRoot, 'index.html');
const iconSource = path.join(sourceRoot, 'icons');
const iconTarget = path.join(appRoot, 'icons');

const assets = ['pacefold-hub.css', 'pacefold-hub.js', 'pacefold-hub-guardian.js'];
if (!(await exists(appHtml))) throw new Error(`Pacefold app shell was not found at ${appHtml}`);

for (const name of assets) await fs.copyFile(path.join(sourceRoot, name), path.join(appRoot, name));
await fs.mkdir(iconTarget, { recursive: true });
await fs.cp(iconSource, iconTarget, { recursive: true });

let html = extendContentSecurityPolicy(await fs.readFile(appHtml, 'utf8'));
html = ensureThemeColor(html);
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

for (const workerPath of [path.join(targetRoot, 'service-worker.js'), path.join(appRoot, 'service-worker.js')]) {
  if (!(await exists(workerPath))) continue;
  let worker = await fs.readFile(workerPath, 'utf8');
  if (!worker.includes(MARKER)) worker += notificationArtworkPatch(workerPath.includes(`${path.sep}app${path.sep}`));
  await fs.writeFile(workerPath, worker);
}

await fs.writeFile(path.join(targetRoot, 'pacefold-hub-version.txt'), `${VERSION}\n`);
console.log(`Installed Pacefold Origami ${VERSION} with embedded players and source-specific notification artwork.`);

function notificationArtworkPatch(isAppWorker) {
  const prefix = isAppWorker ? './icons/' : './app/icons/';
  return `

// ${MARKER}: source-specific origami notification artwork and cache activation.
(() => {
  const pfIconBase = ${JSON.stringify(prefix)};
  const pfChooseNotificationIcon = (title, options = {}) => {
    const text = (String(title || '') + ' ' + String(options.body || '') + ' ' + String(options.tag || '') + ' ' + String(options.data?.source || '')).toLowerCase();
    if (/water|drink|hydrate|sip/.test(text)) return pfIconBase + 'notify-water.svg';
    if (/eye|look far|distance/.test(text)) return pfIconBase + 'notify-eyes.svg';
    if (/move|stretch|posture|ergonomic/.test(text)) return pfIconBase + 'notify-move.svg';
    if (/prayer|fajr|dhuhr|asr|maghrib|isha/.test(text)) return pfIconBase + 'notify-prayer.svg';
    if (/meal|lunch|eat/.test(text)) return pfIconBase + 'notify-meal.svg';
    if (/prepare|noodle|ready/.test(text)) return pfIconBase + 'notify-prepare.svg';
    if (/away|break|step away/.test(text)) return pfIconBase + 'notify-away.svg';
    return pfIconBase + 'fold-mark.svg';
  };
  const registration = self.registration;
  if (registration && typeof registration.showNotification === 'function') {
    const original = registration.showNotification.bind(registration);
    const wrapped = (title, options = {}) => original(title, {
      ...options,
      icon: pfChooseNotificationIcon(title, options),
      badge: pfIconBase + 'fold-mark.svg'
    });
    try {
      Object.defineProperty(registration, 'showNotification', { configurable: true, writable: true, value: wrapped });
    } catch {
      try { registration.showNotification = wrapped; } catch {}
    }
  }
})();
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => /pacefold/i.test(key) && !key.includes('${MARKER}')).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
`;
}

function extendContentSecurityPolicy(source) {
  return source.replace(/<meta\b[^>]*http-equiv\s*=\s*(["'])Content-Security-Policy\1[^>]*>/i, tag => {
    return tag.replace(/content\s*=\s*(["'])([\s\S]*?)\1/i, (_match, quote, policy) => {
      let next = addSources(policy, 'connect-src', ['https://api.open-meteo.com']);
      next = addSources(next, 'frame-src', [
        'https://www.youtube-nocookie.com',
        'https://open.spotify.com',
        'https://music.amazon.ca',
        'https://music.amazon.com'
      ]);
      next = addSources(next, 'child-src', [
        'https://www.youtube-nocookie.com',
        'https://open.spotify.com',
        'https://music.amazon.ca',
        'https://music.amazon.com'
      ]);
      next = addSources(next, 'img-src', ['data:']);
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
  return policy.replace(pattern, `${match[1]}${directive} ${[...existing, ...missing].join(' ')}`);
}

function ensureThemeColor(source) {
  if (/<meta\b[^>]*name=["']theme-color["']/i.test(source)) {
    return source.replace(/<meta\b([^>]*name=["']theme-color["'][^>]*)>/i, '<meta$1 content="#0a0e11">');
  }
  return injectBefore(source, '</head>', '<meta name="theme-color" content="#0a0e11">');
}

function injectBefore(source, needle, addition) {
  const index = source.toLowerCase().lastIndexOf(needle);
  if (index === -1) return `${source}\n${addition}\n`;
  return `${source.slice(0, index)}${addition}\n${source.slice(index)}`;
}

async function exists(file) {
  try { await fs.access(file); return true; }
  catch { return false; }
}
