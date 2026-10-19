const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// ONE OS runtime header for every app, Meet included (Nathan 2026-10-18
// 19:06-19:26): Help and Full screen are the header's own buttons, the same
// in a solo app, an app room and a meeting, and the meeting's header fades
// over the call without moving a face.

// Playwright's Linux WebKit aborts on an Ed25519 signature over 64 KB; the
// page then signs with its own JS signer (a documented hook).
const JS_SIGNER = () => { window.GIFOS_ED_FORCE_JS = true; };
const RELAY = 'ws://127.0.0.1:9/never';
test.use({ serviceWorkers: 'block' });

async function prime(page, browserName) {
  if (browserName === 'webkit') await page.addInitScript(JS_SIGNER);
  await page.addInitScript((relay) => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
    localStorage.setItem('gifos_relay', relay);
  }, RELAY);
}

async function install(page) {
  await page.goto('/store.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GifOS && GifOS.store && GifOS.store.putFile);
  const bytes = fs.readFileSync(path.join(__dirname, '..', '..', 'apps', '2048', '2048.gif'));
  return page.evaluate(async (b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const id = 'file_test_2048_' + Date.now().toString(36);
    await GifOS.store.putFile({ id, name: '2048.gif', bytes: u, kind: 'gif', isApp: true, appId: '2048', mime: 'image/gif' });
    return id;
  }, bytes.toString('base64'));
}

// The OS buttons as a person meets them, and every other Help or Full
// screen control the page shows.
function readHeader() {
  const shown = (el) => {
    if (!el || !el.getClientRects().length) return false;
    for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; }
    return true;
  };
  const one = (id) => {
    const el = document.getElementById(id);
    const r = el.getBoundingClientRect();
    return { shown: shown(el), inHeader: !!el.closest('#appbar'), label: el.getAttribute('aria-label') || el.textContent.trim(), title: el.title,
      keys: el.getAttribute('aria-keyshortcuts'), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(innerWidth - r.right), x: Math.round(r.x), y: Math.round(r.y) };
  };
  const others = [...document.querySelectorAll('button, [role="button"]')].filter((el) => shown(el) && el.id !== 'apphelp' && el.id !== 'appfull')
    .filter((el) => /^(help|full screen)$/i.test((el.getAttribute('aria-label') || el.textContent || '').trim())).map((el) => el.id || el.className);
  return { help: one('apphelp'), full: one('appfull'), others };
}
const same = (h) => ({ help: { ...h.help, x: 0, y: 0 }, full: { ...h.full, x: 0, y: 0 }, others: h.others });

