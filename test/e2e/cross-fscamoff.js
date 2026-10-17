/*
 * cross-fscamoff.js — in a live service with the host's camera off, Full
 * screen shows who is on stage (initial or picture, name, Camera off) on the
 * host and the viewer, not the black frame under the stage card.
 *
 *   1. the host goes live, camera off (see cross-lib.js); the viewer opens the link
 *   2. each presses F and reads the view
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, until, run } = require('./cross-lib.js');

async function fsLook(pg) {
  await until('stage card', async () => ({ ok: await pg.evaluate(() => document.getElementById('bc-ident').classList.contains('on')) }), 15000);
  await pg.evaluate(() => document.activeElement && document.activeElement.blur());
  await pg.keyboard.press('f');
  await pg.waitForTimeout(2500); // one fsRefresh tick
  return pg.evaluate(() => {
    const n = document.getElementById('fsname');
    const ini = n.querySelector('.fsinitial');
    return {
      on: document.getElementById('fsview').classList.contains('on'),
      card: !!n.offsetParent && getComputedStyle(n).display !== 'none',
      text: n.textContent,
      initial: ini && ini.offsetParent ? ini.textContent : '',
      frame: getComputedStyle(document.getElementById('fsmain')).visibility,
    };
  });
}

run('cross-fscamoff', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'fscamoff');
  const viewer = await watch(vb, host);
  const out = { host: await fsLook(host), viewer: await fsLook(viewer) };
  await shoot();
  const bad = [];
  for (const who of ['host', 'viewer']) {
    const s = out[who];
    if (!s.on) { bad.push(who + ': F opens no Full screen'); continue; }
    if (!s.card) bad.push(who + ': Full screen shows no card');
    if (!/Pastor Kim/.test(s.text) || !/Camera off/.test(s.text)) bad.push(who + ': the card reads ' + JSON.stringify(s.text));
    if (s.frame !== 'hidden') bad.push(who + ': the black frame is painted');
  }
  if (bad.length) throw new Error(bad.join('; ') + ' ' + JSON.stringify(out));
  return 'both: ' + JSON.stringify(out);
});
