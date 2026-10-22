/*
 * React keeps a stable dock slot. Showing or hiding it (the tray, or the
 * fit pass a tray open runs) must not move More or Leave. On a 393px phone
 * the fit pass was dropping React for a 16px gutter, and More slid onto Leave.
 *
 *   MEET_BASE=http://127.0.0.1:8994 PHASE=before node test/mobile/dock-slots.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8994';
const PHASE = process.env.PHASE || 'run';
const EVIDENCE = process.env.EVIDENCE || path.join(__dirname, '..', '..', '..', '..', 'evidence', 'dock-slots-1018');
const OUT = path.join(EVIDENCE, PHASE);

const PHONES = [
  { name: 'pixel-5', device: devices['Pixel 5'] },
  { name: 'pixel-7', device: devices['Pixel 7'] },
  {
    name: 'moto-360',
    device: {
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: devices['Pixel 5'].userAgent,
    },
  },
];

function boxes(page) {
  return page.evaluate(() => {
    const bar = document.querySelector('.bar');
    const ids = ['reactbtn', 'bartoggle', 'leavebtn'];
    const out = { vw: window.innerWidth };
    for (const id of ids) {
      const el = document.getElementById(id);
      const b = el.getBoundingClientRect();
      out[id] = {
        x: Math.round(b.left * 10) / 10,
        r: Math.round(b.right * 10) / 10,
        w: Math.round(b.width * 10) / 10,
        inmore: el.classList.contains('inmore'),
      };
    }
    const tray = document.getElementById('reacttray');
    out.tray = !!(tray && !tray.hasAttribute('hidden'));
    out.barW = bar ? Math.round(bar.getBoundingClientRect().width * 10) / 10 : 0;
    return out;
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--mute-audio', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  const report = {};
  for (const phone of PHONES) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => {
      try {
        localStorage.setItem('gifos_name', 'Pat');
        sessionStorage.setItem('gifos_appear_ok', '1');
      } catch (e) {}
    });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html?desk=dockslots#v=' + RUN_ROOM + 'dock-slots-' + phone.name + '&DEBUG=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#reactbtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.waitForTimeout(250);
    const shown = await boxes(page);
    await page.screenshot({ path: path.join(OUT, phone.name + '-react-shown.png') });
    await page.locator('#reactbtn').tap();
    await page.waitForTimeout(200);
    const hidden = await boxes(page);
    await page.screenshot({ path: path.join(OUT, phone.name + '-react-open.png') });
    // The right side of More is the thumb that lands on Leave once React drops out.
    const hitMore = await page.evaluate((box) => {
      const leave = document.getElementById('leavebtn').getBoundingClientRect();
      const cy = leave.top + leave.height / 2;
      const x = box.r - 8;
      const el = document.elementFromPoint(x, cy);
      const btn = el && el.closest ? el.closest('button') : null;
      return { id: btn ? btn.id : '', x, y: cy };
    }, shown.bartoggle);
    const dxMore = Math.round((hidden.bartoggle.x - shown.bartoggle.x) * 10) / 10;
    const dxLeave = Math.round((hidden.leavebtn.x - shown.leavebtn.x) * 10) / 10;
    const row = { shown, hidden, dxMore, dxLeave, hit: hitMore.id };
    report[phone.name] = row;
    const bad = [];
    if (Math.abs(dxMore) > 1) bad.push('More moved ' + dxMore + 'px');
    if (Math.abs(dxLeave) > 1) bad.push('Leave moved ' + dxLeave + 'px');
    if (hitMore.id === 'leavebtn') bad.push('a tap on More hit Leave');
    else if (hitMore.id !== 'bartoggle') bad.push('a tap on More hit ' + (hitMore.id || 'nothing'));
    if (!hidden.tray) bad.push('React tray did not open');
    if (hidden.reactbtn.inmore || hidden.reactbtn.w < 1) bad.push('React left its slot');
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    else console.log('PASS', phone.name, 'More', shown.bartoggle.x, 'Leave', shown.leavebtn.x, 'hit', hitMore.id);
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'positions.json'), JSON.stringify(report, null, 2));
  const text = failures.length ? ('FAIL\n' + failures.join('\n')) : 'PASS dock slots stable';
  fs.writeFileSync(path.join(OUT, 'result.txt'), text + '\n');
  console.log(text);
  if (failures.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
