import { test, expect } from '@playwright/test';

// The call dock must keep every primary control inside the screen, at a
// 44px touch size. On a 320px and a 360px phone, Leave used to draw past
// the right edge (right edge 374).
const IDS = ['cam', 'mic', 'reactbtn', 'bartoggle', 'leavebtn'];

test('primary call controls stay on screen', async ({ page }) => {
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#leavebtn').waitFor({ state: 'visible' });
  const boxes = await page.evaluate((ids) => {
    return ids.map((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return {
        id,
        left: r.left,
        right: r.right,
        width: r.width,
        height: r.height,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });
  }, IDS);
  for (const box of boxes) {
    expect(box.left, box.id + ' left').toBeGreaterThanOrEqual(0);
    expect(box.right, box.id + ' right').toBeLessThanOrEqual(box.vw + 0.5);
    expect(box.width, box.id + ' width').toBeGreaterThanOrEqual(44);
    expect(box.height, box.id + ' height').toBeGreaterThanOrEqual(44);
  }
});
