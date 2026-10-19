/*
 * cross-morehand.js — a live host's More sheet has no Hand; a viewer (on
 * another machine, 1280x720) still raises a hand from the dock and the host's
 * raised-hands line names them.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. both open More; the host's sheet must not offer Hand
 *   3. the viewer presses Raise hand on the dock; the host's line must say Jordan Lee
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, until, sleep } = require('./cross-lib.js');

const shown = (pg, sel) => pg.locator(sel).evaluateAll((bs) => bs.filter((b) => b.getClientRects().length).map((b) => (b.getAttribute('aria-label') || b.textContent).trim()));

run('cross-morehand', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'morehand');
  const viewer = await watch(vb, host);
  for (const pg of [host, viewer]) { await pg.locator('#bartoggle').click(); await pg.waitForSelector('#barmore', { state: 'visible' }); }
  await sleep(400);
  const got = { host: await shown(host, '#barmore button'), viewer: await shown(viewer, '#barmore button'), viewerDock: await shown(viewer, '.bar > #hand') };
  await shoot();
  if (got.host.some((t) => /hand/i.test(t))) throw new Error('the host\'s More offers ' + JSON.stringify(got.host));
  if (got.viewerDock[0] !== 'Raise hand') throw new Error('the viewer lost Raise hand ' + JSON.stringify(got));
  await viewer.locator('#bartoggle').click();
  await viewer.locator('.bar > #hand').click();
  const line = await until('the host sees the raised hand', async () => {
    const t = await host.evaluate(() => { const q = document.getElementById('handq'); return q && q.getClientRects().length ? q.textContent : ''; });
    return { ok: /Jordan Lee/.test(t), t };
  }, 20000);
  return 'host More ' + JSON.stringify(got.host) + ', viewer dock ' + JSON.stringify(got.viewerDock) + ', host line "' + line.t.trim() + '"';
});
