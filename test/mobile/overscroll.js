/*
 * A pull down on the meeting grid must not become Chrome pull-to-refresh.
 * The meeting page and the gallery (#feed, the surface around #grid) set
 * overscroll-behavior so that chain stops. There is no #gallery element.
 * Scroll mode still moves #feed; only the overscroll past the edge is swallowed.
 *
 * Headless Chromium here has no Android pull-to-refresh chrome, so the check
 * is the computed style Chrome consults, plus a real gallery scroll.
 *
 *   MEET_BASE=http://127.0.0.1:8984 PHASE=after node test/mobile/overscroll.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8984';
const PHASE = process.env.PHASE || 'run';
const EVIDENCE = process.env.EVIDENCE || path.join(__dirname, '..', '..', '..', '..', 'evidence', 'overscroll-1018');
const PEOPLE = [];
for (let i = 0; i < 16; i++) PEOPLE.push({ id: 'peer-os-' + i, name: 'Person ' + (i + 1) });

function okBehavior(v) {
  return v === 'none' || v === 'contain';
}

(async () => {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const phone = devices['Pixel 5'];
  const context = await browser.newContext(Object.assign({}, phone, { hasTouch: true }));
  await context.addInitScript(() => {
    try {
      localStorage.setItem('gifos_name', 'Pat');
      localStorage.setItem('meet.view.v1.gallery', 'scroll');
    } catch (e) {}
  });
  const page = await context.newPage();
  const url = BASE + '/run.html#v=overscroll-1018&DEBUG=on';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#leavebtn', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.evaluate((people) => window.__gifosVideo.presentPeers(people), PEOPLE);
  await page.waitForFunction(() => {
    const feed = document.getElementById('feed');
    return document.body.classList.contains('comfy')
      && document.body.classList.contains('gallery-scroll')
      && feed
      && feed.scrollHeight > feed.clientHeight + 40;
  }, null, { timeout: 8000 });

  const report = await page.evaluate(() => {
    const read = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        overscroll: s.overscrollBehavior,
        x: s.overscrollBehaviorX,
        y: s.overscrollBehaviorY,
        overflowY: s.overflowY,
        overflowX: s.overflowX,
      };
    };
    const feed = document.getElementById('feed');
    const grid = document.getElementById('grid');
    const doc = document.scrollingElement;
    const max = feed.scrollHeight - feed.clientHeight;
    const before = feed.scrollTop;
    feed.scrollTop = Math.max(160, Math.floor(max / 2));
    return {
      url: location.href,
      debug: /DEBUG=on/.test(location.hash),
      debugOn: !!(window.__gifosVideo && typeof window.__gifosVideo.debugDump === 'function'),
      comfy: document.body.classList.contains('comfy'),
      galleryScroll: document.body.classList.contains('gallery-scroll'),
      comfyScroll: feed.classList.contains('comfy-scroll'),
      hasGalleryId: !!document.getElementById('gallery'),
      tiles: document.querySelectorAll('#grid .tile, #feed .tile').length,
      html: read(document.documentElement),
      body: read(document.body),
      feed: read(feed),
      grid: read(grid),
      scroll: {
        before: before,
        after: feed.scrollTop,
        max: max,
        scrollH: feed.scrollHeight,
        clientH: feed.clientHeight,
        docTop: doc ? doc.scrollTop : null,
      },
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
  report.phase = PHASE;
  report.base = BASE;
  const out = path.join(EVIDENCE, PHASE + '.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  await page.screenshot({ path: path.join(EVIDENCE, PHASE + '-pixel5.png') });
  await browser.close();

  const failures = [];
  for (const name of ['html', 'body', 'feed', 'grid']) {
    const row = report[name];
    if (!row || !okBehavior(row.y)) failures.push(name + ' overscroll-behavior-y is ' + (row && row.y));
  }
  if (!report.comfy) failures.push('not in a meeting (body.comfy missing)');
  if (report.hasGalleryId) failures.push('unexpected #gallery element');
  if (!(report.scroll.after > report.scroll.before + 40)) failures.push('gallery did not scroll (' + JSON.stringify(report.scroll) + ')');
  if (report.scroll.docTop !== 0) failures.push('document scrolled with the gallery (' + report.scroll.docTop + ')');
  const oy = report.feed && report.feed.overflowY;
  if (oy !== 'auto' && oy !== 'scroll') failures.push('gallery overflow-y is ' + oy + ' (scroll must stay open)');

  if (failures.length) {
    console.error(PHASE + ' FAIL');
    failures.forEach((f) => console.error('  ' + f));
    console.error('wrote ' + out);
    process.exit(1);
  }
  console.log(PHASE + ' PASS tiles=' + report.tiles + ' feedScroll=' + report.scroll.after + '/' + report.scroll.max + ' overscroll=' + report.feed.y);
  console.log('wrote ' + out);
})().catch((e) => { console.error(e); process.exit(1); });
