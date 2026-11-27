/*
 * gifos-identity-ui.js — what a person sees of "Me & My Contacts" (was "My identity") (js/gifos-identity.js), on the Home Screen and in Meet.
 * Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * It paints and asks; every rule (what an identity holds, how copies merge, what opens a file, when a code is good) is
 * the logic file's.
 *
 *   My identity     the sheet behind the GIF in the Identity folder and behind Meet's lobby line: what it holds, the
 *                   devices it is on, the ways to open its file, and the four things a person does with it
 *   Save            download the sealed GIF; the first time, choose how the file opens (a passphrase, or a passkey
 *                   where the device can seal with one)
 *   Open a file     a dropped or picked identity GIF: ask for its passphrase or passkey, merge it into this device
 *   Copy            device to device, in my personal room: the device that has the identity shows a code and a QR;
 *                   the other scans, or opens the room and types the code
 *   the note        "keep your identity file", after the first private room and when the kept file falls behind
 *
 * Attaches to `GifOS.identityUI`.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const doc = root.document;
  if (!doc || GifOS.identityUI) return;
  const ID = () => GifOS.identity;
  const T = () => GifOS.timings || {};
  const $ = (id) => doc.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  // Words I changed or added come from i18n/<locale>/identity.json (the English here is the fallback if it did not load).
  const tx = (k, fb, p) => { try { const g = root.GifOS && root.GifOS.i18n; if (g) { const v = g.t('identity.' + k, p); if (v && v !== 'identity.' + k) return v; } } catch (e) {} return fb.replace(/\{(\w+)\}/g, (m, n) => (p && p[n] != null ? p[n] : m)); };
  const loadWords = () => { try { const g = root.GifOS && root.GifOS.i18n; return g && g.load ? Promise.resolve(g.load('identity')).catch(() => {}) : Promise.resolve(); } catch (e) { return Promise.resolve(); } };
  const onMeet = () => /\/(meet|cast)(\.html)?$/.test(root.location.pathname);
  const here = () => { try { return GifOS.link ? GifOS.link.read(root.location.pathname, '', root.location.hash) : { room: '' }; } catch (e) { return { room: '' }; } };
  const sget = (k) => { try { return root.sessionStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const sset = (k, v) => { try { if (v) root.sessionStorage.setItem(k, v); else root.sessionStorage.removeItem(k); } catch (e) {} };
  const GIVE = 'gifos_id_give', COPY = 'gifos_id_copy';
  const meetUrl = (room, v, rest) => { const L = GifOS.link; const base = L.pageFor ? L.pageFor(root.location.pathname, 'meet') : '/meet'; return base + '#' + L.hash(rest ? { room, v, rest } : { room, v }); };
  const absUrl = (u) => { try { return new URL(u, root.location.href).href; } catch (e) { return u; } };

  // ---- one sheet -------------------------------------------------------------------------------------------------
  // The card is the shared dialog shape (js/dialog.js): a title, a body that scrolls, the buttons always on screen.
  const CSS = '' +
    '.lock-modal.idn{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:1rem}' +
    '.idn .lock-box{background:var(--surface,#14141f);border:1px solid var(--border,#2a2a3f);border-radius:.8rem;padding:1.4rem 1.5rem;max-width:440px;width:100%;color:var(--text,#e0e0f0);font:15px system-ui,sans-serif;box-sizing:border-box}' +
    '.idn h3{margin:0 0 .5rem;font-size:1.1rem}' +
    '.idn p{color:var(--muted,#b0b0c8);font-size:.88rem;line-height:1.5;margin:0 0 .8rem}' +
    '.idn .idn-list{margin:0 0 .8rem;padding:0;list-style:none;font-size:.9rem;line-height:1.7}' +
    '.idn .idn-list b{font-weight:600}' +
    '.idn .lock-btns{display:flex;flex-direction:column;gap:.5rem}' +
    '.idn button{padding:.55rem 1.2rem;border-radius:.5rem;border:1px solid var(--border,#2a2a3f);background:transparent;color:var(--text,#e0e0f0);cursor:pointer;font:inherit}' +
    '.idn button.ok{border-color:var(--accent,#7b5cff);background:var(--accent,#7b5cff);color:var(--onaccent,#fff)}' +
    '.idn input[type=text]{width:100%;box-sizing:border-box;padding:.6rem .7rem;border-radius:.5rem;border:1px solid var(--border,#2a2a3f);background:rgba(0,0,0,.25);color:inherit;font:600 1.15rem ui-monospace,monospace;letter-spacing:.12em;text-align:center;text-transform:uppercase;margin-bottom:.8rem}' +
    '.idn .idn-code{font:700 1.5rem ui-monospace,monospace;letter-spacing:.14em;text-align:center;margin:.2rem 0 .8rem;user-select:all}' +
    '.idn .idn-qr{background:#fff;border-radius:.5rem;padding:.4rem;width:190px;max-width:60%;margin:0 auto .8rem}' +
    '.idn .idn-qr svg{display:block;width:100%;height:auto}' +
    '.idn .idn-btnnote{color:var(--muted,#b0b0c8);font-size:.8rem;line-height:1.4;margin:-.2rem .2rem .3rem}' +
    '.idn .idn-state{font-size:.9rem;color:var(--text,#e0e0f0);margin-bottom:.8rem}' +
    '.idn .idn-err{color:#ff8a8a;font-size:.88rem;margin:0 0 .8rem}' +
    '.idn-note{margin:.6rem 0;padding:.7rem .8rem;border:1px solid var(--accent,#7b5cff);border-radius:.6rem;font-size:.88rem;line-height:1.45}' +
    '.idn-note .idn-row{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.5rem}' +
    '.idn-home-note{position:fixed;left:50%;transform:translateX(-50%);bottom:1rem;z-index:2147482000;max-width:min(440px,calc(100vw - 2rem));background:var(--surface,#14141f);color:var(--text,#e0e0f0);font:14px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4)}' +
    '.idn-home-note button{padding:.4rem .9rem;border-radius:.5rem;border:1px solid var(--border,#2a2a3f);background:transparent;color:inherit;cursor:pointer;font:inherit}' +
    '.idn-home-note button.ok{border-color:var(--accent,#7b5cff);background:var(--accent,#7b5cff);color:var(--onaccent,#fff)}';
  function css() { if ($('gifos-identity-css')) return; const s = doc.createElement('style'); s.id = 'gifos-identity-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s); }
  // sheet(name, html, buttons) -> { el, close, done (a promise of the pressed button's act) }. buttons: [[act, text, primary?]].
  function sheet(name, html, buttons) {
    css();
    const old = doc.querySelector('.lock-modal.idn[data-idn="' + name + '"]'); if (old) old.remove();
    const bg = doc.createElement('div'); bg.className = 'lock-modal idn'; bg.setAttribute('data-idn', name);
    bg.innerHTML = '<div class="lock-box" role="dialog" aria-modal="true">' + html + '<div class="lock-btns">' +
      buttons.map((b) => '<button type="button" data-act="' + esc(b[0]) + '"' + (b[2] ? ' class="ok"' : '') + '>' + esc(b[1]) + '</button>' + (b[3] ? '<div class="idn-btnnote">' + esc(b[3]) + '</div>' : '')).join('') + '</div></div>';
    let res; const done = new Promise((r) => { res = r; });
    const close = (act) => { try { bg.remove(); } catch (e) {} res(act || 'close'); };
    bg.addEventListener('click', (e) => {
      const b = e.target && e.target.closest && e.target.closest('[data-act]');
      if (b && !b.hasAttribute('data-stay')) close(b.getAttribute('data-act'));
    });
    doc.body.appendChild(bg);
    return { el: bg, close, done, q: (sel) => bg.querySelector(sel) };
  }
  const say = (title, text) => sheet('say', '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>', [['close', 'OK', true]]).done;

  // ---- words -------------------------------------------------------------------------------------------------------
  // What a file would add, in words: "your personal room, 3 contacts, 1 private room" (bold for the sheet).
  function addWords(a) {
    const out = [];
    if (a.mine) out.push(esc(tx('mine', 'your personal room')));
    if (a.privates) out.push(esc(tx('rooms', plural(a.privates, 'private room', 'private rooms'), { n: a.privates })));
    if (a.contacts) out.push(esc(tx('contacts', plural(a.contacts, 'contact', 'contacts'), { n: a.contacts })));
    if (a.cards) out.push(esc(tx('cards', plural(a.cards, 'card you gave', 'cards you gave'), { n: a.cards })));
    return out.join(', ');
  }
  function holds(c) {
    const a = [];
    if (c.mine) a.push('your personal room <b>' + esc(c.mine) + '</b>');
    if (c.privates) a.push('<b>' + plural(c.privates, 'private room', 'private rooms') + '</b>');
    if (c.contacts) a.push('<b>' + plural(c.contacts, 'contact', 'contacts') + '</b>');
    if (c.cards) a.push(plural(c.cards, 'card you gave', 'cards you gave'));
    return a.length ? a.join(', ') : 'nothing yet';
  }
  const dayOf = (at) => { try { return new Date(at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; } };
  function noteWords(n, st) {
    const more = st.devices.length > 1 ? ' ' + tx('noteDevices', 'It is also on ' + plural(st.devices.length - 1, 'other device', 'other devices') + ' of yours.', { n: st.devices.length - 1 }) : '';
    if (n.kind === 'more') return tx('noteMore', 'You have {rooms} that the file you saved on {day} does not hold. Save it again, so a lost or cleared browser cannot lose them.', { rooms: tx('rooms', plural(n.privates, 'private room', 'private rooms'), { n: n.privates }), day: dayOf(n.since) }) + more;
    return tx('noteFirst', 'Your private rooms live only in this browser. Save your Me & My Contacts file: if this browser\'s data is cleared or the device is lost, the file is the only way back to them.') + more;
  }

  // ---- save: download the sealed GIF -------------------------------------------------------------------------------
  function download(bytes, name) {
    const url = root.URL.createObjectURL(new root.Blob([bytes], { type: 'image/gif' }));
    const a = doc.createElement('a'); a.href = url; a.download = name; a.style.display = 'none';
    doc.body.appendChild(a); a.click();
    root.setTimeout(() => { try { a.remove(); root.URL.revokeObjectURL(url); } catch (e) {} }, T().IDENTITY_SCAN_MS);
  }
  // A new passphrase for the file. true when one was set.
  async function setPassphrase() {
    const min = GifOS.seal.PASS_MIN || 8;
    const p = await GifOS.seal.askPassphrase('Me & My Contacts', { confirm: true, title: 'A passphrase for this file', ok: 'Set this passphrase',
      lead: 'This file will open with this passphrase, on any device. Use at least ' + min + ' characters. Nobody can reset it or look it up: no copy of it exists anywhere. Anyone who has both the file and the passphrase is you on GifOS.' });
    if (!p) return false;
    await ID().addPassphrase(p);
    await ID().sync();
    return true;
  }
  // A passkey for the file. true when one was added; a device that cannot seal with a passkey says so and offers the passphrase.
  async function setPasskey() {
    try { await ID().addPasskey(); await ID().sync(); return true; }
    catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return false;   // the person closed the browser's own dialog
      const s = sheet('nokey', '<h3>A passkey cannot be used here</h3><p>' + esc(e && e.code === 'no-prf' ? 'This device\'s passkeys cannot seal a file.' : ((e && e.message) || 'This device cannot seal with a passkey.')) + ' A passphrase works on every device.</p>', [['pass', 'Use a passphrase', true], ['cancel', 'Cancel']]);
      return (await s.done) === 'pass' ? setPassphrase() : false;
    }
  }
  const passkeyHere = async () => { try { const a = await GifOS.seal.passkey.available(); return !!(a && a.ok); } catch (e) { return false; } };
  // ensureWay(): the file needs a way to open before it leaves the device. true when it has one.
  async function ensureWay() {
    if (ID().slots().length) return true;
    const pk = await passkeyHere();
    const s = sheet('way', '<h3>How should this file open?</h3><p>The file is sealed. Choose what opens it on another device, or on this one after its data was cleared.</p>' +
      '<p><b>A passphrase</b> works on every device.' + (pk ? ' <b>A passkey</b> opens it wherever your passkeys go (your phone\'s or browser\'s password manager).' : '') + ' You can have both.</p>',
      [['pass', 'Set a passphrase', true]].concat(pk ? [['key', 'Use a passkey']] : []).concat([['cancel', 'Cancel']]));
    const act = await s.done;
    if (act === 'pass') return setPassphrase();
    if (act === 'key') return setPasskey();
    return false;
  }
  async function save() {
    if (!(await ID().sync())) { await say('Me & My Contacts', 'There is nothing to save yet. Make your personal room in Rooms first.'); return false; }
    if (!(await ensureWay())) return false;
    const bytes = await ID().fileBytes();
    download(bytes, ID().FILE_NAME);
    ID().noteSaved();
    try { if (root.navigator.storage && root.navigator.storage.persist) root.navigator.storage.persist().catch(() => {}); } catch (e) {}
    paintAll();
    return true;
  }

  // ---- open a file ---------------------------------------------------------------------------------------------------
  // openFile(bytes) -> true when the file was merged into this device. Not an identity GIF -> null (the caller treats it
  // as any other GIF).
  async function openFile(bytes) {
    await loadWords();
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const seen = await ID().look(u); if (!seen) return null;
    let copy = null;
    if (ID().exists()) { try { copy = await ID().open(u); } catch (e) { copy = null; } }   // a file this identity wrote: nothing to ask
    if (!copy) {
      const ways = seen.slots.filter((s) => !s.gone);
      if (!ways.length) { await say('This file cannot be opened here', 'It was saved without a passphrase or passkey, so only the device that wrote it can read it. On that device, save this file again and choose how it opens.'); return false; }
      const hasPass = ways.some((s) => s.kind === 'passphrase'), hasKey = ways.some((s) => s.kind === 'passkey');
      let how = hasPass ? 'pass' : 'key';
      if (hasPass && hasKey) {
        how = await sheet('how', '<h3>Open this file</h3><p>This file opens with its passphrase or with your passkey.</p>', [['pass', 'Use the passphrase', true], ['key', 'Use my passkey'], ['cancel', 'Cancel']]).done;
        if (how !== 'pass' && how !== 'key') return false;
      }
      if (how === 'pass') {
        const got = await GifOS.seal.askPassphrase('Me & My Contacts', { title: 'Open this file', ok: 'Open', lead: 'Enter the passphrase you chose when you saved this file.', verify: async (p) => { copy = await ID().open(u, { passphrase: p }); return true; } });
        if (!got || !copy) return false;
      } else {
        try { copy = await ID().open(u, { passkey: true }); }
        catch (e) { await say('Could not open the file', hasPass ? 'That passkey is not on this device. Open the file again and use its passphrase.' : 'The passkey that opens this file is not on this device.'); return false; }
      }
    }
    const had = ID().exists() ? ID().counts() : null;
    // Say what the file would add, and ask, before anything is merged.
    const add = ID().peek(copy), list = addWords(add);
    const go = await sheet('confirm', '<h3>' + esc(had ? tx('mergeTitle', 'Merge in this file?') : tx('restoreTitle', 'Restore from this file?')) + '</h3>' +
      '<p>' + (list ? tx('adds', 'This file would add: {list}.', { list: '\u0001' }).split('\u0001').map(esc).join('<b>' + list + '</b>') : esc(tx('nothing', 'Nothing in this file is new to this device.'))) + '</p>' +
      '<p>' + esc(had ? tx('mergeLead', 'Nothing here is replaced or deleted.') : tx('restoreLead', 'Your personal room and your private rooms will open from here as they did before.')) + '</p>',
      [['yes', had ? tx('doMerge', 'Merge it in') : tx('doRestore', 'Restore'), true], ['no', tx('cancel', 'Cancel')]]).done;
    if (go !== 'yes') return false;
    const r = ID().take(copy);
    ID().noteSaved(Object.keys(copy.recs).filter((rid) => rid.indexOf('private/') === 0 && !copy.recs[rid].d).length);   // the person holds this file: it is their kept copy
    await ID().sync();
    try { if (root.navigator.storage && root.navigator.storage.persist) root.navigator.storage.persist().catch(() => {}); } catch (e) {}
    paintAll();
    const c = r.counts;
    await sheet('opened', '<h3>' + (had ? 'The file was merged in' : 'Me & My Contacts is on this device') + '</h3><p>It holds ' + holds(c) + '.</p>' +
      (had ? '<p>Nothing on this device was lost: what the file had and what this device had are both here now.</p>' : '<p>Your personal room and your private rooms open from here as they did before.</p>'), [['close', 'Done', true]]).done;
    return true;
  }
  function pickFile() {
    const inp = doc.createElement('input'); inp.type = 'file'; inp.accept = 'image/gif,.gif'; inp.style.display = 'none';
    inp.setAttribute('data-idn-file', '1');
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
      const r = await openFile(new Uint8Array(await f.arrayBuffer())).catch((e) => { say('Could not open the file', (e && e.message) || 'The file is damaged.'); return false; });
      if (r === null) say('Not a Me & My Contacts file', 'That GIF is not a Me & My Contacts file.');
    };
    doc.body.appendChild(inp); inp.click();
  }

  // ---- the My identity sheet ---------------------------------------------------------------------------------------
  async function manage() {
    await loadWords();
    await ID().sync().catch(() => false);
    const st = ID().status();
    if (!st.exists) {
      const act = await sheet('manage', '<h3>Me & My Contacts</h3><p>' + esc(tx('noneIntro', 'Me & My Contacts is one sealed file that is you on GifOS: your rooms, contacts, keys and settings. This device doesn\'t have one yet.')) + '</p>' +
        '<p>' + esc(tx('noneLead', 'Make your personal room in Rooms to start one, or bring yours from another device or a saved file.')) + '</p>',
        [['get', tx('copyFrom', 'Copy from another device'), true], ['file', tx('restoreBtn', 'Restore from a saved file')], ['close', 'Close']]).done;
      if (act === 'get') getFrom(); else if (act === 'file') pickFile();
      return;
    }
    const pk = await passkeyHere();
    const hasPass = st.slots.some((s) => s.kind === 'passphrase'), keys = st.slots.filter((s) => s.kind === 'passkey').length;
    const ways = !st.slots.length ? 'not chosen yet (asked when you first save the file)' : [hasPass ? 'a passphrase' : '', keys ? plural(keys, 'passkey', 'passkeys') : ''].filter(Boolean).join(' and ');
    const devs = st.devices.map((d) => esc(d.name || 'A device') + (d.here ? ' (this one)' : '')).join(', ');
    const n = st.nudge;
    const html = '<h3>Me & My Contacts</h3>' +
      '<p>' + esc(tx('intro', 'Me & My Contacts: one sealed file that is you on GifOS: your rooms, contacts, keys and settings. No server has a copy. Keep the file and you can always come back; copy it and you\'re on another device.')) + '</p>' +
      (n ? '<div class="idn-note">' + esc(noteWords(n, st)) + '</div>' : '') +
      '<ul class="idn-list"><li>Holds: ' + holds(st.counts) + '</li><li>On: ' + devs + '</li><li>The file opens with: ' + esc(ways) + '</li>' +
      '<li>File last saved: ' + (st.saved ? esc(dayOf(st.saved.at)) : '<b>never</b>') + '</li></ul>';
    const act = await sheet('manage', html, [['save', tx('save', 'Save this file'), true], ['copy', tx('copyOut', 'Copy to another device')], ['pass', hasPass ? 'Change the passphrase' : 'Set a passphrase']]
      .concat(pk ? [['key', 'Add a passkey']] : []).concat([['file', tx('mergeBtn', 'Merge in a saved file…'), false, tx('mergeNote', "Adds anything from that file that this device doesn't have yet. Nothing here is replaced or deleted.")], ['close', 'Close']])).done;
    if (act === 'save') await save();
    else if (act === 'copy') copyOut();
    else if (act === 'pass') { if (await setPassphrase()) manage(); }
    else if (act === 'key') { if (await setPasskey()) manage(); }
    else if (act === 'file') pickFile();
  }

  // ---- device to device ---------------------------------------------------------------------------------------------
  // copyOut(): from anywhere, on the device that has the identity. The copy happens in my personal room, so go there.
  function copyOut() {
    const m = ID().counts().mine ? JSON.parse(root.localStorage.getItem('gifos_myroom') || 'null') : null;
    if (!m) { say('Make your personal room first', 'Copying to another device happens in your personal room. Make it in Rooms, then come back.'); return; }
    sset(GIVE, '1');
    const h = here();
    if (onMeet() && h.room === m.room && String(h.v || '').toLowerCase() === m.v) { startGive(); return; }
    root.location.assign(meetUrl(m.room, m.v)); if (onMeet()) root.location.reload();
  }
  async function getFrom() {
    await loadWords();
    const how = tx('getHow', 'With the other device beside you: on it, open Me & My Contacts and choose {copy}. Scan the QR it shows with this device\'s camera. No camera? Use Copy room link there, open that link on this device, and type the code.', { copy: tx('copyOut', 'Copy to another device') });
    sheet('get', '<h3>' + esc(tx('getTitle', 'Copy from another device')) + '</h3>' +
      '<p>' + how + '</p>' +
      '<p>' + tx('getFile', 'With your saved file: restore it here.') + '</p>', [['file', tx('restoreBtn', 'Restore from a saved file'), true], ['close', 'Close']]).done.then((act) => { if (act === 'file') pickFile(); });
  }
  function qrInto(box, text) {
    const draw = () => { try { const q = root.qrcode(0, 'M'); q.addData(text); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) { box.textContent = ''; } };
    if (typeof root.qrcode === 'function') return draw();
    const s = doc.createElement('script'); s.src = 'js/vendor/qrcode.js'; s.onload = draw; doc.head.appendChild(s);
  }
  let part = null;          // this meeting's copy part (made by the My Room part)
  let giveSheet = null, getSheet = null;
  const waitPart = (ms) => new Promise((res) => {
    const t0 = Date.now();
    const look = () => { const p = GifOS.meetMyRoom && GifOS.meetMyRoom.live && GifOS.meetMyRoom.live.identity; if (p) return res(p); if (Date.now() - t0 > ms) return res(null); root.setTimeout(look, T().IDENTITY_LOOK_MS); };
    look();
  });
  // The words that started a copy (GIVE, COPY) stay in this tab's session until the copy ends: a page that loads again in
  // the middle (an update, a lost connection) picks the copy up again instead of dropping it.
  async function startGive() {
    const p = part || await waitPart(20000); if (!p) return;
    // The page holds the room once the core has read its host key: a moment after the part exists.
    let code = '';
    for (let i = 0; i < 40 && !code; i++) { try { code = await p.offer(); } catch (e) { if (!e || e.code !== 'not-owner') break; await new Promise((r) => root.setTimeout(r, T().IDENTITY_LOOK_MS)); } }
    if (!code) { sset(GIVE, ''); say('Open your personal room', 'Copying to another device happens in your personal room, on a device that holds it.'); return; }
    showGive(code);
  }
  function showGive(code) {
    const h = here();
    const linkCode = absUrl(meetUrl(h.room, h.v, { copy: code })), linkAsk = absUrl(meetUrl(h.room, h.v, { copy: 'ask' }));
    const mins = Math.round((T().IDENTITY_CODE_MS || 0) / 1000 / 60);
    giveSheet = sheet('give', '<h3>' + esc(tx('copyOut', 'Copy to another device')) + '</h3>' +
      '<p>Scan this with the other device\'s camera. Both devices end up with everything, and nothing leaves them: the copy goes straight from this page to that one, encrypted.</p>' +
      '<div class="idn-qr" id="idn-qr"></div>' +
      '<p>No camera? Open your room on the other device (<i>Copy room link</i>), then type this code there:</p>' +
      '<div class="idn-code" id="idn-code">' + esc(ID().showCode(code)) + '</div>' +
      '<div class="idn-state" id="idn-give-state">Waiting for your other device. The code is good for ' + mins + ' minutes and works once.</div>',
      [['link', 'Copy room link'], ['stop', 'Cancel']]);
    const lb = giveSheet.q('[data-act="link"]'); lb.setAttribute('data-stay', '1');
    lb.onclick = async () => { try { await root.navigator.clipboard.writeText(linkAsk); lb.textContent = 'Link copied'; } catch (e) { const st = giveSheet && giveSheet.q('#idn-give-state'); if (st) { st.textContent = linkAsk; st.style.userSelect = 'all'; st.style.wordBreak = 'break-all'; } } };
    qrInto(giveSheet.q('#idn-qr'), linkCode);
    giveSheet.done.then((act) => { if (act === 'stop') { sset(GIVE, ''); if (part) part.stop(); } giveSheet = null; });
  }
  async function startGet(word) {
    const p = part || await waitPart(20000); if (!p) return;
    if (ID().tidyCode(word).length === ID().CODE_LEN) return askWith(word);
    getSheet = sheet('getcode', '<h3>' + esc(tx('copyFrom', 'Copy from another device')) + '</h3><p>Type the code your other device shows under <i>' + esc(tx('copyOut', 'Copy to another device')) + '</i>.</p>' +
      '<input type="text" id="idn-code-in" maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX">' +
      '<div class="idn-err" id="idn-get-err" hidden></div>', [['go', tx('copyFrom', 'Copy from another device'), true], ['cancel', 'Cancel']]);
    const go = getSheet.q('[data-act="go"]'); go.setAttribute('data-stay', '1');
    const s = getSheet;
    s.done.then((act) => { if (act === 'cancel') sset(COPY, ''); });
    const run = () => { const v = s.q('#idn-code-in').value; if (ID().tidyCode(v).length !== ID().CODE_LEN) { const er = s.q('#idn-get-err'); er.hidden = false; er.textContent = 'The code has ' + ID().CODE_LEN + ' letters and digits.'; return; } sset(COPY, ID().tidyCode(v)); s.close('go'); askWith(v); };
    go.onclick = run;
    s.q('#idn-code-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    try { s.q('#idn-code-in').focus(); } catch (e) {}
  }
  async function askWith(code) {
    getSheet = sheet('getting', '<h3>Copying from your other device</h3><div class="idn-state" id="idn-get-state">Looking for your other device in this room…</div>', [['cancel', 'Cancel']]);
    getSheet.done.then((act) => { if (act === 'cancel') { sset(COPY, ''); if (part) part.stop(); } });
    try { await part.ask(code); } catch (e) { getSheet.close(); say('Check the code', (e && e.message) || 'That code is not right.'); }
  }
  function onCopy(ev) {
    if (ev.type === 'give') {
      const el = giveSheet && giveSheet.q('#idn-give-state');
      if (ev.state === 'copying' && el) el.textContent = 'Copying to ' + (ev.name || 'your other device') + '…';
      if (ev.state === 'done') { sset(GIVE, ''); if (giveSheet) giveSheet.close(); paintAll(); ID().sync().catch(() => {}); sheet('gave', '<h3>Done</h3><p>' + esc(ev.name || 'Your other device') + ' now has your Me & My Contacts file' + (ev.news ? ', and what it had is here too' : '') + '. It holds ' + holds(ev.counts) + '.</p>', [['close', 'Done', true]]); }
      if (ev.state === 'expired' || ev.state === 'spent') { sset(GIVE, ''); if (giveSheet) giveSheet.close(); say(ev.state === 'spent' ? 'That code was stopped' : 'The code ran out', ev.state === 'spent' ? 'Too many wrong tries. Nothing was copied. Start again for a new code.' : 'Nothing was copied. Start again for a new code.'); }
    }
    if (ev.type === 'get') {
      const el = getSheet && getSheet.q('#idn-get-state');
      if (ev.state === 'copying' && el) el.textContent = 'Found it. Copying…';
      if (ev.state === 'no') { sset(COPY, 'ask'); if (getSheet) getSheet.close(); sheet('getno', '<h3>That code did not work</h3><p>Check the code on your other device and type it again. A code works once and for a few minutes.</p>', [['again', 'Type the code again', true], ['close', 'Close']]).done.then((a) => { if (a === 'again') startGet('ask'); else sset(COPY, ''); }); }
      if (ev.state === 'expired') { sset(COPY, ''); if (getSheet) getSheet.close(); say('Could not find your other device', 'Open your personal room on the device that has your file, choose Copy to another device there, and try again.'); }
      if (ev.state === 'done') {
        sset(COPY, '');
        if (getSheet) getSheet.close();
        ID().sync().catch(() => {}).then(() => sheet('got', '<h3>Me & My Contacts is on this device</h3><p>It holds ' + holds(ev.counts) + '. This page now opens your room again, as yours.</p>', [['close', 'Open my room', true]]).done).then(() => { root.location.reload(); });
      }
    }
  }

  // ---- Meet's lobby line, the note, and the Home Screen ------------------------------------------------------------
  function paintLobby() {
    if (!onMeet() || here().room) return;
    const myroom = $('lob-myroom'); if (!myroom) return;
    let box = $('lob-identity');
    if (!box) { box = doc.createElement('div'); box.id = 'lob-identity'; box.className = 'lob-myroom lob-identity'; myroom.parentNode.insertBefore(box, myroom.nextSibling); }
    css();
    const st = ID().status();
    let h = '<div class="lob-hist-h">Me & My Contacts</div>';
    if (st.exists) {
      if (st.nudge) h += '<div class="idn-note" id="idn-nudge">' + esc(noteWords(st.nudge, st)) + '<div class="idn-row"><button type="button" id="idn-nudge-save" class="lob-ghost">' + esc(tx('save', 'Save this file')) + '</button><button type="button" id="idn-nudge-later" class="lob-ghost">Later</button></div></div>';
      h += '<div class="mr-mine"><span class="li-name lob-quiet">' + (st.devices.length > 1 ? 'On ' + st.devices.length + ' devices. ' : '') + (st.saved ? 'File saved ' + esc(dayOf(st.saved.at)) + '.' : 'File not saved yet.') + '</span>' +
        '<button type="button" id="idn-open" class="lob-ghost">Me & My Contacts</button><button type="button" id="idn-copy" class="lob-ghost">' + esc(tx('copyOut', 'Copy to another device')) + '</button></div>';
    } else {
      h += '<div class="mr-mine"><span class="li-name lob-quiet">Already have a room on another device?</span><button type="button" id="idn-get" class="lob-ghost">' + esc(tx('copyFrom', 'Copy from another device')) + '</button></div>';
    }
    if (box.getAttribute('data-h') === h) return;
    box.setAttribute('data-h', h); box.innerHTML = h;
    const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
    on('idn-open', manage); on('idn-copy', copyOut); on('idn-get', getFrom);
    on('idn-nudge-save', save); on('idn-nudge-later', () => { ID().noteLater(); paintLobby(); });
  }
  function paintHome() {
    if (onMeet() || !doc.querySelector('#desktop, .desktop, #surface')) return;
    const st = ID().status(), n = st.exists && st.nudge;
    let el = $('idn-home-note');
    if (!n) { if (el) el.remove(); return; }
    css();
    if (!el) { el = doc.createElement('div'); el.id = 'idn-home-note'; el.className = 'idn-note idn-home-note'; doc.body.appendChild(el); }
    el.innerHTML = esc(noteWords(n, st)) + '<div class="idn-row"><button type="button" class="ok" id="idn-home-save">' + esc(tx('save', 'Save this file')) + '</button><button type="button" id="idn-home-later">Later</button></div>';
    $('idn-home-save').onclick = save;
    $('idn-home-later').onclick = () => { ID().noteLater(); paintHome(); };
  }
  function paintAll() { try { paintLobby(); paintHome(); } catch (e) {} }

  let syncT = 0;
  function syncSoon() { if (syncT) return; syncT = root.setTimeout(() => { syncT = 0; ID().sync().then(paintAll, () => {}); }, T().IDENTITY_LOOK_MS); }
  async function start() {
    if (!ID()) return;
    // An embedded meeting (a room on someone's page) is not a place for a person's identity.
    try { if (root.top !== root) return; } catch (e) { return; }
    await loadWords();
    await ID().sync().catch(() => false);
    paintAll();
    root.addEventListener('storage', (e) => { if (e.key && e.key.indexOf('gifos_') === 0) syncSoon(); });
    doc.addEventListener('visibilitychange', () => { if (!doc.hidden) syncSoon(); });
    // A page writes its own storage without an event: look on a slow period (a contact saved, a private room made).
    root.setInterval(() => { if (!doc.hidden) ID().sync().then(paintAll, () => {}); }, T().IDENTITY_SCAN_MS);
    if (onMeet() && !here().room) {   // the lobby is built a moment later by the My Room view
      let n = 0; const iv = root.setInterval(() => { paintLobby(); if ($('lob-identity') || ++n > 40) root.clearInterval(iv); }, T().IDENTITY_LOOK_MS);
    }
    if (onMeet() && here().room) {
      // The meeting's copy part exists once the core has read the address (the copy word among it): only then look.
      part = await waitPart(3 * (T().IDENTITY_CODE_MS || 0)); if (!part) return;
      part.on(onCopy);
      const give = sget(GIVE), word = sget(COPY);
      if (give) startGive(); else if (word) startGet(word);
    }
  }

  // Meet's Settings: rows the meeting paints itself (not in meet.html) get the same tag as the rest: Follows you /
  // This device only (docs/identity.md, Settings that follow you). The tag is a copy of meet.html's own (already in the
  // page's language). The Doorbell's row tags each of its settings inside.
  const RUNTIME_SCOPE = { 'set-pip': 'device', 'sub-body': 'device', 'set-bell': 'mixed' };
  function scopeRows() {
    const m = $('set-modal'); if (!m) return;
    for (const id of Object.keys(RUNTIME_SCOPE)) {
      const row = $(id); if (!row || row.hasAttribute('data-scope') || !m.contains(row)) continue;
      const sc = RUNTIME_SCOPE[id]; row.setAttribute('data-scope', sc); if (sc === 'mixed') continue;
      const tag = m.querySelector('small[data-t="' + (sc === 'you' ? 'setScopeYou' : 'setScopeDevice') + '"]'), b = row.querySelector('b');
      if (tag && b) b.appendChild(tag.cloneNode(true));
    }
  }
  function watchScopes() {
    const m = $('set-modal'); if (!m || typeof root.MutationObserver !== 'function') return;
    scopeRows(); new root.MutationObserver(scopeRows).observe(m, { childList: true, subtree: true });
  }

  GifOS.identityUI = { manage, save, openFile, pickFile, copyOut, getFrom, paint: paintAll };
  const go = () => { try { watchScopes(); } catch (e) {} start().catch((e) => { try { console.error('identity: ' + (e && e.stack || e)); } catch (x) {} }); };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
})(typeof window !== 'undefined' ? window : globalThis);
