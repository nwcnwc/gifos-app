// meet-gallery-layout.js — gallery Fit/Scroll math for Meet v0.9.23.
//
// Fit is the default and stays one screen. Scroll is infinite only when asked.
// A tile is never narrower than a portrait phone (w/h >= 0.44): the packer
// picks another arrangement (rows 1/2/2, or a big tile beside smaller ones)
// and insets a tile the box itself forced past that bound. Stadium slices
// render a bit smaller than the real row.
//
//   node test/unit/meet-gallery-layout.js
const P = require('../../js/meet-pack.js');
const L = require('../../js/meet-layout.js');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : ''));
}

const PHONE = [
  { name: 'phone', w: 390, h: 844 },
  { name: 'phone-tall', w: 408, h: 911 },
  { name: 'phone-land', w: 844, h: 390 },
];
const DESKTOP = [
  { name: 'desktop', w: 1280, h: 800 },
  { name: 'desktop-wide', w: 1440, h: 900 },
];
const VIEWPORTS = PHONE.concat(DESKTOP);
const SOURCES = [16 / 9, 9 / 16];

function short(t) { return Math.min(t.w, t.h); }

function tilesFor(n, src, split) {
  const tiles = [];
  const rowN = split === 'row' ? n : Math.max(1, Math.round(n * 0.25));
  for (let i = 0; i < n; i++) {
    tiles.push({
      id: 'p' + i,
      aspect: src,
      me: i === 0,
      tier: i < rowN ? 'row' : 'stad',
    });
  }
  return tiles;
}

function aspectOk(t) {
  const a = t.w / t.h;
  return a >= P.ASPECT_MIN - 1e-4 && a <= P.ASPECT_MAX + 1e-4;
}

check('resolver defaults to fit', P.resolveGallery(undefined) === 'fit' && P.resolveGallery('fit') === 'fit');
check('resolver ignores a pager', P.resolveGallery('page') === 'fit' && P.resolveGallery('auto') === 'fit');
check('resolver accepts an explicit scroll', P.resolveGallery('scroll') === 'scroll');
check('five people in three rows lead 1/2/2', P.rowCounts(5, 3).join(',') === '1,2,2');

const lead = P.chooseRows({ x: 0, y: 0, w: 800, h: 900 }, Array(5).fill(16 / 9));
check('square 5-up is rows 1/2/2', !!lead && lead.dir === 'rows' && lead.counts.join(',') === '1,2,2', lead && lead.counts);
check('square 5-up is not one skinny row', !!lead && lead.counts.join(',') !== '5');
check('square 5-up tiles stay phone-wide', !!lead && lead.cells.every(aspectOk));

const beside = P.chooseRows({ x: 0, y: 0, w: 1440, h: 900 }, Array(5).fill(16 / 9));
check('wide 5-up puts a big tile beside smaller ones', !!beside && beside.dir === 'cols' && beside.sizing === 'aspect', beside && (beside.dir + ' ' + beside.sizing + ' ' + beside.counts));
check('wide 5-up tiles stay phone-wide', !!beside && beside.cells.every(aspectOk));

let cases = 0;
for (let n = 1; n <= 30; n++) {
  for (const v of VIEWPORTS) {
    for (const src of SOURCES) {
      for (const split of ['mix', 'row']) {
        for (const gallery of ['fit', 'scroll']) {
          cases++;
          const tiles = tilesFor(n, src, split);
          const out = L.layoutFor({ w: v.w, h: v.h, tiles: tiles, gallery: gallery, mode: 'gallery' });
          const id = v.name + ' n=' + n + ' ' + split + ' ' + (src > 1 ? 'wide' : 'port') + ' ' + gallery;
          const faces = (out.rects || []).filter((t) => t.tier !== 'bot');
          check(id + ' mode', out.gallery === gallery && out.paged === false, out.gallery);
          check(id + ' everyone', faces.length === n, faces.length);
          if (gallery === 'fit') check(id + ' one screen', out.contentH <= out.box.h + 1.5, out.contentH + ' > ' + out.box.h);
          let narrow = null;
          for (let i = 0; i < faces.length; i++) if (!aspectOk(faces[i])) narrow = faces[i];
          check(id + ' aspect', !narrow, narrow && ((narrow.w / narrow.h).toFixed(3) + ' ' + Math.round(narrow.w) + 'x' + Math.round(narrow.h)));
          const row = faces.filter((t) => t.tier === 'row');
          const stad = faces.filter((t) => t.tier === 'stad');
          if (row.length && stad.length) {
            const rs = Math.min.apply(null, row.map(short));
            let worst = null;
            for (let i = 0; i < stad.length; i++) {
              const ss = short(stad[i]);
              if (!(ss < rs - 0.4) || ss > rs / P.TIER_RATIO + 1.25) worst = ss;
            }
            check(id + ' stadium smaller', worst == null, 'row ' + rs.toFixed(1) + ' stad ' + (worst == null ? '' : worst.toFixed(1)));
          }
        }
      }
    }
  }
}

