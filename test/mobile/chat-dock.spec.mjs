import { test, expect } from '@playwright/test';

function overlap(a, b) {
  return !(a.bottom <= b.top + 1 || a.top >= b.bottom - 1 || a.right <= b.left + 1 || a.left >= b.right - 1);
}

async function openChat(page) {
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#leavebtn').waitFor({ state: 'visible' });
  await page.evaluate(() => document.getElementById('chatpanel').classList.add('open'));
  await page.locator('#chat-in').waitFor({ state: 'visible' });
}

async function composer(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, right: r.right, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
    };
    return {
      input: rect(document.getElementById('chat-in')),
      send: rect(document.querySelector('#chatform button[type="submit"]')),
      bar: rect(document.querySelector('.bar')),
      vh: window.innerHeight,
    };
  });
}

test('chat composer sits above the dock and Send is 44px', async ({ page }) => {
  await openChat(page);
  const g = await composer(page);
  expect(overlap(g.input, g.bar), 'message field overlaps the dock').toBe(false);
  expect(overlap(g.send, g.bar), 'Send overlaps the dock').toBe(false);
  expect(g.input.bottom).toBeLessThanOrEqual(g.bar.top + 1);
  expect(g.send.height).toBeGreaterThanOrEqual(44);
  expect(g.input.height).toBeGreaterThanOrEqual(44);
});

test('an overlaid keyboard lifts the dock and the composer', async ({ page }) => {
  await page.addInitScript(() => {
    const fns = [];
    const vv = {
      height: window.innerHeight,
      width: window.innerWidth,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 1,
      addEventListener(_t, fn) { fns.push(fn); },
      removeEventListener(_t, fn) {
        const i = fns.indexOf(fn);
        if (i >= 0) fns.splice(i, 1);
      },
    };
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    window.__qaKeyboard = (height) => {
      vv.height = height;
      fns.forEach((fn) => fn());
    };
  });
  await openChat(page);
  const kbTop = await page.evaluate(() => {
    const h = Math.round(window.innerHeight * 0.46);
    window.__qaKeyboard(h);
    return h;
  });
  const g = await composer(page);
  expect(overlap(g.input, g.bar), 'message field overlaps the dock').toBe(false);
  expect(g.bar.bottom).toBeLessThanOrEqual(kbTop + 1);
  expect(g.input.bottom).toBeLessThanOrEqual(kbTop + 1);
});

test('chat composer stays above the dock in landscape', async ({ page }) => {
  const vp = page.viewportSize();
  await page.setViewportSize({
    width: Math.max(vp.width, vp.height),
    height: Math.min(vp.width, vp.height),
  });
  await openChat(page);
  await page.evaluate(() => window.__meetChromeShow && window.__meetChromeShow());
  const g = await composer(page);
  expect(overlap(g.input, g.bar), 'message field overlaps the dock').toBe(false);
  expect(overlap(g.send, g.bar), 'Send overlaps the dock').toBe(false);
  expect(g.send.height).toBeGreaterThanOrEqual(44);
});
