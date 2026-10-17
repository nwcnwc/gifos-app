const { test, expect } = require('@playwright/test');

async function boot(page, width, height, remotes) {
  await page.setViewportSize({ width: width, height: height });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qapack&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  const seeded = await page.evaluate((n) => window.__gifosVideo.seedGalleryForTest({ count: n }), remotes);
  expect(seeded && seeded.ok).toBe(true);
  await page.waitForFunction((n) => document.querySelectorAll('#feed .tile').length >= n + 1, remotes);
}

async function pack(page) {
  return page.evaluate(() => {
    const dock = document.querySelector('.bar').getBoundingClientRect();
    const tiles = [...document.querySelectorAll('#feed .tile')].map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || r.width < 2 || r.height < 2) return null;
      const name = el.querySelector('.name');
      const nr = name ? name.getBoundingClientRect() : null;
      let covered = false;
      if (nr) {
        const ix = Math.max(0, Math.min(nr.right, dock.right) - Math.max(nr.left, dock.left));
        const iy = Math.max(0, Math.min(nr.bottom, dock.bottom) - Math.max(nr.top, dock.top));
        covered = ix * iy > 1;
      }
      return {
        x: r.x, y: r.y, w: r.width, h: r.height,
        bottom: r.bottom,
        aspect: r.width / r.height,
        name: nr ? { bottom: nr.bottom, covered: covered } : null,
      };
    }).filter(Boolean);
    let overlap = 0;
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i], b = tiles[j];
        const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        overlap += ix * iy;
      }
    }
    const areas = tiles.map((t) => t.w * t.h);
    const fair = areas.length ? Math.min(...areas) / Math.max(...areas) : 0;
    const rows = [];
    for (const t of tiles) {
      let row = rows.find((g) => Math.abs(g.y - t.y) < 8);
      if (!row) { row = { y: t.y, tiles: [] }; rows.push(row); }
      row.tiles.push(t);
    }
    let shortOff = 0;
    if (rows.length > 1) {
      const spans = rows.map((g) => {
        const left = Math.min(...g.tiles.map((t) => t.x));
        const right = Math.max(...g.tiles.map((t) => t.x + t.w));
        return { left: left, right: right, mid: (left + right) / 2, w: right - left };
      });
      const full = Math.max(...spans.map((s) => s.w));
      const fullMid = spans.find((s) => Math.abs(s.w - full) < 4).mid;
      for (const s of spans) if (s.w < full - 8) shortOff = Math.max(shortOff, Math.abs(s.mid - fullMid));
    }
    return {
      n: tiles.length,
      fair: fair,
      overlap: overlap,
      covered: tiles.filter((t) => t.name && t.name.covered).length,
      tileBottom: tiles.reduce((m, t) => Math.max(m, t.bottom), 0),
      dockTop: dock.top,
      dockH: dock.height,
      shortOff: shortOff,
      skinny: tiles.filter((t) => t.aspect < 0.44 || t.aspect > 2.4).length,
    };
  });
}

test('five faces pack evenly and their names clear the dock', async ({ page }) => {
  await boot(page, 1280, 720, 4);
  const info = await pack(page);
  expect(info.n).toBe(5);
  expect(info.covered).toBe(0);
  expect(info.tileBottom).toBeLessThanOrEqual(info.dockTop + 1);
  expect(info.fair).toBeGreaterThan(0.98);
  expect(info.overlap).toBeLessThan(4);
  expect(info.shortOff).toBeLessThan(8);
  expect(info.skinny).toBe(0);
  expect(info.dockH).toBeGreaterThan(100);
});

test('seven faces stay even at 1280 and at 900', async ({ page }) => {
  for (const w of [1280, 900]) {
    await boot(page, w, 720, 6);
    const info = await pack(page);
    expect(info.n, String(w)).toBe(7);
    expect(info.covered, String(w)).toBe(0);
    expect(info.tileBottom, String(w)).toBeLessThanOrEqual(info.dockTop + 1);
    expect(info.fair, String(w)).toBeGreaterThan(0.98);
    expect(info.overlap, String(w)).toBeLessThan(4);
    expect(info.skinny, String(w)).toBe(0);
  }
});
