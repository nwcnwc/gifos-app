/*
 * e2fold.js: L48 (e2fold), seat side (C++: mesh_e2fold.inc). While a row's E1 is down, the row's digest rides up over
 * E2 to the backup owner, which folds it into what a person is shown, so the room still hears the row; a fold that sees
 * the same row twice (the owner's copy and the copy over E2) keeps only the newest. Each Dig carries the rows it folded
 * (Dig.rows, a DRow each): e2=0 the owner's copy, 1 a copy over E2, 2 a resolved winner (named only, for G4).
 * Free functions (l48Row, l48AddE2, l48Drop, l48Sub, l48Newer, l48Resolve, l48Echo) are exported; the two seat methods
 * (l48SiFold, l48Up) are added to the Seat. The hooks live where the sim has them (digest.js rollup / rootFold /
 * upRefuted / digForget1, live.js PHONE, recv-seated.js onPong / onU2, tick.js up2Tick, entry.js take).
 *
 * L48_OFF (the sim's build-time switch, -DL48_OFF=1: the parent's laws, byte for byte) is the environment variable
 * MESH_L48_OFF=1 under node, read once at load; a page always runs the law.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const dig = req('./dig.js', 'meshDig');
  // roles.js and shared.js load after this file on the page (run.html): read them at call time
  const roles = { ownerOf: (r) => req('./roles.js', 'meshRoles').ownerOf(r), backupOwnerOf: (r, o) => req('./roles.js', 'meshRoles').backupOwnerOf(r, o), standbyOf: (r, o) => req('./roles.js', 'meshRoles').standbyOf(r, o) };
  const coordStr = (c) => req('./shared.js', 'meshShared').coordStr(c);
  const K = C_.consts;
  const { ckey, unckey } = topo;
  const C = topo.C;
  const { K_HAND, K_STAGE, K_APP, digSeats, digLeasedIn, listMerge, talkMerge, leEq } = dig;

  // the sim's #define L48_OFF in mesh_e2fold.inc (a build-time switch)
  const L48_OFF = (isNode && typeof process !== 'undefined' && process.env && process.env.MESH_L48_OFF === '1') ? 1 : 0;

  // C++: mesh_e2fold.inc:l48Row
  function l48Row(s, k, asLeased, ag, e2) {
    const r = msg.newDRow(); r.k = k; r.at = s.at; r.by = s.by; r.ag = ag < 0 ? 0 : ag; r.e2 = e2;
    const seats = digSeats(s);
    if (asLeased) { r.n = 0; r.leased = seats; } else { r.n = s.n; r.leased = digLeasedIn(s); }
    r.handN = Math.min(s.handN, seats); r.hands = s.hands.map(dig.cloneLE); r.stage = s.stage.map(dig.cloneLE); r.apps = s.apps.map(dig.cloneLE); r.talk = s.talk.map(dig.cloneLE);
    return r;
  }
  // C++: mesh_e2fold.inc:l48AddE2
  // The backup owner's display fold of a row it serves over E2.
  function l48AddE2(d, s) {
    const seats = digSeats(s); d.leased += seats; d.handN += Math.min(s.handN, seats);
    listMerge(d.hands, s.hands, K_HAND, true); listMerge(d.stage, s.stage, K_STAGE, true); listMerge(d.apps, s.apps, K_APP, false); talkMerge(d.talk, s.talk);
  }
  // C++: mesh_e2fold.inc:l48Drop
  function l48Drop(v, gone) {
    if (!gone.length || !v.length) return;
    const out = []; for (const e of v) { let g = false; for (const x of gone) if (leEq(x, e)) { g = true; break; } if (!g) out.push(e); }
    v.length = 0; for (const e of out) v.push(e);
  }
  // C++: mesh_e2fold.inc:l48Sub
  // Take an older copy of a row back out of the input that carried it.
  function l48Sub(d, r) {
    d.leased -= r.n + r.leased; d.handN -= r.handN; if (d.handN < 0) d.handN = 0;
    l48Drop(d.hands, r.hands); l48Drop(d.stage, r.stage); l48Drop(d.apps, r.apps); l48Drop(d.talk, r.talk);
  }
  // C++: mesh_e2fold.inc:l48MayCarry
  // Who may carry a copy of row k into a fold (the folder's own view, occ): an owner's copy (e2=0) only a seat whose report
  // covers the row (its owner, or a row head or owner further up that chain); a copy over E2 (e2=1) only the row's backup
  // owner or its standby. Any other copy takes no part (a forger moves only its own report).
  function l48MayCarry(c, k, e2, occ) {
    const row = unckey(k); if (row.i !== 0 || row.pc === 0) return false;
    if (e2 === 1) { const b = roles.backupOwnerOf(row, occ); if (b && ckey(b) === c) return true; const s = roles.standbyOf(row, occ); return !!s && ckey(s) === c; }
    let x = roles.ownerOf(row); if (!x) return false;
    for (let g = 0; g < 64; g++) {
      if (ckey(x) === c) return true; if (x.pc === 0) return false;
      const h = { pc: x.pc, r: x.r, i: 0 }; if (ckey(h) === c) return true; x = roles.ownerOf(h); if (!x) return false;
    }
    return false;
  }
  // C++: mesh_e2fold.inc:l48Newer
  function l48Newer(a, aa, b, ab) {
    if (a.by >= 0 && a.by === b.by) { if (a.at !== b.at) return a.at > b.at; }
    else if (aa + a.ag !== ab + b.ag) return aa + a.ag < ab + b.ag;
    return a.e2 === 0 && b.e2 !== 0;   // a tie keeps the owner's copy
  }
  // C++: mesh_e2fold.inc:l48Resolve
  // in: [{ d, age0, ck }] (C++ L48In: an input of a fold, its age on the folder's clock, the cell it came from). Resolve the
  // rows of one fold's inputs; runs only when an E2 copy an entitled carrier brought is among them. occ: the folder's view.
  function l48Resolve(inp, won, occ) {
    if (L48_OFF) return;
    let any = false; for (const x of inp) { for (const r of x.d.rows) if (r.e2 === 1 && l48MayCarry(x.ck, r.k, r.e2, occ)) { any = true; break; } if (any) break; }
    if (!any) return;
    const g = new Map();
    for (let i = 0; i < inp.length; i++) for (let j = 0; j < inp[i].d.rows.length; j++) { const rr = inp[i].d.rows[j]; if (rr.e2 === 2 || !l48MayCarry(inp[i].ck, rr.k, rr.e2, occ)) continue; let a = g.get(rr.k); if (a === undefined) { a = []; g.set(rr.k, a); } a.push([i, j]); }
    for (const v of g.values()) {
      if (v.length < 2) continue;
      let e2 = false; for (const p of v) if (inp[p[0]].d.rows[p[1]].e2 === 1) e2 = true; if (!e2) continue;
      let b = 0; for (let q = 1; q < v.length; q++) { const x = inp[v[q][0]].d.rows[v[q][1]], y = inp[v[b][0]].d.rows[v[b][1]]; if (l48Newer(x, inp[v[q][0]].age0, y, inp[v[b][0]].age0)) b = q; }
      const w = msg.newDRow(); { const y = inp[v[b][0]].d.rows[v[b][1]]; w.k = y.k; w.at = y.at; w.by = y.by; w.e2 = 2; }
      for (let q = 0; q < v.length; q++) if (q !== b) { const r = dig.cloneDRow(inp[v[q][0]].d.rows[v[q][1]]); l48Sub(inp[v[q][0]].d, r); }
      won.push(w);
    }
  }
  // C++: mesh_e2fold.inc:l48Echo
  // G4 with L48: an author's copy of a row the fold replaced by a newer one is not its contribution any more.
  function l48Echo(pub, echo) {
    if (L48_OFF || !echo.rows.length || !pub.rows.length) return echo;
    let any = false; const tmp = dig.cloneDig(echo);
    for (const x of echo.rows) { if (x.e2 === 2) continue; for (const w of pub.rows) if (w.e2 === 2 && w.k === x.k && !(w.by === x.by && w.at === x.at)) { l48Sub(tmp, x); any = true; break; } }
    return any ? tmp : echo;
  }

  Seat.unit('mesh_e2fold.inc', {
    // C++: mesh_e2fold.inc:Seat::l48SiFold
    // The stand-in fold (a heir whose head is gone, no longer naming it): my own report and my row-mates', each as its
    // stand-in PHONE brought it (dgSi), folded as the head folds its row. It rides the U2BEAT to the backup owner.
    l48SiFold() {
      if (this.myDig.at < 0) return msg.newDig();
      const r = dig.cloneDig(this.myDig); r.at = this.LT(); r.rx = r.at; r.by = this.id; r.rows.length = 0;
      for (let j = 1; j < C; j++) {
        if (j === this.coord.i) continue;
        const rk = ckey({ pc: this.coord.pc, r: this.coord.r, i: j }); const it = this.siKids.get(rk);
        if (it !== undefined && this.LT() - it.rx <= K.DIG_TTL && this.occGet(rk) === it.by) dig.digFold(r, it);
        else if (it !== undefined && this.digHeld(rk, it)) { if (this.scopeGap(rk)) { r.part = 1; r.refuse += 1; } dig.digFoldHeld(r, it); }
        else if (this.scopeGap(rk)) { r.part = 1; r.refuse += 1; }
      }
      dig.digTrim(r); return this.wireDig(r);
    },
    // C++: mesh_e2fold.inc:Seat::l48Up
    // My own report's rows (the child row I fold, a lone child row's carried rows, the rows I serve over E2).
    l48Up(d, dk, how) {
      if (L48_OFF) return;
      if (how) {
        const ag = this.LT() - this.downDig.rx; d.rows.push(l48Row(this.downDig, dk, how === 2, ag, 0));
        for (const r of this.downDig.rows) if (r.e2 !== 2) { const c = dig.cloneDRow(r); c.ag += (ag < 0 ? 0 : ag); d.rows.push(c); }
      }
      let ne = 0;
      for (const [k, u] of this.u2Rows) {
        if (u.heir < 0 || u.dig.at < 0 || u.dig.rx < 0 || this.TICK - u.at > K.L48_BEAT || this.LT() - u.dig.rx > K.LEASE_T) continue;
        if (ne >= K.L48_E2MAX) break; ne++;
        const rk = Math.floor(k / 2);   // k: ckey*2 + variant flag (< 2^49)
        l48AddE2(d, u.dig); d.rows.push(l48Row(u.dig, rk, true, this.LT() - u.dig.rx, 1)); this.trace('L48-E2', this.id, this.coord, 'row=%s seats=%d by=%d age=%lld', coordStr({ pc: Math.floor(rk / 256), r: rk % 256, i: 0 }), digSeats(u.dig), u.dig.by, this.LT() - u.dig.rx);
      }
      const lv = this.w.lv;
      if (this.id === lv.L48_FORGER) { const f = msg.newDRow(); f.k = lv.L48_FORGE_K; f.at = 1000000000; f.by = lv.L48_FORGE_BY; f.e2 = 1; d.rows.push(f); }   // e2cut forge: a copy over E2 of a row I do not serve, stamped newest
    },
  });

  const api = Object.freeze({ L48_OFF, l48Row, l48AddE2, l48Drop, l48Sub, l48MayCarry, l48Newer, l48Resolve, l48Echo });
  GifOS.meshE2fold = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
