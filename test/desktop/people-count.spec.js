const { test, expect } = require('@playwright/test');

async function boot(page, width, height) {
  await page.setViewportSize({ width: width, height: height });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html#v=qacount&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
}

async function countBox(page) {
  return page.evaluate(() => {
    const status = document.getElementById('status');
    const count = document.getElementById('statuscount');
    const tiles = document.querySelectorAll('#grid .tile').length;
    if (!count) return { missing: true, full: status ? status.textContent : '', tiles: tiles };
    const box = count.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(count);
    const textBox = range.getBoundingClientRect();
    const cs = getComputedStyle(count);
    return {
      missing: false,
      full: status.textContent,
      count: (count.textContent || '').trim(),
      tiles: tiles,
      clipped: count.scrollWidth > count.clientWidth + 1 || textBox.right > box.right + 1 || textBox.left < box.left - 1,
      onScreen: box.left >= -1 && box.right <= window.innerWidth + 1 && box.width > 8,
      font: parseFloat(cs.fontSize),
    };
  });
}

test('four people in the room are not "Just you", and the count is not cut off', async ({ page }) => {
  await boot(page, 1280, 720);
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4, connected: false }));
  expect(seeded && seeded.ok).toBe(true);
  await page.waitForTimeout(200);
  const box = await countBox(page);
  expect(box.tiles).toBe(5);
  expect(box.missing).toBe(false);
  expect(box.full).not.toContain('Just you');
  expect(box.count).toBe('5 in this small group');
  expect(box.clipped).toBe(false);
  expect(box.onScreen).toBe(true);
  expect(box.font).toBeGreaterThanOrEqual(16);

  await page.setViewportSize({ width: 900, height: 720 });
  await page.waitForTimeout(200);
  const narrow = await countBox(page);
  expect(narrow.count).toBe('5 in this small group');
  expect(narrow.clipped).toBe(false);
  expect(narrow.onScreen).toBe(true);
});
