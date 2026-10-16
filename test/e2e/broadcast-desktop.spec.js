const { test, expect } = require('@playwright/test');

// Session frame: broadcast skin, no relay knock. A full navigation is required
// because a hash-only change does not re-run boot.
const SESSION = '/run.html?desk=chat#mb=1&v=sunday&av=0123456789abcdef&bc=1';

async function openChat(page, width, height) {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
  });
  await page.setViewportSize({ width, height });
  await page.goto(SESSION);
  await page.waitForSelector('body.broadcast.meet-session .bar');
  await page.locator('#bartoggle').click();
  await page.locator('#chatbtn').click();
  await expect(page.locator('#chatpanel')).toHaveClass(/open/);
}

async function composerOverlap(page) {
  return page.evaluate(() => {
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const hit = (el) => {
      const r = el.getBoundingClientRect();
      const ix = Math.max(0, Math.min(bar.right, r.right) - Math.max(bar.left, r.left));
      const iy = Math.max(0, Math.min(bar.bottom, r.bottom) - Math.max(bar.top, r.top));
      return { ix: Math.round(ix), iy: Math.round(iy), top: Math.round(r.top), bottom: Math.round(r.bottom) };
    };
    return {
      form: hit(document.getElementById('chatform')),
      attach: hit(document.getElementById('cattach')),
      input: hit(document.getElementById('chat-in')),
      send: hit(document.querySelector('#chatform button[type=submit]')),
      vh: window.innerHeight,
    };
  });
}

function clearOfDock(box) {
  return box.ix === 0 || box.iy === 0;
}

test('chat composer stays clear of the dock at 900px', async ({ page }) => {
  await openChat(page, 900, 720);
  const hit = await composerOverlap(page);
  expect(clearOfDock(hit.form), JSON.stringify(hit)).toBe(true);
  expect(clearOfDock(hit.attach), JSON.stringify(hit)).toBe(true);
  expect(clearOfDock(hit.input), JSON.stringify(hit)).toBe(true);
  expect(clearOfDock(hit.send), JSON.stringify(hit)).toBe(true);
  expect(hit.attach.bottom).toBeLessThanOrEqual(hit.vh);
  expect(hit.send.bottom).toBeLessThanOrEqual(hit.vh);
});

test('chat composer stays clear of the dock after a live resize to 900px', async ({ page }) => {
  await openChat(page, 1920, 1080);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.setViewportSize({ width: 900, height: 720 });
  const hit = await composerOverlap(page);
  expect(clearOfDock(hit.attach), JSON.stringify(hit)).toBe(true);
  expect(clearOfDock(hit.input), JSON.stringify(hit)).toBe(true);
  expect(clearOfDock(hit.form), JSON.stringify(hit)).toBe(true);
});
