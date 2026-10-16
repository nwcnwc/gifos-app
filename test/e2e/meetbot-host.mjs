// Headless pairing: this GifOS host with Meet Bot at f7bd2df
// (gifos-apps-source branch cursor/meetbot-voice-control, CONTROL.md version 2).
//
// Packs that commit into a GIF (not committed), serves this repo, and drives
// Chrome through the operator page. interject must speak on the meeting mic.
// Mic and camera toggles must land on the session buttons.
// The key and the stand-in URLs must not appear in page text or the console.
//
//   node test/e2e/meetbot-host.mjs
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { deflateRawSync } from 'node:zlib';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const rootDir = join(here, '..', '..');
const COMMIT = 'f7bd2df';
const RAW = 'https://raw.githubusercontent.com/nwcnwc/gifos-apps-source/' + COMMIT + '/meeting-bot/';
const BOT_FILES = ['manifest.json', 'index.html', 'app.js', 'protocol.js', 'voice.js', 'host-voice.js', 'help.md', 'CONTROL.md', 'listing.json', 'icon.mjs'];
const KEY = 'sk-e2e-SECRET-key-7c1b';
const SAY = 'Harbor check in.';
const NAME = 'harbor-maple';
const PASSWORD = 'quiet-harbor-42';

const secrets = [];
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
function redact(text) {
  let s = String(text == null ? '' : text);
  for (const secret of secrets) if (secret) s = s.split(secret).join('[redacted]');
  return s;
}
function leaked(text) {
  const s = String(text == null ? '' : text);
  return secrets.filter((secret) => secret && s.indexOf(secret) >= 0).length > 0;
}

function toneWav(ms) {
  const rate = 8000;
  const n = Math.max(1, Math.floor(rate * ms / 1000));
  const data = n * 2;
  const buf = Buffer.alloc(44 + data);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + data, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(data, 40);
  for (let i = 0; i < n; i++) {
    const sample = Math.sin(2 * Math.PI * 220 * i / rate) * 0.2;
    buf.writeInt16LE((sample * 32767) | 0, 44 + i * 2);
  }
  return buf;
}

function polyfillCompression() {
  const Orig = globalThis.CompressionStream;
  globalThis.CompressionStream = class CompressionStream {
    constructor(format) {
      if (format !== 'deflate-raw') {
        if (Orig) return new Orig(format);
        throw new TypeError('unsupported format ' + format);
      }
      const chunks = [];
      const ts = new TransformStream({
        transform(chunk) { chunks.push(Buffer.from(chunk)); },
        flush(controller) { controller.enqueue(new Uint8Array(deflateRawSync(Buffer.concat(chunks)))); }
      });
      this.readable = ts.readable;
      this.writable = ts.writable;
    }
  };
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not fetch Meet Bot (' + res.status + ').');
  return res.text();
}

async function packBot() {
  const dir = mkdtempSync(join(tmpdir(), 'meetbot-'));
  const files = {};
  for (const name of BOT_FILES) {
    const text = await fetchText(RAW + name);
    writeFileSync(join(dir, name), text);
    if (name !== 'icon.mjs') files[name] = text;
  }
  if (!/version:\s*2/.test(files['app.js'])) throw new Error('Meet Bot app.js is not contract version 2.');
  if (!/version 2/.test(files['CONTROL.md']) && !/Version 2/.test(files['CONTROL.md'])) {
    throw new Error('CONTROL.md is not version 2.');
  }
  if (/host-voice\.js/.test(files['index.html'])) throw new Error('The app frame must not load host-voice.js.');
  polyfillCompression();
  await import(pathToFileURL(join(rootDir, 'js', 'gifos-gif.js')).href);
  const { icon } = await import(pathToFileURL(join(dir, 'icon.mjs')).href);
  const manifest = JSON.parse(files['manifest.json']);
  const bytes = await globalThis.GifOS.gif.encode(files, { preview: icon(), accent: manifest.accent });
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49) throw new Error('encode did not return a GIF');
  return bytes;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.gif': 'image/gif', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
  '.key': 'application/octet-stream'
};

