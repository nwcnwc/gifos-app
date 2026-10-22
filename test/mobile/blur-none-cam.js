/*
 * Camera off, password room. The header says No blur was picked. The
 * segmented control must show No blur as the selected choice, not Min.
 * The feed stays Min until the camera is on. A minute does not change this.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/blur-none-cam.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const ROOM = RUN_ROOM + 'blur-camoff';
const LINE = 'No blur picked — turn your camera on to be ready for clear video.';

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['Pixel 7'], { hasTouch: true }));
  await context.addInitScript((room) => {
    try {
      localStorage.setItem('gifos_name', 'Nathan');
      localStorage.setItem('gifos_vpw_' + room, 'sunday');
      localStorage.setItem('gifos_vpwat_' + room, String(Date.now()));
    } catch (e) {}
  }, ROOM);
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=' + ROOM, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.waitForFunction(() => {
    const api = window.__gifosVideo;
    return api && api.pwState && api.pwState().pw === 'sunday' && api.camOff && api.camOff() === true;
  }, { timeout: 8000 });
  await page.locator('#bartoggle').tap();
  await page.locator('#blur-min').scrollIntoViewIfNeeded();
  await page.locator('#blur-min').tap();
  // More folds after a blur pick. No blur is the next pick, so the sheet opens again.
  if ((await page.locator('#bartoggle').getAttribute('aria-expanded')) !== 'true') await page.locator('#bartoggle').tap();
  await page.locator('#blur-none').scrollIntoViewIfNeeded();
  await page.locator('#blur-none').tap();
  await page.waitForTimeout(250);
  // The pick folds More. The selected fill is the one a person sees on the open sheet.
  if ((await page.locator('#bartoggle').getAttribute('aria-expanded')) !== 'true') await page.locator('#bartoggle').tap();
  const info = await page.evaluate(() => {
    const seg = (id) => {
      const el = document.getElementById(id);
      const cs = getComputedStyle(el);
      return {
        sel: el.classList.contains('sel'),
        wait: el.classList.contains('wait'),
        pressed: el.getAttribute('aria-pressed'),
        bg: cs.backgroundColor,
        color: cs.color,
      };
    };
    const api = window.__gifosVideo;
    return {
      status: document.getElementById('status').textContent,
      wish: api.myBlur(),
      feed: api.blurClassOf('me'),
      cam: api.camOff(),
      min: seg('blur-min'),
      none: seg('blur-none'),
    };
  });
  const bad = [];
  if (info.cam !== true) bad.push('camera is on');
  if (info.status !== LINE) bad.push('header "' + info.status + '"');
  if (info.wish !== 0) bad.push('choice ' + info.wish);
  if (info.feed !== 1) bad.push('feed ' + info.feed + ' (camera off stays blurred)');
  if (info.min.sel || info.min.pressed === 'true') bad.push('Min stays selected');
  if (!info.none.sel) bad.push('No blur is not the selected segment (wait ' + info.none.wait + ', bg ' + info.none.bg + ')');
  if (info.none.bg !== 'rgb(29, 29, 31)' || info.none.color !== 'rgb(255, 255, 255)') {
    bad.push('No blur selected fill is ' + info.none.bg + ' / ' + info.none.color);
  }
  const shot = bad.length ? 'before-blur-cam-pixel-7.png' : 'after-blur-cam-pixel-7.png';
  // The pick folded More. Open it again so the selected segment can be seen.
  if ((await page.locator('#bartoggle').getAttribute('aria-expanded')) !== 'true') await page.locator('#bartoggle').tap();
  await page.locator('#blurseg').scrollIntoViewIfNeeded();
  await page.locator('#blurseg').screenshot({ path: path.join(SHOTS, shot.replace('.png', '-seg.png')) });
  await page.screenshot({ path: path.join(SHOTS, shot) });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS blur none camera off');
})().catch((e) => { console.error(e); process.exit(1); });
