const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qaalone&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.waitForFunction(() => (document.getElementById('statuscount').textContent || '').indexOf('Just you') !== -1
    || (document.getElementById('statuscount').textContent || '').indexOf('Nur Sie') !== -1
    || (document.getElementById('statuscount').textContent || '').indexOf('Solo tú') !== -1);
  await expect(page.locator('#appinvite')).toBeVisible();
}

test('alone, Invite opens the meeting link, and stays when someone else is here', async ({ page }) => {
  await boot(page);
  const btn = page.locator('#appinvite');
  await expect(btn).toHaveText('Invite');
  await expect(page.locator('#status')).not.toContainText('send the invite');
  await expect(page.locator('#inv-modal')).toBeHidden();
  const box = await btn.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      h: r.height,
      font: parseFloat(cs.fontSize),
      onScreen: r.top >= -1 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
      inHeader: !!el.closest('#appbar'),
    };
  });
  expect(box.h).toBeGreaterThanOrEqual(36);
  expect(box.font).toBeGreaterThanOrEqual(16);
  expect(box.onScreen).toBe(true);
  expect(box.inHeader).toBe(true);

  await page.evaluate(() => {
    window.__copied = '';
    window.__shared = null;
    navigator.clipboard.writeText = (t) => { window.__copied = String(t); return Promise.resolve(); };
    navigator.share = (p) => { window.__shared = p; return Promise.resolve(); };
  });
  // The header slot opens the sheet. Copy and Share live on the sheet
  // (bafc6b1). The header button stays "Invite".
  await page.click('#appinvite');
  await expect(btn).toHaveText('Invite');
  await expect(page.locator('#inv-modal')).toBeVisible();
  await expect(page.locator('#inv-modal h3')).toHaveText('Share this meeting');
  await expect(page.locator('#roster')).toBeHidden();
  await expect(page.locator('#inv-url')).toHaveValue(/qaalone/);
  await expect(page.locator('#inv-share')).toBeVisible();
  await page.click('#inv-copy');
  await expect(page.locator('#inv-copy')).toHaveText('Copied ✓');
  await page.click('#inv-share');
  const sent = await page.evaluate(() => ({ copied: window.__copied, shared: window.__shared && window.__shared.url }));
  expect(sent.copied).toContain('qaalone');
  expect(sent.shared).toContain('qaalone');

  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: false }));
  await expect(page.locator('#statuscount')).toHaveText('3 in this meeting');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('Invite');
  await expect(page.locator('#status')).not.toContainText('Just you');
});

test.describe('German alone invite', () => {
  test.use({ locale: 'de-DE' });
  test('the alone button says Einladen', async ({ page }) => {
    await boot(page);
    await expect(page.locator('#statuscount')).toHaveText('Nur Sie');
    await expect(page.locator('#appinvite')).toHaveText('Einladen');
    await expect(page.locator('#status')).not.toContainText('Link schicken');
  });
});
