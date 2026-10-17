/*
 * cross-chat.js — a viewer's chat line crosses a real link to the host.
 *
 *   1. the host goes live, the viewer opens the link (see cross-lib.js)
 *   2. the viewer sends a chat line the moment its link opens
 *   3. the host's chat shows the line
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { until, goLive, watch, run } = require('./cross-lib.js');

run('cross-chat', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'chat');
  const viewer = await watch(vb, host);
  const text = 'Amen from row ' + Math.random().toString(36).slice(2, 7);
  // Sent inside the page the moment the link opens, with no round trip to
  // this script in between: that is when the roster is still catching up.
  await viewer.evaluate((t) => new Promise((resolve, reject) => {
    const end = Date.now() + 60000;
    (function wait() {
      if (window.__gifosVideo.liveDataLinks() >= 1) {
        document.getElementById('chat-in').value = t;
        document.getElementById('chatform').requestSubmit();
        resolve();
      } else if (Date.now() > end) reject(new Error('no link in 60s'));
      else setTimeout(wait, 20);
    })();
  }), text);
  await host.locator('#chatbtn').click();
  try {
    await until('host chat shows the line', async () => {
      const t = await host.locator('#chatlog').innerText();
      return { ok: t.includes(text), t: t.slice(-200) };
    }, 15000);
  } finally { await shoot(); }
  return 'viewer chatted as the link opened; the host reads the line';
});
