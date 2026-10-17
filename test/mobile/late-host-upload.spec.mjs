// Q78: a late arrival never adds host upload. The host goes live, then late
// joiners arrive in waves (1, then 3, then 6 in all) on other fleet machines
// (BC_VIEW_WS, remote `npx playwright run-server`s). After each wave settles:
//   - the host trades no more offers/answers with anyone (renegotiation
//     settles to 0; a polite side that never cleared renegAgain looped
//     rreq → rgo → roffer → ranswer for good, per late arrival),
//   - the host sends media on a bounded number of links (the stage fan-out's
//     first hops), not one per joiner,
//   - the host's outbound-rtp bytes/s with 6 joiners stays within two
//     copies (×1.25) of what 1 joiner costs,
//   - every joiner sees the stage picture advancing.
// Data-channel bytes per second are recorded beside it (trace.json), not
// asserted: the status heartbeat floods the sender's section, so it grows
// until the section is full (C² seats) and stays flat after (Q78).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { viewerBrowsers, PC_TAP } from './rebroadcast-lib.mjs';

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['camera', 'microphone'] });

const WAVES = [1, 2, 3]; // joiners added per wave: 1, then 3, then 6 in all
const SETTLE_MS = 20000, WINDOW_MS = 10000;
const MAX_MEDIA_LINKS = 2; // host → first hops of the stage fan-out
const MAX_NEG_IN_WINDOW = 2; // offers + answers the host takes in a settled window

const TX_BY_PC = () => window.__txByPc = async () => {
  const out = [];
  for (const pc of window.__pcs) {
    if (pc.connectionState === 'closed') continue;
    let rtp = 0, dc = 0;
    try { (await pc.getStats()).forEach((s) => { if (s.type === 'outbound-rtp') rtp += s.bytesSent || 0; if (s.type === 'data-channel') dc += s.bytesSent || 0; }); } catch (e) {}
    out.push({ rtp, dc });
  }
  return out;
};
// Forces the trigger. Which end of a link is polite comes from the two peer
// ids (iInitiate: the larger id initiates), and ids are random, so a run
// looped only when a joiner drew an id below the host's. Re-mint until the
// host's id is high and every joiner's is low: each joiner is the polite side.
const ID_ORDER = (want) => {
  const wrap = () => {
    const I = window.GifOS && window.GifOS.meshIdentity;
    if (!I || I.__ordered) return !!I;
    const mint = I.mint;
    I.mint = async () => { for (let i = 0; i < 400; i++) { const k = await mint(); if (want === 'high' ? k.peerId > 'k_d' : k.peerId < 'k_3') return k; } return mint(); };
    I.__ordered = true;
    return true;
  };
  const t = setInterval(() => { if (wrap()) clearInterval(t); }, 0);
  document.addEventListener('DOMContentLoaded', wrap);
};
const negCount = (h) => h.evaluate(() => { const k = window.__gifosVideo.rxStats().dcKinds; return (k.roffer || 0) + (k.ranswer || 0); });

