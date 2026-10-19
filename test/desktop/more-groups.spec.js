const { test, expect } = require('@playwright/test');

async function boot(page, width = 1280, height = 720) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qamore2&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4 }));
}

// The groups, in the order a meeting is used, and where each control lives.
function readGroups(page) {
  return page.evaluate(() => {
    const shown = (el) => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
    };
    const heads = [...document.querySelectorAll('#barmore .moregroup h4')]
      .filter((h) => shown(h.closest('.moregroup')))
      .map((h) => h.textContent.trim());
    const groupOf = (id) => {
      const g = document.getElementById(id) && document.getElementById(id).closest('.moregroup');
      return g ? g.querySelector('h4').textContent.trim() : '(not in More)';
    };
    const ids = ['whobtn', 'chatbtn', 'hand', 'ccbtn', 'trbtn', 'blurseg', 'sharebtn',
      'pwbtn', 'recbtn', 'votebtn', 'stagebtn', 'appbtn', 'setbtn', 'keysbtn'];
    const groups = {};
    for (const id of ids) groups[id] = groupOf(id);
    const order = (head) => {
      const g = [...document.querySelectorAll('#barmore .moregroup')].find((s) => s.querySelector('h4').textContent.trim() === head);
      return g ? [...g.querySelectorAll('.morerow > button')].filter(shown).map((b) => b.id) : [];
    };
    return {
      heads, groups,
      talk: order('Talk'),
      hidden: ids.filter((id) => groups[id] !== '(not in More)' && !shown(document.getElementById(id))),
      tools: !!document.getElementById('moretools'),
    };
  });
}

test('More shows every group, in meeting order, on one sheet', async ({ page }) => {
  await boot(page);
  await page.click('#bartoggle');
  const got = await readGroups(page);
  expect(got.heads).toEqual(['People', 'Talk', 'Your video', 'Room', 'Settings and help']);
  expect(got.groups).toEqual({
    whobtn: 'People',
    chatbtn: '(not in More)', hand: 'Talk', ccbtn: 'Talk', trbtn: 'Talk',
    blurseg: 'Your video', sharebtn: '(not in More)',
    pwbtn: 'Room', recbtn: 'Room', votebtn: 'Room', stagebtn: 'Room', appbtn: 'Room',
    setbtn: 'Settings and help', keysbtn: 'Settings and help',
  });
  expect(got.talk).toEqual(['hand', 'ccbtn', 'trbtn']);
  expect(got.hidden).toEqual([]);
  expect(got.tools).toBe(false);
});

// One design: a phone has the same groups in the same order. Chat and
// Share screen leave the phone's dock for their groups.
test('a phone gets the same groups, with the dock buttons in theirs', async ({ page }) => {
  await boot(page, 390, 844);
  await page.click('#bartoggle');
  const got = await readGroups(page);
  expect(got.heads).toEqual(['People', 'Talk', 'Your video', 'Room', 'Settings and help']);
  expect(got.groups).toMatchObject({ chatbtn: 'Talk', sharebtn: 'Your video', pwbtn: 'Room' });
  expect(got.talk).toEqual(['chatbtn', 'hand', 'ccbtn', 'trbtn']);
  const fit = await page.evaluate(() => {
    const m = document.getElementById('barmore').getBoundingClientRect();
    const dock = document.getElementById('leavebtn').getBoundingClientRect();
    return { left: m.left, right: m.right, bottom: m.bottom, dockTop: dock.top, vw: innerWidth, ovx: document.getElementById('barmore').scrollWidth - document.getElementById('barmore').clientWidth };
  });
  expect(fit.left).toBeGreaterThanOrEqual(-1);
  expect(fit.right).toBeLessThanOrEqual(fit.vw + 1);
  expect(fit.bottom).toBeLessThanOrEqual(fit.dockTop + 1);
  expect(fit.ovx).toBe(0);
});

