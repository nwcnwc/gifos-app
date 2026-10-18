const { test, expect } = require('@playwright/test');

// Questions while presenting: a presenter (and everyone else) on a desktop can
// read who has a hand up, in order, and the shared slide is not under the
// header. Before, the queue line sat behind the gallery, or half under the
// header at 12.8px during a share, and the header covered the slide's top.
async function boot(page, width) {
  await page.setViewportSize({ width, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qahandq&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  // The seed raises the third guest's hand (Priya Shah).
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 3, connected: true }));
  expect(seeded && seeded.ok).toBe(true);
  await page.waitForFunction(() => document.querySelectorAll('#feed .tile').length >= 4);
  await expect.poll(() => page.evaluate(() => document.getElementById('handq').textContent)).toContain('Priya Shah');
  // Park the pointer on the faces, away from the dock.
  await page.mouse.move(width / 2, 200);
}

async function armSlide(page) {
  await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 720;
    const x = c.getContext('2d');
    x.fillStyle = '#f7f4ec';
    x.fillRect(0, 0, 1280, 720);
    x.fillStyle = '#14203a';
    x.font = '700 80px Georgia, serif';
    x.fillText('Q3 plan', 72, 200);
    const stream = c.captureStream(8);
    navigator.mediaDevices.getDisplayMedia = () => Promise.resolve(stream);
  });
}

// Reads the queue the way a person does: is each name on top at its own spot,
// big enough, on screen, and clear of the header, Fit, the build label, the
// faces, the slide, and Stop sharing.
function readQueue(page) {
  return page.evaluate(() => {
    const q = document.getElementById('handq');
    const rect = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.5) return null;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 ? r : null;
    };
    const hit = (a, b) => !!(a && b && a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1);
    const qr = rect(q);
    const names = [...q.querySelectorAll('.hq')].map((s) => {
      const r = s.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + Math.min(8, r.width / 2), r.top + r.height / 2);
      return { name: s.textContent.trim(), onTop: !!(top && q.contains(top)) };
    });
    const others = {
      header: rect(document.querySelector('.topchip')),
      fit: rect(document.getElementById('fitbtn')),
      build: rect(document.getElementById('gifos-build-float')),
      slide: rect(document.querySelector('#stagefeed video')),
      stop: rect(document.querySelector('#stagefeed .stagestop')),
    };
    const covers = Object.keys(others).filter((k) => hit(qr, others[k]));
    const tiles = [...document.querySelectorAll('#feed .tile')].filter((t) => hit(qr, rect(t))).length;
    const slideUnderHeader = hit(others.slide, others.header);
    return {
      shown: !!qr,
      text: q.textContent.trim(),
      font: qr ? parseFloat(getComputedStyle(q).fontSize) : 0,
      onScreen: !!(qr && qr.top >= 0 && qr.left >= 0 && qr.right <= innerWidth && qr.bottom <= innerHeight),
      names,
      covers,
      tiles,
      slideUnderHeader,
    };
  });
}

function expectReadable(got, who) {
  expect(got.shown).toBe(true);
  expect(got.text).toContain(who);
  expect(got.font).toBeGreaterThanOrEqual(16);
  expect(got.onScreen).toBe(true);
  expect(got.names.find((n) => n.name === who)).toMatchObject({ onTop: true });
  expect(got.covers).toEqual([]);
  expect(got.tiles).toBe(0);
}

test('a desktop gallery shows who has a hand up, readable and on top', async ({ context }) => {
  let page;
  // A fresh page per width: a second goto to the same #hash does not reload in Firefox.
  for (const width of [1280, 960]) {
    page = await context.newPage();
    await boot(page, width);
    const got = await readQueue(page);
    if (width === 1280) await page.screenshot({ path: 'test/desktop/shots/hand-queue-gallery-after-1280.png' });
    expectReadable(got, 'Priya Shah');
  }
  // A quiet call fades the header, but a raised hand stays in view.
  await page.evaluate(() => {
    const set = window.__gifosVideo.setDockCalmMsForTest;
    if (set) set(300);
  });
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('dock-calm'))).toBe(true);
  expectReadable(await readQueue(page), 'Priya Shah');
});

test('a presenter reads the hand queue, and the header is off the slide', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await boot(page, 1280);
  // A share is clear only in a consented password room (0.9.23b blur rules);
  // the seeded faces consent and the hook stands in for the password.
  expect(await page.evaluate(() => window.__gifosVideo.setClearForTest(true))).toBe(0);
  await armSlide(page);
  await page.click('#sharebtn');
  await expect(page.locator('#stagefeed video')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (document.querySelector('#stagefeed video') || {}).videoWidth || 0)).toBeGreaterThanOrEqual(640);
  const got = await readQueue(page);
  await page.screenshot({ path: 'test/desktop/shots/hand-queue-share-after-1280.png' });
  expectReadable(got, 'Priya Shah');
  expect(got.slideUnderHeader).toBe(false);
});

// The hand line says hands are up, not "waiting": a waiting room now holds
// people who are not yet in, and a host's roster lists them under Waiting, so
// "✋ 1 waiting: Priya Shah" read as if Priya were held outside. It follows
// German and Spanish like the hand chip on her face.
const HAND_WORDS = [
  { lang: 'en-US', one: '✋ 1 hand up: Priya Shah', two: /^✋ 2 hands up: /, chip: 'hand raised' },
  { lang: 'de-DE', one: '✋ 1 Hand oben: Priya Shah', two: /^✋ 2 Hände oben: /, chip: 'Hand gehoben' },
  { lang: 'es-ES', one: '✋ 1 mano levantada: Priya Shah', two: /^✋ 2 manos levantadas: /, chip: 'mano levantada' },
];
for (const w of HAND_WORDS) {
  test.describe('hand line in ' + w.lang, () => {
    test.use({ locale: w.lang });
    test('the hand line says hands up, not waiting (' + w.lang + ')', async ({ page }) => {
      await boot(page, 1280);
      const one = (await readQueue(page)).text;
      // Shot before the first check, so a failing run still leaves its picture.
      if (w.lang === 'en-US') await page.screenshot({ path: 'test/desktop/shots/hand-words-' + (process.env.HAND_WORDS_PHASE || 'after') + '-1280.png' });
      if (w.lang === 'de-DE') await page.screenshot({ path: 'test/desktop/shots/hand-words-' + (process.env.HAND_WORDS_PHASE || 'after') + '-de-1280.png' });
      expect(one).not.toMatch(/waiting/i);
      expect(one).toBe(w.one);
      // Line and chip in ONE read: a seeded face's chip can drop a few seconds
      // in once the relay says "reconnecting" (Firefox), so a later separate
      // read of the chip measured the seed, not the words.
      await expect.poll(() => page.evaluate((chip) => ({
        line: document.getElementById('handq').textContent,
        chips: [...document.querySelectorAll('#feed .tile .chips')].filter((c) => c.textContent.includes(chip)).length,
      }), w.chip), { timeout: 2000 }).toEqual({ line: w.one, chips: 1 });
      await page.evaluate(() => window.__gifosVideo.raiseHand(true));
      await expect.poll(async () => (await readQueue(page)).text).toMatch(w.two);
      expectReadable(await readQueue(page), 'Priya Shah');
    });
  });
}
