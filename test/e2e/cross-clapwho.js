/*
 * cross-clapwho.js — a viewer's clap on another machine shows on the host's
 * stage with the viewer's name, and as You on the viewer's own stage.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. the viewer claps once
 *   3. the host's stage reads 👏 1 and Jordan Lee; the viewer's reads You
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { sleep, goLive, watch, run } = require('./cross-lib.js');

const read = (pg) => pg.evaluate(() => {
  const t = (sel) => { const el = document.querySelector(sel); return el ? el.textContent : null; };
  return { pill: t('#bc-reacts .bcreact'), who: t('#bc-reacts .bcwho') };
});

run('cross-clapwho', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'clapwho');
  const viewer = await watch(vb, host);
  // The roster names the viewer on the host before the clap.
  await host.waitForFunction(() => /\b1 watching\b/.test(document.getElementById('airbar').innerText), null, { timeout: 30000 });
  await viewer.locator('#reactbtn').click();
  await viewer.locator('#reacttray button[aria-label="Clap"]').click();
  // The pills fade 4 s after the clap, so both stages are read now.
  const want = JSON.stringify({ host: { pill: '👏 1', who: 'Jordan Lee' }, viewer: { pill: '👏 1', who: 'You' } });
  let seen = '';
  const t0 = Date.now();
  while (Date.now() - t0 < 3500) {
    seen = JSON.stringify({ host: await read(host), viewer: await read(viewer) });
    if (seen === want) break;
    await sleep(120);
  }
  await shoot();
  if (seen !== want) throw new Error('stages read ' + seen);
  return 'host stage names Jordan Lee, viewer stage reads You: ' + seen;
});
