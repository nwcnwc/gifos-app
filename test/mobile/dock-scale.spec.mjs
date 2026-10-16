import { test, expect } from '@playwright/test';

const IDS = ['cam', 'flipcam', 'mic', 'reactbtn', 'bartoggle', 'leavebtn'];

async function dismissName(page) {
  const cancel = page.locator('#nmok');
  try {
    await cancel.waitFor({ state: 'visible', timeout: 2000 });
    await cancel.evaluate((el) => el.click());
  } catch { /* stored name */ }
}

test('the dock grows with the root text size without thinning the face', async ({ page }) => {
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#leavebtn').waitFor({ state: 'visible' });
  await dismissName(page);
  const before = await page.locator('#cam').evaluate((el) => el.getBoundingClientRect().height);
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  const box = await page.evaluate((ids) => {
    const me = document.querySelector('.tile.me').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const controls = ids.map((id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return { id, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, display: getComputedStyle(el).display };
    }).filter((b) => b.display !== 'none' && b.width >= 44);
    const rows = [];
    for (const control of controls) {
      const row = rows.find((items) => Math.abs(items[0].top - control.top) < 8);
      if (row) row.push(control);
      else rows.push([control]);
    }
    const gaps = [];
    for (const row of rows) {
      const ordered = row.slice().sort((a, b) => a.left - b.left);
      for (let i = 1; i < ordered.length; i++) gaps.push(ordered[i].left - ordered[i - 1].right);
    }
    return {
      controls,
      gaps,
      rows: rows.length,
      meW: me.width,
      meH: me.height,
      barTop: bar.top,
      barH: bar.height,
      meBottom: me.bottom,
      vh: innerHeight,
      vw: innerWidth,
    };
  }, IDS);
  expect(box.controls.find((c) => c.id === 'cam').height).toBeGreaterThan(before + 8);
  expect(box.controls.find((c) => c.id === 'cam').height).toBeGreaterThanOrEqual(84);
  expect(box.controls.find((c) => c.id === 'leavebtn').height).toBeGreaterThanOrEqual(90);
  for (const control of box.controls) {
    expect(control.left, control.id).toBeGreaterThanOrEqual(-0.5);
    expect(control.right, control.id).toBeLessThanOrEqual(box.vw + 0.5);
    expect(control.bottom, control.id).toBeLessThanOrEqual(box.vh + 0.5);
    expect(control.height, control.id).toBeGreaterThanOrEqual(84);
  }
  expect(box.gaps.length).toBeGreaterThan(0);
  for (const gap of box.gaps) expect(gap).toBeGreaterThanOrEqual(8);
  expect(Math.min(box.meW, box.meH)).toBeGreaterThanOrEqual(160);
  const cover = Math.max(0, box.meBottom - box.barTop);
  expect(cover).toBeLessThan(box.meH * 0.5);
});

test('a short landscape dock grows with the text and stays a thin row', async ({ page }) => {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) });
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('.tile.me').waitFor({ state: 'visible' });
  await dismissName(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
    if (window.__meetChromeShow) window.__meetChromeShow();
  });
  const box = await page.evaluate(() => {
    const me = document.querySelector('.tile.me').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const cam = document.getElementById('cam').getBoundingClientRect();
    const glyph = document.querySelector('#cam svg').getBoundingClientRect();
    const leave = document.getElementById('leavebtn').getBoundingClientRect();
    return {
      camH: cam.height, glyph: glyph.width, barH: bar.height, barRight: bar.right,
      leaveRight: leave.right, meW: me.width, meH: me.height, meBottom: me.bottom,
      barTop: bar.top, vh: innerHeight, vw: innerWidth,
    };
  });
  expect(box.camH).toBeGreaterThanOrEqual(52);
  expect(box.camH).toBeLessThanOrEqual(56.5);
  expect(box.glyph).toBeGreaterThanOrEqual(26);
  expect(box.barH).toBeGreaterThanOrEqual(60);
  expect(box.barH).toBeLessThanOrEqual(64.5);
  expect(box.barRight).toBeLessThanOrEqual(box.vw + 0.5);
  expect(box.leaveRight).toBeLessThanOrEqual(box.vw + 0.5);
  expect(box.meBottom).toBeGreaterThanOrEqual(box.vh - 2);
  expect(Math.min(box.meW, box.meH)).toBeGreaterThanOrEqual(120);
  expect(box.meBottom - box.barTop).toBeLessThan(box.meH * 0.4);
});
