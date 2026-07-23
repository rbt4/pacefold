'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(process.argv[2] || '_release');
const port = 4178;
const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  let file = path.join(root, relative);
  if (!file.startsWith(root)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    response.writeHead(404).end('Not found');
    return;
  }
  const ext = path.extname(file);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
  response.setHeader('Content-Type', types[ext] || 'application/octet-stream');
  response.setHeader('Connection', 'close');
  response.end(fs.readFileSync(file));
});
server.keepAliveTimeout = 100;
server.headersTimeout = 1000;

async function closeServer() {
  server.closeAllConnections?.();
  await new Promise(resolve => server.close(resolve));
}

async function main() {
  let browser;
  try {
    await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const hubErrors = [];
    const consoleErrors = [];
    const assetTraffic = [];
    page.on('pageerror', error => {
      const detail = `${error.message || ''}\n${error.stack || ''}`;
      if (/pacefold-hub|pf-hub/i.test(detail)) hubErrors.push(error.message);
      else consoleErrors.push(`pageerror: ${error.message}`);
    });
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const location = message.location()?.url || '';
      const detail = `console: ${message.text()} @ ${location || 'unknown'}`;
      consoleErrors.push(detail);
      if (/pacefold-hub/i.test(location) || /pacefold hub|pf-hub/i.test(message.text())) hubErrors.push(detail);
    });
    page.on('requestfailed', request => {
      if (/pacefold-hub/i.test(request.url())) assetTraffic.push(`FAILED ${request.url()}: ${request.failure()?.errorText || 'unknown error'}`);
    });
    page.on('response', response => {
      if (/pacefold-hub/i.test(response.url())) assetTraffic.push(`${response.status()} ${response.url()}`);
    });

    await page.route('https://api.open-meteo.com/**', route => route.fulfill({
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
    }));
    await page.route('https://api.rainviewer.com/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ host: '', radar: { past: [], nowcast: [] } })
    }));

    await page.goto(`http://127.0.0.1:${port}/app/`, { waitUntil: 'commit', timeout: 15000 });
    try {
      await page.waitForSelector('#pf-hub-root', { state: 'attached', timeout: 15000 });
    } catch (error) {
      const documentDiagnostics = await page.evaluate(() => ({
        href: location.href,
        readyState: document.readyState,
        title: document.title,
        hasBody: Boolean(document.body),
        hubScript: document.querySelector('script[src*="pacefold-hub.js"]')?.outerHTML || null,
        hubStyle: document.querySelector('link[href*="pacefold-hub.css"]')?.outerHTML || null,
        csp: document.querySelector('meta[http-equiv="Content-Security-Policy" i]')?.content || null,
        scriptSources: [...document.scripts].map(script => script.src || '[inline]').slice(-12),
        bodyTail: document.body?.innerHTML.slice(-1200) || null
      })).catch(evaluateError => ({ evaluateError: evaluateError.message }));
      throw new Error([
        `Hub did not mount: ${error.message}`,
        `Asset traffic: ${assetTraffic.join(' | ') || 'none observed'}`,
        `Hub errors: ${hubErrors.join(' | ') || 'none observed'}`,
        `Console errors: ${consoleErrors.slice(-12).join(' | ') || 'none observed'}`,
        `Document: ${JSON.stringify(documentDiagnostics)}`
      ].join('\n'));
    }

    await page.waitForFunction(() => document.documentElement.classList.contains('pf-hub-mounted'), null, { timeout: 10000 });
    const externalAssetsLoaded = await page.evaluate(() => Boolean(
      document.querySelector('script[src*="pacefold-hub.js"]') &&
      document.querySelector('link[href*="pacefold-hub.css"]') &&
      document.getElementById('pf-hub-root')
    ));
    if (!externalAssetsLoaded) throw new Error('Hub external assets did not load and mount');

    const input = page.locator('[data-pf-capture-input]');
    await input.fill('Hub smoke test');
    await page.locator('[data-pf-capture-form]').evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => {
      const items = JSON.parse(localStorage.getItem('pacefold.hub.captures.v1') || '[]');
      return items.some(item => item.text === 'Hub smoke test');
    }, null, { timeout: 10000 });

    await page.locator('[data-pf-action="toggle-hub"]').first().click();
    await page.waitForSelector('[data-pf-panel="hub"].is-open', { timeout: 5000 });
    const playerVisible = await page.locator('.pf-hub-player-bar').isVisible();
    const captureVisible = await page.locator('.pf-hub-capture-row').isVisible();
    const careVisible = await page.locator('.pf-hub-care-grid').isVisible();
    if (!playerVisible || !captureVisible || !careVisible) throw new Error('Persistent Hub surfaces are not visible');
    if (hubErrors.length) throw new Error(`Hub-originated page errors: ${hubErrors.join(' | ')}`);

    console.log(`Pacefold Hub browser smoke passed on /app/. Assets: ${assetTraffic.join(' | ')}`);
  } finally {
    await browser?.close().catch(() => {});
    await closeServer().catch(() => {});
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
