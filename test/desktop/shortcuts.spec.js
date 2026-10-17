const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html#v=qakeys&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  await page.evaluate(() => {
    for (const id of ['mic', 'cam']) {
      const el = document.getElementById(id);
      el.dataset.hits = '0';
      const prev = el.onclick;
      el.onclick = function (ev) {
        el.dataset.hits = String((+el.dataset.hits || 0) + 1);
        if (prev) return prev.call(this, ev);
      };
    }
  });
}

async function hits(page, id) {
  return page.locator('#' + id).getAttribute('data-hits');
}

test('alt shortcuts run the dock and skip the keys while typing', async ({ page }) => {
  await boot(page);
  for (const [id, chord] of [['mic', 'Alt+A'], ['cam', 'Alt+V'], ['sharebtn', 'Alt+S'], ['chatbtn', 'Alt+C'], ['hand', 'Alt+H'], ['fitbtn', 'Alt+F'], ['leavebtn', 'Alt+Q']]) {
    expect(await page.getAttribute('#' + id, 'aria-keyshortcuts'), id).toBe(chord);
  }
  await page.evaluate(() => {
    const el = document.getElementById('sharebtn');
    el.dataset.hits = '0';
    const prev = el.onclick;
    el.onclick = function (ev) {
      el.dataset.hits = String((+el.dataset.hits || 0) + 1);
      if (prev) return prev.call(this, ev);
    };
  });
  await page.keyboard.press('Alt+a');
  await page.keyboard.press('Alt+v');
  await page.keyboard.press('Alt+s');
  expect(await hits(page, 'mic')).toBe('1');
  expect(await hits(page, 'cam')).toBe('1');
  expect(await hits(page, 'sharebtn')).toBe('1');

  await page.keyboard.press('Alt+c');
  await expect(page.locator('#chatpanel.open')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('.bar').classList.contains('collapsed'))).toBe(true);
  await page.evaluate(() => {
    const el = document.getElementById('hand');
    el.dataset.hits = '0';
    const prev = el.onclick;
    el.onclick = function (ev) {
      el.dataset.hits = String((+el.dataset.hits || 0) + 1);
      if (prev) return prev.call(this, ev);
    };
  });
  await page.keyboard.press('Alt+h');
  expect(await hits(page, 'hand')).toBe('1');
  await expect(page.locator('#hand')).toHaveText('Lower hand');
  await expect(page.locator('#fitbtn')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Alt+f');
  await expect(page.locator('#fitbtn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#fitbtn')).toHaveText('▦ Scroll');
  await page.keyboard.press('Alt+f');
  await expect(page.locator('#fitbtn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#chat-in').focus();
  await page.keyboard.press('Alt+a');
  await page.keyboard.press('Alt+s');
  await page.keyboard.press('?');
  expect(await hits(page, 'mic')).toBe('1');
  expect(await hits(page, 'sharebtn')).toBe('1');
  await expect(page.locator('#chat-in')).toHaveValue('?');
  await expect(page.locator('#shortcutsheet')).toBeHidden();

  await page.locator('#chat-in').blur();
  await page.keyboard.press('?');
  const sheet = page.locator('#shortcutsheet');
  await expect(sheet).toBeVisible();
  const read = await sheet.evaluate((el) => {
    const box = el.querySelector('.name-box').getBoundingClientRect();
    const sample = el.querySelector('li');
    const cs = getComputedStyle(sample);
    return {
      text: el.innerText,
      onScreen: box.top >= 0 && box.bottom <= window.innerHeight && box.left >= 0 && box.right <= window.innerWidth,
      font: parseFloat(cs.fontSize),
    };
  });
  expect(read.onScreen).toBe(true);
  expect(read.font).toBeGreaterThanOrEqual(16);
  for (const chord of ['Alt+A', 'Alt+V', 'Alt+S', 'Alt+C', 'Alt+H', 'Alt+F', 'Alt+Q']) expect(read.text).toContain(chord);
  expect(read.text).toContain('Share or stop sharing');
  expect(read.text).toContain('Raise or lower your hand');
  expect(read.text).toContain('Fit everyone or scroll');

  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await page.click('#bartoggle');
  await page.click('#moretools');
  await page.click('#keysbtn');
  await expect(sheet).toBeVisible();

  await page.keyboard.press('Escape');
  await page.keyboard.press('Alt+q');
  await expect(page.locator('#leave-ask')).toBeVisible();
  await expect(page.locator('#left-modal')).toBeHidden();
});

test('the rest of More has a key', async ({ page }) => {
  await boot(page);
  const chords = [
    ['whobtn', 'Alt+W'], ['invite', 'Alt+I'], ['appbtn', 'Alt+Y'], ['votebtn', 'Alt+U'],
    ['pwbtn', 'Alt+L'], ['stagebtn', 'Alt+G'], ['recbtn', 'Alt+R'], ['ccdock', 'Alt+K'],
    ['setbtn', 'Alt+,'], ['helpbtn', 'Alt+/'], ['trbtn', 'Alt+T'],
  ];
  for (const [id, chord] of chords) {
    expect(await page.getAttribute('#' + id, 'aria-keyshortcuts'), id).toBe(chord);
  }
  await page.evaluate(() => {
    for (const id of ['whobtn', 'invite', 'appbtn', 'votebtn', 'pwbtn', 'stagebtn', 'recbtn', 'ccdock', 'setbtn', 'helpbtn', 'trbtn']) {
      const el = document.getElementById(id);
      el.dataset.hits = '0';
      el.addEventListener('click', (ev) => {
        el.dataset.hits = String((+el.dataset.hits || 0) + 1);
        ev.stopImmediatePropagation();
        ev.preventDefault();
      }, true);
    }
  });
  const presses = ['Alt+w', 'Alt+i', 'Alt+y', 'Alt+u', 'Alt+l', 'Alt+g', 'Alt+r', 'Alt+k', 'Alt+Comma', 'Alt+Slash', 'Alt+t'];
  for (const key of presses) await page.keyboard.press(key);
  for (const [id] of chords) expect(await hits(page, id), id).toBe('1');
  expect(await page.evaluate(() => document.querySelector('.bar').classList.contains('collapsed'))).toBe(true);
  await page.keyboard.press('?');
  const text = await page.locator('#shortcutsheet').innerText();
  for (const phrase of ['Alt+W', 'Alt+I', 'Alt+Y', 'Alt+U', 'Alt+L', 'Alt+G', 'Alt+R', 'Alt+K', 'Alt+,', 'Alt+/', 'Alt+T', 'Invite', 'Settings', 'Who is here']) {
    expect(text).toContain(phrase);
  }
});

test.describe('German shortcuts', () => {
  test.use({ locale: 'de-DE' });
  test('the share key is named in German', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('?');
    const sheet = page.locator('#shortcutsheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Alt+S');
    await expect(sheet).toContainText('Bildschirm teilen oder beenden');
    await expect(sheet).toContainText('Hand heben oder senken');
    await expect(sheet).toContainText('Alle zeigen oder scrollen');
    await expect(sheet).toContainText('Wer ist hier');
    await expect(sheet).toContainText('Einladen');
    await expect(sheet).toContainText('Einstellungen');
    await expect(sheet).toContainText('Untertitel auf diesem Bildschirm');
    await expect(sheet).not.toContainText('Share or stop sharing');
    await expect(sheet).not.toContainText('Raise or lower your hand');
    await expect(sheet).not.toContainText('Fit everyone or scroll');
    await expect(sheet).not.toContainText('Who is here');
    await expect(sheet).not.toContainText('Settings');
  });
});

