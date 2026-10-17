import { createHash } from 'crypto';
import { test, expect } from '@playwright/test';

const FACE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC', 'base64');
const FACE = {
  hash: createHash('sha256').update(FACE_PNG).digest('hex'),
  b64: FACE_PNG.toString('base64'),
};

async function prefillJoin(page) {
  await page.addInitScript((face) => {
    localStorage.setItem('gifos_name', 'Ada Lovelace');
    localStorage.setItem('gifos_avatar', JSON.stringify({ mime: 'image/png', hash: face.hash, b64: face.b64 }));
  }, FACE);
}

function rgb(color) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color || '');
  if (!m) return color;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function farEnough(a, b) {
  const da = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  return da >= 80;
}

async function pair(page, secondary, primary) {
  return page.evaluate(([sec, pri]) => {
    const a = document.querySelector(sec).getBoundingClientRect();
    const b = document.querySelector(pri).getBoundingClientRect();
    const sa = getComputedStyle(document.querySelector(sec));
    const sb = getComputedStyle(document.querySelector(pri));
    const gap = Math.round((b.left - a.right) * 10) / 10;
    return {
      gap,
      secondaryH: a.height,
      primaryH: b.height,
      secondaryW: a.width,
      primaryW: b.width,
      secondaryBg: sa.backgroundColor,
      primaryBg: sb.backgroundColor,
    };
  }, [secondary, primary]);
}

test('Save is the only filled join action', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gifos_name', 'Ada Lovelace'));
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').waitFor({ state: 'visible' });
  await expect(page.locator('#nmcancel')).toHaveText('Clear');
  await expect(page.locator('#nmok')).toHaveText('Save');
  const g = await pair(page, '#nmcancel', '#nmok');
  expect(g.gap).toBeGreaterThanOrEqual(8);
  expect(g.gap).toBeLessThanOrEqual(16);
  expect(g.secondaryH).toBeGreaterThanOrEqual(44);
  expect(g.primaryH).toBeGreaterThanOrEqual(44);
  expect(g.secondaryW).toBeGreaterThanOrEqual(44);
  expect(g.primaryW).toBeGreaterThanOrEqual(44);
  expect(farEnough(rgb(g.secondaryBg), rgb(g.primaryBg))).toBe(true);
});

test('Clear blanks the name and the avatar, and Save joins with that blank', async ({ page }) => {
  await prefillJoin(page);
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#nm').waitFor({ state: 'visible' });
  await expect(page.locator('#nm')).toHaveValue('Ada Lovelace');
  await expect(page.locator('#nm-avatar')).toBeVisible();
  await page.locator('#nmcancel').click();
  await expect(page.locator('#nm')).toHaveValue('');
  await expect(page.locator('#nm-avatar')).toBeHidden();
  await expect(page.locator('#nm-preview-name')).toHaveText('');
  await expect(page.locator('#nmok')).toBeVisible();
  const mid = await page.evaluate(() => ({
    name: localStorage.getItem('gifos_name'),
    avatar: localStorage.getItem('gifos_avatar'),
  }));
  expect(mid.name).toBe('Ada Lovelace');
  expect(mid.avatar).toBeTruthy();
  await page.locator('#nmok').click();
  await expect(page.locator('#nmok')).toBeHidden();
  const after = await page.evaluate(() => ({
    name: localStorage.getItem('gifos_name'),
    avatar: localStorage.getItem('gifos_avatar'),
  }));
  expect(after.name).toBeNull();
  expect(after.avatar).toBeNull();
});

test('Save keeps the shown name and avatar', async ({ page }) => {
  await prefillJoin(page);
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').waitFor({ state: 'visible' });
  await expect(page.locator('#nm')).toHaveValue('Ada Lovelace');
  await page.locator('#nmok').click();
  await expect(page.locator('#nmok')).toBeHidden();
  const after = await page.evaluate(() => ({
    name: localStorage.getItem('gifos_name'),
    avatar: localStorage.getItem('gifos_avatar'),
  }));
  expect(after.name).toBe('Ada Lovelace');
  expect(after.avatar).toBeTruthy();
});

