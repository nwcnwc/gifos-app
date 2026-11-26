/*
 * meet-pack.js — the crop rule for a tile and the smallest legal tile shape.
 * Tile placement is meet-zones.js.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  const GifOS = root.GifOS = root.GifOS || {};
  GifOS.meetPack = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
'use strict';
const T = { KMIN: 0.3 };
// Smallest keep that still holds a default face (s=0.3, grown 1.8x).
function keepNeeded(t, a) {
  const f = 0.3, m = 1.8;
  return Math.max(T.KMIN, t > a ? f * m : f * 0.8 * m / a); // cropping height: face height; cropping width: face width
}
// Smallest tile shape (rev 3).
// 0.44 not 0.5: a single person filling a portrait phone (408x911 = 0.448) must stay legal.
const ASPECT_MIN = 0.44;
const FACE_DEFAULT = { cx: 0.5, cy: 0.38, s: 0.3 };
const FACE_MARGIN = 1.8; // crop must contain the face box grown 1.8x (head + some shoulders)
// Source-normalised crop window for a tile of aspect t from a source of aspect a.
// Returns {x,y,w,h} in 0..1 of the source, or {contain:true} when even the
// best-placed crop would cut the (grown) face box or keep < KMIN.
function cropFor(a, t, face) {
  const f = face || FACE_DEFAULT;
  const keep = Math.min(t / a, a / t);
  let w = 1, h = 1;
  if (t < a) w = t / a; else h = a / t;            // cover window
  if (keep < keepNeeded(t, a)) return { contain: true, keep };
  const fh = Math.min(1, f.s * FACE_MARGIN);
  const fwN = Math.min(1, f.s * 0.8 * FACE_MARGIN / a); // width in normalised source units
  if (fwN > w + 1e-9 || fh > h + 1e-9) return { contain: true, keep, reason: 'face' };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const x = clamp(f.cx - w / 2, 0, 1 - w), y = clamp(f.cy - h * 0.45, 0, 1 - h); // face sits slightly above centre
  return { x, y, w, h, keep };
}

return { ASPECT_MIN, cropFor };

});
