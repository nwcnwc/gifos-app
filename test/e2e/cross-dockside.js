/*
 * cross-dockside.js — with the chat open, the host's and a viewer's dock (on
 * another machine, 1280x720) sit centred in the call beside the chat, clear
 * of its edge, and the chat's composer reaches the panel's bottom.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. both open Chat
 *   3. each dock must end 8px or more before the chat, centred in the call
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, sleep } = require('./cross-lib.js');

const read = (pg) => pg.evaluate(() => {
  const edge = document.getElementById('chatpanel').getBoundingClientRect().left;
  const d = document.querySelector('.bar').getBoundingClientRect();
  const send = document.querySelector('#chatform button[type="submit"]').getBoundingClientRect();
  return { edge: Math.round(edge), dockLeft: Math.round(d.left), dockRight: Math.round(d.right), sendBottom: Math.round(send.bottom), h: innerHeight };
});

run('cross-dockside', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'dockside');
  const viewer = await watch(vb, host);
  for (const pg of [host, viewer]) { await pg.mouse.move(400, 360); await pg.locator('#chatbtn').click(); await pg.waitForSelector('#chatpanel.open'); }
  await sleep(400);
  const out = { host: await read(host), viewer: await read(viewer) };
  await shoot();
  for (const [who, g] of Object.entries(out)) {
    const off = Math.abs((g.dockLeft + g.dockRight) / 2 - g.edge / 2);
    if (g.dockRight > g.edge - 8 || off > 2 || g.sendBottom < g.h - 24) throw new Error(who + ': the dock runs across the chat\'s edge ' + JSON.stringify(out));
  }
  return 'both docks sit in the call beside the chat: ' + JSON.stringify(out);
});
