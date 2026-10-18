const { test, expect } = require('@playwright/test');
const pw = require('playwright');
const path = require('path');

// Self-view must look the way others see you. Two real browsers meet in a
// real room: Jordan (J) and Avery. We read J's tile on BOTH screens (J's own
// self-view and Avery's view of J), camera off and on, in (a) a room with no
// password, where faces stay soft, and (b) an admin room with a guest
// password and the admin here, where faces are clear.
//
// A camera-off tile shows a placeholder (the initial or picture). In a soft
// room that placeholder must be as soft as a face would be, on both screens;
// in a clear room nothing is soft.

const SHOTS = path.join(__dirname, 'shots');
const PHASE = process.env.SELF_BLUR_PHASE || 'after';
const URL0 = process.env.SELF_BLUR_BASE || 'http://127.0.0.1:8765';

const MEDIA_ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
const FF_PREFS = { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true, 'media.autoplay.default': 0 };

async function open(browserName, name) {
  const type = pw[browserName];
  const b = await type.launch(browserName === 'firefox' ? { firefoxUserPrefs: FF_PREFS } : { args: MEDIA_ARGS });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, ...(browserName === 'chromium' ? { permissions: ['camera', 'microphone'] } : {}) });
  const page = await ctx.newPage();
  await page.addInitScript((n) => { localStorage.setItem('gifos_name', n); sessionStorage.setItem('gifos_appeared', '1'); }, name);
  return { b, page };
}

