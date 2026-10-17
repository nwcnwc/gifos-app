const { test, expect } = require('@playwright/test');

async function boot(page, room) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=' + room + '&av=0123456789abcdef&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
}

test('an English host still says Stop app and Turn chat off', async ({ page }) => {
  await boot(page, 'qaworden');
  const stop = await page.evaluate(() => window.__gifosVideo.appStopForTest(true));
  const chat = await page.evaluate(() => window.__gifosVideo.chatModForTest(false));
  expect(stop.text).toBe('Stop app');
  expect(stop.title).toBe('Stop sharing this app with the meeting');
  await expect(page.locator('#apphelp')).toHaveText('Help');
  expect(chat.text).toBe('Turn chat off');
  expect(chat.title).toBe('Silence the chat for everyone but you');
  const off = await page.evaluate(() => window.__gifosVideo.chatModForTest(true));
  expect(off.text).toBe('Turn chat on');
  expect(off.line).toContain('Chat was turned off by Pastor Kim');
  const everyone = await page.evaluate(() => window.__gifosVideo.appStopForTest(false));
  expect(everyone.text).toBe('Stop for everyone');
});

test.describe('German host words', () => {
  test.use({ locale: 'de-DE' });
  test('Stop app and Turn chat off follow German', async ({ page }) => {
    await boot(page, 'qawordde');
    const stop = await page.evaluate(() => window.__gifosVideo.appStopForTest(true));
    const chat = await page.evaluate(() => window.__gifosVideo.chatModForTest(false));
    expect(stop.text).toBe('App beenden');
    expect(stop.title).toContain('App nicht mehr');
    await expect(page.locator('#apphelp')).toHaveText('Hilfe');
    expect(stop.font).toBeGreaterThanOrEqual(16);
    expect(chat.text).toBe('Chat ausschalten');
    expect(chat.title).toContain('für alle außer Ihnen');
    expect(chat.font).toBeGreaterThanOrEqual(16);
    expect(chat.display).not.toBe('none');
    const off = await page.evaluate(() => window.__gifosVideo.chatModForTest(true));
    expect(off.text).toBe('Chat einschalten');
    expect(off.line).toContain('Pastor Kim');
    expect(off.line).toContain('ausgeschaltet');
    expect(off.line).not.toContain('Turn chat');
    const everyone = await page.evaluate(() => window.__gifosVideo.appStopForTest(false));
    expect(everyone.text).toBe('Für alle beenden');
    expect(everyone.text).not.toBe('Stop for everyone');
  });
});

test.describe('Spanish host words', () => {
  test.use({ locale: 'es-MX' });
  test('Stop app and Turn chat off follow Spanish', async ({ page }) => {
    await boot(page, 'qawordes');
    const stop = await page.evaluate(() => window.__gifosVideo.appStopForTest(true));
    const chat = await page.evaluate(() => window.__gifosVideo.chatModForTest(false));
    expect(stop.text).toBe('Detener app');
    await expect(page.locator('#apphelp')).toHaveText('Ayuda');
    expect(chat.text).toBe('Apagar el chat');
    expect(chat.title).toContain('para todos menos tú');
    const off = await page.evaluate(() => window.__gifosVideo.chatModForTest(true));
    expect(off.text).toBe('Encender el chat');
    expect(off.line).toContain('Pastor Kim');
    expect(off.line).not.toContain('Turn chat');
    const everyone = await page.evaluate(() => window.__gifosVideo.appStopForTest(false));
    expect(everyone.text).toBe('Detener para todos');
  });
});
