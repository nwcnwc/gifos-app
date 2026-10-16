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

test('More is grouped into labeled rows', async ({ page }) => {
  await boot(page);
  await page.click('#bartoggle');
  const info = await page.evaluate(() => {
    const groupOf = (id) => {
      const el = document.getElementById(id);
      const g = el && el.closest('.moregroup');
      const h = g && g.querySelector('h4');
      return h ? h.textContent.trim() : '';
    };
    const heads = [...document.querySelectorAll('#barmore .moregroup h4')]
      .filter((h) => getComputedStyle(h.closest('.moregroup')).display !== 'none')
      .map((h) => h.textContent.trim());
    return { heads: heads, chat: groupOf('chatbtn'), help: groupOf('helpbtn'), vote: groupOf('votebtn') };
  });
  expect(info.heads).toEqual(['People', 'Share', 'Room', 'Help']);
  expect(info.chat).toBe('People');
  expect(info.help).toBe('Help');
  expect(info.vote).toBe('Room');
});
