import { test, expect } from '@playwright/test';

const AV = '0123456789abcdef0123456789abcdef';

async function showQueue(page) {
  return page.evaluate(() => {
    window.__gifosVideo.raiseHand(true);
    const q = document.getElementById('handq');
    const r = q.getBoundingClientRect();
    const hq = q.querySelector('.hq').getBoundingClientRect();
    const badge = document.getElementById('livebadge').getBoundingClientRect();
    const chip = document.querySelector('.topchip').getBoundingClientRect();
    const invite = document.getElementById('hdrinvite').getBoundingClientRect();
    const top = document.elementsFromPoint(hq.x + hq.width / 2, hq.y + hq.height / 2)[0];
    const link = document.getElementById('bc-link').getBoundingClientRect();
    const overlaps = (a, b) => a.bottom > b.top + 1 && a.top < b.bottom - 1 && a.right > b.left + 1 && a.left < b.right - 1;
    return {
      x: r.x, y: r.y, w: r.width, h: r.height,
      pos: getComputedStyle(q).position,
      nameH: hq.height,
      nameW: hq.width,
      badgeBottom: badge.bottom,
      chipBottom: chip.bottom,
      inviteH: invite.height,
      coversChip: overlaps(r, chip),
      coversInvite: invite.width > 0 && overlaps(r, invite),
      nameIsTap: !!(top && top.closest && top.closest('.hq')),
      linkTop: link.height > 0 ? link.top : null,
      queueBottom: r.bottom,
      text: q.textContent,
      vh: innerHeight,
      vw: innerWidth,
    };
  });
}

test('a raised hand sits under the banner, and the name is a tap', async ({ page }) => {
  await page.addInitScript((av) => {
    localStorage.setItem('gifos_vadm_sundayservice.' + av, 'stored-host-key');
  }, AV);
  await page.goto('/run.html#v=sundayservice&av=' + AV + '&bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#hdrinvite').waitFor({ state: 'visible' });
  const box = await showQueue(page);
  expect(box.pos).toBe('fixed');
  expect(box.y).toBeGreaterThanOrEqual(box.badgeBottom - 1);
  expect(box.y).toBeGreaterThanOrEqual(box.chipBottom - 1);
  expect(box.nameH).toBeGreaterThanOrEqual(44);
  expect(box.nameW).toBeGreaterThanOrEqual(44);
  expect(box.h).toBeLessThan(160);
  expect(box.coversChip).toBe(false);
  expect(box.coversInvite).toBe(false);
  expect(box.nameIsTap).toBe(true);
  expect(box.text).toContain('waiting');
  expect(box.linkTop).toBeGreaterThanOrEqual(box.queueBottom - 1);
  const stage = await page.evaluate(() => {
    const feed = document.getElementById('stagefeed');
    const el = document.createElement('div');
    el.className = 'rowtile';
    const v = document.createElement('video');
    el.append(v, document.createElement('div'));
    feed.appendChild(el);
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, fit: getComputedStyle(v).objectFit };
  });
  expect(stage.w).toBeGreaterThanOrEqual(stage.vw - 1);
  expect(stage.h).toBeGreaterThanOrEqual(stage.vh * 0.75);
  expect(stage.fit).toBe('contain');
});

test('a town hall host still reaches Invite above the hands', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_vadm_allhands.0123456789abcdef0123456789abcdef', 'stored-host-key');
  });
  await page.goto('/run.html#v=allhands&av=' + AV + '&th=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await page.locator('#hdrinvite').waitFor({ state: 'visible' });
  const box = await showQueue(page);
  expect(box.pos).toBe('fixed');
  expect(box.y).toBeGreaterThanOrEqual(box.chipBottom - 1);
  expect(box.nameH).toBeGreaterThanOrEqual(44);
  expect(box.coversInvite).toBe(false);
  await expect(page.locator('#bc-ended-txt')).toHaveText('The town hall has not started.');
});

test('a meeting keeps the hand line in the page', async ({ page }) => {
  await page.goto('/run.html#v=meet' + Date.now().toString(36), { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  const box = await showQueue(page);
  expect(box.pos).toBe('static');
});
