/*
 * cross-fithdr.js — in a small group of two on two machines, the second
 * person's Fit pill must not cover the first person's tile: the tile's top
 * right corner (where its marks sit) stays the thing under the pointer, and
 * Fit touches no tile. (0.9.23b took the "Blur for all" box off the tile;
 * it lives in the tile's window now, see cross-tilemenu.)
 *
 *   1. the first person starts a call, the second opens its link
 *   2. the second wakes the controls and reads Fit and the first person's tile
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { BASE, until, user, run, sleep } = require('./cross-lib.js');

run('cross-fithdr', async (hb, vb, shoot) => {
  const a = await user(hb, 'Sam Rivera');
  await a.goto(BASE + '/run.html?desk=crossfita');
  await a.waitForSelector('#lobby.show');
  await a.locator('#lob-open').click();
  await until('call started', async () => ({ ok: /#v=/.test(a.url()) }), 15000);
  const b = await user(vb, 'Jordan Lee');
  await b.goto(BASE + '/run.html?desk=crossfitb#' + a.url().split('#')[1]);
  await b.getByRole('button', { name: 'Save' }).click({ timeout: 20000 }).catch(() => {});
  await until('both in the call', async () => ({
    ok: await b.evaluate(() => document.querySelectorAll('.tile:not(.me)').length >= 1),
  }), 30000);
  await b.mouse.move(640, 400); // wake the controls (calm by default)
  const got = await until('the first person\'s tile is up', async () => {
    const r = await b.evaluate(async () => {
      await new Promise((res) => requestAnimationFrame(res));
      const t = Array.from(document.querySelectorAll('.tile:not(.me)')).find((x) => /Sam Rivera/.test(x.textContent));
      if (!t || !t.getClientRects().length) return { ok: false };
      const fitEl = document.getElementById('fitbtn');
      const fit = fitEl.getBoundingClientRect();
      const hit = (p, q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 0 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 0;
      const tr = t.getBoundingClientRect();
      // The tile's top-right corner, where the tile's own marks sit: the
      // tile, not Fit, is under the pointer there.
      const corner = document.elementFromPoint(tr.right - 20, tr.top + 20);
      return {
        ok: true,
        fitShown: fitEl.getClientRects().length > 0 && getComputedStyle(fitEl).visibility !== 'hidden' && getComputedStyle(fitEl).opacity !== '0',
        fit: [Math.round(fit.left), Math.round(fit.top), Math.round(fit.right), Math.round(fit.bottom)],
        tile: [Math.round(tr.left), Math.round(tr.top), Math.round(tr.right), Math.round(tr.bottom)],
        cornerOnTile: !!(corner && t.contains(corner)),
        tilesUnderFit: Array.from(document.querySelectorAll('.tile')).filter((x) => x.getClientRects().length && hit(fit, x.getBoundingClientRect())).length,
      };
    });
    return r;
  }, 20000);
  await sleep(300);
  await shoot();
  if (!got.fitShown) throw new Error('Fit is not shown: ' + JSON.stringify(got));
  if (!got.cornerOnTile || got.tilesUnderFit) throw new Error('Fit covers a tile: ' + JSON.stringify(got));
  return JSON.stringify(got);
});
