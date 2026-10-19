/*
 * cross-chaticon.js — the host's Chat icon matches the mic icon. A viewer
 * watches and has no mic; their Chat icon matches the host's.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each reads the width of the Chat and mic icons on its dock
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run } = require('./cross-lib.js');

const sizes = (pg) => pg.evaluate(() => {
  // A hidden dock button (a viewer's mic) has no icon to measure. An svg
  // inside display:none still reports an offsetParent, so read the button.
  const w = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const btn = el.closest('button');
    if (!btn || getComputedStyle(btn).display === 'none') return null;
    return Math.round(el.getBoundingClientRect().width);
  };
  return { chat: w('.bar #chatbtn svg'), mic: w('.bar #mic svg') };
});

run('cross-chaticon', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'chaticon');
  const viewer = await watch(vb, host);
  const out = { host: await sizes(host), viewer: await sizes(viewer) };
  await shoot();
  if (!out.host.chat || out.host.chat !== out.host.mic) throw new Error('host Chat icon is not mic size: ' + JSON.stringify(out));
  // A viewer watches and does not publish, so the dock has no mic.
  // Chat is the same size as the host's Chat icon.
  if (out.viewer.mic != null) throw new Error('a viewer has a mic on the dock: ' + JSON.stringify(out));
  if (!out.viewer.chat || out.viewer.chat !== out.host.chat) throw new Error('viewer Chat icon is not the host Chat size: ' + JSON.stringify(out));
  return 'host Chat matches the mic; the viewer has no mic and the same Chat icon: ' + JSON.stringify(out);
});
