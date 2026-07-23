(() => {
  'use strict';

  const ROOT_ID = 'pf-hub-root';
  let preserved = document.getElementById(ROOT_ID);
  let frame = 0;
  let attempts = 0;

  function remember() {
    const current = document.getElementById(ROOT_ID);
    if (current) preserved = current;
    return current;
  }

  function restore() {
    frame = 0;
    const current = remember();
    if (current) {
      document.documentElement.classList.add('pf-hub-mounted', 'pf-origami-mounted');
      attempts = 0;
      return;
    }
    if (!preserved || !document.body || attempts > 8) return;
    attempts += 1;
    document.body.append(preserved);
    document.documentElement.classList.add('pf-hub-mounted', 'pf-origami-mounted');
  }

  function queue(mutations = []) {
    if (remember()) return;
    if (mutations.length && preserved && mutations.every(mutation => preserved.contains(mutation.target))) return;
    if (frame) return;
    frame = requestAnimationFrame(restore);
  }

  new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true });
  [0, 80, 280, 900, 1800].forEach(delay => setTimeout(restore, delay));
})();
