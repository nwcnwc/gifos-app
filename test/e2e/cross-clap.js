/*
 * cross-clap.js — a viewer's clap crosses a real link to the host's stage.
 *
 * The specs fake the frame. This one runs two real browsers, each on its own
 * machine if you give it two Playwright run-servers, through a real relay:
 *
 *   1. the host goes live from the lobby (Go live, a name, a password)
 *   2. the viewer opens the host's link and saves the name card
 *   3. the host's room bar reads 1 watching
 *   4. the viewer claps twice, and the host's stage reads 👏 2, never more
 *
 * Env:
 *   BASE       the site, as the browsers reach it (http://127.0.0.1:8765)
 *   RELAY      the relay, as the browsers reach it (ws://127.0.0.1:8790)
 *   HOST_PW    ws:// of a `playwright run-server` for the host (empty: here)
 *   VIEWER_PW  same for the viewer
 *   PW         module to load Playwright from; it must match the run-servers
 *   SHOTS      folder for the host and viewer screenshots (optional)
 *
 * Exit 0 on pass, 1 on fail.
 */
const PW = require(process.env.PW || '@playwright/test');
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const RELAY = process.env.RELAY || 'ws://127.0.0.1:8790';
const SHOTS = process.env.SHOTS || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A plain-http site on another machine is not a secure context, and the room
// key needs WebCrypto.
const ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  '--unsafely-treat-insecure-origin-as-secure=' + BASE + ',' + RELAY.replace(/^ws/, 'http')];

async function open(endpoint) {
  if (!endpoint) return PW.chromium.launch({ args: ARGS });
  return PW.chromium.connect(endpoint, { headers: { 'x-playwright-launch-options': JSON.stringify({ args: ARGS }) }, timeout: 30000 });
}

async function user(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, permissions: ['camera', 'microphone'] });
  await ctx.addInitScript(([r, n]) => { localStorage.setItem('gifos_relay', r); localStorage.setItem('gifos_name', n); }, [RELAY, name]);
  return ctx.newPage();
}

async function until(what, fn, ms) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last.ok) return last;
    await sleep(250);
  }
  throw new Error(what + ': ' + JSON.stringify(last));
}

(async () => {
  const hb = await open(process.env.HOST_PW);
  const vb = await open(process.env.VIEWER_PW);
  let failed = false;
  try {
    const host = await user(hb, 'Pastor Kim');
    await host.goto(BASE + '/run.html?desk=crosshost#bc=1');
    await host.waitForSelector('#lobby.show');
    await host.locator('#lob-admin-btn').click();
    await host.locator('#lob-admin-name').fill('clap-' + Date.now().toString(36));
    await host.locator('#lob-admin-pass').fill('host-pass-' + Math.random().toString(36).slice(2));
    await host.locator('#lob-admin-go').click();
    await host.waitForSelector('body.broadcast', { timeout: 30000 });
    await until('host is live', async () => ({ ok: (await host.locator('#airkind').textContent()) === 'Service · You are live' }), 15000);
    const link = BASE + '/run.html?desk=crossview#' + host.url().split('#')[1];

    const viewer = await user(vb, 'Jordan Lee');
    await viewer.goto(link);
    await viewer.getByRole('button', { name: 'Save' }).click({ timeout: 20000 });
    await until('viewer is watching', async () => ({ ok: (await viewer.locator('#airkind').textContent()) === 'Service · You are watching' }), 15000);
    const linked = () => window.__gifosVideo.liveDataLinks();
    await until('a data link both ways', async () => {
      const h = await host.evaluate(linked), v = await viewer.evaluate(linked);
      return { ok: h >= 1 && v >= 1, h, v };
    }, 60000);
    await until('host room bar counts the viewer', async () => {
      const t = await host.locator('#airbar').innerText();
      return { ok: /\b1 watching\b/.test(t), t };
    }, 20000);
    console.log('linked: host bar reads 1 watching');

    for (let i = 0; i < 2; i++) {
      if (!(await viewer.locator('#reacttray button[aria-label="Clap"]').isVisible())) await viewer.locator('#reactbtn').click();
      await viewer.locator('#reacttray button[aria-label="Clap"]').click();
      await sleep(400);
    }
    const pills = () => document.getElementById('bc-reacts').innerText.trim();
    await until('viewer stage', async () => { const t = await viewer.evaluate(pills); return { ok: t === '👏 2', t }; }, 5000);
    await until('host stage', async () => { const t = await host.evaluate(pills); return { ok: t === '👏 2', t }; }, 10000);
    // A late second copy over another path must not add a third.
    await sleep(3000);
    const after = await host.evaluate(pills);
    if (after !== '👏 2') throw new Error('host stage drifted to ' + after);
    console.log('PASS: viewer clapped twice, host stage reads ' + after);
    if (SHOTS) {
      await host.screenshot({ path: SHOTS + '/cross-clap-host.png' });
      await viewer.screenshot({ path: SHOTS + '/cross-clap-viewer.png' });
    }
  } catch (e) {
    failed = true;
    console.log('FAIL: ' + e.message);
  } finally {
    await hb.close().catch(() => {});
    await vb.close().catch(() => {});
  }
  process.exit(failed ? 1 : 0);
})();
