const { test, expect } = require('@playwright/test');

async function boot(page, hash) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Pastor Kim');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#' + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
}

async function box(page) {
  return page.evaluate(() => {
    const el = document.getElementById('rundown');
    const air = document.getElementById('onair');
    const dock = document.querySelector('.bar');
    if (!el) return { missing: true };
    const cs = getComputedStyle(el);
    const cur = el.querySelector('li.now .rdname') || document.getElementById('rundown-end');
    const er = el.getBoundingClientRect();
    const ar = air ? air.getBoundingClientRect() : null;
    const d = dock ? dock.getBoundingClientRect() : null;
    const airOn = air && getComputedStyle(air).display !== 'none';
    const overlap = (a, b) => !!(a && b && a.width > 8 && b.width > 8 && a.bottom > b.top + 4 && a.top < b.bottom - 4 && a.right > b.left + 4 && a.left < b.right - 4);
    return {
      missing: false,
      display: cs.display,
      title: (document.getElementById('rundown-title') || {}).textContent || '',
      now: cur ? cur.textContent.trim() : '',
      nowTag: cur && cur.parentElement ? (cur.parentElement.querySelector('.nowtag') || {}).textContent || '' : '',
      font: cur ? parseFloat(getComputedStyle(cur).fontSize) : 0,
      clipped: cur ? cur.scrollWidth > cur.clientWidth + 1 : true,
      onScreen: er.width > 8 && er.left >= -1 && er.right <= window.innerWidth + 1 && er.top >= -1 && er.bottom <= window.innerHeight + 1,
      coversDock: overlap(er, d),
      coversAir: airOn ? overlap(er, ar) : false,
      next: (document.getElementById('rundown-next') || {}).textContent || '',
      items: Array.from(el.querySelectorAll('li .rdname')).map((n) => n.textContent.trim()),
    };
  });
}

test('a normal meeting has no service rundown', async ({ page }) => {
  await boot(page, 'v=qameet&debug=on');
  const b = await box(page);
  expect(b.missing).toBe(false);
  expect(b.display).toBe('none');
});

test('a broadcast viewer does not run the order of service', async ({ page }) => {
  await boot(page, 'v=qarun&av=0123456789abcdef&bc=1&debug=on');
  const b = await box(page);
  expect(b.missing).toBe(false);
  expect(b.display).toBe('none');
});

test('a host steps through the order of service', async ({ page }) => {
  await boot(page, 'v=qarun&av=0123456789abcdef&bc=1&debug=on');
  const armed = await page.evaluate(() => window.__gifosVideo.armBroadcastHostForTest());
  expect(armed && armed.ok).toBe(true);
  const open = await box(page);
  expect(open.missing).toBe(false);
  expect(open.display).not.toBe('none');
  expect(open.title).toBe('Run of show');
  expect(open.now).toBe('Welcome');
  expect(open.nowTag).toBe('Now');
  expect(open.font).toBeGreaterThanOrEqual(22);
  expect(open.clipped).toBe(false);
  expect(open.onScreen).toBe(true);
  expect(open.coversDock).toBe(false);
  expect(open.coversAir).toBe(false);
  expect(open.next).toBe('Next');
  expect(open.items).toEqual(['Welcome', 'Song 1', 'Break', 'Reading', 'Talk', 'Song 2', 'Closing']);

  await page.click('#rundown-next');
  const song = await box(page);
  expect(song.now).toBe('Song 1');
  expect(song.items[0]).toBe('Welcome');

  for (let i = 0; i < 5; i++) await page.click('#rundown-next');
  const last = await box(page);
  expect(last.now).toBe('Closing');
  expect(last.next).toBe('Done');

  await page.click('#rundown-next');
  const ended = await box(page);
  expect(ended.now).toBe('Ended');
  expect(ended.next).toBe('Start over');
  expect(ended.font).toBeGreaterThanOrEqual(22);
  expect(ended.onScreen).toBe(true);
  expect(ended.coversDock).toBe(false);
  expect(ended.coversAir).toBe(false);

  await page.click('#rundown-next');
  const again = await box(page);
  expect(again.now).toBe('Welcome');
  expect(again.next).toBe('Next');

  await page.setViewportSize({ width: 900, height: 720 });
  const narrow = await box(page);
  expect(narrow.now).toBe('Welcome');
  expect(narrow.clipped).toBe(false);
  expect(narrow.onScreen).toBe(true);
  expect(narrow.coversDock).toBe(false);
  expect(narrow.coversAir).toBe(false);
});
