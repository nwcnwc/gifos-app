// meet-icons.js — the Meet reactions control is a smiley. The four-point
// sparkle is the AI mark, and it only appears on the transcript and the note bot.
//
//   node test/unit/meet-icons.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'run.html'), 'utf8');
const SPARK = 'M12 2l1.6 6.2L20 10l-6.4 1.8L12 18l-1.6-6.2L4 10l6.4-1.8z';
const SMILE = 'M8 14.2c1.1 1.4 2.4 2 4 2s2.9-.6 4-2';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

function button(id) {
  const mark = 'id="' + id + '"';
  const a = html.indexOf(mark);
  const b = a < 0 ? -1 : html.indexOf('</button>', a);
  return a < 0 || b < 0 ? '' : html.slice(a, b);
}

const react = button('reactbtn');
check('reactions button is in the page', react.length > 0);
check('reactions button is a face', react.indexOf('circle cx="12" cy="12" r="9"') >= 0 && react.indexOf(SMILE) >= 0);
check('reactions button has two eyes', (react.match(/circle cx="(?:9|15)" cy="10"/g) || []).length === 2);
check('reactions button does not use the sparkle', react.indexOf(SPARK) < 0 && react.indexOf('M12 2l') < 0);

const tr = button('trbtn');
const tab = button('trtab');
check('transcript button carries the sparkle', tr.indexOf(SPARK) >= 0 && tr.indexOf('class="ai-spark"') >= 0);
check('transcript tab carries the sparkle', tab.indexOf(SPARK) >= 0 && tab.indexOf('class="ai-spark"') >= 0);

check('the note bot badge is painted with the same sparkle',
  html.indexOf("mark.title = 'Note bot'") >= 0 && html.indexOf('AI_SPARK_SVG + \'bot\'') >= 0);
check('the sparkle constant is the AI mark', html.indexOf('const AI_SPARK_SVG = ') >= 0 && html.indexOf(SPARK) >= 0);

// Every copy of the sparkle path in the meeting page sits in an AI control:
// the transcript button, the transcript tab, or the AI_SPARK_SVG constant
// (used by the note-bot badge and the transcript panel title).
const aiNear = ['id="trbtn"', 'id="trtab"', 'const AI_SPARK_SVG'];
let at = 0, sparks = 0, stray = 0;
while ((at = html.indexOf(SPARK, at)) >= 0) {
  sparks++;
  const around = html.slice(Math.max(0, at - 220), at);
  if (!aiNear.some((m) => around.indexOf(m) >= 0)) stray++;
  at += SPARK.length;
}
check('the sparkle appears on the AI controls', sparks >= 3, sparks);
check('no sparkle sits outside those controls', stray === 0, stray);

// The rest of the live tree (not frozen /versions snapshots, not theme art)
// does not reuse the sparkle glyph.
function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'versions' || name === 'node_modules' || name === '.git' || name === 'test') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'themes') continue;
      walk(p, out);
    } else if (/\.(html|js|css)$/.test(name) && p !== path.join(root, 'run.html')) out.push(p);
  }
}
const files = [];
walk(root, files);
const elsewhere = files.filter((p) => fs.readFileSync(p, 'utf8').indexOf(SPARK) >= 0);
check('the sparkle path is not used outside the meeting page', elsewhere.length === 0, elsewhere.join(', '));

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
