/*
 * Before and after shots for the desktop service gaps.
 *
 *   NODE_PATH=/tmp/bc-pw/node_modules node test/e2e/role-gap-shots.js before
 *   NODE_PATH=/tmp/bc-pw/node_modules node test/e2e/role-gap-shots.js after
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const { chromium } = require('playwright-core');

const WHEN = process.argv[2] === 'after' ? 'after' : 'before';
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'test', 'e2e', 'artifacts', 'role-gaps', WHEN);
const PORT = Number(process.env.BC_SHOT_PORT || 8771);

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

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = serve();
  await new Promise((res) => server.listen(PORT, '127.0.0.1', res));
  const base = 'http://127.0.0.1:' + PORT;
  const shots = [
    ['viewer-dock.png', '/run.html?desk=gap#mb=1&v=sunday&av=0123456789abcdef&bc=1', () => {
      localStorage.setItem('gifos_name', 'Pat');
      localStorage.setItem('gifos_meet_bar', '0');
    }, async (page) => {
      await page.waitForSelector('#onair.watch');
    }],
    ['service-help.png', '/run.html?desk=gaphelp#mb=1&v=sunday&av=0123456789abcdef&bc=1', () => {
      localStorage.setItem('gifos_name', 'Pat');
      localStorage.setItem('gifos_meet_bar', '0');
    }, async (page) => {
      await page.waitForSelector('#onair.watch');
      await page.click('#apphelp');
      await page.waitForSelector('#help-modal', { state: 'visible' });
    }],
    ['viewer-join.png', '/run.html?desk=gapjoin#mb=1&v=sunday&av=0123456789abcdef&bc=1', () => {
      localStorage.setItem('gifos_name', 'Pat');
    }, async (page) => {
      await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.ensureNameForTest);
      await page.evaluate(() => { window.__gifosVideo.ensureNameForTest(); return null; });
      await page.waitForSelector('#appear-modal .appear-box', { state: 'visible' });
    }],
    ['viewer-lobby.png', '/run.html#bc=1', () => {
      localStorage.setItem('gifos_name', 'Pat');
    }, async (page) => {
      await page.waitForSelector('#lob-join-btn');
      await page.click('#lob-join-btn');
    }],
    ['host-cards.png', '/run.html?desk=gaphost#mb=1&v=sunday&av=0123456789abcdef&bc=1', () => {
      localStorage.setItem('gifos_name', 'Pat');
      localStorage.setItem('gifos_meet_bar', '0');
      localStorage.setItem('gifos_vadm_sunday.0123456789abcdef', 'host-key');
    }, async (page) => {
      await page.waitForSelector('#onair.live');
      await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.stageGuestForTest);
      await page.evaluate(() => {
        window.__gifosVideo.stageGuestForTest('Jordan Lee');
        if (window.__gifosVideo.raisedHandForTest) window.__gifosVideo.raisedHandForTest('Sam Okonkwo');
      });
    }],
  ];
  for (const [file, hash, init, prep] of shots) {
    const run = (async () => {
    const browser = await chromium.launch({
      executablePath: process.env.CHROME || '/usr/bin/google-chrome',
      headless: true,
      args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultTimeout(12000);
    await page.addInitScript(init);
    await page.goto(base + hash, { waitUntil: 'commit', timeout: 20000 });
    await prep(page);
    await page.screenshot({ path: path.join(OUT, file) });
    console.log('shot', file);
    await Promise.race([
      browser.close(),
      new Promise((resolve) => setTimeout(resolve, 800)),
    ]);
    })();
    const timer = new Promise((_, reject) => setTimeout(() => reject(new Error('timed out ' + file)), 20000));
    try { await Promise.race([run, timer]); }
    catch (err) { console.error(String(err && err.message || err)); }
    try { execSync('pkill -9 -f google-chrome'); } catch (e) {}
  }
  server.close();
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
