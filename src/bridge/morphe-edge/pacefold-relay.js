(() => {
  'use strict';
  const CHANNEL = 'pacefold-morphe-r9';
  const post = (type, payload = {}) => window.postMessage({source: CHANNEL, direction: 'to-page', type, payload}, location.origin);

  window.addEventListener('message', event => {
    const data = event.data;
    if (event.source !== window || !data || data.source !== CHANNEL || data.direction !== 'to-extension') return;
    Promise.resolve(chrome.runtime.sendMessage({type: data.type, payload: data.payload || {}}))
      .then(response => post('bridge:response', {requestType: data.type, response: response || null}))
      .catch(error => post('bridge:error', {message: error?.message || 'Bridge request failed'}));
  });

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'bridge:state') post('bridge:state', message.payload || {});
    if (message?.type === 'bridge:connection') post('bridge:connection', message.payload || {});
  });

  post('bridge:ready', {version: chrome.runtime.getManifest().version});
  chrome.runtime.sendMessage({type: 'bridge:hello', payload: {}})
    .then(response => post('bridge:connection', response || {connected: false}))
    .catch(() => post('bridge:connection', {connected: false}));
})();
