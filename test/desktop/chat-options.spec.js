const { test, expect } = require('@playwright/test');
const pw = require('playwright');
const path = require('path');

// Prayer (#pray) is off by default: a business meeting never sees it. The
// host turns it on for the room in Room admin → Chat options, the section
// that also holds "Guests can chat" and the files-need-a-password rule.
// Two real browsers meet in a real admin room: Jordan hosts, Avery is a guest.

const SHOTS = path.join(__dirname, 'shots');
const URL0 = process.env.BASE_URL || 'http://127.0.0.1:8765';
const MEDIA_ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
const FF_PREFS = { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true, 'media.autoplay.default': 0 };

async function open(browserName, name) {
  const type = pw[browserName];
  const b = await type.launch(browserName === 'firefox' ? { firefoxUserPrefs: FF_PREFS } : { args: MEDIA_ARGS });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, ...(browserName === 'chromium' ? { permissions: ['camera', 'microphone'] } : {}) });
  const page = await ctx.newPage();
  await page.addInitScript(([n, r]) => { localStorage.setItem('gifos_name', n); sessionStorage.setItem('gifos_appeared', '1'); if (r) localStorage.setItem('gifos_relay', r); }, [name, process.env.RELAY || '']);
  return { b, page };
}

async function openChat(page) {
  if (!(await page.locator('#chatpanel.open').count())) await page.evaluate(() => document.getElementById('chatbtn').click());
  await page.waitForSelector('#chatpanel.open');
}

async function send(page, text) {
  await page.locator('#chat-in').fill(text);
  await page.locator('#chatform button[type=submit]').click();
}

test('a room with no admin shows no Prayer button', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html#v=qaprayopen' + Date.now().toString(36) + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible', timeout: 60000 });
  await openChat(page);
  await expect(page.locator('#chat-in')).toBeVisible();
  await expect(page.locator('#pray')).toBeHidden();
  expect(await page.evaluate(() => window.__gifosVideo.prayOn())).toBe(false);
  // With Prayer hidden on a wide window, 📎 takes its place at the row's start.
  const row = await page.evaluate(() => {
    const p = document.getElementById('chatpanel').getBoundingClientRect();
    const a = document.getElementById('cattach').getBoundingClientRect();
    return { panelL: p.left, attachL: a.left };
  });
  expect(row.attachL - row.panelL).toBeLessThan(24);
  await page.screenshot({ path: path.join(SHOTS, 'chat-options-open-room-1280.png') });
});

