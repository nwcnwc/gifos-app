// meet-speaker-frame.js — a talking tile wears a green frame you can see.
//
// Comfy tiles touch, and the video fills the tile. The old .tile.speaking
// border loses to `border: 0`, and the comfy inset glow loses to a more
// specific `box-shadow: none` (the self tile's rule is the stricter one).
// An inset shadow would also sit under the video. The frame has to be a
// green outline drawn inside the tile, which paints above the picture.
// The meter still adds .speaking on your own unmuted tile while you talk.
//
//   node test/unit/meet-speaker-frame.js
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'run.html'), 'utf8');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

function cssText() {
  const parts = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html))) parts.push(m[1]);
  return parts.join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
}

function rulesFrom(css) {
  const rules = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const selector = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (/^@media\b/.test(selector)) rules.push.apply(rules, rulesFrom(body));
    else if (selector && selector[0] !== '@') rules.push({ selector: selector, body: body });
    i = j;
  }
  return rules;
}

function decls(body) {
  const out = {};
  const bits = body.split(';');
  for (let i = 0; i < bits.length; i++) {
    const c = bits[i].indexOf(':');
    if (c < 0) continue;
    const prop = bits[i].slice(0, c).trim().toLowerCase();
    const value = bits[i].slice(c + 1).trim();
    if (prop) out[prop] = value;
  }
  return out;
}

function parseCompound(part) {
  let pseudo = null;
  const pm = part.match(/::(before|after)$/);
  if (pm) { pseudo = pm[1]; part = part.slice(0, -pm[0].length); }
  // :hover, :focus, :has(), and attribute selectors are not this tile.
  if (/:(hover|focus|active|focus-within|has\()/.test(part)) return { skip: true };
  if (/\[[^\]]+\]/.test(part)) return { skip: true };
  const nots = [];
  part = part.replace(/:not\(\.([A-Za-z0-9_-]+)\)/g, function (_, c) { nots.push(c); return ''; });
  let id = null;
  part = part.replace(/#([A-Za-z0-9_-]+)/g, function (_, v) { id = v; return ''; });
  let tag = null;
  const tm = part.match(/^([a-zA-Z][\w-]*)/);
  if (tm) { tag = tm[1].toLowerCase(); part = part.slice(tm[1].length); }
  const classes = [];
  part = part.replace(/\.([A-Za-z0-9_-]+)/g, function (_, c) { classes.push(c); return ''; });
  if (part.trim()) return { skip: true };
  return { tag: tag, id: id, classes: classes, nots: nots, pseudo: pseudo, skip: false };
}

function compoundMatches(c, el) {
  if (c.id && c.id !== el.id) return false;
  if (c.tag && c.tag !== el.tag) return false;
  const have = el.classes || [];
  for (let i = 0; i < c.classes.length; i++) if (have.indexOf(c.classes[i]) < 0) return false;
  for (let i = 0; i < c.nots.length; i++) if (have.indexOf(c.nots[i]) >= 0) return false;
  return true;
}

function selectorMatches(selector, el, pseudo) {
  const parts = selector.trim().split(/\s+/);
  const compounds = [];
  for (let i = 0; i < parts.length; i++) compounds.push(parseCompound(parts[i]));
  if (compounds.some(function (c) { return c.skip; })) return false;
  const last = compounds[compounds.length - 1];
  if ((last.pseudo || null) !== (pseudo || null)) return false;
  if (!compoundMatches(last, el)) return false;
  const ancestors = el.ancestors || [];
  let ai = ancestors.length - 1;
  for (let i = compounds.length - 2; i >= 0; i--) {
    let found = false;
    while (ai >= 0) {
      if (compoundMatches(compounds[i], ancestors[ai])) { found = true; ai--; break; }
      ai--;
    }
    if (!found) return false;
  }
  return true;
}

function specificity(selector) {
  const s = selector.replace(/:not\(([^)]+)\)/g, ' $1 ');
  const a = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+/g) || []).length;
  const attrs = (s.match(/\[[^\]]+\]/g) || []).length;
  const pseudos = (s.match(/:(?!:)[\w-]+(\([^)]*\))?/g) || []).length;
  const elts = (s.match(/(^|[\s>+~])([a-zA-Z][\w-]*)/g) || []).length;
  const pseudoElts = (s.match(/::[\w-]+/g) || []).length;
  return [a, classes + attrs + pseudos, elts + pseudoElts];
}

