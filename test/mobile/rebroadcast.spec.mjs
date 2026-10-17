import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { viewerBrowsers, PC_TAP, upRate } from './rebroadcast-lib.mjs';

// Q77. No mid-service catch-up and no replay pulled off a phone (Q76). The
// host REBROADCASTS instead: the last service, or any video file, plays into
// the live stage feed, the same fan-out a live service rides, so the host's
// upload does not grow with the audience. Viewers who arrive see whatever is
// playing now, marked Prerecorded (never LIVE), with no scrub and no save.
//
// Viewers run on other fleet machines when BC_VIEW_WS lists remote
// `npx playwright run-server` endpoints (see rebroadcast-lib.mjs).
//
// The clip (fixtures/rebroadcast-clip.webm, 120 s) flashes white and beeps
// together for 200 ms at every whole second, so a viewer can measure how far
// the sound lands from the picture.

const CLIP = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'rebroadcast-clip.webm');

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] }, permissions: ['camera', 'microphone'] });

async function joinViewer(browser, opts, baseURL, link) {
  const c = await browser.newContext({ ...opts, baseURL });
  const v = await c.newPage();
  await v.goto('/run.html' + link, { waitUntil: 'domcontentloaded' });
  await v.locator('#nmok').click();
  try {
    await v.waitForFunction(() => { const e = document.querySelector('#stagefeed .rowtile video'); return !!e && e.currentTime > 0.5; }, null, { timeout: 60000 });
  } catch (err) {
    // Say what the viewer had, so a miss names its stage.
    const st = await v.evaluate(() => ({ status: document.getElementById('status').textContent, badge: document.getElementById('livebadge-txt').textContent,
      tiles: document.querySelectorAll('#stagefeed .rowtile').length, via: window.__gifosVideo.stageViaForTest ? window.__gifosVideo.stageViaForTest() : null,
      t: (document.querySelector('#stagefeed .rowtile video') || {}).currentTime })).catch((e) => String(e));
    throw new Error('viewer never played the stage: ' + JSON.stringify(st));
  }
  return { c, v };
}

// Frames presented on the viewer's picture over ms, and how far it played.
async function advancing(v, ms) {
  return v.evaluate((ms) => new Promise((done) => {
    const e = document.querySelector('#stagefeed .rowtile video');
    let n = 0;
    const t0 = e.currentTime;
    const tick = () => { n++; e.requestVideoFrameCallback(tick); };
    e.requestVideoFrameCallback(tick);
    setTimeout(() => done({ frames: n, played: e.currentTime - t0, controls: e.controls }), ms);
  }), ms);
}

// Picture flashes and beeps as they reach this viewer, on one clock. The
// offset is beep minus flash, paired to the nearest flash, in ms.
async function avOffsets(v, ms) {
  return v.evaluate((ms) => new Promise((done) => {
    // Follow what the viewer is shown: the fan-out may move this phone to
    // another relayer mid-window, which brings a new element or track.
    const s0 = window.__gifosVideo.stageFeedForTest();
    if (!(s0 && s0.getAudioTracks()[0])) { done({ audio: false }); return; }
    const ac = new AudioContext();
    ac.resume();
    const an = ac.createAnalyser(); an.fftSize = 256;
    let a = null, src = null, rebinds = -1;
    const bindAudio = () => {
      const s = window.__gifosVideo.stageFeedForTest();
      const t = s && s.getAudioTracks()[0];
      if (!t || t === a) return;
      try { if (src) src.disconnect(); } catch (x) {}
      a = t; rebinds++;
      src = ac.createMediaStreamSource(new MediaStream([a])); src.connect(an);
    };
    bindAudio();
    const buf = new Float32Array(an.fftSize);
    const beeps = [], flashes = [];
    let loud = false, bright = false, peak = 0, polls = 0;
    const iv = setInterval(() => {
      if (++polls % 60 === 0) bindAudio();
      an.getFloatTimeDomainData(buf);
      let r = 0; for (const x of buf) r += x * x; r = Math.sqrt(r / buf.length);
      peak = Math.max(peak, r);
      if (!loud && r > 0.1) beeps.push(performance.now());
      loud = r > 0.05;
    }, 4);
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8;
    const g = cv.getContext('2d', { willReadFrequently: true });
    let e = null, vRebinds = -1;
    const watch = () => {
      const cur = document.querySelector('#stagefeed .rowtile video');
      if (!cur || cur === e) return;
      e = cur; vRebinds++;
      const el = cur;
      const frame = (now) => {
        if (el !== e) return;
        g.drawImage(el, 0, 0, 8, 8);
        const d = g.getImageData(0, 0, 8, 8).data;
        let l = 0; for (let i = 0; i < d.length; i += 4) l += d[i]; l /= 64;
        if (!bright && l > 160) flashes.push(now);
        bright = l > 100;
        el.requestVideoFrameCallback(frame);
      };
      el.requestVideoFrameCallback(frame);
    };
    watch();
    const wv = setInterval(watch, 250);
    setTimeout(() => {
      clearInterval(iv); clearInterval(wv); ac.close();
      const off = [];
      for (const b of beeps) {
        let best = null;
        for (const f of flashes) if (best === null || Math.abs(b - f) < Math.abs(best)) best = b - f;
        if (best !== null && Math.abs(best) < 500) off.push(Math.round(best));
      }
      off.sort((x, y) => x - y);
      done({ audio: true, rebinds, vRebinds, peak, beeps: beeps.length, flashes: flashes.length, off, median: off.length ? off[off.length >> 1] : null });
    }, ms);
  }), ms);
}

