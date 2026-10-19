/*
 * cross-hostline.js — a live host with a viewer reads that they are live,
 * not the meeting count, and the hint names the viewer password.
 *
 *   1. the host goes live (see cross-lib.js)
 *   2. the viewer opens the link and saves the name card
 *   3. once the room bar counts the viewer, the host's status says
 *      You are live · NNNp · blurred until you set a viewer password,
 *      never N in this broadcast or a password unlocks clear video
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { until, goLive, watch, run } = require('./cross-lib.js');

run('cross-hostline', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'hostline');
  await watch(vb, host);
  await until('host counts the viewer', async () => ({ ok: (await host.locator('#airwho').textContent()) === '1 watching' }), 30000);
  await until('host line settles', async () => {
    const status = await host.locator('#status').textContent();
    return { ok: !/reconnecting|Going live|Send the link/.test(status), status };
  }, 30000);
  await host.waitForTimeout(1500);
  const status = await host.locator('#status').textContent();
  await shoot();
  if (!/^You are live · \d+p\b/.test(status) || !/blurred until you set a viewer password/.test(status)
    || /in this broadcast|a password unlocks/.test(status)) throw new Error('host read ' + JSON.stringify(status));
  return 'host reads ' + JSON.stringify(status);
});
