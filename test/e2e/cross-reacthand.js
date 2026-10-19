/*
 * cross-reacthand.js — a live host's React tray has no Raise hand; a viewer
 * (on another machine, 1280x720) still raises a hand from the tray and the
 * host's raised-hands line names them.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. both open React; the host's tray must hold only the four reactions
 *   3. the viewer presses ✋ in the tray; the host's line must say Jordan Lee
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, until, sleep } = require('./cross-lib.js');

const tray = (pg) => pg.locator('#reacttray button').evaluateAll((bs) => bs.filter((b) => b.getClientRects().length).map((b) => b.getAttribute('aria-label')));

run('cross-reacthand', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'reacthand');
  const viewer = await watch(vb, host);
  for (const pg of [host, viewer]) { await pg.locator('#reactbtn').click(); await pg.waitForSelector('#reacttray:not([hidden])'); }
  await sleep(400);
  const got = { host: await tray(host), viewer: await tray(viewer) };
  await shoot();
  if (got.host.join() !== 'Clap,Yes,No,Laugh') throw new Error('the host\'s tray offers ' + JSON.stringify(got.host));
  if (got.viewer[0] !== 'Raise hand') throw new Error('the viewer\'s tray lost Raise hand ' + JSON.stringify(got.viewer));
  await viewer.locator('#react-hand').click();
  const line = await until('the host sees the raised hand', async () => {
    const t = await host.evaluate(() => { const q = document.getElementById('handq'); return q && q.getClientRects().length ? q.textContent : ''; });
    return { ok: /Jordan Lee/.test(t), t };
  }, 20000);
  return 'host tray ' + JSON.stringify(got.host) + ', viewer tray ' + JSON.stringify(got.viewer) + ', host line "' + line.t.trim() + '"';
});
