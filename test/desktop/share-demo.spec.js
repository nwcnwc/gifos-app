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
  const dock = await page.evaluate(() => {
    const btn = document.getElementById('sharebtn');
    const bar = document.querySelector('.bar');
    const word = btn && btn.querySelector('.dockword');
    const r = btn.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    return {
      inMore: !!(btn && btn.closest('#barmore')),
      collapsed: bar.classList.contains('collapsed'),
      word: word ? word.textContent.trim() : '',
      inBar: r.top >= br.top - 2 && r.bottom <= br.bottom + 2 && r.left >= br.left - 2 && r.right <= br.right + 2,
      onScreen: r.width > 8 && r.left >= -1 && r.right <= window.innerWidth + 1,
    };
  });
  expect(dock.inMore).toBe(false);
  expect(dock.collapsed).toBe(true);
  expect(dock.word).toBe('Share');
  expect(dock.inBar).toBe(true);
  expect(dock.onScreen).toBe(true);
  await armSlide(page);
  await page.click('#sharebtn');
  await expect(page.locator('#share-modal')).toBeHidden();
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
  await expect(page.locator('#sharebtn')).toHaveText('Share');
});

test('the menu steps aside once the slide is up, and the thumbnail can stop it', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await boot(page);
  await armSlide(page);
  await page.click('#sharebtn');
  await expect(page.locator('#share-modal')).toBeHidden();
  await expect.poll(async () => page.evaluate(() => {
    const v = document.querySelector('#stagefeed video');
    return v ? v.videoWidth : 0;
  })).toBeGreaterThanOrEqual(640);
  const laid = await page.evaluate(() => {
    const bar = document.querySelector('.bar');
    const more = document.getElementById('barmore');
    const me = document.querySelector('#grid .tile.me');
    const chip = me && me.querySelector('.stopshare');
    const chips = me && me.querySelector('.chips');
    const video = document.querySelector('#stagefeed video');
    const mr = more.getBoundingClientRect();
    const vr = video.getBoundingClientRect();
    const cr = chip.getBoundingClientRect();
    const pr = chips.getBoundingClientRect();
    const tr = me.getBoundingClientRect();
    const overlap = mr.width > 8 && mr.height > 8 && mr.bottom > vr.top + 4 && mr.top < vr.bottom - 4 && mr.right > vr.left + 4 && mr.left < vr.right - 4;
    return {
      collapsed: bar.classList.contains('collapsed'),
      pref: localStorage.getItem('gifos_meet_bar'),
      moreDisplay: getComputedStyle(more).display,
      coversSlide: overlap,
      text: chip.textContent.trim(),
      pe: getComputedStyle(chip).pointerEvents,
      inTile: cr.left >= tr.left - 1 && cr.right <= tr.right - 1 && cr.top >= tr.top - 1 && cr.bottom <= tr.bottom - 1,
      inChips: cr.left >= pr.left - 1 && cr.right <= pr.right - 1,
      chipW: Math.round(cr.width),
      chipsW: Math.round(pr.width),
    };
  });
  expect(laid.collapsed).toBe(true);
  expect(laid.pref).toBe(null);
  expect(laid.moreDisplay).toBe('none');
  expect(laid.coversSlide).toBe(false);
  expect(laid.text).toContain('Stop sharing');
  expect(laid.pe).toBe('auto');
  expect(laid.inTile).toBe(true);
  expect(laid.inChips).toBe(true);
  expect(laid.chipW).toBeGreaterThan(40);
  await page.locator('#grid .tile.me .stopshare').click();
  await expect(page.locator('#stagefeed video')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/screen-on/);
});

test.describe('the stage line follows the device', () => {
  test.use({ locale: 'de-DE' });
  test('a German device names the slide in German', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
    await boot(page);
    await armSlide(page);
    await page.click('#sharebtn');
    await expect.poll(async () => page.evaluate(() => {
      const v = document.querySelector('#stagefeed video');
      return v ? v.videoWidth : 0;
    })).toBeGreaterThanOrEqual(640);
    const line = await page.evaluate(() => {
      const el = document.querySelector('#stagefeed .rlabel');
      const chip = document.querySelector('#grid .tile.me .stopshare');
      const stageChip = [...document.querySelectorAll('#grid .tile.me .chips span')].map((n) => n.textContent.trim());
      return {
        label: el ? el.textContent.trim() : '',
        font: el ? parseFloat(getComputedStyle(el).fontSize) : 0,
        clip: el ? el.scrollWidth > el.clientWidth + 1 : true,
        chip: chip ? chip.textContent.trim() : '',
        stageChip,
      };
    });
    expect(line.label).toBe('🖥 Ihr Bildschirm — auf der Bühne');
    expect(line.label).not.toContain('Your screen');
    expect(line.font).toBeGreaterThanOrEqual(16);
    expect(line.clip).toBe(false);
    expect(line.chip).toBe('🖥 Beenden');
    expect(line.stageChip.some((t) => t.indexOf('auf der Bühne') >= 0)).toBe(true);
    expect(line.stageChip.some((t) => t === '🎙 on stage')).toBe(false);
  });
});
