'use strict';
/*
 * cprintf.js: C printf for the sim's stdout lines (harness code, never shipped).
 *
 * The sim prints its reports with printf: %d %i %u %ld %lld %llu %zu %s %c %x %llx %f (with width, '+', '-',
 * '0' flags and a precision) and %%. JS has no printf, and toFixed rounds an exact tie up where C rounds it
 * to even (0.125 with %.2f: C 0.12, JS 0.13), so %f is done here with the tie case settled the C way.
 * A conversion this file does not know throws: a port must not guess.
 */

// The exact decimal text of |x| rounded to p places the way glibc does (round half to even on an exact tie).
function fixedAbs(x, p) {
  let s = x.toFixed(p);
  if (!Number.isFinite(x) || x === 0) return s;
  // exact tie test: x = m * 2^e (m integer); a tie is x*10^p*2 odd
  const buf = new DataView(new ArrayBuffer(8)); buf.setFloat64(0, x);
  const hi = buf.getUint32(0), lo = buf.getUint32(4);
  const ex = (hi >>> 20) & 0x7ff;
  let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo), e;
  if (ex === 0) e = -1074; else { m |= 1n << 52n; e = ex - 1075; }
  if (e >= 0) return s;
  const num = m * (10n ** BigInt(p)) * 2n, den = 1n << BigInt(-e);
  if (num % den !== 0n) return s;
  const q = num / den;
  if (q % 2n === 0n) return s;
  let n = (q - 1n) / 2n; if (n % 2n !== 0n) n += 1n;
  let t = n.toString();
  if (p === 0) return t;
  while (t.length <= p) t = '0' + t;
  return t.slice(0, t.length - p) + '.' + t.slice(t.length - p);
}

const RE = /%([-+ 0#]*)(\*|\d+)?(?:\.(\d+))?(hh|h|ll|l|z|j|t)?([diuxXfFeEgGscp%])/g;

function sprintf(fmt, ...args) {
  let a = 0;
  return fmt.replace(RE, (all, flags, width, prec, len, conv) => {
    if (conv === '%') return '%';
    if (width === '*') throw new Error('cprintf: * width');
    let v = args[a++], body;
    const left = flags.includes('-'), plus = flags.includes('+'), zero = flags.includes('0') && !left, space = flags.includes(' ');
    let sign = '';
    switch (conv) {
      case 'd': case 'i': {
        let n = typeof v === 'bigint' ? v : BigInt(Math.trunc(Number(v)));
        if (!len) n = BigInt.asIntN(32, n);
        if (n < 0n) { sign = '-'; n = -n; } else if (plus) sign = '+'; else if (space) sign = ' ';
        body = n.toString(); if (prec !== undefined) body = body.padStart(+prec, '0');
        break;
      }
      case 'u': case 'x': case 'X': {
        let n = typeof v === 'bigint' ? v : BigInt(Math.trunc(Number(v)));
        n = (len === 'll' || len === 'l' || len === 'z' || len === 'j') ? BigInt.asUintN(64, n) : BigInt.asUintN(32, n);
        body = conv === 'u' ? n.toString() : conv === 'x' ? n.toString(16) : n.toString(16).toUpperCase();
        if (prec !== undefined) body = body.padStart(+prec, '0');
        break;
      }
      case 'f': case 'F': {
        const x = Number(v), p = prec === undefined ? 6 : +prec;
        if (x < 0 || Object.is(x, -0)) { sign = '-'; } else if (plus) sign = '+'; else if (space) sign = ' ';
        if (Number.isNaN(x)) body = 'nan'; else if (!Number.isFinite(x)) body = 'inf'; else body = fixedAbs(Math.abs(x), p);
        break;
      }
      case 's': body = String(v); if (prec !== undefined) body = body.slice(0, +prec); break;
      case 'c': body = typeof v === 'number' ? String.fromCharCode(v) : String(v); break;
      default: throw new Error('cprintf: unsupported conversion ' + all);
    }
    const w = width === undefined ? 0 : +width;
    const len_ = sign.length + body.length;
    if (len_ >= w) return sign + body;
    if (left) return sign + body + ' '.repeat(w - len_);
    if (zero && conv !== 's' && conv !== 'c') return sign + '0'.repeat(w - len_) + body;
    return ' '.repeat(w - len_) + sign + body;
  });
}

module.exports = { sprintf, fixedAbs };
