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

// Invite, the lead switch, and Full screen on a sharer's app bar were the last
// English words on it. The before/after shot shows the bar as the sharer sees it.
async function barWords(page, tap) {
  return page.evaluate((t) => window.__gifosVideo.appWordsForTest(t), tap);
}
async function barShot(page, name) {
  await page.locator('#appbar').screenshot({ path: 'test/desktop/shots/' + name });
}

test('an English app bar still says Invite, Communal, and Full screen', async ({ page }) => {
  await boot(page, 'qawordsen');
  const bar = await barWords(page, false);
  expect(bar.invite.text).toBe('Invite');
  expect(bar.lead.text).toBe('Communal');
  expect(bar.full.label).toBe('Full screen');
  const led = await barWords(page, true);
  expect(led.lead.text).toBe('👑 Leading');
  expect(led.status).toContain('You lead the app');
});

for (const [locale, lang, want] of [
  ['de-DE', 'German', { invite: 'Einladen', inviteTip: 'Link', communal: 'Gemeinsam', commTip: 'jeder', leading: '👑 Sie leiten', leadTip: 'Sie leiten', full: 'Vollbild', status: 'Sie leiten die App' }],
  ['es-MX', 'Spanish', { invite: 'Invitar', inviteTip: 'enlace', communal: 'Entre todos', commTip: 'cualquiera', leading: '👑 Diriges', leadTip: 'Diriges', full: 'Pantalla completa', status: 'Diriges la app' }],
]) {
  test.describe(lang + ' app bar words', () => {
    test.use({ locale });
    test('Invite, the lead switch, and Full screen follow ' + lang, async ({ page }) => {
      await boot(page, 'qawords' + locale.slice(0, 2));
      const bar = await barWords(page, false);
      if (locale === 'de-DE') await barShot(page, 'app-words-de-1280.png');
      expect(bar.invite.text).toBe(want.invite);
      expect(bar.invite.title).toContain(want.inviteTip);
      expect(bar.lead.display).not.toBe('none');
      expect(bar.lead.text).toBe(want.communal);
      expect(bar.lead.title).toContain(want.commTip);
      expect(bar.full.label).toBe(want.full);
      expect(bar.full.title).toBe(want.full);
      for (const key of ['invite', 'lead']) expect(bar[key].font).toBeGreaterThanOrEqual(16);
      const led = await barWords(page, true);
      expect(led.lead.text).toBe(want.leading);
      expect(led.lead.title).toContain(want.leadTip);
      expect(led.status).toContain(want.status);
      expect(led.status).not.toContain('You lead');
      const box = await page.evaluate(() => {
        const bar = document.getElementById('appbar');
        const buttons = [...bar.querySelectorAll('button')].filter((b) => getComputedStyle(b).display !== 'none');
        return { right: Math.max(...buttons.map((b) => b.getBoundingClientRect().right)), iw: window.innerWidth };
      });
      expect(box.right).toBeLessThanOrEqual(box.iw + 1);
    });
  });
}
