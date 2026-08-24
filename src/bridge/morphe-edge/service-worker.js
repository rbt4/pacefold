'use strict';

const YTM_URL = 'https://music.youtube.com/';
const PACEFOLD_URL = 'https://rbt4.github.io/pacefold/*';
const ENGINE_KEY = 'pacefoldEngineTabId';

async function storedEngineId() {
  const data = await chrome.storage.local.get(ENGINE_KEY);
  return Number(data?.[ENGINE_KEY]) || 0;
}

async function validTab(tabId) {
  if (!tabId) return null;
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab?.url?.startsWith(YTM_URL) ? tab : null;
  } catch {
    return null;
  }
}

async function findEngineTab() {
  const stored = await validTab(await storedEngineId());
  if (stored) return stored;
  const tabs = await chrome.tabs.query({url: `${YTM_URL}*`});
  const tab = tabs.find(item => item.id);
  if (tab?.id) await chrome.storage.local.set({[ENGINE_KEY]: tab.id});
  return tab || null;
}

async function broadcast(type, payload = {}) {
  const tabs = await chrome.tabs.query({url: PACEFOLD_URL});
  await Promise.all(tabs.filter(tab => tab.id).map(tab => chrome.tabs.sendMessage(tab.id, {type, payload}).catch(() => null)));
}

async function waitForEngine(tabId, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {type: 'bridge:ping'});
      if (response?.ready) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

async function ensureEngine({activate = false} = {}) {
  let tab = await findEngineTab();
  if (!tab) tab = await chrome.tabs.create({url: YTM_URL, active: Boolean(activate)});
  else if (activate && tab.id) await chrome.tabs.update(tab.id, {active: true});
  if (!tab?.id) throw new Error('Could not open YouTube Music');
  await chrome.storage.local.set({[ENGINE_KEY]: tab.id});
  await waitForEngine(tab.id);
  await broadcast('bridge:connection', {connected: true, tabId: tab.id});
  return tab;
}

async function sendEngine(command, value) {
  const tab = await ensureEngine();
  try {
    return await chrome.tabs.sendMessage(tab.id, {type: 'bridge:command', command, value});
  } catch {
    await waitForEngine(tab.id);
    return chrome.tabs.sendMessage(tab.id, {type: 'bridge:command', command, value});
  }
}

function musicUrl(raw) {
  const url = new URL(String(raw || ''));
  const host = url.hostname.replace(/^www\./, '');
  if (!['music.youtube.com', 'youtube.com', 'youtu.be'].includes(host)) throw new Error('Unsupported music URL');
  if (host === 'music.youtube.com') return url.href;
  let id = '';
  if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
  else {
    id = url.searchParams.get('v') || '';
    if (!id) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1] || '';
    }
  }
  const list = url.searchParams.get('list') || '';
  const target = new URL('https://music.youtube.com/watch');
  if (id) target.searchParams.set('v', id);
  if (list) target.searchParams.set('list', list);
  if (!id && list) target.pathname = '/playlist';
  if (!id && !list) throw new Error('Missing YouTube video or playlist id');
  return target.href;
}

async function sponsorSegments(videoId, categories) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(String(videoId || ''))) return [];
  const wanted = Array.isArray(categories) && categories.length ? categories : ['music_offtopic', 'sponsor', 'selfpromo'];
  const url = new URL('https://sponsor.ajay.app/api/skipSegments');
  url.searchParams.set('videoID', videoId);
  url.searchParams.set('categories', JSON.stringify(wanted));
  const response = await fetch(url, {headers: {'accept': 'application/json'}});
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`SponsorBlock ${response.status}`);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).map(item => ({
    segment: Array.isArray(item?.segment) ? [Number(item.segment[0]) || 0, Number(item.segment[1]) || 0] : [0, 0],
    category: String(item?.category || '')
  })).filter(item => item.segment[1] > item.segment[0]);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const type = message?.type;
    const payload = message?.payload || {};

    if (type === 'bridge:hello') {
      const tab = await findEngineTab();
      return {connected: Boolean(tab), tabId: tab?.id || 0};
    }
    if (type === 'bridge:connect') {
      const tab = await ensureEngine({activate: payload.activate !== false});
      if (payload.settings) await sendEngine('settings', payload.settings);
      return {connected: true, tabId: tab.id};
    }
    if (type === 'bridge:focus') {
      const tab = await ensureEngine({activate: true});
      return {connected: true, tabId: tab.id};
    }
    if (type === 'bridge:command') {
      if (payload.command === 'loadUrl') {
        const target = musicUrl(payload.value);
        const tab = await ensureEngine();
        await chrome.tabs.update(tab.id, {url: target});
        return {ok: true};
      }
      return sendEngine(payload.command, payload.value);
    }
    if (type === 'engine:ready') {
      if (sender.tab?.id) await chrome.storage.local.set({[ENGINE_KEY]: sender.tab.id});
      await broadcast('bridge:connection', {connected: true, tabId: sender.tab?.id || 0});
      return {ok: true};
    }
    if (type === 'engine:state') {
      if (sender.tab?.id) await chrome.storage.local.set({[ENGINE_KEY]: sender.tab.id});
      await broadcast('bridge:state', payload);
      return {ok: true};
    }
    if (type === 'sponsor:lookup') {
      return {segments: await sponsorSegments(payload.videoId, payload.categories)};
    }
    return {ok: false};
  })().then(sendResponse).catch(error => sendResponse({ok: false, error: error?.message || 'Bridge failed'}));
  return true;
});

chrome.tabs.onRemoved.addListener(async tabId => {
  if (tabId !== await storedEngineId()) return;
  await chrome.storage.local.remove(ENGINE_KEY);
  await broadcast('bridge:connection', {connected: false, tabId: 0});
});
