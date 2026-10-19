/*
 * People is a list of names. Zoom, Meet, Teams, and FaceTime do not open
 * that list on internet addresses. A muted person says Muted. The names
 * are at least 16px. The address file stays on Download.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/people-list.js
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
  const context = await browser.newContext(Object.assign({}, devices['iPhone SE'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=people-list', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.evaluate(() => {
    const api = window.__gifosVideo;
    api.presentPeers([{ id: 'peer-ruth', name: 'Ruth' }, { id: 'peer-david', name: 'David' }]);
    api._ghostStatus('peer-ruth', 0, { camOff: true });
    api._ghostStatus('peer-david', 0, { camOff: false });
  });
  await page.locator('#bartoggle').tap();
  await page.locator('#whobtn').scrollIntoViewIfNeeded();
  await page.locator('#whobtn').tap();
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => {
    const modal = document.getElementById('who-modal');
    const title = modal.querySelector('h3');
    const lead = (modal.innerText || '').replace(/\s+/g, ' ').trim();
    const names = Array.from(document.querySelectorAll('#who-list .who-name, #who-list .brow')).map((el) => ({
      text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
      font: parseFloat(getComputedStyle(el).fontSize),
    }));
    const close = document.getElementById('who-close').getBoundingClientRect();
    const dl = document.getElementById('who-dl');
    return {
      open: getComputedStyle(modal).display !== 'none',
      title: title ? title.textContent.trim() : '',
      lead: lead.slice(0, 400),
      names: names,
      closeH: close.height,
      download: (dl.innerText || '').indexOf('Download') >= 0,
    };
  });
  const bad = [];
  const blob = info.lead;
  if (!info.open) bad.push('People did not open');
  if (info.title !== 'People') bad.push('title "' + info.title + '"');
  if (/internet address|law enforcement|verified by the relay|forging/i.test(blob)) bad.push('the list leads with addresses');
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(blob)) bad.push('an address is on the list');
  const ruth = info.names.find((n) => n.text.indexOf('Ruth') >= 0);
  const david = info.names.find((n) => n.text.indexOf('David') >= 0);
  if (!ruth) bad.push('Ruth is missing');
  else {
    if (ruth.font < 16) bad.push('Ruth is ' + ruth.font + 'px');
    if (ruth.text.indexOf('Muted') < 0) bad.push('Ruth does not say Muted ("' + ruth.text + '")');
  }
  if (!david) bad.push('David is missing');
  if (info.closeH < 44) bad.push('Close is ' + Math.round(info.closeH) + 'px');
  if (!info.download) bad.push('Download is missing');
  const shot = bad.length ? 'before-people-list-iphone-se.png' : 'after-people-list-iphone-se.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS people list');
})().catch((e) => { console.error(e); process.exit(1); });
