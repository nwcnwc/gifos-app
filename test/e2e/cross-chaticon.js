/*
 * cross-chaticon.js — the Chat icon on the dock matches the mic icon size on
 * the host and on a viewer on another machine.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each reads the width of the Chat and mic icons on its dock
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run } = require('./cross-lib.js');

const sizes = (pg) => pg.evaluate(() => {
  const w = (sel) => { const el = document.querySelector(sel); return el && el.offsetParent !== null ? Math.round(el.getBoundingClientRect().width) : null; };
  return { chat: w('.bar #chatbtn svg'), mic: w('.bar #mic svg') };
});

run('cross-chaticon', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'chaticon');
  const viewer = await watch(vb, host);
  const out = { host: await sizes(host), viewer: await sizes(viewer) };
  await shoot();
  for (const [who, s] of Object.entries(out)) {
    if (!s.chat || s.chat !== s.mic) throw new Error(who + ' Chat icon is not mic size: ' + JSON.stringify(out));
  }
  return 'both docks draw Chat at mic size: ' + JSON.stringify(out);
});
