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
  await expect(page).toHaveTitle('Service — GifOS');
  await expect(page.locator('#paneltitle')).toHaveText('Service chat');
  await expect(page.locator('#airkind')).toHaveText('Service · You are live');
  await expect(page.locator('#onair')).toHaveText('Live');
  await expect(page.locator('#onair')).toHaveClass(/live/);
  await expect(page.locator('#leavebtn')).toHaveAttribute('title', /service/i);
  await expect(page.locator('#leavebtn .docklab')).toHaveText('End');
  await expect(page.locator('#leave-ask-title')).toHaveText('End the service?');
  expect((await page.locator('#leavebtn').getAttribute('title')).toLowerCase()).not.toContain('meeting');
  expect((await page.locator('#airbar').textContent()).toLowerCase()).not.toContain('small group');
  await page.locator('#bartoggle').click();
  await expect(page.locator('#bartoggle')).toHaveAttribute('aria-label', /service/i);
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
  await expect(page).toHaveTitle('Service — GifOS');
  await expect(page.locator('#paneltitle')).toHaveText('Service chat');
  await expect(page.locator('#airkind')).toHaveText('Service · You are watching');
  const box = await page.locator('#onair').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(900);
});

test('a meeting keeps meeting words and hides the on-air pill', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gifos_name', 'Avery Chen'));
  await page.goto(MEET_SESSION);
  await page.waitForSelector('body.meet-session');
  await expect(page.locator('body')).not.toHaveClass(/broadcast/);
  await expect(page).toHaveTitle('Small group — GifOS');
  await expect(page.locator('#paneltitle')).toHaveText('Small group chat');
  await expect(page.locator('#onair')).toBeHidden();
  await expect(page.locator('#airkind')).toHaveText('Small group');
  await expect(page.locator('#airbar')).toHaveClass(/group/);
  await expect(page.locator('#leave-ask-title')).toHaveText('Leave the small group?');
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
  await expect(page.locator('#inv-modal h3')).toHaveText('Share this service');
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
    await expect(fs.locator('.docklab')).toHaveText('Full screen');
    const clip = await fs.locator('.docklab').evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(clip).toBe(true);
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
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setViewportSize({ width: 900, height: 720 });
  const resized = await page.evaluate(() => {
    const lab = document.querySelector('#fsbtn .docklab');
    const bar = document.querySelector('.bar').getBoundingClientRect();
    return { text: lab.textContent, clip: lab.scrollWidth <= lab.clientWidth + 1, barIn: bar.left >= -1 && bar.right <= innerWidth + 1 };
  });
  expect(resized.text).toBe('Full screen');
  expect(resized.clip).toBe(true);
  expect(resized.barIn).toBe(true);
  await page.locator('#fsbtn').click();
  await expect(page.locator('body')).toHaveClass(/fsopen/);
  await expect(page.locator('#fsview')).toHaveClass(/on/);
  await page.locator('#fsclose').click();
  await expect(page.locator('body')).not.toHaveClass(/fsopen/);
});

test('a service password is the viewer password', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    localStorage.setItem('gifos_vadm_sunday.0123456789abcdef', 'host-key');
  });
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=vpw' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#onair.live');
    await page.locator('#bartoggle').click();
    const pw = page.locator('#pwbtn');
    await expect(pw).toHaveAttribute('title', 'Viewer password. Optional. It is not part of the link.');
    await pw.click();
    await expect(page.locator('#pw-title')).toHaveText('Viewer password');
    const hint = page.locator('#pw-hint');
    await expect(hint).toHaveText('Optional. It is not part of the link. People can still watch, and the stage stays blurred until it is set.');
    await expect(hint).not.toContainText('meeting');
    const box = await page.locator('#pw-modal .name-box').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(h + 1);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(w + 1);
    const words = await hint.boundingBox();
    expect(words.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(words.x + words.width).toBeLessThanOrEqual(box.x + box.width + 1);
    await page.locator('#pw-cancel').click();
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/run.html?desk=vpwsg#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await page.locator('#bartoggle').click();
  await page.locator('#pwbtn').click();
  await expect(page.locator('#pw-title')).toHaveText('Room password');
  await expect(page.locator('#pw-hint')).toContainText('meeting');
});

test('who is watching talks about the service', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
  });
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=who' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast .bar');
    await page.locator('#bartoggle').click();
    await page.locator('#whobtn').click();
    await expect(page.locator('#who-modal h3')).toHaveText('Who is watching');
    const note = page.locator('#who-modal .name-box p');
    await expect(note).toContainText('storing this service');
    await expect(note).not.toContainText('meeting');
    const box = await page.locator('#who-modal .name-box').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(h + 1);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(w + 1);
    await page.locator('#who-close').click();
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/run.html?desk=whosg#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await page.locator('#bartoggle').click();
  await page.locator('#whobtn').click();
  await expect(page.locator('#who-modal h3')).toHaveText('Who is here');
  await expect(page.locator('#who-modal .name-box p')).toContainText('this meeting');
});

test('full screen on a service shows the stage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  async function readFs() {
    return page.evaluate(() => {
      const view = document.getElementById('fsview');
      const name = document.getElementById('fsname');
      const close = document.getElementById('fsclose').getBoundingClientRect();
      const strip = document.getElementById('fsstrip');
      const nm = name.querySelector('.fsnm');
      return {
        on: view.classList.contains('on'),
        follow: (strip.innerText || '').indexOf('Follow speaker') !== -1,
        stripShown: getComputedStyle(strip).display !== 'none',
        line: nm ? nm.textContent : '',
        nameOn: name.classList.contains('on'),
        title: document.getElementById('fsbtn').title,
        closeIn: close.top >= -1 && close.left >= -1 && close.right <= innerWidth + 1 && close.bottom <= innerHeight + 1,
      };
    });
  }
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=fsstage' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast #onair.watch');
    await page.locator('#fsbtn').click();
    await expect(page.locator('#fsview')).toHaveClass(/on/);
    const clear = await readFs();
    expect(clear.follow, JSON.stringify(clear)).toBe(false);
    expect(clear.stripShown, JSON.stringify(clear)).toBe(false);
    expect(clear.line).toBe('The stage is clear.');
    expect(clear.nameOn).toBe(true);
    expect(clear.title).toBe('Watch the stage full screen.');
    expect(clear.closeIn, JSON.stringify(clear)).toBe(true);
    await page.locator('#fsclose').click();
    await expect(page.locator('body')).not.toHaveClass(/fsopen/);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/run.html?desk=fsstagehost&host=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#onair.live');
  await page.evaluate(() => window.__gifosVideo.setStageForTest(true));
  await page.locator('#fsbtn').click();
  const onStage = await readFs();
  expect(onStage.line).toBe('You are on stage. Your camera is off.');
  expect(onStage.follow).toBe(false);
  await page.locator('#fsclose').click();
  await page.goto('/run.html?desk=fssg#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await page.locator('#fsbtn').click();
  const group = await readFs();
  expect(group.follow, JSON.stringify(group)).toBe(true);
  expect(group.stripShown).toBe(true);
  expect(group.title).toContain('speaking');
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
    await expect(page.locator('#lobby h1')).toHaveText('Small group');
    await expect(page.locator('#lob-open')).toHaveText(/Start a call/);
    await expect(page.locator('#lob-admin-btn')).toHaveText('Host this call');
    await expect(page.locator('#lob-join-btn')).toHaveText('Join a link');
    await expect(page.locator('#lob-admin-btn')).toHaveClass(/lob-link/);
    await expect(page.locator('#lob-join-btn')).toHaveClass(/lob-link/);
    await expect(page.locator('#lobby')).not.toContainText(/troublemaker|open room|admin/i);
    await expect(page.locator('#lob-guest-pass')).toBeHidden();
    const colors = await page.evaluate(() => {
      const primary = getComputedStyle(document.getElementById('lob-open'));
      const host = document.getElementById('lob-admin-btn');
      const join = document.getElementById('lob-join-btn');
      const hs = getComputedStyle(host);
      const pr = document.getElementById('lob-open').getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      const jr = join.getBoundingClientRect();
      return {
        p: primary.backgroundColor,
        h: hs.backgroundColor,
        border: hs.borderTopWidth,
        shorter: hr.height < pr.height - 4 && jr.height < pr.height - 4,
        in: hr.left >= 0 && jr.right <= innerWidth,
      };
    });
    expect(colors.p).toBe('rgb(0, 100, 200)');
    expect(colors.h).not.toBe(colors.p);
    expect(colors.border).toBe('0px');
    expect(colors.shorter).toBe(true);
    expect(colors.in).toBe(true);
    await cardFits(w, h);
  }
  await page.locator('#lob-join-btn').click();
  await expect(page.locator('#lob-join-in')).toBeVisible();
  await expect(page.locator('#lob-admin')).toBeHidden();
  await page.locator('#lob-admin-btn').click();
  await expect(page.locator('#lob-admin-pass')).toBeVisible();
  await expect(page.locator('#lob-join')).toBeHidden();
  await cardFits(900, 720);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/run.html?desk=church#bc=1');
  await page.waitForSelector('#lobby.show h1');
  await expect(page.locator('#lobby h1')).toHaveText('Service');
  await expect(page.locator('#lob-admin-btn')).toBeVisible();
  await expect(page.locator('#lob-admin-btn')).toHaveText(/Go live/);
  await expect(page.locator('#lob-admin-btn')).toHaveClass(/lob-primary/);
  await expect(page.locator('#lob-join-btn')).toHaveText(/Watch/);
  await expect(page.locator('#lob-join-btn')).toHaveClass(/lob-action/);
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
  const dialog = page.locator('#appear-modal .appear-box');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('h3')).toHaveText("This is how you'll appear");
  await expect(dialog.locator('#appear-note')).toHaveText('Only seen if you raise your hand and are promoted to the stage.');
  await expect(dialog).not.toContainText('in the meeting');
  await expect(page.locator('#nm')).toHaveValue('Avery Chen');
  await expect(page.locator('#appear-face img')).toHaveAttribute('src', new RegExp(png.slice(0, 24)));
  await expect(page.locator('#nmcancel')).toHaveText('Clear');
  await expect(page.locator('#nmok')).toHaveText('Save');
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
  const kept = await page.evaluate(() => ({
    name: localStorage.getItem('gifos_name'),
    avatar: localStorage.getItem('gifos_avatar'),
  }));
  expect(kept.name).toBe('Jordan Lee');
  expect(kept.avatar).toContain(png.slice(0, 24));
  await page.evaluate(() => { sessionStorage.removeItem('gifos_appear_ok'); window.__gifosNameP = window.__gifosVideo.ensureNameForTest(); return null; });
  await expect(page.locator('#appear-modal .appear-box')).toBeVisible();
  await page.locator('#nmcancel').click();
  await expect(page.locator('#appear-modal .appear-box')).toBeVisible();
  await expect(page.locator('#nm')).toHaveValue('');
  await expect(page.locator('#appear-face img')).toHaveCount(0);
  const cleared = await page.evaluate(() => ({
    name: localStorage.getItem('gifos_name'),
    avatar: localStorage.getItem('gifos_avatar'),
  }));
  expect(cleared.name).toBeNull();
  expect(cleared.avatar).toBeNull();
});

test('a broadcast viewer is told their picture stays off the stage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=anote' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast');
    await page.evaluate(() => { sessionStorage.removeItem('gifos_appear_ok'); window.__gifosNameP = window.__gifosVideo.ensureNameForTest(); });
    const note = page.locator('#appear-note');
    await expect(note).toBeVisible();
    await expect(note).toHaveText('Only seen if you raise your hand and are promoted to the stage.');
    await expect(page.locator('#appear-title')).toHaveText("This is how you'll appear");
    const fit = await page.evaluate(() => {
      const box = document.querySelector('#appear-modal .appear-box').getBoundingClientRect();
      const line = document.getElementById('appear-note').getBoundingClientRect();
      const s = getComputedStyle(document.getElementById('appear-note'));
      return {
        inside: line.left >= box.left - 1 && line.right <= box.right + 1 && line.top >= box.top - 1 && line.bottom <= box.bottom + 1,
        color: s.color,
        boxRight: box.right,
        lineRight: line.right,
      };
    });
    expect(fit.inside, JSON.stringify(fit)).toBe(true);
    expect(fit.color).toBe('rgb(29, 29, 31)');
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/run.html?desk=anotehost&host=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.live');
  await page.evaluate(() => { sessionStorage.removeItem('gifos_appear_ok'); window.__gifosNameP = window.__gifosVideo.ensureNameForTest(); });
  await expect(page.locator('#appear-title')).toHaveText("This is how you'll appear");
  await expect(page.locator('#appear-note')).toHaveCount(0);
  await page.goto('/run.html?desk=anotemeet#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await page.evaluate(() => { sessionStorage.removeItem('gifos_appear_ok'); window.__gifosNameP = window.__gifosVideo.ensureNameForTest(); });
  await expect(page.locator('#appear-title')).toHaveText("This is how you'll appear");
  await expect(page.locator('#appear-note')).toHaveCount(0);
  await expect(page.locator('#appear-modal')).not.toContainText('in the meeting');
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

test('a small group tucks the dock when the call sits quiet', async ({ page }) => {
  async function dockPlace() {
    return page.evaluate(() => {
      const bar = document.querySelector('.bar');
      const r = bar.getBoundingClientRect();
      const mic = document.getElementById('mic').getBoundingClientRect();
      const fit = document.getElementById('fitbtn');
      const fr = fit.getBoundingClientRect();
      return {
        tucked: bar.classList.contains('tucked'),
        hidden: bar.getAttribute('aria-hidden'),
        pe: getComputedStyle(bar).pointerEvents,
        top: r.top,
        vh: window.innerHeight,
        micTop: mic.top,
        micBottom: mic.bottom,
        fitBottom: fr.bottom,
        fitTop: fr.top,
        fitShown: getComputedStyle(fit).display !== 'none',
      };
    });
  }
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
  });
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=tuck' + w + '#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.group');
    const before = await dockPlace();
    expect(before.tucked).toBe(false);
    expect(before.micBottom).toBeLessThanOrEqual(h);
    expect(before.micTop).toBeGreaterThanOrEqual(0);
    const ok = await page.evaluate(() => window.__gifosDock.tuck());
    expect(ok).toBe(true);
    const away = await dockPlace();
    expect(away.tucked).toBe(true);
    expect(away.hidden).toBe('true');
    expect(away.pe).toBe('none');
    expect(away.top).toBeGreaterThanOrEqual(h - 1);
    expect(away.fitBottom).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setViewportSize({ width: 900, height: 720 });
  const resized = await dockPlace();
  expect(resized.tucked).toBe(true);
  expect(resized.top).toBeGreaterThanOrEqual(719);
  expect(resized.fitBottom).toBeLessThanOrEqual(0);
  await page.evaluate(() => window.__gifosDock.wake());
  const back = await dockPlace();
  expect(back.tucked).toBe(false);
  expect(back.hidden).toBeNull();
  expect(back.micTop).toBeGreaterThanOrEqual(0);
  expect(back.micBottom).toBeLessThanOrEqual(720);
  expect(back.fitTop).toBeGreaterThanOrEqual(0);
  expect(back.fitBottom).toBeLessThanOrEqual(720);
  await page.evaluate(() => window.__gifosDock.tuck());
  await page.keyboard.press('Shift');
  const woke = await dockPlace();
  expect(woke.tucked).toBe(false);
  expect(woke.micBottom).toBeLessThanOrEqual(720);
  await page.locator('#bartoggle').click();
  expect(await page.evaluate(() => window.__gifosDock.tuck())).toBe(false);
  await page.locator('#bartoggle').click();
  await page.locator('#reactbtn').click();
  expect(await page.evaluate(() => window.__gifosDock.tuck())).toBe(false);
  await page.locator('#reactbtn').click();
  await page.locator('#chatbtn').click();
  await page.locator('#chat-in').focus();
  expect(await page.evaluate(() => window.__gifosDock.tuck())).toBe(false);
  await page.evaluate(() => window.__gifosDock.setIdle(200));
  await page.locator('#chat-in').blur();
  await page.evaluate(() => window.__gifosDock.wake());
  await page.waitForFunction(() => document.querySelector('.bar').classList.contains('tucked'));
  await page.goto('/run.html?desk=tucksvc#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body.broadcast .bar');
  await page.evaluate(() => window.__gifosDock.setIdle(200));
  await page.waitForTimeout(500);
  const service = await dockPlace();
  expect(await page.evaluate(() => window.__gifosDock.tuck())).toBe(false);
  expect(service.tucked).toBe(false);
  expect(service.micBottom).toBeLessThanOrEqual(720);
  expect(service.fitShown).toBe(false);
});

