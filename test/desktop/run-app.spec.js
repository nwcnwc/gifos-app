const { test, expect } = require('@playwright/test');
const { SEAT_VIEWS, seatPage, seatAndWake } = require('../shared/share-seat');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

// Playwright's Linux WebKit does WebCrypto with libgcrypt, which aborts the
// tab on an Ed25519 signature over 64 KB (an app's bytes); Safari does not.
// There the page uses its own JS signer (same signatures; a documented hook).
const JS_SIGNER = () => { window.GIFOS_ED_FORCE_JS = true; };
test.beforeEach(async ({ page, browserName }) => { if (browserName === 'webkit') await page.addInitScript(JS_SIGNER); });

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=' + RUN_ROOM + 'qaapp&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  await page.waitForFunction(() => window.__gifosVideo.canRunApp());
  await page.click('#bartoggle');
  await page.click('#appbtn');
  await expect(page.locator('#app-modal')).toBeVisible();
}

test.describe('German Run app', () => {
  test.use({ locale: 'de-DE' });
  test('the Run app sheet follows German', async ({ page }) => {
    await boot(page);
    const sheet = page.locator('#app-modal');
    await expect(sheet.locator('h3')).toHaveText('Eine App in dieser Besprechung starten');
    await expect(sheet).toContainText('Wählen Sie eine Ihrer Apps');
    await expect(sheet.locator('#app-file')).toHaveText('＋ Eine GIF-Datei wählen…');
    await expect(sheet.locator('#app-url')).toHaveAttribute('placeholder', 'Link zu einer GIF-App einfügen');
    await expect(sheet.locator('#app-url-go')).toHaveText('Starten');
    await expect(sheet.locator('#app-cancel')).toHaveText('Abbrechen');
    await expect(sheet).not.toContainText('Run an app in this meeting');
    await expect(sheet).not.toContainText('Choose a GIF file');
    await expect(page.locator('#appbtn')).toHaveAttribute('title', /App in dieser Besprechung/);
    const fit = await sheet.evaluate((el) => {
      const h = el.querySelector('h3');
      const box = el.querySelector('.name-box').getBoundingClientRect();
      return { font: parseFloat(getComputedStyle(h).fontSize), top: box.top, bottom: box.bottom, ih: window.innerHeight };
    });
    expect(fit.font).toBeGreaterThanOrEqual(16);
    expect(fit.top).toBeGreaterThanOrEqual(0);
    expect(fit.bottom).toBeLessThanOrEqual(fit.ih + 1);
  });
});

test.describe('Spanish Run app', () => {
  test.use({ locale: 'es-MX' });
  test('the Run app sheet follows Spanish', async ({ page }) => {
    await boot(page);
    const sheet = page.locator('#app-modal');
    await expect(sheet.locator('h3')).toHaveText('Abrir una app en esta reunión');
    await expect(sheet.locator('#app-file')).toHaveText('＋ Elegir un archivo GIF…');
    await expect(sheet.locator('#app-url-go')).toHaveText('Abrir');
    await expect(sheet.locator('#app-cancel')).toHaveText('Cancelar');
    await expect(sheet).not.toContainText('Run an app in this meeting');
    await expect(sheet).not.toContainText('Choose a GIF file');
  });
});

// An app running in a meeting puts its bar along the top of the page, where the
// header pill (GifOS · Just you · Invite), Fit, and the build label also sit:
// they covered the app's picture and name, Stop app, and Full screen. Every
// control on the app bar must be clear of the header pieces, and every header
// piece still on screen must stay clear of the bar.
test('a running app\'s bar is clear of the header, Fit, and the build label', async ({ page }) => {
  await boot(page);
  await page.setInputFiles('#app-file-input', 'apps/2048/2048.gif');
  await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('appstop').getClientRects().length > 0);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const read = () => page.evaluate(() => {
    const shown = (el) => {
      if (!el || !el.getClientRects().length) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
    };
    const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const meet = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const heads = [document.querySelector('.topchip'), document.getElementById('fitbtn'),
      document.getElementById('gifos-build-float'), document.getElementById('handq')]
      .filter(shown).map((el) => ({ id: el.id || el.className, box: box(el) }));
    const bar = [...document.querySelectorAll('#appbar > *')].filter((el) => shown(el) && el.getBoundingClientRect().width > 0);
    const covered = [];
    for (const el of bar) for (const h of heads) if (meet(box(el), h.box)) covered.push((el.id || el.className) + ' under ' + h.id);
    return { covered, barIds: bar.map((el) => el.id || el.className) };
  });
  const got = await read();
  await page.screenshot({ path: 'test/desktop/shots/app-head-1280.png' });
  expect(got.barIds).toEqual(expect.arrayContaining(['appstop']));
  expect(got.barIds.some((id) => id === 'appgif' || id === 'appname')).toBe(true);
  expect(got.covered).toEqual([]);
});

