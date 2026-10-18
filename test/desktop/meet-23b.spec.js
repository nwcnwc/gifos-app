const { test, expect } = require('@playwright/test');

// The 0.9.23b meeting: square Row tiles, calm by default, tap a tile for its
// controls (it grows in place), pan/zoom/crop, Pin to your own Stage, and
// one Full screen.
async function boot(page, remotes, size) {
  await page.setViewportSize(size || { width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
    localStorage.removeItem('meet.vcrop.v1');
    localStorage.removeItem('meet.crop.v1.self');
  });
  await page.goto('/run.html#v=qa23b' + Date.now().toString(36) + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  const seeded = await page.evaluate((n) => window.__gifosVideo.seedGalleryForTest({ count: n }), remotes);
  expect(seeded && seeded.ok).toBe(true);
  await page.waitForFunction((n) => document.querySelectorAll('#feed .tile[data-comfy="1"]').length >= n + 1, remotes);
  await page.evaluate(() => window.__meetRelayout && window.__meetRelayout());
}
const rects = (page) => page.evaluate(() => [...document.querySelectorAll('#feed .tile[data-comfy="1"]')]
  .filter((t) => t.getClientRects().length).map((t) => { const r = t.getBoundingClientRect(); return { id: t.dataset.peer, w: r.width, h: r.height, x: r.x, y: r.y }; }));
// Seen: laid out, not hidden, and its effective opacity (with every ancestor's) above 5%.
const shown = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].some((e) => {
  const cs = getComputedStyle(e);
  if (!e.getClientRects().length || cs.display === 'none' || cs.visibility === 'hidden') return false;
  let op = 1;
  for (let x = e; x && x.nodeType === 1; x = x.parentElement) op *= Number(getComputedStyle(x).opacity);
  return op > 0.05;
}), sel);

test('Row tiles are squares that never overlap, in Fit, for 1 to 8 people', async ({ page }) => {
  for (const n of [1, 3, 5, 8]) {
    await boot(page, n);
    const rs = await rects(page);
    expect(rs.length).toBe(n + 1);
    for (const r of rs) expect(Math.abs(r.w - r.h)).toBeLessThan(1.5);
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      expect(a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5 || a.y + a.h <= b.y + 0.5 || b.y + b.h <= a.y + 0.5).toBe(true);
    }
  }
});

test('calm by default: after 3 s only names and the speaking frame show; a move brings the info back', async ({ page }) => {
  await boot(page, 3);
  await page.mouse.move(640, 200);
  await page.waitForTimeout(3600);
  expect(await page.evaluate(() => document.body.classList.contains('meet-awake'))).toBe(false);
  expect(await shown(page, '#feed .tile > .chips span')).toBe(false);
  expect(await shown(page, '#feed .tile .name')).toBe(true);
  await page.mouse.move(660, 220);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('meet-awake'))).toBe(true);
  // Per-person buttons never sit on a tile, awake or calm.
  expect(await shown(page, '#feed .tile > .blurbox, #feed .tile .modbar button')).toBe(false);
});