test('a service hides Fit because the stage is one picture', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.hash.indexOf('bc=1') !== -1 && location.search.indexOf('view=1') === -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  for (const [w, h, who] of [[1280, 720, 'host'], [1920, 1080, 'host'], [900, 720, 'view']]) {
    await page.setViewportSize({ width: w, height: h });
    const q = who === 'view' ? '&view=1' : '';
    await page.goto('/run.html?desk=nofit' + w + q + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast #onair');
    const fit = await page.evaluate(() => {
      const el = document.getElementById('fitbtn');
      const r = el.getBoundingClientRect();
      return { display: getComputedStyle(el).display, w: r.width, h: r.height };
    });
    expect(fit.display, who + ' ' + w).toBe('none');
    expect(fit.w).toBe(0);
    expect(fit.h).toBe(0);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/run.html?desk=nofitsg#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  const btn = page.locator('#fitbtn');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('▦ Fit');
  await btn.click();
  await expect(btn).toHaveText('▦ Scroll');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
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

test('a volunteer cannot miss whether they are on air', async ({ page }) => {
  async function readBar() {
    return page.evaluate(() => {
      const el = document.getElementById('airbar');
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const chip = document.querySelector('.topchip').getBoundingClientRect();
      const fit = document.getElementById('fitbtn').getBoundingClientRect();
      const dock = document.querySelector('.bar').getBoundingClientRect();
      const overlap = (a, b) => !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
      return {
        text: document.getElementById('airkind').textContent, bg: s.backgroundColor, fg: s.color, hidden: el.hidden,
        x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight,
        belowChip: r.top >= chip.bottom - 1,
        belowFit: r.top >= fit.bottom - 1,
        dock: overlap(r, dock),
      };
    });
  }
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.hash.indexOf('bc=1') !== -1 && location.hash.indexOf('v=sunday') !== -1 && location.search.indexOf('view=1') === -1) {
      localStorage.setItem(key, 'host-key');
    } else localStorage.removeItem(key);
  });
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=air' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#onair.live');
    const live = await readBar();
    expect(live.text).toBe('Service · You are live');
    expect(live.bg).toBe('rgb(182, 22, 34)');
    expect(live.fg).toBe('rgb(255, 255, 255)');
    expect(live.h).toBeGreaterThanOrEqual(44);
    expect(live.w).toBeGreaterThanOrEqual(w - 2);
    expect(live.belowChip, JSON.stringify(live)).toBe(true);
    expect(live.belowFit, JSON.stringify(live)).toBe(true);
    expect(live.dock, JSON.stringify(live)).toBe(false);
    expect(live.y + live.h).toBeLessThanOrEqual(h);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/run.html?desk=airview&view=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#onair.watch');
  const watch = await readBar();
  expect(watch.text).toBe('Service · You are watching');
  expect(watch.bg).toBe('rgb(232, 236, 241)');
  expect(watch.fg).toBe('rgb(29, 29, 31)');
  expect(watch.h).toBeGreaterThanOrEqual(44);
  expect(watch.w).toBeGreaterThanOrEqual(1278);
  await page.goto(MEET_SESSION, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body.meet-session .bar');
  const group = await readBar();
  expect(group.text).toBe('Small group');
  expect(group.bg).toBe('rgb(20, 48, 36)');
  expect(group.bg).not.toBe('rgb(182, 22, 34)');
  expect(group.h).toBeGreaterThanOrEqual(44);
  expect(group.belowChip, JSON.stringify(group)).toBe(true);
  expect(group.dock, JSON.stringify(group)).toBe(false);
});

test('recording and who is here sit on the room bar', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
  });
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=trust' + w + '#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.group');
    await expect(page.locator('.bar')).toHaveClass(/collapsed/);
    await expect(page.locator('#barmore')).toBeHidden();
    const rec = page.locator('#airrec');
    const who = page.locator('#airwho');
    await expect(rec).toBeVisible();
    await expect(rec).toHaveText('Not recording');
    await expect(rec).toHaveAttribute('aria-pressed', 'false');
    await expect(who).toBeVisible();
    await expect(who).toHaveText('1 here');
    const insideMore = await page.locator('#barmore #airrec, #barmore #airwho').count();
    expect(insideMore).toBe(0);
    const lay = await page.evaluate(() => {
      const bar = document.getElementById('airbar').getBoundingClientRect();
      const rec = document.getElementById('airrec').getBoundingClientRect();
      const who = document.getElementById('airwho').getBoundingClientRect();
      const kind = document.getElementById('airkind').getBoundingClientRect();
      const dock = document.querySelector('.bar').getBoundingClientRect();
      const overlap = (a, b) => !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
      const inside = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
      return {
        kind: kind.width > 20,
        recIn: inside(rec, bar),
        whoIn: inside(who, bar),
        recOn: rec.left >= 0 && rec.right <= innerWidth && rec.top >= 0 && rec.bottom <= innerHeight,
        whoOn: who.left >= 0 && who.right <= innerWidth && who.top >= 0 && who.bottom <= innerHeight,
        dock: overlap(bar, dock),
      };
    });
    expect(lay.kind, JSON.stringify(lay)).toBe(true);
    expect(lay.recIn, JSON.stringify(lay)).toBe(true);
    expect(lay.whoIn, JSON.stringify(lay)).toBe(true);
    expect(lay.recOn, JSON.stringify(lay)).toBe(true);
    expect(lay.whoOn, JSON.stringify(lay)).toBe(true);
    expect(lay.dock, JSON.stringify(lay)).toBe(false);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  const off = await page.locator('#airrec').evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.evaluate(() => window.__gifosRoomTrust.setRecording(true));
  await expect(page.locator('#airrec')).toHaveText('Recording');
  await expect(page.locator('#airrec')).toHaveAttribute('aria-pressed', 'true');
  const on = await page.locator('#airrec').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(on).toBe('rgb(255, 255, 255)');
  expect(on).not.toBe(off);
  await page.evaluate(() => window.__gifosRoomTrust.setRecording(false));
  await expect(page.locator('#airrec')).toHaveText('Not recording');
  await page.locator('#airwho').click();
  await expect(page.locator('#who-modal')).toBeVisible();
  await expect(page.locator('#who-modal h3')).toHaveText('Who is here');
  await expect(page.locator('#who-list')).toContainText('Avery Chen');
  await page.locator('#who-close').click();
  await expect(page.locator('#who-modal')).toBeHidden();
  await page.locator('#airrec').click();
  await expect(page.locator('#rec-options h3')).toHaveText('Record this small group');
  await page.locator('#ro-cancel').click();
  await expect(page.locator('#rec-options')).toHaveCount(0);
  await page.goto('/run.html?desk=trustsvc#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airkind');
  await expect(page.locator('#airkind')).toHaveText('Service · You are watching');
  await expect(page.locator('#airrec')).toHaveText('Not recording');
  await page.locator('#airrec').click();
  await expect(page.locator('#rec-options h3')).toHaveText('Record this service');
});

test('chat is one tap on the dock, and a prayer is its own line', async ({ page }) => {
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await bootSession(page, w, h);
    const chat = page.locator('.bar > #chatbtn');
    await expect(chat).toBeVisible();
    await expect(chat.locator('.docklab')).toHaveText('Chat');
    const insideMore = await page.locator('#barmore #chatbtn').count();
    expect(insideMore).toBe(0);
    const bar = await page.locator('.bar').boundingBox();
    expect(bar.x).toBeGreaterThanOrEqual(-1);
    expect(bar.x + bar.width).toBeLessThanOrEqual(w + 1);
    const lab = await chat.locator('.docklab').boundingBox();
    const btn = await chat.boundingBox();
    expect(lab.x).toBeGreaterThanOrEqual(btn.x - 1);
    expect(lab.x + lab.width).toBeLessThanOrEqual(btn.x + btn.width + 1);
  }
  await bootSession(page, 1280, 720);
  await page.locator('.bar > #chatbtn').click();
  await expect(page.locator('#chatpanel')).toHaveClass(/open/);
  await expect(page.locator('#cfiles')).toBeHidden();
  const sendLook = await page.locator('#chatform button[type=submit]').evaluate((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { bg: s.backgroundColor, h: r.height };
  });
  expect(sendLook.bg).toBe('rgb(0, 100, 200)');
  expect(sendLook.h).toBeGreaterThanOrEqual(44);
  const hit = await composerOverlap(page);
  expect(clearOfDock(hit.form), JSON.stringify(hit)).toBe(true);
  expect(clearOfDock(hit.send), JSON.stringify(hit)).toBe(true);
  await page.locator('#pray').click();
  await expect(page.locator('#pray')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#chat-in')).toHaveAttribute('placeholder', 'Prayer request…');
  await page.locator('#chat-in').fill('Please pray for Maya');
  await page.locator('#chatform button[type=submit]').click();
  const prayer = page.locator('#chatlog .cmsg.prayer');
  await expect(prayer).toContainText('Prayer');
  await expect(prayer).toContainText('Please pray for Maya');
  await page.locator('#pray').click();
  await page.locator('#chat-in').fill('See you after');
  await page.locator('#chatform button[type=submit]').click();
  const lines = page.locator('#chatlog .cmsg');
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(1)).not.toHaveClass(/prayer/);
  await expect(lines.nth(1)).toContainText('See you after');
});

test('a service chat tip talks about the people watching', async ({ page }) => {
  const serviceTip = 'Chat with everyone watching — stays between the people here, not on a server';
  const meetingTip = 'Chat and share files — stays between the people on this meeting, not on a server';
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('view=1') === -1 && location.hash.indexOf('bc=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=chatip' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    const chat = page.locator('.bar > #chatbtn');
    await expect(chat).toBeVisible();
    await expect(chat).toHaveAttribute('title', serviceTip);
    const lay = await page.evaluate(() => {
      const btn = document.querySelector('.bar > #chatbtn').getBoundingClientRect();
      const bar = document.querySelector('.bar').getBoundingClientRect();
      return { inBar: btn.left >= bar.left - 1 && btn.right <= bar.right + 1, on: btn.right <= innerWidth + 1 && btn.bottom <= innerHeight + 1 };
    });
    expect(lay.inBar, JSON.stringify(lay)).toBe(true);
    expect(lay.on, JSON.stringify(lay)).toBe(true);
  }
  await page.goto('/run.html?desk=chatipview&view=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.bar > #chatbtn')).toHaveAttribute('title', serviceTip);
  await page.goto('/run.html?desk=chatipgroup#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.bar > #chatbtn')).toHaveAttribute('title', meetingTip);
});

test('service help names Raise hand and Step off', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
  });
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=help' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast .bar');
    await page.locator('#bartoggle').click();
    await page.locator('#helpbtn').click();
    await expect(page.locator('#help-modal h3')).toHaveText('How this service works');
    const scroll = page.locator('#help-modal .help-scroll');
    await expect(scroll).toContainText('Raise hand');
    await expect(scroll).toContainText('Step off');
    await expect(scroll).not.toContainText('Tap Hand');
    await expect(scroll).not.toContainText('Stepping down');
    const box = await page.locator('#help-modal .help-box').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(h + 1);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(w + 1);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/run.html?desk=helpsg#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await page.locator('#bartoggle').click();
  await page.locator('#helpbtn').click();
  await expect(page.locator('#help-modal h3')).toHaveText('How this small group works');
  await expect(page.locator('#help-modal .help-scroll')).toContainText('stadium');
  await expect(page.locator('#help-modal .help-scroll')).not.toContainText('Tap Raise hand');
});

test('service chat keeps the title on one line', async ({ page }) => {
  async function headBox() {
    return page.evaluate(() => {
      const title = document.getElementById('paneltitle');
      const priv = document.getElementById('chatprivacy');
      const close = document.getElementById('chatclose');
      const head = document.getElementById('chathead');
      const tr = title.getBoundingClientRect();
      const pr = priv.getBoundingClientRect();
      const cr = close.getBoundingClientRect();
      const hr = head.getBoundingClientRect();
      const overlap = (a, b) => !(a.right < b.left + 1 || b.right < a.left + 1 || a.bottom < b.top + 1 || b.bottom < a.top + 1);
      return {
        title: title.textContent,
        priv: priv.textContent,
        titleH: tr.height,
        oneLine: title.scrollWidth <= title.clientWidth + 1 && tr.height <= 28,
        privBelow: pr.top >= tr.bottom - 1,
        privWide: pr.width >= hr.width - 40,
        hitTitle: overlap(tr, pr),
        hitClose: overlap(pr, cr),
        closeIn: cr.left >= hr.left - 1 && cr.right <= hr.right + 1 && cr.top >= hr.top - 1,
      };
    });
  }
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
  });
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=chead' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast .bar');
    await page.locator('#chatbtn').click();
    await page.waitForSelector('#chatpanel.open');
    const m = await headBox();
    expect(m.title).toBe('Service chat');
    expect(m.priv).toBe('· private to this service, gone when everyone leaves');
    expect(m.oneLine, JSON.stringify(m)).toBe(true);
    expect(m.privBelow, JSON.stringify(m)).toBe(true);
    expect(m.privWide, JSON.stringify(m)).toBe(true);
    expect(m.hitTitle, JSON.stringify(m)).toBe(false);
    expect(m.hitClose, JSON.stringify(m)).toBe(false);
    expect(m.closeIn, JSON.stringify(m)).toBe(true);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setViewportSize({ width: 900, height: 720 });
  const resized = await headBox();
  expect(resized.oneLine, JSON.stringify(resized)).toBe(true);
  expect(resized.privBelow, JSON.stringify(resized)).toBe(true);
  await page.goto('/run.html?desk=cheadsg#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await page.locator('#chatbtn').click();
  await page.waitForSelector('#chatpanel.open');
  const group = await headBox();
  expect(group.title).toBe('Small group chat');
  expect(group.priv).toContain('small group');
  expect(group.oneLine, JSON.stringify(group)).toBe(true);
  expect(group.privBelow, JSON.stringify(group)).toBe(true);
  expect(group.hitTitle, JSON.stringify(group)).toBe(false);
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

test('leaving and rejoining a personal call is obvious', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
  });
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=leave' + w + '#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.group');
    const leave = page.locator('#leavebtn');
    await expect(leave.locator('.docklab')).toHaveText('Leave');
    const lay = await page.evaluate(() => {
      const btn = document.getElementById('leavebtn').getBoundingClientRect();
      const lab = document.querySelector('#leavebtn .docklab').getBoundingClientRect();
      const bar = document.querySelector('.bar').getBoundingClientRect();
      return {
        labIn: lab.left >= btn.left - 1 && lab.right <= btn.right + 1 && lab.top >= btn.top - 1 && lab.bottom <= btn.bottom + 1,
        barIn: bar.left >= -1 && bar.right <= innerWidth + 1,
      };
    });
    expect(lay.labIn, JSON.stringify(lay)).toBe(true);
    expect(lay.barIn, JSON.stringify(lay)).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('#leavebtn').click();
  await expect(page.locator('#leave-ask')).toBeHidden();
  await expect(page.locator('#left-modal')).toBeVisible();
  await expect(page.locator('#left-title')).toHaveText('You left the small group');
  await expect(page.locator('#left-note')).toContainText('Rejoin');
  const back = await page.evaluate(() => {
    const re = document.getElementById('left-rejoin');
    const cl = document.getElementById('left-close');
    const rr = re.getBoundingClientRect();
    const cr = cl.getBoundingClientRect();
    const rs = getComputedStyle(re);
    const cs = getComputedStyle(cl);
    return {
      reBg: rs.backgroundColor, clBg: cs.backgroundColor, clBorder: cs.borderTopWidth,
      gap: Math.round(cr.left - rr.right),
      on: rr.left >= 0 && cr.right <= innerWidth && rr.bottom <= innerHeight && cr.bottom <= innerHeight,
    };
  });
  expect(back.reBg).toBe('rgb(0, 100, 200)');
  expect(back.clBg).toBe('rgb(255, 255, 255)');
  expect(back.reBg).not.toBe(back.clBg);
  expect(back.gap).toBeGreaterThanOrEqual(8);
  expect(back.on).toBe(true);
  await page.locator('#left-rejoin').click();
  await page.waitForSelector('#airbar.on.group');
  await expect(page.locator('#left-modal')).toBeHidden();
  await expect(page.locator('#airkind')).toHaveText('Small group');
  await page.goto('/run.html?desk=leavesvc#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airkind');
  await page.locator('#leavebtn').click();
  await expect(page.locator('#leave-ask')).toBeVisible();
  await expect(page.locator('#leave-ask-title')).toHaveText('Leave the service?');
  const ask = await page.evaluate(() => {
    const go = getComputedStyle(document.getElementById('leave-go'));
    const stay = getComputedStyle(document.getElementById('leave-cancel'));
    return { go: go.backgroundColor, stay: stay.backgroundColor };
  });
  expect(ask.go).toBe('rgb(182, 22, 34)');
  expect(ask.stay).not.toBe(ask.go);
  await page.locator('#leave-go').click();
  await expect(page.locator('#left-title')).toHaveText('You left the service');
});

