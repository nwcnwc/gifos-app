/*
 * xv-preload.js: the picture check's models, fetched in the background from the first load of any GifOS page (Nathan 11-28:
 * safety first, on any network). Once the page has loaded and the browser is idle it loads js/gifos-explicit.js (if the page
 * has not) and asks it to preload; the files come down at low priority, are checked against their pins, and are kept once
 * per device in Cache Storage, so a room later finds them ready. Never blocks the page: nothing runs before load + idle.
 * A device that cannot run the check (no WebAssembly or Worker) does nothing.
 *
 * NEVER COMPETES WITH A PAGE LOAD (MEETSLOW 11-28): on a slow link the download used to share the line with the Meeting a
 * person had just opened, and that page sat blank. Now every page announces its load on one BroadcastChannel; any page
 * downloading pauses (aborts its low-priority fetches) and tries again after XV_RESUME_MS of quiet, and a page that is itself
 * loading starts nothing until its load and idle. One download per device at a time: a Web Lock ('gifos-xv-preload') holds
 * it, so a second tab joins by waiting its turn, and finds the files already kept.
 */
(function () {
  'use strict';
  var W = window;
  if (W.__xvPreload) return;
  W.__xvPreload = 1;
  function resumeMs() { var t = W.GifOS && W.GifOS.timings; return t && t.XV_RESUME_MS; }   // quiet needed after another page's load before the download goes on (timings.json)
  function retryLater() { var ms = resumeMs(); clearTimeout(timer); if (!done && ms) timer = setTimeout(go, ms); }
  var here = (function () {
    try { var s = document.currentScript; if (s && s.src) return s.src.replace(/[^\/]*$/, ''); } catch (e) {}
    return '/js/';
  })();
  var ch = null, V = null, timer = 0, running = false, done = false;
  try { ch = new BroadcastChannel('gifos-page-loading'); } catch (e) {}
  function script(name) {
    return new Promise(function (ok, bad) {
      var s = document.createElement('script');
      s.src = here + name; s.async = true; s.onload = ok; s.onerror = bad;
      document.head.appendChild(s);
    });
  }
  function pausedBy() {   // another page began loading: stop taking the line, try again later
    if (V && V.pause) V.pause();
    running = false;
    retryLater();
  }
  if (ch) {
    ch.onmessage = function (m) { if (m && m.data === 'loading' && document.readyState === 'complete') pausedBy(); };
    try { ch.postMessage('loading'); } catch (e) {}   // this page is loading now
  }
  function run() {
    if (running || done) return Promise.resolve();
    running = true;
    var need = (W.GifOS && W.GifOS.timings) ? Promise.resolve() : script('timings.js').catch(function () {});   // a site without the table (gifos.tv) goes on
    return need.then(function () {
      return (W.GifOS && W.GifOS.explicit && W.GifOS.explicit.video) ? 0 : script('gifos-explicit.js');
    }).then(function () {
      V = W.GifOS && W.GifOS.explicit && W.GifOS.explicit.video;
      if (V) return V.preload();
    }).then(function (r) {
      try { W.__xvPreloadResult = r; } catch (e) {}
      if (r && r.err) { running = false; retryLater(); }   // paused or failed: another go later
      else done = true;
    }, function () { running = false; });
  }
  function go() {
    if (W.navigator && W.navigator.locks && W.navigator.locks.request) {
      W.navigator.locks.request('gifos-xv-preload', { ifAvailable: true }, function (lock) {
        if (!lock) { retryLater(); return; }   // another tab holds the download
        return run();   // the lock is held until the download ends (done, paused or failed)
      }).catch(function () { run(); });
    } else run();
  }
  function later() {
    var idle = (W.GifOS && W.GifOS.timings && W.GifOS.timings.XV_PRELOAD_IDLE_MS);
    if (typeof W.requestIdleCallback === 'function') W.requestIdleCallback(go);
    else setTimeout(go, idle);   // Safari has no idle callback: the same wait as the in-room preload
  }
  if (document.readyState === 'complete') later(); else W.addEventListener('load', later);
})();
