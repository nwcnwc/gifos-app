// lm19-join-precache.js — a meeting join must not precache the desktop shell.
//
// Loading /run.html registers sw.js. The install handler cache.adds CORE.
// CORE is the whole origin shell, so one clean join fetches pages and scripts
// the meeting never runs. This fails while that install still requests
// /404.html, /js/pay.js, or /llms.txt. It passes when the install list for
// this worker no longer contains those paths and still fetches /run.html.
//
//   node test/unit/lm19-join-precache.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let fails = 0;
const check = (n, c, d) => {
  console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (d !== undefined && !c ? '  ' + JSON.stringify(d) : ''));
  if (!c) fails++;
};

const root = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const banned = ['/404.html', '/js/pay.js', '/llms.txt'];
const listeners = {};
const added = [];
const sandbox = {
  self: {
    location: { hostname: '127.0.0.1', href: 'http://127.0.0.1/sw.js' },
    addEventListener: (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); },
    skipWaiting: () => Promise.resolve(),
    clients: { matchAll: () => Promise.resolve([]) },
  },
  caches: {
    open: () => Promise.resolve({
      add: (req) => { added.push(String(req && req.url != null ? req.url : req)); return Promise.resolve(); },
      put: () => Promise.resolve(),
      keys: () => Promise.resolve([]),
    }),
    keys: () => Promise.resolve([]),
    match: () => Promise.resolve(undefined),
  },
  Request: class Request { constructor(u) { this.url = String(u); } },
  fetch: () => Promise.resolve({ ok: true, clone() { return this; } }),
  Response: class Response {},
  URL,
  Promise,
  console,
  setTimeout,
  clearTimeout,
};
vm.createContext(sandbox);
try {
  vm.runInContext(src, sandbox, { filename: 'sw.js' });
} catch (e) {
  check('sw.js loads far enough to install', false, String(e && e.message || e));
}

const install = (listeners.install || [])[0];
let pending = Promise.resolve();
if (install) {
  try { install({ waitUntil: (p) => { pending = p; } }); }
  catch (e) { check('install handler runs', false, String(e && e.message || e)); }
}

pending.then(() => {
  const hit = banned.filter((p) => added.indexOf(p) >= 0);
  check('a join install does not fetch /404.html, /js/pay.js, or /llms.txt', hit.length === 0, { hit, added: added.length });
  check('a join install still fetches the meeting page', added.indexOf('/run.html') >= 0, added.filter((p) => /run\.html|mesh\.js/.test(p)));
  if (fails) process.exit(1);
}).catch((e) => {
  check('install finished', false, String(e && e.message || e));
  process.exit(1);
});
