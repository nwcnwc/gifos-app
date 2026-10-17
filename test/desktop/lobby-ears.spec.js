const { test, expect } = require('@playwright/test');
const pw = require('playwright');
const path = require('path');

// The waiting room is a sealed lobby. Two real browsers meet in a real room:
// Jordan (the host) turns the waiting room on, then Mina arrives and waits.
// Until Jordan admits her, neither page may play the other's voice, and
// Mina's mic must not send. After Admit both voices play and Mina can unmute.
//
// "Plays a voice" is read from the element that actually plays it: each
// peer's companion audio (live track, not muted, volume > 0, not paused).

const SHOTS = path.join(__dirname, 'shots');
const PHASE = process.env.LOBBY_EARS_PHASE || 'after';
const URL0 = process.env.LOBBY_EARS_BASE || 'http://127.0.0.1:8765';

const MEDIA_ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
const FF_PREFS = { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true, 'media.autoplay.default': 0 };

async function open(browserName, name) {
  const b = await pw[browserName].launch(browserName === 'firefox' ? { firefoxUserPrefs: FF_PREFS } : { args: MEDIA_ARGS });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, ...(browserName === 'chromium' ? { permissions: ['camera', 'microphone'] } : {}) });
  const page = await ctx.newPage();
  await page.addInitScript((n) => { localStorage.setItem('gifos_name', n); sessionStorage.setItem('gifos_appeared', '1'); }, name);
  return { b, page };
}

const ears = (page) => page.evaluate(() => window.__gifosVideo.earsForTest());
const peerOf = (e, re) => (e.peers || []).find((p) => re.test(p.name));

// A DOM click: in a quiet 2-person call the dock fades and takes no pointer.
async function unmute(page) {
  await page.waitForFunction(() => { const r = window.__gifosVideo.earsForTest(); return r && r.micSends !== undefined; }, null, { timeout: 30000 });
  if (!(await ears(page)).micSends) await page.evaluate(() => document.getElementById('mic').click());
}

async function until(page, fn, ms) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < ms) {
    last = await fn();
    if (last.ok) return last;
    await page.waitForTimeout(500);
  }
  return last;
}

test('a person in the waiting room hears no one and no one hears them, until Admit', async ({ browserName }) => {
  test.skip(browserName === 'webkit', 'no fake microphone in Playwright WebKit');
  test.setTimeout(240000);
  const room = 'qalobbyears' + Date.now().toString(36);
  const hash = '#v=' + room + '&debug=on';
  const H = await open(browserName, 'Jordan Lee');
  const G = await open(browserName, 'Mina Park');
  try {
    await H.page.goto(URL0 + '/run.html' + hash, { waitUntil: 'domcontentloaded' });
    await H.page.waitForSelector('#leavebtn', { state: 'visible', timeout: 60000 });
    await unmute(H.page);
    await H.page.evaluate(() => document.getElementById('statuscount').click());
    const toggle = H.page.locator('#roster-wait-toggle');
    await expect(toggle).toHaveText('Off');
    await toggle.click();
    await expect(toggle).toHaveText('On');

    await G.page.goto(URL0 + '/run.html' + hash, { waitUntil: 'domcontentloaded' });
    await G.page.waitForSelector('#leavebtn', { state: 'visible', timeout: 60000 });
    await expect(G.page.locator('#waitself')).toBeVisible({ timeout: 90000 });
    await unmute(G.page);

    // Both pages hold the other's audio track; the lobby must keep it silent.
    const sealed = await until(H.page, async () => {
      const h = await ears(H.page), g = await ears(G.page);
      const hm = peerOf(h, /Mina/), gj = peerOf(g, /Jordan/);
      const hostHearsGuest = !!(hm && hm.audible);
      const guestHearsHost = !!(gj && gj.audible);
      return { ok: !!hm && !!gj && !hostHearsGuest && !guestHearsHost && !g.micSends, minaHeld: !!(hm && hm.held), hostHearsGuest, guestHearsHost, guestMicSends: g.micSends, guestWaiting: g.waiting, sawGuest: !!hm, sawHost: !!gj };
    }, 30000);
    await H.page.screenshot({ path: path.join(SHOTS, `lobby-ears-${PHASE}-host-1280.png`) });
    await G.page.screenshot({ path: path.join(SHOTS, `lobby-ears-${PHASE}-guest-1280.png`) });
    expect(sealed).toMatchObject({ ok: true, minaHeld: true, hostHearsGuest: false, guestHearsHost: false, guestMicSends: false, guestWaiting: true });
    // The host can see who is waiting, and admit them.
    await expect(H.page.locator('#roster-waitlist .roster-row', { hasText: 'Mina Park' })).toBeVisible({ timeout: 30000 });

    await H.page.locator('#roster-waitlist .roster-row', { hasText: 'Mina Park' }).locator('.admitbtn').click();
    await expect(G.page.locator('#waitself')).toBeHidden({ timeout: 30000 });
    // Admitted, Mina sees the people who were already here.
    await expect(G.page.locator('#feed .tile:not(.me) .name', { hasText: 'Jordan Lee' })).toBeVisible({ timeout: 30000 });
    await unmute(G.page);
    const open2 = await until(H.page, async () => {
      const h = await ears(H.page), g = await ears(G.page);
      const hm = peerOf(h, /Mina/), gj = peerOf(g, /Jordan/);
      const hostHearsGuest = !!(hm && hm.audible);
      const guestHearsHost = !!(gj && gj.audible);
      return { ok: hostHearsGuest && guestHearsHost && g.micSends, hostHearsGuest, guestHearsHost, guestMicSends: g.micSends };
    }, 30000);
    expect(open2).toMatchObject({ ok: true, hostHearsGuest: true, guestHearsHost: true, guestMicSends: true });
  } finally {
    await H.b.close().catch(() => {});
    await G.b.close().catch(() => {});
  }
});
