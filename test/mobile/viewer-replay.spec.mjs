import { test, expect } from '@playwright/test';

const AV = '0123456789abcdef0123456789abcdef';

function roomUrl(name, stream) {
  return '/run.html#v=' + name + '&av=' + AV + '&bc=1' + (stream ? '&st=1' : '');
}

async function endedViewer(page, stream) {
  const room = 'end' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await page.goto(roomUrl(room, stream), { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await page.waitForFunction(() => /has not started/.test(document.getElementById('status').textContent || ''));
  await expect(page.locator('#bc-replay')).toBeHidden();
  await page.evaluate(() => {
    window.__gifosVideo.markJoinedForTest('host-ruth');
    window.__gifosVideo.markLeftForTest('host-ruth');
  });
  await expect(page.locator('#bc-ended-txt')).toHaveText(stream ? 'The stream has ended.' : 'The service has ended.');
}

async function clip(page) {
  return page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 284;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3d6ea8';
    ctx.fillRect(0, 0, 160, 284);
    ctx.fillStyle = '#f4f7fb';
    ctx.font = '700 28px sans-serif';
    ctx.fillText('Amen', 36, 150);
    const stream = canvas.captureStream(8);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve) => { rec.onstop = resolve; });
    rec.start();
    await new Promise((r) => setTimeout(r, 280));
    rec.stop();
    await done;
    stream.getTracks().forEach((t) => t.stop());
    return URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
  });
}

test('an ended service offers the recording the viewer just watched', async ({ page }) => {
  await endedViewer(page);
  const href = await clip(page);
  const shown = await page.evaluate((url) => window.__gifosVideo.noteViewerReplayForTest(url), href);
  expect(shown).toBe(true);
  const watch = page.locator('#bc-replay');
  await expect(watch).toBeVisible();
  await expect(watch).toHaveText('Watch');
  const box = await watch.boundingBox();
  const vh = page.viewportSize().height;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y + box.height).toBeLessThanOrEqual(vh + 0.5);
  await watch.click();
  const replay = page.locator('#rec-replay');
  await expect(replay).toBeVisible();
  await expect(page.locator('.rec-replay-title')).toHaveText('Replay');
  const place = await page.evaluate(() => {
    const vid = document.getElementById('rec-replay-vid').getBoundingClientRect();
    const close = document.getElementById('rec-replay-close').getBoundingClientRect();
    return { w: vid.width, h: vid.height, y: vid.top, closeH: close.height, vh: innerHeight, vw: innerWidth };
  });
  expect(place.y).toBeLessThanOrEqual(1);
  expect(place.w).toBeGreaterThanOrEqual(place.vw - 1);
  expect(place.h).toBeGreaterThanOrEqual(place.vh - 1);
  expect(place.closeH).toBeGreaterThanOrEqual(44);
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await page.locator('#rec-replay-close').click();
  await expect(replay).toHaveCount(0);
  expect(downloaded).toBe(false);
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service has ended.');
  await expect(watch).toBeVisible();
});

test('an ended stream offers the same watch', async ({ page }) => {
  await endedViewer(page, true);
  const href = await clip(page);
  await page.evaluate((url) => window.__gifosVideo.noteViewerReplayForTest(url), href);
  await expect(page.locator('#bc-replay')).toBeVisible();
  await expect(page.locator('#bc-ended-txt')).toHaveText('The stream has ended.');
});

test('a service that has not started has nothing to watch', async ({ page }) => {
  const room = 'fresh' + Date.now().toString(36);
  await page.goto(roomUrl(room), { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await page.waitForFunction(() => /has not started/.test(document.getElementById('status').textContent || ''));
  const href = await clip(page);
  const shown = await page.evaluate((url) => window.__gifosVideo.noteViewerReplayForTest(url), href);
  expect(shown).toBe(false);
  await expect(page.locator('#bc-replay')).toBeHidden();
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service has not started.');
});

test('the viewer recording of the stage becomes the replay', async ({ page }) => {
  await endedViewer(page);
  const armed = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#245c3a';
    ctx.fillRect(0, 0, 160, 90);
    const stream = canvas.captureStream(8);
    return window.__gifosVideo.armViewerReplayForTest(stream);
  });
  expect(armed).toBe(true);
  await page.waitForTimeout(450);
  const ready = await page.evaluate(() => window.__gifosVideo.finishViewerReplayForTest());
  expect(ready).toBe(true);
  await expect(page.locator('#bc-replay')).toBeVisible();
});
