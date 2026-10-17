/*
 * cross-cardstatus.js — a viewer at the name card reads that they are joining,
 * not "watching · reconnecting to the room…" and "1 watching".
 *
 *   1. the host goes live (see cross-lib.js)
 *   2. the viewer opens the link and stops at "This is how you'll appear"
 *   3. the viewer's status says Joining the service…, and no count shows
 *   4. after Save the viewer reads 1 watching (themselves; the host is not)
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { BASE, until, goLive, user, run } = require('./cross-lib.js');

const read = (pg) => pg.evaluate(() => {
  const who = document.getElementById('airwho');
  return { status: document.getElementById('status').textContent, who: who && who.offsetParent ? who.textContent : null };
});

run('cross-cardstatus', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'cardstatus');
  const viewer = await user(vb, 'Jordan Lee');
  await viewer.goto(BASE + '/run.html?desk=crossview#' + host.url().split('#')[1]);
  await viewer.locator('#appear-note').waitFor({ timeout: 20000 });
  await viewer.waitForSelector('#airbar.on.watch');
  await viewer.waitForTimeout(1500);
  const atCard = await read(viewer);
  await shoot();
  await viewer.getByRole('button', { name: 'Save' }).click();
  const joined = await until('viewer counts one watching', async () => {
    const r = await read(viewer);
    return { ok: r.who === '1 watching' && !/reconnecting|Joining/.test(r.status), ...r };
  }, 30000);
  const seen = { atCard, joined: { status: joined.status, who: joined.who } };
  if (atCard.status !== 'Joining the service…' || atCard.who !== null) throw new Error('viewer read ' + JSON.stringify(seen));
  return 'viewer at the card reads joining with no count, then 1 watching ' + JSON.stringify(seen);
});
