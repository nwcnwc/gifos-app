/*
 * cross-handq.js — the host's raised-hands line above the stage is readable
 * on the dark page: a viewer raises a hand, and the host's "✋ 1 waiting:"
 * and the first name each reach 4.5:1 against the page.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. the viewer presses H; the host reads the line's colors
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, until, run } = require('./cross-lib.js');

run('cross-handq', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'handq');
  const viewer = await watch(vb, host);
  await viewer.evaluate(() => document.activeElement && document.activeElement.blur());
  await viewer.keyboard.press('h');
  await until('host sees the hand', async () => ({
    ok: await host.evaluate(() => /Jordan Lee/.test((document.getElementById('handq') || {}).textContent || '')),
  }), 15000);
  const got = await host.evaluate(() => {
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number).slice(0, 3);
    const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 10) / 10; };
    const q = document.getElementById('handq');
    const under = rgb(getComputedStyle(document.body).backgroundColor);
    return { text: q.textContent, line: ratio(rgb(getComputedStyle(q).color), under), name: ratio(rgb(getComputedStyle(q.querySelector('b')).color), under) };
  });
  await shoot();
  if (got.line < 4.5 || got.name < 4.5) throw new Error('host: the raised-hands line is hard to read ' + JSON.stringify(got));
  return 'host: ' + JSON.stringify(got);
});
