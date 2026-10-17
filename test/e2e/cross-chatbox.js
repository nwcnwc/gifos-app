/*
 * cross-chatbox.js — the chat box shows its whole "Message everyone…"
 * placeholder beside Send, on the host and on a viewer on another machine
 * (1280x720), and every compose button stays inside the panel.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. each opens Chat; the placeholder's width must fit the box's text room
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, sleep } = require('./cross-lib.js');

async function openChat(pg) {
  await pg.locator('#chatbtn').click();
  await pg.waitForSelector('#chatpanel.open');
  await sleep(400);
  return pg.evaluate(() => {
    const inp = document.getElementById('chat-in');
    const cs = getComputedStyle(inp);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const panel = document.getElementById('chatpanel').getBoundingClientRect();
    const out = [];
    for (const e of document.querySelectorAll('#chatform button, #chat-in')) {
      const r = e.getBoundingClientRect();
      if (r.left < panel.left || r.right > panel.right) out.push(e.id || e.type);
    }
    return { text: inp.placeholder, need: Math.ceil(ctx.measureText(inp.placeholder).width),
      room: Math.floor(inp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)), out };
  });
}

run('cross-chatbox', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'chatbox');
  const viewer = await watch(vb, host);
  const out = { host: await openChat(host), viewer: await openChat(viewer) };
  await shoot();
  for (const [who, s] of Object.entries(out)) {
    if (s.text !== 'Message everyone…' || s.need > s.room || s.out.length) throw new Error(who + ': the chat box cuts its placeholder ' + JSON.stringify(out));
  }
  return 'the whole placeholder shows on both: ' + JSON.stringify(out);
});
