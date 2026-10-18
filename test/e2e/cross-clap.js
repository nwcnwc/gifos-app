/*
 * cross-clap.js — a viewer's clap crosses a real link to the host's stage.
 *
 * The specs fake the frame. This one runs two real browsers, each on its own
 * machine if you give it two Playwright run-servers, through a real relay:
 *
 *   1. the host goes live, the viewer opens the link (see cross-lib.js)
 *   2. the viewer claps twice the moment its link opens
 *   3. both stages read 👏 2, the host's never more
 *   4. the host's room bar reads 1 watching
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { sleep, until, goLive, watch, run } = require('./cross-lib.js');

run('cross-clap', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'clap');
  const viewer = await watch(vb, host);
  // The viewer claps twice inside the page the moment its link opens, with
  // no round trip to this script in between: that is when the roster is
  // still catching up.
  await viewer.evaluate(() => new Promise((resolve, reject) => {
    const end = Date.now() + 60000;
    const tray = () => document.querySelector('#reacttray button[aria-label="Clap"]');
    (function wait() {
      if (window.__gifosVideo.liveDataLinks() >= 1) {
        document.getElementById('reactbtn').click();
        tray().click();
        setTimeout(() => { if (!tray().offsetParent) document.getElementById('reactbtn').click(); tray().click(); resolve(); }, 400);
      } else if (Date.now() > end) reject(new Error('no link in 60s'));
      else setTimeout(wait, 20);
    })();
  }));
  // The count pill only: the line under it names who clapped (cross-clapwho).
  const pills = () => Array.from(document.querySelectorAll('#bc-reacts .bcreact')).map((p) => p.innerText.trim()).join(' ');
  // The pills fade 4 s after the last clap, so both stages are read now.
  const t0 = Date.now();
  let host2 = '', seen = '';
  while (Date.now() - t0 < 3000) {
    const v = await viewer.evaluate(pills), h = await host.evaluate(pills);
    seen = 'viewer ' + JSON.stringify(v) + ', host ' + JSON.stringify(h);
    if (h && h !== '👏 2') host2 = h; // a third copy, or only one clap
    if (v === '👏 2' && h === '👏 2') break;
    await sleep(150);
  }
  if (seen !== 'viewer "👏 2", host "👏 2"') { await shoot(); throw new Error('stages read ' + seen); }
  // A late copy over the other path must not add a third. Read before the
  // shots: a remote screenshot can outlast the pills.
  await sleep(800);
  const after = await host.evaluate(pills);
  await shoot();
  if (after !== '👏 2') throw new Error('host stage moved to ' + JSON.stringify(after) + (host2 ? ' after ' + host2 : ''));
  await until('host room bar counts the viewer', async () => {
    const t = await host.locator('#airbar').innerText();
    return { ok: /\b1 watching\b/.test(t), t };
  }, 20000);
  return 'viewer clapped twice as the link opened; host stage reads 👏 2, room bar 1 watching';
});
