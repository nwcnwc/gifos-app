import { test, expect } from '@playwright/test';

test('the lobby sentence and preview name grow with the root text size', async ({ page }) => {
  await page.goto('/run.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#lobby.show').waitFor();
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  const box = await page.evaluate(() => {
    const quiet = document.querySelector('.lob-quiet');
    const name = document.getElementById('lob-preview-name');
    const go = document.getElementById('lob-admin-btn').getBoundingClientRect();
    const card = document.querySelector('.lobby-card').getBoundingClientRect();
    return {
      quiet: parseFloat(getComputedStyle(quiet).fontSize),
      name: parseFloat(getComputedStyle(name).fontSize),
      goTop: go.top,
      goBottom: go.bottom,
      cardBottom: card.bottom,
      vh: innerHeight,
    };
  });
  expect(box.quiet).toBeGreaterThanOrEqual(28);
  expect(box.name).toBeGreaterThanOrEqual(28);
  expect(box.goTop).toBeGreaterThanOrEqual(0);
  expect(box.goBottom).toBeLessThanOrEqual(box.cardBottom + 1);
  expect(box.goBottom).toBeLessThanOrEqual(box.vh + 0.5);
});
