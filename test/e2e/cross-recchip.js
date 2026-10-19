/*
 * cross-recchip.js — in a small group of two on two machines, when the first
 * person records, the second sees the recording chip on the first person's
 * tile name the small group, as the card and room bar do.
 *
 *   1. the first person starts a call, the second opens its link
 *   2. the first turns recording on (the room trust hook, as the Record
 *      sheet's Start does); the second presses Stay on the card
 *   3. the second reads the chip on the first person's tile
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { BASE, until, user, run, sleep } = require('./cross-lib.js');

run('cross-recchip', async (hb, vb, shoot) => {
  const a = await user(hb, 'Sam Rivera');
  await a.goto(BASE + '/run.html?desk=crosschipa');
  await a.waitForSelector('#lobby.show');
  await a.locator('#lob-open').click();
  await until('call started', async () => ({ ok: /#v=/.test(a.url()) }), 15000);
  const b = await user(vb, 'Jordan Lee');
  await b.goto(BASE + '/run.html?desk=crosschipb#' + a.url().split('#')[1]);
  await b.getByRole('button', { name: 'Save' }).click({ timeout: 20000 }).catch(() => {});
  await until('both in the call', async () => ({
    ok: await a.evaluate(() => document.querySelectorAll('.tile:not(.me)').length >= 1),
  }), 30000);
  await a.evaluate(() => window.__gifosRoomTrust.setRecording(true));
  await until('the second person gets the recording card', async () => ({ ok: await b.locator('#rec-notice-ok').isVisible() }), 20000);
  await b.locator('#rec-notice-ok').click();
  const got = await until('the chip shows on the first person\'s tile', async () => {
    const chip = await b.evaluate(() => {
      const t = Array.from(document.querySelectorAll('.tile:not(.me)')).find((x) => /Sam Rivera/.test(x.textContent));
      const c = t && Array.from(t.querySelectorAll('.chips .warn')).find((s) => s.textContent.indexOf('⏺') >= 0);
      return c && c.getClientRects().length ? c.textContent : '';
    });
    return { ok: !!chip, chip };
  }, 20000);
  await sleep(300);
  await shoot();
  if (got.chip !== '⏺ recording this meeting') throw new Error('the chip does not name the small group: ' + JSON.stringify(got.chip));
  return 'chip ' + JSON.stringify(got.chip);
});