for (const [w, hgt] of [[1280, 720], [390, 844]]) {
  test('Help and Full screen are the same OS header buttons in a solo app, an app room and Meet at ' + w, async ({ page, browserName }) => {
    await page.setViewportSize({ width: w, height: hgt });
    await prime(page, browserName);
    const fileId = await install(page);
    const got = {};
    await page.goto('/run.html#id=' + encodeURIComponent(fileId) + '&debug=on', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
    got.solo = await page.evaluate(readHeader);
    await page.click('#appinvite');
    await page.click('#inv-go');
    await page.waitForFunction(() => document.body.classList.contains('app-room'), null, { timeout: 20000 });
    await page.evaluate(() => { for (const m of document.querySelectorAll('.name-modal')) m.style.display = 'none'; });
    got.room = await page.evaluate(readHeader);
    await page.goto('about:blank');
    await page.goto('/run.html#v=qaoshdr' + w + '&debug=on', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#leavebtn', { state: 'visible' });
    got.meet = await page.evaluate(readHeader);
    await page.evaluate((id) => window.__gifosVideo.runAppForTest(id, '2048'), fileId);
    await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
    got.meetApp = await page.evaluate(readHeader);
    await page.screenshot({ path: 'test/desktop/shots/os-header-meetapp-' + w + '.png' });

    expect(got.solo.help).toMatchObject({ shown: true, inHeader: true, keys: 'Alt+/' });
    expect(got.solo.full).toMatchObject({ shown: true, inHeader: true, keys: 'F', label: 'Full screen' });
    expect(got.solo.others).toEqual([]);
    // The tip follows the room. The buttons themselves stay the same control.
    const geom = (h) => { const s = same(h); delete s.help.title; delete s.full.title; return s; };
    for (const k of ['room', 'meet']) expect(geom(got[k]), k + ' ' + JSON.stringify(got[k])).toEqual(geom(got.solo));
    expect(got.solo.help.title).toBe('How this app works');
    expect(got.room.help.title).toBe('How this app works');
    expect(got.meet.help.title).toBe('How this small group works');
    // A meeting's host also gets Stop app, between the two: Help sits one button further in.
    const moved = (h) => { const s = same(h); delete s.help.right; return s; };
    expect(moved(got.meetApp), JSON.stringify(got.meetApp)).toEqual(moved(got.solo));
    expect(await page.evaluate(() => {
      const kids = [...document.getElementById('appbar').children].filter((el) => el.getClientRects().length && getComputedStyle(el).display !== 'none');
      return kids.slice(kids.findIndex((el) => el.id === 'apphelp') + 1, kids.findIndex((el) => el.id === 'appfull')).map((el) => el.id);
    })).toEqual(['appstop']);
    // A meeting's header lies where a solo app's does: the same boxes, to the pixel.
    expect({ hx: got.meet.help.x, hy: got.meet.help.y, fx: got.meet.full.x, fy: got.meet.full.y })
      .toEqual({ hx: got.solo.help.x, hy: got.solo.help.y, fx: got.solo.full.x, fy: got.solo.full.y });
  });
}

async function meet(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html#v=qaoshide' + w + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 3, connected: true }));
  expect(seeded && seeded.ok).toBe(true);
  await page.waitForFunction(() => document.querySelectorAll('#feed .tile').length >= 4);
}

test('Help in a meeting opens the meeting\'s own help, and Alt+/ does too', async ({ page }) => {
  await meet(page, 1280, 720);
  await page.click('#apphelp');
  await expect(page.locator('#help-modal')).toBeVisible();
  await expect(page.locator('#apphelp-modal')).toBeHidden();
  await page.click('#help-close');
  await page.mouse.click(640, 8);
  await page.keyboard.press('Alt+Slash');
  await expect(page.locator('#help-modal')).toBeVisible();
});

const tiles = () => [...document.querySelectorAll('#feed .tile, #stagefeed .rowtile')].filter((t) => t.getClientRects().length)
  .map((t) => { const r = t.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(','); });
const headOpacity = () => getComputedStyle(document.getElementById('appbar')).opacity;

for (const [w, h] of [[1280, 720], [390, 844], [844, 390]]) {
  test('the meeting header auto-hides over the call and waking it moves no face at ' + w + 'x' + h, async ({ page }) => {
    await meet(page, w, h);
    expect(await page.evaluate(() => document.getElementById('appbar').dataset.hide)).toBe('auto');
    await page.mouse.move(w / 2, h / 3);
    await page.mouse.move(w / 2 + 4, h / 3 + 4);
    await expect.poll(() => page.evaluate(headOpacity)).toBe('1');
    const awake = await page.evaluate(tiles);
    await page.evaluate(() => window.__gifosVideo.setDockCalmMsForTest(400));
    await expect.poll(() => page.evaluate(headOpacity), { timeout: 15000 }).toBe('0');
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('apphelp')).pointerEvents)).toBe('none');
    const calm = await page.evaluate(tiles);
    await page.keyboard.press('Shift');
    await expect.poll(() => page.evaluate(headOpacity)).toBe('1');
    const woke = await page.evaluate(tiles);
    expect(calm).toEqual(awake);
    expect(woke).toEqual(awake);
  });
}

// iPhone Safari exposes no element fullscreen. The OS header's Full screen
// still opens the in-page filmstrip, which is what the dock button used to do.
test('iPhone: Full screen opens the in-page view when the browser has none', async ({ page }) => {
  await page.addInitScript(() => {
    const deny = { configurable: true, get: () => false };
    for (const k of ['fullscreenEnabled', 'webkitFullscreenEnabled']) {
      try { Object.defineProperty(Document.prototype, k, deny); } catch (e) {}
      try { Object.defineProperty(document, k, deny); } catch (e) {}
    }
    const nope = () => Promise.reject(new Error('no element fullscreen'));
    Element.prototype.requestFullscreen = nope;
    try { Element.prototype.webkitRequestFullscreen = nope; } catch (e) {}
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qaosiphone&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await expect(page.locator('#appfull')).toBeVisible();
  expect(await page.evaluate(() => document.getElementById('appfull').dataset.fsMode)).toBe('inpage');
  await page.click('#appfull');
  await expect.poll(() => page.evaluate(() => ({
    on: document.getElementById('fsview').classList.contains('on'),
    el: !!document.fullscreenElement,
    pressed: document.getElementById('appfull').getAttribute('aria-pressed'),
  }))).toEqual({ on: true, el: false, pressed: 'true' });
  await page.click('#fsclose');
  await expect.poll(() => page.evaluate(() => ({
    on: document.getElementById('fsview').classList.contains('on'),
    pressed: document.getElementById('appfull').getAttribute('aria-pressed'),
  }))).toEqual({ on: false, pressed: 'false' });
});
