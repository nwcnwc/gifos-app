// e2e-vote-abstain.js — ABSTAIN TAKES A VOTER OUT OF THE BAR (Nathan, 2026-10-18).
//
// Each voter's state per vote is yes / no / empty / abstain. Empty still
// counts in the majority bar; abstain does not, and an abstainer's own yes or
// no on that vote does not count either (the away symmetry in
// stageVoteTallies). There is no bot rule in the tally: the Meeting Bot never
// votes, so its own page abstains on every vote, as any voter may.
//
// Hunt 18:06 #3: three people + the Meeting Bot, two vote Phone onto the
// stage, and the room sat at "2/3 to the stage" forever (the bot counted in
// the bar and could not vote; Phone cannot vote for itself).
//
//   1. 3 humans + bot, Ann and Ben vote Phone up: Phone goes on stage on every
//      page (the bot abstains, so 2 of 2 pass).
//   2. Ben abstains on Phone: his up-vote stops counting and he leaves Phone's
//      bar (1 vote, bar 2). Withdrawing the abstain restores his vote.
//   3. Ann and Ben vote Phone off the stage: Phone steps down (same bar).
//
// Servers: the gifos-app site and gifos' test/servers/relay-local.js.
//   BASE=http://127.0.0.1:8099 RELAY=ws://127.0.0.1:8790 node test/browser/e2e-vote-abstain.js
// GIFOS_REPO points at the gifos checkout (default ../gifos beside gifos-app).
const path = require('path');
const GIFOS = process.env.GIFOS_REPO || path.join(__dirname, '..', '..', '..', 'gifos');
const { chromium, CHROME } = require(path.join(GIFOS, 'test', 'lib', 'pw'));
const { reachTool } = require(path.join(GIFOS, 'test', 'lib', 'meet-ui'));

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const RELAY = process.env.RELAY || 'ws://127.0.0.1:8790';

let failures = 0;
const check = (n, c, d) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (d !== undefined ? '  (' + JSON.stringify(d) + ')' : '')); if (!c) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = (pg, fn, arg, ms) => pg.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: [
    '--disable-features=WebRtcHideLocalIpsWithMdns', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const room = 'vabst' + Math.floor(Math.random() * 1e9).toString(36);
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
  await sleep(2000); // device tags gossip on the pulse
  check('the Meeting Bot page is a bot', await BOT.evaluate(() => window.__gifosVideo.bot()));

  const arm = async (pg, mode) => { await reachTool(pg, '#votebtn'); await pg.locator('#votebtn').click(); await pg.locator('#vote-modal [data-vm="' + mode + '"]').click(); };
  const phoneTile = (pg) => pg.locator('.tile:not(.me)').filter({ has: pg.locator('.name', { hasText: /^Phone$/ }) });
  const phoneId = await P.evaluate(() => window.__gifosVideo.myPid());
  const phoneDev = await P.evaluate(() => window.__gifosVideo.devHash());
  const onStage = (pg) => until(pg, (id) => window.__gifosVideo.stageIds().includes(id), phoneId, 15000);
  const offStage = (pg) => until(pg, (id) => !window.__gifosVideo.stageIds().includes(id), phoneId, 15000);

  // ---- 1: 3 humans + bot, two up-votes put Phone on stage -------------------
  await arm(A, 'up');
  await phoneTile(A).locator('.votedot').click();
  await arm(B, 'up');
  await phoneTile(B).locator('.votedot').click();
  const s1 = [];
  for (const [n, pg] of all) s1.push([n, await onStage(pg)]);
  const v1 = await A.evaluate(() => window.__gifosVideo.stageVotes());
  check('3 humans + bot, Ann and Ben vote Phone up: Phone goes on stage on every page',
    s1.every((x) => x[1]), { pages: s1, votes: v1 });
  check('the bar reads 2 (the bot abstains, Phone cannot vote for itself)', v1.need === 2, v1);
  check('the tally chip on Phone reads 2/2', /2\/2\s*to the stage/.test(await phoneTile(A).textContent()));

  // ---- 2: an abstainer's own vote stops counting ----------------------------
  const tallyOn = (pg, up, need) => until(pg, (a) => { const v = window.__gifosVideo.stageVotes(); return (v.up[a.dv] || 0) === a.up && v.needOf[a.dv] === a.need; }, { dv: phoneDev, up, need }, 12000);
  const hasAbstain = await B.evaluate(() => typeof window.__gifosVideo.stageAbstainForTest === 'function');
  check('the page offers abstain', hasAbstain);
  if (hasAbstain) {
    await B.evaluate((id) => window.__gifosVideo.stageAbstainForTest(id, true), phoneId);
    check('Ben abstains on Phone: his up-vote stops counting and he leaves the bar (1 vote, bar 2)', await tallyOn(A, 1, 2),
      await A.evaluate(() => window.__gifosVideo.stageVotes()));
    check('Ben\'s own page drops his up-vote with the abstain (one state per vote)',
      await B.evaluate((dv) => !window.__gifosVideo.myStageVotesForTest().up.includes(dv), phoneDev));
    await B.evaluate((id) => window.__gifosVideo.stageAbstainForTest(id, false), phoneId);
    await arm(B, 'up');
    await phoneTile(B).locator('.votedot').click().catch(() => {});
  }

  // ---- 3: vote-off-stage uses the same bar ----------------------------------
  const stripX = (pg) => pg.locator('#stagefeed .stgvotes button', { hasText: 'Phone' });
  await arm(A, 'down');
  await stripX(A).waitFor({ state: 'visible', timeout: 10000 });
  await stripX(A).click();
  await arm(B, 'down');
  await stripX(B).waitFor({ state: 'visible', timeout: 10000 });
  await stripX(B).click();
  const s3 = [];
  for (const [n, pg] of all) s3.push([n, await offStage(pg)]);
  check('Ann and Ben vote Phone off the stage: Phone steps down on every page', s3.every((x) => x[1]),
    { pages: s3, votes: await A.evaluate(() => window.__gifosVideo.stageVotes()) });

  await browser.close();
  console.log(failures ? 'FAILURES: ' + failures : 'ALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
