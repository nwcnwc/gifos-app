/*
 * cross-lobmuted.js — the small group lobby says "muted" once, on the
 * preview, and the card does not repeat it, on a real browser on each
 * machine (both open a small group's lobby, 1280x720).
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { BASE, user, run, sleep } = require('./cross-lib.js');

const read = (pg) => pg.evaluate(() => {
  const note = document.querySelector('#lob-preview .lob-pv-note');
  const quiet = document.querySelector('#lobby .lob-quiet');
  return { note: note.innerText, card: quiet.innerText, noteShown: note.getBoundingClientRect().height > 0 };
});

run('cross-lobmuted', async (hb, vb, shoot) => {
  const a = await user(hb, 'Avery Chen');
  const b = await user(vb, 'Jordan Lee');
  await a.goto(BASE + '/run.html?desk=crosslobmuteda');
  await b.goto(BASE + '/run.html?desk=crosslobmutedb');
  for (const pg of [a, b]) await pg.waitForSelector('#lobby.show');
  await sleep(400);
  const out = { first: await read(a), second: await read(b) };
  await shoot();
  for (const [who, g] of Object.entries(out)) {
    if (!g.noteShown || !/muted/i.test(g.note)) throw new Error(who + ': the preview does not say muted ' + JSON.stringify(out));
    if (/muted/i.test(g.card)) throw new Error(who + ': the card says muted again under the preview ' + JSON.stringify(out));
  }
  return 'muted said once, on the preview: ' + JSON.stringify(out);
});
