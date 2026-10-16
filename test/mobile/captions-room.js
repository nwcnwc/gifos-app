/*
 * A meeting is always transcribed. CC only shows or hides captions on this
 * screen. A tile never says who turned transcription on. Transcript is in
 * chat from the start, and it can be downloaded.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/captions-room.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const BOT = 'notes-7597fb';

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['Pixel 7'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=captions-room', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  const before = await page.evaluate((bot) => {
    const api = window.__gifosVideo;
    const tr = document.getElementById('trbtn');
    const call = document.getElementById('call-cc');
    api.presentPeers([{ id: bot, name: 'bot notes' }]);
    api._ghostStatus(bot, 0, { bot: true, cc: true, scribe: true, camOff: true });
    api.addTranscript('written before captions');
    const tile = (id) => {
      const el = document.querySelector('#feed .tile[data-peer="' + id + '"]');
      return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '';
    };
    const bar = document.getElementById('livecap');
    return {
      trShown: tr.style.display !== 'none',
      callOn: call.classList.contains('on'),
      mine: api.ccOn(),
      view: api.ccViewOn ? api.ccViewOn() : null,
      me: tile('me'),
      bot: tile(bot),
      bar: bar.classList.contains('show'),
    };
  }, BOT);
  const bad = [];
  if (!before.trShown) bad.push('Transcript is hidden before anyone taps CC');
  if (before.callOn) bad.push('Captions is on because someone else is writing');
  if (before.mine) bad.push('this phone advertised transcription');
  if (before.view !== false) bad.push('captions view is not off (' + before.view + ')');
  if (/transcribing|Captions paused|Captions behind|📝/.test(before.me)) bad.push('Nathan tile has a transcription chip ("' + before.me + '")');
  if (/transcribing|Captions|📝|writing everyone/.test(before.bot)) bad.push('bot tile has a transcription chip ("' + before.bot + '")');
  if (before.bar) bad.push('a transcript line showed captions while CC is off');
  const shot = bad.length ? 'before-captions-room-pixel-7.png' : 'after-captions-room-pixel-7.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  if (!bad.length) {
    await page.locator('#call-cc').tap();
    await page.waitForTimeout(200);
    const on = await page.evaluate(() => {
      const call = document.getElementById('call-cc');
      const btn = document.getElementById('ccbtn');
      const cs = getComputedStyle(call);
      window.__gifosVideo.addTranscript('shown on this screen');
      return {
        callOn: call.classList.contains('on'),
        pressed: call.getAttribute('aria-pressed'),
        bg: cs.backgroundColor,
        color: cs.color,
        btnOn: btn.classList.contains('on'),
        mine: window.__gifosVideo.ccOn(),
        view: window.__gifosVideo.ccViewOn(),
        bar: document.getElementById('livecap').classList.contains('show'),
      };
    });
    if (!on.callOn || on.pressed !== 'true') bad.push('CC did not select on this screen');
    if (on.bg !== 'rgb(0, 100, 200)' || on.color !== 'rgb(255, 255, 255)') bad.push('CC selected ' + on.bg + ' / ' + on.color);
    if (!on.btnOn) bad.push('More Captions did not match the on-call button');
    if (on.mine) bad.push('tapping CC turned transcription on for the room');
    if (on.view !== true) bad.push('CC view did not turn on');
    if (!on.bar) bad.push('captions stayed hidden after CC on');
    await page.locator('#call-cc').tap();
    await page.waitForTimeout(150);
    const off = await page.evaluate(() => {
      window.__gifosVideo.addTranscript('hidden again');
      return {
        on: document.getElementById('call-cc').classList.contains('on'),
        view: window.__gifosVideo.ccViewOn(),
        bar: document.getElementById('livecap').classList.contains('show'),
        mine: window.__gifosVideo.ccOn(),
      };
    });
    if (off.on || off.view !== false || off.bar) bad.push('CC off still shows captions');
    if (off.mine) bad.push('CC off changed the transcription flag');
    await page.locator('#mic').tap();
    await page.waitForTimeout(200);
    const voice = await page.evaluate(() => window.__gifosVideo.ownVoice());
    if (!voice || !voice.wanted || voice.cc) bad.push('own voice is not transcribed on unmute (' + JSON.stringify(voice) + ')');
    await page.locator('#bartoggle').tap();
    await page.locator('#trbtn').scrollIntoViewIfNeeded();
    await page.locator('#trbtn').tap();
    await page.waitForTimeout(200);
    const panel = await page.evaluate(() => {
      const dl = document.getElementById('trdl');
      const r = dl.getBoundingClientRect();
      return {
        title: document.getElementById('paneltitle').textContent,
        open: document.getElementById('trwrap').classList.contains('show'),
        log: (document.getElementById('trlog').innerText || '').replace(/\s+/g, ' ').trim(),
        download: r.width > 8 && r.height > 8 && (dl.innerText || '').indexOf('Download') >= 0,
      };
    });
    if (panel.title !== 'Transcript' || !panel.open) bad.push('Transcript did not open in chat');
    if (panel.log.indexOf('written before captions') < 0 || panel.log.indexOf('hidden again') < 0) bad.push('transcript "' + panel.log + '"');
    if (!panel.download) bad.push('Download transcript is missing');
    await page.screenshot({ path: path.join(SHOTS, 'after-captions-transcript-pixel-7.png') });
  }
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(before));
    process.exit(1);
  }
  console.log('PASS captions personal');
})().catch((e) => { console.error(e); process.exit(1); });
