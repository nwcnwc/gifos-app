import { test, expect } from '@playwright/test';

const AV = '0123456789abcdef0123456789abcdef';
const VIEW = '/run.html#v=sundayservice&av=' + AV + '&bc=1';
const SECRET = 'viewer-secret-99';

async function openHost(page) {
  await page.addInitScript((av) => {
    localStorage.setItem('gifos_vadm_sundayservice.' + av, 'stored-host-key');
    localStorage.setItem('gifos_vpw_sundayservice.' + av, 'viewer-secret-99');
  }, AV);
  await page.goto(VIEW, { waitUntil: 'domcontentloaded' });
  await page.locator('#hdrinvite').waitFor({ state: 'visible' });
}

test('a broadcast host alone gets a blue Invite that shares the viewer link', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await openHost(page);
  const btn = page.locator('#hdrinvite');
  await expect(btn).toHaveText('Invite');
  const place = await page.evaluate(() => {
    const el = document.getElementById('hdrinvite');
    const chip = document.querySelector('.topchip');
    const b = el.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    const fit = document.getElementById('fitbtn').getBoundingClientRect();
    return {
      h: b.height,
      w: b.width,
      bg: getComputedStyle(el).backgroundColor,
      status: document.getElementById('status').textContent,
      invite: chip.dataset.invite || '',
      kind: document.getElementById('status').dataset.kind || '',
      inChip: b.left >= c.left - 1 && b.right <= c.right + 1 && b.top >= c.top - 1 && b.bottom <= c.bottom + 1,
      coversFit: b.right > fit.left + 1 && b.left < fit.right - 1 && b.bottom > fit.top + 1 && b.top < fit.bottom - 1,
      bottom: b.bottom,
      vh: innerHeight,
    };
  });
  expect(place.h).toBeGreaterThanOrEqual(44);
  expect(place.w).toBeGreaterThanOrEqual(44);
  expect(place.bg).toBe('rgb(0, 100, 200)');
  expect(place.status).not.toContain('send the invite');
  expect(place.status).toContain('sundayservice');
  expect(place.invite).toBe('1');
  expect(place.kind).toBe('alone');
  expect(place.inChip).toBe(true);
  expect(place.coversFit).toBe(false);
  expect(place.bottom).toBeLessThanOrEqual(place.vh + 0.5);

  const shared = await page.evaluate(async (secret) => {
    const input = document.getElementById('share-url');
    input.value = input.value + '&pw=' + secret;
    let payload = null;
    navigator.share = (p) => { payload = p; return Promise.resolve(); };
    document.getElementById('hdrinvite').click();
    navigator.share = undefined;
    document.getElementById('hdrinvite').click();
    let clip = '';
    try { clip = await navigator.clipboard.readText(); } catch (e) { clip = ''; }
    return { payload, label: document.getElementById('hdrinvite').textContent, clip };
  }, SECRET);
  expect(shared.payload.url).toContain('sundayservice');
  expect(shared.payload.url).toContain('bc=1');
  expect(shared.payload.url).not.toContain(SECRET);
  expect(shared.payload.url).not.toContain('pw=');
  expect(shared.payload.text).not.toContain(SECRET);
  expect(shared.payload.text).not.toMatch(/password/i);
  expect(shared.label).toBe('Copied');
  expect(shared.clip).toContain('sundayservice');
  expect(shared.clip).toContain('bc=1');
  expect(shared.clip).not.toContain(SECRET);
  expect(shared.clip).not.toContain('pw=');

  const n = await page.evaluate(() => window.__gifosVideo.markJoinedForTest('peer-ruth'));
  expect(n).toBeGreaterThan(1);
  await expect(btn).toBeHidden();
  const after = await page.evaluate(() => document.querySelector('.topchip').dataset.invite || '');
  expect(after).toBe('');
});

test('a broadcast viewer does not get Invite', async ({ page }) => {
  await page.goto(VIEW, { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await page.locator('#livebadge').waitFor({ state: 'visible' });
  await expect(page.locator('#hdrinvite')).toBeHidden();
  const flag = await page.evaluate(() => document.querySelector('.topchip').dataset.invite || '');
  expect(flag).toBe('');
});

test('a wide screen keeps Invite for the desktop agent', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript((av) => {
    localStorage.setItem('gifos_vadm_sundayservice.' + av, 'stored-host-key');
  }, AV);
  await page.goto(VIEW, { waitUntil: 'domcontentloaded' });
  await page.locator('#livebadge').waitFor({ state: 'visible' });
  await expect(page.locator('#status')).toContainText('send the invite');
  await expect(page.locator('#hdrinvite')).toBeHidden();
  const flag = await page.evaluate(() => document.querySelector('.topchip').dataset.invite || '');
  expect(flag).toBe('1');
  const status = await page.locator('#status').innerText();
  expect(status).toContain('send the invite');
});
