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

test('a phone that kills the camera while you are still looking says so', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qaphonevisible&debug=on', { waitUntil: 'domcontentloaded' });
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
  const mark = page.locator('.tile.me .cambackmark');
  await expect(mark).toBeVisible({ timeout: 7000 });
  await expect(mark).toHaveText('Camera stopped — bringing it back');
  expect(await page.evaluate(() => window.__gumN || 0)).toBe(2);
  const fit = await page.evaluate(() => {
    const el = document.querySelector('.tile.me .cambackmark');
    const tile = document.querySelector('.tile.me');
    const er = el.getBoundingClientRect();
    const tr = tile.getBoundingClientRect();
    return {
      font: parseFloat(getComputedStyle(el).fontSize),
      inTile: er.left >= tr.left - 1 && er.right <= tr.right + 1 && er.top >= tr.top - 1 && er.bottom <= tr.bottom + 1,
      clipped: el.scrollWidth > el.clientWidth + 2,
      hidden: document.hidden,
    };
  });
  expect(fit.hidden).toBe(false);
  expect(fit.font).toBeGreaterThanOrEqual(20);
  expect(fit.inTile).toBe(true);
  expect(fit.clipped).toBe(false);
  await page.evaluate(() => window.__releaseCam());
  await expect(mark).toBeHidden();
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

async function paintedCam(page, hash, color, width) {
  await page.setViewportSize(width ? { width: width, height: 720 } : { width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=' + hash + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.evaluate((fill) => {
    let n = 0;
    let release = null;
    window.__releaseCam = () => { if (release) { const go = release; release = null; go(); } };
    // Repaint every 100ms so the track keeps sending frames and never reads muted.
    const stream = (paint) => {
      const c = document.createElement('canvas');
      c.width = 320; c.height = 180;
      c.style.cssText = 'position:fixed;left:-4000px;top:0';
      document.body.appendChild(c);
      const x = c.getContext('2d');
      const draw = () => { x.fillStyle = paint; x.fillRect(0, 0, 320, 180); };
      draw();
      setInterval(draw, 100);
      return c.captureStream(10);
    };
    navigator.mediaDevices.getUserMedia = () => {
      n += 1;
      window.__gumN = n;
      (window.__gumAt = window.__gumAt || []).push(performance.now());
      if (n === 1) return Promise.resolve(stream(fill));
      return new Promise((res) => { release = () => res(stream('#c45b3e')); });
    };
  }, color);
  await page.click('#cam');
  await expect.poll(() => page.evaluate(() => window.__gumN || 0)).toBe(1);
}

test('a live camera that paints pure black says so before it restarts', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await paintedCam(page, 'qaphonepureblack', '#000000');
  const mark = page.locator('.tile.me .cambackmark');
  // One 3s sample, plus slack. The re-grab waits for the third sample (~9s).
  await expect(mark).toBeVisible({ timeout: 4500 });
  await expect(mark).toHaveText('Camera stopped — bringing it back');
  expect(await page.evaluate(() => window.__gumN || 0)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__gumN || 0), { timeout: 12000 }).toBe(2);
  const reason = await page.evaluate(() => (window.__regrabLog || []).map((r) => r.reason).pop());
  expect(reason).toBe('blackCamWatch:dark-pixels');
  await page.evaluate(() => window.__releaseCam());
  await expect(mark).toBeHidden({ timeout: 8000 });
});

test('a dark room that is still painting does not flash the camera line', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await paintedCam(page, 'qaphonedarkroom', '#0a0a0a');
  const mark = page.locator('.tile.me .cambackmark');
  // At most two samples fit in 5s, and the line must not show for either.
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    expect(await mark.isVisible()).toBe(false);
    await page.waitForTimeout(250);
  }
  expect(await page.evaluate(() => window.__gumN || 0)).toBe(1);
});

