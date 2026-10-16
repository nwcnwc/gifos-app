/*
 * meet-views.js — place comfy tiles, slice the stadium, drag the control bar.
 * Geometry comes from meet-layout.js. This file touches the DOM and nothing
 * about peers: the page hands it elements and numbers.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};

  const BLOCK = ['screen-on', 'has-app', 'broadcast', 'app-room', 'solo-app'];

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
    el.dataset.comfy = '1';
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
    if (el.dataset) delete el.dataset.comfy;
  }

  function clearRoot(feed) {
    if (!feed || !feed.querySelectorAll) return;
    const placed = feed.querySelectorAll('[data-comfy]');
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
    el.style.position = 'absolute';
    el.style.left = band.x + 'px';
    el.style.top = band.y + 'px';
    el.style.zIndex = '4';
  }

  let stadSeen = { key: '', at: 0 };
  let stadTimer = 0;

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
      tiles.push({ id: 'stad:' + faces[i].id, tier: 'stad', el: faceEls[i] });
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
    const box = ML.viewBox(opts.vw || 1, opts.vh || 1, { phone: !!opts.phone, pill: !!opts.pill });
    const lay = ML.layoutFor({
      mode: opts.mode || 'gallery',
      tiles: tiles,
      box: box,
      phone: !!opts.phone,
      swapSelf: !!opts.swapSelf,
      gallery: opts.gallery === 'scroll' ? 'scroll' : 'fit',
    });
    const byId = {};
    for (let i = 0; i < tiles.length; i++) byId[tiles[i].id] = tiles[i];
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
    for (let i = 0; i < lay.rects.length; i++) {
      const r = lay.rects[i];
      if (r.id === 'crowd') continue;
      const t = byId[r.id];
      if (!t || !t.el) continue;
      placeEl(t.el, r);
      t.el.dataset.fit = r.fit || 'cover';
      used.push(t.el);
    }
    placeBand(feed, lay.band);
    // Absolute tiles do not grow scrollHeight. A 1px spacer does, so Scroll
    // can move through the stadium without a pager.
    let spacer = feed.querySelector('#comfyspacer');
    const need = (lay.box ? lay.box.y : 0) + (lay.contentH || 0);
    if (lay.contentH && lay.box && need > lay.box.y + lay.box.h + 1) {
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
      let sid = String(t.id || r.id);
      if (t.me || sid === 'me') sid = opts.selfId || 'me';
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
        paintShade(el, faces[j].id);
        if (av) {
          av.style.display = 'flex';
          paintShade(av, faces[j].id);
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

  const api = {
    comfyAllowed: comfyAllowed,
    placeEl: placeEl,
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
  }
})(typeof window !== 'undefined' ? window : globalThis);
