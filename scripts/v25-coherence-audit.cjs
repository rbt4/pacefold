'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const site = path.resolve(process.argv[2] || 'canonical');
const artifacts = path.resolve(process.argv[3] || path.join(process.cwd(), 'v25-audit-artifacts'));
const assert = (value, message) => {
  if (!value) throw new Error(message);
};

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      } catch {
        pathname = '/';
      }
      let file = path.join(site, pathname.replace(/^\/+/, ''));
      if (pathname.endsWith('/')) file = path.join(file, 'index.html');
      if (!file.startsWith(site)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(file, (error, data) => {
        if (error) {
          res.writeHead(404);
          res.end();
          return;
        }
        const type = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
          '.webmanifest': 'application/manifest+json',
          '.woff2': 'font/woff2'
        }[path.extname(file)] || 'application/octet-stream';
        res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

function seed() {
  const d = new Date();
  const today = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const week = {};
  for (let day = 0; day < 7; day += 1) {
    week[day] = { start: '08:30', end: '16:30', type: day === 0 || day === 6 ? 'off' : 'desk' };
  }
  localStorage.setItem('pacefoldOnboardedV15', '1');
  localStorage.setItem('pacefoldSetupDismissedV15', '1');
  localStorage.setItem('pacefoldPrefsV15', JSON.stringify({
    profile: 'original',
    lat: 43.6205,
    lng: -79.5132,
    locationLabel: 'Etobicoke, Toronto',
    timeZone: 'America/Toronto',
    method: '15',
    asr: 'hanafi',
    showSeconds: true,
    waterTarget: 24,
    waterSips: 2,
    waterDate: today,
    workHours: '08:30-16:30',
    workWeek: week,
    todayOverride: { date: today, type: 'half' },
    noodleMinutes: 30,
    lunchMode: 'desk',
    notifications: false,
    quietMode: false,
    taskbarBadge: true,
    taskbarBadgeMode: 'due'
  }));
}

async function snapshot(page) {
  return page.evaluate(() => {
    const box = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      const s = getComputedStyle(node);
      return {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        w: r.width,
        h: r.height,
        display: s.display,
        position: s.position,
        visibility: s.visibility,
        opacity: Number(s.opacity)
      };
    };
    const ys = selector => [...document.querySelectorAll(selector)].map(node => Math.round(node.getBoundingClientRect().y));
    const root = document.getElementById('pf25Spatial-spatial-root');
    return {
      vw: innerWidth,
      vh: innerHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
      coherence: root?.dataset.coherence,
      outer: getComputedStyle(root, '::before').display,
      hero: box('.pf25Spatial-clock-hero'),
      instrument: box('#pf25Surface-instrument'),
      dial: box('#pf25Surface-dial'),
      dialWrap: box('.pf25Surface-dial-wrap'),
      copy: box('.pf25Surface-clock-copy'),
      status: box('.pf25Surface-clock-copy .pf25Spatial-status'),
      day: box('#pf25-dayline'),
      daySun: box('#pf25-dayline .pf25-day-sun'),
      dayNow: box('#pf25-dayline .pf25-day-now'),
      dayNowText: document.querySelector('#pf25-dayline .pf25-day-now')?.textContent || '',
      dayState: document.querySelector('#pf25-dayline')?.dataset.state || '',
      rhythm: box('#pf25-rhythm'),
      rhythmRows: ys('#pf25-rhythm .pf25-rhythm-item'),
      dock: box('#pf25Actions-action-dock'),
      actionHead: box('#pf25Actions-action-dock .pf25Actions-action-head'),
      actionRows: ys('#pf25Actions-action-dock .pf25Actions-action'),
      tray: box('#pf25Surface-fold-tray'),
      privateSheet: box('#pf25-private-daybook-sheet'),
      tabs: box('#pf25Surface-fold-tray .pf25Surface-fold-tabs'),
      dots: box('.pf25Spatial-mode-dots'),
      edgeFont: document.querySelector('.pf25Spatial-edge') ? getComputedStyle(document.querySelector('.pf25Spatial-edge')).fontSize : null,
      ticksInsideDial: (() => {
        const dial = document.querySelector('#pf25Surface-dial');
        if (!dial) return false;
        const d = dial.getBoundingClientRect();
        return [...dial.querySelectorAll('.pf25Surface-tick')].every(node => {
          const r = node.getBoundingClientRect();
          return r.left >= d.left - 2 && r.right <= d.right + 2 && r.top >= d.top - 2 && r.bottom <= d.bottom + 2;
        });
      })(),
      instrumentGlow: getComputedStyle(document.querySelector('#pf25Surface-instrument'), '::before').display,
      critical: ['#pf25Surface-instrument', '#pf25-dayline', '#pf25-rhythm', '#pf25Actions-action-dock', '#pf25Surface-fold-tray']
        .map(selector => box(selector))
        .filter(Boolean)
    };
  });
}

const fitsWidth = state => state.critical.every(r => r.left >= -1 && r.right <= state.vw + 1);

async function main() {
  fs.mkdirSync(artifacts, { recursive: true });
  const { server, origin } = await serve();
  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Toronto' });
    const page = await desktop.newPage();
    await page.addInitScript(seed);
    await page.goto(`${origin}/app/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#pf25Spatial-spatial-root[data-coherence="coherence-r1"]', { timeout: 15000 });
    await page.waitForSelector('#pf25-rhythm .pf25-rhythm-item');

    let state = await snapshot(page);
    console.log('Pacefold coherence desktop:', JSON.stringify(state));
    assert(state.overflow <= 1, `Desktop document overflows by ${state.overflow}px`);
    assert(state.outer === 'none', 'Decorative outer frame still competes with the clock');
    assert(!state.status || state.status.display === 'none', 'Verbose overdue status still competes with the quiet home rhythm');
    assert(!state.actionHead || state.actionHead.display === 'none', 'Quick actions still render as a dashboard header');
    assert(!state.dots || state.dots.display === 'none', 'Duplicate mode-dot navigation is still visible');
    assert(state.edgeFont === '0px', 'Spatial edge labels still crowd the canvas');
    assert(state.instrumentGlow === 'none', 'Obsolete instrument glow still renders behind the clock');
    assert(state.ticksInsideDial, 'Analog tick marks escape the rendered dial');
    if (state.dayState === 'active') {
      assert(state.dayNow && state.daySun && Math.abs((state.dayNow.left + state.dayNow.w / 2) - (state.daySun.left + state.daySun.w / 2)) < 18, 'Day Unfold current label is detached from its marker');
    }
    if (state.dayState === 'complete') assert(state.dayNowText === '', 'Completed workday still renders a duplicate current label');
    assert(state.tray?.position === 'fixed' && state.tray.h < 30 && state.tray.w < 80, 'Closed Daybook is not a discreet fold');
    assert(new Set(state.rhythmRows).size === 1, 'Desktop private rhythm marks are not one calm row');
    assert(new Set(state.actionRows).size === 1, 'Desktop private action marks are not one calm row');
    assert(fitsWidth(state), 'Desktop critical home elements escape the viewport');

    const closedHeight = state.tray.h;
    await page.click('#pf25-private-daybook-spine');
    await page.waitForFunction(() => document.querySelector('#pf25Surface-fold-tray')?.dataset.privateOpen === 'true' && !document.querySelector('#pf25-private-daybook-sheet')?.hidden);
    await page.waitForTimeout(120);
    state = await snapshot(page);
    assert(state.tray.h > closedHeight + 80, 'Private Daybook does not unfold upward into a usable note sheet');
    assert(state.privateSheet && state.privateSheet.display !== 'none' && state.privateSheet.h > 80, 'Private Daybook note sheet is not usable after opening');
    assert(!state.tabs || state.tabs.display === 'none', 'Old Daybook launcher tabs reappeared inside the private fold');
    await page.click('#pf25-private-daybook-spine');
    await page.waitForFunction(() => document.querySelector('#pf25Surface-fold-tray')?.dataset.privateOpen === 'false');
    await page.screenshot({ path: path.join(artifacts, 'pacefold-25-coherence-home.png'), fullPage: false });
    await desktop.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, timezoneId: 'America/Toronto' });
    const m = await mobile.newPage();
    await m.addInitScript(seed);
    await m.goto(`${origin}/app/`, { waitUntil: 'networkidle' });
    await m.waitForSelector('#pf25Spatial-spatial-root[data-coherence="coherence-r1"]', { timeout: 15000 });
    await m.waitForSelector('#pf25-rhythm .pf25-rhythm-item');
    const ms = await snapshot(m);
    console.log('Pacefold coherence mobile:', JSON.stringify(ms));

    assert(ms.overflow <= 1, `Mobile document overflows by ${ms.overflow}px`);
    assert(ms.instrumentGlow === 'none', 'Mobile obsolete instrument glow still renders');
    assert(ms.ticksInsideDial, 'Mobile analog tick marks escape the rendered dial');
    if (ms.dayState === 'active') {
      assert(ms.dayNow && ms.daySun && Math.abs((ms.dayNow.left + ms.dayNow.w / 2) - (ms.daySun.left + ms.daySun.w / 2)) < 18, 'Mobile Day Unfold label is detached from its marker');
    }
    if (ms.dayState === 'complete') assert(ms.dayNowText === '', 'Mobile completed workday still renders a duplicate current label');
    assert(fitsWidth(ms), 'Mobile critical home elements escape the viewport');
    assert(new Set(ms.rhythmRows).size === 1, 'Mobile private rhythm marks are not one contained row');
    assert(new Set(ms.actionRows).size === 1, 'Mobile private action marks are not one contained row');
    assert(ms.dial && ms.copy && Math.abs((ms.dial.top + ms.dial.h / 2) - (ms.copy.top + ms.copy.h / 2)) < 80, 'Mobile analog and digital clock are not composed as one instrument');
    assert(ms.tray && ms.tray.left >= -1 && ms.tray.right <= ms.vw + 1 && ms.tray.bottom <= ms.vh + 1, 'Mobile Daybook fold is clipped');
    assert(ms.dialWrap && ms.dialWrap.left >= 6 && ms.dialWrap.right <= ms.vw - 6, 'Mobile analog tick ring is clipped');
    for (const selector of ['#pf25-rhythm .pf25-rhythm-item', '#pf25Actions-action-dock .pf25Actions-action']) {
      const ok = await m.locator(selector).evaluateAll(nodes => nodes.every(node => {
        const r = node.getBoundingClientRect();
        return r.left >= -1 && r.right <= innerWidth + 1;
      }));
      assert(ok, `${selector} contains off-canvas items`);
    }
    await m.screenshot({ path: path.join(artifacts, 'pacefold-25-coherence-mobile.png'), fullPage: false });
    await mobile.close();

    console.log('Pacefold 25 coherence audit passed: one clock canvas, contained private rhythm/action marks, a discreet usable Daybook fold, and no duplicate navigation.');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
