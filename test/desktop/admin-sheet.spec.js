const { test, expect } = require('@playwright/test');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

async function boot(page, room) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=' + RUN_ROOM + room + '&av=0123456789abcdef&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  await page.click('#bartoggle');
  await page.click('#admbtn');
  await expect(page.locator('#adm-modal')).toBeVisible();
}

test('an English device signs in as admin in English', async ({ page }) => {
  await boot(page, 'qaadmen');
  const sheet = page.locator('#adm-modal');
  await expect(page.locator('#admbtn')).toHaveText('Admin sign-in');
  await expect(sheet.locator('h3')).toHaveText('Room admin');
  await expect(sheet.locator('#adm-enable')).toHaveText('Sign in as admin');
  await expect(sheet.locator('#adm-pass')).toHaveAttribute('placeholder', 'Admin password');
  await expect(sheet.locator('#adm-hint')).toContainText('If you know the admin password');
  await expect(sheet.locator('#adm-close')).toHaveText('Close');
});

test.describe('German admin sheet', () => {
  test.use({ locale: 'de-DE' });
  test('signing in as admin follows German', async ({ page }) => {
    await boot(page, 'qaadmde');
    const sheet = page.locator('#adm-modal');
    await expect(page.locator('#admbtn')).toHaveText('Admin-Anmeldung');
    await expect(sheet.locator('h3')).toHaveText('Raum-Admin');
    await expect(sheet.locator('#adm-enable')).toHaveText('Als Admin anmelden');
    await expect(sheet.locator('#adm-pass')).toHaveAttribute('placeholder', 'Admin-Passwort');
    await expect(sheet.locator('#adm-hint')).toContainText('Wenn Sie das Admin-Passwort kennen');
    await expect(sheet.locator('#adm-close')).toHaveText('Schließen');
    await expect(sheet).not.toContainText('Sign in as admin');
    await expect(sheet).not.toContainText('Room admin');
    await expect(page.locator('#admbtn')).not.toHaveAttribute('title', /enter the admin password/i);
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

test.describe('Spanish admin sheet', () => {
  test.use({ locale: 'es-MX' });
  test('signing in as admin follows Spanish', async ({ page }) => {
    await boot(page, 'qaadmes');
    const sheet = page.locator('#adm-modal');
    await expect(page.locator('#admbtn')).toHaveText('Entrar como anfitrión');
    await expect(sheet.locator('h3')).toHaveText('Anfitrión de la sala');
    await expect(sheet.locator('#adm-enable')).toHaveText('Entrar como anfitrión');
    await expect(sheet.locator('#adm-pass')).toHaveAttribute('placeholder', 'Contraseña de anfitrión');
    await expect(sheet.locator('#adm-hint')).toContainText('Si sabes la contraseña');
    await expect(sheet.locator('#adm-close')).toHaveText('Cerrar');
    await expect(sheet).not.toContainText('Sign in as admin');
    await expect(sheet).not.toContainText('Room admin');
  });
});
