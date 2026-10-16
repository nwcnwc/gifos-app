/*
 * Before and after shots for Broadcast viewer, stage guest, and host.
 *
 *   NODE_PATH=/tmp/bc-pw/node_modules node test/browser/broadcast-design-shots.js before
 *   NODE_PATH=/tmp/bc-pw/node_modules node test/browser/broadcast-design-shots.js after
 *
 * "before" is the live page. "after" is the same page once the confirmed
 * design is on it: on-air words, the viewer join line, the raised-hands
 * list, and stage-seat actions.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const WHEN = process.argv[2] === 'after' ? 'after' : 'before';
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs', 'screenshots', 'broadcast-design', WHEN);
const PORT = Number(process.env.BC_SHOT_PORT || 8765);

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  return http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = (url === '/' ? '/index.html' : url).replace(/^\/+/, '');
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('missing'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
}

async function settle(page) {
  await page.waitForSelector('#mic', { timeout: 20000, state: 'attached' });
  const skip = page.locator('#nmcancel');
  if (await skip.count()) await skip.click().catch(() => {});
  await page.evaluate(() => {
    const veil = document.getElementById('joinveil');
    if (veil) veil.style.display = 'none';
    const bar = document.querySelector('.bar');
    if (bar) bar.classList.remove('collapsed');
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = serve();
  await new Promise((res) => server.listen(PORT, '127.0.0.1', res));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const base = 'http://127.0.0.1:' + PORT;
  const desktop = { viewport: { width: 1280, height: 800 } };
  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

  const lobbyCtx = await browser.newContext(desktop);
  const lobbyPage = await lobbyCtx.newPage();
  await lobbyPage.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
  await lobbyPage.goto(base + '/run.html#bc=1', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await lobbyPage.waitForSelector('#lob-join-btn', { timeout: 20000 });
  await lobbyPage.click('#lob-join-btn');
  await lobbyPage.waitForTimeout(200);
  const joinFile = path.join(OUT, 'viewer-join.png');
  await lobbyPage.screenshot({ path: joinFile });
  console.log('shot', joinFile);
  await lobbyPage.waitForFunction(() => window.GifOS && GifOS.net && GifOS.net.edKeysFromSeedHex, { timeout: 20000 });
  const minted = await lobbyPage.evaluate(async () => {
    const seed = GifOS.net.randHex(32);
    const k = await GifOS.net.edKeysFromSeedHex(seed);
    return { seed, av: k.verifier };
  });
  await lobbyCtx.close();

  const hash = '#v=bcshot&av=' + minted.av + '&bc=1';
  const roles = [
    ['viewer', false, false],
    ['stage', false, true],
    ['host', true, false],
  ];

  for (const layout of [{ name: 'desktop', opts: desktop }, { name: 'phone', opts: phone }]) {
    for (const [name, host, stage] of roles) {
      const ctx = await browser.newContext(layout.opts);
      await ctx.addInitScript((arg) => {
        try {
          localStorage.setItem('gifos_name', 'Pat');
          localStorage.setItem('gifos_meet_bar', '0');
          if (arg.host) localStorage.setItem('gifos_vadm_' + arg.room, arg.seed);
        } catch (e) {}
      }, { host, room: 'bcshot.' + minted.av, seed: minted.seed });
      const page = await ctx.newPage();
      await page.goto(base + '/run.html' + hash, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await settle(page);
      if (stage) {
        await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.myPid && window.__gifosVideo.myPid(), { timeout: 20000 }).catch(() => {});
        await page.evaluate(() => {
          if (window.__gifosVideo && window.__gifosVideo.broadcastGrantForTest) window.__gifosVideo.broadcastGrantForTest(true);
        });
      }
      if (host) {
        await page.waitForFunction(() => document.body.classList.contains('amadmin') || document.body.classList.contains('bc-host'), { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(400);
        await page.evaluate(() => {
          const api = window.__gifosVideo;
          if (!api) return;
          if (typeof api.seedWatcherForTest === 'function') {
            api.seedWatcherForTest('Ada', { hand: true });
            api.seedWatcherForTest('Bea', { stage: true });
            api.seedWatcherForTest('Cal');
          }
          const who = document.getElementById('whobtn');
          if (who) who.click();
        });
      }
      await page.waitForTimeout(250);
      const file = path.join(OUT, layout.name + '-' + name + '.png');
      await page.screenshot({ path: file });
      console.log('shot', file);
      await ctx.close();
    }
  }

  await browser.close();
  server.close();
})().catch((err) => { console.error(err); process.exit(1); });
