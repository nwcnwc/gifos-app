import { test, expect } from '@playwright/test';

async function openCreate(page) {
  await page.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#lobby.show').waitFor();
  await page.locator('#lob-admin-go').waitFor({ state: 'visible' });
}

test('a stream to friends opens on a name and Go live', async ({ page }) => {
  await openCreate(page);
  await expect(page).toHaveTitle('Stream — GifOS');
  await expect(page.locator('#lob-admin-btn')).toBeHidden();
  await expect(page.locator('#lobby h1')).toHaveText('Stream');
  const quiet = page.locator('.lob-quiet');
  await expect(quiet).toBeVisible();
  await expect(quiet).toHaveText('Friends watch with the link.');
  await expect(page.locator('#lob-admin-name-lab')).toHaveText('Name');
  await expect(page.locator('#lob-admin-name')).toHaveAttribute('placeholder', 'Friday night');
  await expect(page.locator('#lob-join-btn')).toHaveText('Watch a stream');
  await expect(page.locator('#lob-empty')).toHaveText('Streams you start or watch will show up here.');
  await expect(page.locator('#lob-admin-go')).toHaveText('Go live');
  await expect(page.locator('#lob-key-block')).toBeHidden();
  await expect(page.locator('#lob-guest-pass')).toBeHidden();
  const first = await page.locator('#lob-admin-pass').inputValue();
  expect(first).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{2}$/);
  const reveal = page.locator('#lob-key-reveal');
  await expect(reveal).toBeVisible();
  await expect(reveal).toHaveText('Change host key');
  const revealBox = await reveal.boundingBox();
  expect(revealBox.height).toBeGreaterThanOrEqual(44);
  const nameBox = await page.locator('#lob-admin-name').boundingBox();
  const quietBox = await quiet.boundingBox();
  expect(quietBox.y + quietBox.height).toBeLessThanOrEqual(nameBox.y + 1);
  const goBefore = await page.locator('#lob-admin-go').boundingBox();
  const watchBox = await page.locator('#lob-join-btn').boundingBox();
  const vh = page.viewportSize().height;
  expect(goBefore.y + goBefore.height).toBeLessThanOrEqual(vh + 0.5);
  expect(goBefore.y - (nameBox.y + nameBox.height)).toBeGreaterThanOrEqual(8);
  expect(watchBox.y - (goBefore.y + goBefore.height)).toBeGreaterThanOrEqual(8);
  expect(revealBox.y).toBeGreaterThanOrEqual(watchBox.y + watchBox.height - 1);
  await reveal.click();
  await expect(page.locator('#lob-key-block')).toBeVisible();
  await expect(reveal).toBeHidden();
  await expect(page.locator('#lob-admin-pass-head')).toHaveText('Your host key');
  await expect(page.locator('#lob-admin-pass')).toHaveAttribute('type', 'text');
  const note = await page.locator('#lob-admin-pass-note').innerText();
  expect(note.length).toBeLessThan(80);
  expect(note.toLowerCase()).not.toContain('password');
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
});

test('a meeting lobby leads with a town hall and still shows the host key', async ({ page }) => {
  await page.goto('/run.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#lobby.show').waitFor();
  await expect(page.locator('#lob-admin-btn')).toContainText('Start a town hall');
  const places = await page.evaluate(() => {
    const hall = document.getElementById('lob-admin-btn').getBoundingClientRect();
    const open = document.getElementById('lob-open').getBoundingClientRect();
    return {
      hallFirst: hall.top < open.top,
      hallBg: getComputedStyle(document.getElementById('lob-admin-btn')).backgroundColor,
      openBg: getComputedStyle(document.getElementById('lob-open')).backgroundColor,
    };
  });
  expect(places.hallFirst).toBe(true);
  expect(places.hallBg).not.toBe(places.openBg);
  await page.locator('#lob-admin-btn').click();
  await expect(page.locator('#lobby h1')).toHaveText('Town hall');
  await page.locator('#lob-admin-go').waitFor({ state: 'visible' });
  await expect(page.locator('#lob-admin-name-lab')).toBeHidden();
  await expect(page.locator('#lob-key-block')).toBeVisible();
  await expect(page.locator('#lob-key-reveal')).toBeHidden();
  await expect(page.locator('#lob-admin-go')).toHaveText('Create & enter');
  const first = await page.locator('#lob-admin-pass').inputValue();
  expect(first).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{2}$/);
});

test('an empty stream name asks to name it first', async ({ page }) => {
  await openCreate(page);
  await page.locator('#lob-admin-go').click();
  await expect(page.locator('#lob-admin-err')).toHaveText('Name it first.');
  await expect(page.locator('#lobby.show')).toBeVisible();
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
