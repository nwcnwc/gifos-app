/*
 * cross-chathead.js — the chat head is tidy and readable, on the host and on
 * a viewer on another machine (1280x720): the close ✕ sits on the title's row
 * (never alone on a row of its own), Transcript and Turn chat off share one
 * row, every word in the head is 16px or more, and the privacy line under it
 * reads as a sentence. (0.9.23b: the head reads like every other window,
 * title and ✕ first; the old all-on-one-row head needed 12px buttons.)
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each opens Chat and reads the head
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
    const shown = [...document.querySelectorAll('#chathead button')].filter((e) => e.getClientRects().length && getComputedStyle(e).display !== 'none');
    const x = shown.find((e) => e.id === 'chatclose');
    if (!x || Math.abs(mid(x.getBoundingClientRect()) - title) > 4) off.push('chatclose ' + (x ? mid(x.getBoundingClientRect()) : 'missing'));
    const rest = shown.filter((e) => e !== x).map((e) => ({ id: e.id, m: mid(e.getBoundingClientRect()) }));
    for (const r of rest) if (Math.abs(r.m - rest[0].m) > 4) off.push(r.id + ' ' + r.m + ' vs ' + rest[0].id + ' ' + rest[0].m);
    const small = [document.getElementById('paneltitle'), document.getElementById('chatprivacy'), ...shown]
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.id + ' ' + getComputedStyle(e).fontSize);
    return { title, off, small, privacy: document.getElementById('chatprivacy').textContent };
  });
}

run('cross-chathead', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'chathead');
  const viewer = await watch(vb, host);
  const out = { host: await openChat(host), viewer: await openChat(viewer) };
  await shoot();
  for (const [who, s] of Object.entries(out)) {
    if (s.off.length || s.small.length || !/^Private to this broadcast, gone when everyone leaves$/.test(s.privacy)) throw new Error(who + ': the chat head is untidy or small ' + JSON.stringify(out));
  }
  return 'the chat head is tidy and 16px on both: ' + JSON.stringify(out);
});
