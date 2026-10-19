/*
 * cross-tilemenu.js — in a small group of two on two machines, clicking the
 * other person's tile opens its window (0.9.23b: the per-person controls
 * left the tile for the tile's own window), and every control in it is the
 * thing under the pointer, inside the screen: nothing covers Pin or Mute.
 *
 *   1. the first person starts a call and unmutes (a muted person has
 *      nothing to mute), the second opens its link
 *   2. the second clicks the first person's tile and reads its window
 *   3. Escape closes the window
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
  await a.mouse.move(640, 400);
  await a.locator('#mic').click();
  await until('Sam is unmuted', async () => ({ ok: (await a.locator('#mic').getAttribute('aria-label')) === 'Mute' }), 10000);
  const b = await user(vb, 'Jordan Lee');
  await b.goto(BASE + '/run.html?desk=crossmenub#' + a.url().split('#')[1]);
  await b.getByRole('button', { name: 'Save' }).click({ timeout: 20000 }).catch(() => {});
  await until('the first person\'s tile is up', async () => ({
    ok: await b.evaluate(() => Array.from(document.querySelectorAll('.tile:not(.me)')).some((x) => /Sam Rivera/.test(x.textContent))),
  }), 30000);
  const tile = b.locator('.tile:not(.me)', { hasText: 'Sam Rivera' });
  await b.mouse.move(640, 400);
  await tile.click();
  const got = await until('the window is open with Mute', async () => {
    const r = await b.evaluate(async () => {
      await new Promise((res) => requestAnimationFrame(res));
      const w = document.getElementById('tilewin');
      if (!w || w.hidden) return { ok: false, open: false };
      const shown = Array.from(w.querySelectorAll('button')).filter((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden');
      const names = shown.map((x) => x.textContent.trim());
      if (!names.includes('Pin') || !names.some((n) => /^Mute/.test(n))) return { ok: false, open: true, names };
      return {
        ok: true,
        title: (document.getElementById('tilewin-title') || {}).textContent,
        buttons: shown.map((x) => {
          const r2 = x.getBoundingClientRect();
          const top = document.elementFromPoint((r2.left + r2.right) / 2, (r2.top + r2.bottom) / 2);
          return { name: x.textContent.trim(), onTop: !!top && (top === x || x.contains(top)),
            inside: r2.left >= 0 && r2.top >= 0 && r2.right <= innerWidth && r2.bottom <= innerHeight };
        }),
      };
    });
    return r;
  }, 15000);
  await sleep(300);
  await shoot();
  if (got.title !== 'Sam Rivera') throw new Error('the window is not Sam\'s: ' + JSON.stringify(got));
  if (got.buttons.some((x) => !x.onTop || !x.inside)) throw new Error('a window control is covered or off screen: ' + JSON.stringify(got));
  await b.keyboard.press('Escape');
  await until('Escape closes the window', async () => ({ ok: await b.evaluate(() => { const w = document.getElementById('tilewin'); return !w || w.hidden; }) }), 3000);
  return JSON.stringify(got.buttons);
});
