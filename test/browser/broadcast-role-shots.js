/*
 * Role screenshots for the Broadcast dock and More cluster.
 *
 *   NODE_PATH=/tmp/bc-pw/node_modules node test/browser/broadcast-role-shots.js before
 *   NODE_PATH=/tmp/bc-pw/node_modules node test/browser/broadcast-role-shots.js after
 *
 * Serves this repo and opens run.html. "before" forces the classes the old
 * skin used. "after" uses the live role classes.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const WHEN = process.argv[2] === 'after' ? 'after' : 'before';
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs', 'screenshots', 'broadcast-roles', WHEN);
const PORT = Number(process.env.BC_PORT || 8766);

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

async function mint(page) {
  return page.evaluate(async () => {
    const seed = GifOS.net.randHex(32);
    const k = await GifOS.net.edKeysFromSeedHex(seed);
    return { seed, av: k.verifier };
  });
}

async function prep(page, role) {
  await page.waitForSelector('#mic', { timeout: 20000, state: 'attached' });
  const skip = page.locator('#nmcancel');
  if (await skip.count()) await skip.click().catch(() => {});
  await page.evaluate((which) => {
    const veil = document.getElementById('joinveil');
    if (veil) veil.style.display = 'none';
    const bar = document.querySelector('.bar');
    if (bar) bar.classList.remove('collapsed');
    if (which === 'before-viewer') {
      document.body.classList.add('broadcast', 'admroom', 'notadmin');
      document.body.classList.remove('stage-granted', 'amadmin', 'share-granted');
    } else if (which === 'before-stage') {
      document.body.classList.add('broadcast', 'admroom', 'notadmin', 'stage-granted');
      document.body.classList.remove('amadmin');
    } else if (which === 'before-host') {
      document.body.classList.add('broadcast', 'admroom', 'amadmin');
      document.body.classList.remove('notadmin');
    }
  }, role);
  await page.waitForTimeout(250);
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

  const lobby = await browser.newContext(desktop);
  const lobbyPage = await lobby.newPage();
  await lobbyPage.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
  await lobbyPage.goto(base + '/run.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await lobbyPage.waitForFunction(() => window.GifOS && GifOS.net && GifOS.net.edKeysFromSeedHex, { timeout: 20000 });
  const minted = await mint(lobbyPage);
  await lobby.close();

  const roles = WHEN === 'before'
    ? [
      ['viewer', 'before-viewer', '#v=bcshot&av=' + minted.av + '&bc=1', false],
      ['stage', 'before-stage', '#v=bcshot&av=' + minted.av + '&bc=1', false],
      ['host', 'before-host', '#v=bcshot&av=' + minted.av + '&bc=1', true],
    ]
    : [
      ['viewer', 'after-viewer', '#v=bcshot&av=' + minted.av + '&bc=1', false],
      ['stage', 'after-stage', '#v=bcshot&av=' + minted.av + '&bc=1', false],
      ['host', 'after-host', '#v=bcshot&av=' + minted.av + '&bc=1', true],
    ];

  for (const layout of [{ name: 'desktop', opts: desktop }, { name: 'phone', opts: phone }]) {
    for (const [name, mode, hash, host] of roles) {
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
      await prep(page, WHEN === 'before' ? mode : name);
      if (WHEN === 'after' && name === 'stage') {
        await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.myPid && window.__gifosVideo.myPid(), { timeout: 20000 }).catch(() => {});
        await page.evaluate(() => {
          if (window.__gifosVideo && window.__gifosVideo.broadcastGrantForTest) window.__gifosVideo.broadcastGrantForTest(true);
        });
        await page.waitForTimeout(200);
      }
      if (WHEN === 'after' && name === 'host') {
        await page.waitForFunction(() => document.body.classList.contains('amadmin') || document.body.classList.contains('bc-host'), { timeout: 15000 }).catch(() => {});
        await page.evaluate(() => {
          const veil = document.getElementById('joinveil');
          if (veil) veil.style.display = 'none';
          const bar = document.querySelector('.bar');
          if (bar) bar.classList.remove('collapsed');
          if (window.__gifosVideo && window.__gifosVideo.seedWatcherForTest) window.__gifosVideo.seedWatcherForTest('Ada');
          const who = document.getElementById('whobtn');
          if (who) who.click();
        });
        await page.waitForTimeout(200);
      }
      const file = path.join(OUT, layout.name + '-' + name + '.png');
      await page.screenshot({ path: file, fullPage: false });
      console.log('shot', file);
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
})().catch((err) => { console.error(err); process.exit(1); });
