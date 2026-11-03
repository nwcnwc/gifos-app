'use strict';
/*
 * script.js: --script, a scenario file run as service ops (the shared scenario format), port plan H3: a
 * line-for-line port of the sim's mesh.cpp JV / JParse / actTokens / runScript. Harness code, never shipped.
 *
 *   {"N":26, "C":5, "seeds":[...], "net":{"loss":0.01,...}, "setup":[{"op":..,"args":[..]}],
 *    "acts":[{"at":0|"+k", "op":"killat", "args":["/0.1"]}, ...]}
 *
 * `net` and `setup` run before `init N`; each act runs through runOp() once the clock reaches its tick. `at` is an
 * absolute tick, or "+k": k ticks after the previous act returned (an op such as converge moves the clock itself).
 * An act whose absolute tick has already passed is an error, never a silent reorder.
 *
 * The parser is the sim's own, not JSON.parse: a number or a bool is kept as its lexeme (the ops read the text:
 * `net` takes "loss=" + the lexeme), a string escape is n, t or the character itself, there is no \u.
 */
const fs = require('fs');
const path = require('path');
const topo = require(path.join(__dirname, '..', '..', '..', 'js', 'mesh', 'topo.js'));

// C++: mesh.cpp:JV
class JV {
  constructor() { this.ty = 0; this.s = ''; this.a = []; this.o = []; }   // ty: 0 null 1 bool 2 num 3 str 4 arr 5 obj; s holds the lexeme of a bool/num
  get(k) { for (const e of this.o) if (e[0] === k) return e[1]; return null; }
}
// C++: mesh.cpp:JParse
class JParse {
  constructor(t) { this.t = t; this.p = 0; this.err = ''; }
  ws() { const t = this.t; while (this.p < t.length && (t[this.p] === ' ' || t[this.p] === '\n' || t[this.p] === '\r' || t[this.p] === '\t')) this.p++; }
  val(v) {
    const t = this.t; this.ws(); if (this.p >= t.length) { this.err = 'unexpected end'; return false; } const c = t[this.p];
    if (c === '{') {
      v.ty = 5; this.p++; this.ws(); if (this.p < t.length && t[this.p] === '}') { this.p++; return true; }
      for (;;) {
        this.ws(); const k = new JV();
        if (this.p >= t.length || t[this.p] !== '"' || !this.str(k)) { if (!this.err) this.err = 'object key'; return false; }
        this.ws(); if (this.p >= t.length || t[this.p] !== ':') { this.err = 'expected :'; return false; } this.p++;
        const x = new JV(); if (!this.val(x)) return false; v.o.push([k.s, x]); this.ws();
        if (this.p < t.length && t[this.p] === ',') { this.p++; continue; } if (this.p < t.length && t[this.p] === '}') { this.p++; return true; } this.err = 'expected , or }'; return false;
      }
    }
    if (c === '[') {
      v.ty = 4; this.p++; this.ws(); if (this.p < t.length && t[this.p] === ']') { this.p++; return true; }
      for (;;) {
        const x = new JV(); if (!this.val(x)) return false; v.a.push(x); this.ws();
        if (this.p < t.length && t[this.p] === ',') { this.p++; continue; } if (this.p < t.length && t[this.p] === ']') { this.p++; return true; } this.err = 'expected , or ]'; return false;
      }
    }
    if (c === '"') { v.ty = 3; return this.str(v); }
    if (t.startsWith('true', this.p)) { v.ty = 1; v.s = 'true'; this.p += 4; return true; }
    if (t.startsWith('false', this.p)) { v.ty = 1; v.s = 'false'; this.p += 5; return true; }
    if (t.startsWith('null', this.p)) { v.ty = 0; this.p += 4; return true; }
    let q = this.p; while (q < t.length && '+-0123456789.eE'.includes(t[q])) q++;
    if (q === this.p) { this.err = 'bad char ' + c; return false; }
    v.ty = 2; v.s = t.slice(this.p, q); this.p = q; return true;
  }
  str(out) {
    const t = this.t; this.p++;
    while (this.p < t.length && t[this.p] !== '"') {
      if (t[this.p] === '\\' && this.p + 1 < t.length) { this.p++; const e = t[this.p]; out.s += e === 'n' ? '\n' : e === 't' ? '\t' : e; } else out.s += t[this.p];
      this.p++;
    }
    if (this.p >= t.length) { this.err = 'unterminated string'; return false; }
    this.p++; return true;
  }
}
// C++: mesh.cpp:actTokens
function actTokens(act) {
  const tk = []; const op = act.get('op'); if (op) tk.push(op.s);
  const ar = act.get('args'); if (ar) { if (ar.ty === 4) { for (const x of ar.a) tk.push(x.s); } else if (ar.ty === 2 || ar.ty === 3) tk.push(ar.s); }
  return tk;
}
const atoll = (s) => { const v = parseInt(s, 10); return Number.isNaN(v) ? 0 : v; };

