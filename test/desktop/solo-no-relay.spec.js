const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Running an app is one tab and no network. A catalog app launched the way the
// Home Screen and the Store launch it (run.html#id=<fileId>) must open NO relay
// socket, mint NO room, and paint NO meeting chrome — not even in the moment
// before the boot script runs, which is where a phone on a slow link sat and
// read "GifOS Joining… / Fit" over a black page (Nathan, 2026-10-18 18:48).
// Only Invite → Create link may turn the page into a room and reach the relay.

// Playwright's Linux WebKit does WebCrypto with libgcrypt, which aborts the tab
// on an Ed25519 signature over 64 KB (an app's bytes); Safari does not. There
// the page uses its own JS signer (same signatures; a documented hook).
const JS_SIGNER = () => { window.GIFOS_ED_FORCE_JS = true; };

// Never reach the production relay from a test: the URL is only recorded.
const RELAY = 'ws://127.0.0.1:9/never';

// The hold below must see the request: a service worker would answer it
// from its cache without ever reaching the route.
test.use({ serviceWorkers: 'block' });

const APPS = [
  { slug: 'tic-tac-toe', name: 'Tic-Tac-Toe' },
  { slug: '2048', name: '2048' },
];

async function prime(page, browserName) {
  if (browserName === 'webkit') await page.addInitScript(JS_SIGNER);
  await page.addInitScript((relay) => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
    localStorage.setItem('gifos_relay', relay);
    // Every socket this page ever asks for, by URL, from the first script on.
    window.__ws = [];
    const W = window.WebSocket;
    const H = function (u, p) { window.__ws.push(String(u)); return p === undefined ? new W(u) : new W(u, p); };
    H.prototype = W.prototype;
    H.CONNECTING = 0; H.OPEN = 1; H.CLOSING = 2; H.CLOSED = 3;
    window.WebSocket = H;
  }, RELAY);
}

// Install the catalog app the way the Store does: one putFile into this
// browser's store, then launch its fileId.
async function install(page, app) {
  await page.goto('/store.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GifOS && GifOS.store && GifOS.store.putFile);
  const bytes = fs.readFileSync(path.join(__dirname, '..', '..', 'apps', app.slug, app.slug + '.gif'));
  return page.evaluate(async ([b64, name, slug]) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const id = 'file_test_' + slug + '_' + Date.now().toString(36);
    await GifOS.store.putFile({ id, name: name + '.gif', bytes: u, kind: 'gif', isApp: true, appId: slug, mime: 'image/gif' });
    return id;
  }, [bytes.toString('base64'), app.name, app.slug]);
}

// Runs IN the page (page.evaluate), so it carries its own helper.
function readPage() {
  const shown = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
  };
  return {
    hash: location.hash,
    html: document.documentElement.className,
    body: document.body ? document.body.className : '',
    topchip: shown('.topchip'), status: shown('#statuscount'), fit: shown('#fitbtn'), bar: shown('.bar'),
    joining: document.body ? /Joining/.test(document.body.innerText) : false,
    ws: window.__ws.slice(),
  };
}

for (const app of APPS) {
  test(app.name + ' launched solo opens no socket and no room until Invite makes the link', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // Nathan's phone
    await prime(page, browserName);
    const sockets = [];
    page.on('websocket', (ws) => sockets.push(ws.url()));
    const fileId = await install(page, app);

    // Hold an early parser-blocking script of the boot so the page sits where
    // a slow phone sits: static HTML painted, no boot script yet. (One the
    // Store page did not load, so no browser answers it from its cache.)
    let release;
    const held = new Promise((r) => { release = r; });
    await page.route('**/js/gifos-help.js', async (route) => { await held; await route.continue(); });
    await page.goto('/run.html#id=' + encodeURIComponent(fileId) + '&debug=on', { waitUntil: 'commit' });
    await page.waitForSelector('#fitbtn', { state: 'attached' });
    // The theme gate reveals the body after 1.5 s at most; look after that.
    // (Interval polling: WebKit does not run rAF while the parser is blocked.)
    await page.waitForFunction(() => !document.documentElement.classList.contains('gifos-booting'), null, { polling: 200 });
    const early = await page.evaluate(readPage);
    expect(early.body, 'the hold did not engage; the boot script already ran').toBe('');
    expect(early.html).toContain('solo-app');
    expect(early.body).not.toContain('app-room');
    expect(early.topchip, 'meeting header painted on a solo launch: ' + JSON.stringify(early)).toBe(false);
    expect(early.status, '"Joining…" painted on a solo launch: ' + JSON.stringify(early)).toBe(false);
    expect(early.fit, 'Fit painted on a solo launch: ' + JSON.stringify(early)).toBe(false);
    expect(early.bar).toBe(false);
    expect(early.ws).toEqual([]);
    release();

    // The app runs. Still one tab, no network, no room.
    await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
    await expect(page.locator('#appinvite')).toBeVisible();
    await page.waitForTimeout(1500); // anything eager would have connected by now
    const solo = await page.evaluate(readPage);
    expect(solo.body).toContain('solo-app');
    expect(solo.body).not.toContain('app-room');
    expect(solo.hash).toContain('id=' + encodeURIComponent(fileId));
    expect(solo.hash).not.toMatch(/[#&](v|j|s)=/);
    expect(solo.topchip).toBe(false);
    expect(solo.status).toBe(false);
    expect(solo.fit).toBe(false);
    expect(solo.joining).toBe(false);
    expect(solo.ws).toEqual([]);
    expect(sockets).toEqual([]);

    // Invite → Create link: NOW the page becomes a room and reaches the relay.
    await page.click('#appinvite');
    await page.waitForSelector('#inv-go');
    await page.click('#inv-go');
    await page.waitForFunction(() => document.body.classList.contains('app-room'), null, { timeout: 20000 });
    await page.waitForFunction(() => window.__ws.length > 0, null, { timeout: 20000 });
    const room = await page.evaluate(readPage);
    expect(room.body).not.toContain('solo-app');
    expect(room.html).not.toContain('solo-app');
    expect(room.hash).toMatch(/^#(s=.+&k=|j=)/);
    for (const u of room.ws) expect(u.startsWith(RELAY)).toBe(true);
  });
}
