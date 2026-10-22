/*
 * Grace joins the prayer call from the church lobby iPad, so her tile
 * says "Lobby iPad". The host renames it to "Grace" in People. Nathan
 * asks the room to pray for Ann; Grace puts a 🙏 on it. Her tile says
 * Grace, but tapping the line reads "🙏 Lobby iPad": reactions used the
 * name the device sent, not the one the host gave. A corporate host who
 * renames "iPhone (3)" to "Dana, Finance" hits the same thing.
 * A reaction names people the way their tile and People do.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/chat-react-renamed.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['iPhone SE'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'chat-react-renamed&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, names: ['Ruth', 'Lobby iPad'] }));
  const bad = [];
  if (!seeded || !seeded.ok) bad.push('could not seat Ruth and the lobby iPad: ' + JSON.stringify(seeded));
  // The host renames the lobby iPad to Grace in People (a phone opens it
  // from the room sheet).
  await page.waitForTimeout(150);
  await page.locator('#status').tap();
  await page.waitForTimeout(80);
  await page.locator('#status-full-people').tap();
  await page.waitForTimeout(120);
  await page.locator('#roster .renamebtn[aria-label="Rename Lobby iPad"]').scrollIntoViewIfNeeded().catch(() => {});
  await page.locator('#roster .renamebtn[aria-label="Rename Lobby iPad"]').tap();
  await page.locator('#roster .renamebox').fill('Grace');
  await page.locator('#roster .renamesave').tap();
  await page.waitForTimeout(80);
  const tile = await page.evaluate(() => {
    const t = document.querySelector('.tile[data-peer="qa2"] .name');
    return t ? (t.textContent || '').trim() : '';
  });
  if (!/Grace/.test(tile)) bad.push('the host rename did not reach the tile ("' + tile + '")');
  const rc = page.locator('#roster-close');
  if (await page.evaluate(() => document.getElementById('roster').classList.contains('open')) && await rc.count()) await rc.tap();
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.locator('#chat-in').fill('Please pray for Ann, surgery Thursday');
  await page.locator('#chat-in').press('Enter');
  await page.waitForTimeout(80);
  const mineId = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('#chatlog .cmsg[data-line]')).find((x) => (x.innerText || '').indexOf('pray for Ann') >= 0);
    return el ? el.getAttribute('data-line') : null;
  });
  if (!mineId) bad.push('your line did not post');
  else {
    await page.evaluate((id) => {
      const c = window.__gifosChat;
      c.frame('qa1', { k: 'creact', id: id, e: '🙏', on: true, by: 'qa1' });
      c.frame('qa2', { k: 'creact', id: id, e: '🙏', on: true, by: 'qa2' });
    }, mineId);
    await page.waitForTimeout(40);
    await page.locator('#chatlog .cmsg', { hasText: 'pray for Ann' }).locator('.cbody').tap();
    await page.waitForTimeout(60);
    const info = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('#chatlog .cmsg[data-line]')).find((x) => (x.innerText || '').indexOf('pray for Ann') >= 0);
      if (!el) return null;
      const w = el.querySelector('.cwhorx');
      const chip = el.querySelector('[data-react-chip="🙏"]');
      return {
        open: el.getAttribute('aria-expanded'),
        who: w ? (w.innerText || '').replace(/\s+/g, ' ') : '',
        label: chip ? chip.getAttribute('aria-label') : '',
      };
    });
    if (!info) bad.push('your line is gone');
    else {
      if (info.open !== 'true') bad.push('tapping the line did not open it');
      if (!/Ruth/.test(info.who) || !/Grace/.test(info.who)) bad.push('the open line reads "' + info.who + '", not Ruth and Grace');
      if (/Lobby iPad/.test(info.who) || /Lobby iPad/.test(info.label)) bad.push('Grace shows by the device name, not the host\'s rename ("' + info.label + '")');
    }
  }
  await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-chat-react-renamed-iphone-se.png') });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS chat react renamed');
})().catch((e) => { console.error(e); process.exit(1); });
