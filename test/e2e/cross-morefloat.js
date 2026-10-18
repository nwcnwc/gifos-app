/*
 * cross-morefloat.js — on a live service, Float in the More sheet reads at
 * the size of Who / Stage / Settings for the host and for a viewer on another
 * machine (1280x720), with a gap between its icon and its label.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. both open More and All tools; Float must be shown (Chromium has a mini window)
 *   3. Float's label must match Who's size and weight, 6px+ from its icon
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, sleep } = require('./cross-lib.js');

const read = (pg) => pg.evaluate(() => {
  const btn = document.getElementById('pipbtn');
  if (!btn || !btn.getClientRects().length) return { shown: false };
  const who = getComputedStyle(document.getElementById('whobtn'));
  const lab = btn.querySelector('.blab'), l = getComputedStyle(lab);
  return { shown: true, whoSize: who.fontSize, labSize: l.fontSize, whoWeight: who.fontWeight, labWeight: l.fontWeight,
    gap: Math.round(lab.getBoundingClientRect().left - btn.querySelector('svg').getBoundingClientRect().right) };
});

run('cross-morefloat', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'morefloat');
  const viewer = await watch(vb, host);
  for (const pg of [host, viewer]) {
    await pg.mouse.move(640, 400); // wake the controls (calm by default)
    await pg.locator('#bartoggle').click();
    // 0.9.23b's More opens on its first row; Who, Float and Settings wait under All tools.
    const tools = pg.locator('#moretools');
    if (await tools.isVisible() && (await tools.getAttribute('aria-expanded')) !== 'true') await tools.click();
    await pg.waitForSelector('#barmore #whobtn:visible');
  }
  await sleep(400);
  const got = { host: await read(host), viewer: await read(viewer) };
  await shoot();
  const bad = Object.entries(got).filter(([, g]) => !g.shown || g.labSize !== g.whoSize || Number(g.labWeight) < Number(g.whoWeight) || g.gap < 6);
  if (bad.length) throw new Error(bad.map(([who]) => who).join(' and ') + ': Float missing or small ' + JSON.stringify(got));
  return JSON.stringify(got);
});
