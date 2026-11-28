/*
 * dialog.js — one structure for every dialog, sheet and popover that has
 * actions (Close, Done, Save, Cancel, OK, Leave...).
 *
 * A dialog's card gets three parts: .dlg-head (its title), .dlg-body (the
 * only part that scrolls) and .dlg-actions (its buttons). The actions sit
 * outside the scroll, so however long the content grows they are on screen
 * and a person can always get back to what is underneath.
 *
 * shape(card) applies it. The actions are the card's last child marked
 * .dlg-actions (or the older .modal-actions / .appear-actions /
 * .lock-btns), else the run that ends the card of loose buttons, or of rows
 * of only buttons (one kind: loose choices above a Cancel row stay in the
 * body). A leading heading is the head. Everything else moves, in order,
 * into .dlg-body. A card with no actions is left as it is. A card already
 * built with these parts is only marked.
 *
 * Every card on the page is shaped at start, and one observer shapes each
 * dialog added later, or a card whose content is written again. Nothing
 * here opens, closes or dismisses a dialog: Escape and a tap outside keep
 * working wherever they did.
 *
 * Every card also moves (see "moving a card" below): by its head with a
 * mouse, a finger or a pen, or the arrow keys on the focused head, so a
 * popup never has to cover what a person wants to see beside it.
 *
 * This is the one popup library: a popup is a .dlg-box (or one of the older
 * pairs in CARDS), never a hand-made overlay.
 */
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || (root.GifOS && root.GifOS.dialog)) return;

  // Cards, and the backdrops they are added in.
  // A popup is a .dlg-box: a card with its own look, alone over the page (a small card, a native <dialog>)
  // or in a .dlg-backdrop that dims and holds it. The other pairs are the pages' older names for the same thing.
  const CARDS = '.dlg-box, .name-modal > .name-box, .name-modal > .closed-box, .modal-bg > .modal, .rb-sheet > .rb-card, ' +
    '.lock-modal > .lock-box, .perm-modal > .perm-box, .rec-replay';
  const BACKDROPS = '.dlg-backdrop, .name-modal, .modal-bg, .rb-sheet, .lock-modal, .perm-modal, .rec-replay';
  const MARKED = ['dlg-actions', 'modal-actions', 'appear-actions', 'lock-btns'];

  const CSS =
    '.dlg{display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;' +
      'max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))}' +
    '.dlg[hidden],dialog.dlg:not([open]){display:none}' +
    '.dlg>.dlg-head,.dlg>.dlg-actions{flex:0 0 auto}' +
    '.dlg>.dlg-body{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}' +
    '.dlg>.dlg-actions{padding-top:12px}' +
    '.dlg>.dlg-actions.dlg-loose{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px}' +
    '.dlg>.dlg-actions.dlg-loose>button{margin:0}' +
    // Moving: the head (or the grip of a card with no title) is the handle. It takes no page pan and selects no words.
    '.dlg-card>.dlg-head,.dlg-card>.dlg-grip{touch-action:none;-webkit-user-select:none;user-select:none;cursor:grab}' +
    '.dlg-card>.dlg-head:focus-visible,.dlg-card>.dlg-grip:focus-visible{outline:2px solid #6ea8ff;outline-offset:2px}' +
    // A grip is a full finger's reach (44 px tall, 88 wide) around a small bar, mostly in the card's top padding.
    '.dlg-card>.dlg-grip{display:block;flex:0 0 auto;width:88px;height:44px;margin:-22px auto -14px;padding:0;border:0;' +
      'background:linear-gradient(currentColor,currentColor) center/36px 4px no-repeat;opacity:.35;border-radius:2px}' +
    'html.dlg-dragging,html.dlg-dragging *{cursor:grabbing!important;-webkit-user-select:none!important;user-select:none!important}' +
    // A moved card stands where it was put: out of its backdrop's centring, its words not reflowed.
    '.dlg-card.dlg-moved{position:fixed!important;margin:0!important;transform:none!important;translate:none!important;' +
      'right:auto!important;bottom:auto!important;box-sizing:border-box}' +
    '.dlg-card.dlg-moved:not(.dlg){overflow-y:auto}';

  function injectCss() {
    if (doc.getElementById('gifos-dialog-css')) return;
    const st = doc.createElement('style');
    st.id = 'gifos-dialog-css';
    st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  const isBtn = (el) => el.tagName === 'BUTTON';
  // A row of only buttons, with no words of its own between them.
  const isBtnRow = (el) => (el.tagName === 'DIV' || el.tagName === 'P') && el.children.length > 0 && Array.from(el.children).every(isBtn)
    && Array.from(el.childNodes).every((n) => n.nodeType !== 3 || !n.textContent.trim());
  const isHead = (el) => /^H[1-4]$/.test(el.tagName) || el.classList.contains('dlg-head') || el.classList.contains('dlg-grip') || el.classList.contains('rb-title') || el.classList.contains('rec-replay-title');

  function shape(card) {
    if (!card || card.nodeType !== 1) return false;
    const kids = Array.from(card.children);
    if (kids.some((k) => k.classList.contains('dlg-body'))) { card.classList.add('dlg'); return false; }
    let acts = null;
    for (let k = kids.length - 1; k >= 0; k--) {
      if (MARKED.some((c) => kids[k].classList.contains(c))) { acts = kids[k]; break; }
    }
    let loose = [];
    if (!acts) {
      // The run is all loose buttons or all rows of buttons: choices set
      // loose above a Cancel row (Vote) stay in the body.
      let j = kids.length;
      const kind = kids[j - 1] && (isBtn(kids[j - 1]) ? isBtn : isBtnRow);
      while (j > 0 && kind(kids[j - 1])) j--;
      loose = kids.slice(j);
      if (!loose.length || j === 0) return false;
    }
    const head = kids[0] && kids[0] !== acts && !loose.includes(kids[0]) && isHead(kids[0]) ? kids[0] : null;
    const body = doc.createElement('div');
    body.className = 'dlg-body';
    // Every node that is not the head or the actions goes into the body, in order.
    const keep = new Set([head, acts].concat(loose).filter(Boolean));
    for (const n of Array.from(card.childNodes)) if (!keep.has(n)) body.appendChild(n);
    if (head) head.classList.add('dlg-head');
    let row = acts;
    if (!row) {
      if (loose.length === 1 && loose[0].tagName !== 'BUTTON') row = loose[0];
      else {
        row = doc.createElement('div');
        row.className = 'dlg-loose';
        for (const b of loose) row.appendChild(b);
      }
    }
    row.classList.add('dlg-actions');
    if (row !== acts && loose[0] !== row) row.classList.add('dlg-loose');
    if (head) card.insertBefore(body, head.nextSibling); else card.insertBefore(body, card.firstChild);
    card.appendChild(row);
    card.classList.add('dlg');
    return true;
  }

  // ---- moving a card ------------------------------------------------------------------------------
  // Every card moves by its head: mouse, touch or pen, and the arrow keys on the focused head. A card
  // with no title gets a grip (a short bar at its top) to hold instead. A tap on a control in the head
  // stays that control's: a move starts only past a few pixels, and never on a button, link or field.
  // Two taps (or a double click) on the head put the card back where it opens.
  // The card stays on screen. Its head never leaves the window, and when it is pulled down its body
  // gives way first (the card gets shorter and the body scrolls), so the head and the actions row
  // (Close, Done, Save) stay on screen however far down it peeks. A phone's full-height sheet moves
  // the same way: pulled down, the call underneath shows above it.
  // Where a card was put is remembered per kind of card, apart for phones and bigger screens (the
  // floating bar's pattern, gifos_bar_pos_v1), and used again next time it opens, kept on screen.
  const POS_KEY = 'gifos_dlg_pos_v1';
  const PAD = 4, BODY_MIN = 48, STEP = 16, BIG_STEP = 64, SLOP = 5;
  // Two taps on a head within the platform's double-tap time (js/timings.js, read when a tap lands: the table loads
  // after this file on some pages). A mouse's double click is the browser's own dblclick, at the system's setting.
  const tap2 = () => root.GifOS.timings.DLG_TAP2_MS;
  const NOT_GRAB = 'button,a[href],input,select,textarea,label,summary,[contenteditable=""],[contenteditable="true"],[role="button"],[role="tab"],[role="switch"],[role="checkbox"],[role="link"]';
  const grabOf = (card) => card.querySelector(':scope > .dlg-head, :scope > .dlg-grip');
  const device = () => (root.matchMedia && root.matchMedia('(max-width: 700px), (max-height: 500px)').matches ? 'p' : 'd');
  function kindOf(card) {
    if (card.dataset.dlgKind) return card.dataset.dlgKind;
    const bg = card.parentElement && card.parentElement.matches(BACKDROPS) ? card.parentElement : null;
    return (bg && bg.id) || card.id || ((bg ? bg.classList[0] + '>' : '') + card.classList[0]);
  }
  function loadAll() {
    try { const o = JSON.parse(root.localStorage.getItem(POS_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
  }
  function saved(card) {
    const p = (loadAll()[kindOf(card)] || {})[device()];
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  }
  function remember(card, p) {
    const o = loadAll(), k = kindOf(card), d = device();
    o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {};
    if (p) o[k][d] = { x: Math.round(p.x), y: Math.round(p.y) }; else delete o[k][d];
    if (!Object.keys(o[k]).length) delete o[k];
    try { root.localStorage.setItem(POS_KEY, JSON.stringify(o)); } catch (e) {}
  }
  const viewW = () => doc.documentElement.clientWidth || root.innerWidth;
  const viewH = () => root.innerHeight || doc.documentElement.clientHeight;
  // The least height that keeps the head, the actions and a little of the body.
  function leastHeight(card) {
    const cs = root.getComputedStyle(card);
    const frame = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    const body = card.querySelector(':scope > .dlg-body');
    if (!body) return Math.min(card.scrollHeight + frame, frame + ((grabOf(card) || card).offsetHeight || 0) + BODY_MIN);
    let fixed = 0;
    for (const k of card.children) if (k !== body && k.getClientRects().length) fixed += k.offsetHeight;
    return frame + fixed + Math.min(BODY_MIN, body.scrollHeight);
  }
  // Stand the card with its top-left corner at x, y, kept on screen.
  function place(card, x, y) {
    const s = card.style;
    if (!card.classList.contains('dlg-moved')) {
      const r = card.getBoundingClientRect();
      card.dataset.dlgW = String(Math.ceil(r.width));
      // The card's own inline sizes come back when it goes back.
      card.__dlgOwn = { left: s.left, top: s.top, width: s.width, maxHeight: s.maxHeight };
      card.classList.add('dlg-moved');
    }
    const vw = viewW(), vh = viewH();
    const w = Math.min(parseFloat(card.dataset.dlgW) || card.offsetWidth, vw - 2 * PAD);
    s.width = w + 'px';
    const nx = Math.round(Math.max(PAD, Math.min(vw - PAD - w, x)));
    const ny = Math.round(Math.max(PAD, Math.min(vh - PAD - leastHeight(card), y)));
    s.left = nx + 'px'; s.top = ny + 'px';
    s.maxHeight = Math.max(0, vh - PAD - ny) + 'px';
    return { x: nx, y: ny };
  }
  function reset(card) {
    if (!card) return;
    const s = card.style, own = card.__dlgOwn || {};
    s.left = own.left || ''; s.top = own.top || ''; s.width = own.width || ''; s.maxHeight = own.maxHeight || '';
    card.__dlgOwn = null;
    card.classList.remove('dlg-moved');
    delete card.dataset.dlgW;
    remember(card, null);
  }
  const shown = (card) => card.isConnected && card.getClientRects().length > 0;
  // Each time a card opens (its box appears) or the window changes, it is put where it belongs.
  function settle(card) {
    if (!shown(card)) return;
    if (card.classList.contains('dlg-moved')) place(card, parseFloat(card.style.left) || 0, parseFloat(card.style.top) || 0);
    else { const p = saved(card); if (p) place(card, p.x, p.y); }
  }
  const ro = root.ResizeObserver ? new root.ResizeObserver((ents) => {
    for (const e of ents) {
      const card = e.target, open = shown(card);
      if (open && !card.__dlgOpen) settle(card);
      card.__dlgOpen = open;
    }
  }) : null;
  function movable(card) {
    if (!card || card.nodeType !== 1) return;
    if (!card.classList.contains('dlg-card')) {
      card.classList.add('dlg-card');
      if (ro) ro.observe(card);
    }
    let grab = grabOf(card);
    if (!grab) {
      const first = card.firstElementChild;
      if (first && isHead(first)) { first.classList.add('dlg-head'); grab = first; }
      else {
        grab = doc.createElement('div');
        grab.className = 'dlg-grip';
        card.insertBefore(grab, card.firstChild);
      }
    }
    if (!grab.hasAttribute('tabindex')) grab.tabIndex = 0;
    if (grab.classList.contains('dlg-grip')) grab.setAttribute('aria-hidden', 'true');
  }

  let drag = null, lastTap = { card: null, at: 0 }, eatClick = false;
  function onDown(e) {
    eatClick = false;
    if (e.button || !e.isPrimary) return;
    const t = e.target;
    const grab = t && t.closest ? t.closest('.dlg-head, .dlg-grip') : null;
    const card = grab && grab.parentElement;
    if (!card || !card.classList.contains('dlg-card')) return;
    const ctl = t.closest(NOT_GRAB);
    if (ctl && grab.contains(ctl)) return;
    const r = card.getBoundingClientRect();
    drag = { id: e.pointerId, card, grab, sx: e.clientX, sy: e.clientY, x0: r.left, y0: r.top, on: false };
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.on) {
      if (Math.abs(dx) + Math.abs(dy) < SLOP) return;
      drag.on = true;
      try { drag.grab.setPointerCapture(e.pointerId); } catch (err) {}
      doc.documentElement.classList.add('dlg-dragging');
    }
    e.preventDefault();
    drag.at = place(drag.card, drag.x0 + dx, drag.y0 + dy);
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    doc.documentElement.classList.remove('dlg-dragging');
    if (d.on) {
      if (d.at) remember(d.card, d.at);
      // A mouse or pen drag ends in a click of its own, sent in the same turn as this pointerup: it never reaches
      // the head or the backdrop under it. (A touch drag makes no click.)
      if (e.pointerType !== 'touch') { eatClick = true; setTimeout(() => { eatClick = false; }); }
      lastTap = { card: null, at: 0 };
      return;
    }
    if (e.type !== 'pointerup' || e.pointerType === 'mouse') return;
    const now = Date.now();
    if (lastTap.card === d.card && now - lastTap.at < tap2()) {
      lastTap = { card: null, at: 0 };
      // A tap's click is aimed where the finger was AFTER it lifts, which is now the backdrop the card just left:
      // that click is eaten (or, if none comes, the eating stops after a double-tap time).
      reset(d.card);
      eatClick = true;
      setTimeout(() => { eatClick = false; }, tap2());
    } else lastTap = { card: d.card, at: now };
  }
  function onKey(e) {
    const grab = e.target;
    if (!grab || !grab.classList || !(grab.classList.contains('dlg-head') || grab.classList.contains('dlg-grip'))) return;
    const card = grab.parentElement;
    if (!card || !card.classList.contains('dlg-card')) return;
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir) return;
    e.preventDefault();
    e.stopPropagation();
    const n = e.shiftKey ? BIG_STEP : STEP, r = card.getBoundingClientRect();
    remember(card, place(card, r.left + dir[0] * n, r.top + dir[1] * n));
  }
  function armMoving() {
    doc.addEventListener('pointerdown', onDown, true);
    doc.addEventListener('pointermove', onMove, { capture: true, passive: false });
    doc.addEventListener('pointerup', onUp, true);
    doc.addEventListener('pointercancel', onUp, true);
    // The mouse events that follow such a pointerup (mousedown and mouseup from a tap, then the click) are eaten whole,
    // first of all (the window, capturing): a backdrop that closes on a tap outside its card never sees them.
    const eat = (e) => { if (!eatClick) return; if (e.type === 'click') eatClick = false; e.stopImmediatePropagation(); e.preventDefault(); };
    for (const t of ['mousedown', 'mouseup', 'click']) root.addEventListener(t, eat, true);
    doc.addEventListener('dblclick', (e) => {
      const g = e.target && e.target.closest && e.target.closest('.dlg-card > .dlg-head, .dlg-card > .dlg-grip');
      if (!g || e.target.closest(NOT_GRAB)) return;
      e.preventDefault();
      if (!e.sourceCapabilities || !e.sourceCapabilities.firesTouchEvents) reset(g.parentElement);   // a finger's double tap is counted above
    }, true);
    doc.addEventListener('keydown', onKey, true);
    const again = () => { for (const c of doc.querySelectorAll('.dlg-card.dlg-moved')) settle(c); };
    root.addEventListener('resize', again);
    if (root.visualViewport) root.visualViewport.addEventListener('resize', again);
  }

  function take(card) { shape(card); movable(card); }
  function shapeIn(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches(CARDS)) take(node);
    if (node.matches(BACKDROPS)) for (const c of node.querySelectorAll(CARDS)) take(c);
  }

  function start() {
    injectCss();
    armMoving();
    for (const c of doc.querySelectorAll(CARDS)) take(c);
    if (!root.MutationObserver) return;
    // Dialogs are added as backdrops (or cards) and some cards are written
    // again on each open; only those nodes are looked at, so the observer
    // costs nothing on the rest of the page.
    new root.MutationObserver((recs) => {
      for (const r of recs) {
        if (r.target.nodeType === 1 && r.target.matches(CARDS)) take(r.target);
        else if (r.target.nodeType === 1 && r.target.matches(BACKDROPS)) shapeIn(r.target);
        for (const n of r.addedNodes) shapeIn(n);
      }
    }).observe(doc.documentElement, { childList: true, subtree: true });
  }

  root.GifOS = root.GifOS || {};
  root.GifOS.dialog = { shape: shape, CARDS: CARDS, BACKDROPS: BACKDROPS, place: place, reset: reset, POS_KEY: POS_KEY };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