// A crowded Fit grid stays Fit. Scroll grows only when the caller asks.
const crowd = tilesFor(30, 16 / 9, 'mix');
const fitCrowd = L.layoutFor({ w: 390, h: 844, tiles: crowd, gallery: 'fit', mode: 'gallery' });
const scrollCrowd = L.layoutFor({ w: 390, h: 844, tiles: crowd, gallery: 'scroll', mode: 'gallery' });
check('crowded fit does not auto-scroll', fitCrowd.gallery === 'fit' && fitCrowd.contentH <= fitCrowd.box.h + 1.5, fitCrowd.gallery + ' h=' + fitCrowd.contentH);
check('crowded scroll grows past one screen', scrollCrowd.gallery === 'scroll' && scrollCrowd.contentH > scrollCrowd.box.h + 8, scrollCrowd.contentH);
const phoneBox = L.viewBox(390, 844, {});
const deskBox = L.viewBox(1920, 1080, {});
check('phone gallery clears the dock', phoneBox.y + phoneBox.h <= 844 - 100, phoneBox.h);
check('desktop gallery clears the dock', deskBox.y + deskBox.h <= 1080 - 110, deskBox.h);
const firstStad = scrollCrowd.rects.filter((t) => t.tier === 'stad').reduce((a, b) => (a && a.y < b.y ? a : b), null);
check('scroll shows the crowd on the first screen', !!firstStad && firstStad.y + 8 < scrollCrowd.box.y + scrollCrowd.box.h, firstStad && firstStad.y);

const rowCrowd = tilesFor(30, 16 / 9, 'row');
const rowScroll = L.layoutFor({ w: 390, h: 844, tiles: rowCrowd, gallery: 'scroll', mode: 'gallery' });
check('row-only scroll still grows', rowScroll.gallery === 'scroll' && rowScroll.contentH > rowScroll.box.h + 8, rowScroll.contentH);

// opts.page must not drop faces or flip the mode.
const order = new P.Order();
const people = [];
for (let i = 0; i < 12; i++) {
  people.push({ id: 'p' + i, aspect: 16 / 9, me: i === 0, row: i === 0 ? 0 : 1 });
  order.join('p' + i);
}
const paged = P.layout(people, [], {
  W: 390, H: 844, phone: true, mode: 'gallery', order: order, myRow: 0,
  gallery: 'page', page: 2, selfView: 'tile',
});
check('page request is fit', paged.gallery === 'fit' && paged.paged === false, paged.gallery);
check('page request keeps everyone', paged.tiles.length === 12 && paged.overflow === 0, paged.tiles.length);
check('page request stays on one screen', paged.contentH <= paged.box.h + 1.5, paged.contentH);

// One person on a portrait phone is already a legal tile. A strip narrower
// than that phone is inset back up to the same bound.
const phoneOne = L.layoutFor({
  w: 408, h: 911,
  tiles: [{ id: 'me', me: true, aspect: 9 / 16, tier: 'row' }],
  gallery: 'fit', mode: 'gallery',
});
const phoneA = phoneOne.rects[0].w / phoneOne.rects[0].h;
check('portrait phone solo tile', phoneA >= P.ASPECT_MIN - 1e-4 && phoneA <= P.ASPECT_MAX + 1e-4, phoneA.toFixed(3));

const strip = L.layoutFor({
  w: 120, h: 800,
  tiles: [{ id: 'me', me: true, aspect: 16 / 9, tier: 'row' }],
  gallery: 'fit', mode: 'gallery',
});
const stripA = strip.rects[0].w / strip.rects[0].h;
check('skinny box is inset to a portrait phone', Math.abs(stripA - P.ASPECT_MIN) < 1e-3, stripA.toFixed(3));

console.log(pass + ' passed, ' + fail + ' failed, ' + cases + ' viewport cases');
process.exit(fail ? 1 : 0);
