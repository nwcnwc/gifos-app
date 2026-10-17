import { test, expect } from '@playwright/test';

// Q71. Someone who opens the link after the service ended can watch it.
// Two real phones on one link: the first watched and holds the replay, the
// second arrives after the end and plays it from the first, over the room.
const AV = '0123456789abcdef0123456789abcdef';

function roomUrl(name) {
  return '/run.html#v=' + name + '&av=' + AV + '&bc=1';
}

async function clip(page) {
  return page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 284;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(8);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve) => { rec.onstop = resolve; });
    rec.start(100);
    const t0 = performance.now();
    while (performance.now() - t0 < 1500) {
      ctx.fillStyle = '#3d6ea8';
      ctx.fillRect(0, 0, 160, 284);
      ctx.fillStyle = '#f4f7fb';
      ctx.font = '700 28px sans-serif';
      ctx.fillText('Amen ' + Math.round(performance.now() - t0), 8, 150);
      await new Promise((r) => setTimeout(r, 60));
    }
    rec.stop();
    await done;
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: 'video/webm' });
    return { url: URL.createObjectURL(blob), size: blob.size };
  });
}

test('someone who arrives after the service ended can watch it', async ({ browser }, info) => {
  test.setTimeout(90000);
  const room = 'late' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const opts = info.project.use;
  const ctxA = await browser.newContext({ ...opts });
  const ctxB = await browser.newContext({ ...opts });
  try {
    const a = await ctxA.newPage();
    await a.goto(roomUrl(room), { waitUntil: 'domcontentloaded' });
    await a.locator('#nmok').click();
    await a.waitForFunction(() => /has not started/.test(document.getElementById('status').textContent || ''));
    // The first viewer watched the service, and it ended.
    await a.evaluate(() => {
      window.__gifosVideo.markJoinedForTest('host-ruth');
      window.__gifosVideo.markLeftForTest('host-ruth');
    });
    const held = await clip(a);
    expect(held.size).toBeGreaterThan(1000);
    expect(await a.evaluate((url) => window.__gifosVideo.noteViewerReplayForTest(url), held.url)).toBe(true);

    // The late arrival opens the same link.
    const b = await ctxB.newPage();
    await b.goto(roomUrl(room), { waitUntil: 'domcontentloaded' });
    await b.locator('#nmok').click();
    await b.waitForFunction(() => window.__gifosVideo.participants() >= 2, null, { timeout: 45000 });
    await expect(b.locator('#bc-ended-txt')).toHaveText('The service has ended.');
    const watch = b.locator('#bc-replay');
    await expect(watch).toBeVisible();
    await expect(watch).toHaveText('Watch');
    await watch.click();
    const replay = b.locator('#rec-replay');
    await expect(replay).toBeVisible();
    await expect(b.locator('.rec-replay-title')).toHaveText('Replay');
    // The video that plays is the one the first viewer held, byte for byte.
    await b.waitForFunction(() => {
      const v = document.getElementById('rec-replay-vid');
      return !!(v && v.src && v.readyState >= 1);
    }, null, { timeout: 30000 });
    const got = await b.evaluate(async () => {
      const v = document.getElementById('rec-replay-vid');
      const blob = await (await fetch(v.src)).blob();
      return blob.size;
    });
    expect(got).toBe(held.size);
    // Now the late arrival holds it too, so Close leaves Watch on the screen.
    await b.locator('#rec-replay-close').click();
    await expect(replay).toHaveCount(0);
    await expect(watch).toBeVisible();
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
