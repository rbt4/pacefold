(() => {
  'use strict';

  const ROOT_ID = 'pf-hub-root';
  let preservedRoot = document.getElementById(ROOT_ID);
  let restoreFrame = 0;

  function restore() {
    restoreFrame = 0;
    const current = document.getElementById(ROOT_ID);
    if (current) {
      preservedRoot = current;
      document.documentElement.classList.add('pf-hub-mounted');
      return;
    }
    if (!preservedRoot || !document.body) return;
    document.body.append(preservedRoot);
    document.documentElement.classList.add('pf-hub-mounted');
  }

  function queueRestore(mutations = []) {
    const current = document.getElementById(ROOT_ID);
    if (current) {
      preservedRoot = current;
      document.documentElement.classList.add('pf-hub-mounted');
      return;
    }
    if (mutations.length && preservedRoot && mutations.every(mutation => preservedRoot.contains(mutation.target))) return;
    if (restoreFrame) return;
    restoreFrame = requestAnimationFrame(restore);
  }

  new MutationObserver(queueRestore).observe(document.documentElement, { childList: true, subtree: true });
  [0, 80, 300, 1200].forEach(delay => setTimeout(restore, delay));
})();
