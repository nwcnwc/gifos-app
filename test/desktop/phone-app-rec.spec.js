const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Phone portrait, an app running inside a meeting, recording on: the
// recording pill must not sit on the app's own bar or its Invite, and every
// one of them must still take its own tap (coordinator 2026-10-22: deskB's
// 110px phone pill under 2524009's 66-139px app bar).
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  serviceWorkers: 'block',
  launchOptions: [async ({ browserName }, use) => use(browserName === 'chromium'
    ? { args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } : {}), { scope: 'worker' }],
});

test('a phone app in a meeting keeps its bar and Invite clear of the recording pill', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'phone touch');
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
    localStorage.setItem('gifos_relay', 'ws://127.0.0.1:9/never');
  });
  await page.goto('/store.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GifOS && GifOS.store && GifOS.store.putFile);
  const bytes = fs.readFileSync(path.join(__dirname, '..', '..', 'apps', 'tic-tac-toe', 'tic-tac-toe.gif'));
  const fileId = await page.evaluate(async (b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const id = 'file_test_ttt_' + Date.now().toString(36);
    await GifOS.store.putFile({ id, name: 'Tic-Tac-Toe.gif', bytes: u, kind: 'gif', isApp: true, appId: 'tic-tac-toe', mime: 'image/gif' });
    return id;
  }, bytes.toString('base64'));
  await page.goto('/run.html#app=' + encodeURIComponent(fileId) + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
  await page.locator('#nmcancel, #nmok').first().click({ timeout: 2000 }).catch(() => {});
  await page.waitForFunction(() => { const r = document.getElementById('airrec'); return r && r.getBoundingClientRect().width > 2; }, null, { timeout: 10000 });
  // A headless page cannot start the recorder ("Recording not started"), so
  // this reads the idle pill. With recording on only its ink and its word
  // change ("Recording" is shorter), never its place.
  await page.waitForTimeout(600);
  const geo = await page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return { x: r.left, y: r.top, r: r.right, b: r.bottom, shown: r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05, text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30) };
    };
    const hit = (el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && (top === el || el.contains(top));
    };
    const bar = document.getElementById('appbar');
    const kids = bar ? [...bar.querySelectorAll('button, a, .appname, h1, h2, span')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; }) : [];
    return {
      air: box(document.getElementById('airbar')), rec: box(document.getElementById('airrec')),
      appbar: box(bar), invite: box(document.getElementById('appinvite')),
      kids: kids.map((e) => Object.assign(box(e), { id: e.id || e.className || e.tagName })),
      hitInvite: hit(document.getElementById('appinvite')), hitRec: hit(document.getElementById('airrec')),
      vw: innerWidth,
    };
  });
  const msg = JSON.stringify(geo);
  expect(geo.rec.shown, msg).toBe(true);
  expect(geo.rec.text, msg).toMatch(/^(Not recording|Recording)$/);
  expect(geo.invite && geo.invite.shown, msg).toBe(true);
  const meet = (a, b) => Math.min(a.r, b.r) - Math.max(a.x, b.x) > 1 && Math.min(a.b, b.b) - Math.max(a.y, b.y) > 1;
  expect(meet(geo.rec, geo.invite), 'pill on Invite ' + msg).toBe(false);
  for (const k of geo.kids) expect(meet(geo.rec, k), 'pill on ' + k.id + ' ' + msg).toBe(false);
  expect(geo.hitInvite, msg).toBe(true);
  expect(geo.hitRec, msg).toBe(true);
  expect(geo.rec.r, msg).toBeLessThanOrEqual(geo.vw + 1);
});
