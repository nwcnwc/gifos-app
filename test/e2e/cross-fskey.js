/*
 * cross-fskey.js — in a live service, F takes the whole page full screen
 * (0.9.23b: one Full screen, the page as laid out), the one Full screen
 * button then reads Exit full screen, F again leaves, and so does the
 * browser's own exit (its Escape); after either the button reads Full screen
 * and the keyboard is where it was. Real full screen, real browsers.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each presses F, reads the page and the button, presses F again;
 *      then F once more and leaves the way the browser's Escape does
 *
 * One press must run the button once: two handlers each clicking it on one
 * F used to send two toggles per key press.
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, until, run } = require('./cross-lib.js');

const read = (pg) => pg.evaluate(() => {
  const b = document.getElementById('fsbtn');
  return { full: !!document.fullscreenElement, name: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed'),
    focus: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : '', clicks: window.__fsClicks || 0 };
});
const settle = (pg, full) => until('full screen is ' + full, async () => {
  const s = await read(pg);
  return { ok: s.full === full && s.name === (full ? 'Exit full screen' : 'Full screen'), ...s };
}, 3000).catch((e) => ({ ok: false, err: e.message }));

async function fsKey(pg) {
  await pg.evaluate(() => {
    window.__fsClicks = 0;
    document.getElementById('fsbtn').addEventListener('click', () => { window.__fsClicks++; }, true);
    if (document.activeElement) document.activeElement.blur();
  });
  const before = (await read(pg)).focus;
  await pg.keyboard.press('f');
  const open = await settle(pg, true);
  await pg.keyboard.press('f');
  const shut = await settle(pg, false);
  await pg.keyboard.press('f');
  const again = await settle(pg, true);
  await pg.evaluate(() => document.exitFullscreen()); // what the browser's Escape does
  const esc = await settle(pg, false);
  return { before, open, shut, again, esc };
}

run('cross-fskey', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'fskey');
  const viewer = await watch(vb, host);
  const out = { host: await fsKey(host), viewer: await fsKey(viewer) };
  // Leave the host full screen for the shot.
  await host.keyboard.press('f');
  await host.waitForTimeout(800);
  await shoot();
  const bad = [];
  for (const who of ['host', 'viewer']) {
    const s = out[who];
    if (!s.open.ok) { bad.push(who + ': F opens no Full screen (or the button does not read Exit full screen)'); continue; }
    if (s.open.pressed !== 'true') bad.push(who + ': the button is not pressed while full screen');
    if (s.open.clicks !== 1) bad.push(who + ': one F ran the button ' + s.open.clicks + ' times');
    if (!s.shut.ok) bad.push(who + ': F again leaves Full screen on');
    else if (s.shut.focus !== s.before) bad.push(who + ': F moved the keyboard to ' + s.shut.focus);
    if (!s.again.ok) bad.push(who + ': F does not open Full screen a second time');
    if (!s.esc.ok) bad.push(who + ': the button does not follow the browser\'s own exit');
    else if (s.esc.focus !== s.before) bad.push(who + ': the browser\'s exit left the keyboard on ' + s.esc.focus);
  }
  if (bad.length) throw new Error(bad.join('; ') + ' ' + JSON.stringify(out));
  return 'both: ' + JSON.stringify(out);
});
