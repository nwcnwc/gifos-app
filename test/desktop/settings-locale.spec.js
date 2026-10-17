const { test, expect } = require('@playwright/test');

async function openSettings(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qaset&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.click('#bartoggle');
  await page.click('#moretools');
  await page.click('#setbtn');
  await expect(page.locator('#set-modal')).toBeVisible();
}

async function fit(page) {
  return page.evaluate(() => {
    const box = document.querySelector('#set-modal .name-box');
    const title = document.querySelector('#set-modal h3');
    const br = box.getBoundingClientRect();
    const tr = title.getBoundingClientRect();
    const timing = Array.from(document.querySelectorAll('#timingrow button')).map((b) => ({
      t: b.textContent.trim(),
      clip: b.scrollWidth > b.clientWidth + 2,
    }));
    return {
      lang: document.documentElement.lang,
      title: title.textContent.trim(),
      font: parseFloat(getComputedStyle(title).fontSize),
      titleClip: title.scrollWidth > title.clientWidth + 2,
      onScreen: tr.width > 8 && tr.top >= -1 && tr.left >= -1 && tr.right <= window.innerWidth + 1 && tr.bottom <= window.innerHeight + 1,
      boxOnScreen: br.top >= -1 && br.left >= -1 && br.right <= window.innerWidth + 1 && br.bottom <= window.innerHeight + 1,
      timing,
    };
  });
}

test.describe('German settings', () => {
  test.use({ locale: 'de-DE' });
  test('settings follow a German device', async ({ page }) => {
    await openSettings(page);
    const box = page.locator('#set-modal');
    await expect(box.locator('h3')).toHaveText('Einstellungen');
    await expect(box).toContainText('Videoqualität');
    await expect(box).toContainText('Was Ihre eigene Kamera');
    await expect(box.locator('#vqrow button').first()).toHaveText('Automatisch');
    await expect(box).toContainText('Ihr Name');
    await expect(box.locator('#set-rename')).toHaveText('Ändern');
    await expect(box).toContainText('Untertitel im Browser');
    await expect(box).toContainText('Whisper auf diesem Gerät');
    await expect(box).toContainText('Klang');
    await expect(box.locator('[data-timing="chat"]')).toHaveText('Gespräch');
    await expect(box.locator('[data-timing="unison"]')).toHaveText('Einklang');
    await expect(box.locator('[data-timing="song"]')).toContainText('Lied');
    await expect(box.locator('#set-close')).toHaveText('Schließen');
    await expect(box).not.toContainText('Video quality');
    await expect(box).not.toContainText('Your name');
    await expect(box).not.toContainText('Sound mix');
    const g = await fit(page);
    expect(g.lang).toBe('de');
    expect(g.font).toBeGreaterThanOrEqual(16);
    expect(g.titleClip).toBe(false);
    expect(g.onScreen).toBe(true);
    expect(g.boxOnScreen).toBe(true);
    expect(g.timing.every((b) => !b.clip)).toBe(true);
  });
});

test.describe('Spanish settings', () => {
  test.use({ locale: 'es-MX' });
  test('settings follow a Spanish device', async ({ page }) => {
    await openSettings(page);
    const box = page.locator('#set-modal');
    await expect(box.locator('h3')).toHaveText('Ajustes');
    await expect(box).toContainText('Calidad de video');
    await expect(box.locator('#vqrow button').first()).toHaveText('Automático');
    await expect(box).toContainText('Tu nombre');
    await expect(box.locator('#set-rename')).toHaveText('Cambiar');
    await expect(box).toContainText('Subtítulos del navegador');
    await expect(box).toContainText('Mezcla');
    await expect(box.locator('[data-timing="chat"]')).toHaveText('Conversación');
    await expect(box.locator('[data-timing="song"]')).toContainText('Canción');
    await expect(box.locator('#set-close')).toHaveText('Cerrar');
    await expect(box).not.toContainText('Video quality');
    await expect(box).not.toContainText('Sound mix');
    const g = await fit(page);
    expect(g.lang).toBe('es');
    expect(g.font).toBeGreaterThanOrEqual(16);
    expect(g.titleClip).toBe(false);
    expect(g.onScreen).toBe(true);
    expect(g.timing.every((b) => !b.clip)).toBe(true);
  });
});
