'use strict';
/*
 * runop.js: runOp (port plan H3), the one service op the sim's stdin loop and --script both dispatch to: a
 * line-for-line port of the sim's mesh.cpp `runOp`, for every verb in the simq corpus. Harness code, never
 * shipped.
 *
 *   const ops = createOps(fab, { out });   // out(text): where stdout goes
 *   ops.runOp(['state'])                   // -> true; false after quit
 *
 * Output goes through fab.printf (C printf: cprintf.js). The verbs that live in another unit are reached through
 * fab.X, the fabric's table of externals (fabric.js): a verb whose unit is not plugged throws "not wired" (the
 * unit is another job: link / net / time / friend-hop / instant-join / media / realcheck levers), and a verb of
 * the sim that this port leaves out on purpose throws "not ported" (see NOT_PORTED). The sim's own answer to a
 * verb it does not know ("ERR unknown: <op>") is kept: lawoff, lawon, l2variant, darklaws and l28stat are such
 * verbs in the corpus.
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const C_ = require(path.join(M, 'consts.js'));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const dig = require(path.join(M, 'dig.js'));
const hash = require(path.join(M, 'hash.js'));
const { sprintf } = require('./cprintf.js');

const K = C_.consts, E = C_.enums;
const { ckey, unckey, ownedLinks, childPath, parentPath, pcDepth, up, down, rowMates, C } = topo;
const { LS_OPEN, LK_OPEN, TIER_MOBILE, TIER_DESKTOP } = E;
const STATE_NAMES = ['joining', 'asking', 'searching', 'seated'];

// C atoi / atoll / atof / strtoul on a token
const atoi = (s) => { const v = parseInt(s, 10); return Number.isNaN(v) ? 0 : (v | 0); };
const atoll = (s) => { const v = parseInt(s, 10); return Number.isNaN(v) ? 0 : v; };
const atof = (s) => { const v = parseFloat(s); return Number.isNaN(v) ? 0 : v; };
const strtoul = (s) => { const v = parseInt(s, 10); return Number.isNaN(v) ? 0 : (v >>> 0); };
const cp = (c) => ({ pc: c.pc, r: c.r, i: c.i });

// The verbs of the sim this port leaves out: measurement readers outside the corpus that need a model nobody
// ported (the subnet / media-path / descent instruments) or a link table (doors). Each is listed here so a
// stream that uses one fails loudly rather than printing a wrong line.
const NOT_PORTED = new Set(['subnets', 'medialocal', 'pairs', 'stalehints', 'holex', 'digtab', 'seatparts', 'joinphase', 'digtop', 'doorshow', 'doorstat', 'doorwatch']);
// Verbs that reach a unit another job ports (through fab.X). Kept as data so the corpus scan can name them.
const EXTERNAL_VERBS = {
  link: 'linkLever', keep: 'keepLever', linkset: 'linksetLever', radio: 'radioLever', l18: 'l18Lever', feedcase: 'feedCase',
  ijmeasure: 'ijLever', ijstat: 'ijLever', ijforge: 'ijLever', ijvia: 'ijLever', fhop: 'fhopLever', fhstat: 'fhopLever', l30stat: 'l30Stat',
  netgroups: 'netLever', island: 'netLever', netjoin: 'netLever', netmove: 'netLever', netcut: 'netLever', netlift: 'netLever', relaystat: 'netLever', islands: 'netLever', netfind: 'netLever',
  freeze: 'timeLever', tickslow: 'timeLever', hide: 'timeLever', reload: 'timeLever', reloadnew: 'timeLever', twocells: 'timeLever', resume: 'timeLever', doordark: 'timeLever', verdicts: 'timeLever', linked: 'timeLever', allsee: 'timeLever',
};

class NotPorted extends Error { constructor(op, why) { super('mesh runOp: ' + op + ' ' + (why || 'is not ported')); this.notPorted = true; this.op = op; } }

function createOps(fab, opts) {
  opts = opts || {};
  const lv = fab.lv, seats = fab.seats, alive = fab.alive, w = fab.w, X = fab.X;
  let outBuf = [];
  const out = opts.out || ((s) => process.stdout.write(s));
  fab.sprintf = sprintf;
  fab.printf = (f, ...a) => { out(sprintf(f, ...a)); };
  const P = fab.printf;
  const TICK = () => w.TICK;
  const coordStr = fab.coordStr;
  const grnd = fab.grnd;
  const ext = (name) => { const f = X[name]; if (typeof f !== 'function') throw new Error('mesh fabric: ' + name + ' is not wired (plug it with fab.plug)'); return f; };
  const E_ = (name, ...a) => ext(name)(...a);
  const isFrozen = fab.isFrozen;
  const pairKey = fab.pairKey;

  // The externals the ops, hostile and lguard call that no unit of this port provides (levers of the link / net / time /
  // friend-hop / instant-join units, the media model, the link tables, realcheck): an unplugged one throws "not wired".
  if (fab.link) fab.plug({ linkDark: fab.link.linkDark, linkSever: fab.link.linkSever, lEnd: fab.link.lEnd, pcBudget: fab.link.pcBudget, linkGet: fab.link.linkGet, linkFind: fab.link.linkFind, lEnsure: fab.link.lEnsure });
  for (const n of ['linkLever', 'keepLever', 'linksetLever', 'radioLever', 'l18Lever', 'feedCase', 'ijLever', 'fhopLever', 'l30Stat', 'netLever', 'timeLever',
    'mgapOn', 'mgapReport', 'mgapSeats', 'mediaSetup', 'mediaReset', 'mediaReport', 'mstage', 'mstageClear', 'mstagePush', 'mfeeds', 'mBuildCells', 'mcell', 'mAt', 'mOcc', 'mFlow', 'mCarry', 'mHash',
    'pcsReport', 'pcsPeakRead', 'pcsPeakReset', 'pcsPeakClass', 'rcVerb', 'lEnsure', 'linkPeers', 'linkDark', 'linkSever', 'linkGet', 'startDial', 'l23Refused', 'lEnd', 'pcBudget', 'fabricToken'])
    if (!(n in X)) X[n] = () => { throw new Error('mesh fabric: ' + n + ' is not wired (plug it with fab.plug)'); };

  // the fabric-side units that sit beside the ops (each plugs its functions into fab.X)
  require('./tierfab.js').install(fab);
  require('./ring_fab.js').install(fab);
  require('./hostile.js').install(fab);
  require('./lguard.js').install(fab);
  if (fab.link && fab.time && fab.net) require('./levers.js').install(fab);   // the printing levers need the link and time units (installed by the caller: main.js)

  // "<path>/<r>.<i>" -> a Coord, or null (the C++ find / dark / killat idiom)
  function parseCell(a) {
    const sl = a.indexOf('/'); const dt = sl < 0 ? -1 : a.indexOf('.', sl);
    if (sl < 0 || dt < 0) return null;
    let pc = 0; for (const ch of a.slice(0, sl)) pc = childPath(pc, ch.charCodeAt(0) - 48);
    return { pc, r: atoi(a.slice(sl + 1, dt)), i: atoi(a.slice(dt + 1)) };
  }
  // the live seat sitting at a cell (the first by id), or -1
  function seatAt(c, seatedOnly) {
    const k = ckey(c);
    for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].hasCoord && (!seatedOnly || seats[q].state === 3) && ckey(seats[q].coord) === k) return q;
    return -1;
  }
  const doTicks = (n) => { for (let q = 0; q < n; q++) { fab.doTick(); w.TICK++; } };
  const liveSeat = (id) => id >= 0 && id < lv.nextId && alive[id];
  const ownerCoordOf = (c) => (c.pc === 0 ? null : up({ pc: c.pc, r: c.r, i: 0 }));   // C++: mesh_seat.inc:ownerCoordOf
  const idsStr = (v) => (v.length ? v.join(',') : '-');
  const spawnSeat = (evilDoor) => {   // seats[id]=new Seat(id) ...
    const id = lv.nextId++;
    while (seats.length <= id) { seats.push(null); alive.push(0); }
    return id;
  };
  const { Seat } = require(path.join(M, 'seat.js'));

  // the verbs: each is `function (tk)` and returns false only to stop (quit). Order is the C++ chain's; a verb
  // appears once, and the chain's conditional heads (`media` with and without arguments, `lie` tier|nat) are
  // inside their entries.
  const V = Object.create(null);

  // C++: mesh.cpp:runOp (quit)
  V.quit = V.exit = () => { P('BYE\n'); return false; };
  // C++: mesh.cpp:runOp (seed)
  V.seed = (tk) => { lv.SEED0 = tk.length > 1 ? strtoul(tk[1]) : 20260714; lv.GSEED = lv.SEED0; P('OK seed=%u\n', lv.SEED0); };
  // C++: mesh.cpp:runOp (init)
  V.init = (tk) => {
    const n = tk.length > 1 ? atoi(tk[1]) : 10000, lvl = tk.length > 2 ? atof(tk[2]) : 0; fab.initSim(n, lvl);
    P('OK init N=%d leave=%.2f seed=%u join=%s(%d,%d) window=%d\n', n, lvl, lv.SEED0, fab.JOINMODE, lv.JM_A, lv.JM_B, lv.joinWindow);
  };
  // joinmode <window W|burst|batch K E|serial E> — the ARRIVAL PATTERN for the next init
  // C++: mesh.cpp:runOp (joinmode)
  V.joinmode = (tk) => {
    fab.JOINMODE = tk.length > 1 ? tk[1] : 'window'; lv.JM_A = tk.length > 2 ? atoi(tk[2]) : 0; lv.JM_B = tk.length > 3 ? atoi(tk[3]) : 0;
    P('OK joinmode %s a=%d b=%d\n', fab.JOINMODE, lv.JM_A, lv.JM_B);
  };
  // TOTAL NETWORK PARTITION: cut every link between two live seat-groups, all seats stay ALIVE. `split [fracB]`
  // C++: mesh.cpp:runOp (split)
  V.split = (tk) => {
    const fb = tk.length > 1 ? atof(tk[1]) : 0.5; fab.partSide.length = 0; for (let q = 0; q < lv.nextId; q++) fab.partSide.push(0);
    let liveN = 0, bN = 0;
    for (let q = 0; q < lv.nextId; q++) if (alive[q]) { liveN++; if (grnd() < fb) { fab.partSide[q] = 1; bN++; } }
    lv.PARTITIONED = true; P('OK split: sideA=%d sideB=%d (all alive, cross-links cut)\n', liveN - bN, bN);
  };
  // C++: mesh.cpp:runOp (heal_net, join_net)
  V.heal_net = V.join_net = () => { lv.PARTITIONED = false; P('OK partition removed (links restored)\n'); };
  // per-side convergence: seated / distinct Section-1 cells / duplicates, on each side of the cut
  // C++: mesh.cpp:runOp (splitstate)
  V.splitstate = () => {
    let seatA = 0, seatB = 0; const s1A = new Set(), s1B = new Set(), allA = new Set(), allB = new Set(); let dupA = 0, dupB = 0;
    for (let q = 0; q < lv.nextId; q++) {
      if (!alive[q] || seats[q].state !== 3) continue; const s = (q < fab.partSide.length) ? fab.partSide[q] : 0; const k = ckey(seats[q].coord);
      if (s === 0) { seatA++; if (allA.has(k)) dupA++; else allA.add(k); if (seats[q].coord.pc === 0) s1A.add(k); }
      else { seatB++; if (allB.has(k)) dupB++; else allB.add(k); if (seats[q].coord.pc === 0) s1B.add(k); }
    }
    let liveA = 0, liveB = 0, strA = 0, strB = 0;   // count live seats + stranded per side (denominator)
    for (let q = 0; q < lv.nextId; q++) if (alive[q]) { const s = (q < fab.partSide.length) ? fab.partSide[q] : 0; if (s === 0) { liveA++; if (seats[q].stranded) strA++; } else { liveB++; if (seats[q].stranded) strB++; } }
    P('SPLITSTATE A[seated=%lld/%lld s1=%zu dups=%lld strand=%lld] B[seated=%lld/%lld s1=%zu dups=%lld strand=%lld]\n', seatA, liveA, s1A.size, dupA, strA, seatB, liveB, s1B.size, dupB, strB);
  };
  // LOUD invariant assertion: everyone seated, Section 1 full, 0 dups, 0 stranded. `check strict` ABORTS on failure.
  // C++: mesh.cpp:runOp (check)
  V.check = (tk) => {
    const strict = tk.length > 1 && tk[1] === 'strict';
    const { seated, s1c } = fab.counts(); let strand = 0; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].stranded) strand++;
    // T (amended law): a TRANSIT hold is legal, an EXPIRED one is not — no live seat may still carry a claim/seek/lease past its self-expiry window.
    let transStale = 0;
    for (let q = 0; q < lv.nextId; q++) if (alive[q]) {
      const s = seats[q]; const now = TICK() - s.clkHeld;   // its stamps are on its own clock
      if (s.moving && now - s.moveAt > K.CONFIRM_TTL * 2 + 8) transStale++;
      if (s.leaseUntil >= 0 && now > s.leaseUntil + 8) transStale++;
    }
    let why = '';
    if (seated !== lv.N) why += ' seated=' + seated + '/' + lv.N;
    if (s1c !== Math.min(C * C, lv.N)) why += ' s1=' + s1c + '/' + (C * C);
    if (lv.DUPS_G !== 0) why += ' dups=' + lv.DUPS_G;
    if (strand !== 0) why += ' stranded=' + strand;
    if (lv.EMIT_TELEPORT !== 0) why += ' teleport=' + lv.EMIT_TELEPORT;
    if (transStale !== 0) why += ' transitStale=' + transStale;
    if (!why) P('CHECK PASS seed=%u [seated=%lld/%d s1=%lld dups=%lld stranded=0 teleport=0]\n', lv.SEED0, seated, lv.N, s1c, lv.DUPS_G);
    else {
      P('CHECK FAIL seed=%u%s\n', lv.SEED0, why);
      if (strict) { process.stderr.write(sprintf('CHECK FAIL (strict) seed=%u%s — HALTING\n', lv.SEED0, why)); throw new Error('abort: CHECK FAIL (strict)'); }
    }
  };
  // C++: mesh.cpp:runOp (tick)
  V.tick = (tk) => { const n = tk.length > 1 ? atoi(tk[1]) : 1; doTicks(n); P('OK tick now=%lld\n', TICK()); };
  // C++: mesh.cpp:runOp (threads)
  V.threads = (tk) => { const t = tk.length > 1 ? Math.max(1, atoi(tk[1])) : 1; lv.NTHREADS = t; P('OK threads=%d det=%d\n', lv.NTHREADS, 1); };   // the threaded tick is always deterministic (mesh_par.inc)
  // C++: mesh.cpp:runOp (det)
  V.det = () => { P('OK det=1\n'); };
  // net loss=.. lat=.. sever=.. subnets=.. density=.. qual=..   (set BEFORE init)
  // C++: mesh.cpp:runOp (net)
  V.net = (tk) => {
    for (let z = 1; z < tk.length; z++) {
      const t = tk[z]; const e = t.indexOf('='); if (e < 0) continue; const k = t.slice(0, e); const v = atof(t.slice(e + 1));
      if (k === 'loss') lv.NET_LOSS = v; else if (k === 'lat') lv.NET_LAT = Math.trunc(v); else if (k === 'sever') lv.NET_SEVER = v;
      else if (k === 'subnets') lv.NUM_SUBNETS = Math.max(1, Math.trunc(v)); else if (k === 'density') lv.REACH_DENSITY = v; else if (k === 'qual') lv.NET_QUAL_MIN = v;
      else if (k === 'spine') lv.NET_SPINE = Math.trunc(v); else if (k === 'relayk') lv.RELAY_K = Math.trunc(v);
      else if (k === 'skew') lv.NET_SKEW = Math.max(0, Math.trunc(v)); else if (k === 'clkoff') lv.CLK_OFF = Math.max(0, Math.trunc(v));
    }
    P('OK net loss=%.4f lat=%d sever=%.4f subnets=%d density=%.2f qual=%.2f spine=%d relayk=%d skew=%d\n', lv.NET_LOSS, lv.NET_LAT, lv.NET_SEVER, lv.NUM_SUBNETS, lv.REACH_DENSITY, lv.NET_QUAL_MIN, lv.NET_SPINE, lv.RELAY_K, lv.NET_SKEW);
  };
  // anchors <hseed> <blockedPct> [room] [nocap] — TURN anchor fan-in (gifos-app js/meet-turn.js; mesh.js twin: test/mesh/anchor-fanin-ladder.js).
  // C++: mesh.cpp:runOp (anchors)
  V.anchors = (tk) => {
    const hs = tk.length > 1 ? (atoll(tk[1]) >>> 0) : 0; const pct = tk.length > 2 ? atoi(tk[2]) : 30;
    let room = false, nocap = false; for (let z = 3; z < tk.length; z++) { if (tk[z] === 'room') room = true; if (tk[z] === 'nocap') nocap = true; }
    const MAX_SERVED = 9;
    const at = new Map(); const ids = []; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3) { at.set(ckey(seats[q].coord), q); ids.push(q); }
    const blockedAt = (c) => { const k = c.pc + '_' + c.r + '_' + c.i; let h = (2166136261 ^ hs) >>> 0; for (let z = 0; z < k.length; z++) h = Math.imul((h ^ k.charCodeAt(z)) >>> 0, 16777619) >>> 0; return (h % 100) < pct; };
    const lk = new Map();
    for (const q of ids) {
      const ol = ownedLinks(seats[q].coord); const u = new Set();
      for (const c of ol) { const t = at.get(ckey(c)); if (t !== undefined && t !== q) u.add(t); }
      const o = ownerCoordOf(seats[q].coord); if (o) { const t = at.get(ckey(o)); if (t !== undefined && t !== q) u.add(t); }
      lk.set(q, [...u]);
    }
    const blocked = new Set(); for (const q of ids) if (blockedAt(seats[q].coord)) blocked.add(q);
    const clients = [...blocked]; clients.sort((a, b) => a - b);
    const served = new Map(); let uncovered = 0;
    for (const cid of clients) {
      let pool; if (room) { pool = []; for (const q of ids) if (q !== cid) pool.push(q); } else pool = lk.get(cid);
      const refused = new Set();
      for (;;) {
        let best = -1;
        for (const x of pool) {
          if (refused.has(x)) continue; if (best < 0) { best = x; continue; }
          const rx = blocked.has(x) ? 1 : 0, rb = blocked.has(best) ? 1 : 0; const lx = lk.get(x).length, lb = lk.get(best).length;
          if (rx < rb || (rx === rb && (lx > lb || (lx === lb && x < best)))) best = x;
        }
        if (best < 0) { uncovered++; break; }
        const n = served.get(best) || 0; if (nocap || n < MAX_SERVED) { served.set(best, n + 1); break; } refused.add(best);
      }
    }
    let maxIn = 0, maxServed = 0, maxLinks = 0, who = { pc: 0, r: 0, i: 0 };
    for (const q of ids) { const l = lk.get(q).length, v = served.get(q) || 0; if (l > maxLinks) maxLinks = l; if (v > maxServed) maxServed = v; if (l + v > maxIn) { maxIn = l + v; who = seats[q].coord; } }
    P('ANCHORS seated=%zu clients=%zu uncovered=%d maxLinks=%d maxServed=%d fanin_max=%d at=%s pool=%s cap=%d\n', ids.length, clients.length, uncovered, maxLinks, maxServed, maxIn, coordStr(who), room ? 'room' : 'links', nocap ? 0 : MAX_SERVED);
  };
  // `media on|off|stage|reset|report` is the feed model; bare `media` is the media-plane report (not ported)
  // C++: mesh.cpp:runOp (media)
  V.media = (tk) => {
    if (tk.length < 2) throw new NotPorted('media', '(bare, the media-plane report) is not ported');
    const wd = tk[1];
    if (wd === 'on') { E_('mediaSetup'); lv.MEDIA = true; P('OK media on (%zu feeds)\n', E_('mfeeds').length); }
    else if (wd === 'off') { lv.MEDIA = false; P('OK media off\n'); }
    else if (wd === 'stage') { const st = E_('mstage'); st.length = 0; for (let z = 2; z < tk.length && st.length < 5; z++) st.push(atoi(tk[z])); if (lv.MEDIA) E_('mediaSetup'); P('OK media stage %zu\n', st.length); }
    else if (wd === 'reset') { E_('mediaReset'); P('OK media reset\n'); }
    else if (wd === 'report') { const r = E_('mediaReport', new Set()); P('MEDIA stage_max=%lld stage_at=%d stage_feed=%d stage_p50=%lld stad_max=%lld stad_at=%d seats=%d\n', r.stMax, r.stAt, r.stFeed, r.stP50, r.sdMax, r.sdAt, r.nSeats); }
    else P('ERR usage: media on|off|stage <id..>|reset|report\n');
  };
  // C++: mesh.cpp:runOp (converge)
  V.converge = (tk) => {
    const cap = tk.length > 1 ? atoll(tk[1]) : lv.MAXP; const t0 = process.hrtime.bigint(); const c = fab.converge(cap);
    let secs = Number(process.hrtime.bigint() - t0) / 1e9; if (lv.NOTIME) secs = 0;
    P('%s converged@%lld tick=%lld %.2fs %.0fk/s\n', c >= 0 ? 'OK' : 'TIMEOUT', c, TICK(), secs, lv.NOTIME ? 0.0 : TICK() / (secs > 0 ? secs : 1) / 1000.0);
  };
  // C++: mesh.cpp:runOp (state)
  V.state = () => {
    const { seated, s1c } = fab.counts(); let busq = 0; for (const [, b] of fab.bus) busq += b.length;
    let strand = 0, ntr = 0, nls = 0;
    for (let q = 0; q < lv.nextId; q++) if (alive[q]) { if (seats[q].stranded) strand++; if (seats[q].moving) ntr++; if (seats[q].leaseUntil >= 0) nls++; }
    P('STATE tick=%lld spawned=%d seated=%lld s1cells=%lld/%d dups=%lld stranded=%d moves=%lld evict=%lld inflight=%zu transit=%d lease=%d\n', TICK(), lv.nextId, seated, s1c, Math.min(C * C, lv.N), lv.DUPS_G, strand, lv.MOVES, lv.EVICTIONS, busq, ntr, nls);
  };
  // C++: mesh.cpp:runOp (seat)
  V.seat = (tk) => {
    const id = tk.length > 1 ? atoi(tk[1]) : -1;
    if (id < 0 || id >= lv.nextId || !alive[id]) { P('ERR no such live seat %d\n', id); return; }
    const s = seats[id]; let nb = '';
    if (s.hasCoord) { for (const c of ownedLinks(s.coord)) { const x = s.occGet(ckey(c)); nb += coordStr(c) + '=' + x + ' '; } }
    P('SEAT %d state=%s coord=%s occ=%zu lastAck=%lld(age %lld) healAt=%lld kids=%d haveRoster=%d rosterSz=%zu joinStart=%d(age %lld) gateway=%d stranded=%d drainAt=%d %s\n',
      id, STATE_NAMES[s.state], s.hasCoord ? coordStr(s.coord) : '-', s.occ.size, s.lastAck, TICK() - s.lastAck, s.healAt, s.hasChildren() ? 1 : 0, s.haveRoster ? 1 : 0, s.roster.length, s.joinStart, TICK() - s.joinStart, s.gateway, s.stranded ? 1 : 0, s.drainAt, nb);
  };
  // find a seat at a given coord path/r/i  e.g. find /0.0
  // C++: mesh.cpp:runOp (find)
  V.find = (tk) => {
    const a = tk.length > 1 ? tk[1] : ''; const c = parseCell(a);
    if (!c) { P('ERR usage: find <path>/<r>.<i>\n'); return; }
    P('FIND %s -> seat %d\n', a, seatAt(c, false));
  };
  // `kill F deep`: only seated seats below Section 1 (I8 gate: churn that leaves the home alone)
  // C++: mesh.cpp:runOp (kill)
  V.kill = (tk) => {
    const frac = tk.length > 1 ? atof(tk[1]) : 0.5; const mode = tk.length > 2 ? tk[2] : '';
    const ids = []; for (let q = 0; q < lv.nextId; q++) if (alive[q] && !(mode === 'deep' && !(seats[q].hasCoord && seats[q].coord.pc !== 0))) ids.push(q);
    const nk = Math.trunc(lv.N * frac); const pick = [];
    { const u = new Set(); while (pick.length < nk && pick.length < ids.length) { const j = Math.trunc(grnd() * ids.length); if (!u.has(j)) { u.add(j); pick.push(ids[j]); } } }
    const ks = new Set(pick);
    if (mode === 's1row') { const rr = Math.trunc(grnd() * C); for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].hasCoord && seats[q].coord.pc === 0 && seats[q].coord.r === rr) ks.add(q); }
    if (mode === 's1all') { for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].hasCoord && seats[q].coord.pc === 0) ks.add(q); }
    if (mode === 'silent' || ((tk.length > 3) && tk[3] === 'silent')) { for (const q of ks) fab.fabricKill(q, -1); }
    else if (mode === 'crash') { for (const q of ks) fab.fabricKill(q, TICK() + K.SOCK_CLOSE_CRASH); for (const q of ks) E_('crashTransport', q); }
    else for (const q of ks) seats[q].leave();
    lv.N -= ks.size; P('OK killed %zu, N now %d\n', ks.size, lv.N);
  };
  // D5: ungraceful SINGLE-seat death — no LEAVE, but the neighbours' transports notice (fireTranslost) ~2-6 ticks later. `crash <id> quiet` = a BLACKHOLE death
  // C++: mesh.cpp:runOp (crash)
  V.crash = (tk) => {
    const id = tk.length > 1 ? atoi(tk[1]) : -1; const quiet = tk.length > 2 && tk[2] === 'quiet';
    if (id < 0 || id >= lv.nextId || !alive[id]) { P('ERR no such live seat %d\n', id); return; }
    fab.fabricKill(id, quiet ? -1 : TICK() + K.SOCK_CLOSE_CRASH); if (!quiet) E_('crashTransport', id); lv.N -= 1; P('OK crashed %d%s, N now %d\n', id, quiet ? ' (quiet)' : '', lv.N);
  };
  // C++: mesh.cpp:runOp (darkstat)
  V.darkstat = () => { let mv = 0; for (let q = 0; q < lv.nextId; q++) if (seats[q]) mv += seats[q].dark6; P('DARKSTAT dark=%d d6moves=%lld laws=%d\n', fab.DARK.size, mv, 1); };
  // C++: mesh.cpp:runOp (sigdedupe)
  V.sigdedupe = (tk) => { lv.SIG_DEDUPE = (tk.length < 2) || (tk[1] !== '0'); P('OK sigdedupe=%d\n', lv.SIG_DEDUPE ? 1 : 0); };
  // C++: mesh.cpp:runOp (l18stat)
  V.l18stat = () => {
    P('L18STAT routed=%lld delivered=%lld hops_mean=%.2f hops_max=%lld hops=', lv.L18_ROUTED, lv.L18_DELIV, lv.L18_DELIV ? lv.L18_HOPS / lv.L18_DELIV : 0.0, lv.L18_HMAX);
    { const HH = fab.link && fab.link.L18_HH; for (let h = 0; h < 9; h++) P('%s%lld', h ? ',' : '', HH ? HH[h] : 0); }   // the table lives on the link physics (pclaws.js S.L18_HH)
    P(' nopath=%lld nodial=%lld skip_direct=%lld skip_friend=%lld skip_mass=%lld\n', lv.L18_NOPATH, lv.L18_NODIAL, lv.L18_SKIPDIRECT, lv.L18_SKIPFRIEND, lv.L18_SKIPMASS);   // L18: frames routed for want of a role, their hops (0..7, 8+), and the cut-off senders that kept the old path
  };
  // C++: mesh.cpp:runOp (mgap)
  V.mgap = (tk) => {
    const wd = tk.length > 1 ? tk[1] : '';
    if (wd === 'on') { E_('mgapOn'); P('OK mgap on\n'); } else if (wd === 'report') E_('mgapReport'); else if (wd === 'seats') { const mn = tk.length > 2 ? atoll(tk[2]) : 1; E_('mgapSeats', mn); } else P('ERR mgap on|report|seats <minTotal>\n');
  };
  // C++: mesh.cpp:runOp (lguard, lgcase)
  V.lguard = V.lgcase = (tk) => { E_('lguardLever', tk); };
  // C++: mesh.cpp:runOp (pcs)
  V.pcs = () => { const [a, b, c, d] = E_('pcsReport'); P('PCS topo_p50=%d topo_max=%d open_p50=%d open_max=%d\n', a, b, c, d); };
  // C++: mesh.cpp:runOp (up2stat)
  V.up2stat = () => { throw new NotPorted('up2stat', '(needs the media cell map) is not ported'); };
  // § G10 / D6: seat <id> (dark) or the seat at <path>/<r>.<i> (darkat) loses EVERY DataChannel for good
  // C++: mesh.cpp:runOp (dark, darkat)
  V.dark = V.darkat = (tk) => {
    const op = tk[0]; let who = -1;
    if (op === 'dark') who = tk.length > 1 ? atoi(tk[1]) : -1;
    else { const c = parseCell(tk.length > 1 ? tk[1] : ''); if (c) who = seatAt(c, false); }
    if (op === 'dark' && who >= 0 && (who >= lv.nextId || !alive[who])) { fab.DARK.add(who); P('OK dark seat %d (not seated yet: no channel of it will ever open)\n', who); }
    else if (who < 0 || who >= lv.nextId || !alive[who]) P('ERR dark needs a live seat\n');
    else if (lv.LINKMODEL) {   // every peer connection of it closes (dc close at both ends); none opens again
      fab.DARK.add(who); const s = seats[who]; E_('lEnsure', who); const nl = E_('linkPeers', who).length; E_('linkDark', who);
      P('OK dark seat %d at %s (%d links close)\n', who, s.hasCoord ? coordStr(s.coord) : '-', nl);
    } else {
      fab.DARK.add(who); const s = seats[who]; let nl = 0;
      if (s.hasCoord) {
        for (const c of ownedLinks(s.coord)) {
          const o = s.occGet(ckey(c)); if (o < 0 || o === who || o >= lv.nextId || !alive[o]) continue; nl++;
          const m1 = msg.newMsg('TRANSLOST'); m1.id = o; m1.to = who; m1.from = -1; m1.hard = true; fab.busPush(TICK() + 2, m1);
          const m2 = msg.newMsg('TRANSLOST'); m2.id = who; m2.to = o; m2.from = -1; m2.hard = true; fab.busPush(TICK() + 2, m2);
        }
      }
      P('OK dark seat %d at %s (%d links observe transport loss)\n', who, s.hasCoord ? coordStr(s.coord) : '-', nl);
    }
  };
  // D5 slow-peer probe: cut ONE link between two LIVE seats for T ticks; both ends observe the transport death
  // C++: mesh.cpp:runOp (sever)
  V.sever = (tk) => {
    const a = tk.length > 1 ? atoi(tk[1]) : -1, b = tk.length > 2 ? atoi(tk[2]) : -1; const t = tk.length > 3 ? atoll(tk[3]) : 120;
    if (a < 0 || b < 0 || a >= lv.nextId || b >= lv.nextId || !alive[a] || !alive[b]) P('ERR sever needs two live seats\n');
    else if (lv.LINKMODEL) { E_('linkSever', a, b, t); P('OK severed %d<->%d for %lld ticks (their link closes; it opens again only when dialled after the path returns)\n', a, b, t); }
    else {
      fab.forcedSever.set(pairKey(a, b), TICK() + t);
      const m1 = msg.newMsg('TRANSLOST'); m1.id = b; m1.to = a; m1.from = -1; m1.hard = true; fab.busPush(TICK() + 2, m1);
      const m2 = msg.newMsg('TRANSLOST'); m2.id = a; m2.to = b; m2.from = -1; m2.hard = true; fab.busPush(TICK() + 2, m2);
      P('OK severed %d<->%d for %lld ticks (both ends observe transport loss)\n', a, b, t);
    }
  };
  // sim plan I2: set before init
  // C++: mesh.cpp:runOp (linkmodel)
  V.linkmodel = (tk) => { const on = tk.length > 1 && tk[1] !== '0'; lv.LINKMODEL = on; P('OK linkmodel=%d\n', lv.LINKMODEL ? 1 : 0); };
  for (const [verb, fn] of Object.entries(EXTERNAL_VERBS)) {
    if (fn === 'netLever') V[verb] = (tk) => { E_('netLever', tk); X.tierRefresh(); };
    else if (fn === 'l30Stat') V[verb] = (tk) => { E_('l30Stat', tk.length > 1 && tk[1] === 'why'); };
    else V[verb] = (tk) => { E_(fn, tk); };
  }
  // C++: mesh.cpp:runOp (lineage)
  V.lineage = () => { X.lineageReport(); };
  // V3 authority probe (repro-sitxfer-auth.sh): sitxfer <to path/r.i> <from path/r.i|self> [ck path/r.i] [id path/r.i]
  // C++: mesh.cpp:runOp (sitxfer)
  V.sitxfer = (tk) => {
    const at = (a) => { const c = parseCell(a); if (!c) return -1; return seatAt(c, true); };
    if (tk.length < 3) { P('ERR usage: sitxfer <to> <from|self> [ck] [id]\n'); return; }
    const to = at(tk[1]); const from = tk[2] === 'self' ? to : at(tk[2]);
    if (to < 0 || from < 0) { P('ERR sitxfer: no seat at %s or %s\n', tk[1], tk[2]); return; }
    const h = seats[to]; let k = ckey(h.coord);
    if (tk.length > 3) { const c = at(tk[3]); if (c < 0) { P('ERR sitxfer: no seat at %s\n', tk[3]); return; } k = ckey(seats[c].coord); }
    let idv = to; if (tk.length > 4) { idv = at(tk[4]); if (idv < 0) { P('ERR sitxfer: no seat at %s\n', tk[4]); return; } }
    h.rowLedger = false;
    const m = msg.newMsg('SITXFER'); m.ck = k; m.id = idv; fab.schedule(from, to, m);
    doTicks(12);
    P('SITXFER to=%d from=%d assigner=%d ck=%s id=%d accepted=%d\n', to, from, h.placer, (k === ckey(h.coord) ? 'own' : 'other'), idv, h.rowLedger ? 1 : 0);
  };
  // C++: mesh.cpp:runOp (contest)   [L40: two heal moves into one cell in one tick (gaps4-fab.js)]
  V.contest = (tk) => { X.g4Contest(tk); };
  // kill the CURRENT occupant of a coord (deterministic scenario tool): killat <path>/<r>.<i> [silent|crash]
  // C++: mesh.cpp:runOp (killat)
  V.killat = (tk) => {
    const a = tk.length > 1 ? tk[1] : ''; const silent = tk.length > 2 && tk[2] === 'silent'; const crash = tk.length > 2 && tk[2] === 'crash';
    const c = parseCell(a); if (!c) { P('ERR usage: killat <path>/<r>.<i> [silent]\n'); return; }
    const who = seatAt(c, false);
    if (who < 0) { P('ERR killat: nobody at %s\n', a); return; }
    if (silent) fab.fabricKill(who, -1); else if (crash) { fab.fabricKill(who, TICK() + K.SOCK_CLOSE_CRASH); E_('crashTransport', who); } else seats[who].leave();   // crash: no LEAVE, its links see the transport die, its relay socket closes a few ticks later
    lv.N--; P('OK killat %s -> killed seat %d (%s), N now %d\n', a, who, silent ? 'silent' : crash ? 'crash' : 'leave', lv.N);
  };
  // C++: mesh.cpp:runOp (losefirst)
  V.losefirst = (tk) => {
    const a = tk.length > 1 ? tk[1] : ''; lv.LOSE_T = a === 'FIND' ? msg.MT_NAMES.indexOf('FIND') : a === 'PLACE' ? msg.MT_NAMES.indexOf('PLACE') : -1; lv.LOSE_NC = tk.length > 2 ? atoi(tk[2]) : -1;
    P('OK losefirst %s seat %d\n', a, lv.LOSE_NC);
  };
  // C++: mesh.cpp:runOp (spawn)
  V.spawn = (tk) => {
    const k = tk.length > 1 ? atoi(tk[1]) : 1; let mf = -1;
    for (let z = 2; z < tk.length; z++) if (tk[z].startsWith('mobile=')) mf = atof(tk[z].slice(7));
    for (let q = 0; q < k; q++) {
      const id = spawnSeat();
      if (mf >= 0) { fab.TIEROVR.set(id, X.lMobHash(id, mf) ? TIER_MOBILE : TIER_DESKTOP); X.tierRefresh(); }
      seats[id] = new Seat(id, w); alive[id] = 1; X.netNoteSpawn(id); seats[id].join();
    }
    lv.N += k; P('OK spawned %d (ids %d..%d), N now %d\n', k, lv.nextId - k, lv.nextId - 1, lv.N);
  };
  // C++: mesh.cpp:runOp (digstale)
  V.digstale = (tk) => {
    const age = tk.length > 1 ? atoll(tk[1]) : 300; let n = 0;
    for (let q = 0; q < lv.nextId; q++) {
      if (!alive[q] || seats[q].state !== 3) continue; const s = seats[q]; if (s.dRoot().at < 0) continue;
      const a = s.LT() - s.dRoot().rx; if (a < age) continue; n++;
      let tc = null; let have = false;
      if (s.hasCoord) { if (s.coord.i !== 0) { tc = { pc: s.coord.pc, r: s.coord.r, i: 0 }; have = true; } else { tc = s.ownerCoord(); have = !!tc; } }
      const tid = have ? s.occGet(ckey(tc)) : -2;
      P('DIGSTALE seat%d coord=%s rootAge=%lld root.n=%d lastAckAge=%lld up=%s upId=%d upAlive=%d upAt=%s fhl=%d seatedAt=%d\n', q, s.hasCoord ? coordStr(s.coord) : '-', a, s.dRoot().n, TICK() - s.lastAck, have ? coordStr(tc) : '-', tid,
        (tid >= 0 && tid < lv.nextId) ? alive[tid] : -1, (tid >= 0 && tid < lv.nextId && alive[tid] && seats[tid].hasCoord) ? coordStr(seats[tid].coord) : '-', have ? (s.firstHandLive(ckey(tc)) ? 1 : 0) : -1, s.seatedAt);
    }
    P('OK digstale n=%d\n', n);
  };
  // C++: mesh.cpp:runOp (where)
  V.where = (tk) => {
    const id = tk.length > 1 ? atoi(tk[1]) : -1;
    if (id < 0 || id >= lv.nextId || !alive[id]) P('WHERE %d dead\n', id);
    else P('WHERE %d state=%d coord=%s\n', id, seats[id].state, seats[id].hasCoord ? coordStr(seats[id].coord) : '-');
  };
  // C++: mesh.cpp:runOp (isactive)
  V.isactive = (tk) => { const id = tk.length > 1 ? atoi(tk[1]) : -1; P('ACTIVE seat%d inActive=%d inNext=%d\n', id, fab.active.has(id) ? 1 : 0, fab.nextActive.has(id) ? 1 : 0); };
  // C++: mesh.cpp:runOp (occ)
  V.occ = (tk) => {
    const id = tk.length > 1 ? atoi(tk[1]) : -1; const a = tk.length > 2 ? tk[2] : '';
    const sl = a.indexOf('/'); const dt = a.indexOf('.', Math.max(sl, 0)); let pc = 0; for (const ch of a.slice(0, sl < 0 ? a.length : sl)) pc = childPath(pc, ch.charCodeAt(0) - 48);
    const r = atoi(a.slice(sl + 1, dt)), i = atoi(a.slice(dt + 1)); const k = ckey({ pc, r, i });
    if (id < 0 || id >= lv.nextId || !alive[id]) { P('ERR\n'); return; }
    const se = seats[id]; const v = se.occGet(k);
    const age = se.s1seen.has(k) ? TICK() - se.s1seen.get(k) : -1, liveAge = se.live.has(k) ? TICK() - se.live.get(k) : -1, holeAge = se.holeSince.has(k) ? TICK() - se.holeSince.get(k) : -1;
    P('OCC seat%d occ[%s]=%d s1seenAge=%d liveAge=%d holeSinceAge=%d fhLive=%d\n', id, a, v, age, liveAge, holeAge, se.firstHandLive(k) ? 1 : 0);
  };
  // C++: mesh.cpp:runOp (hist)
  V.hist = () => {
    const cnt = new Map(); let s1seats = 0;
    for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3) { const k = ckey(seats[q].coord); cnt.set(k, (cnt.get(k) || 0) + 1); if (seats[q].coord.pc === 0) s1seats++; }
    let h1 = 0, h2 = 0, h3 = 0, mx = 0, mxk = 0;
    for (const [k, v] of cnt) { if (v === 1) h1++; else if (v === 2) h2++; else h3++; if (v > mx) { mx = v; mxk = k; } }
    P('HIST cells:1=%d 2=%d 3+=%d maxDup=%d@%s s1seats=%d\n', h1, h2, h3, mx, coordStr(unckey(mxk)), s1seats);
  };
  // C++: mesh.cpp:runOp (relay)
  V.relay = () => {
    let live = 0, s1 = 0;
    for (const [id, until] of fab.relayGreeters) if (until >= TICK() && id < lv.nextId && alive[id]) { live++; if (seats[id].state === 3 && seats[id].coord.pc === 0) s1++; }
    P('RELAY greeters=%zu (live=%d, section1=%d) H(genesisKey)=%llu\n', fab.relayGreeters.size, live, s1, lv.relayGenesisKey);
  };
  // C++: mesh.cpp:runOp (transit)
  V.transit = () => {
    let ntr = 0, nls = 0, ex = '';
    for (let q = 0; q < lv.nextId; q++) if (alive[q]) {
      const s = seats[q];
      if (s.moving) { ntr++; ex += sprintf('%d:move(%s->%s age %lld) ', q, coordStr(s.oldCoord), coordStr(s.coord), TICK() - s.moveAt).slice(0, 95); }
      if (s.leaseUntil >= 0) { nls++; ex += sprintf('%d:lease(%s ttl %lld) ', q, coordStr(unckey(s.leaseCk)), s.leaseUntil - TICK()).slice(0, 95); }
    }
    P('TRANSIT moves=%d leases=%d %s\n', ntr, nls, ex);
  };
  // C++: mesh.cpp:runOp (bad)
  V.bad = () => {
    let cnt = 0, ex = '';
    for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state !== 3) { cnt++; if (cnt <= 8) ex += sprintf('%d(%s) ', q, STATE_NAMES[seats[q].state]); }
    P('BAD unseated=%d %s\n', cnt, ex);
  };
  // C++: mesh.cpp:runOp (dups)
  V.dups = () => {
    const at = new Map(); let d = 0, ex = '';
    for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].hasCoord) {
      const k = ckey(seats[q].coord); const it = at.get(k);
      if (it !== undefined) { d++; if (d <= 8) ex += sprintf('%s:%d,%d ', coordStr(seats[q].coord), it, q); } else at.set(k, q);
    }
    P('DUPS %d %s\n', d, ex);
  };
  // V4 forensics: heal-owed MID-TREE HOLES — an empty owner cell above a live row head.
  // C++: mesh.cpp:runOp (holes)
  V.holes = () => {
    const at = new Map(); for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].hasCoord && seats[q].state === 3) at.set(ckey(seats[q].coord), q);
    let n = 0, ex = '';
    for (let q = 0; q < lv.nextId; q++) {
      if (!(alive[q] && seats[q].hasCoord && seats[q].state === 3)) continue; const s = seats[q]; if (s.coord.pc === 0 || s.coord.i !== 0) continue;
      const o = up(s.coord); if (!o) continue;
      if (!at.has(ckey(o))) { n++; if (n <= 10) ex += sprintf('%s(head=%d)->hole %s  ', coordStr(s.coord), q, coordStr(o)); }
    }
    P('HOLES %d %s\n', n, ex);
  };
  // C++: mesh.cpp:runOp (watch)
  V.watch = (tk) => {
    const id = tk.length > 1 ? atoi(tk[1]) : -1; const n = tk.length > 2 ? atoi(tk[2]) : 200; const st = ['j', 'a', 's', 'S'];
    for (let q = 0; q < n; q++) { fab.doTick(); w.TICK++; if (id >= 0 && id < lv.nextId) { const se = seats[id]; process.stderr.write(sprintf('  t=%lld seat%d %s coord=%s\n', TICK(), id, st[se.state], se.hasCoord ? coordStr(se.coord) : '-')); } }
    P('OK watched %d\n', n);
  };
  // C++: mesh.cpp:runOp (compacton)
  V.compacton = (tk) => { lv.COMPACTION = (tk.length < 2) || (tk[1] !== '0'); P('OK compaction=%d\n', lv.COMPACTION ? 1 : 0); };
  // C++: mesh.cpp:runOp (problvl)
  V.problvl = (tk) => { lv.PROBLVL = (tk.length > 1) ? atoi(tk[1]) : 0; P('OK problvl=%d\n', lv.PROBLVL); };
  // C++: mesh.cpp:runOp (probeon)
  V.probeon = (tk) => { lv.PROBEON = (tk.length < 2) || (tk[1] !== '0'); P('OK probeon=%d\n', lv.PROBEON ? 1 : 0); };
  // C++: mesh.cpp:runOp (spreadon)
  V.spreadon = (tk) => { lv.SPREAD = (tk.length < 2) || (tk[1] !== '0'); P('OK spread=%d\n', lv.SPREAD ? 1 : 0); };
  // C++: mesh.cpp:runOp (spreaddepth)
  V.spreaddepth = (tk) => { lv.SPREAD_MINDEPTH = (tk.length > 1) ? atoi(tk[1]) : 0; P('OK spreaddepth=%d\n', lv.SPREAD_MINDEPTH); };
  // C++: mesh.cpp:runOp (noroomhist)
  V.noroomhist = (tk) => {
    const H = fab.NOROOM_BYDEPTH || (fab.NOROOM_BYDEPTH = new Array(16).fill(0));
    P('NOROOMHIST'); for (let d = 0; d < 16; d++) if (H[d]) P(' d%d:%lld', d, H[d]); P('\n');
    if (tk.length > 1 && tk[1] === 'reset') for (let d = 0; d < 16; d++) H[d] = 0;
  };
  // descstat [reset] — FRONT 3. Needs MESH_DESC=1 in the environment; the descent instrument itself is not ported.
  // C++: mesh.cpp:runOp (descstat)
  V.descstat = (tk) => {
    if (tk.length > 1 && tk[1] === 'reset') { lv.descSnapAt = -1; if (fab.DSC) fab.DSC = null; P('OK descstat reset at tick=%lld\n', TICK()); return; }
    // C++: mesh.cpp:descOn  (lazy: the first read takes MESH_DESC)
    if (lv.DESC_ON < 0) { const e = process.env.MESH_DESC; lv.DESC_ON = (e && atoi(e)) ? 1 : 0; }
    if (lv.DESC_ON !== 1) { P('DESCSTAT off — rerun with MESH_DESC=1\n'); return; }
    throw new NotPorted('descstat', '(MESH_DESC=1, the descent instrument) is not ported');
  };
  // freemap — G7 MEASUREMENT ONLY (nothing reads freeC; see healing-laws § G7).
  // C++: mesh.cpp:runOp (freemap)
  V.freemap = () => {
    const at = new Map(); for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3) at.set(ckey(seats[q].coord), q);
    const depthOf = (pc) => { let d = 0; while (pc) { pc = parentPath(pc); d++; } return d; };
    const tSeats = new Map(), tFree = new Map(), tDepth = new Map(), tDmin = new Map();
    const get = (m, k) => (m.has(k) ? m.get(k) : 0);
    const rootCellOf = (c) => { while (c.pc !== 0) { const o = up({ pc: c.pc, r: c.r, i: 0 }); if (!o) return -1; c = o; } return ckey(c); };
    for (const [, q] of at) {
      const c = seats[q].coord; const rc = rootCellOf(c); if (rc === -1) continue;
      tSeats.set(rc, get(tSeats, rc) + 1); const d = depthOf(c.pc); if (d > get(tDepth, rc)) tDepth.set(rc, d);
      if (d < 12) {
        const h = down(c); let nf = 0;
        for (let j = 0; j < C; j++) { if (at.has(ckey({ pc: h.pc, r: h.r, i: j }))) continue; if (at.has(ckey(down({ pc: h.pc, r: h.r, i: j })))) continue; tFree.set(rc, get(tFree, rc) + 1); nf++; }
        if (nf) { if (!tDmin.has(rc) || tDmin.get(rc) > d + 1) tDmin.set(rc, d + 1); }
      }
    }
    P('FREEMAP cell | digest_n true_n | digest_free true_free | err%% | digest_dmin true_dmin | maxDepth\n');
    let sN = 0, sTN = 0, sF = 0, sTF = 0, cells = 0, discOK = 0, discTot = 0, dminOK = 0, bestTrueDmin = 99, bestDigDmin = 99; const trueDmins = [];
    for (let r0 = 0; r0 < C; r0++) for (let i0 = 0; i0 < C; i0++) {
      const k = ckey({ pc: 0, r: r0, i: i0 }); const it = at.get(k);
      if (it === undefined) { P('  %d.%d  EMPTY\n', r0, i0); continue; }
      const s = seats[it]; const dn = s.myDig.n, df = s.myDig.freeC;
      const tn = tSeats.has(k) ? tSeats.get(k) : 0, tf = tFree.has(k) ? tFree.get(k) : 0, td = tDepth.has(k) ? tDepth.get(k) : 0;
      const err = tf ? 100.0 * (df - tf) / tf : (df ? 100.0 : 0.0);
      const dd = s.myDig.dmin, tdm = tDmin.has(k) ? tDmin.get(k) : 99;
      P('  %d.%d  %6d %6d | %7d %7d | %+7.1f | %11d %9d | %d\n', r0, i0, dn, tn, df, tf, err, dd, tdm, td);
      sN += dn; sTN += tn; sF += df; sTF += tf; cells++;
      if (dd === tdm) dminOK++;
      if (tdm < bestTrueDmin) bestTrueDmin = tdm; if (dd < bestDigDmin) bestDigDmin = dd; trueDmins.push(tdm);
      discTot++; if ((df > 0) === (tf > 0)) discOK++;
    }
    {
      let hasRoomYes = 0; for (const x of trueDmins) if (x < 99) hasRoomYes++;
      const distinct = new Set(trueDmins).size;
      P('FREETOT sections=%d digest_n=%lld true_n=%lld digest_free=%lld true_free=%lld free_err=%+.1f%% hasRoom_agree=%d/%d dmin_agree=%d/%d | SPREAD hasRoom_true=%d/%d dmin_distinct=%d best_true=%d best_digest=%d\n',
        cells, sN, sTN, sF, sTF, sTF ? 100.0 * (sF - sTF) / sTF : 0.0, discOK, discTot, dminOK, discTot, hasRoomYes, trueDmins.length, distinct, bestTrueDmin, bestDigDmin);
    }
    let unseated = 0; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state !== 3) unseated++;
    const freeByDepth = new Map();
    for (const [, q] of at) {
      const c = seats[q].coord; const d = depthOf(c.pc); if (d >= 12) continue; const h = down(c);
      for (let j = 0; j < C; j++) { const cc = { pc: h.pc, r: h.r, i: j }; if (at.has(ckey(cc)) || at.has(ckey(down(cc)))) continue; freeByDepth.set(d + 1, get(freeByDepth, d + 1) + 1); }
    }
    P('FREEDEPTH unseated=%d freeFrontierByDepth=', unseated);
    for (let d = 1; d <= 13; d++) if (freeByDepth.has(d)) P('%s%d:%d', d > 1 ? ',' : '', d, freeByDepth.get(d));
    P('\n');
  };
  // l10 [reset]: the state-message gauge over the window since the last reset. l10spam <id> [0|1]: the bad-actor lever.
  // C++: mesh.cpp:runOp (l10)
  let L10_T0 = 0;   // the C++ `static long long T0` inside the l10 verb
  V.l10 = (tk) => {
    const nCls = K.L10_STATE_CLASSES;
    if (tk.length > 1 && tk[1] === 'reset') {
      for (let q = 0; q < lv.nextId; q++) if (seats[q]) { const s = seats[q]; s.stSent = s.stEarly = s.stDrop = s.stPeak = s.stLead = s.stTrail = s.stLatSum = s.stLatMax = 0; for (let c = 0; c < nCls; c++) s.stDropC[c] = 0; }
      L10_T0 = TICK(); P('OK l10 gauge reset at tick=%lld\n', TICK()); return;
    }
    if (tk.length > 2 && tk[1] === 'seat') {
      const q = atoi(tk[2]); if (q < 0 || q >= lv.nextId || !seats[q]) { P('ERR\n'); return; }
      const x = seats[q]; P('L10SEAT seat%d sent=%lld early=%lld lead=%lld trail=%lld latMax=%lld drops=%lld\n', q, x.stSent, x.stEarly, x.stLead, x.stTrail, x.stLatMax, x.stDrop); return;
    }
    let lead = 0, trail = 0, latS = 0, latM = 0; const dc = new Array(nCls).fill(0); let sent = 0, early = 0, drop = 0, peak = 0, seated = 0;
    for (let q = 0; q < lv.nextId; q++) if (seats[q]) {
      const s = seats[q]; for (let c = 0; c < nCls; c++) dc[c] += s.stDropC[c];
      lead += s.stLead; trail += s.stTrail; latS += s.stLatSum; if (s.stLatMax > latM) latM = s.stLatMax; sent += s.stSent; early += s.stEarly; drop += s.stDrop; if (s.stPeak > peak) peak = s.stPeak;
      if (alive[q] && s.state === 3) seated++;
    }
    const win = TICK() - L10_T0 > 0 ? TICK() - L10_T0 : 1;
    P('L10STAT on=%d window=%lld seated=%lld sent=%lld mean=%.4f peak=%lld early=%lld drops=%lld (phone %lld pong %lld s1sync %lld u2beat %lld; early %lld) lead=%lld trail=%lld latMean=%.2f latMax=%lld\n',
      1, win, seated, sent, seated ? sent / (seated * win) : 0.0, peak, early, drop, dc[0], dc[1], dc[2], dc[3], dc[4] + dc[5] + dc[6], lead, trail, (lead + trail) ? latS / (lead + trail) : 0.0, latM);
  };
  // C++: mesh.cpp:runOp (seathash)
  V.seathash = () => {
    const u64 = (v) => v;   // mix takes a 64-bit value: lo word then hi word (a negative int sign-extends)
    for (let q = 0; q < lv.nextId; q++) {
      if (!alive[q] || !seats[q]) continue; const x = seats[q]; let h = hash.H_INIT;
      const mix = (v) => { h = hash.hmix64(h, v); };
      const mixAll = (lo, hi) => { h = hash.hmix(hash.hmix(h, lo >>> 0), hi >>> 0); };
      const mixI = (v) => { mixAll(v >>> 0, v < 0 ? 0xffffffff : 0); };   // (uint64_t) of an int / long long
      const mixmap = (m) => { let a = 0; for (const [k, v] of m) a = (a + hash.hmix(hash.hmix64(hash.H_INIT, k), v >>> 0)) >>> 0; mix(a); mix(m.size); };   // a sum: order-free
      mixI(x.state);
      if (x.hasCoord) mix(ckey(x.coord)); else mixAll(0xffffffff, 0xffffffff);
      mixmap(x.occ); mixmap(x.live); mixmap(x.s1seen); mixmap(x.healTry);
      mixI(x.lastAck); mixI(x.healAt); mixI(x.lastPhone); mixI(x.leaseUntil); mixI(x.seatedAt); mix(x.translost.size); mix(x.kidful.size);
      P('H %d %u\n', q, h);
    }
  };
  // C++: mesh.cpp:runOp (l10bucket)
  V.l10bucket = (tk) => { lv.L10_BUCKET = (tk.length < 2) || (tk[1] !== '0'); P('OK l10bucket=%d\n', lv.L10_BUCKET ? 1 : 0); };
  // C++: mesh.cpp:runOp (l10spam)
  V.l10spam = (tk) => {
    const id = tk.length > 1 ? atoi(tk[1]) : -1; const on = tk.length < 3 || tk[2] !== '0';
    if (id < 0 || id >= lv.nextId || !seats[id]) P('ERR\n'); else { seats[id].spam = on; fab.wake(id); P('OK l10spam %d=%d\n', id, on ? 1 : 0); }
  };
  // C++: mesh.cpp:runOp (digabs)
  V.digabs = (tk) => { lv.DIG_ABS = (tk.length < 2) || (tk[1] !== '0'); P('OK digabs=%d\n', lv.DIG_ABS ? 1 : 0); };
  // C++: mesh.cpp:runOp (digeston)
  V.digeston = (tk) => { lv.DIGEST = (tk.length < 2) || (tk[1] !== '0'); P('OK digest=%d\n', lv.DIGEST ? 1 : 0); };
  // refuse <id|all|frac F> [0|1] — set a participant's OWN first-hand consent state.
  // C++: mesh.cpp:runOp (refuse)
  V.refuse = (tk) => {
    const who = tk.length > 1 ? tk[1] : 'all'; let val = tk.length > 2 ? atoi(tk[2]) : 1; let n = 0;
    if (who === 'all') { for (let q = 0; q < lv.nextId; q++) if (alive[q]) { seats[q].refuses = val !== 0; n++; } }
    else if (who === 'frac') { const f = tk.length > 2 ? atof(tk[2]) : 0.1; val = 1; for (let q = 0; q < lv.nextId; q++) if (alive[q]) { const r = grnd() < f; seats[q].refuses = r; if (r) n++; } }
    else { const q = atoi(who); if (q >= 0 && q < lv.nextId && alive[q]) { seats[q].refuses = val !== 0; n = 1; } }
    let tot = 0; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].refuses) tot++;
    P('OK refuse set=%lld trueRefuse=%lld\n', n, tot);
  };

  // ---- L27, the mesh vote-off: levers and the observer (healing-laws.md L27) ---------------------------------------
  const honest = (q, t) => q >= 0 && q < lv.nextId && alive[q] && seats[q] && seats[q].state === 3 && seats[q].hasCoord && q !== t && !seats[q].kIgnore && seats[q].kEvil === 0;
  const names = (q, t) => { for (const [, v] of seats[q].occ) if (v === t) return true; return false; };
  const kstat = (t) => {
    const k = { honestN: 0, ban: 0, naming: 0, tState: -1, dupH: 0, lag: -1, nbr: 0, nbrBan: 0, tCell: '-' }; const cnt = new Map();
    for (let q = 0; q < lv.nextId; q++) {
      if (!honest(q, t)) continue; k.honestN++;
      if (seats[q].vban.has(t)) k.ban++; else if (k.lag < 0) k.lag = q;
      if (t >= 0 && t < lv.nextId && alive[t] && seats[t] && seats[t].hasCoord) {
        const ol = ownedLinks(seats[q].coord); let lk = false; for (const c of ol) if (ckey(c) === ckey(seats[t].coord)) lk = true;
        if (lk) { k.nbr++; if (seats[q].vban.has(t)) k.nbrBan++; }
      }
      if (names(q, t)) k.naming++;
      const ck = ckey(seats[q].coord); const c2 = (cnt.get(ck) || 0) + 1; cnt.set(ck, c2); if (c2 === 2) k.dupH++;
    }
    if (t >= 0 && t < lv.nextId && alive[t] && seats[t]) { k.tState = seats[t].state; if (seats[t].hasCoord) k.tCell = coordStr(seats[t].coord); }
    return k;
  };
  // C++: mesh.cpp:runOp (kvote)
  V.kvote = (tk) => {
    const who = tk.length > 1 ? tk[1] : ''; const kind = tk.length > 2 ? tk[2] : ''; const t = tk.length > 3 ? atoi(tk[3]) : -1; const sel = [];
    if (who.startsWith('first:')) { const Kn = atoi(who.slice(6)); for (let q = 0; q < lv.nextId && sel.length < Kn; q++) if (honest(q, t)) sel.push(q); }
    else if (who.startsWith('range:')) { const m = /^(-?\d+):(-?\d+)/.exec(who.slice(6)); const a = m ? +m[1] : 0, b = m ? +m[2] : -1; for (let q = a; q <= b && q < lv.nextId; q++) if (honest(q, t)) sel.push(q); }   // range:A:B the live seated ids A..B
    else { const q = atoi(who); if (q >= 0 && q < lv.nextId && alive[q] && seats[q]) sel.push(q); }
    let n = 0;
    for (const q of sel) {
      const x = seats[q]; const drop = (v) => { for (let i = v.length - 1; i >= 0; i--) if (v[i] === t) v.splice(i, 1); };
      if (kind === 'yes' && t >= 0) { drop(x.kabsT); if (!x.kyes.includes(t)) x.kyes.push(t); }
      else if (kind === 'abs' && t >= 0) { drop(x.kyes); if (!x.kabsT.includes(t)) x.kabsT.push(t); }
      else if (kind === 'no' && t >= 0) { drop(x.kyes); drop(x.kabsT); }
      else if (kind === 'all') x.kall = true;
      else if (kind === 'clear') { x.kyes.length = 0; x.kabsT.length = 0; x.kall = false; }
      else { P('ERR kvote <who> yes|abs|no <t> | all | clear\n'); n = -1; break; }
      x.kver = Math.max(x.kver + 1, (TICK() | 0) + 1); n++;   // ver is the signing time (monotone across a reload: the page signs with its clock)
    }
    if (n >= 0) P('OK kvote %s %s t=%d seats=%d\n', who, kind, t, n);
  };
  // C++: mesh.cpp:runOp (kickstat)
  V.kickstat = (tk) => {
    const t = tk.length > 1 ? atoi(tk[1]) : -1; const k = kstat(t);
    let rx = 0, tx = 0, taken = 0; const ref = new Array(8).fill(0);
    for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q]) { rx += seats[q].kRx; tx += seats[q].kTx; taken += seats[q].kTaken; for (let z = 0; z < 8; z++) ref[z] += seats[q].kRef[z]; }
    P('KICKSTAT t=%d tick=%lld honest=%d ban=%d nbr=%d nbrBan=%d lag=%d naming=%d dupH=%d tState=%d tCell=%s dropsIn=%lld dropsOut=%lld taken=%lld refused=%lld/%lld/%lld/%lld/%lld/%lld/%lld\n',
      t, TICK(), k.honestN, k.ban, k.nbr, k.nbrBan, k.lag, k.naming, k.dupH, k.tState, k.tCell, rx, tx, taken, ref[1], ref[2], ref[3], ref[4], ref[5], ref[6], ref[7]);
  };
  // C++: mesh.cpp:runOp (kvotes)
  V.kvotes = (tk) => {
    const q = tk.length > 1 ? atoi(tk[1]) : -1;
    if (q < 0 || q >= lv.nextId || !alive[q] || !seats[q]) { P('ERR\n'); return; }
    const R = seats[q].rootDec; const pop = Math.max(0, R.n) + Math.max(0, R.leased);
    P('KVOTES seat%d u2=%d at=%d part=%d n=%d leased=%d kabs=%d age=%lld:', q, seats[q].u2Id, R.at, R.part ? 1 : 0, R.n, R.leased, R.kabs, R.rx >= 0 ? seats[q].LT() - R.rx : -1);
    for (const e of R.kick) P(' t%d=%d/abs%d need=%d', e.tgt, e.up, e.dn, Math.max(2, Math.trunc((pop - R.kabs - e.dn) / 2) + 1));
    P('\n');
  };
  // C++: mesh.cpp:runOp (kickuntil)
  V.kickuntil = (tk) => {
    const t = tk.length > 1 ? atoi(tk[1]) : -1; const cap = tk.length > 2 ? atoll(tk[2]) : 3000; const start = TICK(); let ok = false, firstBan = -1;
    for (; TICK() - start < cap;) {
      const k = kstat(t); if (firstBan < 0 && k.ban > 0) firstBan = TICK() - start;
      if (k.honestN > 0 && k.ban === k.honestN && k.naming === 0) { ok = true; break; }
      fab.doTick(); w.TICK++;
    }
    const k = kstat(t);
    if (ok) P('KICKUNTIL t=%d ticks=%lld firstBan=%lld honest=%d ban=%d naming=%d tState=%d\n', t, TICK() - start, firstBan, k.honestN, k.ban, k.naming, k.tState);
    else P('KICKUNTIL t=%d TIMEOUT after=%lld firstBan=%lld honest=%d ban=%d naming=%d tState=%d tCell=%s\n', t, TICK() - start, firstBan, k.honestN, k.ban, k.naming, k.tState, k.tCell);
  };
  // C++: mesh.cpp:runOp (kickwatch)
  V.kickwatch = (tk) => {
    const t = tk.length > 1 ? atoi(tk[1]) : -1; const n = tk.length > 2 ? atoll(tk[2]) : 300; let bad = 0, maxNaming = 0, minBan = 2 ** 30, maxBan = 0, seatedTicks = 0, maxDup = 0;
    for (let z = 0; z < n; z++) {
      fab.doTick(); w.TICK++; const k = kstat(t); if (k.naming > 0) bad++; if (k.naming > maxNaming) maxNaming = k.naming; if (k.ban < minBan) minBan = k.ban; if (k.ban > maxBan) maxBan = k.ban; if (k.tState === 3) seatedTicks++; if (k.dupH > maxDup) maxDup = k.dupH;
    }
    const k = kstat(t); let al = 0; for (let q = 0; q < lv.nextId; q++) if (q !== t && alive[q] && seats[q] && !seats[q].kIgnore && seats[q].kEvil === 0) al++;
    P('KICKWATCH t=%d ticks=%lld namingTicks=%lld maxNaming=%lld minBan=%lld maxBan=%lld honest=%d alive=%d tSeatedTicks=%lld maxDupH=%lld tState=%d ban=%d naming=%d\n', t, n, bad, maxNaming, minBan === 2 ** 30 ? 0 : minBan, maxBan, k.honestN, al, seatedTicks, maxDup, k.tState, k.ban, k.naming);
  };
  // a voter leaves the room (its goodbye): its vote must go with it
  // C++: mesh.cpp:runOp (kleave)
  V.kleave = (tk) => { const q = tk.length > 1 ? atoi(tk[1]) : -1; if (q >= 0 && q < lv.nextId && alive[q] && seats[q]) { seats[q].leave(); lv.N--; P('OK kleave %d, N now %d\n', q, lv.N); } else P('ERR\n'); };
  // C++: mesh.cpp:runOp (kickhold)
  V.kickhold = (tk) => { if (tk.length > 1) lv.KICK_HOLD = atoll(tk[1]); P('OK kickhold %lld\n', lv.KICK_HOLD); };
  // `kroles deep`: the first deep seat
  // C++: mesh.cpp:runOp (kroles)
  V.kroles = (tk) => {
    let q = tk.length > 1 ? atoi(tk[1]) : -1;
    if (tk.length > 1 && tk[1] === 'deep') { q = -1; for (let z = 0; z < lv.nextId && q < 0; z++) if (alive[z] && seats[z] && seats[z].state === 3 && seats[z].hasCoord && seats[z].coord.pc !== 0) q = z; }
    let hd = -1, ow = -1, ch = -1;
    if (q >= 0 && q < lv.nextId && alive[q] && seats[q] && seats[q].hasCoord) {
      const x = seats[q]; if (x.coord.pc !== 0) hd = x.occGet(ckey({ pc: x.coord.pc, r: x.coord.r, i: 0 })); const o = x.ownerCoord(); if (o) ow = x.occGet(ckey(o)); ch = x.occGet(ckey(down(x.coord)));
    }
    P('KROLES seat=%d head=%d owner=%d child=%d\n', q, hd, ow, ch);
  };
  // L27.9 observer: evidence against t (first tick, seats holding it), and any evidence against honest seats
  // C++: mesh.cpp:runOp (kaudit)
  V.kaudit = (tk) => {
    const t = tk.length > 1 ? atoi(tk[1]) : -1; let first = -1, seats_ = 0, evS = 0, evU = 0, evV = 0, evVhon = 0, evShon = 0, evH = 0, evHhon = 0, susp = 0, suspHon = 0, audN = 0, firstSusp = -1;
    const okSeat = (e) => e >= 0 && e < lv.nextId && alive[e] && seats[e];
    for (let q = 0; q < lv.nextId; q++) {
      if (!alive[q] || !seats[q]) continue; const x = seats[q]; audN += x.kAudN; if (x.kIgnore || x.kEvil) continue;
      const a = x.kEvS.get(t);
      if (a !== undefined) { seats_++; evS += a; const f = x.kEvFirst.get(t); if (f !== undefined && (first < 0 || f < first)) first = f; }
      const u = x.kEvU.get(t); if (u !== undefined) evU += u; const v = x.kEvV.get(t); if (v !== undefined) evV += v;
      for (const [k, c] of x.kEvV) if (k !== t && okSeat(k) && !seats[k].kEvil) evVhon += c;
      for (const [k, c] of x.kEvS) if (k !== t && okSeat(k) && !seats[k].kEvil && !seats[k].kIgnore) evShon += c;
      const h = x.kEvH.get(t); if (h !== undefined) evH += h; if (x.kSuspect(t)) susp++; const sa = x.kSuspAt.get(t); if (sa !== undefined && (firstSusp < 0 || sa < firstSusp)) firstSusp = sa;
      for (const [k, c] of x.kEvH) if (k !== t && okSeat(k) && !seats[k].kEvil && !seats[k].kIgnore) { evHhon += c; if (x.kSuspect(k)) suspHon++; }
    }
    P('KAUDIT t=%d tick=%lld first=%lld seats=%d strong=%d unanswered=%d voterEv=%d honestAggEv=%d honestVoterEv=%d audits=%lld frames=%lld hard=%d honestHard=%d suspects=%d firstSuspect=%lld honestSuspects=%d\n',
      t, TICK(), first, seats_, evS, evU, evV, evShon, evVhon, audN, lv.K_AUDQ + lv.K_AUDA, evH, evHhon, susp, firstSusp, suspHon);
  };
  // L27 hostile ancestor: its PONGs carry a complete fold with `victim` over the bar
  // C++: mesh.cpp:runOp (kfake)
  V.kfake = (tk) => {
    const q = tk.length > 1 ? atoi(tk[1]) : -1; const wd = tk.length > 2 ? tk[2] : ''; let v = -1;
    if (q >= 0 && q < lv.nextId && alive[q] && seats[q] && seats[q].hasCoord) {
      const x = seats[q];
      if (wd === 'owner') { const o = x.ownerCoord(); if (o) v = x.occGet(ckey(o)); }
      else if (wd === 'mate' || wd === 'heir') {
        if (wd === 'heir') { const view = (c) => ckey(c) === ckey(x.coord) || x.occGet(ckey(c)) >= 0; const h = require(path.join(M, 'roles.js')).e2SrcOf({ pc: x.coord.pc, r: x.coord.r, i: 0 }, view); if (h && ckey(h) !== ckey(x.coord)) v = x.occGet(ckey(h)); }
        for (let j = C - 1; j >= 0 && v < 0 && wd === 'mate'; j--) if (j !== x.coord.i) { const y = x.occGet(ckey({ pc: x.coord.pc, r: x.coord.r, i: j })); if (y >= 0) v = y; }
      }
      else if (wd === 'child') v = x.occGet(ckey(down(x.coord)));
      else v = atoi(wd);
      x.kFakeT = v;
    }
    P('KFAKE seat=%d victim=%d\n', q, v);
  };
  // C++: mesh.cpp:runOp (kickignore)
  V.kickignore = (tk) => { const q = tk.length > 1 ? atoi(tk[1]) : -1; if (q >= 0 && q < lv.nextId && alive[q] && seats[q]) { seats[q].kIgnore = true; seats[q].vban.clear(); P('OK kickignore %d\n', q); } else P('ERR\n'); };
  // C++: mesh.cpp:runOp (kickknock)
  V.kickknock = (tk) => { const q = tk.length > 1 ? atoi(tk[1]) : -1; if (q >= 0 && q < lv.nextId) { fab.KICK_KNOCK.add(q); P('OK kickknock %d\n', q); } else P('ERR\n'); };
  // C++: mesh.cpp:runOp (kevil)
  V.kevil = (tk) => {
    const q = tk.length > 1 ? atoi(tk[1]) : -1; const md = tk.length > 2 ? tk[2] : 'off'; const t = tk.length > 3 ? atoi(tk[3]) : -1;
    const KV = { badsig: 2, inflate: 4, absall: 5, suppress: 6, stale: 7, minted: 9, equivocate: 10, mintedself: 11, mute: 12, backdate: 13 };
    const v = KV[md] || 0;
    if (q >= 0 && q < lv.nextId && alive[q] && seats[q]) {
      seats[q].kEvil = v; seats[q].kEvilT = t;
      if (v === 2 && t >= 0) { seats[q].kyes = [t]; seats[q].kver = Math.max(seats[q].kver + 1, (TICK() | 0) + 1); }
      P('OK kevil %d %s t=%d\n', q, md, t);
    } else P('ERR\n');
  };
  // C++: mesh.cpp:runOp (kforge)
  V.kforge = (tk) => {
    const to = tk.length > 1 ? atoi(tk[1]) : -1; const cs = tk.length > 2 ? tk[2] : ''; const from = tk.length > 3 ? atoi(tk[3]) : -1; const Vv = tk.length > 4 ? atoi(tk[4]) : -1; const T = tk.length > 5 ? atoi(tk[5]) : 9999;
    const ok = (q) => q >= 0 && q < lv.nextId && alive[q] && seats[q];
    if (!ok(to) || !ok(from) || !seats[to].hasCoord) { P('ERR kforge\n'); return; }
    const R = seats[to]; const F = seats[from]; const m = msg.newMsg('PHONE'); m.id = from; m.lk = from; m.from = from; m.tock = ckey(R.coord);
    m.coord = F.hasCoord ? cp(F.coord) : { pc: 0, r: 0, i: 0 }; m.tn = F.hasCoord ? F.tn : -1;
    let k = msg.newKStmt(); k.voter = from; k.signer = from; k.good = true; k.ck = ckey(m.coord); k.tn = m.tn; k.ver = F.kver + 1000; k.yes = [T];
    if (cs === 'badsig') k.good = false;
    else if (cs === 'otherkey' && ok(Vv)) { k.voter = Vv; }
    else if (cs === 'impersonate' && ok(Vv) && seats[Vv].hasCoord) { m.id = Vv; m.coord = cp(seats[Vv].coord); m.tn = seats[Vv].tn; k.voter = Vv; k.signer = Vv; k.ck = ckey(m.coord); k.tn = m.tn; }   // V's own words, but the transport names `from`
    else if (cs === 'stolen' && ok(Vv) && seats[Vv].hasCoord) { k = seats[Vv].kStmt(); k.yes = [T]; k.ver = seats[Vv].kver + 1000; }   // a copy of V's genuine statement inside from's own beat
    else if (cs === 'replay') { const sv = R.kSeen.has(from) ? R.kSeen.get(from) : 0; k.ver = sv - 1; }   // older than the newest R took from it
    else if (cs === 'oldstay') { k.tn = m.tn - 1; m.tn = k.tn; if (Vv >= 0) { k.tn = Vv; m.tn = Vv; } }   // a stay it no longer holds (an earlier tenancy at that cell)
    else if (cs === 'unseated') {   // from holds no seat: it names a cell R folds
      let ck = 0;
      if (R.coord.pc !== 0 && R.coord.i === 0) { for (let j = 1; j < C; j++) { const q2 = ckey({ pc: R.coord.pc, r: R.coord.r, i: j }); ck = q2; if (R.occGet(q2) >= 0) break; } }
      else ck = ckey(down(R.coord));
      m.coord = unckey(ck); m.tn = 12345; k.ck = ck; k.tn = 12345;
    }
    m.sig = true; m.sigAt = TICK() | 0;   // L26: the beat itself carries a valid author signature, so only the vote statement is under test
    m.kv = k; const t0 = R.kTaken; R.kLastWhy = -1; R.recv(m);
    P('KFORGE case=%s to=%d from=%d accepted=%d why=%d\n', cs, to, from, (R.kTaken > t0) ? 1 : 0, R.kLastWhy);
  };

  // ---- § G9 leaf-fact verbs: a participant's OWN room-global facts --------------------------------------------------
  //   hand|stage|app|away <all|frac F|id> <0|1> [flags]   vote <all|frac F|id> <up|dn> <id|pool K>   vote clear
  const pickSeated = (who, f, outArr) => {
    if (who === 'all') { for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3) outArr.push(q); }
    else if (who === 'frac') { for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3 && grnd() < f) outArr.push(q); }
    else { const q = atoi(who); if (q >= 0 && q < lv.nextId && alive[q]) outArr.push(q); }
  };
  // C++: mesh.cpp:runOp (hand, stage, app, away, vote)
  V.hand = V.stage = V.app = V.away = V.vote = (tk) => {
    const op = tk[0];
    if (op === 'vote' && tk.length > 1 && tk[1] === 'clear') {
      for (let q = 0; q < lv.nextId; q++) if (alive[q]) { seats[q].vup.length = 0; seats[q].vdn.length = 0; }
      P('OK vote clear\n'); return;
    }
    const who = tk.length > 1 ? tk[1] : 'all'; let a = 2, f = 0;
    if (who === 'frac') { f = tk.length > 2 ? atof(tk[2]) : 0.1; a = 3; }
    const sel = []; pickSeated(who, f, sel);
    if (op === 'vote') {
      const kind = tk.length > a ? tk[a] : 'dn'; const tg = tk.length > a + 1 ? tk[a + 1] : 'pool'; const Kn = tk.length > a + 2 ? atoi(tk[a + 2]) : 3;
      const pool = []; if (tg === 'pool') { for (let q = 0; q < lv.nextId && pool.length < Kn; q++) if (alive[q] && seats[q].state === 3) pool.push(q); }
      let added = 0;
      for (const q of sel) {
        const t = tg === 'pool' ? (pool.length === 0 ? -1 : pool[Math.trunc(grnd() * pool.length)]) : atoi(tg);
        if (t < 0 || t === q) continue; (kind === 'up' ? seats[q].vup : seats[q].vdn).push(t); added++;
      }
      P('OK vote %s added=%d\n', kind, added);
    } else {
      const val = tk.length > a ? atoi(tk[a]) : 1; const fl = (tk.length > a + 1 ? atoi(tk[a + 1]) : 0) & 0xff;
      for (const q of sel) {
        const s = seats[q];
        if (op === 'hand') s.handT = val ? (TICK() | 0) + 1 : 0;
        else if (op === 'stage') { s.stageT = val ? (TICK() | 0) + 1 : 0; s.stageF = val ? fl : 0; }
        else if (op === 'app') s.appT = val ? (TICK() | 0) + 1 : 0;
        else s.away = val !== 0;
      }
      P('OK %s set=%zu\n', op, sel.length);
    }
  };
  // lists — does the G9 fold TELL THE TRUTH at every observer?
  // C++: mesh.cpp:runOp (lists)
  V.lists = () => {
    const T = msg.newDig(); T.n = 0;
    for (let q = 0; q < lv.nextId; q++) {
      if (!alive[q] || seats[q].state !== 3) continue; const s = seats[q]; T.n++;
      if (s.handT) { T.handN++; T.hands.push({ id: q, k: s.handT, f: 0 }); }
      if (s.stageT) T.stage.push({ id: q, k: s.stageT, f: s.stageF });
      if (s.appT) T.apps.push({ id: q, k: s.appT, f: 0 });
      if (s.away) T.awayN++;
      else {
        const u = new Set(), wv = new Set();
        for (const t of s.vup) if (t !== q && !u.has(t)) { u.add(t); dig.voteAdd(T.votes, [{ tgt: t, up: 1, dn: 0 }]); }
        for (const t of s.vdn) if (t !== q && !wv.has(t)) { wv.add(t); dig.voteAdd(T.votes, [{ tgt: t, up: 0, dn: 1 }]); }
      }
    }
    const topk = (v, Kn, asc) => { v = v.slice().sort(dig.byLess(asc ? dig.leAsc : dig.leDesc)); if (v.length > Kn) v.length = Kn; return v; };
    const tH = topk(T.hands, K.K_HAND, true), tS = topk(T.stage, K.K_STAGE, true), tA = topk(T.apps, K.K_APP, false);
    const trueTargets = T.votes.length; const allV = T.votes.map((x) => ({ tgt: x.tgt, up: x.up, dn: x.dn })); dig.digTrim(T);
    const eqL = (a, b) => a.length === b.length && a.every((x, i) => dig.leEq(x, b[i]));
    const eqV = (a, b) => a.length === b.length && a.every((x, i) => dig.veEq(x, b[i]));
    let obs = 0, hE = 0, hnE = 0, sE = 0, aE = 0, vE = 0, awE = 0, vOver = 0, vExcess = 0, liarPubN = 0;
    for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3 && seats[q].lie === 4) { const s = seats[q]; const pn = (s.hasCoord && s.coord.pc !== 0 && s.coord.i === 0) ? s.rowDig.n : s.myDig.n; if (pn > liarPubN) liarPubN = pn; }
    for (let q = 0; q < lv.nextId; q++) {
      if (!alive[q] || seats[q].state !== 3) continue; const R = seats[q].dRoot(); if (R.at < 0) continue; obs++;
      if (eqL(R.hands, tH)) hE++; if (R.handN === T.handN) hnE++; if (eqL(R.stage, tS)) sE++; if (eqL(R.apps, tA)) aE++; if (R.awayN === T.awayN) awE++;
      if (eqV(R.votes, T.votes)) vE++;
      for (const v of R.votes) {
        let t = null; for (const x of allV) if (x.tgt === v.tgt) { t = x; break; }
        const eu = v.up - (t ? t.up : 0), ed = v.dn - (t ? t.dn : 0); if (eu > vExcess) vExcess = eu; if (ed > vExcess) vExcess = ed;
        if (!t) { vOver++; continue; } if (v.up > t.up || v.dn > t.dn) vOver++;
      }
    }
    P('LISTS obs=%d hands=%zu handN=%d handExact=%d handNExact=%d stage=%zu stageExact=%d apps=%zu appExact=%d awayN=%d awayExact=%d voteTargets=%zu voteExact=%d voteOver=%lld voteExcessMax=%d liarPubN=%d\n',
      obs, T.hands.length, T.handN, hE, hnE, T.stage.length, sE, T.apps.length, aE, T.awayN, awE, trueTargets, vE, vOver, vExcess, liarPubN);
  };
  // evil <frac> — HOSTILE MEMBERS (docs/meet-security.md §AUTH)
  // C++: mesh.cpp:runOp (evil)
  V.evil = (tk) => {
    lv.EVIL_RECLAIM = tk.length > 2 && tk[2] === 'reclaim';   // `evil <frac> reclaim`: the hostile seats forge RECLAIMs (L3.10) instead of HELLOs
    const frac = tk.length > 1 ? atof(tk[1]) : 0.02; const ids = []; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3) ids.push(q);
    ids.sort((a, b) => a - b); const ne = Math.max(1, Math.trunc(lv.N * frac)); let done = 0;
    for (const q of ids) { if (done >= ne) break; seats[q].evil = true; fab.wake(q); done++; }
    P('OK evil seats=%d\n', done);
  };
  // C++: mesh.cpp:runOp (hostile)
  V.hostile = (tk) => { X.hostileVerb(tk); };
  // C++: mesh.cpp:runOp (lie)
  V.lie = (tk) => {
    if (X.tierLie(tk)) return;
    const who = tk.length > 1 ? tk[1] : ''; const mode = tk.length > 2 ? atoi(tk[2]) : 1; let q = -1;
    if (who.includes('/')) { const c = parseCell(who); if (c) q = seatAt(c, false); }
    else q = atoi(who);
    if (q < 0 || q >= lv.nextId || !alive[q]) P('ERR lie: no such live seat %s\n', who);
    else { seats[q].lie = mode; P('OK lie seat=%d coord=%s mode=%d\n', q, seats[q].hasCoord ? coordStr(seats[q].coord) : '-', mode); }
  };
  // digest [reset] — the § G gauge.
  // C++: mesh.cpp:runOp (digest)
  V.digest = (tk) => {
    if (tk.length > 1 && tk[1] === 'reset') {
      for (let q = 0; q < lv.nextId; q++) if (alive[q]) { seats[q].framesIn0 = seats[q].framesIn; seats[q].framesInT0 = seats[q].framesInT.slice(); }
      lv.GAUGE_T0 = TICK(); lv.DIG_MISMATCH = 0; for (let q = 0; q < lv.nextId; q++) if (alive[q]) seats[q].digMismatch = 0; P('OK digest gauge reset at tick=%lld\n', TICK()); return;
    }
    let trueSeated = 0, trueRefuse = 0; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3) { trueSeated++; if (seats[q].refuses) trueRefuse++; }
    let rmin = 2 ** 30, rmax = -1, fmin = 2 ** 30, fmax = -1, exact = 0, obs = 0, part = 0, stale = 0, mism = 0, freeMin = 2 ** 30, freeMax = -1;
    for (let q = 0; q < lv.nextId; q++) {
      if (!alive[q] || seats[q].state !== 3) continue; const s = seats[q]; mism += s.digMismatch;
      if (s.dRoot().at < 0) { stale++; continue; }
      obs++; const rn = s.dRoot().n, rf = s.dRoot().refuse;
      if (rn < rmin) rmin = rn; if (rn > rmax) rmax = rn; if (rf < fmin) fmin = rf; if (rf > fmax) fmax = rf;
      if (s.dRoot().freeC < freeMin) freeMin = s.dRoot().freeC; if (s.dRoot().freeC > freeMax) freeMax = s.dRoot().freeC;
      if (rn === trueSeated) exact++; if (s.dRoot().part) part++;
    }
    P('DIGEST on=%d true=%lld trueRefuse=%lld obs=%d noroot=%d rootMin=%d rootMax=%d rootExact=%d refuseMin=%d refuseMax=%d partial=%d freeMin=%d freeMax=%d mismatch=%lld\n',
      lv.DIGEST ? 1 : 0, trueSeated, trueRefuse, obs, stale, obs ? rmin : -1, rmax, exact, obs ? fmin : -1, fmax, part, obs ? freeMin : -1, freeMax, mism);
    {
      let g1 = 0, g2 = 0, g4 = 0, ex = '';
      for (let q = 0; q < lv.nextId; q++) {
        if (!alive[q] || seats[q].state !== 3 || !seats[q].digGap) continue; const s = seats[q];
        if (s.digGap & 1) g1++; if (s.digGap & 2) g2++; if (s.digGap & 4) g4++;
        if (ex.length < 220) ex += sprintf('%s[%s%s%s] ', coordStr(s.coord), (s.digGap & 1) ? 'child' : '', (s.digGap & 2) ? 'row' : '', (s.digGap & 4) ? 's1' : '').slice(0, 127);
      }
      P('DIGGAP childRow=%d rowMate=%d s1cell=%d  %s\n', g1, g2, g4, ex);
    }
    const win = Math.max(1, TICK() - lv.GAUGE_T0); const fr = []; let fmx = 0, fmxId = -1, dmax = 0, dmaxId = -1; const ds = []; let occMax = 0;
    for (let q = 0; q < lv.nextId; q++) {
      if (!alive[q] || seats[q].state !== 3) continue; const s = seats[q];
      const f = (s.framesIn - s.framesIn0) / win; fr.push(f); if (f > fmx) { fmx = f; fmxId = q; }
      const d = s.rowKids.size + s.s1tab.size + 3; ds.push(d); if (d > dmax) { dmax = d; dmaxId = q; }
      if (s.occ.size > occMax) occMax = s.occ.size;
    }
    fr.sort((a, b) => a - b); ds.sort((a, b) => a - b);
    P('DIGGAUGE win=%lld nodes=%zu framesPerTick_max=%.4f framesPerTick_p50=%.4f framesPerTick_maxAt=%d digState_max=%d digState_p50=%d digState_maxAt=%d occ_max=%zu C=%d bound=%d\n',
      win, fr.length, fmx, fr.length ? fr[Math.trunc(fr.length / 2)] : 0.0, fmxId, dmax, ds.length ? ds[Math.trunc(ds.length / 2)] : 0, dmaxId, occMax, C, C * C + 2 * C + 4);
  };
  // digcount <expect> [handId] — the L3.12 probe (repro-digest-lease)
  // C++: mesh.cpp:runOp (digcount)
  V.digcount = (tk) => {
    const occT = new Map(); for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3 && seats[q].hasCoord) occT.set(ckey(seats[q].coord), q);
    const connM = new Map();
    const conn = (c) => {
      if (c.pc === 0) return true; const h = { pc: c.pc, r: c.r, i: 0 }; const hk = ckey(h); if (!occT.has(hk)) return false;
      if (connM.has(hk)) return connM.get(hk);
      const ow = up(h); const ok = !!ow && occT.has(ckey(ow)) && conn(ow); connM.set(hk, ok); return ok;
    };
    let nconn = 0; for (const [k] of occT) if (conn(unckey(k))) nconn++;
    const expect = tk.length > 1 ? (tk[1] === 'conn' ? nconn : atoi(tk[1])) : 0; const hid = tk.length > 2 ? atoi(tk[2]) : -1;
    let rmin = 2 ** 30, rmax = -1, exact = 0, under = 0, over = 0, obs = 0, noroot = 0, lmax = 0, s1 = 0, s1under = 0, s1h = 0, allh = 0, s1exact = 0, disc = 0, dep = 0, s1over = 0;
    for (let q = 0; q < lv.nextId; q++) {
      if (!alive[q] || seats[q].state !== 3 || isFrozen(q)) continue; const s = seats[q]; if (!s.hasCoord || !conn(s.coord)) { disc++; continue; }
      const is1 = s.hasCoord && s.coord.pc === 0;
      if (is1) s1++;
      if (s.dRoot().at < 0) { noroot++; continue; }
      obs++; { const dd = pcDepth(s.coord.pc) + 1; if (dd > dep) dep = dd; }
      const rn = s.dRoot().n + s.dRoot().leased; if (rn < rmin) rmin = rn; if (rn > rmax) rmax = rn;
      if (rn === expect) { exact++; if (is1) s1exact++; } else if (rn < expect) { under++; if (is1) s1under++; } else { over++; if (is1) s1over++; }
      if (s.dRoot().leased > lmax) lmax = s.dRoot().leased;
      if (hid >= 0) { let h = false; for (const e of s.dRoot().hands) if (e.id === hid) h = true; if (h) { allh++; if (is1) s1h++; } }
    }
    P('DIGCOUNT depth=%d disc=%d conn=%d seated=%zu expect=%d obs=%d noroot=%d min=%d max=%d exact=%d under=%d over=%d leasedMax=%d s1=%d s1under=%d s1exact=%d s1over=%d', dep, disc, nconn, occT.size, expect, obs, noroot, obs ? rmin : -1, rmax, exact, under, over, lmax, s1, s1under, s1exact, s1over);
    if (hid >= 0) P(' hand=%d s1hand=%d/%d allhand=%d/%d', hid, s1h, s1, allh, obs);
    P('\n');
  };
  // compactfix — the Q2 FIXPOINT LAW, read by a global observer from the TRUE seating
  // C++: mesh.cpp:runOp (compactfix)
  V.compactfix = () => {
    const occT = new Map(); for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3) occT.set(ckey(seats[q].coord), q);
    const held = (pc, r, i) => occT.has(ckey({ pc, r, i }));
    let viol = 0, shown = 0, ex = '';
    for (const [ek] of occT) {
      const c = unckey(ek); if (c.pc === 0) continue;
      let rightmost = true; for (let j = c.i + 1; j < C; j++) if (held(c.pc, c.r, j)) { rightmost = false; break; }
      if (!rightmost) continue;
      let leaf = true; const kp = childPath(c.pc, c.i); for (let j = 0; j < C; j++) if (held(kp, c.r, j)) { leaf = false; break; }
      if (!leaf) continue;
      const sd = pcDepth(c.pc); let pa = c.pc;
      for (let k = 1; ; k++) {
        if (pa === 0) break; pa = parentPath(pa); const dp = sd - k; if (dp < 1) break; if (lv.PROBLVL > 0 && k > lv.PROBLVL) break;
        let jmax = -1; for (let j = 0; j < C; j++) if (held(pa, c.r, j)) jmax = j;
        if (jmax < 0 || jmax >= C - 1) continue;
        const slot = { pc: pa, r: c.r, i: jmax + 1 }; if (occT.has(ckey(down(slot)))) continue;
        viol++; if (shown < 5) { shown++; ex += ' ' + coordStr(c) + '->' + coordStr(slot); } break;
      }
    }
    P('COMPACTFIX violations=%lld%s\n', viol, ex);
  };
  // Q2 diagnostic: tree-depth & lone-row fragmentation. depth(pc)=path length.
  // C++: mesh.cpp:runOp (compact)
  V.compact = () => {
    const depthOf = (pc) => { let d = 0; while (pc) { pc = parentPath(pc); d++; } return d; };
    const secRows = new Map(), secSeats = new Map(); let seatN = 0, maxDepth = 0; const byDepth = new Map();
    for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3) {
      const c = seats[q].coord; seatN++;
      let sr = secRows.get(c.pc); if (!sr) { sr = new Set(); secRows.set(c.pc, sr); } sr.add(c.r); secSeats.set(c.pc, (secSeats.get(c.pc) || 0) + 1);
      const d = depthOf(c.pc); byDepth.set(d, (byDepth.get(d) || 0) + 1); if (d > maxDepth) maxDepth = d;
    }
    let loneDeep = 0, occSections = 0; for (const [pc, s] of secRows) { occSections++; if (pc !== 0 && s.size === 1) loneDeep++; }
    const occAll = new Set(); for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3) occAll.add(ckey(seats[q].coord));
    const isFree = (c) => !occAll.has(ckey(c));
    const fr = [0, 0, 0, 0];
    for (const [pc] of secRows) { const dp = depthOf(pc); if (dp > 2) continue; for (let r = 0; r < C; r++) for (let i = 0; i < C; i++) { const c = { pc, r, i }; if (!isFree(c)) continue; if (!isFree(down(c))) continue; fr[dp]++; } }
    let minDepth = 0; { let capD = 25; let tier = 25; while (capD < seatN) { tier *= 5; capD += tier; minDepth++; } }   // theoretical minimal depth for seatN: cap(<=D) = 25*(5^(D+1)-1)/4
    P('COMPACT seats=%d occSections=%d maxDepth=%d minDepth=%d loneRowDeepSections=%d byDepth=', seatN, occSections, maxDepth, minDepth, loneDeep);
    for (let d = 0; d <= maxDepth; d++) P('%s%d:%d', d ? ',' : '', d, byDepth.has(d) ? byDepth.get(d) : 0);
    P(' frontier(d0=%d,d1=%d,d2=%d) cProbes=%lld cAdmits=%lld cPlaces=%lld cMoves=%lld cAtS1=%lld cOffers=%lld cOfferFires=%lld\n', fr[0], fr[1], fr[2], lv.COMPACT_PROBES, lv.COMPACT_ADMITS, lv.COMPACT_PLACES, lv.COMPACT_MOVES, lv.COMPACT_ATS1, lv.COMPACT_OFFERS, lv.COMPACT_OFFERFIRES);
  };

  // ---- L6 the talker goes to the stage (sim plan 3.6, I11) ----------------------------------------------------------
  // C++: mesh.cpp:runOp (talk, pin)
  V.talk = V.pin = (tk) => {
    const op = tk[0]; const who = tk.length > 1 ? tk[1] : 'all'; let a = 2, f = 0; if (who === 'frac') { f = tk.length > 2 ? atof(tk[2]) : 0.1; a = 3; }
    const sel = []; pickSeated(who, f, sel);
    if (op === 'talk') { const on = !(tk.length > a) || tk[a] !== 'off'; for (const q of sel) seats[q].talkSet(on); P('OK talk %s set=%zu\n', on ? 'on' : 'off', sel.length); }
    else { const on = !(tk.length > a) || tk[a] !== '0'; for (const q of sel) seats[q].pinT = on ? (TICK() | 0) + 1 : 0; P('OK pin %s set=%zu\n', on ? 'on' : 'off', sel.length); }
  };
  // C++: mesh.cpp:runOp (stageset, stagewait, stagerun)
  V.stageset = V.stagewait = V.stagerun = (tk) => {
    const op = tk[0];
    const truth = () => { const v = []; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3) { const e = seats[q].talkEntry(); if (e) v.push(e); } v.sort(dig.byLess(dig.talkLess)); if (v.length > K.K_TALK) v.length = K.K_TALK; return v.map((e) => e.id); };
    const view = (q) => seats[q].dRoot().talk.map((e) => e.id);
    const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const agree = (T) => { let ex = 0, obs = 0; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3 && seats[q].dRoot().at >= 0) { obs++; if (eq(view(q), T)) ex++; } return { ex, obs }; };
    if (op === 'stageset') { const T = truth(); const { ex, obs } = agree(T); P('STAGESET truth=%s obs=%d exact=%d stageUp=%lld tick=%lld\n', idsStr(T), obs, ex, lv.STAGEUP, TICK()); }
    else if (op === 'stagewait') {   // stagewait <cap> | stagewait auto <extra>: auto = depth x 8 + 16 + extra
      let dep = 0; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3 && seats[q].hasCoord) dep = Math.max(dep, 2 * pcDepth(seats[q].coord.pc) + 2);
      const au = tk.length > 1 && tk[1] === 'auto'; const cap = au ? (dep * 6 + 8) + (tk.length > 2 ? atoll(tk[2]) : 0) : (tk.length > 1 ? atoll(tk[1]) : 400); const start = TICK(); let ok = false, obs = 0, ex = 0, T = [];
      let W = []; let hasW = false;
      { const wi = au ? 3 : 2; if (tk.length > wi) { hasW = true; const wd = tk[wi]; let i = 0; while (i < wd.length) { let j = wd.indexOf(',', i); if (j < 0) j = wd.length; if (wd[i] !== '-') W.push(atoi(wd.slice(i, j))); i = j + 1; } W.sort((a, b) => a - b); } }   // the expected set (ids), compared sorted; '-' = empty
      const agreeW = () => { let e = 0, o = 0; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3 && seats[q].dRoot().at >= 0) { o++; const v = view(q).sort((a, b) => a - b); if (eq(v, W)) e++; } return { e, o }; };
      for (;;) {
        T = truth(); if (hasW) { const r = agreeW(); ex = r.e; obs = r.o; } else { const r = agree(T); ex = r.ex; obs = r.obs; }
        if (obs > 0 && ex === obs) { ok = true; break; } if (TICK() >= start + cap) break; fab.doTick(); w.TICK++;
      }
      P('%s stagewait after=%lld bound=%lld depth=%lld truth=%s obs=%d exact=%d\n', ok ? 'OK' : 'TIMEOUT', TICK() - start, cap, dep, idsStr(T), obs, ex);
    } else {
      const n = tk.length > 1 ? atoll(tk[1]) : 100; let tf = 0, of = 0; const outAt = new Map(); const prev = new Map(); let tprev = []; const toutAt = new Map(); let first = true;
      for (let i = 0; i < n; i++) {
        const T = truth();
        if (!first) { for (const x of tprev) if (!T.includes(x)) toutAt.set(x, TICK()); for (const x of T) if (!tprev.includes(x)) { const o = toutAt.get(x); if (o !== undefined && TICK() - o <= K.TALK_HOLD) tf++; } }
        tprev = T;
        for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3 && seats[q].dRoot().at >= 0) {
          const V_ = view(q); const pv = prev.get(q);
          if (pv !== undefined) { for (const x of pv) if (!V_.includes(x)) outAt.set(q + ',' + x, TICK()); for (const x of V_) if (!pv.includes(x)) { const o = outAt.get(q + ',' + x); if (o !== undefined && TICK() - o <= K.TALK_HOLD) of++; } }
          prev.set(q, V_);
        }
        first = false; fab.doTick(); w.TICK++;
      }
      P('STAGERUN ticks=%lld truthFlicker=%lld obsFlicker=%lld stageUp=%lld\n', n, tf, of, lv.STAGEUP);
    }
  };
  // C++: mesh.cpp:runOp (seatdump)
  V.seatdump = () => { for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q] && seats[q].state === 3 && seats[q].hasCoord) P('SEAT %d %s%s\n', q, coordStr(seats[q].coord), seats[q].stageT > 0 ? ' stage' : ''); P('OK seatdump tick=%lld\n', TICK()); };
  // C++: mesh.cpp:runOp (movemark)
  V.movemark = () => {
    fab.MOVECNT.length = 0; for (let i = 0; i < seats.length; i++) fab.MOVECNT.push(0); lv.MOVELAST = -1; lv.MOVEMARK_T = TICK(); lv.MOVES_MARK = lv.MOVES; lv.EVICT_MARK = lv.EVICTIONS; lv.RESEATS_MARK = lv.RESEATS; lv.ROLLBACKS_MARK = lv.ROLLBACKS;
    P('OK movemark tick=%lld\n', TICK());
  };
  // MOVESTAT since=<mark> moves=<takes by a seated seat> movers=<seats> twice=<seats moved 2+> max=<most moves by one seat> hist=1:a,2:b.. lastMove=<tick|-> ...
  // C++: mesh.cpp:runOp (movestat)
  V.movestat = () => {
    let mv = 0, movers = 0, twice = 0, mx = 0, stg = 0; const hist = new Map();
    for (let q = 0; q < fab.MOVECNT.length; q++) { const c = fab.MOVECNT[q]; if (c <= 0) continue; mv += c; movers++; if (c >= 2) twice++; if (c > mx) mx = c; hist.set(c, (hist.get(c) || 0) + 1); if (q < seats.length && seats[q] && seats[q].stageT > 0) stg++; }
    let h = ''; for (const k of [...hist.keys()].sort((a, b) => a - b)) { if (h) h += ','; h += k + ':' + hist.get(k); }
    P('MOVESTAT since=%lld tick=%lld moves=%lld movers=%d twice=%d max=%d hist=%s lastMove=%s reseats=%lld requeues=%lld rollbacks=%lld stagersMoved=%d\n',
      lv.MOVEMARK_T, TICK(), mv, movers, twice, mx, h === '' ? '-' : h, lv.MOVELAST < 0 ? '-' : String(lv.MOVELAST), lv.RESEATS - lv.RESEATS_MARK, lv.EVICTIONS - lv.EVICT_MARK, lv.ROLLBACKS - lv.ROLLBACKS_MARK, stg);
  };
  // until <seated|home|quiet K> [cap]: tick, checking EVERY tick, until the room is whole, or whole and all in Section 1, or no move landed for K ticks
  // C++: mesh.cpp:runOp (until)
  V.until = (tk) => {
    const what = tk.length > 1 ? tk[1] : 'seated'; let a = 2, Kq = 0; if (what === 'quiet') { Kq = tk.length > 2 ? atoll(tk[2]) : 40; a = 3; }
    const cap = tk.length > a ? atoll(tk[a]) : 20000; const start = TICK(); let ok = false;
    const whole = () => { const { seated, s1c } = fab.counts(); return seated === lv.N && s1c === Math.min(C * C, lv.N) && lv.DUPS_G === 0; };
    const home = () => { if (!whole()) return false; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3 && seats[q].coord.pc !== 0) return false; return true; };
    while (TICK() < start + cap) {
      if (what === 'seated' ? whole() : what === 'home' ? home() : (TICK() - Math.max(lv.MOVELAST, lv.MOVEMARK_T) >= Kq)) { ok = true; break; }
      fab.doTick(); w.TICK++; if (lv.PCS_TRACK) E_('pcsPeakRead');
    }
    P('%s until %s%s tick=%lld after=%lld lastMove=%s\n', ok ? 'OK' : 'TIMEOUT', what, what === 'quiet' ? ' ' + Kq : '', TICK(), TICK() - start, lv.MOVELAST < 0 ? '-' : String(lv.MOVELAST));
  };
  // joinslow k [last]: the k slowest joiners
  // C++: mesh.cpp:runOp (joinslow)
  V.joinslow = (tk) => {
    const k = tk.length > 1 ? atoi(tk[1]) : 10; const v = [];
    for (let q = 0; q < lv.nextId; q++) { if (q >= fab.SPAWNT.length || fab.SPAWNT[q] < 0 || q >= fab.FIRSTSEAT.length || fab.FIRSTSEAT[q] < 0) continue; v.push([(tk.length > 2 && tk[2] === 'last') ? fab.FIRSTSEAT[q] : fab.FIRSTSEAT[q] - fab.SPAWNT[q], q]); }
    v.sort((a, b) => (b[0] - a[0]) || (b[1] - a[1]));   // stable_sort(v.rbegin(), v.rend()): pairs descending
    for (let i = 0; i < k && i < v.length; i++) { const q = v[i][1]; P('JOINSLOW id=%d spawn=%lld seat=%lld took=%lld coord=%s\n', q, fab.SPAWNT[q], fab.FIRSTSEAT[q], v[i][0], seats[q].hasCoord ? coordStr(seats[q].coord) : '-'); }
  };
  // joinstat: time to seat (first take) for every seat spawned so far, and the open pcs that cost
  // C++: mesh.cpp:runOp (joinstat)
  V.joinstat = () => {
    const jt = [], jtm = [], jtd = []; let uns = 0, last = -1;
    for (let q = 0; q < lv.nextId; q++) {
      if (q >= fab.SPAWNT.length || fab.SPAWNT[q] < 0) continue;
      if (q < fab.FIRSTSEAT.length && fab.FIRSTSEAT[q] >= 0) { jt.push(fab.FIRSTSEAT[q] - fab.SPAWNT[q]); (seats[q] && seats[q].ctier === TIER_MOBILE ? jtm : jtd).push(fab.FIRSTSEAT[q] - fab.SPAWNT[q]); if (fab.FIRSTSEAT[q] > last) last = fab.FIRSTSEAT[q]; }
      else if (alive[q] && !seats[q].evilDoor) uns++;
    }
    jt.sort((a, b) => a - b);
    const pct = (p) => { if (!jt.length) return -1; let i = Math.trunc((jt.length * p + 99) / 100); if (i > 0) i--; return jt[Math.min(i, jt.length - 1)]; };
    const [, , c, d] = E_('pcsReport');
    P('JOINSTAT n=%zu unseated=%d p50=%lld p95=%lld max=%lld lastSeat=%lld pcs_open_p50=%d pcs_open_max=%d relay: knocks=%lld signal=%lld refused=%lld cuts=%lld', jt.length, uns, pct(50), pct(95), jt.length ? jt[jt.length - 1] : -1, last, c, d, lv.RELAY_KNOCKS, lv.RELAY_SIGNAL, lv.RELAY_REFUSED, lv.RELAY_CUTS);
    {
      const tp = (v, p) => { if (!v.length) return -1; v.sort((a, b) => a - b); let i = Math.trunc((v.length * p + 99) / 100); if (i > 0) i--; return v[Math.min(i, v.length - 1)]; };
      if (jtm.length) P(' mobile: n=%zu p50=%lld p95=%lld max=%lld desktop: n=%zu p50=%lld p95=%lld max=%lld', jtm.length, tp(jtm, 50), tp(jtm, 95), tp(jtm, 100), jtd.length, tp(jtd, 50), tp(jtd, 95), tp(jtd, 100));   // L16.6 measurement: join times per tier (the seat's own claim)
    }
    if (lv.PCS_TRACK) {
      P(' pcs_peak=%d pcs_peak_at=%lld pcs_peak_seat=%d', lv.PCS_PEAK, lv.PCS_PEAK_AT, lv.PCS_PEAK_SEAT);
      const TN = ['desktop', 'mobile'], CN = ['s1', 'deep', 'out'];
      for (let t = 0; t < 2; t++) for (let c2 = 0; c2 < 3; c2++) { const pk = E_('pcsPeakClass', t, c2); P(' pcs_peak_%s_%s=%d(seat %d at %lld doors %d named %d other %d)', TN[t], CN[c2], pk.n, pk.seat, pk.at, pk.kind[0], pk.kind[1], pk.kind[2]); }
    }
    if (lv.LINKMODEL) P(' closedrops=%lld', lv.CLOSEDROPS);
    if (lv.LINKMODEL) P(' l16: doorcap=%d doorcap_mobile=%d mobrate=%d deferred=%lld penddrop=%lld busy=%lld backoffs=%lld byes=%lld handed=%lld drop=%lld idle=%lld unnamed=%lld life=%lld gw=%lld door_peak=%lld ans_peak=%lld evil_peak=%lld knock_peak=%lld ', lv.DOORCAP, lv.DOORCAP_MOBILE, lv.L16_MOB_RATE, lv.L16_DEFERRED, lv.L16_PENDDROP, lv.L16_BUSY, lv.L16_BACKOFF, lv.L16_BYE, lv.L16_HANDED, lv.L16_DROP, lv.L16_IDLEC, lv.L16_UNN, lv.L16_LIFEC, lv.L16_GWC, lv.L16_DOORPEAK, lv.L16_ANSPEAK, lv.L16_EVILPEAK, lv.KNOCK_PEAK);
    P('\n');
  };
  // L16 doors and rates (the door model's levers)
  // C++: mesh.cpp:runOp (doorcap)
  V.doorcap = (tk) => { lv.DOORCAP = tk.length > 1 ? atoi(tk[1]) : K.DOORCAP_DFL; lv.L16_RESERVE = tk.length > 2 ? atoi(tk[2]) : K.L16_RESERVE_DFL; P('OK doorcap %d reserve %d\n', lv.DOORCAP, lv.L16_RESERVE); };
  // C++: mesh.cpp:runOp (doorcap_mobile)
  V.doorcap_mobile = (tk) => { lv.DOORCAP_MOBILE = tk.length > 1 ? atoi(tk[1]) : K.DOORCAP_MOBILE_DFL; lv.L16_RESERVE_MOBILE = tk.length > 2 ? atoi(tk[2]) : K.L16_RESERVE_MOBILE_DFL; P('OK doorcap_mobile %d reserve %d\n', lv.DOORCAP_MOBILE, lv.L16_RESERVE_MOBILE); };
  // C++: mesh.cpp:runOp (mobrate)
  V.mobrate = (tk) => { lv.L16_MOB_RATE = tk.length > 1 ? atoi(tk[1]) : K.L16_MOB_RATE_DFL; P('OK mobrate %d\n', lv.L16_MOB_RATE); };
  // C++: mesh.cpp:runOp (l16pick)
  V.l16pick = (tk) => { const wd = tk.length > 1 ? tk[1] : 'gateway'; lv.L16PICK = wd === 'random' ? 1 : wd === 'random-drop' ? 2 : 0; P('OK l16pick %s\n', wd); };
  // C++: mesh.cpp:runOp (l16backoff)
  V.l16backoff = (tk) => { lv.L16BO_BASE = tk.length > 1 ? atoi(tk[1]) : K.L16_BO_BASE; lv.L16BO_CAP = tk.length > 2 ? atoi(tk[2]) : K.L16_BO_CAP; P('OK l16backoff %d %d\n', lv.L16BO_BASE, lv.L16BO_CAP); };
  // C++: mesh.cpp:runOp (l16hoload)
  V.l16hoload = (tk) => { lv.L16HOLOAD = tk.length > 1 ? atoi(tk[1]) : K.L16_HO_LOAD; P('OK l16hoload %d\n', lv.L16HOLOAD); };
  // C++: mesh.cpp:runOp (l16mobkeep)
  V.l16mobkeep = (tk) => { lv.L16MOBKEEP = tk.length > 1 ? atoi(tk[1]) : 0; P('OK l16mobkeep %d\n', lv.L16MOBKEEP); };
  // C++: mesh.cpp:runOp (l16hedge)
  V.l16hedge = (tk) => { lv.L16HEDGE = tk.length > 1 ? atoi(tk[1]) : K.L16_HEDGE; P('OK l16hedge %d\n', lv.L16HEDGE); };
  // C++: mesh.cpp:runOp (l16fan)
  V.l16fan = (tk) => { lv.L16FAN = tk.length > 1 ? atoi(tk[1]) : -1; P('OK l16fan %d\n', lv.L16FAN); };
  // evilknock K: K adversary joiners (not in N, not in joinstat) that knock, ask every listed greeter, never close a door, never take a seat
  // C++: mesh.cpp:runOp (evilknock)
  V.evilknock = (tk) => {
    const k = tk.length > 1 ? atoi(tk[1]) : 1;
    for (let q = 0; q < k; q++) { const id = spawnSeat(); seats[id] = new Seat(id, w); alive[id] = 1; seats[id].evilDoor = true; if (lv.NETGRP) X.netSetGrp(id, 0); seats[id].join(); }
    P('OK evilknock %d\n', k);
  };
  // C++: mesh.cpp:runOp (l15settle)
  V.l15settle = (tk) => { lv.L15_SETTLE = tk.length > 1 ? atoi(tk[1]) : 4; P('OK l15settle %d\n', lv.L15_SETTLE); };
  // C++: mesh.cpp:runOp (realcheck, rss)
  V.realcheck = (tk) => { E_('rcVerb', tk); };   // harness/realcheck.js
  V.rss = (tk) => {
    let hwm = -1, rss = -1;
    try { for (const l of require('fs').readFileSync('/proc/self/status', 'utf8').split('\n')) { if (l.startsWith('VmHWM:')) hwm = parseInt(l.slice(6), 10); else if (l.startsWith('VmRSS:')) rss = parseInt(l.slice(6), 10); } } catch (e) { /* no /proc */ }
    let nalive = 0; for (let q = 0; q < Math.min(lv.nextId, alive.length); q++) if (alive[q] === 1) nalive++;
    P('RSS tick=%lld N=%d alive=%d hwm_kb=%ld rss_kb=%ld\n', TICK(), lv.N, nalive, hwm, rss);
  };
  // C++: mesh.cpp:runOp (pcstrack)
  V.pcstrack = () => { lv.PCS_TRACK = true; E_('pcsPeakReset'); P('OK pcstrack\n'); };
  // killspread <frac> <ticks> [crash]: the departure of `kill <frac>` spread uniformly over the next <ticks> ticks
  // C++: mesh.cpp:runOp (killspread)
  V.killspread = (tk) => {
    const frac = tk.length > 1 ? atof(tk[1]) : 0.5; let wn = tk.length > 2 ? atoll(tk[2]) : 60; lv.KILLQ_CRASH = tk.length > 3 && tk[3] === 'crash'; if (wn < 1) wn = 1;
    const ids = []; for (let q = 0; q < lv.nextId; q++) if (alive[q]) ids.push(q); const nk = Math.trunc(lv.N * frac); const pick = [];
    { const u = new Set(); while (pick.length < nk && pick.length < ids.length) { const j = Math.trunc(grnd() * ids.length); if (!u.has(j)) { u.add(j); pick.push(ids[j]); } } }
    for (const q of pick) { let t = TICK() + 1 + Math.trunc(grnd() * wn); if (t > TICK() + wn) t = TICK() + wn; let sl = fab.KILLQ.get(t); if (!sl) { sl = []; fab.KILLQ.set(t, sl); } sl.push(q); }
    P('OK killspread %zu over %lld ticks (%s), N %d -> %d\n', pick.length, wn, lv.KILLQ_CRASH ? 'crash' : 'leave', lv.N, lv.N - pick.length);
  };
  // the tier levers (tiermix tier tierhold tiercells viewcheck tierstat natstat tierwatch tierquiet tierperiod tierlead tierhops)
  for (const op of ['tiermix', 'tier', 'tierhold', 'tiercells', 'viewcheck', 'tierstat', 'natstat', 'tierwatch', 'tierquiet', 'tierperiod', 'tierlead', 'tierhops']) V[op] = (tk) => { X.tierLever(tk); };

  // C++: mesh.cpp:runOp
  function runOp(tk) {
    const op = tk[0];
    const fn = V[op];
    if (fn) { const r = fn(tk); return r !== false; }
    if (NOT_PORTED.has(op)) throw new NotPorted(op);
    P('ERR unknown: %s\n', op);
    return true;
  }

  fab.runOp = runOp;   // feedcase (media.js) applies its cuts through the ops, as the C++ feedCase calls runOp
  return { runOp, verbs: V, NOT_PORTED, EXTERNAL_VERBS, parseCell };
}

module.exports = { createOps, NotPorted, NOT_PORTED, EXTERNAL_VERBS };