// With an app running, the faces stand beside it, as beside a shared screen.
// The self tile's "Muted" and "Camera off" words were cut at the tile's edge
// ("Camera"), and a view-only note (no camera found) ran as unreadable text
// behind the chips and the name. Every chip must sit whole inside its tile,
// and any note text shown must fit inside the tile too.
test('a running app\'s faces show each face\'s marks whole, with no cut text', async ({ page }) => {
  await boot(page);
  await page.setInputFiles('#app-file-input', 'apps/2048/2048.gif');
  await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
  await page.keyboard.press('Escape');
  // The faces move beside the app a moment after it mounts: wait for it.
  await page.waitForFunction(() => {
    const t = document.querySelector('.tile.me[data-comfy="1"]');
    const pane = document.getElementById('apppane').getBoundingClientRect();
    return t && t.querySelector('.chips span.ico') && pane.width > 0 && t.getBoundingClientRect().left >= pane.right;
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const got = await page.evaluate(() => {
    const tile = document.querySelector('.tile.me');
    const t = tile.getBoundingClientRect();
    const inside = (r) => r.left >= t.left - 0.5 && r.right <= t.right + 0.5 && r.top >= t.top - 0.5 && r.bottom <= t.bottom + 0.5;
    const cut = [];
    for (const el of tile.querySelectorAll('.chips > span, .name')) {
      if (!el.getClientRects().length) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const clipped = el.scrollWidth > el.clientWidth + 1;
      if (!inside(r) || clipped) cut.push((el.dataset.icon || el.className) + ' ' + Math.round(r.left) + '-' + Math.round(r.right) + ' of ' + Math.round(t.left) + '-' + Math.round(t.right));
    }
    const note = tile.querySelector('.note');
    let noteCut = false;
    if (note && note.getClientRects().length && getComputedStyle(note).visibility !== 'hidden') {
      const r = note.getBoundingClientRect();
      noteCut = !inside(r) || note.scrollHeight > note.clientHeight + 1;
    }
    return { cut, noteCut };
  });
  await page.screenshot({ path: 'test/desktop/shots/app-strip-1280.png' });
  expect(got.cut).toEqual([]);
  expect(got.noteCut).toBe(false);
});

// The More sheet stayed open on top of the app (a grid of buttons over the 2048
// board) until you found Hide. Starting an app folds the sheet, like starting a
// screen share. Picking Run app folds it already, so it is opened again here
// to check the app start itself.
test('starting an app folds the More sheet off the app', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.getElementById('bartoggle').click());
  await expect(page.locator('#bartoggle')).toHaveAttribute('aria-expanded', 'true');
  await page.setInputFiles('#app-file-input', 'apps/2048/2048.gif');
  await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('appstop').getClientRects().length > 0);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const got = await page.evaluate(() => {
    const more = document.getElementById('barmore');
    const shown = !!more && more.getClientRects().length > 0 && getComputedStyle(more).visibility !== 'hidden';
    const t = document.getElementById('bartoggle');
    return { moreShown: shown, expanded: t.getAttribute('aria-expanded'), word: t.textContent.trim() };
  });
  await page.screenshot({ path: 'test/desktop/shots/app-more-1280.png' });
  expect(got).toEqual({ moreShown: false, expanded: 'false', word: 'More' });
});

// Older eyes: with an app running in a meeting on a desktop, every word on the
// app bar is 16px or more. Help and the "you are hosting it" line were
// 12.5px beside 16px Stop app and Invite.
test('every word on a running app\'s bar is 16px or more', async ({ page }) => {
  await boot(page);
  await page.setInputFiles('#app-file-input', 'apps/2048/2048.gif');
  await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('apphelp').getClientRects().length > 0);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const got = await page.evaluate(() => {
    const shown = (el) => {
      if (!el || !el.getClientRects().length) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
    };
    const bar = document.getElementById('appbar');
    const words = [...bar.children].filter((el) => shown(el) && (el.textContent || '').trim())
      .map((el) => ({ id: el.id || el.className, text: el.textContent.trim().slice(0, 40), px: parseFloat(getComputedStyle(el).fontSize) }));
    const small = words.filter((w) => w.px < 16).map((w) => w.id + ' ' + w.px + 'px "' + w.text + '"');
    const btns = [...bar.querySelectorAll('button')].filter(shown).map((b) => b.getBoundingClientRect());
    return {
      ids: words.map((w) => w.id), small,
      offRight: btns.filter((r) => r.right > innerWidth + 1).length,
      barH: bar.getBoundingClientRect().height,
    };
  });
  await page.screenshot({ path: 'test/desktop/shots/app-bigwords-1280.png' });
  expect(got.ids).toEqual(expect.arrayContaining(['apphelp', 'appstop']));
  expect(got.small).toEqual([]);
  expect(got.offRight).toBe(0);
});

