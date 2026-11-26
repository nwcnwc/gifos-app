/*
 * GifOS: TEXT STAYS CLEAR, the blur of a screen share (GifOS.textClear). Copyright (c) 2026 Crowd Concepts, Inc.
 * All rights reserved.
 *
 * Wherever a share is blurred (the sender's pipe, and every viewer's picture of it), this filter IS the blur: plain
 * text stays readable, pictures, video and anything uncertain stay blurred (Nathan 2026-11-26). WHEN a share is blurred
 * is the core's decision as before (blurHold / blurLevelFor); a host's or moderator's blur order keeps the full blur.
 * Faces and cameras never come here.
 *
 * SHOW ONLY WHAT WAS CHECKED. The live video underneath stays blurred. Above it lies an overlay of pixels this module
 * made itself: per 32 px cell judged plain text, the cell's one flat background colour and its ink in one colour, the
 * ink's shape taken from the analysed frame. Nothing else is ever shown clear, so a frame that was not analysed, a faint
 * picture behind text, tone, colour and dither tricks never reach a viewer.
 * The bar is "no worse than what can be typed in chat": text made into a picture with real characters gets through as
 * one-colour ink, nothing more.
 *
 *   analyze(rgba, w, h, opts)   the per-cell judgement of one frame (pure; a Worker, the page and Node run it as is)
 *   createState(w, h, opts)     the temporal rules over a stream of frames, analysing only the regions that changed:
 *                               st.tick(rgba) -> { analysed, newly, patches, hidden }
 *   runtime (a page only)       GifOS.textClear.view(video, on)   a viewer's overlay over a share <video>
 *                               GifOS.textClear.sender(opts)      the sender pipe's painter (plane-browser startBlurPipe)
 *                               GifOS.textClear.engine()          one analysis stream (a Worker when the page can start one)
 *
 * A LETTER IS SHOWN WHOLE, AS THE LIVE PICTURE HAS IT, OR NOT AT ALL (2026-11-26: after an English page the Russian one
 * read "Nога" for "Бога"; a group reading scripture must never see a wrong letter). Two laws in createState:
 *   SHOWN IS LIVE   a shown cell is compared with the pixels it was vetted on, pixel by pixel, on every tick; the first
 *                   pixel off drops it to blur (the coarse fingerprint only says when a cell holds still);
 *   WHOLE LETTERS   a letter lying across the edge of what is shown is left out of the overlay whole, with its word-part.
 *
 * COST. A frame that did not change costs its cell fingerprints and the compare of its shown cells (about 8 ms at 1080p). A cell is analysed once it has
 * held still for a tick, and only the 256 px blocks around changed cells are analysed again (incremental), so a cursor
 * or a clock costs a block, not a frame. When a device is over budget the filter first ticks slower, then analyses a
 * smaller picture; it falls back to the full blur only when neither is enough (Nathan 2026-11-26).
 */
