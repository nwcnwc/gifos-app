/*
 * meet-views.js — place comfy tiles, show the stadium whole, drag the bar.
 * Geometry comes from meet-zones.js and meet-layout.js. This file touches the DOM and nothing
 * about peers: the page hands it elements and numbers.
 *
 * The row is the direct feeds the page passes in. The stadium is one
 * composite video in one box. A stage camera's cell is left out of this
 * drawing only, when the page names that cell. Nothing is sent.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};
  const TM = GifOS.timings || require('./timings.js');   // every wait and timeout: js/timings.js, loaded before this file (required where there is no page)

  const GUTTER = 8;
  // A join storm keeps changing the composite's frame. The settle hold
  // waits for that frame, but never longer than this in a row. The one
  // stadium video stays up the whole time: there is no initials seat.
  const HOLD_MAX_MS = TM.HOLD_MAX_MS;
  // One resize of the composite fires once, not once per pass.
  const RZ_DEBOUNCE_MS = TM.RZ_DEBOUNCE_MS;
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

  // The header is a fixed band above the feed. Upright phone rows are the
  // status line, then Fit with Invite, Help and Full screen, ending at
  // 102px. A sideways phone shares one row that ends at 58px. A desktop
  // window shares one row too: the chip (48px from 14), Fit, the hands
  // line and the three pills all end by 62px, so the row starts at 64.
  // A window the CSS dresses as a phone (600px or narrower, or 500px or
  // shorter) keeps Fit on a second row, which ends at 102px. --gtop is
  // the notch or the update bar. The band does not follow a wake, so
  // hiding the header does not resize the tiles.
  function headerBand(doc, vw, vh, phone) {
    // The browser's float of a full-screen phone is the face, edge to edge.
    // The fixed 58px sideways band on a ~90px window was a black field with
    // a chip in the lower half.
    const body = doc && doc.body;
    if (body && body.classList && body.classList.contains('away-full')) return 0;
    let gtop = 0;
    try {
      const n = parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--gtop'));
      if (n > 0) gtop = n;
    } catch (e) {}
    if (phone) {
      const land = vh < 500 && vw > vh;
      return Math.round((land ? 58 : 102) + gtop);
    }
    let oneRow = vw > 600 && vh > 500;
    try {
      const view = doc.defaultView;
      if (view && view.matchMedia) oneRow = view.matchMedia('(min-width: 601px) and (min-height: 501px)').matches;
    } catch (e) {}
    return Math.round((oneRow ? 64 : 102) + gtop);
  }

  // The feed starts below that band, so a top-row tile's Open (still the
  // tile's upper-right corner) is not under the room line, Fit, Invite,
  // Help or Full screen, and a scroll cannot slide a face into the band.
  // A shared screen or an app keeps the full-bleed feed those layouts
  // already size.
  function reserveHeader(feed, opts) {
    if (!feed || !feed.style) return 0;
    const doc = feed.ownerDocument || document;
    const body = doc.body;
    const skip = !opts || (body && body.classList && (body.classList.contains('screen-on') || body.classList.contains('has-app')));
    if (skip) { feed.style.top = ''; return 0; }
    const view = doc.defaultView || root;
    const vw = +opts.vw || (view && view.innerWidth) || 0;
    const vh = +opts.vh || (view && view.innerHeight) || 0;
    const header = headerBand(doc, vw, vh, !!opts.phone);
    feed.style.top = header + 'px';
    return header;
  }

  // Last top of Live, Record, or the chat preview while they are showing.
  // A tuck hides them and slides the dock, which moves that top. Holding
  // the shown top keeps the faces still (the header band does the same).
  let callChromeTop = 0;
  let callChromeEdge = 0;
  // The edge without and with the lip onto the dock. apply() decides the lip
  // per layout, so a tucked page that lays out again (you step on the stage)
  // picks from the held pair; holding one edge kept the last layout's lip
  // and the first wake took it back (wake-keeps-tiles, you on stage).
  let callChromeEdge0 = 0;
  let callChromeLipEdge = 0;
  // The dock and the Live/Record buttons where they rest, for the lip test.
  // Tucked, they are slid away, so the tucked page reads the held boxes.
  let callChromeMarks = null;
  // The held lines as distances up from the bottom, per screen width. A
  // tucked page that changes size (back from a float, the URL bar going)
  // keeps the reserve the dock had at that width, so the first wake finds
  // the faces already where the shown dock puts them. Holding the absolute
  // top shrank a solo tile to the float's 55px, then the wake regrew it.
  const callChromeHeld = new Map();
  let callChromeLast = null;

  function restingTop(el) {
    if (!el || el.hidden) return 0;
    let cs = null;
    try { cs = getComputedStyle(el); } catch (e) { return 0; }
    if (!cs || cs.display === 'none' || cs.visibility === 'hidden') return 0;
    if ((el.offsetWidth || 0) < 8 || (el.offsetHeight || 0) < 8) return 0;
    const prev = el.style.transform;
    const moved = cs.transform && cs.transform !== 'none';
    if (moved) el.style.transform = 'none';
    let top = 0;
    try { top = el.getBoundingClientRect().top; }
    finally { if (moved) el.style.transform = prev; }
    return top > 0 ? top : 0;
  }


  // Where the dock and its buttons stand at home. Both drag owners are
  // undone for the reading: placeDock's translate and installBar's
  // left/top. Clearing a button's own transform never undid the bar's.
  const DOCK_DRAG_PROPS = ['left', 'top', 'right', 'bottom', 'transform'];
  function dockRest(doc) {
    const out = { top: 0, btnTop: 0 };
    const bar = doc && doc.querySelector ? doc.querySelector('.bar') : null;
    if (!bar || !bar.style) return out;
    const keep = {};
    for (let i = 0; i < DOCK_DRAG_PROPS.length; i++) keep[DOCK_DRAG_PROPS[i]] = bar.style[DOCK_DRAG_PROPS[i]];
    for (let i = 0; i < DOCK_DRAG_PROPS.length; i++) bar.style[DOCK_DRAG_PROPS[i]] = '';
    try {
      out.top = restingTop(bar);
      const nodes = bar.querySelectorAll('#cam, #mic, #reactbtn, #bartoggle, #leavebtn');
      for (let i = 0; i < nodes.length; i++) {
        const t = restingTop(nodes[i]);
        if (t > 0 && (out.btnTop === 0 || t < out.btnTop)) out.btnTop = t;
      }
    } finally {
      for (let i = 0; i < DOCK_DRAG_PROPS.length; i++) bar.style[DOCK_DRAG_PROPS[i]] = keep[DOCK_DRAG_PROPS[i]];
    }
    return out;
  }

  function dockControlsTop(doc) { return dockRest(doc).btnTop; }

  // The dock and the shown Live/Record buttons, as screen boxes.
  function chromeMarks(doc) {
    const out = [];
    const bar = doc.querySelector('.bar');
    if (bar) out.push(bar.getBoundingClientRect());
    const state = doc.getElementById('callstate');
    if (state) {
      const btns = state.querySelectorAll('button');
      for (let i = 0; i < btns.length; i++) if (btns[i].offsetParent) out.push(btns[i].getBoundingClientRect());
    }
    return out;
  }

  function tilesMeetChrome(doc, tileEls) {
    const meet = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const away = doc.body && doc.body.classList && doc.body.classList.contains('chrome-away');
    const targets = away && callChromeMarks ? callChromeMarks : chromeMarks(doc);
    for (let i = 0; i < tileEls.length; i++) {
      const el = tileEls[i];
      if (!el || !el.getBoundingClientRect) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      for (let j = 0; j < targets.length; j++) if (meet(r, targets[j])) return true;
    }
    return false;
  }

  // True when no face in the bottom row stands over Live, Record or the chat
  // preview: Record is beside a short last row, so that row may sit on the
  // dock. A full bottom row would run under them.
  function recordBeside(doc, tileEls) {
    const marks = [];
    const state = doc.getElementById('callstate');
    if (state) {
      const btns = state.querySelectorAll('button');
      for (let i = 0; i < btns.length; i++) if (btns[i].offsetParent) marks.push(btns[i].getBoundingClientRect());
    }
    const note = doc.getElementById('chatnote');
    if (note && note.offsetParent) marks.push(note.getBoundingClientRect());
    let bottom = -Infinity;
    const rects = [];
    for (let i = 0; i < tileEls.length; i++) {
      const el = tileEls[i];
      if (!el || !el.getBoundingClientRect) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      rects.push(r);
      bottom = Math.max(bottom, r.bottom);
    }
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r.bottom < bottom - 2) continue;
      for (let j = 0; j < marks.length; j++) {
        const m = marks[j];
        if (m.width > 0 && r.left < m.right - 1 && m.left < r.right - 1) return false;
      }
    }
    return true;
  }

  // env(safe-area-inset-bottom) in px, read from run.html's #gifos-safe-b probe.
  function safeAreaBottom(doc) {
    let p = doc && doc.getElementById ? doc.getElementById('gifos-safe-b') : null;
    if (!p && doc && doc.createElement && doc.body) {
      p = doc.createElement('div');
      p.id = 'gifos-safe-b';
      p.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden';
      doc.body.appendChild(p);
    }
    return p ? (p.offsetHeight || 0) : 0;
  }

  // The faces reach the safe-area bottom on every screen; the call's buttons
  // float over them (2026-11-09). A shared screen and an app stay full-bleed.
  function reserveCallChrome(feed, opts, header, tiles) {
    if (!feed || !feed.style) return 0;
    const doc = feed.ownerDocument || document;
    const body = doc.body;
    const skip = !opts || (body && body.classList && (body.classList.contains('screen-on') || body.classList.contains('has-app')));
    if (skip) { feed.style.bottom = ''; return 0; }
    // Every screen uses the whole height below the header (Nathan 2026-11-09):
    // the dock, Record and the chat line float over the faces and reserve no
    // band, on a phone, a tablet, a desktop, sideways or upright. Only the
    // system gesture bar (safe-area bottom) stays clear. A drag cannot change this.
    {
      callChromeTop = 0; callChromeEdge0 = 0; callChromeLipEdge = 0; callChromeEdge = 0; callChromeMarks = null;
      const safe = safeAreaBottom(doc);
      feed.style.bottom = safe > 0 ? safe + 'px' : '';
      return safe;
    }
    // apply() found that stopping above Record cost a face its 96px: the
    // faces take the whole screen and the controls float over them.
    if (opts._float) { feed.style.bottom = ''; return 0; }
    const view = doc.defaultView || root;
    const vh = +opts.vh || (view && view.innerHeight) || 0;
    const vw = +opts.vw || (view && view.innerWidth) || 0;
    const away = body && body.classList && body.classList.contains('chrome-away');
    callChromeMarks = null;
    if (!away) {
      const note = doc.getElementById('chatnote');
      const state = doc.getElementById('callstate');
      const bar = doc.querySelector('.bar');
      const a = restingTop(note);
      const b = restingTop(state);
      const rest = dockRest(doc);
      const d = bar ? rest.top : 0;
      let top = 0;
      if (a > 0 && b > 0) top = Math.min(a, b);
      else top = a > 0 ? a : b;
      // No call-state row on a phone: the dock is the edge. Desktop has no
      // such row and stays full-bleed under its floating dock (4:42 PM rule).
      if (!(top > 0) && d > 0 && opts.phone) top = d;
      callChromeTop = top > 0 ? top : 0;
      // Video and Mic are the line a face must not cross. On a sideways
      // phone the dock is taller than Record and sticks up into the feed.
      let edge = callChromeTop;
      const btnTop = rest.btnTop;
      // Sideways, Video sticks up past Record. Stop there.
      if (btnTop > 0 && (edge === 0 || btnTop < edge)) edge = btnTop;
      // Upright, the faces stop at Record's row (see-everyone, chat-preview,
      // live-stands-out). 4px into it put a full bottom row under Live and
      // Record. A crowd whose short last row leaves Record beside it gets the
      // lip below instead.
      // Seven faces leave Record beside the grid. Sit the bottom row on the
      // dock, still above Video, and only when the first pass missed it.
      let lipEdge = 0;
      if (d > 0) {
        // 4px, not 2: whole-pixel squares ended 1px into the dock, which
        // does not count as meeting it (375x553 SE in Safari).
        const lip = d + 4;
        if (!(btnTop > 0) || lip < btnTop) lipEdge = lip;
      }
      callChromeEdge0 = edge;
      callChromeLipEdge = lipEdge;
      if (vh > 0) {
        const marks = chromeMarks(doc).map((r) => ({ left: r.left, right: r.right, top: vh - r.top, bottom: vh - r.bottom }));
        callChromeLast = { top: callChromeTop > 0 ? vh - callChromeTop : 0, edge: edge > 0 ? vh - edge : 0, lip: lipEdge > 0 ? vh - lipEdge : 0, marks: marks };
        callChromeHeld.set(Math.round(vw), callChromeLast);
      }
    } else if (vh > 0) {
      const held = callChromeHeld.get(Math.round(vw)) || callChromeLast;
      if (held) {
        callChromeTop = held.top > 0 ? vh - held.top : 0;
        callChromeEdge0 = held.edge > 0 ? vh - held.edge : 0;
        callChromeLipEdge = held.lip > 0 ? vh - held.lip : 0;
        callChromeMarks = (held.marks || []).map((m) => ({ left: m.left, right: m.right, top: vh - m.top, bottom: vh - m.bottom, width: m.right - m.left, height: m.top - m.bottom }));
      }
    }
    // The lip is this layout's call (apply's second pass), awake or tucked.
    callChromeEdge = doc.documentElement.dataset.chromeLip === '1' && callChromeLipEdge > 0 ? callChromeLipEdge : callChromeEdge0;
    const top = callChromeTop;
    // Held top, so a tuck does not flip a sideways phone between the two.
    if (sidewaysFill(tiles, vw, vh, header, !!opts.phone, top)) { feed.style.bottom = ''; return 0; }
    // Nothing below the header, or a control with no room under it.
    if (!(top >= header + 48) || !(vh > 0) || top >= vh - 8) {
      feed.style.bottom = '';
      return 0;
    }
    const edge = callChromeEdge > 0 ? callChromeEdge : top;
    const reserve = Math.ceil(vh - edge);
    feed.style.bottom = reserve + 'px';
    return reserve;
  }

  // A sideways phone fills the height, and the dock, Record and Captions
  // float over the faces, when:
  // - a wide one (844x390, a Pixel 7 at 915x412) fits every face in one
  //   row as tall as the band under the header. Stopping at Record left two
  //   square faces over 107px of black.
  // - a crowd cannot stand as squares in one row above Record. That edge
  //   cut seven faces on an SE (568x320) to 77x156 slivers over 106px of
  //   black, with the dock below them all.
  // Otherwise the edge costs no face its square and stays: one face on an
  // SE keeps Video and Mic off it, and so does a narrow phone's small group.
  function sidewaysFill(tiles, vw, vh, header, phone, top) {
    if (!phone || !(vh < 500) || !(vw > vh)) return false;
    let n = 0;
    for (let i = 0; i < (tiles ? tiles.length : 0); i++) {
      const t = tiles[i];
      if (t.tier === 'stad' || t.stage || t.share) return false;
      n++;
    }
    if (!n) return false;
    const oneRow = (side) => n * side + (n - 1) * 4 <= vw - 4;
    if (vw > 700 && oneRow(vh - header)) return true;
    return top >= header + 48 && top < vh - 8 && !oneRow(top - header);
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
    stopStadClose();
    const placed = feed.querySelectorAll('[data-comfy], .comfy-off');
    for (let i = 0; i < placed.length; i++) clearEl(placed[i]);
    const whole = feed.querySelector('#stadwhole');
    if (whole) whole.remove();
    const band = root.document && root.document.getElementById('stadband');
    if (band) band.remove();
    const src = feed.querySelector('[data-row="sd"]');
    if (src && src.classList) src.classList.remove('stad-src');
    if (feed.style) feed.style.top = '';
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

  // Where one person sits in the whole composite, in the composite's own
  // pixels: the packer paints cell k row-major in square cells of
  // width / cols (mesh-media paint). ids is the pack's cell list; a dense
  // pack names no cells, and then nobody's cell is known (null).
  function wholeCell(ids, cols, id, frameW, frameH) {
    if (!Array.isArray(ids) || !id || !(cols > 0) || !(frameW > 2) || !(frameH > 2)) return null;
    const k = ids.indexOf(String(id));
    if (k < 0) return null;
    const c = frameW / cols;
    const x = (k % cols) * c, y = Math.floor(k / cols) * c;
    if (y + c > frameH + 0.5) return null;
    return { x: x, y: y, w: c, h: c };
  }

  // One stadium element. Repeat calls keep the same <video>, so a
  // status pass does not build a new decoder.
  function ensureWhole(feed) {
    const doc = feed.ownerDocument || document;
    let el = feed.querySelector('#stadwhole');
    if (!el) {
      el = doc.createElement('div');
      el.id = 'stadwhole';
      el.className = 'stadwhole';
      el.dataset.pzkey = 'stad:whole';
      const v = doc.createElement('video');
      v.muted = true; v.autoplay = true; v.playsInline = true;
      v.setAttribute('playsinline', '');
      el.appendChild(v);
      const lb = doc.createElement('span');
      lb.className = 'name';
      el.appendChild(lb);
      feed.appendChild(el);
    }
    return el;
  }

  // The composite fills its box. left/top stay 0 and the video is the
  // element's own size, so the frame shows whole. A cell crop would shift
  // it by a negative offset and a width larger than the box.
  // A stage camera is copied out of that frame onto one canvas instead.
  function showWhole(video) {
    if (!video || !video.style) return;
    video.style.position = 'absolute';
    video.style.left = '0px';
    video.style.top = '0px';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.maxWidth = 'none';
    video.style.maxHeight = 'none';
    video.style.objectFit = 'contain';
    video.style.objectPosition = 'center center';
    video.style.visibility = '';
    video.style.opacity = '';
  }

  // One canvas over the stadium video. It redraws the cells this browser
  // keeps and leaves a stage camera's cell out. The source <video> stays
  // playing underneath: hiding it can stop the decoder. Nothing is sent.
  let stadClose = null;
  function stopStadClose() {
    const c = stadClose;
    stadClose = null;
    if (!c) return;
    if (c.vfc && c.video && typeof c.video.cancelVideoFrameCallback === 'function') {
      try { c.video.cancelVideoFrameCallback(c.vfc); } catch (e) {}
    }
    if (c.rafId) cancelAnimationFrame(c.rafId);
    if (c.canvas && c.canvas.remove) c.canvas.remove();
  }
  function stadCellsSquare(n, cols, sw, sh) {
    const MM = GifOS.meshMedia;
    if (!MM || typeof MM.faceSrcRect !== 'function' || typeof MM.packGrid !== 'function') return false;
    if (!Number.isInteger(n) || !Number.isInteger(cols) || n < 1 || cols < 1) return false;
    if (!(sw > 2) || !(sh > 2)) return false;
    const s = MM.faceSrcRect(0, n, cols, sw, sh);
    return !!(s && s.sw > 0 && Math.abs(s.sw - s.sh) <= 0.08 * s.sw);
  }
  function drawStadClose(c) {
    const video = c.video;
    const sw = (video && video.videoWidth) || 0;
    const sh = (video && video.videoHeight) || 0;
    if (!c.ctx || !stadCellsSquare(c.n, c.cols, sw, sh)) return false;
    const MM = GifOS.meshMedia;
    const keep = c.keep;
    const g = MM.packGrid(keep.length, 'stad');
    const cell = Math.max(1, Math.round(sw / c.cols));
    const W = cell * g.cols, H = cell * g.rows;
    if (c.canvas.width !== W) c.canvas.width = W;
    if (c.canvas.height !== H) c.canvas.height = H;
    c.ctx.fillStyle = '#101418';
    c.ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < keep.length; i++) {
      const s = MM.faceSrcRect(keep[i], c.n, c.cols, sw, sh);
      const dx = (i % g.cols) * cell, dy = Math.floor(i / g.cols) * cell;
      try { c.ctx.drawImage(video, s.sx, s.sy, s.sw, s.sh, dx, dy, cell, cell); } catch (e) {}
    }
    return true;
  }
  function armStadClose(el, video, spec) {
    const n = spec.n | 0, cols = spec.cols | 0;
    const skip = {};
    const skips = spec.skips || [];
    for (let i = 0; i < skips.length; i++) {
      const j = skips[i] | 0;
      if (j >= 0 && j < n) skip[j] = true;
    }
    const keep = [];
    for (let j = 0; j < n; j++) if (!skip[j]) keep.push(j);
    const sw = (video && video.videoWidth) || 0;
    const sh = (video && video.videoHeight) || 0;
    if (!keep.length || keep.length === n || !stadCellsSquare(n, cols, sw, sh)) { stopStadClose(); return; }
    if (stadClose && (stadClose.el !== el || stadClose.video !== video)) stopStadClose();
    if (!stadClose) {
      const doc = el.ownerDocument || document;
      const canvas = doc.createElement('canvas');
      canvas.className = 'stad-close';
      canvas.setAttribute('aria-hidden', 'true');
      const st = canvas.style;
      st.position = 'absolute';
      st.left = '0'; st.top = '0'; st.width = '100%'; st.height = '100%';
      st.objectFit = 'contain';
      st.background = '#101418';
      st.zIndex = '1';
      st.pointerEvents = 'none';
      const name = el.querySelector('.name');
      if (name) el.insertBefore(canvas, name); else el.appendChild(canvas);
      stadClose = { el: el, video: video, canvas: canvas, ctx: canvas.getContext('2d'), rafId: 0, vfc: 0 };
      const tick = function () {
        if (!stadClose || stadClose.canvas !== canvas) return;
        drawStadClose(stadClose);
        const v = stadClose.video;
        if (v && typeof v.requestVideoFrameCallback === 'function') stadClose.vfc = v.requestVideoFrameCallback(tick);
        else stadClose.rafId = requestAnimationFrame(tick);
      };
      if (video && typeof video.requestVideoFrameCallback === 'function') stadClose.vfc = video.requestVideoFrameCallback(tick);
      else stadClose.rafId = requestAnimationFrame(tick);
    }
    stadClose.n = n;
    stadClose.cols = cols;
    stadClose.keep = keep;
    drawStadClose(stadClose);
  }

  // One resize listener, on the stadium <video>. Debounced, so a burst
  // of resizes is one relayout.
  let rzVid = null, rzCb = null, rzTimer = 0;
  function rzFire() {
    if (rzTimer) return;
    rzTimer = setTimeout(function () { rzTimer = 0; if (typeof rzCb === 'function') { try { rzCb(); } catch (e) {} } }, RZ_DEBOUNCE_MS);
  }
  function watchFrame(v, cb) {
    rzCb = cb || null;
    if (rzVid === v) return;
    if (rzVid && typeof rzVid.removeEventListener === 'function') {
      rzVid.removeEventListener('resize', rzFire);
      rzVid.removeEventListener('loadedmetadata', rzFire);
    }
    rzVid = v || null;
    if (rzVid && typeof rzVid.addEventListener === 'function') {
      rzVid.addEventListener('resize', rzFire);
      rzVid.addEventListener('loadedmetadata', rzFire);
    }
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
    const stage = [], share = [], row = [], stad = [];
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (t.tier === 'stad') stad.push(t.id);
      else if (t.kind === 'screen' || t.kind === 'app' || t.fill) {
        share.push({ id: t.id, aspect: t.aspect > 0 ? t.aspect : 16 / 9, fill: !!t.fill || t.kind === 'app', kind: t.kind || (t.fill ? 'app' : 'screen'), content: !!t.content, stackH: typeof t.stackH === 'function' ? t.stackH : undefined });
      } else if (t.stage || t.kind === 'strip' || t.kind === 'person') {
        stage.push({ id: t.id, aspect: t.aspect > 0 ? t.aspect : 16 / 9, kind: t.kind || 'person' });
      } else row.push(t.id);
    }
    const z = MZ.layout({ box: box, stage: stage, share: share, row: row, stad: stad, phone: !!opts.phone,
      gallery: opts.gallery === 'scroll' ? 'scroll' : 'fit', float: opts.float === true, content: opts.content || null, gap: opts.phone ? 4 : MZ.GAP, floor: +opts.floor || 0,
      stadCount: opts.stadCount > 0 ? opts.stadCount : 0 });
    let band = null;
    if (z.tooSmall) band = { text: 'faces tiny \u00b7 Scroll is in \u25a6', x: box.x + 6, y: box.y + 6 };
    return { mode: (stage.length || share.length) ? 'stage' : 'gallery', gallery: z.gallery, rects: z.rects, crowd: false, band: band,
      box: box, regions: z.regions, stage: z.regions.stage, share: z.regions.share, contentH: z.contentH, tooSmall: !!z.tooSmall,
      self: { arrangement: 'tile' }, zones: true, side: z.side, stadSide: z.stadSide };
  }

  // The composite's frame size. The pack canvas wins. A face video on the
  // same stream is next. The hidden off-screen source is last: WebKit never
  // loads it, and a fleet Chrome froze it at the first frame.
  // { w, h, from: 'pack' | 'face' | 'source' | 'none' }.
  function stadFrameSize(srcW, srcH, faceEls, stream, video) {
    if (srcW > 2 && srcH > 2) return { w: srcW | 0, h: srcH | 0, from: 'pack' }; // 2x2 is an empty packer, not a frame
    for (let j = 0; j < (faceEls ? faceEls.length : 0); j++) {
      const fv = faceEls[j] && faceEls[j].querySelector ? faceEls[j].querySelector('video') : null;
      if (fv && stream && fv.srcObject === stream && fv.videoWidth > 0 && fv.videoHeight > 0) return { w: fv.videoWidth, h: fv.videoHeight, from: 'face' };
    }
    const w = video && video.videoWidth || 0, h = video && video.videoHeight || 0;
    return (w > 0 && h > 0) ? { w: w, h: h, from: 'source' } : { w: 0, h: 0, from: 'none' };
  }

  // Put each saved Fit panel back where it was dropped: 'stage' over a share,
  // 'row' with none. view is the area the panels live in, in the tiles' own
  // coordinates (the feed), or a function returning it (read only when a spot
  // is saved). pad is the gutter inset of the drawn tiles.
  function placeFloats(lay, view, store, orient, pad) {
    const ML = GifOS.meetLayout;
    if (!ML || !ML.placeFloat || !lay || !lay.rects) return lay;
    const next = lay.rects.slice();
    let moved = false, area = null;
    // Every float kind laid this pass: 'stage' and 'row' panels, and in the
    // Float view one kind per tile ('p:<id>').
    const kinds = [];
    for (let i = 0; i < next.length; i++) if (next[i].float && kinds.indexOf(next[i].float) < 0) kinds.push(next[i].float);
    for (let kindi = 0; kindi < kinds.length; kindi++) {
      const kind = kinds[kindi];
      const saved = ML.loadFloat(store, kind, orient);
      if (!saved) continue;
      const group = [], idx = [];
      for (let i = 0; i < next.length; i++) if (next[i].float === kind) { group.push(next[i]); idx.push(i); }
      if (!group.length) continue;
      if (!area) area = typeof view === 'function' ? view() : view;
      const placed = ML.placeFloat(group, saved, area, pad);
      if (placed !== group) {
        for (let k = 0; k < idx.length; k++) next[idx[k]] = placed[k];
        moved = true;
      }
    }
    return moved ? Object.assign({}, lay, { rects: next }) : lay;
  }

  // opts: { feed, tiles, faces, video, vw, vh, phone, now, onSettle }
  // tiles: the row (and the stage), each already a direct peer video.
  // faces: who is in the stadium. They become one box, not one tile each.
  function apply(opts) {
    opts = opts || {};
    const ML = GifOS.meetLayout;
    const feed = opts.feed;
    if (!opts._lip && feed && feed.ownerDocument) delete feed.ownerDocument.documentElement.dataset.chromeLip;
    if (!ML || !feed) return null;
    const allFaces = opts.faces || [];
    const tiles = (opts.tiles || []).slice();
    let stadEl = null;
    if (allFaces.length > 0) {
      stadEl = ensureWhole(feed);
      const lb = stadEl.querySelector('.name');
      if (lb) lb.textContent = 'Stadium \u00b7 ' + allFaces.length;
      tiles.push({ id: 'stad:whole', tier: 'stad', el: stadEl, shade: 'stad' });
    } else {
      stopStadClose();
      const old = feed.querySelector('#stadwhole');
      if (old) old.remove();
    }
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (!t.el) continue;
      const v = t.el.querySelector && t.el.querySelector('video');
      // A tall composite must not resize the row. Row tiles keep their own aspect.
      if (v && t.id !== 'stad:whole' && v.videoWidth > 0 && v.videoHeight > 0) t.aspect = v.videoWidth / v.videoHeight;
      if (t.pz) t.el.dataset.pzkey = t.pz;
      t.el.dataset.tier = t.tier || 'row';
    }
    const box0 = ML.viewBox(opts.vw || 1, opts.vh || 1, {
      phone: !!opts.phone, pill: !!opts.pill, bottom: 0, top: 0,
    });
    // Tiles are positioned inside the feed. y stays 0, which is the feed's
    // top, already under the header band. The feed ends at Live, Record,
    // or the chat preview. That bottom is the shown edge, so a tuck does
    // not resize the faces.
    const header = reserveHeader(feed, opts);
    const chrome = reserveCallChrome(feed, opts, header, tiles);
    const cut = header + chrome;
    const box = cut > 0 ? Object.assign({}, box0, { y: 0, h: Math.max(1, box0.h - cut) }) : box0;
    const MZ = GifOS.meetZones;
    const byId = {};
    for (let i = 0; i < tiles.length; i++) byId[tiles[i].id] = tiles[i];
    // pictureCells: the frame still has more cells than the faces we show.
    // The box follows the frame so a shorter count cannot slit it.
    const picN = opts.pictureCells | 0;
    const stadN = picN > allFaces.length ? picN : allFaces.length;
    let lay = zonesLayout(MZ, tiles, box, Object.assign({}, opts, { stadCount: stadN }));
    // Stopping the faces above Record must not shrink a phone face under the
    // 96px Fit floor (a 320x460 SE made seven 76x108 slivers). Then the faces
    // fill the screen and the dock floats over them (Nathan 2026-10-19 16:42).
    // The held line decides it, so a tuck or a wake gives the same answer.
    // (2026-11-09: a phone reserves no band, so there is no float pass.)
    // A saved drag is a center fraction of the feed, the same area the drag
    // measured. Applied after the fit pass, so the default layout stays what
    // the geometry tests measure. The tiles are drawn inset by the gutter.
    // Only the Float view moves panels (Nathan 2026-11-11: Fit no longer
    // floats; Float is its own view). Fit and Scroll draw the layout as laid.
    const floatOk = opts.float === true && lay && lay.gallery !== 'scroll';
    if (ML.placeFloat && floatOk && lay.rects) {
      const pad = (opts.phone || lay.zones) ? 0 : GUTTER / 2;
      let store = opts.store || null;
      if (!store) { try { if (typeof localStorage !== 'undefined') store = localStorage; } catch (e) {} }
      const orient = ML.floatOrient({ w: +opts.vw || box.w || 1, h: +opts.vh || box.h || 1 });
      lay = placeFloats(lay, function () {
        return { x: 0, y: 0, w: feed.clientWidth > 0 ? feed.clientWidth : box.w, h: feed.clientHeight > 0 ? feed.clientHeight : box.h };
      }, store, orient, pad);
    }
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].me || tiles[i].id === 'me') markSelf(tiles[i].el, lay.self);
    }
    const used = [];
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
      if (r.float && floatOk) {
        t.el.dataset.float = r.float;
        // A tile of its own in the Float view can be resized from its corner.
        if (r.float.indexOf('p:') === 0 && t.el.querySelector && !t.el.querySelector(':scope > .fl-rz') && t.el.ownerDocument) {
          const rz = t.el.ownerDocument.createElement('span');
          rz.className = 'fl-rz'; rz.setAttribute('aria-hidden', 'true');
          t.el.appendChild(rz);
        }
      } else delete t.el.dataset.float;
      used.push(t.el);
    }
    if (!opts._lip && opts.phone && used.length && !tilesMeetChrome(feed.ownerDocument || document, used) && recordBeside(feed.ownerDocument || document, used)) {
      (feed.ownerDocument || document).documentElement.dataset.chromeLip = '1';
      opts._lip = true;
      return apply(opts);
    }
    const usedSet = new Set(used);
    // A Fit panel is only what this pass drew: drop the tag from any other element in the feed.
    if (feed.querySelectorAll) {
      const tagged = feed.querySelectorAll('[data-float]');
      for (let i = 0; i < tagged.length; i++) if (!usedSet.has(tagged[i])) delete tagged[i].dataset.float;
    }
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].el && !usedSet.has(tiles[i].el)) {
        parkEl(tiles[i].el);
        if (tiles[i].el.dataset) delete tiles[i].el.dataset.float;
      }
    }
    // Absolute tiles do not grow scrollHeight. A 1px spacer does, so Scroll
    // can move through the stadium without a pager.
    let spacer = feed.querySelector('#comfyspacer');
    const contentH = lay.contentH || (lay.box ? lay.box.h : 0);
    const need = (lay.box ? lay.box.y : 0) + contentH;
    const overflows = !!(lay.box && contentH > lay.box.h + 1);
    const tail = overflows ? Math.max(0, (+opts.vh || 0) - lay.box.y - lay.box.h) : 0;
    // A gallery that scrolls folds at the box, or below its first row when
    // that row is taller than the band (3d2dd16). clipY only places the
    // "more below" hint: rows past it paint under the floating bar and the
    // feed scrolls to them (Nathan 2026-11-09: Scroll and Fit both paint
    // under the bar, which floats over them).
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
    // No bottom clip: the feed runs to the bottom edge under the bar.
    if (feed.style && feed.style.removeProperty) feed.style.removeProperty('--comfy-clip');
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
    const stream = video && video.srcObject;
    let frameVid = null;
    if (stadEl) {
      const cv = stadEl.querySelector('video');
      if (stream) playStream(cv, stream);
      showWhole(cv);
      const skips = Array.isArray(opts.skipCells) ? opts.skipCells : [];
      if (skips.length && (opts.cellN | 0) > 0 && (opts.cols | 0) > 0) {
        armStadClose(stadEl, cv, { n: opts.cellN | 0, cols: opts.cols | 0, skips: skips });
      } else stopStadClose();
      if (stream) frameVid = cv;
    }
    watchFrame(frameVid, typeof opts.onSettle === 'function' ? opts.onSettle : null);
    // The hold keys on the composite's frame size, not on who joined. A
    // change before the last one settled continues the same hold, and the
    // cap ends it. The video is already showing: nothing is waiting on a cut.
    const srcW = opts.srcW | 0, srcH = opts.srcH | 0;
    const frameKey = srcW + 'x' + srcH;
    const now = opts.now || Date.now();
    const holdMs = opts.holdMs > 0 ? opts.holdMs : 2500;
    const holdMax = opts.holdMaxMs > 0 ? opts.holdMaxMs : Math.max(HOLD_MAX_MS, holdMs);
    if (frameKey !== stadSeen.key) {
      const streak = !!stadSeen.key && (now - stadSeen.at < holdMs);
      stadSeen = { key: frameKey, at: now, since: streak ? stadSeen.since : now };
    }
    const settleLeft = holdMs - (now - stadSeen.at);
    const capLeft = holdMax - (now - stadSeen.since);
    const holding = allFaces.length > 0 && settleLeft > 0 && capLeft > 0;
    if (holding && typeof opts.onSettle === 'function') {
      const wait = Math.max(16, Math.min(settleLeft, capLeft) + 30);
      if (stadTimer) clearTimeout(stadTimer);
      stadTimer = setTimeout(function () { stadTimer = 0; try { opts.onSettle(); } catch (e) {} }, wait);
    }
    const sh = feed.scrollHeight, ch = feed.clientHeight;
    return {
      mode: lay.mode,
      rects: lay.rects,
      box: box,
      crowd: false,
      holding: holding,
      faces: { all: allFaces.length, shown: stadEl ? 1 : 0, over: 0 },
      src: { w: srcW > 2 ? srcW : 0, h: srcH > 2 ? srcH : 0, from: (srcW > 2 && srcH > 2) ? 'pack' : 'none' },
      tier: lay.tier,
      scroll: { sh: sh, ch: ch },
      // The content region (a shared screen or app; later the content tabs):
      // its box this pass, or null. The page marks body.has-content from it.
      content: lay.share || null,
    };
  }

  function metrics(bar, grip) {
    let tab = 0;
    if (grip && bar && bar.getBoundingClientRect) {
      const br = bar.getBoundingClientRect();
      const gr = grip.getBoundingClientRect();
      // Both rects share the bar's translate, so the span is the tab's place in the bar.
      if (gr.width > 0 && br.width > 0) tab = gr.right - br.left;
    }
    return {
      bar: { w: bar.offsetWidth, h: bar.offsetHeight, tab: tab },
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
      const m = metrics(bar, grip);
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
      const m = metrics(bar, grip);
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
      const m = metrics(bar, grip);
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

  // Size, corner, edge, and hide. Float tiles drag.
  // "Show me on stage" is gone. A saved onStage pin is cleared: there is no
  // control left to turn it off, and it was never room stage membership.
  function installSelf(opts) {
    opts = opts || {};
    const ML = GifOS.meetLayout;
    if (!ML || typeof ML.normalizeSelf !== 'function') return null;
    const store = opts.store || root.localStorage;
    const phoneNow = opts.phone || function () { return (root.innerWidth || 0) < 600; };
    let spec = ML.normalizeSelf(opts.spec || ML.loadSelf(store, phoneNow()));
    if (spec.onStage) {
      spec = ML.normalizeSelf(Object.assign({}, spec, { onStage: false }));
      try { ML.saveSelf(store, phoneNow(), spec); } catch (e) {}
    }
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
      spec = ML.normalizeSelf(Object.assign({}, next, { onStage: false }));
      root.__meetSelf = spec;
      root.__meetSwapSelf = false;
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

  // Drag a Fit panel (every tile that shares data-float). A 3px move starts
  // the drag, so a tap still opens the tile. The group may go partly off any
  // edge; 32px of it stay on the feed so it can be grabbed back.
  function installFloat(opts) {
    opts = opts || {};
    const ML = GifOS.meetLayout;
    const doc = root.document;
    if (!ML || typeof ML.loadFloat !== 'function' || !doc || !doc.addEventListener) return null;
    const store = opts.store || root.localStorage;
    let drag = null;
    function orient() { return ML.floatOrient({ w: root.innerWidth || 0, h: root.innerHeight || 0 }); }
    // The feed's box on screen: the area the panels are placed in and dragged in.
    function area() {
      const feed = doc.getElementById ? doc.getElementById('feed') : null;
      const r = feed && feed.getBoundingClientRect ? feed.getBoundingClientRect() : null;
      if (r && r.width > 0 && r.height > 0) return { x: r.left, y: r.top, w: r.width, h: r.height };
      return { x: 0, y: 0, w: root.innerWidth || 0, h: root.innerHeight || 0 };
    }
    // Only drawn members: a parked or stale tile has an empty rect at the
    // origin, which would stretch the union and halve every saved drop.
    function members(kind) {
      const all = doc.querySelectorAll ? doc.querySelectorAll('[data-float="' + kind + '"]') : [];
      const out = [];
      for (let i = 0; i < all.length; i++) if (!all[i].getClientRects || all[i].getClientRects().length > 0) out.push(all[i]);
      return out;
    }
    function union(list) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < list.length; i++) {
        const r = list[i].getBoundingClientRect();
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top);
        x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      }
      return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
    }
    function relayout() {
      const fn = opts.relayout || root.__meetRelayout;
      if (typeof fn === 'function') { try { fn(); } catch (e) {} }
    }
    // The corner handle of a Float-view tile resizes it (aspect kept). The
    // new size is saved as a factor of the laid size, with the tile's spot.
    const RZ_MIN = 64;
    let rz = null;
    doc.addEventListener('pointerdown', function (e) {
      if (!e.target || !e.target.closest) return;
      const tile = e.target.closest('[data-float]');
      if (!tile) return;
      if (e.target.closest('.fl-rz')) {
        if (e.button != null && e.button !== 0) return;
        const r = tile.getBoundingClientRect();
        const prev = ML.loadFloat(store, tile.dataset.float, orient());
        rz = { id: e.pointerId, el: tile, kind: tile.dataset.float, x: e.clientX, w: r.width, h: r.height, s: prev && prev.s > 0 ? prev.s : 1, area: area(), moved: false };
        e.preventDefault();
        try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
        return;
      }
      if (e.target.closest('button, a, input, textarea, .modbar')) return;
      if (e.button != null && e.button !== 0) return;
      const kind = tile.dataset.float;
      const list = members(kind);
      const origins = [];
      for (let i = 0; i < list.length; i++) {
        origins.push({ el: list[i], left: parseFloat(list[i].style.left) || 0, top: parseFloat(list[i].style.top) || 0 });
      }
      const g = union(list);
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, kind: kind, origins: origins, gx: g.x, gy: g.y, gw: g.w, gh: g.h, area: area(), moved: false };
      try { tile.setPointerCapture(e.pointerId); } catch (err) {}
    });
    doc.addEventListener('pointermove', function (e) {
      if (rz && e.pointerId === rz.id) {
        const w = Math.max(RZ_MIN, Math.min(rz.area.w, rz.w + (e.clientX - rz.x)));
        rz.moved = true;
        rz.nw = w;
        rz.el.style.width = w + 'px';
        rz.el.style.height = (w * rz.h / rz.w) + 'px';
        return;
      }
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (!drag.moved) return;
      const c = ML.clampFloat({ x: drag.gx + dx, y: drag.gy + dy, w: drag.gw, h: drag.gh }, drag.area);
      const adx = c.x - drag.gx, ady = c.y - drag.gy;
      for (let i = 0; i < drag.origins.length; i++) {
        drag.origins[i].el.style.left = (drag.origins[i].left + adx) + 'px';
        drag.origins[i].el.style.top = (drag.origins[i].top + ady) + 'px';
      }
    });
    function endDrag(e) {
      if (rz && (!e || e.pointerId == null || e.pointerId === rz.id)) {
        const done = rz;
        rz = null;
        if (!done.moved || !(done.nw > 0)) return;
        const spot = ML.floatSpot(union([done.el]), done.area);
        spot.s = done.s * done.nw / done.w;
        ML.saveFloat(store, done.kind, orient(), spot);
        relayout();
        return;
      }
      if (!drag || (e && e.pointerId != null && e.pointerId !== drag.id)) return;
      const moved = drag.moved;
      const kind = drag.kind;
      const box = drag.area;
      drag = null;
      if (!moved) return;
      const spot = ML.floatSpot(union(members(kind)), box);
      const prev = ML.loadFloat(store, kind, orient());
      if (prev && prev.s > 0) spot.s = prev.s; // a move keeps a resized tile's size
      ML.saveFloat(store, kind, orient(), spot);
      const stop = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        doc.removeEventListener('click', stop, true);
      };
      doc.addEventListener('click', stop, true);
      relayout();
    }
    doc.addEventListener('pointerup', endDrag);
    doc.addEventListener('pointercancel', endDrag);
    doc.addEventListener('dblclick', function (e) {
      if (!e.target || !e.target.closest) return;
      const tile = e.target.closest('[data-float]');
      if (!tile) return;
      e.preventDefault();
      ML.clearFloat(store, tile.dataset.float, orient());
      relayout();
    });
    return { orient: orient };
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
    wholeCell: wholeCell,
    apply: apply,
    stadFrameSize: stadFrameSize,
    installBar: installBar,
    dockRest: dockRest,
    installSelf: installSelf,
    installFloat: installFloat,
    placeFloats: placeFloats,
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
    try { installFloat({ store: root.localStorage }); } catch (e) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
