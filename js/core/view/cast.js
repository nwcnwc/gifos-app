/*
 * GifOS Core: the broadcast page's surface (cast.html). Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * The broadcast page is the meeting page with the Broadcast skin: the same signed core, media plane and view part. The
 * skin is the room's link fact `cast` (js/core/link.js; the core reads it: BC_INTENT, BROADCAST); a page opened as the broadcast page says
 * so in its address before the core reads it, so a reload or a shared address keeps the skin. What the Stage carries
 * and who is on it stay the core's answers.
 */
(function (root) {
  'use strict';
  var GifOS = root.GifOS = root.GifOS || {};
  GifOS.viewSurface = { name: 'cast', page: 'cast.html' };
  try {
    var h = String(root.location.hash || ''), L = root.GifOSLink;
    if (L && !L.read('', '', h).cast) root.history.replaceState(root.history.state, '', root.location.pathname + root.location.search + L.withCast(h));
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
