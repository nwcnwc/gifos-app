import { test, expect } from '@playwright/test';
import { viewerBrowsers } from './rebroadcast-lib.mjs';

// Q73. The host can hand viewers one outside link: a church's home page, a
// streamer's site. We can't vouch for where it goes, so it is just a link,
// never a money button. The host sets it once in More ("Visit link"); the
// viewer link carries it as visit=<https url> (old give= links still work),
// and a viewer reads Visit with a box-and-arrow icon on the picture and on
// the screen that says the service has not started or has ended. The tap
// opens the host's page in a new window.
//
// The viewer runs on another fleet machine when BC_VIEW_WS names a remote
// `npx playwright run-server`; without it, on this machine.

const AV = '0123456789abcdef0123456789abcdef';
const SITE = 'https://example.com/';

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['camera', 'microphone'] });

const fresh = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function roomUrl(name, extra) {
  return '/run.html#v=' + name + '&av=' + AV + '&bc=1' + (extra || '');
}

async function visitBox(page) {
  return page.evaluate(() => {
    const g = document.getElementById('bc-visit');
    if (!g) return null;
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const r = g.getBoundingClientRect();
    return {
      x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom,
      text: g.textContent.replace(/\s+/g, ' ').trim(),
      href: g.getAttribute('href'), target: g.target, rel: g.rel,
      label: g.getAttribute('aria-label') || '', title: g.title || '',
      icon: !!g.querySelector('svg[data-icon="external-link"]'),
      inEnded: !!g.closest('#bc-ended'),
      barY: bar.y, vw: innerWidth, vh: innerHeight,
    };
  });
}

// No money anywhere the viewer or host can read: no $, no heart, no
// give/tip/offering words on the button or the host's field.
async function expectNoMoney(page) {
  const seen = await page.evaluate(() => {
    const out = [];
    for (const sel of ['#bc-visit', '#bcvisitrow', '#bc-ended']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const attrs = [...el.querySelectorAll('*'), el].flatMap((n) => ['aria-label', 'title', 'placeholder'].map((a) => n.getAttribute(a) || ''));
      out.push({ sel, text: el.textContent, attrs: attrs.join(' '), heart: !!el.querySelector('path[d^="M12 20s-7"]') });
    }
    return out;
  });
  for (const s of seen) {
    expect(s.text + ' ' + s.attrs, s.sel).not.toContain('$');
    expect(s.text + ' ' + s.attrs, s.sel).not.toMatch(/\b(give|giving|tip|tips|offering|donat\w*)\b/i);
    expect(s.heart, s.sel).toBe(false);
  }
}