// C++: mesh.cpp:runScript
function runScript(fab, ops, file, haveSeed, seed, err, out) {
  let txt; try { txt = fs.readFileSync(file, 'latin1'); } catch (e) { err('ERR script: cannot open ' + file + '\n'); return 2; }
  const root = new JV(); const jp = new JParse(txt);
  if (!jp.val(root) || root.ty !== 5) { err('ERR script ' + file + ': JSON at byte ' + jp.p + ': ' + (jp.err || 'not an object') + '\n'); return 2; }
  const jn = root.get('N'); if (!jn || jn.ty !== 2) { err('ERR script: N missing\n'); return 2; }
  const jc = root.get('C'); if (jc && (parseInt(jc.s, 10) | 0) !== topo.C) { err('ERR script wants C=' + jc.s + ', this build has C=' + topo.C + ' (-DGIFOS_C)\n'); return 2; }
  if (!haveSeed) { const js = root.get('seeds'); if (js && js.ty === 4 && js.a.length) { seed = (parseInt(js.a[0].s, 10) >>> 0); haveSeed = true; } }
  fab.printf('SCRIPT %s seed=%s\n', file, haveSeed ? String(seed >>> 0) : 'default');
  if (haveSeed) ops.runOp(['seed', String(seed >>> 0)]);
  const jnet = root.get('net'); if (jnet && jnet.ty === 5 && jnet.o.length) { const tk = ['net']; for (const e of jnet.o) tk.push(e[0] + '=' + e[1].s); ops.runOp(tk); }
  const jsu = root.get('setup'); if (jsu && jsu.ty === 4) for (const a of jsu.a) { const tk = actTokens(a); if (tk.length && !ops.runOp(tk)) return 0; }
  ops.runOp(['init', jn.s, '0']);
  const ja = root.get('acts'); if (!ja || ja.ty !== 4) { err('ERR script: acts missing\n'); return 2; }
  let last = fab.w.TICK;
  for (let i = 0; i < ja.a.length; i++) {
    const a = ja.a[i]; const at = a.get('at'); let tgt = fab.w.TICK;
    if (at) {
      if (at.ty === 3 && at.s.length && at.s[0] === '+') tgt = last + atoll(at.s.slice(1));
      else if (at.ty === 2) tgt = atoll(at.s);
      else { err('ERR script act ' + i + ': at must be a tick or "+k"\n'); return 2; }
    }
    if (tgt < fab.w.TICK) { err('ERR script act ' + i + ' at=' + tgt + ' but the clock is already ' + fab.w.TICK + '\n'); return 2; }
    while (fab.w.TICK < tgt) { fab.doTick(); fab.w.TICK++; }
    const tk = actTokens(a); if (!tk.length) { err('ERR script act ' + i + ': no op\n'); return 2; }
    if (!ops.runOp(tk)) break;
    last = fab.w.TICK;
  }
  return 0;
}

module.exports = { JV, JParse, actTokens, runScript };
