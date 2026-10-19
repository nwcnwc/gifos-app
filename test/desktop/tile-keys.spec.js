const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html#v=qatile&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4 }));
  await page.waitForSelector('#grid .tile:not(.me)');
}

// 0.9.23b: per-person controls live in the tile's control window. A tile
// takes keyboard focus, Enter opens its window, and Tab walks its controls.
test('keyboard focus reaches a remote tile and Enter opens its controls', async ({ page }) => {
  await boot(page);
  const tile = page.locator('#grid .tile:not(.me)').first();
  await expect(tile).toHaveAttribute('tabindex', '0');
  await tile.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#tilewin')).toBeVisible();
  const seen = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => { const a = document.activeElement; return a && a.closest('#tilewin') ? (a.textContent || a.getAttribute('aria-label') || a.type || '').trim() : ''; }));
  }
  expect(seen).toContain('Pin');
  await page.keyboard.press('Escape');
  await expect(page.locator('#tilewin')).toBeHidden();
});
