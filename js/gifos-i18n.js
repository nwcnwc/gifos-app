/*
 * gifos-i18n.js — the system locale, message catalogs and Intl formatting.
 *
 * One locale for the whole computer:
 *   - By default GifOS follows the browser (navigator.languages, then Intl).
 *   - Settings → Language and region may choose a language, a region and a
 *     12/24-hour clock. The choice is stored in localStorage (`gifos_locale`)
 *     beside the other display settings, so every GifOS page in this browser
 *     reads it synchronously at load and hears changes from other tabs.
 *   - A change fires `GifOS.i18n.onChange(cb)` and the window event
 *     `gifos:localechange` (detail = the new locale), and the runtime forwards
 *     it to running apps (`gifos.locale()` / `gifos.onLocaleChange()`).
 *
 * Words come from message catalogs, one JSON file per surface per locale:
 *   i18n/<locale>/<surface>.json        keys are "<surface>.<name>"
 *   i18n/<locale>/apps/<appId>.json     a built-in app's own words
 * English (en) is the base and the fallback: a key missing in the active
 * locale reads from en, and a key missing in en reads as the key itself.
 * Catalogs are fetched lazily, per surface: `await GifOS.i18n.load('settings')`
 * before that surface paints, then `GifOS.i18n.t('settings.lang.title')`.
 * Messages use ICU MessageFormat: {name}, {n, number}, {n, plural, one {# app}
 * other {# apps}}, {n, selectordinal, ...}, {x, select, a {...} other {...}}.
 *
 * Text follows the UI language (the best locale that has catalogs), numbers and
 * dates follow the full locale (language + region + clock), so a German
 * browser with an English interface still writes 1,5 MB and 2. Nov.
 *
 * `core` below is self-contained and written in ES5 on purpose: the runtime
 * injects its source into every app frame, so apps get the same resolution,
 * plural rules and formatters without a second implementation.
 */
