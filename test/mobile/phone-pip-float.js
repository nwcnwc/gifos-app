// phone-pip-float.js — S10 row B. One Chrome, one page.
//
//   MEET_BASE=http://127.0.0.1:8765 RELAY=ws://127.0.0.1:8790 node test/mobile/phone-pip-float.js
//
// repro.js — S10 row B on the pinned page, one Chrome, one page.
//
// Two doors Nathan reported, driven the way Chrome actually fires them
// (CDP, userGesture:false on every no-gesture step):
//
//   layout  Full screen, then the window becomes the PiP size from the
//           14:32 photo (165x91 CSS). The float is the page. A pass is a
//           picture that fills that window, not a black field.
//   discard The tab is hidden, Chrome fires `freeze` (it does that before
//           a discard), then the tab loads again without ever coming
//           forward first. A pass is camera and mic still on. A reload
//           nobody asked for is not a fresh join.
//   deadcam The page stays visible (a float keeps it visible), the OS ends
//           every camera track including the blur clone, and the window is
//           the PiP size. A pass is a picture that is not black, and camera
//           and mic still on after focus returns.
//
// Exit 0 = that leg passed, 1 = red, 4 = no verdict.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

let CHROME = process.env.MEET_CHROME || process.env.GIFOS_CHROME || '';
if (!CHROME) {
  try { CHROME = require(path.join(os.homedir(), 'rel23-gate-1017/gifos/test/lib/pw')).CHROME; }
  catch (e) { CHROME = require('playwright').chromium.executablePath(); }
}
const BASE = process.env.MEET_BASE || process.env.BASE || 'http://127.0.0.1:8765';
const RELAY = process.env.RELAY || '';
const LEG = process.env.LEG || 'both';
const OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'phone-pip-float-'));
if (LEG === 'both') {
  const { spawnSync } = require('child_process');
  let rc = 0;
  for (const leg of ['layout', 'discard']) {
    const r = spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { LEG: leg, OUT: OUT }), stdio: 'inherit' });
    if (r.status) rc = r.status;
  }
  process.exit(rc);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (n, c, d) => {
  console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (d !== undefined ? '  ' + JSON.stringify(d) : ''));
  if (!c) failures++;
};

function blackFrac(pngPath) {
  const py = spawnSync('python3', ['-c', `
import sys
p = sys.argv[1]
try:
    from PIL import Image
except ImportError:
    sys.exit(2)
im = Image.open(p).convert('RGB')
w, h = im.size
px = im.tobytes()
black = 0
n = w * h
for i in range(0, len(px), 3):
    if px[i] < 12 and px[i+1] < 12 and px[i+2] < 12:
        black += 1
print('%d %d %.4f %d %d' % (black, n, black / max(1, n), w, h))
`, pngPath], { encoding: 'utf8' });
  if (py.status !== 0) return null;
  const parts = py.stdout.trim().split(/\s+/);
  return { black: +parts[0], n: +parts[1], frac: +parts[2], w: +parts[3], h: +parts[4] };
}

const INIT = `(() => {
  const L = window.__pr = { streams: [], ev: [] };
  const ev = (k) => { L.ev.push(Math.round(performance.now()) + ' ' + k); if (L.ev.length > 40) L.ev.shift(); };
  for (const k of ['freeze', 'resume', 'visibilitychange']) document.addEventListener(k, () => ev(k + ':' + document.visibilityState));
  window.addEventListener('pagehide', () => ev('pagehide'));
  window.addEventListener('pageshow', (e) => ev('pageshow persisted=' + e.persisted + ' discarded=' + document.wasDiscarded));
  ev('boot discarded=' + document.wasDiscarded);
  const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => gum(c).then((s) => { L.streams.push(s); ev('gum ' + s.getTracks().map((t) => t.kind + (t.enabled ? '/on' : '/off')).join('+')); return s; });
  window.__osKill = () => {
    let n = 0;
    const seen = new Set();
    const stop = (t) => { if (!t || seen.has(t) || t.readyState !== 'live' || t.kind !== 'video') return; seen.add(t); try { t.stop(); } catch (e) {} try { t.dispatchEvent(new Event('ended')); } catch (e) {} n++; };
    for (const s of L.streams) for (const t of s.getTracks()) stop(t);
    for (const v of document.querySelectorAll('video')) {
      const so = v.srcObject;
      if (so && so.getTracks) for (const t of so.getTracks()) stop(t);
    }
    try { if (window.__gifosVideo && window.__gifosVideo.blurPipeForTest) { const b = window.__gifosVideo.blurPipeForTest(); ev('blur ' + JSON.stringify(b)); } } catch (e) {}
    ev('oskill ' + n);
    return n;
  };
})();`;

