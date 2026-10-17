import { test, expect } from '@playwright/test';

// Q74. A deaf member of the church, or of the town hall, follows the
// service by reading it. The host's phone writes down what it hears (CC in
// More). Every viewer reads those words on the picture, above the dock, and
// CC on the picture hides them or brings them back.

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['camera', 'microphone'] });

const LINE = 'Grace and peace to you from God our Father';

async function capBox(page) {
  return page.evaluate((line) => {
    const hits = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && e.textContent.includes(line));
    const shown = hits.filter((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return e.getClientRects().length && r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.5
        && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    });
    if (!shown.length) return null;
    const e = shown[0];
    const r = e.getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const visit = document.getElementById('bc-visit');
    const g = visit && !visit.hidden ? visit.getBoundingClientRect() : null;
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, font: parseFloat(getComputedStyle(e).fontSize), barY: bar.y,
      visitHit: !!(g && r.left < g.right && g.left < r.right && r.top < g.bottom && g.top < r.bottom) };
  }, LINE);
}

test('a viewer reads the host\'s words on the picture, and CC hides them', async ({ browser }, info) => {
  test.setTimeout(120000);
  const opts = info.project.use;
  const ctxH = await browser.newContext({ ...opts, permissions: ['camera', 'microphone'] });
  const ctxV = await browser.newContext({ ...opts });
  try {
    const h = await ctxH.newPage();
    await h.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
    await h.locator('#lob-admin-go').click();
    await expect(h.locator('#livebadge-txt')).toHaveText('LIVE', { timeout: 20000 });
    // The host finds captions in More, and the words say viewers read them.
    await h.locator('#bartoggle').click();
    const cc = h.locator('#ccbtn');
    await expect(cc).toBeVisible();
    expect(((await cc.getAttribute('title')) || '') + ' ' + (await cc.textContent())).toMatch(/viewers/i);
    // Visit rides the picture too; the words stay clear of it.
    await h.locator('#bcvisit').fill('https://example.com/');
    await h.locator('#bcvisit').dispatchEvent('change');
    const link = await h.evaluate(() => {
      let p = null;
      navigator.share = (x) => { p = x; return Promise.resolve(); };
      window.__gifosVideo.shareInvite();
      return p.url;
    });

    const v = await ctxV.newPage();
    await v.goto('/run.html' + new URL(link).hash, { waitUntil: 'domcontentloaded' });
    await v.locator('#nmok').click();
    await v.waitForFunction(() => !!document.querySelector('#stagefeed .rowtile'), null, { timeout: 45000 });
    await expect(v.locator('#bc-ended')).toBeHidden({ timeout: 15000 });

    // The host's phone writes a sentence down; the viewer reads it.
    await h.evaluate((t) => window.__gifosVideo.addTranscript(t), LINE);
    await v.waitForFunction((t) => window.__gifosVideo.transcriptTexts().some((l) => l.includes(t)), LINE, { timeout: 20000 });
    if (process.env.SHOTS) { await v.waitForTimeout(500); await v.screenshot({ path: process.env.SHOTS + '/' + info.project.name + '-viewer-captions.png' }); }
    await expect.poll(() => capBox(v), { timeout: 5000 }).not.toBeNull();
    const c = await capBox(v);
    expect(c.bottom).toBeLessThanOrEqual(c.barY);
    expect(c.font).toBeGreaterThanOrEqual(17);
    await expect(v.locator('#bc-visit')).toBeVisible();
    expect(c.visitHit).toBe(false);

    // CC on the picture hides the words, and the next line stays hidden.
    const vcc = v.locator('#bc-cap-btn');
    await expect(vcc).toBeVisible();
    const b = await vcc.boundingBox();
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
    await expect(vcc).toHaveAttribute('aria-pressed', 'true');
    await vcc.click();
    await expect(vcc).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => capBox(v)).toBeNull();
    await h.evaluate((t) => window.__gifosVideo.addTranscript(t + ' again'), LINE);
    await v.waitForFunction((t) => window.__gifosVideo.transcriptTexts().some((l) => l.includes(t + ' again')), LINE, { timeout: 20000 });
    expect(await capBox(v)).toBeNull();
    // A tap brings them back.
    await vcc.click();
    await expect(vcc).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => capBox(v), { timeout: 5000 }).not.toBeNull();
  } finally {
    await ctxH.close();
    await ctxV.close();
  }
});
