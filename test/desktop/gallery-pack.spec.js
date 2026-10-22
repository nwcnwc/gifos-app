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

// The dock floats over full-screen faces and fades when the call is quiet
// (Nathan 2026-10-19 16:42), so a name under the awake dock is by design
// (2026-10-22 13:11). Names are read once the dock has faded.
async function calm(page) {
  await page.waitForFunction(() => document.body.classList.contains('dock-calm')
    && getComputedStyle(document.querySelector('.bar')).opacity === '0', null, { timeout: 10000 });
}

// Where every face is, to the pixel: the dock fading moves none of them.
async function geometry(page) {
  return page.evaluate(() => [...document.querySelectorAll('#feed .tile')].map((el) => {
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height].map(Math.round).join(',');
  }).join(' '));
}

// A name is covered when it leaves its own face or the window, runs into
// another face, sits under a dock that still shows, or anything else is
// painted over its middle.
async function pack(page) {
  return page.evaluate(() => {
    const bar = document.querySelector('.bar');
    const dock = bar.getBoundingClientRect();
    const dockShows = parseFloat(getComputedStyle(bar).opacity) > 0.05 && dock.top < innerHeight;
    const hit = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) > 1;
    const faces = [...document.querySelectorAll('#feed .tile')].filter((el) => {
      const r = el.getBoundingClientRect();
      return getComputedStyle(el).display !== 'none' && r.width >= 2 && r.height >= 2;
    });
    const tiles = faces.map((el) => {
      const r = el.getBoundingClientRect();
      const name = el.querySelector('.name');
      const nr = name ? name.getBoundingClientRect() : null;
      let covered = false;
      if (nr) {
        const inside = nr.left >= r.left - 1 && nr.right <= r.right + 1 && nr.top >= r.top - 1 && nr.bottom <= r.bottom + 1;
        const onScreen = nr.left >= -1 && nr.top >= -1 && nr.right <= innerWidth + 1 && nr.bottom <= innerHeight + 1;
        const intoFace = faces.some((o) => o !== el && hit(nr, o.getBoundingClientRect()));
        const top = document.elementFromPoint((nr.left + nr.right) / 2, (nr.top + nr.bottom) / 2);
        const onTop = !!top && (top === name || name.contains(top));
        covered = !inside || !onScreen || intoFace || (dockShows && hit(nr, dock)) || !onTop;
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
      winH: innerHeight,
      dockH: dock.height,
      shortOff: shortOff,
      skinny: tiles.filter((t) => t.aspect < 0.44 || t.aspect > 2.4).length,
    };
  });
}

test('five faces pack evenly and their names clear the dock', async ({ page }) => {
  await boot(page, 1280, 720, 4);
  const awake = await geometry(page);
  await calm(page);
  expect(await geometry(page)).toBe(awake);
  const info = await pack(page);
  expect(info.n).toBe(5);
  expect(info.covered).toBe(0);
  // Faces fill the window; the dock floats over them (16:42).
  expect(info.tileBottom).toBeLessThanOrEqual(info.winH + 1);
  expect(info.fair).toBeGreaterThan(0.98);
  expect(info.overlap).toBeLessThan(4);
  expect(info.shortOff).toBeLessThan(8);
  expect(info.skinny).toBe(0);
  expect(info.dockH).toBeGreaterThan(100);
});

test('seven faces stay even at 1280 and at 900', async ({ page }) => {
  for (const w of [1280, 900]) {
    await boot(page, w, 720, 6);
    const awake = await geometry(page);
    await calm(page);
    expect(await geometry(page), String(w)).toBe(awake);
    const info = await pack(page);
    expect(info.n, String(w)).toBe(7);
    expect(info.covered, String(w)).toBe(0);
    expect(info.tileBottom, String(w)).toBeLessThanOrEqual(info.winH + 1);
    expect(info.fair, String(w)).toBeGreaterThan(0.98);
    expect(info.overlap, String(w)).toBeLessThan(4);
    expect(info.skinny, String(w)).toBe(0);
  }
});

// Zoom and Meet leave a thin gutter between faces. Touching tiles read as
// one picture cut into pieces, and a name strip runs into the next face.
async function gutters(page) {
  return page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#feed .tile')].map((el) => {
      const r = el.getBoundingClientRect();
      if (getComputedStyle(el).display === 'none' || r.width < 2 || r.height < 2) return null;
      return { x: r.x, y: r.y, r: r.right, b: r.bottom, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 };
    }).filter(Boolean);
    let minX = Infinity, minY = Infinity;
    for (const a of tiles) for (const b of tiles) {
      if (a === b) continue;
      const sameRow = Math.min(a.b, b.b) - Math.max(a.y, b.y) > 8;
      const sameCol = Math.min(a.r, b.r) - Math.max(a.x, b.x) > 8;
      if (sameRow && b.x >= a.x) minX = Math.min(minX, b.x - a.r);
      if (sameCol && b.y >= a.y) minY = Math.min(minY, b.y - a.b);
    }
    return { n: tiles.length, minX: minX, minY: minY, radius: Math.min(...tiles.map((t) => t.radius)) };
  });
}

test('faces have a gutter between them and soft corners', async ({ context }) => {
  for (const [w, n] of [[1280, 4], [1280, 6], [900, 6]]) {
    // A fresh page per boot: Firefox treats a second goto to the same url as same-document.
    const page = await context.newPage();
    await boot(page, w, 720, n);
    const g = await gutters(page);
    const at = w + 'px, ' + (n + 1) + ' faces';
    expect(g.n, at).toBe(n + 1);
    expect(g.minX, at).toBeGreaterThanOrEqual(6);
    expect(g.minY, at).toBeGreaterThanOrEqual(6);
    expect(g.minX, at).toBeLessThanOrEqual(16);
    expect(g.minY, at).toBeLessThanOrEqual(16);
    expect(g.radius, at).toBeGreaterThanOrEqual(8);
    await calm(page);
    const info = await pack(page);
    expect(info.covered, at).toBe(0);
    expect(info.fair, at).toBeGreaterThan(0.98);
    await page.close();
  }
});
