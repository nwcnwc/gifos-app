/*
 * cross-chaticon.js — the Chat icon on the dock is as large as Invite's, on
 * the host and on a viewer on another machine.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each reads the width of the Chat and Invite icons on its dock
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run } = require('./cross-lib.js');

const sizes = (pg) => pg.evaluate(() => {
  const w = (sel) => { const el = document.querySelector(sel); return el && el.offsetParent !== null ? Math.round(el.getBoundingClientRect().width) : null; };
  return { chat: w('.bar #chatbtn svg'), invite: w('.bar #invite svg') };
});

run('cross-chaticon', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'chaticon');
  const viewer = await watch(vb, host);
  const out = { host: await sizes(host), viewer: await sizes(viewer) };
  await shoot();
  for (const [who, s] of Object.entries(out)) {
    if (!s.chat || s.chat !== s.invite) throw new Error(who + ' Chat icon is not Invite size: ' + JSON.stringify(out));
  }
  return 'both docks draw Chat at Invite size: ' + JSON.stringify(out);
});