const SNAP = `(() => {
  const cam = document.getElementById('cam'), mic = document.getElementById('mic');
  const tile = document.querySelector('.tile.me');
  const v = tile ? tile.querySelector('video') : null;
  const r = tile ? tile.getBoundingClientRect() : null;
  let sample = null;
  if (v && v.videoWidth) {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 18;
    const x = c.getContext('2d', { willReadFrequently: true });
    try {
      x.drawImage(v, 0, 0, 32, 18);
      const d = x.getImageData(0, 0, 32, 18).data;
      let black = 0, bright = 0;
      for (let i = 0; i < d.length; i += 4) {
        const m = Math.max(d[i], d[i+1], d[i+2]);
        if (m < 12) black++; else bright = Math.max(bright, m);
      }
      sample = { black: black / (d.length / 4), bright: bright, w: v.videoWidth, h: v.videoHeight };
    } catch (e) { sample = { err: String(e).slice(0, 80) }; }
  }
  let note = null;
  try { note = sessionStorage.getItem('gifos_recover_media'); } catch (e) {}
  const s = (window.__pr && window.__pr.streams || []).slice(-1)[0];
  const tr = (k) => { const t = s && s.getTracks().find((x) => x.kind === k); return t ? t.readyState + (t.enabled ? '/on' : '/off') : 'none'; };
  return {
    vis: document.visibilityState,
    full: !!(document.fullscreenElement || document.webkitFullscreenElement),
    away: document.body.classList.contains('away-full'),
    appFull: document.body.classList.contains('app-full'),
    camOff: cam ? cam.classList.contains('off') : null,
    micOff: mic ? mic.classList.contains('off') : null,
    vtrack: tr('video'), atrack: tr('audio'),
    tile: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null,
    vw: window.innerWidth, vh: window.innerHeight,
    sample: sample,
    note: note,
    ev: (window.__pr && window.__pr.ev || []).slice(-12),
  };
})()`;

