const { test, expect } = require('@playwright/test');

// A solo link (run.html#id=<fileId>) names a file in ONE browser's store.
// Opened on any other device it used to leave a black page with only Fit on
// it, forever (hunt-1806/bug-missing-file-black-screen.png). It must say the
// app is not here, offer the way Home, and never become a room.

const MISSING = '/run.html#id=file_69c92a72689eb94b';

// Swap the store's getFile once gifos-store.js assigns GifOS.store, so the
// failure and the never-answering lookup can be driven on purpose.
function stubGetFile(mode) {
  return (m) => {
    const G = window.GifOS = window.GifOS || {};
    let real = null;
    Object.defineProperty(G, 'store', {
      configurable: true,
      get() { return real; },
      set(v) {
        real = Object.create(v);
        real.getFile = m === 'reject'
          ? () => Promise.reject(new Error('the computer\u2019s database is held open by another tab'))
          : () => new Promise(() => {});
      },
    });
  };
}

function watchSockets(page) {
  const urls = [];
  page.on('websocket', (ws) => urls.push(ws.url()));
  return urls;
}

async function expectNoRoom(page, sockets) {
  expect(sockets).toEqual([]);
  const traits = await page.evaluate(() => ({
    solo: document.body.classList.contains('solo-app'),
    room: document.body.classList.contains('app-room'),
    joining: [...document.querySelectorAll('#statuscount, #status')]
      .some((el) => el.getClientRects().length > 0 && /Joining/.test(el.textContent)),
  }));
  expect(traits).toEqual({ solo: true, room: false, joining: false });
}

test('a solo link to an app that is not on this device says so and goes Home', async ({ page }) => {
  const sockets = watchSockets(page);
  await page.goto(MISSING, { waitUntil: 'domcontentloaded' });
  const box = page.locator('#appmissing');
  await expect(box).toBeVisible();
  await expect(box.locator('h1')).toHaveText('This app isn\u2019t on this device');
  await expect(box.locator('p')).toContainText('saved on another device or in another browser');
  const home = box.locator('#appmissing-home');
  await expect(home).toHaveText('Go to Home Screen');
  await expect(home).toHaveAttribute('href', 'index.html');
  await expect(page.locator('#fitbtn')).toBeHidden();
  await expect(page).toHaveTitle('This app isn\u2019t on this device — GifOS');
  await expectNoRoom(page, sockets);
  await home.click();
  await expect(page).toHaveURL(/\/index\.html$/);
});

test.describe('German missing app', () => {
  test.use({ locale: 'de-DE' });
  test('the missing-app page follows German', async ({ page }) => {
    await page.goto(MISSING, { waitUntil: 'domcontentloaded' });
    const box = page.locator('#appmissing');
    await expect(box.locator('h1')).toHaveText('Diese App ist nicht auf diesem Gerät');
    await expect(box.locator('#appmissing-home')).toHaveText('Zum Startbildschirm');
    await expect(box).not.toContainText('Go to Home Screen');
  });
});

test.describe('Spanish missing app', () => {
  test.use({ locale: 'es-MX' });
  test('the missing-app page follows Spanish', async ({ page }) => {
    await page.goto(MISSING, { waitUntil: 'domcontentloaded' });
    const box = page.locator('#appmissing');
    await expect(box.locator('h1')).toHaveText('Esta app no está en este dispositivo');
    await expect(box.locator('#appmissing-home')).toHaveText('Ir a la pantalla de inicio');
  });
});

test('a store that cannot be read says the app could not open, with the reason', async ({ page }) => {
  const sockets = watchSockets(page);
  await page.addInitScript(stubGetFile('reject'), 'reject');
  await page.goto(MISSING, { waitUntil: 'domcontentloaded' });
  const box = page.locator('#appmissing');
  await expect(box.locator('h1')).toHaveText('This app couldn\u2019t open');
  await expect(box.locator('p')).toContainText('held open by another tab');
  await expect(box.locator('#appmissing-home')).toHaveAttribute('href', 'index.html');
  await expectNoRoom(page, sockets);
});

test('a lookup that never answers does not leave a black page', async ({ page }) => {
  const sockets = watchSockets(page);
  await page.addInitScript(stubGetFile('hang'), 'hang');
  await page.goto(MISSING, { waitUntil: 'domcontentloaded' });
  const box = page.locator('#appmissing');
  await expect(box).toBeHidden();
  await expect(box.locator('h1')).toHaveText('Still looking for this app', { timeout: 15000 });
  await expect(box.locator('#appmissing-home')).toBeVisible();
  await expectNoRoom(page, sockets);
});

// Playwright's Linux WebKit aborts on a WebCrypto Ed25519 signature over an
// app's bytes; Safari does not (same hook as run-app.spec.js).
test('an app that IS on this device still opens, with no missing-app page', async ({ page, browserName }) => {
  if (browserName === 'webkit') await page.addInitScript(() => { window.GIFOS_ED_FORCE_JS = true; });
  const sockets = watchSockets(page);
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GifOS && window.GifOS.store);
  await page.evaluate(async () => {
    const bytes = new Uint8Array(await (await fetch('apps/2048/2048.gif')).arrayBuffer());
    await GifOS.store.putFile({ id: 'file_qa_present', name: '2048.gif', bytes, kind: 'gif', isApp: true, mime: 'image/gif' });
  });
  await page.goto('/run.html#id=file_qa_present', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('has-app'), null, { timeout: 30000 });
  await expect(page.locator('#appmount iframe')).toHaveCount(1, { timeout: 30000 });
  await expect(page.locator('#appmissing')).toBeHidden();
  expect(sockets).toEqual([]);
});
