const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qapwinv&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: false }));
}

async function openMore(page, id) {
  if (!(await page.locator(id).isVisible())) {
    if (!(await page.locator('#barmore').isVisible())) await page.click('#bartoggle');
    if (!(await page.locator(id).isVisible())) await page.click('#moretools');
  }
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

test.describe('German password and invite', () => {
  test.use({ locale: 'de-DE' });
  test('Password and Invite follow a German device', async ({ page }) => {
    await boot(page);
    await expect(page.locator('#pwbtn')).toHaveAttribute('title', 'Diesen Raum mit einem Passwort sperren');
    await openMore(page, '#pwbtn');
    const pw = page.locator('#pw-modal');
    await expect(pw).toBeVisible();
    await expect(pw.locator('#pw-title')).toHaveText('Raum-Passwort');
    await expect(pw.locator('#pw-hint')).toContainText('Jeder in der Besprechung');
    await expect(pw.locator('#pw-hint')).toContainText('Sperre');
    await expect(pw.locator('#pw-new')).toHaveAttribute('placeholder', 'Neues Passwort');
    await expect(pw.locator('#pw-save')).toHaveText('Speichern');
    await expect(pw.locator('#pw-cancel')).toHaveText('Schließen');
    await expect(pw.locator('#pweye-pw-new')).toHaveAttribute('aria-label', 'Passwort zeigen');
    await expect(pw).not.toContainText('Room password');
    await expect(pw).not.toContainText('New password');
    const pg = await sheetFit(page, '#pw-modal');
    expect(pg.lang).toBe('de');
    expect(pg.font).toBeGreaterThanOrEqual(16);
    expect(pg.titleClip).toBe(false);
    expect(pg.onScreen).toBe(true);
    expect(pg.boxOnScreen).toBe(true);
    await page.click('#pw-cancel');
    await expect(pw).toBeHidden();

    await expect(page.locator('#invite')).toHaveAttribute('title', 'Freunde kommen mit einem Link live dazu');
    await openMore(page, '#invite');
    const inv = page.locator('#inv-modal');
    await expect(inv).toBeVisible();
    await expect(inv.locator('h3')).toHaveText('Diese Besprechung teilen');
    await expect(inv).toContainText('Link');
    await expect(inv.locator('#inv-copy')).toHaveText('Kopieren');
    await expect(inv.locator('#inv-done')).toHaveText('Schließen');
    await expect(inv.locator('#inv-mkadm')).toHaveText('Einen Raum anlegen, den Sie leiten →');
    await expect(inv).not.toContainText('Share this meeting');
    await expect(inv).not.toContainText('Create a room you control');
    const ig = await sheetFit(page, '#inv-modal');
    expect(ig.font).toBeGreaterThanOrEqual(16);
    expect(ig.titleClip).toBe(false);
    expect(ig.boxOnScreen).toBe(true);
    await page.click('#inv-mkadm');
    await expect(inv.locator('#inv-adm-room')).toHaveAttribute('placeholder', 'Raumname (wie Sie wollen)');
    await expect(inv.locator('#inv-adm-pass')).toHaveAttribute('placeholder', 'Admin-Passwort (für Sie allein)');
    await expect(inv.locator('#inv-adm-guest')).toHaveAttribute('placeholder', 'Gast-Passwort (optional — an Gäste geben)');
    await expect(inv.locator('#inv-adm-back')).toHaveText('Zurück');
    await expect(inv.locator('#inv-adm-go')).toHaveText('Anlegen und wechseln');
    const warnDe = await inv.innerText();
    expect(warnDe.includes('Sie wechseln jetzt dorthin.') || warnDe.includes('wechseln nicht von selbst')).toBe(true);
    await expect(inv).not.toContainText('Room name');
    await expect(inv).not.toContainText("You'll switch");
  });
});

test.describe('Spanish password and invite', () => {
  test.use({ locale: 'es-MX' });
  test('Password and Invite follow a Spanish device', async ({ page }) => {
    await boot(page);
    await expect(page.locator('#pwbtn')).toHaveAttribute('title', 'Cierra esta sala con una contraseña');
    await openMore(page, '#pwbtn');
    const pw = page.locator('#pw-modal');
    await expect(pw.locator('#pw-title')).toHaveText('Contraseña de la sala');
    await expect(pw.locator('#pw-hint')).toContainText('Cualquiera en la reunión');
    await expect(pw.locator('#pw-new')).toHaveAttribute('placeholder', 'Contraseña nueva');
    await expect(pw.locator('#pw-save')).toHaveText('Guardar');
    await expect(pw.locator('#pw-cancel')).toHaveText('Cerrar');
    await expect(pw.locator('#pweye-pw-new')).toHaveAttribute('aria-label', 'Mostrar contraseña');
    await expect(pw).not.toContainText('Room password');
    const pg = await sheetFit(page, '#pw-modal');
    expect(pg.lang).toBe('es');
    expect(pg.font).toBeGreaterThanOrEqual(16);
    expect(pg.boxOnScreen).toBe(true);
    await page.click('#pw-cancel');

    await expect(page.locator('#invite')).toHaveAttribute('title', 'Tus amigos entran en vivo con un enlace');
    await openMore(page, '#invite');
    const inv = page.locator('#inv-modal');
    await expect(inv.locator('h3')).toHaveText('Compartir esta reunión');
    await expect(inv.locator('#inv-copy')).toHaveText('Copiar');
    await expect(inv.locator('#inv-done')).toHaveText('Cerrar');
    await expect(inv.locator('#inv-mkadm')).toHaveText('Crear una sala que tú diriges →');
    await expect(inv).not.toContainText('Share this meeting');
    const ig = await sheetFit(page, '#inv-modal');
    expect(ig.font).toBeGreaterThanOrEqual(16);
    expect(ig.boxOnScreen).toBe(true);
    await page.click('#inv-mkadm');
    await expect(inv.locator('#inv-adm-room')).toHaveAttribute('placeholder', 'Nombre de la sala (el que quieras)');
    await expect(inv.locator('#inv-adm-go')).toHaveText('Crear y cambiar');
    const warnEs = await inv.innerText();
    expect(warnEs.includes('Pasas ahora.') || warnEs.includes('no se mueven solas')).toBe(true);
    await expect(inv).not.toContainText('Room name');
  });
});
