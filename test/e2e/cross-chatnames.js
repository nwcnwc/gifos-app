/*
 * cross-chatnames.js — the chat's close and attach buttons have names, on the
 * host and on a viewer on another machine, and closing the chat from its
 * close button puts the keyboard back on Chat.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each opens Chat, reads the two buttons' names, and presses close
 *      from the keyboard
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, sleep } = require('./cross-lib.js');

async function closeChat(pg) {
  await pg.locator('#chatbtn').click();
  await pg.waitForSelector('#chatpanel.open');
  const names = await pg.evaluate(() => ['chatclose', 'cattach'].map((id) => {
    const el = document.getElementById(id);
    return el.getAttribute('aria-label') || el.textContent.trim();
  }));
  await pg.locator('#chatclose').focus();
  await pg.keyboard.press('Enter');
  await sleep(400);
  return pg.evaluate((n) => ({
    close: n[0], attach: n[1],
    open: document.getElementById('chatpanel').classList.contains('open'),
    focus: document.activeElement && (document.activeElement.id || document.activeElement.tagName),
  }), names);
}

run('cross-chatnames', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'chatnames');
  const viewer = await watch(vb, host);
  const out = { host: await closeChat(host), viewer: await closeChat(viewer) };
  await shoot();
  for (const [who, s] of Object.entries(out)) {
    if (s.close !== 'Close chat' || s.attach !== 'Pin a file to this service' || s.open || s.focus !== 'chatbtn') {
      throw new Error(who + ' chat buttons: ' + JSON.stringify(out));
    }
  }
  return 'named on both, and close returns to Chat: ' + JSON.stringify(out);
});
