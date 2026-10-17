/*
 * cross-chatoff.js — with chat turned off, the host's and a viewer's chat box
 * (on another machine, 1280x720) each show the whole "chat is off" line.
 *
 *   1. the host goes live (see cross-lib.js), the viewer opens the link
 *   2. both open Chat; the host presses Turn chat off
 *   3. the viewer's box locks; each placeholder must fit the box's text room
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { goLive, watch, run, until, sleep } = require('./cross-lib.js');

const read = (pg) => pg.evaluate(() => {
  const inp = document.getElementById('chat-in');
  const cs = getComputedStyle(inp);
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
  return { text: inp.placeholder, disabled: inp.disabled, need: Math.ceil(ctx.measureText(inp.placeholder).width),
    room: Math.floor(inp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) };
});

run('cross-chatoff', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'chatoff');
  const viewer = await watch(vb, host);
  for (const pg of [host, viewer]) { await pg.locator('#chatbtn').click(); await pg.waitForSelector('#chatpanel.open'); }
  await host.locator('#chatmod').click();
  await until('the viewer\'s chat locks', async () => ({ ok: (await read(viewer)).disabled, v: await read(viewer) }), 20000);
  await sleep(400);
  const out = { host: await read(host), viewer: await read(viewer) };
  await shoot();
  if (out.host.disabled) throw new Error('the host lost the box ' + JSON.stringify(out));
  for (const [who, s] of Object.entries(out)) {
    if (!/chat is off|chat off/i.test(s.text) || s.need > s.room) throw new Error(who + ': the chat-off placeholder runs past the box ' + JSON.stringify(out));
  }
  return 'both read the whole chat-off line: ' + JSON.stringify(out);
});