// An app in a meeting takes a shared screen's seat (Nathan 19:02): the left
// side sideways, the top band upright, the faces beside or under it, and
// waking the buttons moves nothing. Its bar keeps the app's name beside the
// GIF (the host saw only the icon) and the "who" line whole (a phone read
// "share…").
for (const view of SEAT_VIEWS) {
  test('a running app takes the share seat at ' + view.tag + ' and its bar reads whole', async ({ browser, browserName }) => {
    const { ctx, page } = await seatPage(browser, browserName, view, 'qaappseat');
    await page.waitForFunction(() => window.__gifosVideo.canRunApp());
    await page.evaluate(() => document.getElementById('bartoggle').click());
    await page.evaluate(() => document.getElementById('appbtn').click());
    await page.setInputFiles('#app-file-input', 'apps/2048/2048.gif');
    await page.waitForFunction(() => document.body.classList.contains('has-app') && document.getElementById('appgif').getClientRects().length > 0, null, { timeout: 30000 });
    await page.keyboard.press('Escape');
    const got = await seatAndWake(page, view, 'app');
    const bar = await page.evaluate(() => {
      const shown = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
      const pane = document.getElementById('apppane').getBoundingClientRect();
      const who = document.getElementById('appwho');
      const off = [...document.querySelectorAll('#appbar > *')].filter(shown)
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < pane.left - 1 || r.right > pane.right + 1); })
        .map((el) => el.id || el.className);
      return {
        name: shown(document.getElementById('appname')) ? document.getElementById('appname').textContent : '',
        gif: shown(document.getElementById('appgif')),
        who: who.textContent, whoCut: who.scrollWidth > who.clientWidth + 1, off,
      };
    });
    await page.screenshot({ path: 'test/desktop/shots/app-seat-' + view.tag + '.png' });
    await ctx.close();
    expect(got.problems).toEqual([]);
    expect(got.rested).toBe(true);
    expect(got.woke).toBe(true);
    if (view.phone) expect([got.calm.away, got.after.away]).toEqual([true, false]);
    expect(got.moved).toEqual([]);
    expect(bar).toEqual({ name: '2048', gif: true, who: '· you are hosting it for the meeting', whoCut: false, off: [] });
  });
}

// The line beside a running app's name says who runs it: "· you are hosting
// it for the meeting" for me, "· shared with the meeting by Jordan Lee" for a
// guest. It was the last English line on a German or Spanish app bar.
for (const [locale, lang, want] of [
  ['de-DE', 'German', { host: 'Sie stellen sie der Besprechung bereit', guest: 'mit der Besprechung geteilt von Jordan Lee' }],
  ['es-MX', 'Spanish', { host: 'tú la alojas para la reunión', guest: 'compartida con la reunión por Jordan Lee' }],
]) {
  test.describe(lang + ' app who line', () => {
    test.use({ locale });
    test('the line beside a running app says who runs it in ' + lang, async ({ page, browser, browserName }) => {
      const room = 'qaappwho' + locale.slice(0, 2) + Date.now().toString(36);
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.addInitScript(() => {
        localStorage.setItem('gifos_name', 'Jordan Lee');
        sessionStorage.setItem('gifos_appeared', '1');
      });
      await page.goto('/run.html#v=' + RUN_ROOM + room + '&debug=on', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#mic', { state: 'visible' });
      await page.waitForFunction(() => window.__gifosVideo.canRunApp());
      await page.click('#bartoggle');
      await page.click('#appbtn');
      await page.setInputFiles('#app-file-input', 'apps/2048/2048.gif');
      await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
      await page.keyboard.press('Escape');
      const host = await page.evaluate(() => document.getElementById('appwho').textContent);
      if (locale === 'de-DE') await page.locator('#appbar').screenshot({ path: 'test/desktop/shots/app-who-host-de-1280.png' });

      const ctx = await browser.newContext({ locale, viewport: { width: 1280, height: 720 } });
      if (browserName === 'webkit') await ctx.addInitScript(JS_SIGNER);
      const guest = await ctx.newPage();
      await guest.addInitScript(() => {
        localStorage.setItem('gifos_name', 'Avery Chen');
        sessionStorage.setItem('gifos_appeared', '1');
      });
      await guest.goto('/run.html#v=' + RUN_ROOM + room + '&debug=on', { waitUntil: 'domcontentloaded' });
      await guest.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
      await expect(guest.locator('#appname')).toBeVisible();
      await guest.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const seen = await guest.evaluate(() => document.getElementById('appwho').textContent);
      if (locale === 'de-DE') await guest.locator('#appbar').screenshot({ path: 'test/desktop/shots/app-who-guest-de-1280.png' });
      await ctx.close();

      expect({ host, guest: seen }).toEqual({ host: '· ' + want.host, guest: '· ' + want.guest });
    });
  });
}
