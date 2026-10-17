/*
 * cross-tilemenu.js — in a small group of two on two machines, hovering the
 * other person's tile opens its menu (Mute, Blur) clear of the tile's "Blur
 * for all" box: every menu button is the thing under the pointer.
 *
 *   1. the first person starts a call, the second opens its link
 *   2. the second hovers the first person's tile and reads its menu
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { BASE, until, user, run, sleep } = require('./cross-lib.js');

run('cross-tilemenu', async (hb, vb, shoot) => {
  const a = await user(hb, 'Sam Rivera');
  await a.goto(BASE + '/run.html?desk=crossmenua');
  await a.waitForSelector('#lobby.show');
  await a.locator('#lob-open').click();
  await until('call started', async () => ({ ok: /#v=/.test(a.url()) }), 15000);
  const b = await user(vb, 'Jordan Lee');
  await b.goto(BASE + '/run.html?desk=crossmenub#' + a.url().split('#')[1]);
  await b.getByRole('button', { name: 'Save' }).click({ timeout: 20000 }).catch(() => {});
  await until('the first person\'s tile and Blur box are up', async () => ({
    ok: await b.evaluate(() => Array.from(document.querySelectorAll('.tile:not(.me)')).some((x) => /Sam Rivera/.test(x.textContent) && x.querySelector(':scope > .blurbox.on'))),
  }), 30000);
  const tile = b.locator('.tile:not(.me)', { hasText: 'Sam Rivera' });
  await tile.hover();
  const got = await until('the menu is open', async () => {
    const r = await b.evaluate(async () => {
      await new Promise((res) => requestAnimationFrame(res));
      const t = Array.from(document.querySelectorAll('.tile:not(.me)')).find((x) => /Sam Rivera/.test(x.textContent));
      const shown = Array.from(t.querySelectorAll('.modbar button')).filter((x) => x.getClientRects().length);
      if (shown.length < 2) return { ok: false };
      const blur = t.querySelector(':scope > .blurbox').getBoundingClientRect();
      const hit = (p, q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 0 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 0;
      return {
        ok: true,
        buttons: shown.map((x) => {
          const r2 = x.getBoundingClientRect();
          const top = document.elementFromPoint((r2.left + r2.right) / 2, (r2.top + r2.bottom) / 2);
          return { name: x.textContent, onTop: top === x, underBlur: hit(r2, blur) };
        }),
      };
    });
    return r;
  }, 10000);
  await sleep(300);
  await shoot();
  if (got.buttons.some((x) => !x.onTop || x.underBlur)) throw new Error('a menu button is under Blur for all: ' + JSON.stringify(got));
  return JSON.stringify(got.buttons);
});
