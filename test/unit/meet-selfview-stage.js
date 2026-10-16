// meet-selfview-stage.js — your video is adjustable, and a stage keeps a strip.
//
//   node test/unit/meet-selfview-stage.js
const fs = require('fs');
const path = require('path');
const pack = require('../../js/meet-pack.js');
const layout = require('../../js/meet-layout.js');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

function overlaps(a, b) {
  if (!a || !b) return false;
  const eps = 0.6;
  return a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps;
}
function find(rects, id) {
  return (rects || []).filter((r) => r.id === id)[0] || null;
}
function lay(opts) {
  return layout.layoutFor(Object.assign({ prevRows: -1 }, opts));
}
function area(r) { return r ? r.w * r.h : 0; }
function orderOf(ids) {
  const o = new pack.Order();
  ids.forEach((id) => o.join(id));
  return o;
}

const faces = [
  { id: 'me', me: true, aspect: 16 / 9, stage: true, speaker: true },
  { id: 'a', aspect: 16 / 9, stage: true },
  { id: 'b', aspect: 16 / 9 },
];

check('default arrangement is tile', layout.normalizeSelf(null).arrangement === 'tile');
check('default is not on stage', layout.normalizeSelf(undefined).onStage === false);
check('inset is an adjustable float', layout.normalizeSelf('inset').arrangement === 'float');
check('hide is an arrangement', layout.normalizeSelf('hidden').arrangement === 'hidden');

const box = { x: 4, y: 64, w: 1200, h: 640 };
const small = layout.floatSelf(box, { arrangement: 'float', size: 's', anchor: 'br' }, false, 16 / 9);
const large = layout.floatSelf(box, { arrangement: 'float', size: 'l', anchor: 'br' }, false, 16 / 9);
const tl = layout.floatSelf(box, { arrangement: 'float', size: 'm', anchor: 'tl' }, false, 16 / 9);
const br = layout.floatSelf(box, { arrangement: 'float', size: 'm', anchor: 'br' }, false, 16 / 9);
check('float size is adjustable', area(small) < area(large));
check('float is not the old fixed inset', Math.abs(small.w - 294) > 1 && Math.abs(small.h - 221) > 1);
check('float stays inside the video area',
  small.x >= box.x - 0.1 && small.y >= box.y - 0.1 &&
  small.x + small.w <= box.x + box.w + 0.5 && small.y + small.h <= box.y + box.h + 0.5);
check('float corner changes position', br.x > tl.x + 20 && br.y > tl.y + 20);

const nudged = layout.nudgeSelf({ arrangement: 'float', size: 'm', anchor: 'br' }, 'ArrowLeft', 24, box, false, 16 / 9);
check('nudge stores a free position', nudged.anchor === 'free' && nudged.x < br.x - 8);

const thin = layout.reserveSelf(box, { arrangement: 'strip', size: 's', edge: 'bottom' }, false);
const thick = layout.reserveSelf(box, { arrangement: 'strip', size: 'l', edge: 'bottom' }, false);
const right = layout.reserveSelf(box, { arrangement: 'strip', size: 'm', edge: 'right' }, false);
const left = layout.reserveSelf(box, { arrangement: 'strip', size: 'm', edge: 'left' }, false);
check('strip size is adjustable', thin.band.h < thick.band.h);
check('strip does not cover the meeting', !overlaps(thin.band, thin.rest));
check('strip edge is a position', right.band.x > left.band.x + 20);
check('phone strip defaults to the bottom', layout.selfEdge({ edge: 'auto' }, true, { w: 800, h: 360 }) === 'bottom');
check('wide desktop strip defaults to the right', layout.selfEdge({ edge: 'auto' }, false, { w: 1400, h: 800 }) === 'right');

const mem = {};
const store = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
  setItem: (k, v) => { mem[k] = v; },
};
layout.saveSelf(store, true, { arrangement: 'float', size: 'l', anchor: 'tl', onStage: false });
layout.saveSelf(store, false, { arrangement: 'strip', size: 's', edge: 'right' });
const phoneSaved = layout.loadSelf(store, true);
const deskSaved = layout.loadSelf(store, false);
check('phone choice is remembered', phoneSaved.arrangement === 'float' && phoneSaved.size === 'l' && phoneSaved.anchor === 'tl');
check('desktop choice is separate', deskSaved.arrangement === 'strip' && deskSaved.edge === 'right');

