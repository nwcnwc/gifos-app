/*
 * cross-sharekey.js — in a live service, the Share key the shortcut sheet
 * lists (Share's own aria-keyshortcuts) starts a screen share for the host
 * (0.9.23b: Share opens the browser's own picker, no sheet before it; the
 * test browser's fake picker answers at once) and the same key stops it. A
 * viewer, who never shares in a 0.9.23b service (a viewer publishes no
 * camera, microphone or screen), gets nothing from the key and no Share key
 * in the ? sheet.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. both press the Share key, then again, then ? and read the sheet
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, until, run, sleep } = require('./cross-lib.js');

const chord = (key) => key.replace(/^Alt\+(.)$/, (m, k) => 'Alt+' + k.toLowerCase());
const sharing = (pg) => pg.evaluate(() => document.getElementById('sharebtn').classList.contains('on'));

async function sKey(pg, key) {
  await pg.evaluate(() => document.activeElement && document.activeElement.blur());
  await pg.keyboard.press(chord(key));
  const started = await until('sharing', async () => ({ ok: await sharing(pg) }), 5000).then(() => true, () => false);
  await pg.keyboard.press(chord(key));
  const stopped = await until('not sharing', async () => ({ ok: !(await sharing(pg)) }), 5000).then(() => true, () => false);
  const modal = await pg.evaluate(() => document.getElementById('share-modal').style.display !== 'none');
  await pg.keyboard.press('?');
  await sleep(300);
  const listed = await pg.locator('#shortcutsheet li:not([hidden]) kbd').allTextContents();
  await pg.keyboard.press('Escape');
  return { key, started, stopped, modal, listed: listed.includes(key) };
}

run('cross-sharekey', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'sharekey');
  const viewer = await watch(vb, host);
  const key = await host.locator('#sharebtn').getAttribute('aria-keyshortcuts');
  const out = { host: await sKey(host, key), viewer: await sKey(viewer, key) };
  await shoot();
  const bad = [];
  const h = out.host, v = out.viewer;
  if (!key) bad.push('Share announces no key');
  if (!h.started) bad.push('host: ' + key + ' starts no share');
  else if (!h.stopped) bad.push('host: ' + key + ' again does not stop the share');
  if (!h.listed) bad.push('host: ? does not list ' + key);
  if (v.started || v.modal) bad.push('viewer: ' + key + ' starts a share or opens a sheet');
  if (v.listed) bad.push('viewer: ? lists ' + key + ' with no Share to press');
  if (bad.length) throw new Error(bad.join('; ') + ' ' + JSON.stringify(out));
  return JSON.stringify(out);
});
