/*
 * island.js: L8 islands, the seat side (C++: mesh_island.inc). Methods only, added to the Seat.
 * Out-parameters: a C++ function that fills one returns the value (none here). Callees other units define
 * (take, requeue, lineOf, lineAdopt, entryTerm, ownedLinkCell, l33NoSock, l33NoSockAsk ...) are
 * called by name on the Seat, as the C++ does.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const seatM = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const { ins, eraseFirst } = req('./util.js', 'meshUtil');
  const { Seat, roomTerm, FREE } = seatM;
  const K = C_.consts, E = C_.enums;
  const { ckey, ckPc, unckey, ownedLinks, up, down, C, MAXLINKS } = topo;
  const LS_NONE = E.LS_NONE, LS_CLOSED = E.LS_CLOSED;
  const newMsg = (t) => msg.newMsg(t);

  Seat.unit('mesh_island.inc', {
    // C++: mesh_island.inc:Seat::islandAsk
    islandAsk(list) {
      const lv = this.w.lv;
      if (this.f.fabricDoors()) {
        this.l16List.length = 0;
        for (const g of list) { if (g < 0 || g === this.id) continue; this.l16List.push(g); if (this.l16List.length >= 32) break; }
        this.l16Next = 0; this.l16Busy.length = 0; this.l16Last = -1; this.l16Hedged = false;
        const f = lv.L16FAN < 0 ? K.L16_FAN : lv.L16FAN;
        this.l16Wave(this.evilDoor || f === 0 ? this.l16List.length : f); return;
      }
      let n = 0;
      for (const g of list) { if (g < 0 || g === this.id) continue; const w = newMsg('WHOHOME'); w.from = this.id; w.ttl = 60; this.emit(g, w); if (++n >= 32) break; }
      if (n > 0 && this.gateway < 0) this.gateway = list[0];
      this.state = 1; this.retryAt = this.TICK; if (this.islandAskAt < 0) this.islandAskAt = this.TICK;
    },

    // C++: mesh_island.inc:Seat::islandTick
    islandTick() {
      if (!this.entryTerm() || !(this.state === 0 || this.state === 1) || this.islandAskAt < 0 || this.lastReach >= this.islandAskAt) return false;
      if (this.TICK - this.islandAskAt < K.ISLAND_WAIT || this.lastGreeters.length === 0) return false;
      if (this.f.fabricDoors() && this.islandAskAt >= 0 && (this.l16Next < this.l16List.length || this.TICK - this.l16WaveAt < K.ISLAND_WAIT)) return false;
      if (this.l16Saw) { this.l16Backoff('silent'); return true; }
      this.trace('ISLAND', this.id, null, 'asked=%zu since=%d', this.lastGreeters.length, this.islandAskAt);
      this.islandAskAt = -1; this.genKey = this.w.lv.URL_KEY; const e = []; this.take({ pc: 0, r: 0, i: 0 }, -1, e); this.islandFounder = true; this.lineAdopt(this.id, 'found'); this.lineFork = true;
      return true;
    },

    // C++: mesh_island.inc:Seat::islandFork
    islandFork(list) {
      if (this.forkAt >= 0 || !this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || this.TICK - this.seatedAt <= 80 || this.TICK - this.greetersAt > K.RELAY_TTL) return;
      const known = new Set(); for (const [, v] of this.occ) if (v >= 0) known.add(v);
      for (const g of list) if (g >= 0 && g !== this.id && !known.has(g)) { this.forkAt = this.TICK; this.trace('FORK', this.id, this.coord, 'stranger=%d', g); return; }
    },

    // C++: mesh_island.inc:Seat::islandForkLive
    islandForkLive() {
      if (this.forkAt >= 0 || !this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || this.TICK - this.seatedAt <= 80) return;
      if (this.greetersAt < 0 || this.TICK - this.greetersAt > K.RELAY_TTL || this.lastGreeters.length === 0) return;
      const ol = ownedLinks(this.coord), n = ol.length;
      for (let q = 0; q < n; q++) {
        if (ol[q].pc !== 0) continue; const k = ckey(ol[q]); const x = this.occGet(k); if (x < 0 || x === this.id) continue;
        let listed = false; for (const g of this.lastGreeters) if (g === x) { listed = true; break; } if (!listed) continue;
        const lb = this.liveBy.get(k); if (lb === undefined || lb !== x) continue;
        const it = this.live.get(k); if (it === undefined || it < this.seatedAt || this.TICK - it < K.NOTMINE_WAIT) continue;
        this.forkAt = this.TICK; this.forkSilent = true; this.trace('FORK', this.id, this.coord, 'silent=%d age=%d', x, this.TICK - it); return;
      }
    },

    // C++: mesh_island.inc:Seat::islandNotMine
    islandNotMine() {
      if (!roomTerm(this, 1) || !this.hasCoord || this.state !== 3) { if (this.noneSince.size) this.noneSince.clear(); return; }
      const ol = ownedLinks(this.coord), n = ol.length; const cur = new Set();
      for (let q = 0; q < n; q++) {
        const k = ckey(ol[q]); const x = this.occGet(k); if (x < 0 || x === this.id) continue; cur.add(x);
        { const ls = this.f.fabricLinkState(this.id, x); if ((ls !== LS_NONE && ls !== LS_CLOSED) || (this.live.has(k) && this.TICK - this.live.get(k) <= K.CHAN_UP)) { this.noneSince.delete(x); continue; } }
        const it = this.noneSince.get(x); if (it === undefined) { this.noneSince.set(x, this.TICK); continue; }
        if (this.TICK - it < K.NOTMINE_WAIT) continue;
        this.trace('NOT-MINE', this.id, ol[q], 'peer=%d none=%d', x, this.TICK - it);
        if (this.coord.pc !== 0 && this.coord.i === 0 && ol[q].pc === this.coord.pc && ol[q].r === this.coord.r && ol[q].i !== 0 && this.f.fabricLinkState(this.id, x) === LS_NONE && this.f.fabricDialFails(this.id, x) > 0) { this.l20Out.set(k, [x, this.TICK]); if (this.l20Out.size > C) eraseFirst(this.l20Out); }
        this.noneSince.delete(x); this.occDrop(k, 'not-my-link'); this.live.delete(k); this.s1seen.delete(k); this.noChan.add(x);
      }
      for (const key of this.noneSince.keys()) { if (!cur.has(key)) this.noneSince.delete(key); }
      if (this.noneSince.size > 4 * MAXLINKS) this.noneSince.clear();
      if ((this.TICK % 8) !== 0) return;
      const gone = [];
      for (const [k, v] of this.occ) {
        if (ckPc(k) !== 0 || v < 0 || v === this.id || k === ckey(this.coord) || this.ownedLinkCell(k)) continue;
        const sn = this.s1seen.get(k); if (sn !== undefined && this.TICK - sn <= K.NOTMINE_ECHO) continue;
        if (this.live.has(k) && this.TICK - this.live.get(k) <= K.NOTMINE_ECHO) continue;
        const b = this.born.get(k); if (b !== undefined && this.LT() - b <= K.NOTMINE_ECHO) continue;
        gone.push(k);
      }
      for (const k of gone) { const c = unckey(k); this.trace('NOT-MINE', this.id, c, 'peer=%d echo', this.occGet(k)); this.occDrop(k, 'not-my-link'); this.live.delete(k); this.s1seen.delete(k); }
    },

    // C++: mesh_island.inc:Seat::islandHeirGone
    islandHeirGone(k, c) {
      if (!roomTerm(this, 1)) return false;
      if (this.occGet(ckey(down(c))) >= 0) { this.heirWait.delete(k); return false; }
      const it = this.heirWait.get(k); if (it === undefined) { this.heirWait.set(k, this.TICK); if (this.heirWait.size > 64) eraseFirst(this.heirWait); return false; }
      if (this.TICK - it < K.NOTMINE_WAIT) return false;
      const h = this.childOf.get(k); const heir = h === undefined ? -1 : h;
      this.trace('NOT-MINE', this.id, c, 'heir=%d waited=%d', heir, this.TICK - it);
      if (heir >= 0) { this.heirNotMine.add(heir); if (this.heirNotMine.size > 64) eraseFirst(this.heirNotMine); }
      this.childOf.delete(k); this.heirWait.delete(k); return true;
    },

    // C++: mesh_island.inc:Seat::ringMin
    ringMin() { let mine = this.id; for (const [k, v] of this.occ) if (v >= 0 && ckPc(k) === 0 && v < mine) mine = v; return mine; },

    // C++: mesh_island.inc:Seat::l827Note
    l827Note() {
      if (!roomTerm(this, 1)) return;
      if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || this.TICK - this.seatedAt < K.L827_SETTLE) { this.l827Hist.length = 0; return; }
      const rm = this.ringMin(); if (this.l827Hist.length === 0 || this.l827Hist[this.l827Hist.length - 1][1] !== rm) this.l827Hist.push([this.TICK, rm]);
      while (this.l827Hist.length > 2 && this.TICK - this.l827Hist[1][0] > K.L827_HOLD + 1) this.l827Hist.shift();
    },

    // C++: mesh_island.inc:Seat::ringName
    ringName() {
      if (!roomTerm(this, 1) || this.l827Hist.length === 0 || this.TICK - this.l827Hist[0][0] < K.L827_HOLD) return this.ringMin();
      let v = this.l827Hist[0][1]; for (const p of this.l827Hist) { if (this.TICK - p[0] >= K.L827_HOLD) v = p[1]; else break; } return v;
    },

    // C++: mesh_island.inc:Seat::l828RingOf
    l828RingOf(x) {
      if (x === this.id) return (this.hasCoord && this.state === 3) ? this.ringName() : -1;
      const it = this.l828Ring.get(x); if (it === undefined || this.TICK - it[1] > 60) return -1; return it[0];
    },

    // C++: mesh_island.inc:Seat::l842Stranger
    l842Stranger(m) {
      if (m.from !== m.id || !this.linkIs(m, m.id) || m.line < 0 || this.line < 0 || m.line === this.line) return false;
      for (const [k, v] of this.occ) if (v === m.id && this.firstHandLive(k)) return false;
      return true;
    },

    // C++: mesh_island.inc:Seat::l845Held
    l845Held() { return this.hasCoord && this.state === 3 && this.TICK - this.seatedAt >= K.L827_SETTLE; },

    // C++: mesh_island.inc:Seat::islandC7
    islandC7(m) {
      if (!roomTerm(this, 1) || !this.hasCoord || this.state !== 3 || this.coord.pc !== 0) return false;
      const fh = this.l842Stranger(m);
      if (!fh) { for (const v of this.occ.values()) if (v === m.id) return false; }
      const ss = this.strangeSeen.get(m.id), xr = this.xrOk.get(m.id);
      if (!fh && !((ss !== undefined && ss >= 2) || (xr !== undefined && this.TICK - xr <= 2 * K.RELAY_TTL))) return false;
      const mine = this.ringName(), theirs = m.c7Min; if (theirs < 0 || theirs === mine) return false;
      const gated = this.TICK - this.c7At < K.RELAY_TTL;
      if (mine > theirs) {
        if (!m.c7Held) { this.trace('L8.45-DROP', this.id, this.coord, 'from=%d theirs=%d', m.id, theirs); return false; }
        const v = ins(this.c7Vouch, theirs, () => new Map()); v.set(m.id, this.TICK);
        for (const [wk, wv] of v) { if (this.TICK - wv > K.RELAY_TTL) v.delete(wk); }
        let vGone = false; if (this.c7Vouch.size > 16) { vGone = (this.c7Vouch.keys().next().value === theirs); eraseFirst(this.c7Vouch); }
        if (gated) return false;
        if (vGone || v.size < 2) return false;
        {
          this.l842Join.clear(); const ls = new Set();
          for (const wk of v.keys()) { this.l842Join.add(wk); const l = this.lineOf(wk); if (l >= 0 && l !== this.line) ls.add(l); }
          for (const x of this.occ.values()) { if (x < 0 || x === this.id) continue; const l = this.lineOf(x); if ((l >= 0 && ls.has(l)) || this.l828RingOf(x) === theirs) this.l842Join.add(x); }
        }
        this.trace('C7', this.id, this.coord, 'mine=%d theirs=%d', mine, theirs); this.c7Yield(mine); this.l842Join.clear(); return true;
      }
      if (gated) return false;
      const t = this.c7Told.get(m.id);
      if (t === undefined || this.TICK - t >= 16) { this.c7Told.set(m.id, this.TICK); if (this.c7Told.size > 64) eraseFirst(this.c7Told); const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = this.id; this.emit(m.id, h); }
      return true;
    },

    // C++: mesh_island.inc:Seat::c7Follow
    c7Follow(m) {
      const occOk = this.occGet(m.ck) === m.id || (this.occGet(m.ck) < 0 && m.id === this.c7PlainId && m.ck === this.c7PlainCk && this.TICK - this.c7PlainAt <= 2);
      if (this.coord.pc === 0 || m.id < 0 || m.id === this.id || !occOk || !FREE.c7Goodbye(m)) return false;
      const u = up({ pc: this.coord.pc, r: this.coord.r, i: 0 }); const fromOwner = !!u && m.ck === ckey(u);
      const fromHead = this.coord.i !== 0 && m.ck === ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 });
      if (!(fromOwner || fromHead) || !this.provenEv(m, m.id)) return false;
      this.trace('C7-FOLLOW', this.id, this.coord, 'by=%d theirs=%d', m.id, m.c7Min);
      this.c7Yield(m.c7Min, 'C7-subtree'); return true;
    },

    // C++: mesh_island.inc:Seat::c7Yield
    c7Yield(rmin, why = 'C7-merge') {
      if (!this.hasCoord || this.state !== 3) return;
      const ol = ownedLinks(this.coord), n = ol.length; const told = new Set();
      const b = newMsg('LEAVE'); b.ck = ckey(this.coord); b.id = this.id; b.c7 = true; b.c7Min = rmin;
      const tell = (x) => { if (x >= 0 && x !== this.id && !told.has(x)) { told.add(x); this.emit(x, msg.clone(b)); } };
      for (let q = 0; q < n; q++) tell(this.occGet(ckey(ol[q])));
      tell(this.occGet(ckey(down(this.coord))));
      tell(this.ownerId());
      this.c7Old.clear(); for (const v of this.occ.values()) if (v >= 0 && v !== this.id && !this.l842Join.has(v)) this.c7Old.add(v); this.c7At = this.TICK;
      if (roomTerm(this, 1)) this.l834Y = rmin;
      this.requeue(why); this.l834Y = -1;
    },

    // C++: mesh_island.inc:Seat::l16Wave
    l16Wave(k) {
      { // stable_partition: a greeter my end of the pc reads closed to goes last
        const head = this.l16List.slice(0, this.l16Next), tail = this.l16List.slice(this.l16Next);
        const a = [], z = []; for (const g of tail) (this.f.fabricLinkState(this.id, g) !== LS_CLOSED ? a : z).push(g);
        this.l16List.length = 0; this.l16List.push(...head, ...a, ...z);
      }
      let n = 0;
      while (n < k && this.l16Next < this.l16List.length) {
        const first = (this.l16Next === 0); const g = this.l16List[this.l16Next++];
        if (!this.l16Ask.includes(g)) this.l16Ask.push(g);
        const w = newMsg('WHOHOME'); w.from = this.id; w.ttl = 60; if (first && !this.oldCell) w.l31 = 1; this.emit(g, w); this.l33NoSockAsk(g); n++;
      }
      if (n > 0 && this.gateway < 0) this.gateway = this.l16List[0];
      this.l16WaveAt = this.TICK; this.state = 1; this.retryAt = this.TICK; if (this.islandAskAt < 0) this.islandAskAt = this.TICK;
    },

    // C++: mesh_island.inc:Seat::l16WaveTick
    l16WaveTick() {
      const lv = this.w.lv;
      if (!this.f.fabricDoors() || this.state !== 1 || this.l16WaveAt < 0 || this.l16Next >= this.l16List.length || this.islandAskAt < 0 || this.lastReach >= this.islandAskAt) return false;
      if (this.TICK - this.l16WaveAt < K.L16_WAVE) { if (lv.L16HEDGE > 0 && !this.l16Hedged && this.TICK - this.l16WaveAt >= lv.L16HEDGE && this.l16Busy.length === 0) { const at = this.l16WaveAt; this.l16Wave(1); this.l16WaveAt = at; this.l16Hedged = true; return true; } return false; }
      this.l16Wave(this.l16List.length); return true;
    },

    // C++: mesh_island.inc:Seat::l16Gateway
    l16Gateway(g, t) {
      this.l16GwClosed = false;
      for (const x of this.l16Ask) if (x !== g && x !== t) { this.f.fabricDoorDrop(this.id, x); this.doorAsk.delete(x); }
      this.l16Ask.length = 0; this.l16Busy.length = 0; this.l16Last = -1; this.l16List.length = 0; this.l16Next = 0; this.l16WaveAt = -1; this.l16Round = 0; this.l16Saw = false;
    },

    // C++: mesh_island.inc:Seat::l16Backoff
    l16Backoff(why) {
      let w = this.w.lv.L16BO_BASE << Math.min(this.l16Round, 8); if (w > this.w.lv.L16BO_CAP) w = this.w.lv.L16BO_CAP; if (this.l16Round < 8) this.l16Round++;
      let d = Math.trunc(this.rng() * (w + 1)); if (d < 1) d = 1;
      for (const x of this.l16Ask) this.f.fabricDoorDrop(this.id, x);
      this.l16Anch = false; this.l16Ho = -1; this.l16Until = this.TICK + d; this.state = 0; this.islandAskAt = -1; this.gateway = -1; this.l16Ask.length = 0; this.l16Busy.length = 0; this.l16Last = -1; this.l16List.length = 0; this.l16Next = 0; this.l16WaveAt = -1; this.f.fabricNoteBackoff(this.id);
      this.trace('BACKOFF', this.id, null, 'why=%s round=%d wait=%d', why, this.l16Round, d);
    },

    // C++: mesh_island.inc:Seat::l16Busied
    l16Busied(m) {
      if (this.evilDoor || this.state === 3 || this.hasCoord) return;
      if (m.nosock) { this.l33NoSock(m.id); return; }
      this.l16Saw = true; const g = m.id; this.doorAsk.delete(g);
      if (this.state === 2) { if (g === this.lastAsked || (g === this.l16Ho && !this.l16Anch)) this.l16Backoff(g === this.l16Ho ? 'anchor-busy' : 'find-busy'); return; }
      if (this.state !== 1) return;
      let asked = false; for (const x of this.l16Ask) if (x === g) { asked = true; break; } if (!asked) return;
      for (const x of this.l16Busy) if (x === g) return; this.l16Busy.push(g);
      if (this.l16Busy.length < this.l16Ask.length) return;
      this.l16Backoff('all-busy');
    },

    // C++: mesh_island.inc:Seat::l16AskOne
    l16AskOne(g) { if (!this.l16Ask.includes(g)) this.l16Ask.push(g); this.l16Last = g; },

    // C++: mesh_island.inc:Seat::l16Wait
    l16Wait() {
      if (this.l16Until < 0) return false;
      if (this.TICK < this.l16Until) return true;
      this.l16Until = -1; this.join(); return true;
    },

    // C++: mesh_island.inc:Seat::l16Evil
    l16Evil() {
      if (((this.TICK + this.id) % K.L16_EVIL_EVERY) === 0) { this.state = 0; this.emitRelay(this.linkKey); }
    },

    // C++: mesh_island.inc:Seat::l16Anchor
    l16Anchor(nc) {
      return;   // L16.3: the admitter answers over a door of its own; no anchor (the rest of the C++ body is unreachable)
      /* eslint-disable no-unreachable */
      if (this.f.fabricMyDoors(this.id) < this.w.lv.L16HOLOAD) return;
      for (let r = 0; r < C; r++) for (let i = 0; i < C; i++) if (this.occGet(ckey({ pc: 0, r, i })) < 0) return;
      const c = []; const d = down(this.coord);
      for (let j = 0; j < C; j++) { const x = this.occGet(ckey({ pc: d.pc, r: d.r, i: j })); if (x >= 0 && x !== this.id && x !== nc) c.push(x); }
      if (c.length === 0) return;
      const a = c[Math.trunc(this.rng() * c.length)]; const h = newMsg('HANDOFF'); h.nc = nc; h.owner = a; h.id = this.id; this.emit(nc, h); this.f.fabricDoorHanded(this.id, nc);
    },

    // C++: mesh_island.inc:Seat::l16Handoff
    l16Handoff(m) {
      if (!this.f.fabricDoors() || this.hasCoord || this.state !== 2 || this.l16Anch || m.nc !== this.id || m.owner < 0 || m.owner === this.id || m.owner === this.gateway) return;
      this.l16Ho = m.owner; this.l16HoAt = this.TICK; const t = newMsg('TAKEOVER'); t.nc = this.id; this.emit(m.owner, t);
      this.trace('HANDOFF', this.id, null, 'to=%d from=%d gw=%d', m.owner, m.id, this.gateway);
    },

    // C++: mesh_island.inc:Seat::l16Taken
    l16Taken(m) {
      if (!this.f.fabricDoors() || this.hasCoord || this.state !== 2 || m.nc !== this.id || m.id < 0 || m.id !== this.l16Ho) return;
      const old = this.gateway; this.gateway = m.id; this.l16Ho = -1; this.l16Anch = true;
      if (old >= 0 && old !== this.gateway) this.f.fabricDoorDrop(this.id, old);
      if (this.lastAsked >= 0 && this.lastAsked !== this.gateway) this.f.fabricDoorDrop(this.id, this.lastAsked);
      for (const x of this.l16Ask) if (x !== this.gateway) { this.f.fabricDoorDrop(this.id, x); this.doorAsk.delete(x); }
      if (old >= 0) this.doorAsk.delete(old);
      this.l16Ask.length = 0; this.trace('TAKEN', this.id, null, 'gw=%d old=%d', this.gateway, old);
    },
  });

  const api = Object.freeze({});
  GifOS.meshIsland = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
