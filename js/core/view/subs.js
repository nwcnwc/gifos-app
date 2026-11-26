/*
 * js/core/view/subs.js — the subscription's cards (view part). Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * js/meet-subs.js holds the subscription's logic (the ledger, credentials, rights, tickets, passes, capture, door
 * proofs) and has no screen. This file is what a person sees of it: the Subscription group in Settings, the plan
 * table, the "now" line in the status bar, the full-room, move, overflow and host cards, and the lobby's link to
 * /subscription. It reads the logic only through GifOS.meetSubs, registers itself there with attachView (so the logic
 * can ask a question or announce a change without knowing a page), and adds the card entry points other code calls
 * (askMove, showOverflowNote, paintNow, paintSettings, openSettings, openSubscribe, applySubSelection, showFull,
 * hideFull, fullWaiting, showHostPrompt, hostTurned) to the same GifOS.meetSubs object.
 * Loaded by every page that has a screen, right after js/meet-subs.js.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});
  const M = GifOS.meetSubs;
  if (!M || !M.attachView) return;   // the logic did not load: nothing to draw
  const SUB = GifOS.sub;
  const NOPAGE = !!(GifOS.host && GifOS.host.page === false);
  const { tx, nowS, verifiedLicense, readState, wallet, b64, fromB64, credentialsNow, passes, keepFresh, subSelection, credential, appNow,
    cancel, buyPass, subscribe, restoreInApp, fileBytes, useFile, downloadFile, doorRight } = M;
  const rail = () => M.rail();

  // ---- what this browser holds, and what is in effect now ---------------------
  // Read from this browser's copy of the subscription file (or the one in the
  // Providers folder): each subscription with its plan, period, standing and
  // date; each pass not yet run out with its window; and the rights in effect
  // now with the reason (the best of them wins).
  const PLAN_SHORT = { room20: ['planRoom20', 'Room 20'], unlimited: ['planUnlimited', 'Unlimited'], streamer: ['planStreamer', 'Streamer'], free: ['planFree', 'Free'],
    family: ['planFamily', 'Family business'], smallBusiness: ['planSmallBusiness', 'Small business'], business: ['planBusiness', 'Business'], largeBusiness: ['planLargeBusiness', 'Large business'], enterprise: ['planEnterprise', 'Enterprise'] };
  // A plan's long name, as Settings and the plan buttons show it (the two kinds of meeting: private meetings, public open-floor meetings).
  const PLAN_NAME = { room20: 'planNameRoom20', unlimited: 'planNameUnlimited', streamer: 'planNameStreamer', free: 'planNameFree',
    family: 'planNameFamily', smallBusiness: 'planNameSmallBusiness', business: 'planNameBusiness', largeBusiness: 'planNameLargeBusiness', enterprise: 'planNameEnterprise' };
  // How many meetings at once the subscription powers, in Settings (n from the license's line items).
  const meetingsWords = (n) => (n > 1 ? fill(tx('subMeetingsN', 'Your plan works on all your devices, in up to {n} meetings at once. Joining one more takes the place of the oldest. To use it on another device, choose Copy my plan to another device on gifos.app/subscription.'), { n })
    : tx('subMeetings1', 'Your plan works on all your devices, in one meeting at a time. Joining a meeting on any of them uses it there. To use it on another device, choose Copy my plan to another device on gifos.app/subscription.'));
  const planName = (tier, t) => (PLAN_NAME[tier] ? tx(PLAN_NAME[tier], t.name) : t.name);
  const planShort = (tier) => { const x = PLAN_SHORT[tier]; return x ? tx(x[0], x[1]) : tx('planNone', 'No plan'); };
  const clockOf = (s) => { try { return new Date(s * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
  function leftOf(sec) {
    const m = Math.max(0, Math.ceil(sec / 60));
    const h = Math.floor(m / 60), mm = m % 60;
    return h ? tx('leftHM', '{h} h {m} m').replace('{h}', h).replace('{m}', mm) : tx('leftM', '{m} m').replace('{m}', mm);
  }
  const fill = (t, vars) => String(t).replace(/\{(\w+)\}/g, (x, k) => (vars[k] != null ? String(vars[k]) : x));
  // One line for the meeting's status: what is in effect, quietly.
  function nowLine(c) {
    if (c.now.why === 'pass' && !Number.isFinite(c.now.until)) return planShort(c.now.tier);
    if (c.now.why === 'pass') return fill(tx('nowPassLine', '{plan} until {until}, {left} left'), { plan: planShort(c.now.tier), until: clockOf(c.now.until), left: leftOf(c.now.until - nowS()) });
    if (c.now.why === 'sub') return planShort(c.now.tier);
    return '';
  }
  async function paintNow() {
    if (NOPAGE || typeof document === 'undefined') return;
    const status = document.getElementById('status');
    if (!status) return;
    const c = await credentialsNow();
    const line = nowLine(c);
    let el = document.getElementById('sub-now');
    if (!line) { if (el) el.hidden = true; return; }
    if (!el) {
      el = document.createElement('button'); el.type = 'button'; el.id = 'sub-now'; el.className = 'sub-now';
      el.addEventListener('click', () => openSettings());
      status.appendChild(el);
    }
    el.hidden = false;
    el.dataset.plan = c.now.tier || ''; el.dataset.why = c.now.why;
    if (el.textContent !== line) el.textContent = line;
  }
  function applySubSelection(root, sel) {
    if (!root || !sel) return sel;
    root.querySelectorAll('[aria-selected]').forEach((e) => { e.removeAttribute('aria-selected'); e.classList.remove('sub-on'); });
    const mark = (e) => { if (!e) return; e.setAttribute('aria-selected', 'true'); e.classList.add('sub-on'); };
    if (sel.free) mark(root.querySelector('[data-tier="free"]'));
    if (sel.tier && sel.period) mark(root.querySelector('button[data-tier="' + sel.tier + '"][data-period="' + sel.period + '"]'));
    if (sel.pass) { mark(root.querySelector('#sub-pass-buy')); mark(root.querySelector('tr[data-tier="pass"]')); }
    return sel;
  }
  // Queued (not yet live) passes and a pass that moved away: the table and the
  // pass button show what is on, so this does not repeat a status line.
  async function paintHeld(box, cred) {
    const c = cred || await credentialsNow();
    const p = (id, text) => { const e = el('p', { class: 'set-help', id }, text); box.appendChild(e); return e; };
    for (const x of (c.passes || [])) {
      if (x.live) continue;
      const e = x.never ? fill(tx('heldPassNever', 'Pass: {plan}, no end{capture}.'), { plan: planShort(x.plan), capture: x.capture ? tx('heldPassCaptures', ', takes charge of public open-floor meetings') : '' })
        : fill(tx('heldPassNext', 'Four-hour pass: Unlimited from {start} to {until}.'), { start: clockOf(x.start), until: clockOf(x.end) });
      const q = p('', e); q.className = 'set-help held-pass'; q.dataset.pass = x.id;
    }
    if (c.passes && c.passes.length && (M.passMeeting() || {}).moved === 'moved') p('held-pass-moved', tx('passMoved', 'Your four-hour pass is in use in another meeting now: it works in one meeting at a time.'));
  }

  // ---- Subscription dialog (#sub-modal): same window as Settings ---------------
  const BTN = 'seg';
  const BTN_STYLE = 'border:1px solid var(--border,#2a2a3f);border-radius:.4rem;margin:.2rem .4rem .2rem 0';
  function el(tag, attrs, text) { const e = document.createElement(tag); for (const k in (attrs || {})) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
  // One line near every pay button: terms and privacy open in a new tab (the app wrappers
  // route target=_blank to the system browser, as for /cast and /library). Web PayPal also
  // says whose name the charge shows under.
  function legalLine(id, inApp) {
    const p = el('p', { class: 'set-help', id });
    const a = (href, t) => { const x = el('a', { href, target: '_blank', rel: 'noopener' }, t); return x; };
    p.appendChild(document.createTextNode(tx('payAgreePre', 'By paying you agree to the ') ));
    p.appendChild(a('https://gifos.app/terms/meet', tx('payTerms', 'Terms')));
    p.appendChild(document.createTextNode(tx('payAnd', ' and ')));
    p.appendChild(a('https://gifos.app/privacy/meet', tx('payPrivacy', 'Privacy policy')));
    p.appendChild(document.createTextNode(inApp ? '' : '. '));
    if (!inApp) p.appendChild(document.createTextNode(tx('payCharges', 'Charges show as Crowd Concepts (the company behind GifOS).')));
    return p;
  }
  const dateOf = (s) => { try { return new Date(s * 1000).toLocaleDateString(); } catch (e) { return ''; } };
  // The subscription page draws the move code. A meeting must not: the code would be on a shared screen.
  function planPageLinks(row) {
    row.appendChild(el('a', { class: BTN, style: BTN_STYLE + ';display:inline-block;text-decoration:none', id: 'sub-move-link', href: '/subscription#move', target: '_blank', rel: 'noopener' }, tx('subMoveLink', 'Copy my plan to another device')));
    row.appendChild(el('a', { class: BTN, style: BTN_STYLE + ';display:inline-block;text-decoration:none', id: 'sub-restore-link', href: '/subscription#restore', target: '_blank', rel: 'noopener' }, tx('subRestoreLink', 'Restore with PayPal (lost device)')));
  }
  async function paintSettings(credNow) {
    const body = document.querySelector('#sub-modal .dlg-body');
    if (!body) return;
    body.textContent = '';
    const row = el('div', { class: 'set-row set-wide', id: 'sub-body' });
    body.appendChild(row);
    const msg = el('p', { class: 'set-help', id: 'sub-msg', role: 'status', 'aria-live': 'polite' });
    const say = (t) => { msg.textContent = t || ''; };
    await keepFresh();
    const held = el('div', { id: 'sub-held' });
    row.appendChild(held);
    const heldCred = credNow || await credentialsNow().catch(() => ({ now: { why: 'none' }, sub: null, passes: [] }));
    const sel = subSelection(heldCred);
    await paintHeld(held, heldCred).catch(() => {});
    // In the app the prices shown are the store's own.
    const inApp = !!rail();
    const price = inApp ? await rail().prices().catch(() => ({})) : {};
    const skuOf = (want) => { const k = inApp && SUB.storeSku(rail().store(), want); return k ? price[k.basePlan ? k.product + ':' + k.basePlan : k.product] || null : null; };
    const passPrice = skuOf({ what: 'pass' });
    const lic = await verifiedLicense();
    const st = readState();
    const cred = await credential();
    const app = appNow();
    if (lic) {
      const t = SUB.TIERS[lic.tier];
      const yearly = cred && cred.period === 'yearly';
      // A plan this app does not sell (Streamer, in Meet) is honored, named,
      // and managed in the app that sells it: no price, no files, no cancel here.
      const elsewhere = SUB.tiersSoldIn(app).indexOf(lic.tier) < 0;
      const viaStore = /^[GA]-/.test(String(lic.subId || ''));
      if (elsewhere) {
        row.appendChild(el('p', { class: 'set-help', id: 'sub-plan-elsewhere' }, tx('subFromBroadcast', '{plan}, from the Broadcast app. In meetings it gives everything Unlimited gives.').replace('{plan}', planShort(lic.tier))));
        row.appendChild(el('p', { class: 'set-help', id: 'sub-meetings' }, meetingsWords(SUB.rightsOf(lic, nowS()).meetings)));
        if (!inApp) row.appendChild(el('a', { class: BTN, style: BTN_STYLE + ';display:inline-block;text-decoration:none', id: 'sub-manage-broadcast', href: '/cast', target: '_blank', rel: 'noopener' }, tx('subManageBroadcast', 'Manage it in the Broadcast app')));
      } else {
        row.appendChild(el('p', { class: 'set-help' }, st.status === 'CANCELLED' ? SUB.TEXT.cancelled + ' Ends ' + dateOf(st.until || lic.exp) + '.' : inApp || viaStore ? tx('subRenewsAuto', 'Renews automatically.') : 'Renews through PayPal.'));
        row.appendChild(el('p', { class: 'set-help', id: 'sub-meetings' }, meetingsWords(SUB.rightsOf(lic, nowS()).meetings)));
        if (M.meeting() && M.meeting().moved === 'moved') row.appendChild(el('p', { class: 'set-help' }, 'It is in use in another meeting now.'));
        // The library is a web page, offered only in the Broadcast app; the
        // native apps are the meeting only.
        if (t.storage && app === 'broadcast' && !inApp) {
          const a = el('a', { class: BTN, style: BTN_STYLE + ';display:inline-block;text-decoration:none', id: 'sub-library', href: '/library', target: '_blank', rel: 'noopener' }, 'My library');
          row.appendChild(a);
          row.appendChild(el('p', { class: 'set-help', id: 'sub-library-key' }, 'Only you can open your library. If you lose your subscription file and its backup, nobody, not even GifOS, can recover it.'));
        }
        if (inApp) {
          // A plan bought in the app is managed in the store's own subscription screen.
          // One bought elsewhere shows no purchase control here at all.
          if (viaStore) {
            const m = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-manage' }, tx('subManage', 'Manage subscription'));
            m.onclick = () => { rail().manage().catch(() => {}); };
            row.appendChild(m);
          }
        } else if (viaStore) {
          row.appendChild(el('p', { class: 'set-help', id: 'sub-store-managed' }, tx('subStoreManaged', 'This subscription is managed in the GifOS Meet app.')));
        } else if (st.status !== 'CANCELLED') {
          const c = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-cancel' }, 'Cancel subscription');
          c.onclick = async () => {
            c.disabled = true; say('Cancelling…');
            try { await cancel(); say(SUB.TEXT.cancelled); paintSettings(); } catch (e) { c.disabled = false; say(String(e.message || e)); }
          };
          row.appendChild(c);
        }
      }
    }
    // The plan table lives in the Subscription dialog (#sub-modal): same window
    // as Settings (header, body, Close). Free, then the $1 four-hour pass, then
    // one row per paid plan with Monthly and Annual buttons side by side.
    if (st.subId && st.status && st.status !== 'APPROVAL_PENDING' && !lic) row.appendChild(el('p', { class: 'set-help' }, tx('subLapsed', SUB.TEXT.lapsed)));
    const table = el('table', { class: 'sub-plans', id: 'sub-plans' });
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    hr.appendChild(el('th', { scope: 'col' }, ''));
    hr.appendChild(el('th', { scope: 'col' }, tx('subColMonth', 'Monthly')));
    hr.appendChild(el('th', { scope: 'col' }, tx('subColYear', 'Annual')));
    thead.appendChild(hr); table.appendChild(thead);
    const tb = document.createElement('tbody');
    const fr = el('tr', { class: 'sub-plan-free', 'data-tier': 'free' });
    const fd = el('td', { colspan: '3', class: 'sub-plan-desc' }, tx('subFreeTop', 'Free: private meetings up to 5 people; public open-floor meetings always free'));
    fr.appendChild(fd); tb.appendChild(fr);
    // $1 four-hour pass: one row after Free and before the $2 plan, one button.
    const pr = el('tr', { class: 'sub-plan-pass', 'data-tier': 'pass' });
    let passDesc = tx('subPassDesc', 'Unlimited people for 4 hours');
    if (sel.pass && heldCred.now && Number.isFinite(heldCred.now.until)) {
      passDesc = passDesc + ' · ' + fill(tx('passUntil', 'Unlimited until {until}'), { until: clockOf(heldCred.now.until) });
    }
    pr.appendChild(el('td', { class: 'sub-plan-desc' }, passDesc));
    const ptd = el('td', { class: 'sub-plan-buy', colspan: '2' });
    const passBtn = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-pass-buy' }, passPrice ? tx('passForHoursAt', '{price} for 4 hours').replace('{price}', passPrice) : tx('passForHours', '$1 for 4 hours'));
    passBtn.onclick = async () => {
      passBtn.disabled = true; say(inApp ? '' : tx('passOpening', 'Opening PayPal…'));
      try {
        const r = await buyPass(say);
        say(r && r.passJson ? tx('passThanks', 'Thank you. Your four-hour pass is on.') : inApp ? msg.textContent : tx('passNotConfirmed', 'PayPal did not confirm the payment.'));
        paintSettings();
      } catch (e) { passBtn.disabled = false; say(String(e.message || e)); }
    };
    ptd.appendChild(passBtn);
    pr.appendChild(ptd);
    tb.appendChild(pr);
    const onBuy = async (id, period) => {
      for (const x of row.querySelectorAll('button[data-tier]')) x.disabled = true;
      say(inApp ? '' : 'Opening PayPal…');
      try {
        const r = await subscribe(id, period, say);
        if (inApp) say(r && r.licenseJson ? tx('subThanksApp', 'You are subscribed. Thank you.') : msg.textContent);
        else say(r && r.licenseJson ? 'You are subscribed. Thank you. Download your subscription file to keep it safe.' : r && r.status === 'APPROVAL_PENDING' ? SUB.TEXT.pending : 'PayPal did not confirm the subscription.');
        paintSettings();
      } catch (e) {
        say(String(e.message || e));
        for (const x of row.querySelectorAll('button[data-tier]')) x.disabled = false;
      }
    };
    // The window lists Room 20, Unlimited (Streamer in Broadcast) and Family business; every plan is on /subscription.
    for (const id of SUB.tiersListed(app)) {
      const t = SUB.TIERS[id];
      const tr = el('tr', { 'data-tier': id });
      tr.appendChild(el('td', { class: 'sub-plan-desc' }, planName(id, t)));
      for (const period of ['monthly', 'yearly']) {
        const td = el('td', { class: 'sub-plan-buy' });
        if (t.periods.indexOf(period) >= 0 && !(inApp && !SUB.storeSku(rail().store(), { what: 'sub', tier: id, period }))) {
          const sp = skuOf({ what: 'sub', tier: id, period });
          const label = period === 'yearly' ? (sp || t.priceYear) + ' a year' : (sp || t.price) + ' a month';
          const b = el('button', { type: 'button', class: BTN, style: BTN_STYLE, 'data-tier': id, 'data-period': period }, label);
          b.onclick = () => onBuy(id, period);
          td.appendChild(b);
        }
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    row.appendChild(table);
    if (!inApp) row.appendChild(el('p', { class: 'set-help', id: 'sub-how' }, tx('passHow', 'Pay by card or PayPal.')));
    row.appendChild(legalLine('sub-legal', inApp));
    // Every plan (the bigger business plans, Enterprise, Negotiated), the one held and the way up: /subscription.
    row.appendChild(el('a', { class: BTN, style: BTN_STYLE + ';display:inline-block;text-decoration:none', id: 'sub-all-plans', href: '/subscription', target: '_blank', rel: 'noopener' }, tx('subAllPlans', 'All plans')));
    applySubSelection(row, sel);
    if (inApp) {
      // In the app: restore, and the credentials file through the system's own
      // share sheet and file picker. The words say what the file is for and
      // nothing about where anything is sold.
      const rs = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-restore' }, tx('storeRestore', 'Restore purchases'));
      rs.onclick = async () => {
        rs.disabled = true;
        try { const got = await restoreInApp(); say(got.some((r) => r.state === 'done') ? tx('storeRestored', 'Your purchases are restored.') : tx('storeNothing', 'No purchases to restore.')); paintSettings(); }
        catch (e) { rs.disabled = false; say(String(e.message || e)); }
      };
      row.appendChild(rs);
      const N = root.GifosNative;
      if (cred || (await wallet())) {
        const d = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-file-get' }, tx('credsSave', 'Save my GifOS Meet credentials'));
        d.onclick = async () => {
          try {
            const r = await N.request('file.save', { name: 'GifOS Meet credentials.gif', mime: 'image/gif', b64: b64(await fileBytes()) });
            if (r && r.ok !== false && r.state !== 'cancelled') say(tx('credsSaved', 'Saved. Keep the file private: anyone with it can use your credentials.'));
          } catch (e) { say(String(e.message || e)); }
        };
        row.appendChild(d);
        row.appendChild(el('p', { class: 'set-help', id: 'sub-file-help' }, tx('credsSaveHelp', 'Back up your credentials, or use them on your other devices.')));
      }
      if (N.info().credentialImport === true) {
        const u = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-file-load' }, tx('credsLoad', 'Load my GifOS Meet credentials'));
        u.onclick = async () => {
          try {
            const r = await N.request('file.pick', { mime: 'image/gif' });
            if (!r || r.ok === false || r.state !== 'picked') return;
            const st2 = await useFile(fromB64(r.b64));
            say(st2 && st2.licenseJson ? tx('credsLoadedSub', 'Your credentials are loaded. A subscription works in as many meetings at once as its plan says.') : tx('credsLoaded', 'Your credentials are loaded.'));
            paintSettings();
          } catch (e) { say(/not a GifOS/.test(String(e && e.message)) ? tx('credsNot', 'That file does not hold GifOS Meet credentials.') : String(e.message || e)); }
        };
        row.appendChild(u);
      }
      planPageLinks(row);
      row.appendChild(msg);
      return;
    }
    // The subscription file: download it, or use one from another browser.
    if (cred || (await wallet())) {
      const d = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-file-get' }, 'Download subscription file');
      d.onclick = () => { downloadFile().then(() => say('Saved. Keep it private: anyone with the file can use your subscription' + (lic && lic.grants && lic.grants.storage && app === 'broadcast' ? ' and open your library. Keep a backup: if you lose it, nobody, not even GifOS, can recover your library.' : '.')), (e) => say(String(e.message || e))); };
      row.appendChild(d);
    }
    const pick = el('input', { type: 'file', accept: 'image/gif,.gif', id: 'sub-file-use', 'aria-label': 'Use a subscription file' });
    pick.onchange = async () => {
      const f = pick.files && pick.files[0];
      if (!f) return;
      say('Reading the file…');
      try {
        const r = await useFile(new Uint8Array(await f.arrayBuffer()));
        say(r && r.licenseJson ? 'This browser now uses your subscription. It works in as many meetings at once as its plan says.' : 'The file was read, but the subscription is not active.');
        paintSettings();
      } catch (e) { say(String(e.message || e)); }
    };
    const lab = el('label', { class: 'set-help', style: 'display:block;margin-top:.4rem' }, tx('subFileUse', 'Use a subscription file from another browser: '));
    lab.appendChild(pick);
    row.appendChild(lab);
    planPageLinks(row);
    row.appendChild(msg);
  }
  function closeSubscribe() {
    const m = document.getElementById('sub-modal');
    if (m) m.style.display = 'none';
  }
  function wireSubModal() {
    const m = document.getElementById('sub-modal');
    if (!m || m.dataset.wired) return m;
    m.dataset.wired = '1';
    const c = document.getElementById('sub-close');
    if (c) c.addEventListener('click', closeSubscribe);
    m.addEventListener('click', (e) => { if (e.target === m) closeSubscribe(); });
    return m;
  }
  function openSettings() {
    const b = document.getElementById('setbtn');
    if (b) b.click();
  }
  // The Subscription entry: the Subscription dialog, same window as Settings.
  function openSubscribe() {
    const m = wireSubModal();
    if (m) m.style.display = 'flex';
    paintSettings().catch(() => {});
    return true;
  }

  // Shown instead of the meeting when the relay says it is full: one line, the number the relay sent, and the
  // wait. o: {limit, onRight}. limit is that number; onRight() runs once when this browser holds a right the door
  // lets in, from whichever path brought it, so the page knocks again by itself. The words name the number only.
  // WHILE IT WAITS the page knocks again by itself (subsReknock). fullWaiting() keeps that same wait line.
  let fullWatch = null;
  function fullWords(o) {
    const n = o && Number.isInteger(o.limit) && o.limit > 0 ? o.limit : null;
    return n ? fill(tx('subFullTitleN', 'This meeting is full ({n} people).'), { n }) : tx('subFullTitle', 'This meeting is full.');
  }
  function showFull(o) {
    if (NOPAGE || typeof document === 'undefined') return false;
    o = o && typeof o === 'object' ? o : {};
    const m = document.getElementById('left-modal');
    if (!m) return false;
    const t = document.getElementById('left-title');
    const n = document.getElementById('left-note');
    if (t) t.textContent = fullWords(o);
    if (n) n.textContent = tx('subFullNote', 'You get in when a place opens.');
    const box = m.querySelector('.name-box') || m;
    let card = document.getElementById('sub-full');
    if (card) card.remove();
    card = el('div', { id: 'sub-full', class: 'sub-full' });
    const say = el('p', { id: 'sub-full-say', class: 'sub-full-say', role: 'status', 'aria-live': 'polite' });
    const sayIt = (x) => { say.textContent = x || ''; };
    const done = () => { if (fullWatch) { clearInterval(fullWatch.t); const f = fullWatch.onRight; fullWatch = null; sayIt(tx('subFullJoining', 'You are in. Joining the meeting\u2026')); try { if (f) f(); } catch (e) {} } };
    const check = () => { const w = fullWatch; if (w && !w.busy) { w.busy = true; doorRight().then((ok) => { w.busy = false; if (ok && fullWatch === w) done(); }); } };
    card.appendChild(say);
    card.appendChild(el('p', { id: 'sub-full-wait', class: 'sub-full-wait', role: 'status', 'aria-live': 'polite' }, tx('subFullWait', 'We keep knocking for you. You get in by yourself as soon as a place opens.')));
    // Above the Rejoin / Close row: the page may have wrapped those buttons, so insert before the box's own child that holds Rejoin.
    let ref = box.querySelector('#left-rejoin');
    while (ref && ref.parentNode !== box) ref = ref.parentNode;
    box.insertBefore(card, ref || null);
    m.dataset.full = '1';
    m.style.display = 'flex';
    if (fullWatch) clearInterval(fullWatch.t);
    fullWatch = typeof o.onRight === 'function' ? { onRight: o.onRight, busy: false, t: setInterval(check, GifOS.timings.SUBS_POLL_MS) } : null;
    if (fullWatch) check();   // a right already held knocks again without a tap
    return true;
  }
  // The wait line of the full screen. The page calls this as its knocks are refused again; the line stays the wait.
  function fullWaiting(o) {
    if (NOPAGE || typeof document === 'undefined') return false;
    void o;
    const w = document.getElementById('sub-full-wait');
    if (!w) return false;
    w.textContent = tx('subFullWait', 'We keep knocking for you. You get in by yourself as soon as a place opens.');
    w.className = 'sub-full-wait';
    return true;
  }
  // The full screen goes (the page knocks again): the offer and its watch with it.
  function hideFull() {
    if (fullWatch) { clearInterval(fullWatch.t); fullWatch = null; }
    if (NOPAGE || typeof document === 'undefined') return;
    const card = document.getElementById('sub-full'); if (card) card.remove();
    const m = document.getElementById('left-modal');
    if (m && m.dataset.full) { delete m.dataset.full; m.style.display = 'none'; }
  }

  // The small card the host's prompts use (the turned-away prompt, the move question).
  const CARD_STYLE = 'position:fixed;left:50%;bottom:5.5rem;transform:translateX(-50%);z-index:41;max-width:min(92vw,28rem);background:var(--c-white,#fff);color:var(--c-ink,#1d1d1f);border:1px solid var(--c-line,#e8ecf1);border-radius:.6rem;padding:.6rem .8rem;box-shadow:0 12px 32px rgba(0,0,0,.5);font:14px/1.4 system-ui,sans-serif;display:flex;gap:.6rem;align-items:center;flex-wrap:wrap';

  // An organization's plan (overflow 'keep') with every meeting in use: say so plainly; nothing is asked or moved.
  function showOverflowNote(n) {
    if (NOPAGE || typeof document === 'undefined' || !document.body) return false;
    const old = document.getElementById('sub-overflow'); if (old) old.remove();
    const box = el('div', { id: 'sub-overflow', role: 'status', 'aria-live': 'polite', style: CARD_STYLE });
    box.appendChild(el('span', { id: 'sub-overflow-msg', style: 'flex:1 1 12rem' }, n > 0 ? fill(tx('subOverflowKeep', 'All {n} of your organization\u2019s meetings are in use; this one runs on the free limits.'), { n }) : tx('subOverflowKeep0', 'Every meeting your organization\u2019s plan covers is in use; this one runs on the free limits.')));
    const x = el('button', { type: 'button', id: 'sub-overflow-x', class: BTN, style: BTN_STYLE, 'aria-label': tx('subUpClose', 'Close') }, '\u00d7');
    x.onclick = () => { box.remove(); };
    box.appendChild(x);
    document.body.appendChild(box);
    return true;
  }

  // ASK BEFORE MOVING (Nathan 2026-11-22): every place of every right this browser holds is in use, and this meeting
  // has just started. opts: {places, entries:[{right, meeting, name, people, at}]} (moveOptions). One place: "Your plan
  // is powering 'X' (N people). Move it here?" with Move it here / Keep it there; several: which meeting to take it
  // from, or keep this one free. Both offer more meetings at once. -> {right, meeting} | {keep: true}.
  function askMove(opts) {
    return new Promise((resolve) => {
      if (NOPAGE || typeof document === 'undefined' || !document.body || !opts || !opts.entries || !opts.entries.length) return resolve(null);
      const old = document.getElementById('sub-move'); if (old) old.remove();
      const box = el('div', { id: 'sub-move', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sub-move-title', style: CARD_STYLE });
      const done = (v) => { box.remove(); resolve(v); };
      const nameOf = (e) => e.name || tx('subMoveOther', 'another meeting');
      const line = (id, text, strong) => { const p = el('p', { id, style: 'flex:1 1 100%;margin:0' + (strong ? ';font-weight:600' : '') }, text); box.appendChild(p); return p; };
      const btn = (id, text, v) => { const b = el('button', { type: 'button', id, class: BTN, style: BTN_STYLE }, text); b.onclick = () => done(v); box.appendChild(b); return b; };
      const free = SUB.FREE_LIMIT;
      if (opts.entries.length === 1 && opts.places <= 1) {
        const e = opts.entries[0];
        line('sub-move-title', fill(e.people === 1 ? tx('subMoveOne1', 'Your plan is powering \u201c{name}\u201d (1 person). Use it in this meeting?') : e.people ? tx('subMoveOne', 'Your plan is powering \u201c{name}\u201d ({n} people). Use it in this meeting?') : tx('subMoveOneNoCount', 'Your plan is powering \u201c{name}\u201d. Use it in this meeting?'), { name: nameOf(e), n: e.people }), true);
        line('sub-move-note', fill(tx('subMoveNote', 'That meeting will then let in only {free} new people and lose firewall video.'), { free }));
        line('sub-move-teach', tx('subMoveTeach', 'Your plan powers one meeting at a time.'));
        btn('sub-move-go', tx('subMoveGo', 'Use it in this meeting'), { right: e.right, meeting: e.meeting });
        btn('sub-move-keep', tx('subMoveKeep', 'Keep it there'), { keep: true });
      } else {
        line('sub-move-title', tx('subMoveMany', 'Every meeting your plans cover is in use. Take one for this meeting?'), true);
        opts.entries.forEach((e, i) => btn('sub-move-from-' + i, e.people === 1 ? fill(tx('subMoveFrom1', 'Take it from \u201c{name}\u201d (1 person)'), { name: nameOf(e) }) : e.people ? fill(tx('subMoveFrom', 'Take it from \u201c{name}\u201d ({n} people)'), { name: nameOf(e), n: e.people }) : fill(tx('subMoveFromNoCount', 'Take it from \u201c{name}\u201d'), { name: nameOf(e) }), { right: e.right, meeting: e.meeting }));
        btn('sub-move-keep', tx('subMoveKeepFree', 'Keep this meeting free'), { keep: true });
      }
      line('sub-move-free', fill(tx('subMoveFreeNote', 'A meeting your plan does not power runs on the free plan: up to {free} people, voice only through firewalls.'), { free }));
      // More meetings at once: the smallest plan with more places than these rights have, or every plan.
      const up = SUB.TIER_IDS.map((t) => SUB.TIERS[t]).filter((t) => t.meetings > Math.max(1, opts.places) && t.cents.monthly && SUB.tiersSoldIn(appNow()).indexOf(t.id) >= 0)[0];
      const p = line('sub-move-up', up ? fill(tx('subMoveUp', 'More meetings at once: {plan} powers {n} at once, from {price} a month.'), { plan: planShort(up.id), n: up.meetings, price: up.price }) + ' ' : '');
      const a = el('a', { id: 'sub-move-plans', href: '/subscription', target: '_blank', rel: 'noopener' }, tx('subAllPlans', 'All plans'));
      p.appendChild(a);
      document.body.appendChild(box);
      const first = box.querySelector('button'); if (first) try { first.focus(); } catch (e) {}
    });
  }

  // This page's plan is powering a different meeting (moved, or kept elsewhere by the person's choice). Dismissable.
  // Not for 'inactive': a lapsed plan is in no meeting, and the Settings line says so.
  function showAway() {
    try {
      if (NOPAGE || typeof document === 'undefined' || !document.body || !document.getElementById || !document.createElement) return false;
      if (document.getElementById('sub-away')) return true;
      const box = el('div', { id: 'sub-away', role: 'status', 'aria-live': 'polite', style: CARD_STYLE });
      box.appendChild(el('span', { id: 'sub-away-msg', style: 'flex:1 1 12rem' }, tx('subAway', 'Your plan is in use in another meeting.')));
      const here = el('button', { type: 'button', id: 'sub-away-here', class: BTN, style: BTN_STYLE }, tx('subAwayHere', 'Use it in this meeting'));
      here.onclick = () => { box.remove(); M.takePlanHere(); };
      box.appendChild(here);
      box.appendChild(el('a', { id: 'sub-away-manage', href: '/subscription', target: '_blank', rel: 'noopener' }, tx('subAwayManage', 'Manage')));
      const x = el('button', { type: 'button', id: 'sub-away-x', class: BTN, style: BTN_STYLE, 'aria-label': tx('subUpClose', 'Close') }, '\u00d7');
      x.onclick = () => { box.remove(); };
      box.appendChild(x);
      document.body.appendChild(box);
      return true;
    } catch (e) { return false; }
  }
  // (a) The host's browser holds NO plan: say only what this browser knows (Nathan 2026-11-24: never "your plan is on
  // another device"; the page cannot know that), and offer the two ways a plan bought elsewhere gets here.
  function hostElsewhere(bar) {
    credential().then((c) => {
      if (c || NOPAGE || typeof document === 'undefined' || !document.getElementById) return;
      const live = document.getElementById('sub-host-up');
      if (!live || document.getElementById('sub-host-elsewhere')) return;
      const line = el('p', { id: 'sub-host-elsewhere', style: 'flex:1 1 100%;margin:.2rem 0 0' }, fill(tx('subHostElsewhere', 'This browser has no plan, so this meeting runs on Free (up to {n} people). Bought a plan on another phone or computer? Add it to this device.'), { n: SUB.FREE_LIMIT }));
      line.appendChild(document.createTextNode(' '));
      line.appendChild(el('a', { href: '/subscription#get', id: 'sub-host-elsewhere-link', target: '_blank', rel: 'noopener' }, tx('subHostMoveGo', 'Get my plan from another device')));
      line.appendChild(document.createTextNode(' · '));
      line.appendChild(el('a', { href: '/subscription#restore', id: 'sub-host-restore-link', target: '_blank', rel: 'noopener' }, tx('subHostRestoreGo', 'Restore with PayPal (lost device)')));
      live.appendChild(line);
    }).catch(() => {});
    return bar;
  }

  // The relay turned someone away at this hosted room's people line and told the host ({t:'turned', w}: w names the
  // refused device for this room only). Distinct people are counted; the host sees how many could not get in.
  const turnedSeen = new Set();
  function hostTurned(w) {
    const k = typeof w === 'string' && /^[0-9a-f]{1,16}$/.test(w) ? w : '?' + turnedSeen.size;
    turnedSeen.add(k); if (turnedSeen.size > 256) turnedSeen.delete(turnedSeen.values().next().value);
    return showHostPrompt(turnedSeen.size);
  }
  // The host, when people were turned away: how many. The number only; the room's permissions are the License.
  // n: how many people could not get in (1 when not counted).
  function showHostPrompt(n) {
    if (NOPAGE || typeof document === 'undefined' || !document.body) return false;
    n = Number.isInteger(n) && n > 0 ? n : 1;
    const words = () => (n === 1 ? tx('subHostTurned1', '1 person couldn\'t get in.') : fill(tx('subHostTurnedN', '{n} people couldn\'t get in.'), { n }));
    let bar = document.getElementById('sub-host-up');
    if (bar) {
      bar.hidden = false;
      const msg = document.getElementById('sub-host-up-msg');
      if (msg) msg.textContent = words();
      hostElsewhere(bar);
      return true;
    }
    bar = el('div', { id: 'sub-host-up', role: 'status', 'aria-live': 'polite', style: CARD_STYLE });
    bar.appendChild(el('span', { id: 'sub-host-up-msg', style: 'flex:1 1 12rem' }, words()));
    const x = el('button', { type: 'button', id: 'sub-host-up-x', class: BTN, style: BTN_STYLE, 'aria-label': tx('subUpClose', 'Close') }, '\u00d7');
    x.onclick = () => { bar.remove(); };
    bar.appendChild(x);
    document.body.appendChild(bar);
    hostElsewhere(bar);
    return true;
  }

  // The lobby's link to /subscription (every plan, and moving or restoring yours): drawn here, not in run.html, so
  // the thin page stays thin. Meet and Broadcast share the lobby.
  function boot() {
    if (NOPAGE) return;
    try {
      const card = document.querySelector('#lobby .lobby-card');
      if (card && !document.getElementById('lob-plans')) {
        const a = el('a', { id: 'lob-plans', class: 'lob-plans', href: '/subscription', target: '_blank', rel: 'noopener', 'data-t': 'lobPlans' }, tx('lobPlans', 'Plans and your subscription'));
        card.appendChild(a);
      }
    } catch (e) {}
    wireSubModal();
    M.boot();
    paintNow().catch(() => {});
  }
  // What the logic asks of the screen (see attachView in js/meet-subs.js).
  M.attachView({
    canChoose: () => !NOPAGE && typeof document !== 'undefined' && !!document.body,
    askMove,
    overflowNote: showOverflowNote,
    away: showAway,
    changed: () => { paintNow().catch(() => {}); },
    // the skin the page wears: Broadcast sets this class on the body (js/core/view/view.js)
    broadcast: () => { try { return !NOPAGE && !!(document.body && document.body.classList.contains('broadcast')); } catch (e) { return false; } },
    download: (url, name) => {
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
    },
  });
  Object.assign(M, { askMove, showOverflowNote, applySubSelection, paintNow, paintSettings, openSettings, openSubscribe, showFull, hideFull, fullWaiting, showHostPrompt, hostTurned });
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