test('the status line fits beside Fit', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
  });
  async function readStatus() {
    return page.evaluate(() => {
      const st = document.getElementById('status');
      const chip = document.querySelector('.topchip').getBoundingClientRect();
      const fit = document.getElementById('fitbtn').getBoundingClientRect();
      const ix = Math.max(0, Math.min(chip.right, fit.right) - Math.max(chip.left, fit.left));
      const iy = Math.max(0, Math.min(chip.bottom, fit.bottom) - Math.max(chip.top, fit.top));
      return {
        text: st.textContent,
        clip: st.scrollWidth > st.clientWidth + 1,
        hit: ix > 0 && iy > 0,
        on: chip.left >= -1 && chip.right <= innerWidth + 1 && fit.right <= innerWidth + 1,
      };
    });
  }
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=stat' + w + '#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (document.getElementById('status').textContent || '').indexOf('Just you') !== -1);
    const m = await readStatus();
    expect(m.text).toContain('Just you. Send the invite.');
    expect(m.text).not.toContain('no expiry');
    expect(m.clip, JSON.stringify(m)).toBe(false);
    expect(m.hit, JSON.stringify(m)).toBe(false);
    expect(m.on, JSON.stringify(m)).toBe(true);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setViewportSize({ width: 900, height: 720 });
  const resized = await readStatus();
  expect(resized.clip, JSON.stringify(resized)).toBe(false);
  expect(resized.hit, JSON.stringify(resized)).toBe(false);
});

test('a service alone says you are live or you are watching', async ({ page }) => {
  async function readStatus() {
    return page.evaluate(() => {
      const st = document.getElementById('status');
      const chip = document.querySelector('.topchip').getBoundingClientRect();
      const fit = document.getElementById('fitbtn').getBoundingClientRect();
      const ix = Math.max(0, Math.min(chip.right, fit.right) - Math.max(chip.left, fit.left));
      const iy = Math.max(0, Math.min(chip.bottom, fit.bottom) - Math.max(chip.top, fit.top));
      return {
        text: st.textContent,
        clip: st.scrollWidth > st.clientWidth + 1,
        hit: ix > 0 && iy > 0,
        on: chip.left >= -1 && chip.right <= innerWidth + 1 && fit.right <= innerWidth + 1,
      };
    });
  }
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('view=1') === -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=live' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (document.getElementById('status').textContent || '').indexOf('You are live') !== -1);
    const host = await readStatus();
    expect(host.text).toContain('You are live. Send the link.');
    expect(host.text).not.toContain('Just you');
    expect(host.clip, JSON.stringify(host)).toBe(false);
    expect(host.hit, JSON.stringify(host)).toBe(false);
    expect(host.on, JSON.stringify(host)).toBe(true);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setViewportSize({ width: 900, height: 720 });
  const resized = await readStatus();
  expect(resized.text).toContain('You are live. Send the link.');
  expect(resized.clip, JSON.stringify(resized)).toBe(false);
  expect(resized.hit, JSON.stringify(resized)).toBe(false);
  await page.goto('/run.html?desk=liveview&view=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (document.getElementById('status').textContent || '').indexOf('watching') !== -1);
  const viewer = await readStatus();
  expect(viewer.text).toContain('You are watching this service.');
  expect(viewer.text).not.toContain('Just you');
  expect(viewer.text).not.toContain('You are live');
  expect(viewer.clip, JSON.stringify(viewer)).toBe(false);
  expect(viewer.hit, JSON.stringify(viewer)).toBe(false);
});

test('a host alone on a service gets Invite beside the live sentence', async ({ page }) => {
  const SECRET = 'viewer-secret-99';
  await page.addInitScript((secret) => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('view=1') !== -1 || location.search.indexOf('group=1') !== -1) localStorage.removeItem(key);
    else localStorage.setItem(key, 'host-key');
    if (location.search.indexOf('view=1') === -1 && location.search.indexOf('group=1') === -1) {
      localStorage.setItem('gifos_vpw_sunday.0123456789abcdef', secret);
    }
  }, SECRET);
  async function place() {
    return page.evaluate(() => {
      const el = document.getElementById('hdrinvite');
      const st = document.getElementById('status');
      const chip = document.querySelector('.topchip');
      const b = el.getBoundingClientRect();
      const c = chip.getBoundingClientRect();
      const air = document.getElementById('onair').getBoundingClientRect();
      const overlap = (a, r) => a.width > 0 && r.width > 0 && !(a.right < r.left || r.right < a.left || a.bottom < r.top || r.bottom < a.top);
      const shown = getComputedStyle(el).display !== 'none' && !el.hidden;
      return {
        shown,
        h: shown ? b.height : 0,
        bg: shown ? getComputedStyle(el).backgroundColor : '',
        text: st.textContent,
        clip: st.scrollWidth > st.clientWidth + 1,
        invite: chip.dataset.invite || '',
        kind: st.dataset.kind || '',
        inChip: shown && b.left >= c.left - 1 && b.right <= c.right + 1 && b.top >= c.top - 1 && b.bottom <= c.bottom + 1,
        hitsLive: shown && overlap(b, air),
        on: c.left >= -1 && c.right <= innerWidth + 1 && b.right <= innerWidth + 1,
      };
    });
  }
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=inv' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#hdrinvite').waitFor({ state: 'visible' });
    const host = await place();
    expect(host.text).toContain('You are live. Send the link.');
    expect(host.text).not.toContain('Just you');
    expect(host.shown).toBe(true);
    expect(host.h).toBeGreaterThanOrEqual(44);
    expect(host.bg).toBe('rgb(0, 100, 200)');
    expect(host.invite).toBe('1');
    expect(host.kind).toBe('alone');
    expect(host.inChip, JSON.stringify(host)).toBe(true);
    expect(host.hitsLive, JSON.stringify(host)).toBe(false);
    expect(host.clip, JSON.stringify(host)).toBe(false);
    expect(host.on, JSON.stringify(host)).toBe(true);
  }
  const shared = await page.evaluate(async (secret) => {
    const input = document.getElementById('share-url');
    input.value = location.origin + '/run.html#v=sunday&av=0123456789abcdef&bc=1&pw=' + secret;
    let payload = null;
    let clip = '';
    navigator.share = (p) => { payload = p; return Promise.resolve(); };
    if (navigator.clipboard) navigator.clipboard.writeText = (t) => { clip = String(t); return Promise.resolve(); };
    document.getElementById('hdrinvite').click();
    navigator.share = undefined;
    document.getElementById('hdrinvite').click();
    return { payload, label: document.getElementById('hdrinvite').textContent, clip };
  }, SECRET);
  expect(shared.payload.url).toContain('sunday');
  expect(shared.payload.url).toContain('bc=1');
  expect(shared.payload.url).not.toContain(SECRET);
  expect(shared.payload.url).not.toContain('pw=');
  expect(shared.payload.text).not.toContain(SECRET);
  expect(shared.label).toBe('Copied');
  expect(shared.clip).toContain('sunday');
  expect(shared.clip).toContain('bc=1');
  expect(shared.clip).not.toContain(SECRET);
  expect(shared.clip).not.toContain('pw=');
  const n = await page.evaluate(() => window.__gifosVideo.markJoinedForTest('peer-ruth'));
  expect(n).toBeGreaterThan(1);
  await expect(page.locator('#hdrinvite')).toBeHidden();
  const after = await page.evaluate(() => document.querySelector('.topchip').dataset.invite || '');
  expect(after).toBe('');
  await page.goto('/run.html?desk=invview&view=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (document.getElementById('status').textContent || '').indexOf('watching') !== -1);
  await expect(page.locator('#hdrinvite')).toBeHidden();
  const viewerFlag = await page.evaluate(() => document.querySelector('.topchip').dataset.invite || '');
  expect(viewerFlag).toBe('');
  await page.goto('/run.html?desk=invgroup&group=1#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (document.getElementById('status').textContent || '').indexOf('Just you') !== -1);
  await expect(page.locator('#hdrinvite')).toBeHidden();
  const groupFlag = await page.evaluate(() => document.querySelector('.topchip').dataset.invite || '');
  expect(groupFlag).toBe('');
});

test('microphone and camera off are a line you cannot miss', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.hash.indexOf('bc=1') !== -1 && location.search.indexOf('view=1') === -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  async function readAv() {
    return page.evaluate(() => {
      const bar = document.getElementById('avstate');
      const air = document.getElementById('airbar').getBoundingClientRect();
      const r = bar.getBoundingClientRect();
      const dock = document.querySelector('.bar').getBoundingClientRect();
      const mic = document.getElementById('avmic');
      const cam = document.getElementById('avcam');
      const overlap = (a, b) => !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
      const s = getComputedStyle(bar);
      return {
        hidden: bar.hidden, text: (bar.textContent || '').replace(/\s+/g, ' ').trim(),
        mic: mic.hidden ? '' : mic.textContent, cam: cam.hidden ? '' : cam.textContent,
        bg: s.backgroundColor, fg: s.color, h: r.height, w: r.width,
        belowAir: r.top >= air.bottom - 1,
        dock: overlap(r, dock),
        onScreen: r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight,
      };
    });
  }
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=av' + w + '#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#avstate.on');
    const both = await readAv();
    expect(both.mic).toBe('Microphone off');
    expect(both.cam).toBe('Camera off');
    expect(both.bg).toBe('rgb(58, 16, 20)');
    expect(both.fg).toBe('rgb(255, 255, 255)');
    expect(both.h).toBeGreaterThanOrEqual(40);
    expect(both.w).toBeGreaterThanOrEqual(w - 2);
    expect(both.belowAir, JSON.stringify(both)).toBe(true);
    expect(both.dock, JSON.stringify(both)).toBe(false);
    expect(both.onScreen, JSON.stringify(both)).toBe(true);
  }
  await page.evaluate(() => window.__gifosRoomTrust.setDevices(false, true));
  await expect(page.locator('#avmic')).toBeHidden();
  await expect(page.locator('#avcam')).toHaveText('Camera off');
  await expect(page.locator('#avstate')).toBeVisible();
  await page.evaluate(() => window.__gifosRoomTrust.setDevices(true, false));
  await expect(page.locator('#avcam')).toBeHidden();
  await expect(page.locator('#avmic')).toHaveText('Microphone off');
  await page.evaluate(() => window.__gifosRoomTrust.setDevices(false, false));
  await expect(page.locator('#avstate')).toBeHidden();
  await page.goto('/run.html?desk=avhost#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#avstate.on');
  await expect(page.locator('#airkind')).toHaveText('Service · You are live');
  await expect(page.locator('#avmic')).toHaveText('Microphone off');
  await page.goto('/run.html?desk=avview&view=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#onair.watch');
  await expect(page.locator('#avstate')).toBeHidden();
});

test('a recording is a card everyone has to see', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.hash.indexOf('bc=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=recnote' + w + '#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.group');
    await page.evaluate(() => window.__gifosRoomTrust.setRecording(true));
    const card = page.locator('#rec-notice .appear-box');
    await expect(card).toBeVisible();
    await expect(page.locator('#rec-notice-title')).toHaveText('You are recording this small group');
    await expect(page.locator('#airrec')).toHaveText('Recording');
    const lay = await page.evaluate(() => {
      const box = document.querySelector('#rec-notice .appear-box').getBoundingClientRect();
      const ok = document.getElementById('rec-notice-ok').getBoundingClientRect();
      const s = getComputedStyle(document.getElementById('rec-notice-ok'));
      return {
        bg: s.backgroundColor,
        in: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight && ok.right <= innerWidth && ok.bottom <= innerHeight,
      };
    });
    expect(lay.bg).toBe('rgb(0, 100, 200)');
    expect(lay.in, JSON.stringify(lay)).toBe(true);
    await page.locator('#rec-notice-ok').click();
    await expect(page.locator('#rec-notice')).toHaveCount(0);
    await expect(page.locator('#airrec')).toHaveText('Recording');
  }
  await page.evaluate(() => window.__gifosRoomTrust.setRecording(false));
  await page.evaluate(() => window.__gifosRoomTrust.setPeerRecording('Jordan Lee', true));
  await expect(page.locator('#rec-notice-title')).toHaveText('Jordan Lee is recording this small group');
  await page.locator('#rec-notice-ok').click();
  await page.locator('#airrec').click();
  await expect(page.locator('#rec-options h3')).toHaveText('Record this small group');
  await expect(page.locator('#rec-options p').first()).toContainText('this small group is being recorded');
  await expect(page.locator('#ro-start')).toHaveClass(/appear-primary/);
  await expect(page.locator('#ro-cancel')).toHaveClass(/appear-secondary/);
  await page.locator('#ro-cancel').click();
  await page.goto('/run.html?desk=recnotesvc#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airkind');
  await page.evaluate(() => window.__gifosRoomTrust.setRecording(true));
  await expect(page.locator('#rec-notice-title')).toHaveText('You are recording this service');
});