function cmpSpec(x, y) {
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

const RULES = rulesFrom(cssText());

function used(prop, el, pseudo) {
  let best = null;
  for (let n = 0; n < RULES.length; n++) {
    const rule = RULES[n];
    const sels = rule.selector.split(',');
    const d = decls(rule.body);
    if (!Object.prototype.hasOwnProperty.call(d, prop)) continue;
    for (let i = 0; i < sels.length; i++) {
      const sel = sels[i].trim();
      if (!sel || !selectorMatches(sel, el, pseudo)) continue;
      const sp = specificity(sel);
      if (!best || cmpSpec(sp, best.sp) > 0 || (cmpSpec(sp, best.sp) === 0 && n >= best.order)) {
        best = { value: d[prop], sp: sp, order: n, sel: sel };
      }
    }
  }
  return best;
}

function green(v) {
  return !!(v && /#7bffcf|#5cff7b/i.test(v));
}

// Nathan spoke: his own tile, comfy gallery, peers present (phone portrait).
const self = {
  tag: 'div',
  classes: ['tile', 'me', 'speaking'],
  ancestors: [{ tag: 'body', classes: ['comfy', 'has-peers'] }],
};
const peer = {
  tag: 'div',
  classes: ['tile', 'speaking'],
  ancestors: [{ tag: 'body', classes: ['comfy', 'has-peers'] }],
};

function assertFrame(name, el) {
  const outline = used('outline', el, null);
  const offset = used('outline-offset', el, null);
  const shadow = used('box-shadow', el, null);
  const detail = JSON.stringify({
    outline: outline && { v: outline.value, sel: outline.sel },
    offset: offset && offset.value,
    shadow: shadow && { v: shadow.value, sel: shadow.sel },
  });
  const width = outline && /([\d.]+)px/.exec(outline.value);
  const inside = offset && /^-\d/.test(offset.value.trim());
  check(
    name + ': green frame is the used outline',
    !!(outline && green(outline.value) && width && +width[1] >= 2),
    detail
  );
  check(
    name + ': frame sits inside the tile, above the video',
    !!inside,
    detail
  );
}

assertFrame('own tile while I speak', self);
assertFrame('another tile while they speak', peer);

// The class the frame keys off. Lift the meter's own verdict.
function slice(startMark, endMark) {
  const a = html.indexOf(startMark);
  const b = a < 0 ? -1 : html.indexOf(endMark, a + startMark.length);
  check('lift: meter verdict', a > 0 && b > a, a + '..' + b);
  return a > 0 && b > a ? html.slice(a, b) : 'throw new Error("missing");';
}
const VERDICT = slice('        let speaking = false;', '        speakingOf.set(id, speaking);');
const tick = new Function('st', 'gm', 'm', 'id', 't', 'speakingOf', 'Date', [
  'let lastActive = 0, myVoiceAt = 0;',
  VERDICT,
  'return { speaking: speaking, myVoiceAt: myVoiceAt, on: t.tile.classList.contains("speaking") };',
].join('\n'));

function samples(level) {
  const data = new Uint8Array(32);
  for (let i = 0; i < data.length; i++) data[i] = 128 + (i % 2 ? level : -level);
  return data;
}
function runTick(o) {
  const classes = new Set();
  const tile = {
    classList: {
      toggle: function (name, on) { if (on) classes.add(name); else classes.delete(name); },
      contains: function (name) { return classes.has(name); },
    },
  };
  const data = o.samples;
  const m = {
    data: data,
    an: { getByteTimeDomainData: function (buf) { for (let i = 0; i < buf.length; i++) buf[i] = data[i]; } },
  };
  return tick(o.st, o.gm, m, o.id, { tile: tile }, new Map(), Date);
}

const loud = runTick({ id: 'me', st: { muted: false }, gm: false, samples: samples(40) });
check('my unmuted voice adds .speaking on my tile', loud.on === true && loud.speaking === true && loud.myVoiceAt > 0, JSON.stringify(loud));
const quiet = runTick({ id: 'me', st: { muted: false }, gm: false, samples: samples(0) });
check('silence leaves my tile unframed', quiet.on === false, JSON.stringify(quiet));
const muted = runTick({ id: 'me', st: { muted: true }, gm: false, samples: samples(40) });
check('a muted tile is not framed', muted.on === false, JSON.stringify(muted));

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
