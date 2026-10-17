// meet-bot-tile.js — a meeting bot is a gallery tile, not a corner stamp.
//
// Phone portrait, three people, one of them the bot. The bot used to be
// pulled out of the packer and drawn as a 72px tile on the bottom-right
// corner of whoever sat there (the Host), with the bot badge on that stamp.
//
//   node test/unit/meet-bot-tile.js
const layout = require('../../js/meet-layout.js');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

function overlapArea(a, b) {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return w * h;
}

function median(nums) {
  const s = nums.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Nathan's live case: phone portrait, three people, the bot among them.
// A wide window is the same stamp at 96×72, so it is in the gate too.
function scene(w, h, phone) {
  const tiles = [
    { id: 'me', me: true, tier: 'row' },
    { id: 'host', tier: 'row' },
    { id: 'bot', bot: true, tier: 'bot' },
  ];
  return layout.layoutFor({
    w: w, h: h, phone: phone, mode: 'gallery', tiles: tiles,
  });
}

function assertGallery(name, out) {
  const rects = (out && out.rects) || [];
  const bot = rects.filter((r) => r.id === 'bot')[0];
  const others = rects.filter((r) => r.id !== 'bot');
  // Self can take a larger cell. The bot has to match the other people.
  const people = rects.filter((r) => r.id !== 'bot' && r.id !== 'me');
  check(name + ': bot has one rect', !!bot && rects.filter((r) => r.id === 'bot').length === 1, JSON.stringify(rects));
  if (!bot || !others.length) return;
  const botSide = Math.min(bot.w, bot.h);
  const mid = median((people.length ? people : others).map((r) => Math.min(r.w, r.h)));
  const biggestOverlap = others.reduce((m, r) => Math.max(m, overlapArea(bot, r)), 0);
  const botArea = bot.w * bot.h;
  check(
    name + ': bot is a gallery cell, not a 72px stamp',
    botSide >= mid * 0.75 && botSide > 96,
    'bot ' + Math.round(bot.w) + 'x' + Math.round(bot.h) + ' vs median side ' + Math.round(mid)
  );
  check(
    name + ': bot does not sit on the Host corner',
    botArea > 0 && biggestOverlap <= botArea * 0.15,
    'overlap ' + Math.round(biggestOverlap) + ' of ' + Math.round(botArea)
  );
}

assertGallery('phone portrait', scene(390, 844, true));
assertGallery('wide window', scene(1280, 800, false));

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
