import { test, expect } from '@playwright/test';

// 0.9.23b broadcast on a phone: the start time with a countdown and Add to
// calendar, Visit, "has ended", Stream to friends, and Start a town hall.
// The host's start time and Visit link reach a viewer through the host's
// status (the normal fan-out); here a seeded host stands in for it.
const AV = '0123456789abcdef0123456789abcdef';

async function viewer(page) {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Ruth');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qabc23b' + Date.now().toString(36) + '&av=' + AV + '&bc=1&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.seedGalleryForTest);
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 1, names: ['Pastor Kim'] }));
  expect(seeded && seeded.ok).toBe(true);
}
const card = (page) => page.evaluate(() => ({
  on: !document.getElementById('bc-ended').hidden,
  text: document.getElementById('bc-ended-txt').textContent,
  cal: !document.getElementById('bc-cal').hidden,
  ics: document.getElementById('bc-cal').download || '',
  visit: document.getElementById('bc-visit').hidden ? '' : document.getElementById('bc-visit').getAttribute('href'),
}));

test('a viewer early for a service reads when it starts, a countdown, Add to calendar and Visit', async ({ page }) => {
  await viewer(page);
  const at = Math.floor(Date.now() / 1000) + 2 * 3600 + 5 * 60;
  await page.evaluate((a) => window.__gifosVideo.setPeerStatusForTest('qa1', { bcat: a, bcvisit: 'https://example.org/church' }), at);
  await expect.poll(async () => (await card(page)).text, { timeout: 15000 }).toMatch(/^The service starts .+ · in 2 h [0-9]+ min\.$/);
  const c = await card(page);
  expect(c.on).toBe(true);
  expect(c.cal).toBe(true);
  expect(c.ics).toMatch(/\.ics$/);
  expect(c.visit).toBe('https://example.org/church');
});

test('a viewer reads that the service has ended once the host says so', async ({ page }) => {
  await viewer(page);
  await page.evaluate(() => window.__gifosVideo.setPeerStatusForTest('qa1', { bcend: Date.now() }));
  await expect.poll(async () => (await card(page)).text, { timeout: 15000 }).toBe('The service has ended.');
  expect((await card(page)).cal).toBe(false);
});

test('Stream to friends is a stream lobby: the same Go live, friendlier words', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Sam'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html#bc=1&st=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#lobby h1')).toHaveText('Stream');
  await expect(page).toHaveTitle('Stream — GifOS');
  await expect(page.locator('#lob-admin-name')).toHaveValue('Friday night');
});

test('the lobby starts a town hall: the room link carries th=1', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Sam'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#lob-th-btn')).toBeVisible();
  await expect(page.locator('#lob-stream')).toBeVisible();
  await page.locator('#lob-th-btn').click();
  await expect(page.locator('#lobby h1')).toHaveText('Town hall');
  await page.fill('#lob-admin-name', 'Budget ' + Date.now().toString(36));
  await page.locator('#lob-admin-go').click();
  await page.waitForURL(/[#&]th=1/, { timeout: 20000 });
});
