const { test, expect } = require('@playwright/test');

async function fileText(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qawhofile&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  return page.evaluate(() => window.__gifosVideo.whoFileForTest());
}

test('an English device downloads an English Who file', async ({ page }) => {
  const text = await fileText(page);
  expect(text).toContain('GifOS meeting — who was here');
  expect(text).toContain('HOW TO READ THIS');
  expect(text).toContain('Connection to me');
  expect(text).toContain('this device');
  expect(text).toContain('(you)');
});

test.describe('German Who file', () => {
  test.use({ locale: 'de-DE' });
  test('the Who download follows German', async ({ page }) => {
    const text = await fileText(page);
    expect(text).toContain('GifOS-Besprechung — wer hier war');
    expect(text).toContain('SO LESEN SIE DIESE DATEI');
    expect(text).toContain('Verbindung zu mir');
    expect(text).toContain('dieses Gerät');
    expect(text).toContain('(Sie)');
    expect(text).toContain('Raum:');
    expect(text).not.toContain('HOW TO READ THIS');
    expect(text).not.toContain('GifOS meeting — who was here');
    expect(text).not.toContain('this device');
    expect(text).not.toContain('(you)');
  });
});

test.describe('Spanish Who file', () => {
  test.use({ locale: 'es-MX' });
  test('the Who download follows Spanish', async ({ page }) => {
    const text = await fileText(page);
    expect(text).toContain('Reunión de GifOS — quién estuvo aquí');
    expect(text).toContain('CÓMO LEER ESTO');
    expect(text).toContain('Conexión conmigo');
    expect(text).toContain('este dispositivo');
    expect(text).toContain('(tú)');
    expect(text).not.toContain('HOW TO READ THIS');
    expect(text).not.toContain('GifOS meeting — who was here');
    expect(text).not.toContain('this device');
  });
});
