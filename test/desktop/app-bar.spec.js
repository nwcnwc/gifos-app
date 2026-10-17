const { test, expect } = require('@playwright/test');

async function boot(page, room) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=' + room + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
}

test('an English app bar still says Save, Steal, Hide, and Talk', async ({ page }) => {
  await boot(page, 'qabaren');
  const bar = await page.evaluate(() => window.__gifosVideo.appBarForTest(false));
  expect(bar.save.text).toBe('Save');
  expect(bar.steal.text).toBe('Steal');
  expect(bar.hide.text).toBe('Hide');
  expect(bar.talk.text).toBe('Talk: off');
  expect(bar.talk.title).toContain('host only');
  const on = await page.evaluate(() => window.__gifosVideo.appBarForTest(true));
  expect(on.talk.text).toBe('Talk: on');
  const choices = await page.evaluate(() => window.__gifosVideo.stealChoicesForTest());
  expect(choices.map((c) => c.text)).toEqual(['+ data', 'as I joined', 'app only']);
});

test.describe('German app bar', () => {
  test.use({ locale: 'de-DE' });
  test('Save, Steal, Hide, and Talk follow German', async ({ page }) => {
    await boot(page, 'qabarde');
    const bar = await page.evaluate(() => window.__gifosVideo.appBarForTest(false));
    expect(bar.save.text).toBe('Speichern');
    expect(bar.save.title).toContain('gehört Ihnen');
    expect(bar.steal.text).toBe('Kopieren');
    expect(bar.steal.title).toContain('Stolen Apps');
    expect(bar.hide.text).toBe('Ausblenden');
    expect(bar.hide.title).toContain('Ihrem Bildschirm');
    expect(bar.talk.text).toBe('Sprechen: aus');
    expect(bar.talk.title).toContain('Mikrofon');
    for (const key of ['save', 'steal', 'hide', 'talk']) expect(bar[key].font).toBeGreaterThanOrEqual(16);
    expect(bar.save.text).not.toBe('Save');
    expect(bar.talk.text).not.toContain('Talk');
    const on = await page.evaluate(() => window.__gifosVideo.appBarForTest(true));
    expect(on.talk.text).toBe('Sprechen: an');
    const choices = await page.evaluate(() => window.__gifosVideo.stealChoicesForTest());
    expect(choices.map((c) => c.text)).toEqual(['+ Daten', 'wie ich kam', 'nur die App']);
    expect(choices[0].title).toContain('jetzt darin');
    expect(choices[2].title).toContain('keine Daten');
    const box = await page.evaluate(() => {
      const bar = document.getElementById('appbar');
      const r = bar.getBoundingClientRect();
      const buttons = [...bar.querySelectorAll('button')].filter((b) => getComputedStyle(b).display !== 'none');
      const right = Math.max(...buttons.map((b) => b.getBoundingClientRect().right));
      return { top: r.top, bottom: r.bottom, right, iw: window.innerWidth, ih: window.innerHeight };
    });
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(box.iw + 1);
    expect(box.bottom).toBeLessThanOrEqual(box.ih);
  });
});

test.describe('Spanish app bar', () => {
  test.use({ locale: 'es-MX' });
  test('Save, Steal, Hide, and Talk follow Spanish', async ({ page }) => {
    await boot(page, 'qabares');
    const bar = await page.evaluate(() => window.__gifosVideo.appBarForTest(false));
    expect(bar.save.text).toBe('Guardar');
    expect(bar.steal.text).toBe('Copiar');
    expect(bar.hide.text).toBe('Ocultar');
    expect(bar.hide.title).toContain('tu pantalla');
    expect(bar.talk.text).toBe('Hablar: no');
    expect(bar.talk.title).toContain('micrófono');
    const on = await page.evaluate(() => window.__gifosVideo.appBarForTest(true));
    expect(on.talk.text).toBe('Hablar: sí');
    const choices = await page.evaluate(() => window.__gifosVideo.stealChoicesForTest());
    expect(choices.map((c) => c.text)).toEqual(['+ datos', 'como entré', 'solo la app']);
  });
});
