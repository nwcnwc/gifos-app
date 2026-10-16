import { test, expect } from '@playwright/test';

async function openCreate(page) {
  await page.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#lobby.show').waitFor();
  await page.locator('#lob-admin-btn').click();
  await page.locator('#lob-admin-go').waitFor({ state: 'visible' });
}

test('broadcast create asks for one password', async ({ page }) => {
  await openCreate(page);
  await expect(page.locator('#lob-admin-pass')).toBeVisible();
  await expect(page.locator('#lob-guest-pass')).toBeHidden();
  const note = await page.locator('#lob-admin-pass-note').innerText();
  expect(note.length).toBeLessThan(80);
  expect(note.toLowerCase()).not.toContain('do not share');
  const passwords = await page.locator('#lob-admin input[type="password"]:visible').count();
  expect(passwords).toBe(1);
  const go = await page.locator('#lob-admin-go').boundingBox();
  const vh = page.viewportSize().height;
  expect(go.y + go.height).toBeLessThanOrEqual(vh + 0.5);
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
