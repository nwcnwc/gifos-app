/*
 * The header must name how many people are actually in the call, and which
 * room this is. The whole phrase has to fit. Four real peers used to read
 * "Just you — s…", and the chip never said the meeting.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/header-count.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

const PHONES = [
  { name: 'iphone-se', device: devices['iPhone SE'] },
  { name: 'iphone-15', device: devices['iPhone 15'] },
];

const PEOPLE = [
  { id: 'peer-ruth', name: 'Ruth', color: '#3b4d78' },
  { id: 'peer-david', name: 'David', color: '#6b4532' },
  { id: 'peer-sam', name: 'Sam', color: '#2c5a46' },
];

async function boot(browser, device) {
  const context = await browser.newContext(Object.assign({}, device, { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Grandma Ruth'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=header-count', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#status', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.waitForTimeout(200);
  return { context, page };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  for (const phone of PHONES) {
    const { context, page } = await boot(browser, phone.device);
    const presented = await page.evaluate(async (people) => {
      const api = window.__gifosVideo;
      if (!api || typeof api.presentPeers !== 'function') {
        // The old audit cloned tiles the room does not know. That is the
        // screen Nathan saw: four faces, and a header that still says just you.
        const grid = document.getElementById('grid');
        const me = grid && grid.querySelector('.tile.me');
        if (me) {
          people.forEach((person) => {
            const t = me.cloneNode(true);
            t.classList.remove('me');
            t.removeAttribute('style');
            t.dataset.peer = person.id;
            const label = t.querySelector('.name');
            if (label) label.textContent = person.name;
            grid.appendChild(t);
          });
          document.body.classList.add('has-peers');
          grid.dataset.remotes = String(people.length);
        }
        return { ok: false, why: 'people on screen are not peers the header counts' };
      }
      let noted;
      try { noted = api.presentPeers(people); } catch (e) { return { ok: false, why: String(e).slice(0, 160) }; }
      for (const person of people) {
        const tile = document.querySelector('.tile[data-peer="' + person.id + '"]');
        const video = tile && tile.querySelector('video');
        if (!video) continue;
        const c = document.createElement('canvas');
        c.width = 160; c.height = 240;
        const g = c.getContext('2d');
        g.fillStyle = person.color;
        g.fillRect(0, 0, 160, 240);
        try {
          const stream = c.captureStream(8);
          video.srcObject = stream;
          video.muted = true;
          await video.play().catch(() => {});
          tile.classList.remove('cam-off');
        } catch (e) {}
      }
      return { ok: true, noted: noted };
    }, PEOPLE);
    const info = await page.evaluate(() => {
      const el = document.getElementById('status');
      const chipEl = document.querySelector('.topchip');
      const chip = chipEl.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const fit = document.getElementById('fitbtn').getBoundingClientRect();
      const names = Array.from(document.querySelectorAll('.tile .name')).map((n) => n.textContent.trim());
      const hit = !(b.right < fit.left + 1 || b.left > fit.right - 1 || b.bottom < fit.top + 1 || b.top > fit.bottom - 1);
      return {
        text: el.textContent,
        title: el.title || '',
        clipped: el.scrollWidth > el.clientWidth + 2,
        inChip: b.left >= chip.left - 1 && b.right <= chip.right + 1 && b.top >= chip.top - 1 && b.bottom <= chip.bottom + 1,
        off: b.left < -1 || b.right > window.innerWidth + 1,
        coversFit: hit && fit.height > 2,
        names: names,
        count: (window.__gifosVideo && window.__gifosVideo.participants) ? window.__gifosVideo.participants() : null,
      };
    });
    const bad = [];
    if (!presented.ok) bad.push(presented.why || 'could not present peers');
    if (info.text !== 'header-count · 4 in call') bad.push('header "' + info.text + '"');
    if (info.clipped) bad.push('header text is cut off');
    if (info.off || !info.inChip) bad.push('header sits outside the chip');
    if (info.coversFit) bad.push('header covers Fit');
    for (const person of PEOPLE) {
      if (!info.names.some((n) => n.indexOf(person.name) >= 0)) bad.push('missing tile ' + person.name);
    }
    if (!info.names.some((n) => n.indexOf('Grandma Ruth') >= 0)) bad.push('missing self tile');
    if (phone.name === 'iphone-15') {
      const file = bad.length ? 'before-room-name-iphone-15.png' : 'after-room-name-iphone-15.png';
      await page.screenshot({ path: path.join(SHOTS, file) });
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; ') + ' ' + JSON.stringify(info));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS header count');
})().catch((e) => { console.error(e); process.exit(1); });
