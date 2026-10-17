/*
 * cross-lib.js — what the cross-machine tests share: open a browser here or on
 * a Playwright run-server, a host who goes live, a viewer who opens the link.
 *
 * Env:
 *   BASE       the site, as the browsers reach it (http://127.0.0.1:8765)
 *   RELAY      the relay, as the browsers reach it (ws://127.0.0.1:8790)
 *   HOST_PW    ws:// of a `playwright run-server` for the host (empty: here)
 *   VIEWER_PW  same for the viewer
 *   PW         module to load Playwright from; it must match the run-servers
 *   SHOTS      folder for the host and viewer screenshots (optional)
 */
const PW = require(process.env.PW || '@playwright/test');
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const RELAY = process.env.RELAY || 'ws://127.0.0.1:8790';
const SHOTS = process.env.SHOTS || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A plain-http site on another machine is not a secure context, and the room
// key needs WebCrypto. Only full Chromium honors the flag; the headless shell
// ignores it.
const ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  '--unsafely-treat-insecure-origin-as-secure=' + BASE + ',' + RELAY.replace(/^ws/, 'http')];

async function open(endpoint) {
  const opts = { channel: 'chromium', args: ARGS };
  if (!endpoint) return PW.chromium.launch(opts);
  // The run-server must be started with --unsafe, or it drops the args.
  return PW.chromium.connect(endpoint, { headers: { 'x-playwright-launch-options': JSON.stringify(opts) }, timeout: 30000 });
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

// The host goes live from the lobby (Go live, a name, a password).
async function goLive(hb, prefix) {
  const host = await user(hb, 'Pastor Kim');
  await host.goto(BASE + '/run.html?desk=crosshost#bc=1');
  await host.waitForSelector('#lobby.show');
  await host.locator('#lob-admin-btn').click();
  await host.locator('#lob-admin-name').fill(prefix + '-' + Date.now().toString(36));
  await host.locator('#lob-admin-pass').fill('host-pass-' + Math.random().toString(36).slice(2));
  await host.locator('#lob-admin-go').click();
  await host.waitForSelector('body.broadcast', { timeout: 30000 });
  await until('host is live', async () => ({ ok: (await host.locator('#airkind').textContent()) === 'Service · You are live' }), 15000);
  return host;
}

// The viewer opens the host's link and saves the name card.
async function watch(vb, host) {
  const viewer = await user(vb, 'Jordan Lee');
  await viewer.goto(BASE + '/run.html?desk=crossview#' + host.url().split('#')[1]);
  await viewer.getByRole('button', { name: 'Save' }).click({ timeout: 20000 });
  await until('viewer is watching', async () => ({ ok: (await viewer.locator('#airkind').textContent()) === 'Service · You are watching' }), 15000);
  return viewer;
}

async function shoot(browsers, name) {
  if (!SHOTS) return;
  for (const [who, b] of Object.entries(browsers)) for (const c of b.contexts()) for (const pg of c.pages()) {
    await pg.screenshot({ path: SHOTS + '/' + name + '-' + who + '.png' }).catch(() => {});
  }
}

// Runs body(hb, vb) with both browsers open, prints PASS or FAIL, exits 0 or 1.
async function run(name, body) {
  const hb = await open(process.env.HOST_PW);
  const vb = await open(process.env.VIEWER_PW);
  let failed = false, shot = false;
  try {
    console.log('PASS: ' + await body(hb, vb, async () => { shot = true; await shoot({ host: hb, viewer: vb }, name); }));
  } catch (e) {
    failed = true;
    console.log('FAIL: ' + e.message);
  } finally {
    if (!shot) await shoot({ host: hb, viewer: vb }, name);
    await hb.close().catch(() => {});
    await vb.close().catch(() => {});
  }
  process.exit(failed ? 1 : 0);
}

module.exports = { sleep, until, goLive, watch, run };
