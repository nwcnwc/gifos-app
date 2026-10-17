import { test, expect } from '@playwright/test';

// Q73. A church takes its offering during the service, and a streamer takes
// tips. The host sets the giving page once in More; the viewer link carries
// it, and a viewer reads Give (Tip on a stream) on the picture and on the
// screen that says it ended. The tap opens the church's own giving page.

const AV = '0123456789abcdef0123456789abcdef';
const GIVE = 'https://give.example.org/grace-church?fund=sunday';

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['camera', 'microphone'] });

const fresh = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function roomUrl(name, extra) {
  return '/run.html#v=' + name + '&av=' + AV + '&bc=1' + (extra || '');
}

async function giveBox(page) {
  return page.evaluate(() => {
    const g = document.getElementById('bc-give');
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const leave = document.getElementById('leavebtn').getBoundingClientRect();
    if (!g) return null;
    const r = g.getBoundingClientRect();
    return {
      x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom,
      text: g.textContent.replace(/\s+/g, ' ').trim(),
      href: g.getAttribute('href'), target: g.target, rel: g.rel,
      label: g.getAttribute('aria-label') || '',
      inEnded: !!g.closest('#bc-ended'),
      barY: bar.y, leave: { x: leave.x, y: leave.y, right: leave.right, bottom: leave.bottom },
      vw: innerWidth, vh: innerHeight,
    };
  });
}

test('the host sets the giving page, and the viewer gives during the service', async ({ browser }, info) => {
  test.setTimeout(120000);
  const opts = info.project.use;
  const ctxH = await browser.newContext({ ...opts, permissions: ['camera', 'microphone'] });
  const ctxV = await browser.newContext({ ...opts });
  try {
    const h = await ctxH.newPage();
    await h.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
    await h.locator('#lob-admin-go').click();
    await expect(h.locator('#livebadge-txt')).toHaveText('LIVE', { timeout: 20000 });
    await h.locator('#bartoggle').click();
    const field = h.locator('#bcgive');
    await expect(field).toBeVisible();
    expect((await field.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await field.fill(GIVE);
    await field.dispatchEvent('change');
    await expect(h.locator('#bcgive-lbl')).toHaveText('Giving · give.example.org');
    const shared = await h.evaluate(() => {
      let payload = null;
      navigator.share = (p) => { payload = p; return Promise.resolve(); };
      window.__gifosVideo.shareInvite();
      return payload;
    });
    expect(shared && shared.url).toBeTruthy();
    const link = new URL(shared.url);
    const hp = new URLSearchParams(link.hash.slice(1));
    expect(hp.get('give')).toBe(GIVE);

    // A viewer opens that link while the host is live.
    const v = await ctxV.newPage();
    await v.goto('/run.html' + link.hash, { waitUntil: 'domcontentloaded' });
    await v.locator('#nmok').click();
    await v.waitForFunction(() => !!document.querySelector('#stagefeed .rowtile'), null, { timeout: 45000 });
    // The quiet screen gives way to the picture, and Give rides the picture.
    await expect(v.locator('#bc-ended')).toBeHidden();
    await expect(v.locator('#bc-give')).toBeVisible();
    const g = await giveBox(v);
    expect(g.text).toBe('Give');
    expect(g.href).toBe(GIVE);
    expect(g.target).toBe('_blank');
    expect(g.rel).toContain('noopener');
    expect(g.label).toContain('give.example.org');
    expect(g.h).toBeGreaterThanOrEqual(44);
    expect(g.w).toBeGreaterThanOrEqual(44);
    expect(g.x).toBeGreaterThanOrEqual(0);
    expect(g.right).toBeLessThanOrEqual(g.vw + 0.5);
    // On the picture, clear of the dock.
    expect(g.bottom).toBeLessThanOrEqual(g.barY + 0.5);
    expect(g.inEnded).toBe(false);

    // The tap opens the church's own page.
    await ctxV.route('https://give.example.org/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Give</title>Thank you' }));
    const [pop] = await Promise.all([ctxV.waitForEvent('page'), v.locator('#bc-give').click()]);
    await pop.waitForLoadState('domcontentloaded');
    expect(pop.url()).toBe(GIVE);
    await pop.close();

    // Large type and a rotated phone: Give stays 44px or more, on screen,
    // and clear of Fit, the chip, and the dock.
    const clear = async () => v.evaluate(() => {
      const r = document.getElementById('bc-give').getBoundingClientRect();
      const hit = (sel) => {
        const el = document.querySelector(sel);
        if (!el || !el.getClientRects().length) return false; // Fit and the chip are fixed: no offsetParent
        const o = el.getBoundingClientRect();
        return r.left < o.right && o.left < r.right && r.top < o.bottom && o.top < r.bottom;
      };
      return { h: r.height, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
        fit: hit('#fitbtn'), chip: hit('.topchip'), bar: hit('.bar') };
    });
    const want = { inside: true, fit: false, chip: false, bar: false };
    await v.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    await expect.poll(async () => { const c = await clear(); delete c.h; return c; }).toEqual(want);
    expect((await clear()).h).toBeGreaterThanOrEqual(44);
    await v.evaluate(() => { document.documentElement.style.fontSize = ''; });
    const vp = v.viewportSize();
    await v.setViewportSize({ width: vp.height, height: vp.width });
    await expect.poll(async () => { const c = await clear(); delete c.h; return c; }).toEqual(want);
    expect((await clear()).h).toBeGreaterThanOrEqual(44);

    // A reload of the host's phone keeps the giving page.
    await h.reload({ waitUntil: 'domcontentloaded' });
    await h.locator('#leavebtn').waitFor({ state: 'attached' });
    const again = await h.evaluate(() => {
      let payload = null;
      navigator.share = (p) => { payload = p; return Promise.resolve(); };
      window.__gifosVideo.shareInvite();
      return payload && payload.url;
    });
    expect(new URLSearchParams(new URL(again).hash.slice(1)).get('give')).toBe(GIVE);
  } finally {
    await ctxH.close();
    await ctxV.close();
  }
});

