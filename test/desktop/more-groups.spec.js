const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qamore2&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mic', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4 }));
}

test('More opens to Hand, Invite, and Help', async ({ page }) => {
  await boot(page);
  await page.click('#bartoggle');
  const closed = await page.evaluate(() => {
    const shown = (id) => {
      const el = document.getElementById(id);
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
    };
    const heads = [...document.querySelectorAll('#barmore .moregroup h4')]
      .filter((h) => getComputedStyle(h.closest('.moregroup')).display !== 'none')
      .map((h) => h.textContent.trim());
    return {
      heads,
      hand: shown('hand'),
      invite: shown('invite'),
      help: shown('helpbtn'),
      tools: (document.querySelector('#moretools') || {}).textContent || '',
      buried: ['whobtn', 'appbtn', 'votebtn', 'pwbtn', 'stagebtn', 'recbtn', 'ccbtn', 'setbtn', 'keysbtn', 'trbtn'].filter(shown),
    };
  });
  expect(closed.hand).toBe(true);
  expect(closed.invite).toBe(true);
  expect(closed.help).toBe(true);
  expect(closed.tools.trim()).toBe('All tools');
  expect(closed.heads).toEqual([]);
  expect(closed.buried).toEqual([]);
  await page.click('#moretools');
  const open = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('#barmore .moregroup h4')]
      .filter((h) => getComputedStyle(h.closest('.moregroup')).display !== 'none')
      .map((h) => h.textContent.trim());
    const vote = document.getElementById('votebtn');
    const g = vote && vote.closest('.moregroup');
    return { heads, vote: g && g.querySelector('h4') ? g.querySelector('h4').textContent.trim() : '', word: document.getElementById('moretools').textContent.trim() };
  });
  expect(open.heads).toEqual(['People', 'Share', 'Room', 'Help']);
  expect(open.vote).toBe('Room');
  expect(open.word).toBe('Fewer tools');
});

// All tools, open, is the whole list on a 1280x720 laptop: no scrolling to find
// Keys or Transcript, for a guest and for a host (who has a Host row too). Each
// button stays a big target with 16px words, and a German word is whole.
async function toolsFit(page, shot) {
  if (!(await page.locator('#barmore').isVisible())) await page.click('#bartoggle');
  if ((await page.locator('#moretools').getAttribute('aria-expanded')) !== 'true') await page.click('#moretools');
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
    return { scrolls: m.scrollHeight - m.clientHeight, cut, small, spill, n: btns.length };
  });
}

test('All tools fits a 1280x720 screen for a guest', async ({ page }) => {
  await boot(page);
  const got = await toolsFit(page, 'all-tools-guest-1280.png');
  expect(got.n).toBeGreaterThan(14);
  expect(got).toMatchObject({ scrolls: 0, cut: [], small: [], spill: [] });
});

test.describe('German', () => {
  test.use({ locale: 'de-DE' });
  test('All tools fits a 1280x720 screen in German', async ({ page }) => {
    await boot(page);
    const got = await toolsFit(page, 'all-tools-de-1280.png');
    expect(got).toMatchObject({ scrolls: 0, cut: [], small: [], spill: [] });
  });
});

test('All tools fits a 1280x720 screen for a host', async ({ page }) => {
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
  expect(got.n).toBeGreaterThan(19);
  expect(got).toMatchObject({ scrolls: 0, cut: [], small: [], spill: [] });
});
