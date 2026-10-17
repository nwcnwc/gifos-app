/*
 * cross-sharekey.js — in a live service, S opens the Share sheet with the
 * keyboard on Choose what to share…, and Escape closes it back on Share. A
 * viewer who may not share gets nothing from S and no S in the ? list; once
 * the host allows guest shares, the viewer's S opens the sheet too.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. both press S; the host presses Allow screen share; the viewer presses S
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, until, run, sleep } = require('./cross-lib.js');

async function sKey(pg) {
  await pg.evaluate(() => document.activeElement && document.activeElement.blur());
  await pg.keyboard.press('s');
  await sleep(500);
  const open = await pg.evaluate(() => ({
    on: document.getElementById('share-modal').style.display !== 'none',
    focus: document.activeElement ? document.activeElement.id : '',
    denied: document.getElementById('share-denied').style.display !== 'none',
  }));
  await pg.keyboard.press('Escape');
  await sleep(300);
  const shut = await pg.evaluate(() => ({
    on: document.getElementById('share-modal').style.display !== 'none',
    focus: document.activeElement ? document.activeElement.id : '',
  }));
  await pg.keyboard.press('?');
  await sleep(300);
  const listed = await pg.locator('#keys-modal kbd').allTextContents();
  await pg.keyboard.press('Escape');
  return { open, shut, listsS: listed.includes('S') };
}

run('cross-sharekey', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'sharekey');
  const viewer = await watch(vb, host);
  const out = { host: await sKey(host), viewer: await sKey(viewer) };
  // The host allows guest shares from More; the viewer's S now opens Share.
  await host.locator('#bartoggle').click();
  await host.locator('#shareall').click();
  await until('viewer may share', async () => ({ ok: await viewer.evaluate(() => document.body.classList.contains('share-granted')) }), 15000);
  if (await host.locator('#barmore').isVisible()) await host.locator('#bartoggle').click();
  out.allowed = await sKey(viewer);
  // Leave the host's and the viewer's sheets open for the shot.
  for (const pg of [host, viewer]) {
    await pg.evaluate(() => document.activeElement && document.activeElement.blur());
    await pg.keyboard.press('s');
  }
  await sleep(800);
  await shoot();
  const bad = [];
  const opens = (who, s) => {
    if (!s.open.on) { bad.push(who + ': S opens no Share'); return; }
    if (s.open.denied) bad.push(who + ': the sheet refuses the share');
    if (s.open.focus !== 'share-go') bad.push(who + ': S leaves the keyboard on ' + (s.open.focus || 'nothing'));
    if (s.shut.on) bad.push(who + ': Escape leaves Share open');
    else if (s.shut.focus !== 'sharebtn') bad.push(who + ': closing leaves the keyboard on ' + (s.shut.focus || 'nothing'));
    if (!s.listsS) bad.push(who + ': ? does not list S');
  };
  opens('host', out.host);
  if (out.viewer.open.on) bad.push('viewer: S opens Share before the host allows it');
  if (out.viewer.listsS) bad.push('viewer: ? lists S before the host allows sharing');
  opens('allowed viewer', out.allowed);
  if (bad.length) throw new Error(bad.join('; ') + ' ' + JSON.stringify(out));
  return JSON.stringify(out);
});
