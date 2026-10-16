/*
 * Broadcast roles must not inherit Meet publish controls.
 *
 * Viewers watch and chat. A click, a system media key, or a Meet share
 * grant does not publish camera, microphone, or screen. Stage guests get
 * camera and microphone; demoting them stops the tracks and removes the
 * controls. Hosts keep publish controls and moderate from Who.
 *
 * Gate: NODE_PATH=/tmp/bc-pw/node_modules node test/browser/e2e-broadcast-roles.js
 * That command also runs test/browser/e2e-avatar-feed.js (the avatar rides
 * the video track, and blur covers it).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..', '..');
const PORT = Number(process.env.BC_PORT || 8767);

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

const VIEWPORTS = [
  { name: 'desktop', opts: { viewport: { width: 1280, height: 800 } } },
  { name: 'phone', opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  { name: 'landscape', opts: { viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true } },
];

function fail(list, msg) { list.push(msg); }

(async () => {
  const server = serve();
  await new Promise((res) => server.listen(PORT, '127.0.0.1', res));
  const base = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const bad = [];

  const lobby = await browser.newContext(VIEWPORTS[0].opts);
  const lobbyPage = await lobby.newPage();
  await lobbyPage.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
  await lobbyPage.goto(base + '/run.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await lobbyPage.waitForFunction(() => window.GifOS && GifOS.net && GifOS.net.randHex, { timeout: 20000 });
  const minted = await lobbyPage.evaluate(async () => {
    const seed = GifOS.net.randHex(32);
    const k = await GifOS.net.edKeysFromSeedHex(seed);
    return { seed, av: k.verifier };
  });
  await lobby.close();

  const hash = '#v=bcroles&av=' + minted.av + '&bc=1';
  const roomKey = 'bcroles.' + minted.av;

  async function openRole(layout, host) {
    const ctx = await browser.newContext(layout.opts);
    await ctx.addInitScript((arg) => {
      try {
        localStorage.setItem('gifos_name', 'Pat');
        localStorage.setItem('gifos_meet_bar', '0');
        if (arg.host) localStorage.setItem('gifos_vadm_' + arg.room, arg.seed);
      } catch (e) {}
      const bump = (name) => {
        const md = navigator.mediaDevices;
        if (!md || md['__bc_' + name]) return;
        const orig = md[name] && md[name].bind(md);
        if (!orig) return;
        md['__bc_' + name] = true;
        md[name] = function () {
          const bag = (window.__bcMedia = window.__bcMedia || { gum: 0, display: 0 });
          bag[name === 'getUserMedia' ? 'gum' : 'display']++;
          return orig.apply(md, arguments);
        };
      };
      bump('getUserMedia');
      bump('getDisplayMedia');
    }, { host, room: roomKey, seed: minted.seed });
    const page = await ctx.newPage();
    await page.goto(base + '/run.html' + hash, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#mic', { timeout: 20000, state: 'attached' });
    const skip = page.locator('#nmcancel');
    if (await skip.count()) await skip.click().catch(() => {});
    await page.evaluate(() => {
      const veil = document.getElementById('joinveil');
      if (veil) veil.style.display = 'none';
      const bar = document.querySelector('.bar');
      if (bar) bar.classList.remove('collapsed');
    });
    return { ctx, page };
  }

  // One desktop pass owns the publish checks. Every layout owns visibility,
  // so a phone or landscape rule cannot put a control back.
  for (const layout of VIEWPORTS) {
    const tag = layout.name;
    const viewer = await openRole(layout, false);
    const v = await viewer.page.evaluate(() => {
      const disp = (id) => {
        const el = document.getElementById(id);
        return el ? getComputedStyle(el).display : 'missing';
      };
      const blur = document.querySelector('.blurctl');
      document.body.classList.add('share-granted');
      const share = disp('sharebtn');
      document.body.classList.remove('share-granted');
      const set = document.getElementById('set-modal');
      set.style.display = 'flex';
      const video = document.getElementById('set-video')
        || Array.from(document.querySelectorAll('#set-modal .set-sec')).find((s) => /Video quality/.test(s.textContent));
      const caps = document.getElementById('set-captions')
        || Array.from(document.querySelectorAll('#set-modal .set-sec')).find((s) => /Captions language/.test(s.textContent));
      const videoDisplay = video ? getComputedStyle(video).display : 'missing';
      const capsDisplay = caps ? getComputedStyle(caps).display : 'missing';
      set.style.display = 'none';
      return {
        hand: (document.getElementById('hand').textContent || '').trim(),
        mic: disp('mic'),
        cam: disp('cam'),
        share,
        app: disp('appbtn'),
        rec: disp('recbtn'),
        cc: disp('ccbtn'),
        pw: disp('pwbtn'),
        stage: disp('stagebtn'),
        chat: disp('chatbtn'),
        who: disp('whobtn'),
        blur: blur ? getComputedStyle(blur).display : 'missing',
        videoDisplay,
        capsDisplay,
        mix: disp('mixpanel'),
      };
    });
    if (v.hand !== 'Ask to join') fail(bad, tag + ' viewer hand says "' + v.hand + '"');
    for (const [key, label] of [['mic', 'mic'], ['cam', 'camera'], ['share', 'share'], ['app', 'run app'], ['rec', 'record'], ['cc', 'captions'], ['pw', 'password'], ['stage', 'stage'], ['blur', 'blur']]) {
      if (v[key] !== 'none') fail(bad, tag + ' viewer ' + label + ' display ' + v[key]);
    }
    if (v.chat === 'none' || v.who === 'none') fail(bad, tag + ' viewer lost chat or who');
    if (v.videoDisplay !== 'none') fail(bad, tag + ' viewer settings still offer video quality');
    if (v.capsDisplay !== 'none') fail(bad, tag + ' viewer settings still offer captions');
    if (v.mix !== 'none') fail(bad, tag + ' viewer settings still offer the sound mix');

    if (tag === 'desktop') {
      const before = await viewer.page.evaluate(() => (window.__bcMedia || { gum: 0, display: 0 }));
      await viewer.page.evaluate(() => {
        document.getElementById('mic').click();
        document.getElementById('cam').click();
        document.getElementById('sharebtn').click();
        document.getElementById('ccbtn').click();
        document.getElementById('recbtn').click();
        document.getElementById('appbtn').click();
      });
      await viewer.page.waitForTimeout(400);
      const after = await viewer.page.evaluate(() => (window.__bcMedia || { gum: 0, display: 0 }));
      if (after.gum !== before.gum) fail(bad, 'viewer click published getUserMedia (' + (after.gum - before.gum) + ')');
      if (after.display !== before.display) fail(bad, 'viewer click published getDisplayMedia (' + (after.display - before.display) + ')');
      const live = await viewer.page.evaluate(() => {
        const api = window.__gifosVideo;
        if (!api || typeof api.broadcastProbe !== 'function') return { missing: true };
        return api.broadcastProbe();
      });
      if (!live.missing) {
        const publishing = (live.tracks || []).some((t) => t.state === 'live' && t.enabled) || (live.senders || []).length || live.screen;
        if (publishing) fail(bad, 'viewer probe still has a live track');
      }
    }
    await viewer.ctx.close();

    const host = await openRole(layout, true);
    await host.page.waitForFunction(() => document.body.classList.contains('amadmin') || document.body.classList.contains('bc-host'), { timeout: 15000 }).catch(() => {});
    await host.page.waitForTimeout(600);
    const h = await host.page.evaluate(() => {
      const disp = (id) => {
        const el = document.getElementById(id);
        return el ? getComputedStyle(el).display : 'missing';
      };
      return {
        mic: disp('mic'),
        share: disp('sharebtn'),
        rec: disp('recbtn'),
        cc: disp('ccbtn'),
        pw: disp('pwbtn'),
        app: disp('appbtn'),
        shareAll: disp('shareall'),
        blurAll: disp('blurall'),
        camAll: disp('camall'),
        vote: disp('votebtn'),
        mix: disp('mixpanel'),
        role: window.__gifosVideo && window.__gifosVideo.broadcastRole ? window.__gifosVideo.broadcastRole() : '',
      };
    });
    if (h.mic === 'none') fail(bad, tag + ' host lost the microphone');
    if (h.share === 'none') fail(bad, tag + ' host lost screen share');
    if (h.rec === 'none' || h.cc === 'none' || h.pw === 'none' || h.app === 'none') fail(bad, tag + ' host lost record, captions, password, or run app');
    if (h.shareAll !== 'none') fail(bad, tag + ' host still has Allow screen share');
    if (h.blurAll !== 'none' || h.camAll !== 'none') fail(bad, tag + ' host still has the Meet guest-video hammers');
    if (h.vote !== 'none' || h.mix !== 'none') fail(bad, tag + ' host still has vote or the sound mix');

    if (tag === 'desktop') {
      const mods = await host.page.evaluate(() => {
        const api = window.__gifosVideo;
        if (!api || typeof api.seedWatcherForTest !== 'function') return { missing: true };
        api.seedWatcherForTest('Ada');
        document.getElementById('whobtn').click();
        const buttons = Array.from(document.querySelectorAll('#who-list [data-bc-mod]')).map((b) => b.getAttribute('data-bc-mod'));
        return { buttons };
      });
      if (mods.missing) fail(bad, 'host roster moderation is not on Who');
      else {
        for (const act of ['stage', 'mute', 'blur', 'ban']) {
          if (mods.buttons.indexOf(act) < 0) fail(bad, 'host Who list has no ' + act);
        }
        if (mods.buttons.indexOf('share') >= 0) fail(bad, 'host Who list offers screen share');
      }
    }
    await host.ctx.close();
  }

  // Stage guest: camera and mic, then demotion stops publishing.
  const stage = await openRole(VIEWPORTS[0], false);
  await stage.page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.myPid && window.__gifosVideo.myPid(), { timeout: 20000 }).catch(() => {});
  const stageResult = await stage.page.evaluate(async () => {
    const api = window.__gifosVideo;
    if (!api || typeof api.broadcastGrantForTest !== 'function') return { missing: true };
    const up = api.broadcastGrantForTest(true);
    const hand = (document.getElementById('hand').textContent || '').trim();
    const mic = getComputedStyle(document.getElementById('mic')).display;
    const share = getComputedStyle(document.getElementById('sharebtn')).display;
    const rec = getComputedStyle(document.getElementById('recbtn')).display;
    document.getElementById('mic').click();
    await new Promise((r) => setTimeout(r, 500));
    const live = api.broadcastProbe();
    document.getElementById('sharebtn').click();
    const down = api.broadcastGrantForTest(false);
    document.getElementById('mic').click();
    await new Promise((r) => setTimeout(r, 200));
    const after = api.broadcastProbe();
    return { up, hand, mic, share, rec, live, down, after, media: window.__bcMedia || { gum: 0, display: 0 } };
  });
  if (stageResult.missing) fail(bad, 'stage grant cannot be applied or revoked');
  else {
    if (stageResult.mic === 'none') fail(bad, 'stage guest has no microphone');
    if (stageResult.share !== 'none' || stageResult.rec !== 'none') fail(bad, 'stage guest can share or record');
    if (stageResult.hand === 'Ask to join') fail(bad, 'stage guest is still labelled as a viewer');
    const upLive = (stageResult.live.tracks || []).some((t) => t.kind === 'audio' && t.state === 'live');
    if (!upLive && !(stageResult.media.gum > 0)) fail(bad, 'stage guest microphone did not publish');
    const still = (stageResult.after.tracks || []).some((t) => t.state === 'live' && t.enabled) || (stageResult.after.senders || []).length || stageResult.after.screen;
    if (still || stageResult.after.role !== 'viewer') fail(bad, 'demotion left a publish path (' + stageResult.after.role + ')');
    const micAfter = await stage.page.evaluate(() => getComputedStyle(document.getElementById('mic')).display);
    if (micAfter !== 'none') fail(bad, 'demotion left the microphone button');
  }
  await stage.ctx.close();

  await browser.close();
  server.close();
  if (bad.length) {
    console.error('FAIL\n' + bad.join('\n'));
    process.exit(1);
  }
  console.log('PASS broadcast roles');
  const avatar = spawnSync(process.execPath, [path.join(__dirname, 'e2e-avatar-feed.js')], {
    stdio: 'inherit',
    env: process.env,
    cwd: ROOT,
  });
  if (avatar.status) process.exit(avatar.status || 1);
})().catch((err) => { console.error(err); process.exit(1); });
