/*
 * cross-handq.js — the host's raised-hands line above the stage is readable
 * a viewer raises a hand, and the host's line (its "Raised hands (1)"
 * heading) and the viewer's name each reach 4.5:1 against what they sit on.
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
    const rgba = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 10) / 10; };
    // What the words sit on: the nearest painted background up the tree.
    const under = (el) => {
      for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c[3] || 0) > 0.5) return c.slice(0, 3); }
      return [255, 255, 255];
    };
    const ink = (el) => ratio(rgba(getComputedStyle(el).color).slice(0, 3), under(el));
    const q = document.getElementById('handq');
    // 0.9.23b: a heading line, then one row per hand with the name first.
    const head = q.querySelector('.bc-hands-h') || q;
    const name = Array.from(q.querySelectorAll('.hq')).find((e) => /Jordan Lee/.test(e.textContent)) || q.querySelector('b');
    return { text: q.textContent.slice(0, 80), line: ink(head), name: name ? ink(name) : 0 };
  });
  await shoot();
  if (got.line < 4.5 || got.name < 4.5) throw new Error('host: the raised-hands line is hard to read ' + JSON.stringify(got));
  return 'host: ' + JSON.stringify(got);
});
