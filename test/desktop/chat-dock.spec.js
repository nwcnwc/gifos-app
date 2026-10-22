const { test, expect } = require('@playwright/test');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

async function boot(page, width, height) {
  await page.setViewportSize({ width: width, height: height });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html#v=' + RUN_ROOM + 'qadesk&debug=on', { waitUntil: 'domcontentloaded' });
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
    const note = document.querySelector('#chathead small');
    const small = note.getBoundingClientRect();
    const cs = getComputedStyle(note);
    const panel = document.querySelector('#chatpanel').getBoundingClientRect();
    const close = document.querySelector('#chatclose').getBoundingClientRect();
    return {
      overlap: overlap,
      inputHit: !!(hit && (hit === input || input.contains(hit))),
      smallWide: small.width >= 220,
      noteFont: parseFloat(cs.fontSize),
      noteOneLine: small.height <= parseFloat(cs.lineHeight) + 2,
      smallInside: small.left >= panel.left - 1 && small.right <= panel.right + 1,
      closeInside: close.left >= panel.left - 1 && close.right <= panel.right + 1
        && close.top >= 0 && close.bottom <= window.innerHeight,
    };
  });
}

test('chat opens from the dock in one click', async ({ page }) => {
  await boot(page, 1280, 720);
  const btn = page.locator('#chatbtn');
  await expect(btn).toBeVisible();
  const place = await page.evaluate(() => {
    const b = document.getElementById('chatbtn');
    const bar = document.querySelector('.bar');
    const box = b.getBoundingClientRect();
    const word = b.querySelector('.dockword');
    return {
      inMore: !!b.closest('#barmore'),
      collapsed: bar.classList.contains('collapsed'),
      onScreen: box.left >= -1 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1,
      word: word ? word.textContent.trim() : '',
    };
  });
  expect(place.inMore).toBe(false);
  expect(place.collapsed).toBe(true);
  expect(place.onScreen).toBe(true);
  expect(place.word).toBe('Chat');
  await btn.click();
  await expect(page.locator('#chatpanel.open')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('.bar').classList.contains('collapsed'))).toBe(true);
  const on = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(on).toBe('rgb(0, 100, 200)');
  await page.setViewportSize({ width: 900, height: 720 });
  await page.waitForTimeout(200);
  const fit = await page.evaluate(() => {
    const ids = ['cam', 'chatbtn', 'leavebtn'];
    const out = {};
    for (const id of ids) {
      const b = document.getElementById(id).getBoundingClientRect();
      out[id] = b.left >= -1 && b.right <= window.innerWidth + 1 && b.bottom <= window.innerHeight + 1;
    }
    return out;
  });
  expect(fit.cam).toBe(true);
  expect(fit.chatbtn).toBe(true);
  expect(fit.leavebtn).toBe(true);
});

test('chat composer clears the dock in a narrow window', async ({ page }) => {
  await boot(page, 900, 720);
  await openChat(page);
  expect(await page.evaluate(() => document.querySelector('.bar').classList.contains('collapsed'))).toBe(true);
  const m = await composerState(page);
  expect(m.closeInside).toBe(true);
  expect(m.smallInside).toBe(true);
  expect(m.smallWide).toBe(true);
  expect(m.noteFont).toBeGreaterThanOrEqual(16);
  expect(m.noteOneLine).toBe(true);
  await expect(page.locator('#chathead small')).toHaveText('Private. Gone when everyone leaves.');
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
    expect(m.noteFont, 'privacy line is small at ' + w).toBeGreaterThanOrEqual(16);
    expect(m.noteOneLine, 'privacy line wraps at ' + w).toBe(true);
  }
});

test.describe('German chat privacy', () => {
  test.use({ locale: 'de-DE' });
  test('the privacy line is one readable German line', async ({ page }) => {
    await boot(page, 1280, 720);
    await openChat(page);
    const m = await composerState(page);
    expect(m.noteFont).toBeGreaterThanOrEqual(16);
    expect(m.noteOneLine).toBe(true);
    await expect(page.locator('#chathead small')).toHaveText('Nur hier. Weg, wenn alle gehen.');
  });
});

test.describe('Spanish chat privacy', () => {
  test.use({ locale: 'es-MX' });
  test('the privacy line is one readable Spanish line', async ({ page }) => {
    await boot(page, 1280, 720);
    await openChat(page);
    const m = await composerState(page);
    expect(m.noteFont).toBeGreaterThanOrEqual(16);
    expect(m.noteOneLine).toBe(true);
    await expect(page.locator('#chathead small')).toHaveText('Solo aquí. Se borra cuando salen.');
  });
});
