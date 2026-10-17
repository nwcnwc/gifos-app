// Q80: a late arrival waits for its relay; it never pulls the host's spare
// copy. The host goes live; joiner A arrives (on one fleet machine) and is
// the host's direct seat (STG-DIRECT). Joiner B arrives (on another): the host
// announces B its own copy as a parked spare (sb:1), and B should watch a
// one-hop relay from A. Whose copy reaches B first is a race between two links
// coming up. Forced here: A starts no new relay until B already hears the
// host's spare, and then 2 s more (holdRelayForTest, a slow relay phone).
// Asserts that the host sends B (almost) nothing for the 30 s after B joins,
// that B ends up on A's relay, and that B's picture advances. Before the fix
// B took the host's spare as its picture the moment it arrived and the host
// fed it a full copy for ~30 s on every such arrival (seen 1 wave in 3 in
// late-host-upload: "media links 2" with 3 joiners in one row).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { viewerBrowsers, PC_TAP } from './rebroadcast-lib.mjs';

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['camera', 'microphone'] });

const RELAY_LAG_MS = 2000; // the relay arrives this long after the host's spare
const WATCH_MS = 30000; // host → B bytes counted over this long after B joins
const MAX_SPARE_BYTES = 15000; // one copy is ~7 KB/s: this is ~2 s of it, the moment before B parks the spare

const PC_BYTES = () => window.__pcBytes = async () => {
  const out = [];
  for (const pc of window.__pcs) { let b = 0; if (pc.connectionState !== 'closed') { try { (await pc.getStats()).forEach((s) => { if (s.type === 'outbound-rtp') b += s.bytesSent || 0; }); } catch (e) {} } out.push(b); }
  return out;
};
const stgVia = (pg) => pg.evaluate(() => window.__gifosVideo.stageViaForTest()).catch(() => null);
const sees = (pg, ms) => pg.waitForFunction(() => { const e = document.querySelector('#stagefeed .rowtile video'); return !!e && e.currentTime > 0.5; }, null, { timeout: ms }).then(() => true, () => false);

test('a late arrival waits for its relay, not the host\'s spare copy', async ({ browser, baseURL }, info) => {
  test.setTimeout(240000);
  const opts = info.project.use;
  const vb = await viewerBrowsers(browser);
  const ctxH = await browser.newContext({ ...opts, permissions: ['camera', 'microphone'] });
  await ctxH.addInitScript(PC_TAP);
  await ctxH.addInitScript(PC_BYTES);
  const ctxs = [], log = [];
  const t0 = Date.now();
  const note = (x) => log.push({ t: Math.round((Date.now() - t0) / 100) / 10, ...x });
  try {
    const h = await ctxH.newPage();
    await h.goto('/run.html#bc=1&debug=1', { waitUntil: 'domcontentloaded' });
    await h.locator('#lob-admin-go').click();
    await expect(h.locator('#recbtn')).toHaveText(/^Stop /, { timeout: 20000 });
    await h.waitForTimeout(3000);
    const link = (await h.evaluate(() => location.hash)).replace(/&?debug=1/, '');
    const hostId = await h.evaluate(() => window.__gifosVideo.stageIds()[0]);
    const join = async (i, debug) => {
      const c = await vb.pick(i).newContext({ ...opts, baseURL });
      ctxs.push(c);
      const v = await c.newPage();
      await v.goto('/run.html' + link + (debug ? '&debug=1' : ''), { waitUntil: 'domcontentloaded' });
      await v.locator('#nmok').click({ timeout: 5000 }).catch(() => {});
      return v;
    };
    // A: the host's direct seat. debug=1: its relay is slowed from its page.
    const a = await join(0, true);
    expect(await sees(a, 60000), 'A sees the stage').toBe(true);
    await expect.poll(() => stgVia(a).then((x) => x && x.via), { timeout: 30000 }).toBe(hostId.slice(0, 8));
    const aId = await a.evaluate(() => window.__gifosVideo.statusPlane().id);
    await a.evaluate(() => window.__gifosVideo.holdRelayForTest(120000));
    // B arrives. Count the host's bytes on every link from here.
    const b0 = await h.evaluate(() => window.__pcBytes());
    const tB = Date.now();
    const b = await join(1, false);
    const bId = await b.evaluate(() => window.__gifosVideo.statusPlane().id);
    // B hears the host's spare (announced, its stream on B's link): A's
    // relay comes RELAY_LAG_MS later.
    const host8 = hostId.slice(0, 8);
    await b.waitForFunction((h8) => window.__gifosVideo.mosaic().cands.some((c) => c.from === h8 && c.key.indexOf('stg:') === 0 && c.live), host8, { timeout: 60000 });
    note({ phase: 'B hears the host spare', bClaims: await b.evaluate(() => window.__gifosVideo.mosaic().claimVia).catch(() => null) });
    await b.waitForTimeout(RELAY_LAG_MS);
    note({ phase: 'relay released', bClaims: await b.evaluate(() => window.__gifosVideo.mosaic().claimVia).catch(() => null) });
    await a.evaluate(() => window.__gifosVideo.holdRelayForTest(0));
    // Find B's link on the host; sample it each second until WATCH_MS.
    let bPc = -1;
    for (let i = 0; i < 30 && bPc < 0; i++) { const e = (await h.evaluate(() => window.__gifosVideo.sendersByPeer()))[bId.slice(0, 8)]; if (e) bPc = e.pc; else await h.waitForTimeout(1000); }
    expect(bPc, 'the host has a link to the late arrival').toBeGreaterThanOrEqual(0);
    while (Date.now() - tB < WATCH_MS) {
      const now = await h.evaluate(() => window.__pcBytes());
      note({ toB: (now[bPc] || 0) - (b0[bPc] || 0), via: await stgVia(b) });
      await h.waitForTimeout(1000);
    }
    const end = await h.evaluate(() => window.__pcBytes());
    const toB = (end[bPc] || 0) - (b0[bPc] || 0);
    const via = await stgVia(b);
    const seen = await sees(b, 30000);
    const bState = await b.evaluate(() => { const m = window.__gifosVideo.mosaic(); return { claimVia: m.claimVia, standbyVia: m.standbyVia, fb: m.fb, demand: m.demand, cands: m.cands }; }).catch((e) => String(e));
    fs.writeFileSync(info.outputPath('trace.json'), JSON.stringify({ hostId, aId, bId, bPc, toB, via, log, bState }, null, 1));
    await h.screenshot({ path: info.outputPath('host.png') });
    await b.screenshot({ path: info.outputPath('late-joiner.png') });
    console.log(`[${info.project.name}] host sent the late arrival ${toB} B in ${WATCH_MS / 1000}s; it watches ${via && via.via} (host ${host8}, relay ${aId.slice(0, 8)}); picture ${seen}`);
    expect(toB, `host fed the late arrival ${toB} B of its own copy in ${WATCH_MS / 1000}s`).toBeLessThanOrEqual(MAX_SPARE_BYTES);
    expect(via && via.via, 'the late arrival watches the relay').toBe(aId.slice(0, 8));
    expect(seen, 'the late arrival\'s picture advances').toBe(true);
  } finally {
    await ctxH.close();
    for (const c of ctxs) await c.close().catch(() => {});
    await vb.close();
  }
});

