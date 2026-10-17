import { test, expect } from '@playwright/test';

// Resi and BoxCast keep every service without a tap. Go live keeps this one
// too: the host never taps Record, and Leave hands them the replay to send.

const AV = '0123456789abcdef0123456789abcdef';

// A host's phone has a camera.
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['camera', 'microphone'] });

async function phoneShare(page) {
  await page.addInitScript(() => {
    window.__shared = [];
    navigator.canShare = (data) => !!data;
    navigator.share = async (data) => {
      const f = (data.files || [])[0];
      window.__shared.push({ n: (data.files || []).length, name: f ? f.name : '', size: f ? f.size : 0 });
    };
  });
}

async function goLive(page, hash) {
  await page.goto('/run.html#' + hash, { waitUntil: 'domcontentloaded' });
  await page.locator('#lob-admin-go').waitFor({ state: 'visible' });
  await page.locator('#lob-admin-go').click();
  await page.waitForFunction(() => /on stage/.test((document.querySelector('.tile.me .chips') || document.querySelector('.chips') || {}).textContent || ''), null, { timeout: 20000 });
}

function myChips(page) {
  return page.evaluate(() => (document.querySelector('.tile.me .chips') || document.querySelector('.chips') || {}).textContent || '');
}

test('Go live keeps the service, and Leave hands the host the replay', async ({ page }) => {
  await phoneShare(page);
  await goLive(page, 'bc=1');
  // Kept without a tap, and everyone sees the recording chip.
  await page.waitForFunction(() => /recording this meeting/.test((document.querySelector('.tile.me .chips') || document.querySelector('.chips') || {}).textContent || ''), null, { timeout: 10000 });
  await expect(page.locator('#recbtn')).toHaveText(/^Stop /);
  await page.waitForTimeout(1500);
  await page.locator('#leavebtn').click();
  await page.locator('#leave-go').click();
  const replay = page.locator('#rec-replay');
  await expect(replay).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.rec-replay-title')).toHaveText('Replay');
  const share = page.locator('#rec-replay-share');
  await expect(share).toBeVisible();
  const box = await share.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 0.5);
  await share.click();
  await page.waitForFunction(() => window.__shared.length === 1);
  const sent = await page.evaluate(() => window.__shared[0]);
  expect(sent.n).toBe(1);
  expect(sent.name).toMatch(/\.(webm|mp4)$/);
  expect(sent.size).toBeGreaterThan(0);
});

test('a stream is kept the same way', async ({ page }) => {
  await goLive(page, 'bc=1&st=1');
  await page.waitForFunction(() => /recording this meeting/.test((document.querySelector('.tile.me .chips') || document.querySelector('.chips') || {}).textContent || ''), null, { timeout: 10000 });
  await expect(page.locator('#recbtn')).toHaveText(/^Stop /);
});

test('a viewer is not recorded by the page', async ({ page }) => {
  const room = 'keep' + Date.now().toString(36);
  await page.goto('/run.html#v=' + room + '&av=' + AV + '&bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await page.waitForFunction(() => /has not started/.test(document.getElementById('status').textContent || ''));
  await page.waitForTimeout(2500);
  expect(await myChips(page)).not.toMatch(/recording this meeting/);
  await expect(page.locator('#recbtn')).toHaveText('Record');
});

test('a Stop stays stopped', async ({ page }) => {
  await phoneShare(page);
  await goLive(page, 'bc=1');
  await expect(page.locator('#recbtn')).toHaveText(/^Stop /, { timeout: 10000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.getElementById('recbtn').click());
  await expect(page.locator('#rec-replay')).toBeVisible({ timeout: 15000 });
  await page.locator('#rec-replay-close').click();
  await page.waitForTimeout(3000);
  await expect(page.locator('#recbtn')).toHaveText('Record');
  expect(await myChips(page)).not.toMatch(/recording this meeting/);
});
