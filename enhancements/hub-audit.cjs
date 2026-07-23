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
  const types = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png' };
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
    const worker = fs.readFileSync(path.join(root, 'app', 'service-worker.js'), 'utf8');
    if (/data-pacefold-hub=/.test(landing)) throw new Error('Origami surface leaked into the landing page');
    if (!/data-pacefold-hub="15\.5\.0"/.test(appShell)) throw new Error('15.5 asset marker missing');
    for (const host of ['www.youtube-nocookie.com','open.spotify.com','music.amazon.ca']) {
      if (!appShell.includes(host)) throw new Error(`CSP is missing ${host}`);
    }
    for (const icon of ['fold-mark.svg','notify-water.svg','notify-eyes.svg','notify-move.svg','notify-prayer.svg','notify-meal.svg','notify-prepare.svg','notify-away.svg']) {
      if (!fs.existsSync(path.join(root, 'app', 'icons', icon))) throw new Error(`Missing artwork ${icon}`);
    }
    for (const mapping of ['notify-water.svg','notify-eyes.svg','notify-move.svg','notify-prayer.svg','notify-meal.svg','notify-prepare.svg','notify-away.svg']) {
      if (!worker.includes(mapping)) throw new Error(`Notification worker does not map ${mapping}`);
    }

    await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      window.__externalOpenCount = 0;
      window.open = () => { window.__externalOpenCount += 1; return null; };
      window.__badgeEvents = [];
      Object.defineProperty(navigator, 'setAppBadge', { configurable:true, value:async value => window.__badgeEvents.push(['set',value ?? 1]) });
      Object.defineProperty(navigator, 'clearAppBadge', { configurable:true, value:async () => window.__badgeEvents.push(['clear']) });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => message.type() === 'error' && errors.push(message.text()));
    await page.route('https://api.open-meteo.com/**', route => route.fulfill({
      status:200, contentType:'application/json', body:JSON.stringify({
        current:{temperature_2m:24,apparent_temperature:25,weather_code:2,wind_speed_10m:11},
        daily:{time:['2099-01-01','2099-01-02','2099-01-03'],weather_code:[2,3,61],temperature_2m_max:[25,23,20],temperature_2m_min:[17,16,14],precipitation_probability_max:[10,20,60]}
      })
    }));
    await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>YouTube embed</title>'}));
    await page.route('https://open.spotify.com/**', route => route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Spotify embed</title>'}));
    await page.route('https://music.amazon.ca/**', route => route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Amazon Music frame</title>'}));

    await page.goto(`http://127.0.0.1:${port}/app/`, { waitUntil:'commit', timeout:15000 });
    await page.waitForSelector('#pf-hub-root');
    await page.waitForFunction(() => document.getElementById('pf-hub-root')?.dataset.version === '15.5.0');
    const architecture = await page.evaluate(() => ({
      roots:document.querySelectorAll('#pf-hub-root').length,
      brand:document.querySelector('.pf-brand-button strong')?.textContent,
      notebookWords:/OneNote|Capture Bridge|Markdown|Connect folder/i.test(document.getElementById('pf-hub-root')?.textContent || ''),
      playerVisible:Boolean(document.querySelector('.pf-player-row')?.getBoundingClientRect().height),
      foldVisible:Boolean(document.querySelector('[data-pf-fold-form]')?.getBoundingClientRect().height)
    }));
    if (architecture.roots !== 1 || architecture.brand !== 'Pacefold' || architecture.notebookWords || !architecture.playerVisible || !architecture.foldVisible) {
      throw new Error(`Incorrect Origami architecture: ${JSON.stringify(architecture)}`);
    }

    await page.locator('[data-pf-fold-input]').fill('Origami audit fold');
    await page.locator('[data-pf-fold-form]').evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('pacefold.hub.captures.v1') || '[]').some(item => item.text === 'Origami audit fold'));
    await page.locator('[data-pf-action="open-folds"]').click();
    await page.waitForSelector('[data-pf-sheet]:not([hidden])');
    if (!await page.getByText('Origami audit fold').isVisible()) throw new Error('Fold was not rendered in the Fold Stack');

    await page.locator('[data-pf-action="open-player"]').first().click();
    await page.getByRole('tab', { name:'YouTube' }).click();
    await page.locator('[data-pf-stream-url]').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.locator('[data-pf-action="load-stream"]').click();
    await page.waitForSelector('iframe.pf-embed--youtube');
    const youtubeSrc = await page.locator('iframe.pf-embed--youtube').getAttribute('src');
    if (!youtubeSrc.startsWith('https://www.youtube-nocookie.com/embed/')) throw new Error(`Unsafe YouTube source: ${youtubeSrc}`);

    await page.getByRole('tab', { name:'Spotify' }).click();
    await page.locator('[data-pf-stream-url]').fill('https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl');
    await page.locator('[data-pf-action="load-stream"]').click();
    await page.waitForSelector('iframe.pf-embed--spotify');
    const spotifySrc = await page.locator('iframe.pf-embed--spotify').getAttribute('src');
    if (!spotifySrc.startsWith('https://open.spotify.com/embed/track/')) throw new Error(`Unsafe Spotify source: ${spotifySrc}`);

    await page.getByRole('tab', { name:'Amazon Music' }).click();
    await page.locator('[data-pf-action="load-stream"]').click();
    await page.waitForSelector('iframe.pf-embed--amazon');
    const amazonSrc = await page.locator('iframe.pf-embed--amazon').getAttribute('src');
    if (amazonSrc !== 'https://music.amazon.ca/') throw new Error(`Amazon left the contained origin: ${amazonSrc}`);
    const opened = await page.evaluate(() => window.__externalOpenCount);
    if (opened !== 0) throw new Error(`Player opened ${opened} external windows`);

    await page.evaluate(() => {
      const cue = document.createElement('div');
      cue.id='pf-audit-cue'; cue.setAttribute('role','alert'); cue.innerHTML='<span>Drink water</span><button>Done</button>';
      window.__cueClicks=0; cue.querySelector('button').onclick=()=>{window.__cueClicks++;cue.remove();}; document.body.append(cue);
    });
    await page.waitForSelector('.pf-andon.is-waiting');
    await page.locator('[data-pf-action="handle-cue"]').click();
    await page.waitForFunction(() => window.__cueClicks === 1 && !document.getElementById('pf-audit-cue'));

    await page.evaluate(() => document.getElementById('pf-hub-root').remove());
    await page.waitForSelector('#pf-hub-root', { timeout:3000 });

    const mobile = await context.newPage();
    await mobile.setViewportSize({ width:390, height:780 });
    await mobile.goto(`http://127.0.0.1:${port}/app/`, { waitUntil:'commit', timeout:15000 });
    await mobile.waitForSelector('#pf-hub-root');
    const mobileState = await mobile.evaluate(() => ({
      fold:Boolean(document.querySelector('[data-pf-fold-form]')?.getBoundingClientRect().height),
      player:Boolean(document.querySelector('.pf-player-row')?.getBoundingClientRect().height),
      overflow:document.documentElement.scrollWidth > innerWidth + 2
    }));
    if (!mobileState.fold || !mobileState.player || mobileState.overflow) throw new Error(`Mobile Origami failure: ${JSON.stringify(mobileState)}`);
    if (errors.some(error => /pacefold-hub|pf-origami/i.test(error))) throw new Error(`Origami runtime errors: ${errors.join(' | ')}`);
    console.log('Pacefold Origami 15.5 browser audit passed: internal providers, Folds, artwork, cues, guardian and mobile.');
  } finally {
    if (browser) await Promise.race([browser.close().catch(()=>{}), delay(2500)]);
    server.closeAllConnections?.();
    server.close(()=>{});
  }
}

main().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);});
