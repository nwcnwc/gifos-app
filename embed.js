/*
 * GifOS embed: put a live GifOS Broadcast in any web page.
 *
 *   <script src="https://gifos.app/embed.js" data-room="ROOM" data-verifier="VERIFIER" data-title="My show"></script>
 *
 * Your hosted broadcast's viewer link is https://gifos.app/cast/ROOM/VERIFIER:
 * data-room is ROOM and data-verifier is VERIFIER (or put the whole link in
 * data-room). Only hosted broadcasts embed: an open room (no verifier) shows
 * a card saying so and joins nothing. The script puts a 16:9 player
 * right where the tag is. The plain form, with no script:
 *
 *   <iframe src="https://gifos.app/embed#room=ROOM&v=VERIFIER" style="width:100%;aspect-ratio:16/9;border:0"
 *     allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="GifOS Broadcast"></iframe>
 *
 * Viewers watch with no camera or microphone, and the video stays blurred
 * until they type the room password inside the player (your page never sees
 * it). data-password makes the player clear for everyone who opens your page;
 * it is then public in your page's source.
 */
(function () {
  var s = document.currentScript;
  if (!s || !s.parentNode) return;
  var raw = String(s.getAttribute('data-room') || '').trim();
  var ver = String(s.getAttribute('data-verifier') || '').trim();
  // A whole viewer link in data-room: /cast/ROOM/VERIFIER.
  var link = raw.match(/\/cast\/([a-z0-9-]{1,64})(?:\/([a-f0-9]{16,64}))?\/?(?:[?#].*)?$/i);
  if (link) { raw = link[1]; ver = ver || link[2] || ''; }
  var m = /^[a-z0-9-]{1,64}$/i.test(raw) ? [raw, raw, ver] : null;
  var origin = 'https://gifos.app';
  try { origin = new URL(s.src, location.href).origin; } catch (e) {}
  var box = document.createElement('div');
  box.className = 'gifos-embed';
  box.style.cssText = 'position:relative;width:100%;max-width:100%;aspect-ratio:16/9;background:#000;overflow:hidden';
  if (!('aspectRatio' in box.style)) { box.style.height = '0'; box.style.paddingTop = '56.25%'; }
  if (!m) {
    box.style.cssText += ';color:#eee;font:14px system-ui,sans-serif;display:flex;align-items:center;justify-content:center';
    box.textContent = 'GifOS embed: data-room should name your broadcast (the ROOM in gifos.app/cast/ROOM/VERIFIER).';
    s.parentNode.insertBefore(box, s.nextSibling);
    return;
  }
  var title = String(s.getAttribute('data-title') || '').slice(0, 80);
  var pw = s.getAttribute('data-password');
  // No verifier is an open room: the player itself says it cannot be embedded (one place for that rule).
  var hash = '#room=' + m[1] + (m[2] ? '&v=' + m[2].toLowerCase() : '')
    + (title ? '&title=' + encodeURIComponent(title) : '')
    + (pw ? '&pw=' + encodeURIComponent(pw) : '');
  var f = document.createElement('iframe');
  f.src = origin + '/embed' + hash;
  f.title = title || 'GifOS Broadcast';
  f.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');   // never camera or microphone: a viewer brings no media
  f.setAttribute('allowfullscreen', '');
  f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  f.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:0';
  box.appendChild(f);
  s.parentNode.insertBefore(box, s.nextSibling);
})();
