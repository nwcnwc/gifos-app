/*
 * cross-keys.js — in a live service, ? lists the keyboard shortcuts that
 * work for that person: M and V for the host, not for a viewer (whose dock
 * has no mic or camera), and Escape closes the list.
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
  const open = await until('the list opens', async () => ({ ok: await pg.locator('#keys-modal').isVisible() }), 3000).then(() => true, () => false);
  const list = open ? await pg.locator('#keys-modal kbd').allTextContents() : [];
  const mic = await pg.locator('#mic').getAttribute('aria-keyshortcuts');
  return { open, list, mic };
}

run('cross-keys', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'keys');
  const viewer = await watch(vb, host);
  const out = { host: await keys(host), viewer: await keys(viewer) };
  await shoot();
  const bad = [];
  for (const [who, s] of Object.entries(out)) {
    if (!s.open) bad.push(who + ': ? opens nothing');
    if (s.mic !== 'M') bad.push(who + ': mic has no aria-keyshortcuts');
    if (!s.list.includes('Esc')) bad.push(who + ': Esc not listed');
  }
  if (out.host.open && !(out.host.list.includes('M') && out.host.list.includes('V'))) bad.push('host: M and V not listed');
  if (out.viewer.list.includes('M')) bad.push('viewer: M listed with no mic on the dock');
  for (const [who, pg] of [['host', host], ['viewer', viewer]]) {
    if (!out[who].open) continue;
    await pg.keyboard.press('Escape');
    if (await pg.locator('#keys-modal').isVisible()) bad.push(who + ': Escape leaves the list open');
  }
  if (bad.length) throw new Error(bad.join('; ') + ' ' + JSON.stringify(out));
  return 'both read their own keys: ' + JSON.stringify(out);
});