test('a rebroadcast reaches late joiners as Prerecorded, in sync, and the host upload stays flat', async ({ browser, baseURL }, info) => {
  test.setTimeout(300000);
  const opts = info.project.use;
  const vb = await viewerBrowsers(browser);
  const ctxH = await browser.newContext({ ...opts, permissions: ['camera', 'microphone'] });
  await ctxH.addInitScript(PC_TAP);
  const viewers = [];
  try {
    const h = await ctxH.newPage();
    await h.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
    await h.locator('#lob-admin-go').click();
    await expect(h.locator('#livebadge-txt')).toHaveText('LIVE', { timeout: 20000 });
    const link = await h.evaluate(() => location.hash);
    viewers.push(await joinViewer(vb.pick(0), opts, baseURL, link));
    const v1 = viewers[0].v;

    // The host finds Rebroadcast in More and picks a video file.
    await h.locator('#bartoggle').click();
    await expect(h.locator('#rbbtn')).toBeVisible();
    await h.locator('#rbbtn').click();
    await expect(h.locator('#rb-sheet')).toBeVisible();
    await h.locator('#rb-file').setInputFiles(CLIP);
    const now = h.locator('#rb-now');
    await expect(now).toBeVisible({ timeout: 10000 });
    await expect(now).toContainText('rebroadcast-clip');
    await expect(now).toContainText(/Prerecorded/);
    await expect(now).toContainText(/\/ 2:00/, { timeout: 10000 });
    await expect(h.locator('#livebadge-txt')).toHaveText('PRERECORDED');
    // The host's own picture is the clip, so its tracks are the clip's.
    await expect(h.locator('#rb-pause')).toBeVisible();
    await expect(h.locator('#rb-stop')).toBeVisible();

    // The first viewer reads Prerecorded on the picture and in the badge.
    await expect(v1.locator('#livebadge-txt')).toHaveText('PRERECORDED', { timeout: 20000 });
    await expect(v1.locator('#bc-pre')).toBeVisible();
    await expect(v1.locator('#bc-pre')).toHaveText(/Prerecorded/);
    await v1.waitForTimeout(12000);
    const up1 = await upRate(h, 10000);

    // Three more arrive mid-rebroadcast, on other machines.
    const at = await h.evaluate(() => window.__gifosVideo.rebroadcastForTest().pos);
    expect(at).toBeGreaterThan(15);
    const more = await Promise.all([1, 2, 3].map((i) => joinViewer(vb.pick(i), opts, baseURL, link)));
    viewers.push(...more);
    for (const { v } of more) {
      await expect(v.locator('#livebadge-txt')).toHaveText('PRERECORDED', { timeout: 20000 });
      await expect(v.locator('#bc-pre')).toBeVisible();
      await expect(v.locator('#bc-ended')).toBeHidden();
      const a = await advancing(v, 3000);
      info.annotations.push({ type: 'joiner', description: JSON.stringify(a) });
      expect(a.frames).toBeGreaterThan(20);
      expect(a.played).toBeGreaterThan(2);
      // No scrub, no save, nothing to seek with.
      expect(a.controls).toBe(false);
      await expect(v.locator('#rb-now, #rb-sheet, #rec-replay, #rec-replay-scrub')).toHaveCount(0);
    }
    const late = more[2].v;
    await late.screenshot({ path: info.outputPath('late-joiner.png') });
    if (process.env.SHOTS) await late.screenshot({ path: process.env.SHOTS + '/' + info.project.name + '-rebroadcast-viewer.png' });

    // Sound and picture land together on the last joiner.
    const sync = await avOffsets(late, 8000);
    info.annotations.push({ type: 'av', description: JSON.stringify(sync) });
    expect(sync.audio).toBe(true);
    expect(sync.beeps).toBeGreaterThanOrEqual(5);
    expect(sync.off.length).toBeGreaterThanOrEqual(5);
    expect(Math.abs(sync.median)).toBeLessThanOrEqual(150);

    // Four viewers cost the host about what one did: the clip rides the
    // stage fan-out, not one copy per viewer.
    const up4 = await upRate(h, 10000);
    info.annotations.push({ type: 'upload', description: JSON.stringify({ up1, up4 }) });
    expect(up1).toBeGreaterThan(5000);
    expect(up4).toBeLessThanOrEqual(up1 * 1.5);

    // Pause holds the clip; Resume carries on from there.
    await h.locator('#rb-pause').click();
    await expect(h.locator('#rb-pause')).toHaveText('Resume');
    const p0 = await h.evaluate(() => window.__gifosVideo.rebroadcastForTest().pos);
    await h.waitForTimeout(2000);
    const p1 = await h.evaluate(() => window.__gifosVideo.rebroadcastForTest().pos);
    expect(p1 - p0).toBeLessThan(0.2);
    await h.locator('#rb-pause').click();
    await expect(h.locator('#rb-pause')).toHaveText('Pause');
    await expect.poll(() => h.evaluate(() => window.__gifosVideo.rebroadcastForTest().pos), { timeout: 5000 }).toBeGreaterThan(p1 + 1);
    // Paused and resumed, it carried on from where it was, not the start.
    expect(p1).toBeGreaterThan(15);
    if (process.env.SHOTS) await h.screenshot({ path: process.env.SHOTS + '/' + info.project.name + '-rebroadcast-host.png' });

    // Stop ends it: the host is back to its own picture, viewers lose the label.
    await h.locator('#rb-stop').click();
    await expect(now).toHaveCount(0);
    await expect(h.locator('#livebadge-txt')).not.toHaveText('PRERECORDED');
    await expect(v1.locator('#livebadge-txt')).not.toHaveText('PRERECORDED', { timeout: 20000 });
    await expect(v1.locator('#bc-pre')).toBeHidden();
  } finally {
    await ctxH.close().catch(() => {});
    for (const { c } of viewers) await c.close().catch(() => {});
    await vb.close().catch(() => {});
  }
});