function startServer(gif) {
  const wav = toneWav(4000);
  const ttsHits = [];
  let releaseTts = null;
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/e2e/meeting-bot.gif' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'image/gif', 'content-length': String(gif.length), 'cache-control': 'no-store' });
      res.end(gif);
      return;
    }
    if (url.pathname === '/e2e/tts' && req.method === 'POST') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const headers = {};
        for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = v;
        ttsHits.push({ body, headers });
        const send = () => {
          res.writeHead(200, { 'content-type': 'audio/wav', 'content-length': String(wav.length), 'cache-control': 'no-store' });
          res.end(wav);
        };
        if (releaseTts) releaseTts(send);
        else releaseTts = send;
      });
      return;
    }
    if (url.pathname === '/e2e/stt' && req.method === 'POST') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end('{"text":""}');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const full = normalize(join(rootDir, rel));
    if (full !== rootDir && !full.startsWith(rootDir + '/')) { res.writeHead(403); res.end(); return; }
    if (!existsSync(full) || !statSync(full).isFile()) { res.writeHead(404); res.end('missing'); return; }
    const buf = readFileSync(full);
    res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream', 'content-length': String(buf.length), 'cache-control': 'no-store' });
    if (req.method === 'HEAD') res.end();
    else res.end(buf);
  });
  server.requestTimeout = 0;
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const origin = 'http://127.0.0.1:' + port;
      secrets.push(KEY, origin + '/e2e/tts', origin + '/e2e/stt');
      resolve({
        server, origin, ttsHits,
        armHold() { releaseTts = null; },
        release() {
          const send = releaseTts;
          releaseTts = null;
          if (typeof send === 'function') send();
        }
      });
    });
  });
}

function loadPuppeteer() {
  const from = join(tmpdir(), 'e2e-node', 'node_modules', 'puppeteer-core');
  try { return require('puppeteer-core'); } catch (e) { return require(from); }
}

async function findFrame(page, pred) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const ok = await frame.evaluate(pred).catch(() => false);
      if (ok) return frame;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

async function readSession(page, id) {
  return page.evaluate((meetId) => {
    const el = document.querySelector('iframe[data-gifos-meet="' + meetId + '"]');
    if (!el || !el.contentDocument || !el.contentWindow) return { missing: true };
    const doc = el.contentDocument;
    const win = el.contentWindow;
    const mic = doc.getElementById('mic');
    const cam = doc.getElementById('cam');
    const mouth = win.__gifosVideo && win.__gifosVideo.botMouth ? win.__gifosVideo.botMouth() : null;
    return {
      speaking: (doc.documentElement.dataset && doc.documentElement.dataset.botSpeaking) || '',
      mic: mic ? mic.getAttribute('aria-pressed') : '',
      cam: cam ? cam.getAttribute('aria-pressed') : '',
      mouth: mouth
    };
  }, id);
}

