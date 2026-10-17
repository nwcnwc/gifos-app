const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qablur&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: true }));
  await page.waitForSelector('.tile > .blurbox');
}

test('Blur for all is a square inset from the tile corner', async ({ page }) => {
  await boot(page);
  const info = await page.evaluate(() => {
    function gap(a, b) {
      if (!a || !b || b.w < 2 || b.h < 2) return 999;
      return Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
    }
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2) return null;
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height };
    };
    return Array.from(document.querySelectorAll('.tile > .blurbox')).map((el) => {
      const tile = el.closest('.tile');
      tile.classList.add('menu');
      const tb = tile.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const a = box(el);
      return {
        text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
        w: b.width,
        h: b.height,
        topGap: b.top - tb.top,
        rightGap: tb.right - b.right,
        clipped: el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2,
        name: gap(a, box(tile.querySelector('.name'))),
        max: gap(a, box(tile.querySelector('.maxbtn'))),
        mod: gap(a, box(tile.querySelector('.modbar'))),
        overVideo: b.top > tb.top + 4 && b.right < tb.right - 4 && b.bottom < tb.bottom - 4 && b.left > tb.left + 4,
      };
    });
  });
  expect(info.length).toBeGreaterThanOrEqual(1);
  for (const b of info) {
    expect(b.text).toBe('Blur for all');
    expect(b.w).toBeGreaterThanOrEqual(44);
    expect(b.h).toBeGreaterThanOrEqual(44);
    expect(Math.abs(b.w - b.h)).toBeLessThanOrEqual(1);
    expect(b.topGap).toBeGreaterThanOrEqual(8);
    expect(b.rightGap).toBeGreaterThanOrEqual(8);
    expect(b.clipped).toBe(false);
    expect(b.overVideo).toBe(true);
    expect(b.name).toBeGreaterThanOrEqual(12);
    expect(b.max).toBeGreaterThanOrEqual(12);
    expect(b.mod).toBeGreaterThanOrEqual(12);
  }
});

// Zoom and Meet keep a face clean until you point at it. A dark Blur for all
// square and a Max button on every face is a product, not a room: on a
// desktop they show on the face under the pointer or with keyboard focus,
// and a face that is already blurred keeps its Unblur so the state is seen.
test('Blur for all shows only on the face you point at', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qablurhover&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  // Five faces: a busy room, so calm never hides anything here.
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4, connected: true }));
  await page.waitForFunction(() => document.querySelectorAll('#feed .tile:not(.me) > .blurbox.on').length >= 4);
  const read = () => page.evaluate(() => {
    const shown = (el) => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.95
        && cs.pointerEvents !== 'none' && r.width > 1;
    };
    const tiles = [...document.querySelectorAll('#feed .tile:not(.me)')];
    return tiles.map((t) => ({
      hover: t.matches(':hover'),
      blur: shown(t.querySelector(':scope > .blurbox')),
      max: shown(t.querySelector('.maxbtn')),
      name: shown(t.querySelector('.name')),
      pressed: (t.querySelector(':scope > .blurbox') || {}).getAttribute?.('aria-pressed'),
    }));
  });
  // Pointer off the faces: no face carries the square or Max; names stay.
  await page.mouse.move(2, 2);
  await page.waitForTimeout(400);
  const away = await read();
  await page.screenshot({ path: 'test/desktop/shots/blur-hover-after-1280.png' });
  expect(away.filter((t) => t.hover).length).toBe(0);
  expect(away.filter((t) => t.blur).length).toBe(0);
  expect(away.filter((t) => t.max).length).toBe(0);
  expect(away.every((t) => t.name)).toBe(true);
  // Point at one face: that face, and only that face, offers Blur for all.
  const first = page.locator('#feed .tile:not(.me)').first();
  const fb = await first.boundingBox();
  await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await page.waitForTimeout(400);
  const over = await read();
  expect(over[0].hover).toBe(true);
  expect(over[0].blur).toBe(true);
  expect(over.slice(1).filter((t) => t.blur).length).toBe(0);
  // Blur it, then leave: the blurred face keeps Unblur in view.
  await first.locator(':scope > .blurbox').click();
  await expect.poll(async () => (await read())[0].pressed).toBe('true');
  await page.mouse.move(2, 2);
  await page.waitForTimeout(400);
  const after = await read();
  expect(after[0].blur).toBe(true);
  expect(after.slice(1).filter((t) => t.blur).length).toBe(0);
  // Keyboard: focus on a face's button shows it.
  await page.locator('#feed .tile:not(.me)').nth(1).locator(':scope > .blurbox').focus();
  await page.waitForTimeout(400);
  expect((await read())[1].blur).toBe(true);
});

// A face that is already blurry needs no Blur for all. Already blurry means
// the sender's own announced blur (Min or Max) or a host's blur for all; a
// soft low-bitrate picture does not count. A host-blurred face keeps Unblur
// in view, and the offer comes back when the sender turns their blur off.
test('Blur for all hides on a face that is already blurred', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qablurdone&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4, connected: true }));
  await page.waitForFunction(() => document.querySelectorAll('#feed .tile:not(.me) > .blurbox.on').length >= 4);
  // Avery blurs their own face (Max), Luis picks Min, Sam is blurred for all.
  await page.evaluate(() => {
    window.__gifosVideo.setPeerBlurForTest('Avery Chen', 2);
    window.__gifosVideo.setPeerBlurForTest('Luis Ortega', 1);
  });
  const tileOf = (name) => page.locator('#feed .tile:not(.me)').filter({ has: page.locator('.name', { hasText: name }) });
  const sam = tileOf('Sam Okonkwo');
  const sb = await sam.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await sam.locator(':scope > .blurbox').click();
  await expect(sam.locator(':scope > .blurbox')).toHaveAttribute('aria-pressed', 'true');
  // Read one face under the pointer and with its menu open (the phone tap).
  const look = async (name) => {
    const t = tileOf(name);
    const b = await t.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(350);
    return t.evaluate((tile) => {
      tile.classList.add('menu');
      const shown = (el) => {
        if (!el) return false;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.95 && r.width > 1;
      };
      const box = tile.querySelector(':scope > .blurbox');
      const every = tile.querySelector('.modbar [data-mod="blur"]');
      const out = {
        box: shown(box) ? box.textContent.trim() : '',
        every: shown(every) ? every.textContent.trim() : '',
      };
      tile.classList.remove('menu');
      return out;
    });
  };
  const avery = await look('Avery Chen');
  const luis = await look('Luis Ortega');
  const samNow = await look('Sam Okonkwo');
  const priya = await look('Priya Shah');
  await page.screenshot({ path: 'test/desktop/shots/blur-done-after-1280.png' });
  // Own blur on: no Blur for all, no Blur for everyone.
  expect(avery).toEqual({ box: '', every: '' });
  expect(luis).toEqual({ box: '', every: '' });
  // Blurred for all by a host: Unblur stays, no second Blur offer.
  expect(samNow.box).toBe('Unblur');
  expect(samNow.every).toBe('Unblur for everyone');
  // A clear face still offers both.
  expect(priya).toEqual({ box: 'Blur for all', every: 'Blur for everyone' });
  // Avery turns their blur off: the offer comes back.
  await page.evaluate(() => window.__gifosVideo.setPeerBlurForTest('Avery Chen', 0));
  expect(await look('Avery Chen')).toEqual({ box: 'Blur for all', every: 'Blur for everyone' });
});
