/*
 * GifOS Core: the broadcast page's surface (cast.html). Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * The broadcast page is the meeting page with the Broadcast skin: the same signed core, media plane and view part. The
 * PAGE is the view: this surface tells the core "broadcast" through its interface (GifOS.viewSurface; the core reads it:
 * BC_INTENT, BROADCAST), never by writing into the address. A link names only the room (js/core/link.js); a reload or a
 * shared address keeps the skin because the address is this page (/cast, cast.html). What the Stage carries and who
 * is on it stay the core's answers.
 */
(function (root) {
  'use strict';
  var GifOS = root.GifOS = root.GifOS || {};
  GifOS.viewSurface = { name: 'cast', page: 'cast.html' };
})(typeof window !== 'undefined' ? window : globalThis);
