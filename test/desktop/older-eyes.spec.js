const { test, expect } = require('@playwright/test');

async function boot(page, width, height) {
  await page.setViewportSize({ width: width, height: height });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qaeyes&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4 }));
  expect(seeded && seeded.ok).toBe(true);
  // The tile buttons arrive once the gallery has settled.
  await page.waitForFunction(() => [...document.querySelectorAll('#feed .tile .blurbox')].filter((el) => el.getClientRects().length).length >= 4);
}

function overlap(a, b) {
  const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return ix * iy > 1;
}

test('the Fit control is 16px and clears the top chips and tile buttons', async ({ context }) => {
  for (const w of [1280, 900]) {
    // A fresh page per width: Firefox treats a second goto to the same URL as a hash change.
    const page = await context.newPage();
    await boot(page, w, 720);
    const fit = await page.evaluate(() => {
      const b = document.getElementById('fitbtn');
      const r = b.getBoundingClientRect();
      const others = [...document.querySelectorAll('.topchip, #gifos-build-float, .admcount > *, #feed .tile button, #feed .tile .name')]
        .filter((el) => el !== b && getComputedStyle(el).display !== 'none' && el.getClientRects().length)
        .map((el) => { const o = el.getBoundingClientRect(); return { id: el.id || el.className, left: o.left, right: o.right, top: o.top, bottom: o.bottom }; });
      return { font: parseFloat(getComputedStyle(b).fontSize), h: r.height, box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, onScreen: r.right <= innerWidth + 1 && r.left >= -1, others };
    });
    expect(fit.font, 'Fit at ' + w).toBeGreaterThanOrEqual(16);
    expect(fit.h, 'Fit at ' + w).toBeGreaterThanOrEqual(44);
    expect(fit.onScreen, 'Fit at ' + w).toBe(true);
    expect(fit.others.filter((o) => overlap(o, fit.box)).map((o) => o.id), 'Fit at ' + w).toEqual([]);
    await page.close();
  }
});

test('every word in the open More sheet is 16px', async ({ page }) => {
  await boot(page, 1280, 720);
  await page.click('#bartoggle');
  await page.click('#moretools');
  const small = await page.evaluate(() => {
    const out = [];
    const walk = document.createTreeWalker(document.getElementById('barmore'), NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const t = n.textContent.trim();
      const el = n.parentElement;
      if (!t || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      if (parseFloat(cs.fontSize) < 16) out.push(t + ' ' + cs.fontSize);
    }
    return out;
  });
  expect(small).toEqual([]);
  const heads = await page.evaluate(() => [...document.querySelectorAll('#barmore .moregroup h4')]
    .filter((h) => getComputedStyle(h.closest('.moregroup')).display !== 'none')
    .map((h) => ({ t: h.textContent.trim(), caps: getComputedStyle(h).textTransform })));
  expect(heads.length).toBe(4);
  for (const h of heads) expect(h.caps, h.t).toBe('none');
});

test('Fit does not cover Stop sharing on a shared slide', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await boot(page, 1280, 720);
  await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 720;
    const x = c.getContext('2d');
    x.fillStyle = '#f7f4ec';
    x.fillRect(0, 0, 1280, 720);
    const stream = c.captureStream(8);
    navigator.mediaDevices.getDisplayMedia = () => Promise.resolve(stream);
  });
  await page.click('#sharebtn');
  await expect(page.locator('#stagefeed .stagestop')).toBeVisible();
  const hit = await page.evaluate(() => {
    const stop = document.querySelector('#stagefeed .stagestop');
    const s = stop.getBoundingClientRect();
    const f = document.getElementById('fitbtn').getBoundingClientRect();
    const at = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2);
    const ix = Math.max(0, Math.min(s.right, f.right) - Math.max(s.left, f.left));
    const iy = Math.max(0, Math.min(s.bottom, f.bottom) - Math.max(s.top, f.top));
    return { onTop: !!at && (at === stop || stop.contains(at)), overlap: ix * iy > 1, stop: [s.left, s.top, s.right, s.bottom].map(Math.round), fit: [f.left, f.top, f.right, f.bottom].map(Math.round) };
  });
  expect(hit.overlap, JSON.stringify(hit)).toBe(false);
  expect(hit.onTop, JSON.stringify(hit)).toBe(true);
  await page.click('#stagefeed .stagestop');
  await expect(page.locator('#stagefeed video')).toHaveCount(0);
});
