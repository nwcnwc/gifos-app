const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html#v=qakeys&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  await page.evaluate(() => {
    for (const id of ['mic', 'cam']) {
      const el = document.getElementById(id);
      el.dataset.hits = '0';
      const prev = el.onclick;
      el.onclick = function (ev) {
        el.dataset.hits = String((+el.dataset.hits || 0) + 1);
        if (prev) return prev.call(this, ev);
      };
    }
  });
}

async function hits(page, id) {
  return page.locator('#' + id).getAttribute('data-hits');
}

test('alt shortcuts run the dock and skip the keys while typing', async ({ page }) => {
  await boot(page);
  for (const [id, chord] of [['mic', 'Alt+A'], ['cam', 'Alt+V'], ['chatbtn', 'Alt+C'], ['leavebtn', 'Alt+Q']]) {
    expect(await page.getAttribute('#' + id, 'aria-keyshortcuts'), id).toBe(chord);
  }
  await page.keyboard.press('Alt+a');
  await page.keyboard.press('Alt+v');
  expect(await hits(page, 'mic')).toBe('1');
  expect(await hits(page, 'cam')).toBe('1');

  await page.keyboard.press('Alt+c');
  await expect(page.locator('#chatpanel.open')).toBeVisible();
  await page.locator('#chat-in').focus();
  await page.keyboard.press('Alt+a');
  await page.keyboard.press('?');
  expect(await hits(page, 'mic')).toBe('1');
  await expect(page.locator('#chat-in')).toHaveValue('?');
  await expect(page.locator('#shortcutsheet')).toBeHidden();

  await page.locator('#chat-in').blur();
  await page.keyboard.press('?');
  const sheet = page.locator('#shortcutsheet');
  await expect(sheet).toBeVisible();
  const read = await sheet.evaluate((el) => {
    const box = el.querySelector('.name-box').getBoundingClientRect();
    const sample = el.querySelector('li');
    const cs = getComputedStyle(sample);
    return {
      text: el.innerText,
      onScreen: box.top >= 0 && box.bottom <= window.innerHeight && box.left >= 0 && box.right <= window.innerWidth,
      font: parseFloat(cs.fontSize),
    };
  });
  expect(read.onScreen).toBe(true);
  expect(read.font).toBeGreaterThanOrEqual(16);
  for (const chord of ['Alt+A', 'Alt+V', 'Alt+C', 'Alt+Q']) expect(read.text).toContain(chord);

  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await page.click('#bartoggle');
  await page.click('#keysbtn');
  await expect(sheet).toBeVisible();

  await page.keyboard.press('Escape');
  await page.keyboard.press('Alt+q');
  await expect(page.locator('#leave-ask')).toBeVisible();
  await expect(page.locator('#left-modal')).toBeHidden();
});
