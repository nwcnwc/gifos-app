/*
 * cross-namecard.js — a viewer at the name card has no camera or mic on the
 * dock; the host who went live has both.
 *
 *   1. the host goes live (see cross-lib.js)
 *   2. the viewer opens the link and stops at "This is how you'll appear"
 *   3. the viewer's dock has no Video or Unmute, before and after Save
 *   4. the host's dock has Video and Unmute
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { BASE, until, goLive, user, run, saveName } = require('./cross-lib.js');

const dock = (pg) => pg.evaluate(() => ['cam', 'mic'].filter((id) => {
  const el = document.querySelector('.bar #' + id);
  return el && el.offsetParent;
}));

run('cross-namecard', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'card');
  const viewer = await user(vb, 'Jordan Lee');
  await viewer.goto(BASE + '/run.html?desk=crossview#' + host.url().split('#')[1]);
  await viewer.locator('#appear-note').waitFor({ timeout: 20000 });
  const atCard = await dock(viewer);
  await shoot();
  await saveName(viewer);
  await until('viewer is watching', async () => ({ ok: (await viewer.locator('#airkind').textContent()) === 'Service · You are watching' }), 15000);
  const watching = await dock(viewer);
  const hostDock = await dock(host);
  const seen = { atCard, watching, hostDock };
  if (atCard.length || watching.length || hostDock.length !== 2) throw new Error('docks read ' + JSON.stringify(seen));
  return 'viewer dock has no camera or mic at the card or after; host has both ' + JSON.stringify(seen);
});
