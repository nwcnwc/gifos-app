/*
 * cross-camoff.js — a viewer sees who is on stage when the host's camera is off.
 *
 *   1. the host goes live with the camera off (the default), the viewer
 *      opens the link (see cross-lib.js)
 *   2. the viewer's stage gets the host's frame
 *   3. the viewer reads the host's name and Camera off on the stage, and the
 *      black frame under it is not shown
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { sleep, until, goLive, watch, run } = require('./cross-lib.js');

run('cross-camoff', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'camoff');
  const viewer = await watch(vb, host);
  await until('the viewer stage has the host frame', async () => ({ ok: await viewer.evaluate(() => !!document.querySelector('#stagefeed .rowtile video')) }), 30000);
  await sleep(3000); // the host's status and name settle
  const seen = await viewer.evaluate(() => {
    const card = document.getElementById('bc-ident');
    const v = document.querySelector('#stagefeed .rowtile video');
    return { card: card.offsetParent || getComputedStyle(card).display !== 'none' ? card.innerText.replace(/\s+/g, ' ').trim() : '',
      frame: getComputedStyle(v).visibility };
  });
  await shoot();
  if (!/Pastor Kim/.test(seen.card) || !/Camera off/.test(seen.card) || seen.frame !== 'hidden') throw new Error('viewer stage reads ' + JSON.stringify(seen));
  return 'the viewer reads ' + JSON.stringify(seen.card) + ' on the stage';
});
