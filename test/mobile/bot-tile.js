/*
 * A notes bot is a person in the room. The header counts them. The tile
 * must be a full face like the others, with the bot badge kept, and no
 * Blur for all (there is no face to blur).
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/bot-tile.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const BOT = 'notes-7597fb';

function overlaps(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['Pixel 7'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'bot-tile', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.evaluate((bot) => {
    const api = window.__gifosVideo;
    api.presentPeers([
      { id: 'host-test', name: 'Host (test)' },
      { id: 'guest-3106', name: 'Guest 3106' },
      { id: bot, name: 'bot notes-7597fb' },
    ]);
    api._ghostStatus(bot, 0, { bot: true, camOff: true });
  }, BOT);
  await page.waitForTimeout(300);
  const info = await page.evaluate((bot) => {
    const api = window.__gifosVideo;
    const nodes = [];
    document.querySelectorAll('#feed .tile').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const mark = el.querySelector(':scope > .botbadge');
      nodes.push({
        id: el.dataset.peer || '',
        x: r.x, y: r.y, w: r.width, h: r.height,
        badge: mark ? mark.textContent : '',
        badgeBox: mark ? { x: mark.getBoundingClientRect().x, y: mark.getBoundingClientRect().y, w: mark.getBoundingClientRect().width, h: mark.getBoundingClientRect().height } : null,
        blur: (() => {
          const b = el.querySelector(':scope > .blurbox');
          if (!b) return null;
          const r = b.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height, on: b.classList.contains('on') };
        })(),
      });
    });
    return {
      n: api.participants(),
      status: document.getElementById('status').textContent,
      nodes: nodes,
      vh: window.innerHeight,
      vw: window.innerWidth,
    };
  }, BOT);
  const bad = [];
  const bot = info.nodes.find((n) => n.id === BOT);
  const others = info.nodes.filter((n) => n.id !== BOT);
  if (info.n !== 4) bad.push('header count ' + info.n + ' (' + info.status + ')');
  if (info.nodes.length !== 4) bad.push('tiles on screen ' + info.nodes.length);
  if (!bot) bad.push('bot tile missing');
  else {
    if (bot.badge.indexOf('bot') < 0) bad.push('bot badge "' + bot.badge + '"');
    const shorts = others.map((n) => Math.min(n.w, n.h)).sort((a, b) => a - b);
    const med = shorts.length ? shorts[Math.floor(shorts.length / 2)] : 0;
    const side = Math.min(bot.w, bot.h);
    if (!(med > 0) || side < med * 0.75) bad.push('bot tile ' + Math.round(bot.w) + 'x' + Math.round(bot.h) + ' beside ' + Math.round(med));
    const aspect = bot.w / bot.h;
    if (aspect < 0.44 || aspect > 1.15) bad.push('bot aspect ' + aspect.toFixed(2));
    for (const o of others) {
      const hit = overlaps(bot, o);
      if (hit > bot.w * bot.h * 0.15) bad.push('bot covers ' + o.id);
    }
    // A bot has no camera, so its tile is never clear and offers no Blur
    // for all (host-tile-blur-states.js: no blur control on a soft tile).
    if (bot.blur && bot.blur.on) bad.push('a bot, with no face to blur, offers Blur for all');
  }
  const shot = bad.length ? 'before-bot-tile-pixel-7.png' : 'after-bot-tile-pixel-7.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS bot tile');
})().catch((e) => { console.error(e); process.exit(1); });
