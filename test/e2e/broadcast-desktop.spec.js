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

test('the More sheet stays on screen when the window is short', async ({ page }) => {
  await bootSession(page, 1280, 360);
  await page.locator('#bartoggle').click();
  await expect(page.locator('#barmore')).toBeVisible();
  const info = await page.evaluate(() => {
    const vh = window.innerHeight;
    const menu = document.getElementById('barmore');
    const mr = menu.getBoundingClientRect();
    const bad = [];
    if (mr.top < -1) bad.push('menu-top ' + Math.round(mr.top));
    if (mr.bottom > vh + 1) bad.push('menu-bottom ' + Math.round(mr.bottom));
    const scrollable = menu.scrollHeight > menu.clientHeight + 2;
    for (const el of menu.querySelectorAll('button')) {
      if (getComputedStyle(el).display === 'none' || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      const inMenu = r.bottom <= mr.bottom + 1 && r.top >= mr.top - 1;
      const onScreen = r.top >= -1 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= window.innerWidth + 1;
      if (!onScreen && !(scrollable && inMenu)) bad.push((el.id || el.textContent || '').slice(0, 24));
    }
    return { bad, top: Math.round(mr.top), bottom: Math.round(mr.bottom), scrollable, sh: menu.scrollHeight, ch: menu.clientHeight };
  });
  expect(info.bad, JSON.stringify(info)).toEqual([]);
  expect(info.top).toBeGreaterThanOrEqual(0);
  // Every control can be scrolled into view.
  const help = page.locator('#helpbtn');
  await help.scrollIntoViewIfNeeded();
  const helpBox = await help.boundingBox();
  expect(helpBox.y).toBeGreaterThanOrEqual(0);
  expect(helpBox.y + helpBox.height).toBeLessThanOrEqual(360);
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

test('invite is one tap on the dock, not inside More', async ({ page }) => {
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await bootSession(page, w, h);
    const invite = page.locator('#invite');
    await expect(invite).toBeVisible();
    await expect(invite.locator('.docklab')).toHaveText('Invite');
    await expect(page.locator('.bar')).toHaveClass(/collapsed/);
    const nested = await invite.evaluate((el) => !!el.closest('#barmore'));
    expect(nested).toBe(false);
    const bar = await page.locator('.bar').boundingBox();
    const box = await invite.boundingBox();
    expect(box.width).toBeGreaterThan(40);
    expect(box.x).toBeGreaterThanOrEqual(bar.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(bar.x + bar.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(bar.y - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(bar.y + bar.height + 1);
    expect(bar.x).toBeGreaterThanOrEqual(-1);
    expect(bar.x + bar.width).toBeLessThanOrEqual(w + 1);
    const lab = await invite.locator('.docklab').boundingBox();
    expect(lab.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(lab.x + lab.width).toBeLessThanOrEqual(box.x + box.width + 1);
  }
  await bootSession(page, 1280, 720);
  await page.locator('#invite').click();
  await expect(page.locator('#inv-modal')).toBeVisible();
  await expect(page.locator('#inv-modal h3')).toHaveText('Share this broadcast');
});

test('reactions are emoji under a smiley, and the sparkle stays off this control', async ({ page }) => {
  await bootSession(page, 1280, 720);
  const btn = page.locator('#reactbtn');
  await expect(btn.locator('.dockface')).toHaveText('😊');
  await expect(btn.locator('.docklab')).toHaveText('React');
  const glyph = await btn.innerText();
  expect(glyph).not.toMatch(/[✨✦✧⭐]/);
  await expect(btn.locator('svg')).toHaveCount(0);
  const lab = await btn.locator('.docklab').boundingBox();
  const box = await btn.boundingBox();
  expect(lab.y + lab.height).toBeLessThanOrEqual(box.y + box.height + 1);
  await btn.click();
  const tray = page.locator('#reacttray');
  await expect(tray).toBeVisible();
  const rows = await tray.locator('button').evaluateAll((els) => els.map((el) => ({
    text: (el.textContent || '').trim(),
    aria: el.getAttribute('aria-label') || '',
    burst: el.getAttribute('data-burst') || '',
  })));
  expect(rows.map((r) => r.text)).toEqual(['✋', '👏', '👍', '👎', '😂']);
  expect(rows.map((r) => r.aria)).toEqual(['Raise hand', 'Clap', 'Yes', 'No', 'Laugh']);
  expect(rows.map((r) => r.burst).filter(Boolean)).toEqual(['👏', '👍', '👎', '😂']);
  expect(rows.map((r) => r.text).join('')).not.toMatch(/[✨✦✧⭐]/);
  await page.evaluate(() => {
    const tile = document.createElement('div');
    tile.className = 'tile me';
    document.getElementById('grid').appendChild(tile);
  });
  await tray.locator('button[aria-label="Clap"]').click();
  await expect(page.locator('.tile.me .reactburst')).toHaveText('👏');
});

test('reactions and More never stack', async ({ page }) => {
  await bootSession(page, 1280, 720);
  await page.locator('#bartoggle').click();
  await expect(page.locator('#barmore')).toBeVisible();
  await page.locator('#reactbtn').click();
  await expect(page.locator('#reacttray')).toBeVisible();
  await expect(page.locator('#barmore')).toBeHidden();
  const overlap = await page.evaluate(() => {
    const a = document.getElementById('barmore').getBoundingClientRect();
    const c = document.getElementById('reacttray').getBoundingClientRect();
    const ix = Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left));
    const iy = Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top));
    return { ix: Math.round(ix), iy: Math.round(iy) };
  });
  expect(overlap.ix === 0 || overlap.iy === 0, JSON.stringify(overlap)).toBe(true);
  await page.locator('#bartoggle').click();
  await expect(page.locator('#barmore')).toBeVisible();
  await expect(page.locator('#reacttray')).toBeHidden();
});

test('the dock has a full-screen button', async ({ page }) => {
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await bootSession(page, w, h);
    const fs = page.locator('#fsbtn');
    await expect(fs).toBeVisible();
    await expect(fs).toHaveAttribute('aria-label', 'Full screen');
    await expect(fs.locator('.docklab')).toHaveText('Full');
    const nested = await fs.evaluate((el) => !!el.closest('#barmore'));
    expect(nested).toBe(false);
    const bar = await page.locator('.bar').boundingBox();
    const box = await fs.boundingBox();
    const lab = await fs.locator('.docklab').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(bar.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(bar.x + bar.width + 1);
    expect(lab.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(lab.x + lab.width).toBeLessThanOrEqual(box.x + box.width + 1);
    expect(lab.y + lab.height).toBeLessThanOrEqual(box.y + box.height + 1);
    expect(bar.x).toBeGreaterThanOrEqual(-1);
    expect(bar.x + bar.width).toBeLessThanOrEqual(w + 1);
  }
  await bootSession(page, 1280, 720);
  await page.locator('#fsbtn').click();
  await expect(page.locator('body')).toHaveClass(/fsopen/);
  await expect(page.locator('#fsview')).toHaveClass(/on/);
  await page.locator('#fsclose').click();
  await expect(page.locator('body')).not.toHaveClass(/fsopen/);
});

test('guest moderation tools are in the keyboard tab order', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(MEET_SESSION);
  await page.waitForSelector('body.meet-session #grid');
  const peer = await page.evaluate(() => window.__gifosVideo.guestTileForTest('Jordan Lee'));
  expect(peer).toBe('qa-guest');
  const tile = page.locator('.tile[data-peer="qa-guest"]');
  await expect(tile).toHaveAttribute('tabindex', '0');
  await expect(tile).toHaveAttribute('aria-label', /Jordan Lee/);
  await tile.focus();
  const shown = await tile.locator('.modbar').evaluate((el) => getComputedStyle(el).display);
  expect(shown).toBe('flex');
  const mute = tile.locator('[data-mod="mute"]');
  await expect(mute).toHaveText('Mute');
  await expect(mute).toHaveAttribute('aria-label', 'Mute for everyone');
  const fits = await mute.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1);
  expect(fits).toBe(true);
  for (let i = 0; i < 4; i++) {
    if (await mute.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(mute).toBeFocused();
  await page.evaluate(() => document.body.classList.add('amadmin', 'admroom'));
  await tile.focus();
  const ban = tile.locator('[data-adm="ban"]');
  for (let i = 0; i < 8; i++) {
    if (await ban.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(ban).toBeFocused();
  await expect(ban).toHaveText('Ban');
});

test('a family call and a church broadcast start from a plain lobby', async ({ page }) => {
  async function cardFits(width, height) {
    const card = await page.locator('.lobby-card').boundingBox();
    expect(card.x).toBeGreaterThanOrEqual(-1);
    expect(card.y).toBeGreaterThanOrEqual(-1);
    expect(card.x + card.width).toBeLessThanOrEqual(width + 1);
    expect(card.y + card.height).toBeLessThanOrEqual(height + 1);
  }
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=family' + w);
    await page.waitForSelector('#lobby.show');
    await expect(page.locator('#lob-open')).toHaveText(/Start a call/);
    await expect(page.locator('#lobby')).not.toContainText(/troublemaker|open room|admin/i);
    await expect(page.locator('#lob-guest-pass')).toBeHidden();
    const colors = await page.evaluate(() => {
      const primary = getComputedStyle(document.getElementById('lob-open'));
      const secondary = getComputedStyle(document.getElementById('lob-admin-btn'));
      return { p: primary.backgroundColor, s: secondary.backgroundColor };
    });
    expect(colors.p).toBe('rgb(0, 100, 200)');
    expect(colors.s).not.toBe(colors.p);
    await cardFits(w, h);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/run.html?desk=church#bc=1');
  await page.waitForSelector('#lobby.show h1');
  await expect(page.locator('#lobby h1')).toHaveText('Broadcast');
  await expect(page.locator('#lob-admin-btn')).toBeVisible();
  await expect(page.locator('#lob-admin-btn')).toHaveText(/Go live/);
  await expect(page.locator('#lob-open')).toBeHidden();
  await expect(page.locator('#lob-guest-pass')).toBeHidden();
  const liveBg = await page.locator('#lob-admin-btn').evaluate((el) => getComputedStyle(el).backgroundColor);
  const watchBg = await page.locator('#lob-join-btn').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(liveBg).toBe('rgb(0, 100, 200)');
  expect(watchBg).not.toBe(liveBg);
  await page.locator('#lob-admin-btn').click();
  await expect(page.locator('#lob-admin-pass')).toBeVisible();
  await expect(page.locator('#lob-guest-pass')).toBeHidden();
  await page.locator('#lob-guest-more').click();
  await expect(page.locator('#lob-guest-pass')).toBeVisible();
  await cardFits(1280, 720);
});

test('the screen-name step prefills your GifOS name and picture', async ({ page }) => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const hash = 'ab'.repeat(32);
  await page.addInitScript((avatar) => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_avatar', JSON.stringify(avatar));
  }, { mime: 'image/png', hash, b64: png });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/run.html?desk=appear', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#lobby.show');
  await expect(page.locator('.lob-appear-k')).toHaveText("This is how you'll appear");
  await expect(page.locator('#lob-name-in')).toHaveValue('Avery Chen');
  await expect(page.locator('#lob-face img')).toBeVisible();
  await page.goto(SESSION, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body.meet-session');
  await page.evaluate(() => { window.__gifosNameP = window.__gifosVideo.ensureNameForTest(); return null; });
  const dialog = page.locator('.appear-box');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('h3')).toHaveText("This is how you'll appear");
  await expect(page.locator('#nm')).toHaveValue('Avery Chen');
  await expect(page.locator('#appear-face img')).toHaveAttribute('src', new RegExp(png.slice(0, 24)));
  const colors = await page.evaluate(() => {
    const primary = getComputedStyle(document.getElementById('nmok'));
    const secondary = getComputedStyle(document.getElementById('nmcancel'));
    const a = document.getElementById('nmok').getBoundingClientRect();
    const b = document.getElementById('nmcancel').getBoundingClientRect();
    const gap = Math.round(Math.max(a.left, b.left) - Math.min(a.right, b.right));
    const overlap = !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
    return { p: primary.backgroundColor, s: secondary.backgroundColor, gap, overlap };
  });
  expect(colors.p).toBe('rgb(0, 100, 200)');
  expect(colors.s).not.toBe(colors.p);
  expect(colors.overlap).toBe(false);
  expect(colors.gap).toBeGreaterThanOrEqual(8);
  await page.locator('#nm').fill('Jordan Lee');
  await page.locator('#nmok').click();
  await expect(dialog).toBeHidden();
  await page.evaluate(() => window.__gifosNameP.then(() => null));
  const saved = await page.evaluate(() => localStorage.getItem('gifos_name'));
  expect(saved).toBe('Jordan Lee');
});

test('arrow keys nudge the dock and a double click puts it back', async ({ page }) => {
  await bootSession(page, 1280, 720);
  const before = await page.locator('.bar').boundingBox();
  await page.locator('#bargrip').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  const moved = await page.locator('.bar').boundingBox();
  expect(moved.x).toBeGreaterThan(before.x + 16);
  expect(moved.y).toBeLessThan(before.y - 16);
  expect(moved.x).toBeGreaterThanOrEqual(-1);
  expect(moved.x + moved.width).toBeLessThanOrEqual(1281);
  expect(moved.y).toBeGreaterThanOrEqual(-1);
  expect(moved.y + moved.height).toBeLessThanOrEqual(721);
  await page.locator('#bargrip').dblclick();
  const back = await page.locator('.bar').boundingBox();
  expect(Math.abs(back.x - before.x)).toBeLessThan(2);
  expect(Math.abs(back.y - before.y)).toBeLessThan(2);
  await page.locator('#bargrip').focus();
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowLeft');
  const edge = await page.locator('.bar').boundingBox();
  expect(edge.x).toBeGreaterThanOrEqual(0);
});

test('a broadcast host moderates guests on the stage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.hash.indexOf('who=view') === -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  for (const [w, h] of [[1280, 720], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=stage' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast.meet-session #onair.live');
    const id = await page.evaluate(() => window.__gifosVideo.stageGuestForTest('Jordan Lee'));
    expect(id).toBe('qa-guest');
    const strip = page.locator('#stagemod');
    await expect(strip).toBeVisible();
    await expect(strip).toHaveClass(/on/);
    const gridDisplay = await page.locator('#grid').evaluate((el) => getComputedStyle(el).display);
    expect(gridDisplay).toBe('none');
    const card = page.locator('#stagemod .stagecard[data-peer="qa-guest"]');
    await expect(card).toHaveAttribute('aria-label', /Jordan Lee/);
    const mute = card.locator('[data-mod="mute"]');
    await expect(mute).toBeVisible();
    await expect(mute).toHaveText('Mute');
    const fits = await mute.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1);
    expect(fits).toBe(true);
    const place = await page.evaluate(() => {
      const card = document.querySelector('#stagemod .stagecard');
      const feed = document.getElementById('feed');
      const dock = document.querySelector('.bar');
      const c = card.getBoundingClientRect();
      const f = feed.getBoundingClientRect();
      const d = dock.getBoundingClientRect();
      const overlap = !(c.right < d.left || d.right < c.left || c.bottom < d.top || d.bottom < c.top);
      return {
        x: c.x, y: c.y, r: c.right, b: c.bottom,
        inFeed: c.top >= f.top - 1 && c.left >= f.left - 1 && c.right <= f.right + 1,
        overlap, vw: innerWidth, vh: innerHeight,
      };
    });
    expect(place.inFeed, JSON.stringify(place)).toBe(true);
    expect(place.overlap, JSON.stringify(place)).toBe(false);
    expect(place.x).toBeGreaterThanOrEqual(-1);
    expect(place.r).toBeLessThanOrEqual(w + 1);
    expect(place.b).toBeLessThanOrEqual(h + 1);
    await card.focus();
    for (let i = 0; i < 4; i++) {
      if (await mute.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(mute).toBeFocused();
    await mute.click();
    await expect(mute).toHaveText('Unmute');
  }
  await page.evaluate(() => document.body.classList.add('amadmin', 'admroom'));
  const card = page.locator('#stagemod .stagecard[data-peer="qa-guest"]');
  await card.focus();
  const ban = card.locator('[data-adm="ban"]');
  await expect(ban).toBeVisible();
  await expect(ban).toHaveText('Ban');
  for (let i = 0; i < 8; i++) {
    if (await ban.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(ban).toBeFocused();
  await page.goto(SESSION + '&who=view', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body.broadcast #onair.watch');
  await page.evaluate(() => window.__gifosVideo.stageGuestForTest('Jordan Lee'));
  await expect(page.locator('#stagemod')).toBeHidden();
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
