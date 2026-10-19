/*
 * cross-stagelabel.js — the label at the foot of the stage is readable, on
 * the host and on a viewer on another machine. 0.9.23b's Stage fills a
 * service, so its plain "On stage" tag is gone; the label that stays is a
 * shared screen's ("Pastor Kim's screen — on stage").
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. the host shares a screen with Share's key (the test browser's fake
 *      picker answers at once)
 *   3. once both stages show it, each reads its screen label: light on the
 *      dark band (contrast 4.5 or more) and 12px or larger
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { until, goLive, watch, run } = require('./cross-lib.js');

// What the label looks like: its words, contrast over the band on the black
// video, and font size.
const look = (el) => {
  const s = getComputedStyle(el);
  const rgba = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const [r, g, b] = rgba(s.color);
  const [br, bg, bb, ba = 1] = rgba(s.backgroundColor);
  const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const a = lum([r, g, b]), z = lum([br * ba, bg * ba, bb * ba]);
  return { text: el.textContent, contrast: Math.round(((Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05)) * 10) / 10,
    px: parseFloat(s.fontSize), shown: !!el.offsetParent };
};

run('cross-stagelabel', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'stagelabel');
  const viewer = await watch(vb, host);
  const key = await host.locator('#sharebtn').getAttribute('aria-keyshortcuts');
  await host.evaluate(() => document.activeElement && document.activeElement.blur());
  await host.keyboard.press(key.replace(/^Alt\+(.)$/, (m, k) => 'Alt+' + k.toLowerCase()));
  const out = {};
  for (const [who, page] of [['host', host], ['viewer', viewer]]) {
    await until(who + ' stage shows its label', async () => {
      const el = page.locator('#stagefeed .rowtile[data-row="sgs"] .rlabel.sharelabel');
      return { ok: (await el.count()) > 0 && await el.first().isVisible() };
    }, 45000);
    out[who] = await page.locator('#stagefeed .rowtile[data-row="sgs"] .rlabel.sharelabel').first().evaluate(look);
  }
  await shoot();
  for (const [who, l] of Object.entries(out)) {
    if (!/screen/.test(l.text) || l.contrast < 4.5 || l.px < 12) throw new Error(who + ' label hard to read: ' + JSON.stringify(out));
  }
  return 'both read the stage label: ' + JSON.stringify(out);
});
