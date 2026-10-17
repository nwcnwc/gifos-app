const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qaapp&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  await page.waitForFunction(() => window.__gifosVideo.canRunApp());
  await page.click('#bartoggle');
  await page.click('#moretools');
  await page.click('#appbtn');
  await expect(page.locator('#app-modal')).toBeVisible();
}

test.describe('German Run app', () => {
  test.use({ locale: 'de-DE' });
  test('the Run app sheet follows German', async ({ page }) => {
    await boot(page);
    const sheet = page.locator('#app-modal');
    await expect(sheet.locator('h3')).toHaveText('Eine App in dieser Besprechung starten');
    await expect(sheet).toContainText('Wählen Sie eine Ihrer Apps');
    await expect(sheet.locator('#app-file')).toHaveText('＋ Eine GIF-Datei wählen…');
    await expect(sheet.locator('#app-url')).toHaveAttribute('placeholder', 'Link zu einer GIF-App einfügen');
    await expect(sheet.locator('#app-url-go')).toHaveText('Starten');
    await expect(sheet.locator('#app-cancel')).toHaveText('Abbrechen');
    await expect(sheet).not.toContainText('Run an app in this meeting');
    await expect(sheet).not.toContainText('Choose a GIF file');
    await expect(page.locator('#appbtn')).toHaveAttribute('title', /App in dieser Besprechung/);
    const fit = await sheet.evaluate((el) => {
      const h = el.querySelector('h3');
      const box = el.querySelector('.name-box').getBoundingClientRect();
      return { font: parseFloat(getComputedStyle(h).fontSize), top: box.top, bottom: box.bottom, ih: window.innerHeight };
    });
    expect(fit.font).toBeGreaterThanOrEqual(16);
    expect(fit.top).toBeGreaterThanOrEqual(0);
    expect(fit.bottom).toBeLessThanOrEqual(fit.ih + 1);
  });
});

test.describe('Spanish Run app', () => {
  test.use({ locale: 'es-MX' });
  test('the Run app sheet follows Spanish', async ({ page }) => {
    await boot(page);
    const sheet = page.locator('#app-modal');
    await expect(sheet.locator('h3')).toHaveText('Abrir una app en esta reunión');
    await expect(sheet.locator('#app-file')).toHaveText('＋ Elegir un archivo GIF…');
    await expect(sheet.locator('#app-url-go')).toHaveText('Abrir');
    await expect(sheet.locator('#app-cancel')).toHaveText('Cancelar');
    await expect(sheet).not.toContainText('Run an app in this meeting');
    await expect(sheet).not.toContainText('Choose a GIF file');
  });
});
