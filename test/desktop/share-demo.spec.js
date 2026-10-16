const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qashare&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: true }));
  expect(seeded && seeded.ok).toBe(true);
}

async function armSlide(page) {
  await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 720;
    const x = c.getContext('2d');
    x.fillStyle = '#f7f4ec';
    x.fillRect(0, 0, 1280, 720);
    x.fillStyle = '#14203a';
    x.font = '700 80px Georgia, serif';
    x.fillText('Q3 plan', 72, 200);
    const stream = c.captureStream(8);
    navigator.mediaDevices.getDisplayMedia = () => Promise.resolve(stream);
  });
}

test('a consultant can put a slide on the stage and stop it', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await boot(page);
  await page.click('#bartoggle');
  await page.click('#sharebtn');
  await expect(page.locator('#share-modal')).toBeVisible();
  await expect(page.locator('#share-go')).toHaveText('Choose what to share…');
  const sheet = await page.evaluate(() => {
    const go = document.getElementById('share-go');
    const title = document.querySelector('#share-modal h3');
    const note = document.getElementById('share-appnote');
    return {
      go: parseFloat(getComputedStyle(go).fontSize),
      title: parseFloat(getComputedStyle(title).fontSize),
      note: parseFloat(getComputedStyle(note).fontSize),
    };
  });
  expect(sheet.go).toBeGreaterThanOrEqual(16);
  expect(sheet.title).toBeGreaterThanOrEqual(22);
  expect(sheet.note).toBeGreaterThanOrEqual(16);
  await armSlide(page);
  await page.click('#share-go');
  const stage = page.locator('#stagefeed video');
  await expect(stage).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const v = document.querySelector('#stagefeed video');
    return v ? v.videoWidth : 0;
  })).toBeGreaterThanOrEqual(640);
  const fit = await page.evaluate(() => {
    const v = document.querySelector('#stagefeed video');
    const stop = document.querySelector('#stagefeed .stagestop');
    const vr = v.getBoundingClientRect();
    const sr = stop ? stop.getBoundingClientRect() : null;
    const dock = document.querySelector('.bar').getBoundingClientRect();
    const overlap = (a, b) => !!(a && b && a.width > 8 && a.bottom > b.top + 4 && a.top < b.bottom - 4 && a.right > b.left + 4 && a.left < b.right - 4);
    return {
      vw: v.videoWidth,
      vh: v.videoHeight,
      h: vr.height,
      w: vr.width,
      onScreen: vr.top >= -1 && vr.left >= -1 && vr.right <= window.innerWidth + 1 && vr.bottom <= window.innerHeight + 1,
      coversDock: overlap(vr, dock),
      stop: stop ? stop.textContent.trim() : '',
      stopFont: stop ? parseFloat(getComputedStyle(stop).fontSize) : 0,
      stopOn: !!(sr && sr.top >= -1 && sr.left >= -1 && sr.right <= window.innerWidth + 1 && sr.bottom <= window.innerHeight + 1),
      stopInSlide: !!(sr && sr.left >= vr.left - 1 && sr.right <= vr.right + 1 && sr.top >= vr.top - 1 && sr.bottom <= vr.bottom + 1),
      stopCoversDock: overlap(sr, dock),
      fit: getComputedStyle(v).objectFit,
      label: (document.querySelector('#stagefeed .rlabel') || {}).textContent || '',
      labelFont: (() => {
        const el = document.querySelector('#stagefeed .rlabel');
        return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
      })(),
      labelClip: (() => {
        const el = document.querySelector('#stagefeed .rlabel');
        return el ? el.scrollWidth > el.clientWidth + 1 : true;
      })(),
    };
  });
  expect(fit.vw).toBeGreaterThanOrEqual(640);
  expect(fit.h).toBeGreaterThanOrEqual(280);
  expect(fit.onScreen).toBe(true);
  expect(fit.coversDock).toBe(false);
  expect(fit.fit).toBe('contain');
  expect(fit.stop).toBe('Stop sharing');
  expect(fit.stopFont).toBeGreaterThanOrEqual(16);
  expect(fit.stopOn).toBe(true);
  expect(fit.stopInSlide).toBe(true);
  expect(fit.stopCoversDock).toBe(false);
  expect(fit.label).toContain('Your screen');
  expect(fit.labelFont).toBeGreaterThanOrEqual(16);
  expect(fit.labelClip).toBe(false);

  await page.click('#stagefeed .stagestop');
  await expect(page.locator('#stagefeed video')).toHaveCount(0);
  await expect(page.locator('#sharebtn')).toHaveText('Share screen');
});
