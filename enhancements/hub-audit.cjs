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
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
  response.setHeader('Content-Type', types[ext] || 'application/octet-stream');
  response.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pf-hub-root', { timeout: 10000 });

  const input = page.locator('[data-pf-capture-input]');
  await input.fill('Hub smoke test');
  await page.locator('[data-pf-capture-form]').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => {
    const items = JSON.parse(localStorage.getItem('pacefold.hub.captures.v1') || '[]');
    return items.some(item => item.text === 'Hub smoke test');
  });

  await page.locator('[data-pf-action="toggle-hub"]').first().click();
  await page.waitForSelector('[data-pf-panel="hub"].is-open');
  const playerVisible = await page.locator('.pf-hub-player-bar').isVisible();
  const captureVisible = await page.locator('.pf-hub-capture-row').isVisible();
  if (!playerVisible || !captureVisible) throw new Error('Persistent capture/player surfaces are not visible');
  if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);

  await browser.close();
  server.close();
  console.log('Pacefold Hub browser smoke passed.');
})().catch(error => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