test('a late arrival never adds host upload', async ({ browser, baseURL }, info) => {
  test.setTimeout(420000);
  const opts = info.project.use;
  const vb = await viewerBrowsers(browser);
  const ctxH = await browser.newContext({ ...opts, permissions: ['camera', 'microphone'] });
  await ctxH.addInitScript(PC_TAP);
  await ctxH.addInitScript(TX_BY_PC);
  await ctxH.addInitScript(ID_ORDER, 'high');
  const ctxs = [], viewers = [], trace = [], waves = [];
  const t0 = Date.now();
  try {
    const h = await ctxH.newPage();
    await h.goto('/run.html#bc=1&debug=1', { waitUntil: 'domcontentloaded' });
    await h.locator('#lob-admin-go').click();
    await expect(h.locator('#recbtn')).toHaveText(/^Stop /, { timeout: 20000 });
    await h.waitForTimeout(3000);
    const link = (await h.evaluate(() => location.hash)).replace(/&?debug=1/, '');
    // One sample a second of the host's bytes sent (media and channel).
    let sampling = true;
    const sampler = (async () => {
      while (sampling) {
        const per = await h.evaluate(() => window.__txByPc()).catch(() => null);
        if (per) trace.push({ t: (Date.now() - t0) / 1000, n: viewers.length, rtp: per.reduce((a, x) => a + x.rtp, 0), dc: per.reduce((a, x) => a + x.dc, 0) });
        await new Promise((r) => setTimeout(r, 1000));
      }
    })();
    for (const add of WAVES) {
      for (let i = 0; i < add; i++) {
        const c = await vb.pick(viewers.length).newContext({ ...opts, baseURL });
        ctxs.push(c);
        await c.addInitScript(ID_ORDER, 'low');
        const v = await c.newPage();
        await v.goto('/run.html' + link, { waitUntil: 'domcontentloaded' });
        await v.locator('#nmok').click({ timeout: 5000 }).catch(() => {});
        viewers.push(v);
      }
      // Every joiner, new and old, sees the stage picture advancing.
      for (const v of viewers) {
        await v.waitForFunction(() => { const e = document.querySelector('#stagefeed .rowtile video'); return !!e && e.currentTime > 0.5; }, null, { timeout: 60000 });
      }
      await h.waitForTimeout(SETTLE_MS);
      const n0 = await negCount(h);
      const a = await h.evaluate(() => window.__txByPc());
      const ta = Date.now();
      await h.waitForTimeout(WINDOW_MS);
      const b = await h.evaluate(() => window.__txByPc());
      const dt = (Date.now() - ta) / 1000;
      const n1 = await negCount(h);
      // Links are matched by position: __pcs only grows, closed ones drop out of both.
      const perLink = b.map((x, i) => ({ rtp: (x.rtp - ((a[i] || {}).rtp || 0)) / dt, dc: (x.dc - ((a[i] || {}).dc || 0)) / dt }));
      const mediaLinks = perLink.filter((x) => x.rtp > 1000).length;
      const rtp = Math.round(perLink.reduce((s, x) => s + x.rtp, 0));
      const dc = Math.round(perLink.reduce((s, x) => s + x.dc, 0));
      const via = [];
      for (const v of viewers) via.push(await v.evaluate(() => window.__gifosVideo.stageViaForTest()).catch(() => null));
      waves.push({ joiners: viewers.length, neg: n1 - n0, mediaLinks, rtpBps: rtp, dcBps: dc, via });
      console.log(`[${info.project.name}] ${viewers.length} joiners: host offers+answers in ${WINDOW_MS / 1000}s ${n1 - n0}, media links ${mediaLinks}, rtp ${(rtp / 1000).toFixed(1)} KB/s, dc ${(dc / 1000).toFixed(1)} KB/s`);
    }
    sampling = false; await sampler;
    const hostId = String(await h.evaluate(() => window.__gifosVideo.stageIds()[0])).slice(0, 8);
    fs.writeFileSync(info.outputPath('trace.json'), JSON.stringify({ hostId, waves, trace }, null, 1));
    await h.screenshot({ path: info.outputPath('host.png') });
    await viewers[viewers.length - 1].screenshot({ path: info.outputPath('last-joiner.png') });
    for (const w of waves) {
      for (const x of w.via) expect(x && x.me < hostId, `joiner ${x && x.me} is the polite side of host ${hostId}`).toBe(true);
      expect(w.neg, `host still renegotiating with ${w.joiners} joiners`).toBeLessThanOrEqual(MAX_NEG_IN_WINDOW);
      expect(w.mediaLinks, `host sends media on ${w.mediaLinks} links with ${w.joiners} joiners`).toBeLessThanOrEqual(MAX_MEDIA_LINKS);
    }
    // The host's own stage feed goes to at most two seats live (STG-DIRECT);
    // everyone else is fed down the tree. So 6 joiners cost at most two
    // copies of what 1 joiner costs, and 600 would cost the same.
    expect(waves[2].rtpBps, `host media ${waves[0].rtpBps} B/s with 1 joiner, ${waves[2].rtpBps} with 6`).toBeLessThanOrEqual(waves[0].rtpBps * MAX_MEDIA_LINKS * 1.25);
  } finally {
    await ctxH.close();
    for (const c of ctxs) await c.close().catch(() => {});
    await vb.close();
  }
});
