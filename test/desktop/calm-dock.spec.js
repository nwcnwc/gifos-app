const { test, expect } = require('@playwright/test');

// A small call is a room, not a product: once nobody touches the mouse or the
// keys, the dock fades and only faces are left. Any move or key brings it back.
async function boot(page, remotes) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qacalm&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  if (remotes) {
    const seeded = await page.evaluate((n) => window.__gifosVideo.seedGalleryForTest({ count: n }), remotes);
    expect(seeded && seeded.ok).toBe(true);
    await page.waitForFunction((n) => document.querySelectorAll('#feed .tile').length >= n + 1, remotes);
  }
  // Park the pointer on the faces, away from the dock.
  await page.mouse.move(640, 200);
}

// Waits out a short idle with no input, then reads the dock. The quiet time is
// shortened so the suite does not sit for the real delay.
async function idleThenRead(page, ms) {
  return page.evaluate(async (wait) => {
    const set = window.__gifosVideo.setDockCalmMsForTest;
    if (set) set(300);
    await new Promise((r) => setTimeout(r, wait));
    const bar = document.querySelector('.bar');
    const cs = getComputedStyle(bar);
    return {
      calm: document.body.classList.contains('dock-calm'),
      opacity: Number(cs.opacity),
      clicks: cs.pointerEvents !== 'none',
    };
  }, ms);
}

test('a quiet small call fades the dock, and a move brings it back', async ({ page }) => {
  await boot(page, 2);
  const tilesBefore = await page.evaluate(() => [...document.querySelectorAll('#feed .tile')].map((t) => t.getBoundingClientRect().y));
  const quiet = await idleThenRead(page, 2000);
  expect(quiet.calm).toBe(true);
  expect(quiet.opacity).toBeLessThan(0.05);
  expect(quiet.clicks).toBe(false);
  // Faces do not jump when the dock goes.
  const tilesAfter = await page.evaluate(() => [...document.querySelectorAll('#feed .tile')].map((t) => t.getBoundingClientRect().y));
  expect(tilesAfter).toEqual(tilesBefore);
  await page.screenshot({ path: 'test/desktop/shots/calm-dock-after-1280.png' });

  await page.mouse.move(700, 260);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('dock-calm'))).toBe(false);
  await expect.poll(() => page.evaluate(() => Number(getComputedStyle(document.querySelector('.bar')).opacity))).toBeGreaterThan(0.95);
});

test('a key brings the dock back, and Tab on the dock keeps it', async ({ page }) => {
  await boot(page, 2);
  expect((await idleThenRead(page, 2000)).calm).toBe(true);
  await page.keyboard.press('Shift');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('dock-calm'))).toBe(false);
  await page.focus('#mic');
  expect((await idleThenRead(page, 2000)).calm).toBe(false);
});

test('the dock stays while More is open or the pointer rests on it', async ({ page }) => {
  await boot(page, 2);
  await page.click('#bartoggle');
  await page.mouse.move(640, 200);
  expect((await idleThenRead(page, 2000)).calm).toBe(false);
  await page.click('#bartoggle');
  const mic = await page.locator('#mic').boundingBox();
  await page.mouse.move(mic.x + mic.width / 2, mic.y + mic.height / 2);
  expect((await idleThenRead(page, 2000)).calm).toBe(false);
});

test('alone, or with a big room, the dock stays', async ({ page }) => {
  await boot(page, 0);
  expect((await idleThenRead(page, 2000)).calm).toBe(false);
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 7 }));
  await page.waitForFunction(() => document.querySelectorAll('#feed .tile').length >= 8);
  expect((await idleThenRead(page, 2000)).calm).toBe(false);
});