test('sharing a personal call is the link and a blue Copy', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  async function sheet() {
    return page.evaluate(() => {
      const box = document.querySelector('#inv-modal .appear-box').getBoundingClientRect();
      const copy = getComputedStyle(document.getElementById('inv-copy'));
      const card = getComputedStyle(document.querySelector('#inv-modal .appear-box'));
      const link = document.querySelector('#inv-modal .inv-link');
      return {
        bg: card.backgroundColor,
        copyBg: copy.backgroundColor,
        gap: link ? parseFloat(getComputedStyle(link).gap) : 0,
        in: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
      };
    });
  }
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=inv' + w + '#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.group');
    await page.locator('#invite').click();
    await expect(page.locator('#inv-modal h3')).toHaveText('Share this small group');
    await expect(page.locator('#inv-modal')).toContainText('Send this link. Anyone who opens it joins you.');
    await expect(page.locator('#inv-modal')).not.toContainText(/troublemaker|blur|in charge|mute/i);
    await expect(page.locator('#inv-copy')).toHaveClass(/appear-primary/);
    await expect(page.locator('#inv-done')).toHaveClass(/appear-secondary/);
    await expect(page.locator('#inv-adm-pass')).toBeHidden();
    const lay = await sheet();
    expect(lay.bg).toBe('rgb(255, 255, 255)');
    expect(lay.copyBg).toBe('rgb(0, 100, 200)');
    expect(lay.gap).toBeGreaterThanOrEqual(8);
    expect(lay.in, JSON.stringify(lay)).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.setViewportSize({ width: 900, height: 720 });
  const resized = await sheet();
  expect(resized.in, JSON.stringify(resized)).toBe(true);
  await page.locator('#inv-mkadm').click();
  await expect(page.locator('#inv-adm-pass')).toBeVisible();
  await expect(page.locator('#inv-adm-go')).toHaveClass(/appear-primary/);
  await expect(page.locator('#inv-adm-back')).toHaveClass(/appear-secondary/);
  await expect(page.locator('#inv-copy')).toHaveClass(/appear-secondary/);
  const open = await sheet();
  expect(open.in, JSON.stringify(open)).toBe(true);
  const pair = await page.evaluate(() => {
    const a = document.getElementById('inv-adm-back').getBoundingClientRect();
    const b = document.getElementById('inv-adm-go').getBoundingClientRect();
    return Math.round(b.left - a.right);
  });
  expect(pair).toBeGreaterThanOrEqual(8);
  await page.locator('#inv-adm-back').click();
  await expect(page.locator('#inv-adm-pass')).toBeHidden();
  await expect(page.locator('#inv-copy')).toHaveClass(/appear-primary/);
  await page.goto('/run.html?desk=invsvc#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airkind');
  await page.locator('#invite').click();
  await expect(page.locator('#inv-modal h3')).toHaveText('Share this service');
  await expect(page.locator('#inv-modal')).toContainText('People who open it are watching');
  await expect(page.locator('#inv-modal')).not.toContainText(/troublemaker|blur|in charge/i);
  await expect(page.locator('#inv-mkadm')).toHaveCount(0);
  await expect(page.locator('#inv-copy')).toHaveClass(/appear-primary/);
  const svc = await sheet();
  expect(svc.bg).toBe('rgb(255, 255, 255)');
  expect(svc.in, JSON.stringify(svc)).toBe(true);
  await page.goto('/run.html?desk=invhost&host=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.live');
  await page.locator('#invite').click();
  await expect(page.locator('#inv-modal')).toContainText('The host password stays with you.');
});

test('captions and record stay readable when they are on', async ({ page }) => {
  async function readOn() {
    return page.evaluate(() => {
      const cc = document.getElementById('ccbtn');
      const rec = document.getElementById('recbtn');
      const sheet = document.getElementById('barmore').getBoundingClientRect();
      const look = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          text: (el.textContent || '').trim(),
          bg: s.backgroundColor,
          fg: s.color,
          clip: el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1,
          in: r.left >= sheet.left - 1 && r.right <= sheet.right + 1 && r.top >= sheet.top - 1 && r.bottom <= sheet.bottom + 1,
          onScreen: r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight,
        };
      };
      return { cc: look(cc), rec: look(rec), pressed: cc.getAttribute('aria-pressed') };
    });
  }
  // Captions and Record are the host's: a viewer has neither.
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    localStorage.setItem('gifos_vadm_sunday.0123456789abcdef', 'host-key');
  });
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=cap' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast.meet-session #mic .docklab');
    await page.locator('#bartoggle').click();
    await expect(page.locator('#barmore')).toBeVisible();
    await expect(page.locator('#ccbtn')).toHaveText('Captions');
    const off = await readOn();
    expect(off.cc.fg).toBe('rgb(29, 29, 31)');
    expect(off.cc.clip, JSON.stringify(off.cc)).toBe(true);
    expect(off.cc.in, JSON.stringify(off.cc)).toBe(true);
    await page.locator('#ccbtn').click();
    await expect(page.locator('#ccbtn')).toHaveClass(/on/);
    await page.evaluate(() => document.getElementById('recbtn').classList.add('on'));
    const on = await readOn();
    expect(on.cc.text).toBe('Captions');
    expect(on.cc.bg).toBe('rgb(0, 100, 200)');
    expect(on.cc.fg).toBe('rgb(255, 255, 255)');
    expect(on.rec.bg).toBe('rgb(0, 100, 200)');
    expect(on.rec.fg).toBe('rgb(255, 255, 255)');
    expect(on.pressed).toBe('true');
    expect(on.cc.clip, JSON.stringify(on.cc)).toBe(true);
    expect(on.cc.in, JSON.stringify(on.cc)).toBe(true);
    expect(on.cc.onScreen, JSON.stringify(on.cc)).toBe(true);
    expect(on.rec.clip, JSON.stringify(on.rec)).toBe(true);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setViewportSize({ width: 900, height: 720 });
  const resized = await readOn();
  expect(resized.cc.text).toBe('Captions');
  expect(resized.cc.fg).toBe('rgb(255, 255, 255)');
  expect(resized.cc.clip, JSON.stringify(resized.cc)).toBe(true);
  expect(resized.cc.onScreen, JSON.stringify(resized.cc)).toBe(true);
});

test('a service hides the row and the stadium, and a small group keeps the grid', async ({ page }) => {
  async function surfaces() {
    return page.evaluate(() => {
      const box = (id) => {
        const el = document.getElementById(id);
        const s = getComputedStyle(el);
        return { display: s.display };
      };
      return {
        grid: box('grid'),
        stadium: box('stadium'),
        tiles: document.querySelectorAll('.tile').length,
        rows: document.querySelectorAll('.rowtile').length,
        broadcast: document.body.classList.contains('broadcast'),
      };
    });
  }
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
  });
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=surf' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast');
    await expect(page.locator('#airkind')).toHaveText('Service · You are watching');
    const svc = await surfaces();
    expect(svc.broadcast).toBe(true);
    expect(svc.grid.display).toBe('none');
    expect(svc.stadium.display).toBe('none');
    expect(svc.tiles).toBe(0);
    expect(svc.rows).toBe(0);
    await page.goto('/run.html?desk=surfg' + w + '#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.group');
    const group = await surfaces();
    expect(group.broadcast).toBe(false);
    expect(group.grid.display).toBe('grid');
  }
});

test('share screen is on the small-group dock', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
  });
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=share' + w + '#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.group .bar, #airbar.on.group');
    await page.waitForSelector('.bar > #sharebtn');
    const share = page.locator('.bar > #sharebtn');
    await expect(share).toBeVisible();
    await expect(share.locator('.docklab')).toHaveText('Share');
    await expect(share).toHaveAttribute('aria-label', 'Share screen');
    const inside = await share.evaluate((el) => !!el.closest('#barmore'));
    expect(inside).toBe(false);
    const lay = await page.evaluate(() => {
      const btn = document.querySelector('.bar > #sharebtn');
      const lab = btn.querySelector('.docklab');
      const bar = document.querySelector('.bar').getBoundingClientRect();
      const r = btn.getBoundingClientRect();
      const lr = lab.getBoundingClientRect();
      return {
        clip: lab.scrollWidth <= lab.clientWidth + 1,
        inBtn: lr.left >= r.left - 1 && lr.right <= r.right + 1 && lr.bottom <= r.bottom + 1,
        barIn: bar.left >= -1 && bar.right <= innerWidth + 1 && bar.bottom <= innerHeight + 1,
      };
    });
    expect(lay.clip, JSON.stringify(lay)).toBe(true);
    expect(lay.inBtn, JSON.stringify(lay)).toBe(true);
    expect(lay.barIn, JSON.stringify(lay)).toBe(true);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setViewportSize({ width: 900, height: 720 });
  const resized = await page.evaluate(() => {
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const lab = document.querySelector('.bar > #sharebtn .docklab');
    return { text: lab.textContent, clip: lab.scrollWidth <= lab.clientWidth + 1, barIn: bar.right <= innerWidth + 1 };
  });
  expect(resized.text).toBe('Share');
  expect(resized.clip).toBe(true);
  expect(resized.barIn).toBe(true);
  await page.goto('/run.html?desk=sharesvc#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body.broadcast .bar');
  await expect(page.locator('.bar > #sharebtn')).toHaveCount(0);
  await page.locator('#bartoggle').click();
  const tucked = page.locator('#barmore #sharebtn');
  await expect(tucked).toBeVisible();
  await expect(tucked).toHaveText('Share screen');
});

test('a host shares the stage from the dock', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('view=1') === -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=hshare' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.bar > #sharebtn');
    const share = page.locator('.bar > #sharebtn');
    await expect(share).toBeVisible();
    await expect(share.locator('.docklab')).toHaveText('Share');
    await expect(share).toHaveAttribute('aria-label', 'Share screen');
    await expect(share).toHaveAttribute('title', 'Show the stage a window, a tab, or your desktop.');
    const inside = await share.evaluate((el) => !!el.closest('#barmore'));
    expect(inside).toBe(false);
    const lay = await page.evaluate(() => {
      const btn = document.querySelector('.bar > #sharebtn');
      const lab = btn.querySelector('.docklab');
      const bar = document.querySelector('.bar').getBoundingClientRect();
      const r = btn.getBoundingClientRect();
      const lr = lab.getBoundingClientRect();
      return {
        clip: lab.scrollWidth <= lab.clientWidth + 1,
        inBtn: lr.left >= r.left - 1 && lr.right <= r.right + 1 && lr.bottom <= r.bottom + 1,
        barIn: bar.left >= -1 && bar.right <= innerWidth + 1 && bar.bottom <= innerHeight + 1,
      };
    });
    expect(lay.clip, JSON.stringify(lay)).toBe(true);
    expect(lay.inBtn, JSON.stringify(lay)).toBe(true);
    expect(lay.barIn, JSON.stringify(lay)).toBe(true);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setViewportSize({ width: 900, height: 720 });
  const resized = await page.evaluate(() => {
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const lab = document.querySelector('.bar > #sharebtn .docklab');
    return { text: lab.textContent, clip: lab.scrollWidth <= lab.clientWidth + 1, barIn: bar.right <= innerWidth + 1 };
  });
  expect(resized.text).toBe('Share');
  expect(resized.clip).toBe(true);
  expect(resized.barIn).toBe(true);
});

test('settings names the stage on a service', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    localStorage.setItem('gifos_vadm_sunday.0123456789abcdef', 'host-key');
  });
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=setname' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#bartoggle').click();
    await page.locator('#setbtn').click();
    await expect(page.locator('#set-name-lead')).toHaveText('What everyone sees on the stage:');
    const lay = await page.evaluate(() => {
      const lead = document.getElementById('set-name-lead').getBoundingClientRect();
      const box = document.querySelector('#set-modal .name-box').getBoundingClientRect();
      return {
        lead: lead.top >= -1 && lead.bottom <= innerHeight + 1 && lead.left >= -1 && lead.right <= innerWidth + 1,
        box: box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1,
      };
    });
    expect(lay.lead, JSON.stringify(lay)).toBe(true);
    expect(lay.box, JSON.stringify(lay)).toBe(true);
  }
  await page.goto('/run.html?desk=setnamegroup#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.locator('#bartoggle').click();
  await page.locator('#setbtn').click();
  await expect(page.locator('#set-name-lead')).toHaveText('What everyone sees on your tile:');
});

test('settings on a service is not called a meeting', async ({ page }) => {
  const serviceTip = 'Service settings — the picture you send, and the name people see on the stage.';
  const meetingTip = 'Meeting settings — your sound mix, timing, and the video quality your camera records';
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    localStorage.setItem('gifos_vadm_sunday.0123456789abcdef', 'host-key');
  });
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=settip' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#bartoggle').click();
    const btn = page.locator('#setbtn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('title', serviceTip);
    const lay = await page.evaluate(() => {
      const r = document.getElementById('setbtn').getBoundingClientRect();
      const menu = document.getElementById('barmore').getBoundingClientRect();
      return { inMenu: r.top >= menu.top - 1 && r.bottom <= menu.bottom + 1 && r.left >= menu.left - 1 && r.right <= menu.right + 1, on: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1 };
    });
    expect(lay.inMenu, JSON.stringify(lay)).toBe(true);
    expect(lay.on, JSON.stringify(lay)).toBe(true);
  }
  await page.goto('/run.html?desk=settipgroup#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.locator('#bartoggle').click();
  await expect(page.locator('#setbtn')).toHaveAttribute('title', meetingTip);
});

test('a service chat pins a file to the service', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    localStorage.setItem('gifos_vadm_sunday.0123456789abcdef', 'host-key');
  });
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=pin' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#chatbtn').click();
    const pin = page.locator('#cattach');
    await expect(pin).toBeVisible();
    await expect(pin).toHaveAttribute('title', 'Pin a file to this service');
    const lay = await page.evaluate(() => {
      const r = document.getElementById('cattach').getBoundingClientRect();
      const form = document.getElementById('chatform').getBoundingClientRect();
      return { inForm: r.top >= form.top - 1 && r.bottom <= form.bottom + 1 && r.left >= form.left - 1, on: r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.left >= -1 };
    });
    expect(lay.inForm, JSON.stringify(lay)).toBe(true);
    expect(lay.on, JSON.stringify(lay)).toBe(true);
  }
  await page.goto('/run.html?desk=pingroup#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.locator('#chatbtn').click();
  await expect(page.locator('#cattach')).toHaveAttribute('title', 'Pin a file to the meeting');
});

