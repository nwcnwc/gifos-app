import { test, expect } from '@playwright/test';

const AV = '0123456789abcdef0123456789abcdef';

function roomUrl(name, stream) {
  return '/run.html#v=' + name + '&av=' + AV + '&bc=1' + (stream ? '&st=1' : '');
}

async function settleViewer(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await page.waitForFunction(() => {
    const t = document.getElementById('status').textContent || '';
    return /has not started/.test(t);
  });
}

test('a church viewer sees that the service has not started', async ({ page }) => {
  await settleViewer(page, roomUrl('svc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)));
  const screen = page.locator('#bc-ended');
  await expect(screen).toBeVisible();
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service has not started.');
  await expect(page.locator('#status')).toContainText('The service has not started.');
  await expect(page.locator('#status')).not.toContainText('send the invite');
  await expect(page.locator('#livebadge-txt')).toHaveText('OFF AIR');
  await expect(page.locator('#hdrinvite')).toBeHidden();
  const place = await page.evaluate(() => {
    const el = document.getElementById('bc-ended-txt').getBoundingClientRect();
    const chip = document.querySelector('.topchip').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const fit = document.getElementById('fitbtn');
    return {
      top: el.top,
      bottom: el.bottom,
      chipBottom: chip.bottom,
      barTop: bar.top,
      vh: innerHeight,
      fitHidden: fit.getClientRects().length === 0,
      font: parseFloat(getComputedStyle(document.getElementById('bc-ended-txt')).fontSize),
    };
  });
  expect(place.top).toBeGreaterThanOrEqual(place.chipBottom - 1);
  expect(place.bottom).toBeLessThanOrEqual(place.barTop + 1);
  expect(place.bottom).toBeLessThanOrEqual(place.vh + 0.5);
  expect(place.fitHidden).toBe(true);
  expect(place.font).toBeGreaterThanOrEqual(24);

  const n = await page.evaluate(() => window.__gifosVideo.markJoinedForTest('host-ruth'));
  expect(n).toBeGreaterThan(1);
  await expect(screen).toBeHidden();
  await expect(page.locator('#status')).toContainText('in the service');
  const left = await page.evaluate(() => window.__gifosVideo.markLeftForTest('host-ruth'));
  expect(left).toBe(1);
  await expect(screen).toBeVisible();
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service has ended.');
  await expect(page.locator('#status')).toContainText('The service has ended.');
  await expect(page.locator('#status')).not.toContainText('send the invite');
});

test('a stream viewer sees that the stream has not started', async ({ page }) => {
  await settleViewer(page, roomUrl('stm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), true));
  await expect(page.locator('#bc-ended-txt')).toHaveText('The stream has not started.');
  await expect(page.locator('#status')).toContainText('The stream has not started.');
  await expect(page.locator('#status')).not.toContainText('send the invite');
});

test('a broadcast host still gets Invite, not the ended screen', async ({ page }) => {
  const room = 'host' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await page.addInitScript((arg) => {
    localStorage.setItem('gifos_vadm_' + arg.room + '.' + arg.av, 'stored-host-key');
  }, { room: room, av: AV });
  await page.goto(roomUrl(room), { waitUntil: 'domcontentloaded' });
  await page.locator('#hdrinvite').waitFor({ state: 'visible' });
  await expect(page.locator('#bc-ended')).toBeHidden();
  await expect(page.locator('#status')).not.toContainText('has not started');
  await expect(page.locator('#status')).not.toContainText('has ended');
});

test('a meeting still asks the host to send the invite', async ({ page }) => {
  await page.goto('/run.html#v=meet' + Date.now().toString(36) + 'd', { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await page.waitForFunction(() => /send the invite/.test(document.getElementById('status').textContent || ''));
  await expect(page.locator('#bc-ended')).toBeHidden();
  await expect(page.locator('#status')).toContainText('send the invite');
});
