(() => {
  'use strict';
  if(window.msalRedirectBridge&&typeof window.msalRedirectBridge.broadcastResponseToMainFrame==='function'){
    window.msalRedirectBridge.broadcastResponseToMainFrame();
  }
})();
