/*
 * seat-rest.js: the Seat members of mesh_seat.inc (and mesh_hostile.inc, mesh.cpp) that no other unit file
 * ported, found by the merge's orphan sweep. Methods only, added to the Seat. gate() is a thread-pool fence
 * in the C++ and is nothing here.
 *
 *   - a C++ bool function with an out-parameter returns the out value (null for false): arbCellOf.
 *   - hostileRecv reaches the harness through the world: w.seats, w.alive, w.nextId, w.hostSend(from, to, m),
 *     w.hostPickHonest(rng, id) (mesh_hostile.inc; the hostile gate's harness supplies them).
 *   - attack and l13Merging read the world's levers / w.L13CUR.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const dig = req('./dig.js', 'meshDig');
  const roles = req('./roles.js', 'meshRoles');
  const rngM = req('./rng.js', 'meshRng');
  const { Seat, l13MergingOf, l25OrdKey } = req('./seat.js', 'meshSeat');
  const { cellOk, ownerCoordOf, fabricToken } = req('./shared.js', 'meshShared');

  const K = C_.consts, E = C_.enums;
  const { ckey, ckPc, unckey, ownedLinks, down } = topo;
  const C = topo.C;
  const newMsg = (t) => msg.newMsg(t);
  const unck = unckey;

  Seat.unit('mesh_seat.inc rest', {
    // C++: mesh_seat.inc:Seat::ownedLinkCell
    ownedLinkCell(k) { if (!this.hasCoord) return false; const ol = ownedLinks(this.coord); for (const c of ol) if (ckey(c) === k) return true; return false; },

    // C++: mesh_seat.inc:Seat::isArbCell
    isArbCell(k) {
      if (!this.hasCoord) return false;
      if (this.coord.pc === 0) return cellOk(k) && unck(k).pc === 0 && this.ownedLinkCell(k);
      let tc; if (this.coord.i !== 0) tc = { pc: this.coord.pc, r: this.coord.r, i: 0 }; else { tc = this.ownerCoord(); if (!tc) return false; }
      return ckey(tc) === k;
    },

    // C++: mesh_seat.inc:Seat::arbCellOf
    // The arbiter's cell key, or null.
    arbCellOf(x) {
      if (x < 0 || !this.hasCoord) return null;
      for (const [ek, ev] of this.occ) if (ev === x && !this.isArbCell(ek) && (this.firstHandLive(ek) || this.s1Fresh(ek))) return null;
      const at = (k) => { if (this.occGet(k) !== x || !this.heardAt(k, x)) return false; const l = this.linkedBy.get(k); return l !== undefined && l === x; };
      if (this.coord.pc === 0) { const ol = ownedLinks(this.coord); for (const c of ol) if (c.pc === 0 && at(ckey(c))) return ckey(c); return null; }
      let tc; if (this.coord.i !== 0) tc = { pc: this.coord.pc, r: this.coord.r, i: 0 }; else { tc = this.ownerCoord(); if (!tc) return null; }
      if (!at(ckey(tc))) return null; return ckey(tc);
    },

    // C++: mesh_seat.inc:Seat::mvdOk
    mvdOk(k, mvd, x) {
      if (!this.hasCoord || mvd === k || mvd === ckey(this.coord) || !cellOk(mvd) || !this.claimRel(mvd, x, false)) return false;
      const v = this.occGet(mvd); return v < 0 || v === x || !this.holdsCell(mvd, 60);
    },

    // C++: mesh_seat.inc:Seat::knowsRing
    knowsRing(k) {
      for (const [ck, cv] of this.cousins) if (ckPc(ck) === 0 && ck !== k && cv >= 0 && cv !== this.id) return true;
      for (const [ek, ev] of this.occ) if (ek !== k && ckPc(ek) === 0 && ev >= 0 && ev !== this.id) return true;
      return false;
    },

    // C++: mesh_seat.inc:Seat::hearRook
    hearRook() {
      if (!this.hasCoord || this.coord.pc !== 0) return false;
      const ol = ownedLinks(this.coord);
      for (const c of ol) { const k = ckey(c); if (c.pc === 0 && this.heardAt(k, this.occGet(k))) return true; }
      return false;
    },

    // C++: mesh_seat.inc:Seat::claimRel
    claimRel(k, x, childRow) {
      if (!this.hasCoord) return false;
      if (k === ckey(this.coord) || this.ownedLinkCell(k)) return true;
      const oc = this.ownerCoord(); if (oc && ckey(oc) === k) return true;
      const sit = this.sitting.get(k); if (sit !== undefined && sit.joiner === x) return true;
      if (childRow) { const d = down(this.coord), c = unck(k); if (c.pc === d.pc && c.r === d.r) return true; }
      if (this.l13('L13.3')) {
        const d = down(this.coord), c = unck(k);
        if (c.pc === d.pc && c.r === d.r && c.i !== 0) { const hk = ckey(d); const b = this.byeAt.get(hk); if (this.occGet(hk) < 0 || (b !== undefined && this.TICK - b <= K.LEASE_T)) return true; }
      }
      return false;
    },

    // C++: mesh_seat.inc:Seat::liveElsewhere
    liveElsewhere(x, k) { for (const [ek, ev] of this.occ) if (ev === x && ek !== k && this.firstHandLive(ek)) return true; return false; },

    // C++: mesh_seat.inc:Seat::returnBurst
    returnBurst(k) { const it = this.live.get(k); return this.backAt >= 0 && it !== undefined && it >= this.backAt && it <= this.backAt + 1; },

    // C++: mesh_seat.inc:Seat::liveElsewhereSinceReturn
    liveElsewhereSinceReturn(x, k) { for (const [ek, ev] of this.occ) if (ev === x && ek !== k && this.firstHandLive(ek) && !this.returnBurst(ek)) return true; return false; },

    // C++: mesh_seat.inc:Seat::hintClaim
    hintClaim(k, x) {
      { const cur = this.occ.get(k); if (cur !== undefined) { const lb = this.liveBy.get(k); const corpse = this.translost.has(k) || (lb !== undefined && lb === cur && !this.firstHandLive(k) && this.beatsMe(k)); if (cur === x || !corpse) return false; } }
      if (this.liveElsewhere(x, k)) return false;
      const drop = []; for (const [ek, ev] of this.occ) if (ev === x && ek !== k && !this.firstHandLive(ek)) drop.push(ek);
      for (const d of drop) this.occDrop(d, 'hint-move');
      this.setOcc(k, x); this.noteS1(k); return true;
    },

    // C++: mesh_seat.inc:Seat::probeNote
    probeNote(k) {
      const lv = this.w.lv; const cur = this.probeOut.get(k);
      if (cur !== undefined && this.TICK - cur.at <= 240) { cur.last = this.TICK | 0; return cur.pn; }
      if (this.probeOut.size >= 64) {
        const old = []; for (const [pk, pv] of this.probeOut) if (this.TICK - pv.last > 240) old.push(pk);
        for (const o of old) this.probeOut.delete(o);
        if (this.probeOut.size >= 64) this.probeOut.delete(this.probeOut.keys().next().value);
      }
      const pn = ++lv.PN_SEQ; this.probeOut.set(k, { at: this.TICK | 0, last: this.TICK | 0, pn }); return pn;
    },

    // C++: mesh_seat.inc:Seat::probeAsked
    probeAsked(k, pn) { const it = this.probeOut.get(k); return it !== undefined && this.TICK - it.last <= 240 && pn >= 0 && pn === it.pn; },

    // C++: mesh_seat.inc:Seat::l25Yield
    l25Yield(m, by) {
      const id = this.id;
      if (this.l25Stand(m.nc >= 0 && m.nc !== id ? m.nc : by, true) || !this.hasCoord || this.state !== 3) return false;
      const answer = () => { if (this.TICK - this.challAt > 20) { this.challAt = this.TICK | 0; const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = id; this.emit(by, h); } };
      if (m.nc < 0 || m.nc === id || m.nc === by) { this.trace('L25-REFUSED', id, this.coord, 'by=%d nc=%d', by, m.nc); answer(); return true; }
      if (this.l25Nc === m.nc && this.l25Ck === m.ck && this.TICK - this.l25At <= K.L25_WAIT) { if (this.l25By !== by) { this.trace('L25-QUORUM', id, this.coord, 'by=%d and %d rival=%d', by, this.l25By, m.nc); this.l25Nc = -1; return false; } return true; }
      if (this.TICK - this.l25At <= K.L25_WAIT && this.l25Nc >= 0) return true;
      this.l25Ask(m, by); answer(); return true;
    },

    // C++: mesh_seat.inc:Seat::l25Ask
    l25Ask(m, by) {
      const id = this.id;
      if (this.TICK - this.l25At <= K.L25_WAIT && this.l25Nc >= 0) return;
      this.l25Nc = m.nc; this.l25Ck = m.ck; this.l25By = by; this.l25At = this.TICK | 0;
      const c = newMsg('CHALLENGE'); c.ck = m.ck; c.from = id; c.tag = 25;
      if (this.w.lv.LINKMODEL) this.f.fabricCallFrame(id, m.nc, c); else if (by >= 0) { c.asker = id; c.via = m.nc; this.emit(by, c); }
      this.trace('L25-ASK', id, this.coord, 'by=%d rival=%d', by, m.nc); this.l25WitAskAll();
    },

    // C++: mesh_seat.inc:Seat::l25Nonsense
    l25Nonsense(by, nc, site) {
      const id = this.id; if (!(nc < 0 || nc === id || nc === by)) return false;
      this.trace('L25-REFUSED', id, this.coord, 'by=%d nc=%d %s', by, nc, site);
      if (this.TICK - this.challAt > 20) { this.challAt = this.TICK | 0; const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = id; this.emit(by, h); }
      return true;
    },

    // C++: mesh_seat.inc:Seat::attack
    attack() {
      if (!this.hasCoord) return; const id = this.id; const ol = ownedLinks(this.coord); const n = ol.length;
      if (this.w.lv.EVIL_RECLAIM) {
        if ((this.TICK % 40) !== 0) return;
        for (let k = 0; k < n; k++) {
          const x = this.occGet(ckey(ol[k])); if (x < 0 || x === id) continue;
          for (let j = 0; j < n; j++) { const y = this.occGet(ckey(ol[j])); if (y < 0 || y === id || y === x) continue; const m = newMsg('RECLAIM'); m.ck = ckey(ol[k]); m.id = x; m.tok = fabricToken(this.w.lv, id); this.emit(y, m); }
          return;
        }
        return;
      }
      for (let k = 0; k < n; k++) { const x = this.occGet(ckey(ol[k])); if (x >= 0 && x !== id) { const m = newMsg('HELLO'); m.ck = ckey(ol[k]); m.id = id; this.emit(x, m); } }
    },

    // C++: mesh_seat.inc:Seat::takeUp
    // § G UP-LEG intake: the digest a phoner sent me, filed by its relation to me.
    takeUp(m) {
      const pk = ckey(m.coord); const u = dig.cloneDig(m.dgUp); this.rxDig(u);
      if (u.kl.length) this.kIntake(u, m.id, this.linkIs(m, m.id), pk, pk === ckey(down(this.coord)));
      if (pk === ckey(down(this.coord))) { this.l10Dirty(this.downDig.at >= 0 ? this.downDig : null, u); this.downDig = u; }
      else if (this.coord.pc === 0 && m.coord.pc === 0) this.s1Take(pk, u);
      else if (this.coord.pc !== 0 && this.coord.i === 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r) { const rk = this.rowKids.get(pk); this.l10Dirty(rk !== undefined ? rk : null, u); this.rowKids.set(pk, u); }
    },

    // C++: mesh_seat.inc:Seat::s1SyncDigs
    s1SyncDigs(m) {
      const lv = this.w.lv;
      if (lv.DIGEST && this.state === 3 && this.hasCoord && this.coord.pc === 0)
        for (const e of m.digs) {
          if (ckPc(e.k) !== 0 || !cellOk(e.k)) continue; if (this.hasCoord && e.k === ckey(this.coord)) continue;
          if (e.d.at < 0 && e.d.by >= 0) { const st = this.s1tab.get(e.k); if (st !== undefined && st.by === e.d.by && this.LT() - st.rx > K.DIG_TTL) { this.s1tab.delete(e.k); this.digGone.set(e.k, [e.d.by, this.TICK | 0]); } continue; }
          const u = dig.cloneDig(e.d); this.rxDig(u); if (u.at < 0 || this.LT() - u.rx > K.DIG_TTL) continue; if (u.kl.length) this.kIntake(u, u.by, false, e.k, false); this.s1Take(e.k, u);
        }
      if (lv.DIGEST && this.state === 3 && this.hasCoord && this.coord.pc === 0) this.rootFold(true);
    },

    // C++: mesh_seat.inc:Seat::ppAdm
    ppAdm(k, adm, x) {
      if (adm < 0 || adm === x || !this.hasCoord) return false;
      if (adm === this.id) return true;
      if (!cellOk(k)) return false; const c = unck(k);
      if (c.pc !== 0) {
        const oc = ownerCoordOf(c);
        if (oc) {
          if (this.occGet(ckey(oc)) === adm) return true;
          for (let j = 0; j < C; j++) if (this.occGet(ckey({ pc: oc.pc, r: oc.r, i: j })) === adm) return true;
          for (const [ck, cv] of this.cousins) if (cv === adm && ckPc(ck) === ckPc(ckey(oc))) return true;
        }
        return this.occGet(ckey({ pc: c.pc, r: c.r, i: 0 })) === adm;
      }
      if (this.strangerOk(adm)) return true;
      for (const [ek, ev] of this.occ) if (ev === adm && ek !== k && ckPc(ek) === 0) return true;
      for (const [lk, lvv] of this.linkedBy) if (lvv === adm && lk !== k && lk !== ckey(this.coord) && ckPc(lk) === 0) return true;
      if (this.rivalId >= 0 && this.rivalId === adm && k !== ckey(this.coord)) {
        const l = this.linkedBy.get(k); if (l !== undefined && l === adm) return true;
        const w = this.wasAt.get(k); if (w !== undefined && w.includes(adm)) return true;
      }
      return false;
    },

    // C++: mesh_seat.inc:Seat::mpProven
    mpProven(m) {
      if (m.mpK === 0 || m.id < 0 || !cellOk(m.ck)) return false; const c = unck(m.ck); const dk = ckey(down(c)); const id = this.id;
      if (m.mpK === 1) {
        if (m.mpBy < 0 || m.mpAt < 0 || m.mpL < 0 || m.mpL > this.TICK || this.TICK - m.mpL > K.L25_ORD_AGE) return false;
        if (m.mpBy === m.id && !(c.pc !== 0 && c.i !== 0 && this.occGet(ckey({ pc: c.pc, r: c.r, i: 0 })) === m.id)) return false;
        if (!this.w.L25ORD.has(l25OrdKey(m.mpBy, m.ck, m.mpAt))) return false;
        { const sp = this.l25Spent.get(m.ck); if (sp !== undefined && sp.by === m.mpBy && sp.at === m.mpAt && sp.x !== m.id) return false; }
        let ok = m.mpBy === id || this.ppAdm(m.ck, m.mpBy, m.id) || this.occGet(dk) === m.mpBy;
        if (!ok) { const ch = this.childOf.get(m.ck); ok = ch !== undefined && ch === m.mpBy; }
        if (!ok && c.pc !== 0 && c.i === 0) { for (let j = 1; j < C; j++) if (this.occGet(ckey({ pc: c.pc, r: c.r, i: j })) === m.mpBy) { ok = true; break; } }
        if (ok) { if (this.l25Spent.size > 256) this.l25Spent.clear(); this.l25Spent.set(m.ck, { by: m.mpBy, at: m.mpAt, x: m.id }); }
        return ok;
      }
      if (m.mpK === 2) { if (m.mpOld !== dk) return false; if (this.occGet(dk) === m.id) return true; const ch = this.childOf.get(m.ck); return ch !== undefined && ch === m.id; }
      return false;
    },

    // C++: mesh_seat.inc:Seat::ppAdmitter
    ppAdmitter(c) {
      if (c.i !== 0) return this.occGet(ckey({ pc: c.pc, r: c.r, i: 0 }));
      const oc = ownerCoordOf(c); if (oc) return this.occGet(ckey(oc));
      return this.occGet(ckey({ pc: 0, r: (c.r - 1 + C) % C, i: 0 }));
    },

    // C++: mesh_seat.inc:Seat::beatsMe
    beatsMe(k) {
      if (!this.hasCoord || !cellOk(k)) return false; const c = unck(k);
      if (ckey(down(this.coord)) === k) return true;
      if (this.coord.pc === 0) return c.pc === 0 && this.ownedLinkCell(k);
      return this.coord.i === 0 && c.pc === this.coord.pc && c.r === this.coord.r;
    },

    // C++: mesh_seat.inc:Seat::authTick
    authTick() {
      const id = this.id, TICK = this.TICK;
      if (TICK - this.upProbeAt >= 20) {
        this.upProbeAt = TICK | 0; const ol = ownedLinks(this.coord);
        for (let q = 0; q < ol.length; q++) {
          const k = ckey(ol[q]); const x = this.occGet(k); if (x < 0 || x === id || this.translost.has(k)) continue;
          const l = this.linkedBy.get(k); if (l !== undefined && l === x) continue;
          const u = this.upUsed.get(k); if (u === undefined || TICK - u > 40) continue;
          const o = this.upOpen.get(k); if (o === undefined || o[0] !== x || TICK - o[1] <= K.UNPROVEN_HOLD - 40) continue;
          this.routeTo(ol[q], 2);
        }
      }
      if (this.gbProbe.size) {
        const done = []; for (const [gk, gv] of this.gbProbe) { if (TICK - gv.at < 2 * K.EARLY_HOLD) continue; done.push(gk); }
        for (const k of done) {
          const g = this.gbProbe.get(k); this.gbProbe.delete(k); const cur = this.occGet(k);
          if (cur < 0) { this.goodbyeHeal(k, g.mv); continue; }
          if (cur !== g.holder || this.firstHandLive(k)) continue;
          const a = this.upAck.get(k); if (a !== undefined && a[0] === cur && a[1] >= g.at) continue;
          this.goodbyeHeal(k, g.mv);
        }
      }
      this.l383Tick();   // L38.3 (gaps2.js)
      if (this.pp < 0 && this.ppAskAt >= 0 && TICK - this.ppAskAt >= 16 && TICK - this.seatedAt <= 160 && !this.moving) {
        this.ppAskAt = TICK | 0; const adm = this.ppAdmitter(this.coord);
        if (adm >= 0 && adm !== id) { const m = newMsg('CLAIM'); m.ck = ckey(this.coord); m.id = id; this.emit(adm, m); }
      }
    },

    // C++: mesh_seat.inc:Seat::s1Fill
    s1Fill() {
      if (this.TICK - this.seatedAt < 80) return;
      for (let j = 1; j < C; j++) {
        const c = { pc: 0, r: this.coord.r, i: j }; const ck = ckey(c);
        if (this.translost.has(ck) && this.hasDownChild(c) && this.l3QuietLoss(ck)) { if (this.occ.has(ck) && this.ringConfirmDead(c)) { this.occDrop(ck, 'ring-dead'); this.live.delete(ck); this.s1seen.delete(ck); this.kidful.delete(ck); this.holeSince.delete(ck); } continue; }
        if (this.translost.has(ck) && this.hasDownChild(c) && this.l375Defer(c)) continue;   // L37.5: for the heir's window only (gaps.js)
        if (this.ringConfirmDead(c)) { if (this.occ.has(ck)) { this.occDrop(ck, 'ring-dead'); this.live.delete(ck); this.s1seen.delete(ck); this.kidful.delete(ck); } this.holeSince.delete(ck); this.heal(c); return; }
      }
    },

    // C++: mesh.cpp:l13Merging
    l13Merging() { return l13MergingOf(this.w.L13CUR); },

    // C++: mesh_hostile.inc:Seat::hostileRecv
    hostileRecv(m) {
      const w = this.w, id = this.id, lv = w.lv, h = this.hostile;
      if (m.sig && m.id >= 0 && m.id !== id && this.hostRec.length < 32) this.hostRec.push(msg.clone(m));
      if ((h & (E.H_HOLD | E.H_DIAL)) && m.t === 'UNNEEDED') return true;
      const mateOf = () => { let mate = -1; for (let q = 0; q < w.nextId; q++) { const y = (id + 1 + q) % w.nextId; if (y !== id && w.alive[y] && (w.seats[y].hostile & E.H_COLLUDE)) { mate = y; break; } } return mate; };
      if ((h & E.H_COLLUDE) && m.t === 'CHALLENGE' && m.tag === 25) { const mate = mateOf(); const c = newMsg('CONFIRM'); c.ck = m.ck; c.id = id; c.pp = mate; c.ppAt = (this.TICK | 0) - 500; c.sig = true; c.sigAt = this.TICK | 0; w.hostSend(id, m.from, c); return true; }
      if ((h & E.H_COLLUDE) && m.t === 'CHALLENGE' && m.tag === 26) { const mate = mateOf(); const wm = newMsg('WITNESS'); wm.ck = m.ck; wm.id = id; wm.nc = mate; wm.sig = true; wm.sigAt = this.TICK | 0; w.hostSend(id, m.from, wm); return true; }
      if (this.hostDenseLeaf >= 0 && m.t === 'CHALLENGE' && m.tag === 26) { const wm = newMsg('WITNESS'); wm.ck = m.ck; wm.id = id; wm.nc = this.hostDenseLeaf; wm.sig = true; wm.sigAt = this.TICK | 0; wm.born = this.seatedAt; w.hostSend(id, m.from, wm); return true; }   // `hostile densify`: as a witness it hears the seat it placed (gaps3-fab.js)
      if (h & E.H_HOLE) {
        if (m.routing && m.t !== 'PHONE' && m.t !== 'PONG') return true;
        switch (m.t) {
          case 'FIND': case 'FINDLEAF': case 'PLACE': case 'NOROOM': case 'ROUTE': case 'ROUTED': case 'WALK': case 'OFFER': case 'FINDACK': return true;
          case 'HANDOFF': case 'TAKEOVER': return true;
          case 'WHOHOME': { const b = newMsg('BUSY'); b.id = id; w.hostSend(id, m.from, b); return true; }
          default: break;
        }
      }
      if ((h & E.H_FORGE) && m.t === 'FIND' && m.nc >= 0 && this.hasCoord) {
        if (!this.hostRng) this.hostRng = rngM.mt19937(((Math.imul(lv.SEED0 >>> 0, 31) + Math.imul(id, 2654435761)) >>> 0));
        const v = w.hostPickHonest(this.hostRng, id);
        const p = newMsg('PLACE'); { const sc = v >= 0 ? w.seats[v].coord : this.coord; p.coord = { pc: sc.pc, r: sc.r, i: sc.i }; } p.owner = id; p.nc = m.nc; p.pp = id; p.ppAt = this.TICK | 0; p.tag = m.tag; w.hostSend(id, m.nc, p); return true;
      }
      return false;
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
