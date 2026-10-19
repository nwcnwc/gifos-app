const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// A solo app has no meeting header: its app bar is the top row. The build
// label ("edge") sat in the top right corner on the bar's Full screen button
// (hunt-1806/appshare/header-solo-app.png), and the bar showed only the app's
// GIF, where a meeting guest reads its name. The label sits clear of every
// control on the bar, and the bar names the app.

const JS_SIGNER = () => { window.GIFOS_ED_FORCE_JS = true; };
test.use({ serviceWorkers: 'block' });

async function install(page) {
  await page.goto('/store.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GifOS && GifOS.store && GifOS.store.putFile);
  const bytes = fs.readFileSync(path.join(__dirname, '..', '..', 'apps', '2048', '2048.gif'));
  return page.evaluate(async (b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const id = 'file_test_2048_' + Date.now().toString(36);
    await GifOS.store.putFile({ id, name: '2048.gif', bytes: u, kind: 'gif', isApp: true, appId: '2048', mime: 'image/gif' });
    return id;
  }, bytes.toString('base64'));
}

for (const [tag, viewport] of [['1280x800', { width: 1280, height: 800 }], ['390x844', { width: 390, height: 844 }], ['844x390', { width: 844, height: 390 }]]) {
  test('a solo app\'s bar names the app and the build label stays off it at ' + tag, async ({ page, browserName }) => {
    if (browserName === 'webkit') await page.addInitScript(JS_SIGNER);
    await page.addInitScript(() => {
      localStorage.setItem('gifos_name', 'Jordan Lee');
      sessionStorage.setItem('gifos_appeared', '1');
      localStorage.setItem('gifos_relay', 'ws://127.0.0.1:9/never');
    });
    await page.setViewportSize(viewport);
    const id = await install(page);
    await page.goto('/run.html#id=' + id, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('solo-app') && document.getElementById('appgif').getClientRects().length > 0, null, { timeout: 30000 });
    await page.waitForFunction(() => !!document.getElementById('gifos-build-float'));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const got = await page.evaluate(() => {
      const shown = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
      const b = document.getElementById('gifos-build-float').getBoundingClientRect();
      const meet = (r) => r.left < b.right && b.left < r.right && r.top < b.bottom && b.top < r.bottom;
      const under = [...document.querySelectorAll('#appbar > *')].filter(shown)
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && meet(r); })
        .map((el) => el.id || el.className);
      const name = document.getElementById('appname');
      return { under, name: shown(name) ? name.textContent : '', onScreen: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight };
    });
    await page.screenshot({ path: 'test/desktop/shots/solo-bar-' + tag + '.png' });
    expect(got).toEqual({ under: [], name: '2048', onScreen: true });
  });
}
