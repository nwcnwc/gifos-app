/*
 * meet-captrust.js — whose captions this page shows, for each person.
 *
 * A page trusts only itself. Another source earns trust by matching what this
 * device hears, and loses it on a big mismatch. Nothing here leaves the page:
 * the states, the picks and the flags live in memory for this meeting.
 *
 * Sources of one voice v: the speaker's own engine (writer w === v), this
 * device's ears (Whisper on the received audio: w === me, src 'ear'), and every
 * other participant whose engine wrote that voice down (w = them, src 'ear').
 *
 * The reference for v is this device's ears when it has heard v, else a
 * trusted ear: a participant whose ear lines agreed with the speakers' own
 * lines (two independent sources) CT_TRUST_N times, and never disagreed with
 * this device's ears. Each settled reference line is compared once with each
 * other source's lines over the same span: the share of the shorter side's
 * content words found in the other side.
 *
 *   match      score >= MATCH                                   one good sample
 *   mismatch   score <  MISS, MIN_WORDS words on each side      one bad sample
 *   big        score <  BIG_MISS, BIG_WORDS words on each side  distrusted at once
 *   TRUST_N good samples in a row: trusted. LOSE_N bad ones in a row: distrusted.
 *   Trusted and one bad sample: back to unknown.
 *
 * A trusted ear's verdict on a speaker (vt 0 on its ear line) counts as one big
 * mismatch of that speaker's own source.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};

  // Word-overlap dials (ratios and counts; the times come from the timings table).
  const DIALS = { MATCH: 0.5, MISS: 0.25, BIG_MISS: 0.1, MIN_WORDS: 4, BIG_WORDS: 8, TRUST_N: 2, LOSE_N: 2, RING: 60, EX_CHARS: 160, CL_AGREE_N: 2 };
  const STOP = new Set(['the', 'and', 'for', 'you', 'that', 'this', 'with', 'are', 'was', 'but', 'not', 'have', 'has', 'had',
    'our', 'all', 'its', 'his', 'her', 'she', 'they', 'them', 'then', 'than', 'from', 'what', 'will', 'can', 'just', 'into',
    'one', 'too', 'there', 'their', 'your', 'who', 'how', 'any', 'out', 'yes', 'okay']);
  const NOSPACE = /[぀-ヿ㐀-鿿가-힯]/;

  // Content words of a line. A script written without spaces counts its characters.
  function words(text) {
    const out = new Set();
    const toks = String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ');
    for (const t of toks) {
      if (!t) continue;
      if (NOSPACE.test(t)) { for (const ch of t) if (NOSPACE.test(ch)) out.add(ch); continue; }
      if (t.length >= 3 && !STOP.has(t)) out.add(t);
    }
    return out;
  }
  // -> { score, n } : shared / the shorter side's size, n the shorter side's size.
  function overlap(a, b) {
    const n = Math.min(a.size, b.size);
    if (!n) return { score: 0, n: 0 };
    let s = 0; for (const x of a) if (b.has(x)) s++;
    return { score: s / n, n };
  }
  // -> 'match' | 'miss' | 'big' | '' (not enough words to say)
  function judge(a, b, d) {
    d = d || DIALS;
    const o = overlap(a, b);
    if (o.n && o.score >= d.MATCH) return 'match';
    if (o.n >= d.BIG_WORDS && o.score < d.BIG_MISS) return 'big';
    if (o.n >= d.MIN_WORDS && o.score < d.MISS) return 'miss';
    return '';
  }

  // opts: { me() my id, now(), T: { CT_SETTLE_MS, CT_PAD_MS, CT_SPOT_MS, CT_SPOT_EVERY_MS, CT_KEEP_MS }, onWarn(v, info), earsFor(v) }
  function make(opts) {
    const T = opts.T, d = Object.assign({}, DIALS, opts.dials || {});
    const now = opts.now || (() => Date.now());
    const me = () => String(opts.me() || '');
    const lines = new Map();      // voice -> [{ w, at, end, ws, ear, seen:Set, t }]
    const st = new Map();         // voice + '|' + writer -> { s:'unknown'|'trusted'|'distrusted', ok, bad, at, why, by }
    const earOk = new Map();      // writer -> agreeing samples as an ear (when this page had no ears)
    const earBad = new Set();     // writers whose ear lines disagreed with this device's ears
    const vts = new Map();        // voice + '|' + writer -> the writer's last vt on that voice
    // A pick is a STARTING POINT, never a lock (docs/caption-trust.md section 8): voice -> { kind: 'own' | 'me' | 'ear', w, at }.
    // Auto keeps judging with this page's own ears and the ears it trusts; the pick leans it until the evidence moves.
    const taught = new Map();
    const earBadV = new Set();    // voice|writer: a taught ear whose lines disagreed with this device's ears, for that voice
    const warned = new Set();
    const key = (v, w) => v + '|' + w;
    const rec = (v, w) => { let r = st.get(key(v, w)); if (!r) { r = { s: 'unknown', ok: 0, bad: 0, at: 0, why: '', by: '' }; st.set(key(v, w), r); } return r; };
    const stateOf = (v, w) => { const r = st.get(key(String(v), String(w))); return r ? r.s : 'unknown'; };
    const trustedEar = (w) => w !== me() && !earBad.has(w) && (earOk.get(w) || 0) >= d.TRUST_N;
    // An ear this page trusts for voice v: earned on the evidence, or taught by the user's pick (until this device's ears disagree with it).
    const trustedFor = (v, w) => {
      const t = taught.get(v);
      if (t && t.kind === 'ear' && t.w === w && w !== me()) return !earBadV.has(key(v, w));
      return trustedEar(w);
    };

    function setState(v, w, s, why, by) {
      const r = rec(v, w), was = r.s;
      r.s = s; r.why = why || ''; r.by = by || ''; r.at = now();
      if (s !== 'distrusted' || was === 'distrusted' || w !== v || r.why === 'flag') return;   // a flag is the user's own act: no warning
      // the speaker's own captions just lost this page's trust
      if (warned.has(v)) return;
      warned.add(v);
      try { if (opts.onWarn) opts.onWarn(v, { why: r.why, by: r.by, show: choice(v).show }); } catch (e) {}
    }
    function sample(v, w, verdict, by, ex) {
      if (!verdict) return;
      const r = rec(v, w);
      // the pair this verdict came from: what source w wrote and what the reference heard, over the same span
      if (ex) { r.ex = ex; if (verdict !== 'match') r.exBad = ex; }
      if (r.why === 'flag' && r.s === 'distrusted') return;   // the user's flag stands for the meeting
      if (verdict === 'match') {
        r.bad = 0; r.ok++;
        if (r.ok >= d.TRUST_N && r.s !== 'trusted') setState(v, w, 'trusted', 'heard', by);
        return;
      }
      r.ok = 0; r.bad++;
      if (verdict === 'big' || r.bad >= d.LOSE_N) setState(v, w, 'distrusted', verdict === 'vouch' ? 'vouch' : 'heard', by);
      else if (r.s === 'trusted') setState(v, w, 'unknown', 'heard', by);
    }

    // A caption line this page holds (or a sample of its own ears that it does not keep).
    function observe(l) {
      if (!l || !l.byId || !l.w || l.tl) return;
      const v = String(l.byId), w = String(l.w);
      if (v === 'stadium' || v === 'stage') return;
      const ear = l.src === 'ear';
      const ws = words(l.text);
      if (!ws.size) return;
      let a = lines.get(v); if (!a) { a = []; lines.set(v, a); }
      const at = +l.at || now();
      // this device's ears: Whisper (or the phone's model) on the received audio; no other engine of mine is a reference
      const mine = w === me() && ear && (l.eng === 'whisper' || l.eng === 'local');
      // tx: the line's words as shown, kept in this page's memory so the chooser can show what each source said
      a.push({ w, at, end: Math.max(at, +l.end || 0), ws, ear, mine, seen: new Set(), t: now(), tx: String(l.text || '').slice(0, d.EX_CHARS) });
      if (a.length > d.RING) a.splice(0, a.length - d.RING);
      if (ear && w !== me() && (l.vt === 0 || l.vt === 1)) { vts.set(key(v, w), l.vt); applyVouch(v, w); }
    }
    function applyVouch(v, w) {
      const vt = vts.get(key(v, w));
      if (vt !== 0 || !trustedFor(v, w) || stateOf(v, v) === 'distrusted' || hasEars(v)) return;
      sample(v, v, 'big', w);
      const r = st.get(key(v, v)); if (r && r.s === 'distrusted') r.why = 'vouch';
    }
    const recent = (v) => { const cut = now() - T.CT_KEEP_MS; return (lines.get(v) || []).filter((x) => x.t >= cut); };
    function hasEars(v) {
      if (opts.earsFor && opts.earsFor(v)) return true;
      return recent(v).some((x) => x.mine);
    }
    // Text of writer w on voice v over [a, b] (for the example the chooser shows).
    function textIn(v, w, a, b) {
      const out = [];
      for (const x of lines.get(v) || []) if (x.w === w && x.end >= a && x.at <= b && x.tx && out.indexOf(x.tx) < 0) out.push(x.tx);
      return out.join(' ').slice(-d.EX_CHARS);
    }
    // Words of writer w on voice v over [a, b].
    function wordsIn(v, w, a, b) {
      const out = new Set(); let n = 0;
      for (const x of lines.get(v) || []) {
        if (x.w !== w || x.end < a || x.at > b) continue;
        n++; for (const y of x.ws) out.add(y);
      }
      return n ? out : null;
    }
    function tick() {
      const t = now(), my = me();
      for (const [v, a] of lines) {
        if (v === my) continue;   // my own voice: this page's engine is mine
        const cut = t - T.CT_KEEP_MS;
        while (a.length && a[0].t < cut) a.shift();
        const writers = new Set(a.map((x) => x.w));
        const refMine = a.some((x) => x.mine);
        for (const r of a) {
          if (t - r.t < T.CT_SETTLE_MS) continue;
          const lo = r.at - T.CT_PAD_MS, hi = r.end + T.CT_PAD_MS;
          if (r.mine) {
            // this device's ears against every other source of this voice
            for (const w of writers) {
              if (w === my || r.seen.has(w)) continue;
              const ws = wordsIn(v, w, lo, hi);
              if (!ws) continue;
              r.seen.add(w);
              const vd = judge(r.ws, ws, d);
              sample(v, w, vd, 'me', vd ? { theirs: textIn(v, w, lo, hi), ours: r.tx, by: my } : null);
              if (w !== v && vd) {
                if (vd === 'match') { earOk.set(w, (earOk.get(w) || 0) + 1); earBadV.delete(key(v, w)); }
                else { earBad.add(w); earBadV.add(key(v, w)); }
              }
            }
          } else if (!refMine && r.ear && r.w !== v) {
            // no ears here: another page's ear line for v
            const own = r.seen.has(v) ? null : wordsIn(v, v, lo, hi);
            if (own) {
              r.seen.add(v);
              const vd = judge(r.ws, own, d);
              const ex = vd ? { theirs: textIn(v, v, lo, hi), ours: r.tx, by: r.w } : null;
              if (trustedFor(v, r.w)) sample(v, v, vd, r.w, ex);
              else if (vd === 'match') { earOk.set(r.w, (earOk.get(r.w) || 0) + 1); sample(v, v, vd, r.w, ex); }
            }
          }
        }
      }
      for (const k of vts.keys()) { const i = k.indexOf('|'); applyVouch(k.slice(0, i), k.slice(i + 1)); }
    }
    // Where the speaker's own captions stand since the user's pick: 'back' (evidence trusts them again after the user put
    // another source first), 'lost' (evidence distrusts them after the user put them first), or ''.
    function sincePick(v) {
      const t = taught.get(v); if (!t) return '';
      const o = st.get(key(v, v));
      if (t.kind === 'own') return o && o.s === 'distrusted' && o.at > t.at ? 'lost' : '';
      return o && o.s === 'trusted' && o.at > t.at ? 'back' : '';
    }
    // -> { mode, show, lean } : show 'all', or the one writer whose lines are shown for v. mode is always 'auto': a pick
    // only leans it (lean: 'own' | 'me' | the writer's id | ''), and the evidence can move it.
    function choice(v) {
      v = String(v);
      const my = me();
      const t = taught.get(v);
      const lean = t ? (t.kind === 'ear' ? t.w : t.kind) : '';
      const since = sincePick(v);
      if (t && t.kind === 'own' && !since) return { mode: 'auto', show: v, lean };
      if (t && t.kind === 'ear' && !since && trustedFor(v, t.w) && stateOf(v, t.w) !== 'distrusted') return { mode: 'auto', show: t.w, lean };
      if (t && t.kind === 'me' && !since && hasEars(v)) return { mode: 'auto', show: my, lean };
      const own = stateOf(v, v);
      if (own === 'trusted') return { mode: 'auto', show: v, lean };
      if (own !== 'distrusted') return { mode: 'auto', show: 'all', lean };
      if (hasEars(v)) return { mode: 'auto', show: my, lean };
      const ws = Array.from(new Set(recent(v).map((x) => x.w))).filter((w) => w !== v && w !== my);
      const ear = ws.find((w) => trustedFor(v, w) && stateOf(v, w) !== 'distrusted');
      if (ear) return { mode: 'auto', show: ear, lean };
      const any = ws.find((w) => stateOf(v, w) !== 'distrusted');
      return { mode: 'auto', show: any || 'all', lean };
    }
    // What changed since the user's pick, for the card to say: null, or { kind, w, what }, what = 'ownBack' (the speaker's own
    // captions earned trust again), 'ownLost' (they lost it), 'earLost' (the writer the user preferred stopped matching this
    // device's ears).
    function moved(v) {
      v = String(v);
      const t = taught.get(v); if (!t) return null;
      const since = sincePick(v);
      if (t.kind === 'own') return since === 'lost' ? { kind: 'own', w: v, what: 'ownLost' } : null;
      if (since === 'back') return { kind: t.kind, w: t.w || '', what: 'ownBack' };
      if (t.kind === 'ear' && (!trustedFor(v, t.w) || stateOf(v, t.w) === 'distrusted')) return { kind: 'ear', w: t.w, what: 'earLost' };
      return null;
    }
    // Is this line shown in the live captions on this page?
    function shows(l) {
      if (!l || !l.byId) return true;
      const v = String(l.byId), w = String(l.w || l.byId);
      if (v === me() || v === 'stadium' || v === 'stage') return true;
      const c = choice(v);
      if (c.show === 'all') return stateOf(v, w) !== 'distrusted';
      if (w === c.show) return true;
      if (c.mode !== 'auto' || stateOf(v, w) === 'distrusted') return false;
      // the chosen source went quiet on this voice: another undoubted line still shows
      const last = Math.max(0, ...(lines.get(v) || []).filter((x) => x.w === c.show).map((x) => x.t));
      return now() - last > 2 * T.CT_SETTLE_MS + T.CT_PAD_MS;
    }
    // Should this device's ears listen to v now? Full time until the speaker's
    // own captions are trusted; then one spot check of CT_SPOT_MS every CT_SPOT_EVERY_MS.
    function earWanted(v) {
      v = String(v);
      const r = st.get(key(v, v));
      if (!r || r.s !== 'trusted') return true;
      return ((now() - r.at) % T.CT_SPOT_EVERY_MS) < T.CT_SPOT_MS;   // the first check right away, then one a period
    }
    // vt for this page's own ear line about v: its verdict on v's own captions.
    function verdict(v) { const s = stateOf(v, v); return s === 'distrusted' ? 0 : s === 'trusted' ? 1 : undefined; }
    // The user's pick (local, never sent). Another writer's version: that writer is a trusted ear for this voice; the
    // speaker's own: the doubt is cleared; this device's ears: they lead. Each is a starting point: auto keeps judging.
    function pick(v, p) {
      v = String(v);
      if (!p || p === 'auto') {
        // Automatic drops the pick; a doubt the pick cleared (or a trust it reset) comes back, if nothing has been judged since
        const t = taught.get(v), o = st.get(key(v, v));
        taught.delete(v);
        if (t && t.before && o && o.why === 'pick') { o.s = t.before.s; o.ok = t.before.ok; o.bad = t.before.bad; o.why = t.before.why; o.at = t.before.at; }
        return;
      }
      p = String(p);
      const my = me(), at = now();
      const o = rec(v, v);
      const before = taught.get(v) ? taught.get(v).before : { s: o.s, ok: o.ok, bad: o.bad, why: o.why, at: o.at };   // what Automatic goes back to
      if (p === 'own') {
        taught.set(v, { kind: 'own', w: v, at, before });
        if (o.s === 'distrusted') { o.s = 'unknown'; o.ok = 0; o.bad = 0; o.why = 'pick'; o.at = at; }   // clears the doubt, and a flag
        else o.at = at;
      } else {
        taught.set(v, p === 'me' || p === my ? { kind: 'me', w: my, at, before } : { kind: 'ear', w: p, at, before });
        if (p !== 'me' && p !== my) earBadV.delete(key(v, p));
        if (o.s === 'trusted') { o.s = 'unknown'; o.ok = 0; o.bad = 0; o.why = 'pick'; }   // the user doubts them: they must earn it again
        o.at = at;
      }
      warned.add(v);   // the user already knows: no warning card for this voice
    }
    function flag(v, w) { v = String(v); w = String(w || v); taught.delete(v); setState(v, w, 'distrusted', 'flag', me()); if (w !== v && w !== me()) earBad.add(w); }
    // Every source this page holds for v: [{ w, kind: 'own' | 'me' | 'ear', state }]
    function sources(v) {
      v = String(v);
      const my = me(), out = [], seen = new Set();
      for (const x of recent(v)) {
        if (seen.has(x.w)) continue; seen.add(x.w);
        out.push({ w: x.w, kind: x.w === v ? 'own' : x.w === my ? 'me' : 'ear', state: stateOf(v, x.w), ear: x.w !== v && trustedFor(v, x.w) });
      }
      return out;
    }
    // The example behind this page's view of v's own captions: the last pair that disagreed, else the last pair judged.
    // -> { theirs, ours, by } (by: whose ears heard 'ours'), or null when nothing was compared yet.
    function evidence(v) {
      const r = st.get(key(String(v), String(v)));
      const e = r && (r.s === 'trusted' ? r.ex : (r.exBad || r.ex));
      return e ? { theirs: e.theirs || '', ours: e.ours || '', by: e.by || '' } : null;
    }
    // Has this page ever held a caption line for v, or judged v's captions? (The tile's Captions row is offered then.)
    function known(v) { v = String(v); return lines.has(v) || st.has(key(v, v)); }
    function dump() {
      const o = { states: {}, picks: Object.fromEntries(Array.from(taught, ([k, t]) => [k, t.kind === 'ear' ? t.w : t.kind])), ears: {}, earBad: Array.from(earBad), warned: Array.from(warned) };
      for (const [k, r] of st) o.states[k] = { s: r.s, ok: r.ok, bad: r.bad, why: r.why, by: r.by };
      for (const [w, n] of earOk) o.ears[w] = n;
      return o;
    }
    // A line the transcript folded into one it already holds: the live captions still show it when it comes from the
    // source this page shows for that voice, or when that source is quiet and the line is from an undoubted ear (as
    // shows() does for any line). A voice shown from every source has its sentence on screen already.
    function showsHeld(l) {
      if (!l || !l.byId || !l.w) return false;
      const v = String(l.byId), w = String(l.w);
      if (v === me() || w === v) return false;
      const c = choice(v);
      if (c.show === w) return true;
      return c.show !== 'all' && shows(l);
    }
    return { observe, tick, choice, shows, showsHeld, earWanted, verdict, pick, moved, flag, sources, stateOf, hasEars, evidence, known, dump };
  }

  // THE SPEAKER'S SIDE (docs/caption-trust.md section 7): the language other pages' ears hear MY voice in.
  // An ear line about me that another page sends is that page's vote when it carries ld (Whisper detected the language)
  // or vt 0 (their ears do not match my captions); vt 1 withdraws it. Only the writer, the language and those flags are
  // read. A language is suggested when CL_AGREE_N distinct others agree on it (the only other person, in a meeting of two).
  // opts: { me() my id, now(), keepMs, mine() the language my captions listen for ('' when my engine detects it),
  //         others() how many other people are in the meeting }
  function langHint(opts) {
    const d = Object.assign({}, DIALS, opts.dials || {});
    const now = opts.now || (() => Date.now());
    const short = (l) => String(l || '').toLowerCase().split(/[-_]/)[0];
    const votes = new Map();   // writer -> { lang, at }
    const kept = new Set();    // languages the speaker chose to keep, for this meeting
    function observe(l) {
      const me = String(opts.me() || '');
      if (!l || l.tl || l.src !== 'ear' || !me || String(l.byId) !== me || !l.w || String(l.w) === me) return;
      const w = String(l.w);
      if (l.vt === 1) { votes.delete(w); return; }
      const lang = short(l.lang);
      if (!lang || !(l.ld || l.vt === 0)) return;   // a guess with nothing in doubt says nothing
      votes.set(w, { lang, at: now() });
    }
    function need() { return Math.max(1, Math.min(d.CL_AGREE_N, Math.floor(+opts.others() || 0))); }
    // -> { lang, n, need } when enough others agree on a language my captions do not listen for, else null
    function suggestion() {
      const y = short(opts.mine());
      if (!y) return null;
      const cut = now() - opts.keepMs, count = new Map();
      for (const [w, v] of votes) {
        if (v.at < cut) { votes.delete(w); continue; }
        if (v.lang !== y && !kept.has(v.lang)) count.set(v.lang, (count.get(v.lang) || 0) + 1);
      }
      let best = null;
      for (const [lang, n] of count) if (!best || n > best.n) best = { lang, n };
      const k = need();
      return best && best.n >= k ? Object.assign(best, { need: k }) : null;
    }
    function keep(lang) { if (lang) kept.add(short(lang)); }
    function dump() {
      const o = { votes: {}, kept: Array.from(kept), need: need(), mine: short(opts.mine()) };
      for (const [w, v] of votes) o.votes[w] = v.lang;
      return o;
    }
    return { observe, suggestion, keep, need, dump };
  }

  GifOS.capTrust = { make, langHint, words, overlap, judge, DIALS };
  if (typeof module !== 'undefined' && module.exports) module.exports = GifOS.capTrust;
})(typeof window !== 'undefined' ? window : globalThis);