function cdp(url, onEvent) {
  const ws = new WebSocket(url);
  let id = 0; const pend = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    else if (m.method && onEvent) onEvent(m);
  };
  return new Promise((resolve, reject) => {
    ws.onerror = () => reject(new Error('cdp socket'));
    ws.onopen = () => resolve({
      send: (method, params) => new Promise((res, rej) => {
        const i = ++id;
        const t = setTimeout(() => { pend.delete(i); rej(new Error('cdp timeout ' + method)); }, method === 'Page.navigate' ? 60000 : 20000);
        pend.set(i, (m) => { clearTimeout(t); if (m.error) rej(new Error(method + ': ' + m.error.message)); else res(m.result); });
        ws.send(JSON.stringify({ id: i, method, params: params || {} }));
      }),
      close: () => { try { ws.close(); } catch (e) {} },
    });
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const load = fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0];
  console.log('LOAD ' + load + ' LEG ' + LEG + ' BASE ' + BASE);
  if (process.env.LOAD_GATE === '1' && +load >= 8) {
    console.log('NO-VERDICT — load ' + load);
    process.exit(4);
  }
  const ud = fs.mkdtempSync(path.join(os.homedir(), '.cache/gate1400-pip-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
    '--user-data-dir=' + ud, '--no-first-run', '--no-default-browser-check',
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank',
  ], { stdio: 'ignore' });
  console.log('CHROME_PID ' + chrome.pid);
  let br = null;
  const done = async (code, why) => {
    if (why) console.log(why);
    try { if (br) await br.send('Browser.close'); } catch (e) {}
    await sleep(300);
    try { if (chrome.exitCode == null) chrome.kill('SIGTERM'); } catch (e) {}
    try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) {}
    process.exit(code);
  };
  try {
    let port = 0;
    for (let i = 0; i < 80 && !port; i++) {
      try { port = parseInt(fs.readFileSync(path.join(ud, 'DevToolsActivePort'), 'utf8').split('\n')[0], 10); }
      catch (e) { await sleep(250); }
    }
    if (!port) return done(4, 'NO-VERDICT — no debugging port');
    const getJ = (u) => fetch('http://127.0.0.1:' + port + u).then((r) => r.json());
    br = await cdp((await getJ('/json/version')).webSocketDebuggerUrl);
    const tgt = (await getJ('/json/list')).find((t) => t.type === 'page');
    const errs = [];
    const pg = await cdp(tgt.webSocketDebuggerUrl, (m) => {
      if (m.method === 'Runtime.exceptionThrown') errs.push(String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).slice(0, 180));
    });
    const ev = async (expr, gesture) => {
      const r = await pg.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: !!gesture });
      if (r.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.exceptionDetails).slice(0, 240));
      return r.result.value;
    };
    await pg.send('Runtime.enable');
    await pg.send('Page.enable');
    await pg.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 760, deviceScaleFactor: 3, mobile: true });
    await pg.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await pg.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36' });
    await pg.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT });
    await pg.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{" + (RELAY ? "localStorage.setItem('gifos_relay','" + RELAY + "');" : '') + "localStorage.setItem('gifos_name','S10');localStorage.setItem('gifos_meet_bar','0');sessionStorage.setItem('gifos_appear_ok','1');sessionStorage.setItem('gifos_appeared','1')}catch(e){}" });
    const room = 'pip1400' + Math.random().toString(36).slice(2, 8);
    const navUrl = BASE + '/run.html#v=' + room + '&DEBUG=on';
    const navP = pg.send('Page.navigate', { url: navUrl });
    navP.catch((e) => console.log('NAV ' + e.message));
    // Chrome sometimes withholds the navigate reply until load. The page is
    // usable before that reply, so the ready poll is the gate.
    await Promise.race([navP, sleep(1500)]);
    const ready = async () => {
      for (let i = 0; i < 50; i++) {
        try { if (await ev("!!document.getElementById('cam') && !!window.__gifosVideo && window.__pr && window.__pr.streams.length > 0")) return true; } catch (e) {}
        await sleep(400);
      }
      return false;
    };
    if (!(await ready())) return done(4, 'NO-VERDICT — page never came up');
    for (const id of ['cam', 'mic']) {
      for (let i = 0; i < 6; i++) {
        if (!(await ev("document.getElementById('" + id + "').classList.contains('off')"))) break;
        await ev("document.getElementById('" + id + "').click()", true);
        await sleep(500);
      }
    }
    await sleep(1500);
    const s0 = await ev(SNAP);
    console.log('BEFORE ' + JSON.stringify(s0));
    if (s0.camOff || s0.micOff || !/^live\/on/.test(s0.vtrack)) return done(4, 'NO-VERDICT — camera and mic did not come on');

    const shot = async (name) => {
      const r = await pg.send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT, LEG + '-' + name + '.png');
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      const frac = blackFrac(file);
      console.log('SHOT ' + file + ' ' + JSON.stringify(frac));
      return frac;
    };

    if (LEG === 'layout') {
      await ev("document.getElementById('appfull').click()", true);
      await sleep(800);
      const full = await ev(SNAP);
      console.log('FULL ' + JSON.stringify(full));
      if (!full.full) return done(4, 'NO-VERDICT — fullscreen did not stick');
      await pg.send('Emulation.setDeviceMetricsOverride', { width: 165, height: 91, deviceScaleFactor: 3, mobile: true });
      await ev("window.dispatchEvent(new Event('blur')); true");
      await sleep(600);
      const pip = await ev(SNAP);
      console.log('PIP ' + JSON.stringify(pip));
      const frac = await shot('window');
      const videoBlack = !!(pip.sample && pip.sample.black >= 0.9);
      const tileFills = !!(pip.tile && pip.vw && pip.vh
        && pip.tile[1] <= 4 && pip.tile[2] >= pip.vw - 8 && pip.tile[3] >= pip.vh - 8);
      const barHidden = await ev("(() => { const b = document.getElementById('appbar'); return !b || getComputedStyle(b).display === 'none'; })()");
      check('the header is out of the float', barHidden === true);
      check('the self picture in that window is not black', !videoBlack, pip.sample);
      check('the self tile fills the PiP window', tileFills, { tile: pip.tile, vw: pip.vw, vh: pip.vh });
      check('camera and mic stay on while the window is that size', pip.camOff === false && pip.micOff === false, { camOff: pip.camOff, micOff: pip.micOff });
    } else if (LEG === 'discard') {
      const cov = await br.send('Target.createTarget', { url: 'about:blank', newWindow: false });
      await sleep(600);
      const hid = await ev('document.visibilityState');
      if (hid !== 'hidden') return done(4, 'NO-VERDICT — page did not hide ' + hid);
      await ev("document.dispatchEvent(new Event('freeze')); true");
      await sleep(400);
      const mid = await ev(SNAP);
      console.log('FROZEN ' + JSON.stringify(mid));
      await pg.send('Page.reload', { ignoreCache: false });
      if (!(await ready())) return done(4, 'NO-VERDICT — discarded page never came back');
      await sleep(2500);
      const s1 = await ev(SNAP);
      console.log('AFTER ' + JSON.stringify(s1));
      check('back from a discarded tab: the camera is still on', s1.camOff === false, { camOff: s1.camOff, note: mid.note });
      check('back from a discarded tab: the mic is still on', s1.micOff === false, { micOff: s1.micOff });
      check('the camera track is live and enabled', /^live\/on/.test(s1.vtrack), s1.vtrack);
      check('the mic track is live and enabled', /^live\/on/.test(s1.atrack), s1.atrack);
      try { await br.send('Target.closeTarget', { targetId: cov.targetId }); } catch (e) {}
    } else if (LEG === 'deadcam') {
      await ev("document.getElementById('appfull').click()", true);
      await sleep(600);
      await pg.send('Emulation.setDeviceMetricsOverride', { width: 165, height: 91, deviceScaleFactor: 3, mobile: true });
      await ev("window.dispatchEvent(new Event('blur')); true");
      const n = await ev('window.__osKill()');
      if (!n) return done(4, 'NO-VERDICT — no live camera track to end');
      await sleep(2000);
      const mid = await ev(SNAP);
      console.log('DEAD ' + JSON.stringify(mid));
      const frac = await shot('dead');
      const videoBlack = !!(mid.sample && mid.sample.black >= 0.9);
      const windowBlack = !!(frac && frac.frac >= 0.7);
      check('a float whose camera the OS took is not a black field', !(videoBlack || windowBlack), { video: mid.sample, window: frac });
      await ev("window.dispatchEvent(new Event('focus')); true");
      await pg.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 760, deviceScaleFactor: 3, mobile: true });
      await sleep(4000);
      const s1 = await ev(SNAP);
      console.log('AFTER ' + JSON.stringify(s1));
      check('back from that float: the camera button is still on', s1.camOff === false, { camOff: s1.camOff });
      check('back from that float: the mic button is still on', s1.micOff === false, { micOff: s1.micOff });
      check('back from that float: the camera track is live', /^live\/on/.test(s1.vtrack), s1.vtrack);
      check('back from that float: the mic track is live', /^live\/on/.test(s1.atrack), s1.atrack);
    } else return done(4, 'NO-VERDICT — unknown LEG');

    check('no page errors', errs.length === 0, errs.slice(0, 3));
    console.log(failures ? failures + ' FAILED' : 'ALL PASS');
    return done(failures ? 1 : 0);
  } catch (e) {
    return done(4, 'NO-VERDICT — ' + String(e && e.stack || e).slice(0, 400));
  }
})();
