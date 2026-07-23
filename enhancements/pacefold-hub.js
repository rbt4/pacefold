(() => {
'use strict';
const VERSION = '15.5.0';
const ROOT_ID = 'pf-hub-root';
const KEYS = {
folds: 'pacefold.hub.captures.v1',
prefs: 'pacefold.origami.preferences.v1',
badge: 'pacefold.hub.badge.v1',
weather: 'pacefold.surface.weather.v1',
errors: 'pacefold.surface.errors.v1'
};
const WEATHER_TTL = 20 * 60 * 1000;
const PROVIDERS = Object.freeze({
local: { label: 'Local', icon: 'music' },
youtube: { label: 'YouTube', icon: 'youtube' },
spotify: { label: 'Spotify', icon: 'spotify' },
amazon: { label: 'Amazon Music', icon: 'amazon' }
});
if (document.getElementById(ROOT_ID)) return;
const state = {
folds: readJson(KEYS.folds, []).map(normalizeFold).filter(Boolean).slice(0, 250),
prefs: {
provider: 'local',
youtube: '',
spotify: '',
amazon: 'https://music.amazon.ca/',
volume: 0.62,
...readJson(KEYS.prefs, {})
},
drawer: null,
currentCue: null,
weather: readCache(KEYS.weather, WEATHER_TTL),
weatherRequest: null,
audioUrl: '',
errors: readJson(KEYS.errors, []).slice(0, 20),
toastTimer: 0,
cueFrame: 0,
observer: null
};
const nativeBadge = {
set: typeof navigator.setAppBadge === 'function' ? navigator.setAppBadge.bind(navigator) : null,
clear: typeof navigator.clearAppBadge === 'function' ? navigator.clearAppBadge.bind(navigator) : null
};
function readJson(key, fallback) {
try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
catch { return fallback; }
}
function writeJson(key, value) {
try { localStorage.setItem(key, JSON.stringify(value)); return true; }
catch (error) { recordError('storage', error); return false; }
}
function readCache(key, ttl) {
const cache = readJson(key, null);
return cache && Date.now() - Number(cache.savedAt || 0) < ttl ? cache.data : null;
}
function writeCache(key, value) {
writeJson(key, { savedAt: Date.now(), data: value });
}
function normalizeFold(item) {
if (!item || typeof item.text !== 'string') return null;
return {
id: String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
text: item.text.slice(0, 900),
createdAt: item.createdAt || new Date().toISOString(),
done: Boolean(item.done)
};
}
function esc(value) {
return String(value ?? '')
.replaceAll('&', '&amp;')
.replaceAll('<', '&lt;')
.replaceAll('>', '&gt;')
.replaceAll('"', '&quot;')
.replaceAll("'", '&#039;');
}
function visible(element) {
if (!element?.isConnected) return false;
const style = getComputedStyle(element);
const box = element.getBoundingClientRect();
return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && box.width > 0 && box.height > 0;
}
function icon(name, extra = '') {
const paths = {
fold: '<path d="m4 7 8-4 8 5-3 12-6 2-7-7Z"/><path d="m4 7 7 5 9-4M11 12v10m0-10-7 3m7-3 6 8"/>',
check: '<path d="m5 12 4 4L19 6"/>',
close: '<path d="m6 6 12 12M18 6 6 18"/>',
play: '<path d="m8 5 11 7-11 7Z"/>',
pause: '<path d="M9 5v14M15 5v14"/>',
music: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
youtube: '<path d="M21 8.3a3 3 0 0 0-2.1-2.1C17 5.7 12 5.7 12 5.7s-5 0-6.9.5A3 3 0 0 0 3 8.3 31 31 0 0 0 2.5 12 31 31 0 0 0 3 15.7a3 3 0 0 0 2.1 2.1c1.9.5 6.9.5 6.9.5s5 0 6.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-3.7 31 31 0 0 0-.5-3.7Z"/><path d="m10 15 5-3-5-3Z"/>',
spotify: '<circle cx="12" cy="12" r="9"/><path d="M7 9c3.8-1.1 7.5-.7 10.5.9M7.8 12.3c3.2-.8 6.3-.4 8.8.8M8.6 15.3c2.5-.5 4.9-.2 6.8.7"/>',
amazon: '<path d="M7 16c4 3 9 3 13 0M18 15l2 1-1 2"/><path d="M9 14V8c0-2 1-3 3-3s3 1 3 3v6M9 10h6"/>',
folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
volume: '<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
mute: '<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="m17 9 5 5M22 9l-5 5"/>',
weather: '<path d="M17.5 19H6a4 4 0 0 1-.5-8A6 6 0 0 1 17 9a5 5 0 0 1 .5 10Z"/>',
stack: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
shield: '<path d="M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6Z"/><path d="m8 12 3 3 5-6"/>',
refresh: '<path d="M20 6v5h-5"/><path d="M19 11a8 8 0 1 0 1 5"/>',
trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
chevron: '<path d="m8 10 4 4 4-4"/>',
send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
warning: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.6 17.3A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.7L13.7 3.9a2 2 0 0 0-3.4 0Z"/>'
};
return `<svg class="pf-icon ${extra}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.fold}</svg>`;
}
function recordError(scope, error) {
state.errors.unshift({ scope, message: String(error?.message || error || 'Unknown error').slice(0, 360), at: new Date().toISOString() });
state.errors = state.errors.slice(0, 20);
try { localStorage.setItem(KEYS.errors, JSON.stringify(state.errors)); } catch {}
updateHealth();
}
function safe(fn, scope = 'action') {
return async (...args) => {
try { return await fn(...args); }
catch (error) { recordError(scope, error); toast('That did not work. Pacefold kept your local data intact.'); }
};
}
function toast(message) {
document.querySelector('.pf-toast')?.remove();
const root = document.getElementById(ROOT_ID);
if (!root) return;
const node = document.createElement('div');
node.className = 'pf-toast';
node.role = 'status';
node.textContent = message;
root.append(node);
clearTimeout(state.toastTimer);
state.toastTimer = setTimeout(() => node.remove(), 3200);
}
function mount() {
if (!document.body) return document.addEventListener('DOMContentLoaded', mount, { once: true });
const root = document.createElement('aside');
root.id = ROOT_ID;
root.className = 'pf-origami';
root.dataset.version = VERSION;
root.innerHTML = `
<section class="pf-sheet" data-pf-sheet hidden aria-live="polite">
<header class="pf-sheet-head">
<div class="pf-sheet-brand"><img src="./icons/fold-mark.svg" alt=""><span><small data-pf-sheet-kicker>Pacefold</small><strong data-pf-sheet-title>Player</strong></span></div>
<button class="pf-icon-button" data-pf-action="close-sheet" aria-label="Close">${icon('close')}</button>
</header>
<div class="pf-sheet-body" data-pf-sheet-body></div>
</section>
<div class="pf-strip">
<div class="pf-primary-row">
<button class="pf-brand-button" data-pf-action="open-player" aria-label="Open Pacefold Player">
<img src="./icons/fold-mark.svg" alt=""><span><strong>Pacefold</strong><small>one day, gently folded</small></span>
</button>
<button class="pf-andon" data-pf-action="handle-cue"><span class="pf-andon-glyph">${icon('fold')}</span><span><strong data-pf-cue-label>All clear</strong><small data-pf-cue-detail>Quietly keeping pace</small></span></button>
<form class="pf-fold-form" data-pf-fold-form>
<label class="pf-visually-hidden" for="pf-fold-input">Quick Fold</label>
<input id="pf-fold-input" data-pf-fold-input maxlength="900" autocomplete="off" placeholder="Fold this thought into Pacefold…">
<button type="submit" aria-label="Save Fold">${icon('send')}</button>
</form>
<button class="pf-glance" data-pf-action="open-weather" aria-label="Weather"><span data-pf-weather-icon>${icon('weather')}</span><span><strong data-pf-weather-temp>—</strong><small data-pf-weather-label>Toronto</small></span></button>
<button class="pf-glance" data-pf-action="open-folds" aria-label="Saved Folds">${icon('stack')}<span><strong data-pf-fold-count>${state.folds.length}</strong><small>Folds</small></span></button>
</div>
<div class="pf-player-row">
<button class="pf-play" data-pf-action="play" aria-label="Play or pause">${icon('play')}</button>
<button class="pf-now-playing" data-pf-action="open-player"><span class="pf-provider-icon" data-pf-provider-icon>${icon(PROVIDERS[state.prefs.provider]?.icon || 'music')}</span><span><strong data-pf-track-title>Pacefold Player</strong><small data-pf-track-meta>Choose local, YouTube, Spotify, or Amazon Music</small></span></button>
<input class="pf-progress" data-pf-progress type="range" min="0" max="1000" value="0" disabled aria-label="Track position">
<button class="pf-player-tool" data-pf-action="open-player">${icon('chevron')}<span>Expand</span></button>
<button class="pf-icon-button" data-pf-action="volume" aria-label="Volume">${icon('volume')}</button>
<button class="pf-icon-button pf-health" data-pf-action="open-system" aria-label="System health" hidden>${icon('shield')}</button>
<input class="pf-visually-hidden" data-pf-audio-input type="file" accept="audio/*">
<audio data-pf-audio preload="metadata"></audio>
</div>
</div>`;
document.body.append(root);
document.documentElement.classList.add('pf-hub-mounted');
bind(root);
installBadgeBridge();
installObserver(root);
detectCue();
renderFoldCount();
renderProviderState();
renderWeatherPill();
updatePlayer();
updateHealth();
if (!state.weather) setTimeout(() => refreshWeather(true), 850);
window.__PACEFOLD_SURFACE__ = { version: VERSION, openPlayer: () => openSheet('player') };
}
function bind(root) {
root.addEventListener('click', safe(handleClick, 'click'));
root.querySelector('[data-pf-fold-form]').addEventListener('submit', safe(saveFold, 'fold'));
root.querySelector('[data-pf-audio-input]').addEventListener('change', chooseAudio);
root.querySelector('[data-pf-progress]').addEventListener('input', seekAudio);
const player = audio();
player.volume = clamp(Number(state.prefs.volume), 0, 1, .62);
['play', 'pause', 'timeupdate', 'loadedmetadata', 'ended', 'error'].forEach(event => player.addEventListener(event, updatePlayer));
document.addEventListener('keydown', handleKeyboard);
window.addEventListener('focus', acknowledgeTaskbar);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && acknowledgeTaskbar());
window.addEventListener('error', event => /pacefold-hub|pf-origami/i.test(String(event.filename || event.message)) && recordError('runtime', event.error || event.message));
window.addEventListener('unhandledrejection', event => /pacefold-hub|pf-origami/i.test(String(event.reason?.stack || event.reason || '')) && recordError('promise', event.reason));
}
function clamp(value, min, max, fallback) {
return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
async function handleClick(event) {
const button = event.target.closest('[data-pf-action]');
if (!button) return;
const action = button.dataset.pfAction;
if (action === 'open-player') openSheet('player');
else if (action === 'open-folds') openSheet('folds');
else if (action === 'open-weather') openSheet('weather');
else if (action === 'open-system') openSheet('system');
else if (action === 'close-sheet') closeSheet();
else if (action === 'handle-cue') handleCue();
else if (action === 'provider') selectProvider(button.dataset.provider);
else if (action === 'load-stream') loadStream(button.dataset.provider);
else if (action === 'choose-local') document.querySelector('[data-pf-audio-input]').click();
else if (action === 'play') togglePlay();
else if (action === 'volume') cycleVolume();
else if (action === 'toggle-fold') toggleFold(button.dataset.id);
else if (action === 'delete-fold') deleteFold(button.dataset.id);
else if (action === 'clear-folds') clearFolds();
else if (action === 'refresh-weather') refreshWeather(false);
else if (action === 'clear-errors') clearErrors();
}
function handleKeyboard(event) {
if (event.key === 'Escape') closeSheet();
if (event.ctrlKey && event.shiftKey && event.code === 'Space') {
event.preventDefault();
document.querySelector('[data-pf-fold-input]')?.focus();
}
if (event.altKey && event.code === 'KeyP') {
event.preventDefault();
togglePlay();
}
}
function openSheet(kind) {
state.drawer = kind;
renderSheet();
}
function closeSheet() {
state.drawer = null;
renderSheet();
}
function renderSheet() {
const sheet = document.querySelector('[data-pf-sheet]');
const title = document.querySelector('[data-pf-sheet-title]');
const kicker = document.querySelector('[data-pf-sheet-kicker]');
const body = document.querySelector('[data-pf-sheet-body]');
if (!sheet || !body) return;
sheet.hidden = !state.drawer;
sheet.classList.toggle('is-open', Boolean(state.drawer));
if (!state.drawer) return;
if (state.drawer === 'player') {
kicker.textContent = 'Pacefold · embedded, not launched';
title.textContent = 'Player';
body.innerHTML = playerMarkup();
setTimeout(renderEmbeddedPlayer, 0);
} else if (state.drawer === 'folds') {
kicker.textContent = 'Pacefold · quick memory';
title.textContent = 'Fold Stack';
body.innerHTML = foldsMarkup();
} else if (state.drawer === 'weather') {
kicker.textContent = 'Pacefold · context only';
title.textContent = 'Weather';
body.innerHTML = weatherMarkup();
} else {
kicker.textContent = 'Pacefold · local diagnostics';
title.textContent = 'System Health';
body.innerHTML = systemMarkup();
}
}
function playerMarkup() {
const provider = PROVIDERS[state.prefs.provider] ? state.prefs.provider : 'local';
return `
<div class="pf-provider-tabs" role="tablist">
${Object.entries(PROVIDERS).map(([key, value]) => `<button class="${provider === key ? 'is-active' : ''}" data-pf-action="provider" data-provider="${key}" role="tab" aria-selected="${provider === key}">${icon(value.icon)}<span>${value.label}</span></button>`).join('')}
</div>
<div class="pf-player-stage" data-pf-player-stage>${playerProviderMarkup(provider)}</div>
<div class="pf-player-security">${icon('lock')}<span>Only official provider domains are allowed. Pacefold never stores passwords, cookies, access tokens, or account credentials.</span></div>`;
}
function playerProviderMarkup(provider) {
if (provider === 'local') return `
<div class="pf-local-player">
<div class="pf-fold-art">${icon('fold')}</div>
<div><h3>Local audio</h3><p>Play a file without uploading it anywhere.</p><button class="pf-primary-button" data-pf-action="choose-local">${icon('folder')} Choose audio file</button></div>
</div>`;
const value = esc(state.prefs[provider] || '');
const placeholder = provider === 'youtube' ? 'Paste a YouTube video or playlist URL' : provider === 'spotify' ? 'Paste a Spotify track, album, playlist, or show URL' : 'Amazon Music stays inside this Pacefold frame';
return `
<form class="pf-stream-form" data-pf-stream-form onsubmit="return false">
<label for="pf-stream-url">${PROVIDERS[provider].label}</label>
<div><input id="pf-stream-url" data-pf-stream-url value="${value}" placeholder="${esc(placeholder)}" ${provider === 'amazon' ? 'readonly' : ''}><button data-pf-action="load-stream" data-provider="${provider}" type="button">Load inside Pacefold</button></div>
<small>${provider === 'amazon' ? 'Amazon does not offer a generally available embed. Pacefold uses a contained compatibility frame and never redirects you.' : 'Pacefold validates the URL and converts it to the provider’s official embedded player.'}</small>
</form>
<div class="pf-embed-shell" data-pf-embed-shell><div class="pf-embed-empty">${icon(PROVIDERS[provider].icon)}<strong>Nothing loaded yet</strong><span>${esc(placeholder)}</span></div></div>`;
}
function selectProvider(provider) {
if (!PROVIDERS[provider]) return;
state.prefs.provider = provider;
savePrefs();
renderSheet();
renderProviderState();
}
function loadStream(provider) {
const input = document.querySelector('[data-pf-stream-url]');
if (!input || provider === 'amazon') {
state.prefs.amazon = 'https://music.amazon.ca/';
savePrefs();
return renderEmbeddedPlayer();
}
const raw = input.value.trim();
const parsed = provider === 'youtube' ? parseYouTube(raw) : parseSpotify(raw);
if (!parsed) {
input.setAttribute('aria-invalid', 'true');
return toast(`That is not a valid ${PROVIDERS[provider].label} URL.`);
}
input.removeAttribute('aria-invalid');
state.prefs[provider] = raw;
savePrefs();
renderEmbeddedPlayer();
}
function renderEmbeddedPlayer() {
const host = document.querySelector('[data-pf-embed-shell]');
if (!host) return;
const provider = state.prefs.provider;
let src = '';
if (provider === 'youtube') src = parseYouTube(state.prefs.youtube)?.embed || '';
if (provider === 'spotify') src = parseSpotify(state.prefs.spotify)?.embed || '';
if (provider === 'amazon') src = 'https://music.amazon.ca/';
if (!src) return;
const frame = document.createElement('iframe');
frame.className = `pf-embed pf-embed--${provider}`;
frame.title = `${PROVIDERS[provider].label} inside Pacefold`;
frame.src = src;
frame.loading = 'eager';
frame.referrerPolicy = 'no-referrer';
frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
frame.sandbox = provider === 'amazon'
? 'allow-scripts allow-same-origin allow-forms allow-presentation'
: 'allow-scripts allow-same-origin allow-forms allow-presentation';
host.replaceChildren(frame);
host.classList.add('is-loaded');
frame.addEventListener('load', () => {
document.querySelector('[data-pf-track-title]').textContent = PROVIDERS[provider].label;
document.querySelector('[data-pf-track-meta]').textContent = provider === 'amazon' ? 'Contained compatibility frame' : 'Playing inside Pacefold';
renderProviderState();
}, { once: true });
setTimeout(() => {
if (!frame.isConnected) return;
host.classList.add('is-settled');
}, 8000);
}
function parseYouTube(value) {
try {
const url = new URL(value);
const allowed = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com']);
if (!allowed.has(url.hostname.toLowerCase())) return null;
const list = url.searchParams.get('list');
let id = url.hostname === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v');
if (!id && /\/shorts\//.test(url.pathname)) id = url.pathname.split('/shorts/')[1]?.split('/')[0];
if (list && /^[A-Za-z0-9_-]{10,}$/.test(list)) return { embed: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}&playsinline=1&rel=0` };
if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) return { embed: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0` };
return null;
} catch { return null; }
}
function parseSpotify(value) {
try {
const url = new URL(value);
if (!['open.spotify.com', 'spotify.com'].includes(url.hostname.toLowerCase())) return null;
const parts = url.pathname.split('/').filter(Boolean);
const typeIndex = parts.findIndex(part => ['track', 'album', 'playlist', 'show', 'episode', 'artist'].includes(part));
const type = parts[typeIndex];
const id = parts[typeIndex + 1];
if (!type || !id || !/^[A-Za-z0-9]{10,40}$/.test(id)) return null;
return { embed: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0` };
} catch { return null; }
}
function renderProviderState() {
const provider = PROVIDERS[state.prefs.provider] || PROVIDERS.local;
const holder = document.querySelector('[data-pf-provider-icon]');
if (holder) holder.innerHTML = icon(provider.icon);
}
function savePrefs() {
writeJson(KEYS.prefs, state.prefs);
}
async function saveFold(event) {
event.preventDefault();
const input = document.querySelector('[data-pf-fold-input]');
const text = input.value.trim();
if (!text) return input.focus();
state.folds.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, createdAt: new Date().toISOString(), done: false });
state.folds = state.folds.slice(0, 250);
writeJson(KEYS.folds, state.folds);
input.value = '';
renderFoldCount();
toast('Fold saved locally.');
if (state.drawer === 'folds') renderSheet();
}
function foldsMarkup() {
return `
<div class="pf-fold-summary"><img src="./icons/fold-mark.svg" alt=""><div><strong>${state.folds.length} folds</strong><span>Not a notebook. Just a lightweight stack of things you did not want to lose.</span></div></div>
<div class="pf-fold-list">
${state.folds.length ? state.folds.map(item => `<article class="${item.done ? 'is-done' : ''}"><button data-pf-action="toggle-fold" data-id="${esc(item.id)}" aria-label="Mark Fold done">${icon(item.done ? 'check' : 'fold')}</button><div><p>${esc(item.text)}</p><small>${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(item.createdAt))}</small></div><button data-pf-action="delete-fold" data-id="${esc(item.id)}" aria-label="Delete Fold">${icon('close')}</button></article>`).join('') : '<div class="pf-empty"><strong>Your stack is clear.</strong><span>Use the always-open field below to make a Fold.</span></div>'}
</div>
${state.folds.length ? `<div class="pf-sheet-actions"><button class="pf-danger-button" data-pf-action="clear-folds">${icon('trash')} Clear all Folds</button></div>` : ''}`;
}
function toggleFold(id) {
const item = state.folds.find(fold => fold.id === id);
if (!item) return;
item.done = !item.done;
writeJson(KEYS.folds, state.folds);
renderSheet();
}
function deleteFold(id) {
state.folds = state.folds.filter(item => item.id !== id);
writeJson(KEYS.folds, state.folds);
renderFoldCount();
renderSheet();
}
function clearFolds() {
if (!confirm('Clear every local Fold? This cannot be undone.')) return;
state.folds = [];
writeJson(KEYS.folds, []);
renderFoldCount();
renderSheet();
}
function renderFoldCount() {
const node = document.querySelector('[data-pf-fold-count]');
if (node) node.textContent = String(state.folds.length);
}
function audio() { return document.querySelector('[data-pf-audio]'); }
function chooseAudio(event) {
const file = event.target.files?.[0];
if (!file || !file.type.startsWith('audio/')) return;
if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
state.audioUrl = URL.createObjectURL(file);
state.prefs.provider = 'local';
savePrefs();
const player = audio();
player.src = state.audioUrl;
player.dataset.title = file.name.replace(/\.[^.]+$/, '');
player.dataset.meta = `${Math.round(file.size / 104857.6) / 10} MB · stays on this device`;
player.play().catch(() => toast('File loaded. Press play when ready.'));
updatePlayer();
renderProviderState();
}
async function togglePlay() {
const player = audio();
if (state.prefs.provider !== 'local') return openSheet('player');
if (!player.src) return document.querySelector('[data-pf-audio-input]').click();
if (player.paused) await player.play(); else player.pause();
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
const progress = document.querySelector('[data-pf-progress]');
if (!player || !play || !title || !meta || !progress) return;
play.innerHTML = icon(player.paused ? 'play' : 'pause');
if (state.prefs.provider !== 'local') {
progress.disabled = true;
title.textContent = PROVIDERS[state.prefs.provider]?.label || 'Pacefold Player';
meta.textContent = 'Embedded inside Pacefold';
return;
}
title.textContent = player.dataset.title || 'Pacefold Player';
meta.textContent = player.dataset.meta || 'Choose local, YouTube, Spotify, or Amazon Music';
if (Number.isFinite(player.duration) && player.duration > 0) {
progress.disabled = false;
progress.value = String(Math.round(player.currentTime / player.duration * 1000));
} else {
progress.disabled = true;
progress.value = '0';
}
}
function cycleVolume() {
const player = audio();
const steps = [0, .35, .62, 1];
const next = steps.find(value => value > player.volume + .01) ?? 0;
player.volume = next;
state.prefs.volume = next;
savePrefs();
document.querySelector('[data-pf-action="volume"]').innerHTML = icon(next === 0 ? 'mute' : 'volume');
toast(next === 0 ? 'Muted.' : `Volume ${Math.round(next * 100)}%.`);
}
async function refreshWeather(quiet = false) {
if (state.weatherRequest) return state.weatherRequest;
state.weatherRequest = (async () => {
try {
const url = 'https://api.open-meteo.com/v1/forecast?latitude=43.6532&longitude=-79.3832&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3';
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 8000);
const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
clearTimeout(timer);
if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
state.weather = await response.json();
writeCache(KEYS.weather, state.weather);
renderWeatherPill();
if (state.drawer === 'weather') renderSheet();
if (!quiet) toast('Weather refreshed.');
} catch (error) {
recordError('weather', error);
if (!quiet) toast('Weather refresh failed. Cached information remains available.');
} finally { state.weatherRequest = null; }
})();
return state.weatherRequest;
}
function renderWeatherPill() {
const temp = document.querySelector('[data-pf-weather-temp]');
if (temp) temp.textContent = state.weather?.current ? `${Math.round(state.weather.current.temperature_2m)}°` : '—';
}
function weatherMarkup() {
const current = state.weather?.current;
const daily = state.weather?.daily;
return current ? `
<div class="pf-weather-hero">${icon('weather')}<div><strong>${Math.round(current.temperature_2m)}°</strong><span>Feels ${Math.round(current.apparent_temperature)}° · ${Math.round(current.wind_speed_10m)} km/h</span></div></div>
<div class="pf-weather-days">${(daily?.time || []).slice(0,3).map((date,index)=>`<article><strong>${new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(new Date(`${date}T12:00:00`))}</strong><span>${Math.round(daily.temperature_2m_max[index])}° / ${Math.round(daily.temperature_2m_min[index])}°</span><small>${Math.round(daily.precipitation_probability_max[index] || 0)}% precipitation</small></article>`).join('')}</div>
<div class="pf-sheet-actions"><button data-pf-action="refresh-weather">${icon('refresh')} Refresh</button></div>` : `<div class="pf-empty"><strong>Weather is unavailable.</strong><span>Pacefold remains fully usable offline.</span><button data-pf-action="refresh-weather">${icon('refresh')} Try again</button></div>`;
}
function systemMarkup() {
const checks = [
['Secure context', window.isSecureContext, window.isSecureContext ? 'Active' : 'Required'],
['Local-only Folds', true, 'No OneNote, Graph, or folder permission'],
['Service worker', Boolean(navigator.serviceWorker?.controller), navigator.serviceWorker?.controller ? 'Controlling' : 'Activates after reload'],
['Notifications', typeof Notification === 'undefined' || Notification.permission !== 'denied', typeof Notification === 'undefined' ? 'Unavailable' : Notification.permission],
['Embedded providers', true, 'Strict official-domain allowlist']
];
return `<div class="pf-health-grid">${checks.map(([label,good,detail])=>`<article class="${good?'is-good':'is-warning'}"><span></span><div><strong>${esc(label)}</strong><small>${esc(detail)}</small></div></article>`).join('')}</div>
<div class="pf-error-list"><h3>Recent surface errors</h3>${state.errors.length ? state.errors.map(error=>`<p><strong>${esc(error.scope)}</strong><span>${esc(error.message)}</span></p>`).join('') : '<div class="pf-empty"><strong>No recorded errors.</strong><span>Pacefold’s surface is running cleanly.</span></div>'}</div>
${state.errors.length ? `<div class="pf-sheet-actions"><button data-pf-action="clear-errors">${icon('trash')} Clear error journal</button></div>` : ''}`;
}
function clearErrors() {
state.errors = [];
writeJson(KEYS.errors, []);
updateHealth();
renderSheet();
}
function updateHealth() {
const button = document.querySelector('[data-pf-action="open-system"]');
if (!button) return;
button.hidden = state.errors.length === 0 && window.isSecureContext;
button.classList.toggle('is-warning', !button.hidden);
}
function installObserver(root) {
state.observer = new MutationObserver(mutations => {
if (mutations.every(mutation => root.contains(mutation.target))) return;
scheduleCueScan();
});
state.observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-hidden'] });
}
function scheduleCueScan() {
if (state.cueFrame) return;
state.cueFrame = requestAnimationFrame(() => { state.cueFrame = 0; detectCue(); });
}
function detectCue() {
const root = document.getElementById(ROOT_ID);
const candidates = [...document.querySelectorAll('[data-active-cue],[role="alert"],.notification,.cue,[role="dialog"]')]
.filter(element => !root?.contains(element) && visible(element))
.map((element,index)=>({ element,index,text:(element.textContent||'').trim() }))
.filter(item => /(clear|done|log|drink|water|move|break|prayer|meal|lunch|eyes|look|prepare|noodle|away)/i.test(item.text))
.sort((a,b)=>scoreCue(b)-scoreCue(a));
state.currentCue = candidates[0]?.element || null;
renderCue();
}
function scoreCue(item) {
return (item.element.hasAttribute('data-active-cue') ? 10000 : 0) + (item.element.getAttribute('role') === 'alert' ? 3000 : 0) + (item.element.matches('.notification,.cue') ? 1500 : 0) + item.index;
}
function cueMeta() {
const text = (state.currentCue?.textContent || '').toLowerCase();
if (/prayer/.test(text)) return ['Prayer', 'quiet moment ready'];
if (/drink|water|sip/.test(text)) return ['Hydrate', 'one small reset'];
if (/eyes|look/.test(text)) return ['Look far', '20 seconds'];
if (/move|stretch|posture/.test(text)) return ['Move', 'reset your position'];
if (/meal|lunch/.test(text)) return ['Meal', 'your pause is ready'];
if (/prepare|noodle/.test(text)) return ['Prepare', 'start the next step'];
if (/away|break/.test(text)) return ['Step away', 'a real pause'];
return state.currentCue ? ['One action', 'open and complete'] : ['All clear', 'quietly keeping pace'];
}
function renderCue() {
const button = document.querySelector('.pf-andon');
const label = document.querySelector('[data-pf-cue-label]');
const detail = document.querySelector('[data-pf-cue-detail]');
if (!button || !label || !detail) return;
const badge = readJson(KEYS.badge, {});
const waiting = Boolean(state.currentCue || badge.waiting && !badge.acknowledged);
const [nextLabel,nextDetail] = cueMeta();
button.classList.toggle('is-waiting', waiting);
label.textContent = nextLabel;
detail.textContent = nextDetail;
}
function handleCue() {
const scope = state.currentCue || document;
const root = document.getElementById(ROOT_ID);
const action = [...scope.querySelectorAll('button,[role="button"]')].find(button => !root?.contains(button) && visible(button) && /^(clear|done|log|dismiss|complete|acknowledge|start)$/i.test((button.textContent || button.getAttribute('aria-label') || '').trim()));
if (action) {
action.click();
state.currentCue = null;
writeJson(KEYS.badge, { waiting: false, acknowledged: true, at: new Date().toISOString() });
nativeBadge.clear?.();
toast('Action handled.');
} else acknowledgeTaskbar();
renderCue();
}
function installBadgeBridge() {
if (nativeBadge.set) {
const wrapped = async value => {
const normalized = value == null ? 1 : value;
writeJson(KEYS.badge, { waiting: true, acknowledged: false, value: normalized, at: new Date().toISOString() });
scheduleCueScan();
return nativeBadge.set(normalized);
};
try { Object.defineProperty(navigator, 'setAppBadge', { configurable: true, writable: true, value: wrapped }); }
catch (error) { try { navigator.setAppBadge = wrapped; } catch (fallback) { recordError('badge-bridge', fallback || error); } }
}
acknowledgeTaskbar();
}
function acknowledgeTaskbar() {
try { nativeBadge.clear?.(); } catch (error) { recordError('badge-clear', error); }
const old = readJson(KEYS.badge, {});
writeJson(KEYS.badge, { ...old, acknowledged: true, at: new Date().toISOString() });
try { navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_BADGE', source: 'pacefold-origami' }); } catch {}
renderCue();
}
mount();
})();
