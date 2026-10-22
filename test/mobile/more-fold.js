/*
 * More must fold after a pick (including No blur) and a reload must not
 * bring it back open. Trusted clicks — the sheet ignores untrusted ones.
 *
 *   MEET_BASE=http://127.0.0.1:9017 NODE_PATH=.../node_modules node test/mobile/more-fold.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:9017';
const N = Math.max(1, parseInt(process.env.N || '5', 10));
const OUT = process.env.MORE_FOLD_OUT || path.join(__dirname, '..', '..', 'evidence', 'more-fold-1018');

function stateJs() {
  const bar = document.querySelector('.bar');
  const more = document.getElementById('barmore');
  const toggle = document.getElementById('bartoggle');
  const none = document.getElementById('blur-none');
  const cs = more ? getComputedStyle(more) : null;
  let dump = null;
  try { dump = window.__gifosVideo && window.__gifosVideo.debugDump ? 'function' : null; } catch (e) {}
  return {
    collapsed: !!(bar && bar.classList.contains('collapsed')),
    expanded: toggle ? toggle.getAttribute('aria-expanded') : null,
    word: toggle ? (toggle.querySelector('.docklab') || {}).textContent : null,
    display: cs ? cs.display : null,
    open: !!(cs && cs.display !== 'none' && more.getClientRects().length),
    stored: localStorage.getItem('gifos_meet_bar'),
    nonePressed: none ? none.getAttribute('aria-pressed') : null,
    debug: dump,
  };
}

async function dismiss(page) {
  const skip = page.locator('#nmok, #nmcancel');
  if (await skip.count()) await skip.first().click({ timeout: 1500 }).catch(() => {});
}

async function boot(page, hash) {
  await page.goto(BASE + '/run.html' + hash, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  await dismiss(page);
  await page.waitForFunction(() => document.getElementById('blur-none'), null, { timeout: 10000 });
}

async function openMore(page) {
  const open = await page.locator('#bartoggle').getAttribute('aria-expanded');
  if (open !== 'true') await page.locator('#bartoggle').click();
  await page.waitForSelector('#barmore', { state: 'visible' });
}

async function runOnce(browser, profile, i, shot) {
  const context = await browser.newContext(Object.assign({}, profile.device, { locale: 'en-US' }));
  await context.addInitScript(() => {
    try {
      localStorage.setItem('gifos_name', 'Pat');
      sessionStorage.setItem('gifos_appeared', '1');
      sessionStorage.setItem('gifos_appear_ok', '1');
      sessionStorage.setItem('gifos_debug', '1');
    } catch (e) {}
  });
  const page = await context.newPage();
  const fails = [];
  const log = { profile: profile.name, i, steps: {} };
  try {
    await boot(page, '#v=' + RUN_ROOM + 'morefold-' + profile.name + '-' + i + '&DEBUG=on');
    await openMore(page);
    log.steps.opened = await page.evaluate(stateJs);
    if (!log.steps.opened.open) fails.push('More did not open');
    await page.locator('#blur-none').click();
    log.steps.afterNone = await page.evaluate(stateJs);
    if (log.steps.afterNone.open || log.steps.afterNone.expanded !== 'false' || !log.steps.afterNone.collapsed) {
      fails.push('No blur left More open');
    }
    if (log.steps.afterNone.stored !== '1') fails.push('No blur left More saved open (' + log.steps.afterNone.stored + ')');
    if (log.steps.afterNone.nonePressed !== 'true') fails.push('No blur was not selected');
    if (shot) await page.screenshot({ path: path.join(OUT, shot + '-after-none.png') });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    await dismiss(page);
    log.steps.reloaded = await page.evaluate(stateJs);
    if (log.steps.reloaded.open || log.steps.reloaded.expanded !== 'false' || !log.steps.reloaded.collapsed) {
      fails.push('reload restored More open');
    }
    if (log.steps.reloaded.stored === '0') fails.push('reload still has More saved open');
    if (shot) await page.screenshot({ path: path.join(OUT, shot + '-reload.png') });

    await openMore(page);
    await page.locator('#blur-min').click();
    log.steps.afterMin = await page.evaluate(stateJs);
    if (log.steps.afterMin.open) fails.push('Min left More open');

    await openMore(page);
    await page.locator('#blur-max').click();
    log.steps.afterMax = await page.evaluate(stateJs);
    if (log.steps.afterMax.open) fails.push('Max left More open');

    await openMore(page);
    await page.locator('#keysbtn').click();
    log.steps.afterKeys = await page.evaluate(stateJs);
    if (log.steps.afterKeys.open || log.steps.afterKeys.stored !== '1') fails.push('Keys left More open or saved open');
  } catch (e) {
    fails.push('threw ' + (e && e.message ? e.message : e));
  }
  await context.close();

  const context2 = await browser.newContext(Object.assign({}, profile.device, { locale: 'en-US' }));
  await context2.addInitScript(() => {
    try {
      localStorage.setItem('gifos_name', 'Pat');
      localStorage.setItem('gifos_meet_bar', '0');
      sessionStorage.setItem('gifos_appeared', '1');
      sessionStorage.setItem('gifos_appear_ok', '1');
      sessionStorage.setItem('gifos_debug', '1');
    } catch (e) {}
  });
  const page2 = await context2.newPage();
  try {
    await boot(page2, '#v=' + RUN_ROOM + 'morefold-restore-' + profile.name + '-' + i + '&DEBUG=on');
    log.steps.seededOpen = await page2.evaluate(stateJs);
    if (log.steps.seededOpen.open || log.steps.seededOpen.expanded !== 'false' || !log.steps.seededOpen.collapsed) {
      fails.push('stored open restored More on load');
    }
    if (log.steps.seededOpen.stored === '0') fails.push('stored open survived the load');
    if (shot) await page2.screenshot({ path: path.join(OUT, shot + '-seeded.png') });
  } catch (e) {
    fails.push('seed threw ' + (e && e.message ? e.message : e));
  }
  await context2.close();
  log.fails = fails;
  return log;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const phone = devices['Pixel 5'] || { viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent };
  const profiles = [
    { name: 'pixel5', device: Object.assign({}, phone, { hasTouch: true }) },
    { name: 'desktop', device: { viewport: { width: 1280, height: 720 } } },
  ];
  const all = [];
  let bad = 0;
  for (const profile of profiles) {
    for (let i = 1; i <= N; i++) {
      const shot = (process.env.MORE_FOLD_SHOTS === '1' && i === 1) ? profile.name : '';
      const log = await runOnce(browser, profile, i, shot);
      all.push(log);
      const mark = log.fails.length ? 'FAIL' : 'PASS';
      if (log.fails.length) bad++;
      console.log(mark + ' ' + profile.name + ' ' + i + '/' + N + (log.fails.length ? ' ' + log.fails.join('; ') : ''));
    }
  }
  await browser.close();
  const file = path.join(OUT, (process.env.MORE_FOLD_TAG || 'run') + '.json');
  fs.writeFileSync(file, JSON.stringify({ bad, total: all.length, runs: all }, null, 2));
  console.log((bad ? 'RED' : 'GREEN') + ' ' + (all.length - bad) + '/' + all.length + ' -> ' + file);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
