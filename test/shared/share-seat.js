// Where a share sits in a meeting (0.9.23b, Nathan 19:02): an app and a shared
// screen take the same seat. Sideways (a laptop, or a phone turned on its side)
// the share is the whole left side and the people stand on the right; upright
// it is the top band and the people are under it. Waking the call's buttons
// moves neither the share nor a face (17:44).
// test/desktop/run-app.spec.js (an app) and test/desktop/share-demo.spec.js
// (a screen) run these at the same sizes.
const PIXEL_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

const SEAT_VIEWS = [
  { tag: 'laptop-1280x800', width: 1280, height: 800, phone: false },
  { tag: 'phone-844x390', width: 844, height: 390, phone: true },
  { tag: 'phone-915x412', width: 915, height: 412, phone: true },
  { tag: 'phone-390x844', width: 390, height: 844, phone: true },
];

async function seatPage(browser, browserName, view, room) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: view.width, height: view.height } },
    view.phone ? { hasTouch: true, userAgent: PIXEL_UA, isMobile: browserName !== 'firefox' } : {}));
  if (browserName === 'webkit') await ctx.addInitScript(() => { window.GIFOS_ED_FORCE_JS = true; });
  await ctx.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  const page = await ctx.newPage();
  await page.goto('/run.html#v=' + room + Date.now().toString(36) + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'attached' });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: true }));
  if (!seeded || !seeded.ok) throw new Error('could not seat the guests');
  return { ctx, page };
}

// kind: 'app' reads #apppane, 'screen' reads the Stage strip.
function readSeat(page, kind) {
  return page.evaluate((k) => {
    const box = (el) => {
      if (!el || !el.getClientRects().length || getComputedStyle(el).display === 'none') return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
    };
    const share = box(k === 'app' ? document.getElementById('apppane') : document.querySelector('#stagefeed [data-row="sgs"]'));
    const faces = [...document.querySelectorAll('#feed .tile[data-comfy="1"]')].map((t) => {
      const n = t.querySelector('.name');
      return Object.assign({ key: (n && n.textContent.trim()) || t.dataset.peer || '' }, box(t));
    }).filter((f) => f.w > 0);
    return { share, faces, away: document.body.classList.contains('chrome-away'), vw: innerWidth, vh: innerHeight };
  }, kind);
}

// Faces at rest: nothing moved for a whole second.
async function settled(page, kind) {
  let last = JSON.stringify(await readSeat(page, kind));
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000);
    const now = JSON.stringify(await readSeat(page, kind));
    if (now === last) return true;
    last = now;
  }
  return false;
}

// A tap (or a mouse move) on empty call space, never on the share. Under the
// 16:42 rule (f0390c4) faces fill the screen, so a phone with no empty space
// left taps the middle of a face instead: a tap on the picture wakes the
// controls and does not open the face's window (UI-0010, ddd6e19).
async function wake(page, view) {
  if (!view.phone) { await page.mouse.move(view.width / 2, view.height - 8); await page.mouse.move(view.width / 2 - 20, view.height - 12); return true; }
  const pt = await page.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    for (const [x, y] of [[W - 12, H - 60], [W / 2, H - 140], [W - 12, H / 2], [12, H - 12]]) {
      const el = document.elementFromPoint(x, y);
      if (el && (el.id === 'feed' || el === document.body || el === document.documentElement)) return [Math.round(x), Math.round(y)];
    }
    for (const t of document.querySelectorAll('#feed .tile[data-comfy="1"]')) {
      const r = t.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const el = document.elementFromPoint(x, y);
      if (r.width > 40 && r.height > 40 && el && t.contains(el) && !el.closest('button, a, .tile-open, .name')) return [Math.round(x), Math.round(y)];
    }
    return null;
  });
  if (!pt) return false;
  await page.touchscreen.tap(pt[0], pt[1]);
  return true;
}

// What is wrong with where the share and the faces sit, as readable lines.
function seatProblems(seat, view) {
  const bad = [];
  const s = seat.share;
  if (!s || s.w < 50 || s.h < 50) return ['the share has no room: ' + JSON.stringify(s)];
  const sideways = view.width > view.height;
  if (!seat.faces.length) bad.push('no faces on screen');
  if (s.x > 8) bad.push('the share starts ' + Math.round(s.x) + 'px from the left edge');
  if (s.r > view.width + 1 || s.b > view.height + 1) bad.push('the share runs off the screen');
  for (const f of seat.faces) {
    if (sideways && f.x < s.r - 0.5) bad.push(f.key + ' is not right of the share (' + Math.round(f.x) + ' < ' + Math.round(s.r) + ')');
    if (!sideways && f.y < s.b - 0.5) bad.push(f.key + ' is not under the share (' + Math.round(f.y) + ' < ' + Math.round(s.b) + ')');
  }
  // Sideways the share is the left side: it takes most of the width.
  if (sideways && s.w < view.width * 0.6) bad.push('the share is only ' + Math.round(s.w) + 'px of ' + view.width + 'px wide');
  return bad;
}

function moved(before, after) {
  const out = [];
  const same = (p, q) => p && q && ['x', 'y', 'w', 'h'].every((k) => Math.abs(p[k] - q[k]) <= 0.5);
  if (!same(before.share, after.share)) out.push('share ' + JSON.stringify(before.share) + ' -> ' + JSON.stringify(after.share));
  for (const f of before.faces) {
    const g = after.faces.find((x) => x.key === f.key);
    if (!same(f, g)) out.push(f.key + ' moved');
  }
  return out;
}

// Seat, settle, tuck the buttons, wake them: returns everything a test asserts.
async function seatAndWake(page, view, kind) {
  const rest1 = await settled(page, kind);
  await page.evaluate(() => window.__gifosChrome && window.__gifosChrome.idle());
  await page.waitForTimeout(400);
  const rest2 = await settled(page, kind);
  const calm = await readSeat(page, kind);
  const woke = await wake(page, view);
  await page.waitForTimeout(80);
  const quick = await readSeat(page, kind);
  await page.waitForTimeout(1200);
  const after = await readSeat(page, kind);
  return {
    rested: rest1 && rest2, woke, calm, after,
    problems: seatProblems(calm, view),
    moved: moved(calm, quick).concat(moved(calm, after)),
  };
}

module.exports = { SEAT_VIEWS, seatPage, readSeat, seatAndWake, seatProblems };
