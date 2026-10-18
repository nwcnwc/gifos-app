// 0.9.23b broadcast, one design at every screen size: the start time with a
// countdown and Add to calendar, Visit, "has ended", Stream to friends, Start
// a town hall, and the host's panels laid out on screen without covering each
// other or the call buttons, fading with the calm screen.
// The host's start time and Visit link reach a viewer through the host's
// status (the normal fan-out); here a seeded host stands in for it.
// test/mobile/broadcast-23b.spec.mjs and test/desktop/broadcast-23b.spec.mjs
// run these same cases at phone and desktop sizes.
export function broadcastCases(test, expect) {
const AV = '0123456789abcdef0123456789abcdef';

async function viewer(page) {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Ruth');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qabc23b' + Date.now().toString(36) + '&av=' + AV + '&bc=1&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.seedGalleryForTest);
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 1, names: ['Pastor Kim'] }));
  expect(seeded && seeded.ok).toBe(true);
}
const card = (page) => page.evaluate(() => ({
  on: !document.getElementById('bc-ended').hidden,
  text: document.getElementById('bc-ended-txt').textContent,
  cal: !document.getElementById('bc-cal').hidden,
  ics: document.getElementById('bc-cal').download || '',
  visit: document.getElementById('bc-visit').hidden ? '' : document.getElementById('bc-visit').getAttribute('href'),
}));

test('a viewer early for a service reads when it starts, a countdown, Add to calendar and Visit', async ({ page }) => {
  await viewer(page);
  const at = Math.floor(Date.now() / 1000) + 2 * 3600 + 5 * 60;
  await page.evaluate((a) => window.__gifosVideo.setPeerStatusForTest('qa1', { bcat: a, bcvisit: 'https://example.org/church' }), at);
  await expect.poll(async () => (await card(page)).text, { timeout: 15000 }).toMatch(/^The service starts .+ · in 2 h [0-9]+ min\.$/);
  const c = await card(page);
  expect(c.on).toBe(true);
  expect(c.cal).toBe(true);
  expect(c.ics).toMatch(/\.ics$/);
  expect(c.visit).toBe('https://example.org/church');
});

test('a viewer whose service has ended sees only the clear stage', async ({ page }) => {
  await viewer(page);
  await page.evaluate(() => window.__gifosVideo.setPeerStatusForTest('qa1', { bcend: Date.now() }));
  await expect.poll(async () => (await card(page)).on, { timeout: 15000 }).toBe(false);
  await expect.poll(async () => page.locator('#bc-stage-line').textContent(), { timeout: 15000 }).toBe('The stage is clear.');
  expect((await card(page)).cal).toBe(false);
});

test('Stream to friends is a stream lobby: the same Go live, friendlier words', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Sam'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html#bc=1&st=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#lobby h1')).toHaveText('Stream');
  await expect(page).toHaveTitle('Stream — GifOS');
  await expect(page.locator('#lob-admin-name')).toHaveValue('Friday night');
});

test('the lobby starts a town hall: the room link carries th=1', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Sam'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#lob-th-btn')).toBeVisible();
  await expect(page.locator('#lob-stream')).toBeVisible();
  await page.locator('#lob-th-btn').click();
  await expect(page.locator('#lobby h1')).toHaveText('Town hall');
  await page.fill('#lob-admin-name', 'Budget ' + Date.now().toString(36));
  await page.locator('#lob-admin-go').click();
  await page.waitForURL(/[#&]th=1/, { timeout: 20000 });
});

