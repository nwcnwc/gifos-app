import { test, expect } from '@playwright/test';

async function openCreate(page) {
  await page.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#lobby.show').waitFor();
  await page.locator('#lob-admin-btn').click();
  await page.locator('#lob-admin-go').waitFor({ state: 'visible' });
}

test('broadcast create offers a readable host key', async ({ page }) => {
  await openCreate(page);
  await expect(page.locator('#lob-admin-pass-head')).toHaveText('Your host key');
  await expect(page.locator('#lob-admin-pass')).toHaveAttribute('type', 'text');
  await expect(page.locator('#lob-guest-pass')).toBeHidden();
  const note = await page.locator('#lob-admin-pass-note').innerText();
  expect(note.length).toBeLessThan(80);
  expect(note.toLowerCase()).not.toContain('password');
  const first = await page.locator('#lob-admin-pass').inputValue();
  expect(first).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{2}$/);
  const fits = await page.locator('#lob-admin-pass').evaluate((el) => el.scrollWidth <= el.clientWidth + 2);
  expect(fits).toBe(true);
  const gen = page.locator('#lob-keygen');
  const genBox = await gen.boundingBox();
  expect(genBox.height).toBeGreaterThanOrEqual(44);
  const paint = await page.evaluate(() => ({
    gen: getComputedStyle(document.getElementById('lob-keygen')).backgroundColor,
    go: getComputedStyle(document.getElementById('lob-admin-go')).backgroundColor,
  }));
  expect(paint.gen).not.toBe(paint.go);
  await gen.click();
  const next = await page.locator('#lob-admin-pass').inputValue();
  expect(next).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{2}$/);
  expect(next).not.toBe(first);
  const go = await page.locator('#lob-admin-go').boundingBox();
  const vh = page.viewportSize().height;
  expect(go.y + go.height).toBeLessThanOrEqual(vh + 0.5);
  const gap = go.y - (genBox.y + genBox.height);
  expect(gap).toBeGreaterThanOrEqual(8);
});

test('a viewer password stays optional and off the first step', async ({ page }) => {
  await openCreate(page);
  const reveal = page.locator('#lob-guest-reveal');
  await expect(reveal).toBeVisible();
  const box = await reveal.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { height: r.height };
  });
  expect(box.height).toBeGreaterThanOrEqual(44);
  await reveal.click();
  await expect(page.locator('#lob-guest-pass')).toBeVisible();
  await expect(reveal).toBeHidden();
});
