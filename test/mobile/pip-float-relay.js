/*
 * PiP Float and a relayed tile (Nathan, 22:45 Oct 18).
 *
 * The only floatable picture is a sponsor-forwarded peer: video is ready,
 * the direct pair is not (connected === false). A camera-off bot in the same
 * room still has frames and must never be the float. With nobody left to
 * float, Float says so instead of returning quietly.
 *
 *   MEET_BASE=http://127.0.0.1:8971 NODE_PATH=<dir with playwright> \
 *     node test/mobile/pip-float-relay.js
 *
 * PIP_EVIDENCE=/path writes result.json and the two shots there.
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8971';
const EVID = process.env.PIP_EVIDENCE || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (EVID) fs.mkdirSync(EVID, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required', '--disable-gpu', '--mute-audio'],
  });
  const context = await browser.newContext(Object.assign({}, devices['Pixel 7'], {
    hasTouch: true,
    permissions: ['camera', 'microphone'],
  }));
  await context.addInitScript({ content: "try{localStorage.setItem('gifos_name','Nathan');sessionStorage.setItem('gifos_appear_ok','1');}catch(e){}" });
  await context.addInitScript(() => {
    window.__pipAsks = 0;
    window.__pipLast = '';
    const req = HTMLVideoElement.prototype.requestPictureInPicture;
    if (req) HTMLVideoElement.prototype.requestPictureInPicture = function () {
      window.__pipAsks++;
      const t = this.closest && this.closest('[data-peer]');
      window.__pipLast = t ? t.dataset.peer : 'other';
      return req.apply(this, arguments);
    };
  });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '/run.html#v=pip-float-' + Date.now().toString(36) + '&DEBUG=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.seedGalleryForTest, null, { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});

  const bad = [];
  const arm = async (id) => {
    const armed = await page.evaluate(async (id) => {
      const v = document.querySelector('[data-peer="' + id + '"] video');
      if (!v) return { ok: false, why: 'no video' };
      const c = document.createElement('canvas');
      c.width = 320; c.height = 180;
      const x = c.getContext('2d');
      let n = 0;
      const paint = () => {
        n += 1;
        x.fillStyle = (n % 2) ? '#1d4e89' : '#16324f';
        x.fillRect(0, 0, 320, 180);
        x.fillStyle = '#f4f7fb';
        x.font = '700 28px sans-serif';
        x.fillText(id, 24, 100);
      };
      paint();
      const stream = c.captureStream(10);
      v.muted = true;
      v.srcObject = stream;
      try { await v.play(); } catch (e) {}
      window.__pipKeep = window.__pipKeep || [];
      window.__pipKeep.push(setInterval(paint, 100));
      return { ok: true };
    }, id);
    if (!armed.ok) bad.push('precondition: could not arm ' + id + ' (' + armed.why + ')');
    await page.waitForFunction((id) => {
      const v = document.querySelector('[data-peer="' + id + '"] video');
      return !!(v && v.srcObject && v.videoWidth > 0);
    }, id, { timeout: 8000 }).catch(() => bad.push('precondition: ' + id + ' video never became ready'));
  };
  const probe = () => page.evaluate(() => {
    const row = (id) => {
      const v = document.querySelector('[data-peer="' + id + '"] video');
      const tile = document.querySelector('[data-peer="' + id + '"]');
      return {
        w: v ? v.videoWidth : 0,
        stream: !!(v && v.srcObject),
        camOff: !!(tile && tile.classList.contains('cam-off')),
      };
    };
    const pip = window.__gifosVideo.pip();
    const fs = window.__gifosVideo.fsSourcesForTest().map((s) => s.key);
    const rest = document.getElementById('statusrest');
    const st = document.getElementById('status');
    const cs = rest ? getComputedStyle(rest) : null;
    const r = rest ? rest.getBoundingClientRect() : { width: 0, height: 0 };
    return {
      aimed: pip.aimed,
      active: pip.active,
      asks: window.__pipAsks,
      last: window.__pipLast,
      fs: fs,
      qa1: row('qa1'),
      qa2: row('qa2'),
      meCamOff: !!(document.querySelector('.tile.me') && document.querySelector('.tile.me').classList.contains('cam-off')),
      rest: rest ? rest.textContent : '',
      title: st ? st.title : '',
      toastShown: !!(rest && cs && cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 20 && r.height > 8),
    };
  });

  // Camera stays off. A camera-off seat, including me, is not a float target.
  const seedRelay = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({
    count: 2, connected: false, names: ['Bot Tile', 'Relay Pat'],
  }));
  if (!seedRelay || !seedRelay.ok) bad.push('precondition: seed failed ' + JSON.stringify(seedRelay));
  await page.evaluate(() => {
    window.__gifosVideo.setPeerStatusForTest('qa1', { camOff: true, bot: true, muted: true });
    window.__gifosVideo.setPeerNetForTest('qa2', { relayed: 'sponsor' });
  });
  await arm('qa1');
  await arm('qa2');
  await page.waitForFunction(() => {
    const tile = document.querySelector('[data-peer="qa1"]');
    return tile && tile.classList.contains('cam-off');
  }, null, { timeout: 4000 }).catch(() => bad.push('precondition: bot tile did not go camera-off'));

  const relay = await probe();
  if (EVID) await page.screenshot({ path: path.join(EVID, 'relay.png') });
  // fsSources lists only a direct pair. Missing there, with a ready picture,
  // is the relayed room the picker used to skip.
  if (!(relay.qa2 && relay.qa2.w > 0 && relay.qa2.stream && !relay.qa2.camOff)) bad.push('precondition: relayed peer video is not ready ' + JSON.stringify(relay.qa2));
  if (relay.fs.indexOf('peer:qa2') >= 0) bad.push('precondition: relayed peer is listed as a direct connection ' + JSON.stringify(relay.fs));
  if (!(relay.qa1 && relay.qa1.w > 0 && relay.qa1.camOff)) bad.push('precondition: bot video is not a ready camera-off tile ' + JSON.stringify(relay.qa1));
  if (!relay.meCamOff) bad.push('precondition: my camera is on, so Float can hide behind my own tile');
  if (relay.aimed !== 'peer:qa2') bad.push('Float did not aim at the relayed video (aimed ' + relay.aimed + ')');
  if (relay.aimed === 'peer:qa1') bad.push('Float aimed at the camera-off bot');

  const asks0 = relay.asks;
  await page.evaluate(() => window.__gifosVideo.pipEnterForTest().catch(() => {}));
  await sleep(400);
  const asked = await probe();
  if (asked.last !== 'qa2') bad.push('Float did not request the relayed video (last ' + JSON.stringify(asked.last) + ', aimed ' + asked.aimed + ')');
  if (asked.asks <= asks0) bad.push('Float made no picture-in-picture request for the relayed video');
  if (asked.last === 'qa1') bad.push('Float requested the camera-off bot');

  // Nothing left that may float: both seats are camera-off bots with frames.
  await page.evaluate(() => { try { if (document.pictureInPictureElement) document.exitPictureInPicture(); } catch (e) {} });
  await page.evaluate(() => window.__gifosVideo.setPeerStatusForTest('qa2', { camOff: true, bot: true, muted: true }));
  await page.waitForFunction(() => {
    const tile = document.querySelector('[data-peer="qa2"]');
    return tile && tile.classList.contains('cam-off');
  }, null, { timeout: 4000 }).catch(() => bad.push('precondition: relayed tile did not go camera-off'));
  const dark = await probe();
  if (dark.aimed) bad.push('a camera-off bot was still the float target (' + dark.aimed + ')');
  const asks1 = dark.asks;
  await page.evaluate(() => window.__gifosVideo.pipEnterForTest().catch(() => {}));
  await sleep(300);
  const toast = await probe();
  if (EVID) await page.screenshot({ path: path.join(EVID, 'toast.png') });
  if (toast.rest !== 'Nothing to float yet.') bad.push('no toast when nothing can float (rest ' + JSON.stringify(toast.rest) + ', title ' + JSON.stringify(toast.title) + ')');
  if (!toast.toastShown) bad.push('the toast is not visible on the phone chip');
  if (toast.asks !== asks1) bad.push('Float still requested a picture when only camera-off bots were left');
  if (toast.aimed) bad.push('Float still had a target after every seat went camera-off (' + toast.aimed + ')');
  if (errs.length) bad.push('page errors: ' + errs.join(' | '));

  const out = { seedRelay, relay, asked, dark, toast, bad };
  console.log(JSON.stringify(out));
  if (EVID) fs.writeFileSync(path.join(EVID, 'result.json'), JSON.stringify(out, null, 2));
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS pip float relayed video');
})().catch((e) => { console.error(e); process.exit(1); });
