/*
 * bot-standard.js — the Meeting Bot's standard behavior in a real local
 * meeting (0.9.23b, Nathan's 17:00/17:03/17:43 steering, 2026-10-18):
 *
 *   A. while the bot thinks, its tile shows a blinking thought bubble, and
 *      the bubble stays sharp while the tile is blurred
 *   C. the bot consents to clear video, so a password room where every
 *      person picked No blur goes clear (a camera-off bot used to block it)
 *   +  what the bot says lands in the room transcript as "Meeting Bot: …"
 *   +  Whisper's silence lines ("you", "you you", "Thank you.") are dropped,
 *      and "Okay. you" is written as "Okay."
 *
 * Nothing is stubbed in the page:
 *   1. "Nathan" joins with test/swarm/meet.js in drive mode (DEBUG=on) and
 *      locks the room with a password (--ensure-pass)
 *   2. the bot session joins through GifOS.meetHost with that password,
 *      exactly as the Meeting Bot app does, and transcribes
 *   3. the bot thinks; Nathan's view of the bot tile is read (blurred room)
 *   4. Nathan picks No blur; both pages are read for clear video
 *   5. the bot speaks; the bubble must go
 *   6. Nathan plays a voice clip six times; a local speech endpoint answers
 *      with the lines Whisper wrote at 17:42, hallucinations included
 *   7. the bot speaks again; both transcripts are read back
 *
 * Env: BASE (site), RELAY, MEETJS, STT_PORT, OUT (evidence folder).
 * Exit 0 on pass, 1 on fail.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8137';
const RELAY = process.env.RELAY || 'ws://127.0.0.1:8797';
const MEETJS = process.env.MEETJS || path.join(__dirname, '..', '..', '..', '..', 'gifos', 'test', 'swarm', 'meet.js');
const STT_PORT = parseInt(process.env.STT_PORT || '18437', 10);
const OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'bot-standard-'));
const ROOM = 'botstd' + Date.now().toString(36);
const PW = 'pw-' + Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const HEARD = ['you', 'Hello, can you hear me?', 'you you', 'Okay. you', 'Thank you.', 'Now we are stuck in picture in picture.'];
const SAID = ['The top headline right now is about the storm on the coast.', 'A blinking thought bubble is a good idea, I will pass it on.'];

let pass = 0, fail = 0;
const result = { room: ROOM, checks: [] };
function check(name, ok, detail) {
  result.checks.push({ name, ok: !!ok, detail: ok ? undefined : detail });
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

function voiceWav(file) {
  const rate = 16000, n = Math.round(rate * 1.2);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = 0.55 + 0.45 * Math.sin(2 * Math.PI * 4 * t);
    let s = 0;
    for (let h = 1; h <= 6; h++) s += Math.sin(2 * Math.PI * 180 * h * t) / h;
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(s * env * 0.35 * 32767))), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
  return buf;
}

function sttServer() {
  const posts = [];
  const srv = http.createServer((req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    let bytes = 0;
    req.on('data', (c) => { bytes += c.length; });
    req.on('end', () => {
      const text = posts.length < HEARD.length ? HEARD[posts.length] : '';
      posts.push({ at: Date.now(), bytes, text });
      res.writeHead(200, Object.assign({ 'content-type': 'application/json' }, cors));
      res.end(JSON.stringify({ text }));
    });
  });
  return new Promise((resolve) => srv.listen(STT_PORT, '127.0.0.1', () => resolve({ srv, posts })));
}

// meet.js --drive: one command per line in, one '@@done'/'@@err' out.
function driver(args, logFile) {
  const log = fs.createWriteStream(logFile);
  const p = spawn(process.execPath, [MEETJS, '--drive'].concat(args), { stdio: ['pipe', 'pipe', 'pipe'] });
  const waiters = [];
  let lines = [], err = '';
  readline.createInterface({ input: p.stdout }).on('line', (l) => {
    log.write(l + '\n');
    lines.push(l);
    if (/^@@(done|err|ready)/.test(l) && waiters.length) { const w = waiters.shift(); const got = lines; lines = []; w(got); }
  });
  p.stderr.on('data', (d) => { err += d; log.write(d); });
  const next = () => new Promise((r) => waiters.push(r));
  const ready = next();
  return {
    proc: p,
    ready,
    stderr: () => err,
    run(cmd) { const w = next(); log.write('>> ' + cmd.slice(0, 200) + '\n'); p.stdin.write(cmd + '\n'); return w; },
    async eval(code, a) {
      const got = await this.run((a ? 'aeval ' : 'eval ') + code);
      const m = got.map((l) => l.match(/@@eval (.*)$/)).filter(Boolean).pop();
      if (!m) return { err: got.join(' | ') };
      try { const v = JSON.parse(m[1]); return typeof v === 'string' && !a ? JSON.parse(v) : v; } catch (e) { return { err: m[1] }; }
    },
    close() { log.end(); try { p.stdin.end(); } catch (e) {} },
  };
}

// Nathan's view of the bot tile, one line for the drive channel.
const PROBE = `JSON.stringify((() => {
  const v = window.__gifosVideo, d = v.debugDump();
  const tile = [...document.querySelectorAll('.tile')].find((t) => t.querySelector(':scope > .botbadge'));
  const blurOf = (el) => !el ? null : (el.classList.contains('blur2') ? 2 : el.classList.contains('blur1') ? 1 : 0);
  const filters = (el) => { const out = []; for (let e = el; e && e !== document.body; e = e.parentElement) { const f = getComputedStyle(e).filter; if (f && f !== 'none') out.push(f); } return out; };
  const b = tile && tile.querySelector(':scope > .thinkbubble');
  const face = tile && (tile.querySelector(':scope > .avatar') || tile.querySelector(':scope > video'));
  let hit = null;
  if (b && face) {
    const r = b.getBoundingClientRect(), t = tile.getBoundingClientRect(), s = getComputedStyle(b);
    const z = (el) => parseInt(getComputedStyle(el).zIndex, 10) || 0;
    hit = r.width > 20 && r.height > 10 && r.left >= t.left && r.right <= t.right && r.top >= t.top && r.bottom <= t.bottom
      && s.display !== 'none' && s.visibility === 'visible' && b.parentElement === face.parentElement && z(b) > z(face);
  }
  return { consent: d.consent, myBlur: v.myBlur(), botTile: !!tile, bubble: !!b,
    bubbleAnim: b ? getComputedStyle(b).animationName : null, bubbleFilters: b ? filters(b) : null, bubbleOnTop: hit,
    bubbleLabel: b ? b.getAttribute('aria-label') : null,
    botFace: face ? face.tagName.toLowerCase() : null, botFaceBlur: blurOf(face), botFaceFilter: face ? getComputedStyle(face).filter : null,
    status: (document.getElementById('status') || {}).textContent || '' };
})())`.replace(/\s*\n\s*/g, ' ');

