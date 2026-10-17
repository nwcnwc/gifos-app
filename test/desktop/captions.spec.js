const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
    window.__ccStarts = 0;
    function SR() {}
    SR.prototype.start = function () { window.__ccStarts = (window.__ccStarts || 0) + 1; };
    SR.prototype.stop = function () {};
    window.SpeechRecognition = SR;
    window.webkitSpeechRecognition = SR;
  });
  await page.goto('/run.html#v=qacc&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ccdock', { state: 'visible' });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: true }));
  expect(seeded && seeded.ok, JSON.stringify(seeded)).toBe(true);
  return seeded;
}

test('a meeting is always transcribed and CC only shows captions here', async ({ page }) => {
  const seeded = await boot(page);
  const dock = page.locator('#ccdock');
  await expect(dock).toHaveAttribute('aria-pressed', 'false');
  const off = await dock.evaluate((el) => {
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      onScreen: b.left >= -1 && b.right <= window.innerWidth + 1 && b.bottom <= window.innerHeight + 1,
      bg: cs.backgroundColor,
    };
  });
  expect(off.onScreen).toBe(true);
  expect(off.bg).not.toBe('rgb(0, 100, 200)');

  const collapsed = await page.evaluate(() => document.querySelector('.bar').classList.contains('collapsed'));
  if (collapsed) await page.click('#bartoggle');
  await page.click('#chatbtn');
  await page.waitForSelector('#chatpanel.open');
  await expect(page.locator('#trtab')).toBeVisible();
  await page.click('#trtab');
  await expect(page.locator('#trwrap')).toHaveClass(/show/);
  await expect(page.locator('#trdl')).toBeVisible();
  await expect(page.locator('#trlog')).toContainText('written down');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#trdl'),
  ]);
  expect(download.suggestedFilename()).toMatch(/gifos_Transcript\.txt$/);
  await page.click('#chatclose');

  const chip = await page.evaluate((id) => window.__gifosVideo.markCcForTest(id), seeded.ids[0]);
  expect(String(chip)).not.toMatch(/transcribing/i);
  expect(String(chip)).not.toMatch(/Transcription paused/);
  expect(String(chip)).not.toMatch(/Transcription behind/);

  await dock.click();
  await expect(dock).toHaveAttribute('aria-pressed', 'true');
  const on = await dock.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, color: cs.color };
  });
  expect(on.bg).toBe('rgb(0, 100, 200)');
  expect(on.color).toBe('rgb(255, 255, 255)');
  const cap = await page.evaluate(() => window.__gifosVideo.captionsForTest());
  expect(cap.show).toBe(true);
  expect(cap.cc).toBe(false);
  const more = await page.evaluate(() => {
    const b = document.getElementById('ccbtn');
    return { pressed: b.getAttribute('aria-pressed'), on: b.classList.contains('on') };
  });
  expect(more.pressed).toBe('true');
  expect(more.on).toBe(true);

  await page.evaluate(() => window.__gifosVideo.addTranscript('the room heard this'));
  await expect(page.locator('.tile.me .cap.show')).toContainText('the room heard this');
  await dock.click();
  await expect(dock).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.tile.me .cap.show')).toHaveCount(0);
  const lines = await page.evaluate(() => window.__gifosVideo.transcriptTexts());
  expect(lines.join('\n')).toContain('the room heard this');
  const still = await page.evaluate(() => window.__gifosVideo.captionsForTest());
  expect(still.cc).toBe(false);
  expect(still.show).toBe(false);

  const voice = await page.evaluate(() => window.__gifosVideo.ownVoiceForTest());
  expect(voice.cc).toBe(false);
  expect(voice.speech).toBe(true);
  const starts = await page.evaluate(() => window.__ccStarts);
  expect(starts).toBeGreaterThan(0);
});

test.describe('German captions', () => {
  test.use({ locale: 'de-DE' });
  test('Captions in More follows German and the transcript stays open', async ({ page }) => {
    await boot(page);
    await page.click('#bartoggle');
    await expect(page.locator('#ccbtn')).toHaveText('Untertitel');
    await page.click('#chatbtn');
    await page.waitForSelector('#chatpanel.open');
    await page.click('#trtab');
    await expect(page.locator('#trlog')).toContainText('mitgeschrieben');
    await expect(page.locator('#trdl')).toHaveText('Protokoll laden');
  });
});
