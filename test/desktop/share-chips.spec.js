const { test, expect } = require('@playwright/test');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

// While a desktop presents, the faces shrink to a strip of thumbnails. Every
// chip on a thumbnail must be read whole: before, the presenter's own
// "on stage" chip was cut to "on" and its muted / camera-off marks were past
// the edge, and a raised hand read "✋ hand" because the row kept room for a
// Blur for all square that a desktop only shows under the pointer.
async function boot(page, width) {
  await page.setViewportSize({ width, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=' + RUN_ROOM + 'qasharechips&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  // The seed raises the third guest's hand (Priya Shah).
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 3, connected: true }));
  expect(seeded && seeded.ok).toBe(true);
  await page.waitForFunction(() => document.querySelectorAll('#feed .tile').length >= 4);
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
  await page.click('#sharebtn');
  await expect(page.locator('#stagefeed video')).toBeVisible();
  // The pointer rests on the slide, as a presenter's does.
  await page.mouse.move(width / 2, 250);
}

// For each thumbnail: every chip, is it whole inside its row and its tile,
// and clear of the name?
function readChips(page) {
  return page.evaluate(() => {
    const inside = (a, b) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
    const hit = (a, b) => a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
    return [...document.querySelectorAll('#feed .tile')].map((t) => {
      const row = t.querySelector('.chips').getBoundingClientRect();
      const tile = t.getBoundingClientRect();
      const nameEl = t.querySelector('.name');
      const name = nameEl ? nameEl.getBoundingClientRect() : null;
      const who = nameEl ? nameEl.textContent.trim() : '?';
      const cut = [...t.querySelectorAll('.chips > span')].filter((s) => {
        const r = s.getBoundingClientRect();
        if (r.width < 1) return false;
        return !inside(r, row) || !inside(r, tile) || (name && name.width > 1 && hit(r, name));
      }).map((s) => s.textContent.trim() || s.getAttribute('aria-label'));
      return { who, cut };
    }).filter((x) => x.cut.length);
  });
}

for (const width of [1280, 960]) {
  test(`a presenter's thumbnails show every chip whole at ${width}px`, async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
    await boot(page, width);
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('screen-on'))).toBe(true);
    // Let the chips settle (stage and hand gossip repaint the strip).
    await expect.poll(() => page.evaluate(() => (document.querySelector('#feed .tile.me .chips') || {}).textContent || '')).toContain('Stop sharing');
    await page.waitForTimeout(1200);
    if (width === 1280) await page.screenshot({ path: 'test/desktop/shots/share-chips-after-1280.png' });
    expect(await readChips(page)).toEqual([]);
  });
}
