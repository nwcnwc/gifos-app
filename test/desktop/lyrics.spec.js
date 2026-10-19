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
  expect(song.program).toBe('The first line of the song is the one to sing');
  expect(song.preview).toBe('The next line follows after it');
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
  expect(second.program).toBe('The next line follows after it');
  expect(second.preview).toBe('Each line is one breath long');

  await page.click('#lyrics-next');
  await page.click('#lyrics-next');
  const last = await lyricBox(page);
  expect(last.program).toBe('And the last line ends the song.');
  expect(last.preview).toBe('');
  expect(last.next).toBe('Start over');
  expect(last.onScreen).toBe(true);
  expect(last.coversDock).toBe(false);
  expect(last.coversAir).toBe(false);
  expect(last.coversRundown).toBe(false);

  await page.click('#lyrics-next');
  const again = await lyricBox(page);
  expect(again.program).toBe('The first line of the song is the one to sing');
  expect(again.next).toBe('Next line');

  await page.click('#rundown-next');
  const prayer = await lyricBox(page);
  expect(prayer.display).toBe('none');

  await page.setViewportSize({ width: 900, height: 720 });
  for (let i = 0; i < 7; i++) await page.click('#rundown-next');
  const narrow = await lyricBox(page);
  expect(narrow.program).toBe('The first line of the song is the one to sing');
  expect(narrow.clipped).toBe(false);
  expect(narrow.onScreen).toBe(true);
  expect(narrow.coversDock).toBe(false);
  expect(narrow.coversAir).toBe(false);
  expect(narrow.coversRundown).toBe(false);

  await page.setViewportSize({ width: 1100, height: 600 });
  const short = await lyricBox(page);
  expect(short.program).toBe('The first line of the song is the one to sing');
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
    expect(b.program).toBe('The first line of the song is the one to sing');
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
    expect(b.program).toBe('The first line of the song is the one to sing');
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
    // The room sees this camera as a centered square with the name strip
    // over its bottom 17% (mesh-media.js). Words outside the square are
    // cut off; words in the bottom 18% sit under the name.
    const side = Math.min(c.width, c.height);
    const sx = Math.floor((c.width - side) / 2);
    const strip = Math.ceil(c.height * 0.18);
    let outside = 0;
    if (sx > 0) outside += count(x.getImageData(0, 0, sx, c.height).data) + count(x.getImageData(sx + side, 0, c.width - sx - side, c.height).data);
    const underName = count(x.getImageData(0, c.height - strip, c.width, strip).data);
    return { ok: true, white: count(band), top: count(upper), outside, underName, w: c.width, h: c.height };
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
    // The words sit low on the picture, clear of a face, inside the square
    // the room is shown, and above the name strip.
    expect(song.top).toBe(0);
    expect(song.outside).toBe(0);
    expect(song.underName).toBe(0);
    await page.screenshot({ path: `test/desktop/shots/lyrics-air-blur${blur}-1280.png` });

    await page.click('#rundown-next');
    await expect.poll(async () => (await outgoingWords(page)).white).toBe(0);
  });
}

// A church sings more than one hymn. The booth types its own song before
// or during the service, one line per line, and Song reads it: Program,
// Preview, Next line, and the line painted onto the picture the room sees.
// The words stay on this computer (no extra data to the room).
const OWN_SONG = [
  'Holy, holy, holy! Lord God Almighty!',
  'Early in the morning our song shall rise to Thee;',
  'Holy, holy, holy, merciful and mighty!',
];