const tiled = lay({
  w: 1280, h: 720, phone: false, mode: 'gallery',
  tiles: [{ id: 'me', me: true, aspect: 16 / 9 }, { id: 'a', aspect: 16 / 9 }],
});
const tileMe = find(tiled.rects, 'me');
const tileA = find(tiled.rects, 'a');
check('default self is a gallery tile', tileMe && tileMe.tier !== 'self' && tileMe.w > 100);
check('default self does not cover the other person', tileMe && tileA && !overlaps(tileMe, tileA));

const hid = lay({
  w: 1280, h: 720, mode: 'gallery', self: { arrangement: 'hidden' },
  tiles: [{ id: 'me', me: true, aspect: 16 / 9 }, { id: 'a', aspect: 16 / 9 }],
});
check('hide removes your tile', !find(hid.rects, 'me'));
check('hide keeps everyone else', !!find(hid.rects, 'a'));

const floatS = lay({
  w: 1280, h: 720, mode: 'gallery', self: { arrangement: 'float', size: 's', anchor: 'br' },
  tiles: [{ id: 'me', me: true, aspect: 16 / 9 }, { id: 'a', aspect: 16 / 9 }],
});
const floatL = lay({
  w: 1280, h: 720, mode: 'gallery', self: { arrangement: 'float', size: 'l', anchor: 'tl' },
  tiles: [{ id: 'me', me: true, aspect: 16 / 9 }, { id: 'a', aspect: 16 / 9 }],
});
const fMeS = find(floatS.rects, 'me');
const fMeL = find(floatL.rects, 'me');
check('layout float is adjustable', fMeS && fMeL && fMeS.tier === 'self' && area(fMeS) < area(fMeL) && fMeL.x < fMeS.x);

const phone = lay({ w: 390, h: 844, phone: true, mode: 'stageGallery', tiles: faces });
const pMe = find(phone.rects, 'me');
const pA = find(phone.rects, 'a');
const pB = find(phone.rects, 'b');
check('stage does not take your tile', pMe && pMe.tier !== 'stage');
check('a pinned person is the stage', pA && pA.tier === 'stage');
check('the other person stays visible', pB && pB.w > 40 && pB.h > 40);
check('phone stage keeps a bottom strip', phone.strip && phone.strip.edge === 'bottom' && phone.strip.size + 0.5 >= phone.strip.floor);
check('phone strip is below the stage', pB.y >= pA.y + pA.h - 1 && pMe.y >= pA.y + pA.h - 1);
check('stage does not cover the strip', !overlaps(pA, pB) && !overlaps(pA, pMe) && !overlaps(pB, pMe));

const land = lay({ w: 844, h: 390, phone: true, mode: 'stageGallery', tiles: faces });
const lA = find(land.rects, 'a');
const lB = find(land.rects, 'b');
check('landscape phone still uses a bottom strip', land.strip && land.strip.edge === 'bottom' && lB.y >= lA.y + lA.h - 1);
check('landscape strip is visible', land.strip.size >= 72);

const desk = lay({ w: 1440, h: 900, phone: false, mode: 'stageGallery', tiles: faces });
const dA = find(desk.rects, 'a');
const dB = find(desk.rects, 'b');
const dMe = find(desk.rects, 'me');
check('desktop stage keeps a side strip', desk.strip && desk.strip.edge === 'side' && desk.strip.size + 0.5 >= desk.strip.floor);
check('side strip sits beside the stage', dB.x >= dA.x + dA.w - 1 && dMe.x >= dA.x + dA.w - 1);
check('side strip is not covered', !overlaps(dA, dB) && !overlaps(dA, dMe));

const pinned = lay({
  w: 390, h: 844, phone: true, mode: 'stageGallery', swapSelf: true,
  tiles: [
    { id: 'me', me: true, aspect: 16 / 9 },
    { id: 'a', aspect: 16 / 9, stage: true },
    { id: 'b', aspect: 16 / 9 },
  ],
});
const pinMe = find(pinned.rects, 'me');
const pinB = find(pinned.rects, 'b');
check('you can put your own tile on stage', pinMe && pinMe.tier === 'stage');
check('putting yourself there still leaves the others', pinB && pinB.tier !== 'stage' && !overlaps(pinMe, pinB));

