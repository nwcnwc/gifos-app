/*
 * GifOS Calendar: iCalendar (RFC 5545). Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * Read and write a calendar file: events, repeats, zones, alarms and invitations.
 * One file, no network. A page can include it, and Node can require it.
 * A floating time (no zone) keeps its clock digits; a zoned time is that zone's wall clock.
 */
(function (root) {
  'use strict';

  var DAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  var DAYN = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  // Names Outlook writes, and the zone a person means by them. Intl does not know the Windows names.
  var WINDOWS = {
    'eastern standard time': 'America/New_York',
    'us eastern standard time': 'America/Indianapolis',
    'central standard time': 'America/Chicago',
    'mountain standard time': 'America/Denver',
    'us mountain standard time': 'America/Phoenix',
    'pacific standard time': 'America/Los_Angeles',
    'alaskan standard time': 'America/Anchorage',
    'hawaiian standard time': 'Pacific/Honolulu',
    'atlantic standard time': 'America/Halifax',
    'newfoundland standard time': 'America/St_Johns',
    'canada central standard time': 'America/Regina',
    'sa pacific standard time': 'America/Bogota',
    'sa western standard time': 'America/La_Paz',
    'pacific sa standard time': 'America/Santiago',
    'e. south america standard time': 'America/Sao_Paulo',
    'sa eastern standard time': 'America/Cayenne',
    'central standard time (mexico)': 'America/Mexico_City',
    'mountain standard time (mexico)': 'America/Chihuahua',
    'gmt standard time': 'Europe/London',
    'greenwich standard time': 'Atlantic/Reykjavik',
    'w. europe standard time': 'Europe/Berlin',
    'central europe standard time': 'Europe/Budapest',
    'central european standard time': 'Europe/Warsaw',
    'romance standard time': 'Europe/Paris',
    'fle standard time': 'Europe/Kiev',
    'gtb standard time': 'Europe/Bucharest',
    'russian standard time': 'Europe/Moscow',
    'turkey standard time': 'Europe/Istanbul',
    'israel standard time': 'Asia/Jerusalem',
    'arab standard time': 'Asia/Riyadh',
    'arabic standard time': 'Asia/Baghdad',
    'iran standard time': 'Asia/Tehran',
    'arabian standard time': 'Asia/Dubai',
    'pakistan standard time': 'Asia/Karachi',
    'india standard time': 'Asia/Kolkata',
    'se asia standard time': 'Asia/Bangkok',
    'china standard time': 'Asia/Shanghai',
    'singapore standard time': 'Asia/Singapore',
    'taipei standard time': 'Asia/Taipei',
    'tokyo standard time': 'Asia/Tokyo',
    'korea standard time': 'Asia/Seoul',
    'aus eastern standard time': 'Australia/Sydney',
    'e. australia standard time': 'Australia/Brisbane',
    'cen. australia standard time': 'Australia/Adelaide',
    'w. australia standard time': 'Australia/Perth',
    'new zealand standard time': 'Pacific/Auckland',
    'south africa standard time': 'Africa/Johannesburg',
    'egypt standard time': 'Africa/Cairo',
    'utc': 'UTC'
  };

  var fmtCache = {};
  var knownCache = {};
  var zoneRules = {};   // TZID -> rules read from a file, for a name Intl does not know
  var warnSink = null;

  function warn(msg) {
    if (warnSink && warnSink.indexOf(msg) < 0) warnSink.push(msg);
  }

  function pad(n, w) {
    var s = String(Math.trunc(Math.abs(n)));
    w = w || 2;
    while (s.length < w) s = '0' + s;
    return s;
  }
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0); }
  function daysInMonth(y, m) {
    return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] || 30;
  }
  function weekday(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
  function addDays(p, n) {
    var dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), hh: p.hh || 0, mm: p.mm || 0, ss: p.ss || 0 };
  }
  function daysBetween(a, b) {
    return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
  }
  function cmpParts(a, b) {
    return (a.y - b.y) || (a.m - b.m) || (a.d - b.d) || ((a.hh || 0) - (b.hh || 0)) || ((a.mm || 0) - (b.mm || 0)) || ((a.ss || 0) - (b.ss || 0));
  }
  function dateFromParts(p) { return pad(p.y, 4) + '-' + pad(p.m) + '-' + pad(p.d); }
  function localFromParts(p) {
    return dateFromParts(p) + 'T' + pad(p.hh || 0) + ':' + pad(p.mm || 0) + ':' + pad(p.ss || 0);
  }
  function formatUtc(ms) {
    var d = new Date(ms);
    return localFromParts({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mm: d.getUTCMinutes(), ss: d.getUTCSeconds() });
  }
  function wallToUtcMs(s) {
    var p = partsFromLocal(s);
    if (!p) return NaN;
    return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
  }
  function partsFromLocal(s) {
    if (s == null) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(s));
    if (!m) return null;
    return { y: +m[1], m: +m[2], d: +m[3], hh: m[4] != null ? +m[4] : 0, mm: m[5] != null ? +m[5] : 0, ss: m[6] != null ? +m[6] : 0 };
  }
  function partsFromCompact(v) {
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/.exec(String(v || ''));
    if (!m) return null;
    return { y: +m[1], m: +m[2], d: +m[3], hh: m[4] != null ? +m[4] : 0, mm: m[5] != null ? +m[5] : 0, ss: m[6] != null ? +m[6] : 0, hasTime: m[4] != null };
  }
  function compactOf(local) { return String(local || '').replace(/[-:]/g, ''); }

  function resolveTzid(tzid) {
    if (tzid == null) return '';
    var raw = String(tzid).trim();
    if (!raw) return '';
    var mapped = WINDOWS[raw.toLowerCase()];
    return mapped || raw;
  }
  function isUtcZone(tzid) {
    var z = String(tzid || '').toUpperCase();
    return z === 'UTC' || z === 'ETC/UTC' || z === 'ETC/GMT' || z === 'GMT' || z === 'Z';
  }
  function zoneKnown(tz) {
    if (!tz || isUtcZone(tz)) return true;
    if (knownCache[tz] != null) return knownCache[tz];
    try {
      Intl.DateTimeFormat('en-US', { timeZone: tz });
      knownCache[tz] = true;
    } catch (e) { knownCache[tz] = false; }
    return knownCache[tz];
  }

  // Wall clock of an instant in a zone. hour 24 (some engines, at midnight) is rolled to the next day.
  function utcToZoned(ms, tzid) {
    if (typeof ms !== 'number' || isNaN(ms)) return '';
    var zone = resolveTzid(tzid);
    if (!zone || isUtcZone(zone)) return formatUtc(ms);
    if (!zoneKnown(zone)) {
      var rules = zoneRules[tzid] || zoneRules[zone];
      if (rules) return utcToZonedByRules(ms, rules);
      warn('unknown timezone: ' + tzid);
      return formatUtc(ms);
    }
    var dtf = fmtCache[zone];
    if (!dtf) {
      dtf = fmtCache[zone] = new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
    var map = {}, parts = dtf.formatToParts(new Date(ms)), i;
    for (i = 0; i < parts.length; i++) map[parts[i].type] = parts[i].value;
    var p = { y: +map.year, m: +map.month, d: +map.day, hh: +map.hour, mm: +map.minute, ss: +map.second };
    if (p.hh === 24) { p.hh = 0; p = addDays(p, 1); p.hh = 0; }
    return localFromParts(p);
  }

  // Offset of a zone at an instant: wall-as-UTC minus the instant. New York in winter is -5 hours.
  function offsetAt(ms, zone) {
    return wallToUtcMs(utcToZoned(ms, zone)) - ms;
  }

  // A local time that does not exist (the spring gap) moves forward by the gap.
  // A local time that exists twice (the fall overlap) is the earlier instant.
  function zonedToUtc(localStr, tzid) {
    var zone = resolveTzid(tzid);
    if (!localStr) return NaN;
    if (!zone || isUtcZone(zone)) return wallToUtcMs(localStr);
    if (!zoneKnown(zone)) {
      var rules = zoneRules[tzid] || zoneRules[zone];
      if (rules) return zonedByRules(localStr, rules);
      warn('unknown timezone: ' + tzid);
      return wallToUtcMs(localStr);
    }
    var desired = wallToUtcMs(localStr);
    if (isNaN(desired)) return NaN;
    var base = offsetAt(desired, zone);
    var utc1 = desired - base;
    var off2 = offsetAt(utc1, zone);
    var utc2 = desired - off2;
    var probes = [desired, utc1, utc2, utc1 - 10800000, utc1 + 10800000, utc2 - 10800000, utc2 + 10800000];
    var offs = {}, i;
    for (i = 0; i < probes.length; i++) offs[offsetAt(probes[i], zone)] = 1;
    var valids = [];
    for (var k in offs) {
      if (!Object.prototype.hasOwnProperty.call(offs, k)) continue;
      var off = +k, u = desired - off;
      if (offsetAt(u, zone) === off) valids.push(u);
    }
    if (valids.length) return Math.min.apply(null, valids);
    var best = null, bestRec = Infinity;
    var cands = [utc1, utc2];
    for (i = 0; i < cands.length; i++) {
      var u2 = cands[i], rec = u2 + offsetAt(u2, zone);
      if (rec > desired && rec < bestRec) { best = u2; bestRec = rec; }
    }
    return best == null ? utc1 : best;
  }

  function fixedOffset(rules) {
    var obs = rules && rules.observances;
    if (!obs || !obs.length) return null;
    var i, off = obs[0].offsetTo;
    for (i = 0; i < obs.length; i++) {
      if (obs[i].rrule || obs[i].offsetTo !== off || obs[i].offsetFrom !== off) return null;
    }
    return off;
  }
  function nthWeekday(y, m, wd, n) {
    var dim = daysInMonth(y, m);
    if (n > 0) {
      var first = weekday(y, m, 1);
      var d = 1 + ((wd - first + 7) % 7) + (n - 1) * 7;
      return d <= dim ? d : 0;
    }
    if (n < 0) {
      var last = weekday(y, m, dim);
      var d2 = dim - ((last - wd + 7) % 7) + (n + 1) * 7;
      return d2 >= 1 ? d2 : 0;
    }
    return 0;
  }
  function tzTransitions(obs, year) {
    var out = [], r = obs.rrule, months, i, j, d, utc;
    if (!r) {
      if (obs.dtstart && obs.dtstart.y === year) {
        utc = Date.UTC(year, obs.dtstart.m - 1, obs.dtstart.d, obs.dtstart.hh, obs.dtstart.mm, obs.dtstart.ss) - obs.offsetFrom * 60000;
        out.push({ utc: utc, offsetFrom: obs.offsetFrom, offsetTo: obs.offsetTo });
      }
      return out;
    }
    months = (r.bymonth && r.bymonth.length) ? r.bymonth : [obs.dtstart.m];
    for (i = 0; i < months.length; i++) {
      var m = months[i], days = [];
      if (r.byday && r.byday.length) {
        for (j = 0; j < r.byday.length; j++) {
          var bd = r.byday[j];
          d = bd.n ? nthWeekday(year, m, DAYN[bd.day], bd.n) : obs.dtstart.d;
          if (d) days.push(d);
        }
      } else if (r.bymonthday && r.bymonthday.length) {
        for (j = 0; j < r.bymonthday.length; j++) {
          var md = r.bymonthday[j];
          d = md > 0 ? md : daysInMonth(year, m) + md + 1;
          if (d >= 1 && d <= daysInMonth(year, m)) days.push(d);
        }
      } else days.push(obs.dtstart.d);
      for (j = 0; j < days.length; j++) {
        if (days[j] < 1 || days[j] > daysInMonth(year, m)) continue;
        utc = Date.UTC(year, m - 1, days[j], obs.dtstart.hh, obs.dtstart.mm, obs.dtstart.ss) - obs.offsetFrom * 60000;
        out.push({ utc: utc, offsetFrom: obs.offsetFrom, offsetTo: obs.offsetTo });
      }
    }
    return out;
  }
  function transitionsNear(rules, year) {
    var trans = [], y, i;
    for (y = year - 1; y <= year + 1; y++) {
      for (i = 0; i < rules.observances.length; i++) trans = trans.concat(tzTransitions(rules.observances[i], y));
    }
    trans.sort(function (a, b) { return a.utc - b.utc; });
    return trans;
  }
  function offsetFromTrans(trans, utc) {
    var off = trans.length ? trans[0].offsetFrom : 0, i;
    for (i = 0; i < trans.length; i++) if (trans[i].utc <= utc) off = trans[i].offsetTo;
    return off;
  }
  function zonedByRules(localStr, rules) {
    var fixed = fixedOffset(rules);
    if (fixed != null) return wallToUtcMs(localStr) - fixed * 60000;
    var parts = partsFromLocal(localStr);
    if (!parts) return NaN;
    var trans = transitionsNear(rules, parts.y);
    var desired = wallToUtcMs(localStr);
    var offs = {}, i;
    for (i = 0; i < rules.observances.length; i++) {
      offs[rules.observances[i].offsetTo] = 1;
      offs[rules.observances[i].offsetFrom] = 1;
    }
    var valids = [];
    for (var k in offs) {
      if (!Object.prototype.hasOwnProperty.call(offs, k)) continue;
      var off = +k, u = desired - off * 60000;
      if (offsetFromTrans(trans, u) === off) valids.push(u);
    }
    if (valids.length) return Math.min.apply(null, valids);
    var best = null;
    for (k in offs) {
      if (!Object.prototype.hasOwnProperty.call(offs, k)) continue;
      off = +k; u = desired - off * 60000;
      var rec = u + offsetFromTrans(trans, u) * 60000;
      if (rec > desired && (best == null || u < best)) best = u;
    }
    return best == null ? desired : best;
  }
  function utcToZonedByRules(ms, rules) {
    var fixed = fixedOffset(rules);
    if (fixed != null) return formatUtc(ms + fixed * 60000);
    var guess = new Date(ms);
    var trans = transitionsNear(rules, guess.getUTCFullYear());
    var off = offsetFromTrans(trans, ms);
    return formatUtc(ms + off * 60000);
  }

  function utf8Len(cp) {
    if (cp <= 0x7F) return 1;
    if (cp <= 0x7FF) return 2;
    if (cp <= 0xFFFF) return 3;
    return 4;
  }
  // Fold on UTF-8 byte boundaries. A continuation line starts with one space, which counts toward 75.
  function fold(line) {
    var out = '', bytes = 0, i = 0;
    while (i < line.length) {
      var cp = line.codePointAt(i);
      var n = utf8Len(cp);
      var adv = cp > 0xFFFF ? 2 : 1;
      if (bytes + n > 75 && bytes > 0) { out += '\r\n '; bytes = 1; }
      out += line.slice(i, i + adv);
      bytes += n;
      i += adv;
    }
    return out;
  }
  function unfold(text) {
    return String(text || '').replace(/^\uFEFF/, '').replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '');
  }
  function escapeText(s) {
    return String(s == null ? '' : s).replace(/\r\n|\r/g, '\n').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  }
  function unescapeText(s) {
    var out = '', i;
    s = String(s == null ? '' : s);
    for (i = 0; i < s.length; i++) {
      if (s.charAt(i) === '\\' && i + 1 < s.length) {
        var n = s.charAt(++i);
        if (n === 'n' || n === 'N') out += '\n';
        else if (n === '\\' || n === ',' || n === ';') out += n;
        else out += n;
      } else out += s.charAt(i);
    }
    return out;
  }
  function paramText(v) {
    v = String(v == null ? '' : v);
    if (!v || /[;:, "]/.test(v)) return '"' + v.replace(/"/g, '') + '"';
    return v;
  }
  function parseLine(line) {
    var name = '', params = {}, i = 0;
    while (i < line.length && line.charAt(i) !== ';' && line.charAt(i) !== ':') i++;
    name = line.slice(0, i).toUpperCase();
    while (line.charAt(i) === ';') {
      i++;
      var ps = i;
      while (i < line.length && line.charAt(i) !== '=' && line.charAt(i) !== ';' && line.charAt(i) !== ':') i++;
      var pn = line.slice(ps, i).toUpperCase();
      var vals = [];
      if (line.charAt(i) === '=') {
        i++;
        if (line.charAt(i) === '"') {
          i++;
          var qs = i;
          while (i < line.length && line.charAt(i) !== '"') i++;
          vals.push(line.slice(qs, i));
          if (line.charAt(i) === '"') i++;
        } else {
          var vs = i;
          while (i < line.length && line.charAt(i) !== ';' && line.charAt(i) !== ':') i++;
          vals = line.slice(vs, i).split(',');
        }
      }
      params[pn] = vals.length <= 1 ? (vals[0] || '') : vals;
    }
    if (line.charAt(i) === ':') i++;
    return { name: name, params: params, value: line.slice(i) };
  }
  function pval(params, key) {
    var v = params && params[key];
    if (v == null) return '';
    return Array.isArray(v) ? String(v[0] || '') : String(v);
  }

  function parseByday(s) {
    var m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(String(s || '').trim());
    if (!m) return null;
    return { n: m[1] ? parseInt(m[1], 10) : 0, day: m[2].toUpperCase() };
  }
  function ints(v) {
    var p = String(v || '').split(','), out = [], i;
    for (i = 0; i < p.length && out.length < 366; i++) {
      if (!p[i]) continue;
      var n = parseInt(p[i], 10);
      if (!isNaN(n) && n !== 0) out.push(n);
    }
    return out;
  }
  function parseRRule(str) {
    var o = { freq: '', interval: 1, count: 0, until: '', byday: [], bymonthday: [], bymonth: [], bysetpos: [], byyearday: [], byweekno: [], wkst: 'MO' };
    if (!str) return o;
    var parts = String(str).replace(/\s+/g, '').split(';'), i;
    for (i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var eq = parts[i].indexOf('=');
      if (eq < 0) continue;
      var k = parts[i].slice(0, eq).toUpperCase();
      var v = parts[i].slice(eq + 1);
      if (k === 'FREQ') o.freq = v.toUpperCase();
      else if (k === 'INTERVAL') o.interval = Math.max(1, parseInt(v, 10) || 1);
      else if (k === 'COUNT') o.count = parseInt(v, 10) || 0;
      else if (k === 'UNTIL') o.until = v.toUpperCase();
      else if (k === 'WKST') o.wkst = (v || 'MO').toUpperCase();
      else if (k === 'BYDAY') {
        var ds = v.split(','), j;
        for (j = 0; j < ds.length && o.byday.length < 100; j++) {
          var bd = parseByday(ds[j]);
          if (bd) o.byday.push(bd);
        }
      } else if (k === 'BYMONTHDAY') o.bymonthday = ints(v);
      else if (k === 'BYMONTH') o.bymonth = ints(v);
      else if (k === 'BYSETPOS') o.bysetpos = ints(v);
      else if (k === 'BYYEARDAY') o.byyearday = ints(v);
      else if (k === 'BYWEEKNO') o.byweekno = ints(v);
    }
    if (!o.interval || o.interval < 1) o.interval = 1;
    // SU is 0, so a missing name is "not in the table", not a falsy index.
    if (DAYN[o.wkst] == null) o.wkst = 'MO';
    return o;
  }
  function formatRRule(o) {
    if (!o || !o.freq) return '';
    var p = ['FREQ=' + o.freq];
    if (o.interval && o.interval !== 1) p.push('INTERVAL=' + o.interval);
    if (o.bymonth && o.bymonth.length) p.push('BYMONTH=' + o.bymonth.join(','));
    if (o.byweekno && o.byweekno.length) p.push('BYWEEKNO=' + o.byweekno.join(','));
    if (o.byyearday && o.byyearday.length) p.push('BYYEARDAY=' + o.byyearday.join(','));
    if (o.bymonthday && o.bymonthday.length) p.push('BYMONTHDAY=' + o.bymonthday.join(','));
    if (o.byday && o.byday.length) {
      var ds = [], i;
      for (i = 0; i < o.byday.length; i++) ds.push((o.byday[i].n ? String(o.byday[i].n) : '') + o.byday[i].day);
      p.push('BYDAY=' + ds.join(','));
    }
    if (o.bysetpos && o.bysetpos.length) p.push('BYSETPOS=' + o.bysetpos.join(','));
    if (o.count) p.push('COUNT=' + o.count);
    if (o.until) p.push('UNTIL=' + o.until);
    if (o.wkst && o.wkst !== 'MO') p.push('WKST=' + o.wkst);
    return p.join(';');
  }

  // Signed minutes. -PT30M is -30, P1D is 1440, PT0S is 0. Null when it is not a duration.
  function parseDuration(s) {
    var m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(String(s || '').trim());
    if (!m) return null;
    if (!m[2] && !m[3] && !m[4] && !m[5] && !m[6]) return null;
    var sign = m[1] === '-' ? -1 : 1;
    var minutes = (+m[2] || 0) * 7 * 24 * 60 + (+m[3] || 0) * 24 * 60 + (+m[4] || 0) * 60 + (+m[5] || 0) + (+m[6] || 0) / 60;
    return sign * minutes;
  }
  function formatDuration(minutesBefore) {
    // Stored minutes are "before" the anchor. The wire duration is the opposite sign.
    var min = -(minutesBefore || 0);
    var sign = min < 0 ? '-' : '';
    var abs = Math.abs(min);
    if (abs === 0) return sign + 'PT0S';
    if (Math.abs(abs - Math.round(abs)) > 1e-6) return sign + 'PT' + Math.round(abs * 60) + 'S';
    abs = Math.round(abs);
    if (abs % (7 * 24 * 60) === 0) return sign + 'P' + (abs / (7 * 24 * 60)) + 'W';
    if (abs % (24 * 60) === 0) return sign + 'P' + (abs / (24 * 60)) + 'D';
    if (abs % 60 === 0) return sign + 'PT' + (abs / 60) + 'H';
    return sign + 'PT' + abs + 'M';
  }

  function blankEvent() {
    return {
      uid: '', title: '', notes: '', location: '', url: '',
      allDay: false, start: null, end: null, tzid: '', startLocal: '', endLocal: '',
      rrule: null, exdate: [], rdate: [], recurrenceId: null,
      alarms: [], status: '', sequence: 0, cal: '',
      organizer: null, attendees: [], meeting: null, created: '', modified: ''
    };
  }
  function person(name, email, cid, extra) {
    var o = { name: name || '', email: email || '', cid: cid || '' };
    if (extra) {
      o.partstat = extra.partstat || 'NEEDS-ACTION';
      o.role = extra.role || 'REQ-PARTICIPANT';
      o.rsvp = !!extra.rsvp;
    }
    return o;
  }
  function splitMailto(value) {
    var v = String(value || '').trim();
    var lower = v.toLowerCase();
    if (lower.indexOf('mailto:') === 0) return { email: v.slice(7), cid: '' };
    if (lower.indexOf('cid:') === 0) return { email: '', cid: v.slice(4) };
    if (v.indexOf('@') >= 0) return { email: v, cid: '' };
    return { email: '', cid: v };
  }
  function readPerson(prop, withRole) {
    var id = splitMailto(prop.value);
    var name = unescapeText(pval(prop.params, 'CN'));
    if (!withRole) return person(name, id.email, id.cid);
    return person(name, id.email, id.cid, {
      partstat: (pval(prop.params, 'PARTSTAT') || 'NEEDS-ACTION').toUpperCase(),
      role: (pval(prop.params, 'ROLE') || 'REQ-PARTICIPANT').toUpperCase(),
      rsvp: /^TRUE$/i.test(pval(prop.params, 'RSVP'))
    });
  }
  function canonStamp(v) {
    var z = /Z$/i.test(v);
    var p = partsFromCompact(String(v || '').replace(/Z$/i, ''));
    if (!p) return '';
    return localFromParts(p) + (z ? 'Z' : '');
  }
  function parseDateVal(value, params) {
    var v = String(value || '').trim();
    var z = /Z$/i.test(v);
    var p = partsFromCompact(v.replace(/Z$/i, ''));
    if (!p) return null;
    var valueType = pval(params, 'VALUE').toUpperCase();
    var allDay = valueType === 'DATE' || (!p.hasTime && valueType !== 'DATE-TIME');
    return { parts: p, z: z, allDay: allDay, tzid: pval(params, 'TZID') };
  }
  function instantFromParsed(dp, fallbackTzid) {
    if (!dp) return { ms: NaN, local: '', tzid: '', allDay: false, date: '' };
    if (dp.allDay) return { ms: Date.UTC(dp.parts.y, dp.parts.m - 1, dp.parts.d), local: '', tzid: '', allDay: true, date: dateFromParts(dp.parts) };
    var local = localFromParts(dp.parts);
    if (dp.z) return { ms: wallToUtcMs(local), local: local, tzid: 'UTC', allDay: false, date: dateFromParts(dp.parts) };
    var tz = resolveTzid(dp.tzid || fallbackTzid || '');
    if (dp.tzid && tz !== dp.tzid && WINDOWS[String(dp.tzid).toLowerCase()]) tz = resolveTzid(dp.tzid);
    return { ms: zonedToUtc(local, tz), local: local, tzid: tz, allDay: false, date: dateFromParts(dp.parts) };
  }
  function canonListItem(value, params, fallbackTzid) {
    var dp = parseDateVal(value, params || {});
    if (!dp) return '';
    if (dp.allDay) return dateFromParts(dp.parts);
    if (dp.z) return localFromParts(dp.parts) + 'Z';
    return localFromParts(dp.parts);
  }
  function listDates(prop, fallbackTzid) {
    var raw = String(prop.value || '').split(','), out = [], i;
    for (i = 0; i < raw.length; i++) {
      var c = canonListItem(raw[i].trim(), prop.params, fallbackTzid);
      if (c) out.push(c);
    }
    return out;
  }

  function normalizeAlarm(a) {
    a = a || {};
    return {
      action: (a.action === 'audio' || a.action === 'display') ? a.action : (String(a.action || 'display').toLowerCase() === 'audio' ? 'audio' : 'display'),
      minutes: typeof a.minutes === 'number' && !isNaN(a.minutes) ? a.minutes : 0,
      related: a.related === 'end' ? 'end' : 'start',
      absolute: a.absolute ? String(a.absolute) : ''
    };
  }
  function alarmFrom(node) {
    var a = { action: 'display', minutes: 0, related: 'start', absolute: '' }, i;
    for (i = 0; i < node.props.length; i++) {
      var p = node.props[i];
      if (p.name === 'ACTION') a.action = /AUDIO/i.test(p.value) ? 'audio' : 'display';
      else if (p.name === 'TRIGGER') {
        if (pval(p.params, 'VALUE').toUpperCase() === 'DATE-TIME' || /^\d{8}T/.test(p.value)) {
          var dp = parseDateVal(p.value, p.params);
          var inst = instantFromParsed(dp, '');
          if (!isNaN(inst.ms)) a.absolute = formatUtc(inst.ms) + 'Z';
        } else {
          var dur = parseDuration(p.value);
          if (dur == null) warn('alarm trigger ignored');
          else a.minutes = -dur;
          if (pval(p.params, 'RELATED').toUpperCase() === 'END') a.related = 'end';
        }
      }
    }
    return normalizeAlarm(a);
  }

  function eventFrom(node, calName) {
    var partial = blankEvent();
    partial.cal = '';
    var dtstart = null, dtend = null, duration = null, recur = null, i;
    var fallbackTz = '';
    for (i = 0; i < node.props.length; i++) {
      var p = node.props[i];
      if (p.name === 'UID') partial.uid = p.value.trim();
      else if (p.name === 'SUMMARY') partial.title = unescapeText(p.value);
      else if (p.name === 'DESCRIPTION') partial.notes = unescapeText(p.value);
      else if (p.name === 'LOCATION') partial.location = unescapeText(p.value);
      else if (p.name === 'URL') partial.url = p.value.trim();
      else if (p.name === 'STATUS') partial.status = p.value.trim().toUpperCase();
      else if (p.name === 'SEQUENCE') partial.sequence = parseInt(p.value, 10) || 0;
      else if (p.name === 'RRULE') partial.rrule = p.value.trim();
      else if (p.name === 'CREATED') partial.created = canonStamp(p.value.trim());
      else if (p.name === 'LAST-MODIFIED') partial.modified = canonStamp(p.value.trim());
      else if (p.name === 'DTSTART') dtstart = p;
      else if (p.name === 'DTEND') dtend = p;
      else if (p.name === 'DURATION') duration = parseDuration(p.value);
      else if (p.name === 'EXDATE') partial.exdate = partial.exdate.concat(listDates(p, fallbackTz));
      else if (p.name === 'RDATE') partial.rdate = partial.rdate.concat(listDates(p, fallbackTz));
      else if (p.name === 'RECURRENCE-ID') recur = p;
      else if (p.name === 'ORGANIZER') partial.organizer = readPerson(p, false);
      else if (p.name === 'ATTENDEE') partial.attendees.push(readPerson(p, true));
      else if (p.name === 'X-MICROSOFT-CDO-ALLDAYEVENT' && /^TRUE$/i.test(p.value.trim())) partial.allDay = true;
    }
    if (!dtstart) {
      warn('event without DTSTART');
      return null;
    }
    var start = instantFromParsed(parseDateVal(dtstart.value, dtstart.params), '');
    if (start.allDay) partial.allDay = true;
    if (partial.allDay || start.allDay) {
      partial.allDay = true;
      partial.tzid = '';
      partial.start = start.date;
      partial.startLocal = '';
      partial.endLocal = '';
      if (dtend) {
        var endA = instantFromParsed(parseDateVal(dtend.value, dtend.params), '');
        partial.end = endA.date || endA.local.slice(0, 10);
      } else if (duration != null && duration > 0) {
        partial.end = dateFromParts(addDays(start.parts || partsFromLocal(start.date), Math.round(duration / 1440) || 1));
      } else {
        partial.end = dateFromParts(addDays(partsFromLocal(partial.start), 1));
      }
    } else {
      partial.tzid = start.tzid || '';
      partial.start = start.ms;
      partial.startLocal = start.local;
      if (dtend) {
        var endB = instantFromParsed(parseDateVal(dtend.value, dtend.params), partial.tzid);
        partial.end = endB.ms;
        // Keep the end on the same wall clock as the start's zone, including when the file wrote the end in UTC.
        if (!endB.z && endB.local && (resolveTzid(endB.tzid || '') === partial.tzid || !endB.tzid)) partial.endLocal = endB.local;
        else partial.endLocal = utcToZoned(endB.ms, partial.tzid);
        if (endB.tzid && !partial.tzid) partial.tzid = endB.tzid;
      } else if (duration != null) {
        partial.end = start.ms + Math.round(duration * 60000);
        partial.endLocal = utcToZoned(partial.end, partial.tzid);
      } else {
        partial.end = start.ms;
        partial.endLocal = start.local;
      }
    }
    if (recur) {
      var rp = instantFromParsed(parseDateVal(recur.value, recur.params), partial.tzid);
      partial.recurrenceId = rp.allDay ? rp.date : rp.ms;
    }
    for (i = 0; i < node.children.length; i++) {
      if (node.children[i].name === 'VALARM') partial.alarms.push(alarmFrom(node.children[i]));
    }
    if (calName) partial.cal = '';
    return makeEvent(partial);
  }

  function readZone(node) {
    var tzid = '', obs = [], i;
    for (i = 0; i < node.props.length; i++) if (node.props[i].name === 'TZID') tzid = node.props[i].value.trim();
    for (i = 0; i < node.children.length; i++) {
      var c = node.children[i];
      if (c.name !== 'STANDARD' && c.name !== 'DAYLIGHT') continue;
      var o = { type: c.name, dtstart: { y: 1970, m: 1, d: 1, hh: 0, mm: 0, ss: 0 }, offsetFrom: 0, offsetTo: 0, rrule: null }, j;
      for (j = 0; j < c.props.length; j++) {
        var p = c.props[j];
        if (p.name === 'DTSTART') {
          var dp = partsFromCompact(p.value);
          if (dp) o.dtstart = dp;
        } else if (p.name === 'TZOFFSETFROM') o.offsetFrom = parseOffset(p.value);
        else if (p.name === 'TZOFFSETTO') o.offsetTo = parseOffset(p.value);
        else if (p.name === 'RRULE') o.rrule = parseRRule(p.value);
      }
      obs.push(o);
    }
    if (!tzid) return null;
    var rules = { id: tzid, observances: obs };
    zoneRules[tzid] = rules;
    var mapped = resolveTzid(tzid);
    if (mapped && mapped !== tzid) zoneRules[mapped] = rules;
    return rules;
  }
  function parseOffset(v) {
    var m = /^([+-])(\d{2})(\d{2})(\d{2})?$/.exec(String(v || '').trim());
    if (!m) return 0;
    var min = (+m[2]) * 60 + (+m[3]) + ((+m[4] || 0) / 60);
    return (m[1] === '-' ? -1 : 1) * min;
  }
  function formatOffset(min) {
    var sign = min < 0 ? '-' : '+';
    var a = Math.abs(Math.round(min));
    return sign + pad(Math.floor(a / 60)) + pad(a % 60);
  }

  function buildTree(text) {
    var lines = unfold(text).split('\n');
    var rootNode = { name: 'ROOT', props: [], children: [] };
    var stack = [rootNode], i;
    for (i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line) continue;
      var prop;
      try { prop = parseLine(line); } catch (e) { warn('bad line'); continue; }
      if (!prop.name) continue;
      if (prop.name === 'BEGIN') {
        var c = { name: String(prop.value || '').trim().toUpperCase(), props: [], children: [] };
        stack[stack.length - 1].children.push(c);
        stack.push(c);
      } else if (prop.name === 'END') {
        if (stack.length > 1) stack.pop();
      } else stack[stack.length - 1].props.push(prop);
    }
    return rootNode;
  }

  function parse(text) {
    var result = { prodid: '', calendars: [], events: [], timezones: {}, method: '', warnings: [] };
    var prev = warnSink;
    warnSink = result.warnings;
    try {
      if (text == null) return result;
      text = String(text);
      if (!text.trim()) return result;
      var tree = buildTree(text);
      walk(tree, result, null);
    } catch (e) {
      result.warnings.push('parse error');
    } finally {
      warnSink = prev;
    }
    return result;
  }
  function walk(node, result, cal) {
    var i;
    if (node.name === 'VCALENDAR') {
      var calendar = { name: '', color: '' }, method = '', prodid = '';
      for (i = 0; i < node.props.length; i++) {
        var p = node.props[i];
        if (p.name === 'PRODID') prodid = p.value.trim();
        else if (p.name === 'METHOD') method = p.value.trim().toUpperCase();
        else if (p.name === 'X-WR-CALNAME') calendar.name = unescapeText(p.value);
        else if (p.name === 'X-APPLE-CALENDAR-COLOR' || p.name === 'COLOR') calendar.color = p.value.trim();
      }
      if (!result.prodid && prodid) result.prodid = prodid;
      if (!result.method && method) result.method = method;
      result.calendars.push(calendar);
      for (i = 0; i < node.children.length; i++) {
        var ch = node.children[i];
        if (ch.name === 'VTIMEZONE') {
          var z = readZone(ch);
          if (z) result.timezones[z.id] = z;
        } else if (ch.name === 'VEVENT') {
          var ev = eventFrom(ch, calendar.name);
          if (ev) result.events.push(ev);
        } else if (ch.name === 'VTODO' || ch.name === 'VJOURNAL' || ch.name === 'VFREEBUSY') {
          continue;
        } else walk(ch, result, calendar);
      }
      return;
    }
    if (node.name === 'VEVENT') {
      var ev2 = eventFrom(node, cal && cal.name);
      if (ev2) result.events.push(ev2);
      return;
    }
    if (node.name === 'VTIMEZONE') {
      var z2 = readZone(node);
      if (z2) result.timezones[z2.id] = z2;
      return;
    }
    if (node.name === 'VTODO' || node.name === 'VJOURNAL' || node.name === 'VFREEBUSY') return;
    for (i = 0; i < node.children.length; i++) walk(node.children[i], result, cal);
  }

  function propOf(u, key) {
    if (!u) return '';
    var q = '';
    try { q = u.searchParams ? (u.searchParams.get(key) || '') : ''; } catch (e) { q = ''; }
    if (q) return q;
    var h = String(u.hash || '').replace(/^#/, '');
    var parts = h ? h.split('&') : [], i;
    for (i = 0; i < parts.length; i++) {
      var ix = parts[i].indexOf('=');
      if (ix < 0) continue;
      var k = parts[i].slice(0, ix);
      try { k = decodeURIComponent(k); } catch (e2) {}
      if (k !== key) continue;
      var val = parts[i].slice(ix + 1);
      try { return decodeURIComponent(val); } catch (e3) { return val; }
    }
    return '';
  }
  function isRoomLink(url) {
    var u;
    try { u = new URL(url); } catch (e) { return false; }
    if (u.protocol !== 'https:') return false;
    if (!propOf(u, 'room')) return false;
    var host = String(u.hostname || '').toLowerCase();
    if (host === 'gifos.app' || host.slice(-10) === '.gifos.app') return true;
    return !!(propOf(u, 'v') || propOf(u, 'av'));
  }
  function meetingLink(event) {
    if (!event) return '';
    var fields = [event.url, event.location, event.notes], f;
    for (f = 0; f < fields.length; f++) {
      var text = String(fields[f] || '');
      var re = /https:\/\/[^\s<>"']+/g, m;
      while ((m = re.exec(text))) {
        var url = m[0].replace(/[),.;]+$/g, '');
        if (isRoomLink(url)) return url;
      }
    }
    return '';
  }
  function meetingFrom(event) {
    var link = meetingLink(event);
    if (!link) return null;
    var u;
    try { u = new URL(link); } catch (e) { return null; }
    var path = u.pathname || '';
    var mode = /\/cast(?:\.html)?(?:\/|$)/i.test(path) ? 'cast' : 'meet';
    return { room: propOf(u, 'room') || '', v: propOf(u, 'v') || '', mode: mode };
  }

  function makeEvent(partial) {
    var e = blankEvent();
    partial = partial || {};
    var keys = Object.keys(e), i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (partial[k] !== undefined && partial[k] !== null) e[k] = partial[k];
    }
    if (!e.uid) e.uid = uid();
    e.title = e.title == null ? '' : String(e.title);
    e.notes = e.notes == null ? '' : String(e.notes);
    e.location = e.location == null ? '' : String(e.location);
    e.url = e.url == null ? '' : String(e.url);
    e.status = e.status ? String(e.status).toUpperCase() : '';
    e.sequence = parseInt(e.sequence, 10) || 0;
    e.cal = e.cal == null ? '' : String(e.cal);
    e.created = e.created ? canonStamp(String(e.created).replace(/[-:]/g, '').replace(/(\d{8})(\d{6})/, '$1T$2')) || String(e.created) : '';
    if (e.created && e.created.indexOf('-') < 0) e.created = canonStamp(e.created);
    e.modified = e.modified ? (String(e.modified).indexOf('-') >= 0 ? String(e.modified) : canonStamp(e.modified)) : '';
    e.allDay = !!e.allDay;
    e.exdate = canonDateList(e.exdate);
    e.rdate = canonDateList(e.rdate);
    e.attendees = normAttendees(e.attendees);
    e.organizer = e.organizer ? person(e.organizer.name, e.organizer.email, e.organizer.cid) : null;
    e.alarms = normAlarms(e.alarms);
    if (typeof e.rrule === 'string') e.rrule = parseRRule(e.rrule);
    else if (e.rrule && e.rrule.freq) e.rrule = parseRRule(formatRRule(e.rrule));
    else e.rrule = null;
    if (e.rrule && !e.rrule.freq) e.rrule = null;
    if (e.allDay) {
      e.tzid = '';
      e.start = canonDateOnly(e.start);
      e.end = canonDateOnly(e.end) || dateFromParts(addDays(partsFromLocal(e.start) || { y: 1970, m: 1, d: 1 }, 1));
      e.startLocal = '';
      e.endLocal = '';
      e.recurrenceId = e.recurrenceId ? canonDateOnly(e.recurrenceId) : null;
    } else {
      e.tzid = resolveTzid(e.tzid || '');
      if (e.startLocal && typeof e.start !== 'number') e.start = zonedToUtc(e.startLocal, e.tzid);
      else if (typeof e.start === 'number' && !e.startLocal) e.startLocal = utcToZoned(e.start, e.tzid);
      if (e.endLocal && typeof e.end !== 'number') e.end = zonedToUtc(e.endLocal, e.tzid);
      else if (typeof e.end === 'number' && !e.endLocal) e.endLocal = utcToZoned(e.end, e.tzid);
      if (typeof e.start !== 'number' || isNaN(e.start)) e.start = 0;
      if (typeof e.end !== 'number' || isNaN(e.end)) {
        e.end = e.start + 3600000;
        e.endLocal = utcToZoned(e.end, e.tzid);
      }
      if (!e.startLocal) e.startLocal = utcToZoned(e.start, e.tzid);
      if (!e.endLocal) e.endLocal = utcToZoned(e.end, e.tzid);
      if (e.recurrenceId == null || e.recurrenceId === '') e.recurrenceId = null;
      else if (typeof e.recurrenceId !== 'number') e.recurrenceId = recurrenceMs(e.recurrenceId, e.tzid);
    }
    var found = meetingFrom(e);
    if (found) e.meeting = found;
    else if (!e.meeting || !e.meeting.room) e.meeting = null;
    return e;
  }
  function canonDateOnly(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return formatUtc(v).slice(0, 10);
    var p = partsFromLocal(v) || partsFromCompact(v);
    return p ? dateFromParts(p) : '';
  }
  function canonDateList(list) {
    var out = [], i;
    if (!list) return out;
    for (i = 0; i < list.length; i++) {
      var v = list[i];
      if (v == null || v === '') continue;
      if (typeof v === 'number') { out.push(formatUtc(v) + 'Z'); continue; }
      var s = String(v).trim();
      var z = /Z$/i.test(s);
      var p = partsFromLocal(s) || partsFromCompact(s.replace(/Z$/i, ''));
      if (!p) continue;
      if (!/[T ]/.test(s) && !/T/.test(s.replace(/Z$/i, '')) && s.replace(/Z$/i, '').indexOf('T') < 0 && /^\d{8}$/.test(s.replace(/-/g, ''))) out.push(dateFromParts(p));
      else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) out.push(s);
      else out.push(localFromParts(p) + (z ? 'Z' : ''));
    }
    return out;
  }
  function recurrenceMs(v, tzid) {
    var s = String(v).trim();
    if (/Z$/i.test(s)) return wallToUtcMs(canonStamp(s).replace(/Z$/, ''));
    var dashed = canonStamp(s);
    if (!dashed) return 0;
    return zonedToUtc(dashed.replace(/Z$/, ''), tzid);
  }
  function normAttendees(list) {
    var out = [], i;
    if (!list) return out;
    for (i = 0; i < list.length; i++) {
      var a = list[i] || {};
      out.push(person(a.name, a.email, a.cid, {
        partstat: a.partstat || 'NEEDS-ACTION',
        role: a.role || 'REQ-PARTICIPANT',
        rsvp: a.rsvp
      }));
    }
    return out;
  }
  function normAlarms(list) {
    var out = [], i;
    if (!list) return out;
    for (i = 0; i < list.length; i++) out.push(normalizeAlarm(list[i]));
    return out;
  }

  function writeLines(rows) {
    var out = [], i;
    for (i = 0; i < rows.length; i++) if (rows[i]) out.push(fold(rows[i]));
    return out.join('\r\n');
  }
  function writePerson(prop, o, withRole) {
    if (!o) return '';
    var params = [];
    if (o.name) params.push('CN=' + paramText(o.name));
    if (withRole) {
      if (o.partstat && o.partstat !== 'NEEDS-ACTION') params.push('PARTSTAT=' + o.partstat);
      if (o.role && o.role !== 'REQ-PARTICIPANT') params.push('ROLE=' + o.role);
      if (o.rsvp) params.push('RSVP=TRUE');
    }
    var val = o.email ? 'mailto:' + o.email : (o.cid ? 'cid:' + o.cid : 'mailto:');
    return prop + (params.length ? ';' + params.join(';') : '') + ':' + val;
  }
  function writeWhen(prop, e, which) {
    if (e.allDay) {
      var d = which === 'start' ? e.start : e.end;
      return prop + ';VALUE=DATE:' + String(d || '').replace(/-/g, '');
    }
    var local = which === 'start' ? e.startLocal : e.endLocal;
    var compact = compactOf(local);
    if (!e.tzid || isUtcZone(e.tzid)) {
      if (isUtcZone(e.tzid)) return prop + ':' + compact + 'Z';
      return prop + ':' + compact;
    }
    return prop + ';' + tzidParam(e.tzid) + ':' + compact;
  }
  function tzidParam(tz) {
    if (/[;:,"]/.test(tz) || /\s/.test(tz)) return 'TZID=' + paramText(tz);
    return 'TZID=' + tz;
  }
  function writeEx(prop, list, e) {
    if (!list || !list.length) return [];
    var rows = [], i;
    for (i = 0; i < list.length; i++) {
      var v = list[i];
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) rows.push(prop + ';VALUE=DATE:' + v.replace(/-/g, ''));
      else if (/Z$/.test(v)) rows.push(prop + ':' + compactOf(v.slice(0, 19)) + 'Z');
      else if (e.tzid && !isUtcZone(e.tzid)) rows.push(prop + ';' + tzidParam(e.tzid) + ':' + compactOf(v));
      else if (isUtcZone(e.tzid)) rows.push(prop + ':' + compactOf(v) + 'Z');
      else rows.push(prop + ':' + compactOf(v));
    }
    return rows;
  }
  function writeRecur(e) {
    if (e.recurrenceId == null || e.recurrenceId === '') return '';
    if (e.allDay) return 'RECURRENCE-ID;VALUE=DATE:' + String(e.recurrenceId).replace(/-/g, '');
    if (!e.tzid || isUtcZone(e.tzid)) return 'RECURRENCE-ID:' + compactOf(formatUtc(e.recurrenceId)) + 'Z';
    return 'RECURRENCE-ID;' + tzidParam(e.tzid) + ':' + compactOf(utcToZoned(e.recurrenceId, e.tzid));
  }
  function writeAlarm(a) {
    var rows = ['BEGIN:VALARM', 'ACTION:' + (a.action === 'audio' ? 'AUDIO' : 'DISPLAY')];
    if (a.absolute) rows.push('TRIGGER;VALUE=DATE-TIME:' + compactOf(a.absolute.slice(0, 19)) + 'Z');
    else {
      var rel = a.related === 'end' ? ';RELATED=END' : '';
      rows.push('TRIGGER' + rel + ':' + formatDuration(a.minutes));
    }
    rows.push('END:VALARM');
    return rows;
  }
  function writeStamp(ms) { return compactOf(formatUtc(ms)) + 'Z'; }

  function offsetMinutes(ms, tz) { return Math.round(offsetAt(ms, tz) / 60000); }
  function vtimezoneFor(tzid, years) {
    if (!tzid || isUtcZone(tzid) || !zoneKnown(tzid)) {
      var rules = zoneRules[tzid];
      return rules ? vtimezoneFromRules(tzid, rules) : [];
    }
    var year = years && years.length ? years[0] : new Date().getUTCFullYear();
    var trans = findTransitions(tzid, year);
    var rows = ['BEGIN:VTIMEZONE', 'TZID:' + tzid];
    if (!trans.length) {
      var off = offsetMinutes(Date.UTC(year, 0, 15, 12), tzid);
      rows.push('BEGIN:STANDARD');
      rows.push('DTSTART:' + year + '0101T000000');
      rows.push('TZOFFSETFROM:' + formatOffset(off));
      rows.push('TZOFFSETTO:' + formatOffset(off));
      rows.push('END:STANDARD');
    } else {
      var i;
      for (i = 0; i < trans.length && i < 2; i++) rows = rows.concat(observanceLines(trans[i]));
    }
    rows.push('END:VTIMEZONE');
    return rows;
  }
  function findTransitions(tzid, year) {
    var out = [];
    var prevT = Date.UTC(year, 0, 1, 12, 0, 0);
    var prev = offsetMinutes(prevT, tzid);
    var d;
    for (d = 1; d <= 370; d++) {
      var t = Date.UTC(year, 0, 1 + d, 12, 0, 0);
      if (t >= Date.UTC(year + 1, 0, 2)) break;
      var off = offsetMinutes(t, tzid);
      if (off !== prev) {
        var lo = t - 86400000, hi = t;
        while (hi - lo > 60000) {
          var mid = lo + Math.floor((hi - lo) / 120000) * 60000;
          if (mid <= lo) mid = lo + 60000;
          if (offsetMinutes(mid, tzid) === prev) lo = mid;
          else hi = mid;
        }
        var at = hi;
        var wallMs = at + prev * 60000;
        var wall = formatUtc(wallMs);
        var p = partsFromLocal(wall);
        out.push({ at: at, from: prev, to: off, wall: p });
        prev = off;
      }
    }
    return out;
  }
  function observanceLines(tr) {
    var p = tr.wall;
    var wd = weekday(p.y, p.m, p.d);
    var nth = Math.floor((p.d - 1) / 7) + 1;
    if (p.d + 7 > daysInMonth(p.y, p.m)) nth = -1;
    var kind = tr.to > tr.from ? 'DAYLIGHT' : 'STANDARD';
    var dt = pad(p.y, 4) + pad(p.m) + pad(p.d) + 'T' + pad(p.hh) + pad(p.mm) + pad(p.ss);
    return [
      'BEGIN:' + kind,
      'DTSTART:' + dt,
      'TZOFFSETFROM:' + formatOffset(tr.from),
      'TZOFFSETTO:' + formatOffset(tr.to),
      'RRULE:FREQ=YEARLY;BYMONTH=' + p.m + ';BYDAY=' + nth + DAY[wd],
      'END:' + kind
    ];
  }
  function vtimezoneFromRules(tzid, rules) {
    var rows = ['BEGIN:VTIMEZONE', 'TZID:' + tzid], i;
    for (i = 0; i < rules.observances.length; i++) {
      var o = rules.observances[i];
      var dt = pad(o.dtstart.y, 4) + pad(o.dtstart.m) + pad(o.dtstart.d) + 'T' + pad(o.dtstart.hh) + pad(o.dtstart.mm) + pad(o.dtstart.ss);
      rows.push('BEGIN:' + o.type);
      rows.push('DTSTART:' + dt);
      rows.push('TZOFFSETFROM:' + formatOffset(o.offsetFrom));
      rows.push('TZOFFSETTO:' + formatOffset(o.offsetTo));
      if (o.rrule && o.rrule.freq) rows.push('RRULE:' + formatRRule(o.rrule));
      rows.push('END:' + o.type);
    }
    rows.push('END:VTIMEZONE');
    return rows;
  }

  function serialize(cal) {
    try {
      cal = cal || {};
      var events = cal.events || [];
      var rows = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:' + (cal.prodid || '-//GifOS//Calendar//EN'), 'CALSCALE:GREGORIAN'];
      if (cal.method) rows.push('METHOD:' + String(cal.method).toUpperCase());
      if (cal.name) rows.push('X-WR-CALNAME:' + escapeText(cal.name));
      var zones = {}, years = {}, i;
      for (i = 0; i < events.length; i++) {
        var tz = events[i] && events[i].tzid;
        if (!tz || isUtcZone(tz)) continue;
        zones[tz] = 1;
        var y = eventYear(events[i]);
        if (!years[tz]) years[tz] = [];
        if (years[tz].indexOf(y) < 0) years[tz].push(y);
      }
      for (var tzid in zones) {
        if (!Object.prototype.hasOwnProperty.call(zones, tzid)) continue;
        rows = rows.concat(vtimezoneFor(tzid, years[tzid]));
      }
      for (i = 0; i < events.length; i++) rows = rows.concat(writeEvent(events[i]));
      rows.push('END:VCALENDAR');
      return writeLines(rows) + '\r\n';
    } catch (e) {
      return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GifOS//Calendar//EN\r\nEND:VCALENDAR\r\n';
    }
  }
  function eventYear(e) {
    if (!e) return new Date().getUTCFullYear();
    if (e.allDay && e.start) return parseInt(String(e.start).slice(0, 4), 10) || new Date().getUTCFullYear();
    if (e.startLocal) return parseInt(String(e.startLocal).slice(0, 4), 10) || new Date().getUTCFullYear();
    if (typeof e.start === 'number') return new Date(e.start).getUTCFullYear();
    return new Date().getUTCFullYear();
  }
  function writeEvent(event) {
    var e = event && event.uid ? event : makeEvent(event || {});
    var rows = ['BEGIN:VEVENT', 'UID:' + e.uid, 'DTSTAMP:' + writeStamp(Date.now()), 'SEQUENCE:' + (e.sequence || 0)];
    rows.push(writeWhen('DTSTART', e, 'start'));
    rows.push(writeWhen('DTEND', e, 'end'));
    if (e.title) rows.push('SUMMARY:' + escapeText(e.title));
    if (e.location) rows.push('LOCATION:' + escapeText(e.location));
    if (e.notes) rows.push('DESCRIPTION:' + escapeText(e.notes));
    if (e.url) rows.push('URL:' + e.url);
    if (e.status) rows.push('STATUS:' + e.status);
    if (e.rrule && e.rrule.freq) rows.push('RRULE:' + formatRRule(e.rrule));
    rows = rows.concat(writeEx('EXDATE', e.exdate, e));
    rows = rows.concat(writeEx('RDATE', e.rdate, e));
    var rid = writeRecur(e);
    if (rid) rows.push(rid);
    var org = writePerson('ORGANIZER', e.organizer, false);
    if (org) rows.push(org);
    var i;
    for (i = 0; i < e.attendees.length; i++) rows.push(writePerson('ATTENDEE', e.attendees[i], true));
    if (e.created) rows.push('CREATED:' + compactOf(e.created.slice(0, 19)) + 'Z');
    if (e.modified) rows.push('LAST-MODIFIED:' + compactOf(e.modified.slice(0, 19)) + 'Z');
    for (i = 0; i < e.alarms.length; i++) rows = rows.concat(writeAlarm(e.alarms[i]));
    if (e.allDay) rows.push('X-MICROSOFT-CDO-ALLDAYEVENT:TRUE');
    rows.push('END:VEVENT');
    return rows;
  }

  function monthDayNumbers(y, m, rule, dt, useDefault) {
    var dim = daysInMonth(y, m);
    var bymd = (rule.bymonthday || []).slice();
    var byday = rule.byday || [];
    if (useDefault && !bymd.length && !byday.length) bymd = [dt.d];
    var fromMd = null, fromDay = null, i, d;
    if (bymd.length) {
      fromMd = {};
      for (i = 0; i < bymd.length; i++) {
        var md = bymd[i];
        d = md > 0 ? md : dim + md + 1;
        if (d >= 1 && d <= dim) fromMd[d] = 1;
      }
    }
    if (byday.length) {
      fromDay = {};
      for (i = 0; i < byday.length; i++) {
        var bd = byday[i], wd = DAYN[bd.day];
        if (!bd.n) {
          for (d = 1; d <= dim; d++) if (weekday(y, m, d) === wd) fromDay[d] = 1;
        } else {
          d = nthWeekday(y, m, wd, bd.n);
          if (d) fromDay[d] = 1;
        }
      }
    }
    var set = {};
    if (fromMd && fromDay) { for (d in fromMd) if (fromDay[d]) set[d] = 1; }
    else set = fromMd || fromDay || {};
    var out = [];
    for (d in set) if (Object.prototype.hasOwnProperty.call(set, d)) out.push(+d);
    out.sort(function (a, b) { return a - b; });
    return out;
  }
  function dayOfYear(y, n) {
    var dt = new Date(Date.UTC(y, 0, n));
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }
  function nthWeekdayOfYear(y, wd, n) {
    var dim = isLeap(y) ? 366 : 365, d;
    if (n > 0) {
      var jan1 = weekday(y, 1, 1);
      d = 1 + ((wd - jan1 + 7) % 7) + (n - 1) * 7;
      if (d > dim) return null;
      return dayOfYear(y, d);
    }
    if (n < 0) {
      var dec = weekday(y, 12, 31);
      d = dim - ((dec - wd + 7) % 7) + (n + 1) * 7;
      if (d < 1) return null;
      return dayOfYear(y, d);
    }
    return null;
  }
  function weekStartParts(p, wkst) {
    var delta = (weekday(p.y, p.m, p.d) - wkst + 7) % 7;
    return addDays(p, -delta);
  }
  function firstWeekStart(y, wkst) {
    var mid = (wkst + 3) % 7;
    var jan1 = weekday(y, 1, 1);
    var dom = 1 + ((mid - jan1 + 7) % 7);
    return weekStartParts({ y: y, m: 1, d: dom, hh: 0, mm: 0, ss: 0 }, wkst);
  }
  function datesForWeeks(y, rule) {
    var wkst = DAYN[rule.wkst] != null ? DAYN[rule.wkst] : 1;
    var wanted = null, i, out = [];
    if (rule.byday && rule.byday.length) {
      wanted = {};
      for (i = 0; i < rule.byday.length; i++) wanted[DAYN[rule.byday[i].day]] = 1;
    }
    for (i = 0; i < rule.byweekno.length; i++) {
      var wn = rule.byweekno[i], start;
      if (wn < 0) start = addDays(weekStartParts({ y: y, m: 12, d: 28, hh: 0, mm: 0, ss: 0 }, wkst), (wn + 1) * 7);
      else start = addDays(firstWeekStart(y, wkst), (wn - 1) * 7);
      var d;
      for (d = 0; d < 7; d++) {
        var p = addDays(start, d);
        if (wanted && !wanted[weekday(p.y, p.m, p.d)]) continue;
        out.push({ y: p.y, m: p.m, d: p.d });
      }
    }
    return out;
  }
  function dateKey(p) { return p.y + '-' + p.m + '-' + p.d; }
  function dedupeDates(list) {
    var seen = {}, out = [], i;
    for (i = 0; i < list.length; i++) {
      var k = dateKey(list[i]);
      if (seen[k]) continue;
      seen[k] = 1;
      out.push(list[i]);
    }
    out.sort(function (a, b) { return cmpParts(a, b); });
    return out;
  }
  function intersectDates(a, b) {
    var seen = {}, i, out = [];
    for (i = 0; i < b.length; i++) seen[dateKey(b[i])] = 1;
    for (i = 0; i < a.length; i++) if (seen[dateKey(a[i])]) out.push(a[i]);
    return out;
  }
  function applySetPos(dates, setpos) {
    var n = dates.length, out = [], seen = {}, i;
    for (i = 0; i < setpos.length; i++) {
      var p = setpos[i];
      var idx = p > 0 ? p - 1 : n + p;
      if (idx >= 0 && idx < n && !seen[idx]) { seen[idx] = 1; out.push(dates[idx]); }
    }
    out.sort(function (a, b) { return cmpParts(a, b); });
    return out;
  }
  function yearDates(y, rule, dt) {
    var hasYD = rule.byyearday && rule.byyearday.length;
    var hasWN = rule.byweekno && rule.byweekno.length;
    var hasM = rule.bymonth && rule.bymonth.length;
    var hasMD = rule.bymonthday && rule.bymonthday.length;
    var hasD = rule.byday && rule.byday.length;
    var set = [], i, m, days, j;
    if (!hasYD && !hasWN && !hasM && !hasMD && !hasD) {
      if (dt.d <= daysInMonth(y, dt.m)) set.push({ y: y, m: dt.m, d: dt.d });
    } else if (hasD && !hasM && !hasMD && !hasYD && !hasWN) {
      for (i = 0; i < rule.byday.length; i++) {
        var bd = rule.byday[i];
        if (bd.n) {
          var one = nthWeekdayOfYear(y, DAYN[bd.day], bd.n);
          if (one) set.push(one);
        } else {
          for (m = 1; m <= 12; m++) {
            days = monthDayNumbers(y, m, { byday: [bd], bymonthday: [] }, dt, false);
            for (j = 0; j < days.length; j++) set.push({ y: y, m: m, d: days[j] });
          }
        }
      }
    } else {
      if (hasYD) {
        var dim = isLeap(y) ? 366 : 365;
        for (i = 0; i < rule.byyearday.length; i++) {
          var yd = rule.byyearday[i];
          var d = yd > 0 ? yd : dim + yd + 1;
          if (d >= 1 && d <= dim) set.push(dayOfYear(y, d));
        }
      }
      if (hasWN) {
        var weeks = datesForWeeks(y, rule);
        set = hasYD ? intersectDates(set, weeks) : weeks;
      }
      if (hasM || hasMD || (hasD && (hasM || hasMD)) || (!hasYD && !hasWN && (hasM || hasMD || hasD))) {
        var months = hasM ? rule.bymonth : [];
        if (!months.length) {
          for (m = 1; m <= 12; m++) months.push(m);
        }
        var mdays = [];
        for (i = 0; i < months.length; i++) {
          m = months[i];
          if (m < 1 || m > 12) continue;
          days = monthDayNumbers(y, m, rule, dt, !hasMD && !hasD);
          for (j = 0; j < days.length; j++) mdays.push({ y: y, m: m, d: days[j] });
        }
        set = (hasYD || hasWN) ? intersectDates(set, mdays) : mdays;
      }
    }
    set = dedupeDates(set);
    if (rule.bysetpos && rule.bysetpos.length) set = applySetPos(set, rule.bysetpos);
    return set;
  }
  function simpleYear(rule) {
    return !(rule.bymonth.length || rule.bymonthday.length || rule.byday.length || rule.byyearday.length || rule.byweekno.length || rule.bysetpos.length);
  }
  function simpleMonth(rule) {
    return !(rule.byday.length || rule.bysetpos.length || rule.bymonth.length || rule.byyearday.length || rule.byweekno.length || (rule.bymonthday.length && !(rule.bymonthday.length === 1 && rule.bymonthday[0] > 0)));
  }
  function simpleWeek(rule) {
    return !(rule.bymonth.length || rule.bymonthday.length || rule.bysetpos.length || rule.byyearday.length || rule.byweekno.length);
  }
  function simpleDay(rule) {
    return !(rule.bymonth.length || rule.bymonthday.length || rule.byday.length || rule.bysetpos.length || rule.byyearday.length || rule.byweekno.length);
  }

  function excluded(e, parts, startMs) {
    var list = e.exdate || [], i, local = localFromParts(parts), day = dateFromParts(parts);
    for (i = 0; i < list.length; i++) {
      var x = list[i];
      if (/^\d{4}-\d{2}-\d{2}$/.test(x)) { if (x === day) return true; }
      else if (/Z$/.test(x)) { if (wallToUtcMs(x.slice(0, 19)) === startMs) return true; }
      else if (x.slice(0, 19) === local) return true;
    }
    return false;
  }
  function passesUntil(rule, parts, startMs) {
    if (!rule || !rule.until) return true;
    var u = rule.until;
    if (/^\d{8}$/.test(u)) return dateFromParts(parts) <= (u.slice(0, 4) + '-' + u.slice(4, 6) + '-' + u.slice(6, 8));
    if (/Z$/i.test(u)) return startMs <= wallToUtcMs(canonStamp(u).slice(0, 19));
    return localFromParts(parts) <= canonStamp(u).slice(0, 19);
  }

  function expand(event, fromMs, toMs, opts) {
    var out = [];
    out.warnings = [];
    var prev = warnSink;
    warnSink = out.warnings;
    var t0 = Date.now();
    try {
      if (!event) return out;
      opts = opts || {};
      var max = opts.max > 0 ? opts.max : 2000;
      var rule = event.rrule;
      if (rule && (rule.freq === 'HOURLY' || rule.freq === 'MINUTELY' || rule.freq === 'SECONDLY')) {
        out.warnings.push('RRULE FREQ=' + rule.freq + ' is not expanded');
        return out;
      }
      var ctx = makeCtx(event, fromMs, toMs, max, out);
      if (!ctx) return out;
      if (!rule || !rule.freq) {
        consider(ctx, ctx.dt, false);
        addRDates(ctx);
        return finishExpand(out, max);
      }
      ctx.bail = function () {
        ctx.steps++;
        if (ctx.steps > 20000 || (ctx.steps % 250 === 0 && Date.now() - t0 > 40)) {
          out.warnings.push('expansion stopped');
          return true;
        }
        return false;
      };
      if (rule.freq === 'DAILY') expandDaily(ctx);
      else if (rule.freq === 'WEEKLY') expandWeekly(ctx);
      else if (rule.freq === 'MONTHLY') expandMonthly(ctx);
      else if (rule.freq === 'YEARLY') expandYearly(ctx);
      else out.warnings.push('RRULE FREQ=' + rule.freq + ' is not expanded');
      addRDates(ctx);
      return finishExpand(out, max);
    } catch (e) {
      out.warnings.push('expand error');
      return out;
    } finally {
      warnSink = prev;
    }
  }
  function finishExpand(out, max) {
    out.sort(function (a, b) { return a.startMs - b.startMs || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0); });
    if (out.length > max) {
      out.warnings.push('expansion capped');
      out.length = max;
    }
    return out;
  }
  function makeCtx(event, fromMs, toMs, max, out) {
    if (fromMs == null) fromMs = -8640000000000000;
    if (toMs == null) toMs = 8640000000000000;
    var allDay = !!event.allDay;
    var dt;
    if (allDay) {
      dt = partsFromLocal(event.start);
      if (!dt) return null;
      var endP = partsFromLocal(event.end) || addDays(dt, 1);
      var durDays = Math.max(1, daysBetween(dt, endP));
      dt.hh = 0; dt.mm = 0; dt.ss = 0;
    } else {
      dt = partsFromLocal(event.startLocal) || partsFromLocal(utcToZoned(event.start, event.tzid));
      if (!dt) return null;
      var endL = partsFromLocal(event.endLocal) || dt;
      var durSec = Math.round((Date.UTC(endL.y, endL.m - 1, endL.d, endL.hh, endL.mm, endL.ss) - Date.UTC(dt.y, dt.m - 1, dt.d, dt.hh, dt.mm, dt.ss)) / 1000);
      if (durSec < 0) durSec = 0;
    }
    var cushion = allDay ? durDays * 86400000 + 86400000 : Math.max(durSec * 1000, 0) + 2 * 86400000;
    var win = allDay ? partsFromLocal(formatUtc(fromMs - cushion).slice(0, 10)) : partsFromLocal(utcToZoned(fromMs - cushion, event.tzid));
    var endW = allDay ? partsFromLocal(formatUtc(toMs).slice(0, 10)) : partsFromLocal(utcToZoned(toMs, event.tzid));
    return {
      event: event, from: fromMs, to: toMs, max: max, out: out, dt: dt, allDay: allDay,
      durDays: allDay ? durDays : 0, durSec: allDay ? 0 : durSec, tzid: event.tzid || '',
      rule: event.rrule, interval: (event.rrule && event.rrule.interval) || 1,
      limit: (event.rrule && event.rrule.count) || 0,
      produced: 0, steps: 0, stop: false, win: win, endW: endW, recurring: !!(event.rrule && event.rrule.freq)
    };
  }
  function consider(ctx, parts, fromRule) {
    if (ctx.stop) return 'stop';
    if (cmpParts(parts, ctx.dt) < 0) return 'skip';
    var startMs, endMs, startLocal = '', endLocal = '', endParts;
    if (ctx.allDay) {
      startMs = Date.UTC(parts.y, parts.m - 1, parts.d);
      endParts = addDays(parts, ctx.durDays);
      endMs = Date.UTC(endParts.y, endParts.m - 1, endParts.d);
      startLocal = dateFromParts(parts);
      endLocal = dateFromParts(endParts);
    } else {
      parts = { y: parts.y, m: parts.m, d: parts.d, hh: ctx.dt.hh, mm: ctx.dt.mm, ss: ctx.dt.ss };
      startLocal = localFromParts(parts);
      startMs = zonedToUtc(startLocal, ctx.tzid);
      endParts = addSeconds(parts, ctx.durSec);
      endLocal = localFromParts(endParts);
      endMs = ctx.durSec === 0 ? startMs : zonedToUtc(endLocal, ctx.tzid);
      if (endMs < startMs) endMs = startMs;
    }
    if (fromRule && !passesUntil(ctx.rule, parts, startMs)) { ctx.stop = true; return 'until'; }
    // Stop at the window's end before counting, so a long run of exclusions cannot walk past it.
    if (startMs >= ctx.to) { ctx.stop = true; return 'after'; }
    if (fromRule && ctx.limit && ctx.produced >= ctx.limit) { ctx.stop = true; return 'count'; }
    if (fromRule) ctx.produced++;
    if (excluded(ctx.event, parts, startMs)) return 'ex';
    var overlaps = endMs > ctx.from && startMs < ctx.to;
    if (!overlaps) return 'before';
    var key = ctx.event.uid + (ctx.allDay ? ':d:' + dateFromParts(parts) : ':t:' + startMs);
    ctx.out.push({
      event: ctx.event, startMs: startMs, endMs: endMs, startLocal: startLocal, endLocal: endLocal,
      allDay: ctx.allDay, recurring: fromRule ? true : ctx.recurring, key: key
    });
    if (ctx.out.length >= ctx.max) { ctx.stop = true; return 'max'; }
    return 'in';
  }
  function addSeconds(p, sec) {
    var ms = Date.UTC(p.y, p.m - 1, p.d, p.hh || 0, p.mm || 0, p.ss || 0) + sec * 1000;
    var d = new Date(ms);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mm: d.getUTCMinutes(), ss: d.getUTCSeconds() };
  }
  function addRDates(ctx) {
    var list = ctx.event.rdate || [], seen = {}, i;
    for (i = 0; i < ctx.out.length; i++) seen[ctx.out[i].key] = 1;
    for (i = 0; i < list.length; i++) {
      var v = list[i], parts;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) parts = partsFromLocal(v);
      else if (/Z$/.test(v)) {
        var local = ctx.allDay ? v.slice(0, 10) : utcToZoned(wallToUtcMs(v.slice(0, 19)), ctx.tzid);
        parts = partsFromLocal(local);
      } else parts = partsFromLocal(v);
      if (!parts) continue;
      var before = ctx.out.length;
      ctx.stop = false;
      consider(ctx, parts, false);
      if (ctx.out.length > before) {
        var last = ctx.out[ctx.out.length - 1];
        last.recurring = true;
        if (seen[last.key]) ctx.out.pop();
        else seen[last.key] = 1;
      }
    }
  }

  function expandDaily(ctx) {
    var interval = ctx.interval, p = { y: ctx.dt.y, m: ctx.dt.m, d: ctx.dt.d, hh: ctx.dt.hh, mm: ctx.dt.mm, ss: ctx.dt.ss };
    if (ctx.win && simpleDay(ctx.rule)) {
      var diff = daysBetween(ctx.dt, ctx.win);
      if (diff > interval) {
        var n = Math.floor(diff / interval);
        if (ctx.limit && n >= ctx.limit) return;
        ctx.produced = n;
        p = addDays(ctx.dt, n * interval);
      }
    }
    while (!ctx.stop && p.y < 10000) {
      if (ctx.bail()) return;
      var parts = { y: p.y, m: p.m, d: p.d, hh: ctx.dt.hh, mm: ctx.dt.mm, ss: ctx.dt.ss };
      if (dailyMatches(parts, ctx.rule)) consider(ctx, parts, true);
      p = addDays(p, interval);
    }
  }
  function dailyMatches(parts, rule) {
    if (rule.bymonth.length && rule.bymonth.indexOf(parts.m) < 0) return false;
    if (rule.bymonthday.length) {
      var dim = daysInMonth(parts.y, parts.m), ok = false, i;
      for (i = 0; i < rule.bymonthday.length; i++) {
        var md = rule.bymonthday[i];
        var d = md > 0 ? md : dim + md + 1;
        if (d === parts.d) ok = true;
      }
      if (!ok) return false;
    }
    if (rule.byday.length) {
      var wd = weekday(parts.y, parts.m, parts.d), hit = false, j;
      for (j = 0; j < rule.byday.length; j++) if (!rule.byday[j].n && DAYN[rule.byday[j].day] === wd) hit = true;
      if (!hit) return false;
    }
    return true;
  }
  function expandWeekly(ctx) {
    var rule = ctx.rule;
    var wkst = DAYN[rule.wkst] != null ? DAYN[rule.wkst] : 1;
    var days = rule.byday.length ? rule.byday : [{ n: 0, day: DAY[weekday(ctx.dt.y, ctx.dt.m, ctx.dt.d)] }];
    var wanted = [], i;
    for (i = 0; i < days.length; i++) if (DAYN[days[i].day] != null) wanted.push(DAYN[days[i].day]);
    wanted.sort(function (a, b) { return ((a - wkst + 7) % 7) - ((b - wkst + 7) % 7); });
    var origin = weekStartParts(ctx.dt, wkst);
    var interval = ctx.interval, w = 0;
    if (ctx.win && simpleWeek(rule)) {
      var diff = daysBetween(origin, ctx.win);
      var weeks = Math.floor(diff / 7);
      if (weeks > interval) {
        w = weeks - (weeks % interval);
        if (w < 0) w = 0;
        var nWeeks = w / interval;
        var first = weeklyCount(origin, wkst, wanted, ctx.dt, 0, 1);
        var per = wanted.length;
        var produced = nWeeks <= 0 ? 0 : first + (nWeeks - 1) * per;
        if (ctx.limit && produced >= ctx.limit) return;
        ctx.produced = produced;
      }
    }
    while (!ctx.stop && w < 200000) {
      if (ctx.bail()) return;
      var ws = addDays(origin, w * 7);
      if (ws.y > 9999) return;
      var dates = [], j;
      for (j = 0; j < wanted.length; j++) {
        var delta = (wanted[j] - wkst + 7) % 7;
        var p = addDays(ws, delta);
        p.hh = ctx.dt.hh; p.mm = ctx.dt.mm; p.ss = ctx.dt.ss;
        if (cmpParts(p, ctx.dt) < 0) continue;
        if (rule.bymonth.length && rule.bymonth.indexOf(p.m) < 0) continue;
        if (rule.bymonthday.length && !monthDayHit(p, rule.bymonthday)) continue;
        dates.push(p);
      }
      if (rule.bysetpos.length) dates = applySetPos(dates, rule.bysetpos);
      for (j = 0; j < dates.length; j++) consider(ctx, dates[j], true);
      if (ctx.endW && cmpParts(ws, ctx.endW) > 0 && w > 0) return;
      w += interval;
    }
  }
  function weeklyCount(origin, wkst, wanted, dt, weekIndex, interval) {
    var ws = addDays(origin, weekIndex * 7), n = 0, j;
    for (j = 0; j < wanted.length; j++) {
      var p = addDays(ws, (wanted[j] - wkst + 7) % 7);
      p.hh = dt.hh; p.mm = dt.mm; p.ss = dt.ss;
      if (cmpParts(p, dt) >= 0) n++;
    }
    return n;
  }
  function monthDayHit(p, list) {
    var dim = daysInMonth(p.y, p.m), i;
    for (i = 0; i < list.length; i++) {
      var md = list[i];
      var d = md > 0 ? md : dim + md + 1;
      if (d === p.d) return true;
    }
    return false;
  }
  function expandMonthly(ctx) {
    var rule = ctx.rule, interval = ctx.interval;
    var idx0 = ctx.dt.y * 12 + (ctx.dt.m - 1);
    var idx = idx0;
    if (ctx.win) {
      var idxW = ctx.win.y * 12 + (ctx.win.m - 1) - 1;
      if (idxW > idx0) {
        var n = Math.floor((idxW - idx0) / interval) * interval;
        var landed = idx0 + n;
        if (simpleMonth(rule)) {
          var produced = countMonths(ctx.dt, idx0, landed, interval, rule);
          if (ctx.limit && produced >= ctx.limit) return;
          ctx.produced = produced;
          idx = landed;
        } else if (!ctx.limit || ctx.limit > (idxW - idx0)) idx = landed;
      }
    }
    while (!ctx.stop) {
      if (ctx.bail()) return;
      var y = Math.floor(idx / 12), m = (idx % 12) + 1;
      if (y > 9999) return;
      if (!(rule.bymonth.length && rule.bymonth.indexOf(m) < 0)) {
        var days = monthDayNumbers(y, m, rule, ctx.dt, true);
        var dates = [], i;
        for (i = 0; i < days.length; i++) dates.push({ y: y, m: m, d: days[i], hh: ctx.dt.hh, mm: ctx.dt.mm, ss: ctx.dt.ss });
        if (rule.bysetpos.length) dates = applySetPos(dates, rule.bysetpos);
        for (i = 0; i < dates.length; i++) consider(ctx, dates[i], true);
      }
      if (ctx.endW && (y > ctx.endW.y || (y === ctx.endW.y && m > ctx.endW.m))) return;
      idx += interval;
    }
  }
  function countMonths(dt, idx0, landed, interval, rule) {
    if (dt.d <= 28 && !(rule.bymonthday && rule.bymonthday.length)) return Math.floor((landed - idx0) / interval);
    var n = 0, idx, guard = 0;
    for (idx = idx0; idx < landed && guard < 200000; idx += interval, guard++) {
      var y = Math.floor(idx / 12), m = (idx % 12) + 1;
      var dom = (rule.bymonthday && rule.bymonthday.length === 1) ? rule.bymonthday[0] : dt.d;
      if (dom >= 1 && dom <= daysInMonth(y, m)) n++;
    }
    return n;
  }
  function expandYearly(ctx) {
    var rule = ctx.rule, interval = ctx.interval, y = ctx.dt.y;
    var startY = ctx.win ? ctx.win.y : y;
    if (startY < y) startY = y;
    if (startY > y) {
      var steps = Math.floor((startY - y) / interval);
      var y2 = y + steps * interval;
      if (simpleYear(rule)) {
        var n = countYears(ctx.dt, y, y2, interval);
        if (ctx.limit && n >= ctx.limit) return;
        ctx.produced = n;
        y = y2;
      } else if (!ctx.limit || ctx.limit > steps) y = y2;
    }
    while (!ctx.stop && y < 10000) {
      if (ctx.bail()) return;
      var dates = yearDates(y, rule, ctx.dt), i;
      for (i = 0; i < dates.length; i++) {
        var p = { y: dates[i].y, m: dates[i].m, d: dates[i].d, hh: ctx.dt.hh, mm: ctx.dt.mm, ss: ctx.dt.ss };
        consider(ctx, p, true);
      }
      if (ctx.endW && y > ctx.endW.y) return;
      y += interval;
    }
  }
  function countYears(dt, yFrom, yTo, interval) {
    if (yTo <= yFrom) return 0;
    if (!(dt.m === 2 && dt.d === 29)) return Math.floor((yTo - yFrom) / interval);
    var n = 0, y;
    for (y = yFrom; y < yTo; y += interval) if (isLeap(y)) n++;
    return n;
  }

  function expandAll(events, fromMs, toMs, opts) {
    var out = [], masters = [], overs = {}, seen = {}, i;
    events = events || [];
    try {
      for (i = 0; i < events.length; i++) {
        var e = events[i];
        if (!e) continue;
        if (e.recurrenceId != null && e.recurrenceId !== '') {
          var u = e.uid || '';
          (overs[u] = overs[u] || []).push(e);
        } else masters.push(e);
      }
      for (i = 0; i < masters.length; i++) {
        var m = masters[i];
        seen[m.uid] = 1;
        var occ = expand(m, fromMs, toMs, opts);
        var list = overs[m.uid] || [];
        if (!list.length) { out = out.concat(occ); continue; }
        var map = {}, k;
        for (k = 0; k < occ.length; k++) map[occ[k].key] = occ[k];
        for (var j = 0; j < list.length; j++) {
          var ov = list[j];
          var idKey = overrideKey(m, ov);
          delete map[idKey];
          var single = Object.assign({}, ov, { rrule: null, recurrenceId: null });
          var moved = expand(single, fromMs, toMs, opts);
          if (moved.length) {
            moved[0].key = idKey;
            moved[0].recurring = true;
            moved[0].event = ov;
            map[idKey] = moved[0];
          }
        }
        for (var key in map) if (Object.prototype.hasOwnProperty.call(map, key)) out.push(map[key]);
      }
      for (var uid in overs) {
        if (!Object.prototype.hasOwnProperty.call(overs, uid) || seen[uid]) continue;
        var orphan = overs[uid];
        for (j = 0; j < orphan.length; j++) out = out.concat(expand(Object.assign({}, orphan[j], { rrule: null }), fromMs, toMs, opts));
      }
      out.sort(function (a, b) { return a.startMs - b.startMs || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0); });
    } catch (e2) { /* a bad event contributes nothing */ }
    return out;
  }
  function overrideKey(master, ov) {
    if (master.allDay || typeof ov.recurrenceId === 'string') return master.uid + ':d:' + canonDateOnly(ov.recurrenceId);
    return master.uid + ':t:' + ov.recurrenceId;
  }

  function alarmTimes(event, fromMs, toMs) {
    var out = [];
    try {
      if (!event) return out;
      var alarms = event.alarms || [];
      var lead = 0, trail = 0, i, j;
      for (i = 0; i < alarms.length; i++) {
        var a = alarms[i];
        if (!a || a.absolute) continue;
        var min = a.minutes || 0;
        var extra = a.related === 'end' ? durationMs(event) / 60000 : 0;
        if (min + extra > lead) lead = min + extra;
        if (-min > trail) trail = -min;
      }
      var pad = durationMs(event);
      var occ = expand(event, fromMs - lead * 60000 - pad, toMs + trail * 60000 + pad + 1000, { max: 2000 });
      for (i = 0; i < occ.length; i++) {
        for (j = 0; j < alarms.length; j++) {
          a = alarms[j];
          if (!a || a.absolute) continue;
          var anchor = a.related === 'end' ? occ[i].endMs : occ[i].startMs;
          var at = anchor - (a.minutes || 0) * 60000;
          if (at >= fromMs && at < toMs) out.push({ atMs: at, startMs: occ[i].startMs, event: event, key: occ[i].key });
        }
      }
      for (i = 0; i < alarms.length; i++) {
        a = alarms[i];
        if (!a || !a.absolute) continue;
        var ms = wallToUtcMs(String(a.absolute).slice(0, 19));
        if (ms >= fromMs && ms < toMs) {
          out.push({ atMs: ms, startMs: typeof event.start === 'number' ? event.start : ms, event: event, key: (event.uid || '') + ':alarm' });
        }
      }
      out.sort(function (a, b) { return a.atMs - b.atMs; });
    } catch (e) {}
    return out;
  }
  function durationMs(event) {
    if (!event || event.allDay) return 86400000;
    if (typeof event.start === 'number' && typeof event.end === 'number') return Math.max(0, event.end - event.start);
    return 0;
  }

  function makeRequest(event, opts) {
    opts = opts || {};
    var method = String(opts.method || 'REQUEST').toUpperCase();
    var copy = JSON.parse(JSON.stringify(event || {}));
    if (method === 'REQUEST' || method === 'CANCEL') copy.sequence = (copy.sequence || 0) + 1;
    if (method === 'CANCEL') copy.status = 'CANCELLED';
    if (method === 'REPLY') {
      var src = opts.attendee || (copy.attendees && copy.attendees[0]) || {};
      copy.attendees = [person(src.name, src.email, src.cid, {
        partstat: opts.partstat || src.partstat || 'ACCEPTED',
        role: src.role || 'REQ-PARTICIPANT',
        rsvp: src.rsvp
      })];
    } else if (opts.partstat && opts.attendee) {
      var list = copy.attendees || [], i;
      for (i = 0; i < list.length; i++) {
        var same = (opts.attendee.email && list[i].email === opts.attendee.email) || (opts.attendee.cid && list[i].cid === opts.attendee.cid);
        if (same) list[i].partstat = opts.partstat;
      }
    }
    return serialize({ method: method, events: [makeEvent(copy)] });
  }
  function readInvite(textOrEvent) {
    try {
      if (typeof textOrEvent === 'string') {
        var p = parse(textOrEvent);
        return { method: p.method || '', event: p.events[0] || null };
      }
      if (textOrEvent && textOrEvent.events) return { method: textOrEvent.method || '', event: textOrEvent.events[0] || null };
      return { method: '', event: textOrEvent || null };
    } catch (e) {
      return { method: '', event: null };
    }
  }

  function uid() {
    var id = '';
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) id = crypto.randomUUID();
    } catch (e) { id = ''; }
    if (!id) {
      id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
    return id + '@gifos.app';
  }

  // An all-day DTEND is the morning after the last day. Display wants that last day.
  function inclusiveEnd(event) {
    if (!event || !event.allDay) return event ? event.end : '';
    var p = partsFromLocal(event.end);
    if (!p) return '';
    return dateFromParts(addDays(p, -1));
  }

  var api = {
    parse: parse, serialize: serialize, makeEvent: makeEvent,
    zonedToUtc: zonedToUtc, utcToZoned: utcToZoned,
    expand: expand, expandAll: expandAll,
    parseRRule: parseRRule, formatRRule: formatRRule,
    alarmTimes: alarmTimes, makeRequest: makeRequest, readInvite: readInvite,
    meetingLink: meetingLink, uid: uid, inclusiveEnd: inclusiveEnd
  };
  if (typeof module === 'object' && module && module.exports) { module.exports = api; return; }
  if (root) { root.GifOS = root.GifOS || {}; root.GifOS.ical = api; }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
