// lm26-theme-host.js — a dashed numeric host label is not a theme.
//
// gifos-themes.js treats the first label of a 3-label host as a theme folder
// and parser-blocking-loads it. A four-number label written with dashes
// (the shape a numeric host uses) is not four dotted octets, so the IPv4
// exception misses it and the page requests a theme script that 404s.
// sw.js precaches the same folder. A real word label still overrides.
//
// Fails while either file asks for that folder. Passes when both skip a
// dashed four-number label and a word label still selects its folder.
//
//   node test/unit/lm26-theme-host.js
'use strict';
const fs = require('fs');
const path = require('path');

let fails = 0;
const check = (n, c, d) => {
  console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (d !== undefined && !c ? '  ' + JSON.stringify(d) : ''));
  if (!c) fails++;
};

const root = path.join(__dirname, '..', '..');
const themeSrc = fs.readFileSync(path.join(root, 'js', 'gifos-themes.js'), 'utf8');
const swSrc = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function themeDirs(hostname) {
  const start = themeSrc.indexOf('const parts = (((root.location');
  const end = themeSrc.indexOf('const wantIcons');
  if (start < 0 || end < start) return null;
  const fn = new Function('root', themeSrc.slice(start, end) + '\nreturn dirs;');
  return fn({ location: { hostname } });
}

function swTheme(hostname) {
  const start = swSrc.indexOf('function themeOverride()');
  const end = swSrc.indexOf('self.addEventListener', start);
  if (start < 0 || end < start) return null;
  const fn = new Function('self', swSrc.slice(start, end) + '\nreturn themeOverride();');
  return fn({ location: { hostname } });
}

const dashed = ['203-0-113-10.example.test', '198-51-100-20.example.test'];
for (const host of dashed) {
  const label = host.split('.')[0];
  const dirs = themeDirs(host);
  const sw = swTheme(host);
  check('meeting page does not load themes/' + label + ' for ' + host, Array.isArray(dirs) && dirs.indexOf('themes/' + label) < 0, dirs);
  check('service worker does not precache themes/' + label + ' for ' + host, Array.isArray(sw) && !sw.some((u) => String(u).indexOf('/themes/' + label + '/') >= 0), sw);
}

const neonDirs = themeDirs('neon.example.test');
const neonSw = swTheme('neon.example.test');
check('a word label still selects its theme folder', Array.isArray(neonDirs) && neonDirs.indexOf('themes/neon') >= 0, neonDirs);
check('a word label is still precached', Array.isArray(neonSw) && neonSw.some((u) => String(u).indexOf('/themes/neon/') >= 0), neonSw);

if (fails) process.exit(1);
