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

async function lamp(page) {
  return page.evaluate(() => {
    const el = document.getElementById('onair');
    if (!el) return { missing: true };
    // The lamp is the top-chip pill (confirmed design): a lamp dot and words.
    const word = el.querySelector('.words');
    const note = null;
    const who = null;
    const cs = getComputedStyle(el);
    const wcs = word ? getComputedStyle(word) : null;
    const er = el.getBoundingClientRect();
    const dock = document.querySelector('.bar');
    const d = dock ? dock.getBoundingClientRect() : null;
    return {
      missing: false,
      display: cs.display,
      state: el.hidden ? '' : (el.className || ''),
      word: word ? word.textContent.trim() : '',
      who: who ? who.textContent.trim() : '',
      note: note ? note.textContent.trim() : '',
      noteShown: note ? getComputedStyle(note).display !== 'none' && note.textContent.trim().length > 0 : false,
      font: wcs ? parseFloat(wcs.fontSize) : 0,
      clipped: word ? word.scrollWidth > word.clientWidth + 1 : true,
      onScreen: er.width > 8 && er.left >= -1 && er.right <= window.innerWidth + 1 && er.top >= -1 && er.bottom <= window.innerHeight + 1,
      bg: cs.backgroundColor,
      coversDock: !!(d && er.bottom > d.top + 4 && er.top < d.bottom && er.right > d.left && er.left < d.right && cs.display !== 'none'),
    };
  });
}

test('a normal meeting does not wear an on-air lamp', async ({ page }) => {
  await boot(page, 'v=qameet&debug=on');
  const box = await lamp(page);
  expect(box.missing).toBe(false);
  expect(box.display).toBe('none');
});

test('a broadcast stays off air until the camera is live', async ({ page }) => {
  await boot(page, 'v=qaair&av=0123456789abcdef&bc=1&debug=on');
  const off = await lamp(page);
  expect(off.missing).toBe(false);
  expect(off.display).not.toBe('none');
  // Not the host yet: a viewer's lamp reads Watching (confirmed design).
  expect(off.state).toBe('watch');
  expect(off.word).toBe('Watching');
  expect(off.font).toBeGreaterThanOrEqual(12);
  expect(off.clipped).toBe(false);
  expect(off.onScreen).toBe(true);
  expect(off.coversDock).toBe(false);

  const armed = await page.evaluate(() => window.__gifosVideo.armBroadcastHostForTest());
  expect(armed && armed.ok).toBe(true);
  const host = await lamp(page);
  expect(host.state).toBe('off');
  expect(host.word).toBe('Off air');
  expect(host.coversDock).toBe(false);

  await page.evaluate(() => window.__gifosVideo.setCamLiveForTest(true));
  const live = await lamp(page);
  expect(live.state).toBe('live');
  expect(live.word).toBe('Live');
  expect(live.font).toBeGreaterThanOrEqual(12);
  expect(live.clipped).toBe(false);
  expect(live.onScreen).toBe(true);
  expect(live.coversDock).toBe(false);
  expect(live.bg).not.toBe(host.bg);
});
