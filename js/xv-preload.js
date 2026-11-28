/*
 * xv-preload.js: the picture check's models, fetched in the background from the first load of any GifOS page (Nathan 11-28:
 * safety first, on any network). Once the page has loaded and the browser is idle it loads js/gifos-explicit.js (if the page
 * has not) and asks it to preload; the files come down at low priority, are checked against their pins, and are kept once
 * per device in Cache Storage, so a room later finds them ready. Never blocks the page: nothing runs before load + idle.
 * A device that cannot run the check (no WebAssembly or Worker) does nothing.
 */
(function () {
  'use strict';
  var W = window;
  if (W.__xvPreload) return;
  W.__xvPreload = 1;
  var here = (function () {
    try { var s = document.currentScript; if (s && s.src) return s.src.replace(/[^\/]*$/, ''); } catch (e) {}
    return '/js/';
  })();
  function script(name) {
    return new Promise(function (ok, bad) {
      var s = document.createElement('script');
      s.src = here + name; s.async = true; s.onload = ok; s.onerror = bad;
      document.head.appendChild(s);
    });
  }
  function go() {
    var need = (W.GifOS && W.GifOS.timings) ? Promise.resolve() : script('timings.js').catch(function () {});   // a site without the table (gifos.tv) goes on
    need.then(function () {
      return (W.GifOS && W.GifOS.explicit && W.GifOS.explicit.video) ? 0 : script('gifos-explicit.js');
    }).then(function () {
      var V = W.GifOS && W.GifOS.explicit && W.GifOS.explicit.video;
      if (V) return V.preload();
    }).then(function (r) {
      try { W.__xvPreloadResult = r; } catch (e) {}
    }, function () {});
  }
  function later() {
    var idle = (W.GifOS && W.GifOS.timings && W.GifOS.timings.XV_PRELOAD_IDLE_MS);
    if (typeof W.requestIdleCallback === 'function') W.requestIdleCallback(go);
    else setTimeout(go, idle);   // Safari has no idle callback: the same wait as the in-room preload
  }
  if (document.readyState === 'complete') later(); else W.addEventListener('load', later);
})();
