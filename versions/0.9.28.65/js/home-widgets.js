/*
 * home-widgets.js — widgets on the Home Screen. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * ONE CONCEPT: a widget is a small view that an APP offers, declared in the app's own GIF (manifest "widgets"), in
 * the sizes it can draw. A look (js/home-looks/<id>.js) offers SLOTS; a slot only says which sizes fit it, never
 * what it is for. The person puts any fitting widget in any slot, in any order (kept in gifos_home_widgets, a
 * setting that follows them). Each look names the widgets its slots start with, so a look draws complete from the
 * first moment and every part of it can still be swapped, removed or moved.
 *
 * A WIDGET RUNS WHERE ITS APP RUNS. An app from a GIF runs in the sandbox, so its widget is a sandboxed frame built
 * from the widget's entry file in that GIF: no network, no storage, no camera; it reads its own app's saved data
 * (read-only), is told the size, the look, the colours, the locale and each new minute, and can ask to open its
 * app. A system app (Meeting, Rooms, Broadcast, App Store) is a page of this site, not a sandboxed program, so its
 * widgets are drawn by this page (SYSTEM below), from the same blocks the looks use; its GIF still declares them.
 *
 * Cheap by construction: no timers here but the Home Screen's one minute tick; frames are told about data changes by
 * the app database's own channel; nothing is polled, and nothing runs while the Home Screen is not shown.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS; if (!GifOS || !root.document) return;
  const doc = root.document;
  const K = () => GifOS.homeView.kit;
  const LKEY = 'gifos_home_widgets', CKEY = 'gifos_home_wcat_v1';
  const SIZES = ['small', 'medium', 'wide', 'large'];
  // A frame is as tall as its content, within its size's range (px at the default text size; scaled with the text size).
  const HEIGHT = { small: [56, 190, 120], medium: [56, 330, 200], wide: [56, 210, 120], large: [56, 460, 320] };   // [least, most, before the first report]
  const store = () => GifOS.store, gif = () => GifOS.gif;
  const norm = (p) => String(p || '').replace(/^\.?\//, '');

  // ---- the catalog: every widget the apps on this Home Screen declare -------------------------------------------------
  const cat = new Map();          // 'appId/id' -> { key, appId, id, name, sizes, bare, entry, fileId, itemId, system, appName, i18n }
  let catReady = null, catSig = '';
  const okWidget = (w) => w && typeof w === 'object' && /^[a-z0-9-]{1,24}$/.test(w.id || '') && typeof w.name === 'string' && w.name.length <= 40;
  function readCache() { try { const o = JSON.parse(K().lsGet(CKEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  async function manifestOf(fileId) {
    const f = await store().getFile(fileId); if (!f || !f.bytes) return null;
    let m = null; try { m = await gif().readManifestFrom(f.bytes); } catch (e) {}
    if (!m) { try { const arc = await gif().decode(f.bytes); m = arc && gif().readManifest(arc); } catch (e) {} }
    return m || null;
  }
  async function scan() {
    const H = K().hook(); if (!H) return;
    const items = H.items().filter((it) => it.kind === 'file' && it.fileId);
    let metas = []; try { metas = await store().allFileMeta(); } catch (e) {}
    const meta = {}; metas.forEach((f) => { meta[f.id] = f; });
    const cache = readCache(), next = {}, found = new Map();
    for (const it of items) {
      const f = meta[it.fileId]; if (!f || !f.isApp || !f.appId) continue;
      let art = null; try { art = await store().getArt(it.fileId); } catch (e) {}
      // The bytes' length (kept with the icon's art) and, for a seeded app, the build that baked it: either changes, the manifest is read again.
      const sig = art && art.srcLen ? art.srcLen + ':' + (f.isDefault ? root.GIFOS_BUILD || 0 : 'u') : '';
      let c = sig && cache[it.fileId] && cache[it.fileId].s === sig ? cache[it.fileId] : null;
      if (!c) {
        const m = await manifestOf(it.fileId);
        c = { s: sig, a: (m && m.appId) || f.appId, n: (m && m.name) || '', i: m && m.i18n === 'gifos' ? 1 : 0, w: m && Array.isArray(m.widgets) ? m.widgets.filter(okWidget).slice(0, 8).map((w) => ({ id: w.id, name: w.name, entry: typeof w.entry === 'string' ? w.entry : '', sizes: (Array.isArray(w.sizes) ? w.sizes : []).filter((s) => SIZES.indexOf(s) >= 0), bare: w.bare === true })) : [] };
      }
      if (sig) next[it.fileId] = c;
      const system = f.isDefault === true && f.system ? f.system : null;   // only a file this site seeded is a system app
      for (const w of c.w) {
        const key = c.a + '/' + w.id;
        if (system ? !SYSTEM[key] : !w.entry) continue;
        if (found.has(key) && !(f.isDefault === true)) continue;   // two copies of one app: the seeded one speaks
        found.set(key, { key, appId: c.a, id: w.id, name: w.name, sizes: w.sizes.length ? w.sizes : ['medium'], bare: w.bare, entry: w.entry, fileId: it.fileId, itemId: it.id, system, appName: c.n || String(it.name || '').replace(/\.gif$/i, ''), i18n: !!c.i, locked: !!it.passkey });
      }
    }
    cat.clear(); found.forEach((v, k) => cat.set(k, v));
    try { K().lsSet(CKEY, JSON.stringify(next)); } catch (e) {}
    const sig = Array.from(cat.keys()).sort().join(',');
    if (sig !== catSig) { catSig = sig; if (GifOS.homeView.repaint) GifOS.homeView.repaint(); }
  }
  let scanning = null, again = false;
  function rescan() { if (scanning) { again = true; return scanning; } scanning = scan().catch(() => {}).then(() => { scanning = null; if (again) { again = false; return rescan(); } }); return scanning; }
  const ready = () => catReady || (catReady = rescan());
  const wName = (w) => { const k = 'home.w.' + w.appId + '.' + w.id; return GifOS.i18n && GifOS.i18n.has(k) ? GifOS.i18n.t(k) : w.name; };

  // ---- the layout: which widgets are in which slot, per look ----------------------------------------------------------
  function stored() { try { const o = JSON.parse(K().lsGet(LKEY) || 'null'); return o && o.v === 1 && o.looks && typeof o.looks === 'object' ? o : { v: 1, looks: {} }; } catch (e) { return { v: 1, looks: {} }; } }
  const entries = (def, slot) => { const s = stored().looks[def.id]; const a = s && Array.isArray(s[slot]) ? s[slot] : null; return (a || def.slots[slot].start || []).filter((x) => typeof x === 'string').slice(0, 24); };
  const parse = (e) => { const i = e.indexOf('@'); return i < 0 ? { key: e, size: '' } : { key: e.slice(0, i), size: e.slice(i + 1) }; };
  // The size a widget takes in a slot: the one chosen, else the slot's first size that the widget can draw.
  const fitSize = (w, slot, want) => (want && w.sizes.indexOf(want) >= 0 && slot.sizes.indexOf(want) >= 0 ? want : slot.sizes.find((s) => w.sizes.indexOf(s) >= 0) || '');
  // -> [{ w, size, entry index }] for what can be drawn now. An entry whose app is not on this device is kept, not drawn.
  function resolve(def, slotName) {
    const slot = def.slots[slotName], out = [], seen = new Set();
    entries(def, slotName).forEach((e, i) => { const p = parse(e), w = cat.get(p.key); if (!w || seen.has(p.key)) return; const size = fitSize(w, slot, p.size); if (!size) return; seen.add(p.key); out.push({ w, size, i }); });
    return out;
  }
  const layoutSig = (id) => { const s = stored().looks[id]; return catSig + '|' + (s ? JSON.stringify(s) : ''); };
  function save(def, slotName, list) {
    const o = stored(); o.looks[def.id] = o.looks[def.id] || {}; o.looks[def.id][slotName] = list;
    K().lsSet(LKEY, JSON.stringify(o)); GifOS.homeView.repaint();
  }

  // ---- system apps' widgets: drawn by this page, from the looks' own blocks ------------------------------------------------
  // (ctx) -> { html, bare, hidden, after(el) }. ctx: { size, flavor, look, data }. flavor is the look's style hint
  // ('calm', 'night', 'bold'): a widget picks the variant that suits it, and so fits a look it has never heard of.
  const head = (title, link, act) => '<div class="hv-sec-h"><h2>' + K().esc(title) + '</h2>' + (link ? '<button type="button" class="hv-link" data-act="' + act + '">' + K().esc(link) + '</button>' : '') + '</div>';
  const SYSTEM = {
    'meet/join'(c) {
      const k = K(), a = k.api, W = k.W, d = c.data, small = c.size === 'small' || c.size === 'wide';
      const chips = '<div class="w-chips"><button type="button" class="hv-pill" data-act="myroom">' + k.svg('home') + k.esc(d.ppl.mine ? W.myRoom : W.makeMyRoom) + '</button>' +
        '<button type="button" class="hv-pill" data-act="lobby">' + k.svg('key') + k.esc(W.host) + '</button><button type="button" class="hv-pill" data-act="golive">' + k.svg('tv') + k.esc(W.goLive) + '</button></div>';
      if (c.flavor === 'bold') return { bare: true, html: '<section class="p-hero"><h1>' + k.esc(d.me.name ? k.T('hey', { name: d.me.name }) : W.heyYou) + '<br>' + k.esc(W.whereMeet) + '</h1>' + a.joinForm('big') + (small ? '' : '<p class="hv-quiet">' + k.esc(W.joinShort) + '</p>') + '</section>' };
      return { html: '<div class="w-join">' + (small ? '' : '<h1>' + k.esc(W.meet) + '</h1>') + a.joinForm(small ? '' : 'big') + (c.size === 'small' ? '' : chips) + (small ? '' : '<p class="hv-quiet">' + k.esc(W.joinShort) + '</p>') + '</div>' };
    },
    'meet/recent'(c) {
      const k = K(), a = k.api, W = k.W, d = c.data, n = c.size === 'small' ? 2 : c.size === 'large' ? 8 : 4;
      if (c.flavor === 'bold' && c.size !== 'small') {
        if (!d.rooms.length) return { hidden: true, html: '' };
        return { bare: true, html: head(W.jumpBack) + '<div class="p-cards">' + d.rooms.slice(0, 8).map((r, i) =>
          '<button type="button" class="p-card" data-act="room:' + i + '" style="--h:' + a.hue(r.room) + '"><span class="p-card-k">' + k.esc(a.roomKind(r)) + '</span><b>' + k.esc(r.name) + '</b><span class="p-card-s">' + k.esc(r.saved ? W.saved : a.relTime(r.ts)) + '</span><span class="p-card-go">' + k.svg('video') + k.esc(W.join) + '</span></button>').join('') + '</div>' };
      }
      return { html: head(W.recentRooms) + '<div class="hv-rows">' + (d.rooms.length ? d.rooms.slice(0, n).map((r, i) => a.roomRow(r, i, 'room')).join('') : '<p class="hv-quiet">' + k.esc(W.noRooms) + '</p>') + '</div>' };
    },
    'rooms/people'(c) {
      const k = K(), a = k.api, W = k.W, d = c.data, n = c.size === 'small' ? 4 : 14;
      if (c.flavor === 'bold') return { bare: true, html: '<div class="hv-strip w-people">' + a.peopleStrip(d.ppl, n) + '</div>' };
      return { html: head(W.people, d.ppl.list.length ? W.all : '', 'people') + '<div class="hv-strip w-people">' + a.peopleStrip(d.ppl, n) + '</div>' };
    },
    'rooms/missed'(c) { const h = K().api.missedChip(c.data.ppl); return { bare: true, hidden: !h, html: h }; },
    'broadcast/live'(c) {
      const k = K(), a = k.api, W = k.W, d = c.data;
      if (c.flavor === 'bold') return { bare: true, html: head(W.live) + a.liveCard() + (c.size === 'small' ? '' : a.tvStrip(3)) };
      return { html: head(W.onNow) + '<div class="hv-rows">' + a.tvRow() + d.casts.slice(0, c.size === 'small' ? 1 : 3).map((r, i) => a.roomRow(r, i, 'cast')).join('') + '</div>' + (c.size === 'small' ? '' : a.tvStrip(c.size === 'large' ? 8 : 4)) };
    },
    'appstore/apps'(c) {
      const k = K(), a = k.api, W = k.W, list = a.shortApps(c.size === 'small' ? 4 : 8);
      return { bare: c.flavor === 'bold', sig: list.map((it) => it.id + it.name).join(','), html: '<div class="w-apps">' + head(W.apps, W.all, 'apps') + '<div class="hv-approw"></div></div>',
        after(el) { const row = el.querySelector('.hv-approw'); list.forEach((it) => row.appendChild(a.appTile(it))); } };
    },
  };

  // ---- an app's widget: a sandboxed frame built from its entry file --------------------------------------------------------
  const WIDGET_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri about:";
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', css: 'text/css', js: 'text/javascript', json: 'application/json', woff2: 'font/woff2' };
  const frames = new Map();       // contentWindow -> { frame, w, nonce, root }
  const chans = new Map();        // fileId -> { bc, n }
  const arcs = new Map();         // fileId -> Promise<{ files, catalogs, order }>
  // A sandboxed frame may still navigate ITSELF, and the page it lands on would be a page of the web: this policy
  // refuses every frame target but about: (srcdoc), as run.html's own does. It goes in before the first frame.
  function guardPage() {
    if (doc.querySelector('meta[data-hw-csp]')) return;
    const m = doc.createElement('meta'); m.httpEquiv = 'Content-Security-Policy'; m.content = 'frame-src about:'; m.dataset.hwCsp = '1'; doc.head.appendChild(m);
  }
  function archive(w) {
    if (arcs.has(w.fileId)) return arcs.get(w.fileId);
    const p = (async () => {
      const f = await store().getFile(w.fileId), arc = await gif().decode(f.bytes), files = {};
      Object.keys(arc.files).forEach((p2) => { files[norm(p2)] = arc.files[p2]; });
      // Words: the GIF's own i18n/<locale>.json, or for a built-in app the site's i18n/<locale>/apps/<appId>.json.
      const I = GifOS.i18n, loc = I.locale(), C = I.core(), catalogs = {};
      const own = Object.keys(files).map((p2) => (/^i18n\/([A-Za-z0-9-]+)\.json$/.exec(p2) || [])[1]).filter(Boolean);
      let order = ['en'];
      if (own.length) { order = C.chain(C.parts(loc.baseName), own); order.forEach((l) => { try { catalogs[l] = JSON.parse(gif().bytesToText(files['i18n/' + l + '.json'])); } catch (e) {} }); }
      else if (w.i18n) {
        order = loc.catalogs.indexOf('en') === -1 ? loc.catalogs.concat(['en']) : loc.catalogs;
        await Promise.all(order.map((l) => root.fetch(I.catalogUrl(l, 'apps/' + w.appId.replace(/[^a-z0-9_-]/gi, ''))).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((o) => { if (o && typeof o === 'object') catalogs[l] = o; })));
      }
      return { files, catalogs, order };
    })();
    arcs.set(w.fileId, p); p.catch(() => arcs.delete(w.fileId));
    return p;
  }
  // The entry file and what it names from the GIF, as ONE document; nothing outside the GIF can load.
  function buildDoc(files, entry, shim) {
    const text = (p) => gif().bytesToText(files[p]);
    const d = new root.DOMParser().parseFromString(text(norm(entry)), 'text/html');
    const dataUrl = (p) => 'data:' + (MIME[(p.split('.').pop() || '').toLowerCase()] || 'application/octet-stream') + ';base64,' + gif().b64encode(files[p]);
    d.querySelectorAll('script[src]').forEach((s) => { const p = norm(s.getAttribute('src')); if (files[p]) { s.removeAttribute('src'); s.textContent = text(p); } else s.remove(); });
    d.querySelectorAll('link[rel~="stylesheet"][href]').forEach((l) => { const p = norm(l.getAttribute('href')); const st = d.createElement('style'); if (files[p]) st.textContent = text(p); l.replaceWith(st); });
    d.querySelectorAll('[src]').forEach((n) => { const p = norm(n.getAttribute('src')); if (files[p]) n.setAttribute('src', dataUrl(p)); });
    d.querySelectorAll('meta[http-equiv], base, iframe, object, embed').forEach((n) => n.remove());
    const add = (tag, attrs, body) => { const n = d.createElement(tag); Object.keys(attrs || {}).forEach((a) => n.setAttribute(a, attrs[a])); if (body) n.textContent = body; return n; };
    const first = [add('meta', { 'http-equiv': 'Content-Security-Policy', content: WIDGET_CSP }), add('base', { href: 'about:srcdoc' }), add('meta', { name: 'color-scheme', content: 'light dark' }),
      add('style', {}, 'html,body{margin:0;background:transparent;overflow:hidden}'), add('script', {}, shim)];
    first.reverse().forEach((n) => d.head.insertBefore(n, d.head.firstChild));
    return '<!doctype html>' + d.documentElement.outerHTML;
  }
  // window.gifos inside a widget (see llms.txt "Widgets"). Written in ES5; everything it knows arrives in INIT or by message.
  function shimSrc(init) {
    return '(function(){var INIT=' + JSON.stringify(init).replace(/</g, '\\u003c') + ',I18=(' + String(GifOS.i18n.core) + ')();' + '(' + String(function (INIT, I18) {
      var st = INIT.widget, loc = INIT.locale, pending = {}, subs = {}, chg = [], mins = [], locCbs = [], nonce = INIT.nonce, now = INIT.now;
      try { delete window.RTCPeerConnection; delete window.webkitRTCPeerConnection; } catch (e) {}
      function post(m) { m.ns = 'gifos-widget'; m.n = nonce; parent.postMessage(m, '*'); }
      function rpc(m) { return new Promise(function (res, rej) { var id = 'r' + Math.random().toString(36).slice(2); pending[id] = { res: res, rej: rej }; m.id = id; post(m); }); }
      function dress() {
        var h = document.documentElement; h.setAttribute('data-size', st.size); h.setAttribute('data-look', st.look); h.setAttribute('data-flavor', st.flavor);
        if (st.dark) h.setAttribute('data-dark', ''); else h.removeAttribute('data-dark');
        h.style.colorScheme = st.dark ? 'dark' : 'light';
        for (var k in st.colors) h.style.setProperty('--w-' + k, st.colors[k]);
      }
      dress();
      function appLoc() { return { tag: loc.tag, catalogs: INIT.order }; }
      var miss = {}, tFn = I18.translator(appLoc, INIT.catalogs, miss), fmt = {};
      function local(key) { for (var i = 0; i < INIT.order.length; i++) { if (INIT.order[i] === 'en') break; var c = INIT.catalogs[INIT.order[i]]; if (c && Object.prototype.hasOwnProperty.call(c, key)) return true; } return false; }
      function bind() { var l = JSON.parse(JSON.stringify(loc)); if (INIT.order.length) l.ui = INIT.order[0]; var f = I18.makeFmt(l, tFn, local); for (var k in f) fmt[k] = f[k]; }
      bind();
      function each(a, v) { for (var i = 0; i < a.length; i++) { try { a[i](v); } catch (e) {} } }
      window.addEventListener('message', function (e) {
        if (e.source !== window.parent) return; var d = e.data; if (!d || d.ns !== 'gifos-widget') return;
        if (d.type === 'reply') { var p = pending[d.id]; if (!p) return; delete pending[d.id]; if (d.ok) p.res(d.result); else p.rej(new Error(d.error || 'Refused')); }
        else if (d.type === 'db-change') { for (var c in subs) if (d.collection === '*' || d.collection === c) (function (c2) { rpc({ type: 'db', op: 'getAll', collection: c2 }).then(function (r) { each(subs[c2] || [], r); }, function () {}); })(c); }
        else if (d.type === 'update') { st = d.widget; dress(); each(chg, api.widget); }
        else if (d.type === 'minute') { now = d.now; each(mins, now); }
        else if (d.type === 'locale') { loc = d.locale; bind(); each(locCbs, JSON.parse(JSON.stringify(loc))); each(chg, api.widget); }
      });
      var refuse = function () { return Promise.reject(new Error('A widget only reads. Open the app to change things.')); };
      var api = window.gifos = {
        widget: {
          get id() { return st.id; }, get size() { return st.size; }, get look() { return st.look; }, get flavor() { return st.flavor; }, get dark() { return st.dark; }, get colors() { return st.colors; },
          onChange: function (cb) { if (typeof cb !== 'function') return; chg.push(cb); try { cb(api.widget); } catch (e) {} },
          onMinute: function (cb) { if (typeof cb !== 'function') return; mins.push(cb); try { cb(now); } catch (e) {} },
          open: function () { post({ type: 'open' }); }
        },
        db: function (c) { return {
          get: function (id) { return rpc({ type: 'db', op: 'get', collection: c, key: id }); },
          getAll: function () { return rpc({ type: 'db', op: 'getAll', collection: c }); },
          subscribe: function (cb) { if (typeof cb !== 'function') return; (subs[c] = subs[c] || []).push(cb); rpc({ type: 'db', op: 'getAll', collection: c }).then(function (r) { try { cb(r); } catch (e) {} }, function () {}); },
          put: refuse, delete: refuse, setVisibility: refuse }; },
        info: function () { return Promise.resolve(INIT.info); },
        locale: function () { return JSON.parse(JSON.stringify(loc)); },
        onLocaleChange: function (cb) { if (typeof cb === 'function') locCbs.push(cb); return function () { var i = locCbs.indexOf(cb); if (i >= 0) locCbs.splice(i, 1); }; },
        i18n: { load: function () { return Promise.resolve(JSON.parse(JSON.stringify(loc))); }, t: function (k, p) { return tFn(k, p); }, format: function (m, p) { return I18.format(m, p, loc.tag, INIT.order[0] || loc.ui); }, fmt: fmt }
      };
      // The frame is as tall as what the widget draws (within its size's range): report it whenever it changes.
      function tall() { var b = document.body; if (b) post({ type: 'height', h: Math.ceil(Math.max(b.scrollHeight, b.getBoundingClientRect().height)) }); }
      window.addEventListener('load', function () { tall(); if (window.ResizeObserver && document.body) new ResizeObserver(tall).observe(document.body); });
    }) + ')(INIT,I18);})();';
  }
  const rem = () => parseFloat(root.getComputedStyle(doc.documentElement).fontSize) / 16 || 1;
  function dressOf(el, w, c) {
    const cs = root.getComputedStyle(el), v = (n) => cs.getPropertyValue(n).trim();
    const ink = v('--h-ink') || '#111', m = /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(ink);
    const dark = m ? (parseInt(m[1], 16) * 299 + parseInt(m[2], 16) * 587 + parseInt(m[3], 16) * 114) / 1000 > 140 : false;   // light ink means a dark look
    return { id: w.id, size: c.size, look: c.look, flavor: c.flavor, dark, colors: { ink, dim: v('--h-dim') || '#666', accent: v('--h-acc') || '#5b5bf0', accent2: v('--h-acc2') || '#ff7ab8', line: v('--h-line') || 'rgba(128,128,128,.3)', on: v('--h-on') || '#fff' } };
  }
  function listen(fileId) {
    let c = chans.get(fileId);
    if (!c) {
      c = { n: 0, bc: null };
      try { c.bc = new root.BroadcastChannel(store().appChannel(fileId)); c.bc.onmessage = (e) => { frames.forEach((f, win) => { if (f.w.fileId === fileId) try { win.postMessage({ ns: 'gifos-widget', type: 'db-change', collection: (e.data && e.data.collection) || '*' }, '*'); } catch (err) {} }); }; } catch (e) {}
      chans.set(fileId, c);
    }
    c.n++;
  }
  function unlisten(fileId) { const c = chans.get(fileId); if (!c) return; if (--c.n <= 0) { try { if (c.bc) c.bc.close(); } catch (e) {} chans.delete(fileId); } }
  function mountFrame(el, w, c, rootEl) {
    const k = K();
    if (w.locked) { el.innerHTML = '<button type="button" class="hv-row" data-act="w-open:' + k.esc(w.key) + '"><span class="hv-row-t"><b>' + k.esc(w.appName) + '</b><span>' + k.esc(k.W.locked) + '</span></span></button>'; return; }
    guardPage();
    const fr = doc.createElement('iframe');
    fr.className = 'hv-w-frame'; fr.setAttribute('sandbox', 'allow-scripts'); fr.title = wName(w) + ' · ' + w.appName; fr.setAttribute('allowtransparency', 'true');
    fr.style.height = Math.round(HEIGHT[c.size][2] * rem()) + 'px';
    el.appendChild(fr);
    const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    archive(w).then((a) => {
      if (!fr.isConnected) return;
      if (!a.files[norm(w.entry)]) { el.hidden = true; return; }
      const init = { nonce, now: Date.now(), widget: dressOf(el, w, c), locale: GifOS.i18n.locale(), catalogs: a.catalogs, order: a.order, info: { appId: w.appId, name: w.appName, widget: w.id } };
      fr.srcdoc = buildDoc(a.files, w.entry, shimSrc(init));
      frames.set(fr.contentWindow, { frame: fr, w, nonce, root: rootEl, el, c });
      listen(w.fileId);
    }).catch(() => { el.hidden = true; });
  }
  root.addEventListener('message', (e) => {
    const d = e.data; if (!d || d.ns !== 'gifos-widget') return;
    const f = frames.get(e.source); if (!f || d.n !== f.nonce) return;
    const reply = (p) => { try { e.source.postMessage(Object.assign({ ns: 'gifos-widget', type: 'reply', id: d.id }, p), '*'); } catch (err) {} };
    if (d.type === 'height') { const r = HEIGHT[f.c.size], s = rem(); f.frame.style.height = Math.round(Math.max(r[0] * s, Math.min(r[1] * s, +d.h || 0))) + 'px'; }
    else if (d.type === 'open') { if (f.root && f.root.classList.contains('hv-prev')) return; const ua = root.navigator.userActivation; if (ua && !ua.isActive) return; openItem(f.w); }   // only on the person's own tap
    else if (d.type === 'db') {
      const coll = String(d.collection || '');
      if (d.op !== 'get' && d.op !== 'getAll') return reply({ ok: false, error: 'A widget only reads. Open the app to change things.' });
      Promise.resolve(d.op === 'get' ? store().appGet(f.w.fileId, coll, d.key) : store().appGetAll(f.w.fileId, coll)).then((r) => reply({ ok: true, result: r == null ? (d.op === 'get' ? null : []) : r }), () => reply({ ok: false, error: 'Could not read.' }));
    }
  });
  function openItem(w) { const H = K().hook(), it = H && H.items().find((x) => x.id === w.itemId); if (it) H.open(it); return !!it; }
  function openApp(appId) { for (const w of cat.values()) if (w.appId === appId) return openItem(w); return false; }

  // ---- mounting a look's slots ----------------------------------------------------------------------------------------------
  function drawSystem(el, w, c) {
    const r = SYSTEM[w.key](c) || { html: '' }, sig = r.html + '\u0000' + (r.sig || '');
    el.classList.toggle('bare', !!r.bare); el.hidden = !!r.hidden;
    if (el._sig === sig) return;
    const a = doc.activeElement; if (a && el.contains(a) && a.tagName === 'INPUT' && el._sig != null) return;   // never repaint under someone typing
    el._sig = sig; el.innerHTML = r.html; if (r.after) r.after(el);
  }
  // The apps on the Home Screen changed (one added, removed, seeded): read the catalog again.
  let itemsSig = null;
  function noteItems() { const H = K().hook(); if (!H) return; const s = H.items().map((it) => it.fileId || '').join(','); if (itemsSig !== null && s !== itemsSig) rescan(); itemsSig = s; }
  function mount(rootEl, def, ctx) {
    noteItems();
    const preview = !!ctx.preview, slots = Array.from(rootEl.querySelectorAll('.hv-slot[data-slot]'));
    slots.forEach((sEl) => {
      const name = sEl.dataset.slot, slot = def.slots && def.slots[name]; if (!slot) return;
      sEl.classList.toggle('grid', !!slot.grid);
      resolve(def, name).forEach((x) => {
        const el = doc.createElement('section'); el.className = 'hv-w hv-w-' + x.size + (x.w.bare ? ' bare' : ''); el.dataset.w = x.w.key; el.dataset.size = x.size;
        sEl.appendChild(el);
        const c = { size: x.size, look: def.id, flavor: def.flavor || 'calm', data: ctx.data, preview };
        el._c = c; el._w = x.w;
        if (x.w.system) drawSystem(el, x.w, c); else mountFrame(el, x.w, c, rootEl);
      });
    });
    if (!preview && slots.length) {   // one way in to change them, at the end of the look's last slot
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'hv-w-edit'; b.dataset.act = 'w-edit'; b.innerHTML = K().svg('tune') + '<span>' + K().esc(K().W.editWidgets) + '</span>';
      slots[slots.length - 1].appendChild(b);
    }
  }
  function refresh(rootEl, def, ctx) {
    noteItems();
    rootEl.querySelectorAll('.hv-w').forEach((el) => { if (el._w && el._w.system) { el._c.data = ctx.data; drawSystem(el, el._w, el._c); } });
  }
  function unmount(rootEl) {
    frames.forEach((f, win) => { if (rootEl.contains(f.frame)) { frames.delete(win); unlisten(f.w.fileId); } });
  }
  function minute() {
    const now = Date.now();
    frames.forEach((f, win) => { if (!f.frame.isConnected) { frames.delete(win); unlisten(f.w.fileId); return; } try { win.postMessage({ ns: 'gifos-widget', type: 'minute', now }, '*'); } catch (e) {} });
  }
  try { if (GifOS.i18n) GifOS.i18n.onChange((loc) => { arcs.clear(); frames.forEach((f, win) => { try { win.postMessage({ ns: 'gifos-widget', type: 'locale', locale: loc }, '*'); } catch (e) {} }); }); } catch (e) {}

  // ---- changing them: one popup (the shared popup library), a list per slot --------------------------------------------------
  let editing = null;
  function edit() {
    const k = K(), id = GifOS.homeView.current();
    Promise.resolve(ready()).then(() => {
      const bg = k.popup(k.W.widgetsTitle, (body) => { editing = { body, id }; drawEdit(); }, 'widgets');
      bg._onClose = () => { editing = null; };
    });
  }
  function lookDef(id) { let d = null; GifOS.homeView._looks.forEach((v) => { if (v.id === id) d = v; }); return d; }
  function drawEdit() {
    if (!editing || !editing.body.isConnected) return;
    const k = K(), W = k.W, def = lookDef(editing.id); if (!def) return;
    const names = Object.keys(def.slots);
    editing.body.innerHTML = '<p class="hv-quiet">' + k.esc(W.widgetsNote) + '</p>' + names.map((name, si) => {
      const slot = def.slots[name], here = resolve(def, name), have = new Set(here.map((x) => x.w.key));
      const more = Array.from(cat.values()).filter((w) => !have.has(w.key) && fitSize(w, slot, '')).sort((a, b) => (a.appName + wName(a)).localeCompare(b.appName + wName(b)));
      return '<section class="hv-ed-slot"><div class="hv-sec-h"><h2>' + k.esc(k.T('slotN', { n: si + 1 })) + '</h2><span class="hv-quiet">' + k.esc(slot.sizes.map((s) => W['size.' + s]).join(' · ')) + '</span></div><div class="hv-rows">' +
        (here.length ? here.map((x, i) => {
          const fits = slot.sizes.filter((s) => x.w.sizes.indexOf(s) >= 0), a = name + '|' + x.w.key;
          return '<div class="hv-row hv-ed-row"><span class="hv-row-t"><b>' + k.esc(wName(x.w)) + '</b><span>' + k.esc(x.w.appName) + '</span></span>' +
            (fits.length > 1 ? '<button type="button" class="hv-pill" data-act="w-size:' + k.esc(a) + '" title="' + k.esc(W.changeSize) + '">' + k.esc(W['size.' + x.size]) + '</button>' : '') +
            '<button type="button" class="hv-ed-b" data-act="w-up:' + k.esc(a) + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="' + k.esc(W.moveUp) + '">' + k.svg('up') + '</button>' +
            '<button type="button" class="hv-ed-b" data-act="w-down:' + k.esc(a) + '"' + (i === here.length - 1 ? ' disabled' : '') + ' aria-label="' + k.esc(W.moveDown) + '">' + k.svg('down') + '</button>' +
            '<button type="button" class="hv-ed-b" data-act="w-rm:' + k.esc(a) + '" aria-label="' + k.esc(W.remove) + '">' + k.svg('x') + '</button></div>';
        }).join('') : '<p class="hv-quiet">' + k.esc(W.slotEmpty) + '</p>') + '</div>' +
        (more.length ? '<div class="hv-ed-add">' + more.map((w) => '<button type="button" class="hv-pill" data-act="w-add:' + k.esc(name + '|' + w.key) + '">' + k.svg('plus') + k.esc(wName(w)) + ' <i>' + k.esc(w.appName) + '</i></button>').join('') + '</div>' : '') + '</section>';
    }).join('') + '<div class="hv-sheet-foot"><button type="button" class="hv-pill" data-act="w-reset">' + k.esc(W.widgetsReset) + '</button></div><p class="hv-quiet">' + k.esc(W.widgetsFoot) + '</p>';
  }
  // The stored list for a slot, as the entries drawn now (entries whose app is missing here stay at the end, untouched).
  function listOf(def, name) { const all = entries(def, name), drawn = resolve(def, name), idx = new Set(drawn.map((x) => x.i)); return { drawn: drawn.map((x) => ({ key: x.w.key, size: x.size, w: x.w })), rest: all.filter((e, i) => !idx.has(i)) }; }
  const put = (def, name, drawn, rest) => save(def, name, drawn.map((x) => x.key + '@' + x.size).concat(rest));
  function act(verb, arg, b) {
    if (verb === 'w-edit') return edit();
    if (verb === 'w-open') { const w = cat.get(arg); if (w) openItem(w); return; }
    if (verb.indexOf('w-') !== 0 || !editing) return;
    const def = lookDef(editing.id); if (!def) return;
    if (verb === 'w-reset') { const o = stored(); delete o.looks[def.id]; K().lsSet(LKEY, JSON.stringify(o)); GifOS.homeView.repaint(); return drawEdit(); }
    const cut = arg.indexOf('|'), name = arg.slice(0, cut), key = arg.slice(cut + 1), slot = def.slots[name]; if (!slot) return;
    const l = listOf(def, name), i = l.drawn.findIndex((x) => x.key === key);
    if (verb === 'w-add') { const w = cat.get(key), size = w && fitSize(w, slot, ''); if (!size) return; l.drawn.push({ key, size, w }); l.rest = l.rest.filter((e) => parse(e).key !== key); }
    else if (i < 0) return;
    else if (verb === 'w-rm') l.drawn.splice(i, 1);
    else if (verb === 'w-up' && i > 0) l.drawn.splice(i - 1, 0, l.drawn.splice(i, 1)[0]);
    else if (verb === 'w-down' && i < l.drawn.length - 1) l.drawn.splice(i + 1, 0, l.drawn.splice(i, 1)[0]);
    else if (verb === 'w-size') { const fits = slot.sizes.filter((s) => l.drawn[i].w.sizes.indexOf(s) >= 0); l.drawn[i].size = fits[(fits.indexOf(l.drawn[i].size) + 1) % fits.length]; }
    put(def, name, l.drawn, l.rest); drawEdit();
  }

  GifOS.homeWidgets = { ready, rescan, mount, refresh, unmount, minute, act, layoutSig, openApp, catalog: () => Array.from(cat.values()), SIZES: SIZES.slice(), SYSTEM: Object.keys(SYSTEM), CSP: WIDGET_CSP };
})(typeof window !== 'undefined' ? window : globalThis);
