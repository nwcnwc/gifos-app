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
}

function overlap(a, b) {
  const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return ix * iy > 1;
}

test('the Fit control is 16px and clears the top chips', async ({ page }) => {
  for (const w of [1280, 900]) {
    await boot(page, w, 720);
    const fit = await page.evaluate(() => {
      const b = document.getElementById('fitbtn');
      const r = b.getBoundingClientRect();
      const others = [...document.querySelectorAll('.topchip, #gifos-build-float, .admcount > *')]
        .filter((el) => el !== b && getComputedStyle(el).display !== 'none' && el.getClientRects().length)
        .map((el) => { const o = el.getBoundingClientRect(); return { id: el.id || el.className, left: o.left, right: o.right, top: o.top, bottom: o.bottom }; });
      return { font: parseFloat(getComputedStyle(b).fontSize), h: r.height, box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, onScreen: r.right <= innerWidth + 1 && r.left >= -1, others };
    });
    expect(fit.font, 'Fit at ' + w).toBeGreaterThanOrEqual(16);
    expect(fit.h, 'Fit at ' + w).toBeGreaterThanOrEqual(44);
    expect(fit.onScreen, 'Fit at ' + w).toBe(true);
    expect(fit.others.filter((o) => overlap(o, fit.box)).map((o) => o.id), 'Fit at ' + w).toEqual([]);
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
