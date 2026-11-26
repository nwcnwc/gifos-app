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
  // #move= and #restore= carry a secret. Drop the fragment before any await so it leaves the address bar.
  var arrival = { move: '', restore: '', scroll: '' };
  try {
    var hashNow = String(location.hash || '');
    var hashMove = /^#move=(.+)$/.exec(hashNow);
    var hashRestore = /^#restore=(.+)$/.exec(hashNow);
    if (hashMove || hashRestore) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e1) {}
      if (hashMove) arrival.move = safeDecode(hashMove[1]);
      if (hashRestore) arrival.restore = safeDecode(hashRestore[1]);
    } else if (hashNow === '#move' || hashNow === '#restore' || hashNow === '#get') arrival.scroll = hashNow.slice(1);
  } catch (e2) {}
  function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function PM() { return GifOS.planMove || null; }

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
    // The license first (as Settings does): the page's boot may still be fetching it, and the held plan is read from it.
    return MS().keepFresh().catch(function () {}).then(function () { return MS().credentialsNow(); }).catch(function () { return { sub: null, passes: [], now: { why: 'none' } }; }).then(function (c) {
      var subTier = c.sub && c.sub.tier && SUB.TIERS[c.sub.tier] ? c.sub.tier : null;
      var from = subTier ? { tier: subTier, period: c.sub.period || 'monthly' } : null;
      // A cancelled plan is not replaced: a new plan is simply bought (it runs out by itself).
      var replaceable = !!(from && c.sub.status !== 'cancelled');
      // A live pass: the four-hour pass (plan unlimited), or a pass minted with a plan's line items.
      var pass = c.now && c.now.why === 'pass' ? c.now : null;
      // Its row: the plan it names when it carries exactly that plan's line items (the name is only the row to show;
      // the line items decide), else the pass row (the four-hour pass, or any other mix).
      var same = function (a, b) { return !!a && !!b && SUB.covers(a, b) && SUB.covers(b, a); };
      var passRow = pass ? (SUB.TIERS[pass.tier] && same(pass.passGrants, grantsOf(pass.tier)) ? pass.tier : 'pass') : null;
      // What the held plans give (the four-hour pass is never replaced, so not here).
      // What is held, as signed line items (the subscription's license, the live pass): what "included" reads.
      var heldGrants = [c.sub && c.sub.grants, pass && pass.passGrants].filter(Boolean);
      // The "Your plan" card: the plan's name, what it gives, and when it renews or ends. With nothing held it is one
      // line (you have Free) and the plans follow at once.
      var held = $('held');
      held.textContent = '';
      var parts = [];
      if (subTier) {
        parts.push(c.sub.status === 'cancelled' ? t('ypEnds', { until: day(c.sub.until) })
          : c.sub.renews ? t('ypRenews', { until: day(c.sub.renews) }) : t('ypUntil', { until: day(c.sub.until) }));
      }
      if (passRow) {
        parts.push(passRow === 'pass'
          ? (isFinite(pass.until) ? t('heldPass', { until: clock(pass.until) }) : t('heldPassNever'))
          : (isFinite(pass.until) ? t('ypUntil', { until: day(pass.until) }) : t('heldPassNever')));
      }
      if (!parts.length) parts.push(t('heldNone'));
      held.textContent = parts.join(' ');
      var anyHeld = !!(subTier || passRow);
      var names = [subTier, passRow !== subTier ? passRow : null].filter(Boolean);
      var yours = $('yours');
      if (yours) yours.className = 'yours' + (anyHeld ? '' : ' none');
      var ypName = $('yp-name');
      if (ypName) { ypName.textContent = names.map(function (id) { return t(id + '.name'); }).join(' + '); ypName.hidden = !anyHeld; }
      var ypWhat = $('yp-what');
      if (ypWhat) { ypWhat.textContent = anyHeld ? t(names[0] + '.desc') + (names[0] === 'free' ? ' ' + t('free.desc2') : '') : ''; ypWhat.hidden = !anyHeld; }
      show('yp-kicker', anyHeld);
      show('held-get-line', !anyHeld);
      var nowS = Math.floor(Date.now() / 1000);

      // Three groups, by line items: plans for one meeting at a time (cards), plans for many meetings at once, add-ons.
      var host = $('plans');
      host.textContent = '';
      var lists = {};
      ['one', 'many', 'addon'].forEach(function (g) {
        if (g !== 'one') { var gh = el('h2', 'group', t(g === 'many' ? 'groupMany' : 'groupAddons')); host.appendChild(gh); }
        lists[g] = el('ul', 'plans ' + g);
        host.appendChild(lists[g]);
      });
      var groupOf = function (r) {
        if (r.kind === 'addon') return 'addon';
        if (r.kind === 'contact') return 'many';
        var g = grantsOf(r.id);
        return g && (g.meetings || 1) > 1 ? 'many' : 'one';
      };
      rows().forEach(function (r) {
        var list = lists[groupOf(r)];
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
        if (r.id === 'free') what.appendChild(el('p', 'quiet', t('free.desc2')));
        // The price: one line per period (a card stacks them; a row keeps them on one line).
        var price = el('p', 'price');
        if (r.row && r.row.periods && (r.kind === 'paypal' || r.kind === 'broadcast')) {
          r.row.periods.forEach(function (per, i) {
            if (i) price.appendChild(el('span', 'sep', ' · '));
            price.appendChild(el('span', 'per', periodPrice(r.row, per)));
          });
        } else price.textContent = priceLine(r);
        what.appendChild(price);
        li.appendChild(what);
        var acts = el('div', 'acts');
        var included = SUB.TIERS[r.id] && heldGrants.some(function (hg) { return SUB.covers(hg, grantsOf(r.id)); });
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
      return Promise.resolve(paintYour(c)).then(function () { try { paintReceipt(c); } catch (e) {} });
    });
  }
  // The same slip as a receipt GIF (js/receipt-plan.js), from the files this
  // browser already holds. Nothing here calls the payment service.
  // Every receipt this browser holds (meetSubs.receiptSets): one per plan that was paid for, newest first, with the
  // passes; a checkout started and never paid has none.
  function receiptSets() {
    try { return (MS().receiptSets && MS().receiptSets()) || []; } catch (e) { return []; }
  }
  // A checkout started here and never paid: a plain note, never a receipt. When it had replaced a bought plan in this
  // browser (earlier pages saved the checkout over it) and that plan is not back, say how to get it back.
  function paintPending(host, c) {
    var p = MS().pendingCheckout ? MS().pendingCheckout() : null;
    if (!p) return false;
    var box = el('div', 'pm-pending');
    box.id = 'pm-pending';
    box.appendChild(el('p', null, t('pendingNote')));
    if (p.lost && !(c && c.sub)) box.appendChild(el('p', 'note', t('pendingLost')));
    var row = el('div', 'row');
    var go = el('button', 'go', t('pendingContinue'));
    go.type = 'button';
    go.id = 'pm-pending-continue';
    go.addEventListener('click', function () {
      if (busy) return;
      busy = true;
      say(t('opening'));
      MS().continueCheckout(say).then(function (r) {
        return r && r.licenseJson ? t('thanks') : r && r.status === 'APPROVAL_PENDING' ? SUB.TEXT.pending : t('notConfirmed');
      }).then(say, function (e) { say(String((e && e.message) || e)); }).then(function () { busy = false; return paint(); });
    });
    var no = el('button', null, t('pendingDismiss'));
    no.type = 'button';
    no.id = 'pm-pending-dismiss';
    no.addEventListener('click', function () {
      if (busy) return;
      busy = true;
      MS().dismissPending().then(function (r) { say(r && r.licenseJson ? t('thanks') : ''); }, function () {}).then(function () { busy = false; return paint(); });
    });
    row.appendChild(go);
    row.appendChild(no);
    box.appendChild(row);
    host.appendChild(box);
    return true;
  }
  function paintReceipt(c) {
    var host = $('pm-receipt');
    if (!host) return;
    host.textContent = '';
    host.hidden = true;
    try { if (paintPending(host, c)) host.hidden = false; } catch (e0) {}
    var plan = GifOS.receiptPlan;
    if (!plan || typeof plan.rows !== 'function' || typeof plan.mount !== 'function') return;
    var shown = 0;
    receiptSets().forEach(function (set) {
      var list = [];
      try { list = plan.rows(set.files) || []; } catch (e2) { return; }
      if (!list.length) return;
      if (!shown) host.appendChild(el('h3', null, t('pmReceipt')));
      try { plan.mount(host, list, { files: set.files }); } catch (e3) { return; }
      // One slip per plan: the first keeps the slip's id, the later ones are numbered.
      try { var last = host.lastChild; if (shown && last && last.id === 'pm-slip') last.id = 'pm-slip-' + shown; } catch (e5) {}
      shown++;
    });
    if (!shown) return;
    host.hidden = false;
    try { if (typeof plan.foot === 'function') plan.foot(host); } catch (e4) {}
  }

  function show(id, on) { var n = $(id); if (n) n.hidden = !on; }
  function planLabel(tier) { return tier && SUB.TIERS[tier] ? t(tier + '.name') : (tier || ''); }
  function paintMeetings(h) {
    var ul = $('pm-meetings-list');
    if (!ul) return;
    ul.textContent = '';
    var list = (h && h.meetings) || [];
    if (!list.length) { ul.appendChild(el('li', null, t('pmMeetingsNone'))); return; }
    list.forEach(function (m) { ul.appendChild(el('li', null, m.name || t('pmElsewhere'))); });
  }
  function paintYour(c) {
    var held = !!(c && c.sub);
    var paypal = held && /^I-/.test(String(c.sub.subId || '')) && c.sub.status !== 'cancelled';
    show('pm-meetings', held);
    show('pm-file-get', held);
    show('pm-move', held && !arrival.move);
    show('pm-pay', paypal);
    show('pm-signout-wrap', held);
    show('sec-cancel', held);
    show('yp-change', held);
    if (!held || !MS().heldMeetings) { paintMeetings(null); return; }
    return MS().heldMeetings().then(paintMeetings, function () { paintMeetings(null); });
  }
  function setMove(msg) { var n = $('pm-move-status'); if (n) n.textContent = msg || ''; }
  function hideQr() { var q = $('pm-qr'); if (q) { q.hidden = true; q.textContent = ''; } }
  function drawQr(text) {
    var box = $('pm-qr');
    if (!box) return;
    box.hidden = false;
    try {
      if (typeof qrcode !== 'function') return;
      var q = qrcode(0, 'M');
      q.addData(text);
      q.make();
      box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (e) {}
  }
  var send = null;
  function endSend(msg) {
    if (send) {
      if (send.timer) clearTimeout(send.timer);
      var box = send.box;
      send.dead = true;
      send = null;
      var P = PM();
      if (box && P) P.closeBox(box).catch(function () {});
    }
    hideQr();
    var live = $('pm-move-live');
    if (live) live.hidden = true;
    if (msg) setMove(msg);
  }
  function beginSend() {
    var P = PM();
    if (!P || !crypto || !crypto.getRandomValues) return;
    if (send) endSend('');
    var chan = crypto.getRandomValues(new Uint8Array(16));
    var K = crypto.getRandomValues(new Uint8Array(32));
    return P.boxId(chan).then(function (box) {
      var origin = '';
      try { origin = location.origin; } catch (e) {}
      var url = P.link(origin, chan, K);
      var live = $('pm-move-live');
      if (live) live.hidden = false;
      var link = $('pm-link');
      if (link) link.textContent = url;
      drawQr(url);
      send = { chan: chan, K: K, box: box, expect: null, pub: null, typed: '', dead: false, tried: false, timer: null };
      send.timer = setTimeout(function () { endSend(t('pmExpired')); }, P.LIFE_MS);
      return P.openBox(box);
    }).then(function (r) {
      if (!send) return;
      if (!r || !r.ok) { endSend(t('pmFailed')); return; }
      setMove(t('pmWaiting'));
      var s = send;
      return P.getUntil(s.box, 'hello', Date.now() + P.LIFE_MS, function () { return send === s && !s.dead; }).then(function (ct) {
        return P.openHello(s.K, s.chan, s.box, ct).then(function (pub) {
          return P.codeOf(s.K, s.chan, pub).then(function (code) { return { pub: pub, code: code }; });
        });
      }).then(function (got) {
        if (send !== s) return;
        s.expect = got.code;
        s.pub = got.pub;
        if (s.typed) submitCode(s.typed);
      }, function () { if (send === s) endSend(t('pmExpired')); });
    }, function () { endSend(t('pmFailed')); });
  }
  function submitCode(raw) {
    var digits = String(raw || '').replace(/\D/g, '').slice(0, 6);
    var input = $('pm-code');
    if (input && input.value !== digits) input.value = digits;
    if (!send || digits.length < 6) return;
    if (!send.expect) { send.typed = digits; setMove(t('pmWaiting')); return; }
    if (send.tried) return;
    send.tried = true;
    if (digits !== send.expect) { endSend(t('pmCodeBad')); return; }
    var s = send;
    var P = PM();
    setMove(t('pmWorking'));
    MS().movePackage().then(function (pkg) { return P.sealPkg(s.K, s.chan, s.box, s.pub, pkg); }).then(function (ct) {
      return P.put('pkg', s.box, ct);
    }).then(function (r) {
      if (!r || !r.ok) throw new Error((r && r.body && r.body.error) || t('pmFailed'));
      if (s.timer) clearTimeout(s.timer);
      if (send === s) send = null;
      hideQr();
      setMove(t('pmSent'));
    }, function (e) { if (send === s) endSend(t('pmFailed')); say(String((e && e.message) || e)); });
  }
  function copyLink() {
    var text = ($('pm-link') && $('pm-link').textContent) || '';
    var done = function () { setMove(t('pmCopied')); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, done); return; }
    } catch (e) {}
    done();
  }
  function putHello(P, box, ct) {
    var until = Date.now() + P.LIFE_MS;
    function once() {
      return P.put('hello', box, ct).then(function (r) {
        if (r && r.ok) return;
        // Another device answered this code first: never show or use a code for it (the holder would see a mismatch anyway).
        if (r && (r.status === 409 || r.status === 410)) { var big = $('pm-recv-code'); if (big) big.textContent = ''; throw new Error(t('pmUsed')); }
        if (Date.now() >= until) throw new Error(t('pmExpired'));
        return new Promise(function (res) { setTimeout(res, GifOS.timings.MOVE_HELLO_RETRY_MS); }).then(once);
      });
    }
    return once();
  }
  function liveId() {
    if (!MS().credentialsNow) return Promise.resolve(null);
    return MS().credentialsNow().then(function (c) { return c && c.sub && c.sub.subId ? c.sub.subId : null; }, function () { return null; });
  }
  function askReplace() {
    return new Promise(function (resolve) {
      var box = $('pm-replace');
      if (!box) return resolve(true);
      box.hidden = false;
      var yes = $('pm-replace-yes'), no = $('pm-replace-no');
      var done = function (v) { box.hidden = true; resolve(v); };
      if (yes) yes.onclick = function () { done(true); };
      if (no) no.onclick = function () { done(false); };
    });
  }
  function maybeInstall(pkg) {
    var cred = pkg && pkg.credential;
    if (!cred) return Promise.reject(new Error(t('pmFailed')));
    return liveId().then(function (id) {
      if (id && cred.subId && id !== cred.subId) return askReplace();
      return true;
    }).then(function (go) {
      if (!go) return false;
      return MS().installCreds(cred, pkg.wallet || null).then(function () { return true; });
    });
  }
  function beginReceive(token) {
    var P = PM();
    if (!P) return;
    var parsed = P.parseMove(token);
    var recv = $('pm-recv');
    if (recv) recv.hidden = false;
    var status = function (msg) { var n = $('pm-recv-status'); if (n) n.textContent = msg || ''; };
    if (!parsed) { status(t('pmFailed')); return; }
    status(t('pmWaiting'));
    return P.boxId(parsed.chan).then(function (box) {
      return P.ecdh().then(function (eB) {
        return P.codeOf(parsed.K, parsed.chan, eB.pub).then(function (code) {
          // The code shows only once this device holds the box's hello: a used or expired link never shows one.
          return P.sealHello(parsed.K, parsed.chan, box, eB.pub).then(function (ct) { return putHello(P, box, ct); }).then(function () {
            var big = $('pm-recv-code');
            if (big) big.textContent = code;
            return P.getUntil(box, 'pkg', Date.now() + P.LIFE_MS);
          }).then(function (ct) { return P.openPkg(parsed.K, parsed.chan, box, eB.privateKey, ct); }).then(maybeInstall);
        });
      });
    }).then(function (installed) { if (installed) status(t('pmRecvDone')); }, function (e) {
      var big = $('pm-recv-code'); if (big) big.textContent = '';
      status(e && e.used ? t('pmUsed') : e && (e.expired || e.gone) ? t('pmExpired') : (String((e && e.message) || e) || t('pmFailed')));
    });
  }
  function showRestore(grant) {
    var P = PM();
    if (!P) return;
    var g;
    try { g = P.decodeGrant(grant); } catch (e) { say(t('pmFailed')); return; }
    var ask = $('pm-restore-ask');
    if (ask) ask.hidden = false;
    var subs = g.subs || [];
    // One PayPal account can hold several plans, even two of the same plan: each button names its own plan, and two
    // that read the same also name their PayPal subscription id (what PayPal itself shows), so no two buttons read alike.
    var names = subs.map(function (s) { return planLabel(s.tier); });
    var labels = subs.map(function (s, i) {
      var same = names.filter(function (n) { return n === names[i]; }).length > 1;
      return same && s.id ? t('pmRestorePlanId', { plan: names[i], id: s.id }) : names[i];
    });
    var q = $('pm-restore-q');
    if (q) q.textContent = subs.length > 1 ? t('pmRestoreQMany', { n: subs.length }) : t('pmRestoreQ', { plan: labels.filter(Boolean).join(', ') });
    var storage = subs.some(function (s) { var row = SUB.TIERS[s.tier]; return !!(row && row.storage); });
    var lib = $('pm-restore-lib');
    if (lib) { lib.hidden = !storage; if (storage) lib.textContent = t('pmLibWarn'); }
    var acts = $('pm-restore-acts');
    var yes = $('pm-restore-yes');
    if (yes && yes.parentNode) yes.parentNode.removeChild(yes);
    if (acts) acts.textContent = '';
    subs.forEach(function (s, i) {
      var b = (i === 0 && yes) ? yes : el('button', 'go', t('pmRestoreYes'));
      b.type = 'button';
      b.id = i === 0 ? 'pm-restore-yes' : ('pm-restore-yes-' + i);
      b.hidden = false;
      b.textContent = subs.length > 1 ? t('pmRestoreUse', { plan: labels[i] }) : t('pmRestoreYes');
      b.dataset.sub = s.id || '';
      b.onclick = function () { doClaim(grant, s); };
      if (acts) acts.appendChild(b);
    });
    if (!subs.length && yes) yes.hidden = true;
    openSection('sec-restore');
  }
  function doClaim(grant, sub) {
    var P = PM();
    if (!P || !sub || !sub.id || busy) return;
    busy = true;
    say(t('pmWorking'));
    P.claim(grant, sub.id).then(function (cred) { return MS().installCreds(cred); }).then(function () {
      say(t('pmRecvDone'));
      return paint();
    }, function (e) { say(String((e && e.message) || e)); }).then(function () { busy = false; });
  }
  function scrollToId(id) { var n = $(id); if (n && n.scrollIntoView) n.scrollIntoView(); }
  // A closed section opens before it is shown.
  function openSection(id) { var n = $(id); if (!n) return; n.open = true; if (n.scrollIntoView) n.scrollIntoView(); }
  function arrive() {
    if (arrival.scroll === 'move') scrollToId('pm-move');
    else if (arrival.scroll === 'restore') openSection('sec-restore');
    else if (arrival.scroll === 'get') openSection('get');
    if (arrival.restore) showRestore(arrival.restore);
    if (arrival.move) return beginReceive(arrival.move);
  }
  var wired = false;
  function on(id, fn) { var n = $(id); if (n) n.addEventListener('click', fn); }
  function wire() {
    if (wired) return;
    wired = true;
    on('pm-file-get', function () {
      if (!MS().downloadFile) return;
      MS().downloadFile().then(function () { say(t('pmSaved')); }, function (e) { say(String((e && e.message) || e)); });
    });
    var pick = $('pm-file-use');
    if (pick) pick.addEventListener('change', function () {
      var f = pick.files && pick.files[0];
      if (!f || !MS().useFile) return;
      say(t('pmWorking'));
      f.arrayBuffer().then(function (b) { return MS().useFile(new Uint8Array(b)); }).then(function () {
        say(t('pmRecvDone'));
        return paint();
      }, function (e) { say(String((e && e.message) || e)); });
    });
    on('held-get', function (e) { if (e && e.preventDefault) e.preventDefault(); openSection('get'); });
    on('yp-change', function () { openSection('sec-cancel'); });
    on('pm-move-go', function () { var p = beginSend(); if (p && p.catch) p.catch(function (e) { endSend(t('pmFailed')); say(String((e && e.message) || e)); }); });
    on('pm-copy', copyLink);
    on('pm-code-go', function () { submitCode(($('pm-code') && $('pm-code').value) || ''); });
    var code = $('pm-code');
    if (code) code.addEventListener('input', function () { submitCode(code.value); });
    on('pm-restore', function () {
      var P = PM();
      if (!P) return;
      var subIn = $('pm-restore-sub');
      var subId = subIn ? String(subIn.value || '').trim() : '';
      if (subId && !/^I-[A-Za-z0-9]{4,40}$/.test(subId)) { say(t('pmRestoreSubBad')); return; }
      // Restoring stops the plan on every other device: ask first. Nothing is sent to PayPal until Continue.
      show('pm-restore-confirm', true);
      var go = $('pm-restore-continue');
      if (go && go.focus) go.focus();
    });
    on('pm-restore-cancel', function () { show('pm-restore-confirm', false); });
    on('pm-restore-continue', function () {
      var P2 = PM();
      if (!P2) return;
      var subIn2 = $('pm-restore-sub');
      var subId2 = subIn2 ? String(subIn2.value || '').trim() : '';
      show('pm-restore-confirm', false);
      P2.restoreStartUrl(subId2 || null).then(function (u) { location.assign(u); }, function (e) { say(String((e && e.message) || e) || t('pmFailed')); });
    });
    on('pm-cancel', function () {
      if (!MS().cancel) return;
      say(t('pmWorking'));
      MS().cancel().then(function () { say(t('pmCancelled')); return paint(); }, function (e) { say(String((e && e.message) || e)); });
    });
    on('pm-signout', function () { show('pm-signout-ask', true); });
    on('pm-signout-yes', function () {
      var P = PM();
      show('pm-signout-ask', false);
      if (!P || !MS().credential || !MS().installCreds) return;
      say(t('pmWorking'));
      MS().credential().then(function (c) { return P.rekey(c); }).then(function (cred) { return MS().installCreds(cred); }).then(function () {
        say(t('pmSignedOut'));
        return paint();
      }, function (e) { say(String((e && e.message) || e)); });
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
    wire();
    paint().then(function () { return arrive(); }).catch(function (e) { say(String((e && e.message) || e)); });
  }
  function boot() {
    if (!i18n || !SUB || !MS()) return;
    i18n.load(['subscription', 'charge']).then(start, start);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
