const { test, expect } = require('@playwright/test');

async function openJoin(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Avery Chen'); });
  await page.goto('/run.html#v=qalang&debug=on', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#appear')).toBeVisible();
}

test.describe('German', () => {
  test.use({ locale: 'de-DE' });
  test('join card and dock follow German', async ({ page }) => {
    await openJoin(page);
    await expect(page.locator('#appear-title')).toHaveText('So sehen Sie aus');
    await expect(page.locator('#nmok')).toHaveText('Beitreten');
    await expect(page.locator('#nmcancel')).toHaveText('Nicht jetzt');
    await page.click('#nmok');
    await expect(page.locator('#mic .dockword')).toHaveText('Mikro');
    await expect(page.locator('#cam .dockword')).toHaveText('Kamera');
    await expect(page.locator('#leavebtn .dockword')).toHaveText('Ende');
    await expect(page.locator('#bartoggle .dockword')).toHaveText('Mehr');
    await page.click('#bartoggle');
    await expect(page.locator('#barmore .moregroup h4').first()).toHaveText('Leute');
    expect(await page.locator('html').getAttribute('lang')).toBe('de');
  });
});

test.describe('Spanish', () => {
  test.use({ locale: 'es-MX' });
  test('join card and dock follow Spanish', async ({ page }) => {
    await openJoin(page);
    await expect(page.locator('#appear-title')).toHaveText('Así te verán');
    await expect(page.locator('#nmok')).toHaveText('Entrar');
    await page.click('#nmok');
    await expect(page.locator('#mic .dockword')).toHaveText('Micro');
    await expect(page.locator('#cam .dockword')).toHaveText('Cámara');
    await expect(page.locator('#bartoggle .dockword')).toHaveText('Más');
    expect(await page.locator('html').getAttribute('lang')).toBe('es');
  });
});
