/*
 * route.js: routing and the mesh vote-off, ported line for line from the 0.9.25 sim
 * (test/sim/mesh_seat.inc at gifos 37d787b2d).
 *
 *   routing : nextHopCoord, nextHopToward, routeTo, routeToProbe, probeHop, strictNextHop, route, routeStep
 *   vote    : kVerify, kAddKid, kAddS1, kBanOn, kPush, kTakePush, kickEval, kHealDue (L27), the audits
 *             (kEvidence, kSuspect, kIsE2Src, kConfAsk, kTakeConf, kIntake, kAuditPulse, kAuditAns,
 *             kAuditTimeouts, kHolderAsk, kHolderAns)
 *
 * Port conventions are in seat.js. A by-value Msg or Coord parameter is copied on entry (route's `inner`).
 * Callees other units supply (admit, emit, answerDoor, l2Around, probeNote, goodbye, goodbyeHeal ...) are
 * called as methods of the seat by their C++ name. gate() (a thread-pool fence) has no JS form.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const hash = req('./hash.js', 'meshHash');
  const dig = req('./dig.js', 'meshDig');
  const C_ = req('./consts.js', 'meshConsts');
  const state = req('./state.js', 'meshState');
  const roles = req('./roles.js', 'meshRoles');
  const { ins } = req('./util.js', 'meshUtil');
  const { Seat } = req('./seat.js', 'meshSeat');
  const { cellOk, coordStr } = req('./shared.js', 'meshShared');

  const K = C_.consts, E = C_.enums;
  const { ckey, unckey, ownedLinks, rowMates, colMates, up, down, pcDepth, parentPath, lastDigit } = topo;
  const C = topo.C;
  const { H_INIT, hmix, hmix64, fmix32 } = hash;
  const newMsg = (t) => msg.newMsg(t);
  const cc = topo.cc;
  const LS_CLOSED = E.LS_CLOSED, LS_OPEN = E.LS_OPEN;

  const mtInt = (t) => msg.MT_NAMES.indexOf(t);   // (int)m.t: the sim's MT enum is in MT_NAMES order
  const answerType = (t) => t === 'NOROOM' || t === 'PLACE' || t === 'FIND' || t === 'FINDACK';

  // ---- routing ---------------------------------------------------------------------------------------------
  Seat.unit('mesh_seat.inc routing', {
    // C++: mesh_seat.inc:Seat::nextHopCoord
    // returns the next cell, or null (already at t / no direction)
    nextHopCoord(t) {
      const c = this.coord;
      if (c.pc === t.pc && c.r === t.r && c.i === t.i) return null;
      if (c.r !== t.r) {   // up and down keep the row, so a row changes only in Section 1: climb there, cross, descend
        if (c.pc !== 0) { if (c.i !== 0) return { pc: c.pc, r: c.r, i: 0 }; return up(c); }
        return { pc: 0, r: t.r, i: c.i };
      }
      if (c.pc === t.pc) return { pc: c.pc, r: c.r, i: t.i };   // same section, same row: row-mate straight to the target column
      // DIFFERENT section: climb to the common ancestor, or descend toward t.
      const digs = (pc, v) => { while (pc) { v.push(lastDigit(pc)); pc = parentPath(pc); } for (let a = 0, b = v.length - 1; a < b; a++, b--) { const x = v[a]; v[a] = v[b]; v[b] = x; } };
      const pa = [], pb = []; digs(c.pc, pa); digs(t.pc, pb);
      let l = 0; while (l < pa.length && l < pb.length && pa[l] === pb[l]) l++;
      if (l < pa.length) { if (c.i !== 0) return { pc: c.pc, r: c.r, i: 0 }; return up(c); }   // climb: to col 0, then up
      const d = pb[pa.length]; if (c.i !== d) return { pc: c.pc, r: c.r, i: d }; return down(c);   // descend toward child digit d
    },
    // C++: mesh_seat.inc:Seat::nextHopToward
    nextHopToward(target, exclude) {
      const id = this.id, TICK = this.TICK;
      if (!this.hasCoord) return -1;
      { const x = this.l2Around(target, exclude, true); if (x >= 0) return x; }   // L2: a row I serve over E2/E3 is a direct link into that row
      { const ideal = this.nextHopCoord(target); if (ideal) { const x = this.occGet(ckey(ideal)); if (x >= 0 && x !== id && x !== exclude && !(this.f.fabricLinkState(id, x) === LS_CLOSED)) return x; } }   // L2: never hand a frame to a link my own transport says is cut
      { const x = this.l2Around(target, exclude, false); if (x >= 0) return x; }   // L2: around a dead E1, by E2 (owner -> backup owner -> heir -> row)
      if (this.coord.pc === 0) {   // W7: Section 1 rook: any live column- or row-mate can carry it onward
        // L3.4.2: the step goes to a mate beside the target's Section-1 cell over an open link first, then over any open link, then any mate
        let tp = target.pc, tc = target.i; while (tp) { tc = lastDigit(tp); tp = parentPath(tp); }   // the target's Section-1 cell: its row, the column its subtree hangs from
        const cm = colMates(this.coord), rm = rowMates(this.coord);
        for (let pass = 0; pass < 3; pass++) for (let s = 0; s < 2; s++) for (let q = 0; q < C - 1; q++) {
          const c = s ? rm[q] : cm[q]; const x = this.occGet(ckey(c)); if (x < 0 || x === id || x === exclude) continue;
          const open = this.f.fabricLinkState(id, x) === LS_OPEN, beside = (c.r === target.r || c.i === tc);
          if (pass === 2 || (open && (pass === 1 || beside))) return x;
        }
        return -1;
      }
      {   // the alternates are my E2 edges (the far end sits beside my owner), then my row
        const usable = (x) => x >= 0 && x !== id && x !== exclude && this.f.fabricLinkState(id, x) === LS_OPEN;   // only a peer my own transport holds open
        if (usable(this.u2Id)) return this.u2Id;
        if (usable(this.u3Id)) return this.u3Id;
        for (const e of this.u2Rows.values()) if (e.heir >= 0 && e.heir !== exclude && TICK - e.at <= 40) return e.heir;
        {
          let best = -1;
          for (const [ck, cv] of this.cousins) {
            const cc2 = unckey(ck); let u;
            if (cv < 0 || cv === id || cv === exclude || !(u = up(cc2)) || u.pc !== target.pc || u.r !== target.r) continue;
            if (ckey(u) === ckey(target)) return cv;
            if (best < 0) best = cv;
          }
          if (best >= 0) return best;   // a cousin climbs into the target's row: a mover's way to mates it has not met yet
        }
        const rm = rowMates(this.coord); for (let q = 0; q < C - 1; q++) { const x = this.occGet(ckey(rm[q])); if (x >= 0 && x !== id && x !== exclude) return x; }
        return -1;
      }
    },
    // C++: mesh_seat.inc:Seat::routeTo
    routeTo(target, tag) {
      const id = this.id;
      const nh = this.nextHopToward(target, -1); if (ckey(this.coord) === ckey(target)) return;
      if (nh >= 0) { const pn = this.probeNote(ckey(target)); const m = newMsg('ROUTE'); m.target = cc(target); m.asker = id; m.tag = tag; m.ttl = 60; m.via = id; m.pseq = ++this.w.lv.RSEQ; m.pn = pn; m.coord = cc(this.coord); this.emit(nh, m); }   // L3.4.1: my cell rides along: the answer comes back by route when the answerer has no channel to me
    },
    // C++: mesh_seat.inc:Seat::routeToProbe
    // The D5 translost probe: it travels the mesh, not the dead link.
    // No alternate hop => nothing is sent. Silence of a frame that never left is not a death; the lease horizon still stands. Returns whether a probe left.
    routeToProbe(target) {
      const id = this.id;
      const tk = ckey(target); if (!this.hasCoord || ckey(this.coord) === tk) return false;
      { const h = this.tlHard.get(tk); if (h === 2 && this.coord.pc === 0 && target.pc === 0) return this.d5Fan(target); }   // D5.1: a loss read from silence is probed on every rook path
      const nh = this.probeHop(target, this.occGet(tk));
      if (nh >= 0) { const pn = this.probeNote(tk); const m = newMsg('ROUTE'); m.target = cc(target); m.asker = id; m.tag = 2; m.ttl = 60; m.via = id; m.pseq = ++this.w.lv.RSEQ; m.coord = cc(this.coord); m.pn = pn; this.emit(nh, m); return true; }
      return false;
    },
    // C++: mesh_seat.inc:Seat::probeHop
    // first hop for a probe (or its answer) that must NOT use the direct link to `target`
    probeHop(target, excludeId) {
      const id = this.id;
      if (this.hasCoord && target.pc === this.coord.pc) {
        if (target.r === this.coord.r) { const rm = rowMates(this.coord); for (let q = 0; q < C - 1; q++) { if (ckey(rm[q]) === ckey(target)) continue; const x = this.occGet(ckey(rm[q])); if (x >= 0 && x !== id && x !== excludeId) return x; } }
        else if (this.coord.pc === 0 && target.i === this.coord.i) { const cm = colMates(this.coord); for (let q = 0; q < C - 1; q++) { if (ckey(cm[q]) === ckey(target)) continue; const x = this.occGet(ckey(cm[q])); if (x >= 0 && x !== id && x !== excludeId) return x; } }
      }
      return this.nextHopToward(target, excludeId);
    },
    // C++: mesh_seat.inc:Seat::strictNextHop
    // the ideal step toward rdst, but ONLY if it is one of MY owned links and occupied
    strictNextHop(rdst) {
      const id = this.id;
      if (!this.hasCoord) return -1;
      const ideal = this.nextHopCoord(rdst); if (!ideal) return -1;   // already at rdst / no direction
      const ik = ckey(ideal);
      const ol = ownedLinks(this.coord);
      for (let k = 0; k < ol.length; k++) if (ckey(ol[k]) === ik) { const x = this.occGet(ik); return (x >= 0 && x !== id) ? x : -1; }
      return -1;                                               // ideal isn't a direct link: drop
    },
    // C++: mesh_seat.inc:Seat::route
    // route(): deliver `inner` to coord rdst over LINKS only. (inner is a C++ by-value Msg: copied here.)
    route(rdst, rfinal, inner) {
      const id = this.id;
      inner = msg.clone(inner); rdst = cc(rdst);
      inner.routing = true; inner.rdst = cc(rdst); inner.rfinal = rfinal; inner.rttl = 64; inner.rvia = id;
      if (this.hasCoord && ckey(this.coord) === ckey(rdst)) {                // I'm the destination cell
        inner.routing = false;
        if (rfinal < 0 || rfinal === id) { this.emit(id, inner); return; } // deliver to MYSELF via the bus
        inner.direct = true; this.emit(rfinal, inner); return;        // direct hand-off over the link
      }
      if (inner.l18) inner.rttl = 16;   // L18: a frame that only lacked a role travels a short way or not at all
      const nh = !this.hasCoord ? this.gateway : inner.l18 ? this.f.l18Hop(id, cc(rdst), -1) : this.strictNextHop(rdst);      // unseated: leave via the gateway link
      if (!inner.adoor && this.answerDoor(nh, rfinal, inner)) { const d = msg.clone(inner); d.routing = false; d.rfinal = -1; d.gwc = true; d.adoor = true; this.emit(rfinal, d); return; }   // L16.3
      if (nh >= 0) this.emit(nh, inner); else if (rfinal >= 0 && answerType(inner.t)) this.trace('ROUTE-DROP', id, this.hasCoord ? this.coord : null, 'mt=%d final=%d dst=%s why=origin', mtInt(inner.t), rfinal, coordStr(rdst));
    },
    // C++: mesh_seat.inc:Seat::routeStep
    // a routing frame arrived at me mid-flight. True iff it is FOR me; false if I forwarded it or dropped it.
    routeStep(m) {
      const id = this.id, TICK = this.TICK;
      const leaseHit = this.hasCoord && ((this.leaseUntil >= 0 && TICK <= this.leaseUntil && ckey(m.rdst) === this.leaseCk)   // T3: in-flight frames for my just-vacated cell land HERE
        || (this.moving && ckey(m.rdst) === this.oldCk));                                                                      // T1 dual-hold
      // L37.6 (mesh_seat.inc routeStep): a routed heal order carries its signer's name from the origin; a router never signs one for another seat
      if (m.t === 'FINDLEAF' && m.fo < 0 && !(this.hasCoord && (ckey(this.coord) === ckey(m.rdst) || leaseHit) && (m.rfinal < 0 || m.rfinal === id))) { this.trace('L37.6-UNSIGNED', id, this.hasCoord ? this.coord : null, 'from=%d hole=%s final=%d', m.from, coordStr(m.hole), m.rfinal); this.w.lv.L376U_DROP++; return false; }
      if (this.hasCoord && (ckey(this.coord) === ckey(m.rdst) || leaseHit)) {
        if (m.rfinal < 0 || m.rfinal === id) { m.routing = false; this.f.l18Deliv(m); return true; }
        const h = msg.clone(m); h.routing = false;
        h.direct = true; this.emit(m.rfinal, h); return false;   // direct hand-off over the link
      }
      if (m.rttl <= 0) { if (m.rfinal >= 0 && answerType(m.t)) this.trace('ROUTE-DROP', id, this.hasCoord ? this.coord : null, 'mt=%d final=%d dst=%s why=ttl', mtInt(m.t), m.rfinal, coordStr(m.rdst)); return false; }   // give up: sender retries
      const nh = m.l18 ? this.f.l18Hop(id, cc(m.rdst), m.rvia) : this.strictNextHop(m.rdst);   // L18: round a hole on my own links
      if (!m.adoor && this.answerDoor(nh, m.rfinal, m)) { const d = msg.clone(m); d.routing = false; d.rfinal = -1; d.gwc = true; d.adoor = true; this.emit(m.rfinal, d); return false; }   // L16.3
      if (nh < 0) { if (m.rfinal >= 0 && answerType(m.t)) this.trace('ROUTE-DROP', id, this.hasCoord ? this.coord : null, 'mt=%d final=%d dst=%s why=nohop', mtInt(m.t), m.rfinal, coordStr(m.rdst)); return false; }   // no link toward rdst: drop
      const f = msg.clone(m); f.rttl = m.rttl - 1; f.rvia = id; this.emit(nh, f); return false;
    },
  });

  // ---- L27: the mesh vote-off ------------------------------------------------------------------------------
  // C++: mesh_seat.inc:kOver
  // The targets a complete, fresh fold carries over the bar.
  function kOver(R, now, self, on = []) {   // fills and returns `on` (FREE.kOver form)
    if (R.at < 0 || R.part || R.rx < 0 || now - R.rx > K.DIG_TTL) return on;   // a partial or stale fold says nothing
    const pop = Math.max(0, R.n) + Math.max(0, R.leased);
    for (const e of R.kick) { const base = pop - R.kabs - e.dn; const need = Math.max(2, Math.trunc(base / 2) + 1); if (e.up >= need && e.tgt !== self) on.push(e.tgt); }
    return on;
  }
  Seat.free({ kOver });

  // ---- D5.1: a death read from silence is checked on every rook path ------------------------------------------
  Seat.unit('mesh_d5paths.inc', {
    // C++: mesh_d5paths.inc:Seat::d5Fan
    // the silence probe, one copy through each of my rook mates (never the probed seat)
    d5Fan(target) {
      const id = this.id;
      const tk = ckey(target); const tx = this.occGet(tk); const pn = this.probeNote(tk);
      const cm = colMates(this.coord), rm = rowMates(this.coord);
      let sent = 0;
      for (let s = 0; s < 2; s++) for (let q = 0; q < C - 1; q++) { const c = s ? cm[q] : rm[q]; if (ckey(c) === tk) continue; const x = this.occGet(ckey(c)); if (x < 0 || x === id || x === tx) continue;
        const m = newMsg('ROUTE'); m.target = cc(target); m.asker = id; m.tag = K.D51_PROBE; m.ttl = K.D51_TTL; m.via = id; m.pseq = ++this.w.lv.RSEQ; m.coord = cc(this.coord); m.pn = pn; this.emit(x, m); sent++; }
      return sent > 0;
    },
    // C++: mesh_d5paths.inc:Seat::d5AnsFan
    // the probed seat's answer through each of its own rook mates (the asker's own copy goes as before)
    d5AnsFan(p) {
      const id = this.id;
      const cm = colMates(this.coord), rm = rowMates(this.coord);
      for (let s = 0; s < 2; s++) for (let q = 0; q < C - 1; q++) { const c = s ? cm[q] : rm[q]; const x = this.occGet(ckey(c)); if (x < 0 || x === id || x === p.asker) continue;
        const a = newMsg('ROUTE'); a.target = cc(p.coord); a.asker = id; a.tag = K.D51_ANS; a.ttl = K.D51_TTL; a.via = id; a.pseq = ++this.w.lv.RSEQ; a.ck = ckey(this.coord); a.pn = p.pn; this.emit(x, a); }
    },
    // C++: mesh_d5paths.inc:Seat::d5Hop
    // the next hop for an answer about cell ck: never the seat at ck (its own frames are what went missing)
    d5Hop(m) {
      const avoid = this.occGet(m.ck); let nh = this.nextHopToward(m.target, m.via);
      if (nh >= 0 && nh === avoid) nh = this.nextHopToward(m.target, avoid);
      return nh === avoid ? -1 : nh;
    },
  });
  // C++: mesh_seat.inc:kHash
  function kHash(a, b, c) { return fmix32(hmix(hmix64(hash.hmixId(H_INIT, a), b), c >>> 0)); }
  // C++: mesh_seat.inc:kSameVote
  function kSameVote(a, b) {
    const srt = (v) => v.slice().sort((x, y) => x - y);
    const eq = (x, y) => x.length === y.length && x.every((t, i) => t === y[i]);
    return a.all === b.all && eq(srt(a.yes), srt(b.yes)) && eq(srt(a.abs), srt(b.abs));
  }
  // C++: mesh_seat.inc:kHasVote
  function kHasVote(k) { return k.all || k.yes.length > 0 || k.abs.length > 0; }
  // C++: mesh_seat.inc:kTakerOf
  // The seat that takes a cell's statement first-hand.
  function kTakerOf(ck) { const v = unckey(ck); if (v.pc === 0) return ck; if (v.i !== 0) return ckey({ pc: v.pc, r: v.r, i: 0 }); const o = up({ pc: v.pc, r: v.r, i: 0 }); if (o) return ckey(o); return ck; }
  // C++: mesh_seat.inc:kInScope
  // Is cell v in the scope a report from cell c speaks for? (rowScope: c is a child head and its report is its whole row)
  function kInScope(v, c, rowScope) {
    let x = unckey(v); const cc2 = unckey(c);
    for (let g = 0; g < 40; g++) {
      if (rowScope ? (x.pc === cc2.pc && x.r === cc2.r) : ckey(x) === c) return true;
      if (x.pc === 0) return false;
      const o = up({ pc: x.pc, r: x.r, i: 0 }); if (!o) return false; x = o;
    }
    return false;
  }

  Seat.unit('mesh_seat.inc vote', {
    // C++: mesh_seat.inc:Seat::kVerify
    // Reasons a statement is refused: 1 not over the voter's own link, 2 bad signature, 3 names a voter that is not the phoner,
    // 4 not a seat whose report I fold, 5 not the seat I hold there (or held too briefly), 6 another tenancy, 7 replay.
    kVerify(m, sure) {
      const TICK = this.TICK;
      const k = m.kv;
      if (!sure || m.routing) return 1;
      if (!k.good || k.signer !== k.voter) return 2;
      if (k.voter !== m.id) return 3;
      if (!this.hasCoord || this.state !== 3) return 4;
      const pk = ckey(m.coord);
      if (k.ck !== pk) return 4;
      const down1 = pk === ckey(down(this.coord));
      const mate = this.coord.pc !== 0 && this.coord.i === 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r && pk !== ckey(this.coord);
      if (!down1 && !mate) return 4;
      if (this.occGet(pk) !== k.voter || !this.firstHandLive(pk)) return 5;
      { const pa = this.pairAt.get(pk); if (pa === undefined || TICK - pa < K.KICK_SEAT) return 5; }   // a phone cannot seat itself and vote in one breath
      if (k.tn < 0 || k.tn !== m.tn) return 6;
      { const t = this.tenOf.get(pk); if (t !== undefined && t[0] === k.voter && t[1] >= 0 && t[1] !== k.tn) return 6; }
      { const sv = this.kSeen.get(k.voter); if (sv !== undefined && k.ver < sv) return 7; }
      return 0;
    },
    // C++: mesh_seat.inc:Seat::kAddKid
    kAddKid(d, k) {
      if (this.kvKid.size === 0) return;
      const it = this.kvKid.get(k); if (it === undefined) return;
      const s = it[0];
      if (this.TICK - it[1] > K.DIG_TTL || this.occGet(k) !== s.voter || this.kBanned(s.voter)) return;   // a statement lives only while its voter's beats bring it and it sits where it said
      { const t = this.tenOf.get(k); if (t !== undefined && t[0] === s.voter && t[1] >= 0 && t[1] !== s.tn) return; }
      dig.kListAdd(d.kl, s);   // L27.9: the signed statement itself rides up; the counts are derived from the list
    },
    // C++: mesh_seat.inc:Seat::kAddS1
    kAddS1(d, k, s) {
      if (!s.good || s.signer !== s.voter || s.ck !== k || this.kBanned(s.voter)) return;   // the signature travels end to end
      if (s.voter !== this.id && this.occGet(k) !== s.voter) return;                          // the holder of that Section-1 cell, as I know the ring
      { const t = this.tenOf.get(k); if (s.voter !== this.id && t !== undefined && t[0] === s.voter && t[1] >= 0 && t[1] !== s.tn) return; }
      dig.kListAdd(d.kl, s);
    },
    // C++: mesh_seat.inc:Seat::kBanOn
    kBanOn(t) {
      const id = this.id, TICK = this.TICK;
      this.trace('KICK', id, this.hasCoord ? this.coord : null, 'tgt=%d', t);
      if (this.state === 3 && this.hasCoord) { const ks = []; this.goodbye(t, ks); for (const k of ks) this.kHeal.push([k, TICK + this.w.lv.KICK_HOLD]); }   // its cells are freed as if it had said goodbye; their heal waits KICK_HOLD
      for (const [k, v] of this.kvKid) if (v[0].voter === t) this.kvKid.delete(k);
      this.f.fabricKickClose(id, t);                 // and my channel to it closes (link model)
    },
    // C++: mesh_seat.inc:Seat::kPush
    // THE SECOND UP-EDGE: push my decision fold once to the E2 sources whose backup owner I am and to my row-mates.
    kPush(bk = false, fold = null) {
      const id = this.id;
      if (!this.hasCoord || this.state !== 3) return;
      const p = newMsg('PONG'); p.tag = 27; p.kbk = bk; p.id = id; p.coord = cc(this.coord); p.dgRoot = this.wireDig(fold ? fold : this.rootDec); p.dgRoot.kl.length = 0; p.sig = true; p.sigAt = this.TICK | 0;   // a relay of the backup path carries the backup's fold, not mine; signed: the parked E2 edge may carry it routed
      const to = new Set();
      for (const e of this.u2Rows.values()) if (e.heir >= 0 && e.heir !== id) to.add(e.heir);
      for (let j = 0; j < C; j++) { if (j === this.coord.i) continue; const x = this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: j })); if (x >= 0 && x !== id) to.add(x); }
      const v = Array.from(to); v.sort((a, b) => a - b);
      for (const x of v) if (!this.kBanned(x)) { this.trace('KICK-PUSH', id, this.coord, 'to=%d', x); this.emit(x, p); }
    },
    // C++: mesh_seat.inc:Seat::kTakePush
    kTakePush(m) {
      const id = this.id, TICK = this.TICK;
      if (this.kIgnore || !this.hasCoord || this.state !== 3 || !(this.linkIs(m, m.id) || (m.sig && m.id >= 0))) return;
      const R = dig.cloneDig(m.dgRoot); this.rxDig(R); const on = []; kOver(R, this.LT(), id, on); this.trace('KICK-PUSHIN', id, this.coord, 'by=%d over=%d part=%d age=%lld', m.id, on.length, R.part ? 1 : 0, this.LT() - R.rx); if (on.length === 0) return;
      const fromBackup = this.u2Id >= 0 && m.id === this.u2Id;
      const mate = m.coord.pc === this.coord.pc && m.coord.r === this.coord.r && this.occGet(ckey(m.coord)) === m.id;
      let e2src = false;
      if (mate && this.coord.pc !== 0) { const view = (c) => ckey(c) === ckey(this.coord) || this.occGet(ckey(c)) >= 0; const h = roles.e2SrcOf({ pc: this.coord.pc, r: this.coord.r, i: 0 }, view); e2src = !!h && ckey(h) === ckey(m.coord); }
      let any = false, conf = false;
      for (const t of on) {
        { if (fromBackup) { this.kConfAt.set(t, TICK); conf = true; } else if (e2src && m.kbk && this.kUpLink(t)) { this.kConfAt.set(t, TICK); } }   // L27.8: the backup path's word
        if (this.vban.has(t)) continue;
        const ok = (fromBackup || (e2src && m.kbk && this.kUpLink(t)));
        if (!ok) continue; this.vban.set(t, TICK); this.trace('KICK-PUSHED', id, this.coord, 'tgt=%d by=%d', t, m.id); this.kBanOn(t); any = true;
      }
      if (any || conf) this.kPush(fromBackup, fromBackup ? R : null);
    },
    // C++: mesh_seat.inc:Seat::kickEval
    kickEval() {
      const TICK = this.TICK;
      if (this.kIgnore || !this.w.lv.DIGEST || !this.hasCoord || this.state !== 3) return;
      const R = this.rootDec;
      if (R.at < 0 || R.part || R.rx < 0 || this.LT() - R.rx > K.DIG_TTL) return;   // a partial or stale fold changes nothing: neither a new verdict nor a lift
      const on = []; kOver(R, this.LT(), this.id, on);
      for (const tgt of Array.from(this.vban.keys())) {
        const still = on.includes(tgt); if (still) { this.kLow.delete(tgt); continue; }
        const lw = this.kLow.get(tgt); if (lw === undefined) { this.kLow.set(tgt, TICK); continue; }   // a lift needs the majority gone from every complete fold for KICK_LIFT
        if (TICK - lw < K.KICK_LIFT) continue;
        this.trace('KICK-LIFT', this.id, this.coord, 'tgt=%d', tgt); this.kLow.delete(tgt); this.vban.delete(tgt);
      }
      let fresh = false; for (const t of on) if (!this.vban.has(t)) { if (this.kUpLink(t) && !this.kConfirmed(t)) { if (this.kIsE2Src(t)) this.kConfAsk(t); continue; } this.vban.set(t, TICK); this.kBanOn(t); fresh = true; }   // L27.8: my own head or owner is refused only when the backup path agrees
      if (fresh) this.kPush();
      this.kHealDue();
    },
    // C++: mesh_seat.inc:Seat::kHealDue
    kHealDue() {
      const TICK = this.TICK;
      if (this.kHeal.length === 0) return;
      const due = []; const keep = []; for (const e of this.kHeal) { if (TICK >= e[1]) due.push(e[0]); else keep.push(e); } this.kHeal.length = 0; for (const e of keep) this.kHeal.push(e);
      for (const k of due) if (this.state === 3 && this.hasCoord && this.occGet(k) < 0 && k !== ckey(this.coord)) this.goodbyeHeal(k);   // nobody filled it meanwhile: heal it as the goodbye would have
    },
    // C++: mesh_seat.inc:Seat::kEvidence
    kEvidence(who, voter, why, hard = false) {
      const TICK = this.TICK;
      if (who < 0) return;
      if (voter) { this.kEvV.set(who, ins(this.kEvV, who, () => 0) + 1); } else { if (!this.kEvS.has(who)) this.kEvFirst.set(who, TICK); this.kEvS.set(who, ins(this.kEvS, who, () => 0) + 1); }
      this.trace('KAUDIT', this.id, this.hasCoord ? this.coord : null, '%s=%d why=%s', voter ? 'voter' : 'child', who, why);
      if (hard && !voter) {   // L27.12: hard evidence is the aggregator's own act, provable by me alone
        const l = this.kEvHLast.get(who); if (l !== undefined && TICK - l > K.KICK_EVID_FORGET) this.kEvH.set(who, 0);
        this.kEvH.set(who, ins(this.kEvH, who, () => 0) + 1); this.kEvHLast.set(who, TICK);
        if (this.kEvH.get(who) >= K.KICK_EVID && !this.kSuspAt.has(who)) { this.kSuspAt.set(who, TICK); this.trace('KSUSPECT', this.id, this.hasCoord ? this.coord : null, 'who=%d why=%s', who, why); }
      }
    },
    // C++: mesh_seat.inc:Seat::kSuspect
    // L27.12: an aggregator is a SUSPECT once KICK_EVID hard items stand against it.
    kSuspect(who) {
      if (who < 0) return false;
      const e = this.kEvH.get(who); if (e === undefined || e < K.KICK_EVID) return false;
      const l = this.kEvHLast.get(who); return l !== undefined && this.TICK - l <= K.KICK_EVID_FORGET;
    },
    // C++: mesh_seat.inc:Seat::kIsE2Src
    kIsE2Src(t) {
      if (!this.hasCoord || this.coord.pc === 0 || t < 0) return false;
      const view = (c) => ckey(c) === ckey(this.coord) || this.occGet(ckey(c)) >= 0;
      const h = roles.e2SrcOf({ pc: this.coord.pc, r: this.coord.r, i: 0 }, view);
      return !!h && this.occGet(ckey(h)) === t;
    },
    // C++: mesh_seat.inc:Seat::kConfAsk
    // My head's fold votes off my row's E2 source: I ask the backup owner and the standby, and take the verdict only from a fold that carries it.
    kConfAsk(t) {
      const id = this.id, TICK = this.TICK;
      if (!this.hasCoord || this.state !== 3) return;
      const it = this.kAskAt.get(t); if (it !== undefined && TICK - it < K.KICK_CONF_EVERY) return;
      this.kAskAt.set(t, TICK);
      const to = [this.bkId, this.sbId];
      for (const x of to) { if (x < 0 || x === id || x === t || this.kBanned(x)) continue; const q = newMsg('AUDITQ'); q.id = id; q.asker = id; q.tag = 27; q.ck = ckey(this.coord); this.trace('KICK-CONF-ASK', id, this.coord, 'tgt=%d to=%d', t, x); this.f.fabricAudit(id, x, q); }
    },
    // C++: mesh_seat.inc:Seat::kTakeConf
    kTakeConf(m) {
      const TICK = this.TICK;
      if (!this.hasCoord || this.state !== 3 || m.id < 0 || (m.id !== this.bkId && m.id !== this.sbId)) return;   // only the seats my head named, and only over the channel I dialled
      const R = dig.cloneDig(m.dgRoot); this.rxDig(R); const on = []; kOver(R, this.LT(), this.id, on);
      for (const t of on) if (this.kUpLink(t) && !this.kConfirmed(t)) { this.kConfAt.set(t, TICK); this.trace('KICK-CONF', this.id, this.coord, 'tgt=%d by=%d', t, m.id); }
    },
    // C++: mesh_seat.inc:Seat::kIntake
    kIntake(u, author, firstHand, from = 0, rowScope = false) {
      if (this.kSuspect(author)) {   // L27.12: a suspect's votes are not in my fold; I keep what it sent so the audits go on judging it
        if (u.kl.length) {
          const all = u.kl; u.kl = []; const raw = []; dig.kDerive(u); let bad = 0, out = 0, mine = 0;
          for (const k of all) { if (!dig.kSigOk(k)) bad++; else if (from && !kInScope(k.ck, from, rowScope)) out++; else if (from && k.ck === from && author >= 0 && k.voter !== author) mine++; else raw.push(dig.cloneKStmt(k)); }   // (only entries that pass the intake checks are audited)
          if (firstHand && (bad || out || mine)) this.kEvidence(author, false, bad ? 'forged-entry' : out ? 'out-of-scope' : 'claims-my-cell', true);
          this.kRaw.set(author, raw);
        }
        return;
      }
      let bad = 0, out = 0, mine = 0; const ok = [];
      for (const k of u.kl) {
        if (!dig.kSigOk(k)) { bad++; continue; } if (from && !kInScope(k.ck, from, rowScope)) { out++; continue; }
        if (from && k.ck === from && author >= 0 && k.voter !== author) { mine++; continue; }   // L27.11: the cell it reports from holds the author, nobody else
        ok.push(k);
      }
      if (bad || out || mine) { u.kl = ok; dig.kDerive(u); if (firstHand) this.kEvidence(author, false, bad ? 'forged-entry' : out ? 'out-of-scope' : 'claims-my-cell', true); }   // a statement its voter did not sign, or a voter its scope does not hold
    },
    // C++: mesh_seat.inc:Seat::kAuditPulse
    kAuditPulse() {
      const id = this.id, TICK = this.TICK;
      if (!this.hasCoord || this.state !== 3 || (this.rootDec.kick.length === 0 && this.rootDig.kick.length === 0 && this.myDig.kl.length === 0)) return;   // only while the room holds a vote (inert otherwise)
      const inn = [];   // {k, by, kl, fh}
      const lst = (by, kl) => { if (this.kSuspect(by)) { const r = this.kRaw.get(by); if (r !== undefined) return r; } return kl; };   // L27.12: a suspect's lists are audited as it sent them
      if (this.downDig.at >= 0 && this.downDig.by >= 0) inn.push({ k: ckey(down(this.coord)), by: this.downDig.by, kl: lst(this.downDig.by, this.downDig.kl), fh: true });   // every child, list or none
      if (this.coord.pc !== 0 && this.coord.i === 0) for (const [ek, ev] of this.rowKids) if (ev.by >= 0) inn.push({ k: ek, by: ev.by, kl: lst(ev.by, ev.kl), fh: true });
      if (this.coord.pc === 0) for (const [ek, ev] of this.s1tab) if (ev.by >= 0 && ek !== ckey(this.coord)) inn.push({ k: ek, by: ev.by, kl: ev.kl, fh: false });   // a relayed table: its author is not blamed for what a relayer could have put there
      {   // L27.11: how long each voter has been listed, uninterrupted, by the same first-hand child
        for (const c of inn) if (c.fh) for (const k of c.kl) { const l = ins(this.kLst, k.voter, () => state.newStruct('KLst')); if (l.child !== c.by || TICK - l.last > 12) { l.child = c.by; l.since = TICK; } l.last = TICK; }
        for (const [kv, l] of this.kLst) if (TICK - l.last > 48) this.kLst.delete(kv);
      }
      if (kHash(id, TICK, 0x61) % K.KICK_AUD_EVERY) return;
      if (inn.length === 0) return;
      inn.sort((a, b) => (a.k < b.k ? -1 : b.k < a.k ? 1 : 0));
      // A child only I fold has no other auditor: a Section-1 seat gives its child head half its audits.
      let pickI = kHash(id, TICK, 0x62) % inn.length;
      if (this.coord.pc === 0 && this.downDig.at >= 0 && this.downDig.by >= 0 && (kHash(id, TICK, 0x66) & 1)) for (let z = 0; z < inn.length; z++) if (inn[z].k === ckey(down(this.coord))) pickI = z;
      const c = inn[pickI];
      const member = kHash(id, TICK, 0x63) & 1;
      const q = newMsg('AUDITQ'); q.id = id; q.asker = id; q.ck = c.k;
      if (!member) {
        if (this.kAudV.size) return;
        let own = []; for (const k of c.kl) if (k.ck && kTakerOf(k.ck) === c.k) own.push(k);   // the child's own takes
        if (own.length === 0) return;
        { const fresh = []; for (const k of own) { const a = this.kAnsAt.get(k.voter); if (a === undefined || TICK - a > 2 * K.KICK_AUD_GRACE) fresh.push(k); } if (fresh.length) own = fresh; }   // L27.11: a voter that answered lately is vouched for
        const e = own[kHash(id, TICK, 0x64) % own.length];
        if (e.voter === id) return;
        const a = state.newStruct('KAud'); a.child = c.by; a.ck = c.k; a.e = dig.cloneKStmt(e); a.at = TICK; a.kind = 1; this.kHolderAsk(e.voter, a); this.kAudV.set(e.voter, a); this.kAudN++;
        this.f.fabricAudit(id, e.voter, q);
      } else {
        if (this.kAudC.size) return;
        // The cells whose statement the child takes itself.
        const base = unckey(c.k); const cand = [];
        if (ckey(down(this.coord)) === c.k) { for (let j = 1; j < C; j++) { const r1 = { pc: base.pc, r: base.r, i: j }; if (cellOk(ckey(r1))) cand.push(r1); } }
        else { const d1 = down(base); if (cellOk(ckey(d1))) cand.push(d1); }
        if (cand.length === 0) return;
        const pick = cand[kHash(id, TICK, 0x65) % cand.length]; if (ckey(pick) === ckey(this.coord)) return;
        const a = state.newStruct('KAud'); a.child = c.by; a.ck = c.k; a.at = TICK; a.kind = 2; this.kAudC.set(ckey(pick), a); this.kAudN++;
        q.nc = -1; q.hole = cc(pick); this.route(pick, -1, q);
      }
    },
    // C++: mesh_seat.inc:Seat::kAuditAns
    kAuditAns(m) {
      const id = this.id, TICK = this.TICK;
      const S = m.kv;
      if (!dig.kSigOk(S) || S.voter !== m.id) return;
      this.kAnsAt.set(m.id, TICK);
      const it = this.kAudV.get(m.id);
      if (it !== undefined) {
        const a = it; this.kAudV.delete(m.id); const e = a.e;
        if (S.ver === e.ver) { if (!kSameVote(S, e)) this.kEvidence(m.id, true, 'equivocate'); return; }   // two statements, one ver, both signed by it
        if (S.ver < e.ver) { this.kEvidence(m.id, true, 'older'); return; }                                // it answers with a statement older than one it signed
        let lost = false; for (const t of e.yes) if (!S.yes.includes(t)) lost = true; if (e.all && !S.all) lost = true;
        if (lost && TICK - S.ver > K.KICK_AUD_GRACE) this.kEvidence(a.child, false, 'stale');                 // withdrawn long ago, still listed
        return;
      }
      const jk = ckey(m.hole), jt = this.kAudC.get(jk);
      if (jt !== undefined) {
        const a = jt; this.kAudC.delete(jk);
        if (!kHasVote(S) || TICK - S.ver <= K.KICK_AUD_GRACE) return;   // nothing to find yet
        let kl = null;
        if (this.downDig.at >= 0 && ckey(down(this.coord)) === a.ck) kl = this.downDig.kl; else { const rk = this.rowKids.get(a.ck); if (rk !== undefined) kl = rk.kl; else { const st = this.s1tab.get(a.ck); if (st !== undefined) kl = st.kl; } }
        if (!kl) return;
        for (const k of kl) if (k.voter === S.voter && k.ver >= S.ver) return;
        { const kk = this.kvKid.get(ckey(m.coord)); if (kk !== undefined && kk[0].voter === S.voter) return; }   // its vote is in MY list (I took it first-hand)
        for (const e of this.s1tab.values()) if (e.kOwn.voter === S.voter) return;                                // a Section-1 seat's own vote rides its table beside the list
        if (S.voter === id) return;
        this.kEvidence(a.child, false, 'dropped');
      }
    },
    // C++: mesh_seat.inc:Seat::kAuditTimeouts
    kAuditTimeouts() {
      const id = this.id, TICK = this.TICK;
      const late = [];
      for (const [vk, a] of Array.from(this.kAudV)) {
        if (TICK - a.at > K.KICK_AUD_WAIT) { late.push([vk, a]); this.kAudV.delete(vk); continue; }
        if (a.rs >= 0 && TICK >= a.rs) { a.rs = -1; const q = newMsg('AUDITQ'); q.id = id; q.asker = id; q.ck = a.ck; this.f.fabricAudit(id, vk, q); }   // L27.11: the second ask, half way through the wait
      }
      late.sort((a, b) => a[0] - b[0]);
      for (const x of late) {
        const a = x[1];
        this.kEvU.set(a.child, ins(this.kEvU, a.child, () => 0) + 1); this.trace('KAUDIT', id, this.hasCoord ? this.coord : null, 'child=%d why=unanswered voter=%d', a.child, x[0]);
        if (a.held) { const l = this.kLst.get(x[0]); if (l !== undefined && l.child === a.child && TICK - l.last <= 12) this.kEvidence(a.child, false, 'invented-voter', true); }
      }
      for (const [k, a] of Array.from(this.kAudC)) if (TICK - a.at > K.KICK_AUD_WAIT) this.kAudC.delete(k);
      for (const [k, a] of Array.from(this.kAudH)) if (TICK - a.at > K.KICK_AUD_WAIT) this.kAudH.delete(k);
    },
    // C++: mesh_seat.inc:Seat::kHolderAsk
    // L27.11: an invented voter is caught for sure.
    kHolderAsk(v, a) {
      const id = this.id, TICK = this.TICK;
      if (this.kAudH.size >= 4) return;
      const l = this.kLst.get(v); if (l === undefined || l.child !== a.child || TICK - l.since < K.KICK_AUD_GRACE || TICK - l.last > 12) return;
      const cell = a.e.ck; if (!cell || cell === a.ck) return;   // (an entry on the child's own cell is refused at intake)
      const h = this.occGet(cell); if (h < 0 || h === v || h === a.child || h === id || this.kBanned(h)) return;
      const q = state.newStruct('KHold'); q.child = a.child; q.voter = v; q.cell = cell; q.e = dig.cloneKStmt(a.e); q.at = TICK; q.ck = a.ck; this.kAudH.set(h, q);
      a.rs = TICK + Math.trunc(K.KICK_AUD_WAIT / 2);
      const m = newMsg('AUDITQ'); m.id = id; m.asker = id; m.tag = 28; m.ck = cell; this.f.fabricAudit(id, h, m);
    },
    // C++: mesh_seat.inc:Seat::kHolderAns
    kHolderAns(m) {
      const it = this.kAudH.get(m.id); if (it === undefined) return;
      const q = it; this.kAudH.delete(m.id);
      if (!dig.kSigOk(m.kv) || m.kv.voter !== m.id || m.kv.ck !== q.cell || ckey(m.coord) !== q.cell) return;   // not at that cell: my view of its holder was stale, nothing is proven
      if (m.hold < 2 * K.DIG_TTL) return;   // it took the cell lately: a late refill proves nothing
      const v = this.kAudV.get(q.voter); if (v !== undefined && v.child === q.child) v.held = true;
    },
  });

  const api = Object.freeze({ coordStr, cellOk, kHash, kOver, kInScope, kTakerOf, kSameVote, kHasVote });
  GifOS.meshRoute = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
