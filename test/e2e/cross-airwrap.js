/*
 * cross-airwrap.js — with the chat open on a 900px window, the room bar keeps
 * its title and each pill on one line, on the host and on a viewer on another
 * machine.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. both windows go to 900x720 and open Chat
 *   3. the title and every pill must be one line, whole, inside the bar
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, sleep } = require('./cross-lib.js');

const read = (pg) => pg.evaluate(() => {
  const bar = document.getElementById('airbar').getBoundingClientRect();
  const lines = (e) => {
    const t = document.createRange();
    t.selectNodeContents(e);
    return new Set(Array.from(t.getClientRects()).filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
  };
  const out = { title: lines(document.getElementById('airkind')), barH: Math.round(bar.height), pills: {} };
  for (const id of ['airrec', 'airwho', 'airsound']) {
    const e = document.getElementById(id);
    if (!e || !e.offsetWidth) continue;
    const r = e.getBoundingClientRect();
    out.pills[id] = { lines: lines(e), over: e.scrollWidth - e.clientWidth, inside: r.left >= bar.left && r.right <= bar.right && r.bottom <= bar.bottom };
  }
  return out;
});

run('cross-airwrap', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'airwrap');
  const viewer = await watch(vb, host);
  for (const pg of [host, viewer]) {
    await pg.setViewportSize({ width: 900, height: 720 });
    await pg.mouse.move(300, 360);
    await pg.locator('#chatbtn').click();
    await pg.waitForSelector('#chatpanel.open');
  }
  await sleep(400);
  const out = { host: await read(host), viewer: await read(viewer) };
  await shoot();
  for (const [who, g] of Object.entries(out)) {
    const bad = g.title !== 1 || Object.values(g.pills).some((p) => p.lines !== 1 || p.over > 0 || !p.inside);
    if (bad) throw new Error(who + ': the room bar breaks its lines ' + JSON.stringify(out));
  }
  return 'both room bars keep one line each: ' + JSON.stringify(out);
});
