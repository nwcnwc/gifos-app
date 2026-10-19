/*
 * cross-recleave.js — in a small group of two on two machines, when the first
 * person starts recording, the second gets a card that says staying means
 * agreeing to be recorded, with Stay and Leave; Leave takes them out of the
 * call and the first person's tile for them goes away.
 *
 *   1. the first person starts a call, the second opens its link
 *   2. the first turns recording on (the room trust hook, as the Record
 *      sheet's Start does); the second must read the card with Leave
 *   3. the second presses Leave
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { BASE, until, user, run, sleep } = require('./cross-lib.js');

run('cross-recleave', async (hb, vb, shoot) => {
  const a = await user(hb, 'Sam Rivera');
  await a.goto(BASE + '/run.html?desk=crossreca');
  await a.waitForSelector('#lobby.show');
  await a.locator('#lob-open').click();
  await until('call started', async () => ({ ok: /#v=/.test(a.url()) }), 15000);
  const b = await user(vb, 'Jordan Lee');
  await b.goto(BASE + '/run.html?desk=crossrecb#' + a.url().split('#')[1]);
  await b.getByRole('button', { name: 'Save' }).click({ timeout: 20000 }).catch(() => {});
  await until('both in the call', async () => ({
    ok: await a.evaluate(() => document.querySelectorAll('.tile:not(.me)').length >= 1),
  }), 30000);
  await a.evaluate(() => window.__gifosRoomTrust.setRecording(true));
  const card = await until('the second person gets the recording card', async () => {
    const got = await b.evaluate(() => {
      const box = document.querySelector('#rec-notice .appear-box');
      if (!box) return null;
      const leave = document.getElementById('rec-notice-leave');
      return { text: box.innerText, ok: document.getElementById('rec-notice-ok').textContent, leave: leave && leave.getClientRects().length ? leave.textContent : '' };
    });
    return { ok: !!got, got };
  }, 20000);
  await sleep(300);
  await shoot();
  const g = card.got;
  if (!/^Sam Rivera is recording this meeting/.test(g.text)) throw new Error('the card does not name who is recording ' + JSON.stringify(g));
  if (!/Staying means you agree to be recorded/.test(g.text) || g.ok !== 'Stay' || g.leave !== 'Leave') throw new Error('no way to say no to the recording ' + JSON.stringify(g));
  await b.locator('#rec-notice-leave').click();
  await until('the second person left', async () => ({ ok: await b.locator('#left-modal').isVisible() }), 10000);
  await until('the first person sees them go', async () => ({
    ok: await a.evaluate(() => document.querySelectorAll('.tile:not(.me)').length === 0),
  }), 30000);
  return 'card ' + JSON.stringify(g) + '; Leave took them out of the call';
});