async function enter(page, hash) {
  await page.goto(URL0 + '/run.html' + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible', timeout: 60000 });
}

// J's tile as one screen paints it: the placeholder's and the video's computed
// filter, which of them shows, and (on J's own screen) what J sends.
function readJ(page) {
  return page.evaluate(() => {
    const t = [...document.querySelectorAll('#feed .tile')].find((x) => /Jordan/.test((x.querySelector('.name') || {}).textContent || ''));
    if (!t) return null;
    const v = t.querySelector('video'), av = t.querySelector('.avatar');
    const soft = (f) => /blur\((?!0px)/.test(f || '');
    const me = t.classList.contains('me');
    const camOff = t.classList.contains('cam-off');
    const sends = me ? window.__gifosVideo.outboundKind() : null;
    return {
      me, camOff,
      avatarShown: getComputedStyle(av).display !== 'none',
      avatarFilter: getComputedStyle(av).filter,
      videoFilter: getComputedStyle(v).filter,
      // What a person looking at this tile sees: the placeholder when the
      // camera is off, else the picture (self: the pixels J sends).
      looksSoft: camOff ? soft(getComputedStyle(av).filter) : (me ? sends === 'blurred' : soft(getComputedStyle(v).filter)),
      status: (document.getElementById('status') || {}).textContent || '',
    };
  });
}

async function seeEachOther(j, a) {
  await a.waitForFunction(() => [...document.querySelectorAll('#feed .tile:not(.me) .name')].some((n) => /Jordan/.test(n.textContent)), null, { timeout: 90000 });
  await j.waitForFunction(() => [...document.querySelectorAll('#feed .tile:not(.me) .name')].some((n) => /Avery/.test(n.textContent)), null, { timeout: 90000 });
}

async function camOn(page) {
  // A DOM click: in a quiet 2-person call the dock has faded and takes no pointer.
  await page.evaluate(() => document.getElementById('cam').click());
  await page.waitForFunction(() => !window.__gifosVideo.camOff(), null, { timeout: 20000 });
}

// Wait until both screens agree with the expectation, then return both reads.
async function settle(j, a, want, camOff) {
  const ok = (r) => r && r.looksSoft === want && r.camOff === camOff;
  const t0 = Date.now();
  let rj, ra;
  while (Date.now() - t0 < 30000) {
    rj = await readJ(j); ra = await readJ(a);
    if (ok(rj) && ok(ra)) break;
    await j.waitForTimeout(500);
  }
  return { self: rj, remote: ra };
}

async function pair(j, a, tag) {
  await j.screenshot({ path: path.join(SHOTS, 'self-blur-' + tag + '-self-' + PHASE + '-1280.png') });
  await a.screenshot({ path: path.join(SHOTS, 'self-blur-' + tag + '-remote-' + PHASE + '-1280.png') });
}

test.describe('self-view blur matches remote view', () => {
  test.skip(({ browserName }) => browserName === 'webkit', 'desktop pair runs Chromium + Firefox; WebKit runs on another box');
  test.setTimeout(240000);

  test('a room with no password: J is soft on both screens, camera off and on', async ({ browserName }) => {
    const room = 'qaselfsoft' + Date.now().toString(36);
    const J = await open(browserName, 'Jordan Lee');
    const A = await open(browserName, 'Avery Chen');
    try {
      await enter(J.page, '#v=' + room);
      await enter(A.page, '#v=' + room);
      await camOn(A.page);
      await seeEachOther(J.page, A.page);

      const off = await settle(J.page, A.page, true, true);
      await pair(J.page, A.page, 'soft-camoff');
      expect(off.self.status).toMatch(/faces stay soft/);
      expect(off.self.camOff).toBe(true);
      expect(off.remote.camOff).toBe(true);
      expect(off.self.avatarShown).toBe(true);
      expect(off.remote.avatarShown).toBe(true);
      // what Avery sees of J (the remote view) and what J sees of J match: soft
      expect(off.remote.looksSoft).toBe(true);
      expect(off.self.looksSoft).toBe(true);
      expect(off.self.avatarFilter).toBe(off.remote.avatarFilter);

      await camOn(J.page);
      const on = await settle(J.page, A.page, true, false);
      await pair(J.page, A.page, 'soft-camon');
      expect(on.self.camOff).toBe(false);
      expect(on.remote.camOff).toBe(false);
      expect(on.remote.looksSoft).toBe(true);
      expect(on.self.looksSoft).toBe(true);
    } finally {
      await J.b.close().catch(() => {});
      await A.b.close().catch(() => {});
    }
  });

  test('an admin room with a password: nothing is soft, camera off and on', async ({ browserName }) => {
    const room = 'qaselfclear' + Date.now().toString(36);
    const J = await open(browserName, 'Jordan Lee');
    const A = await open(browserName, 'Avery Chen');
    try {
      // J starts a room they run, with a guest password.
      await J.page.goto(URL0 + '/run.html', { waitUntil: 'domcontentloaded' });
      await J.page.click('#lob-admin-btn');
      await J.page.fill('#lob-admin-name', room);
      await J.page.fill('#lob-admin-pass', 'qa-admin-' + room);
      // The guest password opens under its own link.
      const reveal = J.page.locator('#lob-guest-more:visible, #lob-guest-reveal:visible').first();
      if (await reveal.count()) await reveal.click();
      await J.page.fill('#lob-guest-pass', 'qa-guest-' + room);
      await J.page.click('#lob-admin-go');
      await J.page.waitForFunction(() => /av=/.test(location.hash), null, { timeout: 30000 });
      await J.page.waitForLoadState('domcontentloaded');
      await J.page.waitForSelector('#leavebtn', { state: 'visible', timeout: 60000 });
      await J.page.waitForFunction(() => window.__gifosVideo && typeof window.__gifosVideo.camOff === 'function', null, { timeout: 30000 });
      const hash = await J.page.evaluate(() => location.hash);
      await J.page.evaluate(() => document.getElementById('blur-none').click());

      // Avery joins with the link and types the guest password at the door.
      await A.page.goto(URL0 + '/run.html' + hash, { waitUntil: 'domcontentloaded' });
      // The door asks for it, unless Avery got in before the host's lock went
      // up; then the room hands Avery the password (the grant) instead.
      await A.page.waitForFunction(() => document.getElementById('pw-modal').style.display === 'flex'
        || [...document.querySelectorAll('#feed .tile:not(.me) .name')].some((n) => /Jordan/.test(n.textContent)), null, { timeout: 60000 });
      await A.page.evaluate((v) => {
        if (document.getElementById('pw-modal').style.display !== 'flex') return;
        document.getElementById('pw-new').value = v; document.getElementById('pw-save').click();
      }, 'qa-guest-' + room);
      await A.page.waitForSelector('#leavebtn', { state: 'visible', timeout: 60000 });
      await camOn(A.page);
      await seeEachOther(J.page, A.page);
      await A.page.evaluate(() => document.getElementById('blur-none').click());
      // Avery's own face goes clear on J's screen: the room is a clear room.
      await J.page.waitForFunction(() => {
        const t = [...document.querySelectorAll('#feed .tile:not(.me)')].find((x) => /Avery/.test(x.textContent));
        return t && !/blur\(/.test(getComputedStyle(t.querySelector('video')).filter);
      }, null, { timeout: 60000 });

      const off = await settle(J.page, A.page, false, true);
      await pair(J.page, A.page, 'clear-camoff');
      expect(off.self.status).not.toMatch(/soft|blurred/);
      expect(off.self.camOff).toBe(true);
      expect(off.remote.camOff).toBe(true);
      expect(off.remote.looksSoft).toBe(false);
      expect(off.self.looksSoft).toBe(false);

      await camOn(J.page);
      const on = await settle(J.page, A.page, false, false);
      await pair(J.page, A.page, 'clear-camon');
      expect(on.self.camOff).toBe(false);
      expect(on.remote.looksSoft).toBe(false);
      expect(on.self.looksSoft).toBe(false);
    } finally {
      await J.b.close().catch(() => {});
      await A.b.close().catch(() => {});
    }
  });
});