(function (root) {
  'use strict';
  var GifOS = (root.GifOS = root.GifOS || {});
  if (GifOS.i18n) return;

  // Every locale that has catalogs under i18n/. Adding a language adds it here
  // and a folder i18n/<tag>/ holding the same files as i18n/en/.
  var LOCALES = ['en'];
  var BASE = 'en';
  var PREF_KEY = 'gifos_locale';

  function core() {
    var BUILTIN = {
      // English text for the shared formatters. i18n/en/common.json carries the
      // same entries (a check keeps them equal); they live here too so a size
      // or a duration is never a bare key before common.json has arrived.
      'common.size.B': '{n} B',
      'common.size.KB': '{n} KB',
      'common.size.MB': '{n} MB',
      'common.size.GB': '{n} GB',
      'common.size.TB': '{n} TB',
      'common.dur.s': '{s}s',
      'common.dur.m': '{m}m',
      'common.dur.ms': '{m}m {s}s',
      'common.ago.now': 'just now',
      'common.ago.m': '{n}m ago',
      'common.ago.h': '{n}h ago',
      'common.ago.d': '{n}d ago'
    };
    var RTL = { ar: 1, he: 1, fa: 1, ur: 1, ps: 1, dv: 1, yi: 1, ckb: 1, sd: 1, ug: 1 };
    var hasIntl = typeof Intl !== 'undefined';

    function canon(tag) {
      if (!tag || typeof tag !== 'string') return '';
      tag = tag.replace(/_/g, '-').trim();
      if (!/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(tag)) return '';
      try { if (hasIntl && Intl.getCanonicalLocales) return Intl.getCanonicalLocales(tag)[0] || ''; } catch (e) { return ''; }
      return tag;
    }
    // { language, script, region } of a tag; extensions dropped.
    function parts(tag) {
      var out = { language: '', script: '', region: '' };
      var bits = String(tag || '').split('-');
      out.language = (bits[0] || '').toLowerCase();
      for (var i = 1; i < bits.length; i++) {
        var b = bits[i];
        if (b.length === 1) break; // an extension singleton (-u-, -x-)
        if (/^[A-Za-z]{4}$/.test(b) && !out.script && !out.region) out.script = b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
        else if (/^([A-Za-z]{2}|\d{3})$/.test(b) && !out.region) out.region = b.toUpperCase();
      }
      return out;
    }
    function likelyScript(p) {
      if (p.script) return p.script;
      try {
        if (hasIntl && Intl.Locale) return new Intl.Locale(p.language + (p.region ? '-' + p.region : '')).maximize().script || '';
      } catch (e) {}
      return '';
    }
    // The catalogs to read for a locale, best first, ending at the base.
    // zh-TW → zh-Hant-TW, zh-Hant, zh-TW, zh, en (each only if it has catalogs).
    function chain(p, locales) {
      var c = [];
      var script = likelyScript(p);
      var add = function (t) { if (t && locales.indexOf(t) !== -1 && c.indexOf(t) === -1) c.push(t); };
      if (script && p.region) add(p.language + '-' + script + '-' + p.region);
      if (script) add(p.language + '-' + script);
      if (p.region) add(p.language + '-' + p.region);
      add(p.language);
      add('en');
      if (!c.length) c.push('en');
      return c;
    }

    // langs: navigator.languages; prefs: { language, region, hourCycle }.
    function resolve(langs, prefs, locales) {
      prefs = prefs || {};
      locales = locales || ['en'];
      var browser = [];
      for (var i = 0; i < (langs || []).length; i++) {
        var c = canon(langs[i]);
        if (c && browser.indexOf(c) === -1) browser.push(c);
      }
      if (!browser.length) {
        var d = '';
        try { if (hasIntl) d = new Intl.DateTimeFormat().resolvedOptions().locale; } catch (e) {}
        browser.push(canon(d) || 'en');
      }
      var want = canon(prefs.language);
      var wp = want ? parts(want) : null;
      var base = parts(browser[0]);
      if (wp) {
        // A browser language with the same language lends its region:
        // English chosen on a browser that lists en-GB stays British.
        base = { language: wp.language, script: wp.script, region: wp.region };
        for (var j = 0; j < browser.length && !base.region; j++) {
          var bp = parts(browser[j]);
          if (bp.language === wp.language && (!wp.script || !bp.script || bp.script === wp.script)) base.region = bp.region;
        }
      }
      var region = (prefs.region && /^([A-Za-z]{2}|\d{3})$/.test(prefs.region)) ? String(prefs.region).toUpperCase() : base.region;
      var baseName = canon(base.language + (base.script ? '-' + base.script : '') + (region ? '-' + region : '')) || 'en';
      var hc = /^h(11|12|23|24)$/.test(prefs.hourCycle || '') ? prefs.hourCycle : '';
      var tag = (hc && canon(baseName + '-u-hc-' + hc)) || baseName;
      var p = parts(baseName);
      var ch = chain(p, locales);
      var ui = ch[0];
      var opt = {};
      try { opt = new Intl.DateTimeFormat(tag, { hour: 'numeric' }).resolvedOptions(); } catch (e) { opt = {}; }
      var num = {};
      try { num = new Intl.NumberFormat(tag).resolvedOptions(); } catch (e) { num = {}; }
      var hourCycle = opt.hourCycle || (opt.hour12 === false ? 'h23' : opt.hour12 === true ? 'h12' : '');
      return {
        tag: tag,
        baseName: baseName,
        language: p.language,
        script: p.script || likelyScript(p),
        region: p.region,
        ui: ui,
        catalogs: ch,
        dir: RTL[parts(ui).language] ? 'rtl' : 'ltr',
        hourCycle: hourCycle,
        hour12: hourCycle === 'h11' || hourCycle === 'h12',
        timeZone: opt.timeZone || '',
        calendar: opt.calendar || 'gregory',
        numberingSystem: num.numberingSystem || opt.numberingSystem || 'latn',
        browser: browser,
        prefs: { language: want || '', region: prefs.region ? region : '', hourCycle: hc },
        source: (want || prefs.region || hc) ? 'settings' : 'browser'
      };
    }

    // ---- ICU MessageFormat (the subset catalogs use) -----------------------
    // Text, {arg}, {arg, number|date|time[, style]}, {arg, plural|selectordinal,
    // [offset:n] =N {...} cat {...} other {...}} with #, {arg, select, k {...}
    // other {...}}. '' is a quote; '{...}' is literal text.
    function parse(msg) {
      var pos = 0, s = String(msg);
      function err(m) { throw new Error('ICU: ' + m + ' at ' + pos + ' in "' + s + '"'); }
      function ws() { while (pos < s.length && /\s/.test(s.charAt(pos))) pos++; }
      function ident() { ws(); var st = pos; while (pos < s.length && /[^\s{},]/.test(s.charAt(pos))) pos++; if (st === pos) err('expected a name'); return s.slice(st, pos); }
      function nodes(inPlural) {
        var out = [], text = '';
        while (pos < s.length) {
          var ch = s.charAt(pos);
          if (ch === "'") {
            var nx = s.charAt(pos + 1);
            if (nx === "'") { text += "'"; pos += 2; continue; }
            if (nx === '{' || nx === '}' || (inPlural && nx === '#')) {
              var end = s.indexOf("'", pos + 1);
              if (end === -1) { text += s.slice(pos + 1); pos = s.length; break; }
              text += s.slice(pos + 1, end); pos = end + 1; continue;
            }
            text += ch; pos++; continue;
          }
          if (ch === '{') { if (text) { out.push(text); text = ''; } pos++; out.push(arg()); continue; }
          if (ch === '}') break;
          if (ch === '#' && inPlural) { if (text) { out.push(text); text = ''; } out.push({ hash: true }); pos++; continue; }
          text += ch; pos++;
        }
        if (text) out.push(text);
        return out;
      }
      function arg() {
        var name = ident(); ws();
        if (s.charAt(pos) === '}') { pos++; return { arg: name }; }
        if (s.charAt(pos) !== ',') err('expected , or }');
        pos++;
        var type = ident(); ws();
        if (type === 'number' || type === 'date' || type === 'time') {
          var style = '';
          if (s.charAt(pos) === ',') { pos++; ws(); var st = pos; while (pos < s.length && s.charAt(pos) !== '}') pos++; style = s.slice(st, pos).trim(); }
          if (s.charAt(pos) !== '}') err('expected }');
          pos++;
          return { arg: name, type: type, style: style };
        }
        if (type !== 'plural' && type !== 'selectordinal' && type !== 'select') err('unknown type ' + type);
        if (s.charAt(pos) !== ',') err('expected ,');
        pos++;
        var node = { arg: name, type: type, offset: 0, opts: {} };
        for (;;) {
          ws();
          if (s.charAt(pos) === '}') { pos++; break; }
          if (pos >= s.length) err('unclosed ' + type);
          var key = ident();
          if (/^offset:/.test(key)) { node.offset = Number(key.slice(7)) || 0; continue; }
          ws();
          if (s.charAt(pos) !== '{') err('expected { after ' + key);
          pos++;
          node.opts[key] = nodes(type !== 'select');
          if (s.charAt(pos) !== '}') err('unclosed option ' + key);
          pos++;
        }
        if (!node.opts.other) err(type + ' needs an other {...}');
        return node;
      }
      var res = nodes(false);
      if (pos < s.length) err('unbalanced }');
      return res;
    }
    var parsed = {};
    function compile(msg) {
      var k = String(msg);
      if (!Object.prototype.hasOwnProperty.call(parsed, k)) parsed[k] = parse(k);
      return parsed[k];
    }
    function pluralCat(lang, n, ordinal) {
      try { if (hasIntl && Intl.PluralRules) return new Intl.PluralRules(lang, ordinal ? { type: 'ordinal' } : undefined).select(n); } catch (e) {}
      if (ordinal) return 'other';
      return n === 1 ? 'one' : 'other';
    }
    // tag formats numbers/dates; lang picks plural rules (the message's language).
    function render(ast, params, tag, lang, num) {
      var out = '';
      for (var i = 0; i < ast.length; i++) {
        var n = ast[i];
        if (typeof n === 'string') { out += n; continue; }
        if (n.hash) { out += num == null ? '#' : fmtNumber(tag, num); continue; }
        var v = params ? params[n.arg] : undefined;
        if (!n.type) { out += v == null ? '{' + n.arg + '}' : (typeof v === 'number' ? fmtNumber(tag, v) : String(v)); continue; }
        if (n.type === 'number') {
          var o = n.style === 'integer' ? { maximumFractionDigits: 0 } : n.style === 'percent' ? { style: 'percent' } : undefined;
          out += fmtNumber(tag, Number(v), o); continue;
        }
        if (n.type === 'date' || n.type === 'time') {
          var st = /^(short|medium|long|full)$/.test(n.style) ? n.style : (n.type === 'date' ? 'medium' : 'short');
          var dop = {}; dop[n.type === 'date' ? 'dateStyle' : 'timeStyle'] = st;
          out += fmtDate(tag, v, dop); continue;
        }
        if (n.type === 'select') {
          var sel = n.opts[String(v)] || n.opts.other;
          out += render(sel, params, tag, lang, num); continue;
        }
        var x = Number(v);
        var exact = n.opts['=' + x];
        var branch = exact || n.opts[pluralCat(lang, x - n.offset, n.type === 'selectordinal')] || n.opts.other;
        out += render(branch, params, tag, lang, x - n.offset);
      }
      return out;
    }
    function format(msg, params, tag, lang) {
      return render(compile(msg), params || {}, tag || 'en', lang || tag || 'en', null);
    }
    // The argument names a message uses (for the catalog check).
    function argsOf(msg) {
      var seen = {};
      (function walk(ast) {
        for (var i = 0; i < ast.length; i++) {
          var n = ast[i];
          if (!n || typeof n === 'string' || n.hash) continue;
          seen[n.arg] = 1;
          if (n.opts) for (var k in n.opts) if (Object.prototype.hasOwnProperty.call(n.opts, k)) walk(n.opts[k]);
        }
      })(compile(msg));
      return Object.keys(seen).sort();
    }

    // ---- Intl formatting ---------------------------------------------------
    var nfCache = {};
    function fmtNumber(tag, n, opts) {
      if (typeof n !== 'number' || !isFinite(n)) return String(n);
      var key = tag + '|' + JSON.stringify(opts || {});
      try {
        var f = nfCache[key] || (nfCache[key] = new Intl.NumberFormat(tag, opts));
        return f.format(n);
      } catch (e) { return String(n); }
    }
    function toDate(d) { return d instanceof Date ? d : new Date(typeof d === 'string' && /^\d+$/.test(d) ? Number(d) : d); }
    function fmtDate(tag, d, opts, kind) {
      var dt = toDate(d);
      if (!isFinite(dt.getTime())) return '';
      try {
        if (kind === 'date') return dt.toLocaleDateString(tag, opts);
        if (kind === 'time') return dt.toLocaleTimeString(tag, opts);
        return dt.toLocaleString(tag, opts);
      } catch (e) { return dt.toString(); }
    }

    // fmt: the formatters, bound to one resolved locale. msg(key, params) is
    // the caller's catalog lookup; local(key) says whether the UI language has
    // its own text for a key (else Intl's own words are used for that language).
    function makeFmt(loc, msg, local) {
      var tag = loc.tag, ui = loc.ui;
      var english = ui.split('-')[0] === 'en';
      function words(key, params, intl) {
        if (english || local(key) || !intl) return msg(key, params);
        try { return intl(); } catch (e) { return msg(key, params); }
      }
      function n0(v) { return fmtNumber(tag, v, { useGrouping: false, maximumFractionDigits: 0 }); }
      var api = {
        number: function (v, opts) { return fmtNumber(tag, v, opts); },
        // opts undefined = the browser's own toLocale*String defaults, in this locale.
        date: function (d, opts) { return fmtDate(tag, d, opts, 'date'); },
        time: function (d, opts) { return fmtDate(tag, d, opts, 'time'); },
        dateTime: function (d, opts) { return fmtDate(tag, d, opts, 'both'); },
        // A clock-style time (24-hour unless the person chose 12-hour), for
        // places that have always shown 14:05 whatever the language.
        clockTime: function (d, opts) {
          var o = { hour: '2-digit', minute: '2-digit' };
          if (opts) for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
          if (!loc.prefs.hourCycle && !o.hour12 && !o.hourCycle) o.hourCycle = 'h23';
          return fmtDate(tag, d, o, 'time');
        },
        // value in unit (B, KB, MB, GB, TB) with exactly `digits` decimals.
        size: function (value, unit, digits) {
          digits = digits || 0;
          // Rounded as toFixed rounds (the stored double), then localized:
          // Intl alone rounds the shortest decimal, so 2.55 would read 2.6.
          var nstr = fmtNumber(tag, Number(Number(value).toFixed(digits)), { useGrouping: false, minimumFractionDigits: digits, maximumFractionDigits: digits });
          return msg('common.size.' + unit, { n: nstr });
        },
        // Decimal units: 950 B, 12 KB, 3.4 MB, 1.2 GB.
        fileSize: function (bytes) {
          bytes = Number(bytes) || 0;
          if (bytes >= 1e12) return api.size(bytes / 1e12, 'TB', 1);
          if (bytes >= 1e9) return api.size(bytes / 1e9, 'GB', 1);
          if (bytes >= 1e6) return api.size(bytes / 1e6, 'MB', 1);
          if (bytes >= 1e3) return api.size(bytes / 1e3, 'KB', 0);
          return api.size(bytes, 'B', 0);
        },
        // A short elapsed time: 45s, 3m, 3m 20s.
        duration: function (ms) {
          var s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
          var m = Math.floor(s / 60), r = s % 60;
          var key = s < 60 ? 'common.dur.s' : r ? 'common.dur.ms' : 'common.dur.m';
          return words(key, { s: n0(s < 60 ? s : r), m: n0(m) }, Intl.DurationFormat ? function () {
            return new Intl.DurationFormat(ui, { style: 'narrow' }).format(s < 60 ? { seconds: s } : r ? { minutes: m, seconds: r } : { minutes: m });
          } : null);
        },
        // 4:07, 1:02:09 — a running timer.
        clock: function (sec) {
          sec = Math.max(0, Math.floor(Number(sec) || 0));
          var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
          var two = function (v) { return fmtNumber(tag, v, { minimumIntegerDigits: 2, useGrouping: false }); };
          return h ? n0(h) + ':' + two(m) + ':' + two(s) : n0(Math.floor(sec / 60)) + ':' + two(s);
        },
        // just now, 5m ago, 3h ago, 2d ago.
        relative: function (ts, now) {
          var s = Math.max(0, ((now || Date.now()) - (Number(ts) || 0)) / 1000);
          var unit = s < 60 ? '' : s < 3600 ? 'm' : s < 86400 ? 'h' : 'd';
          var v = unit === 'm' ? Math.floor(s / 60) : unit === 'h' ? Math.floor(s / 3600) : Math.floor(s / 86400);
          var rtf = Intl.RelativeTimeFormat ? function () {
            var f = new Intl.RelativeTimeFormat(ui, { numeric: 'auto', style: 'narrow' });
            return unit ? f.format(-v, { m: 'minute', h: 'hour', d: 'day' }[unit]) : f.format(0, 'second');
          } : null;
          return unit ? words('common.ago.' + unit, { n: n0(v) }, rtf) : words('common.ago.now', {}, rtf);
        },
        list: function (items, opts) {
          try { return new Intl.ListFormat(ui, opts || { type: 'conjunction' }).format(items); } catch (e) { return items.join(', '); }
        },
        plural: function (n, ordinal) { return pluralCat(ui, n, ordinal); }
      };
      return api;
    }

    // A catalog lookup over locales best-first (`cats[locale]` = flat key map).
    function lookup(cats, chainList, key) {
      for (var i = 0; i < chainList.length; i++) {
        var c = cats[chainList[i]];
        if (c && Object.prototype.hasOwnProperty.call(c, key)) return { msg: c[key], locale: chainList[i] };
      }
      if (Object.prototype.hasOwnProperty.call(BUILTIN, key)) return { msg: BUILTIN[key], locale: 'en' };
      return null;
    }
    // The translator: t(key, params) over `cats`, recording misses in `miss`.
    function translator(locGet, cats, miss) {
      return function (key, params) {
        var loc = locGet();
        var hit = lookup(cats, loc.catalogs.concat(['en']), key);
        if (!hit) { if (miss) miss[key] = 1; return key; }
        try { return format(hit.msg, params, loc.tag, hit.locale); }
        catch (e) { if (miss) miss[key] = 1; return String(hit.msg); }
      };
    }

    return {
      BUILTIN: BUILTIN, canon: canon, parts: parts, chain: chain, resolve: resolve,
      parse: parse, format: format, argsOf: argsOf, pluralCat: pluralCat,
      makeFmt: makeFmt, lookup: lookup, translator: translator
    };
  }

  var C = core();

  // ---- this page ------------------------------------------------------------
  var ls = null;
  try { ls = root.localStorage || null; } catch (e) { ls = null; }
  function readPrefs() {
    try {
      var p = JSON.parse((ls && ls.getItem(PREF_KEY)) || 'null');
      return (p && typeof p === 'object') ? p : {};
    } catch (e) { return {}; }
  }
  function navLangs() {
    var n = root.navigator || {};
    if (n.languages && n.languages.length) return Array.prototype.slice.call(n.languages);
    return n.language ? [n.language] : [];
  }
  // Catalogs live beside js/: <site>/i18n/. Resolved against this script's own
  // URL, so an archived build under /versions/<v>/ reads its own catalogs and a
  // page at a pretty path (/meet/<room>) still finds them.
  var selfSrc = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var catBase = '';
  try { catBase = selfSrc ? new URL('../i18n/', selfSrc).href : 'i18n/'; } catch (e) { catBase = 'i18n/'; }

  var prefs = readPrefs();
  var loc = C.resolve(navLangs(), prefs, LOCALES);
  var cats = {};         // locale -> merged flat map of every loaded surface
  var fetched = {};      // 'locale/surface' -> Promise
  var surfaces = {};     // surfaces asked for on this page (reloaded on a change)
  var miss = {};
  var listeners = [];
  var t = C.translator(function () { return loc; }, cats, miss);
  var local = function (key) {
    for (var i = 0; i < loc.catalogs.length; i++) {
      var l = loc.catalogs[i];
      if (l === BASE) break;
      if (cats[l] && Object.prototype.hasOwnProperty.call(cats[l], key)) return true;
    }
    return false;
  };
  var fmt = {};
  function rebind() {
    var f = C.makeFmt(loc, t, local);
    for (var k in f) if (Object.prototype.hasOwnProperty.call(f, k)) fmt[k] = f[k];
  }
  rebind();

  function fetchCatalog(l, surface) {
    var id = l + '/' + surface;
    if (fetched[id]) return fetched[id];
    var url = catBase + l + '/' + surface + '.json';
    var p = (typeof root.fetch === 'function')
      ? root.fetch(url).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
      : Promise.resolve({});
    fetched[id] = p.then(function (obj) {
      if (!obj || typeof obj !== 'object') return;
      var into = cats[l] || (cats[l] = {});
      for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && typeof obj[k] === 'string') into[k] = obj[k];
    });
    return fetched[id];
  }
  // load('settings') or load(['desktop', 'apps/notes']) -> Promise, resolved
  // once every catalog the active locale needs for them is in (or has failed:
  // a missing file reads as missing keys, never as a rejection).
  function load(list) {
    list = [].concat(list || []);
    var jobs = [];
    var want = loc.catalogs.indexOf(BASE) === -1 ? loc.catalogs.concat([BASE]) : loc.catalogs;
    for (var i = 0; i < list.length; i++) {
      var sname = String(list[i] || '').replace(/[^a-z0-9/_-]/gi, '');
      if (!sname) continue;
      surfaces[sname] = 1;
      for (var j = 0; j < want.length; j++) jobs.push(fetchCatalog(want[j], sname));
    }
    return Promise.all(jobs).then(function () { return api.locale(); });
  }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function emit() {
    try { if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = loc.ui; } catch (e) {}
    var snap = copy(loc);
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](snap); } catch (e) {} }
    try { if (typeof root.dispatchEvent === 'function' && typeof CustomEvent === 'function') root.dispatchEvent(new CustomEvent('gifos:localechange', { detail: snap })); } catch (e) {}
  }
  // Re-resolve after a settings or browser change; listeners hear it once the
  // catalogs this page already uses are in for the new locale.
  function refresh() {
    var before = JSON.stringify(loc);
    prefs = readPrefs();
    loc = C.resolve(navLangs(), prefs, LOCALES);
    rebind();
    if (JSON.stringify(loc) === before) return Promise.resolve(copy(loc));
    return load(Object.keys(surfaces)).then(function () { emit(); return copy(loc); });
  }
  function setPrefs(p) {
    p = p || {};
    var clean = {};
    var lang = C.canon(p.language || '');
    if (lang) clean.language = lang;
    if (p.region && /^([A-Za-z]{2}|\d{3})$/.test(p.region)) clean.region = String(p.region).toUpperCase();
    if (/^h(11|12|23|24)$/.test(p.hourCycle || '')) clean.hourCycle = p.hourCycle;
    try {
      if (ls) { if (Object.keys(clean).length) ls.setItem(PREF_KEY, JSON.stringify(clean)); else ls.removeItem(PREF_KEY); }
    } catch (e) {}
    return refresh();
  }

  if (typeof root.addEventListener === 'function') {
    root.addEventListener('storage', function (e) { if (!e || e.key === PREF_KEY || e.key === null) refresh(); });
    root.addEventListener('languagechange', function () { refresh(); });
  }

  var api = {
    LOCALES: LOCALES.slice(),
    BASE: BASE,
    PREF_KEY: PREF_KEY,
    // The resolved locale: { tag (BCP 47, with -u-hc- when a clock is chosen),
    // baseName, language, script, region, ui (the catalog language shown),
    // dir, hourCycle, hour12, timeZone, calendar, numberingSystem, browser,
    // prefs, source: 'browser' | 'settings' }.
    locale: function () { return copy(loc); },
    // Cheap reads for hot paths (no copy): the formatting language, the UI
    // language (the catalog shown) and the full tag.
    language: function () { return loc.language; },
    ui: function () { return loc.ui; },
    tag: function () { return loc.tag; },
    prefs: function () { return copy(loc.prefs); },
    setPrefs: setPrefs,
    refresh: refresh,
    onChange: function (cb) {
      if (typeof cb !== 'function') return function () {};
      listeners.push(cb);
      return function () { var i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
    },
    load: load,
    t: t,
    // Is there text for key (in the active locale or en) right now?
    has: function (key) { return !!C.lookup(cats, loc.catalogs.concat([BASE]), key); },
    format: function (msg, params) { return C.format(msg, params, loc.tag, loc.ui); },
    fmt: fmt,
    // Keys asked for on this page that no loaded catalog had (dev check).
    missing: function () { return Object.keys(miss).sort(); },
    catalogUrl: function (l, surface) { return catBase + l + '/' + surface + '.json'; },
    // The self-contained core, for the runtime to hand to app frames.
    core: core
  };
  GifOS.i18n = api;
  try { if (typeof document !== 'undefined' && document.documentElement && !document.documentElement.lang) document.documentElement.lang = loc.ui; } catch (e) {}
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
