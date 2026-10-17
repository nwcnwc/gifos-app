const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qaroster&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 20, connected: false }));
  expect(seeded && seeded.ok).toBe(true);
  await page.waitForTimeout(200);
}

async function rosterBox(page) {
  return page.evaluate(() => {
    const el = document.getElementById('roster');
    const list = document.getElementById('roster-list');
    if (!el || !list) return { missing: true };
    const rows = Array.from(list.querySelectorAll('.roster-row'));
    const cs = getComputedStyle(el);
    const er = el.getBoundingClientRect();
    const dock = document.querySelector('.bar');
    const d = dock ? dock.getBoundingClientRect() : null;
    const sample = rows[0];
    const font = sample ? parseFloat(getComputedStyle(sample).fontSize) : 0;
    const clipped = rows.some((row) => {
      const name = row.querySelector('.nm');
      if (!name) return true;
      return name.scrollWidth > name.clientWidth + 2 && getComputedStyle(name).whiteSpace === 'nowrap';
    });
    return {
      missing: false,
      open: cs.display !== 'none',
      title: (document.getElementById('roster-title') || {}).textContent || '',
      count: (document.getElementById('statuscount') || {}).textContent || '',
      names: rows.map((row) => (row.textContent || '').replace(/\s+/g, ' ').trim()),
      n: rows.length,
      font: font,
      clipped: clipped,
      scrolls: list.scrollHeight > list.clientHeight + 4,
      onScreen: er.left >= -1 && er.right <= window.innerWidth + 1 && er.top >= -1,
      coversDock: !!(d && cs.display !== 'none' && er.bottom > d.top + 4 && er.right > d.left && er.left < d.right),
    };
  });
}

test('twenty people open as a roster from the count', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#statuscount')).toHaveText('21 in the meeting');
  const closed = await rosterBox(page);
  expect(closed.missing).toBe(false);
  expect(closed.open).toBe(false);

  await page.click('#statuscount');
  const open = await rosterBox(page);
  expect(open.open).toBe(true);
  expect(open.n).toBe(21);
  expect(open.title).toBe('21 people');
  expect(open.names.some((n) => n.indexOf('Jordan Lee') >= 0)).toBe(true);
  expect(open.names.some((n) => n.indexOf('Avery Chen') >= 0)).toBe(true);
  expect(open.names.some((n) => n.indexOf('Priya Shah') >= 0)).toBe(true);
  expect(open.font).toBeGreaterThanOrEqual(16);
  expect(open.clipped).toBe(false);
  expect(open.scrolls).toBe(true);
  expect(open.onScreen).toBe(true);
  expect(open.coversDock).toBe(false);

  await page.fill('#roster-find', 'priya');
  const found = await rosterBox(page);
  expect(found.n).toBe(1);
  expect(found.names[0]).toContain('Priya Shah');
  expect(found.names[0]).toContain('Hand');

  await page.click('#roster-close');
  const again = await rosterBox(page);
  expect(again.open).toBe(false);
});
