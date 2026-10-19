const { test, expect } = require('@playwright/test');

// Phone portrait (390x844), the two low cosmetic bugs from chaos-1019-0630:
// the recording pill sat on Invite / Help / Full screen during a share, and
// the reaction tray sat on the chat composer's Send.
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

async function boot(page) {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Guest 5182');
    sessionStorage.setItem('gifos_appeared', '1');
    localStorage.setItem('gifos_relay', 'ws://127.0.0.1:9/never');
  });
  await page.goto('/run.html#v=phonecos' + Date.now().toString(36) + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.locator('#nmcancel, #nmok').first().click({ timeout: 2000 }).catch(() => {});
  await page.waitForFunction(() => {
    const r = document.getElementById('bartoggle').getBoundingClientRect();
    return r.width > 20 && r.top > 0 && r.bottom < innerHeight - 1;
  });
}

async function tap(page, id) {
  const box = await page.evaluate((sel) => {
    const r = document.getElementById(sel).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, id);
  await page.touchscreen.tap(box.x, box.y);
}

// Skip before the browser launches. An in-test skip still starts WebKit
// with --disable-gpu (chat-options does the skip at describe scope).
test.describe('chromium only', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'chromium-only media');
test('a phone share keeps Not recording off Invite, Help and Full screen', async ({ page, browserName }) => {
  await boot(page);
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 3, connected: true }));
  await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 360;
    const x = c.getContext('2d');
    x.fillStyle = '#00c853';
    x.fillRect(0, 0, 640, 360);
    window.__gifosVideo.remoteShareForTest(['qa1'], c.captureStream(4));
  });
  await page.waitForFunction(() => document.body.classList.contains('screen-on'));
  const geo = await page.evaluate(() => {
    const box = (id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height,
        shown: r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05,
        text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24),
      };
    };
    const hit = (id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top && (top.id || (top.closest('button, a') && top.closest('button, a').id) || top.tagName);
    };
    return {
      air: box('airrec'), invite: box('appinvite'), help: box('apphelp'), full: box('appfull'),
      chip: box('status'), rec: box('call-rec'),
      hitInvite: hit('appinvite'), hitHelp: hit('apphelp'), hitFull: hit('appfull'), hitAir: hit('airrec'),
      vw: innerWidth, vh: innerHeight,
    };
  });
  expect(geo.air.shown, JSON.stringify(geo)).toBe(true);
  expect(geo.air.text, JSON.stringify(geo)).toBe('Not recording');
  expect(geo.invite.shown && geo.help.shown && geo.full.shown, JSON.stringify(geo)).toBe(true);
  expect(geo.rec.shown, JSON.stringify(geo)).toBe(true);
  for (const key of ['invite', 'help', 'full', 'chip']) {
    const ix = Math.min(geo.air.r, geo[key].r) - Math.max(geo.air.x, geo[key].x);
    const iy = Math.min(geo.air.b, geo[key].b) - Math.max(geo.air.y, geo[key].y);
    expect(ix > 1 && iy > 1, key + ' ' + JSON.stringify(geo)).toBe(false);
  }
  expect(geo.hitInvite, JSON.stringify(geo)).toBe('appinvite');
  expect(geo.hitHelp, JSON.stringify(geo)).toBe('apphelp');
  expect(geo.hitFull, JSON.stringify(geo)).toBe('appfull');
  expect(geo.hitAir, JSON.stringify(geo)).toBe('airrec');
  expect(geo.air.x, JSON.stringify(geo)).toBeGreaterThanOrEqual(0);
  expect(geo.air.r, JSON.stringify(geo)).toBeLessThanOrEqual(geo.vw + 1);
});

test('the reaction tray does not cover Send while chat is open', async ({ page, browserName }) => {
  await boot(page);
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: true }));
  await tap(page, 'bartoggle');
  await tap(page, 'chatbtn');
  await page.waitForFunction(() => document.getElementById('chatpanel').classList.contains('open'));
  await tap(page, 'reactbtn');
  await page.waitForFunction(() => !document.getElementById('reacttray').hasAttribute('hidden'));
  const geo = await page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
    };
    const tray = document.getElementById('reacttray');
    const send = document.querySelector('#chatform button[type="submit"]');
    const field = document.getElementById('chat-in');
    const hit = (el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const btn = top && top.closest('button');
      return btn ? (btn.id || btn.textContent.trim().slice(0, 16)) : (top && top.id);
    };
    return {
      trayHidden: tray.hasAttribute('hidden'),
      chatOpen: document.getElementById('chatpanel').classList.contains('open'),
      tray: box(tray), send: box(send), field: box(field),
      hitSend: hit(send), hitField: hit(field),
      vh: innerHeight,
    };
  });
  expect(geo.chatOpen, JSON.stringify(geo)).toBe(true);
  expect(geo.trayHidden, JSON.stringify(geo)).toBe(false);
  const cover = (a, b) => {
    const ix = Math.min(a.r, b.r) - Math.max(a.x, b.x);
    const iy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
    return ix > 1 && iy > 1;
  };
  expect(cover(geo.tray, geo.send), JSON.stringify(geo)).toBe(false);
  expect(cover(geo.tray, geo.field), JSON.stringify(geo)).toBe(false);
  expect(geo.hitSend, JSON.stringify(geo)).toBe('Send');
  expect(geo.hitField, JSON.stringify(geo)).toBe('chat-in');
  expect(geo.send.y, JSON.stringify(geo)).toBeGreaterThanOrEqual(0);
  expect(geo.field.b, JSON.stringify(geo)).toBeLessThanOrEqual(geo.vh);
});
});
