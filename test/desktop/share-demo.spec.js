const { test, expect } = require('@playwright/test');
const { SEAT_VIEWS, seatPage, seatAndWake } = require('../shared/share-seat');

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

// A share obeys the blur rules (0.9.23b): it is clear only in a password
// room where everyone consents. The seeded faces consent (camera on, No
// blur); the hook stands in for the room's password, so the slide is clear.
async function consentedRoom(page) {
  expect(await page.evaluate(() => window.__gifosVideo.setClearForTest(true))).toBe(0);
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
  expect(dock.word).toBe('Share screen');
  expect(dock.inBar).toBe(true);
  expect(dock.onScreen).toBe(true);
  await armSlide(page);
  await page.click('#sharebtn');
  await expect(page.locator('#share-modal')).toBeHidden();
  const stage = page.locator('#stagefeed video');
  await expect(stage).toBeVisible();
  // With no password the slide goes up blurred: the Stage plays the blur
  // pipe's own smaller picture, never the raw 1280 screen.
  await expect.poll(() => page.evaluate(() => (document.querySelector('#stagefeed video') || {}).videoWidth || 0)).toBeGreaterThan(0);
  const soft = await page.evaluate(() => ({ level: window.__gifosVideo.blurClassOf('me'), vw: document.querySelector('#stagefeed video').videoWidth }));
  expect(soft.level).toBeGreaterThanOrEqual(1);
  expect(soft.vw).toBeLessThan(1280);
  // Once the room is a consented password room the same share goes clear.
  await consentedRoom(page);
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

// 0.9.23b: Stop sharing sits on the Stage (and in your own tile's control
// window); your small square in the Row does not repeat it.
test('the menu steps aside once the slide is up, and the Stage can stop it', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await boot(page);
  await consentedRoom(page);
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
    const stop = document.querySelector('#stagefeed .stagestop');
    const video = document.querySelector('#stagefeed video');
    const mr = more.getBoundingClientRect();
    const vr = video.getBoundingClientRect();
    const overlap = mr.width > 8 && mr.height > 8 && mr.bottom > vr.top + 4 && mr.top < vr.bottom - 4 && mr.right > vr.left + 4 && mr.left < vr.right - 4;
    return {
      collapsed: bar.classList.contains('collapsed'),
      pref: localStorage.getItem('gifos_meet_bar'),
      moreDisplay: getComputedStyle(more).display,
      coversSlide: overlap,
      text: stop ? stop.textContent.trim() : '',
      pe: stop ? getComputedStyle(stop).pointerEvents : '',
    };
  });
  expect(laid.collapsed).toBe(true);
  expect(laid.pref).toBe(null);
  expect(laid.moreDisplay).toBe('none');
  expect(laid.coversSlide).toBe(false);
  expect(laid.text).toContain('Stop sharing');
  expect(laid.pe).toBe('auto');
  // Your own tile's control window offers it too.
  await page.mouse.move(300, 300);
  const me = await page.locator('#feed .tile.me').boundingBox();
  await page.mouse.click(me.x + me.width / 2, me.y + me.height / 2);
  await expect(page.locator('#tilewin button', { hasText: 'Stop sharing' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#stagefeed .stagestop').click();
  await expect(page.locator('#stagefeed video')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/screen-on/);
});

// A shared screen and an app take the same seat (Nathan 19:02): sideways the
// slide is the whole left side, flush left, with the faces on the right (a
// phone at 844x390 had it centred at 366x206); upright it is the top band.
// Waking the buttons moves nothing (a 915x412 phone, read as a desktop,
// shrank the slide and moved every face on each tap).
for (const view of SEAT_VIEWS) {
  test('a shared screen takes the share seat at ' + view.tag + ' and a wake moves nothing', async ({ browser, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
    const { ctx, page } = await seatPage(browser, browserName, view, 'qashareseat');
    await consentedRoom(page);
    await armSlide(page);
    await page.evaluate(() => document.getElementById('sharebtn').click());
    await page.waitForFunction(() => document.body.classList.contains('show-stage'), null, { timeout: 15000 });
    const got = await seatAndWake(page, view, 'screen');
    await page.screenshot({ path: 'test/desktop/shots/share-seat-' + view.tag + '.png' });
    await ctx.close();
    expect(got.problems).toEqual([]);
    expect(got.rested).toBe(true);
    expect(got.woke).toBe(true);
    if (view.phone) expect([got.calm.away, got.after.away]).toEqual([true, false]);
    expect(got.moved).toEqual([]);
  });
}

test.describe('the stage line follows the device', () => {
  test.use({ locale: 'de-DE' });
  test('a German device names the slide in German', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
    await boot(page);
    await consentedRoom(page);
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
