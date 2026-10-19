/*
 * bot-room-transcript.js — the room transcript a person sees holds what the
 * Meeting Bot SAID, as "Meeting Bot: …", and none of Whisper's silence lines.
 *
 * Nathan's 4:50 PM export (2026-10-18) held only his own lines, written down
 * by the bot, and among them "you", "you you", "Thank you." and "Okay. you":
 * Whisper's words for near-silence. The bot's five spoken lines were missing.
 *
 * A real local meeting, nothing stubbed in the page:
 *   1. a bot session joins through GifOS.meetHost (exactly as the Meeting Bot
 *      app does: join, transcribe on, speak with bytes + text)
 *   2. "Nathan" joins with test/swarm/meet.js (DEBUG=on) and plays a short
 *      voice clip into his mic five times
 *   3. the bot's scribe posts each utterance to a local speech endpoint that
 *      answers with Nathan's real lines, hallucinations included
 *   4. the bot speaks twice
 *   5. Nathan's own transcript (and the bot's) is read back
 *
 * Env:
 *   BASE     the site (default http://127.0.0.1:8099)
 *   RELAY    the relay (default ws://127.0.0.1:8790)
 *   MEETJS   path to gifos test/swarm/meet.js
 *   STT_PORT local speech endpoint port (default 18433)
 *   OUT      folder for the transcript JSON, the meet.js log and screenshots
 * Exit 0 on pass, 1 on fail.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const RELAY = process.env.RELAY || 'ws://127.0.0.1:8790';
const MEETJS = process.env.MEETJS || path.join(__dirname, '..', '..', '..', 'gifos', 'test', 'swarm', 'meet.js');
const STT_PORT = parseInt(process.env.STT_PORT || '18433', 10);
const OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'bot-room-tr-'));
const ROOM = 'bottr' + Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

// What Whisper wrote for Nathan, in order (from /tmp/nathan-transcript-1742.txt).
const HEARD = ['you', 'Hello, can you hear me?', 'you you', 'Okay. you', 'Thank you.', 'Now we are stuck in picture in picture.'];
const SAID = ['The top headline right now is about the storm on the coast.', 'A blinking thought bubble is a good idea, I will pass it on.'];

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

// A voiced 1.2 s clip: a 180 Hz buzz with harmonics under a syllable envelope.
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

(async () => {
  const wavFile = path.join(OUT, 'nathan-voice.wav');
  const wav = voiceWav(wavFile);
  const stt = await sttServer();
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required',
    '--disable-features=WebRtcHideLocalIpsWithMdns,LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests'] });
  let meet = null;
  const logs = [];
  try {
    const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const host = await ctx.newPage();
    host.on('console', (m) => logs.push(new Date().toISOString() + ' ' + m.text()));
    // The GifOS host page, reduced to what the Meeting Bot uses: meet-host.js.
    await host.route(BASE + '/__bot-host.html', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>bot host</title><script src="js/meet-host.js"></script>' }));
    await host.goto(BASE + '/__bot-host.html');
    await host.evaluate(([relay, sttPort]) => {
      localStorage.setItem('gifos_relay', relay);
      localStorage.setItem('gifos_ai_config', JSON.stringify({ stt: { app: 'local-stt' } }));
      localStorage.setItem('gifos_cc_stt_url', 'http://127.0.0.1:' + sttPort + '/stt');
    }, [RELAY, STT_PORT]);
    const joined = await host.evaluate((link) => window.GifOS.meetHost.join({ link, bot: true, name: 'Meeting Bot' }), BASE + '/run.html#v=' + ROOM + '&relay=' + encodeURIComponent(RELAY));
    const id = joined.meetingId;
    await host.evaluate((id) => window.GifOS.meetHost.setTranscribe(id, true), id);
    console.log('[bot] joined ' + ROOM + ' as Meeting Bot (' + id + ')');

    const meetLog = fs.createWriteStream(path.join(OUT, 'meet-nathan.log'));
    const evalTr = 'eval JSON.stringify({tr: window.__gifosVideo.transcriptTexts(), blocks: window.__gifosVideo.transcriptBlocks()})';
    meet = spawn(process.execPath, [MEETJS, '--base', BASE, '--relay', RELAY, '--room', ROOM, '--name', 'Nathan',
      '--say-wav', wavFile, '--say-after', '10', '--say-every', '4',
      '--script', 'sleep 52; ' + evalTr + '; shot ' + path.join(OUT, 'nathan.png')], { stdio: ['ignore', 'pipe', 'pipe'] });
    let meetOut = '';
    meet.stdout.on('data', (d) => { meetOut += d; meetLog.write(d); });
    meet.stderr.on('data', (d) => meetLog.write(d));
    const meetDone = new Promise((r) => meet.on('exit', (code) => r(code)));

    const seen = async () => (await host.evaluate((id) => window.GifOS.meetHost.meetingState(id), id)).people.some((p) => p.name === 'Nathan');
    const end = Date.now() + 40000;
    while (!(await seen().catch(() => false))) {
      if (Date.now() > end) {
        await host.screenshot({ path: path.join(OUT, 'bot-host.png') }).catch(() => {});
        throw new Error('Nathan never reached the bot: ' + JSON.stringify(await host.evaluate((id) => window.GifOS.meetHost.meetingState(id), id).catch((e) => e.message)));
      }
      await sleep(500);
    }
    console.log('[bot] Nathan is in the room');
    await sleep(3000);
    for (const text of SAID) {
      console.log('[bot] speaking at ' + new Date().toISOString());
      const r = await host.evaluate(([id, bytes, text]) => window.GifOS.meetHost.speak(id, { bytes: new Uint8Array(bytes), mime: 'audio/wav', text }), [id, Array.from(wav), text]);
      console.log('[bot] spoke: ' + JSON.stringify(r));
      await sleep(6000);
    }

    const code = await meetDone;
    meetLog.end();
    const frame = host.frames().find((f) => f !== host.mainFrame());
    const botTr = frame ? await frame.evaluate(() => window.__gifosVideo.transcriptTexts()).catch((e) => ['ERR ' + e.message]) : ['no frame'];
    const m = meetOut.match(/@@eval (".*")\s*$/m);
    let nathan = { tr: [], blocks: [] };
    try { if (m) nathan = JSON.parse(JSON.parse(m[1])); } catch (e) {}
    const result = { room: ROOM, meetExit: code, sttPosts: stt.posts, nathanTranscript: nathan.tr, nathanBlocks: nathan.blocks, botTranscript: botTr };
    fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));

    const lines = nathan.tr;
    const texts = lines.map((l) => l.replace(/^[^:]+: /, ''));
    check('meet.js read Nathan\'s transcript', m !== null, meetOut.slice(-400));
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
    fs.writeFileSync(path.join(OUT, 'bot-console.log'), logs.join('\n'));
    if (meet && meet.exitCode === null) meet.kill('SIGTERM');
    await browser.close().catch(() => {});
    stt.srv.close();
  }
  console.log('OUT ' + OUT);
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
