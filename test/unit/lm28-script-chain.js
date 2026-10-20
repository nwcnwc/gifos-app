// lm28-script-chain.js — the meeting script chain must not be parser-blocking.
//
// run.html loads the meet scripts as classic tags with no defer, async, or
// module. On a link where each file takes a few hundred milliseconds they
// run one after another: a phone-profile load of the versioned page with a
// 300ms script delay took about 9s, and each body script started when the
// previous one ended. gifos-themes.js stays classic on purpose (it
// document.writes the theme). The other external scripts have to be able
// to fetch together.
//
// Fails while any external script other than gifos-themes.js is
// parser-blocking. Passes when those tags are defer, async, or module,
// and gifos-gif.js plus gifos-perms.js are still on the page.
//
//   node test/unit/lm28-script-chain.js
'use strict';
const fs = require('fs');
const path = require('path');

let fails = 0;
const check = (n, c, d) => {
  console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (d !== undefined && !c ? '  ' + JSON.stringify(d) : ''));
  if (!c) fails++;
};

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'run.html'), 'utf8');

function scripts(src) {
  const out = [];
  const re = /<script\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(src))) {
    const attrs = m[1];
    const srcM = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    out.push({
      src: srcM ? (srcM[1] || srcM[2] || '') : '',
      defer: /\bdefer\b/i.test(attrs),
      async: /\basync\b/i.test(attrs),
      module: /\btype\s*=\s*(?:"module"|'module')/i.test(attrs),
    });
  }
  return out;
}

const tags = scripts(html);
const external = tags.filter((t) => t.src && /(?:^|\/)js\/[^/]+\.js(?:\?|$)/.test(t.src));
const blocking = external.filter((t) => !t.defer && !t.async && !t.module && !/gifos-themes\.js(?:\?|$)/.test(t.src));
const names = external.map((t) => t.src);

check('gifos-gif.js is still on the meeting page', names.some((s) => /gifos-gif\.js(?:\?|$)/.test(s)));
check('gifos-perms.js is still on the meeting page', names.some((s) => /gifos-perms\.js(?:\?|$)/.test(s)));
check('external meet scripts other than gifos-themes.js are not parser-blocking', blocking.length === 0, blocking.map((t) => t.src));

if (fails) process.exit(1);
