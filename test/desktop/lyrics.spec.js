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

async function lyricBox(page) {
  return page.evaluate(() => {
    const el = document.getElementById('lyrics');
    const air = document.getElementById('onair');
    const dock = document.querySelector('.bar');
    const run = document.getElementById('rundown');
    if (!el) return { missing: true };
    const cs = getComputedStyle(el);
    const er = el.getBoundingClientRect();
    const ar = air ? air.getBoundingClientRect() : null;
    const d = dock ? dock.getBoundingClientRect() : null;
    const rr = run ? run.getBoundingClientRect() : null;
    const airOn = air && getComputedStyle(air).display !== 'none';
    const runOn = run && getComputedStyle(run).display !== 'none';
    const overlap = (a, b) => !!(a && b && a.width > 8 && b.width > 8 && a.bottom > b.top + 4 && a.top < b.bottom - 4 && a.right > b.left + 4 && a.left < b.right - 4);
    const program = document.getElementById('lyrics-program');
    const preview = document.getElementById('lyrics-preview');
    const pr = program ? program.getBoundingClientRect() : null;
    return {
      missing: false,
      display: cs.display,
      programK: (document.getElementById('lyrics-program-k') || {}).textContent || '',
      previewK: (document.getElementById('lyrics-preview-k') || {}).textContent || '',
      program: program ? program.textContent.trim() : '',
      preview: preview ? preview.textContent.trim() : '',
      programFont: program ? parseFloat(getComputedStyle(program).fontSize) : 0,
      previewFont: preview ? parseFloat(getComputedStyle(preview).fontSize) : 0,
      programKFont: document.getElementById('lyrics-program-k') ? parseFloat(getComputedStyle(document.getElementById('lyrics-program-k')).fontSize) : 0,
      previewKFont: document.getElementById('lyrics-preview-k') ? parseFloat(getComputedStyle(document.getElementById('lyrics-preview-k')).fontSize) : 0,
      clipped: program ? program.scrollWidth > program.clientWidth + 1 : true,
      onScreen: er.width > 8 && er.left >= -1 && er.right <= window.innerWidth + 1 && er.top >= -1 && er.bottom <= window.innerHeight + 1,
      lineOnScreen: !!(pr && pr.width > 8 && pr.left >= -1 && pr.right <= window.innerWidth + 1 && pr.top >= er.top - 1 && pr.bottom <= er.bottom + 1),
      coversDock: overlap(er, d),
      coversAir: airOn ? overlap(er, ar) : false,
      coversRundown: runOn ? overlap(er, rr) : false,
      next: (document.getElementById('lyrics-next') || {}).textContent || '',
    };
  });
}

test('a normal meeting has no lyrics card', async ({ page }) => {
  await boot(page, 'v=qameet&debug=on');
  const b = await lyricBox(page);
  expect(b.missing).toBe(false);
  expect(b.display).toBe('none');
});

test('a broadcast viewer does not see program or preview', async ({ page }) => {
  await boot(page, 'v=qalyric&av=0123456789abcdef&bc=1&debug=on');
  const b = await lyricBox(page);
  expect(b.missing).toBe(false);
  expect(b.display).toBe('none');
});

test('the booth reads the current line and the next one', async ({ page }) => {
  await boot(page, 'v=qalyric&av=0123456789abcdef&bc=1&debug=on');
  const armed = await page.evaluate(() => window.__gifosVideo.armBroadcastHostForTest());
  expect(armed && armed.ok).toBe(true);

  const welcome = await lyricBox(page);
  expect(welcome.display).toBe('none');

  await page.click('#rundown-next');
  const song = await lyricBox(page);
  expect(song.display).not.toBe('none');
  expect(song.programK).toBe('Program');
  expect(song.previewK).toBe('Preview');
  expect(song.program).toBe('Amazing grace, how sweet the sound');
  expect(song.preview).toBe('That saved a wretch like me');
  expect(song.programFont).toBeGreaterThanOrEqual(28);
  expect(song.previewFont).toBeLessThan(song.programFont);
  expect(song.previewFont).toBeGreaterThanOrEqual(16);
  expect(song.programKFont).toBeGreaterThanOrEqual(16);
  expect(song.previewKFont).toBeGreaterThanOrEqual(16);
  expect(song.clipped).toBe(false);
  expect(song.onScreen).toBe(true);
  expect(song.lineOnScreen).toBe(true);
  expect(song.coversDock).toBe(false);
  expect(song.coversAir).toBe(false);
  expect(song.coversRundown).toBe(false);
  expect(song.next).toBe('Next line');

  await page.click('#lyrics-next');
  const second = await lyricBox(page);
  expect(second.program).toBe('That saved a wretch like me');
  expect(second.preview).toBe('I once was lost, but now am found');

  await page.click('#lyrics-next');
  await page.click('#lyrics-next');
  const last = await lyricBox(page);
  expect(last.program).toBe('Was blind, but now I see.');
  expect(last.preview).toBe('');
  expect(last.next).toBe('Start over');
  expect(last.onScreen).toBe(true);
  expect(last.coversDock).toBe(false);
  expect(last.coversAir).toBe(false);
  expect(last.coversRundown).toBe(false);

  await page.click('#lyrics-next');
  const again = await lyricBox(page);
  expect(again.program).toBe('Amazing grace, how sweet the sound');
  expect(again.next).toBe('Next line');

  await page.click('#rundown-next');
  const prayer = await lyricBox(page);
  expect(prayer.display).toBe('none');

  await page.setViewportSize({ width: 900, height: 720 });
  for (let i = 0; i < 6; i++) await page.click('#rundown-next');
  const narrow = await lyricBox(page);
  expect(narrow.program).toBe('Amazing grace, how sweet the sound');
  expect(narrow.clipped).toBe(false);
  expect(narrow.onScreen).toBe(true);
  expect(narrow.coversDock).toBe(false);
  expect(narrow.coversAir).toBe(false);
  expect(narrow.coversRundown).toBe(false);

  await page.setViewportSize({ width: 1100, height: 600 });
  const short = await lyricBox(page);
  expect(short.program).toBe('Amazing grace, how sweet the sound');
  expect(short.programFont).toBeGreaterThanOrEqual(28);
  expect(short.previewFont).toBeGreaterThanOrEqual(16);
  expect(short.previewFont).toBeLessThan(short.programFont);
  expect(short.lineOnScreen).toBe(true);
  expect(short.coversAir).toBe(false);
  expect(short.coversDock).toBe(false);
  expect(short.coversRundown).toBe(false);
});

