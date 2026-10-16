const { test, expect } = require('@playwright/test');

test('a phone that kills the camera says so, then brings it back', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qaphone&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.evaluate(() => {
    let n = 0;
    let release = null;
    window.__releaseCam = () => { if (release) { const go = release; release = null; go(); } };
    const stream = () => {
      const c = document.createElement('canvas');
      c.width = 640; c.height = 360;
      c.style.cssText = 'position:fixed;left:-4000px;top:0';
      document.body.appendChild(c);
      const x = c.getContext('2d');
      x.fillStyle = '#c45b3e';
      x.fillRect(0, 0, 640, 360);
      return c.captureStream(8);
    };
    navigator.mediaDevices.getUserMedia = () => {
      n += 1;
      window.__gumN = n;
      if (n === 1) return Promise.resolve(stream());
      return new Promise((res) => { release = () => res(stream()); });
    };
  });
  await page.click('#cam');
  await expect.poll(() => page.evaluate(() => window.__gumN || 0)).toBe(1);
  const killed = await page.evaluate(() => window.__gifosVideo.killCameraForTest());
  expect(killed && killed.ended).toBe(true);
  await page.evaluate(() => window.__gifosVideo.setTabHiddenForTest(true));
  await page.evaluate(() => window.__gifosVideo.setTabHiddenForTest(false));
  const mark = page.locator('.tile.me .cambackmark');
  await expect(mark).toBeVisible();
  await expect(mark).toHaveText('Camera stopped — bringing it back');
  const fit = await page.evaluate(() => {
    const el = document.querySelector('.tile.me .cambackmark');
    const tile = document.querySelector('.tile.me');
    const name = tile.querySelector('.name');
    const er = el.getBoundingClientRect();
    const tr = tile.getBoundingClientRect();
    const nr = name ? name.getBoundingClientRect() : null;
    const dock = document.querySelector('.bar').getBoundingClientRect();
    const overlap = (a, b) => !!(a && b && a.width > 8 && a.bottom > b.top + 4 && a.top < b.bottom - 4 && a.right > b.left + 4 && a.left < b.right - 4);
    return {
      font: parseFloat(getComputedStyle(el).fontSize),
      onScreen: er.top >= -1 && er.left >= -1 && er.right <= window.innerWidth + 1 && er.bottom <= window.innerHeight + 1,
      inTile: er.left >= tr.left - 1 && er.right <= tr.right + 1 && er.top >= tr.top - 1 && er.bottom <= tr.bottom + 1,
      coversName: overlap(er, nr),
      coversDock: overlap(er, dock),
      clipped: el.scrollWidth > el.clientWidth + 2,
    };
  });
  expect(fit.font).toBeGreaterThanOrEqual(20);
  expect(fit.onScreen).toBe(true);
  expect(fit.inTile).toBe(true);
  expect(fit.coversName).toBe(false);
  expect(fit.coversDock).toBe(false);
  expect(fit.clipped).toBe(false);

  await page.evaluate(() => window.__releaseCam());
  await expect(mark).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__gumN || 0)).toBe(2);
});

test('a live camera that sends nothing says so before it restarts', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qaphoneblack&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.evaluate(() => {
    let n = 0;
    let release = null;
    window.__releaseCam = () => { if (release) { const go = release; release = null; go(); } };
    const stream = () => {
      const c = document.createElement('canvas');
      c.width = 320; c.height = 180;
      c.style.cssText = 'position:fixed;left:-4000px;top:0';
      document.body.appendChild(c);
      const x = c.getContext('2d');
      x.fillStyle = '#3d6b4f';
      x.fillRect(0, 0, 320, 180);
      return c.captureStream(5);
    };
    navigator.mediaDevices.getUserMedia = () => {
      n += 1;
      window.__gumN = n;
      if (n === 1) return Promise.resolve(stream());
      return new Promise((res) => { release = () => res(stream()); });
    };
  });
  await page.click('#cam');
  await expect.poll(() => page.evaluate(() => window.__gumN || 0)).toBe(1);
  await page.evaluate(() => { window.__gifosForceBlackCamHold = true; });
  const mark = page.locator('.tile.me .cambackmark');
  await expect(mark).toBeVisible({ timeout: 6000 });
  await expect(mark).toHaveText('Camera stopped — bringing it back');
  expect(await page.evaluate(() => window.__gumN || 0)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__gumN || 0), { timeout: 12000 }).toBe(2);
  await page.evaluate(() => { window.__gifosForceBlackCamHold = false; window.__releaseCam(); });
  await expect(mark).toBeHidden({ timeout: 8000 });
});
