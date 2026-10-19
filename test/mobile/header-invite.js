/*
 * Alone on a phone, Invite lives in the OS header (#appinvite): the link is
 * copied, or the phone share sheet opens. With other people here, the button
 * is gone and the count stays.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/header-invite.js
 */
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8960';

const PEOPLE = [
  { id: 'peer-ruth', name: 'Ruth' },
  { id: 'peer-david', name: 'David' },
  { id: 'peer-sam', name: 'Sam' },
];

function overlaps(a, b) {
  if (!b || b.h < 2 || b.w < 2) return false;
  return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
}

async function boot(browser, device, opts) {
  const context = await browser.newContext(Object.assign({}, device, { hasTouch: true }));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.addInitScript((scale) => {
    try {
      localStorage.setItem('gifos_name', 'Grandma Ruth');
      if (scale) localStorage.setItem('gifos_ui_scale', scale);
    } catch (e) {}
  }, opts.scale || null);
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=' + opts.room, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#appinvite', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.waitForFunction(() => {
    const btn = document.getElementById('appinvite');
    const url = document.getElementById('share-url');
    return btn && btn.style.display !== 'none' && getComputedStyle(btn).display !== 'none' && url && url.value.indexOf('#v=') >= 0;
  }, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(200);
  return { context, page };
}

async function measure(page) {
  return page.evaluate(() => {
    const btn = document.getElementById('appinvite');
    const status = document.getElementById('status');
    const bar = document.getElementById('appbar');
    const fit = document.getElementById('fitbtn').getBoundingClientRect();
    const unmuteEl = document.getElementById('unmute');
    const showcamEl = document.getElementById('showcam');
    const unmute = unmuteEl ? unmuteEl.getBoundingClientRect() : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const showcam = showcamEl ? showcamEl.getBoundingClientRect() : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const b = btn.getBoundingClientRect();
    const header = bar.getBoundingClientRect();
    const st = status.getBoundingClientRect();
    const font = parseFloat(getComputedStyle(btn).fontSize);
    const hidden = btn.style.display === 'none' || getComputedStyle(btn).display === 'none' || !btn.getClientRects().length;
    const box = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height });
    return {
      label: btn.textContent,
      hidden: hidden,
      title: btn.title,
      status: status.textContent,
      statusTitle: status.title || '',
      kind: status.dataset.kind || '',
      font: font,
      clipped: btn.scrollWidth > btn.clientWidth + 2,
      inHeader: b.left >= header.left - 1 && b.right <= header.right + 1 && b.top >= header.top - 1 && b.bottom <= header.bottom + 1,
      btn: box(b),
      header: box(header),
      statusBox: box(st),
      fit: box(fit),
      unmute: box(unmute),
      showcam: box(showcam),
      vw: window.innerWidth,
      vh: window.innerHeight,
      url: (document.getElementById('share-url') || {}).value || '',
    };
  });
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--disable-gpu'],
  });
  const failures = [];
  const phones = [
    { name: 'iphone-se', device: devices['iPhone SE'], room: 'sunday', scale: null },
    { name: 'iphone-se-land', device: Object.assign({}, devices['iPhone SE'], { viewport: { width: 667, height: 375 } }), room: 'sunday', scale: null },
    { name: 'iphone-se-200', device: devices['iPhone SE'], room: 'sunday', scale: '2' },
  ];
  for (const phone of phones) {
    const { context, page } = await boot(browser, phone.device, phone);
    const info = await measure(page);
    const bad = [];
    if (info.hidden) bad.push('Invite is hidden while alone');
    if (info.label !== 'Invite') bad.push('label "' + info.label + '"');
    if (info.status.indexOf('send the invite') >= 0 || info.statusTitle.indexOf('send the invite') >= 0) {
      bad.push('header still tells you to send the invite');
    }
    if (info.status.indexOf('sunday') < 0) bad.push('header dropped the room name "' + info.status + '"');
    if (info.kind !== 'alone') bad.push('kind ' + info.kind);
    if (info.btn.w < 44 || info.btn.h < 44) bad.push('Invite is ' + Math.round(info.btn.w) + 'x' + Math.round(info.btn.h));
    if (info.btn.left < -1 || info.btn.top < -1 || info.btn.right > info.vw + 1 || info.btn.bottom > info.vh + 1) {
      bad.push('Invite is off screen');
    }
    if (!info.inHeader) bad.push('Invite sits outside the OS header');
    if (info.clipped) bad.push('Invite label is cut off');
    if (overlaps(info.btn, info.fit)) bad.push('Invite covers Fit');
    if (overlaps(info.btn, info.unmute)) bad.push('Invite covers Unmute');
    if (overlaps(info.btn, info.showcam)) bad.push('Invite covers Camera');
    if (phone.scale === '2' && info.font < 30) bad.push('Invite font ' + info.font + 'px at 200%');
    if (phone.name === 'iphone-se') {
      await page.evaluate(() => {
        window.__shared = null;
        navigator.share = (payload) => { window.__shared = payload; return Promise.resolve(); };
      });
      await page.locator('#appinvite').tap();
      await page.waitForTimeout(80);
      const shared = await page.evaluate(() => window.__shared);
      if (!shared || String(shared.url || '').indexOf('#v=sunday') < 0) bad.push('share sheet did not get the link');
      await page.evaluate(() => { navigator.share = undefined; });
      await page.waitForTimeout(2100);
      await page.locator('#appinvite').tap();
      await page.waitForTimeout(120);
      const copied = await page.evaluate(async () => {
        let clip = '';
        try { clip = await navigator.clipboard.readText(); } catch (e) { clip = 'ERR ' + e; }
        return { clip: clip, label: document.getElementById('appinvite').textContent };
      });
      if (String(copied.clip).indexOf('#v=sunday') < 0) bad.push('copy missed the link (' + copied.clip + ')');
      if (copied.label !== 'Copied ✓') bad.push('copy label "' + copied.label + '"');
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    await context.close();
  }

  const { context, page } = await boot(browser, devices['iPhone SE'], { room: 'sunday', scale: null });
  await page.evaluate(async (people) => {
    const api = window.__gifosVideo;
    if (!api || typeof api.presentPeers !== 'function') return;
    api.presentPeers(people);
  }, PEOPLE);
  await page.waitForTimeout(200);
  const crowded = await measure(page);
  const bad = [];
  if (!crowded.hidden) bad.push('Invite stays up with other people');
  if (crowded.status !== 'sunday · 4 in call') bad.push('header "' + crowded.status + '"');
  if (bad.length) failures.push('with-people: ' + bad.join('; '));
  await context.close();
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS header invite');
})().catch((e) => { console.error(e); process.exit(1); });
