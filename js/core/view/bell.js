/*
 * GifOS Core: the Doorbell's view (meet.html). Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * Paints what the Doorbell part (js/meet-bell.js, GifOS.bell) says, in two places with one painter: a block under My
 * Room in the lobby, and a "Doorbell" group in Settings.
 *   "Ring me on this device"   registers this device (asks for the notification permission: the person's tap)
 *   Pause rings                 the owner's switch at the Doorbell (all devices)
 *   Send a test ring            pushes "Rings reach this device." to this device
 *   Your devices                every device that rings for you, with Remove (the lost-device button)
 * In the lobby it also turns rings this device's service worker showed and nobody answered into missed calls (My
 * Room's own list).
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const doc = root.document;
  if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const B = () => GifOS.bell;
  const MR = () => GifOS.meetMyRoom;
  const T = () => GifOS.timings || {};
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DEL_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9z"/></svg>';
  const boxes = () => [$('lob-bell'), $('set-bell')].filter(Boolean);
  let info = null, said = '', busy = false;

  function paint() {
    const b = B(); if (!b) return;
    for (const box of boxes()) {
      let h = '';
      if (box.id === 'lob-bell') h += '<div class="lob-hist-h">Doorbell</div>';
      if (!b.pushable()) {
        h += '<p class="lob-quiet">This browser cannot ring while GifOS is closed. On an iPhone, add GifOS to your Home Screen first.</p>';
        box.innerHTML = h; box.hidden = false; continue;
      }
      h += '<label class="rec-opt"><input type="checkbox" role="switch" data-bell="on"' + (b.on() ? ' checked' : '') + (busy ? ' disabled' : '') + '><span><b>Ring me on this device</b><small>Calls from your contacts ring here even when GifOS is closed. The ring is end-to-end encrypted: nobody between you and the caller can read who is calling.</small></span></label>';
      if (b.on() && info) {
        h += '<label class="rec-opt"><input type="checkbox" role="switch" data-bell="pause"' + (info.paused ? ' checked' : '') + '><span><b>Pause rings</b><small>On all your devices. Callers are not told.</small></span></label>';
        h += '<div class="bell-devs"><b>Your devices</b>' + info.devices.map((d) => '<div class="lob-item bell-dev" data-dev="' + esc(d.d) + '"><div class="li-main"><span class="li-name">' + esc(d.name) + (d.me ? ' (this device)' : '') + '</span></div><button type="button" class="row-del" data-bell="rm" title="Remove" aria-label="Remove ' + esc(d.name) + '">' + DEL_ICON + '</button></div>').join('') + '</div>';
        h += '<button type="button" class="lob-ghost" data-bell="test">Send a test ring</button>';
      }
      if (said) h += '<p class="set-help" role="status" data-bell="said">' + esc(said) + '</p>';
      box.innerHTML = h; box.hidden = false;
      const q = (sel) => box.querySelector('[data-bell="' + sel + '"]');
      const sw = q('on'); if (sw) sw.onchange = () => act(sw.checked ? () => b.enable().then(() => 'This device rings now.') : () => b.disable().then(() => 'This device no longer rings.'));
      const pz = q('pause'); if (pz) pz.onchange = () => act(() => b.pause(pz.checked).then((j) => (j.paused ? 'Rings are paused.' : 'Rings are on.')));
      const ts = q('test'); if (ts) ts.onclick = () => act(() => b.test().then((j) => (j.sent ? 'Test ring sent.' : 'A test ring was sent a moment ago.')));
      box.querySelectorAll('[data-bell="rm"]').forEach((el) => { el.onclick = () => { const d = el.closest('[data-dev]').getAttribute('data-dev'); act(() => b.remove(d).then(() => 'Removed. Rings no longer reach that device.')); }; });
    }
  }
  async function refresh() {
    const b = B(); if (!b || !b.on()) { info = null; paint(); return; }
    try { info = await b.devices(); } catch (e) { info = null; said = 'The doorbell could not be reached.'; }
    paint();
  }
  async function act(f) {
    if (busy) return; busy = true; said = ''; paint();
    try { said = await f(); } catch (e) { said = String((e && e.message) || e); }
    busy = false;
    await refresh();
  }

  // Rings the service worker showed that nobody answered: My Room's missed calls (its lobby repaints on the change).
  async function missedFromPushes() {
    const b = B(), M = MR(); if (!b || !M) return;
    const list = await b.takeRings().catch(() => []);
    for (const x of list.reverse()) M.noteMissed(x.r, x.v, x.label, x.at);
    if (list.length) { try { root.dispatchEvent(new root.StorageEvent('storage', { key: 'gifos_myroom_missed' })); } catch (e) {} }
  }

  function build() {
    if (!$('lob-bell')) {
      const after = $('lob-myroom') || doc.querySelector('#lobby .lob-sep');
      if (after) { const d = doc.createElement('div'); d.id = 'lob-bell'; d.className = 'lob-myroom'; d.hidden = true; after.parentNode.insertBefore(d, after.nextSibling); }
    }
    const debug = $('set-g-debug');
    if (debug && !$('set-g-bell')) {
      const s = doc.createElement('section'); s.className = 'set-group'; s.id = 'set-g-bell';
      s.innerHTML = '<h4>Doorbell</h4><div class="set-row set-wide" id="set-bell"></div>';
      debug.parentNode.insertBefore(s, debug);
    }
  }
  function start() {
    if (!B()) return;
    build();
    const here = GifOS.link ? GifOS.link.read(root.location.pathname, '', root.location.hash) : { room: '' };
    if (!here.room) missedFromPushes();
    refresh();
    // Keep the push mirror current (handles made on another tab, a timing change after an update).
    if (B().on()) { B().mirror().catch(() => {}); B().flushCuts().catch(() => {}); }   // and cuts that did not reach the Doorbell yet
    const modal = $('set-modal');
    if (modal && root.MutationObserver) new root.MutationObserver(() => { if (modal.style.display !== 'none') refresh(); }).observe(modal, { attributes: true, attributeFilter: ['style'] });
  }
  // DEBUG=on only: a test reads what the doorbell painted.
  try { if (/(?:^|[#&?])debug=(?:on|1|true)/i.test(root.location.hash + root.location.search)) root.__bellState = () => ({ on: !!(B() && B().on()), info, said, held: B() ? B().held().length : 0, handles: B() ? B().handles().length : 0 }); } catch (e) {}
  const go = () => { try { start(); } catch (e) { try { console.error('doorbell view: ' + String(e && e.stack || e)); } catch (x) {} } };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
})(typeof window !== 'undefined' ? window : globalThis);