test('someone who opens the link after it ended can still give', async ({ page }) => {
  const past = Math.floor(Date.now() / 1000) - 2 * 86400;
  await page.goto(roomUrl(fresh('past'), '&at=' + past + '&give=' + encodeURIComponent(GIVE)), { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service has ended.');
  await expect(page.locator('#bc-give')).toBeVisible();
  const g = await giveBox(page);
  expect(g.inEnded).toBe(true);
  expect(g.text).toBe('Give');
  expect(g.h).toBeGreaterThanOrEqual(44);
  expect(g.bottom).toBeLessThanOrEqual(g.barY + 0.5);
});

test('a stream says Tip', async ({ page }) => {
  await page.goto(roomUrl(fresh('strm'), '&st=1&give=' + encodeURIComponent('https://ko-fi.example/maya')), { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await expect(page.locator('#bc-ended-txt')).toHaveText('The stream has not started.');
  await expect(page.locator('#bc-give')).toBeVisible();
  const g = await giveBox(page);
  expect(g.text).toBe('Tip');
  expect(g.label).toContain('ko-fi.example');
});

test('a link that is not https gets no Give', async ({ page }) => {
  for (const bad of ['javascript:alert(1)', 'http://give.example.org/x', 'data:text/html,hi']) {
    await page.goto('about:blank');
    await page.goto(roomUrl(fresh('bad'), '&give=' + encodeURIComponent(bad)), { waitUntil: 'domcontentloaded' });
    await page.locator('#nmok').click();
    await expect(page.locator('#bc-ended-txt')).toHaveText('The service has not started.');
    expect(await page.locator('#bc-give:visible').count()).toBe(0);
  }
});

test('a meeting never shows Give', async ({ page }) => {
  await page.goto('/run.html#v=' + fresh('meet') + '&give=' + encodeURIComponent(GIVE), { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await page.waitForFunction(() => (document.getElementById('status').dataset || {}).kind === 'alone');
  expect(await page.locator('#bc-give:visible').count()).toBe(0);
});
