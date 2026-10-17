import { test, expect } from '@playwright/test';

// A church shares Sunday's link on Wednesday. The link carries the start
// time, so a viewer reads when to come back, and someone who opens it long
// after reads that it has ended instead of "has not started".

const AV = '0123456789abcdef0123456789abcdef';
// Wednesday 14 Oct 2026, noon in New York. Sunday's service is 10:00 AM.
const NOW = new Date('2026-10-14T12:00:00-04:00');
const SUNDAY = Math.floor(new Date('2026-10-18T10:00:00-04:00').getTime() / 1000);

test.use({ timezoneId: 'America/New_York', locale: 'en-US' });

function roomUrl(name, at) {
  return '/run.html#v=' + name + '&av=' + AV + '&bc=1' + (at ? '&at=' + at : '');
}
const fresh = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function openViewer(page, url) {
  await page.clock.setFixedTime(NOW);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#nmok').click();
  await page.locator('#bc-ended').waitFor({ state: 'visible' });
}

test('a viewer with Sunday’s link on Wednesday reads when it starts', async ({ page }) => {
  await openViewer(page, roomUrl(fresh('sun'), SUNDAY));
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service starts Sunday at 10:00 AM.');
  await expect(page.locator('#status')).toContainText('The service starts Sunday at 10:00 AM.');
  await expect(page.locator('#livebadge-txt')).toHaveText('OFF AIR');
  const cal = page.locator('#bc-cal');
  await expect(cal).toBeVisible();
  await expect(cal).toHaveText('Add to calendar');
  const box = await cal.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  const bar = await page.locator('.bar').boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(bar.y + 1);
  const ics = await page.evaluate(async () => {
    const a = document.getElementById('bc-cal');
    const r = await fetch(a.href);
    return { text: await r.text(), name: a.download };
  });
  expect(ics.name).toMatch(/\.ics$/);
  expect(ics.text).toContain('BEGIN:VEVENT');
  expect(ics.text).toContain('DTSTART:20261018T140000Z');
  expect(ics.text).toMatch(/URL:http:\/\/127\.0\.0\.1:8765\/run\.html#v=sun[^\r\n]*at=1792/);
});

test('a viewer reads a time the same day and the next day', async ({ page }) => {
  const today = Math.floor(new Date('2026-10-14T18:30:00-04:00').getTime() / 1000);
  await openViewer(page, roomUrl(fresh('tdy'), today));
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service starts today at 6:30 PM.');
  const tomorrow = Math.floor(new Date('2026-10-15T09:00:00-04:00').getTime() / 1000);
  await page.goto('about:blank');
  await openViewer(page, roomUrl(fresh('tmw'), tomorrow));
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service starts tomorrow at 9:00 AM.');
});

test('a viewer who is early by minutes reads that it is about to start', async ({ page }) => {
  const late = Math.floor(new Date('2026-10-14T11:50:00-04:00').getTime() / 1000);
  await openViewer(page, roomUrl(fresh('soon'), late));
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service is about to start.');
  await expect(page.locator('#bc-cal')).toBeHidden();
});

test('someone who opens the link hours after the service reads that it ended', async ({ page }) => {
  const sundayPast = Math.floor(new Date('2026-10-11T10:00:00-04:00').getTime() / 1000);
  await openViewer(page, roomUrl(fresh('past'), sundayPast));
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service has ended.');
  await expect(page.locator('#status')).toContainText('The service has ended.');
  await expect(page.locator('#bc-cal')).toBeHidden();
});

test('a link without a time still reads that it has not started', async ({ page }) => {
  await openViewer(page, roomUrl(fresh('none')));
  await expect(page.locator('#bc-ended-txt')).toHaveText('The service has not started.');
  await expect(page.locator('#bc-cal')).toBeHidden();
});

test('the host sets Sunday at 10:00 AM in More, and Invite shares it', async ({ page }) => {
  const room = fresh('host');
  await page.addInitScript(([r, av]) => {
    localStorage.setItem('gifos_vadm_' + r + '.' + av, 'stored-host-key');
  }, [room, AV]);
  await page.clock.setFixedTime(NOW);
  await page.goto(roomUrl(room), { waitUntil: 'domcontentloaded' });
  await page.locator('#hdrinvite').waitFor({ state: 'visible' });
  await page.locator('#bartoggle').click();
  const when = page.locator('#bcwhen');
  await expect(when).toBeVisible();
  const box = await when.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await when.fill('2026-10-18T10:00');
  await when.dispatchEvent('change');
  await expect(page.locator('#bcwhen-lbl')).toHaveText('Starts Sunday at 10:00 AM');
  const shared = await page.evaluate(() => {
    let payload = null;
    navigator.share = (p) => { payload = p; return Promise.resolve(); };
    document.getElementById('hdrinvite').click();
    return payload;
  });
  expect(shared.url).toContain('at=' + SUNDAY);
  expect(shared.text).toContain('Sunday at 10:00 AM');
  // A reload keeps the time on the host's phone.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#hdrinvite').waitFor({ state: 'visible' });
  const again = await page.evaluate(() => {
    let payload = null;
    navigator.share = (p) => { payload = p; return Promise.resolve(); };
    document.getElementById('hdrinvite').click();
    return payload;
  });
  expect(again.url).toContain('at=' + SUNDAY);
});
