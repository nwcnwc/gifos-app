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

async function bootSession(page, width, height) {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
  });
  await page.setViewportSize({ width, height });
  await page.goto(SESSION);
  await page.waitForSelector('body.broadcast.meet-session #mic .docklab');
}

test('mute and camera are labeled and the off state is filled red', async ({ page }) => {
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await bootSession(page, w, h);
    const mic = page.locator('#mic');
    await expect(mic.locator('.docklab')).toHaveText('Unmute');
    await expect(mic).toHaveAttribute('aria-label', 'Unmute');
    await expect(page.locator('#cam .docklab')).toHaveText('Video');
    await expect(page.locator('#reactbtn .docklab')).toHaveText('React');
    await expect(page.locator('#bartoggle .docklab')).toHaveText('More');
    const colors = await mic.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, fg: s.color };
    });
    expect(colors.bg, JSON.stringify(colors)).toBe('rgb(182, 22, 34)');
    expect(colors.fg).toBe('rgb(255, 255, 255)');
    const btn = await mic.boundingBox();
    const lab = await mic.locator('.docklab').boundingBox();
    expect(lab.x).toBeGreaterThanOrEqual(btn.x - 1);
    expect(lab.x + lab.width).toBeLessThanOrEqual(btn.x + btn.width + 1);
    expect(lab.y + lab.height).toBeLessThanOrEqual(btn.y + btn.height + 1);
    const bar = await page.locator('.bar').boundingBox();
    expect(bar.x).toBeGreaterThanOrEqual(-1);
    expect(bar.x + bar.width).toBeLessThanOrEqual(w + 1);
    expect(bar.y + bar.height).toBeLessThanOrEqual(h + 1);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setViewportSize({ width: 900, height: 720 });
  const bar = await page.locator('.bar').boundingBox();
  expect(bar.x).toBeGreaterThanOrEqual(-1);
  expect(bar.x + bar.width).toBeLessThanOrEqual(901);
});

test('the M key does not unmute while a chat message is being typed', async ({ page }) => {
  await bootSession(page, 1280, 720);
  await page.locator('#bartoggle').click();
  await page.locator('#chatbtn').click();
  await page.locator('#chat-in').click();
  await page.keyboard.type('m');
  await expect(page.locator('#chat-in')).toHaveValue('m');
  await expect(page.locator('#mic .docklab')).toHaveText('Unmute');
});

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

const HOST_SESSION = '/run.html?desk=host#mb=1&v=sunday&av=0123456789abcdef&bc=1';
const MEET_SESSION = '/run.html?desk=meet#mb=1&v=standup';

test('a broadcast host is marked Live and the room is not called a meeting', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_vadm_sunday.0123456789abcdef', 'host-key');
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(HOST_SESSION);
  await page.waitForSelector('body.broadcast.meet-session');
  await expect(page.locator('#paneltitle')).toHaveText('Broadcast chat');
  await expect(page.locator('#onair')).toHaveText('Live');
  await expect(page.locator('#onair')).toHaveClass(/live/);
  await expect(page.locator('#leavebtn')).toHaveAttribute('title', /broadcast/i);
  await expect(page.locator('#leave-ask-title')).toHaveText('Leave the broadcast?');
  expect((await page.locator('#leavebtn').getAttribute('title')).toLowerCase()).not.toContain('meeting');
  await page.locator('#bartoggle').click();
  await expect(page.locator('#bartoggle')).toHaveAttribute('aria-label', /broadcast/i);
  const box = await page.locator('#onair').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(1280);
});

test('a broadcast viewer is Watching, including at 900px', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gifos_name', 'Avery Chen'));
  await page.setViewportSize({ width: 900, height: 720 });
  await page.goto(SESSION);
  await page.waitForSelector('body.broadcast');
  await expect(page.locator('#onair')).toHaveText('Watching');
  await expect(page.locator('#onair')).toHaveClass(/watch/);
  await expect(page.locator('#paneltitle')).toHaveText('Broadcast chat');
  const box = await page.locator('#onair').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(900);
});

test('a meeting keeps meeting words and hides the on-air pill', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gifos_name', 'Avery Chen'));
  await page.goto(MEET_SESSION);
  await page.waitForSelector('body.meet-session');
  await expect(page.locator('body')).not.toHaveClass(/broadcast/);
  await expect(page.locator('#paneltitle')).toHaveText('Meeting chat');
  await expect(page.locator('#onair')).toBeHidden();
  await expect(page.locator('#leave-ask-title')).toHaveText('Leave the meeting?');
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
