/*
 * A chat line shows when it was sent. Zoom, Meet, Teams, and FaceTime
 * put a clock time on the bubble. A manager on a phone can tell 10:41
 * from a line that arrived just now. The name and the words stay 1rem.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-time.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
/* 16 Oct 2026 14:41 UTC is 10:41 AM in New York. */
const AT = Date.UTC(2026, 9, 16, 14, 41, 0);

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['iPhone SE'], {
    hasTouch: true,
    locale: 'en-US',
    timezoneId: 'America/New_York',
  }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=chat-time', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.locator('#chat-in').fill('I will send the notes.');
  await page.locator('#chatform button[type=submit]').tap();
  await page.evaluate((at) => {
    window.__gifosChat.note({ by: 'Ruth', text: 'The deck is in the thread.', at: at });
  }, AT);
  await page.waitForTimeout(80);
  const info = await page.evaluate((at) => {
    const want = new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const probe = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const name = el.querySelector('b');
      const when = el.querySelector('.cwhen');
      const ws = when ? getComputedStyle(when) : null;
      return {
        text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
        font: parseFloat(cs.fontSize),
        nameFont: name ? parseFloat(getComputedStyle(name).fontSize) : 0,
        when: when ? (when.textContent || '').trim() : '',
        whenFont: ws ? parseFloat(ws.fontSize) : 0,
        whenColor: ws ? ws.color : '',
        whenBg: cs.backgroundColor,
        whenShown: !!(when && ws && ws.display !== 'none' && ws.visibility !== 'hidden' && parseFloat(ws.opacity) > 0),
      };
    };
    const mine = document.querySelector('#chatlog .cmsg.mine');
    const ruth = Array.from(document.querySelectorAll('#chatlog .cmsg:not(.mine)'))
      .find((el) => (el.innerText || '').indexOf('deck is in the thread') >= 0);
    return { want: want, mine: probe(mine), ruth: probe(ruth) };
  }, AT);
  const bad = [];
  function contrast(a, b) {
    const lum = (c) => {
      const m = String(c || '').match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      if (m[4] !== undefined && +m[4] === 0) return null;
      const lin = [m[1], m[2], m[3]].map((v) => {
        const s = +v / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    };
    const L1 = lum(a), L2 = lum(b);
    if (L1 === null || L2 === null) return null;
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }
  if (!info.ruth) bad.push('Ruth has no bubble');
  else {
    if (!info.ruth.whenShown) bad.push('no clock time on Ruth');
    else if (info.ruth.when !== info.want) bad.push('Ruth shows "' + info.ruth.when + '" want "' + info.want + '"');
    if (info.ruth.font < 16) bad.push('Ruth body ' + info.ruth.font + 'px');
    if (info.ruth.nameFont < 16) bad.push('Ruth name ' + info.ruth.nameFont + 'px');
    if (info.ruth.whenShown && info.ruth.whenFont < 12) bad.push('Ruth time ' + info.ruth.whenFont + 'px');
    if (info.ruth.text.indexOf('The deck is in the thread.') < 0) bad.push('Ruth text missing');
    const c = contrast(info.ruth.whenColor, info.ruth.whenBg);
    if (info.ruth.whenShown && c !== null && c < 4.5) bad.push('Ruth time contrast ' + c.toFixed(2));
  }
  if (!info.mine) bad.push('my line has no bubble');
  else {
    if (!info.mine.whenShown) bad.push('no clock time on my line');
    else if (!/\d{1,2}:\d{2}/.test(info.mine.when)) bad.push('my time "' + info.mine.when + '"');
    if (info.mine.font < 16) bad.push('my body ' + info.mine.font + 'px');
    if (info.mine.nameFont < 16) bad.push('my name ' + info.mine.nameFont + 'px');
    const c = contrast(info.mine.whenColor, info.mine.whenBg);
    if (info.mine.whenShown && c !== null && c < 4.5) bad.push('my time contrast ' + c.toFixed(2));
  }
  const shot = bad.length ? 'before-chat-time-iphone-se.png' : 'after-chat-time-iphone-se.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS chat time ' + info.want);
})().catch((e) => { console.error(e); process.exit(1); });