test('tap a tile: it becomes its control window, one picture of the person, and its spot keeps a placeholder', async ({ page, browserName }) => {
  await boot(page, 3);
  const before = (await rects(page)).find((r) => r.id === 'qa2');
  await page.mouse.click(before.x + before.w / 2, before.y + before.h / 2);
  await expect(page.locator('#tilewin')).toBeVisible();
  const st = await page.evaluate(() => {
    const t = document.querySelector('.tile[data-peer="qa2"]'); const r = t.getBoundingClientRect();
    const v = t.querySelector(':scope > video');
    return { w: r.width, away: t.classList.contains('tw-away'), tileVideoHidden: getComputedStyle(v).visibility === 'hidden',
      winVideos: document.querySelectorAll('#tilewin video').length };
  });
  // The tile does not grow: the person is in the window, and the spot stays.
  expect(Math.round(st.w)).toBe(Math.round(before.w));
  expect(st.away).toBe(true);
  expect(st.tileVideoHidden).toBe(true);
  expect(st.winVideos).toBe(browserName === 'webkit' ? 0 : 1);
  await expect(page.locator('#tilewin .tw-name')).toContainText(/\S/);
  await expect(page.locator('#tilewin', { hasText: 'Pin' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#tilewin')).toBeHidden();
  expect(await page.evaluate(() => document.querySelector('.tile[data-peer="qa2"]').classList.contains('tw-away'))).toBe(false);
});

test('the meeting always says it is being transcribed, also when calm', async ({ page }) => {
  await boot(page, 2);
  await expect(page.locator('#txmark')).toBeVisible();
  await page.mouse.move(640, 200);
  await page.waitForTimeout(3600);
  await page.evaluate(() => { const f = window.__gifosVideo.setDockCalmMsForTest; if (f) f(300); });
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('head-calm'))).toBe(true);
  await expect.poll(() => shown(page, '.topchip #status')).toBe(false);
  expect(await shown(page, '#txmark')).toBe(true);
});

test('a viewer crop is local: it zooms that tile on this screen only and sends nothing', async ({ page, browserName }) => {
  await boot(page, 2);
  const t = (await rects(page)).find((r) => r.id === 'qa1');
  await page.mouse.click(t.x + t.w / 2, t.y + t.h / 2);
  await expect(page.locator('#tilewin')).toBeVisible();
  const hasPad = await page.locator('#tilewin .tw-pad').count();
  if (browserName === 'webkit') { expect(hasPad).toBe(0); return; } // a seeded face has no video there
  expect(hasPad).toBe(1);
  await page.evaluate(() => { const r = document.querySelector('#tilewin input[type=range]'); r.value = '50'; r.dispatchEvent(new Event('input')); });
  await page.keyboard.press('Escape');
  const st = await page.evaluate(() => ({
    saved: JSON.parse(localStorage.getItem('meet.vcrop.v1') || '{}'),
    vcrop: document.querySelector('.tile[data-peer="qa1"]').dataset.vcrop,
    vw: document.querySelector('.tile[data-peer="qa1"] > video').getBoundingClientRect().width,
    tw: document.querySelector('.tile[data-peer="qa1"]').getBoundingClientRect().width,
    sender: window.__senderCrop.get(),
  }));
  expect(st.saved['peer:qa1'].s).toBeCloseTo(0.5, 2);
  expect(st.vcrop).toBe('1');
  expect(st.vw).toBeGreaterThan(st.tw * 1.5);
  expect(st.sender).toBe(null);
});

test('Pin puts that person on my own Stage at the true aspect of their video', async ({ page, browserName }) => {
  await boot(page, 3);
  const t = (await rects(page)).find((r) => r.id === 'qa3');
  await page.mouse.click(t.x + t.w / 2, t.y + t.h / 2);
  await page.locator('#tilewin button', { hasText: 'Pin' }).click();
  await expect(page.locator('#tilewin')).toBeHidden();
  const r = await page.evaluate(() => { const e = document.querySelector('.tile[data-peer="qa3"]'); const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, fit: e.dataset.fit }; });
  expect(r.fit).toBe('contain');
  if (browserName !== 'webkit') expect(r.w / r.h).toBeCloseTo(16 / 9, 1);
  const others = (await rects(page)).filter((x) => x.id !== 'qa3');
  for (const o of others) expect(Math.abs(o.w - o.h)).toBeLessThan(1.5);
});

test('one Full screen button: the dock, and it takes the whole page', async ({ page, browserName }) => {
  await boot(page, 2);
  await page.mouse.move(640, 300);
  const labels = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden'
    && /full screen/i.test(b.getAttribute('aria-label') || b.title || b.textContent)).map((b) => b.id));
  expect(labels).toEqual(['fsbtn']);
  await page.click('#fsbtn');
  if (browserName === 'chromium') {
    await expect.poll(() => page.evaluate(() => document.fullscreenElement && document.fullscreenElement.tagName)).toBe('HTML');
    await page.click('#fsbtn');
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  } else {
    // An engine with no element full screen in headless gets the in-page view.
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement || document.getElementById('fsview').classList.contains('on'))).toBe(true);
  }
});
