/*
 * Captions and transcribing are one thing. A bot that is writing the room
 * down lights the CC control for everyone, and the chip on that bot's tile
 * says Captions. Someone who did not turn it on does not wear the chip.
 * Transcript opens for anyone.
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
  await page.evaluate((bot) => {
    const api = window.__gifosVideo;
    api.presentPeers([{ id: bot, name: 'bot notes' }]);
    api._ghostStatus(bot, 0, { bot: true, cc: true, camOff: true });
    api.addTranscript('the room can read this');
  }, BOT);
  await page.waitForTimeout(300);
  const info = await page.evaluate((bot) => {
    const tile = (id) => {
      const el = document.querySelector('#feed .tile[data-peer="' + id + '"]');
      return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '';
    };
    const call = document.getElementById('call-cc');
    const btn = document.getElementById('ccbtn');
    const tr = document.getElementById('trbtn');
    const cs = getComputedStyle(btn);
    return {
      mine: window.__gifosVideo.ccOn ? window.__gifosVideo.ccOn() : null,
      callOn: call.classList.contains('on'),
      callPressed: call.getAttribute('aria-pressed'),
      callText: (call.innerText || '').trim(),
      btnOn: btn.classList.contains('on'),
      btnBg: cs.backgroundColor,
      btnColor: cs.color,
      me: tile('me'),
      bot: tile(bot),
      trShown: tr.style.display !== 'none',
    };
  }, BOT);
  const bad = [];
  if (info.mine !== false) bad.push('this phone is captioning (' + info.mine + ')');
  if (!info.callOn || info.callPressed !== 'true') bad.push('on-call Captions is off');
  if (info.callText !== 'Captions') bad.push('on-call label "' + info.callText + '"');
  if (!info.btnOn) bad.push('More Captions is off while the room is being written down');
  if (info.btnBg !== 'rgb(0, 100, 200)' || info.btnColor !== 'rgb(255, 255, 255)') bad.push('Captions on fill ' + info.btnBg + ' / ' + info.btnColor);
  if (info.me.indexOf('transcribing') >= 0 || info.me.indexOf('Captions') >= 0) bad.push('Nathan\'s tile says captions ("' + info.me + '")');
  if (info.bot.indexOf('transcribing') >= 0) bad.push('bot still says transcribing ("' + info.bot + '")');
  if (info.bot.indexOf('Captions') < 0) bad.push('bot tile has no Captions chip ("' + info.bot + '")');
  if (info.bot.indexOf('bot') < 0) bad.push('bot badge missing');
  if (!info.trShown) bad.push('Transcript is hidden');
  const shot = bad.length ? 'before-captions-room-pixel-7.png' : 'after-captions-room-pixel-7.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  if (!bad.length) {
    await page.locator('#call-cc').tap();
    await page.waitForTimeout(200);
    const afterTap = await page.evaluate(() => ({
      mine: window.__gifosVideo.ccOn(),
      on: document.getElementById('call-cc').classList.contains('on'),
    }));
    if (afterTap.mine !== false) bad.push('tapping Captions started a second writer');
    if (!afterTap.on) bad.push('tapping Captions turned the room indicator off');
    await page.locator('#bartoggle').tap();
    await page.locator('#trbtn').scrollIntoViewIfNeeded();
    await page.locator('#trbtn').tap();
    await page.waitForTimeout(200);
    const panel = await page.evaluate(() => ({
      title: document.getElementById('paneltitle').textContent,
      open: document.getElementById('trwrap').classList.contains('show'),
      log: (document.getElementById('trlog').innerText || '').replace(/\s+/g, ' ').trim(),
    }));
    if (panel.title !== 'Transcript' || !panel.open) bad.push('Transcript did not open');
    if (panel.log.indexOf('the room can read this') < 0) bad.push('transcript "' + panel.log + '"');
    if (panel.log.indexOf('transcribing') >= 0) bad.push('transcript still says transcribing');
    await page.screenshot({ path: path.join(SHOTS, 'after-captions-transcript-pixel-7.png') });
  }
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS captions room');
})().catch((e) => { console.error(e); process.exit(1); });
