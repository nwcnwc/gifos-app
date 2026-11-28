/*
 * GifOS Core: the meeting page's surface (meet.html). Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * The meeting page hosts the signed core, the browser media plane and the meeting's view part (js/core/view/view.js,
 * one part for the meeting and the broadcast page). This file names the surface; it decides no rule of the meeting.
 */
(function (root) {
  'use strict';
  var GifOS = root.GifOS = root.GifOS || {};
  GifOS.viewSurface = { name: 'meet', page: 'meet.html' };
})(typeof window !== 'undefined' ? window : globalThis);
