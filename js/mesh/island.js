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
  const dig = req('./dig.js', 'meshDig');
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
      if (this.l8471() && this.islandLast) for (const g of list) { if (g < 0 || g === this.id || !this.islandAsked.has(g)) continue; const e = this.epOf(g); if (e >= 0) { if (this.entEp.size >= 16) this.entEp.clear(); this.entEp.add(e); } }   // L8.47.3: every greeter I asked stayed silent (the verdict that sent this confirm knock): the rooms the door now says they sit in are rooms I cannot reach
      { let fresh = false; const late = []; for (const g of list) { if (g < 0 || g === this.id) continue; if (this.islandAsked.has(g)) continue; this.islandAsked.add(g); const e = this.epOf(g); if ((this.l8471() && this.islandLast && e >= 0 && this.entEp.has(e)) || (this.islandLast && this.l854Other(g))) late.push(g); else fresh = true; }   /* L8.54.1 */
        if (this.islandLast) { this.islandLast = false; if (!fresh) {
          if (late.length) { this.lateAsk.clear(); for (const g of late) { if (this.lateAsk.size >= 8) break; this.lateAsk.add(g); this.trace('L8.47.3-LATE-ASK', this.id, null, 'to=%d at=%d', g, this.epOf(g)); const w = newMsg('WHOHOME'); w.from = this.id; w.ttl = K.WHOHOME_HOPS; this.emit(g, w); } }   // L8.47.3: a new name of a room I already found silent is asked, and holds no founding
          this.islandFound(); return; }
          if (late.length) for (const g of late) this.islandAsked.delete(g); } }   /* a new round: they are asked with it */   // L8.1.2 (C++: islandAsk)
      if (this.f.fabricDoors()) {
        this.l16List.length = 0;
        for (const g of list) { if (g < 0 || g === this.id) continue; this.l16List.push(g); if (this.l16List.length >= 32) break; }
        this.l16Next = 0; this.l16Busy.length = 0; this.l16Last = -1; this.l16Hedged = false;
        const f = lv.L16FAN < 0 ? K.L16_FAN : lv.L16FAN;
        this.l16Wave(this.evilDoor || f === 0 || this.l8471() ? this.l16List.length : f); return;
      }
      let n = 0;
      for (const g of list) { if (g < 0 || g === this.id) continue; const w = newMsg('WHOHOME'); w.from = this.id; w.ttl = 60; this.emit(g, w); if (++n >= 32) break; }
      if (n > 0 && this.gateway < 0) this.gateway = list[0];
      this.state = 1; this.retryAt = this.TICK; if (this.islandAskAt < 0) this.islandAskAt = this.TICK;
    },

    // C++: mesh_island.inc:Seat::islandTick
    islandTick() {
      if (!this.entryTerm() || !(this.state === 0 || this.state === 1) || this.islandAskAt < 0 || this.lastReach >= this.islandAskAt) return false;
      const o54 = this.l854All(this.lastGreeters); const iw = o54 ? 0 : this.islandWait();   // L8.47.1, L8.54.1
      if (this.ehAt >= 0 && this.TICK - this.ehAt < K.ISLAND_WAIT) {   // L8.47.2: it said it has no room yet: I wait for it, and ask it again once per dial verdict while it says so
        if (this.TICK - this.ehAskAt >= K.ISLAND_WAIT_BLOCKED) { this.ehAskAt = this.TICK | 0; for (const g of this.ehFrom) { const w = newMsg('WHOHOME'); w.from = this.id; w.ttl = K.WHOHOME_HOPS; this.emit(g, w); } }
        return false; }
      if (o54 && !this.islandLast && !this.l16Saw && (this.greetersAt >= 0)) { this.trace('L8.54-OTHER', this.id, null, 'asked=%zu', this.lastGreeters.length); for (const x of this.l16Ask) this.f.fabricDoorDrop(this.id, x); this.l16Anch = false; this.l16Ho = -1; this.l16Ask.length = 0; this.l16Busy.length = 0; this.l16Last = -1; this.l16List.length = 0; this.l16Next = 0; this.l16WaveAt = -1; this.l16FreshAt = -1; this.islandFound(); return true; }   // L8.54.1: no silence to wait for and no second knock: my seating knock reads the door's fresh list (L8.1.3)
      if (this.TICK - this.islandAskAt < iw || this.lastGreeters.length === 0) return false;
      if (this.f.fabricDoors() && this.islandAskAt >= 0 && (this.l16Next < this.l16List.length || this.TICK - this.l16FreshAt < iw)) return false;
      if (this.l16Saw) { this.l16Saw = false; this.l16Backoff('silent'); return true; }   // a BUSY is evidence for its own round (C++: islandTick)
      if (this.l8471() && !this.islandLast && !o54) this.trace('L8.47.1-ONE', this.id, null, 'asked=%zu since=%d wait=%d', this.islandAsked.size, this.islandAskAt, iw);
      if (!this.l8471() && this.islandAskN + 1 < K.ISLAND_ASKS) {   // L8.1.1: a silent round is the door's list of one moment, not the room: knock again (bounded) before founding
        this.islandAskN++; this.trace('ISLAND-REASK', this.id, null, 'round=%d asked=%zu since=%d', this.islandAskN, this.lastGreeters.length, this.islandAskAt);
        for (const x of this.l16Ask) this.f.fabricDoorDrop(this.id, x);
        this.l16Anch = false; this.l16Ho = -1; this.l16Ask.length = 0; this.l16Busy.length = 0; this.l16Last = -1; this.l16List.length = 0; this.l16Next = 0; this.l16WaveAt = -1; this.l16FreshAt = -1;
        this.state = 0; this.islandAskAt = -1; this.gateway = -1; this.join();
        return true;
      }
      if (!this.islandLast) {   // L8.1.2: one confirm knock; the list that comes back founds (islandAsk) unless it names a greeter never asked
        this.islandLast = true; this.trace('ISLAND-CONFIRM', this.id, null, 'asked=%zu since=%d rounds=%d', this.islandAsked.size, this.islandAskAt, this.islandAskN + 1);
        if (this.f.fabricDoors()) this.l16Backoff('island-confirm'); else { this.state = 0; this.islandAskAt = -1; this.gateway = -1; this.join(); }
        return true;
      }
      this.islandFound(); return true;
    },

    // C++: mesh_island.inc:Seat::doorCall
    // FHOP.8 door-call, the seat's part. A greeter whose door to a knocker cannot open has called me to the door. For
    // DOORCALL_HOLD I am a greeter of the meeting though I sit deep: I register at the door with the meeting key (so the
    // knocker's next list names me), hold my door socket (socketed) and answer WHOHOME with HOME as a Section-1 seat does
    // (onWhoHome). A second call while I stand there only moves the end.
    doorCall(by, knocker) {
      if (!this.hasCoord || this.state !== 3 || this.coord.pc === 0) return;
      const was = this.doorCallOn(); this.doorCallUntil = (this.TICK | 0) + K.DOORCALL_HOLD;
      if (was) return;
      this.trace('DOOR-CALLED', this.id, this.coord, 'by=%d for=%d', by, knocker); this.emitRelay(this.genKey);
    },

    // C++: mesh_island.inc:Seat::subTake
    // The door number. A large meeting is several rooms joined by relayed connections; each room is an ordinary room
    // behind its own door. Every frame carries its sender's door number and a seat drops a frame from another door,
    // except the joining frame from the seat at the far end of its own joining connection, and a frame from a seat its
    // own view names when one of the two numbers is 0: the seat at 0 then takes the other's number (a seated room that
    // was given a number moves its door as one; the number only ever goes 0 -> r). true: the frame is taken.
    subTake(m) {
      if (m.t === 'PIPE') return true;   // onPipe takes it from my own far end only
      let named = false; if (m.sr === 0 || this.sr === 0) for (const x of this.occ.values()) if (x === m.from) { named = true; break; }
      if (!named) { this.trace('SUB.1-DROP', this.id, null, 'from=%d sr=%d mine=%d mt=%d', m.from, m.sr, this.sr, msg.MT_NAMES.indexOf(m.t)); return false; }
      if (this.sr === 0) { this.sr = m.sr; this.trace('SUB.1-ADOPT', this.id, this.hasCoord ? this.coord : null, 'from=%d sr=%d', m.from, this.sr); }
      return true;
    },
    // C++: mesh_island.inc:Seat::subGo
    // The answer to the page's ask: my door is r, either a listed room one of whose greeters the page reached, or a new
    // number granted with a joining connection. Seated: I take the number and register at that door, and my room
    // follows frame by frame. Outside: my entry starts again at that door.
    subGo(r) {
      this.trace('SUB.2-GO', this.id, this.hasCoord ? this.coord : null, 'sr=%d state=%d', r, this.state); this.sr = r;
      if (this.state === 3) { this.emitRelay(this.genKey); return; }
      for (const x of this.l16Ask) this.f.fabricDoorDrop(this.id, x);
      this.l16Anch = false; this.l16Ho = -1; this.l16Until = 0; this.l16Round = 0; this.l16Ask.length = 0; this.l16Busy.length = 0; this.l16Last = -1; this.l16List.length = 0; this.l16Next = 0; this.l16WaveAt = -1; this.l16FreshAt = -1; this.l16Saw = false;
      this.islandAsked.clear(); this.entEp.clear(); this.islandLast = false; this.islandAskN = 0; this.islandAskAt = -1; this.gateway = -1; this.lastGreeters.length = 0; this.lastGreetersAt.length = 0; this.greetersAt = -1; this.state = 0; this.join();
    },
    // C++: mesh_island.inc:Seat::pipeOut
    // Each end of a joining connection is one more child of the other. What I send my far end is the room fold built
    // WITHOUT the part that connection gave me (a part is left out, never subtracted): my own section before any
    // joining connection, with every other one's fold, folded with the section table as the room fold is. It goes in
    // far form: the people are far people, and nothing a seating decision reads crosses; the lists cross as they are.
    pipeOut(peer) {
      const mine = dig.cloneDig(this.pipeBase.at >= 0 ? this.pipeBase : this.myDig);
      if (this.pipeBase.at >= 0) { for (const [k, e] of this.pipeDig) if (k !== peer) dig.digFold(mine, e); dig.digTrim(mine); }
      const h = { R: msg.newDig() }; this.rootFold(false, h, mine); const R = h.R;
      const o = msg.newDig(); o.at = R.at; o.rx = R.rx; o.by = this.id; o.far = dig.digPop(R); o.handN = R.handN; o.awayN = R.awayN; o.hands = R.hands; o.stage = R.stage; o.apps = R.apps; o.talk = R.talk;
      return o;
    },
    // C++: mesh_island.inc:Seat::pipeBeat
    pipeBeat() {
      if (this.state !== 3 || !this.hasCoord || this.coord.pc !== 0 || this.coord.i !== 0) return;
      for (const p of this.f.fabricPipePeers(this.id)) { const m = newMsg('PIPE'); m.id = this.id; m.coord = { pc: this.coord.pc, r: this.coord.r, i: this.coord.i }; m.dgUp = this.wireDig(this.pipeOut(p)); m.sr = this.sr; this.f.fabricCallFrame(this.id, p, m); }
    },
    // C++: mesh_island.inc:Seat::onPipe
    // The receiver: a row head of Section 1 that holds a joining connection to the sender (its own connection table says so).
    onPipe(m) {
      if (this.state !== 3 || !this.hasCoord || this.coord.pc !== 0 || this.coord.i !== 0 || m.id < 0 || m.id !== m.from) return;
      { const pp = this.f.fabricPipePeers(this.id); if (pp.indexOf(m.id) < 0) { this.trace('SUB.4-NOPEER', this.id, this.coord, 'from=%d', m.id); return; } }
      const u = dig.cloneDig(m.dgUp); this.rxDig(u); if (u.at < 0) return;
      u.n = 0; u.leased = 0; u.held = 0; u.refuse = 0; u.part = 0; u.freeC = 0; u.dmin = 99; u.rows = []; u.votes = []; u.kick = []; u.kabs = 0; u.kl = []; u.kOwn = msg.newKStmt();   // far form, whatever arrived: nothing of another room is a seat of mine
      const was = this.pipeDig.get(m.id); this.l10Dirty(was !== undefined ? was : null, u); if (was === undefined) { this.trace('SUB.4-PIPE', this.id, this.coord, 'peer=%d far=%d', m.id, u.far); this.l10Mark(); }
      this.pipeDig.set(m.id, u); if (this.pipeBase.at < 0) this.pipeBase = dig.cloneDig(this.myDig);
    },

    // C++: mesh_island.inc:Seat::islandFound
    islandFound() {
      if (this.f.fabricSubAsk(this.id)) { this.trace('SUB.2-WAIT', this.id, null, 'asked=%zu', this.lastGreeters.length); this.l16Backoff('sub-ask'); return; }   // a joiner about to found on silence asks for the list of rooms first, and keeps knocking while the ask is open
      this.trace('ISLAND', this.id, null, 'asked=%zu since=%d rounds=%d reach=%d', this.lastGreeters.length, this.islandAskAt, this.islandAskN + 1, typeof this.f.fabricReachSeated === 'function' ? this.f.fabricReachSeated(this.id) : -1);   // reach: the oracle's count (netmatrix bar), -1 without groups
      this.l850Seated = false; this.ehAt = -1; this.ehAskAt = -1; this.ehFrom.clear(); this.foundKnock = true;
      this.islandAskAt = -1; this.islandAskN = 0; this.islandLast = false; this.genKey = this.w.lv.URL_KEY ? this.w.lv.URL_KEY : this.myKey; /* a founder with no link key mints its own (C++: islandFound) */ const e = []; this.lineAt = this.TICK; /* L8.52.3: before take(): my registration at the door carries my epoch */ this.take({ pc: 0, r: 0, i: 0 }, -1, e); this.islandFounder = true; this.lineAdopt(this.id, this.TICK, 'found'); this.lineFork = true;
    },

    // C++: mesh_island.inc:Seat::l3117Stray
    // L3.11.7: the door refused my registration and lists a greeter my view does not hold. 0: none; 1: I stay; 2: yielded.
    l3117Stray(list) {
      if (!this.f.fabricDoors() || this.state !== 3 || !this.hasCoord || this.coord.pc !== 0) return 0;   // C++: fabricDoors() (the seat-side query)
      let n = 0, via = -1;
      for (const g of list) { if (g < 0 || g === this.id) continue; let held = false; for (const v of this.occ.values()) if (v === g) { held = true; break; } if (!held) n++;
        if (via < 0) { const h = this.l22Cell.get(g); if (this.f.fabricLinkCarries(this.id, g) || this.f.fhopFriendFor(this.id, g) || (h !== undefined && this.TICK - h[1] <= 60)) via = g; } }   // a path: any LISTED greeter (C++: l3117Stray)
      if (n === 0) return 0;
      if (via < 0 || this.moving) { this.trace('L3.11.7-STAY', this.id, this.coord, 'strangers=%d', n); return 1; }
      this.trace('L3.11.7-STRAY', this.id, this.coord, 'via=%d strangers=%d', via, n);
      this.c7Yield(this.ringName(), 'L3.11.7-stray'); this.c7Old.clear(); this.l851Up = -1; return 2;
    },

    // C++: mesh_island.inc:Seat::keyAsk
    // L3.11.6: the door refused my registration and named its greeters: ask the lowest one seated in my home section for the door's key.
    keyAsk(list) {
      if (this.state !== 3 || !this.hasCoord || this.coord.pc !== 0 || this.TICK - this.rosterAskAt <= 40) return;
      let to = -1;
      for (const g of list) { if (g < 0 || g === this.id || (to >= 0 && g >= to)) continue; for (const [k, v] of this.occ) if (ckPc(k) === 0 && v === g) { to = g; break; } }
      if (to < 0) return;
      this.rosterAskAt = this.TICK; this.trace('L3.11.6-KEYASK', this.id, this.coord, 'to=%d', to); const w = newMsg('WHOHOME'); w.from = this.id; w.ttl = 60; this.emit(to, w);
    },

    // C++: mesh_island.inc:Seat::islandFork
    islandFork(list) {
      if (this.forkAt >= 0 || !this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || this.TICK - this.seatedAt <= 80 || this.TICK - this.greetersAt > K.RELAY_TTL) return;
      const known = new Set(); for (const [, v] of this.occ) if (v >= 0) known.add(v);
      for (const g of list) if (g >= 0 && g !== this.id && !known.has(g)) { this.forkAt = this.TICK; this.trace('FORK', this.id, this.coord, 'stranger=%d', g); return; }
    },

    // C++: mesh_island.inc:Seat::earNote
    // L8.48: silence is the mate's fault only while this seat's own ear is open.
    earNote(m) { if (m.from !== this.id) this.earAt = this.TICK; },
    earWake() {
      this.deafFloor = this.TICK;
      for (const k of this.noneSince.keys()) this.noneSince.set(k, this.TICK);
      this.rmAskFirst.clear(); this.rmAskT.clear(); this.rmPend.clear();
    },
    earGap() {
      if (this.earAt >= 0 && this.earTick >= 0 && this.TICK - this.earTick > K.L30_SILENT) this.earWake();   // a gap longer than the silence window did not observe it
      this.earTick = this.TICK;
    },
    earShut() {
      if (this.earAt < 0) return false;   // nothing folded yet: the join path, not a shut ear
      if (this.deafFloor >= 0 && this.earAt < this.deafFloor) return true;   // thawed, and no frame has folded since
      return this.TICK - this.earAt > K.L30_SILENT;
    },

    // C++: mesh_island.inc:Seat::islandForkLive
    islandForkLive() {
      if (this.forkAt >= 0 || !this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || this.TICK - this.seatedAt <= 80) return;
      if (this.l30 && this.TICK - this.l30At <= K.L30_SILENT + 1) return;   // L8.7: a seat just in small mode: L30.5 has the first word on a silent mate (a fork here turned small mode off and a young room waited 110 s on a dark head)
      if (this.earShut()) return;   // L8.48: a shut ear cannot call a mate silent
      if (this.greetersAt < 0 || this.TICK - this.greetersAt > K.RELAY_TTL || this.lastGreeters.length === 0) return;
      const ol = ownedLinks(this.coord), n = ol.length;
      for (let q = 0; q < n; q++) {
        if (ol[q].pc !== 0) continue; const k = ckey(ol[q]); const x = this.occGet(k); if (x < 0 || x === this.id) continue;
        let listed = false; for (const g of this.lastGreeters) if (g === x) { listed = true; break; } if (!listed) continue;
        const lb = this.liveBy.get(k); if (lb === undefined || lb !== x) continue;
        if (this.f.fabricLinkCarries(this.id, x)) continue;   // L8.48: a link that still carries is not silence. A half-open cut does not carry
        { const fh = this.fhdIn.get(k); if (fh !== undefined && fh[0] === x && fh[1] >= this.seatedAt && this.TICK - fh[1] < K.NOTMINE_WAIT) continue; }   // L8.7.1: a row-mate heard x first-hand at this cell inside the window: in my room, carried by a friend (C++: mesh_island.inc islandForkLive)
        const it = this.live.get(k); if (it === undefined || it < this.seatedAt) continue;
        let since = it; if (this.deafFloor >= 0 && this.deafFloor > since) since = this.deafFloor;
        if (this.TICK - since < K.NOTMINE_WAIT) continue;
        this.forkAt = this.TICK; this.forkSilent = true; this.trace('FORK', this.id, this.coord, 'silent=%d age=%d', x, this.TICK - since); return;
      }
    },

    // C++: mesh_island.inc:Seat::islandNotMine
    islandNotMine() {
      if (!roomTerm(this, 1) || !this.hasCoord || this.state !== 3) { if (this.noneSince.size) this.noneSince.clear(); this.doorCarry = false; return; }
      const ol = ownedLinks(this.coord), n = ol.length; const cur = new Set(); let dc = false;
      for (let q = 0; q < n; q++) {
        const k = ckey(ol[q]); const x = this.occGet(k); if (x < 0 || x === this.id) continue; cur.add(x);
        { const ls = this.f.fabricLinkState(this.id, x); if (this.coord.pc !== 0 && (ls === LS_NONE || ls === LS_CLOSED) && this.f.fabricDialFails(this.id, x) > 0) dc = true; }   // L33.14: a mate I name, heard through friends, whose pc my dials never opened
        if (this.earShut()) { this.noneSince.delete(x); continue; }   // L8.48: a shut ear does not start the drop clock
        { const ls = this.f.fabricLinkState(this.id, x); if ((ls !== LS_NONE && ls !== LS_CLOSED) || (this.live.has(k) && this.TICK - this.live.get(k) <= K.CHAN_UP)) { this.noneSince.delete(x); continue; } }
        const it = this.noneSince.get(x); if (it === undefined) { this.noneSince.set(x, this.TICK); continue; }
        if (this.deafFloor >= 0 && it < this.deafFloor) { this.noneSince.set(x, this.TICK); continue; }   // L8.48: a none-stamp from before the ear reopened is not this window
        if (this.TICK - it < K.NOTMINE_WAIT) continue;
        this.trace('NOT-MINE', this.id, ol[q], 'peer=%d none=%d', x, this.TICK - it);
        if (this.coord.pc !== 0 && this.coord.i === 0 && ol[q].pc === this.coord.pc && ol[q].r === this.coord.r && ol[q].i !== 0 && this.f.fabricLinkState(this.id, x) === LS_NONE && this.f.fabricDialFails(this.id, x) > 0) { this.l20Out.set(k, [x, this.TICK]); if (this.l20Out.size > C) eraseFirst(this.l20Out); }
        this.noneSince.delete(x); this.occDrop(k, 'not-my-link'); this.live.delete(k); this.s1seen.delete(k); this.noChan.add(x);
      }
      this.doorCarry = dc;   // L33.14 (read by socketed(): the door socket stays while such a mate is named)
      for (const key of this.noneSince.keys()) { if (!cur.has(key)) this.noneSince.delete(key); }
      if (this.noneSince.size > 4 * MAXLINKS) this.noneSince.clear();
      if (this.earShut()) return;   // L8.48: a second-hand echo is not silence while my own ear is shut
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

    // C++: mesh_island.inc:Seat::l853Stays   [true: this HOME or chair names a ring that stays, so a mover takes it even from a seat that left with it]
    l853Stays(m) { return m.c7Min >= 0 && this.l851Up >= 0 && this.TICK - this.l851At < K.RELAY_TTL && this.ringOlder(m.c7Min, m.lineAt, this.l851Up, this.l851Ep); },

    // C++: mesh_island.inc:Seat::ringMin
    ringMin() {
      let mine = this.id; for (const [k, v] of this.occ) if (v >= 0 && ckPc(k) === 0 && v < mine) mine = v;
      return mine;
    },

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

    // C++: mesh_island.inc:Seat::l857Alone   (L8.5.7: alone in my part of the meeting, I join on the word of one settled member I hear directly)
    l857Alone(m) {
      if (m.from !== m.id || !this.linkIs(m, m.id) || !m.c7Held || m.line < 0 || this.line < 0 || m.line === this.line || !this.hasCoord || this.state !== 3 || this.coord.pc !== 0) return false;
      for (const [k, v] of this.occ) if (v >= 0 && v !== this.id && v !== m.id && ckPc(k) === 0) return false;
      return true;
    },
    // C++: mesh_island.inc:Seat::l858Ring   (L8.5.8: with mates beside me I do not give up my seat alone to someone from another founding of the meeting)
    l858Ring(m) {
      if (!roomTerm(this, 1) || m.from !== m.id || m.line < 0 || this.line < 0 || m.line === this.line || !this.hasCoord || this.state !== 3 || this.coord.pc !== 0) return false;
      for (const [k, v] of this.occ) if (v >= 0 && v !== this.id && v !== m.id && ckPc(k) === 0) return true;
      return false;
    },
    // C++: mesh_island.inc:Seat::ringAlone   (L8.5.2: my view holds no Section-1 seat but me)
    ringAlone() { if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0) return false; for (const [k, v] of this.occ) if (v >= 0 && v !== this.id && ckPc(k) === 0) return false; return true; },

    // C++: mesh_island.inc:Seat::l850Lone
    // L8.50.3: on the cell I founded (or the room's first page), and I have admitted nobody since
    l850Lone() { return this.line === this.id && !this.l850Seated && this.hasCoord && this.state === 3 && ckey(this.coord) === 0 && !this.moving; },

    // C++: mesh_island.inc:Seat::l850
    // L8.50: a founder of one and a room (.1 the room's seat, .2 the founder)
    l850(m) {
      if (!this.f.fabricDoors() || !this.hasCoord || this.state !== 3 || this.coord.pc !== 0) return false;
      if (m.from !== m.id || !this.linkIs(m, m.id) || m.line < 0 || this.line < 0 || m.line === this.line) return false;
      if (m.c7One) {   // L8.50.1
        if (this.l850Lone()) return false;   // two founders of one: T1
        if (m.line !== m.id && this.lineAt >= 0 && m.lineAt >= 0 && m.lineAt < this.lineAt) return false;   // L8.52.5 (mesh_ring.inc): "alone" said by a seat that did not found the lineage it stamps, an older one than mine, is no founder of one
        let mate = false; for (const [k, v] of this.occ) if (v >= 0 && v !== this.id && v !== m.id && ckPc(k) === 0 && this.firstHandLive(k)) { mate = true; break; }
        if (!mate) return false;
        this.trace('L8.50-ROOM', this.id, this.coord, 'to=%d line=%d', m.id, m.line); const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = this.id; h.c7Min = this.ringName(); h.c7Held = true; h.c7One = false; this.emit(m.id, h);   // one answer per HELLO received
        return true;
      }
      const lone = this.l850Lone(), left = !lone && this.ringAlone() && !this.moving && this.lineAt >= 0 && m.lineAt >= 0 && m.lineAt < this.lineAt;   // L8.52.4 (mesh_ring.inc): the last seat of the younger room, alone on its ring, follows on the older room's one word
      if (m.c7Min < 0 || !(lone || left)) return false;   // L8.50.2
      this.trace(lone ? 'L8.50-LONE' : 'L8.52-LEFT', this.id, this.coord, 'via=%d ring=%d', m.id, m.c7Min);
      this.c7Yield(this.ringName(), 'L8.50-lone'); this.c7Old.clear(); this.l851Up = -1; return true;
    },

    // C++: mesh_island.inc:Seat::l51Rooms
    // L8.51: a contest between two rooms is the merge's (0: not one; 1: the claimant is of the other room; 2: the holder is)
    l51Rooms(claimant, holder) {
      if (this.line < 0 || claimant < 0 || holder < 0) return 0;
      const lc = this.lineOf(claimant), lh = this.lineOf(holder); if (lc < 0 || lh < 0 || lc === lh) return 0;
      const other = (lh === this.line && lc !== this.line) ? claimant : (lc === this.line && lh !== this.line) ? holder : -1; if (other < 0) return 0;
      if (this.hasCoord && this.state === 3 && this.l828RingOf(other) === this.ringName()) return 0;
      return other === claimant ? 1 : 2;
    },

    // C++: mesh_island.inc:Seat::l8510Bye   (L8.5.10: the one-merge gate does not hold a mate's goodbye toward an older founding)
    l8510Bye(m) {
      if (m.line < 0 || m.line !== this.line || this.lineAt < 0 || m.id < 0 || this.c7Old.has(m.id) || this.greetersAt < 0 || this.TICK - this.greetersAt > K.RELAY_TTL) return false;
      for (let k = 0; k < this.lastGreeters.length && k < this.lastGreetersAt.length; k++) { const g = this.lastGreeters[k], at = this.lastGreetersAt[k]; if (g >= 0 && g !== this.id && g !== m.id && at >= 0 && at < this.lineAt) return true; }
      return false;
    },

    // C++: mesh_island.inc:Seat::l8511Drop   (L8.51.1: a yield from a seat whose own frames name another founding is not kept)
    l8511Drop(by) {
      if (this.line < 0 || by < 0) return false; const l = this.lineOf(by); if (l < 0 || l === this.line) return false;
      { let mate = false; for (const [k, x] of this.occ) if (x >= 0 && x !== this.id && ckPc(k) === 0 && this.firstHandLive(k) && this.lineOf(x) === this.line) { mate = true; break; } if (!mate) return false; }   // no Section-1 mate of my own lineage heard first-hand: no room stands behind my cell
      this.trace('L8.51.1-DROP', this.id, this.hasCoord ? this.coord : null, 'by=%d line=%d', by, l); return true;
    },

    // L8.53 THE DOOR DATES THE ROOMS (law text: gifos test/sim/mesh_island.inc, docs/healing-laws.md).
    // C++: mesh_island.inc:Seat::l853Dated   (L8.53.1: a greeter the door dates to another founding is a stranger at its first listing)
    l853Dated(x) {
      if (x < 0 || x === this.id || this.lineAt < 0 || this.greetersAt < 0 || this.TICK - this.greetersAt > K.RELAY_TTL) return false;
      const at = this.epOf(x); if (at < 0 || at === this.lineAt) return false;
      for (const [k, v] of this.occ) if (v === x && this.firstHandLive(k)) return false;   // a seat I hear first-hand at its cell is of my ring, whatever it registered
      return true;
    },

    // C++: mesh_island.inc:Seat::l853Greeter
    l853Greeter(voucher, ep) {
      if (this.greetersAt < 0 || this.TICK - this.greetersAt > K.RELAY_TTL) return -1;
      for (let k = 0; k < this.lastGreeters.length && k < this.lastGreetersAt.length; k++) { const g = this.lastGreeters[k]; if (g >= 0 && g !== this.id && g !== voucher && this.lastGreetersAt[k] === ep) return g; }
      return -1;
    },

    // C++: mesh_island.inc:Seat::l853Ask   (L8.53.2: the second voucher is asked through the first)
    l853Ask() {
      if (this.l853From < 0 || this.TICK - this.l853AskAt < K.ISLAND_WAIT) return this.l853From >= 0;
      let n = 0;
      for (let k = 0; k < this.lastGreeters.length && k < this.lastGreetersAt.length && n < C; k++) {
        const g = this.lastGreeters[k]; if (g < 0 || g === this.id || g === this.l853From || this.lastGreetersAt[k] !== this.l853Ep || !this.l853Dated(g)) continue;
        if (this.l849Pick === g) this.l849Pick = -1;   // this greeting rides a friend (the voucher), it is not the listing's dial
        this.trace('L8.53-ASK', this.id, this.coord, 'via=%d to=%d at=%d', this.l853From, g, this.l853Ep); const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = this.id; this.emit(g, h); n++;
      }
      if (n) this.l853AskAt = this.TICK; return n > 0;
    },

    // C++: mesh_island.inc:Seat::l853Second   (L8.53.2 / L8.53.3: one voucher short: ask the second through the first, or the door first)
    l853Second(m, theirs, tAt) {
      if (m.from !== m.id || !this.linkIs(m, m.id) || this.lineAt < 0 || m.lineAt < 0 || tAt !== m.lineAt || m.lineAt >= this.lineAt) return false;
      this.l853From = m.id; this.l853Ring = theirs; this.l853Ep = m.lineAt; this.l853At = this.TICK;
      if (!this.l853Ask() && this.TICK - this.l853KnockAt >= K.E3_PERIOD) { this.l853KnockAt = this.TICK; this.trace('L8.53-KNOCK', this.id, this.coord, 'from=%d ring=%d at=%d', m.id, theirs, m.lineAt); this.emitRelay(this.genKey); }
      return false;
    },

    // C++: mesh_island.inc:Seat::l853Door
    l853Door() {
      if (this.l853From < 0) return;
      if (this.TICK - this.l853At > K.RELAY_TTL || !this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || this.lineAt < 0 || this.l853Ep >= this.lineAt || this.l853Ring === this.ringName()) { this.l853From = -1; return; }
      if (!roomTerm(this, 1) || this.TICK - this.c7At < K.RELAY_TTL) return;
      this.l853Ask();
    },

    // C++: mesh_island.inc:Seat::l853Pick   (L8.53.4: the voucher is my way in)
    l853Pick(list) {
      if (this.l853Via < 0 || this.c7At < 0 || this.TICK - this.c7At > K.SIT_TTL || list.indexOf(this.l853Via) < 0) return -1;
      this.trace('L8.53-VIA', this.id, null, 'via=%d since=%d', this.l853Via, this.c7At); return this.l853Via;
    },

    // C++: mesh_island.inc:Seat::islandC7
    islandC7(m) {
      if (!roomTerm(this, 1) || !this.hasCoord || this.state !== 3 || this.coord.pc !== 0) return false;
      const fh = this.l842Stranger(m) || this.l857Alone(m);   // L8.5.7
      if (!fh) {
        const other = (m.from === m.id || (m.sig && this.l853Dated(m.id))) && m.line >= 0 && this.line >= 0 && m.line !== this.line;   // L8.53.2: or its signed greeting, carried, when the door dates it to another founding   // L8.42.1: its own greeting names another founding
        for (const [k, v] of this.occ) if (v === m.id && (!other || this.firstHandLive(k))) return false;   // a seat my view holds is of my ring, unless I hold it only second-hand and its own greeting names another founding
      }
      const ss = this.strangeSeen.get(m.id), xr = this.xrOk.get(m.id);
      if (!fh && !((ss !== undefined && ss >= 2) || (xr !== undefined && this.TICK - xr <= 2 * K.RELAY_TTL) || this.l853Dated(m.id))) return false;
      const mine = this.ringName(), theirs = m.c7Min; if (theirs < 0 || theirs === mine) return false;
      const gated = this.TICK - this.c7At < K.RELAY_TTL;
      let tAt = m.lineAt; { const ve = this.c7VouchEp.get(theirs); if (ve !== undefined && this.TICK - ve[1] <= K.RELAY_TTL) tAt = (tAt < 0 || ve[0] < 0) ? -1 : Math.max(tAt, ve[0]); }   // L8.52.1: of two vouchers' epochs for one name the YOUNGER counts
      if (this.ringOlder(theirs, tAt, mine, this.lineAt)) {
        { this.c7VouchEp.set(theirs, [tAt, this.TICK]); if (this.c7VouchEp.size > 16) eraseFirst(this.c7VouchEp); }
        if (!m.c7Held) { this.trace('L8.45-DROP', this.id, this.coord, 'from=%d theirs=%d', m.id, theirs); return false; }
        const v = ins(this.c7Vouch, theirs, () => new Map()); v.set(m.id, this.TICK);
        for (const [wk, wv] of v) { if (this.TICK - wv > K.RELAY_TTL) v.delete(wk); }
        let vGone = false; if (this.c7Vouch.size > 16) { vGone = (this.c7Vouch.keys().next().value === theirs); eraseFirst(this.c7Vouch); }
        if (gated) return false;
        if (vGone || (v.size < 2 && !m.c7One && !this.l857Alone(m))) { if (!vGone && v.size < 2) this.l853Second(m, theirs, tAt);   /* L8.53.2: one voucher short: ask the second through the first */ return false; }   // L8.5.2: a settled founder that holds nobody else IS its ring: its one vouch is the whole ring's word
        {
          this.l842Join.clear(); const ls = new Set();
          for (const wk of v.keys()) { this.l842Join.add(wk); const l = this.lineOf(wk); if (l >= 0 && l !== this.line) ls.add(l); }
          for (const x of this.occ.values()) { if (x < 0 || x === this.id) continue; const l = this.lineOf(x); if ((l >= 0 && ls.has(l)) || this.l828RingOf(x) === theirs) this.l842Join.add(x); }
        }
        this.trace('C7', this.id, this.coord, 'mine=%d theirs=%d', mine, theirs); if (this.l853From >= 0 && v.has(this.l853From)) { this.l853Via = this.l853From; this.l853From = -1; }   /* L8.53.4 */ this.c7TowardEp = tAt; this.c7Yield(mine, 'C7-merge', theirs); this.c7TowardEp = -1; this.l842Join.clear(); return true;
      }
      if (gated) return false;
      const t = this.c7Told.get(m.id);
      if (t === undefined || this.TICK - t >= 16) { this.c7Told.set(m.id, this.TICK); if (this.c7Told.size > 64) eraseFirst(this.c7Told); const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = this.id; this.emit(m.id, h); }
      return true;
    },

    // C++: mesh_island.inc:Seat::l851Note   [L8.5.1: a seat that left its cell to a lower ring enters a ring that stays]
    l851Note(up, ep) {
      if (!roomTerm(this, 1) || up < 0) return;
      for (const [x, [name, at]] of this.l828Ring) if (name >= 0 && this.ringOlder(name + 1, this.lineAtOf(x), up, ep) && this.TICK - at <= K.RELAY_TTL) { up = name + 1; ep = this.lineAtOf(x); }   // L8.52: lower = older
      for (const [r, v] of this.c7Vouch) { if (r < 0) continue; let ve = -1; { const x = this.c7VouchEp.get(r); if (x !== undefined) ve = x[0]; } if (!this.ringOlder(r + 1, ve, up, ep)) continue; for (const at of v.values()) if (this.TICK - at <= K.RELAY_TTL) { up = r + 1; ep = ve; break; } }
      this.l851Up = up; this.l851Ep = ep; this.l851At = this.TICK;
    },

    // C++: mesh_island.inc:Seat::l851Moves   [true: this HOME or chair is from a ring that moves too]
    l851Moves(m) {
      if (!roomTerm(this, 1) || this.l851Up < 0 || this.TICK - this.l851At >= K.RELAY_TTL || m.c7Min < 0 || this.ringOlder(m.c7Min, m.lineAt, this.l851Up, this.l851Ep)) return false;
      this.trace('L8.5.1-REFUSE', this.id, null, 'from=%d owner=%d ring=%d up=%d', m.from, m.owner, m.c7Min, this.l851Up); return true;
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
    c7Yield(rmin, why = 'C7-merge', toward = -1) {
      if (!this.hasCoord || this.state !== 3) return;
      const ol = ownedLinks(this.coord), n = ol.length; const told = new Set();
      const b = newMsg('LEAVE'); b.ck = ckey(this.coord); b.id = this.id; b.c7 = true; b.c7Min = rmin;
      const tell = (x) => { if (x >= 0 && x !== this.id && !told.has(x)) { told.add(x); this.emit(x, msg.clone(b)); } };
      for (let q = 0; q < n; q++) tell(this.occGet(ckey(ol[q])));
      tell(this.occGet(ckey(down(this.coord))));
      tell(this.ownerId());
      if (roomTerm(this, 1)) for (const x of this.l842Join) tell(x);   // L8.5.6: the ring I join hears my goodbye too
      this.c7Old.clear(); for (const v of this.occ.values()) if (v >= 0 && v !== this.id && !this.l842Join.has(v)) this.c7Old.add(v); this.c7At = this.TICK;
      if (toward >= 0) this.l851Note(toward + 1, this.c7TowardEp); else this.l851Note(rmin, this.lineAt);   // L8.5.1
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
      let n = 0, fresh = false;
      while (n < k && this.l16Next < this.l16List.length) {
        const first = (this.l16Next === 0); const g = this.l16List[this.l16Next++];
        if (!this.l16Ask.includes(g)) { this.l16Ask.push(g); fresh = true; }
        const w = newMsg('WHOHOME'); w.from = this.id; w.ttl = 60; if (first && !this.oldCell) w.l31 = 1; this.emit(g, w); this.l33NoSockAsk(g); this.l3115Knock(g); n++;
      }
      if (n > 0 && this.gateway < 0) this.gateway = this.l16List[0];
      this.l16WaveAt = this.TICK; if (fresh || this.l16FreshAt < 0) this.l16FreshAt = this.TICK;   // L16.14: the wave clock paces waves; the island's silence clock restarts only on a wave that asks a greeter not yet asked this round (C++: mesh_island.inc:l16Wave)
      this.state = 1; this.retryAt = this.TICK; if (this.islandAskAt < 0) this.islandAskAt = this.TICK;
    },

    // C++: mesh_island.inc:Seat::l16WaveTick
    l16WaveTick() {
      const lv = this.w.lv;
      if (!this.f.fabricDoors() || this.state !== 1 || this.l16WaveAt < 0 || this.l16Next >= this.l16List.length || this.islandAskAt < 0 || this.lastReach >= this.islandAskAt) return false;
      if (this.l8471()) { this.l16Wave(this.l16List.length); return true; }   // L8.47.1 with L4.1.1: my probe's verdict landed while a wave was out: everyone left, now
      if (this.TICK - this.l16WaveAt < K.L16_WAVE) { if (lv.L16HEDGE > 0 && !this.l16Hedged && this.TICK - this.l16WaveAt >= lv.L16HEDGE && this.l16Busy.length === 0) { const at = this.l16WaveAt; this.l16Wave(1); this.l16WaveAt = at; this.l16Hedged = true; return true; } return false; }   // L16.14.1: a hedge that asks a never-asked greeter restarts the island's silence clock (l16Wave does it on a fresh name)
      this.l16Wave(this.l16List.length); return true;
    },

    // C++: mesh_island.inc:Seat::l16Gateway
    l16Gateway(g, t) {
      this.l16GwClosed = false;
      for (const x of this.l16Ask) if (x !== g && x !== t) { this.f.fabricDoorDrop(this.id, x); this.doorAsk.delete(x); }
      this.l16Ask.length = 0; this.l16Busy.length = 0; this.l16Last = -1; this.l16List.length = 0; this.l16Next = 0; this.l16WaveAt = -1; this.l16FreshAt = -1; this.l16Round = 0; this.l16Saw = false;
    },

    // C++: mesh_island.inc:Seat::l16Backoff
    l16Backoff(why) {
      let w = this.w.lv.L16BO_BASE << Math.min(this.l16Round, 8); if (w > this.w.lv.L16BO_CAP) w = this.w.lv.L16BO_CAP; if (this.l16Round < 8) this.l16Round++;
      let d = Math.trunc(this.rng() * (w + 1)); if (d < 1) d = 1;
      for (const x of this.l16Ask) this.f.fabricDoorDrop(this.id, x);
      this.l16Anch = false; this.l16Ho = -1; this.l16Until = this.TICK + d; this.state = 0; this.islandAskAt = -1; this.gateway = -1; this.l16Ask.length = 0; this.l16Busy.length = 0; this.l16Last = -1; this.l16List.length = 0; this.l16Next = 0; this.l16WaveAt = -1; this.l16FreshAt = -1; this.f.fabricNoteBackoff(this.id);
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
