/*
 * Confirmed Broadcast design: stage only, host step on and off, a raised-hands
 * list with Promote, stage-seat and viewer-list actions, viewer join copy,
 * and on-air words beside the lamp. A viewer still does not publish.
 *
 * Gate: NODE_PATH=/tmp/bc-pw/node_modules node test/browser/e2e-broadcast-design.js
 * test/browser/e2e-broadcast-roles.js runs this after the role and avatar checks.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..', '..');
const PORT = Number(process.env.BC_DESIGN_PORT || 8769);
const WATCH = 'Watching the service. You stay off camera. Your name and picture are only seen if you raise a hand and the host promotes you to the stage.';

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

function fail(list, msg) { list.push(msg); }

function enabledLive(probe) {
  return (probe.tracks || []).some((t) => t.state === 'live' && t.enabled) || (probe.senders || []).length || probe.screen;
}

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
  const desktop = { viewport: { width: 1280, height: 800 } };
  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

  const lobby = await browser.newContext(desktop);
  const lobbyPage = await lobby.newPage();
  await lobbyPage.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
  await lobbyPage.goto(base + '/run.html#bc=1', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await lobbyPage.waitForFunction(() => window.GifOS && GifOS.net && GifOS.net.edKeysFromSeedHex, { timeout: 20000 });
  await lobbyPage.click('#lob-join-btn');
  const joinText = await lobbyPage.locator('#lob-watch-note').textContent().catch(() => '');
  if ((joinText || '').trim() !== WATCH) fail(bad, 'viewer join step says "' + (joinText || '').trim() + '"');
  const meetLobby = await browser.newContext(desktop);
  const meetPage = await meetLobby.newPage();
  await meetPage.goto(base + '/run.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await meetPage.click('#lob-join-btn');
  const meetNote = await meetPage.locator('#lob-watch-note').count();
  const meetHidden = meetNote
    ? await meetPage.locator('#lob-watch-note').evaluate((el) => el.hidden || getComputedStyle(el).display === 'none')
    : true;
  if (!meetHidden) fail(bad, 'meeting join step shows the broadcast watch line');
  await meetLobby.close();
  const minted = await lobbyPage.evaluate(async () => {
    const seed = GifOS.net.randHex(32);
    const k = await GifOS.net.edKeysFromSeedHex(seed);
    return { seed, av: k.verifier };
  });
  await lobby.close();

  const hash = '#v=bcdesign&av=' + minted.av + '&bc=1';
  const roomKey = 'bcdesign.' + minted.av;

  async function openRole(layout, host) {
    const ctx = await browser.newContext(layout);
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

  async function feedHidden(page) {
    return page.evaluate(() => {
      const disp = (id) => {
        const el = document.getElementById(id);
        return el ? getComputedStyle(el).display : 'missing';
      };
      return { grid: disp('grid'), stadium: disp('stadium') };
    });
  }

  for (const layout of [{ name: 'desktop', opts: desktop }, { name: 'phone', opts: phone }]) {
    const viewer = await openRole(layout.opts, false);
    const feeds = await feedHidden(viewer.page);
    if (feeds.grid !== 'none' || feeds.stadium !== 'none') fail(bad, layout.name + ' viewer still shows grid or stadium (' + feeds.grid + '/' + feeds.stadium + ')');
    const watch = await viewer.page.evaluate(() => {
      const air = document.getElementById('onair');
      const note = document.getElementById('bc-join-note');
      const words = air && air.querySelector('.words') ? air.querySelector('.words').textContent : '';
      return {
        hidden: !air || air.hidden || getComputedStyle(air).display === 'none',
        words: (words || '').trim(),
        note: note ? (note.textContent || '').trim() : '',
        noteHidden: !note || note.hidden || getComputedStyle(note).display === 'none',
        mic: getComputedStyle(document.getElementById('mic')).display,
        cam: getComputedStyle(document.getElementById('cam')).display,
      };
    });
    if (watch.hidden || watch.words !== 'Watching') fail(bad, layout.name + ' viewer on-air is "' + watch.words + '" hidden=' + watch.hidden);
    if (watch.note !== WATCH || watch.noteHidden) fail(bad, layout.name + ' viewer join line missing');
    if (watch.mic !== 'none' || watch.cam !== 'none') fail(bad, layout.name + ' viewer still shows mic or camera');
    if (layout.name === 'desktop') {
      const before = await viewer.page.evaluate(() => (window.__bcMedia || { gum: 0, display: 0 }));
      await viewer.page.click('#hand');
      const raised = (await viewer.page.locator('#hand').textContent() || '').trim();
      if (raised !== 'Lower hand') fail(bad, 'viewer raise leaves the hand as "' + raised + '"');
      await viewer.page.click('#hand');
      const lowered = (await viewer.page.locator('#hand').textContent() || '').trim();
      if (lowered !== 'Ask to join') fail(bad, 'viewer lower leaves the hand as "' + lowered + '"');
      await viewer.page.evaluate(() => {
        document.getElementById('mic').click();
        document.getElementById('cam').click();
      });
      await viewer.page.waitForTimeout(300);
      const after = await viewer.page.evaluate(() => (window.__bcMedia || { gum: 0, display: 0 }));
      if (after.gum !== before.gum || after.display !== before.display) fail(bad, 'viewer hand or dock click published');
      const probe = await viewer.page.evaluate(() => window.__gifosVideo.broadcastProbe());
      if (enabledLive(probe)) fail(bad, 'viewer is publishing after raising a hand');
    }
    await viewer.ctx.close();
  }

  const host = await openRole(desktop, true);
  await host.page.waitForFunction(() => {
    const b = document.getElementById('stagebtn');
    return b && (b.textContent || '').trim() === 'Step down';
  }, { timeout: 8000 }).catch(() => {});
  const stepped = (await host.page.locator('#stagebtn').textContent().catch(() => '') || '').trim();
  if (stepped !== 'Step down') fail(bad, 'host is not on stage after the admin key ("' + stepped + '")');
  const hostFeeds = await feedHidden(host.page);
  if (hostFeeds.grid !== 'none' || hostFeeds.stadium !== 'none') fail(bad, 'host still shows grid or stadium');
  const quiet = await host.page.evaluate(() => {
    const air = document.getElementById('onair');
    const words = air && air.querySelector('.words') ? air.querySelector('.words').textContent : '';
    const probe = window.__gifosVideo.broadcastProbe();
    return { words: (words || '').trim(), probe, gum: (window.__bcMedia || { gum: 0 }).gum };
  });
  if (quiet.words !== 'Off air') fail(bad, 'host who is not sending reads "' + quiet.words + '"');
  if (enabledLive(quiet.probe)) fail(bad, 'host publishes before a camera tap');
  const gumBeforeStep = quiet.gum;
  await host.page.click('#stagebtn');
  const down = (await host.page.locator('#stagebtn').textContent() || '').trim();
  if (down !== 'Stage') fail(bad, 'host step-down left the button as "' + down + '"');
  await host.page.click('#stagebtn');
  const up = (await host.page.locator('#stagebtn').textContent() || '').trim();
  if (up !== 'Step down') fail(bad, 'host step-up left the button as "' + up + '"');
  const afterStep = await host.page.evaluate(() => {
    const probe = window.__gifosVideo.broadcastProbe();
    return { probe, gum: (window.__bcMedia || { gum: 0 }).gum };
  });
  if (afterStep.gum !== gumBeforeStep) fail(bad, 'stepping on and off the stage published');
  if (enabledLive(afterStep.probe)) fail(bad, 'host is sending after stepping back on');
  await host.page.click('#cam');
  await host.page.waitForTimeout(600);
  const live = await host.page.evaluate(() => {
    const air = document.getElementById('onair');
    const words = air && air.querySelector('.words') ? air.querySelector('.words').textContent : '';
    return { words: (words || '').trim(), probe: window.__gifosVideo.broadcastProbe() };
  });
  const sending = (live.probe.tracks || []).some((t) => t.kind === 'video' && t.state === 'live' && t.enabled);
  if (!sending) fail(bad, 'host camera tap did not publish video');
  if (live.words !== 'Live') fail(bad, 'host who is sending reads "' + live.words + '"');

  const desk = await host.page.evaluate(() => {
    const api = window.__gifosVideo;
    if (!api || typeof api.seedWatcherForTest !== 'function' || typeof api.broadcastModForTest !== 'function') return { missing: true };
    const ada = api.seedWatcherForTest('Ada', { hand: true });
    const bea = api.seedWatcherForTest('Bea', { stage: true });
    const cal = api.seedWatcherForTest('Cal');
    const handBtns = Array.from(document.querySelectorAll('#handq .bc-hand button')).map((b) => b.textContent.trim());
    const seatBtns = Array.from(document.querySelectorAll('#bc-seats .bc-seat button')).map((b) => b.textContent.trim());
    const handNames = Array.from(document.querySelectorAll('#handq .bc-hand .hq')).map((n) => n.textContent.trim());
    const seatNames = Array.from(document.querySelectorAll('#bc-seats .bc-seat-name')).map((n) => n.textContent.trim());
    return { ada, bea, cal, handBtns, seatBtns, handNames, seatNames };
  });
  if (desk.missing) fail(bad, 'raised-hands list and stage seats are not wired');
  else {
    if (desk.handNames.indexOf('Ada') < 0) fail(bad, 'raised-hands list has no Ada');
    for (const label of ['Promote', 'Mute', 'Blur', 'Ban']) {
      if (desk.handBtns.indexOf(label) < 0) fail(bad, 'raised-hands list has no ' + label);
    }
    if (desk.seatNames.indexOf('Bea') < 0) fail(bad, 'stage seats have no Bea');
    for (const label of ['Demote', 'Mute', 'Blur', 'Ban']) {
      if (desk.seatBtns.indexOf(label) < 0) fail(bad, 'stage seat has no ' + label);
    }
    if (desk.handNames.indexOf('Cal') >= 0) fail(bad, 'a watcher with no hand is in the raised-hands list');
    await host.page.evaluate(() => document.getElementById('whobtn').click());
    const who = await host.page.evaluate(() => {
      const group = (k) => document.querySelector('#who-list [data-group="' + k + '"]');
      const acts = (k) => {
        const head = group(k);
        if (!head) return [];
        const row = head.nextElementSibling;
        if (!row) return [];
        return Array.from(row.querySelectorAll('[data-bc-mod]')).map((b) => b.textContent.trim());
      };
      return {
        stage: !!group('stage'),
        hands: !!group('hands'),
        watching: !!group('watching'),
        stageActs: acts('stage'),
        handActs: acts('hands'),
        watchActs: acts('watching'),
      };
    });
    if (!who.stage || !who.hands || !who.watching) fail(bad, 'viewer list is missing On stage, Raised hands, or Watching');
    for (const label of ['Demote', 'Mute', 'Blur', 'Ban']) {
      if (who.stageActs.indexOf(label) < 0) fail(bad, 'On stage row has no ' + label);
    }
    if (who.handActs.indexOf('Promote') < 0) fail(bad, 'Raised hands row has no Promote');
    if (who.watchActs.indexOf('Promote') < 0 || who.watchActs.indexOf('Ban') < 0) fail(bad, 'Watching row is missing Promote or Ban');
    const promoted = await host.page.evaluate((id) => {
      const btn = document.querySelector('#handq .bc-hand button[data-bc-act="promote"]');
      if (btn) btn.click();
      return window.__gifosVideo.broadcastModForTest(id);
    }, desk.ada);
    if (!promoted.app) fail(bad, 'Promote did not grant the stage');
    const demoted = await host.page.evaluate((id) => {
      const btn = document.querySelector('#bc-seats .bc-seat button[data-bc-act="demote"]');
      if (btn) btn.click();
      return window.__gifosVideo.broadcastModForTest(id);
    }, desk.bea);
    if (demoted.app) fail(bad, 'Demote left the stage grant on');
    const gumActs = await host.page.evaluate(() => (window.__bcMedia || { gum: 0, display: 0 }));
    if (gumActs.display) fail(bad, 'Promote or Demote published a screen');
  }
  await host.ctx.close();

  const phoneHost = await openRole(phone, true);
  await phoneHost.page.waitForFunction(() => document.body.classList.contains('amadmin') || document.body.classList.contains('bc-host'), { timeout: 15000 }).catch(() => {});
  const phoneDesk = await phoneHost.page.evaluate(() => {
    const api = window.__gifosVideo;
    const feeds = {
      grid: getComputedStyle(document.getElementById('grid')).display,
      stadium: getComputedStyle(document.getElementById('stadium')).display,
    };
    if (!api || typeof api.seedWatcherForTest !== 'function') return { missing: true, feeds };
    api.seedWatcherForTest('Ada', { hand: true });
    const promote = document.querySelector('#handq button[data-bc-act="promote"]');
    const air = document.getElementById('onair');
    return {
      feeds,
      promote: promote ? getComputedStyle(promote).display : 'missing',
      words: air && air.querySelector('.words') ? air.querySelector('.words').textContent.trim() : '',
    };
  });
  if (phoneDesk.missing) fail(bad, 'phone host cannot seed a raised hand');
  else {
    if (phoneDesk.feeds.grid !== 'none' || phoneDesk.feeds.stadium !== 'none') fail(bad, 'phone host still shows grid or stadium');
    if (phoneDesk.promote === 'none' || phoneDesk.promote === 'missing') fail(bad, 'phone raised-hands Promote is ' + phoneDesk.promote);
    if (phoneDesk.words !== 'Off air' && phoneDesk.words !== 'Live') fail(bad, 'phone host on-air is "' + phoneDesk.words + '"');
  }
  await phoneHost.ctx.close();

  const stage = await openRole(desktop, false);
  await stage.page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.myPid && window.__gifosVideo.myPid(), { timeout: 20000 }).catch(() => {});
  const stageResult = await stage.page.evaluate(async () => {
    const api = window.__gifosVideo;
    api.broadcastGrantForTest(true);
    const air = document.getElementById('onair');
    const beforeWords = air && air.querySelector('.words') ? air.querySelector('.words').textContent.trim() : '';
    const note = document.getElementById('bc-join-note');
    const noteHidden = !note || note.hidden || getComputedStyle(note).display === 'none';
    document.getElementById('mic').click();
    await new Promise((r) => setTimeout(r, 500));
    const up = api.broadcastProbe();
    api.broadcastGrantForTest(false);
    document.getElementById('mic').click();
    await new Promise((r) => setTimeout(r, 200));
    const down = api.broadcastProbe();
    return {
      beforeWords,
      noteHidden,
      up,
      down,
      mic: getComputedStyle(document.getElementById('mic')).display,
      grid: getComputedStyle(document.getElementById('grid')).display,
    };
  });
  if (stageResult.grid !== 'none') fail(bad, 'stage guest shows the row grid');
  if (stageResult.beforeWords !== 'Off air') fail(bad, 'stage guest who is not sending reads "' + stageResult.beforeWords + '"');
  if (!stageResult.noteHidden) fail(bad, 'stage guest still sees the viewer join line');
  const upLive = (stageResult.up.tracks || []).some((t) => t.kind === 'audio' && t.state === 'live');
  if (!upLive) fail(bad, 'stage guest microphone did not publish');
  if (enabledLive(stageResult.down) || stageResult.down.role !== 'viewer') fail(bad, 'demotion left a publish path');
  if (stageResult.mic !== 'none') fail(bad, 'demotion left the microphone button');
  await stage.ctx.close();

  await browser.close();
  server.close();
  if (bad.length) {
    console.error('FAIL\n' + bad.join('\n'));
    process.exit(1);
  }
  console.log('PASS broadcast design');
})().catch((err) => { console.error(err); process.exit(1); });