test.describe('the host turns Prayer on for the room', () => {
  test.skip(({ browserName }) => browserName === 'webkit', 'desktop pair runs Chromium + Firefox; WebKit runs on another box');
  test.setTimeout(240000);

  test('off by default, on for everyone when the host turns it on, gone again when off', async ({ browserName }) => {
    const room = 'qapray' + Date.now().toString(36);
    const J = await open(browserName, 'Jordan Lee');
    const A = await open(browserName, 'Avery Chen');
    try {
      await J.page.goto(URL0 + '/run.html', { waitUntil: 'domcontentloaded' });
      await J.page.click('#lob-admin-btn');
      await J.page.fill('#lob-admin-name', room);
      await J.page.fill('#lob-admin-pass', 'qa-admin-' + room);
      await J.page.click('#lob-admin-go');
      await J.page.waitForFunction(() => /av=/.test(location.hash), null, { timeout: 30000 });
      await J.page.waitForSelector('#leavebtn', { state: 'visible', timeout: 60000 });
      await J.page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.amAdmin(), null, { timeout: 30000 });
      const hash = await J.page.evaluate(() => location.hash);

      await A.page.goto(URL0 + '/run.html' + hash + '&debug=on', { waitUntil: 'domcontentloaded' });
      await A.page.waitForSelector('#leavebtn', { state: 'visible', timeout: 60000 });
      await A.page.waitForFunction(() => [...document.querySelectorAll('#feed .tile:not(.me) .name')].some((n) => /Jordan/.test(n.textContent)), null, { timeout: 90000 });
      await J.page.waitForFunction(() => [...document.querySelectorAll('#feed .tile:not(.me) .name')].some((n) => /Avery/.test(n.textContent)), null, { timeout: 90000 });

      for (const p of [J.page, A.page]) { await openChat(p); await expect(p.locator('#pray')).toBeHidden(); }

      // Room admin → Chat options gathers the chat switches.
      await J.page.evaluate(() => document.getElementById('admbtn').click());
      const sheet = J.page.locator('#adm-modal');
      await expect(sheet).toBeVisible();
      await expect(sheet.locator('#adm-chat h4')).toHaveText('Chat options');
      await expect(sheet.locator('#adm-chat-guests')).toBeChecked();
      await expect(sheet.locator('#adm-chat-pray')).not.toBeChecked();
      await expect(sheet.locator('#adm-chat-files-sub')).toHaveText('Only once the room has a password.');
      await sheet.screenshot({ path: path.join(SHOTS, 'chat-options-sheet-off-' + browserName + '.png') });

      await sheet.locator('#adm-chat-pray').check();
      await expect(J.page.locator('#pray')).toBeVisible();
      await A.page.waitForFunction(() => !document.getElementById('pray').hidden, null, { timeout: 30000 });
      await sheet.screenshot({ path: path.join(SHOTS, 'chat-options-sheet-on-' + browserName + '.png') });
      await J.page.locator('#adm-close').click();

      await A.page.locator('#pray').click();
      await expect(A.page.locator('#chat-in')).toHaveAttribute('placeholder', 'Prayer request…');
      await send(A.page, 'Please pray for Maya');
      await expect(J.page.locator('#chatlog .cmsg.prayer')).toContainText('Please pray for Maya', { timeout: 30000 });
      await A.page.screenshot({ path: path.join(SHOTS, 'chat-options-guest-pray-on-' + browserName + '.png') });

      // Off again: the button goes for everyone, a marked line stays marked,
      // and a pressed Prayer does not mark the next line.
      await J.page.evaluate(() => document.getElementById('admbtn').click());
      await sheet.locator('#adm-chat-pray').uncheck();
      await J.page.locator('#adm-close').click();
      await A.page.waitForFunction(() => document.getElementById('pray').hidden, null, { timeout: 30000 });
      await expect(A.page.locator('#pray')).toHaveAttribute('aria-pressed', 'false');
      await expect(A.page.locator('#chat-in')).toHaveAttribute('placeholder', 'Message everyone…');
      await send(A.page, 'See you after');
      await expect(J.page.locator('#chatlog .cmsg', { hasText: 'See you after' })).toBeVisible({ timeout: 30000 });
      await expect(J.page.locator('#chatlog .cmsg', { hasText: 'See you after' })).not.toHaveClass(/prayer/);
      for (const p of [J.page, A.page]) await expect(p.locator('#chatlog .cmsg.prayer')).toContainText('Please pray for Maya');

      // Guests can chat is the same switch as Turn chat off in the chat panel.
      await J.page.evaluate(() => document.getElementById('admbtn').click());
      await sheet.locator('#adm-chat-guests').uncheck();
      await expect(J.page.locator('#chatmod')).toHaveText('Turn chat on');
      await A.page.waitForFunction(() => document.getElementById('chat-in').disabled, null, { timeout: 30000 });
      await J.page.locator('#adm-close').click();
      await J.page.locator('#chatmod').click();
      await A.page.waitForFunction(() => !document.getElementById('chat-in').disabled, null, { timeout: 30000 });
      await J.page.evaluate(() => document.getElementById('admbtn').click());
      await expect(sheet.locator('#adm-chat-guests')).toBeChecked();
      await A.page.screenshot({ path: path.join(SHOTS, 'chat-options-guest-pray-off-' + browserName + '.png') });
    } finally {
      await J.b.close().catch(() => {});
      await A.b.close().catch(() => {});
    }
  });
});

test.describe('No blur in a room with no password', () => {
  test.skip(({ browserName }) => browserName === 'webkit', 'fake camera: Chromium + Firefox');
  test.setTimeout(90000);

  test('the choice is kept, a note says it waits for a password, and a password applies it at once', async ({ browserName }) => {
    const J = await open(browserName, 'Jordan Lee');
    const page = J.page;
    try {
      await page.goto(URL0 + '/run.html#v=qanoblur' + Date.now().toString(36) + '&debug=on', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#leavebtn', { state: 'visible', timeout: 60000 });
      await page.evaluate(() => document.getElementById('cam').click());
      await page.waitForFunction(() => !window.__gifosVideo.camOff(), null, { timeout: 20000 });
      await page.click('#bartoggle');
      await page.locator('#blur-none').click();
      const note = page.locator('#blurnote');
      await expect(note).toBeVisible();
      await expect(note).toContainText('No blur is saved. It applies once this room has a password, and then right away.');
      await expect(page.locator('#blur-none')).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => window.__gifosVideo.myBlur())).toBe(0);
      expect(await page.evaluate(() => window.__gifosVideo.blurClassOf('me'))).toBeGreaterThan(0);
      await page.screenshot({ path: path.join(SHOTS, 'no-blur-nopw-note-1280.png') });
      await expect(note).toBeHidden({ timeout: 10000 });
      await expect(page.locator('#blur-none')).toHaveAttribute('aria-pressed', 'true');

      await page.evaluate(() => document.getElementById('pwbtn').click());
      await page.locator('#pw-new').fill('qa-pw-noblur');
      await page.locator('#pw-save').click();
      await page.waitForFunction(() => window.__gifosVideo.blurClassOf('me') === 0, null, { timeout: 10000 });
      expect(await page.evaluate(() => window.__gifosVideo.outboundKind())).toBe('raw');
    } finally {
      await J.b.close().catch(() => {});
    }
  });
});
