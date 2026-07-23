(() => {
  'use strict';

  const ROOT_ID = 'pf-hub-root';
  let preservedRoot = document.getElementById(ROOT_ID);
  let restoreQueued = false;

  function restore() {
    restoreQueued = false;
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

  function queueRestore() {
    if (restoreQueued) return;
    restoreQueued = true;
    queueMicrotask(restore);
  }

  const observer = new MutationObserver(queueRestore);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  [0, 50, 200, 750, 2000, 5000].forEach(delay => setTimeout(restore, delay));
})();
