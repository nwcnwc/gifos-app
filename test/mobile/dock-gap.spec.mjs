import { test, expect } from '@playwright/test';

async function dismissName(page) {
  const cancel = page.locator('#nmcancel');
  try {
    await cancel.waitFor({ state: 'visible', timeout: 2000 });
    await cancel.evaluate((el) => el.click());
  } catch { /* stored name */ }
}

async function expectGaps(page) {
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#leavebtn').waitFor({ state: 'visible' });
  await dismissName(page);
  const gaps = await page.evaluate(() => {
    const ids = ['cam', 'flipcam', 'mic', 'reactbtn', 'bartoggle', 'leavebtn'];
    const boxes = ids.map((id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return { id, left: r.left, right: r.right, width: r.width, display: getComputedStyle(el).display };
    }).filter((b) => b.display !== 'none' && b.width >= 44);
    const between = [];
    for (let i = 1; i < boxes.length; i++) between.push({ from: boxes[i - 1].id, to: boxes[i].id, gap: boxes[i].left - boxes[i - 1].right });
    const leave = boxes[boxes.length - 1];
    return { between, leaveRight: leave.right, vw: innerWidth };
  });
  expect(gaps.between.length).toBeGreaterThan(0);
  for (const pair of gaps.between) {
    expect(pair.gap, pair.from + ' to ' + pair.to).toBeGreaterThanOrEqual(8);
  }
  expect(gaps.leaveRight).toBeLessThanOrEqual(gaps.vw + 0.5);
}

test('dock controls keep at least 8px between them', async ({ page }) => {
  await expectGaps(page);
});

test('dock controls keep that gap in landscape', async ({ page }) => {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) });
  await expectGaps(page);
});
