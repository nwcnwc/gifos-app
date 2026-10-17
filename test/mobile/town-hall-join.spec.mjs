import { test, expect } from '@playwright/test';

const AV = '0123456789abcdef0123456789abcdef';
const HALL = '/run.html#v=allhands&av=' + AV + '&th=1';

test('a town hall joiner lands in the town hall', async ({ page }) => {
  await page.goto(HALL, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle('Town hall — GifOS');
  await expect(page.locator('#status')).toContainText('The town hall has not started.');
  await expect(page.locator('#status')).not.toContainText('send the invite');
  await expect(page.locator('.appear-box')).toHaveCount(0);
  await expect(page.locator('#nm-lead')).toHaveCount(0);
  await expect(page.locator('#leavebtn')).toHaveAttribute('aria-label', 'Leave the town hall');
  await expect(page.locator('body')).not.toHaveClass(/broadcast/);
  await expect(page.locator('body')).toHaveClass(/th-watch/);
  for (const id of ['cam', 'flipcam', 'mic', 'appbtn', 'sharebtn', 'pwbtn', 'recbtn']) {
    const display = await page.locator('#' + id).evaluate((el) => getComputedStyle(el).display);
    expect(display, id).toBe('none');
  }
  await expect(page.locator('.tile.me')).toBeHidden();
  await expect(page.locator('#bc-ended-txt')).toHaveText('The town hall has not started.');
  await expect(page.locator('#reactbtn')).toBeVisible();
  await expect(page.locator('#bartoggle')).toBeVisible();
  await expect(page.locator('#hand')).toBeAttached();
  const hand = await page.locator('#hand').evaluate((el) => getComputedStyle(el).display);
  expect(hand).not.toBe('none');
  await page.evaluate(() => document.body.classList.add('stage-granted'));
  const camBack = await page.locator('#cam').evaluate((el) => getComputedStyle(el).display);
  expect(camBack).not.toBe('none');
  const micBack = await page.locator('#mic').evaluate((el) => getComputedStyle(el).display);
  expect(micBack).not.toBe('none');
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
  await page.locator('.appear-box h3').waitFor({ state: 'visible' });
  await expect(page.locator('.appear-box h3')).toHaveText(/This is how you.ll appear/);
  await expect(page.locator('#nm-lead')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/broadcast/);
  await expect(page.locator('body')).not.toHaveClass(/th-watch/);
  const cam = await page.locator('#cam').evaluate((el) => getComputedStyle(el).display);
  expect(cam).not.toBe('none');
  await page.locator('#nmok').click();
  await expect(page.locator('.tile.me')).toBeVisible();
  await expect(page.locator('#bc-ended')).toBeHidden();
});

test('a meeting joiner still lands in the meeting', async ({ page }) => {
  await page.goto('/run.html#v=allhands&av=' + AV, { waitUntil: 'domcontentloaded' });
  await page.locator('.appear-box h3').waitFor({ state: 'visible' });
  await expect(page.locator('.appear-box h3')).toHaveText(/This is how you.ll appear/);
  await expect(page.locator('#nm-lead')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/townhall/);
  const cam = await page.locator('#cam').evaluate((el) => getComputedStyle(el).display);
  expect(cam).not.toBe('none');
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
