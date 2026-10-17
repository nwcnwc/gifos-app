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
