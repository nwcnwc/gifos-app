const { test, expect } = require('@playwright/test');

async function boot(page, hash) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#' + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 6, connected: false }));
  expect(seeded && seeded.ok).toBe(true);
  await page.click('#statuscount');
  await expect(page.locator('#roster.open')).toBeVisible();
}

test('a host mutes someone for all from the roster', async ({ page }) => {
  await boot(page, 'v=qamute&debug=on');
  const sam = page.locator('.roster-row', { hasText: 'Sam Okonkwo' });
  const mute = sam.locator('.mutebtn');
  await expect(mute).toHaveText('Mute for all');
  await expect(page.locator('.roster-row', { hasText: 'Jordan Lee' }).locator('.mutebtn')).toHaveCount(0);
  const fit = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('.roster-row')).find((el) => /Sam Okonkwo/.test(el.textContent));
    const btn = row.querySelector('.mutebtn');
    const name = row.querySelector('.nm');
    const rb = row.getBoundingClientRect();
    const bb = btn.getBoundingClientRect();
    const nb = name.getBoundingClientRect();
    const dock = document.querySelector('.bar').getBoundingClientRect();
    const panel = document.getElementById('roster').getBoundingClientRect();
    return {
      font: parseFloat(getComputedStyle(btn).fontSize),
      inside: bb.left >= rb.left - 1 && bb.right <= rb.right + 1 && bb.top >= rb.top - 1 && bb.bottom <= rb.bottom + 1,
      nameClear: nb.right <= bb.left + 1,
      onScreen: bb.left >= -1 && bb.right <= window.innerWidth + 1,
      coversDock: panel.bottom > dock.top + 4 && panel.right > dock.left && panel.left < dock.right,
      bg: getComputedStyle(btn).backgroundColor,
    };
  });
  expect(fit.font).toBeGreaterThanOrEqual(14);
  expect(fit.inside).toBe(true);
  expect(fit.nameClear).toBe(true);
  expect(fit.onScreen).toBe(true);
  expect(fit.coversDock).toBe(false);

  await mute.click();
  await expect(mute).toHaveText('Unmute for all');
  await expect(mute).toHaveClass(/on/);
  await expect(sam).toContainText('For all');
  const onBg = await mute.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(onBg).not.toBe(fit.bg);
  await mute.click();
  await expect(mute).toHaveText('Mute for all');
  await expect(page.locator('#roster.open')).toBeVisible();
});

test('a guest in an admin room gets no roster mute', async ({ page }) => {
  await boot(page, 'v=qamute&av=0123456789abcdef&debug=on');
  await expect(page.locator('.mutebtn')).toHaveCount(0);
});
