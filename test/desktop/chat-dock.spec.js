const { test, expect } = require('@playwright/test');

async function boot(page, width, height) {
  await page.setViewportSize({ width: width, height: height });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); });
  await page.goto('/run.html#v=qadesk&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4 }));
  expect(seeded && seeded.ok, JSON.stringify(seeded)).toBe(true);
  expect(seeded.n).toBe(4);
}

async function openChat(page) {
  const collapsed = await page.evaluate(() => document.querySelector('.bar').classList.contains('collapsed'));
  if (collapsed) await page.click('#bartoggle');
  await page.click('#chatbtn');
  await page.waitForSelector('#chatpanel.open');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
}

async function composerState(page) {
  return page.evaluate(() => {
    const form = document.querySelector('#chatform').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const overlap = form.left < bar.right - 1 && form.right > bar.left + 1
      && form.top < bar.bottom - 1 && form.bottom > bar.top + 1;
    const input = document.querySelector('#chat-in');
    const ib = input.getBoundingClientRect();
    const hit = document.elementFromPoint(ib.left + 12, ib.top + ib.height / 2);
    const small = document.querySelector('#chathead small').getBoundingClientRect();
    const panel = document.querySelector('#chatpanel').getBoundingClientRect();
    const close = document.querySelector('#chatclose').getBoundingClientRect();
    return {
      overlap: overlap,
      inputHit: !!(hit && (hit === input || input.contains(hit))),
      smallWide: small.width >= 220,
      smallInside: small.left >= panel.left - 1 && small.right <= panel.right + 1,
      closeInside: close.left >= panel.left - 1 && close.right <= panel.right + 1
        && close.top >= 0 && close.bottom <= window.innerHeight,
    };
  });
}

test('chat composer clears the dock in a narrow window', async ({ page }) => {
  await boot(page, 900, 720);
  await openChat(page);
  expect(await page.evaluate(() => document.querySelector('.bar').classList.contains('collapsed'))).toBe(true);
  const m = await composerState(page);
  expect(m.closeInside).toBe(true);
  expect(m.smallInside).toBe(true);
  expect(m.smallWide).toBe(true);
  expect(m.overlap).toBe(false);
  expect(m.inputHit).toBe(true);
});

test('chat composer stays clear while the window shrinks', async ({ page }) => {
  await boot(page, 1400, 800);
  await openChat(page);
  for (const w of [1280, 1100, 1000, 900]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(250);
    const m = await composerState(page);
    expect(m.overlap, 'composer overlaps the dock at ' + w).toBe(false);
    expect(m.inputHit, 'message field is covered at ' + w).toBe(true);
    expect(m.closeInside, 'close chat leaves the panel at ' + w).toBe(true);
  }
});
