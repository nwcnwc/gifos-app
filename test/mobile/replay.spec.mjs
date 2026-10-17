import { test, expect } from '@playwright/test';

async function openDesk(page) {
  await page.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#lob-admin-go').waitFor({ state: 'visible' });
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
    ctx.fillText('Live', 36, 150);
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
    const blob = new Blob(chunks, { type: 'video/webm' });
    return URL.createObjectURL(blob);
  });
}

test('a phone plays the recording back', async ({ page }) => {
  await openDesk(page);
  const href = await clip(page);
  const how = await page.evaluate((url) => window.__gifosVideo.showReplayForTest(url, 'sunday-service.webm'), href);
  expect(how).toBe('replay');
  const replay = page.locator('#rec-replay');
  await expect(replay).toBeVisible();
  await expect(page.locator('.rec-replay-title')).toHaveText('Replay');
  const box = await page.evaluate(() => {
    const vid = document.getElementById('rec-replay-vid').getBoundingClientRect();
    const save = document.getElementById('rec-replay-save').getBoundingClientRect();
    const close = document.getElementById('rec-replay-close').getBoundingClientRect();
    const scrub = document.getElementById('rec-replay-scrub').getBoundingClientRect();
    return {
      vidW: vid.width, vidH: vid.height, vidTop: vid.top,
      saveH: save.height, closeH: close.height, scrubH: scrub.height,
      saveBottom: save.bottom, closeBottom: close.bottom, scrubTop: scrub.top,
      vh: innerHeight, vw: innerWidth,
    };
  });
  expect(box.vidTop).toBeLessThanOrEqual(1);
  expect(box.vidW).toBeGreaterThanOrEqual(box.vw - 1);
  expect(box.vidH).toBeGreaterThanOrEqual(box.vh - 1);
  expect(box.saveH).toBeGreaterThanOrEqual(44);
  expect(box.closeH).toBeGreaterThanOrEqual(44);
  expect(box.scrubH).toBeGreaterThanOrEqual(44);
  expect(box.saveBottom).toBeLessThanOrEqual(box.vh + 0.5);
  expect(box.closeBottom).toBeLessThanOrEqual(box.vh + 0.5);
  expect(box.scrubTop).toBeLessThan(box.saveBottom);
  await page.locator('#rec-replay-vid').evaluate((v) => new Promise((resolve) => {
    if (v.readyState >= 1) resolve();
    else v.addEventListener('loadedmetadata', () => resolve(), { once: true });
  }));
  const dur = await page.locator('#rec-replay-vid').evaluate((v) => v.duration);
  if (dur && Number.isFinite(dur) && dur > 0.05) {
    await page.locator('#rec-replay-scrub').evaluate((el) => {
      el.value = '800';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const t = await page.locator('#rec-replay-vid').evaluate((v) => v.currentTime);
    expect(t).toBeGreaterThan(0);
  }
  const download = page.waitForEvent('download');
  await page.locator('#rec-replay-save').click();
  expect((await download).suggestedFilename()).toBe('sunday-service.webm');
  await expect(replay).toBeVisible();
  await page.locator('#rec-replay-close').click();
  await expect(replay).toHaveCount(0);
});

test('closing the replay still keeps the file', async ({ page }) => {
  await openDesk(page);
  const href = await clip(page);
  await page.evaluate((url) => window.__gifosVideo.showReplayForTest(url, 'friday-night.webm'), href);
  await expect(page.locator('#rec-replay')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.locator('#rec-replay-close').click();
  expect((await download).suggestedFilename()).toBe('friday-night.webm');
  await expect(page.locator('#rec-replay')).toHaveCount(0);
});

test('a recording already saved just plays', async ({ page }) => {
  await openDesk(page);
  const href = await clip(page);
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  const how = await page.evaluate((url) => window.__gifosVideo.showReplayForTest(url, 'already.webm', true), href);
  expect(how).toBe('saved');
  await expect(page.locator('#rec-replay')).toBeVisible();
  await expect(page.locator('#rec-replay-save')).toBeHidden();
  await page.locator('#rec-replay-close').click();
  await expect(page.locator('#rec-replay')).toHaveCount(0);
  expect(downloaded).toBe(false);
});

test('a wide screen still downloads the recording', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#lobby.show').waitFor();
  const href = await clip(page);
  const download = page.waitForEvent('download');
  const how = await page.evaluate((url) => window.__gifosVideo.showReplayForTest(url, 'desk.webm'), href);
  expect(how).toBe('download');
  expect((await download).suggestedFilename()).toBe('desk.webm');
  await expect(page.locator('#rec-replay')).toHaveCount(0);
});
