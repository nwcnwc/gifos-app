/*
 * msg.js: the mesh message: type names, field defaults, and the sparse JSON form.
 * GENERATED from the message spec: do not edit by hand.
 *
 * A message is a plain object. Its first field is `t`, the type name (a string
 * from MT_NAMES). Fields hold their default until set. Writing is sparse: `t`
 * first, then only the fields that differ from their default, in field order
 * (the same bytes JSON.stringify gives for the parsed form). Reading fills the
 * defaults back in and rejects unknown fields and unknown type names.
 *
 * Numbers are JS numbers. Every hash, key and token is 32-bit, and every
 * 64-bit field (u64) is a cell key or a tick, always below 2^53.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};

  const MT_NAMES = Object.freeze(["GREETERS","WHOHOME","HOME","FIND","FINDLEAF","PLACE","NOROOM","HELLO","YIELD","CLAIM","LEAVE","GREETWALK","S1SYNC","DRAIN","CHALLENGE","CONFIRM","PHONE","PONG","ROUTE","ROUTED","KNOCK","TRANSLOST","MOVED","SITPING","SITPONG","SITXFER","OFFER","FINDACK","PP","RECLAIM","RECLAIMED","RECLAIMNO","U2BEAT","U2ACK","E1STATE","SWAPQ","SWAPRDY","SWAPGO","MEET","MEETACK","WALK","UNNEEDED","BUSY","GOTHOME","HANDOFF","TAKEOVER","TAKEN","AUDITQ","AUDITA","LGSTARVE","LGASK","LGCOMP","PLACED","WITNESS","UPOFFER"]);
  const MT = Object.freeze(Object.fromEntries(MT_NAMES.map(n => [n, n])));
  const MT_SET = new Set(MT_NAMES);
  function checkMT(t) { if (!MT_SET.has(t)) throw new Error("msg: unknown type " + t); return t; }
  function rejectUnknown(o, names, what) {
    for (const k of Object.keys(o)) if (!names.has(k)) throw new Error("msg: " + what + " has unknown field " + k);
  }

  // Coord (written whole)
  const Coord_FIELDS = new Set(["pc","r","i"]);
  function newCoord() { return { pc: 0, r: 0, i: 0 }; }
  function writeCoord(x) { return { pc: x.pc, r: x.r, i: x.i }; }
  function readCoord(o) {
    rejectUnknown(o, Coord_FIELDS, "Coord");
    const x = newCoord();
    if (o.pc !== undefined) x.pc = o.pc;
    if (o.r !== undefined) x.r = o.r;
    if (o.i !== undefined) x.i = o.i;
    return x;
  }

  // KV (written whole)
  const KV_FIELDS = new Set(["k","v"]);
  function newKV() { return { k: 0, v: 0 }; }
  function writeKV(x) { return { k: x.k, v: x.v }; }
  function readKV(o) {
    rejectUnknown(o, KV_FIELDS, "KV");
    const x = newKV();
    if (o.k !== undefined) x.k = o.k;
    if (o.v !== undefined) x.v = o.v;
    return x;
  }

  // LE (written whole)
  const LE_FIELDS = new Set(["id","k","f"]);
  function newLE() { return { id: -1, k: 0, f: 0 }; }
  function writeLE(x) { return { id: x.id, k: x.k, f: x.f }; }
  function readLE(o) {
    rejectUnknown(o, LE_FIELDS, "LE");
    const x = newLE();
    if (o.id !== undefined) x.id = o.id;
    if (o.k !== undefined) x.k = o.k;
    if (o.f !== undefined) x.f = o.f;
    return x;
  }

  // VE (written whole)
  const VE_FIELDS = new Set(["tgt","up","dn"]);
  function newVE() { return { tgt: -1, up: 0, dn: 0 }; }
  function writeVE(x) { return { tgt: x.tgt, up: x.up, dn: x.dn }; }
  function readVE(o) {
    rejectUnknown(o, VE_FIELDS, "VE");
    const x = newVE();
    if (o.tgt !== undefined) x.tgt = o.tgt;
    if (o.up !== undefined) x.up = o.up;
    if (o.dn !== undefined) x.dn = o.dn;
    return x;
  }

  // KStmt (written sparse)
  const KStmt_FIELDS = new Set(["voter","signer","tn","ver","ck","good","all","yes","abs"]);
  function newKStmt() { return { voter: -1, signer: -1, tn: -1, ver: -1, ck: 0, good: false, all: false, yes: [], abs: [] }; }
  const KStmt_DEF = {};
  function writeKStmt(x) {
    const o = {};
    if (x.voter !== -1) o.voter = x.voter;
    if (x.signer !== -1) o.signer = x.signer;
    if (x.tn !== -1) o.tn = x.tn;
    if (x.ver !== -1) o.ver = x.ver;
    if (x.ck !== 0) o.ck = x.ck;
    if (x.good !== false) o.good = x.good;
    if (x.all !== false) o.all = x.all;
    if (x.yes.length) o.yes = x.yes.slice();
    if (x.abs.length) o.abs = x.abs.slice();
    return o;
  }
  function readKStmt(o) {
    rejectUnknown(o, KStmt_FIELDS, "KStmt");
    const x = newKStmt();
    if (o.voter !== undefined) x.voter = o.voter;
    if (o.signer !== undefined) x.signer = o.signer;
    if (o.tn !== undefined) x.tn = o.tn;
    if (o.ver !== undefined) x.ver = o.ver;
    if (o.ck !== undefined) x.ck = o.ck;
    if (o.good !== undefined) x.good = o.good;
    if (o.all !== undefined) x.all = o.all;
    if (o.yes !== undefined) x.yes = o.yes.slice();
    if (o.abs !== undefined) x.abs = o.abs.slice();
    return x;
  }

  // Dig (written sparse)
  const Dig_FIELDS = new Set(["n","refuse","freeC","at","by","dmin","ag","rx","part","leased","handN","awayN","hands","stage","apps","votes","talk","kick","kabs","kOwn","kl"]);
  function newDig() { return { n: 0, refuse: 0, freeC: 0, at: -1, by: -1, dmin: 99, ag: 0, rx: -1, part: 0, leased: 0, handN: 0, awayN: 0, hands: [], stage: [], apps: [], votes: [], talk: [], kick: [], kabs: 0, kOwn: newKStmt(), kl: [] }; }
  const Dig_DEF = {};
  function writeDig(x) {
    const o = {};
    if (x.n !== 0) o.n = x.n;
    if (x.refuse !== 0) o.refuse = x.refuse;
    if (x.freeC !== 0) o.freeC = x.freeC;
    if (x.at !== -1) o.at = x.at;
    if (x.by !== -1) o.by = x.by;
    if (x.dmin !== 99) o.dmin = x.dmin;
    if (x.ag !== 0) o.ag = x.ag;
    if (x.rx !== -1) o.rx = x.rx;
    if (x.part !== 0) o.part = x.part;
    if (x.leased !== 0) o.leased = x.leased;
    if (x.handN !== 0) o.handN = x.handN;
    if (x.awayN !== 0) o.awayN = x.awayN;
    if (x.hands.length) o.hands = x.hands.map(writeLE);
    if (x.stage.length) o.stage = x.stage.map(writeLE);
    if (x.apps.length) o.apps = x.apps.map(writeLE);
    if (x.votes.length) o.votes = x.votes.map(writeVE);
    if (x.talk.length) o.talk = x.talk.map(writeLE);
    if (x.kick.length) o.kick = x.kick.map(writeVE);
    if (x.kabs !== 0) o.kabs = x.kabs;
    { const v = writeKStmt(x.kOwn); if (JSON.stringify(v) !== Dig_DEF.kOwn) o.kOwn = v; }
    if (x.kl.length) o.kl = x.kl.map(writeKStmt);
    return o;
  }
  function readDig(o) {
    rejectUnknown(o, Dig_FIELDS, "Dig");
    const x = newDig();
    if (o.n !== undefined) x.n = o.n;
    if (o.refuse !== undefined) x.refuse = o.refuse;
    if (o.freeC !== undefined) x.freeC = o.freeC;
    if (o.at !== undefined) x.at = o.at;
    if (o.by !== undefined) x.by = o.by;
    if (o.dmin !== undefined) x.dmin = o.dmin;
    if (o.ag !== undefined) x.ag = o.ag;
    if (o.rx !== undefined) x.rx = o.rx;
    if (o.part !== undefined) x.part = o.part;
    if (o.leased !== undefined) x.leased = o.leased;
    if (o.handN !== undefined) x.handN = o.handN;
    if (o.awayN !== undefined) x.awayN = o.awayN;
    if (o.hands !== undefined) x.hands = o.hands.map(readLE);
    if (o.stage !== undefined) x.stage = o.stage.map(readLE);
    if (o.apps !== undefined) x.apps = o.apps.map(readLE);
    if (o.votes !== undefined) x.votes = o.votes.map(readVE);
    if (o.talk !== undefined) x.talk = o.talk.map(readLE);
    if (o.kick !== undefined) x.kick = o.kick.map(readVE);
    if (o.kabs !== undefined) x.kabs = o.kabs;
    if (o.kOwn !== undefined) x.kOwn = readKStmt(o.kOwn);
    if (o.kl !== undefined) x.kl = o.kl.map(readKStmt);
    return x;
  }

  // DigE (written whole)
  const DigE_FIELDS = new Set(["k","d"]);
  function newDigE() { return { k: 0, d: newDig() }; }
  function writeDigE(x) { return { k: x.k, d: writeDig(x.d) }; }
  function readDigE(o) {
    rejectUnknown(o, DigE_FIELDS, "DigE");
    const x = newDigE();
    if (o.k !== undefined) x.k = o.k;
    if (o.d !== undefined) x.d = readDig(o.d);
    return x;
  }

  // Ent (written whole)
  const Ent_FIELDS = new Set(["k","v","age","ch","ba","tn"]);
  function newEnt() { return { k: 0, v: 0, age: 0, ch: -1, ba: -1, tn: 0 }; }
  function writeEnt(x) { return { k: x.k, v: x.v, age: x.age, ch: x.ch, ba: x.ba, tn: x.tn }; }
  function readEnt(o) {
    rejectUnknown(o, Ent_FIELDS, "Ent");
    const x = newEnt();
    if (o.k !== undefined) x.k = o.k;
    if (o.v !== undefined) x.v = o.v;
    if (o.age !== undefined) x.age = o.age;
    if (o.ch !== undefined) x.ch = o.ch;
    if (o.ba !== undefined) x.ba = o.ba;
    if (o.tn !== undefined) x.tn = o.tn;
    return x;
  }

  // the written form of each nested default, computed once
  Dig_DEF.kOwn = JSON.stringify(writeKStmt(newKStmt()));

  // Msg
  const Msg_FIELDS = new Set(["t", "to", "from", "id", "owner", "nc", "asker", "via", "child", "ttl", "tag", "hold", "vAt", "fOwn", "fCnt", "adoor", "dsat", "nosock", "fo", "foAt", "mpBy", "mpAt", "mpK", "mpOld", "fsig", "split", "gwc", "mv", "ck", "oCk", "tock", "gkey", "mvd", "coord", "hole", "target", "kids", "mass", "l31", "l31Ck", "l31By", "l31At", "knock", "wordHeld", "spread", "sh", "dark", "dk", "nd", "list", "roster", "nbrs", "ent", "row", "byes", "l20", "dgUp", "dgPub", "dgEcho", "dgRoot", "digs", "l10E", "dgOnly", "bkId", "u3Id", "bkCk", "u3Ck", "e1dn", "e1At", "routing", "rfinal", "rttl", "rvia", "rdst", "direct", "lk", "sig", "sigAt", "lkEp", "rl", "pst", "hard", "l18", "uxTo", "uxId", "rel", "yl", "bye", "tok", "pp", "ppAt", "rg", "yp", "tn", "rmKids", "l9s", "arr", "born", "pn", "pseq", "l12", "l12s", "l12n", "c7", "c7Min", "c7Held", "cutF", "lineF", "line", "late", "tier", "nat", "th", "sw", "swHd", "swA", "swB", "swAt", "swCk", "swCa", "swCb", "fhTo", "fhOrig", "fhTtl", "fhId", "fhTc", "kv", "kbk", "tx", "sigL", "ppL", "mpL", "foL", "l31L", "swL", "aId", "sgw", "aCk", "sgwCk"]);
  const Msg_DEF = {};
  function newMsg(t) {
    return { t: checkMT(t), to: -1, from: -1, id: -1, owner: -1, nc: -1, asker: -1, via: -1, child: -1, ttl: 0, tag: 0, hold: 0, vAt: -1, fOwn: -1, fCnt: 0, adoor: false, dsat: false, nosock: false, fo: -1, foAt: -1, mpBy: -1, mpAt: -1, mpK: 0, mpOld: 0, fsig: false, split: false, gwc: false, mv: false, ck: 0, oCk: 0, tock: 0, gkey: 0, mvd: 0, coord: newCoord(), hole: newCoord(), target: newCoord(), kids: false, mass: false, l31: 0, l31Ck: 0, l31By: -1, l31At: -1, knock: false, wordHeld: false, spread: false, sh: 0, dark: [], dk: false, nd: 0, list: [], roster: [], nbrs: [], ent: [], row: [], byes: [], l20: [], dgUp: newDig(), dgPub: newDig(), dgEcho: newDig(), dgRoot: newDig(), digs: [], l10E: false, dgOnly: false, bkId: -1, u3Id: -1, bkCk: 0, u3Ck: 0, e1dn: false, e1At: -1, routing: false, rfinal: -1, rttl: 0, rvia: -1, rdst: newCoord(), direct: false, lk: -1, sig: false, sigAt: -1, lkEp: 0, rl: false, pst: false, hard: false, l18: false, uxTo: -1, uxId: -1, rel: false, yl: false, bye: false, tok: 0, pp: -1, ppAt: -1, rg: -1, yp: false, tn: -1, rmKids: false, l9s: false, arr: -1, born: -1, pn: -1, pseq: -1, l12: false, l12s: 0, l12n: 0, c7: false, c7Min: -1, c7Held: false, cutF: false, lineF: false, line: -1, late: false, tier: 0, nat: 0, th: 0, sw: -1, swHd: -1, swA: -1, swB: -1, swAt: -1, swCk: 0, swCa: 0, swCb: 0, fhTo: -1, fhOrig: -1, fhTtl: 0, fhId: 0, fhTc: 0, kv: newKStmt(), kbk: false, tx: -1, sigL: -1, ppL: -1, mpL: -1, foL: -1, l31L: -1, swL: -1, aId: -1, sgw: -1, aCk: 0, sgwCk: 0 };
  }
  function writeMsg(m) {
    const o = { t: m.t };
    if (m.to !== -1) o.to = m.to;
    if (m.from !== -1) o.from = m.from;
    if (m.id !== -1) o.id = m.id;
    if (m.owner !== -1) o.owner = m.owner;
    if (m.nc !== -1) o.nc = m.nc;
    if (m.asker !== -1) o.asker = m.asker;
    if (m.via !== -1) o.via = m.via;
    if (m.child !== -1) o.child = m.child;
    if (m.ttl !== 0) o.ttl = m.ttl;
    if (m.tag !== 0) o.tag = m.tag;
    if (m.hold !== 0) o.hold = m.hold;
    if (m.vAt !== -1) o.vAt = m.vAt;
    if (m.fOwn !== -1) o.fOwn = m.fOwn;
    if (m.fCnt !== 0) o.fCnt = m.fCnt;
    if (m.adoor !== false) o.adoor = m.adoor;
    if (m.dsat !== false) o.dsat = m.dsat;
    if (m.nosock !== false) o.nosock = m.nosock;
    if (m.fo !== -1) o.fo = m.fo;
    if (m.foAt !== -1) o.foAt = m.foAt;
    if (m.mpBy !== -1) o.mpBy = m.mpBy;
    if (m.mpAt !== -1) o.mpAt = m.mpAt;
    if (m.mpK !== 0) o.mpK = m.mpK;
    if (m.mpOld !== 0) o.mpOld = m.mpOld;
    if (m.fsig !== false) o.fsig = m.fsig;
    if (m.split !== false) o.split = m.split;
    if (m.gwc !== false) o.gwc = m.gwc;
    if (m.mv !== false) o.mv = m.mv;
    if (m.ck !== 0) o.ck = m.ck;
    if (m.oCk !== 0) o.oCk = m.oCk;
    if (m.tock !== 0) o.tock = m.tock;
    if (m.gkey !== 0) o.gkey = m.gkey;
    if (m.mvd !== 0) o.mvd = m.mvd;
    { const v = writeCoord(m.coord); if (JSON.stringify(v) !== Msg_DEF.coord) o.coord = v; }
    { const v = writeCoord(m.hole); if (JSON.stringify(v) !== Msg_DEF.hole) o.hole = v; }
    { const v = writeCoord(m.target); if (JSON.stringify(v) !== Msg_DEF.target) o.target = v; }
    if (m.kids !== false) o.kids = m.kids;
    if (m.mass !== false) o.mass = m.mass;
    if (m.l31 !== 0) o.l31 = m.l31;
    if (m.l31Ck !== 0) o.l31Ck = m.l31Ck;
    if (m.l31By !== -1) o.l31By = m.l31By;
    if (m.l31At !== -1) o.l31At = m.l31At;
    if (m.knock !== false) o.knock = m.knock;
    if (m.wordHeld !== false) o.wordHeld = m.wordHeld;
    if (m.spread !== false) o.spread = m.spread;
    if (m.sh !== 0) o.sh = m.sh;
    if (m.dark.length) o.dark = m.dark.slice();
    if (m.dk !== false) o.dk = m.dk;
    if (m.nd !== 0) o.nd = m.nd;
    if (m.list.length) o.list = m.list.slice();
    if (m.roster.length) o.roster = m.roster.map(writeKV);
    if (m.nbrs.length) o.nbrs = m.nbrs.map(writeKV);
    if (m.ent.length) o.ent = m.ent.map(writeEnt);
    if (m.row.length) o.row = m.row.map(writeEnt);
    if (m.byes.length) o.byes = m.byes.slice();
    if (m.l20.length) o.l20 = m.l20.map(writeKV);
    { const v = writeDig(m.dgUp); if (JSON.stringify(v) !== Msg_DEF.dgUp) o.dgUp = v; }
    { const v = writeDig(m.dgPub); if (JSON.stringify(v) !== Msg_DEF.dgPub) o.dgPub = v; }
    { const v = writeDig(m.dgEcho); if (JSON.stringify(v) !== Msg_DEF.dgEcho) o.dgEcho = v; }
    { const v = writeDig(m.dgRoot); if (JSON.stringify(v) !== Msg_DEF.dgRoot) o.dgRoot = v; }
    if (m.digs.length) o.digs = m.digs.map(writeDigE);
    if (m.l10E !== false) o.l10E = m.l10E;
    if (m.dgOnly !== false) o.dgOnly = m.dgOnly;
    if (m.bkId !== -1) o.bkId = m.bkId;
    if (m.u3Id !== -1) o.u3Id = m.u3Id;
    if (m.bkCk !== 0) o.bkCk = m.bkCk;
    if (m.u3Ck !== 0) o.u3Ck = m.u3Ck;
    if (m.e1dn !== false) o.e1dn = m.e1dn;
    if (m.e1At !== -1) o.e1At = m.e1At;
    if (m.routing !== false) o.routing = m.routing;
    if (m.rfinal !== -1) o.rfinal = m.rfinal;
    if (m.rttl !== 0) o.rttl = m.rttl;
    if (m.rvia !== -1) o.rvia = m.rvia;
    { const v = writeCoord(m.rdst); if (JSON.stringify(v) !== Msg_DEF.rdst) o.rdst = v; }
    if (m.direct !== false) o.direct = m.direct;
    if (m.lk !== -1) o.lk = m.lk;
    if (m.sig !== false) o.sig = m.sig;
    if (m.sigAt !== -1) o.sigAt = m.sigAt;
    if (m.lkEp !== 0) o.lkEp = m.lkEp;
    if (m.rl !== false) o.rl = m.rl;
    if (m.pst !== false) o.pst = m.pst;
    if (m.hard !== false) o.hard = m.hard;
    if (m.l18 !== false) o.l18 = m.l18;
    if (m.uxTo !== -1) o.uxTo = m.uxTo;
    if (m.uxId !== -1) o.uxId = m.uxId;
    if (m.rel !== false) o.rel = m.rel;
    if (m.yl !== false) o.yl = m.yl;
    if (m.bye !== false) o.bye = m.bye;
    if (m.tok !== 0) o.tok = m.tok;
    if (m.pp !== -1) o.pp = m.pp;
    if (m.ppAt !== -1) o.ppAt = m.ppAt;
    if (m.rg !== -1) o.rg = m.rg;
    if (m.yp !== false) o.yp = m.yp;
    if (m.tn !== -1) o.tn = m.tn;
    if (m.rmKids !== false) o.rmKids = m.rmKids;
    if (m.l9s !== false) o.l9s = m.l9s;
    if (m.arr !== -1) o.arr = m.arr;
    if (m.born !== -1) o.born = m.born;
    if (m.pn !== -1) o.pn = m.pn;
    if (m.pseq !== -1) o.pseq = m.pseq;
    if (m.l12 !== false) o.l12 = m.l12;
    if (m.l12s !== 0) o.l12s = m.l12s;
    if (m.l12n !== 0) o.l12n = m.l12n;
    if (m.c7 !== false) o.c7 = m.c7;
    if (m.c7Min !== -1) o.c7Min = m.c7Min;
    if (m.c7Held !== false) o.c7Held = m.c7Held;
    if (m.cutF !== false) o.cutF = m.cutF;
    if (m.lineF !== false) o.lineF = m.lineF;
    if (m.line !== -1) o.line = m.line;
    if (m.late !== false) o.late = m.late;
    if (m.tier !== 0) o.tier = m.tier;
    if (m.nat !== 0) o.nat = m.nat;
    if (m.th !== 0) o.th = m.th;
    if (m.sw !== -1) o.sw = m.sw;
    if (m.swHd !== -1) o.swHd = m.swHd;
    if (m.swA !== -1) o.swA = m.swA;
    if (m.swB !== -1) o.swB = m.swB;
    if (m.swAt !== -1) o.swAt = m.swAt;
    if (m.swCk !== 0) o.swCk = m.swCk;
    if (m.swCa !== 0) o.swCa = m.swCa;
    if (m.swCb !== 0) o.swCb = m.swCb;
    if (m.fhTo !== -1) o.fhTo = m.fhTo;
    if (m.fhOrig !== -1) o.fhOrig = m.fhOrig;
    if (m.fhTtl !== 0) o.fhTtl = m.fhTtl;
    if (m.fhId !== 0) o.fhId = m.fhId;
    if (m.fhTc !== 0) o.fhTc = m.fhTc;
    { const v = writeKStmt(m.kv); if (JSON.stringify(v) !== Msg_DEF.kv) o.kv = v; }
    if (m.kbk !== false) o.kbk = m.kbk;
    if (m.tx !== -1) o.tx = m.tx;
    if (m.sigL !== -1) o.sigL = m.sigL;
    if (m.ppL !== -1) o.ppL = m.ppL;
    if (m.mpL !== -1) o.mpL = m.mpL;
    if (m.foL !== -1) o.foL = m.foL;
    if (m.l31L !== -1) o.l31L = m.l31L;
    if (m.swL !== -1) o.swL = m.swL;
    if (m.aId !== -1) o.aId = m.aId;
    if (m.sgw !== -1) o.sgw = m.sgw;
    if (m.aCk !== 0) o.aCk = m.aCk;
    if (m.sgwCk !== 0) o.sgwCk = m.sgwCk;
    return o;
  }
  function readMsg(o) {
    rejectUnknown(o, Msg_FIELDS, "Msg");
    const m = newMsg(o.t);
    if (o.to !== undefined) m.to = o.to;
    if (o.from !== undefined) m.from = o.from;
    if (o.id !== undefined) m.id = o.id;
    if (o.owner !== undefined) m.owner = o.owner;
    if (o.nc !== undefined) m.nc = o.nc;
    if (o.asker !== undefined) m.asker = o.asker;
    if (o.via !== undefined) m.via = o.via;
    if (o.child !== undefined) m.child = o.child;
    if (o.ttl !== undefined) m.ttl = o.ttl;
    if (o.tag !== undefined) m.tag = o.tag;
    if (o.hold !== undefined) m.hold = o.hold;
    if (o.vAt !== undefined) m.vAt = o.vAt;
    if (o.fOwn !== undefined) m.fOwn = o.fOwn;
    if (o.fCnt !== undefined) m.fCnt = o.fCnt;
    if (o.adoor !== undefined) m.adoor = o.adoor;
    if (o.dsat !== undefined) m.dsat = o.dsat;
    if (o.nosock !== undefined) m.nosock = o.nosock;
    if (o.fo !== undefined) m.fo = o.fo;
    if (o.foAt !== undefined) m.foAt = o.foAt;
    if (o.mpBy !== undefined) m.mpBy = o.mpBy;
    if (o.mpAt !== undefined) m.mpAt = o.mpAt;
    if (o.mpK !== undefined) m.mpK = o.mpK;
    if (o.mpOld !== undefined) m.mpOld = o.mpOld;
    if (o.fsig !== undefined) m.fsig = o.fsig;
    if (o.split !== undefined) m.split = o.split;
    if (o.gwc !== undefined) m.gwc = o.gwc;
    if (o.mv !== undefined) m.mv = o.mv;
    if (o.ck !== undefined) m.ck = o.ck;
    if (o.oCk !== undefined) m.oCk = o.oCk;
    if (o.tock !== undefined) m.tock = o.tock;
    if (o.gkey !== undefined) m.gkey = o.gkey;
    if (o.mvd !== undefined) m.mvd = o.mvd;
    if (o.coord !== undefined) m.coord = readCoord(o.coord);
    if (o.hole !== undefined) m.hole = readCoord(o.hole);
    if (o.target !== undefined) m.target = readCoord(o.target);
    if (o.kids !== undefined) m.kids = o.kids;
    if (o.mass !== undefined) m.mass = o.mass;
    if (o.l31 !== undefined) m.l31 = o.l31;
    if (o.l31Ck !== undefined) m.l31Ck = o.l31Ck;
    if (o.l31By !== undefined) m.l31By = o.l31By;
    if (o.l31At !== undefined) m.l31At = o.l31At;
    if (o.knock !== undefined) m.knock = o.knock;
    if (o.wordHeld !== undefined) m.wordHeld = o.wordHeld;
    if (o.spread !== undefined) m.spread = o.spread;
    if (o.sh !== undefined) m.sh = o.sh;
    if (o.dark !== undefined) m.dark = o.dark.slice();
    if (o.dk !== undefined) m.dk = o.dk;
    if (o.nd !== undefined) m.nd = o.nd;
    if (o.list !== undefined) m.list = o.list.slice();
    if (o.roster !== undefined) m.roster = o.roster.map(readKV);
    if (o.nbrs !== undefined) m.nbrs = o.nbrs.map(readKV);
    if (o.ent !== undefined) m.ent = o.ent.map(readEnt);
    if (o.row !== undefined) m.row = o.row.map(readEnt);
    if (o.byes !== undefined) m.byes = o.byes.slice();
    if (o.l20 !== undefined) m.l20 = o.l20.map(readKV);
    if (o.dgUp !== undefined) m.dgUp = readDig(o.dgUp);
    if (o.dgPub !== undefined) m.dgPub = readDig(o.dgPub);
    if (o.dgEcho !== undefined) m.dgEcho = readDig(o.dgEcho);
    if (o.dgRoot !== undefined) m.dgRoot = readDig(o.dgRoot);
    if (o.digs !== undefined) m.digs = o.digs.map(readDigE);
    if (o.l10E !== undefined) m.l10E = o.l10E;
    if (o.dgOnly !== undefined) m.dgOnly = o.dgOnly;
    if (o.bkId !== undefined) m.bkId = o.bkId;
    if (o.u3Id !== undefined) m.u3Id = o.u3Id;
    if (o.bkCk !== undefined) m.bkCk = o.bkCk;
    if (o.u3Ck !== undefined) m.u3Ck = o.u3Ck;
    if (o.e1dn !== undefined) m.e1dn = o.e1dn;
    if (o.e1At !== undefined) m.e1At = o.e1At;
    if (o.routing !== undefined) m.routing = o.routing;
    if (o.rfinal !== undefined) m.rfinal = o.rfinal;
    if (o.rttl !== undefined) m.rttl = o.rttl;
    if (o.rvia !== undefined) m.rvia = o.rvia;
    if (o.rdst !== undefined) m.rdst = readCoord(o.rdst);
    if (o.direct !== undefined) m.direct = o.direct;
    if (o.lk !== undefined) m.lk = o.lk;
    if (o.sig !== undefined) m.sig = o.sig;
    if (o.sigAt !== undefined) m.sigAt = o.sigAt;
    if (o.lkEp !== undefined) m.lkEp = o.lkEp;
    if (o.rl !== undefined) m.rl = o.rl;
    if (o.pst !== undefined) m.pst = o.pst;
    if (o.hard !== undefined) m.hard = o.hard;
    if (o.l18 !== undefined) m.l18 = o.l18;
    if (o.uxTo !== undefined) m.uxTo = o.uxTo;
    if (o.uxId !== undefined) m.uxId = o.uxId;
    if (o.rel !== undefined) m.rel = o.rel;
    if (o.yl !== undefined) m.yl = o.yl;
    if (o.bye !== undefined) m.bye = o.bye;
    if (o.tok !== undefined) m.tok = o.tok;
    if (o.pp !== undefined) m.pp = o.pp;
    if (o.ppAt !== undefined) m.ppAt = o.ppAt;
    if (o.rg !== undefined) m.rg = o.rg;
    if (o.yp !== undefined) m.yp = o.yp;
    if (o.tn !== undefined) m.tn = o.tn;
    if (o.rmKids !== undefined) m.rmKids = o.rmKids;
    if (o.l9s !== undefined) m.l9s = o.l9s;
    if (o.arr !== undefined) m.arr = o.arr;
    if (o.born !== undefined) m.born = o.born;
    if (o.pn !== undefined) m.pn = o.pn;
    if (o.pseq !== undefined) m.pseq = o.pseq;
    if (o.l12 !== undefined) m.l12 = o.l12;
    if (o.l12s !== undefined) m.l12s = o.l12s;
    if (o.l12n !== undefined) m.l12n = o.l12n;
    if (o.c7 !== undefined) m.c7 = o.c7;
    if (o.c7Min !== undefined) m.c7Min = o.c7Min;
    if (o.c7Held !== undefined) m.c7Held = o.c7Held;
    if (o.cutF !== undefined) m.cutF = o.cutF;
    if (o.lineF !== undefined) m.lineF = o.lineF;
    if (o.line !== undefined) m.line = o.line;
    if (o.late !== undefined) m.late = o.late;
    if (o.tier !== undefined) m.tier = o.tier;
    if (o.nat !== undefined) m.nat = o.nat;
    if (o.th !== undefined) m.th = o.th;
    if (o.sw !== undefined) m.sw = o.sw;
    if (o.swHd !== undefined) m.swHd = o.swHd;
    if (o.swA !== undefined) m.swA = o.swA;
    if (o.swB !== undefined) m.swB = o.swB;
    if (o.swAt !== undefined) m.swAt = o.swAt;
    if (o.swCk !== undefined) m.swCk = o.swCk;
    if (o.swCa !== undefined) m.swCa = o.swCa;
    if (o.swCb !== undefined) m.swCb = o.swCb;
    if (o.fhTo !== undefined) m.fhTo = o.fhTo;
    if (o.fhOrig !== undefined) m.fhOrig = o.fhOrig;
    if (o.fhTtl !== undefined) m.fhTtl = o.fhTtl;
    if (o.fhId !== undefined) m.fhId = o.fhId;
    if (o.fhTc !== undefined) m.fhTc = o.fhTc;
    if (o.kv !== undefined) m.kv = readKStmt(o.kv);
    if (o.kbk !== undefined) m.kbk = o.kbk;
    if (o.tx !== undefined) m.tx = o.tx;
    if (o.sigL !== undefined) m.sigL = o.sigL;
    if (o.ppL !== undefined) m.ppL = o.ppL;
    if (o.mpL !== undefined) m.mpL = o.mpL;
    if (o.foL !== undefined) m.foL = o.foL;
    if (o.l31L !== undefined) m.l31L = o.l31L;
    if (o.swL !== undefined) m.swL = o.swL;
    if (o.aId !== undefined) m.aId = o.aId;
    if (o.sgw !== undefined) m.sgw = o.sgw;
    if (o.aCk !== undefined) m.aCk = o.aCk;
    if (o.sgwCk !== undefined) m.sgwCk = o.sgwCk;
    return m;
  }
  Msg_DEF.coord = JSON.stringify(writeCoord(newCoord()));
  Msg_DEF.hole = JSON.stringify(writeCoord(newCoord()));
  Msg_DEF.target = JSON.stringify(writeCoord(newCoord()));
  Msg_DEF.dgUp = JSON.stringify(writeDig(newDig()));
  Msg_DEF.dgPub = JSON.stringify(writeDig(newDig()));
  Msg_DEF.dgEcho = JSON.stringify(writeDig(newDig()));
  Msg_DEF.dgRoot = JSON.stringify(writeDig(newDig()));
  Msg_DEF.rdst = JSON.stringify(writeCoord(newCoord()));
  Msg_DEF.kv = JSON.stringify(writeKStmt(newKStmt()));
  function encode(m) { return JSON.stringify(writeMsg(m)); }
  function decode(s) { return readMsg(JSON.parse(s)); }
  function clone(m) { return readMsg(writeMsg(m)); }

  // the state fields the per-tick state hash covers, in order
  const STATE_FIELDS = Object.freeze([{"name":"id","type":"i32"},{"name":"state","type":"i32"},{"name":"hasCoord","type":"bool"},{"name":"coord","type":"Coord"},{"name":"occ","type":"{u64:i32}"},{"name":"live","type":"{u64:i32}"},{"name":"s1seen","type":"{u64:i32}"},{"name":"healTry","type":"{u64:i32}"},{"name":"translost","type":"{u64:i32}"},{"name":"kidful","type":"{u64:u8}"},{"name":"noChan","type":"<i32>"},{"name":"byeIds","type":"{i32:i32}"},{"name":"lastAck","type":"i32"},{"name":"healAt","type":"i32"},{"name":"lastPhone","type":"i32"},{"name":"leaseUntil","type":"i64"},{"name":"seatedAt","type":"i32"},{"name":"moving","type":"bool"},{"name":"moveAt","type":"i32"},{"name":"oldCoord","type":"Coord"},{"name":"oldCk","type":"u64"},{"name":"leaseCk","type":"u64"},{"name":"tn","type":"i32"},{"name":"oldTn","type":"i32"},{"name":"pp","type":"i32"},{"name":"ppAt","type":"i32"},{"name":"ppCk","type":"u64"},{"name":"placer","type":"i32"},{"name":"rowGen","type":"i32"},{"name":"roster","type":"[KV]"},{"name":"haveRoster","type":"bool"},{"name":"lastAsked","type":"i32"},{"name":"retryAt","type":"i32"},{"name":"seatTries","type":"i32"},{"name":"askTick","type":"i32"},{"name":"joinTick","type":"i32"},{"name":"genKey","type":"u32"},{"name":"rs","type":"u32"},{"name":"refuses","type":"bool"},{"name":"lastChurn","type":"i32"},{"name":"compactAt","type":"i64"}]);

  const api = Object.freeze({
    MT, MT_NAMES, STATE_FIELDS,
    newMsg, writeMsg, readMsg, encode, decode, clone,
    newCoord, writeCoord, readCoord,
    newKV, writeKV, readKV,
    newLE, writeLE, readLE,
    newVE, writeVE, readVE,
    newKStmt, writeKStmt, readKStmt,
    newDig, writeDig, readDig,
    newDigE, writeDigE, readDigE,
    newEnt, writeEnt, readEnt
  });
  GifOS.meshMsg = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
