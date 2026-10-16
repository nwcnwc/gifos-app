/*
 * A volunteer can find captions and the people list by those words.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/plain-words.js
 */
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(Object.assign({}, devices['iPhone SE'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=plain-words', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmcancel');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.waitForTimeout(100);
  const words = await page.evaluate(() => {
    const text = (id) => (document.getElementById(id).innerText || '').replace(/\s+/g, ' ').trim();
    const size = (id) => {
      const b = document.getElementById(id).getBoundingClientRect();
      return { w: b.width, h: b.height };
    };
    return { cc: text('ccbtn'), who: text('whobtn'), ccSize: size('ccbtn'), whoSize: size('whobtn') };
  });
  const bad = [];
  if (words.cc !== 'Captions') bad.push('captions control says "' + words.cc + '"');
  if (words.who !== 'People') bad.push('people control says "' + words.who + '"');
  if (words.ccSize.h < 44 || words.ccSize.w < 44) bad.push('captions tap ' + Math.round(words.ccSize.w) + 'x' + Math.round(words.ccSize.h));
  if (words.whoSize.h < 44 || words.whoSize.w < 44) bad.push('people tap ' + Math.round(words.whoSize.w) + 'x' + Math.round(words.whoSize.h));
  await browser.close();
  if (bad.length) {
    console.error('FAIL\n' + bad.join('\n'));
    process.exit(1);
  }
  console.log('PASS plain words', JSON.stringify(words));
})().catch((e) => { console.error(e); process.exit(1); });
