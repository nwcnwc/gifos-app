/*
 * 0.9.23b Stage promotion, on a phone and on a desktop:
 * - off the Stage my picture leaves as my saved square crop
 * - stepping on opens my window on "Frame what the Stage shows", whole on
 *   the screen, and my picture leaves as the whole camera at its own shape
 * - dragging the frame's corner changes the shape that leaves (not square)
 * - stepping off puts the saved square back
 * - on the Stage my seat stays in the Row with no video and no initials
 *   (the Stage strip shows me), and the video comes back when I step off
 *
 *   NODE_PATH=<playwright> node test/mobile/stage-frame.js
 */
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const CASES = [
  ['iphone-15', devices['iPhone 15']],
  ['iphone-se-land', devices['iPhone SE landscape']],
  ['pixel-7', devices['Pixel 7']],
  ['desktop', { viewport: { width: 1280, height: 720 } }],
];
const near = (a, b, e) => Math.abs(a - b) <= e;

// Where I am: my Row tile laid out or not, and the Stage strip showing.
const whereAmI = (page) => page.evaluate(() => {
  const me = document.querySelector('#feed .tile.me, #grid .tile.me');
  const sgs = document.querySelector('#stagefeed [data-row="sgs"]');
  const v = sgs && sgs.querySelector('video');
  const laid = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
  const vid = me && me.querySelector('video');
  const av = me && me.querySelector('.avatar');
  const vcs = vid ? getComputedStyle(vid) : null;
  const acs = av ? getComputedStyle(av) : null;
  return {
    tile: laid(me) && !me.classList.contains('comfy-off'),
    held: !!(me && me.classList.contains('seat-held')),
    video: !!(vid && vcs && vcs.visibility !== 'hidden' && vcs.display !== 'none' && +vcs.opacity > 0.05),
    initials: !!(av && acs && acs.display !== 'none' && (av.textContent || '').trim()),
    stage: laid(sgs) && !!(v && v.srcObject),
  };
});
async function settle(page, want) {
  const end = Date.now() + 8000; let w;
  const keys = Object.keys(want);
  do { w = await whereAmI(page); if (keys.every((k) => w[k] === want[k])) return w; await page.waitForTimeout(200); } while (Date.now() < end);
  return w;
}

async function shape(page) {
  await page.waitForTimeout(700);
  return page.evaluate(() => window.__gifosVideo.sentShapeForTest());
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const bad = [];
  for (const [tag, device] of CASES) {
    const ctx = await browser.newContext(Object.assign({}, device, { permissions: ['camera', 'microphone'] }));
    await ctx.addInitScript(() => {
      localStorage.setItem('gifos_name', 'Nathan'); sessionStorage.setItem('gifos_appeared', '1');
      localStorage.removeItem('meet.frame.v1.stage');
      localStorage.setItem('meet.crop.v1.self', JSON.stringify({ x: 0.45, y: 0.5, s: 0.8 }));
    });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(BASE + '/run.html#v=qasf' + Date.now().toString(36) + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#cam', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.getElementById('cam').click());
    await page.waitForFunction(() => window.__gifosVideo.sentShapeForTest(), null, { timeout: 15000 }).catch(() => {});
    let s = await shape(page);
    if (!s) { bad.push(tag + ': no outgoing picture with the camera on'); await ctx.close(); continue; }
    if (s.w !== s.h) bad.push(tag + ': off the Stage the picture is ' + s.w + 'x' + s.h + ', not the saved square');
    const camA = s.camW / s.camH;
    let at = await whereAmI(page);
    if (!at.tile) bad.push(tag + ': off the Stage my tile is not in the Row ' + JSON.stringify(at));
    // A step-up in the first seconds of a join is a rejoin, not a promotion.
    await page.waitForTimeout(3500);
    if (!(await page.evaluate(() => window.__gifosVideo.stageForTest(true)))) { bad.push(tag + ': could not step on the Stage'); await ctx.close(); continue; }
    try { await page.locator('#tilewin .tw-stageframe').waitFor({ state: 'visible', timeout: 6000 }); }
    catch (e) { bad.push(tag + ': stepping on did not open "Frame what the Stage shows"'); }
    await page.waitForTimeout(600);
    at = await settle(page, { tile: true, stage: true, held: true, video: false, initials: false });
    if (!at.tile || !at.held || at.video || at.initials || !at.stage) bad.push(tag + ': on the Stage my seat should stay, with no video and no initials, while the Stage shows me ' + JSON.stringify(at));
    const onScreen = await page.evaluate(() => { const w = document.getElementById('tilewin'); if (!w) return false; const r = w.getBoundingClientRect(); return r.width > 0 && r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5; });
    if (!onScreen) bad.push(tag + ': the framing window runs off the screen');
    s = await shape(page);
    if (!s || !near(s.w / s.h, camA, 0.03)) bad.push(tag + ': on the Stage the picture is ' + (s && s.w + 'x' + s.h) + ', not the whole camera (' + s.camW + 'x' + s.camH + ')');
    // Drag the frame's corner in: narrower than tall, so the shape changes.
    const g = await page.locator('#tilewin .tw-stageframe .tw-rect').boundingBox();
    if (g) {
      const x0 = g.x + g.width - 4, y0 = g.y + g.height - 4;
      const x1 = x0 - g.width * 0.5, y1 = y0 - g.height * 0.1;
      if (tag !== 'desktop') {
        // A finger, as on the phone.
        const cdp = await ctx.newCDPSession(page);
        const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: type === 'touchEnd' ? [] : [{ x: x, y: y }] });
        await touch('touchStart', x0, y0);
        for (let i = 1; i <= 6; i++) { await touch('touchMove', x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6); await page.waitForTimeout(16); }
        await touch('touchEnd');
      } else {
        await page.mouse.move(x0, y0); await page.mouse.down();
        await page.mouse.move(x1, y1, { steps: 6 }); await page.mouse.up();
      }
      await page.waitForTimeout(400);
      const f = await page.evaluate(() => window.__stageFrame.get());
      s = await shape(page);
      if (!f) bad.push(tag + ': dragging the corner did not change the Stage frame');
      else if (!s || !near(s.w / s.h, (f.w * s.camW) / (f.h * s.camH), 0.04)) bad.push(tag + ': the framed picture is ' + (s && s.w + 'x' + s.h) + ', not the frame ' + JSON.stringify(f));
      else if (near(s.w, s.h, 2)) bad.push(tag + ': the framed picture came out square');
    } else bad.push(tag + ': no frame to drag');
    await page.screenshot({ path: '/tmp/stage-frame-' + tag + '.png' });
    await page.evaluate(() => { window.__tileWin.close(); window.__gifosVideo.stageForTest(false); });
    s = await shape(page);
    at = await settle(page, { tile: true, stage: false, held: false, video: true, initials: false });
    if (!at.tile || at.held || !at.video || at.initials) bad.push(tag + ': after stepping off my video is not back in the same seat ' + JSON.stringify(at));
    if (!s || s.w !== s.h) bad.push(tag + ': after stepping off the picture is ' + (s && s.w + 'x' + s.h) + ', not the saved square');
    if (errs.length) bad.push(tag + ': page error ' + errs[0].slice(0, 160));
    await ctx.close();
  }
  await browser.close();
  if (bad.length) { console.log('FAIL\n' + bad.join('\n')); process.exit(1); }
  console.log('PASS the Stage sends the whole camera, framed at any shape, my seat stays with no video or initials while on the Stage, and the square and the video come back after, on ' + CASES.map((c) => c[0]).join(', '));
})().catch((e) => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
