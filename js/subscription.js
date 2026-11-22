/*
 * subscription.js — the /subscription page: every GifOS Meet plan, the one this browser holds, and the way up.
 *
 * Names, prices, periods and what each plan grants come from the one catalog (js/gifos-sub.js TIERS, PASS_PRESETS,
 * FREE_PLAN, NEGOTIATED); the words around them from i18n/<locale>/subscription.json. What this browser holds is read
 * exactly as the meeting's Settings reads it (GifOS.meetSubs.credentialsNow: the subscription file's license and
 * passes). Buying goes through the same path as Settings (GifOS.meetSubs.subscribe / buyPass), so a bigger plan
 * bought here replaces the held one by the upgrade rule said on the page (meet-subs.js cancelReplaced).
 */
(function () {
  'use strict';
  var GifOS = window.GifOS = window.GifOS || {};
  var i18n = GifOS.i18n;
  var SUB = GifOS.sub;
  var MS = function () { return GifOS.meetSubs; };
  var $ = function (id) { return document.getElementById(id); };
  var t = function (k, p) { return i18n ? i18n.t('subscription.' + k, p) : k; };
  var busy = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function say(text) { var s = $('say'); s.textContent = text || ''; s.hidden = !text; }
  var clock = function (sec) { try { return i18n.fmt.time(new Date(sec * 1000), { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
  var day = function (sec) { try { return i18n.fmt.date(new Date(sec * 1000)); } catch (e) { return ''; } };

  // The order of the rows: smallest to largest. Each row: its id, the catalog row it reads, and how it is bought.
  function rows() {
    var out = [{ id: 'free', row: SUB.FREE_PLAN, kind: 'free' }, { id: 'pass', row: SUB.PASS_PRESETS.pass4h, kind: 'pass' }];
    SUB.TIER_IDS.forEach(function (id) { out.push({ id: id, row: SUB.TIERS[id], kind: SUB.TIERS[id].sale === 'paypal' ? (SUB.tiersSoldIn('meet').indexOf(id) >= 0 ? 'paypal' : 'broadcast') : 'invoice' }); });
    out.push({ id: 'negotiated', row: SUB.NEGOTIATED, kind: 'contact' });
    return out;
  }
  // covers(h, a): line items h give at least everything line items a give (no people line beats any line). A plan the
  // held one covers is included; a plan that covers the held one (and is not it) is an upgrade; any other is a change.
  var big = function (v) { return v === null ? Infinity : v; };
  function covers(h, a) {
    if (!a) return true;
    if (!h) return false;
    return big(h.roomLimit) >= big(a.roomLimit) && h.turnVideoLinks >= a.turnVideoLinks && h.meetings >= a.meetings
      && (h.admitAtFullDoor || !a.admitAtFullDoor) && (h.captureOpenRoom || !a.captureOpenRoom) && (h.storage || !a.storage);
  }
  var grantsOf = function (id) { return SUB.TIERS[id] ? SUB.TIERS[id].grants : null; };

  function priceLine(r) {
    if (r.kind === 'free') return t('priceFree');
    if (r.kind === 'pass') return t('priceOnce', { price: r.row.price });
    if (r.kind === 'contact') return t('priceNegotiated');
    var parts = [];
    if (r.row.price && r.row.periods.indexOf('monthly') >= 0) parts.push(t('perMonth', { price: r.row.price }));
    if (r.row.priceYear && r.row.periods.indexOf('yearly') >= 0) parts.push(t('perYear', { price: r.row.priceYear }));
    return parts.join(' · ');
  }

  function buyButton(label, onclick, go) {
    var b = el('button', go ? 'go' : '', label);
    b.type = 'button';
    b.addEventListener('click', function () {
      if (busy) return;
      busy = true;
      document.querySelectorAll('#plans button').forEach(function (x) { x.disabled = true; });
      say(t('opening'));
      Promise.resolve().then(onclick).then(function (msg) { say(msg); }, function (e) { say(String((e && e.message) || e)); })
        .then(function () { busy = false; return paint(); });
    });
    return b;
  }
  function subscribeTo(id, period) {
    return MS().subscribe(id, period, say).then(function (r) {
      return r && r.licenseJson ? t('thanks') : r && r.status === 'APPROVAL_PENDING' ? SUB.TEXT.pending : t('notConfirmed');
    });
  }

  function paint() {
    return MS().credentialsNow().catch(function () { return { sub: null, passes: [], now: { why: 'none' } }; }).then(function (c) {
      var subTier = c.sub && c.sub.tier && SUB.TIERS[c.sub.tier] ? c.sub.tier : null;
      // A live pass: the four-hour pass (plan unlimited), or a pass minted for a plan (Enterprise by invoice).
      var pass = c.now && c.now.why === 'pass' ? c.now : null;
      var passRow = pass ? (pass.tier && pass.tier !== 'unlimited' && SUB.TIERS[pass.tier] ? pass.tier : 'pass') : null;
      // What the held plans give (a pass minted for a plan counts; the four-hour pass is never replaced, so not here).
      var heldPlans = [subTier, passRow && passRow !== 'pass' ? passRow : null].filter(Boolean);
      var held = $('held');
      held.textContent = '';
      if (subTier) held.appendChild(document.createTextNode(t(c.sub.status === 'cancelled' ? 'heldSubEnds' : 'heldSub', { plan: t(subTier + '.name'), until: day(c.sub.until) })));
      else if (!passRow) held.appendChild(document.createTextNode(t('heldNone')));
      if (passRow) {
        held.appendChild(document.createTextNode((subTier ? ' ' : '') + (passRow === 'pass'
          ? (isFinite(pass.until) ? t('heldPass', { until: clock(pass.until) }) : t('heldPassNever'))
          : t('heldSub', { plan: t(passRow + '.name'), until: isFinite(pass.until) ? day(pass.until) : '' }))));
      }

      var list = $('plans');
      list.textContent = '';
      rows().forEach(function (r) {
        var isHeld = r.id === subTier || r.id === passRow || (r.id === 'free' && !subTier && !passRow);
        var li = el('li', 'plan' + (isHeld ? ' held' : ''));
        li.dataset.plan = r.id;
        if (isHeld) li.setAttribute('aria-current', 'true');
        var what = el('div', 'what');
        var h = el('h2', null, t(r.id + '.name'));
        if (isHeld) h.appendChild(el('span', 'badge', r.id === passRow && r.id === 'pass' ? t('onNow') : t('current')));
        what.appendChild(h);
        what.appendChild(el('p', 'quiet', t(r.id + '.desc')));
        what.appendChild(el('p', 'price', priceLine(r)));
        li.appendChild(what);
        var acts = el('div', 'acts');
        var included = SUB.TIERS[r.id] && heldPlans.some(function (h) { return covers(grantsOf(h), grantsOf(r.id)); });
        var above = SUB.TIERS[r.id] && !included;
        var upward = heldPlans.length && heldPlans.every(function (h) { return covers(grantsOf(r.id), grantsOf(h)); });
        if (r.kind === 'paypal' && !isHeld) {
          if (above) r.row.periods.forEach(function (per) {
            var label = (!heldPlans.length ? t('subscribe') : upward ? t('upgrade') : t('change')) + ': ' + (per === 'yearly' ? t('perYear', { price: r.row.priceYear }) : t('perMonth', { price: r.row.price }));
            acts.appendChild(buyButton(label, function () { return subscribeTo(r.id, per); }, per === r.row.periods[r.row.periods.length - 1]));
          });
          else acts.appendChild(el('span', 'quiet', t('included')));
        } else if (r.kind === 'pass' && !isHeld) {
          acts.appendChild(buyButton(t('buyPass', { price: r.row.price }), function () {
            return MS().buyPass(say).then(function (x) { return x && x.passJson ? t('passThanks') : t('notConfirmed'); });
          }));
        } else if (r.kind === 'broadcast' && !isHeld) {
          var a = el('a', 'btn', t('broadcast')); a.href = '/cast'; a.target = '_blank'; a.rel = 'noopener';
          acts.appendChild(a);
        } else if ((r.kind === 'invoice' || r.kind === 'contact') && !isHeld) {
          var m = el('a', 'btn', t(r.kind === 'invoice' ? 'invoice' : 'contact'));
          m.href = 'mailto:' + SUB.NEGOTIATED.contact + '?subject=' + encodeURIComponent('GifOS ' + t(r.id + '.name'));
          acts.appendChild(m);
        }
        li.appendChild(acts);
        list.appendChild(li);
      });
    });
  }

  function legal() {
    var p = $('legal');
    p.textContent = '';
    var a = function (href, text) { var x = el('a', null, text); x.href = href; x.target = '_blank'; x.rel = 'noopener'; return x; };
    p.appendChild(document.createTextNode(t('agreePre')));
    p.appendChild(a('/terms/meet', t('terms')));
    p.appendChild(document.createTextNode(t('and')));
    p.appendChild(a('/privacy/meet', t('privacy')));
    p.appendChild(document.createTextNode('. ' + t('charges')));
  }

  function start() {
    document.title = t('titleTab');
    document.querySelectorAll('[data-t]').forEach(function (n) { n.textContent = i18n.t(n.getAttribute('data-t')); });
    legal();
    paint().catch(function (e) { say(String((e && e.message) || e)); });
  }
  function boot() {
    if (!i18n || !SUB || !MS()) return;
    i18n.load('subscription').then(start, start);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
