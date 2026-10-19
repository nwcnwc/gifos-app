const { test, expect } = require('@playwright/test');

async function boot(page, width, height) {
  await page.setViewportSize({ width: width, height: height });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qaeyes&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4 }));
  expect(seeded && seeded.ok).toBe(true);
  await page.waitForFunction(() => document.querySelectorAll('#feed .tile[data-comfy="1"]').length >= 5);
  // Fit is placed beside the build label once that label is up.
  await page.waitForFunction(() => { const b = document.getElementById('gifos-build-float'); return b && b.getClientRects().length; });
  await page.evaluate(() => new Promise((r) => { window.dispatchEvent(new Event('resize')); requestAnimationFrame(() => requestAnimationFrame(r)); }));
}

function overlap(a, b) {
  const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return ix * iy > 1;
}

test('the Fit control is 16px and clears the top chips and tile buttons', async ({ context }) => {
  for (const w of [1280, 900]) {
    // A fresh page per width: Firefox treats a second goto to the same URL as a hash change.
    const page = await context.newPage();
    await boot(page, w, 720);
    const fit = await page.evaluate(() => {
      const b = document.getElementById('fitbtn');
      const r = b.getBoundingClientRect();
      const others = [...document.querySelectorAll('.topchip, #gifos-build-float, .admcount > *, #feed .tile button, #feed .tile .name')]
        .filter((el) => el !== b && getComputedStyle(el).display !== 'none' && el.getClientRects().length)
        .map((el) => { const o = el.getBoundingClientRect(); return { id: el.id || el.className, left: o.left, right: o.right, top: o.top, bottom: o.bottom }; });
      return { font: parseFloat(getComputedStyle(b).fontSize), h: r.height, box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, onScreen: r.right <= innerWidth + 1 && r.left >= -1, others };
    });
    expect(fit.font, 'Fit at ' + w).toBeGreaterThanOrEqual(16);
    expect(fit.h, 'Fit at ' + w).toBeGreaterThanOrEqual(44);
    expect(fit.onScreen, 'Fit at ' + w).toBe(true);
    expect(fit.others.filter((o) => overlap(o, fit.box)).map((o) => o.id), 'Fit at ' + w).toEqual([]);
    await page.close();
  }
});

test('every word in the open More sheet is 16px', async ({ page }) => {
  await boot(page, 1280, 720);
  await page.click('#bartoggle');
  const small = await page.evaluate(() => {
    const out = [];
    const walk = document.createTreeWalker(document.getElementById('barmore'), NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const t = n.textContent.trim();
      const el = n.parentElement;
      if (!t || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      if (parseFloat(cs.fontSize) < 16) out.push(t + ' ' + cs.fontSize);
    }
    return out;
  });
  expect(small).toEqual([]);
  const heads = await page.evaluate(() => [...document.querySelectorAll('#barmore .moregroup h4')]
    .filter((h) => getComputedStyle(h.closest('.moregroup')).display !== 'none')
    .map((h) => ({ t: h.textContent.trim(), caps: getComputedStyle(h).textTransform })));
  expect(heads.length).toBe(5);
  for (const h of heads) expect(h.caps, h.t).toBe('none');
});

test('Fit does not cover Stop sharing on a shared slide', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await boot(page, 1280, 720);
  await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 720;
    const x = c.getContext('2d');
    x.fillStyle = '#f7f4ec';
    x.fillRect(0, 0, 1280, 720);
    const stream = c.captureStream(8);
    navigator.mediaDevices.getDisplayMedia = () => Promise.resolve(stream);
  });
  await page.click('#sharebtn');
  await expect(page.locator('#stagefeed .stagestop')).toBeVisible();
  const hit = await page.evaluate(() => {
    const stop = document.querySelector('#stagefeed .stagestop');
    const s = stop.getBoundingClientRect();
    const f = document.getElementById('fitbtn').getBoundingClientRect();
    const at = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2);
    const ix = Math.max(0, Math.min(s.right, f.right) - Math.max(s.left, f.left));
    const iy = Math.max(0, Math.min(s.bottom, f.bottom) - Math.max(s.top, f.top));
    return { onTop: !!at && (at === stop || stop.contains(at)), overlap: ix * iy > 1, stop: [s.left, s.top, s.right, s.bottom].map(Math.round), fit: [f.left, f.top, f.right, f.bottom].map(Math.round) };
  });
  expect(hit.overlap, JSON.stringify(hit)).toBe(false);
  expect(hit.onTop, JSON.stringify(hit)).toBe(true);
  await page.click('#stagefeed .stagestop');
  await expect(page.locator('#stagefeed video')).toHaveCount(0);
});

