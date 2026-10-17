/*
 * cross-chatside.js — the open chat sits beside the room bar and stage, not
 * over them, on the host and on a viewer on another machine (1280x720).
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each opens Chat; nothing of the room bar, header or stage may reach
 *      under the panel, and the room bar stays one line
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, sleep } = require('./cross-lib.js');

async function openChat(pg) {
  await pg.locator('#chatbtn').click();
  await pg.waitForSelector('#chatpanel.open');
  await sleep(400);
  return pg.evaluate(() => {
    const edge = document.getElementById('chatpanel').getBoundingClientRect().left;
    const under = [];
    for (const e of document.querySelectorAll('#airbar *, #status, #hdrinvite, #fitbtn, #bc-stage, #bc-stage-line')) {
      if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') continue;
      const r = e.getBoundingClientRect();
      if (r.width > 1 && r.right > edge + 1) under.push((e.id || e.className) + ' ' + Math.round(r.right));
    }
    return { edge: Math.round(edge), under, bar: Math.round(document.getElementById('airbar').getBoundingClientRect().height) };
  });
}

run('cross-chatside', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'chatside');
  const viewer = await watch(vb, host);
  const out = { host: await openChat(host), viewer: await openChat(viewer) };
  await shoot();
  for (const [who, s] of Object.entries(out)) {
    if (s.under.length || s.bar > 60) throw new Error(who + ': the chat covers ' + JSON.stringify(out));
  }
  return 'the chat sits beside the room bar and stage on both: ' + JSON.stringify(out);
});
