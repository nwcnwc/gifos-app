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

test('a speaker fills the town hall stage', async ({ page }) => {
  await page.goto(HALL, { waitUntil: 'domcontentloaded' });
  await page.locator('#bc-ended-txt').waitFor({ state: 'visible' });
  const box = await page.evaluate(() => {
    window.__gifosVideo.markJoinedForTest('speaker-ann');
    const feed = document.getElementById('stagefeed');
    const el = document.createElement('div');
    el.className = 'rowtile';
    el.dataset.row = 'sgs';
    el.style.aspectRatio = '1.7778';
    const v = document.createElement('video');
    const lb = document.createElement('div');
    lb.className = 'rlabel';
    lb.textContent = 'On stage';
    el.append(v, lb);
    feed.appendChild(el);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const vs = getComputedStyle(v);
    const quiet = document.getElementById('bc-ended');
    return {
      w: r.width, h: r.height, x: r.x, y: r.y,
      radius: cs.borderRadius, fit: vs.objectFit,
      short: Math.min(r.width, r.height),
      vw: innerWidth, vh: innerHeight,
      quiet: quiet.hidden || getComputedStyle(quiet).display === 'none',
    };
  });
  expect(box.w).toBeGreaterThanOrEqual(box.vw - 1);
  expect(box.h).toBeGreaterThanOrEqual(box.vh * 0.75);
  expect(box.h).toBeGreaterThan(box.w * 0.7);
  expect(box.short).toBeGreaterThanOrEqual(120);
  expect(box.x).toBeLessThanOrEqual(1);
  expect(box.y).toBeLessThanOrEqual(1);
  expect(parseFloat(box.radius)).toBe(0);
  expect(box.fit).toBe('cover');
  expect(box.quiet).toBe(true);
});

test('a meeting speaker stays a tile', async ({ page }) => {
  await page.goto('/run.html#v=allhands&av=' + AV, { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  const box = await page.evaluate(() => {
    const feed = document.getElementById('stagefeed');
    const el = document.createElement('div');
    el.className = 'rowtile';
    el.dataset.row = 'sgs';
    const v = document.createElement('video');
    el.append(v, document.createElement('div'));
    feed.appendChild(el);
    const r = el.getBoundingClientRect();
    return { h: r.height, vh: innerHeight };
  });
  expect(box.h).toBeLessThan(box.vh * 0.5);
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
