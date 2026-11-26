/*
 * sw-register.js — register the GifOS offline service worker (sw.js).
 *
 * With it installed, the whole desktop and every app already saved on this
 * device keep working with no network at all (airplane mode). Networked
 * features (Meetings, the web-reading apps, Ask AI) still need a connection and
 * degrade on their own. A no-op where service workers are unavailable, and it
 * never blocks first paint — registration waits for load.
 *
 * A new worker takes over as soon as it installs, on every channel (sw.js
 * explains why the worker never waits). If an older worker is found WAITING,
 * it is told to take over too. Nothing here reloads the page: a running page,
 * a live meeting included, keeps the code it loaded, and its later requests
 * and the next navigation go through the new worker.
 */
(function () {
  // READING navigator.serviceWorker throws (not undefined) where workers are
  // disabled — a sandboxed iframe without allow-same-origin, or a driver that
  // blocks them — so the property access itself needs the guard.
  var sw = null;
  try { sw = navigator.serviceWorker; } catch (e) { return; }
  if (!sw) return;
  window.addEventListener('load', function () {
    sw.register('/sw.js').then(function (reg) {
      if (!reg) return;
      var apply = function () { if (reg.waiting) reg.waiting.postMessage({ type: 'gifos-apply-update' }); };
      apply();                                      // a worker already waiting from a prior visit
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () { if (nw.state === 'installed') apply(); });
      });
      try { reg.update(); } catch (e) {}            // check the site for a newer worker now
    }).catch(function () { /* offline / unsupported — ignore */ });
  });
})();