test.describe('German lyrics chrome', () => {
  test.use({ locale: 'de-DE' });
  test('Program and Preview follow a German device', async ({ page }) => {
    await boot(page, 'v=qalyricde&av=0123456789abcdef&bc=1&debug=on');
    await page.evaluate(() => window.__gifosVideo.armBroadcastHostForTest());
    await page.click('#rundown-next');
    const b = await lyricBox(page);
    expect(b.programK).toBe('Programm');
    expect(b.previewK).toBe('Vorschau');
    expect(b.next).toBe('Nächste Zeile');
    expect(b.program).toBe('Amazing grace, how sweet the sound');
    expect(b.programFont).toBeGreaterThanOrEqual(28);
  });
});

test.describe('Spanish lyrics chrome', () => {
  test.use({ locale: 'es-MX' });
  test('Program and Preview follow a Spanish device', async ({ page }) => {
    await boot(page, 'v=qalyrices&av=0123456789abcdef&bc=1&debug=on');
    await page.evaluate(() => window.__gifosVideo.armBroadcastHostForTest());
    await page.click('#rundown-next');
    const b = await lyricBox(page);
    expect(b.programK).toBe('Programa');
    expect(b.previewK).toBe('Vista previa');
    expect(b.next).toBe('Siguiente línea');
    expect(b.program).toBe('Amazing grace, how sweet the sound');
  });
});

// What leaves the booth: the self tile plays exactly the track that is sent.
// The camera is one flat color, so any near-white pixel in the lower part of
// the frame is a word painted onto the picture.
async function outgoingWords(page) {
  return page.evaluate(async () => {
    const v = document.querySelector('.tile.me video');
    if (!v || !v.videoWidth) return { ok: false, white: 0, top: 0 };
    await new Promise((r) => setTimeout(r, 400));
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const x = c.getContext('2d');
    x.drawImage(v, 0, 0, c.width, c.height);
    const band = x.getImageData(0, Math.floor(c.height * 0.6), c.width, c.height - Math.floor(c.height * 0.6)).data;
    const upper = x.getImageData(0, 0, c.width, Math.floor(c.height * 0.4)).data;
    const count = (d) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 220 && d[i + 1] > 220 && d[i + 2] > 220) n++; return n; };
    return { ok: true, white: count(band), top: count(upper), w: c.width, h: c.height };
  });
}

for (const blur of [2, 0]) {
  test(`during Song the current line is on the picture the room sees (blur ${blur})`, async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
    await boot(page, `v=qalyricair${blur}&av=0123456789abcdef&bc=1&debug=on`);
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () => {
        const c = document.createElement('canvas');
        c.width = 640; c.height = 360;
        c.style.cssText = 'position:fixed;left:-4000px;top:0';
        document.body.appendChild(c);
        const x = c.getContext('2d');
        // Repaint so the capture keeps sending frames.
        setInterval(() => { x.fillStyle = '#c45b3e'; x.fillRect(0, 0, 640, 360); }, 100);
        x.fillStyle = '#c45b3e'; x.fillRect(0, 0, 640, 360);
        return Promise.resolve(c.captureStream(8));
      };
    });
    const armed = await page.evaluate(() => window.__gifosVideo.armBroadcastHostForTest());
    expect(armed && armed.ok).toBe(true);
    await page.click('#cam');
    if (blur === 0) await page.evaluate(() => window.__gifosVideo.setClearForTest(true));
    await expect.poll(() => page.evaluate(() => { const v = document.querySelector('.tile.me video'); return !!(v && v.videoWidth); })).toBe(true);

    const welcome = await outgoingWords(page);
    expect(welcome.ok).toBe(true);
    expect(welcome.white).toBe(0);

    await page.click('#rundown-next');
    await expect.poll(async () => (await outgoingWords(page)).white).toBeGreaterThan(40);
    const song = await outgoingWords(page);
    // The words sit low on the picture, clear of a face.
    expect(song.top).toBe(0);
    await page.screenshot({ path: `test/desktop/shots/lyrics-air-blur${blur}-1280.png` });

    await page.click('#rundown-next');
    await expect.poll(async () => (await outgoingWords(page)).white).toBe(0);
  });
}