async function main() {
  console.log('packing Meet Bot ' + COMMIT);
  const gif = await packBot();
  check('the packed GIF is a GIF', gif[0] === 0x47 && gif.length > 1000, String(gif.length));
  const web = await startServer(gif);
  const puppeteer = loadPuppeteer();
  const userDataDir = mkdtempSync(join(tmpdir(), 'meetbot-chrome-'));
  const logs = [];
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    headless: true,
    userDataDir,
    protocolTimeout: 180000,
    args: [
      '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });
  const shots = [];
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    await page.setViewport({ width: 1280, height: 900 });
    page.on('console', (msg) => logs.push(msg.type() + ' ' + msg.text()));
    page.on('pageerror', (err) => logs.push('pageerror ' + (err && err.message || err)));
    const gifUrl = web.origin + '/e2e/meeting-bot.gif';
    await page.goto(web.origin + '/?run=' + encodeURIComponent(gifUrl), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => location.pathname.indexOf('run.html') >= 0 && location.hash.indexOf('id=') >= 0, { timeout: 60000 });
    await page.waitForSelector('.perm-box .done', { timeout: 30000 });
    await page.click('.perm-box .done');
    check('the abilities sheet was confirmed', true);
    const app = await findFrame(page, () => !!(window.MeetingBot && window.MeetingBot.version === 2));
    check('Meet Bot version 2 is running in the app frame', !!app);
    if (!app) throw new Error('Meeting Bot frame did not appear.');
    const started = await app.evaluate(async (opts) => {
      const st = await window.MeetingBot.start(opts);
      return { phase: st && st.phase, warning: st && st.warning || '', errors: (st && st.errors) || [] };
    }, { mode: 'run', name: NAME, password: PASSWORD, override: true });
    check('the bot started in run mode', started && started.phase === 'run', redact(JSON.stringify(started)));
    const created = await app.evaluate(async () => {
      const r = await window.MeetingBot.create();
      return { id: r && r.id, room: r && r.room || '' };
    });
    check('a work meeting was created', !!(created && created.id), redact(JSON.stringify(created)));
    const voiced = await app.evaluate(async (settings) => {
      const pub = await window.MeetingBot.setVoice(settings);
      const st = window.MeetingBot.status();
      return {
        voice: pub && pub.conversation_voice,
        tts: pub && pub.tts,
        stt: pub && pub.stt,
        llm: pub && pub.llm,
        errors: (st && st.errors) || [],
        providers: (document.getElementById('ops-providers') || {}).textContent || ''
      };
    }, {
      conversation_voice: 'local',
      llm: { url: 'http://127.0.0.1:9/v1', model: 'local-model', key: KEY },
      tts: { engine: 'http', url: web.origin + '/e2e/tts', voice: 'af_heart' },
      stt: { url: web.origin + '/e2e/stt' }
    });
    const voiceBlob = JSON.stringify(voiced);
    check('setVoice stays on the operator page without the key or the stand-in URLs',
      voiced && voiced.voice === 'local' && voiced.tts && voiced.tts.engine === 'http' && voiced.stt && voiced.stt.configured === true && !leaked(voiceBlob) && (!voiced.errors || !voiced.errors.length),
      redact(voiceBlob));
    web.armHold();
    await app.evaluate((id, text) => {
      window.__e2eSay = window.MeetingBot.interject(id, text).then(
        (r) => { window.__e2eSayResult = { ok: true, spoken: !!(r && r.spoken) }; },
        (e) => { window.__e2eSayResult = { ok: false, error: String(e && e.message || e) }; }
      );
    }, created.id, SAY);
    const ear = await app.waitForFunction(() => {
      const el = document.getElementById('ops-ear');
      return el && el.textContent === 'Speaking' ? 'Speaking' : false;
    }, { timeout: 15000 }).then((h) => h.jsonValue()).catch((e) => redact(e && e.message || e));
    check('the operator ear says Speaking while speech is held', ear === 'Speaking', String(ear));
    const held = Date.now() + 8000;
    while (Date.now() < held && !web.ttsHits.length) await new Promise((r) => setTimeout(r, 50));
    const hit = web.ttsHits[0];
    let body = {};
    try { body = JSON.parse(hit && hit.body || '{}'); } catch (e) { body = {}; }
    const auth = hit && hit.headers && (hit.headers.authorization || hit.headers.Authorization);
    check('interject posts text and voice to the speech stand-in and not the key',
      !!hit && !auth && body.text === SAY && body.voice === 'af_heart' && !leaked(hit.body) && JSON.stringify(hit.headers).indexOf(KEY) < 0);
    await app.evaluate(() => {
      const earEl = document.getElementById('ops-ear');
      if (earEl) earEl.scrollIntoView({ block: 'center' });
    });
    const shotDir = existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : join(tmpdir(), 'meetbot-e2e-shots');
    mkdirSync(shotDir, { recursive: true });
    const speakingShot = join(shotDir, 'meetbot-speaking.png');
    await page.screenshot({ path: speakingShot });
    shots.push(speakingShot);
    web.release();
    let session = null;
    const speakDeadline = Date.now() + 10000;
    while (Date.now() < speakDeadline) {
      session = await readSession(page, created.id);
      if (session && session.speaking === '1' && session.mouth && session.mouth.speaking) break;
      await new Promise((r) => setTimeout(r, 40));
    }
    check('interject speaks through the meeting microphone',
      !!(session && session.speaking === '1' && session.mouth && session.mouth.speaking),
      redact(JSON.stringify(session)));
    const toggled = await app.evaluate(async (id) => {
      const mic = await window.MeetingBot.setMic(id, true);
      const cam = await window.MeetingBot.setCamera(id, true);
      const hand = await window.MeetingBot.raiseHand(id, true);
      const snap = await window.gifos.meet.snapshot(id);
      const again = await window.gifos.meet.snapshot(id);
      return { mic, cam, hand, snap, again };
    }, created.id);
    session = await readSession(page, created.id);
    const chip = await app.evaluate(() => (document.getElementById('ops-meetings') || {}).textContent || '');
    check('the microphone toggle turns the session mic on',
      toggled && toggled.mic && toggled.mic.mic === true && session && session.mic === 'true' && chip.indexOf('Mic on') >= 0,
      redact(JSON.stringify({ mic: toggled && toggled.mic, aria: session && session.mic, chip: chip.slice(0, 180) })));
    check('the camera toggle turns the session camera on',
      toggled && toggled.cam && toggled.cam.camera === true && session && session.cam === 'true' && chip.indexOf('Camera on') >= 0,
      redact(JSON.stringify({ cam: toggled && toggled.cam, aria: session && session.cam })));
    check('snapshot only reads the room',
      toggled && toggled.snap && toggled.snap.mic === true && toggled.snap.camera === true && toggled.snap.hand === true &&
      toggled.again && toggled.again.mic === true && toggled.again.camera === true && Array.isArray(toggled.snap.people),
      redact(JSON.stringify(toggled && toggled.snap)));
    const liveShot = join(shotDir, 'meetbot-mic-camera.png');
    await app.evaluate(() => {
      const box = document.getElementById('ops-meetings');
      if (box) box.scrollIntoView({ block: 'center' });
    });
    await page.screenshot({ path: liveShot });
    shots.push(liveShot);
    const said = await app.waitForFunction(() => window.__e2eSayResult || false, { timeout: 15000 }).then((h) => h.jsonValue());
    check('interject finishes as spoken', said && said.ok === true && said.spoken === true, redact(JSON.stringify(said)));
    const tail = await app.evaluate(() => (document.getElementById('ops-tail') || {}).textContent || '');
    check('the bot voice stays out of the transcript', tail.indexOf(SAY) < 0, redact(tail.slice(0, 240)));
    const texts = [tail, chip];
    for (const frame of page.frames()) {
      const text = await frame.evaluate(() => (document.body && document.body.innerText) || '').catch(() => '');
      texts.push(text);
    }
    texts.push(logs.join('\n'));
    check('page text and the console do not contain the key or the stand-in URLs', !texts.some(leaked));
    const sttHeld = await page.evaluate((meetId, url) => {
      const el = document.querySelector('iframe[data-gifos-meet="' + meetId + '"]');
      return !!(el && el.contentWindow && el.contentWindow.__gifosSttStandIn === url);
    }, created.id, web.origin + '/e2e/stt');
    check('the captions stand-in is in memory on the session and not on the page', sttHeld === true);
  } finally {
    await browser.close();
    web.server.close();
  }
  if (shots.length) console.log('screenshots ' + shots.join(' '));
  console.log(fail ? ('\n' + fail + ' FAILURE(S)') : '\nALL PASS');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(redact(e && e.stack || e));
  process.exit(1);
});