test.describe('Spanish shortcuts', () => {
  test.use({ locale: 'es-MX' });
  test('the invite key is named in Spanish', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('?');
    const sheet = page.locator('#shortcutsheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Invitar');
    await expect(sheet).toContainText('Ajustes');
    await expect(sheet).toContainText('Quién está');
    await expect(sheet).not.toContainText('Who is here');
    await expect(sheet).not.toContainText('Settings');
  });
});

// A host's room-wide tools (Blur guests, Video off, Allow screen share) are
// one signed order each, whatever the room's size. They have keys too, and a
// guest pressing the same keys changes nothing.
test('a host blurs guests, turns guest video off, and allows shares by key', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'desktop keys run Chromium + Firefox here');
  test.setTimeout(90000);
  const room = 'qahostkeys' + Date.now().toString(36);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html', { waitUntil: 'domcontentloaded' });
  await page.click('#lob-admin-btn');
  await page.fill('#lob-admin-name', room);
  await page.fill('#lob-admin-pass', 'qa-admin-' + room);
  await page.click('#lob-admin-go');
  await page.waitForFunction(() => /av=/.test(location.hash), null, { timeout: 30000 });
  await page.waitForSelector('#leavebtn', { state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('blurall')).display !== 'none' || document.getElementById('blurall').style.display !== 'none', null, { timeout: 30000 });
  await expect(page.locator('#blurall')).toHaveText('Blur guests');
  await expect(page.locator('#camall')).toHaveText('Turn video off');
  await expect(page.locator('#shareall')).toHaveText('Allow screen share');
  await page.keyboard.press('Alt+b');
  await expect(page.locator('#blurall')).toHaveText('Unblur guests');
  await page.keyboard.press('Alt+x');
  await expect(page.locator('#camall')).toHaveText('Turn video on');
  await page.keyboard.press('Alt+p');
  await expect(page.locator('#shareall')).toHaveText('Stop guest shares');
  for (const [id, chord] of [['blurall', 'Alt+B'], ['camall', 'Alt+X'], ['shareall', 'Alt+P']]) {
    expect(await page.getAttribute('#' + id, 'aria-keyshortcuts'), id).toBe(chord);
  }
  // More stays folded: the keys work without the pointer.
  expect(await page.evaluate(() => document.querySelector('.bar').classList.contains('collapsed'))).toBe(true);
  await page.keyboard.press('Alt+b');
  await expect(page.locator('#blurall')).toHaveText('Blur guests');
  await page.keyboard.press('?');
  const sheet = page.locator('#shortcutsheet');
  await expect(sheet).toContainText('Alt+B');
  await expect(sheet).toContainText('Blur or unblur every guest');
  await expect(sheet).toContainText('Alt+X');
  await expect(sheet).toContainText('Turn every guest’s video off or on');
  await expect(sheet).toContainText('Alt+P');
  await expect(sheet).toContainText('Let guests share their screen, or stop them');
});

test('a guest does not see or fire the host keys', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('Alt+b');
  await page.keyboard.press('Alt+x');
  await page.keyboard.press('Alt+p');
  await expect(page.locator('#status')).not.toContainText(/Blurred every guest|video off|share their screen/);
  await page.keyboard.press('?');
  const sheet = page.locator('#shortcutsheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).not.toContainText('Alt+B');
  await expect(sheet).not.toContainText('Blur or unblur every guest');
});