test('the booth enters its own song and Song reads it', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await page.addInitScript(() => {
    // Every word drawn onto a canvas: the outgoing picture is one of them.
    window.__painted = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t) {
      window.__painted.push(String(t));
      if (window.__painted.length > 400) window.__painted.splice(0, 200);
      return fill.apply(this, arguments);
    };
  });
  await boot(page, 'v=qalyricown&av=0123456789abcdef&bc=1&debug=on');
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () => {
      const c = document.createElement('canvas');
      c.width = 640; c.height = 360;
      c.style.cssText = 'position:fixed;left:-4000px;top:0';
      document.body.appendChild(c);
      const x = c.getContext('2d');
      setInterval(() => { x.fillStyle = '#c45b3e'; x.fillRect(0, 0, 640, 360); }, 100);
      x.fillStyle = '#c45b3e'; x.fillRect(0, 0, 640, 360);
      return Promise.resolve(c.captureStream(8));
    };
  });
  const armed = await page.evaluate(() => window.__gifosVideo.armBroadcastHostForTest());
  expect(armed && armed.ok).toBe(true);
  await page.click('#cam');
  await page.evaluate(() => window.__gifosVideo.setClearForTest(true));

  // Before the service: the order of service offers the song's words.
  const edit = page.locator('#rundown #song-edit');
  await expect(edit).toBeVisible();
  await expect(edit).toHaveText('Song words');
  const eb = await edit.boundingBox();
  expect(eb.height).toBeGreaterThanOrEqual(44);
  expect(await edit.evaluate((b) => parseFloat(getComputedStyle(b).fontSize))).toBeGreaterThanOrEqual(16);
  await edit.click();
  const text = page.locator('#song-text');
  await expect(text).toBeVisible();
  await expect(text).toBeFocused();
  // It opens on the song the booth would read now.
  expect((await text.inputValue()).split('\n')[0]).toBe('The first line of the song is the one to sing');
  expect(await text.evaluate((t) => parseFloat(getComputedStyle(t).fontSize))).toBeGreaterThanOrEqual(16);
  await page.screenshot({ path: 'test/desktop/shots/own-song-edit-1280.png' });
  // Blank lines and stray spaces do not become lines.
  await text.fill('  ' + OWN_SONG[0] + '  \n\n' + OWN_SONG[1] + '\n   \n' + OWN_SONG[2] + '\n');
  await page.click('#song-save');
  await expect(text).toBeHidden();

  await page.click('#rundown-next');
  const song = await lyricBox(page);
  expect(song.display).not.toBe('none');
  expect(song.program).toBe(OWN_SONG[0]);
  expect(song.preview).toBe(OWN_SONG[1]);
  expect(song.coversAir).toBe(false);
  expect(song.coversDock).toBe(false);
  expect(song.coversRundown).toBe(false);
  // The room sees the booth's own line, not the built-in hymn.
  await expect.poll(() => page.evaluate(() => window.__painted.join(' | '))).toContain('Holy, holy, holy!');
  expect(await page.evaluate(() => window.__painted.join(' | '))).not.toContain('Amazing');
  await page.screenshot({ path: 'test/desktop/shots/own-song-1280.png' });

  await page.click('#lyrics-next');
  await page.click('#lyrics-next');
  const last = await lyricBox(page);
  expect(last.program).toBe(OWN_SONG[2]);
  expect(last.preview).toBe('');
  expect(last.next).toBe('Start over');

  // The song stays for this room after a reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.armBroadcastHostForTest());
  const back = await lyricBox(page);
  expect(back.program).toBe(OWN_SONG[2]);

  // An empty song goes back to the built-in hymn.
  await page.click('#rundown #song-edit');
  await page.locator('#song-text').fill('\n  \n');
  await page.click('#song-save');
  const hymn = await lyricBox(page);
  expect(hymn.program).toBe('The first line of the song is the one to sing');
});

test('a viewer has no song words button', async ({ page }) => {
  await boot(page, 'v=qalyricown2&av=0123456789abcdef&bc=1&debug=on');
  await expect(page.locator('#song-edit')).toBeHidden();
  await expect(page.locator('#song-text')).toBeHidden();
});

// A service sings more than one song: one after Welcome and one after the
// Message. Each has its own words, and Song words opens the one that is on
// now or comes next, so the booth can type the second while the first plays.
const SECOND_SONG = [
  'Be Thou my vision, O Lord of my heart;',
  'Naught be all else to me, save that Thou art.',
];

