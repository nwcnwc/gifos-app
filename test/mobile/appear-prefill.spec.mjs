import { test, expect } from '@playwright/test';

// 1×1 PNG. gifos_avatar checks the hash shape, not the bytes.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('the join step prefills the GifOS name and picture', async ({ page }) => {
  await page.addInitScript((png) => {
    localStorage.setItem('gifos_name', 'Ada Lovelace');
    localStorage.setItem('gifos_avatar', JSON.stringify({
      mime: 'image/png',
      hash: 'a'.repeat(64),
      b64: png,
    }));
  }, PNG);
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  const input = page.locator('#nm');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('Ada Lovelace');
  const img = page.locator('#nm-avatar');
  await expect(img).toBeVisible();
  const src = await img.getAttribute('src');
  expect(src).toContain('data:image/png;base64,');
  expect(src).toContain(PNG);
  const box = await img.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});
