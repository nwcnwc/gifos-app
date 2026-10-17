import { test, expect } from '@playwright/test';

const AV = '0123456789abcdef0123456789abcdef';

async function dismissName(page) {
  const ok = page.locator('#nmok');
  if (await ok.count()) await ok.click();
}

test('a phone dock names each control and has one Unmute', async ({ page }) => {
  await page.goto('/run.html#v=docklab' + Date.now().toString(36), { waitUntil: 'domcontentloaded' });
  await dismissName(page);
  await page.locator('#leavebtn').waitFor({ state: 'visible' });
  await expect(page.locator('#unmute')).toHaveCount(0);
  const place = await page.evaluate(() => {
    const ids = ['cam', 'flipcam', 'mic', 'reactbtn', 'bartoggle', 'leavebtn'];
    const controls = ids.map((id) => {
      const el = document.getElementById(id);
      const lab = el.querySelector('.docklab');
      const r = el.getBoundingClientRect();
      const lr = lab.getBoundingClientRect();
      return {
        id,
        word: (lab.textContent || '').trim(),
        labH: lr.height,
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        h: r.height,
        vw: innerWidth,
        vh: innerHeight,
      };
    });
    const unmute = [...document.querySelectorAll('button')].filter((b) => {
      if (!b.getClientRects().length) return false;
      return (b.innerText || '').trim() === 'Unmute' || b.getAttribute('aria-label') === 'Unmute';
    }).map((b) => b.id);
    return { controls, unmute };
  });
  expect(place.unmute).toEqual(['mic']);
  const words = { cam: 'Camera', flipcam: 'Flip', mic: 'Unmute', reactbtn: 'React', bartoggle: 'More', leavebtn: 'Leave' };
  for (const control of place.controls) {
    expect(control.word, control.id).toBe(words[control.id]);
    expect(control.labH, control.id).toBeGreaterThan(8);
    expect(control.left, control.id).toBeGreaterThanOrEqual(-0.5);
    expect(control.right, control.id).toBeLessThanOrEqual(control.vw + 0.5);
    expect(control.bottom, control.id).toBeLessThanOrEqual(control.vh + 0.5);
    expect(control.h, control.id).toBeGreaterThanOrEqual(44);
  }
});

test('a muted mic is the only Unmute, and it becomes Mute', async ({ page }) => {
  await page.addInitScript(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    navigator.mediaDevices.getUserMedia = async () => {
      const stream = new MediaStream();
      stream.addTrack(canvas.captureStream(5).getVideoTracks()[0]);
      const ac = new AudioContext();
      const dest = ac.createMediaStreamDestination();
      const osc = ac.createOscillator();
      osc.connect(dest);
      osc.start();
      const audio = dest.stream.getAudioTracks()[0];
      if (audio) stream.addTrack(audio);
      return stream;
    };
  });
  await page.goto('/run.html#v=dockmic' + Date.now().toString(36), { waitUntil: 'domcontentloaded' });
  await dismissName(page);
  await expect(page.locator('#mic .docklab')).toHaveText('Unmute');
  await page.locator('#mic').click();
  await expect(page.locator('#mic .docklab')).toHaveText('Mute');
  await expect(page.locator('#mic')).toHaveAttribute('aria-label', 'Mute');
  const still = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.getClientRects().length && ((b.innerText || '').includes('Unmute') || b.getAttribute('aria-label') === 'Unmute')).map((b) => b.id));
  expect(still).toEqual([]);
});

test('a broadcast viewer does not get a second Unmute', async ({ page }) => {
  await page.goto('/run.html#v=dockview' + Date.now().toString(36) + '&av=' + AV + '&bc=1', { waitUntil: 'domcontentloaded' });
  await dismissName(page);
  await page.locator('#livebadge').waitFor({ state: 'visible' });
  const unmute = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.getClientRects().length && ((b.innerText || '').trim() === 'Unmute' || b.getAttribute('aria-label') === 'Unmute')).length);
  expect(unmute).toBe(0);
  await expect(page.locator('#reactbtn .docklab')).toHaveText('React');
  await expect(page.locator('#bartoggle .docklab')).toHaveText('More');
  await expect(page.locator('#leavebtn .docklab')).toHaveText('Leave');
});

test('a short landscape dock keeps the marks and hides the words', async ({ page }) => {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) });
  await page.goto('/run.html#v=dockland' + Date.now().toString(36), { waitUntil: 'domcontentloaded' });
  await dismissName(page);
  await page.evaluate(() => { if (window.__meetChromeShow) window.__meetChromeShow(); });
  await page.locator('#leavebtn').waitFor({ state: 'visible' });
  const box = await page.evaluate(() => {
    const lab = document.querySelector('#cam .docklab');
    const bar = document.querySelector('.bar').getBoundingClientRect();
    return { shown: getComputedStyle(lab).display, barH: bar.height, vh: innerHeight };
  });
  expect(box.shown).toBe('none');
  expect(box.barH).toBeLessThanOrEqual(48.5);
  expect(box.vh).toBeLessThanOrEqual(420);
});
