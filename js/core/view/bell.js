/*
 * GifOS Core: the Doorbell's view (meet.html). Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * Paints the one ringing setting, in two places with one painter: a block in the Rooms app (rooms.html, #rooms-bell,
 * under Ringing), and a "Ringing" group in the meeting's Settings.
 *   "Ring me on this device"   the one switch (js/ring-standby.js picks the way: the Doorbell where this browser can
 *                               ring with GifOS closed, else standing by while GifOS is open), and the real status
 *   Test ring                   the Doorbell's test push, or a ring shown here while standing by
 *   Pause rings                 the owner's switch at the Doorbell (all devices; shown with the Doorbell on)
 *   Your devices                every device the Doorbell rings for you, with Remove (the lost-device button)
 * Where no room is open (the meeting lobby, the Rooms app) it also turns rings this device's service worker showed and
 * nobody answered into missed calls (My Room's own list).
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
  const boxes = () => [$('rooms-bell'), $('set-bell')].filter(Boolean);
  let info = null, said = '', busy = false;

  // ONE SETTING: "Ring me on this device" (js/ring-standby.js picks the way: the Doorbell, or standing by while GifOS
  // is open), with this device's real ringing status in plain words under it.
  const R = () => GifOS.ringHere;
  function paint() {
    const b = B(), r = R(); if (!b) return;
    for (const box of boxes()) {
      let h = '';
      const st = r ? r.status() : { mode: b.on() ? 'push' : 'off', text: '', more: '' }, isOn = st.mode !== 'off';
      h += '<label class="rec-opt"><input type="checkbox" role="switch" data-bell="on"' + (isOn ? ' checked' : '') + (busy || !r ? ' disabled' : '') + '><span><b>Ring me on this device</b> <small class="set-scope" data-scope="device">This device only</small><small>Calls from your contacts ring here. The ring is end-to-end encrypted: nobody between you and the caller can read who is calling.</small></span></label>';
      h += '<p class="set-help bell-status" data-bell="status" data-mode="' + esc(st.mode) + '"><b>' + esc(st.text) + '</b>' + (st.more ? ' ' + esc(st.more) : '') + '</p>';
      if (st.canPush) h += '<button type="button" class="lob-ghost" data-bell="push">Also ring when GifOS is closed</button>';
      if (isOn) h += '<button type="button" class="lob-ghost" data-bell="test">Test ring</button>';
      if (b.on() && info) {
        h += '<label class="rec-opt"><input type="checkbox" role="switch" data-bell="pause"' + (info.paused ? ' checked' : '') + '><span><b>Pause rings</b> <small class="set-scope" data-scope="you">Follows you</small><small>On all your devices. Callers are not told.</small></span></label>';
        h += '<div class="bell-devs"><b>Your devices</b>' + info.devices.map((d) => '<div class="lob-item bell-dev" data-dev="' + esc(d.d) + '"><div class="li-main"><span class="li-name">' + esc(d.name) + (d.me ? ' (this device)' : '') + '</span></div><button type="button" class="row-del" data-bell="rm" title="Remove" aria-label="Remove ' + esc(d.name) + '">' + DEL_ICON + '</button></div>').join('') + '</div>';
      }
      if (said) h += '<p class="set-help" role="status" data-bell="said">' + esc(said) + '</p>';
      box.innerHTML = h; box.hidden = false;
      const q = (sel) => box.querySelector('[data-bell="' + sel + '"]');
      const sw = q('on'); if (sw && r) sw.onchange = () => act(() => r.set(sw.checked));
      const ps = q('push'); if (ps) ps.onclick = () => act(() => b.enable().then(() => ''));
      const pz = q('pause'); if (pz) pz.onchange = () => act(() => b.pause(pz.checked).then((j) => (j.paused ? 'Rings are paused.' : 'Rings are on.')));
      const ts = q('test'); if (ts && r) ts.onclick = () => act(() => r.test());
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
    for (const x of list.reverse()) { let at = null; try { at = GifOS.link.read('/meet', '', new URL(x.url, root.location.origin).hash); } catch (e) { at = null; } if (at && at.room) M.noteMissed(at.room, at.v, x.label, x.at); }
    if (list.length) { try { root.dispatchEvent(new root.StorageEvent('storage', { key: 'gifos_myroom_missed' })); } catch (e) {} }
  }

  function build() {
    const debug = $('set-g-debug');
    if (debug && !$('set-g-bell')) {
      const s = doc.createElement('section'); s.className = 'set-group'; s.id = 'set-g-bell';
      s.innerHTML = '<h4>Ringing</h4><div class="set-row set-wide" id="set-bell"></div>';
      debug.parentNode.insertBefore(s, debug);
    }
  }
  function start() {
    if (!B()) return;
    GifOS.bellView = { paint, refresh };   // the Rooms app repaints its list and puts #rooms-bell back: it paints again
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