test('a dark room that is still painting never restarts the camera', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await paintedCam(page, 'qaphonedarkstay', '#0a0a0a');
  const mark = page.locator('.tile.me .cambackmark');
  // Four 3s samples. The old watchdog re-grabbed a dim room on the third.
  const t0 = Date.now();
  while (Date.now() - t0 < 13000) {
    expect(await mark.isVisible()).toBe(false);
    await page.waitForTimeout(250);
  }
  expect(await page.evaluate(() => (window.__regrabLog || []).map((r) => r.reason))).toEqual([]);
  expect(await page.evaluate(() => window.__gumN || 0)).toBe(1);
});

// The old watchdog re-grabbed on the third 3s sample, so a dead camera was
// never back before 6s (up to 9s). A desktop call should get it back in ~4s.
test('a desktop camera that goes pure black is grabbed again within a few seconds', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await paintedCam(page, 'qadeskblackfast', '#000000', 1280);
  await expect.poll(() => page.evaluate(() => window.__gumN || 0), { timeout: 12000 }).toBe(2);
  const gap = await page.evaluate(() => window.__gumAt[1] - window.__gumAt[0]);
  expect(gap).toBeLessThan(5500);
  const reason = await page.evaluate(() => (window.__regrabLog || []).map((r) => r.reason).pop());
  expect(reason).toBe('blackCamWatch:dark-pixels');
  await page.evaluate(() => window.__releaseCam());
  await expect(page.locator('.tile.me .cambackmark')).toBeHidden({ timeout: 8000 });
});

test('a desktop camera that stops sending frames is grabbed again within a few seconds', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await paintedCam(page, 'qadeskmutefast', '#3d6b4f', 1280);
  // Let the picture settle first, then kill it, so the clock starts at the death.
  await page.waitForTimeout(1500);
  const dead = await page.evaluate(() => { window.__gifosForceBlackCamHold = true; return performance.now(); });
  await expect.poll(() => page.evaluate(() => window.__gumN || 0), { timeout: 12000 }).toBe(2);
  const gap = await page.evaluate((t) => window.__gumAt[1] - t, dead);
  expect(gap).toBeLessThan(5500);
  await page.evaluate(() => { window.__gifosForceBlackCamHold = false; window.__releaseCam(); });
  await expect(page.locator('.tile.me .cambackmark')).toBeHidden({ timeout: 8000 });
});

// A grab used to stop the blur canvas and start a new one, so the track the
// room receives ended and was replaced (and a staged feed got a new id). The
// room should keep the same picture track and see the fresh camera on it.
test('a camera grabbed again keeps the same picture track for the room', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await paintedCam(page, 'qadesksametrack', '#000000', 1280);
  await expect.poll(() => page.evaluate(() => {
    const v = document.querySelector('.tile.me video');
    const t = v && v.srcObject && v.srcObject.getVideoTracks()[0];
    if (t && t.kind === 'video' && t.readyState === 'live') window.__sentBefore = t;
    return !!window.__sentBefore;
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__gumN || 0), { timeout: 12000 }).toBe(2);
  await page.evaluate(() => window.__releaseCam());
  await expect(page.locator('.tile.me .cambackmark')).toBeHidden({ timeout: 8000 });
  // The fresh camera paints red; wait for it to reach the self-view, which
  // shows exactly the track that is sent.
  await expect.poll(() => page.evaluate(() => {
    const v = document.querySelector('.tile.me video');
    if (!v || !v.videoWidth) return 0;
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const x = c.getContext('2d');
    x.drawImage(v, 0, 0, 8, 8);
    return x.getImageData(4, 4, 1, 1).data[0];
  }), { timeout: 8000 }).toBeGreaterThan(120);
  const same = await page.evaluate(() => {
    const v = document.querySelector('.tile.me video');
    const t = v.srcObject.getVideoTracks()[0];
    return { same: t === window.__sentBefore, state: window.__sentBefore.readyState };
  });
  expect(same).toEqual({ same: true, state: 'live' });
});
