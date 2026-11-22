/*
 * subscription.js — the /subscription page: every GifOS Meet plan, the one this browser holds, and the way up.
 *
 * Names, prices, periods and what each plan grants come from the one catalog (js/gifos-sub.js TIERS, PASS_PRESETS,
 * FREE_PLAN, NEGOTIATED); the words around them from i18n/<locale>/subscription.json. What this browser holds is read
 * exactly as the meeting's Settings reads it (GifOS.meetSubs.credentialsNow: the subscription file's license and
 * passes). Buying goes through the same path as Settings (GifOS.meetSubs.subscribe / buyPass): a bigger plan bought
 * here is an upgrade (GifOS.sub.upgradeOk) whose first charge carries the pay Worker's prorated credit.
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

  // The order of the rows: smallest to largest, then the add-ons. Each row: its id, the catalog row it reads, and how
  // it is bought.
  function rows() {
    var out = [{ id: 'free', row: SUB.FREE_PLAN, kind: 'free' }, { id: 'pass', row: SUB.PASS_PRESETS.pass4h, kind: 'pass' }];
    SUB.TIER_IDS.forEach(function (id) { out.push({ id: id, row: SUB.TIERS[id], kind: SUB.tiersSoldIn('meet').indexOf(id) >= 0 ? 'paypal' : 'broadcast' }); });
    out.push({ id: 'negotiated', row: SUB.NEGOTIATED, kind: 'contact' });
    Object.keys(SUB.ADDONS).forEach(function (id) { out.push({ id: id, row: SUB.ADDONS[id], kind: 'addon' }); });
    return out;
  }
  var grantsOf = function (id) { return SUB.TIERS[id] ? SUB.TIERS[id].grants : null; };
  var periodPrice = function (row, per) {
    return per === 'yearly' ? t('perYear', { price: row.priceYear }) : per === 'monthly12' ? t('perMonth12', { price: row.price, year: row.priceYear }) : t('perMonth', { price: row.price });
  };

  function priceLine(r) {
    if (r.kind === 'free') return t('priceFree');
    if (r.kind === 'pass') return t('priceOnce', { price: r.row.price });
    if (r.kind === 'contact') return t('priceNegotiated');
    if (r.kind === 'addon') return t('perMonth', { price: r.row.price });
    return r.row.periods.map(function (per) { return periodPrice(r.row, per); }).join(' · ');
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
      var from = subTier ? { tier: subTier, period: c.sub.period || 'monthly' } : null;
      // A cancelled plan is not replaced: a new plan is simply bought (it runs out by itself).
      var replaceable = !!(from && c.sub.status !== 'cancelled');
      // A live pass: the four-hour pass (plan unlimited), or a pass minted with a plan's line items.
      var pass = c.now && c.now.why === 'pass' ? c.now : null;
      var passRow = pass ? (pass.tier && pass.tier !== 'unlimited' && SUB.TIERS[pass.tier] ? pass.tier : 'pass') : null;
      // What the held plans give (the four-hour pass is never replaced, so not here).
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
      var nowS = Math.floor(Date.now() / 1000);

      var list = $('plans');
      list.textContent = '';
      rows().forEach(function (r) {
        var isHeld = r.id === subTier || r.id === passRow || (r.id === 'free' && !subTier && !passRow);
        var li = el('li', 'plan' + (isHeld ? ' held' : '') + (r.kind === 'addon' ? ' addon' : ''));
        li.dataset.plan = r.id;
        if (isHeld) li.setAttribute('aria-current', 'true');
        var what = el('div', 'what');
        var h = el('h2', null, t(r.id + '.name'));
        if (isHeld) h.appendChild(el('span', 'badge', r.id === passRow && r.id === 'pass' ? t('onNow') : t('current')));
        if (r.kind === 'addon' && r.row.soon) h.appendChild(el('span', 'badge soon', t('soon')));
        what.appendChild(h);
        what.appendChild(el('p', 'quiet', t(r.id + '.desc')));
        what.appendChild(el('p', 'price', priceLine(r)));
        li.appendChild(what);
        var acts = el('div', 'acts');
        var included = SUB.TIERS[r.id] && heldPlans.some(function (hp) { return SUB.covers(grantsOf(hp), grantsOf(r.id)); });
        if (r.kind === 'paypal' && !isHeld) {
          // Each period this plan is sold in: bought outright with nothing replaceable held, else only as an upgrade
          // (GifOS.sub.upgradeOk), with its smaller first charge shown.
          var offered = 0;
          r.row.periods.forEach(function (per) {
            var to = { tier: r.id, period: per };
            var label;
            if (!replaceable) { if (included) return; label = t('subscribe') + ': ' + periodPrice(r.row, per); }
            else if (SUB.upgradeOk(from, to)) {
              var ch = SUB.upgradeCharge(from, to, c.sub.renews || c.sub.until, nowS);
              label = t('upgrade') + ': ' + periodPrice(r.row, per) + ' ' + t('firstCharge', { first: SUB.usd(ch.first) });
            } else return;
            offered++;
            acts.appendChild(buyButton(label, function () { return subscribeTo(r.id, per); }, per === r.row.periods[r.row.periods.length - 1]));
          });
          if (!offered) acts.appendChild(el('span', 'quiet', included ? t('included') : t('notUpgrade')));
        } else if (r.kind === 'pass' && !isHeld) {
          acts.appendChild(buyButton(t('buyPass', { price: r.row.price }), function () {
            return MS().buyPass(say).then(function (x) { return x && x.passJson ? t('passThanks') : t('notConfirmed'); });
          }));
        } else if (r.kind === 'broadcast' && !isHeld) {
          var a = el('a', 'btn', t('broadcast')); a.href = '/cast'; a.target = '_blank'; a.rel = 'noopener';
          acts.appendChild(a);
        } else if (r.kind === 'contact') {
          var m = el('a', 'btn', t('contact'));
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
