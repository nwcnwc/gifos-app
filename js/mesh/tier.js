/*
 * tier.js: L4 tiers and NAT-aware seating, the seat side (C++: mesh_tier.inc). Methods only, added to the Seat.
 * Out-parameters: l4HeadPick returns {a, b} or null; l4Links fills the array it is handed (as the C++ does).
 * Callees other units define (take, requeue, recv, lgHeadPick, lgLightSeat ...) are called by name on the Seat.
 * Three mesh.cpp free helpers the C1 pass did not carry (l4Pack, l4Meet, coordStr) are local below.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const seatM = req('./seat.js', 'meshSeat');
  const { coordStr, l4Pack, l4Meet } = req('./shared.js', 'meshShared');
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const hash = req('./hash.js', 'meshHash');
  const { Seat, l25OrdKey } = seatM;
  const K = C_.consts, E = C_.enums;
  const { ckey, unckey, ownedLinks, C, parentPath, lastDigit } = topo;
  const newMsg = (t) => msg.newMsg(t);
  const cpKV = (a) => a.map((e) => ({ k: e.k, v: e.v }));
  const newL4Order = () => ({ a: -1, b: -1, ca: 0, cb: 0, rdyA: 0, rdyB: 0, nbA: [], nbB: [], at: -1000, go: false });


  Seat.unit('mesh_tier.inc', {
    // C++: mesh_tier.inc:Seat::l4Learn
    l4Learn(m) {
      if (m.id < 0 || m.id === this.id) return;
      if (this.tierSeen.size >= 96 && !this.tierSeen.has(m.id)) { for (const k of this.tierSeen.keys()) { this.tierSeen.delete(k); break; } }
      this.tierSeen.set(m.id, l4Pack(m.tier, m.nat));
      if (m.nat !== E.NAT_OPEN) this.l4NatSeen = true;
    },

    // C++: mesh_tier.inc:Seat::l4TierOf
    l4TierOf(x) { if (x === this.id) return this.ctier; const it = this.tierSeen.get(x); return it === undefined ? -1 : (it & 0xff); },

    // C++: mesh_tier.inc:Seat::l4NatOf
    l4NatOf(x) { if (x === this.id) return this.cnat; const it = this.tierSeen.get(x); return it === undefined ? E.NAT_OPEN : (it >> 8); },

    // C++: mesh_tier.inc:Seat::l4Links
    l4Links(out) {
      out.length = 0; if (!this.hasCoord) return; const ol = ownedLinks(this.coord), n = ol.length;
      for (let q = 0; q < n; q++) { const x = this.occGet(ckey(ol[q])); if (x >= 0 && x !== this.id) out.push({ k: ckey(ol[q]), v: x }); }
      const oc = this.ownerCoord();
      if (oc) { const o = this.occGet(ckey(oc)); let has = false; for (const e of out) if (e.k === ckey(oc)) has = true; if (o >= 0 && o !== this.id && !has) out.push({ k: ckey(oc), v: o }); }
    },

    // C++: mesh_tier.inc:Seat::l4Busy
    l4Busy() { return this.l4ExecAt >= 0; },

    // C++: mesh_tier.inc:Seat::l4Bad
    l4Bad(stier, snat, f) {
      if (stier === E.TIER_MOBILE && f.i <= 1 && !this.l4MassNow()) return true;
      if (snat !== E.NAT_OPEN) {
        if (this.nat !== E.NAT_OPEN) return true;
        const rc = this.rosterCells();
        for (let j = 0; j < C; j++) {
          const rk = ckey(rc[j]); let x = this.occGet(rk); if (x < 0) { const sit = this.sitting.get(rk); if (sit !== undefined) x = sit.joiner; }
          if (x >= 0 && x !== this.id && this.l4NatOf(x) !== E.NAT_OPEN) return true;
        }
      }
      return false;
    },

    // C++: mesh_tier.inc:Seat::l4Hop
    l4Hop(mm, f) {
      if (mm.tag === 1 || mm.nc < 0 || mm.nc === this.id || mm.ttl <= 2) return false;
      if (!this.l4Bad(mm.tier, mm.nat, f)) return false;
      if (mm.th >= this.w.lv.L4_HOPS) { this.trace('TIERTAKE', this.id, this.coord, 'nc=%d th=%d tier=%d nat=%d cell=%s', mm.nc, mm.th, mm.tier, mm.nat, coordStr(f)); return false; }
      const ol = ownedLinks(this.coord), n = ol.length; let peers = [];
      for (let q = 0; q < n; q++) {
        if (ol[q].pc !== this.coord.pc || (this.coord.pc !== 0 && ol[q].r !== this.coord.r)) continue; const k = ckey(ol[q]); const x = this.occGet(k); if (x < 0 || x === this.id || x === mm.from || x === mm.nc || this.translost.has(k)) continue;
        if (this.coord.pc === 0 ? this.firstHandLive(k) : true) peers.push(x);
      }
      if (peers.length === 0) return false;
      if (mm.nat !== E.NAT_OPEN) { const op = []; for (const y of peers) if (this.l4NatOf(y) === E.NAT_OPEN) op.push(y); if (op.length) peers = op; }
      const x = peers[Math.trunc(this.rng() * peers.length)];
      this.trace('TIERHOP', this.id, this.coord, 'nc=%d to=%d th=%d tier=%d nat=%d cell=%s', mm.nc, x, mm.th + 1, mm.tier, mm.nat, coordStr(f));
      const m = newMsg('FIND'); m.nc = mm.nc; m.sgw = mm.sgw; m.sgwCk = mm.sgwCk; m.fsig = mm.fsig; m.ttl = mm.ttl - 1; m.spread = mm.spread; m.late = mm.late; m.dk = mm.dk; m.sh = mm.sh; m.th = (mm.th + 1) & 0xff; m.tier = mm.tier; m.nat = mm.nat; this.emit(x, m); this.findAck(mm);
      return true;
    },

    // C++: mesh_tier.inc:Seat::l4HeadPick
    l4HeadPick() {
      const col = new Array(C), tr = new Array(C); let heir = -1;
      for (let j = 0; j < C; j++) {
        const k = ckey({ pc: this.coord.pc, r: this.coord.r, i: j }); const x = (j === 0) ? this.id : this.occGet(k); col[j] = x; tr[j] = -1;
        if (x < 0) continue;
        if (j > 0) { if (this.translost.has(k) || !this.firstHandLive(k) || this.softSitting(k)) return null; }
        tr[j] = this.l4TierOf(x); if (tr[j] < 0) return null;
        if (j > 0 && heir < 0) heir = j;
      }
      const LG_ON = this.w.lv.LG_ON;
      if (LG_ON) { const r = this.lgHeadPick(col, tr, heir); if (r) return r; }
      let own = -1; { const oc = this.ownerCoord(); if (oc) own = this.occGet(ckey(oc)); }
      const natOk = (x) => own < 0 || own === x || l4Meet(this.l4NatOf(x), this.l4NatOf(own));
      const lgOk = (x) => !LG_ON || !this.lgLightSeat(x);
      if (tr[0] === E.TIER_MOBILE) {
        let pick = -1; for (let j = 1; j < C; j++) if (col[j] >= 0 && tr[j] === E.TIER_DESKTOP && j !== heir && natOk(col[j]) && lgOk(col[j])) { pick = j; break; }
        if (pick < 0 && heir >= 0 && tr[heir] === E.TIER_DESKTOP && natOk(col[heir]) && lgOk(col[heir])) pick = heir;
        if (pick < 0) return null;
        return { a: this.id, b: col[pick] };
      }
      if (this.coord.pc !== 0 && heir >= 0 && tr[heir] === E.TIER_MOBILE) {
        for (let j = heir + 1; j < C; j++) if (col[j] >= 0 && tr[j] === E.TIER_DESKTOP && lgOk(col[j])) return { a: col[heir], b: col[j] };
      }
      return null;
    },

    // L4.6: the seat's own sense of mass times: a mass leave, or that many seekers on my FINDs at once.
    // C++: mesh_tier.inc:Seat::l4SeekNote
    l4SeekNote(nc) {
      if (nc < 0 || nc === this.id) return;
      if (this.l4SeekAt.size >= 64 && !this.l4SeekAt.has(nc)) { for (const [k, v] of [...this.l4SeekAt]) if (this.TICK - v > K.L4_ENTRY_T) this.l4SeekAt.delete(k); if (this.l4SeekAt.size >= 64) { for (const k of this.l4SeekAt.keys()) { this.l4SeekAt.delete(k); break; } } }
      this.l4SeekAt.set(nc, this.TICK | 0);
    },
    // C++: mesh_tier.inc:Seat::l4MassNow
    l4MassNow() {
      if (this.l13Mass()) return true;
      let n = 0; for (const v of this.l4SeekAt.values()) if (this.TICK - v <= K.L4_ENTRY_T && ++n >= K.L4_ENTRY_N) return true;
      return false;
    },

    // C++: mesh_tier.inc:Seat::l4Ready
    l4Ready(q) {
      if (!this.w.lv.TIERS_ACTIVE || !this.hasCoord || this.state !== 3 || this.moving || this.l4ExecAt >= 0) return false;
      const mine = ckey(this.coord);
      if (!((q.swA === this.id && q.swCa === mine) || (q.swB === this.id && q.swCb === mine))) return false;
      if (this.l4Hold) return false;
      if (this.l4MassNow()) return false;
      if (this.TICK - this.lastChurn < this.w.lv.L4_QUIET || this.TICK - this.healAt < this.w.lv.L4_QUIET || this.TICK - this.seatedAt < this.w.lv.L4_QUIET) return false;
      return true;
    },

    // C++: mesh_tier.inc:Seat::l4OnQ
    l4OnQ(m) {
      if (!this.w.lv.TIERS_ACTIVE || !this.hasCoord || this.state !== 3 || m.id < 0) return;
      const hk = ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 });
      if (this.coord.i !== 0 && this.occGet(hk) !== m.id) return;
      const r = newMsg('SWAPRDY'); r.id = this.id; r.swA = m.swA; r.swB = m.swB; r.swCa = m.swCa; r.swCb = m.swCb; r.tag = this.l4Ready(m) ? 1 : -1;
      if (r.tag === 1) this.l4Links(r.nbrs);
      this.emit(m.id, r);
    },

    // C++: mesh_tier.inc:Seat::l4OnRdy
    l4OnRdy(m) {
      if (m.tag >= 5 && m.tag <= 7) {
        if (m.id !== this.l4Partner) return;
        if (m.tag === 5) {
          if (this.l4ExecAt >= 0 && !this.l4First) { const to = this.l4NewCk; this.l4Exchange(); const r = newMsg('SWAPRDY'); r.id = this.id; r.tag = (this.hasCoord && ckey(this.coord) === to) ? 6 : 7; this.emit(m.id, r); }
          else { const r = newMsg('SWAPRDY'); r.id = this.id; r.tag = 7; this.emit(m.id, r); }
          return;
        }
        if (this.l4Out) this.l4Back(m.tag === 6);
        return;
      }
      if (m.tag >= 2 && m.tag <= 4) {
        if (this.l4ExecAt >= 0 && m.id === this.l4Partner) {
          if (m.tag === 2) this.l4PartnerPing = this.TICK; else if (m.tag === 3) this.l4PartnerAck = this.TICK;
          else { this.l4ExecAt = -1; this.f.fabricNoteSwap(this.id, 3); this.trace('SWAP-ABORT', this.id, this.coord, 'partner=%d withdrew', m.id); }
        }
        return;
      }
      if (!this.w.lv.TIERS_ACTIVE || this.l4o.at <= -1000 || m.swA !== this.l4o.a || m.swB !== this.l4o.b) return;
      if (m.id === this.l4o.a) { this.l4o.rdyA = (m.tag === 1) ? 1 : -1; this.l4o.nbA = cpKV(m.nbrs); } else if (m.id === this.l4o.b) { this.l4o.rdyB = (m.tag === 1) ? 1 : -1; this.l4o.nbB = cpKV(m.nbrs); } else return;
    },

    // C++: mesh_tier.inc:Seat::l4OnGo
    l4OnGo(m) {
      if (!this.w.lv.TIERS_ACTIVE || !this.hasCoord || this.state !== 3 || this.moving || this.l4ExecAt >= 0) return;
      const mine = ckey(this.coord); let other = -1, ocell = 0;
      if (m.swA === this.id && m.swCa === mine) { other = m.swB; ocell = m.swCb; } else if (m.swB === this.id && m.swCb === mine) { other = m.swA; ocell = m.swCa; } else return;
      if (this.coord.i !== 0 && this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 })) !== m.id) return;
      if (m.swL < 0 || m.swL < this.TICK - this.w.lv.L4_LEAD) { this.f.fabricNoteSwap(this.id, 3); return; }
      this.l4Partner = other; this.l4First = (m.swA === this.id); this.l4PartnerCk = mine; this.l4NewCk = ocell; this.l4Head = m.id; this.l4ExecAt = m.swL; this.l4GoId = m.swAt; this.l4Nb = cpKV(m.nbrs); this.l4Pinged = -1; this.l4PartnerPing = -1; this.l4PartnerAck = -1; this.l4GoChurn = this.lastChurn; this.l4Acked = false;
    },

    // C++: mesh_tier.inc:Seat::l4Back
    l4Back(moved) {
      this.l4Out = false; this.hasCoord = true; this.l4ExecAt = this.l4OutExec;
      if (moved) this.l4Exchange(); else { this.l4ExecAt = -1; this.f.fabricNoteSwap(this.id, 3); this.trace('SWAP-ABORT', this.id, this.coord, 'partner=%d stayed', this.l4Partner); }
      const h = this.l4Held; this.l4Held = []; for (const x of h) this.recv(x);
    },

    // C++: mesh_tier.inc:Seat::l4Exchange
    l4Exchange() {
      const partner = this.l4Partner; const newCk = this.l4NewCk; const goAt = this.l4ExecAt, goId = this.l4GoId; this.l4ExecAt = -1;
      if (!this.hasCoord || this.state !== 3 || this.moving || partner < 0 || ckey(this.coord) !== this.l4PartnerCk || this.l4Hold) { this.f.fabricNoteSwap(this.id, 3); this.trace('SWAP-ABORT', this.id, this.hasCoord ? this.coord : null, 'with=%d', partner); return; }
      const nc = unckey(newCk); const oldCk0 = ckey(this.coord);
      const nb = [];
      const add = (k, v) => { if (v < 0 || v === this.id || k === newCk) return; for (const e of nb) if (e.k === k) return; nb.push({ k, v }); };
      add(oldCk0, partner);
      for (const e of this.l4Nb) if (e.v !== this.id) add(e.k, e.v);
      for (let j = 0; j < C; j++) { const rk = ckey({ pc: this.coord.pc, r: this.coord.r, i: j }); if (rk === oldCk0 || rk === newCk) continue; add(rk, this.occGet(rk)); }
      this.l4MarkUntil = this.TICK + this.w.lv.L4_LEAD + 8;
      this.f.fabricNoteSwap(this.id, 2);
      this.trace('SWAP', this.id, nc, 'from=%s with=%d head=%d', coordStr(this.coord), partner, this.l4Head);
      const oldLinks = []; this.l4Links(oldLinks);
      this.l4Old.clear(); for (const e of oldLinks) this.l4Old.add(e.v);
      this.oldCoord = { pc: this.coord.pc, r: this.coord.r, i: this.coord.i }; this.oldCk = oldCk0; this.oldTn = this.tn; this.oldEstAt = this.estAt; this.oldPp = this.pp; this.oldPpAt = this.ppAt; this.oldPpL = this.ppL; this.oldPpCk = this.ppCk; this.oldPlacer = this.placer; this.oldNbrIds.length = 0;
      this.holdOcc = new Map(this.occ); this.holdSeen = new Map(this.s1seen); this.holdCous = new Map(this.cousins);
      this.occ.clear(); this.ledgerSeen.clear(); this.s1seen.clear(); this.cousins.clear(); this.tlClear();
      this.moving = true; this.moveAt = this.TICK; this.l4X = true;
      this.lastChurn = this.TICK;
      { const sv = this.flCur, sva = this.flCurAt, svl = this.flCurL; if (this.l4Head >= 0) { this.flCur = this.l4Head; this.flCurAt = goId; this.flCurL = goAt; } this.take(nc, -1, nb); this.flCur = sv; this.flCurAt = sva; this.flCurL = svl; }
      {
        const ol2 = ownedLinks(nc), n2 = ol2.length; const told = new Set();
        for (let q = 0; q < n2; q++) { const x = this.occGet(ckey(ol2[q])); if (x >= 0) told.add(x); }
        for (const e of oldLinks) { if (e.v === partner || told.has(e.v)) continue; told.add(e.v); this.trace('SWAP-TELL', this.id, this.coord, 'to=%d', e.v); const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = this.id; this.emit(e.v, h); }
      }
      this.lastAck = this.TICK; this.lastPhone = this.TICK - ((this.coord.pc === 0 && this.l30Small()) ? K.L30_BEAT : 8) + 3;   // the first beat waits for my greetings whatever the beat period is
    },

    // C++: mesh_tier.inc:Seat::l4SwapHello
    l4SwapHello(m) {
      if (!this.w.lv.TIERS_ACTIVE || m.sw < 0 || m.swHd < 0 || !this.hasCoord || this.state !== 3) return false;
      if (!this.linkIs(m, m.id) && !(this.provenEv(m, m.id) && m.sigL >= 0 && this.TICK - m.sigL <= 60)) return false;
      if (m.sw === this.id || m.id === this.id) return true;
      const a = this.occGet(m.ck) === m.sw;
      const b = this.occGet(m.swCk) === m.id;
      if (!a && !b) return false;
      this.trace('SWAP-SEEN', this.id, this.coord, 'from=%d sw=%d ck=%s a=%d b=%d', m.id, m.sw, coordStr(unckey(m.ck)), a, b);
      if (a) { this.setOcc(m.ck, m.id); this.liveMark(m.ck); this.tenOf.delete(m.ck); this.noteLinked(m.ck, m.id, m.tn); this.noteS1(m.ck); }
      if (b) { this.setOcc(m.swCk, m.sw); this.live.delete(m.swCk); this.liveBy.delete(m.swCk); this.tenOf.delete(m.swCk); this.kidful.delete(m.swCk); this.childOf.delete(m.swCk); }
      if (a) { this.kidful.delete(m.ck); this.childOf.delete(m.ck); }
      if (a && this.ownedLinkCell(m.ck)) { const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = this.id; this.emit(m.id, h); }
      this.lastChurn = this.TICK;
      return true;
    },

    // C++: mesh_tier.inc:Seat::l4Tick
    l4Tick() {
      const lv = this.w.lv;
      if (this.l4Out) { if (this.TICK - this.l4OutAt > 2 * this.w.lv.L4_LEAD) { this.trace('SWAP-ABORT', this.id, null, 'partner=%d never answered: out', this.l4Partner); this.l4Back(false); this.requeue('l4-out-lost'); } else this.f.wake(this.id); return; }
      if (!lv.TIERS_ACTIVE) { if (this.l4ExecAt >= 0 || this.l4o.at > -1000) { this.l4ExecAt = -1; this.l4o = newL4Order(); } return; }
      if (!this.hasCoord || this.state !== 3) { this.l4ExecAt = -1; this.l4o = newL4Order(); return; }
      if (this.l4ExecAt >= 0) {
        if (this.l4Pinged < 0) { this.l4Pinged = this.TICK; const p = newMsg('SWAPRDY'); p.id = this.id; p.tag = 2; this.emit(this.l4Partner, p); }
        if (this.l4Pinged === this.TICK) for (const e of this.l4Nb) { if (e.v < 0 || e.v === this.id || e.v === this.l4Partner) continue; const ls = this.f.fabricLinkState(this.id, e.v); if (ls === E.LS_CLOSED || ls === E.LS_NONE) { this.f.fabricDial(this.id, e.v); this.trace('SWAP-DIAL', this.id, this.coord, 'peer=%d cell=%s', e.v, coordStr(unckey(e.k))); } }   // L4.3.1: the links of the cell I am to enter are dialled ahead, so they are open when I sit
        if (!this.l4Acked && this.TICK >= this.l4ExecAt - 3) {
          const ok = this.l4PartnerPing >= 0 && this.lastChurn === this.l4GoChurn && this.TICK - this.healAt >= 2 && !this.moving && !this.l4Hold;
          const v = newMsg('SWAPRDY'); v.id = this.id; v.tag = ok ? 3 : 4; this.emit(this.l4Partner, v);
          if (!ok) { this.l4ExecAt = -1; this.f.fabricNoteSwap(this.id, 3); this.trace('SWAP-ABORT', this.id, this.coord, 'partner=%d: I withdrew (heard=%d churned=%d)', this.l4Partner, this.l4PartnerPing >= 0, this.lastChurn !== this.l4GoChurn); return; }
          this.l4Acked = true;
        }
        if (this.TICK >= this.l4ExecAt) {
          if (this.l4First && this.l4Acked && this.l4PartnerAck >= 0) {
            const o = newMsg('SWAPRDY'); o.id = this.id; o.tag = 5; this.emit(this.l4Partner, o); this.trace('SWAP-OUT', this.id, this.coord, 'partner=%d', this.l4Partner);
            this.l4Out = true; this.l4OutAt = this.TICK; this.l4OutExec = this.l4ExecAt; this.l4ExecAt = -1; this.hasCoord = false; this.f.wake(this.id);
          } else if (this.TICK - this.l4ExecAt > (this.l4First ? this.w.lv.L4_LEAD : 2 * this.w.lv.L4_LEAD)) {
            if (this.l4First) { const v = newMsg('SWAPRDY'); v.id = this.id; v.tag = 4; this.emit(this.l4Partner, v); }
            this.l4ExecAt = -1; this.f.fabricNoteSwap(this.id, 3); this.trace('SWAP-ABORT', this.id, this.coord, 'partner=%d did not answer', this.l4Partner);
          } else this.f.wake(this.id);
        }
        return;
      }
      if (this.coord.i !== 0 || this.moving) return;
      let sig = hash.H_INIT; for (let j = 0; j < C; j++) { const x = (j === 0) ? this.id : this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: j })); sig = hash.hmixId(sig, x); }
      if (sig !== this.l4Sig) { this.l4Sig = sig; this.l4SigAt = this.TICK; }
      if (this.l4o.at > -1000) {
        if (this.l4o.rdyA < 0 || this.l4o.rdyB < 0) { this.f.fabricNoteSwap(this.id, 3); this.trace('SWAP-REFUSED', this.id, this.coord, 'a=%d b=%d', this.l4o.a, this.l4o.b); this.l4o = newL4Order(); return; }
        if (this.l4o.rdyA > 0 && this.l4o.rdyB > 0) {
          const at = this.TICK + this.w.lv.L4_LEAD; const g = newMsg('SWAPGO'); g.id = this.id; g.swA = this.l4o.a; g.swB = this.l4o.b; g.swCa = this.l4o.ca; g.swCb = this.l4o.cb; g.swAt = at;
          { /* gate(): a thread-pool fence in the C++, nothing here */ if (this.w.L25ORD.size > 2000000) this.w.L25ORD.clear(); this.w.L25ORD.add(l25OrdKey(this.id, this.l4o.ca, at, this.l4o.b)); this.w.L25ORD.add(l25OrdKey(this.id, this.l4o.cb, at, this.l4o.a)); }
          for (let side = 0; side < 2; side++) { const p = side ? this.l4o.b : this.l4o.a; if (p === this.id) continue; g.nbrs = cpKV(side ? this.l4o.nbA : this.l4o.nbB); this.emit(p, msg.clone(g)); }
          { const mine = msg.clone(g); mine.nbrs = cpKV((this.l4o.a === this.id) ? this.l4o.nbB : this.l4o.nbA); mine.swL = g.swAt; this.l4OnGo(mine); }
          this.l4SwapAt = at; this.f.fabricNoteSwap(this.id, 1); this.l4o = newL4Order(); return;
        }
        if (this.TICK - this.l4o.at > 3 * 8) { this.f.fabricNoteSwap(this.id, 3); this.trace('SWAP-TIMEOUT', this.id, this.coord, 'a=%d b=%d', this.l4o.a, this.l4o.b); this.l4o = newL4Order(); }
        return;
      }
      if (this.TICK - this.l4SwapAt < this.w.lv.L4_PERIOD) return;
      if (this.TICK - this.l4SigAt < this.w.lv.L4_QUIET || this.TICK - this.lastChurn < this.w.lv.L4_QUIET || this.TICK - this.healAt < this.w.lv.L4_QUIET || this.TICK - this.seatedAt < this.w.lv.L4_QUIET) return;
      if (this.l4MassNow()) return;   // L4.6
      const pk = this.l4HeadPick(); if (!pk) return;
      const a = pk.a, b = pk.b;
      let ca = a === this.id ? ckey(this.coord) : 0, cb = b === this.id ? ckey(this.coord) : 0;
      for (let j = 0; j < C; j++) { const k = ckey({ pc: this.coord.pc, r: this.coord.r, i: j }); const x = (j === 0) ? this.id : this.occGet(k); if (x === a) ca = k; if (x === b) cb = k; }
      this.l4o = newL4Order(); this.l4o.a = a; this.l4o.b = b; this.l4o.ca = ca; this.l4o.cb = cb; this.l4o.at = this.TICK; this.l4SwapAt = this.TICK;
      this.f.fabricNoteSwap(this.id, 0); this.trace('SWAP-ORDER', this.id, this.coord, 'a=%d b=%d', a, b);
      const q = newMsg('SWAPQ'); q.id = this.id; q.swA = a; q.swB = b; q.swCa = ca; q.swCb = cb;
      for (let side = 0; side < 2; side++) {
        const p = side ? b : a;
        if (p === this.id) { const qq = msg.clone(q); const ok = this.l4Ready(qq); if (side) this.l4o.rdyB = ok ? 1 : -1; else this.l4o.rdyA = ok ? 1 : -1; if (ok) { const nb = []; this.l4Links(nb); if (side) this.l4o.nbB = nb; else this.l4o.nbA = nb; } }
        else this.emit(p, q);
      }
    },
  });
  GifOS.meshTier = Object.freeze({});
  if (isNode) module.exports = GifOS.meshTier;
})(typeof window !== 'undefined' ? window : globalThis);
