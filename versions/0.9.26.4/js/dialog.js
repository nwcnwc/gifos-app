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
 */
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || (root.GifOS && root.GifOS.dialog)) return;

  // Cards, and the backdrops they are added in.
  const CARDS = '.name-modal > .name-box, .name-modal > .closed-box, .modal-bg > .modal, .rb-sheet > .rb-card, ' +
    '.lock-modal > .lock-box, .perm-modal > .perm-box, .rec-replay';
  const BACKDROPS = '.name-modal, .modal-bg, .rb-sheet, .lock-modal, .perm-modal, .rec-replay';
  const MARKED = ['dlg-actions', 'modal-actions', 'appear-actions', 'lock-btns'];

  const CSS =
    '.dlg{display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;' +
      'max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))}' +
    '.dlg[hidden]{display:none}' +
    '.dlg>.dlg-head,.dlg>.dlg-actions{flex:0 0 auto}' +
    '.dlg>.dlg-body{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}' +
    '.dlg>.dlg-actions{padding-top:12px}' +
    '.dlg>.dlg-actions.dlg-loose{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px}' +
    '.dlg>.dlg-actions.dlg-loose>button{margin:0}';

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
  const isHead = (el) => /^H[1-4]$/.test(el.tagName) || el.classList.contains('dlg-head') || el.classList.contains('rb-title') || el.classList.contains('rec-replay-title');

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

  function shapeIn(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches(CARDS)) shape(node);
    if (node.matches(BACKDROPS)) for (const c of node.querySelectorAll(CARDS)) shape(c);
  }

  function start() {
    injectCss();
    for (const c of doc.querySelectorAll(CARDS)) shape(c);
    if (!root.MutationObserver) return;
    // Dialogs are added as backdrops (or cards) and some cards are written
    // again on each open; only those nodes are looked at, so the observer
    // costs nothing on the rest of the page.
    new root.MutationObserver((recs) => {
      for (const r of recs) {
        if (r.target.nodeType === 1 && r.target.matches(CARDS)) shape(r.target);
        else if (r.target.nodeType === 1 && r.target.matches(BACKDROPS)) shapeIn(r.target);
        for (const n of r.addedNodes) shapeIn(n);
      }
    }).observe(doc.documentElement, { childList: true, subtree: true });
  }

  root.GifOS = root.GifOS || {};
  root.GifOS.dialog = { shape: shape, CARDS: CARDS };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
