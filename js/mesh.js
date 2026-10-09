/*
 * mesh.js — the GifOS no-root mesh CONTROL PLANE, a faithful port of the C++
 * reference sim (test/sim/mesh.cpp + test/sim/mesh_seat.inc + test/sim/topo.h). This is the
 * production seating + healing brain; docs/healing-laws.md is its law catalog
 * and docs/sim-split-brain.md the anti-divergence casebook (7 fixed bugs —
 * every one of them is mirrored here, do not regress them).
 *
 * The doctrines carried over from the green sim (kill 0.1–0.6 × seeds 1–50 →
 * 0 dups / 0 stranded / 0 teleport; total partition → two clean homes):
 *   W7  — Section 1 (pc==0) is the 5×5 ROOK'S GRAPH: row + column + down,
 *         uniform degree 9. Deep sections keep the sparse transpose.
 *   C3  — fixed-designation healing: ONE healer per hole, known in advance
 *         (down-child VERTICAL; childless head's right-neighbour HORIZONTAL;
 *         reactive + proactive LEFT-PACK; the probe-gated head backstop
 *         s1Fill). lowestSurvivor is RETIRED — no computed opinions.
 *   S5  — healing fills holes, never makes them: a fill lands only on a coord
 *         its healer has itself, first-hand, stopped hearing.
 *   E2  — liveness is FIRST-HAND only (PHONE/PONG/HELLO/CLAIM). Gossip
 *         (S1SYNC) informs routing, NEVER evicts, never resurrects. Tenure
 *         protects the sitting occupant; ties break lower-id-wins everywhere.
 *   H1-S1 — ring-heal conservatism: a home cell is refilled only after its
 *         occupant is unreachable via ALL rook paths for RING_HOLD (probe-
 *         gated ringConfirmDead). Hold a hole, never mint a duplicate.
 *
 * It is TRANSPORT-AGNOSTIC. A Seat holds all its own state (occ map, live,
 * s1seen, cousins, roster, …) and talks to the outside only through an injected
 * `env`:
 *   env.TICK            current logical time (a monotonically rising integer —
 *                       the heartbeat count in production, the tick in the sim)
 *   env.HEALING         master heal enable (always true in production)
 *   env.send(from,to,m) deliver control message m from peer `from` to peer `to`
 *                       (WebRTC data channel in production; the sim's bus in test)
 *   env.knock(from,key) knock the relay presenting genesis-key token `key`
 *                       (relay WebSocket in production; the modelled registry in test)
 *   env.wake(id)        mark a seat active (scheduler hint; may be a no-op)
 *   env.peek(id)        OPTIONAL (test harness only): the sim's global peer view
 *                       {hasCoord, coord, socketed, gateway} — enables the sim's
 *                       Option A owned-link routing enforcement (no teleports).
 *                       Production leaves it undefined: mesh-wire owns delivery.
 *   env.bumpMoves/bumpEvict  optional metrics counters (test only)
 *
 * Peer IDs are opaque but TOTALLY ORDERED (integers in the sim, peer-id strings
 * in production) — the healing tie-breaks need only a consistent order, so
 * string `<` works exactly like the sim's numeric `<`. Absent occupancy is
 * `null` (the sim's -1 sentinel); ckey() is a STRING map key (no uint64 in JS).
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};
  const net = GifOS.net;
  const topo = net.topo;
  const ck = topo.ckey, unck = topo.unck;
  const C = () => net.SCALE.C;

  // ---- constants (mirror test/sim/mesh.cpp — SWEPT values, tuned for C=5 and the
  // lastPhone>=8 heartbeat cadence; re-sweep in the sim before changing) ----
  const RELAY_TTL = 500;     // greeter entry lifetime (ticks)
  const FORK_GRACE = 8;      // R5 probe: ticks after the latest HOME before a still-silent greeter counts as dark (4 s at the production tick; the harness's first-contact delay spreads HOMEs by up to 5)
  const RELAY_CAP = 72;      // max greeter entries the relay holds
  const E3_PERIOD = 200;     // Section-1 re-knock cadence (< RELAY_TTL so live seats stay listed)
  const STRAND_TTL = 500;    // R6: unreachable-for-this-long ⇒ take over (empty) or stranded (recoverable — retry after backoff)
  // H1-S1 RING-HEAL CONSERVATISM (W7): a HOME (Section-1) cell is refilled only
  // after its occupant has been unreachable via ALL its rook-redundant paths for
  // this settled window — far higher than the deep-tree confirmation (60),
  // because the rook has many paths to exhaust. A wrong ring-heal is the one act
  // that mints a divergent home; a held hole is a recoverable availability dip.
  const RING_HOLD = 220;     // test/sim/mesh.cpp RING_HOLD
  const OWNER_SILENT = 40;   // test/sim/mesh.cpp OWNER_SILENT — 5 unanswered 8-tick phone beats arms the ghost-target probe
  const LONE_GREET_AFTER = 16; // test/sim/mesh.cpp LONE_GREET_AFTER — two silent 8-tick beats before a lone Section-1 seat greets the door (loneGreet)
  // A three-state occupancy: soft sitting-down TTL + assigner recheck (loss wedge).
  const SIT_TTL = 90, SIT_RECHECK = 25;
  // V4 probe window: free a silent vouch only after a SITPING went unanswered
  // this long (delivery is bounded per leg, so 15 covers the round trip; a
  // killed tab frees at 25+15=40 — inside the ghost-churn budget).
  const SIT_PING_WAIT = 15;
  // FINDACK (test/sim/mesh.cpp FIND_ACK_WAIT — MUST match): a lost FIND or
  // PLACE cost a seeker the full 60-tick state-2 window in any room with two
  // or more greeters, because silence and a slow admitter hand-off looked the
  // same and re-asking early raced the slow chain into twin vouches (sim
  // join-patterns N=9 'serial 8' red at 12). Now the greeter a seeker asked
  // either answers it (PLACE / NOROOM) or, when it hands the FIND on, sends
  // FINDACK — so silence past FIND_ACK_WAIT means nothing is in flight to race.
  // A lost PLACE is the admitter's to repair, since it holds the vouch: it
  // replays the PLACE once if the vouch is unconfirmed at PLACE_REPLAY, again
  // on a still-seeking SITPONG, and to a re-ask that reaches it (the SAME
  // chair — never a twin vouch).
  const FIND_ACK_WAIT = 12, PLACE_REPLAY = 12;
  const DOOR_ROUND_WAIT = 8;
  const DARK_WAIT = 6;         // a greeter I asked WHOHOME at the door and that has not answered for 6 ticks is dark to me (FIND's dark list)
  const DARK_ASK_FRESH = 60;   // ...while my latest ask to it is at most 60 ticks old
  const KNOCK_FRESH = 40;      // a FIND from x in the last 40 ticks: x is knocking (serveFind's split-off guard)   // a door round's answers are in after 8 ticks (doorRound; app-paced every few seconds)
  // D5 EARLY-PROBE (healing-laws D5): when MY OWN transport to a neighbour dies
  // (DataChannel close / hard pc failure — a FIRST-HAND observation, never
  // gossip), the confirm probe may start immediately instead of waiting out the
  // silence horizon. EARLY_HOLD is the settled window the probe gets on the
  // mesh's redundant paths before the death is confirmed: long enough for a
  // probe round trip plus a retry (probes re-fire every ~6 ticks while
  // pending), short enough that an ungraceful death is confirmed in seconds.
  // The horizon (60 / RING_HOLD) remains the backstop when no transport event
  // fired; an answered probe clears the observation entirely.
  const EARLY_HOLD = 12;     // test/sim/mesh.cpp EARLY_HOLD
  // T — the mover's lease (atomic seat switching, healing-laws.md law T).
  // A self-move TAKES its new seat FIRST and vacates the old one only when the
  // claim CONFIRMS; a contradiction rolls the mover back to its still-held old
  // seat. After confirm the old cell keeps a bounded FORWARDING TOMBSTONE.
  const CONFIRM_TTL = 16;    // test/sim/mesh.cpp CONFIRM_TTL
  const LEASE_TTL = 40;      // test/sim/mesh.cpp LEASE_TTL
  // TENURE (law S2/S5, docs/meet-security.md §AUTH): a seat I have heard
  // first-hand at its cell for TENURE ticks is that cell's INCUMBENT, and a
  // claim from anyone not linked there before never displaces it, whatever
  // its id (E2's lower-id tie-break settles only races between fresh claims
  // and revivals). FRESH: a seat is fresh for this long after it took its
  // cell or regained its neighbours after a silence of NBR_GAP ticks; only a
  // fresh seat, or an arbiter linked within FRESH ticks of the seat's
  // (re)establishment, may unseat it.
  const TENURE = 40;         // test/sim/mesh.cpp TENURE
  const FRESH = 60;          // test/sim/mesh.cpp FRESH
  const PEND_Y = 40;         // test/sim/mesh.cpp PEND_Y — a YIELD waits this long for its arbiter's hearing PONG or proof verdict
  const LEDGER_GRACE = 100;  // test/sim/mesh.cpp LEDGER_GRACE — a head's row ledger carries generation 0 (deletes nothing at the owner) for this long after it seats (V7b)
  const UNPROVEN_HOLD = 60;  // test/sim/mesh.cpp UNPROVEN_HOLD — an unproven pairing past this age lives only on probe answers (§AUTH H6)
  const NBR_GAP = 60;        // test/sim/mesh.cpp NBR_GAP
  const HELD_BEATS = 24;     // test/sim/mesh.cpp HELD_BEATS — 3 D1 rook beats: the occupant is answering me RIGHT NOW (promoteInto)
  // Q2 — COMPACTION (roadmap §3, healing-laws law T): a settled deep LEAF that a
  // fresh probe would place STRICTLY SHALLOWER walks its own ALIVE up-chain and
  // joins the nearest strictly-shallower OCCUPIED row (densify) via an atomic
  // law-T move. Rate-limited + local-quiescence-gated so a healing boundary never
  // sloshes; depth is a monotone potential ⇒ MOVES provably settle.
  const COMPACT_PERIOD = 90; // test/sim/mesh.cpp COMPACT_PERIOD — min ticks between one leaf's compaction probes
  const COMPACT_SETTLE = 300; // test/sim/mesh.cpp COMPACT_SETTLE — quiescence window since seating / last heal / last move / last local churn. ABOVE the healing horizons so a mass-heal fully re-converges before compaction stirs the tree (a shorter window ~2x'd mass-heal convergence and flaked the churn sweep).
  const COMPACT_TTL = 30;    // test/sim/mesh.cpp COMPACT_TTL — up-chain hop budget for a compaction probe
  const CHILD_LEDGER_H = 300; // test/sim/mesh.cpp CHILD_LEDGER_H — no child-row ledger this long ⇒ an unheard child cell is an echo (= COMPACT_SETTLE, above every healing horizon)
  // T7 SPREAD-AFTER-NOROOM (test/sim/mesh.cpp SPREAD, `spreadon 0|1`;
  // docs/front3-descent-2026-08-06.md). On a FIND whose seeker has already
  // been told NOROOM to its face, a reachable-but-unheard sibling may compete
  // in pass 0 of the descent. DEFAULT OFF, in lockstep with the sim: the two
  // twins must flip together, and OFF is byte-identical to the pre-T7 brain.
  const SPREAD = true;       // test/sim/mesh.cpp SPREAD — MUST match the sim default (ON since 2026-09-17)
  // The evidence is GRADED BY DEPTH (sim SPREAD_MINDEPTH, `spreaddepth n`): a
  // NOROOM counts only when the seat that answered it sits at depth >= this.
  // A shrinking room's NOROOMs come from depths 0-2 (a home row refilling, a
  // shallow row settling) — spreading on those opened sections that a heal
  // would have packed and chain-local compaction can never reach (measured
  // 2026-09-17, repro-compaction leg 1). The plateau's NOROOMs come from the
  // depth wall. 4 is the smallest grade above what a shallow room produces;
  // N=5000 converges at 3840 ticks with it (never, without spread).
  const SPREAD_MINDEPTH = 4; // test/sim/mesh.cpp SPREAD_MINDEPTH — MUST match the sim default
  const PROBLVL = 3;         // test/sim/mesh.cpp PROBLVL (`problvl n`) — cap the probe's climb at n levels above the seeker. ON at 3 since 2026-09-17: at N=20000 settled it takes the hot S1 seat from 15.15 to 3.42 frames/tick (probes reaching S1 in a 6000-tick window 441,480 -> 5,087) with compaction intact; 2 (the 2026-08-07 sweep's value) went RED on repro-compaction leg 1 at N=300, 3 is green there. MUST match the sim default — twins never diverge.

  // ---- V1 ROLLUP DIGEST (healing-laws.md § G) — faithful port of the sim's
  // digest machinery (test/sim/mesh.cpp Dig + mesh_seat.inc rollup/pubDig/
  // noteUp/upRefuted/scopeGap). FLAG-GATED, DEFAULT OFF: every digest site is
  // behind env.DIGEST === true. The sim runs it ON and its gate
  // (test/sim/repro-digest.sh, 47 assertions) is green; the browser flips it
  // on only when the small-room e2e is proven byte-identical (scale-audit
  // sequencing step 4). G0: digests ride EXISTING frames — dgUp on PHONE,
  // dgPub/dgEcho/dgRoot on PONG, digs on S1SYNC — not one new frame type, no
  // new timer, no decision. G1: display only — nothing below may evict, seat,
  // move, admit, heal, or release privacy state. test/mesh/digest.js asserts
  // the ON≡OFF trajectory identity that makes G0/G1 mechanical.
  const DIG_TTL = 60;        // test/sim/mesh.cpp DIG_TTL — a report older than this is stale (G3: stale ⇒ fail-closed)
  const DIG_LOSS_H = 300;    // test/sim/mesh.cpp DIG_LOSS_H — the fail-closed blur horizon (spans RING_HOLD, the longest confirm window)
  const DIG_HOLD_LEVEL = 16; // test/sim/mesh.cpp DIG_HOLD_LEVEL — the handover hold: two pulse periods per tree level (see take())
  // The digest record (sim struct Dig). by=null is the sim's by=-1; at=-1 means "never computed".
  // § G9 ROOM-GLOBAL LISTS (healing-laws G9; sim: mesh.cpp LE/VE, listMerge,
  // digFold, digTrim, listHolds, votesHold — same rules). hands {id,k,nm},
  // stage {id,k,f,nm,dv}, apps {id,k,a}, votes {tgt,up,dn}; handN/awayN counts.
  // The browser entries carry payload the sim does not — nm a short name, dv the
  // stager's room-salted device tag (vote exclusion is keyed by device), a the
  // whole app ad a joiner needs to enter the app (its session secret included:
  // digests ride only mesh edges, sealed under the same room key as the status
  // they replace). Payload rides along, never orders, and is in the fidelity key
  // so an echo must reproduce it too.
  const K_HAND = 8, K_APP = 3, K_VOTE = 16;
  const K_STAGE = () => 2 * C();
  const dig0 = () => ({ n: 0, refuse: 0, freeC: 0, at: -1, by: null, dmin: 99, part: 0, handN: 0, awayN: 0, hands: [], stage: [], apps: [], votes: [] });
  const leAsc = (a, b) => (a.k !== b.k ? a.k - b.k : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));   // earliest first (hands, stage claims)
  const leDesc = (a, b) => (a.k !== b.k ? b.k - a.k : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));  // newest first (app ads)
  const veOrd = (a, b) => { const ta = a.up + a.dn, tb = b.up + b.dn; return ta !== tb ? tb - ta : (a.tgt < b.tgt ? -1 : a.tgt > b.tgt ? 1 : 0); };
  // top-K of the union, one entry per author (an author appears twice only across a cell handover: keep its best-ranked entry)
  const listMerge = (dst, src, K, asc) => {
    if (!src || !src.length) return dst;
    const all = dst.concat(src).sort(asc ? leAsc : leDesc), out = [], seen = new Set();
    for (const e of all) { if (out.length >= K) break; if (!seen.has(e.id)) { seen.add(e.id); out.push(e); } }
    return out;
  };
  const voteAdd = (acc, v) => { for (const a of acc) if (a.tgt === v.tgt) { a.up += v.up; a.dn += v.dn; return; } acc.push({ tgt: v.tgt, up: v.up, dn: v.dn }); };
  const digFold = (dst, s) => {
    dst.n += s.n; dst.refuse += s.refuse; dst.freeC += s.freeC; if (s.dmin < dst.dmin) dst.dmin = s.dmin; if (s.part) dst.part = 1;
    // POPULATION-BOUNDED CLAIMS, per INPUT: no more hands, away devices or votes
    // for any target than the head count the report is published with.
    const cap = s.n < 0 ? 0 : s.n;
    dst.handN += Math.min(s.handN || 0, cap); dst.awayN += Math.min(s.awayN || 0, cap);
    dst.hands = listMerge(dst.hands, s.hands, K_HAND, true); dst.stage = listMerge(dst.stage, s.stage, K_STAGE(), true); dst.apps = listMerge(dst.apps, s.apps, K_APP, false);
    for (const v of (s.votes || [])) voteAdd(dst.votes, { tgt: v.tgt, up: Math.min(v.up, cap), dn: Math.min(v.dn, cap) });
  };
  // Close a level: population clamps, then the ONE vote truncation (sums may only UNDER-count).
  const digTrim = (d) => {
    const cap = d.n < 0 ? 0 : d.n;
    if (d.handN > cap) d.handN = cap; if (d.awayN > cap) d.awayN = cap;
    for (const v of d.votes) { if (v.up > cap) v.up = cap; if (v.dn > cap) v.dn = cap; }
    d.votes.sort(veOrd); if (d.votes.length > K_VOTE) d.votes.length = K_VOTE;
  };
  // G4 fidelity key over the list fields (sim: digListHash): an echo must reproduce what I sent.
  const digListKey = (d) => JSON.stringify([d.handN || 0, d.awayN || 0, d.hands || [], d.stage || [], d.apps || [], d.votes || []]);
  // G4 monotonicity for a list: each entry I authored is in the published fold, or the fold is FULL of K entries that all outrank it.
  const listHolds = (pub, mine, K, asc) => {
    for (const e of (mine || [])) {
      if ((pub || []).some((p) => p.id === e.id && p.k === e.k)) continue;
      if (!pub || pub.length < K) return false;
      for (const p of pub) if (!((asc ? leAsc : leDesc)(p, e) < 0)) return false;
    }
    return true;
  };
  const votesHold = (pub, mine) => {
    for (const v of (mine || [])) {
      const hit = (pub || []).find((p) => p.tgt === v.tgt);
      if (hit) { if (hit.up < v.up || hit.dn < v.dn) return false; continue; }
      if (!pub || pub.length < K_VOTE) return false;
      for (const p of pub) if (p.up + p.dn < v.up + v.dn) return false;
    }
    return true;
  };
  // A digest off the WIRE is untrusted input: every field typed, every list
  // capped at its K, every string bounded, or the report is refused whole. (The
  // sim's fabric is trusted; this is the browser's boundary, not a law.)
  const INT = (x) => Number.isInteger(x);
  const STR = (x, n) => typeof x === 'string' && x.length <= n;
  const AD_STR = ['s', 'k', 'relay', 'name', 'pk', 'byName'], AD_BOOL = ['mesh', 'audio'];   // run.html's myStatus.app shape
  const saneAd = (a) => !!a && typeof a === 'object' && !Array.isArray(a)
    && Object.keys(a).every((k) => AD_STR.indexOf(k) >= 0 || AD_BOOL.indexOf(k) >= 0 || k === 'ts')
    && AD_STR.every((k) => a[k] === undefined || a[k] === null || STR(a[k], 256))
    && AD_BOOL.every((k) => a[k] === undefined || typeof a[k] === 'boolean')
    && (a.ts === undefined || Number.isFinite(a.ts));
  const copyAd = (a) => { const o = {}; for (const k of AD_STR) if (a[k] !== undefined && a[k] !== null) o[k] = a[k]; for (const k of AD_BOOL) if (a[k] !== undefined) o[k] = a[k]; if (a.ts !== undefined) o.ts = a.ts; return o; };
  const saneLE = (e, kind) => !!e && STR(e.id, 64) && Number.isFinite(e.k) && (e.f === undefined || INT(e.f)) && (e.nm === undefined || STR(e.nm, 24))
    && (e.dv === undefined || STR(e.dv, 16)) && (kind !== 'app' || e.a === undefined || saneAd(e.a));
  const digSane = (d) => {
    if (!d || typeof d !== 'object' || !INT(d.n) || !INT(d.refuse) || !Number.isFinite(d.at)) return null;
    const o = { n: d.n, refuse: d.refuse, freeC: INT(d.freeC) ? d.freeC : 0, at: d.at, ag: INT(d.ag) && d.ag >= 0 ? Math.min(d.ag, 1 << 20) : 0, by: d.by == null ? null : String(d.by).slice(0, 64), dmin: INT(d.dmin) ? d.dmin : 99, part: d.part ? 1 : 0,
      handN: INT(d.handN) && d.handN >= 0 ? d.handN : 0, awayN: INT(d.awayN) && d.awayN >= 0 ? d.awayN : 0, hands: [], stage: [], apps: [], votes: [] };
    const lists = [['hands', K_HAND, 'hand'], ['stage', K_STAGE(), 'stage'], ['apps', K_APP, 'app']];
    for (const [f, K, kind] of lists) {
      const a = d[f]; if (a === undefined) continue;
      if (!Array.isArray(a) || a.length > K || !a.every((e) => saneLE(e, kind))) return null;
      o[f] = a.map((e) => { const c = { id: e.id, k: e.k }; if (e.f !== undefined) c.f = e.f; if (e.nm !== undefined) c.nm = e.nm; if (e.dv !== undefined) c.dv = e.dv; if (e.a !== undefined) c.a = copyAd(e.a); return c; });
    }
    if (d.votes !== undefined) {
      if (!Array.isArray(d.votes) || d.votes.length > K_VOTE || !d.votes.every((v) => v && STR(v.tgt, 16) && INT(v.up) && v.up >= 0 && INT(v.dn) && v.dn >= 0)) return null;
      o.votes = d.votes.map((v) => ({ tgt: v.tgt, up: v.up, dn: v.dn }));
    }
    return o;
  };
  // The wire form drops every field still at its default — digSane restores
  // them (absent list ⇒ [], absent count ⇒ 0), so a packed report reads back
  // identically and the G4 fidelity key (digListKey) cannot tell the two apart.
  // Measured: an empty-list digest was ~2.3× the control plane's bytes/node.
  const digPack = (o) => {
    if (!o.freeC) delete o.freeC; if (o.dmin === 99) delete o.dmin; if (!o.part) delete o.part; if (!o.ag) delete o.ag;
    if (!o.handN) delete o.handN; if (!o.awayN) delete o.awayN;
    for (const f of ['hands', 'stage', 'apps', 'votes']) if (!o[f] || !o[f].length) delete o[f];
    return o;
  };
  // THE STUB (wire form). A digest nobody echoes — the room fold on PONG, the
  // Section-1 table on S1SYNC, the section digest rook peers exchange — is
  // sent WHOLE only when its content changed or STUB_FULL ticks have passed
  // since the last whole copy to that peer; in between it goes as a stub:
  // { stub, at, ag, h } — "what I last sent you is still true, and this old".
  // h is a hash of the CONTENT, recomputed by the receiver over what it
  // holds: a stub that does not match is ignored and the entry ages until the
  // next whole copy (inside DIG_TTL), so a lost frame costs freshness, never
  // truth. G4's subjects (dgUp to an aggregator, dgPub, dgEcho) are never
  // stubbed. Measured on a settled room with every list at its cap: a
  // Section-1 phone's S1SYNC bytes fall ~4x.
  // A receiver that cannot match a stub says so on the next frame it already
  // sends that peer (`dw`, the slots it wants whole — G0: no new frame), so the
  // periodic whole copy is only a backstop for a lost request.
  const STUB_FULL = 240;
  // The flood guard's per-link budget for NEW gossip messages (see _gspRecv):
  // 10 a tick is 20 a second at the production 500 ms tick; the burst covers a
  // newcomer being handed the 64-message backlog by several neighbours at once.
  // A seat therefore takes at most links x GSP_RATE new messages a tick, in a
  // room of any size. (env.GSP_GUARD === false turns it off: harness controls only.)
  const GSP_RATE = 10, GSP_BURST = 200;
  const GSP_SRC_RATE = 2, GSP_SRC_BURST = 80;   // one author, on one link: 4 a second, and the 64-message backlog in one go
  const digHash = (d) => {
    if (d._h) return d._h;
    const t = JSON.stringify([d.n, d.refuse, d.part ? 1 : 0, d.freeC || 0, d.dmin === undefined ? 99 : d.dmin, digListKey(d)]);
    let a = 2166136261 >>> 0, b = 0x9e3779b9 >>> 0;
    for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); }
    Object.defineProperty(d, '_h', { value: (a >>> 0).toString(36) + (b >>> 0).toString(36), enumerable: false });
    return d._h;
  };
  const leCopy = (e) => { const c = Object.assign({}, e); if (e.a) c.a = Object.assign({}, e.a); return c; };
  const digCopy = (d) => ({ n: d.n, refuse: d.refuse, freeC: d.freeC, at: d.at, by: d.by, dmin: d.dmin, part: d.part, handN: d.handN || 0, awayN: d.awayN || 0,
    hands: (d.hands || []).map(leCopy), stage: (d.stage || []).map(leCopy), apps: (d.apps || []).map(leCopy), votes: (d.votes || []).map((v) => ({ tgt: v.tgt, up: v.up, dn: v.dn })) });

  // A Section-1 key has pc==0 — its string ckey starts "0_".
  const isS1key = (k) => k.charCodeAt(0) === 48 && k.charCodeAt(1) === 95;
  // ---- WIRE CELL KEYS (frame authority, docs/meet-security.md §AUTH) ------
  // A cell key from a peer is ckey()'s three decimal fields and nothing else:
  // r and i are columns of this C, every digit of the section path is a
  // column (childPath(pc, d) = 6pc + d + 1 with d < C), and the path is no
  // deeper than the depth wall. Anything else used to land in occ, live,
  // born, fhEver and s1seen and be walked on every beat (10,000 junk keys grew
  // occ by 7,820 — test/mesh/forged-frames.js A8). Twin: mesh_seat.inc cellOk.
  const MAXDEPTH = 12;
  const pathOk = (pc) => { if (!Number.isInteger(pc) || pc < 0 || pc > 0xffffffff) return false; let d = 0; while (pc > 0) { if ((pc - 1) % 6 >= C()) return false; pc = Math.floor((pc - 1) / 6); if (++d > MAXDEPTH) return false; } return true; };
  const cellKeyOk = (k) => {
    if (typeof k !== 'string' || k.length > 24) return null;
    const p = k.split('_'); if (p.length !== 3) return null;
    for (const f of p) if (!/^(0|[1-9][0-9]*)$/.test(f)) return null;
    const c = { pc: +p[0], r: +p[1], i: +p[2] };
    if (c.r >= C() || c.i >= C() || !pathOk(c.pc)) return null;
    return c;
  };
  const coordOk = (c) => !!c && typeof c === 'object' && Number.isInteger(c.r) && c.r >= 0 && c.r < C() && Number.isInteger(c.i) && c.i >= 0 && c.i < C() && pathOk(c.pc);
  const s1KeyOk = (k) => { const c = cellKeyOk(k); return !!c && c.pc === 0; };
  // A roster is what a seat re-seats AGAINST (HOME in the dance, DRAIN's
  // fan-down): a non-empty list of {k: cell key, v: peer id}. It arrives off
  // the wire, so its shape is checked before it is stored — a roster-less or
  // junk DRAIN used to leave tick() throwing on `roster.length` every tick.
  // (621f699e; unchanged here — a roster's keys never index occ.)
  const rosterOk = (r) => Array.isArray(r) && r.length > 0 && r.every((e) => e && typeof e.k === 'string' && (typeof e.v === 'string' || typeof e.v === 'number'));
  // ownerCoordOf(c): the coord that owns cell c (its head's up), or null for Section 1.
  const ownerCoordOf = (c) => (c.pc === 0 ? null : topo.up({ pc: c.pc, r: c.r, i: 0 }));
  // A tiny non-crypto key hash for the modelled relay / genesis identity. In
  // production the relay hashes with SHA-256; here only equality + "is set" matter.
  function keyHash(s) {
    let h = 2166136261 >>> 0; const str = String(s);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16) || '1';
  }

  let SEAT_SERIAL = 0;   // forensics: which Seat object this is (two in one page are distinguishable)
  class Seat {
    constructor(id, env) {
      this.serial = ++SEAT_SERIAL;
      this.id = id; this.env = env;
      this.state = 0;            // 0 join, 1 ask, 2 search, 3 seated
      this.hasCoord = false; this.coord = { pc: 0, r: 0, i: 0 };
      this.occ = new Map(); this.live = new Map(); this.s1seen = new Map();
      // liveBy: WHO I last heard first-hand at a cell (liveMark's id). A
      // cell's `live` stamp outlasts an occupancy change (gossip, a hint, a
      // PONG row can rewrite occ under it), so a question about a SEAT's
      // liveness — "is my arbiter x really there?" — reads both (heardAt).
      // linkedBy: the id a TRANSPORT-PROVEN frame last placed at a cell. An
      // unproven heartbeat never refreshes a pairing a link has proven (a
      // crashed seat must not be kept alive by anyone's say-so).
      // tenOf: the tenancy nonce a proven frame announced for (cell, id) — a
      // goodbye from an older tenancy frees nothing (a replayed LEAVE).
      this.liveBy = new Map(); this.linkedBy = new Map(); this.tenOf = new Map();
      // heardSince: when I first heard the current first-hand pairing at a
      // cell (reset after a 60-tick gap) — the incumbent's TENURE.
      // linkedSince: when a link first proved the current pairing there.
      // wasAt: the seats a link proved at a cell BEFORE the current one (a
      // revival is no raw claim). estAt/nbrAt: when I took my cell or last
      // regained my neighbours (FRESH); probeOut: my probes' nonces.
      this.heardSince = new Map(); this.linkedSince = new Map(); this.wasAt = new Map();
      this.rival = null;   // the last link-proven seat that claimed my cell (loneAsk)
      this.movedClaim = null;   // a seat held elsewhere that claimed my cell: its old cell under a D5 probe until confirmed or answered
      this.waitClaim = new Map();   // cell -> { id, at }: a lower-id unproven claim on a cell a live incumbent holds, installed as a hint if the incumbent's goodbye frees it (HELLO branch)
      this.carrySince = new Map();   // a neighbour's goodbye named where it went (mvd): the pairing's linkedSince travels to that cell when its link proves it there (bounded, 60 ticks)
      this.estAt = 0; this.nbrAt = -1; this.oldEstAt = 0; this.pnSeq = 0; this.xrOk = new Map();
      this.pairAt = new Map(); this.pongBy = new Map();   // the tick (MY clock, local only — never gossip's word) each cell's current pairing was made: the entry window
      // PLACEMENT PROOF (PP, §AUTH): pp — the admitter-signed statement that
      // placed me at my cell ({ck, s4}); oldPp — the one for the cell I still
      // hold mid-move. ppAt — verified proofs others presented, per cell and
      // claimant; oldPP — the proof a seat held at a cell before it was
      // displaced there (a revival must present a newer one); ppGiven — the
      // grants I issued lately; ppAskAt — when I last asked my admitter for
      // one. rowGen — the generation of the row ledger I phone my owner;
      // rowGenSeen — the last generation my down-child head phoned me.
      // gbProbe — goodbyes about a cell someone else holds in my view, under
      // probe; upAck — a probe answer that keeps a never-proven pairing alive.
      this.backAt = -1; this.pp = null; this.oldPp = null; this.admBy = null; this.oldAdmBy = null; this.ppAt = new Map(); this.oldPP = new Map(); this.ppGiven = new Map(); this.ppAskAt = -1;
      this.rowGen = 0; this.rowLedgerLast = ''; this.rowGenSeen = null; this.gbProbe = new Map(); this.upAck = new Map(); this.upExpired = new Map(); this.upUsed = new Map(); this.upOpen = new Map(); this.upProbeAt = -1;
      this.tn = null; this.oldTn = null; this.tnSeq = 0; this.pendY = null; this.tnSalt = (env && env.tnSalt) ? String(env.tnSalt) : String(id).slice(-6);   // the wire supplies per-page entropy; buses stay deterministic
      // born: CLAIM BIRTH — the tick (on MY clock, LT) each (cell → claimant)
      // pairing was first established, locally or carried end-to-end in S1SYNC
      // as an AGE (entry field ba, G0b). Gates the gossip tie-break: an
      // ancient claim never wins a tie.
      this.born = new Map();
      this.healTry = new Map(); this.healOnly = new Set(); this.cousins = new Map(); this.fwdSeen = new Map();   // seekers whose FIND I handed a door-listed-only admitter (serveFind)
      this.kidful = new Map(); this.childOf = new Map();
      // A three-state: soft sitting-down marks {joiner, assigner, at} by cell key.
      this.sitting = new Map();
      this.rowLedger = true;   // V4: false only while a vouched-in S1 row head awaits its assigner's SITXFER
      // V4: MONOTONE first-hand-ever — `live` entries are erased by attributed
      // clears (current-liveness semantics); "have I EVER heard this cell
      // first-hand" must survive them (the devolution-narrowing predicate).
      this.fhEver = new Set();
      // holeSince: when a Section-1 cell I don't hear first-hand first looked
      // like a hole (H1-S1 confirm-window timer, probe-gated ringConfirmDead)
      this.holeSince = new Map();
      // D5 early-probe state (all keyed by coord ckey):
      //   translost: when MY transport to that coord's occupant died (edge-
      //              triggered — set once per transition, cleared on any answer)
      //   tlProbeAt: last tick a pending translost re-probed (probe pacing)
      //   probeAck:  last tick a ROUTE probe of that coord was ANSWERED (ROUTED
      //              with a live id). Deliberately NOT `live` (E2 untouched):
      //              a probe answer travels the mesh, so it can only ever
      //              PREVENT an early eviction, never evict or resurrect.
      this.translost = new Map(); this.tlProbeAt = new Map(); this.probeAck = new Map(); this.tlLog = []; // [k, tick, why] — last 24 forgotten observations (forensics)
      // PRODUCTION EXTENSION (no sim counterpart — the sim's harness reads occ
      // directly every tick; the app samples it). d5Deaths: each probe-
      // confirmed death tlSweep evicts, as a FACT the app drains — a same-tick
      // heal (the sole survivor promoting into the freed head seat) rebuilds
      // occ wholesale, so the app's diff-based departure intake is blind to
      // exactly the deaths that trigger a heal. A ledger changes no mesh
      // decision; it only makes the verdict deliverable.
      this.d5Deaths = []; // [k, pid, tick]
      this.retryAt = -1; this.seatTries = 0; this.lastPhone = -99; this.lastAck = 0;
      // ENTRY PACING (law tightened 2026-08-02): at most ONE knock and ONE
      // seat-ask per tick. The sim's bus already tick-paces every round trip,
      // but production recv is EVENT-driven — a NOROOM answered in
      // milliseconds re-asked in milliseconds, and a joiner facing a settling
      // row hosed the relay at network speed (measured: 4,000 entry frames in
      // 13s). The law always assumed the tick cadence; these guards make it
      // real. A same-tick repeat is DEFERRED (reAsk/reJoin), fired next tick.
      this.askTick = -1; this.joinTick = -1; this.reAsk = false; this.reJoin = false;
      this.healAt = -99; this.drainAt = 0; this.rosterAskAt = -999; this.xlinkAt = 0;
      this.seatedAt = 0; this.challAt = -999;   // "never": a 0 start paced a young seat (clock <= 20) out of every challenge
      this.s1CheckAt = -1;
      this.rookSeenAt = 0;   // last tick I heard ANY rook neighbour first-hand (split-off fragment detection)
      this.myKey = 'mk_' + id;   // throwaway personal genesis key (unique per seat)
      this.genKey = null;        // THIS meeting's genesis key (learned via the dance, or minted)
      this.joinStart = -1; this.stranded = false; this.evil = false; this.alive = true;
      // R6: lastReach = last tick I REACHED a greeter (a HOME roster came back).
      // Stranding requires having reached NONE for a full TTL — a busy room where
      // I keep getting NOROOM is competing for a slot, NOT stranded (bug #6).
      // joinStart is when this attempt got its FIRST greeter list, not when it
      // began knocking: time spent outside a full door (the relay's socket cap
      // answering 1013) reached nobody because nobody was offered, and counting
      // it stranded every flood joiner the moment it got in — each then idled a
      // further TTL holding one of the door's few joiner slots.
      this.lastReach = -1; this.strandedAt = 0;
      this.gateway = null;       // the greeter this (unseated) newcomer routes through
      // R5 / E5§2: multi-greeter HOME probe before seating. Cluster replies by
      // genesis key AND by roster overlap (same-key torn home = two greeter
      // halves the newcomer alone can see). Two+ clusters ⇒ human pick-one.
      // Faces for the UI: Stage first, else Stadium (app fills via HOME fields).
      this.lastTree = null; this.dr = null; this.drPrev = null;   // the tree I last sat in {gkey, n} and the door round (doorRound)
      this.prevTree = null;   // a reloaded page's last tree {gkey, ids} (mesh-wire opts.prevTree; R5 HOME intake)
      this.forkProbe = false; this.forkAt = -1; this.forkLastAt = -1; // forkLastAt: the tick the latest HOME sample landed
      this.forkSamples = []; // raw HOME samples before clustering
      this.forkOpts = new Map(); // optionId -> { id, gkey, gateway, roster, stage, stadium, faces }
      this.forkPending = 0; this.forkPaused = false;
      // ---- T: atomic seat switching (mover's lease) ----
      this.moving = false; this.moveAt = -1;        // transit: NEW seat taken, OLD not yet vacated (dual-hold)
      this.oldCoord = null; this.oldCk = null;      // the still-held old seat
      this.oldNbrIds = [];                          // old-link occupants — get the LEAVE(mvd) on confirm
      this.holdOcc = null; this.holdSeen = null; this.holdCous = null; // rollback snapshots
      this.leaseCk = null; this.leaseUntil = -1;    // T3: forwarding tombstone for my just-vacated cell
      this.compactAt = 0;        // Q2: next tick this leaf may probe for a shallower seat
      this.lastChurn = 0;        // Q2 hysteresis: last tick my neighbourhood churned (LEAVE/heal/move nearby) — compaction waits for local quiescence
      this.compactMoves = 0;     // Q2 observability: how many times I have compacted upward (surfaced via __gifosVideo.debugDump for the swarm live test)
      this.roster = []; this.haveRoster = false; this.lastGreeters = [];
      this.findAckAt = -1;       // FINDACK: the tick lastAsked acknowledged my outstanding FIND (-1 = not yet)
      this.findAckers = null;    // FINDACK: door ids whose build sends FINDACK (from the greeter list); null = every greeter does (the sim and harness fabrics)
      this.findNc = null;        // 03c: seeker of the serveFind scan in progress (knock-is-evidence phantom scope)
      this.noroomSeen = 0;       // T7: NOROOMs told to my face since I last entered the search (sim mesh.cpp noroomSeen) — only an EXPLICIT NOROOM counts, never a timeout
      // V7 THE DEEP-ROW LEDGER (sim mesh.cpp rowLedgerAt, 2026-09-17): the tick I
      // last heard my down-child head's ROW LEDGER since I seated. A parent
      // learns its child row's non-head cells from nobody else (they link to
      // their head, not to the parent), so a REPLACEMENT parent saw an empty
      // row and admitted into occupied cells — the N=50000 duplicate residue.
      this.rowLedgerAt = -1;
      // ---- V1 ROLLUP DIGEST state (healing-laws § G; sim mesh.cpp) ----------
      // Display-only, flag-gated (env.DIGEST) — see the constants block above.
      this.refuses = false;      // MY OWN first-hand consent state (has NOT consented). Local, never derived from a digest.
      this.lie = 0;              // adversary knob (tests only): 1 = publish refuse=0/part=0 (SUPPRESS — the one dangerous direction), 2 = inflate n
      this.myDig = dig0(); this.rowDig = dig0(); this.rootDig = dig0(); // my subtree fold / my row fold (deep heads) / the room fold
      this.downDig = dig0();     // the ROW digest my down-child head published up to me (my whole owned child row)
      this.rowKids = new Map();  // head only: each row-mate's subtree digest   (<= C-1)
      this.s1tab = new Map();    // Section 1 only: per-S1-cell subtree digests (<= C^2)
      // G4: the ring of reports I published upward (ground truth for the echo
      // check), and what I actually FOLDED this period (echoed to its authors).
      this.upLog = []; for (let q = 0; q < 16; q++) this.upLog.push({ at: -1, n: 0, refuse: 0, lh: '' });
      // § G9 MY OWN leaf facts (setLeaf — the application's, never a digest's):
      // hand/stage/app times, stage flags, my short name and app session id,
      // away, and my votes (device tags).
      this.leaf = { hand: 0, stage: 0, sf: 0, app: 0, ad: null, nm: '', dv: '', away: false, vup: [], vdn: [] };
      this.upLogI = 0; this.upSince = -1; this.lastAgg = null; this.emptyEcho = 0;
      this.digHoldUntil = -1; this.lastPubAt = -1; this.lastPubDepth = 0; // § G handover hold (sim Seat::digHoldUntil)
      this.downUsed = dig0(); this.rowUsed = new Map();
      this.digMismatch = 0;      // refutations I have raised (mine only — no votes, G4)
      this.digArm = 0;           // which refutation arm last fired (1 echo fidelity, 2 fold monotonicity, 3 omission)
      this.digGap = 0;           // which scope member I fail-closed on this fold: 1=child row, 2=row-mate, 4=S1 cell
      this.onDigMismatch = null; // diagnostic hook (the sim's MESH_DIGLOG twin) — display only, never a decision
      // per-seat PRNG (splitmix-ish), seeded from id — matches the sim's per-seat rng role
      let h = 2166136261 >>> 0; const b = 'p' + id;
      for (let k = 0; k < b.length; k++) { h ^= b.charCodeAt(k); h = Math.imul(h, 16777619); }
      this.rs = (h ^ 0x9e3779b9) >>> 0;
      if (env && env.SKEW > 0) this.skew = (h >>> 3) % (env.SKEW + 1); // a seat-local digest clock (test harness; a browser's own tick already is one)
    }
    get TICK() { return this.env.TICK; }
    // G0b: MY clock for every digest stamp and freshness read. In a browser it
    // IS env.TICK (each page's own, from its own load); the harness's env.SKEW
    // gives each seat an offset, twin of the sim's `net skew=`.
    LT() { return this.env.TICK + (this.skew || 0); }
    wireDig(d, keep) { const o = digCopy(d); const st = d.rx != null ? d.rx : d.at; o.ag = st >= 0 ? Math.max(0, this.LT() - st) : 0; return keep ? o : digPack(o); } // send the AGE, never my receipt stamp; defaults stay off the wire
    // stubFor: the wire copy `w` of digest `d` for peer `to` in `slot`, or its stub.
    stubFor(to, slot, d, w) {
      const S = this.digSent = this.digSent || new Map();
      const key = to + '|' + slot, h = digHash(d), st = S.get(key);
      if (st && st.h === h && this.TICK - st.full < STUB_FULL) { const sb = { stub: 1, at: w.at, ag: w.ag || 0, h }; if (w.by != null) sb.by = w.by; return sb; } // the author rides a stub too: same content from a NEW author is not "unchanged"
      if (S.size > 1024) S.clear(); // bounded: links x (C^2 + 2) slots; a clear only costs one round of whole copies
      S.set(key, { h, full: this.TICK });
      return w;
    }
    _want(peer, slot) { if (peer == null || !slot) return; const W = this.digWant = this.digWant || new Map(); let q = W.get(peer); if (!q) { if (W.size > 64) W.clear(); W.set(peer, q = new Set()); } if (q.size < 32) q.add(slot); }
    // _dw: hang my pending wants for `to` on a frame already going there.
    _dw(to, f) { const q = this.digWant && this.digWant.get(to); if (q && q.size) { f.dw = Array.from(q); this.digWant.delete(to); } return f; }
    // _dwTake: a peer asked for slots whole — forget what I believe it holds.
    _dwTake(from, dw) { if (from == null || !Array.isArray(dw) || !this.digSent) return; for (const sl of dw.slice(0, 32)) if (typeof sl === 'string' && sl.length <= 24) this.digSent.delete(from + '|' + sl); }
    // stubTake: a stub refreshes the entry I hold IF it is the same content; returns the refreshed entry or null.
    stubTake(m, held) {
      if (!m || m.stub !== 1 || typeof m.h !== 'string' || m.h.length > 24 || !Number.isFinite(m.at) || m.at < 0) return null;
      if (!held || held.at < 0 || digHash(held) !== m.h || (m.by !== undefined && String(m.by).slice(0, 64) !== held.by)) { this._want(m.from_, m.slot_); return null; }
      const d = digCopy(held); d.at = m.at; d.ag = Number.isInteger(m.ag) && m.ag > 0 ? m.ag : 0;
      return this.rxDig(d);
    }
    rxDig(d) { if (this.env.DIG_ABS) { d.rx = d.at; return d; } const a = Number.isInteger(d.ag) ? Math.min(Math.max(d.ag, 0), 1 << 20) : 0; d.rx = this.LT() - a; return d; } // re-stamp on MY clock at intake
    rng() { this.rs = (this.rs + 0x6d2b79f5) >>> 0; let t = this.rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    shuf(a) { for (let k = a.length - 1; k > 0; k--) { const j = (this.rng() * (k + 1)) | 0; const t = a[k]; a[k] = a[j]; a[j] = t; } return a; }
    // A seat HOLDS a relay socket while joining (state!=3) or while seated in
    // Section 1 (the greeter pool). Deep seats are socketless.
    socketed() { return this.state !== 3 || (this.hasCoord && this.coord.pc === 0); }
    // emit(): Option A owned-link delivery — a seated seat may only hand a frame
    // to a seat it holds a real owned-link (DataChannel) to; a seated NON-
    // neighbour target is ROUTED over the mesh instead of teleported. The
    // enforcement needs the sim's global peer view, so it is ACTIVE only when
    // the env provides peek() (the test harness models the fabric exactly like
    // the sim's emit). In production mesh-wire owns delivery (DataChannel with
    // sealed-relay fallback) and peek is undefined — emit sends directly.
    emit(to, m) {
      if (to == null) return;
      if (m.t === 'WHOHOME' && !this.hasCoord && m.from === this.id) this.noteDoorAsk(to);   // dark-greeter evidence (darkGreeters)
      // An arbiter's YIELD is preceded by a bare PONG from my cell (`yp`: "I
      // am here", over my own link, never move evidence). The loser often
      // never heard me (I answer a losing PHONE with the YIELD, not a PONG),
      // and only a seat it hears at my cell may unseat it (arbiterIs). A
      // YIELD that outruns its PONG waits for it (pendY).
      if (m.t === 'YIELD' && m.id === this.id && this.hasCoord && !m._yp) { this.emit(to, { t: 'PONG', coord: this.coord, id: this.id, owner: null, oCk: null, row: [], nbrs: [], yp: 1 }); Object.defineProperty(m, '_yp', { value: 1, enumerable: false }); }
      // TENANCY (sec finding R5): my PHONE, PONG, HELLO and LEAVE about a cell
      // I hold (or, mid-move, the old cell I still hold) carry that tenancy's
      // nonce. A LEAVE signs it, so a captured goodbye cannot free a later
      // tenancy of the same cell by the same seat. The PONG carries it too: a
      // deep row-mate hears its head only as PONGs, and only a stay a link
      // told it of lets the head's goodbye say where it went (`mvd`).
      if (m.id === this.id && m.tn === undefined && (m.t === 'PHONE' || m.t === 'PONG' || m.t === 'HELLO' || m.t === 'LEAVE')) {
        const mk = (m.t === 'PHONE' || m.t === 'PONG') ? (m.coord ? ck(m.coord) : null) : m.ck;
        if (mk != null && this.hasCoord && mk === ck(this.coord) && this.tn != null) m.tn = this.tn;
        else if (mk != null && mk === this.oldCk && this.oldTn != null) m.tn = this.oldTn;
      }
      // PP (§AUTH): my HELLO and CLAIM about the cell I was placed at carry
      // my admitter's proof (one block, signed once at admission; no beat
      // carries it).
      if ((m.t === 'HELLO' || m.t === 'CLAIM') && m.id === this.id && m.pp === undefined && this.pp && m.ck === this.pp.ck) m.pp = this.pp.s4;
      // ...and so does the hearing PONG ahead of my YIELD (the loser may never
      // have seen my announce: a healed split's far side), so the loser can
      // count me (lateQuorum, arbOk).
      if (m.t === 'PONG' && m.yp === 1 && m.id === this.id && m.pp === undefined && this.pp && m.coord && ck(m.coord) === this.pp.ck) m.pp = this.pp.s4;
      if (this.env.peek && !m.routing && !m.direct && to !== this.id) {
        const st = this.env.peek(to);
        if (st) {
          let directLink = false;
          if (this.hasCoord) { for (const olc of topo.ownedLinks(this.coord)) if (this.occGet(ck(olc)) === to) { directLink = true; break; } }
          if (!directLink) {
            if (this.socketed() && st.socketed) { /* relay path — both hold sockets (greeting scope): fall through */ }
            else if (st.hasCoord) { this.route(st.coord, null, m); return; }                  // deep target ⇒ route over the mesh
            else if (st.gateway != null) { const gw = this.env.peek(st.gateway); if (gw && gw.hasCoord) { this.route(gw.coord, to, m); return; } return; } // unseated target ⇒ via its gateway
            else return;                                                                      // unreachable right now ⇒ drop, caller retries
          }
        }
      }
      this.env.send(this.id, to, m);
    }
    emitRelay(key) { this.env.knock(this.id, key); }
    wake() { if (this.env.wake) this.env.wake(this.id); }

    // ---- occupancy helpers ----
    occGet(k) { const v = this.occ.get(k); return v === undefined ? null : v; }
    // a seat can be in exactly ONE place: never store MYSELF at a coord I do not
    // hold (stale self-claims circulating back made invisible zombies)
    setOcc(k, v) { if (v === this.id && (!this.hasCoord || k !== ck(this.coord))) return; if (this.occ.get(k) !== v) { this.tlForget(k, 'occ-change→' + (v == null ? 'null' : String(v).slice(0, 6))); this.born.set(k, this.LT()); this.pairAt.set(k, this.TICK); } this.occ.set(k, v); }
    noteS1(k) { if (isS1key(k)) this.s1seen.set(k, this.TICK); }
    s1Fresh(k) { const it = this.s1seen.get(k); return it !== undefined && this.TICK - it < 120 && this.occ.has(k); }
    // A three-state helpers (empty / sitting-down / seated)
    softSitting(k) {
      const s = this.sitting.get(k); if (!s) return false;
      if (this.TICK - s.at > SIT_TTL) { this.sitting.delete(k); return false; }
      return true;
    }
    cellTaken(k) { return this.occ.has(k) || this.softSitting(k); }
    // Requeue/moved ghost: alive but not at k. Silent death (alive=false) stays
    // reserved for ring-hold (headless C). Unknown ids stay reserved (conservative
    // — free-ing them broke D5 sever probes). Not "merely lack first-hand".
    occIsPhantom(k) {
      const x = this.occGet(k); if (x == null) return false;
      if (this.firstHandLive(k)) return false;
      // 03c LOCAL-EVIDENCE PHANTOMS — production has no env.peek, so the
      // requeued/moved phantom detection below this block was SIM-ONLY and a
      // radio-churned member's stale occ at a row head made every greeter
      // NOROOM every seeker forever (the 03c livelock). These two rules are
      // the peek's requeued/moved semantics rebuilt from what one seat can
      // see FIRST-HAND, and agree with the peek in every honest case:
      //  (1) knock-is-evidence: the seeker of the serveFind scan in progress
      //      is AT THE DOOR by construction — an occ entry naming it is stale.
      if (this.findNc != null && x === this.findNc) return true;
      //  (2) moved-elsewhere: x is first-hand-live at a DIFFERENT cell, so
      //      the entry at k is its pre-move/pre-requeue echo. First-hand
      //      only — gossip never evicts (E2).
      for (const [k2, v2] of this.occ) if (v2 === x && k2 !== k && this.firstHandLive(k2)) return true;
      const st = this.env.peek ? this.env.peek(x) : null;
      if (!st) return false; // unknown: keep reserved
      if (!st.alive) return false; // dead without LEAVE: ring-hold reserved
      if (!st.hasCoord || ck(st.coord) !== k) return true; // requeued/moved
      return false;
    }
    admitterReachable(k) {
      const x = this.occGet(k); if (x == null || x === this.id) return false;
      // A standing D5 observation (my channel to it died, the probe is out)
      // is no reachable admitter: its stamp may still read fresh. A FIND
      // handed there was swallowed and the seeker, holding my FINDACK, waited
      // its full 60-tick retry (chaos seed 14 #6: the head reloaded, its row
      // handed the new id's FIND to the old one: 33.1 s to rejoin). Passed
      // over, the scan moves on or the seeker hears NOROOM and retries now.
      if (this.translost.has(k)) return false;
      if (this.firstHandLive(k)) return true;
      const st = this.env.peek ? this.env.peek(x) : null;
      if (!st || !st.alive) return false;
      return !!(st.hasCoord && ck(st.coord) === k);
    }
    // Soft or non-phantom occ. Requeue phantoms free for rejoin (atomic D).
    cellReserved(k) {
      if (this.softSitting(k)) return true;
      // A reservation needs a CLAIMANT. `live` is keyed by coord and is only
      // cleared on a LEAVE I can attribute (occGet==leaver), so a cell vacated
      // by a move — or by a LEAVE that raced my occ — stays "first-hand live"
      // for the full 60-tick window with nobody in it. Treating that as
      // reserved made empty home cells look occupied through a churn and pushed
      // seekers DEEP instead of packing shallow (compaction leg 1: byDepth 3
      // went 1 -> 51). No occ entry => no claimant => free.
      if (!this.occ.has(k)) return false;
      if (this.firstHandLive(k)) return true;
      return !this.occIsPhantom(k);
    }
    cellSeated(k) {
      if (this.hasCoord && ck(this.coord) === k) return true;
      return this.firstHandLive(k) && this.occ.has(k);
    }
    clearSoft(k) { this.sitting.delete(k); }
    markSitting(k, joiner) { this.sitting.set(k, { joiner, assigner: this.id, at: this.TICK, pingAt: -1 }); }

    // ---- FRAME AUTHORITY (docs/meet-security.md §AUTH; twin: mesh_seat.inc) --
    // `from` and `id` are written by the sender and prove nothing. Two things do:
    //   m.lk   — the TRANSPORT names the sender. Only the wire writes it
    //            (mesh-wire ingest: a frame that came straight over the
    //            sender's own DataChannel and was not routed; the harness and
    //            sim buses likewise). A relay `from` or a sponsor envelope's
    //            origin never becomes `lk`: the sender writes both.
    //   m.s4ok — the frame is S4-signed and `id` is the signer (verifyFill).
    // linkIs: the transport delivered m from x itself. proven: m speaks for x.
    linkIs(m, x) { return x != null && m.lk != null && m.lk === x; }
    proven(m, x) { return this.linkIs(m, x) || (x != null && m.s4ok === true && m.id === x); }
    // An EVICTION frame (YIELD, CONFIRM, LEAVE, MOVED) frees or unseats a
    // seat. The DataChannel pair id is fixed by signaling, which a room member
    // can race (R4), so the transport's word is not enough here: the frame
    // must be S4-signed by x. They are rare and signed on the way out (the
    // LEAVE ahead of time), and verified on their own lane.
    provenEv(m, x) { return x != null && m.s4ok === true && m.id === x; }
    ownedLinkCell(k) { if (!this.hasCoord) return false; for (const olc of topo.ownedLinks(this.coord)) if (ck(olc) === k) return true; return false; }
    // My ARBITERS: the seats that hear me first-hand on a heartbeat, and so the
    // only ones that can witness a second claimant at my cell — my phone
    // target (a deep non-head phones its row head, a deep head its owner) or,
    // in Section 1, a rook peer. A YIELD is honoured only from one of them, so
    // one member's eviction power stays bounded by the cells it really holds
    // next to its victim (law S, harm ~ fanout).
    // The arbiter must be one I HEAR there first-hand right now (heardAt)
    // and that its own link has proven there (linkedBy), never a hint kept
    // alive by unproven heartbeats:
    // an occupancy learned from gossip (S1SYNC), a hint (an unproven HELLO or
    // CLAIM) or a PONG row names a seat, it does not witness anything — a
    // member that planted itself at a free rook cell by gossip or hint was
    // an arbiter of everyone in that row and column (sec finding X1/X2).
    isArbCell(k) { if (!this.hasCoord) return false; if (this.coord.pc === 0) { const c = cellKeyOk(k); return !!c && c.pc === 0 && this.ownedLinkCell(k); } const tc = this.coord.i !== 0 ? { pc: this.coord.pc, r: this.coord.r, i: 0 } : this.ownerCoord(); return !!tc && ck(tc) === k; }
    arbiterIs(x) { return this.arbCellOf(x) != null; }
    arbCellOf(x) {
      if (x == null || !this.hasCoord) return null;
      // ...and in ONE place: a seat my view places at another cell on CURRENT
      // evidence — heard there first-hand, or a Section-1 entry the gossip
      // refreshed in the last 120 ticks (s1Fresh) — is no arbiter of mine. A
      // member seated elsewhere that poses at a free cell next to me is
      // caught here whenever my Section-1 table knows its real cell (residual
      // R3 in docs/meet-security.md). A stale listing (a deep row-mate's old
      // cell nobody refreshes) is not evidence: it refused a real head's
      // YIELD for 80+ ticks and left a duplicate standing (repro-compaction).
      for (const [k2, v2] of this.occ) if (v2 === x && !this.isArbCell(k2) && (this.firstHandLive(k2) || this.s1Fresh(k2))) return null;
      const at = (k) => this.occGet(k) === x && this.heardAt(k, x) && this.linkedBy.get(k) === x;
      if (this.coord.pc === 0) { for (const olc of topo.ownedLinks(this.coord)) { const k = ck(olc); if (olc.pc === 0 && at(k)) return k; } return null; }
      const tc = this.coord.i !== 0 ? { pc: this.coord.pc, r: this.coord.r, i: 0 } : this.ownerCoord();
      return (tc && at(ck(tc))) ? ck(tc) : null;
    }
    // A cell whose occupancy this seat may learn from its claimant: my own,
    // an owned link, my owner's, a cell I vouched for THIS claimant, and (for
    // a CLAIM, the admittee's word to its admitter) my owned child row.
    claimRel(k, id, childRow) {
      if (!this.hasCoord) return false;
      if (k === ck(this.coord) || this.ownedLinkCell(k)) return true;
      const oc = this.ownerCoord(); if (oc && ck(oc) === k) return true;
      const sit = this.sitting.get(k); if (sit && sit.joiner === id) return true;
      if (childRow) { const d = topo.down(this.coord); const c = cellKeyOk(k); if (c && c.pc === d.pc && c.r === d.r) return true; }
      return false;
    }
    // A goodbye's `mvd` (where the leaver went) may name: a cell I relate to
    // (claimRel), never its old cell nor mine, never one a seat I hear holds.
    mvdOk(k, mvd, id) { if (!this.hasCoord || mvd === k || mvd === ck(this.coord) || !cellKeyOk(mvd) || !this.claimRel(mvd, id, false)) return false; const v = this.occGet(mvd); return v == null || v === id || !this.holdsCell(mvd, 60); }
    // The occupant of k heartbeats me: my down-child head (it phones its
    // owner), my row-mates when I am their head, my rook peers in Section 1.
    beatsMe(k) {
      if (!this.hasCoord) return false; const c = cellKeyOk(k); if (!c) return false;
      if (ck(topo.down(this.coord)) === k) return true;
      if (this.coord.pc === 0) return c.pc === 0 && this.ownedLinkCell(k);
      return this.coord.i === 0 && c.pc === this.coord.pc && c.r === this.coord.r;
    }
    // I hear some Section-1 rook peer first-hand (an arbiter exists for me).
    hearRook() { if (!this.hasCoord || this.coord.pc !== 0) return false; for (const olc of topo.ownedLinks(this.coord)) { const k = ck(olc); if (olc.pc === 0 && this.heardAt(k, this.occGet(k))) return true; } return false; }
    // x is first-hand live at a cell other than k: a seat is in ONE place.
    liveElsewhere(x, k) { for (const [k2, v2] of this.occ) if (v2 === x && k2 !== k && this.firstHandLive(k2)) return true; return false; }
    // ...not counting hearing stamped only by the burst that lands as I come
    // back from a dark spell or a freeze (backAt): the frames my mates sent
    // while I was away are all delivered on the return tick, after absence()
    // aged my stamps. A mate that phoned me from its old cell and then healed
    // into MY cell is not live at the old one: its buffered PHONE re-stamped
    // that cell, and its claim on my cell was held off as "live elsewhere"
    // until a probe of the old cell confirmed the move (a returning head
    // stayed off its own cell 12-18 s on a slowed clock). Its next beat from
    // a cell it really holds restores the rule at once.
    returnBurst(k) { const t = this.live.get(k); return this.backAt >= 0 && t !== undefined && t >= this.backAt && t <= this.backAt + 1; }
    liveElsewhereSinceReturn(x, k) { for (const [k2, v2] of this.occ) if (v2 === x && k2 !== k && this.firstHandLive(k2) && !this.returnBurst(k2)) return true; return false; }
    // An UNPROVEN claim (signed, but over the relay or a sponsor: nothing
    // proves the claimant is on a link to me — a newcomer whose channels are
    // still opening, or anyone). It may teach a FREE cell, as a hint (no
    // liveness), and it never displaces or overwrites a LIVE occupant. A claimant
    // holds at most one such cell in my view: its other non-first-hand
    // entries go, so one member cannot plant itself across a greeter's home
    // (test/mesh/forged-frames.js A7). Returns true if it installed.
    // A CORPSE — a holder I heard first-hand there that has gone silent, or
    // whose link I saw die — is not a live incumbent: a newcomer's unproven
    // claim replaces it, so a dead entry can never lock the claimant out of
    // the DataChannel that would prove it (linkTo follows occ). A holder I
    // never heard myself (a deep row-mate, gossip) is not mine to judge, and
    // a fresh holder is never displaced.
    // ...and silence is a corpse's sign only at a cell whose occupant BEATS
    // me (beatsMe): a deep row-mate heard once (its HELLO at seating) and
    // silent since is simply a row-mate, which never phones me.
    hintClaim(k, id) {
      const cur = this.occ.get(k);
      if (cur !== undefined && (cur === id || !(this.translost.has(k) || (this.liveBy.get(k) === cur && !this.firstHandLive(k) && this.beatsMe(k))))) return false;
      if (this.liveElsewhere(id, k)) return false;
      for (const [k2, v2] of Array.from(this.occ)) if (v2 === id && k2 !== k && !this.firstHandLive(k2)) this.occ.delete(k2);
      this.setOcc(k, id); this.noteS1(k);
      return true;
    }
    // Grant a seat its placement proof for k (a PP frame, signed by the wire),
    // once per 60 ticks per (cell, seat), on a claim I did not vouch (a
    // healer's CLAIM to its hole's admitter).
    ppGrant(k, joiner) { const gk = k + '|' + joiner; const g = this.ppGiven.get(gk); if (g !== undefined && this.TICK - g <= 60) return; if (this.ppGiven.size >= 128) this.ppGiven.delete(this.ppGiven.keys().next().value); this.ppGiven.set(gk, this.TICK); this.emit(joiner, { t: 'PP', coord: unck(k), id: joiner }); }
    confirmSeated(k, joiner) {
      // V4 SITXFER: confirming a Section-1 row HEAD I vouched hands it the
      // row's outstanding vouch ledger AND my confirmed row occ — the head
      // becomes its row's admitter the moment it seats, and without the
      // ledger it re-admits cells my in-flight (or already-confirmed)
      // admittees hold (the designated-vs-headless-soft V4 seed pair).
      const sit = this.sitting.get(k);
      const c0 = unck(k);
      const xfer = !!sit && sit.assigner === this.id && sit.joiner === joiner && c0.pc === 0 && c0.i === 0;
      this.clearSoft(k); this.setOcc(k, joiner); this.liveMark(k); this.noteS1(k);
      // PP: a claimant I did not vouch (a healer, a mover) is granted its
      // placement proof here, once per 60 ticks per (cell, seat); a vouched
      // joiner already carries the one signed with its PLACE.
      // ...and only by the cell's ADMITTER in my own view (ppAdmitter: its row
      // head, its owner, the head above). A cross-link neighbour used to sign a
      // proof for a healer that promoted into a cell its real head already
      // heard another seat at; two proof-backed claimants, neither displaced
      // (heal-time.js s1all seed 8: 2_2_4 doubled for 40k ticks).
      if (joiner !== this.id && !sit && this.ppAdmitter(c0) === this.id) this.ppGrant(k, joiner);
      if (xfer) {
        const vouches = [], rowOcc = [];
        for (const [sk, ss] of this.sitting) { const sc = unck(sk); if (sc.pc === 0 && sc.r === c0.r && ss.assigner === this.id) vouches.push({ k: sk, v: ss.joiner }); }
        for (let j = 0; j < C(); j++) { const rk = ck({ pc: 0, r: c0.r, i: j }); const x = this.occGet(rk); if (x != null && rk !== k) rowOcc.push({ k: rk, v: x }); }
        this.emit(joiner, { t: 'SITXFER', ck: k, id: joiner, vouches, rowOcc });   // an EMPTY ledger is still the authority-handover signal
      }
    }
    // CHECK-BACK (law A tightened, 2026-08-02 — the ghost-churn fix): the
    // recheck at SIT_RECHECK now actually FREES a vouch that was never
    // answered. A live joiner is always HEARD within a couple of beats of its
    // PLACE (its CLAIM or HELLO lands, or its first PHONE beat at +8 ticks);
    // a tab killed mid-placement is never heard at all. 25 ticks of total
    // silence after my own PLACE means my vouch is dead — holding the chair
    // the full SIT_TTL (90) let six killed tabs wall off the whole home row
    // and strand every real newcomer behind it. Freeing also clears the
    // cell's healTry admission stamp: a freed chair is admissible NOW, not 45
    // ticks after its dead admittee's own admission.
    recheckSitting() {
      if (!this.sitting.size) return;
      const del = [];
      for (const [k, s] of this.sitting) {
        if (s.assigner !== this.id) continue;
        if (this.occGet(k) === s.joiner && this.firstHandLive(k)) { del.push(k); continue; }
        if (!s.replayed && s.pl && this.TICK - s.at >= PLACE_REPLAY && this.occGet(k) !== s.joiner) { s.replayed = true; this.emit(s.joiner, Object.assign({}, s.pl)); } // FINDACK: a lost PLACE — replay it once (a seated or re-seated joiner ignores an untagged PLACE)
        if (this.TICK - s.at < SIT_RECHECK) continue;
        // V4 PROBE-GATED CHECK-BACK (confirmed absence, the ghost-law
        // discipline): "never heard in 25 ticks" is NOT evidence of death —
        // at the mass-join storm a live admittee's CLAIM to a deep placer is
        // routinely lost or slow (a j>0 child has no owned up-link, so CLAIM
        // rides the mesh), and freeing on that lagged view let the SAME
        // placer re-place the cell. So falsify first-hand: SITPING the
        // admittee itself. A live one answers (its pong is a re-CLAIM for
        // exactly the vouched cell, no other payload — the 2026-08-02 probe
        // was rejected because its ROUTED answer re-seeded occ and fanned
        // HELLOs); a killed tab never does, and the chair frees at
        // 25+15=40 ticks — inside the ghost-churn budget that the rejected
        // free-at-50 missed. Freed on SILENCE ⇒ the chair re-enters the
        // 45-tick admission cooling instead of "admissible NOW".
        if (this.occGet(k) !== s.joiner && !this.firstHandLive(k)) {
          if (s.pingAt == null || s.pingAt < 0) { s.pingAt = this.TICK; this.emit(s.joiner, { t: 'SITPING', ck: k, id: s.joiner, from: this.id }); continue; }
          if (this.TICK - s.pingAt < SIT_PING_WAIT) continue;
          del.push(k); this.healOnly.delete(k); this.healTry.set(k, this.TICK);
          continue;
        }
        if (this.TICK - s.at >= SIT_TTL) {
          del.push(k); this.healOnly.delete(k); this.healTry.set(k, this.TICK);   // V4: TTL is also a silence-free — cool before re-admission
          if (this.occGet(k) === s.joiner && !this.firstHandLive(k)) {
            this.occ.delete(k); this.live.delete(k); this.s1seen.delete(k);
            this.kidful.delete(k); this.tlForget(k, 'sit-ttl'); this.healTry.delete(k);
          }
        }
      }
      for (const k of del) this.sitting.delete(k);
    }
    // E2 FIRST-HAND liveness: `live` is set ONLY by direct contact — a PHONE I
    // answered (onPhone), a HELLO/CLAIM its occupant sent me, a PONG from a rook
    // neighbour. GOSSIP (S1SYNC) never sets it. So firstHandLive is the ONLY
    // signal that may evict/tie-break: a phantom (a stale gossip echo of a seat
    // that has moved) is NOT first-hand live, so it can never yield a live
    // healer out of a hole. Echo-immune — gossip informs routing, never liveness.
    liveMark(k) { const v = this.occ.get(k); const pt = this.live.get(k); if (v === undefined) this.heardSince.delete(k); else if (this.liveBy.get(k) !== v || pt === undefined || this.TICK - pt > 60) this.heardSince.set(k, this.TICK); this.live.set(k, this.TICK); this.holeSince.delete(k); this.fhEver.add(k); if (v === undefined) this.liveBy.delete(k); else this.liveBy.set(k, v); }
    // x is the seat I hear first-hand at k NOW: a live stamp set while x held
    // k, and no unanswered transport loss since. Gossip, hints and PONG rows
    // never set it.
    // A deep seat hears its phone target only as PONGs (a PONG from a deep
    // cell sets no `live` stamp), so a link-proven PONG within the same 60
    // ticks counts too (pongBy).
    authClear() { this.waitClaim.clear(); this.liveBy.clear(); this.linkedBy.clear(); this.tenOf.clear(); this.pairAt.clear(); this.pongBy.clear(); this.heardSince.clear(); this.linkedSince.clear(); this.wasAt.clear(); this.carrySince.clear(); this.rival = null; this.movedClaim = null; this.pendY = null; this.challTo = null; this.lateY = null; this.ppAt.clear(); this.oldPP.clear(); this.gbProbe.clear(); this.upAck.clear(); this.upExpired.clear(); this.upUsed.clear(); this.upOpen.clear(); this.pp = null; this.oldPp = null; }
    heardAt(k, x) {
      if (x == null || this.translost.has(k)) return false;
      if (this.firstHandLive(k) && this.liveBy.get(k) === x) return true;
      const p = this.pongBy.get(k); return p !== undefined && p.id === x && this.TICK - p.at <= 60;
    }
    // A transport-proven frame from x about k: remember it (and its tenancy).
    // wasLinked: p, a link proved at k, is there no longer (wasAt; its proof
    // for k is now an OLD one, oldPP).
    wasLinked(k, p) { if (p == null) return; const w = this.wasAt.get(k) || []; if (!w.includes(p)) { w.push(p); if (w.length > 3) w.shift(); } this.wasAt.set(k, w); const pm = this.ppAt.get(k), n = pm && pm.get(p); if (n) { this.oldPP.set(k + '|' + p, n.sig); if (this.oldPP.size > 256) this.oldPP.delete(this.oldPP.keys().next().value); } }
    noteLinked(k, x, tn) { const p = this.linkedBy.get(k); if (p !== x) { this.wasLinked(k, p); const cs = this.carrySince.get(x); this.linkedSince.set(k, (cs && cs.k === k && this.TICK - cs.t <= 60) ? Math.min(cs.at, this.TICK) : this.TICK); if (cs) this.carrySince.delete(x); } this.linkedBy.set(k, x); if (tn != null) this.tenOf.set(k, { id: x, tn: String(tn) }); else { const t = this.tenOf.get(k); if (t && t.id !== x) this.tenOf.delete(k); } }
    // UNPROVEN LIVENESS: an unproven heartbeat (sponsor / relay: the pair's
    // DataChannel is not open, not yet authenticated, or can never form — an
    // ISLAND pair whose two networks cannot meet) may keep x alive at k only
    // while no link has EVER proven x at k and no transport loss is pending.
    // Once x's own channel has spoken for it here, only that channel keeps it
    // alive: a crashed seat's cell heals however many PHONEs arrive in its
    // name (sec finding R2). A pair that never had a channel cannot be told
    // apart from a forger by a heartbeat; that residual is named in
    // docs/meet-security.md §AUTH.
    // CAPPED (H6): past UNPROVEN_HOLD ticks of a pairing, an unproven beat keeps
    // it alive only while the seat itself keeps answering my nonced probes
    // (tick: an unproven pairing is probed every 20 ticks; ROUTED stamps
    // upAck). A corpse answers nothing, so a never-channel seat's cell frees
    // at the blackhole backstop however many PHONEs arrive in its name; an
    // island pair answers and lives on.
    // Once a pairing's window has expired unanswered, a re-plant of the SAME
    // pairing (a gossip echo of the corpse) opens no new window (upExpired):
    // only an answer does.
    // The window runs from the FIRST unproven beat for the pairing (upOpen),
    // not from when the cell was learned: an entry taught by a PLACE or a
    // ledger long before its first sponsored beat still gets its window.
    entryOpen(k, x) {
      if (this.linkedBy.get(k) === x || this.translost.has(k)) return false;
      if (!this.pairAt.has(k)) return false;
      const a = this.upAck.get(k); if (a !== undefined && a.id === x && this.TICK - a.at <= UNPROVEN_HOLD) return true;
      if (this.upExpired.get(k) === x) return false;
      let o = this.upOpen.get(k); if (o === undefined || o.id !== x) { if (this.upOpen.size >= 64) this.upOpen.delete(this.upOpen.keys().next().value); this.upOpen.set(k, o = { id: x, at: this.TICK }); }
      if (this.TICK - o.at <= UNPROVEN_HOLD) return true;
      if (this.upExpired.size >= 64) this.upExpired.delete(this.upExpired.keys().next().value); this.upExpired.set(k, x);
      return false;
    }
    // ---- TENURE and FRESHNESS (law S2/S5; twin: mesh_seat.inc) -------------
    // holdsCell: the seat my view names at k is the one I hear there first-hand
    // within `win` ticks (liveBy — a live stamp is the CELL's, and gossip, a
    // hint, a PONG row or a goodbye's `mvd` can rewrite occ under it), with no
    // transport loss pending.
    holdsCell(k, win) { const v = this.occGet(k); if (v == null || this.translost.has(k) || this.liveBy.get(k) !== v) return false; const it = this.live.get(k); return it !== undefined && this.TICK - it <= win; }
    // rawClaim: x claims k while I hear k's incumbent there first-hand and have
    // for TENURE ticks, and no link ever proved x at k (not a revival). Law
    // S2: "a raw claim is rejected"; S5: a fill is accepted only by a
    // neighbour that has itself lost the prior occupant first-hand. A member
    // with a DataChannel to me (any member can open one) and a lower id used
    // to take a rook peer's cell here and have me YIELD the peer.
    // PP (§AUTH): a claim is raw from the incumbent's FIRST tick unless the
    // claimant presented a placement proof for k whose admitter my view
    // admits there (ppBacked); E2's lower-id rule settles only fresh
    // incumbents against admitted claimants. A tenured incumbent yields only
    // to a revival re-admitted since it was displaced (ppFresh).
    rawClaim(k, x, win) {
      if (x == null || this.occGet(k) === x || !this.holdsCell(k, win)) return false;
      if (!this.ppBacked(k, x)) return true;
      const s = this.heardSince.get(k); if (s === undefined || this.TICK - s < TENURE) return false;
      const w = this.wasAt.get(k); return !(w && w.includes(x) && this.ppFresh(k, x));
    }
    // I took my cell, or regained my neighbours, less than FRESH ticks ago.
    fresh() { return this.TICK - this.estAt < FRESH; }
    // A proven frame from a seat at one of my owned links: a silence longer
    // than NBR_GAP before it means I was cut off, and my seat is fresh again.
    nbrHeard() { if (this.nbrAt !== -1 && this.TICK - this.nbrAt > NBR_GAP) this.estAt = this.TICK; this.nbrAt = this.TICK; }   // -1 is "never"; an aged stamp may be negative (absence)
    // An arbiter that a link proved at its cell within FRESH ticks of my
    // (re)establishment was my neighbour when I sat down. A seat that turns up
    // at a free cell next to me LATER (any member can) may not unseat me
    // unless I am fresh myself (sec finding R3: a deep member posing at a
    // free rook cell).
    // PP: while I am fresh, only an arbiter that proved its own admission to
    // its cell (ppSigned) may unseat me — a member that opened a channel and
    // posed at a free cell next to a newcomer bounced it at every reseat.
    // ...and a neighbour whose goodbye I took (mvd) keeps its pairing's age at
    // the cell it moved to (carrySince, noteLinked): a row-mate that was my
    // neighbour when I sat down and left-packed one cell is the same
    // neighbour (behavior 14a: its YIELD of a returning head was refused as a
    // late arrival, and lateQuorum needs a second arbiter a 3-person room
    // does not have). A seat that re-appears by HELLO alone carries nothing.
    // The lone seat's ask (see the HELLO rival branch): WHOHOME to the seat
    // that holds my cell, while I hear no rook peer and have not for
    // OWNER_SILENT ticks, paced like every other roster ask.
    loneAsk() { const r = this.rival; if (!r || this.state !== 3 || !this.hasCoord || this.coord.pc !== 0 || this.TICK - r.at > 200) return; if (this.hearRook() || this.TICK - this.rookSeenAt <= OWNER_SILENT || this.TICK - this.rosterAskAt <= 40) return; this.rosterAskAt = this.TICK; this.emit(r.id, { t: 'WHOHOME', from: this.id, ttl: 60 }); }
    // A FRAGMENT OF ONE GREETS THE DOOR. A seated Section-1 seat that holds
    // nobody live in its view speaks to nobody: HELLOs go to owned-link
    // occupants (announce), the beat phones occupants, and E2 at an arbiter
    // needs a frame to judge. Two such seats at one cell (chaos seeds 7, 10,
    // 13: a row-mate healed into the head cell during a 45 s sever, or two
    // heads left after a move confirmed) exchanged nothing for the rest of the
    // session — the two-ring rule wants a FULL home and the strand rescue
    // waits STRAND_TTL. The door is the one channel both share: every
    // pool-listed seat is greeted with my cell. A seat at my cell is settled
    // by the rival branch (the genesis race or E2 — lower id wins, the loser
    // requeues through the door); a seat at another cell learns me and I
    // learn it from its answer, and the ring re-forms. Once per beat while
    // the list is registry-fresh: a greeting the wire had no channel for
    // (the app's rescue dial opens one) is repeated once the channel is up.
    // Only a seat ALONE FOR TWO BEATS: a seat just placed has heard no rook
    // yet either, and greeting the whole door from every fresh Section-1
    // seat of a large join re-timed the placements (digest.js N=500: a
    // different tree, 50 sections for 45).
    loneGreet() {
      if (this.state !== 3 || !this.hasCoord || this.coord.pc !== 0 || this.hearRook() || this.TICK - this.rookSeenAt <= LONE_GREET_AFTER) return;
      for (const [k, v] of this.occ) if (v !== this.id && this.firstHandLive(k)) return;
      const list = this.lastGreeters; if (!list || !list.length || this.TICK - this.greetersAt > RELAY_TTL) return;
      for (const g of list) if (g != null && g !== this.id) this.emit(g, { t: 'HELLO', ck: ck(this.coord), id: this.id });
    }
    carryLinked(k, mvd, x) { const ls = this.linkedSince.get(k); if (ls === undefined) return; if (this.carrySince.size >= 64) this.carrySince.delete(this.carrySince.keys().next().value); this.carrySince.set(x, { k: mvd, at: ls, t: this.TICK }); }
    // ...and a LATE arbiter counts alone when its admission is my own ring's:
    // its proof backed by a seat my view holds in Section 1 (ppBacked; ppAdm
    // also takes an admitter a link proved at one of my Section-1 cells, and
    // the moved mate now holding my cell for the cell it left). The Sybil
    // floor stands (two admitted identities: the arbiter and an admitter my
    // view already holds or link-proved); a stranger that merely claims my
    // cell vouches for nobody, and R3 still refuses a stranger that POSED at
    // a free cell next to me with nobody's admission. Behavior 14a: the
    // returning head was not fresh (its clock held through the dead spot),
    // its only possible arbiter joined after it, and lateQuorum wants a
    // second arbiter a 3-person room does not have.
    // ...and the seat that ADMITTED me (the verified signer of the proof for my
    // own cell: the PLACE that seated me, or the grant on my CLAIM) is my
    // arbiter whatever its own proof: it vouched me in, it is no late-comer
    // (R3), and the room's founder holds no proof at all. A fresh seat refused
    // its founder-head's YIELD until its freshness ran out (seated 8 ticks before a 45 s dark spell,
    // the clock held, 23.5 s back).
    arbOk(x) { const k = this.arbCellOf(x); if (k == null) return false; if (x != null && x === this.admBy && this.pp && this.hasCoord && this.pp.ck === ck(this.coord)) return true; if (this.fresh()) return this.ppSigned(k, x); const ls = this.linkedSince.get(k); if (ls !== undefined && ls <= this.estAt + FRESH) return true; return this.ppBacked(k, x); }
    // lateQuorum: a heard, linked arbiter that joined my neighbourhood after I
    // sat down YIELDs me; it counts once a second such arbiter, at another
    // arbiter cell, has YIELDed me for this cell within 40 ticks.
    // PP: only an arbiter that proved its admission to its cell counts (two
    // posers need two admitted identities: the Sybil floor, §AUTH).
    lateQuorum(by, ak, myCk) {
      if (!this.ppSigned(ak, by)) return false;
      const L = this.lateY = this.lateY || new Map(); L.set(by, { at: this.TICK, ak, ck: myCk });
      if (L.size > 16) for (const [x, e] of L) if (this.TICK - e.at > 40) L.delete(x);
      for (const [x, e] of L) if (x !== by && e.ak !== ak && e.ck === myCk && this.TICK - e.at <= 40 && this.arbCellOf(x) === e.ak && this.ppSigned(e.ak, x)) return true;
      return false;
    }
    // ---- PLACEMENT PROOF (PP; docs/meet-security.md §AUTH; twin: mesh_seat.inc)
    // A seat's RIGHT to contest a cell is its ADMISSION: the admitter's signed
    // statement {PP, cell, joiner}, signed with the PLACE that seated it, or
    // granted on the CLAIM a healer sends the hole's admitter. It rides the
    // seat's own HELLO and CLAIM about that cell (emit); the wire verifies a
    // proof once per presentation (m.ppok, m.ppfrom = the admitter), never on
    // a beat. A receiver notes each verified proof per (cell, claimant) and
    // judges the ADMITTER against its OWN view when the note is used
    // (ppAdm): deep, the occupant of the cell's owner cell or of its row head
    // (the two seats that admit into a row); Section 1, a seat listed at a
    // home cell, a persistent stranger (two rings), or myself. A seat never
    // admits itself, so one key can sign no proof for a cell it was not
    // admitted to; the second key a poser would need is the Sybil floor.
    ppAdm(k, adm, x) {
      if (adm == null || adm === x || !this.hasCoord) return false;
      if (adm === this.id) return true;
      const c = cellKeyOk(k); if (!c) return false;
      if (c.pc !== 0) { const oc = ownerCoordOf(c); if (oc && this.occGet(ck(oc)) === adm) return true; return this.occGet(ck({ pc: c.pc, r: c.r, i: 0 })) === adm; }
      if (this.strangerOk(adm)) return true;
      for (const [k2, v2] of this.occ) if (v2 === adm && k2 !== k && isS1key(k2)) return true;
      // ...or a seat a LINK proved at one of my Section-1 cells (linkedBy outlives
      // the occ entry a confirm removed) — never my own cell (a claimant at my
      // cell is no admitter of anyone), and never the cell being proved, except
      // when that seat is the RIVAL now holding my cell: my link proved it at k
      // (linkedBy, or wasAt once its successor's link replaced it there), and
      // it admitted the seat that took k. Behavior 14a: the row-mate healed
      // into the head cell while I was cut off and admitted my arbiter into
      // the cell it left. It had this standing while it sat at k (the occ
      // clause above); its move into my cell, confirmed by my own probe or by
      // its stamps lapsing, takes none of it away — and a stranger that merely
      // claims my cell was never proved at any cell of mine.
      for (const [k2, v2] of this.linkedBy) if (v2 === adm && k2 !== k && k2 !== ck(this.coord) && isS1key(k2)) return true;
      if (this.rival && this.rival.id === adm && k !== ck(this.coord)) { const w = this.wasAt.get(k); if (this.linkedBy.get(k) === adm || (w && w.includes(adm))) return true; }
      return false;
    }
    // The wire's verdict on the proof a HELLO / CLAIM carries: verified, and
    // signed by somebody other than the claimant.
    ppValid(m) { return m.ppok === true && m.ppfrom != null && m.ppfrom !== m.id && !!m.pp && m.pp.sig != null; }
    // A note is VERIFIED (from = the admitter) or PENDING (the block itself,
    // not yet checked: the wire verifies a proof eagerly only where it may
    // decide something now — ppWanted — and lazily on request, ppAsk, so a
    // join burst into free cells costs no verification at all).
    ppNote(k, x, sig, from, pending) {
      let pm = this.ppAt.get(k); if (!pm) { if (this.ppAt.size >= 256) this.ppAt.delete(this.ppAt.keys().next().value); this.ppAt.set(k, pm = new Map()); }
      const cur = pm.get(x); if (cur && cur.sig === String(sig) && (cur.from != null || pending == null)) return;   // the same proof, already verified (or already pending)
      if (!pm.has(x) && pm.size >= 4) pm.delete(pm.keys().next().value);
      pm.set(x, { sig: String(sig), from: from == null ? null : from, at: this.TICK, pending: pending || null, asked: -1 });
    }
    // The wire asks before verifying a carried proof: it decides something now
    // only at my own cell, or at a cell my view gives another seat.
    ppWanted(k, x) { if (!this.hasCoord) return false; if (k === ck(this.coord)) return true; const cur = this.occGet(k); return cur != null && cur !== x; }
    ppAsk(k, n) {
      if (!n.pending || !this.env.verifyPP || (n.asked >= 0 && this.TICK - n.asked < 20)) return; n.asked = this.TICK;
      const blk = n.pending; this.env.verifyPP(blk, k, n.x, (from) => { if (n.pending !== blk) return; n.pending = null; n.from = from == null ? null : from; });
    }
    // x's proof for k is presented but not yet checked: a decision about it
    // waits a beat (the caller returns without a verdict).
    ppPending(k, x) { const pm = this.ppAt.get(k); const n = pm && pm.get(x); if (!n || !n.pending) return false; n.x = x; this.ppAsk(k, n); return true; }
    // ppSigned: a proof some OTHER key signed for (k, x) was presented (an
    // admitted identity: the Sybil floor); ppBacked: and my view admits its
    // signer there. A contest (rawClaim, the challenge) needs ppBacked; an
    // arbiter's standing (arbOk while fresh, lateQuorum) needs ppSigned — a
    // healed split's far-side admitters are strangers to my view.
    ppSigned(k, x) { const pm = this.ppAt.get(k); const n = pm && pm.get(x); if (!n) return false; if (n.pending) { n.x = x; this.ppAsk(k, n); return false; } return n.from != null && n.from !== x; }
    ppBacked(k, x) { const pm = this.ppAt.get(k); const n = pm && pm.get(x); if (!n) return false; if (n.pending) { n.x = x; this.ppAsk(k, n); return false; } return this.ppAdm(k, n.from, x); }
    ppFresh(k, x) { const pm = this.ppAt.get(k); const n = pm && pm.get(x); return !!n && n.sig !== this.oldPP.get(k + '|' + x); }
    // The seat that admits into cell c, in my view: its row head (a row cell),
    // its owner cell's occupant (a deep head), the head of the row above (a
    // home head). A healer CLAIMs its hole there to be granted its proof.
    ppAdmitter(c) {
      if (c.i !== 0) return this.occGet(ck({ pc: c.pc, r: c.r, i: 0 }));
      const oc = ownerCoordOf(c); if (oc) return this.occGet(ck(oc));
      return this.occGet(ck({ pc: 0, r: (c.r - 1 + C()) % C(), i: 0 }));
    }
    // A nonce for my probes (D5): only an answer that echoes it counts. The wire
    // supplies per-page entropy; buses use a counter (no rng draw, so the
    // twins' trajectories stay as they were).
    nonce() { return this.env.nonce ? String(this.env.nonce()) : String(this.id).slice(-4) + '.' + (++this.pnSeq); }
    // TWO RINGS (c9db649c): a pool-listed greeter my FULL, quiescent home has
    // listed as a stranger in two consecutive E3 replies. Its door-delivered
    // greeting is the two-ring signature, not a raw claim.
    strangerOk(x) { const t = this.xrOk.get(x); return t !== undefined && this.TICK - t <= 2 * RELAY_TTL; }
    firstHandLive(k) { const it = this.live.get(k); return it !== undefined && this.TICK - it <= 60; }
    heldRightNow(k) { const it = this.live.get(k); return it !== undefined && this.TICK - it <= HELD_BEATS; }   // test/sim/mesh.cpp heldRightNow: "still answering me" (3 rook beats), not "was live lately"
    // ---- D5 EARLY-PROBE intake (transport loss is FIRST-HAND evidence) ------
    // transportLost(pid): MY DataChannel / peer connection to `pid` just died —
    // my own direct observation (the transport layer calls this; gossip never
    // can). It evicts NOBODY by itself: it only registers the observation and
    // fires the EXISTING confirm probe immediately, so the probe-gated death
    // confirmation (D4/H1-S1) can start now instead of after the silence
    // horizon. Edge-triggered per coord — one probe burst per transition, so a
    // flapping link cannot generate probe storms.
    transportLost(pid) {
      if (!this.hasCoord || this.state !== 3 || pid == null || pid === this.id) return;
      for (const olc of topo.ownedLinks(this.coord)) {
        const k = ck(olc);
        if (this.occGet(k) !== pid) continue;
        // STALE-EDGE REVALIDATION — PRODUCTION EXTENSION (same class as
        // heardFrom below; the sim's transports never flap, so mesh.cpp can't
        // express this). A translost registered during an earlier link blip
        // can STAND while the occupant lives on: the confirm verdict is only
        // polled once the occupant stops looking alive, so nothing ever
        // forgets the stale entry — and its edge-guard then EATS the next
        // real death observation (caught live 2026-07-28: victim killed,
        // survivor's translost stood from a setup-era blip, kill-time call
        // skipped here, first poll forgot the stale entry via pre-kill
        // contact, and the seat freed only via the 12s starve re-arm). A
        // standing entry already DISPROVEN by contact since it was set is not
        // an armed edge — it is garbage; clear it and let the fresh
        // observation register. Real standing edges still suppress re-fires:
        // no probe storms.
        if (this.translost.has(k)) {
          const old = this.translost.get(k);
          const lv = this.live.get(k), pa = this.probeAck.get(k);
          if ((lv !== undefined && lv >= old) || (pa !== undefined && pa >= old)) this.tlForget(k, 'stale-reval');
          else continue;
        }
        this.translost.set(k, this.TICK); this.tlProbeAt.set(k, this.TICK);
        this.routeToProbe(olc); // probe NOW — across the mesh, not the dead link
      }
      this.wake();
    }
    // translostConfirmed(k): the early-confirm verdict. TRUE only when a first-
    // hand transport loss is registered for k AND the probe has gone unanswered
    // on every mesh path for the settled EARLY_HOLD window. ANY answer since the
    // loss — first-hand contact (live) or a probe answer (probeAck) — clears the
    // observation and re-arms the edge trigger: their link to me died; they may
    // be fine (the probe travels the mesh, not the dead link). While pending it
    // keeps re-probing every ~6 ticks (the first probe can be lost).
    translostConfirmed(k) {
      const at = this.translost.get(k); if (at === undefined) return false;
      const lv = this.live.get(k), pa = this.probeAck.get(k);
      // BOTH evidence channels are STRICT (>) — PRODUCTION EXTENSION
      // (tick-boundary causality; the sim's harness reports a loss ticks
      // after the last frame, so mesh.cpp never faces this). "Evidence since
      // the loss" must mean a STRICTLY LATER tick: a 500ms tick routinely
      // holds the victim's death, the relay's socket-death broadcast, AND the
      // victim's in-flight frame tail (frames authored before death, still
      // crossing the relay after it — §HEARD's heardFrom stamps probeAck for
      // those; caught live 2026-07-28: 'pa:heardFrom' at the registration
      // tick forgot the observation one tick later — the vanish stall
      // lottery: same-tick → starve fallback ~20-25s; next-tick → 7s). A
      // genuinely alive peer produces evidence EVERY tick — one strict tick
      // costs it nothing; a dead one's tail can never span two.
      if ((lv !== undefined && lv > at) || (pa !== undefined && pa > at)) { this.tlForget(k, 'evidence lv=' + lv + ' pa=' + pa + ' at=' + at); return false; }
      const pAt = this.tlProbeAt.get(k);
      if (pAt === undefined || this.TICK - pAt >= 6) { this.tlProbeAt.set(k, this.TICK); this.routeToProbe(unck(k)); }
      return this.TICK - at > EARLY_HOLD;
    }
    tlForget(k, why) { if (this.translost.has(k)) { this.tlLog.push([k, this.TICK, why || '?']); if (this.tlLog.length > 24) this.tlLog.shift(); } this.translost.delete(k); this.tlProbeAt.delete(k); this.probeAck.delete(k); }
    tlClear() { this.translost.clear(); this.tlProbeAt.clear(); this.probeAck.clear(); }
    // heardFrom(pid) — PRODUCTION EXTENSION (Nathan-blessed 2026-07-28; no
    // sim counterpart — the sim's transports never half-die). ANY sealed
    // end-to-end frame from a peer is liveness evidence, whatever path
    // carried it: WebRTC signaling mid-rebuild is the load-bearing case. A
    // 2-person pair whose reform lost the race against the D5 confirm used
    // to FORK the room — both sides compacted to lone roots, and forks only
    // heal by a human pick no standing member ever sees. The peer's own
    // authored frames were streaming past the death clock the whole time.
    // Same evidence class as a probe answer (the frame may TRANSIT the
    // relay, but the relay authors nothing — this is not a relay vouch);
    // clears any standing translost and feeds the silence horizon.
    // NARROW ON PURPOSE (redun-drill bisect, 2026-07-28 eve): the first cut
    // stamped live+probeAck on EVERY frame, which made ordinary app traffic
    // count as full first-hand SEAT evidence — and that perturbed decisions
    // far beyond the fork fix (stage redundancy lost its stg spares:
    // stdPipes 2/2 → 0/0 deterministic; green again with this gate). The
    // fork-killer needs exactly one thing: evidence SINCE A STANDING LOSS
    // clears the confirm — translostConfirmed's own rule. A healthy pair's
    // mesh frames already keep `live` fresh through the normal intake.
    heardFrom(pid) {
      if (!this.hasCoord || pid == null || pid === this.id) return;
      for (const olc of topo.ownedLinks(this.coord)) {
        const k = ck(olc);
        if (this.occGet(k) !== pid || !this.translost.has(k)) continue;
        if (this.movedClaim && this.movedClaim.id === pid && this.movedClaim.k === k) continue;   // a probe opened by its CLAIM AT MY CELL (movedClaim): hearing it anywhere is not hearing it at its old cell; only a probe answer or a frame from that cell clears it
        this.probeAck.set(k, this.TICK); this.tlLog.push([k, this.TICK, 'pa:heardFrom']); if (this.tlLog.length > 24) this.tlLog.shift();
      }
    }
    // WIRE-ONLY (no sim counterpart — the sim has no device-local network).
    // Called at BOTH edges of the device's own network dying/returning:
    // silence observed while WE were dark is not evidence about anyone
    // (D5's "unreachable on every path" presumes the paths were ours to
    // try). Drop every silence-derived observation and hole timer; fresh
    // reality re-derives real ones within a beat. Without this, the latched
    // dark-era observations fired on resume and a lone survivor CONFIRMED
    // its whole row dead and healed itself into 0/0.0 — a seated self-mint
    // fragment (behavior battery 06c, 2026-07-26).
    netHold() { this.tlClear(); this.holeSince.clear(); this.lastAck = this.TICK; }
    // ABSENCE (mesh-wire): n ticks of wall time this seat did not observe — a
    // frozen renderer, a dark spot. The clock held still through it, so every
    // first-hand stamp reads as fresh as the moment before; in wall time it is
    // n ticks older, and that is what it becomes here. Silence in the gap is
    // still not evidence (netHold cleared the D5 observations; a new one needs
    // the app's transport edge after the return) — but liveness from before
    // the gap is not evidence either: a seat back from 35 s dark held its
    // row-mate's old id at a cell the row had since refilled, first-hand live
    // on an 11-tick-old stamp, refused the real occupant's claim (E2) and
    // phoned a corpse for OWNER_SILENT before the ring's word could land
    // (chaos seed 11: 19 s and 48 s to rejoin). Aged, the stamps let gossip
    // and the first claim heard refill the cell, and s1Heartbeat probes every
    // silent rook cell at once — answered by whoever sits there now.
    // The rook-silence clock (rookSeenAt) ages with them: the gap WAS n ticks
    // of hearing no rook peer. Left at the held clock's value, a returning
    // head read its row's silence as a few ticks old and loneAsk waited
    // OWNER_SILENT more before asking the rival for the ring — longer than
    // the app keeps an unwanted pair open, so the ask had no channel and the
    // duplicate head (behavior 14a) never settled.
    absence(n) {
      if (!(n > 0)) return;
      for (const [k, t] of this.live) this.live.set(k, t - n);
      for (const [k, t] of this.s1seen) this.s1seen.set(k, t - n);
      for (const [k, p] of this.pongBy) this.pongBy.set(k, { id: p.id, at: p.at - n });   // a link-proven PONG is first-hand hearing too (heardAt)
      this.rookSeenAt -= n;
      // ...and so does the last proven neighbour frame (nbrAt): the gap WAS n
      // ticks cut off from every neighbour, so the first frame after it makes
      // my seat fresh again (nbrHeard). Left at the held clock's value, a head
      // back from a 75 s freeze read a gap of a few ticks, never became fresh,
      // and refused the YIELD of the arbiter the row had admitted while it was
      // frozen (a duplicate head for 150 s).
      // An aged stamp may fall below zero (a gap longer than my clock had run
      // when it began: a seat that sat down shortly before). It is still a
      // stamp; only -1 means "never", so it is stepped past -1. Read as
      // "never", the first frame back left the seat stale, and it refused its
      // row's YIELD until another neighbour came back.
      if (this.nbrAt !== -1) { this.nbrAt -= n; if (this.nbrAt === -1) this.nbrAt = -2; }
      this.backAt = this.TICK;   // the return: only hearing newer than this refreshes rookSeenAt (tick)
      // ...and the head's own admit pace (healTry, 45 ticks per chair): an
      // attempt made just before a freeze still read as fresh after it, and
      // the chair stayed shut for the rest of the pace in wall time beyond
      // the gap (16 NOROOMs over 8 s).
      for (const [k, t] of this.healTry) this.healTry.set(k, t - n);
    }
    // tlSweep — D5 cleanup at EVERY observer (D3's "a corpse stops riding
    // rosters", started early): once my own observation CONFIRMS (probe
    // unanswered on every path past the early window), the corpse leaves MY
    // occ/roster view even when I am not the designated healer — healing stays
    // exclusively the healer's (C3); this deletes a view, never fills a seat.
    // The standing translost then keeps gossip echoes from re-seating the
    // corpse until the cell genuinely refills (setOcc/admit clear it).
    tlSweep() {
      if (!this.translost.size) return;
      for (const k of Array.from(this.translost.keys())) {
        if (!this.translostConfirmed(k)) continue;
        if (this.occ.has(k)) {
          const pid = this.occ.get(k);
          if (pid != null && pid !== this.id) { this.d5Deaths.push([k, pid, this.TICK]); if (this.d5Deaths.length > 24) this.d5Deaths.shift(); }
          this.occ.delete(k); this.live.delete(k); this.kidful.delete(k); this.s1seen.delete(k); this.healTry.delete(k); // freed ⇒ admissible now (healTry is heal pacing, not a chair embargo)
        }
      }
    }
    drainD5() { const out = this.d5Deaths; this.d5Deaths = []; return out; } // consume-once: a stale verdict must not re-kill a returned peer
    ownedRowHead() { return { pc: topo.childPath(this.coord.pc, this.coord.i), r: this.coord.r, i: 0 }; }
    rosterCells() { const h = this.ownedRowHead(); const out = []; for (let c = 0; c < C(); c++) out.push({ pc: h.pc, r: h.r, i: c }); return out; }
    // Do I hear ANY rook neighbour (row/col/down) first-hand? An S1 seat that
    // hears NONE for a long time is an isolated fragment — it can neither phone
    // (heartbeat is occ-gated) nor route-probe (no link), so E2 can't yield it.
    anyRookLive(after) {
      if (!this.hasCoord || this.coord.pc !== 0) return false;
      const ok = (k) => this.firstHandLive(k) && (after == null || this.live.get(k) > after);   // after: only hearing newer than that tick
      for (const m of topo.rowMates(this.coord)) if (ok(ck(m))) return true;
      for (const m of topo.colMates(this.coord)) if (ok(ck(m))) return true;
      return ok(ck(topo.down(this.coord)));
    }
    // 11a FRONTIER-ONLY ADMISSION: admit a newcomer only into a TRUE frontier
    // slot — a free cell whose down-child is NOT occupied. A free cell that
    // still owns a subtree is an INTERNAL hole: its fixed healer (that
    // down-child, VERTICAL) is already filling it; a newcomer there would
    // double-book, lose the race, requeue OUT, and leave a gossip phantom
    // permanently blocking refill (bug #2). Skip it; serveFind forwards deeper.
    firstFreeInRoster() {
      // V4 THE DEPTH WALL: the C++ twin's uint32 path overflows at depth 13
      // and silently aliases cells; the wall is enforced in BOTH twins so
      // they cannot diverge there (a depth-12 stadium is ~2 billion sections
      // — reaching the 13th floor is a dup-war signature, not a need).
      if (topo.pcDepth(this.coord.pc) >= 12) return null;
      // V4 wave 2: deep admission reads the SAME phantom-aware reservation as
      // the S1 scan (cellReserved, not raw cellTaken) — stale dup-war occ
      // echoes are never falsified down here (no s1Fill, no designated-arm
      // phantom clear), and raw occ let parents sit on free child rows
      // forever while joiners funneled into the depth wall (the N=2000
      // plateau livelock).
      // V7: the non-head cells of my child row are admissible only once I
      // have HELD that row's ledger since I seated — its head has phoned me
      // the row at least once. A free head cell is always admissible (seating
      // the head is what starts the ledger). Not a freshness window: the mint
      // site was a REPLACEMENT parent that had never heard the row; a parent
      // whose head later died keeps filling that row during the heal.
      const cells = this.rosterCells();
      const ledger = this.rowLedgerAt >= 0;
      for (let c = 0; c < cells.length; c++) {
        const rc = cells[c];
        const k = ck(rc);
        if (c > 0 && !ledger) continue;
        if (this.cellReserved(k)) continue;
        const dk = ck(topo.down(rc));
        if (this.cellReserved(dk) && !this.occIsPhantom(dk)) continue;
        if (this.softSitting(dk)) continue;
        // V4: deep admissions honor the same 45-tick cooling as S1 — a
        // silence-freed chair is not "admissible NOW".
        const ht = this.healTry.get(k);
        if (ht != null && this.TICK - ht <= 45) continue;
        return rc;
      }
      return null;
    }
    ownerCoord() { if (!this.hasCoord || this.coord.pc === 0) return null; return topo.up({ pc: this.coord.pc, r: this.coord.r, i: 0 }); }
    ownerId() { if (!this.hasCoord) return null; const u = topo.up({ pc: this.coord.pc, r: this.coord.r, i: 0 }); if (!u) return null; return this.occGet(ck(u)); }
    hasChildren() { for (const rc of this.rosterCells()) { const x = this.occGet(ck(rc)); if (x != null && x !== this.id) return true; } return false; }
    // 11a: does cell c own an OCCUPIED down-child (so its fixed healer is that
    // down-child, the VERTICAL rule — the right-neighbour must then DEFER)?
    // Known either directly (I link down(c)) or via childOf learned from PONGs.
    hasDownChild(c) { if (this.occGet(ck(topo.down(c))) != null) return true; const it = this.childOf.get(ck(c)); return it !== undefined && it != null; }
    // Random pick spreads door load (the doctrine) — but never re-pick a
    // target that has already proven SILENT this join (a dark member's cell
    // costs a full retry window per void FIND; at N=2+dark that stalled half
    // of all joins — behavior battery 14a, 2026-07-26). Any answer from a
    // target lifts the mark; when everyone is marked, fall back to the full
    // set (an all-dark roster still retries honestly).
    // TODO(sim parity): port triedSilent to test/sim/mesh.cpp — same rule.
    // DOOR-LISTED FIRST (2026-08-02, the fresh-corpse ask): a roster can
    // name a JUST-DEPARTED seat that is still s1Fresh at the greeter (its
    // LEAVE lost, its transport death not yet registered), and one silent
    // ask costs the seeker its whole retry window (the e2e serial-guests
    // "~23s clustering"). The seeker's own last GREETERS list is FRESH DOOR
    // TRUTH — it just knocked — and a pool entry dies WITH its socket, so a
    // fresh corpse is absent while every live S1 seat is present. Prefer
    // targets the door lists; fall back to the plain roster when the
    // intersection is empty. In a healthy room the intersection IS the
    // roster, so the pick distribution — and the door-load spread — are
    // unchanged. (Every stronger shape was tried and failed a pinned
    // battery: gateway-always livelocked mass rejoin at 29/400; gateway-
    // until-refused re-asked a slow admitter into twin-PLACE dups; gateway-
    // first-ask-only moved partition seed 29 into a split-brain draw.)
    pickRoster() {
      const liveIds = []; const fresh = []; const door = [];
      for (const e of this.roster) if (e.v !== this.id) {
        liveIds.push(e.v);
        if (!this.triedSilent || !this.triedSilent.has(e.v)) {
          fresh.push(e.v);
          if (this.lastGreeters && this.lastGreeters.includes(e.v)) door.push(e.v);
        }
      }
      const pool = door.length ? door : (fresh.length ? fresh : liveIds);
      if (!pool.length) return null;
      return pool[(this.rng() * pool.length) | 0];
    }
    // A standing-translost occupant is UNREACHABLE-PENDING-PROBE: handing it to
    // a newcomer as a gateway/FIND target wastes their whole retry window (the
    // honest answer is silence, not a corpse). Root cause of the unban-rejoin
    // wedge (2026-07-29): a banned member's seat sat in the survivor's HOME
    // roster between translost and the D5 confirm, the newcomer coin-flipped
    // onto the corpse, and the void FIND cost the full state-2 window.
    // Do I know any Section-1 seat beside the hole k (an arbiter a claim on k
    // would reach)? A cousin, or a home cell in my view.
    knowsRing(k) { for (const [kk, v] of this.cousins) if (isS1key(kk) && kk !== k && v != null && v !== this.id) return true; for (const [kk, v] of this.occ) if (kk !== k && isS1key(kk) && v != null && v !== this.id) return true; return false; }
    s1Roster() { const out = []; if (this.hasCoord && this.coord.pc === 0) out.push({ k: ck(this.coord), v: this.id }); for (const [k, v] of this.occ) if (isS1key(k) && v !== this.id && this.s1Fresh(k) && !this.translost.has(k)) out.push({ k, v }); return out; }

    // ---- S4 identity hook (seam) --------------------------------------------
    // verifyFill(msg): is this occupancy-changing frame (PLACE / CLAIM /
    // FINDLEAF) from a source authorized to author it? The C3 STRUCTURE (one
    // fixed healer per hole) serializes fills; S4 identity (mesh-identity.js)
    // makes WHO the healer is unforgeable, so a forged peer id can't capture a
    // seat, race a turnover, or climb.
    //
    // Ed25519 verification is done at the boundary that owns transport+crypto
    // (mesh-wire.js in production, the harness fabric in tests), which verifies
    // the fill's signature against the TOFU-pinned participant key BEFORE
    // delivering and stamps the verdict as m.s4ok. This seam is FAIL-CLOSED with
    // NO escape: an occupancy-authoring fill is accepted ONLY if its signature
    // was verified. There is no "S4 off" — every real and every test node runs
    // identities. An unsigned/forged/tampered fill is dropped, full stop.
    verifyFill(msg) { return msg.s4ok === true; } // S4: fail-closed, no bypass

    // ---- entry (R1/R3/R4) ----
    // NEWCOMER knock: present my THROWAWAY key. If I'm first I mint genesis;
    // else I learn the real key via the dance and re-present it once seated.
    join() {
      // ENTRY-PACING INVARIANT: a paced-out (same-tick) join defers the SEND,
      // never the STATE. A requeue() whose join() got paced out used to return
      // with hasCoord=false but state still 3 — and tick()'s state-3 branch
      // never consumes reJoin, so the seat wedged forever: seated-looking,
      // coordless, knocking never (behavior 04a: a 20s radio blip left one
      // phone solo for 3.5 minutes; the netDark tick-freeze lets a whole
      // rescue→rejoin→rescue dance share ONE tick at the radio-on edge).
      if (this.joinTick === this.TICK) { if (!this.hasCoord) { this.state = 0; this.retryAt = this.TICK; } this.reJoin = true; this.wake(); return; } // ENTRY PACING: one knock per tick
      this.joinTick = this.TICK;
      this.state = 0; this.retryAt = this.TICK; this.haveRoster = false;
      this.resumeTries = 0; // ENTRY RESUME: a fresh knock re-arms the knockless-retry budget
      this.triedSilent = new Set(); // per-join-attempt silent-target marks (pickRoster)
      this.forkProbe = false; this.forkPaused = false; this.forkSamples = [];
      this.forkOpts = new Map(); this.forkPending = 0;
      this.emitRelay(this.myKey); this.wake();
    }
    askSeat(target) { if (this.askTick === this.TICK) { if (!this.hasCoord) { this.state = 2; this.retryAt = this.TICK; } this.reAsk = true; this.wake(); return; } this.askTick = this.TICK; this.state = 2; this.retryAt = this.TICK; this.findAckAt = -1; (this.triedSilent = this.triedSilent || new Set()).add(target); this.lastAsked = target; const fm = { t: 'FIND', nc: this.id, ttl: 200, spread: (SPREAD && this.noroomSeen >= 1) }; const dk = this.darkGreeters(target); if (dk.length) fm.dark = dk; this.emit(target, fm); this.wake(); } // ENTRY PACING: one ask per tick (paced-out ⇒ defer the SEND, never the STATE — see join())
    // ENTRY RESUME (2026-08-04 plane incident; test/tools/seat-flap-repro.js).
    // The dance is three door round trips — knock→GREETERS, WHOHOME→HOME,
    // FIND→PLACE — and a retry used to restart it from the knock, so a socket
    // whose continuous up-windows were shorter than the WHOLE dance never
    // seated (measured: at a fixed 33% uptime, 100s windows seat in 5.5s;
    // 1.5s windows never seat) — while an already-established media pc kept
    // streaming, needing zero round trips. Video without a seat, for hours.
    // A retry that still HOLDS a fresh greeter list re-enters at the WHOHOME
    // step instead of re-knocking: each up-window then has to carry only ONE
    // round trip, and the dance ratchets forward across socket deaths.
    // Bounds, so a stale list can never trap the entrant:
    //   - the list is trusted only for RELAY_TTL — the registry's own entry
    //     lifetime; beyond that we can't know the doors are still doors;
    //   - each list entry is tried ONCE per join attempt (the same triedSilent
    //     silent-until-answered marks the classic path uses); a dead list
    //     costs one WHOHOME per entry and then the next retry re-knocks;
    //   - fork handling is untouched: a resume never runs while a fork probe
    //     or pick-one pause is live, and R5 cluster detection stays where it
    //     was — on fresh GREETERS replies. A fork born after our knock waits
    //     one RELAY_TTL; forks are rare and human-gated, entry is constant.
    resumeAsk() {
      if (this.forkProbe || this.forkPaused) return false;
      const ls = this.lastGreeters;
      if (!ls || !ls.length) return false;
      if (this.greetersAt === undefined || this.TICK - this.greetersAt > RELAY_TTL) return false;
      const tried = this.triedSilent = this.triedSilent || new Set();
      let pool = ls.filter((g) => g && g !== this.id && !tried.has(g));
      // The silent marks say "its HOME never landed" — but on a flapping
      // socket that is usually OUR flap eating the reply, not a dark greeter
      // (the exact confusion this path exists to survive: a 1-greeter room
      // marks its only door on the first WHOHOME and resume would then never
      // fire twice). So when the marks exhaust the list, cycle it again —
      // but only RESUME_TRIES consecutive times without a HOME, so a
      // genuinely dead list concedes to a fresh knock, never a livelock.
      if (!pool.length) {
        if ((this.resumeTries || 0) >= 6) return false; // mirrors seatTries<=6
        pool = ls.filter((g) => g && g !== this.id);
        if (!pool.length) return false;
      }
      this.resumeTries = (this.resumeTries || 0) + 1; // cleared by join() and by a landed HOME — any real progress re-arms the budget
      const g = pool[(this.rng() * pool.length) | 0];
      tried.add(g); // silent until its HOME lands — same mark the knock path sets
      this.gateway = g;
      this.emit(g, { t: 'WHOHOME', from: this.id, ttl: 60 });
      this.state = 1; this.retryAt = this.TICK;
      this.wake();
      return true;
    }
    // Faces for pick-one UI: Stage first, else Stadium, else S1 roster peers.
    static forkFaceList(sample) {
      if (sample.stage && sample.stage.length) return { tier: 'stage', faces: sample.stage.slice(0, 12) };
      if (sample.stadium && sample.stadium.length) return { tier: 'stadium', faces: sample.stadium.slice(0, 12) };
      return { tier: 'roster', faces: (sample.faces || []).slice(0, 12) };
    }
    // Peer-id set from a HOME roster [{k,v}|id, …].
    static rosterPeers(roster) {
      const s = new Set();
      for (const e of roster || []) {
        const v = e && (e.v != null ? e.v : e);
        if (v != null && v !== '') s.add(String(v));
      }
      return s;
    }
    // Jaccard-ish: any shared peer ⇒ same cluster; else separate (torn halves).
    static rostersOverlap(a, b) {
      if (!a.size || !b.size) return false;
      for (const p of a) if (b.has(p)) return true;
      return false;
    }
    // Same room seen through two doors, or two real rooms? Different gkey is
    // ALWAYS two rooms (the crypto key IS the room). Same gkey splits ONLY on
    // POSITIVE disjointness evidence — because two doors of ONE healthy room
    // can look disjoint when instance ids churned (both phones reloaded: each
    // roster still carries the other's dead old id) or when S1 freshness
    // lapsed (roster = just me). A false fork throws the pick-one modal at a
    // healthy room, and a headless client parked there is indistinguishable
    // from a dead door (the 2026-07-26 monitor wedge). So, same gkey:
    //   · any shared roster id            ⇒ same room (the classic rule)
    //   · any shared Stage/Stadium FACE   ⇒ same room (app-layer display
    //     identities survive instance-id churn; a real torn half can't hold
    //     the same live person as the other half)
    //   · a BLIND door (roster names nobody beyond its own greeter) ⇒ merge —
    //     "I can't vouch for my row right now" is ignorance, not evidence of
    //     a separate room. A genuinely lone torn seat self-rescues via the
    //     fragment requeue path; it never needs a newcomer's pick to survive.
    static forkSameRoom(a, b) {
      if (a.gkey !== b.gkey) return false;
      if (Seat.rostersOverlap(a.peers, b.peers)) return true;
      for (const f of a.facesAll) if (b.facesAll.has(f)) return true;
      const blind = (c) => { for (const p of c.peers) if (!c.gws.has(p)) return false; return true; };
      return blind(a) || blind(b);
    }
    // Cluster HOME samples: different gkey always split; same gkey splits only
    // on positive disjointness evidence (forkSameRoom). Fixpoint merge — a
    // later sample may bridge two earlier clusters.
    clusterForkSamples(samples) {
      const clusters = []; // each: { gkey, gateway, roster, stage, stadium, peers, gws, facesAll }
      const absorb = (c, s) => {
        for (const p of s.peers) c.peers.add(p);
        for (const g of s.gws) c.gws.add(g);
        for (const f of s.facesAll) c.facesAll.add(f);
        if ((s.stage || []).length > (c.stage || []).length) c.stage = s.stage;
        if ((s.stadium || []).length > (c.stadium || []).length) c.stadium = s.stadium;
        if ((s.roster || []).length > (c.roster || []).length) { c.roster = s.roster; c.gateway = s.gateway; }
      };
      for (const s of samples) {
        const proto = {
          gkey: s.gkey, gateway: s.gateway, roster: s.roster,
          stage: s.stage || [], stadium: s.stadium || [],
          peers: Seat.rosterPeers(s.roster),
          gws: new Set(s.gateway != null ? [String(s.gateway)] : []),
          facesAll: new Set([...(s.stage || []), ...(s.stadium || [])].map(String)),
        };
        const hit = clusters.find((c) => Seat.forkSameRoom(c, proto));
        if (hit) absorb(hit, proto); else clusters.push(proto);
      }
      for (let again = true; again;) {
        again = false;
        for (let i = 0; i < clusters.length && !again; i++) {
          for (let j = i + 1; j < clusters.length; j++) {
            if (Seat.forkSameRoom(clusters[i], clusters[j])) {
              absorb(clusters[i], clusters[j]); clusters.splice(j, 1); again = true; break;
            }
          }
        }
      }
      return clusters.map((c, i) => {
        const fl = Seat.forkFaceList(c);
        const id = String(c.gkey) + '#' + i + '#' + String(c.gateway || i);
        return {
          id, gkey: c.gkey, gateway: c.gateway, roster: c.roster,
          stage: c.stage || [], stadium: c.stadium || [],
          faces: fl.faces, tier: fl.tier, n: c.peers.size || fl.faces.length,
        };
      });
    }
    // R5: after multi-greeter HOMEs, one cluster → seat; two+ → pick-one.
    maybeResolveFork() {
      if (!this.forkProbe || this.forkPaused || this.state !== 1) return;
      const TICK = this.TICK;
      // Ready when every probed greeter answered, or FORK_GRACE ticks after the
      // latest HOME with some still silent (the honest doors answer within a
      // round trip of each other; a door still silent after the grace is dark,
      // not slow — it used to hold the newcomer at the 30-tick ceiling), or at
      // the ceiling with nothing at all.
      const ready = this.forkPending <= 0 || (this.forkAt >= 0 && TICK - this.forkAt >= 30) || (this.forkSamples.length > 0 && this.forkLastAt >= 0 && TICK - this.forkLastAt >= FORK_GRACE);
      if (!ready && this.forkSamples.length < 2) return;
      if (this.forkSamples.length === 0) {
        if (ready) { this.forkProbe = false; this.retryAt = TICK - 21; } // every door dark for the whole ceiling: the state-1 retry (TICK - retryAt > 20) fires this tick, not 11 ticks later
        return;
      }
      const opts = this.clusterForkSamples(this.forkSamples);
      this.forkOpts = new Map(opts.map((o) => [o.id, o]));
      if (opts.length === 1) { this.acceptFork(opts[0]); return; }
      // Two+ clusters (multi-genesis OR same-key torn greeter halves).
      this.forkProbe = false; this.forkPaused = true;
      if (typeof this.env.onFork === 'function') {
        this.env.onFork(opts.map((o) => ({
          id: o.id, gkey: o.gkey, gateway: o.gateway,
          faces: o.faces, tier: o.tier, n: o.n,
          stage: o.stage, stadium: o.stadium,
        })));
      } else {
        // No UI: deterministic — prefer lowest gkey, then lowest option id.
        opts.sort((a, b) => (a.gkey < b.gkey ? -1 : a.gkey > b.gkey ? 1 : a.id < b.id ? -1 : 1));
        this.acceptFork(opts[0]);
      }
    }
    // Human (or sim) chose one option id (or legacy gkey if unique). Never merge.
    chooseFork(idOrGkey) {
      if (!this.forkPaused) return false;
      let o = this.forkOpts.get(String(idOrGkey));
      if (!o) {
        // allow chooseFork(gkey) when only one option has that gkey
        const hits = [...this.forkOpts.values()].filter((x) => x.gkey === String(idOrGkey));
        if (hits.length === 1) o = hits[0];
      }
      if (!o) return false;
      this.acceptFork(o);
      return true;
    }
    acceptFork(o) {
      this.forkPaused = false; this.forkProbe = false; this.forkPending = 0;
      this.genKey = o.gkey;
      this.gateway = o.gateway;
      this.roster = o.roster;
      this.haveRoster = true;
      this.lastReach = this.TICK;
      this.seatTries = 0;
      this.state = 1;
      const t = this.pickRoster();
      if (t != null) this.askSeat(t);
      else this.retryAt = this.TICK - 10;
      this.wake();
    }

    take(c, owner, nbrs, pp) {
      if (c.i >= C() || c.r >= C()) return;   // sanity: never take a malformed coord
      this.rowLedger = !(c.pc === 0 && c.i === 0 && owner != null);   // V4: an admitted S1 row head waits for its assigner's SITXFER
      // PP: the proof my admitter signed with this PLACE; a healer (no
      // admitter) asks the hole's admitter for one with a CLAIM (below).
      this.pp = (owner != null && pp && pp.sig != null) ? { ck: ck(c), s4: pp } : null; this.ppAskAt = -1; this.admBy = null;   // admBy: set by the PLACE intake (the verified signer), never by take
      this.rowGen = 0; this.rowLedgerLast = ''; this.rowGenSeen = null;   // V7b: a new seat's row ledger starts at generation 0 (its first beats delete nothing at the owner)
      this.tn = this.tnSalt + '.' + (++this.tnSeq);   // a new tenancy (see emit)
      this.coord = c; this.hasCoord = true; this.state = 3; this.joinStart = -1; this.stranded = false; this.reAsk = false; this.reJoin = false; this.noroomSeen = 0; this.rowLedgerAt = -1; // seated: any deferred entry retry is moot; T7: the NOROOM evidence dies; V7: a new seat holds no child-row ledger yet with the attempt it belonged to
      // A: self-confirm sitting-down → seated (only the joiner upgrades).
      this.confirmSeated(ck(c), this.id);
      // The neighbours a PLACE (or a heal) teaches me: my new owned links, my
      // owner, and the admitter itself (wherever it sits) — nothing else, so a
      // signed PLACE cannot fill my view with cells of its choosing.
      { const ok = new Set(topo.ownedLinks(c).map(ck)); const oc = ownerCoordOf(c); if (oc) ok.add(ck(oc)); let adm = owner != null;
        for (const kv of (Array.isArray(nbrs) ? nbrs : [])) { if (!kv || kv.v == null || !cellKeyOk(kv.k)) continue; if (!ok.has(kv.k)) { if (!adm || kv.v !== owner) continue; adm = false; } if (!this.occ.has(kv.k)) { this.setOcc(kv.k, kv.v); this.noteS1(kv.k); } } }
      this.drainAt = 0; this.seatTries = 0; this.seatedAt = this.TICK; this.rookSeenAt = this.TICK; this.estAt = this.TICK; this.nbrAt = this.TICK; this.pendY = null; this.challTo = null; this.lateY = null;
      // § G: a seat change re-parents me — new aggregator, new scope, new child
      // row. Every digest relationship starts over, including G4's grace
      // window; carrying the old one over would accuse a brand-new aggregator
      // of suppressing reports it never received. The ring's CONTENTS too: a
      // retained pre-move record collides with my cell's PREVIOUS occupant's
      // stamp and reads as a forged echo (sim: 10 false fires at N=600).
      // (Display state only — nothing here can move a seat.)
      this.upLogI = 0; this.upSince = -1; this.lastAgg = null; for (let q = 0; q < 16; q++) this.upLog[q] = { at: -1, n: 0, refuse: 0 };
      this.downDig = dig0(); this.downUsed = dig0(); this.myDig = dig0(); this.rowDig = dig0(); this.rootDig = dig0();
      this.rowKids.clear(); this.rowUsed.clear(); if (c.pc !== 0) this.s1tab.clear();
      // The handover hold (rollup): if I published from another cell recently,
      // that report is still on its way out of the old chain — its drop starts
      // at my vacate (<= CONFIRM_TTL) and climbs a level a beat. Two beats a
      // level over my old depth, plus the Section-1 exchange and the root. A
      // Section-1 to Section-1 move needs none: both reports sit in the same
      // Section-1 tables, where one author counts once (rollup).
      { const hold = CONFIRM_TTL + (this.lastPubDepth + 3) * DIG_HOLD_LEVEL; const s1Only = this.lastPubDepth === 0 && c.pc === 0; if (!s1Only && this.lastPubAt >= 0 && this.TICK - this.lastPubAt < hold) this.digHoldUntil = this.TICK + hold; }
      this.lastAck = this.TICK; this.lastPhone = this.TICK;
      if (owner != null) this.emit(owner, { t: 'CLAIM', ck: ck(c), id: this.id });
      else { const adm = this.ppAdmitter(c); if (adm != null && adm !== this.id) { this.ppAskAt = this.TICK; this.emit(adm, { t: 'CLAIM', ck: ck(c), id: this.id }); } } // PP: a healer's claim to its hole's admitter, answered with a proof (confirmSeated)
      if (c.pc === 0) { this.s1CheckAt = this.TICK + E3_PERIOD + (this.rng() * E3_PERIOD | 0); this.emitRelay(this.genKey); } // E3: a Section-1 seat registers as a greeter on seating
      this.announce(); this.wake();
    }
    announce() {
      const seen = new Set();
      for (const olc of topo.ownedLinks(this.coord)) {
        const lk = ck(olc); let x = this.occGet(lk);
        if (x == null && this.softSitting(lk)) { const s = this.sitting.get(lk); if (s) x = s.joiner; }
        if (x != null && x !== this.id && !seen.has(x)) { seen.add(x); this.emit(x, { t: 'HELLO', ck: ck(this.coord), id: this.id }); }
      }
    }

    // GOODBYE OVER ITS OWN CHANNEL (the app's 'bye' on an authenticated
    // DataChannel, said now — a live channel cannot replay it): the same
    // departure a LEAVE states, for every cell my view holds the leaver at.
    // The mesh LEAVE rides the same channel a beat later and is lost when the
    // page dies first: the leaver's row-mate then held a corpse at the head
    // cell until D5 confirmed it, NOROOMing the leaver's own reload (chaos
    // seed 10 #1: 10.5 s; the runs whose LEAVE arrived took 4.2 s).
    goodbye(pid) {
      if (pid == null || pid === this.id || !this.hasCoord || this.state !== 3) return;
      for (const [k, v] of Array.from(this.occ)) {
        if (v !== pid || k === ck(this.coord)) continue;
        this.linkedBy.delete(k); this.tenOf.delete(k); this.occ.delete(k); this.live.delete(k); this.kidful.delete(k); this.s1seen.delete(k); this.tlForget(k, 'goodbye'); this.healTry.delete(k); this.digForget(k);
        { const sit = this.sitting.get(k); if (sit && sit.joiner === pid) this.clearSoft(k); }
        this.lastChurn = this.TICK;
        this.goodbyeHeal(k);
      }
    }
    // A ROOM OF KNOCKERS FOUNDS ITSELF. The only founding
    // rule was R3: mint when the door's greeter list comes back empty. Seats
    // that were seated a moment ago keep their registration for the relay's
    // GREETER_TTL, so when every member is at the door at once (requeued,
    // reloaded) each knocker's list names the others, nobody mints, and
    // nobody is seated to admit anyone: never. The app hands a knocker the
    // relay's FULL socket list every few seconds while it waits (doorRound);
    // the knocker asks every socket for HOME. A round is complete when every
    // socket answered with a bare HOME (at the door, like me) and none
    // answered seated. After TWO consecutive complete rounds over the SAME
    // socket set (a member mid-reload has no socket for a moment), the LOWEST
    // id of them all founds 0/0.0 — with its remembered tree's genesis key
    // when it has one (lastTree), so a seated member that surfaces late is
    // the same tree and the two-heads contest settles it; a new key only
    // without memory. A remembered tree larger than one Section-1 home (deep
    // seats hold no socket: they would be invisible) never founds.
    // App-triggered: driven by the relay's socket list.
    doorRound(ids) {
      if (this.state === 3 || !Array.isArray(ids)) return;
      const set = ids.filter((x) => x != null && x !== this.id).map(String).sort();
      if (!set.length || set.length > C() * C()) { this.dr = null; this.drPrev = null; return; }
      this.dr = { key: set.join(','), ids: set, at: this.TICK, bare: new Set() };
      for (const x of set) this.emit(x, { t: 'WHOHOME', from: this.id, ttl: 60 });
    }
    closeDoorRound() {
      const r = this.dr; this.dr = null; if (!r) return;
      const complete = r.ids.every((x) => r.bare.has(x));
      if (complete && this.drPrev === r.key) { this.drPrev = null; this.foundDoor(r.ids); return; }
      this.drPrev = complete ? r.key : null;
    }
    foundDoor(ids) {
      if (this.state === 3 || ids.some((x) => x < this.id)) return;   // the lowest id founds; the rest knock on it
      const mem = this.lastTree;
      if (mem && mem.n > C() * C()) return;                          // a remembered tree with deep seats: they would be invisible
      this.genKey = mem && mem.gkey != null ? mem.gkey : this.myKey;
      this.doorFounded = this.TICK;
      this.take({ pc: 0, r: 0, i: 0 }, null, []);
    }
    noteTree() { if (this.state !== 3 || !this.hasCoord || this.genKey == null) return; const n = this.occ.size; if (!this.lastTree || this.lastTree.gkey !== this.genKey || n > this.lastTree.n) this.lastTree = { gkey: this.genKey, n }; }
    // HOME: a Section-1 seat's answer to a WHOHOME (the door's introduction).
    homeFor(to) {
      // App may attach Stage / Stadium face lists for R5 pick-one UI.
      let stage = [], stadium = [];
      try {
        if (typeof this.env.homeFaces === 'function') {
          const f = this.env.homeFaces() || {};
          stage = (f.stage || []).map(String);
          stadium = (f.stadium || []).map(String);
        }
      } catch (e) {}
      this.emit(to, { t: 'HOME', roster: this.s1Roster(), id: this.id, gkey: this.genKey, stage, stadium });
    }
    // A DOOR BACK FROM DARK ANSWERS ITS KNOCKERS: seats
    // still knocking (state 1) whose WHOHOME went into my dark re-ask only on
    // their 20-tick retry, and nothing tells them I am back — they are not
    // greeters, so neither the relay's deltas nor my greeting reach them. The
    // app hands me, once per dark return, the relay's socket list; each socket
    // my view does not hold as a member gets the HOME it would have had — the
    // entry answer, which the wire lets a member send to someone at the door.
    // One answer per id per return, at most 8: never a loop, never a flood.
    // App-triggered: driven by the relay's socket list.
    answerDoor(ids) {
      if (this.state !== 3 || !this.hasCoord || this.coord.pc !== 0 || !Array.isArray(ids)) return 0;
      const members = new Set(this.occ.values()); let n = 0;
      for (const x of ids) { if (n >= 8) break; if (x == null || x === this.id || members.has(x)) continue; this.homeFor(x); n++; }
      return n;
    }
    // GREET: my cell to one peer over the channel that just opened to it,
    // whether or not my view holds it at an owned link (announce covers
    // those). A HELLO is a statement: the receiver takes it only for a cell
    // it relates to (claimRel) — its own cell, a dup to settle, included.
    greet(x) { if (x == null || x === this.id || this.state !== 3 || !this.hasCoord) return; for (const olc of topo.ownedLinks(this.coord)) if (this.occGet(ck(olc)) === x) return; this.emit(x, { t: 'HELLO', ck: ck(this.coord), id: this.id }); }

    admit(c, f) {
      const nc = f.nc;
      const k = ck(c);
      this.tlForget(k, 'refill'); // the cell genuinely refills — any standing D5 observation of the old occupant ends here
      const nbrs = []; const ol = topo.ownedLinks(c);
      for (const olc of ol) { const x = this.occGet(ck(olc)); if (x != null && x !== nc) nbrs.push({ k: ck(olc), v: x }); }
      // ALWAYS teach the admittee its ADMITTER (2026-08-02) — not only when
      // the admitter happens to be an owned-link. A deep non-head admittee
      // whose admitter is the SECTION OWNER learned nothing about it, so
      // when that admittee later became the head's LEFT-PACK healer it
      // promoted itself into the head hole with an EMPTY nbrs list:
      // take(hole, null, []) sends no CLAIM, the no-neighbour claim window
      // confirms SAME-TICK, and the promoted head is an ISLAND — empty occ,
      // no phone target, invisible to the owner, whose stale head-occ then
      // re-admits another seat behind it. Two seats oscillated head↔row-cell
      // forever, sampling as a duplicate (c-sweep C=5 0.30×2 seed 1). The
      // entry is truthful (the admitter at its real coord) — it can only
      // inform.
      let selfNb = false; for (const olc of ol) if (ck(olc) === ck(this.coord)) selfNb = true;
      if (!selfNb && this.hasCoord) nbrs.push({ k: ck(this.coord), v: this.id });
      if (selfNb) nbrs.push({ k: ck(this.coord), v: this.id });
      const m = { t: 'PLACE', coord: c, owner: this.id, nbrs, tag: f.tag, nc };
      // Both kinds reserve with a SOFT sitting-down mark only — never permanent
      // occ without self-confirm (loss wedge). Q2 compaction (tag==1) used to
      // write occ here: a reservation with no first-hand stamp that nothing
      // ever freed, so a lost or declined PLACE (the mover re-validates on
      // arrival) left a permanent ghost that shut the slot for good (sim
      // mesh_seat.inc admit, repro-compaction leg 1 seed 6). The soft mark is
      // checked back by SITPING like a newcomer's; no PLACE is kept for replay.
      { const gk = k + '|' + nc; if (this.ppGiven.size >= 128) this.ppGiven.delete(this.ppGiven.keys().next().value); this.ppGiven.set(gk, this.TICK); }
      if (f.tag === 1) {
        this.markSitting(k, nc);
        this.route(f.coord, null, m);
      } else {
        this.markSitting(k, nc); this.sitting.get(k).pl = Object.assign({}, m); // FINDACK: a snapshot for a re-sent PLACE — taken before emit, because route() and the transport stamp the sent object in flight
        this.emit(nc, m); this._gspReplay(nc);
      }
    }
    // FINDACK: I am the seeker's own greeter (it sent me this FIND) and I handed
    // it on rather than answering — tell the seeker its FIND is alive.
    // ...but NOT when the admitter I handed it to (cell k) is already silent:
    // two of my 8-tick phone beats unanswered (its stamp still reads first-hand
    // live). The FIND still goes (a silent-but-real head stays reachable: the
    // ring-hold), unacknowledged, so the seeker re-asks after FIND_ACK_WAIT.
    // With the ack it held its 60-tick window while the FIND sat in a dark
    // head (33 s at the door).
    // ...nor, after a return from a dark spell or a freeze (backAt), to an
    // admitter I have not heard since: no stamp, or only one from before the
    // dark, is no hearing (a thawed seat acknowledged a
    // hand-off to the dark head and the seeker waited its full window). A seat
    // that never had a dark spell is unchanged. deep:
    // the descend hand-off, where only this rule applies.
    findAck(mm, k, deep) {
      if (mm.from == null || mm.from !== mm.nc) return;
      if (k != null && !deep && this.silentFor(k, LONE_GREET_AFTER)) return;
      if (k != null && this.backAt >= 0 && !(this.live.get(k) > this.backAt)) return;
      this.emit(mm.nc, { t: 'FINDACK', nc: mm.nc });
    }
    // DARK GREETERS (the seeker's side of serveFind's split-off guard): the
    // door can list a greeter whose radio went dark without a close, for as
    // long as the relay keeps its socket. I ask every listed greeter WHOHOME;
    // one that stays silent past DARK_WAIT while I keep asking is dark to me,
    // and my FIND names it, so a lone head does not hold me out on its
    // account. A greeter seated in a second ring answers the same ask, so it
    // never appears here and the guard still holds.
    noteDoorAsk(to) { const A = this.doorAsk || (this.doorAsk = new Map()); const e = A.get(to); if (e && this.TICK - e.last <= DARK_ASK_FRESH) e.last = this.TICK; else { A.delete(to); A.set(to, { first: this.TICK, last: this.TICK }); if (A.size > 64) A.delete(A.keys().next().value); } }
    darkGreeters(skip) { const out = []; if (!this.doorAsk) return out; for (const [g, e] of this.doorAsk) { if (g !== skip && this.TICK - e.first >= DARK_WAIT && this.TICK - e.last <= DARK_ASK_FRESH) out.push(g); if (out.length >= 8) break; } return out; }
    noteKnock(x) { if (x == null) return; const K = this.knockAt || (this.knockAt = new Map()); K.delete(x); K.set(x, this.TICK); if (K.size > 64) K.delete(K.keys().next().value); }
    knocking(x) { const t = this.knockAt && this.knockAt.get(x); return t !== undefined && this.TICK - t <= KNOCK_FRESH; }
    silentFor(k, n) { const it = this.live.get(k); return it !== undefined && this.TICK - it > n; }
    serveFind(mm) {
      const TICK = this.TICK;
      if (!this.hasCoord || mm.ttl <= 0) { this.noroomWhy = 'unseated'; this.emit(mm.nc, { t: 'NOROOM', nd: this.hasCoord ? topo.pcDepth(this.coord.pc) : 0 }); return; }
      for (const s of this.sitting.values()) if (s.joiner === mm.nc && s.assigner === this.id && s.pl && TICK - s.at <= SIT_TTL) { this.emit(mm.nc, Object.assign({}, s.pl)); return; } // FINDACK: a re-ask reaching the admitter that already vouches this seeker gets the SAME chair again (its PLACE was lost) — never a twin vouch
      if (this.coord.pc === 0) {
        const skip = [];   // forensics: why each Section-1 cell was passed over (noroomWhy, the test trace's NOROOM row)
        // A SPLIT-OFF SEAT ADMITS NOBODY INTO SECTION 1 (sim twin). A healer
        // that left-packed on a stale view of the hole's links can hear no
        // rook neighbour at all (its hint of the head cell was a corpse, the
        // real head claimed around it): its row looks dead-held from the
        // inside, and the resurrection arm below seated a newcomer into a
        // cell a live seat held, which then seated a second newcomer over the
        // next live seat — a second home ring for 27,000 ticks (c-sweep C=2
        // churn 0.15 seed 2, dups 2). While the door lists other greeters and
        // I have heard no rook neighbour for OWNER_SILENT, I hold the hole
        // (H1-S1): the split-off re-knock requeues me, or a neighbour's beat
        // reaches me first. The SEEKER is no such greeter: it knocked, so the
        // door lists it, and a list of me and it says nobody else is
        // registered. A two-person room whose duplicate head lost the genesis
        // race (loneGreet) requeued into this hold — the winner alone at the
        // head cell, hearing no rook peer, refused the loser's FIND for as
        // long as the loser stayed in the pool.
        // ...and a greeter the SEEKER found dark (its FIND's dark list: it
        // asked that greeter WHOHOME over the door and heard nothing) is no
        // live second ring either. The head came back from a long freeze
        // while its other mate's radio was dark, unclosed, still listed: the
        // knocking mate was held out until the dark one came back (14 s).
        // ...and a greeter that is itself KNOCKING on me (a FIND from it in the
        // last KNOCK_FRESH ticks) is at the door, not seated in a second ring.
        // The head came back alone (its mates had
        // healed around it and were CONFIRMed back out), and each mate's
        // listing blocked the other's admission: NOROOM 'split-off' to every
        // FIND until the page reloaded itself (84 s, 64 s).
        if (TICK - this.rookSeenAt > OWNER_SILENT && this.greetersAt !== undefined && TICK - this.greetersAt <= RELAY_TTL && this.lastGreeters.some((g) => g != null && g !== this.id && g !== mm.nc && !this.knocking(g) && !(Array.isArray(mm.dark) && mm.dark.includes(g)))) { this.noroomWhy = 'split-off'; this.emit(mm.nc, { t: 'NOROOM', nd: 0 }); return; }
        // H7 ROW-FILL seating (replaces the old column backfill): Section 1
        // fills ROW-MAJOR — row 0 seats 0..C-1, then row 1, ... — so the first
        // C people in a room are ROW-MATES (the media plane's near field is
        // row-scoped: a 2-person meeting must be a direct conversation, never
        // column-mates). Admission keeps the C3 fixed-designation discipline:
        // every S1 cell has ONE designated admitter —
        //   (0,t,j>0): its row head (0,t,0);
        //   (0,t,0):   the head of the row ABOVE, (0,(t-1+C)%C,0) — the old H7
        //              seat relation inverted (growth seeds DOWNWARD row by
        //              row; the wrap still lets ordinary arrival traffic
        //              resurrect a fully-dead row, H7's original purpose).
        // Scan row-major for the first admissible cell: free AND a true
        // FRONTIER (11a: a free cell with a live down-child is an INTERNAL
        // hole owned by its fixed healer, the VERTICAL down-child — admitting
        // there would race it and mint a phantom). Admit if I am the cell's
        // designated admitter, else hand the FIND to the admitter — my row
        // head or a fellow head, a rook link; and every S1 seat is a socketed
        // greeter, so the hand-off is always deliverable.
        // Row liveness, FIRST-HAND-FIRST: my OWN row is live because I AM IN
        // IT — a lone survivor's s1seen of its own cells decays (nobody phones
        // a lone seat), and without this a survivor would resurrection-scan
        // its own live row and seat a 2-person room as COLUMN-mates (the
        // headless-row repro, leg A). Computed up front for all rows: the
        // headless-row devolution below needs the ADMITTER's row too.
        const rowLive = [], rowSeen = [], rowHeld = [];
        for (let t = 0; t < C(); t++) {
          rowLive[t] = (this.coord.r === t); rowSeen[t] = rowLive[t]; rowHeld[t] = false;
          for (let j = 0; j < C(); j++) { const k = ck({ pc: 0, r: t, i: j }); if (this.s1Fresh(k)) rowLive[t] = true; if (this.s1seen.has(k)) rowSeen[t] = true; if (this.cellReserved(k)) rowHeld[t] = true; }
        }
        for (let t = 0; t < C(); t++) {
          // A + H7 (HARDENED 2026-08-02): do NOT start the next S1 row until
          // the previous row is fully OCCUPIED — confirmed seats, not
          // reservations. A row of soft sitting-down marks is a row of
          // vouches nobody has answered yet: seating a newcomer BEHIND it
          // gambles that every one of them confirms, and when they are killed
          // tabs (the ghost-churn repro) the newcomer lands in an empty row
          // with zero live links — a fragment that can pull neither snap nor
          // app from anyone. NOROOM is the honest answer while the previous
          // row settles. (The old gate counted cellTaken — occ OR soft — and
          // only refused a soft HEAD.)
          if (t > 0) {
            let prevFull = true;
            for (let j = 0; j < C(); j++) if (!this.occ.has(ck({ pc: 0, r: t - 1, i: j }))) { prevFull = false; break; }
            if (!prevFull) break;
          }
          const liveRow = rowLive[t], everSeen = rowSeen[t];
          // A VACATED row is not a corpse. Resurrection is for a row that DIED
          // wholesale — its stale occ lingers (nobody left to sweep it) and
          // blocks ordinary admission. A row the left-pack legitimately emptied
          // (cascade scoot-up) holds NO reservation at all: it is the frontier
          // again, and the head of the row above (proven full by the H7 gate)
          // seats it. Without this a drained row sent every FIND to the row
          // below — never live in a shrinking room — and newcomers past the
          // frontier searched forever (churn-combos B with spawn>1).
          if (!liveRow && everSeen && rowHeld[t]) {
            // RESURRECTION (old H7, row-targeted): this row LIVED and is now
            // entirely silent — a whole-row death. Its subtrees drain (anchor
            // dead at lastAck>80, long before the RING_HOLD vertical heal) and
            // re-enter as newcomers, and THIS is what re-seeds the row: stale
            // occ corpses / childOf must NOT block it (they linger for a wiped
            // row — nobody left to sweep them). Old H7's no-race discipline is
            // kept exactly: the admitters are the greeters of the row BELOW
            // ((t+1)%C — the old "row above me is dead" relation), each
            // admitting at its OWN column, so no two admitters ever target one
            // cell. Anyone else hands the FIND to its column-mate in that row
            // (a direct rook link; head as fallback). Adjacent dead rows
            // resolve bottom-up, the same upward cascade the old H7 produced.
            const below = (t + 1) % C();
            if (this.coord.r === below) {
              const k = ck({ pc: 0, r: t, i: this.coord.i });
              if (TICK - (this.healTry.has(k) ? this.healTry.get(k) : -999) > 45 || (this.healOnly.has(k) && this.oneRowRoom())) { this.healOnly.delete(k); this.healTry.set(k, TICK); this.admit({ pc: 0, r: t, i: this.coord.i }, mm); return; }
              continue;
            }
            // Forward toward the admitter row below ONLY over a FIRST-HAND-LIVE
            // link. Raw occGet here was a bug: when the admitter row is ALSO
            // wholly dead, its cells linger as stale occ echoes (a corpse's id,
            // never cleared once no neighbour hears a LEAVE and gossip re-seeds
            // it), so the FIND was handed to a DEAD seat and swallowed — two
            // ADJACENT dead home rows never resurrected (the scan returned at the
            // lower row before reaching the upper row it could itself admit).
            // First-hand liveness sees the corpse for what it is, so a dead
            // admitter row falls through to the bottom-up continue.
            const ac = ck({ pc: 0, r: below, i: this.coord.i }), ah = ck({ pc: 0, r: below, i: 0 });
            // First-hand, or DOOR-LISTED: mid-churn my first-hand hearing of
            // the admitter row decays while it is alive and greeting — the
            // door still lists it (every S1 seat is a greeter), and a door-
            // listed admitter is deliverable by definition. Without this, the
            // dead-row fall-through below raced a merely-unheard admitter
            // row's own admissions and minted a dup (c-sweep C=5 0.30×2
            // seed 1).
            const doorListed = (x) => x != null && !!(this.lastGreeters && this.lastGreeters.includes(x));
            let aid = this.firstHandLive(ac) ? this.occGet(ac) : (doorListed(this.occGet(ac)) ? this.occGet(ac) : null); let fh = aid != null && this.firstHandLive(ac);
            if (aid == null || aid === this.id) { const hx = this.occGet(ah); aid = this.firstHandLive(ah) ? hx : (doorListed(hx) ? hx : null); fh = aid != null && this.firstHandLive(ah); }
            // ONCE PER SEEKER when the admitter is only door-listed (fwdSeen):
            // a partition leaves the door listing a row I cannot reach (its
            // seats are alive and greeting on the far side), and a FIND handed
            // there is swallowed. The first hand-off keeps the merely-unheard
            // admitter's claim (the c-sweep dup); the seeker's retry falls
            // through to the bottom-up cascade, so two whole home rows on the
            // far side of a split still resurrect (repro-partition seed 11).
            if (aid != null && aid !== this.id && !fh) { const t = this.fwdSeen.get(mm.nc); if (t !== undefined && TICK - t <= 240) aid = null; else { if (this.fwdSeen.size >= 64) this.fwdSeen.delete(this.fwdSeen.keys().next().value); this.fwdSeen.set(mm.nc, TICK); } }
            if (aid != null && aid !== this.id) { this.emit(aid, { t: 'FIND', nc: mm.nc, ttl: mm.ttl - 1, spread: !!mm.spread }); this.findAck(mm, this.occGet(ac) === aid ? ac : ah); return; }
            // The whole admitter row below is dead too. "Resolve bottom-up"
            // DEADLOCKED here when EVERY row below was dead or empty (s1all
            // recovery: fresh greeters in rows 0-1, rows 2-4 dead, one stale
            // corpse hint in row 2 — 465 seekers NOROOM'd for 39k ticks): the
            // wrap admitters can never seat because seating THEM needs this
            // row first. A dead-held row whose resurrectors are also dead can
            // only be re-seeded by ORDINARY admission — fall through to the
            // j-loop: the H7 advance gate above already proved the row ABOVE
            // full, so j==0's admitter (that row's head) is alive, and the
            // stale corpse hints are individually skipped by cellReserved.
            // The row's new head then s1Fill-sweeps the corpses itself.
            // BUT ONLY WITH THE DOOR'S CORROBORATION: an unconditional fall-
            // through re-seeded rows a PARTITION had merely hidden and
            // minted split-brain dups (sweep split-0.5 seed 29: side B
            // dups=18). Every S1 seat is a greeter: the registry drops the
            // DEAD instantly, while a partitioned-but-alive row's members
            // keep E3-knocking the shared door and stay LISTED — so a hinted
            // occupant present in my own last greeter list means "hold the
            // hole" (H1-S1), and a row of occupants the door has forgotten
            // is genuinely dead.
            {
              let anyHint = false, doorHolds = false;
              for (let j = 0; j < C() && !doorHolds; j++) { const x = this.occGet(ck({ pc: 0, r: t, i: j })); if (x == null) continue; anyHint = true; if (this.lastGreeters && this.lastGreeters.includes(x)) doorHolds = true; }
              // POSITIVE corroboration only: fall through iff the row still
              // NAMES occupants and the door has forgotten every one of
              // them. A row whose hints have fully decayed gives no verdict —
              // hold (a partition starves hints and door-listings alike, and
              // H1-S1 says hold the hole when you cannot tell).
              if (doorHolds || !anyHint) continue;
            }
          }
          for (let j = 0; j < C(); j++) {
            const cell = { pc: 0, r: t, i: j }; const k = ck(cell);
            // Soft / real occupant reserved; phantoms free for rejoin.
            if (this.cellReserved(k)) { skip.push('R' + t + '.' + j); continue; }
            const dk = ck(topo.down(cell));
            if (this.softSitting(dk) || (this.cellReserved(dk) && !this.occIsPhantom(dk))) { skip.push('D' + t + '.' + j); continue; }
            // HEADLESS-ROW admission (the H7 amendment; roadmap §3 gap):
            //  - the vacated HEAD of a LIVE row is an INTERNAL HOLE owned by
            //    its designated healer (the H2 scoocher / vertical promotion)
            //    — never an admission target (C1: an admission must not race
            //    a healer).
            if (j === 0 && rowLive[t]) continue;
            let adm = j > 0 ? { pc: 0, r: t, i: 0 } : { pc: 0, r: (t - 1 + C()) % C(), i: 0 };
            // A: soft-only primary — assigner mass-fills the rest of the row.
            // NEVER devolve on mere silence of an occ occupant (headless-row C).
            if (this.softSitting(ck(adm)) && !this.occ.has(ck(adm)) && j > 0) {
              const sit = this.sitting.get(ck({ pc: 0, r: t, i: 0 }));
              if (sit && sit.assigner === this.id) {
                if (TICK - (this.healTry.has(k) ? this.healTry.get(k) : -999) > 45 || (this.healOnly.has(k) && this.oneRowRoom())) { this.healOnly.delete(k); this.healTry.set(k, TICK); this.admit(cell, mm); return; }
                continue;
              }
            }
            // H-CHAIN: devolve when admitter not reserved; prefer real row-mates.
            // V4 NARROWING (both arms): devolve ONLY over a cell I have AT SOME
            // POINT heard first-hand (live ever set — the falsifiable-ghost
            // discipline of the E1 narrowing). A genuine row-mate always heard
            // its admitter within a couple of D1 beats; a frontier seat reading
            // a gossip gap may not inherit admission authority.
            if (!this.cellReserved(ck(adm)) && this.fhEver.has(ck(adm)) && rowLive[adm.r]) {
              for (let dj = 1; dj < C(); dj++) {
                const d = { pc: 0, r: adm.r, i: dj };
                if (this.cellReserved(ck(d)) && !this.occIsPhantom(ck(d))) { adm = d; break; }
              }
            }
            // S1 column-clique admission: only when primary was known (s1seen)
            // and is not reserved — never when simply unknown. Devolve only to
            // STRICTLY DEEPER same-column seats (no wrap into denser upper rows).
            if (!this.cellReserved(ck(adm)) && this.fhEver.has(ck(adm)) && this.s1seen.has(ck(adm))) {
              for (let rr = cell.r + 1; rr < C(); rr++) {
                const d = { pc: 0, r: rr, i: cell.i };
                if (this.cellReserved(ck(d)) && !this.occIsPhantom(ck(d))) { adm = d; break; }
              }
            }
            if (ck(this.coord) === ck(adm)) {            // I am the designated (or devolved) admitter
              // V4 LEDGER GATE: as a vouched-in head I may not admit into MY
              // OWN row before my assigner's SITXFER arrives — my empty view
              // of the row is definitionally lagged (its cells may be promised
              // to admittees still in flight). Past 60 ticks a silent assigner
              // is dead and its vouches died with it.
              // In a one-row room a heal's stamp paces the heal, not admission: heal() re-arms every 45 ticks
              // and its FINDLEAF can never fill the seat there, so a shared gate never opened for a newcomer.
              if (this.coord.i === 0 && cell.r === this.coord.r && !this.rowLedger && TICK - this.seatedAt <= 60) { skip.push('L' + t + '.' + j); continue; }
              if (TICK - (this.healTry.has(k) ? this.healTry.get(k) : -999) > 45 || (this.healOnly.has(k) && this.oneRowRoom())) {
                this.healOnly.delete(k); this.healTry.set(k, TICK);
                if (this.occIsPhantom(k)) {
                  this.occ.delete(k); this.live.delete(k); this.s1seen.delete(k); this.kidful.delete(k); this.tlForget(k, 'phantom-heal');
                }
                this.admit(cell, mm); return;
              }
              skip.push('C' + t + '.' + j + '@' + (TICK - this.healTry.get(k))); continue;                                  // admit gate cooling — consider the next cell
            }
            // Hand off to reachable real admitter; never emit to a corpse.
            if (this.admitterReachable(ck(adm))) {
              // A SEAT IS IN ONE PLACE: a FIND handed back to me by the very
              // seat I would hand it to, which I also hear first-hand at
              // another cell, is my echo of a claim it no longer holds — it
              // sent the FIND back because its own view names no such
              // admitter. A view kept across a freeze can still name a
              // mate at the head cell it has since left, first-hand live for
              // its whole window; handing on, the two seats bounced the
              // FIND and the seeker, holding my FINDACK, waited its full
              // window at the door. The echo goes and the scan runs again.
              const to = this.occGet(ck(adm));
              if (to === mm.from && mm.from !== mm.nc && this.liveElsewhere(to, ck(adm))) {
                const ek = ck(adm);
                this.occ.delete(ek); this.live.delete(ek); this.liveBy.delete(ek); this.s1seen.delete(ek); this.kidful.delete(ek); this.tlForget(ek, 'echo-bounce');
                this.serveFind(mm); return;
              }
              this.emit(this.occGet(ck(adm)), { t: 'FIND', nc: mm.nc, ttl: mm.ttl - 1, spread: !!mm.spread }); this.findAck(mm, ck(adm)); return;
            }
          }
        }
        // Only go deep when no admissible S1 free cell remains (phantoms free).
        let s1admFree = 0;
        for (let t = 0; t < C(); t++) {
          const liveR = rowLive[t];
          for (let j = 0; j < C(); j++) {
            if (j === 0 && liveR) continue;
            if (!this.cellReserved(ck({ pc: 0, r: t, i: j }))) s1admFree++;
          }
        }
        // Must stay unconditional: falling through to the deep path when home's
        // free cells look unservable fast-tracks silent death past the H1-S1
        // ring-hold (headless-row leg C), and buys nothing — the partitioned
        // half recovers on the reachable-forward fix below alone.
        if (s1admFree > 0) { this.noroomWhy = 's1:' + skip.join(' '); this.emit(mm.nc, { t: 'NOROOM', nd: this.hasCoord ? topo.pcDepth(this.coord.pc) : 0 }); return; }
      }
      const f = this.firstFreeInRoster();
      if (f) {
        // Phantom occ on the admitted cell: clear it first-hand before the
        // admit, exactly as the S1 designated arm does.
        const fk = ck(f);
        if (this.occIsPhantom(fk)) { this.occ.delete(fk); this.live.delete(fk); this.s1seen.delete(fk); this.kidful.delete(fk); this.tlForget(fk, 'phantom-deep'); }
        this.admit(f, mm); return;
      }
      // Descend — but NEVER into the void. This forward used raw occ, so it
      // emitted the FIND at an occupant on the far side of a partition (or a
      // corpse), where it is silently swallowed and the seeker burns its whole
      // timeout before retrying. To my own evidence a partitioned peer and a
      // SILENT-BUT-REAL head look identical, so two passes, in this order:
      //   0 — a hop I have heard from FIRST-HAND (demonstrably deliverable:
      //       what the starved half of a split needs)
      //   1 — any reachable-by-occ hop (what a silent head needs; gating those
      //       on liveness fast-tracks silent death past H1-S1 ring-hold)
      // V4 THE DEPTH WALL (twin of the sim's uint32 guard): never forward a
      // FIND toward the 13th floor — NOROOM is honest, and the twins must
      // refuse at the same depth or they diverge exactly where a dup storm goes.
      if (topo.pcDepth(this.coord.pc) >= 12) { this.noroomWhy = 'depth'; this.emit(mm.nc, { t: 'NOROOM', nd: this.hasCoord ? topo.pcDepth(this.coord.pc) : 0 }); return; }
      const rc = this.rosterCells(); const idx = this.shuf(Array.from({ length: C() }, (_, k) => k));
      for (let pass = 0; pass < 2; pass++)
        for (const q of idx) {
          const rk = ck(rc[q]); const x = this.occGet(rk); if (x == null || x === this.id) continue;
          // T7 (sim mesh_seat.inc serveFind): on a FIND whose seeker has ALREADY
          // been told NOROOM to its face, a reachable-but-unheard sibling may
          // compete in pass 0. First contact is untouched; a partitioned seeker
          // never gets here (it fails silent, not loud); the hop is still
          // strictly DOWNWARD, so no cycle is possible.
          if (pass === 0 ? (this.firstHandLive(rk) || (mm.spread && this.admitterReachable(rk))) : this.admitterReachable(rk)) { this.emit(x, { t: 'FIND', nc: mm.nc, ttl: mm.ttl - 1, spread: !!mm.spread }); this.findAck(mm, rk, true); return; }
        }
      this.noroomWhy = 'deep'; this.emit(mm.nc, { t: 'NOROOM', nd: this.hasCoord ? topo.pcDepth(this.coord.pc) : 0 });
    }
    // Column j of this head's row is a densify slot the mover can still leave.
    // Free, and not an internal hole (its down-child heals that, C1). A column
    // with an occupant to its right is not the trailing edge: compactEligible
    // lets only the rightmost occupant leave. Sitting left of a row-mate who has
    // a down-child pins the mover, because that row-mate is not a leaf and never
    // compacts. Sitting left of any occupant in a row at depth >= 3 pins the
    // same way: the probe stops in that deep row instead of climbing to a
    // depth-1 or depth-2 row that can still densify. A trailing cell is still
    // taken at any depth. Twin of compactDensifyCol in test/sim/mesh_seat.inc.
    compactDensifyCol(j) {
      const cell = { pc: this.coord.pc, r: this.coord.r, i: j };
      if (this.occ.has(ck(cell)) || this.softSitting(ck(cell))) return false; // a chair already promised (newcomer or mover) is not a slot
      if (this.occGet(ck(topo.down(cell))) != null) return false;
      for (let k = j + 1; k < C(); k++) {
        const rk = { pc: this.coord.pc, r: this.coord.r, i: k };
        if (!this.occ.has(ck(rk))) continue;
        if (topo.pcDepth(this.coord.pc) >= 3 || this.occGet(ck(topo.down(rk))) != null) return false;
      }
      return true;
    }
    // Q2 — COMPACTION service (the UP-CHAIN walk). A compaction FIND (tag==1)
    // climbs the seeker's OWN up-chain — every hop an ALIVE link (row → head →
    // owner) — and joins the NEAREST strictly-shallower OCCUPIED row that has a
    // densify slot the mover can still leave. Reliable (no long route over a
    // fragmented mesh, no reliance on a shallow seat's stale view of a deep
    // row), monotone (the seeker's depth strictly decreases), and it empties
    // lone-row deep sections into their ancestors' rows — the media-plane
    // payoff. The seeker's coord rides in mm.coord.
    serveCompact(mm) {
      if (!this.hasCoord || this.state !== 3 || mm.ttl <= 0) return;
      const sd = topo.pcDepth(mm.coord.pc);
      // Only a ROW HEAD decides — it holds the whole row FIRST-HAND (row-mates are
      // meshed), so its frontier view is fresh (unlike an S1 seat's stale view of
      // a deep row). A non-head hands the probe to its own row head (direct link).
      if (this.coord.i !== 0) { const h = this.occGet(ck({ pc: this.coord.pc, r: this.coord.r, i: 0 })); if (h != null && h !== this.id) this.emit(h, { t: 'FIND', nc: mm.nc, tag: 1, coord: mm.coord, ttl: mm.ttl - 1 }); return; }
      // I am a row head. If my row is a DEEP row STRICTLY shallower than the
      // seeker, offer the first densify slot the mover can still leave
      // (compactDensifyCol). A row whose only free cells would pin the mover is
      // climbed past. NEVER Section 1 (pc==0): the home is filled only under
      // H1-S1 ring-conservatism — compaction seating a leaf in an S1 cell whose
      // occupant is merely unreachable (not confirmed dead) could mint a
      // divergent home. The chain climbs THROUGH S1 but never seats there.
      if (this.coord.pc !== 0 && topo.pcDepth(this.coord.pc) < sd) {
        for (let j = 1; j < C(); j++) {
          if (!this.compactDensifyCol(j)) continue;
          this.admit({ pc: this.coord.pc, r: this.coord.r, i: j }, mm); return; // densify: seat the seeker beside me, PLACE routed back (tag==1)
        }
      }
      // My row is full or not shallower — climb one level toward the home.
      // V5 CAP (PROBLVL, test/sim/mesh.cpp serveCompact): the funnel IS the
      // cost — a probe that cannot be served within PROBLVL levels of its
      // seeker dies here instead of walking to the S1 wall. The leaf just
      // retries next period.
      if (PROBLVL > 0 && topo.pcDepth(this.coord.pc) - 1 < sd - PROBLVL) return;
      const o = this.ownerCoord(); if (o) { const oid = this.occGet(ck(o)); if (oid != null && oid !== this.id) this.emit(oid, { t: 'FIND', nc: mm.nc, tag: 1, coord: mm.coord, ttl: mm.ttl - 1 }); }
    }

    // ---- healing (C3 fixed designation + diversified leaf-sourcing) ----
    // A room that is one row has nobody below anybody: a heal's FINDLEAF can never promote a seat into
    // a hole there, so only admitting a newcomer fills it. A seat past the first row counts only while I
    // hear it first-hand: one that went quiet (a reload, a closed tab) waits out its ring hold in my
    // occupancy, and counting it kept the hole shut to the newcomer at the door for that whole hold.
    oneRowRoom() { for (const k of this.occ.keys()) if (k.slice(0, 4) !== '0_0_' && this.firstHandLive(k)) return false; return true; }
    heal(hole) {
      const TICK = this.TICK;
      if (!this.hasCoord || this.state !== 3 || TICK - this.healAt < 12) return;
      this.lastChurn = TICK; // Q2 hysteresis: I'm healing — my region is churning
      const hk = ck(hole); if (TICK - (this.healTry.has(hk) ? this.healTry.get(hk) : -999) < 45) return;
      this.healAt = TICK; this.healTry.set(hk, TICK); this.healOnly.add(hk);
      const nbrs = []; const ol = topo.ownedLinks(hole);
      for (const olc of ol) { const x = this.occGet(ck(olc)); if (x != null && x !== this.id) nbrs.push({ k: ck(olc), v: x }); }
      let selfNb = false; for (const olc of ol) if (ck(olc) === ck(this.coord)) selfNb = true; if (selfNb) nbrs.push({ k: ck(this.coord), v: this.id });
      // THE HOLE'S HEIR BELOW (sim twin): a Section-1 healer arriving from
      // another row has never seen the hole's child row, but the dead owner's
      // heartbeats named its down-child head (childOf, PHONE `child`; S1SYNC
      // `ch`). Without it the healer's CLAIM never reached that head, which
      // kept its ghost owner and phoned nobody while the new owner, with an
      // empty view of its child row, admitted newcomers into the held head
      // cell and its mates' cells — each with a placement proof, resolved one
      // 221-tick E1 horizon at a time (heal-time.js 40%-kill seed 6, row 1_0).
      { const dk = ck(topo.down(hole)); const hx = this.childOf.get(hk); if (hx != null && hx !== this.id && this.occGet(dk) == null && !nbrs.some((e) => e.k === dk)) nbrs.push({ k: dk, v: hx }); }
      const oc = ownerCoordOf(hole); if (oc) { const oid = this.occGet(ck(oc)); let has = false; for (const x of nbrs) if (x.k === ck(oc)) has = true; if (oid != null && !has) nbrs.push({ k: ck(oc), v: oid }); }
      // Gather EVERY candidate leaf-source, then pick ONE at random. A single
      // fixed source (my one known down-child) can have a broken/stale deep
      // chain that silently swallows the FINDLEAF forever — the stuck-home-hole
      // bug (#5). Diversifying across my subtree children, my kidful row-mates,
      // AND (for a home hole) other Section-1 seats' subtrees means repeated
      // heals eventually reach a live leaf; a rare double-promotion is culled by
      // E2's first-hand HELLO yield.
      const src = [];
      // FINDLEAF sources must be first-hand live — phantoms swallow FINDLEAF.
      for (const rc of this.rosterCells()) { const x = this.occGet(ck(rc)); if (x != null && x !== this.id && this.firstHandLive(ck(rc))) src.push(x); }
      if (hole.pc === this.coord.pc && hole.r === this.coord.r) { for (const m of topo.rowMates(this.coord)) { if (ck(m) === ck(hole)) continue; if (!(this.kidful.has(ck(m)) && this.kidful.get(ck(m)))) continue; const x = this.occGet(ck(m)); if (x != null && x !== this.id && this.firstHandLive(ck(m))) src.push(x); } }
      if (hole.pc === 0 && this.coord.pc === 0) { for (const e of this.s1Roster()) if (e.v !== this.id && e.k !== ck(hole) && this.firstHandLive(e.k)) src.push(e.v); }
      // Immediate LEFT-PACK designee: subtree first; after repeated FINDLEAF
      // misses (healTry aged ≥90), scooch even with children so S1 cannot
      // stay short forever after mass kill.
      if (hole.pc === this.coord.pc && hole.r === this.coord.r && hole.i === this.coord.i - 1
          && this.occGet(ck(topo.down(hole))) == null) {
        const mysrc = [];
        for (const rc of this.rosterCells()) { const x = this.occGet(ck(rc)); if (x != null && x !== this.id && this.firstHandLive(ck(rc))) mysrc.push(x); }
        const hk = ck(hole);
        const tried = this.healTry.has(hk) ? this.healTry.get(hk) : -999;
        if (mysrc.length && this.TICK - tried < 90) {
          const who = mysrc[(this.rng() * mysrc.length) | 0];
          this.emit(who, { t: 'FINDLEAF', hole, nbrs, ttl: 40 }); return;
        }
        if (!this.hasChildren() || this.TICK - tried >= 90) { this.promoteInto(hole, nbrs); return; }
        if (mysrc.length) {
          const who = mysrc[(this.rng() * mysrc.length) | 0];
          this.emit(who, { t: 'FINDLEAF', hole, nbrs, ttl: 40 }); return;
        }
      }
      // H-CHAIN S1 column-pack scooch UP only (hole.r < coord.r) BEFORE FINDLEAF.
      // Downward holes fall through to FINDLEAF — never raid denser upper rows.
      if (!this.hasChildren() && this.coord.pc === 0 && hole.pc === 0 && hole.i === this.coord.i && hole.r < this.coord.r) {
        let rowRightEmpty = true;
        for (let j = hole.i + 1; j < C(); j++) if (this.firstHandLive(ck({ pc: 0, r: hole.r, i: j }))) { rowRightEmpty = false; break; }
        if (rowRightEmpty) { this.promoteInto(hole, nbrs); return; }
      }
      if (src.length) { const who = src[(this.rng() * src.length) | 0]; this.emit(who, { t: 'FINDLEAF', hole, nbrs, ttl: 40 }); return; }
      if (!this.hasChildren() && hole.pc === this.coord.pc && hole.r === this.coord.r && hole.i === this.coord.i - 1) this.promoteInto(hole, nbrs);
    }
    findLeaf(hole, nbrs, ttl) {
      if (!this.hasCoord) return;
      if (ttl > 0) {
        const rc = this.rosterCells(); const idx = this.shuf(Array.from({ length: C() }, (_, k) => k));
        for (const q of idx) {
          const x = this.occGet(ck(rc[q]));
          if (x != null && x !== this.id && this.firstHandLive(ck(rc[q]))) {
            this.emit(x, { t: 'FINDLEAF', hole, nbrs, ttl: ttl - 1 }); return;
          }
        }
      }
      // Same-row non-head hole: only LEFT-PACK (hole to my left), not a no-op return.
      if (this.coord.pc === hole.pc && this.coord.r === hole.r && hole.i !== 0) {
        if (!(hole.i < this.coord.i) || this.hasChildren()) return;
        this.promoteInto(hole, nbrs); return;
      }
      this.promoteInto(hole, nbrs);
    }
    promoteInto(hole, nbrs) {
      if (!this.hasCoord || ck(this.coord) === ck(hole)) return;
      if (this.moving) return;                       // T1: one move at a time
      if (this.coord.pc === 0 && hole.pc !== 0) return;
      // 11a left-pack: scooch LEFT within the row. H-CHAIN S1 column: scooch
      // UP into denser (lower row index) same-column hole only — never DOWN
      // (raids H7-dense upper rows; N=9 serial left /0.4 empty forever).
      if (this.coord.pc === 0 && hole.pc === 0) {
        const leftPack = hole.r === this.coord.r && hole.i < this.coord.i;
        const colPack = hole.i === this.coord.i && hole.r < this.coord.r;
        if (!leftPack && !colPack) return;
        // E2, PREEMPTIVE — column-pack only. A VERTICAL healer is the one mover
        // routinely still linked to the seat it would displace: its owner is its
        // direct up-link. A severed head confirms its row-mate dead via the D5
        // probe (correct from its blind vantage) and hands the hole to exactly
        // that child, which then evicts a live occupant it can hear — the tie-
        // break takes the incumbent, not the mover. A cell heard FIRST-HAND is
        // alive by definition, so declining here cannot mask a real hole.
        // BOTH directions, on "held RIGHT NOW" (heldRightNow: a live stamp
        // within HELD_BEATS = 3 rook beats), not firstHandLive's 60-tick decay
        // a crashed occupant also satisfies — the sim's form since 646f69c4
        // (test/sim/mesh_seat.inc promoteInto); this port had kept the older
        // column-only firstHandLive guard. The row path is the same bug: a head
        // severed from its row-mate D5-confirms it and hands the hole (s1Fill
        // -> FINDLEAF) to the row-mate's neighbour, which heard the occupant
        // two ticks earlier and left-packed onto it (chaos seed 12 #5: a 10 s
        // Theo-Dev sever, Pia moved onto Dev, 26.8 s to rejoin).
        if (this.heldRightNow(ck(hole))) return;
      }
      this.doMove(hole, null, nbrs);
    }
    // T1 CLAIM-BEFORE-VACATE (dual-hold transit): take the NEW seat FIRST — the
    // claim is ordinary seating (CLAIM/HELLO, S4-signed) — while the OLD seat is
    // still held: no LEAVE has been sent, so to every neighbour the old cell is
    // simply occupied (no admitter or healer touches it; tenure/E2 protect it;
    // its PHONEs are still answered). Vacate ONLY when the claim CONFIRMS: a
    // new-neighbourhood frame arrives, or the window closes with NO
    // contradiction (a wiped region has nobody to answer). A CONTRADICTION at
    // the new cell (E2 yield, impostor CONFIRM) ROLLS BACK to the still-held
    // old seat — a mover is never homeless.
    doMove(hole, owner, nbrs, pp) {
      if (!this.hasCoord || ck(this.coord) === ck(hole) || this.moving) return;
      if (this.env.bumpMoves) this.env.bumpMoves();
      this.lastChurn = this.TICK; // Q2 hysteresis: a move is churn
      this.oldCoord = this.coord; this.oldCk = ck(this.coord); this.oldTn = this.tn; this.oldEstAt = this.estAt; this.oldPp = this.pp; this.oldAdmBy = this.admBy;
      this.oldNbrIds = []; { const seen = new Set();
        for (const olc of topo.ownedLinks(this.oldCoord)) { const x = this.occGet(ck(olc)); if (x != null && x !== this.id && !seen.has(x)) { seen.add(x); this.oldNbrIds.push(x); } } }
      this.holdOcc = new Map(this.occ); this.holdSeen = new Map(this.s1seen); this.holdCous = new Map(this.cousins); // rollback snapshots
      this.occ.clear(); this.s1seen.clear(); this.cousins.clear(); this.tlClear(); // moving levels: old cousins / transport-loss obs are stale; rebuild fresh
      this.moving = true; this.moveAt = this.TICK;
      this.take(hole, owner, nbrs, pp);
      this.lastAck = this.TICK; this.lastPhone = this.TICK - 100;
      let anyNbr = false;
      for (const olc of topo.ownedLinks(this.coord)) { const x = this.occGet(ck(olc)); if (x != null && x !== this.id) { anyNbr = true; break; } }
      if (!anyNbr) this.confirmMove(); // nobody to hear from and nobody to collide with: confirm now (the 2-person scooch stays same-tick)
    }
    // A frame that evidences my NEW neighbourhood (someone accepted me there).
    moveEvidence(m) {
      // PHONE and PONG ride unsigned: they count only when the transport
      // names their author (a forged one must not vacate my old seat early).
      if (m.t === 'PONG') return m.yp !== 1 && this.linkIs(m, m.id != null ? m.id : m.lk);   // my new phone answered (an arbiter's hearing PONG is no acceptance)
      if (m.t === 'PHONE') return this.linkIs(m, m.id) && m.tock === ck(this.coord);    // a call TO my new cell
      if (m.t === 'HELLO' || (m.t === 'CLAIM' && this.verifyFill(m))) {
        for (const olc of topo.ownedLinks(this.coord)) if (ck(olc) === m.ck) return true;
      }
      return false;
    }
    // T3: the confirmed vacate — instant goodbye (D2) whose LEAVE carries WHERE
    // I went (mvd), sent to the snapshotted old links; then a bounded
    // FORWARDING TOMBSTONE: for LEASE_TTL I answer in-flight traffic addressed
    // to the old cell. A redirect, never occupancy.
    confirmMove() {
      if (!this.moving) return; this.moving = false;
      for (const x of this.oldNbrIds) this.emit(x, { t: 'LEAVE', ck: this.oldCk, id: this.id, mvd: ck(this.coord) });
      this.oldNbrIds = []; this.holdOcc = null; this.holdSeen = null; this.holdCous = null; this.oldPp = null;
      this.leaseCk = this.oldCk; this.leaseUntil = this.TICK + LEASE_TTL;
    }
    // T1 rollback: my claim at the new cell was contradicted (someone else is
    // the rightful occupant). Un-announce the new cell and go home to the old
    // seat, which was never vacated — nobody ever saw it empty.
    rollbackMove() {
      if (!this.moving) return; this.moving = false;
      const newCk = ck(this.coord); const seen = new Set();
      for (const olc of topo.ownedLinks(this.coord)) { const x = this.occGet(ck(olc)); if (x != null && x !== this.id && !seen.has(x)) { seen.add(x); this.emit(x, { t: 'LEAVE', ck: newCk, id: this.id }); } }
      this.coord = this.oldCoord; this.tn = this.oldTn; this.estAt = this.oldEstAt; this.nbrAt = this.TICK; this.pp = this.oldPp; this.oldPp = null; this.admBy = this.oldAdmBy; this.oldAdmBy = null;
      this.occ = this.holdOcc || new Map(); this.s1seen = this.holdSeen || new Map(); this.cousins = this.holdCous || new Map();
      this.occ.set(this.oldCk, this.id);
      this.oldNbrIds = []; this.holdOcc = null; this.holdSeen = null; this.holdCous = null;
      this.healOnly.delete(newCk); this.healTry.set(newCk, this.TICK); this.healAt = this.TICK; // pace any re-attempt at that hole
      this.lastAck = this.TICK; this.lastPhone = this.TICK - 100;  // fresh grace; re-announce
      this.announce(); this.wake();
    }
    attack() { if (!this.hasCoord) return; for (const olc of topo.ownedLinks(this.coord)) { const x = this.occGet(ck(olc)); if (x != null && x !== this.id) this.emit(x, { t: 'HELLO', ck: ck(olc), id: this.id }); } }
    // A REQUEUE DROPS THE STAMP OF THE CELL IT LEAVES AND THE HOLE CLOCKS. Its
    // own cell's stamp is never refreshed while it sits (a seat does not hear
    // itself), and a seat that lost the head cell and was placed beside it
    // read that stamp — or a hole clock its join had set and nothing cleared —
    // as "silent past RING_HOLD" and left-packed straight back into the
    // winner's cell (chaos seed 10 #5, 2-person sever: 18 s). Twins:
    // test/sim/mesh_seat.inc requeue, reseatViaRoster. Wider forms measured
    // worse: dropping a cell's stamp on EVERY occupant change (setOcc)
    // over-counted a dead seat's vote after a churn (repro-digest G9);
    // clearing every stamp on a requeue slowed a two-ring merge past its
    // bound (two-ring.js seed 2: 2008 ticks, bound 2000).
    requeue() { if (!this.evil && this.env.bumpEvict) this.env.bumpEvict(); if (this.env.bumpMoves) this.env.bumpMoves(); this.moving = false; this.oldNbrIds = []; this.holdOcc = null; this.holdSeen = null; this.holdCous = null; this.leaseCk = null; this.leaseUntil = -1; if (this.hasCoord) { const seen = new Set(); for (const olc of topo.ownedLinks(this.coord)) { const x = this.occGet(ck(olc)); if (x != null && x !== this.id && !seen.has(x)) { seen.add(x); this.emit(x, { t: 'LEAVE', ck: ck(this.coord), id: this.id }); } } this.leaveOwner(seen); this.live.delete(ck(this.coord)); } this.hasCoord = false; this.occ.clear(); this.s1seen.clear(); this.holeSince.clear(); this.tlClear(); this.authClear(); this.drainAt = 0; this.join(); }

    drainOrReenter() {
      const TICK = this.TICK;
      // E1 LAST RESORT, checked FIRST (bug #7): owner-chain dead >220 with no
      // mesh route → drop the dead roster and re-enter the front door. Below
      // the drain branch it was unreachable for a seat holding a STALE roster.
      if (TICK - this.lastAck > 220) { this.haveRoster = false; this.roster = []; this.drainAt = 0; this.requeue(); return; }
      if (this.haveRoster && this.roster.length) { if (!this.drainAt) { const rc = this.rosterCells(); for (let c = 0; c < C(); c++) { const x = this.occGet(ck(rc[c])); if (x != null && x !== this.id) this.emit(x, { t: 'DRAIN', roster: this.roster, id: this.id }); } this.drainAt = TICK + 25 + (this.rng() * 10 | 0); } return; } // `id`: a DRAIN is signed and honoured only from the receiver's anchor
      if (TICK - this.rosterAskAt > 40) {
        this.rosterAskAt = TICK; const x = topo.crossLink(this.coord); let xid = x ? this.occGet(ck(x)) : null;
        if (xid != null && xid !== this.id) { this.emit(xid, { t: 'WHOHOME', from: this.id, via: this.id, ttl: 60 }); }
        else { const rm = topo.rowMates(this.coord); const ri = this.shuf(Array.from({ length: C() - 1 }, (_, k) => k)); for (const q of ri) { const rr = this.occGet(ck(rm[q])); if (rr != null && rr !== this.id) { this.emit(rr, { t: 'WHOHOME', from: this.id, via: this.id, ttl: 60 }); break; } } }
      }
    }
    // NOTE (law T5 — REJECTED, kept vacate-first ON PURPOSE): a keep-old drain
    // re-seat (stay seated while FINDing, vacate on PLACE) was built and
    // REVERTED. It breaks E1's dissolution guarantee: the drain's vacate is
    // what DISSOLVES a doomed fragment; kept alive, the fragment's mutually-
    // live stale seats keep phoning, answering, serving and HEALING each
    // other, promote one another into the home cells of their stale world,
    // and mint a divergent phantom home (a sealed bubble no E2 witness can
    // reach). The atomic transit (T1-T4) covers moves WITHIN a live
    // neighbourhood; a drain is the opposite case — its whole neighbourhood
    // is confirmed dead, and E1 deliberately dissolves it.
    reseatViaRoster() { if (this.env.bumpMoves) this.env.bumpMoves(); if (this.hasCoord) { const seen = new Set(); for (const olc of topo.ownedLinks(this.coord)) { const x = this.occGet(ck(olc)); if (x != null && x !== this.id && !seen.has(x)) { seen.add(x); this.emit(x, { t: 'LEAVE', ck: ck(this.coord), id: this.id }); } } this.leaveOwner(seen); this.live.delete(ck(this.coord)); } this.hasCoord = false;
 this.occ.clear(); this.s1seen.clear(); this.holeSince.clear(); this.tlClear(); this.authClear(); this.drainAt = 0; this.seatTries = 0; const t = (this.haveRoster && this.roster.length) ? this.pickRoster() : null; if (t != null) this.askSeat(t); else this.join(); }

    // ---- routing (rook-aware next hops + Option A strict mesh routing) ----
    nextHopCoord(t) {
      const c = this.coord;
      if (c.pc === t.pc && c.r === t.r && c.i === t.i) return null;
      if (c.pc === t.pc) {                                 // SAME section — stay inside it, over owned links only
        if (c.pc === 0) {                                  // W7: Section 1 = 5x5 ROOK'S GRAPH — row+column are all owned links
          if (c.r === t.r) return { pc: 0, r: c.r, i: t.i }; // same row: one hop to the target column
          return { pc: 0, r: t.r, i: c.i };                // else: column-mate straight into the target row (then a row-mate to t.i)
        }
        if (c.r === t.r) return { pc: c.pc, r: c.r, i: t.i }; // same row: row-mate straight to the target column
        // Different row: reach row t.r via ONE transpose cross-link. The column
        // whose cross-link lands in row t.r is t.r itself, except when t.r==0
        // use my diagonal (col r).
        const tcol = (t.r === 0) ? c.r : t.r;              // never 0 (t.r!=c.r), so my cross-link exists there
        if (c.i !== tcol) return { pc: c.pc, r: c.r, i: tcol }; // hop 1: row-mate to that column
        return topo.crossLink(c);                          // hop 2: transpose across to row t.r (then row-mate to t.i)
      }
      // DIFFERENT section: climb to the common ancestor, or descend toward t.
      const digs = (pc) => { const v = []; if (!Number.isInteger(pc) || pc < 0) return v; while (pc > 0) { v.push(topo.lastDigit(pc)); pc = topo.parentPath(pc); } v.reverse(); return v; };
      const pa = digs(c.pc), pb = digs(t.pc);
      let l = 0; while (l < pa.length && l < pb.length && pa[l] === pb[l]) l++;
      if (l < pa.length) { if (c.i !== 0) return { pc: c.pc, r: c.r, i: 0 }; return topo.up(c); } // climb: to col 0, then up
      const d = pb[pa.length]; if (c.i !== d) return { pc: c.pc, r: c.r, i: d }; return topo.down(c); // descend toward child digit d
    }
    nextHopToward(target, exclude) {
      if (!this.hasCoord) return null; const ideal = this.nextHopCoord(target);
      if (ideal) { const x = this.occGet(ck(ideal)); if (x != null && x !== this.id && x !== exclude) return x; }
      if (this.coord.pc === 0) { // W7: rook — many redundant paths; any live column- or row-mate carries it onward
        for (const cm of topo.colMates(this.coord)) { const x = this.occGet(ck(cm)); if (x != null && x !== this.id && x !== exclude) return x; }
        for (const rm of topo.rowMates(this.coord)) { const x = this.occGet(ck(rm)); if (x != null && x !== this.id && x !== exclude) return x; }
        return null;
      }
      const xc = topo.crossLink(this.coord); if (xc) { const x = this.occGet(ck(xc)); if (x != null && x !== this.id && x !== exclude) return x; }
      const rm = topo.rowMates(this.coord); for (const m of rm) { const cx = topo.crossLink(m); if (!cx) continue; const x = this.occGet(ck(cx)); if (x != null && x !== this.id && x !== exclude) return x; }
      return null;
    }
    routeTo(target, tag) { const nh = this.nextHopToward(target, null); if (ck(this.coord) === ck(target)) return; if (nh != null) { const pn = this.probeNote(ck(target)); this.emit(nh, { t: 'ROUTE', target, asker: this.id, tag, ttl: 60, via: this.id, pn }); } }
    // The probes I have in flight (target cell -> {tick, nonce}): an answer
    // (ROUTED, or a tag-3 ROUTE around a dead link) counts only when it echoes
    // the nonce of a probe I sent for that cell — the target writes it back,
    // so only a seat the probe actually reached can answer. Unsigned answers
    // that merely named a probed cell kept a crashed seat alive at its
    // watchers (sec finding X4 class: ROUTED tag 1/2 and ROUTE tag 3).
    // Bounded: one entry per probed cell, and a probe older than its longest
    // round trip (ttl 60 hops each way) is gone. A re-probe keeps the nonce
    // while the probe is in flight, so a slow answer to the first one counts.
    probeNote(k) { const P = this.probeOut = this.probeOut || new Map(); const cur = P.get(k); if (cur && this.TICK - cur.at <= 240) { cur.last = this.TICK; return cur.pn; } if (P.size >= 64) { for (const [k2, t2] of P) if (this.TICK - t2.last > 240) P.delete(k2); if (P.size >= 64) P.delete(P.keys().next().value); } const pn = this.nonce(); P.set(k, { at: this.TICK, last: this.TICK, pn }); return pn; }
    probeAsked(k, pn) { const t = this.probeOut ? this.probeOut.get(k) : undefined; return t !== undefined && this.TICK - t.last <= 240 && pn != null && String(pn) === t.pn; }
    // routeToProbe: the D5 translost probe. THE PROBE TRAVELS THE MESH, NOT THE
    // DEAD LINK: the first hop excludes the probed occupant itself (my direct
    // link to it is exactly what died), and the frame carries my coord (acoord)
    // so the answer can route back AROUND the dead link too (tag 3). A live
    // severed peer therefore still answers; only a truly unreachable one stays
    // silent. No alternate hop at all ⇒ no probe ⇒ the confirm window runs — in
    // a room that sparse the dead link WAS the only path.
    routeToProbe(target) {
      const tk = ck(target); if (!this.hasCoord || ck(this.coord) === tk) return;
      const nh = this._probeHop(target, this.occGet(tk));
      if (nh != null) { const pn = this.probeNote(tk); this.emit(nh, { t: 'ROUTE', target, asker: this.id, tag: 2, ttl: 60, via: this.id, acoord: this.coord, pn }); }
    }
    // _probeHop: first hop for a probe (or its answer) that must NOT use the
    // direct link to `target`. Prefer a hop that is itself a DIRECT neighbour
    // of the target — for a same-row target another ROW-mate, for a same-column
    // target another COLUMN-mate (the rook's parallel independent paths); the
    // generic nextHopToward fallback can otherwise pick a path that funnels
    // straight back into the dead link.
    _probeHop(target, excludeId) {
      if (this.hasCoord && target.pc === this.coord.pc) {
        const cand = [];
        if (target.r === this.coord.r) { for (const m2 of topo.rowMates(this.coord)) if (ck(m2) !== ck(target)) cand.push(m2); }
        else if (this.coord.pc === 0 && target.i === this.coord.i) { for (const m2 of topo.colMates(this.coord)) if (ck(m2) !== ck(target)) cand.push(m2); }
        for (const m2 of cand) { const x = this.occGet(ck(m2)); if (x != null && x !== this.id && x !== excludeId) return x; }
      }
      return this.nextHopToward(target, excludeId);
    }

    // strictNextHop: the ideal step toward rdst, but ONLY if it is one of MY
    // owned links and occupied. A vacant ideal returns null and the frame is
    // dropped so healing fills the gap and the sender retries — routed delivery
    // travels strictly over real links (no teleport).
    strictNextHop(rdst) {
      if (!this.hasCoord) return null;
      const ideal = this.nextHopCoord(rdst); if (!ideal) return null;
      const ik = ck(ideal);
      for (const olc of topo.ownedLinks(this.coord)) if (ck(olc) === ik) { const x = this.occGet(ik); return (x != null && x !== this.id) ? x : null; }
      return null;
    }
    // route(): deliver `inner` to coord rdst over LINKS only. rfinal!=null ⇒
    // hand to that (unseated) newcomer at the destination cell (its gateway).
    route(rdst, rfinal, inner) {
      inner.routing = true; inner.rdst = rdst; inner.rfinal = (rfinal == null ? null : rfinal); inner.rttl = 64; inner.rvia = this.id;
      if (this.hasCoord && ck(this.coord) === ck(rdst)) {   // I'm the destination cell
        inner.routing = false;
        if (inner.rfinal == null || inner.rfinal === this.id) { this.emit(this.id, inner); return; }
        const pk = this.env.peek ? this.env.peek(inner.rfinal) : null;
        if (pk && pk.hasCoord && ck(pk.coord) !== ck(this.coord)) { this.emit(inner.rfinal, inner); return; } // rfinal SEATED since — route to its coord
        inner.direct = true; this.emit(inner.rfinal, inner); return; // still an unseated newcomer — direct hand-off
      }
      const nh = this.hasCoord ? this.strictNextHop(rdst) : this.gateway; // unseated ⇒ leave via the gateway link
      if (nh != null) this.emit(nh, inner);
    }
    // routeStep(): a routing frame arrived at me mid-flight. Return true iff it
    // is FOR me (routing cleared, fall through to normal dispatch).
    routeStep(m) {
      const leaseHit = this.hasCoord && ((this.leaseUntil >= 0 && this.TICK <= this.leaseUntil && ck(m.rdst) === this.leaseCk) // T3: in-flight frames for my just-vacated cell land HERE
                                      || (this.moving && ck(m.rdst) === this.oldCk));                                          // T1 dual-hold: ...and frames for the still-held old cell
      if (this.hasCoord && (ck(this.coord) === ck(m.rdst) || leaseHit)) {
        if (m.rfinal == null || m.rfinal === this.id) { m.routing = false; return true; }
        const h = Object.assign({}, m); h.routing = false;
        const pk = this.env.peek ? this.env.peek(m.rfinal) : null;
        if (pk && pk.hasCoord && ck(pk.coord) !== ck(this.coord)) { this.emit(m.rfinal, h); return false; }
        h.direct = true; this.emit(m.rfinal, h); return false; // still unseated — direct hand-off over the link
      }
      if (m.rttl <= 0) return false;                        // give up — sender retries
      const nh = this.strictNextHop(m.rdst);
      if (nh == null) return false;                         // no link toward rdst — drop
      const f = Object.assign({}, m); f.rttl = m.rttl - 1; f.rvia = this.id; this.emit(nh, f); return false;
    }

    // ---- phone-home / detection (D1) + wiring (W2/W3/W6) ----
    // ========================================================================
    // V1 ROLLUP DIGEST — healing-laws.md § G (sim: mesh_seat.inc, same names).
    // The room folded along the tree instead of flooded: <= C reports in and
    // ONE out per node per pulse period, riding PHONE (up), PONG (down) and
    // S1SYNC (the Section-1 root fold). N never appears in any node's work.
    // ========================================================================
    digOn() { return this.env.DIGEST === true && this.state === 3; }
    pubDig(d) {
      const o = this.wireDig(d, true);
      // The adversary knob (tests only). Mode 1 SUPPRESSES — refusals and the
      // partial flag stripped: the ONE dangerous direction (G4.2) and the only
      // one the checker needs to catch; mode 2 inflates n, harmless by G2.
      // G9: mode 3 SUPPRESSES the lists; mode 4 INFLATES every vote and adds a
      // fabricated target (the population clamp's subject — G4 cannot see it).
      if (this.lie === 1) { o.refuse = 0; o.part = 0; }
      else if (this.lie === 2) { o.n += 1000; }
      else if (this.lie === 3) { o.hands = []; o.stage = []; o.apps = []; o.votes = []; o.handN = 0; o.awayN = 0; }
      else if (this.lie === 4) { for (const v of o.votes) { v.up += 1000; v.dn += 1000; } o.votes.push({ tgt: 'zz-fabricated', up: 1000, dn: 1000 }); }
      return digPack(o);
    }
    // § G9: the application sets THIS seat's own room-global facts; the next
    // fold reads them. Nothing here is sent anywhere by itself (G0).
    setLeaf(f) {
      const L = this.leaf, str = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '');
      const tags = (a) => (Array.isArray(a) ? Array.from(new Set(a.filter((t) => typeof t === 'string' && t && t.length <= 16))).slice(0, 8) : []);
      if (!f || typeof f !== 'object') return;
      if ('hand' in f) L.hand = Number.isFinite(f.hand) && f.hand > 0 ? f.hand : 0;
      if ('stage' in f) L.stage = Number.isFinite(f.stage) && f.stage > 0 ? f.stage : 0;
      if ('sf' in f) L.sf = Number.isInteger(f.sf) ? f.sf & 7 : 0;
      if ('app' in f) L.app = Number.isFinite(f.app) && f.app > 0 ? f.app : 0;
      if ('ad' in f) L.ad = f.ad && saneAd(f.ad) ? copyAd(f.ad) : null;
      if ('nm' in f) L.nm = str(f.nm, 24);
      if ('dv' in f) L.dv = str(f.dv, 16);
      if ('away' in f) L.away = !!f.away;
      if ('vup' in f) L.vup = tags(f.vup);
      if ('vdn' in f) L.vdn = tags(f.vdn);
    }
    // G4: remember every report I published upward, keyed by its own stamp —
    // the ground truth the aggregator's echo is checked against.
    noteUp(d) { this.upLog[this.upLogI & 15] = { at: d.at, n: d.n, refuse: d.refuse, lh: digListKey(d) }; this.upLogI++; if (this.upSince < 0) this.upSince = this.TICK; }
    // G4, THE AUTHOR'S REFUTATION — the only check any node performs, over a
    // value that node itself authored. No votes (G4.4), no adjudication (G5).
    // (1) ECHO FIDELITY: what it says it took from me IS what I sent.
    // (2) FOLD MONOTONICITY: the fold it published contains what it echoed.
    // (3) ECHO FRESHNESS / OMISSION: consecutive empty echoes past a full
    //     staleness window of folds, or an ancient acknowledged stamp.
    // `base` is what the aggregator legitimately adds atop my report — 1 for
    // an owner folding itself with my row digest, 0 for a head folding my
    // subtree into its row. (Why an echo and not a history window: the fact
    // that decides suppression is WHICH of my reports it used — see the sim's
    // comment block; a bound on my own history false-fires on a settling
    // aggregator and is blind to a shrinking scope.)
    upRefuted(pub, echo, base) {
      this.digArm = 0;
      if (this.upLogI === 0) return false;
      if (echo.at < 0) { this.emptyEcho++; this.digArm = 3; return this.emptyEcho > 2 * DIG_TTL / 8; }
      this.emptyEcho = 0;
      if (echo.by !== this.id) return false; // the echo names a DIFFERENT author — my cell's previous occupant's report, not mine. Not evidence. (Checked BEFORE its age: that report's stamp is on ITS author's clock, not mine.)
      if (this.LT() - echo.at > 2 * DIG_TTL) { this.digArm = 3; return true; } // echo.at is MY stamp on the report it names — read on my own clock
      let r = null; for (let q = 0; q < 16; q++) { if (this.upLog[q].at === echo.at) { r = this.upLog[q]; break; } }
      if (!r) return false;                  // older than my ring — no record, so no accusation
      if (echo.n !== r.n || echo.refuse !== r.refuse || digListKey(echo) !== r.lh) { this.digArm = 1; return true; }  // (1) — the lists too (G9)
      if (pub.n < base + echo.n || pub.refuse < echo.refuse) { this.digArm = 2; return true; }      // (2)
      // (2, G9) every list entry I authored is in the published fold, or the fold is FULL of entries that outrank it;
      // every vote I contributed is in the published total, or the fold is full of targets with at least my count.
      if ((pub.handN || 0) < (echo.handN || 0) || (pub.awayN || 0) < (echo.awayN || 0)
          || !listHolds(pub.hands, echo.hands, K_HAND, true) || !listHolds(pub.stage, echo.stage, K_STAGE(), true)
          || !listHolds(pub.apps, echo.apps, K_APP, false) || !votesHold(pub.votes, echo.votes)) { this.digArm = 4; return true; }
      return false;
    }
    // G3's fail-closed predicate, FALSIFIABLE and BOUNDED BY THE HEALING
    // HORIZON: is this scope member a PERSON I have lost (⇒ blur), or a stale
    // occ echo / unowned ghost (⇒ never — a permanent unclearable blur is the
    // split-view bug the flood was invented to fix, wearing new clothes). The
    // fold reads the SAME phantom-aware evidence the admission layer reads
    // (occIsPhantom, a pure read), and a member blurs only while its loss is
    // ACTIONABLE — heard first-hand within DIG_LOSS_H. Honest residual: a
    // member alive, refusing, and severed from its aggregator longer than that
    // drops out of both n and refuse — that is E3's "we lost that subtree",
    // not a digest fact.
    // ...and only a member whose report I have HEARD (sim scopeGap). A cell
    // whose occupant has not yet published to me is ARRIVING, not lost: a
    // compaction mover CLAIMs its new cell and reports on its first beat there,
    // while its old cell still counts it. Blurring on that window marked a
    // settled room partial for ~150 ticks per move. A vacate or my own seat
    // change clears what I heard, so "heard" never outlives the relationship.
    scopeGap(k) {
      if (!this.occ.has(k) || this.occIsPhantom(k)) return false;
      const heard = this.rowKids.has(k) || this.s1tab.has(k) || (this.hasCoord && k === ck(topo.down(this.coord)) && this.downDig.at >= 0);
      if (!heard) return false;
      const it = this.live.get(k); return it !== undefined && this.TICK - it <= DIG_LOSS_H;
    }
    // § G intake for the Section-1 table (sim s1Take). One author's reports
    // are ordered by its OWN stamp (one clock, G0b-safe): a relayed copy of a
    // report I already hold never refreshes it. Ordered by my receipt alone, a
    // report circulated the rook — every hop re-stamps it at intake and no
    // hop's transit is in its age — so a dead or moved seat's section lived
    // ~5x DIG_TTL (sim repro-digest leg 6, N=20). A different author at the
    // cell (it changed hands) is still ordered by my receipt.
    s1Take(k, u) {
      const it = this.s1tab.get(k);
      if (it === undefined) { this.s1tab.set(k, u); return; }
      if (it.by != null && it.by === u.by) { if (u.at > it.at) this.s1tab.set(k, u); return; }
      if (it.rx <= u.rx) this.s1tab.set(k, u);
    }
    // A confirmed vacate (LEAVE / MOVED from the occupant itself) ends that
    // cell's digest at once (sim digForget): keeping it to DIG_TTL counted a
    // mover at both cells for a minute of fold.
    digForget(k) {
      this.rowKids.delete(k); this.s1tab.delete(k);
      if (this.hasCoord && k === ck(topo.down(this.coord))) this.downDig = dig0();
    }
    // The fold: once per pulse period, O(C) work. (1) my SUBTREE = me + the
    // child row I own; (2) a deep ROW HEAD folds its row (its owner is linked
    // only to it); (3) SECTION 1 folds the ROOT from the C^2 section digests —
    // each S1 seat computes it independently (no root to fight over, § P).
    rollup() {
      if (!this.digOn() || !this.hasCoord) return;
      const TICK = this.TICK;
      // occIsPhantom's 03c knock-is-evidence rule is scoped to the FIND scan in
      // progress — a display fold is not that scan. Clear findNc for the fold
      // (restored after), keeping the rollup's phantom read independent of a
      // mid-flight FIND.
      const svFind = this.findNc; this.findNc = null;
      try {
        const LT = this.LT();
        const d = dig0(); d.n = 1; d.refuse = this.refuses ? 1 : 0; d.at = LT; d.rx = LT; d.by = this.id;
        // G9 my own leaf facts. An away device sits out voting — its votes and its place in the denominator both.
        const L = this.leaf;
        if (L.hand) { d.handN = 1; d.hands.push({ id: this.id, k: L.hand, nm: L.nm }); }
        if (L.stage) d.stage.push({ id: this.id, k: L.stage, f: L.sf, nm: L.nm, dv: L.dv });
        if (L.app && L.ad) d.apps.push({ id: this.id, k: L.app, a: copyAd(L.ad) });
        if (L.away) d.awayN = 1;
        else { for (const t of L.vup) voteAdd(d.votes, { tgt: t, up: 1, dn: 0 }); for (const t of L.vdn) voteAdd(d.votes, { tgt: t, up: 0, dn: 1 }); }
        // THE HANDOVER HOLD (sim rollup). Just after a cell change I am still
        // counted at the old cell until my vacate climbs the old chain, and the
        // new chain is shorter (compaction moves strictly up): the room saw me
        // twice, every vote I cast over truth. Lists are keyed by author and
        // merge idempotently; the COUNTS are sums, so they stay out of the new
        // fold for the hold — the room may miss them a moment, never double
        // them (G9: only ever UNDER-count). n and refuse are not held.
        if (TICK < this.digHoldUntil) { d.votes = []; d.handN = 0; d.awayN = 0; }
        // G7 free-space, MEASURED ONLY: how many of my owned child row's cells
        // look admissible. Deliberately a PURE read (occ/sitting membership,
        // never cellReserved — the reservation helpers lazily expire soft
        // marks, and a display fold must not mutate admission state at all).
        if (topo.pcDepth(this.coord.pc) < 12) {
          for (const rc of this.rosterCells()) {
            const k = ck(rc); if (this.occ.has(k) || this.sitting.has(k)) continue;
            const dk2 = ck(topo.down(rc)); if (this.occ.has(dk2) || this.sitting.has(dk2)) continue;
            d.freeC++;
          }
          if (d.freeC) d.dmin = topo.pcDepth(this.coord.pc) + 1;
        }
        const dk = ck(topo.down(this.coord)); this.digGap = 0; this.downUsed = dig0();
        if (this.downDig.at >= 0 && LT - this.downDig.rx <= DIG_TTL) { digFold(d, this.downDig); this.downUsed = this.downDig; }
        else if (this.scopeGap(dk)) { d.part = 1; d.refuse += 1; this.digGap = 1; } // G3 FAIL-CLOSED: a subtree I believe populated but cannot hear counts as REFUSING, never as zero
        digTrim(d);
        this.myDig = d; this.lastPubAt = TICK; this.lastPubDepth = topo.pcDepth(this.coord.pc);
        if (this.coord.pc !== 0 && this.coord.i === 0) {
          const r = digCopy(d); r.at = LT; r.rx = LT; r.by = this.id;
          this.rowUsed.clear();
          for (let j = 1; j < C(); j++) {
            const rk = ck({ pc: this.coord.pc, r: this.coord.r, i: j }); const it = this.rowKids.get(rk);
            if (it !== undefined && LT - it.rx <= DIG_TTL) { digFold(r, it); this.rowUsed.set(rk, it); }
            else if (this.scopeGap(rk)) { r.part = 1; r.refuse += 1; this.digGap |= 2; }
          }
          digTrim(r);
          this.rowDig = r;
        }
        if (this.coord.pc === 0) {
          // ONE AUTHOR, ONE SECTION (sim rollup). A Section-1 seat holds one
          // cell, so two fresh entries by one author are one person before and
          // after a move: fold only its NEWEST report (its own stamp, one
          // clock); the superseded cell is neither a member nor a gap.
          const R = dig0(); R.at = LT; R.rx = LT; R.by = this.id;
          const newest = new Map();
          for (const e of this.s1tab.values()) if (e.by != null && LT - e.rx <= DIG_TTL) { const nb = newest.get(e.by); if (nb === undefined || nb < e.at) newest.set(e.by, e.at); }
          for (let r0 = 0; r0 < C(); r0++) for (let i0 = 0; i0 < C(); i0++) {
            const k = ck({ pc: 0, r: r0, i: i0 });
            if (this.hasCoord && k === ck(this.coord)) { digFold(R, this.myDig); continue; }
            const it = this.s1tab.get(k);
            if (it !== undefined && LT - it.rx <= DIG_TTL && it.by != null && (it.by === this.id || newest.get(it.by) !== it.at)) continue; // superseded: the author is me, or it has a newer report from another cell
            if (it !== undefined && LT - it.rx <= DIG_TTL) digFold(R, it);
            else if (this.scopeGap(k)) { R.part = 1; R.refuse += 1; this.digGap |= 4; }
          }
          digTrim(R);
          this.rootDig = R;
        }
      } finally { this.findNc = svFind; }
    }

    onPhone(m) {
      const TICK = this.TICK;
      if (m.id == null || !m.coord) return;
      const sure = this.linkIs(m, m.id);
      if (sure && m.dw) this._dwTake(m.id, m.dw);
      if (this.hasCoord && this.moving && m.tock === this.oldCk && m.tock !== ck(this.coord)) { // T1 dual-hold: the OLD seat still answers while the claim is in flight
        this.emit(m.id, { t: 'PONG', coord: this.oldCoord, from: null, id: this.id, owner: null, oCk: null, row: [], nbrs: [] }); return; // id: the answer names its author (a routed PONG's last hop is not the responder)
      }
      if (this.hasCoord && this.leaseUntil >= 0 && TICK <= this.leaseUntil && m.tock === this.leaseCk && m.tock !== ck(this.coord)) { // T3: a call to my just-vacated cell — answer MOVED so the caller confirms the vacancy NOW
        this.emit(m.id, { t: 'MOVED', ck: this.leaseCk, mvd: ck(this.coord), id: this.id }); return;
      }
      // NOT ME (sim twin): a link-proven caller phoning a cell I do not hold
      // believes I sit there. It is told where I am and who my owner is, so
      // it can drop the wrong hint (PONG, misdirected). A promoted seat's
      // cousins are HEIRS (its mates' down-child heads), installed as
      // occupants at promote-up; a mate that inherited one phoned the heir,
      // was answered by nobody, dropped its live head by the ack horizon and
      // left-packed into the held head cell (sim repro-digest post-churn,
      // seed 3: row 2/3 doubled for 7,000 ticks).
      if (this.hasCoord && sure && m.tock !== ck(this.coord)) { const myoc = this.ownerCoord(); const oCk = myoc ? ck(myoc) : null; this.emit(m.id, { t: 'PONG', coord: this.coord, from: null, id: this.id, owner: oCk ? this.occGet(oCk) : null, oCk, row: [], nbrs: [] }); return; }
      if (!this.hasCoord || m.tock !== ck(this.coord)) return; // ckey(0,0,0)=="0_0_0" is a REAL coord — always check
      // FRAME AUTHORITY. Every honest PHONE comes from a cell that is one of
      // MY owned links (ownedLinks is symmetric; a seat phones only its own
      // owned links), so any other coord is refused outright. A PHONE is
      // unsigned: it is the phoner's own word only when the transport names
      // it (lk). An UNPROVEN one (a sponsor envelope, the relay — or a forger
      // wearing any id) may only refresh a pairing I already hold: it keeps a
      // newcomer whose channels are still opening (or an island pair) alive —
      // only while no link has ever proven that pairing (entryOpen) — and
      // it never installs a seat, YIELDs an incumbent, writes the row ledger
      // or a digest. Outside the window it refreshes nothing: a crashed
      // seat's cell must heal however many PHONEs arrive in its name.
      const kk = ck(m.coord);
      if (!this.ownedLinkCell(kk)) return;
      const prev = this.occGet(kk);
      if (!sure && prev !== m.id) return;
      // E2 at the ARBITER. D5: my first-hand hearing of prev ENDS at my own
      // transport loss (an unanswered translost) — a corpse whose last PHONE
      // is still inside the 40-tick window must not out-tenure the legitimate
      // healer's fill. An answered probe erases the observation, restoring the
      // sitting occupant's full tenure protection (S5: "has itself,
      // first-hand, stopped hearing the prior occupant"). The incumbent is the
      // seat I HEAR at kk (holdsCell: liveBy) — never an occ entry a goodbye,
      // gossip or a hint wrote under another seat's live stamp (sec finding
      // Y1). Lower id wins only between a FRESH incumbent and a claimant, or a
      // revival; a TENURED incumbent beats any raw claim (law S2).
      const held = prev != null && prev !== m.id && this.holdsCell(kk, 40);
      if (held && this.ppPending(kk, m.id)) return;   // its proof is still being checked: this beat decides nothing
      if (held && (m.id > prev || this.rawClaim(kk, m.id, 40))) { this.emit(m.id, { t: 'YIELD', ck: kk, id: this.id }); return; }
      // A seat is in ONE place: a phoner I hear first-hand at another cell
      // does not displace the live incumbent here, whatever its id (a
      // neighbour claiming the next cell over was an eviction lever). A real
      // mover's old cell is freed by its LEAVE(mvd); then E2 decides.
      if (held && this.liveElsewhere(m.id, kk)) return; // id: the arbiter names itself (the YIELD is honoured only from the loser's arbiter)
      if (sure) this.nbrHeard();
      // § G UP-LEG: the phoner's digest arrives as PAYLOAD on the beat it
      // already sends (G0). Which scope it names is decided by the phoner's
      // RELATION to me, read from its coord — never from anything it asserts.
      let upD = null;
      if (sure && this.digOn() && m.dgUp && m.coord) {
        if (m.dgUp.stub === 1) { if (this.coord.pc === 0 && m.coord.pc === 0) upD = this.stubTake(Object.assign({}, m.dgUp, { from_: m.id, slot_: 'up' }), this.s1tab.get(ck(m.coord))); } // a rook peer's "unchanged" — only Section-1 digests are ever stubbed
        else { upD = digSane(m.dgUp); if (upD) this.rxDig(upD); } // off the wire: typed and capped, or refused whole; G0b: freshness on MY clock
      }
      if (upD && upD.at >= 0) {
        const pk = ck(m.coord);
        if (pk === ck(topo.down(this.coord))) this.downDig = upD;                         // my down-child head published MY OWNED CHILD ROW
        else if (this.coord.pc === 0 && m.coord.pc === 0) {                                // a rook peer published ITS SECTION
          this.s1Take(pk, upD);
        } else if (this.coord.pc !== 0 && this.coord.i === 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r) this.rowKids.set(pk, upD); // a row-mate published ITS SUBTREE
      }
      if (sure) { this.setOcc(kk, m.id); this.liveMark(kk); this.noteS1(kk); this.noteLinked(kk, m.id, m.tn); }
      else { this.upUsed.set(kk, TICK); if (this.entryOpen(kk, m.id)) { this.liveMark(kk); this.noteS1(kk); } }   // upUsed: an unproven beat for the pairing I hold, window open or expired — the probes that could re-open it keep going (a relay-only pair recovers; a corpse's forger earns one probe per 20 ticks)
      if (sure) { this.kidful.set(kk, m.kids ? 1 : 0); if (m.child != null) this.childOf.set(kk, m.child); else this.childOf.delete(kk); }
      // V7: my down-child head phoned me its ROW LEDGER. Install what I lack (a
      // cell I already hold keeps my entry — two claimants are the head's E2
      // yield to settle, not mine to overwrite) and stamp the beat. Only the
      // head itself writes it, and only cells 1..C-1 of ITS row.
      if (sure && kk === ck(topo.down(this.coord))) {
        const named = new Map();
        if (Array.isArray(m.row)) for (const e of m.row.slice(0, C())) { const c = e && cellKeyOk(e.k); if (c && c.pc === m.coord.pc && c.r === m.coord.r && c.i > 0 && e.v != null) { named.set(e.k, e.v); if (!this.occ.has(e.k)) { this.setOcc(e.k, e.v); this.noteS1(e.k); } } }
        // V7b GENERATION (H4): the ledger carries a generation the head bumps
        // whenever its row changes (never before LEDGER_GRACE ticks seated, so a new
        // head's empty first beats delete nothing — e5cdce8a). Past that
        // (generation >= 1) THE LEDGER IS THE ROW: it is authoritative for
        // every cell I neither hear first-hand nor vouch — one it omits is
        // gone (the chair is admissible again), one it names under another
        // seat is that seat's (a left-pack cascade moved the row under me).
        // Without this an owner kept a silently dead or moved row cell
        // reserved forever and pushed every newcomer one row deeper. Every
        // post-grace beat, not only an advance: an echo the head never held
        // (a dead child I learned of elsewhere) changes nothing in ITS row,
        // so its generation never moves, and install-only kept such children
        // for good — hasChildren() stayed true and the owner never compacted
        // (sim onPhone, repro-compaction leg 1 seed 36; echo-sweep.js 4).
        const rg = Number.isInteger(m.rg) && m.rg >= 0 ? m.rg : -1;
        if (rg >= 1) {
          for (let j = 1; j < C(); j++) {
            const rk = ck({ pc: m.coord.pc, r: m.coord.r, i: j }); if (!this.occ.has(rk) || this.firstHandLive(rk) || this.sitting.has(rk)) continue;
            const v = named.get(rk);
            if (v === undefined) { this.occ.delete(rk); this.live.delete(rk); this.kidful.delete(rk); this.s1seen.delete(rk); this.childOf.delete(rk); this.tlForget(rk, 'row-gen'); this.healTry.delete(rk); }
            else if (this.occGet(rk) !== v) { this.setOcc(rk, v); this.noteS1(rk); }
          }
        }
        if (rg >= 0) this.rowGenSeen = { id: m.id, rg };
        this.rowLedgerAt = this.TICK;
      }
      const myoc = this.ownerCoord(); let owner = null, oCk = null; if (myoc) { oCk = ck(myoc); owner = this.occGet(oCk); }
      const row = [];
      if (this.coord.i === 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r) { row.push({ k: ck(this.coord), v: this.id, age: this.occGet(ck(topo.down(this.coord))) }); for (let c = 1; c < C(); c++) { const rc = { pc: this.coord.pc, r: this.coord.r, i: c }; const x = this.occGet(ck(rc)); if (x != null && x !== m.id) row.push({ k: ck(rc), v: x, age: this.childOf.has(ck(rc)) ? this.childOf.get(ck(rc)) : null }); } }
      const cous = [];
      if (kk === ck(topo.down(this.coord))) { // my DOWN-CHILD phoning: teach it the heirs at its FUTURE owned-links (relay-free promote-up)
        for (const mate of topo.rowMates(this.coord)) { const v = this.childOf.get(ck(mate)); if (v != null) cous.push({ k: ck(mate), v }); }
        if (this.coord.pc === 0) { // W7: my future owned-links are my whole ROW + whole COLUMN (rook) — teach the column heirs too
          for (const cmx of topo.colMates(this.coord)) { const v = this.childOf.get(ck(cmx)); if (v != null) cous.push({ k: ck(cmx), v }); }
        } else { const xl = topo.crossLink(this.coord); if (xl) { const v = this.childOf.get(ck(xl)); if (v != null) cous.push({ k: ck(xl), v }); } }
      } else if (this.coord.i === 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r) { // a ROW-MATE phoned me (head): share MY cousins for H2/C2 promote-up
        for (const [k, v] of this.cousins) cous.push({ k, v });
      }
      // coord+id ride the PONG so the phoner gains FIRST-HAND liveness for me (bidirectional heartbeat)
      const pong = { t: 'PONG', owner, oCk, row, nbrs: cous, coord: this.coord, id: this.id };
      // § G DOWN-LEG (rides the PONG I already send, G0): the room fold, plus
      // the fold I PUBLISH BACK TO THIS PEER. The published fold is the whole
      // of G4 — it hands every author the one value it is uniquely qualified
      // to refute: to my DOWN-CHILD -> my SUBTREE claim (its row digest is the
      // claim's sole input; that child is already my C3-designated healer); to
      // a ROW-MATE -> my ROW fold, which must contain that mate's own
      // contribution. And the ECHO: the report I actually FOLDED from this
      // peer — downUsed/rowUsed, snapshotted at rollup, NOT what I currently
      // hold (echoing a newer report that landed since my fold accuses me of
      // suppression I did not commit — one beat of lag; measured in the sim).
      // A liar that strips its fold strips the echo too (`lie 1` models it) —
      // exactly what check (1) catches, since the peer holds the original.
      if (this.digOn()) {
        pong.dgRoot = this.wireDig(this.rootDig); delete pong.dgRoot.by; // nobody echoes the room fold: its author is dead weight on every PONG
        pong.dgRoot = this.stubFor(m.id, 'root', this.rootDig, pong.dgRoot);
        const isDownKid = kk === ck(topo.down(this.coord));
        pong.dgPub = this.pubDig(isDownKid ? this.myDig : ((this.coord.pc !== 0 && this.coord.i === 0) ? this.rowDig : this.myDig));
        if (isDownKid) pong.dgEcho = this.pubDig(this.downUsed);
        else if (this.coord.pc !== 0 && this.coord.i === 0) { const it = this.rowUsed.get(kk); if (it !== undefined) pong.dgEcho = this.pubDig(it); }
      }
      this.emit(m.id, pong);
      if (prev !== m.id) this._gspReplay(m.id); // NEW occupant learned ⇒ hand over the recent gossip backlog
      if (prev != null && prev !== m.id) this.emit(prev, { t: 'YIELD', ck: kk, id: this.id });
    }
    phoneHome() {
      let tc = null; if (this.hasCoord) { if (this.coord.i !== 0) tc = { pc: this.coord.pc, r: this.coord.r, i: 0 }; else tc = this.ownerCoord(); }
      if (!tc) return; const tid = this.occGet(ck(tc));
      // A VACANT UP-CELL IS PROBED EVERY BEAT (sim twin). A head whose owner
      // cell went empty in my view (its LEAVE reached me, or the silence
      // horizon erased it) used to phone nobody and wait: the cell's healer
      // claims to the hole's owned links as IT sees them, and a Section-1
      // healer arriving from another row has never seen my row, so its CLAIM
      // never reached me. I kept my ghost owner, my lastAck rotted to E1, and
      // the new owner — with an empty view of its child row — admitted a
      // newcomer into my held head cell and then into my mates' cells, each
      // with a placement proof; every healer of my cell inherited the ghost
      // from the row's cousins and re-healed into the held cell for 221 ticks
      // at a time (heal-time.js 40%-kill seed 6: row 1_0 held 5 duplicate
      // pairs for 1800 ticks). The probe's ROUTED answer names whoever holds
      // the cell now, I HELLO it and phone it, and the owner learns its child
      // head and ledger within a beat.
      if (tid == null) { this.routeTo(tc, 1); return; }
      const ph = { t: 'PHONE', coord: this.coord, tock: ck(tc), id: this.id, kids: this.hasChildren(), child: this.occGet(ck(topo.down(this.coord))) };
      // V7 THE DEEP-ROW LEDGER (sim phoneHome): a deep head phoning its OWNER
      // carries its row's occupants (cells 1..C-1, first-hand at the head).
      // An empty list is still a ledger — the owner keys on the beat.
      if (this.coord.pc !== 0 && this.coord.i === 0) {
        ph.row = []; let sig = '';
        for (let j = 1; j < C(); j++) { const rk = ck({ pc: this.coord.pc, r: this.coord.r, i: j }); const x = this.occGet(rk); if (x != null && x !== this.id) { ph.row.push({ k: rk, v: x, age: -1 }); sig += rk + ':' + x + ';'; } }
        // V7b: the ledger's GENERATION — bumped on every change of my row
        // once I have been seated LEDGER_GRACE ticks (my live mates have all
        // found me and phoned by then; 40 was measured too eager after a mass
        // kill: heal-time.js 40%-kill mean 1328 vs 1200 at 100); 0 before
        // that, so a new head's first beats are never authoritative.
        if (this.TICK - this.seatedAt >= LEDGER_GRACE) { if (sig !== this.rowLedgerLast) this.rowGen++; if (this.rowGen < 1) this.rowGen = 1; }
        this.rowLedgerLast = sig; ph.rg = this.rowGen;
      }
      // § G UP-LEG (payload on the beat, G0): a deep HEAD contributes its whole
      // ROW fold (its owner is linked to it and nobody else in that row);
      // everyone else contributes its own subtree. Section-1 rows do NOT roll
      // up — every S1 seat is a forest root — so an S1 seat always publishes
      // its subtree. noteUp: the G4 ground truth for the aggregator's echo.
      if (this.digOn()) { ph.dgUp = this.pubDig((this.coord.pc !== 0 && this.coord.i === 0) ? this.rowDig : this.myDig); this.noteUp(ph.dgUp); this._dw(tid, ph); }
      this.emit(tid, ph);
      // A GHOST PHONE TARGET MUST BE FALSIFIABLE (2026-08-05; sim twin is the
      // origin — churn-combos leg C). An occupant that MOVED before I arrived
      // (its LEAVE went to a then-empty cell, so nobody could address it to me)
      // leaves a ghost occ entry no rule can falsify: occGet never nulls, no
      // transport event ever fires (we never shared a live DC), the healers'
      // guards stay shut, and my lastAck rots to E1's 220-tick last resort —
      // a healthy seat unseats out of a healthy room because somebody ELSE's
      // link blipped. Remedy: a VIEW-ONLY delete at the healers' OWN horizons,
      // probe-gated — past OWNER_SILENT I probe the cell across the mesh every
      // beat (a live-but-severed occupant answers HELLO, turns first-hand, and
      // this branch resets); only a target silent through the same confirm
      // horizon the healers use (60 deep, RING_HOLD in Section 1) loses the
      // occ entry, which lets the EXISTING occGet==null healer branches fire
      // with their own pacing. (A translost-based first cut borrowed the
      // DC-death EARLY_HOLD confirm and minted a dup under mass-kill — probe
      // loss in a storm is not death evidence. Measured in the sim, reverted.)
      // NARROWED (second cut): only an occupant I have NEVER heard first-hand
      // — a pure inheritance ghost (live has no entry at all) — is falsifiable
      // by silence. An occupant I once heard and lost is the severed-but-alive
      // case: D5/E2's transport-event + ring conservatism owns it, never a
      // silence clock — under continuous link churn probes die with the links,
      // and the broad !firstHandLive form falsified LIVE severed neighbours
      // (sim repro-adversary went RED in-gate on the first cut).
      const tk = ck(tc);
      if (this.TICK - this.lastAck > OWNER_SILENT && !this.live.has(tk)) {
        // AROUND the occupant I doubt (routeToProbe, as D5 does): routeTo's
        // ideal first hop toward my up-cell IS that cell's occupant, so a
        // ghost owner swallowed every probe, the head hit E1 at 221 ticks and
        // requeued, and the next mate left-packed into the head cell with the
        // same ghost from the row's shared view — a head cell cycling through
        // its row for 1,200 ticks under a Section-1 owner it never reached
        // (heal-time.js 40%-kill seed 7, cell 2_2_0 under 0_2_1).
        this.routeToProbe(tc);
        // A GHOST SECTION-1 OWNER IS ASKED OF THE DOOR (sim twin). A head
        // promoted on its row's shared view phones the owner that view
        // names; when that seat is dead the probe around it has no hop (the
        // owner cell is the head's only path up), the ack horizon and E1 run
        // on the same 220 ticks, and E1 wins: every row-mate left-packed
        // into the head cell in turn, phoned the corpse for 221 ticks and
        // requeued — a revolving door at one head cell for 2,000 ticks, its
        // child head's root fold frozen at the pre-churn room (repro-digest
        // N=600 seed 3 arm A: a vote over-counted at 7 of 25 samples). The
        // door lists the live home ring; HOME installs the real owner over a
        // hint I never heard.
        if (tc.pc === 0 && this.TICK - this.rosterAskAt > 40 && this.lastGreeters) { const gs = this.lastGreeters.filter((g) => g != null && g !== this.id); if (gs.length) { this.rosterAskAt = this.TICK; this.emit(gs[(this.rng() * gs.length) | 0], { t: 'WHOHOME', from: this.id, ttl: 60 }); } }
        const confirmH = (tc.pc === 0) ? RING_HOLD : 90; // deep: 1.5x the healer horizon — silence is weaker evidence than a LEAVE; 60 degraded post-mass-kill packing (sim compaction leg 1), 120 lost the E1 race (leg C s5); 90 measured green on both
        if (this.TICK - this.lastAck > confirmH && this.occ.has(tk)) { this.occ.delete(tk); this.kidful.delete(tk); this.s1seen.delete(tk); }
      }
    }
    // D1 heartbeat over the RICH ROOK (W7): a Section-1 seat phones every live
    // rook neighbour — its whole row AND whole column — each beat, so first-hand
    // liveness is maintained across all redundant home paths. This is what lets
    // phantoms decay (no heartbeat ⇒ not first-hand ⇒ probed and cleared) and
    // lets ringConfirmDead rely on first-hand truth instead of gossip. The deep
    // down-link is still covered by the deep child phoning UP (phoneHome).
    s1Heartbeat() {
      if (!this.hasCoord || this.coord.pc !== 0) return;
      for (const t of topo.ownedLinks(this.coord)) {
        if (t.pc !== 0) continue; // rook (Section-1) links only
        const tid = this.occGet(ck(t));
        if (tid == null || tid === this.id) continue;
        // A ROOK CELL HELD BY A SEAT I DO NOT HEAR (silent past OWNER_SILENT)
        // IS PROBED once per silence window (sim twin). The answer (ROUTED,
        // from whoever sits there) replaces the stale hint: a stale hint rides
        // a healer's nbrs into a promoted seat (cousins are heirs, not
        // occupants), and two rook neighbours blind to each other each
        // admitted a newcomer into the other's seat until the ring hold ran
        // out (c-sweep C=2 churn 0.15 seed 2, 10 duplicates). Around the
        // doubted occupant (routeToProbe). Once per window, not every beat:
        // every beat flooded the G9 lists (repro-digest leg 8) and minted a
        // partition duplicate (c-sweep C=2 split seed 3).
        { const tk = ck(t); const po = this.probeOut && this.probeOut.get(tk); if (!this.translost.has(tk) && !this.firstHandLive(tk) && (!this.live.has(tk) || this.TICK - this.live.get(tk) > OWNER_SILENT) && (!po || this.TICK - po.last > OWNER_SILENT)) this.routeToProbe(t); }   // never a cell under a standing D5 observation: that probe is D5's (forged-frames Y5)
        const ph = { t: 'PHONE', coord: this.coord, tock: ck(t), id: this.id, kids: this.hasChildren(), child: this.occGet(ck(topo.down(this.coord))) };
        if (this.digOn()) { const w = this.pubDig(this.myDig); ph.dgUp = this.lie ? w : this.stubFor(tid, 'up', this.myDig, w); this._dw(tid, ph); } // § G: rook peers exchange SECTION digests (no row fold in Section 1 — every S1 seat is a forest root); unechoed, so stubbed. The AUTHOR rides: the root fold counts one author once (s1Take, rollup)
        this.emit(tid, ph);
      }
    }
    s1Sync() {
      const TICK = this.TICK;
      const ent = [{ k: ck(this.coord), v: this.id, age: 0, ch: this.occGet(ck(topo.down(this.coord))), ba: this.born.has(ck(this.coord)) ? Math.max(0, this.LT() - this.born.get(ck(this.coord))) : 0 }]; // carry MY heir, and my claim's AGE (C5 + G0b: no tick crosses a link)
      for (const [k, v] of this.occ) { if (isS1key(k) && v !== this.id) { const it = this.s1seen.get(k); if (it !== undefined && TICK - it < 120) ent.push({ k, v, age: TICK - it, ch: this.childOf.has(k) ? this.childOf.get(k) : null, ba: this.born.has(k) ? Math.max(0, this.LT() - this.born.get(k)) : -1 }); } }
      // W7: sync over the whole rook neighbourhood — every live row-mate AND
      // column-mate (heads included) — keeping the full C^2 home roster
      // consistent across the richly-meshed section.
      const tg = new Set();
      for (const m of topo.rowMates(this.coord)) { const t = this.occGet(ck(m)); if (t != null && t !== this.id) tg.add(t); }
      for (const m of topo.colMates(this.coord)) { const t = this.occGet(ck(m)); if (t != null && t !== this.id) tg.add(t); }
      // § G ROOT FOLD: the rook has diameter 2, so a Section-1 seat hears
      // 2(C-1) of the C^2 sections first-hand and needs ONE relay hop for the
      // rest. S1SYNC is already that relay (it carries the C^2 occupancy
      // table), so the digest table rides it — no new frame (G0), and the fold
      // completes in two beats. Relaying another section's digest is
      // second-hand BY CONSTRUCTION; safe for exactly one reason (G1): a
      // digest can never actuate. Entries carry their AUTHOR's stamp relayed
      // unchanged (the G4 identifier) and their RELATIVE age grown by every hop
      // that held them (G0b), so a relayed fold never looks fresher than it is.
      let digs = null;
      if (this.digOn()) {
        digs = [{ k: ck(this.coord), d: this.pubDig(this.myDig), src: this.myDig }];
        for (const [k, d] of this.s1tab) if (k !== ck(this.coord) && this.LT() - d.rx <= DIG_TTL) digs.push({ k, d: this.wireDig(d), src: d });
        // The AUTHOR rides each entry (it was stripped as dead weight until
        // 2026-10-03): the root fold counts one author once, and one author's
        // reports are ordered by its own stamp (s1Take) — neither is possible
        // without it.
      }
      // Per target: whole entries where the content changed, stubs where it did not.
      for (const t of tg) { const msg = { t: 'S1SYNC', ent }; if (digs) msg.digs = digs.map((e) => ({ k: e.k, d: this.lie ? e.d : this.stubFor(t, 's1:' + e.k, e.src, e.d) })); this._dw(t, msg); this.emit(t, msg); }
    }
    // childSweep — a DEEP owner's view of its child row when NO ledger comes
    // (sim childSweep). The row's head phones me its ledger every beat; when
    // the whole row has gone, nobody is left to say so, and the non-head cells
    // (not my owned links: their LEAVEs never reach me) stayed in my occ for
    // good. With no ledger for CHILD_LEDGER_H, a child cell — the head cell
    // too — that I neither hear first-hand nor vouched, believed that long, is
    // forgotten on silence (so it takes rowSweep's 45-tick admission cooling).
    // A SECTION-1 owner too: its child row's head phones it the same ledger,
    // and a home seat that kept a dead child row's echoes was never a leaf —
    // it swallowed every FINDLEAF for a home hole (hasChildren, no first-hand
    // child to hand on to, same row: return) and the hole's healer retried
    // one ring-hold later, for 1,200 ticks (heal-time.js 40%-kill seed 7).
    childSweep() {
      if (!this.hasCoord || this.state !== 3) return;
      if (this.rowLedgerAt >= 0 && this.TICK - this.rowLedgerAt <= CHILD_LEDGER_H) return;
      for (const rc of this.rosterCells()) {
        const k = ck(rc); if (!this.occ.has(k) || this.firstHandLive(k) || this.softSitting(k)) continue;
        const b = this.born.get(k); if (b !== undefined && this.LT() - b <= CHILD_LEDGER_H) continue;
        this.occ.delete(k); this.live.delete(k); this.kidful.delete(k); this.childOf.delete(k); this.tlForget(k, 'child-silent'); this.healTry.set(k, this.TICK);
      }
    }
    rowSweep() {
      // 11a: the head no longer HEALS its row cells (each is healed by its own
      // down-child (VERTICAL) or its right-neighbour (LEFT-PACK) — a fixed
      // unique designation). rowSweep is pure cleanup: forget a row cell gone
      // silent past the horizon so a corpse stops riding the head's PONG. A
      // severed-but-alive cell that gets forgotten re-announces on recovery.
      const TICK = this.TICK;
      if (this.coord.i !== 0) return; const del = [];
      for (const [k, at] of this.live) { if (TICK - at <= 50) continue; const c = unck(k); if (c.pc === this.coord.pc && c.r === this.coord.r && c.i > 0) del.push(k); }
      // ...and a DEEP row cell I have NEVER heard: occ with no live stamp,
      // believed longer than the same horizon. A row-mate phones its head every
      // beat, so a real one is live within 8 ticks; one that never was is a
      // second-hand echo of an occupant already gone (an admitter's neighbour
      // list at my take, a mover's reservation). Nothing swept it, and a dead
      // occupant's cell stays reserved, so the chair stayed shut to newcomers
      // and to compaction for good (sim rowSweep, repro-compaction leg 1 seed 1).
      // Section 1 is left to s1Fill and ring-hold conservatism.
      if (this.coord.pc !== 0) for (const [k, v] of this.occ) { const c = unck(k); if (c.pc !== this.coord.pc || c.r !== this.coord.r || c.i === 0 || v === this.id || this.live.has(k)) continue; const b = this.born.get(k); if (b !== undefined && this.LT() - b <= 50) continue; del.push(k); }
      // A SILENCE-forget is NOT a free chair (2026-08-02): the occupant may be
      // merely severed from ME while my row-mates still hear it — their next
      // S1SYNC re-seeds my occ within a beat, but the gap between this forget
      // and that re-seed was an ADMISSION WINDOW: a seeker could be seated on
      // a live peer's cell and the E2 contest then churned one of them out
      // (mesh-harness D5-sever: a revolving door at the severed cell). Stamp
      // healTry — the head's own 45-tick admission pace — so the window is
      // closed; every EXPLICIT free (LEAVE, MOVED, D5 confirm, check-back)
      // still clears healTry and stays instantly admissible.
      for (const k of del) { this.live.delete(k); this.occ.delete(k); this.kidful.delete(k); this.s1seen.delete(k); this.tlForget(k, 'row-age'); this.healTry.set(k, this.TICK); }
      // (D5's early corpse-forget lives in tlSweep — every observer, not just
      // heads — so a confirmed corpse stops riding rosters in ~probe-time.)
    }
    s1Fill() {
      // Section 1 must stay full (25). A cell {0,r,j} is normally refilled from
      // below by its down-child (VERTICAL). s1Fill is the HEAD's backstop AND
      // the only thing that clears a Section-1 PHANTOM. Every fill is
      // probe-gated (ringConfirmDead) so a merely-unreachable occupant is held
      // as a hole, never duplicated. One heal per pass.
      const TICK = this.TICK;
      if (TICK - this.seatedAt < 80) return;
      for (let j = 1; j < C(); j++) {
        const c = { pc: 0, r: this.coord.r, i: j }; const kk = ck(c);
        // D5: on the EARLY path defer a cell that owns a down-child to its
        // VERTICAL healer (bug #3's rule) — that child holds the same first-
        // hand loss and heals it in ~probe-time; racing it here minted
        // duplicates. The RING_HOLD horizon path is unchanged (translost
        // clears once the cell refills or answers).
        if (this.translost.has(kk) && this.hasDownChild(c)) continue;
        // (the translost observation deliberately STANDS after the clear — it
        // keeps S1SYNC echoes from re-seating the corpse in my occ until the
        // cell genuinely refills; setOcc/admit clear it on an occupant change)
        if (this.ringConfirmDead(c)) { if (this.occ.has(kk)) { this.occ.delete(kk); this.live.delete(kk); this.s1seen.delete(kk); this.kidful.delete(kk); } this.holeSince.delete(kk); this.heal(c); return; }
      }
    }
    // H1-S1 RING-HEAL CONSERVATISM, probe-gated (NOT gossip-gated). A home cell
    // I don't hear first-hand is a hole, a phantom, or an occupant merely
    // unreachable to me — s1Fresh can NEVER distinguish them. So I actively
    // PROBE it across the whole rook (routeTo walks every redundant path): a
    // live-and-reachable occupant answers with a HELLO and becomes first-hand
    // next round; a true hole / phantom / genuinely-partitioned occupant stays
    // silent. Only after unreachable via ALL paths for the full ring window is
    // it declared dead. Hold the hole; never mint the duplicate.
    ringConfirmDead(h) {
      const hk = ck(h);
      // D5 EARLY-PROBE: my own transport to this occupant died (first-hand) and
      // the confirm probe has gone unanswered across the whole rook for the
      // settled early window — confirmed dead NOW; the horizon below remains
      // the backstop when no transport event fired. (An answered probe clears
      // the observation inside translostConfirmed — no eviction, E2 stands.)
      if (this.translostConfirmed(hk)) return true;
      if (this.firstHandLive(hk)) { this.holeSince.delete(hk); return false; }
      this.routeTo(h, 1); // probe across the rook
      let since;
      if (this.live.has(hk)) since = this.live.get(hk);
      else if (this.holeSince.has(hk)) since = this.holeSince.get(hk);
      else { since = this.TICK; this.holeSince.set(hk, since); }
      return this.TICK - since > RING_HOLD;
    }

    // ---- gossip: room-wide flood over the mesh (PRODUCTION EXTENSION) ----
    // Not part of the sim's law set — the app layer (chat/status/votes/files)
    // rides this instead of relay fan-out, because the relay session is only
    // the greeter pool now, not the room. A bounded-degree flood with dedup:
    // fan-out ≤ my live links, the seen-cache kills echoes, and the link graph
    // (rows + cross + up/down + the S1 rook) spans the stadium, so every seated
    // seat converges on every message. Cost: O(edges) frames per message.
    linkPeers() {
      const out = new Set();
      if (!this.hasCoord) return out;
      for (const olc of topo.ownedLinks(this.coord)) { const x = this.occGet(ck(olc)); if (x != null && x !== this.id) out.add(x); }
      const o = this.ownerId(); if (o != null && o !== this.id) out.add(o);
      return out;
    }
    // SECTION-SCOPED GOSSIP (docs/status-plane-migration.md). A room-wide flood
    // costs every node O(N) frames per message — right for an EVENT (a chat
    // line, a stop, a grant: once per change) and wrong for a HEARTBEAT, which
    // every participant re-sends every period: that is the scale-audit V1
    // status flood. `scope: 'section'` delivers and forwards only inside the
    // sender's section (the C×C seats sharing its pc), over the links that stay
    // inside it — row, cross and the Section-1 rook; never up or down — so a
    // heartbeat costs O(C²) per node whatever N is. Below C² participants the
    // room IS Section 1, so a section flood is the room flood (G8).
    // `ephemeral` keeps a message out of the re-fan/replay backlog: a heartbeat
    // is superseded by the next beat, and remembering it only re-sent it for
    // nothing and pushed chat and events out of the 64-entry backlog before
    // their re-fan could protect them.
    sectionPeers() {
      const out = new Set();
      if (!this.hasCoord) return out;
      for (const olc of topo.ownedLinks(this.coord)) {
        if (olc.pc !== this.coord.pc) continue; // the down link leaves the section; the owner (up) is never added
        const x = this.occGet(ck(olc)); if (x != null && x !== this.id) out.add(x);
      }
      return out;
    }
    gossip(payload, opts) {
      const sc = opts && opts.scope === 'section' ? (this.hasCoord ? this.coord.pc : null) : undefined;
      if (sc === null) return; // an unseated seat has no section to speak to
      const eph = !!(opts && opts.ephemeral);
      this.gseq = (this.gseq || 0) + 1; const gid = this.id + ':' + this.gseq;
      (this.gseen = this.gseen || new Map()).set(gid, this.TICK);
      const tx = new Map(); // link -> copies handed (the re-fan's ledger, see _gspRefan)
      if (!eph) this._gspRemember(gid, this.id, payload, sc, 0, undefined, tx);
      // A FRESH frame per emit: transports stamp to/from onto the object they
      // are handed, so one shared frame would reach only its last recipient.
      for (const p of (sc !== undefined ? this.sectionPeers() : this.linkPeers())) { this.emit(p, this._gspFrame({ gid, src: this.id, m: payload, sc, eph })); tx.set(p, 1); }
    }
    _gspRecv(m) {
      if (this.s4 && !m.s4ok) return; // under S4 every gossip frame is verified before it gets here; an unverified one is nobody's
      const scoped = m.t === 'GSPS'; // the TYPE decides: a field on a 'GSP' frame scopes nothing
      if (scoped && (!Number.isInteger(m.sc) || !this.hasCoord || this.coord.pc !== m.sc)) return; // outside the section it was scoped to (a replay or a stale link), or no scope at all
      // A gid NAMES ITS AUTHOR (`<src>:<seq>`, minted in gossip()). The seen
      // set is keyed by gid alone, so a frame whose gid names another seat is
      // refused before it can be marked seen: otherwise a member could sign
      // frames (as itself) carrying a neighbour's next gids and every seat
      // would drop that neighbour's next messages as duplicates. The identity
      // layer refuses the same frame at verification; this holds without S4.
      if (typeof m.gid !== 'string' || typeof m.src !== 'string' || !m.gid.startsWith(m.src + ':')) { this.gspForged = (this.gspForged || 0) + 1; return; }
      const g = this.gseen = this.gseen || new Map();
      if (g.has(m.gid)) return;
      // THE FLOOD GUARD. Each LINK may hand me GSP_RATE new messages a tick
      // (burst GSP_BURST), and any one author GSP_SRC_RATE of them; past that
      // they are dropped here, unseen and unforwarded. The budget is per link, so what any one client can push
      // into the room is bounded by its handful of links whatever the room's
      // size, and a flood dies at its first honest neighbours. It is set far
      // above anything the app sends; it exists so a hostile member slows a
      // meeting instead of ending it. (Duplicates are free: they never reach
      // this line.) Dropped messages stay unseen, so a copy arriving later
      // over a calmer link still lands.
      if (!this._gspBudget(m.lk != null ? m.lk : m.from, m.src)) { this.gspDropped = (this.gspDropped || 0) + 1; return; } // the link the TRANSPORT named, when it named one: a hostile link that writes a fresh `from` on every frame must not mint itself a fresh bucket each time
      g.set(m.gid, this.TICK);
      // Horizon GC from the OLDEST entry, stopping at the first fresh one: the
      // Map keeps insertion order and every entry is stamped with the tick it
      // arrived, so the expired entries are a prefix. A receipt costs
      // O(expired + 1) steps; a walk of the whole set per receipt was a
      // 4,000-entry scan per frame in any room gossiping more than ~7 a tick.
      if (g.size > 4096) { for (const [k, at] of g) { if (this.TICK - at > 600) g.delete(k); else break; } }
      if (g.size > 65536) { let n = g.size - 32768; for (const k of g.keys()) { if (n-- <= 0) break; g.delete(k); } } // hard cap: oldest first (a Map keeps insertion order)
      const ag = Number.isInteger(m.ag) && m.ag > 0 ? Math.min(m.ag, 1 << 20) : 0;
      // The app gets a COPY: what I forward (and remember for re-fan) must be
      // the author's bytes exactly — the signature commits to them — and the
      // app stamps its own fields onto what it takes (takeStatus: rx).
      let own = m.m; try { if (this.s4 && m.m && typeof m.m === 'object') own = JSON.parse(JSON.stringify(m.m)); } catch (e) {}
      if (this.onGossip) { let ok; try { ok = this.onGossip(m.src, own, ag, scoped); } catch (e) {} if (ok === false) { this.gspRefused = (this.gspRefused || 0) + 1; return; } } // the app REFUSED it: not remembered, not forwarded
      // The link that handed me this frame already holds it (two copies would
      // only echo). The named author gets one re-fan, not a full mark: the
      // initial forward skips m.src, and when the frame was injected the
      // author is often the only link out of this row. Marking the author
      // full stranded that copy inside the sender's neighbourhood. An honest
      // hop already has from === src, so the second write keeps the author
      // quiet and the bound stays two copies per link.
      const tx = new Map(); tx.set(m.src, 1); if (m.from != null) tx.set(m.from, 2);
      if (!m.eph) this._gspRemember(m.gid, m.src, m.m, scoped ? m.sc : undefined, ag, m.s4, tx);
      const e = { gid: m.gid, src: m.src, m: m.m, sc: scoped ? m.sc : undefined, eph: m.eph ? 1 : 0, ag0: ag, s4: m.s4 };
      for (const p of (scoped ? this.sectionPeers() : this.linkPeers())) if (p !== m.src) { this.emit(p, this._gspFrame(e)); tx.set(p, 1); }
    }
    // ANTI-ENTROPY, two repairs (dedup makes both idempotent):
    // 1. BEAT RE-FAN — a one-shot flood races topology convergence: a seat whose
    //    neighbours' occ was momentarily stale (mid-heal) is silently missed, so
    //    each seat re-fans messages younger than ~4 phone beats.
    // 2. NEW-NEIGHBOUR REPLAY — a seat that was UNSEATED during the whole flood
    //    window arrives with no history; the first PHONE that teaches me a NEW
    //    occupant gets my recent backlog replayed.
    // ag0: how old the message already was when I took it (ticks, summed over
    // every holder before me). What I send on is ag0 + my own hold — an AGE,
    // never a stamp (G0b): a re-fanned or replayed message must not read as
    // newly said, and no two seats share a clock to date it by.
    // Two buckets, both must have a token: the LINK's (everything one
    // neighbour hands me) and, inside it, the claimed AUTHOR's on that link —
    // so one loud author cannot spend the whole link and starve everyone
    // else's messages that arrive over it. (An attacker that forges a new
    // author per message still meets the link's bucket.)
    _gspBudget(link, src) {
      if (this.env.GSP_GUARD === false) return true;
      const B = this.gspBkt = this.gspBkt || new Map(), T = this.TICK;
      const take = (k, rate, burst, peek) => {
        let b = B.get(k); if (!b) { if (B.size > 4096) B.clear(); B.set(k, b = { n: burst, at: T }); }
        if (T > b.at) { b.n = Math.min(burst, b.n + (T - b.at) * rate); b.at = T; }
        if (b.n < 1) return false;
        if (!peek) b.n -= 1; return true;
      };
      const lk = 'L|' + (link == null ? '?' : link), sk = lk + '|' + src;
      if (!take(sk, GSP_SRC_RATE, GSP_SRC_BURST, true) || !take(lk, GSP_RATE, GSP_BURST, true)) return false;
      take(sk, GSP_SRC_RATE, GSP_SRC_BURST); take(lk, GSP_RATE, GSP_BURST);
      return true;
    }
    _gspRemember(gid, src, m, sc, ag0, s4, tx) { const g = this.grecent = this.grecent || []; const e = { gid, src, m, at: this.TICK, tx: tx || new Map() }; if (sc !== undefined) e.sc = sc; if (ag0) e.ag0 = ag0; if (s4) e.s4 = s4; g.push(e); if (g.length > 64) g.shift(); }
    // A SCOPED message rides its OWN frame type, 'GSPS'. A client from before
    // the status plane knows only 'GSP' and drops an unknown type at recv()'s
    // default — so it can never strip the scope and re-flood a heartbeat to
    // the whole room (measured with sc as a field on 'GSP': ONE old seat at
    // N=400 leaked section heartbeats to 385 seats). It still hears its
    // row-mates' statuses over run.html's own DataChannel pulse.
    _gspFrame(e) { const f = { t: e.sc !== undefined ? 'GSPS' : 'GSP', gid: e.gid, src: e.src, m: e.m }; if (e.sc !== undefined) f.sc = e.sc; if (e.eph) f.eph = 1; if (e.s4) f.s4 = e.s4; /* the AUTHOR's signature travels with the message */ const ag = (e.ag0 || 0) + (e.at != null ? Math.max(0, this.TICK - e.at) : 0); if (ag > 0) f.ag = ag; return f; }
    // Each entry keeps a ledger (e.tx: link -> copies handed). A link is handed
    // a message at most TWICE — the fan and one re-fan at the next beat — and a
    // link that appears later (a heal, a new neighbour) gets its two then. The
    // receiver dedups, so a third copy bought nothing and cost a signed, sealed
    // frame: re-fanning every link at +8, +16, +24 and +32 sent five copies of
    // every chat line and caption out of every seat.
    _gspRefan() {
      const g = this.grecent; if (!g || !g.length) return;
      this.grecent = g.filter((e) => this.TICK - e.at <= 256); // replay horizon (memory-bounded with the 64 cap)
      for (const e of this.grecent) {
        if (this.TICK - e.at > 32) continue; // beat re-fan only while fresh
        const tx = e.tx || (e.tx = new Map());
        for (const p of (e.sc !== undefined ? this.sectionPeers() : this.linkPeers())) { const n = tx.get(p) || 0; if (n >= 2) continue; tx.set(p, n + 1); this.emit(p, this._gspFrame(e)); }
      }
    }
    _gspReplay(to) { if (this.grecent) for (const e of this.grecent) { this.emit(to, this._gspFrame(e)); const tx = e.tx || (e.tx = new Map()); tx.set(to, (tx.get(to) || 0) + 1); } } // a scoped entry reaching a seat outside its section is dropped there

    // ---- message dispatch ----
    recv(m) {
      if (!this.alive) return;
      // Coordinates ride unsigned frames (ROUTE, FIND, S1SYNC, …) and index
      // the topology arithmetic: a pc that is not a natural number, or an r/i
      // that is not, is a hostile or corrupt frame, never a seat. Dropped at
      // the door so no handler has to re-check (topo.pcDepth guards itself
      // too — see gifos-net.js).
      for (const k of ['coord', 'target', 'hole', 'rdst', 'acoord']) {
        const c = m[k];
        if (c == null) continue;
        if (!coordOk(c)) return; // r, i inside C; the section path a real one, no deeper than the wall
      }
      if (m.routing && !this.routeStep(m)) return; // Option A: in-transit routing frame — forward (or drop); fall through only when FOR me
      if (this.moving && this.state === 3 && this.moveEvidence(m)) this.confirmMove(); // T1: a new-neighbourhood frame is the claim's CONFIRMATION — vacate the old seat now
      const TICK = this.TICK, HEALING = this.env.HEALING;
      switch (m.t) {
        case 'GREETERS': {
          // An EMPTY list to a seated seat is news too: nobody else is registered.
          // Dropped, the seat kept its previous list, and a head back from a
          // dark spell whose list named a departed mate held every seeker off
          // at the split-off guard (serveFind) for the list's whole TTL
          // the reloaded mate never got a seat).
          if (!m.list.length) { if (this.state === 0) { this.genKey = this.myKey; this.take({ pc: 0, r: 0, i: 0 }, null, []); } else if (this.state === 3) { this.lastGreeters = []; this.greetersAt = TICK; } return; } // R3 mint / R6 take-over
          // R6: greeters exist (meeting alive) but I've REACHED none (no HOME
          // roster came back) for a full TTL ⇒ voted off / unreachable subnet.
          // A seat that keeps reaching greeters but only gets NOROOM is
          // competing for a slot in a busy heal — NOT stranded (bug #6).
          if ((this.state === 0 || this.state === 1) && this.joinStart < 0) this.joinStart = TICK; // the strand clock starts at the first list (see the ctor)
          if ((this.state === 0 || this.state === 1) && this.joinStart >= 0 && TICK - this.joinStart > STRAND_TTL && (this.lastReach < 0 || TICK - this.lastReach > STRAND_TTL)) { this.stranded = true; this.strandedAt = TICK; return; }
          this.lastGreeters = m.list; this.greetersAt = TICK; this.findAckers = Array.isArray(m.fa) ? new Set(m.fa) : null; // FINDACK: which doors' builds acknowledge (a mixed-build room keeps the old windows for the rest) // stamped: entry-resume trusts this list only while registry-fresh
          if (this.state === 0 && !this.forkPaused) {
            // R5: probe SEVERAL greeters. One greeter → classic path. Many →
            // collect HOMEs; cluster by gkey + roster overlap. Two+ clusters
            // (multi-genesis OR same-key torn halves) ⇒ human pick-one.
            const pool = m.list.filter((g) => g && g !== this.id);
            if (!pool.length) return;
            if (pool.length === 1) {
              this.gateway = pool[0];
              (this.triedSilent = this.triedSilent || new Set()).add(pool[0]); // silent until its HOME lands
              this.emit(pool[0], { t: 'WHOHOME', from: this.id, ttl: 60 });
              this.state = 1; this.retryAt = TICK;
              return;
            }
            this.forkProbe = true; this.forkAt = TICK; this.forkLastAt = -1; this.forkSamples = [];
            this.forkOpts = new Map(); this.forkPending = 0;
            const order = pool.slice();
            for (let i = order.length - 1; i > 0; i--) { const j = (this.rng() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
            const fan = order.slice(0, Math.min(5, order.length));
            this.forkPending = fan.length;
            this.state = 1; this.retryAt = TICK + 40;
            for (const g of fan) { (this.triedSilent = this.triedSilent || new Set()).add(g); this.emit(g, { t: 'WHOHOME', from: this.id, ttl: 60 }); } // each is silent until its HOME lands — a dark greeter never gets the seat-ask
          }
          // Split-off fragment self-rescue: a seated S1 seat isolated from EVERY
          // rook neighbour for a full strand window, while the pool lists OTHER
          // live greeters, is a duplicate E2 can never reach (it can't phone —
          // occ-gated — or route-probe — no link). The relay re-knock is its one
          // shared channel with the real ring: requeue and rejoin cleanly. The
          // old rule ignored the list even when drowning; this is the exception
          // for when you actually need the life-saver. A lone genesis lists no
          // other greeter, so it never trips.
          if (this.state === 3 && this.coord.pc === 0 && TICK - this.rookSeenAt > STRAND_TTL
              && m.list.some((g) => g != null && g !== this.id)) { this.requeue(); return; }
          this.loneGreet(); // a fragment of one greets the door's seats now, and each beat while it stays alone
          // TWO-RING RECONCILIATION (2026-08-02): the lone-fragment rescue
          // above needs a seat hearing NOBODY — but a churn can rebuild TWO
          // complete home rings in one session (each ring hears its own rook,
          // so neither is "isolated"), a stable split-brain the sweep found
          // at C=2 (three duplicated home cells for 20k ticks). Both rings'
          // greeters share the ONE door: a pool-listed id that appears
          // NOWHERE in my occ is a greeter of a ring I cannot see — greet it.
          // The HELLO carries my coord; if we contest a cell, E2 settles it
          // (lower id wins, the loser requeues through the door into the
          // winning ring), and mutual occ learning cascades the rest. Under a
          // TRUE partition the HELLO is undeliverable, so the two-clean-homes
          // doctrine is untouched. Paced naturally by the E3 re-knock cadence
          // that delivers this reply.
          // …and ONLY from a COMPLETE home view: a stranger in the pool
          // while my C×C home has holes is an ordinary join/churn transient
          // (its seat simply hasn't reached my occ yet), and greeting through
          // those transients perturbed unrelated settling (the compaction
          // repro's lone-row pin). A stranger in the pool while I hold a
          // FULL home is the two-ring signature exactly: there is no seat
          // left it could be sitting in that I cannot see.
          // …and DORMANT until the stranger PERSISTS: a freshly-promoted S1
          // seat reads as a stranger to a stale-but-full view for a beat
          // (S1SYNC catches up well inside one E3 cycle), and greeting
          // through that transient perturbed unrelated settling (the
          // compaction lone-row pin). Only a stranger seen in TWO
          // consecutive E3 replies — hundreds of ticks apart — while my home
          // stays full is a rival ring.
          // …and only from QUIESCENCE (the Q2 hysteresis doctrine): mid-
          // churn a greeter's "full" home view is routinely full of corpses
          // while the pool already lists their replacements — greeting
          // through that window fired 157 times in the compaction shrink
          // scenario and perturbed its pinned settle. A rival ring is a
          // STABLE state: nothing churns, and the strangers persist —
          // exactly what this detector should see.
          if (this.state === 3 && this.coord.pc === 0 && TICK - this.seatedAt > 80 && TICK - this.lastChurn > 300 && TICK - this.healAt > 300) {
            let full = true;
            for (let r = 0; r < C() && full; r++) for (let i = 0; i < C() && full; i++) if (!this.occ.has(ck({ pc: 0, r, i }))) full = false;
            if (full) {
              const known = new Set(this.occ.values());
              const next = new Map();
              for (const g of m.list) if (g != null && g !== this.id && !known.has(g)) {
                const seen = (this.strangeSeen && this.strangeSeen.get(g) || 0) + 1; next.set(g, seen);
                if (seen >= 2) { this.xrOk.set(g, TICK); if (this.xrOk.size > RELAY_CAP) for (const [x, t] of this.xrOk) if (TICK - t > 2 * RELAY_TTL) this.xrOk.delete(x); } // a persistent stranger: its door greeting counts (strangerOk)
                if (seen >= 8) { this.emit(g, { t: 'HELLO', ck: ck(this.coord), id: this.id }); next.delete(g); } // 8 consecutive E3 cycles ≈ 1600-3200 ticks: an order past any legit staleness window (live mates' S1SYNC overwrites a non-first-hand corpse cell within beats), far inside a standoff's lifetime
              }
              this.strangeSeen = next; // ids no longer listed/known drop out
            } else if (this.strangeSeen) this.strangeSeen.clear();
          }
          return;
        }
        case 'WHOHOME': {
          if (!this.hasCoord) { this.emit(m.from, { t: 'HOME' }); return; }
          if (m.ttl <= 0) return;
          if (this.coord.pc === 0) { this.homeFor(m.from); return; }
          const fwd = (x) => { if (x != null && x !== this.id && x !== m.via) { this.emit(x, { t: 'WHOHOME', from: m.from, via: this.id, ttl: m.ttl - 1 }); return true; } return false; };
          if (this.coord.i !== 0) { if (fwd(this.occGet(ck({ pc: this.coord.pc, r: this.coord.r, i: 0 })))) return; } else { if (fwd(this.ownerId())) return; }
          const x = topo.crossLink(this.coord); if (x && fwd(this.occGet(ck(x)))) return;
          const rm = topo.rowMates(this.coord); for (const mate of rm) { const cx = topo.crossLink(mate); if (cx && fwd(this.occGet(ck(cx)))) return; }
          return;
        }
        case 'HOME': {
          if (this.dr && m.from != null && this.dr.ids.includes(m.from) && !(Array.isArray(m.roster) && m.roster.length)) this.dr.bare.add(m.from);   // a door round's answer (doorRound): at the door like me (a seated answer carries its roster and leaves the round incomplete)
          if (this.triedSilent && m.id != null) this.triedSilent.delete(m.id); // it answered — not silent
          if (this.doorAsk && m.id != null) this.doorAsk.delete(m.id);         // ...and not dark (darkGreeters)
          // R5 multi-greeter probe: collect samples; cluster later.
          if (this.forkProbe && this.state === 1 && !this.forkPaused) {
            this.lastReach = TICK;
            if (this.forkPending > 0) this.forkPending--;
            const gk = m.gkey != null ? String(m.gkey) : '';
            if (gk && Array.isArray(m.roster) && m.roster.length && m.roster.length <= C() * C()) { // a sample clusters by its peer ids; a roster longer than the home is no sample
              const faces = (m.roster || []).map((e) => (e && (e.v != null ? e.v : e))).filter(Boolean).map((v) => String(v).slice(0, 12));
              this.forkLastAt = TICK;
              this.forkSamples.push({
                gkey: gk,
                gateway: m.id != null ? m.id : this.gateway,
                roster: m.roster,
                stage: (m.stage || []).map(String),
                stadium: (m.stadium || []).map(String),
                faces,
              });
              // A RELOADED page re-enters the tree it was in: run.html hands the
              // seat its last genesis key and member ids (prevTree). A HOME from
              // that tree (same key, a roster naming one of them) is where this
              // person belongs, whatever another door would say, so it is taken
              // at once instead of waiting FORK_GRACE for doors that may be dark
              // (a reload while one of two doors was dark lost
              // ~6 s there). Any other HOME waits as before. Browser-only:
              // it needs a page reload.
              const pt = this.prevTree;
              if (pt && gk === String(pt.gkey) && Array.isArray(pt.ids) && faces.some((f) => pt.ids.some((id) => String(id).slice(0, 12) === f))) {
                this.prevTree = null;
                const o = this.clusterForkSamples([this.forkSamples[this.forkSamples.length - 1]])[0];
                if (o) { this.acceptFork(o); return; }
              }
            }
            this.maybeResolveFork();
            return;
          }
          // A SEATED seat hears HOME only as the answer to a WHOHOME it sent
          // (drainOrReenter, E1 — re-asked every 40 ticks while it needs one).
          // Unsolicited, the frame is unsigned and names no sender, and it
          // used to re-key the seat (a greeter presenting a wrong genesis key
          // is sealed out of its own door, R3a) and replace its roster.
          if (this.state === 3 && TICK - this.rosterAskAt > 120) return;
          if (m.gkey != null) this.genKey = m.gkey; // learn this meeting's genesis key (the dance)
          if (this.state === 1) { if (!rosterOk(m.roster)) { this.retryAt = TICK - 10; return; } this.roster = m.roster; this.haveRoster = true; this.lastReach = TICK; this.seatTries = 0; this.resumeTries = 0; const t = this.pickRoster(); if (t != null) this.askSeat(t); else this.retryAt = TICK - 10; } // reached a greeter: note it for R6; a landed HOME re-arms the resume budget
          else if (this.state === 3 && rosterOk(m.roster)) {
            this.roster = m.roster; this.haveRoster = true;
            // The home ring as a greeter sees it, as HINTS (never liveness,
            // never over a cell I hear first-hand or hold myself): a deep head
            // asking before it heals a ghost Section-1 owner (tick, knowsRing).
            // ...and a Section-1 seat hearing no rook peer (the fragment of
            // one above: its home view is empty, the ring it asked knows).
            // A standing D5 observation (translost) still bars the install
            // while the cell holds the doubted occupant; a cell the fragment
            // has already confirmed and freed takes the ring's tenant (the
            // ring lists no corpse: s1Roster omits its own translost cells).
            // The lone seat takes only its own row and column (the seats it
            // links to and that arbitrate it) and only FREE cells; the rest of
            // the rival ring's roster perturbed a two-ring merge.
            // An installed hint drops the cell's old stamp: it is not
            // first-hand live (checked above), so the stamp is the OLD
            // occupant's, and rowSweep forgot the new tenant on it the next
            // tick — after a dark spot (absence aged the stamps) the lone seat
            // asked again 40 ticks later (preset 14a: 31 s to settle). The
            // lone seat then greets its new rook at once (announce): the
            // tenant's arbitration (YIELD) needs a frame from me to judge.
            { const lone = this.coord.pc === 0 && !this.hearRook(); let put = 0;
            if (this.hasCoord && ((this.coord.pc !== 0 && this.coord.i === 0) || lone)) for (const e of m.roster.slice(0, C() * C())) { if (!s1KeyOk(e.k) || e.v === this.id || this.firstHandLive(e.k) || (this.translost.has(e.k) && !(lone && this.occGet(e.k) == null)) || (lone && !this.ownedLinkCell(e.k))) continue; if (this.occGet(e.k) !== e.v && !this.liveElsewhere(e.v, e.k) && (this.occGet(e.k) == null || (lone ? (!!this.rival && this.occGet(e.k) === this.rival.id && !this.heardAt(e.k, this.occGet(e.k))) : !this.heardAt(e.k, this.occGet(e.k))))) { this.live.delete(e.k); this.liveBy.delete(e.k); this.setOcc(e.k, e.v); this.noteS1(e.k); put++; } }
            if (put && lone) this.announce(); }   // the lone seat fills FREE cells, and the stale hint of the RIVAL itself (the seat that, by its own word, now holds my cell)
          }
          return;
        }
        case 'FIND': if (m.tag === 1) this.serveCompact(m); else { this.noteKnock(m.nc); this.findNc = m.nc; try { this.serveFind(m); } finally { this.findNc = null; } } return; // Q2: tag==1 is a compaction probe (up-chain walk), never newcomer admission. Untagged: the seeker is at the door for the whole scan (knock-is-evidence phantom scope — 03c)
        case 'FINDACK': if (this.state === 2 && m.nc === this.id && m.from === this.lastAsked && this.findAckAt < 0) this.findAckAt = TICK; return; // the seeker's own greeter handed my FIND on (only the first hop: the seeker knows nobody further down)
        case 'FINDLEAF': if (!this.verifyFill(m)) return; this.findLeaf(m.hole, m.nbrs, m.ttl); return; // S4 identity hook gates fill authorship
        case 'PLACE':
          if (this.state === 2 && this.verifyFill(m)) { this.take(m.coord, m.owner, m.nbrs, m.pp); if (this.pp && m.s4from != null && m.s4from !== this.id) this.admBy = m.s4from; return; } // S4 identity hook; admBy: the verified signer of the PLACE that seated me (arbOk)
          // Q2: a compaction PLACE for a seated leaf — atomically MOVE (law T
          // dual-hold) into the shallower cell, keeping the old seat warm until
          // confirm. Re-validate at the moment of action (the frontier may have
          // shifted while the PLACE routed): I am the named seeker, still a
          // trailing leaf, not already moving, STRICTLY shallower — else drop and
          // let the next probe retry. A contested destination is caught by E2 →
          // rollbackMove (never homeless).
          if (this.state === 3 && m.tag === 1 && m.nc === this.id && this.verifyFill(m)
              && this.hasCoord && !this.moving && !this.hasChildren()
              && topo.pcDepth(m.coord.pc) < topo.pcDepth(this.coord.pc) && !this.firstHandLive(ck(m.coord))) {
            let trailing = true; for (let j = this.coord.i + 1; j < C(); j++) if (this.occGet(ck({ pc: this.coord.pc, r: this.coord.r, i: j })) != null) { trailing = false; break; }
            if (trailing) { this.compactMoves++; this.doMove(m.coord, m.owner, m.nbrs, m.pp); }
          }
          return;
        // The refusal lifts the silent mark for its AUTHOR (m.id) and for the
        // target I ASKED (lastAsked): a descending FIND is answered by a
        // descendant, and erasing only the author left every successfully-
        // FORWARDING admitter permanently marked — join-storm retries then
        // scattered away from the funnel and deep sections filled row 1 before
        // row 0 (H7 dense-fill broken; sim hchain E + c-sweep, 2026-07-29). A
        // corpse answers NOTHING, so its mark stands — corpse-avoid untouched.
        case 'NOROOM': if (this.state === 2) { if ((m.nd | 0) >= SPREAD_MINDEPTH) this.noroomSeen++; if (this.triedSilent && m.id != null) this.triedSilent.delete(m.id); if (this.triedSilent && this.lastAsked != null) this.triedSilent.delete(this.lastAsked); this.retryAt = TICK; if (this.haveRoster && this.roster.length && ++this.seatTries <= 6) { const t = this.pickRoster(); if (t != null) { this.askSeat(t); return; } } this.seatTries = 0; this.join(); } return;
        case 'HELLO': {
          // A HELLO is FIRST-HAND: its sender (m.id) is speaking on a link it
          // holds to me, claiming coord m.ck — it sets first-hand liveness.
          // FRAME AUTHORITY: it is S4-signed (the wire drops a bad one), so m.id
          // is its author — but the CELL is the author's word. It must be a
          // cell I have a relation to (mine, an owned link, my owner's, my
          // vouch for this id); a claim on any other cell is nobody's business
          // here (one signed member used to fill a greeter's whole home).
          if (m.id == null || !cellKeyOk(m.ck)) return;
          const sure = this.linkIs(m, m.id);
          // TWO RINGS: a rival ring's greeter reaches me only through the door
          // (no link: our rings share none). Its greeting about a Section-1
          // cell is taken as main took it when MY home has listed that greeter
          // as a stranger in two consecutive E3 replies (strangerOk) — the
          // two-ring signature, measured on my own side.
          const xrS = this.hasCoord && this.state === 3 && this.coord.pc === 0 && isS1key(m.ck) && this.strangerOk(m.id);
          const xr = !sure && xrS;
          if (!xr && !this.claimRel(m.ck, m.id, false)) return;
          const ppn = this.ppValid(m); if (ppn) this.ppNote(m.ck, m.id, m.pp.sig, m.ppfrom);   // PP: a verified placement proof for this claim
          else if (m.ppok === undefined && m.pp && m.pp.sig != null) this.ppNote(m.ck, m.id, m.pp.sig, null, m.pp);   // ...or one the wire left for later (no decision needed it yet)
          if (this.hasCoord && this.state === 3 && m.ck === ck(this.coord) && m.id !== this.id) {
            // A rival for MY cell. Only Section 1 is settled by challenge (two
            // rings sharing one door, healing-laws R5) — a deep cell is settled
            // by its one arbiter, my phone target. A rival first-hand live at
            // another cell in my view is in two places: not a rival. A LOWER id
            // is challenged (its CONFIRM may unseat me); a HIGHER one is never
            // written into my own seat — it gets my HELLO, so it can challenge
            // me in turn (lower id wins either way).
            // Over the claimant's own authenticated link (a healer or mover
            // stepping into my cell) the claim is first-hand and is challenged
            // as before. Unproven (relay / sponsor: any member, sec finding
            // X3) it starts a challenge only for a seat no arbiter can settle
            // (the genesis race of two doors: I hear no rook peer) and only
            // from a claimant my view places at no other cell.
            // TENURE: a claim on the cell of a settled seat that hears its rook
            // peers is no contest of mine — those arbiters hear me as the
            // incumbent and YIELD the claimant (law S2). A challenge starts
            // only while I am FRESH (a race among newcomers), while no arbiter
            // can settle it (I hear no rook peer: the genesis race of two
            // doors), or from a persistent stranger (two rings). Any member
            // can open a DataChannel to me, so a link alone is no standing.
            // THE RIVAL'S WORD IS PROBED, NOT TAKEN (behavior 14a, repro-adversary):
            // a seat my view holds first-hand at ANOTHER cell, whose link proved
            // it there, now claims my cell over that link. Honest case: its
            // LEAVE(mvd) crossed while my radio was dark and my held clock kept
            // its stamps fresh. Hostile case: it sits at its cell and lies.
            // So its claim opens a D5 observation on its OLD cell (a probe
            // around the link, as a transport loss does): a seat still there
            // answers and the claim is ignored (two places); an unanswered
            // probe confirms the move (tick: movedClaim) and only THEN is it
            // my rival, asked for the ring over the channel it spoke on.
            // Ending its liveness on the claim alone let a low-id hostile make
            // me hear no rook, challenge it, and requeue on its CONFIRM
            // (repro-adversary: 49 of 300 honest seats unseated).
            if (sure && !(this.movedClaim && this.movedClaim.id === m.id)) for (const [k2, v2] of this.occ) { if (v2 !== m.id || k2 === m.ck || !this.firstHandLive(k2) || this.linkedBy.get(k2) !== m.id) continue; if (!this.translost.has(k2)) { this.translost.set(k2, TICK); this.tlProbeAt.set(k2, TICK); this.routeToProbe(unck(k2)); } this.movedClaim = { id: m.id, k: k2, at: TICK, m }; break; }
            if (this.coord.pc !== 0 || this.liveElsewhereSinceReturn(m.id, m.ck)) { this.rivalWhy = this.coord.pc !== 0 ? 'deep' : 'live-elsewhere'; return; }
            // A FRAGMENT OF ONE MEETS THE RING (behavior 14a: a row head
            // back from a dead spot after its row-mate healed into its cell
            // and admitted a newcomer). A Section-1 seat that hears no rook
            // peer, told over a proven link that another seat holds its cell,
            // asks that seat for the home ring: HOME installs the ring as
            // hints (below), the hints link it to its row-mates, and their
            // arbitration (YIELD) settles the duplicate. Without the ask the
            // two cannot settle each other: the tenured seat answers only its
            // arbiters, the lone seat hears none, and a lower-id lone seat
            // waited out STRAND_TTL (250 s) at a duplicate head cell.
            // Only a seat that has heard no rook peer for OWNER_SILENT ticks asks:
            // a seat whose rook links are a beat behind mid-merge (two-ring
            // reunion) is not a fragment, and asking there slowed the merge
            // (two-ring.js seed 1: 2072 ticks against 600).
            // The rival is remembered (rival) and tick() asks once the silence
            // is established, so a HELLO that arrives while the dead row-mate's
            // liveness has not yet lapsed is not lost. (A claimant I hear
            // first-hand elsewhere returned above; it becomes my rival only
            // when its move is confirmed — movedClaim in tick.)
            if (sure) { this.rival = { id: m.id, at: TICK }; this.loneAsk(); }
            // A tenured incumbent answers EVERY link-proven rival with its own
            // HELLO, whatever the rival's id (before: only a higher id, which
            // may challenge me). A lower-id rival that hears no rook peer (the
            // returning head of behavior 14a) can neither be challenged nor
            // YIELDed until it learns the ring; my HELLO is the statement
            // that lets it ask (loneAsk -> WHOHOME -> HOME -> its row-mate's
            // YIELD). One frame per 20 ticks; it evicts nobody.
            if (!(xrS || this.fresh() || !this.hearRook())) { this.rivalWhy = 'tenured-hears-rook' + (TICK - this.challAt > 20 ? '' : ':paced@' + this.challAt); if (sure && TICK - this.challAt > 20) { this.challAt = TICK; this.emit(m.id, { t: 'HELLO', ck: m.ck, id: this.id }); } return; }
            if (!sure && !xr) { for (const [k2, v2] of this.occ) if (v2 === m.id && k2 !== m.ck) return; }
            // PP (§AUTH): a rival contests my cell only with a placement proof
            // for it whose admitter my view admits here. The one exception is
            // the genesis race of two doors: I hold no proof myself (I minted
            // my seat) and hear no rook peer, so nobody can settle it but us.
            // ...and a rival whose claim carries no proof my view admits is
            // ANSWERED before it is refused: my HELLO is a statement, not an
            // eviction, and a lone rival learns of the contest only from it.
            if (!(ppn && this.ppAdm(m.ck, m.ppfrom, m.id)) && !(this.pp == null && !this.hearRook())) { this.rivalWhy = 'no-admitted-proof' + (ppn ? '' : ':none') + (this.pp == null ? '' : ':i-hold-one') + (TICK - this.challAt > 20 ? '' : ':paced@' + this.challAt); if (sure && TICK - this.challAt > 20) { this.challAt = TICK; this.emit(m.id, { t: 'HELLO', ck: m.ck, id: this.id }); } return; }
            this.rivalWhy = TICK - this.challAt > 20 ? (m.id < this.id ? 'challenge' : 'answer') : 'paced@' + this.challAt;
            if (TICK - this.challAt > 20) {
              this.challAt = TICK;
              if (m.id < this.id) { this.challTo = { id: m.id, ck: m.ck, at: TICK }; this.emit(m.id, { t: 'CHALLENGE', ck: m.ck, from: this.id }); }
              else this.emit(m.id, { t: 'HELLO', ck: m.ck, id: this.id });
            }
            return;
          }
          const prev = this.occGet(m.ck);
          // E2: yield only between FIRST-HAND-LIVE claimants. A prev that is
          // only gossip (a phantom) is NOT first-hand live ⇒ no yield ⇒ the
          // real sender is accepted (bug #1). D5: an unanswered transport loss
          // ends my first-hand hearing of prev, so it no longer counts fresh.
          const prevFresh = prev != null && prev !== m.id && this.holdsCell(m.ck, 60);
          if (!sure && !xr) {
            // UNPROVEN (relay / sponsor: a newcomer whose channels are still
            // opening, or anyone). It never displaces a live incumbent: a
            // higher-id rival is YIELDed as E2 would, a lower one is ignored
            // until it speaks over a link. It may teach a FREE cell, as a hint.
            // ...and a lower one is REMEMBERED (waitClaim): when the incumbent's
            // goodbye frees the cell, the waiting claimant is installed as the
            // hint an unproven claim on a free cell is. Freed bare, the cell
            // was admitted to the next FIND — the incumbent itself, requeued
            // after losing that very cell to the claimant (chaos seed 12 #6:
            // Pia back from 35 s dark at 0/0.1, Dev had left-packed there; the
            // head freed it on Dev's LEAVE and re-placed Dev into it — 31 s).
            if (prev != null && prev !== m.id && prevFresh) { if (m.id > prev) this.emit(m.id, { t: 'YIELD', ck: m.ck, id: this.id }); else { const w = this.waitClaim; if (w.size >= 32) w.delete(w.keys().next().value); w.set(m.ck, { id: m.id, at: TICK }); } return; }
            if (prev !== m.id && this.hintClaim(m.ck, m.id)) { if (this.hasCoord) this.emit(m.id, { t: 'HELLO', ck: ck(this.coord), id: this.id }); this._gspReplay(m.id); }
            { const sit = this.sitting.get(m.ck); if (sit && sit.joiner === m.id) this.clearSoft(m.ck); }
            return;
          }
          // TENURE (law S2): a tenured incumbent I hear here beats a raw claim,
          // whatever its id; the claimant yields and is never installed. A
          // claim whose proof is still being checked waits for its next beat.
          if (prevFresh && this.ppPending(m.ck, m.id)) return;
          if (prevFresh && this.rawClaim(m.ck, m.id, 60)) { this.emit(m.id, { t: 'YIELD', ck: m.ck, id: this.id }); return; }
          if (sure && this.ownedLinkCell(m.ck)) this.nbrHeard();
          if (prev != null && prev !== m.id && prevFresh && this.liveElsewhere(m.id, m.ck)) { if (m.id > prev) this.emit(m.id, { t: 'YIELD', ck: m.ck, id: this.id }); return; } // a seat is in ONE place: a claimant live at another cell does not displace a live incumbent
          if (prev != null && prev !== m.id && prevFresh) this.emit(m.id > prev ? m.id : prev, { t: 'YIELD', ck: m.ck, id: this.id }); // two live seats at one coord: lower id wins, higher yields
          // ...and the YIELDed claimant is not written over the incumbent it
          // lost to. Installed, its goodbye after the requeue freed the cell
          // in my view while the incumbent still sat there, and my next FIND
          // admitted the loser straight back into it — a duplicate (chaos
          // seed 14 #4: Wren back from 35 s dark at 0/0.1, Uma left-packed
          // there; the head YIELDed Wren, took her LEAVE as the cell's, and
          // re-placed her at 0/0.1 twice: 31.4 s). Nor is its frame the
          // incumbent's hearing (liveMark would credit it to the occupant).
          if (prev != null && prev !== m.id && prevFresh && m.id > prev) return;
          if (prev !== m.id) { this.setOcc(m.ck, m.id); if (this.hasCoord) this.emit(m.id, { t: 'HELLO', ck: ck(this.coord), id: this.id }); this._gspReplay(m.id); }
          this.liveMark(m.ck); // first-hand: I just heard m.id directly at m.ck
          if (sure) this.noteLinked(m.ck, m.id, m.tn);
          this.noteS1(m.ck);
          // A, ATTRIBUTABLE (V4): only THE SOFT-SIT JOINER's own HELLO
          // self-confirms — a rival claimant or a promoted healer announcing
          // must not wipe a vouch it does not own (the wipe plus a LEAVE echo
          // read the cell FREE and the same head re-placed it every ~3 ticks).
          { const sit = this.sitting.get(m.ck); if (sit && sit.joiner === m.id) this.clearSoft(m.ck); }
          return;
        }
        // YIELD: "you and another claim your cell; you lost." Honoured only
        // from my ARBITER (arbiterIs: heard first-hand and link-proven at its
        // cell) and only when S4-signed by that arbiter (id). The transport's
        // word is not enough for an eviction (provenEv).
        case 'YIELD': {
          if (!this.hasCoord || this.state !== 3 || ck(this.coord) !== m.ck) return;
          const by = m.id;
          if (by == null || by === this.id || !this.provenEv(m, by)) return;
          // A MOVER in dual-hold only rolls back (it keeps its old seat), so any
          // proven seat at one of its new owned links may contradict the claim,
          // as before; a seated seat is unseated only by its arbiter, and a
          // settled seat only by an arbiter that was its neighbour when it sat
          // down (arbOk: FRESH — a member that turns up at a free cell next to
          // me later may not unseat me, sec finding R3).
          let mayYield = this.arbOk(by);
          if (!mayYield && this.moving) for (const olc of topo.ownedLinks(this.coord)) if (this.occGet(ck(olc)) === by) { mayYield = true; break; }
          // TWO later arbiters agreeing is the other half of a healed split:
          // when a partition heals, the far side's arbiters are new to me,
          // and each of them hears my rival as its tenured incumbent. Two of
          // them, at two different arbiter cells, YIELDing me within 40 ticks
          // is that picture (one poser is not; two are two identities).
          if (!mayYield) { const ak = this.arbCellOf(by); if (ak != null) mayYield = this.lateQuorum(by, ak, m.ck); }
          // ...or its placement proof is still being verified (the wire checks a
          // carried proof lazily; behavior 14a: the row-mate's one YIELD of the
          // returning head landed a beat before its proof's verdict and was
          // dropped, and it never had cause to YIELD again). tick() re-reads
          // arbOk for PEND_Y ticks.
          if (!mayYield) { const ak = this.arbCellOf(by); this.yieldWhy = 'refused:arb=' + (ak == null ? 'none' : ak) + (this.fresh() ? ':fresh' : '') + ':ls=' + (ak != null && this.linkedSince.has(ak) ? this.linkedSince.get(ak) - this.estAt : '-') + ':adm=' + (this.admBy == null ? '-' : String(this.admBy).slice(0, 6)) + (this.rival ? ':rival=' + String(this.rival.id).slice(0, 6) : ''); if (!this.arbiterIs(by) || (ak != null && this.ppPending(ak, by))) { this.pendY = { by, at: TICK, ck: m.ck }; this.yieldWhy += ':pending'; } return; } // not (yet) heard: its hearing PONG may be a tick behind
          // ONE arbiter's word is enough, on purpose: a contest is often seen
          // by a single arbiter (an asymmetric partition — a newcomer reaches
          // a seat its old neighbours cannot). Requiring two left that
          // duplicate standing forever (repro-adversary's dark seat, measured
          // 2026-10-03). So a hostile arbiter can YIELD the seats it arbitrates
          // — its own links, law S — and nothing beyond them.
          this.yieldWhy = 'yielded';
          if (this.moving) this.rollbackMove(); else this.requeue(); // T1: a mover contradicted at its NEW cell goes home, not homeless
          return;
        }
        case 'CLAIM': {
          if (!this.verifyFill(m) || m.id == null || !cellKeyOk(m.ck)) return;
          if (this.ppValid(m)) this.ppNote(m.ck, m.id, m.pp.sig, m.ppfrom);   // PP: a verified placement proof for this claim
          else if (m.ppok === undefined && m.pp && m.pp.sig != null) this.ppNote(m.ck, m.id, m.pp.sig, null, m.pp);
          // A: joiner self-confirm — upgrade sitting-down → seated. My own
          // vouch for exactly this joiner at exactly this cell is the
          // admitter's word, whatever path the CLAIM took.
          const sit = this.sitting.get(m.ck);
          if (sit && sit.joiner === m.id) { this.confirmSeated(m.ck, m.id); return; }
          // Otherwise the cell must be one I relate to (my child row counts: I
          // admit into it), never my own seat; over a link it is first-hand,
          // unproven it may only teach a free cell.
          if (this.hasCoord && m.ck === ck(this.coord)) return;
          if (!this.claimRel(m.ck, m.id, true)) return;
          // A healer's claim (PP: it asks its hole's admitter for a proof) while
          // my vouch for ANOTHER seat at that cell stands is a rival claim, not
          // a confirmation: it is heard as a HELLO would be and granted nothing
          // (confirmSeated would wipe the vouch — the V4 same-admitter re-place).
          if (this.linkIs(m, m.id)) { if (this.holdsCell(m.ck, 60) && this.ppPending(m.ck, m.id)) return; if (!this.rawClaim(m.ck, m.id, 60)) { const sit2 = this.sitting.get(m.ck); if (sit2 && sit2.joiner !== m.id) { this.setOcc(m.ck, m.id); this.liveMark(m.ck); this.noteS1(m.ck); } else this.confirmSeated(m.ck, m.id); } } // a tenured incumbent I hear there is never displaced by a claim (law S2)
          else this.hintClaim(m.ck, m.id);
          return;
        }
        case 'LEAVE': {
          // FRAME AUTHORITY: a goodbye frees the LEAVER'S OWN cell, so it must
          // be the leaver speaking: S4-signed (the statement covers `mvd` and
          // the tenancy `tn`, so a carrier cannot re-point it). A LEAVE in
          // anyone else's name used to free a live seat at every neighbour and
          // start a left-pack heal into it.
          if (m.id == null || !cellKeyOk(m.ck) || (m.mvd != null && !cellKeyOk(m.mvd)) || !this.provenEv(m, m.id)) return;
          this.lastChurn = TICK; // Q2 hysteresis: a departure near me — hold off compaction until quiescent
          // TENANCY (R5): a goodbye frees only the tenancy it was signed for.
          // When a link told me x's tenancy at this cell, the LEAVE must name
          // it; when none did, it must be said NOW (mesh-wire goodbyeLive, on the signer's clock) — a
          // captured goodbye replayed after x took the same cell again is
          // old news either way.
          const ten = this.tenOf.get(m.ck);
          const tenOk = (ten && ten.id === m.id) ? (m.tn != null && String(m.tn) === ten.tn) : m.s4live === true;
          const mine = this.occGet(m.ck) === m.id && tenOk;
          // WHERE it went (`mvd`) is taken only from a stay a LINK proved, with
          // that stay's nonce, about a cell I relate to that no other seat I
          // hear holds, and never my own: a relay-only member that planted
          // itself by gossip used to write itself into an honest rook peer's
          // cell this way (sec finding Y1/Y2), or into mine (Y4), or grow my
          // occ without bound with fresh deep cells (Y3).
          const mvdFrom = mine && m.mvd != null && !!ten && ten.id === m.id && m.tn != null && String(m.tn) === ten.tn && this.linkedBy.get(m.ck) === m.id && this.mvdOk(m.ck, m.mvd, m.id);
          if (mvdFrom) this.carryLinked(m.ck, m.mvd, m.id);
          if (mine) { this.linkedBy.delete(m.ck); this.tenOf.delete(m.ck); this.occ.delete(m.ck); this.live.delete(m.ck); this.kidful.delete(m.ck); this.s1seen.delete(m.ck); this.tlForget(m.ck, 'leave'); this.healTry.delete(m.ck); this.digForget(m.ck); } // freed ⇒ admissible now
          // ...unless a claimant was waiting on it (waitClaim, the HELLO branch): it is the cell's hint now
          if (mine) { const w = this.waitClaim.get(m.ck); if (w) { this.waitClaim.delete(m.ck); if (w.id !== m.id && TICK - w.at <= 20) this.hintClaim(m.ck, w.id); } }
          // A, ATTRIBUTABLE (V4): only the LEAVER'S OWN vouch clears — a soft
          // sit exists only for a cell that read FREE at admit time, so a
          // LEAVE naming this cell from anyone else is a PRIOR tenant's
          // departure echo arriving after the cell was re-vouched.
          { const sit = this.sitting.get(m.ck); if (sit && sit.joiner === m.id) this.clearSoft(m.ck); }
          if (mvdFrom) { this.setOcc(m.mvd, m.id); this.noteS1(m.mvd); } // T3: the goodbye says WHERE it went — a routing hint (never liveness)
          // A goodbye about a cell somebody ELSE holds in my view frees nothing.
          // It may still start the left-pack heal — my view can be stale (the
          // holder I see left without my hearing, and the leaver sat there
          // since) — but only when the goodbye is being said NOW (over the
          // leaver's own link, or said now by its signature: a captured goodbye
          // replayed later is old news) and the holder I see is not one I hear
          // first-hand. Main healed on any goodbye: a replay or a bogus one
          // left-packed into a live seat (forged-frames.js A9).
          if (this.occGet(m.ck) != null && (this.firstHandLive(m.ck) || m.s4live !== true)) return;
          if (!tenOk) return;
          // PROBE-GATED (§AUTH, R7): a goodbye about a cell somebody ELSE
          // holds in my view heals only after a nonced probe of that holder
          // goes unanswered (authTick: gbProbe, 2 x EARLY_HOLD). A member's own
          // live goodbye naming a deep row cell it never held used to start a
          // left-pack move at a row-mate that did not hear the real holder.
          if (this.occGet(m.ck) != null) { if (HEALING && this.hasCoord && this.state === 3 && !this.gbProbe.has(m.ck)) { this.gbProbe.set(m.ck, { at: TICK, holder: this.occGet(m.ck) }); this.routeTo(unck(m.ck), 2); } return; }
          this.goodbyeHeal(m.ck);
          return;
        }
        case 'GREETWALK': return; // H6 retired
        case 'S1SYNC': {
          // Section-1 gossip names Section-1 cells, at most one entry per cell
          // (s1Sync sends C^2 at most); anything else is a malformed or hostile
          // frame and is dropped whole.
          if (!Array.isArray(m.ent) || m.ent.length > C() * C() || (m.digs != null && (!Array.isArray(m.digs) || m.digs.length > C() * C()))) return;
          if (m.dw) this._dwTake(m.from, m.dw);
          // § G root fold: merge the relayed section table, the FRESHEST ON MY
          // CLOCK wins (G0b relative ages). Purely additive display state — it
          // touches nothing below this block.
          if (this.digOn() && this.hasCoord && this.coord.pc === 0 && m.digs) {
            for (const e of m.digs) {
              if (!e || !s1KeyOk(e.k)) continue;
              if (this.hasCoord && e.k === ck(this.coord)) continue; // never take a relayed claim about MY OWN section — I fold that first-hand
              if (!e.d) continue;
              const ed = e.d.stub === 1 ? this.stubTake(Object.assign({}, e.d, { from_: m.from, slot_: 's1:' + e.k }), this.s1tab.get(e.k)) : digSane(e.d); if (!ed || ed.at < 0) continue;
              if (e.d.stub !== 1) this.rxDig(ed);
              if (this.LT() - ed.rx > DIG_TTL) continue;
              this.s1Take(e.k, ed);
            }
          }
          // GOSSIP updates the ROSTER HINT (occ/s1seen) only — it NEVER evicts
          // a seat, NEVER sets `live`, and NEVER overwrites a cell I hold
          // FIRST-HAND. (E2: gossip may inform routing, but liveness is
          // first-hand only. The old gossip-requeue and gossip-YIELD were
          // phantom weapons — a stale echo could evict a live seat. Bug #1.)
          for (const e of m.ent) {
            if (!e || !s1KeyOk(e.k) || e.v == null) continue;
            const kk = e.k, eid = e.v, age = e.age;
            if (e.ch != null) this.childOf.set(kk, e.ch); // learn this cell's heir — feeds cousins-in-PONG
            if (this.hasCoord && kk === ck(this.coord) && eid !== this.id) continue; // gossip claims MY seat: IGNORE — a genuine duplicate is settled by a first-hand witness, never an echo
            if (this.firstHandLive(kk)) continue; // I have first-hand truth here — gossip can't resurrect a moved/dead occupant over it
            if (this.translost.has(kk)) continue; // D5: my standing first-hand observation (transport died, probe unanswered) outranks an echo — gossip must not re-seat the corpse; any answer or a genuine refill clears the observation and gossip resumes
            if (this.liveElsewhere(eid, kk)) continue; // A SEAT IS IN ONE PLACE, and I hear this one first-hand at another cell: an echo never plants it beside itself (behavior 14a: a returning head's stale table listed the real head one cell over, and its row-mate carried two cells for the same seat until the hint aged out)
            const seen = TICK - age - 2; const cur = this.occGet(kk); const curSeen = this.s1seen.has(kk) ? this.s1seen.get(kk) : -999;
            // CLAIM BIRTH (2026-08-02): the ±8 lower-id tie-break exists to
            // resolve SIMULTANEOUS claims, but the freshness stamps it
            // compares are hop-laundered — max(curSeen, seen) lets a
            // displacing entry inherit the displaced occupant's freshness,
            // so a join-era ghost claim re-won ties FOREVER (an immortal
            // gossip echo that, when a sever opened a first-hand gap at one
            // arbiter, evicted a live seat — mesh-harness D5-sever). Honest
            // hop-ages broke legit races instead (a tie-win stored stale
            // went phantom and double-admitted: c-sweep dups). The
            // launder-proof signal is END-TO-END: every entry carries its
            // CLAIM BIRTH — when its (cell → claimant) pairing was first
            // established — and a claim BORN more than 600 ticks ago may never
            // win a tie. A ghost's birth is ancient by definition; every legit
            // contender's is recent. The birth crosses a link as an AGE (`ba`)
            // re-stamped on each holder's own clock (G0b): every page counts
            // ticks from its own load, and the absolute `b` this replaced made
            // every ghost look newborn to a young page and every contender
            // ancient to an old one. An old client's `b` is ignored (unknown).
            const ba = Number.isInteger(e.ba) && e.ba >= 0 ? Math.min(e.ba, 1 << 20) : -1;
            const eb = ba >= 0 ? this.LT() - ba : -1;
            // A TIE-WIN KEEPS ITS OWN FRESHNESS (sim twin). max(curSeen, seen)
            // handed the lower-id winner the freshness of the entry it
            // displaced: a dead root's claim, restored from a healer's held
            // view by a rollback, came back as fresh as the live root at every
            // seat not linked to the cell, won the tie by its lower id, was
            // re-gossiped at that laundered age and rode the rook for 600
            // ticks — 9 to 13 of 24 home seats listing the corpse at any tick
            // (forged-frames Y5, Section 1: a watcher re-seated deep kept it
            // by phase). With the entry's own freshness kept, every hop ages
            // the echo and the first-hand root outruns it within a few beats.
            let took = false;
            if (seen > curSeen + 8 || (seen >= curSeen - 8 && cur != null && eid < cur && (ba < 0 || ba <= 600))) { this.s1seen.set(kk, seen); took = true; if (cur !== eid) { this.setOcc(kk, eid); this.born.set(kk, ba >= 0 ? eb : this.LT()); } }
            else if (cur == null && seen > -999) { this.s1seen.set(kk, seen); this.setOcc(kk, eid); this.born.set(kk, ba >= 0 ? eb : this.LT()); took = true; }
            // A SEAT IS IN ONE PLACE (sim twin): the entry I just took is the
            // newest word on where eid sits, so an OLDER hint of eid at another
            // home cell I do not hear first-hand is the cell it left. With the
            // tie-win's freshness no longer laundered, such a hint was never
            // refreshed and never replaced: two home cells read as held by a
            // seat every arbiter also listed at its real cell, no healer's leaf
            // could land, and a reunited split ended two home seats short
            // (two-ring seed 1, 23/25 for 4,000 ticks).
            if (took) for (const [k2, v2] of this.occ) { if (k2 === kk || v2 !== eid || !isS1key(k2) || this.firstHandLive(k2) || this.translost.has(k2)) continue; const s2 = this.s1seen.has(k2) ? this.s1seen.get(k2) : -999; if (s2 < seen) { this.occ.delete(k2); this.s1seen.delete(k2); this.kidful.delete(k2); this.tlForget(k2, 'moved-by-gossip'); } }
          }
          return;
        }
        case 'DRAIN': {
          // E1: a DRAIN dissolves my whole subtree, so it is honoured from ONE
          // author — my ANCHOR (the occupant of my owner cell), the only seat
          // the law lets fan it down. The frame is S4-signed and `id` is bound
          // to the signer (verifyFill), so a row-mate or a sponsor-forwarded
          // stranger cannot wear the anchor's name.
          if (!this.verifyFill(m)) return;
          if (!this.hasCoord || this.state !== 3 || this.coord.pc === 0 || this.drainAt) return;
          const oc = this.ownerCoord(); if (!oc || m.id == null || this.occGet(ck(oc)) !== m.id) return;
          if (!rosterOk(m.roster)) return;
          this.roster = m.roster; this.haveRoster = true; const rc = this.rosterCells(); for (let c = 0; c < C(); c++) { const x = this.occGet(ck(rc[c])); if (x != null && x !== this.id) this.emit(x, { t: 'DRAIN', roster: m.roster, id: this.id }); } this.drainAt = TICK + 6 + (this.rng() * 12 | 0); this.wake(); return;
        }
        case 'CHALLENGE': if (this.evil) { this.emit(m.from, { t: 'CONFIRM', ck: m.ck, id: this.id }); return; } if (this.hasCoord && this.state === 3 && ck(this.coord) === m.ck) this.emit(m.from, { t: 'CONFIRM', ck: m.ck, id: this.id }); return;
        // CONFIRM: the answer to MY CHALLENGE — "I hold your cell too, and my
        // id is lower." Honoured only from the very rival I challenged, for
        // that cell, within 40 ticks, when it is proven the sender, and not
        // while it is first-hand live at another cell in my view. Unsolicited,
        // it used to unseat anyone with a higher id than the one it named.
        case 'CONFIRM': {
          const ch = this.challTo;
          if (!this.hasCoord || this.state !== 3 || ck(this.coord) !== m.ck || m.id == null || m.id === this.id || !(m.id < this.id)) return;
          if (!ch || ch.id !== m.id || ch.ck !== m.ck || TICK - ch.at > 40 || !this.provenEv(m, m.id) || this.liveElsewhereSinceReturn(m.id, m.ck)) return;   // (the same rule as the rival branch that sent the CHALLENGE)
          this.challTo = null;
          if (this.moving) this.rollbackMove(); else this.requeue();
          return;
        }
        case 'GSP': case 'GSPS': this._gspRecv(m); return;
        case 'PP': {
          // PP (§AUTH): my admitter's signed placement proof for the cell I
          // hold (granted on my CLAIM: a healer or mover has no PLACE to
          // carry one). Verified by the wire (s4ok; s4from = the signer); a
          // proof from a seat my view does not admit here replaces nothing.
          if (!this.verifyFill(m) || m.id !== this.id || !m.coord || !this.hasCoord || this.state !== 3 || ck(m.coord) !== ck(this.coord) || m.s4from == null || m.s4from === this.id || !m.s4 || m.s4.sig == null) return;
          if (this.pp != null && !this.ppAdm(ck(m.coord), m.s4from, this.id)) return;
          this.pp = { ck: ck(m.coord), s4: m.s4 }; this.admBy = m.s4from; return;
        }
        case 'MOVED': { // T3: the cell I phoned was vacated by a MOVE — first-hand vacancy + redirect, right now
          // FRAME AUTHORITY: the mover's own S4-signed word (`mvd` inside the
          // statement), about a cell I phone (an owned link) that I hold the
          // mover at; otherwise it frees nothing and plants nothing.
          if (m.id == null || !cellKeyOk(m.ck) || (m.mvd != null && !cellKeyOk(m.mvd)) || !this.provenEv(m, m.id)) return;
          if (!this.ownedLinkCell(m.ck) || this.occGet(m.ck) !== m.id) return;
          const mvdFrom = m.mvd != null && this.linkedBy.get(m.ck) === m.id && this.mvdOk(m.ck, m.mvd, m.id);   // see LEAVE: a link-proven stay, a related cell nobody I hear holds
          if (mvdFrom) this.carryLinked(m.ck, m.mvd, m.id);
          // ...and a link-proven mover WAS at the cell it left (wasAt), as when
          // its successor's link replaces it there: the cell's next seat may
          // hold a proof it signed (ppAdm's rival clause). A
          // head frozen 20 s; its row-mate healed into the head cell and moved
          // the third seat into the cell it left. That seat's YIELD was the
          // only arbiter word the frozen head would get, and its proof's
          // signer had been erased from the cell here: never.
          if (this.linkedBy.get(m.ck) === m.id) this.wasLinked(m.ck, m.id);
          this.linkedBy.delete(m.ck); this.tenOf.delete(m.ck);
          // ...and a standing D5 observation of the cell ENDS here, as a LEAVE
          // ends it: the mover answered the probe. Left standing, the app
          // read the freed cell plus the record as a probe-confirmed DEATH
          // (run.html confirmGone 'd5'), closed its connection to a seat that
          // had just spoken, and the two met again only on a rescue dial
          // (chaos seed 7: a head back from a dead spot, its row-mate moved
          // into its cell — 15 s to settle, 5 of them re-dialing).
          this.occ.delete(m.ck); this.live.delete(m.ck); this.kidful.delete(m.ck); this.s1seen.delete(m.ck); this.tlForget(m.ck, 'moved'); this.healTry.delete(m.ck); this.digForget(m.ck); // freed ⇒ admissible now
          if (mvdFrom) { this.setOcc(m.mvd, m.id); this.noteS1(m.mvd); }   // a redirect, never liveness: the mover is heard there only when it speaks there
          this.wake(); return;
        }
        case 'SITXFER': {
          // V4: my assigner hands me my row's ledger — outstanding vouches
          // and its confirmed row occ. I am now the row's admitter, and these
          // cells are already promised or held.
          if (this.hasCoord && this.coord.pc === 0 && this.coord.i === 0 && ck(this.coord) === m.ck) {
            const inRow = (e) => { const c = e && cellKeyOk(e.k); return !!c && c.pc === 0 && c.r === this.coord.r && e.v != null; }; // the ledger of MY row, nothing else
            for (const kv of (Array.isArray(m.vouches) ? m.vouches.slice(0, C()) : [])) if (inRow(kv) && !this.occ.has(kv.k) && !this.sitting.has(kv.k)) this.sitting.set(kv.k, { joiner: kv.v, assigner: this.id, at: this.TICK, pingAt: -1 });
            for (const e of (Array.isArray(m.rowOcc) ? m.rowOcc.slice(0, C()) : [])) if (inRow(e) && !this.occ.has(e.k)) { this.setOcc(e.k, e.v); this.noteS1(e.k); }
            this.rowLedger = true;
          }
          return;
        }
        case 'SITPING': {
          // V4: my assigner asks whether its vouch for me at m.ck is live.
          // Answer ONLY about the vouched cell: seated there (tag=1, a
          // re-CLAIM) or still seeking with the PLACE possibly in flight
          // (tag=0). Seated ELSEWHERE = silence — the vouch should free.
          if (m.id === this.id) {
            if (this.hasCoord && this.state === 3 && ck(this.coord) === m.ck) this.emit(m.from, { t: 'SITPONG', ck: m.ck, id: this.id, tag: 1 });
            else if (!this.hasCoord && this.state === 2) this.emit(m.from, { t: 'SITPONG', ck: m.ck, id: this.id, tag: 0 });
          }
          return;
        }
        case 'SITPONG': {
          if (!this.verifyFill(m)) return;
          const sit = this.sitting.get(m.ck);
          if (sit && sit.joiner === m.id) {
            if (m.tag === 1) this.confirmSeated(m.ck, m.id);            // the lost CLAIM, replayed first-hand
            else { sit.at = this.TICK; sit.pingAt = -1; if (sit.pl) this.emit(m.id, Object.assign({}, sit.pl)); } // alive and still seeking: restart the clock, and re-send the PLACE it has evidently not got
          }
          return;
        }
        case 'PHONE': this.onPhone(m); return;
        case 'PONG': {
          // FRAME AUTHORITY: a PONG answers MY PHONE, so it comes from a cell I
          // phone — one of my owned links. Its responder is `id` (a
          // pre-authority dual-hold answer carries none: then the link). It is
          // unsigned: only when the transport names the responder does it
          // teach me anything; an unproven one (sponsor, relay, a forger) may
          // only confirm a pairing I already hold.
          if (!this.hasCoord || !m.coord) return;
          const pk = ck(m.coord);
          const pid = (m.id != null) ? m.id : m.lk;
          if (pid == null) return;
          // MISDIRECTED (onPhone NOT ME): the seat I hold at one of my owned
          // links answers, link-proven, from a cell that is no link of mine.
          // It is not where I thought: the hint goes (never a seat I hear
          // first-hand there), or, when that cell is its own owner cell, is
          // replaced by the owner it names — its own up link, a fact it holds
          // first-hand. Liveness: none.
          // ...and only THAT: the responder's own up link is a fact it holds
          // first-hand; a bare "not here" is not acted on (deleting the stale
          // hint left row-mates anchorless — ancDead — and a 45% churn
          // drained 52 of 76 survivors, c-sweep C=5 seed 1).
          if (this.linkIs(m, pid) && m.oCk != null && m.owner != null && m.owner !== this.id && m.owner !== pid) { const oc = ownerCoordOf(m.coord); const K = oc ? ck(oc) : null;
            if (K != null && K !== pk && m.oCk === K && this.ownedLinkCell(K) && this.occGet(K) === pid && !this.firstHandLive(K)) { this.setOcc(K, m.owner); this.noteS1(K); } }
          if (!this.ownedLinkCell(pk)) return;
          if (m.yp === 1 && this.ppValid(m)) this.ppNote(pk, pid, m.pp.sig, m.ppfrom);   // PP: an arbiter's hearing PONG presents its proof (a note, never liveness)
          else if (m.yp === 1 && m.ppok === undefined && m.pp && m.pp.sig != null) this.ppNote(pk, pid, m.pp.sig, null, m.pp);   // ...or one the wire left unchecked (it verifies lazily): noted PENDING, so the YIELD behind this PONG can ask for the verdict (arbOk -> ppSigned -> ppAsk) instead of finding no note at all (behavior 14a: the returning head never held the row-mate's HELLO, only its hearing PONG)
          if (!this.linkIs(m, pid)) {
            // Only for a pairing no link ever proved (entryOpen; the PHONE twin): a
            // seat's liveness after that is its own link's word.
            if (this.occGet(pk) !== pid) return;
            this.upUsed.set(pk, TICK); if (!this.entryOpen(pk, pid)) return;
            this.lastAck = TICK;
            if (m.coord.pc === 0) { this.liveMark(pk); this.noteS1(pk); }
            return;
          }
          // A responder other than the seat I hear at that cell is not the one I
          // phoned: it teaches nothing and keeps nothing alive (a member with a
          // DataChannel to me naming an occupied rook cell used to take it here,
          // and its PONGs kept a crashed head looking alive).
          { const cur = this.occGet(pk); if (cur != null && cur !== pid && this.heardAt(pk, cur)) return; }
          this.lastAck = TICK; this.nbrHeard();
          this.noteLinked(pk, pid, m.tn); this.pongBy.set(pk, { id: pid, at: TICK });
          // FIRST-HAND: the responder spoke to me directly on our rook link.
          if (m.coord.pc === 0) { this.setOcc(pk, pid); this.liveMark(pk); this.noteS1(pk); }
          { const py = this.pendY; // the arbiter's signed YIELD outran its hearing PONG (checked once the PONG has placed it)
            if (py && py.by === pid && TICK - py.at <= 8 && this.state === 3 && py.ck === ck(this.coord) && this.arbOk(pid)) { this.pendY = null; if (this.moving) this.rollbackMove(); else this.requeue(); return; } }
          // Its owner cell is a fact of the topology, not of its word; its row
          // is ITS row (at most C cells); cousins are capped (W, 4C).
          const oc = ownerCoordOf(m.coord);
          if (m.owner != null && oc && m.oCk === ck(oc) && this.occGet(m.oCk) !== m.owner) { this.setOcc(m.oCk, m.owner); this.noteS1(m.oCk); }
          // ...and never MY OWN cell under another id: a listing is not a challenge (a mate that left-packed into a freed cell got its head's beat-old row, listing the leaver there, and held the leaver at its own seat — forged-frames X7). A genuine rival is settled by the arbiter's YIELD, never by a row list.
          if (Array.isArray(m.row)) for (const e of m.row.slice(0, C())) { const c = e && cellKeyOk(e.k); if (!c || c.pc !== m.coord.pc || c.r !== m.coord.r || e.v == null) continue; if (e.k === ck(this.coord) && e.v !== this.id) continue; if (this.occGet(e.k) !== e.v) { if (this.liveElsewhere(e.v, e.k)) continue; this.setOcc(e.k, e.v); } this.noteS1(e.k); if (e.age != null) this.childOf.set(e.k, e.age); }   // ...nor a seat I hear FIRST-HAND at another cell: a listing never moves a live neighbour (one place; behavior 14a: a returning head's stale row listed the real head one cell over)
          if (Array.isArray(m.nbrs)) for (const kv of m.nbrs.slice(0, 4 * C())) { if (!kv || !cellKeyOk(kv.k) || kv.v == null) continue; if (!this.cousins.has(kv.k) && this.cousins.size >= 4 * C()) continue; this.cousins.set(kv.k, kv.v); } // W: learn the heirs at my future owned-links for relay-free promote-up
          // MY HEAD'S ROW IS THE ROW (deep rows). The head's PONG lists its
          // first-hand row; a row cell I hold that it does not list, and that I
          // do not hear first-hand, is an echo of someone gone. Mates only ever
          // ADDED from this list, so an echo to my right made me "not the
          // rightmost" and compactEligible refused me for good (sim PONG,
          // repro-compaction leg 1 seed 1).
          if (this.hasCoord && this.coord.pc !== 0 && this.coord.i !== 0 && m.coord && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r && m.coord.i === 0) {
            for (let j = 1; j < C(); j++) {
              if (j === this.coord.i) continue; const rk = ck({ pc: this.coord.pc, r: this.coord.r, i: j });
              if (!this.occ.has(rk) || this.firstHandLive(rk)) continue;
              if (!(Array.isArray(m.row) && m.row.some((e) => e && e.k === rk))) { this.occ.delete(rk); this.kidful.delete(rk); this.childOf.delete(rk); }
            }
          }
          // ---- § G DOWN-LEG + the AUTHOR'S REFUTATION --------------------
          // G4: I check ONE thing — that the fold my aggregator published
          // still contains the contribution I authored. An owner's subtree is
          // exactly 1 + the row digest I (its down-child) sent it; a head's
          // row fold must contain my subtree digest. A SHORTFALL below what I
          // sent is suppression; anything else is staleness or growth, never
          // evidence. G5: the remedy is a counter and a diagnostic — it
          // evicts NOTHING (an eviction lever here would hand an attacker
          // exactly what G1 denies). G4 grace on a CHANGED AGGREGATOR: a
          // healer just promoted into my owner's/head's cell has folded
          // nothing from me yet and legitimately echoes nothing — the
          // relationship, not my history, is what has to be 2*DIG_TTL old.
          if (this.digOn() && this.hasCoord && this.coord.pc !== 0) {
            const rootD = m.dgRoot ? (m.dgRoot.stub === 1 ? this.stubTake(Object.assign({}, m.dgRoot, { from_: pid, slot_: 'root' }), this.rootDig) : digSane(m.dgRoot)) : null, pubD = m.dgPub ? digSane(m.dgPub) : null;
            if (rootD && rootD.at >= 0) { if (m.dgRoot.stub !== 1) this.rxDig(rootD); if (this.rootDig.at < 0 || rootD.rx > this.rootDig.rx) this.rootDig = rootD; } // the room fold, one level per period (staleness O(depth x period)); fresher ON MY CLOCK wins (G0b)
            if (pubD && pubD.at >= 0 && m.coord) {
              const oc = this.ownerCoord();
              const isOwner = this.coord.i === 0 && !!oc && ck(m.coord) === ck(oc);
              const isHead = this.coord.i > 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r && m.coord.i === 0;
              if (isOwner || isHead) {
                if (pid !== this.lastAgg) { this.lastAgg = pid; this.upSince = TICK; this.emptyEcho = 0; }
                else {
                  const echo = (m.dgEcho && m.dgEcho.at != null) ? (digSane(m.dgEcho) || dig0()) : dig0();
                  if (this.upRefuted(pubD, echo, isOwner ? 1 : 0)) {
                    this.digMismatch++;
                    if (this.onDigMismatch) { try { this.onDigMismatch({ arm: this.digArm, tick: TICK, meId: this.id, me: { pc: this.coord.pc, r: this.coord.r, i: this.coord.i }, aggId: pid, agg: { pc: m.coord.pc, r: m.coord.r, i: m.coord.i }, pub: m.dgPub, echo }); } catch (e) {} }
                  }
                }
              }
            }
          }
          return;
        }
        case 'ROUTE': {
          if (!this.hasCoord) return;
          if (ck(this.coord) === ck(m.target)) {
            if (m.tag === 3) { if (typeof m.ack !== 'string' || !this.translost.has(m.ack) || !this.probeAsked(m.ack, m.pn)) return; this.probeAck.set(m.ack, TICK); this.tlLog.push([m.ack, TICK, 'pa:tag3-answer from ' + String(m.id || m.via || '?').slice(0, 6)]); if (this.tlLog.length > 24) this.tlLog.shift(); return; } // a D5 probe ANSWER routed back around the dead link — the probed peer LIVES
            if (m.tag === 2 && m.acoord) {
              // D5 translost probe reached me: I am alive — answer AROUND the
              // dead link (first hop excludes the asker; my direct link to it
              // is presumably the one that died), so the answer survives a
              // one-sided severance. The plain ROUTED below still covers the
              // healthy-path case.
              const nh2 = this._probeHop(m.acoord, m.asker);
              if (nh2 != null) this.emit(nh2, { t: 'ROUTE', target: m.acoord, asker: this.id, tag: 3, ttl: 60, via: this.id, ack: ck(this.coord), pn: m.pn });
            }
            this.emit(m.asker, { t: 'ROUTED', tag: m.tag, target: m.target, id: this.id, pn: m.pn }); return;
          }
          if (m.ttl <= 0) { this.emit(m.asker, { t: 'ROUTED', tag: m.tag, target: m.target, id: null, pn: m.pn }); return; }
          // FORWARD WITH THE PROBE PAYLOAD (2026-08-02): the re-minted hop
          // used to drop `ack` (the tag-3 answer's coord) and `acoord` (the
          // tag-2 probe's return address), so any D5 answer that actually
          // ROUTED AROUND the dead link arrived empty — probeAck stamped an
          // undefined key, the observation never cleared, and a LIVE severed
          // peer was early-confirmed dead. Never worked past one hop.
          const nh = this.nextHopToward(m.target, m.via); if (nh != null) { this.emit(nh, { t: 'ROUTE', target: m.target, asker: m.asker, tag: m.tag, ttl: m.ttl - 1, via: this.id, acoord: m.acoord, ack: m.ack, pn: m.pn }); return; }
          this.emit(m.asker, { t: 'ROUTED', tag: m.tag, target: m.target, id: null, pn: m.pn }); return;
        }
        // ROUTED answers a probe I sent (routeTo / routeToProbe stamp probeOut):
        // only an answer echoing that probe's nonce counts (it used to write
        // any id into any cell of my occ, and to stamp probeAck for a corpse),
        // and it never displaces a seat I hear at that cell first-hand.
        // A probe answer about MY OWN cell (I healed into the cell I had probed
        // before the answer landed) names a rival, not my cell's occupant: it is
        // not written (the new head's view named the
        // thawed old head at its own seat and NOROOMed it).
        case 'ROUTED': if (m.tag === 1 || m.tag === 2) { if (m.id != null && this.hasCoord && m.target && ck(m.target) !== ck(this.coord) && this.probeAsked(ck(m.target), m.pn) && !(this.occGet(ck(m.target)) != null && this.occGet(ck(m.target)) !== m.id && this.holdsCell(ck(m.target), 60))) { this.setOcc(ck(m.target), m.id); this.noteS1(ck(m.target)); this.probeAck.set(ck(m.target), TICK); this.upAck.set(ck(m.target), { id: m.id, at: TICK }); if (this.upAck.size > 64) this.upAck.delete(this.upAck.keys().next().value); if (this.upExpired.get(ck(m.target)) === m.id) this.upExpired.delete(ck(m.target)); this.tlLog.push([ck(m.target), TICK, 'pa:routed-tag' + m.tag + ' id=' + String(m.id).slice(0, 6)]); if (this.tlLog.length > 24) this.tlLog.shift(); this.emit(m.id, { t: 'HELLO', ck: ck(this.coord), id: this.id }); } } return; // probeAck AFTER setOcc (a changed occupant clears the observation first)
        default: return;
      }
    }

    // V7b (H4): the owner reserves my cell in its child-row ledger, so my
    // goodbye goes to it too (leave() always did; requeue and reseatViaRoster
    // left it to the head's next ledger beat).
    leaveOwner(seen) { const o = this.ownerCoord(); if (!o) return; const oid = this.occGet(ck(o)); if (oid != null && oid !== this.id && !seen.has(oid)) { seen.add(oid); this.emit(oid, { t: 'LEAVE', ck: ck(this.coord), id: this.id }); } }
    leave() {
      this.alive = false; this.moving = false; this.leaseCk = null; this.leaseUntil = -1;
      if (!this.hasCoord) return; const kk = ck(this.coord); const seen = new Set();
      for (const olc of topo.ownedLinks(this.coord)) { const x = this.occGet(ck(olc)); if (x != null && !seen.has(x)) { seen.add(x); this.emit(x, { t: 'LEAVE', ck: kk, id: this.id }); } }
      const o = this.ownerCoord(); if (o) { const oid = this.occGet(ck(o)); if (oid != null && !seen.has(oid)) this.emit(oid, { t: 'LEAVE', ck: kk, id: this.id }); }
    }

    // The heal a goodbye starts once the cell is known vacated (LEAVE, or the
    // probe-gated mismatch path): clear the heir mark, then H-CHAIN LEFT-PACK
    // or the Section-1 column clique, exactly as the goodbye handler did.
    goodbyeHeal(k) {
      const HEALING = this.env.HEALING;
      // H-CHAIN vertical: vacated down-child clears childOf on its owner
      // so LEFT-PACK can devolve (childOf otherwise never expired).
      {
        const left = unck(k);
        if (left.i === 0) {
          const par = topo.up(left);
          if (par) this.childOf.delete(ck(par));
        }
      }
      // H-CHAIN LEFT-PACK (reactive): first OCCUPIED seat strictly right
      // of the hole with empty intermediates heals it. Defer if LIVE
      // down-child (VERTICAL). Old col-1-only is chain length-1.
      if (HEALING && this.hasCoord && this.state === 3) {
        const c = unck(k);
        // Defer to VERTICAL only when down-child OCC is present — stale
        // childOf on neighbours must not block LEFT-PACK forever.
        if (c.pc === this.coord.pc && c.r === this.coord.r && this.coord.i > c.i
            && this.occGet(ck(topo.down(c))) == null) {
          let first = true;
          for (let j = c.i + 1; j < this.coord.i; j++) if (this.occGet(ck({ pc: c.pc, r: c.r, i: j })) != null) { first = false; break; }
          if (first) { this.heal(c); return; }
        }
        // H-CHAIN S1 COLUMN-clique (reactive): same column, STRICTLY DEEPER
        // row (coord.r > hole.r) so scooch is UP into denser H7 territory.
        // Row-right empty = no firstHandLive. First col-mate between hole
        // and me (no wrap raid of upper rows). Defer VERTICAL if down OCC.
        if (this.coord.pc === 0 && c.pc === 0 && this.coord.i === c.i && this.coord.r > c.r
            && this.occGet(ck(topo.down(c))) == null) {
          let rowRightEmpty = true;
          for (let j = c.i + 1; j < C(); j++) if (this.firstHandLive(ck({ pc: 0, r: c.r, i: j }))) { rowRightEmpty = false; break; }
          if (rowRightEmpty) {
            let first = true;
            for (let rr = c.r + 1; rr < this.coord.r; rr++) {
              if (this.occGet(ck({ pc: 0, r: rr, i: c.i })) != null) { first = false; break; }
            }
            if (first) { this.heal(c); return; }
          }
        }
      }
    }
    // §AUTH housekeeping, once a tick while seated (twin: mesh_seat.inc authTick):
    //  - an unproven pairing (a link I hold whose seat no channel ever proved)
    //    is probed every 20 ticks past the entry window; only an answer keeps
    //    it alive (entryOpen, H6);
    //  - a goodbye about a cell somebody else holds in my view heals only
    //    once that holder has not answered its probe (gbProbe, R7);
    //  - a healer asks its hole's admitter again for its placement proof
    //    until one arrives (CLAIM every 16 ticks, 160 ticks at most).
    authTick() {
      const TICK = this.TICK;
      if (TICK - this.upProbeAt >= 20) {
        this.upProbeAt = TICK;
        // ...only a pairing an UNPROVEN beat refreshed lately (upUsed): a
        // row-mate learned from the head's ledger that never beats me is no
        // pairing to re-confirm (the probes and their routed answers grew with
        // the room: repro-digest N=2000 frames/node/tick max 24.7 vs 3.5).
        for (const olc of topo.ownedLinks(this.coord)) { const k = ck(olc); const x = this.occGet(k); if (x == null || x === this.id || this.linkedBy.get(k) === x || this.translost.has(k)) continue; const u = this.upUsed.get(k); if (u === undefined || TICK - u > 40) continue; const o = this.upOpen.get(k); if (o === undefined || o.id !== x || TICK - o.at <= UNPROVEN_HOLD - 40) continue; this.routeTo(olc, 2); }
      }
      if (this.gbProbe.size) for (const [k, g] of this.gbProbe) {
        if (TICK - g.at < 2 * EARLY_HOLD) continue;
        this.gbProbe.delete(k);
        const cur = this.occGet(k);
        if (cur == null) { this.goodbyeHeal(k); continue; }
        if (cur !== g.holder || this.firstHandLive(k)) continue;
        const a = this.upAck.get(k); if (a !== undefined && a.id === cur && a.at >= g.at) continue;
        this.goodbyeHeal(k);
      }
      if (this.pp == null && this.ppAskAt >= 0 && TICK - this.ppAskAt >= 16 && TICK - this.seatedAt <= 160 && !this.moving) { this.ppAskAt = TICK; const adm = this.ppAdmitter(this.coord); if (adm != null && adm !== this.id) this.emit(adm, { t: 'CLAIM', ck: ck(this.coord), id: this.id }); }
    }
    tick() {
      if (!this.alive) return; const TICK = this.TICK;
      if (this.state !== 3) {
        // R6: stranded is RECOVERABLE — after a backoff the client re-knocks;
        // if a greeter is now reachable I seat, else I just strand again.
        if (this.stranded) { if (TICK - this.strandedAt > STRAND_TTL) { this.stranded = false; this.lastReach = -1; this.joinStart = -1; this.join(); } this.wake(); return; }
        if (this.forkProbe) this.maybeResolveFork(); // R5: settle multi-greeter HOME collection
        if (this.forkPaused) { this.wake(); return; } // waiting on human pick-one
        if (this.reAsk || this.reJoin) { // ENTRY PACING: fire the ask/knock deferred from a same-tick repeat (after the fork gate — a join() here must never wipe a pending pick-one)
          const a = this.reAsk; this.reAsk = false; this.reJoin = false;
          if (a && this.haveRoster && this.roster.length) { const t = this.pickRoster(); if (t != null) { this.askSeat(t); this.wake(); return; } }
          this.join(); this.wake(); return;
        }
        if (this.dr && TICK - this.dr.at >= DOOR_ROUND_WAIT) this.closeDoorRound();
        if ((this.state === 0 || this.state === 1) && TICK - this.retryAt > 20) { if (!this.resumeAsk()) this.join(); } // ENTRY RESUME: re-enter at WHOHOME while the greeter list is fresh; full knock only when it isn't
        // Graded state-2 retry, SOLE-CANDIDATE ONLY: with exactly one live
        // greeter to ask there is no second admission chain to race, so a void
        // FIND may re-ask after 12 ticks instead of 60 — before this, one
        // swallowed FIND cost a human 30 seconds of "Just you" in a 2-person
        // room (the unban-rejoin wedge, 2026-07-29). With MULTIPLE candidates
        // the full window stands: a fast re-pick abandons a merely-SLOW
        // admitter hand-off chain mid-walk and the twin PLACE races leave
        // shape holes (sim join-patterns N=9-11 serial caught exactly that).
        // FINDACK: before the asked greeter answers or acknowledges a hand-off,
        // silence past FIND_ACK_WAIT is a lost FIND or a lost direct PLACE
        // (nothing in flight to race); a greeter whose build does not
        // acknowledge keeps the windows above.
        else if (this.state === 2 && TICK - this.retryAt > ((this.findAckAt < 0 && (!this.findAckers || this.findAckers.has(this.lastAsked))) ? FIND_ACK_WAIT : (this.seatTries === 0 && this.roster.filter((e) => e.v !== this.id).length === 1) ? 12 : 60)) { if (this.haveRoster && this.roster.length && ++this.seatTries <= 6) { const t = this.pickRoster(); if (t != null) this.askSeat(t); else if (!this.resumeAsk()) this.join(); } else { this.seatTries = 0; if (!this.resumeAsk()) this.join(); } } // ENTRY RESUME on roster exhaustion too: a fresh WHOHOME beats a fresh knock
        this.wake(); return;
      }
      if (this.evil) this.attack();
      this.noteTree();   // the tree I sit in, for a later door round (foundDoor)
      // T: transit bookkeeping — a claim window that closes with NO
      // contradiction CONFIRMS (a wiped region has nobody to answer; a
      // contradiction would have rolled back already); the tombstone
      // self-expires (T3).
      if (this.moving && TICK - this.moveAt > CONFIRM_TTL) this.confirmMove();
      if (this.leaseUntil >= 0 && TICK > this.leaseUntil) { this.leaseCk = null; this.leaseUntil = -1; }
      this.recheckSitting(); // A: assigner frees soft sitting-down if PLACE never confirmed
      if (this.coord.pc === 0) {
        // ...and after an absence only hearing from AFTER the return counts: the
        // aged pre-dark stamps can still read under 60 ticks, and counting them
        // reset this clock on the first tick back and held the lone greeting
        // 16 ticks (8 s before the returning head spoke to
        // anyone). backAt: set by absence.
        if (this.anyRookLive(this.backAt >= 0 ? this.backAt : null)) this.rookSeenAt = TICK;   // fragment detector: reset while I hear anyone
        if (this.rival) this.loneAsk();
        { const mc = this.movedClaim;   // a rival's claim at my cell, its old cell under a D5 probe (see the HELLO rival branch)
          if (mc && (TICK - mc.at > 60 || this.state !== 3 || !this.hasCoord)) this.movedClaim = null;
          else if (mc) {
            const still = this.occGet(mc.k) === mc.id;
            if (still && !this.translost.has(mc.k)) this.movedClaim = null;   // the probe was answered: it is still there, the claim was a lie or an echo
            else if (!still || this.translostConfirmed(mc.k)) {   // confirmed gone from its old cell: a real move into my cell
              // the old cell leaves my view as tlSweep's confirm would take it (occ, liveness, the PONG memory);
              // linkedBy stays — ppAdm reads it: the mover admitted the seat that took the cell it left
              if (still) { this.occ.delete(mc.k); this.live.delete(mc.k); this.pongBy.delete(mc.k); this.kidful.delete(mc.k); this.s1seen.delete(mc.k); this.healTry.delete(mc.k); this.tlForget(mc.k, 'moved-confirmed'); }
              this.movedClaim = null; this.rival = { id: mc.id, at: TICK };
              // ...and told where I sit: its claim on my cell is now a contest
              // between us (the rival branch — challenge, E2 or its arbiters),
              // and the rival learns of the contest only from my HELLO. The
              // ask alone left it to the rival's next greeting beat.
              if (TICK - this.rosterAskAt > 20) { this.rosterAskAt = TICK; this.emit(mc.id, { t: 'WHOHOME', from: this.id, ttl: 60 }); this.emit(mc.id, { t: 'HELLO', ck: ck(this.coord), id: this.id }); }
              // ...and the claim it made is judged NOW, through the whole rival
              // branch (every gate: proof, freshness, hearing), with one
              // decision free of the answer pacing. It was already in hand:
              // waiting for the rival to repeat it cost the contest the
              // rival's own pacing (an answer it sent 2 ticks before) and then
              // its next door greeting (13.6 s).
              // movedClaimMsg.
              if (mc.m && this.state === 3 && this.hasCoord && mc.m.ck === ck(this.coord)) { this.challAt = Math.min(this.challAt, TICK - 21); this.recv(mc.m); }
            } } }
        { const py = this.pendY;   // a YIELD held for its arbiter's proof verdict (see case 'YIELD')
          if (py && TICK - py.at > PEND_Y) this.pendY = null;
          else if (py && this.state === 3 && py.ck === ck(this.coord) && this.arbOk(py.by)) { this.pendY = null; if (this.moving) this.rollbackMove(); else this.requeue(); this.wake(); return; } }
        // D1 over the rook: phone every live row+column neighbour each beat
        // (maintains first-hand liveness across all redundant home paths).
        if (TICK - this.lastPhone >= 8) { this.lastPhone = TICK; this.rollup(); this.s1Heartbeat(); this.s1Sync(); this._gspRefan(); this.loneGreet(); } // § G: ONE fold per node per period, O(C) work, before the beat carries it
        // 11a: every Section-1 cell is refilled by its down-child (VERTICAL);
        // s1Fill is the head's probe-gated LAST-RESORT backstop. While a D5
        // transport-loss observation is pending, check every beat (not every
        // 12) so the early confirm isn't left waiting on the slow cadence —
        // heal()'s own cooldowns keep this storm-free.
        this.tlSweep(); // D5: a confirmed corpse leaves my view early (cleanup, not healing)
        this.authTick();
        if (this.coord.i === 0 && ((TICK % 12) === 0 || this.translost.size)) { this.rowSweep(); this.s1Fill(); }
        if ((TICK % 12) === 0) this.childSweep(); // a Section-1 owner sweeps its silent child row too (sim twin): the pc===0 guard inside childSweep was lifted but the call was only in the deep branch, so a home seat kept a dead down-child for good, hasChildren() stayed true and the left-pack into a dead head cell never ran (c-sweep C=2 churn 0.45 seed 1)
        // H2 LEFT-PACK backstop (proactive, probe-gated): when my row has NO
        // live head, the head can't run its backstop, so the row rebuilds
        // itself leftward — I heal my immediate LEFT neighbour (the head if I
        // am column 1). Cascades toward the head, each cell only once its left
        // is confirmed dead. Restricted to headless rows so it never races the
        // head's s1Fill. This is what rebuilds an all-heads-dead column-0 (bug #4).
        // (D5: a pending transport-loss for the head counts as "no live head" —
        // my own link to it died; firstHandLive may linger up to 60 ticks.)
        if (this.coord.i >= 1 && TICK - this.healAt > 20 && (!this.firstHandLive(ck({ pc: 0, r: this.coord.r, i: 0 })) || this.translost.has(ck({ pc: 0, r: this.coord.r, i: 0 })))) {
          const lft = { pc: 0, r: this.coord.r, i: this.coord.i - 1 }; const lk = ck(lft);
          // Defer to VERTICAL only when down-child OCC present (not stale childOf).
          const defer = this.translost.has(lk) && this.occGet(ck(topo.down(lft))) != null;
          if (!defer && this.ringConfirmDead(lft)) { if (this.occ.has(lk)) { this.occ.delete(lk); this.live.delete(lk); this.s1seen.delete(lk); this.kidful.delete(lk); } this.holeSince.delete(lk); this.heal(lft); }
        }
        // W7: keep column links live — re-ping any vacant column-mate
        if (TICK >= this.xlinkAt) { this.xlinkAt = TICK + 150 + (this.rng() * 100 | 0); for (const cm of topo.colMates(this.coord)) if (this.occGet(ck(cm)) == null) this.routeTo(cm, 1); }
        if (this.s1CheckAt < 0) this.s1CheckAt = TICK + E3_PERIOD + (this.rng() * E3_PERIOD | 0);
        if (TICK >= this.s1CheckAt) { this.s1CheckAt = TICK + E3_PERIOD + (this.rng() * E3_PERIOD | 0); this.emitRelay(this.genKey); } // E3 re-knock: Section-1 seats ARE the greeter pool
        this.wake(); return;
      }
      if (TICK - this.lastPhone >= 8) { this.lastPhone = TICK; this.rollup(); this.phoneHome(); this._gspRefan(); } // § G: ONE fold per node per period (<= C reports in, ONE out), then the beat carries it up
      this.tlSweep(); // D5: a confirmed corpse leaves my view early (cleanup, not healing)
      this.authTick();
      if (this.coord.i === 0 && (TICK % 12) === 0) this.rowSweep();
      if ((TICK % 12) === 0) this.childSweep();
      // 11a HORIZONTAL: only a CHILDLESS head needs a horizontal healer (its
      // row depends on it, nothing below to pull up); its fixed healer is
      // {pc,r,1}. A head WITH a subtree is healed by its down-child (VERTICAL).
      // occGet==null = definite LEAVE, so severance never false-heals. (bug #3:
      // the hasDownChild gate is what keeps s1Fill and this healer from racing.)
      // D5 early path: my own DC to the head died and the confirm probe went
      // unanswered — confirmed dead now; clear the corpse and heal. The
      // occGet==null + lastAck>60 branch remains the horizon backstop.
      if (this.coord.i === 1 && TICK - this.healAt > 20) {
        const hd = { pc: this.coord.pc, r: this.coord.r, i: 0 }; const hdk = ck(hd);
        const hdEarly = this.translostConfirmed(hdk);
        if ((hdEarly || (TICK - this.lastAck > 60 && this.occGet(hdk) == null)) && !this.hasDownChild(hd)) {
          if (hdEarly) { this.occ.delete(hdk); this.live.delete(hdk); this.s1seen.delete(hdk); this.kidful.delete(hdk); }
          this.heal(hd);
        }
      }
      if (this.coord.i > 0 && TICK >= this.xlinkAt) { this.xlinkAt = TICK + 150 + (this.rng() * 100 | 0); const x = topo.crossLink(this.coord); if (x && this.occGet(ck(x)) == null) this.routeTo(x, 1); }
      if (this.drainAt && TICK >= this.drainAt) { this.reseatViaRoster(); return; }
      // 11a VERTICAL (the down-child is the fixed healer of its owner;
      // generalizes H8): I am a head, so my owner cell O = up(me) is the cell
      // whose down-child I am. If O is DEAD (occ cleared by a definite LEAVE,
      // NOT mere severance) AND has stopped PONGing me for a settled window
      // (positive death confirmation — no promoting a leaf on a transient occ
      // glitch), I heal O by promoting a LEAF from my subtree up into it (P:
      // only leaves move; I move only when I am childless), wired with my
      // cousins (O's heir neighbourhood, learned from O's PONG).
      let didHeal = false;
      if (this.coord.i === 0 && TICK - this.healAt > 20) { // cousins may be EMPTY — a ghost owner never PONGed, so it taught no heir neighbourhood; nbrs fall back to the hole's owned-link occupants below
        const oc = this.ownerCoord(); const ok = oc ? ck(oc) : null;
        // H1-S1 CONSERVATISM: promoting into a SECTION-1 owner is the one move
        // that can mint a divergent home — it waits the full RING_HOLD window.
        const confirm = (oc && oc.pc === 0) ? RING_HOLD : 60;
        // D5 early path: I hold the down-link DC to my owner; it died and the
        // confirm probe went unanswered across the mesh — first-hand confirmed
        // death (equivalent to a LEAVE), no silence horizon to wait out. The
        // horizon branch (occ cleared + lastAck past the confirm window)
        // remains the backstop. An owner whose probe answers is never touched.
        const ownEarly = ok != null && this.translostConfirmed(ok);
        // NEVER BLIND INTO SECTION 1. A deep head whose Section-1 owner was a
        // ghost (never PONGed) knows no Section-1 seat at all: its promoted
        // leaf's CLAIM named only cells below the hole, reached no arbiter,
        // and seated a second home ring beside the real one — two seats
        // holding each other's cells with a two-cell view of the home, which
        // the two-ring detector (a FULL home view) could never greet
        // (heal-time.js s1all seed 8: 0_0_0 and 0_0_3 doubled for 40k ticks).
        // Before healing it, learn the ring from the door: WHOHOME to a listed
        // greeter (the HOME roster installs as hints below) — the hole is then
        // either held (phone it) or free with its ring neighbours known.
        if (oc && oc.pc === 0 && !ownEarly && this.occGet(ok) == null && TICK - this.lastAck > confirm && !this.knowsRing(ok)) {
          if (TICK - this.rosterAskAt > 40 && this.lastGreeters) { const gs = this.lastGreeters.filter((g) => g != null && g !== this.id); if (gs.length) { this.rosterAskAt = TICK; this.emit(gs[(this.rng() * gs.length) | 0], { t: 'WHOHOME', from: this.id, ttl: 60 }); } }
          this.healAt = TICK;
        } else if (oc && (ownEarly || (this.occGet(ok) == null && TICK - this.lastAck > confirm)) && TICK - (this.healTry.has(ok) ? this.healTry.get(ok) : -999) > 45) {
          if (ownEarly) { this.occ.delete(ok); this.live.delete(ok); this.s1seen.delete(ok); this.kidful.delete(ok); }
          this.healTry.set(ok, TICK); this.healOnly.add(ok); this.healAt = TICK; didHeal = true;
          const nb = []; for (const [k, v] of this.cousins) nb.push({ k, v });
          if (!nb.length) { for (const olc of topo.ownedLinks(oc)) { const x = this.occGet(ck(olc)); if (x != null && x !== this.id) nb.push({ k: ck(olc), v: x }); } }
          const rc = this.rosterCells(); const ix = this.shuf(Array.from({ length: C() }, (_, k) => k)); let sent = false;
          for (const q of ix) { const x = this.occGet(ck(rc[q])); if (x != null && x !== this.id) { this.emit(x, { t: 'FINDLEAF', hole: oc, nbrs: nb, ttl: 40 }); sent = true; break; } }
          if (!sent) this.promoteInto(oc, nb); // I'm childless ⇒ I AM the leaf
        }
      }
      // 11a: draining is severance-immune, like healing. A seat drains only
      // when its ANCHOR is CONFIRMED dead (occ cleared by a LEAVE), not merely
      // silent — a 40-200-tick severance recovers WITHOUT churning out and
      // back. The lastAck>220 E1 last-resort still catches a genuinely
      // orphaned seat whose anchor died without a deliverable LEAVE.
      let ancDead = false;
      if (this.hasCoord) { if (this.coord.i !== 0) ancDead = this.occGet(ck({ pc: this.coord.pc, r: this.coord.r, i: 0 })) == null; else { const anc = this.ownerCoord(); if (anc) ancDead = this.occGet(ck(anc)) == null; } }
      if (!didHeal && TICK - this.lastAck > 80 && (ancDead || TICK - this.lastAck > 220)) this.drainOrReenter();
      else if (!didHeal) this.tryCompact(); // Q2: only when not draining/healing this tick — pack the tree upward when settled
      this.wake();
    }
    // Q2 — COMPACTION probe. A settled DEEP LEAF (childless: P — only leaves move,
    // so its departure strands nobody) periodically sends a probe UP its own ALIVE
    // up-chain for a STRICTLY-SHALLOWER occupied row to densify into. Rate-limited
    // + local-quiescence-gated so a healing boundary never sloshes; strict
    // improvement makes depth a monotone potential ⇒ MOVES provably settle. Never
    // a Section-1 seat (already shallowest; greeter role) and never a non-leaf.
    tryCompact() {
      if (!this.env.COMPACTION) return; // opt-in (mesh-wire enables it; harness/tests toggle)
      const TICK = this.TICK;
      if (!this.hasCoord || this.state !== 3 || this.coord.pc === 0 || this.moving) return; // S1 is the top; a mover finishes first
      if (TICK < this.compactAt) return; // rate limit / hysteresis
      // HYSTERESIS: compact only from a QUIESCENT neighbourhood. A LEAVE/heal/move
      // I saw nearby resets lastChurn, so during a heal storm compaction lies
      // dormant region-wide and only wakes once the dust settles.
      if (TICK - this.seatedAt < COMPACT_SETTLE || TICK - this.healAt < COMPACT_SETTLE || TICK - this.lastChurn < COMPACT_SETTLE) return;
      if (this.hasChildren()) return; // P: only a leaf may move
      // CLEAN-DEPARTURE gate: only the RIGHTMOST occupant of my row may compact,
      // so my leaving shortens the row (a trailing hole, C2) and never orphans a
      // row-mate into a headless row.
      for (let j = this.coord.i + 1; j < C(); j++) if (this.occGet(ck({ pc: this.coord.pc, r: this.coord.r, i: j })) != null) return;
      this.compactAt = TICK + COMPACT_PERIOD + (this.rng() * COMPACT_PERIOD | 0);
      // Send a compaction probe UP my own chain: to my row head (a direct row
      // link), or, if I AM a childless head, straight to my owner. Every hop
      // rides an ALIVE link, so the probe never depends on routing across a
      // fragmented mesh or on a shallow seat's stale view. serveCompact climbs to
      // the nearest strictly-shallower OCCUPIED row and seats me beside it; the
      // admitter routes the PLACE back. A dropped probe just retries next period.
      let up1 = (this.coord.i !== 0) ? this.occGet(ck({ pc: this.coord.pc, r: this.coord.r, i: 0 })) : null;
      if (this.coord.i === 0) { const o = this.ownerCoord(); if (o) up1 = this.occGet(ck(o)); }
      if (up1 == null || up1 === this.id) return;
      this.emit(up1, { t: 'FIND', nc: this.id, tag: 1, coord: this.coord, ttl: COMPACT_TTL });
    }
  }

  GifOS.mesh = { Seat, keyHash, RELAY_TTL, RELAY_CAP, E3_PERIOD, STRAND_TTL, RING_HOLD, EARLY_HOLD, CONFIRM_TTL, LEASE_TTL, DIG_TTL, DIG_LOSS_H, isS1key, ownerCoordOf,
    K_HAND, K_APP, K_VOTE, K_STAGE, digSane }; // digSane: the wire boundary, exported for its guard (test/mesh/digest.js leg 11)
})(typeof window !== 'undefined' ? window : globalThis);
