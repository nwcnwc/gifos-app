/*
 * cross-fscamoff.js — in a live service with the host's camera off, Full
 * screen shows who is on stage (initial or picture, and name) on the host
 * and the viewer, not the black frame under the stage card. 0.9.23b's one
 * Full screen takes the whole page, so the stage card is the one on screen:
 * the viewer's card says Camera off, the host's own card leaves that line
 * to the host's Camera button (as it does outside Full screen).
 *
 *   1. the host goes live and turns the camera off (see cross-lib.js); the
 *      viewer opens the link
 *   2. each presses F and reads the stage
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, camOff, watch, until, run } = require('./cross-lib.js');

async function fsLook(pg) {
  await until('stage card', async () => ({ ok: await pg.evaluate(() => document.getElementById('bc-ident').classList.contains('on')) }), 15000);
  await pg.evaluate(() => document.activeElement && document.activeElement.blur());
  await pg.keyboard.press('f');
  await until('full screen', async () => ({ ok: await pg.evaluate(() => !!document.fullscreenElement) }), 3000).catch(() => {});
  await pg.waitForTimeout(2500); // the stage repaints for the new size
  return pg.evaluate(() => {
    const c = document.getElementById('bc-ident');
    const r = c.getBoundingClientRect();
    const ini = document.getElementById('bc-ident-init');
    const img = document.getElementById('bc-ident-img');
    const v = document.querySelector('#stagefeed .rowtile video');
    const cam = document.getElementById('cam');
    return {
      full: !!document.fullscreenElement,
      card: getComputedStyle(c).display !== 'none' && r.width > 0 && r.height > 0,
      text: c.innerText.replace(/\s+/g, ' ').trim(),
      face: (ini && ini.offsetParent && ini.textContent) || (img && img.offsetParent && img.src ? 'picture' : ''),
      frame: v ? getComputedStyle(v).visibility : 'no frame',
      camBtn: cam && cam.offsetParent !== null ? cam.getAttribute('aria-label') : '',
    };
  });
}

run('cross-fscamoff', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'fscamoff');
  await camOff(host);
  const viewer = await watch(vb, host);
  const out = { host: await fsLook(host), viewer: await fsLook(viewer) };
  await shoot();
  const bad = [];
  for (const who of ['host', 'viewer']) {
    const s = out[who];
    if (!s.full) { bad.push(who + ': F opens no Full screen'); continue; }
    if (!s.card) bad.push(who + ': Full screen shows no card');
    if (!s.face) bad.push(who + ': the card has no initial or picture');
    if (!/Pastor Kim/.test(s.text)) bad.push(who + ': the card reads ' + JSON.stringify(s.text));
    if (s.frame !== 'hidden') bad.push(who + ': the black frame is painted');
  }
  if (!/Camera off/.test(out.viewer.text)) bad.push('viewer: the card does not say Camera off: ' + JSON.stringify(out.viewer.text));
  if (out.host.camBtn !== 'Start video') bad.push('host: the Camera button does not read camera off: ' + out.host.camBtn);
  if (bad.length) throw new Error(bad.join('; ') + ' ' + JSON.stringify(out));
  return 'both: ' + JSON.stringify(out);
});
