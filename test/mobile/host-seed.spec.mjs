import { test, expect } from '@playwright/test';

// Q72. Nobody watched, the host ended the service, and someone opens the
// link afterwards. The host's phone kept it (Q69), and while the host's
// replay is still open that phone hands it to the late arrival.

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['camera', 'microphone'] });

test('a late arrival watches the copy the host kept', async ({ browser }, info) => {
  test.setTimeout(120000);
  const opts = info.project.use;
  const ctxH = await browser.newContext({ ...opts, permissions: ['camera', 'microphone'] });
  const ctxL = await browser.newContext({ ...opts });
  try {
    const h = await ctxH.newPage();
    await h.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
    await h.locator('#lob-admin-go').click();
    await expect(h.locator('#recbtn')).toHaveText(/^Stop /, { timeout: 20000 });
    await h.waitForTimeout(2500);
    const link = await h.evaluate(() => location.hash);
    expect(link).toMatch(/av=[0-9a-f]+/);

    // The host ends the service. The replay sheet says latecomers can watch.
    await h.locator('#leavebtn').click();
    await h.locator('#leave-go').click();
    await expect(h.locator('#rec-replay')).toBeVisible({ timeout: 15000 });
    await expect(h.locator('#rec-replay-seed')).toHaveText(/Anyone who opens the link while this stays open can watch it\./);
    const kept = await h.evaluate(async () => (await (await fetch(document.getElementById('rec-replay-vid').src)).blob()).size);
    expect(kept).toBeGreaterThan(1000);

    // Someone who missed it opens the link.
    const l = await ctxL.newPage();
    await l.goto('/run.html' + link, { waitUntil: 'domcontentloaded' });
    await l.locator('#nmok').click();
    await expect(l.locator('#bc-ended-txt')).toHaveText('The service has ended.', { timeout: 45000 });
    await expect(l.locator('#livebadge-txt')).toHaveText('OFF AIR');
    // The host is still connected, but nobody is in a service that ended.
    await expect(l.locator('#status')).not.toHaveText(/in the service/);
    const watch = l.locator('#bc-replay');
    await expect(watch).toBeVisible();
    await watch.click();
    await expect(l.locator('#rec-replay')).toBeVisible({ timeout: 30000 });
    await l.waitForFunction(() => {
      const v = document.getElementById('rec-replay-vid');
      return !!(v && v.src && v.readyState >= 1);
    }, null, { timeout: 30000 });
    const got = await l.evaluate(async () => (await (await fetch(document.getElementById('rec-replay-vid').src)).blob()).size);
    expect(got).toBe(kept);

    // Close on the host's sheet is the real leave: the card comes up.
    await h.locator('#rec-replay-close').click();
    await expect(h.locator('#left-modal')).toBeVisible();
  } finally {
    await ctxH.close();
    await ctxL.close();
  }
});
