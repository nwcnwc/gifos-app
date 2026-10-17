/*
 * cross-votesheet.js — in a small group of two on two machines, the Place a
 * vote sheet is readable: each option's hint and Cancel reach 4.5:1 against
 * what is behind them.
 *
 *   1. the first person starts a call, the second opens its link
 *   2. once the room has no admin (Vote is offered), the first opens Vote
 *      and reads the colors
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { BASE, until, user, run } = require('./cross-lib.js');

run('cross-votesheet', async (hb, vb, shoot) => {
  const a = await user(hb, 'Sam Rivera');
  await a.goto(BASE + '/run.html?desk=crossvotea');
  await a.waitForSelector('#lobby.show');
  await a.locator('#lob-open').click();
  await until('call started', async () => ({ ok: /#v=/.test(a.url()) }), 15000);
  const b = await user(vb, 'Jordan Lee');
  await b.goto(BASE + '/run.html?desk=crossvoteb#' + a.url().split('#')[1]);
  await b.getByRole('button', { name: 'Save' }).click({ timeout: 20000 }).catch(() => {});
  await until('both in the call', async () => ({
    ok: await a.evaluate(() => document.querySelectorAll('.tile:not(.me)').length >= 1 && document.body.classList.contains('canvote')),
  }), 30000);
  // Vote sits in More on a narrow dock; the sheet is the same either way.
  await a.evaluate(() => document.getElementById('votebtn').click());
  await a.waitForSelector('#vote-modal', { state: 'visible' });
  const got = await a.evaluate(() => {
    const rgba = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = (c) => { const v = c.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const under = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c.length === 3 || c[3] === 1) return c.slice(0, 3); } return [255, 255, 255]; };
    const ratio = (el) => {
      const c = rgba(getComputedStyle(el).color), bg = under(el);
      let al = c.length > 3 ? c[3] : 1; for (let e = el; e; e = e.parentElement) al *= parseFloat(getComputedStyle(e).opacity);
      const fg = c.slice(0, 3).map((x, i) => x * al + bg[i] * (1 - al));
      const x = lum(fg), y = lum(bg); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 10) / 10;
    };
    const out = {};
    for (const o of document.querySelectorAll('#vote-modal .voteopt')) out[o.dataset.vm] = ratio(o.querySelector('small'));
    out.cancel = ratio(document.getElementById('vote-cancel'));
    return out;
  });
  await a.waitForTimeout(300);
  await shoot();
  if (Object.values(got).some((r) => r < 4.5)) throw new Error('the vote sheet is hard to read ' + JSON.stringify(got));
  return 'vote sheet ' + JSON.stringify(got);
});
