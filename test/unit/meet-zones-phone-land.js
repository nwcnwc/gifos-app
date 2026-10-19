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

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
