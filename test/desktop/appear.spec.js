const { test, expect } = require('@playwright/test');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('the join step prefills your GifOS name and avatar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript((png) => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_avatar', JSON.stringify({
      mime: 'image/png', hash: 'ab'.repeat(32), b64: png,
    }));
  }, PNG);
  await page.goto('/run.html#v=qaappear&debug=on', { waitUntil: 'domcontentloaded' });
  const card = page.locator('#appear');
  await expect(card).toBeVisible();
  await expect(card).toContainText("This is how you'll appear");
  await expect(card).not.toContainText("in the meeting");
  await expect(page.locator('#nm')).toHaveValue('Avery Chen');
  await expect(page.locator('#appear-name')).toHaveText('Avery Chen');
  const face = await page.locator('#appear-face img').getAttribute('src');
  expect(face && face.indexOf('data:image/png') === 0).toBe(true);

  await page.fill('#nm', 'Sam Okonkwo');
  await expect(page.locator('#appear-name')).toHaveText('Sam Okonkwo');

  await expect(page.locator('#nmok')).toHaveText('Save');
  await expect(page.locator('#nmcancel')).toHaveText('Clear');

  const buttons = await page.evaluate(() => {
    const a = document.getElementById('nmcancel');
    const b = document.getElementById('nmok');
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const bg = (el) => getComputedStyle(el).backgroundColor;
    return {
      gap: br.left - ar.right,
      overlap: !(br.left >= ar.right - 1 || ar.left >= br.right - 1),
      same: bg(a) === bg(b),
      primary: bg(b),
      secondary: bg(a),
    };
  });
  expect(buttons.overlap).toBe(false);
  expect(buttons.gap).toBeGreaterThanOrEqual(8);
  expect(buttons.same).toBe(false);
  expect(buttons.primary).toBe('rgb(0, 100, 200)');
  expect(buttons.secondary).toBe('rgb(255, 255, 255)');

  await page.click('#nmok');
  await expect(card).toBeHidden();
  await expect(page.locator('#mic')).toBeVisible();
  const saved = await page.evaluate(() => ({
    name: localStorage.getItem('gifos_name'),
    avatar: localStorage.getItem('gifos_avatar'),
  }));
  expect(saved.name).toBe('Sam Okonkwo');
  expect(saved.avatar && saved.avatar.indexOf('image/png') >= 0).toBe(true);
});

test('Clear blanks the name and the picture', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript((png) => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_avatar', JSON.stringify({
      mime: 'image/png', hash: 'ab'.repeat(32), b64: png,
    }));
  }, PNG);
  await page.goto('/run.html#v=qaappear&debug=on', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#appear')).toBeVisible();
  await page.click('#nmcancel');
  await expect(page.locator('#appear')).toBeHidden();
  const cleared = await page.evaluate(() => ({
    name: localStorage.getItem('gifos_name'),
    avatar: localStorage.getItem('gifos_avatar'),
  }));
  expect(cleared.name).toBeFalsy();
  expect(cleared.avatar).toBeFalsy();
});