test('the host sets a Visit link, and a viewer opens it during the service', async ({ browser, baseURL }, info) => {
  test.setTimeout(120000);
  const opts = info.project.use;
  const vb = await viewerBrowsers(browser);
  const ctxH = await browser.newContext({ ...opts, permissions: ['camera', 'microphone'] });
  const ctxV = await vb.pick(0).newContext({ ...opts, baseURL });
  try {
    const h = await ctxH.newPage();
    await h.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
    await h.locator('#lob-admin-go').click();
    await expect(h.locator('#livebadge-txt')).toHaveText('LIVE', { timeout: 20000 });
    await h.locator('#bartoggle').click();
    const field = h.locator('#bcvisit');
    await expect(field).toBeVisible();
    expect((await field.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await field.getAttribute('placeholder')).toMatch(/^https:\/\//);
    await expect(h.locator('#bcvisit-help')).toHaveText('Link for viewers (opens in a new window)');
    await expect(h.locator('#bcvisit-lbl')).toHaveText('Visit link');
    await field.fill(SITE);
    await field.dispatchEvent('change');
    await expect(h.locator('#bcvisit-lbl')).toHaveText('Visit link · example.com');
    await expectNoMoney(h);
    const shared = await h.evaluate(() => {
      let payload = null;
      navigator.share = (p) => { payload = p; return Promise.resolve(); };
      window.__gifosVideo.shareInvite();
      return payload;
    });
    expect(shared && shared.url).toBeTruthy();
    const link = new URL(shared.url);
    const hp = new URLSearchParams(link.hash.slice(1));
    expect(hp.get('visit')).toBe(SITE);
    expect(hp.has('give')).toBe(false);

    // A viewer opens that link while the host is live.
    const v = await ctxV.newPage();
    await v.goto('/run.html' + link.hash, { waitUntil: 'domcontentloaded' });
    await v.locator('#nmok').click();
    await v.waitForFunction(() => !!document.querySelector('#stagefeed .rowtile'), null, { timeout: 45000 });
    await expect(v.locator('#bc-ended')).toBeHidden();
    await expect(v.locator('#bc-visit')).toBeVisible();
    const g = await visitBox(v);
    expect(g.text).toBe('Visit');
    expect(g.icon).toBe(true);
    expect(g.href).toBe(SITE);
    expect(g.target).toBe('_blank');
    expect(g.rel).toContain('noopener');
    expect(g.rel).toContain('noreferrer');
    expect(g.label).toBe('Visit example.com (opens in a new window)');
    expect(g.title).toBe(g.label);
    expect(g.h).toBeGreaterThanOrEqual(44);
    expect(g.w).toBeGreaterThanOrEqual(44);
    expect(g.x).toBeGreaterThanOrEqual(0);
    expect(g.right).toBeLessThanOrEqual(g.vw + 0.5);
    expect(g.bottom).toBeLessThanOrEqual(g.barY + 0.5);
    expect(g.inEnded).toBe(false);
    await expectNoMoney(v);

    // The tap opens the host's page in a new window.
    await ctxV.route('https://example.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Example</title>ok' }));
    const [pop] = await Promise.all([ctxV.waitForEvent('page'), v.locator('#bc-visit').click()]);
    await pop.waitForLoadState('domcontentloaded');
    expect(pop.url()).toBe(SITE);
    expect(pop).not.toBe(v);
    await pop.close();

    // Large type and a rotated phone: Visit stays 44px or more, on screen,
    // and clear of Fit, the chip, and the dock.
    const clear = async () => v.evaluate(() => {
      const r = document.getElementById('bc-visit').getBoundingClientRect();
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

    // A reload of the host's phone keeps the link.
    await h.reload({ waitUntil: 'domcontentloaded' });
    await h.locator('#leavebtn').waitFor({ state: 'attached' });
    const again = await h.evaluate(() => {
      let payload = null;
      navigator.share = (p) => { payload = p; return Promise.resolve(); };
      window.__gifosVideo.shareInvite();
      return payload && payload.url;
    });
    expect(new URLSearchParams(new URL(again).hash.slice(1)).get('visit')).toBe(SITE);
  } finally {
    await ctxH.close();
    await ctxV.close();
    await vb.close();
  }
});

test('someone who opens the link after it ended still gets Visit', async ({ page }) => {
  const past = Math.floor(Date.now() / 1000) - 2 * 86400;
  await page.goto(roomUrl(fresh('past'), '&at=' + past + '&visit=' + encodeURIComponent(SITE)), { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service has ended.');
  await expect(page.locator('#bc-visit')).toBeVisible();
  const g = await visitBox(page);
  expect(g.inEnded).toBe(true);
  expect(g.text).toBe('Visit');
  expect(g.icon).toBe(true);
  expect(g.h).toBeGreaterThanOrEqual(44);
  expect(g.bottom).toBeLessThanOrEqual(g.barY + 0.5);
  await expectNoMoney(page);
});

test('a stream says Visit too', async ({ page }) => {
  await page.goto(roomUrl(fresh('strm'), '&st=1&visit=' + encodeURIComponent('https://www.example.net/maya')), { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await expect(page.locator('#bc-ended-txt')).toHaveText('The stream has not started.');
  await expect(page.locator('#bc-visit')).toBeVisible();
  const g = await visitBox(page);
  expect(g.text).toBe('Visit');
  expect(g.icon).toBe(true);
  expect(g.label).toBe('Visit www.example.net (opens in a new window)');
  await expectNoMoney(page);
});

test('a link shared with the old give= still gets Visit', async ({ page, context }) => {
  await page.goto(roomUrl(fresh('old'), '&give=' + encodeURIComponent(SITE)), { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service has not started.');
  await expect(page.locator('#bc-visit')).toBeVisible();
  const g = await visitBox(page);
  expect(g.text).toBe('Visit');
  expect(g.href).toBe(SITE);
  await expectNoMoney(page);
  await context.route('https://example.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
  const [pop] = await Promise.all([context.waitForEvent('page'), page.locator('#bc-visit').click()]);
  await pop.waitForLoadState('domcontentloaded');
  expect(pop.url()).toBe(SITE);
});

test('a link that is not https gets no Visit', async ({ page }) => {
  for (const bad of ['javascript:alert(1)', 'http://example.com/x', 'data:text/html,hi', 'https://u:p@example.com/']) {
    await page.goto('about:blank');
    await page.goto(roomUrl(fresh('bad'), '&visit=' + encodeURIComponent(bad)), { waitUntil: 'domcontentloaded' });
    await page.locator('#nmok').click();
    await expect(page.locator('#bc-ended-txt')).toHaveText('The service has not started.');
    expect(await page.locator('#bc-visit:visible').count()).toBe(0);
  }
});

test('a meeting never shows Visit', async ({ page }) => {
  await page.goto('/run.html#v=' + fresh('meet') + '&visit=' + encodeURIComponent(SITE), { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await page.waitForFunction(() => (document.getElementById('status').dataset || {}).kind === 'alone');
  expect(await page.locator('#bc-visit:visible').count()).toBe(0);
});
