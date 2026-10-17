/*
 * cross-joinplate.js — a viewer joining a live service is never told "The
 * stage is clear." while the host is on stage and the picture is on its way.
 * Seen at every join: after Save the stage read "The stage is clear." until
 * the feed came in (0.2 to 12 s), even once the host's status said on stage.
 * The viewer's page holds the stage feed's tile for 2 s, so that window is
 * there every run.
 *
 *   1. the host goes live (see cross-lib.js)
 *   2. the viewer opens the link and saves the name card
 *   3. every frame until the feed shows, the stage plate's words are read
 *
 * Env: see cross-lib.js. Exit 0 on pass, 1 on fail.
 */
const { BASE, until, user, goLive, run } = require('./cross-lib.js');

run('cross-joinplate', async (hb, vb, shoot) => {
  const host = await goLive(hb, 'joinplate');
  const viewer = await user(vb, 'Jordan Lee');
  await viewer.addInitScript(() => {
    window.__said = [];
    const read = () => {
      const st = document.getElementById('bc-stage'), ln = document.getElementById('bc-stage-line');
      if (st && ln && !st.hidden && !document.getElementById('appear-modal')) {
        const t = ln.textContent;
        if (window.__said[window.__said.length - 1] !== t) window.__said.push(t);
      }
      if (!window.__tileIn) requestAnimationFrame(read);
    };
    requestAnimationFrame(read);
    // Hold the stage feed's tile 2 s; the app makes a new one each sweep
    // while none is in, and the newest goes in.
    const add = Node.prototype.appendChild;
    let pending = null;
    Node.prototype.appendChild = function (n) {
      if (this.id === 'stagefeed' && n && n.dataset && n.dataset.row === 'sgs' && !window.__tileIn) {
        if (!pending) {
          const feed = this;
          setTimeout(() => { window.__tileIn = true; add.call(feed, pending); }, 2000);
        }
        pending = n;
        return n;
      }
      return add.call(this, n);
    };
  });
  await viewer.goto(BASE + '/run.html?desk=crossview#' + host.url().split('#')[1]);
  await viewer.getByRole('button', { name: 'Save' }).click({ timeout: 20000 });
  // What the viewer sees while the picture is on its way.
  await viewer.waitForFunction(() => window.__said.length > 0 || window.__tileIn, null, { timeout: 5000 }).catch(() => {});
  await shoot();
  await until('the viewer stage has the host feed', async () => ({ ok: await viewer.evaluate(() => !!window.__tileIn) }), 30000);
  const said = await viewer.evaluate(() => window.__said);
  if (!said.length || said.includes('The stage is clear.')) throw new Error('the joining viewer read ' + JSON.stringify(said));
  return 'the joining viewer read ' + JSON.stringify(said);
});
