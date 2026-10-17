import { test, expect } from '@playwright/test';

test('chat text follows the root size and stays above the dock', async ({ page }) => {
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#leavebtn').waitFor({ state: 'visible' });
  const cancel = page.locator('#nmok');
  try {
    await cancel.waitFor({ state: 'visible', timeout: 2000 });
    await cancel.evaluate((el) => el.click());
  } catch { /* stored name */ }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
    document.getElementById('chatpanel').classList.add('open');
    document.getElementById('chatlog').innerHTML = '<div class="cmsg"><b>Ada</b>Hello from the back row</div>';
  });
  const box = await page.evaluate(() => {
    const log = document.getElementById('chatlog');
    const name = log.querySelector('b');
    const msg = log.querySelector('.cmsg');
    const input = document.getElementById('chat-in');
    const send = document.querySelector('#chatform button[type="submit"]');
    const bar = document.querySelector('.bar');
    const panel = document.getElementById('chatpanel');
    const r = (el) => el.getBoundingClientRect();
    const ir = r(input);
    const sr = r(send);
    const br = r(bar);
    const pr = r(panel);
    const mr = r(msg);
    return {
      log: parseFloat(getComputedStyle(log).fontSize),
      name: parseFloat(getComputedStyle(name).fontSize),
      input: parseFloat(getComputedStyle(input).fontSize),
      send: parseFloat(getComputedStyle(send).fontSize),
      inputBottom: ir.bottom,
      sendBottom: sr.bottom,
      sendH: sr.height,
      barTop: br.top,
      panelTop: pr.top,
      panelBottom: pr.bottom,
      msgTop: mr.top,
      msgBottom: mr.bottom,
      vh: innerHeight,
    };
  });
  expect(box.log).toBeGreaterThanOrEqual(32);
  expect(box.name).toBeGreaterThanOrEqual(28);
  expect(box.input).toBeGreaterThanOrEqual(32);
  expect(box.send).toBeGreaterThanOrEqual(32);
  expect(box.sendH).toBeGreaterThanOrEqual(44);
  expect(box.inputBottom).toBeLessThanOrEqual(box.barTop + 1);
  expect(box.sendBottom).toBeLessThanOrEqual(box.barTop + 1);
  expect(box.panelBottom).toBeLessThanOrEqual(box.barTop + 1);
  expect(box.msgTop).toBeGreaterThanOrEqual(box.panelTop - 1);
  expect(box.msgBottom).toBeLessThanOrEqual(box.panelBottom + 1);
  expect(box.msgBottom).toBeLessThanOrEqual(box.vh);
});
