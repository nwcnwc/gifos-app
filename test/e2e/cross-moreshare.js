/*
 * cross-moreshare.js — a host's More sheet (1280x720, a guest on another
 * machine) shows Allow screen share on one line, as wide as the buttons in
 * its row; pressing it turns it to Stop guest shares, also on one line. The
 * guest's sheet has no Allow screen share.
 *
 * 0.9.23b: a service never lets a viewer share (a viewer publishes nothing),
 * so this runs in a hosted small group, where Allow screen share lives. More
 * opens on its first row; the host tools wait under All tools.
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { hostCall, joinCall, run, sleep } = require('./cross-lib.js');

const read = (pg) => pg.evaluate(() => {
  const b = document.getElementById('shareall');
  const tops = new Set();
  for (const n of b.childNodes) if (n.nodeType === 3) { const r = document.createRange(); r.selectNodeContents(n); for (const x of r.getClientRects()) tops.add(Math.round(x.top)); }
  const row = b.closest('.morerow');
  const btns = row ? Array.from(row.children).filter((x) => x.tagName === 'BUTTON' && x.getClientRects().length) : [];
  const box = b.getBoundingClientRect(), sheet = document.getElementById('barmore').getBoundingClientRect();
  return { shown: !!b.getClientRects().length, text: b.textContent.trim(), lines: tops.size,
    widths: Array.from(new Set(btns.map((x) => Math.round(x.getBoundingClientRect().width)))),
    inside: box.left >= sheet.left && box.right <= sheet.right };
});

async function openTools(pg) {
  await pg.mouse.move(640, 400); // wake the controls (calm by default)
  if (await pg.locator('#barmore').isHidden()) await pg.locator('#bartoggle').click();
  const tools = pg.locator('#moretools');
  if (await tools.isVisible() && (await tools.getAttribute('aria-expanded')) !== 'true') await tools.click();
  await sleep(400);
}

run('cross-moreshare', async (hb, vb, shoot) => {
  const host = await hostCall(hb, 'moreshare');
  const guest = await joinCall(vb, host);
  for (const pg of [host, guest]) await openTools(pg);
  const off = await read(host);
  const guestShare = await guest.locator('#shareall').evaluateAll((els) => els.filter((e) => e.getClientRects().length).length);
  await shoot();
  if (!off.shown) throw new Error('the host has no Allow screen share ' + JSON.stringify(off));
  await host.locator('#shareall').click();
  await sleep(300);
  await openTools(host);
  const on = await read(host);
  await host.locator('#shareall').click();
  if (off.lines !== 1 || on.lines !== 1) throw new Error('the share button wraps ' + JSON.stringify({ off, on }));
  if (off.widths.length !== 1 || !off.inside) throw new Error('the row\'s buttons differ in width or leave the sheet ' + JSON.stringify(off));
  if (on.text !== 'Stop guest shares') throw new Error('pressing it did not turn guest shares on ' + JSON.stringify(on));
  if (guestShare) throw new Error('the guest\'s sheet shows Allow screen share');
  return 'host ' + JSON.stringify({ off, on }) + ', guest share buttons ' + guestShare;
});
