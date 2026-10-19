// A sideways phone in Scroll snapped two faces to the width and made them
// 327px tall inside a 263px band, so the screen cut them off. The snap
// stays inside the band. A tall phone still uses the wide face.
//
//   node test/unit/meet-zones-phone-land.js
const Z = require('../../js/meet-zones.js');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : ''));
}

const band = Z.layout({
  box: { x: 0, y: 0, w: 700, h: 263 },
  row: ['a', 'b'],
  phone: true,
  gallery: 'scroll',
});
check('two faces', band.rects.length === 2, band.rects.length);
for (const r of band.rects) {
  check('scroll face stays inside the sideways band', r.h <= 263.5 && r.y + r.h <= 263.5, Math.round(r.h) + 'px from ' + Math.round(r.y));
}

const tall = Z.layout({
  box: { x: 0, y: 0, w: 390, h: 700 },
  row: ['a', 'b'],
  phone: true,
  gallery: 'scroll',
});
check('portrait scroll keeps a wide face', tall.rects.length === 2 && tall.rects.every((r) => r.h >= 180 && r.h <= 390),
  tall.rects.map((r) => Math.round(r.h)).join(','));

// Beside a share, the people strip must not leave one face on its own line.
function zoneLone(rects, tier) {
  const faces = rects.filter((t) => t.tier === tier);
  let n = 0;
  for (const t of faces) {
    const beside = faces.some((o) => o !== t && o.y < t.y + t.h - 1 && t.y < o.y + o.h - 1);
    if (!beside) n++;
  }
  return n;
}
const strip = Z.layout({
  box: { x: 4, y: 64, w: 1272, h: 528 },
  stage: [{ id: 'share', aspect: 16 / 9 }],
  row: ['a', 'b', 'c', 'd', 'e'],
  stad: ['f', 'g', 'h', 'i', 'j', 'k'],
  gallery: 'fit',
});
check('share strip row has no lone cell', zoneLone(strip.rects, 'row') === 0, zoneLone(strip.rects, 'row'));
check('share strip stadium has no lone cell', zoneLone(strip.rects, 'stad') === 0, zoneLone(strip.rects, 'stad'));
const open = Z.layout({
  box: { x: 4, y: 64, w: 1272, h: 528 },
  row: ['a', 'b', 'c', 'd', 'e'],
  gallery: 'fit',
});
check('open gallery still lays out five', open.rects.length === 5, open.rects.length);

// A short sideways row fills the band: as tall as it, wider when the width is spare.
const wide = Z.layout({
  box: { x: 2, y: 62, w: 840, h: 210 },
  row: ['a', 'b'],
  phone: true,
  gallery: 'fit',
});
const wideOrd = wide.rects.slice().sort((a, b) => a.x - b.x);
check('short sideways row is two faces', wideOrd.length === 2, wideOrd.length);
check('short row is as tall as the band', wideOrd.every((r) => Math.abs(r.h - 210) < 0.5 && Math.abs(r.y - 62) < 0.5),
  wideOrd.map((r) => Math.round(r.y) + '+' + Math.round(r.h)).join(' '));
check('short row is at least as wide as it is tall', wideOrd.every((r) => r.w + 0.5 >= r.h),
  wideOrd.map((r) => Math.round(r.w) + 'x' + Math.round(r.h)).join(' '));
check('short row meets the band edges', Math.abs(wideOrd[0].x - 2) < 0.5 && Math.abs((wideOrd[1].x + wideOrd[1].w) - 842) < 0.5,
  Math.round(wideOrd[0].x) + '..' + Math.round(wideOrd[1].x + wideOrd[1].w));
check('short row keeps one gap', Math.abs(wideOrd[1].x - (wideOrd[0].x + wideOrd[0].w) - 4) < 0.5);

const solo = Z.layout({
  box: { x: 2, y: 62, w: 840, h: 210 },
  row: ['a'],
  phone: true,
  gallery: 'fit',
});
check('solo sideways fills the band', solo.rects.length === 1 && Math.abs(solo.rects[0].w - 840) < 0.5 && Math.abs(solo.rects[0].h - 210) < 0.5,
  solo.rects.map((r) => Math.round(r.w) + 'x' + Math.round(r.h)).join(' '));

const crowd = Z.layout({
  box: { x: 2, y: 62, w: 560, h: 150 },
  row: ['a', 'b', 'c', 'd'],
  phone: true,
  gallery: 'fit',
});
check('a crowd stays square inside the band', crowd.rects.length === 4 && crowd.rects.every((r) => Math.abs(r.w - r.h) < 0.5 && r.y + r.h <= 212.5),
  crowd.rects.map((r) => Math.round(r.w) + 'x' + Math.round(r.h) + '@' + Math.round(r.y)).join(' '));

// Eight faces beside a share must stay inside the band, not grow to 96px under the dock.
const shared = Z.layout({
  box: { x: 2, y: 66, w: 825, h: 127 },
  stage: [{ id: 'share', aspect: 16 / 9 }],
  row: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
  phone: true,
  gallery: 'fit',
});
const sharedFaces = shared.rects.filter((r) => r.tier === 'row');
check('share row stays inside the band', sharedFaces.length === 8 && sharedFaces.every((r) => r.y + r.h <= 66 + 127 + 0.5),
  sharedFaces.map((r) => Math.round(r.w) + 'x' + Math.round(r.h) + ' b' + Math.round(r.y + r.h)).join(' '));

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
