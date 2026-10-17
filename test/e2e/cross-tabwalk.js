/*
 * cross-tabwalk.js — in a live service, Tab stops only on controls you can
 * see, on the host and on a viewer on another machine.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each walks the page with Tab and notes any stop with nothing drawn
 *      at its centre (the clipped links for AI agents were eight of them)
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run } = require('./cross-lib.js');

async function walk(pg) {
  await pg.evaluate(() => document.activeElement && document.activeElement.blur());
  const hidden = [];
  let dock = 0;
  for (let i = 0; i < 30; i++) {
    await pg.keyboard.press('Tab');
    const stop = await pg.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const r = e.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && document.elementFromPoint(x, y);
      return { id: e.id, name: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30), seen: !!hit && (e === hit || e.contains(hit)) };
    });
    if (!stop) continue;
    if (stop.id === 'chatbtn') dock++;
    if (!stop.seen) hidden.push(stop.name);
  }
  return { dock, hidden };
}

run('cross-tabwalk', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'tabwalk');
  const viewer = await watch(vb, host);
  const out = { host: await walk(host), viewer: await walk(viewer) };
  await shoot();
  for (const [who, s] of Object.entries(out)) {
    if (!s.dock || s.hidden.length) throw new Error(who + ' Tab walk: ' + JSON.stringify(out));
  }
  return 'every stop is drawn on both: ' + JSON.stringify(out);
});
