/*
 * cross-keys.js — in a live service, ? opens the one shortcut sheet, and it
 * lists the keys that work for that person: the microphone and camera keys
 * for the host, not for a viewer (whose dock has no mic or camera); the
 * microphone announces the same key the sheet lists; Esc is listed and
 * closes the sheet.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each presses ? with focus on Chat and reads the keys listed
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, until, run } = require('./cross-lib.js');

async function keys(pg) {
  await pg.locator('#chatbtn').focus();
  await pg.keyboard.press('?');
  const open = await until('the sheet opens', async () => ({ ok: await pg.locator('#shortcutsheet').isVisible() }), 3000).then(() => true, () => false);
  const list = open ? await pg.locator('#shortcutsheet li:not([hidden]) kbd').allTextContents() : [];
  const micShown = await pg.locator('#mic').isVisible();
  const mic = await pg.locator('#mic').getAttribute('aria-keyshortcuts');
  const cam = await pg.locator('#cam').getAttribute('aria-keyshortcuts');
  return { open, list, micShown, mic, cam };
}

run('cross-keys', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'keys');
  const viewer = await watch(vb, host);
  const out = { host: await keys(host), viewer: await keys(viewer) };
  await shoot();
  const bad = [];
  for (const [who, s] of Object.entries(out)) {
    if (!s.open) bad.push(who + ': ? opens nothing');
    if (!s.list.includes('Esc')) bad.push(who + ': Esc not listed');
    if (!s.list.includes('?')) bad.push(who + ': ? not listed');
  }
  const h = out.host, v = out.viewer;
  if (h.open && !(h.micShown && h.mic && h.list.includes(h.mic))) bad.push('host: the microphone\'s key (' + h.mic + ') is not listed');
  if (h.open && !(h.cam && h.list.includes(h.cam))) bad.push('host: the camera\'s key (' + h.cam + ') is not listed');
  if (v.micShown) bad.push('viewer: a microphone on the dock');
  if (v.open && (v.list.includes(v.mic) || v.list.includes(v.cam))) bad.push('viewer: microphone or camera keys listed with neither on the dock');
  for (const [who, pg] of [['host', host], ['viewer', viewer]]) {
    if (!out[who].open) continue;
    await pg.keyboard.press('Escape');
    if (await pg.locator('#shortcutsheet').isVisible()) bad.push(who + ': Escape leaves the sheet open');
  }
  if (bad.length) throw new Error(bad.join('; ') + ' ' + JSON.stringify(out));
  return 'both read their own keys: ' + JSON.stringify(out);
});
