/*
 * Record and Captions sit on the call. A producer does not open More
 * to start a recording or captions. LIVE is not on a regular meeting.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/call-state.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function phone360() {
  return {
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['Pixel 7'].userAgent,
  };
}

const PHONES = [
  { name: 'iphone-15', device: devices['iPhone 15'], scale: null },
  { name: 'iphone-se', device: devices['iPhone SE'], scale: null },
  { name: 'android-360-200', device: phone360(), scale: '2' },
];

function overlaps(a, b) {
  return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  for (const phone of PHONES) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript((scale) => {
      try {
        localStorage.setItem('gifos_name', 'Host');
        if (scale) localStorage.setItem('gifos_ui_scale', scale);
      } catch (e) {}
    }, phone.scale);
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=call-state-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.waitForTimeout(250);
    const row = page.locator('#callstate');
    if (!(await row.count())) {
      if (phone.name === 'iphone-15') await page.screenshot({ path: path.join(SHOTS, 'before-call-state-iphone-15.png') });
      failures.push(phone.name + ': no live/record state on the call');
      await context.close();
      continue;
    }
    const info = await page.evaluate(() => {
      const box = (id) => {
        const el = document.getElementById(id);
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
          top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          w: b.width, h: b.height,
          font: parseFloat(cs.fontSize),
          bg: cs.backgroundColor, color: cs.color,
          wide: el.scrollWidth > el.clientWidth + 2,
          tall: el.scrollHeight > el.clientHeight + 2,
          hidden: el.hidden || cs.display === 'none',
        };
      };
      const moreOpen = !document.querySelector('.bar').classList.contains('collapsed');
      return {
        moreOpen: moreOpen,
        state: box('callstate'),
        live: box('call-live'),
        rec: box('call-rec'),
        cc: box('call-cc'),
        status: box('status'),
        dockTop: document.querySelector('.bar').getBoundingClientRect().top,
        vw: window.innerWidth, vh: window.innerHeight,
      };
    });
    const bad = [];
    if (info.moreOpen) bad.push('More is open');
    if (info.state.hidden) bad.push('state hidden');
    if (!info.live.hidden) bad.push('LIVE is on a regular meeting');
    if (info.rec.text !== 'Record') bad.push('record says "' + info.rec.text + '"');
    if (info.cc.text !== 'Captions') bad.push('captions says "' + info.cc.text + '"');
    for (const part of [info.rec, info.cc]) {
      if (part.h < 44 || part.w < 44) bad.push(part.text + ' is ' + Math.round(part.w) + 'x' + Math.round(part.h));
      if (part.wide || part.tall) bad.push(part.text + ' text does not fit');
      if (part.top < -1 || part.bottom > info.vh + 1 || part.left < -1 || part.right > info.vw + 1) bad.push(part.text + ' off screen');
      if (part.bottom > info.dockTop + 1) bad.push(part.text + ' runs into the dock');
      if (overlaps(part, info.status)) bad.push(part.text + ' covers the header');
    }
    if (info.rec.bg === 'rgb(182, 22, 34)') bad.push('Record is red before it starts');
    if (phone.scale && info.rec.font < 24) bad.push('record font ' + info.rec.font + 'px at 200%');
    if (phone.name === 'iphone-15') await page.screenshot({ path: path.join(SHOTS, 'after-call-state-iphone-15.png') });
    if (!phone.scale) {
      await page.locator('#call-cc').tap();
      await page.waitForTimeout(100);
      const ccOn = await page.evaluate(() => ({
        more: document.getElementById('ccbtn').classList.contains('on'),
        chip: document.getElementById('call-cc').classList.contains('on'),
        text: (document.getElementById('call-cc').innerText || '').trim(),
        ccBg: getComputedStyle(document.getElementById('call-cc')).backgroundColor,
      }));
      if (!ccOn.more || !ccOn.chip) bad.push('Captions on the call did not turn captions on');
      if (ccOn.text !== 'Captions') bad.push('captions label changed to "' + ccOn.text + '"');
      if (ccOn.ccBg !== 'rgb(0, 100, 200)') bad.push('Captions on is ' + ccOn.ccBg);
      await page.locator('#call-rec').tap();
      await page.waitForTimeout(150);
      const recSheet = await page.evaluate(() => {
        const el = document.getElementById('rec-options');
        if (!el) return { open: false, text: '' };
        const cs = getComputedStyle(el);
        return { open: cs.display !== 'none', text: (el.innerText || '').slice(0, 80) };
      });
      if (!recSheet.open || recSheet.text.indexOf('Record this meeting') < 0) bad.push('Record on the call did not open the record sheet');
      const cancel = page.locator('#ro-cancel');
      if (await cancel.count()) await cancel.tap().catch(() => {});
      await page.evaluate(() => {
        const rec = document.getElementById('recbtn');
        rec.classList.add('on');
        rec.textContent = 'Stop 0:01';
      });
      await page.waitForTimeout(50);
      const recLabel = await page.evaluate(() => ({
        text: (document.getElementById('call-rec').innerText || '').replace(/\s+/g, ' ').trim(),
        on: document.getElementById('call-rec').classList.contains('on'),
      }));
      if (recLabel.text !== 'Recording' || !recLabel.on) bad.push('recording state says "' + recLabel.text + '"');
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    else console.log('PASS', phone.name);
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS call state');
})().catch((e) => { console.error(e); process.exit(1); });
