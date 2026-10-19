// votekick-abstain.js — THE PAGE'S VOTE-OFF SYNC CARRIES THE ABSTAIN.
//
// Vote-off-the-island is tallied by the relay (gifos relay/src/relay.js
// tallyVotes): an abstain takes a voter out of its majority bar. The page
// says so in its votekick frame — abs:['*'] abstains on every vote-off. The
// Meeting Bot never votes, so its page always abstains; a human abstaining
// on every vote ('*' in myStageVotes.ab) does too. Lifts the real
// syncVotes() out of run.html and runs it:
//   - a bot with no vote-offs sends {devs:[], abs:['*']}, and the frame
//     passes the page's own outbound law (gifos-net.js relayVerbOk, the
//     largest-frame cap) — a frame the wire refuses is never sent;
//   - a human sends the old shape, no abs field (old relays see no change);
//   - the bot flag landing after the first sync still re-sends (the dedupe
//     signature carries the abstain);
//   - a human abstaining on every vote sends abs:['*'] beside their votes.
// The relay half (3 humans + bot, 2 votes pass) is gifos
// test/relay/relay-voteoff-abstain.js.
//
//   node test/unit/votekick-abstain.js
// RUN_HTML=<path to another run.html> runs the same legs against that file
// (the before-fix negative control).
'use strict';
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', '..', 'js', 'gifos-net.js'));
const net = globalThis.GifOS.net;

let fails = 0;
const check = (n, c, d) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (d !== undefined && !c ? '  ' + JSON.stringify(d) : '')); if (!c) fails++; };

const src = fs.readFileSync(process.env.RUN_HTML || path.join(__dirname, '..', '..', 'run.html'), 'utf8');
function extractFn(name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('no function ' + name);
  let i = src.indexOf('{', at), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) break; }
  return src.slice(at, i + 1);
}
const syncSrc = extractFn('syncVotes');

// A page: the state syncVotes reads, and the frames it hands the wire.
function page(opts) {
  const sent = [];
  const env = {
    hasAdminRoom: () => false, relayUp: () => true,
    devOf: opts.devOf || { pA: 'devA', pT: 'devT' },
    myVoteoffs: new Set(opts.voteoffs || []),
    myStatus: Object.assign({}, opts.status || {}),
    myStageVotes: { up: new Set(), down: new Set(), ab: new Set(opts.ab || []) },
    relaySendObj: (o) => sent.push(JSON.parse(JSON.stringify(o))),
  };
  const run = new Function(...Object.keys(env), 'let lastVoteSync = null;\n' + syncSrc + '\nreturn syncVotes;')(...Object.values(env));
  return { env, sent, sync: run };
}
const lawOk = (f) => net.relayVerbOk(f) && JSON.stringify(f).length <= net.RELAY_MAX_FRAME_LEN;

{
  const p = page({ status: { bot: true } });
  p.sync();
  const f = p.sent[0];
  check('a bot with no vote-offs sends a votekick that abstains on every vote', p.sent.length === 1 && f.t === 'votekick' && Array.isArray(f.devs) && f.devs.length === 0 && JSON.stringify(f.abs) === '["*"]', p.sent);
  check('…and the frame passes the page\'s own outbound law (relayVerbOk, the frame cap)', !!f && lawOk(f), f);
  p.sync();
  check('…and is not re-sent while nothing changed', p.sent.length === 1, p.sent.length);
}
{
  const p = page({ voteoffs: ['devT', 'devGone'] });
  p.sync();
  const f = p.sent[0];
  check('a human sends the old shape: the here-relevant votes, no abs field', p.sent.length === 1 && JSON.stringify(f) === JSON.stringify({ t: 'votekick', devs: ['devT'] }), p.sent);
  check('…which passes the outbound law as before', !!f && lawOk(f), f);
}
{
  const p = page({});
  p.sync();
  p.env.myStatus.bot = true; // the bot flag lands after the first sync
  p.sync();
  check('a bot flag that lands after the first sync still re-sends, now abstaining', p.sent.length === 2 && !('abs' in p.sent[0]) && JSON.stringify(p.sent[1].abs) === '["*"]', p.sent);
}
{
  const p = page({ voteoffs: ['devT'], ab: ['*'] });
  p.sync();
  const f = p.sent[0];
  check('a human abstaining on every vote sends abs:[\'*\'] beside their votes (the relay drops those votes)', p.sent.length === 1 && JSON.stringify(f.devs) === '["devT"]' && JSON.stringify(f.abs) === '["*"]' && lawOk(f), p.sent);
}
{
  const p = page({ ab: ['devT'] });
  p.sync();
  check('a per-target stage abstain does not become a vote-off abstain', p.sent.length === 1 && !('abs' in p.sent[0]), p.sent);
}

console.log(fails ? ('\n' + fails + ' FAILED') : '\nALL PASS');
process.exit(fails ? 1 : 0);
