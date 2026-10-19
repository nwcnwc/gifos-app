const { test, expect } = require('@playwright/test');

async function boot(page, width, height) {
  await page.setViewportSize({ width: width, height: height });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html#v=qamore&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4 }));
}

test('starting a vote puts the More sheet away so faces stay visible', async ({ page }) => {
  await boot(page, 1280, 720);
  await page.click('#bartoggle');
  await page.click('#votebtn');
  await page.click('#vote-modal .voteopt.up');
  await expect(page.locator('#votebanner')).toBeVisible();
  const cover = await page.evaluate(() => {
    const sheet = document.querySelector('.barmore');
    const sr = sheet.getBoundingClientRect();
    const shown = getComputedStyle(sheet).display !== 'none';
    let hits = 0;
    for (const t of document.querySelectorAll('#grid .tile:not(.me)')) {
      const r = t.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const overlap = shown && sr.right > r.left + 4 && sr.left < r.right - 4 && sr.bottom > r.top + 4 && sr.top < r.bottom - 4;
      if (overlap) hits++;
    }
    return { hits, word: (document.querySelector('#bartoggle .dockword') || {}).textContent || '' };
  });
  expect(cover.hits).toBe(0);
  expect(cover.word).toBe('More');
});

// Nathan: "when you select them, it should fold the menu back so that's
// doesn't have to be done manually." A pick folds More; a choice that answers
// inside the sheet (blur) keeps it up. The saved open/closed choice is kept.
test('a pick in More folds the sheet, and a blur choice keeps it open', async ({ page }) => {
  await boot(page, 1280, 720);
  await page.click('#bartoggle');
  await page.click('#blur-min');
  await expect(page.locator('#bartoggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#barmore')).toBeVisible();
  await page.click('#keysbtn');
  await expect(page.locator('#shortcutsheet')).toBeVisible();
  await expect(page.locator('#barmore')).toBeHidden();
  await expect(page.locator('#bartoggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#bartoggle .dockword')).toHaveText('More');
  expect(await page.evaluate(() => localStorage.getItem('gifos_meet_bar'))).toBe('0');
  await page.keyboard.press('Escape');
  await page.click('#bartoggle');
  await page.focus('#ccbtn');
  await page.keyboard.press('Enter');
  await expect(page.locator('#barmore')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('bartoggle');
});

test('the More sheet stays inside a short window', async ({ page }) => {
  await boot(page, 1280, 480);
  await page.click('#bartoggle');
  const box = await page.evaluate(() => {
    const r = document.querySelector('.barmore').getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height, ih: window.innerHeight };
  });
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.bottom).toBeLessThanOrEqual(box.ih + 1);
  expect(box.height).toBeGreaterThan(80);
});
