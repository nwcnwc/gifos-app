import { test, expect } from '@playwright/test';

// Someone who missed the service gets it from the host. On a phone the
// replay sheet hands the video file to the share sheet, so the host can
// send it to the church group in one tap.

// The phone's share sheet. It records what it was handed.
async function phoneShare(page, { files = true } = {}) {
  await page.addInitScript((canFiles) => {
    window.__shared = [];
    navigator.canShare = (data) => !!data && (!data.files || canFiles);
    navigator.share = async (data) => {
      const f = (data.files || [])[0];
      window.__shared.push({
        title: data.title || '',
        n: (data.files || []).length,
        name: f ? f.name : '',
        type: f ? f.type : '',
        size: f ? f.size : 0,
      });
    };
  }, files);
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

async function onScreen(page, sel) {
  return page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight };
  }, sel);
}

test('the host sends the service recording from the replay', async ({ page }) => {
  await phoneShare(page);
  await page.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#lob-admin-go').waitFor({ state: 'visible' });
  const href = await clip(page);
  await page.evaluate((url) => window.__gifosVideo.showReplayForTest(url, 'sunday-service.webm'), href);
  const share = page.locator('#rec-replay-share');
  await expect(share).toBeVisible();
  await expect(share).toHaveText('Share');
  const b = await onScreen(page, '#rec-replay-share');
  expect(b.h).toBeGreaterThanOrEqual(44);
  expect(b.w).toBeGreaterThanOrEqual(44);
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.right).toBeLessThanOrEqual(b.vw + 0.5);
  expect(b.bottom).toBeLessThanOrEqual(b.vh + 0.5);
  for (const id of ['#rec-replay-save', '#rec-replay-close']) {
    const o = await onScreen(page, id);
    expect(o.h).toBeGreaterThanOrEqual(44);
    expect(o.right).toBeLessThanOrEqual(o.vw + 0.5);
  }
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await share.click();
  await page.waitForFunction(() => window.__shared.length === 1);
  const sent = await page.evaluate(() => window.__shared[0]);
  expect(sent.n).toBe(1);
  expect(sent.name).toBe('sunday-service.webm');
  expect(sent.type).toBe('video/webm');
  expect(sent.size).toBeGreaterThan(0);
  expect(downloaded).toBe(false);
  // Sending it is keeping it: Close does not download a second copy.
  await expect(page.locator('#rec-replay')).toBeVisible();
  await page.locator('#rec-replay-close').click();
  await expect(page.locator('#rec-replay')).toHaveCount(0);
  expect(downloaded).toBe(false);
});

test('a phone that cannot share a file keeps Save and Close', async ({ page }) => {
  await phoneShare(page, { files: false });
  await page.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#lob-admin-go').waitFor({ state: 'visible' });
  const href = await clip(page);
  await page.evaluate((url) => window.__gifosVideo.showReplayForTest(url, 'sunday-service.webm'), href);
  await expect(page.locator('#rec-replay')).toBeVisible();
  await expect(page.locator('#rec-replay-share')).toBeHidden();
  await expect(page.locator('#rec-replay-save')).toBeVisible();
  await expect(page.locator('#rec-replay-close')).toBeVisible();
});