// 0.9.23b: a face's per-person buttons live in its control window. Open it
// on a face in a room of five and of nine: every word on its buttons is
// 16px, nothing is clipped, and the buttons do not cover each other.
test('the words in a face\'s control window are 16px', async ({ context }) => {
  for (const count of [4, 8]) {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => {
      localStorage.setItem('gifos_name', 'Jordan Lee');
      sessionStorage.setItem('gifos_appeared', '1');
    });
    await page.goto('/run.html#v=qaeyestile' + count + '&debug=on', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mic', { state: 'visible' });
    await page.evaluate((n) => window.__gifosVideo.seedGalleryForTest({ count: n, connected: true }), count);
    await page.waitForFunction((n) => document.querySelectorAll('#feed .tile[data-comfy="1"]:not(.me)').length >= n, count);
    const face = page.locator('#feed .tile:not(.me)').first();
    const fb = await face.boundingBox();
    await page.mouse.click(fb.x + fb.width / 2, fb.y + fb.height / 2);
    await expect(page.locator('#tilewin')).toBeVisible();
    if (count === 4) await page.screenshot({ path: 'test/desktop/shots/tile-words-after-1280.png' });
    const info = await page.evaluate(() => {
      const win = document.getElementById('tilewin');
      const seen = (el) => { const cs = getComputedStyle(el); return el.getClientRects().length && cs.display !== 'none' && cs.visibility !== 'hidden'; };
      const btns = [...win.querySelectorAll('button')].filter(seen).filter((el) => /[A-Za-z]/.test(el.textContent || ''));
      const boxes = btns.map((el) => { const r = el.getBoundingClientRect(); return { id: el.textContent.trim(), left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
      return {
        words: btns.map((el) => el.textContent.trim()),
        small: btns.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => el.textContent.trim() + ' ' + getComputedStyle(el).fontSize),
        clipped: btns.filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map((el) => el.textContent.trim()),
        boxes,
      };
    });
    expect(info.words, 'room of ' + (count + 1)).toEqual(expect.arrayContaining(['Pin']));
    expect(info.small, 'room of ' + (count + 1)).toEqual([]);
    expect(info.clipped, 'room of ' + (count + 1)).toEqual([]);
    const hits = [];
    for (let i = 0; i < info.boxes.length; i++) for (let j = i + 1; j < info.boxes.length; j++) {
      if (overlap(info.boxes[i], info.boxes[j])) hits.push(info.boxes[i].id + ' / ' + info.boxes[j].id);
    }
    expect(hits, 'room of ' + (count + 1)).toEqual([]);
    await page.close();
  }
});

// A raised hand is the one chip a volunteer must read from across the room.
// On a desktop its words are 16px, in a room of five and of nine, and the
// chip still sits inside the face, whole, and clear of the name.
test('the hand raised chip on a face is 16px', async ({ context }) => {
  for (const count of [4, 8]) {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => {
      localStorage.setItem('gifos_name', 'Jordan Lee');
      sessionStorage.setItem('gifos_appeared', '1');
    });
    await page.goto('/run.html#v=qaeyeshand&debug=on', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mic', { state: 'visible' });
    await page.evaluate((n) => window.__gifosVideo.seedGalleryForTest({ count: n, connected: true }), count);
    await page.waitForFunction((n) => document.querySelectorAll('#feed .tile:not(.me) > .blurbox.on').length >= n, count);
    await page.evaluate(() => window.__gifosVideo.raiseHand(true));
    await page.waitForFunction(() => [...document.querySelectorAll('#feed .tile .chips span')].some((s) => /hand raised/.test(s.textContent)));
    await page.waitForTimeout(300);
    if (count === 4) await page.screenshot({ path: 'test/desktop/shots/hand-chip-after-1280.png' });
    const info = await page.evaluate(() => {
      const chip = [...document.querySelectorAll('#feed .tile .chips span')].find((s) => /hand raised/.test(s.textContent));
      const tile = chip.closest('.tile');
      const tb = tile.getBoundingClientRect();
      const cb = chip.getBoundingClientRect();
      const row = chip.parentElement.getBoundingClientRect();
      const name = tile.querySelector('.name');
      const nb = name && name.getClientRects().length ? name.getBoundingClientRect() : null;
      return {
        font: parseFloat(getComputedStyle(chip).fontSize),
        inside: cb.left >= tb.left - 1 && cb.right <= tb.right + 1 && cb.top >= tb.top - 1 && cb.bottom <= tb.bottom + 1,
        whole: cb.right <= row.right + 1 && chip.scrollWidth <= chip.clientWidth + 1,
        chip: { left: cb.left, right: cb.right, top: cb.top, bottom: cb.bottom },
        name: nb && { left: nb.left, right: nb.right, top: nb.top, bottom: nb.bottom },
      };
    });
    expect(info.font, 'room of ' + (count + 1)).toBeGreaterThanOrEqual(16);
    expect(info.inside, 'room of ' + (count + 1)).toBe(true);
    expect(info.whole, 'room of ' + (count + 1)).toBe(true);
    if (info.name) expect(overlap(info.chip, info.name), 'room of ' + (count + 1)).toBe(false);
    await page.close();
  }
});

// The mute and camera marks on a face were bare 14px icons: an older member
// could not tell a muted mic from a camera that is off without hovering for
// the tip. On a desktop each mark says its word beside the icon, at 16px,
// whole, inside the face and clear of the name, in a room of five and nine,
// and in German too. Phones keep the icon alone.
async function faceMarks(page, count, tag) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qaeyesmarks' + tag + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  await page.evaluate((n) => window.__gifosVideo.seedGalleryForTest({ count: n, connected: true }), count);
  await page.waitForFunction((n) => document.querySelectorAll('#feed .tile:not(.me) > .blurbox.on').length >= n, count);
  await page.waitForFunction(() => document.querySelector('#feed .chips [data-icon="mic-off"]') && document.querySelector('#feed .chips [data-icon="cam-off"]'));
  // Point at each face that has a mark: its buttons (Mute and Blur for
  // everyone, Blur for all) must not cover the words.
  const covered = [];
  const faces = page.locator('#feed .tile:not(.me):has(.chips [data-icon])');
  for (let i = 0; i < await faces.count(); i++) {
    const fb = await faces.nth(i).boundingBox();
    if (!fb) continue;
    await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
    await page.waitForTimeout(400);
    covered.push(...await faces.nth(i).evaluate((tile) => {
      const seen = (el) => { const cs = getComputedStyle(el); return el.getClientRects().length && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5; };
      const btns = [...tile.querySelectorAll(':scope > .blurbox, .modbar button')].filter(seen);
      const out = [];
      for (const m of tile.querySelectorAll('.chips [data-icon]')) {
        const mb = m.getBoundingClientRect();
        for (const el of btns) {
          const r = el.getBoundingClientRect();
          if (Math.max(0, Math.min(mb.right, r.right) - Math.max(mb.left, r.left)) * Math.max(0, Math.min(mb.bottom, r.bottom) - Math.max(mb.top, r.top)) > 1) out.push((m.innerText || m.getAttribute('data-icon')).trim() + ' under ' + el.textContent.trim());
        }
      }
      return out;
    }));
  }
  expect(covered, 'marks under a pointed face\'s buttons').toEqual([]);
  await page.mouse.move(640, 300);
  await page.waitForTimeout(400);
  return page.evaluate(() => [...document.querySelectorAll('#feed .tile .chips [data-icon]')].filter((m) => m.closest('.tile').getClientRects().length).map((m) => {
    const tile = m.closest('.tile');
    const tb = tile.getBoundingClientRect();
    const mb = m.getBoundingClientRect();
    const row = m.parentElement.getBoundingClientRect();
    const name = tile.querySelector('.name');
    const nb = name && name.getClientRects().length ? name.getBoundingClientRect() : null;
    const word = (m.innerText || '').trim();
    const over = nb && Math.max(0, Math.min(mb.right, nb.right) - Math.max(mb.left, nb.left)) * Math.max(0, Math.min(mb.bottom, nb.bottom) - Math.max(mb.top, nb.top)) > 1;
    return {
      who: (tile.classList.contains('me') ? 'me' : (name && name.textContent || '').trim()) + ' ' + m.getAttribute('data-icon'),
      word,
      font: word ? parseFloat(getComputedStyle([...m.querySelectorAll('*')].find((el) => (el.innerText || '').trim() === word) || m).fontSize) : 0,
      whole: mb.right <= row.right + 1 && mb.left >= row.left - 1 && m.scrollWidth <= m.clientWidth + 1,
      inside: mb.left >= tb.left - 1 && mb.right <= tb.right + 1 && mb.top >= tb.top - 1 && mb.bottom <= tb.bottom + 1,
      clearOfName: !over,
    };
  }));
}

test('the mute and camera marks on a face say their word at 16px', async ({ context }) => {
  for (const count of [4, 8]) {
    const page = await context.newPage();
    const marks = await faceMarks(page, count, String(count));
    if (count === 4) await page.screenshot({ path: 'test/desktop/shots/face-marks-after-1280.png' });
    const want = { 'mic-off': 'Muted', 'cam-off': 'Camera off' };
    expect(marks.length, 'room of ' + (count + 1)).toBeGreaterThanOrEqual(2);
    for (const m of marks) {
      const kind = m.who.split(' ').pop();
      expect({ who: m.who, word: m.word, bigEnough: m.font >= 16, whole: m.whole, inside: m.inside, clearOfName: m.clearOfName }, 'room of ' + (count + 1))
        .toEqual({ who: m.who, word: want[kind], bigEnough: true, whole: true, inside: true, clearOfName: true });
    }
    await page.close();
  }
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });
  test('the mute and camera marks on a face say their word', async ({ page }) => {
    const marks = await faceMarks(page, 4, 'de');
    const want = { 'mic-off': 'Stumm', 'cam-off': 'Kamera aus' };
    for (const m of marks) {
      const kind = m.who.split(' ').pop();
      expect({ who: m.who, word: m.word, bigEnough: m.font >= 16, whole: m.whole }).toEqual({ who: m.who, word: want[kind], bigEnough: true, whole: true });
    }
  });
});
