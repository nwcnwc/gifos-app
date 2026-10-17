/*
 * cross-chathead.js — the chat head keeps Transcript, Turn chat off and the
 * close ✕ on the title's row, on the host and on a viewer on another machine
 * (1280x720), and the privacy line under it reads as a sentence.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each opens Chat; every shown head button must sit on the title's row
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, sleep } = require('./cross-lib.js');

async function openChat(pg) {
  await pg.locator('#chatbtn').click();
  await pg.waitForSelector('#chatpanel.open');
  await sleep(400);
  return pg.evaluate(() => {
    const mid = (r) => Math.round((r.top + r.bottom) / 2);
    const title = mid(document.getElementById('paneltitle').getBoundingClientRect());
    const off = [];
    for (const e of document.querySelectorAll('#chathead button')) {
      if (!e.getClientRects().length || getComputedStyle(e).display === 'none') continue;
      const m = mid(e.getBoundingClientRect());
      if (Math.abs(m - title) > 4) off.push(e.id + ' ' + m);
    }
    return { title, off, privacy: document.getElementById('chatprivacy').textContent };
  });
}

run('cross-chathead', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'chathead');
  const viewer = await watch(vb, host);
  const out = { host: await openChat(host), viewer: await openChat(viewer) };
  await shoot();
  for (const [who, s] of Object.entries(out)) {
    if (s.off.length || !/^Private to this service, gone when everyone leaves$/.test(s.privacy)) throw new Error(who + ': the chat head wraps ' + JSON.stringify(out));
  }
  return 'the chat head is one row on both: ' + JSON.stringify(out);
});
