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
      // Both voices must be wired (a live track on the element), else "not
      // heard" only means the link is not up yet.
      const wired = !!(hm && hm.wired && gj && gj.wired);
      return { ok: wired && !hostHearsGuest && !guestHearsHost && !g.micSends, wired, minaHeld: !!(hm && hm.held), hostHearsGuest, guestHearsHost, guestMicSends: g.micSends, guestWaiting: g.waiting };
    }, 30000);
    await H.page.screenshot({ path: path.join(SHOTS, `lobby-ears-${PHASE}-host-1280.png`) });
    await G.page.screenshot({ path: path.join(SHOTS, `lobby-ears-${PHASE}-guest-1280.png`) });
    expect(sealed).toMatchObject({ ok: true, wired: true, minaHeld: true, hostHearsGuest: false, guestHearsHost: false, guestMicSends: false, guestWaiting: true });
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

// A person held in the waiting room is off every screen but their own, so no
// screen may leave room for them. Jordan (host) is alone in the room while
// Mina and Theo wait: Jordan's own face keeps the size it had alone, and each
// waiting page shows only its own face, at that same size, with no one else's
// name. Before: each held person still took a column on every screen.
test('people in the waiting room take no space on any screen', async ({ browserName }) => {
  test.skip(browserName === 'webkit', 'no fake camera/microphone in Playwright WebKit');
  test.setTimeout(240000);
  const room = 'qalobbyroom' + Date.now().toString(36);
  const hash = '#v=' + room + '&debug=on';
  const H = await open(browserName, 'Jordan Lee');
  const G1 = await open(browserName, 'Mina Park');
  const G2 = await open(browserName, 'Theo Grant');
  const screenOf = (page) => page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const me = document.querySelector('#feed .tile.me');
    const others = [...document.querySelectorAll('#feed .tile:not(.me), #stadfaces > *')]
      .filter((el) => el.isConnected && el.style.display !== 'none' && el.getBoundingClientRect().width > 0);
    return { me: me ? r(me) : null, others: others.map((el) => (el.querySelector('.name') || el).textContent.trim()),
      remotes: (document.getElementById('grid') || {}).dataset ? document.getElementById('grid').dataset.remotes : null };
  });
  try {
    await H.page.goto(URL0 + '/run.html' + hash, { waitUntil: 'domcontentloaded' });
    await H.page.waitForSelector('#leavebtn', { state: 'visible', timeout: 60000 });
    await H.page.evaluate(() => document.getElementById('statuscount').click());
    const toggle = H.page.locator('#roster-wait-toggle');
    await toggle.click();
    await expect(toggle).toHaveText('On');
    await H.page.evaluate(() => { const c = document.querySelector('#roster .close, #roster-close'); if (c) c.click(); });
    await H.page.waitForTimeout(1500);
    const alone = await screenOf(H.page);

    for (const G of [G1, G2]) {
      await G.page.goto(URL0 + '/run.html' + hash, { waitUntil: 'domcontentloaded' });
      await G.page.waitForSelector('#leavebtn', { state: 'visible', timeout: 60000 });
      await expect(G.page.locator('#waitself')).toBeVisible({ timeout: 90000 });
    }
    // Both arrivals are held on the host's screen (the host's Waiting list has them).
    await expect.poll(() => H.page.evaluate(() => (window.__gifosVideo.earsForTest().peers || []).filter((p) => p.held).length), { timeout: 60000 }).toBe(2);
    await H.page.waitForTimeout(2500);
    const host = await screenOf(H.page), g1 = await screenOf(G1.page), g2 = await screenOf(G2.page);
    await H.page.screenshot({ path: path.join(SHOTS, `lobby-room-${PHASE}-host-1280.png`) });
    await G2.page.screenshot({ path: path.join(SHOTS, `lobby-room-${PHASE}-guest-1280.png`) });
    const same = (a, b) => !!(a && b && Math.abs(a.x - b.x) <= 2 && Math.abs(a.y - b.y) <= 2 && Math.abs(a.w - b.w) <= 2 && Math.abs(a.h - b.h) <= 2);
    expect({ hostKeepsAloneSize: same(host.me, alone.me), hostOthers: host.others, hostRemotes: host.remotes, alone: alone.me, host: host.me })
      .toMatchObject({ hostKeepsAloneSize: true, hostOthers: [], hostRemotes: '0' });
    expect({ guest1AloneSize: same(g1.me, alone.me), guest1Others: g1.others, guest1Remotes: g1.remotes, g1: g1.me })
      .toMatchObject({ guest1AloneSize: true, guest1Others: [], guest1Remotes: '0' });
    expect({ guest2AloneSize: same(g2.me, alone.me), guest2Others: g2.others, guest2Remotes: g2.remotes, g2: g2.me })
      .toMatchObject({ guest2AloneSize: true, guest2Others: [], guest2Remotes: '0' });
  } finally {
    await H.b.close().catch(() => {});
    await G1.b.close().catch(() => {});
    await G2.b.close().catch(() => {});
  }
});