// The host's own broadcast screen: an admin room host (the admin key derived
// the way the lobby stores it) alone on a service.
async function host(page) {
  const room = 'qabch' + Date.now().toString(36);
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Ava Stone'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GifOS && GifOS.net && GifOS.net.edKeysFromSeedHex);
  const av = await page.evaluate(async (roomId) => {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode('admin-pass-1'), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode('gifos-admin:' + roomId), iterations: 310000 }, km, 256);
    const K = Array.from(new Uint8Array(bits)).map((x) => x.toString(16).padStart(2, '0')).join('');
    const V = (await GifOS.net.edKeysFromSeedHex(K)).verifier;
    localStorage.setItem('gifos_vadm_' + roomId + '.' + V, K);
    return V;
  }, room);
  // Only the hash changes, so load the page again for the room to start.
  await page.goto('/run.html#v=' + room + '&av=' + av + '&bc=1&debug=on', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toHaveClass(/bc-host/, { timeout: 20000 });
  await expect(page.locator('#bc-link')).toHaveClass(/\bon\b/, { timeout: 20000 });
  await expect(page.locator('#rundown')).toBeVisible();
  // Go live keeps the service: the recording starts and its card (the
  // consent everyone sees) comes up; the host reads it and closes it.
  const ok = page.locator('#rec-notice-ok');
  await ok.waitFor({ state: 'visible', timeout: 15000 }).then(() => ok.click(), () => {});
}

const boxes = (page) => page.evaluate(() => {
  const out = {};
  for (const s of ['#bc-link', '#rundown', '#callstate', '.bar']) {
    const e = document.querySelector(s);
    if (!e) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || !e.getClientRects().length) continue;
    const r = e.getBoundingClientRect();
    out[s] = { x: r.x, y: r.y, r: r.right, b: r.bottom, op: +cs.opacity };
  }
  return { out, w: innerWidth, h: innerHeight };
});

async function noCover(page, tag) {
  await page.mouse.move(40, 40); await page.mouse.move(60, 60);
  await page.waitForTimeout(800);
  await page.screenshot({ path: test.info().outputPath('host-' + tag + '.png') });
  const { out, w, h } = await boxes(page);
  // Nothing makes the page wider than the screen (a phone would zoom out).
  expect(w, tag + ': page width').toBeLessThanOrEqual(page.viewportSize().width);
  const names = Object.keys(out);
  expect(names).toEqual(expect.arrayContaining(['#bc-link', '#rundown', '.bar']));
  for (const n of names) {
    const b = out[n];
    expect(b.x >= -0.5 && b.y >= -0.5 && b.r <= w + 0.5 && b.b <= h + 0.5, tag + ': ' + n + ' is on screen').toBe(true);
  }
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = out[names[i]], b = out[names[j]];
    const hit = a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;
    expect(hit, tag + ': ' + names[i] + ' covers ' + names[j]).toBe(false);
  }
}

test('the host sees the link, the Order of service and the call buttons on screen, none covering another', async ({ page }) => {
  await host(page);
  await noCover(page, 'upright');
  // A phone turned sideways: the same screen, the other way round.
  if (test.info().project.use.hasTouch) {
    const v = page.viewportSize();
    await page.setViewportSize({ width: v.height, height: v.width });
    await noCover(page, 'sideways');
  }
});

test('the host’s panels fade with the calm screen and come back on a move', async ({ page }) => {
  await host(page);
  // Alone, the host keeps the link up to invite people; with one viewer in
  // the room the screen goes calm.
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 1, names: ['Ruth'], connected: true }));
  await page.mouse.move(40, 40);
  await expect.poll(async () => (await boxes(page)).out['#rundown'].op, { timeout: 12000 }).toBe(0);
  expect((await boxes(page)).out['#bc-link'].op).toBe(0);
  // A finger on a phone, the mouse on a computer.
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(page.viewportSize().width - 12, page.viewportSize().height / 2);
  else { await page.mouse.move(200, 200); await page.mouse.move(220, 210); }
  await expect.poll(async () => (await boxes(page)).out['#rundown'].op, { timeout: 4000 }).toBe(1);
});

test('the Stage has no plain "On stage" tag on a broadcast', async ({ page }) => {
  await host(page);
  await expect(page.locator('#stagefeed .rowtile .rlabel:not(.sharelabel):visible')).toHaveCount(0);
});
}
