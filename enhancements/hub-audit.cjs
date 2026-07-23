'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(process.argv[2] || '_release');
const port = 4178;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  let file = path.join(root, relative);
  if (!file.startsWith(root)) return response.writeHead(403).end('Forbidden');
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return response.writeHead(404).end('Not found');
  const types = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp'
  };
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  response.setHeader('Connection', 'close');
  response.end(fs.readFileSync(file));
});
server.keepAliveTimeout = 100;
server.headersTimeout = 1000;

async function main() {
  let browser;
  try {
    const landing = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const appShell = fs.readFileSync(path.join(root, 'app', 'index.html'), 'utf8');
    if (/data-pacefold-hub=/.test(landing)) throw new Error('The Kanso surface must not be injected into the public landing page');
    if (!/data-pacefold-hub="15\.4\.0"/.test(appShell)) throw new Error('The 15.4 Kanso asset marker is missing from the app shell');
    if (!/https:\/\/api\.open-meteo\.com/.test(appShell) || !/https:\/\/api\.rainviewer\.com/.test(appShell)) {
      throw new Error('Weather CSP sources were not installed');
    }

    await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      window.__badgeEvents = [];
      Object.defineProperty(navigator, 'setAppBadge', {
        configurable: true,
        value: async value => { window.__badgeEvents.push(['set', value ?? 1]); }
      });
      Object.defineProperty(navigator, 'clearAppBadge', {
        configurable: true,
        value: async () => { window.__badgeEvents.push(['clear']); }
      });
    });

    const page = await context.newPage();
    const hubErrors = [];
    const assetTraffic = [];
    let weatherRequests = 0;
    let radarRequests = 0;

    page.on('pageerror', error => {
      const detail = `${error.message || ''}\n${error.stack || ''}`;
      if (/pacefold-hub|pacefold Kanso|pf-surface/i.test(detail)) hubErrors.push(error.message);
    });
    page.on('console', message => {
      const location = message.location()?.url || '';
      if (message.type() === 'error' && (/pacefold-hub/i.test(location) || /pacefold Kanso|pf-surface/i.test(message.text()))) {
        hubErrors.push(`console: ${message.text()} @ ${location || 'unknown'}`);
      }
    });
    page.on('requestfailed', request => {
      if (/pacefold-hub/i.test(request.url())) assetTraffic.push(`FAILED ${request.url()}: ${request.failure()?.errorText || 'unknown'}`);
    });
    page.on('response', response => {
      if (/pacefold-hub/i.test(response.url())) assetTraffic.push(`${response.status()} ${response.url()}`);
    });

    await page.route('https://api.open-meteo.com/**', route => {
      weatherRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          current: { temperature_2m: 24, apparent_temperature: 25, weather_code: 2, precipitation: 0, wind_speed_10m: 11 },
          hourly: { time: ['2099-01-01T13:00'], precipitation_probability: [10] },
          daily: {
            time: ['2099-01-01', '2099-01-02', '2099-01-03'],
            weather_code: [2, 3, 61],
            temperature_2m_max: [25, 23, 20],
            temperature_2m_min: [17, 16, 14],
            precipitation_probability_max: [10, 20, 60]
          }
        })
      });
    });
    await page.route('https://api.rainviewer.com/**', route => {
      radarRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ host: 'https://tilecache.rainviewer.com', radar: { past: [{ path: '/v2/radar/123', time: 123 }], nowcast: [] } })
      });
    });
    await page.route('https://tilecache.rainviewer.com/**', route => route.fulfill({ status: 204, body: '' }));

    await page.goto(`http://127.0.0.1:${port}/app/`, { waitUntil: 'commit', timeout: 15000 });
    await page.waitForSelector('#pf-hub-root', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => document.documentElement.classList.contains('pf-hub-mounted'));

    const architecture = await page.evaluate(() => ({
      roots: document.querySelectorAll('#pf-hub-root').length,
      version: document.getElementById('pf-hub-root')?.dataset.version,
      oldPanel: Boolean(document.querySelector('.pf-hub-panel,.pf-hub-tabs')),
      oldCopy: document.body.textContent.includes('Capture bridge') || document.body.textContent.includes('Care, simplified'),
      captureVisible: Boolean(document.querySelector('[data-pf-capture-form]')?.getBoundingClientRect().height),
      playerVisible: Boolean(document.querySelector('[data-pf-player-dropzone]')?.getBoundingClientRect().height)
    }));
    if (architecture.roots !== 1 || architecture.version !== '15.4.0') throw new Error(`Incorrect Kanso mount: ${JSON.stringify(architecture)}`);
    if (architecture.oldPanel || architecture.oldCopy) throw new Error('Redundant 15.3 card/tabs architecture is still present');
    if (!architecture.captureVisible || !architecture.playerVisible) throw new Error('Persistent capture or media rail is not visible');

    const input = page.locator('[data-pf-capture-input]');
    await input.fill('Kanso audit capture');
    await page.locator('[data-pf-capture-form]').evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => {
      const items = JSON.parse(localStorage.getItem('pacefold.hub.captures.v1') || '[]');
      return items.some(item => item.text === 'Kanso audit capture');
    });
    await page.locator('[data-pf-action="open-inbox"]').click();
    await page.waitForSelector('[data-pf-drawer].is-open');
    if (!await page.getByText('Kanso audit capture').isVisible()) throw new Error('Saved capture is missing from the unified inbox drawer');

    await page.locator('[data-pf-action="close-drawer"]').click();
    await delay(1100);
    if (radarRequests !== 0) throw new Error(`Radar loaded before the user opened weather (${radarRequests} requests)`);
    await page.locator('[data-pf-action="open-weather"]').click();
    await page.waitForFunction(() => document.querySelector('[data-pf-weather-temp]')?.textContent.includes('24'));
    await page.waitForFunction(() => document.querySelector('.pf-weather-hero'));
    await page.waitForFunction(() => document.querySelector('.pf-radar'));
    await delay(100);
    if (weatherRequests < 1 || radarRequests !== 1) throw new Error(`Unexpected weather loading contract: forecast=${weatherRequests}, radar=${radarRequests}`);

    await page.evaluate(() => {
      window.__cueClicks = 0;
      const cue = document.createElement('div');
      cue.id = 'pf-audit-cue';
      cue.setAttribute('role', 'alert');
      cue.innerHTML = '<span>Drink water</span><button type="button">Done</button>';
      cue.querySelector('button').addEventListener('click', () => {
        window.__cueClicks += 1;
        cue.remove();
      });
      document.body.append(cue);
    });
    await page.waitForSelector('.pf-andon.is-waiting');
    await page.evaluate(async () => navigator.setAppBadge(1));
    await page.waitForFunction(() => {
      const badge = JSON.parse(localStorage.getItem('pacefold.hub.badge.v1') || '{}');
      return badge.waiting === true && badge.acknowledged === false;
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => {
      const badge = JSON.parse(localStorage.getItem('pacefold.hub.badge.v1') || '{}');
      return badge.acknowledged === true;
    });
    const focusContract = await page.evaluate(() => ({
      cueClicks: window.__cueClicks,
      cueStillVisible: Boolean(document.getElementById('pf-audit-cue')),
      andonWaiting: document.querySelector('.pf-andon')?.classList.contains('is-waiting'),
      badgeEvents: window.__badgeEvents
    }));
    if (focusContract.cueClicks !== 0 || !focusContract.cueStillVisible || !focusContract.andonWaiting) {
      throw new Error(`Focusing Pacefold completed or hid a real cue: ${JSON.stringify(focusContract)}`);
    }
    if (!focusContract.badgeEvents.some(event => event[0] === 'set') || !focusContract.badgeEvents.some(event => event[0] === 'clear')) {
      throw new Error('Badge acknowledge bridge did not run');
    }
    await page.locator('[data-pf-action="handle-cue"]').click();
    await page.waitForFunction(() => window.__cueClicks === 1 && !document.getElementById('pf-audit-cue'));

    await page.evaluate(() => document.getElementById('pf-hub-root').remove());
    await page.waitForSelector('#pf-hub-root', { state: 'attached', timeout: 3000 });
    const restoredVersion = await page.locator('#pf-hub-root').getAttribute('data-version');
    if (restoredVersion !== '15.4.0') throw new Error('Guardian restored the wrong surface');

    const responsive = await context.newPage();
    await responsive.setViewportSize({ width: 390, height: 780 });
    await responsive.goto(`http://127.0.0.1:${port}/app/`, { waitUntil: 'commit', timeout: 15000 });
    await responsive.waitForSelector('#pf-hub-root');
    const mobile = await responsive.evaluate(() => ({
      capture: document.querySelector('[data-pf-capture-form]')?.getBoundingClientRect(),
      player: document.querySelector('[data-pf-player-dropzone]')?.getBoundingClientRect(),
      overflow: document.documentElement.scrollWidth > innerWidth + 2
    }));
    if (!mobile.capture?.height || !mobile.player?.height || mobile.overflow) throw new Error(`Mobile surface failed: ${JSON.stringify(mobile)}`);

    if (hubErrors.length) throw new Error(`Kanso-originated page errors: ${hubErrors.join(' | ')}`);
    console.log(`Pacefold Kanso browser audit passed. Forecast=${weatherRequests}, radar=${radarRequests}. Assets: ${assetTraffic.join(' | ')}`);
  } finally {
    if (browser) await Promise.race([browser.close().catch(() => {}), delay(2500)]);
    server.closeAllConnections?.();
    server.close(() => {});
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