async function waitFor(fn, ms, every) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) { last = await fn(); if (last && last.ok) return last; await sleep(every || 500); }
  return last;
}

(async () => {
  const wavFile = path.join(OUT, 'nathan-voice.wav');
  const wav = voiceWav(wavFile);
  const stt = await sttServer();
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required',
    '--disable-features=WebRtcHideLocalIpsWithMdns,LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests'] });
  const nathan = driver(['--base', BASE, '--name', 'Nathan', '--cam', '--ensure-pass', PW, '--say-wav', wavFile, '--say-after', '900'], path.join(OUT, 'meet-nathan.log'));
  const logs = [];
  let host = null;
  try {
    await nathan.ready;
    await nathan.run('join ' + ROOM + ' --relay ' + RELAY);
    const locked = await waitFor(async () => ({ ok: /room is locked with our password/.test(nathan.stderr()) }), 60000);
    check('Nathan locked the room with a password', locked.ok, nathan.stderr().slice(-400));
    // The first-visit "This is how you'll appear" prompt: Save, as a person would.
    await waitFor(async () => ({ ok: (await nathan.eval("(() => { const b = document.getElementById('nmok'); if (b) b.click(); return !document.getElementById('appear-modal'); })()")) === true }), 15000);
    await nathan.run('cam on');
    await nathan.eval('(window.__gifosVideo.setBlur(2), 1)');

    const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
    host = await ctx.newPage();
    host.on('console', (m) => logs.push(m.text()));
    host.on('crash', () => logs.push('[harness] bot host page CRASHED at ' + new Date().toISOString()));
    await host.route(BASE + '/__bot-host.html', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>bot host</title><script src="js/meet-host.js"></script>' }));
    await host.goto(BASE + '/__bot-host.html');
    await host.evaluate(([relay, sttPort]) => {
      localStorage.setItem('gifos_relay', relay);
      localStorage.setItem('gifos_ai_config', JSON.stringify({ stt: { app: 'local-stt' } }));
      localStorage.setItem('gifos_cc_stt_url', 'http://127.0.0.1:' + sttPort + '/stt');
    }, [RELAY, STT_PORT]);
    const joined = await host.evaluate(([link, pw]) => window.GifOS.meetHost.join({ link, password: pw, bot: true, name: 'Meeting Bot' }),
      [BASE + '/run.html#v=' + ROOM + '&relay=' + encodeURIComponent(RELAY), PW]);
    const id = joined.meetingId;
    await host.evaluate((id) => window.GifOS.meetHost.setTranscribe(id, true), id);
    console.log('[bot] joined ' + ROOM + ' (' + id + ')');
    const frame = () => host.frames().find((f) => f !== host.mainFrame());
    const botSees = await waitFor(async () => {
      const s = await host.evaluate((id) => window.GifOS.meetHost.meetingState(id), id).catch((e) => ({ err: e.message }));
      return { ok: !!(s.people && s.people.some((p) => p.name === 'Nathan')), s };
    }, 45000);
    check('the bot is in the locked room with Nathan', botSees.ok, JSON.stringify(botSees.s).slice(0, 400));
    const nathanSees = await waitFor(async () => { const p = await nathan.eval(PROBE); return { ok: p.botTile, p }; }, 30000);
    check('Nathan sees the bot tile', nathanSees.ok, JSON.stringify(nathanSees.p));
    await sleep(2000);

    // A: the bot thinks while Nathan's room is still blurred.
    const th = await host.evaluate((id) => window.GifOS.meetHost.thinking(id, true), id).catch((e) => ({ err: e.message.slice(0, 160) }));
    result.thinkingOn = th;
    check('meetHost.thinking(id, true) is accepted', th && th.thinking === true, JSON.stringify(th));
    const blurred = await waitFor(async () => { const p = await nathan.eval(PROBE); return { ok: p.bubble, p }; }, 10000);
    result.blurred = blurred.p;
    await nathan.run('shot ' + path.join(OUT, 'nathan-thinking-blurred.png'));
    const b = blurred.p || {};
    check('Nathan sees a thought bubble on the bot tile', b.bubble, JSON.stringify(b));
    check('the bubble blinks (thinkblink animation)', b.bubbleAnim === 'thinkblink', b.bubbleAnim);
    check('the bot tile is blurred at that moment', b.botFaceBlur > 0 && b.botFaceFilter && b.botFaceFilter !== 'none', JSON.stringify(b));
    check('the bubble itself is under no blur filter', Array.isArray(b.bubbleFilters) && b.bubbleFilters.length === 0, JSON.stringify(b.bubbleFilters));
    check('the bubble sits inside the tile, above the blurred face', b.bubbleOnTop === true, JSON.stringify(b));

    // C: Nathan picks No blur. The bot already did, so the room goes clear.
    await nathan.eval('(window.__gifosVideo.setBlur(0), 1)');
    const clear = await waitFor(async () => { const p = await nathan.eval(PROBE); return { ok: p.consent === true, p }; }, 15000);
    result.clear = clear.p;
    const botDump = await frame().evaluate(() => { const d = window.__gifosVideo.debugDump(); return { consent: d.consent, myBlur: window.__gifosVideo.myBlur() }; }).catch((e) => ({ err: e.message }));
    result.botConsent = botDump;
    await nathan.run('shot ' + path.join(OUT, 'nathan-clear.png'));
    const c = clear.p || {};
    check('Nathan\'s page: everyone consents, the room is clear', c.consent === true, JSON.stringify(c));
    check('the bot picked No blur', botDump.myBlur === 0, JSON.stringify(botDump));
    check('the bot\'s page agrees the room is clear', botDump.consent === true, JSON.stringify(botDump));
    check('the bot tile is no longer blurred for Nathan', c.botFaceBlur === 0, JSON.stringify(c));
    check('the bubble is still up while the bot thinks', c.bubble === true, JSON.stringify(c));

    // The bot speaks: the bubble goes, the line lands in Nathan's transcript.
    const r1 = await host.evaluate(([id, bytes, text]) => window.GifOS.meetHost.speak(id, { bytes: new Uint8Array(bytes), mime: 'audio/wav', text }), [id, Array.from(wav), SAID[0]]);
    console.log('[bot] spoke: ' + JSON.stringify(r1));
    const gone = await waitFor(async () => { const p = await nathan.eval(PROBE); return { ok: p.bubble === false, p }; }, 10000);
    result.afterSpeak = gone.p;
    await nathan.run('shot ' + path.join(OUT, 'nathan-after-speak.png'));
    check('the bubble goes when the bot speaks', gone.ok, JSON.stringify(gone.p));

    // Whisper's lines for Nathan's six utterances.
    await nathan.eval('(window.__clip = "' + wav.toString('base64') + '", 1)');
    for (let i = 0; i < HEARD.length; i++) {
      await nathan.eval('window.__vbPlay(window.__clip).then(() => 1)', true);
      await sleep(4500);
    }
    await waitFor(async () => ({ ok: stt.posts.length >= HEARD.length }), 15000);
    await sleep(3000);
    const r2 = await host.evaluate(([id, bytes, text]) => window.GifOS.meetHost.speak(id, { bytes: new Uint8Array(bytes), mime: 'audio/wav', text }), [id, Array.from(wav), SAID[1]]);
    console.log('[bot] spoke: ' + JSON.stringify(r2));
    await sleep(5000);

    const tr = await nathan.eval('JSON.stringify({ tr: window.__gifosVideo.transcriptTexts(), blocks: window.__gifosVideo.transcriptBlocks() })');
    const botTr = await frame().evaluate(() => window.__gifosVideo.transcriptTexts()).catch((e) => ['ERR ' + e.message]);
    await nathan.run('shot ' + path.join(OUT, 'nathan-final.png'));
    Object.assign(result, { sttPosts: stt.posts, nathanTranscript: tr.tr, nathanBlocks: tr.blocks, botTranscript: botTr });
    const lines = tr.tr || [];
    const texts = lines.map((l) => l.replace(/^[^:]+: /, ''));
    check('the speech endpoint was asked for every utterance', stt.posts.length >= HEARD.length, stt.posts.length + ' posts');
    check('Nathan\'s real sentence is written down', lines.includes('Nathan: Hello, can you hear me?'), JSON.stringify(lines));
    for (const said of SAID) check('Nathan sees "Meeting Bot: ' + said.slice(0, 30) + '…"', lines.includes('Meeting Bot: ' + said), JSON.stringify(lines));
    for (const said of SAID) check('the bot\'s own transcript holds "' + said.slice(0, 30) + '…"', botTr.includes('Meeting Bot: ' + said), JSON.stringify(botTr));
    for (const noise of ['you', 'you you', 'Thank you.']) check('no lone "' + noise + '" line', !texts.includes(noise), JSON.stringify(lines));
    check('"Okay. you" is written as "Okay."', texts.includes('Okay.') && !texts.includes('Okay. you'), JSON.stringify(lines));
    check('each bot line is written once', SAID.every((s) => lines.filter((l) => l === 'Meeting Bot: ' + s).length === 1), JSON.stringify(lines));
  } catch (e) {
    fail++;
    console.log('FAIL ' + (e && e.stack || e));
  } finally {
    result.sttPosts = stt.posts;
    fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(OUT, 'bot-console.log'), logs.join('\n'));
    if (host) await host.screenshot({ path: path.join(OUT, 'bot-host.png') }).catch(() => {});
    await nathan.run('quit').catch(() => {});
    nathan.close();
    setTimeout(() => { if (nathan.proc.exitCode === null) nathan.proc.kill('SIGTERM'); }, 3000).unref();
    await browser.close().catch(() => {});
    stt.srv.close();
  }
  console.log('OUT ' + OUT);
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
