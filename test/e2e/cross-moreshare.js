/*
 * cross-moreshare.js — a live host's More sheet (1280x720, one viewer on
 * another machine watching) shows Allow screen share on one line like every
 * other button; pressing it turns it to Stop guest shares, also on one line.
 * The viewer's sheet has no Allow screen share.
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, sleep } = require('./cross-lib.js');

const read = (pg) => pg.evaluate(() => {
  const sheet = document.getElementById('barmore');
  const b = document.getElementById('shareall');
  const tops = new Set();
  for (const n of b.childNodes) if (n.nodeType === 3) { const r = document.createRange(); r.selectNodeContents(n); for (const x of r.getClientRects()) tops.add(Math.round(x.top)); }
  const btns = Array.from(sheet.querySelectorAll(':scope > button')).filter((x) => x.getClientRects().length);
  return { shown: !!b.getClientRects().length, text: b.textContent.trim(), lines: tops.size, widths: Array.from(new Set(btns.map((x) => Math.round(x.getBoundingClientRect().width)))) };
});

run('cross-moreshare', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'moreshare');
  const viewer = await watch(vb, host);
  for (const pg of [host, viewer]) { await pg.locator('#bartoggle').click(); await pg.waitForSelector('#barmore', { state: 'visible' }); }
  await sleep(400);
  const off = await read(host);
  const viewerShare = await viewer.locator('#shareall').evaluateAll((els) => els.filter((e) => e.getClientRects().length).length);
  await shoot();
  await host.locator('#shareall').click();
  await sleep(300);
  if (await host.locator('#barmore').isHidden()) { await host.locator('#bartoggle').click(); await sleep(300); }
  const on = await read(host);
  await host.locator('#shareall').click();
  if (!off.shown) throw new Error('the live host has no Allow screen share');
  if (off.lines !== 1 || on.lines !== 1) throw new Error('the share button wraps ' + JSON.stringify({ off, on }));
  if (off.widths.length !== 1) throw new Error('the sheet\'s buttons differ in width ' + JSON.stringify(off));
  if (on.text !== 'Stop guest shares') throw new Error('pressing it did not turn guest shares on ' + JSON.stringify(on));
  if (viewerShare) throw new Error('the viewer\'s sheet shows Allow screen share');
  return 'host ' + JSON.stringify({ off, on }) + ', viewer share buttons ' + viewerShare;
});