test('run app and float talk about the service', async ({ page }) => {
  const appTip = 'Run an app on this service — everyone watching shares it and can use it.';
  const floatTip = 'Float the stage in a mini window. It stays on screen while you use other apps.';
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('view=1') === -1 && location.hash.indexOf('bc=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=appf' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#bartoggle').click();
    await expect(page.locator('#appbtn')).toHaveAttribute('title', appTip);
    await expect(page.locator('#pipbtn')).toHaveAttribute('title', floatTip);
    await expect(page.locator('#pipbtn')).toHaveAttribute('aria-label', 'Float the stage');
    await expect(page.locator('#app-title')).toHaveText('Run an app on this service');
    await expect(page.locator('#app-note')).toContainText('everyone watching');
    await expect(page.locator('#app-note')).toContainText('stage');
    const note = await page.locator('#app-note').innerText();
    expect(note.toLowerCase()).not.toContain('meeting');
    const lay = await page.evaluate(() => {
      const menu = document.getElementById('barmore').getBoundingClientRect();
      const app = document.getElementById('appbtn').getBoundingClientRect();
      const pip = document.getElementById('pipbtn').getBoundingClientRect();
      const inside = (r) => r.width > 0 && r.top >= menu.top - 1 && r.bottom <= menu.bottom + 1 && r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
      document.getElementById('app-modal').style.display = 'flex';
      const box = document.querySelector('#app-modal .name-box').getBoundingClientRect();
      const pipOn = getComputedStyle(document.getElementById('pipbtn')).display !== 'none';
      return {
        app: inside(app),
        pipOn,
        pip: !pipOn || inside(pip),
        card: box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1,
      };
    });
    expect(lay.app, JSON.stringify(lay)).toBe(true);
    expect(lay.pip, JSON.stringify(lay)).toBe(true);
    expect(lay.card, JSON.stringify(lay)).toBe(true);
  }
  await page.goto('/run.html?desk=appfview&view=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#appbtn')).toHaveAttribute('title', appTip);
  await expect(page.locator('#pipbtn')).toHaveAttribute('aria-label', 'Float the stage');
  await page.goto('/run.html?desk=appfgroup#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.locator('#bartoggle').click();
  await expect(page.locator('#appbtn')).toHaveAttribute('title', 'Run an app inside this meeting — everyone here shares and interacts with it live');
  await expect(page.locator('#pipbtn')).toHaveAttribute('aria-label', 'Float the meeting');
  await expect(page.locator('#app-title')).toHaveText('Run an app in this meeting');
});

test('a host steps on and off the stage from the dock', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('view=1') === -1 && location.hash.indexOf('bc=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=step' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.live');
    const step = page.locator('.bar > #stagebtn');
    await expect(step).toBeVisible();
    await expect(step.locator('.docklab')).toHaveText('Step on');
    await expect(step).toHaveAttribute('aria-label', 'Step on the stage');
    const lay = await page.evaluate(() => {
      const btn = document.querySelector('.bar > #stagebtn');
      const lab = btn.querySelector('.docklab');
      const bar = document.querySelector('.bar').getBoundingClientRect();
      const r = btn.getBoundingClientRect();
      const lr = lab.getBoundingClientRect();
      return {
        inMore: !!btn.closest('#barmore'),
        clip: lab.scrollWidth <= lab.clientWidth + 1,
        inBtn: lr.left >= r.left - 1 && lr.right <= r.right + 1 && lr.bottom <= r.bottom + 1,
        barIn: bar.left >= -1 && bar.right <= innerWidth + 1 && bar.bottom <= innerHeight + 1,
      };
    });
    expect(lay.inMore, JSON.stringify(lay)).toBe(false);
    expect(lay.clip, JSON.stringify(lay)).toBe(true);
    expect(lay.inBtn, JSON.stringify(lay)).toBe(true);
    expect(lay.barIn, JSON.stringify(lay)).toBe(true);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setViewportSize({ width: 900, height: 720 });
  const step = page.locator('.bar > #stagebtn');
  await expect(step.locator('.docklab')).toHaveText('Step on');
  const resized = await page.evaluate(() => document.querySelector('.bar').getBoundingClientRect().right <= innerWidth + 1);
  expect(resized).toBe(true);
  await step.click();
  await expect(step.locator('.docklab')).toHaveText('Step off');
  await expect(step).toHaveAttribute('aria-label', 'Step off the stage');
  const steppedOn = await step.evaluate((el) => el.classList.contains('on'));
  expect(steppedOn).toBe(true);
  const onAir = await page.evaluate(() => getComputedStyle(document.querySelector('.bar > #stagebtn')).backgroundColor);
  expect(onAir).toBe('rgb(182, 22, 34)');
  await expect(page.locator('#airkind')).toHaveText('Service · You are live');
  await step.click();
  await expect(step.locator('.docklab')).toHaveText('Step on');
  const steppedOff = await step.evaluate((el) => el.classList.contains('on'));
  expect(steppedOff).toBe(false);
  await page.goto('/run.html?desk=stepview&view=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.watch');
  await expect(page.locator('.bar > #stagebtn')).toHaveCount(0);
  await page.locator('#bartoggle').click();
  await expect(page.locator('#barmore #stagebtn')).toHaveText('Stage');
  await page.goto('/run.html?desk=stepmeet#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await expect(page.locator('.bar > #stagebtn')).toHaveCount(0);
  await page.locator('#bartoggle').click();
  await expect(page.locator('#barmore #stagebtn')).toHaveText('Stage');
});

test('a service picture fills the stage and a clear stage says so', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('view=1') === -1 && location.hash.indexOf('bc=1') !== -1 && location.hash.indexOf('v=sunday') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  async function place() {
    return page.evaluate(() => {
      const plate = document.getElementById('bc-stage');
      const line = document.getElementById('bc-stage-line');
      const air = document.getElementById('airbar').getBoundingClientRect();
      const dock = document.querySelector('.bar').getBoundingClientRect();
      const pr = plate.getBoundingClientRect();
      const shown = getComputedStyle(plate).display !== 'none';
      const tile = document.querySelector('#stagefeed .rowtile');
      const tr = tile ? tile.getBoundingClientRect() : null;
      return {
        text: line.textContent,
        shown,
        plateTop: pr.top,
        plateBottom: pr.bottom,
        airBottom: air.bottom,
        dockTop: dock.top,
        tile: tr && { top: tr.top, bottom: tr.bottom, left: tr.left, right: tr.right, w: tr.width, h: tr.height },
        vw: innerWidth,
        vh: innerHeight,
      };
    });
  }
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=pic' + w + '&view=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.watch');
    const empty = await place();
    expect(empty.text).toBe('The stage is clear.');
    expect(empty.shown).toBe(true);
    expect(empty.plateTop).toBeGreaterThanOrEqual(empty.airBottom - 1);
    expect(empty.plateBottom).toBeLessThanOrEqual(empty.dockTop + 1);
    await page.evaluate(() => {
      const feed = document.getElementById('stagefeed');
      const el = document.createElement('div');
      el.className = 'rowtile';
      el.dataset.row = 'sgs';
      const v = document.createElement('video');
      el.appendChild(v);
      feed.appendChild(el);
    });
    await page.waitForFunction(() => getComputedStyle(document.getElementById('bc-stage')).display === 'none');
    const full = await place();
    expect(full.shown).toBe(false);
    expect(full.tile.top).toBeGreaterThanOrEqual(full.airBottom - 1);
    expect(full.tile.bottom).toBeLessThanOrEqual(full.dockTop + 1);
    expect(full.tile.left).toBeGreaterThanOrEqual(-1);
    expect(full.tile.right).toBeLessThanOrEqual(w + 1);
    expect(full.tile.h).toBeGreaterThan(200);
    expect(full.tile.w).toBeGreaterThan(w * 0.8);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setViewportSize({ width: 900, height: 720 });
  const resized = await place();
  expect(resized.shown).toBe(false);
  expect(resized.tile.bottom).toBeLessThanOrEqual(resized.dockTop + 1);
  expect(resized.tile.right).toBeLessThanOrEqual(901);
  await page.goto('/run.html?desk=pichost#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.live');
  await expect(page.locator('#bc-stage-line')).toHaveText('The stage is clear.');
  await page.locator('.bar > #stagebtn').click();
  await expect(page.locator('#bc-stage-line')).toHaveText('You are on stage. Your camera is off.');
  const hostPlate = await place();
  expect(hostPlate.shown).toBe(true);
  expect(hostPlate.plateBottom).toBeLessThanOrEqual(hostPlate.dockTop + 1);
  await page.goto('/run.html?desk=picmeet#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  const meet = await page.locator('#bc-stage').evaluate((el) => getComputedStyle(el).display);
  expect(meet).toBe('none');
});

test('a viewer raises a hand from the dock', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=hand' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.watch');
    const hand = page.locator('.bar > #hand');
    await expect(hand).toBeVisible();
    await expect(hand.locator('.docklab')).toHaveText('Raise hand');
    await expect(hand).toHaveAttribute('aria-label', 'Raise hand');
    const lay = await page.evaluate(() => {
      const btn = document.querySelector('.bar > #hand');
      const lab = btn.querySelector('.docklab');
      const bar = document.querySelector('.bar').getBoundingClientRect();
      const r = btn.getBoundingClientRect();
      const lr = lab.getBoundingClientRect();
      return {
        inMore: !!btn.closest('#barmore'),
        clip: lab.scrollWidth <= lab.clientWidth + 1,
        inBtn: lr.left >= r.left - 1 && lr.right <= r.right + 1 && lr.bottom <= r.bottom + 1,
        barIn: bar.left >= -1 && bar.right <= innerWidth + 1 && bar.bottom <= innerHeight + 1,
      };
    });
    expect(lay.inMore, JSON.stringify(lay)).toBe(false);
    expect(lay.clip, JSON.stringify(lay)).toBe(true);
    expect(lay.inBtn, JSON.stringify(lay)).toBe(true);
    expect(lay.barIn, JSON.stringify(lay)).toBe(true);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setViewportSize({ width: 900, height: 720 });
  const hand = page.locator('.bar > #hand');
  const resized = await page.evaluate(() => document.querySelector('.bar').getBoundingClientRect().right <= innerWidth + 1);
  expect(resized).toBe(true);
  await hand.click();
  await expect(hand.locator('.docklab')).toHaveText('Lower hand');
  await expect(hand).toHaveAttribute('aria-pressed', 'true');
  const raised = await page.evaluate(() => getComputedStyle(document.querySelector('.bar > #hand')).backgroundColor);
  expect(raised).toBe('rgb(0, 100, 200)');
  await hand.click();
  await expect(hand.locator('.docklab')).toHaveText('Raise hand');
  await expect(hand).toHaveAttribute('aria-pressed', 'false');
  await page.goto('/run.html?desk=handhost&host=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.live');
  await expect(page.locator('.bar > #hand')).toHaveCount(0);
  await page.locator('#bartoggle').click();
  await expect(page.locator('#barmore #hand')).toHaveText('Hand');
  await page.goto('/run.html?desk=handmeet#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await expect(page.locator('.bar > #hand')).toHaveCount(0);
  await page.locator('#bartoggle').click();
  await expect(page.locator('#barmore #hand')).toHaveText('Hand');
});

test('a promoted viewer steps off from the dock', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    localStorage.removeItem('gifos_vadm_sunday.0123456789abcdef');
  });
  for (const w of [1280, 1920, 900]) {
    await page.setViewportSize({ width: w, height: w === 1920 ? 1080 : 720 });
    await page.goto('/run.html?desk=vstep' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.watch');
    await expect(page.locator('.bar > #stagebtn')).toHaveCount(0);
    await page.evaluate(() => window.__gifosVideo.setStageForTest(true));
    const step = page.locator('.bar > #stagebtn');
    await expect(step).toBeVisible();
    await expect(step.locator('.docklab')).toHaveText('Step off');
    await expect(step).toHaveAttribute('aria-label', 'Step off the stage');
    const on = await step.evaluate((el) => el.classList.contains('on'));
    expect(on).toBe(true);
    const lay = await page.evaluate(() => {
      const btn = document.querySelector('.bar > #stagebtn');
      const lab = btn.querySelector('.docklab');
      const bar = document.querySelector('.bar').getBoundingClientRect();
      const r = btn.getBoundingClientRect();
      const lr = lab.getBoundingClientRect();
      return {
        bg: getComputedStyle(btn).backgroundColor,
        clip: lab.scrollWidth <= lab.clientWidth + 1,
        inBtn: lr.left >= r.left - 1 && lr.right <= r.right + 1 && lr.bottom <= r.bottom + 1,
        barIn: bar.left >= -1 && bar.right <= innerWidth + 1 && bar.bottom <= innerHeight + 1,
      };
    });
    expect(lay.bg).toBe('rgb(182, 22, 34)');
    await expect(page.locator('#airkind')).toHaveText('Service · You are on stage');
    await expect(page.locator('#airbar')).toHaveClass(/live/);
    const air = await page.evaluate(() => {
      const bar = document.getElementById('airbar');
      const kind = document.getElementById('airkind');
      const rec = document.getElementById('airrec');
      const s = getComputedStyle(bar);
      const br = bar.getBoundingClientRect();
      const kr = kind.getBoundingClientRect();
      const rr = rec.getBoundingClientRect();
      const overlap = !(kr.right < rr.left || rr.right < kr.left || kr.bottom < rr.top || rr.bottom < kr.top);
      return { bg: s.backgroundColor, fg: s.color, overlap, full: br.width >= innerWidth - 2, inside: kr.left >= br.left - 1 && kr.right <= br.right + 1 && kr.top >= br.top - 1 && kr.bottom <= br.bottom + 1 };
    });
    expect(air.bg).toBe('rgb(182, 22, 34)');
    expect(air.fg).toBe('rgb(255, 255, 255)');
    expect(air.overlap, JSON.stringify(air)).toBe(false);
    expect(air.full, JSON.stringify(air)).toBe(true);
    expect(air.inside, JSON.stringify(air)).toBe(true);
    await expect(page.locator('#bc-stage-line')).toHaveText('You are on stage. Your camera is off.');
    await expect(page.locator('#status')).toContainText('You are on stage.');
    await expect(page.locator('#status')).not.toContainText('watching');
    await expect(page.locator('#onair')).toHaveText('On stage');
    await expect(page.locator('#onair')).toHaveClass(/live/);
    const chip = await page.evaluate(() => {
      const status = document.getElementById('status').getBoundingClientRect();
      const fit = document.getElementById('fitbtn').getBoundingClientRect();
      const pill = document.getElementById('onair').getBoundingClientRect();
      const overlap = (a, b) => !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
      return { statusFit: overlap(status, fit), pillStatus: overlap(pill, status) };
    });
    expect(chip.statusFit, JSON.stringify(chip)).toBe(false);
    expect(chip.pillStatus, JSON.stringify(chip)).toBe(false);
    const plateShown = await page.locator('#bc-stage').evaluate((el) => getComputedStyle(el).display !== 'none');
    expect(plateShown).toBe(true);
    expect(lay.clip, JSON.stringify(lay)).toBe(true);
    expect(lay.inBtn, JSON.stringify(lay)).toBe(true);
    expect(lay.barIn, JSON.stringify(lay)).toBe(true);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setViewportSize({ width: 900, height: 720 });
  const step = page.locator('.bar > #stagebtn');
  await expect(step.locator('.docklab')).toHaveText('Step off');
  const resized = await page.evaluate(() => document.querySelector('.bar').getBoundingClientRect().right <= innerWidth + 1);
  expect(resized).toBe(true);
  await step.click();
  await expect(page.locator('.bar > #stagebtn')).toHaveCount(0);
  await page.locator('#bartoggle').click();
  await expect(page.locator('#barmore #stagebtn')).toHaveText('Stage');
  await expect(page.locator('#bc-stage-line')).toHaveText('The stage is clear.');
  await expect(page.locator('#airkind')).toHaveText('Service · You are watching');
  await expect(page.locator('#airbar')).toHaveClass(/watch/);
  await expect(page.locator('#status')).toContainText('You are watching this service.');
  await expect(page.locator('#onair')).toHaveText('Watching');
});

