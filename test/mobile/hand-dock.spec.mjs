import { test, expect } from '@playwright/test';

const AV = '0123456789abcdef0123456789abcdef';

async function dock(page) {
  return page.evaluate(() => {
    const box = (id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return {
        x: r.x, y: r.y, w: r.width, h: r.height, right: r.right,
        parent: el.parentElement.id,
        label: (el.querySelector('.docklab') || {}).textContent || '',
        display: getComputedStyle(el).display,
      };
    };
    return {
      hand: box('hand'),
      react: box('reactbtn'),
      leave: box('leavebtn'),
      vw: innerWidth,
      vh: innerHeight,
    };
  });
}

test('a broadcast viewer gets Hand on the dock', async ({ page }) => {
  const room = 'svc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await page.goto('/run.html#v=' + room + '&av=' + AV + '&bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await page.waitForFunction(() => /has not started/.test(document.getElementById('status').textContent || ''));
  const g = await dock(page);
  expect(g.hand.parent).toBe('');
  expect(g.hand.w).toBeGreaterThanOrEqual(44);
  expect(g.hand.h).toBeGreaterThanOrEqual(44);
  expect(g.hand.label).toBe('Hand');
  expect(g.hand.x).toBeLessThan(g.react.x);
  expect(g.leave.right).toBeLessThanOrEqual(g.vw + 0.5);
  expect(g.hand.y).toBeGreaterThan(g.vh * 0.7);

  await page.locator('#hand').click();
  const up = await page.evaluate(() => ({
    label: document.querySelector('#hand .docklab').textContent,
    pressed: document.getElementById('hand').getAttribute('aria-label'),
    on: document.getElementById('hand').classList.contains('on'),
    queue: document.getElementById('handq').textContent,
  }));
  expect(up.label).toBe('Lower');
  expect(up.pressed).toBe('Lower hand');
  expect(up.on).toBe(true);
  expect(up.queue).toContain('waiting');

  await page.evaluate(() => {
    document.body.classList.add('stage-granted');
    window.__gifosVideo.placeViewerHand();
  });
  const back = await dock(page);
  expect(back.hand.parent).toBe('barmore');
});

test('a town hall watcher gets Hand on the dock', async ({ page }) => {
  const room = 'hall' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await page.goto('/run.html#v=' + room + '&av=' + AV + '&th=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#status')).toContainText('The town hall has not started.');
  const g = await dock(page);
  expect(g.hand.parent).toBe('');
  expect(g.hand.h).toBeGreaterThanOrEqual(44);
  expect(g.hand.label).toBe('Hand');
  expect(g.leave.right).toBeLessThanOrEqual(g.vw + 0.5);
});

test('a meeting keeps Hand in More', async ({ page }) => {
  await page.goto('/run.html#v=meet' + Date.now().toString(36), { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  const g = await dock(page);
  expect(g.hand.parent).toBe('barmore');
  expect(g.hand.w).toBe(0);
});

test('a broadcast host keeps Hand in More', async ({ page }) => {
  await page.addInitScript((av) => {
    localStorage.setItem('gifos_vadm_sundayservice.' + av, 'stored-host-key');
  }, AV);
  await page.goto('/run.html#v=sundayservice&av=' + AV + '&bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#hdrinvite').waitFor({ state: 'visible' });
  const g = await dock(page);
  expect(g.hand.parent).toBe('barmore');
});
