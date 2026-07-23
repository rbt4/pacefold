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
  await materializeAsset(name, path.join(appRoot, name));
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

async function materializeAsset(name, destination) {
  const sourcePath = path.join(sourceRoot, name);
  if (name !== 'pacefold-hub.js') {
    await fs.copyFile(sourcePath, destination);
    return;
  }

  let source = await fs.readFile(sourcePath, 'utf8');
  const mountMarker = '\n  mount();\n})();';
  if (!source.includes(mountMarker)) throw new Error('Expected Pacefold Kanso mount marker was not found');

  const reliabilityFixes = `
  // Install the taskbar bridge without assuming the browser exposes a writable Navigator method.
  installBadgeBridge = () => {
    if (nativeBadge.set) {
      const wrappedSetAppBadge = async value => {
        const normalized = value == null ? 1 : value;
        writeJson(KEYS.badge, { waiting: true, acknowledged: false, value: normalized, at: new Date().toISOString() });
        scheduleCueScan();
        return nativeBadge.set(normalized);
      };
      try {
        Object.defineProperty(navigator, 'setAppBadge', {
          configurable: true,
          writable: true,
          value: wrappedSetAppBadge
        });
      } catch (error) {
        try { navigator.setAppBadge = wrappedSetAppBadge; }
        catch (fallbackError) { recordError('badge-bridge', fallbackError || error); }
      }
    }
    acknowledgeTaskbarBadge();
  };

  // A quiet forecast may already be in flight when the user opens Weather.
  // Upgrade that existing request to include radar instead of silently losing the user intent.
  const refreshWeatherBase = refreshWeather;
  refreshWeather = async options => {
    const request = options || {};
    if (request.includeRadar && state.weatherRequest) {
      await state.weatherRequest;
      if (request.force || !state.radar) {
        if (!state.radarRequest) {
          state.radarRequest = loadRadar()
            .then(radar => {
              state.radar = radar;
              if (radar) writeCache(KEYS.radar, radar);
              return radar;
            })
            .catch(error => {
              recordError('radar', error);
              return state.radar;
            })
            .finally(() => { state.radarRequest = null; });
        }
        await state.radarRequest;
      }
      renderWeatherPill();
      if (state.drawer === 'weather') renderDrawer();
      if (!request.quiet) toast('Weather refreshed.');
      return;
    }
    return refreshWeatherBase(request);
  };
`;

  source = source.replace(mountMarker, `${reliabilityFixes}${mountMarker}`);
  await fs.writeFile(destination, source);
}

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