// The wait is not a wall: when no relay ever comes (A holds its relay for the
// whole test), the late arrival's picture still runs and keeps running past
// the wait (the host's spare is claimable once it is over).
test('with no relay, a late arrival still gets the host\'s spare copy', async ({ browser, baseURL }, info) => {
  test.setTimeout(240000);
  const opts = info.project.use;
  const vb = await viewerBrowsers(browser);
  const ctxH = await browser.newContext({ ...opts, permissions: ['camera', 'microphone'] });
  const ctxs = [];
  try {
    const h = await ctxH.newPage();
    await h.goto('/run.html#bc=1&debug=1', { waitUntil: 'domcontentloaded' });
    await h.locator('#lob-admin-go').click();
    await expect(h.locator('#recbtn')).toHaveText(/^Stop /, { timeout: 20000 });
    await h.waitForTimeout(3000);
    const link = (await h.evaluate(() => location.hash)).replace(/&?debug=1/, '');
    const hostId = await h.evaluate(() => window.__gifosVideo.stageIds()[0]);
    const join = async (i, debug) => {
      const c = await vb.pick(i).newContext({ ...opts, baseURL });
      ctxs.push(c);
      const v = await c.newPage();
      await v.goto('/run.html' + link + (debug ? '&debug=1' : ''), { waitUntil: 'domcontentloaded' });
      await v.locator('#nmok').click({ timeout: 5000 }).catch(() => {});
      return v;
    };
    const a = await join(0, true);
    expect(await sees(a, 60000), 'A sees the stage').toBe(true);
    await expect.poll(() => stgVia(a).then((x) => x && x.via), { timeout: 30000 }).toBe(hostId.slice(0, 8));
    await a.evaluate(() => window.__gifosVideo.holdRelayForTest(600000));
    const b = await join(1, false);
    const host8 = hostId.slice(0, 8);
    await b.waitForFunction((h8) => window.__gifosVideo.mosaic().cands.some((c) => c.from === h8 && c.key.indexOf('stg:') === 0 && c.live), host8, { timeout: 60000 });
    const t = Date.now();
    const seen = await sees(b, 25000);
    console.log(`[${info.project.name}] no relay: late arrival's picture ${seen} after ${((Date.now() - t) / 1000).toFixed(1)}s, via ${(await stgVia(b) || {}).via} (host ${host8})`);
    // Past the wait, still running: no seat is left dark by waiting.
    await b.waitForTimeout(10000);
    const t1 = await b.evaluate(() => document.querySelector('#stagefeed .rowtile video').currentTime);
    await b.waitForTimeout(3000);
    const t2 = await b.evaluate(() => document.querySelector('#stagefeed .rowtile video').currentTime);
    const claims = await b.evaluate(() => window.__gifosVideo.mosaic().claimVia.map((c) => c.rk.slice(0, 12) + '<' + String(c.via).slice(0, 8))).catch(() => null);
    console.log(`[${info.project.name}] no relay, 13 s on: picture ${t1.toFixed(1)} → ${t2.toFixed(1)} s, claims ${JSON.stringify(claims)}`);
    await b.screenshot({ path: info.outputPath('no-relay-joiner.png') });
    expect(seen, 'the late arrival\'s picture runs').toBe(true);
    expect(t2 - t1, 'and keeps running past the wait').toBeGreaterThan(1.5);
  } finally {
    await ctxH.close();
    for (const c of ctxs) await c.close().catch(() => {});
    await vb.close();
  }
});
