/*
 * cross-viewline.js — a joined viewer's line says who is live (or that they
 * are watching, before the host's name is known), never the video quality,
 * the password hint or the people count. (The line naming the host replaced
 * "You are watching this service." once the badge and the room bar said
 * watching already; see cross-wholive.)
 *
 *   1. the host goes live (see cross-lib.js)
 *   2. the viewer opens the link and saves the name card
 *   3. once the room bar counts the viewer, the viewer's status says
 *      "Pastor Kim is live." (or "You are watching this service.") with no
 *      NNNp label, no password hint and no count
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { until, goLive, watch, run } = require('./cross-lib.js');

run('cross-viewline', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'viewline');
  const viewer = await watch(vb, host);
  // the host's own page counting the viewer means the link is up
  await until('host counts the viewer', async () => ({ ok: (await host.locator('#airwho').textContent()) === '1 watching' }), 30000);
  const r = await until('viewer line settles', async () => {
    const status = await viewer.locator('#status').textContent();
    return { ok: !/reconnecting|Joining/.test(status), status };
  }, 30000);
  await viewer.waitForTimeout(1500);
  const status = await viewer.locator('#status').textContent();
  await shoot();
  if (!/^(Pastor Kim is live|You are watching this service)\./.test(status) || /\d+p\b|password|clear video|in this service/.test(status)) throw new Error('viewer read ' + JSON.stringify(status));
  return 'viewer reads ' + JSON.stringify(status);
});
