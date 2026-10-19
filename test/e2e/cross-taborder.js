/*
 * cross-taborder.js — in a live service, Tab reaches the room bar (above the
 * stage) before the dock (below it), on the host and on a viewer on another
 * machine.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each presses Tab from the top and notes where Recording and the
 *      dock's grip come in the walk
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run } = require('./cross-lib.js');

async function walk(pg) {
  await pg.evaluate(() => document.activeElement && document.activeElement.blur());
  const ids = [];
  for (let i = 0; i < 18; i++) {
    await pg.keyboard.press('Tab');
    ids.push(await pg.evaluate(() => document.activeElement ? document.activeElement.id : ''));
  }
  return { bar: ids.indexOf('airrec'), dock: ids.indexOf('bargrip'), ids: ids.filter(Boolean).join(' ') };
}

run('cross-taborder', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'taborder');
  const viewer = await watch(vb, host);
  const out = { host: await walk(host), viewer: await walk(viewer) };
  await shoot();
  for (const [who, s] of Object.entries(out)) {
    if (s.bar < 0 || s.dock < 0 || s.bar > s.dock) throw new Error(who + ' Tab order: ' + JSON.stringify(out));
  }
  return 'the room bar comes before the dock on both: ' + JSON.stringify(out);
});
