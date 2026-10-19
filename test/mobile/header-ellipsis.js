/*
 * A header message too long for a phone chip ends in "…", so a person can
 * see there is more (and tap for it). The phone chip made #status a flex
 * box, and text-overflow does nothing on a flex box: the line was cut
 * mid-word with no sign.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/header-ellipsis.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  for (const [name, device] of [['iphone-se', devices['iPhone SE']], ['pixel-7', devices['Pixel 7']]]) {
    const context = await browser.newContext(Object.assign({}, device, { hasTouch: true }));
    await context.addInitScript(() => {
      try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {}
    });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=header-ellipsis', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    // With no room password, No blur says "Faces stay blurred until this
    // room has a password…", longer than any phone chip.
    await page.locator('#bartoggle').tap();
    await page.locator('#blur-none').scrollIntoViewIfNeeded();
    await page.locator('#blur-none').tap();
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => {
      const btn = document.getElementById('status');
      // The box that draws "…" is the one that holds the text itself.
      const walk = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
      let node = walk.nextNode();
      while (node && !node.nodeValue.trim()) node = walk.nextNode();
      const el = node ? node.parentElement : btn;
      const cs = getComputedStyle(el);
      return {
        text: btn.textContent.trim(),
        over: el.scrollWidth > el.clientWidth + 1,
        display: cs.display,
        overflow: cs.overflowX,
        ws: cs.whiteSpace,
        to: cs.textOverflow,
        h: btn.getBoundingClientRect().height,
      };
    });
    const bad = [];
    if (info.text.indexOf('blur') < 0) bad.push('header reads "' + info.text + '", not the blur message');
    if (!info.over) bad.push('message fits, nothing to test');
    // CSS draws "…" only when the box itself holds the line: a block or
    // inline-block, overflow hidden, nowrap, text-overflow ellipsis.
    const blockish = /^(block|inline-block|flow-root)$/.test(info.display);
    if (!blockish || info.overflow !== 'hidden' || info.ws !== 'nowrap' || info.to !== 'ellipsis') {
      bad.push('a cut message has no "…" (display ' + info.display + ', overflow ' + info.overflow + ', ' + info.ws + ', ' + info.to + ')');
    }
    if (info.h < 44) bad.push('status tap is ' + Math.round(info.h) + 'px');
    const chip = page.locator('.topchip');
    await chip.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-header-ellipsis-' + name + '.png') });
    if (bad.length) failures.push(name + ': ' + bad.join('; '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS header ellipsis');
})().catch((e) => { console.error(e); process.exit(1); });
