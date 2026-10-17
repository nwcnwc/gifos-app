/*
 * cross-fskey.js — in a live service, F opens Full screen with the keyboard
 * on its close button (named Exit full screen), Escape closes it, and the
 * keyboard lands back on Full screen. Real full screen, real browsers.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each presses F, reads the view, presses Escape
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, until, run } = require('./cross-lib.js');

async function fsKey(pg) {
  await pg.evaluate(() => document.activeElement && document.activeElement.blur());
  await pg.keyboard.press('f');
  await pg.waitForTimeout(500);
  const open = await pg.evaluate(() => {
    const c = document.getElementById('fsclose');
    return {
      on: document.getElementById('fsview').classList.contains('on'),
      name: c ? (c.getAttribute('aria-label') || c.textContent) : '',
      focus: document.activeElement ? document.activeElement.id : '',
    };
  });
  await pg.keyboard.press('Escape');
  // Real full screen may answer Escape itself; either way the view closes.
  const shut = await until('view closes', async () => {
    const s = await pg.evaluate(() => ({
      on: document.getElementById('fsview').classList.contains('on'),
      focus: document.activeElement ? document.activeElement.id : '',
    }));
    return { ok: !s.on && s.focus === 'fsbtn', ...s };
  }, 3000).catch((e) => ({ on: true, focus: e.message }));
  return { open, shut };
}

run('cross-fskey', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'fskey');
  const viewer = await watch(vb, host);
  const out = { host: await fsKey(host), viewer: await fsKey(viewer) };
  // Leave the host's view open for the shot.
  await host.evaluate(() => document.activeElement && document.activeElement.blur());
  await host.keyboard.press('f');
  await host.waitForTimeout(800);
  await shoot();
  const bad = [];
  for (const who of ['host', 'viewer']) {
    const s = out[who];
    if (!s.open.on) { bad.push(who + ': F opens no Full screen'); continue; }
    if (s.open.name !== 'Exit full screen') bad.push(who + ': the close button reads ' + s.open.name);
    if (s.open.focus !== 'fsclose') bad.push(who + ': F leaves the keyboard on ' + (s.open.focus || 'nothing'));
    if (s.shut.on) bad.push(who + ': Escape leaves Full screen open');
    else if (s.shut.focus !== 'fsbtn') bad.push(who + ': closing leaves the keyboard on ' + (s.shut.focus || 'nothing'));
  }
  if (bad.length) throw new Error(bad.join('; ') + ' ' + JSON.stringify(out));
  return 'both: ' + JSON.stringify(out);
});
