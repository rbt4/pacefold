(() => {
  'use strict';

  const VERSION = '15.4.0';
  const ROOT_ID = 'pf-hub-root';
  const KEYS = {
    captures: 'pacefold.hub.captures.v1',
    care: 'pacefold.hub.care.v1',
    prefs: 'pacefold.hub.preferences.v1',
    badge: 'pacefold.hub.badge.v1',
    weather: 'pacefold.surface.weather.v1',
    radar: 'pacefold.surface.radar.v1',
    errors: 'pacefold.surface.errors.v1'
  };
  const DB_NAME = 'pacefold-hub';
  const DB_STORE = 'handles';
  const FOLDER_KEY = 'capture-folder';
  const WEATHER_TTL = 20 * 60 * 1000;
  const RADAR_TTL = 10 * 60 * 1000;

  if (document.getElementById(ROOT_ID)) return;

  const TYPES = {
    note: { label: 'Note', icon: 'note' },
    task: { label: 'Follow-up', icon: 'check' },
    incident: { label: 'Incident', icon: 'alert' },
    meeting: { label: 'Meeting', icon: 'calendar' },
    resource: { label: 'Resource', icon: 'link' }
  };

  const WEATHER_CODES = {
    0: ['Clear', 'sun'], 1: ['Mostly clear', 'sun'], 2: ['Partly cloudy', 'cloud-sun'], 3: ['Cloudy', 'cloud'],
    45: ['Fog', 'fog'], 48: ['Fog', 'fog'], 51: ['Light drizzle', 'rain'], 53: ['Drizzle', 'rain'],
    55: ['Heavy drizzle', 'rain'], 56: ['Freezing drizzle', 'rain'], 57: ['Freezing drizzle', 'rain'],
    61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'], 66: ['Freezing rain', 'rain'],
    67: ['Freezing rain', 'rain'], 71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'],
    77: ['Snow grains', 'snow'], 80: ['Rain showers', 'rain'], 81: ['Rain showers', 'rain'], 82: ['Heavy showers', 'storm'],
    85: ['Snow showers', 'snow'], 86: ['Heavy snow showers', 'snow'], 95: ['Thunderstorm', 'storm'],
    96: ['Storm with hail', 'storm'], 99: ['Storm with hail', 'storm']
  };

  const state = {
    captures: readJson(KEYS.captures, []),
    care: readJson(KEYS.care, {}),
    prefs: readJson(KEYS.prefs, {
      latitude: 43.6532,
      longitude: -79.3832,
      locationLabel: 'Toronto',
      volume: 0.62,
      captureType: 'note'
    }),
    weather: readCache(KEYS.weather, WEATHER_TTL),
    radar: readCache(KEYS.radar, RADAR_TTL),
    folderHandle: null,
    audioUrl: '',
    currentCue: null,
    drawer: null,
    toastTimer: 0,
    cueScanFrame: 0,
    legacyScanFrame: 0,
    weatherRequest: null,
    radarRequest: null,
    health: { storage: true, secure: window.isSecureContext, folder: 'showDirectoryPicker' in window },
    errors: readJson(KEYS.errors, []).slice(0, 20)
  };

  const nativeBadge = {
    set: typeof navigator.setAppBadge === 'function' ? navigator.setAppBadge.bind(navigator) : null,
    clear: typeof navigator.clearAppBadge === 'function' ? navigator.clearAppBadge.bind(navigator) : null
  };

  function icon(name, className = '') {
    const paths = {
      note: '<path d="M5 19h4l10-10-4-4L5 15v4Z"/><path d="m13.5 6.5 4 4"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 2.6 17.3A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.7L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
      chevron: '<path d="m8 10 4 4 4-4"/>',
      send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
      inbox: '<path d="M4 4h16v13H4z"/><path d="m4 13 4-4h8l4 4M8 17v3h8v-3"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      play: '<path d="m8 5 11 7-11 7Z"/>',
      pause: '<path d="M9 5v14M15 5v14"/>',
      music: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
      volume: '<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
      mute: '<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="m17 9 5 5M22 9l-5 5"/>',
      more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
      refresh: '<path d="M20 6v5h-5"/><path d="M19 11a8 8 0 1 0 1 5"/>',
      location: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
      external: '<path d="M14 3h7v7M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
      copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
      download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
      folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
      trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
      system: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V3h4v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.1v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
      cloud: '<path d="M17.5 19H6a4 4 0 0 1-.5-8A6 6 0 0 1 17 9a5 5 0 0 1 .5 10Z"/>',
      'cloud-sun': '<path d="M12 3V1M5.6 5.6 4.2 4.2M18.4 5.6l1.4-1.4M4 12H2"/><path d="M17.5 21H7a4 4 0 0 1-.5-8A6 6 0 0 1 18 11a5 5 0 0 1-.5 10Z"/><path d="M9 9a4 4 0 0 1 7.8 1"/>',
      rain: '<path d="M17.5 16H6a4 4 0 0 1-.5-8A6 6 0 0 1 17 6a5 5 0 0 1 .5 10Z"/><path d="m8 19-1 3M13 19l-1 3M18 19l-1 3"/>',
      snow: '<path d="M17.5 14H6a4 4 0 0 1-.5-8A6 6 0 0 1 17 4a5 5 0 0 1 .5 10Z"/><path d="M8 18h.01M12 21h.01M17 18h.01"/>',
      storm: '<path d="M17.5 14H6a4 4 0 0 1-.5-8A6 6 0 0 1 17 4a5 5 0 0 1 .5 10Z"/><path d="m13 15-3 5h4l-2 3"/>',
      fog: '<path d="M5 9h14M3 13h18M6 17h12"/>'
    };
    return `<svg class="pf-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.more}</svg>`;
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { state.health.storage = false; recordError('storage', error); return false; }
  }

  function readCache(key, ttl) {
    const cache = readJson(key, null);
    return cache && Date.now() - Number(cache.savedAt || 0) < ttl ? cache.data : null;
  }

  function writeCache(key, data) {
    writeJson(key, { savedAt: Date.now(), data });
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function formatTime(value) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  }

  function formatDay(value) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${value}T12:00:00`));
  }

  function visible(element) {
    if (!element?.isConnected) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
  }

  function weatherInfo(code) {
    return WEATHER_CODES[code] || ['Mixed conditions', 'cloud'];
  }

  function audio() {
    return document.querySelector('[data-pf-audio]');
  }

  function recordError(scope, error) {
    const entry = {
      scope,
      message: String(error?.message || error || 'Unknown error').slice(0, 500),
      at: new Date().toISOString()
    };
    state.errors.unshift(entry);
    state.errors = state.errors.slice(0, 20);
    try { localStorage.setItem(KEYS.errors, JSON.stringify(state.errors)); } catch {}
    updateHealthIndicator();
  }

  function safe(action, scope = 'action') {
    return async (...args) => {
      try { return await action(...args); }
      catch (error) { recordError(scope, error); toast('That action failed. Pacefold kept your local data safe.'); }
    };
  }

  function toast(message) {
    document.querySelector('.pf-toast')?.remove();
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const element = document.createElement('div');
    element.className = 'pf-toast';
    element.role = 'status';
    element.textContent = message;
    root.append(element);
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => element.remove(), 3200);
  }

  function mount() {
    if (!document.body) return document.addEventListener('DOMContentLoaded', mount, { once: true });

    const root = document.createElement('aside');
    root.id = ROOT_ID;
    root.className = 'pf-surface';
    root.dataset.version = VERSION;
    root.setAttribute('aria-label', `Pacefold Kanso surface ${VERSION}`);
    root.innerHTML = `
      <section class="pf-drawer" data-pf-drawer hidden aria-live="polite">
        <header class="pf-drawer-header">
          <div>
            <p class="pf-kicker" data-pf-drawer-kicker>Pacefold</p>
            <h2 class="pf-drawer-title" data-pf-drawer-title>Inbox</h2>
          </div>
          <button class="pf-icon-button pf-icon-button--quiet" data-pf-action="close-drawer" aria-label="Close panel">${icon('close')}</button>
        </header>
        <div class="pf-drawer-content" data-pf-drawer-content></div>
      </section>

      <div class="pf-workstrip">
        <div class="pf-capture-band">
          <button class="pf-andon" data-pf-action="handle-cue" type="button" title="Current Pacefold action">
            <span class="pf-andon-lamp" aria-hidden="true"></span>
            <span class="pf-andon-copy"><strong data-pf-cue-label>All clear</strong><small data-pf-cue-detail>Quietly keeping pace</small></span>
          </button>

          <form class="pf-capture-form" data-pf-capture-form>
            <button class="pf-type-button" data-pf-action="type-menu" type="button" aria-haspopup="menu" aria-expanded="false">
              <span data-pf-type-icon>${icon(TYPES[state.prefs.captureType]?.icon || 'note')}</span>
              <span data-pf-type-label>${esc(TYPES[state.prefs.captureType]?.label || 'Note')}</span>
              ${icon('chevron', 'pf-icon--small')}
            </button>
            <label class="pf-visually-hidden" for="pf-capture-input">Quick capture</label>
            <input id="pf-capture-input" class="pf-capture-input" data-pf-capture-input autocomplete="off" maxlength="900" placeholder="Capture what should not be lost…">
            <button class="pf-save-button" type="submit"><span>Save</span>${icon('send')}</button>
          </form>

          <div class="pf-glance-actions">
            <button class="pf-glance-button pf-weather-pill" data-pf-action="open-weather" type="button" aria-label="Open weather glance">
              <span data-pf-weather-icon>${icon('cloud')}</span>
              <span><strong data-pf-weather-temp>—</strong><small data-pf-weather-label>Toronto</small></span>
            </button>
            <button class="pf-glance-button" data-pf-action="open-inbox" type="button" aria-label="Open capture inbox">
              ${icon('inbox')}
              <span><strong data-pf-capture-count>${state.captures.length}</strong><small>Inbox</small></span>
            </button>
          </div>
        </div>

        <div class="pf-player-band" data-pf-player-dropzone>
          <button class="pf-play-button" data-pf-action="play" type="button" aria-label="Play or pause">${icon('play')}</button>
          <div class="pf-track-copy">
            <strong data-pf-track-title>Quiet audio</strong>
            <small data-pf-track-meta>Drop a file here or choose a source</small>
          </div>
          <input class="pf-progress" data-pf-progress type="range" min="0" max="1000" value="0" aria-label="Track position" disabled>
          <button class="pf-player-button" data-pf-action="source-menu" type="button">${icon('music')}<span>Source</span></button>
          <button class="pf-icon-button" data-pf-action="volume" type="button" aria-label="Change volume">${icon('volume')}</button>
          <button class="pf-icon-button pf-health-button" data-pf-action="open-system" type="button" aria-label="Open system status" hidden>${icon('system')}</button>
          <input class="pf-visually-hidden" data-pf-audio-input type="file" accept="audio/*">
          <audio data-pf-audio preload="metadata"></audio>
        </div>
      </div>`;

    document.body.append(root);
    document.documentElement.classList.add('pf-hub-mounted');
    bind(root);
    syncHostTheme();
    renderCaptureCount();
    renderWeatherPill();
    restoreFolder();
    installBadgeBridge();
    scheduleCueScan();
    scheduleLegacyScan();
    installObserver(root);
    installMediaSession();
    updatePlayer();
    updateHealthIndicator();
    if (!state.weather) setTimeout(() => refreshWeather({ force: false, includeRadar: false, quiet: true }), 900);
    window.__PACEFOLD_SURFACE__ = { version: VERSION, getState: () => ({ drawer: state.drawer, cue: Boolean(state.currentCue), captures: state.captures.length, errors: state.errors.length }) };
    console.info(`[Pacefold Kanso ${VERSION}] mounted`);
  }

  function bind(root) {
    root.querySelector('[data-pf-capture-form]').addEventListener('submit', safe(saveCapture, 'capture'));
    root.addEventListener('click', safe(handleClick, 'click'));
    root.querySelector('[data-pf-progress]').addEventListener('input', seekAudio);
    root.querySelector('[data-pf-audio-input]').addEventListener('change', chooseAudio);

    const player = audio();
    player.volume = Number.isFinite(state.prefs.volume) ? state.prefs.volume : 0.62;
    ['play', 'pause', 'timeupdate', 'loadedmetadata', 'ended', 'error'].forEach(name => player.addEventListener(name, updatePlayer));

    const dropzone = root.querySelector('[data-pf-player-dropzone]');
    dropzone.addEventListener('dragover', event => { event.preventDefault(); dropzone.classList.add('is-drop-target'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-drop-target'));
    dropzone.addEventListener('drop', event => {
      event.preventDefault();
      dropzone.classList.remove('is-drop-target');
      const file = [...(event.dataTransfer?.files || [])].find(item => item.type.startsWith('audio/'));
      if (file) loadAudioFile(file);
    });

    document.addEventListener('pointerdown', closeTransientUi, true);
    document.addEventListener('keydown', handleKeyboard);
    window.addEventListener('focus', acknowledgeTaskbarBadge);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') acknowledgeTaskbarBadge();
    });
    window.addEventListener('error', event => {
      if (/pacefold-hub|pacefold Kanso|pf-surface/i.test(String(event.filename || event.message))) recordError('runtime', event.error || event.message);
    });
    window.addEventListener('unhandledrejection', event => {
      const detail = String(event.reason?.stack || event.reason || '');
      if (/pacefold-hub|pacefold Kanso|pf-surface/i.test(detail)) recordError('promise', event.reason);
    });
  }

  async function handleClick(event) {
    const button = event.target.closest('[data-pf-action]');
    if (!button) return;
    const action = button.dataset.pfAction;
    if (action === 'handle-cue') handleCurrentCue();
    else if (action === 'type-menu') toggleTypeMenu(button);
    else if (action === 'open-inbox') openDrawer('inbox');
    else if (action === 'open-weather') openDrawer('weather');
    else if (action === 'open-system') openDrawer('system');
    else if (action === 'close-drawer') closeDrawer();
    else if (action === 'choose-type') chooseCaptureType(button.dataset.type);
    else if (action === 'delete-capture') deleteCapture(button.dataset.id);
    else if (action === 'copy-day') return copyDay();
    else if (action === 'share-day') return shareDay();
    else if (action === 'export-day') exportDay();
    else if (action === 'choose-folder') return chooseFolder();
    else if (action === 'clear-captures') clearCaptures();
    else if (action === 'refresh-weather') return refreshWeather({ force: true, includeRadar: true, quiet: false });
    else if (action === 'use-location') useLocation();
    else if (action === 'open-msn') openExternal('https://www.msn.com/en-ca/weather/forecast/in-Toronto,Ontario', 'MSN Weather');
    else if (action === 'play') return togglePlay();
    else if (action === 'source-menu') toggleSourceMenu(button);
    else if (action === 'choose-audio') rootAudioInput().click();
    else if (action === 'open-service') openExternal(button.dataset.url, button.dataset.label || 'music service');
    else if (action === 'volume') cycleVolume();
  }

  function handleKeyboard(event) {
    if (event.key === 'Escape') { closePopover(); closeDrawer(); return; }
    if (event.ctrlKey && event.shiftKey && event.code === 'Space') {
      event.preventDefault();
      document.querySelector('[data-pf-capture-input]')?.focus();
    }
    if (event.altKey && event.code === 'KeyP') {
      event.preventDefault();
      togglePlay();
    }
  }

  function installObserver(root) {
    const observer = new MutationObserver(mutations => {
      if (mutations.every(mutation => root.contains(mutation.target))) return;
      scheduleCueScan();
      scheduleLegacyScan();
      syncHostTheme();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-hidden'] });
  }

  function scheduleCueScan() {
    if (state.cueScanFrame) return;
    state.cueScanFrame = requestAnimationFrame(() => { state.cueScanFrame = 0; detectCue(); });
  }

  function scheduleLegacyScan() {
    if (state.legacyScanFrame) return;
    state.legacyScanFrame = requestAnimationFrame(() => { state.legacyScanFrame = 0; suppressRedundantLegacyTools(); });
  }

  function suppressRedundantLegacyTools() {
    const root = document.getElementById(ROOT_ID);
    const labels = /^(capture|care|sound|onenote)$/i;
    document.querySelectorAll('button,a,[role="button"]').forEach(element => {
      if (root?.contains(element) || element.dataset.pfSuperseded === 'true') return;
      const label = (element.textContent || element.getAttribute('aria-label') || '').trim();
      if (!labels.test(label) || !visible(element)) return;
      if (element.closest('[role="dialog"],.settings,[class*="settings"],[data-settings]')) return;
      const rect = element.getBoundingClientRect();
      const dockContext = element.closest('nav,[class*="dock"],[class*="quick"],[class*="tool"]');
      const edgeControl = rect.bottom > innerHeight - 190 || rect.right > innerWidth - 170;
      if (!dockContext && !edgeControl) return;
      element.dataset.pfSuperseded = 'true';
      element.setAttribute('aria-hidden', 'true');
      element.tabIndex = -1;
    });
  }

  function syncHostTheme() {
    const root = document.getElementById(ROOT_ID);
    if (!root || !document.body) return;
    const style = getComputedStyle(document.body);
    const rgb = style.backgroundColor.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [15, 18, 22];
    const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    root.dataset.tone = luminance > 0.56 ? 'light' : 'dark';
    const hour = new Date().getHours();
    root.dataset.phase = hour < 7 || hour >= 21 ? 'night' : hour >= 17 ? 'evening' : 'day';
  }

  async function saveCapture(event) {
    event.preventDefault();
    const input = document.querySelector('[data-pf-capture-input]');
    const text = input.value.trim();
    if (!text) return input.focus();
    const type = TYPES[state.prefs.captureType] ? state.prefs.captureType : 'note';
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      text,
      createdAt: new Date().toISOString(),
      syncedToFolder: false
    };
    state.captures.unshift(item);
    state.captures = state.captures.slice(0, 300);
    writeJson(KEYS.captures, state.captures);
    input.value = '';
    renderCaptureCount();
    document.querySelector('.pf-capture-form')?.classList.add('is-saved');
    setTimeout(() => document.querySelector('.pf-capture-form')?.classList.remove('is-saved'), 700);

    if (await appendFolder(item)) {
      item.syncedToFolder = true;
      writeJson(KEYS.captures, state.captures);
      toast('Saved locally and added to your daily file.');
    } else {
      toast('Saved.');
    }
    if (state.drawer === 'inbox') renderDrawer();
  }

  function renderCaptureCount() {
    document.querySelector('[data-pf-capture-count]')?.replaceChildren(document.createTextNode(String(state.captures.length)));
  }

  function chooseCaptureType(type) {
    if (!TYPES[type]) return;
    state.prefs.captureType = type;
    writeJson(KEYS.prefs, state.prefs);
    document.querySelector('[data-pf-type-icon]').innerHTML = icon(TYPES[type].icon);
    document.querySelector('[data-pf-type-label]').textContent = TYPES[type].label;
    closePopover();
    document.querySelector('[data-pf-capture-input]')?.focus();
  }

  function toggleTypeMenu(anchor) {
    const existing = document.querySelector('[data-pf-popover="type"]');
    if (existing) return closePopover();
    closePopover();
    const menu = document.createElement('div');
    menu.className = 'pf-popover pf-type-menu';
    menu.dataset.pfPopover = 'type';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = Object.entries(TYPES).map(([key, item]) => `
      <button class="pf-menu-item${key === state.prefs.captureType ? ' is-selected' : ''}" data-pf-action="choose-type" data-type="${key}" role="menuitem">
        ${icon(item.icon)}<span>${esc(item.label)}</span>${key === state.prefs.captureType ? icon('check') : ''}
      </button>`).join('');
    document.getElementById(ROOT_ID).append(menu);
    positionPopover(menu, anchor);
    anchor.setAttribute('aria-expanded', 'true');
  }

  function openDrawer(kind) {
    state.drawer = state.drawer === kind ? null : kind;
    renderDrawer();
    if (state.drawer === 'weather') refreshWeather({ force: false, includeRadar: true, quiet: true });
  }

  function closeDrawer() {
    state.drawer = null;
    renderDrawer();
  }

  function renderDrawer() {
    const drawer = document.querySelector('[data-pf-drawer]');
    const title = document.querySelector('[data-pf-drawer-title]');
    const kicker = document.querySelector('[data-pf-drawer-kicker]');
    const content = document.querySelector('[data-pf-drawer-content]');
    if (!drawer || !content) return;
    drawer.hidden = !state.drawer;
    drawer.classList.toggle('is-open', Boolean(state.drawer));
    if (!state.drawer) return;

    if (state.drawer === 'inbox') {
      kicker.textContent = 'Kiroku · local first';
      title.textContent = 'What you kept';
      content.innerHTML = inboxMarkup();
    } else if (state.drawer === 'weather') {
      kicker.textContent = `${state.prefs.locationLabel} · quiet glance`;
      title.textContent = 'Weather in context';
      content.innerHTML = weatherMarkup();
    } else {
      kicker.textContent = 'Pacefold · local diagnostics';
      title.textContent = 'System status';
      content.innerHTML = systemMarkup();
    }
  }

  function inboxMarkup() {
    const items = state.captures.slice(0, 10);
    const folderLabel = state.folderHandle ? 'Folder connected' : 'Connect folder';
    return `
      <div class="pf-drawer-summary">
        <div><strong>${state.captures.length}</strong><span>kept locally</span></div>
        <p>One inbox. Export only when useful; OneNote remains available through Windows Share instead of a fragile dedicated sign-in.</p>
      </div>
      <div class="pf-inbox-list">
        ${items.length ? items.map(captureItemMarkup).join('') : '<div class="pf-empty-state"><strong>Nothing waiting.</strong><span>Use the always-open capture field below.</span></div>'}
      </div>
      <div class="pf-action-row">
        <button class="pf-secondary-button" data-pf-action="copy-day">${icon('copy')} Copy today</button>
        <button class="pf-secondary-button" data-pf-action="share-day">${icon('share')} Share to OneNote or another app</button>
        <button class="pf-secondary-button" data-pf-action="export-day">${icon('download')} Markdown</button>
        <button class="pf-secondary-button" data-pf-action="choose-folder">${icon('folder')} ${folderLabel}</button>
        <button class="pf-secondary-button pf-secondary-button--danger" data-pf-action="clear-captures">${icon('trash')} Clear local list</button>
      </div>`;
  }

  function captureItemMarkup(item) {
    const type = TYPES[item.type] || TYPES.note;
    return `<article class="pf-inbox-item">
      <span class="pf-inbox-icon">${icon(type.icon)}</span>
      <div><p>${esc(item.text)}</p><small>${esc(type.label)} · ${formatTime(item.createdAt)}${item.syncedToFolder ? ' · filed' : ''}</small></div>
      <button class="pf-icon-button pf-icon-button--quiet" data-pf-action="delete-capture" data-id="${esc(item.id)}" aria-label="Delete capture">${icon('close')}</button>
    </article>`;
  }

  function weatherMarkup() {
    if (!state.weather) return `
      <div class="pf-empty-state pf-empty-state--weather"><strong>Weather is unavailable.</strong><span>Pacefold remains fully usable offline.</span></div>
      ${weatherActionsMarkup()}`;

    const current = state.weather.current || {};
    const [description, symbol] = weatherInfo(current.weather_code);
    const daily = state.weather.daily || {};
    const rain = nextRain();
    return `
      <div class="pf-weather-hero">
        <span class="pf-weather-glyph">${icon(symbol)}</span>
        <div><strong>${Math.round(current.temperature_2m ?? 0)}°</strong><span>${esc(description)} · feels ${Math.round(current.apparent_temperature ?? current.temperature_2m ?? 0)}°</span><small>${Math.round(current.wind_speed_10m ?? 0)} km/h${rain ? ` · rain ${rain}` : ''}</small></div>
      </div>
      <div class="pf-forecast-row">
        ${(daily.time || []).slice(0, 3).map((date, index) => {
          const [dayDescription, daySymbol] = weatherInfo(daily.weather_code?.[index]);
          return `<article><header><strong>${formatDay(date)}</strong>${icon(daySymbol)}</header><span>${Math.round(daily.temperature_2m_max?.[index] ?? 0)}° / ${Math.round(daily.temperature_2m_min?.[index] ?? 0)}°</span><small>${esc(dayDescription)} · ${Math.round(daily.precipitation_probability_max?.[index] ?? 0)}%</small></article>`;
        }).join('')}
      </div>
      ${radarMarkup()}
      ${weatherActionsMarkup()}`;
  }

  function radarMarkup() {
    const tiles = state.radar ? radarUrls(state.prefs.latitude, state.prefs.longitude, state.radar) : [];
    return `<button class="pf-radar" data-pf-action="open-msn" type="button" aria-label="Open full weather map in MSN Weather">
      ${tiles.length ? `<span class="pf-radar-grid">${tiles.map(url => `<img src="${esc(url)}" alt="" loading="lazy">`).join('')}</span>` : '<span class="pf-radar-fallback"></span>'}
      <span class="pf-radar-crosshair" aria-hidden="true"></span>
      <span class="pf-radar-label">${tiles.length ? 'Latest radar' : 'Radar not loaded'} · open MSN</span>
    </button>`;
  }

  function weatherActionsMarkup() {
    return `<div class="pf-action-row">
      <button class="pf-secondary-button" data-pf-action="refresh-weather">${icon('refresh')} Refresh</button>
      <button class="pf-secondary-button" data-pf-action="use-location">${icon('location')} Use my location</button>
      <button class="pf-secondary-button" data-pf-action="open-msn">${icon('external')} MSN Weather</button>
    </div>`;
  }

  function systemMarkup() {
    const checks = [
      ['Local storage', state.health.storage, state.health.storage ? 'Available' : 'Blocked'],
      ['Secure context', state.health.secure, state.health.secure ? 'Active' : 'Required for folder and badge features'],
      ['Folder bridge', state.health.folder, state.health.folder ? (state.folderHandle ? 'Connected' : 'Available') : 'Unsupported in this browser'],
      ['Service worker', Boolean(navigator.serviceWorker?.controller), navigator.serviceWorker?.controller ? 'Controlling this page' : 'Activates after install/reload'],
      ['Notifications', typeof Notification === 'undefined' || Notification.permission !== 'denied', typeof Notification === 'undefined' ? 'Unavailable in this browser' : Notification.permission]
    ];
    return `<div class="pf-system-grid">${checks.map(([label, ok, detail]) => `<article class="${ok ? 'is-good' : 'is-warning'}"><span class="pf-system-dot"></span><div><strong>${esc(label)}</strong><small>${esc(detail)}</small></div></article>`).join('')}</div>
      <div class="pf-error-journal"><h3>Recent surface errors</h3>${state.errors.length ? state.errors.map(item => `<p><strong>${esc(item.scope)}</strong><span>${esc(item.message)}</span><small>${formatTime(item.at)}</small></p>`).join('') : '<div class="pf-empty-state"><strong>No recorded errors.</strong><span>The Kanso surface is running cleanly.</span></div>'}</div>`;
  }

  function markdown() {
    const today = new Date().toISOString().slice(0, 10);
    const items = state.captures.filter(item => item.createdAt.slice(0, 10) === today).slice().reverse();
    const lines = [`# Pacefold Inbox — ${today}`, '', `Generated by Pacefold Kanso ${VERSION}.`, ''];
    if (!items.length) lines.push('_No captures yet._');
    for (const item of items) {
      const type = TYPES[item.type] || TYPES.note;
      lines.push(`- **${type.label} · ${formatTime(item.createdAt)}** — ${item.text.replace(/\s+/g, ' ').trim()}`);
    }
    return `${lines.join('\n')}\n`;
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.append(area);
      area.select();
      const okay = document.execCommand('copy');
      area.remove();
      return okay;
    }
  }

  async function copyDay() { toast(await copyText(markdown()) ? 'Today copied as Markdown.' : 'Copy failed. Use Markdown export.'); }

  async function shareDay() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Pacefold Inbox ${new Date().toISOString().slice(0, 10)}`, text: markdown() });
        return toast('Shared. Choose OneNote when Windows offers it.');
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    toast(await copyText(markdown()) ? 'Share was unavailable, so today was copied.' : 'Share unavailable. Use Markdown export.');
  }

  function exportDay() {
    const date = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Pacefold-Inbox-${date}.md`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Daily Markdown exported.');
  }

  function deleteCapture(id) {
    state.captures = state.captures.filter(item => item.id !== id);
    writeJson(KEYS.captures, state.captures);
    renderCaptureCount();
    if (state.drawer === 'inbox') renderDrawer();
  }

  function clearCaptures() {
    if (!state.captures.length || !confirm('Clear the local Pacefold capture list? Exported files will not be deleted.')) return;
    state.captures = [];
    writeJson(KEYS.captures, []);
    renderCaptureCount();
    renderDrawer();
    toast('Local capture list cleared.');
  }

  function rootAudioInput() { return document.querySelector('[data-pf-audio-input]'); }

  function chooseAudio(event) {
    const file = event.target.files?.[0];
    if (file) loadAudioFile(file);
  }

  function loadAudioFile(file) {
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    state.audioUrl = URL.createObjectURL(file);
    const player = audio();
    player.src = state.audioUrl;
    player.dataset.trackTitle = file.name.replace(/\.[^.]+$/, '');
    player.dataset.trackMeta = `${Math.round(file.size / 104857.6) / 10} MB · local file`;
    player.play().catch(() => toast('Press play to start the selected audio.'));
    updatePlayer();
  }

  async function togglePlay() {
    const player = audio();
    if (!player.src) return rootAudioInput().click();
    if (player.paused) await player.play(); else player.pause();
    updatePlayer();
  }

  function seekAudio(event) {
    const player = audio();
    if (Number.isFinite(player.duration) && player.duration > 0) player.currentTime = Number(event.target.value) / 1000 * player.duration;
  }

  function updatePlayer() {
    const player = audio();
    const play = document.querySelector('[data-pf-action="play"]');
    const title = document.querySelector('[data-pf-track-title]');
    const meta = document.querySelector('[data-pf-track-meta]');
    const range = document.querySelector('[data-pf-progress]');
    if (!player || !play || !title || !meta || !range) return;
    play.innerHTML = icon(player.paused ? 'play' : 'pause');
    play.classList.toggle('is-playing', !player.paused);
    title.textContent = player.dataset.trackTitle || 'Quiet audio';
    if (Number.isFinite(player.duration) && player.duration > 0) {
      range.disabled = false;
      range.value = String(Math.round(player.currentTime / player.duration * 1000));
      meta.textContent = `${duration(player.currentTime)} / ${duration(player.duration)} · ${player.dataset.trackMeta || 'local audio'}`;
    } else {
      range.disabled = true;
      range.value = '0';
      meta.textContent = player.dataset.trackMeta || 'Drop a file here or choose a source';
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = player.paused ? 'paused' : 'playing';
      if (player.dataset.trackTitle) navigator.mediaSession.metadata = new MediaMetadata({ title: player.dataset.trackTitle, artist: 'Pacefold local audio' });
    }
  }

  function duration(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }

  function cycleVolume() {
    const player = audio();
    const steps = [0, 0.35, 0.62, 1];
    const next = steps.find(value => value > player.volume + 0.01) ?? 0;
    player.volume = next;
    state.prefs.volume = next;
    writeJson(KEYS.prefs, state.prefs);
    document.querySelector('[data-pf-action="volume"]').innerHTML = icon(next === 0 ? 'mute' : 'volume');
    toast(next === 0 ? 'Player muted.' : `Player volume ${Math.round(next * 100)}%.`);
  }

  function toggleSourceMenu(anchor) {
    if (document.querySelector('[data-pf-popover="source"]')) return closePopover();
    closePopover();
    const menu = document.createElement('div');
    menu.className = 'pf-popover pf-source-menu';
    menu.dataset.pfPopover = 'source';
    menu.innerHTML = `
      <button class="pf-menu-item" data-pf-action="choose-audio">${icon('music')}<span><strong>Local audio</strong><small>Choose a file from this device</small></span></button>
      <button class="pf-menu-item" data-pf-action="open-service" data-label="YouTube Music" data-url="https://music.youtube.com/">${icon('external')}<span><strong>YouTube Music</strong><small>Open in a new tab</small></span></button>
      <button class="pf-menu-item" data-pf-action="open-service" data-label="Spotify" data-url="https://open.spotify.com/">${icon('external')}<span><strong>Spotify</strong><small>Open in a new tab</small></span></button>
      <button class="pf-menu-item" data-pf-action="open-service" data-label="Amazon Music" data-url="https://music.amazon.ca/">${icon('external')}<span><strong>Amazon Music</strong><small>Open in a new tab</small></span></button>`;
    document.getElementById(ROOT_ID).append(menu);
    positionPopover(menu, anchor, true);
  }

  function installMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => audio()?.play());
      navigator.mediaSession.setActionHandler('pause', () => audio()?.pause());
      navigator.mediaSession.setActionHandler('seekbackward', details => { audio().currentTime = Math.max(0, audio().currentTime - (details.seekOffset || 10)); });
      navigator.mediaSession.setActionHandler('seekforward', details => { audio().currentTime = Math.min(audio().duration || Infinity, audio().currentTime + (details.seekOffset || 10)); });
    } catch (error) { recordError('media-session', error); }
  }

  async function refreshWeather({ force = false, includeRadar = false, quiet = false } = {}) {
    if (state.weatherRequest) return state.weatherRequest;
    if (!force && state.weather && (!includeRadar || state.radar)) {
      renderWeatherPill();
      if (state.drawer === 'weather') renderDrawer();
      return;
    }

    const query = new URLSearchParams({
      latitude: String(state.prefs.latitude),
      longitude: String(state.prefs.longitude),
      current: 'temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m',
      hourly: 'precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: '3'
    });

    state.weatherRequest = (async () => {
      try {
        state.weather = await fetchJson(`https://api.open-meteo.com/v1/forecast?${query}`, 8000);
        writeCache(KEYS.weather, state.weather);
        if (includeRadar) {
          state.radar = await loadRadar().catch(error => { recordError('radar', error); return state.radar; });
          if (state.radar) writeCache(KEYS.radar, state.radar);
        }
        renderWeatherPill();
        if (state.drawer === 'weather') renderDrawer();
        if (!quiet) toast('Weather refreshed.');
      } catch (error) {
        recordError('weather', error);
        if (state.drawer === 'weather') renderDrawer();
        if (!quiet) toast('Weather could not refresh. Cached information remains available.');
      } finally {
        state.weatherRequest = null;
      }
    })();
    return state.weatherRequest;
  }

  async function fetchJson(url, timeout = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  async function loadRadar() {
    const data = await fetchJson('https://api.rainviewer.com/public/weather-maps.json', 7000);
    const frames = [...(data.radar?.past || []), ...(data.radar?.nowcast || [])];
    const frame = frames.at(-1);
    return frame && data.host ? { host: data.host, path: frame.path, time: frame.time } : null;
  }

  function renderWeatherPill() {
    const temp = document.querySelector('[data-pf-weather-temp]');
    const label = document.querySelector('[data-pf-weather-label]');
    const iconHolder = document.querySelector('[data-pf-weather-icon]');
    const root = document.getElementById(ROOT_ID);
    if (!temp || !label || !iconHolder || !root) return;
    label.textContent = state.prefs.locationLabel;
    if (!state.weather?.current) {
      temp.textContent = '—';
      iconHolder.innerHTML = icon('cloud');
      root.dataset.weather = 'unknown';
      return;
    }
    const current = state.weather.current;
    const [, symbol] = weatherInfo(current.weather_code);
    temp.textContent = `${Math.round(current.temperature_2m ?? 0)}°`;
    iconHolder.innerHTML = icon(symbol);
    root.dataset.weather = symbol.includes('rain') || symbol === 'storm' ? 'rain' : symbol === 'snow' ? 'snow' : symbol === 'sun' ? 'clear' : 'cloud';
  }

  function nextRain() {
    const times = state.weather?.hourly?.time || [];
    const values = state.weather?.hourly?.precipitation_probability || [];
    const now = Date.now();
    for (let index = 0; index < times.length; index += 1) {
      const at = new Date(times[index]).getTime();
      if (at >= now && Number(values[index]) >= 35) return `${Math.round(values[index])}% around ${formatTime(at)}`;
    }
    return '';
  }

  function radarUrls(latitude, longitude, radar) {
    const zoom = 6;
    const x = Math.floor((longitude + 180) / 360 * 2 ** zoom);
    const latitudeRadians = latitude * Math.PI / 180;
    const y = Math.floor((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * 2 ** zoom);
    return [[x - 1, y - 1], [x, y - 1], [x + 1, y - 1], [x - 1, y], [x, y], [x + 1, y]]
      .map(([tileX, tileY]) => `${radar.host}${radar.path}/256/${zoom}/${tileX}/${tileY}/2/1_1.png`);
  }

  function useLocation() {
    if (!navigator.geolocation) return toast('Location is unavailable in this browser.');
    navigator.geolocation.getCurrentPosition(position => {
      state.prefs.latitude = Number(position.coords.latitude.toFixed(4));
      state.prefs.longitude = Number(position.coords.longitude.toFixed(4));
      state.prefs.locationLabel = 'Current location';
      state.weather = null;
      state.radar = null;
      writeJson(KEYS.prefs, state.prefs);
      refreshWeather({ force: true, includeRadar: true, quiet: false });
    }, () => toast('Location permission was not granted. Toronto remains the default.'), { maximumAge: 1800000, timeout: 8000 });
  }

  function installBadgeBridge() {
    if (nativeBadge.set) {
      try {
        navigator.setAppBadge = async value => {
          const normalized = value == null ? 1 : value;
          writeJson(KEYS.badge, { waiting: true, acknowledged: false, value: normalized, at: new Date().toISOString() });
          scheduleCueScan();
          return nativeBadge.set(normalized);
        };
      } catch (error) { recordError('badge-bridge', error); }
    }
    acknowledgeTaskbarBadge();
  }

  function acknowledgeTaskbarBadge() {
    try { nativeBadge.clear?.(); } catch (error) { recordError('badge-clear', error); }
    const previous = readJson(KEYS.badge, {});
    writeJson(KEYS.badge, { ...previous, acknowledged: true, at: new Date().toISOString() });
    try { navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_BADGE', source: 'pacefold-kanso' }); } catch {}
    renderCue();
  }

  function detectCue() {
    const root = document.getElementById(ROOT_ID);
    const candidates = [...document.querySelectorAll('[role="alert"],[role="dialog"],.notification,.toast,.cue,[data-active-cue]')]
      .filter(element => !root?.contains(element) && visible(element));
    state.currentCue = candidates.find(element => {
      const text = (element.textContent || '').trim();
      return text && /(clear|done|log|drink|water|move|break|prayer|meal|lunch|eyes|look|prepare|noodle|away)/i.test(text);
    }) || null;
    renderCue();
  }

  function cueMeta() {
    const text = (state.currentCue?.textContent || '').trim();
    if (/prayer/i.test(text)) return ['Prayer', 'Quiet moment ready'];
    if (/drink|water|sip/i.test(text)) return ['Hydrate', 'One small reset'];
    if (/eyes|look/i.test(text)) return ['Look far', '20 seconds'];
    if (/move|stretch|posture/i.test(text)) return ['Move', 'Reset your position'];
    if (/meal|lunch/i.test(text)) return ['Meal', 'Your pause is ready'];
    if (/prepare|noodle/i.test(text)) return ['Prepare', 'Start the next step'];
    if (/away|break/i.test(text)) return ['Step away', 'A real pause'];
    return state.currentCue ? ['One action', 'Open and complete'] : ['All clear', 'Quietly keeping pace'];
  }

  function renderCue() {
    const button = document.querySelector('[data-pf-action="handle-cue"]');
    const label = document.querySelector('[data-pf-cue-label]');
    const detail = document.querySelector('[data-pf-cue-detail]');
    if (!button || !label || !detail) return;
    const badge = readJson(KEYS.badge, {});
    const waiting = Boolean(state.currentCue || badge?.waiting && !badge?.acknowledged);
    const [nextLabel, nextDetail] = cueMeta();
    if (button.classList.contains('is-waiting') !== waiting) button.classList.toggle('is-waiting', waiting);
    if (label.textContent !== nextLabel) label.textContent = nextLabel;
    if (detail.textContent !== nextDetail) detail.textContent = nextDetail;
  }

  function handleCurrentCue() {
    const handled = clickCueAction();
    if (handled) {
      state.currentCue = null;
      writeJson(KEYS.badge, { waiting: false, acknowledged: true, at: new Date().toISOString() });
      try { nativeBadge.clear?.(); } catch {}
      toast('Action handled.');
    } else {
      acknowledgeTaskbarBadge();
      toast('Taskbar indicator cleared.');
    }
    renderCue();
  }

  function clickCueAction() {
    const root = document.getElementById(ROOT_ID);
    const scope = state.currentCue || document;
    const buttons = [...scope.querySelectorAll('button,[role="button"]')].filter(button => !root?.contains(button) && visible(button));
    const preferred = buttons.find(button => /^(clear|done|log|dismiss|complete|acknowledge|start)$/i.test((button.textContent || button.getAttribute('aria-label') || '').trim()));
    if (!preferred) return false;
    preferred.click();
    return true;
  }

  function updateHealthIndicator() {
    const button = document.querySelector('[data-pf-action="open-system"]');
    if (!button) return;
    const show = state.errors.length > 0 || !state.health.storage || !state.health.secure;
    button.hidden = !show;
    button.classList.toggle('is-warning', show);
  }

  function positionPopover(menu, anchor, alignRight = false) {
    const rect = anchor.getBoundingClientRect();
    const rootRect = document.getElementById(ROOT_ID).getBoundingClientRect();
    menu.style.bottom = `${Math.max(64, rootRect.bottom - rect.top + 8)}px`;
    if (alignRight) menu.style.right = `${Math.max(8, innerWidth - rect.right)}px`;
    else menu.style.left = `${Math.max(8, rect.left)}px`;
  }

  function closeTransientUi(event) {
    const popover = document.querySelector('[data-pf-popover]');
    if (!popover || popover.contains(event.target) || event.target.closest('[data-pf-action="type-menu"],[data-pf-action="source-menu"]')) return;
    closePopover();
  }

  function closePopover() {
    document.querySelectorAll('[data-pf-popover]').forEach(element => element.remove());
    document.querySelectorAll('[aria-expanded="true"]').forEach(element => {
      if (element.matches('[data-pf-action="type-menu"]')) element.setAttribute('aria-expanded', 'false');
    });
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbGet(key) {
    const database = await openDb();
    return new Promise((resolve, reject) => {
      const request = database.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbSet(key, value) {
    const database = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      transaction.objectStore(DB_STORE).put(value, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async function restoreFolder() {
    if (!('showDirectoryPicker' in window) || !window.indexedDB) return;
    try {
      state.folderHandle = await dbGet(FOLDER_KEY);
      if (state.folderHandle && await state.folderHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') state.folderHandle = null;
    } catch (error) { recordError('folder-restore', error); }
  }

  async function chooseFolder() {
    if (!('showDirectoryPicker' in window)) return toast('Folder sync needs installed Pacefold in Microsoft Edge.');
    try {
      const handle = await showDirectoryPicker({ id: 'pacefold-capture-folder', mode: 'readwrite' });
      if (await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Folder permission was not granted');
      state.folderHandle = handle;
      await dbSet(FOLDER_KEY, handle);
      if (state.drawer === 'inbox') renderDrawer();
      toast('Folder connected. New captures can file silently.');
    } catch (error) {
      if (error?.name !== 'AbortError') { recordError('folder-connect', error); toast('Folder was not connected. Local capture remains active.'); }
    }
  }

  async function appendFolder(item) {
    if (!state.folderHandle) return false;
    try {
      let permission = await state.folderHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') permission = await state.folderHandle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') return false;
      const date = item.createdAt.slice(0, 10);
      const directory = await state.folderHandle.getDirectoryHandle('Pacefold Inbox', { create: true });
      const handle = await directory.getFileHandle(`${date}.md`, { create: true });
      const file = await handle.getFile();
      const existing = await file.text();
      const type = TYPES[item.type] || TYPES.note;
      const header = existing ? '' : `# Pacefold Inbox — ${date}\n\n`;
      const line = `- **${type.label} · ${formatTime(item.createdAt)}** — ${item.text.replace(/\s+/g, ' ').trim()}\n`;
      const writer = await handle.createWritable();
      await writer.write(`${existing}${header}${line}`);
      await writer.close();
      return true;
    } catch (error) {
      recordError('folder-write', error);
      return false;
    }
  }

  function openExternal(url, label) {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) toast(`Allow pop-ups to open ${label}.`);
  }

  mount();
})();
