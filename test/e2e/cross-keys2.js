/*
 * cross-keys2.js — in a live service, C opens the chat (keyboard in the
 * message box), R opens Reactions (keyboard on the first one), and H raises
 * a viewer's hand, which the host then sees in the hand queue.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each presses C, Escape, R, Escape; the viewer presses H
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, until, run } = require('./cross-lib.js');

async function keys(pg) {
  await pg.evaluate(() => document.activeElement && document.activeElement.blur());
  await pg.keyboard.press('c');
  const chat = await pg.evaluate(() => ({
    open: document.getElementById('chatpanel').classList.contains('open'),
    focus: document.activeElement ? document.activeElement.id : '',
  }));
  await pg.keyboard.press('Escape');
  await pg.keyboard.press('r');
  const react = await pg.evaluate(() => ({
    open: !document.getElementById('reacttray').hasAttribute('hidden'),
    focus: document.activeElement && document.activeElement.closest('#reacttray') ? 'tray' : '',
  }));
  await pg.keyboard.press('Escape');
  return { chat, react };
}

run('cross-keys2', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'keys2');
  const viewer = await watch(vb, host);
  const out = { host: await keys(host), viewer: await keys(viewer) };
  await viewer.keyboard.press('h');
  // The host's raised-hands list hears it over the room.
  out.hostSeesHand = await until('host sees the hand', async () => ({
    ok: await host.evaluate(() => /Jordan Lee/.test((document.getElementById('handq') || {}).textContent || '')),
  }), 15000).then(() => true, () => false);
  await shoot();
  const bad = [];
  for (const who of ['host', 'viewer']) {
    const s = out[who];
    if (!s.chat.open) bad.push(who + ': C opens no chat');
    else if (s.chat.focus !== 'chat-in') bad.push(who + ': C leaves the keyboard on ' + s.chat.focus);
    if (!s.react.open) bad.push(who + ': R opens no Reactions');
    else if (s.react.focus !== 'tray') bad.push(who + ': R leaves the keyboard off the tray');
  }
  if (!out.hostSeesHand) bad.push('viewer: H raised no hand the host sees');
  if (bad.length) throw new Error(bad.join('; ') + ' ' + JSON.stringify(out));
  return 'both: ' + JSON.stringify(out);
});