test('the picture is the screen, and Watch opens from More', async ({ page }) => {
  await page.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#lobby.show').waitFor();
  await page.locator('#lob-admin-go').waitFor({ state: 'visible' });
  await expect(page.locator('#lob-admin-btn')).toBeHidden();
  await expect(page.locator('#lob-join-btn')).toBeHidden();
  const g = await page.evaluate(() => {
    const go = document.getElementById('lob-admin-go').getBoundingClientRect();
    const more = document.getElementById('lob-desk-more').getBoundingClientRect();
    const preview = document.getElementById('lob-preview').getBoundingClientRect();
    const card = document.querySelector('#lobby .lobby-card');
    return {
      goH: go.height,
      goBottom: go.bottom,
      goTop: go.top,
      previewTop: preview.top,
      previewH: preview.height,
      moreBottom: more.bottom,
      moreH: more.height,
      vh: innerHeight,
      cardBg: getComputedStyle(card).backgroundColor,
      goBg: getComputedStyle(document.getElementById('lob-admin-go')).backgroundColor,
    };
  });
  expect(g.goH).toBeGreaterThanOrEqual(44);
  expect(g.moreH).toBeGreaterThanOrEqual(44);
  expect(g.goBottom).toBeLessThanOrEqual(g.vh + 0.5);
  expect(g.previewTop).toBeLessThanOrEqual(1);
  expect(g.previewH).toBeGreaterThanOrEqual(g.vh - 1);
  expect(g.goTop).toBeGreaterThan(g.previewH * 0.5);
  expect(g.moreBottom).toBeLessThan(g.goTop);
  expect(g.cardBg).toBe('rgba(0, 0, 0, 0)');
  await page.locator('#lob-desk-more').click();
  const after = await page.evaluate(() => {
    const watch = document.getElementById('lob-join-btn').getBoundingClientRect();
    const preview = document.getElementById('lob-preview').getBoundingClientRect();
    const go = document.getElementById('lob-admin-go');
    return {
      watchH: watch.height,
      watchTop: watch.top,
      watchBottom: watch.bottom,
      previewBottom: preview.bottom,
      vh: innerHeight,
      goHidden: go.getClientRects().length === 0,
      watchBg: getComputedStyle(document.getElementById('lob-join-btn')).backgroundColor,
      goBg: getComputedStyle(go).backgroundColor,
    };
  });
  expect(after.goHidden).toBe(true);
  expect(after.watchH).toBeGreaterThanOrEqual(44);
  expect(after.watchTop).toBeGreaterThanOrEqual(0);
  expect(after.watchBottom).toBeLessThanOrEqual(after.previewBottom + 0.5);
  expect(after.watchBottom).toBeLessThanOrEqual(after.vh + 0.5);
  expect(farEnough(rgb(after.goBg), rgb(after.watchBg))).toBe(true);
});

test('a tap on the picture goes live', async ({ page }) => {
  await page.goto('/run.html#bc=1&st=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#lobby.show.stream-ready').waitFor();
  await page.locator('#lob-admin-go').waitFor({ state: 'visible' });
  const spot = await page.evaluate(() => {
    const preview = document.getElementById('lob-preview').getBoundingClientRect();
    const go = document.getElementById('lob-admin-go').getBoundingClientRect();
    const name = document.getElementById('lob-admin-name').getBoundingClientRect();
    return {
      x: preview.left + preview.width / 2,
      y: (name.bottom + go.top) / 2,
      previewH: preview.height,
      vh: innerHeight,
    };
  });
  expect(spot.previewH).toBeGreaterThanOrEqual(spot.vh - 1);
  expect(spot.y).toBeGreaterThan(0);
  await page.mouse.click(spot.x, spot.y);
  await expect(page.locator('#lob-admin-go')).toHaveText('Creating…');
  await expect(page.locator('#lob-admin-go')).toBeDisabled();
});
