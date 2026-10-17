import { test, expect } from '@playwright/test';

// Q75. A town hall, a church Q&A night, a streamer's AMA: a hundred people
// watching can't all raise a hand, and chat buries the one question everybody
// wants asked. A viewer asks from More, everyone sees the questions with the
// most votes on top, and the host puts one on every viewer's picture.

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['camera', 'microphone'] });

const Q1 = 'Will the food pantry be open on Thanksgiving week?';
const Q2 = 'How do I sign up to volunteer for the youth trip?';

async function bandBox(page, text) {
  return page.evaluate((t) => {
    const hits = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && e.textContent.includes(t)
      && !e.closest('#qa') && !e.closest('#chatpanel'));
    const shown = hits.filter((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return e.getClientRects().length && r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.5
        && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    });
    if (!shown.length) return null;
    const r = shown[0].getBoundingClientRect();
    const hit = (sel) => {
      const el = document.querySelector(sel);
      if (!el || !el.getClientRects().length) return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && r.left < b.right && b.left < r.right && r.top < b.bottom && b.top < r.bottom;
    };
    return { top: r.top, bottom: r.bottom, font: parseFloat(getComputedStyle(shown[0]).fontSize),
      barY: document.querySelector('.bar').getBoundingClientRect().y,
      hits: ['#fitbtn', '#bc-give', '#bc-cap', '.topchip', '#livebadge'].filter(hit) };
  }, text);
}

async function openQuestions(page) {
  await page.locator('#bartoggle').click();
  const b = page.locator('#qabtn');
  await expect(b).toBeVisible();
  const bb = await b.boundingBox();
  expect(bb.height).toBeGreaterThanOrEqual(44);
  await b.click();
  await expect(page.locator('#qa')).toBeVisible();
}

test('a viewer asks, votes sort the questions, and the host puts one on every picture', async ({ browser }, info) => {
  test.setTimeout(150000);
  const opts = info.project.use;
  const ctxH = await browser.newContext({ ...opts, permissions: ['camera', 'microphone'] });
  const ctxV = await browser.newContext({ ...opts });
  try {
    const h = await ctxH.newPage();
    await h.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
    await h.locator('#lob-admin-go').click();
    await expect(h.locator('#livebadge-txt')).toHaveText('LIVE', { timeout: 20000 });
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

    // The viewer asks two questions from More.
    await openQuestions(v);
    for (const q of [Q1, Q2]) {
      await v.locator('#qa-in').fill(q);
      await v.locator('#qa-ask').click();
      await expect(v.locator('#qa-list .qrow', { hasText: q })).toBeVisible();
    }
    // A viewer has no Show: only the host decides what the room reads.
    await expect(v.locator('#qa-list .qshow')).toHaveCount(0);

    // The host reads both and votes for the second; it moves to the top.
    await openQuestions(h);
    await expect(h.locator('#qa-list .qrow')).toHaveCount(2, { timeout: 20000 });
    await h.locator('#qa-list .qrow', { hasText: Q2 }).locator('.qvote').click();
    await expect(h.locator('#qa-list .qrow').first()).toContainText(Q2);
    await expect(v.locator('#qa-list .qrow').first()).toContainText(Q2, { timeout: 20000 });
    await expect(v.locator('#qa-list .qrow').first().locator('.qvote')).toContainText('1');
    // Questions stay out of the chat.
    expect(await v.evaluate((t) => document.getElementById('chatlog').textContent.includes(t), Q1)).toBe(false);

    // The host puts Q2 on the picture; the viewer reads it there, clear of
    // Fit, Give, the captions, and the dock.
    await h.locator('#qa-list .qrow', { hasText: Q2 }).locator('.qshow').click();
    await v.locator('#qa-close').click();
    await expect(v.locator('#qa')).toBeHidden();
    await expect.poll(() => bandBox(v, Q2), { timeout: 20000 }).not.toBeNull();
    if (process.env.SHOTS) { await v.waitForTimeout(500); await v.screenshot({ path: process.env.SHOTS + '/' + info.project.name + '-questions.png' }); }
    const b = await bandBox(v, Q2);
    expect(b.bottom).toBeLessThanOrEqual(b.barY);
    expect(b.font).toBeGreaterThanOrEqual(17);
    expect(b.hits).toEqual([]);
    // The asker's name rides with it.
    await expect(v.locator('#bc-q')).toContainText(/asks/);
    // At large type it still clears Fit, the chip, and the dock.
    await v.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    await expect.poll(async () => { const x = await bandBox(v, Q2); return x && x.hits.length === 0 && x.bottom <= x.barY; }, { timeout: 5000 }).toBe(true);
    await v.evaluate(() => { document.documentElement.style.fontSize = ''; });

    // Taken down: the picture is clear again.
    await h.locator('#qa-list .qrow', { hasText: Q2 }).locator('.qshow').click();
    await expect.poll(() => bandBox(v, Q2), { timeout: 20000 }).toBeNull();
  } finally {
    await ctxH.close();
    await ctxV.close();
  }
});
