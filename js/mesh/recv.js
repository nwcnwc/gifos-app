/*
 * recv.js: the seat's frame dispatcher (port unit S7a): Seat::recv. Every frame a seat takes comes through here:
 * the holder-clock re-stamp, the laws that gate a frame (ban, pacing, signature), the noting of what the frame
 * says about its sender, and then one handler per frame type. The entry-frame handlers are in recv-entry.js;
 * the seated-frame handlers (onHello, onClaim, ... onE1State, the vote frames) are unit recvb's and are called
 * here by name. Ported line for line from the 0.9.25 sim (mesh_seat.inc at gifos 37d787b2d).
 *
 * Port notes (see seat.js for the conventions):
 *   PROOF_IN    the proof-tape hook is the fabric's (fab.proofRecv), left out here as in the rest of the port.
 *   gate()      the sim's gate-measurement hook is left out.
 *   CurGuard    w.L13CUR is set for the rest of the call and restored on every exit (try / finally).
 *   kOver       (static free function, mesh_seat.inc, S6) is called as FREE.kOver(dig, now, self) and returns the
 *               `on` array; it, fabricDoorHeard (f.fabricDoorHeard(me, x, ep)) and the other callees are other units'.
 *   framesInT   indexed by the message type's position in MT_NAMES (the C++ enum order).
 *   counters    L26_REFUSED, HM_BIG_TAKEN are w.lv counters; stDrop, kRx, framesIn are seat fields.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const seatM = req('./seat.js', 'meshSeat');
  const { fabricToken } = req('./shared.js', 'meshShared');
  const { Seat, FREE, roomTerm } = seatM;
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const hash = req('./hash.js', 'meshHash');
    const { eraseFirst } = req('./util.js', 'meshUtil');
  if (isNode) require('./recv-entry.js');

  const K = C_.consts;
  const { ckey } = topo;
  const newMsg = (t) => msg.newMsg(t);
  const mtNum = (t) => msg.MT_NAMES.indexOf(t);

  Seat.unit('mesh_seat.inc recv', {
    // C++: mesh_seat.inc:Seat::recv
    recv(m) {
      const id = this.id, w = this.w, lv = w.lv;
      const TICK = this.TICK;
      if (m.tx >= 0) {   // CLOCKS (0.9.25): the frame's holder-clock fields onto my clock
        const d = TICK - m.tx; m.tx = -1;
        const mv = (k) => { if (m[k] >= 0) m[k] = Math.max(0, m[k] + d); };
        mv('vAt'); mv('sigL'); mv('ppL'); mv('mpL'); mv('foL'); mv('l31L'); mv('swL');
        if (m.e1At >= 0) m.e1At = Math.max(0, m.e1At + d); if (m.born >= 0) m.born = Math.max(0, m.born + d);
      }
      if (this.l4Out) { if (m.t === 'SWAPRDY' && m.id === this.l4Partner && m.tag >= 5) this.l4OnRdy(m); else this.l4Held.push(msg.clone(m)); return; }   // L4.3
      if (this.dead) return;
      this.farLearn(m);   // FARVIEW
      if (m.dsat && m.lk >= 0 && m.lk !== id) this.f.fabricDoorHeard(id, m.lk, m.lkEp);   // K5
      if (this.vban.size && this.kDropIn(m)) { this.kRx++; return; }   // L27
      const prev = w.L13CUR; w.L13CUR = this;
      try { this.recvBody(m, id, w, lv); } finally { w.L13CUR = prev; }
    },

    // C++: mesh_seat.inc:Seat::recv
    // (the rest of recv, after the CurGuard: split off only so the guard is restored on every return)
    recvBody(m, id, w, lv) {
      const TICK = this.TICK;
      if (this.hostile && this.hostileRecv(m)) return;
      if (lv.SIG_DEDUPE && m.t === 'LEAVE' && m.sig) { const sk = (m.rl ? 'r|' : 'd|') + m.ck + '|' + m.id + '|' + m.tn + '|' + m.mvd + '|' + m.sigAt; if (this.sigSeen.has(sk)) return; this.sigSeen.add(sk); }
      if (m.from >= 0 && m.from !== id && m.t !== 'UNNEEDED' && !m.dgOnly && !m.l10E) this.callBook.touchOut(m.from, TICK);   // CALL
      { if (m.from >= 0 && m.from !== id) this.dials.heard(m.from); if (m.sig && m.id >= 0 && m.id !== id && m.t !== 'LEAVE' && m.t !== 'TRANSLOST') this.dials.heard(m.id); }   // L17
      if (m.id >= 0 && m.id !== id && m.from === m.id && !m.l10E && !m.dgOnly && (m.t === 'HELLO' || m.t === 'CLAIM' || m.t === 'PHONE' || m.t === 'PONG' || m.t === 'CONFIRM') && m.ck) { if (this.l22Cell.size > 64) this.l22Cell.clear(); this.l22Cell.set(m.id, [m.ck, TICK]); }   // L22
      if (this.hasCoord && this.state === 3 && m.id >= 0 && m.id !== id && !m.l10E && !m.dgOnly && (m.t === 'HELLO' || m.t === 'CLAIM' || m.t === 'PHONE' || m.t === 'CONFIRM') && m.ck === ckey(this.coord)) { if (this.l22Rival.size > 32) this.l22Rival.clear(); this.l22Rival.set(m.id, TICK); }   // L22
      if (!this.l24Take(m)) return;   // L24
      if (m.from >= 0 && m.from !== id && m.byes.length > K.L26_LIST) { lv.HM_BIG_TAKEN++; }
      if (m.from >= 0 && m.from !== id && (seatM.l13Frame(m) || m.t === 'MEETACK')) this.callBook.noteIn(m.from, TICK);   // L23
      if (!this.l26Check(m)) { if (m.byes.length > K.L26_LIST) lv.HM_BIG_TAKEN--; lv.L26_REFUSED++; return; }   // L26
      this.framesInT[mtNum(m.t) & 63]++;   // measurement only (`digtop`)
      this.framesIn++;   // GAUGE only
      if (roomTerm(this, 1) && !(m.l10E || m.dgOnly) && m.c7Min >= 0 && m.id >= 0 && m.id !== id && (m.t === 'HELLO' || m.t === 'PHONE' || m.t === 'CONFIRM' || m.t === 'LEAVE' || m.t === 'PONG')) { this.l828Ring.set(m.id, [m.c7Min, TICK]); if (this.l828Ring.size > 256) this.l828Ring.clear(); }   // L8.28
      if (m.from >= 0 && m.from !== id) { if (this.state !== 3) this.entAnsAt = TICK; else if (this.entIsl || this.entAsk.size) { this.entIsl = false; this.entAsk.clear(); } }   // L8.47
      const l846Early = (m.l10E || m.dgOnly);   // L8.46 + L10.6
      if (!l846Early) this.lineNote(m);   // L8.38
      if (m.routing && !this.routeStep(m)) return;   // Option A
      if (m.uxTo === id) this.f.l18UxDeliv(m);   // `l18 measure on` only
      if (m.t === 'PONG' && m.tag === 27) { this.kTakePush(m); return; }
      if (m.t === 'AUDITQ') {
        if (this.hasCoord && this.state === 3 && m.asker >= 0 && m.asker !== id) {
          if (m.tag === 27) {   // L27.10
            if (!this.kIgnore) { const on = FREE.kOver(this.rootDec, this.LT(), id); if (on.length) { const a = newMsg('AUDITA'); a.tag = 27; a.id = id; a.coord = this.coord; a.dgRoot = this.wireDig(this.rootDec); a.dgRoot.kl = []; this.f.fabricAudit(id, m.asker, a); } }
            return;
          }
          if (this.kEvil === 12) return;
          const a = newMsg('AUDITA'); a.tag = m.tag; if (m.tag === 28) a.hold = TICK - this.seatedAt; a.id = id; a.coord = this.coord; a.tn = this.tn; a.hole = m.hole; a.ck = m.ck;
          if (this.kver > 0) a.kv = this.kStmt(); else { a.kv.voter = id; a.kv.signer = id; a.kv.good = true; a.kv.ver = 0; a.kv.ck = ckey(this.coord); a.kv.tn = this.tn; }
          if (this.kEvil === 13 && this.kEvilT >= 0 && this.kver > 0) { a.kv.ver = this.kver + 1; a.kv.yes = []; a.kv.abs = []; a.kv.all = false; }
          if (this.kEvil === 10 && this.kEvilT >= 0) { a.kv.yes = a.kv.yes.filter((x) => x !== this.kEvilT); }
          this.f.fabricAudit(id, m.asker, a);
        }
        return;
      }
      if (m.t === 'AUDITA') { if (m.tag === 27) this.kTakeConf(m); else if (m.tag === 28) this.kHolderAns(m); else this.kAuditAns(m); return; }   // L27
      if (lv.L10_BUCKET && !this.l10Take(m)) { this.stDrop++; return; }   // L10
      if (m.l10E || m.dgOnly) { this.l10Digest(m); return; }   // L10
      if (lv.TIERS_ACTIVE && (m.t === 'HELLO' || m.t === 'CLAIM' || m.t === 'PHONE' || m.t === 'PONG')) this.l4Learn(m);   // L4.1
      if (m.t === 'PHONE' || m.t === 'PONG') this.noteUnp(m);   // G10 / D6
      if (m.id >= 0 && m.id !== id && this.linkIs(m, m.id) && !this.pinned.has(m.id)) this.pinned.set(m.id, fabricToken(lv, m.id));   // L3.10 (S4 TOFU)
      if (this.moving && this.state === 3 && this.moveEvidence(m) && (!this.rmNeedWit || this.rmWitCell(this.coord, (m.t === 'HELLO' || m.t === 'CLAIM') ? m.ck : ckey(m.coord)))) this.confirmMove();   // L11 / T1
      if (this.evilDoor && (m.t !== 'GREETERS' || m.list.length === 0)) return;   // L16 adversary
      switch (m.t) {
        case 'BUSY': if (m.tag === 14) { this.l14Declined(m); return; } this.l16Busied(m); return;   // L14.1
        case 'UPOFFER': this.l14Offer(m); return;   // L16
        case 'HANDOFF': this.l16Handoff(m); return;   // L16.2
        case 'TAKEOVER': if (this.hasCoord && this.state === 3 && m.nc >= 0 && m.nc === m.from && m.nc !== id) { const a = newMsg('TAKEN'); a.nc = m.nc; a.id = id; this.emit(m.nc, a); } return;   // L16.2
        case 'TAKEN': this.l16Taken(m); return;
        case 'GREETERS': this.onGreeters(m); return;
        case 'WHOHOME': this.onWhoHome(m); return;
        case 'HOME': this.onHome(m); return;
        case 'FIND': this.onFind(m); return;
        case 'FINDACK': this.onFindAck(m); return;
        case 'FINDLEAF': this.onFindLeaf(m); return;
        case 'PLACE': this.onPlace(m); return;
        case 'NOROOM': this.onNoRoom(m); return;
        case 'RECLAIM': this.serveReclaim(m); return;   // L3.10
        case 'RECLAIMED': this.onReclaimed(m); return;
        case 'RECLAIMNO': this.onReclaimNo(m); return;
        case 'HELLO': this.onHello(m); return;
        case 'YIELD': this.onYield(m); return;
        case 'CLAIM': this.onClaim(m); return;
        case 'LEAVE': this.onLeave(m); return;
        case 'LGSTARVE': case 'LGASK': case 'LGCOMP': this.lgRecv(m); return;   // L29
        case 'SWAPQ': this.l4OnQ(m); return;
        case 'SWAPRDY': this.l4OnRdy(m); return;
        case 'SWAPGO': this.l4OnGo(m); return;
        case 'UNNEEDED': this.onUnneeded(m); return;
        case 'S1SYNC': this.onS1Sync(m); return;
        case 'DRAIN': this.onDrain(m); return;
        case 'CHALLENGE': this.onChallenge(m); return;
        case 'WITNESS': this.l25WitVote(m); return;   // L25.9
        case 'PLACED': this.l31OnPlaced(m); return;   // L31.4
        case 'PP': this.onPp(m); return;
        case 'CONFIRM': this.onConfirm(m); return;
        case 'MOVED': this.onMoved(m); return;
        case 'SITXFER': this.onSitXfer(m); return;
        case 'SITPING': this.onSitPing(m); return;
        case 'SITPONG': this.onSitPong(m); return;
        case 'PHONE': this.onPhone(m); return;
        case 'PONG': this.onPong(m); return;
        case 'ROUTE': this.onRoute(m); return;
        case 'ROUTED':
          if (m.tag === 1 || m.tag === 2) {
            const tk = ckey(m.target); const cur = this.occGet(tk);
            if (m.id >= 0 && this.hasCoord && tk !== ckey(this.coord) && this.probeAsked(tk, m.pn) && !(cur >= 0 && cur !== m.id && this.holdsCell(tk, 60))) {
              this.setOcc(ckey(m.target), m.id); this.noteS1(ckey(m.target)); this.probeAck.set(ckey(m.target), TICK); this.upAck.set(ckey(m.target), [m.id, TICK]); if (this.upAck.size > 64) eraseFirst(this.upAck);
              { const ex = this.upExpired.get(ckey(m.target)); if (ex !== undefined && ex === m.id) this.upExpired.delete(ckey(m.target)); }
              const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = id; this.emit(m.id, h);
            }
          }
          return;   // probeAck AFTER setOcc (a changed occupant clears the observation first); never about MY OWN cell
        case 'WALK': this.onWalk(m); return;
        case 'MEET': if (this.l13On()) this.l13OnMeet(m); return;   // L13.1
        case 'MEETACK': if (this.l13On()) this.l13OnMeetAck(m); return;   // L13.1
        case 'U2BEAT': case 'U2ACK': this.onU2(m); return;   // L2
        case 'E1STATE': this.onE1State(m); return;
        case 'TRANSLOST': {   // D5: fabric event: MY OWN transport to m.id died (hard: its channel closed; quiet: it only went silent)
          this.l33ChildGone(m.id);   // L33.12
          if (this.f.fabricDoors() && !this.hasCoord && this.state === 2 && m.id >= 0 && m.id === this.gateway && m.hard) this.l16GwClosed = true;   // L16.3
          if (m.id >= 0 && m.id !== id && !(this.f.fabricDoors() && !this.hasCoord)) this.dials.holdGone(m.id, TICK + K.GONE_DIAL);   // L16.3 + L17
          let hard = m.hard || (m.pst && this.l30Small() && !(this.backAt >= 0 && TICK - this.backAt < K.L30_DISC_DEAD) && !(this.l30Deaf >= 0 && TICK - this.l30Deaf < K.L30_DISC_DEAD));   // L30.3
          { const rm = this.relMark.get(m.id); if (hard && rm !== undefined && TICK - rm <= K.RELOAD_MARK_T) { hard = false; this.trace('RELOAD-LEASE', id, this.hasCoord ? this.coord : null, 'peer=%d', m.id); } }
          this.transportLost(m.id, hard); return;
        }
        default: return;
      }
    },
  });

  const api = {};
  GifOS.meshRecv = api;
  if (isNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
