/*
 * Mobile persona audit for GifOS Meet. Not the regression suite — it records
 * what a phone actually does, writes qa/mobile/audit.json, and saves shots.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node qa/mobile/audit.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const OUT = path.join(__dirname, 'shots');
const ROOM = 'qa-mobile-sunday';

const SMALL = {
  viewport: { width: 360, height: 740 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Small) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
};

function spec(name, device, landscape) {
  const d = Object.assign({}, device);
  if (landscape) {
    const v = d.viewport;
    d.viewport = { width: v.height, height: v.width };
  }
  d.name = name;
  return d;
}

const PHONES = [
  spec('iphone-se', devices['iPhone SE'], false),
  spec('iphone-se-land', devices['iPhone SE'], true),
  spec('iphone-15', devices['iPhone 15'], false),
  spec('iphone-15-land', devices['iPhone 15'], true),
  spec('pixel-7', devices['Pixel 7'], false),
  spec('pixel-7-land', devices['Pixel 7'], true),
  spec('android-360', SMALL, false),
  spec('android-360-land', SMALL, true),
];

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }

async function shot(page, name) {
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function measure(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    function info(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const visible = s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      return {
        id: el.id || el.className,
        text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40),
        w: Math.round(r.width), h: Math.round(r.height),
        l: Math.round(r.left), t: Math.round(r.top),
        right: Math.round(r.right), bottom: Math.round(r.bottom),
        visible,
        offscreen: visible && (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1),
        tiny: visible && (r.width < 44 || r.height < 44),
        clipped: visible && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2),
      };
    }
    const bar = document.querySelector('.bar');
    const more = document.getElementById('barmore');
    const chat = document.getElementById('chatpanel');
    const chip = document.querySelector('.topchip');
    const fit = document.getElementById('fitbtn');
    const ids = ['bargrip','cam','mic','reactbtn','bartoggle','leavebtn','fitbtn','chat-in','chatclose','cattach','ccbtn','recbtn','pwbtn','stagebtn','hand','setbtn','helpbtn','invite','whobtn','lob-open','lob-join-btn','lob-admin-btn','nm','nmok','nmcancel'];
    const controls = {};
    ids.forEach((id) => { controls[id] = info(document.getElementById(id)); });
    const moreButtons = more ? Array.from(more.querySelectorAll('button')).map(info) : [];
    let chipFitOverlap = false;
    if (chip && fit) {
      const a = chip.getBoundingClientRect(), b = fit.getBoundingClientRect();
      chipFitOverlap = !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
    }
    const br = bar ? bar.getBoundingClientRect() : null;
    const mr = more ? more.getBoundingClientRect() : null;
    return {
      vw, vh,
      bar: br && { w: Math.round(br.width), h: Math.round(br.height), l: Math.round(br.left), t: Math.round(br.top), right: Math.round(br.right), bottom: Math.round(br.bottom), scrollW: bar.scrollWidth, clientW: bar.clientWidth, overflow: getComputedStyle(bar).overflow },
      more: mr && { w: Math.round(mr.width), h: Math.round(mr.height), t: Math.round(mr.top), bottom: Math.round(mr.bottom), scrollH: more.scrollHeight, clientH: more.clientHeight, overflowY: getComputedStyle(more).overflowY, open: !document.querySelector('.bar').classList.contains('collapsed') },
      chatOpen: !!(chat && chat.classList.contains('open')),
      chipFitOverlap,
      controls,
      moreButtons,
      kb: getComputedStyle(document.documentElement).getPropertyValue('--kb').trim(),
      dockh: getComputedStyle(document.documentElement).getPropertyValue('--dockh').trim(),
      viewportMeta: (document.querySelector('meta[name=viewport]') || {}).content || '',
      uiScale: document.documentElement.style.fontSize,
    };
  });
}

async function seedPeople(page) {
  await page.evaluate(async () => {
    const api = window.__gifosVideo;
    if (!api || typeof api.presentPeers !== 'function') return 'no-peers';
    const people = [
      { id: 'peer-ruth', name: 'Ruth', color: '#3b4d78' },
      { id: 'peer-david', name: 'David', color: '#6b4532' },
      { id: 'peer-sam', name: 'Sam', color: '#2c5a46' },
    ];
    api.presentPeers(people);
    for (const person of people) {
      const tile = document.querySelector('.tile[data-peer="' + person.id + '"]');
      const video = tile && tile.querySelector('video');
      if (!video) continue;
      const c = document.createElement('canvas');
      c.width = 160; c.height = 240;
      const g = c.getContext('2d');
      g.fillStyle = person.color; g.fillRect(0, 0, 160, 240);
      try {
        video.srcObject = c.captureStream(8);
        video.muted = true;
        await video.play().catch(() => {});
        tile.classList.remove('cam-off');
      } catch (e) {}
    }
    return 'ok';
  });
}

async function bootCall(context, url) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('.bar, #lobby.show, .name-modal', { timeout: 15000 });
  await page.waitForTimeout(400);
  return { page, errors };
}

async function newPhone(browser, device) {
  const { name, ...opts } = device;
  const context = await browser.newContext(Object.assign({}, opts, {
    hasTouch: true,
    ignoreHTTPSErrors: true,
  }));
  await context.addInitScript(() => {
    try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {}
    try { localStorage.setItem('gifos_ui_scale', '1'); } catch (e) {}
  });
  return context;
}

(async () => {
  ensure(OUT);
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const report = { base: BASE, room: ROOM, phones: {}, personas: {}, safeArea: null };

  // --- persona: grandparent, cold text link, no saved name ---
  {
    const device = spec('gp', devices['iPhone SE'], false);
    const { name, ...opts } = device;
    const context = await browser.newContext(Object.assign({}, opts, { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.removeItem('gifos_name'); } catch (e) {} });
    const { page, errors } = await bootCall(context, BASE + '/run.html#v=' + ROOM);
    report.personas.grandparent = { errors, name: await measure(page) };
    await shot(page, 'before-grandparent-name');
    const input = page.locator('#nm');
    if (await input.count()) {
      await input.tap();
      await input.fill('Grandma Ruth');
      await shot(page, 'before-grandparent-typed');
      await page.evaluate(() => document.documentElement.style.setProperty('--kb', '280px'));
      report.personas.grandparent.kb = await measure(page);
      await shot(page, 'before-grandparent-keyboard');
      await page.locator('#nmok').tap();
      await page.waitForTimeout(300);
    }
    await seedPeople(page);
    await shot(page, 'before-grandparent-call');
    await page.locator('#bartoggle').tap();
    await page.waitForTimeout(200);
    report.personas.grandparent.more = await measure(page);
    await shot(page, 'before-grandparent-more');
    await context.close();
  }

  // --- exec: pixel portrait then landscape, mute/camera/chat ---
  {
    const context = await newPhone(browser, spec('ex', devices['Pixel 7'], false));
    const { page } = await bootCall(context, BASE + '/run.html#v=' + ROOM + '-exec');
    const skip = page.locator('#nmcancel');
    if (await skip.count()) await skip.tap();
    await seedPeople(page);
    await page.locator('#mic').tap();
    await page.locator('#cam').tap();
    report.personas.execPortrait = await measure(page);
    await shot(page, 'before-exec-portrait');
    await page.setViewportSize({ width: 839, height: 412 });
    await page.waitForTimeout(250);
    await seedPeople(page);
    report.personas.execLand = await measure(page);
    await shot(page, 'before-exec-land');
    await page.locator('#bartoggle').tap();
    await page.waitForTimeout(200);
    report.personas.execMore = await measure(page);
    await shot(page, 'before-exec-more');
    await context.close();
  }

  // --- teen: rapid taps on iPhone 15 ---
  {
    const context = await newPhone(browser, spec('tn', devices['iPhone 15'], false));
    const { page } = await bootCall(context, BASE + '/run.html#v=' + ROOM + '-teen');
    const skip = page.locator('#nmcancel');
    if (await skip.count()) await skip.tap();
    await seedPeople(page);
    const ids = ['#mic', '#cam', '#reactbtn', '#bartoggle', '#mic', '#cam', '#reactbtn', '#bartoggle'];
    for (const id of ids) {
      await page.locator(id).tap({ timeout: 2000 }).catch((e) => report.personas.teenTapError = String(e).slice(0, 180));
    }
    await page.waitForTimeout(200);
    report.personas.teen = await measure(page);
    await shot(page, 'before-teen-rapid');
    await context.close();
  }

  // --- low vision 200% on 360 ---
  {
    const context = await newPhone(browser, spec('lv', SMALL, false));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_ui_scale', '2'); } catch (e) {} });
    const { page } = await bootCall(context, BASE + '/run.html#v=' + ROOM + '-lv');
    const skip = page.locator('#nmcancel');
    if (await skip.count()) await skip.tap();
    await seedPeople(page);
    report.personas.lowVision = await measure(page);
    await shot(page, 'before-lowvision-dock');
    await page.locator('#bartoggle').tap();
    await page.waitForTimeout(200);
    report.personas.lowVisionMore = await measure(page);
    await shot(page, 'before-lowvision-more');
    await context.close();
  }

  // --- host on iPhone SE landscape: password, stage, record, CC ---
  {
    const context = await newPhone(browser, spec('ho', devices['iPhone SE'], true));
    const { page } = await bootCall(context, BASE + '/run.html#v=' + ROOM + '-host');
    const skip = page.locator('#nmcancel');
    if (await skip.count()) await skip.tap();
    await seedPeople(page);
    await page.locator('#bartoggle').tap();
    await page.waitForTimeout(200);
    report.personas.hostMore = await measure(page);
    await shot(page, 'before-host-more-land');
    const cc = await page.locator('#ccbtn').boundingBox();
    report.personas.hostCcBox = cc;
    await page.locator('#pwbtn').tap({ force: true }).catch(() => {});
    await page.waitForTimeout(200);
    await shot(page, 'before-host-password');
    await page.locator('#pw-cancel').tap().catch(() => {});
    await context.close();
  }

  // --- chat composer vs dock, iPhone SE portrait ---
  {
    const context = await newPhone(browser, spec('ch', devices['iPhone SE'], false));
    const { page } = await bootCall(context, BASE + '/run.html#v=' + ROOM + '-chat');
    const skip = page.locator('#nmcancel');
    if (await skip.count()) await skip.tap();
    await seedPeople(page);
    await page.locator('#bartoggle').tap();
    await page.locator('#chatbtn').tap();
    await page.waitForTimeout(200);
    report.personas.chat = await measure(page);
    await shot(page, 'before-chat-dock');
    const tapChat = await page.locator('#chat-in').tap({ timeout: 4000 }).then(() => 'tapped', (e) => String(e).split('\n')[0].slice(0, 220));
    report.personas.chatTap = tapChat;
    await page.evaluate(() => {
      const vv = window.visualViewport;
      document.documentElement.dataset.vvh = vv ? String(Math.round(vv.height)) : 'none';
    });
    await page.evaluate(() => document.documentElement.style.setProperty('--kb', '260px'));
    report.personas.chatKb = await measure(page);
    await shot(page, 'before-chat-keyboard');
    await context.close();
  }

  // geometry sweep
  for (const device of PHONES) {
    const context = await newPhone(browser, device);
    const { page, errors } = await bootCall(context, BASE + '/run.html#v=' + ROOM + '-geo');
    const skip = page.locator('#nmcancel');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.waitForTimeout(200);
    const dock = await measure(page);
    await page.locator('#bartoggle').tap().catch(() => {});
    await page.waitForTimeout(150);
    const more = await measure(page);
    report.phones[device.name] = { errors, dock, more };
    if (device.name === 'android-360' || device.name === 'iphone-se' || device.name === 'iphone-se-land' || device.name === 'iphone-15') {
      await shot(page, 'before-geo-' + device.name);
    }
    await context.close();
  }

  // safe-area CDP probe on iPhone 15
  {
    const context = await newPhone(browser, spec('sa', devices['iPhone 15'], false));
    const page = await context.newPage();
    let cdp = 'unavailable';
    try {
      const client = await context.newCDPSession(page);
      await client.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, left: 0, bottom: 34, right: 0 } });
      cdp = 'set';
    } catch (e) { cdp = String(e.message || e).slice(0, 240); }
    await page.goto(BASE + '/run.html#v=' + ROOM + '-safe', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.bar', { timeout: 15000 });
    const skip = page.locator('#nmcancel');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.waitForTimeout(300);
    const env = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden';
      document.body.appendChild(probe);
      const s = getComputedStyle(probe);
      const top = s.paddingTop, bottom = s.paddingBottom;
      probe.remove();
      const bar = document.querySelector('.bar').getBoundingClientRect();
      const chip = document.querySelector('.topchip').getBoundingClientRect();
      return { top, bottom, barBottom: Math.round(bar.bottom), vh: window.innerHeight, chipTop: Math.round(chip.top), meta: document.querySelector('meta[name=viewport]').content };
    });
    report.safeArea = { cdp, env };
    await shot(page, 'before-safe-area');
    await context.close();
  }

  fs.writeFileSync(path.join(__dirname, 'audit.json'), JSON.stringify(report, null, 2));
  console.log('wrote', path.join(__dirname, 'audit.json'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
