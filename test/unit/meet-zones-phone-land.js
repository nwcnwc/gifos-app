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

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
