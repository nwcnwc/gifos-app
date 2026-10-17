/*
 * cross-moreblur.js — a live host's More sheet (1280x720, one viewer on
 * another machine watching) shows its Blur row at the sheet's size: the word
 * Blur as large as the sheet's buttons, and Max / Min / No blur at least 16px
 * in boxes at least 48px tall. The viewer's sheet has no Blur row.
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, sleep } = require('./cross-lib.js');

run('cross-moreblur', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'moreblur');
  const viewer = await watch(vb, host);
  for (const pg of [host, viewer]) { await pg.locator('#bartoggle').click(); await pg.waitForSelector('#barmore', { state: 'visible' }); }
  await sleep(400);
  const got = await host.evaluate(() => {
    const px = (el) => parseFloat(getComputedStyle(el).fontSize);
    const sheet = document.getElementById('barmore');
    const btn = sheet.querySelector(':scope > button:not([hidden])');
    const lbl = sheet.querySelector('.blurlbl');
    const segs = Array.from(sheet.querySelectorAll('.seg')).filter((s) => s.getClientRects().length);
    return { btn: px(btn), lbl: px(lbl), seg: Math.min(...segs.map(px)), segH: Math.min(...segs.map((s) => Math.round(s.getBoundingClientRect().height))), segs: segs.length };
  });
  const viewerBlur = await viewer.locator('#barmore .blurctl').evaluateAll((els) => els.filter((e) => e.getClientRects().length).length);
  await shoot();
  if (got.segs !== 3) throw new Error('the host\'s Blur row has ' + got.segs + ' choices');
  if (got.lbl !== got.btn || got.seg < 16 || got.segH < 48) throw new Error('the host\'s Blur row is small ' + JSON.stringify(got));
  if (viewerBlur) throw new Error('the viewer\'s sheet shows a Blur row');
  return 'host Blur ' + JSON.stringify(got) + ', viewer Blur rows ' + viewerBlur;
});