(function (root, factory) {
  'use strict';
  var TC = factory();
  if (typeof module === 'object' && module.exports) { module.exports = TC; return; }
  root.GifOSTextClear = TC;
  if (typeof root.document === 'undefined' && typeof root.importScripts === 'function') TC.serveWorker(root);
  else if (root.document) TC.installRuntime(root, factory);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // ======================================= THE JUDGEMENT (pure) =======================================
  // Every threshold as measured on a set of text, picture, video and adversarial frames; change them only with a new
  // measurement on such a set.
  const DEFAULTS = {
    T: 64,            // analysis window edge at each pyramid level; windows overlap by half; decisions are per 32 px cell
    levels: 4,        // 0: body text, 1: large print, 2: headings, 3: slide titles
    tauLo: 28,        // colour distance from tile background below which a pixel is background
    minInk: 70,       // ink must be at least this far from the background (faint content stays blurred)
    coreK: 0.5,       // core ink = distance > coreK * ink level
    bgMin: 0.52,      // background must cover this share of the tile
    blankFrac: 0.002, // tiles with less non-background than this are blank
    wCore: 4,         // max stroke width of core ink (px at this level)
    wSoft: 7,         // max stroke width of any non-background (core + antialias halo)
    thickAbs: 6,      // tolerated count of solid (w+1)-squares (a bullet or a full stop)
    ruleLen: 40,      // straight runs this long are rules (underlines, table lines)
    ruleW: 3,
    maxRuleRows: 6, maxRuleCols: 6,
    gapTol: 1,        // a row with <= gapTol core pixels is a line gap
    hMin: 5, hMax: 26,// text band height range at this level
    speckFrac: 0.10,  // ink allowed in bands shorter than hMin
    maxSeg: 3.2,      // widest glyph run / band height
    meanSeg: 1.25,    // mean glyph run / band height
    minSegs: 3,       // glyph runs needed in the tile
    densLo: 0.03, densHi: 0.5, // ink density of non-blank windows in a band
    densRatio: 8,     // max/min window density inside one tile
    softFar: 0.06,    // share of faint non-background allowed away from core ink (tone tricks)
    fillMin: 0.4,     // share of glyph runs that must span >= 40% of the band height (dust, speckle fail)
    twinTol: 46,      // glyph signature distance (20 cells x 0..15) counted as "same letter"
    twinR: 2,         // twin search radius in tiles
    twinMin: 0.45,    // share of a tile's glyphs that must have a twin in the 3x3 tile neighbourhood
    twinNeed: 6,      // glyphs needed before the alphabet tests apply (fewer: the tile needs help from neighbours)
    weakNeed: 2,      // strong neighbours a few-letter tile needs
    monoMax: 0.6,     // one glyph shape may not make up more than this share (texture, repeated-symbol art)
    minNeighbours: 1, // a text cell needs this many clear text neighbours
    blankReach: 64,   // blank page cells (no ink at all) clear out to this many cells from clear text of the same background: the page around the text shows whole, not in patches
    bgJoin: 14,       // blank cell background must match the text cell's
    fpTol: 7,         // cell fingerprint tolerance (levels) for "unchanged"
    needStable: 1,    // unchanged ticks needed before a passing cell is shown
    maxStrikes: 6,
    smallSide: 2,     // SMALL PICTURES (Nathan 2026-11-26: too small to tell what it is): a still non-text patch at most this many
    smallArea: 4,     //   cells on a side (64 px) and this many cells in all, ringed on every side by shown text or page, is shown
    smallGap: 3,      //   as sent; no two such pictures within this many cells of each other (no mosaic of small pieces)
    smallRing: 0.75,  //   'ringed': this share of the cells around it are shown (a cut letter at a line's end still fills in)
    sharpMin: 48,     // a text cell (not a blank page cell) holds a step of at least this between neighbouring pixels
    sliverMax: 0.12,  // CUT LETTERS: a cell beside a shown text cell whose only ink is a sliver (at most this share of it) touching
    sliverEdge: 6,    //   that shared side (within this many px) is the rest of a letter: shown, on that cell's flat background
    snapTol: 40,      // SHOWN IS LIVE: a shown cell is compared, pixel by pixel, with the picture it was vetted on; one pixel further off than
                      //   this (any channel) drops it. Text ink is at least minInk from its page, so no letter can change below this
    markShade: 64,    // HIDDEN TEXT IS MARKED: ink on the page that is not shown is covered by a soft patch this far off the page colour
    joinK: 0.3,       // WHOLE LETTERS: ink within this share of a letter's height beside it is the same word-part (a cut letter blurs with it)
    joinMax: 64,      //   letters at most in one cut word-part
    block: 64,        // incremental analysis: changed cells are analysed in aligned blocks of this edge
    grow: 2,          // ... grown by this many blocks on every side (the alphabet and neighbour tests look that far at body-text size)
    fullFrac: 0.6     // ... unless the blocks to analyse cover this share of the frame: then the whole frame at once
  };
  const R = { PASS: 0, BLANK: 1, BUSY: 2, FAINT: 3, THICK: 4, RULES: 5, NOBAND: 6, BANDH: 7, SEG: 8, DENS: 9, SPECK: 10, SMALL: 11, FEWSEG: 12, TONE: 13, FILL: 14, TWIN: 15, MONO: 16 };
  const RNAME = Object.keys(R);

  function halve(src) {
    const w = src.w >> 1, h = src.h >> 1, s = src.data, W = src.w, d = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      let a = (y * 2) * W * 4, b = a + W * 4, o = y * w * 4;
      for (let x = 0; x < w; x++, a += 8, b += 8, o += 4) {
        d[o] = (s[a] + s[a + 4] + s[b] + s[b + 4] + 2) >> 2;
        d[o + 1] = (s[a + 1] + s[a + 5] + s[b + 1] + s[b + 5] + 2) >> 2;
        d[o + 2] = (s[a + 2] + s[a + 6] + s[b + 2] + s[b + 6] + 2) >> 2;
      }
    }
    return { w, h, data: d };
  }

  function makeScratch(T) {
    const n = T * T;
    return { y: new Uint8Array(n), d: new Uint8Array(n), m: new Uint8Array(n), rh: new Uint8Array(n), rv: new Uint8Array(n),
      h1: new Uint8Array(n),
      hist: new Int32Array(64), dh: new Int32Array(256), row: new Int32Array(T), col: new Int32Array(T), bs: new Int32Array(T), be: new Int32Array(T) };
  }
  function newFeat() {
    return { reason: 0, bgFrac: 0, inkFrac: 0, dInk: 0, coreThr: 0, thickCore: 0, thickSoft: 0, nCore: 0, nInk: 0, ruleRows: 0, ruleCols: 0,
      softFar: 0, fill: 0, topH: 0, botH: 0, stitch: 0, gStart: 0, gCount: 0, twin: 0, mono: 0, nBands: 0, nComplete: 0, hTyp: 0, maxBandH: 0, speck: 0, maxSeg: 0, meanSeg: 0, nSeg: 0, densMin: 1, densMax: 0,
      bg: [0, 0, 0], ink: [0, 0, 0] };
  }

  // number of k x k squares that are entirely mask>=lvl (0 means every stroke is thinner than k)
  function solidSquares(m, tw, th, lvl, k, r) {
    let n = 0;
    for (let y = 0; y < th; y++) { const o = y * tw; let run = 0; for (let x = tw - 1; x >= 0; x--) { run = m[o + x] >= lvl ? run + 1 : 0; r[o + x] = run >= k ? 1 : 0; } }
    for (let x = 0; x < tw; x++) { let run = 0; for (let y = th - 1; y >= 0; y--) { run = r[y * tw + x] ? run + 1 : 0; if (run >= k) n++; } }
    return n;
  }

  function analyzeTile(L, x0, y0, tw, th, P, S, F, G) {
    const N = tw * th, W = L.w, data = L.data, yv = S.y, dv = S.d, m = S.m, hist = S.hist, dh = S.dh;
    F.nBands = F.nComplete = F.hTyp = F.maxBandH = F.speck = F.maxSeg = F.meanSeg = F.nSeg = F.densMax = 0; F.densMin = 1;
    F.thickCore = F.thickSoft = F.nCore = F.ruleRows = F.ruleCols = F.dInk = F.softFar = F.fill = F.gCount = F.twin = F.mono = F.topH = F.botH = F.stitch = 0; F.gStart = G ? G.n : 0;
    if (tw < 24 || th < 24) return (F.reason = R.SMALL);
    hist.fill(0); dh.fill(0);
    for (let ty = 0, i = 0; ty < th; ty++) {
      let q = ((y0 + ty) * W + x0) * 4;
      for (let tx = 0; tx < tw; tx++, i++, q += 4) { const Y = (data[q] * 77 + data[q + 1] * 150 + data[q + 2] * 29) >> 8; yv[i] = Y; hist[Y >> 2]++; }
    }
    let mode = 0, best = -1;
    for (let b = 0; b < 64; b++) { const s = hist[b] * 2 + (b ? hist[b - 1] : 0) + (b < 63 ? hist[b + 1] : 0); if (s > best) { best = s; mode = b; } }
    const lo = (mode - 1) * 4, hi = (mode + 2) * 4 - 1;
    let sr = 0, sg = 0, sb = 0, sn = 0;
    for (let ty = 0, i = 0; ty < th; ty++) {
      let q = ((y0 + ty) * W + x0) * 4;
      for (let tx = 0; tx < tw; tx++, i++, q += 4) { const Y = yv[i]; if (Y >= lo && Y <= hi) { sr += data[q]; sg += data[q + 1]; sb += data[q + 2]; sn++; } }
    }
    const br = Math.round(sr / sn), bgc = Math.round(sg / sn), bb = Math.round(sb / sn);
    F.bg[0] = br; F.bg[1] = bgc; F.bg[2] = bb;
    let nBg = 0; const tl = P.tauLo;
    for (let ty = 0, i = 0; ty < th; ty++) {
      let q = ((y0 + ty) * W + x0) * 4;
      for (let tx = 0; tx < tw; tx++, i++, q += 4) {
        let d = data[q] - br; if (d < 0) d = -d; let e = data[q + 1] - bgc; if (e < 0) e = -e; if (e > d) d = e; e = data[q + 2] - bb; if (e < 0) e = -e; if (e > d) d = e;
        dv[i] = d; dh[d]++; if (d <= tl) nBg++;
      }
    }
    const nInk = N - nBg; F.bgFrac = nBg / N; F.inkFrac = nInk / N; F.nInk = nInk;
    if (nInk <= N * P.blankFrac) return (F.reason = R.BLANK);
    if (F.bgFrac < P.bgMin) return (F.reason = R.BUSY);
    let cum = 0, dInk = 255; const want = nInk * 0.15;
    for (; dInk > tl; dInk--) { cum += dh[dInk]; if (cum >= want) break; }
    F.dInk = dInk;
    if (dInk < P.minInk) return (F.reason = R.FAINT);
    const coreThr = Math.max(tl + 8, P.coreK * dInk) | 0; F.coreThr = coreThr;
    for (let i = 0; i < N; i++) m[i] = dv[i] > tl ? (dv[i] > coreThr ? 2 : 1) : 0;

    // rules: long thin straight runs are taken out of the structure tests (and counted)
    const rh = S.rh, rv = S.rv; rh.fill(0, 0, N); rv.fill(0, 0, N);
    const lh = Math.min(P.ruleLen, (tw * 0.6) | 0), lv = Math.min(P.ruleLen, (th * 0.6) | 0);
    for (let y = 0; y < th; y++) { let s = -1; const o = y * tw; for (let x = 0; x <= tw; x++) { if (x < tw && m[o + x]) { if (s < 0) s = x; } else if (s >= 0) { if (x - s >= lh) for (let k = s; k < x; k++) rh[o + k] = 1; s = -1; } } }
    for (let x = 0; x < tw; x++) { let s = -1; for (let y = 0; y <= th; y++) { if (y < th && m[y * tw + x]) { if (s < 0) s = y; } else if (s >= 0) { if (y - s >= lv) for (let k = s; k < y; k++) rv[k * tw + x] = 1; s = -1; } } }
    for (let x = 0; x < tw; x++) { let s = -1; for (let y = 0; y <= th; y++) { if (y < th && rh[y * tw + x]) { if (s < 0) s = y; } else if (s >= 0) { if (y - s > P.ruleW) for (let k = s; k < y; k++) rh[k * tw + x] = 0; s = -1; } } }
    for (let y = 0; y < th; y++) { let s = -1; const o = y * tw; for (let x = 0; x <= tw; x++) { if (x < tw && rv[o + x]) { if (s < 0) s = x; } else if (s >= 0) { if (x - s > P.ruleW) for (let k = s; k < x; k++) rv[o + k] = 0; s = -1; } } }
    let ruleRows = 0, ruleCols = 0;
    for (let y = 0; y < th; y++) { const o = y * tw; let any = 0; for (let x = 0; x < tw; x++) if (rh[o + x]) { any = 1; m[o + x] = 0; } ruleRows += any; }
    for (let x = 0; x < tw; x++) { let any = 0; for (let y = 0; y < th; y++) if (rv[y * tw + x]) { any = 1; m[y * tw + x] = 0; } ruleCols += any; }
    F.ruleRows = ruleRows; F.ruleCols = ruleCols;
    if (ruleRows > P.maxRuleRows || ruleCols > P.maxRuleCols) return (F.reason = R.RULES);

    // thinness: everything that is not background must be a thin stroke
    const thickSoft = solidSquares(m, tw, th, 1, P.wSoft + 1, S.h1), thickCore = solidSquares(m, tw, th, 2, P.wCore + 1, S.h1);
    let nCore = 0, nSoft = 0, ir = 0, ig = 0, ib = 0;
    const row = S.row; row.fill(0, 0, th);
    for (let ty = 0, i = 0; ty < th; ty++) {
      let q = ((y0 + ty) * W + x0) * 4;
      for (let tx = 0; tx < tw; tx++, i++, q += 4) {
        const v = m[i]; if (!v) continue; nSoft++;
        if (v === 2) { nCore++; row[ty]++; ir += data[q]; ig += data[q + 1]; ib += data[q + 2]; }
      }
    }
    F.thickCore = thickCore; F.thickSoft = thickSoft; F.nCore = nCore;
    if (nCore) { F.ink[0] = Math.round(ir / nCore); F.ink[1] = Math.round(ig / nCore); F.ink[2] = Math.round(ib / nCore); }
    if (thickCore > P.thickAbs || thickSoft > P.thickAbs) return (F.reason = R.THICK);
    // faint non-background must hug core ink (antialias halo); free-standing faint marks would carry tone
    { const near = S.h1; let far = 0;
      for (let y = 0; y < th; y++) { const o = y * tw; for (let x = 0; x < tw; x++) { let on = 0; for (let k = Math.max(0, x - 2); k <= Math.min(tw - 1, x + 2); k++) if (m[o + k] === 2) { on = 1; break; } near[o + x] = on; } }
      for (let y = 0; y < th; y++) { const o = y * tw; for (let x = 0; x < tw; x++) { if (m[o + x] !== 1) continue; let on = 0; for (let k = Math.max(0, y - 2); k <= Math.min(th - 1, y + 2); k++) if (near[k * tw + x]) { on = 1; break; } if (!on) far++; } }
      F.softFar = nSoft ? far / nSoft : 0; if (far > Math.max(6, P.softFar * nSoft)) return (F.reason = R.TONE); }

    // line rhythm: bands of ink rows separated by clean gap rows
    const bs = S.bs, be = S.be; let nb = 0, s = -1;
    for (let y = 0; y <= th; y++) { if (y < th && row[y] > P.gapTol) { if (s < 0) s = y; } else if (s >= 0) { bs[nb] = s; be[nb] = y - 1; nb++; s = -1; } }
    F.nBands = nb;
    let hTyp = 0, speck = 0, nComplete = 0, maxH = 0;
    for (let b = 0; b < nb; b++) {
      const h = be[b] - bs[b] + 1, complete = bs[b] > 0 && be[b] < th - 1; if (h > maxH) maxH = h;
      if (complete && h >= P.hMin && h <= P.hMax) { nComplete++; if (h > hTyp) hTyp = h; }
      if (h < P.hMin && complete) for (let y = bs[b]; y <= be[b]; y++) speck += row[y];
    }
    F.nComplete = nComplete; F.hTyp = hTyp; F.maxBandH = maxH; F.speck = nCore ? speck / nCore : 0;
    if (maxH > P.hMax) return (F.reason = R.BANDH);
    for (let b = 0; b < nb; b++) { if (bs[b] === 0) F.topH = be[b] + 1; if (be[b] === th - 1) F.botH = th - bs[b]; }
    if (!nComplete) { // no whole line inside the tile: allowed only if a cut line joins a line in the tile above or below (checked by the caller)
      if (F.topH < 2 && F.botH < 2) return (F.reason = R.NOBAND);
      F.stitch = 1; hTyp = Math.max(P.hMin, F.topH, F.botH); }
    if (F.speck > P.speckFrac) return (F.reason = R.SPECK);

    // glyph runs inside each band: separated by clean columns, bounded width, even density
    const col = S.col; let maxSeg = 0, worstMean = 0, nSegAll = 0, dMin = 1, dMax = 0, nGl = 0, nTall = 0;
    for (let b = 0; b < nb; b++) {
      const h = be[b] - bs[b] + 1; if (h < P.hMin && bs[b] > 0 && be[b] < th - 1) continue;
      const complete = bs[b] > 0 && be[b] < th - 1, hRef = complete ? h : Math.max(h, hTyp);
      col.fill(0, 0, tw);
      for (let y = bs[b]; y <= be[b]; y++) { const o = y * tw; for (let x = 0; x < tw; x++) if (m[o + x] === 2) col[x]++; }
      let st = -1, sumW = 0, nSeg = 0, first = -1, last = -1;
      for (let x = 0; x <= tw; x++) {
        if (x < tw && col[x] > 0) { if (st < 0) st = x; if (first < 0) first = x; last = x; }
        else if (st >= 0) { const ws = x - st; sumW += ws; nSeg++; const r = ws / hRef; if (r > maxSeg) maxSeg = r;
          // glyph box and 4x5 coverage signature
          let top = -1, bot = -1;
          for (let y = bs[b]; y <= be[b]; y++) { const o = y * tw; for (let k = st; k < x; k++) if (m[o + k] === 2) { if (top < 0) top = y; bot = y; break; } }
          const gh = bot - top + 1; nGl++; if (gh >= 0.35 * hRef) nTall++;
          if (G && complete && ws >= 3 && gh >= 0.4 * hRef && G.n < G.max) {
            const o = G.n * 24, sg = G.buf; sg[o] = Math.min(255, ws); sg[o + 1] = Math.min(255, gh); sg[o + 2] = 0; sg[o + 3] = 0; const acc = G.acc; acc.fill(0);
            for (let y = top; y <= bot; y++) { const oo = y * tw, gy = ((y - top) * 5 / gh) | 0; for (let k = st; k < x; k++) if (m[oo + k] === 2) acc[gy * 4 + (((k - st) * 4 / ws) | 0)]++; }
            const ca = ws * gh / 20; for (let k = 0; k < 20; k++) sg[o + 4 + k] = Math.min(15, Math.round(15 * acc[k] / ca));
            G.n++;
          }
          st = -1; }
      }
      if (!nSeg) continue; nSegAll += nSeg;
      const mean = sumW / nSeg / hRef; if (mean > worstMean) worstMean = mean;
      const ww = Math.max(12, 2 * hRef);
      for (let x = first; x <= last; x += ww) {
        const xe = Math.min(last + 1, x + ww); if (xe - x < ww / 2) break;
        let ink = 0; for (let k = x; k < xe; k++) ink += col[k];
        const dens = ink / ((xe - x) * h);
        if (dens > 0.03) { if (dens < dMin) dMin = dens; if (dens > dMax) dMax = dens; }
      }
    }
    F.maxSeg = maxSeg; F.meanSeg = worstMean; F.nSeg = nSegAll; F.densMin = dMin; F.densMax = dMax;
    if (maxSeg > P.maxSeg || worstMean > P.meanSeg) return (F.reason = R.SEG);
    if (nSegAll < P.minSegs) return (F.reason = R.FEWSEG);
    F.fill = nGl ? nTall / nGl : 0; if (G) F.gCount = G.n - F.gStart;
    if (F.fill < P.fillMin) return (F.reason = R.FILL);
    if (dMax > 0 && (dMin < P.densLo || dMax > P.densHi || dMax > dMin * P.densRatio)) return (F.reason = R.DENS);
    return (F.reason = R.PASS);
  }

  // Analyse one frame. Returns the per-cell decision (before temporal rules).
  function analyze(rgba, w, h, opts, wantFeatures) {
    const P = Object.assign({}, DEFAULTS, opts || {}), T = P.T, S = makeScratch(T), F = newFeat();
    const lv = [{ w, h, data: rgba }]; for (let l = 1; l < P.levels; l++) lv.push(halve(lv[l - 1]));
    const C = T >> 1, cols = Math.ceil(w / C), rows = Math.ceil(h / C), n = cols * rows;
    const kind = new Uint8Array(n), level = new Int8Array(n).fill(-1), reason = new Uint8Array(n).fill(255);   // kind: 0 blur, 1 text, 2 blank
    const par = new Float32Array(n * 8); // bg rgb, ink rgb, coreThr, spare
    const feats = wantFeatures ? [] : null, reasonL = []; for (let l = 0; l < P.levels; l++) reasonL.push(new Uint8Array(n).fill(255));
    // fine to coarse: a coarser tile is analysed only where some finer cell is still blurred
    const G = { buf: new Uint8Array(24 * 40000), n: 0, max: 40000, acc: new Int32Array(20) };
    for (let l = 0; l < P.levels; l++) for (let ph = 0; ph < 4; ph++) {
      const L = lv[l], ox = (ph & 1) * C, oy = (ph >> 1) * C, span = 1 << l;
      if (L.w - ox < C || L.h - oy < C) continue;
      const tc = Math.ceil((L.w - ox) / T), tr = Math.ceil((L.h - oy) / T), nt = tc * tr, first = l === 0 && ph === 0;
      const res = new Uint8Array(nt).fill(255), topH = new Uint8Array(nt), botH = new Uint8Array(nt), stitch = new Uint8Array(nt), gs = new Int32Array(nt), gc = new Int32Array(nt), tp = new Float32Array(nt * 7); G.n = 0;
      // display cells covered by window (tx,ty) of this level and phase
      const cellsOf = (tx, ty, fn) => { const x0 = ((tx * T + ox) / C) * span, y0 = ((ty * T + oy) / C) * span, x1 = Math.min(cols, x0 + 2 * span), y1 = Math.min(rows, y0 + 2 * span); for (let cy = y0; cy < y1; cy++) for (let cx = x0; cx < x1; cx++) fn(cy * cols + cx); };
      let want = null;
      if (!first) { // only windows that could still clear something (and their neighbours, for the alphabet tests) are analysed
        const need = new Uint8Array(nt); let any = false;
        for (let ty = 0; ty < tr; ty++) for (let tx = 0; tx < tc; tx++) { let nd = 0; cellsOf(tx, ty, c => { if (kind[c] === 0) nd = 1; }); if (nd) { need[ty * tc + tx] = 1; any = true; } }
        if (!any) continue; want = new Uint8Array(nt);
        for (let ty = 0; ty < tr; ty++) for (let tx = 0; tx < tc; tx++) { if (!need[ty * tc + tx]) continue; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = tx + dx, y = ty + dy; if (x >= 0 && y >= 0 && x < tc && y < tr) want[y * tc + x] = 1; } }
      }
      for (let ty = 0; ty < tr; ty++) for (let tx = 0; tx < tc; tx++) {
        const t = ty * tc + tx; if (want && !want[t]) continue;
        const tw = Math.min(T, L.w - ox - tx * T), th = Math.min(T, L.h - oy - ty * T);
        const r = analyzeTile(L, tx * T + ox, ty * T + oy, tw, th, P, S, F, G);
        if (r !== R.PASS) G.n = F.gStart; // only candidate tiles keep their glyphs
        res[t] = r; topH[t] = F.topH; botH[t] = F.botH; stitch[t] = r === R.PASS ? F.stitch : 0; gs[t] = F.gStart; gc[t] = r === R.PASS ? F.gCount : 0;
        tp[t * 7] = F.bg[0]; tp[t * 7 + 1] = F.bg[1]; tp[t * 7 + 2] = F.bg[2]; tp[t * 7 + 3] = F.ink[0]; tp[t * 7 + 4] = F.ink[1]; tp[t * 7 + 5] = F.ink[2]; tp[t * 7 + 6] = F.coreThr;
        if (feats && first) feats.push(Object.assign({}, F, { bg: F.bg.slice(), ink: F.ink.slice() }));
      }
      // alphabet tests on candidate tiles: letters repeat (twins nearby) but no single shape dominates
      const sg = G.buf, tol = P.twinTol, verdict = new Uint8Array(nt);
      const same = (a, b) => { const oa = a * 24, ob = b * 24; let d = sg[oa] - sg[ob]; if (d < -1 || d > 1) return false; d = sg[oa + 1] - sg[ob + 1]; if (d < -1 || d > 1) return false; let s = 0; for (let k = 4; k < 24; k++) { const e = sg[oa + k] - sg[ob + k]; s += e < 0 ? -e : e; if (s > tol) return false; } return true; };
      const strong = new Uint8Array(nt);
      for (let ty = 0; ty < tr; ty++) for (let tx = 0; tx < tc; tx++) {
        const t = ty * tc + tx; if (res[t] !== R.PASS) continue; const n0 = gc[t]; let twins = 0, top = 0;
        if (stitch[t]) { // a cut line must make a line of legal height with the tile above or below
          const up = ty > 0 ? t - tc : -1, dn = ty < tr - 1 ? t + tc : -1; let ok = false;
          if (dn >= 0 && res[dn] === R.PASS && botH[t] >= 2) { const hh = botH[t] + topH[dn]; if (hh >= P.hMin && hh <= P.hMax) ok = true; }
          if (up >= 0 && res[up] === R.PASS && topH[t] >= 2) { const hh = topH[t] + botH[up]; if (hh >= P.hMin && hh <= P.hMax) ok = true; }
          if (!ok) { verdict[t] = R.NOBAND; continue; }
        }
        for (let i = gs[t]; i < gs[t] + n0; i++) {
          let found = false, own = 1;
          for (let j = gs[t]; j < gs[t] + n0; j++) if (j !== i && same(i, j)) { found = true; own++; }
          if (own > top) top = own;
          for (let dy = -P.twinR; dy <= P.twinR && !found; dy++) for (let dx = -P.twinR; dx <= P.twinR && !found; dx++) { if (!dx && !dy) continue; const x = tx + dx, y = ty + dy; if (x < 0 || y < 0 || x >= tc || y >= tr) continue; const u = y * tc + x; if (res[u] !== R.PASS) continue; for (let j = gs[u]; j < gs[u] + gc[u]; j++) if (same(i, j)) { found = true; break; } }
          if (found) twins++;
        }
        const twin = n0 ? twins / n0 : 0, mono = n0 ? top / n0 : 0;
        if (feats && first) { feats[t].twin = twin; feats[t].mono = mono; feats[t].gCount = n0; }
        if (n0 >= P.twinNeed) { if (twin < P.twinMin) verdict[t] = R.TWIN; else if (mono > P.monoMax) verdict[t] = R.MONO; else strong[t] = 1; }
        else if (n0 > 0 && twins === 0 && n0 >= 3) verdict[t] = R.TWIN;
      }
      // tiles with too few whole letters to judge are text only beside tiles that proved an alphabet
      for (let ty = 0; ty < tr; ty++) for (let tx = 0; tx < tc; tx++) {
        const t = ty * tc + tx; if (res[t] !== R.PASS || verdict[t] || strong[t]) continue; let k = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = tx + dx, y = ty + dy; if ((dx || dy) && x >= 0 && y >= 0 && x < tc && y < tr && strong[y * tc + x]) k++; }
        if (k < P.weakNeed) verdict[t] = R.TWIN;
      }
      for (let ty = 0; ty < tr; ty++) for (let tx = 0; tx < tc; tx++) {
        const t = ty * tc + tx; let r = res[t]; if (r === 255) continue; if (r === R.PASS && verdict[t]) r = verdict[t];
        if (r === R.PASS) { // text comes in blocks: a lone passing window stays blurred
          let nn = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = tx + dx, y = ty + dy; if ((dx || dy) && x >= 0 && y >= 0 && x < tc && y < tr && res[y * tc + x] === R.PASS && !verdict[y * tc + x]) nn++; }
          if (nn < P.minNeighbours) r = R.TWIN;
        }
        if (feats && first) feats[t].reason = r;
        cellsOf(tx, ty, c => {
          if (ph === 0 || reasonL[l][c] === 255) reasonL[l][c] = r; if (first) reason[c] = r;
          if (r === R.PASS ? kind[c] === 1 : !(r === R.BLANK && l === 0 && kind[c] === 0)) return;
          kind[c] = r === R.PASS ? 1 : 2; level[c] = l; const o = c * 8; for (let k = 0; k < 7; k++) par[o + k] = tp[t * 7 + k];
        });
      }
    }
    // region rules: text comes in blocks; blank cells clear only beside clear text of the same background
    const clear = new Uint8Array(n); for (let c = 0; c < n; c++) if (kind[c] === 1) clear[c] = 1;
    for (let it = 0; it < P.blankReach; it++) {
      const add = [];
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
        const c = cy * cols + cx; if (kind[c] !== 2 || clear[c]) continue;
        let hit = false;
        for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= cols || y >= rows) continue; const k = y * cols + x; if (!clear[k]) continue;
          if (Math.abs(par[k * 8] - par[c * 8]) <= P.bgJoin && Math.abs(par[k * 8 + 1] - par[c * 8 + 1]) <= P.bgJoin && Math.abs(par[k * 8 + 2] - par[c * 8 + 2]) <= P.bgJoin) { hit = true; break; }
        }
        if (hit) add.push(c);
      }
      for (const c of add) clear[c] = 1;
    }
    return { P, cols, rows, T: C, cell: C, clear, kind, level, reason, reasonL, par, lv, feats };
  }

  // Paint one clear cell of an analysis: its flat background plus its one ink colour, the ink's shape from the frame.
  // Writes into out (RGBA) at (ox, oy) with row stride ow pixels; pixels past the frame stay transparent.
  // A REGION THAT PASSED AS TEXT IS SHOWN AS SENT (Nathan 2026-11-26): its original pixels, anti-aliasing and colour
  // included, so text reads exactly as it was shared. Safety lies in the judgement (only cells that passed every text
  // test on these very pixels, held still, and drop at their first change), not in repainting.
  // THE PAGE UNDER THE TEXT IS FLAT (Nathan 2026-11-26): inside a text region every pixel within tauLo of the region's
  // background colour is drawn as that colour; ink and its anti-alias ramp stay exactly as sent. Real text looks the
  // same; a faint picture, tint or tone laid behind the letters is not shown. bg: [r, g, b] or null (a small picture,
  // shown as sent).
  // A LETTER IS SHOWN WHOLE OR NOT AT ALL: knock (one byte per frame pixel, or null) marks the pixels of letters cut by
  // the edge of what is shown; they stay transparent, so the blur underneath shows there.
  // Those pixels are drawn in the mark colour mk (a plain soft-grey patch where the word is), so a reader sees that text
  // is there: the privacy blur underneath is so strong that a blurred word would look like empty page.
  function copyCell(rgba, w, h, c, cols, C, out, bg, tl, knock, mk) {
    const x0 = (c % cols) * C, y0 = ((c / cols) | 0) * C, x1 = Math.min(w, x0 + C), y1 = Math.min(h, y0 + C);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const q = (y * w + x) * 4, p = ((y - y0) * C + x - x0) * 4;
      if (knock && knock[y * w + x]) { out[p] = mk[0]; out[p + 1] = mk[1]; out[p + 2] = mk[2]; out[p + 3] = 255; continue; }
      let r = rgba[q], g = rgba[q + 1], b = rgba[q + 2];
      if (bg) { let d = r - bg[0]; if (d < 0) d = -d; let e = g - bg[1]; if (e < 0) e = -e; if (e > d) d = e; e = b - bg[2]; if (e < 0) e = -e; if (e > d) d = e; if (d <= tl) { r = bg[0]; g = bg[1]; b = bg[2]; } }
      out[p] = r; out[p + 1] = g; out[p + 2] = b; out[p + 3] = 255;
    }
  }
  // A text cell must hold a SHARP edge somewhere (the largest step between neighbouring pixels): a letter another filter
  // already blurred (a sender's) is a soft blob that can read as a different letter beside crisp ones, so it stays blurred.
  function sharpest(rgba, w, h, c, cols, C) {
    const x0 = (c % cols) * C, y0 = ((c / cols) | 0) * C, x1 = Math.min(w, x0 + C), y1 = Math.min(h, y0 + C); let m = 0, lo = 255, hi = 0;
    for (let y = y0; y < y1; y++) { let q = (y * w + x0) * 4, prev = -1;
      for (let x = x0; x < x1; x++, q += 4) { const Y = (rgba[q] * 77 + rgba[q + 1] * 150 + rgba[q + 2] * 29) >> 8; if (Y < lo) lo = Y; if (Y > hi) hi = Y; if (prev >= 0) { const d = Y > prev ? Y - prev : prev - Y; if (d > m) m = d; } prev = Y; if (y + 1 < y1) { const q2 = q + w * 4, Y2 = (rgba[q2] * 77 + rgba[q2 + 1] * 150 + rgba[q2 + 2] * 29) >> 8; const d2 = Y2 > Y ? Y2 - Y : Y - Y2; if (d2 > m) m = d2; } } }
    return { step: m, range: hi - lo };
  }
  function renderCell(A, rgba, w, h, c, out, ow, ox, oy) {
    const { cols, T } = A, x0 = (c % cols) * T, y0 = ((c / cols) | 0) * T, x1 = Math.min(w, x0 + T), y1 = Math.min(h, y0 + T);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const q = (y * w + x) * 4, p = ((oy + y - y0) * ow + ox + x - x0) * 4; out[p] = rgba[q]; out[p + 1] = rgba[q + 1]; out[p + 2] = rgba[q + 2]; out[p + 3] = 255; }
  }
  // The whole frame's clear cells into out (same size as the frame). Cells not clear are left untouched.
  function render(A, rgba, w, h, out, which) {
    for (let c = 0; c < A.cols * A.rows; c++) if (A.clear[c] && (!which || which[c])) renderCell(A, rgba, w, h, c, out, w, (c % A.cols) * A.T, ((c / A.cols) | 0) * A.T);
  }

  // The regions to analyse: aligned blocks holding a candidate cell, grown by `grow` blocks (the alphabet and neighbour
  // tests look that far), joined into rectangles. A region is analysed as a picture of its own: every test runs on its
  // real pixels, and a region's edge only takes context away (stricter, never looser). Past fullFrac: the whole frame.
  function regionsOf(cand, cols, rows, w, h, P) {
    const B = P.block, k = B / (P.T >> 1), bc = Math.ceil(w / B), brn = Math.ceil(h / B), mark = new Uint8Array(bc * brn);
    for (let c = 0; c < cols * rows; c++) if (cand[c]) mark[(((c / cols) | 0) / k | 0) * bc + ((c % cols) / k | 0)] = 1;
    const grow = new Uint8Array(bc * brn);
    for (let y = 0; y < brn; y++) for (let x = 0; x < bc; x++) {
      if (!mark[y * bc + x]) continue;
      for (let dy = -P.grow; dy <= P.grow; dy++) for (let dx = -P.grow; dx <= P.grow; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < bc && yy < brn) grow[yy * bc + xx] = 1; }
    }
    const seen = new Uint8Array(bc * brn), out = []; let area = 0;
    for (let i = 0; i < bc * brn; i++) {
      if (!grow[i] || seen[i]) continue;
      let x0 = bc, y0 = brn, x1 = -1, y1 = -1; const stack = [i]; seen[i] = 1;
      while (stack.length) {
        const j = stack.pop(), x = j % bc, y = (j / bc) | 0;
        if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
        const nb = [x > 0 ? j - 1 : -1, x < bc - 1 ? j + 1 : -1, y > 0 ? j - bc : -1, y < brn - 1 ? j + bc : -1];
        for (const u of nb) if (u >= 0 && grow[u] && !seen[u]) { seen[u] = 1; stack.push(u); }
      }
      const r = { x: x0 * B, y: y0 * B, w: Math.min(w, (x1 + 1) * B) - x0 * B, h: Math.min(h, (y1 + 1) * B) - y0 * B };
      area += r.w * r.h; out.push(r);
    }
    if (area >= P.fullFrac * w * h) return [{ x: 0, y: 0, w: w, h: h }];
    return out;
  }
  function crop(rgba, w, r) {
    const out = new Uint8Array(r.w * r.h * 4);
    for (let y = 0; y < r.h; y++) out.set(rgba.subarray(((r.y + y) * w + r.x) * 4, ((r.y + y) * w + r.x + r.w) * 4), y * r.w * 4);
    return out;
  }

  // THE TEMPORAL RULES. A cell is shown only from a vetted snapshot, after it held still, and drops back to blur at the
  // first tick it changes. tick(rgba) answers what changed in the overlay: cells newly shown (each with its own C x C
  // patch, packed) and cells hidden.
  function createState(w, h, opts) {
    const P = Object.assign({}, DEFAULTS, opts || {}), C = P.T >> 1, cols = Math.ceil(w / C), rows = Math.ceil(h / C), n = cols * rows;
    const st = { w, h, cols, rows, cell: C, P, shown: new Uint8Array(n), fpPrev: new Uint8Array(n * 16), fpSnap: new Uint8Array(n * 16),
      stable: new Uint16Array(n), strikes: new Uint8Array(n), judged: new Uint8Array(n), small: new Uint8Array(n), bg: new Uint8Array(n * 3), ticks: 0, analysedPx: 0,
      snap: new Uint8Array(n * C * C * 4), knock: new Uint8Array(w * h), cut: new Int32Array(n),
      mk: new Uint8Array(n), mkBox: new Uint8Array(n * 4), mkDark: new Uint8Array(n) };   // mk: 0 not looked at, 1 page without ink, 2 marked, 3 not page
    const snap32 = new Uint32Array(st.snap.buffer), CC = C * C, kSet = [], seen = new Uint8Array(w * h), seenSet = [];
    // SHOWN IS LIVE. A shown cell holds the very pixels it was vetted on (its snapshot). It stays shown only while the
    // live picture still equals that snapshot pixel by pixel (within snapTol, the noise of a video codec): a coarse
    // fingerprint cannot tell 'N' from 'Б' at the same place, and a stale cell beside fresh ones reads as another word.
    function keep(rgba, c) {
      const x0 = (c % cols) * C, y0 = ((c / cols) | 0) * C, x1 = Math.min(w, x0 + C), y1 = Math.min(h, y0 + C), s = st.snap;
      for (let y = y0; y < y1; y++) s.set(rgba.subarray((y * w + x0) * 4, (y * w + x1) * 4), (c * CC + (y - y0) * C) * 4);
    }
    function stale(u32, c) {   // u32: the live picture, one word per pixel
      const x0 = (c % cols) * C, y0 = ((c / cols) | 0) * C, cw = Math.min(w, x0 + C) - x0, y1 = Math.min(h, y0 + C), tol = P.snapTol;
      for (let y = y0; y < y1; y++) {
        let i = y * w + x0, j = c * CC + (y - y0) * C;
        for (const e = i + cw; i < e; i++, j++) {
          const a = u32[i], b = snap32[j]; if (a === b) continue;
          let d = (a & 255) - (b & 255); if (d > tol || d < -tol) return true;
          d = ((a >>> 8) & 255) - ((b >>> 8) & 255); if (d > tol || d < -tol) return true;
          d = ((a >>> 16) & 255) - ((b >>> 16) & 255); if (d > tol || d < -tol) return true;
        }
      }
      return false;
    }
    // WHOLE LETTERS. Where a shown text cell meets a cell that is not shown, a letter may lie across the edge: half of it
    // shown, half blurred, and half an 'о' reads 'с'. Every such letter is found on the live picture (ink in the shown
    // cell touching ink across the edge), together with the ink beside it in its word-part (closer than joinK of its
    // height: the rest of a 'ы', an accent, a dot), and is left out of the overlay whole. Rules (long thin straight runs)
    // are not letters. A shown cell is read from its snapshot (what is painted), a cell that is not shown from the live
    // picture. Every tick looks along the edges of what is shown (cheap); the letters are worked out again only when
    // the shown cells or the ink across an edge changed. Returns the shown cells whose cut changed.
    let cutSig = 0;
    function wholeLetters(rgba, shownChanged) {
      const tl = P.tauLo, K = st.knock, RL = P.ruleLen, RW = P.ruleW, S = st.snap, B = st.bg;
      const textCell = (c) => st.shown[c] === 1;   // (a small picture too: a letter in it that is cut at the edge goes whole)
      // is pixel (x, y) off the page colour of cell k
      const ink = (x, y, k) => {
        const c = ((y / C) | 0) * cols + ((x / C) | 0), b = k * 3; let D = rgba, q = (y * w + x) * 4;
        if (st.shown[c]) { D = S; q = (c * CC + (y % C) * C + (x % C)) * 4; }
        let d = D[q] - B[b]; if (d < 0) d = -d; let e = D[q + 1] - B[b + 1]; if (e < 0) e = -e; if (e > d) d = e; e = D[q + 2] - B[b + 2]; if (e < 0) e = -e; if (e > d) d = e; return d > tl; };
      // the edges: ink of a shown text cell touching ink (against that cell's page) in a cell that is not shown
      const seeds = []; let sig = 0;
      for (let c = 0; c < n; c++) {
        if (!textCell(c)) continue;
        const cx = c % cols, cy = (c / cols) | 0, x0 = cx * C, y0 = cy * C, x1 = Math.min(w, x0 + C) - 1, y1 = Math.min(h, y0 + C) - 1;
        for (let side = 0; side < 4; side++) {
          const nx = cx + (side === 0 ? -1 : side === 1 ? 1 : 0), ny = cy + (side === 2 ? -1 : side === 3 ? 1 : 0);
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || st.shown[ny * cols + nx]) continue;
          const len = side < 2 ? y1 - y0 + 1 : x1 - x0 + 1;
          for (let t = 0; t < len; t++) {
            const x = side === 0 ? x0 : side === 1 ? x1 : x0 + t, y = side === 2 ? y0 : side === 3 ? y1 : y0 + t;
            if (!ink(x, y, c)) continue;
            for (let d = -1; d <= 1; d++) {
              const xx = side === 0 ? x - 1 : side === 1 ? x + 1 : x + d, yy = side === 2 ? y - 1 : side === 3 ? y + 1 : y + d;
              if (xx < 0 || yy < 0 || xx >= w || yy >= h || ((yy / C) | 0) * cols + ((xx / C) | 0) !== ny * cols + nx) continue;
              if (ink(xx, yy, c)) { seeds.push(y * w + x); sig = (Math.imul(sig, 31) + y * w + x + 1) | 0; break; }
            }
          }
        }
      }
      if (!shownChanged && sig === cutSig) return [];
      cutSig = sig;
      const cut = new Int32Array(n);
      for (let i = 0; i < kSet.length; i++) K[kSet[i]] = 0; kSet.length = 0;
      const rule = (x, y, k) => {
        let a = x, b = x; while (a > 0 && x - a < RL && ink(a - 1, y, k)) a--; while (b < w - 1 && b - x < RL && ink(b + 1, y, k)) b++;
        if (b - a + 1 >= RL) { let u = y, v = y; while (u > 0 && y - u <= RW && ink(x, u - 1, k)) u--; while (v < h - 1 && v - y <= RW && ink(x, v + 1, k)) v++; if (v - u + 1 <= RW) return true; }
        a = y; b = y; while (a > 0 && y - a < RL && ink(x, a - 1, k)) a--; while (b < h - 1 && b - y < RL && ink(x, b + 1, k)) b++;
        if (b - a + 1 >= RL) { let u = x, v = x; while (u > 0 && x - u <= RW && ink(u - 1, y, k)) u--; while (v < w - 1 && v - x <= RW && ink(v + 1, y, k)) v++; if (v - u + 1 <= RW) return true; }
        return false;
      };
      // seen: 0 not looked at, 1 taken into a piece, 2 not letter ink
      const letterInk = (x, y) => { const j = y * w + x; if (seen[j] === 2) return false; const c = ((y / C) | 0) * cols + ((x / C) | 0); if (textCell(c) && ink(x, y, c) && !rule(x, y, c)) return true; seen[j] = 2; seenSet.push(j); return false; };
      // one connected piece of letter ink (inside shown text cells) from (sx, sy): its box, or null when already taken
      const piece = (sx, sy) => {
        if (seen[sy * w + sx] || !letterInk(sx, sy)) return null;
        const b = { x0: sx, y0: sy, x1: sx, y1: sy, px: [] }, stack = [sy * w + sx]; seen[sy * w + sx] = 1; seenSet.push(sy * w + sx);
        while (stack.length && b.px.length < 20000) {
          const i = stack.pop(), x = i % w, y = (i / w) | 0; b.px.push(i);
          if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; if (seen[j]) continue; if (letterInk(xx, yy)) { seen[j] = 1; seenSet.push(j); stack.push(j); } }
        }
        return b;
      };
      const unsee = (b) => { for (let i = 0; i < b.px.length; i++) seen[b.px[i]] = 0; };   // (still on seenSet: cleared at the end either way)
      const boxes = [];
      // a cut letter and its word-part
      const group = (first) => {
        const queue = [first], U = { x0: first.x0, y0: first.y0, x1: first.x1, y1: first.y1, px: [] }; let nTaken = 0;
        const take = (b) => { if (b.x0 < U.x0) U.x0 = b.x0; if (b.y0 < U.y0) U.y0 = b.y0; if (b.x1 > U.x1) U.x1 = b.x1; if (b.y1 > U.y1) U.y1 = b.y1; };   // one box for the whole word-part (no letter shapes or widths in the mark)
        boxes.push(U);
        while (queue.length) {
          const A = queue.pop(); take(A); if (++nTaken > P.joinMax) continue;
          const hA = A.y1 - A.y0 + 1, wA = A.x1 - A.x0 + 1, gx = Math.max(2, Math.round(P.joinK * hA)), gy = Math.max(3, Math.round(P.joinK * hA), Math.min(12, 2 * Math.max(hA, wA)));
          for (let y = Math.max(0, A.y0 - gy); y <= Math.min(h - 1, A.y1 + gy); y++) for (let x = Math.max(0, A.x0 - gx); x <= Math.min(w - 1, A.x1 + gx); x++) {
            if (seen[y * w + x]) continue; const B = piece(x, y); if (!B) continue;
            const hB = B.y1 - B.y0 + 1, rows = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) + 1, colsO = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) + 1;
            if (rows > 0) queue.push(B);                                            // beside it on the line: the word-part goes on
            else if (colsO > 0 && (hB <= 0.6 * hA || hA <= 0.6 * hB)) { if (hB > hA) queue.push(B); else take(B); }   // an accent or a dot and its letter
            else unsee(B);
          }
        }
      };
      for (let i = 0; i < seeds.length; i++) { const b = piece(seeds[i] % w, (seeds[i] / w) | 0); if (b) group(b); }
      // the cut letters' boxes (one pixel of margin for their soft edge); ink of another letter inside a box goes with it
      for (let pass = 0, from = 0; pass < 3 && from < boxes.length; pass++) {
        const to = boxes.length;
        for (let i = from; i < to; i++) { const b = boxes[i];
          for (let y = Math.max(0, b.y0 - 1); y <= Math.min(h - 1, b.y1 + 1); y++) for (let x = Math.max(0, b.x0 - 1); x <= Math.min(w - 1, b.x1 + 1); x++) { if (seen[y * w + x]) continue; const o = piece(x, y); if (o) boxes.push(o); } }
        from = to;
      }
      for (let i = 0; i < boxes.length; i++) { const b = boxes[i];
        for (let y = Math.max(0, b.y0 - 1); y <= Math.min(h - 1, b.y1 + 1); y++) for (let x = Math.max(0, b.x0 - 1); x <= Math.min(w - 1, b.x1 + 1); x++) {
          const j = y * w + x, c = ((y / C) | 0) * cols + ((x / C) | 0); if (K[j] || !textCell(c)) continue;
          K[j] = 1; kSet.push(j); cut[c] = (cut[c] + Math.imul(j + 1, 0x9E3779B1)) | 0; } }
      for (let i = 0; i < seenSet.length; i++) seen[seenSet[i]] = 0; seenSet.length = 0;
      const changed = [];
      for (let c = 0; c < n; c++) { if (cut[c] !== st.cut[c] && st.shown[c]) changed.push(c); st.cut[c] = st.shown[c] ? cut[c] : 0; }
      return changed;
    }
    const fp = new Uint8Array(n * 16);
    function fingerprints(rgba) {
      const q4 = C / 4;
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) {
        const x0 = cx * C + bx * q4, y0 = cy * C + by * q4; let s = 0, k = 0;
        for (let y = y0; y < Math.min(h, y0 + q4); y += 2) { let q = (y * w + x0) * 4; for (let x = x0; x < Math.min(w, x0 + q4); x += 2, q += 8) { s += (rgba[q] * 77 + rgba[q + 1] * 150 + rgba[q + 2] * 29) >> 8; k++; } }
        fp[(cy * cols + cx) * 16 + by * 4 + bx] = k ? s / k : 0;
      }
    }
    // Components (8-connected) of the cells for which pick(c) holds, each as a list of cells.
    function comps(pick) {
      const seen = new Uint8Array(n), out = [];
      for (let c0 = 0; c0 < n; c0++) {
        if (seen[c0] || !pick(c0)) continue;
        const list = [], stack = [c0]; seen[c0] = 1;
        while (stack.length) {
          const c = stack.pop(); list.push(c); const cx = c % cols, cy = (c / cols) | 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= cols || y >= rows) continue; const k = y * cols + x; if (!seen[k] && pick(k)) { seen[k] = 1; stack.push(k); } }
        }
        out.push(list);
      }
      return out;
    }
    // the cells around a component (inside the frame) are mostly (smallRing) shown text or page, none a small picture
    function ringed(list) {
      const inC = new Set(list), seen = new Set(); let on = 0, all = 0;
      for (const c of list) { const cx = c % cols, cy = (c / cols) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= cols || y >= rows) continue; const k = y * cols + x; if (inC.has(k) || seen.has(k)) continue; seen.add(k); all++;
          if (st.small[k]) return false; if (st.shown[k]) on++; } }
      return all > 0 && on >= P.smallRing * all;
    }
    // A letter cut by a cell edge: its other part sits in the next cell as a sliver of ink against the shared side. Left
    // blurred, half a letter reads as another letter (a blurred half-'Г' reads 'С'); shown, the word is whole.
    function slivers(rgba, newly) {
      const tl = P.tauLo, E = P.sliverEdge;
      for (let c = 0; c < n; c++) {
        if (st.shown[c] || !st.judged[c] || st.stable[c] < P.needStable) continue;
        const cx = c % cols, cy = (c / cols) | 0;
        for (const dx of [-1, 1]) {
          const x = cx + dx; if (x < 0 || x >= cols) continue; const k = cy * cols + x; if (!st.shown[k] || st.small[k]) continue;
          const bg = st.bg.subarray(k * 3, k * 3 + 3), x0 = cx * C, y0 = cy * C, x1 = Math.min(w, x0 + C), y1 = Math.min(h, y0 + C);
          const edge = dx > 0 ? x1 - 1 : x0; let ink = 0, far = 0, all = 0;
          for (let y = y0; y < y1; y++) for (let xx = x0; xx < x1; xx++) { all++; const q = (y * w + xx) * 4;
            let d = rgba[q] - bg[0]; if (d < 0) d = -d; let e = rgba[q + 1] - bg[1]; if (e < 0) e = -e; if (e > d) d = e; e = rgba[q + 2] - bg[2]; if (e < 0) e = -e; if (e > d) d = e;
            if (d > tl) { ink++; if ((dx > 0 ? edge - xx : xx - edge) >= E) far++; } }
          if (ink === 0 || far > 0 || ink > P.sliverMax * all) continue;
          st.shown[c] = 1; st.bg.set(bg, c * 3); st.fpSnap.set(fp.subarray(c * 16, c * 16 + 16), c * 16); newly.push(c); break;
        }
      }
    }
    function smallPictures(newly, hidden) {
      // a small picture whose ring is no longer shown text goes back to blur (it may now be part of something bigger)
      for (const list of comps((c) => st.small[c] && st.shown[c])) if (!ringed(list)) for (const c of list) { st.shown[c] = 0; st.small[c] = 0; hidden.push(c); }
      for (let c = 0; c < n; c++) if (st.small[c] && !st.shown[c]) st.small[c] = 0;
      for (const list of comps((c) => !st.shown[c] && st.judged[c] && st.stable[c] >= P.needStable)) {
        let x0 = cols, y0 = rows, x1 = -1, y1 = -1;
        for (const c of list) { const x = c % cols, y = (c / cols) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
        if (x1 - x0 + 1 > P.smallSide || y1 - y0 + 1 > P.smallSide || list.length > P.smallArea || !ringed(list)) continue;
        let near = false;
        for (let y = Math.max(0, y0 - P.smallGap); y <= Math.min(rows - 1, y1 + P.smallGap) && !near; y++) for (let x = Math.max(0, x0 - P.smallGap); x <= Math.min(cols - 1, x1 + P.smallGap); x++) if (st.small[y * cols + x]) { near = true; break; }
        if (near) continue;
        // (its page colour is the shown text's around it: the whole-letter rule reads a small picture's ink against it)
        let page = -1; for (const c of list) { const cx = c % cols, cy = (c / cols) | 0; for (let dy = -1; dy <= 1 && page < 0; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= cols || y >= rows) continue; const k = y * cols + x; if (st.shown[k] && !st.small[k]) { page = k; break; } } if (page >= 0) break; }
        if (page < 0) continue;
        for (const c of list) { st.shown[c] = 1; st.small[c] = 1; st.bg.set(st.bg.subarray(page * 3, page * 3 + 3), c * 3); st.fpSnap.set(fp.subarray(c * 16, c * 16 + 16), c * 16); newly.push(c); }
      }
    }
    // HIDDEN TEXT IS MARKED (Nathan 2026-11-26: silently missing words are as bad as wrong letters). A cell that was judged
    // and is not shown, lies on the page (most of it is the page colour of the shown cells it is reached from) and holds
    // ink, gets a plain patch over its ink's box in the mark colour: a soft grey smudge where the words are. The patch
    // says only "ink here" (one box and one of two shades per cell); pictures (cells that are not mostly page) get none,
    // their blur is plain to see. Found once per cell, when it has been judged; forgotten when the cell moves or is shown.
    function markOne(rgba, c, page) {
      const x0 = (c % cols) * C, y0 = ((c / cols) | 0) * C, x1 = Math.min(w, x0 + C), y1 = Math.min(h, y0 + C), tl = P.tauLo, B = st.bg, b = page * 3;
      let nPage = 0, nOff = 0, nInk = 0, a0 = C, b0 = C, a1 = -1, b1 = -1, lum = 0;
      for (let y = y0; y < y1; y++) { let q = (y * w + x0) * 4; for (let x = x0; x < x1; x++, q += 4) {
        let d = rgba[q] - B[b]; if (d < 0) d = -d; let e = rgba[q + 1] - B[b + 1]; if (e < 0) e = -e; if (e > d) d = e; e = rgba[q + 2] - B[b + 2]; if (e < 0) e = -e; if (e > d) d = e;
        if (d <= tl) { nPage++; continue; } nOff++; if (d < P.minInk) continue;   // (only ink as strong as text is marked: a faint picture behind the page draws no box)
        nInk++; lum += rgba[q] * 77 + rgba[q + 1] * 150 + rgba[q + 2] * 29;
        const u = x - x0, v = y - y0; if (u < a0) a0 = u; if (u > a1) a1 = u; if (v < b0) b0 = v; if (v > b1) b1 = v; } }
      if (c !== page) B.set(B.subarray(b, b + 3), c * 3);   // the page colour it was read against
      if (nPage < 0.5 * (nPage + nOff)) return (st.mk[c] = 3);
      if (!nInk) return (st.mk[c] = 1);
      st.mkBox[c * 4] = a0; st.mkBox[c * 4 + 1] = b0; st.mkBox[c * 4 + 2] = a1; st.mkBox[c * 4 + 3] = b1;
      st.mkDark[c] = lum / nInk < B[b] * 77 + B[b + 1] * 150 + B[b + 2] * 29 ? 1 : 0;
      return (st.mk[c] = 2);
    }
    function marks(rgba, out) {
      for (let again = true; again;) { again = false;
        for (let c = 0; c < n; c++) {
          if (st.shown[c] || !st.judged[c] || st.mk[c]) continue;
          const cx = c % cols, cy = (c / cols) | 0; let page = -1;
          for (let dy = -1; dy <= 1 && page < 0; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= cols || y >= rows || (!dx && !dy)) continue; const k = y * cols + x;
            if (st.shown[k] ? !st.small[k] : (st.mk[k] === 1 || st.mk[k] === 2)) { page = k; break; } }
          if (page < 0) continue;
          again = true; if (markOne(rgba, c, page) === 2) out.push(c);
        } }
    }
    const shade = (c, dark, out) => { for (let k = 0; k < 3; k++) { const v = st.bg[c * 3 + k] + (dark ? -P.markShade : P.markShade); out[k] = v < 0 ? 0 : v > 255 ? 255 : v; } return out; };
    const mkCol = new Uint8Array(3);
    function paintMark(c, out) {
      out.fill(0); shade(c, st.mkDark[c], mkCol);
      const a0 = Math.max(0, st.mkBox[c * 4] - 2), b0 = Math.max(0, st.mkBox[c * 4 + 1] - 2), a1 = Math.min(C - 1, st.mkBox[c * 4 + 2] + 2), b1 = Math.min(C - 1, st.mkBox[c * 4 + 3] + 2);
      for (let y = b0; y <= b1; y++) for (let x = a0; x <= a1; x++) { const p = (y * C + x) * 4, edge = x < st.mkBox[c * 4] || x > st.mkBox[c * 4 + 2] || y < st.mkBox[c * 4 + 1] || y > st.mkBox[c * 4 + 3];
        out[p] = mkCol[0]; out[p + 1] = mkCol[1]; out[p + 2] = mkCol[2]; out[p + 3] = edge ? 128 : 255; }   // (a softer rim around the ink's box; the ink itself is always covered)
    }
    // a shown cell is painted from its snapshot (the vetted pixels), less the letters cut at the edge of what is shown
    const cellBuf = new Uint8Array(CC * 4), cellKnock = new Uint8Array(CC);
    st.paint = (rgba, c, out) => {
      if (!st.shown[c]) { if (st.mk[c] === 2) paintMark(c, out); else out.fill(0); return; }
      const x0 = (c % cols) * C, y0 = ((c / cols) | 0) * C, cw = Math.min(w, x0 + C) - x0, ch = Math.min(h, y0 + C) - y0; let any = false;
      if (st.cut[c]) { let lum = 0, k = 0; const S = st.snap, o = c * CC * 4; cellKnock.fill(0);
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (st.knock[(y0 + y) * w + x0 + x]) { cellKnock[y * C + x] = 1; any = true; const p = o + (y * C + x) * 4; let d = 0; for (let j = 0; j < 3; j++) d = Math.max(d, Math.abs(S[p + j] - st.bg[c * 3 + j])); if (d > P.tauLo) { lum += S[p] * 77 + S[p + 1] * 150 + S[p + 2] * 29; k++; } }
        shade(c, !k || lum / k < st.bg[c * 3] * 77 + st.bg[c * 3 + 1] * 150 + st.bg[c * 3 + 2] * 29, mkCol); }
      copyCell(st.snap.subarray(c * CC * 4, (c + 1) * CC * 4), C, ch, 0, 1, C, out, st.small[c] ? null : st.bg.subarray(c * 3, c * 3 + 3), P.tauLo, any ? cellKnock : null, mkCol);
      if (cw < C) for (let y = 0; y < ch; y++) out.fill(0, (y * C + cw) * 4, (y + 1) * C * 4);
    };
    function differs(a, b, c) { for (let i = c * 16; i < c * 16 + 16; i++) if (Math.abs(a[i] - b[i]) > P.fpTol) return true; return false; }
    st.tick = function (rgba) {
      fingerprints(rgba);
      if (rgba.byteOffset & 3) rgba = new Uint8Array(rgba);   // (a copy aligned to 4 bytes; a page's or a Worker's frame is aligned already)
      const u32 = new Uint32Array(rgba.buffer, rgba.byteOffset, w * h);
      let dirty = false; const cand = new Uint8Array(n), hidden = [], unmark = [];
      for (let c = 0; c < n; c++) {
        const moved = st.ticks === 0 || differs(fp, st.fpPrev, c);
        if (moved) { st.stable[c] = 0; st.judged[c] = 0; if (st.mk[c]) { if (st.mk[c] === 2 && !st.shown[c]) unmark.push(c); st.mk[c] = 0; } } else if (st.stable[c] < 65535) st.stable[c]++;
        if (st.shown[c] && (differs(fp, st.fpSnap, c) || stale(u32, c))) { st.shown[c] = 0; st.small[c] = 0; hidden.push(c);
          // A change the fingerprint did not see (a letter-sized edit, or a video codec sharpening a still picture): the
          // cell did not move, so it earns no strike and no wait; it is judged again on this very frame and shown from
          // it if it passes. What is shown was still vetted on the pixels that are painted.
          if (moved) { if (st.strikes[c] < P.maxStrikes) st.strikes[c]++; } else { st.judged[c] = 0; cand[c] = 1; dirty = true; } }
        if (!st.shown[c] && !st.judged[c] && st.stable[c] >= P.needStable + st.strikes[c]) { cand[c] = 1; dirty = true; }
      }
      const newly = [];
      let patches = null, regions = 0, px = 0;
      if (dirty) { // analyse only where some cell could newly clear; a static, already shown frame costs fingerprints only
        const done = new Uint8Array(n);
        for (const r of regionsOf(cand, cols, rows, w, h, P)) {
          const whole = r.w === w && r.h === h, src = whole ? rgba : crop(rgba, w, r);
          const A = analyze(src, r.w, r.h, P); regions++; px += r.w * r.h;
          const ox = r.x / C, oy = r.y / C;
          for (let cy = 0; cy < A.rows; cy++) for (let cx = 0; cx < A.cols; cx++) {
            const c = (cy + oy) * cols + cx + ox; if (!cand[c] || done[c]) continue;
            done[c] = 1; st.judged[c] = 1;   // a cell judged blurred is not analysed again until it changes
            const a = cy * A.cols + cx;
            let soft = false;
            if (A.clear[a] && A.kind[a] === 1) { const sh = sharpest(rgba, w, h, c, cols, C); soft = sh.range > P.tauLo && sh.step < P.sharpMin * Math.min(1, sh.range / 128); }   // content, but no edge as sharp as its own contrast allows
            if (A.clear[a] && !soft) {
              st.shown[c] = 1; st.fpSnap.set(fp.subarray(c * 16, c * 16 + 16), c * 16); newly.push(c);
              st.bg[c * 3] = A.par[a * 8]; st.bg[c * 3 + 1] = A.par[a * 8 + 1]; st.bg[c * 3 + 2] = A.par[a * 8 + 2];
            }
          }
        }
      }
      smallPictures(newly, hidden);
      slivers(rgba, newly);
      const fresh = newly.length, isNew = new Uint8Array(n);
      for (let i = 0; i < fresh; i++) { keep(rgba, newly[i]); isNew[newly[i]] = 1; st.mk[newly[i]] = 0; }
      for (const c of wholeLetters(rgba, fresh > 0 || hidden.length > 0)) if (!isNew[c]) newly.push(c);   // shown before, its cut letters changed: painted again
      marks(rgba, newly);   // (cells that are not shown: their patch is the mark)
      if (newly.length) {
        patches = new Uint8Array(newly.length * C * C * 4);
        newly.forEach((c, i) => st.paint(rgba, c, patches.subarray(i * C * C * 4, (i + 1) * C * C * 4)));
      }
      st.fpPrev.set(fp); st.ticks++; st.analysedPx += px;
      // newly: every cell to paint (a shown cell's patch, or a mark); the first `fresh` of them were not shown before.
      // hidden: every cell to clear; the first `lost` of them were shown.
      const lost = hidden.length; for (const c of unmark) hidden.push(c);
      return { analysed: dirty, regions, px, fresh, lost, newly: Int32Array.from(newly), patches: patches || new Uint8Array(0), hidden: Int32Array.from(hidden) };
    };
    return st;
  }

  // ======================================= THE WORKER =======================================
  // The analysis runs off the page's thread. One Worker serves every stream on the page; a stream is its id.
  function serveWorker(G) {
    const states = new Map();
    const now = () => (G.performance && G.performance.now ? G.performance.now() : Date.now());
    G.onmessage = function (e) {
      const m = e.data || {};
      if (m.op === 'drop') { states.delete(m.id); return; }
      if (m.op !== 'tick') return;
      let st = states.get(m.id);
      if (!st || st.w !== m.w || st.h !== m.h) { st = createState(m.w, m.h, m.opts); states.set(m.id, st); }
      const t0 = now(); const r = st.tick(new Uint8Array(m.buf)); const ms = now() - t0;
      G.postMessage({ op: 'res', id: m.id, seq: m.seq, w: m.w, h: m.h, cell: st.cell, cols: st.cols, analysed: r.analysed, regions: r.regions, px: r.px, ms: ms, fresh: r.fresh, lost: r.lost,
        newly: r.newly, patches: r.patches, hidden: r.hidden, buf: m.buf }, [m.buf, r.newly.buffer, r.patches.buffer, r.hidden.buffer]);
    };
  }

  // ======================================= THE PAGE RUNTIME =======================================
  function installRuntime(W, factory) {
    const GifOS = W.GifOS = W.GifOS || {};
    const TCm = W.GifOSTextClear;
    const T = GifOS.timings || {};
    // js/timings.js (TEXTCLEAR_*); the numbers and their derivations are in the global timings table.
    const TICK_MS = T.TEXTCLEAR_TICK_MS, MAX_TICK_MS = T.TEXTCLEAR_MAX_TICK_MS, KEEP_MS = T.TEXTCLEAR_KEEPALIVE_MS;
    const COST_K = 4;   // the tick waits this many times the last analysis: the filter keeps to about a quarter of one core
    const SIZES = [1920, 1280, 960, 640];   // the analysed picture's long side, step by step when a device is over budget
    // The Worker runs this module's own factory from a blob (the factory is self-contained), so a release snapshot that
    // bundles every script into one file still starts it.
    const SELF = (function () { try { return W.URL.createObjectURL(new W.Blob(['"use strict";(' + String(factory) + ')().serveWorker(self);'], { type: 'text/javascript' })); } catch (e) { return ''; } })();
    const now = () => (W.performance && W.performance.now ? W.performance.now() : Date.now());
    let worker = null, workerDead = !SELF || typeof W.Worker !== 'function', engN = 0;
    const waiting = new Map();   // engine id -> resolve of its one tick in flight
    const inline = new Map();    // engine id -> state, when no Worker can run (the page's own thread)
    function post(eng, msg, buf) {
      if (!workerDead && !worker) {
        try {
          worker = new W.Worker(SELF);
          worker.onmessage = (e) => { const m = e.data || {}; const f = waiting.get(m.id); if (f) { waiting.delete(m.id); f(m); } };
          worker.onerror = () => { workerDead = true; try { worker.terminate(); } catch (e) {} worker = null; for (const [id, f] of Array.from(waiting)) { waiting.delete(id); f(null); } };
        } catch (e) { workerDead = true; worker = null; }
      }
      return new Promise((resolve) => {
        if (worker) { waiting.set(eng.id, resolve); try { worker.postMessage(msg, [buf]); return; } catch (e) { waiting.delete(eng.id); } }
        // no Worker: the same code on this thread
        let st = inline.get(eng.id);
        if (!st || st.w !== msg.w || st.h !== msg.h) { st = TCm.createState(msg.w, msg.h, msg.opts); inline.set(eng.id, st); }
        const t0 = now(); const r = st.tick(new Uint8Array(buf));
        resolve({ id: eng.id, w: msg.w, h: msg.h, cell: st.cell, cols: st.cols, analysed: r.analysed, regions: r.regions, px: r.px, ms: now() - t0, fresh: r.fresh, lost: r.lost, newly: r.newly, patches: r.patches, hidden: r.hidden });
      });
    }
    function dropState(id) { inline.delete(id); if (worker) { try { worker.postMessage({ op: 'drop', id: id }); } catch (e) {} } }

    // ONE ANALYSIS STREAM: its overlay canvas (at the analysed size: the vetted cells, transparent elsewhere), its
    // tick and its budget. run(src, sw, sh, capLong) analyses one frame of src when the tick is due.
    function engine() {
      const eng = { id: ++engN, w: 0, h: 0, step: 0, gaveUp: false, busy: false, next: 0, cost: 0, overN: 0, ticks: 0, analysed: 0, shownN: 0, lastMs: 0, gen: 0, ver: 0, opts: null };
      eng.ov = W.document.createElement('canvas'); eng.ov.width = eng.ov.height = 1;
      eng.ovx = eng.ov.getContext('2d');
      eng.grab = W.document.createElement('canvas');
      eng.grabx = eng.grab.getContext('2d', { willReadFrequently: true });
      eng.reset = function () {
        dropState(eng.id); eng.id = ++engN; eng.gen++;   // a new id: an answer still in flight for the old picture is dropped
        eng.ovx.clearRect(0, 0, eng.ov.width, eng.ov.height); eng.shownN = 0; eng.ver++;
      };
      eng.due = function (t) { return !eng.busy && !eng.gaveUp && t >= eng.next; };
      // The size this device analyses now: the source's own, capped by what is painted (capLong) and the budget step.
      eng.sizeFor = function (sw, sh, capLong) {
        const long = Math.min(Math.max(sw, sh), SIZES[eng.step], capLong || 1e9), k = Math.min(1, long / Math.max(1, sw, sh));
        return { w: Math.max(32, Math.round(sw * k)), h: Math.max(32, Math.round(sh * k)) };
      };
      eng.run = function (src, sw, sh, capLong) {
        const t = now();
        // an analysis that never answers (a Worker that hangs) frees the stream and forgets what it showed
        if (eng.busy && t - eng.busyAt > 4 * MAX_TICK_MS) { eng.busy = false; eng.reset(); }
        if (!eng.due(t) || !(sw > 0 && sh > 0)) return null;
        const sz = eng.sizeFor(sw, sh, capLong);
        if (sz.w !== eng.w || sz.h !== eng.h) {
          eng.reset(); eng.w = sz.w; eng.h = sz.h;
          eng.ov.width = sz.w; eng.ov.height = sz.h; eng.grab.width = sz.w; eng.grab.height = sz.h;
        }
        let img = null;
        try { eng.grabx.drawImage(src, 0, 0, eng.w, eng.h); img = eng.grabx.getImageData(0, 0, eng.w, eng.h); } catch (e) { img = null; }
        if (!img) { eng.next = t + TICK_MS; return null; }
        eng.busy = true; eng.busyAt = t; eng.ticks++;
        const gen = eng.gen, buf = img.data.buffer, grabMs = now() - t;
        return post(eng, { op: 'tick', id: eng.id, seq: eng.ticks, w: eng.w, h: eng.h, buf: buf, opts: eng.opts }, buf).then((m) => {
          eng.busy = false;
          if (!m) { eng.reset(); eng.next = now() + TICK_MS; return true; }   // the analysis failed: what it showed goes too
          if (gen !== eng.gen || m.w !== eng.w || m.h !== eng.h) return false;   // the picture changed size meanwhile
          const C = m.cell, cols = m.cols;
          for (let i = 0; i < m.hidden.length; i++) { const c = m.hidden[i]; eng.ovx.clearRect((c % cols) * C, ((c / cols) | 0) * C, C, C); }
          const P = new Uint8ClampedArray(m.patches.buffer, m.patches.byteOffset, m.patches.length);
          for (let i = 0; i < m.newly.length; i++) {
            const c = m.newly[i];
            const id = new ImageData(new Uint8ClampedArray(P.buffer, P.byteOffset + i * C * C * 4, C * C * 4), C, C);
            eng.ovx.putImageData(id, (c % cols) * C, ((c / cols) | 0) * C);
          }
          eng.shownN += m.fresh - m.lost;
          if (m.newly.length || m.hidden.length) eng.ver++;
          const ms = m.ms + grabMs; eng.lastMs = ms; eng.lastWork = m.ms;
          if (m.analysed) {
            eng.analysed++;
            eng.cost = eng.cost ? eng.cost * 0.5 + ms * 0.5 : ms;
            // THE BUDGET LADDER (Nathan 2026-11-26): the tick waits COST_K x the analysis (at most a quarter of a core);
            // past MAX_TICK_MS that is too slow a tick, so the next step analyses a smaller picture; at the smallest,
            // twice over budget, the share falls back to the full blur (fail closed).
            if (ms * COST_K > MAX_TICK_MS) {
              if (eng.step < SIZES.length - 1) { eng.step++; eng.overN = 0; }
              else if (++eng.overN >= 2) { eng.gaveUp = true; eng.reset(); }
            } else eng.overN = 0;
          }
          eng.next = now() + Math.max(TICK_MS, Math.min(MAX_TICK_MS, COST_K * (m.analysed ? ms : 0)));
          return m.newly.length > 0 || m.hidden.length > 0;
        });
      };
      eng.stop = function () { dropState(eng.id); eng.gen++; eng.gaveUp = true; };
      eng.state = function () { return { w: eng.w, h: eng.h, step: eng.step, size: SIZES[eng.step], gaveUp: eng.gaveUp, ticks: eng.ticks, analysed: eng.analysed, shown: eng.shownN, cost: Math.round(eng.cost), lastMs: Math.round(eng.lastMs), work: Math.round(eng.lastWork || 0), worker: !!worker }; };
      return eng;
    }

    // ---- THE SENDER: the screen pipe's painter (js/core/media/plane-browser.js startBlurPipe, a share in text mode).
    // The shipped canvas holds only the blurred frame (drawn small, stretched) and the vetted overlay; the raw frame is
    // drawn only into the engine's private grab canvas. Paints at the engine's tick and at least every KEEP_MS (a late
    // joiner gets a picture); requestFrame on a captureStream(0) track ships exactly those frames (about 2 per second).
    const senders = new Set();
    function sender(o) {
      const eng = engine(), small = W.document.createElement('canvas'), sx = small.getContext('2d');
      let lastShip = -1e9;
      const s = { eng: eng, painted: 0 };
      senders.add(s);
      function composite(W2, H2) {
        const cv = o.canvas, ctx = o.ctx;
        // A WebKit sender that ships VP8 needs frames of 16 columns and 2 rows (plane-browser WK_H264_BLIND).
        if (o.align) { W2 = Math.max(16, Math.round(W2 / 16) * 16); H2 = Math.max(2, Math.round(H2 / 2) * 2); }
        if (cv.width !== W2 || cv.height !== H2) { cv.width = W2; cv.height = H2; }
        const cap = typeof o.blurCap === 'function' ? o.blurCap() : o.blurCap;
        const k = Math.min(1, cap / Math.max(1, W2, H2)), bw = Math.max(2, Math.round(W2 * k)), bh = Math.max(2, Math.round(H2 * k));
        if (small.width !== bw || small.height !== bh) { small.width = bw; small.height = bh; }
        o.blur(sx, o.src, bw, bh);   // the privacy blur, at its own small size (plane-browser blurDraw)
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(small, 0, 0, bw, bh, 0, 0, W2, H2);
        if (!eng.gaveUp && eng.w) ctx.drawImage(eng.ov, 0, 0, eng.w, eng.h, 0, 0, W2, H2);
        lastShip = now(); s.painted++;
        const tr = o.track && o.track();
        if (tr && typeof tr.requestFrame === 'function') { try { tr.requestFrame(); } catch (e) {} }
      }
      s.tick = function () {
        const src = o.src, sw = src.videoWidth, sh = src.videoHeight;
        if (!(sw > 0 && sh > 0)) return false;
        const sz = eng.sizeFor(sw, sh, o.capLong);
        const p = eng.run(src, sw, sh, o.capLong);
        if (p) { p.then(() => { try { composite(eng.w || sz.w, eng.h || sz.h); } catch (e) {} }); return true; }
        if (now() - lastShip >= KEEP_MS && !eng.busy) { composite(eng.w || sz.w, eng.h || sz.h); return true; }
        return false;
      };
      s.stop = function () { eng.stop(); senders.delete(s); };
      return s;
    }

    // ---- THE VIEWER: an overlay canvas over a share <video> that wears a blur class. Every surface that shows the same
    // track shares one engine (one analysis per track), sized for the largest of them on screen.
    const views = new Set();          // video elements with an overlay
    const byTrack = new Map();        // track -> engine
    let loopT = null;
    function overlayOf(v) {
      let cv = v.__tcOv;
      if (!cv || !cv.isConnected || cv.previousSibling !== v) {
        if (cv) { try { cv.remove(); } catch (e) {} }
        cv = W.document.createElement('canvas');
        cv.className = 'tc-ov'; cv.setAttribute('aria-hidden', 'true');
        cv.style.cssText = 'position:absolute;pointer-events:none;left:0;top:0;width:0;height:0;display:none';
        if (v.parentNode) v.parentNode.insertBefore(cv, v.nextSibling);
        v.__tcOv = cv; cv.__tcSig = '';
      }
      return cv;
    }
    function view(v, on) {
      if (!v || !v.classList) return;
      if (!on) {
        if (!views.has(v) && !v.__tcOv) return;
        views.delete(v); v.classList.remove('tcx');
        if (v.__tcOv) { try { v.__tcOv.remove(); } catch (e) {} v.__tcOv = null; }
        return;
      }
      if (!views.has(v)) { views.add(v); v.classList.add('tcx'); }
      overlayOf(v);
      if (!loopT) loopT = W.setTimeout(loop);   // the next turn: one look, then the tick
    }
    function trackOf(v) { const s = v.srcObject; const t = s && typeof s.getVideoTracks === 'function' ? s.getVideoTracks()[0] : null; return t && t.readyState !== 'ended' ? t : null; }
    // Draw an engine's overlay over one video element, where its picture lies (object-fit), at the element's size.
    function paintView(v, eng) {
      const cv = overlayOf(v);
      const bw = v.offsetWidth, bh = v.offsetHeight, vw = v.videoWidth, vh = v.videoHeight;
      let vis = 'visible'; try { vis = W.getComputedStyle(v).visibility; } catch (e) {}
      if (!(bw > 0 && bh > 0 && vw > 0 && vh > 0) || !eng || eng.gaveUp || !eng.w || v.hidden || vis !== 'visible') { if (cv.style.display !== 'none') cv.style.display = 'none'; cv.__tcSig = ''; return; }
      let left = v.offsetLeft, top = v.offsetTop;
      if (v.offsetParent !== cv.offsetParent && cv.offsetParent) {   // not the same box to measure from: use the screen
        const a = v.getBoundingClientRect(), b = cv.offsetParent.getBoundingClientRect(), sc = a.width / Math.max(1, bw);
        left = (a.left - b.left) / Math.max(1e-6, sc) - cv.offsetParent.clientLeft; top = (a.top - b.top) / Math.max(1e-6, sc) - cv.offsetParent.clientTop;
      }
      const dpr = Math.min(2, W.devicePixelRatio || 1), pw = Math.max(1, Math.round(bw * dpr)), ph = Math.max(1, Math.round(bh * dpr));
      let fit = 'contain'; try { fit = W.getComputedStyle(v).objectFit || 'contain'; } catch (e) {}
      const sig = [left, top, bw, bh, pw, ph, vw, vh, fit, eng.id, eng.ver].join(',');
      if (cv.__tcSig === sig && cv.style.display !== 'none') return;
      cv.__tcSig = sig;
      cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = bw + 'px'; cv.style.height = bh + 'px'; cv.style.display = '';
      if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
      const x = cv.getContext('2d');
      x.clearRect(0, 0, pw, ph);
      let dw, dh;
      if (fit === 'fill') { dw = pw; dh = ph; } else { const s = fit === 'cover' ? Math.max(pw / vw, ph / vh) : Math.min(pw / vw, ph / vh); dw = vw * s; dh = vh * s; }
      x.imageSmoothingEnabled = true;
      x.drawImage(eng.ov, 0, 0, eng.w, eng.h, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
    }
    function loop() {
      loopT = null;
      const groups = new Map();
      for (const v of Array.from(views)) {
        if (!v.isConnected) { view(v, false); continue; }
        const t = trackOf(v);
        if (!t) { if (v.__tcOv) v.__tcOv.style.display = 'none'; continue; }
        let g = groups.get(t); if (!g) { g = []; groups.set(t, g); } g.push(v);   // one engine per track object (ids come from the sender)
      }
      for (const id of Array.from(byTrack.keys())) if (!groups.has(id)) { byTrack.get(id).stop(); byTrack.delete(id); }
      if (!W.document.hidden) {
        for (const [id, els] of groups) {
          let eng = byTrack.get(id);
          if (!eng) { eng = engine(); byTrack.set(id, eng); }
          let src = null, cap = 0;
          for (const v of els) {
            if (v.offsetWidth > 0 && !v.hidden) cap = Math.max(cap, Math.max(v.offsetWidth, v.offsetHeight) * Math.min(2, W.devicePixelRatio || 1));
            if (!src && v.readyState >= 2 && v.videoWidth > 0) src = v;
          }
          if (src && cap > 0) {
            // The picture is analysed at the size it arrives (the budget ladder may shrink it), not at the size it is drawn:
            // text too small on a small surface still reads once the person makes it big, and what is drawn is only ever
            // the overlay's own cells, scaled. A surface that small (a thumbnail) needs no more than SIZES[2].
            const p = eng.run(src, src.videoWidth, src.videoHeight, cap < 480 ? SIZES[2] : 0);
            if (p) p.then(() => { for (const v of els) { try { paintView(v, eng); } catch (e) {} } });
          }
          for (const v of els) { try { paintView(v, eng); } catch (e) {} }
        }
      }
      if (views.size) loopT = W.setTimeout(loop, TICK_MS / 2);
    }
    function engineOf(v) { const t = v && trackOf(v); return (t && byTrack.get(t)) || null; }
    function stateOf(v) { const eng = engineOf(v); return eng ? eng.state() : null; }

    GifOS.textClear = { view: view, sender: sender, engine: engine, stateOf: stateOf, SIZES: SIZES,
      viewsForTest: () => Array.from(views), engineForTest: engineOf, sendersForTest: () => Array.from(senders).map((x) => Object.assign({ painted: x.painted }, x.eng.state())) };   // tests read the overlay a viewer shows (its cells, at the analysed size)
  }

  return { DEFAULTS, R, RNAME, analyze, render, renderCell, regionsOf, createState, analyzeTile, makeScratch, newFeat, halve, serveWorker, installRuntime };
});
