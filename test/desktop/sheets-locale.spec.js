const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qasheets&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: false }));
}

async function openMore(page, id) {
  if (!(await page.locator(id).isVisible())) await page.click('#bartoggle');
  await page.click(id);
}

async function sheetFit(page, sel) {
  return page.evaluate((sel) => {
    const box = document.querySelector(sel + ' .name-box');
    const title = document.querySelector(sel + ' h3');
    const br = box.getBoundingClientRect();
    const tr = title.getBoundingClientRect();
    return {
      lang: document.documentElement.lang,
      font: parseFloat(getComputedStyle(title).fontSize),
      titleClip: title.scrollWidth > title.clientWidth + 2,
      onScreen: tr.top >= -1 && tr.left >= -1 && tr.right <= window.innerWidth + 1 && tr.bottom <= window.innerHeight + 1,
      boxOnScreen: br.top >= -1 && br.left >= -1 && br.right <= window.innerWidth + 1 && br.bottom <= window.innerHeight + 1,
    };
  }, sel);
}

test.describe('German sheets', () => {
  test.use({ locale: 'de-DE' });
  test('Who, Share and Vote follow a German device', async ({ page }) => {
    await boot(page);
    await openMore(page, '#whobtn');
    const who = page.locator('#who-modal');
    await expect(who.locator('h3')).toHaveText('Wer in dieser Besprechung ist');
    await expect(who).toContainText('Kein Server in der Mitte');
    await expect(who.locator('#who-dl')).toHaveText('Diese Liste laden');
    await expect(who.locator('#who-close')).toHaveText('Schließen');
    await expect(who).not.toContainText('Who is on this meeting');
    await expect(who).not.toContainText('Download this list');
    await expect(page.locator('#whobtn')).toHaveAttribute('title', 'Wer in dieser Besprechung ist — Namen und Internetadressen');
    const wg = await sheetFit(page, '#who-modal');
    expect(wg.lang).toBe('de');
    expect(wg.font).toBeGreaterThanOrEqual(16);
    expect(wg.titleClip).toBe(false);
    expect(wg.onScreen).toBe(true);
    expect(wg.boxOnScreen).toBe(true);
    await page.click('#who-close');

    await expect(page.locator('#sharebtn .dockword')).toHaveText('Bildschirm');
    await expect(page.locator('#sharebtn')).toHaveAttribute('title', /App starten/);
    await expect(page.locator('#share-modal')).toBeHidden();
    expect(await page.evaluate(() => !!document.getElementById('sharebtn').closest('#barmore'))).toBe(false);

    await openMore(page, '#votebtn');
    const vote = page.locator('#vote-modal');
    await expect(vote.locator('h3')).toHaveText('Abstimmen');
    await expect(vote).toContainText('Eine Stimme pro Person');
    await expect(vote.locator('[data-vm="up"]')).toContainText('Auf die Bühne wählen');
    await expect(vote.locator('[data-vm="down"]')).toContainText('Von der Bühne wählen');
    await expect(vote.locator('[data-vm="kick"]')).toContainText('Aus dem Raum wählen');
    await expect(vote).not.toContainText('Place a vote');
    await expect(vote).not.toContainText('Vote onto stage');
    await expect(page.locator('#votebtn')).toHaveAttribute('title', 'Jemanden auf die Bühne, von der Bühne oder aus dem Raum wählen — die Mehrheit entscheidet');
    const vg = await sheetFit(page, '#vote-modal');
    expect(vg.font).toBeGreaterThanOrEqual(16);
    expect(vg.boxOnScreen).toBe(true);
    const up = vote.locator('[data-vm="up"]');
    const upBox = await up.boundingBox();
    expect(upBox.height).toBeGreaterThanOrEqual(40);
    await up.click();
    await expect(page.locator('#votebanner-text')).toContainText('AUF die Bühne');
    await expect(page.locator('#votebanner-text')).not.toContainText('ONTO');
    await expect(page.locator('#vote-done')).toHaveText('Fertig');
    await expect(page.locator('#reshare-back p')).toHaveText('Ihr Bildschirmteilen endete, als Sie zurückkamen.');
    await expect(page.locator('#reshare-go')).toHaveText('Noch einmal teilen');
    await expect(page.locator('#reshare-back')).not.toContainText('Share again');
  });
});

test.describe('Spanish sheets', () => {
  test.use({ locale: 'es-MX' });
  test('Who, Share and Vote follow a Spanish device', async ({ page }) => {
    await boot(page);
    await openMore(page, '#whobtn');
    const who = page.locator('#who-modal');
    await expect(who.locator('h3')).toHaveText('Quién está en esta reunión');
    await expect(who).toContainText('No hay un servidor en medio');
    await expect(who.locator('#who-dl')).toHaveText('Descargar esta lista');
    await expect(who.locator('#who-close')).toHaveText('Cerrar');
    await expect(who).not.toContainText('Who is on this meeting');
    await expect(page.locator('#whobtn')).toHaveAttribute('title', 'Quién está en esta reunión — nombres y direcciones de internet');
    await page.click('#who-close');

    await expect(page.locator('#sharebtn .dockword')).toHaveText('Pantalla');
    await expect(page.locator('#sharebtn')).toHaveAttribute('title', /Abrir app/);
    await expect(page.locator('#share-modal')).toBeHidden();
    expect(await page.evaluate(() => !!document.getElementById('sharebtn').closest('#barmore'))).toBe(false);

    await openMore(page, '#votebtn');
    const vote = page.locator('#vote-modal');
    await expect(vote.locator('h3')).toHaveText('Votar');
    await expect(vote).toContainText('Un voto cada uno');
    await expect(vote.locator('[data-vm="up"]')).toContainText('Votar al escenario');
    await expect(vote).not.toContainText('Place a vote');
    await expect(page.locator('#votebtn')).toHaveAttribute('title', /decide la mayoría/);
    await vote.locator('[data-vm="up"]').click();
    await expect(page.locator('#votebanner-text')).toContainText('AL escenario');
    await expect(page.locator('#vote-done')).toHaveText('Listo');
    await expect(page.locator('#reshare-back p')).toHaveText('Dejaste de compartir al volver.');
    await expect(page.locator('#reshare-go')).toHaveText('Compartir otra vez');
    await expect(page.locator('#reshare-back')).not.toContainText('Your screen share stopped');
  });
});
