'use strict';
/*
 * harness/dialsig.js: a dial's signalling, a line-for-line port of the sim's mesh_dialsig_fab.inc. The offer and the
 * answer of a dial take the page's routes (relay under relayMayCarry with both sockets, or the sponsor walk over open
 * channels). Runs from the link events; harness code, never shipped.
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const hash = require(path.join(M, 'hash.js'));
const C_ = require(path.join(M, 'consts.js'));
const K = C_.consts, E = C_.enums;
const U32 = (x) => x >>> 0;
const SIG_NOSOCK_T = 60, SIG_DEEP_GRACE = 20, SIG_RETRY_DOOR = 8, SIG_RETRY_UP = 16, SIG_RETRY_CURE = 24, SIG_RETRY_POLITE = 10, SIG_RETRY_QUIET = 60;

function install(fab) {
  const { lv, seats, alive, X } = fab, w = fab.w, F = fab.fhop, TICK = () => w.TICK, nextId = () => lv.nextId, isFrozen = fab.isFrozen;
  const lk = () => fab.link;
  const idPair = hash.idPair, lmix = (x) => hash.fmix32(U32(x + 0x9e3779b9));
  const lEnd = (me, x) => (me < x ? 0 : 1);
  const HEARD = new Map(), NOSOCK = new Map();
  const sigReset = () => { HEARD.clear(); NOSOCK.clear(); if (X.mPairsReset) X.mPairsReset(); };
  const sigSeated = (x) => seats[x].hasCoord && seats[x].state === 3;
  const sigInit = (a, b) => { const s = U32(U32(lv.SEED0) ^ 0x696e6974), ha = lmix(hash.hmixId(s, a)), hb = lmix(hash.hmixId(s, b)); return ha !== hb ? ha > hb : a > b; };
  const sigSock = (x) => { if (x < 0 || x >= nextId() || !alive[x] || lk().radioOff(x) || fab.sockClosed(x)) return false; const s = seats[x]; return s.socketed() || TICK() - s.seatedAt <= SIG_DEEP_GRACE; };
  const sigMayRelay = (me, to) => {
    const s = seats[me]; if (!s.socketed()) return false; if (!s.hasCoord) return true; if (!F.fhKeyOf(me, to)) return true;
    const at = HEARD.get(idPair(me, to)); return at !== undefined && TICK() - at < SIG_NOSOCK_T;
  };
  const sigHeard = (me, from) => { if (HEARD.size > 2048) HEARD.clear(); HEARD.set(idPair(me, from), TICK()); NOSOCK.delete(idPair(me, from)); };
  const sigCarries = (a, b) => {
    if (!lk().pathOk(a, b)) return false; const L = lk().linkFind(a, b); if (!L || L.state !== E.LK_OPEN || (L.half & (1 << lEnd(a, b)))) return false;
    const sv = fab.severedUntil.get(fab.pairKey(a, b)); if (sv !== undefined && sv > TICK()) return false;
    if (lv.NET_LOSS > 0) { const q = Math.min(seats[a].netQual, seats[b].netQual); if (lk().ldraw(0, 999999, a, b, 0x7369676c) / 1e6 < lv.NET_LOSS * (1.0 + 2.0 * (1.0 - q))) return false; }
    return true;
  };
  const sigHopT = (a, b) => (lv.NET_LAT > 1 ? lk().ldraw(1, lv.NET_LAT, a, b, 0x73696764) : lk().ldraw(1, 2, a, b, 0x73696764));
  const sigWalk = (me, to) => {
    F.fhEnsure(); lk().lEnsure(Math.max(me, to));
    const tc = F.fhKeyOf(me, to); let nxt = -1; const mc = F.fhConns(me);
    for (const r of mc) if (r !== to && F.fhClaims(me, r, to)) { if (F.fhDc(me, r)) nxt = r; break; }
    if (nxt < 0) nxt = F.fhNextHop(me, to, tc);
    if (nxt < 0) nxt = F.fhCrumb(me, to, -1);
    if (nxt < 0) for (const r of mc) if (r !== to) { nxt = r; break; }
    if (nxt < 0) return -2;
    let cur = me, d = 0, ttl = K.FHOP_TTL; const seen = [];
    for (;;) {
      if (!sigCarries(cur, nxt)) return -1;
      d += sigHopT(cur, nxt); F.fhNoteCrumb(nxt, me, cur);
      if (nxt === to) return d;
      if (seen.includes(nxt)) return -1;
      if (--ttl < 0) return -1;
      const via = cur; cur = nxt; nxt = -1; seen.push(cur);
      const ok = (p) => p >= 0 && p !== via && F.fhConn(cur, p);
      { const h = F.fhNextHop(cur, to, tc); if (ok(h)) nxt = h; }
      let cc = [];
      if (nxt < 0) { cc = F.fhConns(cur); for (const r of cc) if (r !== via && r !== to && F.fhClaims(cur, r, to) && ok(r)) { nxt = r; break; } }
      if (nxt < 0) { const c = F.fhCrumb(cur, to, via); if (ok(c)) nxt = c; }
      if (nxt < 0) for (const r of cc) if (r !== via && r !== to && r !== cur) { if (ok(r)) nxt = r; break; }
      if (nxt < 0) return -1;
    }
  };
  const sigSend = (me, to, preferWalk, ns) => {
    const may = sigMayRelay(me, to), up = sigSock(me);
    const nat = NOSOCK.get(idPair(me, to)); const nsr = nat !== undefined && TICK() - nat < SIG_NOSOCK_T;
    if (!up || nsr || preferWalk || !may) {
      const r = sigWalk(me, to);
      if (r >= 0) return r;
      if (r === -1) return -1;
      if (!may) return -1;
    }
    if (!up) return -1;
    if (!sigSock(to)) { if (NOSOCK.size > 2048) NOSOCK.clear(); NOSOCK.set(idPair(me, to), TICK()); ns.v = true; return -1; }
    sigHeard(to, me); return 0;
  };
  const sigAnswer = (L, x, y, sponsored) => {
    L.sigGot |= (1 << lEnd(x, y));
    if (!alive[x] || isFrozen(x)) return;
    const ns = { v: false }; const d = sigSend(x, y, sponsored, ns);
    if (d < 0) return;
    L.sigGot |= (1 << lEnd(y, x)); L.sigAt = TICK() + d;
  };
  const sigOfferFrom = (L, a, b, ns) => {
    const d = sigSend(a, b, false, ns); if (d < 0) return;
    if (d === 0) sigAnswer(L, b, a, false); else lk().levPush(TICK() + d, lk().EV_SIGA, b, a, L.epoch, 'sig', 1);
  };
  const sigGap = (L, a, b, n, init) => {
    if (!sigSeated(a)) return SIG_RETRY_DOOR;
    if (L.wasOpen) return SIG_RETRY_UP;
    if (init) return n === 0 ? lk().ldraw(1, 4, a, b, 0x73696762) : n === 1 ? SIG_RETRY_CURE : SIG_RETRY_QUIET;
    return n === 0 ? SIG_RETRY_POLITE : SIG_RETRY_QUIET;
  };
  const sigEvent = (L, v) => {
    if (L.epoch !== v.epoch || L.state !== E.LK_DIALING || L.sigAt >= 0) return;
    if (v.kind === lk().EV_SIGA) { sigAnswer(L, v.a, v.b, v.ref !== 0); return; }
    const a = v.a, b = v.b, n = v.ref;
    if (!alive[a]) return;
    const init = sigInit(a, b);
    if (!isFrozen(a)) {
      const ns = { v: false };
      if (n > 0) X.netSignal(a, b);
      if (!init && n === 0) {
        if (sigSock(a) && sigMayRelay(a, b)) {
          if (sigSock(b)) { sigHeard(b, a); if (alive[b] && !isFrozen(b)) sigOfferFrom(L, b, a, ns); ns.v = false; }
          else { NOSOCK.set(idPair(a, b), TICK()); ns.v = true; }
        }
      } else sigOfferFrom(L, a, b, ns);
      if (L.sigAt >= 0) return;
      if (ns.v && sigSeated(a) && !L.wasOpen) { lk().sigFail(L, a, b); return; }
    }
    lk().levPush(TICK() + sigGap(L, a, b, n, init), lk().EV_SIGO, a, b, L.epoch, 'sig', n + 1);
  };
  fab.plug({ sigEvent, sigReset });
}
module.exports = { install };