test('a host ends the service and a viewer still leaves', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (new URLSearchParams(location.search).get('host') === '1') localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=endhost' + w + '&host=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast');
    const leave = page.locator('#leavebtn');
    await expect(leave.locator('.docklab')).toHaveText('End');
    await expect(leave).toHaveAttribute('aria-label', 'End the service');
    const tip = (await leave.getAttribute('title')).toLowerCase();
    expect(tip).toContain('everyone watching');
    expect(tip).not.toContain('meeting');
    const lay = await page.evaluate(() => {
      const btn = document.getElementById('leavebtn').getBoundingClientRect();
      const lab = document.querySelector('#leavebtn .docklab').getBoundingClientRect();
      const bar = document.querySelector('.bar').getBoundingClientRect();
      return {
        labIn: lab.width > 0 && lab.left >= btn.left - 1 && lab.right <= btn.right + 1 && lab.top >= btn.top - 1 && lab.bottom <= btn.bottom + 1,
        barIn: bar.left >= -1 && bar.right <= innerWidth + 1,
        on: btn.left >= -1 && btn.right <= innerWidth + 1 && btn.top >= -1 && btn.bottom <= innerHeight + 1,
      };
    });
    expect(lay.labIn, JSON.stringify(lay)).toBe(true);
    expect(lay.barIn, JSON.stringify(lay)).toBe(true);
    expect(lay.on, JSON.stringify(lay)).toBe(true);
    if (w === 1280) {
      await page.locator('#bartoggle').click();
      await page.locator('#helpbtn').click();
      await expect(page.locator('#help-modal .help-scroll')).toContainText('five-minute countdown');
      await page.locator('#help-close').click();
      await page.locator('#bartoggle').click();
    }
    await leave.click();
    const ask = page.locator('#leave-ask');
    await expect(ask).toBeVisible();
    await expect(page.locator('#leave-ask-title')).toHaveText('End the service?');
    await expect(page.locator('#leave-ask-note')).toBeVisible();
    await expect(page.locator('#leave-ask-note')).toContainText('five-minute countdown');
    await expect(page.locator('#leave-ask-note')).not.toContainText('meeting');
    await expect(page.locator('#leave-go')).toHaveText('End');
    await expect(page.locator('#leave-cancel')).toHaveText('Stay');
    const card = await page.evaluate(() => {
      const box = document.querySelector('#leave-ask .name-box').getBoundingClientRect();
      const note = document.getElementById('leave-ask-note').getBoundingClientRect();
      const go = document.getElementById('leave-go').getBoundingClientRect();
      return {
        on: box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1,
        noteIn: note.width > 0 && note.top >= box.top - 1 && note.bottom <= box.bottom + 1,
        goIn: go.top >= box.top - 1 && go.bottom <= box.bottom + 1 && go.right <= innerWidth + 1,
      };
    });
    expect(card.on, JSON.stringify(card)).toBe(true);
    expect(card.noteIn, JSON.stringify(card)).toBe(true);
    expect(card.goIn, JSON.stringify(card)).toBe(true);
    const colors = await page.evaluate(() => ({
      go: getComputedStyle(document.getElementById('leave-go')).backgroundColor,
      stay: getComputedStyle(document.getElementById('leave-cancel')).backgroundColor,
    }));
    expect(colors.go).toBe('rgb(182, 22, 34)');
    expect(colors.stay).not.toBe(colors.go);
    await page.locator('#leave-cancel').click();
    await expect(ask).toBeHidden();
  }
  await page.locator('#leavebtn').click();
  await page.locator('#leave-go').click();
  await expect(page.locator('#left-modal')).toBeVisible();
  await expect(page.locator('#left-title')).toHaveText('You ended the service');
  await expect(page.locator('#left-note')).toContainText('five-minute countdown');
  await expect(page.locator('#left-note')).toContainText('Rejoin');
  await page.goto('/run.html?desk=endview#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body.broadcast');
  await expect(page.locator('#leavebtn .docklab')).toHaveText('Leave');
  await expect(page.locator('#leavebtn')).toHaveAttribute('aria-label', 'Leave the service');
  await expect(page.locator('#leave-ask-note')).toBeHidden();
  await page.locator('#leavebtn').click();
  await expect(page.locator('#leave-ask-title')).toHaveText('Leave the service?');
  await expect(page.locator('#leave-go')).toHaveText('Leave');
  await expect(page.locator('#leave-ask-note')).toBeHidden();
  await page.locator('#leave-go').click();
  await expect(page.locator('#left-title')).toHaveText('You left the service');
});

test('a service recording captures the stage', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gifos_name', 'Avery Chen'));
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=recstage' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast');
    await page.locator('#airrec').click();
    await expect(page.locator('#rec-options h3')).toHaveText('Record this service');
    await expect(page.locator('#rec-stage-only')).toHaveText('Only the stage.');
    await expect(page.locator('#rec-options')).not.toContainText('my row');
    await expect(page.locator('#rec-options')).not.toContainText('stadium');
    await expect(page.locator('input[name=rec-scope]:visible')).toHaveCount(0);
    const card = await page.evaluate(() => {
      const box = document.querySelector('#rec-options .name-box').getBoundingClientRect();
      const start = document.getElementById('ro-start').getBoundingClientRect();
      return {
        on: box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1,
        startIn: start.top >= box.top - 1 && start.bottom <= box.bottom + 1 && start.right <= innerWidth + 1,
      };
    });
    expect(card.on, JSON.stringify(card)).toBe(true);
    expect(card.startIn, JSON.stringify(card)).toBe(true);
    if (w === 1280) {
      await page.locator('#ro-start').click();
      await expect(page.locator('#rec-options')).toBeVisible();
      await expect(page.locator('#rec-err')).toHaveText('No one is on the stage yet — nothing to record.');
    }
    await page.locator('#ro-cancel').click();
    await expect(page.locator('#rec-options')).toHaveCount(0);
  }
  await page.goto('/run.html?desk=recstagegroup#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await page.locator('#airrec').click();
  await expect(page.locator('#rec-options h3')).toHaveText('Record this small group');
  await expect(page.locator('#rec-options')).toContainText('Stage + my row');
  await expect(page.locator('#rec-options')).toContainText('Everything I see');
  await expect(page.locator('#rec-stage-only')).toHaveCount(0);
});

test('a service reaction shows on the stage', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gifos_name', 'Avery Chen'));
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=react' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast');
    await page.locator('#reactbtn').click();
    await page.locator('#reacttray button[aria-label="Clap"]').click();
    const burst = page.locator('#bc-react .reactburst');
    await expect(burst).toBeVisible();
    await expect(burst).toHaveText('👏');
    const lay = await page.evaluate(() => {
      const b = document.querySelector('#bc-react .reactburst').getBoundingClientRect();
      const dock = document.querySelector('.bar').getBoundingClientRect();
      const tray = document.getElementById('reacttray').getBoundingClientRect();
      const overlap = (a, c) => a.width > 0 && c.width > 0 && !(a.right < c.left || c.right < a.left || a.bottom < c.top || c.bottom < a.top);
      return {
        on: b.width > 20 && b.left >= -1 && b.right <= innerWidth + 1 && b.top >= -1 && b.bottom <= innerHeight + 1,
        dock: overlap(b, dock),
        tray: overlap(b, tray),
      };
    });
    expect(lay.on, JSON.stringify(lay)).toBe(true);
    expect(lay.dock, JSON.stringify(lay)).toBe(false);
    expect(lay.tray, JSON.stringify(lay)).toBe(false);
  }
  await page.goto('/run.html?desk=reactgroup#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await page.evaluate(() => {
    const tile = document.createElement('div');
    tile.className = 'tile me';
    document.getElementById('grid').appendChild(tile);
  });
  await page.locator('#reactbtn').click();
  await page.locator('#reacttray button[aria-label="Clap"]').click();
  await expect(page.locator('.tile.me .reactburst')).toHaveText('👏');
  const stageOn = await page.locator('#bc-react').evaluate((el) => getComputedStyle(el).display !== 'none');
  expect(stageOn).toBe(false);
});

test('float tells you when the stage has no picture', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    localStorage.setItem('gifos_vadm_sunday.0123456789abcdef', 'host-key');
  });
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=floate' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast');
    await page.locator('#bartoggle').click();
    const pipOn = await page.locator('#pipbtn').evaluate((el) => getComputedStyle(el).display !== 'none');
    if (pipOn) {
      const pip = page.locator('#pipbtn');
      const box = await pip.boundingBox();
      expect(box.width).toBeGreaterThan(20);
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(w + 1);
      expect(box.y).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height).toBeLessThanOrEqual(h + 1);
      await pip.click();
    } else {
      await page.evaluate(() => window.__gifosVideo.pipEnterForTest());
    }
    await expect(page.locator('#status')).toHaveText('Nothing on the stage to float yet.');
    const chip = await page.evaluate(() => {
      const st = document.getElementById('status');
      const r = st.getBoundingClientRect();
      return { clip: st.scrollWidth > st.clientWidth + 1, on: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 };
    });
    expect(chip.clip, JSON.stringify(chip)).toBe(false);
    expect(chip.on, JSON.stringify(chip)).toBe(true);
  }
  await page.goto('/run.html?desk=floategroup#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await page.waitForFunction(() => (document.getElementById('status').textContent || '').indexOf('Just you') !== -1);
  await page.evaluate(() => window.__gifosVideo.pipEnterForTest());
  await expect(page.locator('#status')).toContainText('Just you. Send the invite.');
  await expect(page.locator('#status')).not.toContainText('float');
});

test('a viewer clap reaches the stage as a count', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  async function pillLay() {
    return page.evaluate(() => {
      const host = document.getElementById('bc-reacts');
      const pills = Array.from(host.querySelectorAll('.bcreact')).map((el) => el.textContent);
      const dock = document.querySelector('.bar').getBoundingClientRect();
      const overlap = (a, b) => a.width > 0 && b.width > 0 && !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
      const boxes = Array.from(host.querySelectorAll('.bcreact')).map((el) => el.getBoundingClientRect());
      const on = boxes.every((b) => b.width > 20 && b.left >= -1 && b.right <= innerWidth + 1 && b.top >= -1 && b.bottom <= innerHeight + 1);
      const hitDock = boxes.some((b) => overlap(b, dock));
      return { pills, on, hitDock };
    });
  }
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=agg' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body.broadcast');
    await page.locator('#reactbtn').click();
    await page.locator('#reacttray button[aria-label="Clap"]').click();
    await expect(page.locator('#bc-reacts .bcreact')).toHaveText('👏 1');
    const one = await pillLay();
    expect(one.on, JSON.stringify(one)).toBe(true);
    expect(one.hitDock, JSON.stringify(one)).toBe(false);
    if (w === 1280) {
      await page.evaluate(() => {
        for (let i = 0; i < 11; i++) window.__gifosVideo.audienceReactForTest('👏', 'viewer-' + i);
        window.__gifosVideo.audienceReactForTest('👍', 'viewer-yes');
      });
      await expect(page.locator('#bc-reacts')).toContainText('👏 12');
      await expect(page.locator('#bc-reacts')).toContainText('👍 1');
      const added = await page.evaluate(() => {
        let n = 0;
        for (let i = 0; i < 8; i++) if (window.__gifosVideo.audienceReactForTest('😂', 'same-person')) n++;
        return n;
      });
      expect(added).toBe(6);
      await expect(page.locator('#bc-reacts')).toContainText('😂 6');
      const many = await pillLay();
      expect(many.on, JSON.stringify(many)).toBe(true);
      expect(many.hitDock, JSON.stringify(many)).toBe(false);
    }
  }
  await page.goto('/run.html?desk=agghost&host=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body.broadcast');
  await expect(page.locator('#airkind')).toHaveText('Service · You are live');
  await page.evaluate(() => {
    for (let i = 0; i < 12; i++) window.__gifosVideo.audienceReactForTest('👏', 'watch-' + i);
  });
  await expect(page.locator('#bc-reacts .bcreact')).toHaveText('👏 12');
  await expect(page.locator('#bc-react .reactburst')).toHaveCount(0);
  const hostLay = await pillLay();
  expect(hostLay.on, JSON.stringify(hostLay)).toBe(true);
  expect(hostLay.hitDock, JSON.stringify(hostLay)).toBe(false);
  await page.goto('/run.html?desk=agggroup#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await page.evaluate(() => {
    const tile = document.createElement('div');
    tile.className = 'tile me';
    document.getElementById('grid').appendChild(tile);
  });
  await page.locator('#reactbtn').click();
  await page.locator('#reacttray button[aria-label="Clap"]').click();
  await expect(page.locator('.tile.me .reactburst')).toHaveText('👏');
  const stageCount = await page.locator('#bc-reacts').evaluate((el) => !el.hidden && getComputedStyle(el).display !== 'none');
  expect(stageCount).toBe(false);
});

test('a service can mute the stage on this device', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  async function soundLay() {
    return page.evaluate(() => {
      const bar = document.getElementById('airbar').getBoundingClientRect();
      const btn = document.getElementById('airsound').getBoundingClientRect();
      const dock = document.querySelector('.bar').getBoundingClientRect();
      const overlap = (a, b) => a.width > 0 && b.width > 0 && !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
      const inside = btn.width > 20 && btn.left >= bar.left - 1 && btn.right <= bar.right + 1 && btn.top >= bar.top - 1 && btn.bottom <= bar.bottom + 1;
      const on = btn.left >= -1 && btn.right <= innerWidth + 1 && btn.top >= -1 && btn.bottom <= innerHeight + 1;
      return { inside, on, dock: overlap(btn, dock), w: Math.round(btn.width), h: Math.round(btn.height) };
    });
  }
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=sound' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.watch');
    const btn = page.locator('#airsound');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Sound on');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#airkind')).toHaveText('Service · You are watching');
    const lay = await soundLay();
    expect(lay.inside, JSON.stringify(lay)).toBe(true);
    expect(lay.on, JSON.stringify(lay)).toBe(true);
    expect(lay.dock, JSON.stringify(lay)).toBe(false);
    expect(lay.h).toBeGreaterThanOrEqual(36);
    if (w === 1280) {
      await page.evaluate(() => {
        const tile = document.createElement('div');
        tile.className = 'rowtile';
        const v = document.createElement('video');
        v.id = 'qa-stage-vid';
        tile.appendChild(v);
        document.getElementById('stagefeed').appendChild(tile);
        window.__gifosVideo.setMix('stage', 1);
      });
      const saved = await page.evaluate(() => localStorage.getItem('gifos_mix'));
      await btn.click();
      await expect(btn).toHaveText('Muted');
      await expect(btn).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#status')).toHaveText('The stage is muted on this device. Everyone else still hears it.');
      await expect(page.locator('#airkind')).toHaveText('Service · You are watching');
      const muted = await page.evaluate(() => {
        const v = document.getElementById('qa-stage-vid');
        return {
          level: window.__gifosVideo.stageHearLevelForTest(),
          mix: window.__gifosVideo.mix().stage,
          vol: v ? v.volume : null,
          stored: localStorage.getItem('gifos_mix'),
        };
      });
      expect(muted.level).toBe(0);
      expect(muted.mix).toBe(1);
      expect(muted.vol).toBe(0);
      expect(muted.stored).toBe(saved);
      const mutedLay = await soundLay();
      expect(mutedLay.inside, JSON.stringify(mutedLay)).toBe(true);
      expect(mutedLay.on, JSON.stringify(mutedLay)).toBe(true);
      expect(mutedLay.dock, JSON.stringify(mutedLay)).toBe(false);
      await btn.click();
      await expect(btn).toHaveText('Sound on');
      await expect(page.locator('#status')).toHaveText('You can hear the stage.');
      const back = await page.evaluate(() => {
        const v = document.getElementById('qa-stage-vid');
        return {
          level: window.__gifosVideo.stageHearLevelForTest(),
          vol: v ? v.volume : null,
        };
      });
      expect(back.level).toBe(1);
      expect(back.vol).toBe(1);
      await expect(page.locator('#mixpanel')).toBeHidden();
    }
  }
  await page.goto('/run.html?desk=soundhost&host=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.live');
  await expect(page.locator('#airkind')).toHaveText('Service · You are live');
  await expect(page.locator('#airsound')).toHaveText('Sound on');
  await page.locator('#airsound').click();
  await expect(page.locator('#airsound')).toHaveText('Muted');
  await expect(page.locator('#airkind')).toHaveText('Service · You are live');
  const hostLay = await soundLay();
  expect(hostLay.inside, JSON.stringify(hostLay)).toBe(true);
  expect(hostLay.dock, JSON.stringify(hostLay)).toBe(false);
  await page.goto('/run.html?desk=soundgroup#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await expect(page.locator('#airkind')).toHaveText('Small group');
  const groupSound = await page.locator('#airsound').evaluate((el) => el.hidden || getComputedStyle(el).display === 'none');
  expect(groupSound).toBe(true);
  await expect(page.locator('#mixpanel')).toBeAttached();
});