// The whole sheet fits a 1280x720 laptop: no scrolling to find Keys or
// Transcript, for a guest and for a host (who has a Host row too). Each
// button stays a big target with 16px words, and a German word is whole.
async function toolsFit(page, shot) {
  if (!(await page.locator('#barmore').isVisible())) await page.click('#bartoggle');
  await page.waitForTimeout(300);
  if (shot) await page.screenshot({ path: 'test/desktop/shots/' + shot });
  return page.evaluate(() => {
    const m = document.getElementById('barmore');
    const mr = m.getBoundingClientRect();
    const dock = document.getElementById('leavebtn').getBoundingClientRect();
    const btns = [...m.querySelectorAll('button')].filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden');
    const cut = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.top < mr.top - 1 || r.bottom > mr.bottom + 1 || r.bottom > dock.top; }).map((b) => b.id);
    const small = btns.filter((b) => !b.classList.contains('seg') && (b.getBoundingClientRect().height < 48 || parseFloat(getComputedStyle(b).fontSize) < 16)).map((b) => b.id);
    const spill = btns.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.id + ':' + b.textContent.trim());
    return { scrolls: m.scrollHeight - m.clientHeight, cut, small, spill, n: btns.length, ids: btns.map((b) => b.id).filter(Boolean) };
  });
}

test('the More sheet fits a 1280x720 screen for a guest', async ({ page }) => {
  await boot(page);
  const got = await toolsFit(page, 'all-tools-guest-1280.png');
  expect(got.n).toBeGreaterThan(14);
  expect(got).toMatchObject({ scrolls: 0, cut: [], small: [], spill: [] });
});

test.describe('German', () => {
  test.use({ locale: 'de-DE' });
  test('the More sheet fits a 1280x720 screen in German', async ({ page }) => {
    await boot(page);
    const got = await toolsFit(page, 'all-tools-de-1280.png');
    expect(got).toMatchObject({ scrolls: 0, cut: [], small: [], spill: [] });
  });
});

test('the More sheet fits a 1280x720 screen for a host', async ({ page }) => {
  test.setTimeout(90000);
  const room = 'qatoolsfit' + Date.now().toString(36);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Jordan Lee'); sessionStorage.setItem('gifos_appeared', '1'); });
  await page.goto('/run.html', { waitUntil: 'domcontentloaded' });
  await page.click('#lob-admin-btn');
  await page.fill('#lob-admin-name', room);
  await page.fill('#lob-admin-pass', 'qa-admin-' + room);
  await page.click('#lob-admin-go');
  await page.waitForFunction(() => /av=/.test(location.hash), null, { timeout: 30000 });
  await page.waitForSelector('#leavebtn', { state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('blurall').style.display !== 'none' && document.getElementById('admbtn').style.display !== 'none', null, { timeout: 30000 });
  const got = await toolsFit(page, 'all-tools-host-1280.png');
  // Every host tool, by name. Vote stays off: an admin room bans, it does
  // not vote. The retired self-view segments are not buttons. Float is an
  // extra where the browser can picture-in-picture (the page hides it on
  // Firefox); a count of 19 was that button missing, or Allow screen share.
  const tools = ['whobtn', 'hand', 'ccbtn', 'trbtn', 'blur-max', 'blur-min', 'blur-none',
    'pwbtn', 'waitbtn', 'recbtn', 'stagebtn', 'appbtn',
    'muteall', 'blurall', 'camall', 'shareall', 'admbtn', 'setbtn', 'keysbtn'];
  expect(got.ids).toEqual(expect.arrayContaining(tools));
  expect(got.ids).not.toEqual(expect.arrayContaining(['votebtn']));
  expect(got.ids.length, 'retired self-view segments are not buttons').toBe(got.n);
  const canPip = await page.evaluate(() => {
    const testV = document.createElement('video');
    return !!(document.pictureInPictureEnabled || typeof testV.webkitSetPresentationMode === 'function');
  });
  if (canPip) {
    expect(got.ids).toContain('pipbtn');
    expect(got.n).toBeGreaterThan(19);
  } else {
    expect(got.ids).not.toContain('pipbtn');
    expect(got.n).toBe(tools.length);
  }
  expect(got).toMatchObject({ scrolls: 0, cut: [], small: [], spill: [] });
});
