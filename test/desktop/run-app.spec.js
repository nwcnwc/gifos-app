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

// An app running in a meeting puts its bar along the top of the page, where the
// header pill (GifOS · Just you · Invite), Fit, and the build label also sit:
// they covered the app's picture and name, Stop app, and Full screen. Every
// control on the app bar must be clear of the header pieces, and every header
// piece still on screen must stay clear of the bar.
test('a running app\'s bar is clear of the header, Fit, and the build label', async ({ page }) => {
  await boot(page);
  await page.setInputFiles('#app-file-input', 'apps/2048/2048.gif');
  await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('appstop').getClientRects().length > 0);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const read = () => page.evaluate(() => {
    const shown = (el) => {
      if (!el || !el.getClientRects().length) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
    };
    const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const meet = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const heads = [document.querySelector('.topchip'), document.getElementById('fitbtn'),
      document.getElementById('gifos-build-float'), document.getElementById('handq')]
      .filter(shown).map((el) => ({ id: el.id || el.className, box: box(el) }));
    const bar = [...document.querySelectorAll('#appbar > *')].filter((el) => shown(el) && el.getBoundingClientRect().width > 0);
    const covered = [];
    for (const el of bar) for (const h of heads) if (meet(box(el), h.box)) covered.push((el.id || el.className) + ' under ' + h.id);
    return { covered, barIds: bar.map((el) => el.id || el.className) };
  });
  const got = await read();
  await page.screenshot({ path: 'test/desktop/shots/app-head-1280.png' });
  expect(got.barIds).toEqual(expect.arrayContaining(['appstop']));
  expect(got.barIds.some((id) => id === 'appgif' || id === 'appname')).toBe(true);
  expect(got.covered).toEqual([]);
});
