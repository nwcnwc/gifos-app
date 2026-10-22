const { test, expect } = require('@playwright/test');
const path = require('path');

// A bot page has no pointer to wake the header. The GifOS logo and the
// count stay up with the transcribing mark. A person's page still fades
// those two when the call goes calm.
test.use({
  // Chromium-only flags: WebKit 27.2 rejects --disable-gpu and closes before
  // the chromium-only skip below is reached.
  launchOptions: async ({ browserName }, use) => {
    if (browserName !== 'chromium') { await use({}); return; }
    await use({ args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  },
});

const SHOT = process.env.SHOT || 'run';
const EVID = process.env.EVID || path.join(__dirname, '..', '..', 'evidence-local');

function shown(sel) {
  return [...document.querySelectorAll(sel)].some((e) => {
    const cs = getComputedStyle(e);
    if (!e.getClientRects().length || cs.display === 'none' || cs.visibility === 'hidden') return false;
    let op = 1;
    for (let x = e; x && x.nodeType === 1; x = x.parentElement) op *= Number(getComputedStyle(x).opacity);
    return op > 0.05;
  });
}

async function boot(page, bot) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript((isBot) => {
    localStorage.setItem('gifos_name', isBot ? 'Meeting Bot' : 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
    sessionStorage.setItem('gifos_appear_ok', '1');
  }, bot);
  const hash = bot ? '&bot=1' : '';
  await page.goto('/run.html#v=qabot' + Date.now().toString(36) + hash + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  if (bot) await expect.poll(() => page.evaluate(() => window.__gifosVideo.bot())).toBe(true);
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: true }));
  expect(seeded && seeded.ok).toBe(true);
  await page.mouse.move(640, 200);
  await page.evaluate(() => window.__gifosVideo.setDockCalmMsForTest(200));
  await page.waitForTimeout(500);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('dock-calm'))).toBe(true);
}

test('a bot header keeps the GifOS logo and the status line when calm', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine is enough');
  await boot(page, true);
  // Long enough for the header fade a person would get. A bot must still
  // be showing the logo and the count after that.
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(EVID, 'bot-' + SHOT + '.png') });
  expect(await page.evaluate(() => document.body.classList.contains('head-calm'))).toBe(false);
  expect(await page.evaluate(shown, '.topchip .title')).toBe(true);
  expect(await page.evaluate(shown, '.topchip #status')).toBe(true);
  expect(await page.evaluate(shown, '#txmark')).toBe(true);
  expect(await page.evaluate(() => document.getElementById('status').textContent)).toContain('in this meeting');
});

test('a person\'s header still fades to the transcribing mark when calm', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine is enough');
  await boot(page, false);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('head-calm'))).toBe(true);
  await expect.poll(() => page.evaluate(shown, '#txmark')).toBe(true);
  await expect.poll(() => page.evaluate(shown, '.topchip #status')).toBe(false);
  await expect.poll(() => page.evaluate(shown, '.topchip .title')).toBe(false);
});
