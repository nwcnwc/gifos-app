import { test, expect } from '@playwright/test';

const AV = '0123456789abcdef0123456789abcdef';

function roomUrl(name, stream) {
  return '/run.html#v=' + name + '&av=' + AV + '&bc=1' + (stream ? '&st=1' : '');
}

async function measureStage(page) {
  return page.evaluate(() => {
    window.__gifosVideo.markJoinedForTest('speaker-ann');
    const feed = document.getElementById('stagefeed');
    const el = document.createElement('div');
    el.className = 'rowtile';
    el.dataset.row = 'sgs';
    el.style.aspectRatio = '1.7778';
    const v = document.createElement('video');
    const lb = document.createElement('div');
    lb.className = 'rlabel';
    lb.textContent = 'On stage';
    el.append(v, lb);
    feed.appendChild(el);
    const r = el.getBoundingClientRect();
    const label = lb.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const vs = getComputedStyle(v);
    const quiet = document.getElementById('bc-ended');
    return {
      w: r.width, h: r.height, x: r.x, y: r.y,
      radius: cs.borderRadius, fit: vs.objectFit,
      short: Math.min(r.width, r.height),
      labelBottom: label.bottom,
      vw: innerWidth, vh: innerHeight,
      quiet: quiet.hidden || getComputedStyle(quiet).display === 'none',
    };
  });
}

test('a speaker fills the broadcast stage', async ({ page }) => {
  const room = 'pgm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await page.goto(roomUrl(room), { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await page.waitForFunction(() => /has not started/.test(document.getElementById('status').textContent || ''));
  const box = await measureStage(page);
  expect(box.w).toBeGreaterThanOrEqual(box.vw - 1);
  expect(box.h).toBeGreaterThanOrEqual(box.vh - 1);
  expect(box.short).toBeGreaterThanOrEqual(120);
  expect(box.x).toBeLessThanOrEqual(1);
  expect(box.y).toBeLessThanOrEqual(1);
  expect(parseFloat(box.radius)).toBe(0);
  expect(box.fit).toBe('contain');
  expect(box.quiet).toBe(true);
  expect(box.labelBottom).toBeLessThanOrEqual(box.vh - 64);
  const cam = await page.locator('#cam').evaluate((el) => getComputedStyle(el).display);
  expect(cam).toBe('none');
});

test('a broadcast host program fills the phone', async ({ page }) => {
  const room = 'hostpgm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await page.addInitScript((arg) => {
    localStorage.setItem('gifos_vadm_' + arg.room + '.' + arg.av, 'stored-host-key');
  }, { room, av: AV });
  await page.goto(roomUrl(room), { waitUntil: 'domcontentloaded' });
  await page.locator('#hdrinvite').waitFor({ state: 'visible' });
  const box = await measureStage(page);
  expect(box.w).toBeGreaterThanOrEqual(box.vw - 1);
  expect(box.h).toBeGreaterThanOrEqual(box.vh - 1);
  expect(box.short).toBeGreaterThanOrEqual(120);
  expect(box.fit).toBe('contain');
  expect(parseFloat(box.radius)).toBe(0);
  await expect(page.locator('#bc-ended')).toBeHidden();
});

test('an empty broadcast stage still says the service has not started', async ({ page }) => {
  const room = 'empty' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await page.goto(roomUrl(room), { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service has not started.');
  const feed = await page.locator('#stagefeed').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, display: getComputedStyle(el).display };
  });
  expect(feed.display).toBe('none');
  expect(feed.h).toBe(0);
});