test('a service has a second song after the Message with its own words', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit closes the tab if a tile plays a canvas capture');
  await page.addInitScript(() => {
    window.__painted = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t) {
      window.__painted.push(String(t));
      if (window.__painted.length > 400) window.__painted.splice(0, 200);
      return fill.apply(this, arguments);
    };
  });
  await boot(page, 'v=qalyrictwo&av=0123456789abcdef&bc=1&debug=on');
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () => {
      const c = document.createElement('canvas');
      c.width = 640; c.height = 360;
      c.style.cssText = 'position:fixed;left:-4000px;top:0';
      document.body.appendChild(c);
      const x = c.getContext('2d');
      setInterval(() => { x.fillStyle = '#c45b3e'; x.fillRect(0, 0, 640, 360); }, 100);
      x.fillStyle = '#c45b3e'; x.fillRect(0, 0, 640, 360);
      return Promise.resolve(c.captureStream(8));
    };
  });
  const armed = await page.evaluate(() => window.__gifosVideo.armBroadcastHostForTest());
  expect(armed && armed.ok).toBe(true);
  await page.click('#cam');
  await page.evaluate(() => window.__gifosVideo.setClearForTest(true));

  const steps = () => page.locator('#rundown li .rdname').allTextContents();
  const now = () => page.locator('#rundown li.now .rdname').textContent();
  const shot = (name) => page.screenshot({ path: `test/desktop/shots/two-songs-${name}-1280.png` });
  // Take the before picture first: on base the next line fails.
  await shot('before');
  // The order of service has two songs, the second after the Message.
  expect(await steps()).toEqual(['Welcome', 'Song 1', 'Break', 'Reading', 'Talk', 'Song 2', 'Closing']);

  // Before the service, Song words opens song 1.
  await page.click('#rundown #song-edit');
  await expect(page.locator('#songedit-title')).toHaveText('Song words · Song 1');
  await page.locator('#song-text').fill(OWN_SONG.join('\n'));
  await page.click('#song-save');

  await page.click('#rundown-next');
  expect(await now()).toBe('Song 1');
  let b = await lyricBox(page);
  expect(b.program).toBe(OWN_SONG[0]);
  await page.click('#lyrics-next');

  // During Break, Song words opens the song that comes next.
  await page.click('#rundown-next');
  expect(await now()).toBe('Break');
  await page.click('#rundown #song-edit');
  await expect(page.locator('#songedit-title')).toHaveText('Song words · Song 2');
  const text = page.locator('#song-text');
  await expect(text).toBeFocused();
  // Song 2 starts from its own built-in words, not song 1's.
  expect(await text.inputValue()).not.toContain(OWN_SONG[0]);
  expect((await text.inputValue()).length).toBeGreaterThan(10);
  await text.fill(SECOND_SONG.join('\n'));
  await shot('edit');
  await page.click('#song-save');

  // Reading, Talk, then Song 2 reads the second song from its first line.
  for (let i = 0; i < 3; i++) await page.click('#rundown-next');
  expect(await now()).toBe('Song 2');
  b = await lyricBox(page);
  expect(b.display).not.toBe('none');
  expect(b.program).toBe(SECOND_SONG[0]);
  expect(b.preview).toBe(SECOND_SONG[1]);
  expect(b.coversAir).toBe(false);
  expect(b.coversDock).toBe(false);
  expect(b.coversRundown).toBe(false);
  // The room sees the second song's line on the booth's picture (a long
  // line is painted wrapped, so look for its start).
  await expect.poll(() => page.evaluate(() => window.__painted.join(' | '))).toContain('Be Thou my vision');
  await shot('after');

  // Closing has no lyrics.
  await page.click('#rundown-next');
  expect(await now()).toBe('Closing');
  expect((await lyricBox(page)).display).toBe('none');

  // Both songs stay for this room after a reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.armBroadcastHostForTest());
  await page.click('#rundown-next');
  await page.click('#rundown-next');
  expect(await now()).toBe('Welcome');
  await page.click('#rundown-next');
  expect((await lyricBox(page)).program).toBe(OWN_SONG[0]);
});
