(() => {
  'use strict';

  const SETTINGS_KEY = 'pacefoldMusicBridgeSettings';
  const DEFAULTS = {adShield: true, sponsorBlock: true, permanentRepeat: false};
  let settings = {...DEFAULTS};
  let sponsorVideoId = '';
  let sponsorSegments = [];
  let adMutedByBridge = false;
  let previousMuted = false;
  let lastStateKey = '';
  let lastHeartbeat = 0;

  const video = () => document.querySelector('video');
  const player = () => document.querySelector('#movie_player,.html5-video-player');
  const text = selectors => {
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.textContent?.trim();
      if (value) return value;
    }
    return '';
  };
  const click = selectors => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node instanceof HTMLElement) { node.click(); return true; }
    }
    return false;
  };
  const videoId = () => new URL(location.href).searchParams.get('v') || '';
  const artwork = id => id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';

  async function readSettings() {
    try {
      const stored = await chrome.storage.local.get(SETTINGS_KEY);
      settings = {...DEFAULTS, ...(stored?.[SETTINGS_KEY] || {})};
    } catch {}
  }

  async function writeSettings(patch) {
    settings = {...settings, ...patch};
    try { await chrome.storage.local.set({[SETTINGS_KEY]: settings}); } catch {}
  }

  function adIsShowing() {
    const root = player();
    if (root?.classList.contains('ad-showing') || root?.classList.contains('ad-interrupting')) return true;
    return Boolean(document.querySelector('.ytp-ad-skip-button,.ytp-ad-skip-button-modern,button.ytp-skip-ad-button'));
  }

  function handleAds() {
    const media = video();
    if (!media) return false;
    const showing = settings.adShield && adIsShowing();
    if (showing) {
      click([
        '.ytp-ad-skip-button-modern',
        '.ytp-ad-skip-button',
        'button.ytp-skip-ad-button',
        '.ytp-ad-skip-button-container button'
      ]);
      if (!adMutedByBridge) {
        previousMuted = media.muted;
        adMutedByBridge = true;
      }
      media.muted = true;
      const duration = Number(media.duration);
      const current = Number(media.currentTime);
      if (Number.isFinite(duration) && duration > 0.5 && Number.isFinite(current) && current < duration - 0.15) {
        try { media.currentTime = Math.max(current, duration - 0.05); } catch {}
      }
      return true;
    }
    if (adMutedByBridge) {
      media.muted = previousMuted;
      adMutedByBridge = false;
    }
    return false;
  }

  async function refreshSponsorSegments() {
    const id = videoId();
    if (!settings.sponsorBlock || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
      sponsorVideoId = id;
      sponsorSegments = [];
      return;
    }
    if (id === sponsorVideoId) return;
    sponsorVideoId = id;
    sponsorSegments = [];
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'sponsor:lookup',
        payload: {videoId: id, categories: ['music_offtopic', 'sponsor', 'selfpromo']}
      });
      sponsorSegments = Array.isArray(response?.segments) ? response.segments : [];
    } catch {}
  }

  function handleSponsorSegments() {
    if (!settings.sponsorBlock || !sponsorSegments.length || adIsShowing()) return;
    const media = video();
    const current = Number(media?.currentTime);
    if (!media || !Number.isFinite(current)) return;
    const row = sponsorSegments.find(item => current >= item.segment[0] - 0.04 && current < item.segment[1] - 0.08);
    if (!row) return;
    try { media.currentTime = row.segment[1] + 0.03; } catch {}
  }

  function titleAndAuthor() {
    const title = text([
      'ytmusic-player-bar .title.ytmusic-player-bar',
      'ytmusic-player-bar .title',
      '#player-bar-background .title'
    ]) || document.title.replace(/\s*-\s*YouTube Music\s*$/i, '').trim();
    const author = text([
      'ytmusic-player-bar .byline.ytmusic-player-bar',
      'ytmusic-player-bar .byline',
      'ytmusic-player-bar .subtitle'
    ]);
    return {title, author};
  }

  function state() {
    const media = video();
    const id = videoId();
    const copy = titleAndAuthor();
    return {
      connected: true,
      engine: 'morphe-edge',
      videoId: id,
      title: copy.title || 'YouTube Music',
      author: copy.author || 'YouTube Music',
      artwork: artwork(id),
      playing: Boolean(media && !media.paused && !media.ended),
      currentTime: Number(media?.currentTime) || 0,
      duration: Number(media?.duration) || 0,
      volume: Number(media?.volume) || 0,
      muted: Boolean(media?.muted),
      ad: adIsShowing(),
      adShield: Boolean(settings.adShield),
      sponsorBlock: Boolean(settings.sponsorBlock),
      permanentRepeat: Boolean(settings.permanentRepeat),
      url: location.href
    };
  }

  function emitState(force = false) {
    const payload = state();
    const now = Date.now();
    const key = JSON.stringify([
      payload.videoId, payload.title, payload.author, payload.playing,
      Math.floor(payload.currentTime * 2), Math.floor(payload.duration),
      Math.round(payload.volume * 100), payload.muted, payload.ad,
      payload.adShield, payload.sponsorBlock, payload.permanentRepeat
    ]);
    if (!force && key === lastStateKey && now - lastHeartbeat < 3000) return;
    lastStateKey = key;
    lastHeartbeat = now;
    chrome.runtime.sendMessage({type: 'engine:state', payload}).catch(() => null);
  }

  async function command(name, value) {
    const media = video();
    if (name === 'settings') { await writeSettings(value || {}); emitState(true); return {ok: true}; }
    if (name === 'play') { await media?.play?.(); return {ok: true}; }
    if (name === 'pause') { media?.pause?.(); return {ok: true}; }
    if (name === 'toggle') {
      if (!media) return {ok: false};
      if (media.paused) await media.play(); else media.pause();
      return {ok: true};
    }
    if (name === 'previous') return {ok: click(['ytmusic-player-bar #previous-button','ytmusic-player-bar .previous-button','button[aria-label*="Previous"]'])};
    if (name === 'next') return {ok: click(['ytmusic-player-bar #next-button','ytmusic-player-bar .next-button','button[aria-label*="Next"]'])};
    if (name === 'seek' && media) { media.currentTime = Math.max(0, Math.min(Number(value) || 0, Number(media.duration) || Infinity)); return {ok: true}; }
    if (name === 'volume' && media) { media.volume = Math.max(0, Math.min(1, Number(value) || 0)); media.muted = false; return {ok: true}; }
    if (name === 'adShield') { await writeSettings({adShield: Boolean(value)}); return {ok: true}; }
    if (name === 'sponsorBlock') { await writeSettings({sponsorBlock: Boolean(value)}); sponsorVideoId = ''; await refreshSponsorSegments(); return {ok: true}; }
    if (name === 'permanentRepeat') { await writeSettings({permanentRepeat: Boolean(value)}); if (media) media.loop = Boolean(value); return {ok: true}; }
    return {ok: false};
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'bridge:ping') { sendResponse({ready: true}); return; }
    if (message?.type !== 'bridge:command') return;
    Promise.resolve(command(message.command, message.value))
      .then(sendResponse)
      .catch(error => sendResponse({ok: false, error: error?.message || 'Command failed'}));
    return true;
  });

  const style = document.createElement('style');
  style.textContent = `
    ytmusic-mealbar-promo-renderer,
    ytmusic-statement-banner-renderer,
    ytmusic-promo-button-renderer,
    #masthead-ad,
    ytd-display-ad-renderer,
    ytd-promoted-sparkles-web-renderer,
    .ytp-ad-overlay-container { display:none!important; visibility:hidden!important; }
  `;
  const mountStyle = () => { if (document.documentElement && !style.isConnected) document.documentElement.append(style); };
  mountStyle();
  if (!style.isConnected) document.addEventListener('readystatechange', mountStyle, {once: true});

  readSettings().finally(() => {
    chrome.runtime.sendMessage({type: 'engine:ready', payload: {}}).catch(() => null);
    setInterval(() => {
      const media = video();
      if (media && settings.permanentRepeat !== media.loop) media.loop = Boolean(settings.permanentRepeat);
      handleAds();
      void refreshSponsorSegments();
      handleSponsorSegments();
      emitState();
    }, 250);
    addEventListener('popstate', () => { sponsorVideoId = ''; emitState(true); });
    document.addEventListener('yt-navigate-finish', () => { sponsorVideoId = ''; emitState(true); });
  });
})();
