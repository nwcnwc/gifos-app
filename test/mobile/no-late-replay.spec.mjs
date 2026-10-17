import { test, expect, chromium } from '@playwright/test';

// Q76. Nobody may pull the whole service off a phone after it ends. A late
// arrival reads that it has ended, with nothing to watch and no replay bytes
// coming their way, while the host still holds its own kept copy (Q69).
//
// The late arrival runs on a second machine when BC_LATE_WS names a remote
// `npx playwright run-server`; its loopback requests come back here, so it
// loads this checkout's run.html and meets the host through the real relay.
// Without it, the late arrival is a second browser on this machine.

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['camera', 'microphone'] });

test('a late arrival reads that it ended, and nothing is pulled', async ({ browser, baseURL }, info) => {
  test.setTimeout(150000);
  const opts = info.project.use;
  const remote = process.env.BC_LATE_WS ? await chromium.connect(process.env.BC_LATE_WS, { exposeNetwork: '<loopback>' }) : null;
  const ctxH = await browser.newContext({ ...opts, permissions: ['camera', 'microphone'] });
  const ctxL = await (remote || browser).newContext({ ...opts, baseURL });
  try {
    const h = await ctxH.newPage();
    await h.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
    await h.locator('#lob-admin-go').click();
    await expect(h.locator('#recbtn')).toHaveText(/^Stop /, { timeout: 20000 });
    await h.waitForTimeout(6000);
    const link = await h.evaluate(() => location.hash);
    expect(link).toMatch(/av=[0-9a-f]+/);

    // The host ends the service and keeps its own copy.
    await h.locator('#leavebtn').click();
    await h.locator('#leave-go').click();
    await expect(h.locator('#rec-replay')).toBeVisible({ timeout: 15000 });
    const kept = await h.evaluate(async () => (await (await fetch(document.getElementById('rec-replay-vid').src)).blob()).size);
    expect(kept).toBeGreaterThan(50000);

    // Someone who missed it opens the link. Every byte their data channels
    // take in is counted.
    const l = await ctxL.newPage();
    await l.addInitScript(() => {
      const Real = window.RTCPeerConnection;
      window.__pcs = [];
      window.RTCPeerConnection = function (...a) { const pc = new Real(...a); window.__pcs.push(pc); return pc; };
      window.RTCPeerConnection.prototype = Real.prototype;
    });
    await l.goto('/run.html' + link, { waitUntil: 'domcontentloaded' });
    await l.locator('#nmok').click();
    await expect(l.locator('#bc-ended-txt')).toHaveText('The service has ended.', { timeout: 60000 });
    await expect(l.locator('#livebadge-txt')).toHaveText('OFF AIR');
    await expect(l.locator('#status')).not.toHaveText(/in the service/);
    // Long enough for an offer and a whole pull of this file to land.
    await l.waitForTimeout(12000);
    await l.screenshot({ path: info.outputPath('late.png') });
    await h.screenshot({ path: info.outputPath('host.png') });
    await expect(l.locator('#bc-replay')).toHaveCount(0);
    await expect(l.getByRole('button', { name: /^Watch/ })).toHaveCount(0);
    await expect(l.locator('#rec-replay')).toHaveCount(0);
    const took = await l.evaluate(async () => {
      let n = 0;
      for (const pc of window.__pcs) {
        const s = await pc.getStats();
        s.forEach((r) => { if (r.type === 'data-channel') n += r.bytesReceived || 0; });
      }
      return n;
    });
    info.annotations.push({ type: 'bytes', description: 'kept ' + kept + ', late arrival took ' + took });
    expect(took).toBeLessThan(kept / 2);

    // The host still holds the whole copy to share, save, or rebroadcast.
    await expect(h.locator('#rec-replay')).toBeVisible();
    const still = await h.evaluate(async () => (await (await fetch(document.getElementById('rec-replay-vid').src)).blob()).size);
    expect(still).toBe(kept);
    await expect(h.locator('#rec-replay-share, #rec-replay-save').first()).toBeVisible();
    // The sheet no longer promises it to whoever opens the link.
    await expect(h.locator('#rec-replay')).not.toContainText(/can watch it/);
  } finally {
    await ctxH.close();
    await ctxL.close();
    if (remote) await remote.close();
  }
});
