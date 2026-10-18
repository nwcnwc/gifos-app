/*
 * A broadcast host who is off air is not recording. Going on air starts the
 * device recording; going back off air stops it and saves that file. The
 * saved file is what Rebroadcast plays, and it holds only the on-air time.
 * A Stop tap stays stopped.
 *
 * MEET_BASE=http://127.0.0.1:8765 node test/mobile/host-offair-rec.js
 */
const { chromium, devices } = require('playwright');
const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const RELAY = process.env.MEET_RELAY || 'ws://127.0.0.1:9';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (n, c, d) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--disable-gpu', '--mute-audio'] });
  const ctx = await browser.newContext(Object.assign({}, devices['Pixel 7'], { permissions: ['camera', 'microphone'] }));
  await ctx.addInitScript({ content: "try{localStorage.setItem('gifos_relay','" + RELAY + "');localStorage.setItem('gifos_name','Hana');localStorage.setItem('gifos_meet_bar','1');sessionStorage.setItem('gifos_appear_ok','1')}catch(e){}" });
  const h = await ctx.newPage();
  const room = 'offair' + Math.floor(Math.random() * 1e9).toString(36);
  await h.goto(BASE + '/run.html');
  const av = await h.evaluate(async ([roomId, pw]) => {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode('gifos-admin:' + roomId), iterations: 310000 }, km, 256);
    const K = Array.from(new Uint8Array(bits)).map((x) => x.toString(16).padStart(2, '0')).join('');
    const V = (await GifOS.net.edKeysFromSeedHex(K)).verifier;
    localStorage.setItem('gifos_vadm_' + roomId + '.' + V, K);
    return V;
  }, [room, 'oa-' + room]);
  await h.goto(BASE + '/run.html#v=' + room + '&av=' + av + '&bc=1');
  await h.reload();
  await h.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.amAdmin() && window.__gifosVideo.onStage(), null, { timeout: 30000 });
  await sleep(1500);
  const off = await h.evaluate(() => ({
    rec: document.getElementById('airrec').textContent,
    stop: document.getElementById('recbtn').textContent,
    air: document.getElementById('onair').textContent,
  }));
  check('off air: not recording and no Stop', off.rec === 'Not recording' && !/^Stop/.test(off.stop) && /off air/i.test(off.air), off);
  const preludeAt = Date.now();
  await sleep(2000);
  const quiet = await h.evaluate(async () => ({ rec: window.__gifosVideo.recOnForTest(), saved: await window.__gifosVideo.lastServiceForTest() }));
  check('nothing is recorded while the host stays off air', quiet.rec === false && quiet.saved == null, quiet);
  const started = await h.evaluate(() => window.__gifosVideo.slipCamOnForTest());
  check('the camera can come on', started === true);
  const live = await h.waitForFunction(() => document.getElementById('airrec').textContent === 'Recording' && /^Stop/.test(document.getElementById('recbtn').textContent), null, { timeout: 15000 }).then(() => true, () => false);
  check('on air: Recording and Stop', live);
  const onAt = Date.now();
  await sleep(2500);
  await h.evaluate(() => window.__gifosVideo.slipCamOffForTest());
  const back = await h.waitForFunction(() => document.getElementById('airrec').textContent === 'Not recording' && !/^Stop/.test(document.getElementById('recbtn').textContent), null, { timeout: 15000 }).then(() => true, () => false);
  check('back off air: recording stopped', back);
  const offAt = Date.now();
  const saved = await h.evaluate(async () => window.__gifosVideo.lastServiceForTest());
  const onAirSec = (offAt - onAt) / 1000;
  const allSec = (offAt - preludeAt) / 1000;
  check('going off air saves the recording', !!(saved && saved.bytes > 1000), saved);
  check('the saved recording is only the on-air stretch', !!(saved && saved.sec > 1 && saved.sec < onAirSec + 1.5 && saved.sec < allSec - 1.5), { saved, onAirSec, allSec });
  await sleep(1500);
  const still = await h.evaluate(async () => window.__gifosVideo.lastServiceForTest());
  check('staying off air does not add to that file', !!(still && saved && still.bytes === saved.bytes && still.sec === saved.sec), still);
  await h.evaluate(() => window.__gifosVideo.slipCamOnForTest());
  await h.waitForFunction(() => /^Stop/.test(document.getElementById('recbtn').textContent), null, { timeout: 15000 });
  await h.evaluate(() => document.getElementById('recbtn').click());
  await sleep(400);
  const stopped = await h.evaluate(() => document.getElementById('airrec').textContent === 'Not recording');
  check('Stop stays stopped while the camera is still on', stopped);
  await sleep(1200);
  const stayed = await h.evaluate(() => document.getElementById('airrec').textContent === 'Not recording' && !/^Stop/.test(document.getElementById('recbtn').textContent));
  check('Stop does not start the recording again', stayed);
  await browser.close();
  console.log(fails ? fails + ' FAIL' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