const only = lay({ w: 390, h: 844, phone: true, mode: 'stageOnly', tiles: faces });
check('stage only hides the others', !find(only.rects, 'b') && !find(only.rects, 'me') && !!find(only.rects, 'a'));
check('stage only reports who was hidden', only.overflow >= 2);
check('stage only is the mode that drops the strip', !only.strip);

const spoke = lay({
  w: 390, h: 844, phone: true, mode: 'speaker',
  tiles: [
    { id: 'me', me: true, aspect: 16 / 9, speaker: true },
    { id: 'a', aspect: 16 / 9 },
  ],
});
check('speaker view does not put you on stage', find(spoke.rects, 'me').tier !== 'stage' && find(spoke.rects, 'a').tier === 'stage');
check('speaker view keeps your strip', spoke.strip && spoke.strip.edge === 'bottom' && !overlaps(find(spoke.rects, 'me'), find(spoke.rects, 'a')));

const spokeSelf = lay({
  w: 390, h: 844, phone: true, mode: 'speaker', swapSelf: true,
  tiles: [
    { id: 'me', me: true, aspect: 16 / 9, speaker: true },
    { id: 'a', aspect: 16 / 9 },
  ],
});
check('speaker view puts you on stage only when you asked', find(spokeSelf.rects, 'me').tier === 'stage' && find(spokeSelf.rects, 'a').tier !== 'stage');

check('auto share keeps the strip', layout.autoResolve({ manual: 'auto', share: true, phoneLandscape: true, shareSettled: true }) === 'stageGallery');
check('explicit stage only still hides', layout.autoResolve({ manual: 'stageOnly', share: true, phoneLandscape: true }) === 'stageOnly');
check('no share stays in the gallery', layout.autoResolve({ manual: 'auto' }) === 'gallery');

const direct = pack.layout(
  [{ id: 'me', me: true, aspect: 16 / 9 }, { id: 'a', aspect: 16 / 9 }, { id: 'b', aspect: 16 / 9 }],
  [{ id: 'me', aspect: 16 / 9 }, { id: 'a', aspect: 16 / 9 }],
  { W: 1280, H: 800, phone: false, mode: 'auto', order: orderOf(['a', 'b', 'me']), selfView: 'tile' }
);
const directStage = direct.tiles.filter((t) => t.region === 'stage').map((t) => t.id);
const directGal = direct.tiles.filter((t) => t.region === 'gallery').map((t) => t.id);
check('packer refuses to auto-stage you', directStage.indexOf('me') < 0 && directStage.indexOf('a') >= 0);
check('packer keeps you in the strip', directGal.indexOf('me') >= 0 && directGal.indexOf('b') >= 0 && direct.strip && direct.strip.edge === 'side');

const directOnly = pack.layout(
  [{ id: 'me', me: true, aspect: 16 / 9 }, { id: 'a', aspect: 16 / 9 }, { id: 'b', aspect: 16 / 9 }],
  [{ id: 'a', aspect: 16 / 9 }],
  { W: 390, H: 800, phone: true, mode: 'stageOnly', order: orderOf(['a', 'b', 'me']), selfView: 'tile' }
);
check('packer stage only is the hide', directOnly.tiles.every((t) => t.region === 'stage') && directOnly.overflow === 2 && !directOnly.strip);

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'run.html'), 'utf8');
check('page dropped the fixed inset', html.indexOf('width: 294px; height: 221px') < 0 && html.indexOf('height: 240px') < 0);
check('page offers the arrangements', html.indexOf('data-self-arr="tile"') >= 0 && html.indexOf('data-self-arr="hidden"') >= 0);
check('page passes the saved self view', html.indexOf('self: window.__meetSelf') >= 0);

const views = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'meet-views.js'), 'utf8');
check('unplaced tiles are parked off the stage', views.indexOf('comfy-off') >= 0 && views.indexOf('parkEl') >= 0);

if (fail) {
  console.log(fail + ' failed, ' + pass + ' passed');
  process.exit(1);
}
console.log(pass + ' passed');
