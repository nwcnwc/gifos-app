const { test, expect } = require('@playwright/test');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html#v=' + RUN_ROOM + 'qatile&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4 }));
  await page.waitForSelector('#grid .tile:not(.me)');
}

// 0.9.23b: per-person controls live in the tile's control window. A tile
// takes keyboard focus, Tab reaches its Open button (UI-0010, ddd6e19: Open
// is the only control that opens the window), Enter opens it, and Tab walks
// its controls.
test('keyboard focus reaches a remote tile and its Open button opens its controls', async ({ page }) => {
  await boot(page);
  const tile = page.locator('#grid .tile:not(.me)').first();
  await expect(tile).toHaveAttribute('tabindex', '0');
  await tile.focus();
  let onOpen = false;
  for (let i = 0; i < 6 && !onOpen; i++) {
    await page.keyboard.press('Tab');
    onOpen = await tile.evaluate((t) => document.activeElement === t.querySelector(':scope > .tile-open'));
  }
  expect(onOpen).toBe(true);
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
