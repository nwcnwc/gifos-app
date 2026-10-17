const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qahost&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: true }));
  expect(seeded && seeded.ok).toBe(true);
  await page.click('#statuscount');
  await expect(page.locator('#roster.open')).toBeVisible();
}

function overlap(a, b) {
  return !!(a && b && a.width > 8 && a.bottom > b.top + 4 && a.top < b.bottom - 4 && a.right > b.left + 4 && a.left < b.right - 4);
}

test('a host holds, renames, and spotlights from the roster', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await boot(page);
  const toggle = page.locator('#roster-wait-toggle');
  await expect(toggle).toHaveText('Off');
  await toggle.click();
  await expect(toggle).toHaveText('On');
  await expect(page.locator('#roster-wait-empty')).toHaveText('No one is waiting');

  const arrived = await page.evaluate(() => window.__gifosVideo.arriveGuestForTest({ name: 'Mina Park' }));
  expect(arrived && arrived.held).toBe(true);
  const waiting = page.locator('#roster-waitlist .roster-row', { hasText: 'Mina Park' });
  const admit = waiting.locator('.admitbtn');
  await expect(admit).toHaveText('Admit');
  await expect(page.locator('.tile', { hasText: 'Mina Park' })).toHaveCount(0);
  const fit = await page.evaluate(() => {
    const btn = document.querySelector('#roster-waitlist .admitbtn');
    const row = btn.closest('.roster-row');
    const bb = btn.getBoundingClientRect();
    const rb = row.getBoundingClientRect();
    const dock = document.querySelector('.bar').getBoundingClientRect();
    const panel = document.getElementById('roster').getBoundingClientRect();
    const overlap = (a, b) => !!(a && b && a.width > 8 && a.bottom > b.top + 4 && a.top < b.bottom - 4 && a.right > b.left + 4 && a.left < b.right - 4);
    return {
      font: parseFloat(getComputedStyle(btn).fontSize),
      h: bb.height,
      inside: bb.left >= rb.left - 1 && bb.right <= rb.right + 1 && bb.top >= rb.top - 1 && bb.bottom <= rb.bottom + 1,
      onScreen: bb.top >= -1 && bb.left >= -1 && bb.right <= window.innerWidth + 1 && bb.bottom <= window.innerHeight + 1,
      coversDock: overlap(panel, dock),
    };
  });
  expect(fit.font).toBeGreaterThanOrEqual(15);
  expect(fit.h).toBeGreaterThanOrEqual(40);
  expect(fit.inside).toBe(true);
  expect(fit.onScreen).toBe(true);
  expect(fit.coversDock).toBe(false);

  await admit.click();
  await expect(page.locator('#roster-waitlist .roster-row')).toHaveCount(0);
  await expect(page.locator('.tile', { hasText: 'Mina Park' })).toBeVisible();

  const avery = page.locator('#roster-list .roster-row', { hasText: 'Avery Chen' });
  await avery.locator('.renamebtn').click();
  const box = avery.locator('.renamebox');
  await expect(box).toBeVisible();
  await box.fill('Avery Client');
  await avery.locator('.renamesave').click();
  const renamed = page.locator('#roster-list .roster-row', { hasText: 'Avery Client' });
  await expect(renamed).toBeVisible();
  await expect(page.locator('.tile .name', { hasText: 'Avery Client' })).toBeVisible();
  const nameFit = await page.evaluate(() => {
    const nm = Array.from(document.querySelectorAll('.tile .name')).find((el) => el.textContent === 'Avery Client');
    const r = nm.getBoundingClientRect();
    const cs = getComputedStyle(nm);
    return {
      font: parseFloat(cs.fontSize),
      onScreen: r.top >= -1 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
      clipped: nm.scrollWidth > nm.clientWidth + 2,
    };
  });
  expect(nameFit.font).toBeGreaterThanOrEqual(14);
  expect(nameFit.onScreen).toBe(true);
  expect(nameFit.clipped).toBe(false);

  const spot = page.locator('#roster-list .roster-row', { hasText: 'Avery Client' }).locator('.spotbtn');
  await spot.click();
  await expect(spot).toHaveText('In view');
  const tile = page.locator('.tile', { hasText: 'Avery Client' });
  await expect(tile).toHaveClass(/onstage/);
  const spotFit = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('.tile')).find((el) => /Avery Client/.test(el.textContent));
    const r = t.getBoundingClientRect();
    return {
      onScreen: r.width > 40 && r.top >= -1 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
      first: r.top <= 80,
    };
  });
  expect(spotFit.onScreen).toBe(true);
  expect(spotFit.first).toBe(true);
});

test('a guest in an admin room gets no host roster tools', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qahost&av=0123456789abcdef&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: false }));
  await page.click('#statuscount');
  await expect(page.locator('#roster-wait-toggle')).toHaveCount(0);
  await expect(page.locator('.renamebtn')).toHaveCount(0);
  await expect(page.locator('.spotbtn')).toHaveCount(0);
});
