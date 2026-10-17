/*
 * cross-wholive.js — a joined viewer's header names who is live instead of
 * saying watching a third time beside the WATCHING badge and the room bar.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. once the host counts the viewer, the viewer's status line reads
 *      Pastor Kim is live. and does not say watching
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { until, goLive, watch, run } = require('./cross-lib.js');

run('cross-wholive', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'wholive');
  const viewer = await watch(vb, host);
  await until('host counts the viewer', async () => ({ ok: (await host.locator('#airwho').textContent()) === '1 watching' }), 30000);
  const r = await until('viewer line names the host', async () => {
    const status = await viewer.locator('#status').textContent();
    return { ok: /^Pastor Kim is live\./.test(status) && !/watching/.test(status), status };
  }, 20000);
  await shoot();
  return 'viewer reads ' + JSON.stringify(r.status);
});
