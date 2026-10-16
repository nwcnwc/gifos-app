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
    await expect(page.locator('#nmok')).toHaveText('Speichern');
    await expect(page.locator('#nmcancel')).toHaveText('Leeren');
    await page.click('#nmok');
    await expect(page.locator('#mic .dockword')).toHaveText('Mikro');
    await expect(page.locator('#cam .dockword')).toHaveText('Kamera');
    await expect(page.locator('#leavebtn .dockword')).toHaveText('Ende');
    await expect(page.locator('#bartoggle .dockword')).toHaveText('Mehr');
    await page.click('#bartoggle');
    await expect(page.locator('#barmore .moregroup h4').first()).toHaveText('Leute');
    await expect(page.locator('#whobtn')).toHaveText('Wer');
    await expect(page.locator('#votebtn')).toHaveText('Abstimmung');
    await expect(page.locator('#setbtn')).toHaveText('Einstellungen');
    await expect(page.locator('#helpbtn')).toHaveText('Hilfe');
    await expect(page.locator('#sharebtn')).toHaveText('Bildschirm');
    const overflow = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#barmore .morerow > button, #barmore .blurlbl, #barmore .seg').forEach((b) => {
        if (getComputedStyle(b).display === 'none') return;
        if (b.scrollWidth > b.clientWidth + 2) bad.push((b.id || b.className) + ' ' + b.textContent);
      });
      return bad;
    });
    expect(overflow).toEqual([]);
    const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4, connected: false }));
    expect(seeded && seeded.ok).toBe(true);
    await expect(page.locator('#statuscount')).toHaveText('5 im Meeting');
    await expect(page.locator('#statusrest')).toContainText('Passwort für klares Video');
    expect(await page.locator('html').getAttribute('lang')).toBe('de');
  });
});

test.describe('Spanish', () => {
  test.use({ locale: 'es-MX' });
  test('join card and dock follow Spanish', async ({ page }) => {
    await openJoin(page);
    await expect(page.locator('#appear-title')).toHaveText('Así te verán');
    await expect(page.locator('#nmok')).toHaveText('Guardar');
    await expect(page.locator('#nmcancel')).toHaveText('Limpiar');
    await page.click('#nmok');
    await expect(page.locator('#mic .dockword')).toHaveText('Micro');
    await expect(page.locator('#cam .dockword')).toHaveText('Cámara');
    await expect(page.locator('#bartoggle .dockword')).toHaveText('Más');
    await page.click('#bartoggle');
    await expect(page.locator('#whobtn')).toHaveText('Quién');
    await expect(page.locator('#pwbtn')).toHaveText('Contraseña');
    await expect(page.locator('#setbtn')).toHaveText('Ajustes');
    await expect(page.locator('#sharebtn')).toHaveText('Pantalla');
    const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4, connected: false }));
    expect(seeded && seeded.ok).toBe(true);
    await expect(page.locator('#statuscount')).toHaveText('5 en la reunión');
    await expect(page.locator('#statusrest')).toContainText('contraseña para video nítido');
    expect(await page.locator('html').getAttribute('lang')).toBe('es');
  });
});
