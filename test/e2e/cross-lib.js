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

// A kept service records from Go live, and everyone gets the recording card
// (the consent: Stay or Leave, OK for the one recording). A person reads it
// and closes it before anything else; so do these scripts.
async function ackRecording(pg, ms) {
  const ok = pg.locator('#rec-notice-ok');
  await ok.waitFor({ state: 'visible', timeout: ms }).then(() => ok.click(), () => {});
}

// Save on the name card. A kept service is recording, so its card can come
// up over the name card first; a person reads it (Stay) and then saves.
async function saveName(pg, ms) {
  const end = Date.now() + (ms || 20000);
  const save = pg.getByRole('button', { name: 'Save' });
  for (;;) {
    const ok = pg.locator('#rec-notice-ok');
    if (await ok.isVisible()) await ok.click();
    try { await save.click({ timeout: 1000 }); return; } catch (e) { if (Date.now() > end) throw e; }
  }
}

// The host goes live from the lobby (Go live, a name, a password). setup, if
// given, runs on the host's page before it opens (e.g. to route its sockets).
async function goLive(hb, prefix, setup) {
  const host = await user(hb, 'Pastor Kim');
  if (setup) await setup(host);
  await host.goto(BASE + '/run.html?desk=crosshost#bc=1');
  await host.waitForSelector('#lobby.show');
  // A service lobby opens on its Go live form; a plain lobby has the button first.
  if (await host.locator('#lob-admin-btn').isVisible()) await host.locator('#lob-admin-btn').click();
  await host.locator('#lob-admin-name').fill(prefix + '-' + Date.now().toString(36));
  // The service sheet mints the host key itself; an older lobby asks for it.
  if (await host.locator('#lob-admin-pass').isVisible()) await host.locator('#lob-admin-pass').fill('host-pass-' + Math.random().toString(36).slice(2));
  await host.locator('#lob-admin-go').click();
  await host.waitForSelector('body.broadcast', { timeout: 30000 });
  await until('host is live', async () => ({ ok: (await host.locator('#airkind').textContent()) === 'Service · You are live' }), 15000);
  await ackRecording(host, 15000);
  return host;
}

// A hosted small group (no service): Host this call, a name, the host key
// (minted by the lobby when it offers no field).
async function hostCall(hb, prefix) {
  const host = await user(hb, 'Pastor Kim');
  await host.goto(BASE + '/run.html?desk=crosshost');
  await host.waitForSelector('#lobby.show');
  await host.locator('#lob-admin-btn').click();
  await host.locator('#lob-admin-name').fill(prefix + '-' + Date.now().toString(36));
  if (await host.locator('#lob-admin-pass').isVisible()) await host.locator('#lob-admin-pass').fill('host-pass-' + Math.random().toString(36).slice(2));
  await host.locator('#lob-admin-go').click();
  await host.waitForSelector('body.amadmin', { timeout: 30000 });
  return host;
}

// A guest opens the host's link and saves the name card.
async function joinCall(vb, host, name) {
  const guest = await user(vb, name || 'Jordan Lee');
  await guest.goto(BASE + '/run.html?desk=crossguest#' + host.url().split('#')[1]);
  await guest.getByRole('button', { name: 'Save' }).click({ timeout: 20000 }).catch(() => {});
  await until('the guest is in the call', async () => ({ ok: await guest.evaluate(() => document.querySelectorAll('.tile:not(.me)').length >= 1) }), 30000);
  return guest;
}

// Go live turns the camera on (0.9.23b). A script about a camera-off stage
// turns it off the way a host does: wake the controls, press Camera.
async function camOff(host) {
  await host.mouse.move(640, 300);
  await host.mouse.move(660, 320);
  const cam = host.locator('#cam');
  if ((await cam.getAttribute('aria-label')) === 'Stop video') await cam.click();
  await until('the host camera is off', async () => ({ ok: (await cam.getAttribute('aria-label')) === 'Start video' }), 10000);
}

// The viewer opens the host's link and saves the name card.
async function watch(vb, host) {
  const viewer = await user(vb, 'Jordan Lee');
  await viewer.goto(BASE + '/run.html?desk=crossview#' + host.url().split('#')[1]);
  await saveName(viewer);
  await until('viewer is watching', async () => ({ ok: (await viewer.locator('#airkind').textContent()) === 'Service · You are watching' }), 15000);
  await ackRecording(viewer, 10000);
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

module.exports = { BASE, RELAY, sleep, until, user, ackRecording, saveName, goLive, camOff, watch, hostCall, joinCall, run };
