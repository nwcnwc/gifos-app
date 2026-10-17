const { test, expect } = require('@playwright/test');

async function boot(page, width, height) {
  await page.setViewportSize({ width: width, height: height });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html#v=qadesk&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 6 }));
  expect(seeded && seeded.ok).toBe(true);
}

async function wordBox(page, id) {
  return page.evaluate((id) => {
    const btn = document.getElementById(id);
    const word = btn && btn.querySelector('.dockword');
    if (!btn || !word) return { missing: true, text: word ? word.textContent : '' };
    const b = btn.getBoundingClientRect();
    const w = word.getBoundingClientRect();
    const cs = getComputedStyle(word);
    return {
      missing: false,
      text: (word.textContent || '').trim(),
      font: parseFloat(cs.fontSize),
      inside: w.left >= b.left - 1 && w.right <= b.right + 1 && w.top >= b.top - 1 && w.bottom <= b.bottom + 1,
      onScreen: b.left >= -1 && b.right <= window.innerWidth + 1 && b.bottom <= window.innerHeight + 1,
      readable: w.width >= 16 && w.height >= 8 && cs.visibility !== 'hidden' && cs.display !== 'none',
    };
  }, id);
}

test('mic, camera, more, and leave show a word on the dock', async ({ page }) => {
  await boot(page, 1280, 720);
  for (const [id, label] of [['mic', 'Mic'], ['cam', 'Video'], ['reactbtn', 'React'], ['bartoggle', 'More'], ['leavebtn', 'Leave']]) {
    const box = await wordBox(page, id);
    expect(box.missing, id).toBe(false);
    expect(box.text, id).toBe(label);
    expect(box.inside, id).toBe(true);
    expect(box.onScreen, id).toBe(true);
    expect(box.readable, id).toBe(true);
    expect(box.font, id).toBeGreaterThanOrEqual(11);
  }
  await page.click('#bartoggle');
  const open = await wordBox(page, 'bartoggle');
  expect(open.text).toBe('Hide');
});

test('the dock mic is the only Unmute', async ({ page }) => {
  await boot(page, 1280, 720);
  expect(await page.locator('#unmute').count()).toBe(0);
  expect(await page.locator('#showcam').count()).toBe(0);
  const muted = await page.evaluate(() => window.__gifosVideo.setOwnMicForTest(false));
  expect(muted.headerUnmute).toBe(false);
  expect(muted.headerCam).toBe(false);
  expect(muted.word).toBe('Mic');
  expect(muted.label).toBe('Mic');
  expect(muted.svg).toBe(true);
  const live = await page.evaluate(() => window.__gifosVideo.setOwnMicForTest(true));
  expect(live.word).toBe('Mic');
  expect(live.label).toBe('Mic');
  expect(live.svg).toBe(true);
  const again = await page.evaluate(() => window.__gifosVideo.setOwnMicForTest(false));
  expect(again.word).toBe('Mic');
  const pills = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => {
    if (b.closest('.bar')) return false;
    const cs = getComputedStyle(b);
    if (b.hidden || cs.display === 'none' || cs.visibility === 'hidden') return false;
    const t = (b.textContent || '').replace(/\s+/g, ' ').trim();
    return t === 'Unmute' || t === 'Mute';
  }).map((b) => b.id));
  expect(pills).toEqual([]);
});

test('dock words stay inside their buttons when the window narrows', async ({ page }) => {
  await boot(page, 1920, 1080);
  for (const w of [1600, 1280, 1100, 900]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(200);
    for (const id of ['mic', 'cam', 'reactbtn', 'bartoggle', 'leavebtn']) {
      const box = await wordBox(page, id);
      expect(box.inside, id + ' at ' + w).toBe(true);
      expect(box.onScreen, id + ' at ' + w).toBe(true);
    }
  }
});
