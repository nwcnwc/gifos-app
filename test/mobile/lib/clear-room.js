/*
 * Make a test room's faces clear, the way a real room gets there: a password
 * (setRoomPwForTest, this page only), this page's camera on with No blur,
 * and each seated guest's status beat saying camera on, no blur. Until then
 * faces stay soft room-wide, and a host's tile offers no Blur for all
 * (host-tile-blur-states.js). In an admin room the admin counts as present
 * on its next sweep (2s), and tiles repaint on the next beat, so this beats
 * until every guest's picture is clear.
 *
 * Returns true once every id's tile is clear. Needs &debug=on and guests
 * seated with seedGalleryForTest. Lives under lib/ so runall.sh skips it.
 */
async function clearRoom(page, ids, status) {
  await page.evaluate(() => window.__gifosVideo.setRoomPwForTest('qa-pass'));
  await page.evaluate(() => { const c = document.getElementById('cam'); if (c && c.classList.contains('off')) c.click(); });
  await page.waitForFunction(() => !document.getElementById('cam').classList.contains('off'), null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => { const b = document.getElementById('blur-none'); if (b) b.click(); });
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(400);
    const ok = await page.evaluate((a) => {
      for (const id of a.ids) window.__gifosVideo.setPeerStatusForTest(id, Object.assign({ camOff: false, blur: 0 }, (a.status || {})[id] || {}));
      return a.ids.every((id) => {
        const v = document.querySelector('#grid .tile[data-peer="' + id + '"] video');
        return !!v && !v.classList.contains('blur1') && !v.classList.contains('blur2');
      });
    }, { ids, status });
    if (ok) { await page.waitForTimeout(200); return true; }
  }
  return false;
}

module.exports = { clearRoom };
