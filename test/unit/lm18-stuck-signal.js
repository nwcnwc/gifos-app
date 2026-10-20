// lm18-stuck-signal.js — a pair that never connects must quiet down.
//
// Two peers whose ICE never leaves "new" kept sending about 4 relay frames
// a second (mostly one frame per ICE candidate) for the whole sample, above
// the 1 frame/s cap. The sweep re-offers a not-connected pair every 6s
// (and the cure path every 8s). Each offer is a name, a boot, and a
// fingerprint, and relayBootSend then emits one ice frame per candidate.
//
// Eight candidates is below that two-peer run. Fails while
// (offer frames + one frame per candidate) / re-offer period is at least
// 1/s. Passes when a stuck pair no longer re-offers on that clock, or when
// a gather is no longer one relay frame per candidate, so the rate drops
// under 1/s.
//
//   node test/unit/lm18-stuck-signal.js
'use strict';
const fs = require('fs');
const path = require('path');

let fails = 0;
const check = (n, c, d) => {
  console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (d !== undefined && !c ? '  ' + JSON.stringify(d) : ''));
  if (!c) fails++;
};

const root = path.join(__dirname, '..', '..');
require(path.join(root, 'js', 'gifos-net.js'));
const net = globalThis.GifOS.net;
const src = fs.readFileSync(path.join(root, 'run.html'), 'utf8');

function extractFn(name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) return '';
  let i = src.indexOf('{', at), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) break; }
  return src.slice(at, i + 1);
}

const iceSrc = extractFn('iceCandsOf');
const bootSrc = extractFn('relayBootSend');
check('iceCandsOf and relayBootSend are on the page', !!iceSrc && !!bootSrc);

const sent = [];
const txStats = { relayUnfit: 0 };
let relayBootSend = null;
if (iceSrc && bootSrc) {
  relayBootSend = new Function('net', 'txStats', 'clog', 'relaySendSealed', 'let bootSeq = 0;\n' + iceSrc + '\n' + bootSrc + '\nreturn relayBootSend;')(net, txStats, function () {}, function (to, ty) { sent.push(ty); });
}

const sample = 'candidate:abcd 1 udp 2113937151 example.test 9 typ host';
check('a host candidate still fits the relay ice frame', !!net.iceOf({ candidate: sample }));

const GATHER = 8;
if (relayBootSend) {
  const cands = [];
  for (let i = 0; i < GATHER; i++) cands.push({ candidate: sample.replace('abcd', 'abcd' + i), sdpMid: '0', sdpMLineIndex: 0 });
  relayBootSend('peer', { kind: 'ice', candidates: cands });
}
const iceFrames = sent.filter((t) => t === 'ice').length;

const bootFn = bootSrc || '';
const offerFrames = (/relaySendSealed\(to, 'name'/.test(bootFn) ? 1 : 0) + (/relaySendSealed\(to, 'boot'/.test(bootFn) ? 1 : 0) + (/relaySendSealed\(to, 'fp'/.test(bootFn) ? 1 : 0);

const plain = /st === 'failed' \|\| st === 'disconnected' \|\| st === 'new' \|\| st === 'connecting'\)\s*&&\s*now - p\.lastKick > (\d+)/.exec(src);
const cure = /!p\.connected && \(st === 'connecting' \|\| st === 'new'\)[\s\S]{0,240}?now - \(p\.cureAt \|\| 0\) > (\d+)/.exec(src);
const gaps = [plain && +plain[1], cure && +cure[1]].filter((n) => n > 0);
const gap = gaps.length ? Math.min.apply(null, gaps) : 0;
const frames = offerFrames + iceFrames;
// No remaining short clock means the stuck pair is not re-offered on this sweep.
const rate = gap ? frames / (gap / 1000) : 0;
check('a pair that never connects stays under 1 relay frame/s after the first offers', rate < 1, { iceFrames, offerFrames, gap, rate });

if (fails) process.exit(1);
