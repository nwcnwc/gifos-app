/*
 * meet-views.js — place comfy tiles, slice the stadium, drag the control bar.
 * Geometry comes from meet-layout.js. This file touches the DOM and nothing
 * about peers: the page hands it elements and numbers.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};

  const GUTTER = 8;
  // An app in a meeting is laid out here like a shared screen (the page hands
  // it in as a Stage tile); only the app-only and broadcast pages are not.
  const BLOCK = ['broadcast', 'app-room', 'solo-app'];

  function comfyAllowed(body) {
    // A normal #v= room never gets body.meet-session (only an mb=1 frame
    // does). The page decides "a room is open" before it calls this.
    if (!body || !body.classList) return false;
    for (let i = 0; i < BLOCK.length; i++) if (body.classList.contains(BLOCK[i])) return false;
    return true;
  }

  function placeEl(el, r) {
    if (!el || !r) return;
    const s = el.style;
    s.position = 'absolute';
    s.left = r.x + 'px';
    s.top = r.y + 'px';
    s.width = Math.max(0, r.w) + 'px';
    s.height = Math.max(0, r.h) + 'px';
    s.right = 'auto';
    s.bottom = 'auto';
    s.margin = '0';
    s.display = '';
    el.dataset.comfy = '1';
    if (el.classList) el.classList.remove('comfy-off');
  }

  function parkEl(el) {
    if (!el || !el.classList) return;
    el.classList.add('comfy-off');
  }

  function markSelf(el, spec) {
    if (!el || !el.dataset) return;
    const arrangement = (spec && spec.arrangement) || 'tile';
    el.dataset.self = arrangement;
    if (arrangement === 'float') {
      el.tabIndex = 0;
      el.dataset.selfFocus = '1';
    } else if (el.dataset.selfFocus) {
      el.removeAttribute('tabindex');
      delete el.dataset.selfFocus;
    }
  }

  function clearEl(el) {
    if (!el || !el.style) return;
    const s = el.style;
    s.position = '';
    s.left = '';
    s.top = '';
    s.width = '';
    s.height = '';
    s.right = '';
    s.bottom = '';
    s.margin = '';
    if (el.classList) el.classList.remove('comfy-off');
    if (el.dataset) {
      delete el.dataset.comfy;
      delete el.dataset.gutter;
      delete el.dataset.self;
      if (el.dataset.selfFocus) {
        el.removeAttribute('tabindex');
        delete el.dataset.selfFocus;
      }
    }
  }

  function clearRoot(feed) {
    if (!feed || !feed.querySelectorAll) return;
    const placed = feed.querySelectorAll('[data-comfy], .comfy-off');
    for (let i = 0; i < placed.length; i++) clearEl(placed[i]);
    const faces = feed.querySelector('#stadfaces');
    if (faces) faces.remove();
    const crowd = feed.querySelector('#stadcrowd');
    if (crowd) crowd.remove();
    const band = root.document && root.document.getElementById('stadband');
    if (band) band.remove();
    const src = feed.querySelector('[data-row="sd"]');
    if (src && src.classList) src.classList.remove('stad-src');
  }

  // Dark enough that white (#fff) initials clear WCAG AA (4.5:1) on both
  // stops. The index is a hash of the stable id, so one person keeps one
  // color across reloads and devices.
  const SHADES = [
    ['#3b4d78', '#243252'],
    ['#4c3d72', '#2e2448'],
    ['#2c5a46', '#1a382c'],
    ['#6b4532', '#3e281c'],
    ['#2c4e5c', '#1a323c'],
    ['#6a3848', '#3e222c'],
    ['#4a4a30', '#2e2e1c'],
    ['#3a4564', '#242c42'],
    ['#523a5c', '#322438'],
    ['#345248', '#1e322c'],
    ['#5c4036', '#38261e'],
    ['#32485e', '#1e2e3c'],
  ];
  function shadeIndex(id) {
    const s = String(id || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % SHADES.length;
  }
  function sharesEdge(a, b) {
    const eps = 1.5;
    const ax2 = a.x + a.w, ay2 = a.y + a.h, bx2 = b.x + b.w, by2 = b.y + b.h;
    const vert = Math.abs(ax2 - b.x) <= eps || Math.abs(bx2 - a.x) <= eps;
    const horiz = Math.abs(ay2 - b.y) <= eps || Math.abs(by2 - a.y) <= eps;
    const yOverlap = Math.min(ay2, by2) - Math.max(a.y, b.y) > eps;
    const xOverlap = Math.min(ax2, bx2) - Math.max(a.x, b.x) > eps;
    return (vert && yOverlap) || (horiz && xOverlap);
  }
  // Reading order, then bump only a tile that would match a neighbor already
  // placed. The same people in the same seats keep the same colors.
  let shadePlan = null;
  function assignShades(items) {
    const list = (items || []).map((it, n) => ({
      id: String(it.id || ''), x: +it.x || 0, y: +it.y || 0, w: +it.w || 0, h: +it.h || 0, n: n,
    }));
    list.sort((p, q) => (p.y - q.y) || (p.x - q.x) || (p.n - q.n));
    const assigned = new Array(list.length);
    for (let i = 0; i < list.length; i++) {
      let k = shadeIndex(list[i].id);
      const neighbors = [];
      for (let j = 0; j < i; j++) if (sharesEdge(list[i], list[j])) neighbors.push(assigned[j]);
      let guard = 0;
      while (neighbors.indexOf(k) >= 0 && guard < SHADES.length) { k = (k + 1) % SHADES.length; guard++; }
      assigned[i] = k;
    }
    const out = {};
    for (let i = 0; i < list.length; i++) {
      const k = assigned[i];
      out[list[i].id] = { a: SHADES[k][0], b: SHADES[k][1], i: k };
    }
    return out;
  }
  function planShades(items) {
    shadePlan = assignShades(items);
    return shadePlan;
  }
  function shadeFor(id) {
    const key = String(id || '');
    if (shadePlan && shadePlan[key]) return shadePlan[key];
    const i = shadeIndex(key);
    return { a: SHADES[i][0], b: SHADES[i][1], i: i };
  }
  function paintShade(el, id) {
    const s = shadeFor(id);
    if (!el || !el.style || !el.style.setProperty) return s;
    el.style.setProperty('--tile-shade', s.a);
    el.style.setProperty('--tile-shade-2', s.b);
    return s;
  }

  function avatarUrl(st, peer) {
    const cands = [];
    st = st || {};
    if (typeof st.avatar === 'string') cands.push(st.avatar);
    if (typeof st.av === 'string') cands.push(st.av);
    if (typeof st.avatarUrl === 'string') cands.push(st.avatarUrl);
    if (peer) {
      if (typeof peer.avatarUrl === 'string') cands.push(peer.avatarUrl);
      if (typeof peer.avatarSrc === 'string') cands.push(peer.avatarSrc);
    }
    try {
      const A = GifOS.avatar;
      if (A && typeof A.urlFor === 'function') {
        const u = A.urlFor(peer && (peer.id || peer.peerId));
        if (typeof u === 'string') cands.push(u);
      }
    } catch (e) {}
    for (let i = 0; i < cands.length; i++) if (cands[i]) return cands[i];
    return '';
  }

  function paintAvatar(el, url, initials) {
    if (!el) return;
    const grad = 'linear-gradient(160deg, var(--tile-shade, #3b4d78), var(--tile-shade-2, #243252))';
    if (initials) el.dataset.initials = initials;
    if (url) {
      const safe = String(url).replace(/["\\\n\r]/g, '');
      // The photo sits in the middle. The shade stays visible around it.
      el.style.backgroundImage = 'url("' + safe + '"), ' + grad;
      el.style.backgroundSize = 'auto 46%, cover';
      el.style.backgroundRepeat = 'no-repeat, no-repeat';
      el.style.backgroundPosition = 'center, center';
      el.classList.add('has-img');
      // A meeting tile keeps its <img> and the letter under it. Clearing the
      // element here detached that image on the next paint.
      const img = el.querySelector && el.querySelector('img.avatar-img');
      if (img) {
        const letter = initials || (el.dataset && el.dataset.initials) || '';
        if (letter) {
          let text = null;
          for (let i = 0; i < el.childNodes.length; i++) if (el.childNodes[i].nodeType === 3) text = el.childNodes[i];
          if (!text) el.insertBefore(document.createTextNode(letter), el.firstChild);
          else if (text.nodeValue !== letter) text.nodeValue = letter;
        }
        return;
      }
      el.textContent = '';
    } else {
      el.style.backgroundImage = grad;
      el.style.backgroundSize = 'cover';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'center';
      el.classList.remove('has-img');
      const ch = initials || (el.dataset && el.dataset.initials) || '';
      if (ch) el.textContent = ch;
    }
  }

  function byStad(host, id) {
    if (!host) return null;
    for (let i = 0; i < host.children.length; i++) {
      if (host.children[i].dataset && host.children[i].dataset.stad === id) return host.children[i];
    }
    return null;
  }

  function makeFace(id, name, initials) {
    const el = document.createElement('div');
    el.className = 'stadface';
    el.dataset.stad = id;
    const v = document.createElement('video');
    v.muted = true; v.autoplay = true; v.playsInline = true;
    v.setAttribute('playsinline', '');
    const av = document.createElement('div');
    av.className = 'avatar';
    av.textContent = initials || '';
    const lb = document.createElement('span');
    lb.className = 'name';
    lb.textContent = name || '';
    el.appendChild(v); el.appendChild(av); el.appendChild(lb);
    return el;
  }

  function syncFaces(feed, faces) {
    let host = feed.querySelector('#stadfaces');
    if (!host) {
      host = document.createElement('div');
      host.id = 'stadfaces';
      feed.appendChild(host);
    }
    const keep = {};
    const els = [];
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      const id = String(f.id);
      keep[id] = true;
      let el = byStad(host, id);
      if (!el) { el = makeFace(id, f.name, f.initials); host.appendChild(el); }
      else {
        const lb = el.querySelector('.name');
        if (lb && f.name && lb.textContent !== f.name) lb.textContent = f.name;
        const av = el.querySelector('.avatar');
        if (av && !av.classList.contains('has-img') && f.initials && av.textContent !== f.initials) av.textContent = f.initials;
      }
      el.dataset.pzkey = 'stad:' + id;
      el.style.display = '';
      els.push(el);
    }
    for (let i = host.children.length - 1; i >= 0; i--) {
      const ch = host.children[i];
      if (!keep[ch.dataset.stad]) ch.remove();
    }
    return els;
  }

  function ensureCrowd(feed) {
    let el = feed.querySelector('#stadcrowd');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'stadcrowd';
    el.className = 'stadface crowd';
    el.dataset.pzkey = 'stad:crowd';
    const v = document.createElement('video');
    v.muted = true; v.autoplay = true; v.playsInline = true;
    v.setAttribute('playsinline', '');
    const lb = document.createElement('span');
    lb.className = 'name';
    el.appendChild(v); el.appendChild(lb);
    feed.appendChild(el);
    return el;
  }

  function placeBand(feed, band) {
    const doc = feed.ownerDocument || document;
    let el = doc.getElementById('stadband');
    if (!band) { if (el) el.remove(); return; }
    if (!el) {
      el = doc.createElement('div');
      el.id = 'stadband';
      el.className = 'stad-band';
      feed.appendChild(el);
    }
    el.textContent = band.text || '';
    if (band.label) el.setAttribute('aria-label', band.label); else el.removeAttribute('aria-label');
    el.style.position = 'absolute';
    el.style.left = band.x + 'px';
    el.style.top = band.y + 'px';
    // An end band hangs from its point (the box's bottom right) instead.
    el.style.transform = band.end ? 'translate(-100%, -100%)' : '';
    el.style.zIndex = '4';
  }

  let stadSeen = { key: '', at: 0 };
  let stadTimer = 0;

  // The call's buttons tucked away: keep the rows and columns laid out for
  // the band above them and stretch the rows into the taller box, so no face
  // jumps to a new place each time the buttons go or come back. Rows grow
  // only as far as a legal tile shape, and shrink (never under the phone's
  // smallest side) when that lets rows that were scrolled to fit on screen.
  function holdRows(lay, box, byId, phone) {
    const Pack = GifOS.meetPack;
    const from = lay.box;
    if (!Pack || !from || !lay.rects.length) return lay;
    const contentH = lay.contentH || from.h;
    const minSide = phone ? 96 : 80;
    let k = box.h / Math.max(1, contentH);
    let floor = 0;
    for (let i = 0; i < lay.rects.length; i++) {
      const r = lay.rects[i];
      if (!(r.h > 0)) continue;
      k = Math.min(k, r.w / r.h / Pack.ASPECT_MIN);
      floor = Math.max(floor, Math.min(r.h, minSide) / r.h);
    }
    k = Math.max(k, floor);
    const rects = lay.rects.map((r) => {
      const h = r.h * k;
      const t = byId[r.id];
      const a = t && t.aspect > 0 ? t.aspect : 16 / 9;
      const crop = Pack.cropFor(a, r.w / h);
      return Object.assign({}, r, { y: box.y + (r.y - from.y) * k, h: h, fit: crop && crop.contain ? 'contain' : 'cover' });
    });
    return Object.assign({}, lay, { rects: rects, box: box, contentH: contentH * k });
  }

  function applyCrop(video, crop) {
    if (!video) return;
    if (!crop) {
      video.style.position = '';
      video.style.left = '';
      video.style.top = '';
      video.style.width = '';
      video.style.height = '';
      return;
    }
    video.style.position = 'absolute';
    video.style.left = crop.x + 'px';
    video.style.top = crop.y + 'px';
    video.style.width = crop.w + 'px';
    video.style.height = crop.h + 'px';
    video.style.maxWidth = 'none';
    video.style.maxHeight = 'none';
    video.style.objectFit = 'fill';
  }

  function playStream(video, stream) {
    if (!video || !stream) return;
    try { video.muted = true; } catch (e) {}
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      const pr = video.play();
      if (pr && pr.catch) pr.catch(function () {});
    }
  }

  // 0.9.23b: Stage (true aspect), Row and Stadium (squares). meet-zones.js
  // does the geometry; this keeps the shape the rest of apply() reads.
  function zonesLayout(MZ, tiles, box, opts) {
    const stage = [], row = [], stad = [];
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (t.tier === 'stad') stad.push(t.id);
      else if (t.stage || t.share) stage.push({ id: t.id, aspect: t.aspect > 0 ? t.aspect : 16 / 9, fill: !!t.fill });
      else row.push(t.id);
    }
    const z = MZ.layout({ box: box, stage: stage, row: row, stad: stad, phone: !!opts.phone,
      gallery: opts.gallery === 'scroll' ? 'scroll' : 'fit', gap: opts.phone ? 4 : MZ.GAP, floor: +opts.floor || 0 });
    let band = null;
    if (z.tooSmall) band = { text: 'faces tiny \u00b7 Scroll is in \u25a6', x: box.x + 6, y: box.y + 6 };
    return { mode: stage.length ? 'stage' : 'gallery', gallery: z.gallery, rects: z.rects, crowd: false, band: band,
      box: box, regions: z.regions, stage: z.regions.stage, contentH: z.contentH, tooSmall: !!z.tooSmall,
      self: { arrangement: 'tile' }, zones: true, side: z.side, stadSide: z.stadSide };
  }

  // opts: { feed, tiles, faces, video, cols, orderKey, holdMs, vw, vh, phone, pill, mode, now, onSettle }
  // tiles: [{ id, el, tier, me, stage, stageOrd, hand, handOrd, speaker, pz }]
  // faces: [{ id, name, initials }] in stadium order
  function apply(opts) {
    opts = opts || {};
    const ML = GifOS.meetLayout;
    const MM = GifOS.meshMedia;
    const feed = opts.feed;
    if (!ML || !feed) return null;
    const faces = opts.faces || [];
    const faceEls = faces.length ? syncFaces(feed, faces) : syncFaces(feed, []);
    const tiles = (opts.tiles || []).slice();
    for (let i = 0; i < faceEls.length; i++) {
      tiles.push({ id: 'stad:' + faces[i].id, tier: 'stad', el: faceEls[i], shade: faces[i].shade || '' });
    }
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (t.el) {
        const v = t.el.querySelector && t.el.querySelector('video');
        if (v && v.videoWidth > 0 && v.videoHeight > 0) t.aspect = v.videoWidth / v.videoHeight;
        if (t.pz) t.el.dataset.pzkey = t.pz;
        t.el.dataset.tier = t.tier || 'row';
      }
    }
    const box = ML.viewBox(opts.vw || 1, opts.vh || 1, {
      phone: !!opts.phone, pill: !!opts.pill, bottom: Math.max(0, +opts.bottom || 0),
      top: opts.top > 0 ? opts.top : undefined,
    });
    // opts.holdBottom: where the tucked-away buttons stood (phone gallery).
    // Fit and Scroll both size faces from the band, so both hold it: a tap
    // that wakes the buttons never reshapes a face.
    const MZ = GifOS.meetZones;
    const hold = !!opts.phone && (opts.mode || 'gallery') === 'gallery' && (MZ || opts.gallery !== 'scroll') &&
      +opts.holdBottom > Math.max(0, +opts.bottom || 0);
    const byId = {};
    for (let i = 0; i < tiles.length; i++) byId[tiles[i].id] = tiles[i];
    let lay = MZ ? zonesLayout(MZ, tiles, hold ? ML.viewBox(opts.vw || 1, opts.vh || 1, {
      phone: true, pill: !!opts.pill, bottom: +opts.holdBottom,
      top: opts.top > 0 ? opts.top : undefined,
    }) : box, opts) : ML.layoutFor({
      mode: opts.mode || 'gallery',
      tiles: tiles,
      box: hold ? ML.viewBox(opts.vw || 1, opts.vh || 1, {
        phone: true, pill: !!opts.pill, bottom: +opts.holdBottom,
        top: opts.top > 0 ? opts.top : undefined,
      }) : box,
      phone: !!opts.phone,
      swapSelf: !!opts.swapSelf,
      self: opts.self != null ? opts.self : (opts.selfView || 'tile'),
      gallery: opts.gallery === 'scroll' ? 'scroll' : 'fit',
    });
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].me || tiles[i].id === 'me') markSelf(tiles[i].el, lay.self);
    }
    if (hold && !lay.crowd && !MZ) lay = holdRows(lay, box, byId, true);
    if (hold && MZ && lay.zones) {
      // Faces keep the places they had with the buttons up; whether they
      // scroll is judged against what is visible now.
      const hb = lay.box;
      lay = Object.assign({}, lay, { box: box, contentH: Math.max(box.h, hb.y + lay.contentH - box.y) });
    }
    const used = [];
    let crowdEl = feed.querySelector('#stadcrowd');
    if (lay.crowd) {
      crowdEl = ensureCrowd(feed);
      for (let i = 0; i < faceEls.length; i++) faceEls[i].style.display = 'none';
      for (let i = 0; i < lay.rects.length; i++) if (lay.rects[i].id === 'crowd') placeEl(crowdEl, lay.rects[i]);
      used.push(crowdEl);
      const cv = crowdEl.querySelector('video');
      const lb = crowdEl.querySelector('.name');
      if (lb) lb.textContent = 'Stadium · ' + faces.length;
      if (opts.video && opts.video.srcObject) playStream(cv, opts.video.srcObject);
      if (cv) applyCrop(cv, null);
      if (cv) { cv.style.width = '100%'; cv.style.height = '100%'; cv.style.objectFit = 'cover'; cv.style.position = 'absolute'; cv.style.left = '0'; cv.style.top = '0'; }
    } else if (crowdEl) {
      crowdEl.remove();
      crowdEl = null;
    }
    // Desktop leaves an 8px gutter between faces (4px off each side of the
    // packed cell), so tiles keep equal sizes. A phone stays edge to edge.
    const half = (opts.phone || lay.zones) ? 0 : GUTTER / 2;
    for (let i = 0; i < lay.rects.length; i++) {
      const r = lay.rects[i];
      if (r.id === 'crowd') continue;
      const t = byId[r.id];
      if (!t || !t.el) continue;
      placeEl(t.el, half ? { x: r.x + half, y: r.y + half, w: r.w - 2 * half, h: r.h - 2 * half } : r);
      if (half) t.el.dataset.gutter = '1'; else delete t.el.dataset.gutter;
      t.el.dataset.fit = r.fit || 'cover';
      used.push(t.el);
    }
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].el && used.indexOf(tiles[i].el) < 0) parkEl(tiles[i].el);
    }
    // Absolute tiles do not grow scrollHeight. A 1px spacer does, so Scroll
    // can move through the stadium without a pager.
    let spacer = feed.querySelector('#comfyspacer');
    const contentH = lay.contentH || (lay.box ? lay.box.h : 0);
    const need = (lay.box ? lay.box.y : 0) + contentH;
    const overflows = !!(lay.box && contentH > lay.box.h + 1);
    const tail = overflows ? Math.max(0, (+opts.vh || 0) - lay.box.y - lay.box.h) : 0;
    // A gallery that scrolls ends at the box, or below its first row when
    // that row is taller than the band (it shows whole, over the empty part
    // of the Record row, 3d2dd16). Rows that start past it are scrolled to, never
    // painted under the call's buttons: a sideways SE with the buttons up
    // has a 100px band for seven people.
    let clipY = 0, past = 0;
    if (overflows) {
      clipY = lay.box.y + lay.box.h;
      for (let i = 0; i < lay.rects.length; i++) {
        const r = lay.rects[i];
        if (r.y <= lay.box.y + 1) clipY = Math.max(clipY, r.y + r.h);
      }
      // A face cut by the fold is below it too: the hint counts every face not whole.
      for (let i = 0; i < lay.rects.length; i++) if (lay.rects[i].y + lay.rects[i].h > clipY + 1) past++;
    }
    if (feed.style && feed.style.setProperty) feed.style.setProperty('--comfy-clip', overflows ? Math.max(0, (+opts.vh || 0) - clipY) + 'px' : '0px');
    if (feed.classList) { feed.classList.toggle('can-scroll', overflows); feed.classList.toggle('comfy-scroll', overflows); }
    let band = lay.band;
    // Short, in the bottom right corner, where a tile has no name or button.
    if (past && !band) band = { text: '\u2193' + past, label: past + ' more below, scroll down', x: lay.box.x + lay.box.w - 4, y: clipY - 4, end: true };
    placeBand(feed, band);
    // The hint hangs in the last face's bottom right corner, where a wide
    // name ("Lobby iPad" on a 109px tile) ran under it. That tile's name
    // keeps clear of it and wraps instead.
    let hintEl = null, hintW = 0;
    if (past && band && band.end) {
      const hb = (feed.ownerDocument || document).getElementById('stadband');
      hintW = hb ? hb.offsetWidth : 0;
      let best = null;
      for (let i = 0; i < lay.rects.length; i++) {
        const r = lay.rects[i];
        if (r.y >= clipY - 1 || r.y + r.h < clipY - 1) continue;
        if (!best || r.x + r.w > best.x + best.w) best = r;
      }
      const t = best && byId[best.id];
      if (t && t.el && best.x + best.w >= band.x - 1) hintEl = t.el;
    }
    for (let i = 0; i < used.length; i++) {
      const el = used[i];
      if (!el || !el.classList) continue;
      el.classList.toggle('by-hint', el === hintEl);
      if (el === hintEl && el.style && el.style.setProperty) el.style.setProperty('--hintw', hintW + 'px');
    }
    if (overflows) {
      if (!spacer) {
        spacer = (feed.ownerDocument || document).createElement('div');
        spacer.id = 'comfyspacer';
        feed.appendChild(spacer);
      }
      spacer.style.position = 'absolute';
      spacer.style.left = '0';
      spacer.style.top = '0';
      spacer.style.width = '1px';
      spacer.style.height = need + 'px';
      spacer.style.pointerEvents = 'none';
    } else if (spacer && spacer.remove) spacer.remove();
    const shadeItems = [];
    for (let i = 0; i < lay.rects.length; i++) {
      const r = lay.rects[i];
      if (!r || r.id === 'crowd') continue;
      const t = byId[r.id];
      if (!t) continue;
      // t.shade: the page's stable key for this person (falls back to the id).
      let sid = String(t.id || r.id);
      if (t.me || sid === 'me') sid = opts.selfId || 'me';
      else if (t.shade) sid = String(t.shade);
      else if (sid.indexOf('stad:') === 0) sid = sid.slice(5);
      shadeItems.push({ id: sid, x: r.x, y: r.y, w: r.w, h: r.h, el: t.el });
    }
    planShades(shadeItems);
    for (let i = 0; i < shadeItems.length; i++) {
      if (shadeItems[i].el) paintShade(shadeItems[i].el, shadeItems[i].id);
    }

    const video = opts.video || null;
    const vw = video && video.videoWidth || 0;
    const vh = video && video.videoHeight || 0;
    const n = faces.length;
    const cols = opts.cols | 0;
    const key = n + 'x' + cols + '@' + vw + 'x' + vh + '|' + (opts.orderKey || '');
    const now = opts.now || Date.now();
    if (key !== stadSeen.key) stadSeen = { key: key, at: now };
    const holdMs = opts.holdMs > 0 ? opts.holdMs : 2500;
    const holding = n > 0 && !lay.crowd && (now - stadSeen.at < holdMs);
    const ready = n > 0 && !lay.crowd && !holding && vw > 0 && vh > 0 && cols > 0 && MM && typeof MM.cellCrop === 'function';
    let slices = null;
    if (ready) slices = ML.stadiumSlices(n, vw, vh, 100, MM.stadiumGrid, MM.cellCrop);
    const stream = video && video.srcObject;
    for (let j = 0; j < faceEls.length; j++) {
      const el = faceEls[j];
      if (lay.crowd) break;
      const v = el.querySelector('video');
      const av = el.querySelector('.avatar');
      const cell = slices && slices.cells[j];
      if (stream && !faces[j].off) playStream(v, stream);
      // Camera-off (and not-yet-heard) faces stay on initials. A black
      // cell from the composite would hide the name.
      if (cell && v && !faces[j].off) {
        let bw = el.offsetWidth || 0;
        for (let k = 0; k < lay.rects.length; k++) {
          if (lay.rects[k].id === 'stad:' + faces[j].id) { bw = Math.max(lay.rects[k].w, lay.rects[k].h); break; }
        }
        const sc = (bw > 0 ? bw : 100) / 100;
        applyCrop(v, { x: cell.x * sc, y: cell.y * sc, w: cell.w * sc, h: cell.h * sc });
        v.style.visibility = 'visible';
        el.classList.remove('cam-off');
        if (av) av.style.display = 'none';
      } else if (v) {
        v.style.visibility = 'hidden';
        applyCrop(v, null);
        el.classList.add('cam-off');
        paintShade(el, faces[j].shade || faces[j].id);
        if (av) {
          av.style.display = 'flex';
          paintShade(av, faces[j].shade || faces[j].id);
          paintAvatar(av, faces[j].avatar || '', faces[j].initials);
        }
      }
    }
    if (holding && typeof opts.onSettle === 'function') {
      const wait = Math.max(16, holdMs - (now - stadSeen.at) + 30);
      if (stadTimer) clearTimeout(stadTimer);
      stadTimer = setTimeout(function () { stadTimer = 0; try { opts.onSettle(); } catch (e) {} }, wait);
    }
    const sh = feed.scrollHeight, ch = feed.clientHeight;
    return {
      mode: lay.mode,
      rects: lay.rects,
      box: box,
      crowd: !!lay.crowd,
      holding: holding,
      tier: lay.tier,
      scroll: { sh: sh, ch: ch },
    };
  }

  function metrics(bar) {
    return {
      bar: { w: bar.offsetWidth, h: bar.offsetHeight },
      view: { w: root.innerWidth || 0, h: root.innerHeight || 0 },
    };
  }

  function writeBar(bar, pos) {
    bar.style.left = pos.x + 'px';
    bar.style.top = pos.y + 'px';
    bar.style.bottom = 'auto';
    bar.style.right = 'auto';
    bar.style.transform = 'none';
    bar.dataset.barx = String(Math.round(pos.x));
    bar.dataset.bary = String(Math.round(pos.y));
    bar.dataset.barfree = '1';
  }

  function installBar(opts) {
    opts = opts || {};
    const bar = opts.bar, grip = opts.grip, store = opts.store;
    const ML = GifOS.meetLayout;
    if (!bar || !grip || !ML) return null;
    const phoneNow = function () { return opts.phone ? !!opts.phone() : (root.innerWidth < 600); };
    let drag = null, lastTap = 0;
    function applyPos(pos, persist) {
      const m = metrics(bar);
      const c = ML.clampBar(pos, m.bar, m.view);
      writeBar(bar, c);
      if (persist) ML.saveBar(store, phoneNow(), c);
      return c;
    }
    function restore() {
      const saved = ML.loadBar(store, phoneNow());
      if (!saved) return null;
      return applyPos(saved, false);
    }
    function reset() {
      const m = metrics(bar);
      return applyPos(ML.defaultBar(m.bar, m.view, phoneNow()), true);
    }
    grip.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      try { grip.setPointerCapture(e.pointerId); } catch (err) {}
      const r = bar.getBoundingClientRect();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, bx: r.left, by: r.top, moved: false };
    });
    grip.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      applyPos({ x: drag.bx + dx, y: drag.by + dy }, false);
    });
    function endDrag(e) {
      if (!drag || (e && e.pointerId != null && e.pointerId !== drag.id)) return;
      const moved = drag.moved;
      drag = null;
      const r = bar.getBoundingClientRect();
      if (!moved) {
        const now = Date.now();
        if (now - lastTap < 400 && now - lastTap > 40) { lastTap = 0; reset(); return; }
        lastTap = now;
        return;
      }
      applyPos({ x: r.left, y: r.top }, true);
    }
    grip.addEventListener('pointerup', endDrag);
    grip.addEventListener('pointercancel', endDrag);
    grip.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const r = bar.getBoundingClientRect();
      const m = metrics(bar);
      applyPos(ML.nudgeBar({ x: r.left, y: r.top }, e.key, 16, m.bar, m.view), true);
    });
    grip.addEventListener('dblclick', function (e) {
      e.preventDefault();
      reset();
    });
    root.addEventListener('resize', function () {
      const saved = ML.loadBar(store, phoneNow());
      if (saved) applyPos(saved, false);
      else if (bar.dataset.barfree === '1') {
        const r = bar.getBoundingClientRect();
        applyPos({ x: r.left, y: r.top }, false);
      }
    });
    restore();
    return { apply: applyPos, restore: restore, reset: reset };
  }

  function pressSeg(el, on) {
    if (!el) return;
    el.classList.toggle('sel', !!on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // Size, corner, edge, hide, and "show me on stage". Float tiles drag.
  function installSelf(opts) {
    opts = opts || {};
    const ML = GifOS.meetLayout;
    if (!ML || typeof ML.normalizeSelf !== 'function') return null;
    const store = opts.store || root.localStorage;
    const phoneNow = opts.phone || function () { return (root.innerWidth || 0) < 600; };
    let spec = ML.normalizeSelf(opts.spec || ML.loadSelf(store, phoneNow()));
    const doc = root.document;
    function paint() {
      if (!doc || !doc.querySelectorAll) return;
      const arrs = doc.querySelectorAll('[data-self-arr]');
      for (let i = 0; i < arrs.length; i++) pressSeg(arrs[i], arrs[i].getAttribute('data-self-arr') === spec.arrangement);
      const sizes = doc.querySelectorAll('[data-self-size]');
      for (let i = 0; i < sizes.length; i++) pressSeg(sizes[i], sizes[i].getAttribute('data-self-size') === spec.size);
      const anchors = doc.querySelectorAll('[data-self-anchor]');
      for (let i = 0; i < anchors.length; i++) pressSeg(anchors[i], spec.arrangement === 'float' && spec.anchor === anchors[i].getAttribute('data-self-anchor'));
      const edgeNow = ML.selfEdge(spec, phoneNow(), { w: root.innerWidth || 0, h: root.innerHeight || 0 });
      const edges = doc.querySelectorAll('[data-self-edge]');
      for (let i = 0; i < edges.length; i++) {
        const name = edges[i].getAttribute('data-self-edge');
        pressSeg(edges[i], spec.arrangement === 'strip' && (spec.edge === name || (spec.edge === 'auto' && edgeNow === name)));
      }
      const stageBtn = doc.getElementById('selfstage');
      pressSeg(stageBtn, !!spec.onStage);
      const sizeRow = doc.getElementById('selfsize');
      const cornerRow = doc.getElementById('selfcorner');
      const edgeRow = doc.getElementById('selfedge');
      const showSize = spec.arrangement === 'float' || spec.arrangement === 'strip';
      if (sizeRow) sizeRow.hidden = !showSize;
      if (cornerRow) cornerRow.hidden = spec.arrangement !== 'float';
      if (edgeRow) edgeRow.hidden = spec.arrangement !== 'strip';
      const cornerLbl = doc.getElementById('selfcorner-lbl');
      if (cornerLbl) cornerLbl.textContent = spec.anchor === 'free' ? 'Dragged' : 'Corner';
      const edgeLbl = doc.getElementById('selfedge-lbl');
      if (edgeLbl) edgeLbl.textContent = spec.edge === 'auto' ? ('Place · ' + edgeNow) : 'Place';
    }
    function publish(next) {
      spec = ML.normalizeSelf(next);
      root.__meetSelf = spec;
      root.__meetSwapSelf = !!spec.onStage;
      ML.saveSelf(store, phoneNow(), spec);
      paint();
      const relayout = opts.relayout || root.__meetRelayout;
      if (typeof relayout === 'function') { try { relayout(); } catch (e) {} }
    }
    root.__meetSelf = spec;
    root.__meetSwapSelf = !!spec.onStage;
    if (doc && doc.addEventListener) {
      doc.addEventListener('click', function (e) {
        const t = e.target && e.target.closest ? e.target : null;
        if (!t || !t.closest) return;
        const arr = t.closest('[data-self-arr]');
        if (arr) { publish(Object.assign({}, spec, { arrangement: arr.getAttribute('data-self-arr') })); return; }
        const size = t.closest('[data-self-size]');
        if (size) { publish(Object.assign({}, spec, { size: size.getAttribute('data-self-size') })); return; }
        const anchor = t.closest('[data-self-anchor]');
        if (anchor) { publish(Object.assign({}, spec, { arrangement: 'float', anchor: anchor.getAttribute('data-self-anchor'), x: null, y: null })); return; }
        const edge = t.closest('[data-self-edge]');
        if (edge) { publish(Object.assign({}, spec, { arrangement: 'strip', edge: edge.getAttribute('data-self-edge') })); return; }
        if (t.closest('#selfstage')) publish(Object.assign({}, spec, { onStage: !spec.onStage }));
      });
      let drag = null;
      doc.addEventListener('pointerdown', function (e) {
        if (!e.target || !e.target.closest) return;
        const tile = e.target.closest('.tile.me');
        if (!tile || tile.dataset.self !== 'float') return;
        if (e.target.closest('button, a, input, .modbar')) return;
        if (e.button != null && e.button !== 0) return;
        const r = tile.getBoundingClientRect();
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top, tile: tile, moved: false };
        try { tile.setPointerCapture(e.pointerId); } catch (err) {}
      });
      doc.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (!drag.moved) return;
        drag.tile.style.left = (drag.left + dx) + 'px';
        drag.tile.style.top = (drag.top + dy) + 'px';
      });
      function endDrag(e) {
        if (!drag || (e && e.pointerId != null && e.pointerId !== drag.id)) return;
        const moved = drag.moved;
        const tile = drag.tile;
        drag = null;
        if (!moved) return;
        const r = tile.getBoundingClientRect();
        publish(Object.assign({}, spec, { arrangement: 'float', anchor: 'free', x: r.left, y: r.top }));
      }
      doc.addEventListener('pointerup', endDrag);
      doc.addEventListener('pointercancel', endDrag);
      doc.addEventListener('dblclick', function (e) {
        if (!e.target || !e.target.closest) return;
        const tile = e.target.closest('.tile.me');
        if (!tile || tile.dataset.self !== 'float') return;
        e.preventDefault();
        publish(Object.assign({}, spec, { arrangement: 'float', anchor: 'br', x: null, y: null }));
      });
      doc.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const tile = doc.querySelector('.tile.me[data-self="float"]');
        if (!tile || doc.activeElement !== tile) return;
        e.preventDefault();
        const r = tile.getBoundingClientRect();
        const aspect = r.height > 0 ? r.width / r.height : (phoneNow() ? 3 / 4 : 16 / 9);
        const box = ML.viewBox(root.innerWidth || 1, root.innerHeight || 1, { phone: phoneNow() });
        publish(ML.nudgeSelf(spec, e.key, 16, box, phoneNow(), aspect));
      });
    }
    paint();
    return { get: function () { return spec; }, set: publish };
  }

  const api = {
    comfyAllowed: comfyAllowed,
    placeEl: placeEl,
    parkEl: parkEl,
    markSelf: markSelf,
    clearEl: clearEl,
    clearRoot: clearRoot,
    shadeFor: shadeFor,
    shadeIndex: shadeIndex,
    assignShades: assignShades,
    planShades: planShades,
    paintShade: paintShade,
    avatarUrl: avatarUrl,
    paintAvatar: paintAvatar,
    apply: apply,
    installBar: installBar,
    installSelf: installSelf,
    applyCrop: applyCrop,
  };
  GifOS.meetViews = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document !== 'undefined') {
    const bar = document.querySelector('.bar');
    const grip = document.getElementById('bargrip');
    if (bar && grip) {
      try { installBar({ bar: bar, grip: grip, store: root.localStorage }); } catch (e) {}
    }
    try { installSelf({ store: root.localStorage }); } catch (e) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