test('a service room bar counts the people watching, not the host', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  async function whoLay() {
    return page.evaluate(() => {
      const bar = document.getElementById('airbar').getBoundingClientRect();
      const who = document.getElementById('airwho').getBoundingClientRect();
      const dock = document.querySelector('.bar').getBoundingClientRect();
      const overlap = (a, b) => a.width > 0 && b.width > 0 && !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
      const inside = who.width > 20 && who.left >= bar.left - 1 && who.right <= bar.right + 1 && who.top >= bar.top - 1 && who.bottom <= bar.bottom + 1;
      const on = who.left >= -1 && who.right <= innerWidth + 1 && who.top >= -1 && who.bottom <= innerHeight + 1;
      return { inside, on, dock: overlap(who, dock) };
    });
  }
  const who = page.locator('#airwho');
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=watch' + w + '&host=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.live');
    await expect(page.locator('#airkind')).toHaveText('Service · You are live');
    await expect(who).toHaveText('0 watching');
    await expect(who).toHaveAttribute('title', 'Who is watching');
    await expect(who).toHaveAttribute('aria-label', 'Who is watching, 0');
    const lay = await whoLay();
    expect(lay.inside, JSON.stringify(lay)).toBe(true);
    expect(lay.on, JSON.stringify(lay)).toBe(true);
    expect(lay.dock, JSON.stringify(lay)).toBe(false);
    if (w === 1280) {
      await page.evaluate(() => window.__gifosVideo.headCountForTest(13));
      await expect(who).toHaveText('12 watching');
      await page.evaluate(() => window.__gifosVideo.headCountForTest(2));
      await expect(who).toHaveText('1 watching');
      await who.click();
      await expect(page.locator('#who-modal h3')).toHaveText('Who is watching');
      await page.locator('#who-close').click();
    }
  }
  await page.goto('/run.html?desk=watchviewer#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.watch');
  await expect(who).toHaveText('1 watching');
  await page.evaluate(() => window.__gifosVideo.headCountForTest(13));
  await expect(who).toHaveText('13 watching');
  await page.goto('/run.html?desk=watchgroup#mb=1&v=standup', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.group');
  await expect(who).toHaveText('1 here');
  await expect(who).toHaveAttribute('title', 'Who is here');
});

test('a viewer clap counts once on the host stage, however it arrives', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  await page.goto('/run.html?desk=clapview#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.watch');
  await page.locator('#reactbtn').click();
  await page.locator('#reacttray button[aria-label="Clap"]').click();
  await page.locator('#reacttray button[aria-label="Clap"]').click();
  await expect(page.locator('#bc-reacts .bcreact')).toHaveText('👏 2');
  const sent = await page.evaluate(() => window.__gifosVideo.sentFramesForTest().filter((m) => m.k === 'react'));
  expect(sent.length).toBe(2);
  expect(typeof sent[0].id, JSON.stringify(sent)).toBe('string');
  expect(sent[0].id.length).toBeGreaterThanOrEqual(8);
  expect(sent[0].id).not.toBe(sent[1].id);
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=claphost' + w + '&host=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.live');
    await page.evaluate((frames) => {
      // the direct copy and the mesh copy of the same two claps
      for (const m of frames) {
        window.__gifosVideo.remoteFrameForTest('viewer-a', m);
        window.__gifosVideo.remoteFrameForTest('viewer-a', m);
      }
    }, sent);
    await expect(page.locator('#bc-reacts .bcreact')).toHaveText('👏 2');
    await page.evaluate(() => {
      window.__gifosVideo.remoteFrameForTest('viewer-b', { k: 'react', e: '👏', id: 'clap-b-000001' });
      window.__gifosVideo.remoteFrameForTest('viewer-b', { k: 'react', e: '👏', id: 'clap-b-000001' });
      window.__gifosVideo.remoteFrameForTest('viewer-c', { k: 'react', e: '👍', id: 'clap-c-000001' });
    });
    await expect(page.locator('#bc-reacts')).toContainText('👏 3');
    await expect(page.locator('#bc-reacts')).toContainText('👍 1');
    const lay = await page.evaluate(() => {
      const dock = document.querySelector('.bar').getBoundingClientRect();
      const boxes = Array.from(document.querySelectorAll('#bc-reacts .bcreact')).map((el) => el.getBoundingClientRect());
      const overlap = (a, b) => !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
      return {
        on: boxes.every((b) => b.width > 20 && b.left >= -1 && b.right <= innerWidth + 1 && b.top >= -1 && b.bottom <= innerHeight + 1),
        dock: boxes.some((b) => overlap(b, dock)),
      };
    });
    expect(lay.on, JSON.stringify(lay)).toBe(true);
    expect(lay.dock, JSON.stringify(lay)).toBe(false);
  }
});

test('a viewer clap reaches the host the moment the link opens', async ({ page }) => {
  // The roster catches up on its own tick. A viewer can be linked to the host
  // and clap before the host is on the roster; that clap must still go out.
  // A real two-browser run of the same thing: test/e2e/cross-clap.js.
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.removeItem('gifos_vadm_sunday.0123456789abcdef');
  });
  await page.goto('/run.html?desk=clapearly#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.watch');
  await page.evaluate(() => window.__gifosVideo.openLinkForTest('host-early'));
  await page.locator('#reactbtn').click();
  await page.locator('#reacttray button[aria-label="Clap"]').click();
  await page.locator('#reacttray button[aria-label="Clap"]').click();
  await expect(page.locator('#bc-reacts .bcreact')).toHaveText('👏 2');
  const got = await page.evaluate(() => window.__gifosVideo.linkFramesForTest('host-early').filter((m) => m.k === 'react'));
  expect(got.length, JSON.stringify(got)).toBe(2);
  expect(got[0].e).toBe('👏');
  expect(got[0].id).not.toBe(got[1].id);
  expect(errors).toEqual([]);
});

test('a viewer sees who is on stage when their camera is off', async ({ page }) => {
  // Seen across two machines: the host went live with the camera off and the
  // viewer got a black square, the name burned into its foot and half under
  // the On stage label. The name card only came up for a profile picture.
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.removeItem('gifos_vadm_sunday.0123456789abcdef');
  });
  await page.goto('/run.html?desk=camoffstage#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.watch');
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'rowtile';
    el.dataset.row = 'sgs';
    el.appendChild(document.createElement('video'));
    document.getElementById('stagefeed').appendChild(el);
    window.__gifosVideo.camOffPeerForTest('host-dark', 'Pastor Kim');
  });
  const card = page.locator('#bc-ident');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Pastor Kim');
  await expect(card).toContainText('Camera off');
  const at = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    // what the card shows: the picture or initial, the name, the note
    const parts = Array.from(document.querySelectorAll('#bc-ident > *')).filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect());
    const card = { top: Math.min(...parts.map((b) => b.top)), bottom: Math.max(...parts.map((b) => b.bottom)) };
    return { card, air: r('#airbar'), dock: r('.bar'), tile: r('#stagefeed .rowtile'),
      video: getComputedStyle(document.querySelector('#stagefeed .rowtile video')).visibility,
      under: getComputedStyle(document.querySelector('#stagefeed .rowtile')).backgroundColor };
  });
  // The card sits on the stage, clear of the room bar and the dock.
  expect(at.card.top).toBeGreaterThanOrEqual(at.air.bottom - 1);
  expect(at.card.bottom).toBeLessThanOrEqual(at.dock.top + 1);
  expect(at.card.top).toBeGreaterThanOrEqual(at.tile.top - 1);
  expect(at.card.bottom).toBeLessThanOrEqual(at.tile.bottom + 1);
  // The black frame under it is not shown.
  expect(at.video).toBe('hidden');
  expect(at.under).toBe('rgb(0, 0, 0)');
  // A screen share with the camera off is a picture: it shows, no card.
  await page.evaluate(() => window.__gifosVideo.camOffPeerForTest('host-dark', 'Pastor Kim', true));
  await expect(card).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#stagefeed .rowtile video')).visibility)).toBe('visible');
  expect(errors).toEqual([]);
});

test('a viewer at the name card has no camera or mic on the dock', async ({ page }) => {
  // Seen across two machines: a viewer opening the link got red Video and
  // Unmute on the dock behind "This is how you'll appear", until they saved.
  // A viewer brings no camera; the host still has both.
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.removeItem('gifos_appear_ok');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  await page.goto('/run.html?desk=namecard#v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#appear-modal')).toBeVisible();
  await expect(page.locator('#appear-note')).toBeVisible();
  await expect(page.locator('.bar #cam')).toBeHidden();
  await expect(page.locator('.bar #mic')).toBeHidden();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForSelector('#airbar.on.watch');
  await expect(page.locator('.bar #cam')).toBeHidden();
  await expect(page.locator('.bar #mic')).toBeHidden();
  await page.goto('/run.html?desk=namecardhost&host=1#v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#appear-modal')).toBeVisible();
  await expect(page.locator('#appear-note')).toHaveCount(0);
  // The stored key here is a stand-in that fails its check once the room
  // joins, so read the host's dock at the card (cross-namecard.js joins a
  // real host).
  await expect(page.locator('.bar #cam')).toBeVisible();
  await expect(page.locator('.bar #mic')).toBeVisible();
});

test('a viewer at the name card is told they are joining, not watching', async ({ page }) => {
  // Seen across two machines: behind "This is how you'll appear" the viewer
  // read "You are watching this service. · reconnecting to the room…" and
  // "1 watching". They had not joined, nothing had dropped, and the one
  // counted was themselves.
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.removeItem('gifos_appear_ok');
    localStorage.removeItem('gifos_vadm_sunday.0123456789abcdef');
  });
  await page.goto('/run.html?desk=cardstatus#v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#appear-modal')).toBeVisible();
  await page.waitForSelector('#airbar.on.watch');
  const status = page.locator('#status');
  await expect(status).toHaveText('Joining the service…');
  await expect(page.locator('#airwho')).toBeHidden();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('#airwho')).toBeVisible();
  await expect(page.locator('#airwho')).toHaveText(/^\d+ watching$/);
});

test('a joined viewer is told they are watching, not the video quality', async ({ page }) => {
  // Seen across two machines: a viewer in a service with its host read
  // "2 in this service · 720p · a password unlocks clear video". A viewer
  // sends no video, so the quality and the password hint were host talk,
  // and the room bar already counts who is watching.
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    localStorage.setItem('gifos_meet_bar', '1');
    localStorage.removeItem('gifos_vadm_sunday.0123456789abcdef');
  });
  const status = page.locator('#status');
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=viewline' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.watch');
    await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.livePeerForTest);
    const n = await page.evaluate(() => window.__gifosVideo.livePeerForTest('hostpeer', 'Pastor Sam'));
    expect(n).toBe(2);
    await expect(status).toContainText('You are watching this service.');
    await expect(status).not.toContainText('in this service');
    await expect(status).not.toContainText('720p');
    await expect(status).not.toContainText(/\d+p\b/);
    await expect(status).not.toContainText('password');
    await expect(status).not.toContainText('clear video');
    const clip = await status.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clip).toBe(false);
  }
});

test('a live host with viewers is told they are live, not the meeting count', async ({ page }) => {
  // Seen across two machines: a host with one viewer read "2 in this
  // service · 720p · a password unlocks clear video" while the room bar said
  // "1 watching", and the host had just typed a password to go live. The
  // count was the meeting's, and "a password" did not say which one.
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Pastor Sam');
    localStorage.setItem('gifos_meet_bar', '1');
    localStorage.setItem('gifos_vadm_sunday.0123456789abcdef', 'host-key');
  });
  const status = page.locator('#status');
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=hostline' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.live');
    await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.livePeerForTest);
    const n = await page.evaluate(() => window.__gifosVideo.livePeerForTest('viewerpeer', 'Jordan Lee'));
    expect(n).toBe(2);
    if (w === 1280) { await page.waitForTimeout(500); await page.screenshot({ path: 'artifacts/host-line-' + (process.env.SHOT_TAG || 'run') + '.png' }); }
    await expect(status).toHaveText(/^You are live · \d+p\b/);
    await expect(status).toContainText('blurred until you set a viewer password');
    await expect(status).not.toContainText('in this service');
    await expect(status).not.toContainText('a password unlocks');
  }
});

test('a live host reads the whole status line at desktop widths', async ({ page }) => {
  // Seen at 1024 and 900: "You are live · 720p · reconnecting to the room…
  // · blurred until you set a viewer password" ended in "blurred until y…",
  // so the one thing the host could act on, the viewer password, was cut.
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Pastor Sam');
    localStorage.setItem('gifos_meet_bar', '1');
    localStorage.setItem('gifos_vadm_sunday.0123456789abcdef', 'host-key');
  });
  const status = page.locator('#status');
  for (const [w, h] of [[900, 720], [1024, 720], [1280, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=hostfit' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.live');
    await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.livePeerForTest);
    await page.evaluate(() => window.__gifosVideo.livePeerForTest('viewerpeer', 'Jordan Lee'));
    await expect(status).toContainText('blurred until you set a viewer password');
    if (w === 900) { await page.waitForTimeout(500); await page.screenshot({ path: 'artifacts/host-fit-' + (process.env.SHOT_TAG || 'run') + '.png' }); }
    const fit = await status.evaluate((el) => {
      const chip = el.closest('.topchip').getBoundingClientRect();
      const bar = document.getElementById('airbar').getBoundingClientRect();
      return { w: el.scrollWidth <= el.clientWidth + 1, h: el.scrollHeight <= el.clientHeight + 1,
        clearOfBar: chip.bottom <= bar.top, inView: chip.right <= innerWidth };
    });
    expect({ width: w, ...fit }).toEqual({ width: w, w: true, h: true, clearOfBar: true, inView: true });
  }
});

test('the stage label is readable on the dark stage', async ({ page }) => {
  // Seen across two machines: the host's stage read "On stage" in near-black
  // on the stage's black band at its foot, too small and too dark to read.
  // The band is always dark, so the words on it must be light.
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Pastor Sam');
    localStorage.setItem('gifos_meet_bar', '1');
    localStorage.setItem('gifos_vadm_sunday.0123456789abcdef', 'host-key');
  });
  for (const [w, h] of [[1280, 720], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=stagelabel' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.live');
    const got = await page.evaluate(() => {
      // the same tile paintStageStrip builds
      const el = document.createElement('div'); el.className = 'rowtile'; el.dataset.row = 'sgs';
      el.appendChild(document.createElement('video'));
      const lb = document.createElement('div'); lb.className = 'rlabel'; lb.textContent = 'On stage';
      el.appendChild(lb);
      document.getElementById('stagefeed').appendChild(el);
      const s = getComputedStyle(lb);
      const rgba = (c) => (c.match(/[\d.]+/g) || []).map(Number);
      const [r, g, b] = rgba(s.color);
      const [br, bg, bb, ba = 1] = rgba(s.backgroundColor);
      // the band over the black video
      const under = [br * ba, bg * ba, bb * ba];
      const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const a = lum([r, g, b]), z = lum(under);
      return { contrast: Math.round(((Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05)) * 10) / 10, px: parseFloat(s.fontSize) };
    });
    if (w === 1280) { await page.waitForTimeout(300); await page.screenshot({ path: 'artifacts/stage-label-' + (process.env.SHOT_TAG || 'run') + '.png' }); }
    expect({ width: w, readable: got.contrast >= 4.5, big: got.px >= 12, ...got }).toMatchObject({ width: w, readable: true, big: true });
  }
});

