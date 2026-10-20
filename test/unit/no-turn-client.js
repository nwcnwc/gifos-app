// no-turn-client.js — the 0.9.23 meeting page does not ship the free-audio client.
//
// Gate: node test/unit/no-turn-client.js
//
// Fails while js/meet-turn.js is in this tree, or while run.html loads it.
// Passes when that file is gone and the page does not load it.
'use strict';
const fs = require('fs');
const path = require('path');

let fails = 0;
const check = (n, c, d) => {
  console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (d !== undefined && !c ? '  ' + JSON.stringify(d) : ''));
  if (!c) fails++;
};

const root = path.join(__dirname, '..', '..');
const jsPath = path.join(root, 'js', 'meet-turn.js');
const html = fs.readFileSync(path.join(root, 'run.html'), 'utf8');
const loaded = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*meet-turn\.js["']/i.test(html);

check('js/meet-turn.js is not in the tree', !fs.existsSync(jsPath));
check('run.html does not load meet-turn.js', !loaded);

if (fails) process.exit(1);
