import { test, expect } from '@playwright/test';

const AV = '0123456789abcdef0123456789abcdef';
const HALL = '/run.html#v=allhands&av=' + AV + '&th=1';

test('a town hall joiner lands in the town hall', async ({ page }) => {
  await page.goto(HALL, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle('Town hall — GifOS');
  await expect(page.locator('.appear-box')).toHaveCount(0);
  await expect(page.locator('#nm-lead')).toHaveCount(0);
  await expect(page.locator('#leavebtn')).toHaveAttribute('aria-label', 'Leave the town hall');
  await expect(page.locator('body')).not.toHaveClass(/broadcast/);
  const cam = await page.locator('#cam').evaluate((el) => getComputedStyle(el).display);
  expect(cam).not.toBe('none');
  const link = await page.locator('#share-url').inputValue();
  expect(link).toContain('th=1');
  expect(link).toContain('allhands');
  expect(link).not.toContain('bc=1');
});

test('a town hall host still confirms how they appear', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_vadm_allhands.0123456789abcdef0123456789abcdef', 'stored-host-key');
  });
  await page.goto(HALL, { waitUntil: 'domcontentloaded' });
  await page.locator('#nm-lead').waitFor({ state: 'visible' });
  await expect(page.locator('#nm-lead')).toHaveText('This is how you’ll appear in the town hall.');
  await expect(page.locator('body')).not.toHaveClass(/broadcast/);
});

test('a meeting joiner still lands in the meeting', async ({ page }) => {
  await page.goto('/run.html#v=allhands&av=' + AV, { waitUntil: 'domcontentloaded' });
  await page.locator('#nm-lead').waitFor({ state: 'visible' });
  await expect(page.locator('#nm-lead')).toHaveText('This is how you’ll appear in the meeting.');
  await expect(page.locator('body')).not.toHaveClass(/townhall/);
  const link = await page.locator('#share-url').inputValue();
  expect(link).not.toContain('th=1');
});

test('starting a town hall puts the flag on the link', async ({ page }) => {
  await page.goto('/run.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#lobby.show').waitFor();
  await page.locator('#lob-admin-btn').click();
  await page.locator('#lob-admin-name').fill('All hands');
  await page.locator('#lob-admin-go').click();
  await page.waitForURL(/th=1/, { timeout: 20000 });
  expect(page.url()).toContain('th=1');
  expect(page.url()).not.toContain('bc=1');
});
