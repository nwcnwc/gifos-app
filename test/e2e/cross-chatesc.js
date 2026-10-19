/*
 * cross-chatesc.js — Escape closes an open chat, on the host and on a viewer
 * on another machine, and the keyboard lands back on Chat.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each opens Chat, types in the message field, and presses Escape
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, sleep } = require('./cross-lib.js');

async function escChat(pg) {
  await pg.locator('#chatbtn').click();
  await pg.waitForSelector('#chatpanel.open');
  await pg.locator('#chat-in').fill('Amen');
  await pg.keyboard.press('Escape');
  await sleep(400);
  return pg.evaluate(() => ({
    open: document.getElementById('chatpanel').classList.contains('open'),
    focus: document.activeElement && document.activeElement.id,
  }));
}

run('cross-chatesc', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'chatesc');
  const viewer = await watch(vb, host);
  const out = { host: await escChat(host), viewer: await escChat(viewer) };
  await shoot();
  for (const [who, s] of Object.entries(out)) {
    if (s.open || s.focus !== 'chatbtn') throw new Error(who + ' chat did not close on Escape: ' + JSON.stringify(out));
  }
  return 'Escape closes chat on both and focus is on Chat: ' + JSON.stringify(out);
});
