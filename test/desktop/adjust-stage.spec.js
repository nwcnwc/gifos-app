const { test, expect } = require('@playwright/test');
const path = require('path');

// More → Settings → Adjust stage video opens the Stage frame window
// ("Frame what the Stage shows") and does not put anyone on the stage.
test.use({
  // WebKit 27.2 rejects --disable-gpu and never reaches the chromium-only skip.
  launchOptions: async ({ browserName }, use) => {
    if (browserName !== 'chromium') { await use({}); return; }
    await use({ args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  },
  permissions: async ({ browserName }, use) => use(browserName === 'chromium' ? ['camera', 'microphone'] : []),
});

function membership() {
  const V = window.__gifosVideo;
  const ids = V.stageIds();
  const me = V.myPid();
  return {
    myStg: V.stageFlagForTest() || 0,
    flips: V.stageFlipsForTest(),
    on: !!V.onStage(),
    inIds: ids.indexOf(me) >= 0,
    n: ids.length,
    swap: !!window.__meetSwapSelf,
    selfOn: !!(window.__meetSelf && window.__meetSelf.onStage),
  };
}

test('Adjust stage video opens the adjust window and does not set stage membership', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'fake camera');
  const room = 'qaadjust' + Date.now().toString(36);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Maya Chen');
    sessionStorage.setItem('gifos_appeared', '1');
    localStorage.removeItem('meet.frame.v1.stage');
  });
  await page.goto('/run.html#v=' + room + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.evaluate(() => document.getElementById('cam').click());
  await page.waitForFunction(() => {
    const s = window.__gifosVideo && window.__gifosVideo.sentShapeForTest && window.__gifosVideo.sentShapeForTest();
    return !!(s && s.w);
  });

  const before = await page.evaluate(membership);
  expect(before.on).toBe(false);
  expect(before.myStg).toBe(0);
  expect(before.inIds).toBe(false);
  expect(before.swap).toBe(false);
  expect(before.selfOn).toBe(false);

  await page.click('#bartoggle');
  const menu = await page.evaluate(() => ({
    self: !!document.getElementById('selfstage'),
    label: (document.getElementById('barmore') && document.getElementById('barmore').innerText) || '',
    inMore: !!document.querySelector('#barmore #adjust-stage'),
  }));
  expect(menu.self).toBe(false);
  expect(menu.label).not.toContain('Show me on stage');
  expect(menu.inMore).toBe(false);

  await page.click('#setbtn');
  await expect(page.locator('#set-modal')).toBeVisible();
  const btn = page.locator('#set-modal #adjust-stage');
  await expect(btn).toHaveText('Adjust stage video');
  const home = await page.evaluate(() => {
    const b = document.getElementById('adjust-stage');
    return { settings: !!(b && b.closest('#set-modal')), more: !!(b && b.closest('#barmore')) };
  });
  expect(home).toEqual({ settings: true, more: false });

  await btn.click();
  await expect(page.locator('#tilewin .tw-stageframe')).toBeVisible();
  await expect(page.locator('#tilewin .tw-stageframe b')).toHaveText('Frame what the Stage shows');
  await expect(page.locator('#set-modal')).toBeHidden();

  const g = await page.locator('#tilewin .tw-stageframe .tw-rect').boundingBox();
  expect(g).toBeTruthy();
  const x0 = g.x + g.width - 6, y0 = g.y + g.height - 6;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 - g.width * 0.25, y0 - g.height * 0.15, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const framed = await page.evaluate(() => window.__stageFrame.get());
  expect(framed && framed.w < 0.99).toBeTruthy();

  // A real step-up opens this same window about a second later. Stay off stage past that.
  await page.waitForTimeout(1500);
  const after = await page.evaluate(membership);
  expect(after).toEqual(before);
  await expect(page.locator('#stagebtn')).toHaveText('Stage');

  const box = await page.locator('#tilewin').boundingBox();
  expect(box && box.width).toBeGreaterThan(40);
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  if (process.env.EVID) await page.screenshot({ path: path.join(process.env.EVID, 'adjust-open.png') });
});