test('the host rebroadcasts the last service after it ends, and Stop ends it again', async ({ browser, baseURL }, info) => {
  test.setTimeout(200000);
  const opts = info.project.use;
  const vb = await viewerBrowsers(browser);
  const ctxH = await browser.newContext({ ...opts, permissions: ['camera', 'microphone'] });
  let late = null;
  try {
    const h = await ctxH.newPage();
    await h.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
    await h.locator('#lob-admin-go').click();
    await expect(h.locator('#recbtn')).toHaveText(/^Stop /, { timeout: 20000 });
    // Long enough that it is still playing when the late arrival is in.
    await h.waitForTimeout(30000);
    const link = await h.evaluate(() => location.hash);
    await h.locator('#leavebtn').click();
    await h.locator('#leave-go').click();
    await expect(h.locator('#rec-replay')).toBeVisible({ timeout: 15000 });

    // The replay sheet offers to play it into the room again.
    const rb = h.locator('#rec-replay-rebroadcast');
    await expect(rb).toBeVisible();
    const b = await rb.boundingBox();
    expect(b.height).toBeGreaterThanOrEqual(44);
    await rb.click();
    await expect(h.locator('#rec-replay')).toHaveCount(0);
    await expect(h.locator('#rb-now')).toContainText('Last service', { timeout: 10000 });
    await expect(h.locator('#rb-now')).toContainText(/ \/ 0:(2|3)\d/, { timeout: 10000 });
    await expect(h.locator('#livebadge-txt')).toHaveText('PRERECORDED');

    // Someone who missed it opens the link and sees it playing.
    late = await joinViewer(vb.pick(0), opts, baseURL, link);
    const l = late.v;
    await expect(l.locator('#livebadge-txt')).toHaveText('PRERECORDED', { timeout: 20000 });
    await expect(l.locator('#bc-pre')).toBeVisible();
    await expect(l.locator('#bc-ended')).toBeHidden();
    const a = await advancing(l, 2000);
    expect(a.frames).toBeGreaterThan(10);
    await l.screenshot({ path: info.outputPath('late.png') });
    if (process.env.SHOTS) await l.screenshot({ path: process.env.SHOTS + '/' + info.project.name + '-rebroadcast-last-viewer.png' });

    // Stop: the service reads ended again, and the host has its sheet back.
    await h.locator('#rb-stop').click();
    await expect(h.locator('#rb-now')).toHaveCount(0);
    await expect(h.locator('#rec-replay')).toBeVisible({ timeout: 10000 });
    await expect(l.locator('#bc-ended-txt')).toHaveText('The service has ended.', { timeout: 30000 });
    await expect(l.locator('#livebadge-txt')).toHaveText('OFF AIR');
  } finally {
    await ctxH.close().catch(() => {});
    if (late) await late.c.close().catch(() => {});
    await vb.close().catch(() => {});
  }
});
