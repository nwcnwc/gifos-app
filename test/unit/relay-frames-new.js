// relay-frames-new.js — what the page sends the relay after the vote-off moved
// onto the room's own mesh, and the two additions to the relay's frame law.
//   1. run.html no longer sends a vote-off frame to the relay.
//   2. 'busy' is a relay frame type, 'unlist' is a verb with no fields, and
//      the largest legal frame did not grow.
//   3. A referral list that does not fit one frame splits into several
//      'busy' frames that each fit, and joins back exactly.
//
//   node test/unit/relay-frames-new.js
'use strict';
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', '..', 'js', 'gifos-net.js'));
const net = globalThis.GifOS.net;
let fails = 0;
const check = (n, c, d) => { console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d !== undefined && !c ? '  ' + JSON.stringify(d) : '')); if (!c) fails++; };

const src = fs.readFileSync(process.env.RUN_HTML || path.join(__dirname, '..', '..', 'run.html'), 'utf8');
check('the page sends no vote-off frame to the relay', !/t:\s*['"]votekick['"]/.test(src));
check('the page has no vote-off sync function left', !/function syncVotes\b/.test(src) && !/\bsyncVotes\(/.test(src));

check("'busy' is a relay type", net.RELAY_TYPES.includes('busy'));
check('a busy frame is a legal relay frame shape (sealed size aside)', net.fitsFixed({ k: 'busy', cool: 12 }));
check("'unlist' with no fields is a legal verb", net.relayVerbOk({ t: 'unlist' }));
check("'unlist' with a field is not", !net.relayVerbOk({ t: 'unlist', x: 1 }));
check('the largest legal frame is still bounded by the knock/peer frames', net.RELAY_MAX_FRAME_LEN < 2000, net.RELAY_MAX_FRAME_LEN);

const id = (i) => 'k_' + String(i).padStart(40, '0');
for (const n of [0, 1, 2, 3, 5, 8]) {
  const ids = Array.from({ length: n }, (_, i) => id(i + 1));
  const fr = net.referralFrames(ids);
  check(n + ' referrals: every frame fits one sealed frame', fr.every((f) => net.fitsFixed(f)), fr.map((f) => JSON.stringify(f).length));
  check(n + ' referrals: ' + (n ? 'one frame per 42-character id' : 'no frames'), fr.length === n, fr.length);
  if (n) check(n + ' referrals: join returns the same list, any order', JSON.stringify(net.referralJoin(fr.slice().reverse())) === JSON.stringify(ids));
}
const five = net.referralFrames(Array.from({ length: 5 }, (_, i) => id(i + 1)));
check('a missing piece joins to nothing', net.referralJoin(five.slice(1)) === null);
check('a repeated piece joins to nothing', net.referralJoin([five[0], five[0], five[2]]) === null);
check('a piece from another split joins to nothing', net.referralJoin([five[0], Object.assign({}, five[1], { n: 9 }), five[2]]) === null);
check('a bad id joins to nothing', net.referralJoin([Object.assign({}, five[0], { ref: ['no way'] }), five[1], five[2]]) === null);
check('an id that is not a peer id is dropped when splitting', net.referralFrames(['bad id', id(1)]).length === 1 && net.referralFrames(['bad id', id(1)])[0].ref.length === 1);

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('all passed');
