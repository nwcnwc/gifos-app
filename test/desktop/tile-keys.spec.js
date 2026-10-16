const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); });
  await page.goto('/run.html#v=qatile&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4 }));
  await page.waitForSelector('#grid .tile:not(.me)');
}

test('keyboard focus reaches mute on a remote tile', async ({ page }) => {
  await boot(page);
  const tile = page.locator('#grid .tile:not(.me)').first();
  await expect(tile).toHaveAttribute('tabindex', '0');
  const hidden = await tile.locator('.modbar').evaluate((el) => getComputedStyle(el).display);
  expect(hidden).toBe('none');
  await tile.focus();
  const shown = await tile.locator('.modbar').evaluate((el) => getComputedStyle(el).display);
  expect(shown).toBe('flex');
  const inside = await tile.evaluate((t) => {
    const b = t.querySelector('.modbar button[data-mod="mute"]');
    const tr = t.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return br.width > 8 && br.height > 8 && br.left >= tr.left - 1 && br.right <= tr.right + 1 && br.top >= tr.top - 1 && br.bottom <= tr.bottom + 1;
  });
  expect(inside).toBe(true);
  let landed = '';
  for (let i = 0; i < 4 && landed !== 'mute'; i++) {
    await page.keyboard.press('Tab');
    landed = await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute('data-mod')) || '');
  }
  expect(landed).toBe('mute');
});
