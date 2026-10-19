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

// 0.9.23b: alone keeps the dock (Invite); every room of two or more is calm.
test('alone the dock stays; a big room goes calm too', async ({ page }) => {
  await boot(page, 0);
  expect((await idleThenRead(page, 2000)).calm).toBe(false);
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 7 }));
  await page.waitForFunction(() => document.querySelectorAll('#feed .tile').length >= 8);
  await page.mouse.move(640, 200);
  expect((await idleThenRead(page, 2000)).calm).toBe(true);
});

// Calm means faces only: per-person buttons never sit on a tile (they live in
// the tile's control window), and the badges go with the dock. Names stay.
test('a quiet small call keeps the names and shows no tile buttons', async ({ page }) => {
  await boot(page, 2);
  const read = () => page.evaluate(() => {
    const shown = (el) => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      let op = 1;
      for (let x = el; x && x.nodeType === 1; x = x.parentElement) op *= Number(getComputedStyle(x).opacity);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && op > 0.05 && r.width > 1;
    };
    const tiles = [...document.querySelectorAll('#feed .tile:not(.me)')];
    return {
      blur: tiles.filter((t) => shown(t.querySelector(':scope > .blurbox'))).length,
      mod: tiles.filter((t) => shown(t.querySelector('.modbar button:not([hidden])'))).length,
      chips: tiles.filter((t) => shown(t.querySelector(':scope > .chips span'))).length,
      names: tiles.filter((t) => shown(t.querySelector('.name'))).length,
      n: tiles.length,
    };
  });
  const awake = await read();
  expect(awake.blur + awake.mod).toBe(0);
  expect((await idleThenRead(page, 3500)).calm).toBe(true);
  await page.waitForTimeout(800);
  const quiet = await read();
  await page.screenshot({ path: 'test/desktop/shots/calm-tiles-after-1280.png' });
  expect(quiet.blur + quiet.mod + quiet.chips).toBe(0);
  expect(quiet.names).toBe(quiet.n);
});

// Calm is a room, not a product: the logo and the build label go with the
// dock. The room line stays fully up — it is the tap that opens the full
// sentence, and fading it left the chip taking that tap (bafc6b1). A notice
// on that line is still read while the dock stays down.
test('a quiet small call fades the logo and build label, and the room line stays', async ({ page }) => {
  await boot(page, 2);
  await page.waitForSelector('#gifos-build-float');
  const read = () => page.evaluate(() => {
    const op = (el) => (el ? Number(getComputedStyle(el).opacity) : -1);
    const status = document.getElementById('status');
    const r = status.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + Math.min(r.width / 2, 24), r.top + r.height / 2);
    return {
      chip: op(status),
      mark: op(document.getElementById('txmark')),
      title: op(document.querySelector('.topchip .title')),
      build: op(document.getElementById('gifos-build-float')),
      // The room line itself receives the tap, not the faded chip behind it.
      statusHit: !!(hit && hit.closest && hit.closest('#status')),
      count: document.getElementById('statuscount').textContent,
    };
  });
  const awake = await read();
  expect(awake.chip).toBeGreaterThan(0.95);
  expect(awake.title).toBeGreaterThan(0.95);
  expect(awake.build).toBeGreaterThan(0.95);
  await page.screenshot({ path: 'test/desktop/shots/calm-head-before-1280.png' });
  expect((await idleThenRead(page, 2000)).calm).toBe(true);
  await page.waitForTimeout(1000);
  const quiet = await read();
  await page.screenshot({ path: 'test/desktop/shots/calm-head-after-1280.png' });
  expect(quiet.chip).toBeGreaterThan(0.95);
  expect(quiet.mark).toBeGreaterThan(0.95);
  expect(quiet.title).toBeLessThan(0.05);
  expect(quiet.build).toBeLessThan(0.05);
  expect(quiet.statusHit).toBe(true);

  // A notice arrives while calm: the header comes back for it, the dock does not.
  await page.evaluate(() => window.__gifosVideo.statusNoticeForTest('Camera stopped — bringing it back'));
  await expect.poll(async () => (await read()).chip).toBeGreaterThan(0.95);
  expect(await page.evaluate(() => document.body.classList.contains('dock-calm'))).toBe(true);

  await page.mouse.move(700, 260);
  await expect.poll(async () => (await read()).build).toBeGreaterThan(0.95);
});
