/*
 * cross-lobedge.js — the lobby card keeps a 16px gap to the window's right
 * edge, as the preview does to the left, on a real browser on each machine
 * (the first opens a small group's lobby, the second a service's, 1280x720).
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { BASE, user, run, sleep } = require('./cross-lib.js');

const read = (pg) => pg.evaluate(() => {
  const lob = document.getElementById('lobby');
  const pv = document.getElementById('lob-preview').getBoundingClientRect();
  const card = document.querySelector('#lobby .lobby-card').getBoundingClientRect();
  return { leftGap: Math.round(pv.left), rightGap: Math.round(innerWidth - card.right), between: Math.round(card.left - pv.right),
    lobbyScroll: lob.scrollWidth - lob.clientWidth };
});

run('cross-lobedge', async (hb, vb, shoot) => {
  const group = await user(hb, 'Avery Chen');
  const service = await user(vb, 'Jordan Lee');
  await group.goto(BASE + '/run.html?desk=crosslobg');
  await service.goto(BASE + '/run.html?desk=crosslobs#bc=1');
  for (const pg of [group, service]) await pg.waitForSelector('#lobby.show');
  await sleep(400);
  const out = { group: await read(group), service: await read(service) };
  await shoot();
  for (const [who, g] of Object.entries(out)) {
    if (g.rightGap !== g.leftGap || g.between !== g.leftGap || g.lobbyScroll > 0) throw new Error(who + ': the card is not 16px off the right edge ' + JSON.stringify(out));
  }
  return 'both lobby cards keep the gap: ' + JSON.stringify(out);
});
