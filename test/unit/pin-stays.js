// pin-stays.js — a version pin does not end. While one is in effect the
// header says so and offers one tap back to the current release.
//
// The channel decision is the page's own pinTarget (window.gifosPinTarget).
// The header words are desktop.js pinHeadCopy, lifted the same way.
//
//   node test/unit/pin-stays.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

function pinTargetFrom(file) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const a = html.indexOf('function pinTarget(');
  const b = html.indexOf('window.gifosPinTarget = pinTarget;');
  check('lift pinTarget from ' + file, a > 0 && b > a);
  return a > 0 && b > a ? html.slice(a, b) : '';
}

const pages = ['index.html', 'boot.html', 'sign.html', 'run.html'];
const bodies = pages.map(pinTargetFrom);
check('the four entry loaders decide a pin the same way', bodies.every((b) => b && b === bodies[0]));

function mem(init) {
  const m = Object.assign({}, init || {});
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v) { m[k] = String(v); },
    removeItem(k) { delete m[k]; },
    dump() { return Object.assign({}, m); },
  };
}

function decide(src, store, host, pathname, search, hash) {
  const location = { hostname: host, pathname: pathname || '/' };
  const window = { GIFOS_VERSION: 'edge' };
  function XMLHttpRequest() {}
  XMLHttpRequest.prototype.open = function () {};
  XMLHttpRequest.prototype.send = function () { throw new Error('pin test must not ask the network'); };
  const pinTarget = new Function('localStorage', 'location', 'window', 'XMLHttpRequest', src + '\nreturn pinTarget;')(store, location, window, XMLHttpRequest);
  return pinTarget(pathname || '/', search || '', hash || '');
}

const src = bodies[0];
const ancient = '1';
const yearAgo = String(Date.now() - 400 * 24 * 60 * 60 * 1000);

function kept(label, init, host, pathname) {
  const store = mem(init);
  let decision = null, threw = null;
  try { decision = decide(src, store, host, pathname); }
  catch (e) { threw = e; }
  const dump = store.dump();
  check(label + ' — still redirects to the pin',
    decision && decision.redirect === '/versions/0.9.12/',
    threw ? String(threw) : JSON.stringify(decision));
  check(label + ' — the pin is still stored',
    dump.gifos_pin === '0.9.12' && dump.gifos_pin_until === init.gifos_pin_until,
    JSON.stringify(dump));
}

kept('receipt 0', { gifos_pin: '0.9.12', gifos_pin_until: '0' }, 'gifos.app');
kept('a year-old receipt', { gifos_pin: '0.9.12', gifos_pin_until: yearAgo }, 'gifos.app');
kept('the oldest receipt', { gifos_pin: '0.9.12', gifos_pin_until: ancient }, 'www.gifos.app');
kept('edge host, old receipt', { gifos_pin: '0.9.12', gifos_pin_until: yearAgo }, 'edge.gifos.app');

{
  const store = mem({ gifos_channel: 'edge', gifos_pin_until: yearAgo });
  const decision = decide(src, store, 'gifos.app', '/');
  check('an old edge choice stays on the edge build', decision == null, JSON.stringify(decision));
  check('the edge choice is still stored', store.dump().gifos_channel === 'edge' && !store.dump().gifos_pin);
}

{
  const store = mem({ gifos_pin: '0.9.12', gifos_pin_until: yearAgo });
  const decision = decide(src, store, 'gifos.app', '/meet/room-1');
  check('a meeting page does not follow the pin', !decision || !decision.redirect, JSON.stringify(decision));
  check('the meeting page still leaves the pin stored', store.dump().gifos_pin === '0.9.12');
}

{
  const store = mem({ gifos_pin: '0.9.12' });
  const decision = decide(src, store, 'gifos.app', '/');
  check('a pin with no receipt is cleared on gifos.app', decision == null && !store.dump().gifos_pin, JSON.stringify(store.dump()));
  check('that clear is recorded as a reset, not an end', store.dump().gifos_pin_ended === 'reset:0.9.12', store.dump().gifos_pin_ended);
}

{
  const store = mem({ gifos_pin: '0.9.12', gifos_pin_until: yearAgo });
  const decision = decide(src, store, 'gifos.app', '/', '?latest', '');
  check('?latest is the one-tap way back', decision && decision.clear === true, JSON.stringify(decision));
  check('?latest removes the pin', !store.dump().gifos_pin && !store.dump().gifos_channel && !store.dump().gifos_pin_until);
}

// The loader never compares the receipt to the clock.
const timeCompare = /until\s*(?:<|>|<=|>=)|Number\(\s*until|parseInt\(\s*until|\+\s*until|until\s*-\s*|Date\.now\(\)/.test(
  src.replace(/version\.json\?ts=' \+ Date\.now\(\)/, 'version.json')
);
check('pinTarget does not compare the receipt to the clock', timeCompare === false);

const desktop = fs.readFileSync(path.join(root, 'js', 'desktop.js'), 'utf8');
check('the expiry switch is gone', desktop.indexOf('PIN_EXPIRE_DAYS') < 0);
check('the confirm does not warn that a pin ends', desktop.indexOf('goes back to the latest release on its own') < 0);
check('settings does not say a pin ends after a number of days', desktop.indexOf('ends after ') < 0);

const copySrcStart = desktop.indexOf('function pinHeadCopy(');
const copySrcEnd = desktop.indexOf('function paintPinHead(');
const copySrc = copySrcStart > 0 && copySrcEnd > copySrcStart ? desktop.slice(copySrcStart, copySrcEnd) : '';
check('lift pinHeadCopy', copySrc.indexOf('function pinHeadCopy') === 0);
const pinHeadCopy = new Function('const EDGE = "edge";\n' + copySrc + '\nreturn pinHeadCopy;')();
const edge = pinHeadCopy('edge');
const old = pinHeadCopy('0.9.12');
check('edge header says pinned to edge', edge && edge.label === 'Pinned: edge' && edge.action === 'Back to current release', JSON.stringify(edge));
check('version header says pinned to that version', old && old.label === 'Pinned: v0.9.12' && old.action === 'Back to current release', JSON.stringify(old));
check('no pin means no header', pinHeadCopy(null) === null && pinHeadCopy('') === null);
check('pinHeadCopy has no clock of its own', !/Date|until|expire/i.test(copySrc));

const paintStart = desktop.indexOf('function paintPinHead(');
const paintEnd = desktop.indexOf('function notePinEnded(');
const paint = desktop.slice(paintStart, paintEnd);
check('the header is painted from pinHeadCopy', paint.indexOf('pinHeadCopy(to)') >= 0);
check('the header button is Back to current release', paint.indexOf('copy.action') >= 0 && paint.indexOf('id="pin-back"') >= 0);
check('the header has no dismiss control', paint.indexOf('dismiss') < 0 && paint.indexOf('pin-bar') >= 0);
check('the back button calls useRelease', paint.indexOf('useRelease()') >= 0);

const useStart = desktop.indexOf('function useRelease(');
const useEnd = desktop.indexOf('async function loadEdge(');
const use = desktop.slice(useStart, useEnd);
check('Back to current release clears the pin',
  use.indexOf("removeItem('gifos_pin')") >= 0 &&
  use.indexOf("removeItem('gifos_channel')") >= 0 &&
  use.indexOf("removeItem('gifos_pin_until')") >= 0);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
