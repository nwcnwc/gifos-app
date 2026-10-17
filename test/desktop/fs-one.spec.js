const { test, expect } = require('@playwright/test');

// One Full screen button for the whole screen (Nathan 2026-10-17): no tile
// carries its own full-screen button or tip; the dock (or More, when the dock
// is full) has exactly one, and it opens the full-screen view, where the
// strip still switches the big picture between people.
// FS_SHOT=before names the pictures for a base run.
const SHOT = process.env.FS_SHOT || 'after';

async function boot(page, width, height, hash, name) {
  await page.setViewportSize({ width: width, height: height });
  await page.addInitScript((nm) => { localStorage.setItem('gifos_name', nm); sessionStorage.setItem('gifos_appeared', '1'); }, name || 'Jordan Lee');
  await page.goto('/run.html#' + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
}

async function seed(page, n) {
  const seeded = await page.evaluate((n) => window.__gifosVideo.seedGalleryForTest({ count: n, connected: true }), n);
  expect(seeded && seeded.ok).toBe(true);
  await page.waitForFunction((n) => document.querySelectorAll('#feed .tile').length >= n, n);
}

// Every full-screen entry on a face: the old ⛶ button, or anything inside a
// tile that says Full screen in its name or tip.
async function tileEntries(page) {
  return page.evaluate(() => {
    const out = [];
    for (const t of document.querySelectorAll('.tile')) {
      for (const el of t.querySelectorAll('.maxbtn, [aria-label], [title]')) {
        const said = ((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '')).toLowerCase();
        if (el.classList.contains('maxbtn') || said.includes('full screen')) out.push((t.dataset.id || t.id || 'tile') + ':' + (el.className || el.tagName));
      }
    }
    return out;
  });
}

// The whole-screen controls a person can reach: shown on the dock, or shown
// in More once it is open. The app bar's own Full screen is not part of this.
async function wholeControls(page) {
  return page.evaluate(() => {
    const seen = (el) => {
      if (!el || !el.getClientRects().length) return false;
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      }
      return true;
    };
    const out = [];
    for (const el of document.querySelectorAll('.bar button, .bar [role="button"]')) {
      if (el.closest('.tile') || el.closest('#fsview')) continue;
      const said = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).replace(/\s+/g, ' ').trim().toLowerCase();
      if (!said.includes('full screen')) continue;
      if (seen(el)) out.push(el.id || ('more:' + (el.dataset.dock || el.className)));
    }
    return out;
  });
}

// Find the one control: on the dock, or open More and find it there.
async function reachControl(page) {
  let got = await wholeControls(page);
  if (got.length === 0) {
    const more = await page.$('#bartoggle');
    if (more) { await more.click(); got = await wholeControls(page); }
  }
  return got;
}

async function viewState(page) {
  return page.evaluate(() => {
    const v = document.getElementById('fsview');
    const m = document.getElementById('fsmain');
    const a = document.activeElement;
    return {
      on: !!(v && v.classList.contains('on')),
      main: m ? (m.dataset.key || '') : '',
      thumbs: v ? [...v.querySelectorAll('#fsstrip .fsthumb')].map((t) => t.dataset.key) : [],
      focus: a ? (a.id || a.className || a.tagName) : '',
    };
  });
}

async function pressControl(page, id) {
  if (id === 'fsbtn') await page.click('#fsbtn');
  else await page.click('.bar .dockmore[data-dock="fsbtn"]');
}

async function closedOut(page) {
  await page.waitForFunction(() => !document.getElementById('fsview').classList.contains('on'));
  await page.waitForFunction(() => !document.fullscreenElement);
}

// (a) + (b) + (c) in a Meet room of four (me and three), at one size.
async function meetCase(page, width, height, shot) {
  await boot(page, width, height, 'v=qafsone&debug=on');
  await seed(page, 3);
  await page.mouse.move(width / 2, height / 3);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test/desktop/shots/fsone-' + SHOT + '-' + shot + '.png' });

  const onTiles = await tileEntries(page);
  const controls = await reachControl(page);
  expect({ onTiles, controls }).toEqual({ onTiles: [], controls: [expect.any(String)] });

  await pressControl(page, controls[0]);
  await page.waitForFunction(() => document.getElementById('fsview').classList.contains('on'));
  await page.waitForFunction(() => document.querySelectorAll('#fsstrip .fsthumb').length >= 3);
  const open = await viewState(page);
  const pick = open.thumbs.find((k) => k.startsWith('peer:') && k !== open.main);
  expect(pick, 'a person in the strip').toBeTruthy();
  await page.click('#fsstrip .fsthumb[data-key="' + pick + '"]');
  await page.waitForFunction((k) => document.getElementById('fsmain').dataset.key === k, pick);
  const other = (await viewState(page)).thumbs.find((k) => k.startsWith('peer:') && k !== pick);
  await page.click('#fsstrip .fsthumb[data-key="' + other + '"]');
  await page.waitForFunction((k) => document.getElementById('fsmain').dataset.key === k, other);

  // ✕ closes it.
  await page.click('#fsclose');
  await closedOut(page);

  // F opens it and F again closes it; Escape closes it too.
  await page.keyboard.press('f');
  await page.waitForFunction(() => document.getElementById('fsview').classList.contains('on'));
  await page.keyboard.press('f');
  await closedOut(page);
  await page.keyboard.press('f');
  await page.waitForFunction(() => document.getElementById('fsview').classList.contains('on'));
  await page.keyboard.press('Escape');
  await closedOut(page);
  expect((await viewState(page)).on).toBe(false);
}

test('desktop Meet: one Full screen button for the whole screen, none on a face', async ({ page }) => {
  await meetCase(page, 1280, 720, 'meet-1280');
});

test('phone Meet: one Full screen button for the whole screen, none on a face', async ({ page }) => {
  await meetCase(page, 390, 844, 'meet-phone');
});

test('Broadcast desktop: one Full screen button on the dock, none on a face', async ({ page }) => {
  await boot(page, 1280, 720, 'v=qafsbc&av=0123456789abcdef&bc=1&debug=on', 'Pastor Kim');
  const armed = await page.evaluate(() => window.__gifosVideo.armBroadcastHostForTest());
  expect(armed && armed.ok).toBe(true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test/desktop/shots/fsone-' + SHOT + '-bcast-1280.png' });
  const onTiles = await tileEntries(page);
  const controls = await reachControl(page);
  expect({ onTiles, controls }).toEqual({ onTiles: [], controls: ['fsbtn'] });
  await page.click('#fsbtn');
  await page.waitForFunction(() => document.getElementById('fsview').classList.contains('on'));
  await page.click('#fsclose');
  await closedOut(page);
});
