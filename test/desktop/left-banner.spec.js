const { test, expect } = require('@playwright/test');
const path = require('path');

// Leaving closes the pairs. The You-left screen must not then wear the
// "cannot connect" line, and that line must not be cut off in the header.
test.use({
  launchOptions: { args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

const SHOT = process.env.SHOT || 'run';
const EVID = process.env.EVID || path.join(__dirname, '..', '..', 'evidence-local');

// Skip before the browser launches. An in-test skip still starts WebKit
// with --disable-gpu (chat-options does the skip at describe scope).
test.describe('chromium only', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough');
test('You left does not show a cut-off cannot-connect banner', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jamal Brooks');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qaleft' + Date.now().toString(36) + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: true }));
  expect(seeded && seeded.ok).toBe(true);
  await expect.poll(() => page.evaluate(() => document.getElementById('status').dataset.reach || '')).toBe('');

  // Leave, then the pairs go dead the way a closed connection does, while
  // the faces are still on screen (the farewell drain has not deleted them).
  const info = await page.evaluate(() => {
    document.getElementById('leavebtn').click();
    window.__gifosVideo.setPeerNetForTest('qa1', { connected: false, noRoute: true, neverUp: true });
    window.__gifosVideo.setPeerNetForTest('qa2', { connected: false, noRoute: true, neverUp: true });
    const st = document.getElementById('status');
    const lm = document.getElementById('left-modal');
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:nowrap;visibility:hidden';
    const cs = getComputedStyle(st);
    probe.style.font = cs.font;
    probe.textContent = st.textContent;
    document.body.appendChild(probe);
    const words = probe.offsetWidth;
    probe.remove();
    return {
      left: lm.style.display,
      title: (lm.querySelector('h3') || {}).textContent || '',
      text: st.textContent,
      reach: st.dataset.reach || '',
      alert: st.classList.contains('alert'),
      words: words,
      cw: st.clientWidth,
      cut: words > st.clientWidth + 2,
      tiles: document.querySelectorAll('#feed .tile, #grid .tile').length,
    };
  });
  await page.screenshot({ path: path.join(EVID, 'left-' + SHOT + '.png') });
  expect(info.left, JSON.stringify(info)).toBe('flex');
  expect(info.title, JSON.stringify(info)).toContain('You left');
  expect(info.tiles, JSON.stringify(info)).toBeGreaterThan(0);
  expect(info.text, JSON.stringify(info)).not.toContain('cannot connect');
  expect(info.reach, JSON.stringify(info)).toBe('');
  expect(info.alert, JSON.stringify(info)).toBe(false);
  expect(info.cut, JSON.stringify(info)).toBe(false);
});
});
