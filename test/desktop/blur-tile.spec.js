const { test, expect } = require('@playwright/test');
const { clearRoom } = require('../mobile/lib/clear-room');

// A clear room needs this page's camera on too (clearRoom).
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['camera', 'microphone'] });

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qablur&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: true }));
  // Blur for all shows only on a clear face: lock the room, faces clear.
  expect(await clearRoom(page, ['qa1', 'qa2'])).toBe(true);
  await page.waitForSelector('.tile > .blurbox.on');
}

test('Blur for all is a square inset from the tile corner', async ({ page }) => {
  await boot(page);
  const info = await page.evaluate(() => {
    function gap(a, b) {
      if (!a || !b || b.w < 2 || b.h < 2) return 999;
      return Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
    }
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2) return null;
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height };
    };
    return Array.from(document.querySelectorAll('.tile > .blurbox')).map((el) => {
      const tile = el.closest('.tile');
      tile.classList.add('menu');
      const tb = tile.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const a = box(el);
      return {
        text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
        w: b.width,
        h: b.height,
        topGap: b.top - tb.top,
        rightGap: tb.right - b.right,
        clipped: el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2,
        name: gap(a, box(tile.querySelector('.name'))),
        max: gap(a, box(tile.querySelector('.maxbtn'))),
        mod: gap(a, box(tile.querySelector('.modbar'))),
        overVideo: b.top > tb.top + 4 && b.right < tb.right - 4 && b.bottom < tb.bottom - 4 && b.left > tb.left + 4,
      };
    });
  });
  expect(info.length).toBeGreaterThanOrEqual(1);
  for (const b of info) {
    expect(b.text).toBe('Blur for all');
    expect(b.w).toBeGreaterThanOrEqual(44);
    expect(b.h).toBeGreaterThanOrEqual(44);
    expect(Math.abs(b.w - b.h)).toBeLessThanOrEqual(1);
    expect(b.topGap).toBeGreaterThanOrEqual(8);
    expect(b.rightGap).toBeGreaterThanOrEqual(8);
    expect(b.clipped).toBe(false);
    expect(b.overVideo).toBe(true);
    expect(b.name).toBeGreaterThanOrEqual(12);
    expect(b.max).toBeGreaterThanOrEqual(12);
    expect(b.mod).toBeGreaterThanOrEqual(12);
  }
});
