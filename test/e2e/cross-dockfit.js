/*
 * cross-dockfit.js — with the chat open on a 900px window, the host's dock and
 * a viewer's (on another machine) fit in the call beside the chat, and what
 * left the dock is under More.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. both windows go to 900x720 and open Chat
 *   3. each dock must end 8px or more before the chat, centred in the call,
 *      with End or Leave still on it and every moved button in More
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, sleep } = require('./cross-lib.js');

const read = (pg) => pg.evaluate(() => {
  const edge = document.getElementById('chatpanel').getBoundingClientRect().left;
  const bar = document.querySelector('.bar');
  const d = bar.getBoundingClientRect();
  const shown = [...bar.children].filter((e) => e.tagName === 'BUTTON' && e.getClientRects().length).map((e) => e.id);
  const more = [...document.querySelectorAll('#barmore [data-dock]')].filter((e) => e.style.display !== 'none').map((e) => e.dataset.dock);
  return { edge: Math.round(edge), dockLeft: Math.round(d.left), dockRight: Math.round(d.right), shown, more };
});

run('cross-dockfit', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'dockfit');
  const viewer = await watch(vb, host);
  const full = {};
  for (const [who, pg] of [['host', host], ['viewer', viewer]]) {
    await pg.setViewportSize({ width: 900, height: 720 });
    await pg.mouse.move(300, 360);
    full[who] = (await read(pg)).shown;
    await pg.locator('#chatbtn').click();
    await pg.waitForSelector('#chatpanel.open');
  }
  await sleep(400);
  const out = { host: await read(host), viewer: await read(viewer) };
  await shoot();
  for (const [who, g] of Object.entries(out)) {
    const off = Math.abs((g.dockLeft + g.dockRight) / 2 - g.edge / 2);
    const lost = full[who].filter((id) => !g.shown.includes(id) && !g.more.includes(id));
    if (g.dockRight > g.edge - 8 || off > 2 || !g.shown.includes('leavebtn') || lost.length) {
      throw new Error(who + ': the dock does not fit beside the chat ' + JSON.stringify({ out, full, lost }));
    }
  }
  return 'both docks fit in the call: ' + JSON.stringify(out);
});
