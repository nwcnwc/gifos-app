const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// The OS header's Invite slot follows the ROOM, never the app (Nathan
// 2026-10-18 20:02): a solo app mints its room; in that app room only the
// owner has Invite, and it opens the room's own link again, as often as they
// like; a guest has no Invite at all (they forward the link); in a meeting the
// only Invite is the meeting's, it stays visible while an app runs there, and
// that app never mints a room.
// INV_SHOT=before names the pictures for a base run.
const SHOT = process.env.INV_SHOT || 'after';
const RELAY = 'ws://127.0.0.1:9/never';
const JS_SIGNER = () => { window.GIFOS_ED_FORCE_JS = true; };

test.use({ serviceWorkers: 'block' });

async function prime(page, browserName, w, h) {
  await page.setViewportSize({ width: w, height: h });
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
  const bytes = fs.readFileSync(path.join(__dirname, '..', '..', 'apps', 'tic-tac-toe', 'tic-tac-toe.gif'));
  return page.evaluate(async (b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const id = 'file_test_ttt_' + Date.now().toString(36);
    await GifOS.store.putFile({ id, name: 'Tic-Tac-Toe.gif', bytes: u, kind: 'gif', isApp: true, appId: 'tic-tac-toe', mime: 'image/gif' });
    return id;
  }, bytes.toString('base64'));
}

// Every Invite a person can see or reach right now, by id, and the words of
// any "A room you run" on screen.
function invites() {
  const seen = (el) => {
    if (!el || el.hidden) return false;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return false;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    }
    return true;
  };
  const ids = ['appinvite'];
  return {
    shown: ids.filter((id) => seen(document.getElementById(id))),
    armed: ids.filter((id) => { const el = document.getElementById(id); return !!el && !el.hidden && el.style.display !== 'none' && getComputedStyle(el).display !== 'none'; }),
    roomYouRun: [...document.querySelectorAll('button')].filter((b) => seen(b) && /a room you run/i.test(b.textContent)).length,
    kind: document.body.classList.contains('app-room') ? 'app-room' : document.body.classList.contains('solo-app') ? 'solo' : 'meet',
    hash: location.hash,
  };
}

for (const [w, h, label] of [[1280, 720, 'laptop'], [390, 844, 'phone']]) {
  test(label + ': the owner reopens Invite in the app room, and it is the same link', async ({ page, browserName }) => {
    await prime(page, browserName, w, h);
    const fileId = await install(page);
    await page.goto('/run.html#id=' + encodeURIComponent(fileId) + '&debug=on', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
    await expect(page.locator('#appinvite')).toBeVisible();
    await page.click('#appinvite');
    await page.click('#inv-go');
    await expect(page.locator('#inv-modal')).toBeVisible({ timeout: 20000 });
    const first = await page.evaluate(() => ({ url: document.getElementById('inv-url').value, title: document.querySelector('#inv-modal h3').textContent }));
    expect(first.title).toBe('Share this app');
    expect((await page.evaluate(invites)).roomYouRun).toBe(0);
    await page.click('#inv-done');
    await expect(page.locator('#inv-modal')).toBeHidden();
    await page.screenshot({ path: 'test/desktop/shots/invslot-' + SHOT + '-owner-' + label + '.png' });
    const after = await page.evaluate(invites);
    expect(after.kind).toBe('app-room');
    expect(after.shown).toEqual(['appinvite']);
    // Again: the room's own link, never a second room and never the mint dialog.
    await page.click('#appinvite');
    await expect(page.locator('#inv-modal')).toBeVisible();
    expect(await page.locator('#inv-go').count()).toBe(0);
    const again = await page.evaluate(() => ({ url: document.getElementById('inv-url').value, title: document.querySelector('#inv-modal h3').textContent }));
    expect(again).toEqual(first);
    expect((await page.evaluate(invites)).roomYouRun).toBe(0);
    expect((await page.evaluate(invites)).hash).toBe(after.hash);
  });

  test(label + ': a guest in an app room has no Invite', async ({ page, browserName }) => {
    await prime(page, browserName, w, h);
    await page.goto('/run.html#j=qaguestslot&debug=on', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('app-room'));
    // Talk on: the call layer's chip row shows (the host's switch, on the ad).
    // Wait until the line would have armed the meeting's alone-Invite, so a
    // hidden chip is the room rule and not a line that has not painted yet.
    await page.evaluate(() => document.body.classList.add('audio-on'));
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return !!(s && s.dataset.kind === 'alone');
    });
    await page.screenshot({ path: 'test/desktop/shots/invslot-' + SHOT + '-guest-' + label + '.png' });
    const got = await page.evaluate(invites);
    expect(got.kind).toBe('app-room');
    expect({ shown: got.shown, armed: got.armed, roomYouRun: got.roomYouRun }).toEqual({ shown: [], armed: [], roomYouRun: 0 });
  });

  test(label + ': an app inside a meeting offers only the meeting\'s Invite and never mints a room', async ({ page, browserName }) => {
    await prime(page, browserName, w, h);
    const fileId = await install(page);
    await page.goto('/run.html#app=' + encodeURIComponent(fileId) + '&debug=on', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
    const before = await page.evaluate(invites);
    expect(before.kind).toBe('meet');
    expect(before.shown).toEqual(['appinvite']);
    await page.click('#appinvite');
    await expect(page.locator('#inv-modal')).toBeVisible();
    expect(await page.locator('#inv-go').count()).toBe(0);
    const sheet = await page.evaluate(() => ({
      title: document.querySelector('#inv-modal h3').textContent,
      url: document.getElementById('inv-url').value,
    }));
    expect(sheet.title).toBe('Share this meeting');
    expect(sheet.url).toMatch(/#v=/);
    expect(sheet.url).not.toMatch(/[#&](j|s|id)=/);
    const after = await page.evaluate(invites);
    expect(after.kind).toBe('meet');
    expect(after.hash).not.toMatch(/[#&](j|s|id)=/);
  });
}

test('laptop: app-room owner Invite survives reload', async ({ page, browserName }) => {
  await prime(page, browserName, 1280, 720);
  const fileId = await install(page);
  await page.goto('/run.html#id=' + encodeURIComponent(fileId) + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
  await page.click('#appinvite');
  await page.click('#inv-go');
  await page.waitForFunction(() => document.body.classList.contains('app-room'), null, { timeout: 20000 });
  const hashBefore = await page.evaluate(() => location.hash);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('app-room'), null, { timeout: 30000 });
  await expect(page.locator('#appinvite')).toBeVisible({ timeout: 20000 });
  const after = await page.evaluate(invites);
  expect(after.kind).toBe('app-room');
  expect(after.shown).toEqual(['appinvite']);
  expect(after.hash).toBe(hashBefore);
});
