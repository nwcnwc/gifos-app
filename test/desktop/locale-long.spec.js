const { test, expect } = require('@playwright/test');

test.describe('German lobby, help, and shortcuts', () => {
  test.use({ locale: 'de-DE' });

  test('the lobby is German', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Pastor Kim'); });
    await page.goto('/run.html#debug=on', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#lobby.show h1')).toHaveText('Besprechung');
    await expect(page.locator('#lob-open span')).toHaveText('Besprechung starten');
    await expect(page.locator('.lob-quiet')).toContainText('Mikrofon und Kamera');
    await expect(page.locator('#lob-empty')).toContainText('Besprechungen');
  });

  test('help and the shortcut list are German', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => {
      localStorage.setItem('gifos_name', 'Pastor Kim');
      sessionStorage.setItem('gifos_appeared', '1');
    });
    await page.goto('/run.html#v=qalang2&debug=on', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mic', { state: 'visible' });
    await page.keyboard.press('?');
    await expect(page.locator('#shortcut-title')).toHaveText('Tastatur');
    await expect(page.locator('#shortcutsheet')).toContainText('Stumm oder an');
    await expect(page.locator('#shortcutsheet')).toContainText('Alt+A');
    await page.click('#shortcut-cancel');
    await page.click('#apphelp');
    await expect(page.locator('#help-modal h3')).toHaveText('So funktioniert diese Besprechung');
    await expect(page.locator('#help-modal .help-lead')).toContainText('kein Größenlimit');
    await expect(page.locator('#help-modal h4').first()).toHaveText('Das Stadion');
    await expect(page.locator('#help-close')).toHaveText('Verstanden');
    const overflow = await page.evaluate(() => {
      const box = document.querySelector('#help-modal .name-box');
      const r = box.getBoundingClientRect();
      return r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1;
    });
    expect(overflow).toBe(true);
  });
});

test.describe('Spanish lobby', () => {
  test.use({ locale: 'es-MX' });
  test('the lobby is Spanish', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/run.html#debug=on', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#lobby.show h1')).toHaveText('Reunión');
    await expect(page.locator('#lob-open span')).toHaveText('Empezar una reunión');
    await expect(page.locator('#shortcut-title')).toHaveText('Teclado');
  });
});
