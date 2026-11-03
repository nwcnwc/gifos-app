/*
 * state.js: build, copy, dump and restore a seat's state from the generated field tables (seat-fields.js).
 *
 *   init(seat)                 every data member at its C++ default, in declaration order
 *   newStruct(name)            a member struct (SoftSit, Held, ...) or a helper struct at its defaults
 *   copy(v, type)              a deep copy: the C++ copy of a struct value (a Msg, a Dig, a Held, a map ...)
 *   dump(seat[, names])        JSON text of the named members (default: every member), in field order
 *   dumpState(seat)            JSON text of the members the sim's state hash covers (msg.json "seat"),
 *                              byte for byte what MESH_PROOF_STATE writes; its FNV-1a 32 is the hash
 *   restore(seat, obj|text)    set every member present in obj (a dump, or a state.jsonl `s`)
 *
 * The JSON form is the sim's proof form (mesh_proof.inc): a Map is [[k, v], ...] and a Set [...] in
 * insertion order; a Msg, Dig or KStmt is sparse (msg.js); every other struct whole, in field order; a
 * pair is [a, b]; a pointer null.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const msg = isNode ? require('./msg.js') : GifOS.meshMsg;
  const SF = isNode ? require('./seat-fields.js') : GifOS.meshSeatFields;
  const books = isNode ? require('./books.js') : GifOS.meshBooks;
  const fnv = isNode ? require('./fnv.js') : GifOS.meshFnv;

  const SCALARS = new Set(['i8', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'f64']);
  const MSGS = { Coord: 1, KV: 1, LE: 1, VE: 1, KStmt: 1, Dig: 1, DigE: 1, Ent: 1 };
  const BOOKS = { DialBook: books.DialBook, CallBook: books.CallBook };

  // ---- type notation ------------------------------------------------------------------------------------
  const memo = new Map();
  function parse(t) {
    if (memo.has(t)) return memo.get(t);
    let r;
    const split = (s) => { let d = 0; for (let i = 0; i < s.length; i++) { const c = s[i]; if ('{<[('.includes(c)) d++; else if ('}>])'.includes(c)) d--; else if (d === 0 && (c === ':' || c === ',')) return [s.slice(0, i), s.slice(i + 1)]; } throw new Error('state: bad type ' + t); };
    let m;
    if (SCALARS.has(t)) r = { k: 'num' };
    else if (t === 'bool') r = { k: 'bool' };
    else if (t === 'str') r = { k: 'str' };
    else if (t === 'ptr') r = { k: 'ptr' };
    else if (t === 'Msg') r = { k: 'msg' };
    else if (MSGS[t]) r = { k: 'mstruct', name: t };
    else if ((m = /^Bucket<(\w+)>$/.exec(t))) r = { k: 'bucket', intT: m[1] !== 'f64' };
    else if (BOOKS[t]) r = { k: 'book', name: t };
    else if (SF.STRUCTS[t]) r = { k: 'struct', name: t };
    else if (t[0] === '{') { const [a, b] = split(t.slice(1, -1)); r = { k: 'map', key: parse(a), val: parse(b) }; }
    else if (t[0] === '<') r = { k: 'set', key: parse(t.slice(1, -1)) };
    else if (t[0] === '(') { const [a, b] = split(t.slice(1, -1)); r = { k: 'pair', a: parse(a), b: parse(b) }; }
    else if ((m = /^\[(.*);(\d+)\]$/.exec(t))) r = { k: 'fixed', el: parse(m[1]), n: +m[2] };
    else if (t[0] === '[') r = { k: 'arr', el: parse(t.slice(1, -1)) };
    else throw new Error('state: unknown type ' + t);
    memo.set(t, r);
    return r;
  }

  // ---- fresh values ---------------------------------------------------------------------------------------
  // The type's zero (a C++ value-initialized member), or the declared default literal.
  function fresh(T, lit) {
    switch (T.k) {
      case 'num': return lit === undefined ? 0 : lit;
      case 'bool': return lit === undefined ? false : lit;
      case 'str': return lit === undefined ? '' : lit;
      case 'ptr': return null;
      case 'msg': return msg.newMsg('GREETERS');   // a value-initialized Msg (t = 0)
      case 'mstruct': return lit !== undefined && T.name === 'Coord' ? { pc: lit.pc, r: lit.r, i: lit.i } : msg['new' + T.name]();
      case 'bucket': { const b = new books.Bucket(T.intT); if (lit) { b.tok = lit[0]; b.at = lit[1]; } return b; }
      case 'book': return new BOOKS[T.name]();
      case 'struct': return newStruct(T.name);
      case 'map': return new Map();
      case 'set': return new Set();
      case 'pair': return [fresh(T.a), fresh(T.b)];
      case 'fixed': { const a = []; for (let i = 0; i < T.n; i++) a.push(lit ? lit[i] : fresh(T.el)); return a; }
      case 'arr': return [];
    }
    throw new Error('state: fresh ' + T.k);
  }
  function newStruct(name) {
    const fields = SF.STRUCTS[name], defs = SF.STRUCT_DEF[name] || {};
    const o = {};
    for (const [f, t] of fields) o[f] = fresh(parse(t), defs[f]);
    return o;
  }
  // C++: mesh.cpp:Seat
  function init(seat) {
    for (const [f, t] of SF.FIELDS) seat[f] = fresh(parse(t), SF.SEAT_DEF[f]);
  }

  // ---- copy (a C++ struct copy) ---------------------------------------------------------------------------
  function copyT(v, T) {
    switch (T.k) {
      case 'num': case 'bool': case 'str': case 'ptr': return v;
      case 'msg': return msg.clone(v);
      case 'mstruct': return msg['read' + T.name](JSON.parse(JSON.stringify(msg['write' + T.name](v))));
      case 'bucket': { const b = new books.Bucket(T.intT); b.tok = v.tok; b.at = v.at; return b; }
      case 'book': { const b = new BOOKS[T.name](); for (const [f, t] of SF.STRUCTS[T.name]) b[f] = copyT(v[f], parse(t)); return b; }
      case 'struct': { const o = {}; for (const [f, t] of SF.STRUCTS[T.name]) o[f] = copyT(v[f], parse(t)); return o; }
      case 'map': { const m = new Map(); for (const [k, x] of v) m.set(k, copyT(x, T.val)); return m; }
      case 'set': return new Set(v);
      case 'pair': return [copyT(v[0], T.a), copyT(v[1], T.b)];
      case 'fixed': case 'arr': { const el = T.el; return v.map((x) => copyT(x, el)); }
    }
    throw new Error('state: copy ' + T.k);
  }
  function copy(v, type) { return copyT(v, parse(type)); }

  // ---- dump: the proof form -------------------------------------------------------------------------------
  function out(v, T) {
    switch (T.k) {
      case 'num': case 'bool': case 'str': return v;
      case 'ptr': return null;
      case 'msg': return msg.writeMsg(v);
      case 'mstruct': return msg['write' + T.name](v);
      case 'bucket': return { tok: v.tok, at: v.at };
      case 'book': case 'struct': { const o = {}; for (const [f, t] of SF.STRUCTS[T.name]) o[f] = out(v[f], parse(t)); return o; }
      case 'map': { const a = []; for (const [k, x] of v) a.push([out(k, T.key), out(x, T.val)]); return a; }
      case 'set': { const a = []; for (const k of v) a.push(out(k, T.key)); return a; }
      case 'pair': return [out(v[0], T.a), out(v[1], T.b)];
      case 'fixed': case 'arr': { const el = T.el; return v.map((x) => out(x, el)); }
    }
    throw new Error('state: dump ' + T.k);
  }
  const TYPE = new Map(SF.FIELDS);
  function dumpObj(seat, names) {
    const o = {};
    for (const f of names || SF.FIELDS.map((x) => x[0])) {
      const t = TYPE.get(f); if (t === undefined) throw new Error('state: no member ' + f);
      o[f] = out(seat[f], parse(t));
    }
    return o;
  }
  function dump(seat, names) { return JSON.stringify(dumpObj(seat, names)); }

  // The state the sim hashes per tick (msg.json "seat", in that order).
  const STATE_NAMES = msg.STATE_FIELDS.map((f) => f.name);
  for (const f of msg.STATE_FIELDS) if (TYPE.get(f.name) !== f.type) throw new Error('state: state field ' + f.name + ' is ' + TYPE.get(f.name) + ' here, ' + f.type + ' in msg.json');
  function dumpState(seat) { return dump(seat, STATE_NAMES); }
  function stateHash(seat) { return fnv.str(dumpState(seat)); }

  // ---- restore ----------------------------------------------------------------------------------------------
  function inp(o, T) {
    switch (T.k) {
      case 'num': case 'bool': case 'str': return o;
      case 'ptr': return null;
      case 'msg': return msg.readMsg(o);
      case 'mstruct': return msg['read' + T.name](o);
      case 'bucket': { const b = new books.Bucket(T.intT); b.tok = o.tok; b.at = o.at; return b; }
      case 'book': { const b = new BOOKS[T.name](); for (const [f, t] of SF.STRUCTS[T.name]) b[f] = inp(o[f], parse(t)); return b; }
      case 'struct': { const s = {}; for (const [f, t] of SF.STRUCTS[T.name]) s[f] = inp(o[f], parse(t)); return s; }
      case 'map': { const m = new Map(); for (const [k, x] of o) m.set(inp(k, T.key), inp(x, T.val)); return m; }
      case 'set': { const s = new Set(); for (const k of o) s.add(inp(k, T.key)); return s; }
      case 'pair': return [inp(o[0], T.a), inp(o[1], T.b)];
      case 'fixed': case 'arr': { const el = T.el; return o.map((x) => inp(x, el)); }
    }
    throw new Error('state: restore ' + T.k);
  }
  function restore(seat, obj) {
    if (typeof obj === 'string') obj = JSON.parse(obj);
    for (const f of Object.keys(obj)) {
      const t = TYPE.get(f); if (t === undefined) throw new Error('state: restore: no member ' + f);
      seat[f] = inp(obj[f], parse(t));
    }
    return seat;
  }

  const api = Object.freeze({ parse, init, newStruct, copy, dump, dumpObj, dumpState, stateHash, restore, STATE_NAMES });
  GifOS.meshState = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
