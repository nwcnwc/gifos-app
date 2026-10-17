/*
 * cross-hostfit.js — a live host at 900 wide reads the whole status line,
 * the viewer password hint included, also while the relay is down.
 *
 *   1. the host goes live (see cross-lib.js) and the window is 900 wide;
 *      its relay socket runs through the test so the test can cut it
 *   2. the viewer opens the link and saves the name card
 *   3. once the room bar counts the viewer, the relay is cut and refused,
 *      the line adds reconnecting to the room…, and it must still name the
 *      viewer password with nothing cut off
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { RELAY, until, goLive, watch, run } = require('./cross-lib.js');

run('cross-hostfit', async (hb, vb, shoot) => {
  let cut = false;
  const open = new Set();
  const host = await goLive(hb, 'hostfit', (page) => page.routeWebSocket((u) => u.href.startsWith(RELAY), (ws) => {
    if (cut) { ws.close(); return; }
    ws.connectToServer();
    open.add(ws);
  }));
  await host.setViewportSize({ width: 900, height: 720 });
  await watch(vb, host);
  await until('host counts the viewer', async () => ({ ok: (await host.locator('#airwho').textContent()) === '1 watching' }), 30000);
  await until('host line names the viewer password', async () => {
    const status = await host.locator('#status').textContent();
    return { ok: /blurred until you set a viewer password/.test(status), status };
  }, 30000);
  cut = true;
  for (const ws of open) await ws.close().catch(() => {});
  await until('host line says reconnecting and keeps the hint', async () => {
    const status = await host.locator('#status').textContent();
    return { ok: /reconnecting to the room/.test(status) && /blurred until you set a viewer password/.test(status), status };
  }, 30000);
  await host.waitForTimeout(1000);
  const fit = await host.locator('#status').evaluate((el) => ({ text: el.textContent,
    w: el.scrollWidth <= el.clientWidth + 1, h: el.scrollHeight <= el.clientHeight + 1,
    clearOfBar: el.closest('.topchip').getBoundingClientRect().bottom <= document.getElementById('airbar').getBoundingClientRect().top }));
  await shoot();
  if (!fit.w || !fit.h || !fit.clearOfBar) throw new Error('host line cut: ' + JSON.stringify(fit));
  return 'host reads ' + JSON.stringify(fit.text) + ' whole';
});
