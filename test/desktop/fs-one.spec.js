const { test, expect } = require('@playwright/test');

// One Full screen button for the whole screen (Nathan 2026-10-17), and it is
// the OS header's (2026-10-18 19:26): no tile and no dock carries its own, the
// header's #appfull is the only one, and it takes the whole page full screen.
// FS_SHOT=before names the pictures for a base run.
const SHOT = process.env.FS_SHOT || 'after';

async function boot(page, width, height, hash, name) {
  await page.setViewportSize({ width: width, height: height });
  await page.addInitScript((nm) => {
    localStorage.setItem('gifos_name', nm); sessionStorage.setItem('gifos_appeared', '1');
    window.__fsChangeAt = 0;
    document.addEventListener('fullscreenchange', () => { window.__fsChangeAt = Date.now(); }, true);
  }, name || 'Jordan Lee');
  await page.goto('/run.html#' + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
}

async function seed(page, n) {
  const seeded = await page.evaluate((n) => window.__gifosVideo.seedGalleryForTest({ count: n, connected: true }), n);
  expect(seeded && seeded.ok).toBe(true);
  await page.waitForFunction((n) => document.querySelectorAll('#feed .tile').length >= n, n);
}

// Every control on the page that says Full screen in its name, tip or words,
// shown or waiting in the folded More sheet.
async function fullControls(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button, [role="button"]')) {
      if (el.closest('#fsview')) continue;
      const said = ((el.getAttribute('aria-label') || '') + ' ' + (el.title || '') + ' ' + (el.textContent || '')).replace(/\s+/g, ' ').toLowerCase();
      if (!said.includes('full screen') && !el.classList.contains('maxbtn')) continue;
      if (el.getClientRects().length || el.closest('#barmore')) out.push(el.id || el.className);
    }
    return out;
  });
}

// The call goes calm 3 s after the last move and the header fades with it;
// a move wakes it, as a person reaches for it.
async function wake(page) {
  const vp = page.viewportSize();
  if (await page.evaluate(() => document.body.classList.contains('chrome-away'))) {
    await page.mouse.click(vp.width / 2, vp.height / 2);
    await page.waitForFunction(() => !document.body.classList.contains('chrome-away'));
  }
  await page.mouse.move(vp.width / 2 - 3, vp.height / 3 - 3);
  await page.mouse.move(vp.width / 2, vp.height / 3, { steps: 2 });
  await page.waitForTimeout(150);
}

// Let the browser's full screen finish changing before the next key, as a
// person would: Firefox swallows a key in the ~40 ms its change takes.
async function quiet(page) {
  await page.waitForFunction(() => Date.now() - window.__fsChangeAt > 250);
}
async function openedUp(page) {
  await page.waitForFunction(() => document.fullscreenElement === document.documentElement);
  await quiet(page);
}
async function closedOut(page) {
  await page.waitForFunction(() => !document.fullscreenElement);
  await quiet(page);
}

async function oneButton(page, shot) {
  await wake(page);
  await page.screenshot({ path: 'test/desktop/shots/fsone-' + SHOT + '-' + shot + '.png' });
  expect(await fullControls(page)).toEqual(['appfull']);
  await expect(page.locator('#appfull')).toHaveAttribute('aria-keyshortcuts', 'F');
  // The header auto-hides with the calm dock (16:42 rule); a slow screenshot
  // can outlast the calm delay, so reach for the button the way a person
  // does: the move wakes the header, then the click.
  await wake(page);
  await page.click('#appfull');
  await openedUp(page);
  await expect(page.locator('#appfull')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => document.exitFullscreen());
  await closedOut(page);
  await expect(page.locator('#appfull')).toHaveAttribute('aria-pressed', 'false');
}

async function meetCase(page, width, height, shot) {
  await boot(page, width, height, 'v=qafsone&debug=on');
  await seed(page, 3);
  await oneButton(page, shot);
  // The meeting stays laid out as it was: every face is still on the page.
  await wake(page);
  await page.click('#appfull');
  await openedUp(page);
  expect(await page.evaluate(() => document.querySelectorAll('#feed .tile[data-comfy="1"]').length)).toBeGreaterThanOrEqual(4);
  await page.evaluate(() => document.exitFullscreen());
  await closedOut(page);
  // F opens it and F again closes it.
  await page.mouse.click(width / 2, 8);
  await page.keyboard.press('f');
  await openedUp(page);
  await page.keyboard.press('f');
  await closedOut(page);
}

test('desktop Meet: one Full screen button, the OS header\'s, none on a face or the dock', async ({ page }) => {
  await meetCase(page, 1280, 720, 'meet-1280');
});

test('phone Meet: one Full screen button, the OS header\'s, none on a face or the dock', async ({ page }) => {
  await meetCase(page, 390, 844, 'meet-phone');
});

test('Broadcast desktop: one Full screen button, the OS header\'s, none on a face or the dock', async ({ page }) => {
  await boot(page, 1280, 720, 'v=qafsbc&av=0123456789abcdef&bc=1&debug=on', 'Pastor Kim');
  const armed = await page.evaluate(() => window.__gifosVideo.armBroadcastHostForTest());
  expect(armed && armed.ok).toBe(true);
  await page.waitForTimeout(400);
  await oneButton(page, 'bcast-1280');
});