test('the Chat icon on the dock is as large as its neighbours', async ({ page }) => {
  // Seen across two machines: on the host's and the viewer's dock the Chat
  // speech bubble was 13px, where Invite, Full screen and More are 28px.
  // Chat (and prayer requests) is the one dock button a congregation uses
  // most, and it read as a dot.
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appear_ok', '1');
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem('gifos_vadm_sunday.0123456789abcdef', 'host-key');
    else localStorage.removeItem('gifos_vadm_sunday.0123456789abcdef');
  });
  for (const [who, q, w, h] of [['viewer', '', 1280, 720], ['viewer', '', 1920, 1080], ['host', '&host=1', 1280, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=chaticon' + who + w + q + '#v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on');
    await expect(page.locator('.bar #chatbtn')).toBeVisible();
    const size = (sel) => page.locator(sel).evaluate((el) => Math.round(el.getBoundingClientRect().width));
    const chat = await size('.bar #chatbtn svg');
    const invite = await size('.bar #invite svg');
    if (who === 'viewer' && w === 1280) { await page.screenshot({ path: 'artifacts/chat-icon-' + (process.env.SHOT_TAG || 'run') + '.png' }); }
    expect({ who, width: w, chat }).toEqual({ who, width: w, chat: invite });
  }
});

test('a clap on the stage names who clapped', async ({ page }) => {
  // The stage pill was only a count: a host saw 👏 4 and not who. The names
  // are the people the room already lists in Who is watching.
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  const who = page.locator('#bc-reacts .bcwho');
  async function lay() {
    return page.evaluate(() => {
      const dock = document.querySelector('.bar').getBoundingClientRect();
      const overlap = (a, b) => !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
      const els = Array.from(document.querySelectorAll('#bc-reacts .bcreact, #bc-reacts .bcwho'));
      const boxes = els.map((el) => el.getBoundingClientRect());
      const w = document.querySelector('#bc-reacts .bcwho');
      const cs = w && getComputedStyle(w);
      return {
        on: boxes.length > 0 && boxes.every((b) => b.width > 20 && b.left >= -1 && b.right <= innerWidth + 1 && b.top >= -1 && b.bottom <= innerHeight + 1),
        dock: boxes.some((b) => overlap(b, dock)),
        px: cs ? parseFloat(cs.fontSize) : 0,
        color: cs ? cs.color : '',
      };
    });
  }
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=clapwho' + w + '&host=1#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.live');
    await page.evaluate(() => {
      const v = window.__gifosVideo;
      v.livePeerForTest('viewer-a', 'Ruth Okafor');
      v.livePeerForTest('viewer-b', 'Sam Lee');
      v.livePeerForTest('viewer-c', 'Jo Park');
      v.livePeerForTest('viewer-d', 'Dee');
      v.remoteFrameForTest('viewer-a', { k: 'react', e: '👏', id: 'who-a-' + Date.now() });
      v.remoteFrameForTest('viewer-b', { k: 'react', e: '👏', id: 'who-b-' + Date.now() });
    });
    await expect(page.locator('#bc-reacts .bcreact')).toHaveText('👏 2');
    await expect(who).toHaveText('Sam Lee, Ruth Okafor');
    await expect(page.locator('#bc-reacts .bcreact')).toHaveAttribute('aria-label', '2 claps from Sam Lee and Ruth Okafor');
    await page.evaluate(() => {
      const v = window.__gifosVideo;
      v.remoteFrameForTest('viewer-c', { k: 'react', e: '👏', id: 'who-c-' + Date.now() });
      v.remoteFrameForTest('viewer-d', { k: 'react', e: '👏', id: 'who-d-' + Date.now() });
      v.remoteFrameForTest('viewer-d', { k: 'react', e: '👏', id: 'who-d2-' + Date.now() });
    });
    await expect(page.locator('#bc-reacts .bcreact')).toHaveText('👏 5');
    // one name per person, the latest first
    await expect(who).toHaveText('Dee, Jo Park +2');
    const l = await lay();
    expect(l.on, JSON.stringify(l)).toBe(true);
    expect(l.dock, JSON.stringify(l)).toBe(false);
    expect(l.px, JSON.stringify(l)).toBeGreaterThanOrEqual(14);
    expect(l.color, JSON.stringify(l)).toBe('rgb(255, 255, 255)');
  }
  // A viewer's own clap reads You.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/run.html?desk=clapwhoview#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#airbar.on.watch');
  await page.locator('#reactbtn').click();
  await page.locator('#reacttray button[aria-label="Clap"]').click();
  await expect(page.locator('#bc-reacts .bcreact')).toHaveText('👏 1');
  await expect(who).toHaveText('You');
  expect(errors).toEqual([]);
});

test('a joined viewer reads who is live, not watching three times', async ({ page }) => {
  // Seen across two machines: a viewer's header read "WATCHING · You are
  // watching this service." beside "Service · You are watching". The badge
  // and the room bar already say watching; the line now names the host.
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    localStorage.setItem('gifos_meet_bar', '1');
    localStorage.removeItem('gifos_vadm_sunday.0123456789abcdef');
  });
  const status = page.locator('#status');
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/run.html?desk=whoislive' + w + '#mb=1&v=sunday&av=0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on.watch');
    await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.livePeerForTest);
    await page.evaluate(() => {
      const v = window.__gifosVideo;
      v.livePeerForTest('viewer-b', 'Sam Lee');
      v.livePeerForTest('hostpeer', 'Pastor Sam');
      if (v.hostPeerForTest) v.hostPeerForTest('hostpeer');
    });
    await expect(page.locator('#onair')).toHaveText('Watching');
    await expect(page.locator('#airkind')).toHaveText('Service · You are watching');
    // The host is not watching: this viewer and Sam Lee are.
    await expect(page.locator('#airwho')).toHaveText('2 watching');
    if (w === 1280) { await page.waitForTimeout(300); await page.screenshot({ path: 'artifacts/who-live-' + (process.env.SHOT_TAG || 'run') + '.png' }); }
    await expect(status).toHaveText(/^Pastor Sam is live\./);
    await expect(status).not.toContainText('watching');
    await expect(status).not.toContainText('Sam Lee');
    const clip = await status.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clip).toBe(false);
  }
});

test('the lobby preview says you join muted with the camera off', async ({ page }) => {
  // The preview shows your camera live, but a call opens muted with the
  // camera off, and the card said "Turn the camera on here" with no control
  // here. A service's list also said Broadcasts.
  await page.addInitScript(() => { localStorage.setItem('gifos_name', 'Avery Chen'); });
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    for (const bc of [false, true]) {
      await page.setViewportSize({ width: w, height: h });
      // A distinct query per boot: a hash-only change would not re-run boot.
      await page.goto('/run.html?desk=lobnote' + w + (bc ? 's#bc=1' : 'g'));
      await page.waitForSelector('#lobby.show');
      if (w === 1280) { await page.waitForTimeout(300); await page.screenshot({ path: 'artifacts/lobby-note-' + (bc ? 'service-' : 'group-') + (process.env.SHOT_TAG || 'run') + '.png' }); }
      const note = page.locator('#lob-preview .lob-pv-note');
      await expect(note).toBeVisible();
      await expect(note).toHaveText('You join muted, with the camera off');
      await expect(page.locator('#lobby .lob-quiet')).not.toContainText(/on here/);
      const box = await page.evaluate(() => {
        const r = (id) => document.querySelector(id).getBoundingClientRect();
        const pv = r('#lob-preview'), n = r('#lob-preview .lob-pv-note'), nm = r('#lob-preview-name');
        const apart = n.bottom <= nm.top || n.top >= nm.bottom || n.right <= nm.left || n.left >= nm.right;
        return { inside: n.left >= pv.left && n.right <= pv.right && n.top >= pv.top && n.bottom <= pv.bottom, apart };
      });
      expect(box.inside).toBe(true);
      expect(box.apart).toBe(true);
      if (bc) await expect(page.locator('#lob-empty')).toHaveText('Services you start or watch show up here.');
      else await expect(page.locator('#lob-empty')).toHaveText('Calls you start or join show up here.');
    }
  }
});

test('Escape closes the chat panel and returns to the Chat button', async ({ page }) => {
  // Chat stayed open on Escape: the first press folded More, the next did
  // nothing, and the panel kept covering the right of the stage. Meet and
  // Zoom close a side panel on Escape.
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  const panel = page.locator('#chatpanel');
  for (const [w, h] of [[1280, 720], [1920, 1080], [900, 720]]) {
    for (const who of ['host', 'view', 'group']) {
      await page.setViewportSize({ width: w, height: h });
      const url = who === 'group'
        ? '/run.html?desk=chatesc' + w + 'g#mb=1&v=sunday&av=0123456789abcdef'
        : '/run.html?desk=chatesc' + w + who + (who === 'host' ? '&host=1' : '') + '#mb=1&v=sunday&av=0123456789abcdef&bc=1';
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#airbar.on');
      await page.locator('#chatbtn').click();
      await expect(panel).toHaveClass(/open/);
      await page.locator('#chat-in').focus();
      if (w === 1280 && who === 'host') await page.screenshot({ path: 'artifacts/chat-esc-open-' + (process.env.SHOT_TAG || 'run') + '.png' });
      await page.keyboard.press('Escape');
      await expect(panel).not.toHaveClass(/open/);
      if (w === 1280 && who === 'host') { await page.waitForTimeout(300); await page.screenshot({ path: 'artifacts/chat-esc-' + (process.env.SHOT_TAG || 'run') + '.png' }); }
      await expect(page.locator('#chatbtn')).toBeFocused();
      await expect(page.locator('#chatbtn')).toHaveAttribute('aria-expanded', 'false');
      // A sheet over the chat closes first, and the chat stays.
      await page.locator('#chatbtn').click();
      await expect(panel).toHaveClass(/open/);
      await expect(page.locator('#chatbtn')).toHaveAttribute('aria-expanded', 'true');
      await page.locator('#invite').click();
      const sheet = page.locator('.name-modal:visible, #invite-modal:visible').first();
      await expect(sheet).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      await expect(panel).toHaveClass(/open/);
    }
  }
});

test('the chat close and attach buttons have names, and closing returns to Chat', async ({ page }) => {
  // The chat's close button read only "✕" and the attach button "📎" to a
  // screen reader, and pressing the close button dropped the keyboard on
  // the page body instead of Chat.
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  const panel = page.locator('#chatpanel');
  for (const [w, h] of [[1280, 720], [900, 720]]) {
    for (const who of ['host', 'view', 'group']) {
      await page.setViewportSize({ width: w, height: h });
      const url = who === 'group'
        ? '/run.html?desk=chatname' + w + 'g#mb=1&v=sunday&av=0123456789abcdef'
        : '/run.html?desk=chatname' + w + who + (who === 'host' ? '&host=1' : '') + '#mb=1&v=sunday&av=0123456789abcdef&bc=1';
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#airbar.on');
      await page.locator('#chatbtn').click();
      await expect(panel).toHaveClass(/open/);
      if (w === 1280 && who === 'host') await page.screenshot({ path: 'artifacts/chat-names-' + (process.env.SHOT_TAG || 'run') + '.png' });
      await expect(page.locator('#chatclose')).toHaveAccessibleName('Close chat');
      await expect(page.locator('#cattach')).toHaveAccessibleName(who === 'group' ? 'Pin a file to the meeting' : 'Pin a file to this service');
      await page.locator('#chatclose').focus();
      await page.keyboard.press('Enter');
      await expect(panel).not.toHaveClass(/open/);
      await expect(page.locator('#chatbtn')).toBeFocused();
    }
  }
});

test('the Tab walk in a session stops only on controls you can see', async ({ page }) => {
  // After the room bar, Tab walked through eight off-screen links meant for
  // AI agents (llms.txt, sitemap, …): a 1px clipped box with no visible
  // focus, on a service host, a viewer and a small group.
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  for (const who of ['host', 'view', 'group']) {
    await page.setViewportSize({ width: 1280, height: 720 });
    const url = who === 'group'
      ? '/run.html?desk=tabwalkg#mb=1&v=sunday&av=0123456789abcdef'
      : '/run.html?desk=tabwalk' + who + (who === 'host' ? '&host=1' : '') + '#mb=1&v=sunday&av=0123456789abcdef&bc=1';
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const hidden = [];
    let dock = 0;
    let afterBar = 0;
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body) return null;
        const r = e.getBoundingClientRect();
        // A clipped 1px box still reports a rect, so ask what is drawn at
        // the stop's centre.
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const hit = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && document.elementFromPoint(x, y);
        const seen = !!hit && (e === hit || e.contains(hit));
        return { id: e.id, name: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30), seen };
      });
      if (!stop) continue;
      if (stop.id === 'chatbtn') dock++;
      if (!stop.seen) hidden.push(stop.name);
      // Shoot the stop after the room bar's last button.
      if (who === 'host' && afterBar === 1) await page.screenshot({ path: 'artifacts/tab-walk-' + (process.env.SHOT_TAG || 'run') + '.png' });
      if (stop.id === 'airsound' || afterBar) afterBar++;
    }
    expect(dock, who + ': the walk reaches the dock').toBeGreaterThan(0);
    expect(hidden, who + ': unseen Tab stops').toEqual([]);
  }
});

test('Tab reaches the room bar before the dock, top to bottom', async ({ page }) => {
  // The room bar sits above the stage and the dock below it, but Tab ran
  // the whole dock first and reached the room bar last, on a service host,
  // a viewer and a small group.
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Avery Chen');
    localStorage.setItem('gifos_meet_bar', '1');
    const key = 'gifos_vadm_sunday.0123456789abcdef';
    if (location.search.indexOf('host=1') !== -1) localStorage.setItem(key, 'host-key');
    else localStorage.removeItem(key);
  });
  for (const who of ['host', 'view', 'group']) {
    await page.setViewportSize({ width: 1280, height: 720 });
    const url = who === 'group'
      ? '/run.html?desk=taborderg#mb=1&v=sunday&av=0123456789abcdef'
      : '/run.html?desk=taborder' + who + (who === 'host' ? '&host=1' : '') + '#mb=1&v=sunday&av=0123456789abcdef&bc=1';
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#airbar.on');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const ids = [];
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press('Tab');
      ids.push(await page.evaluate(() => document.activeElement ? document.activeElement.id : ''));
    }
    if (who === 'host') await page.screenshot({ path: 'artifacts/tab-order-' + (process.env.SHOT_TAG || 'run') + '.png' });
    const rec = ids.indexOf('airrec'), dock = ids.indexOf('bargrip');
    expect(rec, who + ': Tab reaches the room bar (' + ids.join(' ') + ')').toBeGreaterThan(-1);
    expect(dock, who + ': Tab reaches the dock (' + ids.join(' ') + ')').toBeGreaterThan(-1);
    expect(rec, who + ': the room bar comes before the dock (' + ids.join(' ') + ')').toBeLessThan(dock);
  }
});
