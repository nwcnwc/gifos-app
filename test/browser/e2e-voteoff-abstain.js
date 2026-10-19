// e2e-voteoff-abstain.js — THE MEETING BOT LEAVES THE VOTE-OFF BAR (Nathan,
// 2026-10-18). Vote-off-the-island is tallied by the relay; an abstain takes
// a voter out of its majority bar. The bot never votes, so its page sends
// abs:['*'] with its votekick (syncVotes) and the relay drops it from the bar.
//
// Three people + the Meeting Bot, Ann and Ben vote Phone off the island:
//   - after Ann's vote the bar reads 2, not 3 (the bot is out of it);
//   - Ben's vote is 2 of 2: Phone is voted off (its page is banned out) and
//     leaves every other page; the bot stays.
//
// Servers: the gifos-app site and gifos' test/servers/relay-local.js.
//   BASE=http://127.0.0.1:8099 RELAY=ws://127.0.0.1:8790 node test/browser/e2e-voteoff-abstain.js
// SHOTS=<dir> saves Ann's page after each vote. GIFOS_REPO points at the gifos
// checkout (default ../gifos beside gifos-app).
const path = require('path');
const GIFOS = process.env.GIFOS_REPO || path.join(__dirname, '..', '..', '..', 'gifos');
const { chromium, CHROME } = require(path.join(GIFOS, 'test', 'lib', 'pw'));
const { reachTool } = require(path.join(GIFOS, 'test', 'lib', 'meet-ui'));

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const RELAY = process.env.RELAY || 'ws://127.0.0.1:8790';
const SHOTS = process.env.SHOTS || '';

let failures = 0;
const check = (n, c, d) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (d !== undefined ? '  (' + JSON.stringify(d) + ')' : '')); if (!c) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = (pg, fn, arg, ms) => pg.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: [
    '--disable-features=WebRtcHideLocalIpsWithMdns', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const room = 'vkabst' + Math.floor(Math.random() * 1e9).toString(36);
  const mk = async (name, extra) => {
    const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
    await ctx.addInitScript({ content: "try{localStorage.setItem('gifos_relay','" + RELAY + "');localStorage.setItem('gifos_name','" + name + "');sessionStorage.setItem('gifos_appear_ok','1');sessionStorage.setItem('gifos_more_tools','1')}catch(e){}" });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => console.log('  [' + name + '] pageerror: ' + e.message));
    await pg.goto(BASE + '/run.html#v=' + room + (extra || ''));
    return pg;
  };
  const A = await mk('Ann'); await sleep(1500);
  const B = await mk('Ben'); await sleep(1500);
  const P = await mk('Phone'); await sleep(1500);
  const BOT = await mk('Meeting Bot', '&bot=1');
  const all = [['Ann', A], ['Ben', B], ['Phone', P], ['Bot', BOT]];
  for (let i = 0; i < 30; i++) {
    const st = [];
    for (const [n, pg] of all) st.push(n + '=' + await pg.evaluate(() => { try { return window.__gifosVideo.participants(); } catch (e) { return '?'; } }));
    if (st.every((x) => /=4$/.test(x))) break;
    if (i === 29) { console.log('JOIN STALL:', st.join(' ')); process.exit(1); }
    await sleep(2000);
  }
  await sleep(2000); // device tags reach every page
  check('the Meeting Bot page is a bot', await BOT.evaluate(() => window.__gifosVideo.bot()));

  const phoneId = await A.evaluate(() => { const t = Array.from(document.querySelectorAll('.tile:not(.me)')).find((el) => /^Phone$/.test((el.querySelector('.name') || {}).textContent || '')); return t ? t.dataset.peer : null; });
  const arm = async (pg) => { await reachTool(pg, '#votebtn'); await pg.locator('#votebtn').click(); await pg.locator('#vote-modal [data-vm="kick"]').click(); };
  const voteOff = (pg) => pg.evaluate(() => {
    const t = Array.from(document.querySelectorAll('.tile:not(.me)')).find((el) => /^Phone$/.test((el.querySelector('.name') || {}).textContent || ''));
    const btn = t && t.querySelector('.votedot'); if (btn) btn.click(); return !!btn;
  });

  await arm(A);
  check('Ann can tap the vote-off mark on Phone', await voteOff(A));
  await until(A, (id) => window.__gifosVideo.votesAgainst(id) === 1, phoneId, 15000);
  const t1 = await A.evaluate((id) => ({ against: window.__gifosVideo.votesAgainst(id), need: window.__gifosVideo.voteNeed() }), phoneId);
  check('after Ann\'s vote the bar reads 2, not 3 (the bot abstains)', t1.against === 1 && t1.need === 2, t1);
  if (SHOTS) await A.screenshot({ path: path.join(SHOTS, 'ann-after-1-vote.png') });

  await arm(B);
  check('Ben can tap the vote-off mark on Phone', await voteOff(B));
  const out = await until(P, () => window.__gifosVideo.bannedOut(), null, 20000);
  check('2 of 2: Phone is voted off the island (its page is banned out)', out, await A.evaluate((id) => ({ against: window.__gifosVideo.votesAgainst(id), need: window.__gifosVideo.voteNeed() }), phoneId));
  const gone = await until(A, () => window.__gifosVideo.participants() === 3, null, 20000);
  check('…and Phone leaves Ann\'s page (3 left: Ann, Ben, the bot)', gone, await A.evaluate(() => window.__gifosVideo.participants()));
  check('the Meeting Bot is still in the meeting', await BOT.evaluate(() => !window.__gifosVideo.bannedOut() && !!window.__gifosVideo.room()));
  if (SHOTS) { await A.screenshot({ path: path.join(SHOTS, 'ann-after-2-votes.png') }); await P.screenshot({ path: path.join(SHOTS, 'phone-after-2-votes.png') }); }

  await browser.close();
  console.log(failures ? 'FAILURES: ' + failures : 'ALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
