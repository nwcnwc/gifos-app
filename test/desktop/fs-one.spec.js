const { test, expect } = require('@playwright/test');

// One Full screen button for the whole screen (Nathan 2026-10-17): no tile
// carries its own full-screen button or tip; the dock (or More, when the dock
// is full) has exactly one, and it opens the full-screen view, where the
// strip still switches the big picture between people.
// FS_SHOT=before names the pictures for a base run.
const SHOT = process.env.FS_SHOT || 'after';

async function boot(page, width, height, hash, name) {
  await page.setViewportSize({ width: width, height: height });
  await page.addInitScript((nm) => {
    localStorage.setItem('gifos_name', nm); sessionStorage.setItem('gifos_appeared', '1');
    window.__fsChangeAt = 0;
    document.addEventListener('fullscreenchange', () => { window.__fsChangeAt = Date.now(); }, true);
  }, name || 'Jordan Lee');
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
// The call goes calm 3 s after the last move (0.9.23b) and a move wakes it,
// so reach for a control the way a person does: move onto it, then press.
// A slow engine (WebKit) spends those 3 s on the screenshot alone.
// In a narrow window the quiet call also slides the dock off the bottom,
// and only a tap brings it back (a move does not), so tap the faces first,
// as a person would; the page swallows that tap, so no face's window opens.
async function moveOnto(page, sel) {
  const vp = page.viewportSize();
  if (await page.evaluate(() => document.body.classList.contains('chrome-away'))) {
    await page.mouse.click(vp.width / 2, vp.height / 2);
    await page.waitForFunction(() => !document.body.classList.contains('chrome-away'));
  }
  const b = sel ? await page.locator(sel).first().boundingBox() : null;
  const x = b ? b.x + b.width / 2 : vp.width / 2, y = b ? b.y + b.height / 2 : vp.height / 3;
  await page.mouse.move(x - 3, y - 3);
  await page.mouse.move(x, y, { steps: 2 });
  await page.waitForTimeout(150);
}

async function reachControl(page) {
  await moveOnto(page);
  let got = await wholeControls(page);
  if (got.length === 0) {
    const more = await page.$('#bartoggle');
    if (more) { await moveOnto(page, '#bartoggle'); await more.click(); got = await wholeControls(page); }
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
  const sel = id === 'fsbtn' ? '#fsbtn' : '.bar .dockmore[data-dock="fsbtn"]';
  await moveOnto(page, sel);
  await page.click(sel);
}

// Let the browser's full screen finish changing before the next key, as a
// person would: Firefox swallows a key in the ~40 ms its change takes, and
// sends a second change event after document.fullscreenElement settles.
async function quiet(page) {
  await page.waitForFunction(() => Date.now() - window.__fsChangeAt > 250);
}

// 0.9.23b: Full screen takes the whole page (the meeting as laid out).
// Only an engine with no element full screen gets the in-page view.
async function openedUp(page) {
  await page.waitForFunction(() => document.fullscreenElement === document.documentElement || document.getElementById('fsview').classList.contains('on'));
  await quiet(page);
}

async function closedOut(page) {
  await page.waitForFunction(() => !document.fullscreenElement && !document.getElementById('fsview').classList.contains('on'));
  await quiet(page);
}

async function closeIt(page) {
  if (await page.evaluate(() => document.getElementById('fsview').classList.contains('on'))) await page.click('#fsclose');
  else await page.evaluate(() => document.exitFullscreen());
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
  await openedUp(page);
  // The meeting stays laid out as it was: every face is still on the page.
  expect(await page.evaluate(() => document.querySelectorAll('#feed .tile[data-comfy="1"]').length)).toBeGreaterThanOrEqual(4);
  await closeIt(page);
  await closedOut(page);

  // F opens it and F again closes it; Escape closes it too.
  await page.keyboard.press('f');
  await openedUp(page);
  await page.keyboard.press('f');
  await closedOut(page);
  await page.keyboard.press('f');
  await openedUp(page);
  await closeIt(page);
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
  await pressControl(page, 'fsbtn');
  await openedUp(page);
  await closeIt(page);
  await closedOut(page);
});
