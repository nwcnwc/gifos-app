/*
 * cross-clap.js — a viewer's clap crosses a real link to the host's stage.
 *
 * The specs fake the frame. This one runs two real browsers, each on its own
 * machine if you give it two Playwright run-servers, through a real relay:
 *
 *   1. the host goes live from the lobby (Go live, a name, a password)
 *   2. the viewer opens the host's link and saves the name card
 *   3. the viewer claps twice the moment its link opens
 *   4. both stages read 👏 2, the host's never more
 *   5. the host's room bar reads 1 watching
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

let hb, vb, shot = false;
async function shoot() {
  shot = true;
  if (!SHOTS) return;
  for (const b of [hb, vb]) for (const c of b.contexts()) for (const pg of c.pages()) {
    await pg.screenshot({ path: SHOTS + '/cross-clap-' + (b === hb ? 'host' : 'viewer') + '.png' }).catch(() => {});
  }
}

(async () => {
  hb = await open(process.env.HOST_PW);
  vb = await open(process.env.VIEWER_PW);
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
    // The viewer claps twice inside the page the moment its link opens, with
    // no round trip to this script in between: that is when the roster is
    // still catching up.
    await viewer.evaluate(() => new Promise((resolve, reject) => {
      const end = Date.now() + 60000;
      const tray = () => document.querySelector('#reacttray button[aria-label="Clap"]');
      (function wait() {
        if (window.__gifosVideo.liveDataLinks() >= 1) {
          document.getElementById('reactbtn').click();
          tray().click();
          setTimeout(() => { if (!tray().offsetParent) document.getElementById('reactbtn').click(); tray().click(); resolve(); }, 400);
        } else if (Date.now() > end) reject(new Error('no link in 60s'));
        else setTimeout(wait, 20);
      })();
    }));
    const pills = () => document.getElementById('bc-reacts').innerText.trim();
    // The pills fade 4 s after the last clap, so both stages are read now.
    const t0 = Date.now();
    let host2 = '', seen = '';
    while (Date.now() - t0 < 3000) {
      const v = await viewer.evaluate(pills), h = await host.evaluate(pills);
      seen = 'viewer ' + JSON.stringify(v) + ', host ' + JSON.stringify(h);
      if (h && h !== '👏 2') host2 = h; // a third copy, or only one clap
      if (v === '👏 2' && h === '👏 2') break;
      await sleep(150);
    }
    await shoot();
    if (seen !== 'viewer "👏 2", host "👏 2"') throw new Error('stages read ' + seen);
    // A late copy over the other path must not add a third.
    await sleep(800);
    const after = await host.evaluate(pills);
    if (after !== '👏 2') throw new Error('host stage moved to ' + JSON.stringify(after) + (host2 ? ' after ' + host2 : ''));
    await until('host room bar counts the viewer', async () => {
      const t = await host.locator('#airbar').innerText();
      return { ok: /\b1 watching\b/.test(t), t };
    }, 20000);
    console.log('PASS: viewer clapped twice as the link opened; host stage reads 👏 2, room bar 1 watching');
  } catch (e) {
    failed = true;
    console.log('FAIL: ' + e.message);
  } finally {
    if (!shot) await shoot();
    await hb.close().catch(() => {});
    await vb.close().catch(() => {});
  }
  process.exit(failed ? 1 : 0);
})();
