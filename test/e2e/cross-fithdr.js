/*
 * cross-fithdr.js — in a small group of two on two machines, the second
 * person's Fit pill must not cover the first person's tile: its "Blur for
 * all" button stays the thing under the pointer, and Fit touches no tile.
 *
 *   1. the first person starts a call, the second opens its link
 *   2. the second reads Fit and the first person's tile and Blur button
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
  await b.mouse.move(640, 400);
  const got = await until('the first person\'s Blur button is up', async () => {
    const r = await b.evaluate(async () => {
      await new Promise((res) => requestAnimationFrame(res));
      const t = Array.from(document.querySelectorAll('.tile:not(.me)')).find((x) => /Sam Rivera/.test(x.textContent));
      const blur = t && t.querySelector(':scope > .blurbox.on');
      if (!blur) return { ok: false };
      const fitEl = document.getElementById('fitbtn');
      const fit = fitEl.getBoundingClientRect();
      const hit = (p, q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 0 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 0;
      const br = blur.getBoundingClientRect();
      const top = document.elementFromPoint((br.left + br.right) / 2, (br.top + br.bottom) / 2);
      return {
        ok: true,
        fitShown: fitEl.getClientRects().length > 0 && getComputedStyle(fitEl).visibility !== 'hidden',
        fit: [Math.round(fit.left), Math.round(fit.top), Math.round(fit.right), Math.round(fit.bottom)],
        blur: [Math.round(br.left), Math.round(br.top), Math.round(br.right), Math.round(br.bottom)],
        blurOnTop: top === blur,
        tilesUnderFit: Array.from(document.querySelectorAll('.tile')).filter((x) => x.getClientRects().length && hit(fit, x.getBoundingClientRect())).length,
      };
    });
    return r;
  }, 20000);
  await sleep(300);
  await shoot();
  if (!got.fitShown) throw new Error('Fit is not shown: ' + JSON.stringify(got));
  if (!got.blurOnTop || got.tilesUnderFit) throw new Error('Fit covers a tile: ' + JSON.stringify(got));
  return JSON.stringify(got);
});
