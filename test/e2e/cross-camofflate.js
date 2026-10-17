/*
 * cross-camofflate.js — a viewer sees who is on stage (initial, name, Camera
 * off) when the host's camera-off status reaches them before the stage feed.
 * Seen 1 run in 3 at join: the stage stayed a bare grey frame with no name.
 * The viewer's page holds the feed's tile until the host's name is known
 * and the card has gone quiet, so that order happens every run.
 *
 *   1. the host goes live with the camera off (see cross-lib.js)
 *   2. the viewer opens the link; its stage tile waits for the host's status
 *   3. the stage shows the card on the first frame after the tile goes in
 *      (not a bare frame until some later repaint), and after it settles
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { BASE, sleep, until, user, goLive, run } = require('./cross-lib.js');

const look = (pg) => pg.evaluate(() => {
  const card = document.getElementById('bc-ident');
  const v = document.querySelector('#stagefeed .rowtile video');
  return { card: getComputedStyle(card).display !== 'none' ? card.innerText.replace(/\s+/g, ' ').trim() : '',
    tile: !!v, frame: v ? getComputedStyle(v).visibility : '', held: window.__heldTile || 0, atFrame: window.__atFrame || '' };
});

run('cross-camofflate', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'camofflate');
  const viewer = await user(vb, 'Jordan Lee');
  await viewer.addInitScript(() => {
    // Every repaint of the card rewrites the name; hold the tile until the
    // name is known and has not been rewritten for 1 s.
    let lastPaint = 0;
    document.addEventListener('DOMContentLoaded', () => {
      const nm = document.getElementById('bc-ident-name');
      new MutationObserver(() => { lastPaint = Date.now(); }).observe(nm, { childList: true, characterData: true, subtree: true });
    });
    // While held the app finds no tile and makes a new one each sweep; the
    // newest is the one that goes in.
    const add = Node.prototype.appendChild;
    let pending = null;
    Node.prototype.appendChild = function (n) {
      if (this.id === 'stagefeed' && n && n.dataset && n.dataset.row === 'sgs' && window.__heldTile !== 2) {
        const first = !pending;
        pending = n;
        if (first) {
          window.__heldTile = 1;
          const feed = this;
          const t = setInterval(() => {
            const nm = document.getElementById('bc-ident-name');
            if (!nm || !nm.textContent.trim() || Date.now() - lastPaint < 1000) return;
            clearInterval(t);
            window.__heldTile = 2;
            add.call(feed, pending);
            // What the viewer sees on the next painted frame.
            requestAnimationFrame(() => requestAnimationFrame(() => {
              window.__atFrame = document.getElementById('bc-ident').classList.contains('on') ? 'card' : 'bare frame';
            }));
          }, 50);
        }
        return n;
      }
      return add.call(this, n);
    };
  });
  await viewer.goto(BASE + '/run.html?desk=crossview#' + host.url().split('#')[1]);
  await viewer.getByRole('button', { name: 'Save' }).click({ timeout: 20000 });
  await until('the viewer stage has the host frame', async () => { const s = await look(viewer); return { ok: s.tile, ...s }; }, 30000);
  await sleep(5000); // the host's status and name settle
  const seen = await look(viewer);
  await shoot();
  if (seen.atFrame !== 'card' || !/Pastor Kim/.test(seen.card) || !/Camera off/.test(seen.card) || seen.frame !== 'hidden') throw new Error('viewer stage reads ' + JSON.stringify(seen));
  return 'the viewer reads ' + JSON.stringify(seen.card) + ' on the stage ' + JSON.stringify(seen);
});
